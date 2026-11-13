"""``test_runs`` table access: bulk upsert (ingestion) + reads shaped like ``TestRunRecord``."""

from __future__ import annotations

import builtins
from typing import Any

from sqlalchemy import func, select, text

from app.models.test_run import TestRun
from app.repositories.base import SqlRepository
from app.schemas.experiment import ExperimentFilters

# DB-only columns that are not part of the schema_v1 record.
_INTERNAL_COLS = frozenset({"investigation_id", "review_flags"})
GRAVITY_TOLERANCE = 0.01


class PgTestRunRepository(SqlRepository[TestRun]):
    model = TestRun
    conflict_cols = ("experiment_id",)

    def _record_select(self) -> Any:
        cols = [c for c in self.table.columns if c.name not in _INTERNAL_COLS]
        return select(*cols).order_by(self.table.c.experiment_id)

    async def list(self, filters: ExperimentFilters | None = None) -> list[dict[str, Any]]:
        """All runs (ordered by experiment_id), optionally filtered; gravity matches within ±0.01 g."""
        stmt = self._record_select()
        c = self.table.c
        if filters is not None:
            if filters.program is not None:
                stmt = stmt.where(c.program == filters.program.value)
            if filters.fuel_material is not None:
                stmt = stmt.where(c.fuel_material == filters.fuel_material.value)
            if filters.combustion_regime is not None:
                stmt = stmt.where(c.combustion_regime == filters.combustion_regime.value)
            if filters.gravity_g is not None:
                stmt = stmt.where(func.abs(c.gravity_g - filters.gravity_g) < GRAVITY_TOLERANCE)
        result = await self.session.execute(stmt)
        return [dict(row) for row in result.mappings()]

    async def get_many(self, ids: builtins.list[str]) -> builtins.list[dict[str, Any]]:
        """Runs for ``ids`` in the order given; unknown ids are skipped."""
        if not ids:
            return []
        result = await self.session.execute(self._record_select().where(self.table.c.experiment_id.in_(ids)))
        by_id = {row["experiment_id"]: dict(row) for row in result.mappings()}
        return [by_id[i] for i in dict.fromkeys(ids) if i in by_id]

    async def all_for_ranking(self) -> builtins.list[dict[str, Any]]:
        return await self.list()

    async def count(self) -> int:
        return int(await self.session.scalar(select(func.count()).select_from(self.table)) or 0)

    async def extra_telemetry_keys(self) -> builtins.list[str]:
        result = await self.session.execute(
            text("SELECT DISTINCT jsonb_object_keys(extra_telemetry) AS k FROM test_runs ORDER BY k")
        )
        return [str(k) for k in result.scalars()]


__all__ = ["PgTestRunRepository"]
