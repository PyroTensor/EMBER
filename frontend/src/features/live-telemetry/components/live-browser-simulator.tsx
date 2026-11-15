"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  ChevronDown,
  ChevronUp,
  Pause,
  Play,
  Repeat,
  RotateCcw,
  SlidersHorizontal,
  StepForward,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Select } from "@/components/ui/select";
import {
  CabinControls,
  PresetPicker,
  presetId as presetKey,
} from "@/features/cabin";
import { usePresets } from "@/features/presets";
import type { CabinConfig } from "@/lib/api/types";
import {
  DEFAULT_CABIN_CONFIG,
  DEFAULT_PRESET_ID,
  presetToConfig,
  useCabinScenario,
} from "@/lib/cabin-scenario/cabin-scenario-context";
import { useIngestLiveTelemetry, useResetLiveTelemetry } from "../hooks";
import {
  buildBrowserSimulationFrame,
  getScenarioMeta,
  SCENARIO_OPTIONS,
  type BrowserSimScenarioId,
} from "../lib/live-simulator";

type SpeedOption = "500" | "1000" | "2000";

const SPEED_OPTIONS: readonly { value: SpeedOption; label: string }[] = [
  { value: "500", label: "Fast (500 ms)" },
  { value: "1000", label: "Real-time (1 s)" },
  { value: "2000", label: "Slow (2 s)" },
];

export interface LiveBrowserSimulatorProps {
  externalStreamActive?: boolean;
  onRegisterStartHandler?: (handler: () => void) => void;
}

