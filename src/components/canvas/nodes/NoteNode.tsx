import { memo, useState } from 'react'
import { Handle, Position } from '@xyflow/react'
import { Trash2 } from 'lucide-react'
import { db } from '../../../db'
import { syncEngine } from '../../../lib/syncEngine'
import { areNodePropsEqual } from './nodeUtils'
import { AppleEmoji, renderWithAppleEmoji, isSingleEmoji } from '../../ui/AppleEmoji'

interface ColorScheme {
  cardBorder: string
  accentBar: string
  badgeBg: string
  badgeBorder: string
  badgeText: string
  dot: string
  topGlow: string
  quoteBar: string
}

const COLOR_MAP: Record<string, ColorScheme> = {
  blue: {
    cardBorder: '',
    accentBar: '',
    badgeBg: 'bg-zinc-100 dark:bg-zinc-800/80',
    badgeBorder: 'border-transparent',
    badgeText: 'text-zinc-600 dark:text-zinc-400',
    dot: '#71717a',
    topGlow: '',
    quoteBar: 'border-l-zinc-400'
  },
  yellow: {
    cardBorder: '',
    accentBar: '',
    badgeBg: 'bg-zinc-100 dark:bg-zinc-800/80',
    badgeBorder: 'border-transparent',
    badgeText: 'text-zinc-600 dark:text-zinc-400',
    dot: '#71717a',
    topGlow: '',
    quoteBar: 'border-l-zinc-400'
  },
  green: {
    cardBorder: '',
    accentBar: '',
    badgeBg: 'bg-zinc-100 dark:bg-zinc-800/80',
    badgeBorder: 'border-transparent',
    badgeText: 'text-zinc-600 dark:text-zinc-400',
    dot: '#71717a',
    topGlow: '',
    quoteBar: 'border-l-zinc-400'
  },
  purple: {
    cardBorder: '',
    accentBar: '',
    badgeBg: 'bg-zinc-100 dark:bg-zinc-800/80',
    badgeBorder: 'border-transparent',
    badgeText: 'text-zinc-600 dark:text-zinc-400',
    dot: '#71717a',
    topGlow: '',
    quoteBar: 'border-l-zinc-400'
  },
  rose: {
    cardBorder: '',
    accentBar: '',
    badgeBg: 'bg-zinc-100 dark:bg-zinc-800/80',
    badgeBorder: 'border-transparent',
    badgeText: 'text-zinc-600 dark:text-zinc-400',
    dot: '#71717a',
    topGlow: '',
    quoteBar: 'border-l-zinc-400'
  },
  peach: {
    cardBorder: '',
    accentBar: '',
    badgeBg: 'bg-zinc-100 dark:bg-zinc-800/80',
    badgeBorder: 'border-transparent',
    badgeText: 'text-zinc-600 dark:text-zinc-400',
    dot: '#71717a',
    topGlow: '',
    quoteBar: 'border-l-zinc-400'
  },
  redBanner: {
    cardBorder: '',
    accentBar: '',
    badgeBg: 'bg-zinc-100 dark:bg-zinc-800/80',
    badgeBorder: 'border-transparent',
    badgeText: 'text-zinc-600 dark:text-zinc-400',
    dot: '#71717a',
    topGlow: '',
    quoteBar: 'border-l-zinc-400'
  },
  darkNote: {
    cardBorder: '',
    accentBar: '',
    badgeBg: 'bg-zinc-100 dark:bg-zinc-800/80',
    badgeBorder: 'border-transparent',
    badgeText: 'text-zinc-600 dark:text-zinc-400',
    dot: '#71717a',
    topGlow: '',
    quoteBar: 'border-l-zinc-400'
  },
  slate: {
    cardBorder: '',
    accentBar: '',
    badgeBg: 'bg-zinc-100 dark:bg-zinc-800/80',
    badgeBorder: 'border-transparent',
    badgeText: 'text-zinc-600 dark:text-zinc-400',
    dot: '#71717a',
    topGlow: '',
    quoteBar: 'border-l-zinc-400'
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
  const [isEditingTitle, setIsEditingTitle] = useState(false)
  const [isEditingContent, setIsEditingContent] = useState(false)

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
        className={`group relative px-6 py-3 rounded-xl transition-[box-shadow,border-color] duration-150 shadow-md ${
          selected ? 'ring-2 ring-white shadow-xl' : ''
        } bg-rose-600 dark:bg-rose-700 text-white`}
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

        {isEditingTitle ? (
          <input
            autoFocus
            type="text"
            value={title || content}
            onChange={(e) => {
              setTitle(e.target.value)
              save({ title: e.target.value, content: e.target.value })
            }}
            onBlur={() => setIsEditingTitle(false)}
            onKeyDown={(e) => e.key === 'Enter' && setIsEditingTitle(false)}
            onPointerDown={(e) => e.stopPropagation()}
            className="nodrag nowheel font-serif font-bold text-base text-center bg-transparent border-none outline-none w-full text-white placeholder-white/80"
            placeholder="Texto del banner..."
          />
        ) : (
          <div
            onDoubleClick={() => setIsEditingTitle(true)}
            className="font-serif font-bold text-base text-center text-white cursor-text select-text w-full"
          >
            {renderWithAppleEmoji(title || content || 'Texto del banner...')}
          </div>
        )}
      </div>
    )
  }

  return (
    <div
      className={`group relative rounded-2xl transition-all duration-200 bg-white dark:bg-[#18181b] p-3.5 select-none ${
        selected
          ? 'ring-2 ring-[var(--app-accent)] shadow-2xl'
          : 'shadow-[0_4px_20px_-4px_rgba(0,0,0,0.06),0_1px_3px_rgba(0,0,0,0.04)] dark:shadow-[0_8px_30px_-6px_rgba(0,0,0,0.5),0_1px_3px_rgba(0,0,0,0.3)]'
      } hover:shadow-xl`}
      style={{
        width: data.width || 280,
        minHeight: 80
      }}
    >
      {/* Handles */}
      <Handle
        id="top"
        type="source"
        position={Position.Top}
        className={`!w-2.5 !h-2.5 !bg-zinc-400 dark:!bg-zinc-500 hover:!bg-[var(--app-accent)] !border-2 !border-white dark:!border-zinc-900 transition-all opacity-0 group-hover:opacity-100 ${
          selected ? '!opacity-100' : ''
        }`}
      />
      <Handle
        id="bottom"
        type="source"
        position={Position.Bottom}
        className={`!w-2.5 !h-2.5 !bg-zinc-400 dark:!bg-zinc-500 hover:!bg-[var(--app-accent)] !border-2 !border-white dark:!border-zinc-900 transition-all opacity-0 group-hover:opacity-100 ${
          selected ? '!opacity-100' : ''
        }`}
      />
      <Handle
        id="left"
        type="source"
        position={Position.Left}
        className={`!w-2.5 !h-2.5 !bg-zinc-400 dark:!bg-zinc-500 hover:!bg-[var(--app-accent)] !border-2 !border-white dark:!border-zinc-900 transition-all opacity-0 group-hover:opacity-100 ${
          selected ? '!opacity-100' : ''
        }`}
      />
      <Handle
        id="right"
        type="source"
        position={Position.Right}
        className={`!w-2.5 !h-2.5 !bg-zinc-400 dark:!bg-zinc-500 hover:!bg-[var(--app-accent)] !border-2 !border-white dark:!border-zinc-900 transition-all opacity-0 group-hover:opacity-100 ${
          selected ? '!opacity-100' : ''
        }`}
      />

      {/* Floating delete button */}
      <button
        onClick={handleDelete}
        className="absolute top-2.5 right-2.5 p-1 rounded-full bg-zinc-100 dark:bg-zinc-800 hover:bg-rose-50 dark:hover:bg-rose-950/50 text-zinc-400 hover:text-rose-500 shadow-sm opacity-0 group-hover:opacity-100 transition z-10"
        title="Eliminar nota"
      >
        <Trash2 className="w-3.5 h-3.5" />
      </button>

      {/* Header Pill: e.g. "Causas" */}
      {(title || data.showTitle) && (
        <div className="mb-2 relative z-10 flex items-center pr-6">
          <div
            className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold tracking-wide uppercase bg-zinc-100 dark:bg-zinc-800/80 text-zinc-600 dark:text-zinc-400 shadow-xs"
          >
            <span
              className="w-1.5 h-1.5 rounded-full shrink-0 bg-zinc-400 dark:bg-zinc-500"
            />
            {isEditingTitle ? (
              <input
                autoFocus
                type="text"
                value={title}
                onChange={(e) => {
                  setTitle(e.target.value)
                  save({ title: e.target.value })
                }}
                onBlur={() => setIsEditingTitle(false)}
                onKeyDown={(e) => e.key === 'Enter' && setIsEditingTitle(false)}
                onPointerDown={(e) => e.stopPropagation()}
                placeholder="Categoría / Título..."
                className="nodrag nowheel font-sans font-semibold text-[11px] bg-transparent border-none outline-none w-auto max-w-[190px] truncate text-zinc-700 dark:text-zinc-300"
              />
            ) : (
              <span
                onDoubleClick={() => setIsEditingTitle(true)}
                className="font-sans font-semibold text-[11px] text-zinc-700 dark:text-zinc-300 cursor-text select-text truncate max-w-[190px]"
              >
                {renderWithAppleEmoji(title || 'Categoría / Título...')}
              </span>
            )}
          </div>
        </div>
      )}

      {/* Content Area */}
      {isQuote ? (
        // Quote style
        <div className={`border-l-2 pl-3 my-1.5 italic ${colorScheme.quoteBar} relative z-10`}>
          {isEditingContent ? (
            <textarea
              autoFocus
              value={content}
              onChange={(e) => {
                setContent(e.target.value)
                save({ content: e.target.value })
              }}
              onBlur={() => setIsEditingContent(false)}
              onPointerDown={(e) => e.stopPropagation()}
              rows={4}
              className="nodrag nowheel w-full bg-transparent border-none outline-none resize-none text-[13px] leading-relaxed italic text-zinc-800 dark:text-zinc-200 placeholder:text-zinc-400 dark:placeholder:text-zinc-500"
            />
          ) : (
            <div
              onDoubleClick={() => setIsEditingContent(true)}
              onPointerDown={(e) => e.stopPropagation()}
              className="nodrag cursor-text select-text whitespace-pre-wrap leading-relaxed text-[13px] italic text-zinc-800 dark:text-zinc-200 min-h-[36px]"
            >
              {content ? renderWithAppleEmoji(content) : (
                <span className="text-zinc-400 dark:text-zinc-500 italic select-none">Escribe tu cita aquí...</span>
              )}
            </div>
          )}
          {quoteAuthor && (
            <div
              onPointerDown={(e) => e.stopPropagation()}
              className="not-italic mt-1.5 text-[11px] font-medium text-zinc-500 dark:text-zinc-400 select-text nodrag"
            >
              {renderWithAppleEmoji(quoteAuthor)}
            </div>
          )}
        </div>
      ) : (
        // Normal text note
        <div className="text-[13px] leading-relaxed relative z-10">
          {data.hasHtmlHighlight ? (
            <div
              onPointerDown={(e) => e.stopPropagation()}
              dangerouslySetInnerHTML={{ __html: content }}
              className="nodrag select-text leading-relaxed text-zinc-800 dark:text-zinc-200"
            />
          ) : isEditingContent ? (
            <textarea
              autoFocus
              value={content}
              onChange={(e) => {
                setContent(e.target.value)
                save({ content: e.target.value })
              }}
              onBlur={() => setIsEditingContent(false)}
              onPointerDown={(e) => e.stopPropagation()}
              rows={content.length > 120 ? 5 : 3}
              placeholder="Escribe tu nota aquí..."
              className="nodrag nowheel w-full bg-transparent border-none outline-none resize-none text-[13px] leading-relaxed font-normal text-zinc-800 dark:text-zinc-200 placeholder:text-zinc-400 dark:placeholder:text-zinc-500"
            />
          ) : (
            <div
              onDoubleClick={() => setIsEditingContent(true)}
              onPointerDown={(e) => e.stopPropagation()}
              className="nodrag cursor-text select-text whitespace-pre-wrap leading-relaxed text-[13px] font-normal text-zinc-800 dark:text-zinc-200 min-h-[36px]"
            >
              {content ? (
                isSingleEmoji(content.trim()) && !title ? (
                  <div className="py-2 flex items-center justify-center">
                    <AppleEmoji emoji={content.trim()} size={56} className="drop-shadow-md hover:scale-110 transition-transform duration-150 cursor-pointer" />
                  </div>
                ) : (
                  renderWithAppleEmoji(content)
                )
              ) : (
                <span className="text-zinc-400 dark:text-zinc-500 italic select-none">Escribe tu nota aquí...</span>
              )}
            </div>
          )}
        </div>
      )}

      {/* Alert Callout Box */}
      {alertBox && (
        <div className="mt-3 p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs font-medium text-amber-700 dark:text-amber-300 flex items-center gap-2 relative z-10">
          <span><AppleEmoji emoji="⚠️" size={16} /></span>
          <span>{renderWithAppleEmoji(alertBox)}</span>
        </div>
      )}

      {/* Link snippet */}
      {linkUrl && (
        <div className="mt-2.5 pt-2 border-t border-zinc-200/60 dark:border-zinc-800/60 relative z-10">
          <a
            href={`https://${linkUrl}`}
            target="_blank"
            rel="noreferrer"
            className="text-[11px] text-blue-600 dark:text-blue-400 hover:underline block truncate"
          >
            {linkUrl}
          </a>
        </div>
      )}

      {/* Color switcher on hover */}
      <div className="absolute -bottom-3.5 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition flex items-center gap-1.5 p-1 rounded-full bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 shadow-lg z-20">
        {['slate', 'yellow', 'blue', 'green', 'rose', 'peach', 'darkNote'].map((col) => (
          <button
            key={col}
            onClick={() => {
              setColor(col)
              save({ color: col })
            }}
            className={`w-3.5 h-3.5 rounded-full transition-transform hover:scale-125 border border-black/10 dark:border-white/10 ${
              color === col ? 'ring-2 ring-blue-500 scale-110' : ''
            }`}
            style={{ backgroundColor: COLOR_MAP[col]?.dot || '#9ca3af' }}
            title={col}
          />
        ))}
      </div>
    </div>
  )
}, areNodePropsEqual)
