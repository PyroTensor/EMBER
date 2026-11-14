"""``POST /api/evaluate-cabin``: cabin configuration in, risk index + per-factor contributions out."""

from __future__ import annotations

from pydantic import Field

from app.schemas.common import APIModel
from app.schemas.enums import CombustionRegime, DiluentGas, FuelMaterial, RiskBand


class CabinConfig(APIModel):
    """A habitat / scenario to evaluate or rank against. Bounds come from schema_v1."""

    oxygen_pct: float = Field(ge=10.0, le=60.0)
    pressure_kpa: float = Field(ge=20.0, le=150.0)
    flow_velocity_cm_s: float = Field(ge=0.0, le=50.0)
    gravity_g: float = Field(ge=0.0, le=1.0)
    fuel_material: FuelMaterial
    diluent_gas: DiluentGas


class Contribution(APIModel):
    feature: str
    label: str
    value: float = Field(description="Signed risk points; contributions sum to risk_index - baseline_risk")


class CabinEvaluation(APIModel):
    risk_index: float = Field(ge=0.0, le=100.0)
    risk_band: RiskBand
    baseline_risk: float
    predicted_regime: CombustionRegime
    estimated_loi_pct: float
    oxygen_margin_pct: float = Field(description="oxygen_pct - estimated_loi_pct")
    contributions: list[Contribution]


__all__ = ["CabinConfig", "CabinEvaluation", "Contribution"]
