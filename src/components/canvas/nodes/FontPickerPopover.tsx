import React, { useState, useMemo, useRef, useEffect } from 'react'
import { Search, Check, X, Sparkles } from 'lucide-react'
import { FONT_FAMILIES, FONT_CATEGORIES, loadFontDynamically, type FontCategory } from '../../../lib/fonts'

interface FontPickerPopoverProps {
  currentFamily: string
  onSelect: (family: string) => void
  isOpen: boolean
  onClose: () => void
  align?: 'left' | 'right'
}

export const FontPickerPopover: React.FC<FontPickerPopoverProps> = ({
  currentFamily,
  onSelect,
  isOpen,
  onClose,
  align = 'left'
}) => {
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<FontCategory>('Todas')
  const popoverRef = useRef<HTMLDivElement>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)

  // Auto-focus search input on open
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        searchInputRef.current?.focus()
      }, 50)
    } else {
      setSearchTerm('')
      setSelectedCategory('Todas')
    }
  }, [isOpen])

  // Outside click to close
  useEffect(() => {
    if (!isOpen) return
    const handleClickOutside = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        onClose()
      }
    }
    window.addEventListener('mousedown', handleClickOutside)
    return () => window.removeEventListener('mousedown', handleClickOutside)
  }, [isOpen, onClose])

  // Filtered fonts
  const filteredFonts = useMemo(() => {
    const q = searchTerm.trim().toLowerCase()
    return FONT_FAMILIES.filter((font) => {
      const matchesCategory =
        selectedCategory === 'Todas' || font.category === selectedCategory

      if (!matchesCategory) return false

      if (!q) return true

      return (
        font.name.toLowerCase().includes(q) ||
        font.category.toLowerCase().includes(q) ||
        (font.badge && font.badge.toLowerCase().includes(q)) ||
        (font.description && font.description.toLowerCase().includes(q))
      )
    })
  }, [searchTerm, selectedCategory])

  if (!isOpen) return null

  return (
    <div
      ref={popoverRef}
      onClick={(e) => e.stopPropagation()}
      className={`fixed inset-x-3 bottom-16 sm:absolute sm:inset-x-auto sm:top-full sm:mt-2 z-50 w-auto max-w-xs mx-auto sm:w-80 max-h-[min(420px,65vh)] flex flex-col rounded-xl sm:rounded-2xl border shadow-2xl bg-[var(--app-bg-overlay)] border-[var(--app-border)] backdrop-blur-xl animate-in fade-in zoom-in-95 duration-150 overflow-hidden text-[var(--app-text-primary)] ${
        align === 'right' ? 'sm:right-0' : 'sm:left-0'
      }`}
    >
      {/* Header */}
      <div className="p-2 sm:p-3 pb-1.5 sm:pb-2 border-b border-[var(--app-border)] space-y-1.5 sm:space-y-2.5 bg-black/[0.02] dark:bg-white/[0.02]">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-[#1e96eb]" />
            <span className="text-[11px] sm:text-xs font-bold tracking-tight">Tipografías</span>
            <span className="text-[9px] sm:text-[10px] font-semibold px-1.5 py-0.2 rounded-full bg-black/5 dark:bg-white/10 text-[var(--app-text-muted)]">
              {filteredFonts.length} de {FONT_FAMILIES.length}
            </span>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 hover:bg-black/5 dark:hover:bg-white/5 transition cursor-pointer"
            title="Cerrar"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Search bar */}
        <div className="relative">
          <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-neutral-400 pointer-events-none" />
          <input
            ref={searchInputRef}
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Buscar fuente (ej: pixel, firma, serif...)"
            className="w-full pl-8 pr-7 py-1 sm:py-1.5 rounded-xl text-[11px] sm:text-xs bg-white dark:bg-neutral-900/80 border border-[var(--app-border)] focus:border-[#1e96eb] focus:outline-none placeholder:text-neutral-400 dark:placeholder:text-neutral-500 transition shadow-inner"
          />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 rounded text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200"
            >
              <X className="w-3 h-3" />
            </button>
          )}
        </div>

        {/* Category Pills */}
        <div className="flex items-center gap-1 overflow-x-auto no-scrollbar py-0.5 -mx-1 px-1">
          {FONT_CATEGORIES.map((cat) => {
            const isActive = selectedCategory === cat
            return (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`text-[9px] sm:text-[10px] font-medium px-1.5 sm:px-2 py-0.5 rounded-lg whitespace-nowrap transition cursor-pointer shrink-0 ${
                  isActive
                    ? 'bg-[#1e96eb] text-white shadow-xs font-semibold'
                    : 'text-[var(--app-text-secondary)] hover:bg-black/5 dark:hover:bg-white/10'
                }`}
              >
                {cat}
              </button>
            )
          })}
        </div>
      </div>

      {/* Font Items List */}
      <div className="flex-1 overflow-y-auto p-1.5 space-y-0.5 sm:space-y-1 divide-y divide-[var(--app-border)]/40 divide-dashed custom-scrollbar">
        {filteredFonts.length === 0 ? (
          <div className="py-8 text-center text-xs text-neutral-400 dark:text-neutral-500">
            No se encontró ninguna tipografía con "{searchTerm}"
          </div>
        ) : (
          filteredFonts.map((f) => {
            const isSelected =
              currentFamily === f.family ||
              currentFamily.includes(f.name) ||
              (f.id === 'sans' && currentFamily.startsWith('Inter'))

            return (
              <button
                key={f.id}
                onMouseEnter={() => loadFontDynamically(f.name)}
                onClick={() => {
                  loadFontDynamically(f.name)
                  onSelect(f.family)
                  onClose()
                }}
                className={`w-full text-left px-2.5 py-2 rounded-xl text-xs flex items-center justify-between transition group cursor-pointer ${
                  isSelected
                    ? 'bg-[#1e96eb]/10 dark:bg-[#1e96eb]/20 text-[#1e96eb] font-semibold border border-[#1e96eb]/30 shadow-xs'
                    : 'hover:bg-black/[0.04] dark:hover:bg-white/[0.06] text-[var(--app-text-primary)] border border-transparent'
                }`}
              >
                <div className="flex flex-col min-w-0 pr-2">
                  <div className="flex items-center gap-1.5">
                    <span
                      className="text-sm truncate leading-snug tracking-normal"
                      style={{ fontFamily: f.family }}
                    >
                      {f.name}
                    </span>
                    {f.badge && (
                      <span className="text-[9px] px-1.5 py-0.2 rounded-md font-sans bg-black/5 dark:bg-white/10 text-[var(--app-text-muted)] group-hover:bg-[#1e96eb]/15 group-hover:text-[#1e96eb] transition">
                        {f.badge}
                      </span>
                    )}
                  </div>
                  {f.description && (
                    <span className="text-[10px] text-[var(--app-text-muted)] truncate font-sans font-normal opacity-80 mt-0.5">
                      {f.description}
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <span
                    className="text-xs opacity-75 px-1 py-0.5 rounded bg-black/[0.02] dark:bg-white/[0.02]"
                    style={{ fontFamily: f.family }}
                  >
                    Aa Bb 123
                  </span>
                  {isSelected && (
                    <Check className="w-3.5 h-3.5 text-[#1e96eb] shrink-0" />
                  )}
                </div>
              </button>
            )
          })
        )}
      </div>

      {/* Footer hint */}
      <div className="px-3 py-1.5 border-t border-[var(--app-border)] bg-black/[0.02] dark:bg-white/[0.02] flex items-center justify-between text-[10px] text-[var(--app-text-muted)] font-sans">
        <span>Google Fonts + Sistema</span>
        <span>Haz clic para aplicar</span>
      </div>
    </div>
  )
}
