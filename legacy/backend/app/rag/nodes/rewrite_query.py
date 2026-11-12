"""LangGraph Node - Rewrite query: expands weak queries with NASA microgravity combustion synonyms."""
from __future__ import annotations

from app.llm.provider import get_llm_provider
from app.rag.state import GraphState

EXPANSIONS = {
    "fan": "forced flow velocity ventilation",
    "airflow": "forced flow velocity ventilation BASS-II",
    "ventilation": "low-speed forced flow LOI BASS-II",
    "invisible": "cool flame radiative extinction FLEX heptane",
    "moon": "Lunar 0.16g partial gravity NASA-STD-6001B",
    "artemis": "exploration atmosphere 34% O2 56.5 kPa SoFIE",
    "fabric": "Cotton-Fiberglass SIBAL Nomex solid fuel",
    "plastic": "PMMA solid fuel spread rate",
}


def rewrite_query_node(state: GraphState) -> dict:
    q = state["question"]
    prov = get_llm_provider()
    if prov.name != "heuristic":
        rewritten = prov.complete(
            "Rewrite the user question using NASA microgravity combustion keywords "
            "(BASS-II, SoFIE, FLEX, ACME, LOI, forced flow, cool flame, O2 mole fraction). "
            "Output only the rewritten query.",
            q,
        )
    else:
        extras = [exp for k, exp in EXPANSIONS.items() if k in q.lower()]
        rewritten = f"{q} {' '.join(extras)}".strip() if extras else f"{q} microgravity combustion LOI flame spread"

    return {
        "question": rewritten,
        "rewrites": int(state.get("rewrites") or 0) + 1,
    }
