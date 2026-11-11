import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react'
import {
  Folder,
  FileText,
  Sparkles,
  Star,
  Target,
  Bookmark,
  Code,
  CheckSquare,
  Calendar,
  Lightbulb,
  Rocket,
  Box,
  Layers,
  Database,
  Terminal,
  Tag,
  Shield,
  Heart,
  Zap,
  Globe,
  Cpu,
  Coffee,
  Music,
  Camera,
  BookOpen,
  Briefcase,
  Flag,
  Flame,
  Award,
  Pin,
  Trash2,
  X,
  Smile,
  Search,
  Dices
} from 'lucide-react'
import {
  EMOJI_CATEGORIES,
  EMOJIS_BY_CATEGORY,
  ALL_EMOJIS,
  getRecentEmojis,
  addRecentEmoji,
  searchEmojis,
  getRandomEmoji
} from '../../lib/emojiData'

export interface NoteIconEntry {
  id: string
  name: string
  icon: string
  keywords: string[]
  component: React.ComponentType<{ size?: number; className?: string; strokeWidth?: number }>
}

export const VECTOR_NOTE_ICONS: NoteIconEntry[] = [
  { id: 'folder', name: 'Carpeta', icon: 'folder', keywords: ['carpeta', 'proyectos', 'folder', 'directorio'], component: Folder },
  { id: 'file-text', name: 'Documento', icon: 'file-text', keywords: ['documento', 'nota', 'doc', 'texto', 'archivo'], component: FileText },
  { id: 'check-square', name: 'Tareas / Checklist', icon: 'check-square', keywords: ['tareas', 'todo', 'checklist', 'check', 'hecho'], component: CheckSquare },
  { id: 'calendar', name: 'Calendario', icon: 'calendar', keywords: ['calendario', 'fecha', 'agenda', 'evento', 'reunion'], component: Calendar },
  { id: 'bookmark', name: 'Marcador', icon: 'bookmark', keywords: ['marcador', 'guardado', 'bookmark', 'favorito'], component: Bookmark },
  { id: 'star', name: 'Destacado', icon: 'star', keywords: ['estrella', 'favorito', 'destacado', 'star', 'importante'], component: Star },
  { id: 'target', name: 'Objetivo / Metas', icon: 'target', keywords: ['objetivo', 'meta', 'target', 'diana', 'kpi'], component: Target },
  { id: 'sparkles', name: 'Inspiración', icon: 'sparkles', keywords: ['chispas', 'magia', 'inspiracion', 'sparkles', 'ai'], component: Sparkles },
  { id: 'lightbulb', name: 'Ideas', icon: 'lightbulb', keywords: ['idea', 'bombilla', 'pensamiento', 'creatividad'], component: Lightbulb },
  { id: 'rocket', name: 'Lanzamiento', icon: 'rocket', keywords: ['cohete', 'lanzamiento', 'startup', 'despliegue', 'rocket'], component: Rocket },
  { id: 'code', name: 'Código / Dev', icon: 'code', keywords: ['codigo', 'dev', 'programacion', 'desarrollo', 'code'], component: Code },
  { id: 'terminal', name: 'Consola / CLI', icon: 'terminal', keywords: ['consola', 'terminal', 'bash', 'sistema'], component: Terminal },
  { id: 'database', name: 'Base de datos', icon: 'database', keywords: ['base de datos', 'sql', 'db', 'almacenamiento', 'datos'], component: Database },
  { id: 'layers', name: 'Capas / Vistas', icon: 'layers', keywords: ['capas', 'arquitectura', 'vistas', 'componentes'], component: Layers },
  { id: 'box', name: 'Producto / Caja', icon: 'box', keywords: ['caja', 'paquete', 'producto', 'modulo', 'entrega'], component: Box },
  { id: 'tag', name: 'Etiqueta', icon: 'tag', keywords: ['etiqueta', 'tag', 'categoria', 'clasificacion'], component: Tag },
  { id: 'briefcase', name: 'Negocio / Trabajo', icon: 'briefcase', keywords: ['maletin', 'trabajo', 'negocio', 'empresa', 'cliente'], component: Briefcase },
  { id: 'book-open', name: 'Lectura / Manual', icon: 'book-open', keywords: ['libro', 'lectura', 'manual', 'guia', 'aprender'], component: BookOpen },
  { id: 'shield', name: 'Seguridad', icon: 'shield', keywords: ['seguridad', 'escudo', 'privado', 'proteccion'], component: Shield },
  { id: 'zap', name: 'Rendimiento', icon: 'zap', keywords: ['rayo', 'energia', 'velocidad', 'rapido', 'accion'], component: Zap },
  { id: 'heart', name: 'Personal / Salud', icon: 'heart', keywords: ['corazon', 'personal', 'salud', 'vida', 'bienestar'], component: Heart },
  { id: 'globe', name: 'Web / Global', icon: 'globe', keywords: ['mundo', 'web', 'internet', 'global', 'red'], component: Globe },
  { id: 'cpu', name: 'Hardware / IA', icon: 'cpu', keywords: ['cpu', 'procesador', 'hardware', 'tecnologia', 'chip'], component: Cpu },
  { id: 'flame', name: 'Prioridad Alta', icon: 'flame', keywords: ['fuego', 'urgente', 'importante', 'prioridad', 'caliente'], component: Flame },
  { id: 'flag', name: 'Hito / Milestone', icon: 'flag', keywords: ['bandera', 'hito', 'meta', 'etapa', 'flag'], component: Flag },
  { id: 'pin', name: 'Fijado / Pin', icon: 'pin', keywords: ['pin', 'fijar', 'anclado', 'recordatorio'], component: Pin },
  { id: 'award', name: 'Logro / Premio', icon: 'award', keywords: ['premio', 'logro', 'reconocimiento', 'exito'], component: Award },
  { id: 'coffee', name: 'Break / Diario', icon: 'coffee', keywords: ['cafe', 'descanso', 'diario', 'rutina', 'habito'], component: Coffee },
  { id: 'music', name: 'Audio / Música', icon: 'music', keywords: ['musica', 'audio', 'podcast', 'sonido'], component: Music },
  { id: 'camera', name: 'Visual / Medios', icon: 'camera', keywords: ['camara', 'foto', 'imagenes', 'video', 'diseño'], component: Camera }
]

