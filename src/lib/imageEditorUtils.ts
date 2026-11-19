export interface CropRect {
  /** Normalized 0..1 coordinates relative to transformed canvas */
  x: number
  y: number
  w: number
  h: number
}

export interface ImageAdjustments {
  brightness: number // 0..200 (default 100)
  contrast: number // 0..200 (default 100)
  saturate: number // 0..200 (default 100)
  warmth: number // -100..100 (default 0)
  hue: number // -180..180 (default 0)
  blur: number // 0..20 (default 0)
  vignette: number // 0..100 (default 0)
  opacity: number // 10..100 (default 100)
}

export const DEFAULT_ADJUSTMENTS: ImageAdjustments = {
  brightness: 100,
  contrast: 100,
  saturate: 100,
  warmth: 0,
  hue: 0,
  blur: 0,
  vignette: 0,
  opacity: 100
}

export interface FilterPreset {
  id: string
  label: string
  css: string
}

export const IMAGE_FILTER_PRESETS: FilterPreset[] = [
  { id: 'none', label: 'Original', css: 'none' },
  { id: 'editorial', label: 'Editorial', css: 'contrast(1.08) saturate(0.92) brightness(1.03)' },
  { id: 'vivid', label: 'Vívido', css: 'contrast(1.12) saturate(1.38) brightness(1.02)' },
  { id: 'bw', label: 'Blanco y Negro', css: 'grayscale(1) contrast(1.12)' },
  { id: 'noir', label: 'Noir', css: 'grayscale(1) contrast(1.42) brightness(0.92)' },
  { id: 'warm', label: 'Cálido', css: 'sepia(0.24) saturate(1.18) brightness(1.04)' },
  { id: 'cool', label: 'Frío', css: 'hue-rotate(-14deg) saturate(1.08) contrast(1.05)' },
  { id: 'sepia', label: 'Sepia', css: 'sepia(0.75) contrast(1.05)' },
  { id: 'vintage', label: 'Vintage', css: 'sepia(0.35) contrast(0.92) brightness(1.06) saturate(0.82)' },
  { id: 'cinema', label: 'Cine', css: 'contrast(1.18) saturate(0.88) hue-rotate(-6deg) brightness(0.97)' },
  { id: 'pastel', label: 'Pastel', css: 'brightness(1.1) contrast(0.88) saturate(0.86)' },
  { id: 'dramatic', label: 'Dramático', css: 'contrast(1.32) saturate(1.15) brightness(0.94)' }
]

export interface AspectRatioOption {
  id: string
  label: string
  ratio: number | null // null = free / original
  cssValue: string
}

export const ASPECT_RATIO_OPTIONS: AspectRatioOption[] = [
  { id: 'auto', label: 'Original', ratio: null, cssValue: 'auto' },
  { id: '1/1', label: '1:1', ratio: 1, cssValue: '1 / 1' },
  { id: '16/9', label: '16:9', ratio: 16 / 9, cssValue: '16 / 9' },
  { id: '4/3', label: '4:3', ratio: 4 / 3, cssValue: '4 / 3' },
  { id: '3/2', label: '3:2', ratio: 3 / 2, cssValue: '3 / 2' },
  { id: '4/5', label: '4:5', ratio: 4 / 5, cssValue: '4 / 5' },
  { id: '9/16', label: '9:16', ratio: 9 / 16, cssValue: '9 / 16' },
  { id: '21/9', label: '21:9', ratio: 21 / 9, cssValue: '21 / 9' }
]

export type AnnotationTool = 'pen' | 'highlighter' | 'arrow' | 'rect' | 'circle' | 'text'

export interface ImageAnnotation {
  id: string
  tool: AnnotationTool
  color: string
  size: number // relative stroke width in px at 1000px reference
  points?: Array<{ x: number; y: number }> // normalized 0..1
  x1?: number
  y1?: number
  x2?: number
  y2?: number
  text?: string
}

export type ReplacementBgType = 'transparent' | 'solid' | 'gradient'

