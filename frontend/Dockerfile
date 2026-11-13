# syntax=docker/dockerfile:1
# EMBER frontend image. Build from the repo root:
#   docker build -t ember-frontend frontend                                   # mock mode (MSW in the browser)
#   docker build -t ember-frontend \
#     --build-arg NEXT_PUBLIC_API_MODE=live \
#     --build-arg NEXT_PUBLIC_API_URL=http://localhost:8000 frontend          # against a backend
# NEXT_PUBLIC_* values are inlined into the browser bundle at build time: changing them needs a rebuild.
# Run:  docker run --rm -p 3000:3000 ember-frontend

# ── deps: install the locked dependencies (dev deps included: the build needs TypeScript, Tailwind, MSW) ──
FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN --mount=type=cache,target=/root/.npm \
    npm ci --no-audit --no-fund

# ── build: next build → .next/standalone ─────────────────────────────────────────────────────────────
FROM node:22-alpine AS build
WORKDIR /app

ARG NEXT_PUBLIC_API_MODE=mock
ARG NEXT_PUBLIC_API_URL=http://localhost:8000
ARG NEXT_PUBLIC_ALLOW_MODE_TOGGLE=true
ENV NEXT_PUBLIC_API_MODE=$NEXT_PUBLIC_API_MODE \
    NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL \
    NEXT_PUBLIC_ALLOW_MODE_TOGGLE=$NEXT_PUBLIC_ALLOW_MODE_TOGGLE \
    NEXT_TELEMETRY_DISABLED=1

COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

# ── runtime: standalone server + public + static assets, non-root ────────────────────────────────────
FROM node:22-alpine AS runtime
WORKDIR /app

ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    HOSTNAME=0.0.0.0 \
    PORT=3000

RUN addgroup -S -g 10001 app && adduser -S -u 10001 -G app -H -h /app app

COPY --from=build --chown=app:app /app/.next/standalone ./
COPY --from=build --chown=app:app /app/public ./public
COPY --from=build --chown=app:app /app/.next/static ./.next/static

USER app

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
    CMD ["node", "-e", "fetch('http://127.0.0.1:3000/').then(r => process.exit(r.ok ? 0 : 1), () => process.exit(1))"]

CMD ["node", "server.js"]
