// shared GLSL + JS for volume ray-marching.
// ψ(r,θ,φ,t) = jₗ(kr) · Yₗᵐ(θ,φ) · Φ(t),  k = α_{ℓ,n} ⇒ j_ℓ(k) = 0.

import * as THREE from 'three'

// α_{ℓ,n} : n-th positive zero of j_ℓ    (ℓ=0..5, n=1..3)
export const ALPHA = [
  [Math.PI,      2*Math.PI,   3*Math.PI],
  [4.493409458,  7.725251837,10.904121659],
  [5.763459197,  9.095011330,12.322940971],
  [6.987932001, 10.417118550,13.698023153],
  [8.182561453, 11.704907155,15.039664710],
  [9.355812112, 12.966530172,16.354710328],
]

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

const NRM = {
  '0,0':0.2820947917,
  '1,-1':0.4886025119,'1,0':0.4886025119,'1,1':0.4886025119,
  '2,-2':1.0925484306,'2,-1':1.0925484306,'2,0':0.3153915653,'2,1':1.0925484306,'2,2':0.5462742153,
  '3,-3':0.5900435899,'3,-2':2.8906114426,'3,-1':0.4570457995,'3,0':0.3731763326,'3,1':0.4570457995,'3,2':1.4453057213,'3,3':0.5900435899,
  '4,-4':2.5033429417,'4,-3':1.7701307697,'4,-2':0.9461746957,'4,-1':0.6690465436,'4,0':0.1057855469,'4,1':0.6690465436,'4,2':0.4730873479,'4,3':1.7701307697,'4,4':0.6258357354,
  '5,-5':0.6563820568,'5,-4':8.3026492595,'5,-3':0.4892382995,'5,-2':4.7935367849,'5,-1':0.4529466512,'5,0':0.1169503225,'5,1':0.4529466512,'5,2':2.3967683924,'5,3':0.4892382995,'5,4':2.0756623149,'5,5':0.6563820568,
}

export function Y(L, M, x, y, z){
  const xx=x*x, yy=y*y, zz=z*z, k = NRM[`${L},${M}`]
  if(L===0) return k
  if(L===1){ if(M===-1) return k*y; if(M===0) return k*z; if(M===1) return k*x }
  if(L===2){
    if(M===-2) return k*x*y; if(M===-1) return k*y*z; if(M===0) return k*(3*zz-1)
    if(M=== 1) return k*x*z; if(M=== 2) return k*(xx-yy)
  }
  if(L===3){
    if(M===-3) return k*y*(3*xx-yy); if(M===-2) return k*x*y*z
    if(M===-1) return k*y*(5*zz-1);  if(M=== 0) return k*z*(5*zz-3)
    if(M=== 1) return k*x*(5*zz-1);  if(M=== 2) return k*z*(xx-yy)
    if(M=== 3) return k*x*(xx-3*yy)
  }
  if(L===4){
    if(M===-4) return k*x*y*(xx-yy); if(M===-3) return k*y*z*(3*xx-yy)
    if(M===-2) return k*x*y*(7*zz-1);if(M===-1) return k*y*z*(7*zz-3)
    if(M=== 0) return k*(35*zz*zz-30*zz+3); if(M=== 1) return k*x*z*(7*zz-3)
    if(M=== 2) return k*(xx-yy)*(7*zz-1);   if(M=== 3) return k*x*z*(xx-3*yy)
    if(M=== 4) return k*(xx*(xx-3*yy) - yy*(3*xx-yy))
  }
  if(L===5){
    const z4=zz*zz
    if(M===-5) return k*y*(5*xx*xx - 10*xx*yy + yy*yy)
    if(M===-4) return k*x*y*(xx-yy)*z
    if(M===-3) return k*y*(3*xx-yy)*(9*zz-1)
    if(M===-2) return k*x*y*z*(3*zz-1)
    if(M===-1) return k*y*(21*z4 - 14*zz + 1)
    if(M=== 0) return k*z*(63*z4 - 70*zz + 15)
    if(M=== 1) return k*x*(21*z4 - 14*zz + 1)
    if(M=== 2) return k*(xx-yy)*z*(3*zz-1)
    if(M=== 3) return k*x*(xx-3*yy)*(9*zz-1)
    if(M=== 4) return k*(xx*(xx-3*yy) - yy*(3*xx-yy))*z
    if(M=== 5) return k*x*(xx*xx - 10*xx*yy + 5*yy*yy)
  }
  return 0
}

export function jL(L, x){
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
