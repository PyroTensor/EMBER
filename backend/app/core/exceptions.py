"""Application error hierarchy. Services raise these; ``error_handlers`` renders the envelope."""

from __future__ import annotations

from typing import Any


class AppError(Exception):
    status_code: int = 500
    code: str = "INTERNAL_ERROR"

    def __init__(self, message: str, code: str | None = None, details: Any = None) -> None:
        super().__init__(message)
        self.message = message
        if code is not None:
            self.code = code
        self.details = details


class NotFoundError(AppError):
    status_code = 404
    code = "NOT_FOUND"


class InvalidInputError(AppError):
    status_code = 400
    code = "INVALID_INPUT"


class UpstreamUnavailableError(AppError):
    status_code = 503
    code = "UPSTREAM_UNAVAILABLE"


class UpstreamTimeoutError(AppError):
    status_code = 504
    code = "UPSTREAM_TIMEOUT"
