"""Stage 1 - Fetch & cache: raw files + checksums + manifest of sources.

Copies every source file into <CACHE_DIR>/raw/ and records a sha256 per file in
<CACHE_DIR>/manifest.json, so re-runs can tell which sources changed.

Optional network fetch (``--fetch sources.yaml``, run BEFORE stage 1): ``fetch_sources`` downloads NTRS PDFs
and direct URLs INTO ``--source``, so stage 1's manifest / sha256 logic stays the single source of truth.
It uses a generic User-Agent, at most 1 request/s per host, honours 429 ``Retry-After``, checks robots.txt
once per host, and skips re-downloads when the stored ETag / Last-Modified still matches (``downloads.json``).
PSI datasets need a login, which is never automated; direct CSV URLs work through ``urls:``.
"""

from __future__ import annotations

import asyncio
import hashlib
import json
import logging
import os
import re
import shutil
import time
import urllib.robotparser
from collections.abc import Awaitable, Callable
from dataclasses import asdict, dataclass, field
from datetime import UTC, datetime
from email.utils import parsedate_to_datetime
from pathlib import Path, PurePosixPath
from typing import Any
from urllib.parse import unquote, urljoin, urlsplit

import httpx
import yaml

from app.core.config import get_settings

logger = logging.getLogger(__name__)

SUPPORTED = {".csv", ".json", ".md", ".pdf", ".txt"}


def default_cache_dir() -> Path:
    """Ingestion cache directory (``settings.CACHE_DIR``, default ``backend/data/.cache``)."""
    return get_settings().CACHE_DIR


@dataclass
class SourceFile:
    path: str  # path inside the cache
    original: str  # relative path inside source_dir
    sha256: str
    size: int
    source_type: str  # psi_dataset | ntrs | iss_page | telemetry | other
    fetched_at: str
    changed: bool


def _sha256(p: Path) -> str:
    h = hashlib.sha256()
    with p.open("rb") as fh:
        for block in iter(lambda: fh.read(1 << 16), b""):
            h.update(block)
    return h.hexdigest()


def _source_type(p: Path) -> str:
    parts = {x.lower() for x in p.parts}
    suffix = p.suffix.lower()
    name = p.name.lower()
    if "corpus" in parts or suffix == ".pdf":
        return "ntrs"
    if "iss_pages" in parts:
        return "iss_page"
    if "telemetry" in name:
        return "telemetry"
    if suffix in {".csv", ".json"}:
        return "psi_dataset"
    return "other"


def fetch(source_dir: Path, cache_dir: Path | None = None) -> list[SourceFile]:
    cache_dir = cache_dir or default_cache_dir()
    cache_resolved = cache_dir.resolve()
    source_dir = Path(source_dir).resolve()
    raw = cache_dir / "raw"
    raw.mkdir(parents=True, exist_ok=True)
    manifest_path = cache_dir / "manifest.json"
    merged_manifest: dict[str, dict[str, Any]] = {}
    old_hashes: dict[str, str] = {}
    if manifest_path.exists():
        try:
            for entry in json.loads(manifest_path.read_text(encoding="utf-8")):
                orig = str(entry.get("original", ""))
                merged_manifest[orig] = entry
                old_hashes[orig] = entry.get("sha256", "")
        except json.JSONDecodeError:
            pass

    out: list[SourceFile] = []
    for p in sorted(source_dir.rglob("*")):
        p_resolved = p.resolve()
        if p_resolved == cache_resolved or cache_resolved in p_resolved.parents:
            continue
        if not p.is_file() or p.suffix.lower() not in SUPPORTED:
            continue
        rel = p.relative_to(source_dir)
        rel_key = rel.as_posix()
        dest = raw / rel
        dest.parent.mkdir(parents=True, exist_ok=True)
        digest = _sha256(p)
        prev_sha = old_hashes.get(rel_key) or old_hashes.get(str(rel)) or old_hashes.get(str(p))
        changed = prev_sha != digest
        if changed or not dest.exists():
            shutil.copy2(p, dest)
        sf = SourceFile(
            str(dest),
            rel_key,
            digest,
            p.stat().st_size,
            _source_type(rel),
            datetime.now(UTC).isoformat(),
            changed,
        )
        out.append(sf)
        # Remove any legacy absolute-path or OS-separator duplicate keys before storing rel_key
        merged_manifest.pop(str(p), None)
        merged_manifest.pop(str(rel), None)
        merged_manifest[rel_key] = asdict(sf)

    manifest_path.write_text(json.dumps(list(merged_manifest.values()), indent=2), encoding="utf-8")
    return out


