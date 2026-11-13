"""``GET /api/telemetry/{experiment_id}``: time-series curves for one run."""

from __future__ import annotations

from pydantic import ConfigDict

from app.schemas.common import APIModel


class Telemetry(APIModel):
    """Known channels are typed; any additional channel in the stored series is passed through."""

    model_config = ConfigDict(extra="allow")

    experiment_id: str
    time_s: list[float]
    flame_radius_mm: list[float]
    d_squared_mm2: list[float] | None = None  # droplet runs only
    radiative_heat_flux_kw_m2: list[float]
    flame_temp_k: list[float]


__all__ = ["Telemetry"]
