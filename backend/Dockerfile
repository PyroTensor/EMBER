# syntax=docker/dockerfile:1
# EMBER backend image. Build from the repo root:  docker build -t ember-backend backend
# Optional: bake the embedding model into the image (no download on first start):
#   docker build --build-arg PRELOAD_EMBED_MODEL=1 -t ember-backend backend
# Runtime config comes from environment variables (see .env.example); DB_USER, DB_PASSWORD, DB_NAME are required.

# ── builder: resolve the locked environment with uv ──────────────────────────────────────────────
FROM ghcr.io/astral-sh/uv:python3.12-bookworm-slim AS builder

ENV UV_COMPILE_BYTECODE=1 \
    UV_LINK_MODE=copy \
    UV_PYTHON_DOWNLOADS=never \
    HF_HOME=/app/.cache/huggingface

WORKDIR /app

COPY pyproject.toml uv.lock .python-version ./
RUN --mount=type=cache,target=/root/.cache/uv \
    uv sync --frozen --no-dev

ARG PRELOAD_EMBED_MODEL=0
ARG EMBED_MODEL=BAAI/bge-small-en-v1.5
RUN mkdir -p "$HF_HOME" && \
    if [ "$PRELOAD_EMBED_MODEL" = "1" ]; then \
        .venv/bin/python -c "import sys; from sentence_transformers import SentenceTransformer; SentenceTransformer(sys.argv[1])" "$EMBED_MODEL"; \
    fi

# ── runtime: slim Python + the prebuilt venv, non-root ───────────────────────────────────────────
FROM python:3.12-slim AS runtime

ENV PATH="/app/.venv/bin:$PATH" \
    PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    HF_HOME=/app/.cache/huggingface

RUN groupadd --system --gid 10001 app && \
    useradd --system --uid 10001 --gid app --home-dir /app --no-create-home app

WORKDIR /app

COPY --from=builder --chown=app:app /app/.venv /app/.venv
COPY --from=builder --chown=app:app /app/.cache /app/.cache
COPY --chown=app:app app ./app
COPY --chown=app:app alembic ./alembic
COPY --chown=app:app alembic.ini ./
COPY --chown=app:app data/seed ./data/seed
COPY --chown=app:app scripts ./scripts
# data/.cache holds the snapshot fallback and ingestion outputs: must be writable by the app user.
RUN mkdir -p /app/data/.cache && chown -R app:app /app/data

USER app

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=5s --start-period=60s --retries=3 \
    CMD ["python", "-c", "import sys, urllib.request; sys.exit(0 if urllib.request.urlopen('http://127.0.0.1:8000/api/health', timeout=4).status == 200 else 1)"]

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
