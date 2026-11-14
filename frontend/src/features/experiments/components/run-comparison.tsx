"use client";

import { useQueries } from "@tanstack/react-query";
import { Activity, X } from "lucide-react";
import { LineChart, type LineSeries } from "@/components/charts/line-chart";
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

const RUN_COLORS = ["#fb923c", "#38bdf8", "#c084fc"];

/** Align different sample times on one axis without drawing across missing measurements. */
function valuesOnTimeline(
  telemetry: Telemetry,
  channel: TelemetryChannel,
  timeline: readonly number[],
): (number | null)[] {
  const values = telemetryValues(telemetry, channel);
  if (!values) return timeline.map(() => null);
  const samples = telemetry.time_s
    .map((time, index) => ({ time, value: values[index] ?? null }))
    .filter((sample) => Number.isFinite(sample.time))
    .sort((a, b) => a.time - b.time);
  let cursor = 0;
  return timeline.map((time) => {
    while (cursor + 1 < samples.length && samples[cursor + 1]!.time < time)
      cursor++;
    const before = samples[cursor];
    const after = samples[cursor + 1];
    if (before?.time === time)
      return Number.isFinite(before.value) ? before.value : null;
    if (after?.time === time)
      return Number.isFinite(after.value) ? after.value : null;
    if (
      !before ||
      !after ||
      before.time > time ||
      !Number.isFinite(before.value) ||
      !Number.isFinite(after.value) ||
      after.time === before.time
    )
      return null;
    return (
      before.value! +
      ((after.value! - before.value!) * (time - before.time)) /
        (after.time - before.time)
    );
  });
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

/** Checked runs share one time axis and one measured quantity. */
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
  const timeline = Array.from(
    new Set(
      loaded.flatMap((telemetry) => telemetry.time_s.filter(Number.isFinite)),
    ),
  ).sort((a, b) => a - b);
  const meta = TELEMETRY_CHANNELS[channel];
  const series: LineSeries[] = runs.flatMap((run, index) => {
    const telemetry = queries[index]?.data;
    if (!telemetry) return [];
    return [
      {
        key: run.experiment_id,
        label: run.experiment_id,
        values: valuesOnTimeline(telemetry, channel, timeline),
        color: RUN_COLORS[index] ?? RUN_COLORS[0]!,
        unit: meta.unit,
        format: (value: number) => value.toFixed(meta.digits),
      },
    ];
  });
  const hasPlottedData = series.some((run) =>
    run.values?.some((value) => value !== null),
  );

  return (
    <Card>
      <CardHeader
        title="Compare pinned runs"
        subtitle={`${runs.length} runs · overlaid on one time and measurement scale`}
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
          run. Lines between measured time points are interpolated.
        </p>
        {hasPlottedData ? (
          <LineChart
            label={`${meta.label} comparison for ${runs.map((run) => run.experiment_id).join(", ")}`}
            x={timeline}
            xLabel="Time (s)"
            series={series}
            leftLabel={`${meta.label} (${meta.unit})`}
            height={320}
          />
        ) : queries.some((query) => query.isPending) ? (
          <div role="status" aria-busy="true">
            <span className="sr-only">Loading comparison telemetry…</span>
            <Skeleton className="h-80" />
          </div>
        ) : (
          <EmptyState
            icon={Activity}
            title={`No ${meta.label.toLowerCase()} data to compare`}
            description="Try another telemetry channel or select runs with recorded time series."
          />
        )}
        {runs.map((run, index) => {
          const query = queries[index];
          if (!query?.isError || isTelemetryMissing(query.error)) return null;
          return (
            <ErrorState
              key={run.experiment_id}
              title={`Couldn't load telemetry for ${run.experiment_id}`}
              error={query.error}
              onRetry={() => void query.refetch()}
              retrying={query.isFetching}
            />
          );
        })}
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
                {query?.isError && isTelemetryMissing(query.error) ? (
                  <p className="text-muted text-xs">
                    No stored time series for this run.
                  </p>
                ) : null}
                {query?.isSuccess &&
                !telemetryValues(query.data, channel)?.some((value) =>
                  Number.isFinite(value),
                ) ? (
                  <p className="text-muted text-xs">
                    No {meta.label.toLowerCase()} measurements for this run.
                  </p>
                ) : null}
              </article>
            );
          })}
        </div>
      </CardBody>
    </Card>
  );
}
