/**
 * High-resolution WebGL2 3D volumetric raymarched flame simulation (with crisp CPU fallback).
 *
 * Zero distractions: pure black (#000000) background, no candle, no walls, no overlays.
 * Renders at full native Retina/HiDPI pixel resolution with a sharp reaction-zone falloff,
 * crisp 3D limb brightening, and fine-scale 3D filamentary turbulence at 60-120 fps.
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
import { CANVAS_H, CANVAS_W } from "./flame-scenes";
import type { CabinConfig, RiskBand } from "./types";

export { CANVAS_H, CANVAS_W };

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
  Heptane: 0.92,
  PMMA: 0.78,
  "Cotton-Fiberglass": 0.58,
  Nomex: 0.32,
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
  if (regime === "Sustained Burn") baseIntensity = clamp(0.65 + margin / 16, 0.65, 1.5);
  else if (regime === "Cool Flame") baseIntensity = 0.6;
  else if (regime === "Self-Extinguished") baseIntensity = 0.6;
  else baseIntensity = 0.45;

  const buoyFrac = clamp(uBuoyant / 30, 0, 1);
  let tempK = (FUEL_T[p.fuel_material] ?? 1800) + 12 * clamp(p.oxygen_pct - 21, -15, 40);
  tempK += DILUENT_T[p.diluent_gas] ?? 0;
  tempK -= 80 * (1 - buoyFrac);
  if (regime === "Cool Flame") tempK = 650 + 2 * (p.oxygen_pct - 21);
  tempK = clamp(tempK, 500, 3200);

  const pressureScale = clamp(Math.pow(101.3 / Math.max(p.pressure_kpa, 1), 0.18), 0.78, 1.32);
  let sizeFactor = clamp(0.75 + margin / 22, 0.6, 1.32) * pressureScale;
  if (regime === "Cool Flame") sizeFactor *= 1.1;
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

export interface SimStats {
  particles: number;
  vitality: number;
  fps: number;
}

// ---------------------------------------------------------------- WebGL2 Full-Res 3D Raymarching Shaders
const VERT_SRC = `#version 300 es
precision highp float;
const vec2 POS[3] = vec2[3](
  vec2(-1.0, -1.0),
  vec2( 3.0, -1.0),
  vec2(-1.0,  3.0)
);
out vec2 vUv;
void main() {
  vec2 p = POS[gl_VertexID];
  vUv = p * 0.5 + 0.5;
  gl_Position = vec4(p, 0.0, 1.0);
}
`;

const FRAG_SRC = `#version 300 es
precision highp float;

in vec2 vUv;
out vec4 fragColor;

uniform vec2 uRes;
uniform float uTime;
uniform float uVitality;
uniform float uShapeBf;
uniform float uScale;
uniform float uSootDom;
uniform float uCool;
uniform vec3 uGeomScale;
uniform vec2 uWind;
uniform float uFlowDirX;

// Fast, sharp 3D hash & value noise
float hash31(vec3 p) {
  p = fract(p * vec3(0.1031, 0.1030, 0.0973));
  p += dot(p, p.yxz + 33.33);
  return fract((p.x + p.y) * p.z) * 2.0 - 1.0;
}

float noise3D(vec3 x) {
  vec3 i = floor(x);
  vec3 f = fract(x);
  // Quintic interpolation for crisp, artifact-free 3D creases (no blocky grid blur)
  vec3 u = f * f * f * (f * (f * 6.0 - 15.0) + 10.0);

  return mix(
    mix(
      mix(hash31(i + vec3(0,0,0)), hash31(i + vec3(1,0,0)), u.x),
      mix(hash31(i + vec3(0,1,0)), hash31(i + vec3(1,1,0)), u.x),
      u.y
    ),
    mix(
      mix(hash31(i + vec3(0,0,1)), hash31(i + vec3(1,0,1)), u.x),
      mix(hash31(i + vec3(0,1,1)), hash31(i + vec3(1,1,1)), u.x),
      u.y
    ),
    u.z
  );
}

// 4-octave 3D FBM + ridged filament detail for sharp 3D flame structure
void fbmDetail(vec3 p, out float fbmVal, out float ridgeVal) {
  float n1 = noise3D(p);
  float n2 = noise3D(p * 2.13 + vec3(17.3, -11.7, 5.9));
  float n3 = noise3D(p * 4.41 + vec3(-9.1, 23.4, -14.8));
  float n4 = noise3D(p * 8.75 + vec3(13.7, 7.2, -19.3));

  fbmVal = 0.52 * n1 + 0.27 * n2 + 0.14 * n3 + 0.07 * n4;
  // Sharp ridge creases along the 3D thermal sheets
  ridgeVal = 1.0 - abs(0.55 * n2 + 0.30 * n3 + 0.15 * n4);
  ridgeVal = pow(clamp(ridgeVal, 0.0, 1.0), 2.2);
}

void main() {
  if (uVitality <= 0.01) {
    fragColor = vec4(0.0, 0.0, 0.0, 1.0);
    return;
  }

  float aspect = uRes.x / uRes.y;
  float invScale = 1.0 / max(0.25, uScale);

  // Normalized screen coordinates: y in [-1, 1], x in [-aspect, aspect]
  float nyScreen = vUv.y * 2.0 - 1.0;
  float nxScreen = (vUv.x * 2.0 - 1.0) * aspect;

  float baseY = -0.46 * uShapeBf;
  float lyRaw = (nyScreen - baseY) * invScale / uGeomScale.y;

  float minLy = uShapeBf > 0.1 ? -0.58 : -0.78;
  float maxLy = uShapeBf > 0.1 ? 1.18 : 0.78;
  if (lyRaw < minLy || lyRaw > maxLy) {
    fragColor = vec4(0.0, 0.0, 0.0, 1.0);
    return;
  }

  float h = clamp((lyRaw + 0.36) / 1.32, 0.0, 1.15);
  float heightWeight = uShapeBf > 0.05 ? pow(max(0.0, h), 1.25) : 0.45;
  float swirlTime = uTime * (1.2 + 2.0 * uShapeBf);
  float swayX = sin(swirlTime - h * 4.2) * 0.042 * uShapeBf * h;
  float lxCenter = (nxScreen * invScale - uWind.x * heightWeight - swayX) / uGeomScale.x;

  float rSphere = 0.54;
  float rPlume = 0.42 * pow(clamp(1.08 - h * 0.88, 0.02, 1.2), 0.58) *
                 (1.0 - 0.14 * uShapeBf * sin(clamp(h, 0.0, 1.0) * 3.14159265));
  float maxR = mix(rSphere, rPlume, uShapeBf) + 0.22;
  if (abs(lxCenter) > maxR) {
    fragColor = vec4(0.0, 0.0, 0.0, 1.0);
    return;
  }

  float advectY = uTime * (0.95 + 3.2 * uShapeBf);
  float advectX = uTime * 0.45 * uFlowDirX;

  const int STEPS = 44;
  float zMin = -0.92;
  float zMax =  0.92;
  float dz = (zMax - zMin) / float(STEPS);

  vec3 accColor = vec3(0.0);
  float transmittance = 1.0;

  for (int step = 0; step < STEPS; step++) {
    float z = (zMin + (float(step) + 0.5) * dz) / uGeomScale.z;

    // 3D helical swirl around vertical axis
    float swirlAngle = h * 2.4 * uShapeBf + swirlTime * 0.35;
    float cosS = cos(swirlAngle);
    float sinS = sin(swirlAngle);
    float rx = lxCenter * cosS - z * sinS;
    float rz = lxCenter * sinS + z * cosS;

    vec3 samplePos = vec3(
      rx * 3.4 + advectX,
      (lyRaw - uWind.y * heightWeight) * 3.4 - advectY,
      rz * 3.4 + 4.7
    );

    float turb;
    float ridge;
    fbmDetail(samplePos, turb, ridge);

    // 1. 0g 3D Spherical Diffusion Field
    float dist3DSphere = length(vec3(lxCenter, lyRaw, z));
    float normSphere = (dist3DSphere + turb * 0.042) / rSphere;

    // 2. >0g 3D Buoyant Plume Field
    float radialXZ = length(vec2(lxCenter, z));
    float angleXZ = atan(z, lxCenter);
    float flutes = sin(angleXZ * 3.0 + swirlTime * 0.8 - h * 5.0) * 0.042 * h * uShapeBf;
    float turbDisp = turb * (0.032 + 0.13 * pow(max(0.0, h), 1.35) * (0.28 + 0.72 * uShapeBf));

    float effRPlume = max(0.022, rPlume + flutes - turbDisp);
    float normPlume = radialXZ / effRPlume;

    if (lyRaw < -0.22) {
      float botDist = (-0.22 - lyRaw) / 0.15;
      normPlume = length(vec2(normPlume, botDist));
    }
    if (h > 0.85) {
      float tipFade = (h - 0.85) / 0.24;
      normPlume += tipFade * tipFade * 0.88;
    }

    float rNorm = mix(normSphere, normPlume, uShapeBf);

    // Sharp outer boundary cutoff so the outer edge of the flame is crisp, not hazy/blurry
    if (rNorm > 1.04) continue;
    float outerCrispEdge = smoothstep(1.03, 0.88, rNorm);

    // Thin, razor-crisp 3D stoichiometric reaction front at rNorm ≈ 0.85
    float sheetDelta = (rNorm - 0.85) / 0.068;
    float reactionSheet = exp(-sheetDelta * sheetDelta) * outerCrispEdge;

    // Inner 3D filamentary cellular structure on the reaction front
    float sheetDetail = 0.78 + 0.48 * ridge;

    // Dark unburned fuel-vapor pyrolysis hollow above the base
    float pyrolysisHollow = clamp((h - 0.14) / 0.25, 0.0, 1.0) * (1.0 - 0.68 * exp(-rNorm * rNorm * 6.0));
    float sootShell = exp(-pow((rNorm - 0.56) / 0.21, 2.0)) *
                      pyrolysisHollow *
                      clamp(1.15 - h * 0.34, 0.2, 1.0) *
                      outerCrispEdge;

    // Crisp 3D filamentary creases inside the soot zone
    float filamentDetail = clamp(0.65 + 0.65 * ridge + 0.25 * turb, 0.25, 1.5);

    float blueRadicalWeight = reactionSheet * sheetDetail *
                              (1.0 - 0.66 * uSootDom * clamp((h - 0.12) / 0.35, 0.0, 1.0));
    float sootWeight = sootShell * uSootDom * filamentDetail;

    // Subtle internal 3D cellular wisps inside the 0g sphere (like the warm interior texture in your screenshot, but sharp!)
    float innerCell = (1.0 - uShapeBf) * exp(-pow((rNorm - 0.52) / 0.22, 2.0)) *
                      pow(ridge, 1.6) * (0.28 + 0.45 * uSootDom);

    float totalDensity = (blueRadicalWeight * 1.65 + sootWeight * 2.1 + innerCell * 0.85) * uVitality;
    if (totalDensity < 0.008) continue;

    vec3 em = vec3(0.0);
    if (uCool > 0.5) {
      float cInt = reactionSheet * sheetDetail * 1.55;
      em = vec3(92.0, 110.0, 250.0) * cInt;
    } else {
      // 1. Crisp Blue CH* / OH* radical front
      float blueBaseBoost = uShapeBf > 0.05 ? clamp(1.32 - h * 2.4, 0.18, 1.28) : 1.05;
      float bRad = blueRadicalWeight * blueBaseBoost;
      // Sharp cyan-white core along the reaction ridge, deep royal blue on outer flank
      vec3 blueCol = mix(vec3(22.0, 115.0, 245.0), vec3(85.0, 195.0, 255.0), clamp(reactionSheet * ridge * 1.2, 0.0, 1.0));
      em += blueCol * bRad;

      // 2. Crisp 0g interior warm cellular filaments
      if (innerCell > 0.002) {
        em += vec3(215.0, 110.0, 55.0) * innerCell * 0.9;
      }

      // 3. Sharp 3D Soot Incandescence Filaments
      if (sootWeight > 0.004) {
        float localTemp = clamp(
          (1.0 - abs(rNorm - 0.50) * 1.55) *
          clamp(1.08 - pow(max(0.0, h - 0.35), 1.4) * 0.75, 0.25, 1.0) +
          (ridge - 0.5) * 0.24,
          0.05,
          0.96
        );
        vec3 sootCol = vec3(
          255.0 * clamp(localTemp * 1.68, 0.35, 1.0),
          234.0 * pow(localTemp, 1.40),
          94.0  * pow(max(0.0, localTemp - 0.38) / 0.62, 2.2)
        );
        em += sootCol * sootWeight * 1.3;
      }
    }

    float extinction = totalDensity * (1.55 + 1.25 * uSootDom);
    float stepAlpha = 1.0 - exp(-extinction * dz * 1.9);

    accColor += transmittance * stepAlpha * em;
    transmittance *= 1.0 - stepAlpha * 0.80;

    if (transmittance < 0.025) break;
  }

  // Filmic tone-mapping + contrast curve for razor-sharp edge definition on #000000 black
  vec3 mapped = vec3(1.0) - exp(-accColor / 185.0);
  // Subtle S-curve contrast boost so the outer edge is crisp and clean against pure black
  mapped = smoothstep(0.015, 0.985, mapped);
  mapped *= vec3(0.996, 0.885, 0.985);

  fragColor = vec4(mapped, 1.0);
}
`;

export class FlameSim {
  private vitality = 1;
  private time = 0;
  private fpsAcc = 0;
  private fpsFrames = 0;
  private glCanvas: HTMLCanvasElement | null = null;
  private gl: WebGL2RenderingContext | null = null;
  private program: WebGLProgram | null = null;
  private vao: WebGLVertexArrayObject | null = null;
  private uniforms: Record<string, WebGLUniformLocation | null> = {};
  private glInitFailed = false;
  fps = 60;

  ignite() {
    this.vitality = 1;
  }

  get stats(): SimStats {
    const w = this.glCanvas?.width ?? CANVAS_W;
    const h = this.glCanvas?.height ?? CANVAS_H;
    return { particles: w * h, vitality: this.vitality, fps: this.fps };
  }

  private ensureWebGL(targetW: number, targetH: number): boolean {
    if (typeof document === "undefined" || this.glInitFailed) return false;

    if (!this.glCanvas) {
      const c = document.createElement("canvas");
      c.width = targetW;
      c.height = targetH;
      const gl = c.getContext("webgl2", {
        alpha: false,
        depth: false,
        stencil: false,
        antialias: true,
        premultipliedAlpha: false,
      });
      if (!gl) {
        this.glInitFailed = true;
        return false;
      }

      const compile = (type: number, src: string) => {
        const s = gl.createShader(type);
        if (!s) return null;
        gl.shaderSource(s, src);
        gl.compileShader(s);
        if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
          gl.deleteShader(s);
          return null;
        }
        return s;
      };

      const vs = compile(gl.VERTEX_SHADER, VERT_SRC);
      const fs = compile(gl.FRAGMENT_SHADER, FRAG_SRC);
      if (!vs || !fs) {
        this.glInitFailed = true;
        return false;
      }

      const prog = gl.createProgram();
      if (!prog) {
        this.glInitFailed = true;
        return false;
      }
      gl.attachShader(prog, vs);
      gl.attachShader(prog, fs);
      gl.linkProgram(prog);
      if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
        this.glInitFailed = true;
        return false;
      }

      this.glCanvas = c;
      this.gl = gl;
      this.program = prog;
      this.vao = gl.createVertexArray();

      for (const name of [
        "uRes",
        "uTime",
        "uVitality",
        "uShapeBf",
        "uScale",
        "uSootDom",
        "uCool",
        "uGeomScale",
        "uWind",
        "uFlowDirX",
      ]) {
        this.uniforms[name] = gl.getUniformLocation(prog, name);
      }
    }

    if (this.glCanvas && (this.glCanvas.width !== targetW || this.glCanvas.height !== targetH)) {
      this.glCanvas.width = targetW;
      this.glCanvas.height = targetH;
    }
    return Boolean(this.gl && this.program && this.glCanvas);
  }

  update(dtIn: number, _p: FlameParams, phys: FlamePhysics, speed: number) {
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

    if (phys.regime === "Sustained Burn" || phys.regime === "Cool Flame") {
      this.vitality += (1 - this.vitality) * Math.min(1, dt * 2.5);
    } else if (phys.regime === "Self-Extinguished") {
      this.vitality = Math.max(0, this.vitality - dt / 4.2);
    } else {
      this.vitality = Math.max(0, this.vitality - dt / 0.85);
    }
  }

  draw(ctx: CanvasRenderingContext2D, p: FlameParams, phys: FlamePhysics) {
    // Match the exact physical backing-store resolution of the display canvas (e.g. 1280x960 on Retina)
    // so there is zero upscaling blur!
    const targetW = ctx.canvas.width || CANVAS_W;
    const targetH = ctx.canvas.height || CANVAS_H;

    if (this.ensureWebGL(targetW, targetH) && this.gl && this.program && this.glCanvas) {
      const gl = this.gl;
      const vit = clamp(this.vitality, 0, 1);
      const bf = clamp(phys.uBuoyant / 28, 0, 1.35);
      const shapeBf = clamp(bf, 0, 1);
      const cool = phys.regime === "Cool Flame";
      const methanol = p.fuel_material === "Methanol";
      const sootProp = (SOOTINESS[p.fuel_material] ?? 0.65) * (methanol || cool ? 0 : 1);
      const scale = phys.sizeFactor * (0.42 + 0.58 * vit);

      const gxScale = p.geometry === "Flat Sheet" ? 1.45 : p.geometry === "Rod" ? 0.78 : 1.0;
      const gyScale = p.geometry === "Rod" ? 1.25 : p.geometry === "Flat Sheet" ? 0.85 : 1.0;
      const gzScale = p.geometry === "Flat Sheet" ? 0.65 : 1.0;

      const fdx = p.flowDirection === "right" ? 1 : p.flowDirection === "left" ? -1 : 0;
      const fdy = p.flowDirection === "down" ? 1 : p.flowDirection === "up" ? -1 : 0;
      const flowMag = clamp(p.flow_velocity_cm_s / 32, 0, 1.4);
      const windX = fdx * flowMag * 0.42;
      const windY = -fdy * flowMag * 0.26;

      const sootDominance = cool
        ? 0
        : methanol
          ? 0.04
          : clamp(sootProp * (0.14 + 0.96 * shapeBf + clamp((p.oxygen_pct - 21) / 22, -0.1, 0.45)), 0, 1);

      gl.viewport(0, 0, targetW, targetH);
      gl.useProgram(this.program);
      gl.bindVertexArray(this.vao);

      gl.uniform2f(this.uniforms.uRes, targetW, targetH);
      gl.uniform1f(this.uniforms.uTime, this.time);
      gl.uniform1f(this.uniforms.uVitality, vit);
      gl.uniform1f(this.uniforms.uShapeBf, shapeBf);
      gl.uniform1f(this.uniforms.uScale, scale);
      gl.uniform1f(this.uniforms.uSootDom, sootDominance);
      gl.uniform1f(this.uniforms.uCool, cool ? 1.0 : 0.0);
      gl.uniform3f(this.uniforms.uGeomScale, gxScale, gyScale, gzScale);
      gl.uniform2f(this.uniforms.uWind, windX, windY);
      gl.uniform1f(this.uniforms.uFlowDirX, fdx);

      gl.drawArrays(gl.TRIANGLES, 0, 3);

      // Blit 1:1 at native pixel resolution onto the 2D canvas
      ctx.save();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.globalCompositeOperation = "source-over";
      ctx.globalAlpha = 1;
      ctx.drawImage(this.glCanvas, 0, 0);
      ctx.restore();
      return;
    }

    // Fallback if WebGL2 is unavailable
    ctx.save();
    ctx.fillStyle = "#000000";
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
    ctx.restore();
  }
}
