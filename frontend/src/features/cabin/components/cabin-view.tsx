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
    <div className="mx-auto max-w-6xl space-y-4 p-4 sm:p-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-xl font-semibold">Cabin Configurator</h1>
          <p className="text-muted max-w-2xl text-sm">
            Tune the habitat atmosphere and see the fire-risk index, the
            limiting oxygen index and which factors drive the risk compared with
            the ISS baseline.
          </p>
        </div>
        <Link
          href="/copilot"
          className="border-accent/40 bg-accent/10 text-accent hover:bg-accent/20 inline-flex items-center gap-2 rounded-md border px-3 py-1.5 text-xs font-medium transition-colors"
        >
          <MessagesSquare aria-hidden className="size-3.5" />
          Ask SI Co-Pilot about this cabin →
        </Link>
      </header>

      {presets.isPending ? (
        <div
          className="grid gap-4 lg:grid-cols-[minmax(0,380px)_minmax(0,1fr)]"
          role="status"
          aria-busy="true"
        >
          <span className="sr-only">Loading presets…</span>
          <Skeleton className="h-[40rem] lg:row-span-2" />
          <Skeleton className="h-64" />
          <Skeleton className="h-72" />
        </div>
      ) : presets.isError ? (
        <ErrorState
          title="Couldn't load cabin presets"
          error={presets.error}
          onRetry={() => void presets.refetch()}
          retrying={presets.isFetching}
        />
      ) : !presets.data[0] ? (
        <EmptyState
          icon={SlidersHorizontal}
          title="No presets available"
          description="The API returned no cabin presets."
        />
      ) : (
        <CabinWorkspace presets={presets.data} />
      )}
    </div>
  );
}

function CabinWorkspace({ presets }: { presets: Preset[] }) {
  const {
    config: cfg,
    presetId: selected,
    selectPreset,
    updateField,
  } = useCabinScenario();
  const evaluation = useCabinEvaluation(cfg);
  // Never show a previous result next to an error: the error wins.
  const data = evaluation.isError ? undefined : evaluation.data;

  const updating = evaluation.isFetching && !!data;

  return (
    <div
      className="grid items-stretch gap-4 lg:grid-cols-[minmax(0,380px)_minmax(0,1fr)] [&>*]:min-w-0"
      aria-live="polite"
      aria-busy={evaluation.isFetching}
    >
      <Card>
        <CardHeader
          title="Configuration"
          subtitle="Preset or hand-tuned cabin atmosphere"
        />
        <CardBody className="space-y-4">
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
      <div className="grid min-w-0 gap-4 lg:grid-rows-[auto_1fr]">
        <Card className="flex flex-col">
          <CardHeader
            title="Fire risk"
            subtitle="Spacecraft Fire Risk Index (0–100)"
            action={updating ? <Spinner size="sm" label="Updating…" /> : null}
          />
          <CardBody className="flex-1">
            {evaluation.isError ? (
              <ErrorState
                title="Couldn't evaluate this cabin"
                error={evaluation.error}
                onRetry={() => void evaluation.refetch()}
                retrying={evaluation.isFetching}
              />
            ) : data ? (
              <div
                className={
                  updating
                    ? "opacity-80 transition-opacity"
                    : "transition-opacity"
                }
              >
                <RiskPanel evaluation={data} />
              </div>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                <Skeleton className="h-40" />
                <Skeleton className="h-40" />
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
              <div
                className={
                  updating
                    ? "opacity-80 transition-opacity"
                    : "transition-opacity"
                }
              >
                <ShapleyPanel evaluation={data} />
              </div>
            ) : evaluation.isError ? (
              <p className="text-muted text-sm">No attribution available.</p>
            ) : (
              <Skeleton className="h-52" />
            )}
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
