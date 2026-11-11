import React, { useState, useEffect, lazy, Suspense } from 'react'
import { db, type WorkspaceItem } from '../../db'
import { getSupabaseClient } from '../../lib/supabase'
import { Globe, Download, Check, AlertCircle } from 'lucide-react'
import { exportDocumentAsMarkdown } from '../../lib/exportUtils'
import { toast } from 'sonner'

const DocEditor = lazy(() => import('../editor/DocEditor').then(m => ({ default: m.DocEditor })))
const CanvasBoard = lazy(() => import('../canvas/CanvasBoard').then(m => ({ default: m.CanvasBoard })))

interface ExternalShareViewProps {
  workspaceId: string
  token: string
}

export const ExternalShareView: React.FC<ExternalShareViewProps> = ({ workspaceId, token }) => {
  const [loading, setLoading] = useState(true)
  const [workspace, setWorkspace] = useState<WorkspaceItem | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [viewMode, setViewMode] = useState<'doc' | 'canvas'>('doc')
  const [copiedLink, setCopiedLink] = useState(false)

  useEffect(() => {
    async function loadSharedNote() {
      setLoading(true)
      setError(null)

      try {
        // 1. Intentar cargar desde IndexedDB local primero
        const local = await db.workspaces.get(workspaceId)
        if (local && local.isPublicShared && local.shareToken === token) {
          setWorkspace(local)
          setViewMode(local.viewMode === 'canvas' ? 'canvas' : 'doc')
          setLoading(false)
          return
        }

        // 2. Cargar desde Supabase
        const supabase = getSupabaseClient()
        if (!supabase) {
          if (local && local.shareToken === token) {
            setWorkspace(local)
            setViewMode(local.viewMode === 'canvas' ? 'canvas' : 'doc')
            setLoading(false)
            return
          }
          throw new Error('No se pudo verificar la nota compartida con el servidor.')
        }

        const { data, error: supaErr } = await supabase
          .from('seven_workspaces')
          .select('*')
          .eq('id', workspaceId)
          .eq('share_token', token)
          .eq('is_public_shared', true)
          .single()

        if (supaErr || !data) {
          throw new Error('El enlace es inválido, ha expirado o el acceso público fue revocado por el propietario.')
        }

        const meta = data.metadata || {}
        const loaded: WorkspaceItem = {
          id: data.id,
          parentId: data.parent_id,
          spaceId: data.space_id,
          folder: data.folder,
          title: data.title,
          icon: data.icon,
          color: data.color,
          viewMode: data.view_mode,
          docContent: data.doc_content,
          createdAt: data.created_at,
          updatedAt: data.updated_at,
          isFavorite: data.is_favorite,
          isDeleted: data.is_deleted,
          syncStatus: 'synced',
          isPrivate: data.is_private,
          ownerMember: data.owner_member,
          isPublicShared: data.is_public_shared,
          shareToken: data.share_token,
          sharePermission: data.share_permission || 'view',
          tags: meta.tags,
          databaseData: meta.databaseData,
          canvasGridVariant: meta.canvasGridVariant
        }

        // Guardar temporalmente en Dexie para navegación fluida
        await db.workspaces.put(loaded)

        // También descargar los canvas nodes y edges si es modo canvas
        if (loaded.viewMode === 'canvas') {
          const { data: nodes } = await supabase
            .from('seven_canvas_nodes')
            .select('*')
            .eq('workspace_id', loaded.id)
          if (nodes && nodes.length > 0) {
            for (const n of nodes) {
              await db.canvasNodes.put({
                id: n.id,
                workspaceId: n.workspace_id,
                type: n.type,
                positionX: n.position_x,
                positionY: n.position_y,
                width: n.width,
                height: n.height,
                data: n.data,
                createdAt: n.created_at,
                updatedAt: n.updated_at,
                isDeleted: n.is_deleted,
                syncStatus: 'synced'
              })
            }
          }

          const { data: edges } = await supabase
            .from('seven_canvas_edges')
            .select('*')
            .eq('workspace_id', loaded.id)
          if (edges && edges.length > 0) {
            for (const e of edges) {
              await db.canvasEdges.put({
                id: e.id,
                workspaceId: e.workspace_id,
                source: e.source,
                target: e.target,
                sourceHandle: e.source_handle,
                targetHandle: e.target_handle,
                label: e.label,
                animated: e.animated,
                color: e.color,
                edgeType: e.edge_type,
                markerEndType: e.marker_end_type,
                createdAt: e.created_at,
                updatedAt: e.updated_at,
                isDeleted: e.is_deleted,
                syncStatus: 'synced'
              })
            }
          }
        }

        setWorkspace(loaded)
        setViewMode(loaded.viewMode === 'canvas' ? 'canvas' : 'doc')
      } catch (err: any) {
        setError(err?.message || 'Error al cargar documento compartido.')
      } finally {
        setLoading(false)
      }
    }

    loadSharedNote()
  }, [workspaceId, token])

  const isReadOnly = workspace?.sharePermission !== 'edit'

  const handleCopyLink = () => {
    navigator.clipboard.writeText(window.location.href)
    setCopiedLink(true)
    toast.success('Enlace copiado')
    setTimeout(() => setCopiedLink(false), 2000)
  }

  const handleTitleChange = async (newTitle: string) => {
    if (!workspace || isReadOnly) return
    setWorkspace({ ...workspace, title: newTitle })
    await db.workspaces.update(workspace.id, {
      title: newTitle,
      updatedAt: Date.now(),
      syncStatus: 'pending'
    })
    const supabase = getSupabaseClient()
    if (supabase) {
      await supabase.from('seven_workspaces').update({ title: newTitle, updated_at: Date.now() }).eq('id', workspace.id)
    }
  }

  if (loading) {
    return (
      <div className="h-screen w-screen flex flex-col items-center justify-center bg-[#fbfbfa] dark:bg-[#121214] text-neutral-800 dark:text-neutral-200">
        <div className="w-8 h-8 border-3 border-blue-500 border-t-transparent rounded-full animate-spin mb-4" />
        <p className="text-sm font-medium">Verificando enlace y cargando documento...</p>
      </div>
    )
  }

  if (error || !workspace) {
    return (
      <div className="h-screen w-screen flex flex-col items-center justify-center bg-[#fbfbfa] dark:bg-[#121214] text-neutral-800 dark:text-neutral-200 p-6 text-center">
        <div className="w-14 h-14 rounded-2xl bg-rose-500/10 text-rose-500 flex items-center justify-center mb-4">
          <AlertCircle className="w-7 h-7" />
        </div>
        <h2 className="text-lg font-bold mb-2">No se pudo acceder a la nota</h2>
        <p className="text-sm text-neutral-500 dark:text-neutral-400 max-w-md mb-6 leading-relaxed">
          {error || 'El enlace no es válido o ha sido desactivado por el autor.'}
        </p>
        <a
          href="/"
          className="px-4 py-2 rounded-xl bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 font-semibold text-xs transition hover:opacity-90 shadow-sm"
        >
          Ir a Seven Note
        </a>
      </div>
    )
  }

  const authorName = workspace.ownerMember ? (workspace.ownerMember.charAt(0).toUpperCase() + workspace.ownerMember.slice(1)) : 'Equipo'

  return (
    <div className="h-screen w-screen flex flex-col bg-[#fbfbfa] dark:bg-[#121214] text-neutral-900 dark:text-neutral-100 overflow-hidden font-sans">
      {/* Top Banner for External Guest */}
      <header className="h-12 px-4 md:px-6 border-b border-black/[0.06] dark:border-white/[0.08] bg-white/80 dark:bg-[#161619]/80 backdrop-blur-md flex items-center justify-between shrink-0 select-none z-30">
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-base">{workspace.icon || '📄'}</span>
            <span className="font-bold text-xs truncate max-w-[200px] md:max-w-[320px]">
              {workspace.title || 'Untitled'}
            </span>
          </div>

          <div className="hidden sm:flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 text-[11px] font-medium border border-blue-500/20">
            <Globe className="w-3 h-3" />
            <span>Compartido por {authorName}</span>
          </div>

          <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
            isReadOnly
              ? 'bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 border-neutral-200 dark:border-neutral-700'
              : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20'
          }`}>
            {isReadOnly ? 'Solo lectura' : 'Edición permitida'}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {/* View switcher if both applicable */}
          <div className="inline-flex items-center bg-black/5 dark:bg-white/10 p-0.5 rounded-lg text-xs">
            <button
              onClick={() => setViewMode('doc')}
              className={`px-2.5 py-1 rounded-md transition ${viewMode === 'doc' ? 'bg-white dark:bg-neutral-800 shadow-2xs font-semibold' : 'text-neutral-500'}`}
            >
              Documento
            </button>
            <button
              onClick={() => setViewMode('canvas')}
              className={`px-2.5 py-1 rounded-md transition ${viewMode === 'canvas' ? 'bg-white dark:bg-neutral-800 shadow-2xs font-semibold' : 'text-neutral-500'}`}
            >
              Tablero
            </button>
          </div>

          {/* Export tools */}
          <button
            onClick={() => exportDocumentAsMarkdown(workspace)}
            className="p-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/10 text-neutral-600 dark:text-neutral-300 transition"
            title="Descargar como Markdown"
          >
            <Download className="w-4 h-4" />
          </button>

          <button
            onClick={handleCopyLink}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 font-semibold text-xs shadow-xs hover:opacity-90 transition active:scale-95"
          >
            {copiedLink ? <Check className="w-3.5 h-3.5" /> : <Globe className="w-3.5 h-3.5" />}
            <span className="hidden sm:inline">{copiedLink ? 'Copiado' : 'Copiar enlace'}</span>
          </button>
        </div>
      </header>

      {/* Editor or Canvas */}
      <main className="flex-1 overflow-hidden relative">
        <Suspense fallback={<div className="flex-1 flex items-center justify-center p-8 text-neutral-400 text-xs animate-pulse">Cargando nota compartida...</div>}>
          {viewMode === 'doc' ? (
            <DocEditor
              workspace={workspace}
              allWorkspaces={[workspace]}
              onTitleChange={isReadOnly ? undefined : handleTitleChange}
              readOnly={isReadOnly}
            />
          ) : (
            <CanvasBoard
              workspaceId={workspace.id}
              currentWorkspace={workspace}
              darkMode={false}
              readOnly={isReadOnly}
            />
          )}
        </Suspense>
      </main>
    </div>
  )
}
