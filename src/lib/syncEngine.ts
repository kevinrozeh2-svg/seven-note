import {
  db,
  type WorkspaceItem,
  type CanvasNodeItem,
  type CanvasEdgeItem,
  type SpaceItem,
  type CollectionItem,
  type TagItem
} from '../db'
import { getSupabaseClient, getStoredSupabaseConfig } from './supabase'

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
      return { success: true, message: 'Sincronización ya en curso' }
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
      // ==========================================
      // 1. PUSH & PULL: SPACES
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
          is_deleted: Boolean(s.isDeleted)
        }))
        const { error: spError } = await supabase.from('seven_spaces').upsert(payload, { onConflict: 'id' })
        if (spError) throw spError
        await db.spaces.bulkUpdate(
          pendingSpaces.map((s) => ({ key: s.id, changes: { syncStatus: 'synced' as const } }))
        )
      }

      // ==========================================
      // 2. PUSH & PULL: WORKSPACES (PAGES / DOCS)
      // ==========================================
      const pendingWorkspaces = await db.workspaces.where('syncStatus').equals('pending').toArray()
      if (pendingWorkspaces.length > 0) {
        const payload = pendingWorkspaces.map((w: WorkspaceItem) => ({
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
            customProperties: w.customProperties
          }
        }))

        const { error: wsError } = await supabase.from('seven_workspaces').upsert(payload, { onConflict: 'id' })
        if (wsError) throw wsError

        await db.workspaces.bulkUpdate(
          pendingWorkspaces.map((w) => ({ key: w.id, changes: { syncStatus: 'synced' as const } }))
        )
      }

      // ==========================================
      // 3. PUSH: CANVAS NODES
      // ==========================================
      const pendingNodes = await db.canvasNodes.where('syncStatus').equals('pending').toArray()
      if (pendingNodes.length > 0) {
        const payload = pendingNodes.map((n: CanvasNodeItem) => ({
          id: n.id,
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
        if (nodeError) throw nodeError

        await db.canvasNodes.bulkUpdate(
          pendingNodes.map((n) => ({ key: n.id, changes: { syncStatus: 'synced' as const } }))
        )
      }

      // ==========================================
      // 4. PUSH: CANVAS EDGES
      // ==========================================
      const pendingEdges = await db.canvasEdges.where('syncStatus').equals('pending').toArray()
      if (pendingEdges.length > 0) {
        const payload = pendingEdges.map((e: CanvasEdgeItem) => ({
          id: e.id,
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
        if (edgeError) throw edgeError

        await db.canvasEdges.bulkUpdate(
          pendingEdges.map((e) => ({ key: e.id, changes: { syncStatus: 'synced' as const } }))
        )
      }

      // ==========================================
      // 5. PUSH: COLLECTIONS
      // ==========================================
      const pendingCollections = await db.collections.where('syncStatus').equals('pending').toArray()
      if (pendingCollections.length > 0) {
        const payload = pendingCollections.map((c: CollectionItem) => ({
          id: c.id,
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
        if (colError) throw colError
        await db.collections.bulkUpdate(
          pendingCollections.map((c) => ({ key: c.id, changes: { syncStatus: 'synced' as const } }))
        )
      }

      // ==========================================
      // 6. PUSH: TAGS
      // ==========================================
      const pendingTags = await db.tags.where('syncStatus').equals('pending').toArray()
      if (pendingTags.length > 0) {
        const payload = pendingTags.map((t: TagItem) => ({
          id: t.id,
          space_id: t.spaceId,
          name: t.name,
          color: t.color,
          created_at: t.createdAt,
          is_deleted: Boolean(t.isDeleted)
        }))
        const { error: tagError } = await supabase.from('seven_tags').upsert(payload, { onConflict: 'id' })
        if (tagError) throw tagError
        await db.tags.bulkUpdate(
          pendingTags.map((t) => ({ key: t.id, changes: { syncStatus: 'synced' as const } }))
        )
      }

      // ==========================================
      // 7. PULL REMOTE CHANGES (Delta sync por timestamp)
      // ==========================================
      const lastSync = this.lastSyncTime || 0

      // Pull Spaces
      const { data: remoteSpaces } = await supabase
        .from('seven_spaces')
        .select('*')
        .gt('updated_at', lastSync)

      if (remoteSpaces && remoteSpaces.length > 0) {
        for (const rs of remoteSpaces) {
          const local = await db.spaces.get(rs.id)
          if (!local || rs.updated_at > local.updatedAt) {
            await db.spaces.put({
              id: rs.id,
              name: rs.name,
              icon: rs.icon,
              color: rs.color,
              createdAt: rs.created_at,
              updatedAt: rs.updated_at,
              isDeleted: rs.is_deleted,
              syncStatus: 'synced'
            })
          }
        }
      }

      // Pull Workspaces
      const { data: remoteWorkspaces } = await supabase
        .from('seven_workspaces')
        .select('*')
        .gt('updated_at', lastSync)

      if (remoteWorkspaces && remoteWorkspaces.length > 0) {
        for (const rw of remoteWorkspaces) {
          const local = await db.workspaces.get(rw.id)
          if (!local || rw.updated_at > local.updatedAt) {
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
              updatedAt: rw.updated_at,
              isFavorite: rw.is_favorite,
              isDeleted: rw.is_deleted,
              syncStatus: 'synced',
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
              customProperties: meta.customProperties
            })
          }
        }
      }

      // Pull Canvas Nodes
      const { data: remoteNodes } = await supabase
        .from('seven_canvas_nodes')
        .select('*')
        .gt('updated_at', lastSync)

      if (remoteNodes && remoteNodes.length > 0) {
        for (const rn of remoteNodes) {
          const local = await db.canvasNodes.get(rn.id)
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
      const { data: remoteEdges } = await supabase
        .from('seven_canvas_edges')
        .select('*')
        .gt('updated_at', lastSync)

      if (remoteEdges && remoteEdges.length > 0) {
        for (const re of remoteEdges) {
          const local = await db.canvasEdges.get(re.id)
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
      const { data: remoteCollections } = await supabase
        .from('seven_collections')
        .select('*')
        .gt('updated_at', lastSync)

      if (remoteCollections && remoteCollections.length > 0) {
        for (const rc of remoteCollections) {
          const local = await db.collections.get(rc.id)
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

      // Pull Tags
      const { data: remoteTags } = await supabase
        .from('seven_tags')
        .select('*')
        .gt('created_at', lastSync)

      if (remoteTags && remoteTags.length > 0) {
        for (const rt of remoteTags) {
          const local = await db.tags.get(rt.id)
          if (!local) {
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

      // Actualizar timestamp de última sincronización
      this.lastSyncTime = Date.now()
      localStorage.setItem(LAST_SYNC_KEY, this.lastSyncTime.toString())
      this.state = 'synced'
      await this.updatePendingCount()

      return { success: true, message: 'Sincronización completada' }
    } catch (err: any) {
      console.error('Sync failed:', err)
      this.state = 'error'
      this.errorMessage = err?.message || 'Error desconocido al sincronizar'
      this.notify()
      return { success: false, message: this.errorMessage || 'Error' }
    } finally {
      this.isSyncing = false
    }
  }
}

export const syncEngine = new SyncEngine()
