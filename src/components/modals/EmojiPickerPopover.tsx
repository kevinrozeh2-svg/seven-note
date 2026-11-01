import { useState, useMemo, useRef, useEffect } from 'react'
import { CloseIcon, DeleteIcon, ResetIcon, SearchIcon } from '@blocksuite/icons/rc'
import { Copy, Check } from 'lucide-react'
import { toast } from 'sonner'
import { AppleEmoji } from '../ui/AppleEmoji'
import {
  EMOJI_CATEGORIES,
  EMOJIS_BY_CATEGORY,
  ALL_EMOJIS,
  getRecentEmojis,
  addRecentEmoji,
  searchEmojis,
  getRandomEmoji,
  type IndexedEmojiEntry
} from '../../lib/emojiData'

export interface EmojiPickerPopoverProps {
  currentIcon?: string
  isOpen: boolean
  onClose: () => void
  onSelectEmoji: (emoji: string) => void
  onRemoveEmoji?: () => void
  title?: string
  align?: 'left' | 'right' | 'center'
  isModal?: boolean
}

export function EmojiPickerPopover({
  currentIcon,
  isOpen,
  onClose,
  onSelectEmoji,
  onRemoveEmoji,
  title = 'Iconos Apple / iOS',
  align = 'left',
  isModal = false
}: EmojiPickerPopoverProps) {
  const [activeCategory, setActiveCategory] = useState<string>('people')
  const [search, setSearch] = useState('')
  const [hoveredEmoji, setHoveredEmoji] = useState<IndexedEmojiEntry | null>(null)
  const [copiedEmoji, setCopiedEmoji] = useState<string | null>(null)
  const [recentList, setRecentList] = useState<string[]>([])
  const searchInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (isOpen) {
      setRecentList(getRecentEmojis())
      setTimeout(() => searchInputRef.current?.focus(), 50)
    }
  }, [isOpen])

  // Close on Escape key
  useEffect(() => {
    if (!isOpen) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose])

  // Filtered emojis based on search or category
  const displayedEmojis = useMemo(() => {
    const q = search.trim()
    if (q) {
      return searchEmojis(q, 150)
    }

    if (activeCategory === 'frequent') {
      const recents = recentList.length > 0 ? recentList : getRecentEmojis()
      return recents
        .map((char) => ALL_EMOJIS.find((e) => e.emoji === char) || {
          id: char,
          name: char,
          emoji: char,
          category: 'frequent',
          keywords: [],
          searchKey: char
        })
    }

    return EMOJIS_BY_CATEGORY[activeCategory] || EMOJIS_BY_CATEGORY.people
  }, [search, activeCategory, recentList])

  if (!isOpen) return null

  const handleSelect = (emoji: string) => {
    addRecentEmoji(emoji)
    setRecentList(getRecentEmojis())
    onSelectEmoji(emoji)
  }

  const handleCopy = (e: React.MouseEvent, emoji: string) => {
    e.stopPropagation()
    navigator.clipboard.writeText(emoji)
    setCopiedEmoji(emoji)
    addRecentEmoji(emoji)
    setRecentList(getRecentEmojis())
    toast.success(`Emoji copiado: ${emoji} (¡Listo para pegar donde quieras!)`)
    setTimeout(() => setCopiedEmoji(null), 1500)
  }

  const handleRandom = () => {
    const random = getRandomEmoji()
    handleSelect(random)
    onClose()
  }

  const alignClasses =
    align === 'right'
      ? 'right-0'
      : align === 'center'
      ? 'left-1/2 -translate-x-1/2'
      : 'left-0'

  const layoutClasses = isModal
    ? 'relative z-50 w-[94vw] max-w-[360px] sm:max-w-[390px] mx-auto'
    : `absolute top-12 ${alignClasses} z-50 w-80 sm:w-88 max-w-[95vw]`

  return (
    <div
      className={`${layoutClasses} rounded-2xl border p-3 animate-in fade-in zoom-in-95 duration-150 backdrop-blur-xl shadow-2xl flex flex-col`}
      style={{
        backgroundColor: 'var(--affine-background-overlay-panel-color, rgba(255, 255, 255, 0.95))',
        borderColor: 'var(--affine-border-color, rgba(0, 0, 0, 0.1))',
        boxShadow: '0 20px 40px -8px rgba(0,0,0,0.22), 0 0 0 1px var(--affine-border-color, rgba(0,0,0,0.08))',
        color: 'var(--affine-text-primary-color, #18181b)'
      }}
      onClick={(e) => e.stopPropagation()}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between pb-2 border-b mb-2"
        style={{ borderColor: 'var(--affine-border-color, rgba(0, 0, 0, 0.08))' }}
      >
        <div className="flex items-center gap-1.5 min-w-0">
          <span className="text-xs font-semibold tracking-tight truncate">
            {title}
          </span>
          <span className="text-[10px] py-0.5 px-1.5 rounded-full bg-blue-500/10 text-blue-500 dark:text-blue-400 font-semibold shrink-0">
            {ALL_EMOJIS.length} Apple
          </span>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={handleRandom}
            className="p-1 rounded-md transition hover:bg-[var(--affine-hover-color,rgba(0,0,0,0.06))] text-neutral-500 hover:text-neutral-900 dark:hover:text-white"
            title="Emoji aleatorio"
          >
            <ResetIcon style={{ width: 13, height: 13 }} />
          </button>
          {currentIcon && onRemoveEmoji && (
            <button
              type="button"
              onClick={() => {
                onRemoveEmoji()
                onClose()
              }}
              className="p-1 rounded-md text-rose-500 hover:bg-rose-500/10 transition"
              title="Quitar icono"
            >
              <DeleteIcon style={{ width: 13, height: 13 }} />
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-md transition hover:bg-[var(--affine-hover-color,rgba(0,0,0,0.06))] text-neutral-500 hover:text-neutral-900 dark:hover:text-white"
            title="Cerrar"
          >
            <CloseIcon style={{ width: 13, height: 13 }} />
          </button>
        </div>
      </div>

      {/* Search Input */}
      <div className="relative mb-2">
        <div className="absolute inset-y-0 left-2.5 flex items-center pointer-events-none text-neutral-400">
          <SearchIcon style={{ width: 13, height: 13 }} />
        </div>
        <input
          ref={searchInputRef}
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar emoji (ej. amor, fuego, perro, trabajo)..."
          className="w-full pl-8 pr-7 py-1.5 text-xs rounded-xl border outline-none transition bg-black/[0.03] dark:bg-white/[0.05] focus:ring-1 focus:ring-blue-500"
          style={{
            borderColor: 'var(--affine-border-color, rgba(0, 0, 0, 0.1))',
            color: 'var(--affine-text-primary-color, inherit)'
          }}
        />
        {search && (
          <button
            type="button"
            onClick={() => setSearch('')}
            className="absolute inset-y-0 right-2 flex items-center text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200"
          >
            <CloseIcon style={{ width: 11, height: 11 }} />
          </button>
        )}
      </div>

      {/* Categories Bar */}
      {!search.trim() && (
        <div className="flex items-center gap-1 overflow-x-auto pb-1.5 scrollbar-none mb-1.5">
          {EMOJI_CATEGORIES.map((cat) => {
            const isActive = activeCategory === cat.id
            return (
              <button
                key={cat.id}
                type="button"
                onClick={() => setActiveCategory(cat.id)}
                className={`text-[11px] px-2 py-1 rounded-lg transition font-medium shrink-0 flex items-center gap-1 ${
                  isActive
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'text-neutral-500 hover:text-neutral-900 dark:hover:text-white hover:bg-black/[0.04] dark:hover:bg-white/[0.06]'
                }`}
                title={cat.name}
              >
                <span>{cat.icon}</span>
                <span>{cat.name}</span>
              </button>
            )
          })}
        </div>
      )}

      {/* Grid of Apple Emojis */}
      <div className="grid grid-cols-7 sm:grid-cols-8 gap-1 max-h-56 overflow-y-auto p-1 custom-scrollbar min-h-[160px]">
        {displayedEmojis.length === 0 ? (
          <div className="col-span-full py-8 text-center text-xs text-neutral-400">
            No se encontraron emojis para &ldquo;{search}&rdquo;
          </div>
        ) : (
          displayedEmojis.map((item, index) => {
            const isHovered = hoveredEmoji?.id === item.id
            return (
              <button
                key={`${item.id}-${index}`}
                type="button"
                onClick={() => {
                  handleSelect(item.emoji)
                  onClose()
                }}
                onMouseEnter={() => setHoveredEmoji(item)}
                className={`h-9 w-9 rounded-xl hover:scale-120 active:scale-95 transition-all flex items-center justify-center relative group cursor-pointer ${
                  isHovered ? 'bg-blue-500/10' : 'hover:bg-black/[0.05] dark:hover:bg-white/[0.08]'
                }`}
                title={item.name}
              >
                <AppleEmoji emoji={item.emoji} size={22} />
              </button>
            )
          })
        )}
      </div>

      {/* Footer Preview & Quick Copy */}
      <div
        className="mt-2 pt-2 border-t flex items-center justify-between text-xs"
        style={{ borderColor: 'var(--affine-border-color, rgba(0, 0, 0, 0.08))' }}
      >
        {hoveredEmoji ? (
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <div className="w-7 h-7 rounded-lg bg-black/[0.03] dark:bg-white/[0.05] flex items-center justify-center shrink-0">
              <AppleEmoji emoji={hoveredEmoji.emoji} size={20} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-medium text-[11px] truncate leading-tight">
                {hoveredEmoji.name}
              </p>
              <p className="text-[10px] text-neutral-400 truncate leading-none">
                :{hoveredEmoji.id}:
              </p>
            </div>
            <button
              type="button"
              onClick={(e) => handleCopy(e, hoveredEmoji.emoji)}
              className="px-2 py-1 rounded-lg text-[10px] font-medium bg-black/[0.05] dark:bg-white/[0.08] hover:bg-blue-600 hover:text-white transition flex items-center gap-1 shrink-0"
              title="Copiar emoji al portapapeles"
            >
              {copiedEmoji === hoveredEmoji.emoji ? (
                <>
                  <Check className="w-3 h-3 text-emerald-500" />
                  <span>Copiado</span>
                </>
              ) : (
                <>
                  <Copy className="w-3 h-3" />
                  <span>Copiar</span>
                </>
              )}
            </button>
          </div>
        ) : (
          <div className="flex items-center justify-between w-full text-neutral-400 text-[11px]">
            <span>Pasa el cursor para previsualizar</span>
            <span className="text-[10px] opacity-70">Haz clic para colocar</span>
          </div>
        )}
      </div>
    </div>
  )
}
