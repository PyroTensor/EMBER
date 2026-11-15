"""LangGraph Node 1 - Router: classifies question into facts | search | compare | out_of_scope."""

from __future__ import annotations

import logging
import re
from typing import Any, Final

from app.rag.citations import RUN_ID_MENTION
from app.rag.prompts import load_prompt
from app.rag.scope import looks_in_scope
from app.rag.state import GraphState, RouteKind
from app.rag.toolkit import RagToolkit

logger = logging.getLogger(__name__)

COMPARE_PATTERNS: Final = re.compile(
    r"\b(compare|versus|vs\.?|difference between|closest|similar to|nearest|rank|ranking|"
    r"match|this cabin|my cabin|iss cabin|iss standard|cabin configuration|which runs|which tests)\b",
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

    if not looks_in_scope(q) and not RUN_ID_MENTION.search(q) and not has_scenario:
        return "out_of_scope"

    if has_scenario:
        return "compare"
    if RUN_ID_MENTION.search(q) or FACTS_PATTERNS.search(q):
        return "facts"
    if COMPARE_PATTERNS.search(q):
        return "compare"

    if tk.llm.name != "heuristic":
        try:
            out = (await tk.llm.complete(load_prompt("router"), question)).lower()
            for r in _LLM_ROUTES:
                if r in out:
                    return r
        except Exception:
            logger.warning("router LLM call failed; falling back to search", exc_info=True)

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
