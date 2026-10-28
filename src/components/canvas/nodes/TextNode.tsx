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

export interface FontOption {
  id: string
  name: string
  category: string
  family: string
}

export const FONT_FAMILIES: FontOption[] = [
  // Sans-Serif
  { id: 'sans', name: 'Inter (Default)', category: 'Sans-Serif', family: 'Inter, system-ui, sans-serif' },
  { id: 'roboto', name: 'Roboto', category: 'Sans-Serif', family: 'Roboto, sans-serif' },
  { id: 'poppins', name: 'Poppins', category: 'Sans-Serif', family: 'Poppins, sans-serif' },
  { id: 'montserrat', name: 'Montserrat', category: 'Sans-Serif', family: 'Montserrat, sans-serif' },
  { id: 'opensans', name: 'Open Sans', category: 'Sans-Serif', family: '"Open Sans", sans-serif' },
  { id: 'raleway', name: 'Raleway', category: 'Sans-Serif', family: 'Raleway, sans-serif' },
  { id: 'spacegrotesk', name: 'Space Grotesk', category: 'Sans-Serif', family: '"Space Grotesk", sans-serif' },

  // Serif
  { id: 'playfair', name: 'Playfair Display', category: 'Serif', family: '"Playfair Display", serif' },
  { id: 'merriweather', name: 'Merriweather', category: 'Serif', family: 'Merriweather, serif' },
  { id: 'lora', name: 'Lora', category: 'Serif', family: 'Lora, serif' },
  { id: 'cinzel', name: 'Cinzel (Elegante)', category: 'Serif', family: 'Cinzel, serif' },

  // Handwriting & Script
  { id: 'kalam', name: 'Kalam (Manuscrita)', category: 'Handwriting', family: 'Kalam, cursive' },
  { id: 'caveat', name: 'Caveat (Firma)', category: 'Handwriting', family: 'Caveat, cursive' },
  { id: 'dancing', name: 'Dancing Script', category: 'Handwriting', family: '"Dancing Script", cursive' },
  { id: 'pacifico', name: 'Pacifico (Pincel)', category: 'Handwriting', family: 'Pacifico, cursive' },

  // Monospace & Tech
  { id: 'sourcecode', name: 'Source Code Pro', category: 'Monospace', family: '"Source Code Pro", monospace' },
  { id: 'fira', name: 'Fira Code', category: 'Monospace', family: '"Fira Code", monospace' },
  { id: 'robotomono', name: 'Roboto Mono', category: 'Monospace', family: '"Roboto Mono", monospace' },

  // Display & Impact
  { id: 'oswald', name: 'Oswald (Condensada)', category: 'Display', family: 'Oswald, sans-serif' },
  { id: 'georgia', name: 'Georgia', category: 'Classic', family: 'Georgia, serif' },
  { id: 'times', name: 'Times New Roman', category: 'Classic', family: '"Times New Roman", serif' },
  { id: 'courier', name: 'Courier New', category: 'Classic', family: '"Courier New", monospace' }
]

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
  const [fontFamily, setFontFamily] = useState(data.fontFamily || 'Inter, system-ui, sans-serif')
  const [size, setSize] = useState<'sm' | 'base' | 'lg' | 'xl'>(data.fontSize || 'base')
  const [align, setAlign] = useState<'left' | 'center' | 'right'>(data.textAlign || 'left')
  const [isEditing, setIsEditing] = useState(false)
  const [showFontMenu, setShowFontMenu] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement | null>(null)
  const fontMenuRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (data.content !== undefined) setContent(data.content)
    if (data.color !== undefined) setColor(data.color)
    if (data.fontSize) setSize(data.fontSize)
    if (data.textAlign) setAlign(data.textAlign)
    if (data.fontFamily) setFontFamily(data.fontFamily)
  }, [data.content, data.color, data.fontSize, data.textAlign, data.fontFamily])

  // Close font menu on outside click
  useEffect(() => {
    if (!showFontMenu) return
    const handleClickOutside = (e: MouseEvent) => {
      if (fontMenuRef.current && !fontMenuRef.current.contains(e.target as Node)) {
        setShowFontMenu(false)
      }
    }
    window.addEventListener('mousedown', handleClickOutside)
    return () => window.removeEventListener('mousedown', handleClickOutside)
  }, [showFontMenu])

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

  const currentFont = FONT_FAMILIES.find((f) => f.family === fontFamily) || FONT_FAMILIES[0]
  const textColorClass = TEXT_COLORS[color] || TEXT_COLORS.white
  const fontSizeClass = FONT_SIZES[size]?.class || FONT_SIZES.base.class

  return (
    <div
      className={`relative min-w-[120px] max-w-[440px] p-2 rounded-lg transition group ${
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
          className="absolute -top-11 left-0 z-40 flex items-center gap-1.5 p-1 rounded-xl border shadow-lg bg-[var(--app-bg-overlay)] border-[var(--app-border)] text-[var(--app-text-primary)] backdrop-blur-md animate-in fade-in zoom-in-95 duration-100"
        >
          {/* Typography Picker Button */}
          <div className="relative" ref={fontMenuRef}>
            <button
              onClick={() => setShowFontMenu(!showFontMenu)}
              className="flex items-center gap-1.5 px-2 py-0.5 rounded-lg text-xs font-medium hover:bg-[var(--affine-hover-color)] transition border border-[var(--affine-border-color)] max-w-[130px]"
              title="Elegir tipografía"
            >
              <span className="truncate" style={{ fontFamily: currentFont.family }}>
                {currentFont.name.split(' ')[0]}
              </span>
              <span className="text-[9px] text-[var(--affine-text-secondary-color)]">▼</span>
            </button>

            {/* Typography Popover Menu */}
            {showFontMenu && (
              <div
                className="absolute top-8 left-0 z-50 w-56 max-h-64 overflow-y-auto p-1.5 rounded-xl border shadow-2xl bg-[var(--app-bg-overlay)] border-[var(--app-border)] space-y-1 backdrop-blur-md"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="px-2 py-1 text-[10px] uppercase font-bold text-[var(--affine-text-secondary-color)] tracking-wider">
                  Tipografías ({FONT_FAMILIES.length})
                </div>

                {/* Grouped fonts */}
                {['Sans-Serif', 'Serif', 'Handwriting', 'Monospace', 'Display', 'Classic'].map((cat) => {
                  const fonts = FONT_FAMILIES.filter((f) => f.category === cat)
                  if (fonts.length === 0) return null
                  return (
                    <div key={cat} className="space-y-0.5">
                      <div className="px-2 pt-1.5 pb-0.5 text-[9px] font-semibold text-[var(--affine-text-secondary-color)] opacity-70">
                        {cat}
                      </div>
                      {fonts.map((f) => {
                        const isSelected = fontFamily === f.family
                        return (
                          <button
                            key={f.id}
                            onClick={() => {
                              setFontFamily(f.family)
                              save({ fontFamily: f.family })
                              setShowFontMenu(false)
                            }}
                            className={`w-full text-left px-2 py-1.5 rounded-lg text-xs flex items-center justify-between transition ${
                              isSelected
                                ? 'bg-[#1e96eb] text-white font-semibold'
                                : 'hover:bg-[var(--affine-hover-color)] text-[var(--affine-text-primary-color)]'
                            }`}
                          >
                            <span style={{ fontFamily: f.family }}>{f.name}</span>
                            <span className="text-[10px] opacity-60 ml-2" style={{ fontFamily: f.family }}>
                              Aa
                            </span>
                          </button>
                        )
                      })}
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          <div
            className="w-[1px] h-3.5 bg-[var(--affine-border-color)]"
          />

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
            className="w-[1px] h-3.5 bg-[var(--affine-border-color)]"
          />

          {/* Alignment */}
          <button
            onClick={() => {
              const nextAlign = align === 'left' ? 'center' : align === 'center' ? 'right' : 'left'
              setAlign(nextAlign)
              save({ textAlign: nextAlign })
            }}
            className="p-1 rounded transition hover:bg-[var(--affine-hover-color)]"
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
            className="w-[1px] h-3.5 bg-[var(--affine-border-color)]"
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
            className="w-[1px] h-3.5 bg-[var(--affine-border-color)]"
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
          onPointerDown={(e) => e.stopPropagation()}
          placeholder="Escribe texto..."
          className={`nodrag nowheel w-full bg-transparent border-none outline-none resize-none leading-relaxed select-text ${textColorClass} ${fontSizeClass} text-${align}`}
          style={{ fontFamily }}
          rows={1}
        />
      ) : (
        <div
          onDoubleClick={() => setIsEditing(true)}
          onPointerDown={(e) => {
            // Prevent ReactFlow node drag when selecting text
            e.stopPropagation()
          }}
          className={`nodrag cursor-text whitespace-pre-wrap select-text leading-relaxed ${textColorClass} ${fontSizeClass} text-${align}`}
          style={{ fontFamily }}
        >
          {content || (
            <span className="italic text-xs opacity-60 select-none">Doble clic para escribir texto</span>
          )}
        </div>
      )}
    </div>
  )
}, areNodePropsEqual)
