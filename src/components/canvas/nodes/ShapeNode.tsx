import { memo, useState, useEffect } from 'react'
import { Handle, Position } from '@xyflow/react'
import {
  Trash2,
  Square,
  Circle,
  Diamond,
  Triangle,
  Star,
  Type
} from 'lucide-react'
import { db, type ShapeKind } from '../../../db'
import { syncEngine } from '../../../lib/syncEngine'

const SHAPE_COLORS: Record<string, { fill: string; stroke: string; text: string }> = {
  blue: { fill: 'bg-sky-500/20 dark:bg-sky-500/20', stroke: 'border-sky-500', text: 'text-sky-200' },
  yellow: { fill: 'bg-amber-500/20 dark:bg-amber-500/20', stroke: 'border-amber-500', text: 'text-amber-200' },
  green: { fill: 'bg-emerald-500/20 dark:bg-emerald-500/20', stroke: 'border-emerald-500', text: 'text-emerald-200' },
  purple: { fill: 'bg-purple-500/20 dark:bg-purple-500/20', stroke: 'border-purple-500', text: 'text-purple-200' },
  rose: { fill: 'bg-rose-500/20 dark:bg-rose-500/20', stroke: 'border-rose-500', text: 'text-rose-200' },
  slate: { fill: 'bg-zinc-800/60 dark:bg-zinc-800/60', stroke: 'border-zinc-500', text: 'text-zinc-200' },
  transparent: { fill: 'bg-transparent', stroke: 'border-zinc-400', text: 'text-zinc-100' }
}

