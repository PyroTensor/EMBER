"""Stage 3 - Normalize: units (% O2, psi, cm/s, g-level), enum aliases, investigation IDs.

This is the Adapter Pattern core: `normalize_rows(raw_rows, column_map)` turns ANY source
table into schema_v1-shaped dicts. Unmapped columns are never dropped - they go into
`extra_telemetry`, which the UI renders generically.
"""

from __future__ import annotations

import json
import math
import re
from collections.abc import Callable
from pathlib import Path
from typing import Any

import yaml

from app.schemas.enums import CombustionRegime, DiluentGas, FuelGeometry, FuelMaterial, Program

DEFAULT_COLUMN_MAP = Path(__file__).resolve().parents[1] / "adapters" / "column_map.yaml"

NULL_TOKENS = {"", "na", "n/a", "nan", "none", "null", "-", "--", "tbd"}
_NUM_RE = re.compile(r"[-+]?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?")

GRAVITY_WORDS = {
    "ug": 0.0,
    "µg": 0.0,
    "μg": 0.0,
    "0g": 0.0,
    "micro": 0.0,
    "microgravity": 0.0,
    "iss": 0.0,
    "lunar": 0.16,
    "moon": 0.16,
    "mars": 0.38,
    "martian": 0.38,
    "1g": 1.0,
    "earth": 1.0,
    "ground": 1.0,
}
CANONICAL_G = (0.0, 0.16, 0.38, 1.0)

_CANONICAL_ENUMS: dict[str, dict[str, str]] = {
    "program": {e.value.lower(): e.value for e in Program},
    "fuel_material": {e.value.lower(): e.value for e in FuelMaterial},
    "fuel_geometry": {e.value.lower(): e.value for e in FuelGeometry},
    "diluent_gas": {e.value.lower(): e.value for e in DiluentGas},
    "combustion_regime": {e.value.lower(): e.value for e in CombustionRegime},
}


def _num(v: Any) -> float | None:
    if v is None or isinstance(v, bool):
        return None
    if isinstance(v, (int, float)):
        fv = float(v)
        return None if (math.isnan(fv) or math.isinf(fv)) else fv
    s = str(v).strip()
    if s.lower() in NULL_TOKENS:
        return None
    # Strip thousands separators, leading ~ / ≈, and ± uncertainty suffixes
    cleaned = re.split(r"±|\+/-", s.replace(",", ""), maxsplit=1)[0].strip()
    cleaned = cleaned.lstrip("~≈").strip()
    try:
        fv = float(cleaned)
    except ValueError:
        m = _NUM_RE.search(cleaned)
        if not m:
            return None
        try:
            fv = float(m.group(0))
        except ValueError:
            return None
    return None if (math.isnan(fv) or math.isinf(fv)) else fv


def _gravity(v: Any) -> float | None:
    if v is None or isinstance(v, bool):
        return None
    s = str(v).strip().lower()
    if s in NULL_TOKENS:
        return None
    if s in GRAVITY_WORDS:
        return GRAVITY_WORDS[s]
    g = _num(s.rstrip("g").strip())
    if g is None:
        return None
    # snap near-canonical values (e.g. 0.165 -> 0.16)
    for c in CANONICAL_G:
        if abs(g - c) < 0.01:
            return c
    return g


def _json(v: Any) -> dict[str, Any]:
    if isinstance(v, dict):
        return v
    if v is None or str(v).strip() == "":
        return {}
    try:
        result = json.loads(str(v))
        return result if isinstance(result, dict) else {"raw_extra": result}
    except (json.JSONDecodeError, TypeError):
        return {"raw_extra": str(v)}


UNIT_CONVERTERS: dict[str, Callable[[Any], Any]] = {
    "pct": _num,
    "fraction": lambda v: None if (n := _num(v)) is None else n * 100.0,
    "kpa": _num,
    "psia": lambda v: None if (n := _num(v)) is None else n * 6.894757,
    "atm": lambda v: None if (n := _num(v)) is None else n * 101.325,
    "mmhg": lambda v: None if (n := _num(v)) is None else n * 0.1333223684,
    "cm_s": _num,
    "ft_min": lambda v: None if (n := _num(v)) is None else n * 0.508,
    "mm_s": lambda v: None if (n := _num(v)) is None else n / 10.0,
    "kw_m2": _num,
    "w_cm2": lambda v: None if (n := _num(v)) is None else n * 10.0,
    "g": _gravity,
    "int": lambda v: None if (n := _num(v)) is None else int(n),
    "json": _json,
    "regime": lambda v: None if v is None else (str(v).strip() or None),
}
NUMERIC_FIELDS = {"spread_or_burn_rate", "burn_duration_s"}
FLOAT_OUTPUT_FIELDS = (
    "gravity_g",
    "oxygen_pct",
    "pressure_kpa",
    "flow_velocity_cm_s",
    "spread_or_burn_rate",
    "peak_radiative_flux_kw_m2",
    "limiting_oxygen_index_pct",
    "burn_duration_s",
)


