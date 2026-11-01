import { memo, useState, useEffect } from 'react'
import { Handle, Position } from '@xyflow/react'
import {
  DeleteIcon,
  SquareIcon,
  EllipseIcon,
  DiamondIcon,
  TriangleIcon,
  StarIcon,
  TextIcon
} from '@blocksuite/icons/rc'
import { db, type ShapeKind } from '../../../db'
import { syncEngine } from '../../../lib/syncEngine'
import { areNodePropsEqual } from './nodeUtils'
import { renderWithAppleEmoji } from '../../ui/AppleEmoji'

const SHAPE_COLORS: Record<string, {
  cardBorder: string
  topGlow: string
  accentBar: string
  dot: string
  svgFill: string
  svgStroke: string
  text: string
}> = {
  blue: {
    cardBorder: '',
    topGlow: '',
    accentBar: '',
    dot: '#71717a',
    svgFill: 'fill-zinc-100 dark:fill-zinc-800/80',
    svgStroke: 'stroke-zinc-300 dark:stroke-zinc-700',
    text: 'text-zinc-900 dark:text-zinc-100'
  },
  yellow: {
    cardBorder: '',
    topGlow: '',
    accentBar: '',
    dot: '#71717a',
    svgFill: 'fill-zinc-100 dark:fill-zinc-800/80',
    svgStroke: 'stroke-zinc-300 dark:stroke-zinc-700',
    text: 'text-zinc-900 dark:text-zinc-100'
  },
  green: {
    cardBorder: '',
    topGlow: '',
    accentBar: '',
    dot: '#71717a',
    svgFill: 'fill-zinc-100 dark:fill-zinc-800/80',
    svgStroke: 'stroke-zinc-300 dark:stroke-zinc-700',
    text: 'text-zinc-900 dark:text-zinc-100'
  },
  purple: {
    cardBorder: '',
    topGlow: '',
    accentBar: '',
    dot: '#71717a',
    svgFill: 'fill-zinc-100 dark:fill-zinc-800/80',
    svgStroke: 'stroke-zinc-300 dark:stroke-zinc-700',
    text: 'text-zinc-900 dark:text-zinc-100'
  },
  rose: {
    cardBorder: '',
    topGlow: '',
    accentBar: '',
    dot: '#71717a',
    svgFill: 'fill-zinc-100 dark:fill-zinc-800/80',
    svgStroke: 'stroke-zinc-300 dark:stroke-zinc-700',
    text: 'text-zinc-900 dark:text-zinc-100'
  },
  slate: {
    cardBorder: '',
    topGlow: '',
    accentBar: '',
    dot: '#71717a',
    svgFill: 'fill-zinc-100 dark:fill-zinc-800/80',
    svgStroke: 'stroke-zinc-300 dark:stroke-zinc-700',
    text: 'text-zinc-900 dark:text-zinc-100'
  },
  transparent: {
    cardBorder: '',
    topGlow: '',
    accentBar: '',
    dot: '#a1a1aa',
    svgFill: 'fill-transparent',
    svgStroke: 'stroke-zinc-400 dark:stroke-zinc-600',
    text: 'text-zinc-900 dark:text-zinc-100'
  }
}

