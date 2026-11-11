"""LangGraph Tool Node - SQL tool: read-only structured queries on investigations & test_runs.

Uses parameterized filter templates against the read-only Postgres role (`ember_ro`).
TODO(squad2-A): add constrained LLM text-to-SQL with AST validation (SELECT-only, table whitelist).
"""
from __future__ import annotations

import re

from app.db.session import list_test_runs
from app.rag.state import EvidenceItem, GraphState

PROGRAMS = {"bass-ii": "BASS-II", "bass": "BASS-II", "sofie": "SoFIE", "flex": "FLEX", "acme": "ACME"}
MATERIALS = {
    "pmma": "PMMA",
    "cotton-fiberglass": "Cotton-Fiberglass",
    "cotton": "Cotton-Fiberglass",
    "fiberglass": "Cotton-Fiberglass",
    "sibal": "Cotton-Fiberglass",
    "nomex": "Nomex",
    "heptane": "Heptane",
    "methanol": "Methanol",
}
REGIMES = {
    "cool flame": "Cool Flame",
    "cool flames": "Cool Flame",
    "self-extinguished": "Self-Extinguished",
    "extinguished": "Self-Extinguished",
    "no ignition": "No Ignition",
    "sustained burn": "Sustained Burn",
}


def _format_run(r: dict) -> str:
    return (
        f"{r['experiment_id']} ({r['program']}, {r['fuel_material']}, {r['fuel_geometry']}): "
        f"g={r['gravity_g']}g, O2={r['oxygen_pct']}%, P={r['pressure_kpa']} kPa, "
        f"flow={r['flow_velocity_cm_s']} cm/s, diluent={r['diluent_gas']} -> "
        f"regime={r['combustion_regime']}, spread/burn={r.get('spread_or_burn_rate')}, "
        f"LOI={r.get('limiting_oxygen_index_pct')}%, peak_flux={r.get('peak_radiative_flux_kw_m2')} kW/m2 "
        f"(source: {r.get('source_doc_id')} p.{r.get('source_page')})"
    )


def run_sql_tool(question: str) -> list[EvidenceItem]:
    q = question.lower()

    # 1. Explicit EXP-XXXX lookup
    exp_ids = [m.upper() for m in re.findall(r"exp-\d{4}", q)]
    if exp_ids:
        items: list[EvidenceItem] = []
        for eid in exp_ids:
            for r in list_test_runs(experiment_id=eid, readonly=True):
                items.append({
                    "id": r["experiment_id"],
                    "kind": "test_run",
                    "source": "sql_tool",
                    "score": 1.0,
                    "text": _format_run(r),
                    "doc_id": r.get("source_doc_id"),
                    "page": r.get("source_page"),
                    "experiment_id": r["experiment_id"],
                })
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

    rows = list_test_runs(
        program=program,
        fuel_material=material,
        combustion_regime=regime,
        gravity_g=gravity,
        readonly=True,
    )

    # Prefer low-flow runs when user asks about ventilation / flow
    if "ventilation" in q or "flow" in q:
        rows.sort(key=lambda r: (r["program"] != "BASS-II", abs(float(r["flow_velocity_cm_s"]) - 7.0)))
    elif "artemis" in q or "34%" in q or "56.5" in q:
        rows.sort(key=lambda r: abs(float(r["oxygen_pct"]) - 34.0) + abs(float(r["pressure_kpa"]) - 56.5))

    out: list[EvidenceItem] = []
    for idx, r in enumerate(rows[:5]):
        out.append({
            "id": r["experiment_id"],
            "kind": "test_run",
            "source": "sql_tool",
            "score": round(0.95 - 0.05 * idx, 3),
            "text": _format_run(r),
            "doc_id": r.get("source_doc_id"),
            "page": r.get("source_page"),
            "experiment_id": r["experiment_id"],
        })
    return out


def sql_tool_node(state: GraphState) -> dict:
    existing = list(state.get("evidence") or [])
    new_items = run_sql_tool(state["question"])
    seen = {e["id"] for e in existing}
    merged = existing + [e for e in new_items if e["id"] not in seen]
    return {"evidence": merged}
