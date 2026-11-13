"""``GET /api/telemetry/{experiment_id}`` use case: the stored time-series for one run."""

from __future__ import annotations

from app.core.exceptions import NotFoundError
from app.repositories.interfaces import TelemetryReader
from app.schemas.telemetry import Telemetry


class TelemetryService:
    def __init__(self, reader: TelemetryReader) -> None:
        self._reader = reader

    async def get(self, experiment_id: str) -> Telemetry:
        series = await self._reader.get(experiment_id)
        if series is None:
            raise NotFoundError(
                f"No telemetry for experiment '{experiment_id}'",
                code="TELEMETRY_NOT_FOUND",
                details={"experiment_id": experiment_id},
            )
        return Telemetry.model_validate({"experiment_id": experiment_id, **series})


__all__ = ["TelemetryService"]
