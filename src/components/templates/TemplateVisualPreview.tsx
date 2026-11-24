import React, { useMemo, useState } from 'react'
import { type AppTemplate, resolveTemplateContent } from '../../lib/templates'

interface TemplateVisualPreviewProps {
  template: AppTemplate
  variant?: 'compact' | 'card' | 'inspector'
  className?: string
}

interface ParsedDocSummary {
  heading: string | null
  subheadings: string[]
  checklists: { completed: boolean; text: string }[]
  quote: string | null
  bullets: string[]
}

function stripTags(html: string): string {
  return html
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim()
}

function parseDocSummary(rawHtml?: string): ParsedDocSummary {
  const html = resolveTemplateContent(rawHtml)
  const h1Match = html.match(/<h[12][^>]*>([\s\S]*?)<\/h[12]>/i)
  const heading = h1Match ? stripTags(h1Match[1]) : null

  const subheadings: string[] = []
  const hRegex = /<h[23][^>]*>([\s\S]*?)<\/h[23]>/gi
  let hm: RegExpExecArray | null
  while ((hm = hRegex.exec(html)) !== null && subheadings.length < 4) {
    const text = stripTags(hm[1])
    if (text && text !== heading) subheadings.push(text)
  }

  const checklists: { completed: boolean; text: string }[] = []
  const taskRegex = /<li[^>]*data-checked=["'](true|false)["'][^>]*>([\s\S]*?)<\/li>/gi
  let tm: RegExpExecArray | null
  while ((tm = taskRegex.exec(html)) !== null && checklists.length < 4) {
    checklists.push({
      completed: tm[1] === 'true',
      text: stripTags(tm[2])
    })
  }

  const quoteMatch = html.match(/<blockquote[^>]*>([\s\S]*?)<\/blockquote>/i)
  const quote = quoteMatch ? stripTags(quoteMatch[1]) : null

  const bullets: string[] = []
  const ulMatch = html.replace(/<ul[^>]*data-type=["']taskList["'][\s\S]*?<\/ul>/gi, '')
  const liRegex = /<li[^>]*>([\s\S]*?)<\/li>/gi
  let lm: RegExpExecArray | null
  while ((lm = liRegex.exec(ulMatch)) !== null && bullets.length < 3) {
    const text = stripTags(lm[1])
    if (text) bullets.push(text)
  }

  return { heading, subheadings, checklists, quote, bullets }
}

const NODE_COLOR_STYLES: Record<string, { bg: string; border: string; ink: string }> = {
  yellow: { bg: 'rgba(250, 204, 21, 0.22)', border: 'rgba(234, 179, 8, 0.55)', ink: '#ca8a04' },
  amber: { bg: 'rgba(245, 158, 11, 0.16)', border: 'rgba(245, 158, 11, 0.50)', ink: '#d97706' },
  blue: { bg: 'rgba(59, 130, 246, 0.18)', border: 'rgba(59, 130, 246, 0.52)', ink: '#3b82f6' },
  indigo: { bg: 'rgba(124, 58, 237, 0.16)', border: 'rgba(124, 58, 237, 0.52)', ink: '#7c3aed' },
  purple: { bg: 'rgba(139, 92, 246, 0.18)', border: 'rgba(139, 92, 246, 0.52)', ink: '#8b5cf6' },
  green: { bg: 'rgba(16, 185, 129, 0.18)', border: 'rgba(16, 185, 129, 0.52)', ink: '#10b981' },
  emerald: { bg: 'rgba(16, 185, 129, 0.16)', border: 'rgba(16, 185, 129, 0.50)', ink: '#10b981' },
  rose: { bg: 'rgba(244, 63, 94, 0.18)', border: 'rgba(244, 63, 94, 0.52)', ink: '#f43f5e' },
  peach: { bg: 'rgba(251, 146, 60, 0.20)', border: 'rgba(251, 146, 60, 0.50)', ink: '#ea580c' },
  redBanner: { bg: 'rgba(212, 37, 17, 0.85)', border: 'rgba(212, 37, 17, 0.95)', ink: '#ffffff' },
  darkNote: { bg: 'rgba(30, 30, 34, 0.88)', border: 'rgba(120, 120, 130, 0.45)', ink: '#dcddde' },
  slate: { bg: 'var(--app-bg-overlay)', border: 'var(--app-border-strong)', ink: 'var(--app-text-secondary)' }
}

function getNodeDimensions(node: NonNullable<AppTemplate['nodes']>[number]): { w: number; h: number } {
  const data = (node.data || {}) as Record<string, any>
  if (node.type === 'frame') {
    return { w: Number(data.width) || 360, h: Number(data.height) || 280 }
  }
  if (node.type === 'image') return { w: Number(data.width) || 200, h: 165 }
  if (node.type === 'table') return { w: Number(data.width) || 260, h: 170 }
  if (node.type === 'todo') return { w: Number(data.width) || 240, h: 155 }
  if (node.type === 'subboard') return { w: 220, h: 150 }
  if (node.type === 'link') return { w: 220, h: 135 }
  if (node.type === 'colorPalette') return { w: 185, h: 115 }
  if (node.type === 'shape') {
    return data.shapeType === 'diamond' ? { w: 175, h: 110 } : { w: 210, h: 74 }
  }
  if (node.type === 'comment') return { w: 210, h: 90 }
  return { w: Number(data.width) || 240, h: data.isBanner ? 74 : 130 }
}

const CanvasMinimapPreview: React.FC<{
  template: AppTemplate
  variant: 'compact' | 'card' | 'inspector'
  className?: string
}> = ({ template, variant, className = '' }) => {
  const [failedImages, setFailedImages] = useState<Record<number, boolean>>({})
  const rawNodes = template.nodes
  const edges = template.edges || []

  const layout = useMemo(() => {
    const nodes = rawNodes || []
    if (nodes.length === 0) return null
    let minX = Infinity
    let minY = Infinity
    let maxX = -Infinity
    let maxY = -Infinity

    const rects = nodes.map((node) => {
      const { w, h } = getNodeDimensions(node)
      minX = Math.min(minX, node.positionX)
      minY = Math.min(minY, node.positionY)
      maxX = Math.max(maxX, node.positionX + w)
      maxY = Math.max(maxY, node.positionY + h)
      return { x: node.positionX, y: node.positionY, w, h, node }
    })

    const pad = 42
    const worldW = Math.max(1, maxX - minX + pad * 2)
    const worldH = Math.max(1, maxY - minY + pad * 2)

    return {
      minX: minX - pad,
      minY: minY - pad,
      worldW,
      worldH,
      rects
    }
  }, [rawNodes])

  const heightClass =
    variant === 'compact'
      ? 'h-16 w-20 rounded-md'
      : variant === 'inspector'
      ? 'h-64 w-full rounded-[10px]'
      : 'h-36 w-full rounded-t-[9px]'

  return (
    <div
      className={`relative overflow-hidden bg-[var(--app-bg-canvas)] border-b border-[var(--app-border)] select-none ${heightClass} ${className}`}
      style={{
        backgroundImage: 'radial-gradient(circle, var(--app-canvas-dot) 1px, transparent 1px)',
        backgroundSize: variant === 'compact' ? '6px 6px' : variant === 'inspector' ? '14px 14px' : '10px 10px'
      }}
    >
      {!layout ? (
        <div className="w-full h-full flex items-center justify-center">
          <div className="w-10 h-7 rounded-md border border-dashed border-[var(--app-border-strong)]" />
        </div>
      ) : (
        <div className="absolute inset-0 p-2">
          <div className="relative w-full h-full">
            {/* SVG Edges layer */}
            {edges.length > 0 && (
              <svg
                className="absolute inset-0 w-full h-full pointer-events-none"
                viewBox={`0 0 ${layout.worldW} ${layout.worldH}`}
                preserveAspectRatio="none"
              >
                {edges.map((edge, idx) => {
                  const s = layout.rects[edge.sourceIndex]
                  const t = layout.rects[edge.targetIndex]
                  if (!s || !t) return null
                  const sx = s.x - layout.minX + s.w / 2
                  const sy = s.y - layout.minY + s.h / 2
                  const tx = t.x - layout.minX + t.w / 2
                  const ty = t.y - layout.minY + t.h / 2
                  const mx = (sx + tx) / 2
                  return (
                    <path
                      key={idx}
                      d={`M ${sx} ${sy} C ${mx} ${sy}, ${mx} ${ty}, ${tx} ${ty}`}
                      fill="none"
                      stroke={edge.color || 'var(--app-accent)'}
                      strokeWidth={variant === 'inspector' ? 4 : 6}
                      strokeDasharray={variant === 'compact' ? undefined : '10 6'}
                      opacity={0.72}
                    />
                  )
                })}
              </svg>
            )}

            {/* Nodes layer — Frames first, then foreground nodes */}
            {layout.rects
              .map((r, originalIndex) => ({ ...r, originalIndex }))
              .sort((a, b) => (a.node.type === 'frame' ? -1 : 0) - (b.node.type === 'frame' ? -1 : 0))
              .map((rect) => {
                const { node, originalIndex } = rect
                const data = (node.data || {}) as Record<string, any>
                const left = `${((rect.x - layout.minX) / layout.worldW) * 100}%`
                const top = `${((rect.y - layout.minY) / layout.worldH) * 100}%`
                const width = `${(rect.w / layout.worldW) * 100}%`
                const height = `${(rect.h / layout.worldH) * 100}%`
                const palette = NODE_COLOR_STYLES[data.color || 'slate'] || NODE_COLOR_STYLES.slate

                if (node.type === 'frame') {
                  return (
                    <div
                      key={originalIndex}
                      style={{
                        left,
                        top,
                        width,
                        height,
                        borderColor: palette.border,
                        backgroundColor: palette.bg
                      }}
                      className="absolute rounded-[4px] border border-dashed overflow-hidden"
                    >
                      {variant !== 'compact' && data.title && (
                        <div
                          className="px-1 py-0.5 text-[7px] font-semibold truncate leading-none"
                          style={{ color: palette.ink }}
                        >
                          {data.title}
                        </div>
                      )}
                    </div>
                  )
                }

                if (node.type === 'image' && data.imageUrl && !failedImages[originalIndex]) {
                  return (
                    <div
                      key={originalIndex}
                      style={{ left, top, width, height }}
                      className="absolute rounded-[3px] overflow-hidden border border-[var(--app-border-strong)] bg-[var(--app-bg-overlay)] shadow-xs"
                    >
                      <img
                        src={data.imageUrl}
                        alt=""
                        loading="lazy"
                        onError={() =>
                          setFailedImages((prev) => ({ ...prev, [originalIndex]: true }))
                        }
                        className="w-full h-full object-cover"
                      />
                    </div>
                  )
                }

                if (node.type === 'colorPalette' && Array.isArray(data.swatches)) {
                  return (
                    <div
                      key={originalIndex}
                      style={{ left, top, width, height }}
                      className="absolute rounded-[3px] border border-[var(--app-border-strong)] bg-[var(--app-bg-overlay)] p-0.5 flex items-center gap-0.5 shadow-xs"
                    >
                      {data.swatches.slice(0, 4).map((sw: any, sIdx: number) => (
                        <div
                          key={sIdx}
                          className="flex-1 h-full rounded-[2px]"
                          style={{ backgroundColor: sw.hex || sw.color || '#7c3aed' }}
                        />
                      ))}
                    </div>
                  )
                }

                if (node.type === 'shape') {
                  const isEllipse = data.shapeType === 'ellipse'
                  const isDiamond = data.shapeType === 'diamond'
                  return (
                    <div
                      key={originalIndex}
                      style={{
                        left,
                        top,
                        width,
                        height,
                        backgroundColor: palette.bg,
                        borderColor: palette.border,
                        borderRadius: isEllipse ? '9999px' : isDiamond ? '2px' : '4px'
                      }}
                      className="absolute border flex items-center justify-center px-1 overflow-hidden shadow-xs"
                    >
                      {variant === 'inspector' && data.content && (
                        <span className="text-[8px] font-medium truncate text-[var(--app-text-primary)]">
                          {data.content}
                        </span>
                      )}
                    </div>
                  )
                }

                return (
                  <div
                    key={originalIndex}
                    style={{
                      left,
                      top,
                      width,
                      height,
                      backgroundColor: palette.bg,
                      borderColor: palette.border
                    }}
                    className="absolute rounded-[3px] border p-1 overflow-hidden flex flex-col justify-between shadow-xs"
                  >
                    {variant !== 'compact' && (data.title || data.content) ? (
                      <>
                        <div
                          className="text-[7px] font-semibold truncate leading-tight"
                          style={{
                            color: data.color === 'redBanner' ? '#ffffff' : 'var(--app-text-primary)'
                          }}
                        >
                          {data.title || data.content}
                        </div>
                        <div className="space-y-0.5 opacity-60">
                          <div className="h-[2px] w-4/5 rounded-full bg-current" />
                          <div className="h-[2px] w-3/5 rounded-full bg-current" />
                        </div>
                      </>
                    ) : (
                      <div className="space-y-0.5 my-auto opacity-70">
                        <div className="h-[2px] w-3/4 rounded-full bg-current" />
                        <div className="h-[2px] w-1/2 rounded-full bg-current" />
                      </div>
                    )}
                  </div>
                )
              })}
          </div>
        </div>
      )}
    </div>
  )
}

const DocumentMiniaturePreview: React.FC<{
  template: AppTemplate
  variant: 'compact' | 'card' | 'inspector'
  className?: string
}> = ({ template, variant, className = '' }) => {
  const summary = useMemo(() => parseDocSummary(template.docContent), [template.docContent])

  const heightClass =
    variant === 'compact'
      ? 'h-16 w-20 rounded-md'
      : variant === 'inspector'
      ? 'h-56 w-full rounded-[10px]'
      : 'h-36 w-full rounded-t-[9px]'

  const isBannerDark = template.coverColor === '#18181b' || template.coverBannerStyle === 'minimal-dark'

  return (
    <div
      className={`relative overflow-hidden bg-[var(--app-bg-tertiary)] border-b border-[var(--app-border)] select-none flex items-end justify-center pt-3 px-3 ${heightClass} ${className}`}
    >
      {/* Miniature paper sheet */}
      <div className="w-full h-full rounded-t-md bg-[var(--app-bg-primary)] border border-b-0 border-[var(--app-border-strong)] shadow-[var(--app-shadow-card)] overflow-hidden flex flex-col">
        {/* Editorial Cover Banner if present */}
        {template.hasCover && template.coverType === 'bannerText' ? (
          <div
            className={`px-2 py-2 flex flex-col items-center justify-center shrink-0 border-b border-[var(--app-border)] ${
              variant === 'compact' ? 'py-1' : 'py-2.5'
            }`}
            style={{
              backgroundColor: template.coverColor || '#ffffff',
              color: isBannerDark ? '#f4f4f5' : '#18181b'
            }}
          >
            <span
              className="font-serif italic tracking-[0.16em] uppercase font-normal leading-tight truncate max-w-full"
              style={{ fontSize: variant === 'compact' ? '6px' : variant === 'inspector' ? '12px' : '9px' }}
            >
              {template.coverBannerTitle || 'DOCUMENT'}
            </span>
            {template.coverBannerSubtitle && (
              <span
                className="font-serif italic tracking-[0.16em] uppercase font-normal leading-tight truncate max-w-full opacity-80"
                style={{ fontSize: variant === 'compact' ? '6px' : variant === 'inspector' ? '11px' : '8px' }}
              >
                {template.coverBannerSubtitle}
              </span>
            )}
          </div>
        ) : (
          <div className="h-1.5 w-full bg-[var(--app-accent-soft)] shrink-0" />
        )}

        {/* Body miniature content */}
        <div className={`flex-1 flex flex-col gap-1.5 overflow-hidden ${variant === 'compact' ? 'p-1.5' : 'p-2.5'}`}>
          {summary.heading && variant !== 'compact' && (
            <div className="text-[10px] font-semibold text-[var(--app-text-primary)] truncate leading-tight">
              {summary.heading}
            </div>
          )}

          {summary.quote && variant !== 'compact' && (
            <div className="border-l border-[var(--app-accent)] pl-1.5 text-[8px] italic text-[var(--app-text-secondary)] line-clamp-1">
              {summary.quote}
            </div>
          )}

          {summary.checklists.length > 0 ? (
            <div className="space-y-1">
              {summary.checklists
                .slice(0, variant === 'compact' ? 2 : variant === 'inspector' ? 4 : 3)
                .map((item, idx) => (
                  <div key={idx} className="flex items-center gap-1.5 min-w-0">
                    <span
                      className={`w-2 h-2 rounded-[2px] shrink-0 border ${
                        item.completed
                          ? 'bg-[var(--app-accent)] border-[var(--app-accent)]'
                          : 'border-[var(--app-border-strong)] bg-transparent'
                      }`}
                    />
                    {variant !== 'compact' ? (
                      <span
                        className={`text-[8.5px] truncate leading-none ${
                          item.completed
                            ? 'text-[var(--app-text-muted)] line-through'
                            : 'text-[var(--app-text-secondary)]'
                        }`}
                      >
                        {item.text}
                      </span>
                    ) : (
                      <span className="h-[2px] flex-1 rounded-full bg-[var(--app-text-muted)]/40" />
                    )}
                  </div>
                ))}
            </div>
          ) : summary.subheadings.length > 0 && variant !== 'compact' ? (
            <div className="space-y-1">
              {summary.subheadings.slice(0, variant === 'inspector' ? 4 : 3).map((sh, idx) => (
                <div key={idx} className="space-y-0.5">
                  <div className="text-[8.5px] font-medium text-[var(--app-text-primary)] truncate leading-tight">
                    {sh}
                  </div>
                  <div className="h-[2px] w-4/5 rounded-full bg-[var(--app-border-strong)]" />
                </div>
              ))}
            </div>
          ) : (
            <div className="space-y-1.5 pt-0.5">
              <div className="h-[3px] w-3/4 rounded-full bg-[var(--app-text-muted)]/45" />
              <div className="h-[3px] w-full rounded-full bg-[var(--app-text-muted)]/25" />
              <div className="h-[3px] w-5/6 rounded-full bg-[var(--app-text-muted)]/25" />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export const TemplateVisualPreview: React.FC<TemplateVisualPreviewProps> = ({
  template,
  variant = 'card',
  className = ''
}) => {
  if (template.type === 'canvas') {
    return <CanvasMinimapPreview template={template} variant={variant} className={className} />
  }
  return <DocumentMiniaturePreview template={template} variant={variant} className={className} />
}
