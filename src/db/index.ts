import Dexie, { type Table } from 'dexie'
import { getSupabaseClient, isSupabaseConfigured } from '../lib/supabase'

export type ViewMode = 'doc' | 'canvas' | 'split'
export type SyncStatus = 'synced' | 'pending' | 'failed'

export const DEFAULT_SPACE_ID = 'default-workspace'

export type PendingHardDeleteTable =
  | 'spaces'
  | 'workspaces'
  | 'canvasNodes'
  | 'canvasEdges'
  | 'collections'
  | 'tags'

const PENDING_HARD_DELETES_KEY = 'seven_note_pending_hard_deletes_v1'

type PendingHardDeletesMap = Record<PendingHardDeleteTable, string[]>

function readPendingHardDeletesMap(): PendingHardDeletesMap {
  const empty: PendingHardDeletesMap = {
    spaces: [],
    workspaces: [],
    canvasNodes: [],
    canvasEdges: [],
    collections: [],
    tags: []
  }
  if (typeof localStorage === 'undefined') return empty
  try {
    const raw = localStorage.getItem(PENDING_HARD_DELETES_KEY)
    if (!raw) return empty
    const parsed = JSON.parse(raw)
    return {
      spaces: Array.isArray(parsed?.spaces) ? parsed.spaces : [],
      workspaces: Array.isArray(parsed?.workspaces) ? parsed.workspaces : [],
      canvasNodes: Array.isArray(parsed?.canvasNodes) ? parsed.canvasNodes : [],
      canvasEdges: Array.isArray(parsed?.canvasEdges) ? parsed.canvasEdges : [],
      collections: Array.isArray(parsed?.collections) ? parsed.collections : [],
      tags: Array.isArray(parsed?.tags) ? parsed.tags : []
    }
  } catch {
    return empty
  }
}

function writePendingHardDeletesMap(map: PendingHardDeletesMap): void {
  if (typeof localStorage === 'undefined') return
  try {
    localStorage.setItem(PENDING_HARD_DELETES_KEY, JSON.stringify(map))
  } catch {
    // ignore quota errors
  }
}

export function getPendingHardDeletes(table: PendingHardDeleteTable): string[] {
  return readPendingHardDeletesMap()[table]
}

export function recordPendingHardDeletes(table: PendingHardDeleteTable, ids: string[]): void {
  const clean = ids.filter(Boolean)
  if (clean.length === 0) return
  const map = readPendingHardDeletesMap()
  map[table] = Array.from(new Set([...map[table], ...clean]))
  writePendingHardDeletesMap(map)
}

export function clearPendingHardDeletes(table: PendingHardDeleteTable, ids: string[]): void {
  const toRemove = new Set(ids.filter(Boolean))
  if (toRemove.size === 0) return
  const map = readPendingHardDeletesMap()
  map[table] = map[table].filter((id) => !toRemove.has(id))
  writePendingHardDeletesMap(map)
}

export function clearAllPendingHardDeletes(): void {
  if (typeof localStorage === 'undefined') return
  try {
    localStorage.removeItem(PENDING_HARD_DELETES_KEY)
  } catch {
    // ignore
  }
}

let serverClockOffsetMs = 0

export function setServerClockOffset(offsetMs: number): void {
  if (Number.isFinite(offsetMs)) {
    serverClockOffsetMs = offsetMs
  }
}

export function getSafeTimestamp(prevUpdatedAt?: number | null): number {
  const localNow = Date.now()
  const serverNow = localNow + serverClockOffsetMs
  return Math.max(localNow, serverNow, (prevUpdatedAt || 0) + 1)
}

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function isValidUuid(val?: string | null): val is string {
  return typeof val === 'string' && UUID_REGEX.test(val.trim())
}

export function normalizeFolderPath(path?: string | null): string | null {
  if (!path) return null
  const segments = path
    .split('/')
    .map((s) => s.trim())
    .filter(Boolean)
  return segments.length > 0 ? segments.join('/') : null
}

export interface SpaceItem {
  id: string
  name: string
  icon?: string
  color?: string
  createdAt: number
  updatedAt: number
  isDeleted?: boolean
  syncStatus?: SyncStatus
  isPrivate?: boolean
  adminOnly?: boolean
  sortOrder?: number
  folderOrder?: string[]
  ownerMember?: string
  ownerName?: string
  userId?: string
  createdBy?: string
  viewedBy?: string[]
  isNewItem?: boolean
}

export interface CustomPropertyItem {
  id: string
  name: string
  type: 'text' | 'number' | 'checkbox' | 'date' | 'select' | 'unknown'
  value: any
  visibility: 'always_show' | 'always_hide' | 'hide_empty'
}

export type NotionDatabaseViewType = 'table' | 'board' | 'list' | 'timeline' | 'calendar' | 'gallery'

export interface NotionDatabaseItem {
  id: string
  title: string
  status: 'Sin empezar' | 'En progreso' | 'En revisión' | 'Completado' | string
  priority?: 'Baja' | 'Media' | 'Alta' | 'Urgente'
  date?: string // YYYY-MM-DD
  endDate?: string // YYYY-MM-DD for timeline
  tags?: string[]
  assignee?: string
  coverColor?: string
  description?: string
  completed?: boolean
}

export interface NotionDatabaseView {
  id: string
  name: string
  type: NotionDatabaseViewType
}

export interface NotionDatabaseData {
  enabled: boolean
  activeView: NotionDatabaseViewType
  views: NotionDatabaseView[]
  items: NotionDatabaseItem[]
}

export interface WorkspaceItem {
  id: string
  parentId: string | null
  spaceId?: string // Workspace environment / tenant ID (defaults to DEFAULT_SPACE_ID)
  folder?: string | null
  title: string
  icon: string
  color?: string
  viewMode: ViewMode
  docContent: string // HTML or JSON string
  createdAt: number
  updatedAt: number
  isFavorite: boolean
  isDeleted: boolean
  syncStatus: SyncStatus
  sortOrder?: number

  // Extended properties matching AppFlowy / AFFiNE
  tags?: string[]
  documentMode?: string // 'Estándar' | 'Sin bordes' | 'Dividido'
  isJournal?: boolean
  journalDate?: string
  templateName?: string
  createdBy?: string
  lastEditedBy?: string
  borderlessTheme?: boolean
  pageWidth?: 'standard' | 'wide' | 'full'
  isInformationOpen?: boolean
  informationContent?: string
  biDirectionalLinksVisible?: boolean
  propertyVisibility?: Record<string, 'always_show' | 'always_hide' | 'hide_empty'>
  activeProperties?: string[]
  customProperties?: CustomPropertyItem[]