export function renderNoteIcon(
  icon?: string,
  size = 32,
  className = 'text-neutral-900'
) {
  if (!icon) {
    return <Folder size={size} strokeWidth={1.8} className={className} />
  }

  const clean = icon.trim()
  const matched = VECTOR_NOTE_ICONS.find((v) => v.icon === clean || v.id === clean)
  if (matched) {
    const Comp = matched.component
    return <Comp size={size} strokeWidth={1.8} className={className} />
  }

  if (clean === '📁' || clean === 'lucide:folder') return <Folder size={size} strokeWidth={1.8} className={className} />
  if (clean === 'doc' || clean === '📄' || clean === '📝' || clean === 'lucide:file-text') return <FileText size={size} strokeWidth={1.8} className={className} />
  if (clean === '✨' || clean === 'lucide:sparkles') return <Sparkles size={size} strokeWidth={1.8} className={className} />
  if (clean === '⭐' || clean === 'lucide:star') return <Star size={size} strokeWidth={1.8} className={className} />
  if (clean === '🔖' || clean === 'lucide:bookmark') return <Bookmark size={size} strokeWidth={1.8} className={className} />
  if (clean === '🎯' || clean === 'lucide:target') return <Target size={size} strokeWidth={1.8} className={className} />
  if (clean === '💻' || clean === 'lucide:code') return <Code size={size} strokeWidth={1.8} className={className} />
  if (clean === '✅' || clean === 'lucide:check-square') return <CheckSquare size={size} strokeWidth={1.8} className={className} />
  if (clean === '📅' || clean === 'lucide:calendar') return <Calendar size={size} strokeWidth={1.8} className={className} />
  if (clean === '💡' || clean === 'lucide:lightbulb') return <Lightbulb size={size} strokeWidth={1.8} className={className} />
  if (clean === '🚀' || clean === 'lucide:rocket') return <Rocket size={size} strokeWidth={1.8} className={className} />
  if (clean === '📦' || clean === 'lucide:box') return <Box size={size} strokeWidth={1.8} className={className} />
  if (clean === '🏷️' || clean === 'lucide:tag') return <Tag size={size} strokeWidth={1.8} className={className} />

  // Native crisp emoji rendering (Zero network latency)
  return (
    <span
      className="inline-flex items-center justify-center font-emoji leading-none select-none shrink-0"
      style={{ fontSize: `${Math.round(size * 0.9)}px` }}
    >
      {clean}
    </span>
  )
}

