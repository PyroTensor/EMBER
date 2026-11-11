"""EMBER FastAPI server (Squad 2)."""
from __future__ import annotations

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes_cabin import router as cabin_router
from app.api.routes_copilot import router as copilot_router
from app.api.routes_experiments import router as experiments_router
from app.api.routes_health import router as health_router

app = FastAPI(
    title="EMBER API",
    version="0.1.0",
    description="Exploration Microgravity Burn Evaluation & Ranking - NASA Space Apps 2026",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health_router)
app.include_router(cabin_router)
app.include_router(experiments_router)
app.include_router(copilot_router)