export const ShapeNode = memo(({ id, data, selected }: any) => {
  const [content, setContent] = useState(data.content || '')
  const [shapeType, setShapeType] = useState<ShapeKind>(data.shapeType || 'rect')
  const [color, setColor] = useState(data.color || 'blue')
  const [showToolbar, setShowToolbar] = useState(false)
  const [isEditing, setIsEditing] = useState(false)

  useEffect(() => {
    setContent(data.content || '')
    setShapeType(data.shapeType || 'rect')
    setColor(data.color || 'blue')
  }, [data.content, data.shapeType, data.color])

  const colorStyle = SHAPE_COLORS[color] || SHAPE_COLORS.blue

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
      console.error('Error saving shape node', e)
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
      console.error('Error deleting shape node', e)
    }
  }

  // Render shape geometry
  const renderShapeBody = () => {
    const width = data.width || 180
    const height = data.height || 120

    if (shapeType === 'ellipse') {
      return (
        <div
          className={`w-[${width}px] min-w-[160px] h-[${height}px] min-h-[110px] rounded-full border-2 ${colorStyle.stroke} ${colorStyle.fill} flex items-center justify-center p-4 transition`}
        >
          {renderTextContent()}
        </div>
      )
    }

    if (shapeType === 'diamond') {
      return (
        <div className="relative w-[160px] h-[160px] flex items-center justify-center">
          <div
            className={`absolute inset-2 rotate-45 border-2 ${colorStyle.stroke} ${colorStyle.fill} rounded-md transition`}
          />
          <div className="relative z-10 max-w-[100px] text-center">
            {renderTextContent()}
          </div>
        </div>
      )
    }

    if (shapeType === 'triangle') {
      return (
        <div className="relative w-[180px] h-[140px] flex items-center justify-center">
          <svg
            className="absolute inset-0 w-full h-full"
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
          >
            <polygon
              points="50,5 95,92 5,92"
              className={`${
                color === 'blue'
                  ? 'fill-sky-500/20 stroke-sky-500'
                  : color === 'yellow'
                  ? 'fill-amber-500/20 stroke-amber-500'
                  : color === 'green'
                  ? 'fill-emerald-500/20 stroke-emerald-500'
                  : color === 'purple'
                  ? 'fill-purple-500/20 stroke-purple-500'
                  : color === 'rose'
                  ? 'fill-rose-500/20 stroke-rose-500'
                  : color === 'slate'
                  ? 'fill-zinc-800/60 stroke-zinc-500'
                  : 'fill-transparent stroke-zinc-400'
              }`}
              strokeWidth="2.5"
              strokeLinejoin="round"
            />
          </svg>
          <div className="relative z-10 pt-6 max-w-[110px] text-center">
            {renderTextContent()}
          </div>
        </div>
      )
    }

    if (shapeType === 'star') {
      return (
        <div className="relative w-[160px] h-[160px] flex items-center justify-center">
          <svg
            className="absolute inset-0 w-full h-full"
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
          >
            <polygon
              points="50,5 64,36 98,36 71,57 81,91 50,70 19,91 29,57 2,36 36,36"
              className={`${
                color === 'blue'
                  ? 'fill-sky-500/20 stroke-sky-500'
                  : color === 'yellow'
                  ? 'fill-amber-500/20 stroke-amber-500'
                  : color === 'green'
                  ? 'fill-emerald-500/20 stroke-emerald-500'
                  : color === 'purple'
                  ? 'fill-purple-500/20 stroke-purple-500'
                  : color === 'rose'
                  ? 'fill-rose-500/20 stroke-rose-500'
                  : color === 'slate'
                  ? 'fill-zinc-800/60 stroke-zinc-500'
                  : 'fill-transparent stroke-zinc-400'
              }`}
              strokeWidth="2"
              strokeLinejoin="round"
            />
          </svg>
          <div className="relative z-10 max-w-[80px] text-center">
            {renderTextContent()}
          </div>
        </div>
      )
    }

    // Default: rect or roundedRect
    const isRounded = shapeType === 'roundedRect'
    return (
      <div
        className={`w-[180px] min-h-[100px] border-2 ${
          isRounded ? 'rounded-2xl' : 'rounded-md'
        } ${colorStyle.stroke} ${colorStyle.fill} p-3 flex items-center justify-center transition shadow-sm`}
      >
        {renderTextContent()}
      </div>
    )
  }

  const renderTextContent = () => {
    if (isEditing) {
      return (
        <textarea
          autoFocus
          value={content}
          onChange={(e) => setContent(e.target.value)}
          onBlur={() => {
            setIsEditing(false)
            save({ content })
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
              setIsEditing(false)
              save({ content })
            }
          }}
          placeholder="Escribir..."
          className="w-full text-center bg-transparent border-none outline-none resize-none text-xs font-medium text-zinc-100 placeholder:text-zinc-500 leading-snug"
          rows={3}
        />
      )
    }

    return (
      <div
        onDoubleClick={() => setIsEditing(true)}
        className="cursor-text text-center text-xs font-medium select-none w-full break-words leading-snug"
      >
        {content ? (
          <span className={colorStyle.text}>{content}</span>
        ) : (
          <span className="text-zinc-500 italic text-[11px]">Doble clic para editar texto</span>
        )}
      </div>
    )
  }

  return (
    <div
      className={`relative group ${
        selected ? 'ring-2 ring-indigo-500 ring-offset-2 ring-offset-[#121214]' : ''
      }`}
      onMouseEnter={() => setShowToolbar(true)}
      onMouseLeave={() => setShowToolbar(false)}
    >
      {/* 4 Handles for AFFiNE connection arrows */}
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

      {/* Floating Toolbar when selected or hovered */}
      {(selected || showToolbar) && (
        <div className="absolute -top-11 left-1/2 -translate-x-1/2 z-30 flex items-center gap-1 p-1 bg-[#18181b] border border-[#2b2b32] rounded-xl shadow-2xl backdrop-blur-md text-zinc-300">
          {/* Shape type selector */}
          <button
            onClick={() => {
              setShapeType('rect')
              save({ shapeType: 'rect' })
            }}
            className={`p-1 rounded hover:bg-[#25252a] ${shapeType === 'rect' ? 'text-blue-400' : 'text-zinc-400'}`}
            title="Rectángulo"
          >
            <Square size={13} />
          </button>
          <button
            onClick={() => {
              setShapeType('ellipse')
              save({ shapeType: 'ellipse' })
            }}
            className={`p-1 rounded hover:bg-[#25252a] ${shapeType === 'ellipse' ? 'text-blue-400' : 'text-zinc-400'}`}
            title="Círculo / Elipse"
          >
            <Circle size={13} />
          </button>
          <button
            onClick={() => {
              setShapeType('diamond')
              save({ shapeType: 'diamond' })
            }}
            className={`p-1 rounded hover:bg-[#25252a] ${shapeType === 'diamond' ? 'text-blue-400' : 'text-zinc-400'}`}
            title="Diamante / Decisión"
          >
            <Diamond size={13} />
          </button>
          <button
            onClick={() => {
              setShapeType('triangle')
              save({ shapeType: 'triangle' })
            }}
            className={`p-1 rounded hover:bg-[#25252a] ${shapeType === 'triangle' ? 'text-blue-400' : 'text-zinc-400'}`}
            title="Triángulo"
          >
            <Triangle size={13} />
          </button>
          <button
            onClick={() => {
              setShapeType('star')
              save({ shapeType: 'star' })
            }}
            className={`p-1 rounded hover:bg-[#25252a] ${shapeType === 'star' ? 'text-blue-400' : 'text-zinc-400'}`}
            title="Estrella / Hito"
          >
            <Star size={13} />
          </button>

          <div className="w-[1px] h-3.5 bg-[#2d2d34] mx-0.5" />

          {/* Color palette */}
          {['blue', 'yellow', 'green', 'purple', 'rose', 'slate'].map((col) => (
            <button
              key={col}
              onClick={() => {
                setColor(col)
                save({ color: col })
              }}
              className={`w-3.5 h-3.5 rounded-full ${
                col === 'blue'
                  ? 'bg-sky-400'
                  : col === 'yellow'
                  ? 'bg-amber-400'
                  : col === 'green'
                  ? 'bg-emerald-400'
                  : col === 'purple'
                  ? 'bg-purple-400'
                  : col === 'rose'
                  ? 'bg-rose-400'
                  : 'bg-zinc-500'
              } ${color === col ? 'ring-1 ring-white' : ''}`}
            />
          ))}

          <div className="w-[1px] h-3.5 bg-[#2d2d34] mx-0.5" />

          {/* Edit text button */}
          <button
            onClick={() => setIsEditing(!isEditing)}
            className="p-1 rounded hover:bg-[#25252a] text-zinc-400 hover:text-zinc-200"
            title="Editar texto"
          >
            <Type size={13} />
          </button>

          {/* Delete shape */}
          <button
            onClick={handleDelete}
            className="p-1 rounded hover:bg-rose-950/50 text-zinc-400 hover:text-rose-400"
            title="Eliminar forma"
          >
            <Trash2 size={13} />
          </button>
        </div>
      )}

      {/* Shape Body */}
      {renderShapeBody()}
    </div>
  )
})
