"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useQueries } from "@tanstack/react-query";
import { ListOrdered } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { Select } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { presetId as presetKey } from "@/features/cabin";
import {
  DocumentReaderModal,
  type DocumentReaderTarget,
} from "@/features/copilot/components/document-reader";
import { useDocuments } from "@/features/copilot/hooks";
import { usePresets } from "@/features/presets";
import type {
  DocumentSummary,
  Preset,
  RankRequest,
  RankedExperiment,
  RankWeights,
} from "@/lib/api/types";
import { qk } from "@/lib/api/query-keys";
import { useApiMode } from "@/lib/api-mode/api-mode-context";
import {
  formatCabinSummary,
  useCabinScenario,
} from "@/lib/cabin-scenario/cabin-scenario-context";
import { useRanking, useTelemetry } from "../hooks";
import { getTelemetry } from "../api";
import { DEFAULT_RANK_WEIGHTS } from "../lib/score-format";
import { citedPageAvailable, dataOrigin } from "../lib/run-quality";
import { ExtraTelemetryTable } from "./extra-telemetry-table";
import { RankingMethod } from "./ranking-method";
import { RankingSectionNav, type RankingSection } from "./ranking-section-nav";
import {
  DEFAULT_RUN_FILTERS,
  RankingFilters,
  type RunFilters,
} from "./ranking-filters";
import { RankedTable } from "./ranked-table";
import { RunComparison } from "./run-comparison";
import { RunDetails } from "./run-details";
import { ScenarioPicker } from "./scenario-picker";
import { ScoreBreakdown } from "./score-breakdown";
import {
  isTelemetryMissing,
  TELEMETRY_OPTIONS,
  TelemetryChart,
  type TelemetryChannel,
} from "./telemetry-chart";
import { WeightSliders } from "./weight-sliders";

const RANK_LIMIT = 50;
const EMPTY_RESULTS: RankedExperiment[] = [];

/** Ranking & Telemetry: scenario + weights → ranked runs → selected run's score breakdown. */
export function RankingView() {
  const presets = usePresets();

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-4 sm:p-8">
      <header className="space-y-1">
        <p className="text-muted font-mono text-[11px] tracking-wide">
          MODULE 03
        </p>
        <h1 className="text-xl font-semibold">Ranking &amp; Telemetry</h1>
        <p className="text-muted max-w-2xl text-sm">
          Score every test run against a habitat scenario. Tune how much
          similarity, data completeness and criticality matter, then pick a run
          to see how its score is built.
        </p>
      </header>

      {presets.isPending ? (
        <div
          className="grid gap-6 lg:grid-cols-[minmax(0,360px)_minmax(0,1fr)]"
          role="status"
          aria-busy="true"
        >
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
        <EmptyState
          icon={ListOrdered}
          title="No scenarios available"
          description="The API returned no presets."
        />
      ) : (
        <RankingWorkspace presets={presets.data} />
      )}
    </div>
  );
}

