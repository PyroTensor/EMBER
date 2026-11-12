"""Offline ingestion pipeline (diagram section 1). Re-run whenever data changes.

    fetch & cache -> parse -> normalize -> LLM extraction -> validate -> chunk & embed -> snapshot + Postgres

Ported from legacy ``ember_data/ingestion/pipeline.py`` (same stages and stage logs); the CLI is in
``__main__.py``.
"""

from __future__ import annotations

import time
from pathlib import Path
from typing import Any

from pydantic import ValidationError

from app.core.config import BASE_DIR
from app.embeddings.factory import get_embedder
from app.embeddings.null import NullEmbedder
from app.ingestion.stages import chunk_embed, fetch_cache, llm_extract, load, normalize, parse, validate
from app.schemas.preset import Preset

PRESETS_FILE = "presets.json"


def log(stage: str, msg: str) -> None:
    print(f"[{stage:<10}] {msg}", flush=True)


def _rel(p: Path) -> str:
    try:
        return str(Path(p).resolve().relative_to(BASE_DIR))
    except ValueError:
        return str(p)


def _read_presets(path: Path) -> list[Preset]:
    rows: list[dict[str, Any]] = parse.read_rows(path)
    presets = []
    for row in rows:
        try:
            presets.append(Preset.model_validate(row))
        except ValidationError as exc:
            log("parse", f"  preset {row.get('id', '?')} rejected: {exc.errors()[:2]}")
    return presets


async def run(
    source: Path,
    runs_file: str,
    telemetry_file: str,
    column_map: Path | None,
    dry_run: bool,
    skip_embed: bool,
    extractor: str | None,
) -> int:
    t0 = time.time()

    # 1. fetch & cache
    files = fetch_cache.fetch(source)
    changed = sum(f.changed for f in files)
    manifest = fetch_cache.default_cache_dir() / "manifest.json"
    log("fetch", f"{len(files)} files cached ({changed} new/changed) -> {_rel(manifest)}")
    cached = {Path(f.original).name: Path(f.path) for f in files}
    checksums = {f.path: f.sha256 for f in files}

    # 2. parse
    doc_paths = [Path(f.path) for f in files if f.source_type in ("ntrs", "iss_page")]
    docs = parse.parse_documents(doc_paths)
    if runs_file not in cached:
        log("parse", f"ERROR runs file '{runs_file}' not found in {source}")
        return 1
    raw_rows = parse.read_rows(cached[runs_file])
    telemetry = parse.read_telemetry(cached[telemetry_file]) if telemetry_file in cached else {}
    presets = _read_presets(cached[PRESETS_FILE]) if PRESETS_FILE in cached else []
    log(
        "parse",
        f"{len(docs)} documents ({sum(len(d.pages) for d in docs)} pages), "
        f"{len(raw_rows)} raw run rows, {len(telemetry)} telemetry series, {len(presets)} presets",
    )

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
    log(
        "extract",
        f"{type(ext).__name__}: {len(investigations)} investigations, "
        f"{len(extracted_runs)} runs from documents",
    )

    # 5. validate
    report = validate.validate_rows(rows, write_queue=True)
    log("validate", f"{report.summary()} -> {_rel(validate.review_queue_path())}")
    for rej in report.rejected[:5]:
        log("validate", f"  rejected {rej['row'].get('experiment_id')}: {rej['errors'][:3]}")

    # 6. chunk & embed
    chunks = [c for d in docs for c in chunk_embed.chunk_document(d)]
    if skip_embed:
        note = " (embeddings skipped)"
    else:
        await chunk_embed.embed_chunks(chunks)
        embedder = get_embedder()
        note = (
            " (null embedder: no vectors)"
            if isinstance(embedder, NullEmbedder)
            else f" embedded ({embedder.name})"
        )
    log("chunk", f"{len(chunks)} section-aware chunks{note}")

    if dry_run:
        log("load", "dry run - nothing written to Postgres")
        log("done", f"{time.time() - t0:.1f}s")
        return 0 if report.valid else 1

    # 7. load
    try:
        result = await load.load(
            investigations,
            docs,
            checksums,
            report.valid,
            report.flags,
            telemetry,
            presets,
            chunks,
            load_chunks=not skip_embed,
        )
    except Exception as exc:
        log("load", f"ERROR loading Postgres ({exc.__class__.__name__}: {exc}) - transaction rolled back")
        return 1
    log("load", f"local snapshot saved -> {_rel(result.snapshot_path)}")
    if result.db_loaded:
        c = result.counts
        log(
            "load",
            f"Postgres: {c['investigations']} investigations, {c['documents']} documents, "
            f"{c['test_runs']} test_runs, "
            f"{c['telemetry']} telemetry, {c['presets']} presets, {c['chunks']} chunks",
        )
    else:
        log("load", f"{result.db_skipped_reason} - using local snapshot until `make db-up` is run")
    log("done", f"{time.time() - t0:.1f}s")
    return 0


__all__ = ["run"]
