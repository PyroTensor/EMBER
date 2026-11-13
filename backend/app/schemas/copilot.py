"""``POST /api/copilot/ask``: grounded RAG question answering."""

from __future__ import annotations

from pydantic import Field

from app.schemas.cabin import CabinConfig
from app.schemas.common import APIModel
from app.schemas.enums import CitationKind, EvidenceKind, EvidenceSource, Route


class AskRequest(APIModel):
    question: str = Field(min_length=1, max_length=2000)
    scenario: CabinConfig | None = None


class Citation(APIModel):
    id: str = Field(description="Label used inline in the answer, e.g. '[DOC-02 p.3]' or '[EXP-0012]'")
    kind: CitationKind
    doc_id: str | None = None
    page: int | None = None
    experiment_id: str | None = None
    snippet: str


class Evidence(APIModel):
    id: str
    kind: EvidenceKind
    source: EvidenceSource = Field(description="Node that produced it")
    score: float
    text: str
    doc_id: str | None = None
    page: int | None = None
    experiment_id: str | None = None


class AskResponse(APIModel):
    answer: str
    route: Route
    supported: bool = Field(description="false when the graph answered 'no data'")
    rewrites: int = Field(ge=0)
    citations: list[Citation] = Field(default_factory=list)
    evidence: list[Evidence] = Field(default_factory=list)
    dropped_claims: list[str] = Field(default_factory=list, description="Sentences removed by citation_check")
    trace_id: str


__all__ = ["AskRequest", "AskResponse", "Citation", "Evidence"]
