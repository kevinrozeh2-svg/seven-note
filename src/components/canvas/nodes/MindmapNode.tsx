import { memo, useState, useEffect } from 'react'
import { Handle, Position, useReactFlow } from '@xyflow/react'
import { DeleteIcon, PlusIcon, HighLightLinearIcon } from '@blocksuite/icons/rc'
import { db } from '../../../db'
import { syncEngine } from '../../../lib/syncEngine'
import { areNodePropsEqual } from './nodeUtils'

const COLOR_MAP: Record<string, { bg: string; border: string; pill: string; text: string; edge: string }> = {
  blue: {
    bg: 'bg-[#e0f0fd] dark:bg-[#183048]',
    border: 'border-[#bde0fb] dark:border-[#23496e]',
    pill: 'bg-[#2383e2] text-white',
    text: 'text-[#11446e] dark:text-[#bae6fd]',
    edge: '#2383e2'
  },
  purple: {
    bg: 'bg-[#ede7fb] dark:bg-[#2d2345]',
    border: 'border-[#d7c9f7] dark:border-[#46346e]',
    pill: 'bg-[#7c3aed] text-white',
    text: 'text-[#3d2870] dark:text-[#e9d5ff]',
    edge: '#7c3aed'
  },
  green: {
    bg: 'bg-[#dcf5e3] dark:bg-[#1a3424]',
    border: 'border-[#b6e8c4] dark:border-[#285338]',
    pill: 'bg-[#16a34a] text-white',
    text: 'text-[#184a25] dark:text-[#bbf7d0]',
    edge: '#16a34a'
  },
  yellow: {
    bg: 'bg-[#fff9db] dark:bg-[#3a341b]',
    border: 'border-[#f5eeaf] dark:border-[#574e22]',
    pill: 'bg-[#eab308] text-zinc-900',
    text: 'text-[#49420d] dark:text-[#fef08a]',
    edge: '#ca8a04'
  },
  rose: {
    bg: 'bg-[#ffe8d4] dark:bg-[#3d271a]',
    border: 'border-[#fcd2af] dark:border-[#5e3820]',
    pill: 'bg-[#f97316] text-white',
    text: 'text-[#5c310b] dark:text-[#fed7aa]',
    edge: '#f97316'
  },
  slate: {
    bg: 'bg-[#ffffff] dark:bg-[#252525]',
    border: 'border-[#e8e7e4] dark:border-[#383838]',
    pill: 'bg-[#787774] text-white',
    text: 'text-[#37352f] dark:text-[#e6e6e5]',
    edge: '#787774'
  }
}

const COLORS = ['blue', 'purple', 'green', 'yellow', 'rose', 'slate']

