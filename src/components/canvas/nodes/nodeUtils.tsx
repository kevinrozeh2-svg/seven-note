import React, { memo } from 'react'
import { Handle, Position } from '@xyflow/react'
import { Link2 } from 'lucide-react'

export interface NodeHandlesProps {
  selected?: boolean
  isConnectorActive?: boolean
  isConnectSource?: boolean
  accentColor?: string
}

export function isColorDark(hexColor?: string): boolean {
  if (!hexColor || hexColor === 'transparent') return false
  const c = hexColor.replace('#', '')
  if (c.length === 3) {
    const r = parseInt(c[0] + c[0], 16)
    const g = parseInt(c[1] + c[1], 16)
    const b = parseInt(c[2] + c[2], 16)
    return (r * 299 + g * 587 + b * 114) / 1000 < 128
  }
  if (c.length === 6) {
    const r = parseInt(c.slice(0, 2), 16)
    const g = parseInt(c.slice(2, 4), 16)
    const b = parseInt(c.slice(4, 6), 16)
    return (r * 299 + g * 587 + b * 114) / 1000 < 128
  }
  return false
}

export function getCardCustomStyle(
  data: any,
  defaultRadius: number = 16,
  isDark: boolean = true
): React.CSSProperties {
  const style: React.CSSProperties = {}

  // Fill color
  if (data?.fillColor === 'transparent') {
    style.backgroundColor = 'transparent'
  } else if (data?.fillColor) {
    style.backgroundColor = data.fillColor
  }

  // Opacity
  if (typeof data?.opacity === 'number') {
    style.opacity = data.opacity
  }

  // Border radius
  if (typeof data?.borderRadius === 'number') {
    style.borderRadius = `${data.borderRadius}px`
  } else if (defaultRadius) {
    style.borderRadius = `${defaultRadius}px`
  }

  // Shadow
  if (data?.shadowType === 'none') {
    style.boxShadow = 'none'
  } else if (data?.shadowType === 'subtle') {
    style.boxShadow = isDark
      ? '0 2px 8px -2px rgba(0,0,0,0.4), 0 1px 3px rgba(0,0,0,0.2)'
      : '0 2px 8px -2px rgba(0,0,0,0.08), 0 1px 3px rgba(0,0,0,0.04)'
  } else if (data?.shadowType === 'elevated') {
    style.boxShadow = isDark
      ? '0 18px 36px -6px rgba(0,0,0,0.7), 0 8px 16px -2px rgba(0,0,0,0.45)'
      : '0 18px 36px -6px rgba(0,0,0,0.28), 0 8px 16px -2px rgba(0,0,0,0.18)'
  } else if (data?.shadowType === 'border') {
    style.boxShadow = 'none'
    style.borderWidth = '1.5px'
    style.borderStyle = 'solid'
    style.borderColor = isDark ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.25)'
  } else if (data?.shadowType === 'glow') {
    style.boxShadow = '0 0 24px 3px rgba(2, 132, 199, 0.4)'
  } else if (data?.shadowType === 'stacked') {
    style.boxShadow = isDark
      ? '4px 4px 0px 0px rgba(255,255,255,0.08), 8px 8px 0px 0px rgba(255,255,255,0.04)'
      : '4px 4px 0px 0px rgba(0,0,0,0.12), 8px 8px 0px 0px rgba(0,0,0,0.06)'
  }

  // Border
  if (data?.borderStyle === 'none' || data?.borderWidth === 0) {
    style.borderStyle = 'none'
    style.borderWidth = '0px'
  } else if (data?.borderWidth != null || data?.borderStyle != null) {
    style.borderWidth = `${data?.borderWidth ?? 1}px`
    style.borderStyle = data?.borderStyle ?? 'solid'
    const isDarkBg = isColorDark(data?.fillColor)
    style.borderColor = data?.borderColor || (isDarkBg ? 'rgba(255,255,255,0.25)' : isDark ? 'rgba(255,255,255,0.18)' : 'rgba(0,0,0,0.15)')
  }

  return style
}

