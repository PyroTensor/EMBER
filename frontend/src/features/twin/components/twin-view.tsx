"use client";

import { useCallback, useMemo, useState } from "react";
import { Flame, Pause, Play, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { presetId as presetKey } from "@/features/cabin";
import { usePresets } from "@/features/presets";
import type { CabinConfig, Preset } from "@/lib/api/types";
import { useCabinScenario } from "@/lib/cabin-scenario/cabin-scenario-context";
import {
  computePhysics,
  type FlameParams,
  type FlowDirection,
  type FuelGeometry,
} from "../lib/flame-physics";
import type { FlameStats as FlameStatsData } from "../lib/flame-renderer";
import {
  DEFAULT_PARAMS,
  getScenario,
  SCENARIOS,
  type SceneId,
} from "../lib/flame-scenes";
import { FlameCanvas } from "./flame-canvas";
import { FlameControls } from "./flame-controls";
import { FlameStats } from "./flame-stats";
import { ScenarioTabs } from "./scenario-tabs";
import { VentilationCurve } from "./ventilation-curve";

const PRESET_TO_SCENE: Readonly<Record<string, SceneId>> = {
  iss: "iss",
  "artemis-transit": "transit",
  "artemis-lunar": "moon",
  "mars-surface": "mars",
};

const SCENE_TO_PRESET: Readonly<Record<SceneId, string | undefined>> = {
  iss: "iss",
  transit: "artemis-transit",
  moon: "artemis-lunar",
  mars: "mars-surface",
  earth: undefined,
};

function matchingSceneId(
  cfg: CabinConfig,
  activePresetId: string | null,
): SceneId | null {
  if (activePresetId && PRESET_TO_SCENE[activePresetId]) {
    return PRESET_TO_SCENE[activePresetId];
  }
  const match = SCENARIOS.find(
    (s) =>
      Math.abs(s.atmosphere.oxygen_pct - cfg.oxygen_pct) < 1e-6 &&
      Math.abs(s.atmosphere.pressure_kpa - cfg.pressure_kpa) < 1e-6 &&
      Math.abs(s.atmosphere.flow_velocity_cm_s - cfg.flow_velocity_cm_s) <
        1e-6 &&
      Math.abs(s.atmosphere.gravity_g - cfg.gravity_g) < 1e-6,
  );
  return match?.id ?? null;
}

export function TwinView() {
  const presets = usePresets();
  const {
    config,
    presetId,
    presetName,
    selectPreset,
    updateField,
    updateConfig,
    resetToDefault,
  } = useCabinScenario();
  const [geometry, setGeometry] = useState<FuelGeometry>(
    DEFAULT_PARAMS.geometry,
  );
  const [flowDirection, setFlowDirection] = useState<FlowDirection>(
    DEFAULT_PARAMS.flowDirection,
  );
  const [localGravity, setLocalGravity] = useState<number | null>(null);
  const [speed, setSpeed] = useState(1);
  const [paused, setPaused] = useState(false);
  const [igniteSignal, setIgniteSignal] = useState(0);
  const [stats, setStats] = useState<FlameStatsData>({ vitality: 1, fps: 60 });

  const params = useMemo<FlameParams>(
    () => ({
      ...config,
      gravity_g: localGravity ?? config.gravity_g,
      geometry,
      flowDirection,
    }),
    [config, localGravity, geometry, flowDirection],
  );
  const physics = useMemo(() => computePhysics(params), [params]);
  const sceneId = useMemo(
    () => matchingSceneId(params, localGravity === null ? presetId : null),
    [params, localGravity, presetId],
  );
  const scenario = sceneId ? getScenario(sceneId) : null;
  const ignite = () => setIgniteSignal((n) => n + 1);

  const update = <K extends keyof FlameParams>(
    key: K,
    value: FlameParams[K],
  ) => {
    if (key === "geometry") {
      setGeometry(value as FuelGeometry);
      return;
    }
    if (key === "flowDirection") {
      setFlowDirection(value as FlowDirection);
      return;
    }
    if (key === "gravity_g") {
      const gravity = value as number;
      if (gravity > 1) setLocalGravity(gravity);
      else {
        setLocalGravity(null);
        updateField("gravity_g", gravity);
      }
      return;
    }
    updateField(
      key as keyof CabinConfig,
      value as CabinConfig[keyof CabinConfig],
    );
  };

  const handleSelectPreset = (preset: Preset) => {
    setLocalGravity(null);
    const list = presets.data ?? [];
    const idx = list.indexOf(preset);
    selectPreset(preset, presetKey(preset, idx >= 0 ? idx : 0));
    ignite();
  };

  const selectScenario = (id: SceneId) => {
    const targetPresetId = SCENE_TO_PRESET[id];
    const list = presets.data ?? [];
    const matchedPreset = targetPresetId
      ? list.find((p, i) => presetKey(p, i) === targetPresetId)
      : undefined;
    if (matchedPreset) {
      handleSelectPreset(matchedPreset);
      return;
    }
    const chosen = getScenario(id);
    setLocalGravity(null);
    updateConfig(chosen.atmosphere, null, `${chosen.label} (${chosen.gLabel})`);
    ignite();
  };

  const reset = () => {
    setLocalGravity(null);
    const list = presets.data ?? [];
    const issPreset = list.find((p, i) => presetKey(p, i) === "iss");
    if (issPreset) {
      selectPreset(issPreset, "iss");
    } else {
      resetToDefault();
    }
    setGeometry(DEFAULT_PARAMS.geometry);
    setFlowDirection(DEFAULT_PARAMS.flowDirection);
    ignite();
  };

  // Reduced motion → start (or switch to) a still frame; the user can press Resume.
  const onReducedMotion = useCallback((reduced: boolean) => {
    if (reduced) setPaused(true);
  }, []);

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-fg text-sm font-semibold">Live Flame Simulator</h2>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" onClick={ignite}>
            <Flame aria-hidden className="size-3.5" /> Ignite
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPaused((p) => !p)}
            aria-pressed={paused}
          >
            {paused ? (
              <Play aria-hidden className="size-3.5" />
            ) : (
              <Pause aria-hidden className="size-3.5" />
            )}
            {paused ? "Resume" : "Pause"}
          </Button>
          <Button variant="outline" size="sm" onClick={reset}>
            <RotateCcw aria-hidden className="size-3.5" /> Reset
          </Button>
        </div>
      </div>

      <div className="grid items-start gap-4 lg:grid-cols-2 [&>*]:min-w-0">
        <div>
          <FlameControls
            params={params}
            speed={speed}
            presets={presets.data}
            presetsLoading={presets.isPending}
            presetId={localGravity === null ? presetId : null}
            onSelectPreset={handleSelectPreset}
            onChange={update}
            onSpeedChange={setSpeed}
          />
        </div>

        <div>
          <Card>
            <CardHeader
              as="h3"
              title="Gravity scenario"
              subtitle="Watch how the flame responds to gravity"
            />
            <CardBody className="space-y-3">
              <ScenarioTabs value={sceneId} onSelect={selectScenario} />

              <FlameCanvas
                params={params}
                physics={physics}
                speed={speed}
                paused={paused}
                igniteSignal={igniteSignal}
                onStats={setStats}
                onReducedMotion={onReducedMotion}
              />

              <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                {scenario ? (
                  <p>
                    <span className="text-fg font-mono font-medium">
                      {scenario.label} ({scenario.gLabel}):
                    </span>{" "}
                    <span className="text-muted">{scenario.blurb}</span>
                  </p>
                ) : (
                  <p>
                    <span className="text-fg font-mono font-medium">
                      {localGravity === null
                        ? presetName
                        : "Custom high-gravity view"}
                      :
                    </span>{" "}
                    <span className="text-muted">
                      {params.oxygen_pct} % O₂ · {params.pressure_kpa} kPa ·{" "}
                      {params.flow_velocity_cm_s} cm/s · {params.gravity_g} g
                      {localGravity !== null ? " · Flame Simulator only" : ""}
                    </span>
                  </p>
                )}
                <span className="text-muted font-mono text-[10px]">
                  3D volumetric raymarch ·{" "}
                  {paused ? "paused" : `${Math.round(stats.fps)} fps`}
                </span>
              </div>
              <FlameStats
                physics={physics}
                vitality={stats.vitality}
                embedded
              />
            </CardBody>
          </Card>
        </div>
      </div>
      <VentilationCurve uEff={physics.uEff} />
    </section>
  );
}
