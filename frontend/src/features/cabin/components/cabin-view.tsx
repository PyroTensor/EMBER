"use client";

import Link from "next/link";
import { MessagesSquare, SlidersHorizontal } from "lucide-react";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { usePresets } from "@/features/presets";
import type { Preset } from "@/lib/api/types";
import { useCabinScenario } from "@/lib/cabin-scenario/cabin-scenario-context";
import { useCabinEvaluation } from "../hooks";
import { CabinControls } from "./cabin-controls";
import { PresetPicker, presetId } from "./preset-picker";
import { RiskPanel } from "./risk-panel";
import { ShapleyPanel } from "./shapley-panel";

/** Cabin Configurator: waits for presets, then syncs with the shared CabinScenarioContext. */
export function CabinView() {
  const presets = usePresets();

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-4 sm:p-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-1">
          <p className="font-mono text-[11px] tracking-wide text-muted">MODULE 01</p>
          <h1 className="text-xl font-semibold">Cabin Configurator</h1>
          <p className="max-w-2xl text-sm text-muted">
            Tune the habitat atmosphere and see the fire-risk index, the limiting oxygen index and which factors drive the
            risk compared with the ISS baseline.
          </p>
        </div>
        <Link
          href="/copilot"
          className="inline-flex items-center gap-2 rounded-md border border-accent/40 bg-accent/10 px-3 py-1.5 text-xs font-medium text-accent transition-colors hover:bg-accent/20"
        >
          <MessagesSquare aria-hidden className="size-3.5" />
          Ask SI Co-Pilot about this cabin →
        </Link>
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
  const { config: cfg, presetId: selected, selectPreset, updateField } = useCabinScenario();
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
              selectPreset(p, presetId(p, presets.indexOf(p)));
            }}
          />
          <CabinControls
            cfg={cfg}
            onChange={(field, value) => {
              updateField(field, value);
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
