"""I8: scanned-page vision fallback (fake chain / mock transports, no network)."""

from __future__ import annotations

import base64
import json
import sys
from pathlib import Path
from types import SimpleNamespace
from typing import Any

import httpx
import pytest
from pydantic import BaseModel

BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from app.core.config import get_settings  # noqa: E402
from app.ingestion.extractors import ChainResult, ExtractionCache, GeminiStructured, OpenAIStructured  # noqa: E402
from app.ingestion.extractors.schemas import PageRunsExtraction, PageTranscription, RunExtraction  # noqa: E402
from app.ingestion.stages import normalize, parse, validate  # noqa: E402
from app.ingestion.stages.llm_extract import LLMExtractor  # noqa: E402
from app.schemas.ingestion import Document  # noqa: E402

SCANNED_TEXT = """Table 3. Microgravity test results (ISS)
| Run ID | O2 (%) | Pressure (kPa) | Flow (cm/s) |
|---|---|---|---|
| SC-01 | 21 | 101.3 | 10 |
"""


class Thing(BaseModel):
    name: str


def _run() -> RunExtraction:
    return RunExtraction.model_validate(
        {
            "experiment_id": "SC-01",
            "program": "BASS-II",
            "fuel_material": "PMMA",
            "fuel_geometry": "Flat Sheet",
            "gravity_g": 0.0,
            "oxygen_pct": 21.0,
            "pressure_kpa": 101.3,
            "flow_velocity_cm_s": 10.0,
            "diluent_gas": "N2",
            "combustion_regime": "Sustained Burn",
            "spread_or_burn_rate": None,
            "peak_radiative_flux_kw_m2": None,
            "limiting_oxygen_index_pct": None,
            "burn_duration_s": None,
            "confidence": 0.9,
            "evidence_quote": "| SC-01 | 21 | 101.3 | 10 |",
        }
    )


class FakeChain:
    """Transcribes images to SCANNED_TEXT and extracts one run from any page."""

    def __init__(self) -> None:
        self.images: list[bytes] = []
        self.calls: list[str] = []

    @property
    def providers(self) -> list[str]:
        return ["openai"]

    async def extract(
        self, system: str, user: str, schema: type[BaseModel], image_png: bytes | None = None
    ) -> ChainResult:
        self.calls.append(schema.__name__)
        parsed: BaseModel
        if schema is PageTranscription:
            assert image_png is not None
            self.images.append(image_png)
            parsed = PageTranscription(text=SCANNED_TEXT)
        else:
            assert image_png is None
            parsed = PageRunsExtraction(runs=[_run()])
        return ChainResult(parsed, parsed.model_dump_json(), "openai", "gpt-test", [])


def _scanned_doc(n_image_pages: int = 1) -> Document:
    pages = ["Cover page with a short title only, mostly prose about spacecraft fire safety."]
    pages += [""] * n_image_pages
    return Document(
        doc_id="SCAN-1",
        title="SCAN-1",
        source_type="ntrs",
        path="corpus/scan-1.pdf",
        metadata={"image_pages": list(range(2, 2 + n_image_pages))},
        pages=pages,
    )


def _fake_render(path: str, page_no: int) -> bytes:
    return f"PNG:{path}:{page_no}".encode()


def _ext(chain: FakeChain, tmp_path: Path, **kw: Any) -> LLMExtractor:
    return LLMExtractor(  # type: ignore[arg-type]
        chain, cache=ExtractionCache(tmp_path / "extractions"), renderer=_fake_render, **kw
    )


