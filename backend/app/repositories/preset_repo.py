"""``presets`` table access (write side; ``list_ordered`` arrives in B6.1)."""

from __future__ import annotations

from collections.abc import Sequence
from typing import Any

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


__all__ = ["PgPresetRepository"]
