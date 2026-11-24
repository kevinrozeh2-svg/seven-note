import { type AppTemplate, APP_TEMPLATES } from './templates'
import { db, type WorkspaceItem } from '../db'

const CUSTOM_TEMPLATES_KEY = 'seven_note_custom_templates_v1'
const FAVORITE_TEMPLATES_KEY = 'seven_note_template_favorites_v1'
const RECENT_TEMPLATES_KEY = 'seven_note_template_recents_v1'
const MAX_RECENTS = 8

export const TEMPLATES_STORAGE_EVENT = 'seven-note:templates-updated'

function emitTemplatesUpdated() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(TEMPLATES_STORAGE_EVENT))
  }
}

export function getCustomTemplates(): AppTemplate[] {
  if (typeof localStorage === 'undefined') return []
  try {
    const raw = localStorage.getItem(CUSTOM_TEMPLATES_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.map((tpl) => ({
      ...tpl,
      isCustom: true
    }))
  } catch {
    return []
  }
}

export function saveCustomTemplate(template: AppTemplate): AppTemplate[] {
  const existing = getCustomTemplates()
  const clean: AppTemplate = {
    ...template,
    id: template.id || `custom-${crypto.randomUUID()}`,
    isCustom: true,
    createdAt: template.createdAt || Date.now()
  }
  const idx = existing.findIndex((t) => t.id === clean.id)
  const next = idx >= 0
    ? existing.map((t, i) => (i === idx ? clean : t))
    : [clean, ...existing]

  try {
    localStorage.setItem(CUSTOM_TEMPLATES_KEY, JSON.stringify(next))
  } catch {
    // ignore quota errors
  }
  emitTemplatesUpdated()
  return next
}

export function deleteCustomTemplate(id: string): AppTemplate[] {
  const next = getCustomTemplates().filter((t) => t.id !== id)
  try {
    localStorage.setItem(CUSTOM_TEMPLATES_KEY, JSON.stringify(next))
  } catch {
    // ignore
  }
  // Clean up favorites and recents
  const favs = getFavoriteTemplateIds().filter((f) => f !== id)
  try {
    localStorage.setItem(FAVORITE_TEMPLATES_KEY, JSON.stringify(favs))
  } catch {
    // ignore
  }
  const recents = getRecentTemplateIds().filter((r) => r !== id)
  try {
    localStorage.setItem(RECENT_TEMPLATES_KEY, JSON.stringify(recents))
  } catch {
    // ignore
  }
  emitTemplatesUpdated()
  return next
}

export function getFavoriteTemplateIds(): string[] {
  if (typeof localStorage === 'undefined') return []
  try {
    const raw = localStorage.getItem(FAVORITE_TEMPLATES_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

export function toggleFavoriteTemplateId(id: string): string[] {
  const current = getFavoriteTemplateIds()
  const exists = current.includes(id)
  const next = exists ? current.filter((x) => x !== id) : [id, ...current]
  try {
    localStorage.setItem(FAVORITE_TEMPLATES_KEY, JSON.stringify(next))
  } catch {
    // ignore
  }
  emitTemplatesUpdated()
  return next
}

export function getRecentTemplateIds(): string[] {
  if (typeof localStorage === 'undefined') return []
  try {
    const raw = localStorage.getItem(RECENT_TEMPLATES_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

export function recordTemplateUsed(id: string): string[] {
  const current = getRecentTemplateIds().filter((x) => x !== id)
  const next = [id, ...current].slice(0, MAX_RECENTS)
  try {
    localStorage.setItem(RECENT_TEMPLATES_KEY, JSON.stringify(next))
  } catch {
    // ignore
  }
  emitTemplatesUpdated()
  return next
}

export function getAllTemplates(): AppTemplate[] {
  return [...getCustomTemplates(), ...APP_TEMPLATES]
}

export async function createCustomTemplateFromWorkspace(
  workspace: WorkspaceItem,
  options: {
    title: string
    description: string
    category: AppTemplate['category']
    tags?: string[]
  }
): Promise<AppTemplate> {
  const isCanvas = workspace.viewMode === 'canvas'
  let nodes: AppTemplate['nodes'] = undefined
  let edges: AppTemplate['edges'] = undefined

  if (isCanvas) {
    const rawNodes = await db.canvasNodes
      .where('workspaceId')
      .equals(workspace.id)
      .filter((n) => !n.isDeleted)
      .toArray()
    const rawEdges = await db.canvasEdges
      .where('workspaceId')
      .equals(workspace.id)
      .filter((e) => !e.isDeleted)
      .toArray()

    const idToIndex = new Map<string, number>()
    nodes = rawNodes.map((n, idx) => {
      idToIndex.set(n.id, idx)
      const { workspaceId: _wsId, ...restData } = (n.data || {}) as Record<string, any>
      return {
        type: n.type,
        positionX: n.positionX,
        positionY: n.positionY,
        data: restData
      }
    })

    edges = rawEdges
      .map((e) => {
        const sourceIndex = idToIndex.get(e.source)
        const targetIndex = idToIndex.get(e.target)
        if (sourceIndex === undefined || targetIndex === undefined) return null
        return {
          sourceIndex,
          targetIndex,
          label: e.label,
          color: e.color
        }
      })
      .filter(Boolean) as AppTemplate['edges']
  }

  const newTpl: AppTemplate = {
    id: `custom-${crypto.randomUUID()}`,
    title: options.title.trim() || workspace.title || 'Plantilla personalizada',
    description:
      options.description.trim() ||
      (isCanvas
        ? `Lienzo personalizado con ${nodes?.length || 0} elementos.`
        : 'Documento personalizado guardado desde tu espacio de trabajo.'),
    icon: workspace.icon || (isCanvas ? '🗂️' : '📄'),
    category: options.category,
    type: isCanvas ? 'canvas' : 'doc',
    tags: options.tags && options.tags.length > 0 ? options.tags : ['Personalizada'],
    docContent: isCanvas ? undefined : workspace.docContent || '<p></p>',
    nodes,
    edges,
    hasCover: workspace.hasCover,
    coverType: workspace.coverType,
    coverBannerTitle: workspace.coverBannerTitle,
    coverBannerSubtitle: workspace.coverBannerSubtitle,
    coverColor: workspace.coverColor,
    coverBannerStyle: workspace.coverBannerStyle,
    isCustom: true,
    createdAt: Date.now()
  }

  saveCustomTemplate(newTpl)
  return newTpl
}
