import React, { useState, useEffect, useRef, useCallback } from 'react'
import { createPortal } from 'react-dom'
import {
  X,
  Crop,
  Eraser,
  SlidersHorizontal,
  Sparkles,
  Pencil,
  RotateCcw,
  RotateCw,
  FlipHorizontal2,
  FlipVertical2,
  Wand2,
  Paintbrush,
  Undo2,
  Redo2,
  Download,
  Check,
  Eye,
  Trash2,
  ArrowUpRight,
  Square,
  Circle,
  Highlighter,
  Type,
  RefreshCw,
  Loader2
} from 'lucide-react'
import { toast } from 'sonner'
import {
  ASPECT_RATIO_OPTIONS,
  DEFAULT_ADJUSTMENTS,
  IMAGE_FILTER_PRESETS,
  type AnnotationTool,
  type CropRect,
  type ImageAdjustments,
  type ImageAnnotation,
  type ReplacementBg,
  applyBrushToMask,
  buildCssFilter,
  drawAnnotationsOnContext,
  loadEditableImage,
  removeBackgroundAtPoint,
  removeBackgroundAuto,
  renderEditedImageToBlob
} from '../../lib/imageEditorUtils'
import { processAndUploadImage } from '../../lib/imageOptimizer'

export interface PhotoEditorResult {
  url: string
  width: number
  height: number
  hasTransparency: boolean
}

interface PhotoEditorModalProps {
  isOpen: boolean
  imageSrc: string
  initialFilter?: string
  onClose: () => void
  onSave: (result: PhotoEditorResult) => void
}

type StudioTab = 'crop' | 'bg' | 'adjust' | 'filters' | 'annotate'
type BgTool = 'wand' | 'erase' | 'restore'
type DragHandle = 'move' | 'nw' | 'ne' | 'sw' | 'se' | 'n' | 's' | 'e' | 'w'

const BG_SOLID_SWATCHES = [
  { label: 'Blanco', color: '#FFFFFF' },
  { label: 'Papel', color: '#FBFBFA' },
  { label: 'Carbón', color: '#191919' },
  { label: 'Amarillo', color: '#FFF9DB' },
  { label: 'Cielo', color: '#E0F0FD' },
  { label: 'Menta', color: '#DCF5E3' },
  { label: 'Lavanda', color: '#EDE7FB' },
  { label: 'Rosa', color: '#FCE4EC' },
  { label: 'Durazno', color: '#FFE8D4' }
]

const BG_GRADIENTS = [
  { label: 'Alba', start: '#FFF9DB', end: '#FFE8D4' },
  { label: 'Brisa', start: '#E0F0FD', end: '#EDE7FB' },
  { label: 'Bosque', start: '#DCF5E3', end: '#E0F0FD' },
  { label: 'Estudio', start: '#262626', end: '#111111' }
]

const ANNOTATION_COLORS = [
  '#EF4444',
  '#F59E0B',
  '#10B981',
  '#2383E2',
  '#8B5CF6',
  '#EC4899',
  '#FFFFFF',
  '#191919'
]

