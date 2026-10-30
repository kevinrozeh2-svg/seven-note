import { memo, useState, useEffect } from 'react'
import { Handle, Position } from '@xyflow/react'
import {
  DeleteIcon,
  PresentationIcon
} from '@blocksuite/icons/rc'
import { SlidersHorizontal, FileText } from 'lucide-react'
import { db } from '../../../db'
import { syncEngine } from '../../../lib/syncEngine'
import { areNodePropsEqual } from './nodeUtils'

const FRAME_COLORS: Record<string, { border: string; bg: string; badge: string }> = {
  indigo: {
    border: 'border-indigo-500/60',
    bg: 'bg-indigo-950/10',
    badge: 'bg-indigo-600 text-white'
  },
  blue: {
    border: 'border-sky-500/60',
    bg: 'bg-sky-950/10',
    badge: 'bg-sky-600 text-white'
  },
  emerald: {
    border: 'border-emerald-500/60',
    bg: 'bg-emerald-950/10',
    badge: 'bg-emerald-600 text-white'
  },
  purple: {
    border: 'border-purple-500/60',
    bg: 'bg-purple-950/10',
    badge: 'bg-purple-600 text-white'
  },
  amber: {
    border: 'border-amber-500/60',
    bg: 'bg-amber-950/10',
    badge: 'bg-amber-600 text-white'
  },
  zinc: {
    border: 'border-zinc-700',
    bg: 'bg-zinc-900/10',
    badge: 'bg-zinc-800 text-zinc-300'
  }
}

