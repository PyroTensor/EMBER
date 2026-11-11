"""LangGraph Node - Citation check: verifies every claim against retrieved chunks & test runs.

Parses sentences from `answer`. Every sentence (when `supported=True`) must contain at least
one `[DOC-XX p.Y]` or `[EXP-XXXX]` citation, and every cited `(doc_id, page)` or `experiment_id`
must exist in `state["evidence"]`. Unverified sentences are stripped and logged in `dropped_claims`.
"""
from __future__ import annotations

import re

from app.rag.nodes.answer_generator import NO_DATA_MESSAGE
from app.rag.state import CitationItem, EvidenceItem, GraphState

DOC_CITE = re.compile(r"\[([A-Za-z0-9_-]+)\s+p\.(\d+)\]")
EXP_CITE = re.compile(r"\[(EXP-\d{4})\]")


def verify_and_extract_citations(
    answer: str,
    evidence: list[EvidenceItem],
    supported: bool,
) -> tuple[str, bool, list[CitationItem], list[str]]:
    if not supported:
        return answer, False, [], []

    valid_docs: dict[tuple[str, int], str] = {}
    valid_exps: dict[str, tuple[str | None, int | None, str]] = {}
    for e in evidence:
        if e.get("doc_id") and e.get("page"):
            valid_docs[(str(e["doc_id"]), int(e["page"]))] = e["text"][:280]
        if e.get("experiment_id"):
            valid_exps[str(e["experiment_id"])] = (e.get("doc_id"), e.get("page"), e["text"][:280])

    sentences = [s.strip() for s in re.split(r"(?<=[.!?])\s+", answer.strip()) if s.strip()]
    kept: list[str] = []
    dropped: list[str] = []
    citations: dict[str, CitationItem] = {}

    for sent in sentences:
        doc_matches = DOC_CITE.findall(sent)
        exp_matches = EXP_CITE.findall(sent)
        if not doc_matches and not exp_matches:
            dropped.append(sent)
            continue

        all_valid = True
        for doc_id, page_s in doc_matches:
            key = (doc_id, int(page_s))
            if key not in valid_docs:
                all_valid = False
                break
        for eid in exp_matches:
            if eid not in valid_exps:
                all_valid = False
                break

        if not all_valid:
            dropped.append(sent)
            continue

        kept.append(sent)
        for doc_id, page_s in doc_matches:
            page = int(page_s)
            label = f"[{doc_id} p.{page}]"
            citations[label] = {
                "id": label,
                "kind": "doc",
                "doc_id": doc_id,
                "page": page,
                "experiment_id": None,
                "snippet": valid_docs[(doc_id, page)],
            }
        for eid in exp_matches:
            label = f"[{eid}]"
            doc_id, page, snippet = valid_exps[eid]
            citations[label] = {
                "id": label,
                "kind": "experiment",
                "doc_id": doc_id,
                "page": page,
                "experiment_id": eid,
                "snippet": snippet,
            }

    if not kept:
        return NO_DATA_MESSAGE, False, [], dropped
    return " ".join(kept), True, list(citations.values()), dropped


def citation_check_node(state: GraphState) -> dict:
    ans, sup, cites, dropped = verify_and_extract_citations(
        state.get("answer", ""),
        state.get("evidence") or [],
        bool(state.get("supported")),
    )
    return {
        "answer": ans,
        "supported": sup,
        "citations": cites,
        "dropped_claims": dropped,
    }