  // Modo Privado / Miembros del Equipo
  isPrivate?: boolean
  ownerMember?: string // 'kevin' | 'maikol' | 'marcos'
  ownerName?: string

  // Compartir mediante Enlace Externo
  isPublicShared?: boolean
  shareToken?: string
  sharePermission?: 'view' | 'edit'

  // Notion Database Views (Table, Board, List, Timeline, Calendar, Gallery)
  databaseData?: NotionDatabaseData

  // Canvas visual configuration
  canvasGridVariant?: 'dots' | 'lines' | 'none'

  // New item notification / unread tracker
  viewedBy?: string[]
  isNewItem?: boolean
  userId?: string

  // Trash grouping metadata (space/folder soft delete & restore)
  trashedWithSpaceId?: string
  trashedFolder?: string

  // Cover / Header Banner (Notion Style)
  hasCover?: boolean
  coverType?: 'bannerText' | 'color' | 'gradient' | 'image'
  coverUrl?: string
  coverColor?: string
  coverBannerTitle?: string // e.g. "PROJECTS &"
  coverBannerSubtitle?: string // e.g. "SUB-PROJECTS"
  coverBannerStyle?: 'minimal-light' | 'minimal-dark' | 'cream' | 'serif'
  coverPosition?: number
}

export type CanvasNodeType =
  | 'note'
  | 'todo'
  | 'image'
  | 'link'
  | 'column'
  | 'subboard'
  | 'docframe'
  | 'shape'
  | 'text'
  | 'frame'
  | 'mindmap'
  | 'colorPalette'
  | 'table'
  | 'comment'

export interface CanvasTodoItem {
  id: string
  text: string
  completed: boolean
}

export type ShapeKind = 'rect' | 'roundedRect' | 'ellipse' | 'diamond' | 'triangle' | 'star' | 'cylinder'

export interface CanvasNodeData {
  [key: string]: any
  title?: string
  content?: string
  color?: string
  todos?: CanvasTodoItem[]
  imageUrl?: string
  assetId?: string
  url?: string
  description?: string
  subboardId?: string
  subboardTitle?: string
  workspaceId?: string
  width?: number
  height?: number
  collapsed?: boolean

  // Shape specific properties
  shapeType?: ShapeKind
  fillColor?: string
  strokeColor?: string
  strokeWidth?: number
  strokeStyle?: 'solid' | 'dashed'
  textColor?: string
  fontSize?: number | 'sm' | 'base' | 'lg' | 'xl'

  // Frame specific properties
  frameIndex?: number
  frameTitle?: string
  frameAspectRatio?: 'free' | '16:9' | '4:3' | '1:1'
  frameBgStyle?: 'default' | 'dark' | 'gradient' | 'dots' | 'glass'
  speakerNotes?: string
  hideHeaderInPresentation?: boolean

  // Text specific properties
  textAlign?: 'left' | 'center' | 'right'
  isLocked?: boolean

  // Milanote Color Palette specific
  paletteColors?: string[]
  swatches?: any[]
}

export interface CanvasNodeItem {
  id: string
  workspaceId: string
  type: CanvasNodeType
  positionX: number
  positionY: number
  width?: number
  height?: number
  data: CanvasNodeData
  createdAt: number
  updatedAt: number
  isDeleted: boolean
  syncStatus: SyncStatus
}

export interface CanvasEdgeItem {
  id: string
  workspaceId: string
  source: string
  target: string
  sourceHandle?: string | null
  targetHandle?: string | null
  label?: string
  animated?: boolean
  color?: string
  edgeType?: 'default' | 'bezier' | 'smoothstep' | 'straight'
  markerEndType?: 'arrow' | 'none'
  createdAt: number
  updatedAt: number
  isDeleted: boolean
  syncStatus: SyncStatus
}

export interface OfflineAsset {
  id: string
  workspaceId: string
  name: string
  mimeType: string
  size: number
  dataBlob: Blob
  remoteUrl?: string
  createdAt: number
  syncStatus: SyncStatus
}

export interface SyncLogItem {
  id: string
  timestamp: number
  action: string
  status: 'success' | 'warning' | 'error' | 'info'
  message: string
}

export interface CollectionItem {
  id: string
  spaceId: string
  name: string
  icon?: string
  color?: string
  docIds: string[]
  createdAt: number
  updatedAt: number
  isDeleted?: boolean
  syncStatus?: SyncStatus
}

export interface TagItem {
  id: string
  spaceId: string
  name: string
  color: string
  createdAt: number
  isDeleted?: boolean
  syncStatus?: SyncStatus
}

export type NotificationType =
  | 'mention'
  | 'comment'
  | 'assignment'
  | 'reminder'
  | 'workspace_update'
  | 'sync'
  | 'system'

export type NotificationSeverity = 'info' | 'success' | 'warning' | 'error'

export interface NotificationActionPayload {
  type: 'open_workspace' | 'open_settings' | 'open_notifications' | 'retry_sync' | 'apply_update' | 'custom'
  workspaceId?: string
  spaceId?: string
  nodeId?: string
}

export interface NotificationItem {
  id: string
  type: NotificationType
  severity: NotificationSeverity
  title: string
  message: string
  workspaceId?: string
  spaceId?: string
  nodeId?: string
  actorId?: string
  actorName?: string
  recipientId?: string // 'all' or specific member/user id
  actionLabel?: string
  actionPayload?: NotificationActionPayload
  dedupeKey?: string
  isRead: boolean
  isArchived: boolean
  snoozedUntil?: number
  createdAt: number
  updatedAt: number
  readAt?: number
  syncStatus?: SyncStatus
}

export class SevenNoteDatabase extends Dexie {
  workspaces!: Table<WorkspaceItem, string>
  canvasNodes!: Table<CanvasNodeItem, string>
  canvasEdges!: Table<CanvasEdgeItem, string>
  offlineAssets!: Table<OfflineAsset, string>
  syncLogs!: Table<SyncLogItem, string>
  spaces!: Table<SpaceItem, string>
  collections!: Table<CollectionItem, string>
  tags!: Table<TagItem, string>
  notifications!: Table<NotificationItem, string>

