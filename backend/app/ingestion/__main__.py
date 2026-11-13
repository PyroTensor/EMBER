"""Offline ingestion CLI (same flags as the legacy pipeline).

Usage (from backend/):
    uv run python -m app.ingestion --source data/seed                       # make seed
    uv run python -m app.ingestion --source data/seed \
        --runs-file raw_drop_example.csv --dry-run                          # make ingest-drill (no DB writes)
    uv run python -m app.ingestion --source /path/to/nov14_drop \
        --runs-file official.csv --column-map my_map.yaml                   # the real thing
"""

from __future__ import annotations

import argparse
import asyncio
import sys
from pathlib import Path

from app.core.config import get_settings
from app.core.logging import setup_logging
from app.ingestion.pipeline import run


def main(argv: list[str] | None = None) -> int:
    settings = get_settings()
    setup_logging(settings.LOG_LEVEL, settings.LOG_JSON)
    ap = argparse.ArgumentParser(
        prog="python -m app.ingestion",
        description=__doc__,
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    ap.add_argument("--source", type=Path, default=settings.SEED_DIR)
    ap.add_argument("--runs-file", default="experiments_proxy.csv", help="file name inside --source")
    ap.add_argument("--telemetry-file", default="telemetry_proxy.json")
    ap.add_argument("--column-map", type=Path, default=None)
    ap.add_argument("--extractor", default=None, choices=["heuristic", "gemini"], help="heuristic | gemini")
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument("--skip-embed", action="store_true")
    a = ap.parse_args(argv)
    return asyncio.run(
        run(a.source, a.runs_file, a.telemetry_file, a.column_map, a.dry_run, a.skip_embed, a.extractor)
    )


if __name__ == "__main__":
    sys.exit(main())
