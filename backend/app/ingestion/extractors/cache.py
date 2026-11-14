"""Extraction cache + audit trail: ``<CACHE_DIR>/extractions/<doc_id>/<kind>_p<NNN>.json``.

The key is ``sha256(prompt_version + schema name + "\\n" + user_text)``. It does not depend on the provider,
so a result that came from the Gemini fallback is reused too. Failed chain results are written as well
(``parsed: null``) for audit, but they are never a cache hit.
"""

from __future__ import annotations

import hashlib
import json
import os
import re
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

from app.core.config import get_settings
from app.ingestion.extractors.llm_clients import ChainResult

_UNSAFE = re.compile(r"[^A-Za-z0-9._-]+")


def cache_key(prompt_version: str, schema_name: str, user_text: str) -> str:
    return hashlib.sha256(f"{prompt_version}{schema_name}\n{user_text}".encode()).hexdigest()


def _safe(part: str) -> str:
    cleaned = _UNSAFE.sub("_", part).strip("._")
    return cleaned or "_"


class ExtractionCache:
    def __init__(self, root: Path | None = None) -> None:
        self.root = root if root is not None else get_settings().CACHE_DIR / "extractions"

    def path(self, doc_id: str, kind: str, page: int) -> Path:
        return self.root / _safe(doc_id) / f"{_safe(kind)}_p{page:03d}.json"

    def get(self, doc_id: str, kind: str, page: int, key: str) -> dict[str, Any] | None:
        """Parsed JSON for ``key``, or ``None`` (missing, other key, failed result or unreadable file)."""
        p = self.path(doc_id, kind, page)
        try:
            entry = json.loads(p.read_text(encoding="utf-8"))
        except (OSError, ValueError):
            return None
        if not isinstance(entry, dict) or entry.get("key") != key:
            return None
        parsed = entry.get("parsed")
        return parsed if isinstance(parsed, dict) else None

    def put(
        self, doc_id: str, kind: str, page: int, key: str, *, prompt_version: str, result: ChainResult
    ) -> Path:
        """Write the entry atomically (tmp file + replace)."""
        p = self.path(doc_id, kind, page)
        p.parent.mkdir(parents=True, exist_ok=True)
        entry = {
            "key": key,
            "prompt_version": prompt_version,
            "provider": result.provider,
            "model": result.model,
            "attempts": result.attempts,
            "raw": result.raw,
            "parsed": result.parsed.model_dump(mode="json") if result.parsed is not None else None,
            "created_at": datetime.now(UTC).isoformat(),
        }
        tmp = p.with_name(p.name + ".tmp")
        tmp.write_text(json.dumps(entry, ensure_ascii=False, indent=2), encoding="utf-8")
        os.replace(tmp, p)
        return p


__all__ = ["ExtractionCache", "cache_key"]