  constructor() {
    super('SevenNoteDB')
    this.version(1).stores({
      workspaces: 'id, parentId, updatedAt, isDeleted, isFavorite, syncStatus',
      canvasNodes: 'id, workspaceId, type, updatedAt, isDeleted, syncStatus',
      canvasEdges: 'id, workspaceId, source, target, updatedAt, isDeleted, syncStatus',
      offlineAssets: 'id, workspaceId, createdAt, syncStatus',
      syncLogs: 'id, timestamp, status'
    })
    this.version(2).stores({
      workspaces: 'id, parentId, spaceId, updatedAt, isDeleted, isFavorite, syncStatus',
      canvasNodes: 'id, workspaceId, type, updatedAt, isDeleted, syncStatus',
      canvasEdges: 'id, workspaceId, source, target, updatedAt, isDeleted, syncStatus',
      offlineAssets: 'id, workspaceId, createdAt, syncStatus',
      syncLogs: 'id, timestamp, status',
      spaces: 'id, name, createdAt, updatedAt'
    })
    this.version(3).stores({
      workspaces: 'id, parentId, spaceId, updatedAt, isDeleted, isFavorite, syncStatus',
      canvasNodes: 'id, workspaceId, type, updatedAt, isDeleted, syncStatus',
      canvasEdges: 'id, workspaceId, source, target, updatedAt, isDeleted, syncStatus',
      offlineAssets: 'id, workspaceId, createdAt, syncStatus',
      syncLogs: 'id, timestamp, status',
      spaces: 'id, name, createdAt, updatedAt',
      collections: 'id, spaceId, name, createdAt, updatedAt',
      tags: 'id, spaceId, name, color, createdAt'
    })
    this.version(4).stores({
      workspaces: 'id, parentId, spaceId, updatedAt, isDeleted, isFavorite, syncStatus',
      canvasNodes: 'id, workspaceId, type, updatedAt, isDeleted, syncStatus',
      canvasEdges: 'id, workspaceId, source, target, updatedAt, isDeleted, syncStatus',
      offlineAssets: 'id, workspaceId, createdAt, syncStatus',
      syncLogs: 'id, timestamp, status',
      spaces: 'id, name, createdAt, updatedAt, syncStatus',
      collections: 'id, spaceId, name, createdAt, updatedAt, syncStatus',
      tags: 'id, spaceId, name, color, createdAt, syncStatus'
    })
    this.version(5).stores({
      workspaces: 'id, parentId, spaceId, updatedAt, isDeleted, isFavorite, syncStatus, isPrivate, ownerMember, isPublicShared, shareToken',
      canvasNodes: 'id, workspaceId, type, updatedAt, isDeleted, syncStatus',
      canvasEdges: 'id, workspaceId, source, target, updatedAt, isDeleted, syncStatus',
      offlineAssets: 'id, workspaceId, createdAt, syncStatus',
      syncLogs: 'id, timestamp, status',
      spaces: 'id, name, createdAt, updatedAt, syncStatus',
      collections: 'id, spaceId, name, createdAt, updatedAt, syncStatus',
      tags: 'id, spaceId, name, color, createdAt, syncStatus'
    })
    this.version(6).stores({
      spaces: 'id, name, createdAt, updatedAt, syncStatus, isPrivate, ownerMember, userId'
    })
    this.version(7).stores({
      notifications: 'id, type, severity, recipientId, workspaceId, dedupeKey, isRead, isArchived, snoozedUntil, createdAt, updatedAt, syncStatus'
    })

    // Auto-hook: Mark any newly created or modified items as 'pending'
    const setupAutoSyncHooks = (table: Table<any, string>) => {
      table.hook('creating', (_primKey, obj) => {
        if (!obj.syncStatus) {
          obj.syncStatus = 'pending'
        }
      })
      table.hook('updating', (modifications: Record<string, any>, _primKey, _obj) => {
        // If not explicitly setting to synced, mark as pending
        if ((modifications as any)?.syncStatus !== 'synced') {
          return { ...modifications, syncStatus: 'pending' }
        }
        return undefined
      })
    }

    setupAutoSyncHooks(this.workspaces)
    setupAutoSyncHooks(this.canvasNodes)
    setupAutoSyncHooks(this.canvasEdges)
    setupAutoSyncHooks(this.spaces)
    setupAutoSyncHooks(this.collections)
    setupAutoSyncHooks(this.tags)
    setupAutoSyncHooks(this.notifications)
  }
}

export const db = new SevenNoteDatabase()

// Purge legacy template presets that were accidentally created as real workspaces
export async function cleanupLegacyTemplatePresets() {
  const legacyTitles = [
    'Tablero de inspiración',
    'Investigación',
    'Plano del proyecto',
    'Tablero de inspiración (Milanote)',
    'Investigación (Milanote)',
    'Plano del proyecto (Milanote Dark)'
  ]

  const presetWorkspaces = await db.workspaces
    .filter((w) => legacyTitles.includes(w.title))
    .toArray()

  if (presetWorkspaces.length > 0) {
    for (const ws of presetWorkspaces) {
      await db.canvasNodes.where('workspaceId').equals(ws.id).delete().catch(() => {})
      await db.canvasEdges.where('workspaceId').equals(ws.id).delete().catch(() => {})
      await db.workspaces.delete(ws.id).catch(() => {})
    }
  }
}

// Key to track whether initial demo data was seeded once, preventing resurrecting deleted spaces
export const DEMO_SEEDED_KEY = 'seven_note_demo_seeded_v1'

export const WELCOME_GUIDE_KEY = 'seven_note_welcome_guide_v1'

export function markAccountSeeded(): void {
  if (typeof localStorage === 'undefined') return
  try {
    localStorage.setItem(DEMO_SEEDED_KEY, 'true')
    localStorage.setItem(WELCOME_GUIDE_KEY, 'true')
  } catch {
    // ignore
  }
}

