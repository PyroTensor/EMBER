"""Top-level API router."""

from __future__ import annotations

from fastapi import APIRouter

from app.api.routers import cabin, copilot, documents, experiments, health, presets, telemetry

api_router = APIRouter(prefix="/api")
api_router.include_router(health.router)
api_router.include_router(presets.router)
api_router.include_router(cabin.router)
api_router.include_router(experiments.router)
api_router.include_router(telemetry.router)
api_router.include_router(documents.router)
api_router.include_router(copilot.router)
