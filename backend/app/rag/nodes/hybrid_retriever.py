"""LangGraph Tool Node - Hybrid retriever: BM25 + pgvector cosine -> Reciprocal Rank Fusion.

The fusion itself lives in the injected ``ChunkSearcher``; a ``None`` embedding (null embedder) means
keyword-only retrieval.
TODO(squad2-A): add cross-encoder reranker (e.g. BAAI/bge-reranker-base) on top-20 before slicing top-k.
"""

from __future__ import annotations

from typing import Any

from app.rag.state import EvidenceItem, GraphState
from app.rag.toolkit import RagToolkit


async def retrieve_hybrid(question: str, tk: RagToolkit) -> list[EvidenceItem]:
    q_emb = await tk.embedder.embed_query(question)
    hits = await tk.chunks.hybrid_search(question, q_emb, top_n=tk.settings.RAG_TOP_K)
    items: list[EvidenceItem] = []
    for h in hits:
        cid = f"{h['doc_id']}:p{h['page']}"
        items.append(
            {
                "id": cid,
                "kind": "chunk",
                "source": "hybrid_retriever",
                "score": float(h.get("score") or 0.0),
                "text": f"[{h['doc_id']} p.{h['page']} - {h.get('section', '')}] {h['text']}",
                "doc_id": h["doc_id"],
                "page": int(h["page"]),
                "experiment_id": None,
            }
        )
    return items


async def hybrid_retriever_node(state: GraphState, tk: RagToolkit) -> dict[str, Any]:
    existing = list(state.get("evidence") or [])
    new_items = await retrieve_hybrid(state["question"], tk)
    seen = {e["id"] for e in existing}
    return {"evidence": existing + [e for e in new_items if e["id"] not in seen]}


__all__ = ["hybrid_retriever_node", "retrieve_hybrid"]