function RankingWorkspace({ presets }: { presets: Preset[] }) {
  const {
    config: cfg,
    presetId: scenarioId,
    presetName,
    selectPreset,
    updateField,
  } = useCabinScenario();
  const { mode } = useApiMode();
  const documents = useDocuments();
  const [readerTarget, setReaderTarget] = useState<DocumentReaderTarget | null>(
    null,
  );
  const [section, setSection] = useState<RankingSection>("rankings");
  const [headerHeight, setHeaderHeight] = useState(0);
  const panelStart = useRef<HTMLDivElement>(null);
  const scoreStart = useRef<HTMLDivElement>(null);
  const compareStart = useRef<HTMLDivElement>(null);
  const [weights, setWeights] = useState<RankWeights>({
    ...DEFAULT_RANK_WEIGHTS,
  });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [filters, setFilters] = useState<RunFilters>(DEFAULT_RUN_FILTERS);
  const [channel, setChannel] = useState<TelemetryChannel>("flame_radius_mm");
  const [pins, setPins] = useState<{ key: string; ids: string[] }>({
    key: "",
    ids: [],
  });

  const req = useMemo<RankRequest>(
    () => ({ config: cfg, weights, limit: RANK_LIMIT }),
    [cfg, weights],
  );
  const pinKey = JSON.stringify(req);
  const ranking = useRanking(req);
  // Never show a previous ranking next to an error: the error wins.
  const rankData = ranking.isError ? undefined : ranking.data;
  const results = rankData?.results ?? EMPTY_RESULTS;
  const documentsById = useMemo(() => {
    const map = new Map<string, DocumentSummary>();
    for (const document of documents.data ?? [])
      map.set(document.doc_id.toUpperCase(), document);
    return map;
  }, [documents.data]);
  const sourceIds = useMemo(
    () => new Set(documentsById.keys()),
    [documentsById],
  );
  const origins = useMemo(
    () =>
      new Map(
        results.map((run) => [
          run.experiment_id,
          dataOrigin(run.record, documentsById, mode),
        ]),
      ),
    [results, documentsById, mode],
  );
  const availabilityChecks = useQueries({
    queries:
      filters.telemetry === "all"
        ? []
        : results.map((run) => ({
            queryKey: qk.telemetry(run.experiment_id),
            queryFn: ({ signal }: { signal: AbortSignal }) =>
              getTelemetry(run.experiment_id, signal),
            staleTime: Infinity,
          })),
  });
  const checkingTelemetry =
    filters.telemetry !== "all" &&
    availabilityChecks.some((check) => check.isPending);
  const availabilityErrors = availabilityChecks.filter(
    (check) => check.isError && !isTelemetryMissing(check.error),
  ).length;
  const query = filters.query.trim().toLowerCase();
  const filteredResults = results.filter((run, index) => {
    const record = run.record;
    if (
      query &&
      ![
        run.experiment_id,
        record?.program,
        record?.fuel_material,
        record?.combustion_regime,
      ].some((value) => value?.toLowerCase().includes(query))
    )
      return false;
    if (filters.program !== "all" && record?.program !== filters.program)
      return false;
    if (
      filters.material !== "all" &&
      record?.fuel_material !== filters.material
    )
      return false;
    if (
      filters.regime !== "all" &&
      record?.combustion_regime !== filters.regime
    )
      return false;
    if (filters.telemetry !== "all") {
      const check = availabilityChecks[index];
      const available = check?.isSuccess
        ? check.data.time_s.length > 0
        : check?.isError && isTelemetryMissing(check.error)
          ? false
          : null;
      if (
        available === null ||
        (filters.telemetry === "available") !== available
      )
        return false;
    }
    return true;
  });
  const visibleResults = filteredResults.slice(0, filters.pageSize);
  const pinnedIds = pins.key === pinKey ? pins.ids : [];
  const pinnedRuns = pinnedIds.flatMap((id) => {
    const run = results.find((result) => result.experiment_id === id);
    return run ? [run] : [];
  });
  const scrollToTarget = (target: { current: HTMLElement | null }) => {
    requestAnimationFrame(() => {
      const element = target.current;
      const nav = document.getElementById("ranking-section-nav");
      if (!element || !nav) return;
      const top =
        window.scrollY +
        element.getBoundingClientRect().top -
        headerHeight -
        nav.getBoundingClientRect().height -
        12;
      window.scrollTo({
        top: Math.max(0, top),
        behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
          ? "auto"
          : "smooth",
      });
    });
  };
  const togglePin = (id: string) => {
    const checking = !pinnedIds.includes(id) && pinnedIds.length < 3;
    setPins((current) => {
      const ids = current.key === pinKey ? current.ids : [];
      return {
        key: pinKey,
        ids: ids.includes(id)
          ? ids.filter((pinned) => pinned !== id)
          : ids.length < 3
            ? [...ids, id]
            : ids,
      };
    });
    if (checking && pinnedIds.length >= 1) scrollToTarget(compareStart);
  };

  // Keep the user's pick while it is still in the list; otherwise the first row is selected.
  const effectiveId =
    selectedId && visibleResults.some((r) => r.experiment_id === selectedId)
      ? selectedId
      : (visibleResults[0]?.experiment_id ?? null);
  const selectedRun = visibleResults.find(
    (r) => r.experiment_id === effectiveId,
  );
  const selectRun = (id: string, reveal = true) => {
    setSelectedId(id);
    if (reveal) scrollToTarget(scoreStart);
  };
  const selectedTelemetry = useTelemetry(selectedRun?.experiment_id ?? null);
  const selectedSourceId = selectedRun?.record?.source_doc_id?.toUpperCase();
  const selectedSource = selectedSourceId
    ? documentsById.get(selectedSourceId)
    : undefined;
  const selectedPageAvailable = citedPageAvailable(
    selectedSource,
    selectedRun?.record?.source_page,
  );
  const updating = ranking.isFetching && !!rankData;

  useEffect(() => {
    const header = document.querySelector<HTMLElement>("[data-app-header]");
    if (!header) return;
    const measure = () =>
      setHeaderHeight(header.getBoundingClientRect().height);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(header);
    return () => observer.disconnect();
  }, []);

  const selectSection = (next: RankingSection) => {
    setSection(next);
    requestAnimationFrame(() => {
      const start = panelStart.current;
      const nav = document.getElementById("ranking-section-nav");
      if (!start || !nav) return;
      const top =
        window.scrollY +
        start.getBoundingClientRect().top -
        headerHeight -
        nav.getBoundingClientRect().height -
        12;
      window.scrollTo({
        top: Math.max(0, top),
        behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
          ? "instant"
          : "smooth",
      });
    });
  };

  return (
    <>
      <RankingSectionNav
        active={section}
        onSelect={selectSection}
        scenarioName={scenarioId ? presetName : "Custom configuration"}
        scenarioSummary={formatCabinSummary(cfg)}
        selectedRunId={selectedRun?.experiment_id ?? null}
        topOffset={headerHeight}
      />
      <div ref={panelStart} className="pt-6">
        <section
          id="ranking-panel-scenario"
          role="tabpanel"
          aria-labelledby="ranking-tab-scenario"
          className={
            section === "scenario"
              ? "grid items-start gap-6 md:grid-cols-2 [&>*]:min-w-0"
              : "hidden"
          }
        >
          <Card>
            <CardHeader
              title="Scenario"
              subtitle="The cabin the runs are compared against"
            />
            <CardBody>
              <ScenarioPicker
                presets={presets}
                cfg={cfg}
                presetId={scenarioId}
                onPreset={(p) => {
                  selectPreset(p, presetKey(p, presets.indexOf(p)));
                }}
                onChange={(field, value) => {
                  updateField(field, value);
                }}
              />
            </CardBody>
          </Card>
          <Card>
            <CardHeader
              title="Weights"
              subtitle="What matters most in the ranking"
            />
            <CardBody>
              <WeightSliders weights={weights} onChange={setWeights} />
            </CardBody>
          </Card>
        </section>

        <section
          id="ranking-panel-rankings"
          role="tabpanel"
          aria-labelledby="ranking-tab-rankings"
          className={section === "rankings" ? "space-y-6" : "hidden"}
          aria-busy={ranking.isFetching}
        >
          <Card>
            <CardHeader
              title="How ranking works"
              subtitle="What the score means and how each part is calculated"
            />
            <RankingMethod />
          </Card>
          <Card>
            <CardHeader
              title="Ranked runs"
              subtitle={`Top ${RANK_LIMIT} ranked runs for this scenario`}
              action={updating ? <Spinner size="sm" label="Updating…" /> : null}
            />
            <p
              className="border-border text-muted border-b px-5 py-3 text-xs"
              aria-live="polite"
            >
              Select a run to view its score and telemetry. Check 2 or 3 runs in
              Compare to overlay their telemetry and compare conditions.
              {pinnedIds.length === 1
                ? " One run checked; choose another to compare."
                : null}
            </p>
            {ranking.isError ? (
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
              <EmptyState
                icon={ListOrdered}
                title="No runs to rank"
                description="The API returned an empty ranking."
              />
            ) : checkingTelemetry ? (
              <CardBody role="status" aria-busy="true">
                <Skeleton className="h-40" />
              </CardBody>
            ) : visibleResults.length === 0 ? (
              <EmptyState
                icon={ListOrdered}
                title="No matching ranked runs"
                description="Search and filters apply to the top 50 ranked runs. Try clearing a filter."
              />
            ) : (
              <div
                className={
                  updating
                    ? "opacity-80 transition-opacity"
                    : "transition-opacity"
                }
              >
                <RankedTable
                  results={visibleResults}
                  selectedId={effectiveId}
                  onSelect={selectRun}
                  pinnedIds={pinnedIds}
                  onTogglePin={togglePin}
                  pinDisabled={ranking.isFetching}
                  origins={origins}
                />
              </div>
            )}
          </Card>
          <Card>
            <CardHeader
              title="Find runs"
              subtitle="Search and narrow the top ranked experiments"
            />
            <RankingFilters
              value={filters}
              onChange={setFilters}
              results={results}
              matches={filteredResults.length}
              shown={visibleResults.length}
              checkingTelemetry={checkingTelemetry}
            />
            {availabilityErrors > 0 ? (
              <p role="alert" className="text-mock px-5 py-2 text-xs">
                Could not check telemetry for {availabilityErrors} run
                {availabilityErrors === 1 ? "" : "s"}; those runs are not
                included in this filter.
              </p>
            ) : null}
          </Card>
          <div
            ref={scoreStart}
            className="grid items-start gap-6 lg:grid-cols-[minmax(0,360px)_minmax(0,1fr)] [&>*]:min-w-0"
            aria-busy={ranking.isFetching}
          >
            {selectedRun && rankData?.weights ? (
              <Card>
                <CardHeader
                  title="Score breakdown"
                  subtitle="Total = Σ weight share × component score"
                />
                <CardBody>
                  <ScoreBreakdown
                    run={selectedRun}
                    weights={rankData.weights}
                  />
                </CardBody>
              </Card>
            ) : (
              <Card>
                <EmptyState
                  icon={ListOrdered}
                  title="Select a run first"
                  description="Choose an experiment above to view its score."
                />
              </Card>
            )}
            {selectedRun?.experiment_id ? (
              <Card>
                <CardHeader
                  title="Telemetry"
                  subtitle={`${selectedRun.experiment_id}: choose one measured channel to view over time`}
                />
                <CardBody className="space-y-4">
                  <div className="max-w-xs">
                    <Select
                      label="Telemetry channel"
                      value={channel}
                      options={TELEMETRY_OPTIONS}
                      onChange={setChannel}
                    />
                  </div>
                  <TelemetryChart
                    experimentId={selectedRun.experiment_id}
                    channel={channel}
                  />
                </CardBody>
              </Card>
            ) : (
              <Card>
                <EmptyState
                  icon={ListOrdered}
                  title="No telemetry selected"
                  description="Choose an experiment above to inspect its measured channels."
                />
              </Card>
            )}
          </div>
          {pinnedRuns.length >= 2 ? (
            <div ref={compareStart}>
              <RunComparison
                runs={pinnedRuns}
                channel={channel}
                onChannelChange={setChannel}
                onRemove={togglePin}
                origins={origins}
                documents={documentsById}
                onOpenSource={(docId, page) => setReaderTarget({ docId, page })}
              />
            </div>
          ) : null}
        </section>

        <section
          id="ranking-panel-sources"
          role="tabpanel"
          aria-labelledby="ranking-tab-sources"
          className={
            section === "sources"
              ? "grid items-start gap-6 xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] [&>*]:min-w-0"
              : "hidden"
          }
        >
          {selectedRun?.record ? (
            <>
              <Card>
                <CardHeader
                  title="Run details"
                  subtitle={`${selectedRun.experiment_id} · schema v1 record`}
                />
                <CardBody>
                  <RunDetails
                    run={selectedRun.record}
                    origin={
                      origins.get(selectedRun.experiment_id) ?? "unverified"
                    }
                    sourceAvailable={
                      documents.isPending || documents.isError
                        ? null
                        : Boolean(
                            selectedSourceId && sourceIds.has(selectedSourceId),
                          )
                    }
                    sourcePageAvailable={selectedPageAvailable}
                    telemetryAvailable={
                      selectedTelemetry.isSuccess
                        ? selectedTelemetry.data.time_s.length > 0
                        : selectedTelemetry.isError &&
                            isTelemetryMissing(selectedTelemetry.error)
                          ? false
                          : null
                    }
                    onOpenSource={() => {
                      if (selectedRun.record?.source_doc_id)
                        setReaderTarget({
                          docId: selectedRun.record.source_doc_id,
                          page:
                            selectedPageAvailable === false
                              ? undefined
                              : (selectedRun.record.source_page ?? undefined),
                        });
                    }}
                  />
                </CardBody>
              </Card>
              <Card>
                <CardHeader
                  title="Extra telemetry"
                  subtitle="Unmapped source columns, kept as-is"
                />
                <CardBody>
                  <ExtraTelemetryTable
                    extra={selectedRun.record.extra_telemetry}
                  />
                </CardBody>
              </Card>
            </>
          ) : (
            <Card className="xl:col-span-2">
              <EmptyState
                icon={ListOrdered}
                title="Select a run first"
                description="Choose an experiment in Rankings to inspect its data and sources."
              />
              <CardBody className="flex justify-center pt-0">
                <Button
                  variant="outline"
                  onClick={() => selectSection("rankings")}
                >
                  Go to rankings
                </Button>
              </CardBody>
            </Card>
          )}
        </section>
      </div>
      <DocumentReaderModal
        target={readerTarget}
        onClose={() => setReaderTarget(null)}
      />
    </>
  );
}
