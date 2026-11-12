"use client";

import { Activity } from "lucide-react";
import { LineChart, type LineSeries } from "@/components/charts/line-chart";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { Skeleton } from "@/components/ui/skeleton";
import { isApiError } from "@/lib/api/errors";
import type { Telemetry } from "@/lib/api/types";
import { useTelemetry } from "../hooks";

const isNotFound = (e: unknown) => isApiError(e) && (e.status === 404 || e.code === "TELEMETRY_NOT_FOUND");

function toSeries(t: Telemetry): LineSeries[] {
  return [
    {
      key: "flame_radius_mm",
      label: "Flame radius",
      values: t.flame_radius_mm,
      color: "var(--color-accent)",
      axis: "left",
      unit: "mm",
      format: (v) => v.toFixed(2),
    },
    {
      // Droplet runs only; null for solid fuels, so it is hidden rather than drawn as zero.
      key: "d_squared_mm2",
      label: "Droplet d²",
      values: t.d_squared_mm2,
      color: "var(--color-risk-elevated)",
      axis: "left",
      unit: "mm²",
      format: (v) => v.toFixed(3),
    },
    {
      key: "radiative_heat_flux_kw_m2",
      label: "Radiative flux",
      values: t.radiative_heat_flux_kw_m2,
      color: "#38bdf8",
      axis: "right",
      unit: "kW/m²",
      format: (v) => v.toFixed(2),
    },
  ];
}

/** Flame radius (left axis) vs radiative heat flux (right axis) over time for one run. */
export function TelemetryChart({ experimentId }: { experimentId: string }) {
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
    return isNotFound(telemetry.error) ? (
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

  const t = telemetry.data;
  const series = toSeries(t);
  const hasPoints = (t.time_s?.length ?? 0) > 0 && series.some((s) => s.values?.some((v) => v !== null));
  if (!hasPoints) {
    return (
      <EmptyState
        icon={Activity}
        title={`Empty telemetry for ${experimentId}`}
        description="The API returned a series with no data points."
      />
    );
  }
  const leftUnits = series.filter((s) => s.axis === "left" && s.values?.some((v) => v !== null)).map((s) => s.unit);

  return (
    <LineChart
      label={`Telemetry for ${experimentId}`}
      x={t.time_s ?? []}
      xLabel="Time (s)"
      xFormat={(v) => String(Number(v.toPrecision(4)))}
      series={series}
      leftLabel={leftUnits.length > 1 ? `Radius (mm) / d² (mm²)` : "Flame radius (mm)"}
      rightLabel="Radiative flux (kW/m²)"
    />
  );
}
