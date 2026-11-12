"""``chunks``: retrievable text passages with a dense embedding and a generated full-text vector."""

from __future__ import annotations

from typing import Any

from pgvector.sqlalchemy import Vector
from sqlalchemy import BigInteger, Computed, ForeignKey, Identity, Index, Integer, Text
from sqlalchemy.dialects.postgresql import JSONB, TSVECTOR
from sqlalchemy.orm import Mapped, mapped_column

from app.core.constants import EMBED_DIM
from app.db.base import Base


class Chunk(Base):
    __tablename__ = "chunks"
    # Mirrors migration 0003 so autogenerate / `alembic check` sees no drift.
    __table_args__ = (
        Index(
            "ix_chunks_embedding",
            "embedding",
            postgresql_using="hnsw",
            postgresql_with={"m": 16, "ef_construction": 64},
            postgresql_ops={"embedding": "vector_cosine_ops"},
        ),
        Index("ix_chunks_tsv", "tsv", postgresql_using="gin"),
        Index("ix_chunks_metadata", "metadata", postgresql_using="gin"),
    )

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
