"""Pydantic mirror of contracts/schema_v1.json + RAG storage models.

schema_v1.json is the source of truth. If you change one, change the other in the same PR
(tests/test_schema_sync.py checks the field lists match).
"""
from __future__ import annotations

from typing import Any, Literal, Optional

from pydantic import BaseModel, ConfigDict, Field

Program = Literal["BASS-II", "SoFIE", "FLEX", "ACME"]
FuelMaterial = Literal["PMMA", "Cotton-Fiberglass", "Nomex", "Heptane", "Methanol"]
FuelGeometry = Literal["Flat Sheet", "Rod", "Droplet", "Gaseous"]
Diluent = Literal["N2", "CO2", "He", "Ar"]
Regime = Literal["Sustained Burn", "Self-Extinguished", "Cool Flame", "No Ignition"]

CANONICAL_GRAVITY = {0.0: "Microgravity", 0.16: "Lunar", 0.38: "Mars", 1.0: "Earth"}


class TestRun(BaseModel):
    """One combustion test run (= one row of schema_v1)."""

    __test__ = False  # stop pytest from collecting this class
    model_config = ConfigDict(extra="forbid")

    experiment_id: str = Field(min_length=1)
    program: Program
    fuel_material: FuelMaterial
    fuel_geometry: FuelGeometry

    gravity_g: float = Field(ge=0.0, le=1.0)
    oxygen_pct: float = Field(ge=15.0, le=40.0)
    pressure_kpa: float = Field(ge=40.0, le=101.3)
    flow_velocity_cm_s: float = Field(ge=0.0, le=50.0)
    diluent_gas: Diluent

    combustion_regime: Regime
    spread_or_burn_rate: Optional[float] = Field(default=None, ge=0)
    peak_radiative_flux_kw_m2: Optional[float] = Field(default=None, ge=0)
    limiting_oxygen_index_pct: Optional[float] = Field(default=None, ge=0, le=100)
    burn_duration_s: Optional[float] = Field(default=None, ge=0)

    source_doc_id: Optional[str] = None
    source_page: Optional[int] = Field(default=None, ge=1)

    extra_telemetry: dict[str, Any] = Field(default_factory=dict)


class Investigation(BaseModel):
    id: str
    program: Program
    title: str
    summary: str = ""
    source_doc_id: Optional[str] = None


class CabinConfig(BaseModel):
    """A habitat / scenario to evaluate or rank against."""

    oxygen_pct: float = Field(ge=15.0, le=40.0)
    pressure_kpa: float = Field(ge=40.0, le=101.3)
    flow_velocity_cm_s: float = Field(ge=0.0, le=50.0)
    gravity_g: float = Field(ge=0.0, le=1.0)
    fuel_material: FuelMaterial = "Cotton-Fiberglass"
    diluent_gas: Diluent = "N2"


class Document(BaseModel):
    """A parsed source document (NTRS paper, ISS page) - output of parse.py."""

    doc_id: str
    title: str
    source_type: Literal["ntrs", "iss_page", "psi_dataset"]
    path: str
    metadata: dict[str, Any] = Field(default_factory=dict)
    pages: list[str]  # pages[i] is the text of page i+1


class Chunk(BaseModel):
    doc_id: str
    page: int
    section: str
    text: str
    metadata: dict[str, Any] = Field(default_factory=dict)
    embedding: Optional[list[float]] = None
