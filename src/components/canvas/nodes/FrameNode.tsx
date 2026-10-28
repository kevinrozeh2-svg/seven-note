import { memo, useState, useEffect } from 'react'
import { Handle, Position } from '@xyflow/react'
import {
  DeleteIcon,
  PresentationIcon
} from '@blocksuite/icons/rc'
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

  useEffect(() => {
    setTitle(data.title || data.frameTitle || 'Marco')
    setFrameIndex(data.frameIndex || 1)
    setColor(data.color || 'indigo')
    if (data.width) setWidth(data.width)
    if (data.height) setHeight(data.height)
  }, [data.title, data.frameTitle, data.frameIndex, data.color, data.width, data.height])

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
      <div className="p-4 text-[11px] text-zinc-500/60 font-mono select-none pointer-events-none">
        Marco #{frameIndex} • {width} × {height}px
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
