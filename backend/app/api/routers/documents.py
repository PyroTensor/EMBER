"""``GET /api/documents``, ``GET /api/documents/{doc_id}``, and ``GET /api/documents/{doc_id}/download``."""

from __future__ import annotations

from fastapi import APIRouter
from fastapi.responses import FileResponse, Response

from app.api.deps import DocumentServiceDep, TestRunReaderDep
from app.schemas.common import error_responses
from app.schemas.document import DocumentDetail, DocumentSummary

router = APIRouter(tags=["documents"])


@router.get(
    "/documents",
    response_model=list[DocumentSummary],
    summary="All source documents and papers in the corpus",
    responses=error_responses(422, 500),
)
async def list_documents(service: DocumentServiceDep, q: str | None = None) -> list[DocumentSummary]:
    return await service.list_all(q=q)


@router.get(
    "/documents/{doc_id}",
    response_model=DocumentDetail,
    summary="Full multi-page content and metadata for one source document",
    responses=error_responses(404, 422, 500),
)
async def get_document(doc_id: str, service: DocumentServiceDep) -> DocumentDetail:
    return await service.get(doc_id)


@router.get(
    "/documents/{doc_id}/download",
    summary="Download original PDF, CSV table, or Markdown export for a source document",
    responses={
        200: {"description": "Binary PDF, CSV, or Markdown file attachment"},
        **error_responses(404, 422, 500),
    },
)
async def download_document(
    doc_id: str,
    service: DocumentServiceDep,
    runs: TestRunReaderDep,
) -> Response:
    payload = await service.prepare_download(doc_id, runs_reader=runs)
    headers = {"Content-Disposition": f'attachment; filename="{payload.filename}"'}
    if payload.file_path is not None:
        return FileResponse(
            path=payload.file_path,
            media_type=payload.media_type,
            filename=payload.filename,
        )
    return Response(
        content=payload.content or b"",
        media_type=payload.media_type,
        headers=headers,
    )
