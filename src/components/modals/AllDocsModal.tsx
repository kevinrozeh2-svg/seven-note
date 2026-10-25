import { useState } from 'react'
import {
  X,
  FileText,
  Search,
  Star,
  Trash2,
  Clock,
  Plus
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
  const [sortBy, setSortBy] = useState<'updated' | 'created' | 'title'>('updated')

  if (!isOpen) return null

  const activeDocs = workspaces.filter((w) => !w.isDeleted)

  // Extract all unique tags
  const allTags = Array.from(
    new Set(activeDocs.flatMap((w) => w.tags || []).filter(Boolean))
  )

  // Filter and sort
  const filtered = activeDocs
    .filter((w) => {
      const matchQuery =
        w.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        w.docContent.toLowerCase().includes(searchQuery.toLowerCase())
      const matchTag = selectedTag === 'all' || (w.tags || []).includes(selectedTag)
      return matchQuery && matchTag
    })
    .sort((a, b) => {
      if (sortBy === 'updated') return b.updatedAt - a.updatedAt
      if (sortBy === 'created') return b.createdAt - a.createdAt
      return a.title.localeCompare(b.title)
    })

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div
        className="bg-[#18181b] border border-[#27272a] rounded-xl max-w-3xl w-full shadow-2xl overflow-hidden flex flex-col max-h-[85vh] animate-in fade-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-[#27272a] flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <FileText size={18} className="text-blue-400" />
            <h3 className="text-sm font-semibold text-zinc-100">Todos los documentos</h3>
            <span className="text-[11px] px-2 py-0.5 rounded-full bg-[#27272a] text-zinc-400 font-medium">
              {activeDocs.length}
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

        {/* Documents Table / List */}
        <div className="flex-1 overflow-y-auto divide-y divide-[#242428] text-xs">
          {filtered.length === 0 ? (
            <div className="p-12 text-center text-zinc-500">
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
                className={`flex items-center justify-between p-3.5 hover:bg-[#1f1f24] cursor-pointer transition group ${
                  ws.id === currentWorkspaceId ? 'bg-blue-950/20' : ''
                }`}
              >
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <span className="text-xl p-1 rounded bg-[#222226] shrink-0">
                    {ws.icon || '📄'}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-zinc-100 group-hover:text-blue-400 transition truncate text-sm">
                        {ws.title || 'Untitled'}
                      </span>
                      {ws.isFavorite && (
                        <Star size={12} className="text-amber-400 fill-amber-400 shrink-0" />
                      )}
                    </div>
                    <div className="flex items-center gap-3 mt-1 text-[11px] text-zinc-500">
                      <span className="flex items-center gap-1">
                        <Clock size={11} />
                        {new Date(ws.updatedAt).toLocaleDateString('es-ES', {
                          day: '2-digit',
                          month: 'short',
                          year: 'numeric'
                        })}
                      </span>
                      {ws.tags && ws.tags.length > 0 && (
                        <div className="flex items-center gap-1 overflow-hidden">
                          {ws.tags.slice(0, 3).map((t) => (
                            <span
                              key={t}
                              className="px-1.5 py-0.2 rounded bg-[#27272a] text-zinc-400 text-[10px]"
                            >
                              #{t}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-1 ml-4 opacity-0 group-hover:opacity-100 transition shrink-0">
                  <button
                    onClick={(e) => onToggleFavorite(e, ws)}
                    className="p-1.5 rounded hover:bg-[#27272a] text-zinc-400 hover:text-amber-400 transition"
                    title={ws.isFavorite ? 'Quitar de favoritos' : 'Añadir a favoritos'}
                  >
                    <Star
                      size={14}
                      className={ws.isFavorite ? 'text-amber-400 fill-amber-400' : ''}
                    />
                  </button>
                  <button
                    onClick={(e) => onDeleteWorkspace(e, ws.id)}
                    className="p-1.5 rounded hover:bg-rose-950/40 text-zinc-400 hover:text-rose-400 transition"
                    title="Mover a papelera"
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