export interface ReplacementBg {
  type: ReplacementBgType
  color: string
  gradientEnd?: string
  gradientAngle?: number
}

export interface PhotoEditExportParams {
  img: HTMLImageElement
  rotation: number // 0, 90, 180, 270
  straighten: number // -45..45
  flipH: boolean
  flipV: boolean
  crop: CropRect
  adjustments: ImageAdjustments
  filterPresetId: string
  alphaMask: Uint8ClampedArray | null // same dimensions as maskWidth x maskHeight (original image coords)
  maskWidth: number
  maskHeight: number
  replacementBg: ReplacementBg
  shapeMask: 'none' | 'rounded' | 'circle'
  annotations: ImageAnnotation[]
  maxExportSize?: number
}

export function getFilterPresetCss(presetId?: string | null): string {
  if (!presetId || presetId === 'none') return 'none'
  const found = IMAGE_FILTER_PRESETS.find((f) => f.id === presetId)
  return found ? found.css : 'none'
}

export function buildCssFilter(adjustments: ImageAdjustments, presetId: string): string {
  const parts: string[] = []
  const preset = getFilterPresetCss(presetId)
  if (preset !== 'none') parts.push(preset)

  if (adjustments.brightness !== 100) parts.push(`brightness(${adjustments.brightness}%)`)
  if (adjustments.contrast !== 100) parts.push(`contrast(${adjustments.contrast}%)`)
  if (adjustments.saturate !== 100) parts.push(`saturate(${adjustments.saturate}%)`)
  if (adjustments.warmth > 0) {
    parts.push(`sepia(${(adjustments.warmth / 100) * 0.45})`)
  } else if (adjustments.warmth < 0) {
    parts.push(`hue-rotate(${(adjustments.warmth / 100) * 24}deg)`)
  }
  if (adjustments.hue !== 0) parts.push(`hue-rotate(${adjustments.hue}deg)`)
  if (adjustments.blur > 0) parts.push(`blur(${adjustments.blur}px)`)

  return parts.length > 0 ? parts.join(' ') : 'none'
}

/**
 * Loads an image safely for Canvas pixel manipulation without tainting.
 */
export async function loadEditableImage(src: string): Promise<HTMLImageElement> {
  const tryLoad = (url: string, useCors: boolean) =>
    new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image()
      if (useCors) img.crossOrigin = 'anonymous'
      img.onload = () => resolve(img)
      img.onerror = (e) => reject(e)
      img.src = url
    })

  // Data URLs and Blob URLs never taint canvas
  if (src.startsWith('data:') || src.startsWith('blob:')) {
    return tryLoad(src, false)
  }

  try {
    return await tryLoad(src, true)
  } catch {
    // Fallback: fetch as blob and create local object URL
    const resp = await fetch(src, { mode: 'cors' })
    if (!resp.ok) throw new Error('No se pudo cargar la imagen para editar')
    const blob = await resp.blob()
    const objUrl = URL.createObjectURL(blob)
    try {
      const img = await tryLoad(objUrl, false)
      return img
    } finally {
      // Keep alive slightly until drawn or let GC handle; revoking after load is safe once decoded
      setTimeout(() => URL.revokeObjectURL(objUrl), 60_000)
    }
  }
}

/**
 * Perceptual weighted RGB distance (0..~765)
 */
function colorDistance(r1: number, g1: number, b1: number, r2: number, g2: number, b2: number): number {
  const rMean = (r1 + r2) * 0.5
  const dr = r1 - r2
  const dg = g1 - g2
  const db = b1 - b2
  return Math.sqrt(
    (((512 + rMean) * dr * dr) >> 8) +
      4 * dg * dg +
      (((767 - rMean) * db * db) >> 8)
  )
}

/**
 * Computes a Sobel edge magnitude map (0..255) for edge-protected background segmentation.
 */
