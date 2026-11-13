"""``documents`` table access (write side; read methods arrive in B6.1)."""

from __future__ import annotations

from app.models.document import Document
from app.repositories.base import SqlRepository


class PgDocumentRepository(SqlRepository[Document]):
    model = Document
    conflict_cols = ("doc_id",)


__all__ = ["PgDocumentRepository"]
