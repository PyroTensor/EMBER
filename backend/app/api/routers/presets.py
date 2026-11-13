"""``GET /api/presets``."""

from __future__ import annotations

from fastapi import APIRouter

from app.api.deps import PresetServiceDep
from app.schemas.common import error_responses
from app.schemas.preset import Preset

router = APIRouter(tags=["presets"])


@router.get(
    "/presets",
    response_model=list[Preset],
    summary="Mission cabin presets",
    responses=error_responses(422, 500),
)
async def list_presets(service: PresetServiceDep) -> list[Preset]:
    return await service.list()
