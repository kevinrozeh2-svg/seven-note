import { useCallback, useEffect, useState, useRef, memo } from 'react'
import {
  ReactFlow,
  Background,
  MiniMap,
  BackgroundVariant,
  useNodesState,
  useEdgesState,
  type Connection,
  type Edge,
  type Node,
  Panel,
  useReactFlow,
  useStore,
  ReactFlowProvider,
  ConnectionMode,
  MarkerType,
  ConnectionLineType,
  ViewportPortal
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { useLiveQuery } from 'dexie-react-hooks'
import {
  DotsThree,
  MagnifyingGlassPlus,
  MagnifyingGlassMinus,
  ArrowsOutSimple,
  MapTrifold,
  GridFour,
  AlignLeft,
  AlignCenterHorizontal,
  AlignRight,
  Columns,
  AlignTop,
  AlignCenterVertical,
  AlignBottom,
  Rows,
  TreeStructure,
  Copy,
  Palette,
  DownloadSimple,
  Image as PhosphorImage,
  Trash,
  CaretRight,
  X,
  Kanban
} from '@phosphor-icons/react'
import {
  hasHtmlFormatting,
  cleanPastedHtml,
  isPdfHtml,
  isPdfOrStructuredText,
  isLegalContractOrPdfText,
  cleanPdfContent
} from '../../lib/pasteUtils'
import {
  SelectIcon,
  HandIcon,
  FrameIcon,
  StraightLineIcon,
  LinkIcon,
  PageIcon,
  ImageIcon,
  SquareIcon,
  EllipseIcon,
  DiamondIcon,
  TriangleIcon,
  StarIcon,
  RoundedRectangleIcon
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
import { TableNode } from './nodes/TableNode'
import { CommentNode } from './nodes/CommentNode'
import { MilanoteToolbar } from './dock/MilanoteToolbar'
import { CardEditToolbar } from './CardEditToolbar'
import { UnsortedTray, type UnsortedItem } from './UnsortedTray'
import { exportToObsidianCanvas } from '../../lib/canvasExchange'
import { processAndUploadImage } from '../../lib/imageOptimizer'

interface CanvasBoardProps {
  workspaceId: string
  currentWorkspace?: WorkspaceItem
  onSwitchToDoc?: () => void
  darkMode?: boolean
  hideChrome?: boolean
  readOnly?: boolean
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
    <Panel position="bottom-right" className="mr-2 sm:mr-3 mb-2 sm:mb-4 z-20">
      <div className="flex items-center gap-0.5 px-1.5 py-1 rounded-full bg-white/85 dark:bg-[#1a1b1e]/85 backdrop-blur-xl border border-black/[0.08] dark:border-white/[0.1] shadow-2xl text-[var(--app-text-primary)]">
        <button
          onClick={() => reactFlowInstance.zoomOut()}
          className="p-1.5 rounded-full hover:bg-black/5 dark:hover:bg-white/10 text-neutral-600 dark:text-neutral-300 transition-all active:scale-95 cursor-pointer"
          title="Alejar (-)"
        >
          <MagnifyingGlassMinus size={15} weight="duotone" />
        </button>

        <button
          onClick={() => reactFlowInstance.zoomTo(1, { duration: 300 })}
          className="px-2 py-0.5 text-[11px] font-semibold hover:bg-black/5 dark:hover:bg-white/10 rounded-full text-neutral-700 dark:text-neutral-200 transition-all font-mono min-w-[44px] text-center active:scale-95 cursor-pointer"
          title="Restablecer zoom al 100%"
        >
          {Math.round((zoom || 1) * 100)}%
        </button>

        <button
          onClick={() => reactFlowInstance.zoomIn()}
          className="p-1.5 rounded-full hover:bg-black/5 dark:hover:bg-white/10 text-neutral-600 dark:text-neutral-300 transition-all active:scale-95 cursor-pointer"
          title="Acercar (+)"
        >
          <MagnifyingGlassPlus size={15} weight="duotone" />
        </button>

        <div className="w-[1px] h-4 bg-black/[0.08] dark:bg-white/[0.1] mx-0.5" />

        <button
          onClick={() => reactFlowInstance.fitView({ padding: 0.25, duration: 400 })}
          className="p-1.5 rounded-full hover:bg-black/5 dark:hover:bg-white/10 text-neutral-600 dark:text-neutral-300 transition-all active:scale-95 cursor-pointer"
          title="Ajustar a la pantalla"
        >
          <ArrowsOutSimple size={15} weight="duotone" />
        </button>

        <button
          onClick={onToggleMiniMap}
          className={`p-1.5 rounded-full transition-all active:scale-95 cursor-pointer ${
            showMiniMap
              ? 'bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 shadow-xs font-semibold'
              : 'hover:bg-black/5 dark:hover:bg-white/10 text-neutral-600 dark:text-neutral-300'
          }`}
          title={showMiniMap ? 'Ocultar minimapa' : 'Mostrar minimapa'}
        >
          <MapTrifold size={15} weight="duotone" />
        </button>
      </div>
    </Panel>
  )
})

// Helper to convert flow-coordinate points into a smooth SVG path
function getSvgPathFromPoints(points: { x: number; y: number }[]): string {
  if (!points || points.length === 0) return ''
  if (points.length === 1) {
    return `M ${points[0].x} ${points[0].y} L ${points[0].x + 0.1} ${points[0].y + 0.1}`
  }
  if (points.length === 2) {
    return `M ${points[0].x} ${points[0].y} L ${points[1].x} ${points[1].y}`
  }

  let d = `M ${points[0].x} ${points[0].y}`
  for (let i = 1; i < points.length - 1; i++) {
    const p0 = points[i]
    const p1 = points[i + 1]
    const midX = (p0.x + p1.x) / 2
    const midY = (p0.y + p1.y) / 2
    d += ` Q ${p0.x} ${p0.y}, ${midX} ${midY}`
  }
  const last = points[points.length - 1]
  d += ` L ${last.x} ${last.y}`
  return d
}

