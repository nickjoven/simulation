// Wire DOM controls to one Engine, run a render loop, paint scopes.

import { Engine } from './engine.js'

const TAU = 2 * Math.PI
const eng = new Engine()

// helpers
const $ = id => document.getElementById(id)
function fitCanvas(c){
  const dpr = Math.min(devicePixelRatio || 1, 2)
  const cw = c.clientWidth || c.width
  const ch = +c.getAttribute('height') || c.height
  c.style.height = ch + 'px'
  c.width  = Math.round(cw * dpr)
  c.height = Math.round(ch * dpr)
  const ctx = c.getContext('2d')
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  return { ctx, w: cw, h: ch }
}

// --- bindings ---------------------------------------------------------
$('dist').addEventListener('change', e => { eng.dist = e.target.value; eng.reseed() })
$('spread').addEventListener('input', e => {
  eng.spread = +e.target.value; $('spreadv').textContent = eng.spread.toFixed(3); eng.reseed()
})
$('Ninp').addEventListener('input', e => {
  eng.N = +e.target.value; $('Nv').textContent = eng.N; eng.reseed()
})
$('K').addEventListener('input', e => {
  eng.K = +e.target.value; $('Kv').textContent = eng.K.toFixed(3)
})
$('bc').addEventListener('change', e => { eng.bc = e.target.value })

let playing = true
$('play').addEventListener('click', () => {
  playing = !playing; $('play').textContent = playing ? '⏸ pause' : '▶ play'
})
$('reseed').addEventListener('click', () => eng.reseed())
$('zero').addEventListener('click', () => { eng.K = 0; $('K').value = 0; $('Kv').textContent = '0.000' })
$('kc').addEventListener('click',   () => { eng.K = .6; $('K').value = .6; $('Kv').textContent = '0.600' })
$('k1').addEventListener('click',   () => { eng.K = 1; $('K').value = 1; $('Kv').textContent = '1.000' })

// --- scopes -----------------------------------------------------------

// scope 1 : ω-distribution as histogram (post-VCO)
function drawScope1(){
  const c = $('scope1'); const { ctx, w, h } = fitCanvas(c)
  ctx.fillStyle = '#02050a'; ctx.fillRect(0, 0, w, h)
  // histogram of ω over symmetric range
  const range = Math.max(eng.spread * 3, 1)
  const bins = 36
  const hist = new Int32Array(bins)
  for(let i = 0; i < eng.N; i++){
    const x = (eng.omega[i] + range) / (2 * range)
    const b = Math.max(0, Math.min(bins - 1, Math.floor(x * bins)))
    hist[b]++
  }
  let max = 1
  for(let b = 0; b < bins; b++) if(hist[b] > max) max = hist[b]
  const bw = w / bins
  for(let b = 0; b < bins; b++){
    const bh = (hist[b] / max) * (h - 14)
    ctx.fillStyle = '#9af'
    ctx.fillRect(b * bw + 0.5, h - bh - 6, bw - 1, bh)
  }
  // axis baseline + zero tick
  ctx.strokeStyle = '#243040'
  ctx.beginPath()
  ctx.moveTo(0, h - 6); ctx.lineTo(w, h - 6)
  const zeroX = w / 2
  ctx.moveTo(zeroX, h - 12); ctx.lineTo(zeroX, h - 4)
  ctx.stroke()
  ctx.fillStyle = '#456'; ctx.font = '9px ui-monospace,monospace'
  ctx.fillText('g(ω)', 4, 10)
  ctx.fillText('ω = 0', zeroX - 16, h - 14)
}

// scope 2 : R(t) trace + raster of phases (post-COUPLE)
function drawScope2(){
  const c = $('scope2'); const { ctx, w, h } = fitCanvas(c)
  ctx.fillStyle = '#02050a'; ctx.fillRect(0, 0, w, h)
  const top = Math.floor(h * 0.55)
  // top: phase raster — each oscillator a vertical tick at angle θ_k
  for(let i = 0; i < eng.N; i++){
    const x = (eng.theta[i] / TAU) * w
    ctx.fillStyle = eng.twistAllows(i) ? '#cfe' : '#2d3a4d'
    ctx.fillRect(x, 4, 1, top - 8)
  }
  // mean phase Ψ as a bar
  const xψ = ((eng.Psi + TAU) % TAU) / TAU * w
  ctx.fillStyle = '#fc9'; ctx.fillRect(xψ - 1, 2, 2, top - 4)
  // bottom: R(t) rolling trace
  ctx.strokeStyle = '#1a2230'
  ctx.beginPath()
  ctx.moveTo(0, top + 2); ctx.lineTo(w, top + 2)
  ctx.moveTo(0, h - 2);   ctx.lineTo(w, h - 2)
  ctx.stroke()
  ctx.strokeStyle = '#fc9'; ctx.lineWidth = 1.4
  ctx.beginPath()
  const N = eng.rHist.length
  for(let i = 0; i < N; i++){
    const idx = (eng.rHistI + i) % N
    const x = (i / (N - 1)) * w
    const y = (top + 4) + (1 - eng.rHist[idx]) * (h - top - 8)
    if(i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y)
  }
  ctx.stroke()
  ctx.fillStyle = '#456'; ctx.font = '9px ui-monospace,monospace'
  ctx.fillText('θ_k(t)', 4, 10)
  ctx.fillText('R(t) ∈ [0, 1]', 4, top + 14)
}

