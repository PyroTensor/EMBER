"""``combustion_findings``: microgravity / reduced-gravity combustion data that fits no other table (I10).

Written only by the ingestion pipeline (snapshot + Postgres); not exposed through the API contract.
Provenance is either a document page (``source_doc_id`` + ``source_page``) or a CSV row
(``source_file`` + ``source_row``) - the CHECK constraint enforces one of the two.
"""

from __future__ import annotations

from typing import Any

from sqlalchemy import Boolean, CheckConstraint, Float, ForeignKey, Index, Integer, Text, text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base

PROVENANCE_CHECK = (
    "(source_doc_id IS NOT NULL AND source_page IS NOT NULL) "
    "OR (source_file IS NOT NULL AND source_row IS NOT NULL)"
)


class CombustionFinding(Base):
    __tablename__ = "combustion_findings"
    # Mirrors migration 0005.
    __table_args__ = (
        CheckConstraint(PROVENANCE_CHECK, name="provenance"),
        Index("ix_combustion_findings_conditions", "conditions", postgresql_using="gin"),
    )

    finding_id: Mapped[str] = mapped_column(Text, primary_key=True)
    category: Mapped[str] = mapped_column(Text, index=True)
    gravity_context: Mapped[str] = mapped_column(Text)
    statement: Mapped[str] = mapped_column(Text)
    subject: Mapped[str | None] = mapped_column(Text)
    program: Mapped[str | None] = mapped_column(Text)
    investigation_id: Mapped[str | None] = mapped_column(ForeignKey("investigations.id"))
    quantity: Mapped[str | None] = mapped_column(Text)
    value_num: Mapped[float | None] = mapped_column(Float)
    value_text: Mapped[str | None] = mapped_column(Text)
    unit: Mapped[str | None] = mapped_column(Text)
    conditions: Mapped[dict[str, Any]] = mapped_column(
        JSONB, default=dict, server_default=text("'{}'::jsonb")
    )
    origin: Mapped[str] = mapped_column(Text)  # llm | table | csv_reject

    # provenance
    source_doc_id: Mapped[str | None] = mapped_column(
        ForeignKey("documents.doc_id", ondelete="CASCADE"), index=True
    )
    source_page: Mapped[int | None] = mapped_column(Integer)
    source_file: Mapped[str | None] = mapped_column(Text)
    source_row: Mapped[int | None] = mapped_column(Integer)
    evidence_quote: Mapped[str | None] = mapped_column(Text)
    quote_found: Mapped[bool | None] = mapped_column(Boolean)

    confidence: Mapped[float] = mapped_column(Float)
    relevance: Mapped[float] = mapped_column(Float)
    extraction: Mapped[dict[str, Any]] = mapped_column(
        JSONB, default=dict, server_default=text("'{}'::jsonb")
    )
    review_flags: Mapped[list[str]] = mapped_column(JSONB, default=list, server_default=text("'[]'::jsonb"))
