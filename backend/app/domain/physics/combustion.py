"""Baseline microgravity combustion physics.

Deliberately simple, transparent formulas so the risk model and ranker are explainable.
TODO(squad1-B): calibrate coefficients against the official Nov 14 data
               (fit MATERIAL_BASE_LOI + flow/pressure terms by least squares on LOI rows).
TODO(squad1-B): phase_grid() -> 2D (O2, P) regime map for the Module 1 Plotly phase diagram.

NOTE: frontend/src/lib/mock-engine.ts ports these functions for offline mock mode -
      keep them in sync.
"""

from __future__ import annotations

import math

P0_KPA = 101.3

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
    return 30.0 * math.sqrt(max(gravity_g, 0.0) * pressure_kpa / P0_KPA)


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
    return (
        MATERIAL_BASE_LOI[material]
        + flow_loi_shift(u)
        + pressure_loi_shift(pressure_kpa)
        + DILUENT_SHIFT.get(diluent, 0.0)
    )


def predict_regime(material: str, gravity_g: float, oxygen_margin: float) -> str:
    if oxygen_margin < -2.0:
        return "No Ignition"
    if oxygen_margin < 0.0:
        return "Self-Extinguished"
    if material == "Heptane" and gravity_g == 0.0 and oxygen_margin < 9.0:
        return "Cool Flame"
    return "Sustained Burn"
