"""LangGraph Node 1 - Router: classifies question into facts | search | compare | out_of_scope."""

from __future__ import annotations

import re
from typing import Any, Final

from app.rag.prompts import load_prompt
from app.rag.scope import DOMAIN_KEYWORDS, OUT_OF_SCOPE_HINTS
from app.rag.state import GraphState, RouteKind
from app.rag.toolkit import RagToolkit

COMPARE_PATTERNS: Final = re.compile(
    r"\b(compare|versus|vs\.?|difference between|artemis|lunar|mars|1g|0g|scenario|habitat|rank|"
    r"closest|similar to|iss cabin|iss standard|this cabin|my cabin|cabin configuration)\b",
    re.IGNORECASE,
)
FACTS_PATTERNS: Final = re.compile(
    r"\b(exp-\d{4}|how many|count|list all|which experiment|what is the spread|what was the loi|"
    r"table of|happened in experiment|combustion regime of)\b",
    re.IGNORECASE,
)
_LLM_ROUTES: Final[tuple[RouteKind, ...]] = ("out_of_scope", "compare", "facts", "search")


async def classify_question(question: str, tk: RagToolkit, has_scenario: bool = False) -> RouteKind:
    q = question.lower().strip()
    tokens = set(re.findall(r"[a-z0-9_-]+", q))

    if any(h in q for h in OUT_OF_SCOPE_HINTS) and not (tokens & DOMAIN_KEYWORDS):
        return "out_of_scope"
    if not (tokens & DOMAIN_KEYWORDS) and not re.search(r"exp-\d+", q) and not has_scenario:
        return "out_of_scope"

    if has_scenario:
        return "compare"
    if FACTS_PATTERNS.search(q):
        return "facts"
    if COMPARE_PATTERNS.search(q):
        return "compare"

    if tk.llm.name != "heuristic":
        out = (await tk.llm.complete(load_prompt("router"), question)).lower()
        for r in _LLM_ROUTES:
            if r in out:
                return r

    return "search"


async def router_node(state: GraphState, tk: RagToolkit) -> dict[str, Any]:
    q = state["question"]
    route = await classify_question(q, tk, has_scenario=bool(state.get("scenario")))
    return {
        "original_question": state.get("original_question") or q,
        "route": route,
        "rewrites": state.get("rewrites", 0),
    }


__all__ = ["COMPARE_PATTERNS", "FACTS_PATTERNS", "classify_question", "router_node"]
