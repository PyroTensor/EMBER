"use client";

import { LineChart, type LineSeries } from "@/components/charts/line-chart";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import type { LiveTelemetrySample } from "@/lib/api/types";

export function LiveStripCharts({
  history,
}: {
  history: readonly LiveTelemetrySample[];
}) {
  const x = history.map((s) => s.timestamp_s);

  const riskSeries: LineSeries[] = [
    {
      key: "risk_index",
      label: "Fire risk index",
      values: history.map((s) => s.evaluation.risk_index),
      color: "var(--color-accent)",
      axis: "left",
      unit: "/ 100",
      format: (v) => v.toFixed(1),
    },
    {
      key: "oxygen_margin_pct",
      label: "O₂ margin over LOI",
      values: history.map((s) => s.evaluation.oxygen_margin_pct),
      color: "#38bdf8",
      axis: "right",
      unit: "pts",
      format: (v) => v.toFixed(2),
    },
  ];

  const atmosphereSeries: LineSeries[] = [
    {
      key: "oxygen_pct",
      label: "O₂ %",
      values: history.map((s) => s.config.oxygen_pct),
      color: "#10b981",
      axis: "left",
      unit: "%",
      format: (v) => v.toFixed(1),
    },
    {
      key: "flow_velocity_cm_s",
      label: "HVAC flow",
      values: history.map((s) => s.config.flow_velocity_cm_s),
      color: "#a78bfa",
      axis: "left",
      unit: "cm/s",
      format: (v) => v.toFixed(1),
    },
    {
      key: "pressure_kpa",
      label: "Pressure",
      values: history.map((s) => s.config.pressure_kpa),
      color: "#eab308",
      axis: "right",
      unit: "kPa",
      format: (v) => v.toFixed(1),
    },
  ];

  const rigSeries: LineSeries[] = [
    {
      key: "radiative_heat_flux_kw_m2",
      label: "Radiative flux",
      values: history.map(
        (s) => s.raw_sensors?.radiative_heat_flux_kw_m2 ?? null,
      ),
      color: "#38bdf8",
      axis: "left",
      unit: "kW/m²",
      format: (v) => v.toFixed(2),
    },
    {
      key: "flame_radius_mm",
      label: "Flame radius",
      values: history.map((s) => s.raw_sensors?.flame_radius_mm ?? null),
      color: "var(--color-accent)",
      axis: "left",
      unit: "mm",
      format: (v) => v.toFixed(2),
    },
    {
      key: "flame_temp_k",
      label: "Flame temp",
      values: history.map((s) => s.raw_sensors?.flame_temp_k ?? null),
      color: "#f43f5e",
      axis: "right",
      unit: "K",
      format: (v) => v.toFixed(0),
    },
  ];

  const hasRigData = history.some(
    (s) =>
      s.raw_sensors?.flame_temp_k != null ||
      s.raw_sensors?.radiative_heat_flux_kw_m2 != null ||
      s.raw_sensors?.flame_radius_mm != null,
  );

  const singleSampleHint =
    history.length < 2
      ? "1 frame captured — awaiting next frame to extend the time-series curve"
      : undefined;

  return (
    <div className="space-y-4">
      <div className="grid gap-4 lg:grid-cols-2 [&>*]:min-w-0">
        <Card>
          <CardHeader
            title="Live Risk & O₂ Margin"
            subtitle={
              singleSampleHint ??
              "Rolling Spacecraft Fire Risk Index vs Limiting Oxygen Index margin"
            }
          />
          <CardBody>
            <LineChart
              x={x}
              series={riskSeries}
              label="Live fire risk index and oxygen margin over time"
              xLabel="Elapsed time (s)"
              leftLabel="Risk index (0–100)"
              rightLabel="O₂ margin (pts)"
              height={240}
            />
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            title="Cabin Atmosphere & Flow"
            subtitle={
              singleSampleHint ??
              "Real-time O₂ concentration, HVAC flow velocity, and cabin pressure"
            }
          />
          <CardBody>
            <LineChart
              x={x}
              series={atmosphereSeries}
              label="Live cabin atmosphere and ventilation over time"
              xLabel="Elapsed time (s)"
              leftLabel="O₂ (%) · Flow (cm/s)"
              rightLabel="Pressure (kPa)"
              height={240}
            />
          </CardBody>
        </Card>
      </div>

      {hasRigData ? (
        <Card>
          <CardHeader
            title="Combustion Rig Diagnostics"
            subtitle={
              singleSampleHint ??
              "Radiative heat flux, optical flame radius, and thermocouple temperature"
            }
          />
          <CardBody>
            <LineChart
              x={x}
              series={rigSeries}
              label="Live combustion rig diagnostics over time"
              xLabel="Elapsed time (s)"
              leftLabel="Flux (kW/m²) · Radius (mm)"
              rightLabel="Flame temp (K)"
              height={240}
            />
          </CardBody>
        </Card>
      ) : null}
    </div>
  );
}
