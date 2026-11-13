"use client";

import { useCallback, useMemo, useState } from "react";
import { Flame, Pause, Play, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { computePhysics, type FlameParams } from "../lib/flame-physics";
import type { FlameStats as FlameStatsData } from "../lib/flame-renderer";
import { DEFAULT_PARAMS, getScenario, type SceneId } from "../lib/flame-scenes";
import { FlameCanvas } from "./flame-canvas";
import { FlameControls } from "./flame-controls";
import { FlameStats } from "./flame-stats";
import { ScenarioTabs } from "./scenario-tabs";
import { VentilationCurve } from "./ventilation-curve";

export function TwinView() {
  const [params, setParams] = useState<FlameParams>(DEFAULT_PARAMS);
  const [sceneId, setSceneId] = useState<SceneId | null>(null);
  const [speed, setSpeed] = useState(1);
  const [paused, setPaused] = useState(false);
  const [igniteSignal, setIgniteSignal] = useState(0);
  const [stats, setStats] = useState<FlameStatsData>({ vitality: 1, fps: 60 });

  const physics = useMemo(() => computePhysics(params), [params]);
  const scenario = sceneId ? getScenario(sceneId) : null;
  const ignite = () => setIgniteSignal((n) => n + 1);

  const update = <K extends keyof FlameParams>(key: K, value: FlameParams[K]) => {
    setSceneId(null);
    setParams((prev) => ({ ...prev, [key]: value }));
  };

  const selectScenario = (id: SceneId) => {
    setSceneId(id);
    setParams((prev) => ({ ...prev, ...getScenario(id).atmosphere }));
    ignite();
  };

  const reset = () => {
    setParams(DEFAULT_PARAMS);
    setSceneId(null);
    ignite();
  };

  // Reduced motion → start (or switch to) a still frame; the user can press Resume.
  const onReducedMotion = useCallback((reduced: boolean) => {
    if (reduced) setPaused(true);
  }, []);

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-sm font-semibold text-fg">Live Flame Simulator</h2>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" onClick={ignite}>
            <Flame aria-hidden className="size-3.5" /> Ignite
          </Button>
          <Button variant="outline" size="sm" onClick={() => setPaused((p) => !p)} aria-pressed={paused}>
            {paused ? <Play aria-hidden className="size-3.5" /> : <Pause aria-hidden className="size-3.5" />}
            {paused ? "Resume" : "Pause"}
          </Button>
          <Button variant="outline" size="sm" onClick={reset}>
            <RotateCcw aria-hidden className="size-3.5" /> Reset
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <div className="lg:col-span-5">
          <FlameControls params={params} speed={speed} onChange={update} onSpeedChange={setSpeed} />
        </div>

        <div className="min-w-0 space-y-4 lg:col-span-7">
          <div className="space-y-3 rounded-card border border-border bg-surface p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="font-mono text-[11px] tracking-wider text-muted uppercase">Gravity scenario</span>
              <ScenarioTabs value={sceneId} onSelect={selectScenario} />
            </div>

            <FlameCanvas
              params={params}
              physics={physics}
              speed={speed}
              paused={paused}
              igniteSignal={igniteSignal}
              onStats={setStats}
              onReducedMotion={onReducedMotion}
            />

            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-2.5 text-xs">
              {scenario ? (
                <p>
                  <span className="font-mono font-medium text-fg">
                    {scenario.label} ({scenario.gLabel}):
                  </span>{" "}
                  <span className="text-muted">{scenario.blurb}</span>
                </p>
              ) : (
                <p>
                  <span className="font-mono font-medium text-fg">Custom conditions:</span>{" "}
                  <span className="text-muted">
                    {params.oxygen_pct} % O₂ · {params.pressure_kpa} kPa · {params.flow_velocity_cm_s} cm/s ·{" "}
                    {params.gravity_g} g
                  </span>
                </p>
              )}
              <span className="font-mono text-[10px] text-muted">
                3D volumetric raymarch · {paused ? "paused" : `${Math.round(stats.fps)} fps`}
              </span>
            </div>
          </div>

          <FlameStats physics={physics} vitality={stats.vitality} />
          <VentilationCurve uEff={physics.uEff} />
        </div>
      </div>
    </section>
  );
}
