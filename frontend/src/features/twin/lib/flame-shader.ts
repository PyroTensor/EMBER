// WebGL2 GLSL for the volumetric raymarched flame. Copied verbatim from the `flame` branch (frontend/src/lib/flame-sim.ts).

export const VERT_SRC = `#version 300 es
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

export const FRAG_SRC = `#version 300 es
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

