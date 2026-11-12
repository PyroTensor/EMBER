"""``POST /api/experiments/rank``: scenario ranker request/response."""

from __future__ import annotations

from pydantic import Field, model_validator

from app.core.constants import DEFAULT_RANK_WEIGHTS
from app.schemas.cabin import CabinConfig
from app.schemas.common import APIModel
from app.schemas.experiment import TestRunRecord


class RankWeights(APIModel):
    """Relative weights; the service normalizes them to sum to 1."""

    similarity: float = Field(default=DEFAULT_RANK_WEIGHTS["similarity"], ge=0.0)
    completeness: float = Field(default=DEFAULT_RANK_WEIGHTS["completeness"], ge=0.0)
    criticality: float = Field(default=DEFAULT_RANK_WEIGHTS["criticality"], ge=0.0)

    @model_validator(mode="after")
    def _not_all_zero(self) -> RankWeights:
        if self.similarity + self.completeness + self.criticality <= 0:
            raise ValueError("at least one weight must be > 0")
        return self


class RankRequest(APIModel):
    config: CabinConfig
    weights: RankWeights = Field(default_factory=RankWeights)
    limit: int = Field(default=10, ge=1, le=50)


class RankedExperiment(APIModel):
    rank: int = Field(ge=1)
    experiment_id: str
    total_score: float
    similarity: float
    completeness: float
    criticality: float
    record: TestRunRecord


class RankResponse(APIModel):
    weights: RankWeights
    results: list[RankedExperiment]


__all__ = ["RankRequest", "RankResponse", "RankWeights", "RankedExperiment"]
