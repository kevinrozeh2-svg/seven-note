import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react'
import { CloseIcon, DeleteIcon, ResetIcon, SearchIcon } from '@blocksuite/icons/rc'
import {
  EMOJI_CATEGORIES,
  EMOJIS_BY_CATEGORY,
  ALL_EMOJIS,
  getRecentEmojis,
  addRecentEmoji,
  searchEmojis,
  getRandomEmoji
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

const INITIAL_RENDER_LIMIT = 96
const BATCH_SIZE = 64

export function EmojiPickerPopover({
  currentIcon,
  isOpen,
  onClose,
  onSelectEmoji,
  onRemoveEmoji,
  title = 'Selector de Emojis',
  align = 'left',
  isModal = false
}: EmojiPickerPopoverProps) {
  const [activeCategory, setActiveCategory] = useState<string>('people')
  const [search, setSearch] = useState('')
  const [renderLimit, setRenderLimit] = useState<number>(INITIAL_RENDER_LIMIT)

  const searchInputRef = useRef<HTMLInputElement>(null)
  const gridContainerRef = useRef<HTMLDivElement>(null)

  // Reset search and focus input on open
  useEffect(() => {
    if (isOpen) {
      setSearch('')
      setRenderLimit(INITIAL_RENDER_LIMIT)
      setTimeout(() => searchInputRef.current?.focus(), 25)
    }
  }, [isOpen])

  // Reset pagination when search or category changes
  useEffect(() => {
    setRenderLimit(INITIAL_RENDER_LIMIT)
    if (gridContainerRef.current) {
      gridContainerRef.current.scrollTop = 0
    }
  }, [search, activeCategory])

  // Instant memoized search & category filtering (Zero lag)
  const allFilteredEmojis = useMemo(() => {
    const q = search.trim()
    if (q) return searchEmojis(q, 120)

    if (activeCategory === 'frequent') {
      const recents = getRecentEmojis()
      return recents.map(
        (char) =>
          ALL_EMOJIS.find((e) => e.emoji === char) || {
            id: char,
            name: char,
            emoji: char,
            category: 'frequent',
            keywords: [],
            searchKey: char
          }
      )
    }

    return EMOJIS_BY_CATEGORY[activeCategory] || EMOJIS_BY_CATEGORY.people
  }, [search, activeCategory])

  // Render a slice to guarantee instant 0ms mount time
  const visibleEmojis = useMemo(() => {
    return allFilteredEmojis.slice(0, renderLimit)
  }, [allFilteredEmojis, renderLimit])

  // Infinite scroll loader: loads next chunk smoothly on demand
  const handleScroll = useCallback(() => {
    const el = gridContainerRef.current
    if (!el) return
    if (el.scrollHeight - el.scrollTop - el.clientHeight < 80) {
      setRenderLimit((prev) => {
        if (prev < allFilteredEmojis.length) {
          return prev + BATCH_SIZE
        }
        return prev
      })
    }
  }, [allFilteredEmojis.length])

  const handleSelect = useCallback(
    (emoji: string) => {
      addRecentEmoji(emoji)
      onSelectEmoji(emoji)
      onClose()
    },
    [onSelectEmoji, onClose]
  )

  const handleRandom = useCallback(() => {
    const random = getRandomEmoji()
    handleSelect(random)
  }, [handleSelect])

  // Direct DOM keyboard navigation: ZERO React re-renders on arrow keys!
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        onClose()
        return
      }

      const grid = gridContainerRef.current
      if (!grid) return

      const buttons = Array.from(grid.querySelectorAll('button')) as HTMLButtonElement[]
      if (buttons.length === 0) return

      const activeEl = document.activeElement as HTMLElement
      const currentIndex = buttons.indexOf(activeEl as HTMLButtonElement)
      const cols = 8

      if (e.key === 'ArrowDown') {
        e.preventDefault()
        if (currentIndex === -1) {
          buttons[0]?.focus()
        } else {
          const next = Math.min(buttons.length - 1, currentIndex + cols)
          buttons[next]?.focus()
        }
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        if (currentIndex === -1 || currentIndex - cols < 0) {
          searchInputRef.current?.focus()
        } else {
          buttons[currentIndex - cols]?.focus()
        }
      } else if (e.key === 'ArrowRight') {
        e.preventDefault()
        if (currentIndex === -1) {
          buttons[0]?.focus()
        } else {
          buttons[Math.min(buttons.length - 1, currentIndex + 1)]?.focus()
        }
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault()
        if (currentIndex <= 0) {
          searchInputRef.current?.focus()
        } else {
          buttons[currentIndex - 1]?.focus()
        }
      } else if (e.key === 'Enter') {
        if (document.activeElement === searchInputRef.current) {
          e.preventDefault()
          if (allFilteredEmojis.length > 0) {
            handleSelect(allFilteredEmojis[0].emoji)
          }
        }
      }
    },
    [allFilteredEmojis, handleSelect, onClose]
  )

  if (!isOpen) return null

  const alignClasses =
    align === 'right'
      ? 'right-0'
      : align === 'center'
      ? 'left-1/2 -translate-x-1/2'
      : 'left-0'

  const layoutClasses = isModal
    ? 'relative z-50 w-[calc(100vw-24px)] max-w-[380px] mx-auto'
    : `fixed inset-x-3 top-16 mx-auto sm:mx-0 sm:absolute sm:inset-x-auto sm:top-12 ${alignClasses} z-50 w-[calc(100vw-24px)] max-w-[380px] sm:w-[360px] sm:max-w-none`

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onKeyDown={handleKeyDown}
      className={`${layoutClasses} rounded-2xl border p-2.5 sm:p-3 animate-in fade-in zoom-in-95 duration-75 backdrop-blur-xl shadow-2xl flex flex-col max-h-[min(500px,85vh)] overflow-hidden select-none`}
      style={{
        backgroundColor: 'var(--affine-background-overlay-panel-color, rgba(255, 255, 255, 0.98))',
        borderColor: 'var(--affine-border-color, rgba(0, 0, 0, 0.1))',
        boxShadow: '0 20px 45px -10px rgba(0,0,0,0.3), 0 0 0 1px var(--affine-border-color, rgba(0,0,0,0.08))',
        color: 'var(--affine-text-primary-color, #18181b)'
      }}
      onClick={(e) => e.stopPropagation()}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between pb-2 border-b mb-2 shrink-0"
        style={{ borderColor: 'var(--affine-border-color, rgba(0, 0, 0, 0.08))' }}
      >
        <div className="flex items-center gap-2 min-w-0">
          {currentIcon ? (
            <span className="font-emoji text-base leading-none">{currentIcon}</span>
          ) : (
            <span className="font-emoji text-base leading-none">✨</span>
          )}
          <span className="text-xs font-semibold tracking-tight truncate">
            {title}
          </span>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={handleRandom}
            className="flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-medium transition hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-600 dark:text-neutral-300 cursor-pointer"
            title="Emoji aleatorio"
            aria-label="Elegir emoji aleatorio"
          >
            <ResetIcon style={{ width: 12, height: 12 }} />
            <span className="text-[11px]">Aleatorio</span>
          </button>
          {currentIcon && onRemoveEmoji && (
            <button
              type="button"
              onClick={() => {
                onRemoveEmoji()
                onClose()
              }}
              className="flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-medium text-rose-500 hover:bg-rose-500/10 transition cursor-pointer"
              title="Quitar icono"
              aria-label="Quitar icono actual"
            >
              <DeleteIcon style={{ width: 12, height: 12 }} />
              <span className="text-[11px]">Quitar</span>
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg transition hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 cursor-pointer"
            title="Cerrar (Esc)"
            aria-label="Cerrar selector"
          >
            <CloseIcon style={{ width: 13, height: 13 }} />
          </button>
        </div>
      </div>

      {/* Instant Search Bar */}
      <div className="relative mb-2 shrink-0">
        <div className="absolute inset-y-0 left-2.5 flex items-center pointer-events-none text-neutral-400">
          <SearchIcon style={{ width: 13, height: 13 }} />
        </div>
        <input
          ref={searchInputRef}
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar emoji (amor, fuego, perro, trabajo)..."
          className="w-full pl-8 pr-7 py-1.5 text-xs rounded-xl border outline-none transition bg-black/[0.03] dark:bg-white/[0.06] focus:border-blue-500 focus:ring-1 focus:ring-blue-500/30"
          style={{
            borderColor: 'var(--affine-border-color, rgba(0, 0, 0, 0.1))',
            color: 'var(--affine-text-primary-color, inherit)'
          }}
          aria-label="Buscar emojis"
        />
        {search && (
          <button
            type="button"
            onClick={() => {
              setSearch('')
              searchInputRef.current?.focus()
            }}
            className="absolute inset-y-0 right-2 flex items-center text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200 cursor-pointer"
            aria-label="Limpiar búsqueda"
          >
            <CloseIcon style={{ width: 11, height: 11 }} />
          </button>
        )}
      </div>

      {/* Category Icons Row (Compact, Apple-style) */}
      {!search.trim() && (
        <div
          role="tablist"
          aria-label="Categorías de emojis"
          className="flex items-center justify-between gap-1 pb-1.5 scrollbar-none mb-1 shrink-0 overflow-x-auto"
        >
          {EMOJI_CATEGORIES.map((cat) => {
            const isActive = activeCategory === cat.id
            return (
              <button
                key={cat.id}
                role="tab"
                aria-selected={isActive}
                type="button"
                onClick={() => setActiveCategory(cat.id)}
                className={`h-7 w-7 rounded-lg transition-all flex items-center justify-center shrink-0 cursor-pointer ${
                  isActive
                    ? 'bg-blue-600 text-white shadow-xs scale-105'
                    : 'text-neutral-500 hover:bg-black/[0.05] dark:hover:bg-white/[0.08]'
                }`}
                title={cat.name}
                aria-label={cat.name}
              >
                <span className="font-emoji leading-none text-xs">{cat.icon}</span>
              </button>
            )
          })}
        </div>
      )}

      {/* Grid of Emojis: 100% Zero-JS-Hover (Pure CSS, 120 FPS guaranteed) */}
      <div
        ref={gridContainerRef}
        role="grid"
        aria-label="Emojis disponibles"
        onScroll={handleScroll}
        className="grid grid-cols-8 gap-1 max-h-56 overflow-y-auto p-1 custom-scrollbar min-h-[160px] flex-1"
      >
        {visibleEmojis.length === 0 ? (
          <div className="col-span-full py-10 text-center text-xs text-neutral-400">
            No se encontraron emojis para &ldquo;{search}&rdquo;
          </div>
        ) : (
          visibleEmojis.map((item, index) => (
            <button
              key={`${item.id}-${index}`}
              role="gridcell"
              type="button"
              onClick={() => handleSelect(item.emoji)}
              className="h-8 w-8 sm:h-9 sm:w-9 rounded-xl flex items-center justify-center cursor-pointer outline-none transition-colors duration-75 hover:bg-black/[0.06] dark:hover:bg-white/[0.1] active:scale-90 focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:bg-blue-500/10"
              title={item.name}
              aria-label={item.name}
            >
              <span className="font-emoji select-none text-[20px] sm:text-[22px] leading-none pointer-events-none">
                {item.emoji}
              </span>
            </button>
          ))
        )}
      </div>

      {/* Lightweight Accessible Footer */}
      <div
        className="mt-1.5 pt-1.5 border-t flex items-center justify-between text-[11px] text-neutral-400 shrink-0"
        style={{ borderColor: 'var(--affine-border-color, rgba(0, 0, 0, 0.08))' }}
      >
        <span className="truncate">Haz clic o usa ↑↓←→</span>
        <span className="text-[10px] opacity-75 shrink-0 ml-1 font-mono">↵ Elegir • Esc Cerrar</span>
      </div>
    </div>
  )
}
