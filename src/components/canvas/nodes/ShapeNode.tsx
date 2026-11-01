import { memo, useState, useEffect } from 'react'
import { db, type ShapeKind } from '../../../db'
import { syncEngine } from '../../../lib/syncEngine'
import { areNodePropsEqual, NodeHandles, SourceNodeBadge, getCardCustomStyle, isColorDark, CardSelectionOverlay } from './nodeUtils'
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
  const [isEditing, setIsEditing] = useState(false)

  useEffect(() => {
    setContent(data.content || '')
    setShapeType(data.shapeType || 'rect')
    setColor(data.color || 'blue')
    setStrokeStyle(data.strokeStyle || 'solid')
  }, [data.content, data.shapeType, data.color, data.strokeStyle])

  const colorStyle = SHAPE_COLORS[color] || SHAPE_COLORS.blue
  const isConnectorActive = Boolean(data?.isConnectorActive)
  const isConnectSource = Boolean(data?.isConnectSource)

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

    // Default: rect or roundedRect - Sleek modern card design supporting all custom card styles
    const isRounded = shapeType === 'roundedRect'
    return (
      <div
        style={{
          width: `${width}px`,
          minHeight: `${height}px`,
          ...customCardStyle
        }}
        className={`group relative overflow-hidden transition-all duration-200 bg-white dark:bg-[#18181b] p-4 flex flex-col items-center justify-center text-center ${
          isRounded ? 'rounded-2xl' : 'rounded-xl'
        }`}
      >
        <div className="relative z-10 w-full flex items-center justify-center">
          {renderTextContent()}
        </div>
      </div>
    )
  }

  const isDarkBg = isColorDark(data?.fillColor)
  const customCardStyle = getCardCustomStyle(data, shapeType === 'roundedRect' ? 16 : 8)

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
          className={`nodrag nowheel w-full text-center bg-transparent border-none outline-none resize-none text-xs md:text-sm font-semibold placeholder:text-zinc-400 dark:placeholder:text-zinc-500 leading-snug select-text ${
            isDarkBg ? 'text-white placeholder:text-zinc-300' : 'text-zinc-900 dark:text-zinc-100'
          }`}
          rows={3}
        />
      )
    }

    return (
      <div
        onDoubleClick={() => setIsEditing(true)}
        className={`nodrag cursor-text text-center text-xs md:text-sm font-semibold select-text w-full break-words leading-snug tracking-tight ${
          isDarkBg ? 'text-white' : 'text-zinc-900 dark:text-zinc-100'
        }`}
      >
        {content ? (
          <span>{renderWithAppleEmoji(content)}</span>
        ) : (
          <span className={`${isDarkBg ? 'text-zinc-300' : 'text-zinc-400 dark:text-zinc-500'} italic text-[11px] font-normal select-none`}>
            Doble clic para editar texto
          </span>
        )}
      </div>
    )
  }

  return (
    <div
      className={`relative group ${
        isConnectSource
          ? 'ring-4 ring-amber-500 shadow-xl shadow-amber-500/25 scale-[1.02] rounded-xl'
          : isConnectorActive
          ? 'hover:ring-2 hover:ring-blue-500 cursor-pointer rounded-xl'
          : ''
      }`}
    >
      <CardSelectionOverlay selected={selected} />
      <SourceNodeBadge isConnectSource={isConnectSource} isConnectorActive={isConnectorActive} />
      <NodeHandles
        selected={selected}
        isConnectorActive={isConnectorActive}
        isConnectSource={isConnectSource}
      />

      {/* Shape Body */}
      {renderShapeBody()}
    </div>
  )
}, areNodePropsEqual)
