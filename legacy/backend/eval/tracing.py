"""Optional LangSmith tracing hook (enabled automatically if LANGSMITH_API_KEY is set)."""
from __future__ import annotations

import os


def configure_tracing() -> bool:
    key = os.getenv("LANGSMITH_API_KEY", "").strip()
    if not key:
        return False
    os.environ["LANGCHAIN_TRACING_V2"] = "true"
    os.environ.setdefault("LANGCHAIN_PROJECT", os.getenv("LANGSMITH_PROJECT", "ember"))
    return True
