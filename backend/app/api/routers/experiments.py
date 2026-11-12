"""``GET /api/experiments`` and ``POST /api/experiments/rank``."""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Query

from app.api.deps import ExperimentServiceDep, RankingServiceDep
from app.schemas.common import error_responses
from app.schemas.experiment import ExperimentFilters, TestRunRecord
from app.schemas.ranking import RankRequest, RankResponse

router = APIRouter(tags=["experiments"])


@router.get(
    "/experiments",
    response_model=list[TestRunRecord],
    summary="All test runs (schema_v1 records)",
    responses=error_responses(422, 500),
)
async def list_experiments(
    filters: Annotated[ExperimentFilters, Query()], service: ExperimentServiceDep
) -> list[TestRunRecord]:
    return await service.list(filters)


@router.post(
    "/experiments/rank",
    response_model=RankResponse,
    summary="Scenario ranker - score test runs against a habitat configuration",
    responses=error_responses(422, 500),
)
async def rank_experiments(req: RankRequest, service: RankingServiceDep) -> RankResponse:
    return await service.rank(req)
