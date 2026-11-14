"""I3: LLMExtractor investigations + document metadata enrichment (fake chain, no network)."""

from __future__ import annotations

import sys
from pathlib import Path

from pydantic import BaseModel

BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from app.ingestion.extractors import ChainResult, ExtractionCache  # noqa: E402
from app.ingestion.extractors.schemas import InvestigationExtraction  # noqa: E402
from app.ingestion.stages import parse  # noqa: E402
from app.ingestion.stages.llm_extract import LLMExtractor  # noqa: E402
from app.schemas.enums import Program  # noqa: E402
from app.schemas.ingestion import Document  # noqa: E402

BASS_II_MD = BACKEND_DIR / "data" / "seed" / "iss_pages" / "bass_ii.md"


class FakeChain:
    """Stands in for StructuredLLMChain: returns a fixed extraction (or fails) and counts calls."""

    def __init__(self, parsed: InvestigationExtraction | None, provider: str = "openai") -> None:
        self.parsed = parsed
        self.provider = provider
        self.calls: list[str] = []

    @property
    def providers(self) -> list[str]:
        return [self.provider]

    async def extract(self, system: str, user: str, schema: type[BaseModel]) -> ChainResult:
        self.calls.append(user)
        if self.parsed is None:
            return ChainResult(
                None, None, None, None, [{"provider": self.provider, "model": "m", "error": "timeout"}]
            )
        return ChainResult(self.parsed, self.parsed.model_dump_json(), self.provider, "m", [])


def _extraction(program: str | None = "BASS 2", **overrides: object) -> InvestigationExtraction:
    data: dict[str, object] = {
        "program": program,
        "title": "Flame spread over thin solids",
        "summary": "Opposed-flow flame spread over PMMA   and cotton in microgravity.",
        "fuels": ["PMMA", " Cotton-Fiberglass "],
        "o2_pct_min": 16.0,
        "o2_pct_max": 21.0,
        "pressures_kpa": [101.3],
        "gravity_levels_g": [0.0],
        "evidence_page": 1,
    }
    data.update(overrides)
    return InvestigationExtraction.model_validate(data)


def _pdf_like_doc(metadata: dict[str, object] | None = None) -> Document:
    return Document(
        doc_id="20190001234",
        title="20190001234",
        source_type="ntrs",
        path="corpus/20190001234.pdf",
        metadata=metadata or {},
        pages=[
            "Abstract. The BASS-II experiment on the ISS studied flame spread.",
            "Results page 2.",
            "",
            "p4",
        ],
    )


def _extractor(chain: FakeChain, tmp_path: Path, use_cache: bool = True) -> LLMExtractor:
    return LLMExtractor(chain, cache=ExtractionCache(tmp_path), use_cache=use_cache)  # type: ignore[arg-type]


async def test_front_matter_doc_makes_no_chain_call(tmp_path: Path) -> None:
    (doc,) = parse.parse_documents([BASS_II_MD])
    chain = FakeChain(_extraction())
    ext = _extractor(chain, tmp_path)
    inv = await ext.extract_investigation(doc)
    assert inv is not None and inv.program is Program.BASS_II
    assert chain.calls == []
    assert ext.stats.by_provider["heuristic"] == 1 and ext.stats.calls == 0


async def test_pdf_like_doc_enriched_and_alias_mapped(tmp_path: Path) -> None:
    doc = _pdf_like_doc()
    chain = FakeChain(_extraction(program="BASS 2"))
    ext = _extractor(chain, tmp_path)
    inv = await ext.extract_investigation(doc)

    assert inv is not None
    assert inv.id == "BASS-II" and inv.program is Program.BASS_II
    assert inv.source_doc_id == doc.doc_id
    assert inv.title == "Flame spread over thin solids"
    assert inv.summary == "Opposed-flow flame spread over PMMA and cotton in microgravity."
    assert doc.metadata == {
        "investigation": "BASS-II",
        "fuel": ["PMMA", "Cotton-Fiberglass"],
        "o2_range": [16.0, 21.0],
        "pressure_kpa": [101.3],
        "gravity": [0.0],
        "metadata_source": "llm:openai",
    }
    # first pages only, page-prefixed, blank pages skipped
    (sent,) = chain.calls
    assert sent.startswith("=== page 1 ===") and "=== page 2 ===" in sent
    assert "=== page 3 ===" not in sent and "=== page 4 ===" not in sent
    assert ext.stats.by_provider["openai"] == 1 and ext.stats.calls == 1


async def test_existing_metadata_keys_never_overwritten(tmp_path: Path) -> None:
    doc = _pdf_like_doc({"fuel": ["Nomex"], "url": "https://ntrs.nasa.gov/x"})
    ext = _extractor(FakeChain(_extraction(o2_pct_min=None, o2_pct_max=24.0)), tmp_path)
    await ext.extract_investigation(doc)
    assert doc.metadata["fuel"] == ["Nomex"]
    assert doc.metadata["url"] == "https://ntrs.nasa.gov/x"
    assert doc.metadata["o2_range"] == [24.0, 24.0]
    assert doc.metadata["investigation"] == "BASS-II"


async def test_chain_failure_falls_back_to_heuristic(tmp_path: Path) -> None:
    doc = _pdf_like_doc()
    chain = FakeChain(None)
    ext = _extractor(chain, tmp_path)
    assert await ext.extract_investigation(doc) is None  # heuristic finds nothing without front matter
    assert len(chain.calls) == 1 and ext.stats.failures == 1
    assert doc.metadata == {}


async def test_unknown_program_returns_heuristic_but_still_enriches(tmp_path: Path) -> None:
    doc = _pdf_like_doc()
    ext = _extractor(FakeChain(_extraction(program="Hypothetical-X9")), tmp_path)
    assert await ext.extract_investigation(doc) is None
    assert "investigation" not in doc.metadata
    assert doc.metadata["fuel"] == ["PMMA", "Cotton-Fiberglass"]


async def test_second_run_uses_cache(tmp_path: Path) -> None:
    chain = FakeChain(_extraction())
    first = _extractor(chain, tmp_path)
    await first.extract_investigation(_pdf_like_doc())
    second = _extractor(chain, tmp_path)
    inv = await second.extract_investigation(_pdf_like_doc())
    assert inv is not None and inv.program is Program.BASS_II
    assert len(chain.calls) == 1
    assert second.stats.cache_hits == 1 and second.stats.by_provider["cache"] == 1

    no_cache = _extractor(chain, tmp_path, use_cache=False)
    await no_cache.extract_investigation(_pdf_like_doc())
    assert len(chain.calls) == 2
