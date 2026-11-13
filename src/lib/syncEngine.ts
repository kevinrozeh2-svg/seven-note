import {
  db,
  type WorkspaceItem,
  type CanvasNodeItem,
  type CanvasEdgeItem,
  type SpaceItem,
  type CollectionItem,
  type TagItem
} from '../db'
import { getSupabaseClient, getStoredSupabaseConfig, getAuthUser } from './supabase'
import { getCurrentMember, TEAM_MEMBERS, isUserAdmin, isWorkspaceOwner } from './teamAuth'

export type NetworkStatus = 'online' | 'offline'
export type SyncEngineState = 'idle' | 'syncing' | 'synced' | 'error' | 'offline' | 'unconfigured'

export interface SyncEngineStatus {
  state: SyncEngineState
  pendingCount: number
  lastSyncTime: number | null
  errorMessage: string | null
  isOnline: boolean
  syncIntervalSec: number
}

type StatusListener = (status: SyncEngineStatus) => void

const LAST_SYNC_KEY = 'seven_note_last_sync_time'
const SYNC_INTERVAL_KEY = 'seven_note_sync_interval_sec'

class SyncEngine {
  private listeners: Set<StatusListener> = new Set()
  private state: SyncEngineState = 'idle'
  private pendingCount = 0
  private lastSyncTime: number | null = null
  private errorMessage: string | null = null
  private isOnline: boolean = typeof navigator !== 'undefined' ? navigator.onLine : true
  private syncTimeout: any = null
  private intervalTimer: any = null
  private syncIntervalSec: number = 30 // Por defecto cada 30 segundos
  private isSyncing = false
  private syncQueued = false

  constructor() {
    // Restaurar lastSyncTime persistido
    try {
      const savedTime = localStorage.getItem(LAST_SYNC_KEY)
      if (savedTime) {
        this.lastSyncTime = parseInt(savedTime, 10) || null
      }
      const savedInterval = localStorage.getItem(SYNC_INTERVAL_KEY)
      if (savedInterval) {
        this.syncIntervalSec = Math.max(5, parseInt(savedInterval, 10) || 30)
      }
    } catch (e) {
      console.warn('Error reading sync storage', e)
    }

    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => {
        this.isOnline = true
        this.notify()
        this.triggerSync()
      })
      window.addEventListener('offline', () => {
        this.isOnline = false
        this.state = 'offline'
        this.notify()
      })

