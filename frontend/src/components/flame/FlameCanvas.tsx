"use client";

import React, { useEffect, useRef } from "react";
import {
  CANVAS_H,
  CANVAS_W,
  FlameSim,
  type FlameParams,
  type FlamePhysics,
  type SimStats,
} from "@/lib/flame-sim";

interface FlameCanvasProps {
  params: FlameParams;
  physics: FlamePhysics;
  speed: number;
  paused: boolean;
  /** Increment to (re)ignite the fuel. */
  igniteSignal: number;
  onStats?: (s: SimStats) => void;
}

export function FlameCanvas({ params, physics, speed, paused, igniteSignal, onStats }: FlameCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const simRef = useRef<FlameSim | null>(null);
  const live = useRef({ params, physics, speed, paused, onStats });

  useEffect(() => {
    live.current = { params, physics, speed, paused, onStats };
  });

  useEffect(() => {
    simRef.current?.ignite();
  }, [igniteSignal]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = CANVAS_W * dpr;
    canvas.height = CANVAS_H * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const sim = new FlameSim();
    simRef.current = sim;

    let raf = 0;
    let last = performance.now();
    let lastStats = 0;

    const frame = (now: number) => {
      const dt = (now - last) / 1000;
      last = now;
      const { params: p, physics: ph, speed: sp, paused: pa, onStats: cb } = live.current;
      sim.update(pa ? 0 : dt, p, ph, sp);
      sim.draw(ctx, p, ph);
      if (cb && now - lastStats > 250) {
        lastStats = now;
        cb(sim.stats);
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(raf);
      simRef.current = null;
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      role="img"
      aria-label="Live flame simulation"
      className="block w-full rounded border border-zinc-900 bg-black"
      style={{ aspectRatio: `${CANVAS_W} / ${CANVAS_H}` }}
    />
  );
}
