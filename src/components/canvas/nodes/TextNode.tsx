import { memo, useState, useEffect, useRef } from 'react'
import { Handle, Position } from '@xyflow/react'
import {
  DeleteIcon,
  AlignLeftIcon,
  AlignHorizontalCenterIcon,
  AlignRightIcon
} from '@blocksuite/icons/rc'
import { db } from '../../../db'
import { syncEngine } from '../../../lib/syncEngine'
import { areNodePropsEqual } from './nodeUtils'

const TEXT_COLORS: Record<string, string> = {
  white: 'text-[var(--app-text-primary)]',
  slate: 'text-[var(--app-text-secondary)]',
  blue: 'text-sky-600 dark:text-sky-400',
  green: 'text-emerald-600 dark:text-emerald-400',
  yellow: 'text-amber-600 dark:text-amber-400',
  rose: 'text-rose-600 dark:text-rose-400',
  purple: 'text-purple-600 dark:text-purple-400'
}

const FONT_SIZES: Record<string, { class: string; label: string }> = {
  sm: { class: 'text-xs', label: 'P' },
  base: { class: 'text-sm font-medium', label: 'M' },
  lg: { class: 'text-lg font-bold', label: 'H2' },
  xl: { class: 'text-2xl font-extrabold', label: 'H1' }
}