export const MindmapNode = memo(({ id, data, selected }: any) => {
  const reactFlow = useReactFlow()
  const [title, setTitle] = useState(data.title ?? (data.isRoot ? 'Tema Principal' : 'Rama'))
  const [color, setColor] = useState(data.color ?? 'blue')
  const [isEditing, setIsEditing] = useState(false)
  const [showPalette, setShowPalette] = useState(false)

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

  const handleDelete = async () => {
    try {
      await db.canvasNodes.update(id, {
        isDeleted: true,
        updatedAt: Date.now(),
        syncStatus: 'pending'
      })
      // Also mark outgoing connected edges as deleted
      const relatedEdges = await db.canvasEdges.where('workspaceId').equals(data.workspaceId).toArray()
      for (const edge of relatedEdges) {
        if (edge.source === id || edge.target === id) {
          await db.canvasEdges.update(edge.id, { isDeleted: true, updatedAt: Date.now(), syncStatus: 'pending' })
        }
      }
      syncEngine.scheduleSync(1000)
    } catch (e) {
      console.error('Error deleting mindmap node', e)
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

  return (
    <div
      className={`relative min-w-[150px] max-w-[280px] rounded-lg px-3 py-2 border transition-[box-shadow,border-color] duration-150 group ${
        colorScheme.bg
      } ${colorScheme.border}`}
      style={{
        boxShadow: selected
          ? '0 0 0 1.5px var(--app-accent), var(--app-shadow-card-hover)'
          : 'var(--app-shadow-card)'
      }}
    >
      {/* Handles */}
      <Handle
        id="left"
        type="target"
        position={Position.Left}
        className="!w-2.5 !h-2.5 !bg-[var(--app-accent)] !border !border-white dark:!border-zinc-800"
      />
      <Handle
        id="right"
        type="source"
        position={Position.Right}
        className="!w-2.5 !h-2.5 !bg-[var(--app-accent)] !border !border-white dark:!border-zinc-800"
      />

      {/* Content */}
      <div className="flex items-center justify-between gap-2">
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
              className="w-full bg-transparent border-none outline-none text-xs font-semibold text-[var(--affine-text-primary-color)] font-sans"
            />
          ) : (
            <div
              onDoubleClick={() => setIsEditing(true)}
              className={`text-xs font-semibold cursor-text truncate ${colorScheme.text}`}
              title="Doble clic para editar"
            >
              {title}
            </div>
          )}
        </div>

        {/* Quick branch button (+) on the right */}
        <button
          onClick={handleAddChild}
          className="p-1 rounded-full bg-white/10 hover:bg-[#1e96eb] hover:text-white text-[var(--affine-text-secondary-color)] transition shadow-xs shrink-0"
          title="Añadir rama secundaria (+)"
        >
          <PlusIcon className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Floating control pill on hover or select */}
      {(selected || showPalette) && (
        <div
          className="absolute -top-9 left-1/2 -translate-x-1/2 z-30 flex items-center gap-1 p-1 rounded-xl border shadow-xl backdrop-blur-md animate-in fade-in duration-100"
          style={{
            backgroundColor: 'var(--affine-background-overlay-panel-color)',
            borderColor: 'var(--affine-border-color)'
          }}
        >
          {/* Color palette toggle */}
          <button
            onClick={() => setShowPalette(!showPalette)}
            className="p-1 rounded text-zinc-400 hover:text-zinc-100 hover:bg-white/10 transition"
            title="Cambiar color del nodo"
          >
            <HighLightLinearIcon style={{ width: 12, height: 12 }} />
          </button>

          {/* Delete node */}
          <button
            onClick={handleDelete}
            className="p-1 rounded text-rose-500 hover:bg-rose-500/10 transition"
            title="Eliminar nodo de mapa mental"
          >
            <DeleteIcon style={{ width: 12, height: 12 }} />
          </button>
        </div>
      )}

      {/* Color Palette Popover */}
      {showPalette && (
        <div
          className="absolute -top-20 left-1/2 -translate-x-1/2 z-40 flex items-center gap-1.5 p-1.5 rounded-xl border shadow-2xl backdrop-blur-md"
          style={{
            backgroundColor: 'var(--affine-background-overlay-panel-color)',
            borderColor: 'var(--affine-border-color)'
          }}
        >
          {COLORS.map((c) => (
            <button
              key={c}
              onClick={() => {
                setColor(c)
                save({ color: c })
                setShowPalette(false)
              }}
              className={`w-4 h-4 rounded-full transition-transform hover:scale-125 ${
                c === 'blue'
                  ? 'bg-sky-400'
                  : c === 'purple'
                  ? 'bg-purple-400'
                  : c === 'green'
                  ? 'bg-emerald-400'
                  : c === 'yellow'
                  ? 'bg-amber-400'
                  : c === 'rose'
                  ? 'bg-rose-400'
                  : 'bg-zinc-400'
              } ${color === c ? 'ring-2 ring-[#1e96eb]' : ''}`}
            />
          ))}
        </div>
      )}
    </div>
  )
}, areNodePropsEqual)
