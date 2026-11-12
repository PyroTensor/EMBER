/**
 * Live flame simulation (illustrative, NOT CFD).
 *
 * Physics inputs (LOI, regime, buoyant velocity, risk) come from the shared mock-engine
 * port of data_ml/ember_data/physics/combustion.py, so the animation always agrees with the
 * Cabin Configurator. The particle system itself is a visual model:
 *   - buoyancy  -> upward acceleration / teardrop taper (0 g => spherical shell)
 *   - ventilation -> advection of the flame in the chosen direction
 *   - O2 margin -> flame size, brightness and whether the flame survives
 */
import {
  buoyantVelocity,
  effectiveVelocity,
  limitingOxygenIndex,
  oxygenMargin,
  predictRegime,
  risk,
  riskBand,
} from "./mock-engine";
import type { CabinConfig, RiskBand } from "./types";

// ---------------------------------------------------------------- parameters
export type FuelGeometryOption = "Droplet" | "Gaseous" | "Rod" | "Flat Sheet";
export type FlowDirection = "right" | "left" | "up" | "down";

export const GEOMETRY_OPTIONS: FuelGeometryOption[] = ["Droplet", "Gaseous", "Rod", "Flat Sheet"];
export const FLOW_DIRECTIONS: { value: FlowDirection; label: string }[] = [
  { value: "right", label: "Crossflow → (left to right)" },
  { value: "left", label: "Crossflow ← (right to left)" },
  { value: "up", label: "Upward (concurrent with buoyancy)" },
  { value: "down", label: "Downward (opposed to buoyancy)" },
];
export const SPEED_OPTIONS = [
  { value: 0.25, label: "0.25× (slow motion)" },
  { value: 0.5, label: "0.5×" },
  { value: 1, label: "1× (real time)" },
  { value: 2, label: "2×" },
];
export const GRAVITY_PRESETS = [
  { value: 0, label: "0 g — microgravity" },
  { value: 0.16, label: "0.16 g — Moon" },
  { value: 0.38, label: "0.38 g — Mars" },
  { value: 1, label: "1 g — Earth" },
  { value: 2.53, label: "2.53 g — Jupiter" },
];

export interface FlameParams {
  oxygen_pct: number;
  pressure_kpa: number;
  flow_velocity_cm_s: number;
  gravity_g: number;
  fuel_material: string;
  diluent_gas: string;
  geometry: FuelGeometryOption;
  flowDirection: FlowDirection;
}

export interface FlamePhysics {
  uBuoyant: number;
  uEff: number;
  loi: number;
  margin: number;
  regime: string;
  riskIndex: number;
  riskBand: RiskBand;
  /** Illustrative peak flame temperature (K). */
  tempK: number;
  /** Relative flame size (1.0 = reference). */
  sizeFactor: number;
  /** Target brightness/fuel-burn intensity for the current regime (0 = no flame). */
  baseIntensity: number;
}

const FUEL_T: Record<string, number> = {
  PMMA: 1900,
  "Cotton-Fiberglass": 1750,
  Nomex: 1650,
  Heptane: 2000,
  Methanol: 1900,
};
const DILUENT_T: Record<string, number> = { N2: 0, CO2: -120, He: -20, Ar: 40 };
const SOOTINESS: Record<string, number> = {
  Heptane: 0.65,
  PMMA: 0.5,
  "Cotton-Fiberglass": 0.35,
  Nomex: 0.15,
  Methanol: 0,
};

const clamp = (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, x));

export function toCabinConfig(p: FlameParams): CabinConfig {
  return {
    oxygen_pct: p.oxygen_pct,
    pressure_kpa: p.pressure_kpa,
    flow_velocity_cm_s: p.flow_velocity_cm_s,
    gravity_g: p.gravity_g,
    fuel_material: p.fuel_material,
    diluent_gas: p.diluent_gas,
  };
}

