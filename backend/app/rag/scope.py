"""Domain vocabulary used to decide whether a question is in scope (moved from legacy ``nodes/router.py``)."""

from __future__ import annotations

import re
from typing import Final

DOMAIN_KEYWORDS: Final[frozenset[str]] = frozenset({
    "flame", "flames", "fire", "fires", "burn", "burns", "burned", "burning",
    "combustion", "oxygen", "o2", "loi", "pressure", "kpa", "psia",
    "flow", "airflow", "ventilation", "hvac", "microgravity", "0g", "1g", "gravity", "lunar", "mars",
    "artemis", "iss", "bass", "bass-ii", "sofie", "flex", "flex-2", "acme", "saffire",
    "pmma", "nomex", "cotton", "fiberglass", "sibal", "heptane", "methanol", "ethanol",
    "methane", "ethylene", "propane", "ethane", "butane", "hydrogen", "dodecane", "decane",
    "hexadecane", "alkane", "alcohol", "toluene", "candle", "candles", "fuel", "fuels",
    "droplet", "droplets", "cool", "radiative", "radiation", "flux",
    "extinguish", "extinguishes", "extinguished", "extinction", "quenching",
    "ignition", "ignite", "ignites", "spread", "diluent", "co2", "helium", "argon", "nitrogen",
    "nasa", "ntrs", "psi", "6001b", "spacecraft", "station", "cabin", "habitat",
    "exp-", "doc-", "soot", "standoff", "residence", "buoyancy", "buoyant", "convection",
    "convective", "diffusion", "spherical", "electric", "voltage", "soret", "thermocouple",
    "radiometer", "apollo", "mir", "spice", "slice", "same", "same-r", "daft", "daft-2", "bre",
    "cfi", "cfi-g", "cld", "e-field", "s-flame", "feanics", "clerd", "cfv", "gel", "mist",
    "luci", "fm2", "cir", "msg", "mdca", "spacesuit", "suit", "offgas", "offgassing", "toxic",
    "rover", "firefighter", "firefighting", "spinoff", "smoke", "detector", "alarm", "dust",
    "aerosol", "scba", "canister", "perchlorate", "vika", "turnout", "pbi",
    "flammability", "flammable", "atmosphere", "freefall", "suppressant", "smolder", "smouldering",
    "scenario", "configuration", "experiment", "experiments", "runs",
    "paper", "papers", "report", "reports", "publication", "publications", "document", "documents",
})  # fmt: skip

_ID_PREFIXES: Final[tuple[str, ...]] = (
    "psi-",
    "ntrs-",
    "exp-",
    "doc-",
    "iss-",
    "web-",
    "b2-",
    "ema-",
)

OUT_OF_SCOPE_HINTS: Final[frozenset[str]] = frozenset({
    "stock", "bitcoin", "weather", "recipe", "football", "soccer", "movie", "hotel", "flight ticket",
    "tax", "kubernetes", "react", "javascript", "poem", "joke", "capital of",
})  # fmt: skip


def looks_in_scope(question: str) -> bool:
    """Return True if ``question`` appears related to NASA microgravity fire safety / PSI corpus."""
    q = question.lower().strip()
    tokens = set(re.findall(r"[a-z0-9_-]+", q))
    if any(h in q for h in OUT_OF_SCOPE_HINTS) and not (tokens & DOMAIN_KEYWORDS):
        return False
    if tokens & DOMAIN_KEYWORDS:
        return True
    return any(tok.startswith(_ID_PREFIXES) for tok in tokens)


__all__ = ["DOMAIN_KEYWORDS", "OUT_OF_SCOPE_HINTS", "looks_in_scope"]
