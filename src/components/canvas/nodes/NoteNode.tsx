import { memo, useState } from 'react'
import { Handle, Position } from '@xyflow/react'
import { Trash2, Palette } from 'lucide-react'
import { db } from '../../../db'
import { syncEngine } from '../../../lib/syncEngine'

const COLOR_MAP: Record<string, { bg: string; border: string; header: string; text: string }> = {
  yellow: { bg: 'bg-amber-50 dark:bg-amber-950/40', border: 'border-amber-200 dark:border-amber-800', header: 'bg-amber-100/70 dark:bg-amber-900/40', text: 'text-amber-900 dark:text-amber-100' },
  blue: { bg: 'bg-sky-50 dark:bg-sky-950/40', border: 'border-sky-200 dark:border-sky-800', header: 'bg-sky-100/70 dark:bg-sky-900/40', text: 'text-sky-900 dark:text-sky-100' },
  green: { bg: 'bg-emerald-50 dark:bg-emerald-950/40', border: 'border-emerald-200 dark:border-emerald-800', header: 'bg-emerald-100/70 dark:bg-emerald-900/40', text: 'text-emerald-900 dark:text-emerald-100' },
  purple: { bg: 'bg-purple-50 dark:bg-purple-950/40', border: 'border-purple-200 dark:border-purple-800', header: 'bg-purple-100/70 dark:bg-purple-900/40', text: 'text-purple-900 dark:text-purple-100' },
  rose: { bg: 'bg-rose-50 dark:bg-rose-950/40', border: 'border-rose-200 dark:border-rose-800', header: 'bg-rose-100/70 dark:bg-rose-900/40', text: 'text-rose-900 dark:text-rose-100' },
  slate: { bg: 'bg-slate-50 dark:bg-slate-900', border: 'border-slate-200 dark:border-slate-800', header: 'bg-slate-100 dark:bg-slate-800', text: 'text-slate-900 dark:text-slate-100' }
}

const COLORS = ['yellow', 'blue', 'green', 'purple', 'rose', 'slate']

export const NoteNode = memo(({ id, data, selected }: any) => {
  const [title, setTitle] = useState(data.title ?? 'Nota')
  const [content, setContent] = useState(data.content ?? '')
  const [color, setColor] = useState(data.color ?? 'yellow')
  const [showPalette, setShowPalette] = useState(false)

  const colorScheme = COLOR_MAP[color] || COLOR_MAP.yellow

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
      console.error('Error saving node', e)
    }
  }

  const handleDelete = async () => {
    try {
      await db.canvasNodes.update(id, { isDeleted: true, updatedAt: Date.now(), syncStatus: 'pending' })
      syncEngine.scheduleSync(1000)
    } catch (e) {
      console.error('Error deleting node', e)
    }
  }

  return (
    <div
      className={`relative w-[280px] rounded-xl shadow-md transition-all duration-150 border-2 ${colorScheme.bg} ${colorScheme.border} ${
        selected ? 'ring-2 ring-indigo-500 ring-offset-2 dark:ring-offset-slate-950 shadow-xl' : 'hover:shadow-lg'
      }`}
    >
      {/* Handles for connections */}
      <Handle type="target" position={Position.Top} className="!w-3 !h-3 !bg-indigo-500 !border-2 !border-white dark:!border-slate-900" />
      <Handle type="source" position={Position.Bottom} className="!w-3 !h-3 !bg-indigo-500 !border-2 !border-white dark:!border-slate-900" />
      <Handle type="target" position={Position.Left} className="!w-3 !h-3 !bg-indigo-500 !border-2 !border-white dark:!border-slate-900" />
      <Handle type="source" position={Position.Right} className="!w-3 !h-3 !bg-indigo-500 !border-2 !border-white dark:!border-slate-900" />

      {/* Header */}
      <div className={`flex items-center justify-between px-3 py-2 rounded-t-[10px] border-b ${colorScheme.header} ${colorScheme.border}`}>
        <input
          type="text"
          value={title}
          onChange={(e) => {
            setTitle(e.target.value)
            save({ title: e.target.value })
          }}
          placeholder="Título..."
          className="font-semibold text-sm bg-transparent border-none outline-none w-full text-slate-800 dark:text-slate-100 placeholder-slate-400"
        />
        <div className="flex items-center gap-1">
          <button
            onClick={() => setShowPalette(!showPalette)}
            className="p-1 rounded hover:bg-black/10 dark:hover:bg-white/10 text-slate-500 dark:text-slate-400"
            title="Cambiar color"
          >
            <Palette size={13} />
          </button>
          <button
            onClick={handleDelete}
            className="p-1 rounded hover:bg-rose-500/20 text-slate-500 hover:text-rose-600 transition"
            title="Eliminar tarjeta"
          >
            <Trash2 size={13} />
          </button>
        </div>
      </div>

      {/* Color Palette Popover */}
      {showPalette && (
        <div className="absolute top-10 right-2 z-20 flex gap-1 p-1.5 bg-white dark:bg-slate-800 rounded-lg shadow-xl border border-slate-200 dark:border-slate-700">
          {COLORS.map((c) => (
            <button
              key={c}
              onClick={() => {
                setColor(c)
                setShowPalette(false)
                save({ color: c })
              }}
              className={`w-5 h-5 rounded-full border border-black/10 transition-transform ${
                COLOR_MAP[c].bg
              } ${color === c ? 'scale-125 ring-2 ring-indigo-500' : 'hover:scale-110'}`}
            />
          ))}
        </div>
      )}

      {/* Content */}
      <div className="p-3">
        <textarea
          value={content}
          onChange={(e) => {
            setContent(e.target.value)
            save({ content: e.target.value })
          }}
          placeholder="Escribe tu nota aquí..."
          rows={4}
          className="w-full text-xs font-normal bg-transparent border-none outline-none resize-none text-slate-700 dark:text-slate-200 placeholder-slate-400/80 leading-relaxed"
        />
      </div>
    </div>
  )
})
