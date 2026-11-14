"""LangGraph Tool Node - Scenario ranker: scores test runs vs habitat O2, pressure, flow & gravity."""

from __future__ import annotations

import re
from collections.abc import Mapping
from typing import Any

from app.domain.ranking.scenario_ranker import rank_runs
from app.rag.state import GraphState
from app.rag.toolkit import RagToolkit


def _infer_scenario_from_question(question: str, explicit: dict[str, Any] | None) -> dict[str, Any]:
    if explicit:
        return dict(explicit)
    q = question.lower()
    cfg: dict[str, Any] = {
        "oxygen_pct": 21.0,
        "pressure_kpa": 101.3,
        "flow_velocity_cm_s": 10.0,
        "gravity_g": 0.0,
        "fuel_material": "Cotton-Fiberglass",
        "diluent_gas": "N2",
    }
    if "artemis" in q or "34%" in q or "56.5" in q:
        cfg.update({"oxygen_pct": 34.0, "pressure_kpa": 56.5, "flow_velocity_cm_s": 10.0})
    elif "mars" in q or "0.38" in q:
        cfg.update({"oxygen_pct": 26.5, "pressure_kpa": 70.3, "flow_velocity_cm_s": 5.0, "gravity_g": 0.38})
    if "lunar" in q or "0.16" in q:
        cfg.update({"oxygen_pct": 34.0, "pressure_kpa": 56.5, "flow_velocity_cm_s": 5.0, "gravity_g": 0.16})
    if "1g" in q or "earth" in q:
        cfg["gravity_g"] = 1.0

    for mat in ("PMMA", "Nomex", "Heptane", "Methanol", "Cotton-Fiberglass"):
        if mat.lower() in q:
            cfg["fuel_material"] = mat
    if "sibal" in q or "cotton" in q:
        cfg["fuel_material"] = "Cotton-Fiberglass"
    if "cool flame" in q or "droplet" in q:
        cfg.update({"fuel_material": "Heptane", "flow_velocity_cm_s": 0.0})

    m_o2 = re.search(r"(\d+(?:\.\d+)?)\s*%\s*(?:o2|oxygen)", q)
    if m_o2:
        cfg["oxygen_pct"] = float(m_o2.group(1))
    m_kpa = re.search(r"(\d+(?:\.\d+)?)\s*kpa", q)
    if m_kpa:
        cfg["pressure_kpa"] = float(m_kpa.group(1))
    m_flow = re.search(r"(\d+(?:\.\d+)?)\s*cm/s", q)
    if m_flow:
        cfg["flow_velocity_cm_s"] = float(m_flow.group(1))
    return cfg


def _format_ranked_run(r: Any) -> str:
    rec = r.record
    details: list[str] = []
    if rec.get("limiting_oxygen_index_pct") is not None:
        details.append(f"LOI={rec['limiting_oxygen_index_pct']}%")
    if rec.get("spread_or_burn_rate") is not None:
        details.append(f"rate={rec['spread_or_burn_rate']}")
    if rec.get("peak_radiative_flux_kw_m2") is not None:
        details.append(f"peak_flux={rec['peak_radiative_flux_kw_m2']} kW/m2")
    suffix = f" ({', '.join(details)})" if details else ""
    return (
        f"{r.experiment_id} (rank #{r.rank}, score={r.total_score:.1f} [sim={r.similarity:.0f}, "
        f"comp={r.completeness:.0f}, crit={r.criticality:.0f}]): {rec['program']} "
        f"{rec['fuel_material']} ({rec.get('fuel_geometry', '')}) at {rec['gravity_g']}g, "
        f"{rec['oxygen_pct']}% O2, {rec['pressure_kpa']} kPa, {rec['flow_velocity_cm_s']} cm/s -> "
        f"{rec['combustion_regime']}{suffix}"
    )


async def scenario_ranker_node(state: GraphState, tk: RagToolkit) -> dict[str, Any]:
    explicit = state.get("scenario")
    cfg = _infer_scenario_from_question(state["question"], explicit)
    all_runs: list[Mapping[str, Any]] = list(await tk.runs.all_for_ranking())

    if not explicit:
        q = state["question"].lower()
        for mat in ("PMMA", "Nomex", "Heptane", "Methanol", "Cotton-Fiberglass"):
            if mat.lower() in q:
                mat_runs: list[Mapping[str, Any]] = [r for r in all_runs if r.get("fuel_material") == mat]
                if len(mat_runs) >= 2:
                    all_runs = mat_runs
                break

    top = rank_runs(all_runs, cfg, limit=4)

    existing = list(state.get("evidence") or [])
    seen = {e["id"] for e in existing}
    for r in top:
        if r.experiment_id in seen:
            continue
        rec = r.record
        existing.append(
            {
                "id": r.experiment_id,
                "kind": "ranked_run",
                "source": "scenario_ranker",
                "score": round(r.total_score / 100.0, 3),
                "text": _format_ranked_run(r),
                "doc_id": rec.get("source_doc_id"),
                "page": rec.get("source_page"),
                "experiment_id": r.experiment_id,
            }
        )
    return {"evidence": existing}


__all__ = ["scenario_ranker_node"]
