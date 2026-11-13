"""System prompts for the RAG graph, stored as ``<name>.md`` next to this file and read once."""

from __future__ import annotations

from functools import lru_cache
from pathlib import Path
from typing import Final

_PROMPT_DIR: Final[Path] = Path(__file__).resolve().parent


@lru_cache(maxsize=16)
def load_prompt(name: str) -> str:
    """Return the text of ``prompts/<name>.md`` (stripped). Raises ``FileNotFoundError`` for unknown names."""
    if not name.isidentifier():
        raise ValueError(f"invalid prompt name: {name!r}")
    return (_PROMPT_DIR / f"{name}.md").read_text(encoding="utf-8").strip()


__all__ = ["load_prompt"]
