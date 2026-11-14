"""LangGraph Tool Node - SQL tool: read-only structured queries on test_runs.

Uses the injected ``TestRunReader`` (read-only Postgres role ``ember_ro`` or the snapshot) with typed filters.
TODO(squad2-A): add constrained LLM text-to-SQL with AST validation (SELECT-only, table whitelist).
"""

from __future__ import annotations

import re
from collections.abc import Mapping
from typing import Any, Final

from app.rag.state import EvidenceItem, GraphState
from app.rag.toolkit import RagToolkit
from app.schemas.enums import CombustionRegime, FuelMaterial, Program
from app.schemas.experiment import ExperimentFilters

PROGRAMS: Final[dict[str, str]] = {
    "bass-ii": "BASS-II", "bass": "BASS-II", "sofie": "SoFIE", "flex": "FLEX", "acme": "ACME",
}  # fmt: skip
MATERIALS: Final[dict[str, str]] = {
    "pmma": "PMMA",
    "cotton-fiberglass": "Cotton-Fiberglass",
    "cotton": "Cotton-Fiberglass",
    "fiberglass": "Cotton-Fiberglass",
    "sibal": "Cotton-Fiberglass",
    "nomex": "Nomex",
    "heptane": "Heptane",
    "methanol": "Methanol",
}
REGIMES: Final[dict[str, str]] = {
    "cool flame": "Cool Flame",
    "cool flames": "Cool Flame",
    "self-extinguished": "Self-Extinguished",
    "extinguished": "Self-Extinguished",
    "no ignition": "No Ignition",
    "sustained burn": "Sustained Burn",
}
GEOMETRIES: Final[dict[str, str]] = {
    "droplet": "Droplet",
    "droplets": "Droplet",
    "flat sheet": "Flat Sheet",
    "thin sheet": "Flat Sheet",
    "rod": "Rod",
    "rods": "Rod",
    "gaseous": "Gaseous",
    "spherical burner": "Gaseous",
}
DILUENT_PATTERNS: Final[tuple[tuple[re.Pattern[str], str], ...]] = (
    (re.compile(r"\b(helium|he)\b", re.IGNORECASE), "He"),
    (re.compile(r"\b(co2|carbon dioxide)\b", re.IGNORECASE), "CO2"),
    (re.compile(r"\b(argon|ar)\b", re.IGNORECASE), "Ar"),
    (re.compile(r"\b(nitrogen|n2)\b", re.IGNORECASE), "N2"),
)


def _format_run(r: Mapping[str, Any]) -> str:
    metrics = [f"regime={r['combustion_regime']}"]
    if r.get("spread_or_burn_rate") is not None:
        metrics.append(f"spread/burn={r['spread_or_burn_rate']}")
    if r.get("limiting_oxygen_index_pct") is not None:
        metrics.append(f"LOI={r['limiting_oxygen_index_pct']}%")
    if r.get("peak_radiative_flux_kw_m2") is not None:
        metrics.append(f"peak_flux={r['peak_radiative_flux_kw_m2']} kW/m2")
    return (
        f"{r['experiment_id']} ({r['program']}, {r['fuel_material']}, {r['fuel_geometry']}): "
        f"g={r['gravity_g']}g, O2={r['oxygen_pct']}%, P={r['pressure_kpa']} kPa, "
        f"flow={r['flow_velocity_cm_s']} cm/s, diluent={r['diluent_gas']} -> "
        f"{', '.join(metrics)} "
        f"(source: {r.get('source_doc_id')} p.{r.get('source_page')})"
    )


def _run_item(r: Mapping[str, Any], score: float) -> EvidenceItem:
    return {
        "id": r["experiment_id"],
        "kind": "test_run",
        "source": "sql_tool",
        "score": score,
        "text": _format_run(r),
        "doc_id": r.get("source_doc_id"),
        "page": r.get("source_page"),
        "experiment_id": r["experiment_id"],
    }


