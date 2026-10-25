import { useState, useEffect } from 'react'
import { Trash2, RotateCcw, X } from 'lucide-react'
import { db, type WorkspaceItem } from '../../db'
import { syncEngine } from '../../lib/syncEngine'

interface TrashModalProps {
  isOpen: boolean
  onClose: () => void
}

export function TrashModal({ isOpen, onClose }: TrashModalProps) {
  const [deletedWorkspaces, setDeletedWorkspaces] = useState<WorkspaceItem[]>([])

  const loadDeleted = async () => {
    const all = await db.workspaces.toArray()
    setDeletedWorkspaces(all.filter((w) => w.isDeleted))
  }

  useEffect(() => {
    if (isOpen) {
      loadDeleted()
    }
  }, [isOpen])

  if (!isOpen) return null

  const handleRestore = async (id: string) => {
    try {
      await db.workspaces.update(id, {
        isDeleted: false,
        updatedAt: Date.now(),
        syncStatus: 'pending'
      })
      syncEngine.scheduleSync(500)
      loadDeleted()
    } catch (err) {
      console.error('Error restoring workspace', err)
    }
  }

  const handlePermanentDelete = async (id: string) => {
    if (!confirm('¿Eliminar permanentemente esta página y todas sus tarjetas? Esta acción no se puede deshacer.')) return
    try {
      await db.workspaces.delete(id)
      await db.canvasNodes.where('workspaceId').equals(id).delete()
      await db.canvasEdges.where('workspaceId').equals(id).delete()
      loadDeleted()
    } catch (err) {
      console.error('Error deleting permanently', err)
    }
  }

  const handleEmptyTrash = async () => {
    if (!confirm('¿Vaciar toda la papelera permanentemente?')) return
    for (const ws of deletedWorkspaces) {
      await db.workspaces.delete(ws.id)
      await db.canvasNodes.where('workspaceId').equals(ws.id).delete()
      await db.canvasEdges.where('workspaceId').equals(ws.id).delete()
    }
    loadDeleted()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4">
      <div className="w-full max-w-lg rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden flex flex-col max-h-[80vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-2 text-rose-600 dark:text-rose-400">
            <Trash2 size={18} />
            <h2 className="text-base font-bold text-slate-900 dark:text-white">
              Papelera de Reciclaje
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {deletedWorkspaces.length === 0 ? (
            <div className="py-12 text-center text-xs text-slate-400">
              La papelera está vacía.
            </div>
          ) : (
            deletedWorkspaces.map((ws) => (
              <div
                key={ws.id}
                className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 text-xs"
              >
                <div className="flex items-center gap-2 truncate">
                  <span>{ws.icon || '📄'}</span>
                  <span className="font-medium text-slate-800 dark:text-slate-200 truncate">
                    {ws.title}
                  </span>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => handleRestore(ws.id)}
                    className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 transition font-medium"
                  >
                    <RotateCcw size={12} />
                    <span>Restaurar</span>
                  </button>
                  <button
                    onClick={() => handlePermanentDelete(ws.id)}
                    className="p-1 rounded hover:bg-rose-100 dark:hover:bg-rose-950/60 text-rose-500 transition"
                    title="Eliminar permanentemente"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        {deletedWorkspaces.length > 0 && (
          <div className="px-6 py-3 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 flex items-center justify-between">
            <button
              onClick={handleEmptyTrash}
              className="text-xs text-rose-600 dark:text-rose-400 hover:underline font-medium"
            >
              Vaciar papelera
            </button>
            <button
              onClick={onClose}
              className="px-3 py-1 text-xs rounded-md bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-medium"
            >
              Cerrar
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
