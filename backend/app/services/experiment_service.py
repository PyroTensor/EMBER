"""``GET /api/experiments`` use case: schema_v1 test runs, optionally filtered."""

from __future__ import annotations

from app.repositories.interfaces import TestRunReader
from app.schemas.experiment import ExperimentFilters, TestRunRecord


class ExperimentService:
    def __init__(self, reader: TestRunReader) -> None:
        self._reader = reader

    async def list(self, filters: ExperimentFilters | None = None) -> list[TestRunRecord]:
        """Runs ordered by ``experiment_id``; ``gravity_g`` matches within ±0.01 g."""
        rows = await self._reader.list(filters)
        return [TestRunRecord.model_validate(row) for row in rows]


__all__ = ["ExperimentService"]
