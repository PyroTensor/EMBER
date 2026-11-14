"""``GET /api/documents`` and ``GET /api/documents/{doc_id}``."""

from __future__ import annotations

from fastapi import APIRouter

from app.api.deps import DocumentServiceDep
from app.schemas.common import error_responses
from app.schemas.document import DocumentDetail, DocumentSummary

router = APIRouter(tags=["documents"])


@router.get(
    "/documents",
    response_model=list[DocumentSummary],
    summary="All source documents and papers in the corpus",
    responses=error_responses(422, 500),
)
async def list_documents(service: DocumentServiceDep) -> list[DocumentSummary]:
    return await service.list_all()


@router.get(
    "/documents/{doc_id}",
    response_model=DocumentDetail,
    summary="Full multi-page content and metadata for one source document",
    responses=error_responses(404, 422, 500),
)
async def get_document(doc_id: str, service: DocumentServiceDep) -> DocumentDetail:
    return await service.get(doc_id)