# ── network fetch (I7) ────────────────────────────────────────────────

USER_AGENT = "EMBER-ingest/0.1"  # generic: never personal data
NTRS_BASE = "https://ntrs.nasa.gov"
MAX_BYTES = 200 * 1024 * 1024
MIN_INTERVAL_S = 1.0  # per host
MAX_429_RETRIES = 3
URL_TARGETS = frozenset({"corpus", "iss_pages", "."})
_UNSAFE_NAME = re.compile(r"[^A-Za-z0-9._-]+")
_CD_FILENAME_STAR = re.compile(r"filename\*\s*=\s*[^']*'[^']*'([^;]+)", re.IGNORECASE)
_CD_FILENAME = re.compile(r'filename\s*=\s*"?([^";]+)"?', re.IGNORECASE)

Sleep = Callable[[float], Awaitable[None]]


class FetchError(Exception):
    """A download that could not be completed (too large, robots-disallowed, HTTP error...)."""


def downloads_state_path() -> Path:
    """``<CACHE_DIR>/downloads.json``: url -> {path, etag, last_modified}."""
    return default_cache_dir() / "downloads.json"


def _load_state(path: Path) -> dict[str, dict[str, Any]]:
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return {}
    return data if isinstance(data, dict) else {}


def _save_state(path: Path, state: dict[str, dict[str, Any]]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_name(path.name + ".tmp")
    tmp.write_text(json.dumps(state, indent=2, sort_keys=True), encoding="utf-8")
    os.replace(tmp, path)


# Small sync filesystem helpers: this is an offline CLI, so tiny blocking calls are fine, but keep them out
# of the async bodies (ruff ASYNC240).
def _exists(path: str) -> bool:
    return bool(path) and Path(path).exists()


def _mkdir(path: Path) -> None:
    path.mkdir(parents=True, exist_ok=True)


def _read_yaml(path: Path) -> Any:
    return yaml.safe_load(path.read_text(encoding="utf-8")) or {}


def sanitize_filename(name: str, default: str = "download") -> str:
    """Basename only (no directories / traversal), safe characters, lowercase extension."""
    base = PurePosixPath(unquote(name).replace("\\", "/")).name
    base = _UNSAFE_NAME.sub("_", base).strip("._")
    if not base:
        return default
    stem, dot, ext = base.rpartition(".")
    return f"{stem}.{ext.lower()}" if dot and stem else base


def filename_from_response(resp: httpx.Response, url: str) -> str:
    cd = resp.headers.get("content-disposition", "")
    m = _CD_FILENAME_STAR.search(cd) or _CD_FILENAME.search(cd)
    raw = m.group(1).strip() if m else PurePosixPath(urlsplit(url).path).name
    return sanitize_filename(raw)


class HostPolicy:
    """Per-host politeness: <= 1 request / MIN_INTERVAL_S, robots.txt checked once per host."""

    def __init__(
        self,
        client: httpx.AsyncClient,
        *,
        sleep: Sleep = asyncio.sleep,
        clock: Callable[[], float] = time.monotonic,
        min_interval_s: float = MIN_INTERVAL_S,
    ) -> None:
        self.client = client
        self._sleep = sleep
        self._clock = clock
        self._min_interval = min_interval_s
        self._last: dict[str, float] = {}
        self._robots: dict[str, urllib.robotparser.RobotFileParser] = {}
        self._locks: dict[str, asyncio.Lock] = {}

    async def wait(self, host: str) -> None:
        lock = self._locks.setdefault(host, asyncio.Lock())
        async with lock:
            last = self._last.get(host)
            if last is not None:
                delay = self._min_interval - (self._clock() - last)
                if delay > 0:
                    await self._sleep(delay)
            self._last[host] = self._clock()

    async def request(self, method: str, url: str, **kw: Any) -> httpx.Response:
        """Rate-limited request that honours 429 Retry-After (non-streaming)."""
        host = urlsplit(url).netloc
        for attempt in range(MAX_429_RETRIES + 1):
            await self.wait(host)
            resp = await self.client.request(method, url, **kw)
            if resp.status_code != 429 or attempt == MAX_429_RETRIES:
                return resp
            await self._sleep(_retry_after_s(resp))
        raise AssertionError("unreachable")  # pragma: no cover

    async def allowed(self, url: str) -> bool:
        parts = urlsplit(url)
        host = parts.netloc
        if host not in self._robots:
            rp = urllib.robotparser.RobotFileParser()
            robots_url = f"{parts.scheme}://{host}/robots.txt"
            # same semantics as RobotFileParser.read(): 401/403 -> disallow all, other errors -> allow all
            lines: list[str] = []
            try:
                resp = await self.request("GET", robots_url)
                if resp.status_code in (401, 403):
                    lines = ["User-agent: *", "Disallow: /"]
                elif resp.status_code < 400:
                    lines = resp.text.splitlines()
            except httpx.HTTPError:
                pass  # unreachable robots.txt: same as missing
            rp.parse(lines)
            self._robots[host] = rp
        return self._robots[host].can_fetch(USER_AGENT, url)


def _retry_after_s(resp: httpx.Response, default: float = 1.0, cap: float = 120.0) -> float:
    value = resp.headers.get("retry-after", "").strip()
    if not value:
        return default
    try:
        return min(max(float(value), 0.0), cap)
    except ValueError:
        pass
    try:
        when = parsedate_to_datetime(value)
        return min(max((when - datetime.now(UTC)).total_seconds(), 0.0), cap)
    except (TypeError, ValueError):
        return default


async def _download(
    url: str,
    dest_dir: Path,
    *,
    policy: HostPolicy,
    state: dict[str, dict[str, Any]],
    dest_name: str | None = None,
    max_bytes: int = MAX_BYTES,
) -> tuple[Path, bool]:
    """Returns (path, downloaded). ``downloaded`` False means unchanged and skipped."""
    if not await policy.allowed(url):
        raise FetchError(f"disallowed by robots.txt: {url}")

    prev = state.get(url)
    if prev and _exists(prev.get("path", "")) and (prev.get("etag") or prev.get("last_modified")):
        head = await policy.request("HEAD", url)
        if head.status_code < 400:
            etag, modified = head.headers.get("etag"), head.headers.get("last-modified")
            if (etag and etag == prev.get("etag")) or (
                not etag and modified and modified == prev.get("last_modified")
            ):
                return Path(prev["path"]), False

    host = urlsplit(url).netloc
    for attempt in range(MAX_429_RETRIES + 1):
        await policy.wait(host)
        async with policy.client.stream("GET", url) as resp:
            if resp.status_code == 429 and attempt < MAX_429_RETRIES:
                delay = _retry_after_s(resp)
            else:
                if resp.status_code >= 400:
                    raise FetchError(f"HTTP {resp.status_code} for {url}")
                length = resp.headers.get("content-length")
                if length and length.isdigit() and int(length) > max_bytes:
                    raise FetchError(f"{url}: {int(length)} bytes > limit {max_bytes}")
                name = sanitize_filename(dest_name) if dest_name else filename_from_response(resp, url)
                _mkdir(dest_dir)
                dest = dest_dir / name
                part = dest.with_name(dest.name + ".part")
                total = 0
                try:
                    with part.open("wb") as fh:
                        async for chunk in resp.aiter_bytes():
                            total += len(chunk)
                            if total > max_bytes:
                                raise FetchError(f"{url}: download exceeded limit {max_bytes} bytes")
                            fh.write(chunk)
                    os.replace(part, dest)
                finally:
                    part.unlink(missing_ok=True)
                state[url] = {
                    "path": str(dest),
                    "etag": resp.headers.get("etag"),
                    "last_modified": resp.headers.get("last-modified"),
                    "fetched_at": datetime.now(UTC).isoformat(),
                }
                return dest, True
        await policy._sleep(delay)
    raise AssertionError("unreachable")  # pragma: no cover


async def fetch_url(
    url: str,
    dest_dir: Path,
    *,
    client: httpx.AsyncClient,
    max_bytes: int = MAX_BYTES,
    dest_name: str | None = None,
) -> Path:
    """Download one URL into ``dest_dir`` (skipped when the stored ETag / Last-Modified still matches)."""
    state_path = downloads_state_path()
    state = _load_state(state_path)
    path, _ = await _download(
        url, Path(dest_dir), policy=HostPolicy(client), state=state, dest_name=dest_name, max_bytes=max_bytes
    )
    _save_state(state_path, state)
    return path


async def ntrs_pdf_urls(
    citation_id: str, client: httpx.AsyncClient, policy: HostPolicy | None = None
) -> list[str]:
    """Absolute PDF URLs of an NTRS citation (``downloads[].links.pdf``); defensive: odd shapes -> []."""
    policy = policy or HostPolicy(client)
    resp = await policy.request("GET", f"{NTRS_BASE}/api/citations/{citation_id}")
    if resp.status_code >= 400:
        raise FetchError(f"NTRS citation {citation_id}: HTTP {resp.status_code}")
    try:
        data = resp.json()
    except ValueError:
        return []
    downloads = data.get("downloads") if isinstance(data, dict) else None
    urls: list[str] = []
    for d in downloads if isinstance(downloads, list) else []:
        links = d.get("links") if isinstance(d, dict) else None
        pdf = links.get("pdf") if isinstance(links, dict) else None
        if isinstance(pdf, str) and pdf:
            absolute = urljoin(NTRS_BASE + "/", pdf)
            if absolute not in urls:
                urls.append(absolute)
    return urls


@dataclass
class FetchReport:
    paths: list[Path] = field(default_factory=list)
    downloaded: int = 0
    skipped: int = 0  # unchanged (ETag / Last-Modified match)
    failed: int = 0
    errors: list[str] = field(default_factory=list)


def _new_client() -> httpx.AsyncClient:
    return httpx.AsyncClient(headers={"User-Agent": USER_AGENT}, follow_redirects=True, timeout=60.0)


async def fetch_sources(
    sources_yaml: Path,
    source_dir: Path,
    *,
    client: httpx.AsyncClient | None = None,
    sleep: Sleep = asyncio.sleep,
) -> FetchReport:
    """Download every source listed in ``sources_yaml`` into ``source_dir``.

    YAML: ``{ntrs: ["20190001234", ...], urls: [{url: ..., to: corpus|iss_pages|.}, ...]}``.
    NTRS PDFs land in ``<source_dir>/corpus/<citation_id>.pdf`` (doc_id = citation id); a citation with
    several PDFs adds ``<citation_id>_2.pdf`` ... One failing source never stops the others.
    """
    spec = _read_yaml(Path(sources_yaml))
    if not isinstance(spec, dict):
        raise ValueError(f"{sources_yaml}: expected a mapping with 'ntrs' and/or 'urls'")
    source_dir = Path(source_dir)
    own_client = client is None
    http = client or _new_client()
    policy = HostPolicy(http, sleep=sleep)
    state_path = downloads_state_path()
    state = _load_state(state_path)
    report = FetchReport()

    async def one(url: str, dest_dir: Path, dest_name: str | None) -> None:
        try:
            path, downloaded = await _download(url, dest_dir, policy=policy, state=state, dest_name=dest_name)
        except (FetchError, httpx.HTTPError, OSError) as exc:
            report.failed += 1
            report.errors.append(f"{url}: {exc}")
            logger.warning("fetch failed: %s: %s", url, exc)
            return
        report.paths.append(path)
        if downloaded:
            report.downloaded += 1
        else:
            report.skipped += 1

    try:
        for raw_id in spec.get("ntrs") or []:
            cid = sanitize_filename(str(raw_id).strip())
            try:
                pdfs = await ntrs_pdf_urls(cid, http, policy)
            except (FetchError, httpx.HTTPError) as exc:
                report.failed += 1
                report.errors.append(f"ntrs {cid}: {exc}")
                logger.warning("fetch failed: ntrs %s: %s", cid, exc)
                continue
            if not pdfs:
                report.failed += 1
                report.errors.append(f"ntrs {cid}: no PDF downloads")
                logger.warning("NTRS citation %s has no PDF downloads", cid)
            for i, pdf_url in enumerate(pdfs, start=1):
                await one(pdf_url, source_dir / "corpus", f"{cid}.pdf" if i == 1 else f"{cid}_{i}.pdf")

        for entry in spec.get("urls") or []:
            item = {"url": entry} if isinstance(entry, str) else entry
            url = str(item.get("url", "")).strip() if isinstance(item, dict) else ""
            target = str(item.get("to", ".")).strip() if isinstance(item, dict) else "."
            if not url.lower().startswith(("http://", "https://")):
                report.failed += 1
                report.errors.append(f"invalid url entry: {entry!r}")
                continue
            if target not in URL_TARGETS:
                report.failed += 1
                report.errors.append(f"{url}: 'to' must be one of {sorted(URL_TARGETS)}, got {target!r}")
                continue
            await one(url, source_dir if target == "." else source_dir / target, None)
    finally:
        _save_state(state_path, state)
        if own_client:
            await http.aclose()
    return report
