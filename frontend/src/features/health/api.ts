import { apiFetch } from "@/lib/api/client";
import type { Health } from "@/lib/api/types";

/** GET /api/health */
export const getHealth = (signal?: AbortSignal) => apiFetch<Health>("/api/health", { signal });
