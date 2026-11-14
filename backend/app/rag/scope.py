"""Domain vocabulary used to decide whether a question is in scope (moved from legacy ``nodes/router.py``)."""

from __future__ import annotations

from typing import Final

DOMAIN_KEYWORDS: Final[frozenset[str]] = frozenset({
    "flame", "fire", "burn", "combustion", "oxygen", "o2", "loi", "pressure", "kpa", "psia",
    "flow", "ventilation", "hvac", "microgravity", "0g", "1g", "gravity", "lunar", "mars",
    "artemis", "iss", "bass", "bass-ii", "sofie", "flex", "acme", "saffire", "pmma", "nomex", "cotton",
    "fiberglass", "sibal", "heptane", "methanol", "droplet", "cool", "radiative", "flux",
    "extinguish", "ignition", "spread", "diluent", "co2", "helium", "argon", "nitrogen",
    "nasa", "6001b", "spacecraft", "cabin", "habitat", "exp-", "doc-", "soot", "standoff",
    "apollo", "mir", "spice", "slice", "same", "same-r", "daft", "daft-2", "bre",
    "cfi", "cfi-g", "e-field", "luci", "fm2", "cir", "msg", "mdca", "spacesuit", "suit",
    "rover", "firefighter", "firefighting", "spinoff", "smoke", "detector", "alarm", "dust",
    "aerosol", "scba", "canister", "perchlorate", "vika", "turnout", "pbi",
})  # fmt: skip

OUT_OF_SCOPE_HINTS: Final[frozenset[str]] = frozenset({
    "stock", "bitcoin", "weather", "recipe", "football", "soccer", "movie", "hotel", "flight ticket",
    "tax", "kubernetes", "react", "javascript", "poem", "joke", "capital of",
})  # fmt: skip

__all__ = ["DOMAIN_KEYWORDS", "OUT_OF_SCOPE_HINTS"]
