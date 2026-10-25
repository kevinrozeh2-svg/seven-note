import { useCallback, useEffect, useState, useMemo } from 'react'
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  BackgroundVariant,
  useNodesState,
  useEdgesState,
  addEdge,
  type Connection,
  type Edge,
  type Node,
  Panel
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { useLiveQuery } from 'dexie-react-hooks'
import {
  StickyNote,
  CheckSquare,
  Image as ImageIcon,
  Link as LinkIcon,
  FolderPlus,
  Maximize2,
  Trash2
} from 'lucide-react'
import { db, type CanvasNodeType } from '../../db'
import { syncEngine } from '../../lib/syncEngine'
import { NoteNode } from './nodes/NoteNode'
import { TodoNode } from './nodes/TodoNode'
import { ImageNode } from './nodes/ImageNode'
import { LinkNode } from './nodes/LinkNode'
import { SubboardNode } from './nodes/SubboardNode'

interface CanvasBoardProps {
  workspaceId: string
}

export function CanvasBoard({ workspaceId }: CanvasBoardProps) {
  // Query nodes and edges reactively from Dexie
  const dbNodes = useLiveQuery(
    () => db.canvasNodes.where('workspaceId').equals(workspaceId).and((n) => !n.isDeleted).toArray(),
    [workspaceId]
  )

  const dbEdges = useLiveQuery(
    () => db.canvasEdges.where('workspaceId').equals(workspaceId).and((e) => !e.isDeleted).toArray(),
    [workspaceId]
  )

  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([])
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([])
  const [showMiniMap, setShowMiniMap] = useState(false)

  const nodeTypes = useMemo(
    () => ({
      note: NoteNode,
      todo: TodoNode,
      image: ImageNode,
      link: LinkNode,
      subboard: SubboardNode
    }),
    []
  )

  // Sync IndexedDB nodes to React Flow nodes state
  useEffect(() => {
    if (!dbNodes) return
    const flowNodes: Node[] = dbNodes.map((n) => ({
      id: n.id,
      type: n.type,
      position: { x: n.positionX, y: n.positionY },
      data: { ...n.data, parentWorkspaceId: workspaceId }
    }))
    setNodes(flowNodes)
  }, [dbNodes, workspaceId, setNodes])

  // Sync IndexedDB edges to React Flow edges state
  useEffect(() => {
    if (!dbEdges) return
    const flowEdges: Edge[] = dbEdges.map((e) => ({
      id: e.id,
      source: e.source,
      target: e.target,
      sourceHandle: e.sourceHandle || undefined,
      targetHandle: e.targetHandle || undefined,
      label: e.label,
      animated: e.animated ?? true,
      style: { stroke: e.color || '#6366f1', strokeWidth: 2 }
    }))
    setEdges(flowEdges)
  }, [dbEdges, setEdges])

  // Save node position after dragging
  const onNodeDragStop = useCallback(
    async (_: any, node: Node) => {
      try {
        await db.canvasNodes.update(node.id, {
          positionX: node.position.x,
          positionY: node.position.y,
          updatedAt: Date.now(),
          syncStatus: 'pending'
        })
        syncEngine.scheduleSync(1000)
      } catch (err) {
        console.error('Failed to update node position', err)
      }
    },
    []
  )

  // Handle connecting cards with an arrow
  const onConnect = useCallback(
    async (params: Connection) => {
      setEdges((eds) => addEdge({ ...params, animated: true }, eds))

      if (!params.source || !params.target) return
      const newEdgeId = crypto.randomUUID()
      try {
        await db.canvasEdges.add({
          id: newEdgeId,
          workspaceId,
          source: params.source,
          target: params.target,
          sourceHandle: params.sourceHandle,
          targetHandle: params.targetHandle,
          animated: true,
          color: '#6366f1',
          createdAt: Date.now(),
          updatedAt: Date.now(),
          isDeleted: false,
          syncStatus: 'pending'
        })
        syncEngine.scheduleSync(1000)
      } catch (err) {
        console.error('Failed to create edge in DB', err)
      }
    },
    [workspaceId, setEdges]
  )

  // Quick add card of specified type
  const addNewNode = async (type: CanvasNodeType) => {
    const newId = crypto.randomUUID()
    // Stagger spawn position in visible center
    const posX = 150 + Math.random() * 200
    const posY = 150 + Math.random() * 200

    let initialData: any = {}
    if (type === 'note') {
      initialData = { title: 'Nueva Nota', content: '', color: 'yellow' }
    } else if (type === 'todo') {
      initialData = {
        title: 'Checklist',
        todos: [{ id: '1', text: 'Mi primera tarea', completed: false }],
        color: 'blue'
      }
    } else if (type === 'image') {
      initialData = { caption: 'Foto de referencia' }
    } else if (type === 'link') {
      initialData = { title: 'Nuevo Enlace', url: '', description: '' }
    } else if (type === 'subboard') {
      initialData = { title: 'Sub-tablero' }
    }

    try {
      await db.canvasNodes.add({
        id: newId,
        workspaceId,
        type,
        positionX: posX,
        positionY: posY,
        data: initialData,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        isDeleted: false,
        syncStatus: 'pending'
      })
      syncEngine.scheduleSync(1000)
    } catch (err) {
      console.error('Failed to add new node', err)
    }
  }

  // Clear all nodes in this canvas
  const handleClearBoard = async () => {
    if (!confirm('¿Deseas vaciar todas las tarjetas de este tablero?')) return
    try {
      const currentNodes = await db.canvasNodes.where('workspaceId').equals(workspaceId).toArray()
      for (const n of currentNodes) {
        await db.canvasNodes.update(n.id, { isDeleted: true, updatedAt: Date.now(), syncStatus: 'pending' })
      }
      syncEngine.scheduleSync(1000)
    } catch (err) {
      console.error('Error clearing board', err)
    }
  }

  return (
    <div className="relative w-full h-full bg-slate-100 dark:bg-slate-950 overflow-hidden select-none">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeDragStop={onNodeDragStop}
        onConnect={onConnect}
        nodeTypes={nodeTypes}
        fitView
        minZoom={0.2}
        maxZoom={2}
        defaultEdgeOptions={{ animated: true }}
      >
        <Background variant={BackgroundVariant.Dots} gap={20} size={1.5} color="#94a3b8" />
        <Controls className="!bg-white dark:!bg-slate-800 !border-slate-200 dark:!border-slate-700 !shadow-lg rounded-lg" />
        {showMiniMap && (
          <MiniMap
            className="!bg-white/80 dark:!bg-slate-800/80 !border-slate-200 dark:!border-slate-700 rounded-lg shadow-lg"
            nodeColor="#6366f1"
          />
        )}

        {/* Top Right Canvas Actions */}
        <Panel position="top-right" className="flex items-center gap-2">
          <button
            onClick={() => setShowMiniMap(!showMiniMap)}
            className="px-2.5 py-1.5 rounded-lg text-xs font-medium bg-white/90 dark:bg-slate-800/90 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700 shadow-sm backdrop-blur transition flex items-center gap-1.5"
          >
            <Maximize2 size={13} />
            <span>{showMiniMap ? 'Ocultar mapa' : 'Minimapa'}</span>
          </button>

          <button
            onClick={handleClearBoard}
            className="p-1.5 rounded-lg bg-white/90 dark:bg-slate-800/90 text-slate-400 hover:text-rose-500 border border-slate-200 dark:border-slate-700 shadow-sm backdrop-blur transition"
            title="Vaciar tablero"
          >
            <Trash2 size={14} />
          </button>
        </Panel>

        {/* Bottom Floating Milanote Creation Dock */}
        <Panel position="bottom-center" className="mb-4">
          <div className="flex items-center gap-1.5 p-1.5 rounded-2xl bg-white/95 dark:bg-slate-900/95 border border-slate-200 dark:border-slate-800 shadow-2xl backdrop-blur-md">
            <button
              onClick={() => addNewNode('note')}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold text-amber-700 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/60 transition"
              title="Añadir Nota Adhesiva"
            >
              <StickyNote size={15} />
              <span>Nota</span>
            </button>

            <button
              onClick={() => addNewNode('todo')}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold text-sky-700 dark:text-sky-400 hover:bg-sky-50 dark:hover:bg-sky-950/60 transition"
              title="Añadir Lista de Tareas"
            >
              <CheckSquare size={15} />
              <span>Tareas</span>
            </button>

            <button
              onClick={() => addNewNode('image')}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/60 transition"
              title="Añadir Imagen Offline"
            >
              <ImageIcon size={15} />
              <span>Imagen</span>
            </button>

            <button
              onClick={() => addNewNode('link')}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold text-purple-700 dark:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-950/60 transition"
              title="Añadir Enlace Web"
            >
              <LinkIcon size={15} />
              <span>Enlace</span>
            </button>

            <button
              onClick={() => addNewNode('subboard')}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold text-indigo-700 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/60 transition"
              title="Añadir Sub-tablero anidado"
            >
              <FolderPlus size={15} />
              <span>Sub-tablero</span>
            </button>
          </div>
        </Panel>
      </ReactFlow>
    </div>
  )
}
