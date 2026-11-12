"""Baseline Spacecraft Fire Risk Index (0-100) with exact Shapley attributions.

risk(x) = 100 * sigmoid((O2 - LOI(x) - 4) / 3)

Attributions are *exact* Shapley values over 5 feature groups, computed by enumerating all
2^5 = 32 coalitions against the ISS-standard baseline, so
    sum(contributions) == risk(x) - risk(ISS baseline)     (to float precision)

TODO(squad1-B): replace risk() with a trained surrogate (e.g. gradient boosting on the
               Nov 14 data) and keep this Shapley wrapper - it is model-agnostic.
NOTE: ported to frontend/src/lib/mock-engine.ts for offline mode.
"""
from __future__ import annotations

import itertools
import math
from dataclasses import asdict, dataclass

from ember_data.physics.combustion import limiting_oxygen_index, predict_regime
from ember_data.schema import CabinConfig

BASELINE = CabinConfig(oxygen_pct=21.0, pressure_kpa=101.3, flow_velocity_cm_s=10.0, gravity_g=0.0,
                       fuel_material="Cotton-Fiberglass", diluent_gas="N2")

# feature group -> (label, CabinConfig fields it controls)
FEATURE_GROUPS: dict[str, tuple[str, tuple[str, ...]]] = {
    "oxygen_enrichment": ("Oxygen concentration", ("oxygen_pct",)),
    "ventilation_coupling": ("HVAC ventilation flow", ("flow_velocity_cm_s",)),
    "gravity_buoyancy_regime": ("Gravity / buoyancy", ("gravity_g",)),
    "cabin_pressure_density": ("Cabin pressure", ("pressure_kpa",)),
    "material_flammability_intrinsic": ("Material & diluent", ("fuel_material", "diluent_gas")),
}


def _sigmoid(z: float) -> float:
    return 1.0 / (1.0 + math.exp(-z))


def oxygen_margin(cfg: CabinConfig) -> tuple[float, float]:
    loi = limiting_oxygen_index(cfg.fuel_material, cfg.gravity_g, cfg.pressure_kpa, cfg.flow_velocity_cm_s, cfg.diluent_gas)
    return cfg.oxygen_pct - loi, loi


def risk(cfg: CabinConfig) -> float:
    margin, _ = oxygen_margin(cfg)
    return 100.0 * _sigmoid((margin - 4.0) / 3.0)


def risk_band(r: float) -> str:
    if r < 25:
        return "LOW"
    if r < 50:
        return "ELEVATED"
    if r < 75:
        return "HIGH"
    return "CRITICAL"


def _mix(x: CabinConfig, base: CabinConfig, groups: set[str]) -> CabinConfig:
    data = base.model_dump()
    for g in groups:
        for field in FEATURE_GROUPS[g][1]:
            data[field] = getattr(x, field)
    return CabinConfig(**data)


def shapley(x: CabinConfig, base: CabinConfig = BASELINE) -> dict[str, float]:
    names = list(FEATURE_GROUPS)
    n = len(names)
    cache: dict[frozenset[str], float] = {}

    def v(s: frozenset[str]) -> float:
        if s not in cache:
            cache[s] = risk(_mix(x, base, set(s)))
        return cache[s]

    phi = {k: 0.0 for k in names}
    for i in names:
        others = [k for k in names if k != i]
        for r in range(n):
            w = math.factorial(r) * math.factorial(n - r - 1) / math.factorial(n)
            for subset in itertools.combinations(others, r):
                s = frozenset(subset)
                phi[i] += w * (v(s | {i}) - v(s))
    return phi


@dataclass
class Contribution:
    feature: str
    label: str
    value: float


@dataclass
class CabinEvaluation:
    risk_index: float
    risk_band: str
    baseline_risk: float
    predicted_regime: str
    estimated_loi_pct: float
    oxygen_margin_pct: float
    contributions: list[Contribution]

    def to_dict(self) -> dict:
        return asdict(self)


def evaluate_cabin(cfg: CabinConfig) -> CabinEvaluation:
    margin, loi = oxygen_margin(cfg)
    r = risk(cfg)
    phi = shapley(cfg)
    contribs = sorted(
        (Contribution(k, FEATURE_GROUPS[k][0], round(v, 2)) for k, v in phi.items()),
        key=lambda c: abs(c.value), reverse=True,
    )
    return CabinEvaluation(
        risk_index=round(r, 1),
        risk_band=risk_band(r),
        baseline_risk=round(risk(BASELINE), 1),
        predicted_regime=predict_regime(cfg.fuel_material, cfg.gravity_g, margin),
        estimated_loi_pct=round(loi, 2),
        oxygen_margin_pct=round(margin, 2),
        contributions=contribs,
    )
