"""Optional LangSmith tracing hook (enabled automatically when ``LANGSMITH_API_KEY`` is set)."""

from __future__ import annotations

import os

from app.core.config import Settings


def configure_tracing(settings: Settings) -> bool:
    """Export the LangChain tracing env vars when a LangSmith key is configured. Returns True if enabled."""
    key = settings.LANGSMITH_API_KEY.get_secret_value().strip()
    if not key:
        return False
    os.environ["LANGCHAIN_TRACING_V2"] = "true"
    os.environ.setdefault("LANGCHAIN_API_KEY", key)
    os.environ.setdefault("LANGCHAIN_PROJECT", settings.LANGSMITH_PROJECT)
    return True
