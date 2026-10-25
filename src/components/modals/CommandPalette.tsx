import { useState, useEffect } from 'react'
import { Search, FileText, CheckSquare, StickyNote, X, ArrowRight } from 'lucide-react'
import { type WorkspaceItem, type CanvasNodeItem } from '../../db'

interface CommandPaletteProps {
  isOpen: boolean
  onClose: () => void
  workspaces: WorkspaceItem[]
  nodes: CanvasNodeItem[]
  onSelectWorkspace: (id: string) => void
}

export function CommandPalette({
  isOpen,
  onClose,
  workspaces,
  nodes,
  onSelectWorkspace
}: CommandPaletteProps) {
  const [query, setQuery] = useState('')

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        onClose()
      } else if (e.key === 'Escape' && isOpen) {
        onClose()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose])

  if (!isOpen) return null

  const filteredWorkspaces = workspaces
    .filter((w) => !w.isDeleted)
    .filter((w) => w.title.toLowerCase().includes(query.toLowerCase()))

  const filteredNodes = nodes
    .filter((n) => !n.isDeleted)
    .filter(
      (n) =>
        (n.data.title && n.data.title.toLowerCase().includes(query.toLowerCase())) ||
        (n.data.content && n.data.content.toLowerCase().includes(query.toLowerCase()))
    )

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-20 bg-black/50 backdrop-blur-xs p-4">
      <div className="w-full max-w-xl rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden flex flex-col">
        {/* Search Input Bar */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-200 dark:border-slate-800">
          <Search size={18} className="text-slate-400" />
          <input
            type="text"
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar páginas, notas adhesivas, checklists..."
            className="flex-1 text-sm bg-transparent border-none outline-none text-slate-800 dark:text-slate-100 placeholder-slate-400"
          />
          <button
            onClick={onClose}
            className="p-1 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400"
          >
            <X size={16} />
          </button>
        </div>

        {/* Results List */}
        <div className="max-h-80 overflow-y-auto p-2 space-y-1">
          {filteredWorkspaces.length === 0 && filteredNodes.length === 0 ? (
            <div className="py-10 text-center text-xs text-slate-400">
              No se encontraron resultados para "{query}"
            </div>
          ) : (
            <>
              {filteredWorkspaces.length > 0 && (
                <div>
                  <div className="px-3 py-1 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                    Páginas
                  </div>
                  {filteredWorkspaces.map((ws) => (
                    <button
                      key={ws.id}
                      onClick={() => {
                        onSelectWorkspace(ws.id)
                        onClose()
                      }}
                      className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-left hover:bg-slate-100 dark:hover:bg-slate-800 transition group text-xs"
                    >
                      <div className="flex items-center gap-2">
                        <span>{ws.icon || '📄'}</span>
                        <span className="font-medium text-slate-800 dark:text-slate-200">
                          {ws.title}
                        </span>
                      </div>
                      <ArrowRight size={13} className="text-slate-400 opacity-0 group-hover:opacity-100 transition" />
                    </button>
                  ))}
                </div>
              )}

              {filteredNodes.length > 0 && (
                <div className="mt-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                  <div className="px-3 py-1 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                    Tarjetas del Tablero
                  </div>
                  {filteredNodes.slice(0, 10).map((n) => (
                    <button
                      key={n.id}
                      onClick={() => {
                        onSelectWorkspace(n.workspaceId)
                        onClose()
                      }}
                      className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-left hover:bg-slate-100 dark:hover:bg-slate-800 transition group text-xs"
                    >
                      <div className="flex items-center gap-2 truncate">
                        {n.type === 'note' && <StickyNote size={14} className="text-amber-500 shrink-0" />}
                        {n.type === 'todo' && <CheckSquare size={14} className="text-sky-500 shrink-0" />}
                        {n.type !== 'note' && n.type !== 'todo' && <FileText size={14} className="text-slate-400 shrink-0" />}
                        <div className="truncate">
                          <span className="font-medium text-slate-800 dark:text-slate-200">
                            {n.data.title || 'Tarjeta sin título'}
                          </span>
                          {n.data.content && (
                            <span className="ml-2 text-slate-400 text-[11px] truncate">
                              {n.data.content.slice(0, 40)}
                            </span>
                          )}
                        </div>
                      </div>
                      <span className="text-[10px] text-slate-400 shrink-0">Ver en tablero</span>
                    </button>
                  ))}
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer Hint */}
        <div className="px-4 py-2 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/60 text-[11px] text-slate-400 flex items-center justify-between">
          <span>Pulsa Escape para salir</span>
          <span>Seven Note Search</span>
        </div>
      </div>
    </div>
  )
}
