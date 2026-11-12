"""``POST /api/copilot/ask``."""

from __future__ import annotations

from fastapi import APIRouter

from app.api.deps import CopilotServiceDep
from app.schemas.common import error_responses
from app.schemas.copilot import AskRequest, AskResponse

router = APIRouter(tags=["copilot"])


@router.post(
    "/copilot/ask",
    response_model=AskResponse,
    summary="Grounded RAG question answering (LangGraph)",
    responses=error_responses(422, 500, 503, 504),
)
async def ask(req: AskRequest, service: CopilotServiceDep) -> AskResponse:
    return await service.ask(req)
