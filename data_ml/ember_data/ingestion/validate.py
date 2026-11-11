"""Stage 5 - Validate: range checks, missing-field flags, human review of the top 15.

* Hard failures (schema/range/enum violations) -> row rejected, reported.
* Soft flags (missing optional outputs, physics inconsistencies) -> row kept with
  `review_flags`; the 15 most-flagged rows are written to data_ml/review_queue.csv
  for a teammate to eyeball before demo.
"""
from __future__ import annotations

import csv
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

from pydantic import ValidationError

from ember_data.physics.combustion import limiting_oxygen_index
from ember_data.schema import TestRun

REVIEW_QUEUE = Path(__file__).resolve().parents[2] / "review_queue.csv"
OPTIONAL_OUTPUTS = ("spread_or_burn_rate", "peak_radiative_flux_kw_m2", "limiting_oxygen_index_pct", "burn_duration_s")
REVIEW_TOP_N = 15


@dataclass
class ValidationReport:
    valid: list[TestRun] = field(default_factory=list)
    flags: dict[str, list[str]] = field(default_factory=dict)       # experiment_id -> soft flags
    rejected: list[dict[str, Any]] = field(default_factory=list)    # {row, errors}

    def summary(self) -> str:
        flagged = sum(1 for f in self.flags.values() if f)
        return f"{len(self.valid)} valid, {len(self.rejected)} rejected, {flagged} flagged for review"


def soft_flags(run: TestRun) -> list[str]:
    flags = [f"missing:{k}" for k in OPTIONAL_OUTPUTS if getattr(run, k) is None]
    try:
        model_loi = limiting_oxygen_index(run.fuel_material, run.gravity_g, run.pressure_kpa,
                                          run.flow_velocity_cm_s, run.diluent_gas)
        if run.combustion_regime == "Sustained Burn" and run.oxygen_pct < model_loi - 3:
            flags.append("physics:burn_below_model_loi")
        if run.combustion_regime == "No Ignition" and run.oxygen_pct > model_loi + 5:
            flags.append("physics:no_ignition_far_above_model_loi")
    except KeyError:
        flags.append("physics:unknown_material")
    if run.combustion_regime == "No Ignition" and (run.spread_or_burn_rate or 0) > 0:
        flags.append("consistency:no_ignition_with_spread")
    return flags


def validate_rows(rows: list[dict[str, Any]], write_queue: bool = True) -> ValidationReport:
    rep = ValidationReport()
    for row in rows:
        try:
            run = TestRun(**row)
        except ValidationError as e:
            rep.rejected.append({"row": row, "errors": [f"{'.'.join(map(str, err['loc']))}: {err['msg']}" for err in e.errors()]})
            continue
        rep.valid.append(run)
        rep.flags[run.experiment_id] = soft_flags(run)

    if write_queue:
        top = sorted(rep.flags.items(), key=lambda kv: len(kv[1]), reverse=True)[:REVIEW_TOP_N]
        with REVIEW_QUEUE.open("w", newline="") as fh:
            w = csv.writer(fh)
            w.writerow(["experiment_id", "n_flags", "flags", "reviewed_by", "decision"])
            for eid, fl in top:
                if fl:
                    w.writerow([eid, len(fl), ";".join(fl), "", ""])
            for rej in rep.rejected:
                w.writerow([rej["row"].get("experiment_id", "?"), "REJECTED", ";".join(rej["errors"]), "", ""])
    return rep