export function computePhysics(p: FlameParams): FlamePhysics {
  const cfg = toCabinConfig(p);
  const uBuoyant = buoyantVelocity(p.gravity_g, p.pressure_kpa);
  const uEff = effectiveVelocity(p.flow_velocity_cm_s, p.gravity_g, p.pressure_kpa);
  const { margin } = oxygenMargin(cfg);
  const loi = limitingOxygenIndex(p.fuel_material, p.gravity_g, p.pressure_kpa, p.flow_velocity_cm_s, p.diluent_gas);
  const regime = predictRegime(p.fuel_material, p.gravity_g, margin);
  const r = risk(cfg);

  let baseIntensity = 0;
  if (regime === "Sustained Burn") baseIntensity = clamp(0.6 + margin / 14, 0.6, 1.6);
  else if (regime === "Cool Flame") baseIntensity = 0.55;
  else if (regime === "Self-Extinguished") baseIntensity = 0.6;
  else baseIntensity = 0.5; // brief ignition flash only

  const buoyFrac = clamp(uBuoyant / 30, 0, 1);
  let tempK = (FUEL_T[p.fuel_material] ?? 1800) + 12 * clamp(p.oxygen_pct - 21, -15, 40);
  tempK += DILUENT_T[p.diluent_gas] ?? 0;
  tempK -= 80 * (1 - buoyFrac);
  if (regime === "Cool Flame") tempK = 650 + 2 * (p.oxygen_pct - 21);
  tempK = clamp(tempK, 500, 3200);

  const pressureScale = clamp(Math.pow(101.3 / Math.max(p.pressure_kpa, 1), 0.2), 0.7, 1.5);
  let sizeFactor = clamp(0.55 + margin / 16, 0.45, 1.5) * pressureScale;
  if (regime === "Cool Flame") sizeFactor *= 1.4;
  if (regime === "Self-Extinguished" || regime === "No Ignition") sizeFactor = Math.min(sizeFactor, 0.8);

  return {
    uBuoyant,
    uEff,
    loi,
    margin,
    regime,
    riskIndex: r,
    riskBand: riskBand(r),
    tempK,
    sizeFactor,
    baseIntensity,
  };
}

// ---------------------------------------------------------------- simulation
export const CANVAS_W = 640;
export const CANVAS_H = 480;
const VEL_PX_PER_CM_S = 4; // visual scale: 1 cm/s -> 4 px/s
const MAX_PARTICLES = 2200;
const SPRITE_BUCKETS = 40;
const SPRITE_SIZE = 64;

type RGB = [number, number, number];
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const mixRGB = (a: RGB, b: RGB, t: number): RGB => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];

interface Particle {
  x: number;
  y: number;
  x0: number;
  vx: number;
  vy: number;
  rx: number;
  ry: number;
  age: number;
  life: number;
  size: number;
  seed: number;
  /** 0 = flame, 1 = soot/smoke */
  kind: 0 | 1;
}

export interface SimStats {
  particles: number;
  vitality: number;
  fps: number;
}

/** Colour ramp for flame particles: heat 0 (old/cool) -> 1 (young/hot). */
function flameColor(heat: number, p: { blueMix: number; bright: number; cool: boolean; methanol: boolean }): RGB {
  let stops: RGB[];
  if (p.cool) {
    stops = [[40, 30, 90], [110, 110, 230], [170, 190, 255]];
  } else if (p.methanol) {
    stops = [[120, 50, 20], [70, 110, 255], [170, 210, 255]];
  } else {
    stops = [[170, 25, 5], [255, 130, 25], [255, 235, 170]];
  }
  const h = clamp(heat * (0.85 + 0.3 * p.bright), 0, 1);
  const c = h < 0.5 ? mixRGB(stops[0], stops[1], h / 0.5) : mixRGB(stops[1], stops[2], (h - 0.5) / 0.5);
  if (p.blueMix > 0 && !p.cool && !p.methanol) {
    return mixRGB(c, [90, 140, 255], p.blueMix * 0.75 * (0.4 + 0.6 * h));
  }
  return c;
}

export class FlameSim {
  private particles: Particle[] = [];
  private vitality = 1;
  private time = 0;
  private spawnCarry = 0;
  private sprites: HTMLCanvasElement[] = [];
  private spriteKey = "";
  private fpsAcc = 0;
  private fpsFrames = 0;
  fps = 60;

  ignite() {
    this.vitality = 1;
  }

