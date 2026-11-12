"""Stage 3 - Normalize: units (% O2, psi, cm/s, g-level), enum aliases, investigation IDs.

This is the Adapter Pattern core: `normalize_rows(raw_rows, column_map)` turns ANY source
table into schema_v1-shaped dicts. Unmapped columns are never dropped - they go into
`extra_telemetry`, which the UI renders generically.
"""
from __future__ import annotations

import json
from pathlib import Path
from typing import Any, Callable

import yaml

DEFAULT_COLUMN_MAP = Path(__file__).parent / "adapters" / "column_map.yaml"

GRAVITY_WORDS = {
    "ug": 0.0, "µg": 0.0, "μg": 0.0, "0g": 0.0, "micro": 0.0, "microgravity": 0.0, "iss": 0.0,
    "lunar": 0.16, "moon": 0.16, "mars": 0.38, "martian": 0.38, "1g": 1.0, "earth": 1.0, "ground": 1.0,
}
CANONICAL_G = (0.0, 0.16, 0.38, 1.0)


def _num(v: Any) -> float | None:
    if v is None:
        return None
    if isinstance(v, (int, float)):
        return float(v)
    s = str(v).strip()
    if s == "" or s.lower() in {"na", "n/a", "nan", "none", "null", "-"}:
        return None
    return float(s)


def _gravity(v: Any) -> float | None:
    if v is None or str(v).strip() == "":
        return None
    s = str(v).strip().lower()
    if s in GRAVITY_WORDS:
        return GRAVITY_WORDS[s]
    g = float(s.rstrip("g"))
    # snap near-canonical values (e.g. 0.165 -> 0.16)
    for c in CANONICAL_G:
        if abs(g - c) < 0.01:
            return c
    return g


def _json(v: Any) -> dict:
    if isinstance(v, dict):
        return v
    if v is None or str(v).strip() == "":
        return {}
    return json.loads(v)


UNIT_CONVERTERS: dict[str, Callable[[Any], Any]] = {
    "pct": _num,
    "fraction": lambda v: None if _num(v) is None else _num(v) * 100.0,
    "kpa": _num,
    "psia": lambda v: None if _num(v) is None else _num(v) * 6.894757,
    "atm": lambda v: None if _num(v) is None else _num(v) * 101.325,
    "cm_s": _num,
    "ft_min": lambda v: None if _num(v) is None else _num(v) * 0.508,
    "mm_s": lambda v: None if _num(v) is None else _num(v) / 10.0,
    "kw_m2": _num,
    "w_cm2": lambda v: None if _num(v) is None else _num(v) * 10.0,
    "g": _gravity,
    "int": lambda v: None if _num(v) is None else int(_num(v)),
    "json": _json,
    "regime": lambda v: None if v is None else str(v).strip(),
}
NUMERIC_FIELDS = {"spread_or_burn_rate", "burn_duration_s"}


def load_column_map(path: Path | None = None) -> dict:
    return yaml.safe_load(Path(path or DEFAULT_COLUMN_MAP).read_text())


def _build_lookup(column_map: dict) -> dict[str, tuple[str, str | None]]:
    """lower(header) -> (canonical_field, unit)"""
    lookup = {}
    for field, specs in column_map["fields"].items():
        for spec in specs:
            lookup[spec["column"].strip().lower()] = (field, spec.get("unit"))
    return lookup


def _alias(field: str, value: Any, aliases: dict) -> Any:
    if value is None or field not in aliases:
        return value
    table = {k.lower(): v for k, v in aliases[field].items()}
    return table.get(str(value).strip().lower(), value)


def normalize_row(raw: dict[str, Any], column_map: dict, lookup: dict | None = None) -> dict[str, Any]:
    lookup = lookup or _build_lookup(column_map)
    aliases = column_map.get("aliases", {})
    out: dict[str, Any] = {}
    extra: dict[str, Any] = {}

    for header, value in raw.items():
        key = str(header).strip().lower()
        if key not in lookup:
            if value not in (None, ""):
                extra[str(header).strip()] = value
            continue
        field, unit = lookup[key]
        if unit:
            value = UNIT_CONVERTERS[unit](value)
        elif field in NUMERIC_FIELDS:
            value = _num(value)
        elif isinstance(value, str):
            value = value.strip() or None
        if field == "extra_telemetry":
            extra = {**value, **extra}
            continue
        out[field] = _alias(field, value, aliases)

    for f in ("oxygen_pct", "pressure_kpa", "flow_velocity_cm_s"):
        if isinstance(out.get(f), float):
            out[f] = round(out[f], 3)
    out["extra_telemetry"] = extra
    return out


def normalize_rows(rows: list[dict[str, Any]], column_map: dict | None = None) -> list[dict[str, Any]]:
    column_map = column_map or load_column_map()
    lookup = _build_lookup(column_map)
    return [normalize_row(r, column_map, lookup) for r in rows]