function computeEdgeMap(data: Uint8ClampedArray, w: number, h: number): Uint8Array {
  const gray = new Uint8Array(w * h)
  for (let i = 0, p = 0; i < w * h; i++, p += 4) {
    gray[i] = (data[p] * 77 + data[p + 1] * 150 + data[p + 2] * 29) >> 8
  }

  const edges = new Uint8Array(w * h)
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const idx = y * w + x
      const tl = gray[idx - w - 1]
      const tc = gray[idx - w]
      const tr = gray[idx - w + 1]
      const ml = gray[idx - 1]
      const mr = gray[idx + 1]
      const bl = gray[idx + w - 1]
      const bc = gray[idx + w]
      const br = gray[idx + w + 1]

      const gx = -tl + tr - 2 * ml + 2 * mr - bl + br
      const gy = -tl - 2 * tc - tr + bl + 2 * bc + br
      const mag = Math.min(255, Math.sqrt(gx * gx + gy * gy) * 0.35)
      edges[idx] = mag
    }
  }
  return edges
}

/**
 * Smooths an alpha mask with a fast separable box blur to produce anti-aliased feathered edges.
 */
function featherAlphaMask(mask: Uint8ClampedArray, w: number, h: number, radius: number): Uint8ClampedArray {
  if (radius <= 0) return mask
  const r = Math.min(8, Math.max(1, Math.round(radius)))
  const temp = new Uint8ClampedArray(w * h)
  const out = new Uint8ClampedArray(w * h)
  const kernelSize = r * 2 + 1

  // Horizontal pass
  for (let y = 0; y < h; y++) {
    const rowOffset = y * w
    let sum = 0
    for (let k = -r; k <= r; k++) {
      const cx = Math.min(w - 1, Math.max(0, k))
      sum += mask[rowOffset + cx]
    }
    for (let x = 0; x < w; x++) {
      temp[rowOffset + x] = Math.round(sum / kernelSize)
      const prev = Math.max(0, x - r)
      const next = Math.min(w - 1, x + r + 1)
      sum += mask[rowOffset + next] - mask[rowOffset + prev]
    }
  }

  // Vertical pass
  for (let x = 0; x < w; x++) {
    let sum = 0
    for (let k = -r; k <= r; k++) {
      const cy = Math.min(h - 1, Math.max(0, k))
      sum += temp[cy * w + x]
    }
    for (let y = 0; y < h; y++) {
      const val = Math.round(sum / kernelSize)
      // Preserve crisp core interior while softening only boundary transitions
      const orig = mask[y * w + x]
      out[y * w + x] = orig === 255 && val > 220 ? 255 : orig === 0 && val < 35 ? 0 : val
      const prev = Math.max(0, y - r)
      const next = Math.min(h - 1, y + r + 1)
      sum += temp[next * w + x] - temp[prev * w + x]
    }
  }

  return out
}

/**
 * Smart automatic background removal:
 * Samples border pixels, finds dominant background colors, and performs an edge-aware
 * multi-seed flood-fill from all 4 borders with smooth alpha feathering.
 */
