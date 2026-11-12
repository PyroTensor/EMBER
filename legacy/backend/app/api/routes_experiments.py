"""Experiments, scenario ranking & telemetry endpoints (Module 3)."""
from __future__ import annotations

from dataclasses import asdict
from typing import Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.db.session import get_telemetry, list_test_runs
from ember_data.ranking.scenario_ranker import DEFAULT_WEIGHTS, rank_runs
from ember_data.schema import CabinConfig

router = APIRouter(tags=["experiments"])


class RankWeights(BaseModel):
    similarity: float = 0.5
    completeness: float = 0.2
    criticality: float = 0.3


class RankRequest(BaseModel):
    config: CabinConfig
    weights: Optional[RankWeights] = None
    limit: int = 10


@router.get("/api/experiments")
def get_experiments(
    program: Optional[str] = None,
    fuel_material: Optional[str] = None,
    combustion_regime: Optional[str] = None,
    gravity_g: Optional[float] = None,
) -> list[dict]:
    return list_test_runs(
        program=program,
        fuel_material=fuel_material,
        combustion_regime=combustion_regime,
        gravity_g=gravity_g,
    )


@router.post("/api/experiments/rank")
def post_rank_experiments(req: RankRequest) -> dict:
    runs = list_test_runs()
    w = req.weights.model_dump() if req.weights else dict(DEFAULT_WEIGHTS)
    ranked = rank_runs(runs, req.config.model_dump(), weights=w, limit=req.limit)
    return {
        "weights": w,
        "results": [asdict(r) for r in ranked],
    }


@router.get("/api/telemetry/{experiment_id}")
def get_experiment_telemetry(experiment_id: str) -> dict:
    series = get_telemetry(experiment_id)
    if series is None:
        raise HTTPException(status_code=404, detail=f"Unknown experiment_id: {experiment_id}")
    return series
