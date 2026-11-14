"""``GET /api/documents`` and ``GET /api/documents/{doc_id}`` use cases."""

from __future__ import annotations

from app.core.exceptions import NotFoundError
from app.repositories.interfaces import DocumentReader
from app.schemas.document import DocumentDetail, DocumentSummary


class DocumentService:
    def __init__(self, reader: DocumentReader) -> None:
        self._reader = reader

    async def list_all(self) -> list[DocumentSummary]:
        rows = await self._reader.list_all()
        return [DocumentSummary.model_validate(r) for r in rows]

    async def get(self, doc_id: str) -> DocumentDetail:
        doc = await self._reader.get_detail(doc_id)
        if doc is None:
            raise NotFoundError(
                f"No document with id '{doc_id}'",
                code="DOCUMENT_NOT_FOUND",
                details={"doc_id": doc_id},
            )
        return DocumentDetail.model_validate(doc)


__all__ = ["DocumentService"]
