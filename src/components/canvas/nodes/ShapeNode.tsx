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

// Opaque "paper" surfaces with a hairline border and a solid accent (no neon borders, no see-through fills)
type ShapeColor = {
  fill: string
  stroke: string
  text: string
  svgFill: string
  svgCap: string
  svgStroke: string
  accent: string
}

const SHAPE_COLORS: Record<string, ShapeColor> = {
  blue: {
    fill: 'bg-[#e6f2fc] dark:bg-[#172a3d]',
    stroke: 'border-[#c4def5] dark:border-[#264a69]',
    text: 'text-[#12456f] dark:text-[#d3e9fb]',
    svgFill: 'fill-[#e6f2fc] dark:fill-[#172a3d]',
    svgCap: 'fill-[#d5e9f9] dark:fill-[#1e374e]',
    svgStroke: 'stroke-[#c4def5] dark:stroke-[#264a69]',
    accent: '#38a3f0'
  },
  yellow: {
    fill: 'bg-[#fdf6dc] dark:bg-[#352f1a]',
    stroke: 'border-[#f0e3a6] dark:border-[#5a4f22]',
    text: 'text-[#52440c] dark:text-[#fbefb0]',
    svgFill: 'fill-[#fdf6dc] dark:fill-[#352f1a]',
    svgCap: 'fill-[#f8edbd] dark:fill-[#433b20]',
    svgStroke: 'stroke-[#f0e3a6] dark:stroke-[#5a4f22]',
    accent: '#e9b320'
  },
  green: {
    fill: 'bg-[#e2f5e8] dark:bg-[#173225]',
    stroke: 'border-[#b9e5c6] dark:border-[#24543b]',
    text: 'text-[#17482a] dark:text-[#c8f3d6]',
    svgFill: 'fill-[#e2f5e8] dark:fill-[#173225]',
    svgCap: 'fill-[#cfeedb] dark:fill-[#1e402f]',
    svgStroke: 'stroke-[#b9e5c6] dark:stroke-[#24543b]',
    accent: '#2fb26a'
  },
  purple: {
    fill: 'bg-[#efe9fb] dark:bg-[#2a2142]',
    stroke: 'border-[#d9ccf5] dark:border-[#463872]',
    text: 'text-[#3d2a72] dark:text-[#e6d9fb]',
    svgFill: 'fill-[#efe9fb] dark:fill-[#2a2142]',
    svgCap: 'fill-[#e1d7f6] dark:fill-[#352a54]',
    svgStroke: 'stroke-[#d9ccf5] dark:stroke-[#463872]',
    accent: '#9b6bf2'
  },
  rose: {
    fill: 'bg-[#fde8ec] dark:bg-[#38202a]',
    stroke: 'border-[#f6c4cf] dark:border-[#62303f]',
    text: 'text-[#6e1d35] dark:text-[#fbd3dd]',
    svgFill: 'fill-[#fde8ec] dark:fill-[#38202a]',
    svgCap: 'fill-[#f9d6dd] dark:fill-[#452833]',
    svgStroke: 'stroke-[#f6c4cf] dark:stroke-[#62303f]',
    accent: '#f0587a'
  },
  slate: {
    fill: 'bg-[#f3f3f1] dark:bg-[#272727]',
    stroke: 'border-[#e3e2de] dark:border-[#3b3b3b]',
    text: 'text-[#37352f] dark:text-[#e2e2e1]',
    svgFill: 'fill-[#f3f3f1] dark:fill-[#272727]',
    svgCap: 'fill-[#e8e8e5] dark:fill-[#303030]',
    svgStroke: 'stroke-[#e3e2de] dark:stroke-[#3b3b3b]',
    accent: '#8a8a86'
  },
  transparent: {
    fill: 'bg-transparent',
    stroke: 'border-zinc-400/60',
    text: 'text-zinc-700 dark:text-zinc-100',
    svgFill: 'fill-transparent',
    svgCap: 'fill-transparent',
    svgStroke: 'stroke-zinc-400',
    accent: '#a1a1aa'
  }
}

