"""Grounded SI Fire-Safety Co-Pilot endpoints (Module 4)."""
from __future__ import annotations

from typing import Optional

from fastapi import APIRouter
from pydantic import BaseModel, Field

from app.rag.graph import ask_rag
from ember_data.schema import CabinConfig

router = APIRouter(tags=["copilot"])


class AskRequest(BaseModel):
    question: str = Field(min_length=1)
    scenario: Optional[CabinConfig] = None


@router.post("/api/copilot/ask")
def post_copilot_ask(req: AskRequest) -> dict:
    scenario_dict = req.scenario.model_dump() if req.scenario else None
    state = ask_rag(req.question, scenario=scenario_dict)
    return {
        "answer": state.get("answer", ""),
        "route": state.get("route", "search"),
        "supported": bool(state.get("supported")),
        "rewrites": int(state.get("rewrites") or 0),
        "citations": state.get("citations") or [],
        "evidence": state.get("evidence") or [],
        "dropped_claims": state.get("dropped_claims") or [],
        "trace_id": state.get("trace_id", ""),
    }

# TODO(squad2-B): POST /api/copilot/compliance-brief -> generate downloadable NASA-STD-6001B Markdown/PDF brief
