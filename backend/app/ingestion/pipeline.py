"""Offline ingestion pipeline (diagram section 1). Re-run whenever data changes.

    fetch & cache -> parse -> normalize -> LLM extraction -> validate -> chunk & embed -> snapshot + Postgres

Ported from legacy ``ember_data/ingestion/pipeline.py`` (same stages and stage logs); the CLI is in
``__main__.py``.
"""

from __future__ import annotations

import fnmatch
import time
from pathlib import Path
from typing import Any

from pydantic import ValidationError

from app.core.config import BASE_DIR
from app.embeddings.factory import get_embedder
from app.embeddings.null import NullEmbedder
from app.ingestion.stages import chunk_embed, fetch_cache, llm_extract, load, normalize, parse, validate
from app.schemas.ingestion import Document, Investigation
from app.schemas.preset import Preset

PRESETS_FILE = "presets.json"
DEFAULT_RUNS_FILE = "experiments_proxy.csv"


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


def _build_cached_lookup(files: list[fetch_cache.SourceFile]) -> dict[str, Path]:
    """Index cached files by relative path and basename, logging a warning on basename collisions."""
    cached: dict[str, Path] = {}
    seen_basenames: dict[str, str] = {}
    for f in files:
        rel_key = Path(f.original).as_posix()
        name = Path(f.original).name
        p = Path(f.path)
        cached[rel_key] = p
        if name in seen_basenames and seen_basenames[name] != rel_key:
            log(
                "fetch",
                f"WARNING duplicate filename '{name}' in '{seen_basenames[name]}' and '{rel_key}'; "
                "use relative path in --runs-file to disambiguate",
            )
        seen_basenames[name] = rel_key
        cached[name] = p
    return cached


def _resolve_run_files(
    runs_file: str,
    files: list[fetch_cache.SourceFile],
    cached: dict[str, Path],
    telemetry_file: str,
) -> list[Path]:
    """Resolve one, comma-separated, glob, or multi-CSV NASA drop ``psi_dataset`` run files."""
    specs = [s.strip() for s in runs_file.split(",") if s.strip()]
    matched: list[Path] = []
    seen: set[Path] = set()

    def _add(p: Path) -> None:
        if p not in seen:
            seen.add(p)
            matched.append(p)

    excluded_names = {PRESETS_FILE.lower(), telemetry_file.lower(), "raw_drop_example.csv"}
    for spec in specs:
        norm_spec = spec.replace("\\", "/")
        if norm_spec in ("*", "all"):
            for f in files:
                name = Path(f.original).name.lower()
                if f.source_type == "psi_dataset" and name not in excluded_names:
                    _add(Path(f.path))
        elif any(ch in norm_spec for ch in ("*", "?", "[")):
            for f in files:
                rel_posix = Path(f.original).as_posix()
                name = Path(f.original).name
                if fnmatch.fnmatch(rel_posix, norm_spec) or fnmatch.fnmatch(name, norm_spec):
                    _add(Path(f.path))
        elif norm_spec in cached:
            _add(cached[norm_spec])
        elif spec in cached:
            _add(cached[spec])

    # Fallback: if default runs_file was not found in a custom drop folder, load all psi_dataset CSVs
    if not matched and runs_file == DEFAULT_RUNS_FILE:
        for f in files:
            name = Path(f.original).name.lower()
            if (
                f.source_type == "psi_dataset"
                and Path(f.path).suffix.lower() == ".csv"
                and name not in excluded_names
            ):
                _add(Path(f.path))
    return matched


def _extract_deduped_investigations(docs: list[Document], ext: llm_extract.Extractor) -> list[Investigation]:
    """Extract investigations from docs (iss_page prioritized before ntrs) and deduplicate by id."""
    ordered_docs = sorted(docs, key=lambda d: 0 if d.source_type == "iss_page" else 1)
    by_id: dict[str, tuple[str, Investigation]] = {}
    for d in ordered_docs:
        inv = ext.extract_investigation(d)
        if inv is None:
            continue
        prev = by_id.get(inv.id)
        if prev is None:
            by_id[inv.id] = (d.source_type, inv)
        else:
            prev_type, prev_inv = prev
            # Keep iss_page canonical record over ntrs; within same source_type keep richest summary
            if prev_type == d.source_type and len(inv.summary) > len(prev_inv.summary):
                by_id[inv.id] = (d.source_type, inv)
    return [pair[1] for pair in by_id.values()]


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
    cached = _build_cached_lookup(files)
    checksums = {f.path: f.sha256 for f in files}

    # 2. parse
    doc_paths = [Path(f.path) for f in files if f.source_type in ("ntrs", "iss_page")]
    docs = parse.parse_documents(doc_paths)
    run_paths = _resolve_run_files(runs_file, files, cached, telemetry_file)
    if not run_paths:
        log("parse", f"ERROR runs file '{runs_file}' not found in {source}")
        return 1
    raw_rows: list[dict[str, Any]] = []
    for rp in run_paths:
        raw_rows.extend(parse.read_rows(rp))
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
    investigations = _extract_deduped_investigations(docs, ext)
    extracted_runs = [r for d in docs for r in ext.extract_test_runs(d)]
    rows += normalize.normalize_rows(extracted_runs, cmap) if extracted_runs else []
    log(
        "extract",
        f"{type(ext).__name__}: {len(investigations)} investigations, "
        f"{len(extracted_runs)} runs from documents",
    )

    # 5. validate
    report = validate.validate_rows(rows, write_queue=not dry_run)
    investigations = load.deduplicate_investigations(investigations, report.valid)
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
