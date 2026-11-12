"""``presets`` table access: bulk upsert (ingestion) + ordered list."""

from __future__ import annotations

from collections.abc import Sequence
from typing import Any

from sqlalchemy import select

from app.models.preset import Preset
from app.repositories.base import SqlRepository


class PgPresetRepository(SqlRepository[Preset]):
    model = Preset
    conflict_cols = ("id",)

    async def upsert_many(
        self, rows: list[dict[str, Any]], conflict_cols: Sequence[str] | None = None
    ) -> int:
        """Upsert presets; ``sort_order`` = position in ``rows`` (i.e. in ``presets.json``)."""
        ordered = [{**row, "sort_order": position} for position, row in enumerate(rows)]
        return await super().upsert_many(ordered, conflict_cols)

    async def list_ordered(self) -> list[dict[str, Any]]:
        """Presets by ``sort_order`` (then id), shaped like ``schemas.preset.Preset``."""
        cols = [c for c in self.table.columns if c.name != "sort_order"]
        stmt = select(*cols).order_by(self.table.c.sort_order, self.table.c.id)
        result = await self.session.execute(stmt)
        return [dict(row) for row in result.mappings()]


__all__ = ["PgPresetRepository"]
