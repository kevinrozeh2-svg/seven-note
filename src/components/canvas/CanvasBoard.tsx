import { useCallback, useEffect, useState, useMemo, useRef } from 'react'
import {
  ReactFlow,
  Background,
  MiniMap,
  BackgroundVariant,
  useNodesState,
  useEdgesState,
  addEdge,
  type Connection,
  type Edge,
  type Node,
  Panel,
  useReactFlow,
  ReactFlowProvider
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { useLiveQuery } from 'dexie-react-hooks'
import {
  MousePointer2,
  Hash,
  CornerUpRight,
  Link2,
  MoreHorizontal,
  ZoomIn,
  ZoomOut,
  Maximize,
  Map,
  Trash2,
  X,
  Type,
  Square,
  Circle,
  Diamond,
  Triangle,
  Star,
  Download,
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignJustify,
  Copy,
  Grid,
  Highlighter
} from 'lucide-react'
import { db, type CanvasNodeType, type WorkspaceItem } from '../../db'
import { syncEngine } from '../../lib/syncEngine'
import { DocFrameNode } from './nodes/DocFrameNode'
import { NoteNode } from './nodes/NoteNode'
import { TodoNode } from './nodes/TodoNode'
import { ImageNode } from './nodes/ImageNode'
import { LinkNode } from './nodes/LinkNode'
import { SubboardNode } from './nodes/SubboardNode'
import { ShapeNode } from './nodes/ShapeNode'
import { TextNode } from './nodes/TextNode'
import { FrameNode } from './nodes/FrameNode'

interface CanvasBoardProps {
  workspaceId: string
  currentWorkspace?: WorkspaceItem
  onSwitchToDoc?: () => void
}

type ActiveTool =
  | 'select'
  | 'frame'
  | 'connector'
  | 'link'
  | 'docframe'
  | 'pencil'
  | 'highlighter'
  | 'eraser'
  | 'note'
  | 'shape'
  | 'text'
  | 'media'
  | 'board'

function CanvasBoardInner({
  workspaceId,
  currentWorkspace,
  onSwitchToDoc
}: CanvasBoardProps) {
  const reactFlowInstance = useReactFlow()

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
  const [activeTool, setActiveTool] = useState<ActiveTool>('select')
  const [showMiniMap, setShowMiniMap] = useState(false)
  const [showCanvasMenu, setShowCanvasMenu] = useState(false)
  const [showAlignMenu, setShowAlignMenu] = useState(false)
  const [shapePaletteOpen, setShapePaletteOpen] = useState(false)
  const [penColor, setPenColor] = useState('#3b82f6')
  const [penWidth, setPenWidth] = useState(3)
  const [gridVariant, setGridVariant] = useState<BackgroundVariant | 'none'>(BackgroundVariant.Dots)

  // Freehand drawing canvas state
  const drawingCanvasRef = useRef<HTMLCanvasElement | null>(null)
  const isDrawingRef = useRef(false)
  const [drawings, setDrawings] = useState<Array<{ color: string; width: number; isHighlighter?: boolean; points: { x: number; y: number }[] }>>([])
  const currentStrokeRef = useRef<{ color: string; width: number; isHighlighter?: boolean; points: { x: number; y: number }[] } | null>(null)

  const nodeTypes = useMemo(
    () => ({
      docframe: DocFrameNode,
      note: NoteNode,
      todo: TodoNode,
      image: ImageNode,
      link: LinkNode,
      subboard: SubboardNode,
      shape: ShapeNode,
      text: TextNode,
      frame: FrameNode
    }),
    []
  )

  // Auto-seed central DocFrameNode if canvas is empty
  useEffect(() => {
    const ensureInitialCard = async () => {
      if (!dbNodes) return
      if (dbNodes.length === 0) {
        const newId = `docframe-${workspaceId}`
        await db.canvasNodes.add({
          id: newId,
          workspaceId,
          type: 'docframe',
          positionX: 350,
          positionY: 200,
          data: {
            title: currentWorkspace?.title || 'Title',
            workspaceId,
            content: currentWorkspace?.docContent || ''
          },
          createdAt: Date.now(),
          updatedAt: Date.now(),
          isDeleted: false,
          syncStatus: 'pending'
        })
      }
    }
    ensureInitialCard()
  }, [dbNodes, workspaceId, currentWorkspace?.title, currentWorkspace?.docContent])

  // Sync IndexedDB nodes to React Flow
  useEffect(() => {
    if (!dbNodes) return
    const flowNodes: Node[] = dbNodes.map((n) => ({
      id: n.id,
      type: n.type,
      position: { x: n.positionX, y: n.positionY },
      data: {
        ...n.data,
        workspaceId,
        parentWorkspaceId: workspaceId,
        onOpenDoc: onSwitchToDoc
      }
    }))
    setNodes(flowNodes)
  }, [dbNodes, workspaceId, setNodes, onSwitchToDoc])

  // Sync IndexedDB edges to React Flow
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
      style: { stroke: e.color || '#3b82f6', strokeWidth: 2 }
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

  // Handle connecting cards
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
          color: '#3b82f6',
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

  // Quick add node of specified type
  const addNewNode = async (type: CanvasNodeType, customData: any = {}) => {
    const newId = crypto.randomUUID()
    const posX = 300 + Math.random() * 150
    const posY = 150 + Math.random() * 150

    let initialData: any = { ...customData }
    if (type === 'docframe') {
      initialData = {
        title: 'Title',
        workspaceId,
        content: ''
      }
    } else if (type === 'note') {
      initialData = {
        title: 'Nota Adhesiva',
        content: '',
        color: customData.color || 'yellow'
      }
    } else if (type === 'shape') {
      initialData = {
        shapeType: customData.shapeType || 'rect',
        color: customData.color || 'blue',
        content: customData.content || '',
        width: 180,
        height: 120
      }
    } else if (type === 'text') {
      initialData = {
        content: customData.content || 'Texto nuevo',
        color: customData.color || 'white',
        fontSize: 'base',
        textAlign: 'left'
      }
    } else if (type === 'frame') {
      const existingFrames = dbNodes?.filter((n) => n.type === 'frame').length || 0
      const nextIndex = existingFrames + 1
      initialData = {
        title: `Diapositiva #${nextIndex}`,
        frameIndex: nextIndex,
        frameTitle: `Diapositiva #${nextIndex}`,
        color: 'indigo',
        width: 640,
        height: 420
      }
    } else if (type === 'todo') {
      initialData = {
        title: 'Tareas & Kanban',
        todos: [
          { id: '1', text: 'Definir requerimientos', completed: true },
          { id: '2', text: 'Diseñar interfaz visual', completed: false }
        ],
        color: 'blue'
      }
    } else if (type === 'image') {
      initialData = {
        imageUrl: customData.imageUrl || 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=800',
        caption: 'Referencia visual'
      }
    } else if (type === 'link') {
      initialData = {
        title: 'Enlace de referencia',
        url: 'https://affine.pro',
        description: 'Espacio de trabajo edgeless'
      }
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
      setActiveTool('select')
    } catch (err) {
      console.error('Failed to add new node', err)
    }
  }

  // Duplicate selected nodes (Ctrl+D)
  const duplicateSelectedNodes = useCallback(async () => {
    const selectedNodes = nodes.filter((n) => n.selected)
    if (selectedNodes.length === 0) return

    for (const node of selectedNodes) {
      const newId = crypto.randomUUID()
      await db.canvasNodes.add({
        id: newId,
        workspaceId,
        type: node.type as CanvasNodeType,
        positionX: node.position.x + 40,
        positionY: node.position.y + 40,
        data: { ...node.data },
        createdAt: Date.now(),
        updatedAt: Date.now(),
        isDeleted: false,
        syncStatus: 'pending'
      })
    }
    syncEngine.scheduleSync(1000)
  }, [nodes, workspaceId])

  // Alignment helpers for selected nodes
  const alignSelectedNodes = async (direction: 'left' | 'center' | 'right' | 'top' | 'middle' | 'bottom') => {
    const selectedNodes = nodes.filter((n) => n.selected)
    if (selectedNodes.length < 2) {
      alert('Selecciona al menos 2 elementos para alinearlos')
      return
    }

    if (direction === 'left') {
      const minX = Math.min(...selectedNodes.map((n) => n.position.x))
      for (const node of selectedNodes) {
        await db.canvasNodes.update(node.id, { positionX: minX, updatedAt: Date.now() })
      }
    } else if (direction === 'right') {
      const maxX = Math.max(...selectedNodes.map((n) => n.position.x))
      for (const node of selectedNodes) {
        await db.canvasNodes.update(node.id, { positionX: maxX, updatedAt: Date.now() })
      }
    } else if (direction === 'center') {
      const avgX = selectedNodes.reduce((acc, n) => acc + n.position.x, 0) / selectedNodes.length
      for (const node of selectedNodes) {
        await db.canvasNodes.update(node.id, { positionX: avgX, updatedAt: Date.now() })
      }
    } else if (direction === 'top') {
      const minY = Math.min(...selectedNodes.map((n) => n.position.y))
      for (const node of selectedNodes) {
        await db.canvasNodes.update(node.id, { positionY: minY, updatedAt: Date.now() })
      }
    } else if (direction === 'bottom') {
      const maxY = Math.max(...selectedNodes.map((n) => n.position.y))
      for (const node of selectedNodes) {
        await db.canvasNodes.update(node.id, { positionY: maxY, updatedAt: Date.now() })
      }
    } else if (direction === 'middle') {
      const avgY = selectedNodes.reduce((acc, n) => acc + n.position.y, 0) / selectedNodes.length
      for (const node of selectedNodes) {
        await db.canvasNodes.update(node.id, { positionY: avgY, updatedAt: Date.now() })
      }
    }

    syncEngine.scheduleSync(1000)
    setShowAlignMenu(false)
  }

  // Keyboard shortcut listener (Ctrl+D duplicate, etc.)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'd') {
        e.preventDefault()
        duplicateSelectedNodes()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [duplicateSelectedNodes])

  // Clear all nodes in this canvas
  const handleClearBoard = async () => {
    if (!confirm('¿Deseas vaciar las tarjetas de este lienzo?')) return
    try {
      const currentNodes = await db.canvasNodes.where('workspaceId').equals(workspaceId).toArray()
      for (const n of currentNodes) {
        await db.canvasNodes.update(n.id, { isDeleted: true, updatedAt: Date.now() })
      }
      setDrawings([])
      setShowCanvasMenu(false)
    } catch (err) {
      console.error('Error clearing board', err)
    }
  }

  // Export Canvas to PNG
  const handleExportCanvasPNG = () => {
    const flowElement = document.querySelector('.react-flow__viewport') as HTMLElement
    if (!flowElement) return

    // Quick screenshot via canvas rasterizer
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const bbox = flowElement.getBoundingClientRect()
    canvas.width = bbox.width * 2
    canvas.height = bbox.height * 2
    ctx.scale(2, 2)

    // Dark background matching AFFiNE canvas
    ctx.fillStyle = '#121214'
    ctx.fillRect(0, 0, bbox.width, bbox.height)

    // Draw grid dots
    ctx.fillStyle = 'rgba(255, 255, 255, 0.08)'
    for (let x = 0; x < bbox.width; x += 24) {
      for (let y = 0; y < bbox.height; y += 24) {
        ctx.beginPath()
        ctx.arc(x, y, 1.5, 0, Math.PI * 2)
        ctx.fill()
      }
    }

    // Render node cards text & borders
    nodes.forEach((n) => {
      const nodeX = n.position.x
      const nodeY = n.position.y
      ctx.fillStyle = '#1e1e24'
      ctx.strokeStyle = '#3b82f6'
      ctx.lineWidth = 1.5
      ctx.beginPath()
      ctx.roundRect(nodeX, nodeY, 200, 100, 8)
      ctx.fill()
      ctx.stroke()

      ctx.fillStyle = '#ffffff'
      ctx.font = 'bold 12px sans-serif'
      ctx.fillText(String(n.data?.title || n.type || 'Card'), nodeX + 12, nodeY + 28)
      if (n.data.content) {
        ctx.font = '10px sans-serif'
        ctx.fillStyle = '#94a3b8'
        ctx.fillText(String(n.data.content).slice(0, 30), nodeX + 12, nodeY + 50)
      }
    })

    // Download PNG
    const link = document.createElement('a')
    link.download = `${currentWorkspace?.title || 'lienzo'}_edgeless.png`
    link.href = canvas.toDataURL('image/png')
    link.click()
    setShowCanvasMenu(false)
  }

  // Freehand drawing canvas handlers
  const redrawCanvas = useCallback(() => {
    const canvas = drawingCanvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    ctx.clearRect(0, 0, canvas.width, canvas.height)
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'

    for (const stroke of drawings) {
      if (stroke.points.length < 2) continue
      ctx.save()
      ctx.strokeStyle = stroke.color
      ctx.lineWidth = stroke.width
      if (stroke.isHighlighter) {
        ctx.globalAlpha = 0.4
      }
      ctx.beginPath()
      ctx.moveTo(stroke.points[0].x, stroke.points[0].y)
      for (let i = 1; i < stroke.points.length; i++) {
        ctx.lineTo(stroke.points[i].x, stroke.points[i].y)
      }
      ctx.stroke()
      ctx.restore()
    }
  }, [drawings])

  useEffect(() => {
    redrawCanvas()
  }, [redrawCanvas])

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (activeTool !== 'pencil' && activeTool !== 'highlighter' && activeTool !== 'eraser') return
    const canvas = drawingCanvasRef.current
    if (!canvas) return
    const rect = canvas.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top

    if (activeTool === 'pencil') {
      isDrawingRef.current = true
      currentStrokeRef.current = {
        color: penColor,
        width: penWidth,
        isHighlighter: false,
        points: [{ x, y }]
      }
    } else if (activeTool === 'highlighter') {
      isDrawingRef.current = true
      currentStrokeRef.current = {
        color: penColor,
        width: 14,
        isHighlighter: true,
        points: [{ x, y }]
      }
    } else if (activeTool === 'eraser') {
      setDrawings((prev) =>
        prev.filter((stroke) => {
          return !stroke.points.some((p) => Math.hypot(p.x - x, p.y - y) < 20)
        })
      )
    }
  }

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawingRef.current || !currentStrokeRef.current) return
    const canvas = drawingCanvasRef.current
    if (!canvas) return
    const rect = canvas.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top

    currentStrokeRef.current.points.push({ x, y })

    const ctx = canvas.getContext('2d')
    if (ctx) {
      ctx.save()
      ctx.strokeStyle = currentStrokeRef.current.color
      ctx.lineWidth = currentStrokeRef.current.width
      ctx.lineCap = 'round'
      ctx.lineJoin = 'round'
      if (currentStrokeRef.current.isHighlighter) {
        ctx.globalAlpha = 0.4
      }
      const pts = currentStrokeRef.current.points
      if (pts.length > 1) {
        ctx.beginPath()
        ctx.moveTo(pts[pts.length - 2].x, pts[pts.length - 2].y)
        ctx.lineTo(pts[pts.length - 1].x, pts[pts.length - 1].y)
        ctx.stroke()
      }
      ctx.restore()
    }
  }

  const handleMouseUp = () => {
    if (isDrawingRef.current && currentStrokeRef.current) {
      isDrawingRef.current = false
      setDrawings((prev) => [...prev, currentStrokeRef.current!])
      currentStrokeRef.current = null
    }
  }

  const isDrawingTool = activeTool === 'pencil' || activeTool === 'highlighter' || activeTool === 'eraser'

  return (
    <div className="relative w-full h-full bg-[#121214] overflow-hidden select-none">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeDragStop={onNodeDragStop}
        onConnect={onConnect}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={{ padding: 0.3 }}
        minZoom={0.2}
        maxZoom={2.5}
        defaultEdgeOptions={{ animated: true }}
        proOptions={{ hideAttribution: true }}
        panOnDrag={!isDrawingTool}
      >
        {/* Background Grid (Dots, Lines or None) */}
        {gridVariant !== 'none' && (
          <Background
            variant={gridVariant}
            gap={24}
            size={gridVariant === BackgroundVariant.Dots ? 1.5 : 1}
            color="rgba(255, 255, 255, 0.08)"
          />
        )}

        {showMiniMap && (
          <MiniMap
            className="!bg-[#18181b]/90 !border-[#27272a] rounded-xl shadow-2xl"
            nodeColor="#3b82f6"
            maskColor="rgba(0, 0, 0, 0.6)"
          />
        )}

        {/* Freehand Drawing Overlay */}
        <canvas
          ref={drawingCanvasRef}
          width={window.innerWidth}
          height={window.innerHeight}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          className={`absolute inset-0 z-10 ${
            activeTool === 'pencil' || activeTool === 'highlighter'
              ? 'cursor-crosshair pointer-events-auto'
              : activeTool === 'eraser'
              ? 'cursor-pointer pointer-events-auto'
              : 'pointer-events-none'
          }`}
        />

        {/* Bottom Left Floating "..." Menu Button */}
        <Panel position="bottom-left" className="ml-4 mb-4 z-20">
          <div className="relative">
            <button
              onClick={() => setShowCanvasMenu(!showCanvasMenu)}
              className="p-2 rounded-xl bg-[#1a1a1d] hover:bg-[#25252a] text-zinc-400 hover:text-zinc-100 border border-[#2b2b32] shadow-2xl transition flex items-center justify-center"
              title="Opciones del lienzo edgeless"
            >
              <MoreHorizontal size={17} />
            </button>

            {/* Canvas Menu Popover */}
            {showCanvasMenu && (
              <div
                className="absolute left-0 bottom-12 z-30 w-56 bg-[#18181b] border border-[#2b2b32] rounded-xl shadow-2xl py-1 text-xs text-zinc-300 animate-in fade-in zoom-in-95 duration-100"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="px-3 py-1 text-[10px] uppercase font-bold text-zinc-500">
                  Herramientas de Lienzo
                </div>

                <button
                  onClick={() => {
                    reactFlowInstance.zoomIn()
                    setShowCanvasMenu(false)
                  }}
                  className="w-full text-left px-3 py-1.5 hover:bg-[#25252a] flex items-center gap-2"
                >
                  <ZoomIn size={14} />
                  <span>Acercar (+)</span>
                </button>

                <button
                  onClick={() => {
                    reactFlowInstance.zoomOut()
                    setShowCanvasMenu(false)
                  }}
                  className="w-full text-left px-3 py-1.5 hover:bg-[#25252a] flex items-center gap-2"
                >
                  <ZoomOut size={14} />
                  <span>Alejar (-)</span>
                </button>

                <button
                  onClick={() => {
                    reactFlowInstance.fitView({ padding: 0.3, duration: 400 })
                    setShowCanvasMenu(false)
                  }}
                  className="w-full text-left px-3 py-1.5 hover:bg-[#25252a] flex items-center gap-2"
                >
                  <Maximize size={14} />
                  <span>Ajustar a la vista</span>
                </button>

                <button
                  onClick={() => {
                    setShowMiniMap(!showMiniMap)
                    setShowCanvasMenu(false)
                  }}
                  className="w-full text-left px-3 py-1.5 hover:bg-[#25252a] flex items-center gap-2"
                >
                  <Map size={14} />
                  <span>{showMiniMap ? 'Ocultar minimapa' : 'Mostrar minimapa'}</span>
                </button>

                <div className="border-t border-[#26262a] my-1" />

                {/* Grid variant switcher */}
                <div className="px-3 py-1 text-[10px] uppercase font-bold text-zinc-500 flex items-center gap-1.5">
                  <Grid size={11} />
                  <span>Estilo de Cuadrícula</span>
                </div>
                <div className="flex px-3 py-1 gap-1">
                  <button
                    onClick={() => setGridVariant(BackgroundVariant.Dots)}
                    className={`flex-1 py-1 rounded text-[11px] ${
                      gridVariant === BackgroundVariant.Dots ? 'bg-blue-600 text-white' : 'bg-zinc-800 text-zinc-400'
                    }`}
                  >
                    Puntos
                  </button>
                  <button
                    onClick={() => setGridVariant(BackgroundVariant.Lines)}
                    className={`flex-1 py-1 rounded text-[11px] ${
                      gridVariant === BackgroundVariant.Lines ? 'bg-blue-600 text-white' : 'bg-zinc-800 text-zinc-400'
                    }`}
                  >
                    Líneas
                  </button>
                  <button
                    onClick={() => setGridVariant('none')}
                    className={`flex-1 py-1 rounded text-[11px] ${
                      gridVariant === 'none' ? 'bg-blue-600 text-white' : 'bg-zinc-800 text-zinc-400'
                    }`}
                  >
                    Liso
                  </button>
                </div>

                <div className="border-t border-[#26262a] my-1" />

                {/* Alignment actions */}
                <button
                  onClick={() => setShowAlignMenu(!showAlignMenu)}
                  className="w-full text-left px-3 py-1.5 hover:bg-[#25252a] flex items-center justify-between"
                >
                  <div className="flex items-center gap-2">
                    <AlignJustify size={14} />
                    <span>Alinear seleccionados</span>
                  </div>
                  <span className="text-[10px] text-zinc-500">▶</span>
                </button>

                {showAlignMenu && (
                  <div className="px-3 py-1.5 bg-[#141416] space-y-1">
                    <div className="flex gap-1">
                      <button
                        onClick={() => alignSelectedNodes('left')}
                        className="p-1 rounded hover:bg-zinc-800 text-zinc-300"
                        title="Alinear a la izquierda"
                      >
                        <AlignLeft size={13} />
                      </button>
                      <button
                        onClick={() => alignSelectedNodes('center')}
                        className="p-1 rounded hover:bg-zinc-800 text-zinc-300"
                        title="Alinear al centro"
                      >
                        <AlignCenter size={13} />
                      </button>
                      <button
                        onClick={() => alignSelectedNodes('right')}
                        className="p-1 rounded hover:bg-zinc-800 text-zinc-300"
                        title="Alinear a la derecha"
                      >
                        <AlignRight size={13} />
                      </button>
                    </div>
                  </div>
                )}

                {/* Duplicate selected */}
                <button
                  onClick={duplicateSelectedNodes}
                  className="w-full text-left px-3 py-1.5 hover:bg-[#25252a] flex items-center justify-between"
                >
                  <div className="flex items-center gap-2">
                    <Copy size={14} />
                    <span>Duplicar elemento</span>
                  </div>
                  <span className="text-[10px] text-zinc-500 font-mono">Ctrl+D</span>
                </button>

                {/* Export Canvas as PNG */}
                <button
                  onClick={handleExportCanvasPNG}
                  className="w-full text-left px-3 py-1.5 hover:bg-[#25252a] flex items-center gap-2 text-indigo-400"
                >
                  <Download size={14} />
                  <span>Exportar lienzo como PNG</span>
                </button>

                <div className="border-t border-[#26262a] my-1" />

                <button
                  onClick={handleClearBoard}
                  className="w-full text-left px-3 py-1.5 hover:bg-rose-950/40 text-rose-400 flex items-center gap-2"
                >
                  <Trash2 size={14} />
                  <span>Vaciar lienzo</span>
                </button>
              </div>
            )}
          </div>
        </Panel>

        {/* Bottom Center Floating Edgeless Tool Dock */}
        <Panel position="bottom-center" className="mb-4 z-20">
          <div className="flex items-center p-1.5 rounded-2xl bg-[#19191d]/95 border border-[#2b2b32] shadow-2xl backdrop-blur-md text-zinc-300">
            {/* Zone 1: Selection & Structure Tools */}
            <div className="flex items-center gap-1 pr-2">
              {/* Tool 1: Pointer ↖^ */}
              <button
                onClick={() => setActiveTool('select')}
                className={`relative p-2 rounded-xl transition ${
                  activeTool === 'select'
                    ? 'bg-[#292930] text-blue-400 shadow-xs'
                    : 'text-zinc-400 hover:text-zinc-200 hover:bg-[#222226]'
                }`}
                title="Puntero de selección (V)"
              >
                <div className="flex items-center justify-center">
                  <MousePointer2 size={16} />
                  <span className="text-[9px] -mt-2 -mr-1 font-mono text-zinc-500">^</span>
                </div>
              </button>

              {/* Tool 2: Frame / Slide Tool (AFFiNE Frame Slide #) */}
              <button
                onClick={() => addNewNode('frame')}
                className={`relative p-2 rounded-xl transition ${
                  activeTool === 'frame'
                    ? 'bg-[#292930] text-indigo-400 shadow-xs'
                    : 'text-zinc-400 hover:text-zinc-200 hover:bg-[#222226]'
                }`}
                title="Añadir marco de diapositiva (Presentación)"
              >
                <div className="flex items-center justify-center">
                  <Hash size={16} />
                  <span className="text-[9px] -mt-2 -mr-1 font-mono text-zinc-500">^</span>
                </div>
              </button>

              {/* Tool 3: Connector line ⤴^ */}
              <button
                onClick={() => setActiveTool('connector')}
                className={`relative p-2 rounded-xl transition ${
                  activeTool === 'connector'
                    ? 'bg-[#292930] text-blue-400 shadow-xs'
                    : 'text-zinc-400 hover:text-zinc-200 hover:bg-[#222226]'
                }`}
                title="Conector de tarjetas / flecha"
              >
                <div className="flex items-center justify-center">
                  <CornerUpRight size={16} />
                  <span className="text-[9px] -mt-2 -mr-1 font-mono text-zinc-500">^</span>
                </div>
              </button>

              {/* Tool 4: Link tool 🔗 */}
              <button
                onClick={() => addNewNode('link')}
                className={`p-2 rounded-xl transition ${
                  activeTool === 'link'
                    ? 'bg-[#292930] text-blue-400 shadow-xs'
                    : 'text-zinc-400 hover:text-zinc-200 hover:bg-[#222226]'
                }`}
                title="Insertar enlace web"
              >
                <Link2 size={16} />
              </button>
            </div>

            {/* Vertical Divider */}
            <div className="w-[1px] h-7 bg-[#2d2d34] mx-1" />

            {/* Zone 2: Rich Creation & Drawing Tools */}
            <div className="flex items-center gap-1.5 pl-2 relative">
              {/* Tool 5: Floating Edgeless Text */}
              <button
                onClick={() => addNewNode('text')}
                className="p-1.5 rounded-xl transition hover:scale-105 active:scale-95 text-zinc-400 hover:text-zinc-100 hover:bg-[#222226]"
                title="Insertar texto flotante en el lienzo (T)"
              >
                <Type size={20} />
              </button>

              {/* Tool 6: Page / Doc Card Tool */}
              <button
                onClick={() => addNewNode('docframe')}
                className={`p-1.5 rounded-xl transition hover:scale-105 active:scale-95 ${
                  activeTool === 'docframe' ? 'bg-[#292930] ring-1 ring-blue-500' : 'hover:bg-[#222226]'
                }`}
                title="Crear tarjeta de página / documento"
              >
                <svg width="28" height="28" viewBox="0 0 32 32" fill="none">
                  <rect x="3" y="4" width="26" height="24" rx="4" fill="#222228" stroke="#3b3b44" strokeWidth="1.5" />
                  <rect x="7" y="8" width="10" height="12" rx="2" fill="#2a2a32" stroke="#4a4a55" strokeWidth="1" />
                  <text x="12" y="17" fill="#94a3b8" fontSize="9" fontWeight="bold" textAnchor="middle" fontFamily="sans-serif">T</text>
                  <text x="22" y="14" fill="#64748b" fontSize="7" fontWeight="bold" textAnchor="middle" fontFamily="sans-serif">H1</text>
                  <line x1="7" y1="23" x2="25" y2="23" stroke="#3b3b44" strokeWidth="1" strokeDasharray="2 2" />
                </svg>
              </button>

              {/* Tool 7: Pencil Tool */}
              <button
                onClick={() => {
                  setActiveTool(activeTool === 'pencil' ? 'select' : 'pencil')
                }}
                className={`p-1.5 rounded-xl transition hover:scale-105 active:scale-95 relative ${
                  activeTool === 'pencil' ? 'bg-[#292930] ring-1 ring-blue-500' : 'hover:bg-[#222226]'
                }`}
                title="Lápiz de dibujo libre (D)"
              >
                <svg width="28" height="28" viewBox="0 0 32 32" fill="none">
                  <path d="M16 2L19 12H13L16 2Z" fill="#1e293b" />
                  <rect x="13" y="12" width="6" height="14" fill="#e2e8f0" rx="1" />
                  <rect x="13" y="26" width="6" height="3" fill="#cbd5e1" />
                  <line x1="16" y1="12" x2="16" y2="26" stroke="#94a3b8" strokeWidth="1" />
                </svg>
              </button>

              {/* Tool 8: Highlighter Tool */}
              <button
                onClick={() => {
                  setActiveTool(activeTool === 'highlighter' ? 'select' : 'highlighter')
                }}
                className={`p-1.5 rounded-xl transition hover:scale-105 active:scale-95 ${
                  activeTool === 'highlighter' ? 'bg-[#292930] ring-1 ring-amber-500' : 'hover:bg-[#222226]'
                }`}
                title="Subrayador fluorescente"
              >
                <Highlighter size={18} className="text-amber-400" />
              </button>

              {/* Tool 9: Eraser Tool */}
              <button
                onClick={() => {
                  setActiveTool(activeTool === 'eraser' ? 'select' : 'eraser')
                }}
                className={`p-1.5 rounded-xl transition hover:scale-105 active:scale-95 ${
                  activeTool === 'eraser' ? 'bg-[#292930] ring-1 ring-blue-500' : 'hover:bg-[#222226]'
                }`}
                title="Borrador (E)"
              >
                <svg width="28" height="28" viewBox="0 0 32 32" fill="none">
                  <rect x="10" y="6" width="12" height="10" rx="2" fill="#f8fafc" />
                  <rect x="10" y="16" width="12" height="10" rx="2" fill="#0284c7" />
                  <line x1="10" y1="16" x2="22" y2="16" stroke="#0369a1" strokeWidth="1" />
                </svg>
              </button>

              {/* Tool 10: Sticky Note & Shapes Popover (AFFiNE Shapes) */}
              <div className="relative">
                <button
                  onClick={() => setShapePaletteOpen(!shapePaletteOpen)}
                  className={`p-1.5 rounded-xl transition hover:scale-105 active:scale-95 ${
                    shapePaletteOpen ? 'bg-[#292930] ring-1 ring-amber-500' : 'hover:bg-[#222226]'
                  }`}
                  title="Formas geométricas y notas adhesivas"
                >
                  <svg width="28" height="28" viewBox="0 0 32 32" fill="none">
                    <polygon points="20,7 28,24 12,24" fill="#eab308" />
                    <rect x="4" y="9" width="17" height="17" rx="3" fill="#facc15" />
                    <path d="M17 9V13H21L17 9Z" fill="#ca8a04" />
                  </svg>
                </button>

                {/* Shape & Sticky Note Selector Popover */}
                {shapePaletteOpen && (
                  <div
                    className="absolute bottom-12 left-0 z-40 bg-[#18181b] border border-[#2d2d34] rounded-2xl shadow-2xl p-3 flex flex-col gap-3 min-w-[200px] animate-in fade-in zoom-in-95 duration-100"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {/* Shapes category */}
                    <div>
                      <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block mb-1.5">
                        Formas Geométricas (AFFiNE)
                      </span>
                      <div className="grid grid-cols-3 gap-1.5">
                        <button
                          onClick={() => {
                            addNewNode('shape', { shapeType: 'rect', color: 'blue' })
                            setShapePaletteOpen(false)
                          }}
                          className="flex flex-col items-center justify-center p-2 rounded-lg bg-[#202024] hover:bg-[#282830] text-zinc-300 hover:text-white transition gap-1"
                        >
                          <Square size={16} className="text-sky-400" />
                          <span className="text-[10px]">Rect</span>
                        </button>

                        <button
                          onClick={() => {
                            addNewNode('shape', { shapeType: 'ellipse', color: 'green' })
                            setShapePaletteOpen(false)
                          }}
                          className="flex flex-col items-center justify-center p-2 rounded-lg bg-[#202024] hover:bg-[#282830] text-zinc-300 hover:text-white transition gap-1"
                        >
                          <Circle size={16} className="text-emerald-400" />
                          <span className="text-[10px]">Círculo</span>
                        </button>

                        <button
                          onClick={() => {
                            addNewNode('shape', { shapeType: 'diamond', color: 'yellow' })
                            setShapePaletteOpen(false)
                          }}
                          className="flex flex-col items-center justify-center p-2 rounded-lg bg-[#202024] hover:bg-[#282830] text-zinc-300 hover:text-white transition gap-1"
                        >
                          <Diamond size={16} className="text-amber-400" />
                          <span className="text-[10px]">Decisión</span>
                        </button>

                        <button
                          onClick={() => {
                            addNewNode('shape', { shapeType: 'triangle', color: 'purple' })
                            setShapePaletteOpen(false)
                          }}
                          className="flex flex-col items-center justify-center p-2 rounded-lg bg-[#202024] hover:bg-[#282830] text-zinc-300 hover:text-white transition gap-1"
                        >
                          <Triangle size={16} className="text-purple-400" />
                          <span className="text-[10px]">Triángulo</span>
                        </button>

                        <button
                          onClick={() => {
                            addNewNode('shape', { shapeType: 'star', color: 'yellow' })
                            setShapePaletteOpen(false)
                          }}
                          className="flex flex-col items-center justify-center p-2 rounded-lg bg-[#202024] hover:bg-[#282830] text-zinc-300 hover:text-white transition gap-1"
                        >
                          <Star size={16} className="text-amber-300" />
                          <span className="text-[10px]">Estrella</span>
                        </button>

                        <button
                          onClick={() => {
                            addNewNode('shape', { shapeType: 'roundedRect', color: 'rose' })
                            setShapePaletteOpen(false)
                          }}
                          className="flex flex-col items-center justify-center p-2 rounded-lg bg-[#202024] hover:bg-[#282830] text-zinc-300 hover:text-white transition gap-1"
                        >
                          <div className="w-4 h-3 rounded-md border border-rose-400" />
                          <span className="text-[10px]">Redondeado</span>
                        </button>
                      </div>
                    </div>

                    <div className="border-t border-[#26262a]" />

                    {/* Sticky notes */}
                    <div>
                      <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block mb-1.5">
                        Nota Adhesiva
                      </span>
                      <div className="flex gap-1.5">
                        {['yellow', 'blue', 'green', 'rose', 'purple'].map((col) => (
                          <button
                            key={col}
                            onClick={() => {
                              addNewNode('note', { color: col })
                              setShapePaletteOpen(false)
                            }}
                            className={`w-7 h-7 rounded-lg transition transform hover:scale-110 shadow-sm ${
                              col === 'yellow'
                                ? 'bg-amber-400'
                                : col === 'blue'
                                ? 'bg-sky-400'
                                : col === 'green'
                                ? 'bg-emerald-400'
                                : col === 'rose'
                                ? 'bg-rose-400'
                                : 'bg-purple-400'
                            }`}
                          />
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Tool 11: Media & Attachment */}
              <button
                onClick={() => {
                  const url = prompt(
                    'Introduce la URL de una imagen o recurso:',
                    'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=800'
                  )
                  if (url) addNewNode('image', { imageUrl: url })
                }}
                className="p-1.5 rounded-xl transition hover:scale-105 active:scale-95 hover:bg-[#222226]"
                title="Añadir imagen o adjunto"
              >
                <svg width="28" height="28" viewBox="0 0 32 32" fill="none">
                  <path
                    d="M4 10C4 8.89543 4.89543 8 6 8H12L15 11H26C27.1046 11 28 11.8954 28 13V24C28 25.1046 27.1046 26 26 26H6C4.89543 26 4 25.1046 4 24V10Z"
                    fill="#0284c7"
                  />
                  <rect x="7" y="14" width="18" height="10" rx="2" fill="#38bdf8" />
                  <path
                    d="M22 6V14C22 15.1046 21.1046 16 20 16C18.8954 16 18 15.1046 18 14V8C18 7.44772 18.4477 7 19 7C19.5523 7 20 7.44772 20 8V13"
                    stroke="#e2e8f0"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                  />
                  <text x="14" y="21" fill="#0369a1" fontSize="6" fontWeight="bold" fontFamily="sans-serif">
                    Text
                  </text>
                </svg>
              </button>

              {/* Tool 12: Kanban / Board Tool */}
              <button
                onClick={() => addNewNode('todo')}
                className="p-1.5 rounded-xl transition hover:scale-105 active:scale-95 hover:bg-[#222226]"
                title="Añadir tablero Kanban / Lista de tareas"
              >
                <svg width="28" height="28" viewBox="0 0 32 32" fill="none">
                  <rect x="3" y="6" width="26" height="20" rx="3" fill="#1e1e24" stroke="#33333d" strokeWidth="1.5" />
                  <rect x="6" y="9" width="5.5" height="4" rx="1" fill="#a855f7" />
                  <rect x="6" y="14" width="5.5" height="8" rx="1" fill="#7e22ce" />
                  <rect x="13.2" y="9" width="5.5" height="7" rx="1" fill="#eab308" />
                  <rect x="13.2" y="17" width="5.5" height="5" rx="1" fill="#ca8a04" />
                  <rect x="20.5" y="9" width="5.5" height="10" rx="1" fill="#22c55e" />
                  <rect x="20.5" y="20" width="5.5" height="2" rx="1" fill="#15803d" />
                </svg>
              </button>
            </div>
          </div>
        </Panel>

        {/* Floating Active Drawing Tool Controls Banner */}
        {isDrawingTool && (
          <Panel position="top-center" className="mt-3 z-30">
            <div className="flex items-center gap-2.5 px-3.5 py-1.5 bg-[#18181b]/95 border border-[#2b2b32] rounded-2xl shadow-2xl text-xs backdrop-blur-md">
              <span className="text-zinc-300 font-medium">
                {activeTool === 'highlighter' ? 'Subrayador:' : 'Lápiz:'}
              </span>
              <div className="flex gap-1.5 items-center">
                {['#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#ec4899', '#ffffff'].map((color) => (
                  <button
                    key={color}
                    onClick={() => setPenColor(color)}
                    className={`w-4 h-4 rounded-full transition transform hover:scale-125 ${
                      penColor === color ? 'ring-2 ring-white ring-offset-1 ring-offset-[#18181b]' : ''
                    }`}
                    style={{ backgroundColor: color }}
                  />
                ))}
              </div>

              <div className="w-[1px] h-4 bg-zinc-700 mx-1" />

              {/* Stroke width */}
              <div className="flex items-center gap-1">
                {[2, 4, 8].map((w) => (
                  <button
                    key={w}
                    onClick={() => setPenWidth(w)}
                    className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                      penWidth === w ? 'bg-blue-600 text-white' : 'text-zinc-400 hover:text-white'
                    }`}
                  >
                    {w}px
                  </button>
                ))}
              </div>

              <button
                onClick={() => setDrawings([])}
                className="ml-2 text-zinc-400 hover:text-rose-400 text-[11px]"
              >
                Limpiar trazos
              </button>
              <button
                onClick={() => setActiveTool('select')}
                className="p-1 text-zinc-400 hover:text-white ml-1"
                title="Salir del modo dibujo"
              >
                <X size={13} />
              </button>
            </div>
          </Panel>
        )}
      </ReactFlow>
    </div>
  )
}

export function CanvasBoard(props: CanvasBoardProps) {
  return (
    <ReactFlowProvider>
      <CanvasBoardInner {...props} />
    </ReactFlowProvider>
  )
}