      // Cuando el usuario vuelve a enfocar la pestaña, sincronizar
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible' && this.isOnline) {
          this.triggerSync()
        }
      })
    }

    this.updatePendingCount()
    this.startPeriodicSync()

    // Sincronización inicial al iniciar
    setTimeout(() => {
      if (this.isOnline) {
        this.triggerSync()
      }
    }, 2000)
  }

  public setSyncInterval(seconds: number) {
    this.syncIntervalSec = Math.max(5, seconds)
    localStorage.setItem(SYNC_INTERVAL_KEY, this.syncIntervalSec.toString())
    this.startPeriodicSync()
    this.notify()
  }

  public resetLastSyncTime() {
    this.lastSyncTime = null
    try {
      localStorage.removeItem(LAST_SYNC_KEY)
    } catch (e) {
      console.warn('Error removing sync storage', e)
    }
  }

  public getSyncInterval(): number {
    return this.syncIntervalSec
  }

  private startPeriodicSync() {
    if (this.intervalTimer) {
      clearInterval(this.intervalTimer)
    }
    this.intervalTimer = setInterval(() => {
      if (this.isOnline && !this.isSyncing) {
        const config = getStoredSupabaseConfig()
        if (config.enabled && config.url && config.anonKey) {
          this.triggerSync()
        }
      }
    }, this.syncIntervalSec * 1000)
  }

  public subscribe(listener: StatusListener): () => void {
    this.listeners.add(listener)
    listener(this.getStatus())
    return () => this.listeners.delete(listener)
  }

  public getStatus(): SyncEngineStatus {
    return {
      state: this.state,
      pendingCount: this.pendingCount,
      lastSyncTime: this.lastSyncTime,
      errorMessage: this.errorMessage,
      isOnline: this.isOnline,
      syncIntervalSec: this.syncIntervalSec
    }
  }

  private notify() {
    const status = this.getStatus()
    this.listeners.forEach((fn) => fn(status))
  }

  public async updatePendingCount() {
    try {
      const [
        pendingWorkspaces,
        pendingNodes,
        pendingEdges,
        pendingSpaces,
        pendingCollections,
        pendingTags
      ] = await Promise.all([
        db.workspaces.where('syncStatus').equals('pending').count(),
        db.canvasNodes.where('syncStatus').equals('pending').count(),
        db.canvasEdges.where('syncStatus').equals('pending').count(),
        db.spaces.where('syncStatus').equals('pending').count(),
        db.collections.where('syncStatus').equals('pending').count(),
        db.tags.where('syncStatus').equals('pending').count()
      ])

      this.pendingCount =
        pendingWorkspaces +
        pendingNodes +
        pendingEdges +
        pendingSpaces +
        pendingCollections +
        pendingTags

      this.notify()
    } catch (e) {
      console.warn('Error counting pending items', e)
    }
  }

  public scheduleSync(delayMs = 1500) {
    this.updatePendingCount()
    if (this.syncTimeout) clearTimeout(this.syncTimeout)
    this.syncTimeout = setTimeout(() => {
      this.triggerSync()
    }, delayMs)
  }

  public async triggerSync(): Promise<{ success: boolean; message?: string }> {
    if (this.isSyncing) {
      this.syncQueued = true
      return { success: true, message: 'Sincronización ya en curso (en cola)' }
    }

    const config = getStoredSupabaseConfig()
    if (!config.enabled || !config.url || !config.anonKey) {
      this.state = 'unconfigured'
      this.notify()
      return { success: true, message: 'Modo local activo (sin Supabase)' }
    }

    if (!this.isOnline) {
      this.state = 'offline'
      this.notify()
      return { success: false, message: 'Sin conexión a internet' }
    }

    const supabase = getSupabaseClient()
    if (!supabase) {
      this.state = 'unconfigured'
      this.notify()
      return { success: false, message: 'Cliente de Supabase no inicializado' }
    }

    this.isSyncing = true
    this.state = 'syncing'
    this.errorMessage = null
    this.notify()

    try {
      const authUser = await getAuthUser()
      const authUserId = authUser?.id || undefined
      const currentMember = getCurrentMember()

      // Si no hay usuario autenticado, NO intentamos sincronizar
      // ya que las políticas RLS en Supabase bloquearían la consulta y corromperían lastSyncTime
      if (!authUserId) {
        this.state = 'idle'
        this.notify()
        return { success: true, message: 'Esperando sesión de usuario' }
      }

      // Solo empujar cambios locales si hay sesión autenticada (las políticas RLS requieren usuario autenticado)
      if (authUserId) {
        // ==========================================
        // 1. PUSH: SPACES
        // ==========================================
        const pendingSpaces = await db.spaces.where('syncStatus').equals('pending').toArray()
        if (pendingSpaces.length > 0) {
          const payload = pendingSpaces.map((s: SpaceItem) => ({
            id: s.id,
            name: s.name,
            icon: s.icon,
            color: s.color,
            created_at: s.createdAt,
            updated_at: s.updatedAt,
            is_deleted: Boolean(s.isDeleted),
            is_private: Boolean(s.isPrivate),
            admin_only: Boolean(s.adminOnly),
            sort_order: typeof s.sortOrder === 'number' ? s.sortOrder : s.createdAt,
            owner_member: s.ownerMember || currentMember.id,
            user_id: authUserId
          }))
          let { error: spError } = await supabase.from('seven_spaces').upsert(payload, { onConflict: 'id' })
          if (spError && (spError.message?.includes('admin_only') || spError.message?.includes('sort_order') || spError.message?.includes('schema cache'))) {
            // Respaldo si Supabase aún no tiene las columnas admin_only / sort_order
            const fallbackPayload = payload.map(({ admin_only: _a, sort_order: _s, ...rest }) => rest)
            const retry = await supabase.from('seven_spaces').upsert(fallbackPayload, { onConflict: 'id' })
            spError = retry.error
          }
          if (!spError) {
            await db.spaces.bulkUpdate(
              pendingSpaces.map((s) => ({ key: s.id, changes: { syncStatus: 'synced' as const } }))
            )
          } else {
            console.warn('Warning syncing spaces:', spError.message)
          }
        }

        // ==========================================
        // 2. PUSH: WORKSPACES (PAGES / DOCS)
        // ==========================================
        const pendingWorkspaces = await db.workspaces.where('syncStatus').equals('pending').toArray()
        // Capa 2: Si el usuario es un trabajador, solo sube cambios de lo que él mismo creó
        const isUserAdminCurrent = isUserAdmin(currentMember)
        const ownedPending = pendingWorkspaces.filter((w) => {
          if (isUserAdminCurrent) return true
          return isWorkspaceOwner(w, currentMember, authUserId)
        })

        // Evitar sobrescribir en la nube una versión más reciente (p. ej. una nota ya enviada
        // a la papelera desde otro dispositivo) con una copia local desactualizada.
        const remoteVersions = new Map<string, number>()
        for (let i = 0; i < ownedPending.length; i += 100) {
          const ids = ownedPending.slice(i, i + 100).map((w) => w.id)
          const { data: remoteRows } = await supabase
            .from('seven_workspaces')
            .select('id, updated_at')
            .in('id', ids)
          for (const r of remoteRows || []) remoteVersions.set(r.id, Number(r.updated_at) || 0)
        }
        const staleIds: string[] = []
        const allowedPending = ownedPending.filter((w) => {
          const remoteUpdated = remoteVersions.get(w.id)
          if (remoteUpdated !== undefined && remoteUpdated > (w.updatedAt || 0)) {
            staleIds.push(w.id)
            return false
          }
          return true
        })
        if (staleIds.length > 0) {
          // La versión remota es más nueva: el pull la aplicará localmente
          await db.workspaces.bulkUpdate(
            staleIds.map((id) => ({ key: id, changes: { syncStatus: 'synced' as const } }))
          )
        }

        if (allowedPending.length > 0) {
          const payload = allowedPending.map((w: WorkspaceItem) => ({
            id: w.id,
            parent_id: w.parentId,
            space_id: w.spaceId || 'default-workspace',
            folder: w.folder || null,
            title: w.title,
            icon: w.icon,
            color: w.color,
            view_mode: w.viewMode,
            doc_content: w.docContent,
            created_at: w.createdAt,
            updated_at: w.updatedAt,
            is_favorite: w.isFavorite,
            is_deleted: w.isDeleted,
            is_private: Boolean(w.isPrivate),
            owner_member: w.ownerMember || currentMember.id || 'kevin',
            is_public_shared: Boolean(w.isPublicShared),
            share_token: w.shareToken || null,
            share_permission: w.sharePermission || 'view',
            user_id: w.userId || authUserId,
            metadata: {
              tags: w.tags || [],
              documentMode: w.documentMode,
              isJournal: w.isJournal,
              journalDate: w.journalDate,
              templateName: w.templateName,
              createdBy: w.createdBy,
              lastEditedBy: w.lastEditedBy,
              borderlessTheme: w.borderlessTheme,
              pageWidth: w.pageWidth,
              isInformationOpen: w.isInformationOpen,
              informationContent: w.informationContent,
              biDirectionalLinksVisible: w.biDirectionalLinksVisible,
              propertyVisibility: w.propertyVisibility,
              activeProperties: w.activeProperties,
              customProperties: w.customProperties,
              databaseData: w.databaseData,
              canvasGridVariant: w.canvasGridVariant,
              sortOrder: w.sortOrder,
              viewedBy: w.viewedBy,
              isNewItem: w.isNewItem,
              hasCover: w.hasCover,
              coverType: w.coverType,
              coverUrl: w.coverUrl,
              coverColor: w.coverColor,
              coverBannerTitle: w.coverBannerTitle,
              coverBannerSubtitle: w.coverBannerSubtitle,
              coverBannerStyle: w.coverBannerStyle,
              coverPosition: w.coverPosition
            }
          }))

          const { error: wsError } = await supabase.from('seven_workspaces').upsert(payload, { onConflict: 'id' })
          if (!wsError) {
            // Solo marcar como sincronizadas las notas que no cambiaron durante el envío
            // (si se borraron mientras se sincronizaba, siguen pendientes y se reenvían).
            await db.transaction('rw', db.workspaces, async () => {
              for (const w of allowedPending) {
                const current = await db.workspaces.get(w.id)
                if (current && current.updatedAt === w.updatedAt && current.isDeleted === w.isDeleted) {
                  await db.workspaces.update(w.id, { syncStatus: 'synced' })
                }
              }
            })
          } else {
            console.warn('Warning syncing workspaces:', wsError.message)
          }
        }

        // ==========================================
        // 3. PUSH: CANVAS NODES
        // ==========================================
        const pendingNodes = await db.canvasNodes.where('syncStatus').equals('pending').toArray()
        if (pendingNodes.length > 0) {
          const payload = pendingNodes.map((n: CanvasNodeItem) => ({
            id: n.id,
            user_id: authUserId,
            workspace_id: n.workspaceId,
            type: n.type,
            position_x: n.positionX,
            position_y: n.positionY,
            width: n.width,
            height: n.height,
            data: n.data,
            created_at: n.createdAt,
            updated_at: n.updatedAt,
            is_deleted: n.isDeleted
          }))

          const { error: nodeError } = await supabase.from('seven_canvas_nodes').upsert(payload, { onConflict: 'id' })
          if (!nodeError) {
            await db.canvasNodes.bulkUpdate(
              pendingNodes.map((n) => ({ key: n.id, changes: { syncStatus: 'synced' as const } }))
            )
          } else {
            console.warn('Warning syncing canvas nodes:', nodeError.message)
          }
        }

        // ==========================================
        // 4. PUSH: CANVAS EDGES
        // ==========================================
        const pendingEdges = await db.canvasEdges.where('syncStatus').equals('pending').toArray()
        if (pendingEdges.length > 0) {
          const payload = pendingEdges.map((e: CanvasEdgeItem) => ({
            id: e.id,
            user_id: authUserId,
            workspace_id: e.workspaceId,
            source: e.source,
            target: e.target,
            source_handle: e.sourceHandle,
            target_handle: e.targetHandle,
            label: e.label,
            animated: e.animated,
            color: e.color,
            edge_type: e.edgeType || 'default',
            marker_end_type: e.markerEndType || 'arrow',
            created_at: e.createdAt,
            updated_at: e.updatedAt,
            is_deleted: e.isDeleted
          }))

          const { error: edgeError } = await supabase.from('seven_canvas_edges').upsert(payload, { onConflict: 'id' })
          if (!edgeError) {
            await db.canvasEdges.bulkUpdate(
              pendingEdges.map((e) => ({ key: e.id, changes: { syncStatus: 'synced' as const } }))
            )
          } else {
            console.warn('Warning syncing canvas edges:', edgeError.message)
          }
        }

        // ==========================================
        // 5. PUSH: COLLECTIONS
        // ==========================================
        const pendingCollections = await db.collections.where('syncStatus').equals('pending').toArray()
        if (pendingCollections.length > 0) {
          const payload = pendingCollections.map((c: CollectionItem) => ({
            id: c.id,
            user_id: authUserId,
            space_id: c.spaceId,
            name: c.name,
            icon: c.icon,
            color: c.color,
            doc_ids: c.docIds,
            created_at: c.createdAt,
            updated_at: c.updatedAt,
            is_deleted: Boolean(c.isDeleted)
          }))
          const { error: colError } = await supabase.from('seven_collections').upsert(payload, { onConflict: 'id' })
          if (!colError) {
            await db.collections.bulkUpdate(
              pendingCollections.map((c) => ({ key: c.id, changes: { syncStatus: 'synced' as const } }))
            )
          } else {
            console.warn('Warning syncing collections:', colError.message)
          }
        }

        // ==========================================
        // 6. PUSH: TAGS
        // ==========================================
        const pendingTags = await db.tags.where('syncStatus').equals('pending').toArray()
        if (pendingTags.length > 0) {
          const payload = pendingTags.map((t: TagItem) => ({
            id: t.id,
            user_id: authUserId,
            space_id: t.spaceId,
            name: t.name,
            color: t.color,
            created_at: t.createdAt,
            is_deleted: Boolean(t.isDeleted)
          }))
          const { error: tagError } = await supabase.from('seven_tags').upsert(payload, { onConflict: 'id' })
          if (!tagError) {
            await db.tags.bulkUpdate(
              pendingTags.map((t) => ({ key: t.id, changes: { syncStatus: 'synced' as const } }))
            )
          } else {
            console.warn('Warning syncing tags:', tagError.message)
          }
        }
      }

      // ==========================================
      // 7. PULL REMOTE CHANGES (Delta sync o pull completo si dispositivo nuevo)
      // ==========================================
      const [localWsCount, localSpacesCount] = await Promise.all([
        db.workspaces.count(),
        db.spaces.count()
      ])

      // Si la base local no tiene notas o espacios reales, forzamos un pull completo (lastSync = 0)
      // para asegurar que dispositivos móviles o navegadores nuevos obtengan todo el contenido.
      const isInitialDevicePull = localWsCount === 0 || localSpacesCount <= 1
      // Ventana de seguridad de 2 minutos para evitar pérdida de cambios por desfase de reloj entre dispositivos
      const lastSync = isInitialDevicePull ? 0 : Math.max(0, (this.lastSyncTime || 0) - 120_000)

      let hasPullErrors = false
      const restrictedAdminSpaceIds = new Set<string>()
      const isCurrentAdmin = isUserAdmin(currentMember)

      // Pull Spaces: siempre traemos todos los espacios visibles para no perder ninguno por desfase de reloj o lastSyncTime
      const { data: remoteSpaces, error: spPullErr } = await supabase
        .from('seven_spaces')
        .select('*')

      if (spPullErr) {
        console.warn('Error pulling spaces:', spPullErr.message)
        hasPullErrors = true
      } else if (remoteSpaces && remoteSpaces.length > 0) {
        for (const rs of remoteSpaces) {
          // Si el espacio remoto es privado y NO pertenece al miembro actual, NO lo guardamos localmente
          // Ni los administradores pueden recibir o ver espacios privados ajenos
          const isSpaceOwner =
            rs.owner_member === currentMember.id ||
            rs.owner_member === currentMember.name?.toLowerCase() ||
            (currentMember.email && rs.owner_member?.toLowerCase() === currentMember.email.toLowerCase()) ||
            rs.user_id === currentMember.id ||
            (authUserId && rs.user_id === authUserId) ||
            TEAM_MEMBERS.some(
              (tm) =>
                (tm.id === rs.owner_member || tm.name.toLowerCase() === rs.owner_member?.toLowerCase()) &&
                (tm.id === currentMember.id || (currentMember.email && tm.email?.toLowerCase() === currentMember.email.toLowerCase()))
            )

          if (rs.is_private && !isSpaceOwner) {
            continue
          }

          // Si el espacio es exclusivo para admins y el usuario es trabajador (Capa 2), no lo guardamos localmente
          if (rs.admin_only && !isCurrentAdmin) {
            restrictedAdminSpaceIds.add(rs.id)
            const existingLocal = await db.spaces.get(rs.id)
            if (existingLocal) {
              await db.spaces.delete(rs.id).catch(() => {})
            }
            continue
          }

          const local = await db.spaces.get(rs.id)
          // Si en Supabase ya fue eliminado, aseguramos que en local tampoco exista
          if (rs.is_deleted) {
            if (local) {
              await db.spaces.delete(rs.id).catch(() => {})
            }
            continue
          }

          if (!local || rs.updated_at > local.updatedAt) {
            await db.spaces.put({
              id: rs.id,
              name: rs.name,
              icon: rs.icon,
              color: rs.color,
              createdAt: rs.created_at,
              updatedAt: rs.updated_at,
              isDeleted: false,
              isPrivate: Boolean(rs.is_private),
              adminOnly: Boolean(rs.admin_only),
              sortOrder: typeof rs.sort_order === 'number' ? rs.sort_order : rs.created_at,
              ownerMember: rs.owner_member,
              userId: rs.user_id,
              syncStatus: 'synced'
            })
          }
        }

        // Eliminar espacios locales ya sincronizados que fueron borrados definitivamente en Supabase
        const remoteSpaceIds = new Set(remoteSpaces.map((rs: any) => rs.id))
        const allLocalSpaces = await db.spaces.toArray()
        for (const ls of allLocalSpaces) {
          if (ls.syncStatus === 'synced' && !remoteSpaceIds.has(ls.id)) {
            await db.spaces.delete(ls.id).catch(() => {})
          }
        }
      }

      // Pull Workspaces
      const { data: remoteWorkspaces, error: wsPullErr } = await supabase
        .from('seven_workspaces')
        .select('*')
        .gt('updated_at', lastSync)

      if (wsPullErr) {
        console.warn('Error pulling workspaces:', wsPullErr.message)
        hasPullErrors = true
      } else if (remoteWorkspaces && remoteWorkspaces.length > 0) {
        for (const rw of remoteWorkspaces) {
          if (rw.space_id && restrictedAdminSpaceIds.has(rw.space_id) && !isCurrentAdmin) {
            continue
          }
          // Si la nota remota es privada y NO pertenece al miembro actual, NO la guardamos localmente
          // ¡Ni siquiera el administrador puede recibir o guardar notas privadas de otros usuarios, y viceversa!
          const isOwner =
            rw.owner_member === currentMember.id ||
            rw.owner_member === currentMember.name?.toLowerCase() ||
            (currentMember.email && rw.owner_member?.toLowerCase() === currentMember.email.toLowerCase()) ||
            rw.user_id === currentMember.id ||
            (authUserId && rw.user_id === authUserId) ||
            TEAM_MEMBERS.some(
              (tm) =>
                (tm.id === rw.owner_member || tm.name.toLowerCase() === rw.owner_member?.toLowerCase()) &&
                (tm.id === currentMember.id || (currentMember.email && tm.email?.toLowerCase() === currentMember.email.toLowerCase()))
            )

          if (rw.is_private && !isOwner) {
            continue
          }

          const local = await db.workspaces.get(rw.id)
          const remoteUpdated = Number(rw.updated_at) || 0
          // Cambios locales pendientes más recientes tienen prioridad (no resucitar notas borradas)
          if (local && local.syncStatus === 'pending' && (local.updatedAt || 0) >= remoteUpdated) {
            continue
          }

          if (!local || remoteUpdated > (local.updatedAt || 0)) {
            const meta = rw.metadata || {}
            await db.workspaces.put({
              id: rw.id,
              parentId: rw.parent_id,
              spaceId: rw.space_id || 'default-workspace',
              folder: rw.folder,
              title: rw.title,
              icon: rw.icon,
              color: rw.color,
              viewMode: rw.view_mode,
              docContent: rw.doc_content,
              createdAt: rw.created_at,
              updatedAt: remoteUpdated,
              isFavorite: rw.is_favorite,
              // is_deleted en la nube = está en la papelera (el borrado definitivo elimina la fila)
              isDeleted: Boolean(rw.is_deleted),
              syncStatus: 'synced',
              isPrivate: Boolean(rw.is_private),
              ownerMember: rw.owner_member || 'kevin',
              userId: rw.user_id || undefined,
              isPublicShared: Boolean(rw.is_public_shared),
              shareToken: rw.share_token,
              sharePermission: rw.share_permission || 'view',
              tags: meta.tags,
              documentMode: meta.documentMode,
              isJournal: meta.isJournal,
              journalDate: meta.journalDate,
              templateName: meta.templateName,
              createdBy: meta.createdBy,
              lastEditedBy: meta.lastEditedBy,
              borderlessTheme: meta.borderlessTheme,
              pageWidth: meta.pageWidth,
              isInformationOpen: meta.isInformationOpen,
              informationContent: meta.informationContent,
              biDirectionalLinksVisible: meta.biDirectionalLinksVisible,
              propertyVisibility: meta.propertyVisibility,
              activeProperties: meta.activeProperties,
              customProperties: meta.customProperties,
              databaseData: meta.databaseData,
              canvasGridVariant: meta.canvasGridVariant,
              sortOrder: meta.sortOrder ?? (rw as any).sort_order ?? (rw as any).sortOrder,
              viewedBy: meta.viewedBy,
              isNewItem: meta.isNewItem,
              hasCover: meta.hasCover,
              coverType: meta.coverType,
              coverUrl: meta.coverUrl,
              coverColor: meta.coverColor,
              coverBannerTitle: meta.coverBannerTitle,
              coverBannerSubtitle: meta.coverBannerSubtitle,
              coverBannerStyle: meta.coverBannerStyle,
              coverPosition: meta.coverPosition
            })
          }
        }

        // En pull completo, eliminar notas locales ya sincronizadas que fueron borradas definitivamente en Supabase
        if (lastSync === 0) {
          const remoteWsIds = new Set(remoteWorkspaces.map((rw: any) => rw.id))
          const allLocalWs = await db.workspaces.toArray()
          for (const lw of allLocalWs) {
            if (lw.syncStatus === 'synced' && !remoteWsIds.has(lw.id)) {
              await db.workspaces.delete(lw.id).catch(() => {})
            }
          }
        }
      }

      // Pull Canvas Nodes
      const { data: remoteNodes, error: nodesPullErr } = await supabase
        .from('seven_canvas_nodes')
        .select('*')
        .gt('updated_at', lastSync)

      if (nodesPullErr) {
        console.warn('Error pulling canvas nodes:', nodesPullErr.message)
        hasPullErrors = true
      } else if (remoteNodes && remoteNodes.length > 0) {
        for (const rn of remoteNodes) {
          const local = await db.canvasNodes.get(rn.id)
          if (rn.is_deleted) {
            if (local) await db.canvasNodes.delete(rn.id).catch(() => {})
            continue
          }
          if (!local || rn.updated_at > local.updatedAt) {
            await db.canvasNodes.put({
              id: rn.id,
              workspaceId: rn.workspace_id,
              type: rn.type,
              positionX: rn.position_x,
              positionY: rn.position_y,
              width: rn.width,
              height: rn.height,
              data: rn.data,
              createdAt: rn.created_at,
              updatedAt: rn.updated_at,
              isDeleted: rn.is_deleted,
              syncStatus: 'synced'
            })
          }
        }
      }

      // Pull Canvas Edges
      const { data: remoteEdges, error: edgesPullErr } = await supabase
        .from('seven_canvas_edges')
        .select('*')
        .gt('updated_at', lastSync)

      if (edgesPullErr) {
        console.warn('Error pulling canvas edges:', edgesPullErr.message)
        hasPullErrors = true
      } else if (remoteEdges && remoteEdges.length > 0) {
        for (const re of remoteEdges) {
          const local = await db.canvasEdges.get(re.id)
          if (re.is_deleted) {
            if (local) await db.canvasEdges.delete(re.id).catch(() => {})
            continue
          }
          if (!local || re.updated_at > local.updatedAt) {
            await db.canvasEdges.put({
              id: re.id,
              workspaceId: re.workspace_id,
              source: re.source,
              target: re.target,
              sourceHandle: re.source_handle,
              targetHandle: re.target_handle,
              label: re.label,
              animated: re.animated,
              color: re.color,
              edgeType: re.edge_type,
              markerEndType: re.marker_end_type,
              createdAt: re.created_at,
              updatedAt: re.updated_at,
              isDeleted: re.is_deleted,
              syncStatus: 'synced'
            })
          }
        }
      }

      // Pull Collections
      const { data: remoteCollections, error: colPullErr } = await supabase
        .from('seven_collections')
        .select('*')
        .gt('updated_at', lastSync)

      if (colPullErr) {
        console.warn('Error pulling collections:', colPullErr.message)
        hasPullErrors = true
      } else if (remoteCollections && remoteCollections.length > 0) {
        for (const rc of remoteCollections) {
          const local = await db.collections.get(rc.id)
          if (rc.is_deleted) {
            if (local) await db.collections.delete(rc.id).catch(() => {})
            continue
          }
          if (!local || rc.updated_at > local.updatedAt) {
            await db.collections.put({
              id: rc.id,
              spaceId: rc.space_id,
              name: rc.name,
              icon: rc.icon,
              color: rc.color,
              docIds: Array.isArray(rc.doc_ids) ? rc.doc_ids : [],
              createdAt: rc.created_at,
              updatedAt: rc.updated_at,
              isDeleted: rc.is_deleted,
              syncStatus: 'synced'
            })
          }
        }
      }

      // Pull Tags (incluyendo actualizaciones y eliminaciones)
      const { data: remoteTags, error: tagPullErr } = await supabase
        .from('seven_tags')
        .select('*')

      if (tagPullErr) {
        console.warn('Error pulling tags:', tagPullErr.message)
        hasPullErrors = true
      } else if (remoteTags && remoteTags.length > 0) {
        for (const rt of remoteTags) {
          const local = await db.tags.get(rt.id)
          if (!local || local.syncStatus !== 'pending') {
            await db.tags.put({
              id: rt.id,
              spaceId: rt.space_id,
              name: rt.name,
              color: rt.color,
              createdAt: rt.created_at,
              isDeleted: rt.is_deleted,
              syncStatus: 'synced'
            })
          }
        }
      }

      // Actualizar timestamp de última sincronización solo si no hubo errores de red/descarga
      if (!hasPullErrors) {
        this.lastSyncTime = Date.now()
        localStorage.setItem(LAST_SYNC_KEY, this.lastSyncTime.toString())
        this.state = 'synced'
      } else {
        this.state = 'error'
        this.errorMessage = 'Sincronización completada con advertencias en la descarga remota'
      }
      await this.updatePendingCount()

      return { success: !hasPullErrors, message: hasPullErrors ? this.errorMessage! : 'Sincronización completada' }
    } catch (err: any) {
      console.error('Sync failed:', err)
      this.state = 'error'
      this.errorMessage = err?.message || 'Error desconocido al sincronizar'
      this.notify()
      return { success: false, message: this.errorMessage || 'Error' }
    } finally {
      this.isSyncing = false
      if (this.syncQueued) {
        this.syncQueued = false
        setTimeout(() => {
          this.triggerSync()
        }, 150)
      }
    }
  }
}

export const syncEngine = new SyncEngine()