export const ShapeNode = memo(({ id, data, selected }: any) => {
  const [content, setContent] = useState(data.content || '')
  const [shapeType, setShapeType] = useState<ShapeKind>(data.shapeType || 'rect')
  const [color, setColor] = useState(data.color || 'blue')
  const [strokeStyle, setStrokeStyle] = useState<'solid' | 'dashed'>(data.strokeStyle || 'solid')
  const [showToolbar, setShowToolbar] = useState(false)
  const [isEditing, setIsEditing] = useState(false)

  useEffect(() => {
    setContent(data.content || '')
    setShapeType(data.shapeType || 'rect')
    setColor(data.color || 'blue')
    setStrokeStyle(data.strokeStyle || 'solid')
  }, [data.content, data.shapeType, data.color, data.strokeStyle])

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

    if (shapeType === 'cylinder') {
      return (
        <div
          style={{ width: `${width}px`, height: `${height}px` }}
          className="relative min-w-[160px] min-h-[130px] flex items-center justify-center filter drop-shadow-sm"
        >
          <svg
            className="absolute inset-0 w-full h-full"
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
          >
            {/* Cylinder body path */}
            <path
              d="M10,25 V75 C10,88 90,88 90,75 V25 Z"
              className={`${colorStyle.svgFill} ${colorStyle.svgStroke}`}
              strokeWidth="1.5"
              strokeDasharray={strokeStyle === 'dashed' ? '4 3' : 'none'}
              strokeLinejoin="round"
            />
            {/* Cylinder top cap */}
            <ellipse
              cx="50"
              cy="25"
              rx="40"
              ry="15"
              className={`${colorStyle.svgFill} ${colorStyle.svgStroke}`}
              strokeWidth="1.5"
              strokeDasharray={strokeStyle === 'dashed' ? '4 3' : 'none'}
            />
          </svg>
          <div className="relative z-10 pt-4 max-w-[120px] text-center">
            {renderTextContent()}
          </div>
        </div>
      )
    }

    if (shapeType === 'ellipse') {
      return (
        <div
          style={{ width: `${width}px`, height: `${height}px` }}
          className="min-w-[160px] min-h-[110px] rounded-full bg-white dark:bg-[#18181b] flex items-center justify-center p-4 transition shadow-md hover:shadow-lg relative overflow-hidden"
        >
          <div className="relative z-10 w-full">{renderTextContent()}</div>
        </div>
      )
    }

    if (shapeType === 'diamond') {
      const dSize = Math.max(160, Math.min(width, height))
      return (
        <div
          style={{ width: `${dSize}px`, height: `${dSize}px` }}
          className="relative flex items-center justify-center"
        >
          <div
            className="absolute inset-2 rotate-45 bg-white dark:bg-[#18181b] rounded-xl shadow-md transition"
          />
          <div className="relative z-10 max-w-[110px] text-center">
            {renderTextContent()}
          </div>
        </div>
      )
    }

    if (shapeType === 'triangle') {
      return (
        <div
          style={{ width: `${width}px`, height: `${height}px` }}
          className="relative min-w-[160px] min-h-[120px] flex items-center justify-center filter drop-shadow-sm"
        >
          <svg
            className="absolute inset-0 w-full h-full"
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
          >
            <polygon
              points="50,6 94,92 6,92"
              className={`${colorStyle.svgFill} ${colorStyle.svgStroke}`}
              strokeWidth="1.5"
              strokeDasharray={strokeStyle === 'dashed' ? '5 4' : 'none'}
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
        <div
          style={{ width: `${width}px`, height: `${height}px` }}
          className="relative min-w-[160px] min-h-[140px] flex items-center justify-center filter drop-shadow-sm"
        >
          <svg
            className="absolute inset-0 w-full h-full"
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
          >
            <polygon
              points="50,5 64,36 98,36 71,57 81,91 50,70 19,91 29,57 2,36 36,36"
              className={`${colorStyle.svgFill} ${colorStyle.svgStroke}`}
              strokeWidth="1.5"
              strokeDasharray={strokeStyle === 'dashed' ? '5 4' : 'none'}
              strokeLinejoin="round"
            />
          </svg>
          <div className="relative z-10 max-w-[80px] text-center">
            {renderTextContent()}
          </div>
        </div>
      )
    }

    // Default: rect or roundedRect - Sleek modern borderless card design without colors or borders
    const isRounded = shapeType === 'roundedRect'
    return (
      <div
        style={{ width: `${width}px`, minHeight: `${height}px` }}
        className={`group relative overflow-hidden transition-all duration-200 bg-white dark:bg-[#18181b] p-4 flex flex-col items-center justify-center text-center ${
          isRounded ? 'rounded-2xl shadow-lg' : 'rounded-xl shadow-md'
        } hover:shadow-xl`}
      >
        <div className="relative z-10 w-full flex items-center justify-center">
          {renderTextContent()}
        </div>
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
          onPointerDown={(e) => e.stopPropagation()}
          placeholder="Escribir título..."
          className="nodrag nowheel w-full text-center bg-transparent border-none outline-none resize-none text-xs md:text-sm font-semibold text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 dark:placeholder:text-zinc-500 leading-snug select-text"
          rows={3}
        />
      )
    }

    return (
      <div
        onDoubleClick={() => setIsEditing(true)}
        onPointerDown={(e) => e.stopPropagation()}
        className="nodrag cursor-text text-center text-xs md:text-sm font-semibold select-text w-full break-words leading-snug tracking-tight text-zinc-900 dark:text-zinc-100"
      >
        {content ? (
          <span>{renderWithAppleEmoji(content)}</span>
        ) : (
          <span className="text-zinc-400 dark:text-zinc-500 italic text-[11px] font-normal select-none">
            Doble clic para editar texto
          </span>
        )}
      </div>
    )
  }

  return (
    <div
      className={`relative group ${
        selected ? 'ring-2 ring-indigo-500 ring-offset-2 ring-offset-[var(--app-bg-canvas)] rounded-xl' : ''
      }`}
      onMouseEnter={() => setShowToolbar(true)}
      onMouseLeave={() => setShowToolbar(false)}
    >
      {/* 4 Handles for connection arrows */}
      <Handle
        id="top"
        type="source"
        position={Position.Top}
        className={`!w-2.5 !h-2.5 !bg-zinc-400 dark:!bg-zinc-500 hover:!bg-[var(--app-accent)] !border-2 !border-white dark:!border-zinc-900 transition-all opacity-0 group-hover:opacity-100 ${
          selected ? '!opacity-100' : ''
        }`}
      />
      <Handle
        id="bottom"
        type="source"
        position={Position.Bottom}
        className={`!w-2.5 !h-2.5 !bg-zinc-400 dark:!bg-zinc-500 hover:!bg-[var(--app-accent)] !border-2 !border-white dark:!border-zinc-900 transition-all opacity-0 group-hover:opacity-100 ${
          selected ? '!opacity-100' : ''
        }`}
      />
      <Handle
        id="left"
        type="source"
        position={Position.Left}
        className={`!w-2.5 !h-2.5 !bg-zinc-400 dark:!bg-zinc-500 hover:!bg-[var(--app-accent)] !border-2 !border-white dark:!border-zinc-900 transition-all opacity-0 group-hover:opacity-100 ${
          selected ? '!opacity-100' : ''
        }`}
      />
      <Handle
        id="right"
        type="source"
        position={Position.Right}
        className={`!w-2.5 !h-2.5 !bg-zinc-400 dark:!bg-zinc-500 hover:!bg-[var(--app-accent)] !border-2 !border-white dark:!border-zinc-900 transition-all opacity-0 group-hover:opacity-100 ${
          selected ? '!opacity-100' : ''
        }`}
      />

      {/* Floating Toolbar when selected or hovered */}
      {(selected || showToolbar) && (
        <div
          className="absolute -top-11 left-1/2 -translate-x-1/2 z-30 flex items-center gap-1 p-1 rounded-lg border shadow-md bg-[var(--app-bg-overlay)] border-[var(--app-border)] text-[var(--app-text-primary)]"
        >
          {/* Shape type selector */}
          <button
            onClick={() => {
              setShapeType('rect')
              save({ shapeType: 'rect' })
            }}
            className="p-1 rounded transition"
            style={{ color: shapeType === 'rect' ? '#1e96eb' : 'var(--affine-text-secondary-color)' }}
            title="Rectángulo"
          >
            <SquareIcon style={{ width: 14, height: 14 }} />
          </button>
          <button
            onClick={() => {
              setShapeType('ellipse')
              save({ shapeType: 'ellipse' })
            }}
            className="p-1 rounded transition"
            style={{ color: shapeType === 'ellipse' ? '#1e96eb' : 'var(--affine-text-secondary-color)' }}
            title="Círculo / Elipse"
          >
            <EllipseIcon style={{ width: 14, height: 14 }} />
          </button>
          <button
            onClick={() => {
              setShapeType('diamond')
              save({ shapeType: 'diamond' })
            }}
            className="p-1 rounded transition"
            style={{ color: shapeType === 'diamond' ? '#1e96eb' : 'var(--affine-text-secondary-color)' }}
            title="Diamante / Decisión"
          >
            <DiamondIcon style={{ width: 14, height: 14 }} />
          </button>
          <button
            onClick={() => {
              setShapeType('triangle')
              save({ shapeType: 'triangle' })
            }}
            className="p-1 rounded transition"
            style={{ color: shapeType === 'triangle' ? '#1e96eb' : 'var(--affine-text-secondary-color)' }}
            title="Triángulo"
          >
            <TriangleIcon style={{ width: 14, height: 14 }} />
          </button>
          <button
            onClick={() => {
              setShapeType('star')
              save({ shapeType: 'star' })
            }}
            className="p-1 rounded transition"
            style={{ color: shapeType === 'star' ? '#1e96eb' : 'var(--affine-text-secondary-color)' }}
            title="Estrella / Hito"
          >
            <StarIcon style={{ width: 14, height: 14 }} />
          </button>
          <button
            onClick={() => {
              setShapeType('cylinder')
              save({ shapeType: 'cylinder' })
            }}
            className="p-1 rounded transition"
            style={{ color: shapeType === 'cylinder' ? '#1e96eb' : 'var(--affine-text-secondary-color)' }}
            title="Cilindro / Base de Datos"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M4 6c0 1.66 3.58 3 8 3s8-1.34 8-3" />
              <ellipse cx="12" cy="6" rx="8" ry="3" />
              <path d="M4 6v12c0 1.66 3.58 3 8 3s8-1.34 8-3V6" />
            </svg>
          </button>

          <div
            className="w-[1px] h-3.5 mx-0.5"
            style={{ backgroundColor: 'var(--affine-border-color)' }}
          />

          {/* Stroke style toggle (Solid vs Dashed) */}
          <button
            onClick={() => {
              const nextStyle = strokeStyle === 'solid' ? 'dashed' : 'solid'
              setStrokeStyle(nextStyle)
              save({ strokeStyle: nextStyle })
            }}
            className="p-1 rounded transition text-xs font-semibold"
            style={{ color: strokeStyle === 'dashed' ? '#1e96eb' : 'var(--affine-text-secondary-color)' }}
            title={strokeStyle === 'dashed' ? 'Trazo: Discontinuo (clic para continuo)' : 'Trazo: Continuo (clic para discontinuo)'}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              {strokeStyle === 'dashed' ? (
                <path d="M3 12h4m4 0h4m4 0h3" strokeDasharray="3 3" />
              ) : (
                <path d="M3 12h18" />
              )}
            </svg>
          </button>

          <div
            className="w-[1px] h-3.5 mx-0.5"
            style={{ backgroundColor: 'var(--affine-border-color)' }}
          />

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
              } ${color === col ? 'ring-2 ring-[#1e96eb]' : ''}`}
            />
          ))}

          <div
            className="w-[1px] h-3.5 mx-0.5"
            style={{ backgroundColor: 'var(--affine-border-color)' }}
          />

          {/* Edit text button */}
          <button
            onClick={() => setIsEditing(!isEditing)}
            className="p-1 rounded transition"
            style={{ color: isEditing ? '#1e96eb' : 'var(--affine-text-secondary-color)' }}
            title="Editar texto"
          >
            <TextIcon style={{ width: 14, height: 14 }} />
          </button>

          {/* Delete shape */}
          <button
            onClick={handleDelete}
            className="p-1 rounded text-rose-500 hover:bg-rose-500/10 transition"
            title="Eliminar forma"
          >
            <DeleteIcon style={{ width: 14, height: 14 }} />
          </button>
        </div>
      )}

      {/* Shape Body */}
      {renderShapeBody()}
    </div>
  )
}, areNodePropsEqual)