export function removeBackgroundAuto(
  imageData: ImageData,
  options: { tolerance: number; feather: number; edgeProtection?: boolean }
): Uint8ClampedArray {
  const { width: w, height: h, data } = imageData
  const total = w * h
  const mask = new Uint8ClampedArray(total)
  mask.fill(255)

  // Map tolerance (1..100) to perceptual RGB distance threshold (18..240)
  const threshold = 16 + options.tolerance * 2.25
  const softBand = Math.max(10, threshold * 0.28)
  const edges = options.edgeProtection !== false ? computeEdgeMap(data, w, h) : null

  // Collect border samples & quantize to find top background color clusters
  const buckets = new Map<number, { r: number; g: number; b: number; count: number }>()
  const sampleBorder = (x: number, y: number) => {
    const p = (y * w + x) * 4
    if (data[p + 3] < 20) return
    const r = data[p]
    const g = data[p + 1]
    const b = data[p + 2]
    const key = ((r >> 4) << 8) | ((g >> 4) << 4) | (b >> 4)
    const entry = buckets.get(key)
    if (entry) {
      entry.r += r
      entry.g += g
      entry.b += b
      entry.count++
    } else {
      buckets.set(key, { r, g, b, count: 1 })
    }
  }

  const stepX = Math.max(1, Math.floor(w / 120))
  const stepY = Math.max(1, Math.floor(h / 120))
  for (let x = 0; x < w; x += stepX) {
    sampleBorder(x, 0)
    sampleBorder(x, h - 1)
  }
  for (let y = 0; y < h; y += stepY) {
    sampleBorder(0, y)
    sampleBorder(w - 1, y)
  }

  const topClusters = Array.from(buckets.values())
    .sort((a, b) => b.count - a.count)
    .slice(0, 5)
    .map((c) => ({
      r: c.r / c.count,
      g: c.g / c.count,
      b: c.b / c.count
    }))

  if (topClusters.length === 0) return mask

  const visited = new Uint8Array(total)
  const queue = new Int32Array(total)
  let qHead = 0
  let qTail = 0

  const minClusterDist = (r: number, g: number, b: number) => {
    let best = 9999
    for (let i = 0; i < topClusters.length; i++) {
      const c = topClusters[i]
      const d = colorDistance(r, g, b, c.r, c.g, c.b)
      if (d < best) best = d
    }
    return best
  }

  const trySeed = (idx: number) => {
    if (visited[idx]) return
    const p = idx * 4
    if (data[p + 3] < 20) {
      visited[idx] = 1
      mask[idx] = 0
      queue[qTail++] = idx
      return
    }
    const dist = minClusterDist(data[p], data[p + 1], data[p + 2])
    if (dist <= threshold * 1.05) {
      visited[idx] = 1
      mask[idx] = 0
      queue[qTail++] = idx
    }
  }

  // Seed all 4 borders
  for (let x = 0; x < w; x++) {
    trySeed(x)
    trySeed((h - 1) * w + x)
  }
  for (let y = 1; y < h - 1; y++) {
    trySeed(y * w)
    trySeed(y * w + (w - 1))
  }

  const neighbors = [-1, 1, -w, w]

  while (qHead < qTail) {
    const curr = queue[qHead++]
    const cx = curr % w
    const cy = (curr - cx) / w
    const cp = curr * 4
    const cr = data[cp]
    const cg = data[cp + 1]
    const cb = data[cp + 2]

    for (let n = 0; n < 4; n++) {
      if (n === 0 && cx === 0) continue
      if (n === 1 && cx === w - 1) continue
      if (n === 2 && cy === 0) continue
      if (n === 3 && cy === h - 1) continue

      const next = curr + neighbors[n]
      if (visited[next]) continue

      const np = next * 4
      const na = data[np + 3]
      if (na < 20) {
        visited[next] = 1
        mask[next] = 0
        queue[qTail++] = next
        continue
      }

      const nr = data[np]
      const ng = data[np + 1]
      const nb = data[np + 2]

      const distToCluster = minClusterDist(nr, ng, nb)
      const distToNeighbor = colorDistance(cr, cg, cb, nr, ng, nb)
      const edgePenalty = edges ? edges[next] * 0.55 : 0

      // Accept pixel if close to background cluster OR smooth gradient continuation
      const effectiveDist = Math.min(distToCluster, distToNeighbor * 1.45 + distToCluster * 0.45) + edgePenalty

      if (effectiveDist <= threshold) {
        visited[next] = 1
        mask[next] = 0
        queue[qTail++] = next
      } else if (effectiveDist <= threshold + softBand) {
        visited[next] = 1
        const alpha = Math.round(((effectiveDist - threshold) / softBand) * 255)
        mask[next] = Math.min(mask[next], alpha)
      }
    }
  }

  return options.feather > 0 ? featherAlphaMask(mask, w, h, options.feather) : mask
}

/**
 * Magic Wand background removal at a specific (x, y) pixel coordinate.
 * Modifies a copy of the existing mask (so multiple clicks accumulate cleanly!).
 */
