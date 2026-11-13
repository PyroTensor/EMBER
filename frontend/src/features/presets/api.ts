import { apiFetch } from "@/lib/api/client";
import type { Preset } from "@/lib/api/types";

/** GET /api/presets */
export const getPresets = (signal?: AbortSignal) => apiFetch<Preset[]>("/api/presets", { signal });
