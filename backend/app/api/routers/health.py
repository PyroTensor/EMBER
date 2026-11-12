"""``GET /api/health``."""

from __future__ import annotations

from fastapi import APIRouter

from app.api.deps import HealthServiceDep
from app.schemas.common import error_responses
from app.schemas.health import Health

router = APIRouter(tags=["health"])


@router.get(
    "/health",
    response_model=Health,
    summary="Service + data status",
    responses=error_responses(422, 500),
)
async def health(service: HealthServiceDep) -> Health:
    return await service.get()