export function removeBackgroundAtPoint(
  imageData: ImageData,
  existingMask: Uint8ClampedArray | null,
  startX: number,
  startY: number,
  options: { tolerance: number; feather: number; contiguous: boolean }
): Uint8ClampedArray {
  const { width: w, height: h, data } = imageData
  const total = w * h
  const mask = existingMask ? new Uint8ClampedArray(existingMask) : new Uint8ClampedArray(total).fill(255)

  const sx = Math.min(w - 1, Math.max(0, Math.round(startX)))
  const sy = Math.min(h - 1, Math.max(0, Math.round(startY)))
  const sp = (sy * w + sx) * 4
  const sr = data[sp]
  const sg = data[sp + 1]
  const sb = data[sp + 2]

  const threshold = 12 + options.tolerance * 2.35
  const softBand = Math.max(8, threshold * 0.25)

  if (!options.contiguous) {
    // Global color key removal
    for (let i = 0; i < total; i++) {
      if (mask[i] === 0) continue
      const p = i * 4
      const dist = colorDistance(sr, sg, sb, data[p], data[p + 1], data[p + 2])
      if (dist <= threshold) {
        mask[i] = 0
      } else if (dist <= threshold + softBand) {
        const a = Math.round(((dist - threshold) / softBand) * 255)
        mask[i] = Math.min(mask[i], a)
      }
    }
    return options.feather > 0 ? featherAlphaMask(mask, w, h, options.feather) : mask
  }

  // Contiguous BFS flood-fill
  const visited = new Uint8Array(total)
  const queue = new Int32Array(total)
  let qHead = 0
  let qTail = 0
  const startIdx = sy * w + sx
  visited[startIdx] = 1
  mask[startIdx] = 0
  queue[qTail++] = startIdx

  const neighbors = [-1, 1, -w, w]

  while (qHead < qTail) {
    const curr = queue[qHead++]
    const cx = curr % w
    const cy = (curr - cx) / w

    for (let n = 0; n < 4; n++) {
      if (n === 0 && cx === 0) continue
      if (n === 1 && cx === w - 1) continue
      if (n === 2 && cy === 0) continue
      if (n === 3 && cy === h - 1) continue

      const next = curr + neighbors[n]
      if (visited[next]) continue

      const np = next * 4
      const dist = colorDistance(sr, sg, sb, data[np], data[np + 1], data[np + 2])
      if (dist <= threshold) {
        visited[next] = 1
        mask[next] = 0
        queue[qTail++] = next
      } else if (dist <= threshold + softBand) {
        visited[next] = 1
        const a = Math.round(((dist - threshold) / softBand) * 255)
        mask[next] = Math.min(mask[next], a)
      }
    }
  }

  return options.feather > 0 ? featherAlphaMask(mask, w, h, options.feather) : mask
}

/**
 * Paints an erase or restore brush stroke along the segment (x0, y0) -> (x1, y1) on the alpha mask.
 */
export function applyBrushToMask(
  mask: Uint8ClampedArray,
  w: number,
  h: number,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  radius: number,
  softness: number, // 0..1
  mode: 'erase' | 'restore'
): void {
  const dx = x1 - x0
  const dy = y1 - y0
  const dist = Math.hypot(dx, dy)
  const steps = Math.max(1, Math.ceil(dist / Math.max(1, radius * 0.25)))
  const innerR = radius * (1 - softness * 0.8)

  for (let s = 0; s <= steps; s++) {
    const t = s / steps
    const cx = x0 + dx * t
    const cy = y0 + dy * t
    const minX = Math.max(0, Math.floor(cx - radius))
    const maxX = Math.min(w - 1, Math.ceil(cx + radius))
    const minY = Math.max(0, Math.floor(cy - radius))
    const maxY = Math.min(h - 1, Math.ceil(cy + radius))

    for (let y = minY; y <= maxY; y++) {
      for (let x = minX; x <= maxX; x++) {
        const d = Math.hypot(x - cx, y - cy)
        if (d > radius) continue
        const strength =
          d <= innerR ? 1 : Math.max(0, 1 - (d - innerR) / Math.max(0.001, radius - innerR))
        const idx = y * w + x
        if (mode === 'erase') {
          const target = Math.round((1 - strength) * 255)
          if (target < mask[idx]) mask[idx] = target
        } else {
          const target = Math.round(strength * 255)
          if (target > mask[idx]) mask[idx] = target
        }
      }
    }
  }
}

