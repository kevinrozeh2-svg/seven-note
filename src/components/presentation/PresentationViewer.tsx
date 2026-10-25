import { useState, useEffect, useRef, useMemo } from 'react'
import {
  X,
  ChevronLeft,
  ChevronRight,
  Maximize2,
  Minimize2,
  Play,
  Pause,
  RotateCcw,
  Layers,
  Sparkles,
  CheckCircle2,
  Circle
} from 'lucide-react'
import type { WorkspaceItem, CanvasNodeItem } from '../../db'

interface PresentationViewerProps {
  isOpen: boolean
  onClose: () => void
  workspace: WorkspaceItem | undefined
  nodes: CanvasNodeItem[]
  initialFrameId?: string
}

interface SlideItem {
  id: string
  title: string
  type: 'frame' | 'heading' | 'intro'
  frameIndex?: number
  contentHtml?: string
  nodes?: CanvasNodeItem[]
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
  const [showThumbnails, setShowThumbnails] = useState(false)

  // Presentation Timer state
  const [timerSeconds, setTimerSeconds] = useState(0)
  const [isTimerRunning, setIsTimerRunning] = useState(true)

  const containerRef = useRef<HTMLDivElement | null>(null)

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
    const frameNodes = nodes
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
        const insideNodes = nodes.filter(
          (n) =>
            n.id !== frame.id &&
            !n.isDeleted &&
            n.positionX >= fx1 - 20 &&
            n.positionX <= fx2 &&
            n.positionY >= fy1 - 20 &&
            n.positionY <= fy2
        )

