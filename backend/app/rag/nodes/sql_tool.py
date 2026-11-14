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
    "bass-ii": "BASS-II", "bass": "BASS-II", "sofie": "SoFIE", "flex": "FLEX", "acme": "ACME", "saffire": "Saffire",
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


def _format_run(r: Mapping[str, Any]) -> str:
    return (
        f"{r['experiment_id']} ({r['program']}, {r['fuel_material']}, {r['fuel_geometry']}): "
        f"g={r['gravity_g']}g, O2={r['oxygen_pct']}%, P={r['pressure_kpa']} kPa, "
        f"flow={r['flow_velocity_cm_s']} cm/s, diluent={r['diluent_gas']} -> "
        f"regime={r['combustion_regime']}, spread/burn={r.get('spread_or_burn_rate')}, "
        f"LOI={r.get('limiting_oxygen_index_pct')}%, peak_flux={r.get('peak_radiative_flux_kw_m2')} kW/m2 "
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
    gravity = None
    if "lunar" in q or "0.16" in q:
        gravity = 0.16
    elif "mars" in q or "0.38" in q:
        gravity = 0.38
    elif "1g" in q or "earth" in q:
        gravity = 1.0

    rows = await tk.runs.list(
        ExperimentFilters(
            program=Program(program) if program else None,
            fuel_material=FuelMaterial(material) if material else None,
            combustion_regime=CombustionRegime(regime) if regime else None,
            gravity_g=gravity,
        )
    )

    # Prefer low-flow runs when user asks about ventilation / flow
    if "ventilation" in q or "flow" in q:
        rows.sort(key=lambda r: (r["program"] != "BASS-II", abs(float(r["flow_velocity_cm_s"]) - 7.0)))
    elif "artemis" in q or "34%" in q or "56.5" in q:
        rows.sort(key=lambda r: abs(float(r["oxygen_pct"]) - 34.0) + abs(float(r["pressure_kpa"]) - 56.5))

    return [_run_item(r, round(0.95 - 0.05 * idx, 3)) for idx, r in enumerate(rows[:5])]


async def sql_tool_node(state: GraphState, tk: RagToolkit) -> dict[str, Any]:
    existing = list(state.get("evidence") or [])
    new_items = await run_sql_tool(state["question"], tk)
    seen = {e["id"] for e in existing}
    merged = existing + [e for e in new_items if e["id"] not in seen]
    return {"evidence": merged}


__all__ = ["MATERIALS", "PROGRAMS", "REGIMES", "run_sql_tool", "sql_tool_node"]
