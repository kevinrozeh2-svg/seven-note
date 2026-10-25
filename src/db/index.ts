import Dexie, { type Table } from 'dexie'

export type ViewMode = 'doc' | 'canvas' | 'split'
export type SyncStatus = 'synced' | 'pending' | 'failed'

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

export type CanvasNodeType = 'note' | 'todo' | 'image' | 'link' | 'column' | 'subboard'

export interface CanvasTodoItem {
  id: string
  text: string
  completed: boolean
}

export interface CanvasNodeData {
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
  width?: number
  height?: number
  collapsed?: boolean
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

export class SevenNoteDatabase extends Dexie {
  workspaces!: Table<WorkspaceItem, string>
  canvasNodes!: Table<CanvasNodeItem, string>
  canvasEdges!: Table<CanvasEdgeItem, string>
  offlineAssets!: Table<OfflineAsset, string>
  syncLogs!: Table<SyncLogItem, string>

  constructor() {
    super('SevenNoteDB')
    this.version(1).stores({
      workspaces: 'id, parentId, updatedAt, isDeleted, isFavorite, syncStatus',
      canvasNodes: 'id, workspaceId, type, updatedAt, isDeleted, syncStatus',
      canvasEdges: 'id, workspaceId, source, target, updatedAt, isDeleted, syncStatus',
      offlineAssets: 'id, workspaceId, createdAt, syncStatus',
      syncLogs: 'id, timestamp, status'
    })
  }
}

export const db = new SevenNoteDatabase()

// Seed default initial data if database is empty
export async function seedInitialData() {
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

  await db.workspaces.bulkAdd([
    {
      id: rootWorkspaceId,
      parentId: null,
      title: 'Bienvenido a Seven Note',
      icon: '🚀',
      color: '#6366f1',
      viewMode: 'split',
      docContent: defaultDocHtml,
      createdAt: now,
      updatedAt: now,
      isFavorite: true,
      isDeleted: false,
      syncStatus: 'pending'
    },
    {
      id: subboard1Id,
      parentId: rootWorkspaceId,
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
