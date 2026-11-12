import { apiFetch, toQuery } from "@/lib/api/client";
import type { ExperimentFilters, RankRequest, RankResponse, Telemetry, TestRunRecord } from "@/lib/api/types";

/** GET /api/experiments with optional filters as query params. */
export const getExperiments = (filters: ExperimentFilters = {}, signal?: AbortSignal) =>
  apiFetch<TestRunRecord[]>(`/api/experiments${toQuery(filters)}`, { signal });

/** POST /api/experiments/rank */
export const rankExperiments = (req: RankRequest, signal?: AbortSignal) =>
  apiFetch<RankResponse>("/api/experiments/rank", { method: "POST", body: req, signal });

/** GET /api/telemetry/{experiment_id}; 404 TELEMETRY_NOT_FOUND when the run has no stored series. */
export const getTelemetry = (experimentId: string, signal?: AbortSignal) =>
  apiFetch<Telemetry>(`/api/telemetry/${encodeURIComponent(experimentId)}`, { signal });