export const PhotoEditorModal: React.FC<PhotoEditorModalProps> = ({
  isOpen,
  imageSrc,
  initialFilter = 'none',
  onClose,
  onSave
}) => {
  const [activeTab, setActiveTab] = useState<StudioTab>('crop')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [showOriginal, setShowOriginal] = useState(false)

  // Loaded source image & working pixel data (capped at 900px for instant mask ops)
  const imgRef = useRef<HTMLImageElement | null>(null)
  const workImageDataRef = useRef<ImageData | null>(null)
  const [workDims, setWorkDims] = useState({ w: 0, h: 0 })
  const [origDims, setOrigDims] = useState({ w: 0, h: 0 })

  // Transform & Crop state
  const [rotation, setRotation] = useState(0)
  const [straighten, setStraighten] = useState(0)
  const [flipH, setFlipH] = useState(false)
  const [flipV, setFlipV] = useState(false)
  const [crop, setCrop] = useState<CropRect>({ x: 0, y: 0, w: 1, h: 1 })
  const [lockedRatio, setLockedRatio] = useState<number | null>(null)
  const [shapeMask, setShapeMask] = useState<'none' | 'rounded' | 'circle'>('none')

  // Background removal state
  const [alphaMask, setAlphaMask] = useState<Uint8ClampedArray | null>(null)
  const [maskHistory, setMaskHistory] = useState<Array<Uint8ClampedArray | null>>([])
  const [maskRedo, setMaskRedo] = useState<Array<Uint8ClampedArray | null>>([])
  const [bgTool, setBgTool] = useState<BgTool>('wand')
  const [bgTolerance, setBgTolerance] = useState(32)
  const [bgFeather, setBgFeather] = useState(2)
  const [bgContiguous, setBgContiguous] = useState(true)
  const [brushSize, setBrushSize] = useState(28)
  const [brushSoftness, setBrushSoftness] = useState(0.45)
  const [replacementBg, setReplacementBg] = useState<ReplacementBg>({
    type: 'transparent',
    color: '#FFFFFF'
  })
  const [isRemovingBg, setIsRemovingBg] = useState(false)

  // Adjustments & Filters
  const [adjustments, setAdjustments] = useState<ImageAdjustments>(DEFAULT_ADJUSTMENTS)
  const [filterPresetId, setFilterPresetId] = useState<string>(initialFilter || 'none')

  // Annotations
  const [annotations, setAnnotations] = useState<ImageAnnotation[]>([])
  const [annotationRedo, setAnnotationRedo] = useState<ImageAnnotation[]>([])
  const [annotationTool, setAnnotationTool] = useState<AnnotationTool>('pen')
  const [annotationColor, setAnnotationColor] = useState('#EF4444')
  const [annotationSize, setAnnotationSize] = useState(6)
  const [draftAnnotation, setDraftAnnotation] = useState<ImageAnnotation | null>(null)
  const [pendingTextPos, setPendingTextPos] = useState<{ x: number; y: number } | null>(null)
  const [pendingTextVal, setPendingTextVal] = useState('')

  // Canvas & interaction refs
  const previewCanvasRef = useRef<HTMLCanvasElement | null>(null)
  const stageBoxRef = useRef<HTMLDivElement | null>(null)
  const dragStateRef = useRef<{
    type: 'crop' | 'brush' | 'annotate'
    handle?: DragHandle
    startX: number
    startY: number
    startCrop?: CropRect
    lastMaskX?: number
    lastMaskY?: number
    workingMask?: Uint8ClampedArray
  } | null>(null)

  // Load image when modal opens
  useEffect(() => {
    if (!isOpen || !imageSrc) return
    let cancelled = false
    setLoading(true)
    setLoadError(null)
    setRotation(0)
    setStraighten(0)
    setFlipH(false)
    setFlipV(false)
    setCrop({ x: 0, y: 0, w: 1, h: 1 })
    setLockedRatio(null)
    setShapeMask('none')
    setAlphaMask(null)
    setMaskHistory([])
    setMaskRedo([])
    setReplacementBg({ type: 'transparent', color: '#FFFFFF' })
    setAdjustments(DEFAULT_ADJUSTMENTS)
    setFilterPresetId(initialFilter || 'none')
    setAnnotations([])
    setAnnotationRedo([])
    setDraftAnnotation(null)
    setPendingTextPos(null)
    setShowOriginal(false)

    loadEditableImage(imageSrc)
      .then((img) => {
        if (cancelled) return
        imgRef.current = img
        setOrigDims({ w: img.naturalWidth, h: img.naturalHeight })

        // Create working pixel buffer for fast background removal & preview (max 900px)
        const maxWork = 900
        let w = img.naturalWidth
        let h = img.naturalHeight
        if (w > maxWork || h > maxWork) {
          const s = Math.min(maxWork / w, maxWork / h)
          w = Math.max(1, Math.round(w * s))
          h = Math.max(1, Math.round(h * s))
        }
        const c = document.createElement('canvas')
        c.width = w
        c.height = h
        const ctx = c.getContext('2d', { willReadFrequently: true })!
        ctx.drawImage(img, 0, 0, w, h)
        workImageDataRef.current = ctx.getImageData(0, 0, w, h)
        setWorkDims({ w, h })
        setLoading(false)
      })
      .catch((err) => {
        if (cancelled) return
        console.error('Error loading image in PhotoEditorModal:', err)
        setLoadError('No se pudo cargar la imagen para editar (posible bloqueo CORS de imagen externa).')
        setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [isOpen, imageSrc, initialFilter])

  // Escape key to close
  useEffect(() => {
    if (!isOpen) return
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !pendingTextPos) {
        onClose()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [isOpen, onClose, pendingTextPos])

  // Compute displayed transformed dimensions (before crop)
  const isRotated90 = Math.abs(rotation % 180) === 90
  const displayFullW = isRotated90 ? workDims.h : workDims.w
  const displayFullH = isRotated90 ? workDims.w : workDims.h

  // Render live preview canvas
  const renderPreview = useCallback(() => {
    const canvas = previewCanvasRef.current
    const img = imgRef.current
    const workData = workImageDataRef.current
    if (!canvas || !img || !workData || workDims.w === 0) return

    const fullW = isRotated90 ? workDims.h : workDims.w
    const fullH = isRotated90 ? workDims.w : workDims.h

    // On crop tab, show full image so user can adjust the crop box; on other tabs, show cropped view
    const showCropped = activeTab !== 'crop' && !showOriginal
    const outW = showCropped ? Math.max(1, Math.round(crop.w * fullW)) : fullW
    const outH = showCropped ? Math.max(1, Math.round(crop.h * fullH)) : fullH

    if (canvas.width !== outW || canvas.height !== outH) {
      canvas.width = outW
      canvas.height = outH
    }

    const ctx = canvas.getContext('2d')!
    ctx.clearRect(0, 0, outW, outH)

    if (showOriginal) {
      // Render untouched original oriented image
      ctx.save()
      ctx.translate(fullW / 2, fullH / 2)
      ctx.rotate((rotation * Math.PI) / 180)
      ctx.drawImage(img, -workDims.w / 2, -workDims.h / 2, workDims.w, workDims.h)
      ctx.restore()
      return
    }

    // Build masked source canvas
    const srcCanvas = document.createElement('canvas')
    srcCanvas.width = workDims.w
    srcCanvas.height = workDims.h
    const srcCtx = srcCanvas.getContext('2d')!

    if (alphaMask && alphaMask.length === workDims.w * workDims.h) {
      const copy = new ImageData(new Uint8ClampedArray(workData.data), workDims.w, workDims.h)
      const px = copy.data
      for (let i = 0; i < alphaMask.length; i++) {
        px[i * 4 + 3] = Math.round((px[i * 4 + 3] * alphaMask[i]) / 255)
      }
      srcCtx.putImageData(copy, 0, 0)
    } else {
      srcCtx.putImageData(workData, 0, 0)
    }

    // Build transformed canvas
    const transCanvas = document.createElement('canvas')
    transCanvas.width = fullW
    transCanvas.height = fullH
    const transCtx = transCanvas.getContext('2d')!
    transCtx.save()
    transCtx.translate(fullW / 2, fullH / 2)
    const totalRad = ((rotation + straighten) * Math.PI) / 180
    if (totalRad !== 0) {
      if (straighten !== 0) {
        const rad = Math.abs((straighten * Math.PI) / 180)
        const zoom = Math.cos(rad) + Math.sin(rad) * Math.max(fullW / fullH, fullH / fullW)
        transCtx.scale(zoom, zoom)
      }
      transCtx.rotate(totalRad)
    }
    transCtx.scale(flipH ? -1 : 1, flipV ? -1 : 1)
    transCtx.drawImage(srcCanvas, -workDims.w / 2, -workDims.h / 2, workDims.w, workDims.h)
    transCtx.restore()

    // Apply shape clip when viewing cropped
    if (showCropped && shapeMask !== 'none') {
      ctx.save()
      ctx.beginPath()
      if (shapeMask === 'circle') {
        ctx.ellipse(outW / 2, outH / 2, outW / 2, outH / 2, 0, 0, Math.PI * 2)
      } else {
        ctx.roundRect(0, 0, outW, outH, Math.min(outW, outH) * 0.08)
      }
      ctx.clip()
    }

    // Replacement background
    if (replacementBg.type === 'solid') {
      ctx.fillStyle = replacementBg.color
      ctx.fillRect(0, 0, outW, outH)
    } else if (replacementBg.type === 'gradient') {
      const grad = ctx.createLinearGradient(0, 0, outW, outH)
      grad.addColorStop(0, replacementBg.color)
      grad.addColorStop(1, replacementBg.gradientEnd || '#E0F0FD')
      ctx.fillStyle = grad
      ctx.fillRect(0, 0, outW, outH)
    }

    // Draw subject with filters
    ctx.save()
    const cssFilter = buildCssFilter(adjustments, filterPresetId)
    if (cssFilter !== 'none') ctx.filter = cssFilter
    ctx.globalAlpha = Math.min(1, Math.max(0.1, adjustments.opacity / 100))

    if (showCropped) {
      const sx = Math.round(crop.x * fullW)
      const sy = Math.round(crop.y * fullH)
      ctx.drawImage(transCanvas, sx, sy, outW, outH, 0, 0, outW, outH)
    } else {
      ctx.drawImage(transCanvas, 0, 0, fullW, fullH)
    }
    ctx.restore()

    // Vignette
    if (adjustments.vignette > 0) {
      const vStrength = (adjustments.vignette / 100) * 0.85
      const grad = ctx.createRadialGradient(
        outW / 2,
        outH / 2,
        Math.min(outW, outH) * 0.22,
        outW / 2,
        outH / 2,
        Math.hypot(outW, outH) * 0.56
      )
      grad.addColorStop(0, 'rgba(0,0,0,0)')
      grad.addColorStop(1, `rgba(0,0,0,${vStrength})`)
      ctx.fillStyle = grad
      ctx.fillRect(0, 0, outW, outH)
    }

    // Annotations (drawn on cropped coords when showCropped)
    if (showCropped) {
      const allAnn = draftAnnotation ? [...annotations, draftAnnotation] : annotations
      if (allAnn.length > 0) {
        drawAnnotationsOnContext(ctx, allAnn, outW, outH)
      }
    }

    if (showCropped && shapeMask !== 'none') {
      ctx.restore()
    }
  }, [
    activeTab,
    showOriginal,
    workDims,
    isRotated90,
    rotation,
    straighten,
    flipH,
    flipV,
    crop,
    alphaMask,
    replacementBg,
    adjustments,
    filterPresetId,
    shapeMask,
    annotations,
    draftAnnotation
  ])

  useEffect(() => {
    renderPreview()
  }, [renderPreview])

  // Push mask snapshot to undo stack
  const commitMask = useCallback(
    (nextMask: Uint8ClampedArray | null) => {
      setMaskHistory((prev) => [...prev.slice(-14), alphaMask])
      setMaskRedo([])
      setAlphaMask(nextMask)
    },
    [alphaMask]
  )

  const handleAutoRemoveBg = () => {
    const workData = workImageDataRef.current
    if (!workData) return
    setIsRemovingBg(true)
    setTimeout(() => {
      try {
        const nextMask = removeBackgroundAuto(workData, {
          tolerance: bgTolerance,
          feather: bgFeather,
          edgeProtection: true
        })
        commitMask(nextMask)
        toast.success('Fondo recortado automáticamente. Usa la varita o el pincel para afinar detalles.')
      } catch (e) {
        console.error(e)
        toast.error('No se pudo recortar el fondo automáticamente')
      } finally {
        setIsRemovingBg(false)
      }
    }, 20)
  }

  // Convert pointer event on preview canvas into original workImageData coordinates (inverting crop + flip + rotation)
  const pointerToMaskCoords = (clientX: number, clientY: number): { x: number; y: number } | null => {
    const canvas = previewCanvasRef.current
    if (!canvas || workDims.w === 0) return null
    const rect = canvas.getBoundingClientRect()
    if (rect.width === 0 || rect.height === 0) return null

    // Normalized 0..1 on the displayed canvas
    const nx = (clientX - rect.left) / rect.width
    const ny = (clientY - rect.top) / rect.height

    // Map from cropped space back to full transformed space
    const showCropped = activeTab !== 'crop'
    const fullNx = showCropped ? crop.x + nx * crop.w : nx
    const fullNy = showCropped ? crop.y + ny * crop.h : ny

    // Map from transformed (rotated + flipped) space back to original workData coords
    let cx = fullNx - 0.5
    let cy = fullNy - 0.5
    const fullW = isRotated90 ? workDims.h : workDims.w
    const fullH = isRotated90 ? workDims.w : workDims.h
    let px = cx * fullW
    let py = cy * fullH

    if (flipH) px = -px
    if (flipV) py = -py

    const rad = (-rotation * Math.PI) / 180
    const rx = px * Math.cos(rad) - py * Math.sin(rad)
    const ry = px * Math.sin(rad) + py * Math.cos(rad)

    const ox = rx + workDims.w / 2
    const oy = ry + workDims.h / 2
    if (ox < 0 || ox >= workDims.w || oy < 0 || oy >= workDims.h) return null
    return { x: ox, y: oy }
  }

  // Apply aspect ratio preset to crop rect
  const applyCropAspectRatio = (ratio: number | null) => {
    setLockedRatio(ratio)
    if (!ratio || displayFullW === 0 || displayFullH === 0) {
      setCrop({ x: 0, y: 0, w: 1, h: 1 })
      return
    }
    const imgRatio = displayFullW / displayFullH
    let newW = 1
    let newH = 1
    if (ratio > imgRatio) {
      newW = 1
      newH = imgRatio / ratio
    } else {
      newH = 1
      newW = ratio / imgRatio
    }
    setCrop({
      x: (1 - newW) / 2,
      y: (1 - newH) / 2,
      w: newW,
      h: newH
    })
  }

  // Crop handle pointer down
  const startCropDrag = (e: React.PointerEvent, handle: DragHandle) => {
    e.preventDefault()
    e.stopPropagation()
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
    dragStateRef.current = {
      type: 'crop',
      handle,
      startX: e.clientX,
      startY: e.clientY,
      startCrop: { ...crop }
    }
  }

  // Canvas pointer handlers for Background & Annotate tabs
  const handleCanvasPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (showOriginal) return

    if (activeTab === 'bg') {
      const pt = pointerToMaskCoords(e.clientX, e.clientY)
      if (!pt || !workImageDataRef.current) return

      if (bgTool === 'wand') {
        const nextMask = removeBackgroundAtPoint(workImageDataRef.current, alphaMask, pt.x, pt.y, {
          tolerance: bgTolerance,
          feather: bgFeather,
          contiguous: bgContiguous
        })
        commitMask(nextMask)
        return
      }

      // Erase or Restore brush
      e.currentTarget.setPointerCapture(e.pointerId)
      const baseMask = alphaMask
        ? new Uint8ClampedArray(alphaMask)
        : new Uint8ClampedArray(workDims.w * workDims.h).fill(255)
      applyBrushToMask(
        baseMask,
        workDims.w,
        workDims.h,
        pt.x,
        pt.y,
        pt.x,
        pt.y,
        brushSize,
        brushSoftness,
        bgTool === 'erase' ? 'erase' : 'restore'
      )
      setMaskHistory((prev) => [...prev.slice(-14), alphaMask])
      setMaskRedo([])
      setAlphaMask(baseMask)
      dragStateRef.current = {
        type: 'brush',
        startX: e.clientX,
        startY: e.clientY,
        lastMaskX: pt.x,
        lastMaskY: pt.y,
        workingMask: baseMask
      }
      return
    }

    if (activeTab === 'annotate') {
      const canvas = previewCanvasRef.current
      if (!canvas) return
      const rect = canvas.getBoundingClientRect()
      const nx = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width))
      const ny = Math.min(1, Math.max(0, (e.clientY - rect.top) / rect.height))

      if (annotationTool === 'text') {
        setPendingTextPos({ x: nx, y: ny })
        setPendingTextVal('')
        return
      }

      e.currentTarget.setPointerCapture(e.pointerId)
      const id = `ann_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`
      const draft: ImageAnnotation =
        annotationTool === 'pen' || annotationTool === 'highlighter'
          ? {
              id,
              tool: annotationTool,
              color: annotationColor,
              size: annotationSize,
              points: [{ x: nx, y: ny }]
            }
          : {
              id,
              tool: annotationTool,
              color: annotationColor,
              size: annotationSize,
              x1: nx,
              y1: ny,
              x2: nx,
              y2: ny
            }
      setDraftAnnotation(draft)
      dragStateRef.current = {
        type: 'annotate',
        startX: e.clientX,
        startY: e.clientY
      }
    }
  }

  const handleGlobalPointerMove = (e: React.PointerEvent) => {
    const drag = dragStateRef.current
    if (!drag) return

    if (drag.type === 'crop' && drag.startCrop && drag.handle && previewCanvasRef.current) {
      const rect = previewCanvasRef.current.getBoundingClientRect()
      if (rect.width === 0 || rect.height === 0) return
      const dx = (e.clientX - drag.startX) / rect.width
      const dy = (e.clientY - drag.startY) / rect.height
      const sc = drag.startCrop
      const minSize = 0.08

      let { x, y, w, h } = sc
      const hdl = drag.handle

      if (hdl === 'move') {
        x = Math.min(1 - sc.w, Math.max(0, sc.x + dx))
        y = Math.min(1 - sc.h, Math.max(0, sc.y + dy))
      } else {
        if (hdl.includes('e')) {
          w = Math.min(1 - sc.x, Math.max(minSize, sc.w + dx))
        }
        if (hdl.includes('s')) {
          h = Math.min(1 - sc.y, Math.max(minSize, sc.h + dy))
        }
        if (hdl.includes('w')) {
          const maxShift = sc.w - minSize
          const shift = Math.min(maxShift, Math.max(-sc.x, dx))
          x = sc.x + shift
          w = sc.w - shift
        }
        if (hdl.includes('n')) {
          const maxShift = sc.h - minSize
          const shift = Math.min(maxShift, Math.max(-sc.y, dy))
          y = sc.y + shift
          h = sc.h - shift
        }

        if (lockedRatio && displayFullW > 0 && displayFullH > 0) {
          const imgRatio = displayFullW / displayFullH
          const targetH = (w * imgRatio) / lockedRatio
          if (y + targetH <= 1) {
            h = Math.max(minSize, targetH)
          } else {
            h = 1 - y
            w = (h * lockedRatio) / imgRatio
          }
        }
      }

      setCrop({ x, y, w, h })
      return
    }

    if (drag.type === 'brush' && drag.workingMask) {
      const pt = pointerToMaskCoords(e.clientX, e.clientY)
      if (!pt) return
      applyBrushToMask(
        drag.workingMask,
        workDims.w,
        workDims.h,
        drag.lastMaskX ?? pt.x,
        drag.lastMaskY ?? pt.y,
        pt.x,
        pt.y,
        brushSize,
        brushSoftness,
        bgTool === 'erase' ? 'erase' : 'restore'
      )
      drag.lastMaskX = pt.x
      drag.lastMaskY = pt.y
      // Trigger re-render with updated mask copy reference
      setAlphaMask(new Uint8ClampedArray(drag.workingMask))
      return
    }

    if (drag.type === 'annotate' && previewCanvasRef.current) {
      const rect = previewCanvasRef.current.getBoundingClientRect()
      const nx = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width))
      const ny = Math.min(1, Math.max(0, (e.clientY - rect.top) / rect.height))
      setDraftAnnotation((prev) => {
        if (!prev) return null
        if (prev.tool === 'pen' || prev.tool === 'highlighter') {
          return { ...prev, points: [...(prev.points || []), { x: nx, y: ny }] }
        }
        return { ...prev, x2: nx, y2: ny }
      })
    }
  }

  const handleGlobalPointerUp = () => {
    const drag = dragStateRef.current
    if (!drag) return
    if (drag.type === 'annotate' && draftAnnotation) {
      setAnnotations((prev) => [...prev, draftAnnotation])
      setAnnotationRedo([])
      setDraftAnnotation(null)
    }
    dragStateRef.current = null
  }

  const handleCommitTextAnnotation = () => {
    if (pendingTextPos && pendingTextVal.trim()) {
      setAnnotations((prev) => [
        ...prev,
        {
          id: `txt_${Date.now()}`,
          tool: 'text',
          color: annotationColor,
          size: annotationSize,
          x1: pendingTextPos.x,
          y1: pendingTextPos.y,
          text: pendingTextVal.trim()
        }
      ])
      setAnnotationRedo([])
    }
    setPendingTextPos(null)
    setPendingTextVal('')
  }

  const handleUndo = () => {
    if (activeTab === 'annotate') {
      if (annotations.length === 0) return
      const last = annotations[annotations.length - 1]
      setAnnotations((prev) => prev.slice(0, -1))
      setAnnotationRedo((prev) => [...prev, last])
    } else {
      if (maskHistory.length === 0) return
      const prev = maskHistory[maskHistory.length - 1]
      setMaskHistory((h) => h.slice(0, -1))
      setMaskRedo((r) => [...r, alphaMask])
      setAlphaMask(prev)
    }
  }

  const handleRedo = () => {
    if (activeTab === 'annotate') {
      if (annotationRedo.length === 0) return
      const next = annotationRedo[annotationRedo.length - 1]
      setAnnotationRedo((prev) => prev.slice(0, -1))
      setAnnotations((prev) => [...prev, next])
    } else {
      if (maskRedo.length === 0) return
      const next = maskRedo[maskRedo.length - 1]
      setMaskRedo((r) => r.slice(0, -1))
      setMaskHistory((h) => [...h, alphaMask])
      setAlphaMask(next)
    }
  }

  const buildOutputBlob = async () => {
    if (!imgRef.current) throw new Error('Imagen no cargada')
    return renderEditedImageToBlob({
      img: imgRef.current,
      rotation,
      straighten,
      flipH,
      flipV,
      crop,
      adjustments,
      filterPresetId,
      alphaMask,
      maskWidth: workDims.w,
      maskHeight: workDims.h,
      replacementBg,
      shapeMask,
      annotations
    })
  }

  const handleDownload = async () => {
    try {
      const { blob } = await buildOutputBlob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      const ext = blob.type === 'image/png' ? 'png' : 'webp'
      a.download = `seven-note-photo-${Date.now()}.${ext}`
      a.click()
      setTimeout(() => URL.revokeObjectURL(url), 5000)
      toast.success('Imagen descargada')
    } catch (err: any) {
      toast.error('Error al descargar: ' + (err?.message || 'Error'))
    }
  }

  const handleApplySave = async () => {
    if (saving) return
    setSaving(true)
    const toastId = toast.loading('Guardando foto editada...')
    try {
      const { blob, hasTransparency, width, height } = await buildOutputBlob()
      const uploaded = await processAndUploadImage(blob, {
        preserveAlpha: hasTransparency,
        maxWidth: 1800,
        maxHeight: 1800,
        quality: 0.86
      })
      toast.success('Cambios aplicados a la foto', { id: toastId })
      onSave({
        url: uploaded.url,
        width: uploaded.width || width,
        height: uploaded.height || height,
        hasTransparency
      })
      onClose()
    } catch (err: any) {
      console.error('Error saving edited photo:', err)
      toast.error('Error al guardar: ' + (err?.message || 'Error'), { id: toastId })
    } finally {
      setSaving(false)
    }
  }

  if (!isOpen) return null

  const canUndo = activeTab === 'annotate' ? annotations.length > 0 : maskHistory.length > 0
  const canRedo = activeTab === 'annotate' ? annotationRedo.length > 0 : maskRedo.length > 0

  const modalContent = (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 backdrop-blur-sm p-2 sm:p-4 animate-in fade-in duration-150"
      onPointerMove={handleGlobalPointerMove}
      onPointerUp={handleGlobalPointerUp}
      onClick={(e) => {
        if (e.target === e.currentTarget && !saving) onClose()
      }}
    >
      <div
        className="w-full max-w-[1120px] h-[92vh] max-h-[820px] flex flex-col rounded-xl border overflow-hidden shadow-2xl"
        style={{
          backgroundColor: 'var(--app-bg-primary, #191919)',
          borderColor: 'var(--app-border, rgba(255,255,255,0.1))',
          color: 'var(--app-text-primary, #E6E6E5)'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Studio Bar */}
        <div
          className="h-12 px-4 flex items-center justify-between border-b shrink-0 gap-2"
          style={{
            backgroundColor: 'var(--app-bg-secondary, #202020)',
            borderColor: 'var(--app-border, rgba(255,255,255,0.08))'
          }}
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-7 h-7 rounded-lg bg-[#2383E2]/15 text-[#2383E2] flex items-center justify-center shrink-0">
              <Sparkles className="w-4 h-4" />
            </div>
            <span className="font-semibold text-sm truncate">Estudio de Foto</span>
            {origDims.w > 0 && (
              <span className="hidden sm:inline-block text-[11px] px-2 py-0.5 rounded-md bg-black/5 dark:bg-white/5 text-[var(--app-text-secondary)]">
                {Math.round(origDims.w * crop.w)} × {Math.round(origDims.h * crop.h)} px
              </span>
            )}
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={handleUndo}
              disabled={!canUndo}
              className="p-1.5 rounded-md hover:bg-black/5 dark:hover:bg-white/10 disabled:opacity-35 transition cursor-pointer"
              title="Deshacer"
            >
              <Undo2 className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={handleRedo}
              disabled={!canRedo}
              className="p-1.5 rounded-md hover:bg-black/5 dark:hover:bg-white/10 disabled:opacity-35 transition cursor-pointer"
              title="Rehacer"
            >
              <Redo2 className="w-4 h-4" />
            </button>

            <div className="w-px h-5 bg-[var(--app-border)] mx-1" />

            <button
              type="button"
              onPointerDown={() => setShowOriginal(true)}
              onPointerUp={() => setShowOriginal(false)}
              onPointerLeave={() => setShowOriginal(false)}
              className={`px-2.5 py-1 rounded-md text-xs font-medium flex items-center gap-1.5 border transition cursor-pointer select-none ${
                showOriginal
                  ? 'bg-[#2383E2] text-white border-[#2383E2]'
                  : 'border-[var(--app-border)] hover:bg-black/5 dark:hover:bg-white/10'
              }`}
              title="Mantén pulsado para comparar con la foto original"
            >
              <Eye className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Original</span>
            </button>

            <button
              type="button"
              onClick={handleDownload}
              disabled={loading || !!loadError}
              className="p-1.5 rounded-md border border-[var(--app-border)] hover:bg-black/5 dark:hover:bg-white/10 disabled:opacity-40 transition cursor-pointer"
              title="Descargar imagen editada"
            >
              <Download className="w-4 h-4" />
            </button>

            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="px-3 py-1.5 rounded-md text-xs font-medium hover:bg-black/5 dark:hover:bg-white/10 transition cursor-pointer"
            >
              Cancelar
            </button>

            <button
              type="button"
              onClick={handleApplySave}
              disabled={loading || saving || !!loadError}
              className="px-3.5 py-1.5 rounded-md text-xs font-semibold bg-[#2383E2] hover:bg-[#1c72c8] text-white flex items-center gap-1.5 disabled:opacity-50 transition cursor-pointer shadow-sm"
            >
              {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
              <span>Aplicar</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-md hover:bg-black/5 dark:hover:bg-white/10 transition cursor-pointer ml-0.5"
              title="Cerrar"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Main Workspace: Preview Stage + Right Tools Panel */}
        <div className="flex-1 flex flex-col md:flex-row min-h-0 overflow-hidden">
          {/* Center Preview Stage */}
          <div
            ref={stageBoxRef}
            className="flex-1 relative flex items-center justify-center p-4 sm:p-6 overflow-hidden select-none"
            style={{
              backgroundColor: 'var(--app-bg-tertiary, #141414)'
            }}
          >
            {loading ? (
              <div className="flex flex-col items-center gap-2 text-sm text-[var(--app-text-secondary)]">
                <Loader2 className="w-6 h-6 animate-spin text-[#2383E2]" />
                <span>Cargando estudio de foto...</span>
              </div>
            ) : loadError ? (
              <div className="max-w-sm text-center space-y-2 p-5 rounded-xl border border-[var(--app-border)] bg-[var(--app-bg-primary)]">
                <p className="text-sm font-medium text-rose-500">{loadError}</p>
                <p className="text-xs text-[var(--app-text-secondary)]">
                  Puedes seguir cambiando el aspecto, marco, sombra y filtros rápidos desde la barra de la imagen en tu nota.
                </p>
              </div>
            ) : (
              <div
                className="relative inline-flex items-center justify-center max-w-full max-h-full shadow-lg rounded-lg overflow-hidden"
                style={{
                  backgroundImage:
                    'linear-gradient(45deg, rgba(128,128,128,0.18) 25%, transparent 25%), linear-gradient(-45deg, rgba(128,128,128,0.18) 25%, transparent 25%), linear-gradient(45deg, transparent 75%, rgba(128,128,128,0.18) 75%), linear-gradient(-45deg, transparent 75%, rgba(128,128,128,0.18) 75%)',
                  backgroundSize: '16px 16px',
                  backgroundPosition: '0 0, 0 8px, 8px -8px, -8px 0px'
                }}
              >
                <canvas
                  ref={previewCanvasRef}
                  onPointerDown={handleCanvasPointerDown}
                  className={`block max-w-full max-h-[54vh] md:max-h-[68vh] w-auto h-auto ${
                    activeTab === 'bg' || activeTab === 'annotate' ? 'cursor-crosshair' : ''
                  }`}
                />

                {/* Interactive Crop Overlay */}
                {activeTab === 'crop' && !showOriginal && (
                  <div className="absolute inset-0 pointer-events-none">
                    {/* Darkened outside region via box-shadow */}
                    <div
                      className="absolute border-2 border-white shadow-[0_0_0_9999px_rgba(0,0,0,0.52)] pointer-events-auto cursor-move"
                      style={{
                        left: `${crop.x * 100}%`,
                        top: `${crop.y * 100}%`,
                        width: `${crop.w * 100}%`,
                        height: `${crop.h * 100}%`
                      }}
                      onPointerDown={(e) => startCropDrag(e, 'move')}
                    >
                      {/* Rule of thirds grid */}
                      <div className="absolute inset-0 grid grid-cols-3 grid-rows-3 pointer-events-none opacity-45">
                        <div className="border-r border-b border-white/60" />
                        <div className="border-r border-b border-white/60" />
                        <div className="border-b border-white/60" />
                        <div className="border-r border-b border-white/60" />
                        <div className="border-r border-b border-white/60" />
                        <div className="border-b border-white/60" />
                        <div className="border-r border-white/60" />
                        <div className="border-r border-white/60" />
                        <div />
                      </div>

                      {/* 4 Corner handles */}
                      {(
                        [
                          { h: 'nw', cls: '-top-1.5 -left-1.5 cursor-nwse-resize' },
                          { h: 'ne', cls: '-top-1.5 -right-1.5 cursor-nesw-resize' },
                          { h: 'sw', cls: '-bottom-1.5 -left-1.5 cursor-nesw-resize' },
                          { h: 'se', cls: '-bottom-1.5 -right-1.5 cursor-nwse-resize' },
                          { h: 'n', cls: '-top-1.5 left-1/2 -translate-x-1/2 cursor-ns-resize' },
                          { h: 's', cls: '-bottom-1.5 left-1/2 -translate-x-1/2 cursor-ns-resize' },
                          { h: 'w', cls: 'top-1/2 -left-1.5 -translate-y-1/2 cursor-ew-resize' },
                          { h: 'e', cls: 'top-1/2 -right-1.5 -translate-y-1/2 cursor-ew-resize' }
                        ] as Array<{ h: DragHandle; cls: string }>
                      ).map(({ h, cls }) => (
                        <div
                          key={h}
                          onPointerDown={(e) => startCropDrag(e, h)}
                          className={`absolute w-3.5 h-3.5 bg-white border-2 border-[#2383E2] rounded-sm shadow ${cls}`}
                        />
                      ))}
                    </div>
                  </div>
                )}

                {/* Text Annotation Popover */}
                {pendingTextPos && (
                  <div
                    className="absolute z-30 flex items-center gap-1.5 bg-[var(--app-bg-primary)] border border-[var(--app-border)] rounded-lg p-1.5 shadow-xl"
                    style={{
                      left: `${Math.min(72, Math.max(4, pendingTextPos.x * 100))}%`,
                      top: `${Math.min(82, Math.max(4, pendingTextPos.y * 100))}%`
                    }}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <input
                      type="text"
                      value={pendingTextVal}
                      onChange={(e) => setPendingTextVal(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleCommitTextAnnotation()
                        if (e.key === 'Escape') setPendingTextPos(null)
                      }}
                      placeholder="Escribe texto..."
                      autoFocus
                      className="px-2 py-1 text-xs rounded border border-[var(--app-border)] bg-transparent outline-none w-36"
                    />
                    <button
                      type="button"
                      onClick={handleCommitTextAnnotation}
                      className="px-2 py-1 text-xs rounded bg-[#2383E2] text-white font-medium cursor-pointer"
                    >
                      OK
                    </button>
                  </div>
                )}

                {/* Hint badge on Bg / Annotate tabs */}
                {activeTab === 'bg' && !showOriginal && (
                  <div className="absolute bottom-2.5 left-1/2 -translate-x-1/2 px-2.5 py-1 rounded-md bg-black/65 text-white text-[11px] backdrop-blur-md pointer-events-none whitespace-nowrap">
                    {bgTool === 'wand'
                      ? 'Haz clic sobre cualquier área del fondo para eliminarla'
                      : bgTool === 'erase'
                      ? 'Arrastra para borrar zonas manualmente'
                      : 'Arrastra para restaurar zonas de la foto'}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Right Inspector Panel */}
          <div
            className="w-full md:w-[320px] shrink-0 border-t md:border-t-0 md:border-l flex flex-col min-h-0"
            style={{
              backgroundColor: 'var(--app-bg-secondary, #202020)',
              borderColor: 'var(--app-border, rgba(255,255,255,0.08))'
            }}
          >
            {/* Studio Tab Bar */}
            <div className="grid grid-cols-5 gap-1 p-2 border-b border-[var(--app-border)] shrink-0">
              {(
                [
                  { id: 'crop', label: 'Recorte', icon: Crop },
                  { id: 'bg', label: 'Fondo', icon: Eraser },
                  { id: 'adjust', label: 'Ajustes', icon: SlidersHorizontal },
                  { id: 'filters', label: 'Filtros', icon: Sparkles },
                  { id: 'annotate', label: 'Anotar', icon: Pencil }
                ] as Array<{ id: StudioTab; label: string; icon: any }>
              ).map(({ id, label, icon: Icon }) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setActiveTab(id)}
                  className={`flex flex-col items-center justify-center gap-1 py-1.5 px-1 rounded-lg text-[10px] font-medium transition cursor-pointer ${
                    activeTab === id
                      ? 'bg-[#2383E2]/15 text-[#2383E2]'
                      : 'text-[var(--app-text-secondary)] hover:bg-black/5 dark:hover:bg-white/5'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span>{label}</span>
                </button>
              ))}
            </div>

            {/* Tab Body */}
            <div className="flex-1 overflow-y-auto p-4 space-y-5 text-xs">
              {/* TAB 1: CROP & ASPECT */}
              {activeTab === 'crop' && (
                <>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-[11px] uppercase tracking-wider text-[var(--app-text-secondary)]">
                        Relación de aspecto
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          setLockedRatio(null)
                          setCrop({ x: 0, y: 0, w: 1, h: 1 })
                        }}
                        className="text-[11px] text-[#2383E2] hover:underline cursor-pointer"
                      >
                        Restablecer
                      </button>
                    </div>
                    <div className="grid grid-cols-4 gap-1.5">
                      <button
                        type="button"
                        onClick={() => applyCropAspectRatio(null)}
                        className={`py-1.5 rounded-md border text-[11px] font-medium transition cursor-pointer ${
                          lockedRatio === null
                            ? 'bg-[#2383E2] text-white border-[#2383E2]'
                            : 'border-[var(--app-border)] hover:bg-black/5 dark:hover:bg-white/5'
                        }`}
                      >
                        Libre
                      </button>
                      {ASPECT_RATIO_OPTIONS.filter((a) => a.ratio !== null).map((opt) => (
                        <button
                          key={opt.id}
                          type="button"
                          onClick={() => applyCropAspectRatio(opt.ratio)}
                          className={`py-1.5 rounded-md border text-[11px] font-medium transition cursor-pointer ${
                            lockedRatio === opt.ratio
                              ? 'bg-[#2383E2] text-white border-[#2383E2]'
                              : 'border-[var(--app-border)] hover:bg-black/5 dark:hover:bg-white/5'
                          }`}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <span className="font-semibold text-[11px] uppercase tracking-wider text-[var(--app-text-secondary)]">
                      Rotar y voltear
                    </span>
                    <div className="grid grid-cols-4 gap-1.5">
                      <button
                        type="button"
                        onClick={() => setRotation((r) => (r - 90 + 360) % 360)}
                        className="py-2 rounded-md border border-[var(--app-border)] hover:bg-black/5 dark:hover:bg-white/5 flex flex-col items-center gap-1 cursor-pointer"
                        title="Rotar 90° izquierda"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        <span className="text-[10px]">-90°</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setRotation((r) => (r + 90) % 360)}
                        className="py-2 rounded-md border border-[var(--app-border)] hover:bg-black/5 dark:hover:bg-white/5 flex flex-col items-center gap-1 cursor-pointer"
                        title="Rotar 90° derecha"
                      >
                        <RotateCw className="w-3.5 h-3.5" />
                        <span className="text-[10px]">+90°</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setFlipH((f) => !f)}
                        className={`py-2 rounded-md border flex flex-col items-center gap-1 cursor-pointer ${
                          flipH
                            ? 'bg-[#2383E2]/15 border-[#2383E2] text-[#2383E2]'
                            : 'border-[var(--app-border)] hover:bg-black/5 dark:hover:bg-white/5'
                        }`}
                        title="Voltear horizontal"
                      >
                        <FlipHorizontal2 className="w-3.5 h-3.5" />
                        <span className="text-[10px]">Espejo H</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setFlipV((f) => !f)}
                        className={`py-2 rounded-md border flex flex-col items-center gap-1 cursor-pointer ${
                          flipV
                            ? 'bg-[#2383E2]/15 border-[#2383E2] text-[#2383E2]'
                            : 'border-[var(--app-border)] hover:bg-black/5 dark:hover:bg-white/5'
                        }`}
                        title="Voltear vertical"
                      >
                        <FlipVertical2 className="w-3.5 h-3.5" />
                        <span className="text-[10px]">Espejo V</span>
                      </button>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="font-medium">Enderezar ángulo</span>
                      <span className="text-[11px] text-[var(--app-text-secondary)]">{straighten}°</span>
                    </div>
                    <input
                      type="range"
                      min={-45}
                      max={45}
                      step={1}
                      value={straighten}
                      onChange={(e) => setStraighten(Number(e.target.value))}
                      className="w-full accent-[#2383E2]"
                    />
                  </div>

                  <div className="space-y-2">
                    <span className="font-semibold text-[11px] uppercase tracking-wider text-[var(--app-text-secondary)]">
                      Máscara de forma
                    </span>
                    <div className="grid grid-cols-3 gap-1.5">
                      {(
                        [
                          { id: 'none', label: 'Recto' },
                          { id: 'rounded', label: 'Redondeado' },
                          { id: 'circle', label: 'Circular' }
                        ] as const
                      ).map((m) => (
                        <button
                          key={m.id}
                          type="button"
                          onClick={() => setShapeMask(m.id)}
                          className={`py-1.5 rounded-md border text-[11px] font-medium transition cursor-pointer ${
                            shapeMask === m.id
                              ? 'bg-[#2383E2] text-white border-[#2383E2]'
                              : 'border-[var(--app-border)] hover:bg-black/5 dark:hover:bg-white/5'
                          }`}
                        >
                          {m.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </>
              )}

              {/* TAB 2: BACKGROUND REMOVAL */}
              {activeTab === 'bg' && (
                <>
                  <div className="space-y-2">
                    <button
                      type="button"
                      disabled={isRemovingBg}
                      onClick={handleAutoRemoveBg}
                      className="w-full py-2.5 px-3 rounded-lg bg-[#2383E2] hover:bg-[#1c72c8] text-white font-semibold text-xs flex items-center justify-center gap-2 shadow-sm transition cursor-pointer disabled:opacity-50"
                    >
                      {isRemovingBg ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Wand2 className="w-4 h-4" />
                      )}
                      <span>{isRemovingBg ? 'Recortando fondo...' : 'Quitar fondo automático'}</span>
                    </button>

                    {alphaMask && (
                      <button
                        type="button"
                        onClick={() => commitMask(null)}
                        className="w-full py-1.5 px-3 rounded-lg border border-[var(--app-border)] hover:bg-black/5 dark:hover:bg-white/5 text-[11px] font-medium flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        <RefreshCw className="w-3.5 h-3.5" />
                        <span>Restaurar fondo original</span>
                      </button>
                    )}
                  </div>

                  <div className="space-y-2">
                    <span className="font-semibold text-[11px] uppercase tracking-wider text-[var(--app-text-secondary)]">
                      Herramienta de recorte
                    </span>
                    <div className="grid grid-cols-3 gap-1.5">
                      {(
                        [
                          { id: 'wand', label: 'Varita', icon: Wand2 },
                          { id: 'erase', label: 'Borrar', icon: Eraser },
                          { id: 'restore', label: 'Restaurar', icon: Paintbrush }
                        ] as Array<{ id: BgTool; label: string; icon: any }>
                      ).map(({ id, label, icon: Icon }) => (
                        <button
                          key={id}
                          type="button"
                          onClick={() => setBgTool(id)}
                          className={`py-2 rounded-md border flex flex-col items-center gap-1 text-[11px] font-medium transition cursor-pointer ${
                            bgTool === id
                              ? 'bg-[#2383E2]/15 border-[#2383E2] text-[#2383E2]'
                              : 'border-[var(--app-border)] hover:bg-black/5 dark:hover:bg-white/5'
                          }`}
                        >
                          <Icon className="w-3.5 h-3.5" />
                          <span>{label}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {bgTool === 'wand' ? (
                    <div className="space-y-3">
                      <div className="space-y-1">
                        <div className="flex justify-between">
                          <span>Tolerancia de color</span>
                          <span className="text-[var(--app-text-secondary)]">{bgTolerance}%</span>
                        </div>
                        <input
                          type="range"
                          min={5}
                          max={90}
                          value={bgTolerance}
                          onChange={(e) => setBgTolerance(Number(e.target.value))}
                          className="w-full accent-[#2383E2]"
                        />
                      </div>

                      <div className="space-y-1">
                        <div className="flex justify-between">
                          <span>Suavizado de bordes</span>
                          <span className="text-[var(--app-text-secondary)]">{bgFeather} px</span>
                        </div>
                        <input
                          type="range"
                          min={0}
                          max={6}
                          value={bgFeather}
                          onChange={(e) => setBgFeather(Number(e.target.value))}
                          className="w-full accent-[#2383E2]"
                        />
                      </div>

                      <label className="flex items-center justify-between gap-2 cursor-pointer py-1">
                        <span className="text-[11px]">Solo zona conectada (contiguo)</span>
                        <input
                          type="checkbox"
                          checked={bgContiguous}
                          onChange={(e) => setBgContiguous(e.target.checked)}
                          className="accent-[#2383E2] w-4 h-4"
                        />
                      </label>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <div className="space-y-1">
                        <div className="flex justify-between">
                          <span>Tamaño de pincel</span>
                          <span className="text-[var(--app-text-secondary)]">{brushSize} px</span>
                        </div>
                        <input
                          type="range"
                          min={6}
                          max={90}
                          value={brushSize}
                          onChange={(e) => setBrushSize(Number(e.target.value))}
                          className="w-full accent-[#2383E2]"
                        />
                      </div>
                      <div className="space-y-1">
                        <div className="flex justify-between">
                          <span>Suavidad del pincel</span>
                          <span className="text-[var(--app-text-secondary)]">{Math.round(brushSoftness * 100)}%</span>
                        </div>
                        <input
                          type="range"
                          min={0}
                          max={100}
                          value={Math.round(brushSoftness * 100)}
                          onChange={(e) => setBrushSoftness(Number(e.target.value) / 100)}
                          className="w-full accent-[#2383E2]"
                        />
                      </div>
                    </div>
                  )}

                  {/* Replacement Background */}
                  <div className="space-y-2.5 pt-2 border-t border-[var(--app-border)]">
                    <span className="font-semibold text-[11px] uppercase tracking-wider text-[var(--app-text-secondary)]">
                      Fondo de reemplazo
                    </span>
                    <div className="flex flex-wrap gap-1.5 items-center">
                      {/* Transparent swatch */}
                      <button
                        type="button"
                        onClick={() => setReplacementBg({ type: 'transparent', color: '#FFFFFF' })}
                        className={`w-7 h-7 rounded-md border transition cursor-pointer ${
                          replacementBg.type === 'transparent'
                            ? 'ring-2 ring-[#2383E2] border-[#2383E2]'
                            : 'border-[var(--app-border)]'
                        }`}
                        style={{
                          backgroundImage:
                            'linear-gradient(45deg, #ccc 25%, transparent 25%), linear-gradient(-45deg, #ccc 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #ccc 75%), linear-gradient(-45deg, transparent 75%, #ccc 75%)',
                          backgroundSize: '8px 8px',
                          backgroundPosition: '0 0, 0 4px, 4px -4px, -4px 0px'
                        }}
                        title="Transparente (PNG/WebP)"
                      />
                      {BG_SOLID_SWATCHES.map((s) => (
                        <button
                          key={s.color}
                          type="button"
                          onClick={() => setReplacementBg({ type: 'solid', color: s.color })}
                          className={`w-7 h-7 rounded-md border transition cursor-pointer ${
                            replacementBg.type === 'solid' && replacementBg.color === s.color
                              ? 'ring-2 ring-[#2383E2] border-[#2383E2]'
                              : 'border-[var(--app-border)]'
                          }`}
                          style={{ backgroundColor: s.color }}
                          title={s.label}
                        />
                      ))}
                      <label
                        className="w-7 h-7 rounded-md border border-[var(--app-border)] overflow-hidden cursor-pointer flex items-center justify-center text-[10px]"
                        title="Color personalizado"
                      >
                        <input
                          type="color"
                          value={replacementBg.color}
                          onChange={(e) => setReplacementBg({ type: 'solid', color: e.target.value })}
                          className="w-9 h-9 cursor-pointer border-0 p-0"
                        />
                      </label>
                    </div>

                    <div className="grid grid-cols-4 gap-1.5">
                      {BG_GRADIENTS.map((g) => (
                        <button
                          key={g.label}
                          type="button"
                          onClick={() =>
                            setReplacementBg({ type: 'gradient', color: g.start, gradientEnd: g.end })
                          }
                          className={`h-7 rounded-md border text-[10px] font-medium transition cursor-pointer ${
                            replacementBg.type === 'gradient' &&
                            replacementBg.color === g.start &&
                            replacementBg.gradientEnd === g.end
                              ? 'ring-2 ring-[#2383E2] border-[#2383E2]'
                              : 'border-[var(--app-border)]'
                          }`}
                          style={{ background: `linear-gradient(135deg, ${g.start}, ${g.end})` }}
                          title={`Degradado ${g.label}`}
                        />
                      ))}
                    </div>
                  </div>
                </>
              )}

              {/* TAB 3: ADJUSTMENTS */}
              {activeTab === 'adjust' && (
                <>
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-[11px] uppercase tracking-wider text-[var(--app-text-secondary)]">
                      Luz y Color
                    </span>
                    <button
                      type="button"
                      onClick={() => setAdjustments(DEFAULT_ADJUSTMENTS)}
                      className="text-[11px] text-[#2383E2] hover:underline cursor-pointer"
                    >
                      Restablecer
                    </button>
                  </div>

                  {(
                    [
                      { key: 'brightness', label: 'Brillo', min: 20, max: 200, unit: '%' },
                      { key: 'contrast', label: 'Contraste', min: 20, max: 200, unit: '%' },
                      { key: 'saturate', label: 'Saturación', min: 0, max: 200, unit: '%' },
                      { key: 'warmth', label: 'Temperatura', min: -100, max: 100, unit: '' },
                      { key: 'hue', label: 'Matiz', min: -180, max: 180, unit: '°' },
                      { key: 'blur', label: 'Desenfoque', min: 0, max: 16, unit: 'px' },
                      { key: 'vignette', label: 'Viñeta', min: 0, max: 100, unit: '%' },
                      { key: 'opacity', label: 'Opacidad', min: 15, max: 100, unit: '%' }
                    ] as Array<{
                      key: keyof ImageAdjustments
                      label: string
                      min: number
                      max: number
                      unit: string
                    }>
                  ).map((slider) => (
                    <div key={slider.key} className="space-y-1">
                      <div className="flex justify-between text-[11px]">
                        <span>{slider.label}</span>
                        <span className="text-[var(--app-text-secondary)] tabular-nums">
                          {adjustments[slider.key]}
                          {slider.unit}
                        </span>
                      </div>
                      <input
                        type="range"
                        min={slider.min}
                        max={slider.max}
                        value={adjustments[slider.key]}
                        onChange={(e) =>
                          setAdjustments((prev) => ({
                            ...prev,
                            [slider.key]: Number(e.target.value)
                          }))
                        }
                        className="w-full accent-[#2383E2]"
                      />
                    </div>
                  ))}
                </>
              )}

              {/* TAB 4: FILTERS */}
              {activeTab === 'filters' && (
                <div className="grid grid-cols-2 gap-2">
                  {IMAGE_FILTER_PRESETS.map((preset) => {
                    const isActive = filterPresetId === preset.id
                    return (
                      <button
                        key={preset.id}
                        type="button"
                        onClick={() => setFilterPresetId(preset.id)}
                        className={`rounded-lg border overflow-hidden text-left transition cursor-pointer ${
                          isActive
                            ? 'border-[#2383E2] ring-2 ring-[#2383E2]/30'
                            : 'border-[var(--app-border)] hover:border-[var(--app-text-secondary)]'
                        }`}
                      >
                        <div className="h-16 w-full overflow-hidden bg-black/10">
                          <img
                            src={imageSrc}
                            alt={preset.label}
                            className="w-full h-full object-cover"
                            style={{ filter: preset.css === 'none' ? undefined : preset.css }}
                          />
                        </div>
                        <div className="px-2 py-1 text-[11px] font-medium truncate">{preset.label}</div>
                      </button>
                    )
                  })}
                </div>
              )}

              {/* TAB 5: ANNOTATE */}
              {activeTab === 'annotate' && (
                <>
                  <div className="space-y-2">
                    <span className="font-semibold text-[11px] uppercase tracking-wider text-[var(--app-text-secondary)]">
                      Herramienta
                    </span>
                    <div className="grid grid-cols-3 gap-1.5">
                      {(
                        [
                          { id: 'pen', label: 'Lápiz', icon: Pencil },
                          { id: 'highlighter', label: 'Resaltar', icon: Highlighter },
                          { id: 'arrow', label: 'Flecha', icon: ArrowUpRight },
                          { id: 'rect', label: 'Caja', icon: Square },
                          { id: 'circle', label: 'Círculo', icon: Circle },
                          { id: 'text', label: 'Texto', icon: Type }
                        ] as Array<{ id: AnnotationTool; label: string; icon: any }>
                      ).map(({ id, label, icon: Icon }) => (
                        <button
                          key={id}
                          type="button"
                          onClick={() => setAnnotationTool(id)}
                          className={`py-2 rounded-md border flex flex-col items-center gap-1 text-[11px] font-medium transition cursor-pointer ${
                            annotationTool === id
                              ? 'bg-[#2383E2]/15 border-[#2383E2] text-[#2383E2]'
                              : 'border-[var(--app-border)] hover:bg-black/5 dark:hover:bg-white/5'
                          }`}
                        >
                          <Icon className="w-3.5 h-3.5" />
                          <span>{label}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <span className="font-semibold text-[11px] uppercase tracking-wider text-[var(--app-text-secondary)]">
                      Color
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {ANNOTATION_COLORS.map((c) => (
                        <button
                          key={c}
                          type="button"
                          onClick={() => setAnnotationColor(c)}
                          className={`w-7 h-7 rounded-md border transition cursor-pointer ${
                            annotationColor === c
                              ? 'ring-2 ring-[#2383E2] border-[#2383E2] scale-105'
                              : 'border-[var(--app-border)]'
                          }`}
                          style={{ backgroundColor: c }}
                        />
                      ))}
                    </div>
                  </div>

                  <div className="space-y-1">
                    <div className="flex justify-between text-[11px]">
                      <span>Grosor / Tamaño</span>
                      <span className="text-[var(--app-text-secondary)]">{annotationSize}</span>
                    </div>
                    <input
                      type="range"
                      min={2}
                      max={20}
                      value={annotationSize}
                      onChange={(e) => setAnnotationSize(Number(e.target.value))}
                      className="w-full accent-[#2383E2]"
                    />
                  </div>

                  {annotations.length > 0 && (
                    <button
                      type="button"
                      onClick={() => {
                        setAnnotations([])
                        setAnnotationRedo([])
                      }}
                      className="w-full py-1.5 rounded-md border border-rose-500/30 text-rose-500 hover:bg-rose-500/10 text-[11px] font-medium flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Borrar todas las anotaciones ({annotations.length})</span>
                    </button>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )

  return createPortal(modalContent, document.body)
}
