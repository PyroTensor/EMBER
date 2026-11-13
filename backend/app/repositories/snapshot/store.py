"""Snapshot store: the offline copy of everything the API reads (plan.md D3).

Loaded once from ``settings.SNAPSHOT_PATH`` (``data/.cache/store.json``, written by ``make seed``). If that
file is missing, an equivalent snapshot is built in memory from ``settings.SEED_DIR`` with the ingestion
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

    docs = parse.parse_documents(
        sorted((seed_dir / "corpus").glob("*.md")) + sorted((seed_dir / "iss_pages").glob("*.md"))
    )
    rows = normalize.normalize_rows(parse.read_rows(seed_dir / "experiments_proxy.csv"))
    report = validate.validate_rows(rows, write_queue=False)
    telemetry = parse.read_telemetry(seed_dir / "telemetry_proxy.json")
    extractor = llm_extract.get_extractor()
    investigations = [inv for d in docs if (inv := extractor.extract_investigation(d))]
    presets_file = seed_dir / "presets.json"
    presets = (
        [Preset.model_validate(p) for p in parse.read_rows(presets_file)] if presets_file.exists() else []
    )
    chunks = [c for d in docs for c in chunk_embed.chunk_document(d)]  # no embeddings
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