        return {
          id: frame.id,
          title: frame.data.title || frame.data.frameTitle || `Diapositiva #${idx + 1}`,
          type: 'frame',
          frameIndex: idx + 1,
          nodes: insideNodes
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

    // If still just intro slide and there are canvas nodes, add a slide showing canvas cards
    if (resultSlides.length === 1 && nodes.length > 0) {
      resultSlides.push({
        id: 'slide-cards',
        title: 'Elementos del Tablero Visual',
        type: 'frame',
        nodes: nodes.filter((n) => !n.isDeleted && n.type !== 'docframe')
      })
    }

    return resultSlides
  }, [workspace, nodes])

  // If initialFrameId is provided, jump to it
  useEffect(() => {
    if (initialFrameId && slides.length > 0) {
      const idx = slides.findIndex((s) => s.id === initialFrameId)
      if (idx !== -1) {
        setCurrentSlideIndex(idx)
      }
    }
  }, [initialFrameId, slides])

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {})
      setIsFullscreen(true)
    } else {
      document.exitFullscreen().catch(() => {})
      setIsFullscreen(false)
    }
  }

  // Keyboard navigation
  useEffect(() => {
    if (!isOpen) return

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose()
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
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, slides.length, onClose])

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

  if (!isOpen || !workspace) return null

  const currentSlide = slides[currentSlideIndex] || slides[0]

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

      {/* Top Slide Header (Subtle) */}
      <div className="h-14 px-6 flex items-center justify-between border-b border-zinc-800/60 bg-[#121215]/80 backdrop-blur-md shrink-0">
        <div className="flex items-center gap-3">
          <span className="text-xl">{workspace.icon || '📽️'}</span>
          <span className="font-semibold text-sm text-zinc-200 truncate max-w-sm">
            {workspace.title || 'Untitled'}
          </span>
          <span className="text-zinc-500 text-xs">•</span>
          <span className="text-xs text-indigo-400 font-medium">
            Diapositiva {currentSlideIndex + 1} de {slides.length}
          </span>
        </div>

        {/* Top right actions */}
        <div className="flex items-center gap-2">
          {/* Laser pointer button */}
          <button
            onClick={() => setIsLaserPointerActive(!isLaserPointerActive)}
            className={`px-2.5 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 transition ${
              isLaserPointerActive
                ? 'bg-red-500/20 text-red-400 border border-red-500/40'
                : 'text-zinc-400 hover:text-white hover:bg-zinc-800'
            }`}
            title="Puntero Láser (L)"
          >
            <Sparkles size={13} className={isLaserPointerActive ? 'text-red-400' : ''} />
            <span>Láser</span>
          </button>

          {/* Fullscreen toggle */}
          <button
            onClick={toggleFullscreen}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition"
            title="Pantalla completa (F)"
          >
            {isFullscreen ? <Minimize2 size={15} /> : <Maximize2 size={15} />}
          </button>

          {/* Exit Presentation */}
          <button
            onClick={onClose}
            className="px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-medium flex items-center gap-1.5 transition"
          >
            <X size={14} />
            <span>Salir (Esc)</span>
          </button>
        </div>
      </div>

      {/* Main Slide Presentation Stage */}
      <div className="flex-1 relative flex items-center justify-center p-8 sm:p-14 overflow-hidden">
        {currentSlide && (
          <div className="w-full max-w-5xl h-full max-h-[82vh] bg-[#16161a] border border-zinc-800/80 rounded-3xl shadow-2xl p-8 sm:p-12 flex flex-col justify-between overflow-y-auto relative animate-in fade-in zoom-in-95 duration-200">
            {/* Slide title header */}
            <div className="flex items-center justify-between pb-6 border-b border-zinc-800/80 mb-6">
              <div className="flex items-center gap-3">
                <span className="w-7 h-7 rounded-lg bg-indigo-600/30 border border-indigo-500/40 text-indigo-400 flex items-center justify-center font-bold text-xs">
                  #{currentSlideIndex + 1}
                </span>
                <h2 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
                  {currentSlide.title}
                </h2>
              </div>
            </div>

            {/* Slide Body */}
            <div className="flex-1 overflow-y-auto">
              {currentSlide.contentHtml ? (
                <div
                  dangerouslySetInnerHTML={{ __html: currentSlide.contentHtml }}
                  className="prose prose-invert max-w-none text-zinc-300 leading-relaxed"
                />
              ) : currentSlide.nodes && currentSlide.nodes.length > 0 ? (
                /* Frame nodes visual rendering */
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {currentSlide.nodes.map((n) => (
                    <div
                      key={n.id}
                      className="p-4 rounded-2xl bg-[#1c1c22] border border-zinc-800 shadow-md space-y-2"
                    >
                      {/* Node Header */}
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-sm text-zinc-100 truncate">
                          {n.data.title || (n.type === 'note' ? 'Nota' : n.type === 'todo' ? 'Tareas' : n.type)}
                        </span>
                        <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-400">
                          {n.type}
                        </span>
                      </div>

                      {/* Content */}
                      {n.data.content && (
                        <p className="text-xs text-zinc-300 leading-relaxed whitespace-pre-wrap">
                          {n.data.content}
                        </p>
                      )}

                      {/* Todos */}
                      {n.data.todos && (
                        <div className="space-y-1.5 pt-1">
                          {n.data.todos.map((todo) => (
                            <div key={todo.id} className="flex items-center gap-2 text-xs">
                              {todo.completed ? (
                                <CheckCircle2 size={14} className="text-emerald-400 shrink-0" />
                              ) : (
                                <Circle size={14} className="text-zinc-500 shrink-0" />
                              )}
                              <span className={todo.completed ? 'line-through text-zinc-500' : 'text-zinc-300'}>
                                {todo.text}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Image */}
                      {n.data.imageUrl && (
                        <img
                          src={n.data.imageUrl}
                          alt=""
                          className="w-full h-32 object-cover rounded-xl mt-2"
                        />
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="h-full flex items-center justify-center text-zinc-500 text-sm">
                  Diapositiva en blanco. Añade tarjetas o contenido a este marco en el lienzo.
                </div>
              )}
            </div>

            {/* Slide Footer */}
            <div className="pt-6 border-t border-zinc-800/80 flex items-center justify-between text-xs text-zinc-500 mt-6">
              <span>Seven Note Presentation</span>
              <span>
                {currentSlideIndex + 1} / {slides.length}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Floating Bottom Presentation Controller Dock */}
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
            {isTimerRunning ? <Pause size={13} /> : <Play size={13} />}
          </button>

          <button
            onClick={() => setTimerSeconds(0)}
            className="p-1 rounded text-zinc-400 hover:text-white"
            title="Reiniciar cronómetro"
          >
            <RotateCcw size={13} />
          </button>
        </div>

        {/* Center: Slide Navigation Buttons [ < ] [ 2 / 5 ] [ > ] */}
        <div className="flex items-center gap-3">
          <button
            disabled={currentSlideIndex === 0}
            onClick={() => setCurrentSlideIndex((prev) => Math.max(0, prev - 1))}
            className="p-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 disabled:opacity-40 disabled:hover:bg-zinc-800 text-white transition flex items-center justify-center shadow-md"
            title="Diapositiva anterior (←)"
          >
            <ChevronLeft size={18} />
          </button>

          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-zinc-800/60 border border-zinc-700/60 text-xs font-medium">
            <span className="text-white font-bold">{currentSlideIndex + 1}</span>
            <span className="text-zinc-500">/</span>
            <span className="text-zinc-400">{slides.length}</span>
          </div>

          <button
            disabled={currentSlideIndex === slides.length - 1}
            onClick={() => setCurrentSlideIndex((prev) => Math.min(slides.length - 1, prev + 1))}
            className="p-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 disabled:opacity-40 disabled:hover:bg-zinc-800 text-white transition flex items-center justify-center shadow-md"
            title="Siguiente diapositiva (→ o Espacio)"
          >
            <ChevronRight size={18} />
          </button>
        </div>

        {/* Right: Slide Drawer Toggle */}
        <div className="relative">
          <button
            onClick={() => setShowThumbnails(!showThumbnails)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 transition ${
              showThumbnails
                ? 'bg-indigo-600 text-white'
                : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
            }`}
          >
            <Layers size={13} />
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
                      ? 'bg-indigo-600/30 text-indigo-300 border border-indigo-500/40'
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
    </div>
  )
}
