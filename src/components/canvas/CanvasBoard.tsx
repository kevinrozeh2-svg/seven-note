import { useCallback, useEffect, useState, useRef, memo } from 'react'
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
  useStore,
  ReactFlowProvider,
  ConnectionMode,
  MarkerType
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { useLiveQuery } from 'dexie-react-hooks'
import {
  SelectIcon,
  HandIcon,
  FrameIcon,
  StraightLineIcon,
  LinkIcon,
  PageIcon,
  ImageIcon,
  DatabaseKanbanViewIcon,
  SquareIcon,
  EllipseIcon,
  DiamondIcon,
  TriangleIcon,
  StarIcon,
  RoundedRectangleIcon,
  ZoomDownIcon,
  ZoomUpIcon,
  ExpandFullIcon,
  MapPanelIcon,
  MoreHorizontalIcon,
  AlignLeftIcon,
  AlignHorizontalCenterIcon,
  AlignRightIcon,
  DistributeHorizontalIcon,
  AlignTopIcon,
  AlignVerticalCenterIcon,
  AlignBottomIcon,
  DistributeVerticalIcon,
  CopyIcon,
  DownloadIcon,
  DeleteIcon,
  CloseIcon,
  GridIcon
} from '@blocksuite/icons/rc'
import { db, type CanvasNodeType, type WorkspaceItem } from '../../db'
import { syncEngine } from '../../lib/syncEngine'
import { TemplatesModal } from '../modals/TemplatesModal'
import { type AppTemplate } from '../../lib/templates'
import { toast } from 'sonner'
import {
  NoteSeniorWidget,
  PencilSeniorWidget,
  EraserSeniorWidget,
  ShapeSeniorWidget,
  TextSeniorWidget,
  TemplateSeniorWidget,
  MindmapSeniorWidget,
  LaserSeniorWidget
} from './dock/SeniorToolIcons'
import { DocFrameNode } from './nodes/DocFrameNode'
import { NoteNode } from './nodes/NoteNode'
import { TodoNode } from './nodes/TodoNode'
import { ImageNode } from './nodes/ImageNode'
import { LinkNode } from './nodes/LinkNode'
import { SubboardNode } from './nodes/SubboardNode'
import { ShapeNode } from './nodes/ShapeNode'
import { TextNode } from './nodes/TextNode'
import { toPng } from 'html-to-image'
import { FrameNode } from './nodes/FrameNode'
import { MindmapNode } from './nodes/MindmapNode'
import { ColorPaletteNode } from './nodes/ColorPaletteNode'
import { VoiceNoteNode } from './nodes/VoiceNoteNode'
import { FileNode } from './nodes/FileNode'
import { AudioPlayerNode } from './nodes/AudioPlayerNode'
import { TableNode } from './nodes/TableNode'
import { CommentNode } from './nodes/CommentNode'
import { MilanoteToolbar } from './dock/MilanoteToolbar'
import { UnsortedTray, type UnsortedItem } from './UnsortedTray'
import { exportToObsidianCanvas } from '../../lib/canvasExchange'

interface CanvasBoardProps {
  workspaceId: string
  currentWorkspace?: WorkspaceItem
  onSwitchToDoc?: () => void
  darkMode?: boolean
}

type ActiveTool =
  | 'select'
  | 'pan'
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
  | 'template'
  | 'mindmap'
  | 'laser'

// Static node types defined outside component to prevent re-initialization
const NODE_TYPES = {
  docframe: DocFrameNode,
  note: NoteNode,
  todo: TodoNode,
  image: ImageNode,
  link: LinkNode,
  subboard: SubboardNode,
  shape: ShapeNode,
  text: TextNode,
  frame: FrameNode,
  mindmap: MindmapNode,
  colorPalette: ColorPaletteNode,
  voiceNote: VoiceNoteNode,
  file: FileNode,
  audio: AudioPlayerNode,
  table: TableNode,
  comment: CommentNode
}

interface CanvasZoomBarProps {
  showMiniMap: boolean
  onToggleMiniMap: () => void
}

// Dedicated memoized zoom controller: isolates zoom store changes from the main board
const CanvasZoomBar = memo(function CanvasZoomBar({ showMiniMap, onToggleMiniMap }: CanvasZoomBarProps) {
  const reactFlowInstance = useReactFlow()
  const zoom = useStore((s) => s.transform[2])

  return (
    <Panel position="bottom-right" className="mr-4 mb-4 z-20">
      <div className="flex items-center gap-1 p-1 rounded-lg bg-[var(--app-bg-overlay)] border border-[var(--app-border)] shadow-[var(--app-shadow-popover)] text-[var(--app-text-primary)]">
        <button
          onClick={() => reactFlowInstance.zoomOut()}
          className="p-1.5 rounded-md hover:bg-[var(--app-hover)] text-[var(--app-text-secondary)] hover:text-[var(--app-text-primary)] transition-colors"
          title="Alejar (-)"
        >
          <ZoomDownIcon className="w-4 h-4" />
        </button>

        <button
          onClick={() => reactFlowInstance.zoomTo(1, { duration: 300 })}
          className="px-2 py-0.5 text-xs font-medium hover:bg-[var(--app-hover)] rounded-md text-[var(--app-text-primary)] transition-colors font-mono min-w-[50px] text-center"
          title="Restablecer zoom al 100%"
        >
          {Math.round((zoom || 1) * 100)}%
        </button>

        <button
          onClick={() => reactFlowInstance.zoomIn()}
          className="p-1.5 rounded-md hover:bg-[var(--app-hover)] text-[var(--app-text-secondary)] hover:text-[var(--app-text-primary)] transition-colors"
          title="Acercar (+)"
        >
          <ZoomUpIcon className="w-4 h-4" />
        </button>

        <div className="w-[1px] h-4 bg-[var(--app-divider)] mx-0.5" />

        <button
          onClick={() => reactFlowInstance.fitView({ padding: 0.25, duration: 400 })}
          className="p-1.5 rounded-md hover:bg-[var(--app-hover)] text-[var(--app-text-secondary)] hover:text-[var(--app-text-primary)] transition-colors"
          title="Ajustar a la pantalla"
        >
          <ExpandFullIcon className="w-4 h-4" />
        </button>

        <button
          onClick={onToggleMiniMap}
          className={`p-1.5 rounded-md transition-colors ${
            showMiniMap
              ? 'bg-[var(--app-hover)] text-[var(--app-accent)] font-semibold'
              : 'hover:bg-[var(--app-hover)] text-[var(--app-text-secondary)] hover:text-[var(--app-text-primary)]'
          }`}
          title={showMiniMap ? 'Ocultar minimapa' : 'Mostrar minimapa'}
        >
          <MapPanelIcon className="w-4 h-4" />
        </button>
      </div>
    </Panel>
  )
})

