"use client";

import { useMemo, useState } from "react";
import { ListOrdered } from "lucide-react";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { presetId as presetKey } from "@/features/cabin";
import { usePresets } from "@/features/presets";
import type { CabinConfig, Preset, RankRequest, RankWeights } from "@/lib/api/types";
import { useRanking } from "../hooks";
import { DEFAULT_RANK_WEIGHTS } from "../lib/score-format";
import { RankedTable } from "./ranked-table";
import { ScenarioPicker } from "./scenario-picker";
import { ScoreBreakdown } from "./score-breakdown";
import { WeightSliders } from "./weight-sliders";

const RANK_LIMIT = 10;

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

/** Ranking & Telemetry: scenario + weights → ranked runs → selected run's score breakdown. */
export function RankingView() {
  const presets = usePresets();

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-4 sm:p-8">
      <header className="space-y-1">
        <p className="font-mono text-[11px] tracking-wide text-muted">MODULE 03</p>
        <h1 className="text-xl font-semibold">Ranking &amp; Telemetry</h1>
        <p className="max-w-2xl text-sm text-muted">
          Score every test run against a habitat scenario. Tune how much similarity, data completeness and criticality
          matter, then pick a run to see how its score is built.
        </p>
      </header>

      {presets.isPending ? (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,360px)_minmax(0,1fr)]" role="status" aria-busy="true">
          <span className="sr-only">Loading scenarios…</span>
          <Skeleton className="h-[520px]" />
          <Skeleton className="h-[520px]" />
        </div>
      ) : presets.isError ? (
        <ErrorState
          title="Couldn't load scenarios"
          error={presets.error}
          onRetry={() => void presets.refetch()}
          retrying={presets.isFetching}
        />
      ) : !presets.data[0] ? (
        <EmptyState icon={ListOrdered} title="No scenarios available" description="The API returned no presets." />
      ) : (
        <RankingWorkspace presets={presets.data} />
      )}
    </div>
  );
}

function RankingWorkspace({ presets }: { presets: Preset[] }) {
  const first = presets[0] as Preset;
  const [cfg, setCfg] = useState<CabinConfig>(() => toConfig(first));
  const [scenarioId, setScenarioId] = useState<string | null>(presetKey(first, 0));
  const [weights, setWeights] = useState<RankWeights>({ ...DEFAULT_RANK_WEIGHTS });
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const req = useMemo<RankRequest>(() => ({ config: cfg, weights, limit: RANK_LIMIT }), [cfg, weights]);
  const ranking = useRanking(req);
  const results = ranking.data?.results ?? [];

  // Keep the user's pick while it is still in the list; otherwise the first row is selected.
  const effectiveId =
    selectedId && results.some((r) => r.experiment_id === selectedId)
      ? selectedId
      : (results[0]?.experiment_id ?? null);
  const selectedRun = results.find((r) => r.experiment_id === effectiveId);
  const updating = ranking.isFetching && !!ranking.data;

  return (
    <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,360px)_minmax(0,1fr)] [&>*]:min-w-0">
      <div className="space-y-6">
        <Card>
          <CardHeader title="Scenario" subtitle="The cabin the runs are compared against" />
          <CardBody>
            <ScenarioPicker
              presets={presets}
              cfg={cfg}
              presetId={scenarioId}
              onPreset={(p) => {
                setCfg(toConfig(p));
                setScenarioId(presetKey(p, presets.indexOf(p)));
              }}
              onChange={(field, value) => {
                setCfg((prev) => ({ ...prev, [field]: value }));
                setScenarioId(null);
              }}
            />
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="Weights" subtitle="What matters most in the ranking" />
          <CardBody>
            <WeightSliders weights={weights} onChange={setWeights} />
          </CardBody>
        </Card>
      </div>

      <div className="space-y-6" aria-busy={ranking.isFetching}>
        <Card>
          <CardHeader
            title="Ranked runs"
            subtitle={`Top ${RANK_LIMIT} of all test runs for this scenario`}
            action={updating ? <Spinner size="sm" label="Updating…" /> : null}
          />
          {ranking.isError && !ranking.data ? (
            <CardBody>
              <ErrorState
                title="Couldn't rank the runs"
                error={ranking.error}
                onRetry={() => void ranking.refetch()}
                retrying={ranking.isFetching}
              />
            </CardBody>
          ) : ranking.isPending ? (
            <CardBody className="space-y-2" aria-busy="true">
              {Array.from({ length: 6 }, (_, i) => (
                <Skeleton key={i} className="h-9" />
              ))}
            </CardBody>
          ) : results.length === 0 ? (
            <EmptyState icon={ListOrdered} title="No runs to rank" description="The API returned an empty ranking." />
          ) : (
            <div className={updating ? "opacity-80 transition-opacity" : "transition-opacity"}>
              <RankedTable results={results} selectedId={effectiveId} onSelect={setSelectedId} />
            </div>
          )}
        </Card>

        {selectedRun && ranking.data?.weights ? (
          <Card>
            <CardHeader title="Score breakdown" subtitle="Total = Σ weight share × component score" />
            <CardBody>
              <ScoreBreakdown run={selectedRun} weights={ranking.data.weights} />
            </CardBody>
          </Card>
        ) : null}
      </div>
    </div>
  );
}
