from __future__ import annotations

import sys
from pathlib import Path
from typing import Any

BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

import asyncio  # noqa: E402

from app.ingestion.stages.normalize import normalize_rows  # noqa: E402
from app.ingestion.stages.parse import parse_documents  # noqa: E402
from app.rag.nodes.citation_check import verify_and_extract_citations  # noqa: E402
from app.rag.scope import DOMAIN_KEYWORDS, looks_in_scope  # noqa: E402
from app.repositories.snapshot.repos import SnapshotChunkRepo, SnapshotDocumentRepo  # noqa: E402
from app.repositories.snapshot.store import get_snapshot_store  # noqa: E402
from app.services.document_service import DocumentService  # noqa: E402

PROXY_DIR = BACKEND_DIR / "tests" / "fixtures" / "proxy"


def test_challenge_corpus_documents_parse_cleanly() -> None:
    corpus_dir = PROXY_DIR / "corpus"
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

    assert normalized[0]["program"] == "Saffire"
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


def test_snapshot_document_repo_returns_full_pages_and_links(tmp_path: Path, monkeypatch: Any) -> None:
    # Build the snapshot from the proxy fixtures, independent of any local data/.cache/store.json.
    from app.core.config import get_settings

    monkeypatch.setenv("SNAPSHOT_PATH", str(tmp_path / "missing_store.json"))
    monkeypatch.setenv("SEED_DIR", str(PROXY_DIR))
    get_settings.cache_clear()
    get_snapshot_store.cache_clear()
    try:
        store = get_snapshot_store()
    finally:
        get_settings.cache_clear()
        get_snapshot_store.cache_clear()
    assert store.source == "seed"
    repo = SnapshotDocumentRepo(store)
    summaries = asyncio.run(repo.list_all())
    assert len(summaries) >= 8
    assert all(len(s.get("pages", [])) >= 1 for s in summaries)
    doc3 = asyncio.run(repo.get_detail("DOC-03"))
    assert doc3 is not None
    assert doc3["doc_id"] == "DOC-03"
    assert doc3["url"]
    assert len(doc3["sources"]) >= 1
    assert len(doc3["pages"]) == 3
    assert "EXP-0031" in doc3["related_experiment_ids"]

    service = DocumentService(repo)
    apollo_docs = asyncio.run(service.list_all(q="Apollo 1 Mir"))
    assert any(d.doc_id == "DOC-07" for d in apollo_docs)
    spinoff_docs = asyncio.run(service.list_all(q="spinoff firefighting"))
    assert any(d.doc_id == "DOC-08" for d in spinoff_docs)

    # Case-insensitive document lookup & direct download payload resolution
    lowered = asyncio.run(service.get("doc-03"))
    assert lowered.doc_id == "DOC-03"
    dl = asyncio.run(service.prepare_download("doc-03"))
    assert dl.filename.startswith("DOC-03")
    assert dl.content is not None or (dl.file_path is not None and dl.file_path.exists())


def test_snapshot_chunk_repo_excludes_csv_tables_and_citation_check_normalizes_case(
    tmp_path: Path, monkeypatch: Any
) -> None:
    from app.core.config import get_settings
    from app.repositories.snapshot.store import SnapshotStore

    store = SnapshotStore(
        source="memory",
        data={
            "documents": [
                {
                    "doc_id": "PSI-25_Experimental_table_BASS-II.csv",
                    "title": "Experimental table BASS-II",
                    "source_type": "psi_dataset",
                    "page_count": 1,
                    "pages": [{"page": 1, "section": "Table", "text": "cool flame soot"}],
                },
                {
                    "doc_id": "PSI-23_Report_s_Flame_final_report_20210729",
                    "title": "S Flame Final Report",
                    "source_type": "ntrs",
                    "page_count": 1,
                    "pages": [{"page": 12, "section": "Findings", "text": "cool flame soot suppression"}],
                },
            ],
            "chunks": [
                {
                    "id": 1,
                    "doc_id": "PSI-25_Experimental_table_BASS-II.csv",
                    "page": 1,
                    "text": "cool flame soot row",
                    "metadata": {"source_type": "psi_dataset"},
                },
                {
                    "id": 2,
                    "doc_id": "PSI-23_Report_s_Flame_final_report_20210729",
                    "page": 12,
                    "text": "Cool flame dynamics govern soot suppression in microgravity.",
                    "metadata": {"source_type": "ntrs"},
                },
            ],
            "test_runs": [],
            "presets": [],
        },
    )
    chunk_repo = SnapshotChunkRepo(store)
    hits = asyncio.run(chunk_repo.hybrid_search("cool flame soot", None, top_n=5))
    assert len(hits) == 1
    assert hits[0]["doc_id"] == "PSI-23_Report_s_Flame_final_report_20210729"

    monkeypatch.setenv("SNAPSHOT_PATH", str(tmp_path / "missing_store.json"))
    get_settings.cache_clear()
    try:
        evidence = [
            {
                "source": "hybrid",
                "doc_id": "PSI-23_Report_s_Flame_final_report_20210729",
                "page": 12,
                "experiment_id": None,
                "text": "Cool flame dynamics govern soot suppression in microgravity.",
                "score": 0.9,
            },
            {
                "source": "sql",
                "doc_id": None,
                "page": None,
                "experiment_id": "PSI-25_M13",
                "text": "PSI-25_M13 (BASS-II, PMMA): regime=Sustained Burn",
                "score": 0.8,
            },
        ]
        cleaned, ok, citations, dropped = verify_and_extract_citations(
            "Cool flame dynamics govern soot suppression [psi-23_report_s_flame_final_report_20210729 p.12]. "
            "Sustained burning occurred in one test [psi-25_m13].",
            evidence,  # type: ignore[arg-type]
            True,
        )
        assert ok is True
        assert dropped == []
        assert "PSI-23_Report_s_Flame_final_report_20210729 p.12" in cleaned
        assert "[PSI-25_M13]" in cleaned
        assert {c["kind"] for c in citations} == {"doc", "experiment"}
    finally:
        get_settings.cache_clear()


def test_looks_in_scope_accepts_combustion_and_doc_ids() -> None:
    assert looks_in_scope("What is PSI-23_Report_s_Flame_final_report_20210729 about?")
    assert looks_in_scope("Why do turbulent diffusion flames produce less soot at high oxygen?")
    assert not looks_in_scope("Write me a chocolate cake recipe.")
