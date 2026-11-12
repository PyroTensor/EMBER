import { apiFetch, toQuery } from "@/lib/api/client";
import type { ExperimentFilters, TestRunRecord } from "@/lib/api/types";

/** GET /api/experiments with optional filters as query params. */
export const getExperiments = (filters: ExperimentFilters = {}, signal?: AbortSignal) =>
  apiFetch<TestRunRecord[]>(`/api/experiments${toQuery(filters)}`, { signal });