async def run_sql_tool(question: str, tk: RagToolkit) -> list[EvidenceItem]:
    q = question.lower()

    # 1. Explicit EXP-XXXX lookup
    exp_ids = [m.upper() for m in re.findall(r"exp-\d{4}", q)]
    if exp_ids:
        items = [_run_item(r, 1.0) for r in await tk.runs.get_many(exp_ids)]
        if items:
            return items

    # 2. Extract structured filters from question text
    program = next((v for k, v in PROGRAMS.items() if k in q), None)
    material = next((v for k, v in MATERIALS.items() if k in q), None)
    regime = next((v for k, v in REGIMES.items() if k in q), None)
    geometry = next((v for k, v in GEOMETRIES.items() if k in q), None)
    diluents = [code for pat, code in DILUENT_PATTERNS if pat.search(q)]

    gravities: list[float] = []
    if "lunar" in q or "0.16" in q:
        gravities.append(0.16)
    if "mars" in q or "0.38" in q:
        gravities.append(0.38)
    if re.search(r"\b1g\b|earth|normal[- ]gravity", q):
        gravities.append(1.0)
    if re.search(r"\b0g\b|microgravity|zero-g|weightless", q):
        gravities.append(0.0)

    non_zero_gravities = [g for g in gravities if g > 0]
    is_gravity_comparison = len(gravities) >= 2
    single_gravity = non_zero_gravities[0] if len(gravities) == 1 and non_zero_gravities else None

    has_ventilation = bool(re.search(r"\b(ventilation|flow|fan|opposed|concurrent)\b", q))
    has_artemis = bool(re.search(r"\b(artemis|34\s*%|56\.5)\b", q))
    has_iss = bool(re.search(r"\biss\b", q))
    m_o2 = re.search(r"(\d+(?:\.\d+)?)\s*%\s*(?:o2|oxygen)", q)
    m_kpa = re.search(r"(\d+(?:\.\d+)?)\s*kpa", q)

    has_specific_filter = any(
        [
            program,
            material,
            regime,
            geometry,
            diluents,
            single_gravity is not None,
            is_gravity_comparison,
            has_ventilation,
            has_artemis,
            has_iss,
            m_o2,
            m_kpa,
        ]
    )
    if not has_specific_filter:
        return []

    rows = await tk.runs.list(
        ExperimentFilters(
            program=Program(program) if program else None,
            fuel_material=FuelMaterial(material) if material else None,
            combustion_regime=CombustionRegime(regime) if regime else None,
            gravity_g=single_gravity,
        )
    )

    if geometry:
        geom_rows = [r for r in rows if r.get("fuel_geometry") == geometry]
        if geom_rows:
            rows = geom_rows

    if diluents:
        dil_rows = [r for r in rows if r.get("diluent_gas") in diluents]
        if dil_rows:
            rows = dil_rows

    if is_gravity_comparison:
        selected: list[dict[str, Any]] = []
        for g in gravities:
            g_rows = [r for r in rows if abs(float(r["gravity_g"]) - g) < 1e-4]
            selected.extend(g_rows[:2])
        if selected:
            rows = selected

    # Prefer low-flow runs when user asks about ventilation / flow
    if has_ventilation:
        rows.sort(key=lambda r: (r["program"] != "BASS-II", abs(float(r["flow_velocity_cm_s"]) - 7.0)))
    elif has_artemis:
        rows.sort(key=lambda r: abs(float(r["oxygen_pct"]) - 34.0) + abs(float(r["pressure_kpa"]) - 56.5))
    elif has_iss:
        rows.sort(
            key=lambda r: (
                abs(float(r["oxygen_pct"]) - 21.0)
                + abs(float(r["pressure_kpa"]) - 101.3)
                + abs(float(r["gravity_g"]) - 0.0) * 10.0
            )
        )
    elif m_o2 or m_kpa:
        target_o2 = float(m_o2.group(1)) if m_o2 else None
        target_kpa = float(m_kpa.group(1)) if m_kpa else None
        rows.sort(
            key=lambda r: (
                (abs(float(r["oxygen_pct"]) - target_o2) if target_o2 is not None else 0.0)
                + (abs(float(r["pressure_kpa"]) - target_kpa) if target_kpa is not None else 0.0)
            )
        )

    return [_run_item(r, round(0.95 - 0.05 * idx, 3)) for idx, r in enumerate(rows[:5])]


async def sql_tool_node(state: GraphState, tk: RagToolkit) -> dict[str, Any]:
    existing = list(state.get("evidence") or [])
    new_items = await run_sql_tool(state["question"], tk)
    seen = {e["id"] for e in existing}
    merged = existing + [e for e in new_items if e["id"] not in seen]
    return {"evidence": merged}


__all__ = ["MATERIALS", "PROGRAMS", "REGIMES", "run_sql_tool", "sql_tool_node"]
