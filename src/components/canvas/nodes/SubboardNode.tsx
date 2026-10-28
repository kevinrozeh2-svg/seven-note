import { memo, useState } from 'react'
import { Handle, Position } from '@xyflow/react'
import { Folder, Trash2, Sparkles, FileText, Film, Skull, Download, ChevronRight } from 'lucide-react'
import { db } from '../../../db'
import { syncEngine } from '../../../lib/syncEngine'
import { toast } from 'sonner'
import { areNodePropsEqual } from './nodeUtils'

export interface SubboardItem {
  id: string
  title: string
  count: string
  icon: 'sparkle' | 'doc' | 'film' | 'skull' | 'folder' | 'idea'
  color: string
}

export const SubboardNode = memo(({ id, data, selected }: any) => {
  const [title, setTitle] = useState(data.title ?? 'Ideas')
  const [subtitle, setSubtitle] = useState(data.subtitle ?? (data.subboards ? `${data.subboards.length} tableros` : '15 tarjetas'))
  const isStandalone = data.isStandalone || false
  const [iconType] = useState<string>(data.iconType || 'folder')
  const [iconColor] = useState<string>(data.iconColor || '#8b5cf6')

  const [subboards] = useState<SubboardItem[]>(() => {
    if (data.subboards && Array.isArray(data.subboards)) return data.subboards
    return [
      { id: '1', title: 'Ideas', count: '17 tarjetas', icon: 'idea', color: '#0284c7' },
      { id: '2', title: 'Tablero de inspiración', count: '12 tarjetas', icon: 'sparkle', color: '#10b981' },
      { id: '3', title: 'Guión', count: '335 palabras', icon: 'doc', color: '#06b6d4' }
    ]
  })

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
      toast.info('Tablero eliminado')
    } catch (e) {
      console.error('Error deleting subboard node', e)
    }
  }

  const handleOpenBoard = (boardTitle: string) => {
    toast.info(`Abriendo tablero: "${boardTitle}"`)
    window.dispatchEvent(new CustomEvent('seven-note-navigate-workspace', { detail: { title: boardTitle } }))
  }

  const renderIconBadge = (icon: string, color: string) => {
    return (
      <div
        className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 shadow-xs"
        style={{ backgroundColor: color }}
      >
        {icon === 'skull' && <Skull className="w-4 h-4 text-white" />}
        {icon === 'sparkle' && <Sparkles className="w-4 h-4 text-white" />}
        {icon === 'doc' && <FileText className="w-4 h-4 text-white" />}
        {icon === 'film' && <Film className="w-4 h-4 text-white" />}
        {icon === 'idea' && <Sparkles className="w-4 h-4 text-white" />}
        {icon === 'folder' && <Folder className="w-4 h-4 text-white" />}
      </div>
    )
  }

  // Standalone Squircle Icon (like purple skull "Skaters 15 tarjetas" in Screenshot 3)
  if (isStandalone) {
    return (
      <div
        onDoubleClick={() => handleOpenBoard(title)}
        className={`group relative flex flex-col items-center justify-center p-2 rounded-2xl cursor-pointer transition select-none ${
          selected ? 'ring-2 ring-[var(--app-accent)]' : ''
        }`}
        style={{ width: 100 }}
      >
        <Handle id="top" type="source" position={Position.Top} className="!w-2.5 !h-2.5 !bg-[var(--app-accent)] !border !border-white dark:!border-zinc-800" />
        <Handle id="bottom" type="source" position={Position.Bottom} className="!w-2.5 !h-2.5 !bg-[var(--app-accent)] !border !border-white dark:!border-zinc-800" />
        <Handle id="left" type="source" position={Position.Left} className="!w-2.5 !h-2.5 !bg-[var(--app-accent)] !border !border-white dark:!border-zinc-800" />
        <Handle id="right" type="source" position={Position.Right} className="!w-2.5 !h-2.5 !bg-[var(--app-accent)] !border !border-white dark:!border-zinc-800" />

        <button
          onClick={handleDelete}
          className="absolute -top-1 -right-1 p-1 rounded-full bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 text-neutral-400 hover:text-rose-500 shadow-sm opacity-0 group-hover:opacity-100 transition z-10"
        >
          <Trash2 className="w-3 h-3" />
        </button>

        {/* Large squircle icon */}
        <div
          className="w-16 h-16 rounded-2xl flex items-center justify-center shadow-lg group-hover:scale-105 transition-transform"
          style={{ backgroundColor: iconColor }}
        >
          {iconType === 'skull' ? (
            <Skull className="w-8 h-8 text-white" />
          ) : (
            <Folder className="w-8 h-8 text-white" />
          )}
        </div>

        {/* Title and Card count */}
        <span className="mt-2 text-xs font-bold text-neutral-900 dark:text-neutral-100 text-center leading-tight">
          {title}
        </span>
        <span className="text-[10px] text-neutral-500 dark:text-neutral-400">
          {subtitle}
        </span>
      </div>
    )
  }

  // Full Container Board Card (matches Screenshot 3: Ideas & Filmación)
  return (
    <div
      className={`group relative w-[280px] rounded-xl bg-white dark:bg-[#252525] border border-neutral-200/90 dark:border-neutral-700/80 transition-[box-shadow,border-color] duration-150 overflow-hidden ${
        selected ? 'ring-2 ring-[var(--app-accent)] shadow-xl' : 'shadow-[0_2px_8px_rgba(0,0,0,0.06)] dark:shadow-[0_4px_16px_rgba(0,0,0,0.35)]'
      }`}
    >
      {/* Handles */}
      <Handle id="top" type="source" position={Position.Top} className="!w-2.5 !h-2.5 !bg-[var(--app-accent)] !border !border-white dark:!border-zinc-800" />
      <Handle id="bottom" type="source" position={Position.Bottom} className="!w-2.5 !h-2.5 !bg-[var(--app-accent)] !border !border-white dark:!border-zinc-800" />
      <Handle id="left" type="source" position={Position.Left} className="!w-2.5 !h-2.5 !bg-[var(--app-accent)] !border !border-white dark:!border-zinc-800" />
      <Handle id="right" type="source" position={Position.Right} className="!w-2.5 !h-2.5 !bg-[var(--app-accent)] !border !border-white dark:!border-zinc-800" />

      {/* Floating delete button */}
      <button
        onClick={handleDelete}
        className="absolute top-2 right-2 p-1.5 rounded-full bg-white/80 dark:bg-neutral-800/80 hover:bg-white dark:hover:bg-neutral-700 text-neutral-400 hover:text-rose-500 shadow-sm opacity-0 group-hover:opacity-100 transition z-20 backdrop-blur-xs"
        title="Eliminar tarjeta"
      >
        <Trash2 className="w-3.5 h-3.5" />
      </button>

      {/* Card Header */}
      <div className="p-3 pb-2 text-center border-b border-neutral-100 dark:border-neutral-800">
        <input
          type="text"
          value={title}
          onChange={(e) => {
            setTitle(e.target.value)
            save({ title: e.target.value })
          }}
          className="font-serif font-bold text-sm text-center bg-transparent border-none outline-none w-full text-neutral-900 dark:text-neutral-100"
        />
        <input
          type="text"
          value={subtitle}
          onChange={(e) => {
            setSubtitle(e.target.value)
            save({ subtitle: e.target.value })
          }}
          className="text-[11px] text-center text-neutral-400 dark:text-neutral-500 bg-transparent border-none outline-none w-full -mt-0.5"
        />
      </div>

      {/* Optional Photo (like skater photo in Filmación) */}
      {data.imageUrl && (
        <div className="p-2 pb-0">
          <div className="w-full h-36 rounded-lg overflow-hidden bg-neutral-100 dark:bg-neutral-800">
            <img src={data.imageUrl} alt={title} className="w-full h-full object-cover" />
          </div>
        </div>
      )}

      {/* Optional File row (like Longboard_Bridge.mov in Filmación) */}
      {data.attachedFile && (
        <div
          onClick={() => toast.success(`Descargando ${data.attachedFile.name}`)}
          className="px-3 py-2 border-b border-neutral-100 dark:border-neutral-800 flex items-center gap-2 hover:bg-neutral-50 dark:hover:bg-neutral-800/40 cursor-pointer transition"
        >
          <div className="w-6 h-6 rounded bg-neutral-800 text-sky-400 flex items-center justify-center shrink-0">
            <Film className="w-3.5 h-3.5" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-neutral-800 dark:text-neutral-200 truncate">
              {data.attachedFile.name}
            </p>
            <p className="text-[10px] text-neutral-400">
              Descargar • {data.attachedFile.size}
            </p>
          </div>
          <Download className="w-3.5 h-3.5 text-neutral-400 shrink-0" />
        </div>
      )}

      {/* Child Sub-boards list */}
      <div className="p-2 space-y-1.5">
        {subboards.map((b) => (
          <div
            key={b.id}
            onClick={() => handleOpenBoard(b.title)}
            className="flex items-center gap-2.5 p-2 rounded-lg hover:bg-neutral-100/70 dark:hover:bg-neutral-800/60 cursor-pointer transition select-none group/item"
          >
            {renderIconBadge(b.icon, b.color)}
            <div className="flex-1 min-w-0">
              <span className="text-xs font-bold text-neutral-800 dark:text-neutral-200 block truncate group-hover/item:text-blue-500 transition-colors">
                {b.title}
              </span>
              <span className="text-[10px] text-neutral-400 block -mt-0.5">
                {b.count}
              </span>
            </div>
            <ChevronRight className="w-3.5 h-3.5 text-neutral-400 opacity-0 group-hover/item:opacity-100 transition" />
          </div>
        ))}
      </div>
    </div>
  )
}, areNodePropsEqual)
