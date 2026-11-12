"""``investigations``: parent NASA investigations (BASS-II, SoFIE, FLEX, ACME)."""

from __future__ import annotations

from sqlalchemy import Text
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class Investigation(Base):
    __tablename__ = "investigations"

    id: Mapped[str] = mapped_column(Text, primary_key=True)
    program: Mapped[str] = mapped_column(Text)
    title: Mapped[str] = mapped_column(Text)
    summary: Mapped[str | None] = mapped_column(Text)
    source_doc_id: Mapped[str | None] = mapped_column(Text)
