import { memo, useState, useEffect } from 'react'
import { Handle, Position } from '@xyflow/react'
import {
  Trash2,
  Presentation,
  Move
} from 'lucide-react'
import { db } from '../../../db'
import { syncEngine } from '../../../lib/syncEngine'

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

    const onMouseMove = (moveEvt: MouseEvent) => {
      const newW = Math.max(280, startW + (moveEvt.clientX - startX))
      const newH = Math.max(180, startH + (moveEvt.clientY - startY))
      setWidth(newW)
      setHeight(newH)
    }

    const onMouseUp = () => {
      setIsResizing(false)
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseup', onMouseUp)
      save({ width, height })
    }

    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup', onMouseUp)
  }

  return (
    <div
      style={{ width: `${width}px`, height: `${height}px` }}
      className={`relative rounded-2xl border-2 border-dashed ${colorStyle.border} ${colorStyle.bg} ${isResizing ? 'opacity-90 ring-1 ring-indigo-400' : ''} transition-all duration-75 flex flex-col justify-between group ${
        isResizing ? 'cursor-se-resize select-none' : ''
      } ${
        selected ? 'ring-2 ring-indigo-500 ring-offset-2 ring-offset-[#121214] shadow-2xl' : ''
      }`}
    >
      {/* 4 Handles for connection arrows */}
      <Handle
        type="target"
        position={Position.Top}
        className="!w-3 !h-3 !bg-indigo-500 !border-2 !border-white dark:!border-zinc-900"
      />
      <Handle
        type="source"
        position={Position.Bottom}
        className="!w-3 !h-3 !bg-indigo-500 !border-2 !border-white dark:!border-zinc-900"
      />
      <Handle
        type="target"
        position={Position.Left}
        className="!w-3 !h-3 !bg-indigo-500 !border-2 !border-white dark:!border-zinc-900"
      />
      <Handle
        type="source"
        position={Position.Right}
        className="!w-3 !h-3 !bg-indigo-500 !border-2 !border-white dark:!border-zinc-900"
      />

      {/* Frame Top Header Pill (AFFiNE Slide / Frame Header) */}
      <div className="absolute -top-4 left-3 z-20 flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#18181b] border border-[#2b2b32] shadow-lg text-xs">
        {/* Frame index badge */}
        <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${colorStyle.badge}`}>
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
            className="bg-[#242428] border border-zinc-700 rounded px-1.5 py-0.5 text-xs text-zinc-100 outline-none w-32"
          />
        ) : (
          <span
            onDoubleClick={() => setIsEditingTitle(true)}
            className="font-medium text-zinc-200 cursor-text hover:text-white transition max-w-[200px] truncate"
            title="Doble clic para renombrar marco"
          >
            {title}
          </span>
        )}

        {/* Play Presentation Slide button */}
        <button
          onClick={handleStartPresentation}
          className="p-1 rounded-md hover:bg-[#25252a] text-zinc-400 hover:text-indigo-400 transition ml-1"
          title="Presentar desde esta diapositiva"
        >
          <Presentation size={13} />
        </button>

        {/* Delete Frame */}
        <button
          onClick={handleDelete}
          className="p-1 rounded-md hover:bg-rose-950/50 text-zinc-500 hover:text-rose-400 transition"
          title="Eliminar marco"
        >
          <Trash2 size={12} />
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
        <Move size={12} className="rotate-45" />
      </div>
    </div>
  )
})
