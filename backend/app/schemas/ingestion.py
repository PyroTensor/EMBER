"""Internal ingestion DTOs, ported from ``legacy/data_ml/ember_data/schema.py`` (same fields and defaults)."""

from __future__ import annotations

from enum import StrEnum
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field

from app.schemas.enums import Program


class Investigation(BaseModel):
    id: str
    program: Program
    title: str
    summary: str = ""
    source_doc_id: str | None = None


class PageTable(BaseModel):
    """A structured table found on one page (PDF ``find_tables`` or a markdown pipe table)."""

    page: int  # 1-based
    header: list[str]
    rows: list[list[str | None]]


class Document(BaseModel):
    """A parsed source document (NTRS paper, ISS page): output of the parse stage."""

    doc_id: str
    title: str
    source_type: Literal["ntrs", "iss_page", "psi_dataset"]
    path: str
    metadata: dict[str, Any] = Field(default_factory=dict)
    pages: list[str]  # pages[i] is the text of page i+1
    tables: list[PageTable] = Field(default_factory=list)


class FindingCategory(StrEnum):
    """Kinds of microgravity-combustion data that fit no other table (``combustion_findings``)."""

    FLAMMABILITY_LIMIT = "flammability_limit"
    EXTINCTION = "extinction"
    IGNITION = "ignition"
    FLAME_SPREAD = "flame_spread"
    BURNING_RATE = "burning_rate"
    SOOT_RADIATION = "soot_radiation"
    FLAME_STRUCTURE = "flame_structure"
    MATERIAL_PROPERTY = "material_property"
    FIRE_SAFETY = "fire_safety"
    OUT_OF_SCHEMA_RUN = "out_of_schema_run"
    OTHER = "other"


class GravityContext(StrEnum):
    MICROGRAVITY = "microgravity"
    PARTIAL_GRAVITY = "partial_gravity"  # lunar / martian / reduced
    NORMAL_G_BASELINE = "normal_g_baseline"  # 1 g comparison data, only next to microgravity context


class CombustionFinding(BaseModel):
    """One microgravity/reduced-gravity combustion result that is not a schema_v1 run (I10)."""

    model_config = ConfigDict(frozen=True)

    finding_id: str  # sha256(fingerprint)[:16]
    category: FindingCategory
    gravity_context: GravityContext
    statement: str  # 1 sentence, <= 400 chars
    subject: str | None = None  # material / fuel / apparatus, verbatim
    program: str | None = None  # free text (any program, not only the Program enum)
    investigation_id: str | None = None  # set by code only when program maps to a known Program
    quantity: str | None = None
    value_num: float | None = None
    value_text: str | None = None
    unit: str | None = None
    conditions: dict[str, float | str] = Field(default_factory=dict)  # canonical keys only
    origin: Literal["llm", "table", "csv_reject"]
    source_doc_id: str | None = None  # docs: set by code, never by the LLM
    source_page: int | None = None
    source_file: str | None = None  # csv_reject
    source_row: int | None = None
    evidence_quote: str | None = None
    quote_found: bool | None = None
    confidence: float = Field(ge=0, le=1)
    relevance: float = Field(ge=0, le=1)
    extraction: dict[str, str] = Field(default_factory=dict)  # {provider, model, prompt_version}
    review_flags: list[str] = Field(default_factory=list)


class Chunk(BaseModel):
    doc_id: str
    page: int
    section: str
    text: str
    metadata: dict[str, Any] = Field(default_factory=dict)
    embedding: list[float] | None = None


__all__ = [
    "Chunk",
    "CombustionFinding",
    "Document",
    "FindingCategory",
    "GravityContext",
    "Investigation",
    "PageTable",
]
