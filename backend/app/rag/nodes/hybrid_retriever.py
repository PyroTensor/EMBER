"""LangGraph Tool Node - Hybrid retriever: BM25 + pgvector cosine -> Reciprocal Rank Fusion.

The fusion itself lives in the injected ``ChunkSearcher``; a ``None`` embedding (null embedder) means
keyword-only retrieval.
TODO(squad2-A): add cross-encoder reranker (e.g. BAAI/bge-reranker-base) on top-20 before slicing top-k.
"""

from __future__ import annotations

import re
from typing import Any, Final

from app.rag.state import EvidenceItem, GraphState
from app.rag.toolkit import RagToolkit

_STOPWORDS: Final[frozenset[str]] = frozenset(
    {
        "the",
        "and",
        "for",
        "with",
        "that",
        "this",
        "from",
        "into",
        "what",
        "does",
        "how",
        "why",
        "which",
        "when",
        "where",
        "are",
        "was",
        "were",
        "can",
        "could",
        "make",
        "more",
        "than",
        "about",
        "have",
        "has",
        "been",
        "they",
        "their",
        "them",
        "under",
        "over",
        "between",
    }
)
_AUTHORITY_PREFIXES: Final[tuple[str, ...]] = (
    "BASS-II_SRD",
    "BASS_SRD",
    "ISS-",
    "NASA_researchers-guide",
    "NASA_",
    "ACME_CFI-G_Final_Report",
    "DOC-",
)
_TOPIC_EXPANSIONS: Final[tuple[tuple[re.Pattern[str], str], ...]] = (
    (
        re.compile(r"\b(ventilation|low-speed|low speed|forced flow|airflow|fan)\b", re.I),
        "BASS-II forced flow velocity burn better than normal gravity oxygen transport",
    ),
    (
        re.compile(r"\b(artemis|34%|56\.5|exploration atmosphere)\b", re.I),
        "SoFIE Saffire exploration atmosphere 34% O2 56.5 kPa flammability flame spread normoxic",
    ),
    (
        re.compile(r"\b(cool flame|heptane|droplet|two-stage|invisible)\b", re.I),
        "FLEX CFI cool flame two-stage autoignition heptane droplet radiative extinction low-temperature",
    ),
    (
        re.compile(r"\b(iss cabin|space station|21%|101\.3)\b", re.I),
        "ISS cabin 21% O2 101.3 kPa BASS-II sustained burn limiting oxygen index",
    ),
    (
        re.compile(r"\b(saffire|large-scale|spacecraft fire)\b", re.I),
        "Saffire spacecraft fire safety Cygnus flame spread large-scale",
    ),
)


def _strip_proxy_banner(text: str) -> str:
    """Remove internal '> PROXY ...' editorial disclaimers from retrieved chunk text."""
    lines = [ln for ln in text.splitlines() if not ln.lstrip().startswith(">")]
    return "\n".join(lines).strip()


def _expand_search_query(question: str) -> str:
    extras = [exp for pat, exp in _TOPIC_EXPANSIONS if pat.search(question)]
    if not extras:
        return question
    return f"{question} {' '.join(extras)}"


def _rerank_score(hit: dict[str, Any], cleaned: str, q_terms: set[str]) -> float:
    base = float(hit.get("score") or 0.0)
    doc_id = str(hit.get("doc_id") or "")
    low = cleaned.lower()
    if q_terms:
        hits = sum(1 for t in q_terms if t in low)
        cov = hits / len(q_terms)
    else:
        cov = 0.0
    auth_bonus = 0.0
    if doc_id.startswith(_AUTHORITY_PREFIXES):
        auth_bonus = 0.012
    elif doc_id.startswith(("PSI-", "NTRS-")):
        auth_bonus = 0.006
    penalty = 0.0
    if len(cleaned) < 120 or "|" in cleaned[:80] or "table of contents" in low:
        penalty = 0.015
    return base + 0.014 * cov + auth_bonus - penalty


async def retrieve_hybrid(question: str, tk: RagToolkit) -> list[EvidenceItem]:
    expanded = _expand_search_query(question)
    q_emb = await tk.embedder.embed_query(expanded)
    raw_hits = await tk.chunks.hybrid_search(expanded, q_emb, top_n=max(tk.settings.RAG_TOP_K * 6, 30))

    q_terms = {w for w in re.findall(r"[a-z0-9-]+", question.lower()) if len(w) > 2 and w not in _STOPWORDS}

    scored: list[tuple[float, dict[str, Any], str]] = []
    for h in raw_hits:
        doc_id = str(h["doc_id"])
        meta = h.get("metadata") or {}
        if meta.get("source_type") == "psi_dataset" or "-TABLE" in doc_id.upper():
            continue
        cleaned = _strip_proxy_banner(str(h["text"]))
        if not cleaned:
            continue
        scored.append((_rerank_score(h, cleaned, q_terms), h, cleaned))

    scored.sort(key=lambda item: item[0], reverse=True)

    by_page: dict[str, EvidenceItem] = {}
    per_doc_counts: dict[str, int] = {}
    seen_sigs: set[str] = set()

    for rscore, h, cleaned in scored:
        doc_id = str(h["doc_id"])
        page = int(h["page"])
        cid = f"{doc_id}:p{page}"
        sig = re.sub(r"[^a-z0-9]+", "", cleaned.lower())[:160]
        if sig and sig in seen_sigs and cid not in by_page:
            continue
        section = h.get("section", "")
        formatted = f"[{doc_id} p.{page} - {section}] {cleaned}"
        if cid in by_page:
            by_page[cid]["text"] = f"{by_page[cid]['text']}\n{formatted}"
            by_page[cid]["score"] = max(by_page[cid]["score"], rscore)
        else:
            if len(by_page) >= tk.settings.RAG_TOP_K:
                continue
            if per_doc_counts.get(doc_id, 0) >= 2:
                continue
            if sig:
                seen_sigs.add(sig)
            per_doc_counts[doc_id] = per_doc_counts.get(doc_id, 0) + 1
            by_page[cid] = {
                "id": cid,
                "kind": "chunk",
                "source": "hybrid_retriever",
                "score": rscore,
                "text": formatted,
                "doc_id": doc_id,
                "page": page,
                "experiment_id": None,
            }
    return list(by_page.values())


async def hybrid_retriever_node(state: GraphState, tk: RagToolkit) -> dict[str, Any]:
    existing = list(state.get("evidence") or [])
    query = state["question"]

    # Enrich query with run metadata when sql_tool ran first for a specific EXP-XXXX
    exp_hints: list[str] = []
    for e in existing:
        if e.get("kind") == "test_run" and e.get("doc_id"):
            m = re.search(r"\(([^)]+)\)", e.get("text", ""))
            if m:
                exp_hints.append(f"{e['doc_id']} {m.group(1)}")
    if exp_hints:
        query = f"{query} {' '.join(exp_hints[:2])}"
    elif scenario := state.get("scenario"):
        query = (
            f"{query} {scenario.get('fuel_material', '')} "
            f"{scenario.get('oxygen_pct', '')}% O2 {scenario.get('pressure_kpa', '')} kPa "
            f"{scenario.get('gravity_g', '')}g {scenario.get('flow_velocity_cm_s', '')} cm/s"
        )

    new_items = await retrieve_hybrid(query, tk)
    seen = {e["id"] for e in existing}
    return {"evidence": existing + [e for e in new_items if e["id"] not in seen]}


__all__ = ["hybrid_retriever_node", "retrieve_hybrid"]
