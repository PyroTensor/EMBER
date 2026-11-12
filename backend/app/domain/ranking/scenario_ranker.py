"""Scenario ranker: score test runs against a habitat configuration.

TotalScore = (w_sim*S_sim + w_comp*S_comp + w_crit*S_crit) / (w_sim + w_comp + w_crit)

  S_sim  (0-100)  weighted Gaussian similarity in normalised (O2, P, flow, g) space,
                  x material match (1.0 / 0.6) x diluent match (1.0 / 0.9)
  S_comp (0-100)  70 * fraction of optional outputs present + 30 * richness of extra_telemetry
  S_crit (0-100)  60 * regime severity + 25 * radiative flux + 15 * positive O2 margin over LOI

Used by: RAG node `scenario_ranker`, POST /api/experiments/rank.
Ported from legacy ``ember_data/ranking/scenario_ranker.py`` (same formulas); returns
``domain.types.RankedRun``.
TODO(squad1-B): learn similarity weights / length-scales from data once Nov 14 drop lands.
"""

from __future__ import annotations

import math
from collections.abc import Mapping
from typing import Any, Final

from app.domain.types import RankedRun

DEFAULT_WEIGHTS: Final[Mapping[str, float]] = {"similarity": 0.5, "completeness": 0.2, "criticality": 0.3}

# feature -> (normalising range, importance)
SIM_FEATURES: Final[dict[str, tuple[float, float]]] = {
    "oxygen_pct": (25.0, 1.0),
    "pressure_kpa": (61.3, 0.7),
    "flow_velocity_cm_s": (50.0, 0.7),
    "gravity_g": (1.0, 1.0),
}
SIM_LENGTH_SCALE: Final = 8.0  # higher = sharper similarity falloff

REGIME_SEVERITY: Final[dict[str, float]] = {
    "Sustained Burn": 1.0,
    "Cool Flame": 0.85,
    "Self-Extinguished": 0.4,
    "No Ignition": 0.1,
}
OPTIONAL_OUTPUTS: Final = (
    "spread_or_burn_rate",
    "peak_radiative_flux_kw_m2",
    "limiting_oxygen_index_pct",
    "burn_duration_s",
)


def similarity(run: Mapping[str, Any], cfg: Mapping[str, Any]) -> float:
    total_w = sum(w for _, w in SIM_FEATURES.values())
    d2 = (
        sum(w * ((float(run[f]) - float(cfg[f])) / rng) ** 2 for f, (rng, w) in SIM_FEATURES.items())
        / total_w
    )
    s = math.exp(-SIM_LENGTH_SCALE * d2)
    s *= 1.0 if run.get("fuel_material") == cfg.get("fuel_material") else 0.6
    s *= 1.0 if run.get("diluent_gas") == cfg.get("diluent_gas") else 0.9
    return 100.0 * s


def completeness(run: Mapping[str, Any]) -> float:
    present = sum(run.get(k) is not None for k in OPTIONAL_OUTPUTS) / len(OPTIONAL_OUTPUTS)
    extras = min(len(run.get("extra_telemetry") or {}), 6) / 6.0
    return 70.0 * present + 30.0 * extras


def criticality(run: Mapping[str, Any]) -> float:
    sev = REGIME_SEVERITY.get(run.get("combustion_regime", ""), 0.0)
    flux: float = min((run.get("peak_radiative_flux_kw_m2") or 0.0) / 10.0, 1.0)
    loi = run.get("limiting_oxygen_index_pct")
    margin = 0.0 if loi is None else min(max(float(run["oxygen_pct"]) - float(loi), 0.0) / 10.0, 1.0)
    return 60.0 * sev + 25.0 * flux + 15.0 * margin


def rank_runs(
    runs: list[Mapping[str, Any]],
    cfg: Mapping[str, Any],
    weights: Mapping[str, float] | None = None,
    limit: int | None = 10,
) -> list[RankedRun]:
    w = {**DEFAULT_WEIGHTS, **(weights or {})}
    wsum = sum(w.values()) or 1.0
    scored: list[tuple[float, float, float, float, Mapping[str, Any]]] = []
    for r in runs:
        s, c, k = similarity(r, cfg), completeness(r), criticality(r)
        total = (w["similarity"] * s + w["completeness"] * c + w["criticality"] * k) / wsum
        scored.append((total, s, c, k, r))
    scored.sort(key=lambda t: t[0], reverse=True)
    out = [
        RankedRun(i + 1, r["experiment_id"], round(t, 2), round(s, 2), round(c, 2), round(k, 2), dict(r))
        for i, (t, s, c, k, r) in enumerate(scored)
    ]
    return out[:limit] if limit else out


__all__ = ["DEFAULT_WEIGHTS", "completeness", "criticality", "rank_runs", "similarity"]
