import { clamp, SOOTINESS, type FlameParams, type FlamePhysics } from "./flame-physics";
import { FRAG_SRC, VERT_SRC } from "./flame-shader";

export interface FlameStats {
  vitality: number;
  fps: number;
}

const UNIFORMS = [
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
] as const;
type UniformName = (typeof UNIFORMS)[number];

/**
 * Renders the WebGL2 volumetric flame on an offscreen canvas sized to the display backing store,
 * then blits it 1:1 onto the display canvas's 2D context.
 */
export class FlameRenderer {
  private readonly ctx: CanvasRenderingContext2D | null;
  private glCanvas: HTMLCanvasElement | null = null;
  private gl: WebGL2RenderingContext | null = null;
  private program: WebGLProgram | null = null;
  private shaders: WebGLShader[] = [];
  private vao: WebGLVertexArrayObject | null = null;
  private uniforms = {} as Record<UniformName, WebGLUniformLocation | null>;
  private vitality = 1;
  private time = 0;
  private fpsAcc = 0;
  private fpsFrames = 0;
  private fps = 60;

  constructor(private readonly canvas: HTMLCanvasElement) {
    this.ctx = canvas.getContext("2d");
  }

  /** Returns false when WebGL2 is unavailable or the shaders fail to compile/link. */
  init(): boolean {
    if (!this.ctx) return false;
    const c = document.createElement("canvas");
    c.width = this.canvas.width;
    c.height = this.canvas.height;
    const gl = c.getContext("webgl2", {
      alpha: false,
      depth: false,
      stencil: false,
      antialias: true,
      premultipliedAlpha: false,
    });
    if (!gl) return false;

    const compile = (type: number, src: string) => {
      const s = gl.createShader(type);
      if (!s) return null;
      gl.shaderSource(s, src);
      gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
        gl.deleteShader(s);
        return null;
      }
      this.shaders.push(s);
      return s;
    };

    const vs = compile(gl.VERTEX_SHADER, VERT_SRC);
    const fs = compile(gl.FRAGMENT_SHADER, FRAG_SRC);
    const prog = vs && fs ? gl.createProgram() : null;
    this.gl = gl;
    if (!vs || !fs || !prog) {
      this.dispose();
      return false;
    }
    gl.attachShader(prog, vs);
    gl.attachShader(prog, fs);
    gl.linkProgram(prog);
    this.program = prog;
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
      this.dispose();
      return false;
    }

    this.glCanvas = c;
    this.vao = gl.createVertexArray();
    for (const name of UNIFORMS) this.uniforms[name] = gl.getUniformLocation(prog, name);
    return true;
  }

  ignite() {
    this.vitality = 1;
  }

  get stats(): FlameStats {
    return { vitality: this.vitality, fps: this.fps };
  }

  update(dtIn: number, physics: FlamePhysics, speed: number) {
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

    if (physics.regime === "Sustained Burn" || physics.regime === "Cool Flame") {
      this.vitality += (1 - this.vitality) * Math.min(1, dt * 2.5);
    } else if (physics.regime === "Self-Extinguished") {
      this.vitality = Math.max(0, this.vitality - dt / 4.2);
    } else {
      this.vitality = Math.max(0, this.vitality - dt / 0.85);
    }
  }

  draw(p: FlameParams, physics: FlamePhysics) {
    const { gl, program, glCanvas, ctx } = this;
    if (!gl || !program || !glCanvas || !ctx) return;

    const w = this.canvas.width;
    const h = this.canvas.height;
    if (glCanvas.width !== w || glCanvas.height !== h) {
      glCanvas.width = w;
      glCanvas.height = h;
    }

    const vit = clamp(this.vitality, 0, 1);
    const shapeBf = clamp(physics.uBuoyant / 28, 0, 1);
    const cool = physics.regime === "Cool Flame";
    const methanol = p.fuel_material === "Methanol";
    const sootProp = (SOOTINESS[p.fuel_material] ?? 0.65) * (methanol || cool ? 0 : 1);
    const scale = physics.sizeFactor * (0.42 + 0.58 * vit);

    const gx = p.geometry === "Flat Sheet" ? 1.45 : p.geometry === "Rod" ? 0.78 : 1.0;
    const gy = p.geometry === "Rod" ? 1.25 : p.geometry === "Flat Sheet" ? 0.85 : 1.0;
    const gz = p.geometry === "Flat Sheet" ? 0.65 : 1.0;

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

    const u = this.uniforms;
    gl.viewport(0, 0, w, h);
    gl.useProgram(program);
    gl.bindVertexArray(this.vao);
    gl.uniform2f(u.uRes, w, h);
    gl.uniform1f(u.uTime, this.time);
    gl.uniform1f(u.uVitality, vit);
    gl.uniform1f(u.uShapeBf, shapeBf);
    gl.uniform1f(u.uScale, scale);
    gl.uniform1f(u.uSootDom, sootDominance);
    gl.uniform1f(u.uCool, cool ? 1.0 : 0.0);
    gl.uniform3f(u.uGeomScale, gx, gy, gz);
    gl.uniform2f(u.uWind, windX, windY);
    gl.uniform1f(u.uFlowDirX, fdx);
    gl.drawArrays(gl.TRIANGLES, 0, 3);

    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalCompositeOperation = "source-over";
    ctx.globalAlpha = 1;
    ctx.drawImage(glCanvas, 0, 0);
    ctx.restore();
  }

  dispose() {
    const gl = this.gl;
    if (gl) {
      if (this.vao) gl.deleteVertexArray(this.vao);
      if (this.program) gl.deleteProgram(this.program);
      for (const s of this.shaders) gl.deleteShader(s);
      gl.getExtension("WEBGL_lose_context")?.loseContext();
    }
    this.gl = null;
    this.program = null;
    this.vao = null;
    this.shaders = [];
    this.glCanvas = null;
  }
}
