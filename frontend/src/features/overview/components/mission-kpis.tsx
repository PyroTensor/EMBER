"use client";

import { ErrorState } from "@/components/ui/error-state";
import { KpiTile } from "@/components/ui/kpi-tile";
import { useExperiments } from "@/features/experiments";
import { useHealth } from "@/features/health";
import { usePresets } from "@/features/presets";
import { fmtPct } from "@/lib/format";

const share = (count: number, total: number) => (total > 0 ? `${fmtPct((100 * count) / total, 0)} of runs` : "no runs");

/**
 * Mission KPIs from GET /api/experiments, /api/health and /api/presets.
 * Skeletons while loading, one ErrorState (retrying all three) on failure.
 */
export function MissionKpis() {
  const experiments = useExperiments();
  const health = useHealth();
  const presets = usePresets();
  const queries = [experiments, health, presets];

  const failed = queries.find((q) => q.isError);
  if (failed) {
    return (
      <ErrorState
        title="Couldn't load mission data"
        error={failed.error}
        retrying={queries.some((q) => q.isFetching)}
        onRetry={() => queries.forEach((q) => void q.refetch())}
      />
    );
  }

  const runs = experiments.data;
  const total = runs?.length ?? 0;
  const sustained = runs?.filter((r) => r.combustion_regime === "Sustained Burn").length ?? 0;
  const coolFlames = runs?.filter((r) => r.combustion_regime === "Cool Flame").length ?? 0;
  const extraKeys = health.data?.extra_telemetry_keys?.length;

  return (
    <section aria-label="Mission KPIs" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
      <KpiTile
        label="Test runs"
        value={total}
        hint={`schema ${health.data?.schema_version ?? "v1"}`}
        loading={experiments.isPending}
      />
      <KpiTile
        label="Sustained burns"
        value={sustained}
        hint={share(sustained, total)}
        loading={experiments.isPending}
      />
      <KpiTile label="Cool flames" value={coolFlames} hint={share(coolFlames, total)} loading={experiments.isPending} />
      <KpiTile
        label="Extra telemetry keys"
        value={extraKeys ?? "—"}
        hint="unmapped source columns, kept"
        loading={health.isPending}
      />
      <KpiTile
        label="Cabin presets"
        value={presets.data?.length ?? 0}
        hint="ISS, Artemis and more"
        loading={presets.isPending}
      />
    </section>
  );
}
