"""I6: resilient parse stage + .txt documents (no network)."""

from __future__ import annotations

import json
import logging
import sys
from pathlib import Path

import pytest

BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from app.ingestion.stages import parse  # noqa: E402

GOOD_MD = "---\ndoc_id: GOOD\ntitle: Good doc\nsource_type: ntrs\n---\nBody text.\n"


def _write(p: Path, text: str) -> Path:
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text(text, encoding="utf-8")
    return p


def test_corrupt_pdf_is_skipped_not_fatal(tmp_path: Path) -> None:
    pytest.importorskip("fitz")
    bad = tmp_path / "corpus" / "broken.pdf"
    bad.parent.mkdir(parents=True)
    bad.write_bytes(b"%PDF-1.7 this is not really a pdf \x00\x01\x02")
    good = _write(tmp_path / "corpus" / "good.md", GOOD_MD)
    docs, skipped = parse.parse_documents_with_skipped([bad, good])
    assert [d.doc_id for d in docs] == ["GOOD"]
    assert len(skipped) == 1 and skipped[0][0] == str(bad)
    assert parse.parse_documents([bad, good])[0].doc_id == "GOOD"  # list-returning API unchanged


def test_broken_yaml_front_matter_does_not_crash(tmp_path: Path, caplog: pytest.LogCaptureFixture) -> None:
    p = _write(tmp_path / "corpus" / "bad_yaml.md", "---\ntitle: [unclosed\nfuel: : :\n---\nPage text.\n")
    with caplog.at_level(logging.WARNING, logger=parse.__name__):
        (doc,) = parse.parse_documents([p], {str(p): "ntrs"})
    assert doc.doc_id == "bad_yaml" and doc.metadata == {}
    assert doc.pages == ["Page text."]
    assert "invalid YAML front matter" in caplog.text


def test_bad_source_type_falls_back_to_folder_type(tmp_path: Path, caplog: pytest.LogCaptureFixture) -> None:
    p = _write(tmp_path / "iss_pages" / "x.md", "---\ndoc_id: X\nsource_type: blog_post\n---\nText.\n")
    with caplog.at_level(logging.WARNING, logger=parse.__name__):
        (doc,) = parse.parse_documents([p], {str(p): "iss_page"})
    assert doc.source_type == "iss_page"
    assert "blog_post" in caplog.text
    # no folder type known -> ntrs
    (doc2,) = parse.parse_documents([p])
    assert doc2.source_type == "ntrs"


def test_txt_with_form_feeds_gives_pages(tmp_path: Path) -> None:
    p = _write(tmp_path / "corpus" / "20190001234.txt", "Page one text.\fPage two text.\f")
    (doc,) = parse.parse_documents([p], {str(p): "ntrs"})
    assert doc.doc_id == "20190001234" and doc.source_type == "ntrs"
    assert doc.pages == ["Page one text.", "Page two text."]


def test_txt_without_form_feed_is_one_page(tmp_path: Path) -> None:
    p = _write(tmp_path / "iss_pages" / "note.txt", "Just one page.\n")
    (doc,) = parse.parse_documents([p], {str(p): "iss_page"})
    assert doc.pages == ["Just one page."] and doc.source_type == "iss_page"


def test_telemetry_entry_without_id_skipped(tmp_path: Path, caplog: pytest.LogCaptureFixture) -> None:
    data = [{"experiment_id": "A", "t": [0, 1]}, {"t": [0]}, {"experiment_id": "", "t": []}]
    p = _write(tmp_path / "telemetry.json", json.dumps(data))
    with caplog.at_level(logging.WARNING, logger=parse.__name__):
        out = parse.read_telemetry(p)
    assert list(out) == ["A"]
    assert "skipped 2 entries" in caplog.text


def test_telemetry_accepts_records_object(tmp_path: Path) -> None:
    p = _write(tmp_path / "telemetry.json", json.dumps({"records": [{"experiment_id": "B", "t": []}]}))
    assert list(parse.read_telemetry(p)) == ["B"]


def test_read_rows_json_shapes(tmp_path: Path) -> None:
    rows = [{"experiment_id": "A"}]
    assert parse.read_rows(_write(tmp_path / "a.json", json.dumps(rows))) == rows
    assert parse.read_rows(_write(tmp_path / "b.json", json.dumps({"records": rows}))) == rows
    with pytest.raises(ValueError, match="expected a JSON list"):
        parse.read_rows(_write(tmp_path / "c.json", json.dumps({"rows": rows})))
    with pytest.raises(ValueError, match="expected a JSON list"):
        parse.read_rows(_write(tmp_path / "d.json", json.dumps("just a string")))