/**
 * Renders vector annotations onto a 2D canvas context.
 */
export function drawAnnotationsOnContext(
  ctx: CanvasRenderingContext2D,
  annotations: ImageAnnotation[],
  width: number,
  height: number
) {
  const scale = Math.max(width, height) / 1000
  ctx.save()
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'

  for (const ann of annotations) {
    ctx.save()
    const lw = Math.max(1.5, ann.size * scale)
    ctx.strokeStyle = ann.color
    ctx.fillStyle = ann.color
    ctx.lineWidth = lw

    if (ann.tool === 'pen' || ann.tool === 'highlighter') {
      if (ann.tool === 'highlighter') {
        ctx.globalAlpha = 0.38
        ctx.lineWidth = lw * 3.2
      }
      const pts = ann.points || []
      if (pts.length > 0) {
        ctx.beginPath()
        ctx.moveTo(pts[0].x * width, pts[0].y * height)
        for (let i = 1; i < pts.length; i++) {
          ctx.lineTo(pts[i].x * width, pts[i].y * height)
        }
        ctx.stroke()
      }
    } else if (ann.tool === 'rect' && ann.x1 != null && ann.y1 != null && ann.x2 != null && ann.y2 != null) {
      const rx = Math.min(ann.x1, ann.x2) * width
      const ry = Math.min(ann.y1, ann.y2) * height
      const rw = Math.abs(ann.x2 - ann.x1) * width
      const rh = Math.abs(ann.y2 - ann.y1) * height
      ctx.strokeRect(rx, ry, rw, rh)
    } else if (ann.tool === 'circle' && ann.x1 != null && ann.y1 != null && ann.x2 != null && ann.y2 != null) {
      const cx = ((ann.x1 + ann.x2) / 2) * width
      const cy = ((ann.y1 + ann.y2) / 2) * height
      const rx = Math.abs((ann.x2 - ann.x1) / 2) * width
      const ry = Math.abs((ann.y2 - ann.y1) / 2) * height
      ctx.beginPath()
      ctx.ellipse(cx, cy, Math.max(1, rx), Math.max(1, ry), 0, 0, Math.PI * 2)
      ctx.stroke()
    } else if (ann.tool === 'arrow' && ann.x1 != null && ann.y1 != null && ann.x2 != null && ann.y2 != null) {
      const sx = ann.x1 * width
      const sy = ann.y1 * height
      const ex = ann.x2 * width
      const ey = ann.y2 * height
      const angle = Math.atan2(ey - sy, ex - sx)
      const headLen = Math.max(12 * scale, lw * 4)

      ctx.beginPath()
      ctx.moveTo(sx, sy)
      ctx.lineTo(ex, ey)
      ctx.stroke()

      ctx.beginPath()
      ctx.moveTo(ex, ey)
      ctx.lineTo(ex - headLen * Math.cos(angle - Math.PI / 6), ey - headLen * Math.sin(angle - Math.PI / 6))
      ctx.lineTo(ex - headLen * Math.cos(angle + Math.PI / 6), ey - headLen * Math.sin(angle + Math.PI / 6))
      ctx.closePath()
      ctx.fill()
    } else if (ann.tool === 'text' && ann.x1 != null && ann.y1 != null && ann.text) {
      const fontSize = Math.max(16, ann.size * 5 * scale)
      ctx.font = `700 ${fontSize}px ui-sans-serif, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`
      ctx.textBaseline = 'top'
      // Subtle contrast halo so text is readable on any photo
      ctx.lineWidth = Math.max(2, fontSize * 0.12)
      ctx.strokeStyle = 'rgba(0,0,0,0.45)'
      ctx.strokeText(ann.text, ann.x1 * width, ann.y1 * height)
      ctx.fillText(ann.text, ann.x1 * width, ann.y1 * height)
    }

    ctx.restore()
  }

  ctx.restore()
}

