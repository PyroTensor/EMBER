"""LangGraph Node - Rewrite query: expands weak queries with NASA microgravity combustion synonyms.

Never rewrites more than ``RAG_MAX_REWRITES`` times; past the limit the node is a no-op.
"""

from __future__ import annotations

from typing import Any, Final

from app.rag.prompts import load_prompt
from app.rag.state import GraphState
from app.rag.toolkit import RagToolkit

EXPANSIONS: Final[dict[str, str]] = {
    "fan": "forced flow velocity ventilation",
    "airflow": "forced flow velocity ventilation BASS-II",
    "ventilation": "low-speed forced flow LOI BASS-II",
    "invisible": "cool flame radiative extinction FLEX heptane",
    "moon": "Lunar 0.16g partial gravity NASA-STD-6001B",
    "artemis": "exploration atmosphere 34% O2 56.5 kPa SoFIE",
    "fabric": "Cotton-Fiberglass SIBAL Nomex solid fuel",
    "plastic": "PMMA solid fuel spread rate",
    "apollo": "Apollo 1 Apollo 13 pure oxygen cabin fire lessons learned",
    "mir": "Space Station Mir 1997 Vika oxygen generator fire smoke",
    "saffire": "Saffire large-scale spacecraft fire safety SoFIE",
    "smoke": "SAME DAFT smoke detector aerosol dust discrimination",
    "spinoff": "firefighter SCBA air tank turnout gear smoke detector spinoff",
}


async def rewrite_query_node(state: GraphState, tk: RagToolkit) -> dict[str, Any]:
    rewrites = int(state.get("rewrites") or 0)
    if rewrites >= tk.settings.RAG_MAX_REWRITES:
        return {}

    q = state["question"]
    if tk.llm.name != "heuristic":
        rewritten = await tk.llm.complete(load_prompt("rewrite"), q)
    else:
        extras = [exp for k, exp in EXPANSIONS.items() if k in q.lower()]
        rewritten = (
            f"{q} {' '.join(extras)}".strip() if extras else f"{q} microgravity combustion LOI flame spread"
        )

    return {
        "question": rewritten,
        "rewrites": rewrites + 1,
    }


__all__ = ["EXPANSIONS", "rewrite_query_node"]
