// shared GLSL + JS for volume ray-marching.
// ψ(r,θ,φ,t) = jₗ(kr) · Yₗᵐ(θ,φ) · Φ(t),  k = α_{ℓ,n} ⇒ j_ℓ(k) = 0.

// α_{ℓ,n} : n-th positive zero of j_ℓ    (ℓ=0..5, n=1..3)
export const ALPHA = [
  [Math.PI,      2*Math.PI,   3*Math.PI],
  [4.493409458,  7.725251837,10.904121659],
  [5.763459197,  9.095011330,12.322940971],
  [6.987932001, 10.417118550,13.698023153],
  [8.182561453, 11.704907155,15.039664710],
  [9.355812112, 12.966530172,16.354710328],
]

// vertex: world-space backface of a box enclosing the sphere
export const VS = `
varying vec3 vW;
void main(){
  vW = (modelMatrix * vec4(position, 1.)).xyz;
  gl_Position = projectionMatrix * viewMatrix * vec4(vW, 1.);
}`

// fragment prelude: spherical Bessel, Yₗᵐ, ray-sphere.
// cameraPosition, viewMatrix, etc. auto-injected by three.js.
export const FS_PRELUDE = `
precision highp float;
varying vec3 vW;
uniform float t, w, k, gain;
uniform int   L, M;
uniform int   STEPS;

// j_ℓ(x) by upward recurrence ; ℓ ≤ 5.
float jL(int L, float x){
  if(x < 1e-4) return L == 0 ? 1.0 : 0.0;
  float s = sin(x), c = cos(x);
  float j0 = s / x;
  if(L == 0) return j0;
  float j1 = (s - x*c) / (x*x);
  if(L == 1) return j1;
  float jm = j0, j = j1, jp = 0.0;
  for(int n = 1; n < 6; n++){
    if(n >= L) return j;
    jp = float(2*n + 1) / x * j - jm;
    jm = j; j = jp;
  }
  return j;
}

// Real Yₗᵐ(n̂) , ℓ ≤ 5.
float Y(int l, int m, vec3 n){
  float x=n.x, y=n.y, z=n.z;
  float xx=x*x, yy=y*y, zz=z*z;
  if(l==0) return 0.2820947917;
  if(l==1){
    if(m==-1) return 0.4886025119*y;
    if(m== 0) return 0.4886025119*z;
    if(m== 1) return 0.4886025119*x;
  }
  if(l==2){
    if(m==-2) return 1.0925484306*x*y;
    if(m==-1) return 1.0925484306*y*z;
    if(m== 0) return 0.3153915653*(3.*zz-1.);
    if(m== 1) return 1.0925484306*x*z;
    if(m== 2) return 0.5462742153*(xx-yy);
  }
  if(l==3){
    if(m==-3) return 0.5900435899*y*(3.*xx-yy);
    if(m==-2) return 2.8906114426*x*y*z;
    if(m==-1) return 0.4570457995*y*(5.*zz-1.);
    if(m== 0) return 0.3731763326*z*(5.*zz-3.);
    if(m== 1) return 0.4570457995*x*(5.*zz-1.);
    if(m== 2) return 1.4453057213*z*(xx-yy);
    if(m== 3) return 0.5900435899*x*(xx-3.*yy);
  }
  if(l==4){
    if(m==-4) return 2.5033429417*x*y*(xx-yy);
    if(m==-3) return 1.7701307697*y*z*(3.*xx-yy);
    if(m==-2) return 0.9461746957*x*y*(7.*zz-1.);
    if(m==-1) return 0.6690465436*y*z*(7.*zz-3.);
    if(m== 0) return 0.1057855469*(35.*zz*zz-30.*zz+3.);
    if(m== 1) return 0.6690465436*x*z*(7.*zz-3.);
    if(m== 2) return 0.4730873479*(xx-yy)*(7.*zz-1.);
    if(m== 3) return 1.7701307697*x*z*(xx-3.*yy);
    if(m== 4) return 0.6258357354*(xx*(xx-3.*yy) - yy*(3.*xx-yy));
  }
  if(l==5){
    float z3=zz*z, z4=zz*zz;
    if(m==-5) return 0.6563820568*y*(5.*xx*xx - 10.*xx*yy + yy*yy);
    if(m==-4) return 8.3026492595*x*y*(xx-yy)*z;
    if(m==-3) return 0.4892382995*y*(3.*xx-yy)*(9.*zz-1.);
    if(m==-2) return 4.7935367849*x*y*z*(3.*zz-1.);
    if(m==-1) return 0.4529466512*y*(21.*z4 - 14.*zz + 1.);
    if(m== 0) return 0.1169503225*z*(63.*z4 - 70.*zz + 15.);
    if(m== 1) return 0.4529466512*x*(21.*z4 - 14.*zz + 1.);
    if(m== 2) return 2.3967683924*(xx-yy)*z*(3.*zz-1.);
    if(m== 3) return 0.4892382995*x*(xx-3.*yy)*(9.*zz-1.);
    if(m== 4) return 2.0756623149*(xx*(xx-3.*yy) - yy*(3.*xx-yy))*z;
    if(m== 5) return 0.6563820568*x*(xx*xx - 10.*xx*yy + 5.*yy*yy);
  }
  return 0.;
}

vec2 hitS(vec3 o, vec3 d){
  float b = dot(o, d);
  float c = dot(o, o) - 1.0;
  float disc = b*b - c;
  if(disc < 0.0) return vec2(1.0, -1.0);
  float q = sqrt(disc);
  return vec2(-b - q, -b + q);
}
`

// emission march skeleton ; {PSI} is a user-supplied snippet returning float psi
// given in-scope vec3 p (world pos inside sphere). {EXTRA} is additional uniforms/fns.
export const FS_MARCH = (EXTRA, PSI) => `
${EXTRA}

void main(){
  vec3 ro = cameraPosition;
  vec3 rd = normalize(vW - cameraPosition);
  vec2 _hh = hitS(ro, rd);
  if(_hh.y <= max(_hh.x, 0.0)) discard;
  float _t0 = max(_hh.x, 0.0), _t1 = _hh.y;
  float _dt = (_t1 - _t0) / float(STEPS);

  vec3  acc = vec3(0.0);
  for(int i = 0; i < 256; i++){
    if(i >= STEPS) break;
    vec3 p = ro + rd * (_t0 + (float(i) + 0.5) * _dt);
    float psi = 0.0;
    { ${PSI} }
    float Ii = psi*psi * gain * _dt;
    float sg = sign(psi);
    vec3 cp = vec3(0.25, 0.75, 1.00);
    vec3 cm = vec3(1.00, 0.35, 0.45);
    acc += (sg >= 0. ? cp : cm) * Ii;
  }
  vec3 cc = 1.0 - exp(-acc);
  cc += 0.015;
  gl_FragColor = vec4(cc, 1.0);
}
`

// JS mirrors (for particle sim etc.)

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
