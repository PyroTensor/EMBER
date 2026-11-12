"""LangGraph Tool Node - Hybrid retriever: BM25 + pgvector cosine -> Reciprocal Rank Fusion.

TODO(squad2-A): add cross-encoder reranker (e.g. BAAI/bge-reranker-base) on top-20 before slicing top-k.
"""
from __future__ import annotations

from app.db.session import hybrid_search_chunks
from app.rag.state import EvidenceItem, GraphState


def _try_embed(query: str) -> list[float] | None:
    try:
        from ember_data.ingestion.chunk_embed import embed_query

        return embed_query(query)
    except Exception:
        return None


def retrieve_hybrid(question: str, top_k: int = 5) -> list[EvidenceItem]:
    q_emb = _try_embed(question)
    hits = hybrid_search_chunks(question, query_embedding=q_emb, top_k=top_k)
    items: list[EvidenceItem] = []
    for h in hits:
        cid = f"{h['doc_id']}:p{h['page']}"
        items.append({
            "id": cid,
            "kind": "chunk",
            "source": "hybrid_retriever",
            "score": float(h.get("rrf_score") or 0.0),
            "text": f"[{h['doc_id']} p.{h['page']} - {h.get('section', '')}] {h['text']}",
            "doc_id": h["doc_id"],
            "page": int(h["page"]),
            "experiment_id": None,
        })
    return items


def hybrid_retriever_node(state: GraphState) -> dict:
    existing = list(state.get("evidence") or [])
    new_items = retrieve_hybrid(state["question"])
    seen = {e["id"] for e in existing}
    return {"evidence": existing + [e for e in new_items if e["id"] not in seen]}
