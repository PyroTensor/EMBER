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

from app.core.config import get_settings

SUPPORTED = {".csv", ".json", ".md", ".pdf", ".txt"}


def default_cache_dir() -> Path:
    """Ingestion cache directory (``settings.CACHE_DIR``, default ``backend/data/.cache``)."""
    return get_settings().CACHE_DIR


@dataclass
class SourceFile:
    path: str  # path inside the cache
    original: str  # where it came from
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
    if "corpus" in parts or p.suffix == ".pdf":
        return "ntrs"
    if "iss_pages" in parts:
        return "iss_page"
    if "telemetry" in p.name:
        return "telemetry"
    if p.suffix in {".csv", ".json"}:
        return "psi_dataset"
    return "other"


def fetch(source_dir: Path, cache_dir: Path | None = None) -> list[SourceFile]:
    cache_dir = cache_dir or default_cache_dir()
    source_dir = Path(source_dir).resolve()
    raw = cache_dir / "raw"
    raw.mkdir(parents=True, exist_ok=True)
    manifest_path = cache_dir / "manifest.json"
    old = {}
    if manifest_path.exists():
        old = {e["original"]: e["sha256"] for e in json.loads(manifest_path.read_text(encoding="utf-8"))}

    out: list[SourceFile] = []
    for p in sorted(source_dir.rglob("*")):
        if not p.is_file() or p.suffix.lower() not in SUPPORTED:
            continue
        rel = p.relative_to(source_dir)
        dest = raw / rel
        dest.parent.mkdir(parents=True, exist_ok=True)
        digest = _sha256(p)
        changed = old.get(str(p)) != digest
        if changed or not dest.exists():
            shutil.copy2(p, dest)
        out.append(
            SourceFile(
                str(dest),
                str(p),
                digest,
                p.stat().st_size,
                _source_type(rel),
                datetime.now(UTC).isoformat(),
                changed,
            )
        )

    manifest_path.write_text(json.dumps([asdict(s) for s in out], indent=2), encoding="utf-8")
    return out
