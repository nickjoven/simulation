// Synth engine. One signal — N phases θ_k(t) on S¹ — flowing through
// four modules:
//
//   VCO  → ω-distribution generator: each oscillator gets a natural rate.
//   COUPLE → Kuramoto kick: dθ_k/dt = ω_k + K · r · sin(ψ − θ_k).
//   TWIST  → Klein BC selector: keeps only oscillators whose nearest
//            Farey-tongue denominator q_k is in the allowed sector.
//   ORDER  → weighted order parameter R · e^{iΨ} = Σ w_k e^{iθ_k} / Σ w_k.
//
// The same signal is observable at three points (after VCO, after
// COUPLE, after TWIST) plus the final (R, Ψ) at ORDER. Each module
// owns its scope; the engine just owns state.

const TAU = 2 * Math.PI

// gcd for Farey membership
function gcd(a, b){ a = Math.abs(a); b = Math.abs(b); while(b){ [a, b] = [b, a%b] } return a }

export function fareyList(Q){
  const out = []
  for(let q = 1; q <= Q; q++){
    for(let p = 0; p <= q; p++){
      if(gcd(p, q) === 1) out.push([p, q])
    }
  }
  out.sort((a, b) => a[0]*b[1] - b[0]*a[1])
  return out
}

// nearest Farey p/q to a real x in [0, 1] at depth Q; returns q.
function nearestQ(x, F){
  let bestQ = 1, bestD = Infinity
  for(const [p, q] of F){
    const d = Math.abs(p/q - x)
    if(d < bestD){ bestD = d; bestQ = q }
  }
  return bestQ
}

// Lorentzian (Cauchy) sample with zero mean and HWHM γ.
function lorentzian(γ){
  return γ * Math.tan(Math.PI * (Math.random() - 0.5))
}

// Pick a random Farey fraction p/q at depth Q with weight ∝ 1/q² and
// add small Gaussian jitter so each oscillator gets a unique ω near
// its assigned tongue centre.
function fareyDraw(Q, jitter, F){
  const ws = F.map(([, q]) => 1 / (q*q))
  const total = ws.reduce((a, b) => a + b, 0)
  let r = Math.random() * total
  for(let i = 0; i < F.length; i++){
    r -= ws[i]
    if(r <= 0){
      const [p, q] = F[i]
      // Box-Muller for Gaussian jitter
      const u1 = Math.random() || 1e-9, u2 = Math.random()
      const g = Math.sqrt(-2*Math.log(u1)) * Math.cos(TAU * u2)
      return p/q + jitter * g
    }
  }
  return 0.5
}

export class Engine {
  constructor(){
    // VCO knobs
    this.dist = 'lorentzian'   // 'lorentzian' | 'uniform' | 'farey'
    this.N    = 80
    this.spread = 0.30          // Lorentzian γ or uniform half-width

    // COUPLE knob
    this.K = 0.5
    this.dt = 0.04

    // TWIST knob
    this.bc = 'periodic'        // 'periodic' | 'mobius' (Z2: q odd) | 'klein' (q ∈ {2,3}) | 'half-mobius' (Z4: q ≡ 1 mod 4)

    // Farey background mesh for q-assignment
    this.fareyDepth = 8
    this.farey = fareyList(this.fareyDepth)

    // state
    this.theta = new Float64Array(0)
    this.omega = new Float64Array(0)
    this.qof   = new Int32Array(0)
    this.R = 0; this.Psi = 0
    this.t = 0

    // diagnostics: short rolling history of R(t)
    this.rHist = new Float32Array(220)
    this.rHistI = 0

    this.reseed()
  }

  reseed(){
    this.theta = new Float64Array(this.N)
    this.omega = new Float64Array(this.N)
    this.qof   = new Int32Array(this.N)
    for(let i = 0; i < this.N; i++){
      this.theta[i] = Math.random() * TAU
      let ω
      if(this.dist === 'lorentzian')      ω = lorentzian(this.spread)
      else if(this.dist === 'uniform')    ω = (Math.random()*2 - 1) * this.spread
      else                                ω = (fareyDraw(this.fareyDepth, this.spread*0.05, this.farey) - 0.5) * 2 * this.spread
      this.omega[i] = ω
      // q from oscillator's "natural rotation rate" mapped to [0,1]
      const x = ((ω / (this.spread*2 + 1e-9)) + 0.5)
      const xC = Math.max(0, Math.min(1, x))
      this.qof[i] = nearestQ(xC, this.farey)
    }
    this.t = 0
    this.rHist.fill(0)
    this.rHistI = 0
  }

  // is oscillator k allowed past the TWIST module?
  twistAllows(k){
    const q = this.qof[k]
    if(this.bc === 'periodic')    return true
    if(this.bc === 'mobius')      return (q % 2) === 1                // Z2 odd-q sector
    if(this.bc === 'klein')       return q === 2 || q === 3           // Klein-bottle (q₂, q₃) only
    if(this.bc === 'half-mobius') return (q % 4) === 1                // Z4 quarter-twist sector
    return true
  }

  step(){
    // mean field over twisted-allowed oscillators (this is the order
    // parameter the COUPLE stage feels — natural with the TWIST gating).
    let cx = 0, cy = 0, n = 0
    for(let i = 0; i < this.N; i++){
      if(!this.twistAllows(i)) continue
      cx += Math.cos(this.theta[i]); cy += Math.sin(this.theta[i]); n++
    }
    if(n > 0){ cx /= n; cy /= n }
    const r = Math.hypot(cx, cy)
    const ψ = Math.atan2(cy, cx)
    this.R = r; this.Psi = ψ

    // history
    this.rHist[this.rHistI] = r
    this.rHistI = (this.rHistI + 1) % this.rHist.length

    // Kuramoto step with the *gated* mean field
    for(let i = 0; i < this.N; i++){
      const dω = this.K * r * Math.sin(ψ - this.theta[i])
      this.theta[i] += (this.omega[i] + dω) * this.dt
      // periodic wrap (the BC affects mode selection at TWIST, not the
      // raw integration — the half-twist as a phase identification is a
      // separate operator; modeled here by sector gating, which is what
      // Klein topology effectively does to the surviving modes).
      let θ = this.theta[i] % TAU
      if(θ < 0) θ += TAU
      this.theta[i] = θ
    }
    this.t += this.dt
  }

  // labels for UI
  liveCount(){
    let n = 0
    for(let i = 0; i < this.N; i++) if(this.twistAllows(i)) n++
    return n
  }
  qHistogram(){
    const h = new Map()
    for(let i = 0; i < this.N; i++){
      if(!this.twistAllows(i)) continue
      const q = this.qof[i]
      h.set(q, (h.get(q) || 0) + 1)
    }
    return [...h.entries()].sort((a, b) => a[0] - b[0])
  }
}
