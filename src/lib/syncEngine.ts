import { type RealtimeChannel } from '@supabase/supabase-js'
import {
  db,
  type WorkspaceItem,
  type CanvasNodeItem,
  type CanvasEdgeItem,
  type OfflineAsset,
  type SpaceItem,
  type CollectionItem,
  type TagItem
} from '../db'
import { getSupabaseClient, getStoredSupabaseConfig, getAuthUser } from './supabase'
import { getCurrentMember, TEAM_MEMBERS, isUserAdmin, isWorkspaceOwner } from './teamAuth'
import { computeImageHash, uploadToSupabaseStorage } from './imageOptimizer'

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
  private realtimeChannel: RealtimeChannel | null = null
  private realtimeClientRef: any = null
  private lastPushCompletedAt = 0
  private serverClockOffset = 0
  private lastClockSyncAt = 0

  private getServerNow(): number {
    return Date.now() + this.serverClockOffset
  }

  private async calibrateServerClock(supabase: any): Promise<void> {
    if (Date.now() - this.lastClockSyncAt < 5 * 60_000) return
    try {
      const { data, error } = await supabase.rpc('get_server_time_ms')
      if (!error && typeof data === 'number' && Number.isFinite(data)) {
        this.serverClockOffset = data - Date.now()
        this.lastClockSyncAt = Date.now()
      }
    } catch {
      // Silencioso si el RPC aún no existe en la base de datos
    }
  }

  private clampTimestamp(ts: number | undefined | null, nowServer: number): number {
    if (!ts || !Number.isFinite(ts)) return nowServer
    return Math.min(ts, nowServer)
  }

  private shouldApplyRemote(
    local: { updatedAt?: number; syncStatus?: string } | undefined,
    remoteUpdated: number,
    nowServer: number
  ): boolean {
    if (!local) return true
    if (local.syncStatus === 'pending' && (local.updatedAt || 0) >= remoteUpdated) {
      return false
    }
    if (local.syncStatus === 'synced' && (local.updatedAt || 0) > nowServer + 5000) {
      return true
    }
    return remoteUpdated > (local.updatedAt || 0)
  }

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

  private handleRealtimeEvent = () => {
    if (!this.isOnline) return
    if (this.isSyncing) {
      this.syncQueued = true
      return
    }
    if (Date.now() - this.lastPushCompletedAt < 1500) return
    this.scheduleSync(800)
  }

  public async initRealtimeSubscription() {
    if (!this.isOnline) return
    const config = getStoredSupabaseConfig()
    if (!config.enabled || !config.url || !config.anonKey) return

    const supabase = getSupabaseClient()
    if (!supabase) return

    const authUser = await getAuthUser()
    if (!authUser) return

    if (this.realtimeChannel && this.realtimeClientRef === supabase) {
      return
    }
    this.stopRealtimeSubscription()

    this.realtimeClientRef = supabase
    this.realtimeChannel = supabase
      .channel('seven-note-sync')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'seven_workspaces' }, this.handleRealtimeEvent)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'seven_canvas_nodes' }, this.handleRealtimeEvent)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'seven_canvas_edges' }, this.handleRealtimeEvent)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'seven_spaces' }, this.handleRealtimeEvent)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'seven_collections' }, this.handleRealtimeEvent)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'seven_tags' }, this.handleRealtimeEvent)
      .subscribe()
  }

  public stopRealtimeSubscription() {
    if (this.realtimeChannel && this.realtimeClientRef) {
      try {
        this.realtimeClientRef.removeChannel(this.realtimeChannel)
      } catch {
        // ignore channel cleanup failures
      }
    }
    this.realtimeChannel = null
    this.realtimeClientRef = null
  }

  public async updatePendingCount() {
    try {
      const [
        pendingWorkspaces,
        pendingNodes,
        pendingEdges,
        pendingSpaces,
        pendingCollections,
        pendingTags,
        pendingAssets
      ] = await Promise.all([
        db.workspaces.where('syncStatus').equals('pending').count(),
        db.canvasNodes.where('syncStatus').equals('pending').count(),
        db.canvasEdges.where('syncStatus').equals('pending').count(),
        db.spaces.where('syncStatus').equals('pending').count(),
        db.collections.where('syncStatus').equals('pending').count(),
        db.tags.where('syncStatus').equals('pending').count(),
        db.offlineAssets.where('syncStatus').equals('pending').count()
      ])

      this.pendingCount =
        pendingWorkspaces +
        pendingNodes +
        pendingEdges +
        pendingSpaces +
        pendingCollections +
        pendingTags +
        pendingAssets

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

      void this.initRealtimeSubscription()
      await this.calibrateServerClock(supabase)
      const nowServer = this.getServerNow()

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
            created_at: this.clampTimestamp(s.createdAt, nowServer),
            updated_at: this.clampTimestamp(s.updatedAt, nowServer),
            is_deleted: Boolean(s.isDeleted),
            is_private: Boolean(s.isPrivate),
            admin_only: Boolean(s.adminOnly),
            sort_order: typeof s.sortOrder === 'number' ? s.sortOrder : s.createdAt,
            folder_order: Array.isArray(s.folderOrder) ? s.folderOrder : null,
            owner_member: s.ownerMember || currentMember.id,
            user_id: authUserId
          }))
          let { error: spError } = await supabase.from('seven_spaces').upsert(payload, { onConflict: 'id' })
          if (
            spError &&
            (spError.message?.includes('admin_only') ||
              spError.message?.includes('sort_order') ||
              spError.message?.includes('folder_order') ||
              spError.message?.includes('schema cache'))
          ) {
            // Respaldo si Supabase aún no tiene las columnas admin_only / sort_order / folder_order
            const fallbackPayload = payload.map(({ admin_only: _a, sort_order: _s, folder_order: _f, ...rest }) => rest)
            const retry = await supabase.from('seven_spaces').upsert(fallbackPayload, { onConflict: 'id' })
            spError = retry.error
          }
          if (!spError) {
            this.lastPushCompletedAt = Date.now()
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
          // Si la marca remota está en el futuro (> nowServer + 5s) por desfase de reloj de otro dispositivo,
          // no debe bloquear ni descartar cambios locales válidos.
          const effectiveRemoteUpdated =
            remoteUpdated !== undefined && remoteUpdated > nowServer + 5000
              ? nowServer
              : remoteUpdated
          if (effectiveRemoteUpdated !== undefined && effectiveRemoteUpdated > (w.updatedAt || 0)) {
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
            created_at: this.clampTimestamp(w.createdAt, nowServer),
            updated_at: this.clampTimestamp(w.updatedAt, nowServer),
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
            this.lastPushCompletedAt = Date.now()
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
        // 2B. PUSH: OFFLINE ASSETS (IMAGES / ATTACHMENTS)
        // ==========================================
        const pendingAssets = await db.offlineAssets.where('syncStatus').equals('pending').toArray()
        if (pendingAssets.length > 0) {
          for (const asset of pendingAssets as OfflineAsset[]) {
            try {
              const hash = await computeImageHash(asset.dataBlob)
              const ext =
                asset.mimeType === 'image/webp'
                  ? 'webp'
                  : asset.mimeType === 'image/jpeg'
                    ? 'jpg'
                    : asset.mimeType === 'image/png'
                      ? 'png'
                      : asset.name.split('.').pop()?.toLowerCase() || 'bin'
              const folder = asset.mimeType.startsWith('image/') ? 'images' : 'files'
              const path = `${folder}/${hash.slice(0, 20)}.${ext}`
              const remoteUrl = await uploadToSupabaseStorage(asset.dataBlob, path)
              if (remoteUrl) {
                await db.offlineAssets.update(asset.id, { remoteUrl, syncStatus: 'synced' })
                const wsNodes = await db.canvasNodes.where('workspaceId').equals(asset.workspaceId).toArray()
                const matchingNodes = wsNodes.filter((n) => n.data?.assetId === asset.id)
                if (matchingNodes.length > 0) {
                  const now = Date.now()
                  await db.canvasNodes.bulkUpdate(
                    matchingNodes.map((n) => ({
                      key: n.id,
                      changes: {
                        data: { ...(n.data || {}), url: remoteUrl, src: remoteUrl, isRemote: true },
                        updatedAt: now,
                        syncStatus: 'pending' as const
                      }
                    }))
                  )
                }
                this.lastPushCompletedAt = Date.now()
              }
            } catch (assetErr) {
              console.warn('Warning uploading offline asset:', asset.id, assetErr)
            }
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
            created_at: this.clampTimestamp(n.createdAt, nowServer),
            updated_at: this.clampTimestamp(n.updatedAt, nowServer),
            is_deleted: n.isDeleted
          }))

          const { error: nodeError } = await supabase.from('seven_canvas_nodes').upsert(payload, { onConflict: 'id' })
          if (!nodeError) {
            this.lastPushCompletedAt = Date.now()
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
            created_at: this.clampTimestamp(e.createdAt, nowServer),
            updated_at: this.clampTimestamp(e.updatedAt, nowServer),
            is_deleted: e.isDeleted
          }))

          const { error: edgeError } = await supabase.from('seven_canvas_edges').upsert(payload, { onConflict: 'id' })
          if (!edgeError) {
            this.lastPushCompletedAt = Date.now()
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
            created_at: this.clampTimestamp(c.createdAt, nowServer),
            updated_at: this.clampTimestamp(c.updatedAt, nowServer),
            is_deleted: Boolean(c.isDeleted)
          }))
          const { error: colError } = await supabase.from('seven_collections').upsert(payload, { onConflict: 'id' })
          if (!colError) {
            this.lastPushCompletedAt = Date.now()
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
            this.lastPushCompletedAt = Date.now()
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
      // y limitar cualquier lastSyncTime previo que hubiera quedado en el futuro.
      const effectiveLastSyncTime = Math.min(this.lastSyncTime || 0, nowServer)
      const lastSync = isInitialDevicePull ? 0 : Math.max(0, effectiveLastSyncTime - 120_000)

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

          const remoteSpaceUpdated = this.clampTimestamp(Number(rs.updated_at) || 0, nowServer)
          if (this.shouldApplyRemote(local, remoteSpaceUpdated, nowServer)) {
            await db.spaces.put({
              id: rs.id,
              name: rs.name,
              icon: rs.icon,
              color: rs.color,
              createdAt: this.clampTimestamp(rs.created_at, nowServer),
              updatedAt: remoteSpaceUpdated,
              isDeleted: false,
              isPrivate: Boolean(rs.is_private),
              adminOnly: Boolean(rs.admin_only),
              sortOrder: typeof rs.sort_order === 'number' ? rs.sort_order : rs.created_at,
              folderOrder: Array.isArray(rs.folder_order) ? rs.folder_order : undefined,
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
      const { data: remoteWorkspacesData, error: wsPullErr } = await supabase
        .from('seven_workspaces')
        .select('*')
        .gt('updated_at', lastSync)

      if (wsPullErr) {
        console.warn('Error pulling workspaces:', wsPullErr.message)
        hasPullErrors = true
      } else {
        const allLocalWs = await db.workspaces.toArray()
        const localWsMap = new Map(allLocalWs.map((w) => [w.id, w]))
        const remoteWorkspaces: any[] = [...(remoteWorkspacesData || [])]
        const fetchedWsIds = new Set(remoteWorkspaces.map((rw: any) => rw.id))
        let allRemoteWsIds: Set<string> | null =
          lastSync === 0 ? new Set(remoteWorkspaces.map((rw: any) => rw.id)) : null

        const isWorkspaceAccessible = (rw: any): boolean => {
          if (rw.space_id && restrictedAdminSpaceIds.has(rw.space_id) && !isCurrentAdmin) {
            return false
          }
          if (!rw.is_private) return true
          return (
            rw.owner_member === currentMember.id ||
            rw.owner_member === currentMember.name?.toLowerCase() ||
            (Boolean(currentMember.email) && rw.owner_member?.toLowerCase() === currentMember.email?.toLowerCase()) ||
            rw.user_id === currentMember.id ||
            (Boolean(authUserId) && rw.user_id === authUserId) ||
            TEAM_MEMBERS.some(
              (tm) =>
                (tm.id === rw.owner_member || tm.name.toLowerCase() === rw.owner_member?.toLowerCase()) &&
                (tm.id === currentMember.id ||
                  (Boolean(currentMember.email) && tm.email?.toLowerCase() === currentMember.email?.toLowerCase()))
            )
          )
        }

        // En sync incremental, verificar índice ligero para detectar documentos nuevos o actualizados
        // que hayan quedado con un updated_at anterior a lastSync (p. ej. creados offline o por desfase de reloj).
        if (lastSync > 0) {
          const { data: remoteWsIndex, error: wsIndexErr } = await supabase
            .from('seven_workspaces')
            .select('id, updated_at, is_deleted, is_private, owner_member, user_id, space_id')

          if (!wsIndexErr && remoteWsIndex) {
            allRemoteWsIds = new Set(remoteWsIndex.map((r: any) => r.id))
            const missingOrNewerIds: string[] = []

            for (const r of remoteWsIndex) {
              if (fetchedWsIds.has(r.id) || !isWorkspaceAccessible(r)) continue
              const local = localWsMap.get(r.id)
              if (!local) {
                missingOrNewerIds.push(r.id)
                continue
              }
              if (local.syncStatus !== 'pending') {
                const remoteUpdated = this.clampTimestamp(Number(r.updated_at) || 0, nowServer)
                if (remoteUpdated > (local.updatedAt || 0) || Boolean(r.is_deleted) !== Boolean(local.isDeleted)) {
                  missingOrNewerIds.push(r.id)
                }
              }
            }

            for (let i = 0; i < missingOrNewerIds.length; i += 100) {
              const batchIds = missingOrNewerIds.slice(i, i + 100)
              const { data: missingRows, error: missingErr } = await supabase
                .from('seven_workspaces')
                .select('*')
                .in('id', batchIds)
              if (!missingErr && missingRows) {
                for (const mr of missingRows) {
                  if (!fetchedWsIds.has(mr.id)) {
                    fetchedWsIds.add(mr.id)
                    remoteWorkspaces.push(mr)
                  }
                }
              }
            }
          }
        }

        const wsToPut: WorkspaceItem[] = []

        for (const rw of remoteWorkspaces) {
          // Si la nota remota es privada y NO pertenece al miembro actual, NO la guardamos localmente
          // ¡Ni siquiera el administrador puede recibir o guardar notas privadas de otros usuarios, y viceversa!
          if (!isWorkspaceAccessible(rw)) {
            continue
          }

          const local = localWsMap.get(rw.id)
          const remoteUpdated = this.clampTimestamp(Number(rw.updated_at) || 0, nowServer)

          if (this.shouldApplyRemote(local, remoteUpdated, nowServer)) {
            const meta = rw.metadata || {}
            wsToPut.push({
              id: rw.id,
              parentId: rw.parent_id,
              spaceId: rw.space_id || 'default-workspace',
              folder: rw.folder,
              title: rw.title,
              icon: rw.icon,
              color: rw.color,
              viewMode: rw.view_mode,
              docContent: rw.doc_content,
              createdAt: this.clampTimestamp(rw.created_at, nowServer),
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

        if (wsToPut.length > 0) {
          await db.workspaces.bulkPut(wsToPut)
        }

        // Eliminar notas locales ya sincronizadas que fueron borradas definitivamente en Supabase
        if (allRemoteWsIds) {
          const wsToDelete = allLocalWs
            .filter((lw) => lw.syncStatus === 'synced' && !allRemoteWsIds!.has(lw.id))
            .map((lw) => lw.id)
          if (wsToDelete.length > 0) {
            await db.workspaces.bulkDelete(wsToDelete).catch(() => {})
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
        const localNodeRows = await db.canvasNodes.bulkGet(remoteNodes.map((rn: any) => rn.id))
        const localNodeMap = new Map(
          localNodeRows.filter((n): n is CanvasNodeItem => Boolean(n)).map((n) => [n.id, n])
        )
        const nodesToDelete: string[] = []
        const nodesToPut: CanvasNodeItem[] = []

        for (const rn of remoteNodes) {
          const local = localNodeMap.get(rn.id)
          if (rn.is_deleted) {
            if (local) nodesToDelete.push(rn.id)
            continue
          }
          const remoteNodeUpdated = this.clampTimestamp(Number(rn.updated_at) || 0, nowServer)
          if (this.shouldApplyRemote(local, remoteNodeUpdated, nowServer)) {
            nodesToPut.push({
              id: rn.id,
              workspaceId: rn.workspace_id,
              type: rn.type,
              positionX: rn.position_x,
              positionY: rn.position_y,
              width: rn.width,
              height: rn.height,
              data: rn.data,
              createdAt: this.clampTimestamp(rn.created_at, nowServer),
              updatedAt: remoteNodeUpdated,
              isDeleted: rn.is_deleted,
              syncStatus: 'synced'
            })
          }
        }

        if (nodesToDelete.length > 0) {
          await db.canvasNodes.bulkDelete(nodesToDelete).catch(() => {})
        }
        if (nodesToPut.length > 0) {
          await db.canvasNodes.bulkPut(nodesToPut)
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
        const localEdgeRows = await db.canvasEdges.bulkGet(remoteEdges.map((re: any) => re.id))
        const localEdgeMap = new Map(
          localEdgeRows.filter((e): e is CanvasEdgeItem => Boolean(e)).map((e) => [e.id, e])
        )
        const edgesToDelete: string[] = []
        const edgesToPut: CanvasEdgeItem[] = []

        for (const re of remoteEdges) {
          const local = localEdgeMap.get(re.id)
          if (re.is_deleted) {
            if (local) edgesToDelete.push(re.id)
            continue
          }
          const remoteEdgeUpdated = this.clampTimestamp(Number(re.updated_at) || 0, nowServer)
          if (this.shouldApplyRemote(local, remoteEdgeUpdated, nowServer)) {
            edgesToPut.push({
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
              createdAt: this.clampTimestamp(re.created_at, nowServer),
              updatedAt: remoteEdgeUpdated,
              isDeleted: re.is_deleted,
              syncStatus: 'synced'
            })
          }
        }

        if (edgesToDelete.length > 0) {
          await db.canvasEdges.bulkDelete(edgesToDelete).catch(() => {})
        }
        if (edgesToPut.length > 0) {
          await db.canvasEdges.bulkPut(edgesToPut)
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
        const localColRows = await db.collections.bulkGet(remoteCollections.map((rc: any) => rc.id))
        const localColMap = new Map(
          localColRows.filter((c): c is CollectionItem => Boolean(c)).map((c) => [c.id, c])
        )
        const colsToDelete: string[] = []
        const colsToPut: CollectionItem[] = []

        for (const rc of remoteCollections) {
          const local = localColMap.get(rc.id)
          if (rc.is_deleted) {
            if (local) colsToDelete.push(rc.id)
            continue
          }
          const remoteColUpdated = this.clampTimestamp(Number(rc.updated_at) || 0, nowServer)
          if (this.shouldApplyRemote(local, remoteColUpdated, nowServer)) {
            colsToPut.push({
              id: rc.id,
              spaceId: rc.space_id,
              name: rc.name,
              icon: rc.icon,
              color: rc.color,
              docIds: Array.isArray(rc.doc_ids) ? rc.doc_ids : [],
              createdAt: this.clampTimestamp(rc.created_at, nowServer),
              updatedAt: remoteColUpdated,
              isDeleted: rc.is_deleted,
              syncStatus: 'synced'
            })
          }
        }

        if (colsToDelete.length > 0) {
          await db.collections.bulkDelete(colsToDelete).catch(() => {})
        }
        if (colsToPut.length > 0) {
          await db.collections.bulkPut(colsToPut)
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
        const localTagRows = await db.tags.bulkGet(remoteTags.map((rt: any) => rt.id))
        const localTagMap = new Map(
          localTagRows.filter((t): t is TagItem => Boolean(t)).map((t) => [t.id, t])
        )
        const tagsToPut: TagItem[] = []

        for (const rt of remoteTags) {
          const local = localTagMap.get(rt.id)
          if (!local || local.syncStatus !== 'pending') {
            tagsToPut.push({
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

        if (tagsToPut.length > 0) {
          await db.tags.bulkPut(tagsToPut)
        }
      }

      // Actualizar timestamp de última sincronización solo si no hubo errores de red/descarga
      if (!hasPullErrors) {
        this.lastSyncTime = this.getServerNow()
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
