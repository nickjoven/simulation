// shared GLSL + JS for volume ray-marching.
// ψ(r,θ,φ,t) = jₗ(kr) · Yₗᵐ(θ,φ) · Φ(t),  k = α_{ℓ,n} ⇒ j_ℓ(k) = 0.

import * as THREE from 'three'

// α_{ℓ,n} : n-th positive zero of j_ℓ    computed for ℓ ∈ [0, L_MAX], n ∈ [1, N_MAX].
// Upward recurrence of j_ℓ is unstable for x < ℓ, so scan starts at x ≥ ℓ + 0.05.
// First zero of j_ℓ > ℓ always (asymptotic: (n + ℓ/2)π), so nothing is missed.
const L_MAX = 24
const N_MAX = 4
export const ALPHA = (() => {
  const A = []
  for(let L = 0; L <= L_MAX; L++){
    const zeros = []
    const step = 0.01
    const xStart = Math.max(0.01, L + 0.05)
    const xMax = xStart + (N_MAX + 4) * Math.PI
    let x = xStart, prev = _jL_raw(L, x)
    while(zeros.length < N_MAX && x < xMax){
      x += step
      const f = _jL_raw(L, x)
      if(prev * f < 0){
        let lo = x - step, hi = x, flo = prev
        for(let k = 0; k < 60; k++){
          const mid = 0.5 * (lo + hi)
          const fmid = _jL_raw(L, mid)
          if(flo * fmid <= 0){ hi = mid } else { lo = mid; flo = fmid }
        }
        zeros.push(0.5 * (lo + hi))
      }
      prev = f
    }
    A.push(zeros)
  }
  return A
})()

// internal spherical Bessel (hoisted : also used above for ALPHA)
function _jL_raw(L, x){
  if(x < 1e-4) return L === 0 ? 1 : 0
  const s = Math.sin(x), c = Math.cos(x)
  let j0 = s / x
  if(L === 0) return j0
  let j1 = (s - x*c) / (x*x)
  if(L === 1) return j1
  let jm = j0, j = j1, jp
  for(let n = 1; n < L; n++){
    jp = (2*n + 1) / x * j - jm
    jm = j; j = jp
  }
  return j
}

// default volume palette (cyan/pink). Each demo may override uColPos/uColNeg.
export function defaultPalette(){
  return {
    uColPos: { value: new THREE.Vector3(0.25, 0.75, 1.00) },
    uColNeg: { value: new THREE.Vector3(1.00, 0.35, 0.45) },
  }
}

// GLSL ES 3.00  (three.js: glslVersion = THREE.GLSL3)

export const VS = `
out vec3 vW;
void main(){
  vW = (modelMatrix * vec4(position, 1.)).xyz;
  gl_Position = projectionMatrix * viewMatrix * vec4(vW, 1.);
}`

// prelude: sampler3D(vol), ray-sphere, early termination.
// {vol} holds  f(p) = jₗ(kr)·Yₗᵐ(n̂)   signed, single-channel, [-1,1]^3 → [0,1]^3 uvw
export const FS_PRELUDE = `
precision highp float;
precision highp sampler3D;
in vec3 vW;
out vec4 fragColor;

uniform float t, w, gain;
uniform int   STEPS;
uniform vec3  uColPos;   // + lobe colour
uniform vec3  uColNeg;   // − lobe colour

vec2 hitS(vec3 o, vec3 d){
  float b = dot(o, d);
  float c = dot(o, o) - 1.0;
  float disc = b*b - c;
  if(disc < 0.0) return vec2(1.0, -1.0);
  float q = sqrt(disc);
  return vec2(-b - q, -b + q);
}

float V(sampler3D s, vec3 p){ return texture(s, p * 0.5 + 0.5).r; }
`