export const FrameNode = memo(({ id, data, selected }: any) => {
  const [title, setTitle] = useState(data.title || data.frameTitle || 'Marco')
  const [frameIndex, setFrameIndex] = useState(data.frameIndex || 1)
  const [color, setColor] = useState(data.color || 'indigo')
  const [isEditingTitle, setIsEditingTitle] = useState(false)
  const [width, setWidth] = useState(data.width || 640)
  const [height, setHeight] = useState(data.height || 420)
  const [isResizing, setIsResizing] = useState(false)
  const [frameBgStyle, setFrameBgStyle] = useState<'default' | 'dark' | 'gradient' | 'dots' | 'glass'>(
    data.frameBgStyle || 'default'
  )
  const [speakerNotes, setSpeakerNotes] = useState(data.speakerNotes || '')
  const [showNotesPopover, setShowNotesPopover] = useState(false)
  const [showOptionsPopover, setShowOptionsPopover] = useState(false)
  const [hideHeaderInPresentation, setHideHeaderInPresentation] = useState(
    data.hideHeaderInPresentation ?? false
  )

  useEffect(() => {
    setTitle(data.title || data.frameTitle || 'Marco')
    setFrameIndex(data.frameIndex || 1)
    setColor(data.color || 'indigo')
    if (data.width) setWidth(data.width)
    if (data.height) setHeight(data.height)
    if (data.frameBgStyle) setFrameBgStyle(data.frameBgStyle)
    if (data.speakerNotes !== undefined) setSpeakerNotes(data.speakerNotes)
    if (data.hideHeaderInPresentation !== undefined) setHideHeaderInPresentation(data.hideHeaderInPresentation)
  }, [
    data.title,
    data.frameTitle,
    data.frameIndex,
    data.color,
    data.width,
    data.height,
    data.frameBgStyle,
    data.speakerNotes,
    data.hideHeaderInPresentation
  ])

  const colorStyle = FRAME_COLORS[color] || FRAME_COLORS.indigo

  const save = async (updates: any) => {
    try {
      const node = await db.canvasNodes.get(id)
      if (node) {
        await db.canvasNodes.update(id, {
          data: { ...node.data, ...updates },
          updatedAt: Date.now(),
          syncStatus: 'pending'
        })
        syncEngine.scheduleSync(1200)
      }
    } catch (e) {
      console.error('Error saving frame node', e)
    }
  }

  const handleDelete = async () => {
    try {
      await db.canvasNodes.update(id, {
        isDeleted: true,
        updatedAt: Date.now(),
        syncStatus: 'pending'
      })
      syncEngine.scheduleSync(1000)
    } catch (e) {
      console.error('Error deleting frame node', e)
    }
  }

  const handleStartPresentation = () => {
    window.dispatchEvent(
      new CustomEvent('seven-note-start-presentation', {
        detail: { frameId: id, frameIndex }
      })
    )
  }

  // Handle bottom-right resize drag
  const handleResizeMouseDown = (e: React.MouseEvent) => {
    e.stopPropagation()
    setIsResizing(true)
    const startX = e.clientX
    const startY = e.clientY
    const startW = width
    const startH = height
    let finalW = startW
    let finalH = startH

    const onMouseMove = (moveEvt: MouseEvent) => {
      finalW = Math.max(280, startW + (moveEvt.clientX - startX))
      finalH = Math.max(180, startH + (moveEvt.clientY - startY))
      setWidth(finalW)
      setHeight(finalH)
    }

    const onMouseUp = () => {
      setIsResizing(false)
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseup', onMouseUp)
      save({ width: finalW, height: finalH })
    }

    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup', onMouseUp)
  }

  return (
    <div
      style={{ width: `${width}px`, height: `${height}px` }}
      className={`relative rounded-2xl border-2 border-dashed ${colorStyle.border} ${colorStyle.bg} ${isResizing ? 'opacity-90 ring-1 ring-indigo-400' : ''} transition-[border-color,background-color] duration-75 flex flex-col justify-between group ${
        isResizing ? 'cursor-se-resize select-none' : ''
      } ${
        selected ? 'ring-2 ring-indigo-500 ring-offset-2 ring-offset-[var(--app-bg-canvas)] shadow-2xl' : ''
      }`}
    >
      {/* 4 Handles for connection arrows */}
      <Handle
        id="top"
        type="source"
        position={Position.Top}
        className="!w-3 !h-3 !bg-indigo-500 !border-2 !border-white dark:!border-zinc-900"
      />
      <Handle
        id="bottom"
        type="source"
        position={Position.Bottom}
        className="!w-3 !h-3 !bg-indigo-500 !border-2 !border-white dark:!border-zinc-900"
      />
      <Handle
        id="left"
        type="source"
        position={Position.Left}
        className="!w-3 !h-3 !bg-indigo-500 !border-2 !border-white dark:!border-zinc-900"
      />
      <Handle
        id="right"
        type="source"
        position={Position.Right}
        className="!w-3 !h-3 !bg-indigo-500 !border-2 !border-white dark:!border-zinc-900"
      />

      {/* Frame Top Header Pill (Notion / Milanote Frame Header) */}
      <div className="absolute -top-3.5 left-3 z-20 flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-[var(--app-bg-overlay)] border border-[var(--app-border)] shadow-[var(--app-shadow-card)] text-xs text-[var(--app-text-primary)]">
        {/* Frame index badge */}
        <span className={`px-1.5 py-0.2 rounded text-[10px] font-semibold ${colorStyle.badge}`}>
          #{frameIndex}
        </span>

        {/* Title editing */}
        {isEditingTitle ? (
          <input
            autoFocus
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={() => {
              setIsEditingTitle(false)
              save({ title, frameTitle: title })
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                setIsEditingTitle(false)
                save({ title, frameTitle: title })
              }
            }}
            className="bg-[var(--app-bg-secondary)] border border-[var(--app-border)] rounded px-1.5 py-0.5 text-xs text-[var(--app-text-primary)] outline-none w-32"
          />
        ) : (
          <span
            onDoubleClick={() => setIsEditingTitle(true)}
            className="font-medium text-[var(--app-text-primary)] cursor-text hover:opacity-80 transition max-w-[200px] truncate"
            title="Doble clic para renombrar marco"
          >
            {title}
          </span>
        )}

        {/* Frame Options & Aspect Ratio Menu */}
        <div className="relative">
          <button
            onClick={() => setShowOptionsPopover(!showOptionsPopover)}
            className={`p-1 rounded-md transition hover:bg-[var(--app-hover)] ${showOptionsPopover ? 'text-indigo-400 font-bold' : 'text-[var(--app-text-secondary)]'}`}
            title="Ajustes de Diapositiva (Proporción, Fondo, Ocultar cabecera)"
          >
            <SlidersHorizontal className="w-3 h-3" />
          </button>

          {showOptionsPopover && (
            <div
              className="absolute left-0 top-7 w-64 bg-[#18181c] border border-zinc-700/80 rounded-xl shadow-2xl p-2.5 z-50 text-xs space-y-2.5 backdrop-blur-md animate-in fade-in zoom-in-95"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">
                Proporción de Diapositiva
              </div>
              <div className="flex gap-1.5">
                <button
                  onClick={() => {
                    setWidth(720)
                    setHeight(405)
                    save({ width: 720, height: 405, frameAspectRatio: '16:9' })
                  }}
                  className="px-2 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-[11px] font-medium"
                >
                  16:9 (HD)
                </button>
                <button
                  onClick={() => {
                    setWidth(640)
                    setHeight(480)
                    save({ width: 640, height: 480, frameAspectRatio: '4:3' })
                  }}
                  className="px-2 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-[11px] font-medium"
                >
                  4:3
                </button>
                <button
                  onClick={() => {
                    setWidth(500)
                    setHeight(500)
                    save({ width: 500, height: 500, frameAspectRatio: '1:1' })
                  }}
                  className="px-2 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-[11px] font-medium"
                >
                  1:1
                </button>
              </div>

              <div className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">
                Fondo en Presentación
              </div>
              <div className="grid grid-cols-3 gap-1 text-[10px]">
                {(['default', 'dark', 'gradient', 'dots', 'glass'] as const).map((bg) => (
                  <button
                    key={bg}
                    onClick={() => {
                      setFrameBgStyle(bg)
                      save({ frameBgStyle: bg })
                    }}
                    className={`px-2 py-1 rounded border text-center capitalize ${
                      frameBgStyle === bg
                        ? 'bg-indigo-600/30 border-indigo-500 text-white font-semibold'
                        : 'bg-zinc-800/80 border-zinc-700 text-zinc-300 hover:bg-zinc-700'
                    }`}
                  >
                    {bg === 'default' ? 'Lienzo' : bg}
                  </button>
                ))}
              </div>

              <div className="border-t border-zinc-800 pt-1.5 flex items-center justify-between text-[11px]">
                <span className="text-zinc-300">Ocultar cabecera</span>
                <input
                  type="checkbox"
                  checked={hideHeaderInPresentation}
                  onChange={(e) => {
                    setHideHeaderInPresentation(e.target.checked)
                    save({ hideHeaderInPresentation: e.target.checked })
                  }}
                  className="rounded cursor-pointer"
                />
              </div>

              <div className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider pt-1">
                Color de Marco
              </div>
              <div className="flex gap-1.5 items-center">
                {Object.keys(FRAME_COLORS).map((cKey) => (
                  <button
                    key={cKey}
                    onClick={() => {
                      setColor(cKey)
                      save({ color: cKey })
                    }}
                    className={`w-4 h-4 rounded-full border ${
                      cKey === 'indigo'
                        ? 'bg-indigo-500'
                        : cKey === 'blue'
                        ? 'bg-sky-500'
                        : cKey === 'emerald'
                        ? 'bg-emerald-500'
                        : cKey === 'purple'
                        ? 'bg-purple-500'
                        : cKey === 'amber'
                        ? 'bg-amber-500'
                        : 'bg-zinc-600'
                    } ${color === cKey ? 'ring-2 ring-white ring-offset-1 ring-offset-black' : ''}`}
                  />
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Speaker Notes button */}
        <div className="relative">
          <button
            onClick={() => setShowNotesPopover(!showNotesPopover)}
            className={`p-1 rounded-md transition hover:bg-[var(--app-hover)] ${speakerNotes ? 'text-amber-400 font-bold' : 'text-[var(--app-text-secondary)]'}`}
            title="Notas del orador para esta diapositiva"
          >
            <FileText className="w-3 h-3" />
          </button>

          {showNotesPopover && (
            <div
              className="absolute left-0 top-7 w-64 bg-[#18181c] border border-zinc-700 rounded-xl shadow-2xl p-2.5 z-50 text-xs space-y-2 animate-in fade-in zoom-in-95"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="text-[10px] font-bold text-amber-400 uppercase tracking-wider flex items-center justify-between">
                <span>Notas del Orador</span>
                <span className="text-[9px] text-zinc-500">Visible al presentar</span>
              </div>
              <textarea
                value={speakerNotes}
                onChange={(e) => setSpeakerNotes(e.target.value)}
                onBlur={() => save({ speakerNotes })}
                placeholder="Escribe notas o recordatorios que solo tú verás al presentar..."
                className="w-full h-24 bg-zinc-900 border border-zinc-700/80 rounded-lg p-2 text-xs text-zinc-200 outline-none resize-none leading-relaxed"
              />
            </div>
          )}
        </div>

        {/* Play Presentation Slide button */}
        <button
          onClick={handleStartPresentation}
          className="p-1 rounded-md hover:bg-[var(--app-hover)] text-[var(--app-text-secondary)] hover:text-[var(--app-accent)] transition ml-0.5"
          title="Presentar desde esta diapositiva"
        >
          <PresentationIcon style={{ width: 13, height: 13 }} />
        </button>

        {/* Delete Frame */}
        <button
          onClick={handleDelete}
          className="p-1 rounded-md hover:bg-rose-500/10 text-[var(--app-text-muted)] hover:text-rose-500 transition"
          title="Eliminar marco"
        >
          <DeleteIcon style={{ width: 12, height: 12 }} />
        </button>
      </div>

      {/* Frame Interior Watermark Hint */}
      <div className="p-4 text-[11px] text-zinc-500/60 font-mono select-none pointer-events-none flex items-center justify-between">
        <span>
          Marco #{frameIndex} • {width} × {height}px
        </span>
        {speakerNotes && (
          <span className="text-amber-400/80 text-[10px]">📝 Notas de orador</span>
        )}
      </div>

      {/* Bottom right resize handle */}
      <div
        onMouseDown={handleResizeMouseDown}
        className="absolute bottom-1 right-1 w-5 h-5 cursor-se-resize flex items-center justify-center text-zinc-500 hover:text-zinc-200 group-hover:opacity-100 opacity-60 transition"
        title="Arrastra para redimensionar el marco"
      >
        <svg width="10" height="10" viewBox="0 0 10 10" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M9 1L1 9M9 5L5 9M9 9H9.01" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      </div>
    </div>
  )
}, areNodePropsEqual)