@pytest.fixture(autouse=True)
def _isolated_cache(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("CACHE_DIR", str(tmp_path))
    get_settings.cache_clear()
    yield
    get_settings.cache_clear()


def test_parse_pdf_records_image_pages(tmp_path: Path) -> None:
    fitz: Any = pytest.importorskip("fitz")
    pdf = fitz.open()
    pdf.new_page().insert_text((72, 72), "A text page with more than forty characters of real content.")
    pdf.new_page()  # blank: no extractable text, like a scanned image page
    path = tmp_path / "mixed.pdf"
    pdf.save(path)
    pdf.close()
    doc = parse.parse_pdf(path)
    assert doc.metadata["image_pages"] == [2]


async def test_image_page_text_replaced_then_runs_extracted_and_flagged(tmp_path: Path) -> None:
    doc = _scanned_doc()
    chain = FakeChain()
    ext = _ext(chain, tmp_path)
    rows = await ext.extract_test_runs(doc)

    assert chain.images == [b"PNG:corpus/scan-1.pdf:2"]
    assert doc.pages[1] == SCANNED_TEXT.strip()  # empty page text replaced for chunking / citations
    assert doc.metadata["ocr"] == "llm:openai" and doc.metadata["ocr_pages"] == [2]
    assert ext.stats.ocr_pages == 1
    (row,) = rows
    assert row["source_page"] == 2 and row["experiment_id"] == "SC-01"
    extraction = row["extra_telemetry"]["extraction"]
    assert extraction["from_image"] is True and extraction["quote_found"] is True

    rep = validate.validate_rows(normalize.normalize_rows(rows), write_queue=False)
    assert "extraction:from_image" in rep.flags["SC-01"]


async def test_transcription_happens_once_per_document(tmp_path: Path) -> None:
    doc = _scanned_doc()
    chain = FakeChain()
    ext = _ext(chain, tmp_path)
    await ext.extract_investigation(doc)
    await ext.extract_test_runs(doc)
    assert chain.calls.count("PageTranscription") == 1


async def test_budget_shared_with_transcription(tmp_path: Path) -> None:
    doc = _scanned_doc(n_image_pages=2)
    chain = FakeChain()
    ext = _ext(chain, tmp_path, max_pages=2)
    rows = await ext.extract_test_runs(doc)
    # 2 image pages use the whole budget -> no page left for run extraction
    assert chain.calls == ["PageTranscription", "PageTranscription"]
    assert rows == [] and ext.stats.budget_skipped == 2


async def test_transcription_cache_hit_needs_no_budget(tmp_path: Path) -> None:
    chain = FakeChain()
    await _ext(chain, tmp_path).extract_test_runs(_scanned_doc())
    second_chain = FakeChain()
    doc = _scanned_doc()
    ext = _ext(second_chain, tmp_path, max_pages=0)
    await ext.extract_test_runs(doc)
    assert second_chain.images == [] and doc.pages[1] == SCANNED_TEXT.strip()


async def test_render_failure_skips_vision(tmp_path: Path) -> None:
    def broken(path: str, page_no: int) -> bytes:
        raise RuntimeError("PyMuPDF not installed")

    chain = FakeChain()
    ext = LLMExtractor(chain, cache=ExtractionCache(tmp_path / "x"), renderer=broken)  # type: ignore[arg-type]
    doc = _scanned_doc()
    assert await ext.extract_test_runs(doc) == []
    assert doc.pages[1] == "" and "ocr" not in doc.metadata


# ── image input in the provider clients ───────────────────────────────


async def test_openai_sends_image_as_data_url() -> None:
    seen: dict[str, Any] = {}

    def handler(request: httpx.Request) -> httpx.Response:
        seen.update(json.loads(request.content))
        return httpx.Response(
            200,
            json={
                "id": "x",
                "object": "chat.completion",
                "created": 0,
                "model": "gpt-test",
                "choices": [
                    {
                        "index": 0,
                        "finish_reason": "stop",
                        "message": {"role": "assistant", "content": '{"name": "ok"}', "refusal": None},
                    }
                ],
            },
        )

    client = OpenAIStructured(
        "sk-test", "gpt-test", 5, 0, http_client=httpx.AsyncClient(transport=httpx.MockTransport(handler))
    )
    parsed, _ = await client.extract("sys", "transcribe", Thing, image_png=b"\x89PNG")
    assert parsed == Thing(name="ok")
    user = seen["messages"][1]["content"]
    assert user[0] == {"type": "text", "text": "transcribe"}
    assert user[1]["image_url"]["url"] == "data:image/png;base64," + base64.b64encode(b"\x89PNG").decode()


async def test_gemini_sends_image_part_first() -> None:
    seen: dict[str, Any] = {}

    class Models:
        async def generate_content(self, **kwargs: Any) -> Any:
            seen.update(kwargs)
            return SimpleNamespace(parsed=None, text='{"name": "ok"}')

    g = GeminiStructured(
        "g", "gemini-test", 5, 0, client=SimpleNamespace(aio=SimpleNamespace(models=Models()))
    )
    parsed, _ = await g.extract("sys", "transcribe", Thing, image_png=b"\x89PNG")
    assert parsed == Thing(name="ok")
    part, text = seen["contents"]
    assert text == "transcribe"
    assert part.inline_data.mime_type == "image/png" and part.inline_data.data == b"\x89PNG"