// Renames "Demo Workspace" to "Bienvenido" (only if still named "Demo Workspace") and adds a how-to note + board (once on fresh account)
async function ensureWelcomeGuide(allowCreateDocs: boolean) {
  if (typeof localStorage !== 'undefined' && localStorage.getItem(WELCOME_GUIDE_KEY)) return
  const demoSpace = await db.spaces.filter((s) => s.name === 'Demo Workspace').first()
  if (demoSpace) {
    await db.spaces.update(demoSpace.id, { name: 'Bienvenido', updatedAt: Date.now(), syncStatus: 'pending' } as never)
  }

  const space =
    demoSpace ||
    (await db.spaces.get(DEFAULT_SPACE_ID))
  if (!space) return

  if (!allowCreateDocs) {
    if (typeof localStorage !== 'undefined') localStorage.setItem(WELCOME_GUIDE_KEY, 'true')
    return
  }

  const now = Date.now()
  const guideDocId = 'guide-como-usar'
  const guideBoardId = 'guide-tablero'
  const html = `
    <h1>🚀 Cómo usar Seven Note</h1>
    <p>Seven Note es una app de <strong>notas y tableros visuales</strong>: combina documentos por bloques (estilo Notion) con lienzos infinitos (estilo Milanote). Funciona <strong>sin conexión</strong> y puede sincronizarse con Supabase.</p>
    <h2>🗂️ Organización</h2>
    <ul>
      <li><strong>Espacios:</strong> grupos de trabajo (como este, «Bienvenido»). Cambia o gestiona espacios desde la barra lateral.</li>
      <li><strong>Páginas:</strong> cada página puede ser Documento, Tablero o Vista dividida. Puedes anidar páginas y sub-tableros.</li>
      <li><strong>Favoritos, plantillas y papelera</strong> disponibles en la barra lateral.</li>
    </ul>
    <h2>📝 Notas (documentos)</h2>
    <ul>
      <li>Escribe con formato: títulos, listas, tareas, citas y más.</li>
      <li>Empieza desde una plantilla o importa contenido existente.</li>
    </ul>
    <h2>🎨 Tableros</h2>
    <ul>
      <li>Añade notas, listas de tareas, enlaces, imágenes y sub-tableros.</li>
      <li>Arrastra, redimensiona y conecta tarjetas con flechas.</li>
    </ul>
    <h2>☁️ Datos y sincronización</h2>
    <ul>
      <li>Todo se guarda localmente en tu dispositivo.</li>
      <li>Opcional: configura Supabase en Ajustes para respaldar en la nube.</li>
      <li>Instálala como app (PWA o escritorio) y úsala donde quieras.</li>
    </ul>
    <p>Mira el tablero <em>«Guía visual»</em> de este espacio para un resumen rápido.</p>
  `

  const exists = await db.workspaces.get(guideDocId)
  if (!exists) {
    await db.workspaces.bulkPut([
      {
        id: guideDocId, parentId: null, spaceId: space.id, title: 'Cómo usar Seven Note', icon: '📖',
        color: '#6366f1', viewMode: 'doc', docContent: html, createdAt: now, updatedAt: now,
        isFavorite: true, isDeleted: false, syncStatus: 'pending'
      },
      {
        id: guideBoardId, parentId: null, spaceId: space.id, title: 'Guía visual', icon: '🧭',
        color: '#ec4899', viewMode: 'canvas', docContent: '<p></p>', createdAt: now, updatedAt: now,
        isFavorite: false, isDeleted: false, syncStatus: 'pending'
      }
    ] as never)
    const mk = (id: string, type: string, x: number, y: number, h: number, data: Record<string, unknown>) => ({
      id, workspaceId: guideBoardId, type, positionX: x, positionY: y, width: 320, height: h, data,
      createdAt: now, updatedAt: now, isDeleted: false, syncStatus: 'pending'
    })
    await db.canvasNodes.bulkPut([
      mk('g-what', 'note', 80, 80, 200, { title: '👋 ¿De qué va?', content: 'Seven Note reúne notas y tableros visuales en un solo lugar, offline y con sincronización opcional.', color: 'yellow' }),
      mk('g-notes', 'note', 450, 80, 200, { title: '📝 Notas', content: 'Crea páginas en modo Documento con formato, tareas y plantillas. Organízalas en espacios y sub-páginas.', color: 'blue' }),
      mk('g-boards', 'note', 80, 330, 200, { title: '🎨 Tableros', content: 'Lienzo infinito: añade notas, enlaces e imágenes, arrástralas y conéctalas con flechas.', color: 'purple' }),
      mk('g-steps', 'todo', 450, 330, 240, {
        title: '✅ Primeros pasos',
        todos: [
          { id: '1', text: 'Crear tu propio espacio', completed: false },
          { id: '2', text: 'Crear una página nueva', completed: false },
          { id: '3', text: 'Añadir tarjetas y conectarlas', completed: false },
          { id: '4', text: 'Configurar Supabase (opcional)', completed: false }
        ],
        color: 'emerald'
      })
    ] as never)
    await db.canvasEdges.bulkPut([
      { id: 'g-e1', workspaceId: guideBoardId, source: 'g-what', target: 'g-notes', label: 'Documentos', animated: true, color: '#6366f1', createdAt: now, updatedAt: now, isDeleted: false, syncStatus: 'pending' },
      { id: 'g-e2', workspaceId: guideBoardId, source: 'g-what', target: 'g-boards', label: 'Visual', animated: false, color: '#ec4899', createdAt: now, updatedAt: now, isDeleted: false, syncStatus: 'pending' },
      { id: 'g-e3', workspaceId: guideBoardId, source: 'g-boards', target: 'g-steps', label: 'Empieza', animated: false, color: '#10b981', createdAt: now, updatedAt: now, isDeleted: false, syncStatus: 'pending' }
    ] as never)
  }
  if (typeof localStorage !== 'undefined') localStorage.setItem(WELCOME_GUIDE_KEY, 'true')
}

// Seed default initial data if database is empty
let isSeeding = false

