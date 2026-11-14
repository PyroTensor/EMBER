"""Offline ingestion CLI (same flags as the legacy pipeline).

Usage (from backend/):
    uv run python -m app.ingestion --source data/seed                       # make seed (empty drop folder)
    uv run python -m app.ingestion --source tests/fixtures/proxy            # make seed-proxy (synthetic demo)
    uv run python -m app.ingestion --source tests/fixtures/proxy \
        --runs-file raw_drop_example.csv --dry-run                          # make ingest-drill (no DB writes)
    uv run python -m app.ingestion --source /path/to/nov14_drop \
        --runs-file official.csv --column-map my_map.yaml                   # the real thing
    uv run python -m app.ingestion --source data/drill \
        --fetch data/sources.example.yaml --dry-run --skip-embed            # download NTRS PDFs first
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
    ap.add_argument(
        "--runs-file",
        default="experiments_proxy.csv",
        help="runs file inside --source (name, path, comma list, glob or 'all'); if the default name is "
        "missing, every run CSV in --source is used",
    )
    ap.add_argument("--telemetry-file", default="telemetry_proxy.json")
    ap.add_argument("--column-map", type=Path, default=None)
    ap.add_argument(
        "--extractor",
        default=None,
        choices=["heuristic", "llm", "gemini", "openai"],
        help="heuristic | llm (gemini/openai are legacy aliases for llm); default: EXTRACTOR setting",
    )
    ap.add_argument(
        "--llm-max-pages",
        type=int,
        default=None,
        metavar="INT",
        help="LLM page budget for this run (overrides EXTRACT_MAX_PAGES)",
    )
    ap.add_argument("--no-llm-cache", action="store_true", help="ignore cached LLM extractions")
    ap.add_argument(
        "--no-findings",
        action="store_true",
        help="do not build combustion_findings (overrides EXTRACT_FINDINGS)",
    )
    ap.add_argument(
        "--fetch",
        type=Path,
        default=None,
        metavar="SOURCES_YAML",
        help="download NTRS PDFs / URLs listed in this YAML into --source before stage 1",
    )
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument("--skip-embed", action="store_true")
    a = ap.parse_args(argv)
    return asyncio.run(
        run(
            a.source,
            a.runs_file,
            a.telemetry_file,
            a.column_map,
            a.dry_run,
            a.skip_embed,
            a.extractor,
            llm_max_pages=a.llm_max_pages,
            no_llm_cache=a.no_llm_cache,
            fetch=a.fetch,
            no_findings=a.no_findings,
        )
    )


if __name__ == "__main__":
    sys.exit(main())
