"""I7: NTRS / URL source fetcher with httpx.MockTransport (no network, no real sleeping)."""

from __future__ import annotations

import json
import sys
from collections.abc import Callable
from pathlib import Path

import httpx
import pytest

BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from app.core.config import get_settings  # noqa: E402
from app.ingestion.stages import fetch_cache  # noqa: E402
from app.ingestion.stages.fetch_cache import (  # noqa: E402
    HostPolicy,
    fetch_sources,
    fetch_url,
    ntrs_pdf_urls,
    sanitize_filename,
)

PDF_BYTES = b"%PDF-1.7 fake pdf body"
CITATION = {
    "id": "20205004657",
    "downloads": [
        {
            "mimetype": "application/pdf",
            "links": {
                "original": "/api/citations/20205004657/downloads/paper.pdf",
                "pdf": "/api/citations/20205004657/downloads/paper.pdf",
                "fulltext": "/api/citations/20205004657/downloads/paper.pdf.txt",
            },
        }
    ],
}
ALLOW_ALL = "User-agent: *\nAllow: /\n"


@pytest.fixture(autouse=True)
def _isolated_cache(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("CACHE_DIR", str(tmp_path / "cache"))
    get_settings.cache_clear()
    yield
    get_settings.cache_clear()


class Recorder:
    def __init__(self) -> None:
        self.requests: list[tuple[str, str]] = []
        self.sleeps: list[float] = []

    async def sleep(self, s: float) -> None:
        self.sleeps.append(s)


def _client(handler: Callable[[httpx.Request], httpx.Response], rec: Recorder) -> httpx.AsyncClient:
    def wrapped(request: httpx.Request) -> httpx.Response:
        rec.requests.append((request.method, str(request.url)))
        return handler(request)

    return httpx.AsyncClient(
        transport=httpx.MockTransport(wrapped),
        headers={"User-Agent": fetch_cache.USER_AGENT},
        follow_redirects=True,
    )


def _ntrs_handler(etag: str = '"v1"', robots: str = ALLOW_ALL) -> Callable[[httpx.Request], httpx.Response]:
    def handler(request: httpx.Request) -> httpx.Response:
        assert request.headers["user-agent"] == "EMBER-ingest/0.1"
        path = request.url.path
        if path == "/robots.txt":
            return httpx.Response(200, text=robots)
        if path == "/api/citations/20205004657":
            return httpx.Response(200, json=CITATION)
        if path.endswith("/paper.pdf"):
            headers = {"etag": etag, "last-modified": "Thu, 06 Aug 2020 22:00:20 GMT"}
            if request.method == "HEAD":
                return httpx.Response(200, headers=headers)
            return httpx.Response(
                200, content=PDF_BYTES, headers={**headers, "content-type": "application/pdf"}
            )
        return httpx.Response(404)

    return handler


def _leftovers(folder: Path, pattern: str) -> list[Path]:
    return list(folder.glob(pattern))


def _sources(tmp_path: Path, spec: dict[str, object]) -> Path:
    p = tmp_path / "sources.yaml"
    p.write_text(json.dumps(spec), encoding="utf-8")  # JSON is valid YAML
    return p


async def test_ntrs_json_pdf_saved_under_corpus(tmp_path: Path) -> None:
    rec = Recorder()
    src = tmp_path / "drop"
    async with _client(_ntrs_handler(), rec) as client:
        report = await fetch_sources(
            _sources(tmp_path, {"ntrs": ["20205004657"]}), src, client=client, sleep=rec.sleep
        )
    dest = src / "corpus" / "20205004657.pdf"
    assert report.downloaded == 1 and report.failed == 0 and report.paths == [dest]
    assert dest.read_bytes() == PDF_BYTES
    assert not list((src / "corpus").glob("*.part"))
    state = json.loads(fetch_cache.downloads_state_path().read_text(encoding="utf-8"))
    (entry,) = state.values()
    assert entry["etag"] == '"v1"'


async def test_unchanged_etag_skipped(tmp_path: Path) -> None:
    src = tmp_path / "drop"
    sources = _sources(tmp_path, {"ntrs": ["20205004657"]})
    rec = Recorder()
    async with _client(_ntrs_handler(), rec) as client:
        await fetch_sources(sources, src, client=client, sleep=rec.sleep)
    rec2 = Recorder()
    async with _client(_ntrs_handler(), rec2) as client:
        report = await fetch_sources(sources, src, client=client, sleep=rec2.sleep)
    assert report.downloaded == 0 and report.skipped == 1
    assert ("GET", "https://ntrs.nasa.gov/api/citations/20205004657/downloads/paper.pdf") not in rec2.requests
    assert any(m == "HEAD" for m, _ in rec2.requests)
    # a changed ETag downloads again
    rec3 = Recorder()
    async with _client(_ntrs_handler(etag='"v2"'), rec3) as client:
        report = await fetch_sources(sources, src, client=client, sleep=rec3.sleep)
    assert report.downloaded == 1


async def test_robots_disallow_skipped(tmp_path: Path) -> None:
    rec = Recorder()
    handler = _ntrs_handler(robots="User-agent: *\nDisallow: /api/citations/20205004657/downloads/\n")
    async with _client(handler, rec) as client:
        report = await fetch_sources(
            _sources(tmp_path, {"ntrs": ["20205004657"]}), tmp_path / "drop", client=client, sleep=rec.sleep
        )
    assert report.downloaded == 0 and report.failed == 1
    assert "robots" in report.errors[0]
    assert not (tmp_path / "drop" / "corpus" / "20205004657.pdf").exists()


async def test_traversal_filename_sanitized(tmp_path: Path) -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        if request.url.path == "/robots.txt":
            return httpx.Response(404)
        return httpx.Response(
            200,
            content=b"a,b\n1,2\n",
            headers={"content-disposition": 'attachment; filename="../../evil RUNS.CSV"'},
        )

    rec = Recorder()
    src = tmp_path / "drop"
    async with _client(handler, rec) as client:
        report = await fetch_sources(
            _sources(tmp_path, {"urls": [{"url": "https://data.example.org/get?id=7", "to": "."}]}),
            src,
            client=client,
            sleep=rec.sleep,
        )
    (path,) = report.paths
    assert path == src / "evil_RUNS.csv"
    assert path.resolve().is_relative_to(src.resolve())
    assert sanitize_filename("..\\..\\x.PDF") == "x.pdf"
    assert sanitize_filename("../..") == "download"


async def test_429_retry_after_honoured(tmp_path: Path) -> None:
    calls = {"pdf": 0}

    def handler(request: httpx.Request) -> httpx.Response:
        if request.url.path == "/robots.txt":
            return httpx.Response(200, text=ALLOW_ALL)
        calls["pdf"] += 1
        if calls["pdf"] == 1:
            return httpx.Response(429, headers={"retry-after": "7"})
        return httpx.Response(200, content=PDF_BYTES)

    rec = Recorder()
    async with _client(handler, rec) as client:
        report = await fetch_sources(
            _sources(tmp_path, {"urls": [{"url": "https://files.example.org/a.pdf", "to": "corpus"}]}),
            tmp_path / "drop",
            client=client,
            sleep=rec.sleep,
        )
    assert report.downloaded == 1 and calls["pdf"] == 2
    assert 7.0 in rec.sleeps


async def test_rate_limit_one_request_per_second_per_host() -> None:
    rec = Recorder()
    now = [100.0]
    policy = HostPolicy(httpx.AsyncClient(), sleep=rec.sleep, clock=lambda: now[0])
    await policy.wait("a.example")
    now[0] += 0.25
    await policy.wait("a.example")
    await policy.wait("b.example")  # other host: no wait
    assert rec.sleeps == [pytest.approx(0.75)]


async def test_content_length_over_limit_rejected(tmp_path: Path) -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        if request.url.path == "/robots.txt":
            return httpx.Response(404)
        return httpx.Response(200, content=b"x" * 50, headers={"content-length": "50"})

    rec = Recorder()
    async with _client(handler, rec) as client:
        with pytest.raises(fetch_cache.FetchError, match="limit"):
            await fetch_url("https://big.example.org/huge.pdf", tmp_path, client=client, max_bytes=10)
    assert not _leftovers(tmp_path, "huge.pdf*")


async def test_ntrs_pdf_urls_defensive() -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        if request.url.path.endswith("/1"):
            return httpx.Response(200, json=CITATION)
        if request.url.path.endswith("/2"):
            return httpx.Response(200, json={"downloads": [{"links": None}, "junk", {"links": {"pdf": ""}}]})
        return httpx.Response(200, json=["not", "a", "dict"])

    rec = Recorder()
    async with _client(handler, rec) as client:
        policy = HostPolicy(client, sleep=rec.sleep)
        assert await ntrs_pdf_urls("1", client, policy) == [
            "https://ntrs.nasa.gov/api/citations/20205004657/downloads/paper.pdf"
        ]
        assert await ntrs_pdf_urls("2", client, policy) == []
        assert await ntrs_pdf_urls("3", client, policy) == []


async def test_bad_url_entries_counted_as_failed(tmp_path: Path) -> None:
    rec = Recorder()
    async with _client(lambda r: httpx.Response(404), rec) as client:
        report = await fetch_sources(
            _sources(
                tmp_path,
                {"urls": [{"url": "ftp://x/y"}, {"url": "https://ok.example/z.csv", "to": "../../etc"}]},
            ),
            tmp_path / "drop",
            client=client,
            sleep=rec.sleep,
        )
    assert report.failed == 2 and report.downloaded == 0
    assert rec.requests == []  # rejected before any request
