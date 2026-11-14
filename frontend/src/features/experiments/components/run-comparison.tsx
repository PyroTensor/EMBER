"use client";

import { useQueries } from "@tanstack/react-query";
import { Activity, X } from "lucide-react";
import type { Domain } from "@/components/charts/use-linear-scale";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { Select } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import type {
  DocumentSummary,
  RankedExperiment,
  Telemetry,
} from "@/lib/api/types";
import { qk } from "@/lib/api/query-keys";
import { fmtCmS, fmtG, fmtKpa, fmtPct } from "@/lib/format";
import { getTelemetry } from "../api";
import { fmtScore, SCORE_COMPONENTS } from "../lib/score-format";
import {
  citedPageAvailable,
  missingOutcomes,
  ORIGIN_LABEL,
  reportedMissingChannels,
  type DataOrigin,
} from "../lib/run-quality";
import {
  isTelemetryMissing,
  TELEMETRY_CHANNELS,
  TELEMETRY_OPTIONS,
  telemetryValues,
  TelemetryPlot,
  type TelemetryChannel,
} from "./telemetry-chart";

interface RunComparisonProps {
  runs: readonly RankedExperiment[];
  channel: TelemetryChannel;
  onChannelChange: (channel: TelemetryChannel) => void;
  onRemove: (experimentId: string) => void;
  origins: ReadonlyMap<string, DataOrigin>;
  documents: ReadonlyMap<string, DocumentSummary>;
  onOpenSource: (docId: string, page?: number) => void;
}

function sharedDomains(
  telemetry: readonly Telemetry[],
  channel: TelemetryChannel,
) {
  const times = telemetry.flatMap((run) => run.time_s.filter(Number.isFinite));
  const values = telemetry.flatMap((run) =>
    (telemetryValues(run, channel) ?? []).filter(Number.isFinite),
  );
  const xDomain: Domain | undefined = times.length
    ? [Math.min(...times), Math.max(...times)]
    : undefined;
  const yDomain: Domain | undefined = values.length
    ? [Math.min(...values), Math.max(...values)]
    : undefined;
  return { xDomain, yDomain };
}

function Condition({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-muted text-[11px]">{label}</dt>
      <dd className="text-fg font-mono text-xs break-words tabular-nums">
        {value}
      </dd>
    </div>
  );
}