const cardShadow =
  '0 1px 2px rgba(0,0,0,0.12), 0 6px 16px -4px rgba(0,0,0,0.28), inset 0 1px 0 rgba(255,255,255,0.05)'

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
    const borderDashClass = strokeStyle === 'dashed' ? 'border-dashed' : 'border-solid'

    if (shapeType === 'cylinder') {
      return (
        <div
          style={{ width: `${width}px`, height: `${height}px` }}
          className="relative min-w-[160px] min-h-[130px] flex items-center justify-center"
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
              strokeWidth="1.25" vectorEffect="non-scaling-stroke"
              strokeDasharray={strokeStyle === 'dashed' ? '4 3' : 'none'}
              strokeLinejoin="round"
            />
            {/* Cylinder top cap */}
            <ellipse
              cx="50"
              cy="25"
              rx="40"
              ry="15"
              className={`${colorStyle.svgCap} ${colorStyle.svgStroke}`}
              strokeWidth="1.25" vectorEffect="non-scaling-stroke"
              strokeDasharray={strokeStyle === 'dashed' ? '4 3' : 'none'}
            />
          </svg>
          <div className="relative z-10 pt-4 max-w-[110px] text-center">
            {renderTextContent()}
          </div>
        </div>
      )
    }

    if (shapeType === 'ellipse') {
      return (
        <div
          className={`min-w-[160px] min-h-[110px] rounded-full border ${borderDashClass} ${colorStyle.stroke} ${colorStyle.fill} flex items-center justify-center p-4 transition`}
          style={{ width: `${width}px`, height: `${height}px`, boxShadow: cardShadow, borderBottomColor: colorStyle.accent, borderBottomWidth: 3 }}
        >
          {renderTextContent()}
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
            className={`absolute inset-2 rotate-45 border ${borderDashClass} ${colorStyle.stroke} ${colorStyle.fill} rounded-md transition`}
          />
          <div className="relative z-10 max-w-[100px] text-center">
            {renderTextContent()}
          </div>
        </div>
      )
    }

    if (shapeType === 'triangle') {
      return (
        <div
          style={{ width: `${width}px`, height: `${height}px` }}
          className="relative min-w-[160px] min-h-[120px] flex items-center justify-center"
        >
          <svg
            className="absolute inset-0 w-full h-full"
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
          >
            <polygon
              points="50,5 95,92 5,92"
              className={`${colorStyle.svgFill} ${colorStyle.svgStroke}`}
              strokeWidth="1.25" vectorEffect="non-scaling-stroke"
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
          className="relative min-w-[160px] min-h-[140px] flex items-center justify-center"
        >
          <svg
            className="absolute inset-0 w-full h-full"
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
          >
            <polygon
              points="50,5 64,36 98,36 71,57 81,91 50,70 19,91 29,57 2,36 36,36"
              className={`${colorStyle.svgFill} ${colorStyle.svgStroke}`}
              strokeWidth="1.25" vectorEffect="non-scaling-stroke"
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

    // Default: rect or roundedRect -> solid card with hairline border + accent bar
    const isRounded = shapeType === 'roundedRect'
    return (
      <div
        style={{ width: `${width}px`, minHeight: `${height}px`, boxShadow: cardShadow }}
        className={`relative overflow-hidden border ${borderDashClass} ${
          isRounded ? 'rounded-xl' : 'rounded-lg'
        } ${colorStyle.stroke} ${colorStyle.fill} px-4 py-3 flex items-center justify-center transition`}
      >
        <span
          aria-hidden
          className="absolute left-0 top-0 bottom-0 w-[4px]"
          style={{ backgroundColor: colorStyle.accent }}
        />
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
          onPointerDown={(e) => e.stopPropagation()}
          placeholder="Escribir..."
          className="nodrag nowheel w-full text-center bg-transparent border-none outline-none resize-none text-xs font-medium text-zinc-100 placeholder:text-zinc-500 leading-snug select-text"
          rows={3}
        />
      )
    }

    return (
      <div
        onDoubleClick={() => setIsEditing(true)}
        onPointerDown={(e) => e.stopPropagation()}
        className="nodrag cursor-text text-center text-xs font-medium select-text w-full break-words leading-snug"
      >
        {content ? (
          <span className={colorStyle.text}>{content}</span>
        ) : (
          <span className="text-zinc-500 italic text-[11px] select-none">Doble clic para editar texto</span>
        )}
      </div>
    )
  }

  return (
    <div
      className={`relative group ${
        selected ? 'ring-2 ring-indigo-500 ring-offset-2 ring-offset-[var(--app-bg-canvas)]' : ''
      }`}
      onMouseEnter={() => setShowToolbar(true)}
      onMouseLeave={() => setShowToolbar(false)}
    >
      {/* 4 Handles for connection arrows */}
      <Handle
        id="top"
        type="source"
        position={Position.Top}
        className="!w-2.5 !h-2.5 !bg-[var(--app-accent)] !border !border-white dark:!border-zinc-800"
      />
      <Handle
        id="bottom"
        type="source"
        position={Position.Bottom}
        className="!w-2.5 !h-2.5 !bg-[var(--app-accent)] !border !border-white dark:!border-zinc-800"
      />
      <Handle
        id="left"
        type="source"
        position={Position.Left}
        className="!w-2.5 !h-2.5 !bg-[var(--app-accent)] !border !border-white dark:!border-zinc-800"
      />
      <Handle
        id="right"
        type="source"
        position={Position.Right}
        className="!w-2.5 !h-2.5 !bg-[var(--app-accent)] !border !border-white dark:!border-zinc-800"
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
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.25" vectorEffect="non-scaling-stroke">
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
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.25" vectorEffect="non-scaling-stroke">
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
