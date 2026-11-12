"""LangGraph Tool Node - Scenario ranker: scores test runs vs habitat O2, pressure, flow & gravity."""
from __future__ import annotations

import re
from typing import Any

from app.db.session import list_test_runs
from app.rag.state import EvidenceItem, GraphState
from ember_data.ranking.scenario_ranker import rank_runs


def _infer_scenario_from_question(question: str, explicit: dict[str, Any] | None) -> dict[str, Any]:
    if explicit:
        return explicit
    q = question.lower()
    cfg: dict[str, Any] = {
        "oxygen_pct": 21.0,
        "pressure_kpa": 101.3,
        "flow_velocity_cm_s": 8.0,
        "gravity_g": 0.0,
        "fuel_material": "Cotton-Fiberglass",
        "diluent_gas": "N2",
    }
    if "artemis" in q or "34%" in q or "56.5" in q:
        cfg.update({"oxygen_pct": 34.0, "pressure_kpa": 56.5})
    elif "mars" in q:
        cfg.update({"oxygen_pct": 26.5, "pressure_kpa": 70.3, "gravity_g": 0.38})
    if "lunar" in q or "0.16" in q:
        cfg["gravity_g"] = 0.16
    if "1g" in q or "earth" in q:
        cfg["gravity_g"] = 1.0

    for mat in ("PMMA", "Nomex", "Heptane", "Methanol", "Cotton-Fiberglass"):
        if mat.lower() in q:
            cfg["fuel_material"] = mat
    if "cool flame" in q or "droplet" in q:
        cfg.update({"fuel_material": "Heptane", "flow_velocity_cm_s": 0.0})

    m_o2 = re.search(r"(\d+(?:\.\d+)?)\s*%\s*o2", q)
    if m_o2:
        cfg["oxygen_pct"] = float(m_o2.group(1))
    return cfg


def scenario_ranker_node(state: GraphState) -> dict:
    cfg = _infer_scenario_from_question(state["question"], state.get("scenario"))
    runs = list_test_runs(readonly=True)
    top = rank_runs(runs, cfg, limit=4)

    existing = list(state.get("evidence") or [])
    seen = {e["id"] for e in existing}
    for r in top:
        if r.experiment_id in seen:
            continue
        rec = r.record
        existing.append({
            "id": r.experiment_id,
            "kind": "ranked_run",
            "source": "scenario_ranker",
            "score": round(r.total_score / 100.0, 3),
            "text": (
                f"{r.experiment_id} (rank #{r.rank}, score={r.total_score:.1f} [sim={r.similarity:.0f}, "
                f"comp={r.completeness:.0f}, crit={r.criticality:.0f}]): {rec['program']} {rec['fuel_material']} "
                f"at {rec['gravity_g']}g, {rec['oxygen_pct']}% O2, {rec['pressure_kpa']} kPa, "
                f"{rec['flow_velocity_cm_s']} cm/s -> {rec['combustion_regime']} "
                f"(LOI={rec.get('limiting_oxygen_index_pct')}%, rate={rec.get('spread_or_burn_rate')})"
            ),
            "doc_id": rec.get("source_doc_id"),
            "page": rec.get("source_page"),
            "experiment_id": r.experiment_id,
        })
    return {"evidence": existing}
