"""``POST /api/experiments/rank`` use case: score every test run against a cabin configuration."""

from __future__ import annotations

from dataclasses import asdict

from app.domain.ranking.scenario_ranker import rank_runs
from app.domain.types import CabinParams, RankedRun
from app.repositories.interfaces import TestRunReader
from app.schemas.cabin import CabinConfig
from app.schemas.experiment import TestRunRecord
from app.schemas.ranking import RankedExperiment, RankRequest, RankResponse, RankWeights


class RankingService:
    def __init__(self, reader: TestRunReader) -> None:
        self._reader = reader

    async def rank(self, req: RankRequest) -> RankResponse:
        weights = _normalized(req.weights or RankWeights())
        runs = await self._reader.all_for_ranking()
        ranked = rank_runs(
            list(runs),
            asdict(_to_params(req.config)),
            weights.model_dump(),
            req.limit,
        )
        return RankResponse(weights=weights, results=[_to_schema(r) for r in ranked])


def _to_params(cfg: CabinConfig) -> CabinParams:
    return CabinParams(
        oxygen_pct=cfg.oxygen_pct,
        pressure_kpa=cfg.pressure_kpa,
        flow_velocity_cm_s=cfg.flow_velocity_cm_s,
        gravity_g=cfg.gravity_g,
        fuel_material=cfg.fuel_material.value,
        diluent_gas=cfg.diluent_gas.value,
    )


def _normalized(w: RankWeights) -> RankWeights:
    """Scale the weights to sum to 1 (the schema guarantees the sum is > 0)."""
    total = w.similarity + w.completeness + w.criticality
    return RankWeights(
        similarity=w.similarity / total,
        completeness=w.completeness / total,
        criticality=w.criticality / total,
    )


def _to_schema(r: RankedRun) -> RankedExperiment:
    return RankedExperiment(
        rank=r.rank,
        experiment_id=r.experiment_id,
        total_score=r.total_score,
        similarity=r.similarity,
        completeness=r.completeness,
        criticality=r.criticality,
        record=TestRunRecord.model_validate(r.record),
    )


__all__ = ["RankingService"]