// emission march with alpha early-termination + blue-noise jitter.
// {EXTRA} adds uniforms/helpers ; {PSI} is a body assigning float psi from in-scope vec3 p.
export const FS_MARCH = (EXTRA, PSI) => `
${EXTRA}

// hash → [0,1)  (Hugo Elias)
float _hash(vec2 p){
  p = 50.0 * fract(p * 0.3183099 + vec2(0.71, 0.113));
  return fract(p.x * p.y * (p.x + p.y));
}

void main(){
  vec3 ro = cameraPosition;
  vec3 rd = normalize(vW - cameraPosition);
  vec2 _hh = hitS(ro, rd);
  if(_hh.y <= max(_hh.x, 0.0)) discard;
  float _t0 = max(_hh.x, 0.0), _t1 = _hh.y;
  float _dt = (_t1 - _t0) / float(STEPS);

  // jitter start by [0, _dt) → temporal AA in one frame, hides under-sampling
  float _j = _hash(gl_FragCoord.xy + vec2(fract(t)*1024.0, 0.0));
  float _ts = _t0 + _j * _dt;

  vec3  acc = vec3(0.0);
  float aIn = 0.0;                    // accumulated intensity (post-gain)
  for(int i = 0; i < 512; i++){
    if(i >= STEPS) break;
    vec3 p = ro + rd * (_ts + float(i) * _dt);
    float psi = 0.0;
    { ${PSI} }
    float Ii = psi*psi * gain * _dt;
    float sg = sign(psi);
    acc += (sg >= 0. ? uColPos : uColNeg) * Ii;
    aIn += Ii;
    if(aIn > 6.0) break;              // α = 1 − exp(−aIn) > 0.997
  }
  vec3 cc = 1.0 - exp(-acc);
  cc += 0.015;
  fragColor = vec4(cc, 1.0);
}
`

// --- JS mirrors -------------------------------------------------------------
// Real spherical harmonic Yₗᵐ(n̂), n̂ = (x, y, z)/|n̂|.
// Orthonormal ; no Condon-Shortley phase (matches earlier hardcoded forms).
//   m > 0 : Y = √2 · K · cos(mφ) · P_ℓᵐ(cosθ)
//   m = 0 : Y = K · P_ℓ⁰
//   m < 0 : Y = √2 · K · sin(|m|φ) · P_ℓ|m|
//   K = √[(2ℓ+1)/(4π) · (ℓ−|m|)! / (ℓ+|m|)!]
//   P_m^m(ct) = (2m−1)!! · (sinθ)^m   (no (−1)^m)
const PI4 = 4 * Math.PI
export function Y(L, M, x, y, z){
  const r = Math.hypot(x, y, z)
  if(r < 1e-12) return 0
  const ct = z / r
  const st = Math.sqrt(Math.max(0, 1 - ct*ct))
  const phi = Math.atan2(y, x)
  const m = Math.abs(M)
  if(m > L) return 0

  // P_m^m = (2m−1)!! · sin^m
  let pmm = 1
  for(let k = 1; k <= m; k++) pmm *= (2*k - 1)
  pmm *= Math.pow(st, m)

  let p
  if(L === m) p = pmm
  else {
    let pmmp1 = (2*m + 1) * ct * pmm
    if(L === m + 1) p = pmmp1
    else {
      let p0 = pmm, p1 = pmmp1, p2
      for(let l = m + 2; l <= L; l++){
        p2 = ((2*l - 1) * ct * p1 - (l + m - 1) * p0) / (l - m)
        p0 = p1; p1 = p2
      }
      p = p1
    }
  }

  // K = √[(2L+1)/(4π) · (L-m)!/(L+m)!]  computed in log space
  let lg = 0
  for(let k = 1; k <= L - m; k++) lg += Math.log(k)
  for(let k = 1; k <= L + m; k++) lg -= Math.log(k)
  const K = Math.sqrt((2*L + 1) / PI4 * Math.exp(lg))

  if(M === 0)  return K * p
  if(M >  0)   return Math.SQRT2 * K * Math.cos(m*phi) * p
  return Math.SQRT2 * K * Math.sin(m*phi) * p
}

export function jL(L, x){ return _jL_raw(L, x) }

