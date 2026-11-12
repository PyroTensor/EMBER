"""Frozen value types for the pure domain (stdlib only; services map API schemas <-> these)."""

from __future__ import annotations

from collections.abc import Mapping
from dataclasses import dataclass, field
from typing import Any, Final


@dataclass(frozen=True, slots=True)
class CabinParams:
    """A habitat / scenario: the 6 CabinConfig fields."""

    oxygen_pct: float
    pressure_kpa: float
    flow_velocity_cm_s: float
    gravity_g: float
    fuel_material: str
    diluent_gas: str


@dataclass(frozen=True, slots=True)
class Contribution:
    feature: str
    label: str
    value: float


@dataclass(frozen=True, slots=True)
class RiskResult:
    risk_index: float
    risk_band: str
    baseline_risk: float
    predicted_regime: str
    estimated_loi_pct: float
    oxygen_margin_pct: float
    contributions: tuple[Contribution, ...]


@dataclass(frozen=True, slots=True)
class RankedRun:
    rank: int
    experiment_id: str
    total_score: float
    similarity: float
    completeness: float
    criticality: float
    record: Mapping[str, Any] = field(repr=False)


ISS_BASELINE: Final = CabinParams(21.0, 101.3, 10.0, 0.0, "Cotton-Fiberglass", "N2")

__all__ = ["ISS_BASELINE", "CabinParams", "Contribution", "RankedRun", "RiskResult"]
