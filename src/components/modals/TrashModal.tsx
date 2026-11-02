import { useState, useEffect } from 'react'
import {
  CloseIcon,
  DeleteIcon,
  DeletePermanentlyIcon,
  ResetIcon
} from '@blocksuite/icons/rc'
import { db, type WorkspaceItem } from '../../db'
import { syncEngine } from '../../lib/syncEngine'
import { AppleEmoji } from '../ui/AppleEmoji'
import { deleteImageFromStorage, extractStorageUrlsFromHtml } from '../../lib/imageOptimizer'
import { getSupabaseClient } from '../../lib/supabase'
import { getCurrentMember, isWorkspaceVisible } from '../../lib/teamAuth'

interface TrashModalProps {
  isOpen: boolean
  onClose: () => void
}

export function TrashModal({ isOpen, onClose }: TrashModalProps) {
  const [deletedWorkspaces, setDeletedWorkspaces] = useState<WorkspaceItem[]>([])

  const loadDeleted = async () => {
    const all = await db.workspaces.toArray()
    const member = getCurrentMember()
    setDeletedWorkspaces(all.filter((w) => w.isDeleted && isWorkspaceVisible(w, member)))
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
      // Limpiar fotos asociadas en Supabase Storage
      const nodes = await db.canvasNodes.where('workspaceId').equals(id).toArray()
      for (const n of nodes) {
        if (n.data?.imageUrl) {
          deleteImageFromStorage(n.data.imageUrl).catch(() => {})
        }
      }
      const ws = await db.workspaces.get(id)
      if (ws?.docContent) {
        const urls = extractStorageUrlsFromHtml(ws.docContent)
        for (const u of urls) {
          deleteImageFromStorage(u).catch(() => {})
        }
      }

      // Eliminar de Supabase Postgres
      const supabase = getSupabaseClient()
      if (supabase) {
        await Promise.allSettled([
          supabase.from('seven_canvas_nodes').delete().eq('workspace_id', id),
          supabase.from('seven_canvas_edges').delete().eq('workspace_id', id),
          supabase.from('seven_workspaces').delete().eq('id', id)
        ])
      }

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
    try {
      const supabase = getSupabaseClient()
      for (const ws of deletedWorkspaces) {
        const nodes = await db.canvasNodes.where('workspaceId').equals(ws.id).toArray()
        for (const n of nodes) {
          if (n.data?.imageUrl) {
            deleteImageFromStorage(n.data.imageUrl).catch(() => {})
          }
        }
        if (ws.docContent) {
          const urls = extractStorageUrlsFromHtml(ws.docContent)
          for (const u of urls) {
            deleteImageFromStorage(u).catch(() => {})
          }
        }

        if (supabase) {
          await Promise.allSettled([
            supabase.from('seven_canvas_nodes').delete().eq('workspace_id', ws.id),
            supabase.from('seven_canvas_edges').delete().eq('workspace_id', ws.id),
            supabase.from('seven_workspaces').delete().eq('id', ws.id)
          ])
        }

        await db.workspaces.delete(ws.id)
        await db.canvasNodes.where('workspaceId').equals(ws.id).delete()
        await db.canvasEdges.where('workspaceId').equals(ws.id).delete()
      }
      loadDeleted()
    } catch (err) {
      console.error('Error emptying trash', err)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4 animate-in fade-in duration-150">
      <div className="w-full max-w-lg rounded-xl border border-[var(--app-border)] shadow-[var(--app-shadow-modal)] overflow-hidden flex flex-col max-h-[80vh] bg-[var(--app-bg-overlay)] text-[var(--app-text-primary)]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-[var(--app-border)] shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-md flex items-center justify-center bg-rose-500/10 text-rose-500">
              <DeleteIcon style={{ width: 16, height: 16 }} />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-[var(--app-text-primary)]">
                Papelera de Reciclaje
              </h2>
              <p className="text-[11px] text-[var(--app-text-secondary)]">
                Restaura o elimina definitivamente tus documentos
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-md text-[var(--app-text-secondary)] hover:text-[var(--app-text-primary)] hover:bg-[var(--app-hover)] transition"
          >
            <CloseIcon style={{ width: 16, height: 16 }} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {deletedWorkspaces.length === 0 ? (
            <div className="py-12 text-center text-xs text-[var(--app-text-secondary)]">
              La papelera está vacía.
            </div>
          ) : (
            deletedWorkspaces.map((ws) => (
              <div
                key={ws.id}
                className="flex items-center justify-between p-2.5 rounded-lg border border-[var(--app-border)] bg-[var(--app-bg-secondary)] hover:bg-[var(--app-hover)] text-xs transition"
              >
                <div className="flex items-center gap-2.5 truncate">
                  <AppleEmoji emoji={ws.icon || '📄'} size={18} className="shrink-0" />
                  <span className="font-medium text-[var(--app-text-primary)] truncate">
                    {ws.title}
                  </span>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => handleRestore(ws.id)}
                    className="flex items-center gap-1.5 px-2.5 py-1 rounded-md border border-[var(--app-border)] bg-[var(--app-bg-primary)] hover:bg-[var(--app-hover)] text-[var(--app-text-primary)] transition font-medium text-xs"
                  >
                    <ResetIcon style={{ width: 12, height: 12 }} />
                    <span>Restaurar</span>
                  </button>
                  <button
                    onClick={() => handlePermanentDelete(ws.id)}
                    className="p-1 rounded-md text-rose-500 hover:bg-rose-500/10 transition"
                    title="Eliminar permanentemente"
                  >
                    <DeletePermanentlyIcon style={{ width: 14, height: 14 }} />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        {deletedWorkspaces.length > 0 && (
          <div className="px-5 py-2.5 border-t border-[var(--app-border)] bg-[var(--app-bg-secondary)] flex items-center justify-between shrink-0">
            <button
              onClick={handleEmptyTrash}
              className="text-xs text-rose-500 hover:underline font-medium"
            >
              Vaciar papelera
            </button>
            <button
              onClick={onClose}
              className="px-3 py-1 text-xs rounded-md border border-[var(--app-border)] bg-[var(--app-bg-primary)] hover:bg-[var(--app-hover)] text-[var(--app-text-primary)] font-medium transition"
            >
              Cerrar
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
