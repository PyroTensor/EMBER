"""LangGraph Node - Evidence grader: enough relevant sources to answer?

If not enough relevant chunks/runs are present (and rewrites < ``RAG_MAX_REWRITES``), the graph triggers
``rewrite_query``.
"""

from __future__ import annotations

import re
from typing import Any, Literal

from app.rag.state import GraphState
from app.rag.toolkit import RagToolkit


def grade_evidence(state: GraphState) -> Literal["enough", "weak"]:
    if state.get("route") == "out_of_scope":
        return "enough"  # go straight to answer_generator which will return 'no data'

    evidence = state.get("evidence") or []
    chunks = [e for e in evidence if e["kind"] == "chunk"]
    runs = [e for e in evidence if e["kind"] in ("test_run", "ranked_run")]

    q_words = {w for w in re.findall(r"[a-z0-9-]+", state["question"].lower()) if len(w) > 3}
    corpus_text = " ".join(e["text"].lower() for e in evidence)
    overlap = sum(1 for w in q_words if w in corpus_text)

    if (len(chunks) >= 1 and overlap >= 1) or len(runs) >= 2:
        return "enough"
    return "weak"


async def evidence_grader_node(state: GraphState, tk: RagToolkit) -> dict[str, Any]:
    return {"grade": grade_evidence(state)}


__all__ = ["evidence_grader_node", "grade_evidence"]
