"""LangGraph Node - Evidence grader: enough relevant sources to answer?

If not enough relevant chunks/runs are present (and rewrites < 2), triggers `rewrite_query`.
"""
from __future__ import annotations

import re

from app.rag.state import GraphState


def grade_evidence(state: GraphState) -> str:
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


def evidence_grader_node(state: GraphState) -> dict:
    return {"grade": grade_evidence(state)}
