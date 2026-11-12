import React, {
  useEffect,
  useRef,
  useState,
  useMemo,
  useCallback
} from 'react'
import {
  forceSimulation,
  forceLink,
  forceManyBody,
  forceCenter,
  forceCollide,
  forceX,
  forceY,
  type Simulation
} from 'd3-force'
import {
  ChevronLeft,
  ChevronRight,
  Settings,
  Wand2,
  MoreVertical,
  Search,
  RotateCcw,
  Download,
  X,
  Maximize2,
  Sliders
} from 'lucide-react'
import { toast } from 'sonner'
import { type WorkspaceItem } from '../../db'

export interface GraphNode {
  id: string
  title: string
  isUnresolved?: boolean
  isTag?: boolean
  isCurrent?: boolean
  workspaceId?: string
  degree: number
  radius: number
  color?: string
  x?: number
  y?: number
  vx?: number
  vy?: number
  fx?: number | null
  fy?: number | null
}

export interface GraphEdge {
  id: string
  source: string | GraphNode
  target: string | GraphNode
  type?: 'link' | 'wikilink' | 'tag' | 'mention' | 'unresolved'
}

export interface GraphSettings {
  searchQuery: string
  showUnresolved: boolean
  showOrphans: boolean
  showTags: boolean
  centerStrength: number
  repelStrength: number
  linkDistance: number
  linkStrength: number
  nodeSize: number
  linkThickness: number
  showLabels: boolean
  showArrows: boolean
}

// Obsidian Technical Default Physics: balanced spacing, readable labels, natural diamond cluster
const DEFAULT_SETTINGS: GraphSettings = {
  searchQuery: '',
  showUnresolved: true,
  showOrphans: true,
  showTags: false,
  centerStrength: 0.25, // 0 to 1 (gentle drift to center)
  repelStrength: -120, // -50 to -300 (gives each note comfortable space)
  linkDistance: 120, // 50 to 250px (Obsidian balanced link length)
  linkStrength: 0.7, // 0.1 to 1.0 (flexible organic spring)
  nodeSize: 5, // 3 to 10px (Obsidian dot radius)
  linkThickness: 1, // 0.5 to 3px (clean 1px line)
  showLabels: true,
  showArrows: false
}

const SETTINGS_STORAGE_KEY = 'seven_note_graph_view_settings_v3'

export interface KnowledgeGraphPageProps {
  workspaces: WorkspaceItem[]
  currentWorkspaceId?: string
  onSelectWorkspace: (id: string) => void
  onCreateWorkspace?: (title: string) => Promise<void> | void
  onBack?: () => void
  onForward?: () => void
}

