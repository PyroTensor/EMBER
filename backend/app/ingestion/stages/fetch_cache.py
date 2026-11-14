"""Stage 1 - Fetch & cache: raw files + checksums + manifest of sources.

Copies every source file into <CACHE_DIR>/raw/ and records a sha256 per file in
<CACHE_DIR>/manifest.json, so re-runs can tell which sources changed.

TODO(squad1-A): fetch_url() for NTRS API / PDF downloads (respect robots + rate limits).
"""

from __future__ import annotations

import hashlib
import json
import shutil
from dataclasses import asdict, dataclass
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

from app.core.config import get_settings

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
        prev_sha = (
            old_hashes.get(rel_key)
            or old_hashes.get(str(rel))
            or old_hashes.get(str(p))
        )
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
