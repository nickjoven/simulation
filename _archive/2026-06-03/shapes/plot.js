// Tiny canvas-2d plotting helpers for the shape catalog.
// All plots use mathematical coordinates; the helper handles px ↔ math.

export function fit(canvas){
  const dpr = Math.min(devicePixelRatio || 1, 2)
  const cssW = canvas.clientWidth || canvas.parentElement.clientWidth
  const cssH = canvas.clientHeight || Math.round(cssW * (canvas.dataset.ratio || 0.62))
  canvas.style.height = cssH + 'px'
  canvas.width  = Math.round(cssW * dpr)
  canvas.height = Math.round(cssH * dpr)
  const ctx = canvas.getContext('2d')
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  return { ctx, w: cssW, h: cssH }
}

// View: math rect [xmin, xmax] × [ymin, ymax] mapped to pixel rect.
export function view(w, h, xmin, xmax, ymin, ymax, pad = 18){
  const pw = w - 2*pad, ph = h - 2*pad
  const sx = pw / (xmax - xmin)
  const sy = ph / (ymax - ymin)
  return {
    x: x => pad + (x - xmin) * sx,
    y: y => h - pad - (y - ymin) * sy,
    sx, sy, xmin, xmax, ymin, ymax, pad, w, h,
  }
}

export function axes(ctx, V, opts = {}){
  const { gridStep = 1, axisColor = '#1a2230', tickColor = '#243040', labelColor = '#456' } = opts
  ctx.save()
  ctx.lineWidth = 1
  // grid
  ctx.strokeStyle = axisColor
  ctx.beginPath()
  for(let x = Math.ceil(V.xmin/gridStep)*gridStep; x <= V.xmax; x += gridStep){
    ctx.moveTo(V.x(x), V.y(V.ymin))
    ctx.lineTo(V.x(x), V.y(V.ymax))
  }
  for(let y = Math.ceil(V.ymin/gridStep)*gridStep; y <= V.ymax; y += gridStep){
    ctx.moveTo(V.x(V.xmin), V.y(y))
    ctx.lineTo(V.x(V.xmax), V.y(y))
  }
  ctx.stroke()
  // x=0, y=0 axes
  ctx.strokeStyle = tickColor
  ctx.beginPath()
  if(V.xmin <= 0 && V.xmax >= 0){
    ctx.moveTo(V.x(0), V.y(V.ymin)); ctx.lineTo(V.x(0), V.y(V.ymax))
  }
  if(V.ymin <= 0 && V.ymax >= 0){
    ctx.moveTo(V.x(V.xmin), V.y(0)); ctx.lineTo(V.x(V.xmax), V.y(0))
  }
  ctx.stroke()
  // labels (corners)
  ctx.fillStyle = labelColor
  ctx.font = '10px ui-monospace,monospace'
  ctx.fillText(V.xmax.toFixed(2), V.w - V.pad - 26, V.h - V.pad - 4)
  ctx.fillText(V.ymax.toFixed(2), V.pad + 3, V.pad + 10)
  ctx.restore()
}

export function plot(ctx, V, f, opts = {}){
  const { color = '#cfe', width = 1.6, samples = 600, dash = null } = opts
  ctx.save()
  ctx.strokeStyle = color
  ctx.lineWidth = width
  if(dash) ctx.setLineDash(dash)
  ctx.beginPath()
  let started = false
  for(let i = 0; i <= samples; i++){
    const t = i/samples
    const x = V.xmin + t*(V.xmax - V.xmin)
    const y = f(x)
    if(!isFinite(y)){ started = false; continue }
    const px = V.x(x), py = V.y(y)
    if(py < -1e4 || py > V.h + 1e4){ started = false; continue }
    if(!started){ ctx.moveTo(px, py); started = true }
    else ctx.lineTo(px, py)
  }
  ctx.stroke()
  ctx.restore()
}

export function dot(ctx, V, x, y, opts = {}){
  const { r = 3, color = '#fc9' } = opts
  ctx.save()
  ctx.fillStyle = color
  ctx.beginPath()
  ctx.arc(V.x(x), V.y(y), r, 0, Math.PI*2)
  ctx.fill()
  ctx.restore()
}

export function label(ctx, V, x, y, text, opts = {}){
  const { color = '#9cf', dx = 6, dy = -6, font = '11px ui-monospace,monospace' } = opts
  ctx.save()
  ctx.fillStyle = color
  ctx.font = font
  ctx.fillText(text, V.x(x) + dx, V.y(y) + dy)
  ctx.restore()
}

export function clear(ctx, w, h){
  ctx.save()
  ctx.fillStyle = '#04070a'
  ctx.fillRect(0, 0, w, h)
  ctx.restore()
}