export async function seedInitialData(options?: { allowWhenSupabaseConfigured?: boolean }) {
  if (isSeeding) return
  isSeeding = true
  try {
    await cleanupLegacyTemplatePresets()

    const supabaseConfigured = isSupabaseConfigured()
    // When Supabase is configured, do not seed demo spaces/notes before initial remote sync completes;
    // otherwise a new browser/device would re-create and push deleted demo spaces, folders, and notes.
    if (supabaseConfigured && !options?.allowWhenSupabaseConfigured) {
      return
    }

    // If already seeded previously, do not recreate deleted demo spaces/notes
    const alreadySeeded = typeof localStorage !== 'undefined' ? Boolean(localStorage.getItem(DEMO_SEEDED_KEY)) : false
    const [spaceCount, wsCount] = await Promise.all([db.spaces.count(), db.workspaces.count()])

    if (spaceCount > 0 || wsCount > 0) {
      markAccountSeeded()
    }

    // Ensure any existing workspaces without spaceId are attributed to an existing space (prefer DEFAULT_SPACE_ID)
    if (spaceCount > 0) {
      const firstSpace = (await db.spaces.get(DEFAULT_SPACE_ID)) || (await db.spaces.toCollection().first())
      const fallbackSpaceId = firstSpace?.id || DEFAULT_SPACE_ID
      const withoutSpace = await db.workspaces.filter((w) => !w.spaceId || w.spaceId === 'default-space').toArray()
      if (withoutSpace.length > 0) {
        await db.workspaces.bulkUpdate(
          withoutSpace.map((w) => ({
            key: w.id,
            changes: { spaceId: fallbackSpaceId }
          }))
        )
      }
    }

    if (alreadySeeded || spaceCount > 0 || wsCount > 0) {
      await ensureWelcomeGuide(false)
      return
    }

    const now = Date.now()
    await db.spaces.put({
      id: DEFAULT_SPACE_ID,
      name: 'Bienvenido',
      icon: '⚡',
      color: '#1e96eb',
      createdAt: now,
      updatedAt: now,
      syncStatus: supabaseConfigured ? 'pending' : 'synced'
    }).catch(() => {})

    await ensureWelcomeGuide(true)
    markAccountSeeded()

    const rootWorkspaceId = 'welcome-workspace'
    const subboard1Id = 'subboard-design'

  const defaultDocHtml = `
    <h1>⚡ Bienvenido a Seven Note</h1>
    <p>Una alternativa ligera a <strong>AFFiNE</strong>, combinando la flexibilidad de bloques de <strong>Notion</strong> con los tableros visuales infinitos de <strong>Milanote</strong>, optimizada para trabajar <strong>100% offline</strong> y sincronizarse con <strong>Supabase</strong>.</p>
    
    <h3>💡 Características clave:</h3>
    <ul data-type="taskList">
      <li data-checked="true"><label><input type="checkbox" checked="checked"><span></span></label><div><strong>100% Offline-First:</strong> Todo se almacena localmente en IndexedDB. Latencia cero sin conexión.</div></li>
      <li data-checked="true"><label><input type="checkbox" checked="checked"><span></span></label><div><strong>Modo Híbrido:</strong> Cambia en la cabecera entre <em>Documento</em>, <em>Tablero</em> o <em>Vista Dividida</em>.</div></li>
      <li data-checked="false"><label><input type="checkbox"><span></span></label><div><strong>Tableros Estilo Milanote:</strong> Nodos de notas adhesivas, listas checklist, enlaces, imágenes y sub-tableros conectados con flechas.</div></li>
      <li data-checked="false"><label><input type="checkbox"><span></span></label><div><strong>Sincronización con Supabase:</strong> Conecta tus credenciales en Configuración para respaldar tu información en la nube.</div></li>
      <li data-checked="false"><label><input type="checkbox"><span></span></label><div><strong>Despliegue Vercel + PWA:</strong> Instálala como aplicación de escritorio o móvil y úsala en cualquier lugar.</div></li>
    </ul>

    <blockquote>
      <em>"La simplicidad es la máxima sofisticación. Sin CRDTs pesados ni websockets bloqueantes: solo tú, tus ideas y tu flujo creativo."</em>
    </blockquote>
  `

  const untitledId = 'untitled-workspace'

  await db.workspaces.bulkPut([
    {
      id: untitledId,
      parentId: null,
      spaceId: DEFAULT_SPACE_ID,
      folder: 'First Folder',
      title: 'Untitled',
      icon: '',
      color: '#3b82f6',
      viewMode: 'doc',
      docContent: '<p></p>',
      createdAt: now,
      updatedAt: now,
      isFavorite: false,
      isDeleted: false,
      syncStatus: supabaseConfigured ? 'pending' : 'synced',
      activeProperties: [
        'tags',
        'documentMode',
        'isJournal',
        'templateName',
        'createdAt',
        'updatedAt',
        'createdBy',
        'borderlessTheme',
        'pageWidth'
      ],
      propertyVisibility: {
        tags: 'always_show',
        documentMode: 'always_hide',
        isJournal: 'always_hide',
        templateName: 'always_hide',
        createdAt: 'always_show',
        updatedAt: 'always_show',
        createdBy: 'always_hide',
        borderlessTheme: 'always_hide',
        pageWidth: 'always_show'
      }
    },
    {
      id: rootWorkspaceId,
      parentId: null,
      spaceId: DEFAULT_SPACE_ID,
      title: 'Bienvenido a Seven Note',
      icon: '🚀',
      color: '#6366f1',
      viewMode: 'split',
      docContent: defaultDocHtml,
      createdAt: now - 3600000,
      updatedAt: now - 1800000,
      isFavorite: false,
      isDeleted: false,
      syncStatus: 'pending'
    },
    {
      id: subboard1Id,
      parentId: rootWorkspaceId,
      spaceId: DEFAULT_SPACE_ID,
      title: 'Inspiración & Moodboard',
      icon: '🎨',
      color: '#ec4899',
      viewMode: 'canvas',
      docContent: '<h1>🎨 Inspiración y Paleta Visual</h1><p>Tablero visual para recopilar referencias y notas de diseño.</p>',
      createdAt: now + 1,
      updatedAt: now + 1,
      isFavorite: false,
      isDeleted: false,
      syncStatus: 'pending'
    },
    {
      id: 'ws-feature-priorities',
      parentId: null,
      spaceId: DEFAULT_SPACE_ID,
      folder: 'First Folder',
      title: 'Feature Priorities',
      icon: '⚡',
      color: '#3b82f6',
      viewMode: 'canvas',
      docContent: '<h2>⚡ Feature Priorities</h2><p>Prioridades de producto para la próxima versión de Seven Note.</p>',
      createdAt: now - 120000,
      updatedAt: now - 120000,
      isFavorite: true,
      isDeleted: false,
      syncStatus: 'pending'
    },
    {
      id: 'ws-sync-draft',
      parentId: null,
      spaceId: DEFAULT_SPACE_ID,
      folder: 'Spring - Habit Tracker',
      title: 'Sync Draft',
      icon: '🔄',
      color: '#10b981',
      viewMode: 'doc',
      docContent: '<h2>🔄 Sync Draft</h2><p>Mapeo de sincronización y resolución de conflictos.</p>',
      createdAt: now - 12 * 3600 * 1000,
      updatedAt: now - 12 * 3600 * 1000,
      isFavorite: false,
      isDeleted: false,
      syncStatus: 'pending'
    },
    {
      id: 'ws-spring-prd',
      parentId: null,
      spaceId: DEFAULT_SPACE_ID,
      folder: 'Spring - Habit Tracker',
      title: 'Spring - PRD',
      icon: '🌱',
      color: '#8b5cf6',
      viewMode: 'doc',
      docContent: '<h2>🌱 Spring - PRD</h2><p>Documento de requerimientos para el seguimiento de hábitos.</p>',
      createdAt: now - 2 * 86400 * 1000,
      updatedAt: now - 2 * 86400 * 1000,
      isFavorite: false,
      isDeleted: false,
      syncStatus: 'pending'
    },
    {
      id: 'ws-2026-strategy',
      parentId: null,
      spaceId: DEFAULT_SPACE_ID,
      folder: 'First Folder',
      title: '2026 Strategy',
      icon: '🎯',
      color: '#f59e0b',
      viewMode: 'doc',
      docContent: '<h2>🎯 2026 Strategy</h2><p>Estrategia de diseño, producto e identidad para el 2026.</p>',
      createdAt: now - 4 * 86400 * 1000,
      updatedAt: now - 4 * 86400 * 1000,
      isFavorite: true,
      isDeleted: false,
      syncStatus: 'pending'
    },
    {
      id: 'ws-off-menu-thoughts',
      parentId: null,
      spaceId: DEFAULT_SPACE_ID,
      folder: 'Off Menu',
      title: 'Off Menu Thoughts',
      icon: '💭',
      color: '#ec4899',
      viewMode: 'doc',
      docContent: '<h2>💭 Off Menu Thoughts</h2><p>Ideas y notas para exploraciones experimentales fuera de menú.</p>',
      createdAt: now - 7 * 86400 * 1000,
      updatedAt: now - 7 * 86400 * 1000,
      isFavorite: false,
      isDeleted: false,
      syncStatus: 'pending'
    }
  ])

  // Canvas nodes for the welcome workspace
  await db.canvasNodes.bulkPut([
    {
      id: 'node-intro',
      workspaceId: rootWorkspaceId,
      type: 'note',
      positionX: 80,
      positionY: 80,
      width: 320,
      height: 200,
      data: {
        title: '📌 Tablero Visual (Milanote)',
        content: '¡Puedes arrastrar, cambiar colores, redimensionar y conectar tarjetas! Usa la barra flotante inferior para añadir más notas, tareas e imágenes.',
        color: 'yellow'
      },
      createdAt: now,
      updatedAt: now,
      isDeleted: false,
      syncStatus: 'pending'
    },
    {
      id: 'node-todos',
      workspaceId: rootWorkspaceId,
      type: 'todo',
      positionX: 450,
      positionY: 80,
      width: 320,
      height: 240,
      data: {
        title: '✅ Pasos para empezar',
        todos: [
          { id: '1', text: 'Probar alternar a vista de Documento', completed: true },
          { id: '2', text: 'Arrastrar una flecha conectora entre notas', completed: true },
          { id: '3', text: 'Crear una nueva página desde la barra lateral', completed: false },
          { id: '4', text: 'Configurar Supabase en Ajustes (Opcional)', completed: false }
        ],
        color: 'blue'
      },
      createdAt: now,
      updatedAt: now,
      isDeleted: false,
      syncStatus: 'pending'
    },
    {
      id: 'node-link',
      workspaceId: rootWorkspaceId,
      type: 'link',
      positionX: 80,
      positionY: 320,
      width: 320,
      height: 140,
      data: {
        title: 'Vercel Deployment Guide',
        url: 'https://vercel.com',
        description: 'Despliegue continuo instantáneo conectando tu repositorio de GitHub.',
        color: 'emerald'
      },
      createdAt: now,
      updatedAt: now,
      isDeleted: false,
      syncStatus: 'pending'
    },
    {
      id: 'node-subboard',
      workspaceId: rootWorkspaceId,
      type: 'subboard',
      positionX: 450,
      positionY: 360,
      width: 320,
      height: 120,
      data: {
        title: 'Inspiración & Moodboard',
        subboardId: subboard1Id,
        color: 'purple'
      },
      createdAt: now,
      updatedAt: now,
      isDeleted: false,
      syncStatus: 'pending'
    }
  ])

  // Canvas edges connecting nodes
  await db.canvasEdges.bulkPut([
    {
      id: 'edge-1',
      workspaceId: rootWorkspaceId,
      source: 'node-intro',
      target: 'node-todos',
      label: 'Acciones',
      animated: true,
      color: '#6366f1',
      createdAt: now,
      updatedAt: now,
      isDeleted: false,
      syncStatus: 'pending'
    },
    {
      id: 'edge-2',
      workspaceId: rootWorkspaceId,
      source: 'node-todos',
      target: 'node-subboard',
      label: 'Explorar',
      animated: false,
      color: '#ec4899',
      createdAt: now,
      updatedAt: now,
      isDeleted: false,
      syncStatus: 'pending'
    }
  ])
  } catch (err) {
    console.warn('seedInitialData warning:', err)
  } finally {
    isSeeding = false
  }
}

