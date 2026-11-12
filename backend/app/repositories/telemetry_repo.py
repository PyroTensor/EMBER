"""``telemetry`` table access: bulk upsert (ingestion) + series lookup."""

from __future__ import annotations

from typing import Any

from sqlalchemy import select

from app.models.telemetry import Telemetry
from app.repositories.base import SqlRepository


class PgTelemetryRepository(SqlRepository[Telemetry]):
    model = Telemetry
    conflict_cols = ("experiment_id",)

    async def get(self, experiment_id: str) -> dict[str, Any] | None:  # type: ignore[override]
        """The stored series document (``experiment_id``, ``time_s``, ...) or ``None``."""
        series = await self.session.scalar(
            select(Telemetry.series).where(Telemetry.experiment_id == experiment_id)
        )
        return dict(series) if series is not None else None


__all__ = ["PgTelemetryRepository"]
