import React, { useState } from 'react'
import {
  Search,
  Plus,
  Star,
  Trash2,
  FileText,
  Layout,
  MoreHorizontal,
  ChevronDown,
  LayoutGrid,
  List as ListIcon
} from 'lucide-react'
import { type WorkspaceItem } from '../../db'

interface AllDocsPageProps {
  workspaces: WorkspaceItem[]
  currentWorkspaceId?: string
  currentSpaceId: string
  onSelectWorkspace: (id: string) => void
  onCreateWorkspace: () => void
  onToggleFavorite: (e: React.MouseEvent, ws: WorkspaceItem) => void
  onDeleteWorkspace: (e: React.MouseEvent, id: string) => void
}

type MainTab = 'docs' | 'collections' | 'tags'
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
    <div className="flex-1 flex flex-col h-full bg-[#18181b] text-neutral-200 select-none overflow-hidden">
      {/* Top AFFiNE-style Header */}
      <header className="h-14 px-8 border-b border-neutral-800 flex items-center justify-between shrink-0 bg-[#18181b]">
        {/* Navigation Tabs (Documentos / Colecciones / Etiquetas) */}
        <div className="flex items-center gap-6">
          <button
            onClick={() => setActiveTab('docs')}
            className={`text-sm font-semibold transition pb-0.5 ${
              activeTab === 'docs'
                ? 'text-white border-b-2 border-white'
                : 'text-neutral-400 hover:text-neutral-200'
            }`}
          >
            Documentos
          </button>
          <button
            onClick={() => setActiveTab('collections')}
            className={`text-sm font-semibold transition pb-0.5 ${
              activeTab === 'collections'
                ? 'text-white border-b-2 border-white'
                : 'text-neutral-400 hover:text-neutral-200'
            }`}
          >
            Colecciones
          </button>
          <button
            onClick={() => setActiveTab('tags')}
            className={`text-sm font-semibold transition pb-0.5 ${
              activeTab === 'tags'
                ? 'text-white border-b-2 border-white'
                : 'text-neutral-400 hover:text-neutral-200'
            }`}
          >
            Etiquetas
          </button>
        </div>

        {/* Right Actions: View switchers, Mostrar, Nueva Página */}
        <div className="flex items-center gap-3">
          {/* Layout buttons */}
          <div className="flex items-center gap-1 bg-neutral-900/60 p-1 rounded-md border border-neutral-800">
            <button
              onClick={() => setViewLayout('list')}
              className={`p-1.5 rounded transition ${
                viewLayout === 'list'
                  ? 'bg-neutral-800 text-white'
                  : 'text-neutral-400 hover:text-neutral-200'
              }`}
              title="Vista de lista"
            >
              <ListIcon className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewLayout('grid')}
              className={`p-1.5 rounded transition ${
                viewLayout === 'grid'
                  ? 'bg-neutral-800 text-white'
                  : 'text-neutral-400 hover:text-neutral-200'
              }`}
              title="Vista de tarjetas"
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
          </div>

          {/* Sub filter dropdown / button */}
          <div className="relative">
            <button
              onClick={() => {
                const modes: ('all' | 'doc' | 'canvas' | 'favorites')[] = ['all', 'doc', 'canvas', 'favorites']
                const next = modes[(modes.indexOf(subFilter) + 1) % modes.length]
                setSubFilter(next)
              }}
              className="px-3 py-1.5 rounded-md bg-neutral-900/80 hover:bg-neutral-800 text-xs font-medium text-neutral-300 border border-neutral-800 flex items-center gap-1.5 transition"
            >
              <span>
                {subFilter === 'all'
                  ? 'Mostrar: Todos'
                  : subFilter === 'doc'
                  ? 'Mostrar: Páginas'
                  : subFilter === 'canvas'
                  ? 'Mostrar: Tableros'
                  : 'Mostrar: Favoritos'}
              </span>
              <ChevronDown className="w-3 h-3 opacity-60" />
            </button>
          </div>

          {/* New Page button */}
          <button
            onClick={onCreateWorkspace}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-neutral-800 hover:bg-neutral-700 text-white text-xs font-semibold border border-neutral-700 shadow-sm transition"
          >
            <span>Nueva Página</span>
            <ChevronDown className="w-3.5 h-3.5 opacity-70" />
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto px-10 py-6 max-w-6xl w-full mx-auto space-y-6 custom-scrollbar">
        {/* Filter Pills: Todos + */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setSubFilter('all')}
            className={`px-3 py-1 rounded-md text-xs font-medium transition ${
              subFilter === 'all'
                ? 'bg-neutral-800 text-white border border-neutral-700'
                : 'text-neutral-400 hover:bg-neutral-800/50 hover:text-neutral-200'
            }`}
          >
            Todos
          </button>
          <button
            onClick={() => setSubFilter('favorites')}
            className={`px-3 py-1 rounded-md text-xs font-medium transition ${
              subFilter === 'favorites'
                ? 'bg-neutral-800 text-white border border-neutral-700'
                : 'text-neutral-400 hover:bg-neutral-800/50 hover:text-neutral-200'
            }`}
          >
            Favoritos
          </button>
          <button
            onClick={() => setSubFilter('doc')}
            className={`px-3 py-1 rounded-md text-xs font-medium transition ${
              subFilter === 'doc'
                ? 'bg-neutral-800 text-white border border-neutral-700'
                : 'text-neutral-400 hover:bg-neutral-800/50 hover:text-neutral-200'
            }`}
          >
            Páginas
          </button>
          <button
            onClick={() => setSubFilter('canvas')}
            className={`px-3 py-1 rounded-md text-xs font-medium transition ${
              subFilter === 'canvas'
                ? 'bg-neutral-800 text-white border border-neutral-700'
                : 'text-neutral-400 hover:bg-neutral-800/50 hover:text-neutral-200'
            }`}
          >
            Tableros
          </button>
          <button
            onClick={onCreateWorkspace}
            className="w-6 h-6 rounded flex items-center justify-center text-neutral-400 hover:text-white hover:bg-neutral-800 transition"
            title="Añadir nuevo documento"
          >
            <Plus className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Search input if wanted */}
        <div className="relative max-w-sm">
          <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-neutral-500" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Filtrar por título o contenido..."
            className="w-full pl-9 pr-3 py-1.5 bg-neutral-900/60 border border-neutral-800 rounded-md text-xs text-neutral-200 placeholder-neutral-500 focus:outline-none focus:border-neutral-600 transition"
          />
        </div>

        {/* Grouped Document List */}
        {groupedDocs.length === 0 ? (
          <div className="py-20 text-center text-sm text-neutral-500">
            No se encontraron documentos en esta vista.
          </div>
        ) : (
          groupedDocs.map((group) => (
            <div key={group.label} className="space-y-2">
              {/* Group Section Header: e.g. "Hoy · 1" */}
              <div className="text-xs font-semibold text-neutral-400 flex items-center gap-1.5 pb-1">
                <span>{group.label}</span>
                <span>·</span>
                <span>{group.docs.length}</span>
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

                  return (
                    <div
                      key={doc.id}
                      onClick={() => onSelectWorkspace(doc.id)}
                      className={`group flex items-center justify-between p-3 rounded-lg border transition cursor-pointer ${
                        isCurrent
                          ? 'border-neutral-700 bg-neutral-900/90 shadow-sm'
                          : 'border-transparent bg-neutral-900/40 hover:bg-neutral-800/60 hover:border-neutral-800'
                      }`}
                    >
                      {/* Left: Thumbnail Icon & Title/Snippet */}
                      <div className="flex items-center gap-3.5 min-w-0 flex-1">
                        {/* Doc preview icon box */}
                        <div className="w-10 h-10 rounded-md bg-neutral-800/90 border border-neutral-700/60 flex items-center justify-center shrink-0 overflow-hidden text-neutral-400">
                          {doc.icon ? (
                            <span className="text-lg">{doc.icon}</span>
                          ) : doc.viewMode === 'canvas' ? (
                            <Layout className="w-5 h-5 text-indigo-400" />
                          ) : (
                            <FileText className="w-5 h-5 text-blue-400" />
                          )}
                        </div>

                        {/* Title and snippet text */}
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-sm text-neutral-100 truncate">
                              {doc.title || 'Sin título'}
                            </span>
                            {doc.isJournal && (
                              <span className="text-[10px] px-1.5 py-0.2 bg-neutral-800 text-neutral-400 rounded border border-neutral-700">
                                Diario
                              </span>
                            )}
                          </div>
                          {snippet ? (
                            <p className="text-xs text-neutral-500 truncate mt-0.5">
                              {snippet}
                            </p>
                          ) : (
                            <p className="text-xs text-neutral-600 truncate mt-0.5 italic">
                              {doc.viewMode === 'canvas' ? 'Lienzo infinito' : 'Página vacía'}
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Right: Timestamps & Actions */}
                      <div className="flex items-center gap-5 shrink-0 text-xs text-neutral-500 ml-4">
                        <span className="hidden sm:inline">
                          {formatRelativeTime(doc.createdAt)}
                        </span>
                        <span className="text-neutral-400 font-mono text-[11px]">
                          {formatRelativeTime(doc.updatedAt)}
                        </span>

                        {/* Favorite button */}
                        <button
                          onClick={(e) => onToggleFavorite(e, doc)}
                          className={`p-1 rounded transition hover:scale-110 ${
                            doc.isFavorite
                              ? 'text-amber-400'
                              : 'text-neutral-500 opacity-0 group-hover:opacity-100 hover:text-amber-400'
                          }`}
                          title={doc.isFavorite ? 'Quitar de favoritos' : 'Añadir a favoritos'}
                        >
                          <Star className={`w-4 h-4 ${doc.isFavorite ? 'fill-amber-400' : ''}`} />
                        </button>

                        {/* Options / Delete menu */}
                        <div className="relative">
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              setOpenMenuDocId(openMenuDocId === doc.id ? null : doc.id)
                            }}
                            className="p-1 rounded text-neutral-500 hover:text-neutral-200 opacity-0 group-hover:opacity-100 transition"
                            title="Más opciones"
                          >
                            <MoreHorizontal className="w-4 h-4" />
                          </button>

                          {openMenuDocId === doc.id && (
                            <div
                              onClick={(e) => e.stopPropagation()}
                              className="absolute right-0 top-7 z-30 w-36 bg-neutral-900 border border-neutral-700 rounded-lg shadow-xl p-1 text-xs"
                            >
                              <button
                                onClick={(e) => {
                                  onDeleteWorkspace(e, doc.id)
                                  setOpenMenuDocId(null)
                                }}
                                className="w-full text-left px-2.5 py-1.5 text-rose-400 hover:bg-neutral-800 rounded flex items-center gap-2"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
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
