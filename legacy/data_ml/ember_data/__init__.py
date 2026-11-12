"""EMBER Squad 1 package: ingestion pipeline, physics, ranking and risk models."""
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
CONTRACTS_DIR = REPO_ROOT / "contracts"
MOCK_DATA_DIR = CONTRACTS_DIR / "mock_data"
SCHEMA_PATH = CONTRACTS_DIR / "schema_v1.json"
