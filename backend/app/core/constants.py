"""Application-wide constants."""

from __future__ import annotations

from collections.abc import Mapping
from types import MappingProxyType
from typing import Final

SCHEMA_VERSION: Final = "v1"

# Output dimension of the default embedding model (BAAI/bge-small-en-v1.5). Fixed by the model and baked into
# the chunks.embedding vector(N) column; switching to a model of another size needs a migration.
EMBED_DIM: Final = 384

# Reciprocal Rank Fusion constant and per-retriever candidate count for hybrid search.
RRF_K: Final = 60
HYBRID_CANDIDATES: Final = 20

DEFAULT_RANK_WEIGHTS: Final[Mapping[str, float]] = MappingProxyType(
    {"similarity": 0.5, "completeness": 0.2, "criticality": 0.3}
)

NO_DATA_MESSAGE: Final = (
    "No data: the EMBER microgravity combustion database and NASA PSI/NTRS corpus do not contain "
    "verified evidence to answer this question."
)
