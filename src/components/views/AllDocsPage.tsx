import React, { useState, useMemo } from 'react'
import {
  MagnifyingGlass,
  Plus,
  Star,
  Trash,
  DotsThree,
  CaretDown,
  SquaresFour,
  List as ListIcon,
  Check
} from '@phosphor-icons/react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, type WorkspaceItem, type CanvasNodeItem } from '../../db'
import { isItemUnread, NewBadge, useUnreadTrigger } from '../../lib/unreadTracker'
import { getCurrentMember } from '../../lib/teamAuth'
import { AppleEmoji, renderWithAppleEmoji } from '../ui/AppleEmoji'
import { DocThumbnailPreview } from '../ui/DocThumbnailPreview'
import { AmbientGlowBackdrop } from '../ui/AmbientGlowBackdrop'

interface AllDocsPageProps {
  workspaces: WorkspaceItem[]
  currentWorkspaceId?: string
  currentSpaceId: string
  onSelectWorkspace: (id: string) => void
  onCreateWorkspace: () => void
  onToggleFavorite: (e: React.MouseEvent, ws: WorkspaceItem) => void
  onDeleteWorkspace: (e: React.MouseEvent, id: string) => void
}

type MainTab = 'docs' | 'tags'
type ViewModeLayout = 'list' | 'grid'

function formatRelativeTime(timestamp: number) {
  if (!timestamp) return 'Nunca'
  const diffSec = Math.floor((Date.now() - timestamp) / 1000)
  if (diffSec < 60) return `hace ${Math.max(1, diffSec)} s`
  const diffMin = Math.floor(diffSec / 60)
  if (diffMin < 60) return `hace ${diffMin} min`
  const diffHours = Math.floor(diffMin / 60)
  if (diffHours < 24) return `hace ${diffHours} h`
  const diffDays = Math.floor(diffHours / 24)
  if (diffDays < 30) return `hace ${diffDays} d`
  const diffMonths = Math.floor(diffDays / 30)
  if (diffMonths < 12) return `hace ${diffMonths} m`
  return `hace ${Math.floor(diffDays / 365)} a`
}

function getSnippet(content?: string) {
  if (!content) return ''
  return content.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 110)
}

function getGroupLabel(date: Date, now: Date): string {
  const isSameDay =
    date.getDate() === now.getDate() &&
    date.getMonth() === now.getMonth() &&
    date.getFullYear() === now.getFullYear()

  if (isSameDay) return 'Hoy'

  const yesterday = new Date(now)
  yesterday.setDate(now.getDate() - 1)
  const isYesterday =
    date.getDate() === yesterday.getDate() &&
    date.getMonth() === yesterday.getMonth() &&
    date.getFullYear() === yesterday.getFullYear()

  if (isYesterday) return 'Ayer'

  return date.toLocaleDateString('es-ES', {
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  })
}