// scope 3 : q-histogram of surviving sector (post-TWIST)
function drawScope3(){
  const c = $('scope3'); const { ctx, w, h } = fitCanvas(c)
  ctx.fillStyle = '#02050a'; ctx.fillRect(0, 0, w, h)
  const Q = eng.fareyDepth
  const colW = w / Q
  // baseline
  ctx.strokeStyle = '#243040'
  ctx.beginPath(); ctx.moveTo(0, h - 14); ctx.lineTo(w, h - 14); ctx.stroke()

  // count per q (1..Q) over the whole population, then split allowed/blocked
  const allowed = new Int32Array(Q + 1)
  const blocked = new Int32Array(Q + 1)
  for(let i = 0; i < eng.N; i++){
    const q = eng.qof[i]
    if(q <= Q){
      if(eng.twistAllows(i)) allowed[q]++; else blocked[q]++
    }
  }
  let max = 1
  for(let q = 1; q <= Q; q++) if(allowed[q] + blocked[q] > max) max = allowed[q] + blocked[q]
  for(let q = 1; q <= Q; q++){
    const x = (q - 1) * colW + 2
    const bw = colW - 4
    const bh = ((allowed[q] + blocked[q]) / max) * (h - 28)
    const ah = (allowed[q] / max) * (h - 28)
    // blocked = grey bottom-up first
    if(blocked[q]){
      ctx.fillStyle = '#1a2230'
      ctx.fillRect(x, h - 14 - bh, bw, bh - ah)
    }
    if(allowed[q]){
      ctx.fillStyle = '#9af'
      ctx.fillRect(x, h - 14 - ah, bw, ah)
    }
    // q-label below
    ctx.fillStyle = '#789'; ctx.font = '9px ui-monospace,monospace'
    ctx.fillText('q=' + q, x, h - 4)
  }
  ctx.fillStyle = '#456'; ctx.font = '9px ui-monospace,monospace'
  ctx.fillText('q-sectors · solid = passed BC, grey = blocked', 4, 10)
}

// scope 4 : the disk — order parameter R · e^{iΨ} as resultant arrow
function drawScope4(){
  const c = $('scope4'); const { ctx, w, h } = fitCanvas(c)
  ctx.fillStyle = '#02050a'; ctx.fillRect(0, 0, w, h)
  const cx = w / 2, cy = h / 2
  const Rd = Math.min(w, h) * 0.42

  // unit circle
  ctx.strokeStyle = '#1a2230'
  ctx.beginPath(); ctx.arc(cx, cy, Rd, 0, TAU); ctx.stroke()
  // R rings
  ctx.strokeStyle = '#0e151c'
  for(const f of [0.25, 0.5, 0.75]){
    ctx.beginPath(); ctx.arc(cx, cy, Rd*f, 0, TAU); ctx.stroke()
  }

  // each oscillator as a small dot on the circle (allowed=blue, blocked=dim)
  for(let i = 0; i < eng.N; i++){
    const ang = eng.theta[i]
    const x = cx + Rd * Math.cos(ang)
    const y = cy + Rd * Math.sin(ang)
    ctx.fillStyle = eng.twistAllows(i) ? '#9cf' : '#243040'
    ctx.beginPath(); ctx.arc(x, y, 2.2, 0, TAU); ctx.fill()
  }

  // resultant arrow
  const tipX = cx + Rd * eng.R * Math.cos(eng.Psi)
  const tipY = cy + Rd * eng.R * Math.sin(eng.Psi)
  ctx.strokeStyle = '#fc9'; ctx.fillStyle = '#fc9'; ctx.lineWidth = 2
  ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(tipX, tipY); ctx.stroke()
  if(eng.R > 0.02){
    const ah = 8
    ctx.beginPath()
    ctx.moveTo(tipX, tipY)
    ctx.lineTo(tipX - ah * Math.cos(eng.Psi - 0.4), tipY - ah * Math.sin(eng.Psi - 0.4))
    ctx.lineTo(tipX - ah * Math.cos(eng.Psi + 0.4), tipY - ah * Math.sin(eng.Psi + 0.4))
    ctx.closePath(); ctx.fill()
  }
  ctx.fillStyle = '#456'; ctx.beginPath(); ctx.arc(cx, cy, 2.5, 0, TAU); ctx.fill()
}

function regimeText(R){
  if(R > 0.97) return 'K = 1 limit · Einstein'
  if(R < 0.05) return 'incoherent'
  return 'partial sync · Schrödinger'
}

// --- render loop ------------------------------------------------------
let last = performance.now()
function loop(now){
  // step the simulation a few times per frame for smoother dynamics
  if(playing){
    const dtFrame = Math.min(now - last, 50)
    const steps = Math.max(1, Math.round(dtFrame / 16))
    for(let s = 0; s < steps; s++) eng.step()
  }
  last = now
  // paint
  drawScope1(); drawScope2(); drawScope3(); drawScope4()
  // readouts
  $('tg').textContent     = eng.t.toFixed(1)
  $('nlive').textContent  = eng.liveCount()
  $('ntot').textContent   = eng.N
  $('R').textContent      = eng.R.toFixed(3)
  $('Psi').textContent    = ((eng.Psi * 180 / Math.PI + 360) % 360).toFixed(1) + '°'
  $('regime').textContent = regimeText(eng.R)
  requestAnimationFrame(loop)
}
addEventListener('resize', () => { /* canvases re-fit on next draw */ })
requestAnimationFrame(loop)
