"""FastAPI application factory."""

from __future__ import annotations

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.router import api_router
from app.core.config import get_settings
from app.core.constants import SCHEMA_VERSION
from app.core.error_handlers import register_error_handlers
from app.core.lifespan import lifespan
from app.core.logging import setup_logging
from app.core.middleware import REQUEST_ID_HEADER, RequestIDMiddleware


def create_app() -> FastAPI:
    settings = get_settings()
    setup_logging(settings.LOG_LEVEL, settings.LOG_JSON)

    app = FastAPI(
        title="EMBER API",
        version=SCHEMA_VERSION,
        separate_input_output_schemas=False,
        lifespan=lifespan,
    )

    app.add_middleware(RequestIDMiddleware)
    # Added last → outermost, so CORS headers are present even on error responses.
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.CORS_ORIGINS,
        allow_credentials=False,
        allow_methods=["GET", "POST"],
        allow_headers=["*"],
        expose_headers=[REQUEST_ID_HEADER],
    )

    register_error_handlers(app)
    app.include_router(api_router)
    return app


app = create_app()
