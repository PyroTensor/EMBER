"""Snapshot implementations of every Protocol in ``repositories/interfaces.py``.

Same row shapes as the Postgres repositories: test runs like ``TestRunRecord`` (no ``investigation_id`` /
``review_flags``), presets like ``Preset``, chunk hits with ``id, doc_id, page, section, text, metadata,
score``. Hybrid search ports the legacy fallback: BM25 top-k + cosine top-k (only when the snapshot has
embeddings) fused with Reciprocal Rank Fusion ``1 / (rrf_k + rank)``.
"""

from __future__ import annotations

import builtins
from typing import Any

from app.core.constants import HYBRID_CANDIDATES, RRF_K
from app.repositories.snapshot.store import SnapshotStore
from app.schemas.experiment import ExperimentFilters

_INTERNAL_RUN_KEYS = frozenset({"investigation_id", "review_flags"})
GRAVITY_TOLERANCE = 0.01


def _record(run: dict[str, Any]) -> dict[str, Any]:
    return {k: v for k, v in run.items() if k not in _INTERNAL_RUN_KEYS}


def _contains(doc: Any, sub: Any) -> bool:
    """JSONB-style containment (``doc @> sub``) for plain JSON values."""
    if isinstance(sub, dict):
        return isinstance(doc, dict) and all(k in doc and _contains(doc[k], v) for k, v in sub.items())
    if isinstance(doc, list):
        subs = sub if isinstance(sub, list) else [sub]
        return all(any(_contains(d, s) for d in doc) for s in subs)
    return bool(doc == sub)


class SnapshotStats:
    def __init__(self, store: SnapshotStore) -> None:
        self.store = store

    async def count_runs(self) -> int:
        return len(self.store.test_runs)

    async def count_chunks(self) -> int:
        return len(self.store.chunks)

    async def extra_telemetry_keys(self) -> list[str]:
        return sorted({k for r in self.store.test_runs for k in (r.get("extra_telemetry") or {})})


class SnapshotPresetRepo:
    def __init__(self, store: SnapshotStore) -> None:
        self.store = store

    async def list_ordered(self) -> list[dict[str, Any]]:
        presets = sorted(self.store.presets, key=lambda p: (p.get("sort_order", 0), p["id"]))
        return [{k: v for k, v in p.items() if k != "sort_order"} for p in presets]


class SnapshotTestRunRepo:
    def __init__(self, store: SnapshotStore) -> None:
        self.store = store

    async def list(self, filters: ExperimentFilters | None = None) -> builtins.list[dict[str, Any]]:
        rows = sorted((_record(r) for r in self.store.test_runs), key=lambda r: r["experiment_id"])
        if filters is None:
            return rows
        if filters.program is not None:
            rows = [r for r in rows if r["program"].lower() == filters.program.value.lower()]
        if filters.fuel_material is not None:
            rows = [r for r in rows if r["fuel_material"].lower() == filters.fuel_material.value.lower()]
        if filters.combustion_regime is not None:
            want = filters.combustion_regime.value.lower()
            rows = [r for r in rows if r["combustion_regime"].lower() == want]
        if filters.gravity_g is not None:
            g = filters.gravity_g
            rows = [r for r in rows if abs(float(r["gravity_g"]) - g) < GRAVITY_TOLERANCE]
        return rows

    async def get_many(self, ids: builtins.list[str]) -> builtins.list[dict[str, Any]]:
        by_id = {r["experiment_id"]: r for r in self.store.test_runs}
        return [_record(by_id[i]) for i in dict.fromkeys(ids) if i in by_id]

    async def all_for_ranking(self) -> builtins.list[dict[str, Any]]:
        return await self.list()


class SnapshotTelemetryRepo:
    def __init__(self, store: SnapshotStore) -> None:
        self.store = store

    async def get(self, experiment_id: str) -> dict[str, Any] | None:
        series = self.store.telemetry.get(experiment_id)
        return dict(series) if series is not None else None


class SnapshotChunkRepo:
    def __init__(self, store: SnapshotStore) -> None:
        self.store = store

    async def hybrid_search(
        self,
        query: str,
        embedding: list[float] | None,
        top_n: int = 5,
        filter: dict[str, Any] | None = None,
        *,
        k: int = HYBRID_CANDIDATES,
        rrf_k: int = RRF_K,
    ) -> list[dict[str, Any]]:
        chunks = self.store.chunks
        allowed = {
            i for i, c in enumerate(chunks) if not filter or _contains(c.get("metadata") or {}, filter)
        }

        bm25 = {i: s for i, s in self.store.bm25.scores(query).items() if i in allowed}
        kw_ranked = sorted(bm25, key=lambda i: (-bm25[i], i))[:k]

        vec_ranked: list[int] = []
        if embedding is not None:
            cosine = {
                i: sum(a * b for a, b in zip(embedding, emb, strict=False))
                for i in allowed
                if (emb := chunks[i].get("embedding"))
            }
            vec_ranked = sorted(cosine, key=lambda i: (-cosine[i], i))[:k]

        rrf: dict[int, float] = {}
        for ranked in (kw_ranked, vec_ranked):
            for rank, i in enumerate(ranked, start=1):
                rrf[i] = rrf.get(i, 0.0) + 1.0 / (rrf_k + rank)

        best = sorted(rrf, key=lambda i: (-rrf[i], int(chunks[i]["id"])))[:top_n]
        return [
            {
                "id": int(chunks[i]["id"]),
                "doc_id": chunks[i]["doc_id"],
                "page": chunks[i]["page"],
                "section": chunks[i].get("section", ""),
                "text": chunks[i]["text"],
                "metadata": chunks[i].get("metadata") or {},
                "score": rrf[i],
            }
            for i in best
        ]


__all__ = [
    "SnapshotChunkRepo",
    "SnapshotPresetRepo",
    "SnapshotStats",
    "SnapshotTelemetryRepo",
    "SnapshotTestRunRepo",
]
