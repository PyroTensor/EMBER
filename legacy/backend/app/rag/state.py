"""LangGraph state definition for the EMBER Grounded RAG pipeline."""
from __future__ import annotations

from typing import Any, Literal, TypedDict

RouteKind = Literal["facts", "search", "compare", "out_of_scope"]


class EvidenceItem(TypedDict, total=False):
    id: str
    kind: Literal["chunk", "test_run", "ranked_run"]
    source: Literal["sql_tool", "hybrid_retriever", "scenario_ranker"]
    score: float
    text: str
    doc_id: str | None
    page: int | None
    experiment_id: str | None


class CitationItem(TypedDict):
    id: str
    kind: Literal["doc", "experiment"]
    doc_id: str | None
    page: int | None
    experiment_id: str | None
    snippet: str


class GraphState(TypedDict, total=False):
    question: str
    original_question: str
    scenario: dict[str, Any] | None
    route: RouteKind
    evidence: list[EvidenceItem]
    grade: Literal["enough", "weak"]
    rewrites: int
    answer: str
    supported: bool
    citations: list[CitationItem]
    dropped_claims: list[str]
    trace_id: str
