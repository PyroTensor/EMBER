"""Baseline Spacecraft Fire Risk Index / Relative Experimental Flammability Index (0-100) with exact Shapley attributions.

risk(x) = 100 * sigmoid((O2 - LOI(x) - 4) / 3)

Attributions are *exact* Shapley values over 5 feature groups, computed by enumerating all
2^5 = 32 coalitions against the baseline (ISS standard by default), so
    sum(contributions) == risk(x) - risk(baseline)

Ported from legacy ``ember_data/models/risk.py``: ``CabinParams`` instead of the
Pydantic ``CabinConfig``.
"""

from __future__ import annotations

import dataclasses
import math
from collections.abc import Iterable
from typing import Final

from app.domain.physics.combustion import limiting_oxygen_index, predict_regime
from app.domain.risk.shapley import exact_shapley
from app.domain.types import ISS_BASELINE, CabinParams, Contribution, RiskResult

# feature group -> (label, CabinParams fields it controls)
FEATURE_GROUPS: Final[dict[str, tuple[str, tuple[str, ...]]]] = {
    "oxygen_enrichment": ("Oxygen concentration", ("oxygen_pct",)),
    "ventilation_coupling": ("HVAC ventilation flow", ("flow_velocity_cm_s",)),
    "gravity_buoyancy_regime": ("Gravity / buoyancy", ("gravity_g",)),
    "cabin_pressure_density": ("Cabin pressure", ("pressure_kpa",)),
    "material_flammability_intrinsic": ("Material & diluent", ("fuel_material", "diluent_gas")),
}


def _sigmoid(z: float) -> float:
    clamped = max(min(z, 60.0), -60.0)
    return 1.0 / (1.0 + math.exp(-clamped))


def oxygen_margin(params: CabinParams) -> tuple[float, float]:
    """Return ``(oxygen_pct - LOI, LOI)``."""
    loi = limiting_oxygen_index(
        params.fuel_material,
        params.gravity_g,
        params.pressure_kpa,
        params.flow_velocity_cm_s,
        params.diluent_gas,
    )
    return params.oxygen_pct - loi, loi


def risk(params: CabinParams) -> float:
    margin, _ = oxygen_margin(params)
    return 100.0 * _sigmoid((margin - 4.0) / 3.0)


def risk_band(r: float) -> str:
    if r < 25:
        return "LOW"
    if r < 50:
        return "ELEVATED"
    if r < 75:
        return "HIGH"
    return "CRITICAL"


def _mix(x: CabinParams, base: CabinParams, groups: Iterable[str]) -> CabinParams:
    """``base`` with the fields of ``groups`` taken from ``x``."""
    changes = {f: getattr(x, f) for g in groups for f in FEATURE_GROUPS[g][1]}
    return dataclasses.replace(base, **changes)


def shapley_contributions(x: CabinParams, base: CabinParams = ISS_BASELINE) -> dict[str, float]:
    """Exact Shapley value of each feature group for ``risk(x) - risk(base)`` (unrounded)."""
    return exact_shapley(lambda s: risk(_mix(x, base, s)), list(FEATURE_GROUPS))


def evaluate_cabin(params: CabinParams, baseline: CabinParams = ISS_BASELINE) -> RiskResult:
    margin, loi = oxygen_margin(params)
    r = risk(params)
    base_r = risk(baseline)
    r_rounded = round(r, 2)
    base_rounded = round(base_r, 2)
    phi = shapley_contributions(params, baseline)
    contribs = sorted(
        (Contribution(k, FEATURE_GROUPS[k][0], round(v, 2)) for k, v in phi.items()),
        key=lambda c: abs(c.value),
        reverse=True,
    )
    if contribs and abs(contribs[0].value) > 0:
        target_delta = round(r_rounded - base_rounded, 2)
        current_sum = round(sum(c.value for c in contribs), 2)
        residual = round(target_delta - current_sum, 2)
        if residual != 0.0:
            c0 = contribs[0]
            contribs[0] = Contribution(c0.feature, c0.label, round(c0.value + residual, 2))
    return RiskResult(
        risk_index=r_rounded,
        risk_band=risk_band(r),
        baseline_risk=base_rounded,
        predicted_regime=predict_regime(params.fuel_material, params.gravity_g, margin),
        estimated_loi_pct=round(loi, 2),
        oxygen_margin_pct=round(margin, 2),
        contributions=tuple(contribs),
    )


__all__ = [
    "FEATURE_GROUPS",
    "evaluate_cabin",
    "oxygen_margin",
    "risk",
    "risk_band",
    "shapley_contributions",
]
