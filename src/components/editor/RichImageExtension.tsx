import React, { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import Image from '@tiptap/extension-image'
import { ReactNodeViewRenderer, NodeViewWrapper, type NodeViewProps } from '@tiptap/react'
import {
  AlignLeft,
  AlignCenter,
  AlignRight,
  Sparkles,
  Crop,
  Palette,
  Maximize2,
  Download,
  Trash2,
  Replace,
  Copy,
  RotateCw,
  FlipHorizontal2,
  FlipVertical2,
  X,
  RefreshCw,
  Image as ImageIcon
} from 'lucide-react'
import { toast } from '../../lib/toast'
import {
  ASPECT_RATIO_OPTIONS,
  IMAGE_FILTER_PRESETS,
  getFilterPresetCss
} from '../../lib/imageEditorUtils'
import { processAndUploadImage, deleteImageFromStorage } from '../../lib/imageOptimizer'
import { isEmojiImageElement } from '../ui/AppleEmoji'
import { PhotoEditorModal, type PhotoEditorResult } from './PhotoEditorModal'

export interface RichImageAttrs {
  src: string
  alt?: string
  title?: string
  width?: string // e.g. '100%', '75%', '420px'
  align?: 'left' | 'center' | 'right'
  aspectRatio?: string // 'auto' | '1/1' | '16/9' | '4/3' | '3/2' | '4/5' | '9/16' | '21/9'
  objectFit?: 'cover' | 'contain'
  borderRadius?: 'none' | 'sm' | 'md' | 'lg' | 'full'
  frame?: 'none' | 'thin' | 'card' | 'polaroid' | 'browser'
  shadow?: 'none' | 'sm' | 'md' | 'lg'
  filter?: string
  rotation?: number // 0 | 90 | 180 | 270
  flipH?: boolean
  flipV?: boolean
  opacity?: number // 15..100
  caption?: string
}

const RADIUS_MAP: Record<string, string> = {
  none: '0px',
  sm: '6px',
  md: '12px',
  lg: '20px',
  full: '9999px'
}

const SHADOW_MAP: Record<string, string> = {
  none: 'none',
  sm: '0 2px 8px rgba(15, 15, 15, 0.08), 0 1px 2px rgba(15, 15, 15, 0.05)',
  md: '0 8px 24px rgba(15, 15, 15, 0.14), 0 2px 6px rgba(15, 15, 15, 0.08)',
  lg: '0 18px 44px rgba(15, 15, 15, 0.22), 0 4px 12px rgba(15, 15, 15, 0.12)'
}

type ActivePopover = null | 'aspect' | 'style'

const RichImageNodeView: React.FC<NodeViewProps> = ({
  node,
  updateAttributes,
  deleteNode,
  selected,
  editor,
  getPos
}) => {
  const attrs = node.attrs as RichImageAttrs
  const isEditable = editor.isEditable

  const [isStudioOpen, setIsStudioOpen] = useState(false)
  const [isLightboxOpen, setIsLightboxOpen] = useState(false)
  const [activePopover, setActivePopover] = useState<ActivePopover>(null)
  const [isResizing, setIsResizing] = useState(false)
  const [liveWidthPct, setLiveWidthPct] = useState<number | null>(null)
  const [imgError, setImgError] = useState(false)

  const wrapperRef = useRef<HTMLDivElement | null>(null)
  const figureRef = useRef<HTMLDivElement | null>(null)
  const replaceInputRef = useRef<HTMLInputElement | null>(null)

  const width = attrs.width || '100%'
  const align = attrs.align || 'center'
  const aspectRatio = attrs.aspectRatio || 'auto'
  const objectFit = attrs.objectFit || 'cover'
  const borderRadius = attrs.borderRadius || 'md'
  const frame = attrs.frame || 'none'
  const shadow = attrs.shadow || 'none'
  const filter = attrs.filter || 'none'
  const rotation = Number(attrs.rotation || 0)
  const flipH = Boolean(attrs.flipH)
  const flipV = Boolean(attrs.flipV)
  const opacity = typeof attrs.opacity === 'number' ? attrs.opacity : 100
  const caption = attrs.caption || ''

  // Close popovers on outside click
  useEffect(() => {
    if (!activePopover) return
    const handleOutside = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setActivePopover(null)
      }
    }
    document.addEventListener('mousedown', handleOutside)
    return () => document.removeEventListener('mousedown', handleOutside)
  }, [activePopover])

  // Close lightbox on Escape
  useEffect(() => {
    if (!isLightboxOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsLightboxOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [isLightboxOpen])

  // Reset image error when src changes
  useEffect(() => {
    setImgError(false)
  }, [attrs.src])

  // Drag-to-resize handler
  const startResize = (e: React.PointerEvent, side: 'left' | 'right') => {
    if (!isEditable) return
    e.preventDefault()
    e.stopPropagation()

    const container = wrapperRef.current
    const figure = figureRef.current
    if (!container || !figure) return

    const containerWidth = container.getBoundingClientRect().width
    const startWidth = figure.getBoundingClientRect().width
    const startX = e.clientX
    setIsResizing(true)

    const onMove = (moveEvent: PointerEvent) => {
      const dx = moveEvent.clientX - startX
      // Center-aligned images scale symmetrically on both sides
      const multiplier = align === 'center' ? 2 : 1
      const delta = side === 'right' ? dx * multiplier : -dx * multiplier
      const nextPx = Math.min(containerWidth, Math.max(120, startWidth + delta))
      const pct = Math.min(100, Math.max(15, Math.round((nextPx / containerWidth) * 100)))
      setLiveWidthPct(pct)
      updateAttributes({ width: `${pct}%` })
    }

    const onUp = () => {
      setIsResizing(false)
      setLiveWidthPct(null)
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
    }

    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
  }

  const handleReplaceFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return

    const toastId = toast.loading('Optimizando nueva foto...')
    try {
      const oldSrc = attrs.src
      const result = await processAndUploadImage(file)
      updateAttributes({ src: result.url, alt: file.name })
      if (oldSrc && oldSrc !== result.url) {
        deleteImageFromStorage(oldSrc).catch(() => {})
      }
      toast.success('Foto reemplazada', { id: toastId })
    } catch (err: any) {
      toast.error('Error al reemplazar foto: ' + (err?.message || 'Error'), { id: toastId })
    }
  }

  const handleStudioSave = (result: PhotoEditorResult) => {
    const oldSrc = attrs.src
    // Filter was already baked into the exported image, so reset live CSS filter to avoid double-applying
    updateAttributes({
      src: result.url,
      filter: 'none',
      rotation: 0,
      flipH: false,
      flipV: false,
      opacity: 100
    })
    if (oldSrc && oldSrc !== result.url) {
      deleteImageFromStorage(oldSrc).catch(() => {})
    }
  }

  const handleDuplicate = () => {
    if (typeof getPos !== 'function') return
    const pos = getPos()
    if (typeof pos !== 'number') return
    editor
      .chain()
      .focus()
      .insertContentAt(pos + node.nodeSize, {
        type: 'image',
        attrs: { ...attrs }
      })
      .run()
    toast.success('Foto duplicada')
  }

  const handleDownload = () => {
    const a = document.createElement('a')
    a.href = attrs.src
    a.download = attrs.alt || `foto-seven-note-${Date.now()}.webp`
    a.target = '_blank'
    a.rel = 'noopener noreferrer'
    a.click()
  }

  const handleResetAppearance = () => {
    updateAttributes({
      width: '100%',
      align: 'center',
      aspectRatio: 'auto',
      objectFit: 'cover',
      borderRadius: 'md',
      frame: 'none',
      shadow: 'none',
      filter: 'none',
      rotation: 0,
      flipH: false,
      flipV: false,
      opacity: 100
    })
    toast.success('Aspecto restablecido')
  }

  const alignJustify =
    align === 'left' ? 'justify-start' : align === 'right' ? 'justify-end' : 'justify-center'

  const imgTransforms: string[] = []
  if (rotation) imgTransforms.push(`rotate(${rotation}deg)`)
  if (flipH) imgTransforms.push('scaleX(-1)')
  if (flipV) imgTransforms.push('scaleY(-1)')

  const filterCss = getFilterPresetCss(filter)
  const resolvedRadius = RADIUS_MAP[borderRadius] ?? '12px'
  const resolvedShadow = SHADOW_MAP[shadow] ?? 'none'
  const aspectCss =
    ASPECT_RATIO_OPTIONS.find((a) => a.id === aspectRatio)?.cssValue || 'auto'

  const frameWrapperClass =
    frame === 'polaroid'
      ? 'bg-white dark:bg-[#262626] p-3 pb-5 border border-black/10 dark:border-white/10'
      : frame === 'card'
      ? 'bg-[var(--app-bg-secondary)] p-2 border border-[var(--app-border)]'
      : frame === 'thin'
      ? 'border border-[var(--app-border-strong,var(--app-border))]'
      : frame === 'browser'
      ? 'bg-[var(--app-bg-secondary)] border border-[var(--app-border)] overflow-hidden'
      : ''

  return (
    <NodeViewWrapper
      ref={wrapperRef}
      className={`my-3 flex w-full ${alignJustify} select-none`}
      data-drag-handle
    >
      <div
        ref={figureRef}
        className="relative group max-w-full transition-[width] duration-75"
        style={{ width }}
      >
        <input
          ref={replaceInputRef}
          type="file"
          accept="image/*"
          onChange={handleReplaceFile}
          className="hidden"
        />

        {/* Floating Quick Toolbar (Editable Mode) */}
        {isEditable && (
          <div
            contentEditable={false}
            className={`absolute -top-11 left-1/2 -translate-x-1/2 z-30 flex items-center gap-0.5 px-1.5 py-1 rounded-xl border shadow-lg backdrop-blur-md transition-opacity duration-150 ${
              selected || activePopover || isResizing
                ? 'opacity-100 pointer-events-auto'
                : 'opacity-0 group-hover:opacity-100 pointer-events-none group-hover:pointer-events-auto'
            }`}
            style={{
              backgroundColor: 'var(--app-bg-primary, #ffffff)',
              borderColor: 'var(--app-border, rgba(55,53,47,0.12))',
              color: 'var(--app-text-primary, #37352F)'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Primary Studio / Remove Background CTA */}
            <button
              type="button"
              onClick={() => {
                setActivePopover(null)
                setIsStudioOpen(true)
              }}
              className="px-2 py-1 rounded-lg bg-[#2383E2] hover:bg-[#1c72c8] text-white text-[11px] font-semibold flex items-center gap-1 transition cursor-pointer whitespace-nowrap"
              title="Abrir Estudio de Foto: recortar, quitar fondo, filtros, ajustes y anotar"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Editar / Fondo</span>
            </button>

            <div className="w-px h-4 bg-[var(--app-border)] mx-0.5" />

            {/* Aspect Ratio Popover Toggle */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setActivePopover((p) => (p === 'aspect' ? null : 'aspect'))}
                className={`px-1.5 py-1 rounded-md text-[11px] font-medium flex items-center gap-1 transition cursor-pointer whitespace-nowrap ${
                  activePopover === 'aspect' || aspectRatio !== 'auto'
                    ? 'bg-[#2383E2]/12 text-[#2383E2]'
                    : 'hover:bg-black/5 dark:hover:bg-white/10'
                }`}
                title="Aspecto y tamaño"
              >
                <Crop className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">
                  {aspectRatio === 'auto' ? 'Aspecto' : aspectRatio.replace('/', ':')}
                </span>
              </button>

              {activePopover === 'aspect' && (
                <div
                  className="absolute top-full left-0 mt-2 w-60 p-3 rounded-xl border shadow-xl z-40 space-y-3"
                  style={{
                    backgroundColor: 'var(--app-bg-primary)',
                    borderColor: 'var(--app-border)'
                  }}
                >
                  <div className="space-y-1.5">
                    <div className="text-[10px] font-semibold uppercase tracking-wider text-[var(--app-text-secondary)]">
                      Relación de aspecto
                    </div>
                    <div className="grid grid-cols-4 gap-1">
                      {ASPECT_RATIO_OPTIONS.map((opt) => (
                        <button
                          key={opt.id}
                          type="button"
                          onClick={() => updateAttributes({ aspectRatio: opt.id })}
                          className={`py-1 rounded-md text-[11px] font-medium border transition cursor-pointer ${
                            aspectRatio === opt.id
                              ? 'bg-[#2383E2] text-white border-[#2383E2]'
                              : 'border-[var(--app-border)] hover:bg-black/5 dark:hover:bg-white/5'
                          }`}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {aspectRatio !== 'auto' && (
                    <div className="space-y-1.5">
                      <div className="text-[10px] font-semibold uppercase tracking-wider text-[var(--app-text-secondary)]">
                        Encuadre
                      </div>
                      <div className="grid grid-cols-2 gap-1">
                        {(
                          [
                            { id: 'cover', label: 'Rellenar (Cover)' },
                            { id: 'contain', label: 'Ajustar (Contain)' }
                          ] as const
                        ).map((m) => (
                          <button
                            key={m.id}
                            type="button"
                            onClick={() => updateAttributes({ objectFit: m.id })}
                            className={`py-1 rounded-md text-[11px] font-medium border transition cursor-pointer ${
                              objectFit === m.id
                                ? 'bg-[#2383E2]/15 text-[#2383E2] border-[#2383E2]'
                                : 'border-[var(--app-border)] hover:bg-black/5 dark:hover:bg-white/5'
                            }`}
                          >
                            {m.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="space-y-1.5">
                    <div className="text-[10px] font-semibold uppercase tracking-wider text-[var(--app-text-secondary)]">
                      Ancho en la nota
                    </div>
                    <div className="grid grid-cols-4 gap-1">
                      {['25%', '50%', '75%', '100%'].map((w) => (
                        <button
                          key={w}
                          type="button"
                          onClick={() => updateAttributes({ width: w })}
                          className={`py-1 rounded-md text-[11px] font-medium border transition cursor-pointer ${
                            width === w
                              ? 'bg-[#2383E2] text-white border-[#2383E2]'
                              : 'border-[var(--app-border)] hover:bg-black/5 dark:hover:bg-white/5'
                          }`}
                        >
                          {w}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Style / Appearance Popover Toggle */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setActivePopover((p) => (p === 'style' ? null : 'style'))}
                className={`px-1.5 py-1 rounded-md text-[11px] font-medium flex items-center gap-1 transition cursor-pointer whitespace-nowrap ${
                  activePopover === 'style' ||
                  frame !== 'none' ||
                  shadow !== 'none' ||
                  filter !== 'none'
                    ? 'bg-[#2383E2]/12 text-[#2383E2]'
                    : 'hover:bg-black/5 dark:hover:bg-white/10'
                }`}
                title="Marco, esquinas, sombra, filtros y rotación"
              >
                <Palette className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Estilo</span>
              </button>

              {activePopover === 'style' && (
                <div
                  className="absolute top-full left-1/2 -translate-x-1/2 mt-2 w-72 p-3 rounded-xl border shadow-xl z-40 space-y-3 max-h-[70vh] overflow-y-auto"
                  style={{
                    backgroundColor: 'var(--app-bg-primary)',
                    borderColor: 'var(--app-border)'
                  }}
                >
                  {/* Frame */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--app-text-secondary)]">
                        Marco
                      </span>
                      <button
                        type="button"
                        onClick={handleResetAppearance}
                        className="text-[10px] text-[#2383E2] hover:underline flex items-center gap-0.5 cursor-pointer"
                      >
                        <RefreshCw className="w-2.5 h-2.5" />
                        Restablecer
                      </button>
                    </div>
                    <div className="grid grid-cols-5 gap-1">
                      {(
                        [
                          { id: 'none', label: 'Sin' },
                          { id: 'thin', label: 'Fino' },
                          { id: 'card', label: 'Card' },
                          { id: 'polaroid', label: 'Polaroid' },
                          { id: 'browser', label: 'Web' }
                        ] as const
                      ).map((f) => (
                        <button
                          key={f.id}
                          type="button"
                          onClick={() => updateAttributes({ frame: f.id })}
                          className={`py-1 rounded-md text-[10px] font-medium border transition cursor-pointer ${
                            frame === f.id
                              ? 'bg-[#2383E2] text-white border-[#2383E2]'
                              : 'border-[var(--app-border)] hover:bg-black/5 dark:hover:bg-white/5'
                          }`}
                        >
                          {f.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Border Radius */}
                  <div className="space-y-1.5">
                    <div className="text-[10px] font-semibold uppercase tracking-wider text-[var(--app-text-secondary)]">
                      Esquinas
                    </div>
                    <div className="grid grid-cols-5 gap-1">
                      {(
                        [
                          { id: 'none', label: 'Recto' },
                          { id: 'sm', label: 'S' },
                          { id: 'md', label: 'M' },
                          { id: 'lg', label: 'L' },
                          { id: 'full', label: 'Círculo' }
                        ] as const
                      ).map((r) => (
                        <button
                          key={r.id}
                          type="button"
                          onClick={() => updateAttributes({ borderRadius: r.id })}
                          className={`py-1 rounded-md text-[10px] font-medium border transition cursor-pointer ${
                            borderRadius === r.id
                              ? 'bg-[#2383E2] text-white border-[#2383E2]'
                              : 'border-[var(--app-border)] hover:bg-black/5 dark:hover:bg-white/5'
                          }`}
                        >
                          {r.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Shadow */}
                  <div className="space-y-1.5">
                    <div className="text-[10px] font-semibold uppercase tracking-wider text-[var(--app-text-secondary)]">
                      Sombra
                    </div>
                    <div className="grid grid-cols-4 gap-1">
                      {(
                        [
                          { id: 'none', label: 'Sin' },
                          { id: 'sm', label: 'Suave' },
                          { id: 'md', label: 'Media' },
                          { id: 'lg', label: 'Flotante' }
                        ] as const
                      ).map((s) => (
                        <button
                          key={s.id}
                          type="button"
                          onClick={() => updateAttributes({ shadow: s.id })}
                          className={`py-1 rounded-md text-[10px] font-medium border transition cursor-pointer ${
                            shadow === s.id
                              ? 'bg-[#2383E2] text-white border-[#2383E2]'
                              : 'border-[var(--app-border)] hover:bg-black/5 dark:hover:bg-white/5'
                          }`}
                        >
                          {s.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Quick Filters */}
                  <div className="space-y-1.5">
                    <div className="text-[10px] font-semibold uppercase tracking-wider text-[var(--app-text-secondary)]">
                      Filtro rápido
                    </div>
                    <div className="grid grid-cols-3 gap-1">
                      {IMAGE_FILTER_PRESETS.slice(0, 9).map((fp) => (
                        <button
                          key={fp.id}
                          type="button"
                          onClick={() => updateAttributes({ filter: fp.id })}
                          className={`py-1 px-1 rounded-md text-[10px] font-medium border truncate transition cursor-pointer ${
                            filter === fp.id
                              ? 'bg-[#2383E2] text-white border-[#2383E2]'
                              : 'border-[var(--app-border)] hover:bg-black/5 dark:hover:bg-white/5'
                          }`}
                        >
                          {fp.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Quick Transform & Opacity */}
                  <div className="space-y-2 pt-1 border-t border-[var(--app-border)]">
                    <div className="grid grid-cols-3 gap-1">
                      <button
                        type="button"
                        onClick={() => updateAttributes({ rotation: (rotation + 90) % 360 })}
                        className="py-1 rounded-md border border-[var(--app-border)] hover:bg-black/5 dark:hover:bg-white/5 text-[10px] flex items-center justify-center gap-1 cursor-pointer"
                      >
                        <RotateCw className="w-3 h-3" />
                        <span>Rotar</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => updateAttributes({ flipH: !flipH })}
                        className={`py-1 rounded-md border text-[10px] flex items-center justify-center gap-1 cursor-pointer ${
                          flipH
                            ? 'bg-[#2383E2]/15 text-[#2383E2] border-[#2383E2]'
                            : 'border-[var(--app-border)] hover:bg-black/5 dark:hover:bg-white/5'
                        }`}
                      >
                        <FlipHorizontal2 className="w-3 h-3" />
                        <span>Espejo H</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => updateAttributes({ flipV: !flipV })}
                        className={`py-1 rounded-md border text-[10px] flex items-center justify-center gap-1 cursor-pointer ${
                          flipV
                            ? 'bg-[#2383E2]/15 text-[#2383E2] border-[#2383E2]'
                            : 'border-[var(--app-border)] hover:bg-black/5 dark:hover:bg-white/5'
                        }`}
                      >
                        <FlipVertical2 className="w-3 h-3" />
                        <span>Espejo V</span>
                      </button>
                    </div>

                    <div className="space-y-1">
                      <div className="flex justify-between text-[10px]">
                        <span className="text-[var(--app-text-secondary)]">Opacidad</span>
                        <span>{opacity}%</span>
                      </div>
                      <input
                        type="range"
                        min={15}
                        max={100}
                        value={opacity}
                        onChange={(e) => updateAttributes({ opacity: Number(e.target.value) })}
                        className="w-full accent-[#2383E2]"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="w-px h-4 bg-[var(--app-border)] mx-0.5" />

            {/* Alignment Buttons */}
            <button
              type="button"
              onClick={() => updateAttributes({ align: 'left' })}
              className={`p-1 rounded-md transition cursor-pointer ${
                align === 'left'
                  ? 'bg-[#2383E2]/15 text-[#2383E2]'
                  : 'hover:bg-black/5 dark:hover:bg-white/10'
              }`}
              title="Alinear a la izquierda"
            >
              <AlignLeft className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => updateAttributes({ align: 'center' })}
              className={`p-1 rounded-md transition cursor-pointer ${
                align === 'center'
                  ? 'bg-[#2383E2]/15 text-[#2383E2]'
                  : 'hover:bg-black/5 dark:hover:bg-white/10'
              }`}
              title="Centrar"
            >
              <AlignCenter className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => updateAttributes({ align: 'right' })}
              className={`p-1 rounded-md transition cursor-pointer ${
                align === 'right'
                  ? 'bg-[#2383E2]/15 text-[#2383E2]'
                  : 'hover:bg-black/5 dark:hover:bg-white/10'
              }`}
              title="Alinear a la derecha"
            >
              <AlignRight className="w-3.5 h-3.5" />
            </button>

            <div className="w-px h-4 bg-[var(--app-border)] mx-0.5" />

            {/* Utility Actions */}
            <button
              type="button"
              onClick={() => setIsLightboxOpen(true)}
              className="p-1 rounded-md hover:bg-black/5 dark:hover:bg-white/10 transition cursor-pointer"
              title="Ver en pantalla completa"
            >
              <Maximize2 className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => replaceInputRef.current?.click()}
              className="p-1 rounded-md hover:bg-black/5 dark:hover:bg-white/10 transition cursor-pointer"
              title="Reemplazar foto"
            >
              <Replace className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={handleDuplicate}
              className="p-1 rounded-md hover:bg-black/5 dark:hover:bg-white/10 transition cursor-pointer"
              title="Duplicar foto"
            >
              <Copy className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={handleDownload}
              className="p-1 rounded-md hover:bg-black/5 dark:hover:bg-white/10 transition cursor-pointer"
              title="Descargar"
            >
              <Download className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={deleteNode}
              className="p-1 rounded-md text-rose-500 hover:bg-rose-500/10 transition cursor-pointer"
              title="Eliminar foto"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Read-only zoom button */}
        {!isEditable && !imgError && (
          <button
            type="button"
            onClick={() => setIsLightboxOpen(true)}
            className="absolute top-2 right-2 z-20 p-1.5 rounded-lg bg-black/55 text-white opacity-0 group-hover:opacity-100 transition cursor-pointer"
            title="Ver en pantalla completa"
          >
            <Maximize2 className="w-3.5 h-3.5" />
          </button>
        )}

        {/* Image Container with Frame & Shadow */}
        <div
          className={`relative transition-all ${frameWrapperClass} ${
            selected && isEditable ? 'ring-2 ring-[#2383E2] ring-offset-2 ring-offset-transparent' : ''
          }`}
          style={{
            borderRadius: frame === 'polaroid' ? '6px' : resolvedRadius,
            boxShadow: resolvedShadow
          }}
        >
          {/* Optional Minimal Browser Frame Top Bar */}
          {frame === 'browser' && (
            <div className="h-6 px-2.5 flex items-center gap-1.5 border-b border-[var(--app-border)] bg-[var(--app-bg-tertiary)]">
              <span className="w-2 h-2 rounded-full bg-rose-400/80" />
              <span className="w-2 h-2 rounded-full bg-amber-400/80" />
              <span className="w-2 h-2 rounded-full bg-emerald-400/80" />
              {attrs.alt && (
                <span className="ml-2 text-[10px] text-[var(--app-text-muted)] truncate">
                  {attrs.alt}
                </span>
              )}
            </div>
          )}

          {imgError ? (
            <div className="p-8 rounded-lg border border-dashed border-[var(--app-border)] flex flex-col items-center justify-center gap-2 text-center bg-[var(--app-bg-secondary)]">
              <ImageIcon className="w-7 h-7 opacity-40" />
              <span className="text-xs text-[var(--app-text-secondary)]">
                No se pudo cargar la imagen
              </span>
              {isEditable && (
                <button
                  type="button"
                  onClick={() => replaceInputRef.current?.click()}
                  className="px-3 py-1 rounded-md bg-[#2383E2] text-white text-xs font-medium cursor-pointer"
                >
                  Reemplazar imagen
                </button>
              )}
            </div>
          ) : (
            <div
              className="overflow-hidden w-full"
              style={{
                aspectRatio: aspectCss !== 'auto' ? aspectCss : undefined,
                borderRadius:
                  frame === 'browser'
                    ? '0px'
                    : frame === 'polaroid'
                    ? '3px'
                    : frame === 'card'
                    ? '8px'
                    : resolvedRadius
              }}
            >
              <img
                src={attrs.src}
                alt={attrs.alt || ''}
                title={attrs.title || undefined}
                draggable={false}
                onError={() => setImgError(true)}
                onDoubleClick={() => {
                  if (isEditable) setIsStudioOpen(true)
                  else setIsLightboxOpen(true)
                }}
                className="w-full block !m-0 !rounded-none transition-transform duration-150"
                style={{
                  height: aspectCss !== 'auto' ? '100%' : 'auto',
                  objectFit: aspectCss !== 'auto' ? objectFit : undefined,
                  filter: filterCss !== 'none' ? filterCss : undefined,
                  transform: imgTransforms.length > 0 ? imgTransforms.join(' ') : undefined,
                  opacity: opacity / 100
                }}
              />
            </div>
          )}

          {/* Left & Right Drag Resize Handles */}
          {isEditable && !imgError && (
            <>
              <div
                contentEditable={false}
                onPointerDown={(e) => startResize(e, 'left')}
                className={`absolute top-1/2 -translate-y-1/2 left-1.5 w-1.5 h-12 max-h-[50%] rounded-full bg-black/55 border border-white/80 cursor-ew-resize transition-opacity z-20 ${
                  selected || isResizing ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
                }`}
                title="Arrastra para cambiar el tamaño"
              />
              <div
                contentEditable={false}
                onPointerDown={(e) => startResize(e, 'right')}
                className={`absolute top-1/2 -translate-y-1/2 right-1.5 w-1.5 h-12 max-h-[50%] rounded-full bg-black/55 border border-white/80 cursor-ew-resize transition-opacity z-20 ${
                  selected || isResizing ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
                }`}
                title="Arrastra para cambiar el tamaño"
              />
            </>
          )}

          {/* Live Width Badge while resizing */}
          {isResizing && liveWidthPct !== null && (
            <div className="absolute bottom-2.5 left-1/2 -translate-x-1/2 px-2 py-0.5 rounded-md bg-black/75 text-white text-[11px] font-medium tabular-nums pointer-events-none z-30">
              {liveWidthPct}%
            </div>
          )}

          {/* Polaroid Caption inside frame */}
          {frame === 'polaroid' && (isEditable || caption) && (
            <input
              type="text"
              value={caption}
              readOnly={!isEditable}
              onChange={(e) => updateAttributes({ caption: e.target.value })}
              placeholder="Añadir pie de foto..."
              className="w-full mt-2.5 text-xs text-center bg-transparent border-none outline-none text-[var(--app-text-secondary)]"
            />
          )}
        </div>

        {/* Standard Caption below image (non-polaroid) */}
        {frame !== 'polaroid' && (caption || (selected && isEditable)) && (
          <input
            type="text"
            value={caption}
            readOnly={!isEditable}
            onChange={(e) => updateAttributes({ caption: e.target.value })}
            placeholder="Añadir pie de foto..."
            className="w-full mt-1.5 text-xs text-center bg-transparent border-none outline-none text-[var(--app-text-secondary)] placeholder:text-[var(--app-text-muted)]"
          />
        )}
      </div>

      {/* Full Photo Studio Modal */}
      {isStudioOpen && (
        <PhotoEditorModal
          isOpen={isStudioOpen}
          imageSrc={attrs.src}
          initialFilter={filter}
          onClose={() => setIsStudioOpen(false)}
          onSave={handleStudioSave}
        />
      )}

      {/* Fullscreen Lightbox */}
      {isLightboxOpen &&
        createPortal(
          <div
            className="fixed inset-0 z-[9999] bg-black/85 backdrop-blur-sm flex flex-col items-center justify-center p-6 animate-in fade-in duration-150"
            onClick={() => setIsLightboxOpen(false)}
          >
            <button
              type="button"
              onClick={() => setIsLightboxOpen(false)}
              className="absolute top-4 right-4 p-2 rounded-lg bg-white/10 hover:bg-white/20 text-white transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
            <img
              src={attrs.src}
              alt={attrs.alt || ''}
              className="max-w-[92vw] max-h-[84vh] object-contain rounded-lg shadow-2xl"
              style={{
                filter: filterCss !== 'none' ? filterCss : undefined,
                transform: imgTransforms.length > 0 ? imgTransforms.join(' ') : undefined
              }}
              onClick={(e) => e.stopPropagation()}
            />
            {caption && <p className="mt-3 text-sm text-white/85 text-center max-w-2xl">{caption}</p>}
          </div>,
          document.body
        )}
    </NodeViewWrapper>
  )
}

export const RichImage = Image.extend({
  name: 'image',
  group: 'block',
  inline: false,
  draggable: true,
  atom: true,

  parseHTML() {
    return [
      {
        tag: this.options.allowBase64 ? 'img[src]' : 'img[src]:not([src^="data:"])',
        getAttrs: (el) => {
          if (!(el instanceof HTMLElement)) return false
          // Never hijack inline emoji <img> tags (Apple Emoji, Twemoji, etc.) as block images
          if (isEmojiImageElement(el)) return false
          return {}
        }
      }
    ]
  },

  addAttributes() {
    return {
      ...this.parent?.(),
      width: {
        default: '100%',
        parseHTML: (el) => el.getAttribute('data-width') || el.getAttribute('width') || '100%',
        renderHTML: (attrs) => (attrs.width ? { 'data-width': attrs.width } : {})
      },
      align: {
        default: 'center',
        parseHTML: (el) => el.getAttribute('data-align') || 'center',
        renderHTML: (attrs) => (attrs.align ? { 'data-align': attrs.align } : {})
      },
      aspectRatio: {
        default: 'auto',
        parseHTML: (el) => el.getAttribute('data-aspect-ratio') || 'auto',
        renderHTML: (attrs) =>
          attrs.aspectRatio && attrs.aspectRatio !== 'auto'
            ? { 'data-aspect-ratio': attrs.aspectRatio }
            : {}
      },
      objectFit: {
        default: 'cover',
        parseHTML: (el) => el.getAttribute('data-object-fit') || 'cover',
        renderHTML: (attrs) =>
          attrs.objectFit && attrs.objectFit !== 'cover'
            ? { 'data-object-fit': attrs.objectFit }
            : {}
      },
      borderRadius: {
        default: 'md',
        parseHTML: (el) => el.getAttribute('data-radius') || 'md',
        renderHTML: (attrs) =>
          attrs.borderRadius && attrs.borderRadius !== 'md'
            ? { 'data-radius': attrs.borderRadius }
            : {}
      },
      frame: {
        default: 'none',
        parseHTML: (el) => el.getAttribute('data-frame') || 'none',
        renderHTML: (attrs) =>
          attrs.frame && attrs.frame !== 'none' ? { 'data-frame': attrs.frame } : {}
      },
      shadow: {
        default: 'none',
        parseHTML: (el) => el.getAttribute('data-shadow') || 'none',
        renderHTML: (attrs) =>
          attrs.shadow && attrs.shadow !== 'none' ? { 'data-shadow': attrs.shadow } : {}
      },
      filter: {
        default: 'none',
        parseHTML: (el) => el.getAttribute('data-filter') || 'none',
        renderHTML: (attrs) =>
          attrs.filter && attrs.filter !== 'none' ? { 'data-filter': attrs.filter } : {}
      },
      rotation: {
        default: 0,
        parseHTML: (el) => Number(el.getAttribute('data-rotation') || 0),
        renderHTML: (attrs) => (attrs.rotation ? { 'data-rotation': String(attrs.rotation) } : {})
      },
      flipH: {
        default: false,
        parseHTML: (el) => el.getAttribute('data-flip-h') === 'true',
        renderHTML: (attrs) => (attrs.flipH ? { 'data-flip-h': 'true' } : {})
      },
      flipV: {
        default: false,
        parseHTML: (el) => el.getAttribute('data-flip-v') === 'true',
        renderHTML: (attrs) => (attrs.flipV ? { 'data-flip-v': 'true' } : {})
      },
      opacity: {
        default: 100,
        parseHTML: (el) => {
          const val = el.getAttribute('data-opacity')
          return val ? Number(val) : 100
        },
        renderHTML: (attrs) =>
          typeof attrs.opacity === 'number' && attrs.opacity !== 100
            ? { 'data-opacity': String(attrs.opacity) }
            : {}
      },
      caption: {
        default: '',
        parseHTML: (el) => el.getAttribute('data-caption') || '',
        renderHTML: (attrs) => (attrs.caption ? { 'data-caption': attrs.caption } : {})
      }
    }
  },

  addNodeView() {
    return ReactNodeViewRenderer(RichImageNodeView)
  }
})