  get stats(): SimStats {
    return { particles: this.particles.length, vitality: this.vitality, fps: this.fps };
  }

  private buildSprites(key: string, opts: { blueMix: number; bright: number; cool: boolean; methanol: boolean }) {
    if (typeof document === "undefined") return;
    this.sprites = [];
    for (let i = 0; i < SPRITE_BUCKETS; i++) {
      const heat = i / (SPRITE_BUCKETS - 1);
      const [r, g, b] = flameColor(heat, opts).map(Math.round);
      const c = document.createElement("canvas");
      c.width = c.height = SPRITE_SIZE;
      const ctx = c.getContext("2d")!;
      const grad = ctx.createRadialGradient(SPRITE_SIZE / 2, SPRITE_SIZE / 2, 0, SPRITE_SIZE / 2, SPRITE_SIZE / 2, SPRITE_SIZE / 2);
      grad.addColorStop(0, `rgba(${r},${g},${b},1)`);
      grad.addColorStop(0.35, `rgba(${r},${g},${b},0.55)`);
      grad.addColorStop(1, `rgba(${r},${g},${b},0)`);
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, SPRITE_SIZE, SPRITE_SIZE);
      this.sprites.push(c);
    }
    this.spriteKey = key;
  }

  /** Where the fuel sits on the canvas for the given conditions. */
  private anchor(p: FlameParams, phys: FlamePhysics) {
    const buoy = clamp(phys.uBuoyant / 20, 0, 1);
    let sx = CANVAS_W / 2;
    let sy = lerp(CANVAS_H * 0.5, CANVAS_H * 0.78, buoy);
    const shift = clamp(p.flow_velocity_cm_s * VEL_PX_PER_CM_S * 0.45, 0, 150);
    if (p.flowDirection === "right") sx -= shift;
    else if (p.flowDirection === "left") sx += shift;
    else if (p.flowDirection === "up") sy += Math.min(shift, 80);
    else sy -= Math.min(shift, 80);
    return { sx, sy };
  }

  private spawn(p: FlameParams, phys: FlamePhysics, sx: number, sy: number, intensity: number, dt: number) {
    const bu = phys.uBuoyant * VEL_PX_PER_CM_S;
    const bf = clamp(bu / 110, 0, 1);
    const sz = phys.sizeFactor;
    const cool = phys.regime === "Cool Flame";

    this.spawnCarry += 750 * intensity * dt * (cool ? 0.7 : 1) * (0.7 + 0.3 * sz);
    let n = Math.floor(this.spawnCarry);
    this.spawnCarry -= n;
    n = Math.min(n, MAX_PARTICLES - this.particles.length);

    const vd = 26 * sz * (1 - 0.75 * bf) * (cool ? 1.1 : 1);
    for (let i = 0; i < n; i++) {
      const th = Math.random() * Math.PI * 2;
      let nx = Math.cos(th);
      let ny = Math.sin(th);
      let px = sx;
      let py = sy;

      switch (p.geometry) {
        case "Droplet": {
          const r0 = 11 * (0.7 + 0.3 * sz);
          if (ny > 0 && Math.random() < bf) ny = -ny;
          px += nx * r0;
          py += ny * r0;
          break;
        }
        case "Gaseous": {
          if (ny > 0 && Math.random() < bf) ny = -ny;
          px += (Math.random() - 0.5) * 8 + nx * 4;
          py += ny * 5 - 6;
          break;
        }
        case "Rod": {
          const side = Math.random() < 0.5 ? -1 : 1;
          nx = side * (0.8 + 0.4 * Math.random());
          ny = (Math.random() - 0.5) * 0.4;
          px += side * 6;
          py -= Math.random() * 80;
          break;
        }
        case "Flat Sheet": {
          const u = Math.random() - 0.5;
          px += u * 160;
          py -= 4;
          nx = u * 1.2;
          ny = -1;
          break;
        }
      }

      const life = (1.7 - 0.95 * bf) * (0.8 + 0.4 * Math.random()) * Math.pow(sz, 0.5) * (cool ? 1.3 : 1);
      this.particles.push({
        x: px,
        y: py,
        x0: px,
        vx: 0,
        vy: 0,
        rx: nx * vd * (0.6 + 0.6 * Math.random()),
        ry: ny * vd * (0.6 + 0.6 * Math.random()),
        age: 0,
        life,
        size: (13 + 12 * Math.random()) * sz * (cool ? 1.2 : 1),
        seed: Math.random() * 6.28,
        kind: 0,
      });
    }
  }

  update(dtIn: number, p: FlameParams, phys: FlamePhysics, speed: number) {
    const dt = clamp(dtIn, 0, 0.05) * speed;
    this.fpsAcc += dtIn;
    this.fpsFrames++;
    if (this.fpsAcc >= 0.5) {
      this.fps = this.fpsFrames / this.fpsAcc;
      this.fpsAcc = 0;
      this.fpsFrames = 0;
    }
    if (dt <= 0) return;
    this.time += dt;

    // --- vitality: does the flame survive in these conditions?
    if (phys.regime === "Sustained Burn" || phys.regime === "Cool Flame") {
      this.vitality += (1 - this.vitality) * Math.min(1, dt * 2);
    } else if (phys.regime === "Self-Extinguished") {
      this.vitality = Math.max(0, this.vitality - dt / 4.5);
    } else {
      this.vitality = Math.max(0, this.vitality - dt / 0.8);
    }

    const flicker = 1 + 0.12 * Math.sin(this.time * 17) * Math.sin(this.time * 5.3 + 1.3);
    const intensity = phys.baseIntensity * this.vitality * flicker;
    const { sx, sy } = this.anchor(p, phys);

    if (intensity > 0.02) this.spawn(p, phys, sx, sy, intensity, dt);

    const bu = phys.uBuoyant * VEL_PX_PER_CM_S;
    const bf = clamp(bu / 110, 0, 1);
    const fv = Math.min(p.flow_velocity_cm_s * VEL_PX_PER_CM_S, 600);
    const fdx = p.flowDirection === "right" ? 1 : p.flowDirection === "left" ? -1 : 0;
    const fdy = p.flowDirection === "down" ? 1 : p.flowDirection === "up" ? -1 : 0;
    const flowVx = fdx * fv;
    const flowVy = fdy * fv;
    const sooty = (SOOTINESS[p.fuel_material] ?? 0.3) * (0.4 + 0.6 * bf);
    const cool = phys.regime === "Cool Flame";

    const alive: Particle[] = [];
    for (const q of this.particles) {
      q.age += dt;
      if (q.age >= q.life) {
        // flame particles occasionally leave soot behind (mostly in gravity)
        if (q.kind === 0 && !cool && Math.random() < sooty * 0.12 && this.particles.length < MAX_PARTICLES) {
          alive.push({ ...q, kind: 1, age: 0, life: 1.8 + Math.random(), size: q.size * 0.9, vx: q.vx, vy: q.vy, rx: q.rx * 0.3, ry: q.ry * 0.3 });
        }
        continue;
      }
      const t = q.age / q.life;

      if (q.kind === 0) {
        const tvy = flowVy - bu * (0.35 + 0.9 * t);
        const k = Math.min(1, 2.4 * dt);
        q.vx += (flowVx * Math.min(1, 0.4 + t) - q.vx) * k;
        q.vy += (tvy - q.vy) * k;
        // teardrop taper toward the centre line when buoyancy dominates
        const targetX = q.x0 + flowVx * q.age * 0.6;
        q.x += (targetX - q.x) * Math.min(1, 1.3 * bf * t * dt * 3);
        // flame sway grows with buoyancy and height
        q.x += Math.sin(this.time * 9 + q.seed + q.y * 0.04) * 14 * bf * t * dt;
      } else {
        const tvy = flowVy - bu * 0.5 - 14;
        const k = Math.min(1, 1.2 * dt);
        q.vx += (flowVx - q.vx) * k;
        q.vy += (tvy - q.vy) * k;
        q.x += Math.sin(this.time * 3 + q.seed) * 10 * dt;
      }
      q.x += (q.vx + q.rx) * dt;
      q.y += (q.vy + q.ry) * dt;
      const decay = Math.exp(-0.6 * dt);
      q.rx *= decay;
      q.ry *= decay;
      alive.push(q);
    }
    this.particles = alive;
  }

  draw(ctx: CanvasRenderingContext2D, p: FlameParams, phys: FlamePhysics) {
    const W = CANVAS_W;
    const H = CANVAS_H;
    const methanol = p.fuel_material === "Methanol";
    const cool = phys.regime === "Cool Flame";
    const bf = clamp((phys.uBuoyant * VEL_PX_PER_CM_S) / 110, 0, 1);
    const sootFuel = (SOOTINESS[p.fuel_material] ?? 0.3) > 0.3;
    const blueMix = Math.round((1 - bf) * (sootFuel ? 0.25 : 0.55) * 10) / 10;
    const bright = Math.round(clamp((p.oxygen_pct - 21) / 25, -0.4, 0.8) * 10) / 10;
    const key = `${methanol}|${cool}|${blueMix}|${bright}`;
    if (key !== this.spriteKey) this.buildSprites(key, { blueMix, bright, cool, methanol });

    // background
    ctx.globalCompositeOperation = "source-over";
    ctx.globalAlpha = 1;
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, W, H);

    const { sx, sy } = this.anchor(p, phys);
    const intensity = phys.baseIntensity * this.vitality;

    // ambient glow
    if (intensity > 0.03) {
      const gr = 150 * phys.sizeFactor + 60;
      const gy = lerp(sy, sy - 60, bf);
      const g = ctx.createRadialGradient(sx, gy, 0, sx, gy, gr);
      const c = cool ? "110,120,255" : methanol ? "90,130,255" : "255,120,30";
      g.addColorStop(0, `rgba(${c},${0.18 * Math.min(intensity, 1.2)})`);
      g.addColorStop(1, `rgba(${c},0)`);
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);
    }

    this.drawFlowStreaks(ctx, p);
    this.drawFuel(ctx, p, sx, sy);

    // smoke first (normal blend), then flame (additive)
    ctx.globalCompositeOperation = "source-over";
    for (const q of this.particles) {
      if (q.kind !== 1) continue;
      const t = q.age / q.life;
      const r = q.size * (0.8 + 0.9 * t);
      ctx.globalAlpha = 0.07 * Math.sin(Math.PI * Math.min(1, t * 1.2)) * (0.5 + 0.5 * (1 - t));
      ctx.fillStyle = "#6b6b70";
      ctx.beginPath();
      ctx.arc(q.x, q.y, r, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.globalCompositeOperation = "lighter";
    const sprites = this.sprites;
    if (sprites.length) {
      for (const q of this.particles) {
        if (q.kind !== 0) continue;
        const t = q.age / q.life;
        const heat = clamp(1 - t * 0.9, 0, 1);
        const sprite = sprites[Math.round(heat * (SPRITE_BUCKETS - 1))];
        const r = q.size * (0.45 + 0.55 * (1 - t * t));
        ctx.globalAlpha = clamp(0.2 * Math.pow(1 - t, 0.7) * Math.min(1, q.age * 14), 0, 1) * (cool ? 0.55 : 1);
        ctx.drawImage(sprite, q.x - r, q.y - r, r * 2, r * 2);
      }
    }
    ctx.globalCompositeOperation = "source-over";
    ctx.globalAlpha = 1;

    this.drawHud(ctx, p, phys);
  }

  private drawFlowStreaks(ctx: CanvasRenderingContext2D, p: FlameParams) {
    if (p.flow_velocity_cm_s <= 0.01) return;
    const fdx = p.flowDirection === "right" ? 1 : p.flowDirection === "left" ? -1 : 0;
    const fdy = p.flowDirection === "down" ? 1 : p.flowDirection === "up" ? -1 : 0;
    const speed = Math.min(p.flow_velocity_cm_s * VEL_PX_PER_CM_S, 600);
    const len = clamp(speed * 0.12, 6, 60);
    ctx.save();
    ctx.strokeStyle = "rgba(161,161,170,0.18)";
    ctx.lineWidth = 1;
    const n = 14;
    for (let i = 0; i < n; i++) {
      const ph = (this.time * speed * 0.35 + i * 97.3) % (fdx !== 0 ? CANVAS_W : CANVAS_H);
      let x: number;
      let y: number;
      if (fdx !== 0) {
        x = fdx > 0 ? ph : CANVAS_W - ph;
        y = ((i * 71.7) % (CANVAS_H - 60)) + 30;
      } else {
        y = fdy > 0 ? ph : CANVAS_H - ph;
        x = ((i * 83.1) % (CANVAS_W - 60)) + 30;
      }
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + fdx * len, y + fdy * len);
      ctx.stroke();
    }
    ctx.restore();
  }

  private drawFuel(ctx: CanvasRenderingContext2D, p: FlameParams, sx: number, sy: number) {
    ctx.save();
    ctx.globalCompositeOperation = "source-over";
    ctx.globalAlpha = 1;
    ctx.strokeStyle = "#52525b";
    ctx.fillStyle = "#18181b";
    ctx.lineWidth = 1.5;
    switch (p.geometry) {
      case "Droplet": {
        // suspension fibres
        ctx.beginPath();
        ctx.moveTo(sx - 60, sy - 40);
        ctx.lineTo(sx + 60, sy + 40);
        ctx.moveTo(sx + 60, sy - 40);
        ctx.lineTo(sx - 60, sy + 40);
        ctx.strokeStyle = "#27272a";
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(sx, sy, 9, 0, Math.PI * 2);
        ctx.fillStyle = "#27272a";
        ctx.strokeStyle = "#a1a1aa";
        ctx.fill();
        ctx.stroke();
        break;
      }
      case "Gaseous": {
        ctx.fillRect(sx - 6, sy - 2, 12, 18);
        ctx.strokeRect(sx - 6, sy - 2, 12, 18);
        break;
      }
      case "Rod": {
        ctx.fillStyle = "#27272a";
        ctx.fillRect(sx - 5, sy - 80, 10, 90);
        ctx.strokeRect(sx - 5, sy - 80, 10, 90);
        break;
      }
      case "Flat Sheet": {
        ctx.fillStyle = "#27272a";
        ctx.fillRect(sx - 80, sy - 3, 160, 7);
        ctx.strokeRect(sx - 80, sy - 3, 160, 7);
        break;
      }
    }
    ctx.restore();
  }

  private drawHud(ctx: CanvasRenderingContext2D, p: FlameParams, phys: FlamePhysics) {
    ctx.save();
    ctx.font = "11px monospace";
    ctx.fillStyle = "#a1a1aa";
    ctx.fillText(phys.regime.toUpperCase(), 14, 22);
    ctx.fillStyle = "#71717a";
    ctx.fillText(`~${Math.round(phys.tempK)} K`, 14, 38);

    // gravity vector
    const gx = CANVAS_W - 40;
    const gy = 40;
    ctx.strokeStyle = "#71717a";
    ctx.fillStyle = "#71717a";
    ctx.lineWidth = 1.2;
    const gl = clamp(Math.sqrt(p.gravity_g) * 28, 0, 40);
    ctx.textAlign = "center";
    ctx.fillText(`g = ${p.gravity_g.toFixed(2)}`, gx, 18);
    if (gl > 3) {
      ctx.beginPath();
      ctx.moveTo(gx, gy);
      ctx.lineTo(gx, gy + gl);
      ctx.moveTo(gx - 4, gy + gl - 6);
      ctx.lineTo(gx, gy + gl);
      ctx.lineTo(gx + 4, gy + gl - 6);
      ctx.stroke();
    } else {
      ctx.beginPath();
      ctx.arc(gx, gy + 6, 3, 0, Math.PI * 2);
      ctx.stroke();
    }

    if (this.vitality < 0.04 && phys.baseIntensity > 0 && phys.regime !== "Sustained Burn" && phys.regime !== "Cool Flame") {
      ctx.fillStyle = "#a1a1aa";
      ctx.font = "13px monospace";
      ctx.fillText(
        phys.regime === "No Ignition" ? "NO IGNITION — raise O₂ or lower diluent effect" : "FLAME EXTINGUISHED — press Ignite",
        CANVAS_W / 2,
        CANVAS_H - 20,
      );
    }
    ctx.restore();
  }
}
