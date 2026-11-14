import type { DocumentSummary, TestRunRecord } from "@/lib/api/types";
import type { ApiMode } from "@/lib/config/env";

export type DataOrigin = "proxy" | "sourced" | "unverified";

const OPTIONAL_OUTCOMES = [
  ["spread_or_burn_rate", "spread or burn rate"],
  ["peak_radiative_flux_kw_m2", "peak radiative flux"],
  ["limiting_oxygen_index_pct", "limiting oxygen index"],
  ["burn_duration_s", "burn duration"],
] as const;

export function dataOrigin(
  run: TestRunRecord,
  documents: ReadonlyMap<string, DocumentSummary>,
  mode: ApiMode,
): DataOrigin {
  if (mode === "mock") return "proxy";
  const source = run.source_doc_id
    ? documents.get(run.source_doc_id.toUpperCase())
    : undefined;
  if (source?.is_proxy === true) return "proxy";
  if (source?.is_proxy === false) return "sourced";
  return "unverified";
}

export const ORIGIN_LABEL: Record<DataOrigin, string> = {
  proxy: "Proxy",
  sourced: "Source-linked",
  unverified: "Origin unverified",
};

export function missingOutcomes(run: TestRunRecord): string[] {
  return OPTIONAL_OUTCOMES.filter(([key]) => run[key] == null).map(
    ([, label]) => label,
  );
}

export function reportedMissingChannels(run: TestRunRecord): number | null {
  const count = run.extra_telemetry?.missing_channels_count;
  return typeof count === "number" && Number.isInteger(count) && count >= 0
    ? count
    : null;
}

export function citedPageAvailable(
  source: DocumentSummary | undefined,
  page: number | null | undefined,
): boolean | null {
  if (!source || page == null) return null;
  return source.pages?.length
    ? source.pages.some((entry) => entry.page === page)
    : page <= source.page_count;
}
