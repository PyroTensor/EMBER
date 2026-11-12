"use client";

import React, { useMemo, useState } from "react";
import { Flame, Pause, Play, RotateCcw } from "lucide-react";
import { DILUENT_GASES, FUEL_MATERIALS } from "@/lib/types";
import { BASELINE } from "@/lib/mock-engine";
import {
  FLOW_DIRECTIONS,
  GEOMETRY_OPTIONS,
  GRAVITY_PRESETS,
  SPEED_OPTIONS,
  computePhysics,
  type FlameParams,
  type FlowDirection,
  type FuelGeometryOption,
  type SimStats,
} from "@/lib/flame-sim";
import presets from "@/mock/presets.json";
import { FlameCanvas } from "./FlameCanvas";
import { ParamControl } from "./ParamControl";

const DEFAULTS: FlameParams = {
  oxygen_pct: BASELINE.oxygen_pct,
  pressure_kpa: BASELINE.pressure_kpa,
  flow_velocity_cm_s: BASELINE.flow_velocity_cm_s,
  gravity_g: 1.0,
  fuel_material: "PMMA",
  diluent_gas: "N2",
  geometry: "Droplet",
  flowDirection: "right",
};

const selectCls =
  "w-full rounded border border-zinc-800 bg-black px-2.5 py-1.5 font-mono text-xs text-white focus:border-zinc-600 focus:outline-none";

function riskTone(band: string) {
  return band === "LOW"
    ? "text-emerald-400"
    : band === "ELEVATED"
      ? "text-amber-400"
      : band === "HIGH"
        ? "text-orange-400"
        : "text-rose-500";
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div>
      <div className="font-mono text-[11px] text-zinc-500">{label}</div>
      <div className={`mt-1 font-mono text-sm font-semibold ${tone ?? "text-white"}`}>{value}</div>
    </div>
  );
}

