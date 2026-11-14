from __future__ import annotations

import sys
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

import asyncio  # noqa: E402

from app.ingestion.stages.normalize import normalize_rows  # noqa: E402
from app.ingestion.stages.parse import parse_documents  # noqa: E402
from app.rag.scope import DOMAIN_KEYWORDS  # noqa: E402
from app.repositories.snapshot.repos import SnapshotDocumentRepo  # noqa: E402
from app.repositories.snapshot.store import get_snapshot_store  # noqa: E402


def test_challenge_corpus_documents_parse_cleanly() -> None:
    corpus_dir = BACKEND_DIR / "data" / "seed" / "corpus"
    paths = sorted(corpus_dir.glob("*.md"))
    docs = parse_documents(paths)
    doc_ids = {d.doc_id for d in docs}

    assert {"DOC-01", "DOC-02", "DOC-03", "DOC-04", "DOC-05", "DOC-06", "DOC-07", "DOC-08"} <= doc_ids
    for doc in docs:
        assert doc.title
        assert len(doc.pages) >= 2
        assert all(p.strip() for p in doc.pages)


def test_psi_investigation_aliases_preserve_code() -> None:
    rows = [
        {"Run ID": "SAF-01", "Investigation": "Saffire-II", "O2 (%)": "21", "Pressure (psia)": "14.7"},
        {"Run ID": "ACME-01", "Investigation": "CFI-G", "O2 (%)": "85", "Pressure (kPa)": "101.3"},
        {"Run ID": "MSG-01", "Investigation": "SPICE", "O2 (%)": "21", "Pressure (kPa)": "101.3"},
        {"Run ID": "CF-01", "Investigation": "CFI", "O2 (%)": "21", "Pressure (kPa)": "101.3"},
    ]
    normalized = normalize_rows(rows)

    assert normalized[0]["program"] == "SoFIE"
    assert normalized[0]["extra_telemetry"]["psi_investigation_code"] == "Saffire-II"
    assert normalized[1]["program"] == "ACME"
    assert normalized[1]["extra_telemetry"]["psi_investigation_code"] == "CFI-G"
    assert normalized[2]["program"] == "BASS-II"
    assert normalized[2]["extra_telemetry"]["psi_investigation_code"] == "SPICE"
    assert normalized[3]["program"] == "FLEX"
    assert normalized[3]["extra_telemetry"]["psi_investigation_code"] == "CFI"


def test_scope_includes_challenge_resource_keywords() -> None:
    for kw in ("apollo", "mir", "saffire", "spice", "slice", "same", "daft", "spinoff", "firefighter"):
        assert kw in DOMAIN_KEYWORDS


def test_snapshot_document_repo_returns_full_pages_and_links() -> None:
    repo = SnapshotDocumentRepo(get_snapshot_store())
    summaries = asyncio.run(repo.list_all())
    assert len(summaries) >= 8
    doc3 = asyncio.run(repo.get_detail("DOC-03"))
    assert doc3 is not None
    assert doc3["doc_id"] == "DOC-03"
    assert doc3["url"]
    assert len(doc3["sources"]) >= 1
    assert len(doc3["pages"]) == 3
    assert "EXP-0031" in doc3["related_experiment_ids"]
