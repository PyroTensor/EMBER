"""Top-level API router."""

from __future__ import annotations

from fastapi import APIRouter

from app.api.routers import cabin, experiments, health, presets

api_router = APIRouter(prefix="/api")
api_router.include_router(health.router)
api_router.include_router(presets.router)
api_router.include_router(cabin.router)
api_router.include_router(experiments.router)