export const CardSelectionOverlay = memo(function CardSelectionOverlay({
  selected,
  onStartConnect
}: {
  selected?: boolean
  onStartConnect?: () => void
}) {
  if (!selected) return null

  return (
    <div className="absolute inset-0 pointer-events-none rounded-[inherit] border-2 border-[#0284c7] z-20">
      {/* 4 Corner Handles as shown in screenshot */}
      <span className="absolute -top-1.5 -left-1.5 w-2.5 h-2.5 bg-white border-2 border-[#0284c7] rounded-full shadow-sm" />
      <span className="absolute -top-1.5 -right-1.5 w-2.5 h-2.5 bg-white border-2 border-[#0284c7] rounded-full shadow-sm" />
      <span className="absolute -bottom-1.5 -left-1.5 w-2.5 h-2.5 bg-white border-2 border-[#0284c7] rounded-full shadow-sm" />
      <span className="absolute -bottom-1.5 -right-1.5 w-2.5 h-2.5 bg-white border-2 border-[#0284c7] rounded-full shadow-sm" />

      {/* Top right quick-link icon as shown in screenshot */}
      <div className="absolute top-2 right-2 pointer-events-auto">
        <button
          onClick={(e) => {
            e.stopPropagation()
            onStartConnect?.()
          }}
          className="p-1 rounded-full text-zinc-400 hover:text-sky-400 hover:bg-black/40 transition opacity-80 hover:opacity-100"
          title="Conectar tarjeta"
        >
          <Link2 className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  )
})

export const NodeHandles = memo(function NodeHandles({
  selected = false,
  isConnectorActive = false,
  isConnectSource = false,
  accentColor = 'var(--app-accent, #3b82f6)'
}: NodeHandlesProps) {
  const isVisible = selected || isConnectorActive || isConnectSource

  const handleClasses = `!w-3 !h-3 !border-2 !border-white dark:!border-zinc-900 transition-all rounded-full z-30 cursor-crosshair ${
    isVisible ? '!opacity-100 shadow-sm' : '!opacity-0 group-hover:!opacity-100'
  } ${
    isConnectSource
      ? '!bg-amber-500 scale-125 ring-4 ring-amber-400/50 animate-pulse'
      : isConnectorActive
      ? '!bg-blue-500 hover:scale-140 hover:ring-4 hover:ring-blue-400/50'
      : 'hover:scale-125'
  }`

  const baseStyle: React.CSSProperties = {
    backgroundColor: isConnectSource ? '#f59e0b' : isConnectorActive ? '#3b82f6' : accentColor
  }

  return (
    <>
      <Handle id="top" type="source" position={Position.Top} className={handleClasses} style={baseStyle} />
      <Handle id="bottom" type="source" position={Position.Bottom} className={handleClasses} style={baseStyle} />
      <Handle id="left" type="source" position={Position.Left} className={handleClasses} style={baseStyle} />
      <Handle id="right" type="source" position={Position.Right} className={handleClasses} style={baseStyle} />
    </>
  )
})

export const SourceNodeBadge = memo(function SourceNodeBadge({
  isConnectSource,
  isConnectorActive
}: {
  isConnectSource?: boolean
  isConnectorActive?: boolean
}) {
  if (isConnectSource) {
    return (
      <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 z-40 px-2.5 py-0.5 rounded-full bg-blue-600 text-white text-[10px] font-bold tracking-wide flex items-center gap-1 shadow-lg pointer-events-none animate-bounce whitespace-nowrap">
        <span>Origen</span>
        <span className="text-blue-200">➔</span>
      </div>
    )
  }

  if (isConnectorActive) {
    return (
      <div className="absolute -top-3 left-1/2 -translate-x-1/2 z-30 px-2 py-0.2 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 text-[9px] font-semibold tracking-wide opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap border border-blue-500/20">
        Conectar
      </div>
    )
  }

  return null
})

export function areNodePropsEqual(prevProps: any, nextProps: any): boolean {
  if (prevProps.id !== nextProps.id) return false
  if (prevProps.selected !== nextProps.selected) return false
  if (prevProps.dragging !== nextProps.dragging) return false

  // If data reference is the same, no data changes
  if (prevProps.data === nextProps.data) return true

  const pData = prevProps.data || {}
  const nData = nextProps.data || {}
  const pKeys = Object.keys(pData)
  const nKeys = Object.keys(nData)

  if (pKeys.length !== nKeys.length) return false

  for (const key of nKeys) {
    if (key === 'onOpenDoc') continue
    if (pData[key] !== nData[key]) {
      return false
    }
  }

  return true
}

