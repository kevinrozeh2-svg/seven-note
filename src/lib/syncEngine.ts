import { db, type WorkspaceItem, type CanvasNodeItem, type CanvasEdgeItem } from '../db'
import { getSupabaseClient, getStoredSupabaseConfig } from './supabase'

export type NetworkStatus = 'online' | 'offline'
export type SyncEngineState = 'idle' | 'syncing' | 'synced' | 'error' | 'offline' | 'unconfigured'

export interface SyncEngineStatus {
  state: SyncEngineState
  pendingCount: number
  lastSyncTime: number | null
  errorMessage: string | null
  isOnline: boolean
}

type StatusListener = (status: SyncEngineStatus) => void

class SyncEngine {
  private listeners: Set<StatusListener> = new Set()
  private state: SyncEngineState = 'idle'
  private pendingCount = 0
  private lastSyncTime: number | null = null
  private errorMessage: string | null = null
  private isOnline: boolean = typeof navigator !== 'undefined' ? navigator.onLine : true
  private syncTimeout: any = null

  constructor() {
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
    }
    this.updatePendingCount()
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
      isOnline: this.isOnline
    }
  }

  private notify() {
    const status = this.getStatus()
    this.listeners.forEach((fn) => fn(status))
  }

  public async updatePendingCount() {
    try {
      const pendingWorkspaces = await db.workspaces.where('syncStatus').equals('pending').count()
      const pendingNodes = await db.canvasNodes.where('syncStatus').equals('pending').count()
      const pendingEdges = await db.canvasEdges.where('syncStatus').equals('pending').count()
      this.pendingCount = pendingWorkspaces + pendingNodes + pendingEdges
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

    this.state = 'syncing'
    this.errorMessage = null
    this.notify()

    try {
      // 1. PUSH PENDING WORKSPACES
      const pendingWorkspaces = await db.workspaces.where('syncStatus').equals('pending').toArray()
      if (pendingWorkspaces.length > 0) {
        const payload = pendingWorkspaces.map((w: WorkspaceItem) => ({
          id: w.id,
          parent_id: w.parentId,
          title: w.title,
          icon: w.icon,
          color: w.color,
          view_mode: w.viewMode,
          doc_content: w.docContent,
          created_at: w.createdAt,
          updated_at: w.updatedAt,
          is_favorite: w.isFavorite,
          is_deleted: w.isDeleted
        }))

        const { error: wsError } = await supabase.from('workspaces').upsert(payload, { onConflict: 'id' })
        if (wsError) throw wsError

        // Mark local as synced
        await db.workspaces.bulkUpdate(
          pendingWorkspaces.map((w) => ({ key: w.id, changes: { syncStatus: 'synced' as const } }))
        )
      }

      // 2. PUSH PENDING CANVAS NODES
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

        const { error: nodeError } = await supabase.from('canvas_nodes').upsert(payload, { onConflict: 'id' })
        if (nodeError) throw nodeError

        await db.canvasNodes.bulkUpdate(
          pendingNodes.map((n) => ({ key: n.id, changes: { syncStatus: 'synced' as const } }))
        )
      }

      // 3. PUSH PENDING CANVAS EDGES
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
          created_at: e.createdAt,
          updated_at: e.updatedAt,
          is_deleted: e.isDeleted
        }))

        const { error: edgeError } = await supabase.from('canvas_edges').upsert(payload, { onConflict: 'id' })
        if (edgeError) throw edgeError

        await db.canvasEdges.bulkUpdate(
          pendingEdges.map((e) => ({ key: e.id, changes: { syncStatus: 'synced' as const } }))
        )
      }

      // 4. PULL REMOTE WORKSPACES (Updated since last sync)
      const lastSync = this.lastSyncTime || 0
      const { data: remoteWorkspaces, error: pullWsError } = await supabase
        .from('workspaces')
        .select('*')
        .gt('updated_at', lastSync)

      if (pullWsError) throw pullWsError

      if (remoteWorkspaces && remoteWorkspaces.length > 0) {
        for (const rw of remoteWorkspaces) {
          const local = await db.workspaces.get(rw.id)
          if (!local || rw.updated_at > local.updatedAt) {
            await db.workspaces.put({
              id: rw.id,
              parentId: rw.parent_id,
              title: rw.title,
              icon: rw.icon,
              color: rw.color,
              viewMode: rw.view_mode,
              docContent: rw.doc_content,
              createdAt: rw.created_at,
              updatedAt: rw.updated_at,
              isFavorite: rw.is_favorite,
              isDeleted: rw.is_deleted,
              syncStatus: 'synced'
            })
          }
        }
      }

      // 5. PULL REMOTE NODES
      const { data: remoteNodes, error: pullNodeError } = await supabase
        .from('canvas_nodes')
        .select('*')
        .gt('updated_at', lastSync)

      if (pullNodeError) throw pullNodeError

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

      // 6. PULL REMOTE EDGES
      const { data: remoteEdges, error: pullEdgeError } = await supabase
        .from('canvas_edges')
        .select('*')
        .gt('updated_at', lastSync)

      if (pullEdgeError) throw pullEdgeError

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
              createdAt: re.created_at,
              updatedAt: re.updated_at,
              isDeleted: re.is_deleted,
              syncStatus: 'synced'
            })
          }
        }
      }

      this.lastSyncTime = Date.now()
      this.state = 'synced'
      await this.updatePendingCount()

      // Log success
      await db.syncLogs.add({
        id: crypto.randomUUID(),
        timestamp: Date.now(),
        action: 'Sincronización completa',
        status: 'success',
        message: 'Cambios locales y remotos sincronizados correctamente'
      })

      return { success: true, message: 'Sincronización completada' }
    } catch (err: any) {
      console.error('Sync failed:', err)
      this.state = 'error'
      this.errorMessage = err?.message || 'Error desconocido al sincronizar'
      this.notify()

      await db.syncLogs.add({
        id: crypto.randomUUID(),
        timestamp: Date.now(),
        action: 'Fallo de sincronización',
        status: 'error',
        message: this.errorMessage || 'Error en la sincronización'
      })

      return { success: false, message: this.errorMessage || 'Error' }
    }
  }
}

export const syncEngine = new SyncEngine()
