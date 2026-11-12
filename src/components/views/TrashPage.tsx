import { useState, useEffect } from 'react'
import { Trash2, RotateCcw, FileText, Layout } from 'lucide-react'
import { db, type WorkspaceItem } from '../../db'
import { syncEngine } from '../../lib/syncEngine'
import { toast } from 'sonner'
import { AppleEmoji, renderWithAppleEmoji } from '../ui/AppleEmoji'
import { deleteImageFromStorage, extractStorageUrlsFromHtml } from '../../lib/imageOptimizer'
import { getSupabaseClient } from '../../lib/supabase'
import { getCurrentMember, isWorkspaceVisible, canUserDeleteWorkspace, isUserAdmin } from '../../lib/teamAuth'

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

      // 2. Eliminar de Supabase Postgres si está conectado
      const supabase = getSupabaseClient()
      if (supabase) {
        await Promise.allSettled([
          supabase.from('seven_canvas_nodes').delete().eq('workspace_id', id),
          supabase.from('seven_canvas_edges').delete().eq('workspace_id', id),
          supabase.from('seven_workspaces').delete().eq('id', id)
        ])
      }

      // 3. Eliminar de IndexedDB local
      await db.workspaces.delete(id)
      await db.canvasNodes.where('workspaceId').equals(id).delete()
      await db.canvasEdges.where('workspaceId').equals(id).delete()
      toast.info('Documento y sus fotos eliminados definitivamente')
      loadDeleted()
    } catch (err) {
      console.error('Error al borrar definitivamente', err)
    }
  }

  const handleEmptyTrash = async () => {
    const member = getCurrentMember()
    if (!isUserAdmin(member)) {
      toast.error('Solo los administradores pueden vaciar la papelera de reciclaje completa.')
      return
    }
    if (!confirm('¿Vaciar toda la papelera permanentemente? Se liberará el espacio de fotos en Supabase.')) return
    try {
      const supabase = getSupabaseClient()
      for (const ws of deletedWorkspaces) {
        // Limpiar fotos asociadas en storage
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

        // Eliminar de Supabase Postgres
        if (supabase) {
          await Promise.allSettled([
            supabase.from('seven_canvas_nodes').delete().eq('workspace_id', ws.id),
            supabase.from('seven_canvas_edges').delete().eq('workspace_id', ws.id),
            supabase.from('seven_workspaces').delete().eq('id', ws.id)
          ])
        }

        // Eliminar de IndexedDB local
        await db.workspaces.delete(ws.id)
        await db.canvasNodes.where('workspaceId').equals(ws.id).delete()
        await db.canvasEdges.where('workspaceId').equals(ws.id).delete()
      }
      toast.info('Papelera vaciada y espacio liberado')
      loadDeleted()
    } catch (err) {
      console.error('Error al vaciar papelera', err)
    }
  }

  const filtered = deletedWorkspaces.filter((w) =>
    (w.title || '').toLowerCase().includes(searchQuery.toLowerCase())
  )

  return (
    <div className="flex-1 flex flex-col h-full bg-[#18181b] text-neutral-200 select-none overflow-hidden">
      {/* Header */}
      <header className="h-auto min-h-14 py-2 px-4 sm:px-8 border-b border-neutral-800 flex flex-col sm:flex-row sm:items-center justify-between shrink-0 bg-[#18181b] gap-2.5">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-rose-500/10 text-rose-400 flex items-center justify-center shrink-0">
            <Trash2 className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-white">Papelera de reciclaje</h2>
            <p className="text-[11px] text-neutral-400 hidden sm:block">
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
              className="flex-1 sm:w-44 px-2.5 py-1 text-xs bg-neutral-900 border border-neutral-700 rounded-md text-neutral-200 outline-none"
            />
          )}
          {deletedWorkspaces.length > 0 && (
            <button
              onClick={handleEmptyTrash}
              className="px-3 py-1.5 rounded-md bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 text-xs font-medium border border-rose-500/20 transition flex items-center gap-1.5 shrink-0 cursor-pointer"
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
                      <AppleEmoji emoji={doc.icon} size={18} />
                    ) : doc.viewMode === 'canvas' ? (
                      <Layout className="w-4 h-4 text-indigo-400" />
                    ) : (
                      <FileText className="w-4 h-4 text-blue-400" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <h4 className="text-sm font-medium text-neutral-200 truncate">
                      {renderWithAppleEmoji(doc.title || 'Sin título')}
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