function CanvasBoardInner({
  workspaceId,
  currentWorkspace,
  onSwitchToDoc,
  darkMode,
  hideChrome,
  readOnly = false
}: CanvasBoardProps) {
  const reactFlowInstance = useReactFlow()

  // Query nodes and edges reactively from Dexie (excluding legacy simulated file/audio nodes)
  const dbNodes = useLiveQuery(
    () =>
      db.canvasNodes
        .where('workspaceId')
        .equals(workspaceId)
        .and((n) => !n.isDeleted && (n as any).type !== 'file' && (n as any).type !== 'audio' && (n as any).type !== 'voiceNote')
        .toArray(),
    [workspaceId]
  )

  // Auto-cleanup any legacy simulated file, audio or voice nodes from Dexie DB
  useEffect(() => {
    db.canvasNodes
      .where('workspaceId')
      .equals(workspaceId)
      .and((n) => (n as any).type === 'file' || (n as any).type === 'audio' || (n as any).type === 'voiceNote')
      .delete()
      .catch(() => {})
  }, [workspaceId])

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
  const [gridVariant, setGridVariant] = useState<BackgroundVariant | 'none'>(() => {
    const saved =
      currentWorkspace?.canvasGridVariant ||
      (workspaceId && localStorage.getItem(`seven-note-canvas-grid-${workspaceId}`)) ||
      localStorage.getItem('seven-note-canvas-grid')
    if (saved === 'lines') return BackgroundVariant.Lines
    if (saved === 'none') return 'none'
    return BackgroundVariant.Dots
  })

  useEffect(() => {
    if (currentWorkspace?.canvasGridVariant) {
      if (currentWorkspace.canvasGridVariant === 'lines') setGridVariant(BackgroundVariant.Lines)
      else if (currentWorkspace.canvasGridVariant === 'none') setGridVariant('none')
      else setGridVariant(BackgroundVariant.Dots)
    }
  }, [currentWorkspace?.canvasGridVariant])

  const handleSetGridVariant = async (variant: BackgroundVariant | 'none') => {
    setGridVariant(variant)
    const val: 'dots' | 'lines' | 'none' =
      variant === BackgroundVariant.Lines ? 'lines' : variant === 'none' ? 'none' : 'dots'
    if (workspaceId) {
      localStorage.setItem(`seven-note-canvas-grid-${workspaceId}`, val)
    }
    localStorage.setItem('seven-note-canvas-grid', val)
    window.dispatchEvent(
      new CustomEvent('seven-note-grid-changed', {
        detail: { grid: val, workspaceId }
      })
    )
    if (workspaceId) {
      try {
        await db.workspaces.update(workspaceId, {
          canvasGridVariant: val,
          updatedAt: Date.now(),
          syncStatus: 'pending'
        })
        syncEngine.scheduleSync(1200)
      } catch (err) {
        console.error('Error saving grid variant', err)
      }
    }
  }

  // Connector customization state
  const [connectorRouting, setConnectorRouting] = useState<'default' | 'smoothstep' | 'straight'>('default')
  const [connectorHasArrow, setConnectorHasArrow] = useState(true)
  const [connectorColor, setConnectorColor] = useState('#3b82f6')
  const [connectSourceNodeId, setConnectSourceNodeId] = useState<string | null>(null)

  // Freehand drawing state (vectorial inside React Flow ViewportPortal)
  const imageFileInputRef = useRef<HTMLInputElement | null>(null)
  const isDrawingRef = useRef(false)
  const isErasingRef = useRef(false)
  const activePathRef = useRef<SVGPathElement | null>(null)
  const laserCanvasRef = useRef<HTMLCanvasElement | null>(null)
  const [drawings, setDrawings] = useState<
    Array<{ color: string; width: number; isHighlighter?: boolean; points: { x: number; y: number }[] }>
  >(() => {
    if (!workspaceId) return []
    try {
      const saved = localStorage.getItem(`seven-note-canvas-drawings-${workspaceId}`)
      return saved ? JSON.parse(saved) : []
    } catch {
      return []
    }
  })
  const currentStrokeRef = useRef<{
    color: string
    width: number
    isHighlighter?: boolean
    points: { x: number; y: number }[]
  } | null>(null)

  // Synchronize drawings with current workspaceId
  useEffect(() => {
    if (!workspaceId) return
    try {
      const saved = localStorage.getItem(`seven-note-canvas-drawings-${workspaceId}`)
      setDrawings(saved ? JSON.parse(saved) : [])
    } catch {
      setDrawings([])
    }
  }, [workspaceId])

  // Persist drawings to localStorage
  useEffect(() => {
    if (!workspaceId) return
    try {
      localStorage.setItem(`seven-note-canvas-drawings-${workspaceId}`, JSON.stringify(drawings))
    } catch (e) {
      console.error('Error saving canvas drawings', e)
    }
  }, [drawings, workspaceId])

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

      const isConnectorActive = activeTool === 'connector'

      const nextNodes: Node[] = dbNodes.map((n) => {
        const existing = prevMap.get(n.id)
        const isLocked = Boolean(n.data?.isLocked)
        const expectedZIndex = typeof existing?.zIndex === 'number' && existing.zIndex !== 1 ? existing.zIndex : (n.data?.zIndex ?? (n.type === 'frame' ? 0 : 1))
        const isConnectSource = connectSourceNodeId === n.id

        if (!existing) {
          hasChanges = true
          return {
            id: n.id,
            type: n.type,
            position: { x: n.positionX, y: n.positionY },
            zIndex: expectedZIndex,
            draggable: !isLocked,
            data: {
              ...n.data,
              workspaceId,
              parentWorkspaceId: workspaceId,
              onOpenDoc: onSwitchToDoc,
              isConnectorActive,
              isConnectSource
            }
          }
        }

        const posChanged =
          Math.abs(existing.position.x - n.positionX) > 0.5 ||
          Math.abs(existing.position.y - n.positionY) > 0.5
        const typeChanged = existing.type !== n.type
        const zIndexChanged = existing.zIndex !== expectedZIndex
        const lockChanged = existing.draggable !== !isLocked
        const connectorActiveChanged = existing.data?.isConnectorActive !== isConnectorActive
        const connectSourceChanged = existing.data?.isConnectSource !== isConnectSource

        let dataChanged = false
        const existingData = existing.data || {}
        const nData = n.data || {}
        const ignoredKeys = new Set(['onOpenDoc', 'workspaceId', 'parentWorkspaceId', 'isConnectorActive', 'isConnectSource'])
        const existingKeys = Object.keys(existingData).filter((k) => !ignoredKeys.has(k))
        const nKeys = Object.keys(nData).filter((k) => !ignoredKeys.has(k))

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

        if (posChanged || typeChanged || zIndexChanged || lockChanged || dataChanged || connectorActiveChanged || connectSourceChanged) {
          hasChanges = true
          return {
            ...existing,
            type: n.type,
            zIndex: expectedZIndex,
            draggable: !isLocked,
            position: { x: n.positionX, y: n.positionY },
            data: {
              ...(dataChanged ? n.data : existing.data),
              workspaceId,
              parentWorkspaceId: workspaceId,
              onOpenDoc: onSwitchToDoc,
              isConnectorActive,
              isConnectSource
            }
          }
        }

        return existing
      })

      return hasChanges ? nextNodes : prevNodes
    })
  }, [dbNodes, workspaceId, setNodes, onSwitchToDoc, activeTool, connectSourceNodeId])

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

  // Unified function to connect two cards (used by click-to-connect and drag-to-connect)
  const handleConnectNodes = useCallback(
    async (sourceId: string, targetId: string, customSourceHandle?: string, customTargetHandle?: string) => {
      if (!sourceId || !targetId || sourceId === targetId) return

      let sHandle = customSourceHandle
      let tHandle = customTargetHandle

      // Dynamically select the facing handles if not explicitly supplied
      if (!sHandle || !tHandle) {
        const sourceNode = nodes.find((n) => n.id === sourceId)
        const targetNode = nodes.find((n) => n.id === targetId)

        if (sourceNode && targetNode) {
          const dx = targetNode.position.x - sourceNode.position.x
          const dy = targetNode.position.y - sourceNode.position.y

          if (Math.abs(dx) >= Math.abs(dy)) {
            if (dx >= 0) {
              sHandle = sHandle || 'right'
              tHandle = tHandle || 'left'
            } else {
              sHandle = sHandle || 'left'
              tHandle = tHandle || 'right'
            }
          } else {
            if (dy >= 0) {
              sHandle = sHandle || 'bottom'
              tHandle = tHandle || 'top'
            } else {
              sHandle = sHandle || 'top'
              tHandle = tHandle || 'bottom'
            }
          }
        }
      }

      sHandle = sHandle || 'right'
      tHandle = tHandle || 'left'

      const newEdgeId = crypto.randomUUID()
      const edgeType = connectorRouting === 'smoothstep' ? 'smoothstep' : connectorRouting === 'straight' ? 'straight' : 'default'
      const markerEnd = connectorHasArrow ? { type: MarkerType.ArrowClosed, color: connectorColor } : undefined

      // Optimistic edge addition so the user sees the arrow instantaneously
      setEdges((prevEdges) => [
        ...prevEdges.filter((e) => e.id !== newEdgeId),
        {
          id: newEdgeId,
          source: sourceId,
          target: targetId,
          sourceHandle: sHandle,
          targetHandle: tHandle,
          animated: true,
          type: edgeType,
          markerEnd,
          style: { stroke: connectorColor, strokeWidth: 2 }
        }
      ])

      try {
        await db.canvasEdges.add({
          id: newEdgeId,
          workspaceId,
          source: sourceId,
          target: targetId,
          sourceHandle: sHandle,
          targetHandle: tHandle,
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
        toast.success('Conector de flecha creado')
      } catch (err) {
        console.error('Failed to create edge in DB', err)
      }

      setConnectSourceNodeId(null)
    },
    [nodes, connectorRouting, connectorHasArrow, connectorColor, workspaceId, setEdges]
  )

  const onNodeClick = useCallback(
    async (_: any, node: Node) => {
      if (activeTool === 'connector') {
        if (!connectSourceNodeId) {
          setConnectSourceNodeId(node.id)
          toast.info('Tarjeta de origen seleccionada. Haz clic en la tarjeta destino.')
        } else if (connectSourceNodeId === node.id) {
          setConnectSourceNodeId(null)
          toast.info('Selección cancelada')
        } else {
          await handleConnectNodes(connectSourceNodeId, node.id)
          setActiveTool('select')
        }
      }
    },
    [activeTool, connectSourceNodeId, handleConnectNodes]
  )

  // Handle connecting cards via handle-to-handle drag
  const onConnect = useCallback(
    async (params: Connection) => {
      if (!params.source || !params.target || params.source === params.target) return
      await handleConnectNodes(
        params.source,
        params.target,
        params.sourceHandle || undefined,
        params.targetHandle || undefined
      )
    },
    [handleConnectNodes]
  )

  // Handle dragging connector arrow and releasing over another card (anywhere on the card)
  const onConnectEnd = useCallback(
    (event: MouseEvent | TouchEvent, connectionState: any) => {
      if (connectionState?.isValid) return
      if (!connectionState?.fromNode) return

      const clientX = 'clientX' in event ? event.clientX : event.changedTouches?.[0]?.clientX
      const clientY = 'clientY' in event ? event.clientY : event.changedTouches?.[0]?.clientY
      if (clientX == null || clientY == null) return

      const elem = document.elementFromPoint(clientX, clientY)
      const targetNodeElem = elem?.closest('.react-flow__node')
      const targetNodeId = targetNodeElem?.getAttribute('data-id')

      if (targetNodeId && targetNodeId !== connectionState.fromNode.id) {
        handleConnectNodes(
          connectionState.fromNode.id,
          targetNodeId,
          connectionState.fromHandle?.id || undefined
        )
      }
    },
    [handleConnectNodes]
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

  // Delete selected nodes and edges (Delete / Backspace / Supr)
  const deleteSelectedElements = useCallback(async () => {
    const selectedNodes = nodes.filter((n) => n.selected)
    const selectedEdges = edges.filter((e) => e.selected)
    if (selectedNodes.length === 0 && selectedEdges.length === 0) return

    try {
      const now = Date.now()
      for (const n of selectedNodes) {
        await db.canvasNodes.update(n.id, {
          isDeleted: true,
          updatedAt: now,
          syncStatus: 'pending'
        })
      }
      for (const e of selectedEdges) {
        await db.canvasEdges.update(e.id, {
          isDeleted: true,
          updatedAt: now,
          syncStatus: 'pending'
        })
      }
      syncEngine.scheduleSync(1000)
    } catch (err) {
      console.error('Failed to delete selected elements', err)
    }
  }, [nodes, edges])

  // Handle node data update from CardEditToolbar
  const handleUpdateNodeData = useCallback(
    async (nodeId: string, updates: Record<string, any>) => {
      setNodes((nds) =>
        nds.map((n) => {
          if (n.id === nodeId) {
            return {
              ...n,
              draggable: updates.isLocked !== undefined ? !updates.isLocked : n.draggable,
              data: {
                ...n.data,
                ...updates
              }
            }
          }
          return n
        })
      )

      try {
        const existing = await db.canvasNodes.get(nodeId)
        if (existing) {
          await db.canvasNodes.update(nodeId, {
            data: {
              ...existing.data,
              ...updates
            },
            updatedAt: Date.now(),
            syncStatus: 'pending'
          })
          syncEngine.scheduleSync(1000)
        }
      } catch (err) {
        console.error('Failed to update node data in db', err)
      }
    },
    [setNodes]
  )

  // Z-Index layer manipulation handlers (Matches 3-dots menu Bring to Front / Forward / Backward / Back)
  const handleBringToFront = useCallback(
    (nodeId: string) => {
      const maxZ = Math.max(...nodes.map((n) => (typeof n.zIndex === 'number' ? n.zIndex : 1)), 1)
      setNodes((nds) => nds.map((n) => (n.id === nodeId ? { ...n, zIndex: maxZ + 2 } : n)))
      toast.success('Traído al frente')
    },
    [nodes, setNodes]
  )

  const handleBringForward = useCallback(
    (nodeId: string) => {
      setNodes((nds) =>
        nds.map((n) => (n.id === nodeId ? { ...n, zIndex: (typeof n.zIndex === 'number' ? n.zIndex : 1) + 1 } : n))
      )
      toast.success('Capa avanzada')
    },
    [setNodes]
  )

  const handleSendBackward = useCallback(
    (nodeId: string) => {
      setNodes((nds) =>
        nds.map((n) => (n.id === nodeId ? { ...n, zIndex: Math.max(0, (typeof n.zIndex === 'number' ? n.zIndex : 1) - 1) } : n))
      )
      toast.success('Capa retrocedida')
    },
    [setNodes]
  )

  const handleSendToBack = useCallback(
    (nodeId: string) => {
      setNodes((nds) => nds.map((n) => (n.id === nodeId ? { ...n, zIndex: 0 } : n)))
      toast.success('Enviado al fondo')
    },
    [setNodes]
  )

  // Frame Section: creates a Frame surrounding the selected node(s)
  const handleFrameSection = useCallback(
    async (nodeId: string) => {
      const targetNode = nodes.find((n) => n.id === nodeId)
      if (!targetNode) return

      const padding = 40
      const nodeW = Number(targetNode.data?.width) || 280
      const nodeH = Number(targetNode.data?.height) || 180

      const frameId = `frame-${Date.now()}`
      const frameNode = {
        id: frameId,
        workspaceId,
        type: 'frame' as const,
        positionX: targetNode.position.x - padding,
        positionY: targetNode.position.y - padding - 30,
        width: nodeW + padding * 2,
        height: nodeH + padding * 2 + 30,
        data: {
          frameTitle: 'Section Frame',
          frameBgStyle: 'glass' as const
        },
        createdAt: Date.now(),
        updatedAt: Date.now(),
        isDeleted: false,
        syncStatus: 'pending' as const
      }

      await db.canvasNodes.add(frameNode)
      syncEngine.scheduleSync(1000)
      toast.success('Sección enmarcada en Frame')
    },
    [nodes, workspaceId]
  )

  // Group Section
  const handleGroupSection = useCallback(
    (_nodeId: string) => {
      toast.success('Elementos agrupados')
    },
    []
  )

  // Turn into linked doc
  const handleTurnIntoLinkedDoc = useCallback(
    async (nodeId: string) => {
      const target = nodes.find((n) => n.id === nodeId)
      if (!target) return

      const docTitle: string = typeof target.data?.title === 'string' ? target.data.title : 'Nuevo Documento'
      const docContent: string = typeof target.data?.content === 'string' ? target.data.content : ''

      try {
        const newDocId = `ws-doc-${Date.now()}`
        await db.workspaces.add({
          id: newDocId,
          parentId: workspaceId,
          spaceId: currentWorkspace?.spaceId || 'default-space',
          folder: 'General',
          title: docTitle,
          icon: '📄',
          color: '#3b82f6',
          viewMode: 'doc',
          docContent: `<p>${docContent || 'Documento vinculado desde tarjeta.'}</p>`,
          createdAt: Date.now(),
          updatedAt: Date.now(),
          isFavorite: false,
          isDeleted: false,
          syncStatus: 'pending'
        })

        await db.canvasNodes.update(nodeId, {
          type: 'subboard',
          data: {
            ...target.data,
            title: docTitle,
            subboardId: newDocId,
            subtitle: 'Documento vinculado'
          },
          updatedAt: Date.now(),
          syncStatus: 'pending'
        })
        syncEngine.scheduleSync(1000)
        toast.success('Convertido en documento vinculado')
      } catch (err) {
        console.error(err)
        toast.error('Error al convertir en documento')
      }
    },
    [nodes, workspaceId, currentWorkspace?.spaceId]
  )

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
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files || files.length === 0) return

    const imageFiles = Array.from(files).filter((file) => file.type.startsWith('image/'))
    e.target.value = ''
    if (imageFiles.length === 0) return

    const toastId = toast.loading(`Optimizando ${imageFiles.length} foto(s)...`)
    try {
      let index = 0
      for (const file of imageFiles) {
        const result = await processAndUploadImage(file)
        await addNewNode('image', {
          imageUrl: result.url,
          caption: file.name ? file.name.replace(/\.[^/.]+$/, '') : 'Foto',
          offsetX: index * 30,
          offsetY: index * 30
        })
        index++
      }
      toast.success('Fotos optimizadas en WebP y guardadas', { id: toastId })
    } catch (err: any) {
      toast.error('Error al subir fotos: ' + (err?.message || 'Error'), { id: toastId })
    }
  }

  // Handle Drag & Drop of photos/images or text from DocEditor onto the canvas
  const handleCanvasDrop = async (e: React.DragEvent) => {
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
      const imageFiles = Array.from(files).filter((file) => file.type.startsWith('image/'))
      if (imageFiles.length === 0) return

      const toastId = toast.loading(`Optimizando ${imageFiles.length} imagen(es)...`)
      try {
        let count = 0
        for (const file of imageFiles) {
          const result = await processAndUploadImage(file)
          await addNewNode('image', {
            imageUrl: result.url,
            caption: file.name ? file.name.replace(/\.[^/.]+$/, '') : 'Foto arrastrada',
            offsetX: count * 30,
            offsetY: count * 30
          })
          count++
        }
        toast.success('Imágenes optimizadas añadidas al lienzo', { id: toastId })
      } catch (err: any) {
        toast.error('Error procesando imagen: ' + (err?.message || 'Error'), { id: toastId })
      }
    }
  }

  // Handle Clipboard Paste (Ctrl+V) of images or formatted text onto canvas
  useEffect(() => {
    const handlePaste = async (e: ClipboardEvent) => {
      const target = e.target as HTMLElement
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) {
        return
      }
      const files = e.clipboardData?.files
      if (files && files.length > 0) {
        const imageFiles = Array.from(files).filter((file) => file.type.startsWith('image/'))
        if (imageFiles.length > 0) {
          let count = 0
          for (const file of imageFiles) {
            try {
              const result = await processAndUploadImage(file)
              await addNewNode('image', {
                imageUrl: result.url,
                caption: file.name ? file.name.replace(/\.[^/.]+$/, '') : 'Captura pegada',
                offsetX: count * 30,
                offsetY: count * 30
              })
              count++
            } catch (err) {
              console.error('Error al pegar imagen:', err)
            }
          }
          return
        }
      }

      // If text/html is pasted onto empty canvas area
      const html = e.clipboardData?.getData('text/html')
      const text = e.clipboardData?.getData('text/plain')

      let clean = ''
      const isPdf = Boolean(
        (html && isPdfHtml(html)) ||
        (text && (isPdfOrStructuredText(text) || isLegalContractOrPdfText(text)))
      )

      if (isPdf) {
        clean = cleanPdfContent(html || '', text || '')
      } else if (html && hasHtmlFormatting(html)) {
        clean = cleanPastedHtml(html || '')
      }

      if (clean && clean.trim()) {
        await addNewNode('note', {
          content: clean,
          hasHtmlHighlight: true
        })
        toast.success(isPdf ? 'Nota creada desde PDF con formato' : 'Nota creada con el formato copiado')
      } else if (text && text.trim()) {
        await addNewNode('note', {
          content: text
        })
        toast.success('Nota creada desde el portapapeles')
      }
    }
    window.addEventListener('paste', handlePaste)
    return () => window.removeEventListener('paste', handlePaste)
  }, [addNewNode])

  // Keyboard shortcut listener (Delete/Backspace to delete elements, Ctrl+D duplicate, V, T, N, S, F, C, D, H, E tools)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if user is writing inside an input or textarea
      const target = e.target as HTMLElement
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.isContentEditable ||
          target.closest('input') ||
          target.closest('textarea') ||
          target.closest('[contenteditable="true"]'))
      ) {
        return
      }

      if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault()
        deleteSelectedElements()
      } else if (e.key === 'Escape') {
        setActiveTool('select')
        setConnectSourceNodeId(null)
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        // Undo last freehand drawing stroke if any
        setDrawings((prev) => (prev.length > 0 ? prev.slice(0, -1) : prev))
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
  }, [deleteSelectedElements, duplicateSelectedNodes, addNewNode])

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

    // Render freehand drawings into fallback export canvas
    drawings.forEach((stroke) => {
      if (stroke.points.length < 2) return
      ctx.save()
      ctx.strokeStyle = stroke.color
      ctx.lineWidth = stroke.width
      if (stroke.isHighlighter) ctx.globalAlpha = 0.4
      ctx.lineCap = 'round'
      ctx.lineJoin = 'round'
      ctx.beginPath()
      ctx.moveTo(stroke.points[0].x + offsetX, stroke.points[0].y + offsetY)
      for (let i = 1; i < stroke.points.length; i++) {
        ctx.lineTo(stroke.points[i].x + offsetX, stroke.points[i].y + offsetY)
      }
      ctx.stroke()
      ctx.restore()
    })

    // Download PNG
    const link = document.createElement('a')
    link.download = `${currentWorkspace?.title || 'lienzo'}_edgeless.png`
    link.href = canvas.toDataURL('image/png')
    link.click()
    setShowCanvasMenu(false)
  }

  // Freehand drawing pointer handlers (recording in Flow World Coordinates)
  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (activeTool !== 'pencil' && activeTool !== 'highlighter' && activeTool !== 'eraser' && activeTool !== 'laser') return

    try {
      e.currentTarget.setPointerCapture(e.pointerId)
    } catch {}

    const flowPos = reactFlowInstance.screenToFlowPosition({ x: e.clientX, y: e.clientY })

    if (activeTool === 'pencil' || activeTool === 'highlighter') {
      const isHighlighter = activeTool === 'highlighter'
      const width = isHighlighter ? 16 : penWidth
      isDrawingRef.current = true
      currentStrokeRef.current = {
        color: penColor,
        width,
        isHighlighter,
        points: [flowPos]
      }

      if (activePathRef.current) {
        activePathRef.current.setAttribute('stroke', penColor)
        activePathRef.current.setAttribute('stroke-width', width.toString())
        activePathRef.current.setAttribute('opacity', isHighlighter ? '0.4' : '1')
        activePathRef.current.setAttribute('d', getSvgPathFromPoints([flowPos]))
      }
    } else if (activeTool === 'eraser') {
      isErasingRef.current = true
      const { zoom } = reactFlowInstance.getViewport()
      const radius = 24 / (zoom || 1)
      setDrawings((prev) =>
        prev.filter((stroke) => {
          return !stroke.points.some((p) => Math.hypot(p.x - flowPos.x, p.y - flowPos.y) < radius)
        })
      )
    }
  }

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (activeTool === 'laser') {
      laserPointsRef.current.push({ x: e.clientX, y: e.clientY, time: Date.now() })
      return
    }

    if (activeTool === 'eraser' && isErasingRef.current) {
      const flowPos = reactFlowInstance.screenToFlowPosition({ x: e.clientX, y: e.clientY })
      const { zoom } = reactFlowInstance.getViewport()
      const radius = 24 / (zoom || 1)
      setDrawings((prev) =>
        prev.filter((stroke) => {
          return !stroke.points.some((p) => Math.hypot(p.x - flowPos.x, p.y - flowPos.y) < radius)
        })
      )
      return
    }

    if (!isDrawingRef.current || !currentStrokeRef.current) return

    const flowPos = reactFlowInstance.screenToFlowPosition({ x: e.clientX, y: e.clientY })
    currentStrokeRef.current.points.push(flowPos)

    if (activePathRef.current) {
      activePathRef.current.setAttribute('d', getSvgPathFromPoints(currentStrokeRef.current.points))
    }
  }

  const handlePointerUp = (e?: React.PointerEvent<HTMLDivElement>) => {
    if (e) {
      try {
        e.currentTarget.releasePointerCapture(e.pointerId)
      } catch {}
    }
    isErasingRef.current = false
    if (isDrawingRef.current && currentStrokeRef.current) {
      isDrawingRef.current = false
      if (currentStrokeRef.current.points.length > 0) {
        setDrawings((prev) => [...prev, currentStrokeRef.current!])
      }
      currentStrokeRef.current = null
      if (activePathRef.current) {
        activePathRef.current.setAttribute('d', '')
      }
    }
  }

  // Laser Pointer Animation Loop
  useEffect(() => {
    if (activeTool !== 'laser') {
      if (laserAnimFrameRef.current) cancelAnimationFrame(laserAnimFrameRef.current)
      laserPointsRef.current = []
      return
    }

    const renderLaser = () => {
      const canvas = laserCanvasRef.current
      if (!canvas) return
      const ctx = canvas.getContext('2d')
      if (!ctx) return

      const rect = canvas.getBoundingClientRect()
      if (canvas.width !== rect.width || canvas.height !== rect.height) {
        canvas.width = rect.width
        canvas.height = rect.height
      }

      ctx.clearRect(0, 0, canvas.width, canvas.height)
      const now = Date.now()
      laserPointsRef.current = laserPointsRef.current.filter((pt) => now - pt.time < 900)

      const points = laserPointsRef.current
      if (points.length > 1) {
        for (let i = 1; i < points.length; i++) {
          const p1 = points[i - 1]
          const p2 = points[i]
          const age = now - p2.time
          const alpha = Math.max(0, 1 - age / 900)

          const p1x = p1.x - rect.left
          const p1y = p1.y - rect.top
          const p2x = p2.x - rect.left
          const p2y = p2.y - rect.top

          ctx.save()
          ctx.strokeStyle = `rgba(244, 63, 94, ${alpha})`
          ctx.lineWidth = 5 * alpha + 1.5
          ctx.lineCap = 'round'
          ctx.shadowBlur = 12
          ctx.shadowColor = `rgba(244, 63, 94, ${alpha})`
          ctx.beginPath()
          ctx.moveTo(p1x, p1y)
          ctx.lineTo(p2x, p2y)
          ctx.stroke()
          ctx.restore()
        }

        const head = points[points.length - 1]
        const headX = head.x - rect.left
        const headY = head.y - rect.top
        ctx.save()
        ctx.fillStyle = '#f43f5e'
        ctx.shadowBlur = 16
        ctx.shadowColor = '#f43f5e'
        ctx.beginPath()
        ctx.arc(headX, headY, 6, 0, Math.PI * 2)
        ctx.fill()
        ctx.fillStyle = '#ffffff'
        ctx.beginPath()
        ctx.arc(headX, headY, 2.5, 0, Math.PI * 2)
        ctx.fill()
        ctx.restore()
      }

      laserAnimFrameRef.current = requestAnimationFrame(renderLaser)
    }

    laserAnimFrameRef.current = requestAnimationFrame(renderLaser)

    return () => {
      if (laserAnimFrameRef.current) cancelAnimationFrame(laserAnimFrameRef.current)
    }
  }, [activeTool])

  // Global window pointerup listener so dragging off-canvas or over a panel releases drawing/erasing cleanly
  useEffect(() => {
    const handleGlobalPointerUp = () => {
      isErasingRef.current = false
      if (isDrawingRef.current && currentStrokeRef.current) {
        isDrawingRef.current = false
        if (currentStrokeRef.current.points.length > 0) {
          setDrawings((prev) => [...prev, currentStrokeRef.current!])
        }
        currentStrokeRef.current = null
        if (activePathRef.current) {
          activePathRef.current.setAttribute('d', '')
        }
      }
    }
    window.addEventListener('pointerup', handleGlobalPointerUp)
    return () => window.removeEventListener('pointerup', handleGlobalPointerUp)
  }, [])

  const isDrawingTool = activeTool === 'pencil' || activeTool === 'highlighter' || activeTool === 'eraser'
  const [isUnsortedOpen, setIsUnsortedOpen] = useState(false)

  const selectedNodes = nodes.filter((n) => n.selected)
  const singleSelectedNode = selectedNodes.length === 1 ? selectedNodes[0] : null

  useEffect(() => {
    const handleToggle = () => setIsUnsortedOpen((prev) => !prev)
    window.addEventListener('seven-note-toggle-unsorted', handleToggle)
    return () => window.removeEventListener('seven-note-toggle-unsorted', handleToggle)
  }, [])

  return (
    <div
      className={`relative w-full h-full bg-[var(--app-bg-canvas)] overflow-hidden select-none ${hideChrome ? 'canvas-hide-chrome' : ''}`}
      onDragOver={(e) => e.preventDefault()}
      onDrop={handleCanvasDrop}
    >
      <ReactFlow
        colorMode={darkMode ? 'dark' : 'light'}
        nodes={nodes}
        edges={edges}
        onNodesChange={readOnly ? undefined : onNodesChange}
        onEdgesChange={readOnly ? undefined : onEdgesChange}
        onNodeDragStop={readOnly ? undefined : onNodeDragStop}
        onSelectionDragStop={readOnly ? undefined : onSelectionDragStop}
        onNodesDelete={readOnly ? undefined : onNodesDelete}
        onEdgesDelete={readOnly ? undefined : onEdgesDelete}
        onNodeClick={onNodeClick}
        onConnect={readOnly ? undefined : onConnect}
        onConnectEnd={readOnly ? undefined : onConnectEnd}
        connectionLineStyle={{ stroke: connectorColor, strokeWidth: 2 }}
        connectionLineType={
          connectorRouting === 'smoothstep'
            ? ConnectionLineType.SmoothStep
            : connectorRouting === 'straight'
            ? ConnectionLineType.Straight
            : ConnectionLineType.Bezier
        }
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
          markerEnd: { type: MarkerType.ArrowClosed, color: connectorColor },
          style: { stroke: connectorColor, strokeWidth: 2 }
        }}
        proOptions={{ hideAttribution: true }}
        nodeDragThreshold={8}
        zoomOnPinch={true}
        panOnDrag={activeTool === 'pan' ? true : !isDrawingTool}
        nodesDraggable={!readOnly && activeTool !== 'pan' && activeTool !== 'connector' && !isDrawingTool}
        nodesConnectable={!readOnly}
        selectionOnDrag={activeTool === 'select'}
        deleteKeyCode={readOnly ? null : ['Backspace', 'Delete']}
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

        {/* Freehand Vector Drawings inside React Flow Viewport (persists & transforms with zoom & pan) */}
        <ViewportPortal>
          <svg
            className="absolute top-0 left-0 overflow-visible pointer-events-none select-none z-10"
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: '100%',
              overflow: 'visible',
              pointerEvents: 'none'
            }}
          >
            {drawings.map((stroke, idx) => (
              <path
                key={idx}
                d={getSvgPathFromPoints(stroke.points)}
                stroke={stroke.color}
                strokeWidth={stroke.width}
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
                opacity={stroke.isHighlighter ? 0.4 : 1}
              />
            ))}
            <path
              ref={activePathRef}
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
              d=""
            />
          </svg>
        </ViewportPortal>

        {/* Freehand Drawing Capture Layer (only captures pointer while in drawing/laser modes) */}
        {(isDrawingTool || activeTool === 'laser') && (
          <div
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
            className={`absolute inset-0 z-20 touch-none select-none ${
              activeTool === 'pencil' || activeTool === 'highlighter' || activeTool === 'laser'
                ? 'cursor-crosshair'
                : 'cursor-pointer'
            }`}
          >
            {activeTool === 'laser' && (
              <canvas
                ref={laserCanvasRef}
                className="w-full h-full pointer-events-none"
              />
            )}
          </div>
        )}

        {/* Card Floating Context Toolbar & Popovers (Matches User Screenshots 1 & 2) */}
        {!readOnly && singleSelectedNode && singleSelectedNode.type !== 'text' && (
          <CardEditToolbar
            node={singleSelectedNode}
            onUpdateNode={handleUpdateNodeData}
            onStartConnect={(nodeId) => {
              setConnectSourceNodeId(nodeId)
              setActiveTool('connector')
              toast.info('Tarjeta de origen seleccionada. Haz clic en la tarjeta destino.')
            }}
            onDuplicate={duplicateSelectedNodes}
            onDelete={deleteSelectedElements}
            onBringToFront={handleBringToFront}
            onBringForward={handleBringForward}
            onSendBackward={handleSendBackward}
            onSendToBack={handleSendToBack}
            onFrameSection={handleFrameSection}
            onGroupSection={handleGroupSection}
            onTurnIntoLinkedDoc={handleTurnIntoLinkedDoc}
          />
        )}

        {/* Milanote Left Tool Palette (Phosphor Icons Dock) */}
        {!readOnly && (
          <Panel position="top-left" className="ml-3 mt-3 z-30">
            <MilanoteToolbar
              onAddNode={addNewNode}
              onToggleTool={(t: string) => setActiveTool(activeTool === t ? 'select' : (t as any))}
              activeTool={activeTool}
              onOpenTemplates={() => setTemplatesOpen(true)}
              onUploadImage={() => imageFileInputRef.current?.click()}
            />
          </Panel>
        )}

        {/* Bottom Left Floating "..." Menu Button */}
        <Panel position="bottom-left" className="ml-2 sm:ml-4 mb-2 sm:mb-4 z-20">
          <div className="relative">
            <button
              onClick={() => setShowCanvasMenu(!showCanvasMenu)}
              className="p-2 sm:p-2.5 rounded-full bg-white/85 dark:bg-[#1a1b1e]/85 hover:bg-white dark:hover:bg-[#25262b] text-neutral-600 dark:text-neutral-300 hover:text-neutral-900 dark:hover:text-white border border-black/[0.08] dark:border-white/[0.1] shadow-xl transition flex items-center justify-center backdrop-blur-xl active:scale-95 cursor-pointer"
              title="Opciones del lienzo edgeless"
            >
              <DotsThree size={18} weight="bold" className="sm:hidden" />
              <DotsThree size={20} weight="bold" className="hidden sm:block" />
            </button>

            {/* Canvas Menu Popover */}
            {showCanvasMenu && (
              <div
                className="absolute left-0 bottom-11 sm:bottom-14 z-30 w-[calc(100vw-24px)] max-w-[260px] sm:w-64 bg-white/95 dark:bg-[#1a1b1e]/95 border border-black/[0.08] dark:border-white/[0.1] rounded-2xl sm:rounded-3xl shadow-2xl p-1.5 sm:p-2.5 text-[11px] sm:text-xs text-neutral-800 dark:text-neutral-200 backdrop-blur-2xl animate-in fade-in zoom-in-95 duration-100 space-y-0.5 max-h-[calc(100vh-80px)] overflow-y-auto custom-scrollbar"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="px-2.5 py-0.5 sm:px-3 sm:py-1 text-[9px] sm:text-[11px] font-bold uppercase tracking-wider text-neutral-400 dark:text-neutral-500">
                  Herramientas de Lienzo
                </div>

                <button
                  onClick={() => {
                    reactFlowInstance.zoomIn()
                    setShowCanvasMenu(false)
                  }}
                  className="w-full text-left px-2.5 py-1.5 sm:px-3 sm:py-2 rounded-xl hover:bg-black/[0.05] dark:hover:bg-white/[0.08] flex items-center gap-2 sm:gap-2.5 font-medium transition active:scale-[0.98] cursor-pointer"
                >
                  <MagnifyingGlassPlus size={15} weight="duotone" className="shrink-0 text-neutral-600 dark:text-neutral-400" />
                  <span>Acercar (+)</span>
                </button>

                <button
                  onClick={() => {
                    reactFlowInstance.zoomOut()
                    setShowCanvasMenu(false)
                  }}
                  className="w-full text-left px-2.5 py-1.5 sm:px-3 sm:py-2 rounded-xl hover:bg-black/[0.05] dark:hover:bg-white/[0.08] flex items-center gap-2 sm:gap-2.5 font-medium transition active:scale-[0.98] cursor-pointer"
                >
                  <MagnifyingGlassMinus size={15} weight="duotone" className="shrink-0 text-neutral-600 dark:text-neutral-400" />
                  <span>Alejar (-)</span>
                </button>

                <button
                  onClick={() => {
                    reactFlowInstance.fitView({ padding: 0.3, duration: 400 })
                    setShowCanvasMenu(false)
                  }}
                  className="w-full text-left px-2.5 py-1.5 sm:px-3 sm:py-2 rounded-xl hover:bg-black/[0.05] dark:hover:bg-white/[0.08] flex items-center gap-2 sm:gap-2.5 font-medium transition active:scale-[0.98] cursor-pointer"
                >
                  <ArrowsOutSimple size={15} weight="duotone" className="shrink-0 text-neutral-600 dark:text-neutral-400" />
                  <span>Ajustar a la vista</span>
                </button>

                <button
                  onClick={() => {
                    setShowMiniMap(!showMiniMap)
                    setShowCanvasMenu(false)
                  }}
                  className="w-full text-left px-2.5 py-1.5 sm:px-3 sm:py-2 rounded-xl hover:bg-black/[0.05] dark:hover:bg-white/[0.08] flex items-center gap-2 sm:gap-2.5 font-medium transition active:scale-[0.98] cursor-pointer"
                >
                  <MapTrifold size={15} weight="duotone" className="shrink-0 text-neutral-600 dark:text-neutral-400" />
                  <span>{showMiniMap ? 'Ocultar minimapa' : 'Mostrar minimapa'}</span>
                </button>

                <div className="border-t border-black/[0.06] dark:border-white/[0.08] my-0.5 sm:my-1" />

                {/* Grid variant switcher */}
                <div className="px-2.5 py-0.5 sm:px-3 sm:py-1 text-[9px] sm:text-[11px] font-bold uppercase tracking-wider text-neutral-400 dark:text-neutral-500 flex items-center gap-1.5">
                  <GridFour size={13} weight="duotone" />
                  <span>Estilo de Cuadrícula</span>
                </div>
                <div className="flex p-0.5 sm:p-1 rounded-full bg-black/[0.04] dark:bg-white/[0.06] gap-1">
                  <button
                    onClick={() => handleSetGridVariant(BackgroundVariant.Dots)}
                    className={`flex-1 py-0.5 sm:py-1 rounded-full text-[10px] sm:text-[11px] font-semibold transition text-center cursor-pointer ${
                      gridVariant === BackgroundVariant.Dots
                        ? 'bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 shadow-xs'
                        : 'text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200'
                    }`}
                  >
                    Puntos
                  </button>
                  <button
                    onClick={() => handleSetGridVariant(BackgroundVariant.Lines)}
                    className={`flex-1 py-0.5 sm:py-1 rounded-full text-[10px] sm:text-[11px] font-semibold transition text-center cursor-pointer ${
                      gridVariant === BackgroundVariant.Lines
                        ? 'bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 shadow-xs'
                        : 'text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200'
                    }`}
                  >
                    Líneas
                  </button>
                  <button
                    onClick={() => handleSetGridVariant('none')}
                    className={`flex-1 py-0.5 sm:py-1 rounded-full text-[10px] sm:text-[11px] font-semibold transition text-center cursor-pointer ${
                      gridVariant === 'none'
                        ? 'bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 shadow-xs'
                        : 'text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200'
                    }`}
                  >
                    Liso
                  </button>
                </div>

                <div className="border-t border-black/[0.06] dark:border-white/[0.08] my-0.5 sm:my-1" />

                {/* Alignment actions */}
                <button
                  onClick={() => setShowAlignMenu(!showAlignMenu)}
                  className="w-full text-left px-2.5 py-1.5 sm:px-3 sm:py-2 rounded-xl hover:bg-black/[0.05] dark:hover:bg-white/[0.08] flex items-center justify-between font-medium transition active:scale-[0.98] cursor-pointer"
                >
                  <div className="flex items-center gap-2 sm:gap-2.5">
                    <AlignLeft size={15} weight="duotone" className="shrink-0 text-neutral-600 dark:text-neutral-400" />
                    <span>Alinear seleccionados</span>
                  </div>
                  <CaretRight size={12} weight="bold" className={`text-neutral-400 transition-transform ${showAlignMenu ? 'rotate-90' : ''}`} />
                </button>

                {showAlignMenu && (
                  <div className="p-1.5 sm:p-2.5 rounded-xl sm:rounded-2xl bg-black/[0.03] dark:bg-white/[0.05] space-y-1.5 sm:space-y-2 border border-black/[0.04] dark:border-white/[0.06]">
                    <div>
                      <span className="text-[9px] sm:text-[10px] text-neutral-400 uppercase font-bold block mb-1">Horizontal</span>
                      <div className="flex gap-1">
                        <button
                          onClick={() => alignSelectedNodes('left')}
                          className="flex-1 p-1 sm:p-1.5 rounded-lg sm:rounded-xl bg-white dark:bg-[#25262b] hover:bg-black/5 dark:hover:bg-white/10 text-neutral-700 dark:text-neutral-200 text-[9px] sm:text-[10px] flex items-center justify-center border border-black/[0.06] dark:border-white/[0.08] shadow-2xs active:scale-95 cursor-pointer"
                          title="Alinear a la izquierda"
                        >
                          <AlignLeft size={13} weight="duotone" />
                        </button>
                        <button
                          onClick={() => alignSelectedNodes('center')}
                          className="flex-1 p-1 sm:p-1.5 rounded-lg sm:rounded-xl bg-white dark:bg-[#25262b] hover:bg-black/5 dark:hover:bg-white/10 text-neutral-700 dark:text-neutral-200 text-[9px] sm:text-[10px] flex items-center justify-center border border-black/[0.06] dark:border-white/[0.08] shadow-2xs active:scale-95 cursor-pointer"
                          title="Alinear al centro"
                        >
                          <AlignCenterHorizontal size={13} weight="duotone" />
                        </button>
                        <button
                          onClick={() => alignSelectedNodes('right')}
                          className="flex-1 p-1 sm:p-1.5 rounded-lg sm:rounded-xl bg-white dark:bg-[#25262b] hover:bg-black/5 dark:hover:bg-white/10 text-neutral-700 dark:text-neutral-200 text-[9px] sm:text-[10px] flex items-center justify-center border border-black/[0.06] dark:border-white/[0.08] shadow-2xs active:scale-95 cursor-pointer"
                          title="Alinear a la derecha"
                        >
                          <AlignRight size={13} weight="duotone" />
                        </button>
                        <button
                          onClick={() => alignSelectedNodes('distribute-h')}
                          className="flex-1 p-1 sm:p-1.5 rounded-lg sm:rounded-xl bg-white dark:bg-[#25262b] hover:bg-black/5 dark:hover:bg-white/10 text-neutral-700 dark:text-neutral-200 text-[9px] sm:text-[10px] flex items-center justify-center border border-black/[0.06] dark:border-white/[0.08] shadow-2xs active:scale-95 cursor-pointer"
                          title="Distribuir horizontalmente"
                        >
                          <Columns size={13} weight="duotone" />
                        </button>
                      </div>
                    </div>
                    <div>
                      <span className="text-[9px] sm:text-[10px] text-neutral-400 uppercase font-bold block mb-1">Vertical</span>
                      <div className="flex gap-1">
                        <button
                          onClick={() => alignSelectedNodes('top')}
                          className="flex-1 p-1 sm:p-1.5 rounded-lg sm:rounded-xl bg-white dark:bg-[#25262b] hover:bg-black/5 dark:hover:bg-white/10 text-neutral-700 dark:text-neutral-200 text-[9px] sm:text-[10px] flex items-center justify-center border border-black/[0.06] dark:border-white/[0.08] shadow-2xs active:scale-95 cursor-pointer"
                          title="Alinear arriba"
                        >
                          <AlignTop size={13} weight="duotone" />
                        </button>
                        <button
                          onClick={() => alignSelectedNodes('middle')}
                          className="flex-1 p-1 sm:p-1.5 rounded-lg sm:rounded-xl bg-white dark:bg-[#25262b] hover:bg-black/5 dark:hover:bg-white/10 text-neutral-700 dark:text-neutral-200 text-[9px] sm:text-[10px] flex items-center justify-center border border-black/[0.06] dark:border-white/[0.08] shadow-2xs active:scale-95 cursor-pointer"
                          title="Alinear al medio"
                        >
                          <AlignCenterVertical size={13} weight="duotone" />
                        </button>
                        <button
                          onClick={() => alignSelectedNodes('bottom')}
                          className="flex-1 p-1 sm:p-1.5 rounded-lg sm:rounded-xl bg-white dark:bg-[#25262b] hover:bg-black/5 dark:hover:bg-white/10 text-neutral-700 dark:text-neutral-200 text-[9px] sm:text-[10px] flex items-center justify-center border border-black/[0.06] dark:border-white/[0.08] shadow-2xs active:scale-95 cursor-pointer"
                          title="Alinear abajo"
                        >
                          <AlignBottom size={13} weight="duotone" />
                        </button>
                        <button
                          onClick={() => alignSelectedNodes('distribute-v')}
                          className="flex-1 p-1 sm:p-1.5 rounded-lg sm:rounded-xl bg-white dark:bg-[#25262b] hover:bg-black/5 dark:hover:bg-white/10 text-neutral-700 dark:text-neutral-200 text-[9px] sm:text-[10px] flex items-center justify-center border border-black/[0.06] dark:border-white/[0.08] shadow-2xs active:scale-95 cursor-pointer"
                          title="Distribuir verticalmente"
                        >
                          <Rows size={13} weight="duotone" />
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* Auto layout mindmap / tree */}
                <button
                  onClick={handleAutoLayoutNodes}
                  className="w-full text-left px-2.5 py-1.5 sm:px-3 sm:py-2 rounded-xl hover:bg-black/[0.05] dark:hover:bg-white/[0.08] flex items-center justify-between font-medium transition active:scale-[0.98] cursor-pointer"
                >
                  <div className="flex items-center gap-2 sm:gap-2.5">
                    <TreeStructure size={15} weight="duotone" className="shrink-0 text-neutral-600 dark:text-neutral-400" />
                    <span>Auto-organizar diagrama</span>
                  </div>
                  <span className="text-[9px] sm:text-[10px] text-emerald-500 font-semibold px-1.5 sm:px-2 py-0.5 rounded-full bg-emerald-500/10">Árbol</span>
                </button>

                {/* Duplicate selected */}
                <button
                  onClick={duplicateSelectedNodes}
                  className="w-full text-left px-2.5 py-1.5 sm:px-3 sm:py-2 rounded-xl hover:bg-black/[0.05] dark:hover:bg-white/[0.08] flex items-center justify-between font-medium transition active:scale-[0.98] cursor-pointer"
                >
                  <div className="flex items-center gap-2 sm:gap-2.5">
                    <Copy size={15} weight="duotone" className="shrink-0 text-neutral-600 dark:text-neutral-400" />
                    <span>Duplicar elemento</span>
                  </div>
                  <span className="text-[9px] sm:text-[10px] text-neutral-400 font-mono">Ctrl+D</span>
                </button>

                {/* Milanote special cards */}
                <button
                  onClick={() => addNewNode('colorPalette')}
                  className="w-full text-left px-2.5 py-1.5 sm:px-3 sm:py-2 rounded-xl hover:bg-black/[0.05] dark:hover:bg-white/[0.08] flex items-center gap-2 sm:gap-2.5 font-medium transition active:scale-[0.98] cursor-pointer"
                >
                  <Palette size={15} weight="duotone" className="shrink-0 text-neutral-600 dark:text-neutral-400" />
                  <span>Añadir Paleta de Color</span>
                </button>

                {/* Obsidian Canvas Import / Export */}
                <button
                  onClick={() => exportToObsidianCanvas(workspaceId, currentWorkspace?.title || 'canvas')}
                  className="w-full text-left px-2.5 py-1.5 sm:px-3 sm:py-2 rounded-xl hover:bg-black/[0.05] dark:hover:bg-white/[0.08] flex items-center gap-2 sm:gap-2.5 font-medium transition active:scale-[0.98] cursor-pointer"
                >
                  <DownloadSimple size={15} weight="duotone" className="shrink-0 text-neutral-600 dark:text-neutral-400" />
                  <span>Exportar Obsidian .canvas</span>
                </button>

                {/* Export Canvas as PNG */}
                <button
                  onClick={handleExportCanvasPNG}
                  className="w-full text-left px-2.5 py-1.5 sm:px-3 sm:py-2 rounded-xl hover:bg-black/[0.05] dark:hover:bg-white/[0.08] flex items-center gap-2 sm:gap-2.5 font-medium transition active:scale-[0.98] cursor-pointer"
                >
                  <PhosphorImage size={15} weight="duotone" className="shrink-0 text-neutral-600 dark:text-neutral-400" />
                  <span>Exportar lienzo como PNG</span>
                </button>

                <div className="border-t border-black/[0.06] dark:border-white/[0.08] my-0.5 sm:my-1" />

                <button
                  onClick={handleClearBoard}
                  className="w-full text-left px-2.5 py-1.5 sm:px-3 sm:py-2 rounded-xl hover:bg-rose-500/10 text-rose-500 flex items-center gap-2 sm:gap-2.5 font-medium transition active:scale-[0.98] cursor-pointer"
                >
                  <Trash size={15} weight="duotone" className="shrink-0 text-rose-500" />
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
        <Panel position="bottom-center" className="mb-2 sm:mb-4 z-20 max-w-[calc(100vw-24px)] md:-translate-x-14 2xl:translate-x-0">
          <div className="flex items-center px-2.5 py-1 rounded-full bg-white/85 dark:bg-[#1a1b1e]/85 border border-black/[0.08] dark:border-white/[0.1] shadow-2xl shadow-black/10 dark:shadow-black/40 text-[var(--app-text-primary)] h-12 sm:h-14 backdrop-blur-2xl select-none">
            {/* Quick Tools (Left Section: 32px buttons) */}
            <div className="flex items-center gap-0.5 pr-1">
              {/* Tool 1: Pointer / Select */}
              <button
                onClick={() => {
                  setActiveTool('select')
                  setShapePaletteOpen(false)
                  setNoteMenuOpen(false)
                }}
                className={`p-2 rounded-full transition active:scale-95 cursor-pointer ${
                  activeTool === 'select'
                    ? 'bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 shadow-sm'
                    : 'text-neutral-500 hover:text-neutral-900 dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/10'
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
                className={`p-2 rounded-full transition active:scale-95 cursor-pointer ${
                  activeTool === 'pan'
                    ? 'bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 shadow-sm'
                    : 'text-neutral-500 hover:text-neutral-900 dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/10'
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
                className={`p-2 rounded-full transition active:scale-95 cursor-pointer ${
                  activeTool === 'frame'
                    ? 'bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 shadow-sm'
                    : 'text-neutral-500 hover:text-neutral-900 dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/10'
                }`}
                title="Añadir marco de presentación (Frame / #)"
              >
                <FrameIcon className="w-4.5 h-4.5" />
              </button>

              {/* Tool 4: Connector line / Arrow */}
              <button
                onClick={() => {
                  setActiveTool(activeTool === 'connector' ? 'select' : 'connector')
                  setShapePaletteOpen(false)
                  setNoteMenuOpen(false)
                }}
                className={`p-2 rounded-full transition active:scale-95 cursor-pointer ${
                  activeTool === 'connector'
                    ? 'bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 shadow-sm'
                    : 'text-neutral-500 hover:text-neutral-900 dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/10'
                }`}
                title="Conector de tarjetas / flecha (C)"
              >
                <StraightLineIcon className="w-4.5 h-4.5" />
              </button>

              {/* Tool 5: Link tool */}
              <button
                onClick={() => {
                  addNewNode('link')
                  setShapePaletteOpen(false)
                  setNoteMenuOpen(false)
                }}
                className={`p-2 rounded-full transition active:scale-95 cursor-pointer ${
                  activeTool === 'link'
                    ? 'bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 shadow-sm'
                    : 'text-neutral-500 hover:text-neutral-900 dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/10'
                }`}
                title="Insertar enlace web (Link)"
              >
                <LinkIcon className="w-4.5 h-4.5" />
              </button>
            </div>

            {/* Vertical Divider */}
            <div className="w-[1px] h-6 bg-black/[0.08] dark:bg-white/[0.1] mx-1" />

            {/* Senior Tools (Right Section: Illustrated 3D Widgets with Hover Animations) */}
            <div className="flex items-center gap-1 pl-1 relative">
              {/* Senior Tool 1: Notes (Sticky Notes, Page Cards, Kanban) */}
              <div className="relative">
                <button
                  onClick={() => {
                    setNoteMenuOpen(!noteMenuOpen)
                    setShapePaletteOpen(false)
                  }}
                  className="rounded-2xl transition-transform hover:scale-105 active:scale-95 flex items-center justify-center cursor-pointer"
                  title="Notas adhesivas y tarjetas (N)"
                >
                  <NoteSeniorWidget isActive={noteMenuOpen} />
                </button>

                {/* Note Options Popover */}
                {noteMenuOpen && (
                  <div
                    className="absolute bottom-16 left-1/2 -translate-x-1/2 z-40 bg-white/95 dark:bg-[#1a1b1e]/95 border border-black/[0.08] dark:border-white/[0.1] rounded-3xl shadow-2xl p-4 flex flex-col gap-3 min-w-[270px] backdrop-blur-2xl animate-in fade-in zoom-in-95 duration-100"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div>
                      <span className="text-[11px] font-bold uppercase tracking-wider text-neutral-400 dark:text-neutral-500 block mb-2">
                        Nota Adhesiva
                      </span>
                      <div className="flex gap-2.5 justify-center">
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
                            className={`w-7 h-7 rounded-full transition transform hover:scale-120 active:scale-95 shadow-xs cursor-pointer ${col.bg}`}
                            title={`Nota ${col.label}`}
                          />
                        ))}
                      </div>
                    </div>

                    <div className="border-t border-black/[0.06] dark:border-white/[0.08]" />

                    <div className="flex flex-col gap-1">
                      <button
                        onClick={() => {
                          addNewNode('docframe')
                          setNoteMenuOpen(false)
                        }}
                        className="flex items-center gap-2.5 px-3 py-2 rounded-2xl hover:bg-black/[0.05] dark:hover:bg-white/[0.08] text-xs font-medium text-left text-neutral-700 dark:text-neutral-200 transition active:scale-[0.98] cursor-pointer"
                      >
                        <PageIcon className="w-4 h-4 text-blue-500" />
                        <span>Tarjeta de Documento / Página</span>
                      </button>

                      <button
                        onClick={() => {
                          addNewNode('todo')
                          setNoteMenuOpen(false)
                        }}
                        className="flex items-center gap-2.5 px-3 py-2 rounded-2xl hover:bg-black/[0.05] dark:hover:bg-white/[0.08] text-xs font-medium text-left text-neutral-700 dark:text-neutral-200 transition active:scale-[0.98] cursor-pointer"
                      >
                        <Kanban size={16} weight="duotone" className="text-neutral-700 dark:text-neutral-300" />
                        <span>Tablero de Tareas / Kanban</span>
                      </button>

                      <button
                        onClick={() => {
                          imageFileInputRef.current?.click()
                          setNoteMenuOpen(false)
                        }}
                        className="flex items-center gap-2.5 px-3 py-2 rounded-2xl hover:bg-black/[0.05] dark:hover:bg-white/[0.08] text-xs font-medium text-left text-neutral-700 dark:text-neutral-200 transition active:scale-[0.98] cursor-pointer"
                      >
                        <ImageIcon className="w-4 h-4 text-purple-500" />
                        <span>Subir Imagen o Foto</span>
                      </button>

                      <button
                        onClick={() => {
                          addNewNode('colorPalette')
                          setNoteMenuOpen(false)
                        }}
                        className="flex items-center gap-2.5 px-3 py-2 rounded-2xl hover:bg-black/[0.05] dark:hover:bg-white/[0.08] text-xs font-medium text-left text-neutral-700 dark:text-neutral-200 transition active:scale-[0.98] cursor-pointer"
                      >
                        <span className="text-sm">🎨</span>
                        <span>Paleta de Color</span>
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
                className="rounded-2xl transition-transform hover:scale-105 active:scale-95 flex items-center justify-center cursor-pointer"
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
                className="rounded-2xl transition-transform hover:scale-105 active:scale-95 flex items-center justify-center cursor-pointer"
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
                  className="rounded-2xl transition-transform hover:scale-105 active:scale-95 flex items-center justify-center cursor-pointer"
                  title="Formas geométricas (Shapes / S)"
                >
                  <ShapeSeniorWidget isActive={shapePaletteOpen} />
                </button>

                {/* Shape Selector Popover */}
                {shapePaletteOpen && (
                  <div
                    className="absolute bottom-16 left-1/2 -translate-x-1/2 z-40 bg-white/95 dark:bg-[#1a1b1e]/95 border border-black/[0.08] dark:border-white/[0.1] rounded-3xl shadow-2xl p-4 flex flex-col gap-3 min-w-[260px] backdrop-blur-2xl animate-in fade-in zoom-in-95 duration-100"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div>
                      <span className="text-[11px] font-bold uppercase tracking-wider text-neutral-400 dark:text-neutral-500 block mb-2">
                        Formas Geométricas
                      </span>
                      <div className="grid grid-cols-3 gap-2">
                        <button
                          onClick={() => {
                            addNewNode('shape', { shapeType: 'rect', color: 'blue' })
                            setShapePaletteOpen(false)
                          }}
                          className="flex flex-col items-center justify-center p-2.5 rounded-2xl bg-black/[0.03] dark:bg-white/[0.05] hover:bg-black/[0.07] dark:hover:bg-white/[0.1] text-neutral-800 dark:text-neutral-200 transition gap-1.5 active:scale-95 font-medium cursor-pointer"
                        >
                          <SquareIcon className="w-4 h-4 text-blue-500" />
                          <span className="text-[10px]">Rect</span>
                        </button>

                        <button
                          onClick={() => {
                            addNewNode('shape', { shapeType: 'ellipse', color: 'green' })
                            setShapePaletteOpen(false)
                          }}
                          className="flex flex-col items-center justify-center p-2.5 rounded-2xl bg-black/[0.03] dark:bg-white/[0.05] hover:bg-black/[0.07] dark:hover:bg-white/[0.1] text-neutral-800 dark:text-neutral-200 transition gap-1.5 active:scale-95 font-medium cursor-pointer"
                        >
                          <EllipseIcon className="w-4 h-4 text-emerald-500" />
                          <span className="text-[10px]">Círculo</span>
                        </button>

                        <button
                          onClick={() => {
                            addNewNode('shape', { shapeType: 'diamond', color: 'yellow' })
                            setShapePaletteOpen(false)
                          }}
                          className="flex flex-col items-center justify-center p-2.5 rounded-2xl bg-black/[0.03] dark:bg-white/[0.05] hover:bg-black/[0.07] dark:hover:bg-white/[0.1] text-neutral-800 dark:text-neutral-200 transition gap-1.5 active:scale-95 font-medium cursor-pointer"
                        >
                          <DiamondIcon className="w-4 h-4 text-amber-500" />
                          <span className="text-[10px]">Rombo</span>
                        </button>

                        <button
                          onClick={() => {
                            addNewNode('shape', { shapeType: 'triangle', color: 'purple' })
                            setShapePaletteOpen(false)
                          }}
                          className="flex flex-col items-center justify-center p-2.5 rounded-2xl bg-black/[0.03] dark:bg-white/[0.05] hover:bg-black/[0.07] dark:hover:bg-white/[0.1] text-neutral-800 dark:text-neutral-200 transition gap-1.5 active:scale-95 font-medium cursor-pointer"
                        >
                          <TriangleIcon className="w-4 h-4 text-purple-500" />
                          <span className="text-[10px]">Triángulo</span>
                        </button>

                        <button
                          onClick={() => {
                            addNewNode('shape', { shapeType: 'star', color: 'yellow' })
                            setShapePaletteOpen(false)
                          }}
                          className="flex flex-col items-center justify-center p-2.5 rounded-2xl bg-black/[0.03] dark:bg-white/[0.05] hover:bg-black/[0.07] dark:hover:bg-white/[0.1] text-neutral-800 dark:text-neutral-200 transition gap-1.5 active:scale-95 font-medium cursor-pointer"
                        >
                          <StarIcon className="w-4 h-4 text-yellow-500" />
                          <span className="text-[10px]">Estrella</span>
                        </button>

                        <button
                          onClick={() => {
                            addNewNode('shape', { shapeType: 'roundedRect', color: 'rose' })
                            setShapePaletteOpen(false)
                          }}
                          className="flex flex-col items-center justify-center p-2.5 rounded-2xl bg-black/[0.03] dark:bg-white/[0.05] hover:bg-black/[0.07] dark:hover:bg-white/[0.1] text-neutral-800 dark:text-neutral-200 transition gap-1.5 active:scale-95 font-medium cursor-pointer"
                        >
                          <RoundedRectangleIcon className="w-4 h-4 text-rose-500" />
                          <span className="text-[10px]">Redondo</span>
                        </button>

                        <button
                          onClick={() => {
                            addNewNode('shape', { shapeType: 'cylinder', color: 'blue' })
                            setShapePaletteOpen(false)
                          }}
                          className="flex flex-col items-center justify-center p-2.5 rounded-2xl bg-black/[0.03] dark:bg-white/[0.05] hover:bg-black/[0.07] dark:hover:bg-white/[0.1] text-neutral-800 dark:text-neutral-200 transition gap-1.5 active:scale-95 font-medium cursor-pointer"
                        >
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" strokeWidth="2">
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
                className="rounded-2xl transition-transform hover:scale-105 active:scale-95 flex items-center justify-center cursor-pointer"
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
                className="rounded-2xl transition-transform hover:scale-105 active:scale-95 flex items-center justify-center cursor-pointer"
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
                className="rounded-2xl transition-transform hover:scale-105 active:scale-95 flex items-center justify-center cursor-pointer"
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
                className="rounded-2xl transition-transform hover:scale-105 active:scale-95 flex items-center justify-center cursor-pointer"
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
            <div className="flex items-center gap-1.5 px-3.5 py-1.5 bg-white/90 dark:bg-[#1a1b1e]/90 border border-black/[0.08] dark:border-white/[0.1] rounded-full shadow-2xl text-xs backdrop-blur-2xl text-[var(--app-text-primary)] animate-in fade-in zoom-in-95 duration-100">
              <span className="text-[11px] font-bold text-neutral-400 dark:text-neutral-500 mr-1">
                {nodes.filter((n) => n.selected).length} seleccionados:
              </span>

              {/* Horizontal alignments */}
              <button
                onClick={() => alignSelectedNodes('left')}
                className="p-1.5 rounded-full hover:bg-black/[0.06] dark:hover:bg-white/[0.1] transition text-neutral-600 dark:text-neutral-300 active:scale-95 cursor-pointer"
                title="Alinear a la izquierda"
              >
                <AlignLeft size={16} weight="duotone" />
              </button>
              <button
                onClick={() => alignSelectedNodes('center')}
                className="p-1.5 rounded-full hover:bg-black/[0.06] dark:hover:bg-white/[0.1] transition text-neutral-600 dark:text-neutral-300 active:scale-95 cursor-pointer"
                title="Centrar horizontalmente"
              >
                <AlignCenterHorizontal size={16} weight="duotone" />
              </button>
              <button
                onClick={() => alignSelectedNodes('right')}
                className="p-1.5 rounded-full hover:bg-black/[0.06] dark:hover:bg-white/[0.1] transition text-neutral-600 dark:text-neutral-300 active:scale-95 cursor-pointer"
                title="Alinear a la derecha"
              >
                <AlignRight size={16} weight="duotone" />
              </button>
              <button
                onClick={() => alignSelectedNodes('distribute-h')}
                className="p-1.5 rounded-full hover:bg-black/[0.06] dark:hover:bg-white/[0.1] transition text-neutral-600 dark:text-neutral-300 active:scale-95 cursor-pointer"
                title="Distribuir horizontalmente"
              >
                <Columns size={16} weight="duotone" />
              </button>

              <div className="w-[1px] h-3.5 bg-black/[0.08] dark:bg-white/[0.1] mx-0.5" />

              {/* Vertical alignments */}
              <button
                onClick={() => alignSelectedNodes('top')}
                className="p-1.5 rounded-full hover:bg-black/[0.06] dark:hover:bg-white/[0.1] transition text-neutral-600 dark:text-neutral-300 active:scale-95 cursor-pointer"
                title="Alinear arriba"
              >
                <AlignTop size={16} weight="duotone" />
              </button>
              <button
                onClick={() => alignSelectedNodes('middle')}
                className="p-1.5 rounded-full hover:bg-black/[0.06] dark:hover:bg-white/[0.1] transition text-neutral-600 dark:text-neutral-300 active:scale-95 cursor-pointer"
                title="Centrar verticalmente"
              >
                <AlignCenterVertical size={16} weight="duotone" />
              </button>
              <button
                onClick={() => alignSelectedNodes('bottom')}
                className="p-1.5 rounded-full hover:bg-black/[0.06] dark:hover:bg-white/[0.1] transition text-neutral-600 dark:text-neutral-300 active:scale-95 cursor-pointer"
                title="Alinear abajo"
              >
                <AlignBottom size={16} weight="duotone" />
              </button>
              <button
                onClick={() => alignSelectedNodes('distribute-v')}
                className="p-1.5 rounded-full hover:bg-black/[0.06] dark:hover:bg-white/[0.1] transition text-neutral-600 dark:text-neutral-300 active:scale-95 cursor-pointer"
                title="Distribuir verticalmente"
              >
                <Rows size={16} weight="duotone" />
              </button>
            </div>
          </Panel>
        )}

        {/* Floating Active Connector Tool Banner */}
        {activeTool === 'connector' && (
          <Panel position="top-center" className="mt-3 z-30">
            <div className="flex items-center gap-2.5 px-4 py-2 bg-white/95 dark:bg-[#1a1b1e]/95 border border-black/[0.08] dark:border-white/[0.1] rounded-full shadow-2xl text-xs backdrop-blur-2xl text-[var(--app-text-primary)]">
              <StraightLineIcon className="w-4 h-4 text-blue-500 animate-pulse" />
              <span className="font-semibold text-blue-600 dark:text-blue-400">
                {connectSourceNodeId
                  ? 'Paso 2: Haz clic en la tarjeta destino (o en origen para cancelar)'
                  : 'Paso 1: Haz clic en la tarjeta origen (o arrastra desde los puntos de conexión)'}
              </span>

              <div className="w-[1px] h-3.5 bg-black/[0.08] dark:bg-white/[0.1] mx-0.5" />

              {/* Connector routing toggle */}
              <div className="flex items-center gap-0.5 bg-black/[0.04] dark:bg-white/[0.06] p-0.5 rounded-full border border-black/[0.04] dark:border-white/[0.06]">
                <button
                  onClick={() => setConnectorRouting('default')}
                  className={`px-2.5 py-1 rounded-full text-[10px] font-semibold transition cursor-pointer ${
                    connectorRouting === 'default' ? 'bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 shadow-xs' : 'text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200'
                  }`}
                  title="Línea curva Bézier"
                >
                  Curva
                </button>
                <button
                  onClick={() => setConnectorRouting('smoothstep')}
                  className={`px-2.5 py-1 rounded-full text-[10px] font-semibold transition cursor-pointer ${
                    connectorRouting === 'smoothstep' ? 'bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 shadow-xs' : 'text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200'
                  }`}
                  title="Línea ortogonal escalonada"
                >
                  Escalón
                </button>
                <button
                  onClick={() => setConnectorRouting('straight')}
                  className={`px-2.5 py-1 rounded-full text-[10px] font-semibold transition cursor-pointer ${
                    connectorRouting === 'straight' ? 'bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 shadow-xs' : 'text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200'
                  }`}
                  title="Línea recta"
                >
                  Recta
                </button>
              </div>

              {/* Arrow toggle */}
              <button
                onClick={() => setConnectorHasArrow(!connectorHasArrow)}
                className={`px-2.5 py-1 rounded-full text-[10px] font-semibold border transition cursor-pointer ${
                  connectorHasArrow
                    ? 'bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 border-transparent shadow-xs'
                    : 'border-black/[0.08] dark:border-white/[0.1] text-neutral-500 hover:bg-black/5 dark:hover:bg-white/10'
                }`}
                title="Alternar punta de flecha"
              >
                {connectorHasArrow ? 'Con flecha ➔' : 'Sin flecha —'}
              </button>

              {/* Connector color */}
              <div className="flex gap-1.5 items-center">
                {['#3b82f6', '#10b981', '#f59e0b', '#ec4899', '#8b5cf6', '#ffffff'].map((c) => (
                  <button
                    key={c}
                    onClick={() => setConnectorColor(c)}
                    className={`w-4 h-4 rounded-full transition-transform hover:scale-125 cursor-pointer ${connectorColor === c ? 'ring-2 ring-blue-500 ring-offset-1' : ''}`}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>

              <button
                onClick={() => {
                  setActiveTool('select')
                  setConnectSourceNodeId(null)
                }}
                className="p-1 rounded-full text-neutral-400 hover:text-neutral-800 dark:hover:text-neutral-200 hover:bg-black/5 dark:hover:bg-white/10 transition active:scale-95 cursor-pointer ml-0.5"
                title="Cancelar conector"
              >
                <X size={14} weight="bold" />
              </button>
            </div>
          </Panel>
        )}

        {/* Floating Active Laser Pointer Banner */}
        {activeTool === 'laser' && (
          <Panel position="top-center" className="mt-3 z-30">
            <div className="flex items-center gap-2.5 px-4 py-2 bg-neutral-950/85 border border-rose-500/30 rounded-full shadow-2xl text-xs backdrop-blur-2xl text-rose-200 animate-in fade-in duration-100">
              <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-ping mr-1" />
              <span className="font-semibold text-white">Puntero Láser Activo</span>
              <span className="text-[11px] text-rose-200/80">
                — Mueve el cursor para trazar halos que desaparecen solos
              </span>
              <button
                onClick={() => setActiveTool('select')}
                className="p-1 text-rose-300 hover:text-white ml-2 rounded-full hover:bg-rose-500/20 transition active:scale-95 cursor-pointer"
                title="Salir del modo láser"
              >
                <X size={14} weight="bold" />
              </button>
            </div>
          </Panel>
        )}

        {/* Floating Active Drawing Tool Controls Banner */}
        {isDrawingTool && (
          <Panel position="top-center" className="mt-3 z-30">
            <div className="flex items-center gap-2.5 px-4 py-2 bg-white/90 dark:bg-[#1a1b1e]/90 border border-black/[0.08] dark:border-white/[0.1] rounded-full shadow-2xl text-xs backdrop-blur-2xl text-[var(--app-text-primary)]">
              {activeTool === 'eraser' ? (
                <>
                  <span className="text-base leading-none">🧹</span>
                  <span className="font-semibold text-amber-500">Borrador Activo</span>
                  <span className="text-[11px] text-neutral-500">
                    — Haz clic o arrastra sobre los trazos para eliminarlos
                  </span>
                </>
              ) : (
                <>
                  <span className="font-medium text-neutral-500">
                    {activeTool === 'highlighter' ? 'Subrayador:' : 'Lápiz:'}
                  </span>
                  <div className="flex gap-1.5 items-center">
                    {['#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#ec4899', '#ffffff'].map((color) => (
                      <button
                        key={color}
                        onClick={() => setPenColor(color)}
                        className={`w-4 h-4 rounded-full transition-transform hover:scale-125 cursor-pointer ${
                          penColor === color ? 'ring-2 ring-blue-500 ring-offset-1' : ''
                        }`}
                        style={{ backgroundColor: color }}
                      />
                    ))}
                  </div>

                  <div className="w-[1px] h-4 bg-black/[0.08] dark:bg-white/[0.1] mx-1" />

                  {/* Stroke width */}
                  <div className="flex items-center gap-1">
                    {[2, 4, 8].map((w) => (
                      <button
                        key={w}
                        onClick={() => setPenWidth(w)}
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold transition cursor-pointer ${
                          penWidth === w
                            ? 'bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 shadow-xs'
                            : 'text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200 hover:bg-black/5 dark:hover:bg-white/10'
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
                className="ml-2 text-neutral-500 hover:text-rose-500 text-[11px] font-semibold transition cursor-pointer"
              >
                Limpiar todo
              </button>
              <button
                onClick={() => setActiveTool('select')}
                className="flex items-center gap-1 px-3 py-1 text-xs rounded-full bg-black/[0.05] dark:bg-white/[0.08] text-neutral-700 dark:text-neutral-200 hover:bg-rose-500 hover:text-white transition ml-1 font-semibold cursor-pointer active:scale-95"
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
