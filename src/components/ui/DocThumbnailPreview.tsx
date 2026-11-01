import React, { useState } from 'react'
import { type WorkspaceItem, type CanvasNodeItem } from '../../db'
import { APP_TEMPLATES, type AppTemplate } from '../../lib/templates'

export interface DocThumbnailPreviewProps {
  doc?: WorkspaceItem
  template?: AppTemplate
  nodes?: CanvasNodeItem[]
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

function extractFirstImage(html?: string): string | null {
  if (!html) return null
  const match = html.match(/<img[^>]+src=["']([^"']+)["']/i)
  if (match && match[1] && !match[1].startsWith('data:image/svg')) {
    return match[1]
  }
  return null
}

function extractChecklist(html?: string): { completed: boolean; text: string }[] {
  if (!html) return []
  const items: { completed: boolean; text: string }[] = []
  const regex = /<li[^>]*data-checked=["'](true|false)["'][^>]*>(.*?)<\/li>/gi
  let m
  while ((m = regex.exec(html)) !== null && items.length < 4) {
    const completed = m[1] === 'true'
    const text = m[2].replace(/<[^>]*>/g, '').trim()
    items.push({ completed, text })
  }
  return items
}

function extractHeading(html?: string): string | null {
  if (!html) return null
  const match = html.match(/<h[1-3][^>]*>(.*?)<\/h[1-3]>/i)
  if (match && match[1]) {
    return match[1].replace(/<[^>]*>/g, '').trim()
  }
  return null
}

function hasBlockquote(html?: string): boolean {
  return !!html && /<blockquote/i.test(html)
}

function parseJournalDate(doc?: WorkspaceItem, title?: string): { day: string; month: string } {
  if (doc?.journalDate) {
    const d = new Date(doc.journalDate)
    if (!isNaN(d.getTime())) {
      return {
        day: String(d.getDate()),
        month: d.toLocaleDateString('es-ES', { month: 'short' }).toUpperCase()
      }
    }
  }
  const checkText = title || doc?.title || ''
  const titleMatch = checkText.match(/(\d{1,2})\s+de\s+([a-zA-ZáéíóúÁÉÍÓÚ]+)/i)
  if (titleMatch) {
    return {
      day: titleMatch[1],
      month: titleMatch[2].slice(0, 3).toUpperCase()
    }
  }

  const d = new Date(doc?.createdAt || Date.now())
  return {
    day: String(d.getDate()),
    month: d.toLocaleDateString('es-ES', { month: 'short' }).toUpperCase()
  }
}

export const DocThumbnailPreview: React.FC<DocThumbnailPreviewProps> = ({
  doc,
  template,
  nodes = [],
  size = 'sm',
  className = ''
}) => {
  const [imgError, setImgError] = useState(false)

  // 1. Resolve normalized properties
  const title = template?.title || doc?.title || 'Sin título'
  const isCanvasMode = template ? template.type === 'canvas' : doc?.viewMode === 'canvas'
  const docContent = template?.docContent || doc?.docContent || ''
  const tplId = template?.id || doc?.id || ''
  const isJournal =
    Boolean(doc?.isJournal) ||
    title.toLowerCase().startsWith('diario') ||
    tplId === 'daily-journal'
  const journalDate = parseJournalDate(doc, title)

  // 2. Gather canvas nodes
  let effectiveNodes = nodes && nodes.length > 0 ? nodes : []
  if (effectiveNodes.length === 0 && template?.nodes) {
    effectiveNodes = template.nodes.map((n, i) => ({
      id: `tpl-${i}`,
      workspaceId: template.id,
      type: n.type,
      positionX: n.positionX,
      positionY: n.positionY,
      data: n.data,
      createdAt: 0,
      updatedAt: 0,
      isDeleted: false,
      syncStatus: 'synced' as const
    }))
  } else if (effectiveNodes.length === 0 && doc) {
    const tpl = APP_TEMPLATES.find(
      (t) =>
        t.id === doc.id ||
        (doc.templateName && t.title.toLowerCase().includes(doc.templateName.toLowerCase())) ||
        (doc.title && t.title.toLowerCase().startsWith(doc.title.toLowerCase()))
    )
    if (tpl && tpl.nodes) {
      effectiveNodes = tpl.nodes.map((n, i) => ({
        id: `tpl-${i}`,
        workspaceId: doc.id,
        type: n.type,
        positionX: n.positionX,
        positionY: n.positionY,
        data: n.data,
        createdAt: 0,
        updatedAt: 0,
        isDeleted: false,
        syncStatus: 'synced' as const
      }))
    }
  }

  // 3. Check for lead image
  let leadImageUrl: string | null = null
  if (!imgError) {
    leadImageUrl = extractFirstImage(docContent)
    if (!leadImageUrl && effectiveNodes.length > 0) {
      const imgNode = effectiveNodes.find(
        (n) => n.type === 'image' && (n.data?.imageUrl || n.data?.assetId)
      )
      if (imgNode?.data?.imageUrl) {
        leadImageUrl = imgNode.data.imageUrl
      }
    }
  }

  // Check checklist items, headings, quotes
  const checklists = extractChecklist(docContent)
  const hasHeading = Boolean(extractHeading(docContent))
  const isQuote = hasBlockquote(docContent)

  // Check palette node in canvas
  const paletteNode = effectiveNodes.find(
    (n) => n.type === 'colorPalette' && (n.data?.paletteColors?.length || n.data?.swatches?.length)
  )
  const paletteColors: string[] =
    paletteNode?.data?.paletteColors ||
    paletteNode?.data?.swatches?.map((s: any) => s.color) ||
    []

  // Determine sizing classes
  const sizeClasses =
    size === 'sm'
      ? 'w-11 h-11 rounded-lg'
      : size === 'md'
      ? 'w-16 h-14 rounded-lg'
      : 'w-full h-32 rounded-t-lg'

  // CASE 1: Image Preview
  if (leadImageUrl && !imgError) {
    return (
      <div
        className={`relative shrink-0 overflow-hidden bg-neutral-900 border border-neutral-700/60 shadow-xs flex items-center justify-center select-none ${sizeClasses} ${className}`}
      >
        <img
          src={leadImageUrl}
          alt=""
          className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
          loading="lazy"
          onError={() => setImgError(true)}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-black/10 pointer-events-none" />
      </div>
    )
  }

  // CASE 2: Special Canvas Templates (SWOT, Flowchart, Mindmap, Pitch Deck, Kanban)
  const lowerTitle = title.toLowerCase()

  // 2A: SWOT / FODA Matrix Preview
  if (tplId === 'swot-analysis' || lowerTitle.includes('swot') || lowerTitle.includes('foda')) {
    return (
      <div
        className={`relative shrink-0 overflow-hidden bg-[#161619] border border-neutral-700/60 shadow-xs p-1 select-none grid grid-cols-2 gap-1 ${sizeClasses} ${className}`}
      >
        <div className="rounded-[2px] bg-emerald-950/60 border border-emerald-500/40 p-0.5 flex flex-col justify-between">
          <span className="text-[7px] font-bold text-emerald-400 leading-none">F</span>
          <div className="h-0.5 w-full bg-emerald-400/50 rounded-full" />
        </div>
        <div className="rounded-[2px] bg-blue-950/60 border border-blue-500/40 p-0.5 flex flex-col justify-between">
          <span className="text-[7px] font-bold text-blue-400 leading-none">O</span>
          <div className="h-0.5 w-full bg-blue-400/50 rounded-full" />
        </div>
        <div className="rounded-[2px] bg-amber-950/60 border border-amber-500/40 p-0.5 flex flex-col justify-between">
          <span className="text-[7px] font-bold text-amber-400 leading-none">D</span>
          <div className="h-0.5 w-full bg-amber-400/50 rounded-full" />
        </div>
        <div className="rounded-[2px] bg-rose-950/60 border border-rose-500/40 p-0.5 flex flex-col justify-between">
          <span className="text-[7px] font-bold text-rose-400 leading-none">A</span>
          <div className="h-0.5 w-full bg-rose-400/50 rounded-full" />
        </div>
      </div>
    )
  }

  // 2B: Flowchart / Diagram Preview
  if (tplId === 'flowchart' || lowerTitle.includes('flujo') || lowerTitle.includes('diagrama')) {
    return (
      <div
        className={`relative shrink-0 overflow-hidden bg-[#161619] border border-neutral-700/60 shadow-xs p-1 flex flex-col items-center justify-between select-none ${sizeClasses} ${className}`}
        style={{
          backgroundImage: 'radial-gradient(circle, #383842 0.8px, transparent 0.8px)',
          backgroundSize: '5px 5px'
        }}
      >
        {/* Start pill */}
        <div className="w-6 h-2 rounded-full bg-emerald-500/80 border border-emerald-400/60 shadow-xs" />
        {/* Connector */}
        <div className="w-0.5 h-1.5 bg-neutral-500" />
        {/* Decision diamond */}
        <div className="w-3.5 h-3.5 rotate-45 bg-amber-500/80 border border-amber-400/60 shadow-xs" />
        {/* Connector */}
        <div className="w-0.5 h-1.5 bg-neutral-500" />
        {/* Process rect */}
        <div className="w-7 h-2 rounded-[2px] bg-indigo-500/80 border border-indigo-400/60 shadow-xs" />
      </div>
    )
  }

  // 2C: Pitch Deck / Slide Presentation Preview
  if (tplId === 'pitch-deck' || lowerTitle.includes('pitch') || lowerTitle.includes('diapositiva')) {
    return (
      <div
        className={`relative shrink-0 overflow-hidden bg-[#161619] border border-neutral-700/60 shadow-xs p-1.5 flex items-center justify-center select-none ${sizeClasses} ${className}`}
      >
        {/* 16:9 Slide Frame */}
        <div className="w-full h-full rounded-[3px] bg-neutral-900 border border-neutral-600/80 p-1 flex flex-col justify-between shadow-md">
          <div className="flex items-center justify-between border-b border-neutral-700/80 pb-0.5">
            <div className="w-10 h-1 rounded-full bg-indigo-400" />
            <div className="w-2 h-1 rounded-full bg-neutral-600" />
          </div>
          <div className="space-y-1 my-auto">
            <div className="flex items-center gap-1">
              <div className="w-1 h-1 rounded-full bg-indigo-400" />
              <div className="w-4/5 h-0.5 rounded-full bg-neutral-400" />
            </div>
            <div className="flex items-center gap-1">
              <div className="w-1 h-1 rounded-full bg-indigo-400" />
              <div className="w-3/5 h-0.5 rounded-full bg-neutral-400" />
            </div>
          </div>
          <div className="flex justify-end">
            <span className="text-[6px] font-mono text-neutral-500">16:9</span>
          </div>
        </div>
      </div>
    )
  }

  // 2D: Mindmap Preview
  if (tplId === 'mindmap' || lowerTitle.includes('mapa mental') || lowerTitle.includes('mindmap')) {
    return (
      <div
        className={`relative shrink-0 overflow-hidden bg-[#161619] border border-neutral-700/60 shadow-xs p-1 flex items-center justify-center select-none ${sizeClasses} ${className}`}
        style={{
          backgroundImage: 'radial-gradient(circle, #383842 0.8px, transparent 0.8px)',
          backgroundSize: '5px 5px'
        }}
      >
        {/* Connector lines SVG */}
        <svg className="absolute inset-0 w-full h-full pointer-events-none">
          <path d="M 12 12 Q 22 22 30 22" stroke="#818cf8" strokeWidth="1" fill="none" opacity="0.8" />
          <path d="M 30 22 Q 38 12 48 12" stroke="#818cf8" strokeWidth="1" fill="none" opacity="0.8" />
          <path d="M 30 22 Q 38 32 48 32" stroke="#818cf8" strokeWidth="1" fill="none" opacity="0.8" />
        </svg>
        {/* Central node */}
        <div className="relative z-10 px-1.5 py-0.5 rounded-full bg-indigo-600 text-white text-[7px] font-bold shadow-md">
          Idea
        </div>
        {/* Subnodes */}
        <div className="absolute left-1 top-1.5 w-3 h-2 rounded-[2px] bg-emerald-500/80" />
        <div className="absolute right-1 top-1.5 w-3 h-2 rounded-[2px] bg-purple-500/80" />
        <div className="absolute right-1 bottom-1.5 w-3 h-2 rounded-[2px] bg-amber-500/80" />
      </div>
    )
  }

  // 2E: Kanban Board Preview
  if (tplId === 'project-kanban-board' || lowerTitle.includes('kanban')) {
    return (
      <div
        className={`relative shrink-0 overflow-hidden bg-[#161619] border border-neutral-700/60 shadow-xs p-1 select-none flex gap-1 ${sizeClasses} ${className}`}
      >
        <div className="flex-1 rounded-[2px] bg-neutral-800/80 p-0.5 flex flex-col gap-0.5">
          <div className="w-full h-1 bg-neutral-600 rounded-full" />
          <div className="w-full h-2.5 rounded-[1px] bg-neutral-700/90" />
          <div className="w-full h-2.5 rounded-[1px] bg-neutral-700/90" />
        </div>
        <div className="flex-1 rounded-[2px] bg-neutral-800/80 p-0.5 flex flex-col gap-0.5">
          <div className="w-full h-1 bg-amber-500 rounded-full" />
          <div className="w-full h-2.5 rounded-[1px] bg-neutral-700/90" />
        </div>
        <div className="flex-1 rounded-[2px] bg-neutral-800/80 p-0.5 flex flex-col gap-0.5">
          <div className="w-full h-1 bg-emerald-500 rounded-full" />
          <div className="w-full h-2.5 rounded-[1px] bg-neutral-700/90" />
        </div>
      </div>
    )
  }

  // CASE 3: General Canvas / Board Preview (Edgeless / Milanote)
  if (isCanvasMode || effectiveNodes.length > 0) {
    const hasCanvasNodes = effectiveNodes.length > 0

    return (
      <div
        className={`relative shrink-0 overflow-hidden bg-[#161619] border border-neutral-700/60 shadow-xs flex items-center justify-center select-none ${sizeClasses} ${className}`}
        style={{
          backgroundImage: 'radial-gradient(circle, #383842 0.8px, transparent 0.8px)',
          backgroundSize: size === 'lg' ? '10px 10px' : '5px 5px'
        }}
      >
        {hasCanvasNodes ? (
          <>
            {size === 'lg' ? (
              // Large Canvas Preview (Card View)
              <div className="absolute inset-0 p-3 flex flex-col justify-between pointer-events-none">
                <div className="flex items-start justify-between">
                  <div className="w-24 p-2 rounded-md bg-neutral-800/90 border border-neutral-700/80 shadow-md">
                    <div className="w-8 h-1.5 rounded-full bg-amber-400/90 mb-1.5" />
                    <div className="space-y-1">
                      <div className="w-full h-1 bg-neutral-500/80 rounded-full" />
                      <div className="w-3/4 h-1 bg-neutral-500/80 rounded-full" />
                    </div>
                  </div>

                  {paletteColors.length > 0 ? (
                    <div className="flex items-center gap-1 p-1.5 rounded-md bg-neutral-800/80 border border-neutral-700/60">
                      {paletteColors.slice(0, 4).map((c, i) => (
                        <div
                          key={i}
                          className="w-3 h-3 rounded-full border border-black/20"
                          style={{ backgroundColor: c }}
                        />
                      ))}
                    </div>
                  ) : (
                    <div className="w-20 p-2 rounded-md bg-indigo-950/60 border border-indigo-700/60 shadow-md">
                      <div className="w-10 h-1.5 rounded-full bg-indigo-400 mb-1" />
                      <div className="w-12 h-1 bg-indigo-300/60 rounded-full" />
                    </div>
                  )}
                </div>

                {/* Connector curved line */}
                <svg className="absolute inset-0 w-full h-full pointer-events-none opacity-60">
                  <path
                    d="M 60 40 Q 120 70 180 85"
                    stroke="#818cf8"
                    strokeWidth="1.5"
                    strokeDasharray="4 3"
                    fill="none"
                  />
                </svg>

                <div className="flex items-end justify-between">
                  <div className="w-28 p-2 rounded-md bg-neutral-800/90 border border-neutral-700/80 shadow-md space-y-1.5">
                    <div className="flex items-center gap-1.5">
                      <div className="w-2 h-2 rounded-[2px] bg-emerald-500/80" />
                      <div className="w-16 h-1 bg-neutral-400 rounded-full" />
                    </div>
                    <div className="flex items-center gap-1.5">
                      <div className="w-2 h-2 rounded-[2px] border border-neutral-500" />
                      <div className="w-12 h-1 bg-neutral-500 rounded-full" />
                    </div>
                  </div>
                  <span className="text-[10px] font-mono text-neutral-500 bg-neutral-900/80 px-2 py-0.5 rounded border border-neutral-800">
                    {effectiveNodes.length} tarjetas
                  </span>
                </div>
              </div>
            ) : (
              // Small/Medium Canvas Preview (List View Thumbnail)
              <div className="relative w-full h-full pointer-events-none p-1">
                {/* SVG Connector Line */}
                <svg className="absolute inset-0 w-full h-full pointer-events-none">
                  <path
                    d="M 14 14 Q 24 22 30 28"
                    stroke="#6366f1"
                    strokeWidth="1"
                    strokeDasharray="2 1.5"
                    fill="none"
                    opacity="0.8"
                  />
                </svg>

                {/* Mini Node 1 (Top Left) */}
                <div className="absolute left-1 top-1 w-6 h-4 rounded-[3px] bg-neutral-800/95 border border-neutral-700/80 p-0.5 flex flex-col justify-around shadow-xs">
                  <div className="h-0.5 w-3.5 bg-amber-400/90 rounded-full" />
                  <div className="h-0.5 w-full bg-neutral-500/70 rounded-full" />
                </div>

                {/* Mini Node 2 (Bottom Right) */}
                <div className="absolute right-1 bottom-1 w-6 h-4.5 rounded-[3px] bg-neutral-800/95 border border-neutral-700/80 p-0.5 flex flex-col justify-around shadow-xs">
                  {paletteColors.length > 0 ? (
                    <div className="flex items-center justify-between gap-0.5 px-0.5">
                      {paletteColors.slice(0, 3).map((col, idx) => (
                        <div
                          key={idx}
                          className="w-1 h-1 rounded-full shrink-0"
                          style={{ backgroundColor: col }}
                        />
                      ))}
                    </div>
                  ) : (
                    <>
                      <div className="flex items-center gap-0.5">
                        <div className="w-1 h-1 rounded-[1px] bg-emerald-400/90 shrink-0" />
                        <div className="h-0.5 w-3.5 bg-neutral-400/80 rounded-full" />
                      </div>
                      <div className="flex items-center gap-0.5">
                        <div className="w-1 h-1 rounded-[1px] border border-neutral-500 shrink-0" />
                        <div className="h-0.5 w-2.5 bg-neutral-600 rounded-full" />
                      </div>
                    </>
                  )}
                </div>
              </div>
            )}
          </>
        ) : (
          // Empty Canvas Board
          <div className="w-5 h-4 rounded-[3px] border border-dashed border-neutral-600/70 flex items-center justify-center">
            <div className="w-1 h-1 rounded-full bg-indigo-400/70" />
          </div>
        )}
      </div>
    )
  }

  // CASE 4: Daily Journal Preview
  if (isJournal) {
    return (
      <div
        className={`relative shrink-0 overflow-hidden bg-[#1e1e24] border border-neutral-700/60 shadow-xs flex flex-col select-none ${sizeClasses} ${className}`}
      >
        <div className="bg-rose-500/90 px-1 py-0.5 flex items-center justify-between text-white shrink-0">
          <span className="text-[8px] font-extrabold tracking-wider leading-none">
            {journalDate.month}
          </span>
          <span className="text-[9px] font-black leading-none">{journalDate.day}</span>
        </div>

        <div className="p-1 flex-1 flex flex-col justify-around">
          <div className="h-0.5 w-full bg-neutral-500/70 rounded-full" />
          <div className="h-0.5 w-4/5 bg-neutral-600/60 rounded-full" />
          <div className="h-0.5 w-full bg-neutral-600/60 rounded-full" />
          {size === 'lg' && (
            <>
              <div className="h-0.5 w-5/6 bg-neutral-600/60 rounded-full" />
              <div className="h-0.5 w-3/4 bg-neutral-600/60 rounded-full" />
            </>
          )}
        </div>
      </div>
    )
  }

  // CASE 5: Standard Document Preview
  const accentColor = doc?.color || '#3b82f6'

  return (
    <div
      className={`relative shrink-0 overflow-hidden bg-[#1e1e24] border border-neutral-700/60 shadow-xs p-1.5 flex flex-col justify-start gap-1 select-none ${sizeClasses} ${className}`}
    >
      {/* Top Accent Title Bar */}
      <div
        className="h-1 rounded-full shrink-0"
        style={{
          backgroundColor: accentColor,
          width: hasHeading ? '80%' : '55%',
          opacity: 0.9
        }}
      />

      {/* Checklist items or text skeleton */}
      {checklists.length > 0 ? (
        <div className="flex flex-col gap-1 mt-0.5 flex-1 justify-center">
          {checklists.slice(0, size === 'lg' ? 4 : 2).map((item, idx) => (
            <div key={idx} className="flex items-center gap-1">
              <div
                className={`w-1.5 h-1.5 rounded-[1px] shrink-0 ${
                  item.completed
                    ? 'bg-emerald-500/90'
                    : 'border border-neutral-500/80 bg-neutral-800'
                }`}
              />
              <div
                className={`h-0.5 rounded-full ${
                  item.completed ? 'bg-neutral-500/60 line-through' : 'bg-neutral-400/80'
                }`}
                style={{ width: `${60 + (idx % 3) * 15}%` }}
              />
            </div>
          ))}
        </div>
      ) : isQuote ? (
        <div className="border-l-2 border-indigo-400 pl-1 py-0.5 flex flex-col gap-1 mt-0.5 flex-1 justify-center">
          <div className="h-0.5 w-full bg-neutral-400/80 rounded-full" />
          <div className="h-0.5 w-4/5 bg-neutral-500/70 rounded-full" />
        </div>
      ) : (
        <div className="flex flex-col gap-1 mt-0.5 flex-1 justify-around">
          <div className="h-0.5 w-full bg-neutral-400/80 rounded-full" />
          <div className="h-0.5 w-4/5 bg-neutral-500/70 rounded-full" />
          <div className="h-0.5 w-11/12 bg-neutral-600/60 rounded-full" />
          {size === 'lg' && (
            <>
              <div className="h-0.5 w-3/4 bg-neutral-600/60 rounded-full" />
              <div className="h-0.5 w-5/6 bg-neutral-600/60 rounded-full" />
            </>
          )}
        </div>
      )}
    </div>
  )
}
