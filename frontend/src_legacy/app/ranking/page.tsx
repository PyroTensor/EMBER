"use client";

import React, { useEffect, useMemo, useState } from "react";
import { getPresets, getTelemetry, rankExperiments, useDataMode } from "@/lib/api";
import { BASELINE } from "@/lib/mock-engine";
import type {
  CabinConfig,
  CombustionRegime,
  Preset,
  RankedExperiment,
  RankWeights,
  Telemetry,
} from "@/lib/types";

function regimeTextClass(regime: CombustionRegime | string) {
  switch (regime) {
    case "Sustained Burn":
      return "text-rose-400";
    case "Cool Flame":
      return "text-sky-400";
    case "Self-Extinguished":
      return "text-amber-400";
    case "No Ignition":
    default:
      return "text-zinc-400";
  }
}

function DualAxisTelemetryChart({ telemetry }: { telemetry: Telemetry }) {
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);

  const width = 640;
  const height = 240;
  const padLeft = 44;
  const padRight = 46;
  const padTop = 20;
  const padBottom = 32;
  const plotW = width - padLeft - padRight;
  const plotH = height - padTop - padBottom;

  const n = telemetry.time_s.length;

  const { tMin, tMax, rMin, rMax, qMin, qMax } = useMemo(() => {
    const times = telemetry.time_s.length ? telemetry.time_s : [0, 1];
    const radii = telemetry.flame_radius_mm.length ? telemetry.flame_radius_mm : [0, 1];
    const fluxes = telemetry.radiative_heat_flux_kw_m2.length
      ? telemetry.radiative_heat_flux_kw_m2
      : [0, 1];

    const minT = Math.min(...times);
    const maxT = Math.max(...times, minT + 1e-3);
    const minR = Math.min(0, ...radii);
    const maxR = Math.max(...radii, minR + 1.0);
    const minQ = Math.min(0, ...fluxes);
    const maxQ = Math.max(...fluxes, minQ + 0.5);

    return {
      tMin: minT,
      tMax: maxT,
      rMin: minR,
      rMax: maxR * 1.08,
      qMin: minQ,
      qMax: maxQ * 1.08,
    };
  }, [telemetry]);

  const xOf = (t: number) => padLeft + ((t - tMin) / (tMax - tMin || 1)) * plotW;
  const yRadius = (r: number) => padTop + plotH - ((r - rMin) / (rMax - rMin || 1)) * plotH;
  const yFlux = (q: number) => padTop + plotH - ((q - qMin) / (qMax - qMin || 1)) * plotH;

  const radiusPoints = telemetry.time_s
    .map((t, i) => `${xOf(t).toFixed(1)},${yRadius(telemetry.flame_radius_mm[i] ?? 0).toFixed(1)}`)
    .join(" ");

  const fluxPoints = telemetry.time_s
    .map(
      (t, i) =>
        `${xOf(t).toFixed(1)},${yFlux(telemetry.radiative_heat_flux_kw_m2[i] ?? 0).toFixed(1)}`,
    )
    .join(" ");

  const activeIdx = hoverIdx !== null && hoverIdx < n ? hoverIdx : n > 0 ? n - 1 : null;

  return (
    <div className="space-y-2.5">
      <div className="flex flex-wrap items-center justify-between gap-2 font-mono text-xs text-zinc-400">
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1.5 text-zinc-200">
            <span className="h-2 w-2 rounded-full bg-white" />
            Radius (mm)
          </span>
          <span className="flex items-center gap-1.5 text-sky-400">
            <span className="h-2 w-2 rounded-full bg-sky-400" />
            Heat Flux (kW/m²)
          </span>
        </div>

        {activeIdx !== null && (
          <div className="flex items-center gap-3 text-[11px]">
            <span>t={telemetry.time_s[activeIdx]?.toFixed(1)}s</span>
            <span className="text-white">
              R={telemetry.flame_radius_mm[activeIdx]?.toFixed(2)} mm
            </span>
            <span className="text-sky-400">
              q={telemetry.radiative_heat_flux_kw_m2[activeIdx]?.toFixed(2)} kW/m²
            </span>
          </div>
        )}
      </div>

      <div className="rounded border border-zinc-900 bg-black p-2">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="h-56 w-full select-none"
          onMouseLeave={() => setHoverIdx(null)}
        >
          {[0, 0.5, 1].map((frac) => {
            const y = padTop + plotH * (1 - frac);
            const rVal = rMin + frac * (rMax - rMin);
            const qVal = qMin + frac * (qMax - qMin);
            return (
              <g key={frac}>
                <line
                  x1={padLeft}
                  y1={y}
                  x2={width - padRight}
                  y2={y}
                  stroke="#18181b"
                  strokeWidth="1"
                />
                <text
                  x={padLeft - 6}
                  y={y + 3}
                  textAnchor="end"
                  fill="#a1a1aa"
                  fontSize="10"
                  fontFamily="monospace"
                >
                  {rVal.toFixed(1)}
                </text>
                <text
                  x={width - padRight + 6}
                  y={y + 3}
                  textAnchor="start"
                  fill="#38bdf8"
                  fontSize="10"
                  fontFamily="monospace"
                >
                  {qVal.toFixed(1)}
                </text>
              </g>
            );
          })}

          {[0, 0.5, 1].map((frac) => {
            const x = padLeft + plotW * frac;
            const tVal = tMin + frac * (tMax - tMin);
            return (
              <text
                key={frac}
                x={x}
                y={height - 8}
                textAnchor="middle"
                fill="#71717a"
                fontSize="10"
                fontFamily="monospace"
              >
                {tVal.toFixed(1)}s
              </text>
            );
          })}

          {n > 1 && (
            <>
              <polyline fill="none" stroke="#ffffff" strokeWidth="1.75" points={radiusPoints} />
              <polyline fill="none" stroke="#38bdf8" strokeWidth="1.75" points={fluxPoints} />
            </>
          )}

          {activeIdx !== null && telemetry.time_s[activeIdx] !== undefined && (
            <g>
              <line
                x1={xOf(telemetry.time_s[activeIdx])}
                y1={padTop}
                x2={xOf(telemetry.time_s[activeIdx])}
                y2={padTop + plotH}
                stroke="#3f3f46"
                strokeWidth="1"
              />
              <circle
                cx={xOf(telemetry.time_s[activeIdx])}
                cy={yRadius(telemetry.flame_radius_mm[activeIdx] ?? 0)}
                r="3.5"
                fill="#ffffff"
              />
              <circle
                cx={xOf(telemetry.time_s[activeIdx])}
                cy={yFlux(telemetry.radiative_heat_flux_kw_m2[activeIdx] ?? 0)}
                r="3.5"
                fill="#38bdf8"
              />
            </g>
          )}

          {telemetry.time_s.map((t, idx) => {
            const x = xOf(t);
            const sliceW = plotW / Math.max(n, 1);
            return (
              <rect
                key={idx}
                x={x - sliceW / 2}
                y={padTop}
                width={Math.max(sliceW, 4)}
                height={plotH}
                fill="transparent"
                className="cursor-crosshair"
                onMouseEnter={() => setHoverIdx(idx)}
              />
            );
          })}
        </svg>
      </div>
    </div>
  );
}

