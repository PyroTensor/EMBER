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


RUNS_PROMPT_VERSION = "runs-v1"


class RunExtraction(BaseModel):
    experiment_id: str | None  # ONLY if a run/test id appears verbatim in the text
    program: str | None
    fuel_material: str | None
    fuel_geometry: str | None
    gravity_g: float | None
    oxygen_pct: float | None  # percent (mole fraction x100)
    pressure_kpa: float | None  # converted from psia/atm/mmHg
    flow_velocity_cm_s: float | None
    diluent_gas: str | None
    combustion_regime: str | None
    spread_or_burn_rate: float | None
    peak_radiative_flux_kw_m2: float | None
    limiting_oxygen_index_pct: float | None
    burn_duration_s: float | None
    confidence: float  # 0-1, model's own confidence that this is one real measured run
    evidence_quote: str  # <= 200 chars copied verbatim from the page (table row or sentence)


class PageRunsExtraction(BaseModel):
    runs: list[RunExtraction]


PAGE_PROMPT_VERSION = "page-v2"  # runs + findings in ONE page call (I10)


class FindingExtraction(BaseModel):
    """LLM-facing fields of a combustion finding (conditions flattened: no dicts in strict schemas)."""

    category: str  # flammability_limit | extinction | ignition | flame_spread | burning_rate | ...
    gravity_context: str  # microgravity | partial_gravity | normal_g_baseline
    statement: str  # 1 sentence, <= 400 chars: what was measured or observed
    subject: str | None
    program: str | None
    quantity: str | None
    value_num: float | None
    value_text: str | None
    unit: str | None
    oxygen_pct: float | None
    pressure_kpa: float | None
    gravity_g: float | None
    flow_velocity_cm_s: float | None
    diluent_gas: str | None
    fuel_geometry: str | None
    temperature_k: float | None
    evidence_quote: str  # <= 200 chars copied verbatim from the page
    confidence: float  # 0-1
    relevance: float  # 0-1: how clearly this is about combustion in micro-/reduced gravity
    is_microgravity_combustion: bool


class PageExtraction(BaseModel):
    runs: list[RunExtraction]
    findings: list[FindingExtraction]


OCR_PROMPT_VERSION = "ocr-v1"


class PageTranscription(BaseModel):
    text: str  # plain-text transcription of a scanned page image


__all__ = [
    "PAGE_PROMPT_VERSION",
    "FindingExtraction",
    "PageExtraction",
    "INV_PROMPT_VERSION",
    "OCR_PROMPT_VERSION",
    "PageTranscription",
    "RUNS_PROMPT_VERSION",
    "InvestigationExtraction",
    "PageRunsExtraction",
    "RunExtraction",
]
