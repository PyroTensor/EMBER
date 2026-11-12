"""``chunks``: retrievable text passages with a dense embedding and a generated full-text vector."""

from __future__ import annotations

from typing import Any

from pgvector.sqlalchemy import Vector
from sqlalchemy import BigInteger, Computed, ForeignKey, Identity, Integer, Text
from sqlalchemy.dialects.postgresql import JSONB, TSVECTOR
from sqlalchemy.orm import Mapped, mapped_column

from app.core.constants import EMBED_DIM
from app.db.base import Base


class Chunk(Base):
    __tablename__ = "chunks"

    id: Mapped[int] = mapped_column(BigInteger, Identity(), primary_key=True)
    doc_id: Mapped[str] = mapped_column(ForeignKey("documents.doc_id", ondelete="CASCADE"), index=True)
    page: Mapped[int] = mapped_column(Integer)
    section: Mapped[str | None] = mapped_column(Text)
    text: Mapped[str] = mapped_column(Text)
    metadata_: Mapped[dict[str, Any]] = mapped_column("metadata", JSONB, default=dict)
    embedding: Mapped[list[float] | None] = mapped_column(Vector(EMBED_DIM))
    tsv: Mapped[str] = mapped_column(
        TSVECTOR,
        Computed("to_tsvector('english', coalesce(section, '') || ' ' || text)", persisted=True),
    )
