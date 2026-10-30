import React, { useState, useEffect } from 'react'
import { Trash2, RotateCcw, FileText, Layout } from 'lucide-react'
import { db, type WorkspaceItem } from '../../db'
import { syncEngine } from '../../lib/syncEngine'
import { toast } from 'sonner'

interface TrashPageProps {
  onSelectWorkspace: (id: string) => void
}

function formatRelativeTime(timestamp: number) {
  if (!timestamp) return 'Nunca'
  const diffSec = Math.floor((Date.now() - timestamp) / 1000)
  if (diffSec < 60) return `hace ${Math.max(1, diffSec)} s`
  const diffMin = Math.floor(diffSec / 60)
  if (diffMin < 60) return `hace ${diffMin} min`
  const diffHours = Math.floor(diffMin / 60)
  if (diffHours < 24) return `hace ${diffHours} h`
  const diffDays = Math.floor(diffHours / 24)
  return `hace ${diffDays} d`
}

export const TrashPage: React.FC<TrashPageProps> = () => {
  const [deletedWorkspaces, setDeletedWorkspaces] = useState<WorkspaceItem[]>([])
  const [searchQuery, setSearchQuery] = useState('')

  const loadDeleted = async () => {
    const all = await db.workspaces.toArray()
    setDeletedWorkspaces(all.filter((w) => w.isDeleted))
  }

  useEffect(() => {
    loadDeleted()
  }, [])

  const handleRestore = async (id: string) => {
    try {
      await db.workspaces.update(id, {
        isDeleted: false,
        updatedAt: Date.now(),
        syncStatus: 'pending'
      })
      syncEngine.scheduleSync(500)
      toast.success('Documento restaurado')
      loadDeleted()
    } catch (err) {
      console.error('Error al restaurar', err)
    }
  }

  const handlePermanentDelete = async (id: string) => {
    if (!confirm('¿Eliminar permanentemente este documento? No se podrá recuperar.')) return
    try {
      await db.workspaces.delete(id)
      await db.canvasNodes.where('workspaceId').equals(id).delete()
      await db.canvasEdges.where('workspaceId').equals(id).delete()
      toast.info('Documento eliminado definitivamente')
      loadDeleted()
    } catch (err) {
      console.error('Error al borrar definitivamente', err)
    }
  }

  const handleEmptyTrash = async () => {
    if (!confirm('¿Vaciar toda la papelera permanentemente?')) return
    for (const ws of deletedWorkspaces) {
      await db.workspaces.delete(ws.id)
      await db.canvasNodes.where('workspaceId').equals(ws.id).delete()
      await db.canvasEdges.where('workspaceId').equals(ws.id).delete()
    }
    toast.info('Papelera vaciada')
    loadDeleted()
  }

  const filtered = deletedWorkspaces.filter((w) =>
    (w.title || '').toLowerCase().includes(searchQuery.toLowerCase())
  )

  return (
    <div className="flex-1 flex flex-col h-full bg-[#18181b] text-neutral-200 select-none overflow-hidden">
      {/* Header */}
      <header className="h-14 px-8 border-b border-neutral-800 flex items-center justify-between shrink-0 bg-[#18181b]">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-rose-500/10 text-rose-400 flex items-center justify-center">
            <Trash2 className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-white">Papelera de reciclaje</h2>
            <p className="text-[11px] text-neutral-400">
              {deletedWorkspaces.length} {deletedWorkspaces.length === 1 ? 'documento' : 'documentos'} en la papelera
            </p>
          </div>
        </div>

        {/* Header Actions */}
        <div className="flex items-center gap-3">
          {deletedWorkspaces.length > 0 && (
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar en papelera..."
              className="px-2.5 py-1 text-xs bg-neutral-900 border border-neutral-700 rounded-md text-neutral-200 outline-none"
            />
          )}
          {deletedWorkspaces.length > 0 && (
            <button
              onClick={handleEmptyTrash}
              className="px-3 py-1.5 rounded-md bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 text-xs font-medium border border-rose-500/20 transition flex items-center gap-1.5"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Vaciar papelera</span>
            </button>
          )}
        </div>
      </header>

      {/* Main List */}
      <div className="flex-1 overflow-y-auto px-10 py-6 max-w-5xl w-full mx-auto space-y-4 custom-scrollbar">
        {deletedWorkspaces.length === 0 ? (
          <div className="py-24 text-center">
            <div className="w-12 h-12 rounded-full bg-neutral-800/80 mx-auto flex items-center justify-center text-neutral-500 mb-3">
              <Trash2 className="w-5 h-5" />
            </div>
            <p className="text-sm font-medium text-neutral-400">La papelera está vacía</p>
            <p className="text-xs text-neutral-500 mt-1">Los documentos que elimines aparecerán aquí</p>
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map((doc) => (
              <div
                key={doc.id}
                className="flex items-center justify-between p-3.5 rounded-lg bg-neutral-900/50 border border-neutral-800 hover:border-neutral-700 transition"
              >
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <div className="w-9 h-9 rounded-md bg-neutral-800 flex items-center justify-center shrink-0 text-neutral-400">
                    {doc.icon ? (
                      <span>{doc.icon}</span>
                    ) : doc.viewMode === 'canvas' ? (
                      <Layout className="w-4 h-4 text-indigo-400" />
                    ) : (
                      <FileText className="w-4 h-4 text-blue-400" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <h4 className="text-sm font-medium text-neutral-200 truncate">
                      {doc.title || 'Sin título'}
                    </h4>
                    <p className="text-xs text-neutral-500 mt-0.5 font-mono">
                      Eliminado {formatRelativeTime(doc.updatedAt)}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => handleRestore(doc.id)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-xs font-medium transition"
                  >
                    <RotateCcw className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Restaurar</span>
                  </button>
                  <button
                    onClick={() => handlePermanentDelete(doc.id)}
                    className="p-1.5 rounded-md hover:bg-rose-500/20 text-neutral-400 hover:text-rose-400 transition"
                    title="Eliminar definitivamente"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
