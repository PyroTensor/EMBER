"use client";

import { Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import type { RankedExperiment } from "@/lib/api/types";

export interface RunFilters {
  query: string;
  program: string;
  material: string;
  regime: string;
  telemetry: "all" | "available" | "unavailable";
  pageSize: 10 | 25 | 50;
}

export const DEFAULT_RUN_FILTERS: RunFilters = {
  query: "",
  program: "all",
  material: "all",
  regime: "all",
  telemetry: "all",
  pageSize: 10,
};

interface RankingFiltersProps {
  value: RunFilters;
  onChange: (next: RunFilters) => void;
  results: readonly RankedExperiment[];
  matches: number;
  shown: number;
  checkingTelemetry: boolean;
}

function options(values: (string | null | undefined)[]) {
  return [
    { value: "all", label: "All" },
    ...Array.from(
      new Set(values.filter((value): value is string => Boolean(value))),
    )
      .sort()
      .map((value) => ({ value, label: value })),
  ];
}

/** Search and filter the ranked result set without changing any scores. */
export function RankingFilters({
  value,
  onChange,
  results,
  matches,
  shown,
  checkingTelemetry,
}: RankingFiltersProps) {
  const update = <K extends keyof RunFilters>(key: K, next: RunFilters[K]) =>
    onChange({ ...value, [key]: next });
  const hasFilters =
    value.query ||
    value.program !== "all" ||
    value.material !== "all" ||
    value.regime !== "all" ||
    value.telemetry !== "all";

  return (
    <div className="space-y-3 px-5 py-4">
      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-[210px] flex-1 space-y-1.5">
          <label
            htmlFor="ranked-run-search"
            className="text-muted block text-xs font-medium"
          >
            Search ranked runs
          </label>
          <div className="relative">
            <Search
              aria-hidden
              className="text-muted pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2"
            />
            <input
              id="ranked-run-search"
              type="search"
              value={value.query}
              onChange={(event) => update("query", event.target.value)}
              placeholder="Program, material, or regime"
              className="border-border bg-surface-2 text-fg placeholder:text-muted h-10 w-full rounded-md border pr-3 pl-9 text-sm"
            />
          </div>
        </div>
        {hasFilters ? (
          <Button
            variant="ghost"
            size="sm"
            onClick={() =>
              onChange({ ...DEFAULT_RUN_FILTERS, pageSize: value.pageSize })
            }
          >
            <X aria-hidden className="size-3.5" /> Clear filters
          </Button>
        ) : null}
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Select
          label="Program"
          value={value.program}
          options={options(results.map((run) => run.record?.program))}
          onChange={(next) => update("program", next)}
        />
        <Select
          label="Material"
          value={value.material}
          options={options(results.map((run) => run.record?.fuel_material))}
          onChange={(next) => update("material", next)}
        />
        <Select
          label="Combustion regime"
          value={value.regime}
          options={options(results.map((run) => run.record?.combustion_regime))}
          onChange={(next) => update("regime", next)}
        />
        <Select
          label="Telemetry"
          value={value.telemetry}
          options={[
            { value: "all", label: "All runs" },
            { value: "available", label: "Time series available" },
            { value: "unavailable", label: "No time series" },
          ]}
          onChange={(next) => update("telemetry", next)}
        />
      </div>

      <div
        className="text-muted flex flex-wrap items-center justify-between gap-2 text-xs"
        aria-live="polite"
      >
        <p>
          {checkingTelemetry
            ? "Checking which ranked runs have telemetry…"
            : `Showing ${shown} of ${matches} matches within the top ${results.length} ranked runs.`}
        </p>
        <Select
          label="Show up to"
          value={String(value.pageSize)}
          options={["10", "25", "50"]}
          onChange={(next) =>
            update("pageSize", Number(next) as RunFilters["pageSize"])
          }
          className="w-32"
        />
      </div>
    </div>
  );
}
