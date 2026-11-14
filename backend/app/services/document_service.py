"""``GET /api/documents`` and ``GET /api/documents/{doc_id}`` use cases."""

from __future__ import annotations

import re

from app.core.exceptions import NotFoundError
from app.repositories.interfaces import DocumentReader
from app.schemas.document import DocumentDetail, DocumentSummary

_TOKEN = re.compile(r"[a-z0-9_.-]+")


def _matches_query(doc: DocumentSummary, query: str) -> bool:
    terms = [t for t in _TOKEN.findall(query.lower()) if t]
    if not terms:
        return True
    parts: list[str] = [
        doc.doc_id,
        doc.title,
        doc.source_type,
        doc.investigation or "",
        doc.url or "",
        *doc.sources,
        *doc.related_experiment_ids,
    ]
    for page in doc.pages:
        for sec in page.sections:
            parts.append(sec.section)
            parts.append(sec.text)
    haystack = " ".join(parts).lower()
    return any(t in haystack for t in terms)


class DocumentService:
    def __init__(self, reader: DocumentReader) -> None:
        self._reader = reader

    async def list_all(self, q: str | None = None) -> list[DocumentSummary]:
        rows = await self._reader.list_all()
        docs = [DocumentSummary.model_validate(r) for r in rows]
        if q and q.strip():
            docs = [d for d in docs if _matches_query(d, q)]
        return docs

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