// f(p) = jₗ(k|p|)·Yₗᵐ(p̂)   baked into a Data3DTexture ; voxel centre at ((i+0.5)/N)·2−1.
// Size N: trade precision vs memory ; N=64 → 1 MB (float32), ~5 ms bake.
export function bakeMode(L, M, k, N = 64){
  const buf = new Float32Array(N * N * N)
  let i = 0
  for(let z = 0; z < N; z++){
    const zc = ((z + 0.5) / N) * 2 - 1
    for(let y = 0; y < N; y++){
      const yc = ((y + 0.5) / N) * 2 - 1
      for(let x = 0; x < N; x++){
        const xc = ((x + 0.5) / N) * 2 - 1
        const r = Math.hypot(xc, yc, zc)
        let v = 0
        if(r > 1e-5 && r <= 1){
          v = jL(L, k*r) * Y(L, M, xc/r, yc/r, zc/r)
        }
        buf[i++] = v
      }
    }
  }
  const tex = new THREE.Data3DTexture(buf, N, N, N)
  tex.format = THREE.RedFormat
  tex.type = THREE.FloatType
  tex.minFilter = THREE.LinearFilter
  tex.magFilter = THREE.LinearFilter
  tex.wrapR = THREE.ClampToEdgeWrapping
  tex.wrapS = THREE.ClampToEdgeWrapping
  tex.wrapT = THREE.ClampToEdgeWrapping
  tex.needsUpdate = true
  return tex
}

// U(p) = f(p)²  sampled in JS (for particle ∇U)
export function U(L, M, k, x, y, z){
  const r = Math.hypot(x, y, z)
  if(r < 1e-5 || r > 1) return 0
  const v = jL(L, k*r) * Y(L, M, x/r, y/r, z/r)
  return v*v
}

// --- Farey sum ---------------------------------------------------------------
// F_Q : { p/q : 0 ≤ p ≤ q ≤ Q , gcd(p, q) = 1 }    ordered numerically.
// ψ_F(p̂, r) = Σ_{a/b ∈ F_Q}  (K / b²) · Gθ(n̂ · ĉ_{a/b}) · Gr(r − r_eq) · (1 − n_z²)
//   ĉ_{a/b} = (cos θ, sin θ, 0) ,   θ = 2π · a / b
//   Arnold-tongue weight :    w(a/b) = K / b²
// Traps : positive peaks on the equator at Farey angles, widths ∝ 1/b².

function _gcd(a, b){ while(b){ const r = a % b; a = b; b = r } return a }

export function fareyList(Q){
  const out = []
  for(let q = 1; q <= Q; q++){
    for(let p = 0; p <= q; p++){
      if(_gcd(p, q) === 1) out.push([p, q])
    }
  }
  out.sort((a, b) => a[0]*b[1] - b[0]*a[1])
  return out
}

// signed ψ ; all-positive by construction (Gaussian sum).
export function fareyPsi(F, K, sθ, sr, rEq, x, y, z){
  const r = Math.hypot(x, y, z)
  if(r < 1e-5 || r > 1) return 0
  const nx = x/r, ny = y/r, nz = z/r
  const eq = 1 - nz*nz
  const wr = Math.exp(-0.5 * ((r - rEq)/sr) * ((r - rEq)/sr))
  let s = 0
  for(const [p, q] of F){
    const θ = 2 * Math.PI * p / q
    const cx = Math.cos(θ), cy = Math.sin(θ)
    const dotEq = nx*cx + ny*cy
    const g = Math.exp(-0.5 * ((1 - dotEq)/sθ) * ((1 - dotEq)/sθ))
    s += (K / (q*q)) * g
  }
  return s * wr * eq
}

export function fareyUScalar(F, K, sθ, sr, rEq, x, y, z){
  const v = fareyPsi(F, K, sθ, sr, rEq, x, y, z)
  return v*v
}

// bake ψ_F into a Data3DTexture (signed, single channel).
export function bakeFareySum(Q, K, sθ, sr, rEq, N = 64){
  const F = fareyList(Q)
  const buf = new Float32Array(N * N * N)
  let i = 0
  for(let z = 0; z < N; z++){
    const zc = ((z + 0.5) / N) * 2 - 1
    for(let y = 0; y < N; y++){
      const yc = ((y + 0.5) / N) * 2 - 1
      for(let x = 0; x < N; x++){
        const xc = ((x + 0.5) / N) * 2 - 1
        buf[i++] = fareyPsi(F, K, sθ, sr, rEq, xc, yc, zc)
      }
    }
  }
  const tex = new THREE.Data3DTexture(buf, N, N, N)
  tex.format = THREE.RedFormat
  tex.type = THREE.FloatType
  tex.minFilter = THREE.LinearFilter
  tex.magFilter = THREE.LinearFilter
  tex.wrapR = THREE.ClampToEdgeWrapping
  tex.wrapS = THREE.ClampToEdgeWrapping
  tex.wrapT = THREE.ClampToEdgeWrapping
  tex.needsUpdate = true
  return tex
}
