"""``POST /api/copilot/ask`` use case: run the grounded RAG graph, map its final state to ``AskResponse``."""

from __future__ import annotations

import asyncio

from app.core.exceptions import UpstreamTimeoutError
from app.rag import graph
from app.rag.state import GraphState
from app.rag.toolkit import RagToolkit
from app.schemas.copilot import AskRequest, AskResponse, Citation, Evidence


class CopilotService:
    def __init__(self, tk: RagToolkit) -> None:
        self._tk = tk

    async def ask(self, req: AskRequest) -> AskResponse:
        scenario = req.scenario.model_dump(mode="json") if req.scenario else None
        timeout_s = self._tk.settings.RAG_TIMEOUT_S
        try:
            async with asyncio.timeout(timeout_s):
                state = await graph.run(self._tk, req.question, scenario)
        except TimeoutError as exc:
            raise UpstreamTimeoutError(
                f"The Co-Pilot did not answer within {timeout_s:g} s", details={"timeout_s": timeout_s}
            ) from exc
        return _to_response(state)


def _to_response(state: GraphState) -> AskResponse:
    return AskResponse.model_validate(
        {
            "answer": state.get("answer", ""),
            "route": state.get("route", "out_of_scope"),
            "supported": bool(state.get("supported")),
            "rewrites": int(state.get("rewrites") or 0),
            "citations": [Citation.model_validate(c) for c in state.get("citations") or []],
            "evidence": [Evidence.model_validate(e) for e in state.get("evidence") or []],
            "dropped_claims": list(state.get("dropped_claims") or []),
            "trace_id": state["trace_id"],
        }
    )


__all__ = ["CopilotService"]
