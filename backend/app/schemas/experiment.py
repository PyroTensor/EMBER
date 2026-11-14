"""``GET /api/experiments``: full schema_v1 rows and the query-parameter filters."""

from __future__ import annotations

from typing import Any

from pydantic import ConfigDict, Field

from app.schemas.common import APIModel
from app.schemas.enums import CombustionRegime, DiluentGas, FuelGeometry, FuelMaterial, Program


class TestRunRecord(APIModel):
    """One combustion test run = one row of ``contracts/schema_v1.json`` (``additionalProperties: false``)."""

    __test__ = False  # keep pytest from collecting this class
    model_config = ConfigDict(extra="forbid")

    # identity
    experiment_id: str = Field(min_length=1)
    program: Program
    fuel_material: FuelMaterial
    fuel_geometry: FuelGeometry

    # conditions
    gravity_g: float = Field(ge=0.0, le=1.0)
    oxygen_pct: float = Field(ge=10.0, le=60.0)
    pressure_kpa: float = Field(ge=20.0, le=150.0)
    flow_velocity_cm_s: float = Field(ge=0.0, le=50.0)
    diluent_gas: DiluentGas

    # outcome
    combustion_regime: CombustionRegime
    spread_or_burn_rate: float | None = Field(default=None, ge=0)
    peak_radiative_flux_kw_m2: float | None = Field(default=None, ge=0)
    limiting_oxygen_index_pct: float | None = Field(default=None, ge=0, le=100)
    burn_duration_s: float | None = Field(default=None, ge=0)

    # provenance
    source_doc_id: str | None = None
    source_page: int | None = Field(default=None, ge=1)

    # escape hatch: unmapped source columns
    extra_telemetry: dict[str, Any]


class ExperimentFilters(APIModel):
    """Optional query parameters for ``GET /api/experiments``; enums are validated."""

    model_config = ConfigDict(extra="forbid")

    program: Program | None = None
    fuel_material: FuelMaterial | None = None
    combustion_regime: CombustionRegime | None = None
    gravity_g: float | None = Field(default=None, ge=0.0, le=1.0)


__all__ = ["ExperimentFilters", "TestRunRecord"]
