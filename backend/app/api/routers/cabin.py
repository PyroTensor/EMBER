"""``POST /api/evaluate-cabin``."""

from __future__ import annotations

from fastapi import APIRouter

from app.api.deps import CabinServiceDep
from app.schemas.cabin import CabinConfig, CabinEvaluation
from app.schemas.common import error_responses

router = APIRouter(tags=["cabin"])


@router.post(
    "/evaluate-cabin",
    response_model=CabinEvaluation,
    summary="Baseline risk index + per-factor contributions for a cabin configuration",
    responses=error_responses(422, 500),
)
async def evaluate_cabin(cfg: CabinConfig, service: CabinServiceDep) -> CabinEvaluation:
    return await service.evaluate(cfg)
