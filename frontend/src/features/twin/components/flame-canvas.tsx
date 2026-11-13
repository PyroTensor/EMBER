"use client";

import { useEffect, useRef, useState } from "react";
import type { FlameParams, FlamePhysics } from "../lib/flame-physics";
import { FlameRenderer, type FlameStats } from "../lib/flame-renderer";
import { CANVAS_H, CANVAS_W } from "../lib/flame-scenes";

interface FlameCanvasProps {
  params: FlameParams;
  physics: FlamePhysics;
  speed: number;
  paused: boolean;
  /** Increment to (re)ignite the fuel. */
  igniteSignal: number;
  onStats?: (s: FlameStats) => void;
  /** Reports whether the user prefers reduced motion (the canvas then starts paused). */
  onReducedMotion?: (reduced: boolean) => void;
}

export function FlameCanvas({
  params,
  physics,
  speed,
  paused,
  igniteSignal,
  onStats,
  onReducedMotion,
}: FlameCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rendererRef = useRef<FlameRenderer | null>(null);
  const live = useRef({ params, physics, speed, paused, onStats });
  const [supported, setSupported] = useState(true);

  useEffect(() => {
    live.current = { params, physics, speed, paused, onStats };
  });

  useEffect(() => {
    rendererRef.current?.ignite();
  }, [igniteSignal]);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    onReducedMotion?.(mq.matches);
    const onChange = (e: MediaQueryListEvent) => onReducedMotion?.(e.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [onReducedMotion]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = CANVAS_W * dpr;
    canvas.height = CANVAS_H * dpr;

    const renderer = new FlameRenderer(canvas);
    if (!renderer.init()) {
      setSupported(false);
      return;
    }
    rendererRef.current = renderer;

    let raf = 0;
    let last = performance.now();
    let lastStats = 0;
    let lastDrawn: FlameParams | null = null;

    const frame = (now: number) => {
      const dt = (now - last) / 1000;
      last = now;
      const { params: p, physics: ph, speed: sp, paused: pa, onStats: cb } = live.current;
      // While paused, time is frozen: draw a still frame only when the inputs change
      // (keeps reduced-motion users on a static image).
      if (!pa || lastDrawn !== p) {
        renderer.update(pa ? 0 : dt, ph, sp);
        renderer.draw(p, ph);
        lastDrawn = p;
      }
      if (cb && now - lastStats > 250) {
        lastStats = now;
        cb(renderer.stats);
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(raf);
      renderer.dispose();
      rendererRef.current = null;
    };
  }, []);

  return (
    <div className="relative">
      <canvas
        ref={canvasRef}
        role="img"
        aria-label={`3D flame simulation: ${physics.regime.toLowerCase()} at ${params.gravity_g} g, ${params.oxygen_pct} % oxygen`}
        className="block w-full rounded-md border border-border bg-black"
        style={{ aspectRatio: `${CANVAS_W} / ${CANVAS_H}` }}
      />
      {!supported ? (
        <p className="absolute inset-0 flex items-center justify-center px-4 text-center text-sm text-muted">
          3D flame needs WebGL2
        </p>
      ) : null}
    </div>
  );
}
