"use client";

import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { RiskPanel } from "@/features/cabin/components/risk-panel";
import { ShapleyPanel } from "@/features/cabin/components/shapley-panel";
import type { CabinConfig, CabinEvaluation } from "@/lib/api/types";
import { fmtCmS, fmtG, fmtKpa, fmtPct } from "@/lib/format";

function ConfigChip({ label, value }: { label: string; value: string }) {
  return (
    <div className="border-border bg-surface-2/50 rounded-md border px-3 py-2">
      <dt className="text-muted text-[11px]">{label}</dt>
      <dd className="text-fg mt-0.5 font-mono text-xs font-medium tabular-nums">
        {value}
      </dd>
    </div>
  );
}

/**
 * Mirrors the Cabin Configurator's Fire Risk & Shapley cards alongside the active
 * cabin room configuration read from the incoming live telemetry stream.
 */
export function LiveRiskAndShapley({
  config,
  evaluation,
  updating,
}: {
  config: CabinConfig;
  evaluation: CabinEvaluation;
  updating: boolean;
}) {
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader
          title="Live Cabin Configuration"
          subtitle="Active habitat atmosphere and fuel/diluent parameters reported by the stream"
          action={updating ? <Spinner size="sm" label="Refreshing…" /> : null}
        />
        <CardBody>
          <dl className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-6">
            <ConfigChip
              label="Oxygen (O₂)"
              value={fmtPct(config.oxygen_pct, 1)}
            />
            <ConfigChip
              label="Cabin pressure"
              value={fmtKpa(config.pressure_kpa, 1)}
            />
            <ConfigChip
              label="HVAC flow"
              value={fmtCmS(config.flow_velocity_cm_s, 1)}
            />
            <ConfigChip label="Gravity" value={fmtG(config.gravity_g, 2)} />
            <ConfigChip label="Fuel material" value={config.fuel_material} />
            <ConfigChip label="Diluent gas" value={config.diluent_gas} />
          </dl>
        </CardBody>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2 [&>*]:min-w-0">
        <Card className="flex flex-col">
          <CardHeader
            title="Fire risk"
            subtitle="Spacecraft Fire Risk Index (0–100) evaluated from live cabin telemetry"
            action={updating ? <Spinner size="sm" label="Refreshing…" /> : null}
          />
          <CardBody className="flex-1">
            <RiskPanel evaluation={evaluation} />
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            title="What drives the risk"
            subtitle="Exact Shapley attribution vs the ISS baseline (risk points)"
          />
          <CardBody>
            <ShapleyPanel evaluation={evaluation} />
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
