import { db } from '../db'
import { toast } from 'sonner'

export interface ObsidianCanvasNode {
  id: string
  type: 'text' | 'file' | 'link' | 'group'
  x: number
  y: number
  width: number
  height: number
  text?: string
  file?: string
  url?: string
  color?: string
  label?: string
}

export interface ObsidianCanvasEdge {
  id: string
  fromNode: string
  fromSide?: 'top' | 'right' | 'bottom' | 'left'
  toNode: string
  toSide?: 'top' | 'right' | 'bottom' | 'left'
  label?: string
  color?: string
}

export interface ObsidianCanvasFormat {
  nodes: ObsidianCanvasNode[]
  edges: ObsidianCanvasEdge[]
}

/**
 * Exports current workspace canvas as an Obsidian .canvas JSON file
 */
export async function exportToObsidianCanvas(workspaceId: string, title: string = 'canvas') {
  const nodes = await db.canvasNodes
    .where('workspaceId')
    .equals(workspaceId)
    .and((n) => !n.isDeleted)
    .toArray()

  const edges = await db.canvasEdges
    .where('workspaceId')
    .equals(workspaceId)
    .toArray()

  const canvasNodes: ObsidianCanvasNode[] = nodes.map((node) => {
    let type: ObsidianCanvasNode['type'] = 'text'
    let text: string | undefined = undefined
    let url: string | undefined = undefined

    if (node.type === 'frame') {
      type = 'group'
      text = node.data.title || node.data.frameTitle || 'Marco'
    } else if (node.type === 'link') {
      type = 'link'
      url = node.data.url
    } else if (node.type === 'note' || node.type === 'text') {
      type = 'text'
      text = (node.data.title ? `## ${node.data.title}\n\n` : '') + (node.data.content || '')
    } else if (node.type === 'todo') {
      type = 'text'
      const todos = (node.data.todos || [])
        .map((t) => `- [${t.completed ? 'x' : ' '}] ${t.text}`)
        .join('\n')
      text = (node.data.title ? `## ${node.data.title}\n\n` : '') + todos
    } else {
      type = 'text'
      text = node.data.title || node.data.content || ''
    }

    return {
      id: node.id,
      type,
      x: node.positionX,
      y: node.positionY,
      width: node.width || 250,
      height: node.height || 180,
      text,
      url,
      color: node.data.color || node.data.fillColor
    }
  })

  const canvasEdges: ObsidianCanvasEdge[] = edges.map((edge) => ({
    id: edge.id,
    fromNode: edge.source,
    toNode: edge.target,
    label: edge.label,
    color: edge.color
  }))

  const canvasFile: ObsidianCanvasFormat = {
    nodes: canvasNodes,
    edges: canvasEdges
  }

  const jsonString = `data:text/json;charset=utf-8,${encodeURIComponent(JSON.stringify(canvasFile, null, 2))}`
  const downloadAnchor = document.createElement('a')
  downloadAnchor.setAttribute('href', jsonString)
  downloadAnchor.setAttribute('download', `${title.replace(/[^a-zA-Z0-9_-]/g, '_')}.canvas`)
  document.body.appendChild(downloadAnchor)
  downloadAnchor.click()
  downloadAnchor.remove()
  toast.success('Tablero exportado en formato Obsidian JSON Canvas (.canvas)')
}

/**
 * Imports an Obsidian .canvas file into the current workspace
 */
export async function importObsidianCanvas(workspaceId: string, file: File): Promise<number> {
  const text = await file.text()
  const parsed = JSON.parse(text) as ObsidianCanvasFormat

  if (!parsed.nodes || !Array.isArray(parsed.nodes)) {
    throw new Error('Formato .canvas inválido o corrupto.')
  }

  const now = Date.now()
  let importedCount = 0

  for (const node of parsed.nodes) {
    let nodeType: any = 'note'
    let data: any = {
      title: node.label || '',
      content: node.text || '',
      color: node.color
    }

    if (node.type === 'group') {
      nodeType = 'frame'
      data.frameTitle = node.label || node.text || 'Marco'
    } else if (node.type === 'link') {
      nodeType = 'link'
      data.url = node.url || ''
      data.title = node.label || node.url || ''
    } else if (node.type === 'text') {
      nodeType = 'note'
      data.content = node.text || ''
    }

    await db.canvasNodes.put({
      id: node.id,
      workspaceId,
      type: nodeType,
      positionX: node.x,
      positionY: node.y,
      width: node.width,
      height: node.height,
      data,
      createdAt: now,
      updatedAt: now,
      isDeleted: false,
      syncStatus: 'synced'
    })
    importedCount++
  }

  if (parsed.edges && Array.isArray(parsed.edges)) {
    for (const edge of parsed.edges) {
      await db.canvasEdges.put({
        id: edge.id,
        workspaceId,
        source: edge.fromNode,
        target: edge.toNode,
        label: edge.label,
        color: edge.color,
        animated: false,
        edgeType: 'bezier',
        markerEndType: 'arrow',
        createdAt: now,
        updatedAt: now,
        isDeleted: false,
        syncStatus: 'synced'
      })
    }
  }

  return importedCount
}
