import { memo, useState, useEffect } from 'react'
import { useReactFlow } from '@xyflow/react'
import { PlusIcon } from '@blocksuite/icons/rc'
import { db } from '../../../db'
import { syncEngine } from '../../../lib/syncEngine'
import { areNodePropsEqual, NodeHandles, SourceNodeBadge } from './nodeUtils'
import { renderWithAppleEmoji } from '../../ui/AppleEmoji'

const COLOR_MAP: Record<string, { cardBorder: string; accentBar: string; dot: string; topGlow: string; edge: string }> = {
  blue: {
    cardBorder: '',
    accentBar: '',
    dot: '#71717a',
    topGlow: '',
    edge: '#94a3b8'
  },
  purple: {
    cardBorder: '',
    accentBar: '',
    dot: '#71717a',
    topGlow: '',
    edge: '#94a3b8'
  },
  green: {
    cardBorder: '',
    accentBar: '',
    dot: '#71717a',
    topGlow: '',
    edge: '#94a3b8'
  },
  yellow: {
    cardBorder: '',
    accentBar: '',
    dot: '#71717a',
    topGlow: '',
    edge: '#94a3b8'
  },
  rose: {
    cardBorder: '',
    accentBar: '',
    dot: '#71717a',
    topGlow: '',
    edge: '#94a3b8'
  },
  slate: {
    cardBorder: '',
    accentBar: '',
    dot: '#71717a',
    topGlow: '',
    edge: '#94a3b8'
  }
}

export const MindmapNode = memo(({ id, data, selected }: any) => {
  const reactFlow = useReactFlow()
  const [title, setTitle] = useState(data.title ?? (data.isRoot ? 'Tema Principal' : 'Rama'))
  const [color, setColor] = useState(data.color ?? 'blue')
  const [isEditing, setIsEditing] = useState(false)

  useEffect(() => {
    setTitle(data.title ?? (data.isRoot ? 'Tema Principal' : 'Rama'))
    setColor(data.color ?? 'blue')
  }, [data.title, data.color, data.isRoot])

  const colorScheme = COLOR_MAP[color] || COLOR_MAP.blue

  const save = async (updates: any) => {
    try {
      const node = await db.canvasNodes.get(id)
      if (node) {
        await db.canvasNodes.update(id, {
          data: { ...node.data, ...updates },
          updatedAt: Date.now(),
          syncStatus: 'pending'
        })
        syncEngine.scheduleSync(1200)
      }
    } catch (e) {
      console.error('Error saving mindmap node', e)
    }
  }

  // Branch creation: Add a child node to the right
  const handleAddChild = async (e: React.MouseEvent) => {
    e.stopPropagation()
    try {
      const currentNode = reactFlow.getNode(id)
      const currentPos = currentNode ? currentNode.position : { x: 300, y: 300 }

      // Count existing children of this node to stagger Y position
      const allEdges = await db.canvasEdges
        .where('workspaceId')
        .equals(data.workspaceId)
        .and((edge) => !edge.isDeleted && edge.source === id)
        .toArray()

      const childIndex = allEdges.length
      const yOffset = (childIndex - 0.5) * 80

      const newChildId = `mindmap-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`
      const newChildNode = {
        id: newChildId,
        workspaceId: data.workspaceId,
        type: 'mindmap' as const,
        positionX: currentPos.x + 230,
        positionY: currentPos.y + yOffset,
        data: {
          title: `Sub-idea ${childIndex + 1}`,
          color,
          workspaceId: data.workspaceId
        },
        createdAt: Date.now(),
        updatedAt: Date.now(),
        isDeleted: false,
        syncStatus: 'pending' as const
      }

      await db.canvasNodes.add(newChildNode)

      // Create connecting curved edge
      const newEdgeId = `edge-${id}-${newChildId}`
      await db.canvasEdges.add({
        id: newEdgeId,
        workspaceId: data.workspaceId,
        source: id,
        target: newChildId,
        sourceHandle: 'right',
        targetHandle: 'left',
        animated: false,
        color: colorScheme.edge,
        edgeType: 'bezier',
        markerEndType: 'arrow',
        createdAt: Date.now(),
        updatedAt: Date.now(),
        isDeleted: false,
        syncStatus: 'pending'
      })

      syncEngine.scheduleSync(1200)
    } catch (err) {
      console.error('Error creating child mindmap node', err)
    }
  }

  const isConnectorActive = Boolean(data?.isConnectorActive)
  const isConnectSource = Boolean(data?.isConnectSource)

  return (
    <div
      className={`group relative min-w-[150px] max-w-[280px] rounded-xl px-3.5 py-2.5 bg-white dark:bg-[#18181b] transition-all duration-200 overflow-visible ${
        selected
          ? 'ring-2 ring-[var(--app-accent)] shadow-xl'
          : 'shadow-[0_4px_16px_-4px_rgba(0,0,0,0.06),0_1px_2px_rgba(0,0,0,0.04)] dark:shadow-[0_8px_24px_-6px_rgba(0,0,0,0.5),0_1px_2px_rgba(0,0,0,0.3)]'
      } ${
        isConnectSource
          ? 'ring-4 ring-amber-500 shadow-2xl scale-[1.02]'
          : isConnectorActive
          ? 'ring-2 ring-blue-500/50 hover:ring-2 hover:ring-blue-500 cursor-pointer'
          : ''
      } hover:shadow-lg`}
    >
      <SourceNodeBadge isConnectSource={isConnectSource} isConnectorActive={isConnectorActive} />
      <NodeHandles
        selected={selected}
        isConnectorActive={isConnectorActive}
        isConnectSource={isConnectSource}
      />

      {/* Content */}
      <div className="flex items-center justify-between gap-2 relative z-10 pl-1">
        <div className="flex-1 min-w-0">
          {isEditing ? (
            <input
              autoFocus
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onBlur={() => {
                setIsEditing(false)
                save({ title })
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  setIsEditing(false)
                  save({ title })
                }
              }}
              className="w-full bg-transparent border-none outline-none text-xs font-semibold text-zinc-900 dark:text-zinc-100 font-sans"
            />
          ) : (
            <div
              onDoubleClick={() => setIsEditing(true)}
              className="text-xs font-semibold cursor-text truncate text-zinc-900 dark:text-zinc-100 hover:text-blue-500 transition-colors"
              title="Doble clic para editar"
            >
              {renderWithAppleEmoji(title)}
            </div>
          )}
        </div>

        {/* Quick branch button (+) on the right */}
        <button
          onClick={handleAddChild}
          className="p-1 rounded-full bg-zinc-100 dark:bg-zinc-800 hover:bg-[#1e96eb] hover:text-white text-zinc-500 dark:text-zinc-400 transition shadow-xs shrink-0"
          title="Añadir rama secundaria (+)"
        >
          <PlusIcon className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  )
}, areNodePropsEqual)
