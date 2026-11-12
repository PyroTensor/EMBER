"""LangGraph Node 1 - Router: classifies question into facts | search | compare | out_of_scope."""
from __future__ import annotations

import re

from app.llm.provider import get_llm_provider
from app.rag.state import GraphState, RouteKind

DOMAIN_KEYWORDS = {
    "flame", "fire", "burn", "combustion", "oxygen", "o2", "loi", "pressure", "kpa", "psia",
    "flow", "ventilation", "hvac", "microgravity", "0g", "1g", "gravity", "lunar", "mars",
    "artemis", "iss", "bass", "bass-ii", "sofie", "flex", "acme", "pmma", "nomex", "cotton",
    "fiberglass", "sibal", "heptane", "methanol", "droplet", "cool", "radiative", "flux",
    "extinguish", "ignition", "spread", "diluent", "co2", "helium", "argon", "nitrogen",
    "nasa", "6001b", "spacecraft", "cabin", "habitat", "exp-", "doc-", "soot", "standoff",
}

OUT_OF_SCOPE_HINTS = {
    "stock", "bitcoin", "weather", "recipe", "football", "soccer", "movie", "hotel", "flight ticket",
    "tax", "kubernetes", "react", "javascript", "poem", "joke", "capital of",
}

COMPARE_PATTERNS = re.compile(
    r"\b(compare|versus|vs\.?|difference between|artemis|lunar|mars|1g|0g|scenario|habitat|rank)\b",
    re.IGNORECASE,
)
FACTS_PATTERNS = re.compile(
    r"\b(exp-\d{4}|how many|count|list all|which experiment|what is the spread|what was the loi|"
    r"table of|happened in experiment)\b",
    re.IGNORECASE,
)


def classify_question(question: str, has_scenario: bool = False) -> RouteKind:
    q = question.lower().strip()
    tokens = set(re.findall(r"[a-z0-9_-]+", q))

    if any(h in q for h in OUT_OF_SCOPE_HINTS) and not (tokens & DOMAIN_KEYWORDS):
        return "out_of_scope"
    if not (tokens & DOMAIN_KEYWORDS) and not re.search(r"exp-\d+", q):
        return "out_of_scope"

    prov = get_llm_provider()
    if prov.name != "heuristic":
        out = prov.complete(
            "Classify the microgravity combustion question into exactly one token: "
            "facts, search, compare, or out_of_scope.",
            question,
        ).lower()
        for r in ("out_of_scope", "compare", "facts", "search"):
            if r in out:
                return r  # type: ignore[return-value]

    if has_scenario or COMPARE_PATTERNS.search(q):
        return "compare"
    if FACTS_PATTERNS.search(q):
        return "facts"
    return "search"


def router_node(state: GraphState) -> dict:
    q = state["question"]
    route = classify_question(q, has_scenario=bool(state.get("scenario")))
    return {
        "original_question": state.get("original_question") or q,
        "route": route,
        "rewrites": state.get("rewrites", 0),
    }