export const TextNode = memo(({ id, data, selected }: any) => {
  const [content, setContent] = useState(data.content || '')
  const [color, setColor] = useState(data.color || 'white')
  const [size, setSize] = useState<'sm' | 'base' | 'lg' | 'xl'>(data.fontSize || 'base')
  const [align, setAlign] = useState<'left' | 'center' | 'right'>(data.textAlign || 'left')
  const [isEditing, setIsEditing] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement | null>(null)

  useEffect(() => {
    if (data.content !== undefined) setContent(data.content)
    if (data.color !== undefined) setColor(data.color)
    if (data.fontSize) setSize(data.fontSize)
    if (data.textAlign) setAlign(data.textAlign)
  }, [data.content, data.color, data.fontSize, data.textAlign])

  useEffect(() => {
    if (isEditing && textareaRef.current) {
      textareaRef.current.style.height = 'auto'
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`
    }
  }, [content, isEditing])

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
      console.error('Error saving text node', e)
    }
  }

  const handleDelete = async () => {
    try {
      await db.canvasNodes.update(id, {
        isDeleted: true,
        updatedAt: Date.now(),
        syncStatus: 'pending'
      })
      syncEngine.scheduleSync(1000)
    } catch (e) {
      console.error('Error deleting text node', e)
    }
  }

  const textColorClass = TEXT_COLORS[color] || TEXT_COLORS.white
  const fontSizeClass = FONT_SIZES[size]?.class || FONT_SIZES.base.class

  return (
    <div
      className={`relative min-w-[120px] max-w-[400px] p-2 rounded-lg transition group ${
        selected
          ? 'ring-1 ring-[var(--app-accent)] bg-[var(--app-hover)]'
          : 'hover:bg-[var(--app-hover)]'
      }`}
    >
      {/* 4 Handles for connection arrows */}
      <Handle
        id="top"
        type="source"
        position={Position.Top}
        className="!w-2.5 !h-2.5 !bg-[var(--app-accent)] !border !border-white dark:!border-zinc-800"
      />
      <Handle
        id="bottom"
        type="source"
        position={Position.Bottom}
        className="!w-2.5 !h-2.5 !bg-[var(--app-accent)] !border !border-white dark:!border-zinc-800"
      />
      <Handle
        id="left"
        type="source"
        position={Position.Left}
        className="!w-2.5 !h-2.5 !bg-[var(--app-accent)] !border !border-white dark:!border-zinc-800"
      />
      <Handle
        id="right"
        type="source"
        position={Position.Right}
        className="!w-2.5 !h-2.5 !bg-[var(--app-accent)] !border !border-white dark:!border-zinc-800"
      />

      {/* Floating Toolbar when selected */}
      {selected && (
        <div
          className="absolute -top-10 left-0 z-30 flex items-center gap-1 p-1 rounded-lg border shadow-md bg-[var(--app-bg-overlay)] border-[var(--app-border)] text-[var(--app-text-primary)]"
        >
          {/* Size buttons */}
          {(['sm', 'base', 'lg', 'xl'] as const).map((s) => (
            <button
              key={s}
              onClick={() => {
                setSize(s)
                save({ fontSize: s })
              }}
              className="px-1.5 py-0.5 rounded text-[10px] font-bold transition"
              style={{
                backgroundColor: size === s ? '#1e96eb' : 'transparent',
                color: size === s ? '#ffffff' : 'var(--affine-text-secondary-color)'
              }}
            >
              {FONT_SIZES[s].label}
            </button>
          ))}

          <div
            className="w-[1px] h-3.5 mx-0.5"
            style={{ backgroundColor: 'var(--affine-border-color)' }}
          />

          {/* Alignment */}
          <button
            onClick={() => {
              const nextAlign = align === 'left' ? 'center' : align === 'center' ? 'right' : 'left'
              setAlign(nextAlign)
              save({ textAlign: nextAlign })
            }}
            className="p-1 rounded transition"
            style={{ color: 'var(--affine-text-secondary-color)' }}
            title="Alineación de texto"
          >
            {align === 'left' ? (
              <AlignLeftIcon style={{ width: 14, height: 14 }} />
            ) : align === 'center' ? (
              <AlignHorizontalCenterIcon style={{ width: 14, height: 14 }} />
            ) : (
              <AlignRightIcon style={{ width: 14, height: 14 }} />
            )}
          </button>

          <div
            className="w-[1px] h-3.5 mx-0.5"
            style={{ backgroundColor: 'var(--affine-border-color)' }}
          />

          {/* Colors */}
          {['white', 'slate', 'blue', 'green', 'yellow', 'rose', 'purple'].map((col) => (
            <button
              key={col}
              onClick={() => {
                setColor(col)
                save({ color: col })
              }}
              className={`w-3.5 h-3.5 rounded-full ${
                col === 'white'
                  ? 'bg-zinc-100'
                  : col === 'slate'
                  ? 'bg-zinc-400'
                  : col === 'blue'
                  ? 'bg-sky-400'
                  : col === 'green'
                  ? 'bg-emerald-400'
                  : col === 'yellow'
                  ? 'bg-amber-400'
                  : col === 'rose'
                  ? 'bg-rose-400'
                  : 'bg-purple-400'
              } ${color === col ? 'ring-2 ring-[#1e96eb]' : ''}`}
            />
          ))}

          <div
            className="w-[1px] h-3.5 mx-0.5"
            style={{ backgroundColor: 'var(--affine-border-color)' }}
          />

          {/* Delete */}
          <button
            onClick={handleDelete}
            className="p-1 rounded text-rose-500 hover:bg-rose-500/10 transition"
            title="Eliminar texto"
          >
            <DeleteIcon style={{ width: 13, height: 13 }} />
          </button>
        </div>
      )}

      {/* Text Body */}
      {isEditing ? (
        <textarea
          ref={textareaRef}
          autoFocus
          value={content}
          onChange={(e) => setContent(e.target.value)}
          onBlur={() => {
            setIsEditing(false)
            save({ content })
          }}
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              setIsEditing(false)
              save({ content })
            }
          }}
          placeholder="Escribe texto..."
          className={`w-full bg-transparent border-none outline-none resize-none leading-relaxed font-sans ${textColorClass} ${fontSizeClass} text-${align}`}
          rows={1}
        />
      ) : (
        <div
          onDoubleClick={() => setIsEditing(true)}
          className={`cursor-text whitespace-pre-wrap select-none leading-relaxed font-sans ${textColorClass} ${fontSizeClass} text-${align}`}
        >
          {content || (
            <span className="italic text-xs opacity-60">Doble clic para escribir texto</span>
          )}
        </div>
      )}
    </div>
  )
}, areNodePropsEqual)