// Workspace Management Helpers
export async function createSpace(
  name: string,
  icon: string = '💼',
  color: string = '#1e96eb',
  isPrivate: boolean = false,
  ownerMember?: string,
  ownerName?: string,
  userId?: string,
  adminOnly: boolean = false
): Promise<{ space: SpaceItem; initialPageId: string }> {
  const now = Date.now()
  const spaceId = `space-${crypto.randomUUID()}`
  const trimmedName = name.trim() || 'Nuevo Espacio'

  const existingSpaces = await db.spaces.toArray()
  const maxOrder = existingSpaces.reduce((max, s) => Math.max(max, s.sortOrder ?? 0), 0)

  const creatorTokens = [ownerMember, ownerName, userId].filter(Boolean) as string[]

  const space: SpaceItem = {
    id: spaceId,
    name: trimmedName,
    icon: icon || (isPrivate ? '🔒' : adminOnly ? '🛡️' : '💼'),
    color: color || '#1e96eb',
    createdAt: now,
    updatedAt: now,
    syncStatus: 'pending',
    isPrivate,
    adminOnly: isPrivate ? false : adminOnly,
    sortOrder: maxOrder + 1000,
    ownerMember: ownerMember || undefined,
    ownerName: ownerName || undefined,
    userId: userId || undefined,
    createdBy: ownerName || ownerMember || undefined,
    viewedBy: creatorTokens,
    isNewItem: true
  }

  await db.spaces.add(space)

  // Create an initial starter page for this workspace
  const initialPageId = crypto.randomUUID()
  await db.workspaces.add({
    id: initialPageId,
    parentId: null,
    spaceId: spaceId,
    title: isPrivate ? 'Página inicial privada' : 'Página inicial',
    icon: '',
    color: color || '#1e96eb',
    viewMode: 'doc',
    docContent: isPrivate
      ? `<h1>🔒 ${trimmedName}</h1><p>¡Bienvenido a tu nuevo espacio de trabajo privado! Este espacio y sus notas son visibles exclusivamente para ti.</p>`
      : `<h1>✨ ${trimmedName}</h1><p>¡Bienvenido a tu nuevo espacio de trabajo! Puedes empezar a crear notas, diagramas y listas de tareas aquí.</p>`,
    createdAt: now,
    updatedAt: now,
    isFavorite: false,
    isDeleted: false,
    syncStatus: 'pending',
    isPrivate,
    ownerMember: ownerMember || undefined,
    ownerName: ownerName || undefined,
    createdBy: ownerName || ownerMember || undefined,
    userId: userId || undefined,
    viewedBy: creatorTokens,
    isNewItem: true,
    activeProperties: [
      'tags',
      'createdAt',
      'updatedAt'
    ],
    propertyVisibility: {
      tags: 'always_show',
      createdAt: 'always_show',
      updatedAt: 'always_show'
    }
  })

  return { space, initialPageId }
}

