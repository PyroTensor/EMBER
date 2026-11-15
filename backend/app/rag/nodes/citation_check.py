"""LangGraph Node - Citation check: verifies every claim against retrieved chunks & test runs.

Splits ``answer`` into sentences with the bullet/newline-aware ``split_sentences``. Every sentence (when
``supported=True``) must contain at least one ``[DOC-XX p.Y]`` or ``[EXP-XXXX]`` citation, and every cited
``(doc_id, page)`` or ``experiment_id`` must exist in ``state["evidence"]``. Unverified sentences are stripped
and logged in ``dropped_claims``.
"""

from __future__ import annotations

from typing import Any

from app.core.constants import NO_DATA_MESSAGE
from app.rag.citations import DOC_CITE, EXP_CITE, split_sentences
from app.rag.nodes.answer_generator import _synthesize_heuristic
from app.rag.state import CitationItem, EvidenceItem, GraphState
from app.rag.toolkit import RagToolkit


def verify_and_extract_citations(
    answer: str,
    evidence: list[EvidenceItem],
    supported: bool,
) -> tuple[str, bool, list[CitationItem], list[str]]:
    if not supported:
        return answer, False, [], []

    valid_docs: dict[tuple[str, int], str] = {}
    doc_canon: dict[tuple[str, int], tuple[str, str]] = {}
    valid_exps: dict[str, tuple[str | None, int | None, str]] = {}
    exp_canon: dict[str, tuple[str, str | None, int | None, str]] = {}
    for e in evidence:
        if e.get("doc_id") and e.get("page"):
            canon_doc = str(e["doc_id"])
            page_num = int(e["page"] or 0)
            snippet = e["text"][:280]
            valid_docs[(canon_doc, page_num)] = snippet
            doc_canon[(canon_doc.lower(), page_num)] = (canon_doc, snippet)
        if e.get("experiment_id"):
            canon_eid = str(e["experiment_id"])
            val = (e.get("doc_id"), e.get("page"), e["text"][:280])
            valid_exps[canon_eid] = val
            exp_canon[canon_eid.lower()] = (canon_eid, *val)

    sentences = split_sentences(answer)
    kept: list[str] = []
    dropped: list[str] = []
    citations: dict[str, CitationItem] = {}

    for sent in sentences:
        doc_matches = DOC_CITE.findall(sent)
        exp_matches = EXP_CITE.findall(sent)
        if not doc_matches and not exp_matches:
            dropped.append(sent)
            continue

        resolved_docs: list[tuple[str, int, str]] = []
        all_valid = True
        for doc_id, page_s in doc_matches:
            page = int(page_s)
            hit = doc_canon.get((doc_id.lower(), page))
            if hit is None:
                all_valid = False
                break
            resolved_docs.append((hit[0], page, hit[1]))

        resolved_exps: list[tuple[str, str | None, int | None, str]] = []
        if all_valid:
            for eid in exp_matches:
                ehit = exp_canon.get(eid.lower())
                if ehit is None:
                    all_valid = False
                    break
                resolved_exps.append(ehit)

        if not all_valid:
            dropped.append(sent)
            continue

        # Normalize tag casing inside the sentence so UI chips and eval always match canonical IDs
        norm_sent = DOC_CITE.sub(
            lambda m: f"[{doc_canon[(m.group(1).lower(), int(m.group(2)))][0]} p.{int(m.group(2))}]",
            sent,
        )
        norm_sent = EXP_CITE.sub(
            lambda m: f"[{exp_canon[m.group(1).lower()][0]}]",
            norm_sent,
        )
        kept.append(norm_sent)

        for canon_doc, page, snippet in resolved_docs:
            label = f"[{canon_doc} p.{page}]"
            citations[label] = {
                "id": label,
                "kind": "doc",
                "doc_id": canon_doc,
                "page": page,
                "experiment_id": None,
                "snippet": snippet,
            }
        for canon_eid, exp_doc_id, exp_page, snippet in resolved_exps:
            label = f"[{canon_eid}]"
            citations[label] = {
                "id": label,
                "kind": "experiment",
                "doc_id": exp_doc_id,
                "page": exp_page,
                "experiment_id": canon_eid,
                "snippet": snippet,
            }

    if not kept:
        return NO_DATA_MESSAGE, False, [], dropped
    return " ".join(kept), True, list(citations.values()), dropped


async def citation_check_node(state: GraphState, tk: RagToolkit) -> dict[str, Any]:
    evidence = state.get("evidence") or []
    was_supported = bool(state.get("supported"))
    ans, sup, cites, dropped = verify_and_extract_citations(
        state.get("answer", ""),
        evidence,
        was_supported,
    )
    if not sup and was_supported and evidence and state.get("route") != "out_of_scope":
        fallback_ans, fallback_sup = _synthesize_heuristic(
            state.get("original_question") or state["question"],
            evidence,
            scenario=state.get("scenario"),
        )
        if fallback_sup:
            ans, sup, cites, _ = verify_and_extract_citations(fallback_ans, evidence, True)
    return {
        "answer": ans,
        "supported": sup,
        "citations": cites,
        "dropped_claims": dropped,
    }


__all__ = ["citation_check_node", "verify_and_extract_citations"]