function CanvasBoardInner({
  workspaceId,
  currentWorkspace,
  onSwitchToDoc,
  darkMode
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
  const [noteMenuOpen, setNoteMenuOpen] = useState(false)
  const [isTemplatesOpen, setTemplatesOpen] = useState(false)
  const [penColor, setPenColor] = useState('#3b82f6')
  const [penWidth, setPenWidth] = useState(3)
  const [gridVariant, setGridVariant] = useState<BackgroundVariant | 'none'>(BackgroundVariant.Dots)

  // Connector customization state
  const [connectorRouting, setConnectorRouting] = useState<'default' | 'smoothstep' | 'straight'>('default')
  const [connectorHasArrow, setConnectorHasArrow] = useState(true)
  const [connectorColor, setConnectorColor] = useState('#3b82f6')

  // Freehand drawing canvas state
  const drawingCanvasRef = useRef<HTMLCanvasElement | null>(null)
  const imageFileInputRef = useRef<HTMLInputElement | null>(null)
  const isDrawingRef = useRef(false)
  const [drawings, setDrawings] = useState<Array<{ color: string; width: number; isHighlighter?: boolean; points: { x: number; y: number }[] }>>([])
  const currentStrokeRef = useRef<{ color: string; width: number; isHighlighter?: boolean; points: { x: number; y: number }[] } | null>(null)

  // Laser pointer animation ref
  const laserPointsRef = useRef<Array<{ x: number; y: number; time: number }>>([])
  const laserAnimFrameRef = useRef<number | null>(null)

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

  // Reconcile IndexedDB nodes to React Flow nodes preserving existing references
  useEffect(() => {
    if (!dbNodes) return

    setNodes((prevNodes) => {
      const prevMap = new Map<string, Node>(prevNodes.map((n) => [n.id, n]))
      let hasChanges = prevNodes.length !== dbNodes.length

      const nextNodes: Node[] = dbNodes.map((n) => {
        const existing = prevMap.get(n.id)
        const expectedZIndex = n.type === 'frame' ? 0 : 1

        if (!existing) {
          hasChanges = true
          return {
            id: n.id,
            type: n.type,
            position: { x: n.positionX, y: n.positionY },
            zIndex: expectedZIndex,
            data: {
              ...n.data,
              workspaceId,
              parentWorkspaceId: workspaceId,
              onOpenDoc: onSwitchToDoc
            }
          }
        }

        const posChanged =
          Math.abs(existing.position.x - n.positionX) > 0.5 ||
          Math.abs(existing.position.y - n.positionY) > 0.5
        const typeChanged = existing.type !== n.type
        const zIndexChanged = existing.zIndex !== expectedZIndex

        let dataChanged = false
        const existingData = existing.data || {}
        const nData = n.data || {}
        const existingKeys = Object.keys(existingData).filter((k) => k !== 'onOpenDoc' && k !== 'workspaceId' && k !== 'parentWorkspaceId')
        const nKeys = Object.keys(nData).filter((k) => k !== 'onOpenDoc' && k !== 'workspaceId' && k !== 'parentWorkspaceId')

        if (existingKeys.length !== nKeys.length) {
          dataChanged = true
        } else {
          for (const k of nKeys) {
            if (existingData[k] !== nData[k]) {
              dataChanged = true
              break
            }
          }
        }

        if (posChanged || typeChanged || zIndexChanged || dataChanged) {
          hasChanges = true
          return {
            ...existing,
            type: n.type,
            zIndex: expectedZIndex,
            position: { x: n.positionX, y: n.positionY },
            data: dataChanged ? {
              ...n.data,
              workspaceId,
              parentWorkspaceId: workspaceId,
              onOpenDoc: onSwitchToDoc
            } : existing.data
          }
        }

        return existing
      })

      return hasChanges ? nextNodes : prevNodes
    })
  }, [dbNodes, workspaceId, setNodes, onSwitchToDoc])

  // Reconcile IndexedDB edges to React Flow edges preserving references
  useEffect(() => {
    if (!dbEdges) return

    setEdges((prevEdges) => {
      const prevMap = new Map<string, Edge>(prevEdges.map((e) => [e.id, e]))
      let hasChanges = prevEdges.length !== dbEdges.length

      const nextEdges: Edge[] = dbEdges.map((e) => {
        const existing = prevMap.get(e.id)
        const edgeType = e.edgeType === 'smoothstep' ? 'smoothstep' : e.edgeType === 'straight' ? 'straight' : 'default'
        const color = e.color || '#3b82f6'
        const isAnimated = e.animated === true

        if (!existing) {
          hasChanges = true
          return {
            id: e.id,
            source: e.source,
            target: e.target,
            sourceHandle: e.sourceHandle || undefined,
            targetHandle: e.targetHandle || undefined,
            label: e.label,
            animated: isAnimated,
            type: edgeType,
            markerEnd: e.markerEndType !== 'none' ? { type: MarkerType.ArrowClosed, color } : undefined,
            style: { stroke: color, strokeWidth: 2 }
          }
        }

        const changed =
          existing.source !== e.source ||
          existing.target !== e.target ||
          existing.sourceHandle !== (e.sourceHandle || undefined) ||
          existing.targetHandle !== (e.targetHandle || undefined) ||
          existing.type !== edgeType ||
          existing.animated !== isAnimated ||
          existing.label !== e.label

        if (changed) {
          hasChanges = true
          return {
            ...existing,
            source: e.source,
            target: e.target,
            sourceHandle: e.sourceHandle || undefined,
            targetHandle: e.targetHandle || undefined,
            label: e.label,
            animated: isAnimated,
            type: edgeType,
            markerEnd: e.markerEndType !== 'none' ? { type: MarkerType.ArrowClosed, color } : undefined,
            style: { stroke: color, strokeWidth: 2 }
          }
        }

        return existing
      })

      return hasChanges ? nextEdges : prevEdges
    })
  }, [dbEdges, setEdges])

  // Save node position after dragging single node
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

  // Save all moved node positions after multi-selection dragging in a single transaction
  const onSelectionDragStop = useCallback(
    async (_: any, selectedNodes: Node[]) => {
      try {
        await db.transaction('rw', db.canvasNodes, async () => {
          for (const n of selectedNodes) {
            await db.canvasNodes.update(n.id, {
              positionX: n.position.x,
              positionY: n.position.y,
              updatedAt: Date.now(),
              syncStatus: 'pending'
            })
          }
        })
        syncEngine.scheduleSync(1000)
      } catch (err) {
        console.error('Failed to update selected nodes position', err)
      }
    },
    []
  )

  // Handle node deletion from canvas (Del / Backspace keys)
  const onNodesDelete = useCallback(
    async (deletedNodes: Node[]) => {
      try {
        for (const n of deletedNodes) {
          await db.canvasNodes.update(n.id, {
            isDeleted: true,
            updatedAt: Date.now(),
            syncStatus: 'pending'
          })
        }
        syncEngine.scheduleSync(1000)
      } catch (err) {
        console.error('Failed to delete nodes', err)
      }
    },
    []
  )

  // Handle edge deletion from canvas (Del / Backspace keys)
  const onEdgesDelete = useCallback(
    async (deletedEdges: Edge[]) => {
      try {
        for (const e of deletedEdges) {
          await db.canvasEdges.update(e.id, {
            isDeleted: true,
            updatedAt: Date.now(),
            syncStatus: 'pending'
          })
        }
        syncEngine.scheduleSync(1000)
      } catch (err) {
        console.error('Failed to delete edges', err)
      }
    },
    []
  )

  // Connector tool: click node A then node B to connect
  const [connectSourceNodeId, setConnectSourceNodeId] = useState<string | null>(null)

  const onNodeClick = useCallback(
    async (_: any, node: Node) => {
      if (activeTool === 'connector') {
        if (!connectSourceNodeId) {
          setConnectSourceNodeId(node.id)
        } else if (connectSourceNodeId !== node.id) {
          const newEdgeId = crypto.randomUUID()
          try {
            await db.canvasEdges.add({
              id: newEdgeId,
              workspaceId,
              source: connectSourceNodeId,
              target: node.id,
              sourceHandle: 'right',
              targetHandle: 'left',
              animated: true,
              color: connectorColor,
              edgeType: connectorRouting,
              markerEndType: connectorHasArrow ? 'arrow' : 'none',
              createdAt: Date.now(),
              updatedAt: Date.now(),
              isDeleted: false,
              syncStatus: 'pending'
            })
            syncEngine.scheduleSync(1000)
          } catch (e) {
            console.error('Failed to connect nodes', e)
          }
          setConnectSourceNodeId(null)
          setActiveTool('select')
        }
      }
    },
    [activeTool, connectSourceNodeId, workspaceId, connectorColor, connectorRouting, connectorHasArrow]
  )

  // Handle connecting cards
  const onConnect = useCallback(
    async (params: Connection) => {
      setEdges((eds) =>
        addEdge(
          {
            ...params,
            animated: true,
            type: connectorRouting === 'smoothstep' ? 'smoothstep' : connectorRouting === 'straight' ? 'straight' : 'default',
            markerEnd: connectorHasArrow ? { type: MarkerType.ArrowClosed, color: connectorColor } : undefined
          },
          eds
        )
      )

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
          color: connectorColor,
          edgeType: connectorRouting,
          markerEndType: connectorHasArrow ? 'arrow' : 'none',
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
    [setEdges, workspaceId, connectorRouting, connectorHasArrow, connectorColor]
  )

  // Quick add node of specified type
  const addNewNode = useCallback(async (type: CanvasNodeType, customData: any = {}) => {
    const newId = crypto.randomUUID()

    // Calculate viewport center if no position was provided
    let defaultPosX = 300 + Math.random() * 100
    let defaultPosY = 150 + Math.random() * 100
    try {
      const { x: viewX, y: viewY, zoom: viewZoom } = reactFlowInstance.getViewport()
      const zoomVal = viewZoom || 1
      defaultPosX = (-viewX + window.innerWidth / 2) / zoomVal - 140 + (Math.random() * 40 - 20)
      defaultPosY = (-viewY + window.innerHeight / 2) / zoomVal - 80 + (Math.random() * 40 - 20)
    } catch (_) {}

    const posX = (customData.positionX ?? defaultPosX) + (customData.offsetX || 0)
    const posY = (customData.positionY ?? defaultPosY) + (customData.offsetY || 0)

    let initialData: any = { ...customData }
    if (type === 'docframe') {
      initialData = {
        title: 'Title',
        workspaceId,
        content: ''
      }
    } else if (type === 'note') {
      initialData = {
        title: customData.title || '',
        content: customData.content || '',
        color: customData.color || 'slate',
        ...customData
      }
    } else if (type === 'file') {
      initialData = {
        fileName: customData.fileName || 'Día Actual.doc',
        fileSize: customData.fileSize || '12 KB',
        fileType: customData.fileType || 'doc',
        ...customData
      }
    } else if (type === 'audio') {
      initialData = {
        title: customData.title || 'Entrevistas de diseño',
        subtitle: customData.subtitle || '1 tarjeta, 1 archivo',
        audioFilename: customData.audioFilename || 'Entrevista a Søren Vagner.mp3',
        fileDetails: customData.fileDetails || 'Descargar • 1.0 MB',
        ...customData
      }
    } else if (type === 'table') {
      initialData = {
        title: customData.title || 'Diseños de sillas famosas',
        col1Title: customData.col1Title || 'Diseños de sillas famosas',
        col2Title: customData.col2Title || 'Date',
        headerColor: customData.headerColor || 'yellow',
        hasCheckboxes: customData.hasCheckboxes ?? false,
        rows: customData.rows || [
          { id: '1', checked: false, col1: 'Lanzamiento: Silla Wishbone de Hans J. Wegner', col2: '1949' },
          { id: '2', checked: false, col1: 'Introducción: Silla Egg de Arne Jacobsen', col2: '1958' },
          { id: '3', checked: false, col1: 'Debut de la Silla Panton de Verner Panton', col2: '1967' }
        ],
        ...customData
      }
    } else if (type === 'comment') {
      initialData = {
        commentAuthor: customData.commentAuthor || 'Natali',
        commentDate: customData.commentDate || '16 Jan 2026',
        commentText: customData.commentText || '¡Me encanta este tráiler! 💜💜',
        ...customData
      }
    } else if (type === 'subboard') {
      initialData = {
        title: customData.title || 'Ideas',
        subtitle: customData.subtitle || '2 tablas, 1 documento',
        ...customData
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
        imageUrl: customData.imageUrl ?? null,
        caption: customData.caption || 'Foto'
      }
    } else if (type === 'link') {
      initialData = {
        title: 'Enlace de referencia',
        url: 'https://affine.pro',
        description: 'Espacio de trabajo edgeless'
      }
    } else if (type === 'mindmap') {
      initialData = {
        title: customData.title || 'Idea Principal',
        isRoot: true,
        color: customData.color || 'blue',
        workspaceId
      }
    } else if (type === 'colorPalette') {
      initialData = {
        title: 'Paleta de Color',
        paletteColors: ['#6366f1', '#ec4899', '#f59e0b', '#10b981', '#3b82f6']
      }
    } else if (type === 'voiceNote') {
      initialData = {
        title: 'Nota de Voz',
        audioDuration: 0
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
  }, [workspaceId, dbNodes])

  // Helper to add editable text node centered in user's current view
  const handleAddText = useCallback(() => {
    const { x: viewX, y: viewY, zoom: viewZoom } = reactFlowInstance.getViewport()
    const zoomVal = viewZoom || 1
    const posX = (-viewX + window.innerWidth / 2) / zoomVal - 80 + (Math.random() * 40 - 20)
    const posY = (-viewY + window.innerHeight / 2) / zoomVal - 30 + (Math.random() * 40 - 20)

    addNewNode('text', {
      positionX: posX,
      positionY: posY,
      content: 'Escribe aquí tu texto...',
      color: 'white',
      fontSize: 'base'
    })
    setActiveTool('select')
  }, [addNewNode, reactFlowInstance])

  // Helper to apply complete edgeless templates (Kanban, Flowchart, Mindmap, SWOT, etc.)
  const applyTemplate = useCallback(
    async (template: AppTemplate) => {
      if (!template.nodes || template.nodes.length === 0) return

      const { x: viewX, y: viewY, zoom: viewZoom } = reactFlowInstance.getViewport()
      const zoomVal = viewZoom || 1
      const flowCenterX = (-viewX + window.innerWidth / 2) / zoomVal
      const flowCenterY = (-viewY + window.innerHeight / 2) / zoomVal

      let minX = Infinity
      let maxX = -Infinity
      let minY = Infinity
      let maxY = -Infinity

      template.nodes.forEach((n) => {
        if (n.positionX < minX) minX = n.positionX
        if (n.positionX > maxX) maxX = n.positionX
        if (n.positionY < minY) minY = n.positionY
        if (n.positionY > maxY) maxY = n.positionY
      })

      const tplWidth = maxX - minX || 400
      const tplHeight = maxY - minY || 300
      const startX = flowCenterX - tplWidth / 2
      const startY = flowCenterY - tplHeight / 2

      const now = Date.now()
      const indexToIdMap = new Map<number, string>()

      const nodesToInsert = template.nodes.map((nodeDef, idx) => {
        const id = crypto.randomUUID()
        indexToIdMap.set(idx, id)

        return {
          id,
          workspaceId,
          type: nodeDef.type,
          positionX: startX + (nodeDef.positionX - minX),
          positionY: startY + (nodeDef.positionY - minY),
          data: { ...nodeDef.data },
          createdAt: now + idx,
          updatedAt: now + idx,
          isDeleted: false,
          syncStatus: 'pending' as const
        }
      })

      await db.canvasNodes.bulkAdd(nodesToInsert)

      if (template.edges && template.edges.length > 0) {
        const edgesToInsert = template.edges
          .map((edgeDef, idx) => {
            const sourceId = indexToIdMap.get(edgeDef.sourceIndex)
            const targetId = indexToIdMap.get(edgeDef.targetIndex)
            if (!sourceId || !targetId) return null

            return {
              id: crypto.randomUUID(),
              workspaceId,
              source: sourceId,
              target: targetId,
              label: edgeDef.label || '',
              animated: true,
              color: edgeDef.color || '#1e96eb',
              createdAt: now + idx,
              updatedAt: now + idx,
              isDeleted: false,
              syncStatus: 'pending' as const
            }
          })
          .filter((e): e is NonNullable<typeof e> => e !== null)

        if (edgesToInsert.length > 0) {
          await db.canvasEdges.bulkAdd(edgesToInsert)
        }
      }

      syncEngine.scheduleSync(1000)

      setTimeout(() => {
        reactFlowInstance.fitView({ padding: 0.25, duration: 600 })
      }, 120)
    },
    [workspaceId, reactFlowInstance]
  )

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

  // Alignment helpers for selected nodes with accurate geometry
  const alignSelectedNodes = async (direction: 'left' | 'center' | 'right' | 'top' | 'middle' | 'bottom' | 'distribute-h' | 'distribute-v') => {
    const selectedNodes = nodes.filter((n) => n.selected)
    if (selectedNodes.length < 2) {
      alert('Selecciona al menos 2 elementos para alinearlos')
      return
    }

    const getNodeWidth = (n: Node) => Number(n.data?.width) || (n.type === 'frame' ? 640 : n.type === 'shape' ? 180 : 260)
    const getNodeHeight = (n: Node) => Number(n.data?.height) || (n.type === 'frame' ? 420 : n.type === 'shape' ? 120 : 160)

    if (direction === 'left') {
      const minX = Math.min(...selectedNodes.map((n) => n.position.x))
      for (const node of selectedNodes) {
        await db.canvasNodes.update(node.id, { positionX: minX, updatedAt: Date.now() })
      }
    } else if (direction === 'right') {
      const maxRight = Math.max(...selectedNodes.map((n) => n.position.x + getNodeWidth(n)))
      for (const node of selectedNodes) {
        const w = getNodeWidth(node)
        await db.canvasNodes.update(node.id, { positionX: maxRight - w, updatedAt: Date.now() })
      }
    } else if (direction === 'center') {
      const avgCenterX = selectedNodes.reduce((acc, n) => acc + (n.position.x + getNodeWidth(n) / 2), 0) / selectedNodes.length
      for (const node of selectedNodes) {
        const w = getNodeWidth(node)
        await db.canvasNodes.update(node.id, { positionX: Math.round(avgCenterX - w / 2), updatedAt: Date.now() })
      }
    } else if (direction === 'top') {
      const minY = Math.min(...selectedNodes.map((n) => n.position.y))
      for (const node of selectedNodes) {
        await db.canvasNodes.update(node.id, { positionY: minY, updatedAt: Date.now() })
      }
    } else if (direction === 'bottom') {
      const maxBottom = Math.max(...selectedNodes.map((n) => n.position.y + getNodeHeight(n)))
      for (const node of selectedNodes) {
        const h = getNodeHeight(node)
        await db.canvasNodes.update(node.id, { positionY: maxBottom - h, updatedAt: Date.now() })
      }
    } else if (direction === 'middle') {
      const avgCenterY = selectedNodes.reduce((acc, n) => acc + (n.position.y + getNodeHeight(n) / 2), 0) / selectedNodes.length
      for (const node of selectedNodes) {
        const h = getNodeHeight(node)
        await db.canvasNodes.update(node.id, { positionY: Math.round(avgCenterY - h / 2), updatedAt: Date.now() })
      }
    } else if (direction === 'distribute-h') {
      const sorted = [...selectedNodes].sort((a, b) => a.position.x - b.position.x)
      const firstX = sorted[0].position.x
      const lastX = sorted[sorted.length - 1].position.x
      const step = (lastX - firstX) / (sorted.length - 1)
      for (let i = 0; i < sorted.length; i++) {
        await db.canvasNodes.update(sorted[i].id, { positionX: Math.round(firstX + i * step), updatedAt: Date.now() })
      }
    } else if (direction === 'distribute-v') {
      const sorted = [...selectedNodes].sort((a, b) => a.position.y - b.position.y)
      const firstY = sorted[0].position.y
      const lastY = sorted[sorted.length - 1].position.y
      const step = (lastY - firstY) / (sorted.length - 1)
      for (let i = 0; i < sorted.length; i++) {
        await db.canvasNodes.update(sorted[i].id, { positionY: Math.round(firstY + i * step), updatedAt: Date.now() })
      }
    }

    syncEngine.scheduleSync(1000)
    setShowAlignMenu(false)
  }

  // Auto-layout Mindmap / Tree nodes automatically
  const handleAutoLayoutNodes = async () => {
    if (nodes.length < 2) {
      toast.info('Se necesitan al menos 2 elementos para auto-organizar')
      return
    }

    // Build hierarchy using edges
    const childMap = new Map<string, string[]>()
    const hasIncoming = new Set<string>()

    edges.forEach((edge) => {
      if (!childMap.has(edge.source)) childMap.set(edge.source, [])
      childMap.get(edge.source)!.push(edge.target)
      hasIncoming.add(edge.target)
    })

    // Roots are nodes without incoming edges, or the first node
    const roots = nodes.filter((n) => !hasIncoming.has(n.id))
    const startRoots = roots.length > 0 ? roots : [nodes[0]]

    const visited = new Set<string>()
    let currentY = 150

    const layoutSubtree = async (nodeId: string, depth: number) => {
      visited.add(nodeId)
      const posX = 150 + depth * 320
      const posY = currentY

      await db.canvasNodes.update(nodeId, {
        positionX: posX,
        positionY: posY,
        updatedAt: Date.now()
      })

      const children = (childMap.get(nodeId) || []).filter((cid) => !visited.has(cid))
      if (children.length === 0) {
        currentY += 160
      } else {
        for (const childId of children) {
          await layoutSubtree(childId, depth + 1)
        }
      }
    }

    for (const root of startRoots) {
      if (!visited.has(root.id)) {
        await layoutSubtree(root.id, 0)
        currentY += 100
      }
    }

    // Layout any disconnected remaining nodes
    for (const node of nodes) {
      if (!visited.has(node.id)) {
        await db.canvasNodes.update(node.id, {
          positionX: 150,
          positionY: currentY,
          updatedAt: Date.now()
        })
        currentY += 160
      }
    }

    syncEngine.scheduleSync(1000)
    toast.success('Auto-organización en árbol aplicada')
    setTimeout(() => {
      reactFlowInstance.fitView({ padding: 0.2, duration: 600 })
    }, 150)
  }

  // Handle photo upload from device storage (PC or mobile)
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files || files.length === 0) return

    Array.from(files).forEach((file, index) => {
      if (!file.type.startsWith('image/')) return
      const reader = new FileReader()
      reader.onload = async () => {
        const base64 = reader.result as string
        await addNewNode('image', {
          imageUrl: base64,
          caption: file.name ? file.name.replace(/\.[^/.]+$/, '') : 'Foto',
          offsetX: index * 30,
          offsetY: index * 30
        })
      }
      reader.readAsDataURL(file)
    })
    e.target.value = ''
  }

  // Handle Drag & Drop of photos/images or text from DocEditor onto the canvas
  const handleCanvasDrop = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()

    // 1. Check if dropped text from DocEditor (Heptabase / Milanote split-view drag & drop)
    const draggedText = e.dataTransfer?.getData('text/plain')
    if (draggedText && (!e.dataTransfer?.files || e.dataTransfer.files.length === 0)) {
      const bounds = e.currentTarget.getBoundingClientRect()
      const { x: viewX, y: viewY, zoom: viewZoom } = reactFlowInstance.getViewport()
      const zoomVal = viewZoom || 1
      const dropX = (e.clientX - bounds.left - viewX) / zoomVal
      const dropY = (e.clientY - bounds.top - viewY) / zoomVal

      addNewNode('note', {
        positionX: dropX,
        positionY: dropY,
        title: 'Extracto de Documento',
        content: draggedText,
        color: 'yellow'
      })
      toast.success('Texto del documento soltado como tarjeta adhesiva')
      return
    }

    // 2. Check files / images
    const files = e.dataTransfer?.files
    if (files && files.length > 0) {
      let count = 0
      Array.from(files).forEach((file) => {
        if (file.type.startsWith('image/')) {
          const reader = new FileReader()
          reader.onload = async () => {
            const base64 = reader.result as string
            await addNewNode('image', {
              imageUrl: base64,
              caption: file.name ? file.name.replace(/\.[^/.]+$/, '') : 'Foto arrastrada',
              offsetX: count * 30,
              offsetY: count * 30
            })
          }
          reader.readAsDataURL(file)
          count++
        }
      })
    }
  }

  // Handle Clipboard Paste (Ctrl+V) of images/screenshots onto canvas
  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      const target = e.target as HTMLElement
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) {
        return
      }
      const files = e.clipboardData?.files
      if (files && files.length > 0) {
        let count = 0
        Array.from(files).forEach((file) => {
          if (file.type.startsWith('image/')) {
            const reader = new FileReader()
            reader.onload = async () => {
              const base64 = reader.result as string
              await addNewNode('image', {
                imageUrl: base64,
                caption: file.name ? file.name.replace(/\.[^/.]+$/, '') : 'Captura pegada',
                offsetX: count * 30,
                offsetY: count * 30
              })
            }
            reader.readAsDataURL(file)
            count++
          }
        })
      }
    }
    window.addEventListener('paste', handlePaste)
    return () => window.removeEventListener('paste', handlePaste)
  }, [addNewNode])

  // Keyboard shortcut listener (Ctrl+D duplicate, V, T, N, S, F, C, D, H, E tools)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if user is writing inside an input or textarea
      const target = e.target as HTMLElement
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) {
        return
      }

      if (e.key === 'Escape') {
        setActiveTool('select')
        setConnectSourceNodeId(null)
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'd') {
        e.preventDefault()
        duplicateSelectedNodes()
      } else if (e.key.toLowerCase() === 'v') {
        setActiveTool('select')
      } else if (e.key.toLowerCase() === 't') {
        addNewNode('text')
      } else if (e.key.toLowerCase() === 'n') {
        addNewNode('note')
      } else if (e.key.toLowerCase() === 's') {
        addNewNode('shape', { shapeType: 'rect' })
      } else if (e.key.toLowerCase() === 'f') {
        addNewNode('frame')
      } else if (e.key.toLowerCase() === 'c') {
        setActiveTool((prev) => (prev === 'connector' ? 'select' : 'connector'))
      } else if (e.key.toLowerCase() === 'd' || e.key.toLowerCase() === 'p') {
        setActiveTool((prev) => (prev === 'pencil' ? 'select' : 'pencil'))
      } else if (e.key.toLowerCase() === 'h') {
        setActiveTool((prev) => (prev === 'highlighter' ? 'select' : 'highlighter'))
      } else if (e.key.toLowerCase() === 'e') {
        setActiveTool((prev) => (prev === 'eraser' ? 'select' : 'eraser'))
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [duplicateSelectedNodes, addNewNode])

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

  // Export Canvas to High-Res PNG using html-to-image with fallback
  const handleExportCanvasPNG = async () => {
    if (nodes.length === 0) {
      toast.info('No hay elementos en el lienzo para exportar')
      return
    }

    const flowElement = document.querySelector('.react-flow__viewport') as HTMLElement
    if (flowElement) {
      try {
        toast.info('Generando captura en alta definición...')
        const isDark = darkMode ?? document.documentElement.classList.contains('dark')
        const dataUrl = await toPng(flowElement, {
          backgroundColor: isDark ? '#191919' : '#f0f0ee',
          quality: 0.95,
          pixelRatio: 2
        })
        const link = document.createElement('a')
        link.download = `${currentWorkspace?.title || 'tablero'}_canvas_hd.png`
        link.href = dataUrl
        link.click()
        toast.success('Lienzo exportado como imagen HD')
        return
      } catch (e) {
        console.warn('html-to-image fallback to Canvas drawing:', e)
      }
    }

    const getNodeWidth = (n: Node) => Number(n.data?.width) || (n.type === 'frame' ? 640 : n.type === 'shape' ? 180 : 260)
    const getNodeHeight = (n: Node) => Number(n.data?.height) || (n.type === 'frame' ? 420 : n.type === 'shape' ? 120 : 160)

    let minX = Infinity
    let minY = Infinity
    let maxX = -Infinity
    let maxY = -Infinity

    nodes.forEach((n) => {
      const w = getNodeWidth(n)
      const h = getNodeHeight(n)
      if (n.position.x < minX) minX = n.position.x
      if (n.position.y < minY) minY = n.position.y
      if (n.position.x + w > maxX) maxX = n.position.x + w
      if (n.position.y + h > maxY) maxY = n.position.y + h
    })

    const pad = 80
    const totalW = Math.max(900, Math.ceil(maxX - minX + pad * 2))
    const totalH = Math.max(600, Math.ceil(maxY - minY + pad * 2))

    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    canvas.width = totalW * 2
    canvas.height = totalH * 2
    ctx.scale(2, 2)

    const isDarkFallback = darkMode ?? document.documentElement.classList.contains('dark')
    ctx.fillStyle = isDarkFallback ? '#191919' : '#f0f0ee'
    ctx.fillRect(0, 0, totalW, totalH)

    // Draw grid dots
    ctx.fillStyle = isDarkFallback ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.08)'
    for (let x = 0; x < totalW; x += 24) {
      for (let y = 0; y < totalH; y += 24) {
        ctx.beginPath()
        ctx.arc(x, y, 1.2, 0, Math.PI * 2)
        ctx.fill()
      }
    }

    const offsetX = pad - minX
    const offsetY = pad - minY

    // Render edges with arrowheads
    edges.forEach((e) => {
      const srcNode = nodes.find((n) => n.id === e.source)
      const tgtNode = nodes.find((n) => n.id === e.target)
      if (!srcNode || !tgtNode) return

      const x1 = srcNode.position.x + getNodeWidth(srcNode) / 2 + offsetX
      const y1 = srcNode.position.y + getNodeHeight(srcNode) / 2 + offsetY
      const x2 = tgtNode.position.x + getNodeWidth(tgtNode) / 2 + offsetX
      const y2 = tgtNode.position.y + getNodeHeight(tgtNode) / 2 + offsetY

      ctx.save()
      ctx.strokeStyle = (e.style?.stroke as string) || '#3b82f6'
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.moveTo(x1, y1)
      ctx.lineTo(x2, y2)
      ctx.stroke()

      // Arrowhead
      const angle = Math.atan2(y2 - y1, x2 - x1)
      const arrowLen = 10
      ctx.fillStyle = (e.style?.stroke as string) || '#3b82f6'
      ctx.beginPath()
      ctx.moveTo(x2, y2)
      ctx.lineTo(x2 - arrowLen * Math.cos(angle - Math.PI / 6), y2 - arrowLen * Math.sin(angle - Math.PI / 6))
      ctx.lineTo(x2 - arrowLen * Math.cos(angle + Math.PI / 6), y2 - arrowLen * Math.sin(angle + Math.PI / 6))
      ctx.closePath()
      ctx.fill()
      ctx.restore()
    })

    // Render nodes (frames first, then shapes and notes)
    const sortedNodes = [...nodes].sort((a, b) => (a.type === 'frame' ? -1 : b.type === 'frame' ? 1 : 0))
    sortedNodes.forEach((n) => {
      const nx = n.position.x + offsetX
      const ny = n.position.y + offsetY
      const nw = getNodeWidth(n)
      const nh = getNodeHeight(n)

      ctx.save()
      if (n.type === 'frame') {
        ctx.strokeStyle = '#6366f1'
        ctx.lineWidth = 1.5
        ctx.setLineDash([6, 6])
        ctx.fillStyle = 'rgba(99, 102, 241, 0.05)'
        ctx.beginPath()
        ctx.roundRect(nx, ny, nw, nh, 16)
        ctx.fill()
        ctx.stroke()

        // Frame header pill
        ctx.setLineDash([])
        ctx.fillStyle = '#1e1e24'
        ctx.beginPath()
        ctx.roundRect(nx + 12, ny - 12, 140, 24, 12)
        ctx.fill()
        ctx.fillStyle = '#a5b4fc'
        ctx.font = 'bold 10px sans-serif'
        ctx.fillText(String(n.data?.title || 'Diapositiva'), nx + 24, ny + 4)
      } else if (n.type === 'shape') {
        const shapeType = n.data?.shapeType || 'rect'
        ctx.fillStyle = '#1e1e24'
        ctx.strokeStyle = '#38bdf8'
        ctx.lineWidth = 2

        if (shapeType === 'ellipse') {
          ctx.beginPath()
          ctx.ellipse(nx + nw / 2, ny + nh / 2, nw / 2, nh / 2, 0, 0, Math.PI * 2)
          ctx.fill()
          ctx.stroke()
        } else if (shapeType === 'diamond') {
          ctx.beginPath()
          ctx.moveTo(nx + nw / 2, ny)
          ctx.lineTo(nx + nw, ny + nh / 2)
          ctx.lineTo(nx + nw / 2, ny + nh)
          ctx.lineTo(nx, ny + nh / 2)
          ctx.closePath()
          ctx.fill()
          ctx.stroke()
        } else if (shapeType === 'triangle') {
          ctx.beginPath()
          ctx.moveTo(nx + nw / 2, ny)
          ctx.lineTo(nx + nw, ny + nh)
          ctx.lineTo(nx, ny + nh)
          ctx.closePath()
          ctx.fill()
          ctx.stroke()
        } else {
          ctx.beginPath()
          ctx.roundRect(nx, ny, nw, nh, 8)
          ctx.fill()
          ctx.stroke()
        }

        if (n.data?.content) {
          ctx.fillStyle = '#f1f5f9'
          ctx.font = '11px sans-serif'
          ctx.textAlign = 'center'
          ctx.fillText(String(n.data.content).slice(0, 25), nx + nw / 2, ny + nh / 2 + 4)
        }
      } else {
        // Note or Card
        ctx.fillStyle = '#1c1c22'
        ctx.strokeStyle = '#3b82f6'
        ctx.lineWidth = 1.5
        ctx.beginPath()
        ctx.roundRect(nx, ny, nw, nh, 12)
        ctx.fill()
        ctx.stroke()

        ctx.fillStyle = '#ffffff'
        ctx.font = 'bold 12px sans-serif'
        ctx.textAlign = 'left'
        ctx.fillText(String(n.data?.title || n.type || 'Card'), nx + 12, ny + 26)
        if (n.data?.content) {
          ctx.font = '10px sans-serif'
          ctx.fillStyle = '#94a3b8'
          ctx.fillText(String(n.data.content).slice(0, 36), nx + 12, ny + 46)
        }
      }
      ctx.restore()
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

  const isErasingRef = useRef(false)

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
      isErasingRef.current = true
      setDrawings((prev) =>
        prev.filter((stroke) => {
          return !stroke.points.some((p) => Math.hypot(p.x - x, p.y - y) < 24)
        })
      )
    }
  }

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (activeTool === 'laser') {
      const canvas = drawingCanvasRef.current
      if (!canvas) return
      const rect = canvas.getBoundingClientRect()
      const x = e.clientX - rect.left
      const y = e.clientY - rect.top
      laserPointsRef.current.push({ x, y, time: Date.now() })
      return
    }

    if (activeTool === 'eraser' && isErasingRef.current) {
      const canvas = drawingCanvasRef.current
      if (!canvas) return
      const rect = canvas.getBoundingClientRect()
      const x = e.clientX - rect.left
      const y = e.clientY - rect.top
      setDrawings((prev) =>
        prev.filter((stroke) => {
          return !stroke.points.some((p) => Math.hypot(p.x - x, p.y - y) < 24)
        })
      )
      return
    }

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

  // Laser Pointer Animation Loop
  useEffect(() => {
    if (activeTool !== 'laser') {
      if (laserAnimFrameRef.current) cancelAnimationFrame(laserAnimFrameRef.current)
      laserPointsRef.current = []
      redrawCanvas()
      return
    }

    const renderLaser = () => {
      const canvas = drawingCanvasRef.current
      if (!canvas) return
      const ctx = canvas.getContext('2d')
      if (!ctx) return

      const now = Date.now()
      laserPointsRef.current = laserPointsRef.current.filter((pt) => now - pt.time < 900)

      redrawCanvas()

      const points = laserPointsRef.current
      if (points.length > 1) {
        for (let i = 1; i < points.length; i++) {
          const p1 = points[i - 1]
          const p2 = points[i]
          const age = now - p2.time
          const alpha = Math.max(0, 1 - age / 900)

          ctx.save()
          ctx.strokeStyle = `rgba(244, 63, 94, ${alpha})`
          ctx.lineWidth = 5 * alpha + 1.5
          ctx.lineCap = 'round'
          ctx.shadowBlur = 12
          ctx.shadowColor = `rgba(244, 63, 94, ${alpha})`
          ctx.beginPath()
          ctx.moveTo(p1.x, p1.y)
          ctx.lineTo(p2.x, p2.y)
          ctx.stroke()
          ctx.restore()
        }

        const head = points[points.length - 1]
        ctx.save()
        ctx.fillStyle = '#f43f5e'
        ctx.shadowBlur = 16
        ctx.shadowColor = '#f43f5e'
        ctx.beginPath()
        ctx.arc(head.x, head.y, 6, 0, Math.PI * 2)
        ctx.fill()
        ctx.fillStyle = '#ffffff'
        ctx.beginPath()
        ctx.arc(head.x, head.y, 2.5, 0, Math.PI * 2)
        ctx.fill()
        ctx.restore()
      }

      laserAnimFrameRef.current = requestAnimationFrame(renderLaser)
    }

    laserAnimFrameRef.current = requestAnimationFrame(renderLaser)

    return () => {
      if (laserAnimFrameRef.current) cancelAnimationFrame(laserAnimFrameRef.current)
    }
  }, [activeTool, redrawCanvas])

  const handleMouseUp = () => {
    isErasingRef.current = false
    if (isDrawingRef.current && currentStrokeRef.current) {
      isDrawingRef.current = false
      setDrawings((prev) => [...prev, currentStrokeRef.current!])
      currentStrokeRef.current = null
    }
  }

  // Global window mouseup listener so dragging off-canvas or over a panel releases drawing/erasing cleanly
  useEffect(() => {
    const handleGlobalMouseUp = () => {
      isErasingRef.current = false
      if (isDrawingRef.current && currentStrokeRef.current) {
        isDrawingRef.current = false
        setDrawings((prev) => [...prev, currentStrokeRef.current!])
        currentStrokeRef.current = null
      }
    }
    window.addEventListener('mouseup', handleGlobalMouseUp)
    return () => window.removeEventListener('mouseup', handleGlobalMouseUp)
  }, [])

  const isDrawingTool = activeTool === 'pencil' || activeTool === 'highlighter' || activeTool === 'eraser'
  const [isUnsortedOpen, setIsUnsortedOpen] = useState(false)

  useEffect(() => {
    const handleToggle = () => setIsUnsortedOpen((prev) => !prev)
    window.addEventListener('seven-note-toggle-unsorted', handleToggle)
    return () => window.removeEventListener('seven-note-toggle-unsorted', handleToggle)
  }, [])

  return (
    <div
      className="relative w-full h-full bg-[var(--app-bg-canvas)] overflow-hidden select-none"
      onDragOver={(e) => e.preventDefault()}
      onDrop={handleCanvasDrop}
    >
      <ReactFlow
        colorMode={darkMode ? 'dark' : 'light'}
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeDragStop={onNodeDragStop}
        onSelectionDragStop={onSelectionDragStop}
        onNodesDelete={onNodesDelete}
        onEdgesDelete={onEdgesDelete}
        onNodeClick={onNodeClick}
        onConnect={onConnect}
        nodeTypes={NODE_TYPES}
        connectionMode={ConnectionMode.Loose}
        fitView
        fitViewOptions={{ padding: 0.3 }}
        minZoom={0.2}
        maxZoom={2.5}
        onlyRenderVisibleElements={true}
        elevateNodesOnSelect={false}
        elevateEdgesOnSelect={false}
        defaultEdgeOptions={{
          animated: false,
          markerEnd: { type: MarkerType.ArrowClosed, color: '#3b82f6' },
          style: { stroke: '#3b82f6', strokeWidth: 2 }
        }}
        proOptions={{ hideAttribution: true }}
        nodeDragThreshold={8}
        panOnDrag={activeTool === 'pan' ? true : !isDrawingTool}
        nodesDraggable={activeTool !== 'pan' && !isDrawingTool}
        selectionOnDrag={activeTool === 'select'}
      >
        {/* Background Grid (Dots, Lines or None) */}
        {gridVariant !== 'none' && (
          <Background
            variant={gridVariant}
            gap={24}
            size={gridVariant === BackgroundVariant.Dots ? 1.5 : 1}
            color="var(--app-canvas-dot)"
          />
        )}

        {showMiniMap && (
          <MiniMap
            className="!bg-[var(--app-bg-overlay)] !border-[var(--app-border)] rounded-lg shadow-[var(--app-shadow-popover)]"
            nodeColor="var(--app-accent)"
            maskColor="rgba(0, 0, 0, 0.3)"
          />
        )}

        {/* Freehand Drawing Overlay */}
        {(drawings.length > 0 || isDrawingTool || activeTool === 'laser') && (
          <canvas
            ref={drawingCanvasRef}
            width={window.innerWidth}
            height={window.innerHeight}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            className={`absolute inset-0 z-10 ${
              activeTool === 'pencil' || activeTool === 'highlighter' || activeTool === 'laser'
                ? 'cursor-crosshair pointer-events-auto'
                : activeTool === 'eraser'
                ? 'cursor-pointer pointer-events-auto'
                : 'pointer-events-none'
            }`}
          />
        )}

        {/* Milanote Left Tool Palette (Iconic Draggable Dock) */}
        <Panel position="top-left" className="ml-3 mt-3 z-30">
          <MilanoteToolbar
            onAddNode={addNewNode}
            onToggleTool={(t: string) => setActiveTool(activeTool === t ? 'select' : (t as any))}
            activeTool={activeTool}
            onOpenTemplates={() => setTemplatesOpen(true)}
            onUploadImage={() => imageFileInputRef.current?.click()}
          />
        </Panel>

        {/* Bottom Left Floating "..." Menu Button */}
        <Panel position="bottom-left" className="ml-4 mb-4 z-20">
          <div className="relative">
            <button
              onClick={() => setShowCanvasMenu(!showCanvasMenu)}
              className="p-2.5 rounded-xl bg-[var(--affine-background-overlay-panel-color)] hover:bg-[var(--affine-hover-color)] text-[var(--affine-text-secondary-color)] hover:text-[var(--affine-text-primary-color)] border border-[var(--affine-border-color)] shadow-[var(--affine-toolbar-shadow)] transition flex items-center justify-center backdrop-blur-md"
              title="Opciones del lienzo edgeless"
            >
              <MoreHorizontalIcon className="w-5 h-5" />
            </button>

            {/* Canvas Menu Popover */}
            {showCanvasMenu && (
              <div
                className="absolute left-0 bottom-12 z-30 w-56 bg-[var(--affine-background-overlay-panel-color)] border border-[var(--affine-border-color)] rounded-xl shadow-[var(--affine-popover-shadow)] py-1.5 text-xs text-[var(--affine-text-primary-color)] backdrop-blur-md animate-in fade-in zoom-in-95 duration-100"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="px-3 py-1 text-[11px] font-semibold text-[var(--affine-text-secondary-color)]">
                  Herramientas de Lienzo
                </div>

                <button
                  onClick={() => {
                    reactFlowInstance.zoomIn()
                    setShowCanvasMenu(false)
                  }}
                  className="w-full text-left px-3 py-1.5 hover:bg-[var(--affine-hover-color)] flex items-center gap-2 transition"
                >
                  <ZoomUpIcon className="w-4 h-4 text-[var(--affine-text-secondary-color)]" />
                  <span>Acercar (+)</span>
                </button>

                <button
                  onClick={() => {
                    reactFlowInstance.zoomOut()
                    setShowCanvasMenu(false)
                  }}
                  className="w-full text-left px-3 py-1.5 hover:bg-[var(--affine-hover-color)] flex items-center gap-2 transition"
                >
                  <ZoomDownIcon className="w-4 h-4 text-[var(--affine-text-secondary-color)]" />
                  <span>Alejar (-)</span>
                </button>

                <button
                  onClick={() => {
                    reactFlowInstance.fitView({ padding: 0.3, duration: 400 })
                    setShowCanvasMenu(false)
                  }}
                  className="w-full text-left px-3 py-1.5 hover:bg-[var(--affine-hover-color)] flex items-center gap-2 transition"
                >
                  <ExpandFullIcon className="w-4 h-4 text-[var(--affine-text-secondary-color)]" />
                  <span>Ajustar a la vista</span>
                </button>

                <button
                  onClick={() => {
                    setShowMiniMap(!showMiniMap)
                    setShowCanvasMenu(false)
                  }}
                  className="w-full text-left px-3 py-1.5 hover:bg-[var(--affine-hover-color)] flex items-center gap-2 transition"
                >
                  <MapPanelIcon className="w-4 h-4 text-[var(--affine-text-secondary-color)]" />
                  <span>{showMiniMap ? 'Ocultar minimapa' : 'Mostrar minimapa'}</span>
                </button>

                <div className="border-t border-[var(--affine-divider-color)] my-1" />

                {/* Grid variant switcher */}
                <div className="px-3 py-1 text-[11px] font-semibold text-[var(--affine-text-secondary-color)] flex items-center gap-1.5">
                  <GridIcon className="w-3.5 h-3.5" />
                  <span>Estilo de Cuadrícula</span>
                </div>
                <div className="flex px-3 py-1 gap-1">
                  <button
                    onClick={() => setGridVariant(BackgroundVariant.Dots)}
                    className={`flex-1 py-1 rounded text-[11px] font-medium transition ${
                      gridVariant === BackgroundVariant.Dots
                        ? 'bg-[#1e96eb] text-white'
                        : 'bg-[var(--affine-hover-color)] text-[var(--affine-text-secondary-color)] hover:text-[var(--affine-text-primary-color)]'
                    }`}
                  >
                    Puntos
                  </button>
                  <button
                    onClick={() => setGridVariant(BackgroundVariant.Lines)}
                    className={`flex-1 py-1 rounded text-[11px] font-medium transition ${
                      gridVariant === BackgroundVariant.Lines
                        ? 'bg-[#1e96eb] text-white'
                        : 'bg-[var(--affine-hover-color)] text-[var(--affine-text-secondary-color)] hover:text-[var(--affine-text-primary-color)]'
                    }`}
                  >
                    Líneas
                  </button>
                  <button
                    onClick={() => setGridVariant('none')}
                    className={`flex-1 py-1 rounded text-[11px] font-medium transition ${
                      gridVariant === 'none'
                        ? 'bg-[#1e96eb] text-white'
                        : 'bg-[var(--affine-hover-color)] text-[var(--affine-text-secondary-color)] hover:text-[var(--affine-text-primary-color)]'
                    }`}
                  >
                    Liso
                  </button>
                </div>

                <div className="border-t border-[var(--affine-divider-color)] my-1" />

                {/* Alignment actions */}
                <button
                  onClick={() => setShowAlignMenu(!showAlignMenu)}
                  className="w-full text-left px-3 py-1.5 hover:bg-[var(--affine-hover-color)] flex items-center justify-between transition"
                >
                  <div className="flex items-center gap-2">
                    <AlignLeftIcon className="w-4 h-4 text-[var(--affine-text-secondary-color)]" />
                    <span>Alinear seleccionados</span>
                  </div>
                  <span className="text-[10px] text-[var(--affine-text-secondary-color)]">▶</span>
                </button>

                {showAlignMenu && (
                  <div className="px-3 py-2 bg-[var(--affine-background-secondary-color)] space-y-2 border-y border-[var(--affine-divider-color)]">
                    <div>
                      <span className="text-[10px] text-[var(--affine-text-secondary-color)] uppercase font-semibold block mb-1">Horizontal</span>
                      <div className="flex gap-1">
                        <button
                          onClick={() => alignSelectedNodes('left')}
                          className="flex-1 p-1 rounded bg-[var(--affine-background-primary-color)] hover:bg-[var(--affine-hover-color)] text-[var(--affine-text-primary-color)] text-[10px] flex items-center justify-center border border-[var(--affine-border-color)]"
                          title="Alinear a la izquierda"
                        >
                          <AlignLeftIcon className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => alignSelectedNodes('center')}
                          className="flex-1 p-1 rounded bg-[var(--affine-background-primary-color)] hover:bg-[var(--affine-hover-color)] text-[var(--affine-text-primary-color)] text-[10px] flex items-center justify-center border border-[var(--affine-border-color)]"
                          title="Alinear al centro"
                        >
                          <AlignHorizontalCenterIcon className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => alignSelectedNodes('right')}
                          className="flex-1 p-1 rounded bg-[var(--affine-background-primary-color)] hover:bg-[var(--affine-hover-color)] text-[var(--affine-text-primary-color)] text-[10px] flex items-center justify-center border border-[var(--affine-border-color)]"
                          title="Alinear a la derecha"
                        >
                          <AlignRightIcon className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => alignSelectedNodes('distribute-h')}
                          className="flex-1 p-1 rounded bg-[var(--affine-background-primary-color)] hover:bg-[var(--affine-hover-color)] text-[var(--affine-text-primary-color)] text-[10px] flex items-center justify-center border border-[var(--affine-border-color)]"
                          title="Distribuir horizontalmente"
                        >
                          <DistributeHorizontalIcon className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                    <div>
                      <span className="text-[10px] text-[var(--affine-text-secondary-color)] uppercase font-semibold block mb-1">Vertical</span>
                      <div className="flex gap-1">
                        <button
                          onClick={() => alignSelectedNodes('top')}
                          className="flex-1 p-1 rounded bg-[var(--affine-background-primary-color)] hover:bg-[var(--affine-hover-color)] text-[var(--affine-text-primary-color)] text-[10px] flex items-center justify-center border border-[var(--affine-border-color)]"
                          title="Alinear arriba"
                        >
                          <AlignTopIcon className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => alignSelectedNodes('middle')}
                          className="flex-1 p-1 rounded bg-[var(--affine-background-primary-color)] hover:bg-[var(--affine-hover-color)] text-[var(--affine-text-primary-color)] text-[10px] flex items-center justify-center border border-[var(--affine-border-color)]"
                          title="Alinear al medio"
                        >
                          <AlignVerticalCenterIcon className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => alignSelectedNodes('bottom')}
                          className="flex-1 p-1 rounded bg-[var(--affine-background-primary-color)] hover:bg-[var(--affine-hover-color)] text-[var(--affine-text-primary-color)] text-[10px] flex items-center justify-center border border-[var(--affine-border-color)]"
                          title="Alinear abajo"
                        >
                          <AlignBottomIcon className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => alignSelectedNodes('distribute-v')}
                          className="flex-1 p-1 rounded bg-[var(--affine-background-primary-color)] hover:bg-[var(--affine-hover-color)] text-[var(--affine-text-primary-color)] text-[10px] flex items-center justify-center border border-[var(--affine-border-color)]"
                          title="Distribuir verticalmente"
                        >
                          <DistributeVerticalIcon className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* Auto layout mindmap / tree */}
                <button
                  onClick={handleAutoLayoutNodes}
                  className="w-full text-left px-3 py-1.5 hover:bg-[var(--affine-hover-color)] flex items-center justify-between transition"
                >
                  <div className="flex items-center gap-2">
                    <DatabaseKanbanViewIcon className="w-4 h-4 text-[#1e96eb]" />
                    <span>Auto-organizar diagrama</span>
                  </div>
                  <span className="text-[10px] text-emerald-500 font-semibold">Árbol</span>
                </button>

                {/* Duplicate selected */}
                <button
                  onClick={duplicateSelectedNodes}
                  className="w-full text-left px-3 py-1.5 hover:bg-[var(--affine-hover-color)] flex items-center justify-between transition"
                >
                  <div className="flex items-center gap-2">
                    <CopyIcon className="w-4 h-4 text-[var(--affine-text-secondary-color)]" />
                    <span>Duplicar elemento</span>
                  </div>
                  <span className="text-[10px] text-[var(--affine-text-secondary-color)] font-mono">Ctrl+D</span>
                </button>

                {/* Milanote special cards */}
                <button
                  onClick={() => addNewNode('colorPalette')}
                  className="w-full text-left px-3 py-1.5 hover:bg-[var(--affine-hover-color)] flex items-center gap-2 text-indigo-500 transition"
                >
                  <span>🎨</span>
                  <span>Añadir Paleta de Color (Milanote)</span>
                </button>
                <button
                  onClick={() => addNewNode('voiceNote')}
                  className="w-full text-left px-3 py-1.5 hover:bg-[var(--affine-hover-color)] flex items-center gap-2 text-rose-500 transition"
                >
                  <span>🎙️</span>
                  <span>Añadir Nota de Voz Offline</span>
                </button>

                {/* Obsidian Canvas Import / Export */}
                <button
                  onClick={() => exportToObsidianCanvas(workspaceId, currentWorkspace?.title || 'canvas')}
                  className="w-full text-left px-3 py-1.5 hover:bg-[var(--affine-hover-color)] flex items-center gap-2 text-purple-400 transition"
                >
                  <DownloadIcon className="w-4 h-4" />
                  <span>Exportar Obsidian .canvas</span>
                </button>

                {/* Export Canvas as PNG */}
                <button
                  onClick={handleExportCanvasPNG}
                  className="w-full text-left px-3 py-1.5 hover:bg-[var(--affine-hover-color)] flex items-center gap-2 text-[#1e96eb] transition"
                >
                  <DownloadIcon className="w-4 h-4" />
                  <span>Exportar lienzo como PNG</span>
                </button>

                <div className="border-t border-[var(--affine-divider-color)] my-1" />

                <button
                  onClick={handleClearBoard}
                  className="w-full text-left px-3 py-1.5 hover:bg-rose-500/10 text-rose-500 flex items-center gap-2 transition"
                >
                  <DeleteIcon className="w-4 h-4" />
                  <span>Vaciar lienzo</span>
                </button>
              </div>
            )}
          </div>
        </Panel>

        {/* Bottom Right Floating Zoom Controller (Isolated Reactivity) */}
        <CanvasZoomBar
          showMiniMap={showMiniMap}
          onToggleMiniMap={() => setShowMiniMap((prev) => !prev)}
        />

        {/* Bottom Center Floating Edgeless Tool Dock (Milanote Physical Palette) */}
        <Panel position="bottom-center" className="mb-4 z-20">
          <div className="flex items-center p-1 rounded-xl bg-[var(--app-bg-overlay)] border border-[var(--app-border)] shadow-[var(--app-shadow-dock)] text-[var(--app-text-primary)] h-14 select-none">
            {/* Quick Tools (Left Section: 32px buttons) */}
            <div className="flex items-center gap-0.5 pr-1">
              {/* Tool 1: Pointer / Select */}
              <button
                onClick={() => {
                  setActiveTool('select')
                  setShapePaletteOpen(false)
                  setNoteMenuOpen(false)
                }}
                className={`p-2 rounded-lg transition ${
                  activeTool === 'select'
                    ? 'bg-[var(--app-accent)] text-white shadow-xs'
                    : 'text-[var(--app-text-secondary)] hover:text-[var(--app-text-primary)] hover:bg-[var(--app-hover)]'
                }`}
                title="Puntero de selección (V)"
              >
                <SelectIcon className="w-4.5 h-4.5" />
              </button>

              {/* Tool 2: Hand / Pan */}
              <button
                onClick={() => {
                  setActiveTool(activeTool === 'pan' ? 'select' : 'pan')
                  setShapePaletteOpen(false)
                  setNoteMenuOpen(false)
                }}
                className={`p-2 rounded-lg transition ${
                  activeTool === 'pan'
                    ? 'bg-[var(--app-accent)] text-white shadow-xs'
                    : 'text-[var(--app-text-secondary)] hover:text-[var(--app-text-primary)] hover:bg-[var(--app-hover)]'
                }`}
                title="Mano de desplazamiento (Pan / H)"
              >
                <HandIcon className="w-4.5 h-4.5" />
              </button>

              {/* Tool 3: Frame / Presentation Frame Tool */}
              <button
                onClick={() => {
                  addNewNode('frame')
                  setShapePaletteOpen(false)
                  setNoteMenuOpen(false)
                }}
                className={`p-2 rounded-xl transition ${
                  activeTool === 'frame'
                    ? 'bg-[#1e96eb] text-white shadow-xs'
                    : 'text-[var(--affine-text-secondary-color)] hover:text-[var(--affine-text-primary-color)] hover:bg-[var(--affine-hover-color)]'
                }`}
                title="Añadir marco de presentación (Frame / #)"
              >
                <FrameIcon className="w-5 h-5" />
              </button>

              {/* Tool 4: Connector line / Arrow */}
              <button
                onClick={() => {
                  setActiveTool(activeTool === 'connector' ? 'select' : 'connector')
                  setShapePaletteOpen(false)
                  setNoteMenuOpen(false)
                }}
                className={`p-2 rounded-xl transition ${
                  activeTool === 'connector'
                    ? 'bg-[#1e96eb] text-white shadow-xs'
                    : 'text-[var(--affine-text-secondary-color)] hover:text-[var(--affine-text-primary-color)] hover:bg-[var(--affine-hover-color)]'
                }`}
                title="Conector de tarjetas / flecha (C)"
              >
                <StraightLineIcon className="w-5 h-5" />
              </button>

              {/* Tool 5: Link tool */}
              <button
                onClick={() => {
                  addNewNode('link')
                  setShapePaletteOpen(false)
                  setNoteMenuOpen(false)
                }}
                className={`p-2 rounded-xl transition ${
                  activeTool === 'link'
                    ? 'bg-[#1e96eb] text-white shadow-xs'
                    : 'text-[var(--affine-text-secondary-color)] hover:text-[var(--affine-text-primary-color)] hover:bg-[var(--affine-hover-color)]'
                }`}
                title="Insertar enlace web (Link)"
              >
                <LinkIcon className="w-5 h-5" />
              </button>
            </div>

            {/* Vertical Divider */}
            <div className="w-[1px] h-8 bg-[var(--affine-divider-color)] mx-1" />

            {/* Senior Tools (Right Section: Illustrated 3D Widgets with Hover Animations) */}
            <div className="flex items-center gap-1.5 pl-1 relative">
              {/* Senior Tool 1: Notes (Sticky Notes, Page Cards, Kanban) */}
              <div className="relative">
                <button
                  onClick={() => {
                    setNoteMenuOpen(!noteMenuOpen)
                    setShapePaletteOpen(false)
                  }}
                  className="rounded-xl transition flex items-center justify-center"
                  title="Notas adhesivas y tarjetas (N)"
                >
                  <NoteSeniorWidget isActive={noteMenuOpen} />
                </button>

                {/* Note Options Popover */}
                {noteMenuOpen && (
                  <div
                    className="absolute bottom-16 left-1/2 -translate-x-1/2 z-40 bg-[var(--affine-background-overlay-panel-color)] border border-[var(--affine-border-color)] rounded-2xl shadow-[var(--affine-popover-shadow)] p-3 flex flex-col gap-3 min-w-[240px] backdrop-blur-md animate-in fade-in zoom-in-95 duration-100"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div>
                      <span className="text-[11px] font-semibold text-[var(--affine-text-secondary-color)] block mb-1.5">
                        Nota Adhesiva (AFFiNE)
                      </span>
                      <div className="flex gap-2 justify-center">
                        {[
                          { name: 'yellow', bg: 'bg-[#ffeb7a] hover:ring-2 ring-amber-400', label: 'Amarillo' },
                          { name: 'blue', bg: 'bg-[#91d5ff] hover:ring-2 ring-blue-400', label: 'Azul' },
                          { name: 'green', bg: 'bg-[#b7eb8f] hover:ring-2 ring-emerald-400', label: 'Verde' },
                          { name: 'rose', bg: 'bg-[#ffadd2] hover:ring-2 ring-pink-400', label: 'Rosa' },
                          { name: 'purple', bg: 'bg-[#d3adf7] hover:ring-2 ring-purple-400', label: 'Morado' }
                        ].map((col) => (
                          <button
                            key={col.name}
                            onClick={() => {
                              addNewNode('note', { color: col.name })
                              setNoteMenuOpen(false)
                            }}
                            className={`w-7 h-7 rounded-lg transition transform hover:scale-110 shadow-sm ${col.bg}`}
                            title={`Nota ${col.label}`}
                          />
                        ))}
                      </div>
                    </div>

                    <div className="border-t border-[var(--affine-divider-color)]" />

                    <div className="flex flex-col gap-1">
                      <button
                        onClick={() => {
                          addNewNode('docframe')
                          setNoteMenuOpen(false)
                        }}
                        className="flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg hover:bg-[var(--affine-hover-color)] text-xs text-left text-[var(--affine-text-primary-color)] transition"
                      >
                        <PageIcon className="w-4 h-4 text-[#1e96eb]" />
                        <span>Tarjeta de Documento / Página</span>
                      </button>

                      <button
                        onClick={() => {
                          addNewNode('todo')
                          setNoteMenuOpen(false)
                        }}
                        className="flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg hover:bg-[var(--affine-hover-color)] text-xs text-left text-[var(--affine-text-primary-color)] transition"
                      >
                        <DatabaseKanbanViewIcon className="w-4 h-4 text-emerald-500" />
                        <span>Tablero de Tareas / Kanban</span>
                      </button>

                      <button
                        onClick={() => {
                          imageFileInputRef.current?.click()
                          setNoteMenuOpen(false)
                        }}
                        className="flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg hover:bg-[var(--affine-hover-color)] text-xs text-left text-[var(--affine-text-primary-color)] transition"
                      >
                        <ImageIcon className="w-4 h-4 text-purple-500" />
                        <span>Subir Imagen o Foto</span>
                      </button>

                      <button
                        onClick={() => {
                          addNewNode('colorPalette')
                          setNoteMenuOpen(false)
                        }}
                        className="flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg hover:bg-[var(--affine-hover-color)] text-xs text-left text-[var(--affine-text-primary-color)] transition"
                      >
                        <span className="text-sm">🎨</span>
                        <span>Paleta de Color (Milanote)</span>
                      </button>

                      <button
                        onClick={() => {
                          addNewNode('voiceNote')
                          setNoteMenuOpen(false)
                        }}
                        className="flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg hover:bg-[var(--affine-hover-color)] text-xs text-left text-[var(--affine-text-primary-color)] transition"
                      >
                        <span className="text-sm">🎙️</span>
                        <span>Nota de Voz Offline</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Senior Tool 2: Pencil Tool */}
              <button
                onClick={() => {
                  setActiveTool(activeTool === 'pencil' ? 'select' : 'pencil')
                  setShapePaletteOpen(false)
                  setNoteMenuOpen(false)
                }}
                className="rounded-xl transition flex items-center justify-center"
                title="Lápiz de dibujo libre (Pencil / D)"
              >
                <PencilSeniorWidget isActive={activeTool === 'pencil'} />
              </button>

              {/* Senior Tool 3: Eraser Tool */}
              <button
                onClick={() => {
                  setActiveTool(activeTool === 'eraser' ? 'select' : 'eraser')
                  setShapePaletteOpen(false)
                  setNoteMenuOpen(false)
                }}
                className="rounded-xl transition flex items-center justify-center"
                title="Borrador de trazos (Eraser / E)"
              >
                <EraserSeniorWidget isActive={activeTool === 'eraser'} />
              </button>

              {/* Senior Tool 4: Shapes Tool */}
              <div className="relative">
                <button
                  onClick={() => {
                    setShapePaletteOpen(!shapePaletteOpen)
                    setNoteMenuOpen(false)
                  }}
                  className="rounded-xl transition flex items-center justify-center"
                  title="Formas geométricas (Shapes / S)"
                >
                  <ShapeSeniorWidget isActive={shapePaletteOpen} />
                </button>

                {/* Shape Selector Popover */}
                {shapePaletteOpen && (
                  <div
                    className="absolute bottom-16 left-1/2 -translate-x-1/2 z-40 bg-[var(--affine-background-overlay-panel-color)] border border-[var(--affine-border-color)] rounded-2xl shadow-[var(--affine-popover-shadow)] p-3 flex flex-col gap-3 min-w-[230px] backdrop-blur-md animate-in fade-in zoom-in-95 duration-100"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div>
                      <span className="text-[11px] font-semibold text-[var(--affine-text-secondary-color)] block mb-1.5">
                        Formas Geométricas (AFFiNE)
                      </span>
                      <div className="grid grid-cols-3 gap-1.5">
                        <button
                          onClick={() => {
                            addNewNode('shape', { shapeType: 'rect', color: 'blue' })
                            setShapePaletteOpen(false)
                          }}
                          className="flex flex-col items-center justify-center p-2 rounded-lg bg-[var(--affine-hover-color)] hover:bg-[var(--affine-background-tertiary-color)] text-[var(--affine-text-primary-color)] transition gap-1"
                        >
                          <SquareIcon className="w-4 h-4 text-[#1e96eb]" />
                          <span className="text-[10px]">Rect</span>
                        </button>

                        <button
                          onClick={() => {
                            addNewNode('shape', { shapeType: 'ellipse', color: 'green' })
                            setShapePaletteOpen(false)
                          }}
                          className="flex flex-col items-center justify-center p-2 rounded-lg bg-[var(--affine-hover-color)] hover:bg-[var(--affine-background-tertiary-color)] text-[var(--affine-text-primary-color)] transition gap-1"
                        >
                          <EllipseIcon className="w-4 h-4 text-emerald-500" />
                          <span className="text-[10px]">Círculo</span>
                        </button>

                        <button
                          onClick={() => {
                            addNewNode('shape', { shapeType: 'diamond', color: 'yellow' })
                            setShapePaletteOpen(false)
                          }}
                          className="flex flex-col items-center justify-center p-2 rounded-lg bg-[var(--affine-hover-color)] hover:bg-[var(--affine-background-tertiary-color)] text-[var(--affine-text-primary-color)] transition gap-1"
                        >
                          <DiamondIcon className="w-4 h-4 text-amber-500" />
                          <span className="text-[10px]">Rombo</span>
                        </button>

                        <button
                          onClick={() => {
                            addNewNode('shape', { shapeType: 'triangle', color: 'purple' })
                            setShapePaletteOpen(false)
                          }}
                          className="flex flex-col items-center justify-center p-2 rounded-lg bg-[var(--affine-hover-color)] hover:bg-[var(--affine-background-tertiary-color)] text-[var(--affine-text-primary-color)] transition gap-1"
                        >
                          <TriangleIcon className="w-4 h-4 text-purple-500" />
                          <span className="text-[10px]">Triángulo</span>
                        </button>

                        <button
                          onClick={() => {
                            addNewNode('shape', { shapeType: 'star', color: 'yellow' })
                            setShapePaletteOpen(false)
                          }}
                          className="flex flex-col items-center justify-center p-2 rounded-lg bg-[var(--affine-hover-color)] hover:bg-[var(--affine-background-tertiary-color)] text-[var(--affine-text-primary-color)] transition gap-1"
                        >
                          <StarIcon className="w-4 h-4 text-yellow-500" />
                          <span className="text-[10px]">Estrella</span>
                        </button>

                        <button
                          onClick={() => {
                            addNewNode('shape', { shapeType: 'roundedRect', color: 'rose' })
                            setShapePaletteOpen(false)
                          }}
                          className="flex flex-col items-center justify-center p-2 rounded-lg bg-[var(--affine-hover-color)] hover:bg-[var(--affine-background-tertiary-color)] text-[var(--affine-text-primary-color)] transition gap-1"
                        >
                          <RoundedRectangleIcon className="w-4 h-4 text-rose-500" />
                          <span className="text-[10px]">Redondo</span>
                        </button>

                        <button
                          onClick={() => {
                            addNewNode('shape', { shapeType: 'cylinder', color: 'blue' })
                            setShapePaletteOpen(false)
                          }}
                          className="flex flex-col items-center justify-center p-2 rounded-lg bg-[var(--affine-hover-color)] hover:bg-[var(--affine-background-tertiary-color)] text-[var(--affine-text-primary-color)] transition gap-1"
                        >
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#1e96eb" strokeWidth="2">
                            <path d="M4 6c0 1.66 3.58 3 8 3s8-1.34 8-3" />
                            <ellipse cx="12" cy="6" rx="8" ry="3" />
                            <path d="M4 6v12c0 1.66 3.58 3 8 3s8-1.34 8-3V6" />
                          </svg>
                          <span className="text-[10px]">Cilindro</span>
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Senior Tool 5: Text Tool (Click drops editable text card) */}
              <button
                onClick={() => {
                  handleAddText()
                  setShapePaletteOpen(false)
                  setNoteMenuOpen(false)
                }}
                className="rounded-xl transition flex items-center justify-center"
                title="Insertar texto flotante en el lienzo (Text / T)"
              >
                <TextSeniorWidget isActive={activeTool === 'text'} />
              </button>

              {/* Senior Tool 6: Mindmap Tool */}
              <button
                onClick={() => {
                  addNewNode('mindmap')
                  setShapePaletteOpen(false)
                  setNoteMenuOpen(false)
                }}
                className="rounded-xl transition flex items-center justify-center"
                title="Mapa mental / Mindmap interactivo (M)"
              >
                <MindmapSeniorWidget isActive={activeTool === 'mindmap'} />
              </button>

              {/* Senior Tool 7: Laser Pointer */}
              <button
                onClick={() => {
                  setActiveTool(activeTool === 'laser' ? 'select' : 'laser')
                  setShapePaletteOpen(false)
                  setNoteMenuOpen(false)
                }}
                className="rounded-xl transition flex items-center justify-center"
                title="Puntero láser de presentación (L)"
              >
                <LaserSeniorWidget isActive={activeTool === 'laser'} />
              </button>

              {/* Senior Tool 8: Templates Tool (Click opens Templates Gallery Modal) */}
              <button
                onClick={() => {
                  setTemplatesOpen(true)
                  setShapePaletteOpen(false)
                  setNoteMenuOpen(false)
                }}
                className="rounded-xl transition flex items-center justify-center"
                title="Galería de plantillas edgeless (Templates)"
              >
                <TemplateSeniorWidget isActive={isTemplatesOpen} />
              </button>

              <input
                type="file"
                ref={imageFileInputRef}
                onChange={handleImageUpload}
                accept="image/*"
                multiple
                className="hidden"
              />
            </div>
          </div>
        </Panel>

        {/* Templates Gallery Modal (AFFiNE Edgeless Templates) */}
        <TemplatesModal
          isOpen={isTemplatesOpen}
          defaultCategory="Tableros Edgeless"
          onClose={() => setTemplatesOpen(false)}
          onSelectTemplate={(tpl) => {
            applyTemplate(tpl)
            setTemplatesOpen(false)
          }}
        />

        {/* Floating Multi-Selection Alignment Toolbar */}
        {nodes.filter((n) => n.selected).length >= 2 && (
          <Panel position="top-center" className="mt-3 z-30">
            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-[var(--affine-background-overlay-panel-color)] border border-[var(--affine-border-color)] rounded-2xl shadow-[var(--affine-toolbar-shadow)] text-xs backdrop-blur-md text-[var(--affine-text-primary-color)] animate-in fade-in zoom-in-95 duration-100">
              <span className="text-[11px] font-semibold text-[var(--affine-text-secondary-color)] mr-1">
                {nodes.filter((n) => n.selected).length} seleccionados:
              </span>

              {/* Horizontal alignments */}
              <button
                onClick={() => alignSelectedNodes('left')}
                className="p-1 rounded hover:bg-[var(--affine-hover-color)] transition text-[var(--affine-text-secondary-color)] hover:text-[#1e96eb]"
                title="Alinear a la izquierda"
              >
                <AlignLeftIcon className="w-4 h-4" />
              </button>
              <button
                onClick={() => alignSelectedNodes('center')}
                className="p-1 rounded hover:bg-[var(--affine-hover-color)] transition text-[var(--affine-text-secondary-color)] hover:text-[#1e96eb]"
                title="Centrar horizontalmente"
              >
                <AlignHorizontalCenterIcon className="w-4 h-4" />
              </button>
              <button
                onClick={() => alignSelectedNodes('right')}
                className="p-1 rounded hover:bg-[var(--affine-hover-color)] transition text-[var(--affine-text-secondary-color)] hover:text-[#1e96eb]"
                title="Alinear a la derecha"
              >
                <AlignRightIcon className="w-4 h-4" />
              </button>
              <button
                onClick={() => alignSelectedNodes('distribute-h')}
                className="p-1 rounded hover:bg-[var(--affine-hover-color)] transition text-[var(--affine-text-secondary-color)] hover:text-[#1e96eb]"
                title="Distribuir horizontalmente"
              >
                <DistributeHorizontalIcon className="w-4 h-4" />
              </button>

              <div className="w-[1px] h-3.5 bg-[var(--affine-divider-color)] mx-0.5" />

              {/* Vertical alignments */}
              <button
                onClick={() => alignSelectedNodes('top')}
                className="p-1 rounded hover:bg-[var(--affine-hover-color)] transition text-[var(--affine-text-secondary-color)] hover:text-[#1e96eb]"
                title="Alinear arriba"
              >
                <AlignTopIcon className="w-4 h-4" />
              </button>
              <button
                onClick={() => alignSelectedNodes('middle')}
                className="p-1 rounded hover:bg-[var(--affine-hover-color)] transition text-[var(--affine-text-secondary-color)] hover:text-[#1e96eb]"
                title="Centrar verticalmente"
              >
                <AlignVerticalCenterIcon className="w-4 h-4" />
              </button>
              <button
                onClick={() => alignSelectedNodes('bottom')}
                className="p-1 rounded hover:bg-[var(--affine-hover-color)] transition text-[var(--affine-text-secondary-color)] hover:text-[#1e96eb]"
                title="Alinear abajo"
              >
                <AlignBottomIcon className="w-4 h-4" />
              </button>
              <button
                onClick={() => alignSelectedNodes('distribute-v')}
                className="p-1 rounded hover:bg-[var(--affine-hover-color)] transition text-[var(--affine-text-secondary-color)] hover:text-[#1e96eb]"
                title="Distribuir verticalmente"
              >
                <DistributeVerticalIcon className="w-4 h-4" />
              </button>
            </div>
          </Panel>
        )}

        {/* Floating Active Connector Tool Banner */}
        {activeTool === 'connector' && (
          <Panel position="top-center" className="mt-3 z-30">
            <div className="flex items-center gap-2.5 px-3.5 py-1.5 bg-[var(--affine-background-overlay-panel-color)] border border-[#1e96eb]/50 rounded-2xl shadow-[var(--affine-toolbar-shadow)] text-xs backdrop-blur-md text-[var(--affine-text-primary-color)]">
              <StraightLineIcon className="w-4 h-4 text-[#1e96eb]" />
              <span>
                {connectSourceNodeId
                  ? 'Haz clic en la tarjeta destino'
                  : 'Haz clic en origen o arrastra desde un conector'}
              </span>

              <div className="w-[1px] h-3.5 bg-[var(--affine-divider-color)] mx-0.5" />

              {/* Connector routing toggle */}
              <div className="flex items-center gap-1 bg-[var(--affine-background-secondary-color)] p-0.5 rounded-lg border border-[var(--affine-border-color)]">
                <button
                  onClick={() => setConnectorRouting('default')}
                  className={`px-2 py-0.5 rounded text-[10px] font-medium transition ${
                    connectorRouting === 'default' ? 'bg-[#1e96eb] text-white' : 'text-[var(--affine-text-secondary-color)] hover:text-[var(--affine-text-primary-color)]'
                  }`}
                  title="Línea curva Bézier"
                >
                  Curva
                </button>
                <button
                  onClick={() => setConnectorRouting('smoothstep')}
                  className={`px-2 py-0.5 rounded text-[10px] font-medium transition ${
                    connectorRouting === 'smoothstep' ? 'bg-[#1e96eb] text-white' : 'text-[var(--affine-text-secondary-color)] hover:text-[var(--affine-text-primary-color)]'
                  }`}
                  title="Línea ortogonal escalonada"
                >
                  Escalón
                </button>
                <button
                  onClick={() => setConnectorRouting('straight')}
                  className={`px-2 py-0.5 rounded text-[10px] font-medium transition ${
                    connectorRouting === 'straight' ? 'bg-[#1e96eb] text-white' : 'text-[var(--affine-text-secondary-color)] hover:text-[var(--affine-text-primary-color)]'
                  }`}
                  title="Línea recta"
                >
                  Recta
                </button>
              </div>

              {/* Arrow toggle */}
              <button
                onClick={() => setConnectorHasArrow(!connectorHasArrow)}
                className={`px-2 py-0.5 rounded text-[10px] font-medium border transition ${
                  connectorHasArrow
                    ? 'bg-[#1e96eb]/10 border-[#1e96eb] text-[#1e96eb]'
                    : 'border-[var(--affine-border-color)] text-[var(--affine-text-secondary-color)]'
                }`}
                title="Alternar punta de flecha"
              >
                {connectorHasArrow ? 'Con flecha ➔' : 'Sin flecha —'}
              </button>

              {/* Connector color */}
              <div className="flex gap-1 items-center">
                {['#3b82f6', '#10b981', '#f59e0b', '#ec4899', '#8b5cf6', '#ffffff'].map((c) => (
                  <button
                    key={c}
                    onClick={() => setConnectorColor(c)}
                    className={`w-3.5 h-3.5 rounded-full ${connectorColor === c ? 'ring-2 ring-[#1e96eb]' : ''}`}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>

              <button
                onClick={() => {
                  setActiveTool('select')
                  setConnectSourceNodeId(null)
                }}
                className="p-1 text-[var(--affine-text-secondary-color)] hover:text-[var(--affine-text-primary-color)] ml-1 rounded hover:bg-[var(--affine-hover-color)] transition"
                title="Cancelar conector"
              >
                <CloseIcon className="w-3.5 h-3.5" />
              </button>
            </div>
          </Panel>
        )}

        {/* Floating Active Laser Pointer Banner */}
        {activeTool === 'laser' && (
          <Panel position="top-center" className="mt-3 z-30">
            <div className="flex items-center gap-2 px-3.5 py-1.5 bg-rose-950/40 border border-rose-500/60 rounded-2xl shadow-[var(--affine-toolbar-shadow)] text-xs backdrop-blur-md text-rose-200 animate-in fade-in duration-100">
              <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-ping mr-1" />
              <span className="font-semibold text-white">Puntero Láser Activo</span>
              <span className="text-[11px] text-rose-200/80">
                — Arrastra o mueve el cursor para trazar halos luminosos que desaparecen solos
              </span>
              <button
                onClick={() => setActiveTool('select')}
                className="p-1 text-rose-300 hover:text-white ml-2 rounded hover:bg-rose-500/20 transition"
                title="Salir del modo láser"
              >
                <CloseIcon className="w-3.5 h-3.5" />
              </button>
            </div>
          </Panel>
        )}

        {/* Floating Active Drawing Tool Controls Banner */}
        {isDrawingTool && (
          <Panel position="top-center" className="mt-3 z-30">
            <div className="flex items-center gap-2.5 px-3.5 py-1.5 bg-[var(--affine-background-overlay-panel-color)] border border-[var(--affine-border-color)] rounded-2xl shadow-[var(--affine-toolbar-shadow)] text-xs backdrop-blur-md text-[var(--affine-text-primary-color)]">
              {activeTool === 'eraser' ? (
                <>
                  <span className="text-base leading-none">🧹</span>
                  <span className="font-semibold text-amber-500">Borrador Activo</span>
                  <span className="text-[11px] text-[var(--affine-text-secondary-color)]">
                    — Haz clic o arrastra sobre los trazos para eliminarlos
                  </span>
                </>
              ) : (
                <>
                  <span className="font-medium text-[var(--affine-text-secondary-color)]">
                    {activeTool === 'highlighter' ? 'Subrayador:' : 'Lápiz:'}
                  </span>
                  <div className="flex gap-1.5 items-center">
                    {['#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#ec4899', '#ffffff'].map((color) => (
                      <button
                        key={color}
                        onClick={() => setPenColor(color)}
                        className={`w-4 h-4 rounded-full transition transform hover:scale-125 ${
                          penColor === color ? 'ring-2 ring-[#1e96eb] ring-offset-1 ring-offset-[var(--affine-background-primary-color)]' : ''
                        }`}
                        style={{ backgroundColor: color }}
                      />
                    ))}
                  </div>

                  <div className="w-[1px] h-4 bg-[var(--affine-divider-color)] mx-1" />

                  {/* Stroke width */}
                  <div className="flex items-center gap-1">
                    {[2, 4, 8].map((w) => (
                      <button
                        key={w}
                        onClick={() => setPenWidth(w)}
                        className={`px-1.5 py-0.5 rounded text-[10px] font-bold transition ${
                          penWidth === w
                            ? 'bg-[#1e96eb] text-white'
                            : 'text-[var(--affine-text-secondary-color)] hover:text-[var(--affine-text-primary-color)] hover:bg-[var(--affine-hover-color)]'
                        }`}
                      >
                        {w}px
                      </button>
                    ))}
                  </div>
                </>
              )}

              <button
                onClick={() => setDrawings([])}
                className="ml-2 text-[var(--affine-text-secondary-color)] hover:text-rose-500 text-[11px] font-medium transition"
              >
                Limpiar todo
              </button>
              <button
                onClick={() => setActiveTool('select')}
                className="flex items-center gap-1 px-2 py-0.5 text-xs rounded-lg bg-[var(--affine-hover-color)] text-[var(--affine-text-primary-color)] hover:bg-rose-500 hover:text-white transition ml-1 font-medium"
                title="Salir del modo (Esc)"
              >
                <span>Salir</span>
                <span className="text-[10px] opacity-70 font-mono">(Esc)</span>
              </button>
            </div>
          </Panel>
        )}
      </ReactFlow>

      {/* Milanote Unsorted Drawer */}
      <UnsortedTray
        isOpen={isUnsortedOpen}
        onClose={() => setIsUnsortedOpen(false)}
        onDropItemToCanvas={(item: UnsortedItem) => addNewNode(item.type as any, { title: item.title, content: item.content })}
        count={3}
      />
    </div>
  )
}

const MemoizedCanvasBoardInner = memo(CanvasBoardInner)

export function CanvasBoard(props: CanvasBoardProps) {
  return (
    <ReactFlowProvider>
      <MemoizedCanvasBoardInner {...props} />
    </ReactFlowProvider>
  )
}