export async function updateSpace(id: string, updates: Partial<SpaceItem>): Promise<void> {
  const existing = await db.spaces.get(id)
  const nextUpdatedAt = getSafeTimestamp(existing?.updatedAt)
  await db.spaces.update(id, {
    ...updates,
    updatedAt: nextUpdatedAt,
    syncStatus: 'pending'
  })
}

export async function moveSpaceToTrash(id: string): Promise<void> {
  await db.transaction('rw', db.spaces, db.workspaces, async () => {
    const sp = await db.spaces.get(id)
    if (!sp) return
    await db.spaces.update(id, {
      isDeleted: true,
      updatedAt: getSafeTimestamp(sp.updatedAt),
      syncStatus: 'pending'
    })

    const pages = await db.workspaces.where('spaceId').equals(id).toArray()
    for (const page of pages) {
      if (!page.isDeleted) {
        await db.workspaces.update(page.id, {
          isDeleted: true,
          trashedWithSpaceId: id,
          updatedAt: getSafeTimestamp(page.updatedAt),
          syncStatus: 'pending'
        })
      }
    }
  })
}

export async function restoreSpaceFromTrash(id: string): Promise<void> {
  await db.transaction('rw', db.spaces, db.workspaces, async () => {
    const sp = await db.spaces.get(id)
    if (!sp) return
    await db.spaces.update(id, {
      isDeleted: false,
      updatedAt: getSafeTimestamp(sp.updatedAt),
      syncStatus: 'pending'
    })

    const pages = await db.workspaces.where('spaceId').equals(id).toArray()
    for (const page of pages) {
      if (page.isDeleted && page.trashedWithSpaceId === id) {
        await db.workspaces.update(page.id, {
          isDeleted: false,
          trashedWithSpaceId: undefined,
          updatedAt: getSafeTimestamp(page.updatedAt),
          syncStatus: 'pending'
        })
      }
    }
  })
}

export async function deleteSpace(id: string): Promise<void> {
  const [pages, cols, tags] = await Promise.all([
    db.workspaces.where('spaceId').equals(id).toArray(),
    db.collections.where('spaceId').equals(id).toArray(),
    db.tags.where('spaceId').equals(id).toArray()
  ])
  const pageIds = pages.map((p) => p.id)
  const colIds = cols.map((c) => c.id)
  const tagIds = tags.map((t) => t.id)

  // Limpiar imágenes en Supabase Storage asociadas a los documentos y tableros del espacio
  try {
    const { deleteImageFromStorage, extractStorageUrlsFromHtml } = await import('../lib/imageOptimizer')
    for (const page of pages) {
      const nodes = await db.canvasNodes.where('workspaceId').equals(page.id).toArray()
      for (const n of nodes) {
        if (n.data?.imageUrl) {
          deleteImageFromStorage(n.data.imageUrl).catch(() => {})
        }
      }
      if (page.docContent) {
        const urls = extractStorageUrlsFromHtml(page.docContent)
        for (const u of urls) {
          deleteImageFromStorage(u).catch(() => {})
        }
      }
    }
  } catch {
    // ignore storage cleanup errors
  }

  // Registrar tombstones locales para que un fallo offline/de red no resucite el espacio ni sus notas
  recordPendingHardDeletes('spaces', [id])
  if (pageIds.length > 0) recordPendingHardDeletes('workspaces', pageIds)
  if (colIds.length > 0) recordPendingHardDeletes('collections', colIds)
  if (tagIds.length > 0) recordPendingHardDeletes('tags', tagIds)

  // 1. Si Supabase está conectado, eliminar definitivamente de la nube
  const supabase = getSupabaseClient()
  if (supabase) {
    try {
      if (pageIds.length > 0) {
        const [nodesRes, edgesRes, wsDelRes] = await Promise.all([
          supabase.from('seven_canvas_nodes').delete().in('workspace_id', pageIds),
          supabase.from('seven_canvas_edges').delete().in('workspace_id', pageIds),
          supabase.from('seven_workspaces').delete().in('id', pageIds)
        ])
        let wsCleared = !wsDelRes.error
        if (wsDelRes.error) {
          const wsSoftRes = await supabase
            .from('seven_workspaces')
            .update({ is_deleted: true, updated_at: getSafeTimestamp() })
            .in('id', pageIds)
          wsCleared = !wsSoftRes.error
        }
        if (wsCleared && !nodesRes.error && !edgesRes.error) {
          clearPendingHardDeletes('workspaces', pageIds)
        }
      }

      const [colDelRes, tagDelRes, spDelRes] = await Promise.all([
        supabase.from('seven_collections').delete().eq('space_id', id),
        supabase.from('seven_tags').delete().eq('space_id', id),
        supabase.from('seven_spaces').delete().eq('id', id)
      ])
      if (!colDelRes.error && colIds.length > 0) clearPendingHardDeletes('collections', colIds)
      if (!tagDelRes.error && tagIds.length > 0) clearPendingHardDeletes('tags', tagIds)

      let spaceCleared = !spDelRes.error
      if (spDelRes.error) {
        const spSoftRes = await supabase
          .from('seven_spaces')
          .update({ is_deleted: true, updated_at: getSafeTimestamp() })
          .eq('id', id)
        spaceCleared = !spSoftRes.error
      }
      if (spaceCleared) {
        clearPendingHardDeletes('spaces', [id])
      }
    } catch (err) {
      console.warn('Error purging space from Supabase:', err)
    }
  }

  // 2. Limpiar en local (IndexedDB + localStorage)
  for (const pageId of pageIds) {
    await db.canvasNodes.where('workspaceId').equals(pageId).delete().catch(() => {})
    await db.canvasEdges.where('workspaceId').equals(pageId).delete().catch(() => {})
  }
  await db.workspaces.where('spaceId').equals(id).delete().catch(() => {})
  await db.collections.where('spaceId').equals(id).delete().catch(() => {})
  await db.tags.where('spaceId').equals(id).delete().catch(() => {})
  await db.spaces.delete(id).catch(() => {})
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(`seven_note_folder_order_${id}`)
    }
  } catch {
    // ignore
  }
}

