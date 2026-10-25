import { memo, useState, useEffect, useRef } from 'react'
import { Handle, Position } from '@xyflow/react'
import { Trash2, AlignLeft, AlignCenter, AlignRight } from 'lucide-react'
import { db } from '../../../db'
import { syncEngine } from '../../../lib/syncEngine'

const TEXT_COLORS: Record<string, string> = {
  white: 'text-zinc-100',
  slate: 'text-zinc-400',
  blue: 'text-sky-400',
  green: 'text-emerald-400',
  yellow: 'text-amber-400',
  rose: 'text-rose-400',
  purple: 'text-purple-400'
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
    setContent(data.content || '')
    setColor(data.color || 'white')
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
          ? 'ring-1 ring-blue-500 bg-[#1e1e24]/60 backdrop-blur-xs'
          : 'hover:bg-[#1a1a1e]/40'
      }`}
    >
      {/* 4 Handles for connection arrows */}
      <Handle
        type="target"
        position={Position.Top}
        className="!w-2.5 !h-2.5 !bg-indigo-500 !border-2 !border-white dark:!border-zinc-900"
      />
      <Handle
        type="source"
        position={Position.Bottom}
        className="!w-2.5 !h-2.5 !bg-indigo-500 !border-2 !border-white dark:!border-zinc-900"
      />
      <Handle
        type="target"
        position={Position.Left}
        className="!w-2.5 !h-2.5 !bg-indigo-500 !border-2 !border-white dark:!border-zinc-900"
      />
      <Handle
        type="source"
        position={Position.Right}
        className="!w-2.5 !h-2.5 !bg-indigo-500 !border-2 !border-white dark:!border-zinc-900"
      />

      {/* Floating Toolbar when selected */}
      {selected && (
        <div className="absolute -top-10 left-0 z-30 flex items-center gap-1 p-1 bg-[#18181b] border border-[#2b2b32] rounded-xl shadow-2xl backdrop-blur-md text-zinc-300">
          {/* Size buttons */}
          {(['sm', 'base', 'lg', 'xl'] as const).map((s) => (
            <button
              key={s}
              onClick={() => {
                setSize(s)
                save({ fontSize: s })
              }}
              className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                size === s ? 'bg-blue-600 text-white' : 'text-zinc-400 hover:text-white'
              }`}
            >
              {FONT_SIZES[s].label}
            </button>
          ))}

          <div className="w-[1px] h-3.5 bg-[#2d2d34] mx-0.5" />

          {/* Alignment */}
          <button
            onClick={() => {
              const nextAlign = align === 'left' ? 'center' : align === 'center' ? 'right' : 'left'
              setAlign(nextAlign)
              save({ textAlign: nextAlign })
            }}
            className="p-1 rounded text-zinc-400 hover:text-white"
            title="Alineación de texto"
          >
            {align === 'left' ? (
              <AlignLeft size={13} />
            ) : align === 'center' ? (
              <AlignCenter size={13} />
            ) : (
              <AlignRight size={13} />
            )}
          </button>

          <div className="w-[1px] h-3.5 bg-[#2d2d34] mx-0.5" />

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
              } ${color === col ? 'ring-1 ring-white' : ''}`}
            />
          ))}

          <div className="w-[1px] h-3.5 bg-[#2d2d34] mx-0.5" />

          {/* Delete */}
          <button
            onClick={handleDelete}
            className="p-1 rounded hover:bg-rose-950/50 text-zinc-400 hover:text-rose-400"
            title="Eliminar texto"
          >
            <Trash2 size={13} />
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
            <span className="text-zinc-500 italic text-xs">Doble clic para escribir texto</span>
          )}
        </div>
      )}
    </div>
  )
})
