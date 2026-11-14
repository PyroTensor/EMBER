"""``GET /api/documents`` and ``GET /api/documents/{doc_id}`` schemas."""

from __future__ import annotations

from pydantic import Field

from app.schemas.common import APIModel


class DocumentSection(APIModel):
    section: str
    text: str


class DocumentPage(APIModel):
    page: int
    sections: list[DocumentSection] = Field(default_factory=list)


class DocumentSummary(APIModel):
    doc_id: str
    title: str
    source_type: str
    investigation: str | None = None
    url: str | None = None
    sources: list[str] = Field(default_factory=list)
    page_count: int


class DocumentDetail(DocumentSummary):
    pages: list[DocumentPage] = Field(default_factory=list)
    related_experiment_ids: list[str] = Field(default_factory=list)


__all__ = ["DocumentDetail", "DocumentPage", "DocumentSection", "DocumentSummary"]