/** Pinned runs use the same channel and axes for an honest visual comparison. */
export function RunComparison({
  runs,
  channel,
  onChannelChange,
  onRemove,
  origins,
  documents,
  onOpenSource,
}: RunComparisonProps) {
  const queries = useQueries({
    queries: runs.map((run) => ({
      queryKey: qk.telemetry(run.experiment_id),
      queryFn: ({ signal }: { signal: AbortSignal }) =>
        getTelemetry(run.experiment_id, signal),
      staleTime: Infinity,
    })),
  });
  const loaded = queries.flatMap((query) => (query.data ? [query.data] : []));
  const { xDomain, yDomain } = sharedDomains(loaded, channel);

  return (
    <Card>
      <CardHeader
        title="Compare pinned runs"
        subtitle={`${runs.length} runs · same telemetry channel and axes`}
      />
      <CardBody className="space-y-4">
        <div className="max-w-xs">
          <Select
            label="Telemetry channel for comparison"
            value={channel}
            options={TELEMETRY_OPTIONS}
            onChange={onChannelChange}
          />
        </div>
        <p className="text-muted text-xs">
          Scores use the current scenario and weights; conditions are from each
          run. The charts share time and {TELEMETRY_CHANNELS[channel].unit}{" "}
          scales.
        </p>
        <div className="grid items-start gap-4 lg:grid-cols-2 2xl:grid-cols-3">
          {runs.map((run, index) => {
            const query = queries[index];
            const record = run.record;
            const origin = origins.get(run.experiment_id) ?? "unverified";
            const missing = record ? missingOutcomes(record) : [];
            const missingChannels = record
              ? reportedMissingChannels(record)
              : null;
            const source = record?.source_doc_id
              ? documents.get(record.source_doc_id.toUpperCase())
              : undefined;
            const pageAvailable = citedPageAvailable(
              source,
              record?.source_page,
            );
            return (
              <article
                key={run.experiment_id}
                className="border-border bg-surface-2/30 min-w-0 space-y-4 rounded-md border p-3"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h3 className="text-fg font-mono text-sm font-semibold">
                      {run.experiment_id}
                    </h3>
                    <p className="text-muted text-xs">
                      Rank {run.rank} · {record?.program ?? "Unknown program"}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onRemove(run.experiment_id)}
                    aria-label={`Remove ${run.experiment_id} from comparison`}
                  >
                    <X aria-hidden className="size-3.5" /> Remove
                  </Button>
                </div>
                <div className="text-muted flex flex-wrap items-center gap-2 text-xs">
                  <Badge
                    tone={
                      origin === "proxy"
                        ? "warning"
                        : origin === "sourced"
                          ? "success"
                          : "neutral"
                    }
                  >
                    {ORIGIN_LABEL[origin]}
                  </Badge>
                  <span>
                    {missing.length
                      ? `${missing.length} missing standard outcome${missing.length === 1 ? "" : "s"}`
                      : "4/4 outcomes recorded"}
                  </span>
                  {missingChannels != null && missingChannels > 0 ? (
                    <span>
                      · {missingChannels} source-reported missing channel
                      {missingChannels === 1 ? "" : "s"}
                    </span>
                  ) : null}
                </div>
                {record?.source_doc_id && source ? (
                  <button
                    type="button"
                    onClick={() =>
                      onOpenSource(
                        record.source_doc_id!,
                        pageAvailable === false
                          ? undefined
                          : (record.source_page ?? undefined),
                      )
                    }
                    className="text-accent text-left text-xs underline-offset-2 hover:underline"
                  >
                    Open source [{record.source_doc_id}
                    {pageAvailable !== false && record.source_page != null
                      ? ` p.${record.source_page}`
                      : ""}
                    ]
                  </button>
                ) : null}
                {pageAvailable === false ? (
                  <p className="text-muted text-xs">
                    Cited p.{record?.source_page} is absent from this document
                    copy.
                  </p>
                ) : null}
                <dl className="grid grid-cols-2 gap-x-3 gap-y-2">
                  <Condition
                    label="Material"
                    value={record?.fuel_material ?? "—"}
                  />
                  <Condition
                    label="Regime"
                    value={record?.combustion_regime ?? "—"}
                  />
                  <Condition
                    label="Oxygen"
                    value={record ? fmtPct(record.oxygen_pct) : "—"}
                  />
                  <Condition
                    label="Pressure"
                    value={record ? fmtKpa(record.pressure_kpa) : "—"}
                  />
                  <Condition
                    label="Flow"
                    value={record ? fmtCmS(record.flow_velocity_cm_s) : "—"}
                  />
                  <Condition
                    label="Gravity"
                    value={record ? fmtG(record.gravity_g) : "—"}
                  />
                </dl>
                <div className="border-border border-t pt-3">
                  <p className="text-fg text-sm font-semibold">
                    Total {fmtScore(run.total_score)} / 100
                  </p>
                  <dl className="mt-2 grid grid-cols-3 gap-2">
                    {SCORE_COMPONENTS.map((component) => (
                      <Condition
                        key={component.key}
                        label={component.label}
                        value={fmtScore(run[component.key])}
                      />
                    ))}
                  </dl>
                </div>
                <div className="border-border border-t pt-3">
                  {query?.isPending ? (
                    <div role="status" aria-busy="true">
                      <span className="sr-only">
                        Loading telemetry for {run.experiment_id}…
                      </span>
                      <Skeleton className="h-48" />
                    </div>
                  ) : query?.isError ? (
                    isTelemetryMissing(query.error) ? (
                      <EmptyState
                        icon={Activity}
                        title="No telemetry"
                        description={`No stored time series for ${run.experiment_id}.`}
                      />
                    ) : (
                      <ErrorState
                        title="Couldn't load telemetry"
                        error={query.error}
                        onRetry={() => void query.refetch()}
                        retrying={query.isFetching}
                      />
                    )
                  ) : query?.data ? (
                    <TelemetryPlot
                      telemetry={query.data}
                      channel={channel}
                      xDomain={xDomain}
                      yDomain={yDomain}
                      height={210}
                    />
                  ) : null}
                </div>
              </article>
            );
          })}
        </div>
      </CardBody>
    </Card>
  );
}
