"""Internal ingestion DTOs, ported from ``legacy/data_ml/ember_data/schema.py`` (same fields and defaults)."""

from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel, Field

from app.schemas.enums import Program


class Investigation(BaseModel):
    id: str
    program: Program
    title: str
    summary: str = ""
    source_doc_id: str | None = None


class PageTable(BaseModel):
    """A structured table found on one page (PDF ``find_tables`` or a markdown pipe table)."""

    page: int  # 1-based
    header: list[str]
    rows: list[list[str | None]]


class Document(BaseModel):
    """A parsed source document (NTRS paper, ISS page): output of the parse stage."""

    doc_id: str
    title: str
    source_type: Literal["ntrs", "iss_page", "psi_dataset"]
    path: str
    metadata: dict[str, Any] = Field(default_factory=dict)
    pages: list[str]  # pages[i] is the text of page i+1
    tables: list[PageTable] = Field(default_factory=list)


class Chunk(BaseModel):
    doc_id: str
    page: int
    section: str
    text: str
    metadata: dict[str, Any] = Field(default_factory=dict)
    embedding: list[float] | None = None


__all__ = ["Chunk", "Document", "Investigation", "PageTable"]
