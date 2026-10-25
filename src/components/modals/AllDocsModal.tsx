import { useState } from 'react'
import {
  X,
  Search,
  Star,
  Trash2,
  Clock,
  Plus,
  Layers
} from 'lucide-react'
import type { WorkspaceItem } from '../../db'

interface AllDocsModalProps {
  isOpen: boolean
  onClose: () => void
  workspaces: WorkspaceItem[]
  currentWorkspaceId: string
  onSelectWorkspace: (id: string) => void
  onCreateWorkspace: () => void
  onToggleFavorite: (e: React.MouseEvent, ws: WorkspaceItem) => void
  onDeleteWorkspace: (e: React.MouseEvent, id: string) => void
}

type ModeFilter = 'all' | 'favorites' | 'journals' | 'doc' | 'canvas'

export function AllDocsModal({
  isOpen,
  onClose,
  workspaces,
  currentWorkspaceId,
  onSelectWorkspace,
  onCreateWorkspace,
  onToggleFavorite,
  onDeleteWorkspace
}: AllDocsModalProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedTag, setSelectedTag] = useState<string>('all')
  const [modeFilter, setModeFilter] = useState<ModeFilter>('all')
  const [sortBy, setSortBy] = useState<'updated' | 'created' | 'title'>('updated')

  if (!isOpen) return null

  const activeDocs = workspaces.filter((w) => !w.isDeleted)

  // Extract all unique tags
  const allTags = Array.from(
    new Set(activeDocs.flatMap((w) => w.tags || []).filter(Boolean))
  )

  // Filter and sort matching AFFiNE collections
  const filtered = activeDocs
    .filter((w) => {
      // Search
      const matchQuery =
        w.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        w.docContent.toLowerCase().includes(searchQuery.toLowerCase())

      // Tag
      const matchTag = selectedTag === 'all' || (w.tags || []).includes(selectedTag)

      // Mode / Category
      let matchMode = true
      if (modeFilter === 'favorites') matchMode = w.isFavorite
      else if (modeFilter === 'journals') matchMode = !!w.isJournal
      else if (modeFilter === 'doc') matchMode = w.viewMode === 'doc'
      else if (modeFilter === 'canvas') matchMode = w.viewMode === 'canvas'

      return matchQuery && matchTag && matchMode
    })
    .sort((a, b) => {
      if (sortBy === 'updated') return b.updatedAt - a.updatedAt
      if (sortBy === 'created') return b.createdAt - a.createdAt
      return a.title.localeCompare(b.title)
    })

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div
        className="bg-[#18181b] border border-[#27272a] rounded-2xl max-w-3xl w-full shadow-2xl overflow-hidden flex flex-col max-h-[85vh] animate-in fade-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-[#27272a] flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <Layers size={18} className="text-blue-400" />
            <h3 className="text-sm font-semibold text-zinc-100">Colecciones & Documentos (AFFiNE)</h3>
            <span className="text-[11px] px-2 py-0.5 rounded-full bg-[#27272a] text-zinc-400 font-medium">
              {filtered.length} de {activeDocs.length}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                onCreateWorkspace()
                onClose()
              }}
              className="px-3 py-1 bg-blue-600 hover:bg-blue-500 text-white rounded-lg flex items-center gap-1.5 text-xs font-medium transition"
            >
              <Plus size={14} />
              <span>Nueva página</span>
            </button>
            <button
              onClick={onClose}
              className="p-1 rounded-md text-zinc-400 hover:text-zinc-100 hover:bg-[#27272a] transition"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Collection Filter Tabs (AFFiNE Workspace Mode Filter) */}
        <div className="px-5 py-2 border-b border-[#242428] bg-[#141416] flex items-center gap-1.5 overflow-x-auto shrink-0">
          {[
            { id: 'all', label: 'Todas las notas' },
            { id: 'favorites', label: '⭐ Favoritas' },
            { id: 'journals', label: '📅 Diarios' },
            { id: 'doc', label: '📄 Documentos' },
            { id: 'canvas', label: '☍ Tableros Edgeless' }
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setModeFilter(tab.id as ModeFilter)}
              className={`px-3 py-1 rounded-lg text-xs font-medium transition shrink-0 ${
                modeFilter === tab.id
                  ? 'bg-blue-600 text-white'
                  : 'bg-[#222226] text-zinc-400 hover:text-zinc-200'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Filter & Search Bar */}
        <div className="p-3 bg-[#141416] border-b border-[#27272a] flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="flex-1 min-w-[200px] relative">
            <Search size={14} className="absolute left-3 top-2.5 text-zinc-500" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar en todos los documentos..."
              className="w-full bg-[#1c1c20] border border-[#2d2d34] rounded-lg pl-8 pr-3 py-1.5 text-xs text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-blue-500"
            />
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {allTags.length > 0 && (
              <select
                value={selectedTag}
                onChange={(e) => setSelectedTag(e.target.value)}
                className="bg-[#1c1c20] border border-[#2d2d34] rounded-lg px-2.5 py-1.5 text-xs text-zinc-300 focus:outline-none"
              >
                <option value="all">Todas las etiquetas</option>
                {allTags.map((t) => (
                  <option key={t} value={t}>
                    #{t}
                  </option>
                ))}
              </select>
            )}

            <div className="flex items-center gap-1 bg-[#1c1c20] border border-[#2d2d34] rounded-lg p-0.5 text-xs">
              <button
                onClick={() => setSortBy('updated')}
                className={`px-2 py-1 rounded ${
                  sortBy === 'updated'
                    ? 'bg-[#27272e] text-zinc-100 font-medium'
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                Actualizado
              </button>
              <button
                onClick={() => setSortBy('created')}
                className={`px-2 py-1 rounded ${
                  sortBy === 'created'
                    ? 'bg-[#27272e] text-zinc-100 font-medium'
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                Creado
              </button>
              <button
                onClick={() => setSortBy('title')}
                className={`px-2 py-1 rounded ${
                  sortBy === 'title'
                    ? 'bg-[#27272e] text-zinc-100 font-medium'
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                Título
              </button>
            </div>
          </div>
        </div>

        {/* List of Documents */}
        <div className="p-4 overflow-y-auto space-y-2 flex-1">
          {filtered.length === 0 ? (
            <div className="py-12 text-center text-xs text-zinc-500">
              No se encontraron documentos con los filtros seleccionados.
            </div>
          ) : (
            filtered.map((ws) => (
              <div
                key={ws.id}
                onClick={() => {
                  onSelectWorkspace(ws.id)
                  onClose()
                }}
                className={`p-3 rounded-xl border transition cursor-pointer flex items-center justify-between gap-4 group ${
                  ws.id === currentWorkspaceId
                    ? 'bg-[#202026] border-blue-500/50'
                    : 'bg-[#141416] border-[#242428] hover:border-[#383842] hover:bg-[#1a1a1e]'
                }`}
              >
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <span className="text-2xl shrink-0">{ws.icon || '📄'}</span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <h4 className="font-semibold text-xs text-zinc-200 group-hover:text-blue-400 transition truncate">
                        {ws.title || 'Untitled'}
                      </h4>
                      {ws.isFavorite && (
                        <Star size={12} className="text-amber-400 fill-amber-400 shrink-0" />
                      )}
                      {ws.isJournal && (
                        <span className="text-[10px] px-1.5 py-0.2 rounded bg-sky-950 text-sky-400 border border-sky-800">
                          Diario
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-1 text-[11px] text-zinc-500">
                      <span className="flex items-center gap-1">
                        <Clock size={11} />
                        {new Date(ws.updatedAt).toLocaleDateString('es-ES', {
                          day: 'numeric',
                          month: 'short'
                        })}
                      </span>
                      <span>•</span>
                      <span className="capitalize">{ws.viewMode}</span>
                      {ws.tags && ws.tags.length > 0 && (
                        <>
                          <span>•</span>
                          <div className="flex gap-1 overflow-hidden">
                            {ws.tags.map((t) => (
                              <span key={t} className="text-zinc-400">
                                #{t}
                              </span>
                            ))}
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1 shrink-0 opacity-80 group-hover:opacity-100">
                  <button
                    onClick={(e) => onToggleFavorite(e, ws)}
                    className="p-1.5 rounded-md hover:bg-[#25252a] text-zinc-400 hover:text-amber-400 transition"
                    title={ws.isFavorite ? 'Quitar de favoritos' : 'Añadir a favoritos'}
                  >
                    <Star
                      size={14}
                      className={ws.isFavorite ? 'text-amber-400 fill-amber-400' : ''}
                    />
                  </button>
                  <button
                    onClick={(e) => onDeleteWorkspace(e, ws.id)}
                    className="p-1.5 rounded-md hover:bg-rose-950/40 text-zinc-500 hover:text-rose-400 transition"
                    title="Mover a la papelera"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
