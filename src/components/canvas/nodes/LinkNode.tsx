import { memo, useState } from 'react'
import { Handle, Position } from '@xyflow/react'
import { Trash2, ExternalLink, Globe } from 'lucide-react'
import { db } from '../../../db'
import { syncEngine } from '../../../lib/syncEngine'

export const LinkNode = memo(({ id, data, selected }: any) => {
  const [title, setTitle] = useState(data.title ?? 'Enlace web')
  const [url, setUrl] = useState(data.url ?? '')
  const [description, setDescription] = useState(data.description ?? '')

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
      console.error('Error saving link node', e)
    }
  }

  const handleDelete = async () => {
    try {
      await db.canvasNodes.update(id, { isDeleted: true, updatedAt: Date.now(), syncStatus: 'pending' })
      syncEngine.scheduleSync(1000)
    } catch (e) {
      console.error('Error deleting link node', e)
    }
  }

  return (
    <div
      className={`relative w-[280px] rounded-xl shadow-md transition-all duration-150 border-2 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 ${
        selected ? 'ring-2 ring-indigo-500 ring-offset-2 dark:ring-offset-slate-950 shadow-xl' : 'hover:shadow-lg'
      }`}
    >
      <Handle type="target" position={Position.Top} className="!w-3 !h-3 !bg-indigo-500 !border-2 !border-white dark:!border-slate-900" />
      <Handle type="source" position={Position.Bottom} className="!w-3 !h-3 !bg-indigo-500 !border-2 !border-white dark:!border-slate-900" />
      <Handle type="target" position={Position.Left} className="!w-3 !h-3 !bg-indigo-500 !border-2 !border-white dark:!border-slate-900" />
      <Handle type="source" position={Position.Right} className="!w-3 !h-3 !bg-indigo-500 !border-2 !border-white dark:!border-slate-900" />

      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-slate-100 dark:border-slate-800">
        <div className="flex items-center gap-1.5 flex-1 min-w-0">
          <Globe size={14} className="text-indigo-500 shrink-0" />
          <input
            type="text"
            value={title}
            onChange={(e) => {
              setTitle(e.target.value)
              save({ title: e.target.value })
            }}
            placeholder="Título del enlace..."
            className="font-semibold text-xs bg-transparent border-none outline-none w-full text-slate-800 dark:text-slate-100"
          />
        </div>
        <div className="flex items-center gap-1">
          {url && (
            <a
              href={url.startsWith('http') ? url : `https://${url}`}
              target="_blank"
              rel="noreferrer"
              className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400"
              title="Abrir enlace"
            >
              <ExternalLink size={13} />
            </a>
          )}
          <button
            onClick={handleDelete}
            className="p-1 rounded hover:bg-rose-500/20 text-slate-500 hover:text-rose-600 transition"
            title="Eliminar tarjeta"
          >
            <Trash2 size={13} />
          </button>
        </div>
      </div>

      {/* Inputs */}
      <div className="p-3 space-y-2">
        <input
          type="text"
          value={url}
          onChange={(e) => {
            setUrl(e.target.value)
            save({ url: e.target.value })
          }}
          placeholder="https://ejemplo.com"
          className="w-full text-xs px-2 py-1.5 rounded bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 outline-none text-indigo-600 dark:text-indigo-400"
        />

        <textarea
          value={description}
          onChange={(e) => {
            setDescription(e.target.value)
            save({ description: e.target.value })
          }}
          placeholder="Descripción o notas sobre este enlace..."
          rows={2}
          className="w-full text-xs bg-transparent border-none outline-none resize-none text-slate-600 dark:text-slate-300 placeholder-slate-400"
        />
      </div>
    </div>
  )
})
