import { useState } from 'react'
import {
  CloseIcon,
  SearchIcon,
  FavoriteIcon,
  FavoritedIcon,
  DeleteIcon,
  PlusIcon,
  AllDocsIcon,
  PageIcon,
  EdgelessIcon
} from '@blocksuite/icons/rc'
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
    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150">
      <div
        className="rounded-xl max-w-3xl w-full border border-[var(--app-border)] shadow-[var(--app-shadow-modal)] overflow-hidden flex flex-col max-h-[85vh] bg-[var(--app-bg-overlay)] text-[var(--app-text-primary)]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 py-3.5 border-b border-[var(--app-border)] flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-md flex items-center justify-center bg-[var(--app-hover)] text-[var(--app-text-primary)]">
              <AllDocsIcon style={{ width: 16, height: 16 }} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-semibold text-[var(--app-text-primary)]">
                  Colecciones y Documentos
                </h3>
                <span className="text-[11px] px-2 py-0.5 rounded-full font-medium bg-[var(--app-hover)] text-[var(--app-text-secondary)]">
                  {filtered.length} de {activeDocs.length}
                </span>
              </div>
              <p className="text-[11px] text-[var(--app-text-secondary)]">
                Organización de páginas y tableros Milanote
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                onCreateWorkspace()
                onClose()
              }}
              className="px-3 py-1.5 text-[var(--app-bg-primary)] bg-[var(--app-text-primary)] hover:opacity-90 rounded-md flex items-center gap-1.5 text-xs font-medium transition shadow-xs"
            >
              <PlusIcon style={{ width: 13, height: 13 }} />
              <span>Nueva página</span>
            </button>
            <button
              onClick={onClose}
              className="p-1 rounded-md text-[var(--app-text-secondary)] hover:text-[var(--app-text-primary)] hover:bg-[var(--app-hover)] transition"
            >
              <CloseIcon style={{ width: 16, height: 16 }} />
            </button>
          </div>
        </div>

        {/* Collection Filter Tabs */}
        <div className="px-5 py-2.5 border-b border-[var(--app-border)] flex items-center gap-1.5 overflow-x-auto shrink-0 bg-[var(--app-bg-secondary)]">
          {[
            { id: 'all', label: 'Todas las notas' },
            { id: 'favorites', label: 'Favoritas' },
            { id: 'journals', label: 'Diarios' },
            { id: 'doc', label: 'Documentos' },
            { id: 'canvas', label: 'Lienzo Milanote' }
          ].map((tab) => {
            const active = modeFilter === tab.id
            return (
              <button
                key={tab.id}
                onClick={() => setModeFilter(tab.id as ModeFilter)}
                className={`px-2.5 py-1 rounded-md text-xs font-medium transition shrink-0 ${
                  active
                    ? 'bg-[var(--app-text-primary)] text-[var(--app-bg-primary)]'
                    : 'text-[var(--app-text-secondary)] hover:text-[var(--app-text-primary)] hover:bg-[var(--app-hover)]'
                }`}
              >
                {tab.label}
              </button>
            )
          })}
        </div>

        {/* Filter & Search Bar */}
        <div className="p-3 border-b border-[var(--app-border)] flex flex-wrap items-center justify-between gap-3 shrink-0 bg-[var(--app-bg-secondary)]">
          <div className="flex-1 min-w-[200px] relative">
            <SearchIcon
              style={{
                position: 'absolute',
                left: 10,
                top: 8,
                width: 14,
                height: 14,
                color: 'var(--app-text-secondary)'
              }}
            />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar en todos los documentos..."
              className="w-full rounded-md pl-8 pr-3 py-1.5 text-xs outline-none border border-[var(--app-border)] bg-[var(--app-bg-primary)] text-[var(--app-text-primary)] focus:border-[var(--app-accent)] transition"
            />
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {allTags.length > 0 && (
              <select
                value={selectedTag}
                onChange={(e) => setSelectedTag(e.target.value)}
                className="rounded-md px-2.5 py-1.5 text-xs outline-none border border-[var(--app-border)] bg-[var(--app-bg-primary)] text-[var(--app-text-primary)]"
              >
                <option value="all">Todas las etiquetas</option>
                {allTags.map((t) => (
                  <option key={t} value={t}>
                    #{t}
                  </option>
                ))}
              </select>
            )}

            <div className="flex items-center gap-0.5 rounded-md p-0.5 text-xs border border-[var(--app-border)] bg-[var(--app-bg-primary)]">
              <button
                onClick={() => setSortBy('updated')}
                className={`px-2 py-1 rounded-md transition ${
                  sortBy === 'updated'
                    ? 'bg-[var(--app-hover)] text-[var(--app-text-primary)] font-medium'
                    : 'text-[var(--app-text-secondary)] hover:text-[var(--app-text-primary)]'
                }`}
              >
                Actualizado
              </button>
              <button
                onClick={() => setSortBy('created')}
                className={`px-2 py-1 rounded-md transition ${
                  sortBy === 'created'
                    ? 'bg-[var(--app-hover)] text-[var(--app-text-primary)] font-medium'
                    : 'text-[var(--app-text-secondary)] hover:text-[var(--app-text-primary)]'
                }`}
              >
                Creado
              </button>
              <button
                onClick={() => setSortBy('title')}
                className={`px-2 py-1 rounded-md transition ${
                  sortBy === 'title'
                    ? 'bg-[var(--app-hover)] text-[var(--app-text-primary)] font-medium'
                    : 'text-[var(--app-text-secondary)] hover:text-[var(--app-text-primary)]'
                }`}
              >
                Título
              </button>
            </div>
          </div>
        </div>

        {/* Table Column Headers */}
        <div className="px-5 py-2 border-b border-[var(--app-border)] flex items-center justify-between text-[11px] font-medium text-[var(--app-text-secondary)] uppercase tracking-wider shrink-0 bg-[var(--app-bg-secondary)]">
          <div className="flex-1 min-w-0">Documento</div>
          <div className="hidden sm:flex items-center gap-6 shrink-0 mr-8 text-right">
            <span className="w-20 text-center">Etiquetas</span>
            <span className="w-16 text-center">Modo</span>
            <span className="w-24 text-right">Actualizado</span>
          </div>
          <div className="w-12 text-right">Acciones</div>
        </div>

        {/* List of Documents */}
        <div className="p-3 overflow-y-auto space-y-1 flex-1 custom-scrollbar">
          {filtered.length === 0 ? (
            <div className="py-12 text-center text-xs text-[var(--app-text-secondary)]">
              No se encontraron documentos con los filtros seleccionados.
            </div>
          ) : (
            filtered.map((ws) => {
              const isCurrent = ws.id === currentWorkspaceId
              return (
                <div
                  key={ws.id}
                  onClick={() => {
                    onSelectWorkspace(ws.id)
                    onClose()
                  }}
                  className={`p-2.5 rounded-lg border transition cursor-pointer flex items-center justify-between gap-4 group ${
                    isCurrent
                      ? 'border-[var(--app-accent)] bg-[var(--app-hover)]'
                      : 'border-[var(--app-border)] bg-[var(--app-bg-secondary)] hover:bg-[var(--app-hover)]'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0 flex-1">
                    <span className="text-base shrink-0">{ws.icon || (ws.viewMode === 'canvas' ? <EdgelessIcon style={{ width: 15, height: 15, color: 'var(--app-accent)' }} /> : <PageIcon style={{ width: 15, height: 15, color: 'var(--app-text-secondary)' }} />)}</span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <h4 className="font-medium text-xs text-[var(--app-text-primary)] truncate">
                          {ws.title || 'Untitled'}
                        </h4>
                        {ws.isFavorite && (
                          <FavoritedIcon style={{ width: 13, height: 13, color: '#f59e0b', flexShrink: 0 }} />
                        )}
                        {ws.isJournal && (
                          <span className="text-[10px] px-1.5 py-0.2 rounded border border-[var(--app-border)] font-medium text-[var(--app-text-secondary)] bg-[var(--app-bg-primary)]">
                            Diario
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Middle columns aligned with header */}
                  <div className="hidden sm:flex items-center gap-6 shrink-0 mr-8 text-xs text-[var(--app-text-secondary)]">
                    <div className="w-20 flex justify-center overflow-hidden">
                      {ws.tags && ws.tags.length > 0 ? (
                        <span className="px-1.5 py-0.5 rounded bg-[var(--app-hover)] text-[10px] font-mono truncate">
                          #{ws.tags[0]}{ws.tags.length > 1 ? ` +${ws.tags.length - 1}` : ''}
                        </span>
                      ) : (
                        <span className="text-[10px] opacity-40">-</span>
                      )}
                    </div>

                    <div className="w-16 flex items-center justify-center gap-1 text-[11px] capitalize">
                      {ws.viewMode === 'canvas' ? (
                        <EdgelessIcon style={{ width: 12, height: 12, color: 'var(--app-accent)' }} />
                      ) : (
                        <PageIcon style={{ width: 12, height: 12 }} />
                      )}
                      <span>{ws.viewMode === 'canvas' ? 'Lienzo' : 'Página'}</span>
                    </div>

                    <div className="w-24 text-right text-[11px] font-mono">
                      {new Date(ws.updatedAt).toLocaleDateString('es-ES', {
                        day: 'numeric',
                        month: 'short'
                      })}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1 shrink-0 opacity-80 group-hover:opacity-100">
                    <button
                      onClick={(e) => onToggleFavorite(e, ws)}
                      className="p-1 rounded-md hover:bg-[var(--app-hover)] transition text-[var(--app-text-secondary)]"
                      title={ws.isFavorite ? 'Quitar de favoritos' : 'Añadir a favoritos'}
                    >
                      {ws.isFavorite ? (
                        <FavoritedIcon style={{ width: 14, height: 14, color: '#f59e0b' }} />
                      ) : (
                        <FavoriteIcon style={{ width: 14, height: 14 }} />
                      )}
                    </button>
                    <button
                      onClick={(e) => onDeleteWorkspace(e, ws.id)}
                      className="p-1 rounded-md transition text-rose-500 hover:bg-rose-500/10"
                      title="Mover a la papelera"
                    >
                      <DeleteIcon style={{ width: 14, height: 14 }} />
                    </button>
                  </div>
                </div>
              )
            })
          )}
        </div>
      </div>
    </div>
  )
}