def load_column_map(path: Path | None = None) -> dict[str, Any]:
    result: dict[str, Any] = yaml.safe_load(Path(path or DEFAULT_COLUMN_MAP).read_text(encoding="utf-8"))
    return result


def _build_lookup(column_map: dict[str, Any]) -> dict[str, tuple[str, str | None]]:
    """lower(header) -> (canonical_field, unit)"""
    lookup = {}
    for field, specs in column_map["fields"].items():
        for spec in specs:
            lookup[spec["column"].strip().lower()] = (field, spec.get("unit"))
    return lookup


def _alias(field: str, value: Any, aliases: dict[str, Any]) -> Any:
    if value is None:
        return None
    s = str(value).strip()
    if not s:
        return None
    low = s.lower()
    if field in aliases:
        table = {str(k).strip().lower(): v for k, v in aliases[field].items()}
        if low in table:
            return table[low]
    if field in _CANONICAL_ENUMS and low in _CANONICAL_ENUMS[field]:
        return _CANONICAL_ENUMS[field][low]
    return value


def normalize_row(
    raw: dict[str, Any], column_map: dict[str, Any], lookup: dict[str, tuple[str, str | None]] | None = None
) -> dict[str, Any]:
    lookup = lookup or _build_lookup(column_map)
    aliases = column_map.get("aliases", {})
    out: dict[str, Any] = {}
    extra: dict[str, Any] = {}

    for header, value in raw.items():
        if header is None:
            continue
        key = str(header).strip().lower()
        if key not in lookup:
            if value not in (None, ""):
                extra[str(header).strip()] = value
            continue
        field, unit = lookup[key]
        raw_val = value
        if unit:
            value = UNIT_CONVERTERS[unit](value)
        elif field in NUMERIC_FIELDS:
            value = _num(value)
        elif isinstance(value, str):
            value = value.strip() or None
        if field == "extra_telemetry":
            extra = {**value, **extra}
            continue
        aliased_val = _alias(field, value, aliases)
        if (
            field == "program"
            and aliased_val is not None
            and raw_val is not None
            and str(raw_val).strip().lower() != str(aliased_val).strip().lower()
        ):
            extra.setdefault("psi_investigation_code", str(raw_val).strip())
        if (
            field == "fuel_material"
            and aliased_val is not None
            and raw_val is not None
            and str(raw_val).strip().lower() != str(aliased_val).strip().lower()
        ):
            extra.setdefault("raw_fuel_material", str(raw_val).strip())
        if aliased_val is not None or field not in out:
            out[field] = aliased_val

    # SC-04: Quiescent droplet / FLEX runs often omit flow_velocity_cm_s in source CSVs
    if out.get("flow_velocity_cm_s") is None and (
        out.get("fuel_geometry") == "Droplet" or out.get("program") == "FLEX"
    ):
        out["flow_velocity_cm_s"] = 0.0
        extra["flow_assumed_quiescent"] = True

    # NO-03: Record rate_unit disambiguating solid spread rate vs droplet burning rate constant K
    if out.get("spread_or_burn_rate") is not None and "rate_unit" not in extra:
        extra["rate_unit"] = "mm2/s" if out.get("fuel_geometry") == "Droplet" else "cm/s"

    for f in FLOAT_OUTPUT_FIELDS:
        if isinstance(out.get(f), float):
            out[f] = round(out[f], 3)
    out["extra_telemetry"] = extra
    return out


def normalize_rows(
    rows: list[dict[str, Any]], column_map: dict[str, Any] | None = None
) -> list[dict[str, Any]]:
    column_map = column_map or load_column_map()
    lookup = _build_lookup(column_map)
    return [normalize_row(r, column_map, lookup) for r in rows]
