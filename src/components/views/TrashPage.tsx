import { useState, useMemo } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Trash2, RotateCcw, FileText, Layout, Folder, Layers } from 'lucide-react'
import {
  db,
  type WorkspaceItem,
  type SpaceItem,
  DEFAULT_SPACE_ID,
  recordPendingHardDeletes,
  clearPendingHardDeletes,
  restoreSpaceFromTrash,
  permanentlyDeleteSpace,
  updateSpace,
  getSafeTimestamp,
  normalizeFolderPath
} from '../../db'
import { syncEngine } from '../../lib/syncEngine'
import { toast } from 'sonner'
import { AppleEmoji, renderWithAppleEmoji } from '../ui/AppleEmoji'
import { deleteImageFromStorage, extractStorageUrlsFromHtml } from '../../lib/imageOptimizer'
import { getSupabaseClient } from '../../lib/supabase'
import {
  getCurrentMember,
  isSpaceVisible,
  canUserManageSpace,
  isWorkspaceVisible,
  canUserDeleteWorkspace,
  canUserEditWorkspace,
  type TeamMember
} from '../../lib/teamAuth'

interface TrashPageProps {
  onSelectWorkspace: (id: string) => void
  authUserId?: string
}

interface TrashedFolderGroup {
  key: string
  spaceId: string
  spaceName: string
  folderPath: string
  leafName: string
  docs: WorkspaceItem[]
  deletedAt: number
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

async function permanentlyDeleteWorkspaceBatch(
  docsToDelete: WorkspaceItem[],
  member: TeamMember,
  authUserId?: string
) {
  if (docsToDelete.length === 0) return

  const ids = docsToDelete.map((d) => d.id)
  const idSet = new Set(ids)
  const allNodeIds: string[] = []
  const allEdgeIds: string[] = []

  recordPendingHardDeletes('workspaces', ids)

  for (const ws of docsToDelete) {
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

    // Desvincular subpáginas activas que no están siendo eliminadas
    const childPages = await db.workspaces.where('parentId').equals(ws.id).toArray()
    for (const child of childPages) {
      if (!child.isDeleted && !idSet.has(child.id) && canUserEditWorkspace(child, member, authUserId)) {
        await db.workspaces.update(child.id, {
          parentId: ws.parentId || null,
          folder: child.folder || ws.folder || null,
          updatedAt: getSafeTimestamp(child.updatedAt),
          syncStatus: 'pending'
        })
      }
    }
  }

  if (allNodeIds.length > 0) recordPendingHardDeletes('canvasNodes', allNodeIds)
  if (allEdgeIds.length > 0) recordPendingHardDeletes('canvasEdges', allEdgeIds)

  const supabase = getSupabaseClient()
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
      console.warn('Error eliminando documentos de Supabase:', wsRes.error.message)
    }
  }

  await db.workspaces.bulkDelete(ids)
  await Promise.all(
    ids.map((id) =>
      Promise.all([
        db.canvasNodes.where('workspaceId').equals(id).delete(),
        db.canvasEdges.where('workspaceId').equals(id).delete()
      ])
    )
  )
}