export const KnowledgeGraphPage: React.FC<KnowledgeGraphPageProps> = ({
  workspaces,
  currentWorkspaceId,
  onSelectWorkspace,
  onCreateWorkspace,
  onBack,
  onForward
}) => {
  // Graph settings with localStorage persistence (clamped to Obsidian values)
  const [settings, setSettings] = useState<GraphSettings>(() => {
    try {
      const saved = localStorage.getItem(SETTINGS_STORAGE_KEY)
      if (saved) {
        const parsed = JSON.parse(saved)
        // Ensure values are within technical Obsidian range
        return {
          ...DEFAULT_SETTINGS,
          ...parsed
        }
      }
    } catch {
      // fallback
    }
    return DEFAULT_SETTINGS
  })

  const [isSettingsOpen, setIsSettingsOpen] = useState(false)
  const [activeSettingsTab, setActiveSettingsTab] = useState<'filters' | 'forces' | 'display'>('forces')
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null)

  // Canvas and transform state
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const containerRef = useRef<HTMLDivElement | null>(null)
  const pinchDistRef = useRef<number | null>(null)
  const [transform, setTransform] = useState<{ x: number; y: number; k: number }>({
    x: 0,
    y: 0,
    k: 1
  })

  // Dragging and interaction refs
  const transformRef = useRef(transform)
  transformRef.current = transform

  const isPanningRef = useRef(false)
  const panStartRef = useRef({ x: 0, y: 0 })
  const draggedNodeRef = useRef<GraphNode | null>(null)
  const dragStartPosRef = useRef<{ x: number; y: number } | null>(null)
  const simulationRef = useRef<Simulation<GraphNode, GraphEdge> | null>(null)

  // Persist settings
  useEffect(() => {
    try {
      localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings))
    } catch {
      // ignore
    }
  }, [settings])

  // Active documents
  const activeDocs = useMemo(() => workspaces.filter((w) => !w.isDeleted), [workspaces])

  // Extract graph nodes and edges with unresolved link support (Obsidian-style)
  const { initialNodes, initialEdges } = useMemo(() => {
    if (activeDocs.length === 0) return { initialNodes: [], initialEdges: [] }

    // Map doc titles & IDs for lookup
    const docMapById = new Map<string, WorkspaceItem>()
    const docMapByTitle = new Map<string, WorkspaceItem>()

    activeDocs.forEach((doc) => {
      docMapById.set(doc.id, doc)
      const cleanTitle = (doc.title || '').trim().toLowerCase()
      if (
        cleanTitle &&
        cleanTitle !== 'untitled' &&
        cleanTitle !== 'documento sin título' &&
        cleanTitle !== 'sin título'
      ) {
        docMapByTitle.set(cleanTitle, doc)
      }
    })

    const rawNodesMap = new Map<string, GraphNode>()
    const edgeKeySet = new Set<string>()
    const rawEdges: GraphEdge[] = []

    // 1. Add active doc nodes
    activeDocs.forEach((doc) => {
      const isCurrent = doc.id === currentWorkspaceId
      const displayTitle =
        !doc.title || doc.title === 'Untitled' || doc.title === 'Documento sin título'
          ? 'Sin título'
          : doc.title

      rawNodesMap.set(doc.id, {
        id: doc.id,
        title: displayTitle,
        isCurrent,
        workspaceId: doc.id,
        degree: 0,
        radius: settings.nodeSize
      })
    })

    // Helper to add edges safely
    const addEdge = (sourceId: string, targetId: string, type: GraphEdge['type'] = 'link') => {
      if (sourceId === targetId) return
      const key1 = `${sourceId}-->${targetId}`
      const key2 = `${targetId}-->${sourceId}`
      if (edgeKeySet.has(key1) || edgeKeySet.has(key2)) return
      edgeKeySet.add(key1)

      rawEdges.push({
        id: `e-${sourceId}-${targetId}`,
        source: sourceId,
        target: targetId,
        type
      })

      const n1 = rawNodesMap.get(sourceId)
      if (n1) n1.degree += 1
      const n2 = rawNodesMap.get(targetId)
      if (n2) n2.degree += 1
    }

    // 2. Scan content of each doc for links, wikilinks [[...]], and tags
    activeDocs.forEach((doc) => {
      const content = doc.docContent || ''

      // a) Check data-note-id="..."
      const noteIdMatches = content.matchAll(/data-note-id="([^"]+)"/g)
      for (const m of noteIdMatches) {
        const targetId = m[1]
        if (docMapById.has(targetId)) {
          addEdge(doc.id, targetId, 'link')
        }
      }

      // b) Check <a href="#note=...">
      const noteHrefMatches = content.matchAll(/href="#note=([^"]+)"/g)
      for (const m of noteHrefMatches) {
        const targetId = m[1]
        if (docMapById.has(targetId)) {
          addEdge(doc.id, targetId, 'link')
        }
      }

      // c) Check Wikilinks [[Title]] or [[Title|Alias]]
      const wikilinkMatches = content.matchAll(/\[\[([^\]|]+)(?:\|[^\]]+)?\]\]/g)
      for (const m of wikilinkMatches) {
        const targetRaw = m[1].trim()
        const targetLower = targetRaw.toLowerCase()

        // Check if matching doc exists
        let targetDoc = docMapByTitle.get(targetLower)
        if (!targetDoc && docMapById.has(targetRaw)) {
          targetDoc = docMapById.get(targetRaw)
        }

        if (targetDoc) {
          addEdge(doc.id, targetDoc.id, 'wikilink')
        } else if (settings.showUnresolved && targetRaw.length > 0) {
          // Unresolved / ghost link (e.g. "cree un enlace")
          const ghostId = `unresolved:${targetLower}`
          if (!rawNodesMap.has(ghostId)) {
            rawNodesMap.set(ghostId, {
              id: ghostId,
              title: targetRaw,
              isUnresolved: true,
              degree: 0,
              radius: Math.max(3, settings.nodeSize - 1)
            })
          }
          addEdge(doc.id, ghostId, 'unresolved')
        }
      }

      // d) Check textual mentions of titles (length >= 3)
      docMapByTitle.forEach((otherDoc, titleLower) => {
        if (otherDoc.id !== doc.id && titleLower.length >= 3) {
          if (content.toLowerCase().includes(titleLower)) {
            addEdge(doc.id, otherDoc.id, 'mention')
          }
        }
      })

      // e) Tags: if enabled, create tag nodes
      if (settings.showTags && doc.tags && doc.tags.length > 0) {
        doc.tags.forEach((tag) => {
          const tagId = `tag:${tag.toLowerCase()}`
          if (!rawNodesMap.has(tagId)) {
            rawNodesMap.set(tagId, {
              id: tagId,
              title: `#${tag}`,
              isTag: true,
              degree: 0,
              radius: Math.max(3.5, settings.nodeSize - 1),
              color: '#a855f7'
            })
          }
          addEdge(doc.id, tagId, 'tag')
        })
      }
    })

    // Filter nodes by search query and orphan setting
    const query = settings.searchQuery.trim().toLowerCase()
    let filteredNodes = Array.from(rawNodesMap.values())

    if (query) {
      filteredNodes = filteredNodes.filter((n) => n.title.toLowerCase().includes(query))
    }

    if (!settings.showOrphans) {
      filteredNodes = filteredNodes.filter((n) => n.degree > 0)
    }

    if (!settings.showUnresolved) {
      filteredNodes = filteredNodes.filter((n) => !n.isUnresolved)
    }

    const validNodeIds = new Set(filteredNodes.map((n) => n.id))
    const filteredEdges = rawEdges.filter((e) => {
      const sId = typeof e.source === 'string' ? e.source : e.source.id
      const tId = typeof e.target === 'string' ? e.target : e.target.id
      return validNodeIds.has(sId) && validNodeIds.has(tId)
    })

    return { initialNodes: filteredNodes, initialEdges: filteredEdges }
  }, [
    activeDocs,
    currentWorkspaceId,
    settings.searchQuery,
    settings.showUnresolved,
    settings.showOrphans,
    settings.showTags,
    settings.nodeSize
  ])

  // Nodes and edges ref for simulation & canvas drawing
  const nodesRef = useRef<GraphNode[]>([])
  const edgesRef = useRef<GraphEdge[]>([])

  // Neighbor map for hover effects
  const neighborMap = useMemo(() => {
    const map = new Map<string, Set<string>>()
    const edgeSet = new Map<string, Set<string>>()

    initialEdges.forEach((e) => {
      const sId = typeof e.source === 'string' ? e.source : (e.source as GraphNode).id
      const tId = typeof e.target === 'string' ? e.target : (e.target as GraphNode).id

      if (!map.has(sId)) map.set(sId, new Set())
      if (!map.has(tId)) map.set(tId, new Set())
      map.get(sId)!.add(tId)
      map.get(tId)!.add(sId)

      if (!edgeSet.has(sId)) edgeSet.set(sId, new Set())
      if (!edgeSet.has(tId)) edgeSet.set(tId, new Set())
      edgeSet.get(sId)!.add(e.id)
      edgeSet.get(tId)!.add(e.id)
    })

    return { neighbors: map, edgeMap: edgeSet }
  }, [initialEdges])

  // Canvas drawing function (Obsidian-identical rendering)
  const drawCanvas = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const dpr = window.devicePixelRatio || 1
    const width = canvas.width / dpr
    const height = canvas.height / dpr

    ctx.save()
    ctx.clearRect(0, 0, width, height)

    // Deep slate Obsidian background
    ctx.fillStyle = '#1e1e1e'
    ctx.fillRect(0, 0, width, height)

    // Apply transform matrix (pan & zoom)
    const { x, y, k } = transformRef.current
    ctx.translate(x, y)
    ctx.scale(k, k)

    const isHovering = Boolean(hoveredNodeId)
    const connectedNeighbors = hoveredNodeId ? neighborMap.neighbors.get(hoveredNodeId) : null
    const connectedEdges = hoveredNodeId ? neighborMap.edgeMap.get(hoveredNodeId) : null

    // 1. Draw Links (Edges)
    const edges = edgesRef.current
    for (let i = 0; i < edges.length; i++) {
      const edge = edges[i]
      const source = edge.source as GraphNode
      const target = edge.target as GraphNode
      if (!source || !target || source.x === undefined || target.x === undefined) continue

      const isConnected = isHovering && connectedEdges?.has(edge.id)
      const edgeAlpha = !isHovering ? 0.22 : isConnected ? 0.85 : 0.05
      const lineWidth = isConnected
        ? Math.max(1.5, settings.linkThickness * 1.5)
        : settings.linkThickness

      ctx.beginPath()
      ctx.moveTo(source.x, source.y!)
      ctx.lineTo(target.x, target.y!)
      ctx.strokeStyle = isConnected ? '#e0e0e0' : 'rgba(255, 255, 255, 0.2)'
      ctx.lineWidth = lineWidth
      ctx.globalAlpha = edgeAlpha
      ctx.stroke()

      // Optional subtle direction arrow
      if (settings.showArrows && isConnected) {
        const dx = target.x - source.x
        const dy = (target.y || 0) - (source.y || 0)
        const angle = Math.atan2(dy, dx)
        const arrowDist = target.radius + 5
        const ax = target.x - Math.cos(angle) * arrowDist
        const ay = (target.y || 0) - Math.sin(angle) * arrowDist
        const arrowSize = 4.5

        ctx.beginPath()
        ctx.moveTo(ax, ay)
        ctx.lineTo(
          ax - arrowSize * Math.cos(angle - Math.PI / 6),
          ay - arrowSize * Math.sin(angle - Math.PI / 6)
        )
        ctx.lineTo(
          ax - arrowSize * Math.cos(angle + Math.PI / 6),
          ay - arrowSize * Math.sin(angle + Math.PI / 6)
        )
        ctx.closePath()
        ctx.fillStyle = '#e0e0e0'
        ctx.fill()
      }
    }

    // 2. Draw Nodes (Dots & Labels)
    const nodes = nodesRef.current
    for (let i = 0; i < nodes.length; i++) {
      const node = nodes[i]
      if (node.x === undefined || node.y === undefined) continue

      const isHovered = hoveredNodeId === node.id
      const isNeighbor = Boolean(hoveredNodeId && connectedNeighbors?.has(node.id))
      const isHighlighted = isHovered || isNeighbor
      const nodeAlpha = !isHovering ? 1.0 : isHighlighted ? 1.0 : 0.15

      ctx.globalAlpha = nodeAlpha
      const radius = node.radius || settings.nodeSize

      // Halo on hovered node
      if (isHovered) {
        ctx.beginPath()
        ctx.arc(node.x, node.y, radius + 4, 0, Math.PI * 2)
        ctx.fillStyle = 'rgba(255, 255, 255, 0.18)'
        ctx.fill()
      }

      // Draw circular dot
      ctx.beginPath()
      ctx.arc(node.x, node.y, radius, 0, Math.PI * 2)

      if (node.isUnresolved) {
        // Ghost / Unresolved node (Obsidian: dimmer translucent gray)
        ctx.fillStyle = 'rgba(120, 120, 120, 0.65)'
        ctx.fill()
      } else if (node.isTag) {
        // Tag node
        ctx.fillStyle = node.color || '#a855f7'
        ctx.fill()
      } else {
        // Regular note dot (Obsidian: clean white / soft light-gray)
        ctx.fillStyle = node.isCurrent ? '#ffffff' : '#dcdcdc'
        ctx.fill()

        // Highlight ring if current document
        if (node.isCurrent) {
          ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)'
          ctx.lineWidth = 1.5
          ctx.stroke()
        }
      }

      // Draw label below node
      if (settings.showLabels) {
        ctx.font = '10.5px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
        ctx.textAlign = 'center'
        ctx.textBaseline = 'top'

        if (isHighlighted) {
          ctx.fillStyle = '#ffffff'
        } else if (node.isUnresolved) {
          ctx.fillStyle = 'rgba(160, 160, 160, 0.65)'
        } else {
          ctx.fillStyle = '#9e9e9e'
        }

        ctx.fillText(node.title, node.x, node.y + radius + 5)
      }
    }

    ctx.restore()
  }, [settings, hoveredNodeId, neighborMap])

  // Setup D3 Force Simulation with Technical Obsidian parameters
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const dpr = window.devicePixelRatio || 1
    const width = canvas.width / dpr
    const height = canvas.height / dpr

    // Maintain previous node positions for smooth transitions
    const prevPosMap = new Map<string, { x: number; y: number; vx?: number; vy?: number }>()
    nodesRef.current.forEach((n) => {
      if (n.x !== undefined && n.y !== undefined) {
        prevPosMap.set(n.id, { x: n.x, y: n.y, vx: n.vx, vy: n.vy })
      }
    })

    const total = initialNodes.length
    const newNodes: GraphNode[] = initialNodes.map((n, idx) => {
      const prev = prevPosMap.get(n.id)
      const angle = (idx / Math.max(1, total)) * 2 * Math.PI
      // Start in a balanced initial cluster around center (radius ~70-110px)
      const initR = Math.min(100, 40 + total * 12)
      return {
        ...n,
        x: prev ? prev.x : width / 2 + initR * Math.cos(angle) + (Math.random() - 0.5) * 12,
        y: prev ? prev.y : height / 2 + initR * Math.sin(angle) + (Math.random() - 0.5) * 12,
        vx: prev?.vx || 0,
        vy: prev?.vy || 0
      }
    })

    const newEdges: GraphEdge[] = initialEdges.map((e) => ({ ...e }))

    nodesRef.current = newNodes
    edgesRef.current = newEdges

    // Stop old simulation
    if (simulationRef.current) {
      simulationRef.current.stop()
    }

    // Technical Obsidian Force Setup:
    // 1. forceLink: balanced link distance (120px default)
    // 2. forceManyBody: comfortable repulsion (-120) with distanceMax(500)
    // 3. forceX & forceY: gentle center drift (0.015) so nodes don't wander off, without collapsing them
    // 4. forceCenter: keeps barycenter at center
    // 5. forceCollide: 26px padding so labels and dots have clear breathing room
    const sim = forceSimulation<GraphNode>(newNodes)
      .force(
        'link',
        forceLink<GraphNode, GraphEdge>(newEdges)
          .id((d) => d.id)
          .distance(settings.linkDistance)
          .strength(settings.linkStrength)
      )
      .force(
        'charge',
        forceManyBody()
          .strength(settings.repelStrength)
          .distanceMax(500)
      )
      .force('x', forceX(width / 2).strength(settings.centerStrength * 0.02))
      .force('y', forceY(height / 2).strength(settings.centerStrength * 0.02))
      .force('center', forceCenter(width / 2, height / 2))
      .force(
        'collision',
        forceCollide()
          .radius((d: any) => (d.radius || settings.nodeSize) + 26)
          .strength(0.85)
      )
      .velocityDecay(0.35)
      .alphaDecay(0.02)

    sim.on('tick', () => {
      drawCanvas()
    })

    simulationRef.current = sim

    return () => {
      sim.stop()
    }
  }, [initialNodes, initialEdges, settings, drawCanvas])

  // Handle Resize & Canvas resolution
  useEffect(() => {
    const handleResize = () => {
      const container = containerRef.current
      const canvas = canvasRef.current
      if (!container || !canvas) return

      const dpr = window.devicePixelRatio || 1
      const rect = container.getBoundingClientRect()

      canvas.width = rect.width * dpr
      canvas.height = rect.height * dpr
      canvas.style.width = `${rect.width}px`
      canvas.style.height = `${rect.height}px`

      const ctx = canvas.getContext('2d')
      if (ctx) {
        ctx.scale(dpr, dpr)
      }

      drawCanvas()
    }

    handleResize()
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [drawCanvas])

  // Fit View helper (In Obsidian: small graphs stay 1:1, only huge graphs scale down!)
  const fitView = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const dpr = window.devicePixelRatio || 1
    const width = canvas.width / dpr
    const height = canvas.height / dpr

    const nodes = nodesRef.current
    if (nodes.length === 0) {
      setTransform({ x: 0, y: 0, k: 1 })
      return
    }

    let minX = Infinity,
      maxX = -Infinity,
      minY = Infinity,
      maxY = -Infinity

    nodes.forEach((n) => {
      if (n.x !== undefined && n.y !== undefined) {
        minX = Math.min(minX, n.x)
        maxX = Math.max(maxX, n.x)
        minY = Math.min(minY, n.y)
        maxY = Math.max(maxY, n.y)
      }
    })

    const graphWidth = maxX - minX || 100
    const graphHeight = maxY - minY || 100
    const padding = 160

    // Technical Obsidian rule: MAX SCALE IS 1.0!
    // Never stretch a 4-node graph across the screen; keep it 1:1 in the center.
    const scale = Math.min(
      1.0,
      Math.max(0.2, Math.min((width - padding) / graphWidth, (height - padding) / graphHeight))
    )

    const centerX = (minX + maxX) / 2
    const centerY = (minY + maxY) / 2

    setTransform({
      x: width / 2 - centerX * scale,
      y: height / 2 - centerY * scale,
      k: scale
    })
  }, [])

  // Auto fit on initial load (stays at 1:1 centered)
  useEffect(() => {
    const timer = setTimeout(() => {
      fitView()
    }, 400)
    return () => clearTimeout(timer)
  }, [fitView])

  // Redraw when transform changes
  useEffect(() => {
    drawCanvas()
  }, [transform, drawCanvas])

  // Mouse coordinate to world space
  const screenToWorld = useCallback((clientX: number, clientY: number) => {
    const canvas = canvasRef.current
    if (!canvas) return { x: 0, y: 0 }
    const rect = canvas.getBoundingClientRect()
    const mouseX = clientX - rect.left
    const mouseY = clientY - rect.top
    const { x, y, k } = transformRef.current
    return {
      x: (mouseX - x) / k,
      y: (mouseY - y) / k
    }
  }, [])

  // Find node at world coordinate
  const getNodeAtPoint = useCallback((worldX: number, worldY: number): GraphNode | null => {
    const nodes = nodesRef.current
    for (let i = nodes.length - 1; i >= 0; i--) {
      const node = nodes[i]
      if (node.x === undefined || node.y === undefined) continue
      const dx = node.x - worldX
      const dy = node.y - worldY
      const dist = Math.sqrt(dx * dx + dy * dy)
      const hitRadius = (node.radius || 5) + 10
      if (dist <= hitRadius) {
        return node
      }
    }
    return null
  }, [])

  // Mouse Handlers
  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (e.button !== 0) return // Left click only
    const { x: worldX, y: worldY } = screenToWorld(e.clientX, e.clientY)
    const clickedNode = getNodeAtPoint(worldX, worldY)

    if (clickedNode) {
      draggedNodeRef.current = clickedNode
      dragStartPosRef.current = { x: e.clientX, y: e.clientY }
      clickedNode.fx = clickedNode.x
      clickedNode.fy = clickedNode.y

      if (simulationRef.current) {
        simulationRef.current.alphaTarget(0.3).restart()
      }
    } else {
      isPanningRef.current = true
      panStartRef.current = {
        x: e.clientX - transformRef.current.x,
        y: e.clientY - transformRef.current.y
      }
    }
  }

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const { x: worldX, y: worldY } = screenToWorld(e.clientX, e.clientY)

    if (draggedNodeRef.current) {
      draggedNodeRef.current.fx = worldX
      draggedNodeRef.current.fy = worldY
      drawCanvas()
    } else if (isPanningRef.current) {
      const newX = e.clientX - panStartRef.current.x
      const newY = e.clientY - panStartRef.current.y
      setTransform((prev) => ({ ...prev, x: newX, y: newY }))
    } else {
      // Hover detection
      const nodeUnderMouse = getNodeAtPoint(worldX, worldY)
      const newHoverId = nodeUnderMouse ? nodeUnderMouse.id : null

      if (newHoverId !== hoveredNodeId) {
        setHoveredNodeId(newHoverId)
      }
    }
  }

  const handleMouseUp = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (draggedNodeRef.current) {
      const startPos = dragStartPosRef.current
      const distMoved = startPos
        ? Math.hypot(e.clientX - startPos.x, e.clientY - startPos.y)
        : 0

      const node = draggedNodeRef.current

      // If clicked without substantial dragging (< 5px), treat as selection
      if (distMoved < 5) {
        if (node.isUnresolved) {
          // Unresolved note clicked: create note
          if (onCreateWorkspace) {
            onCreateWorkspace(node.title)
            toast.success(`Nota creada: "${node.title}"`)
          } else {
            toast.info(`Enlace no resuelto a "${node.title}"`)
          }
        } else if (node.workspaceId) {
          onSelectWorkspace(node.workspaceId)
        }
      }

      node.fx = null
      node.fy = null
      draggedNodeRef.current = null
      dragStartPosRef.current = null

      if (simulationRef.current) {
        simulationRef.current.alphaTarget(0)
      }
    }

    if (isPanningRef.current) {
      isPanningRef.current = false
    }
  }

  // Smooth Zoom with mouse wheel
  const handleWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {
    e.preventDefault()
    const canvas = canvasRef.current
    if (!canvas) return

    const rect = canvas.getBoundingClientRect()
    const mouseX = e.clientX - rect.left
    const mouseY = e.clientY - rect.top

    const zoomFactor = e.deltaY < 0 ? 1.12 : 0.89
    const { x, y, k } = transformRef.current
    const newK = Math.min(4.0, Math.max(0.15, k * zoomFactor))

    // Keep point under cursor invariant
    const newX = mouseX - (mouseX - x) * (newK / k)
    const newY = mouseY - (mouseY - y) * (newK / k)

    setTransform({ x: newX, y: newY, k: newK })
  }

  // Touch Handlers for mobile pan, pinch-zoom, node drag & tap
  const handleTouchStart = (e: React.TouchEvent<HTMLCanvasElement>) => {
    if (e.touches.length === 2) {
      isPanningRef.current = false
      draggedNodeRef.current = null
      const dx = e.touches[0].clientX - e.touches[1].clientX
      const dy = e.touches[0].clientY - e.touches[1].clientY
      pinchDistRef.current = Math.hypot(dx, dy)
      return
    }
    if (e.touches.length !== 1) return
    const touch = e.touches[0]
    const { x: worldX, y: worldY } = screenToWorld(touch.clientX, touch.clientY)
    const tappedNode = getNodeAtPoint(worldX, worldY)

    if (tappedNode) {
      draggedNodeRef.current = tappedNode
      dragStartPosRef.current = { x: touch.clientX, y: touch.clientY }
      tappedNode.fx = tappedNode.x
      tappedNode.fy = tappedNode.y
      if (simulationRef.current) {
        simulationRef.current.alphaTarget(0.3).restart()
      }
    } else {
      isPanningRef.current = true
      panStartRef.current = {
        x: touch.clientX - transformRef.current.x,
        y: touch.clientY - transformRef.current.y
      }
    }
  }

  const handleTouchMove = (e: React.TouchEvent<HTMLCanvasElement>) => {
    if (e.touches.length === 2 && pinchDistRef.current !== null) {
      const canvas = canvasRef.current
      if (!canvas) return
      const dx = e.touches[0].clientX - e.touches[1].clientX
      const dy = e.touches[0].clientY - e.touches[1].clientY
      const dist = Math.hypot(dx, dy)
      if (dist <= 0) return

      const rect = canvas.getBoundingClientRect()
      const midX = (e.touches[0].clientX + e.touches[1].clientX) / 2 - rect.left
      const midY = (e.touches[0].clientY + e.touches[1].clientY) / 2 - rect.top

      const scale = dist / pinchDistRef.current
      pinchDistRef.current = dist

      const { x, y, k } = transformRef.current
      const newK = Math.min(4.0, Math.max(0.15, k * scale))
      const newX = midX - (midX - x) * (newK / k)
      const newY = midY - (midY - y) * (newK / k)
      setTransform({ x: newX, y: newY, k: newK })
      return
    }
    if (e.touches.length !== 1) return
    const touch = e.touches[0]

    if (draggedNodeRef.current) {
      const { x: worldX, y: worldY } = screenToWorld(touch.clientX, touch.clientY)
      draggedNodeRef.current.fx = worldX
      draggedNodeRef.current.fy = worldY
      drawCanvas()
    } else if (isPanningRef.current) {
      const newX = touch.clientX - panStartRef.current.x
      const newY = touch.clientY - panStartRef.current.y
      setTransform((prev) => ({ ...prev, x: newX, y: newY }))
    }
  }

  const handleTouchEnd = (e: React.TouchEvent<HTMLCanvasElement>) => {
    if (e.touches.length < 2) {
      pinchDistRef.current = null
    }
    if (draggedNodeRef.current && e.changedTouches.length > 0) {
      const touch = e.changedTouches[0]
      const startPos = dragStartPosRef.current
      const distMoved = startPos
        ? Math.hypot(touch.clientX - startPos.x, touch.clientY - startPos.y)
        : 0
      const node = draggedNodeRef.current

      if (distMoved < 8) {
        if (node.isUnresolved) {
          if (onCreateWorkspace) {
            onCreateWorkspace(node.title)
            toast.success(`Nota creada: "${node.title}"`)
          } else {
            toast.info(`Enlace no resuelto a "${node.title}"`)
          }
        } else if (node.workspaceId) {
          onSelectWorkspace(node.workspaceId)
        }
      }

      node.fx = null
      node.fy = null
      draggedNodeRef.current = null
      dragStartPosRef.current = null

      if (simulationRef.current) {
        simulationRef.current.alphaTarget(0)
      }
    }
    if (e.touches.length === 0) {
      isPanningRef.current = false
    }
  }

  // Export as PNG
  const handleExportPNG = () => {
    const canvas = canvasRef.current
    if (!canvas) return
    const link = document.createElement('a')
    link.download = `seven-note-grafo-${new Date().toISOString().slice(0, 10)}.png`
    link.href = canvas.toDataURL('image/png')
    link.click()
    toast.success('Grafo exportado como imagen')
    setIsMenuOpen(false)
  }

  // Restart Force Simulation
  const handleReheatSimulation = () => {
    if (simulationRef.current) {
      simulationRef.current.alpha(0.6).restart()
      toast.success('Simulación reiniciada')
    }
  }

  return (
    <div className="flex-1 flex flex-col h-full bg-[#1e1e1e] text-neutral-200 select-none overflow-hidden relative font-sans">
      {/* 1. Obsidian Top Navigation Sub-Header */}
      <header className="h-9 px-3 border-b border-[#2b2b2b] bg-[#1a1a1a] flex items-center justify-between shrink-0 z-20 text-xs">
        {/* Left: Navigation buttons and View Title */}
        <div className="flex items-center gap-1.5 min-w-0">
          <button
            onClick={onBack}
            className="w-6 h-6 rounded flex items-center justify-center text-neutral-400 hover:text-white hover:bg-white/5 transition cursor-pointer"
            title="Atrás"
          >
            <ChevronLeft size={15} />
          </button>
          <button
            onClick={onForward}
            className="w-6 h-6 rounded flex items-center justify-center text-neutral-400 hover:text-white hover:bg-white/5 transition cursor-pointer"
            title="Adelante"
          >
            <ChevronRight size={15} />
          </button>
          <span className="text-neutral-300 font-medium ml-1 flex items-center gap-1.5 truncate">
            Vista gráfica
          </span>
        </div>

        {/* Right: Controls & Actions (Obsidian style) */}
        <div className="flex items-center gap-1 shrink-0">
          {/* Quick Fit / Wand Button */}
          <button
            onClick={fitView}
            className="w-7 h-7 rounded flex items-center justify-center text-neutral-400 hover:text-white hover:bg-white/5 transition cursor-pointer"
            title="Ajustar y centrar grafo"
          >
            <Wand2 size={14} />
          </button>

          {/* Settings Gear (Ajustes del gráfico) */}
          <button
            onClick={() => setIsSettingsOpen((prev) => !prev)}
            className={`w-7 h-7 rounded flex items-center justify-center transition cursor-pointer ${
              isSettingsOpen
                ? 'bg-white/10 text-white ring-1 ring-white/20'
                : 'text-neutral-400 hover:text-white hover:bg-white/5'
            }`}
            title="Ajustes del gráfico"
          >
            <Settings size={14} />
          </button>

          {/* More Options Dropdown */}
          <div className="relative">
            <button
              onClick={() => setIsMenuOpen((prev) => !prev)}
              className="w-7 h-7 rounded flex items-center justify-center text-neutral-400 hover:text-white hover:bg-white/5 transition cursor-pointer"
              title="Más opciones"
            >
              <MoreVertical size={14} />
            </button>

            {isMenuOpen && (
              <>
                <div
                  className="fixed inset-0 z-30"
                  onClick={() => setIsMenuOpen(false)}
                />
                <div className="absolute right-0 top-8 w-48 bg-[#222] border border-[#333] rounded-lg shadow-2xl p-1 z-40 text-xs text-neutral-200 animate-in fade-in zoom-in-95 duration-100">
                  <button
                    onClick={() => {
                      fitView()
                      setIsMenuOpen(false)
                    }}
                    className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded hover:bg-white/10 text-left transition cursor-pointer"
                  >
                    <Maximize2 size={13} className="text-neutral-400" />
                    <span>Ajustar vista</span>
                  </button>
                  <button
                    onClick={() => {
                      handleReheatSimulation()
                      setIsMenuOpen(false)
                    }}
                    className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded hover:bg-white/10 text-left transition cursor-pointer"
                  >
                    <RotateCcw size={13} className="text-neutral-400" />
                    <span>Reiniciar física</span>
                  </button>
                  <button
                    onClick={handleExportPNG}
                    className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded hover:bg-white/10 text-left transition cursor-pointer"
                  >
                    <Download size={13} className="text-neutral-400" />
                    <span>Exportar como imagen</span>
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </header>

      {/* 2. Interactive Canvas Area */}
      <div
        ref={containerRef}
        className="flex-1 w-full h-full relative overflow-hidden bg-[#1e1e1e]"
      >
        <canvas
          ref={canvasRef}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onWheel={handleWheel}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          onDoubleClick={fitView}
          className={`w-full h-full block touch-none ${
            hoveredNodeId ? 'cursor-pointer' : isPanningRef.current ? 'cursor-grabbing' : 'cursor-default'
          }`}
        />

        {/* 3. Obsidian "Ajustes del gráfico" (Floating Settings Drawer) */}
        {isSettingsOpen && (
          <div className="absolute top-3 left-3 right-3 sm:left-auto sm:right-3 sm:w-80 max-h-[calc(100%-24px)] overflow-y-auto bg-[#1e1e1e]/95 backdrop-blur-md border border-[#333] rounded-xl shadow-2xl z-30 flex flex-col text-xs text-neutral-200 animate-in fade-in slide-in-from-top-2 duration-150">
            {/* Header */}
            <div className="px-3 py-2.5 border-b border-[#2e2e2e] flex items-center justify-between">
              <span className="font-semibold text-neutral-100 flex items-center gap-2">
                <Sliders size={13} className="text-neutral-400" />
                Ajustes del gráfico
              </span>
              <button
                onClick={() => setIsSettingsOpen(false)}
                className="w-5 h-5 rounded flex items-center justify-center text-neutral-400 hover:text-white hover:bg-white/10 transition cursor-pointer"
              >
                <X size={13} />
              </button>
            </div>

            {/* Navigation tabs: Filtros / Fuerzas / Pantalla */}
            <div className="flex border-b border-[#2e2e2e] bg-[#181818]/50 p-1 gap-1">
              <button
                onClick={() => setActiveSettingsTab('filters')}
                className={`flex-1 py-1 rounded text-center font-medium transition cursor-pointer ${
                  activeSettingsTab === 'filters'
                    ? 'bg-white/10 text-white'
                    : 'text-neutral-400 hover:text-neutral-200'
                }`}
              >
                Filtros
              </button>
              <button
                onClick={() => setActiveSettingsTab('forces')}
                className={`flex-1 py-1 rounded text-center font-medium transition cursor-pointer ${
                  activeSettingsTab === 'forces'
                    ? 'bg-white/10 text-white'
                    : 'text-neutral-400 hover:text-neutral-200'
                }`}
              >
                Fuerzas
              </button>
              <button
                onClick={() => setActiveSettingsTab('display')}
                className={`flex-1 py-1 rounded text-center font-medium transition cursor-pointer ${
                  activeSettingsTab === 'display'
                    ? 'bg-white/10 text-white'
                    : 'text-neutral-400 hover:text-neutral-200'
                }`}
              >
                Pantalla
              </button>
            </div>

            {/* Tab Body */}
            <div className="p-3 space-y-3.5 max-h-[70vh] overflow-y-auto">
              {/* FILTROS TAB */}
              {activeSettingsTab === 'filters' && (
                <div className="space-y-3">
                  {/* Search Filter */}
                  <div>
                    <label className="text-[11px] text-neutral-400 mb-1 block">
                      Buscar archivos
                    </label>
                    <div className="relative">
                      <Search
                        size={13}
                        className="absolute left-2.5 top-1/2 -translate-y-1/2 text-neutral-500"
                      />
                      <input
                        type="text"
                        value={settings.searchQuery}
                        onChange={(e) =>
                          setSettings((s) => ({ ...s, searchQuery: e.target.value }))
                        }
                        placeholder="Filtrar por nombre..."
                        className="w-full bg-[#141414] border border-[#333] rounded-md pl-8 pr-2.5 py-1 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-indigo-500"
                      />
                    </div>
                  </div>

                  {/* Toggle: Enlaces no existentes (Obsidian Unresolved links) */}
                  <label className="flex items-center justify-between cursor-pointer py-1">
                    <span className="text-neutral-300">Enlaces no existentes</span>
                    <input
                      type="checkbox"
                      checked={settings.showUnresolved}
                      onChange={(e) =>
                        setSettings((s) => ({ ...s, showUnresolved: e.target.checked }))
                      }
                      className="rounded accent-indigo-500 cursor-pointer"
                    />
                  </label>

                  {/* Toggle: Huérfanos (Obsidian Orphans) */}
                  <label className="flex items-center justify-between cursor-pointer py-1">
                    <span className="text-neutral-300">Huérfanos</span>
                    <input
                      type="checkbox"
                      checked={settings.showOrphans}
                      onChange={(e) =>
                        setSettings((s) => ({ ...s, showOrphans: e.target.checked }))
                      }
                      className="rounded accent-indigo-500 cursor-pointer"
                    />
                  </label>

                  {/* Toggle: Etiquetas (Tags as nodes) */}
                  <label className="flex items-center justify-between cursor-pointer py-1">
                    <span className="text-neutral-300">Etiquetas</span>
                    <input
                      type="checkbox"
                      checked={settings.showTags}
                      onChange={(e) =>
                        setSettings((s) => ({ ...s, showTags: e.target.checked }))
                      }
                      className="rounded accent-indigo-500 cursor-pointer"
                    />
                  </label>
                </div>
              )}

              {/* FUERZAS TAB (Obsidian technical forces) */}
              {activeSettingsTab === 'forces' && (
                <div className="space-y-3">
                  {/* Center Force */}
                  <div>
                    <div className="flex justify-between text-[11px] text-neutral-400 mb-1">
                      <span>Fuerza del centro</span>
                      <span>{Math.round(settings.centerStrength * 100)}%</span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="1"
                      step="0.05"
                      value={settings.centerStrength}
                      onChange={(e) =>
                        setSettings((s) => ({
                          ...s,
                          centerStrength: parseFloat(e.target.value)
                        }))
                      }
                      className="w-full accent-indigo-500 cursor-pointer"
                    />
                  </div>

                  {/* Repel Force */}
                  <div>
                    <div className="flex justify-between text-[11px] text-neutral-400 mb-1">
                      <span>Fuerza de repulsión</span>
                      <span>{Math.abs(settings.repelStrength)}</span>
                    </div>
                    <input
                      type="range"
                      min="-300"
                      max="-40"
                      step="10"
                      value={settings.repelStrength}
                      onChange={(e) =>
                        setSettings((s) => ({
                          ...s,
                          repelStrength: parseFloat(e.target.value)
                        }))
                      }
                      className="w-full accent-indigo-500 cursor-pointer"
                    />
                  </div>

                  {/* Link Distance */}
                  <div>
                    <div className="flex justify-between text-[11px] text-neutral-400 mb-1">
                      <span>Distancia del enlace</span>
                      <span>{settings.linkDistance}px</span>
                    </div>
                    <input
                      type="range"
                      min="50"
                      max="250"
                      step="5"
                      value={settings.linkDistance}
                      onChange={(e) =>
                        setSettings((s) => ({
                          ...s,
                          linkDistance: parseFloat(e.target.value)
                        }))
                      }
                      className="w-full accent-indigo-500 cursor-pointer"
                    />
                  </div>

                  {/* Link Strength */}
                  <div>
                    <div className="flex justify-between text-[11px] text-neutral-400 mb-1">
                      <span>Fuerza del enlace</span>
                      <span>{Math.round(settings.linkStrength * 100)}%</span>
                    </div>
                    <input
                      type="range"
                      min="0.2"
                      max="1"
                      step="0.05"
                      value={settings.linkStrength}
                      onChange={(e) =>
                        setSettings((s) => ({
                          ...s,
                          linkStrength: parseFloat(e.target.value)
                        }))
                      }
                      className="w-full accent-indigo-500 cursor-pointer"
                    />
                  </div>
                </div>
              )}

              {/* PANTALLA TAB */}
              {activeSettingsTab === 'display' && (
                <div className="space-y-3">
                  {/* Node Size */}
                  <div>
                    <div className="flex justify-between text-[11px] text-neutral-400 mb-1">
                      <span>Tamaño de nodos</span>
                      <span>{settings.nodeSize}px</span>
                    </div>
                    <input
                      type="range"
                      min="3"
                      max="9"
                      step="0.5"
                      value={settings.nodeSize}
                      onChange={(e) =>
                        setSettings((s) => ({
                          ...s,
                          nodeSize: parseFloat(e.target.value)
                        }))
                      }
                      className="w-full accent-indigo-500 cursor-pointer"
                    />
                  </div>

                  {/* Link Thickness */}
                  <div>
                    <div className="flex justify-between text-[11px] text-neutral-400 mb-1">
                      <span>Grosor de enlaces</span>
                      <span>{settings.linkThickness}px</span>
                    </div>
                    <input
                      type="range"
                      min="0.5"
                      max="3"
                      step="0.5"
                      value={settings.linkThickness}
                      onChange={(e) =>
                        setSettings((s) => ({
                          ...s,
                          linkThickness: parseFloat(e.target.value)
                        }))
                      }
                      className="w-full accent-indigo-500 cursor-pointer"
                    />
                  </div>

                  {/* Toggle: Mostrar texto / etiquetas */}
                  <label className="flex items-center justify-between cursor-pointer py-1">
                    <span className="text-neutral-300">Mostrar etiquetas</span>
                    <input
                      type="checkbox"
                      checked={settings.showLabels}
                      onChange={(e) =>
                        setSettings((s) => ({ ...s, showLabels: e.target.checked }))
                      }
                      className="rounded accent-indigo-500 cursor-pointer"
                    />
                  </label>

                  {/* Toggle: Mostrar flechas */}
                  <label className="flex items-center justify-between cursor-pointer py-1">
                    <span className="text-neutral-300">Mostrar flechas de dirección</span>
                    <input
                      type="checkbox"
                      checked={settings.showArrows}
                      onChange={(e) =>
                        setSettings((s) => ({ ...s, showArrows: e.target.checked }))
                      }
                      className="rounded accent-indigo-500 cursor-pointer"
                    />
                  </label>
                </div>
              )}

              {/* Reset to defaults button */}
              <div className="pt-2 border-t border-[#2e2e2e]">
                <button
                  onClick={() => {
                    setSettings(DEFAULT_SETTINGS)
                    toast.success('Valores predeterminados restablecidos')
                  }}
                  className="w-full py-1.5 px-2 rounded bg-white/5 hover:bg-white/10 text-neutral-300 hover:text-white transition cursor-pointer text-center"
                >
                  Restablecer valores
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
