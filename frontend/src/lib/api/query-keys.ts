import type { CabinConfig, ExperimentFilters, RankRequest } from "./types";

/** Query keys in one place so invalidation stays consistent. */
export const qk = {
  all: ["api"] as const,
  health: () => ["api", "health"] as const,
  presets: () => ["api", "presets"] as const,
  cabin: (cfg: CabinConfig) => ["api", "cabin", cfg] as const,
  experiments: (filters: ExperimentFilters = {}) => ["api", "experiments", filters] as const,
  rank: (req: RankRequest) => ["api", "rank", req] as const,
  telemetry: (experimentId: string) => ["api", "telemetry", experimentId] as const,
};
