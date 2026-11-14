"""LLM-facing extraction schemas (OpenAI-strict + Gemini compatible) and prompt versions.

Rules (see llm_clients.py): every field is required, no defaults, optional values are ``X | None``,
only str/float/int/bool/list/nested models. Bump a prompt version whenever its prompt or schema changes:
the version is part of the extraction cache key, so old cache entries miss cleanly.
"""

from __future__ import annotations

from pydantic import BaseModel

INV_PROMPT_VERSION = "inv-v1"


class InvestigationExtraction(BaseModel):
    program: str | None  # one of BASS-II, SoFIE, FLEX, ACME, Saffire, or null if none
    title: str | None
    summary: str | None  # <= 600 chars, 1-3 sentences, from the text only
    fuels: list[str]  # verbatim material names
    o2_pct_min: float | None
    o2_pct_max: float | None
    pressures_kpa: list[float]
    gravity_levels_g: list[float]
    evidence_page: int | None  # page the program evidence came from


__all__ = ["INV_PROMPT_VERSION", "InvestigationExtraction"]