export default function RankingAndTelemetryPage() {
  const { useMock } = useDataMode();
  const [presets, setPresets] = useState<Preset[]>([]);
  const [selectedPresetId, setSelectedPresetId] = useState<string>("iss");
  const [scenarioConfig, setScenarioConfig] = useState<CabinConfig>(BASELINE);
  const [weights, setWeights] = useState<RankWeights>({
    similarity: 0.5,
    completeness: 0.2,
    criticality: 0.3,
  });
  const [ranked, setRanked] = useState<RankedExperiment[]>([]);
  const [selectedExpId, setSelectedExpId] = useState<string | null>(null);
  const [telemetry, setTelemetry] = useState<Telemetry | null>(null);

  useEffect(() => {
    void getPresets().then(setPresets);
  }, [useMock]);

  useEffect(() => {
    let cancelled = false;
    void rankExperiments({ config: scenarioConfig, limit: 15 }).then((res) => {
      if (cancelled) return;
      setWeights(res.weights);
      setRanked(res.results);
      if (res.results.length > 0) {
        setSelectedExpId((prev) =>
          prev && res.results.some((r) => r.experiment_id === prev)
            ? prev
            : res.results[0].experiment_id,
        );
      }
    });
    return () => {
      cancelled = true;
    };
  }, [scenarioConfig, useMock]);

  useEffect(() => {
    if (!selectedExpId) return;
    let cancelled = false;
    void getTelemetry(selectedExpId).then((t) => {
      if (!cancelled) setTelemetry(t);
    });
    return () => {
      cancelled = true;
    };
  }, [selectedExpId, useMock]);

  const handleSelectPreset = (p: Preset) => {
    setSelectedPresetId(p.id);
    setScenarioConfig({
      oxygen_pct: p.oxygen_pct,
      pressure_kpa: p.pressure_kpa,
      flow_velocity_cm_s: p.flow_velocity_cm_s,
      gravity_g: p.gravity_g,
      fuel_material: p.fuel_material,
      diluent_gas: p.diluent_gas,
    });
  };

  const selectedRankedItem =
    ranked.find((r) => r.experiment_id === selectedExpId) ?? ranked[0] ?? null;

  const extraEntries = Object.entries(selectedRankedItem?.record.extra_telemetry ?? {});

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-zinc-900 pb-5">
        <div>
          <p className="font-mono text-xs text-zinc-500">03 / RANKING &amp; TELEMETRY</p>
          <h1 className="mt-1 text-xl font-semibold text-white">
            Experiment Scenario Ranker &amp; Time-Series Curves
          </h1>
        </div>
        <div className="font-mono text-xs text-zinc-500">
          Weights: Sim {(weights.similarity * 100).toFixed(0)}% · Comp{" "}
          {(weights.completeness * 100).toFixed(0)}% · Crit {(weights.criticality * 100).toFixed(0)}%
        </div>
      </div>

      {/* Presets */}
      <div className="flex flex-wrap gap-2">
        {presets.map((p) => {
          const active = selectedPresetId === p.id;
          return (
            <button
              key={p.id}
              type="button"
              onClick={() => handleSelectPreset(p)}
              className={`rounded-md border px-3 py-2 text-left transition ${
                active
                  ? "border-zinc-500 bg-zinc-900 text-white"
                  : "border-zinc-900 bg-zinc-950 text-zinc-400 hover:border-zinc-800 hover:text-zinc-200"
              }`}
            >
              <div className="text-xs font-medium">{p.name}</div>
              <div className="mt-0.5 font-mono text-[11px] text-zinc-500">
                {p.oxygen_pct}% O₂ · {p.pressure_kpa} kPa · {p.flow_velocity_cm_s} cm/s ·{" "}
                {p.gravity_g}g
              </div>
            </button>
          );
        })}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Table */}
        <div className="space-y-4 lg:col-span-7">
          <div className="overflow-hidden rounded-lg border border-zinc-900 bg-zinc-950">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-zinc-900 bg-black font-mono text-[11px] text-zinc-500">
                  <tr>
                    <th className="px-3.5 py-2.5">#</th>
                    <th className="px-3.5 py-2.5">ID</th>
                    <th className="px-3.5 py-2.5">Program</th>
                    <th className="px-3.5 py-2.5">Material / Conditions</th>
                    <th className="px-3.5 py-2.5">Regime</th>
                    <th className="px-3.5 py-2.5 text-right">Score</th>
                    <th className="px-3.5 py-2.5 text-right">S / C / K</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-900">
                  {ranked.map((item) => {
                    const isSelected = item.experiment_id === selectedRankedItem?.experiment_id;
                    const r = item.record;
                    return (
                      <tr
                        key={item.experiment_id}
                        onClick={() => setSelectedExpId(item.experiment_id)}
                        className={`cursor-pointer transition ${
                          isSelected ? "bg-zinc-900 text-white" : "text-zinc-300 hover:bg-zinc-900/50"
                        }`}
                      >
                        <td className="px-3.5 py-2.5 font-mono text-zinc-500">{item.rank}</td>
                        <td className="px-3.5 py-2.5 font-mono font-medium text-white">
                          {item.experiment_id}
                        </td>
                        <td className="px-3.5 py-2.5 font-mono text-zinc-400">{r.program}</td>
                        <td className="px-3.5 py-2.5">
                          <div className="text-zinc-200">{r.fuel_material}</div>
                          <div className="font-mono text-[11px] text-zinc-500">
                            {r.oxygen_pct}% · {r.pressure_kpa} kPa · {r.flow_velocity_cm_s} cm/s ·{" "}
                            {r.gravity_g}g
                          </div>
                        </td>
                        <td
                          className={`px-3.5 py-2.5 font-mono text-[11px] ${regimeTextClass(
                            r.combustion_regime,
                          )}`}
                        >
                          {r.combustion_regime}
                        </td>
                        <td className="px-3.5 py-2.5 text-right font-mono font-semibold text-white">
                          {item.total_score.toFixed(1)}
                        </td>
                        <td className="px-3.5 py-2.5 text-right font-mono text-[11px] text-zinc-500">
                          {item.similarity.toFixed(0)}/{item.completeness.toFixed(0)}/
                          {item.criticality.toFixed(0)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          <div className="rounded-lg border border-dashed border-zinc-800 p-4 font-mono text-xs text-zinc-500">
            TODO(squad3-A): Interactive weight sliders (w_sim, w_comp, w_crit)
          </div>
        </div>

        {/* Telemetry & extra_telemetry */}
        <div className="space-y-5 lg:col-span-5">
          <div className="rounded-lg border border-zinc-900 bg-zinc-950 p-5">
            <div className="mb-3 flex items-center justify-between border-b border-zinc-900 pb-3">
              <div>
                <div className="font-mono text-xs font-medium text-white">
                  {selectedRankedItem?.experiment_id ?? "EXP-0001"} ·{" "}
                  {selectedRankedItem?.record.program}
                </div>
                <div className="text-xs text-zinc-500">
                  {selectedRankedItem?.record.fuel_material} (
                  {selectedRankedItem?.record.fuel_geometry})
                </div>
              </div>
              {selectedRankedItem?.record.source_doc_id && (
                <span className="font-mono text-[11px] text-zinc-500">
                  {selectedRankedItem.record.source_doc_id} p.{selectedRankedItem.record.source_page}
                </span>
              )}
            </div>

            {telemetry ? (
              <DualAxisTelemetryChart telemetry={telemetry} />
            ) : (
              <div className="flex h-56 items-center justify-center font-mono text-xs text-zinc-600">
                Loading telemetry...
              </div>
            )}
          </div>

          <div className="rounded-lg border border-zinc-900 bg-zinc-950 p-5">
            <div className="flex items-center justify-between border-b border-zinc-900 pb-2.5">
              <span className="font-mono text-xs text-zinc-300">EXTRA TELEMETRY (ESCAPE HATCH)</span>
              <span className="font-mono text-[11px] text-zinc-500">{extraEntries.length} keys</span>
            </div>

            <div className="mt-3 grid grid-cols-2 gap-2">
              {extraEntries.map(([key, val]) => (
                <div key={key} className="rounded border border-zinc-900 bg-black p-2.5">
                  <div className="truncate font-mono text-[10px] text-zinc-500">{key}</div>
                  <div className="mt-0.5 font-mono text-xs text-zinc-200">
                    {val === null || val === undefined ? "null" : String(val)}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-lg border border-dashed border-zinc-800 p-4 font-mono text-xs text-zinc-500">
            TODO(squad3-A): 3-panel synchronized curves (radius, d² droplet law, temperature)
          </div>
        </div>
      </div>
    </div>
  );
}
