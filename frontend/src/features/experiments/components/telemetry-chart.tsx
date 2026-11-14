"use client";

import { Activity } from "lucide-react";
import { LineChart, type LineSeries } from "@/components/charts/line-chart";
import type { Domain } from "@/components/charts/use-linear-scale";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { Skeleton } from "@/components/ui/skeleton";
import { isApiError } from "@/lib/api/errors";
import type { Telemetry } from "@/lib/api/types";
import { useTelemetry } from "../hooks";

export const TELEMETRY_CHANNELS = {
  flame_radius_mm: {
    label: "Flame radius",
    unit: "mm",
    color: "var(--color-accent)",
    digits: 2,
  },
  d_squared_mm2: {
    label: "Droplet d²",
    unit: "mm²",
    color: "var(--color-risk-elevated)",
    digits: 3,
  },
  radiative_heat_flux_kw_m2: {
    label: "Radiative flux",
    unit: "kW/m²",
    color: "#38bdf8",
    digits: 2,
  },
  flame_temp_k: {
    label: "Flame temperature",
    unit: "K",
    color: "#a78bfa",
    digits: 1,
  },
} as const;

export type TelemetryChannel = keyof typeof TELEMETRY_CHANNELS;

export const TELEMETRY_OPTIONS = (
  Object.keys(TELEMETRY_CHANNELS) as TelemetryChannel[]
).map((value) => ({
  value,
  label: `${TELEMETRY_CHANNELS[value].label} (${TELEMETRY_CHANNELS[value].unit})`,
}));

export const telemetryValues = (
  telemetry: Telemetry,
  channel: TelemetryChannel,
) => telemetry[channel] ?? null;

export const isTelemetryMissing = (error: unknown) =>
  isApiError(error) &&
  (error.status === 404 || error.code === "TELEMETRY_NOT_FOUND");

/** One quantity per plot, so its y-axis always has exactly one unit. */
export function TelemetryPlot({
  telemetry,
  channel,
  xDomain,
  yDomain,
  height,
}: {
  telemetry: Telemetry;
  channel: TelemetryChannel;
  xDomain?: Domain;
  yDomain?: Domain;
  height?: number;
}) {
  const meta = TELEMETRY_CHANNELS[channel];
  const values = telemetryValues(telemetry, channel);
  if (
    !telemetry.time_s.length ||
    !values?.some((value) => value !== null && Number.isFinite(value))
  ) {
    return (
      <EmptyState
        icon={Activity}
        title={`No ${meta.label.toLowerCase()} data`}
        description={`This channel is not recorded for ${telemetry.experiment_id}. Try another channel.`}
      />
    );
  }

  const series: LineSeries = {
    key: channel,
    label: meta.label,
    values,
    color: meta.color,
    unit: meta.unit,
    format: (value) => value.toFixed(meta.digits),
  };

  return (
    <LineChart
      label={`${meta.label} for ${telemetry.experiment_id}`}
      x={telemetry.time_s}
      xLabel="Time (s)"
      xFormat={(value) => String(Number(value.toPrecision(4)))}
      series={[series]}
      leftLabel={`${meta.label} (${meta.unit})`}
      xDomain={xDomain}
      yDomain={yDomain}
      height={height}
    />
  );
}

/** Loads the selected run's telemetry and displays the chosen channel. */
export function TelemetryChart({
  experimentId,
  channel,
}: {
  experimentId: string;
  channel: TelemetryChannel;
}) {
  const telemetry = useTelemetry(experimentId);

  if (telemetry.isPending) {
    return (
      <div role="status" aria-busy="true" className="space-y-3">
        <span className="sr-only">Loading telemetry for {experimentId}…</span>
        <Skeleton className="h-4 w-48" />
        <Skeleton className="h-64" />
      </div>
    );
  }

  if (telemetry.isError) {
    return isTelemetryMissing(telemetry.error) ? (
      <EmptyState
        icon={Activity}
        title={`No telemetry for ${experimentId}`}
        description="This run has no stored time series. Its summary values are in the run details."
      />
    ) : (
      <ErrorState
        title={`Couldn't load telemetry for ${experimentId}`}
        error={telemetry.error}
        onRetry={() => void telemetry.refetch()}
        retrying={telemetry.isFetching}
      />
    );
  }

  return <TelemetryPlot telemetry={telemetry.data} channel={channel} />;
}