export function FlameSimulator() {
  const [params, setParams] = useState<FlameParams>(DEFAULTS);
  const [presetId, setPresetId] = useState("custom");
  const [speed, setSpeed] = useState(1);
  const [paused, setPaused] = useState(false);
  const [igniteSignal, setIgniteSignal] = useState(0);
  const [stats, setStats] = useState<SimStats>({ particles: 0, vitality: 1, fps: 60 });

  const physics = useMemo(() => computePhysics(params), [params]);

  const update = <K extends keyof FlameParams>(key: K, value: FlameParams[K]) => {
    setPresetId("custom");
    setParams((prev) => ({ ...prev, [key]: value }));
  };

  const applyPreset = (id: string) => {
    if (id === "custom") return;
    const p = presets.find((x) => x.id === id);
    if (!p) return;
    setPresetId(id);
    setParams((prev) => ({
      ...prev,
      oxygen_pct: p.oxygen_pct,
      pressure_kpa: p.pressure_kpa,
      flow_velocity_cm_s: p.flow_velocity_cm_s,
      gravity_g: p.gravity_g,
      fuel_material: p.fuel_material,
      diluent_gas: p.diluent_gas,
    }));
    setIgniteSignal((n) => n + 1);
  };

  const gravityPreset = GRAVITY_PRESETS.find((g) => Math.abs(g.value - params.gravity_g) < 1e-9);
  const flameState =
    stats.vitality > 0.85 ? "Burning" : stats.vitality > 0.04 ? "Dying out" : "Extinguished";

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-sm font-medium text-white">Live Flame Simulator</h2>
        <div className="flex flex-wrap items-center gap-2 font-mono text-xs">
          <button
            type="button"
            onClick={() => setIgniteSignal((n) => n + 1)}
            className="inline-flex items-center gap-1.5 rounded-md border border-zinc-800 bg-zinc-950 px-3 py-1.5 text-zinc-300 transition hover:border-zinc-700 hover:text-white"
          >
            <Flame className="h-3.5 w-3.5" /> Ignite
          </button>
          <button
            type="button"
            onClick={() => setPaused((p) => !p)}
            className="inline-flex items-center gap-1.5 rounded-md border border-zinc-800 bg-zinc-950 px-3 py-1.5 text-zinc-300 transition hover:border-zinc-700 hover:text-white"
          >
            {paused ? <Play className="h-3.5 w-3.5" /> : <Pause className="h-3.5 w-3.5" />}
            {paused ? "Resume" : "Pause"}
          </button>
          <button
            type="button"
            onClick={() => {
              setParams(DEFAULTS);
              setPresetId("custom");
              setIgniteSignal((n) => n + 1);
            }}
            className="inline-flex items-center gap-1.5 rounded-md border border-zinc-800 bg-zinc-950 px-3 py-1.5 text-zinc-300 transition hover:border-zinc-700 hover:text-white"
          >
            <RotateCcw className="h-3.5 w-3.5" /> Reset
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Controls */}
        <div className="space-y-5 rounded-lg border border-zinc-900 bg-zinc-950 p-5 lg:col-span-5">
          <div>
            <label htmlFor="flame-preset" className="mb-1 block text-xs text-zinc-400">
              Cabin preset
            </label>
            <select
              id="flame-preset"
              value={presetId}
              onChange={(e) => applyPreset(e.target.value)}
              className={selectCls}
            >
              <option value="custom">Custom conditions</option>
              {presets.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>

          <ParamControl
            id="flame-o2"
            label="Oxygen (O₂)"
            unit="%"
            value={params.oxygen_pct}
            sliderMin={15}
            sliderMax={40}
            step={0.5}
            hardMin={0}
            hardMax={100}
            onChange={(v) => update("oxygen_pct", v)}
          />
          <ParamControl
            id="flame-pressure"
            label="Cabin pressure"
            unit="kPa"
            value={params.pressure_kpa}
            sliderMin={20}
            sliderMax={101.3}
            step={0.5}
            hardMin={1}
            hardMax={500}
            onChange={(v) => update("pressure_kpa", v)}
          />
          <ParamControl
            id="flame-flow"
            label="Ventilation flow"
            unit="cm/s"
            value={params.flow_velocity_cm_s}
            sliderMin={0}
            sliderMax={50}
            step={0.5}
            hardMin={0}
            hardMax={1000}
            onChange={(v) => update("flow_velocity_cm_s", v)}
          />
          <ParamControl
            id="flame-gravity"
            label="Gravity"
            unit="g"
            value={params.gravity_g}
            sliderMin={0}
            sliderMax={2}
            step={0.01}
            hardMin={0}
            hardMax={20}
            decimals={2}
            onChange={(v) => update("gravity_g", v)}
          />

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="flame-gravity-preset" className="mb-1 block text-xs text-zinc-400">
                Gravity level
              </label>
              <select
                id="flame-gravity-preset"
                value={gravityPreset ? String(gravityPreset.value) : "custom"}
                onChange={(e) => e.target.value !== "custom" && update("gravity_g", parseFloat(e.target.value))}
                className={selectCls}
              >
                {!gravityPreset && <option value="custom">Custom ({params.gravity_g} g)</option>}
                {GRAVITY_PRESETS.map((g) => (
                  <option key={g.value} value={g.value}>
                    {g.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="flame-material" className="mb-1 block text-xs text-zinc-400">
                Fuel material
              </label>
              <select
                id="flame-material"
                value={params.fuel_material}
                onChange={(e) => update("fuel_material", e.target.value)}
                className={selectCls}
              >
                {FUEL_MATERIALS.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="flame-diluent" className="mb-1 block text-xs text-zinc-400">
                Diluent gas
              </label>
              <select
                id="flame-diluent"
                value={params.diluent_gas}
                onChange={(e) => update("diluent_gas", e.target.value)}
                className={selectCls}
              >
                {DILUENT_GASES.map((g) => (
                  <option key={g} value={g}>
                    {g}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="flame-geometry" className="mb-1 block text-xs text-zinc-400">
                Fuel geometry
              </label>
              <select
                id="flame-geometry"
                value={params.geometry}
                onChange={(e) => update("geometry", e.target.value as FuelGeometryOption)}
                className={selectCls}
              >
                {GEOMETRY_OPTIONS.map((g) => (
                  <option key={g} value={g}>
                    {g}
                  </option>
                ))}
              </select>
            </div>
            <div className="col-span-2">
              <label htmlFor="flame-flow-dir" className="mb-1 block text-xs text-zinc-400">
                Flow direction
              </label>
              <select
                id="flame-flow-dir"
                value={params.flowDirection}
                onChange={(e) => update("flowDirection", e.target.value as FlowDirection)}
                className={selectCls}
              >
                {FLOW_DIRECTIONS.map((d) => (
                  <option key={d.value} value={d.value}>
                    {d.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="col-span-2">
              <label htmlFor="flame-speed" className="mb-1 block text-xs text-zinc-400">
                Simulation speed
              </label>
              <select
                id="flame-speed"
                value={speed}
                onChange={(e) => setSpeed(parseFloat(e.target.value))}
                className={selectCls}
              >
                {SPEED_OPTIONS.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Simulation */}
        <div className="space-y-4 lg:col-span-7">
          <div className="rounded-lg border border-zinc-900 bg-zinc-950 p-3">
            <FlameCanvas
              params={params}
              physics={physics}
              speed={speed}
              paused={paused}
              igniteSignal={igniteSignal}
              onStats={setStats}
            />
            <div className="mt-2 flex justify-between font-mono text-[10px] text-zinc-600">
              <span>Illustrative particle model — physics inputs shared with the Cabin Configurator</span>
              <span>
                {stats.particles} particles · {Math.round(stats.fps)} fps
              </span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 rounded-lg border border-zinc-900 bg-zinc-950 p-5 sm:grid-cols-4">
            <Stat label="REGIME" value={physics.regime} />
            <Stat label="FLAME STATE" value={flameState} />
            <Stat label="FIRE RISK" value={`${physics.riskIndex.toFixed(1)} ${physics.riskBand}`} tone={riskTone(physics.riskBand)} />
            <Stat label="PEAK TEMP (≈)" value={`${Math.round(physics.tempK)} K`} />
            <Stat label="LOI" value={`${physics.loi.toFixed(1)} %`} />
            <Stat
              label="O₂ MARGIN"
              value={`${physics.margin >= 0 ? "+" : ""}${physics.margin.toFixed(1)} %`}
              tone={physics.margin >= 0 ? "text-white" : "text-rose-400"}
            />
            <Stat label="u BUOYANT" value={`${physics.uBuoyant.toFixed(1)} cm/s`} />
            <Stat label="u EFFECTIVE" value={`${physics.uEff.toFixed(1)} cm/s`} />
          </div>
        </div>
      </div>
    </section>
  );
}
