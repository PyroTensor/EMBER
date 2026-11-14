"""StrEnums with exactly the values of ``contracts/schema_v1.json`` and ``contracts/openapi_v1.yaml``."""

from __future__ import annotations

from enum import StrEnum

# ── schema_v1.json ────────────────────────────────────────────────────


class Program(StrEnum):
    BASS_II = "BASS-II"
    SOFIE = "SoFIE"
    FLEX = "FLEX"
    ACME = "ACME"
    SAFFIRE = "Saffire"


class FuelMaterial(StrEnum):
    PMMA = "PMMA"
    COTTON_FIBERGLASS = "Cotton-Fiberglass"
    NOMEX = "Nomex"
    HEPTANE = "Heptane"
    METHANOL = "Methanol"


class FuelGeometry(StrEnum):
    FLAT_SHEET = "Flat Sheet"
    ROD = "Rod"
    DROPLET = "Droplet"
    GASEOUS = "Gaseous"


class DiluentGas(StrEnum):
    N2 = "N2"
    CO2 = "CO2"
    HE = "He"
    AR = "Ar"


class CombustionRegime(StrEnum):
    SUSTAINED_BURN = "Sustained Burn"
    SELF_EXTINGUISHED = "Self-Extinguished"
    COOL_FLAME = "Cool Flame"
    NO_IGNITION = "No Ignition"


# ── openapi_v1.yaml ───────────────────────────────────────────────────


class RiskBand(StrEnum):
    LOW = "LOW"
    ELEVATED = "ELEVATED"
    HIGH = "HIGH"
    CRITICAL = "CRITICAL"


class Route(StrEnum):
    FACTS = "facts"
    SEARCH = "search"
    COMPARE = "compare"
    OUT_OF_SCOPE = "out_of_scope"


class EvidenceKind(StrEnum):
    CHUNK = "chunk"
    TEST_RUN = "test_run"
    RANKED_RUN = "ranked_run"


class EvidenceSource(StrEnum):
    """RAG node that produced a piece of evidence."""

    SQL_TOOL = "sql_tool"
    HYBRID_RETRIEVER = "hybrid_retriever"
    SCENARIO_RANKER = "scenario_ranker"


class CitationKind(StrEnum):
    DOC = "doc"
    EXPERIMENT = "experiment"


__all__ = [
    "CitationKind",
    "CombustionRegime",
    "DiluentGas",
    "EvidenceKind",
    "EvidenceSource",
    "FuelGeometry",
    "FuelMaterial",
    "Program",
    "RiskBand",
    "Route",
]