export const TrashPage: React.FC<TrashPageProps> = ({ authUserId }) => {
  const [searchQuery, setSearchQuery] = useState('')
  const member = getCurrentMember()

  const allSpaces = useLiveQuery(() => db.spaces.toArray(), [], [] as SpaceItem[])
  const allWorkspaces = useLiveQuery(() => db.workspaces.toArray(), [], [] as WorkspaceItem[])

  const { deletedSpaces, deletedFolders, deletedStandaloneDocs, spaceNameMap, spaceDocsCountMap } =
    useMemo(() => {
      const spMap = new Map<string, SpaceItem>()
      const deletedSpaceIdSet = new Set<string>()
      const spNameMap = new Map<string, string>()

      for (const s of allSpaces) {
        spMap.set(s.id, s)
        spNameMap.set(s.id, s.name || 'Espacio sin nombre')
        if (s.isDeleted) {
          deletedSpaceIdSet.add(s.id)
        }
      }

      const dSpaces = allSpaces
        .filter((s) => Boolean(s.isDeleted) && isSpaceVisible(s, member, authUserId))
        .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0))

      const countByTrashedSpace = new Map<string, number>()
      const folderGroupsMap = new Map<string, TrashedFolderGroup>()
      const standalone: WorkspaceItem[] = []

      for (const w of allWorkspaces) {
        if (!w.isDeleted || !isWorkspaceVisible(w, member, authUserId)) continue

        const spId = w.spaceId || DEFAULT_SPACE_ID
        if (deletedSpaceIdSet.has(spId)) {
          if (w.trashedWithSpaceId === spId) {
            countByTrashedSpace.set(spId, (countByTrashedSpace.get(spId) || 0) + 1)
          }
          continue
        }

        const tf = normalizeFolderPath(w.trashedFolder)
        if (tf) {
          const groupKey = `${spId}::${tf}`
          const existing = folderGroupsMap.get(groupKey)
          const leaf = tf.split('/').pop() || tf
          if (existing) {
            existing.docs.push(w)
            existing.deletedAt = Math.max(existing.deletedAt, w.updatedAt || 0)
          } else {
            folderGroupsMap.set(groupKey, {
              key: groupKey,
              spaceId: spId,
              spaceName: spNameMap.get(spId) || 'Espacio principal',
              folderPath: tf,
              leafName: leaf,
              docs: [w],
              deletedAt: w.updatedAt || 0
            })
          }
        } else {
          standalone.push(w)
        }
      }

      const dFolders = Array.from(folderGroupsMap.values()).sort((a, b) => b.deletedAt - a.deletedAt)
      standalone.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0))

      return {
        deletedSpaces: dSpaces,
        deletedFolders: dFolders,
        deletedStandaloneDocs: standalone,
        spaceNameMap: spNameMap,
        spaceDocsCountMap: countByTrashedSpace
      }
    }, [allSpaces, allWorkspaces, member, authUserId])

  const normalizedQuery = searchQuery.trim().toLowerCase()

  const filteredSpaces = deletedSpaces.filter((s) =>
    (s.name || '').toLowerCase().includes(normalizedQuery)
  )
  const filteredFolders = deletedFolders.filter(
    (fg) =>
      fg.folderPath.toLowerCase().includes(normalizedQuery) ||
      fg.docs.some((d) => (d.title || '').toLowerCase().includes(normalizedQuery))
  )
  const filteredDocs = deletedStandaloneDocs.filter((w) =>
    (w.title || '').toLowerCase().includes(normalizedQuery)
  )

  const totalCount = deletedSpaces.length + deletedFolders.length + deletedStandaloneDocs.length

  const handleRestoreSpace = async (space: SpaceItem) => {
    if (!canUserManageSpace(space, member, authUserId)) {
      toast.error('Solo el creador o un administrador pueden restaurar este espacio.')
      return
    }
    try {
      await restoreSpaceFromTrash(space.id)
      syncEngine.scheduleSync(50)
      toast.success(`Espacio "${space.name}" restaurado`)
    } catch (err) {
      console.error('Error al restaurar espacio', err)
      toast.error('No se pudo restaurar el espacio')
    }
  }

  const handlePermanentDeleteSpace = async (space: SpaceItem) => {
    if (!canUserManageSpace(space, member, authUserId)) {
      toast.error('Solo el creador o un administrador pueden eliminar definitivamente este espacio.')
      return
    }
    if (!confirm(`¿Eliminar permanentemente el espacio "${space.name}" y todas sus notas? No se podrá recuperar.`)) {
      return
    }
    try {
      await permanentlyDeleteSpace(space.id)
      syncEngine.scheduleSync(50)
      toast.info('Espacio y sus documentos eliminados definitivamente')
    } catch (err) {
      console.error('Error al eliminar espacio definitivamente', err)
      toast.error('No se pudo eliminar el espacio')
    }
  }

  const handleRestoreFolder = async (group: TrashedFolderGroup) => {
    const undeletable = group.docs.filter((d) => !canUserDeleteWorkspace(d, member, authUserId))
    if (undeletable.length > 0) {
      toast.error('Esta carpeta contiene notas de otros miembros que no puedes restaurar.')
      return
    }
    try {
      await db.workspaces.bulkUpdate(
        group.docs.map((d) => ({
          key: d.id,
          changes: {
            isDeleted: false,
            trashedFolder: undefined,
            trashedWithSpaceId: undefined,
            updatedAt: getSafeTimestamp(d.updatedAt),
            syncStatus: 'pending' as const
          }
        }))
      )

      const targetSpace = allSpaces.find((s) => s.id === group.spaceId)
      if (targetSpace && canUserManageSpace(targetSpace, member, authUserId)) {
        const currentOrder = targetSpace.folderOrder || []
        if (!currentOrder.includes(group.folderPath)) {
          await updateSpace(targetSpace.id, {
            folderOrder: [...currentOrder, group.folderPath]
          })
        }
      }

      syncEngine.scheduleSync(50)
      toast.success(`Carpeta "${group.leafName}" restaurada (${group.docs.length} notas)`)
    } catch (err) {
      console.error('Error al restaurar carpeta', err)
      toast.error('No se pudo restaurar la carpeta')
    }
  }

  const handlePermanentDeleteFolder = async (group: TrashedFolderGroup) => {
    const undeletable = group.docs.filter((d) => !canUserDeleteWorkspace(d, member, authUserId))
    if (undeletable.length > 0) {
      toast.error('Esta carpeta contiene notas de otros miembros que no puedes eliminar.')
      return
    }
    if (
      !confirm(
        `¿Eliminar permanentemente la carpeta "${group.leafName}" y sus ${group.docs.length} notas? No se podrá recuperar.`
      )
    ) {
      return
    }
    try {
      await permanentlyDeleteWorkspaceBatch(group.docs, member, authUserId)
      syncEngine.scheduleSync(50)
      toast.info(`Carpeta "${group.leafName}" eliminada definitivamente`)
    } catch (err) {
      console.error('Error al eliminar carpeta definitivamente', err)
      toast.error('No se pudo eliminar la carpeta')
    }
  }

  const handleRestoreDoc = async (doc: WorkspaceItem) => {
    if (!canUserDeleteWorkspace(doc, member, authUserId)) {
      toast.error('Solo el creador o un administrador pueden restaurar esta nota.')
      return
    }
    try {
      await db.workspaces.update(doc.id, {
        isDeleted: false,
        trashedFolder: undefined,
        trashedWithSpaceId: undefined,
        updatedAt: getSafeTimestamp(doc.updatedAt),
        syncStatus: 'pending'
      })
      syncEngine.scheduleSync(50)
      toast.success('Documento restaurado')
    } catch (err) {
      console.error('Error al restaurar', err)
    }
  }

  const handlePermanentDeleteDoc = async (doc: WorkspaceItem) => {
    if (!canUserDeleteWorkspace(doc, member, authUserId)) {
      toast.error('Solo el creador o un administrador pueden eliminar definitivamente esta nota.')
      return
    }
    if (!confirm('¿Eliminar permanentemente este documento? No se podrá recuperar.')) return
    try {
      await permanentlyDeleteWorkspaceBatch([doc], member, authUserId)
      syncEngine.scheduleSync(50)
      toast.info('Documento y sus fotos eliminados definitivamente')
    } catch (err) {
      console.error('Error al borrar definitivamente', err)
    }
  }

  const handleEmptyTrash = async () => {
    const deletableSpaces = deletedSpaces.filter((s) => canUserManageSpace(s, member, authUserId))
    const deletableFolderDocs = deletedFolders
      .filter((fg) => fg.docs.every((d) => canUserDeleteWorkspace(d, member, authUserId)))
      .flatMap((fg) => fg.docs)
    const deletableStandalone = deletedStandaloneDocs.filter((w) =>
      canUserDeleteWorkspace(w, member, authUserId)
    )
    const allDeletableDocs = [...deletableFolderDocs, ...deletableStandalone]

    if (deletableSpaces.length === 0 && allDeletableDocs.length === 0) {
      if (totalCount > 0) {
        toast.error('Solo los autores o un administrador pueden vaciar estos elementos.')
      }
      return
    }
    if (
      !confirm(
        '¿Vaciar toda la papelera permanentemente? Se eliminará todo sin dejar rastro en la base de datos.'
      )
    ) {
      return
    }
    try {
      for (const sp of deletableSpaces) {
        await permanentlyDeleteSpace(sp.id)
      }
      if (allDeletableDocs.length > 0) {
        await permanentlyDeleteWorkspaceBatch(allDeletableDocs, member, authUserId)
      }
      syncEngine.scheduleSync(50)
      toast.info('Papelera vaciada definitivamente')
    } catch (err) {
      console.error('Error al vaciar papelera', err)
      toast.error('No se pudo vaciar la papelera')
    }
  }

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
              {totalCount} {totalCount === 1 ? 'elemento' : 'elementos'} en la papelera
            </p>
          </div>
        </div>

        {/* Header Actions */}
        <div className="flex items-center gap-2 sm:gap-3 w-full sm:w-auto">
          {totalCount > 0 && (
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar en papelera..."
              className="flex-1 sm:w-44 px-2.5 py-1 text-xs bg-[var(--app-bg-secondary)] border border-[var(--app-border)] rounded-md text-[var(--app-text-primary)] placeholder:text-[var(--app-text-muted)] outline-none focus:border-blue-500/50"
            />
          )}
          {totalCount > 0 && (
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
      <div className="flex-1 overflow-y-auto px-3 sm:px-6 md:px-10 py-4 sm:py-6 max-w-5xl w-full mx-auto space-y-6 custom-scrollbar">
        {totalCount === 0 ? (
          <div className="py-24 text-center">
            <div className="w-12 h-12 rounded-full bg-[var(--app-bg-secondary)] border border-[var(--app-border)] mx-auto flex items-center justify-center text-[var(--app-text-muted)] mb-3">
              <Trash2 className="w-5 h-5" />
            </div>
            <p className="text-sm font-medium text-[var(--app-text-secondary)]">La papelera está vacía</p>
            <p className="text-xs text-[var(--app-text-muted)] mt-1">
              Los espacios, carpetas y documentos que elimines aparecerán aquí
            </p>
          </div>
        ) : (
          <>
            {/* 1. Espacios de trabajo */}
            {filteredSpaces.length > 0 && (
              <section className="space-y-2">
                <h3 className="text-[11px] font-semibold uppercase tracking-wider text-[var(--app-text-muted)] px-1">
                  Espacios de trabajo ({filteredSpaces.length})
                </h3>
                {filteredSpaces.map((sp) => {
                  const assocCount = spaceDocsCountMap.get(sp.id) || 0
                  return (
                    <div
                      key={sp.id}
                      className="flex items-center justify-between p-3.5 rounded-lg bg-[var(--app-bg-secondary)] border border-[var(--app-border)] hover:bg-[var(--app-hover)] transition gap-3"
                    >
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <div className="w-9 h-9 rounded-md bg-[var(--app-bg-primary)] border border-[var(--app-border)] flex items-center justify-center shrink-0 text-[var(--app-text-muted)]">
                          {sp.icon ? (
                            <AppleEmoji emoji={sp.icon} size={18} />
                          ) : (
                            <Layers className="w-4 h-4 text-violet-500 dark:text-violet-400" />
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <h4 className="text-sm font-medium text-[var(--app-text-primary)] truncate">
                            {renderWithAppleEmoji(sp.name || 'Espacio sin nombre')}
                          </h4>
                          <p className="text-xs text-[var(--app-text-muted)] mt-0.5 font-mono">
                            Espacio · {assocCount} {assocCount === 1 ? 'nota' : 'notas'} · Eliminado{' '}
                            {formatRelativeTime(sp.updatedAt)}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          onClick={() => handleRestoreSpace(sp)}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-[var(--app-bg-primary)] hover:bg-[var(--app-hover)] border border-[var(--app-border)] text-[var(--app-text-primary)] text-xs font-medium transition cursor-pointer"
                        >
                          <RotateCcw className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                          <span>Restaurar</span>
                        </button>
                        <button
                          onClick={() => handlePermanentDeleteSpace(sp)}
                          className="p-1.5 rounded-md hover:bg-rose-500/20 text-[var(--app-text-muted)] hover:text-rose-500 dark:hover:text-rose-400 transition cursor-pointer"
                          title="Eliminar definitivamente"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  )
                })}
              </section>
            )}

            {/* 2. Carpetas */}
            {filteredFolders.length > 0 && (
              <section className="space-y-2">
                <h3 className="text-[11px] font-semibold uppercase tracking-wider text-[var(--app-text-muted)] px-1">
                  Carpetas ({filteredFolders.length})
                </h3>
                {filteredFolders.map((fg) => (
                  <div
                    key={fg.key}
                    className="flex items-center justify-between p-3.5 rounded-lg bg-[var(--app-bg-secondary)] border border-[var(--app-border)] hover:bg-[var(--app-hover)] transition gap-3"
                  >
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <div className="w-9 h-9 rounded-md bg-[var(--app-bg-primary)] border border-[var(--app-border)] flex items-center justify-center shrink-0 text-[var(--app-text-muted)]">
                        <Folder className="w-4 h-4 text-amber-500 dark:text-amber-400" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <h4 className="text-sm font-medium text-[var(--app-text-primary)] truncate">
                          {fg.folderPath}
                        </h4>
                        <p className="text-xs text-[var(--app-text-muted)] mt-0.5 font-mono truncate">
                          {fg.spaceName} · {fg.docs.length} {fg.docs.length === 1 ? 'nota' : 'notas'} · Eliminada{' '}
                          {formatRelativeTime(fg.deletedAt)}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={() => handleRestoreFolder(fg)}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-[var(--app-bg-primary)] hover:bg-[var(--app-hover)] border border-[var(--app-border)] text-[var(--app-text-primary)] text-xs font-medium transition cursor-pointer"
                      >
                        <RotateCcw className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                        <span>Restaurar</span>
                      </button>
                      <button
                        onClick={() => handlePermanentDeleteFolder(fg)}
                        className="p-1.5 rounded-md hover:bg-rose-500/20 text-[var(--app-text-muted)] hover:text-rose-500 dark:hover:text-rose-400 transition cursor-pointer"
                        title="Eliminar definitivamente"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </section>
            )}

            {/* 3. Archivos / Documentos */}
            {filteredDocs.length > 0 && (
              <section className="space-y-2">
                <h3 className="text-[11px] font-semibold uppercase tracking-wider text-[var(--app-text-muted)] px-1">
                  Archivos y documentos ({filteredDocs.length})
                </h3>
                {filteredDocs.map((doc) => {
                  const spName = spaceNameMap.get(doc.spaceId || DEFAULT_SPACE_ID) || 'Espacio principal'
                  return (
                    <div
                      key={doc.id}
                      className="flex items-center justify-between p-3.5 rounded-lg bg-[var(--app-bg-secondary)] border border-[var(--app-border)] hover:bg-[var(--app-hover)] transition gap-3"
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
                          <p className="text-xs text-[var(--app-text-muted)] mt-0.5 font-mono truncate">
                            {spName}
                            {doc.folder ? ` / ${doc.folder}` : ''} · Eliminado{' '}
                            {formatRelativeTime(doc.updatedAt)}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          onClick={() => handleRestoreDoc(doc)}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-[var(--app-bg-primary)] hover:bg-[var(--app-hover)] border border-[var(--app-border)] text-[var(--app-text-primary)] text-xs font-medium transition cursor-pointer"
                        >
                          <RotateCcw className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                          <span>Restaurar</span>
                        </button>
                        <button
                          onClick={() => handlePermanentDeleteDoc(doc)}
                          className="p-1.5 rounded-md hover:bg-rose-500/20 text-[var(--app-text-muted)] hover:text-rose-500 dark:hover:text-rose-400 transition cursor-pointer"
                          title="Eliminar definitivamente"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  )
                })}
              </section>
            )}
          </>
        )}
      </div>
    </div>
  )
}
