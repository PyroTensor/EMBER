"""Cabin configurator & mission presets endpoints (Module 1)."""
from __future__ import annotations

import json

from fastapi import APIRouter

from ember_data import MOCK_DATA_DIR
from ember_data.models.risk import evaluate_cabin
from ember_data.schema import CabinConfig

router = APIRouter(tags=["cabin"])


@router.get("/api/presets")
def get_presets() -> list[dict]:
    return json.loads((MOCK_DATA_DIR / "presets.json").read_text())


@router.post("/api/evaluate-cabin")
def post_evaluate_cabin(cfg: CabinConfig) -> dict:
    return evaluate_cabin(cfg).to_dict()