interface NoteIconPickerModalProps {
  isOpen: boolean
  onClose: () => void
  currentIcon?: string
  onSelectIcon: (iconName: string) => void
  onRemoveIcon: () => void
}

const INITIAL_RENDER_LIMIT = 96
const BATCH_SIZE = 64

export function NoteIconPickerModal({
  isOpen,
  onClose,
  currentIcon,
  onSelectIcon,
  onRemoveIcon
}: NoteIconPickerModalProps) {
  const [tab, setTab] = useState<'emojis' | 'icons'>('emojis')
  const [search, setSearch] = useState('')
  const [emojiCategory, setEmojiCategory] = useState<string>('people')
  const [renderLimit, setRenderLimit] = useState<number>(INITIAL_RENDER_LIMIT)

  const searchInputRef = useRef<HTMLInputElement>(null)
  const gridContainerRef = useRef<HTMLDivElement>(null)

  // Focus search input instantly on open
  useEffect(() => {
    if (isOpen) {
      setSearch('')
      setRenderLimit(INITIAL_RENDER_LIMIT)
      setTimeout(() => searchInputRef.current?.focus(), 25)
    }
  }, [isOpen])

  // Reset pagination limit when category or search changes
  useEffect(() => {
    setRenderLimit(INITIAL_RENDER_LIMIT)
    if (gridContainerRef.current) {
      gridContainerRef.current.scrollTop = 0
    }
  }, [search, emojiCategory, tab])

  // Filtered Vector Icons (memoized, instant)
  const filteredVectorIcons = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return VECTOR_NOTE_ICONS
    return VECTOR_NOTE_ICONS.filter(
      (item) =>
        item.name.toLowerCase().includes(q) ||
        item.icon.toLowerCase().includes(q) ||
        item.keywords.some((k) => k.toLowerCase().includes(q))
    )
  }, [search])

  // Filtered Emojis (Instant memoized search without delay)
  const displayedEmojis = useMemo(() => {
    const q = search.trim()
    if (q) return searchEmojis(q, 120)

    if (emojiCategory === 'frequent') {
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

    return EMOJIS_BY_CATEGORY[emojiCategory] || EMOJIS_BY_CATEGORY.people
  }, [search, emojiCategory])

  // Sliced emojis for initial instant paint (0ms lag)
  const visibleEmojis = useMemo(() => {
    return displayedEmojis.slice(0, renderLimit)
  }, [displayedEmojis, renderLimit])

  // Infinite scroll loader: loads next batch seamlessly on scroll
  const handleScroll = useCallback(() => {
    const el = gridContainerRef.current
    if (!el) return
    if (el.scrollHeight - el.scrollTop - el.clientHeight < 80) {
      setRenderLimit((prev) => {
        if (prev < displayedEmojis.length) {
          return prev + BATCH_SIZE
        }
        return prev
      })
    }
  }, [displayedEmojis.length])

  // Fast direct selection
  const handleSelectEmoji = useCallback(
    (emoji: string) => {
      addRecentEmoji(emoji)
      onSelectIcon(emoji)
      onClose()
    },
    [onSelectIcon, onClose]
  )

  const handleSelectVector = useCallback(
    (iconId: string) => {
      onSelectIcon(iconId)
      onClose()
    },
    [onSelectIcon, onClose]
  )

  const handleRandomEmoji = useCallback(() => {
    const random = getRandomEmoji()
    handleSelectEmoji(random)
  }, [handleSelectEmoji])

  // Pure DOM keyboard navigation: ZERO React re-renders on arrow navigation!
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
      const cols = tab === 'icons' ? 5 : 8

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
          if (tab === 'icons' && filteredVectorIcons.length > 0) {
            handleSelectVector(filteredVectorIcons[0].icon)
          } else if (tab === 'emojis' && displayedEmojis.length > 0) {
            handleSelectEmoji(displayedEmojis[0].emoji)
          }
        }
      }
    },
    [tab, filteredVectorIcons, displayedEmojis, handleSelectVector, handleSelectEmoji, onClose]
  )

  if (!isOpen) return null

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Selector de icono y emojis"
      onKeyDown={handleKeyDown}
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs select-none animate-in fade-in duration-75"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm sm:max-w-md rounded-2xl bg-white dark:bg-[#18181b] border border-neutral-200 dark:border-neutral-800 shadow-2xl overflow-hidden flex flex-col text-neutral-800 dark:text-neutral-100"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Compact Header */}
        <div className="flex items-center justify-between px-3.5 py-2.5 border-b border-neutral-200/80 dark:border-neutral-800 bg-neutral-50/60 dark:bg-neutral-900/40">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-7 h-7 rounded-lg bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 flex items-center justify-center shrink-0">
              {renderNoteIcon(currentIcon || 'folder', 16)}
            </div>
            <span className="text-xs font-semibold tracking-tight text-neutral-800 dark:text-neutral-100">
              Icono de la Nota
            </span>
          </div>

          <div className="flex items-center gap-1 shrink-0">
            {tab === 'emojis' && (
              <button
                type="button"
                onClick={handleRandomEmoji}
                className="flex items-center gap-1 px-2 py-1 text-[11px] font-medium text-neutral-600 dark:text-neutral-300 hover:bg-neutral-200/60 dark:hover:bg-neutral-800 rounded-md transition cursor-pointer"
                title="Emoji aleatorio"
                aria-label="Elegir emoji aleatorio"
              >
                <Dices className="w-3.5 h-3.5 text-blue-500" />
                <span>Aleatorio</span>
              </button>
            )}

            {currentIcon && (
              <button
                type="button"
                onClick={() => {
                  onRemoveIcon()
                  onClose()
                }}
                className="flex items-center gap-1 px-2 py-1 text-[11px] text-rose-500 hover:bg-rose-500/10 rounded-md transition font-medium cursor-pointer"
                title="Quitar icono actual"
                aria-label="Quitar icono de la nota"
              >
                <Trash2 className="w-3 h-3" />
                <span>Quitar</span>
              </button>
            )}

            <button
              type="button"
              onClick={onClose}
              className="p-1 rounded-md hover:bg-neutral-200/60 dark:hover:bg-neutral-800 text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 transition cursor-pointer"
              title="Cerrar (Esc)"
              aria-label="Cerrar ventana"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Tab Switcher & Search Bar */}
        <div className="p-3 pb-2 space-y-2 border-b border-neutral-200/80 dark:border-neutral-800">
          {/* Tabs */}
          <div
            role="tablist"
            className="flex items-center p-0.5 rounded-xl bg-neutral-100 dark:bg-neutral-800/80 border border-neutral-200/60 dark:border-neutral-700/50"
          >
            <button
              role="tab"
              aria-selected={tab === 'emojis'}
              type="button"
              onClick={() => {
                setTab('emojis')
                searchInputRef.current?.focus()
              }}
              className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 text-xs font-semibold rounded-lg transition cursor-pointer ${
                tab === 'emojis'
                  ? 'bg-white dark:bg-[#18181b] text-neutral-900 dark:text-white shadow-xs'
                  : 'text-neutral-500 hover:text-neutral-900 dark:hover:text-white'
              }`}
            >
              <Smile className="w-3.5 h-3.5" />
              <span>Emojis</span>
            </button>

            <button
              role="tab"
              aria-selected={tab === 'icons'}
              type="button"
              onClick={() => {
                setTab('icons')
                searchInputRef.current?.focus()
              }}
              className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 text-xs font-semibold rounded-lg transition cursor-pointer ${
                tab === 'icons'
                  ? 'bg-white dark:bg-[#18181b] text-neutral-900 dark:text-white shadow-xs'
                  : 'text-neutral-500 hover:text-neutral-900 dark:hover:text-white'
              }`}
            >
              <Folder className="w-3.5 h-3.5" />
              <span>Iconos Vectoriales</span>
            </button>
          </div>

          {/* Instant Search Bar */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-neutral-400 pointer-events-none" />
            <input
              ref={searchInputRef}
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={
                tab === 'icons'
                  ? 'Buscar icono (carpeta, tareas, código, estrella)...'
                  : 'Buscar emoji (amor, fuego, perro, trabajo, idea)...'
              }
              className="w-full pl-8 pr-7 py-1.5 text-xs rounded-xl bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700/80 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/20 transition"
              aria-label="Buscar"
            />
            {search && (
              <button
                type="button"
                onClick={() => {
                  setSearch('')
                  searchInputRef.current?.focus()
                }}
                className="absolute right-2.5 top-2 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200 cursor-pointer"
                aria-label="Limpiar búsqueda"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>

          {/* Compact Category Icons Bar (Only in Emojis tab and when not searching) */}
          {tab === 'emojis' && !search.trim() && (
            <div
              role="tablist"
              aria-label="Categorías"
              className="flex items-center justify-between gap-1 overflow-x-auto pt-0.5 pb-0.5 scrollbar-none"
            >
              {EMOJI_CATEGORIES.map((cat) => {
                const isActive = emojiCategory === cat.id
                return (
                  <button
                    key={cat.id}
                    role="tab"
                    aria-selected={isActive}
                    type="button"
                    onClick={() => setEmojiCategory(cat.id)}
                    className={`h-7 w-7 rounded-lg transition-all flex items-center justify-center shrink-0 cursor-pointer ${
                      isActive
                        ? 'bg-blue-600 text-white shadow-xs scale-105'
                        : 'text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-800'
                    }`}
                    title={cat.name}
                    aria-label={cat.name}
                  >
                    <span className="font-emoji text-xs leading-none">{cat.icon}</span>
                  </button>
                )
              })}
            </div>
          )}
        </div>

        {/* Grid Body: 100% Zero-JS-Hover (Pure CSS, 120 FPS guaranteed) */}
        <div
          ref={gridContainerRef}
          onScroll={handleScroll}
          className="p-3 overflow-y-auto custom-scrollbar h-60 sm:h-72"
        >
          {tab === 'icons' ? (
            /* Vector Icons Grid */
            filteredVectorIcons.length === 0 ? (
              <div className="py-12 text-center text-xs text-neutral-400">
                No se encontraron iconos para &ldquo;{search}&rdquo;
              </div>
            ) : (
              <div className="grid grid-cols-5 gap-2">
                {filteredVectorIcons.map((entry) => {
                  const IconComp = entry.component
                  const isSelected = currentIcon === entry.icon || currentIcon === entry.id
                  return (
                    <button
                      key={entry.id}
                      type="button"
                      onClick={() => handleSelectVector(entry.icon)}
                      className={`flex flex-col items-center justify-center p-2 rounded-xl border transition-colors duration-75 cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-blue-500 active:scale-95 ${
                        isSelected
                          ? 'bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 border-transparent shadow-xs'
                          : 'bg-neutral-50/70 dark:bg-neutral-800/40 border-neutral-200/80 dark:border-neutral-700/60 hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-700 dark:text-neutral-200'
                      }`}
                      title={entry.name}
                      aria-label={entry.name}
                    >
                      <IconComp size={20} strokeWidth={1.8} />
                      <span className="text-[9px] mt-1 truncate max-w-full leading-tight opacity-75">
                        {entry.name.split(' ')[0]}
                      </span>
                    </button>
                  )
                })}
              </div>
            )
          ) : (
            /* Fast GPU Native Emojis Grid (0ms hover lag) */
            visibleEmojis.length === 0 ? (
              <div className="py-12 text-center text-xs text-neutral-400">
                No se encontraron emojis para &ldquo;{search}&rdquo;
              </div>
            ) : (
              <div className="grid grid-cols-8 gap-1">
                {visibleEmojis.map((item, index) => (
                  <button
                    key={`${item.id}-${index}`}
                    type="button"
                    onClick={() => handleSelectEmoji(item.emoji)}
                    className="h-8 w-8 sm:h-9 sm:w-9 rounded-xl flex items-center justify-center transition-colors duration-75 hover:bg-neutral-100 dark:hover:bg-neutral-800/80 active:scale-90 cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                    title={item.name}
                    aria-label={item.name}
                  >
                    <span className="font-emoji text-[20px] sm:text-[22px] leading-none pointer-events-none select-none">
                      {item.emoji}
                    </span>
                  </button>
                ))}
              </div>
            )
          )}
        </div>

        {/* Lightweight Clean Footer */}
        <div className="px-4 py-2 border-t border-neutral-200/80 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-900/30 flex items-center justify-between text-[11px] text-neutral-400">
          <span className="truncate">Haz clic o usa ↑↓←→</span>
          <span className="text-[10px] opacity-75 shrink-0 font-mono">
            ↵ Elegir • Esc Cerrar
          </span>
        </div>
      </div>
    </div>
  )
}
