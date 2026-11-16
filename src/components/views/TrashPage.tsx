import { useState, useEffect } from 'react'
import { Trash2, RotateCcw, FileText, Layout } from 'lucide-react'
import { db, type WorkspaceItem, recordPendingHardDeletes, clearPendingHardDeletes } from '../../db'
import { syncEngine } from '../../lib/syncEngine'
import { toast } from 'sonner'
import { AppleEmoji, renderWithAppleEmoji } from '../ui/AppleEmoji'
import { deleteImageFromStorage, extractStorageUrlsFromHtml } from '../../lib/imageOptimizer'
import { getSupabaseClient } from '../../lib/supabase'
import { getCurrentMember, isWorkspaceVisible, canUserDeleteWorkspace, canUserEditWorkspace } from '../../lib/teamAuth'

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
    const member = getCurrentMember()
    setDeletedWorkspaces(all.filter((w) => w.isDeleted && isWorkspaceVisible(w, member)))
  }

  useEffect(() => {
    loadDeleted()
  }, [])

  const handleRestore = async (id: string) => {
    const member = getCurrentMember()
    const targetWs = deletedWorkspaces.find((w) => w.id === id)
    if (!canUserDeleteWorkspace(targetWs, member)) {
      toast.error('Solo el creador o un administrador pueden restaurar esta nota.')
      return
    }
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
    const member = getCurrentMember()
    const targetWs = deletedWorkspaces.find((w) => w.id === id)
    if (!canUserDeleteWorkspace(targetWs, member)) {
      toast.error('Solo el creador o un administrador pueden eliminar definitivamente esta nota.')
      return
    }
    if (!confirm('¿Eliminar permanentemente este documento? No se podrá recuperar.')) return
    try {
      // 1. Limpiar imágenes asociadas en Supabase Storage para liberar espacio
      const nodes = await db.canvasNodes.where('workspaceId').equals(id).toArray()
      const edges = await db.canvasEdges.where('workspaceId').equals(id).toArray()
      const nodeIds = nodes.map((n) => n.id)
      const edgeIds = edges.map((e) => e.id)

      recordPendingHardDeletes('workspaces', [id])
      if (nodeIds.length > 0) recordPendingHardDeletes('canvasNodes', nodeIds)
      if (edgeIds.length > 0) recordPendingHardDeletes('canvasEdges', edgeIds)

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

      // Desvincular subpáginas activas para que no queden huérfanas e invisibles
      const childPages = await db.workspaces.where('parentId').equals(id).toArray()
      const now = Date.now()
      for (const child of childPages) {
        if (!child.isDeleted && canUserEditWorkspace(child, member)) {
          await db.workspaces.update(child.id, {
            parentId: ws?.parentId || null,
            folder: child.folder || ws?.folder || null,
            updatedAt: now,
            syncStatus: 'pending'
          })
        }
      }

      // 2. Eliminar de Supabase Postgres si está conectado
      const supabase = getSupabaseClient()
      if (supabase) {
        const [nodesRes, edgesRes, wsRes] = await Promise.all([
          supabase.from('seven_canvas_nodes').delete().eq('workspace_id', id),
          supabase.from('seven_canvas_edges').delete().eq('workspace_id', id),
          supabase.from('seven_workspaces').delete().eq('id', id)
        ])
        if (!nodesRes.error && nodeIds.length > 0) clearPendingHardDeletes('canvasNodes', nodeIds)
        if (!edgesRes.error && edgeIds.length > 0) clearPendingHardDeletes('canvasEdges', edgeIds)
        if (!wsRes.error) clearPendingHardDeletes('workspaces', [id])
      }

      // 3. Eliminar de IndexedDB local
      await db.workspaces.delete(id)
      await db.canvasNodes.where('workspaceId').equals(id).delete()
      await db.canvasEdges.where('workspaceId').equals(id).delete()
      syncEngine.scheduleSync(500)
      toast.info('Documento y sus fotos eliminados definitivamente')
      loadDeleted()
    } catch (err) {
      console.error('Error al borrar definitivamente', err)
    }
  }

  const handleEmptyTrash = async () => {
    const member = getCurrentMember()
    const deletable = deletedWorkspaces.filter((w) => canUserDeleteWorkspace(w, member))
    if (deletable.length === 0) {
      if (deletedWorkspaces.length > 0) {
        toast.error('Solo los autores o un administrador pueden vaciar estos documentos.')
      }
      return
    }
    if (!confirm('¿Vaciar toda la papelera permanentemente? Se eliminará todo sin dejar rastro en Supabase.')) return
    try {
      const ids = deletable.map((w) => w.id)
      const allNodeIds: string[] = []
      const allEdgeIds: string[] = []
      recordPendingHardDeletes('workspaces', ids)

      const supabase = getSupabaseClient()
      for (const ws of deletable) {
        // Limpiar fotos asociadas en storage
        const [nodes, edges] = await Promise.all([
          db.canvasNodes.where('workspaceId').equals(ws.id).toArray(),
          db.canvasEdges.where('workspaceId').equals(ws.id).toArray()
        ])
        nodes.forEach((n) => allNodeIds.push(n.id))
        edges.forEach((e) => allEdgeIds.push(e.id))
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

        const childPages = await db.workspaces.where('parentId').equals(ws.id).toArray()
        const now = Date.now()
        for (const child of childPages) {
          if (!child.isDeleted && canUserEditWorkspace(child, member)) {
            await db.workspaces.update(child.id, {
              parentId: ws.parentId || null,
              folder: child.folder || ws.folder || null,
              updatedAt: now,
              syncStatus: 'pending'
            })
          }
        }
      }

      if (allNodeIds.length > 0) recordPendingHardDeletes('canvasNodes', allNodeIds)
      if (allEdgeIds.length > 0) recordPendingHardDeletes('canvasEdges', allEdgeIds)

      // Eliminar definitivamente de Supabase Postgres
      if (supabase) {
        const [nodesRes, edgesRes, wsRes] = await Promise.all([
          supabase.from('seven_canvas_nodes').delete().in('workspace_id', ids),
          supabase.from('seven_canvas_edges').delete().in('workspace_id', ids),
          supabase.from('seven_workspaces').delete().in('id', ids)
        ])
        if (!nodesRes.error && allNodeIds.length > 0) clearPendingHardDeletes('canvasNodes', allNodeIds)
        if (!edgesRes.error && allEdgeIds.length > 0) clearPendingHardDeletes('canvasEdges', allEdgeIds)
        if (!wsRes.error) {
          clearPendingHardDeletes('workspaces', ids)
        } else {
          console.warn('Error eliminando de Supabase:', wsRes.error.message)
        }
      }

      // Eliminar de IndexedDB local
      await db.workspaces.bulkDelete(ids)
      await Promise.all(
        ids.map((id) =>
          Promise.all([
            db.canvasNodes.where('workspaceId').equals(id).delete(),
            db.canvasEdges.where('workspaceId').equals(id).delete()
          ])
        )
      )
      syncEngine.scheduleSync(500)
      toast.info('Papelera vaciada y eliminada de Supabase')
      loadDeleted()
    } catch (err) {
      console.error('Error al vaciar papelera', err)
      toast.error('No se pudo vaciar la papelera')
    }
  }

  const filtered = deletedWorkspaces.filter((w) =>
    (w.title || '').toLowerCase().includes(searchQuery.toLowerCase())
  )

  return (
    <div className="flex-1 flex flex-col h-full bg-[var(--app-bg-primary)] text-[var(--app-text-primary)] select-none overflow-hidden">
      {/* Header */}
      <header className="h-auto min-h-14 py-2 px-4 sm:px-8 border-b border-[var(--app-border)] flex flex-col sm:flex-row sm:items-center justify-between shrink-0 bg-[var(--app-bg-primary)] gap-2.5">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-rose-500/10 text-rose-500 dark:text-rose-400 flex items-center justify-center shrink-0">
            <Trash2 className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-[var(--app-text-primary)]">Papelera de reciclaje</h2>
            <p className="text-[11px] text-[var(--app-text-muted)] hidden sm:block">
              {deletedWorkspaces.length} {deletedWorkspaces.length === 1 ? 'documento' : 'documentos'} en la papelera
            </p>
          </div>
        </div>

        {/* Header Actions */}
        <div className="flex items-center gap-2 sm:gap-3 w-full sm:w-auto">
          {deletedWorkspaces.length > 0 && (
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar en papelera..."
              className="flex-1 sm:w-44 px-2.5 py-1 text-xs bg-[var(--app-bg-secondary)] border border-[var(--app-border)] rounded-md text-[var(--app-text-primary)] placeholder:text-[var(--app-text-muted)] outline-none focus:border-blue-500/50"
            />
          )}
          {deletedWorkspaces.length > 0 && (
            <button
              onClick={handleEmptyTrash}
              className="px-3 py-1.5 rounded-md bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 text-xs font-medium border border-rose-500/20 transition flex items-center gap-1.5 shrink-0 cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Vaciar papelera</span>
              <span className="sm:hidden">Vaciar</span>
            </button>
          )}
        </div>
      </header>

      {/* Main List */}
      <div className="flex-1 overflow-y-auto px-3 sm:px-6 md:px-10 py-4 sm:py-6 max-w-5xl w-full mx-auto space-y-4 custom-scrollbar">
        {deletedWorkspaces.length === 0 ? (
          <div className="py-24 text-center">
            <div className="w-12 h-12 rounded-full bg-[var(--app-bg-secondary)] border border-[var(--app-border)] mx-auto flex items-center justify-center text-[var(--app-text-muted)] mb-3">
              <Trash2 className="w-5 h-5" />
            </div>
            <p className="text-sm font-medium text-[var(--app-text-secondary)]">La papelera está vacía</p>
            <p className="text-xs text-[var(--app-text-muted)] mt-1">Los documentos que elimines aparecerán aquí</p>
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map((doc) => (
              <div
                key={doc.id}
                className="flex items-center justify-between p-3.5 rounded-lg bg-[var(--app-bg-secondary)] border border-[var(--app-border)] hover:bg-[var(--app-hover)] transition"
              >
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <div className="w-9 h-9 rounded-md bg-[var(--app-bg-primary)] border border-[var(--app-border)] flex items-center justify-center shrink-0 text-[var(--app-text-muted)]">
                    {doc.icon ? (
                      <AppleEmoji emoji={doc.icon} size={18} />
                    ) : doc.viewMode === 'canvas' ? (
                      <Layout className="w-4 h-4 text-indigo-500 dark:text-indigo-400" />
                    ) : (
                      <FileText className="w-4 h-4 text-blue-500 dark:text-blue-400" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <h4 className="text-sm font-medium text-[var(--app-text-primary)] truncate">
                      {renderWithAppleEmoji(doc.title || 'Sin título')}
                    </h4>
                    <p className="text-xs text-[var(--app-text-muted)] mt-0.5 font-mono">
                      Eliminado {formatRelativeTime(doc.updatedAt)}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => handleRestore(doc.id)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-[var(--app-bg-primary)] hover:bg-[var(--app-hover)] border border-[var(--app-border)] text-[var(--app-text-primary)] text-xs font-medium transition cursor-pointer"
                  >
                    <RotateCcw className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                    <span>Restaurar</span>
                  </button>
                  <button
                    onClick={() => handlePermanentDelete(doc.id)}
                    className="p-1.5 rounded-md hover:bg-rose-500/20 text-[var(--app-text-muted)] hover:text-rose-500 dark:hover:text-rose-400 transition cursor-pointer"
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