/**
 * Composites all edits (background mask, replacement background, rotation, flips, crop,
 * filters, vignette, shape mask, annotations) into a crisp output Blob.
 */
export async function renderEditedImageToBlob(params: PhotoEditExportParams): Promise<{
  blob: Blob
  hasTransparency: boolean
  width: number
  height: number
}> {
  const {
    img,
    rotation,
    straighten,
    flipH,
    flipV,
    crop,
    adjustments,
    filterPresetId,
    alphaMask,
    maskWidth,
    maskHeight,
    replacementBg,
    shapeMask,
    annotations,
    maxExportSize = 1800
  } = params

  // Step 1: Build base image canvas with alpha mask applied (if any)
  const baseCanvas = document.createElement('canvas')
  let baseW = img.naturalWidth
  let baseH = img.naturalHeight
  if (baseW > maxExportSize || baseH > maxExportSize) {
    const s = Math.min(maxExportSize / baseW, maxExportSize / baseH)
    baseW = Math.max(1, Math.round(baseW * s))
    baseH = Math.max(1, Math.round(baseH * s))
  }
  baseCanvas.width = baseW
  baseCanvas.height = baseH
  const baseCtx = baseCanvas.getContext('2d')!
  baseCtx.imageSmoothingEnabled = true
  baseCtx.imageSmoothingQuality = 'high'
  baseCtx.drawImage(img, 0, 0, baseW, baseH)

  if (alphaMask && maskWidth > 0 && maskHeight > 0) {
    const imgData = baseCtx.getImageData(0, 0, baseW, baseH)
    const pixels = imgData.data
    const scaleX = maskWidth / baseW
    const scaleY = maskHeight / baseH
    for (let y = 0; y < baseH; y++) {
      const my = Math.min(maskHeight - 1, Math.floor(y * scaleY))
      for (let x = 0; x < baseW; x++) {
        const mx = Math.min(maskWidth - 1, Math.floor(x * scaleX))
        const mVal = alphaMask[my * maskWidth + mx]
        const p = (y * baseW + x) * 4
        pixels[p + 3] = Math.round((pixels[p + 3] * mVal) / 255)
      }
    }
    baseCtx.putImageData(imgData, 0, 0)
  }

  // Step 2: Apply rotation (90-degree multiples + straighten) and flips
  const isRotated90 = Math.abs(rotation % 180) === 90
  const transW = isRotated90 ? baseH : baseW
  const transH = isRotated90 ? baseW : baseH

  const transCanvas = document.createElement('canvas')
  transCanvas.width = transW
  transCanvas.height = transH
  const transCtx = transCanvas.getContext('2d')!
  transCtx.imageSmoothingEnabled = true
  transCtx.imageSmoothingQuality = 'high'

  transCtx.save()
  transCtx.translate(transW / 2, transH / 2)
  const totalAngleRad = ((rotation + straighten) * Math.PI) / 180
  if (totalAngleRad !== 0) {
    // Auto-scale slightly when straightening so corners don't leave empty triangles
    if (straighten !== 0) {
      const rad = Math.abs((straighten * Math.PI) / 180)
      const zoom = Math.cos(rad) + Math.sin(rad) * Math.max(transW / transH, transH / transW)
      transCtx.scale(zoom, zoom)
    }
    transCtx.rotate(totalAngleRad)
  }
  transCtx.scale(flipH ? -1 : 1, flipV ? -1 : 1)
  transCtx.drawImage(baseCanvas, -baseW / 2, -baseH / 2, baseW, baseH)
  transCtx.restore()

  // Step 3: Crop + Replacement BG + Adjustments/Filters + Vignette + Shape Mask + Annotations
  const sx = Math.max(0, Math.round(crop.x * transW))
  const sy = Math.max(0, Math.round(crop.y * transH))
  const sw = Math.max(1, Math.min(transW - sx, Math.round(crop.w * transW)))
  const sh = Math.max(1, Math.min(transH - sy, Math.round(crop.h * transH)))

  const outCanvas = document.createElement('canvas')
  outCanvas.width = sw
  outCanvas.height = sh
  const outCtx = outCanvas.getContext('2d')!
  outCtx.imageSmoothingEnabled = true
  outCtx.imageSmoothingQuality = 'high'

  // Optional shape clip
  if (shapeMask === 'circle') {
    outCtx.save()
    outCtx.beginPath()
    outCtx.ellipse(sw / 2, sh / 2, sw / 2, sh / 2, 0, 0, Math.PI * 2)
    outCtx.clip()
  } else if (shapeMask === 'rounded') {
    const r = Math.min(sw, sh) * 0.08
    outCtx.save()
    outCtx.beginPath()
    outCtx.roundRect(0, 0, sw, sh, r)
    outCtx.clip()
  }

  // Background fill (if solid or gradient)
  if (replacementBg.type === 'solid') {
    outCtx.fillStyle = replacementBg.color
    outCtx.fillRect(0, 0, sw, sh)
  } else if (replacementBg.type === 'gradient') {
    const angle = ((replacementBg.gradientAngle ?? 135) * Math.PI) / 180
    const x0 = sw / 2 - Math.cos(angle) * sw * 0.6
    const y0 = sh / 2 - Math.sin(angle) * sh * 0.6
    const x1 = sw / 2 + Math.cos(angle) * sw * 0.6
    const y1 = sh / 2 + Math.sin(angle) * sh * 0.6
    const grad = outCtx.createLinearGradient(x0, y0, x1, y1)
    grad.addColorStop(0, replacementBg.color)
    grad.addColorStop(1, replacementBg.gradientEnd || '#E0F0FD')
    outCtx.fillStyle = grad
    outCtx.fillRect(0, 0, sw, sh)
  }

  // Draw filtered cropped subject
  outCtx.save()
  const cssFilter = buildCssFilter(adjustments, filterPresetId)
  if (cssFilter !== 'none') {
    outCtx.filter = cssFilter
  }
  outCtx.globalAlpha = Math.min(1, Math.max(0.1, adjustments.opacity / 100))
  outCtx.drawImage(transCanvas, sx, sy, sw, sh, 0, 0, sw, sh)
  outCtx.restore()

  // Vignette overlay
  if (adjustments.vignette > 0) {
    const vStrength = (adjustments.vignette / 100) * 0.85
    const grad = outCtx.createRadialGradient(
      sw / 2,
      sh / 2,
      Math.min(sw, sh) * 0.22,
      sw / 2,
      sh / 2,
      Math.hypot(sw, sh) * 0.56
    )
    grad.addColorStop(0, 'rgba(0,0,0,0)')
    grad.addColorStop(1, `rgba(0,0,0,${vStrength})`)
    outCtx.fillStyle = grad
    outCtx.fillRect(0, 0, sw, sh)
  }

  // Vector annotations
  if (annotations.length > 0) {
    drawAnnotationsOnContext(outCtx, annotations, sw, sh)
  }

  if (shapeMask !== 'none') {
    outCtx.restore()
  }

  const hasTransparency =
    (alphaMask !== null && replacementBg.type === 'transparent') ||
    shapeMask !== 'none' ||
    adjustments.opacity < 100

  let blob: Blob | null = await new Promise((resolve) =>
    outCanvas.toBlob((b) => resolve(b), 'image/webp', 0.86)
  )
  if (!blob || blob.type !== 'image/webp') {
    blob = await new Promise((resolve) =>
      outCanvas.toBlob((b) => resolve(b), hasTransparency ? 'image/png' : 'image/jpeg', 0.9)
    )
  }
  if (!blob) throw new Error('No se pudo generar la imagen editada')

  return { blob, hasTransparency, width: sw, height: sh }
}
