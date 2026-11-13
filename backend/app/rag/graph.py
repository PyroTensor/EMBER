"""LangGraph state machine for the grounded RAG query flow (architecture board, section 2).

Flow:
  router
    |-- out_of_scope --> answer_generator
    |-- facts ---------> sql_tool
    |-- search --------> hybrid_retriever
    |-- compare -------> scenario_ranker --> hybrid_retriever
  hybrid_retriever
    |-- facts -----------------------> evidence_grader   (sql_tool already ran for this pass)
    |-- otherwise -------------------> sql_tool
  sql_tool
    |-- facts and no chunk evidence --> hybrid_retriever  (context.md §10.3: fact answers can cite docs too)
    |-- otherwise --------------------> evidence_grader
  evidence_grader
    |-- weak and rewrites < RAG_MAX_REWRITES --> rewrite_query --> router
    |-- otherwise ----------------------------> answer_generator --> citation_check --> END

Each node is ``async def node(state, tk)`` bound to the request's ``RagToolkit`` with ``functools.partial``,
so the graph is built per request and no node touches a session or a global.
"""

from __future__ import annotations

import uuid
from functools import partial
from typing import Any

from langgraph.graph import END, StateGraph

from app.rag.nodes.answer_generator import answer_generator_node
from app.rag.nodes.citation_check import citation_check_node
from app.rag.nodes.evidence_grader import evidence_grader_node
from app.rag.nodes.hybrid_retriever import hybrid_retriever_node
from app.rag.nodes.rewrite_query import rewrite_query_node
from app.rag.nodes.router import router_node
from app.rag.nodes.scenario_ranker import scenario_ranker_node
from app.rag.nodes.sql_tool import sql_tool_node
from app.rag.state import GraphState
from app.rag.toolkit import RagToolkit


def _after_router(state: GraphState) -> str:
    r = state.get("route", "search")
    if r == "out_of_scope":
        return "answer_generator"
    if r == "facts":
        return "sql_tool"
    if r == "compare":
        return "scenario_ranker"
    return "hybrid_retriever"


def _after_hybrid(state: GraphState) -> str:
    return "evidence_grader" if state.get("route") == "facts" else "sql_tool"


def _after_sql(state: GraphState) -> str:
    has_chunks = any(e["kind"] == "chunk" for e in state.get("evidence") or [])
    if state.get("route") == "facts" and not has_chunks:
        return "hybrid_retriever"
    return "evidence_grader"


def build_graph(tk: RagToolkit) -> Any:
    max_rewrites = tk.settings.RAG_MAX_REWRITES

    def _after_grader(state: GraphState) -> str:
        if state.get("grade") == "weak" and int(state.get("rewrites") or 0) < max_rewrites:
            return "rewrite_query"
        return "answer_generator"

    g = StateGraph(GraphState)
    g.add_node("router", partial(router_node, tk=tk))
    g.add_node("sql_tool", partial(sql_tool_node, tk=tk))
    g.add_node("hybrid_retriever", partial(hybrid_retriever_node, tk=tk))
    g.add_node("scenario_ranker", partial(scenario_ranker_node, tk=tk))
    g.add_node("evidence_grader", partial(evidence_grader_node, tk=tk))
    g.add_node("rewrite_query", partial(rewrite_query_node, tk=tk))
    g.add_node("answer_generator", partial(answer_generator_node, tk=tk))
    g.add_node("citation_check", partial(citation_check_node, tk=tk))

    g.set_entry_point("router")
    g.add_conditional_edges(
        "router",
        _after_router,
        {n: n for n in ("sql_tool", "hybrid_retriever", "scenario_ranker", "answer_generator")},
    )
    g.add_edge("scenario_ranker", "hybrid_retriever")
    g.add_conditional_edges(
        "hybrid_retriever", _after_hybrid, {"sql_tool": "sql_tool", "evidence_grader": "evidence_grader"}
    )
    g.add_conditional_edges(
        "sql_tool", _after_sql, {"hybrid_retriever": "hybrid_retriever", "evidence_grader": "evidence_grader"}
    )
    g.add_conditional_edges(
        "evidence_grader",
        _after_grader,
        {"rewrite_query": "rewrite_query", "answer_generator": "answer_generator"},
    )
    g.add_edge("rewrite_query", "router")
    g.add_edge("answer_generator", "citation_check")
    g.add_edge("citation_check", END)
    return g.compile()


async def run(tk: RagToolkit, question: str, scenario: dict[str, Any] | None = None) -> GraphState:
    """Run the graph once and return the final state (``trace_id`` = ``tr-<uuid10>``)."""
    tid = f"tr-{uuid.uuid4().hex[:10]}"
    initial: GraphState = {
        "question": question,
        "original_question": question,
        "scenario": scenario,
        "evidence": [],
        "rewrites": 0,
        "trace_id": tid,
    }
    out: GraphState = await build_graph(tk).ainvoke(initial)
    out["trace_id"] = tid
    return out


__all__ = ["build_graph", "run"]
