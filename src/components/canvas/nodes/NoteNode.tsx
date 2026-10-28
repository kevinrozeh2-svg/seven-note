import { memo, useState } from 'react'
import { Handle, Position } from '@xyflow/react'
import { Trash2 } from 'lucide-react'
import { db } from '../../../db'
import { syncEngine } from '../../../lib/syncEngine'
import { areNodePropsEqual } from './nodeUtils'

const COLOR_MAP: Record<string, { bg: string; border: string; header: string; text: string; dot: string; quoteBar: string }> = {
  yellow: {
    bg: 'bg-[#fff9db] dark:bg-[#3a341b]',
    border: 'border-[#f5eeaf] dark:border-[#574e22]',
    header: 'bg-[#fef3c7] dark:bg-[#453d1e]',
    text: 'text-[#49420d] dark:text-[#fef08a]',
    dot: '#facc15',
    quoteBar: 'border-l-[#eab308]'
  },
  blue: {
    bg: 'bg-[#e0f0fd] dark:bg-[#183048]',
    border: 'border-[#bde0fb] dark:border-[#23496e]',
    header: 'bg-[#bae6fd] dark:bg-[#1e3d5c]',
    text: 'text-[#11446e] dark:text-[#bae6fd]',
    dot: '#38bdf8',
    quoteBar: 'border-l-[#38bdf8]'
  },
  green: {
    bg: 'bg-[#dcf5e3] dark:bg-[#1a3424]',
    border: 'border-[#b6e8c4] dark:border-[#285338]',
    header: 'bg-[#bbf7d0] dark:bg-[#204530]',
    text: 'text-[#184a25] dark:text-[#bbf7d0]',
    dot: '#4ade80',
    quoteBar: 'border-l-[#22c55e]'
  },
  purple: {
    bg: 'bg-[#ede7fb] dark:bg-[#2d2345]',
    border: 'border-[#d7c9f7] dark:border-[#46346e]',
    header: 'bg-[#ddd6fe] dark:bg-[#382b57]',
    text: 'text-[#3d2870] dark:text-[#e9d5ff]',
    dot: '#c084fc',
    quoteBar: 'border-l-[#a855f7]'
  },
  rose: {
    bg: 'bg-[#ffe8d4] dark:bg-[#3d271a]',
    border: 'border-[#fcd2af] dark:border-[#5e3820]',
    header: 'bg-[#fed7aa] dark:bg-[#4d3120]',
    text: 'text-[#5c310b] dark:text-[#fed7aa]',
    dot: '#fb923c',
    quoteBar: 'border-l-[#f97316]'
  },
  peach: {
    bg: 'bg-[#ffedd5] dark:bg-[#432318]',
    border: 'border-[#fed7aa] dark:border-[#6b3524]',
    header: 'bg-[#fed7aa] dark:bg-[#572d1f]',
    text: 'text-[#7c2d12] dark:text-[#ffedd5]',
    dot: '#ea580c',
    quoteBar: 'border-l-[#ea580c]'
  },
  redBanner: {
    bg: 'bg-[#ba3d2a] dark:bg-[#992f1f]',
    border: 'border-[#9e3221] dark:border-[#7c2517]',
    header: 'bg-[#9e3221] dark:bg-[#7c2517]',
    text: 'text-white',
    dot: '#ba3d2a',
    quoteBar: 'border-l-white'
  },
  darkNote: {
    bg: 'bg-[#253238] dark:bg-[#1e272c]',
    border: 'border-[#37474f] dark:border-[#263238]',
    header: 'bg-[#37474f] dark:bg-[#263238]',
    text: 'text-neutral-100',
    dot: '#607d8b',
    quoteBar: 'border-l-[#78909c]'
  },
  slate: {
    bg: 'bg-[#ffffff] dark:bg-[#252525]',
    border: 'border-[#e8e7e4] dark:border-[#383838]',
    header: 'bg-[#f7f6f5] dark:bg-[#2d2d2d]',
    text: 'text-[#37352f] dark:text-[#e6e6e5]',
    dot: '#9ca3af',
    quoteBar: 'border-l-[#9ca3af]'
  }
}