export function LiveBrowserSimulator({
  externalStreamActive = false,
  onRegisterStartHandler,
}: LiveBrowserSimulatorProps) {
  const [scenarioId, setScenarioId] =
    useState<BrowserSimScenarioId>("eva-prebreathe");
  const [speed, setSpeed] = useState<SpeedOption>("1000");
  const [loop, setLoop] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [step, setStep] = useState(0);
  const [showControls, setShowControls] = useState(false);
  const [customConfig, setCustomConfig] = useState<CabinConfig>({
    ...DEFAULT_CABIN_CONFIG,
  });
  const [customPresetId, setCustomPresetId] = useState<string | null>(
    DEFAULT_PRESET_ID,
  );

  const presets = usePresets();
  const cabinScenario = useCabinScenario();
  const ingest = useIngestLiveTelemetry();
  const resetStream = useResetLiveTelemetry();

  const meta = getScenarioMeta(scenarioId);
  const totalSteps = meta.defaultSteps;
  const intervalMs = Number(speed);

  const stepRef = useRef(0);
  const inFlightRef = useRef(false);
  const elapsedRef = useRef(0);
  const latestRef = useRef({
    scenarioId,
    totalSteps,
    intervalMs,
    loop,
    customConfig,
    mutateAsync: ingest.mutateAsync,
  });

  useEffect(() => {
    latestRef.current = {
      scenarioId,
      totalSteps,
      intervalMs,
      loop,
      customConfig,
      mutateAsync: ingest.mutateAsync,
    };
  }, [
    scenarioId,
    totalSteps,
    intervalMs,
    loop,
    customConfig,
    ingest.mutateAsync,
  ]);

  const setSyncedStep = useCallback((next: number) => {
    stepRef.current = next;
    setStep(next);
  }, []);

  const pushFrame = useCallback(async (targetStep: number, resetBuffer: boolean) => {
    if (inFlightRef.current) return;
    inFlightRef.current = true;
    const snap = latestRef.current;
    const elapsedTimeS =
      snap.scenarioId === "custom"
        ? elapsedRef.current
        : (targetStep * snap.intervalMs) / 1000;
    const payload = buildBrowserSimulationFrame(
      snap.scenarioId,
      targetStep,
      snap.totalSteps,
      snap.customConfig,
      {
        intervalMs: snap.intervalMs,
        loop: snap.loop,
        reset: resetBuffer,
        elapsedTimeS,
      },
    );

    try {
      await snap.mutateAsync(payload);
      elapsedRef.current += snap.intervalMs / 1000;
    } catch {
      setPlaying(false);
    } finally {
      inFlightRef.current = false;
    }
  }, []);

  const advanceAndSend = useCallback(() => {
    const snap = latestRef.current;
    const current = stepRef.current;

    if (snap.scenarioId === "custom") {
      setSyncedStep(current + 1);
      void pushFrame(current, current === 0);
      return;
    }

    if (current >= snap.totalSteps) {
      if (snap.loop) {
        setSyncedStep(1);
        elapsedRef.current = 0;
        void pushFrame(0, true);
      } else {
        setPlaying(false);
      }
      return;
    }

    const isFinalStep = current === snap.totalSteps - 1 && !snap.loop;
    setSyncedStep(current + 1);
    void pushFrame(current, current === 0);
    if (isFinalStep) {
      setPlaying(false);
    }
  }, [pushFrame, setSyncedStep]);

  useEffect(() => {
    if (!playing) return;
    const timer = window.setInterval(() => {
      advanceAndSend();
    }, intervalMs);
    return () => window.clearInterval(timer);
  }, [playing, intervalMs, advanceAndSend]);

  const handlePlayToggle = useCallback(() => {
    if (playing) {
      setPlaying(false);
      return;
    }
    const snap = latestRef.current;
    if (snap.scenarioId !== "custom" && stepRef.current >= snap.totalSteps) {
      setSyncedStep(1);
      elapsedRef.current = 0;
      setPlaying(true);
      void pushFrame(0, true);
      return;
    }
    setPlaying(true);
    advanceAndSend();
  }, [playing, advanceAndSend, pushFrame, setSyncedStep]);

  useEffect(() => {
    onRegisterStartHandler?.(() => {
      if (!playing) handlePlayToggle();
    });
  }, [onRegisterStartHandler, playing, handlePlayToggle]);

  const handleStepOnce = () => {
    setPlaying(false);
    if (scenarioId !== "custom" && step >= totalSteps) {
      setSyncedStep(1);
      elapsedRef.current = 0;
      void pushFrame(0, true);
      return;
    }
    advanceAndSend();
  };

  const handleReset = () => {
    setPlaying(false);
    setSyncedStep(0);
    elapsedRef.current = 0;
    resetStream.mutate();
  };

  const handleScenarioChange = (nextId: BrowserSimScenarioId) => {
    setPlaying(false);
    setScenarioId(nextId);
    setSyncedStep(0);
    elapsedRef.current = 0;
    if (nextId === "custom") {
      setShowControls(true);
    }
  };

  const displayStep =
    scenarioId === "custom" ? step : Math.min(step, totalSteps);
  const progressPct =
    scenarioId === "custom"
      ? step > 0
        ? 100
        : 0
      : Math.round((displayStep / totalSteps) * 100);
  const tuneOpen = showControls || scenarioId === "custom";

  return (
    <Card>
      <CardHeader
        title="Browser Telemetry Simulator"
        subtitle="Play, step, or hand-tune live cabin simulation frames directly in the browser"
        action={
          <div className="flex items-center gap-2">
            {playing ? (
              <Badge tone="success" dot>
                Simulating
              </Badge>
            ) : externalStreamActive ? (
              <Badge tone="info">External stream active</Badge>
            ) : (
              <Badge tone="neutral">Ready</Badge>
            )}
          </div>
        }
      />
      <CardBody className="space-y-4">
        <div className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
            <Select<BrowserSimScenarioId>
              label="Simulation scenario"
              value={scenarioId}
              options={SCENARIO_OPTIONS}
              onChange={handleScenarioChange}
            />
            <Select<SpeedOption>
              label="Frame rate"
              value={speed}
              options={SPEED_OPTIONS}
              onChange={setSpeed}
            />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="primary"
              size="md"
              onClick={handlePlayToggle}
              aria-pressed={playing}
            >
              {playing ? (
                <>
                  <Pause aria-hidden className="size-4" />
                  Pause Simulation
                </>
              ) : (
                <>
                  <Play aria-hidden className="size-4" />
                  {displayStep > 0 && displayStep < totalSteps
                    ? "Resume Simulation"
                    : "Play Simulation"}
                </>
              )}
            </Button>
            <Button
              variant="outline"
              size="md"
              onClick={handleStepOnce}
              disabled={ingest.isPending}
              title="Emit one frame immediately"
            >
              <StepForward aria-hidden className="size-4" />
              Step (+1 Frame)
            </Button>
            <Button
              variant={loop ? "primary" : "outline"}
              size="md"
              onClick={() => setLoop((v) => !v)}
              aria-pressed={loop}
              disabled={scenarioId === "custom"}
              title="Loop scripted trajectory continuously"
            >
              <Repeat aria-hidden className="size-4" />
              {loop ? "Loop On" : "Loop"}
            </Button>
            <Button
              variant="ghost"
              size="md"
              onClick={handleReset}
              disabled={resetStream.isPending}
            >
              <RotateCcw aria-hidden className="size-4" />
              Reset
            </Button>
          </div>
        </div>

        <div className="border-border bg-surface-2/40 flex flex-wrap items-center justify-between gap-3 rounded-md border px-3.5 py-2.5 text-xs">
          <p className="text-muted max-w-2xl">{meta.description}</p>
          <div className="flex items-center gap-3 font-mono tabular-nums">
            <span className="text-fg">
              {scenarioId === "custom"
                ? `Frames sent: ${displayStep}`
                : `Step ${displayStep} / ${totalSteps}`}
            </span>
            {scenarioId !== "custom" ? (
              <div
                aria-hidden
                className="bg-surface-2 h-1.5 w-24 overflow-hidden rounded-full"
              >
                <div
                  className="bg-accent h-full rounded-full transition-[width] duration-200"
                  style={{ width: `${progressPct}%` }}
                />
              </div>
            ) : null}
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2">
          <button
            type="button"
            onClick={() => setShowControls((v) => !v)}
            className="text-muted hover:text-fg inline-flex items-center gap-1.5 text-xs font-medium transition-colors"
            aria-expanded={tuneOpen}
          >
            <SlidersHorizontal aria-hidden className="size-3.5" />
            {tuneOpen
              ? "Hide cabin simulator controls"
              : "Tune cabin parameters (Interactive Rig)"}
            {tuneOpen ? (
              <ChevronUp aria-hidden className="size-3.5" />
            ) : (
              <ChevronDown aria-hidden className="size-3.5" />
            )}
          </button>

          {tuneOpen ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setCustomConfig({ ...cabinScenario.config });
                setCustomPresetId(cabinScenario.presetId);
                setScenarioId("custom");
                setSyncedStep(0);
                elapsedRef.current = 0;
              }}
            >
              Copy from Cabin Configurator
            </Button>
          ) : null}
        </div>

        {tuneOpen ? (
          <div className="border-border bg-surface-2/30 space-y-4 rounded-md border p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-fg text-xs font-medium">
                Interactive Cabin Rig Controls
                {scenarioId !== "custom" ? (
                  <span className="text-muted ml-1.5 font-normal">
                    (adjusting any parameter switches to Interactive Cabin Rig mode)
                  </span>
                ) : null}
              </p>
            </div>
            <div className="grid gap-4 lg:grid-cols-[minmax(0,260px)_1fr]">
              <div>
                {presets.data?.length ? (
                  <PresetPicker
                    presets={presets.data}
                    value={customPresetId}
                    onSelect={(p) => {
                      const idx = presets.data.indexOf(p);
                      setCustomPresetId(presetKey(p, idx));
                      setCustomConfig(presetToConfig(p));
                      if (scenarioId !== "custom") {
                        setPlaying(false);
                        setScenarioId("custom");
                        setSyncedStep(0);
                        elapsedRef.current = 0;
                      }
                    }}
                  />
                ) : null}
              </div>
              <CabinControls
                cfg={customConfig}
                onChange={(field, value) => {
                  setCustomPresetId(null);
                  setCustomConfig((prev) => ({ ...prev, [field]: value }));
                  if (scenarioId !== "custom") {
                    setPlaying(false);
                    setScenarioId("custom");
                    setSyncedStep(0);
                    elapsedRef.current = 0;
                  }
                }}
              />
            </div>
          </div>
        ) : null}

        {ingest.isError ? (
          <p role="alert" className="text-offline text-xs">
            Failed to push simulation frame: {ingest.error.message}
          </p>
        ) : null}
      </CardBody>
    </Card>
  );
}
