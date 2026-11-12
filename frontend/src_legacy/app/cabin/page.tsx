"use client";

import React, { useEffect, useState } from "react";
import { evaluateCabin, getPresets, useDataMode } from "@/lib/api";
import { BASELINE, round } from "@/lib/mock-engine";
import {
  DILUENT_GASES,
  FUEL_MATERIALS,
  GRAVITY_LEVELS,
  type CabinConfig,
  type CabinEvaluation,
  type Preset,
  type RiskBand,
} from "@/lib/types";

function riskColor(band: RiskBand) {
  switch (band) {
    case "LOW":
      return { text: "text-emerald-400", bar: "bg-emerald-500" };
    case "ELEVATED":
      return { text: "text-amber-400", bar: "bg-amber-500" };
    case "HIGH":
      return { text: "text-orange-400", bar: "bg-orange-500" };
    case "CRITICAL":
      return { text: "text-rose-500", bar: "bg-rose-500" };
  }
}

export default function CabinConfiguratorPage() {
  const { useMock } = useDataMode();
  const [presets, setPresets] = useState<Preset[]>([]);
  const [activePresetId, setActivePresetId] = useState<string>("iss");
  const [config, setConfig] = useState<CabinConfig>(BASELINE);
  const [evaluation, setEvaluation] = useState<CabinEvaluation | null>(null);

  useEffect(() => {
    void getPresets().then(setPresets);
  }, [useMock]);

  useEffect(() => {
    let cancelled = false;
    void evaluateCabin(config).then((res) => {
      if (!cancelled) setEvaluation(res);
    });
    return () => {
      cancelled = true;
    };
  }, [config, useMock]);

  const applyPreset = (p: Preset) => {
    setActivePresetId(p.id);
    setConfig({
      oxygen_pct: p.oxygen_pct,
      pressure_kpa: p.pressure_kpa,
      flow_velocity_cm_s: p.flow_velocity_cm_s,
      gravity_g: p.gravity_g,
      fuel_material: p.fuel_material,
      diluent_gas: p.diluent_gas,
    });
  };

  const updateField = <K extends keyof CabinConfig>(field: K, value: CabinConfig[K]) => {
    setActivePresetId("custom");
    setConfig((prev) => ({ ...prev, [field]: value }));
  };

  const tone = riskColor(evaluation?.risk_band ?? "LOW");
  const shapleySum = evaluation
    ? round(
        evaluation.contributions.reduce((acc, c) => acc + c.value, 0),
        2,
      )
    : 0;

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-zinc-900 pb-5">
        <div>
          <p className="font-mono text-xs text-zinc-500">01 / CABIN CONFIGURATOR</p>
          <h1 className="mt-1 text-xl font-semibold text-white">
            Atmosphere Flammability &amp; Risk Attribution
          </h1>
        </div>

        <button
          type="button"
          onClick={() => {
            setActivePresetId("iss");
            setConfig(BASELINE);
          }}
          className="rounded-md border border-zinc-800 bg-zinc-950 px-3 py-1.5 font-mono text-xs text-zinc-300 transition hover:border-zinc-700 hover:text-white"
        >
          Reset to ISS
        </button>
      </div>

      {/* Presets */}
      <div className="flex flex-wrap gap-2">
        {presets.map((p) => {
          const isSelected = activePresetId === p.id;
          return (
            <button
              key={p.id}
              type="button"
              onClick={() => applyPreset(p)}
              className={`rounded-md border px-3 py-2 text-left transition ${
                isSelected
                  ? "border-zinc-500 bg-zinc-900 text-white"
                  : "border-zinc-900 bg-zinc-950 text-zinc-400 hover:border-zinc-800 hover:text-zinc-200"
              }`}
            >
              <div className="text-xs font-medium">{p.name}</div>
              <div className="mt-0.5 font-mono text-[11px] text-zinc-500">
                {p.oxygen_pct}% O₂ · {p.pressure_kpa} kPa · {p.gravity_g}g
              </div>
            </button>
          );
        })}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Controls */}
        <div className="space-y-5 rounded-lg border border-zinc-900 bg-zinc-950 p-5 lg:col-span-5">
          <div className="space-y-1.5">
            <div className="flex justify-between text-xs">
              <label htmlFor="oxygen-slider" className="text-zinc-300">
                Oxygen (O₂)
              </label>
              <span className="font-mono text-white">{config.oxygen_pct.toFixed(1)}%</span>
            </div>
            <input
              id="oxygen-slider"
              type="range"
              min={15}
              max={40}
              step={0.5}
              value={config.oxygen_pct}
              onChange={(e) => updateField("oxygen_pct", parseFloat(e.target.value))}
              className="w-full cursor-pointer"
            />
          </div>

          <div className="space-y-1.5">
            <div className="flex justify-between text-xs">
              <label htmlFor="pressure-slider" className="text-zinc-300">
                Cabin Pressure
              </label>
              <span className="font-mono text-white">{config.pressure_kpa.toFixed(1)} kPa</span>
            </div>
            <input
              id="pressure-slider"
              type="range"
              min={40}
              max={101.3}
              step={0.5}
              value={config.pressure_kpa}
              onChange={(e) => updateField("pressure_kpa", parseFloat(e.target.value))}
              className="w-full cursor-pointer"
            />
          </div>

          <div className="space-y-1.5">
            <div className="flex justify-between text-xs">
              <label htmlFor="flow-slider" className="text-zinc-300">
                Ventilation Flow
              </label>
              <span className="font-mono text-white">
                {config.flow_velocity_cm_s.toFixed(1)} cm/s
              </span>
            </div>
            <input
              id="flow-slider"
              type="range"
              min={0}
              max={50}
              step={0.5}
              value={config.flow_velocity_cm_s}
              onChange={(e) => updateField("flow_velocity_cm_s", parseFloat(e.target.value))}
              className="w-full cursor-pointer"
            />
          </div>

          <div className="space-y-1.5 pt-1">
            <label className="block text-xs text-zinc-300">Gravity</label>
            <div className="grid grid-cols-2 gap-1.5">
              {GRAVITY_LEVELS.map((g) => {
                const active = Math.abs(config.gravity_g - g.value) < 0.01;
                return (
                  <button
                    key={g.value}
                    type="button"
                    onClick={() => updateField("gravity_g", g.value)}
                    className={`rounded border px-2.5 py-1.5 text-left font-mono text-xs transition ${
                      active
                        ? "border-zinc-500 bg-zinc-900 text-white"
                        : "border-zinc-900 bg-black text-zinc-400 hover:border-zinc-800"
                    }`}
                  >
                    {g.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 pt-1">
            <div>
              <label htmlFor="fuel-material-select" className="mb-1 block text-xs text-zinc-400">
                Material
              </label>
              <select
                id="fuel-material-select"
                value={config.fuel_material}
                onChange={(e) => updateField("fuel_material", e.target.value)}
                className="w-full rounded border border-zinc-800 bg-black px-2.5 py-1.5 font-mono text-xs text-white focus:border-zinc-600 focus:outline-none"
              >
                {FUEL_MATERIALS.map((mat) => (
                  <option key={mat} value={mat}>
                    {mat}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="diluent-gas-select" className="mb-1 block text-xs text-zinc-400">
                Diluent
              </label>
              <select
                id="diluent-gas-select"
                value={config.diluent_gas}
                onChange={(e) => updateField("diluent_gas", e.target.value)}
                className="w-full rounded border border-zinc-800 bg-black px-2.5 py-1.5 font-mono text-xs text-white focus:border-zinc-600 focus:outline-none"
              >
                {DILUENT_GASES.map((gas) => (
                  <option key={gas} value={gas}>
                    {gas}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Output */}
        <div className="space-y-5 lg:col-span-7">
          <div className="rounded-lg border border-zinc-900 bg-zinc-950 p-5">
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <div>
                <div className="font-mono text-[11px] text-zinc-500">FIRE RISK INDEX</div>
                <div className={`mt-1 font-mono text-3xl font-semibold ${tone.text}`}>
                  {evaluation ? evaluation.risk_index.toFixed(1) : "—"}
                </div>
                <div className="mt-0.5 font-mono text-[11px] text-zinc-400">
                  {evaluation?.risk_band ?? "—"}
                </div>
              </div>

              <div>
                <div className="font-mono text-[11px] text-zinc-500">REGIME</div>
                <div className="mt-1 text-sm font-medium text-white">
                  {evaluation?.predicted_regime ?? "—"}
                </div>
                <div className="mt-0.5 font-mono text-[11px] text-zinc-500">
                  Base: {evaluation?.baseline_risk.toFixed(1) ?? "47.8"}
                </div>
              </div>

              <div>
                <div className="font-mono text-[11px] text-zinc-500">ESTIMATED LOI</div>
                <div className="mt-1 font-mono text-xl font-semibold text-white">
                  {evaluation ? `${evaluation.estimated_loi_pct.toFixed(1)}%` : "—"}
                </div>
              </div>

              <div>
                <div className="font-mono text-[11px] text-zinc-500">O₂ MARGIN</div>
                <div className="mt-1 font-mono text-xl font-semibold text-white">
                  {evaluation
                    ? `${evaluation.oxygen_margin_pct >= 0 ? "+" : ""}${evaluation.oxygen_margin_pct.toFixed(1)}%`
                    : "—"}
                </div>
              </div>
            </div>

            <div className="mt-4 h-1.5 w-full overflow-hidden rounded-full bg-zinc-900">
              <div
                className={`h-full transition-all duration-200 ${tone.bar}`}
                style={{ width: `${Math.min(Math.max(evaluation?.risk_index ?? 0, 2), 100)}%` }}
              />
            </div>
          </div>

          {/* Shapley */}
          <div className="rounded-lg border border-zinc-900 bg-zinc-950 p-5">
            <div className="flex items-center justify-between border-b border-zinc-900 pb-3">
              <span className="font-mono text-xs text-zinc-300">
                SHAPLEY FEATURE CONTRIBUTIONS (VS. ISS BASELINE)
              </span>
              <span className="font-mono text-xs text-zinc-500">
                Δ = {shapleySum >= 0 ? `+${shapleySum}` : shapleySum} pts
              </span>
            </div>

            <div className="mt-4 space-y-3">
              {(evaluation?.contributions ?? []).map((c) => {
                const pct = Math.min((Math.abs(c.value) / 45) * 50, 50);
                const isPos = c.value >= 0;
                return (
                  <div key={c.feature} className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className="text-zinc-300">{c.label}</span>
                      <span className="font-mono text-zinc-400">
                        {c.value >= 0 ? `+${c.value.toFixed(2)}` : c.value.toFixed(2)}
                      </span>
                    </div>
                    <div className="relative h-2 w-full bg-zinc-900">
                      <div className="absolute top-0 bottom-0 left-1/2 w-px bg-zinc-700" />
                      {isPos ? (
                        <div
                          className="absolute top-0 bottom-0 bg-rose-500"
                          style={{ left: "50%", width: `${pct}%` }}
                        />
                      ) : (
                        <div
                          className="absolute top-0 bottom-0 bg-emerald-500"
                          style={{ right: "50%", width: `${pct}%` }}
                        />
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="rounded-lg border border-dashed border-zinc-800 p-4 font-mono text-xs text-zinc-500">
            TODO(squad3-A): 2D Flammability Phase Diagram (O₂% vs. Pressure kPa contour plot)
          </div>
        </div>
      </div>
    </div>
  );
}