export const NoteNode = memo(({ id, data, selected }: any) => {
  const [title, setTitle] = useState(data.title ?? '')
  const [content, setContent] = useState(data.content ?? '')
  const [color, setColor] = useState(data.color ?? 'slate')
  const [isQuote] = useState(data.isQuote ?? false)
  const [quoteAuthor] = useState(data.quoteAuthor ?? '')
  const [alertBox] = useState(data.alertBox ?? '')
  const [isBanner] = useState(data.isBanner ?? false)
  const [linkUrl] = useState(data.linkUrl ?? '')

  const colorScheme = COLOR_MAP[color] || COLOR_MAP.slate

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
      console.error('Error saving note node', e)
    }
  }

  const handleDelete = async () => {
    try {
      await db.canvasNodes.update(id, { isDeleted: true, updatedAt: Date.now(), syncStatus: 'pending' })
      syncEngine.scheduleSync(1000)
    } catch (e) {
      console.error('Error deleting note node', e)
    }
  }

  // Red Banner Style (matches Screenshot 1: "El Grupo de Música del Futuro")
  if (isBanner) {
    return (
      <div
        className={`group relative px-6 py-3 rounded-md transition-[box-shadow,border-color] duration-150 shadow-md ${
          selected ? 'ring-2 ring-white shadow-xl' : ''
        } ${colorScheme.bg} ${colorScheme.text}`}
        style={{ minWidth: 200, maxWidth: 360 }}
      >
        <Handle id="top" type="source" position={Position.Top} className="!w-2.5 !h-2.5 !bg-white !border !border-neutral-800" />
        <Handle id="bottom" type="source" position={Position.Bottom} className="!w-2.5 !h-2.5 !bg-white !border !border-neutral-800" />
        <Handle id="left" type="source" position={Position.Left} className="!w-2.5 !h-2.5 !bg-white !border !border-neutral-800" />
        <Handle id="right" type="source" position={Position.Right} className="!w-2.5 !h-2.5 !bg-white !border !border-neutral-800" />

        <button
          onClick={handleDelete}
          className="absolute -top-2 -right-2 p-1 rounded-full bg-white text-neutral-800 shadow-sm opacity-0 group-hover:opacity-100 transition z-10"
        >
          <Trash2 className="w-3 h-3 text-rose-500" />
        </button>

        <input
          type="text"
          value={title || content}
          onChange={(e) => {
            setTitle(e.target.value)
            save({ title: e.target.value, content: e.target.value })
          }}
          className="nodrag nowheel font-serif font-bold text-base text-center bg-transparent border-none outline-none w-full text-white placeholder-white/80"
          placeholder="Texto del banner..."
        />
      </div>
    )
  }

  return (
    <div
      className={`group relative rounded-xl transition-[box-shadow,border-color] duration-150 border p-3.5 ${colorScheme.bg} ${colorScheme.border} ${
        selected ? 'ring-2 ring-[var(--app-accent)] shadow-xl' : 'shadow-[0_2px_8px_rgba(0,0,0,0.06)] dark:shadow-[0_4px_16px_rgba(0,0,0,0.35)]'
      }`}
      style={{
        width: data.width || 280,
        minHeight: 80
      }}
    >
      {/* Handles */}
      <Handle id="top" type="source" position={Position.Top} className="!w-2.5 !h-2.5 !bg-[var(--app-accent)] !border !border-white dark:!border-zinc-800" />
      <Handle id="bottom" type="source" position={Position.Bottom} className="!w-2.5 !h-2.5 !bg-[var(--app-accent)] !border !border-white dark:!border-zinc-800" />
      <Handle id="left" type="source" position={Position.Left} className="!w-2.5 !h-2.5 !bg-[var(--app-accent)] !border !border-white dark:!border-zinc-800" />
      <Handle id="right" type="source" position={Position.Right} className="!w-2.5 !h-2.5 !bg-[var(--app-accent)] !border !border-white dark:!border-zinc-800" />

      {/* Floating delete button */}
      <button
        onClick={handleDelete}
        className="absolute top-2 right-2 p-1 rounded-full bg-white/80 dark:bg-neutral-800/80 hover:bg-white text-neutral-400 hover:text-rose-500 shadow-sm opacity-0 group-hover:opacity-100 transition z-10"
        title="Eliminar nota"
      >
        <Trash2 className="w-3.5 h-3.5" />
      </button>

      {/* Optional Title (e.g. "Diseño Danés" or "Acerca de la película:") */}
      {(title || data.showTitle) && (
        <div className="mb-2">
          <input
            type="text"
            value={title}
            onChange={(e) => {
              setTitle(e.target.value)
              save({ title: e.target.value })
            }}
            placeholder="Título..."
            className={`nodrag nowheel font-serif font-bold text-sm bg-transparent border-none outline-none w-full ${colorScheme.text}`}
          />
        </div>
      )}

      {/* Content Area */}
      {isQuote ? (
        // Quote style (Poul Kjærholm in Screenshot 2)
        <div className={`border-l-3 pl-3 my-1 italic ${colorScheme.quoteBar}`}>
          <textarea
            value={content}
            onChange={(e) => {
              setContent(e.target.value)
              save({ content: e.target.value })
            }}
            rows={4}
            className={`nodrag nowheel w-full bg-transparent border-none outline-none resize-none text-xs leading-relaxed italic ${colorScheme.text}`}
          />
          {quoteAuthor && (
            <div className="not-italic mt-1.5 text-[11px] font-medium text-neutral-500 dark:text-neutral-400 select-text nodrag">
              {quoteAuthor}
            </div>
          )}
        </div>
      ) : (
        // Normal text note (supports cyan highlight rendering if provided)
        <div className="text-xs leading-relaxed">
          {data.hasHtmlHighlight ? (
            <div
              dangerouslySetInnerHTML={{ __html: content }}
              className={`nodrag select-text leading-relaxed ${colorScheme.text}`}
            />
          ) : (
            <textarea
              value={content}
              onChange={(e) => {
                setContent(e.target.value)
                save({ content: e.target.value })
              }}
              rows={content.length > 120 ? 5 : 3}
              placeholder="Escribe tu nota aquí..."
              className={`nodrag nowheel w-full bg-transparent border-none outline-none resize-none text-xs leading-relaxed ${colorScheme.text}`}
            />
          )}
        </div>
      )}

      {/* Alert Callout Box (Screenshot 2: "⚠️ Diseño centrado en el usuario") */}
      {alertBox && (
        <div className="mt-3 p-2 rounded-lg bg-blue-100/70 dark:bg-blue-900/40 border border-blue-200 dark:border-blue-800 text-[11px] font-medium text-blue-900 dark:text-blue-200 flex items-center gap-1.5">
          <span>⚠️</span>
          <span>{alertBox}</span>
        </div>
      )}

      {/* Muuto Link snippet (Screenshot 2 peach card: professionals.muuto.com) */}
      {linkUrl && (
        <div className="mt-2 pt-1 border-t border-black/5 dark:border-white/5">
          <a
            href={`https://${linkUrl}`}
            target="_blank"
            rel="noreferrer"
            className="text-[11px] text-neutral-600 dark:text-neutral-400 hover:text-blue-500 hover:underline block truncate"
          >
            {linkUrl}
          </a>
        </div>
      )}

      {/* Color switcher on hover */}
      <div className="absolute -bottom-3 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition flex items-center gap-1 p-1 rounded-full bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 shadow-md z-10">
        {['slate', 'yellow', 'blue', 'green', 'rose', 'peach', 'darkNote'].map((col) => (
          <button
            key={col}
            onClick={() => {
              setColor(col)
              save({ color: col })
            }}
            className={`w-3.5 h-3.5 rounded-full border border-neutral-300 dark:border-neutral-600 ${
              COLOR_MAP[col]?.dot ? '' : 'bg-neutral-200'
            }`}
            style={{ backgroundColor: COLOR_MAP[col]?.dot }}
            title={col}
          />
        ))}
      </div>
    </div>
  )
}, areNodePropsEqual)
