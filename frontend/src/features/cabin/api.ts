import { apiFetch } from "@/lib/api/client";
import type { CabinConfig, CabinEvaluation } from "@/lib/api/types";

/** POST /api/evaluate-cabin */
export const evaluateCabin = (cfg: CabinConfig, signal?: AbortSignal) =>
  apiFetch<CabinEvaluation>("/api/evaluate-cabin", { method: "POST", body: cfg, signal });