export const AllDocsPage: React.FC<AllDocsPageProps> = ({
  workspaces,
  currentWorkspaceId,
  currentSpaceId,
  onSelectWorkspace,
  onCreateWorkspace,
  onToggleFavorite,
  onDeleteWorkspace
}) => {
  const [activeTab, setActiveTab] = useState<MainTab>('docs')
  const [subFilter, setSubFilter] = useState<'all' | 'doc' | 'canvas' | 'favorites'>('all')
  const [viewLayout, setViewLayout] = useState<ViewModeLayout>('list')
  const [searchQuery, setSearchQuery] = useState('')
  const [openMenuDocId, setOpenMenuDocId] = useState<string | null>(null)
  const [showFilterMenu, setShowFilterMenu] = useState(false)
  useUnreadTrigger()
  const currentMember = getCurrentMember()

  // Fetch canvas nodes for real visual thumbnails
  const allCanvasNodes =
    useLiveQuery(() => db.canvasNodes.filter((n) => !n.isDeleted).toArray(), []) || []

  const nodesByWorkspace = useMemo(() => {
    const map: Record<string, CanvasNodeItem[]> = {}
    for (const node of allCanvasNodes) {
      if (!map[node.workspaceId]) {
        map[node.workspaceId] = []
      }
      map[node.workspaceId].push(node)
    }
    return map
  }, [allCanvasNodes])

  const activeDocs = workspaces.filter(
    (w) => !w.isDeleted && (w.spaceId ? w.spaceId === currentSpaceId : true)
  )

  const filtered = activeDocs.filter((w) => {
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      const match =
        (w.title || '').toLowerCase().includes(q) ||
        (w.docContent || '').toLowerCase().includes(q)
      if (!match) return false
    }
    if (subFilter === 'favorites') return w.isFavorite
    if (subFilter === 'doc') return w.viewMode === 'doc'
    if (subFilter === 'canvas') return w.viewMode === 'canvas'
    return true
  })

  // Group by date updated
  const now = new Date()
  const groupedDocs: { label: string; docs: WorkspaceItem[] }[] = []
  const groupMap = new Map<string, WorkspaceItem[]>()

  // Sort by updatedAt descending
  const sorted = [...filtered].sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0))

  for (const doc of sorted) {
    let label = 'Nunca Actualizado'
    if (doc.updatedAt) {
      const d = new Date(doc.updatedAt)
      label = getGroupLabel(d, now)
    }
    if (!groupMap.has(label)) {
      groupMap.set(label, [])
    }
    groupMap.get(label)!.push(doc)
  }

  for (const [label, docs] of groupMap.entries()) {
    groupedDocs.push({ label, docs })
  }

  return (
    <div className="relative flex-1 flex flex-col h-full bg-[var(--app-bg-primary)] text-[var(--app-text-primary)] select-none overflow-hidden">
      <AmbientGlowBackdrop variant="subtle" />
      {/* Top Header */}
      <header className="relative z-10 h-14 px-3 sm:px-8 border-b border-[var(--app-border)] flex items-center justify-between shrink-0 bg-[var(--app-bg-primary)]/85 backdrop-blur-sm gap-2 overflow-x-auto no-scrollbar">
        {/* Navigation Tabs (Notas / Etiquetas) */}
        <div role="tablist" aria-label="Vistas de documentos" className="flex items-center gap-3 sm:gap-6 shrink-0">
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'docs'}
            onClick={() => setActiveTab('docs')}
            className={`text-xs sm:text-sm font-semibold transition pb-0.5 whitespace-nowrap cursor-pointer ${
              activeTab === 'docs'
                ? 'text-[var(--app-text-primary)] border-b-2 border-[var(--app-accent)]'
                : 'text-[var(--app-text-secondary)] hover:text-[var(--app-text-primary)]'
            }`}
          >
            Notas
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'tags'}
            onClick={() => setActiveTab('tags')}
            className={`text-xs sm:text-sm font-semibold transition pb-0.5 whitespace-nowrap cursor-pointer ${
              activeTab === 'tags'
                ? 'text-[var(--app-text-primary)] border-b-2 border-[var(--app-accent)]'
                : 'text-[var(--app-text-secondary)] hover:text-[var(--app-text-primary)]'
            }`}
          >
            Etiquetas
          </button>
        </div>

        {/* Right Actions: View switchers, Mostrar, Nueva Nota */}
        <div className="flex items-center gap-1.5 sm:gap-3 shrink-0">
          {/* Layout buttons */}
          <div className="flex items-center gap-0.5 sm:gap-1 bg-[var(--app-bg-secondary)] p-0.5 sm:p-1 rounded-md border border-[var(--app-border)]">
            <button
              type="button"
              aria-label="Vista de lista"
              aria-pressed={viewLayout === 'list'}
              onClick={() => setViewLayout('list')}
              className={`p-1.5 rounded-md transition cursor-pointer ${
                viewLayout === 'list'
                  ? 'bg-[var(--app-active)] text-[var(--app-text-primary)]'
                  : 'text-[var(--app-text-secondary)] hover:text-[var(--app-text-primary)]'
              }`}
              title="Vista de lista"
            >
              <ListIcon size={15} />
            </button>
            <button
              type="button"
              aria-label="Vista de tarjetas"
              aria-pressed={viewLayout === 'grid'}
              onClick={() => setViewLayout('grid')}
              className={`p-1.5 rounded-md transition cursor-pointer ${
                viewLayout === 'grid'
                  ? 'bg-[var(--app-active)] text-[var(--app-text-primary)]'
                  : 'text-[var(--app-text-secondary)] hover:text-[var(--app-text-primary)]'
              }`}
              title="Vista de tarjetas"
            >
              <SquaresFour size={15} />
            </button>
          </div>

          {/* Sub filter dropdown */}
          <div className="relative">
            <button
              type="button"
              aria-haspopup="menu"
              aria-expanded={showFilterMenu}
              onClick={() => setShowFilterMenu((v) => !v)}
              className="px-2.5 sm:px-3 py-1.5 rounded-md bg-[var(--app-bg-secondary)] hover:bg-[var(--app-hover)] text-xs font-medium text-[var(--app-text-primary)] border border-[var(--app-border)] flex items-center gap-1 sm:gap-1.5 transition cursor-pointer"
            >
              <span className="hidden sm:inline text-[var(--app-text-secondary)]">Mostrar:</span>
              <span>
                {subFilter === 'all'
                  ? 'Todos'
                  : subFilter === 'doc'
                  ? 'Notas'
                  : subFilter === 'canvas'
                  ? 'Lienzos'
                  : 'Favoritos'}
              </span>
              <CaretDown size={12} className="opacity-70" />
            </button>

            {showFilterMenu && (
              <>
                <div className="fixed inset-0 z-20" onClick={() => setShowFilterMenu(false)} />
                <div
                  role="menu"
                  className="absolute right-0 top-9 z-30 w-40 bg-[var(--app-bg-overlay)] border border-[var(--app-border-strong)] rounded-xl shadow-[var(--app-shadow-popover)] p-1 text-xs"
                >
                  {(
                    [
                      { id: 'all', label: 'Todos' },
                      { id: 'doc', label: 'Notas' },
                      { id: 'canvas', label: 'Lienzos' },
                      { id: 'favorites', label: 'Favoritos' }
                    ] as const
                  ).map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      role="menuitemradio"
                      aria-checked={subFilter === opt.id}
                      onClick={() => {
                        setSubFilter(opt.id)
                        setShowFilterMenu(false)
                      }}
                      className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-md text-left text-[var(--app-text-primary)] hover:bg-[var(--app-hover)] transition cursor-pointer"
                    >
                      <span>{opt.label}</span>
                      {subFilter === opt.id && <Check size={13} className="text-[var(--app-accent)]" />}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>

          {/* Primary CTA: New Note button */}
          <button
            type="button"
            onClick={onCreateWorkspace}
            className="flex items-center gap-1 sm:gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-md bg-[var(--app-accent)] hover:bg-[var(--app-accent-hover)] text-white text-xs font-semibold shadow-sm transition cursor-pointer"
          >
            <Plus size={14} weight="bold" />
            <span className="hidden sm:inline">Nueva nota</span>
            <span className="sm:hidden">Nueva</span>
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto px-3 sm:px-6 md:px-10 py-4 sm:py-6 max-w-6xl w-full mx-auto space-y-4 sm:space-y-6 custom-scrollbar">
        {/* Filter Pills */}
        <div className="flex items-center gap-1.5 sm:gap-2 overflow-x-auto no-scrollbar py-0.5">
          {(
            [
              { id: 'all', label: 'Todos' },
              { id: 'favorites', label: 'Favoritos' },
              { id: 'doc', label: 'Notas' },
              { id: 'canvas', label: 'Lienzos' }
            ] as const
          ).map((pill) => (
            <button
              key={pill.id}
              type="button"
              onClick={() => setSubFilter(pill.id)}
              className={`px-3 py-1 rounded-md text-xs font-medium transition cursor-pointer whitespace-nowrap border ${
                subFilter === pill.id
                  ? 'bg-[var(--app-accent-soft)] text-[var(--app-accent)] border-[var(--app-accent)]/30'
                  : 'border-transparent text-[var(--app-text-secondary)] hover:bg-[var(--app-hover)] hover:text-[var(--app-text-primary)]'
              }`}
            >
              {pill.label}
            </button>
          ))}
        </div>

        {/* Search input */}
        <div className="relative max-w-sm">
          <MagnifyingGlass size={14} className="absolute left-3 top-2.5 text-[var(--app-text-muted)]" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Filtrar por título o contenido..."
            aria-label="Filtrar notas por título o contenido"
            className="w-full pl-9 pr-3 py-1.5 bg-[var(--app-bg-secondary)] border border-[var(--app-border)] rounded-md text-xs text-[var(--app-text-primary)] placeholder-[var(--app-text-muted)] focus:outline-none focus:border-[var(--app-accent)] transition"
          />
        </div>

        {/* Grouped Document List */}
        {groupedDocs.length === 0 ? (
          <div className="py-20 text-center text-sm text-[var(--app-text-muted)]">
            No se encontraron notas en esta vista.
          </div>
        ) : (
          groupedDocs.map((group) => (
            <div key={group.label} className="space-y-2">
              {/* Group Section Header: e.g. "Hoy · 1" */}
              <div className="text-xs font-semibold text-[var(--app-text-secondary)] flex items-center gap-1.5 pb-1">
                <span>{group.label}</span>
                <span>·</span>
                <span className="tabular-nums">{group.docs.length}</span>
              </div>

              {/* Items */}
              <div
                className={
                  viewLayout === 'grid'
                    ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3'
                    : 'space-y-1.5'
                }
              >
                {group.docs.map((doc) => {
                  const snippet = getSnippet(doc.docContent)
                  const isCurrent = doc.id === currentWorkspaceId

                  if (viewLayout === 'grid') {
                    return (
                      <div
                        key={doc.id}
                        role="button"
                        tabIndex={0}
                        onClick={() => onSelectWorkspace(doc.id)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault()
                            onSelectWorkspace(doc.id)
                          }
                        }}
                        className={`group flex flex-col rounded-[10px] border transition cursor-pointer overflow-hidden ${
                          isCurrent
                            ? 'border-[var(--app-accent)]/50 bg-[var(--app-bg-secondary)] shadow-sm'
                            : 'border-[var(--app-border)] bg-[var(--app-bg-secondary)]/60 hover:bg-[var(--app-hover)] hover:border-[var(--app-border-strong)]'
                        }`}
                      >
                        {/* Card Preview Header */}
                        <DocThumbnailPreview
                          doc={doc}
                          nodes={nodesByWorkspace[doc.id]}
                          size="lg"
                        />

                        {/* Card Details */}
                        <div className="p-3.5 flex flex-col justify-between flex-1">
                          <div>
                            <div className="flex items-center justify-between gap-2">
                              <div className="flex items-center gap-1.5 min-w-0">
                                {doc.icon && (
                                  <span className="shrink-0 flex items-center">
                                    <AppleEmoji emoji={doc.icon} size={14} />
                                  </span>
                                )}
                                <span className="font-semibold text-xs text-[var(--app-text-primary)] truncate">
                                  {renderWithAppleEmoji(doc.title || 'Sin título')}
                                </span>
                                {isItemUnread(doc, 'workspace', currentMember) && (
                                  <NewBadge className="ml-1.5" />
                                )}
                              </div>
                              <button
                                type="button"
                                aria-label={doc.isFavorite ? 'Quitar de favoritos' : 'Añadir a favoritos'}
                                onClick={(e) => onToggleFavorite(e, doc)}
                                className={`p-1 rounded-md transition hover:scale-110 cursor-pointer ${
                                  doc.isFavorite
                                    ? 'text-amber-400'
                                    : 'text-[var(--app-text-muted)] opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 hover:text-amber-400'
                                }`}
                                title={doc.isFavorite ? 'Quitar de favoritos' : 'Añadir a favoritos'}
                              >
                                <Star size={14} weight={doc.isFavorite ? 'fill' : 'regular'} />
                              </button>
                            </div>

                            {snippet ? (
                              <p className="text-[11px] text-[var(--app-text-secondary)] line-clamp-2 mt-1.5 leading-relaxed">
                                {snippet}
                              </p>
                            ) : (
                              <p className="text-[11px] text-[var(--app-text-muted)] italic mt-1.5">
                                {doc.viewMode === 'canvas' ? 'Lienzo infinito' : 'Nota vacía'}
                              </p>
                            )}
                          </div>

                          <div className="flex items-center justify-between mt-3 pt-2.5 border-t border-[var(--app-divider)] text-[10px] text-[var(--app-text-muted)] font-mono">
                            <span>{formatRelativeTime(doc.updatedAt)}</span>
                            {doc.isJournal && (
                              <span className="px-1.5 py-0.5 bg-[var(--app-bg-tertiary)] text-[var(--app-text-secondary)] rounded border border-[var(--app-border)]">
                                Diario
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    )
                  }

                  return (
                    <div
                      key={doc.id}
                      role="button"
                      tabIndex={0}
                      onClick={() => onSelectWorkspace(doc.id)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault()
                          onSelectWorkspace(doc.id)
                        }
                      }}
                      className={`group flex items-center justify-between p-3 rounded-lg border transition cursor-pointer ${
                        isCurrent
                          ? 'border-[var(--app-accent)]/40 bg-[var(--app-bg-secondary)] shadow-xs'
                          : 'border-transparent bg-[var(--app-bg-secondary)]/50 hover:bg-[var(--app-hover)] hover:border-[var(--app-border)]'
                      }`}
                    >
                      {/* Left: Thumbnail Preview & Title/Snippet */}
                      <div className="flex items-center gap-3.5 min-w-0 flex-1">
                        <DocThumbnailPreview
                          doc={doc}
                          nodes={nodesByWorkspace[doc.id]}
                          size="sm"
                        />

                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            {doc.icon && (
                              <span className="shrink-0 flex items-center">
                                <AppleEmoji emoji={doc.icon} size={15} />
                              </span>
                            )}
                            <span className="font-semibold text-sm text-[var(--app-text-primary)] truncate">
                              {renderWithAppleEmoji(doc.title || 'Sin título')}
                            </span>
                            {isItemUnread(doc, 'workspace', currentMember) && (
                              <NewBadge className="ml-1.5" />
                            )}
                            {doc.isJournal && (
                              <span className="text-[10px] px-1.5 py-0.5 bg-[var(--app-bg-tertiary)] text-[var(--app-text-secondary)] rounded border border-[var(--app-border)]">
                                Diario
                              </span>
                            )}
                          </div>
                          {snippet ? (
                            <p className="text-xs text-[var(--app-text-secondary)] truncate mt-0.5">
                              {snippet}
                            </p>
                          ) : (
                            <p className="text-xs text-[var(--app-text-muted)] truncate mt-0.5 italic">
                              {doc.viewMode === 'canvas' ? 'Lienzo infinito' : 'Nota vacía'}
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Right: Timestamps & Actions */}
                      <div className="flex items-center gap-5 shrink-0 text-xs text-[var(--app-text-muted)] ml-4">
                        <span className="hidden sm:inline">
                          {formatRelativeTime(doc.createdAt)}
                        </span>
                        <span className="text-[var(--app-text-secondary)] font-mono text-[11px]">
                          {formatRelativeTime(doc.updatedAt)}
                        </span>

                        {/* Favorite button */}
                        <button
                          type="button"
                          aria-label={doc.isFavorite ? 'Quitar de favoritos' : 'Añadir a favoritos'}
                          onClick={(e) => onToggleFavorite(e, doc)}
                          className={`p-1 rounded-md transition hover:scale-110 cursor-pointer ${
                            doc.isFavorite
                              ? 'text-amber-400'
                              : 'text-[var(--app-text-muted)] opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 hover:text-amber-400'
                          }`}
                          title={doc.isFavorite ? 'Quitar de favoritos' : 'Añadir a favoritos'}
                        >
                          <Star size={15} weight={doc.isFavorite ? 'fill' : 'regular'} />
                        </button>

                        {/* Options / Delete menu */}
                        <div className="relative">
                          <button
                            type="button"
                            aria-label="Más opciones"
                            aria-haspopup="menu"
                            aria-expanded={openMenuDocId === doc.id}
                            onClick={(e) => {
                              e.stopPropagation()
                              setOpenMenuDocId(openMenuDocId === doc.id ? null : doc.id)
                            }}
                            className="p-1 rounded-md text-[var(--app-text-muted)] hover:text-[var(--app-text-primary)] opacity-100 sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100 transition cursor-pointer"
                            title="Más opciones"
                          >
                            <DotsThree size={16} weight="bold" />
                          </button>

                          {openMenuDocId === doc.id && (
                            <div
                              role="menu"
                              onClick={(e) => e.stopPropagation()}
                              className="absolute right-0 top-7 z-30 w-36 bg-[var(--app-bg-overlay)] border border-[var(--app-border-strong)] rounded-xl shadow-[var(--app-shadow-popover)] p-1 text-xs"
                            >
                              <button
                                type="button"
                                role="menuitem"
                                onClick={(e) => {
                                  onDeleteWorkspace(e, doc.id)
                                  setOpenMenuDocId(null)
                                }}
                                className="w-full text-left px-2.5 py-1.5 text-rose-500 hover:bg-rose-500/10 rounded-md flex items-center gap-2 cursor-pointer"
                              >
                                <Trash size={14} />
                                <span>Eliminar</span>
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
