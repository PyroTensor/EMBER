"use client";

import { useEffect, useRef, type CSSProperties } from "react";

interface Ember {
  x: number;
  y: number;
  radius: number;
  color: string;
  drift: number;
  rise: number;
  duration: number;
  delay: number;
  peak: number;
}

// A fixed seed gives the server and browser the same SVG on every render.
function makeEmbers(): Ember[] {
  let seed = 872341;
  const random = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  const colors = ["#ff5829", "#ff8240", "#ffaf63", "#ffd38c"];

  return Array.from({ length: 88 }, (_, i) => {
    const duration = 8 + random() * 9;
    return {
      x: 2 + random() * 96,
      y: i < 70 ? 58 + random() * 49 : 8 + random() * 75,
      radius: random() > 0.92 ? 2.7 + random() * 1.5 : 0.65 + random() * 1.45,
      color: colors[Math.floor(random() * colors.length)]!,
      drift: (random() - 0.5) * 95,
      rise: 130 + random() * 290,
      duration,
      delay: -random() * duration,
      peak: 0.3 + random() * 0.55,
    };
  });
}

const EMBERS = makeEmbers();

/** Decorative vector sparks, confined to the Co-Pilot question card. */
export function EmberBackdrop({ loading }: { loading: boolean }) {
  const svgRef = useRef<SVGSVGElement>(null);
  const playbackRate = useRef(1);

  // Ramp the playback rate without resetting each spark's position.
  useEffect(() => {
    const animations = svgRef.current?.getAnimations({ subtree: true }) ?? [];
    const from = playbackRate.current;
    const to = loading ? 16 : 1;
    if (animations.length === 0 || from === to) return;

    const startedAt = performance.now();
    const duration = loading ? 1200 : 900;
    let frame = 0;
    const step = (now: number) => {
      const progress = Math.min(1, (now - startedAt) / duration);
      const eased = progress < 0.5 ? 2 * progress ** 2 : 1 - (-2 * progress + 2) ** 2 / 2;
      const rate = from + (to - from) * eased;
      for (const animation of animations) animation.updatePlaybackRate(rate);
      playbackRate.current = rate;
      if (progress < 1) frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [loading]);

  return (
    <svg ref={svgRef} aria-hidden="true" className="copilot-ember-backdrop">
      <defs>
        <radialGradient id="copilot-ember-glow">
          <stop offset="0%" stopColor="#fff0c3" stopOpacity="0.85" />
          <stop offset="17%" stopColor="#ff8a42" stopOpacity="0.65" />
          <stop offset="52%" stopColor="#e64519" stopOpacity="0.22" />
          <stop offset="100%" stopColor="#e64519" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="copilot-ember-heat">
          <stop offset="0%" stopColor="#b33714" stopOpacity="0.23" />
          <stop offset="100%" stopColor="#b33714" stopOpacity="0" />
        </radialGradient>
      </defs>

      <ellipse cx="50%" cy="108%" rx="65%" ry="48%" fill="url(#copilot-ember-heat)" />
      {EMBERS.map((ember, i) => {
        const style = {
          animationDuration: `${ember.duration}s`,
          animationDelay: `${ember.delay}s`,
          "--drift": `${ember.drift}px`,
          "--rise": `${ember.rise}px`,
          "--peak": ember.peak,
        } as CSSProperties;

        return (
          <g key={i} className="copilot-ember" style={style}>
            <circle
              cx={`${ember.x}%`}
              cy={`${ember.y}%`}
              r={ember.radius * 5.5}
              fill="url(#copilot-ember-glow)"
            />
            <circle cx={`${ember.x}%`} cy={`${ember.y}%`} r={ember.radius} fill={ember.color} />
          </g>
        );
      })}
    </svg>
  );
}
