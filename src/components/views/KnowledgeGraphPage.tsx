import React, { useMemo } from 'react'
import {
  ReactFlow,
  Background,
  Controls,
  type Node,
  type Edge,
  BackgroundVariant
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { Network, ExternalLink } from 'lucide-react'
import { type WorkspaceItem } from '../../db'

interface KnowledgeGraphPageProps {
  workspaces: WorkspaceItem[]
  currentWorkspaceId?: string
  onSelectWorkspace: (id: string) => void
}

export const KnowledgeGraphPage: React.FC<KnowledgeGraphPageProps> = ({
  workspaces,
  currentWorkspaceId,
  onSelectWorkspace
}) => {
  const activeDocs = workspaces.filter((w) => !w.isDeleted)

  const { nodes, edges } = useMemo(() => {
    if (activeDocs.length === 0) return { nodes: [], edges: [] }

    const total = activeDocs.length
    const radius = Math.max(260, total * 55)

    const generatedNodes: Node[] = activeDocs.map((doc, idx) => {
      const angle = (idx / total) * 2 * Math.PI
      const x = 500 + radius * Math.cos(angle)
      const y = 350 + radius * Math.sin(angle)
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
                  : 'bg-neutral-800/90 text-neutral-100 border-neutral-700 hover:border-neutral-500'
              }`}
              onClick={() => onSelectWorkspace(doc.id)}
            >
              <span className="text-sm">{doc.icon || '📄'}</span>
              <span className="text-xs font-semibold max-w-[140px] truncate">
                {doc.title || 'Sin título'}
              </span>
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

    for (let i = 0; i < activeDocs.length; i++) {
      for (let j = i + 1; j < activeDocs.length; j++) {
        const docA = activeDocs[i]
        const docB = activeDocs[j]

        const commonTags = (docA.tags || []).filter((t) =>
          (docB.tags || []).includes(t)
        )
        const hasTextMention =
          docA.docContent.includes(docB.title) || docB.docContent.includes(docA.title)

        if (commonTags.length > 0 || hasTextMention) {
          generatedEdges.push({
            id: `edge-${docA.id}-${docB.id}`,
            source: docA.id,
            target: docB.id,
            animated: hasTextMention,
            style: {
              stroke: commonTags.length > 0 ? '#6366f1' : '#a855f7',
              strokeWidth: 2,
              opacity: 0.7
            }
          })
        }
      }
    }

    return { nodes: generatedNodes, edges: generatedEdges }
  }, [activeDocs, currentWorkspaceId, onSelectWorkspace])

  return (
    <div className="flex-1 flex flex-col h-full bg-[#18181b] text-neutral-200 select-none overflow-hidden">
      {/* Header */}
      <header className="h-14 px-8 border-b border-neutral-800 flex items-center justify-between shrink-0 bg-[#18181b] z-10">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-indigo-500/10 text-indigo-400 flex items-center justify-center">
            <Network className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-white">Grafo de Conocimiento</h2>
            <p className="text-[11px] text-neutral-400">
              Visualiza relaciones, menciones y enlaces bidireccionales entre tus páginas
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 text-xs text-neutral-400 font-mono">
          <span>{activeDocs.length} nodos</span>
          <span>·</span>
          <span>{edges.length} conexiones</span>
        </div>
      </header>

      {/* ReactFlow Interactive Canvas */}
      <div className="flex-1 w-full h-full relative bg-[#121214]">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          fitView
          attributionPosition="bottom-left"
          minZoom={0.2}
          maxZoom={2}
        >
          <Background color="#333" gap={20} variant={BackgroundVariant.Dots} />
          <Controls className="!bg-neutral-800 !border-neutral-700 !fill-neutral-200" />
        </ReactFlow>
      </div>
    </div>
  )
}
