"""Snapshot store: the offline copy of everything the API reads (plan.md D3).

Loaded once from ``settings.SNAPSHOT_PATH`` (``data/.cache/store.json``, written by every non-dry ingestion
run). If that file is missing, an equivalent snapshot is built in memory from ``settings.SEED_DIR`` (default
``data/seed``, an empty drop folder; it may be empty, then the snapshot is empty) with the ingestion
stages (parse → normalize → validate → extract → chunk), without embeddings and without any DB writes, so
the API still works before the first ingest.
"""

from __future__ import annotations

import json
import logging
from dataclasses import dataclass
from functools import cached_property, lru_cache
from pathlib import Path
from typing import Any

from app.core.config import get_settings
from app.repositories.snapshot.bm25 import BM25

logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class SnapshotStore:
    """Read-only view over the snapshot document (callers must copy rows before mutating them)."""

    data: dict[str, Any]
    source: str  # "file" | "seed"

    @property
    def test_runs(self) -> list[dict[str, Any]]:
        runs: list[dict[str, Any]] = self.data.get("test_runs", [])
        return runs

    @property
    def telemetry(self) -> dict[str, dict[str, Any]]:
        series: dict[str, dict[str, Any]] = self.data.get("telemetry", {})
        return series

    @property
    def chunks(self) -> list[dict[str, Any]]:
        chunks: list[dict[str, Any]] = self.data.get("chunks", [])
        return chunks

    @property
    def presets(self) -> list[dict[str, Any]]:
        presets: list[dict[str, Any]] = self.data.get("presets", [])
        return presets

    @property
    def documents(self) -> list[dict[str, Any]]:
        docs: list[dict[str, Any]] = self.data.get("documents", [])
        return docs

    @property
    def combustion_findings(self) -> list[dict[str, Any]]:
        """I10 table; snapshots written before it have no such key (-> [])."""
        findings: list[dict[str, Any]] = self.data.get("combustion_findings", [])
        return findings

    @cached_property
    def bm25(self) -> BM25:
        """BM25 index over chunks (same text fields as legacy: doc_id, section, title, text)."""
        return BM25(
            [
                f"{c.get('doc_id', '')} {c.get('section', '')} {(c.get('metadata') or {}).get('title', '')} "
                f"{c['text']}"
                for c in self.chunks
            ]
        )


def _build_from_seed(seed_dir: Path) -> dict[str, Any]:
    # Imported lazily: only needed when store.json is missing, and keeps the API import graph small.
    from app.ingestion.stages import chunk_embed, llm_extract, normalize, parse, validate
    from app.ingestion.stages.load import build_payload
    from app.schemas.preset import Preset

    # Discover files instead of hard-coding names: SEED_DIR may be empty (the default data/seed is just a drop
    # folder), hold an official drop, or point at tests/fixtures/proxy. Missing pieces are simply empty.
    doc_types = {"corpus": "ntrs", "iss_pages": "iss_page"}
    doc_paths = [
        p
        for folder in doc_types
        for p in sorted((seed_dir / folder).glob("*"))
        if p.suffix.lower() in parse.DOC_SUFFIXES
    ]
    docs, _skipped = parse.parse_documents_with_skipped(
        doc_paths, {str(p): doc_types[p.parent.name] for p in doc_paths}
    )

    def _is_run_file(p: Path) -> bool:
        name = p.name.lower()
        return (
            p.suffix.lower() in (".csv", ".json")
            and name != "presets.json"
            and "telemetry" not in name
            and name != "raw_drop_example.csv"  # the messy drill file is not a dataset
        )

    raw_rows: list[dict[str, Any]] = []
    for run_file in sorted(p for p in seed_dir.glob("*") if p.is_file() and _is_run_file(p)):
        if run_file.suffix.lower() == ".json" and run_file.with_suffix(".csv").exists():
            continue  # same dataset as the CSV twin (e.g. experiments_proxy.csv / .json)
        try:
            raw_rows.extend(parse.read_rows(run_file))
        except ValueError as exc:
            logger.warning("seed fallback: skipping %s (%s)", run_file.name, exc)
    report = validate.validate_rows(normalize.normalize_rows(raw_rows), write_queue=False)

    telemetry: dict[str, dict[str, Any]] = {}
    for tel_file in sorted(seed_dir.glob("*telemetry*.json")):
        telemetry.update(parse.read_telemetry(tel_file))
    # sync heuristic only: the in-memory fallback must stay offline and never call a paid LLM
    investigations = [inv for d in docs if (inv := llm_extract.heuristic_investigation(d))]
    presets_file = seed_dir / "presets.json"
    presets = (
        [Preset.model_validate(p) for p in parse.read_rows(presets_file)] if presets_file.exists() else []
    )
    chunks = [c for d in docs for c in chunk_embed.chunk_document(d)]  # no embeddings
    if not docs and not report.valid:
        logger.warning(
            "seed fallback: %s holds no documents or runs; the API starts with an empty snapshot "
            "(ingest a data drop with `python -m app.ingestion --source <dir>`)",
            seed_dir,
        )
    return build_payload(investigations, docs, {}, report.valid, report.flags, telemetry, presets, chunks)


@lru_cache(maxsize=1)
def get_snapshot_store() -> SnapshotStore:
    """The process-wide snapshot (``get_snapshot_store.cache_clear()`` reloads it)."""
    settings = get_settings()
    path = settings.SNAPSHOT_PATH
    if path.exists():
        store = SnapshotStore(json.loads(path.read_text(encoding="utf-8")), source="file")
    else:
        logger.warning(
            "snapshot %s not found; building it in memory from %s (no embeddings)", path, settings.SEED_DIR
        )
        store = SnapshotStore(_build_from_seed(settings.SEED_DIR), source="seed")
    logger.info(
        "snapshot loaded from %s: %d runs, %d chunks", store.source, len(store.test_runs), len(store.chunks)
    )
    return store


__all__ = ["SnapshotStore", "get_snapshot_store"]
