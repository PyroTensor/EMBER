"use client";

import { useState } from "react";
import { SlidersHorizontal } from "lucide-react";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { usePresets } from "@/features/presets";
import type { CabinConfig, Preset } from "@/lib/api/types";
import { useCabinEvaluation } from "../hooks";
import { CabinControls } from "./cabin-controls";
import { PresetPicker, presetId } from "./preset-picker";
import { RiskPanel } from "./risk-panel";
import { ShapleyPanel } from "./shapley-panel";

function toConfig(p: Preset): CabinConfig {
  return {
    oxygen_pct: p.oxygen_pct,
    pressure_kpa: p.pressure_kpa,
    flow_velocity_cm_s: p.flow_velocity_cm_s,
    gravity_g: p.gravity_g,
    fuel_material: p.fuel_material,
    diluent_gas: p.diluent_gas,
  };
}

/** Cabin Configurator: waits for presets, then starts from the first one. */
export function CabinView() {
  const presets = usePresets();

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-4 sm:p-8">
      <header className="space-y-1">
        <p className="font-mono text-[11px] tracking-wide text-muted">MODULE 01</p>
        <h1 className="text-xl font-semibold">Cabin Configurator</h1>
        <p className="max-w-2xl text-sm text-muted">
          Tune the habitat atmosphere and see the fire-risk index, the limiting oxygen index and which factors drive the
          risk compared with the ISS baseline.
        </p>
      </header>

      {presets.isPending ? (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,380px)_1fr]" role="status" aria-busy="true">
          <span className="sr-only">Loading presets…</span>
          <Skeleton className="h-[560px]" />
          <Skeleton className="h-[560px]" />
        </div>
      ) : presets.isError ? (
        <ErrorState
          title="Couldn't load cabin presets"
          error={presets.error}
          onRetry={() => void presets.refetch()}
          retrying={presets.isFetching}
        />
      ) : !presets.data[0] ? (
        <EmptyState icon={SlidersHorizontal} title="No presets available" description="The API returned no cabin presets." />
      ) : (
        <CabinWorkspace presets={presets.data} />
      )}
    </div>
  );
}

function CabinWorkspace({ presets }: { presets: Preset[] }) {
  const first = presets[0] as Preset;
  const [cfg, setCfg] = useState<CabinConfig>(() => toConfig(first));
  const [selected, setSelected] = useState<string | null>(presetId(first, 0));
  const evaluation = useCabinEvaluation(cfg);
  // Never show a previous result next to an error: the error wins.
  const data = evaluation.isError ? undefined : evaluation.data;

  const updating = evaluation.isFetching && !!data;

  return (
    <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,380px)_minmax(0,1fr)] [&>*]:min-w-0">
      <Card>
        <CardHeader title="Configuration" subtitle="Preset or hand-tuned cabin atmosphere" />
        <CardBody className="space-y-6">
          <PresetPicker
            presets={presets}
            value={selected}
            onSelect={(p) => {
              setCfg(toConfig(p));
              setSelected(presetId(p, presets.indexOf(p)));
            }}
          />
          <CabinControls
            cfg={cfg}
            onChange={(field, value) => {
              setCfg((prev) => ({ ...prev, [field]: value }));
              setSelected(null);
            }}
          />
        </CardBody>
      </Card>

      <div className="space-y-6" aria-live="polite" aria-busy={evaluation.isFetching}>
        <Card>
          <CardHeader
            title="Fire risk"
            subtitle="Spacecraft Fire Risk Index (0–100)"
            action={updating ? <Spinner size="sm" label="Updating…" /> : null}
          />
          <CardBody>
            {evaluation.isError ? (
              <ErrorState
                title="Couldn't evaluate this cabin"
                error={evaluation.error}
                onRetry={() => void evaluation.refetch()}
                retrying={evaluation.isFetching}
              />
            ) : data ? (
              <div className={updating ? "opacity-80 transition-opacity" : "transition-opacity"}>
                <RiskPanel evaluation={data} />
              </div>
            ) : (
              <div className="grid gap-6 sm:grid-cols-[260px_1fr]">
                <Skeleton className="h-44" />
                <Skeleton className="h-44" />
              </div>
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            title="What drives the risk"
            subtitle="Exact Shapley attribution vs the ISS baseline (risk points)"
          />
          <CardBody>
            {data ? (
              <div className={updating ? "opacity-80 transition-opacity" : "transition-opacity"}>
                <ShapleyPanel evaluation={data} />
              </div>
            ) : evaluation.isError ? (
              <p className="text-sm text-muted">No attribution available.</p>
            ) : (
              <Skeleton className="h-52" />
            )}
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
