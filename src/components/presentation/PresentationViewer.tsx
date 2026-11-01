import { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import {
  CloseIcon,
  ArrowLeftSmallIcon,
  ArrowRightSmallIcon,
  ExpandFullIcon,
  ExpandCloseIcon,
  PlayIcon,
  PausePanelIcon,
  ResetIcon,
  AllDocsIcon,
  AiIcon,
  DoneIcon,
  PageIcon
} from '@blocksuite/icons/rc'
import {
  ExternalLink,
  Globe,
  Play,
  Folder,
  Sparkles,
  FileText,
  Film,
  Skull,
  MessageSquare,
  CheckSquare,
  Square,
  ChevronRight,
  Pencil,
  Highlighter,
  Eraser,
  Type,
  Move,
  Trash2,
  Undo2,
  Plus,
  Grid
} from 'lucide-react'
import { toast } from 'sonner'
import { db, type WorkspaceItem, type CanvasNodeItem, type CanvasEdgeItem } from '../../db'
import { syncEngine } from '../../lib/syncEngine'
import { renderWithAppleEmoji, AppleEmoji } from '../ui/AppleEmoji'

interface PresentationViewerProps {
  isOpen: boolean
  onClose: () => void
  workspace: WorkspaceItem | undefined
  nodes?: CanvasNodeItem[]
  initialFrameId?: string
}

interface SlideItem {
  id: string
  title: string
  type: 'frame' | 'heading' | 'intro'
  frameIndex?: number
  frameX?: number
  frameY?: number
  frameW?: number
  frameH?: number
  frameBgStyle?: 'default' | 'dark' | 'gradient' | 'dots' | 'glass' | 'grid' | 'plain' | 'lines' | 'none'
  hideHeader?: boolean
  speakerNotes?: string
  contentHtml?: string
  nodes?: CanvasNodeItem[]
  edges?: CanvasEdgeItem[]
}

interface SlideStroke {
  color: string
  width: number
  isHighlighter?: boolean
  points: Array<{ x: number; y: number }>
}

type SlideEditTool = 'select' | 'pen' | 'highlighter' | 'eraser'

const PEN_COLORS = ['#ef4444', '#f59e0b', '#10b981', '#3b82f6', '#ec4899', '#ffffff']

function getNodeEstSize(n: CanvasNodeItem): { w: number; h: number } {
  const w = n.data?.width || n.width
  const h = n.data?.height || n.height

  switch (n.type) {
    case 'note':
      return { w: w || 280, h: h || 140 }
    case 'todo': {
      const count = n.data?.todos?.length || 2
      return { w: w || 290, h: h || 110 + count * 28 }
    }
    case 'link':
      return { w: w || 280, h: h || (n.data?.imageUrl ? 220 : 100) }
    case 'subboard':
      if (n.data?.isStandalone) return { w: 100, h: 110 }
      return { w: w || 280, h: h || 240 }
    case 'image':
      return { w: w || 280, h: h || 200 }
    case 'shape':
      return { w: w || 180, h: h || 120 }
    case 'text':
      return { w: w || 200, h: h || 50 }
    case 'mindmap':
      return { w: w || 180, h: h || 48 }
    case 'colorPalette': {
      const count = n.data?.swatches?.length || n.data?.paletteColors?.length || 3
      return { w: 180, h: count * 135 }
    }
    case 'table': {
      const rows = n.data?.rows?.length || 2
      return { w: w || 320, h: h || 100 + rows * 32 }
    }
    case 'comment':
      return { w: 280, h: 130 }
    case 'docframe':
      return { w: 340, h: 160 }
    default:
      return { w: w || 260, h: h || 130 }
  }
}

function getHandleAnchor(
  node: CanvasNodeItem,
  handleId: string | null | undefined,
  defaultSide: 'source' | 'target',
  originX: number,
  originY: number,
  dragOffset?: { dx: number; dy: number }
): { x: number; y: number } {
  const { w, h } = getNodeEstSize(node)
  const dx = dragOffset ? dragOffset.dx : 0
  const dy = dragOffset ? dragOffset.dy : 0
  const nx = node.positionX + dx - originX
  const ny = node.positionY + dy - originY

  const side = handleId || (defaultSide === 'source' ? 'right' : 'left')
  switch (side) {
    case 'top':
      return { x: nx + w / 2, y: ny }
    case 'bottom':
      return { x: nx + w / 2, y: ny + h }
    case 'left':
      return { x: nx, y: ny + h / 2 }
    case 'right':
    default:
      return { x: nx + w, y: ny + h / 2 }
  }
}

function buildEdgePath(
  sx: number,
  sy: number,
  tx: number,
  ty: number,
  edgeType?: string,
  sourceHandle?: string | null,
  targetHandle?: string | null
): string {
  if (edgeType === 'straight') {
    return `M ${sx} ${sy} L ${tx} ${ty}`
  }

  const dx = Math.abs(tx - sx) * 0.5
  const dy = Math.abs(ty - sy) * 0.5
  const offset = Math.max(40, Math.min(140, Math.max(dx, dy)))

  const sSide = sourceHandle || 'right'
  const tSide = targetHandle || 'left'

  const c1x = sSide === 'left' ? sx - offset : sSide === 'right' ? sx + offset : sx
  const c1y = sSide === 'top' ? sy - offset : sSide === 'bottom' ? sy + offset : sy

  const c2x = tSide === 'left' ? tx - offset : tSide === 'right' ? tx + offset : tx
  const c2y = tSide === 'top' ? ty - offset : tSide === 'bottom' ? ty + offset : ty

  return `M ${sx} ${sy} C ${c1x} ${c1y}, ${c2x} ${c2y}, ${tx} ${ty}`
}

function getContrastColor(hex: string): string {
  const cleanHex = hex.replace('#', '')
  if (cleanHex.length !== 6) return '#000000'
  const r = parseInt(cleanHex.substring(0, 2), 16)
  const g = parseInt(cleanHex.substring(2, 4), 16)
  const b = parseInt(cleanHex.substring(4, 6), 16)
  const yiq = (r * 299 + g * 587 + b * 114) / 1000
  return yiq >= 140 ? '#000000' : '#ffffff'
}

export function PresentationViewer({
  isOpen,
  onClose,
  workspace,
  nodes,
  initialFrameId
}: PresentationViewerProps) {
  const [currentSlideIndex, setCurrentSlideIndex] = useState(0)
  const [isLaserPointerActive, setIsLaserPointerActive] = useState(false)
  const [laserPos, setLaserPos] = useState({ x: -100, y: -100 })
  const [isBlackout, setIsBlackout] = useState(false)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [showSpeakerNotes, setShowSpeakerNotes] = useState(false)

  // Presentation Interactive Editing Tools State
  const [editTool, setEditTool] = useState<SlideEditTool>('select')
  const [penColor, setPenColor] = useState('#ef4444')
  const [penWidth, setPenWidth] = useState(3)
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null)
  const [editingNodeId, setEditingNodeId] = useState<string | null>(null)

  // Real-time drag state for moving nodes
  const [dragOffset, setDragOffset] = useState<{ id: string; dx: number; dy: number } | null>(null)
  const dragRef = useRef<{ id: string; dx: number; dy: number } | null>(null)
  dragRef.current = dragOffset

  // Slide freehand drawings per slide ID
  const [slideDrawings, setSlideDrawings] = useState<Record<string, SlideStroke[]>>(() => {
    try {
      if (typeof window !== 'undefined' && workspace?.id) {
        const saved = localStorage.getItem(`seven_note_slide_drawings_${workspace.id}`)
        if (saved) return JSON.parse(saved)
      }
    } catch (e) {}
    return {}
  })

  // Persist slide drawings
  useEffect(() => {
    if (workspace?.id && typeof window !== 'undefined') {
      try {
        localStorage.setItem(`seven_note_slide_drawings_${workspace.id}`, JSON.stringify(slideDrawings))
      } catch (e) {}
    }
  }, [slideDrawings, workspace?.id])

  // Canvas grid style tracking (dots, lines/cuadrícula, none/liso)
  const [liveGridVariant, setLiveGridVariant] = useState<'dots' | 'lines' | 'none'>(() => {
    try {
      if (typeof window !== 'undefined') {
        const saved =
          (workspace?.id && localStorage.getItem(`seven-note-canvas-grid-${workspace.id}`)) ||
          (workspace as any)?.canvasGridVariant ||
          localStorage.getItem('seven-note-canvas-grid')
        if (saved === 'lines') return 'lines'
        if (saved === 'none') return 'none'
      }
    } catch (e) {}
    return (workspace as any)?.canvasGridVariant || 'dots'
  })

  useEffect(() => {
    if ((workspace as any)?.canvasGridVariant) {
      setLiveGridVariant((workspace as any).canvasGridVariant)
    }
  }, [(workspace as any)?.canvasGridVariant])

  useEffect(() => {
    const onGridChange = (e: any) => {
      if (e.detail?.grid) {
        setLiveGridVariant(e.detail.grid)
      }
    }
    window.addEventListener('seven-note-grid-changed', onGridChange)
    return () => window.removeEventListener('seven-note-grid-changed', onGridChange)
  }, [])

  const handleCycleGridVariant = async () => {
    const next: 'dots' | 'lines' | 'none' =
      liveGridVariant === 'dots' ? 'lines' : liveGridVariant === 'lines' ? 'none' : 'dots'
    setLiveGridVariant(next)
    if (workspace?.id) {
      localStorage.setItem(`seven-note-canvas-grid-${workspace.id}`, next)
    }
    localStorage.setItem('seven-note-canvas-grid', next)
    window.dispatchEvent(
      new CustomEvent('seven-note-grid-changed', {
        detail: { grid: next, workspaceId: workspace?.id }
      })
    )
    if (workspace?.id) {
      try {
        await db.workspaces.update(workspace.id, {
          canvasGridVariant: next,
          updatedAt: Date.now(),
          syncStatus: 'pending'
        })
        syncEngine.scheduleSync(1200)
      } catch (e) {}
    }
    toast.info(
      next === 'lines'
        ? 'Estilo de diapositiva: Cuadrícula'
        : next === 'none'
        ? 'Estilo de diapositiva: Liso'
        : 'Estilo de diapositiva: Puntos'
    )
  }

  // Drawing Canvas State
  const drawingCanvasRef = useRef<HTMLCanvasElement | null>(null)
  const isDrawingRef = useRef(false)
  const currentStrokeRef = useRef<SlideStroke | null>(null)

  // Query nodes & edges lazily only when presentation is open
  const queriedNodes = useLiveQuery<CanvasNodeItem[]>(
    () =>
      isOpen && workspace?.id
        ? db.canvasNodes
            .where('workspaceId')
            .equals(workspace.id)
            .and((n) => !n.isDeleted)
            .toArray()
        : Promise.resolve<CanvasNodeItem[]>([]),
    [isOpen, workspace?.id]
  ) ?? []

  const queriedEdges = useLiveQuery<CanvasEdgeItem[]>(
    () =>
      isOpen && workspace?.id
        ? db.canvasEdges
            .where('workspaceId')
            .equals(workspace.id)
            .and((e) => !e.isDeleted)
            .toArray()
        : Promise.resolve<CanvasEdgeItem[]>([]),
    [isOpen, workspace?.id]
  ) ?? []

  const effectiveNodes = nodes ?? queriedNodes
  const [showThumbnails, setShowThumbnails] = useState(false)

  // Presentation Timer state
  const [timerSeconds, setTimerSeconds] = useState(0)
  const [isTimerRunning, setIsTimerRunning] = useState(true)

  const containerRef = useRef<HTMLDivElement | null>(null)
  const stageContainerRef = useRef<HTMLDivElement | null>(null)
  const [stageBounds, setStageBounds] = useState({ width: 960, height: 600 })
  const currentScaleRef = useRef(1)

  // Observe stage area size to compute exact responsive scale for canvas frame
  useEffect(() => {
    if (!isOpen) return
    const updateSize = () => {
      if (stageContainerRef.current) {
        const rect = stageContainerRef.current.getBoundingClientRect()
        if (rect.width > 0 && rect.height > 0) {
          setStageBounds({ width: rect.width, height: rect.height })
        }
      }
    }
    updateSize()
    const timer = setTimeout(updateSize, 50)
    const ro = new ResizeObserver(updateSize)
    if (stageContainerRef.current) {
      ro.observe(stageContainerRef.current)
    }
    window.addEventListener('resize', updateSize)
    return () => {
      clearTimeout(timer)
      ro.disconnect()
      window.removeEventListener('resize', updateSize)
    }
  }, [isOpen, currentSlideIndex, showSpeakerNotes, editTool])

  // Timer interval
  useEffect(() => {
    let interval: any = null
    if (isOpen && isTimerRunning) {
      interval = setInterval(() => {
        setTimerSeconds((prev) => prev + 1)
      }, 1000)
    }
    return () => {
      if (interval) clearInterval(interval)
    }
  }, [isOpen, isTimerRunning])

  // Build presentation slides
  const slides: SlideItem[] = useMemo(() => {
    if (!workspace) return []

    // 1. Check for canvas frames
    const frameNodes = effectiveNodes
      .filter((n) => n.type === 'frame' && !n.isDeleted)
      .sort((a, b) => (a.data.frameIndex || 0) - (b.data.frameIndex || 0))

    if (frameNodes.length > 0) {
      return frameNodes.map((frame, idx) => {
        const frameW = frame.data.width || 640
        const frameH = frame.data.height || 420
        const fx1 = frame.positionX
        const fy1 = frame.positionY
        const fx2 = fx1 + frameW
        const fy2 = fy1 + frameH

        // Find canvas nodes inside or overlapping this frame
        const insideNodes = effectiveNodes.filter((n) => {
          if (n.id === frame.id || n.type === 'frame' || n.isDeleted) return false

          // 1. Explicitly bound to this frame
          if (n.data?.frameId) {
            return n.data.frameId === frame.id
          }

          // 2. Spatial geometric check with generous boundary buffer
          const { w: nw, h: nh } = getNodeEstSize(n)
          const cx = n.positionX + nw / 2
          const cy = n.positionY + nh / 2
          const centerInside = cx >= fx1 - 50 && cx <= fx2 + 50 && cy >= fy1 - 50 && cy <= fy2 + 50
          const overlapInside =
            n.positionX < fx2 + 50 &&
            n.positionX + nw > fx1 - 50 &&
            n.positionY < fy2 + 50 &&
            n.positionY + nh > fy1 - 50
          return centerInside || overlapInside
        })

        const insideIds = new Set(insideNodes.map((n) => n.id))
        const insideEdges = queriedEdges.filter(
          (e) => !e.isDeleted && insideIds.has(e.source) && insideIds.has(e.target)
        )

        return {
          id: frame.id,
          title: frame.data.title || frame.data.frameTitle || `Diapositiva #${idx + 1}`,
          type: 'frame',
          frameIndex: frame.data.frameIndex || idx + 1,
          frameX: fx1,
          frameY: fy1,
          frameW,
          frameH,
          frameBgStyle: frame.data.frameBgStyle || 'default',
          hideHeader: frame.data.hideHeaderInPresentation ?? false,
          speakerNotes: frame.data.speakerNotes || '',
          nodes: insideNodes,
          edges: insideEdges
        }
      })
    }

    // 2. Fallback: Parse document headings to create automatic slides
    const resultSlides: SlideItem[] = []

    // Slide 1: Title slide
    resultSlides.push({
      id: 'slide-intro',
      title: workspace.title || 'Presentación',
      type: 'intro',
      contentHtml: `<div class="text-center py-12"><h1 class="text-5xl font-extrabold tracking-tight mb-4 text-white">${
        workspace.title || 'Untitled'
      }</h1><p class="text-lg text-zinc-400">Presentación generada desde Seven Note</p></div>`
    })

    // Parse headings from HTML docContent
    if (workspace.docContent) {
      const parser = new DOMParser()
      const doc = parser.parseFromString(workspace.docContent, 'text/html')
      const headings = Array.from(doc.querySelectorAll('h1, h2, h3'))

      if (headings.length > 0) {
        headings.forEach((heading, idx) => {
          let sectionHtml = ''
          let sibling = heading.nextElementSibling
          while (sibling && !['H1', 'H2', 'H3'].includes(sibling.tagName)) {
            sectionHtml += sibling.outerHTML
            sibling = sibling.nextElementSibling
          }

          resultSlides.push({
            id: `slide-h-${idx}`,
            title: heading.textContent?.trim() || `Sección ${idx + 1}`,
            type: 'heading',
            contentHtml: `<h2 class="text-3xl font-bold text-white mb-6 border-b border-zinc-700/60 pb-3">${heading.textContent}</h2><div class="prose prose-invert max-w-none text-zinc-300 text-base leading-relaxed">${sectionHtml}</div>`
          })
        })
      }
    }

    // If there are canvas nodes without frames, compute their bounding box and show them as a board slide
    const canvasCards = effectiveNodes.filter((n) => !n.isDeleted && n.type !== 'docframe' && n.type !== 'frame')
    if (resultSlides.length === 1 && canvasCards.length > 0) {
      let minX = Infinity
      let minY = Infinity
      let maxX = -Infinity
      let maxY = -Infinity

      for (const n of canvasCards) {
        const { w, h } = getNodeEstSize(n)
        minX = Math.min(minX, n.positionX)
        minY = Math.min(minY, n.positionY)
        maxX = Math.max(maxX, n.positionX + w)
        maxY = Math.max(maxY, n.positionY + h)
      }

      const pad = 40
      const boxX = minX - pad
      const boxY = minY - pad
      const boxW = Math.max(640, maxX - minX + pad * 2)
      const boxH = Math.max(420, maxY - minY + pad * 2)
      const cardIds = new Set(canvasCards.map((n) => n.id))

      resultSlides.push({
        id: 'slide-cards',
        title: 'Tablero Visual',
        type: 'frame',
        frameX: boxX,
        frameY: boxY,
        frameW: boxW,
        frameH: boxH,
        nodes: canvasCards,
        edges: queriedEdges.filter((e) => !e.isDeleted && cardIds.has(e.source) && cardIds.has(e.target))
      })
    }

    return resultSlides
  }, [workspace, effectiveNodes, queriedEdges])

  // If initialFrameId is provided, jump to it
  useEffect(() => {
    if (initialFrameId && slides.length > 0) {
      const idx = slides.findIndex((s) => s.id === initialFrameId)
      if (idx !== -1) {
        setCurrentSlideIndex(idx)
      }
    }
  }, [initialFrameId, slides.length])

  // Listen for native fullscreen changes (e.g. Esc or F11 pressed by user)
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement)
    }
    document.addEventListener('fullscreenchange', handleFullscreenChange)
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange)
  }, [])

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {})
      setIsFullscreen(true)
    } else {
      document.exitFullscreen().catch(() => {})
      setIsFullscreen(false)
    }
  }

  // Keyboard navigation (with guard so typing in inputs doesn't change slides!)
  useEffect(() => {
    if (!isOpen) return

    const handleKeyDown = (e: KeyboardEvent) => {
      // Guard against typing in input/textarea
      const activeEl = document.activeElement
      const isInputActive =
        activeEl &&
        (activeEl.tagName === 'INPUT' ||
          activeEl.tagName === 'TEXTAREA' ||
          (activeEl as HTMLElement).isContentEditable)

      if (isInputActive) {
        if (e.key === 'Escape') {
          setEditingNodeId(null)
          ;(activeEl as HTMLElement).blur()
        }
        return
      }

      if (e.key === 'Escape') {
        if (document.fullscreenElement) {
          document.exitFullscreen().catch(() => {})
          setIsFullscreen(false)
          return
        }
        if (isFullscreen) {
          setIsFullscreen(false)
          return
        }
        if (editingNodeId) {
          setEditingNodeId(null)
        } else if (selectedNodeId) {
          setSelectedNodeId(null)
        } else if (editTool !== 'select') {
          setEditTool('select')
        } else {
          onClose()
        }
      } else if (e.key === 'ArrowRight' || e.key === ' ' || e.key === 'PageDown') {
        e.preventDefault()
        setCurrentSlideIndex((prev) => Math.min(slides.length - 1, prev + 1))
      } else if (e.key === 'ArrowLeft' || e.key === 'PageUp' || e.key === 'Backspace') {
        e.preventDefault()
        setCurrentSlideIndex((prev) => Math.max(0, prev - 1))
      } else if (e.key === 'Home') {
        setCurrentSlideIndex(0)
      } else if (e.key === 'End') {
        setCurrentSlideIndex(slides.length - 1)
      } else if (e.key.toLowerCase() === 'b') {
        setIsBlackout((prev) => !prev)
      } else if (e.key.toLowerCase() === 'l') {
        setIsLaserPointerActive((prev) => !prev)
      } else if (e.key.toLowerCase() === 'f') {
        toggleFullscreen()
      } else if (e.key.toLowerCase() === 'n') {
        setShowSpeakerNotes((prev) => !prev)
      } else if (e.key.toLowerCase() === 'v') {
        setEditTool('select')
      } else if (e.key.toLowerCase() === 'p') {
        setEditTool('pen')
      } else if (e.key.toLowerCase() === 'h') {
        setEditTool('highlighter')
      } else if (e.key.toLowerCase() === 'e') {
        setEditTool('eraser')
      } else if (e.key.toLowerCase() === 't') {
        handleAddText()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, slides.length, onClose, editingNodeId, selectedNodeId, editTool, isFullscreen])

  // Mouse move for laser pointer
  const handleMouseMove = (e: React.MouseEvent) => {
    if (isLaserPointerActive) {
      setLaserPos({ x: e.clientX, y: e.clientY })
    }
  }

  // Format timer seconds into mm:ss
  const formatTimer = (secs: number) => {
    const mins = Math.floor(secs / 60)
    const rem = secs % 60
    return `${mins.toString().padStart(2, '0')}:${rem.toString().padStart(2, '0')}`
  }

  const currentSlide = slides[currentSlideIndex] || slides[0]
  const currentSlideId = currentSlide?.id || 'default'

  // Redraw drawing canvas whenever drawings change or slide changes
  const redrawDrawingCanvas = useCallback(() => {
    const canvas = drawingCanvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    ctx.clearRect(0, 0, canvas.width, canvas.height)
    const strokes = slideDrawings[currentSlideId] || []

    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'

    for (const stroke of strokes) {
      if (stroke.points.length < 2) continue
      ctx.save()
      ctx.strokeStyle = stroke.color
      ctx.lineWidth = stroke.width
      if (stroke.isHighlighter) {
        ctx.globalAlpha = 0.4
      }
      ctx.beginPath()
      ctx.moveTo(stroke.points[0].x, stroke.points[0].y)
      for (let i = 1; i < stroke.points.length; i++) {
        ctx.lineTo(stroke.points[i].x, stroke.points[i].y)
      }
      ctx.stroke()
      ctx.restore()
    }
  }, [slideDrawings, currentSlideId])

  useEffect(() => {
    redrawDrawingCanvas()
  }, [redrawDrawingCanvas])

  // Freehand Drawing Handlers on the Slide Stage
  const handleDrawMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (editTool !== 'pen' && editTool !== 'highlighter' && editTool !== 'eraser') return
    const canvas = drawingCanvasRef.current
    if (!canvas) return
    const rect = canvas.getBoundingClientRect()
    const x = (e.clientX - rect.left) * (canvas.width / rect.width)
    const y = (e.clientY - rect.top) * (canvas.height / rect.height)

    if (editTool === 'eraser') {
      eraseAtPoint(x, y)
      isDrawingRef.current = true
      return
    }

    isDrawingRef.current = true
    const isHigh = editTool === 'highlighter'
    const newStroke: SlideStroke = {
      color: penColor,
      width: isHigh ? 16 : penWidth,
      isHighlighter: isHigh,
      points: [{ x, y }]
    }
    currentStrokeRef.current = newStroke
  }

  const handleDrawMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawingRef.current) return
    const canvas = drawingCanvasRef.current
    if (!canvas) return
    const rect = canvas.getBoundingClientRect()
    const x = (e.clientX - rect.left) * (canvas.width / rect.width)
    const y = (e.clientY - rect.top) * (canvas.height / rect.height)

    if (editTool === 'eraser') {
      eraseAtPoint(x, y)
      return
    }

    if (currentStrokeRef.current) {
      currentStrokeRef.current.points.push({ x, y })
      const ctx = canvas.getContext('2d')
      if (ctx) {
        ctx.save()
        ctx.strokeStyle = currentStrokeRef.current.color
        ctx.lineWidth = currentStrokeRef.current.width
        ctx.lineCap = 'round'
        ctx.lineJoin = 'round'
        if (currentStrokeRef.current.isHighlighter) {
          ctx.globalAlpha = 0.4
        }
        const pts = currentStrokeRef.current.points
        const p1 = pts[pts.length - 2]
        const p2 = pts[pts.length - 1]
        ctx.beginPath()
        ctx.moveTo(p1.x, p1.y)
        ctx.lineTo(p2.x, p2.y)
        ctx.stroke()
        ctx.restore()
      }
    }
  }

  const handleDrawMouseUp = () => {
    if (!isDrawingRef.current) return
    isDrawingRef.current = false
    if (currentStrokeRef.current && currentStrokeRef.current.points.length > 1) {
      const stroke = currentStrokeRef.current
      setSlideDrawings((prev) => ({
        ...prev,
        [currentSlideId]: [...(prev[currentSlideId] || []), stroke]
      }))
    }
    currentStrokeRef.current = null
  }

  const eraseAtPoint = (x: number, y: number) => {
    const radius = 24
    setSlideDrawings((prev) => {
      const currentList = prev[currentSlideId] || []
      const filtered = currentList.filter((stroke) => {
        return !stroke.points.some((p) => Math.hypot(p.x - x, p.y - y) <= radius)
      })
      if (filtered.length === currentList.length) return prev
      return {
        ...prev,
        [currentSlideId]: filtered
      }
    })
  }

  const handleUndoDrawing = () => {
    setSlideDrawings((prev) => {
      const list = prev[currentSlideId] || []
      if (list.length === 0) return prev
      return {
        ...prev,
        [currentSlideId]: list.slice(0, -1)
      }
    })
    toast.info('Último trazo deshecho')
  }

  const handleClearDrawings = () => {
    setSlideDrawings((prev) => ({
      ...prev,
      [currentSlideId]: []
    }))
    toast.info('Dibujos de la diapositiva borrados')
  }

  // 1. ADD TEXT ACTION (Adds a new text card directly to the current slide)
  const handleAddText = async () => {
    if (!workspace) return
    const fx = currentSlide?.frameX ?? 200
    const fy = currentSlide?.frameY ?? 200
    const fw = currentSlide?.frameW || 640
    const fh = currentSlide?.frameH || 420

    // Center of the frame
    const posX = Math.round(fx + fw / 2 - 120)
    const posY = Math.round(fy + fh / 2 - 30)

    const newId = `text-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`
    try {
      await db.canvasNodes.add({
        id: newId,
        workspaceId: workspace.id,
        type: 'text',
        positionX: posX,
        positionY: posY,
        data: {
          content: 'Nuevo texto en diapositiva',
          fontSize: 'lg',
          color: 'white',
          textAlign: 'center',
          workspaceId: workspace.id,
          ...(currentSlide?.type === 'frame' ? { frameId: currentSlide.id } : {})
        },
        createdAt: Date.now(),
        updatedAt: Date.now(),
        isDeleted: false,
        syncStatus: 'pending'
      })
      syncEngine.scheduleSync(1000)
      setSelectedNodeId(newId)
      setEditingNodeId(newId)
      setEditTool('select')
      toast.success('Texto añadido a la diapositiva')
    } catch (err) {
      console.error('Error adding text node in presentation', err)
    }
  }

  // Delete node from presentation
  const handleDeleteNode = async (e: React.MouseEvent, nodeId: string) => {
    e.stopPropagation()
    try {
      await db.canvasNodes.update(nodeId, {
        isDeleted: true,
        updatedAt: Date.now(),
        syncStatus: 'pending'
      })
      syncEngine.scheduleSync(1000)
      if (selectedNodeId === nodeId) setSelectedNodeId(null)
      if (editingNodeId === nodeId) setEditingNodeId(null)
      toast.info('Elemento eliminado de la diapositiva')
    } catch (err) {
      console.error('Error deleting node', err)
    }
  }

  // Helper to save node updates
  const saveNodeData = async (nodeId: string, updates: any) => {
    try {
      const node = await db.canvasNodes.get(nodeId)
      if (node) {
        await db.canvasNodes.update(nodeId, {
          data: { ...node.data, ...updates },
          updatedAt: Date.now(),
          syncStatus: 'pending'
        })
        syncEngine.scheduleSync(1200)
      }
    } catch (err) {
      console.error('Error saving node data in presentation', err)
    }
  }

  // Drag node to move element across slide stage
  const handleNodeMouseDown = (e: React.MouseEvent, node: CanvasNodeItem) => {
    if (e.button !== 0) return
    if (editTool !== 'select') return
    const target = e.target as HTMLElement
    if (target.closest('input, textarea, button, a, [contenteditable="true"]')) {
      return
    }
    e.stopPropagation()
    setSelectedNodeId(node.id)

    const startX = e.clientX
    const startY = e.clientY
    const origNodeX = Number.isFinite(node.positionX) ? node.positionX : 0
    const origNodeY = Number.isFinite(node.positionY) ? node.positionY : 0
    const scale = Number.isFinite(currentScaleRef.current) && currentScaleRef.current > 0 ? currentScaleRef.current : 1

    const onMouseMove = (moveEvt: MouseEvent) => {
      const dx = (moveEvt.clientX - startX) / scale
      const dy = (moveEvt.clientY - startY) / scale
      setDragOffset({ id: node.id, dx, dy })
    }

    const onMouseUp = async (upEvt: MouseEvent) => {
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseup', onMouseUp)

      const dx = (upEvt.clientX - startX) / scale
      const dy = (upEvt.clientY - startY) / scale
      setDragOffset(null)

      if (Math.abs(dx) > 1.5 || Math.abs(dy) > 1.5) {
        const finalX = Math.round(origNodeX + dx)
        const finalY = Math.round(origNodeY + dy)
        try {
          const currentSlide = slides[currentSlideIndex]
          const isFrameSlide = currentSlide?.type === 'frame'
          const nodeUpdates: any = {
            positionX: finalX,
            positionY: finalY,
            updatedAt: Date.now(),
            syncStatus: 'pending'
          }
          if (isFrameSlide && currentSlide?.id) {
            nodeUpdates.data = {
              ...(node.data || {}),
              frameId: currentSlide.id
            }
          }
          await db.canvasNodes.update(node.id, nodeUpdates)

          // If moving inside a frame slide, expand the frame boundaries if node moved beyond edges
          // so it always remains enclosed within the frame both in presentation and canvas
          if (isFrameSlide && currentSlide?.id) {
            const frameNode = await db.canvasNodes.get(currentSlide.id)
            if (frameNode) {
              const { w: nw, h: nh } = getNodeEstSize({ ...node, positionX: finalX, positionY: finalY })
              let curFx = Number.isFinite(frameNode.positionX) ? frameNode.positionX : 0
              let curFy = Number.isFinite(frameNode.positionY) ? frameNode.positionY : 0
              let curFw = frameNode.data?.width || 640
              let curFh = frameNode.data?.height || 420
              let changed = false

              // If node moved to the right/bottom beyond frame
              if (finalX + nw > curFx + curFw) {
                curFw = Math.round(finalX + nw - curFx + 50)
                changed = true
              }
              if (finalY + nh > curFy + curFh) {
                curFh = Math.round(finalY + nh - curFy + 50)
                changed = true
              }
              // If node moved to the left/top beyond frame
              if (finalX < curFx) {
                const shiftX = Math.round(curFx - finalX + 50)
                curFx -= shiftX
                curFw += shiftX
                changed = true
              }
              if (finalY < curFy) {
                const shiftY = Math.round(curFy - finalY + 50)
                curFy -= shiftY
                curFh += shiftY
                changed = true
              }

              if (changed) {
                await db.canvasNodes.update(currentSlide.id, {
                  positionX: curFx,
                  positionY: curFy,
                  data: {
                    ...frameNode.data,
                    width: curFw,
                    height: curFh
                  },
                  updatedAt: Date.now(),
                  syncStatus: 'pending'
                })
              }
            }
          }

          syncEngine.scheduleSync(1000)
        } catch (err) {
          console.error('Failed to update node position', err)
        }
      }
    }

    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup', onMouseUp)
  }

  // Render an individual canvas node with full interactive editable capabilities
  const renderCanvasNode = (n: CanvasNodeItem) => {
    const isSelected = selectedNodeId === n.id
    const isEditing = editingNodeId === n.id

    // 1. NOTE NODE
    if (n.type === 'note') {
      if (n.data?.isBanner) {
        return (
          <div
            className={`px-6 py-3 rounded-xl shadow-md bg-rose-600 text-white ${
              isSelected ? 'ring-2 ring-white shadow-2xl' : ''
            }`}
            style={{ minWidth: 200, maxWidth: 360 }}
          >
            {isEditing ? (
              <input
                autoFocus
                type="text"
                defaultValue={n.data.title || n.data.content || ''}
                onBlur={(e) => {
                  setEditingNodeId(null)
                  saveNodeData(n.id, { title: e.target.value, content: e.target.value })
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    setEditingNodeId(null)
                    saveNodeData(n.id, { title: (e.target as any).value, content: (e.target as any).value })
                  }
                }}
                className="font-serif font-bold text-base text-center bg-transparent border-none outline-none w-full text-white"
              />
            ) : (
              <div
                onDoubleClick={() => setEditingNodeId(n.id)}
                className="font-serif font-bold text-base text-center text-white w-full cursor-text"
                title="Doble clic para editar texto"
              >
                {renderWithAppleEmoji(n.data.title || n.data.content || 'Texto del banner...')}
              </div>
            )}
          </div>
        )
      }

      return (
        <div
          className={`rounded-2xl bg-[#18181b] border border-zinc-800/80 p-3.5 shadow-[0_8px_30px_-6px_rgba(0,0,0,0.5),0_1px_3px_rgba(0,0,0,0.3)] text-zinc-200 ${
            isSelected ? 'ring-2 ring-[#1e96eb] shadow-2xl' : ''
          }`}
          style={{ width: n.data?.width || 280, minHeight: 80 }}
        >
          {/* Header Tag / Title */}
          {(n.data?.title || n.data?.showTitle || isEditing) && (
            <div className="mb-2 flex items-center">
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold tracking-wide uppercase bg-zinc-800/90 text-zinc-300 shadow-xs">
                <span className="w-1.5 h-1.5 rounded-full shrink-0 bg-zinc-500" />
                {isEditing ? (
                  <input
                    type="text"
                    defaultValue={n.data?.title || ''}
                    onBlur={(e) => saveNodeData(n.id, { title: e.target.value })}
                    placeholder="Título..."
                    className="font-sans font-semibold text-[11px] text-zinc-200 bg-transparent border-none outline-none max-w-[190px]"
                  />
                ) : (
                  <span
                    onDoubleClick={() => setEditingNodeId(n.id)}
                    className="font-sans font-semibold text-[11px] text-zinc-300 truncate max-w-[210px] cursor-text"
                  >
                    {renderWithAppleEmoji(n.data.title || 'Nota')}
                  </span>
                )}
              </div>
            </div>
          )}

          {/* Content Body */}
          {n.data?.isQuote ? (
            <div className="border-l-2 border-l-zinc-400 pl-3 my-1.5 italic">
              {isEditing ? (
                <textarea
                  autoFocus
                  defaultValue={n.data.content || ''}
                  onBlur={(e) => {
                    setEditingNodeId(null)
                    saveNodeData(n.id, { content: e.target.value })
                  }}
                  rows={3}
                  className="w-full bg-transparent border-none outline-none resize-none text-[13px] italic text-zinc-200 leading-relaxed"
                />
              ) : (
                <div
                  onDoubleClick={() => setEditingNodeId(n.id)}
                  className="whitespace-pre-wrap leading-relaxed text-[13px] italic text-zinc-200 cursor-text"
                >
                  {renderWithAppleEmoji(n.data?.content || '')}
                </div>
              )}
              {n.data?.quoteAuthor && (
                <div className="not-italic mt-1.5 text-[11px] font-medium text-zinc-400">
                  {renderWithAppleEmoji(n.data.quoteAuthor)}
                </div>
              )}
            </div>
          ) : (
            <div className="text-[13px] leading-relaxed">
              {isEditing ? (
                <textarea
                  autoFocus
                  defaultValue={n.data?.content || ''}
                  onBlur={(e) => {
                    setEditingNodeId(null)
                    saveNodeData(n.id, { content: e.target.value })
                  }}
                  rows={3}
                  className="w-full bg-transparent border-none outline-none resize-none text-[13px] text-zinc-200 leading-relaxed font-normal"
                />
              ) : n.data?.hasHtmlHighlight ? (
                <div
                  onDoubleClick={() => setEditingNodeId(n.id)}
                  dangerouslySetInnerHTML={{ __html: n.data.content || '' }}
                  className="leading-relaxed text-zinc-200 cursor-text"
                />
              ) : (
                <div
                  onDoubleClick={() => setEditingNodeId(n.id)}
                  className="whitespace-pre-wrap leading-relaxed text-[13px] font-normal text-zinc-200 cursor-text"
                >
                  {renderWithAppleEmoji(n.data?.content || '')}
                </div>
              )}
            </div>
          )}

          {n.data?.alertBox && (
            <div className="mt-3 p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs font-medium text-amber-300 flex items-center gap-2">
              <span>
                <AppleEmoji emoji="⚠️" size={16} />
              </span>
              <span>{renderWithAppleEmoji(n.data.alertBox)}</span>
            </div>
          )}

          {n.data?.linkUrl && (
            <div className="mt-2.5 pt-2 border-t border-zinc-800/60">
              <span className="text-[11px] text-blue-400 block truncate">{n.data.linkUrl}</span>
            </div>
          )}
        </div>
      )
    }

    // 2. TODO NODE
    if (n.type === 'todo') {
      const todos = n.data?.todos ?? []
      const completedCount = todos.filter((t) => t.completed).length
      const progressPercent = todos.length === 0 ? 0 : Math.round((completedCount / todos.length) * 100)

      const toggleTodo = (todoId: string) => {
        const updated = todos.map((t: any) => (t.id === todoId ? { ...t, completed: !t.completed } : t))
        saveNodeData(n.id, { todos: updated })
      }

      const addTodoItem = (text: string) => {
        if (!text.trim()) return
        const updated = [...todos, { id: crypto.randomUUID(), text: text.trim(), completed: false }]
        saveNodeData(n.id, { todos: updated })
      }

      return (
        <div
          className={`w-[290px] rounded-2xl bg-[#18181b] border border-zinc-800/80 overflow-hidden shadow-[0_8px_30px_-6px_rgba(0,0,0,0.5),0_1px_3px_rgba(0,0,0,0.3)] ${
            isSelected ? 'ring-2 ring-[#1e96eb] shadow-2xl' : ''
          }`}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-3.5 py-2.5 border-b border-zinc-800/80">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold tracking-wide uppercase bg-zinc-800/90 text-zinc-300 shadow-xs">
              <span className="w-1.5 h-1.5 rounded-full shrink-0 bg-zinc-500" />
              <span className="font-sans font-semibold text-[11px] text-zinc-300 truncate">
                {renderWithAppleEmoji(n.data?.title || 'Tareas pendientes')}
              </span>
            </div>
          </div>

          {/* Progress Bar */}
          {todos.length > 0 && (
            <div className="px-3 pt-2">
              <div className="flex justify-between text-[10px] font-medium mb-1 text-zinc-400">
                <span>Progreso</span>
                <span className="font-mono">
                  {completedCount}/{todos.length} ({progressPercent}%)
                </span>
              </div>
              <div className="w-full h-1 rounded-full overflow-hidden bg-white/10">
                <div className="h-full bg-[#1e96eb]" style={{ width: `${progressPercent}%` }} />
              </div>
            </div>
          )}

          {/* Checklist items */}
          <div className="p-3 space-y-1.5">
            {todos.map((todo: any) => (
              <div key={todo.id} className="flex items-center gap-2 text-xs">
                <button
                  type="button"
                  onClick={() => toggleTodo(todo.id)}
                  className="w-3.5 h-3.5 rounded border flex items-center justify-center shrink-0 cursor-pointer"
                  style={{
                    backgroundColor: todo.completed ? '#1e96eb' : 'transparent',
                    borderColor: todo.completed ? '#1e96eb' : '#71717a',
                    color: '#ffffff'
                  }}
                >
                  {todo.completed && <DoneIcon style={{ width: 10, height: 10 }} />}
                </button>
                <span
                  onClick={() => toggleTodo(todo.id)}
                  className={`truncate flex-1 cursor-pointer ${
                    todo.completed ? 'line-through text-zinc-500' : 'text-zinc-200'
                  }`}
                >
                  {renderWithAppleEmoji(todo.text)}
                </span>
              </div>
            ))}

            {/* Quick add task input inside slide */}
            <form
              onSubmit={(e) => {
                e.preventDefault()
                const form = e.currentTarget
                const input = form.elements.namedItem('taskText') as HTMLInputElement
                if (input && input.value) {
                  addTodoItem(input.value)
                  input.value = ''
                }
              }}
              className="flex items-center gap-1.5 pt-2 border-t border-white/5"
            >
              <input
                name="taskText"
                type="text"
                placeholder="Añadir tarea..."
                className="flex-1 text-xs bg-transparent border-none outline-none text-zinc-200 placeholder:text-zinc-500"
              />
              <button
                type="submit"
                className="p-1 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-200 transition"
              >
                <Plus className="w-3 h-3" />
              </button>
            </form>
          </div>
        </div>
      )
    }

    // 3. LINK NODE
    if (n.type === 'link') {
      const url = n.data?.url ?? 'https://vercel.com'
      const title = n.data?.title ?? 'Enlace'
      const description = n.data?.description ?? ''
      const imageUrl = n.data?.imageUrl ?? ''
      const isYouTube = url.includes('youtube') || url.includes('youtu.be')
      const isVideo = n.data?.isVideo ?? isYouTube

      return (
        <div
          className={`rounded-xl bg-[#252525] border border-zinc-800/80 shadow-[0_4px_16px_rgba(0,0,0,0.35)] overflow-hidden ${
            isSelected ? 'ring-2 ring-[#1e96eb] shadow-2xl' : ''
          }`}
          style={{ width: n.data?.width || 280 }}
        >
          {imageUrl && (
            <div className="relative w-full h-36 bg-neutral-800 overflow-hidden">
              <img src={imageUrl} alt={title} className="w-full h-full object-cover" />
              {isVideo && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/20">
                  <div className="w-10 h-10 rounded-full bg-neutral-900/80 text-white flex items-center justify-center shadow-lg">
                    <Play className="w-4 h-4 fill-current ml-0.5" />
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="p-3">
            <div className="flex items-center gap-1.5 mb-1.5">
              {isYouTube ? (
                <div className="w-4 h-3 rounded bg-red-600 flex items-center justify-center shrink-0">
                  <Play className="w-2 h-2 text-white fill-current ml-0.5" />
                </div>
              ) : (
                <Globe className="w-3.5 h-3.5 text-neutral-400 shrink-0" />
              )}
              <span className="text-[10px] text-neutral-400 truncate flex-1 font-mono">{url}</span>
              <a
                href={url.startsWith('http') ? url : `https://${url}`}
                target="_blank"
                rel="noreferrer"
                className="text-neutral-400 hover:text-neutral-200"
              >
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>
            <div className="font-bold text-xs text-[#f97316] mb-1 truncate">{title}</div>
            {description && (
              <p className="text-[11px] text-neutral-400 line-clamp-2 leading-relaxed">{description}</p>
            )}
          </div>
        </div>
      )
    }

    // 4. SUBBOARD NODE
    if (n.type === 'subboard') {
      const title = n.data?.title ?? 'Ideas'
      const subtitle =
        n.data?.subtitle ?? (n.data?.subboards ? `${n.data.subboards.length} tableros` : '15 tarjetas')
      const isStandalone = n.data?.isStandalone || false
      const iconType = n.data?.iconType || 'folder'
      const iconColor = n.data?.iconColor || '#8b5cf6'
      const subboards =
        n.data?.subboards && Array.isArray(n.data.subboards)
          ? n.data.subboards
          : [
              { id: '1', title: 'Ideas', count: '17 tarjetas', icon: 'idea', color: '#0284c7' },
              {
                id: '2',
                title: 'Tablero de inspiración',
                count: '12 tarjetas',
                icon: 'sparkle',
                color: '#10b981'
              },
              { id: '3', title: 'Guión', count: '8 tarjetas', icon: 'doc', color: '#06b6d4' }
            ]

      const renderIconBadge = (icon: string, color: string) => (
        <div
          className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 shadow-xs"
          style={{ backgroundColor: color }}
        >
          {icon === 'skull' && <Skull className="w-4 h-4 text-white" />}
          {icon === 'sparkle' && <Sparkles className="w-4 h-4 text-white" />}
          {icon === 'doc' && <FileText className="w-4 h-4 text-white" />}
          {icon === 'film' && <Film className="w-4 h-4 text-white" />}
          {icon === 'idea' && <Sparkles className="w-4 h-4 text-white" />}
          {icon === 'folder' && <Folder className="w-4 h-4 text-white" />}
        </div>
      )

      if (isStandalone) {
        return (
          <div
            className={`flex flex-col items-center justify-center p-2 rounded-2xl ${
              isSelected ? 'ring-2 ring-[#1e96eb]' : ''
            }`}
            style={{ width: 100 }}
          >
            <div
              className="w-16 h-16 rounded-2xl flex items-center justify-center shadow-lg"
              style={{ backgroundColor: iconColor }}
            >
              {iconType === 'skull' ? (
                <Skull className="w-8 h-8 text-white" />
              ) : (
                <Folder className="w-8 h-8 text-white" />
              )}
            </div>
            <span className="mt-2 text-xs font-bold text-neutral-100 text-center leading-tight">
              {renderWithAppleEmoji(title)}
            </span>
            <span className="text-[10px] text-neutral-400">{renderWithAppleEmoji(subtitle)}</span>
          </div>
        )
      }

      return (
        <div
          className={`w-[280px] rounded-xl bg-[#252525] border border-zinc-800/80 shadow-[0_4px_16px_rgba(0,0,0,0.35)] overflow-hidden ${
            isSelected ? 'ring-2 ring-[#1e96eb] shadow-2xl' : ''
          }`}
        >
          {title && (
            <div className="p-3 pb-2 text-center border-b border-neutral-800">
              <div className="font-serif font-bold text-sm text-center text-neutral-100">
                {renderWithAppleEmoji(title)}
              </div>
              {subtitle && (
                <div className="text-[11px] text-center text-neutral-400 -mt-0.5">
                  {renderWithAppleEmoji(subtitle)}
                </div>
              )}
            </div>
          )}

          {n.data?.imageUrl && (
            <div className="p-2 pb-0">
              <div className="w-full h-36 rounded-lg overflow-hidden bg-neutral-800">
                <img src={n.data.imageUrl} alt={title} className="w-full h-full object-cover" />
              </div>
            </div>
          )}

          <div className="p-2 space-y-1.5">
            {subboards.map((b: any) => (
              <div key={b.id} className="flex items-center gap-2.5 p-2 rounded-lg">
                {renderIconBadge(b.icon, b.color)}
                <div className="flex-1 min-w-0">
                  <span className="text-xs font-bold text-neutral-200 block truncate">
                    {renderWithAppleEmoji(b.title)}
                  </span>
                  <span className="text-[10px] text-neutral-400 block -mt-0.5">{b.count}</span>
                </div>
                <ChevronRight className="w-3.5 h-3.5 text-neutral-500" />
              </div>
            ))}
          </div>
        </div>
      )
    }

    // 5. IMAGE NODE
    if (n.type === 'image') {
      const width = n.data?.width || 280
      return (
        <div
          style={{ width: `${width}px` }}
          className={isSelected ? 'ring-2 ring-[#1e96eb] rounded-xl' : ''}
        >
          {n.data?.imageUrl ? (
            <div className="overflow-hidden rounded-xl shadow-md">
              <img
                src={n.data.imageUrl}
                alt={n.data?.caption || 'Foto'}
                className="w-full h-auto block select-none"
                draggable={false}
              />
            </div>
          ) : (
            <div className="w-full h-36 rounded-xl border-2 border-dashed border-zinc-700 bg-zinc-900/60 flex items-center justify-center text-xs text-zinc-500">
              Sin imagen
            </div>
          )}
          {n.data?.caption && (
            <div className="w-full mt-1.5 text-xs text-center text-zinc-400">
              {renderWithAppleEmoji(n.data.caption)}
            </div>
          )}
        </div>
      )
    }

    // 6. SHAPE NODE
    if (n.type === 'shape') {
      const shapeType = n.data?.shapeType || 'rect'
      const width = n.data?.width || 180
      const height = n.data?.height || 120
      const strokeStyle = n.data?.strokeStyle || 'solid'
      const content = n.data?.content || n.data?.title || ''

      const textEl = isEditing ? (
        <textarea
          autoFocus
          defaultValue={content}
          onBlur={(e) => {
            setEditingNodeId(null)
            saveNodeData(n.id, { content: e.target.value })
          }}
          rows={2}
          className="w-full text-center bg-transparent border-none outline-none resize-none text-xs md:text-sm font-semibold text-zinc-100"
        />
      ) : (
        <div
          onDoubleClick={() => setEditingNodeId(n.id)}
          className="text-center text-xs md:text-sm font-semibold w-full break-words leading-snug tracking-tight text-zinc-100 cursor-text"
        >
          {renderWithAppleEmoji(content || 'Forma')}
        </div>
      )

      if (shapeType === 'cylinder') {
        return (
          <div
            style={{ width: `${width}px`, height: `${height}px` }}
            className={`relative flex items-center justify-center filter drop-shadow-sm ${
              isSelected ? 'ring-2 ring-[#1e96eb] rounded-xl' : ''
            }`}
          >
            <svg className="absolute inset-0 w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
              <path
                d="M10,25 V75 C10,88 90,88 90,75 V25 Z"
                className="fill-zinc-800/90 stroke-zinc-600"
                strokeWidth="1.5"
                strokeDasharray={strokeStyle === 'dashed' ? '4 3' : 'none'}
              />
              <ellipse
                cx="50"
                cy="25"
                rx="40"
                ry="15"
                className="fill-zinc-800/90 stroke-zinc-600"
                strokeWidth="1.5"
                strokeDasharray={strokeStyle === 'dashed' ? '4 3' : 'none'}
              />
            </svg>
            <div className="relative z-10 pt-4 max-w-[120px]">{textEl}</div>
          </div>
        )
      }

      if (shapeType === 'ellipse') {
        return (
          <div
            style={{ width: `${width}px`, height: `${height}px` }}
            className={`rounded-full bg-[#18181b] border border-zinc-800 flex items-center justify-center p-4 shadow-md ${
              isSelected ? 'ring-2 ring-[#1e96eb]' : ''
            }`}
          >
            {textEl}
          </div>
        )
      }

      if (shapeType === 'diamond') {
        const dSize = Math.max(160, Math.min(width, height))
        return (
          <div
            style={{ width: `${dSize}px`, height: `${dSize}px` }}
            className={`relative flex items-center justify-center ${
              isSelected ? 'ring-2 ring-[#1e96eb] rounded-xl' : ''
            }`}
          >
            <div className="absolute inset-2 rotate-45 bg-[#18181b] border border-zinc-800 rounded-xl shadow-md" />
            <div className="relative z-10 max-w-[110px]">{textEl}</div>
          </div>
        )
      }

      if (shapeType === 'triangle') {
        return (
          <div
            style={{ width: `${width}px`, height: `${height}px` }}
            className={`relative flex items-center justify-center filter drop-shadow-sm ${
              isSelected ? 'ring-2 ring-[#1e96eb] rounded-xl' : ''
            }`}
          >
            <svg className="absolute inset-0 w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
              <polygon
                points="50,6 94,92 6,92"
                className="fill-zinc-800/90 stroke-zinc-600"
                strokeWidth="1.5"
                strokeDasharray={strokeStyle === 'dashed' ? '5 4' : 'none'}
              />
            </svg>
            <div className="relative z-10 pt-6 max-w-[110px]">{textEl}</div>
          </div>
        )
      }

      if (shapeType === 'star') {
        return (
          <div
            style={{ width: `${width}px`, height: `${height}px` }}
            className={`relative flex items-center justify-center filter drop-shadow-sm ${
              isSelected ? 'ring-2 ring-[#1e96eb] rounded-xl' : ''
            }`}
          >
            <svg className="absolute inset-0 w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
              <polygon
                points="50,5 64,36 98,36 71,57 81,91 50,70 19,91 29,57 2,36 36,36"
                className="fill-zinc-800/90 stroke-zinc-600"
                strokeWidth="1.5"
                strokeDasharray={strokeStyle === 'dashed' ? '5 4' : 'none'}
              />
            </svg>
            <div className="relative z-10 max-w-[80px]">{textEl}</div>
          </div>
        )
      }

      return (
        <div
          style={{ width: `${width}px`, minHeight: `${height}px` }}
          className={`bg-[#18181b] border border-zinc-800 p-4 flex flex-col items-center justify-center text-center shadow-md ${
            shapeType === 'roundedRect' ? 'rounded-2xl' : 'rounded-xl'
          } ${isSelected ? 'ring-2 ring-[#1e96eb] shadow-2xl' : ''}`}
        >
          {textEl}
        </div>
      )
    }

    // 7. TEXT NODE (Primary text editing card)
    if (n.type === 'text') {
      const fontFamily = n.data?.fontFamily || 'Inter, system-ui, sans-serif'
      const size = n.data?.fontSize || 'base'
      const align = n.data?.textAlign || 'left'
      const color = n.data?.color || 'white'

      const colorMap: Record<string, string> = {
        white: 'text-zinc-100',
        slate: 'text-zinc-400',
        blue: 'text-sky-400',
        green: 'text-emerald-400',
        yellow: 'text-amber-400',
        rose: 'text-rose-400',
        purple: 'text-purple-400'
      }
      const sizeMap: Record<string, string> = {
        sm: 'text-xs',
        base: 'text-sm font-medium',
        lg: 'text-lg font-bold',
        xl: 'text-2xl font-extrabold'
      }

      return (
        <div
          className={`min-w-[120px] max-w-[440px] p-2 rounded-xl transition ${
            isSelected ? 'ring-2 ring-[#1e96eb] bg-zinc-800/60' : 'hover:bg-zinc-800/30'
          }`}
        >
          {isEditing ? (
            <textarea
              autoFocus
              defaultValue={n.data?.content || ''}
              onBlur={(e) => {
                setEditingNodeId(null)
                saveNodeData(n.id, { content: e.target.value })
              }}
              onKeyDown={(e) => {
                if (e.key === 'Escape') {
                  setEditingNodeId(null)
                  saveNodeData(n.id, { content: (e.target as any).value })
                }
              }}
              rows={2}
              className={`w-full bg-transparent border-none outline-none resize-none leading-relaxed select-text ${
                colorMap[color] || 'text-zinc-100'
              } ${sizeMap[String(size)] || 'text-sm font-medium'} text-${align}`}
              style={{ fontFamily }}
            />
          ) : (
            <div
              onDoubleClick={() => setEditingNodeId(n.id)}
              className={`whitespace-pre-wrap leading-relaxed cursor-text select-text ${
                colorMap[color] || 'text-zinc-100'
              } ${sizeMap[String(size)] || 'text-sm font-medium'} text-${align}`}
              style={{ fontFamily }}
              title="Doble clic para editar texto"
            >
              {n.data?.content ? (
                renderWithAppleEmoji(n.data.content)
              ) : (
                <span className="italic text-xs opacity-60">Doble clic para escribir texto</span>
              )}
            </div>
          )}
        </div>
      )
    }

    // 8. MINDMAP NODE
    if (n.type === 'mindmap') {
      return (
        <div
          className={`min-w-[150px] max-w-[280px] rounded-xl px-3.5 py-2.5 bg-[#18181b] border border-zinc-800 shadow-lg ${
            isSelected ? 'ring-2 ring-[#1e96eb]' : ''
          }`}
        >
          {isEditing ? (
            <input
              autoFocus
              type="text"
              defaultValue={n.data?.title || ''}
              onBlur={(e) => {
                setEditingNodeId(null)
                saveNodeData(n.id, { title: e.target.value })
              }}
              className="text-xs font-semibold text-zinc-100 bg-transparent border-none outline-none w-full"
            />
          ) : (
            <div
              onDoubleClick={() => setEditingNodeId(n.id)}
              className="text-xs font-semibold truncate text-zinc-100 cursor-text"
            >
              {renderWithAppleEmoji(n.data?.title || 'Tema')}
            </div>
          )}
        </div>
      )
    }

    // 9. COLOR PALETTE NODE
    if (n.type === 'colorPalette') {
      const swatches =
        n.data?.swatches && Array.isArray(n.data.swatches)
          ? n.data.swatches
          : [
              { id: '1', hex: '#FFBF00', name: 'Mañana' },
              { id: '2', hex: '#D42511', name: 'Hollywood' },
              { id: '3', hex: '#257EF4', name: 'Azul Dodger' }
            ]

      return (
        <div
          className={`flex flex-col gap-3 ${isSelected ? 'ring-2 ring-[#1e96eb] p-1 rounded-xl' : ''}`}
          style={{ width: 180 }}
        >
          {swatches.map((swatch: any) => (
            <div
              key={swatch.id}
              className="w-full rounded-lg bg-[#252525] border border-neutral-700/80 shadow-md overflow-hidden"
            >
              <div
                className="w-full h-24 flex items-start justify-start p-2.5"
                style={{ backgroundColor: swatch.hex }}
              >
                <span
                  className="text-xs font-mono font-bold tracking-wider px-1 rounded"
                  style={{ color: getContrastColor(swatch.hex) }}
                >
                  {String(swatch.hex).toUpperCase()}
                </span>
              </div>
              <div className="p-2.5 bg-[#252525]">
                <span className="text-xs font-medium text-neutral-200">{swatch.name}</span>
              </div>
            </div>
          ))}
        </div>
      )
    }

    // 10. TABLE NODE
    if (n.type === 'table') {
      const rows = n.data?.rows || []
      const col1Title = n.data?.col1Title || 'Elemento'
      const col2Title = n.data?.col2Title || 'Valor'
      const hasCheckboxes = n.data?.hasCheckboxes ?? false
      const showTotal = n.data?.showTotal ?? false
      const totalText = n.data?.totalText || '$23,000'

      return (
        <div
          className={`min-w-[300px] max-w-[420px] rounded-lg bg-[#252525] border border-zinc-800 shadow-lg overflow-hidden ${
            isSelected ? 'ring-2 ring-[#1e96eb]' : ''
          }`}
        >
          {n.data?.showTitleBar && (
            <div className="px-3 py-1.5 bg-neutral-800/60 border-b border-neutral-700/60 text-xs font-bold text-neutral-200">
              {n.data?.title || 'Tabla de datos'}
            </div>
          )}
          <div className="flex items-center px-3 py-2 text-xs font-bold bg-amber-950/60 text-amber-200 border-b border-amber-800/60">
            {hasCheckboxes && <div className="w-6 shrink-0" />}
            <span className="flex-1">{col1Title}</span>
            <span className="w-20 text-right">{col2Title}</span>
          </div>
          <div className="divide-y divide-neutral-800">
            {rows.map((row: any) => (
              <div key={row.id} className="flex items-center px-3 py-1.5 text-xs text-neutral-200">
                {hasCheckboxes && (
                  <div className="w-5 h-5 flex items-center justify-center mr-1.5">
                    {row.checked ? (
                      <CheckSquare className="w-4 h-4 text-neutral-300" />
                    ) : (
                      <Square className="w-4 h-4 text-neutral-600" />
                    )}
                  </div>
                )}
                <span className="flex-1">{row.col1}</span>
                <span className="w-20 text-right font-mono text-neutral-300">{row.col2}</span>
              </div>
            ))}
          </div>
          {showTotal && (
            <div className="flex items-center justify-between px-3 py-2 bg-neutral-800/60 border-t border-neutral-700 text-xs font-bold">
              <span className="text-neutral-400">Total</span>
              <span className="font-mono text-neutral-100">{totalText}</span>
            </div>
          )}
        </div>
      )
    }

    // 11. COMMENT NODE
    if (n.type === 'comment') {
      const author = n.data?.commentAuthor || 'Natali'
      const date = n.data?.commentDate || '16 Jan 2026'
      const content = n.data?.commentText || ''
      const replies = n.data?.replies || []

      return (
        <div
          className={`w-[280px] rounded-xl bg-[#282828] border border-zinc-800 p-3.5 shadow-md ${
            isSelected ? 'ring-2 ring-[#1e96eb]' : ''
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-full bg-amber-500 text-white font-bold text-xs flex items-center justify-center shrink-0">
                {author.charAt(0)}
              </div>
              <div className="flex items-baseline gap-1.5">
                <span className="text-xs font-semibold text-neutral-100">{author}</span>
                <span className="text-[10px] text-neutral-400">{date}</span>
              </div>
            </div>
            <MessageSquare className="w-3.5 h-3.5 text-neutral-400" />
          </div>
          <div className="text-xs text-neutral-200 mb-2 leading-relaxed whitespace-pre-wrap">
            {renderWithAppleEmoji(content)}
          </div>
          {replies.length > 0 && (
            <div className="space-y-1.5 pt-2 border-t border-neutral-800">
              {replies.map((r: any) => (
                <div
                  key={r.id}
                  className="text-[11px] bg-neutral-800/60 p-1.5 rounded-md flex items-start gap-1.5"
                >
                  <span className="font-semibold text-neutral-300">{r.author}:</span>
                  <span className="text-neutral-400">{renderWithAppleEmoji(r.text)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )
    }

    // 12. DOCFRAME NODE
    if (n.type === 'docframe') {
      const cleanContent = n.data?.content
        ? n.data.content.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()
        : ''
      return (
        <div
          className={`w-[340px] rounded-xl bg-[#18181b] border border-zinc-800 p-4 shadow-md space-y-2 ${
            isSelected ? 'ring-2 ring-[#1e96eb]' : ''
          }`}
        >
          <div className="flex items-center gap-2 text-zinc-100 font-bold text-sm">
            <PageIcon style={{ width: 16, height: 16 }} />
            <span className="truncate">{renderWithAppleEmoji(n.data?.title || 'Documento')}</span>
          </div>
          {cleanContent && <p className="text-xs text-zinc-400 line-clamp-3 leading-relaxed">{cleanContent}</p>}
        </div>
      )
    }

    // Fallback generic node
    return (
      <div
        className={`p-4 rounded-2xl bg-[#1c1c22] border border-zinc-800 shadow-md space-y-2 w-[260px] ${
          isSelected ? 'ring-2 ring-[#1e96eb]' : ''
        }`}
      >
        <span className="font-semibold text-sm text-zinc-100 block truncate">
          {n.data?.title || n.type}
        </span>
        {n.data?.content && (
          <p className="text-xs text-zinc-300 leading-relaxed whitespace-pre-wrap">{n.data.content}</p>
        )}
      </div>
    )
  }

  // Compute exact spatial bounding box and scale for canvas frame slides
  const renderSpatialCanvasSlide = (slide: SlideItem) => {
    const baseW = slide.frameW || 640
    const baseH = slide.frameH || 420
    const fx = slide.frameX ?? 0
    const fy = slide.frameY ?? 0
    const slideNodes = slide.nodes || []
    const slideEdges = slide.edges || []

    // Calculate bounding box of frame + any child nodes
    let minRelX = 0
    let minRelY = 0
    let maxRelX = baseW
    let maxRelY = baseH

    for (const n of slideNodes) {
      const { w: nw, h: nh } = getNodeEstSize(n)
      const rx = n.positionX - fx
      const ry = n.positionY - fy
      minRelX = Math.min(minRelX, rx - 12)
      minRelY = Math.min(minRelY, ry - 12)
      maxRelX = Math.max(maxRelX, rx + nw + 12)
      maxRelY = Math.max(maxRelY, ry + nh + 12)
    }

    const totalW = Math.max(baseW, maxRelX - minRelX)
    const totalH = Math.max(baseH, maxRelY - minRelY)

    const availW = Math.max(320, stageBounds.width - 32)
    const availH = Math.max(220, stageBounds.height - 24)
    const scale = Math.min(availW / totalW, availH / totalH, 1.35)
    currentScaleRef.current = scale

    const nodeMap = new Map<string, CanvasNodeItem>(slideNodes.map((n) => [n.id, n]))
    const originX = fx + minRelX
    const originY = fy + minRelY

    return (
      <div
        ref={stageContainerRef}
        className="flex-1 w-full h-full flex items-center justify-center overflow-hidden relative"
      >
        <div
          style={{
            width: totalW * scale,
            height: totalH * scale
          }}
          className="relative flex items-center justify-center shrink-0"
        >
          <div
            style={{
              width: totalW,
              height: totalH,
              transform: `scale(${scale})`,
              transformOrigin: 'top left'
            }}
            className="absolute top-0 left-0"
          >
            {/* SVG Connector Arrows Layer */}
            {slideEdges.length > 0 && (
              <svg
                width={totalW}
                height={totalH}
                className="absolute inset-0 pointer-events-none z-0 overflow-visible"
              >
                <defs>
                  {slideEdges.map((edge) => {
                    const color = edge.color || '#3b82f6'
                    return (
                      <marker
                        key={`arrow-${edge.id}`}
                        id={`slide-arrow-${edge.id}`}
                        viewBox="0 0 10 10"
                        refX="8"
                        refY="5"
                        markerWidth="6"
                        markerHeight="6"
                        orient="auto-start-reverse"
                      >
                        <path d="M 0 1 L 10 5 L 0 9 z" fill={color} />
                      </marker>
                    )
                  })}
                </defs>
                {slideEdges.map((edge) => {
                  const sourceNode = nodeMap.get(edge.source)
                  const targetNode = nodeMap.get(edge.target)
                  if (!sourceNode || !targetNode) return null

                  const sOffset = dragOffset?.id === sourceNode.id ? dragOffset : undefined
                  const tOffset = dragOffset?.id === targetNode.id ? dragOffset : undefined

                  const sPos = getHandleAnchor(
                    sourceNode,
                    edge.sourceHandle,
                    'source',
                    originX,
                    originY,
                    sOffset
                  )
                  const tPos = getHandleAnchor(
                    targetNode,
                    edge.targetHandle,
                    'target',
                    originX,
                    originY,
                    tOffset
                  )
                  const d = buildEdgePath(
                    sPos.x,
                    sPos.y,
                    tPos.x,
                    tPos.y,
                    edge.edgeType,
                    edge.sourceHandle,
                    edge.targetHandle
                  )
                  const color = edge.color || '#3b82f6'

                  return (
                    <g key={edge.id}>
                      <path
                        d={d}
                        fill="none"
                        stroke={color}
                        strokeWidth={2}
                        strokeDasharray={edge.animated ? '6 4' : undefined}
                        markerEnd={
                          edge.markerEndType !== 'none' ? `url(#slide-arrow-${edge.id})` : undefined
                        }
                      />
                      {edge.label && (
                        <text
                          x={(sPos.x + tPos.x) / 2}
                          y={(sPos.y + tPos.y) / 2 - 6}
                          fill="#e4e4e7"
                          fontSize="11"
                          textAnchor="middle"
                          className="font-sans font-medium"
                        >
                          {edge.label}
                        </text>
                      )}
                    </g>
                  )
                })}
              </svg>
            )}

            {/* Positioned Canvas Cards Layer with Draggable handles & inline editing */}
            {slideNodes.map((n) => {
              const isBeingDragged = dragOffset?.id === n.id
              const left = n.positionX + (isBeingDragged ? dragOffset.dx : 0) - originX
              const top = n.positionY + (isBeingDragged ? dragOffset.dy : 0) - originY
              const isSelected = selectedNodeId === n.id

              return (
                <div
                  key={n.id}
                  onMouseDown={(e) => handleNodeMouseDown(e, n)}
                  style={{
                    position: 'absolute',
                    left: `${left}px`,
                    top: `${top}px`,
                    cursor: editTool === 'select' ? (isBeingDragged ? 'grabbing' : 'grab') : 'default'
                  }}
                  className={`group/card z-10 select-none transition-shadow ${
                    isBeingDragged ? 'opacity-90 scale-105 z-30 shadow-2xl' : ''
                  }`}
                >
                  {/* Floating Action Controls on Hover/Select (Move, Edit, Delete) */}
                  {!isFullscreen && editTool === 'select' && (
                    <div
                      className={`absolute -top-7 right-0 flex items-center gap-1 bg-[#18181c] border border-zinc-700 rounded-lg px-1.5 py-0.5 shadow-xl transition-opacity duration-150 z-40 ${
                        isSelected ? 'opacity-100' : 'opacity-0 group-hover/card:opacity-100'
                      }`}
                    >
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation()
                          setEditingNodeId(n.id)
                        }}
                        className="p-1 rounded text-zinc-300 hover:text-white hover:bg-zinc-700 transition"
                        title="Editar texto"
                      >
                        <Pencil className="w-3 h-3" />
                      </button>
                      <button
                        type="button"
                        onClick={(e) => handleDeleteNode(e, n.id)}
                        className="p-1 rounded text-rose-400 hover:text-rose-300 hover:bg-rose-500/20 transition"
                        title="Eliminar de la diapositiva"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  )}

                  {/* Node Body */}
                  {renderCanvasNode(n)}
                </div>
              )
            })}

            {/* Freehand Slide Drawing Canvas Layer */}
            <canvas
              ref={drawingCanvasRef}
              width={totalW}
              height={totalH}
              style={{
                width: totalW,
                height: totalH,
                pointerEvents:
                  editTool === 'pen' || editTool === 'highlighter' || editTool === 'eraser'
                    ? 'auto'
                    : 'none',
                cursor:
                  editTool === 'pen' || editTool === 'highlighter'
                    ? 'crosshair'
                    : editTool === 'eraser'
                    ? 'cell'
                    : 'default'
              }}
              onMouseDown={handleDrawMouseDown}
              onMouseMove={handleDrawMouseMove}
              onMouseUp={handleDrawMouseUp}
              className="absolute inset-0 z-20"
            />
          </div>
        </div>
      </div>
    )
  }

  const getSlideBackgroundClass = (bgStyle?: string) => {
    let style = bgStyle || 'default'

    // If 'default', dynamically inherit the active canvas grid mode (dots, lines/cuadrícula, or none/liso)
    if (style === 'default') {
      if (liveGridVariant === 'lines') style = 'grid'
      else if (liveGridVariant === 'none') style = 'plain'
      else style = 'dots'
    }

    switch (style) {
      case 'grid':
      case 'lines':
        return 'bg-[#121216] [background-image:linear-gradient(to_right,rgba(255,255,255,0.07)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.07)_1px,transparent_1px)] [background-size:24px_24px]'
      case 'plain':
      case 'none':
        return 'bg-[#121216] [background-image:none]'
      case 'dark':
        return 'bg-[#09090b] [background-image:none]'
      case 'gradient':
        return 'bg-gradient-to-br from-[#131524] via-[#16161d] to-[#1e1429] [background-image:none]'
      case 'glass':
        return 'bg-zinc-900/60 backdrop-blur-xl [background-image:none]'
      case 'dots':
      default:
        return 'bg-[#121216] [background-image:radial-gradient(rgba(255,255,255,0.14)_1.5px,transparent_1.5px)] [background-size:24px_24px]'
    }
  }

  if (!isOpen || !workspace) return null

  return (
    <div
      ref={containerRef}
      onMouseMove={handleMouseMove}
      className="fixed inset-0 z-50 bg-[#0c0c0e] text-zinc-100 flex flex-col select-none overflow-hidden"
    >
      {/* Blackout overlay (B key) */}
      {isBlackout && (
        <div
          onClick={() => setIsBlackout(false)}
          className="absolute inset-0 bg-black z-50 flex items-center justify-center cursor-pointer"
        >
          <span className="text-zinc-600 text-xs font-mono">
            Modo Pausa / Blackout (Pulsa B o haz clic para continuar)
          </span>
        </div>
      )}

      {/* Laser pointer dot */}
      {isLaserPointerActive && (
        <div
          style={{
            transform: `translate3d(${laserPos.x - 7}px, ${laserPos.y - 7}px, 0)`,
            pointerEvents: 'none'
          }}
          className="fixed top-0 left-0 w-3.5 h-3.5 rounded-full bg-red-500 shadow-[0_0_12px_4px_rgba(239,68,68,0.8)] z-50 transition-transform duration-75"
        />
      )}

      {/* Top Slide Header with Interactive Tools Bar (Hidden in Fullscreen) */}
      {!isFullscreen && (
        <div className="h-14 px-6 flex items-center justify-between border-b border-zinc-800/60 bg-[#121215]/90 backdrop-blur-md shrink-0">
          {/* Workspace Title & Current Slide Counter */}
          <div className="flex items-center gap-3">
            <span className="text-xl">{workspace.icon || '📽️'}</span>
            <span className="font-semibold text-sm text-zinc-200 truncate max-w-sm">
              {workspace.title || 'Untitled'}
            </span>
            <span className="text-zinc-500 text-xs">•</span>
            <span className="text-xs text-[#1e96eb] font-medium">
              Diapositiva {currentSlideIndex + 1} de {slides.length}
            </span>
          </div>

          {/* Center Presentation Interactive Tools: Move, Draw, + Text, Laser */}
          <div className="flex items-center gap-1.5 px-2 py-1 rounded-2xl bg-zinc-900/90 border border-zinc-700/80 shadow-lg">
            {/* Mover / Seleccionar Tool */}
            <button
              onClick={() => setEditTool('select')}
              className={`px-2.5 py-1.5 rounded-xl text-xs font-medium flex items-center gap-1.5 transition ${
                editTool === 'select'
                  ? 'bg-[#1e96eb] text-white shadow-sm'
                  : 'text-zinc-400 hover:text-white hover:bg-zinc-800'
              }`}
              title="Mover y editar elementos (V)"
            >
              <Move className="w-3.5 h-3.5" />
              <span>Mover</span>
            </button>

            {/* Pintar / Lápiz Tool */}
            <button
              onClick={() => setEditTool(editTool === 'pen' ? 'select' : 'pen')}
              className={`px-2.5 py-1.5 rounded-xl text-xs font-medium flex items-center gap-1.5 transition ${
                editTool === 'pen'
                  ? 'bg-amber-500 text-black font-semibold shadow-sm'
                  : 'text-zinc-400 hover:text-white hover:bg-zinc-800'
              }`}
              title="Pintar / Lápiz sobre diapositiva (P)"
            >
              <Pencil className="w-3.5 h-3.5" />
              <span>Lápiz</span>
            </button>

            {/* Subrayador Tool */}
            <button
              onClick={() => setEditTool(editTool === 'highlighter' ? 'select' : 'highlighter')}
              className={`px-2.5 py-1.5 rounded-xl text-xs font-medium flex items-center gap-1.5 transition ${
                editTool === 'highlighter'
                  ? 'bg-yellow-400 text-black font-semibold shadow-sm'
                  : 'text-zinc-400 hover:text-white hover:bg-zinc-800'
              }`}
              title="Subrayador fluorescente (H)"
            >
              <Highlighter className="w-3.5 h-3.5" />
              <span>Subrayar</span>
            </button>

            {/* Borrador Tool */}
            <button
              onClick={() => setEditTool(editTool === 'eraser' ? 'select' : 'eraser')}
              className={`px-2.5 py-1.5 rounded-xl text-xs font-medium flex items-center gap-1.5 transition ${
                editTool === 'eraser'
                  ? 'bg-rose-500 text-white shadow-sm'
                  : 'text-zinc-400 hover:text-white hover:bg-zinc-800'
              }`}
              title="Borrador de trazos (E)"
            >
              <Eraser className="w-3.5 h-3.5" />
              <span>Borrador</span>
            </button>

            <div className="w-[1px] h-4 bg-zinc-700/80 mx-1" />

            {/* Añadir Texto Tool */}
            <button
              onClick={handleAddText}
              className="px-2.5 py-1.5 rounded-xl text-xs font-medium flex items-center gap-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 hover:text-white transition active:scale-95"
              title="Añadir texto a la diapositiva (T)"
            >
              <Type className="w-3.5 h-3.5 text-[#1e96eb]" />
              <span>+ Texto</span>
            </button>

            {/* Puntero Láser */}
            <button
              onClick={() => setIsLaserPointerActive(!isLaserPointerActive)}
              className={`px-2.5 py-1.5 rounded-xl text-xs font-medium flex items-center gap-1.5 transition ${
                isLaserPointerActive
                  ? 'bg-red-500/20 text-red-400 border border-red-500/40'
                  : 'text-zinc-400 hover:text-white hover:bg-zinc-800'
              }`}
              title="Puntero Láser (L)"
            >
              <AiIcon
                style={{ width: 14, height: 14 }}
                className={isLaserPointerActive ? 'text-red-400' : ''}
              />
              <span>Láser</span>
            </button>
          </div>

          {/* Top right actions */}
          <div className="flex items-center gap-2">
            {/* Quick Grid Style Switcher (Lienzo / Puntos / Cuadrícula / Liso) */}
            <button
              onClick={handleCycleGridVariant}
              className="px-2.5 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 bg-zinc-800/80 hover:bg-zinc-700 text-zinc-300 hover:text-white border border-zinc-700/60 transition"
              title="Cambiar estilo de fondo del lienzo (Puntos / Cuadrícula / Liso)"
            >
              <Grid className="w-3.5 h-3.5 text-[#1e96eb]" />
              <span className="capitalize">
                {liveGridVariant === 'lines' ? 'Cuadrícula' : liveGridVariant === 'none' ? 'Liso' : 'Puntos'}
              </span>
            </button>

            {/* Speaker notes toggle */}
            {currentSlide?.speakerNotes && (
              <button
                onClick={() => setShowSpeakerNotes(!showSpeakerNotes)}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 transition ${
                  showSpeakerNotes
                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                    : 'text-zinc-400 hover:text-white hover:bg-zinc-800'
                }`}
                title="Notas del orador (N)"
              >
                <FileText className="w-3.5 h-3.5" />
                <span>Notas</span>
              </button>
            )}

            {/* Fullscreen toggle */}
            <button
              onClick={toggleFullscreen}
              className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition"
              title="Pantalla completa (F)"
            >
              {isFullscreen ? (
                <ExpandCloseIcon style={{ width: 15, height: 15 }} />
              ) : (
                <ExpandFullIcon style={{ width: 15, height: 15 }} />
              )}
            </button>

            {/* Exit Presentation */}
            <button
              onClick={onClose}
              className="px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-medium flex items-center gap-1.5 transition"
            >
              <CloseIcon style={{ width: 14, height: 14 }} />
              <span>Salir (Esc)</span>
            </button>
          </div>
        </div>
      )}

      {/* Floating Paint Color & Stroke Palette (Shown when Pen or Highlighter is active in windowed mode) */}
      {!isFullscreen && (editTool === 'pen' || editTool === 'highlighter' || editTool === 'eraser') && (
        <div className="absolute top-16 left-1/2 -translate-x-1/2 z-40 flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#1c1c22]/95 border border-zinc-700 shadow-2xl backdrop-blur-md animate-in fade-in slide-in-from-top-2 duration-150">
          <span className="text-[11px] font-semibold text-zinc-400 pr-1">
            {editTool === 'highlighter' ? 'Subrayador' : editTool === 'eraser' ? 'Borrador' : 'Lápiz'}:
          </span>

          {editTool !== 'eraser' && (
            <>
              {/* Color Swatches */}
              <div className="flex items-center gap-1.5">
                {PEN_COLORS.map((color) => (
                  <button
                    key={color}
                    onClick={() => setPenColor(color)}
                    style={{ backgroundColor: color }}
                    className={`w-4 h-4 rounded-full transition-transform hover:scale-125 cursor-pointer ${
                      penColor === color ? 'ring-2 ring-white ring-offset-1 ring-offset-black scale-110' : ''
                    }`}
                  />
                ))}
              </div>

              <div className="w-[1px] h-3.5 bg-zinc-700 mx-1" />

              {/* Stroke Width Buttons */}
              <div className="flex items-center gap-1 text-[10px] font-bold">
                <button
                  onClick={() => setPenWidth(2)}
                  className={`px-1.5 py-0.5 rounded ${
                    penWidth === 2 ? 'bg-zinc-700 text-white' : 'text-zinc-400 hover:text-white'
                  }`}
                >
                  Fino
                </button>
                <button
                  onClick={() => setPenWidth(5)}
                  className={`px-1.5 py-0.5 rounded ${
                    penWidth === 5 ? 'bg-zinc-700 text-white' : 'text-zinc-400 hover:text-white'
                  }`}
                >
                  Medio
                </button>
                <button
                  onClick={() => setPenWidth(10)}
                  className={`px-1.5 py-0.5 rounded ${
                    penWidth === 10 ? 'bg-zinc-700 text-white' : 'text-zinc-400 hover:text-white'
                  }`}
                >
                  Grueso
                </button>
              </div>

              <div className="w-[1px] h-3.5 bg-zinc-700 mx-1" />
            </>
          )}

          {/* Undo Stroke */}
          <button
            onClick={handleUndoDrawing}
            className="p-1 rounded text-zinc-400 hover:text-white hover:bg-zinc-700/60 transition"
            title="Deshacer trazo (Ctrl+Z)"
          >
            <Undo2 className="w-3.5 h-3.5" />
          </button>

          {/* Clear Drawings */}
          <button
            onClick={handleClearDrawings}
            className="p-1 rounded text-zinc-400 hover:text-rose-400 hover:bg-rose-500/10 transition"
            title="Borrar todos los dibujos de esta diapositiva"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Subtle Controls in Fullscreen Mode (Hover on top-right to exit, or left/right sides to navigate) */}
      {isFullscreen && (
        <>
          <div className="absolute top-4 right-4 z-50 flex items-center gap-2 opacity-0 hover:opacity-100 transition-opacity duration-200">
            <button
              onClick={toggleFullscreen}
              className="px-3 py-1.5 rounded-full bg-black/70 hover:bg-black/90 backdrop-blur-md border border-white/10 text-zinc-300 hover:text-white text-xs flex items-center gap-1.5 transition shadow-2xl cursor-pointer"
              title="Salir de pantalla completa (F o Esc)"
            >
              <ExpandCloseIcon style={{ width: 14, height: 14 }} />
              <span>Salir de pantalla completa (F)</span>
            </button>
          </div>

          {currentSlideIndex > 0 && (
            <button
              onClick={() => setCurrentSlideIndex((prev) => Math.max(0, prev - 1))}
              className="absolute left-4 top-1/2 -translate-y-1/2 z-40 p-3 rounded-full bg-black/40 hover:bg-black/80 backdrop-blur-md border border-white/10 text-white opacity-0 hover:opacity-100 transition shadow-2xl cursor-pointer"
              title="Diapositiva anterior (←)"
            >
              <ArrowLeftSmallIcon style={{ width: 24, height: 24 }} />
            </button>
          )}

          {currentSlideIndex < slides.length - 1 && (
            <button
              onClick={() => setCurrentSlideIndex((prev) => Math.min(slides.length - 1, prev + 1))}
              className="absolute right-4 top-1/2 -translate-y-1/2 z-40 p-3 rounded-full bg-black/40 hover:bg-black/80 backdrop-blur-md border border-white/10 text-white opacity-0 hover:opacity-100 transition shadow-2xl cursor-pointer"
              title="Siguiente diapositiva (→ o Espacio)"
            >
              <ArrowRightSmallIcon style={{ width: 24, height: 24 }} />
            </button>
          )}
        </>
      )}

      {/* Main Slide Presentation Stage (100% Fullscreen without borders/headers when in Fullscreen) */}
      <div
        className={`flex-1 relative flex items-center justify-center ${
          isFullscreen ? 'p-0 w-full h-full' : 'p-4 sm:p-8'
        } overflow-hidden`}
      >
        {currentSlide && (
          <div
            className={`w-full ${
              isFullscreen
                ? 'h-full max-w-none max-h-none rounded-none border-none p-4 sm:p-6'
                : 'max-w-6xl h-full max-h-[86vh] rounded-3xl border border-zinc-800/80 p-6 sm:p-8'
            } ${getSlideBackgroundClass(
              currentSlide.frameBgStyle
            )} shadow-2xl flex flex-col justify-between overflow-hidden relative animate-in fade-in zoom-in-95 duration-200`}
          >
            {/* Slide title header (Hidden in Fullscreen or via frame settings) */}
            {!isFullscreen && !currentSlide.hideHeader && (
              <div className="flex items-center justify-between pb-4 border-b border-zinc-800/80 mb-4 shrink-0">
                <div className="flex items-center gap-3">
                  <span className="w-7 h-7 rounded-lg bg-[#1e96eb]/20 border border-[#1e96eb]/40 text-[#1e96eb] flex items-center justify-center font-bold text-xs">
                    #{currentSlideIndex + 1}
                  </span>
                  <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
                    {currentSlide.title}
                  </h2>
                </div>
              </div>
            )}

            {/* Slide Body */}
            {currentSlide.contentHtml ? (
              <div className="flex-1 overflow-y-auto">
                <div
                  dangerouslySetInnerHTML={{ __html: currentSlide.contentHtml }}
                  className="prose prose-invert max-w-none text-zinc-300 leading-relaxed"
                />
              </div>
            ) : currentSlide.type === 'frame' ? (
              /* Exact 2D Spatial Canvas Layout matching how the user arranged the board with drag and edit */
              renderSpatialCanvasSlide(currentSlide)
            ) : (
              <div className="flex-1 flex items-center justify-center text-zinc-500 text-sm">
                Diapositiva en blanco. Añade tarjetas o contenido a este marco en el lienzo.
              </div>
            )}

            {/* Speaker Notes Drawer inside stage if enabled */}
            {showSpeakerNotes && currentSlide.speakerNotes && (
              <div className="mt-3 p-3 rounded-xl bg-amber-950/30 border border-amber-500/30 text-amber-200 text-xs leading-relaxed shrink-0">
                <div className="font-bold uppercase text-[10px] text-amber-400 mb-1">
                  Notas del Orador
                </div>
                <div className="whitespace-pre-wrap">{currentSlide.speakerNotes}</div>
              </div>
            )}

            {/* Slide Footer (Hidden in Fullscreen) */}
            {!isFullscreen && (
              <div className="pt-3 border-t border-zinc-800/60 flex items-center justify-between text-xs text-zinc-500 mt-2 shrink-0">
                <span className="flex items-center gap-2">
                  <span>Seven Note Presentation</span>
                  {editTool !== 'select' && (
                    <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 text-[10px] font-medium">
                      Modo {editTool === 'pen' ? 'Lápiz' : editTool === 'highlighter' ? 'Subrayador' : 'Borrador'} activo
                    </span>
                  )}
                </span>
                <span>
                  {currentSlideIndex + 1} / {slides.length}
                </span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Floating Bottom Presentation Controller Dock (Hidden in Fullscreen) */}
      {!isFullscreen && (
        <div className="h-16 px-6 border-t border-zinc-800/80 bg-[#121215]/95 backdrop-blur-md flex items-center justify-between shrink-0">
          {/* Left: Presentation Timer */}
          <div className="flex items-center gap-2">
            <div className="px-2.5 py-1 rounded-lg bg-zinc-800/80 border border-zinc-700 font-mono text-xs text-zinc-300 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span>{formatTimer(timerSeconds)}</span>
            </div>

            <button
              onClick={() => setIsTimerRunning(!isTimerRunning)}
              className="p-1 rounded text-zinc-400 hover:text-white"
              title={isTimerRunning ? 'Pausar cronómetro' : 'Reanudar cronómetro'}
            >
              {isTimerRunning ? (
                <PausePanelIcon style={{ width: 14, height: 14 }} />
              ) : (
                <PlayIcon style={{ width: 14, height: 14 }} />
              )}
            </button>

            <button
              onClick={() => setTimerSeconds(0)}
              className="p-1 rounded text-zinc-400 hover:text-white"
              title="Reiniciar cronómetro"
            >
              <ResetIcon style={{ width: 14, height: 14 }} />
            </button>
          </div>

          {/* Center: Slide Navigation Buttons [ < ] [ 2 / 5 ] [ > ] */}
          <div className="flex items-center gap-3">
            <button
              disabled={currentSlideIndex === 0}
              onClick={() => setCurrentSlideIndex((prev) => Math.max(0, prev - 1))}
              className="p-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 disabled:opacity-40 disabled:hover:bg-zinc-800 text-white transition flex items-center justify-center shadow-md cursor-pointer"
              title="Diapositiva anterior (←)"
            >
              <ArrowLeftSmallIcon style={{ width: 18, height: 18 }} />
            </button>

            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-zinc-800/60 border border-zinc-700/60 text-xs font-medium">
              <span className="text-white font-bold">{currentSlideIndex + 1}</span>
              <span className="text-zinc-500">/</span>
              <span className="text-zinc-400">{slides.length}</span>
            </div>

            <button
              disabled={currentSlideIndex === slides.length - 1}
              onClick={() => setCurrentSlideIndex((prev) => Math.min(slides.length - 1, prev + 1))}
              className="p-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 disabled:opacity-40 disabled:hover:bg-zinc-800 text-white transition flex items-center justify-center shadow-md cursor-pointer"
              title="Siguiente diapositiva (→ o Espacio)"
            >
              <ArrowRightSmallIcon style={{ width: 18, height: 18 }} />
            </button>
          </div>

          {/* Right: Slide Drawer Toggle */}
          <div className="relative">
            <button
              onClick={() => setShowThumbnails(!showThumbnails)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 transition ${
                showThumbnails
                  ? 'bg-[#1e96eb] text-white'
                  : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
              }`}
            >
              <AllDocsIcon style={{ width: 14, height: 14 }} />
              <span>Índice de Diapositivas</span>
            </button>

            {/* Thumbnails popover */}
            {showThumbnails && (
              <div className="absolute right-0 bottom-12 w-64 max-h-72 overflow-y-auto bg-[#18181c] border border-zinc-700 rounded-2xl shadow-2xl p-2 space-y-1 z-50">
                <div className="px-2 py-1 text-[10px] font-bold uppercase text-zinc-500">
                  Diapositivas ({slides.length})
                </div>
                {slides.map((s, idx) => (
                  <button
                    key={s.id}
                    onClick={() => {
                      setCurrentSlideIndex(idx)
                      setShowThumbnails(false)
                    }}
                    className={`w-full text-left p-2 rounded-xl text-xs flex items-center gap-2 transition ${
                      idx === currentSlideIndex
                        ? 'bg-[#1e96eb]/20 text-[#1e96eb] border border-[#1e96eb]/40'
                        : 'hover:bg-zinc-800 text-zinc-300'
                    }`}
                  >
                    <span className="w-5 h-5 rounded-md bg-zinc-800 text-zinc-400 font-mono text-[10px] flex items-center justify-center shrink-0">
                      {idx + 1}
                    </span>
                    <span className="truncate flex-1 font-medium">{s.title}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
