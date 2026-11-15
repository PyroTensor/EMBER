"""``GET / POST /api/live-telemetry`` and ``POST /api/live-telemetry/reset``."""

from __future__ import annotations

from fastapi import APIRouter

from app.api.deps import LiveTelemetryServiceDep
from app.schemas.common import error_responses
from app.schemas.live_telemetry import LiveTelemetryIngestRequest, LiveTelemetryState

router = APIRouter(tags=["live-telemetry"])


@router.get(
    "/live-telemetry",
    response_model=LiveTelemetryState,
    summary="Current live telemetry stream state, rolling history, and top matching runs",
    responses=error_responses(422, 500),
)
async def get_live_telemetry(service: LiveTelemetryServiceDep) -> LiveTelemetryState:
    return await service.get_state()


@router.post(
    "/live-telemetry",
    response_model=LiveTelemetryState,
    summary="Ingest one live cabin/rig telemetry frame and return updated live dashboard state",
    responses=error_responses(422, 500),
)
async def ingest_live_telemetry(
    req: LiveTelemetryIngestRequest,
    service: LiveTelemetryServiceDep,
) -> LiveTelemetryState:
    return await service.ingest(req)


@router.post(
    "/live-telemetry/reset",
    response_model=LiveTelemetryState,
    summary="Clear the live telemetry stream buffer and reset status to idle",
    responses=error_responses(422, 500),
)
async def reset_live_telemetry(service: LiveTelemetryServiceDep) -> LiveTelemetryState:
    return await service.reset()
