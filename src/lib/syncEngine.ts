import { type RealtimeChannel } from '@supabase/supabase-js'
import {
  db,
  type WorkspaceItem,
  type CanvasNodeItem,
  type CanvasEdgeItem,
  type OfflineAsset,
  type SpaceItem,
  type CollectionItem,
  type TagItem,
  type NotificationItem,
  getPendingHardDeletes,
  clearPendingHardDeletes,
  markAccountSeeded,
  normalizeFolderPath,
  normalizeFolderColorsMap,
  seedInitialData,
  setServerClockOffset,
  isValidUuid
} from '../db'
import { toast } from './toast'
import { getSupabaseClient, getStoredSupabaseConfig, getAuthUser } from './supabase'
import {
  getCurrentMember,
  TEAM_MEMBERS,
  isUserAdmin,
  isWorkspaceOwner,
  canUserManageSpace
} from './teamAuth'
import { computeImageHash, uploadToSupabaseStorage } from './imageOptimizer'
import {
  notificationService,
  isSyncableNotificationType,
  isNotificationForMember,
  getMemberIdentifiers,
  resolveActorProfile
} from './notificationService'

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
  private syncGeneration = 0
  private initialPullCompleted = false
  private recentPushedVersions = new Map<string, number>()

  private getServerNow(): number {
    return Date.now() + this.serverClockOffset
  }

  private recordRecentPush(id: string, ts: number) {
    this.recentPushedVersions.set(id, ts)
    if (this.recentPushedVersions.size > 500) {
      const firstKey = this.recentPushedVersions.keys().next().value
      if (firstKey) this.recentPushedVersions.delete(firstKey)
    }
  }

  public hasCompletedInitialSync(): boolean {
    return this.initialPullCompleted
  }

  public abortForSignOut(): void {
    this.syncGeneration += 1
    this.initialPullCompleted = false
    this.syncQueued = false
    if (this.syncTimeout) {
      clearTimeout(this.syncTimeout)
      this.syncTimeout = null
    }
    this.recentPushedVersions.clear()
    this.stopRealtimeSubscription()
    this.resetLastSyncTime()
    this.pendingCount = 0
    this.state = 'idle'
    this.errorMessage = null
    this.notify()
  }

  private async fetchAllRows<T = any>(
    buildQuery: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: any }>
  ): Promise<{ data: T[]; error: any }> {
    const pageSize = 1000
    const all: T[] = []
    let from = 0
    for (let page = 0; page < 100; page++) {
      const { data, error } = await buildQuery(from, from + pageSize - 1)
      if (error) {
        return { data: all, error }
      }
      const batch = data || []
      if (batch.length === 0) {
        break
      }
      all.push(...batch)
      from += batch.length
    }
    return { data: all, error: null }
  }

  private async flushPendingHardDeletes(supabase: any): Promise<void> {
    const pendingSpaces = getPendingHardDeletes('spaces')
    if (pendingSpaces.length > 0) {
      const { error } = await supabase.from('seven_spaces').delete().in('id', pendingSpaces)
      if (!error) {
        clearPendingHardDeletes('spaces', pendingSpaces)
      } else {
        const soft = await supabase
          .from('seven_spaces')
          .update({ is_deleted: true, updated_at: this.getServerNow() })
          .in('id', pendingSpaces)
        if (!soft.error) clearPendingHardDeletes('spaces', pendingSpaces)
      }
    }

    const pendingWorkspaces = getPendingHardDeletes('workspaces')
    if (pendingWorkspaces.length > 0) {
      const { error } = await supabase.from('seven_workspaces').delete().in('id', pendingWorkspaces)
      if (!error) {
        clearPendingHardDeletes('workspaces', pendingWorkspaces)
      } else {
        const soft = await supabase
          .from('seven_workspaces')
          .update({ is_deleted: true, updated_at: this.getServerNow() })
          .in('id', pendingWorkspaces)
        if (!soft.error) clearPendingHardDeletes('workspaces', pendingWorkspaces)
      }
    }

    const pendingNodes = getPendingHardDeletes('canvasNodes')
    if (pendingNodes.length > 0) {
      const { error } = await supabase.from('seven_canvas_nodes').delete().in('id', pendingNodes)
      if (!error) clearPendingHardDeletes('canvasNodes', pendingNodes)
    }

    const pendingEdges = getPendingHardDeletes('canvasEdges')
    if (pendingEdges.length > 0) {
      const { error } = await supabase.from('seven_canvas_edges').delete().in('id', pendingEdges)
      if (!error) clearPendingHardDeletes('canvasEdges', pendingEdges)
    }

    const pendingCols = getPendingHardDeletes('collections')
    if (pendingCols.length > 0) {
      const { error } = await supabase.from('seven_collections').delete().in('id', pendingCols)
      if (!error) clearPendingHardDeletes('collections', pendingCols)
    }

    const pendingTags = getPendingHardDeletes('tags')
    if (pendingTags.length > 0) {
      const { error } = await supabase.from('seven_tags').delete().in('id', pendingTags)
      if (!error) clearPendingHardDeletes('tags', pendingTags)
    }
  }

  private async calibrateServerClock(supabase: any): Promise<void> {
    if (Date.now() - this.lastClockSyncAt < 5 * 60_000) return
    try {
      const { data, error } = await supabase.rpc('get_server_time_ms')
      if (!error && typeof data === 'number' && Number.isFinite(data)) {
        this.serverClockOffset = data - Date.now()
        this.lastClockSyncAt = Date.now()
        setServerClockOffset(this.serverClockOffset)
        return
      }
    } catch {
      // Fallback al header Date HTTP si el RPC aún no existe en la base de datos
    }
    try {
      const config = getStoredSupabaseConfig()
      if (config.url && config.anonKey) {
        const res = await fetch(`${config.url.replace(/\/$/, '')}/rest/v1/`, {
          method: 'HEAD',
          headers: { apikey: config.anonKey }
        })
        const dateHeader = res.headers.get('date')
        if (dateHeader) {
          const parsed = Date.parse(dateHeader)
          if (Number.isFinite(parsed)) {
            this.serverClockOffset = parsed - Date.now()
            this.lastClockSyncAt = Date.now()
            setServerClockOffset(this.serverClockOffset)
          }
        }
      }
    } catch {
      // Silencioso si no se pudo leer el header Date
    }
  }

  private clampTimestamp(ts: number | undefined | null, nowServer: number): number {
    if (!ts || !Number.isFinite(ts)) return nowServer
    return Math.min(ts, nowServer)
  }

  private isRemoteStrictlyNewer(
    remoteUpdated: number | undefined,
    localUpdatedAt: number | undefined,
    nowServer: number
  ): boolean {
    if (remoteUpdated === undefined) return false
    // Una marca de tiempo remota en el futuro (> nowServer + 5s) es un desfase de reloj externo
    // y nunca debe marcar como obsoleta una edición local pendiente.
    if (remoteUpdated > nowServer + 5000) return false
    return remoteUpdated > (localUpdatedAt || 0)
  }

  private shouldApplyRemote(
    local: { updatedAt?: number; syncStatus?: string } | undefined,
    remoteUpdated: number,
    nowServer: number
  ): boolean {
    if (!local) return true
    if (local.syncStatus === 'pending') {
      if (remoteUpdated > nowServer + 5000) return false
      return remoteUpdated > (local.updatedAt || 0)
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

  public async forceFullSync(): Promise<{ success: boolean; message?: string }> {
    this.resetLastSyncTime()
    return this.triggerSync()
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

  private handleRealtimeEvent = (payload?: any) => {
    if (!this.isOnline) return
    const changedId = payload?.new?.id || payload?.old?.id
    const changedUpdatedAt = Number(payload?.new?.updated_at) || 0
    if (
      payload?.eventType !== 'DELETE' &&
      changedId &&
      changedUpdatedAt > 0 &&
      this.recentPushedVersions.get(changedId) === changedUpdatedAt &&
      Date.now() - this.lastPushCompletedAt < 5000
    ) {
      return
    }
    if (this.isSyncing) {
      this.syncQueued = true
      return
    }
    const elapsedSincePush = Date.now() - this.lastPushCompletedAt
    const delay = elapsedSincePush < 1200 ? 1500 : 700
    this.scheduleSync(delay)
  }

  public async initRealtimeSubscription() {
    if (!this.isOnline) return
    const config = getStoredSupabaseConfig()
    if (!config.enabled || !config.url || !config.anonKey) return

    const supabase = getSupabaseClient()
    if (!supabase) return

    if (this.realtimeChannel && this.realtimeClientRef === supabase) {
      return
    }

    const authUser = await getAuthUser()
    if (!authUser) return

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
      .on('postgres_changes', { event: '*', schema: 'public', table: 'seven_notifications' }, this.handleRealtimeEvent)
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
        pendingAssets,
        pendingNotifications
      ] = await Promise.all([
        db.workspaces.where('syncStatus').equals('pending').count(),
        db.canvasNodes.where('syncStatus').equals('pending').count(),
        db.canvasEdges.where('syncStatus').equals('pending').count(),
        db.spaces.where('syncStatus').equals('pending').count(),
        db.collections.where('syncStatus').equals('pending').count(),
        db.tags.where('syncStatus').equals('pending').count(),
        db.offlineAssets.where('syncStatus').equals('pending').count(),
        db.notifications.where('syncStatus').equals('pending').count()
      ])

      this.pendingCount =
        pendingWorkspaces +
        pendingNodes +
        pendingEdges +
        pendingSpaces +
        pendingCollections +
        pendingTags +
        pendingAssets +
        pendingNotifications

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

    const syncGen = this.syncGeneration

    try {
      const { data: sessionData } = await supabase.auth.getSession()
      let activeSession = sessionData?.session || null
      if (!activeSession?.access_token) {
        const refreshed = await supabase.auth.refreshSession().catch(() => null)
        activeSession = refreshed?.data?.session || null
      }

      const authUserId = activeSession?.user?.id || (await getAuthUser())?.id || undefined
      const currentMember = getCurrentMember()

      // Si no hay usuario autenticado o se cerró sesión, NO intentamos sincronizar
      if (!authUserId || syncGen !== this.syncGeneration) {
        this.state = 'idle'
        this.notify()
        return { success: true, message: 'Esperando sesión de usuario' }
      }

      // Verificar que el perfil en Supabase esté activo antes de permitir borrados huérfanos en pull
      const { data: profileRow, error: profileErr } = await supabase
        .from('user_profiles')
        .select('status, role')
        .eq('id', authUserId)
        .maybeSingle()
      const isActiveAccountVerified = !profileErr && profileRow?.status === 'active'

      if (syncGen !== this.syncGeneration) {
        return { success: false, message: 'Sincronización cancelada' }
      }

      void this.initRealtimeSubscription()
      await this.calibrateServerClock(supabase)
      const nowServer = this.getServerNow()
      let hasPushErrors = false

      // ==========================================
      // 0. FLUSH PENDING HARD DELETES (Offline tombstones)
      // ==========================================
      await this.flushPendingHardDeletes(supabase)
      const blockedSpaceIds = new Set(getPendingHardDeletes('spaces'))
      const blockedWorkspaceIds = new Set(getPendingHardDeletes('workspaces'))
      const blockedNodeIds = new Set(getPendingHardDeletes('canvasNodes'))
      const blockedEdgeIds = new Set(getPendingHardDeletes('canvasEdges'))
      const blockedCollectionIds = new Set(getPendingHardDeletes('collections'))
      const blockedTagIds = new Set(getPendingHardDeletes('tags'))

      if (syncGen !== this.syncGeneration) {
        return { success: false, message: 'Sincronización cancelada' }
      }

      // Solo empujar cambios locales si hay sesión autenticada (las políticas RLS requieren usuario autenticado)
      if (authUserId) {
        const isUserAdminCurrent = isUserAdmin(currentMember)

        // ==========================================
        // 1. PUSH: SPACES
        // ==========================================
        const pendingSpaces = (await db.spaces.where('syncStatus').equals('pending').toArray()).filter(
          (s) => !blockedSpaceIds.has(s.id) && (isUserAdminCurrent || canUserManageSpace(s, currentMember, authUserId))
        )
        if (pendingSpaces.length > 0) {
          // Evitar sobrescribir en la nube una versión más reciente del espacio con una copia local desactualizada
          const remoteSpaceVersions = new Map<string, number>()
          const spaceIds = pendingSpaces.map((s) => s.id)
          const { data: remoteSpaceRows } = await supabase
            .from('seven_spaces')
            .select('id, updated_at')
            .in('id', spaceIds)
          for (const r of remoteSpaceRows || []) remoteSpaceVersions.set(r.id, Number(r.updated_at) || 0)

          const staleSpaceIds: string[] = []
          const allowedPendingSpaces = pendingSpaces.filter((s) => {
            const remoteUpdated = remoteSpaceVersions.get(s.id)
            if (this.isRemoteStrictlyNewer(remoteUpdated, s.updatedAt, nowServer)) {
              staleSpaceIds.push(s.id)
              return false
            }
            return true
          })

          if (staleSpaceIds.length > 0 && syncGen === this.syncGeneration) {
            await db.spaces.bulkUpdate(
              staleSpaceIds.map((id) => ({ key: id, changes: { syncStatus: 'synced' as const } }))
            )
          }

          if (allowedPendingSpaces.length > 0) {
            const payload = allowedPendingSpaces.map((s: SpaceItem) => {
              const clampedUpdated = this.clampTimestamp(s.updatedAt, nowServer)
              const row: Record<string, any> = {
                id: s.id,
                name: s.name,
                icon: s.icon,
                color: s.color,
                created_at: this.clampTimestamp(s.createdAt, nowServer),
                updated_at: clampedUpdated,
                is_deleted: Boolean(s.isDeleted),
                is_private: Boolean(s.isPrivate),
                admin_only: Boolean(s.adminOnly),
                sort_order: typeof s.sortOrder === 'number' ? s.sortOrder : s.createdAt,
                owner_member: s.ownerMember || currentMember.id,
                user_id: isValidUuid(s.userId) ? s.userId : authUserId
              }
              if (Array.isArray(s.folderOrder)) {
                row.folder_order = s.folderOrder
              }
              if (s.folderColors && typeof s.folderColors === 'object') {
                row.folder_colors = s.folderColors
              }
              return row
            })
            let { error: spError } = await supabase.from('seven_spaces').upsert(payload, { onConflict: 'id' })
            if (
              spError &&
              (spError.message?.includes('admin_only') ||
                spError.message?.includes('sort_order') ||
                spError.message?.includes('folder_order') ||
                spError.message?.includes('folder_colors') ||
                spError.message?.includes('is_private') ||
                spError.message?.includes('owner_member') ||
                spError.message?.includes('schema cache'))
            ) {
              // Respaldo progresivo si alguna columna opcional aún no existe en Supabase
              const fallbackPayload = payload.map(
                ({ admin_only: _a, sort_order: _s, folder_order: _f, folder_colors: _fc, ...rest }) => rest
              )
              const retry = await supabase.from('seven_spaces').upsert(fallbackPayload, { onConflict: 'id' })
              spError = retry.error
            }
            if (!spError && syncGen === this.syncGeneration) {
              this.lastPushCompletedAt = Date.now()
              await db.transaction('rw', db.spaces, async () => {
                for (const s of allowedPendingSpaces) {
                  const clampedUpdated = this.clampTimestamp(s.updatedAt, nowServer)
                  this.recordRecentPush(s.id, clampedUpdated)
                  const current = await db.spaces.get(s.id)
                  if (
                    current &&
                    current.updatedAt === s.updatedAt &&
                    current.name === s.name &&
                    Boolean(current.isDeleted) === Boolean(s.isDeleted) &&
                    JSON.stringify(current.folderOrder || null) === JSON.stringify(s.folderOrder || null) &&
                    JSON.stringify(current.folderColors || null) === JSON.stringify(s.folderColors || null)
                  ) {
                    await db.spaces.update(s.id, { syncStatus: 'synced', updatedAt: clampedUpdated })
                  }
                }
              })
            } else if (spError) {
              hasPushErrors = true
              console.warn('Warning syncing spaces:', spError.message)
              if (spError.code === '42501' || spError.message?.toLowerCase().includes('row-level security')) {
                toast.error('Sin permisos en Supabase para guardar cambios en este espacio.', {
                  id: 'space-sync-rls-error'
                })
              }
            }
          }
        }

        // ==========================================
        // 2. PUSH: WORKSPACES (PAGES / DOCS)
        // ==========================================
        const pendingWorkspaces = (await db.workspaces.where('syncStatus').equals('pending').toArray()).filter(
          (w) => !blockedWorkspaceIds.has(w.id) && !blockedSpaceIds.has(w.spaceId || '')
        )
        // Capa 2: Si el usuario es un trabajador, solo sube cambios de lo que él mismo creó
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
          if (this.isRemoteStrictlyNewer(remoteUpdated, w.updatedAt, nowServer)) {
            staleIds.push(w.id)
            return false
          }
          return true
        })
        if (staleIds.length > 0 && syncGen === this.syncGeneration) {
          // La versión remota es más nueva: el pull la aplicará localmente
          await db.workspaces.bulkUpdate(
            staleIds.map((id) => ({ key: id, changes: { syncStatus: 'synced' as const } }))
          )
        }

        if (allowedPending.length > 0) {
          const payload = allowedPending.map((w: WorkspaceItem) => {
            const clampedUpdated = this.clampTimestamp(w.updatedAt, nowServer)
            return {
              id: w.id,
              parent_id: w.parentId,
              space_id: w.spaceId && w.spaceId !== 'default-space' ? w.spaceId : 'default-workspace',
              folder: normalizeFolderPath(w.folder),
              title: w.title,
              icon: w.icon,
              color: w.color,
              view_mode: w.viewMode,
              doc_content: w.docContent,
              created_at: this.clampTimestamp(w.createdAt, nowServer),
              updated_at: clampedUpdated,
              is_favorite: w.isFavorite,
              is_deleted: w.isDeleted,
              is_private: Boolean(w.isPrivate),
              owner_member: w.ownerMember || currentMember.id || 'kevin',
              is_public_shared: Boolean(w.isPublicShared),
              share_token: w.shareToken || null,
              share_permission: w.sharePermission || 'view',
              user_id: isValidUuid(w.userId) ? w.userId : authUserId,
              metadata: {
                tags: w.tags || [],
                documentMode: w.documentMode,
                isJournal: w.isJournal,
                journalDate: w.journalDate,
                templateName: w.templateName,
                createdBy: w.createdBy,
                ownerName: w.ownerName,
                lastEditedBy: w.lastEditedBy,
                lastBotEditedBy: w.lastBotEditedBy,
                lastBotEditedAt: w.lastBotEditedAt,
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
                coverPosition: w.coverPosition,
                trashedWithSpaceId: w.trashedWithSpaceId,
                trashedFolder: w.trashedFolder
              }
            }
          })

          const succeededItems: WorkspaceItem[] = []
          for (let i = 0; i < payload.length; i += 10) {
            const batchPayload = payload.slice(i, i + 10)
            const batchSource = allowedPending.slice(i, i + 10)
            const { error: batchErr } = await supabase
              .from('seven_workspaces')
              .upsert(batchPayload, { onConflict: 'id' })
            if (!batchErr) {
              succeededItems.push(...batchSource)
            } else {
              // Si un elemento en el lote falla (p. ej. payload muy grande), reintentar uno por uno para no bloquear los demás
              for (let j = 0; j < batchPayload.length; j++) {
                const { error: itemErr } = await supabase
                  .from('seven_workspaces')
                  .upsert(batchPayload[j], { onConflict: 'id' })
                if (!itemErr) {
                  succeededItems.push(batchSource[j])
                } else {
                  hasPushErrors = true
                  console.warn('Warning syncing workspace item:', batchSource[j].id, itemErr.message)
                }
              }
            }
          }

          if (succeededItems.length > 0 && syncGen === this.syncGeneration) {
            this.lastPushCompletedAt = Date.now()
            // Solo marcar como sincronizadas las notas que no cambiaron durante el envío
            // (si se editaron o borraron mientras se sincronizaba, siguen pendientes y se reenvían).
            await db.transaction('rw', db.workspaces, async () => {
              for (const w of succeededItems) {
                const clampedUpdated = this.clampTimestamp(w.updatedAt, nowServer)
                this.recordRecentPush(w.id, clampedUpdated)
                const current = await db.workspaces.get(w.id)
                if (
                  current &&
                  current.updatedAt === w.updatedAt &&
                  current.isDeleted === w.isDeleted &&
                  current.title === w.title &&
                  current.folder === w.folder &&
                  current.hasCover === w.hasCover &&
                  current.coverUrl === w.coverUrl
                ) {
                  await db.workspaces.update(w.id, { syncStatus: 'synced', updatedAt: clampedUpdated })
                }
              }
            })
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
        const pendingNodes = (await db.canvasNodes.where('syncStatus').equals('pending').toArray()).filter(
          (n) => !blockedNodeIds.has(n.id) && !blockedWorkspaceIds.has(n.workspaceId)
        )
        if (pendingNodes.length > 0) {
          const remoteNodeVersions = new Map<string, number>()
          for (let i = 0; i < pendingNodes.length; i += 100) {
            const ids = pendingNodes.slice(i, i + 100).map((n) => n.id)
            const { data: remoteRows } = await supabase
              .from('seven_canvas_nodes')
              .select('id, updated_at')
              .in('id', ids)
            for (const r of remoteRows || []) remoteNodeVersions.set(r.id, Number(r.updated_at) || 0)
          }
          const staleNodeIds: string[] = []
          const allowedPendingNodes = pendingNodes.filter((n) => {
            const remoteUpdated = remoteNodeVersions.get(n.id)
            if (this.isRemoteStrictlyNewer(remoteUpdated, n.updatedAt, nowServer)) {
              staleNodeIds.push(n.id)
              return false
            }
            return true
          })
          if (staleNodeIds.length > 0 && syncGen === this.syncGeneration) {
            await db.canvasNodes.bulkUpdate(
              staleNodeIds.map((id) => ({ key: id, changes: { syncStatus: 'synced' as const } }))
            )
          }

          if (allowedPendingNodes.length > 0) {
            const payload = allowedPendingNodes.map((n: CanvasNodeItem) => ({
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
            if (!nodeError && syncGen === this.syncGeneration) {
              this.lastPushCompletedAt = Date.now()
              await db.transaction('rw', db.canvasNodes, async () => {
                for (const n of allowedPendingNodes) {
                  const clampedUpdated = this.clampTimestamp(n.updatedAt, nowServer)
                  this.recordRecentPush(n.id, clampedUpdated)
                  const current = await db.canvasNodes.get(n.id)
                  if (current && current.updatedAt === n.updatedAt && current.isDeleted === n.isDeleted) {
                    await db.canvasNodes.update(n.id, { syncStatus: 'synced', updatedAt: clampedUpdated })
                  }
                }
              })
            } else if (nodeError) {
              hasPushErrors = true
              console.warn('Warning syncing canvas nodes:', nodeError.message)
            }
          }
        }

        // ==========================================
        // 4. PUSH: CANVAS EDGES
        // ==========================================
        const pendingEdges = (await db.canvasEdges.where('syncStatus').equals('pending').toArray()).filter(
          (e) => !blockedEdgeIds.has(e.id) && !blockedWorkspaceIds.has(e.workspaceId)
        )
        if (pendingEdges.length > 0) {
          const remoteEdgeVersions = new Map<string, number>()
          for (let i = 0; i < pendingEdges.length; i += 100) {
            const ids = pendingEdges.slice(i, i + 100).map((e) => e.id)
            const { data: remoteRows } = await supabase
              .from('seven_canvas_edges')
              .select('id, updated_at')
              .in('id', ids)
            for (const r of remoteRows || []) remoteEdgeVersions.set(r.id, Number(r.updated_at) || 0)
          }
          const staleEdgeIds: string[] = []
          const allowedPendingEdges = pendingEdges.filter((e) => {
            const remoteUpdated = remoteEdgeVersions.get(e.id)
            if (this.isRemoteStrictlyNewer(remoteUpdated, e.updatedAt, nowServer)) {
              staleEdgeIds.push(e.id)
              return false
            }
            return true
          })
          if (staleEdgeIds.length > 0 && syncGen === this.syncGeneration) {
            await db.canvasEdges.bulkUpdate(
              staleEdgeIds.map((id) => ({ key: id, changes: { syncStatus: 'synced' as const } }))
            )
          }

          if (allowedPendingEdges.length > 0) {
            const payload = allowedPendingEdges.map((e: CanvasEdgeItem) => ({
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
            if (!edgeError && syncGen === this.syncGeneration) {
              this.lastPushCompletedAt = Date.now()
              await db.transaction('rw', db.canvasEdges, async () => {
                for (const e of allowedPendingEdges) {
                  const clampedUpdated = this.clampTimestamp(e.updatedAt, nowServer)
                  this.recordRecentPush(e.id, clampedUpdated)
                  const current = await db.canvasEdges.get(e.id)
                  if (current && current.updatedAt === e.updatedAt && current.isDeleted === e.isDeleted) {
                    await db.canvasEdges.update(e.id, { syncStatus: 'synced', updatedAt: clampedUpdated })
                  }
                }
              })
            } else if (edgeError) {
              hasPushErrors = true
              console.warn('Warning syncing canvas edges:', edgeError.message)
            }
          }
        }

        // ==========================================
        // 5. PUSH: COLLECTIONS
        // ==========================================
        const pendingCollections = (await db.collections.where('syncStatus').equals('pending').toArray()).filter(
          (c) => !blockedCollectionIds.has(c.id) && !blockedSpaceIds.has(c.spaceId)
        )
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
          if (!colError && syncGen === this.syncGeneration) {
            this.lastPushCompletedAt = Date.now()
            await db.transaction('rw', db.collections, async () => {
              for (const c of pendingCollections) {
                const clampedUpdated = this.clampTimestamp(c.updatedAt, nowServer)
                const current = await db.collections.get(c.id)
                if (current && current.updatedAt === c.updatedAt) {
                  await db.collections.update(c.id, { syncStatus: 'synced', updatedAt: clampedUpdated })
                }
              }
            })
          } else if (colError) {
            hasPushErrors = true
            console.warn('Warning syncing collections:', colError.message)
          }
        }

        // ==========================================
        // 6. PUSH: TAGS
        // ==========================================
        const pendingTags = (await db.tags.where('syncStatus').equals('pending').toArray()).filter(
          (t) => !blockedTagIds.has(t.id) && !blockedSpaceIds.has(t.spaceId)
        )
        if (pendingTags.length > 0) {
          const payload = pendingTags.map((t: TagItem) => ({
            id: t.id,
            user_id: authUserId,
            space_id: t.spaceId,
            name: t.name,
            color: t.color,
            created_at: this.clampTimestamp(t.createdAt, nowServer),
            is_deleted: Boolean(t.isDeleted)
          }))
          const { error: tagError } = await supabase.from('seven_tags').upsert(payload, { onConflict: 'id' })
          if (!tagError && syncGen === this.syncGeneration) {
            this.lastPushCompletedAt = Date.now()
            await db.tags.bulkUpdate(
              pendingTags.map((t) => ({ key: t.id, changes: { syncStatus: 'synced' as const } }))
            )
          } else if (tagError) {
            hasPushErrors = true
            console.warn('Warning syncing tags:', tagError.message)
          }
        }

        // ==========================================
        // 6B. PUSH: NOTIFICATIONS (Solo menciones/comentarios/asignaciones dirigidas)
        // ==========================================
        const allPendingNotifs = await db.notifications.where('syncStatus').equals('pending').toArray()
        const nonSyncableNotifs = allPendingNotifs.filter(
          (n) => !isSyncableNotificationType(n.type) || n.dedupeKey?.startsWith('comment-node:')
        )
        if (nonSyncableNotifs.length > 0) {
          await db.notifications.bulkUpdate(
            nonSyncableNotifs.map((n) => ({ key: n.id, changes: { syncStatus: 'synced' as const } }))
          )
        }
        const pendingNotifs = allPendingNotifs.filter(
          (n) => isSyncableNotificationType(n.type) && !n.dedupeKey?.startsWith('comment-node:')
        )
        if (pendingNotifs.length > 0) {
          const payload = pendingNotifs.map((n: NotificationItem) => ({
            id: n.id,
            type: n.type,
            severity: n.severity,
            title: n.title,
            message: n.message,
            workspace_id: n.workspaceId || null,
            space_id: n.spaceId || null,
            node_id: n.nodeId || null,
            actor_id: n.actorId || authUserId || currentMember.id,
            actor_name: n.actorName || currentMember.name,
            recipient_id: n.recipientId || 'all',
            action_label: n.actionLabel || null,
            action_payload: n.actionPayload || null,
            dedupe_key: n.dedupeKey || null,
            is_read: Boolean(n.isRead),
            is_archived: Boolean(n.isArchived),
            snoozed_until: n.snoozedUntil || null,
            created_at: this.clampTimestamp(n.createdAt, nowServer),
            updated_at: this.clampTimestamp(n.updatedAt, nowServer),
            read_at: n.readAt || null
          }))
          const { error: notifError } = await supabase
            .from('seven_notifications')
            .upsert(payload, { onConflict: 'id' })
          if (!notifError) {
            this.lastPushCompletedAt = Date.now()
            await db.notifications.bulkUpdate(
              pendingNotifs.map((n) => ({ key: n.id, changes: { syncStatus: 'synced' as const } }))
            )
          }
        }
      }

      if (syncGen !== this.syncGeneration) {
        return { success: false, message: 'Sincronización cancelada' }
      }

      // ==========================================
      // 7. PULL REMOTE CHANGES (Delta sync o pull completo si dispositivo nuevo)
      // ==========================================
      const [localWsCount, localSpacesCount] = await Promise.all([
        db.workspaces.count(),
        db.spaces.count()
      ])

      // Si la base local no tiene notas o espacios reales (o solo una página inicial), forzamos un pull completo (lastSync = 0)
      // para asegurar que dispositivos móviles o navegadores nuevos obtengan todo el contenido.
      const isInitialDevicePull = localWsCount <= 1 || localSpacesCount <= 1
      // Ventana de seguridad de 2 minutos para evitar pérdida de cambios por desfase de reloj entre dispositivos
      // y limitar cualquier lastSyncTime previo que hubiera quedado en el futuro.
      const effectiveLastSyncTime = Math.min(this.lastSyncTime || 0, nowServer)
      const lastSync = isInitialDevicePull ? 0 : Math.max(0, effectiveLastSyncTime - 120_000)

      let hasPullErrors = false
      const restrictedAdminSpaceIds = new Set<string>()
      const deletedRemoteSpaceIds = new Set<string>()
      const isCurrentAdmin = isUserAdmin(currentMember)

      // Pull Spaces: siempre traemos todos los espacios visibles paginados
      const { data: remoteSpaces, error: spPullErr } = await this.fetchAllRows((from, to) =>
        supabase.from('seven_spaces').select('*').order('id', { ascending: true }).range(from, to)
      )

      if (syncGen !== this.syncGeneration) {
        return { success: false, message: 'Sincronización cancelada' }
      }

      if (spPullErr) {
        console.warn('Error pulling spaces:', spPullErr.message)
        hasPullErrors = true
      } else {
        if (remoteSpaces.length > 0) {
          markAccountSeeded()
        }

        for (const rs of remoteSpaces) {
          if (blockedSpaceIds.has(rs.id)) continue

          // Si el espacio remoto es privado y NO pertenece al miembro actual, NO lo guardamos localmente
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
            const existingLocal = await db.spaces.get(rs.id)
            if (existingLocal && existingLocal.syncStatus === 'synced') {
              await db.spaces.delete(rs.id).catch(() => {})
            }
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
          const remoteSpaceUpdated = this.clampTimestamp(Number(rs.updated_at) || 0, nowServer)
          let rawFolderOrder: unknown = rs.folder_order
          if (typeof rawFolderOrder === 'string') {
            try {
              rawFolderOrder = JSON.parse(rawFolderOrder)
            } catch {
              rawFolderOrder = undefined
            }
          }
          const normalizedFolderOrder = Array.isArray(rawFolderOrder)
            ? (rawFolderOrder as string[]).map((f) => normalizeFolderPath(f)).filter(Boolean) as string[]
            : undefined
          const normalizedFolderColors = normalizeFolderColorsMap(rs.folder_colors)
          const missingLocalFolderOrder =
            Boolean(local && local.syncStatus === 'synced') &&
            (!Array.isArray(local?.folderOrder) || local.folderOrder.length === 0) &&
            Array.isArray(normalizedFolderOrder) &&
            normalizedFolderOrder.length > 0
          const missingLocalFolderColors =
            Boolean(local && local.syncStatus === 'synced') &&
            (!local?.folderColors || Object.keys(local.folderColors).length === 0) &&
            Boolean(normalizedFolderColors && Object.keys(normalizedFolderColors).length > 0)

          const shouldApply = this.shouldApplyRemote(local, remoteSpaceUpdated, nowServer)
          if (shouldApply || missingLocalFolderOrder || missingLocalFolderColors) {
            await db.spaces.put({
              id: rs.id,
              name: rs.name,
              icon: rs.icon,
              color: rs.color,
              createdAt: this.clampTimestamp(rs.created_at, nowServer),
              updatedAt: shouldApply ? remoteSpaceUpdated : Math.max(remoteSpaceUpdated, local?.updatedAt || 0),
              isDeleted: Boolean(rs.is_deleted),
              isPrivate: Boolean(rs.is_private),
              adminOnly: Boolean(rs.admin_only),
              sortOrder: typeof rs.sort_order === 'number' ? rs.sort_order : rs.created_at,
              folderOrder: normalizedFolderOrder,
              folderColors: normalizedFolderColors,
              ownerMember: rs.owner_member,
              userId: rs.user_id,
              viewedBy: local?.viewedBy,
              syncStatus: 'synced'
            })
          }
        }

        // Eliminar espacios locales ya sincronizados que fueron borrados definitivamente en Supabase
        // Solo cuando la cuenta activa esté verificada y la respuesta remota contenga datos válidos (evita vaciados por RLS/token expirado)
        if (isActiveAccountVerified && remoteSpaces.length > 0) {
          const remoteSpaceIds = new Set(remoteSpaces.map((rs: any) => rs.id))
          const allLocalSpaces = await db.spaces.toArray()
          for (const ls of allLocalSpaces) {
            if (ls.syncStatus === 'synced' && !remoteSpaceIds.has(ls.id)) {
              deletedRemoteSpaceIds.add(ls.id)
              await db.spaces.delete(ls.id).catch(() => {})
              try {
                localStorage.removeItem(`seven_note_folder_order_${ls.id}`)
                localStorage.removeItem(`seven_note_folder_colors_${ls.id}`)
              } catch {}
            }
          }
        }
      }

      // Pull Workspaces (paginado)
      const { data: remoteWorkspacesData, error: wsPullErr } = await this.fetchAllRows((from, to) =>
        supabase
          .from('seven_workspaces')
          .select('*')
          .gt('updated_at', lastSync)
          .order('id', { ascending: true })
          .range(from, to)
      )

      if (syncGen !== this.syncGeneration) {
        return { success: false, message: 'Sincronización cancelada' }
      }

      if (wsPullErr) {
        console.warn('Error pulling workspaces:', wsPullErr.message)
        hasPullErrors = true
      } else {
        const allLocalWs = await db.workspaces.toArray()
        const localWsMap = new Map(allLocalWs.map((w) => [w.id, w]))
        const remoteWorkspaces: any[] = [...remoteWorkspacesData]
        const fetchedWsIds = new Set(remoteWorkspaces.map((rw: any) => rw.id))
        let allRemoteWsIds: Set<string> | null =
          lastSync === 0 ? new Set(remoteWorkspaces.map((rw: any) => rw.id)) : null

        const isWorkspaceAccessible = (rw: any): boolean => {
          if (rw.space_id && deletedRemoteSpaceIds.has(rw.space_id)) {
            return false
          }
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

        let wsIndexFailed = false
        if (lastSync > 0) {
          const { data: remoteWsIndex, error: wsIndexErr } = await this.fetchAllRows((from, to) =>
            supabase
              .from('seven_workspaces')
              .select('id, updated_at, is_deleted, is_private, owner_member, user_id, space_id')
              .order('id', { ascending: true })
              .range(from, to)
          )

          if (wsIndexErr) {
            wsIndexFailed = true
            hasPullErrors = true
          } else if (remoteWsIndex) {
            allRemoteWsIds = new Set(remoteWsIndex.map((r: any) => r.id))
            const missingOrNewerIds: string[] = []

            for (const r of remoteWsIndex) {
              if (blockedWorkspaceIds.has(r.id) || fetchedWsIds.has(r.id) || !isWorkspaceAccessible(r)) continue
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
              if (missingErr) {
                hasPullErrors = true
              } else if (missingRows) {
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

        if (remoteWorkspaces.length > 0) {
          markAccountSeeded()
        }

        const wsToPut: WorkspaceItem[] = []
        const inaccessibleLocalWsIds: string[] = []

        for (const rw of remoteWorkspaces) {
          if (blockedWorkspaceIds.has(rw.id)) continue
          if (rw.space_id && blockedSpaceIds.has(rw.space_id)) continue

          const local = localWsMap.get(rw.id)

          if (!isWorkspaceAccessible(rw)) {
            if (local && local.syncStatus === 'synced') {
              inaccessibleLocalWsIds.push(rw.id)
            }
            continue
          }

          const remoteUpdated = this.clampTimestamp(Number(rw.updated_at) || 0, nowServer)

          if (this.shouldApplyRemote(local, remoteUpdated, nowServer)) {
            const meta = rw.metadata || {}
            const mergedViewed = Array.from(
              new Set([
                ...(Array.isArray(local?.viewedBy) ? local!.viewedBy : []),
                ...(Array.isArray(meta.viewedBy) ? meta.viewedBy : [])
              ])
            )
            wsToPut.push({
              id: rw.id,
              parentId: rw.parent_id,
              spaceId: rw.space_id && rw.space_id !== 'default-space' ? rw.space_id : 'default-workspace',
              folder: normalizeFolderPath(rw.folder),
              title: rw.title,
              icon: rw.icon,
              color: rw.color,
              viewMode: rw.view_mode,
              docContent: rw.doc_content,
              createdAt: this.clampTimestamp(rw.created_at, nowServer),
              updatedAt: remoteUpdated,
              isFavorite: rw.is_favorite,
              isDeleted: Boolean(rw.is_deleted),
              syncStatus: 'synced',
              isPrivate: Boolean(rw.is_private),
              ownerMember: rw.owner_member || 'kevin',
              ownerName: meta.ownerName,
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
              lastBotEditedBy: meta.lastBotEditedBy,
              lastBotEditedAt: meta.lastBotEditedAt,
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
              viewedBy: mergedViewed.length > 0 ? mergedViewed : undefined,
              isNewItem: meta.isNewItem,
              hasCover: meta.hasCover,
              coverType: meta.coverType,
              coverUrl: meta.coverUrl,
              coverColor: meta.coverColor,
              coverBannerTitle: meta.coverBannerTitle,
              coverBannerSubtitle: meta.coverBannerSubtitle,
              coverBannerStyle: meta.coverBannerStyle,
              coverPosition: meta.coverPosition,
              trashedWithSpaceId: meta.trashedWithSpaceId,
              trashedFolder: meta.trashedFolder
            })
          }
        }

        if (syncGen !== this.syncGeneration) {
          return { success: false, message: 'Sincronización cancelada' }
        }

        if (inaccessibleLocalWsIds.length > 0) {
          await db.workspaces.bulkDelete(inaccessibleLocalWsIds).catch(() => {})
        }

        if (wsToPut.length > 0) {
          await db.workspaces.bulkPut(wsToPut)

          // Emit collaborative notifications only on incremental syncs for brand-new shared notes from other members
          if (lastSync > 0) {
            const maxRecentAgeMs = 7 * 24 * 60 * 60 * 1000
            const newSharedWorkspaces = wsToPut.filter((ws) => {
              const prev = localWsMap.get(ws.id)
              if (prev || ws.isDeleted || ws.isPrivate) return false
              if (isWorkspaceOwner(ws, currentMember, authUserId)) return false
              if (nowServer - ws.createdAt > maxRecentAgeMs) return false
              return true
            })

            if (newSharedWorkspaces.length > 0) {
              const allSpaces = await db.spaces.toArray()
              const spacesMap = new Map(allSpaces.map((s) => [s.id, s]))
              const isBurst = newSharedWorkspaces.length > 2

              for (const ws of newSharedWorkspaces) {
                const actor = resolveActorProfile(ws.ownerMember || ws.userId, ws.ownerName || ws.createdBy)
                const spaceName = ws.spaceId ? spacesMap.get(ws.spaceId)?.name : undefined
                void notificationService.notify({
                  type: 'workspace_update',
                  severity: 'info',
                  title: ws.title || 'Nota sin título',
                  message: spaceName ? `En ${spaceName}` : 'Nota compartida',
                  workspaceId: ws.id,
                  spaceId: ws.spaceId,
                  actorId: ws.ownerMember || ws.userId,
                  actorName: actor.name,
                  actionLabel: 'Abrir nota',
                  actionPayload: { type: 'open_workspace', workspaceId: ws.id, spaceId: ws.spaceId },
                  dedupeKey: `new-ws:${ws.id}`,
                  dedupeWindowMs: 24 * 60 * 60 * 1000,
                  localOnly: true,
                  silent: isBurst
                })
              }

              if (isBurst) {
                const firstTitle = newSharedWorkspaces[0].title || 'Nota sin título'
                notificationService.dispatchBatchSummaryToast(
                  newSharedWorkspaces.length,
                  `Incluye "${firstTitle}" y ${newSharedWorkspaces.length - 1} más`
                )
              }
            }
          }
        }

        // Eliminar notas locales ya sincronizadas que fueron borradas definitivamente en Supabase
        // Solo si la sesión/perfil está verificado, no hubo errores, y el índice remoto no vino vacío por expiración de JWT
        if (allRemoteWsIds && allRemoteWsIds.size > 0 && isActiveAccountVerified && !wsIndexFailed && !spPullErr) {
          const wsToDelete = allLocalWs
            .filter(
              (lw) =>
                lw.syncStatus === 'synced' &&
                (!allRemoteWsIds!.has(lw.id) || deletedRemoteSpaceIds.has(lw.spaceId || ''))
            )
            .map((lw) => lw.id)
          if (wsToDelete.length > 0) {
            await db.workspaces.bulkDelete(wsToDelete).catch(() => {})
            await Promise.all(
              wsToDelete.map((id) =>
                Promise.all([
                  db.canvasNodes.where('workspaceId').equals(id).delete().catch(() => {}),
                  db.canvasEdges.where('workspaceId').equals(id).delete().catch(() => {})
                ])
              )
            )
          }
        }
      }

      // Pull Canvas Nodes (paginado + índice incremental para eliminaciones/reloj)
      const { data: remoteNodesData, error: nodesPullErr } = await this.fetchAllRows((from, to) =>
        supabase
          .from('seven_canvas_nodes')
          .select('*')
          .gt('updated_at', lastSync)
          .order('id', { ascending: true })
          .range(from, to)
      )

      if (nodesPullErr) {
        console.warn('Error pulling canvas nodes:', nodesPullErr.message)
        hasPullErrors = true
      } else {
        const remoteNodes: any[] = [...remoteNodesData]
        const fetchedNodeIds = new Set(remoteNodes.map((rn: any) => rn.id))
        let allRemoteNodeIds: Set<string> | null =
          lastSync === 0 ? new Set(remoteNodes.map((rn: any) => rn.id)) : null
        let nodesIndexFailed = false

        const allLocalNodes = await db.canvasNodes.toArray()
        const localNodeMap = new Map(allLocalNodes.map((n) => [n.id, n]))

        if (lastSync > 0) {
          const { data: remoteNodeIndex, error: nodeIdxErr } = await this.fetchAllRows((from, to) =>
            supabase
              .from('seven_canvas_nodes')
              .select('id, updated_at, is_deleted')
              .order('id', { ascending: true })
              .range(from, to)
          )
          if (nodeIdxErr) {
            nodesIndexFailed = true
            hasPullErrors = true
          } else if (remoteNodeIndex) {
            allRemoteNodeIds = new Set(remoteNodeIndex.map((r: any) => r.id))
            const missingNodeIds: string[] = []
            for (const r of remoteNodeIndex) {
              if (blockedNodeIds.has(r.id) || fetchedNodeIds.has(r.id)) continue
              const local = localNodeMap.get(r.id)
              if (!local) {
                if (!r.is_deleted) missingNodeIds.push(r.id)
                continue
              }
              if (local.syncStatus !== 'pending') {
                const remoteUpdated = this.clampTimestamp(Number(r.updated_at) || 0, nowServer)
                if (remoteUpdated > (local.updatedAt || 0) || Boolean(r.is_deleted) !== Boolean(local.isDeleted)) {
                  missingNodeIds.push(r.id)
                }
              }
            }
            for (let i = 0; i < missingNodeIds.length; i += 100) {
              const batch = missingNodeIds.slice(i, i + 100)
              const { data: missingRows, error: missingErr } = await supabase
                .from('seven_canvas_nodes')
                .select('*')
                .in('id', batch)
              if (!missingErr && missingRows) {
                for (const mr of missingRows) {
                  if (!fetchedNodeIds.has(mr.id)) {
                    fetchedNodeIds.add(mr.id)
                    remoteNodes.push(mr)
                  }
                }
              }
            }
          }
        }

        const nodesToDelete: string[] = []
        const nodesToPut: CanvasNodeItem[] = []

        for (const rn of remoteNodes) {
          if (blockedNodeIds.has(rn.id) || blockedWorkspaceIds.has(rn.workspace_id)) continue
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

        if (allRemoteNodeIds && isActiveAccountVerified && !nodesIndexFailed) {
          for (const ln of allLocalNodes) {
            if (ln.syncStatus === 'synced' && !allRemoteNodeIds.has(ln.id)) {
              nodesToDelete.push(ln.id)
            }
          }
        }

        if (syncGen !== this.syncGeneration) {
          return { success: false, message: 'Sincronización cancelada' }
        }

        if (nodesToDelete.length > 0) {
          await db.canvasNodes.bulkDelete(Array.from(new Set(nodesToDelete))).catch(() => {})
        }
        if (nodesToPut.length > 0) {
          await db.canvasNodes.bulkPut(nodesToPut)

          if (lastSync > 0) {
            const selfIds = getMemberIdentifiers(currentMember, authUserId)
            for (const node of nodesToPut) {
              if (node.type === 'comment' && !localNodeMap.has(node.id) && !node.isDeleted) {
                const rawAuthor = String(node.data?.commentAuthor || '').trim()
                const isSelf = rawAuthor ? selfIds.has(rawAuthor.toLowerCase()) : false
                if (!isSelf) {
                  const actor = resolveActorProfile(undefined, rawAuthor)
                  void notificationService.notify({
                    type: 'comment',
                    severity: 'info',
                    title: `Nuevo comentario de ${actor.name}`,
                    message: String(node.data?.commentText || 'Comentó en un tablero').slice(0, 120),
                    workspaceId: node.workspaceId,
                    nodeId: node.id,
                    actorName: actor.name,
                    actionLabel: 'Ver tablero',
                    actionPayload: { type: 'open_workspace', workspaceId: node.workspaceId, nodeId: node.id },
                    dedupeKey: `comment-node:${node.id}`,
                    dedupeWindowMs: 24 * 60 * 60 * 1000,
                    localOnly: true
                  })
                }
              }
            }
          }
        }
      }

      // Pull Canvas Edges (paginado + índice incremental)
      const { data: remoteEdgesData, error: edgesPullErr } = await this.fetchAllRows((from, to) =>
        supabase
          .from('seven_canvas_edges')
          .select('*')
          .gt('updated_at', lastSync)
          .order('id', { ascending: true })
          .range(from, to)
      )

      if (edgesPullErr) {
        console.warn('Error pulling canvas edges:', edgesPullErr.message)
        hasPullErrors = true
      } else {
        const remoteEdges: any[] = [...remoteEdgesData]
        const fetchedEdgeIds = new Set(remoteEdges.map((re: any) => re.id))
        let allRemoteEdgeIds: Set<string> | null =
          lastSync === 0 ? new Set(remoteEdges.map((re: any) => re.id)) : null
        let edgesIndexFailed = false

        const allLocalEdges = await db.canvasEdges.toArray()
        const localEdgeMap = new Map(allLocalEdges.map((e) => [e.id, e]))

        if (lastSync > 0) {
          const { data: remoteEdgeIndex, error: edgeIdxErr } = await this.fetchAllRows((from, to) =>
            supabase
              .from('seven_canvas_edges')
              .select('id, updated_at, is_deleted')
              .order('id', { ascending: true })
              .range(from, to)
          )
          if (edgeIdxErr) {
            edgesIndexFailed = true
            hasPullErrors = true
          } else if (remoteEdgeIndex) {
            allRemoteEdgeIds = new Set(remoteEdgeIndex.map((r: any) => r.id))
            const missingEdgeIds: string[] = []
            for (const r of remoteEdgeIndex) {
              if (blockedEdgeIds.has(r.id) || fetchedEdgeIds.has(r.id)) continue
              const local = localEdgeMap.get(r.id)
              if (!local) {
                if (!r.is_deleted) missingEdgeIds.push(r.id)
                continue
              }
              if (local.syncStatus !== 'pending') {
                const remoteUpdated = this.clampTimestamp(Number(r.updated_at) || 0, nowServer)
                if (remoteUpdated > (local.updatedAt || 0) || Boolean(r.is_deleted) !== Boolean(local.isDeleted)) {
                  missingEdgeIds.push(r.id)
                }
              }
            }
            for (let i = 0; i < missingEdgeIds.length; i += 100) {
              const batch = missingEdgeIds.slice(i, i + 100)
              const { data: missingRows, error: missingErr } = await supabase
                .from('seven_canvas_edges')
                .select('*')
                .in('id', batch)
              if (!missingErr && missingRows) {
                for (const mr of missingRows) {
                  if (!fetchedEdgeIds.has(mr.id)) {
                    fetchedEdgeIds.add(mr.id)
                    remoteEdges.push(mr)
                  }
                }
              }
            }
          }
        }

        const edgesToDelete: string[] = []
        const edgesToPut: CanvasEdgeItem[] = []

        for (const re of remoteEdges) {
          if (blockedEdgeIds.has(re.id) || blockedWorkspaceIds.has(re.workspace_id)) continue
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

        if (allRemoteEdgeIds && isActiveAccountVerified && !edgesIndexFailed) {
          for (const le of allLocalEdges) {
            if (le.syncStatus === 'synced' && !allRemoteEdgeIds.has(le.id)) {
              edgesToDelete.push(le.id)
            }
          }
        }

        if (syncGen !== this.syncGeneration) {
          return { success: false, message: 'Sincronización cancelada' }
        }

        if (edgesToDelete.length > 0) {
          await db.canvasEdges.bulkDelete(Array.from(new Set(edgesToDelete))).catch(() => {})
        }
        if (edgesToPut.length > 0) {
          await db.canvasEdges.bulkPut(edgesToPut)
        }
      }

      // Pull Collections
      const { data: remoteCollections, error: colPullErr } = await this.fetchAllRows((from, to) =>
        supabase.from('seven_collections').select('*').order('id', { ascending: true }).range(from, to)
      )

      if (colPullErr) {
        console.warn('Error pulling collections:', colPullErr.message)
        hasPullErrors = true
      } else {
        const allLocalCols = await db.collections.toArray()
        const localColMap = new Map(allLocalCols.map((c) => [c.id, c]))
        const colsToDelete: string[] = []
        const colsToPut: CollectionItem[] = []
        const remoteColIds = new Set(remoteCollections.map((rc: any) => rc.id))

        for (const rc of remoteCollections) {
          if (blockedCollectionIds.has(rc.id) || blockedSpaceIds.has(rc.space_id)) continue
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

        if (isActiveAccountVerified) {
          for (const lc of allLocalCols) {
            if (lc.syncStatus === 'synced' && !remoteColIds.has(lc.id)) {
              colsToDelete.push(lc.id)
            }
          }
        }

        if (colsToDelete.length > 0) {
          await db.collections.bulkDelete(Array.from(new Set(colsToDelete))).catch(() => {})
        }
        if (colsToPut.length > 0) {
          await db.collections.bulkPut(colsToPut)
        }
      }

      // Pull Tags (incluyendo actualizaciones y eliminaciones)
      const { data: remoteTags, error: tagPullErr } = await this.fetchAllRows((from, to) =>
        supabase.from('seven_tags').select('*').order('id', { ascending: true }).range(from, to)
      )

      if (tagPullErr) {
        console.warn('Error pulling tags:', tagPullErr.message)
        hasPullErrors = true
      } else {
        const allLocalTags = await db.tags.toArray()
        const localTagMap = new Map(allLocalTags.map((t) => [t.id, t]))
        const tagsToPut: TagItem[] = []
        const tagsToDelete: string[] = []
        const remoteTagIds = new Set(remoteTags.map((rt: any) => rt.id))

        for (const rt of remoteTags) {
          if (blockedTagIds.has(rt.id) || blockedSpaceIds.has(rt.space_id)) continue
          const local = localTagMap.get(rt.id)
          if (rt.is_deleted) {
            if (local) tagsToDelete.push(rt.id)
            continue
          }
          if (!local || local.syncStatus !== 'pending') {
            tagsToPut.push({
              id: rt.id,
              spaceId: rt.space_id,
              name: rt.name,
              color: rt.color,
              createdAt: rt.created_at,
              isDeleted: false,
              syncStatus: 'synced'
            })
          }
        }

        if (isActiveAccountVerified) {
          for (const lt of allLocalTags) {
            if (lt.syncStatus === 'synced' && !remoteTagIds.has(lt.id)) {
              tagsToDelete.push(lt.id)
            }
          }
        }

        if (tagsToDelete.length > 0) {
          await db.tags.bulkDelete(Array.from(new Set(tagsToDelete))).catch(() => {})
        }
        if (tagsToPut.length > 0) {
          await db.tags.bulkPut(tagsToPut)
        }
      }

      // Pull Notifications (Solo tipos colaborativos sincronizables)
      try {
        const { data: remoteNotifs, error: notifPullErr } = await supabase
          .from('seven_notifications')
          .select('*')
          .gt('updated_at', lastSync)

        if (!notifPullErr && remoteNotifs && remoteNotifs.length > 0) {
          const syncableRemote = remoteNotifs.filter((rn: any) => isSyncableNotificationType(rn.type))
          if (syncableRemote.length > 0) {
            const localNotifRows = await db.notifications.bulkGet(syncableRemote.map((rn: any) => rn.id))
            const localNotifMap = new Map(
              localNotifRows.filter((n): n is NotificationItem => Boolean(n)).map((n) => [n.id, n])
            )
            const notifsToPut: NotificationItem[] = []
            const newlyPulledAlerts: NotificationItem[] = []

            for (const rn of syncableRemote) {
              const local = localNotifMap.get(rn.id)
              const remoteUpdated = this.clampTimestamp(Number(rn.updated_at) || 0, nowServer)
              if (this.shouldApplyRemote(local, remoteUpdated, nowServer)) {
                const recipientId = rn.recipient_id || 'all'
                const isSharedBroadcastUpdate = Boolean(local && recipientId === 'all')
                const item: NotificationItem = {
                  id: rn.id,
                  type: rn.type,
                  severity: rn.severity,
                  title: rn.title,
                  message: rn.message,
                  workspaceId: rn.workspace_id || undefined,
                  spaceId: rn.space_id || undefined,
                  nodeId: rn.node_id || undefined,
                  actorId: rn.actor_id || undefined,
                  actorName: rn.actor_name || undefined,
                  recipientId,
                  actionLabel: rn.action_label || undefined,
                  actionPayload: rn.action_payload || undefined,
                  dedupeKey: rn.dedupe_key || undefined,
                  isRead: isSharedBroadcastUpdate ? local!.isRead : Boolean(rn.is_read),
                  isArchived: isSharedBroadcastUpdate ? local!.isArchived : Boolean(rn.is_archived),
                  snoozedUntil: isSharedBroadcastUpdate
                    ? local!.snoozedUntil
                    : rn.snoozed_until
                    ? Number(rn.snoozed_until)
                    : undefined,
                  createdAt: this.clampTimestamp(Number(rn.created_at) || Date.now(), nowServer),
                  updatedAt: remoteUpdated,
                  readAt: isSharedBroadcastUpdate
                    ? local!.readAt
                    : rn.read_at
                    ? Number(rn.read_at)
                    : undefined,
                  syncStatus: 'synced'
                }
                notifsToPut.push(item)

                if (
                  !local &&
                  !item.isRead &&
                  !item.isArchived &&
                  nowServer - item.createdAt < 15 * 60_000 &&
                  isNotificationForMember(item, currentMember, authUserId)
                ) {
                  newlyPulledAlerts.push(item)
                }
              }
            }

            if (notifsToPut.length > 0) {
              await db.notifications.bulkPut(notifsToPut)
              window.dispatchEvent(new CustomEvent('seven_note_notification_changed'))
              for (const alert of newlyPulledAlerts) {
                notificationService.deliverPulledNotification(alert)
              }
            }
          }
        }
      } catch {
        // Ignorar silenciosamente si seven_notifications aún no está creada en Supabase
      }

      // Actualizar timestamp de última sincronización solo si no hubo errores de red/descarga
      if (!hasPullErrors) {
        this.initialPullCompleted = true
        this.lastSyncTime = this.getServerNow()
        localStorage.setItem(LAST_SYNC_KEY, this.lastSyncTime.toString())
        this.state = hasPushErrors ? 'error' : 'synced'
        if (hasPushErrors) {
          this.errorMessage = 'Algunos cambios locales no pudieron subirse a la nube'
        }
        // Si la cuenta en la nube estaba completamente vacía (0 espacios y 0 notas), inicializar espacio de bienvenida una sola vez
        await seedInitialData({ allowWhenSupabaseConfigured: true })
      } else {
        this.state = 'error'
        this.errorMessage = 'Sincronización completada con advertencias en la descarga remota'
      }
      await this.updatePendingCount()

      return {
        success: !hasPullErrors && !hasPushErrors,
        message: hasPullErrors || hasPushErrors ? this.errorMessage! : 'Sincronización completada'
      }
    } catch (err: any) {
      console.error('Sync failed:', err)
      this.state = 'error'
      this.errorMessage = err?.message || 'Error desconocido al sincronizar'
      this.notify()
      void notificationService.notify({
        type: 'sync',
        severity: 'error',
        title: 'Error de sincronización',
        message: this.errorMessage || 'No se pudo sincronizar con Supabase',
        actionLabel: 'Reintentar',
        actionPayload: { type: 'retry_sync' },
        dedupeKey: 'sync-error',
        dedupeWindowMs: 10 * 60 * 1000,
        localOnly: true
      })
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
