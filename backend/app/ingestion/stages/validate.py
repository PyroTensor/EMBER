"""Stage 5 - Validate: range checks, missing-field flags, human review of the top 15.

* Hard failures (schema/range/enum violations) -> row rejected, reported.
* Soft flags (missing optional outputs, physics inconsistencies, LLM extraction) -> row kept with
  `review_flags`; the 15 most-flagged rows are written to <CACHE_DIR>/review_queue.csv
  for a teammate to eyeball before demo. LLM-extracted rows carry `extraction:*` flags (non-missing flags,
  so they sort to the top) and the queue shows `source_doc_id` / `source_page` so a reviewer can find them.
"""

from __future__ import annotations

import csv
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

from pydantic import ValidationError

from app.core.config import get_settings
from app.domain.physics.combustion import MATERIAL_BASE_LOI, limiting_oxygen_index
from app.schemas.experiment import TestRunRecord

OPTIONAL_OUTPUTS = (
    "spread_or_burn_rate",
    "peak_radiative_flux_kw_m2",
    "limiting_oxygen_index_pct",
    "burn_duration_s",
)
REVIEW_TOP_N = 15
ENUM_FIELDS = frozenset({"program", "fuel_material", "fuel_geometry", "diluent_gas", "combustion_regime"})
_SURROGATE_FUELS = frozenset(
    {
        "cellulose",
        "ashless filter paper",
        "ultem",
        "ethanol",
        "iso-propanol",
        "n-octane",
        "decane",
        "n-decane",
        "toluene",
    }
)


def review_queue_path() -> Path:
    """``<settings.CACHE_DIR>/review_queue.csv``."""
    return get_settings().CACHE_DIR / "review_queue.csv"


@dataclass
class ValidationReport:
    valid: list[TestRunRecord] = field(default_factory=list)
    flags: dict[str, list[str]] = field(default_factory=dict)  # experiment_id -> soft flags
    rejected: list[dict[str, Any]] = field(default_factory=list)  # {row, errors}
    # rows rejected ONLY for enum values outside schema_v1 (ranges fine): candidates for combustion_findings
    # (I10). They are also in `rejected` and counted there.
    enum_only: list[dict[str, Any]] = field(default_factory=list)

    def summary(self) -> str:
        flagged = sum(1 for f in self.flags.values() if f)
        return f"{len(self.valid)} valid, {len(self.rejected)} rejected, {flagged} flagged for review"


def extraction_flags(run: TestRunRecord) -> list[str]:
    """``extraction:*`` flags for rows that came from stage-4 document extraction."""
    ext = run.extra_telemetry.get("extraction")
    if not isinstance(ext, dict):
        return []
    flags = ["extraction:table" if ext.get("provider") == "table" else "extraction:llm"]
    confidence = ext.get("confidence")
    if isinstance(confidence, (int, float)) and confidence < get_settings().EXTRACT_MIN_CONFIDENCE:
        flags.append("extraction:low_confidence")
    if not ext.get("quote_found"):
        flags.append("extraction:quote_not_found")
    if ext.get("from_image"):
        flags.append("extraction:from_image")
    return flags


def soft_flags(run: TestRunRecord) -> list[str]:
    flags = [f"missing:{k}" for k in OPTIONAL_OUTPUTS if getattr(run, k) is None]
    raw_mat = str(run.extra_telemetry.get("raw_fuel_material", "")).strip().lower()
    if str(run.fuel_material) not in MATERIAL_BASE_LOI or raw_mat in _SURROGATE_FUELS:
        flags.append("physics:unknown_material")
    try:
        model_loi = limiting_oxygen_index(
            run.fuel_material, run.gravity_g, run.pressure_kpa, run.flow_velocity_cm_s, run.diluent_gas
        )
        if run.combustion_regime == "Sustained Burn" and run.oxygen_pct < model_loi - 3:
            flags.append("physics:burn_below_model_loi")
        if run.combustion_regime == "No Ignition" and run.oxygen_pct > model_loi + 5:
            flags.append("physics:no_ignition_far_above_model_loi")
    except KeyError:
        if "physics:unknown_material" not in flags:
            flags.append("physics:unknown_material")
    if run.combustion_regime == "No Ignition":
        if (run.spread_or_burn_rate or 0) > 0:
            flags.append("consistency:no_ignition_with_spread")
        if (run.burn_duration_s or 0) > 0:
            flags.append("consistency:no_ignition_with_duration")
        if (run.peak_radiative_flux_kw_m2 or 0) > 0:
            flags.append("consistency:no_ignition_with_flux")
    flags.extend(extraction_flags(run))
    return flags


