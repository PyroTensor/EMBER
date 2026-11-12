"""Base model, error envelope and the ``responses=`` helper for routers."""

from __future__ import annotations

from typing import Any, Final

from pydantic import BaseModel, ConfigDict


class APIModel(BaseModel):
    """Base for API schemas: builds from ORM objects / dataclasses and accepts field names or aliases."""

    model_config = ConfigDict(from_attributes=True, populate_by_name=True)


class ErrorBody(APIModel):
    code: str  # NOT_FOUND | VALIDATION_ERROR | UPSTREAM_UNAVAILABLE | INTERNAL_ERROR | ...
    message: str
    details: dict[str, Any] | list[Any] | None = None


class ErrorResponse(APIModel):
    """``{"error": {code, message, details}}``, rendered by ``core/error_handlers.py``."""

    error: ErrorBody


_ERROR_DESCRIPTIONS: Final[dict[int, str]] = {
    400: "Bad request",
    404: "Not found",
    422: "Validation error",
    500: "Internal server error",
    503: "Upstream (LLM / retrieval) unavailable",
}


def error_responses(*codes: int) -> dict[int | str, dict[str, Any]]:
    """``responses=error_responses(404, 422, 500)`` documents the error envelope for those status codes."""
    descriptions = _ERROR_DESCRIPTIONS
    return {code: {"model": ErrorResponse, "description": descriptions.get(code, "Error")} for code in codes}


__all__ = ["APIModel", "ErrorBody", "ErrorResponse", "error_responses"]
