import { useMemo } from 'react'
import {
  ReactFlow,
  Background,
  Controls,
  type Node,
  type Edge,
  BackgroundVariant
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { X, Network, ExternalLink } from 'lucide-react'
import { type WorkspaceItem } from '../../db'

interface KnowledgeGraphModalProps {
  isOpen: boolean
  onClose: () => void
  workspaces: WorkspaceItem[]
  currentWorkspaceId: string
  onSelectWorkspace: (id: string) => void
}

export function KnowledgeGraphModal({
  isOpen,
  onClose,
  workspaces,
  currentWorkspaceId,
  onSelectWorkspace
}: KnowledgeGraphModalProps) {
  // Generate nodes and edges from bidirectional links and tags
  const { nodes, edges } = useMemo(() => {
    if (!isOpen || workspaces.length === 0) return { nodes: [], edges: [] }

    const activeDocs = workspaces.filter((w) => !w.isDeleted)
    const total = activeDocs.length
    const radius = Math.max(220, total * 45)

    const generatedNodes: Node[] = activeDocs.map((doc, idx) => {
      const angle = (idx / total) * 2 * Math.PI
      const x = 400 + radius * Math.cos(angle)
      const y = 300 + radius * Math.sin(angle)
      const isCurrent = doc.id === currentWorkspaceId

      return {
        id: doc.id,
        position: { x, y },
        data: {
          label: (
            <div
              className={`flex items-center gap-2 px-3 py-1.5 rounded-full shadow-lg border backdrop-blur-md transition-transform cursor-pointer hover:scale-110 ${
                isCurrent
                  ? 'bg-indigo-600 text-white border-indigo-400 ring-2 ring-indigo-400/50'
                  : 'bg-white/90 dark:bg-neutral-800/90 text-neutral-800 dark:text-neutral-100 border-black/10 dark:border-white/10'
              }`}
              onClick={() => {
                onSelectWorkspace(doc.id)
                onClose()
              }}
            >
              <span className="text-sm">{doc.icon || '📄'}</span>
              <span className="text-xs font-semibold max-w-[120px] truncate">{doc.title || 'Sin título'}</span>
              <ExternalLink className="w-3 h-3 opacity-60" />
            </div>
          )
        },
        type: 'default',
        style: {
          background: 'transparent',
          border: 'none',
          padding: 0
        }
      }
    })

    const generatedEdges: Edge[] = []

    // Connect documents that share tags or mention each other
    for (let i = 0; i < activeDocs.length; i++) {
      for (let j = i + 1; j < activeDocs.length; j++) {
        const docA = activeDocs[i]
        const docB = activeDocs[j]

        // Check shared tags
        const commonTags = (docA.tags || []).filter((t) => (docB.tags || []).includes(t))

        // Check if docA references docB in HTML content
        const mentionsB = Boolean(docA.docContent?.includes(docB.id) || (docB.title && docA.docContent?.includes(docB.title)))
        const mentionsA = Boolean(docB.docContent?.includes(docA.id) || (docA.title && docB.docContent?.includes(docA.title)))
        const isLinked = mentionsA || mentionsB

        if (commonTags.length > 0 || isLinked) {
          generatedEdges.push({
            id: `edge-${docA.id}-${docB.id}`,
            source: docA.id,
            target: docB.id,
            animated: isLinked,
            style: {
              stroke: isLinked ? '#6366f1' : '#94a3b8',
              strokeWidth: isLinked ? 2 : 1
            }
          })
        }
      }
    }

    return { nodes: generatedNodes, edges: generatedEdges }
  }, [isOpen, workspaces, currentWorkspaceId])

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full h-[85vh] max-w-5xl bg-neutral-900/95 border border-white/10 rounded-2xl shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 bg-neutral-900">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
              <Network className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                Grafo Global de Conocimiento
                <span className="text-xs px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 font-mono">
                  {workspaces.filter((w) => !w.isDeleted).length} notas
                </span>
              </h2>
              <p className="text-xs text-neutral-400">
                Visualiza las interconexiones entre tus documentos basadas en enlaces bidireccionales y etiquetas compartidas (Estilo Obsidian / Roam).
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Graph Canvas */}
        <div className="flex-1 w-full h-full relative">
          <ReactFlow
            nodes={nodes}
            edges={edges}
            fitView
            attributionPosition="bottom-right"
          >
            <Background variant={BackgroundVariant.Dots} gap={20} size={1} color="#333" />
            <Controls className="!bg-neutral-800 !border-white/10 !text-white fill-white" />
          </ReactFlow>
        </div>
      </div>
    </div>
  )
}