def _load_existing_signoffs(queue: Path) -> dict[str, tuple[str, str]]:
    """Preserve human ``(reviewed_by, decision)`` cells across re-runs of ``validate_rows()``."""
    if not queue.exists():
        return {}
    signoffs: dict[str, tuple[str, str]] = {}
    try:
        with queue.open("r", newline="", encoding="utf-8") as fh:
            for row in csv.DictReader(fh):
                eid = (row.get("experiment_id") or "").strip()
                rev = (row.get("reviewed_by") or "").strip()
                dec = (row.get("decision") or "").strip()
                if eid and (rev or dec):
                    signoffs[eid] = (rev, dec)
    except Exception:
        return {}
    return signoffs


def validate_rows(rows: list[dict[str, Any]], write_queue: bool = True) -> ValidationReport:
    rep = ValidationReport()
    seen_ids: set[str] = set()
    provenance: dict[str, tuple[str, str]] = {}  # experiment_id -> (source_doc_id, source_page)
    for row in rows:
        try:
            run = TestRunRecord(**row)
        except ValidationError as e:
            errs = e.errors()
            rep.rejected.append(
                {
                    "row": row,
                    "errors": [f"{'.'.join(map(str, err['loc']))}: {err['msg']}" for err in errs],
                }
            )
            if all(err["type"] == "enum" and err["loc"] and err["loc"][0] in ENUM_FIELDS for err in errs):
                rep.enum_only.append(row)
            continue
        if run.experiment_id in seen_ids:
            rep.rejected.append(
                {
                    "row": row,
                    "errors": [f"experiment_id: duplicate experiment_id '{run.experiment_id}'"],
                }
            )
            continue
        seen_ids.add(run.experiment_id)
        provenance[run.experiment_id] = (run.source_doc_id or "", str(run.source_page or ""))
        rep.valid.append(run)
        rep.flags[run.experiment_id] = soft_flags(run)

    if write_queue:
        # VA-01: Sort by non-missing (physics/consistency) flag count first, then total flag count
        top = sorted(
            rep.flags.items(),
            key=lambda kv: (sum(1 for f in kv[1] if not f.startswith("missing:")), len(kv[1])),
            reverse=True,
        )[:REVIEW_TOP_N]
        queue = review_queue_path()
        existing_signoffs = _load_existing_signoffs(queue)
        queue.parent.mkdir(parents=True, exist_ok=True)
        with queue.open("w", newline="", encoding="utf-8") as fh:
            w = csv.writer(fh)
            # signoffs are read back by column name, so queues written before these columns still merge
            w.writerow(
                [
                    "experiment_id",
                    "source_doc_id",
                    "source_page",
                    "n_flags",
                    "flags",
                    "reviewed_by",
                    "decision",
                ]
            )
            for eid, fl in top:
                if fl:
                    rev, dec = existing_signoffs.get(eid, ("", ""))
                    doc_id, page = provenance.get(eid, ("", ""))
                    w.writerow([eid, doc_id, page, len(fl), ";".join(fl), rev, dec])
            for rej in rep.rejected:
                row = rej["row"]
                eid = str(row.get("experiment_id", "?"))
                rev, dec = existing_signoffs.get(eid, ("", ""))
                doc_id, page = row.get("source_doc_id") or "", row.get("source_page") or ""
                w.writerow([eid, doc_id, page, "REJECTED", ";".join(rej["errors"]), rev, dec])
    return rep
