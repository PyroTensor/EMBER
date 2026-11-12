"""LangGraph state machine wiring for the 'Flame in Freefall' RAG query flow (diagram section 2).

Flow:
  router
    |-- out_of_scope --> answer_generator --> citation_check --> END
    |-- facts ---------> sql_tool --> hybrid_retriever --> evidence_grader
    |-- search --------> hybrid_retriever --> sql_tool --> evidence_grader
    |-- compare -------> scenario_ranker --> hybrid_retriever --> sql_tool --> evidence_grader
  evidence_grader
    |-- weak (and rewrites < 2) --> rewrite_query --> router
    |-- enough -------------------> answer_generator --> citation_check --> END
"""
from __future__ import annotations

import uuid
from functools import lru_cache
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

MAX_REWRITES = 2


def _route_after_router(state: GraphState) -> str:
    r = state.get("route", "search")
    if r == "out_of_scope":
        return "answer_generator"
    if r == "facts":
        return "sql_tool"
    if r == "compare":
        return "scenario_ranker"
    return "hybrid_retriever"


def _route_after_grader(state: GraphState) -> str:
    if state.get("grade") == "weak" and int(state.get("rewrites") or 0) < MAX_REWRITES:
        return "rewrite_query"
    return "answer_generator"


@lru_cache(maxsize=1)
def build_rag_graph():
    g = StateGraph(GraphState)
    g.add_node("router", router_node)
    g.add_node("sql_tool", sql_tool_node)
    g.add_node("hybrid_retriever", hybrid_retriever_node)
    g.add_node("scenario_ranker", scenario_ranker_node)
    g.add_node("evidence_grader", evidence_grader_node)
    g.add_node("rewrite_query", rewrite_query_node)
    g.add_node("answer_generator", answer_generator_node)
    g.add_node("citation_check", citation_check_node)

    g.set_entry_point("router")
    g.add_conditional_edges(
        "router",
        _route_after_router,
        {
            "sql_tool": "sql_tool",
            "hybrid_retriever": "hybrid_retriever",
            "scenario_ranker": "scenario_ranker",
            "answer_generator": "answer_generator",
        },
    )

    # Retrieval chain feeds into evidence_grader
    g.add_edge("scenario_ranker", "hybrid_retriever")
    g.add_edge("hybrid_retriever", "sql_tool")
    g.add_edge("sql_tool", "evidence_grader")

    g.add_conditional_edges(
        "evidence_grader",
        _route_after_grader,
        {
            "rewrite_query": "rewrite_query",
            "answer_generator": "answer_generator",
        },
    )
    g.add_edge("rewrite_query", "router")
    g.add_edge("answer_generator", "citation_check")
    g.add_edge("citation_check", END)
    return g.compile()


def ask_rag(question: str, scenario: dict[str, Any] | None = None) -> GraphState:
    graph = build_rag_graph()
    tid = f"tr-{uuid.uuid4().hex[:10]}"
    out: GraphState = graph.invoke({
        "question": question,
        "original_question": question,
        "scenario": scenario,
        "evidence": [],
        "rewrites": 0,
        "trace_id": tid,
    })
    out["trace_id"] = tid
    return out
