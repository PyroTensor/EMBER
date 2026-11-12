"""ORM models. Importing this package registers every table on ``Base.metadata`` (used by Alembic)."""

from __future__ import annotations

from app.db.base import Base
from app.models.chunk import Chunk
from app.models.document import Document
from app.models.investigation import Investigation
from app.models.preset import Preset
from app.models.telemetry import Telemetry
from app.models.test_run import TestRun

__all__ = ["Base", "Chunk", "Document", "Investigation", "Preset", "Telemetry", "TestRun"]