export const permanentlyDeleteSpace = deleteSpace

// Collections helpers
export async function createCollection(
  spaceId: string,
  name: string,
  icon = '📁',
  color = '#1e96eb'
): Promise<CollectionItem> {
  const now = Date.now()
  const collection: CollectionItem = {
    id: `col-${crypto.randomUUID()}`,
    spaceId,
    name: name.trim() || 'Nueva Colección',
    icon,
    color,
    docIds: [],
    createdAt: now,
    updatedAt: now,
    syncStatus: 'pending'
  }
  await db.collections.add(collection)
  return collection
}

export async function updateCollection(id: string, updates: Partial<CollectionItem>): Promise<void> {
  await db.collections.update(id, {
    ...updates,
    updatedAt: Date.now(),
    syncStatus: 'pending'
  })
}

export async function deleteCollection(id: string): Promise<void> {
  recordPendingHardDeletes('collections', [id])
  const supabase = getSupabaseClient()
  if (supabase) {
    try {
      const { error } = await supabase.from('seven_collections').delete().eq('id', id)
      if (!error) {
        clearPendingHardDeletes('collections', [id])
      } else {
        const softRes = await supabase
          .from('seven_collections')
          .update({ is_deleted: true, updated_at: Date.now() })
          .eq('id', id)
        if (!softRes.error) clearPendingHardDeletes('collections', [id])
      }
    } catch {
      // keep pending hard delete for syncEngine
    }
  }
  await db.collections.delete(id)
}

export async function toggleDocInCollection(collectionId: string, docId: string): Promise<void> {
  const col = await db.collections.get(collectionId)
  if (!col) return
  const exists = col.docIds.includes(docId)
  const newDocIds = exists ? col.docIds.filter((id) => id !== docId) : [...col.docIds, docId]
  await db.collections.update(collectionId, {
    docIds: newDocIds,
    updatedAt: Date.now(),
    syncStatus: 'pending'
  })
}

// Tags helpers (AFFiNE color system)
export const AFFINE_TAG_COLORS = [
  { name: 'Azul', hex: '#1e96eb' },
  { name: 'Púrpura', hex: '#8b5cf6' },
  { name: 'Verde', hex: '#22c55e' },
  { name: 'Amarillo', hex: '#eab308' },
  { name: 'Naranja', hex: '#f97316' },
  { name: 'Rojo', hex: '#eb4335' },
  { name: 'Turquesa', hex: '#14b8a6' },
  { name: 'Magenta', hex: '#ec4899' },
  { name: 'Gris', hex: '#71717a' }
]

export async function getOrCreateTag(spaceId: string, tagName: string, colorHex?: string): Promise<TagItem> {
  const cleanName = tagName.trim()
  const existing = await db.tags.where('spaceId').equals(spaceId).and((t) => t.name.toLowerCase() === cleanName.toLowerCase()).first()
  if (existing) return existing

  const color = colorHex || AFFINE_TAG_COLORS[Math.floor(Math.random() * AFFINE_TAG_COLORS.length)].hex
  const tag: TagItem = {
    id: `tag-${crypto.randomUUID()}`,
    spaceId,
    name: cleanName,
    color,
    createdAt: Date.now(),
    syncStatus: 'pending'
  }
  await db.tags.add(tag)
  return tag
}

export async function updateTagColor(id: string, color: string): Promise<void> {
  await db.tags.update(id, { color, syncStatus: 'pending' })
}

export async function renameTag(id: string, spaceId: string, oldName: string, newName: string): Promise<void> {
  const cleanNew = newName.trim()
  if (!cleanNew) return
  await db.tags.update(id, { name: cleanNew, syncStatus: 'pending' })

  // Update in all workspaces
  const docs = await db.workspaces.where('spaceId').equals(spaceId).toArray()
  for (const doc of docs) {
    if (doc.tags && doc.tags.includes(oldName)) {
      const updatedTags = doc.tags.map((t) => (t === oldName ? cleanNew : t))
      await db.workspaces.update(doc.id, { tags: updatedTags, updatedAt: Date.now(), syncStatus: 'pending' })
    }
  }
}

export async function deleteTag(id: string, spaceId: string, tagName: string): Promise<void> {
  recordPendingHardDeletes('tags', [id])
  const supabase = getSupabaseClient()
  if (supabase) {
    try {
      const { error } = await supabase.from('seven_tags').delete().eq('id', id)
      if (!error) {
        clearPendingHardDeletes('tags', [id])
      } else {
        const softRes = await supabase
          .from('seven_tags')
          .update({ is_deleted: true })
          .eq('id', id)
        if (!softRes.error) clearPendingHardDeletes('tags', [id])
      }
    } catch {
      // keep pending hard delete for syncEngine
    }
  }
  await db.tags.delete(id)
  const docs = await db.workspaces.where('spaceId').equals(spaceId).toArray()
  for (const doc of docs) {
    if (doc.tags && doc.tags.includes(tagName)) {
      const newTags = doc.tags.filter((t) => t !== tagName)
      await db.workspaces.update(doc.id, { tags: newTags, updatedAt: Date.now(), syncStatus: 'pending' })
    }
  }
}

/**
 * Limpia los datos locales almacenados en IndexedDB al cerrar sesión
 * para garantizar la privacidad y prevenir filtraciones entre usuarios.
 */
export async function clearLocalUserData(): Promise<void> {
  await Promise.all([
    db.workspaces.clear(),
    db.canvasNodes.clear(),
    db.canvasEdges.clear(),
    db.collections.clear(),
    db.tags.clear(),
    db.spaces.clear(),
    db.offlineAssets.clear(),
    db.syncLogs.clear(),
    db.notifications.clear()
  ])
  clearAllPendingHardDeletes()
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(DEMO_SEEDED_KEY)
      localStorage.removeItem(WELCOME_GUIDE_KEY)
      const keysToRemove: string[] = []
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i)
        if (key && (key.startsWith('seven_note_folder_order_') || key.startsWith('seven_note_viewed_'))) {
          keysToRemove.push(key)
        }
      }
      keysToRemove.forEach((k) => localStorage.removeItem(k))
    }
  } catch {
    // ignore
  }
}
