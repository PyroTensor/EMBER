"""Stage 7 - Load: local snapshot (always) + Postgres/pgvector (when reachable).

(a) ``settings.SNAPSHOT_PATH`` (``data/.cache/store.json``) is ALWAYS written first, with the same shape
    as the legacy ``load_pg.save_local_snapshot`` plus ``documents`` and ``presets``, so teammates without
    Docker (and the snapshot repositories) see exactly the ingested records and embeddings.
(b) If Postgres is reachable (``DbAvailability``; ``DATA_BACKEND=snapshot`` skips it), everything is upserted
    in ONE transaction: investigations, documents, test_runs, telemetry, presets, chunks (replaced
    per doc_id).
    Idempotent: re-running upserts rows and replaces chunks per document.
"""

from __future__ import annotations

import json
import logging
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

from app.core.config import get_settings
from app.db.engine import Database
from app.repositories.chunk_repo import PgChunkRepository
from app.repositories.document_repo import PgDocumentRepository
from app.repositories.investigation_repo import PgInvestigationRepository
from app.repositories.preset_repo import PgPresetRepository
from app.repositories.telemetry_repo import PgTelemetryRepository
from app.repositories.test_run_repo import PgTestRunRepository
from app.schemas.experiment import TestRunRecord
from app.schemas.ingestion import Chunk, Document, Investigation
from app.schemas.preset import Preset

logger = logging.getLogger(__name__)


@dataclass
class LoadResult:
    snapshot_path: Path
    db_loaded: bool = False
    db_skipped_reason: str | None = None
    counts: dict[str, int] = field(default_factory=dict)


def _jsonable(value: Any) -> Any:
    """Round-trip through JSON so YAML front-matter values (dates, ...) become JSONB-safe."""
    return json.loads(json.dumps(value, default=str))


def deduplicate_investigations(
    investigations: list[Investigation], runs: list[TestRunRecord] | None = None
) -> list[Investigation]:
    """Deduplicate investigations by ``id`` (keeping the richest summary) and auto-seed stubs for runs."""
    by_id: dict[str, Investigation] = {}
    for inv in investigations:
        prev = by_id.get(inv.id)
        if prev is None or len(inv.summary) > len(prev.summary):
            by_id[inv.id] = inv
    for r in runs or []:
        prog_id = str(r.program)
        if prog_id not in by_id:
            by_id[prog_id] = Investigation(id=prog_id, program=r.program, title=prog_id, summary="")
    return list(by_id.values())


def build_payload(
    investigations: list[Investigation],
    documents: list[Document],
    checksums: dict[str, str],
    runs: list[TestRunRecord],
    flags: dict[str, list[str]],
    telemetry: dict[str, dict[str, Any]],
    presets: list[Preset],
    chunks: list[Chunk],
) -> dict[str, Any]:
    """The snapshot document; its rows use DB column names so Postgres loads reuse them."""
    deduped_inv = deduplicate_investigations(investigations, runs)
    known_inv = {i.id for i in deduped_inv}
    run_dicts = []
    for r in runs:
        d = r.model_dump(mode="json")
        d["investigation_id"] = str(r.program) if str(r.program) in known_inv else None
        d["review_flags"] = flags.get(r.experiment_id, [])
        run_dicts.append(d)
    run_ids = {r.experiment_id for r in runs}

    return {
        "investigations": [i.model_dump(mode="json") for i in deduped_inv],
        "documents": [
            {
                "doc_id": doc.doc_id,
                "title": doc.title,
                "source_type": doc.source_type,
                "url": doc.metadata.get("url"),
                "page_count": len(doc.pages),
                "checksum": checksums.get(doc.path),
            }
            for doc in documents
        ],
        "test_runs": run_dicts,
        "telemetry": {k: v for k, v in telemetry.items() if k in run_ids},
        "chunks": [
            {
                "id": idx + 1,
                "doc_id": c.doc_id,
                "page": c.page,
                "section": c.section,
                "text": c.text,
                "metadata": _jsonable(c.metadata),
                "embedding": c.embedding,
            }
            for idx, c in enumerate(chunks)
        ],
        "presets": [{**p.model_dump(mode="json"), "sort_order": i} for i, p in enumerate(presets)],
    }


def save_snapshot(payload: dict[str, Any], path: Path | None = None) -> Path:
    path = path or get_settings().SNAPSHOT_PATH
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload), encoding="utf-8")
    return path


async def load_postgres(payload: dict[str, Any], *, load_chunks: bool = True) -> dict[str, int] | str:
    """Upsert the payload in one transaction. Returns per-table counts, or the reason it was skipped."""
    db = Database(get_settings())
    try:
        if not await db.availability.is_up():
            return f"Postgres not used (DATA_BACKEND={db.availability.mode} or unreachable)"
        counts: dict[str, int] = {}
        async with db.rw_sessionmaker() as session, session.begin():
            counts["investigations"] = await PgInvestigationRepository(session).upsert_many(
                payload["investigations"]
            )
            counts["documents"] = await PgDocumentRepository(session).upsert_many(payload["documents"])
            counts["test_runs"] = await PgTestRunRepository(session).upsert_many(payload["test_runs"])
            counts["telemetry"] = await PgTelemetryRepository(session).upsert_many(
                [{"experiment_id": k, "series": v} for k, v in payload["telemetry"].items()]
            )
            # strip sort_order: the preset repo assigns it from list position
            counts["presets"] = await PgPresetRepository(session).upsert_many(
                [{k: v for k, v in p.items() if k != "sort_order"} for p in payload["presets"]]
            )
            counts["chunks"] = 0
            if load_chunks:
                chunk_repo = PgChunkRepository(session)
                by_doc: dict[str, list[dict[str, Any]]] = {
                    doc["doc_id"]: [] for doc in payload["documents"]
                }
                for c in payload["chunks"]:
                    by_doc.setdefault(c["doc_id"], []).append({k: v for k, v in c.items() if k != "id"})
                for doc_id, rows in by_doc.items():
                    counts["chunks"] += await chunk_repo.replace_for_doc(doc_id, rows)
        return counts
    finally:
        await db.dispose()


async def load(
    investigations: list[Investigation],
    documents: list[Document],
    checksums: dict[str, str],
    runs: list[TestRunRecord],
    flags: dict[str, list[str]],
    telemetry: dict[str, dict[str, Any]],
    presets: list[Preset],
    chunks: list[Chunk],
    *,
    load_chunks: bool = True,
) -> LoadResult:
    payload = build_payload(investigations, documents, checksums, runs, flags, telemetry, presets, chunks)
    result = LoadResult(snapshot_path=save_snapshot(payload))
    outcome = await load_postgres(payload, load_chunks=load_chunks)
    if isinstance(outcome, str):
        result.db_skipped_reason = outcome
    else:
        result.db_loaded, result.counts = True, outcome
    return result


__all__ = [
    "LoadResult",
    "build_payload",
    "deduplicate_investigations",
    "load",
    "load_postgres",
    "save_snapshot",
]
