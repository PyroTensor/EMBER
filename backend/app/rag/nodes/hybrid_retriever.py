"""LangGraph Tool Node - Hybrid retriever: BM25 + pgvector cosine -> Reciprocal Rank Fusion.

The fusion itself lives in the injected ``ChunkSearcher``; a ``None`` embedding (null embedder) means
keyword-only retrieval.
TODO(squad2-A): add cross-encoder reranker (e.g. BAAI/bge-reranker-base) on top-20 before slicing top-k.
"""

from __future__ import annotations

import re
from typing import Any

from app.rag.state import EvidenceItem, GraphState
from app.rag.toolkit import RagToolkit


def _strip_proxy_banner(text: str) -> str:
    """Remove internal '> PROXY ...' editorial disclaimers from retrieved chunk text."""
    lines = [ln for ln in text.splitlines() if not ln.lstrip().startswith(">")]
    return "\n".join(lines).strip()


async def retrieve_hybrid(question: str, tk: RagToolkit) -> list[EvidenceItem]:
    q_emb = await tk.embedder.embed_query(question)
    hits = await tk.chunks.hybrid_search(question, q_emb, top_n=max(tk.settings.RAG_TOP_K * 2, 10))
    by_page: dict[str, EvidenceItem] = {}
    for h in hits:
        doc_id = str(h["doc_id"])
        page = int(h["page"])
        cid = f"{doc_id}:p{page}"
        cleaned = _strip_proxy_banner(str(h["text"]))
        if not cleaned:
            continue
        section = h.get("section", "")
        formatted = f"[{doc_id} p.{page} - {section}] {cleaned}"
        if cid in by_page:
            by_page[cid]["text"] = f"{by_page[cid]['text']}\n{formatted}"
            by_page[cid]["score"] = max(by_page[cid]["score"], float(h.get("score") or 0.0))
        else:
            if len(by_page) >= tk.settings.RAG_TOP_K:
                continue
            by_page[cid] = {
                "id": cid,
                "kind": "chunk",
                "source": "hybrid_retriever",
                "score": float(h.get("score") or 0.0),
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
