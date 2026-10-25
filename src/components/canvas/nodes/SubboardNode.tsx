import { memo, useState } from 'react'
import { Handle, Position } from '@xyflow/react'
import { FolderKanban, ArrowRight, Trash2 } from 'lucide-react'
import { db } from '../../../db'
import { syncEngine } from '../../../lib/syncEngine'

export const SubboardNode = memo(({ id, data, selected }: any) => {
  const [title, setTitle] = useState(data.title ?? 'Sub-tablero')

  const save = async (updates: any) => {
    try {
      const node = await db.canvasNodes.get(id)
      if (node) {
        await db.canvasNodes.update(id, {
          data: { ...node.data, ...updates },
          updatedAt: Date.now(),
          syncStatus: 'pending'
        })
        syncEngine.scheduleSync(1500)
      }
    } catch (e) {
      console.error('Error saving subboard node', e)
    }
  }

  const handleDelete = async () => {
    try {
      await db.canvasNodes.update(id, { isDeleted: true, updatedAt: Date.now(), syncStatus: 'pending' })
      syncEngine.scheduleSync(1000)
    } catch (e) {
      console.error('Error deleting subboard node', e)
    }
  }

  const openSubboard = () => {
    if (data.subboardId) {
      window.dispatchEvent(new CustomEvent('seven-note-navigate-workspace', { detail: { workspaceId: data.subboardId } }))
    } else {
      // Create subboard if not already linked
      const newId = crypto.randomUUID()
      db.workspaces.add({
        id: newId,
        parentId: data.parentWorkspaceId || null,
        title: title || 'Nuevo Sub-tablero',
        icon: '📁',
        color: '#6366f1',
        viewMode: 'canvas',
        docContent: `<h1>${title}</h1><p>Contenido del nuevo sub-tablero.</p>`,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        isFavorite: false,
        isDeleted: false,
        syncStatus: 'pending'
      }).then(() => {
        save({ subboardId: newId })
        window.dispatchEvent(new CustomEvent('seven-note-navigate-workspace', { detail: { workspaceId: newId } }))
      })
    }
  }

  return (
    <div
      onDoubleClick={openSubboard}
      className={`relative w-[280px] rounded-xl shadow-md transition-all duration-150 border-2 bg-gradient-to-br from-indigo-50/60 to-purple-50/60 dark:from-indigo-950/40 dark:to-purple-950/40 border-indigo-200 dark:border-indigo-800/80 ${
        selected ? 'ring-2 ring-indigo-500 ring-offset-2 dark:ring-offset-slate-950 shadow-xl' : 'hover:shadow-lg'
      }`}
    >
      <Handle type="target" position={Position.Top} className="!w-3 !h-3 !bg-indigo-500 !border-2 !border-white dark:!border-slate-900" />
      <Handle type="source" position={Position.Bottom} className="!w-3 !h-3 !bg-indigo-500 !border-2 !border-white dark:!border-slate-900" />
      <Handle type="target" position={Position.Left} className="!w-3 !h-3 !bg-indigo-500 !border-2 !border-white dark:!border-slate-900" />
      <Handle type="source" position={Position.Right} className="!w-3 !h-3 !bg-indigo-500 !border-2 !border-white dark:!border-slate-900" />

      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-indigo-100 dark:border-indigo-900/60">
        <div className="flex items-center gap-2 flex-1">
          <div className="w-6 h-6 rounded-md bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
            <FolderKanban size={13} />
          </div>
          <input
            type="text"
            value={title}
            onChange={(e) => {
              setTitle(e.target.value)
              save({ title: e.target.value })
            }}
            placeholder="Nombre del tablero..."
            className="font-bold text-xs bg-transparent border-none outline-none w-full text-slate-800 dark:text-slate-100"
          />
        </div>
        <button
          onClick={handleDelete}
          className="p-1 rounded hover:bg-rose-500/20 text-slate-500 hover:text-rose-600 transition"
          title="Eliminar tarjeta"
        >
          <Trash2 size={13} />
        </button>
      </div>

      {/* Body & Open Action */}
      <div className="p-3">
        <p className="text-[11px] text-slate-500 dark:text-slate-400 mb-3">
          Tablero anidado independiente con su propio lienzo infinito y notas.
        </p>

        <button
          type="button"
          onClick={openSubboard}
          className="w-full py-1.5 px-3 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-medium text-xs flex items-center justify-center gap-1.5 transition shadow-sm"
        >
          <span>Abrir Tablero</span>
          <ArrowRight size={13} />
        </button>
      </div>
    </div>
  )
})
