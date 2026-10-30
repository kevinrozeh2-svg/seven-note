import Dexie, { type Table } from 'dexie'

export type ViewMode = 'doc' | 'canvas' | 'split'
export type SyncStatus = 'synced' | 'pending' | 'failed'

export const DEFAULT_SPACE_ID = 'default-workspace'

export interface SpaceItem {
  id: string
  name: string
  icon?: string
  color?: string
  createdAt: number
  updatedAt: number
  isDeleted?: boolean
  syncStatus?: SyncStatus
}

export interface CustomPropertyItem {
  id: string
  name: string
  type: 'text' | 'number' | 'checkbox' | 'date' | 'select' | 'unknown'
  value: any
  visibility: 'always_show' | 'always_hide' | 'hide_empty'
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
  | 'voiceNote'
  | 'file'
  | 'audio'
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

  // Milanote Voice Note specific
  audioDataUrl?: string
  audioDuration?: number
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

export class SevenNoteDatabase extends Dexie {
  workspaces!: Table<WorkspaceItem, string>
  canvasNodes!: Table<CanvasNodeItem, string>
  canvasEdges!: Table<CanvasEdgeItem, string>
  offlineAssets!: Table<OfflineAsset, string>
  syncLogs!: Table<SyncLogItem, string>
  spaces!: Table<SpaceItem, string>
  collections!: Table<CollectionItem, string>
  tags!: Table<TagItem, string>

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
  }
}

export const db = new SevenNoteDatabase()

// Seed default initial data if database is empty
export async function seedInitialData() {
  const spaceCount = await db.spaces.count()
  if (spaceCount === 0) {
    await db.spaces.add({
      id: DEFAULT_SPACE_ID,
      name: 'Demo Workspace',
      icon: '⚡',
      color: '#1e96eb',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      syncStatus: 'pending'
    })
  }

  // Ensure any existing workspaces without spaceId are attributed to DEFAULT_SPACE_ID
  const withoutSpace = await db.workspaces.filter((w) => !w.spaceId).toArray()
  if (withoutSpace.length > 0) {
    await db.workspaces.bulkUpdate(
      withoutSpace.map((w) => ({
        key: w.id,
        changes: { spaceId: DEFAULT_SPACE_ID }
      }))
    )
  }

  const count = await db.workspaces.count()
  if (count > 0) return

  const now = Date.now()
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

  await db.workspaces.bulkAdd([
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
      syncStatus: 'pending',
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
        pageWidth: 'always_hide'
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
    }
  ])

  // Canvas nodes for the welcome workspace
  await db.canvasNodes.bulkAdd([
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
  await db.canvasEdges.bulkAdd([
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
}

// Workspace Management Helpers
export async function createSpace(
  name: string,
  icon: string = '💼',
  color: string = '#1e96eb'
): Promise<{ space: SpaceItem; initialPageId: string }> {
  const now = Date.now()
  const spaceId = `space-${crypto.randomUUID()}`
  const trimmedName = name.trim() || 'Nuevo Espacio'

  const space: SpaceItem = {
    id: spaceId,
    name: trimmedName,
    icon: icon || '💼',
    color: color || '#1e96eb',
    createdAt: now,
    updatedAt: now,
    syncStatus: 'pending'
  }

  await db.spaces.add(space)

  // Create an initial starter page for this workspace
  const initialPageId = crypto.randomUUID()
  await db.workspaces.add({
    id: initialPageId,
    parentId: null,
    spaceId: spaceId,
    title: 'Página inicial',
    icon: icon || '📄',
    color: color || '#1e96eb',
    viewMode: 'doc',
    docContent: `<h1>✨ ${trimmedName}</h1><p>¡Bienvenido a tu nuevo espacio de trabajo! Puedes empezar a crear notas, diagramas y listas de tareas aquí.</p>`,
    createdAt: now,
    updatedAt: now,
    isFavorite: false,
    isDeleted: false,
    syncStatus: 'pending',
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
  await db.spaces.update(id, {
    ...updates,
    updatedAt: Date.now(),
    syncStatus: 'pending'
  })
}

export async function deleteSpace(id: string): Promise<void> {
  const pages = await db.workspaces.where('spaceId').equals(id).toArray()
  for (const page of pages) {
    await db.canvasNodes.where('workspaceId').equals(page.id).delete()
    await db.canvasEdges.where('workspaceId').equals(page.id).delete()
  }
  await db.workspaces.where('spaceId').equals(id).delete()
  await db.spaces.delete(id)
}

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
  await db.tags.delete(id)
  const docs = await db.workspaces.where('spaceId').equals(spaceId).toArray()
  for (const doc of docs) {
    if (doc.tags && doc.tags.includes(tagName)) {
      const newTags = doc.tags.filter((t) => t !== tagName)
      await db.workspaces.update(doc.id, { tags: newTags, updatedAt: Date.now(), syncStatus: 'pending' })
    }
  }
}
