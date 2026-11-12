"""``GET /api/telemetry/{experiment_id}``."""

from __future__ import annotations

from fastapi import APIRouter

from app.api.deps import TelemetryServiceDep
from app.schemas.common import error_responses
from app.schemas.telemetry import Telemetry

router = APIRouter(tags=["telemetry"])


@router.get(
    "/telemetry/{experiment_id}",
    response_model=Telemetry,
    summary="Time-series curves for one run",
    responses=error_responses(404, 422, 500),
)
async def get_telemetry(experiment_id: str, service: TelemetryServiceDep) -> Telemetry:
    return await service.get(experiment_id)
