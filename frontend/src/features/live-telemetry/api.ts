import { apiFetch } from "@/lib/api/client";
import type { LiveTelemetryIngestRequest, LiveTelemetryState } from "@/lib/api/types";

/** GET /api/live-telemetry */
export const getLiveTelemetry = (signal?: AbortSignal) =>
  apiFetch<LiveTelemetryState>("/api/live-telemetry", { signal });

/** POST /api/live-telemetry */
export const ingestLiveTelemetry = (
  payload: LiveTelemetryIngestRequest,
  signal?: AbortSignal,
) =>
  apiFetch<LiveTelemetryState>("/api/live-telemetry", {
    method: "POST",
    body: payload,
    signal,
  });

/** POST /api/live-telemetry/reset */
export const resetLiveTelemetry = (signal?: AbortSignal) =>
  apiFetch<LiveTelemetryState>("/api/live-telemetry/reset", {
    method: "POST",
    signal,
  });
