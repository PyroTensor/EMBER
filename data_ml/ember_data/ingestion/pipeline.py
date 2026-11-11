"""Offline ingestion pipeline (diagram section 1). Re-run whenever data changes.

    fetch & cache -> parse -> normalize -> LLM extraction -> validate -> chunk & embed -> Postgres+pgvector

Usage:
    uv run python -m ember_data.ingestion.pipeline --source contracts/mock_data
    uv run python -m ember_data.ingestion.pipeline --source contracts/mock_data \
        --runs-file raw_drop_example.csv --dry-run          # Nov 14 rehearsal, no DB writes
    uv run python -m ember_data.ingestion.pipeline --source /path/to/nov14_drop \
        --runs-file official.csv --column-map my_map.yaml   # the real thing
"""
from __future__ import annotations

import argparse
import sys
import time
from pathlib import Path

from dotenv import load_dotenv

from ember_data import REPO_ROOT
from ember_data.ingestion import chunk_embed, fetch_cache, llm_extract, normalize, parse, validate


def log(stage: str, msg: str) -> None:
    print(f"[{stage:<10}] {msg}", flush=True)


def run(source: Path, runs_file: str, telemetry_file: str, column_map: Path | None,
        dry_run: bool, skip_embed: bool, extractor: str | None) -> int:
    t0 = time.time()

    # 1. fetch & cache
    files = fetch_cache.fetch(source)
    changed = sum(f.changed for f in files)
    log("fetch", f"{len(files)} files cached ({changed} new/changed) -> {fetch_cache.CACHE_DIR / 'manifest.json'}")
    cached = {Path(f.original).name: Path(f.path) for f in files}

    # 2. parse
    doc_paths = [Path(f.path) for f in files if f.source_type in ("ntrs", "iss_page")]
    docs = parse.parse_documents(doc_paths)
    if runs_file not in cached:
        log("parse", f"ERROR runs file '{runs_file}' not found in {source}")
        return 1
    raw_rows = parse.read_rows(cached[runs_file])
    telemetry = parse.read_telemetry(cached[telemetry_file]) if telemetry_file in cached else {}
    log("parse", f"{len(docs)} documents ({sum(len(d.pages) for d in docs)} pages), "
                 f"{len(raw_rows)} raw run rows, {len(telemetry)} telemetry series")

    # 3. normalize
    cmap = normalize.load_column_map(column_map)
    rows = normalize.normalize_rows(raw_rows, cmap)
    extra_keys = sorted({k for r in rows for k in r.get("extra_telemetry", {})})
    log("normalize", f"{len(rows)} rows mapped to schema_v1; extra_telemetry keys: {extra_keys}")

    # 4. LLM extraction
    ext = llm_extract.get_extractor(extractor)
    investigations = [inv for d in docs if (inv := ext.extract_investigation(d))]
    extracted_runs = [r for d in docs for r in ext.extract_test_runs(d)]
    rows += normalize.normalize_rows(extracted_runs, cmap) if extracted_runs else []
    log("extract", f"{type(ext).__name__}: {len(investigations)} investigations, {len(extracted_runs)} runs from documents")

    # 5. validate
    report = validate.validate_rows(rows, write_queue=True)
    log("validate", f"{report.summary()} -> {validate.REVIEW_QUEUE.relative_to(REPO_ROOT)}")
    for rej in report.rejected[:5]:
        log("validate", f"  rejected {rej['row'].get('experiment_id')}: {rej['errors'][:3]}")

    # 6. chunk & embed
    chunks = [c for d in docs for c in chunk_embed.chunk_document(d)]
    if not skip_embed:
        chunk_embed.embed_chunks(chunks)
    log("chunk", f"{len(chunks)} section-aware chunks{' (embeddings skipped)' if skip_embed else ' embedded'}")

    if dry_run:
        log("load", "dry run - nothing written to Postgres")
        log("done", f"{time.time() - t0:.1f}s")
        return 0 if report.valid else 1

    # 7. load
    from ember_data.ingestion import load_pg  # import late so dry runs don't need a DB driver

    snap = load_pg.save_local_snapshot(investigations, report.valid, report.flags, telemetry, chunks)
    log("load", f"local snapshot saved -> {snap.relative_to(REPO_ROOT)}")

    try:
        with load_pg.connect() as conn:
            n_inv = load_pg.load_investigations(conn, investigations)
            n_runs = load_pg.load_test_runs(conn, report.valid, report.flags, {i.id for i in investigations})
            n_tel = load_pg.load_telemetry(conn, telemetry, {r.experiment_id for r in report.valid})
            n_chunks = load_pg.load_chunks(conn, chunks) if not skip_embed else 0
            conn.commit()
        log("load", f"Postgres: {n_inv} investigations, {n_runs} test_runs, {n_tel} telemetry, {n_chunks} chunks")
    except Exception as exc:
        log("load", f"Postgres not reachable ({exc.__class__.__name__}) - using local snapshot until `make db-up` is run")
    log("done", f"{time.time() - t0:.1f}s")
    return 0


def main(argv: list[str] | None = None) -> int:
    load_dotenv(REPO_ROOT / ".env")
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--source", type=Path, default=REPO_ROOT / "contracts" / "mock_data")
    ap.add_argument("--runs-file", default="experiments_proxy.csv", help="file name inside --source")
    ap.add_argument("--telemetry-file", default="telemetry_proxy.json")
    ap.add_argument("--column-map", type=Path, default=None)
    ap.add_argument("--extractor", default=None, help="heuristic | gemini")
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument("--skip-embed", action="store_true")
    a = ap.parse_args(argv)
    return run(a.source, a.runs_file, a.telemetry_file, a.column_map, a.dry_run, a.skip_embed, a.extractor)


if __name__ == "__main__":
    sys.exit(main())
