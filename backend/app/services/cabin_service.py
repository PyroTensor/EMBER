"""``POST /api/evaluate-cabin`` use case: pure risk evaluation against the ISS baseline."""

from __future__ import annotations

from app.domain.risk.fire_risk import evaluate_cabin
from app.domain.types import ISS_BASELINE, CabinParams, RiskResult
from app.schemas.cabin import CabinConfig, CabinEvaluation, Contribution
from app.schemas.enums import CombustionRegime, RiskBand


class CabinService:
    """No I/O: ``CabinConfig`` → domain ``CabinParams`` → ``RiskResult`` → ``CabinEvaluation``."""

    async def evaluate(self, cfg: CabinConfig) -> CabinEvaluation:
        params = CabinParams(
            oxygen_pct=cfg.oxygen_pct,
            pressure_kpa=cfg.pressure_kpa,
            flow_velocity_cm_s=cfg.flow_velocity_cm_s,
            gravity_g=cfg.gravity_g,
            fuel_material=cfg.fuel_material.value,
            diluent_gas=cfg.diluent_gas.value,
        )
        return _to_schema(evaluate_cabin(params, ISS_BASELINE))


def _to_schema(result: RiskResult) -> CabinEvaluation:
    return CabinEvaluation(
        risk_index=result.risk_index,
        risk_band=RiskBand(result.risk_band),
        baseline_risk=result.baseline_risk,
        predicted_regime=CombustionRegime(result.predicted_regime),
        estimated_loi_pct=result.estimated_loi_pct,
        oxygen_margin_pct=result.oxygen_margin_pct,
        contributions=[
            Contribution(feature=c.feature, label=c.label, value=c.value) for c in result.contributions
        ],
    )


__all__ = ["CabinService"]
