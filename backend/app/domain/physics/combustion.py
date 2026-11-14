"""Baseline microgravity combustion physics.

Deliberately simple, transparent formulas so the risk model and ranker are explainable.
TODO(squad1-B): calibrate coefficients against the official Nov 14 data
               (fit MATERIAL_BASE_LOI + flow/pressure terms by least squares on LOI rows).

NOTE: frontend/src/mocks/engine/combustion.ts ports these functions for offline mock mode -
      keep them in sync.
"""

from __future__ import annotations

import math
from collections.abc import Iterable, Mapping
from typing import Any

P0_KPA = 101.3
DEFAULT_BASE_LOI = 18.0

MATERIAL_BASE_LOI: dict[str, float] = {  # % O2, 1g / 101.3 kPa / buoyant flow
    "PMMA": 17.5,
    "Cotton-Fiberglass": 18.5,
    "Nomex": 27.0,
    "Heptane": 13.5,
    "Methanol": 15.5,
}
DILUENT_SHIFT: dict[str, float] = {"N2": 0.0, "CO2": 3.0, "He": 2.0, "Ar": -1.0}


def buoyant_velocity(gravity_g: float, pressure_kpa: float) -> float:
    """Characteristic buoyancy-induced velocity (cm/s); ~30 cm/s at 1g sea level."""
    return 30.0 * math.sqrt(max(gravity_g, 0.0) * max(pressure_kpa, 0.0) / P0_KPA)


def effective_velocity(flow_cm_s: float, gravity_g: float, pressure_kpa: float) -> float:
    """u_eff = sqrt(u_forced^2 + u_buoyant^2)."""
    return math.sqrt(flow_cm_s**2 + buoyant_velocity(gravity_g, pressure_kpa) ** 2)


def flow_loi_shift(u_eff: float) -> float:
    """U-shaped LOI shift vs effective velocity.

    * u -> 0  : oxygen starvation / radiative loss -> LOI rises (~+2.75 %)
    * u ~ 8   : 'ventilation paradox' minimum -> LOI dips (~-1.3 %)
    * u > 30  : blow-off -> LOI rises again
    """
    return (
        3.0 * math.exp(-u_eff / 3.0)
        - 1.5 * math.exp(-(((u_eff - 8.0) / 6.0) ** 2))
        + 0.05 * max(0.0, u_eff - 30.0)
    )


def pressure_loi_shift(pressure_kpa: float) -> float:
    return 4.0 * (1.0 - pressure_kpa / P0_KPA)


def limiting_oxygen_index(
    material: str, gravity_g: float, pressure_kpa: float, flow_cm_s: float, diluent: str = "N2"
) -> float:
    u = effective_velocity(flow_cm_s, gravity_g, pressure_kpa)
    base_loi = MATERIAL_BASE_LOI.get(material, DEFAULT_BASE_LOI)
    return base_loi + flow_loi_shift(u) + pressure_loi_shift(pressure_kpa) + DILUENT_SHIFT.get(diluent, 0.0)


def predict_regime(material: str, gravity_g: float, oxygen_margin: float) -> str:
    if oxygen_margin < -2.0:
        return "No Ignition"
    if oxygen_margin < 0.0:
        return "Self-Extinguished"
    if material == "Heptane" and gravity_g < 0.05 and oxygen_margin < 9.0:
        return "Cool Flame"
    return "Sustained Burn"


def phase_grid(
    material: str,
    gravity_g: float = 0.0,
    flow_cm_s: float = 10.0,
    diluent: str = "N2",
    o2_values: tuple[float, ...] = (12.0, 15.0, 18.0, 21.0, 25.0, 30.0, 34.0, 40.0),
    pressure_values: tuple[float, ...] = (40.0, 56.5, 70.3, 85.0, 101.3),
) -> list[dict[str, float | str]]:
    """2D (O2, P) combustion regime & LOI margin grid for phase diagram plotting."""
    grid: list[dict[str, float | str]] = []
    for p_kpa in pressure_values:
        loi = limiting_oxygen_index(material, gravity_g, p_kpa, flow_cm_s, diluent)
        for o2_pct in o2_values:
            margin = o2_pct - loi
            grid.append(
                {
                    "oxygen_pct": o2_pct,
                    "pressure_kpa": p_kpa,
                    "estimated_loi_pct": round(loi, 2),
                    "oxygen_margin_pct": round(margin, 2),
                    "predicted_regime": predict_regime(material, gravity_g, margin),
                }
            )
    return grid


def fit_material_base_loi(runs: Iterable[Mapping[str, Any]]) -> dict[str, float]:
    """Least-squares estimate of MATERIAL_BASE_LOI from runs with ``limiting_oxygen_index_pct``."""
    residuals_by_mat: dict[str, list[float]] = {}
    for r in runs:
        loi_obs = r.get("limiting_oxygen_index_pct")
        mat = r.get("fuel_material")
        g = r.get("gravity_g")
        p = r.get("pressure_kpa")
        flow = r.get("flow_velocity_cm_s")
        dil = r.get("diluent_gas") or "N2"
        if loi_obs is None or not mat or g is None or p is None or flow is None:
            continue
        u = effective_velocity(float(flow), float(g), float(p))
        shift = flow_loi_shift(u) + pressure_loi_shift(float(p)) + DILUENT_SHIFT.get(str(dil), 0.0)
        residuals_by_mat.setdefault(str(mat), []).append(float(loi_obs) - shift)
    calibrated = dict(MATERIAL_BASE_LOI)
    for mat, vals in residuals_by_mat.items():
        if vals:
            calibrated[mat] = round(sum(vals) / len(vals), 2)
    return calibrated
