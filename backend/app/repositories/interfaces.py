"""Read-side Protocols: only the methods services and the RAG graph need.

Implemented by the Postgres repositories (``repositories/*_repo.py``) and the snapshot fallback
(``repositories/snapshot/``); ``api/deps.py`` picks one through ``DbAvailability``. Rows are plain dicts:
test runs are shaped like ``schemas.experiment.TestRunRecord``; chunk hits carry
``id, doc_id, page, section, text, metadata, score``.
"""

from __future__ import annotations

import builtins
from typing import Any, Protocol

from app.schemas.experiment import ExperimentFilters


class StatsReader(Protocol):
    async def count_runs(self) -> int: ...
    async def count_chunks(self) -> int: ...
    async def extra_telemetry_keys(self) -> list[str]: ...


class PresetReader(Protocol):
    async def list_ordered(self) -> list[dict[str, Any]]: ...


class TestRunReader(Protocol):
    async def list(self, filters: ExperimentFilters | None = None) -> list[dict[str, Any]]: ...
    async def get_many(self, ids: builtins.list[str]) -> builtins.list[dict[str, Any]]: ...
    async def all_for_ranking(self) -> builtins.list[dict[str, Any]]: ...


class TelemetryReader(Protocol):
    async def get(self, experiment_id: str) -> dict[str, Any] | None: ...


class ChunkSearcher(Protocol):
    async def hybrid_search(
        self,
        query: str,
        embedding: list[float] | None,
        top_n: int = 5,
        filter: dict[str, Any] | None = None,
    ) -> list[dict[str, Any]]: ...


__all__ = ["ChunkSearcher", "PresetReader", "StatsReader", "TelemetryReader", "TestRunReader"]
