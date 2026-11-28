import React, { useMemo, useState, useRef, useEffect, useCallback } from 'react'
import {
  CaretDown,
  Plus,
  FileText,
  Kanban,
  FolderSimple,
  Sparkle,
  Star,
  Clock,
  ArrowRight,
  MagnifyingGlass,
  Books,
  SquaresFour,
  ArrowElbowDownLeft,
  BookOpen,
  PencilSimpleLine,
  Check
} from '@phosphor-icons/react'
import {
  type WorkspaceItem,
  type SpaceItem,
  DEFAULT_SPACE_ID,
  normalizeFolderPath
} from '../../db'
import { type TeamMember } from '../../lib/teamAuth'
import {
  DOCUMENT_READS_CHANGED_EVENT,
  getDocumentReadStatsMap,
  type DocumentReadSummary
} from '../../lib/documentReads'
import { toast } from '../../lib/toast'
import { AmbientGlowBackdrop } from '../ui/AmbientGlowBackdrop'
import { AppleEmoji, renderWithAppleEmoji } from '../ui/AppleEmoji'
import {
  HomeReadHub,
  type PrivateReadingAnnotation,
  type PrivateAnnotationsMap
} from './HomeReadHub'

export interface HomePageProps {
  workspaces: WorkspaceItem[]
  spaces: SpaceItem[]
  currentSpaceId: string
  currentMember: TeamMember
  onSelectWorkspace: (id: string, spaceId?: string, workspaceItem?: WorkspaceItem) => void
  onSelectSpace: (spaceId: string) => void
  onQuickCreateNote: (options: {
    title: string
    spaceId: string
    folder?: string | null
    viewMode: 'doc' | 'canvas'
    isPrivate?: boolean
    docContent?: string
  }) => Promise<void> | void
  onOpenSearch: () => void
  onOpenTemplates: () => void
  onOpenAllDocs: () => void
}

type HomeMode = 'create' | 'read'
type HomeTab = 'overview' | 'spaces' | 'recent'
type TimeRange = 'all' | '30d' | '7d'

function getPrivateNotesStorageKey(memberId: string): string {
  return `seven_note_private_reading_notes_v1:${memberId || 'default'}`
}

function loadPrivateAnnotations(memberId: string): PrivateAnnotationsMap {
  if (typeof window === 'undefined') return {}
  try {
    const raw = localStorage.getItem(getPrivateNotesStorageKey(memberId))
    if (!raw) return {}
    const parsed = JSON.parse(raw)
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    return {}
  }
}

function savePrivateAnnotations(memberId: string, data: PrivateAnnotationsMap): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(getPrivateNotesStorageKey(memberId), JSON.stringify(data))
  } catch {
    // ignore storage quota errors
  }
}

function stripHtmlToPlainText(html?: string): string {
  if (!html) return ''
  return html
    .replace(/<\/(p|div|li|h[1-6]|blockquote|tr)>/gi, '\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]{2,}/g, ' ')
    .trim()
}

function stripHtmlAndCountWords(html?: string): number {
  const plain = stripHtmlToPlainText(html)
  if (!plain) return 0
  return plain.split(/\s+/).filter(Boolean).length
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function formatCompactNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 10_000) return `${(n / 1_000).toFixed(1)}K`
  return n.toLocaleString('es-ES')
}

function toDayKey(ts: number): string {
  const d = new Date(ts)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function formatRelativeTime(ts?: number): string {
  if (!ts) return 'Reciente'
  const diffSec = Math.max(1, Math.floor((Date.now() - ts) / 1000))
  if (diffSec < 60) return `hace ${diffSec} s`
  const diffMin = Math.floor(diffSec / 60)
  if (diffMin < 60) return `hace ${diffMin} min`
  const diffHours = Math.floor(diffMin / 60)
  if (diffHours < 24) return `hace ${diffHours} h`
  const diffDays = Math.floor(diffHours / 24)
  if (diffDays < 30) return `hace ${diffDays} d`
  return new Date(ts).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })
}

interface PrismSelectOption {
  value: string
  label: string
  icon?: React.ReactNode
}

interface PrismSelectMenuProps {
  ariaLabel: string
  value: string
  options: PrismSelectOption[]
  onChange: (value: string) => void
  icon?: React.ReactNode
  placement?: 'up' | 'down'
  className?: string
  menuWidthClass?: string
}

const PrismSelectMenu: React.FC<PrismSelectMenuProps> = ({
  ariaLabel,
  value,
  options,
  onChange,
  icon,
  placement = 'down',
  className = '',
  menuWidthClass = 'min-w-[190px] max-w-[260px]'
}) => {
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const handlePointerDown = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    window.addEventListener('mousedown', handlePointerDown)
    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('mousedown', handlePointerDown)
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [open])

  const selected = options.find((o) => o.value === value) || options[0]

  return (
    <div ref={containerRef} className={`relative inline-flex ${className}`}>
      <button
        type="button"
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((prev) => !prev)}
        className={`h-7 px-2.5 rounded-lg bg-[var(--app-bg-overlay)]/88 backdrop-blur-md border text-[11.5px] font-medium text-[var(--app-text-primary)] inline-flex items-center gap-1.5 transition cursor-pointer max-w-[200px] ${
          open
            ? 'border-[var(--app-accent)]/70'
            : 'border-[var(--app-border-strong)] hover:border-[var(--app-accent)]/45'
        }`}
        style={{ boxShadow: 'inset 0 1px 0 var(--prism-specular)' }}
      >
        {icon && <span className="shrink-0 flex items-center">{icon}</span>}
        <span className="truncate">{selected?.label || ''}</span>
        <CaretDown
          size={11}
          className={`shrink-0 text-[var(--app-text-muted)] transition-transform duration-150 ${
            open ? 'rotate-180 text-[var(--app-accent)]' : ''
          }`}
        />
      </button>

      {open && (
        <div
          role="listbox"
          aria-label={ariaLabel}
          className={`absolute left-0 z-50 ${menuWidthClass} rounded-xl bg-[var(--app-bg-overlay)]/96 backdrop-blur-xl border border-[var(--app-border-strong)] p-1.5 shadow-[0_18px_44px_-10px_rgba(0,0,0,0.48)] ${
            placement === 'up' ? 'bottom-full mb-1.5' : 'top-full mt-1.5'
          }`}
          style={{
            backgroundImage: 'var(--prism-sheen)',
            boxShadow:
              'inset 0 1px 0 var(--prism-specular), 0 18px 44px -10px rgba(0, 0, 0, 0.48)'
          }}
        >
          {/* Top 1px prism caustic accent */}
          <div
            aria-hidden="true"
            className="pointer-events-none mx-2 mb-1 h-px opacity-75"
            style={{
              background:
                'linear-gradient(90deg, transparent, var(--prism-1) 24%, var(--prism-2) 50%, var(--prism-3) 76%, var(--prism-4) 90%, transparent)'
            }}
          />
          <div className="flex flex-col gap-0.5 max-h-60 overflow-y-auto custom-scrollbar">
            {options.map((opt) => {
              const isSelected = opt.value === value
              return (
                <button
                  key={opt.value}
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  onClick={() => {
                    onChange(opt.value)
                    setOpen(false)
                  }}
                  className={`w-full px-2.5 py-1.5 rounded-lg text-left text-xs flex items-center justify-between gap-2 transition cursor-pointer ${
                    isSelected
                      ? 'bg-[var(--app-accent-soft)] text-[var(--app-text-primary)] font-semibold'
                      : 'text-[var(--app-text-secondary)] hover:text-[var(--app-text-primary)] hover:bg-[var(--app-hover)] font-medium'
                  }`}
                >
                  <span className="flex items-center gap-2 min-w-0 flex-1">
                    {opt.icon && <span className="shrink-0 flex items-center">{opt.icon}</span>}
                    <span className="truncate">{opt.label}</span>
                  </span>
                  {isSelected && (
                    <Check size={12} weight="bold" className="shrink-0 text-[var(--app-accent)]" />
                  )}
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

export const HomePage: React.FC<HomePageProps> = ({
  workspaces,
  spaces,
  currentSpaceId,
  currentMember,
  onSelectWorkspace,
  onSelectSpace,
  onQuickCreateNote,
  onOpenSearch,
  onOpenTemplates,
  onOpenAllDocs
}) => {
  // Primary mode switcher: Crear vs Leer
  const [homeMode, setHomeMode] = useState<HomeMode>('create')

  // Create mode state
  const [activeTab, setActiveTab] = useState<HomeTab>('overview')
  const [selectedSpaceFilter, setSelectedSpaceFilter] = useState<string>('all')
  const [timeRange, setTimeRange] = useState<TimeRange>('all')

  // Bottom quick-capture composer state
  const [composerText, setComposerText] = useState('')
  const [targetSpaceId, setTargetSpaceId] = useState<string>(currentSpaceId || DEFAULT_SPACE_ID)
  const [targetFolder, setTargetFolder] = useState<string>('')
  const [targetViewMode, setTargetViewMode] = useState<'doc' | 'canvas'>('doc')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    const el = inputRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, 240)}px`
  }, [composerText, homeMode])

  // Read stats & private reading annotations state
  const [readStatsMap, setReadStatsMap] = useState<Record<string, DocumentReadSummary>>(() =>
    getDocumentReadStatsMap()
  )
  const [privateAnnotations, setPrivateAnnotations] = useState<PrivateAnnotationsMap>(() =>
    loadPrivateAnnotations(currentMember?.id || 'default')
  )

  // Refresh read stats when document reads change
  useEffect(() => {
    const refresh = () => setReadStatsMap(getDocumentReadStatsMap())
    window.addEventListener(DOCUMENT_READS_CHANGED_EVENT, refresh)
    return () => window.removeEventListener(DOCUMENT_READS_CHANGED_EVENT, refresh)
  }, [])

  // Reload private annotations when active member changes
  useEffect(() => {
    setPrivateAnnotations(loadPrivateAnnotations(currentMember?.id || 'default'))
  }, [currentMember?.id])

  const activeWorkspaces = useMemo(
    () => workspaces.filter((w) => !w.isDeleted),
    [workspaces]
  )

  const spaceNameMap = useMemo(() => {
    const map = new Map<string, string>()
    for (const s of spaces) {
      map.set(s.id, s.name)
    }
    return map
  }, [spaces])

  const handleAddAnnotationForDoc = useCallback(
    (docId: string, text: string) => {
      const clean = text.trim()
      if (!clean) return
      const entry: PrivateReadingAnnotation = {
        id: crypto.randomUUID(),
        text: clean,
        createdAt: Date.now()
      }
      setPrivateAnnotations((prev) => {
        const next: PrivateAnnotationsMap = {
          ...prev,
          [docId]: [entry, ...(prev[docId] || [])]
        }
        savePrivateAnnotations(currentMember?.id || 'default', next)
        return next
      })
    },
    [currentMember?.id]
  )

  const handleDeletePrivateAnnotation = useCallback(
    (docId: string, annotationId: string) => {
      setPrivateAnnotations((prev) => {
        const currentList = prev[docId] || []
        const filtered = currentList.filter((a) => a.id !== annotationId)
        const next: PrivateAnnotationsMap = { ...prev }
        if (filtered.length > 0) next[docId] = filtered
        else delete next[docId]
        savePrivateAnnotations(currentMember?.id || 'default', next)
        return next
      })
    },
    [currentMember?.id]
  )

  const handlePromoteAnnotationsForDoc = useCallback(
    async (doc: WorkspaceItem, items: PrivateReadingAnnotation[]) => {
      if (items.length === 0) {
        toast.info('Añade al menos un apunte privado primero.')
        return
      }
      const sourceTitle = doc.title || 'Sin título'
      const listHtml = items
        .slice()
        .reverse()
        .map((item) => `<li><p>${escapeHtml(item.text)}</p></li>`)
        .join('')
      const html = `<h2>Apuntes privados sobre ${escapeHtml(sourceTitle)}</h2><ul>${listHtml}</ul>`

      await onQuickCreateNote({
        title: `Apuntes: ${sourceTitle}`,
        spaceId: doc.spaceId || currentSpaceId || DEFAULT_SPACE_ID,
        folder: normalizeFolderPath(doc.folder) || null,
        viewMode: 'doc',
        isPrivate: true,
        docContent: html
      })
      toast.success('Apuntes guardados como nota privada')
    },
    [onQuickCreateNote, currentSpaceId]
  )

  // Filtered workspaces for the Overview stats card (Create mode)
  const filteredWorkspaces = useMemo(() => {
    const now = Date.now()
    const cutoff =
      timeRange === '7d'
        ? now - 7 * 24 * 60 * 60 * 1000
        : timeRange === '30d'
        ? now - 30 * 24 * 60 * 60 * 1000
        : 0

    return activeWorkspaces.filter((w) => {
      if (selectedSpaceFilter !== 'all') {
        const wsSpace = w.spaceId || DEFAULT_SPACE_ID
        if (wsSpace !== selectedSpaceFilter) return false
      }
      if (cutoff > 0) {
        const ts = Math.max(w.updatedAt || 0, w.createdAt || 0)
        if (ts < cutoff) return false
      }
      return true
    })
  }, [activeWorkspaces, selectedSpaceFilter, timeRange])

  // Core statistics (workspace + personalized user metrics)
  const memberIdentityKeys = useMemo(() => {
    const keys = [
      currentMember?.id,
      currentMember?.name,
      currentMember?.fullName,
      currentMember?.email
    ]
      .map((v) => (v || '').toLowerCase().trim())
      .filter(Boolean)
    return new Set(keys)
  }, [currentMember?.id, currentMember?.name, currentMember?.fullName, currentMember?.email])

  const stats = useMemo(() => {
    const totalNotes = filteredWorkspaces.length
    let docCount = 0
    let canvasCount = 0
    let totalWords = 0
    let favoriteCount = 0
    let readByUser = 0
    let createdByUser = 0
    let privateByUser = 0
    let userWords = 0
    const folderSet = new Set<string>()
    const activeDaySet = new Set<string>()
    const folderCounts = new Map<string, number>()

    for (const w of filteredWorkspaces) {
      if (w.viewMode === 'canvas') canvasCount++
      else docCount++

      if (w.isFavorite) favoriteCount++
      const words = stripHtmlAndCountWords(w.docContent)
      totalWords += words

      const creatorMatches = [w.ownerMember, w.ownerName, w.createdBy, w.userId]
        .map((v) => (v || '').toLowerCase().trim())
        .some((v) => v && memberIdentityKeys.has(v))
      if (creatorMatches) {
        createdByUser++
        userWords += words
      }

      if (w.isPrivate) privateByUser++

      const localReaders = readStatsMap[w.id]?.readerIds || []
      const viewedByList = Array.isArray(w.viewedBy)
        ? w.viewedBy.map((v) => String(v || '').toLowerCase().trim())
        : []
      const hasRead =
        localReaders.some((id) => memberIdentityKeys.has(id)) ||
        viewedByList.some((id) => memberIdentityKeys.has(id))
      if (hasRead) readByUser++

      const folder = normalizeFolderPath(w.folder)
      if (folder) {
        folderSet.add(`${w.spaceId || DEFAULT_SPACE_ID}::${folder}`)
        folderCounts.set(folder, (folderCounts.get(folder) || 0) + 1)
      }

      if (w.createdAt) activeDaySet.add(toDayKey(w.createdAt))
      if (w.updatedAt) activeDaySet.add(toDayKey(w.updatedAt))
    }

    const docPct = totalNotes > 0 ? Math.round((docCount / totalNotes) * 100) : 0
    const canvasPct = totalNotes > 0 ? 100 - docPct : 0
    const favPct = totalNotes > 0 ? ((favoriteCount / totalNotes) * 100).toFixed(1) : '0.0'
    const readPct = totalNotes > 0 ? Math.round((readByUser / totalNotes) * 100) : 0
    const createdPct = totalNotes > 0 ? Math.round((createdByUser / totalNotes) * 100) : 0
    const totalAnnotations = Object.values(privateAnnotations).reduce(
      (sum, list) => sum + (Array.isArray(list) ? list.length : 0),
      0
    )

    let topFolder = 'Raíz'
    let topFolderCount = 0
    for (const [folder, count] of folderCounts.entries()) {
      if (count > topFolderCount) {
        topFolder = folder.split('/').pop() || folder
        topFolderCount = count
      }
    }

    const littlePrinceRatio = totalWords / 16_500

    return {
      totalNotes,
      docPct,
      canvasPct,
      totalWords,
      folderCount: folderSet.size,
      activeDays: activeDaySet.size,
      favoriteCount,
      favPct,
      readByUser,
      readPct,
      createdByUser,
      createdPct,
      privateByUser,
      userWords,
      totalAnnotations,
      topFolder: topFolderCount > 0 ? topFolder : 'Sin carpeta',
      littlePrinceRatio
    }
  }, [filteredWorkspaces, memberIdentityKeys, readStatsMap, privateAnnotations])

  // Space breakdown for the "Espacios" tab
  const spaceSummaries = useMemo(() => {
    return spaces.map((space) => {
      const docs = activeWorkspaces.filter((w) => (w.spaceId || DEFAULT_SPACE_ID) === space.id)
      const words = docs.reduce((acc, w) => acc + stripHtmlAndCountWords(w.docContent), 0)
      const folders = new Set(docs.map((w) => normalizeFolderPath(w.folder)).filter(Boolean)).size
      return {
        space,
        noteCount: docs.length,
        wordCount: words,
        folderCount: folders
      }
    })
  }, [spaces, activeWorkspaces])

  // Recent notes for the "Recientes" tab
  const recentNotes = useMemo(() => {
    return [...activeWorkspaces]
      .sort((a, b) => (b.updatedAt || b.createdAt || 0) - (a.updatedAt || a.createdAt || 0))
      .slice(0, 7)
  }, [activeWorkspaces])

  // Last note the current user was editing (prioritizing lastEditedBy match, fallback to most recently updated)
  const lastEditedNote = useMemo(() => {
    const editedByMe = activeWorkspaces
      .filter((w) => {
        const editor = (w.lastEditedBy || '').toLowerCase().trim()
        return editor && memberIdentityKeys.has(editor)
      })
      .sort((a, b) => (b.updatedAt || b.createdAt || 0) - (a.updatedAt || a.createdAt || 0))
    return editedByMe[0] || recentNotes[0] || null
  }, [activeWorkspaces, memberIdentityKeys, recentNotes])

  // Available folders in the selected composer target space
  const targetSpaceFolders = useMemo(() => {
    const set = new Set<string>()
    for (const w of activeWorkspaces) {
      if ((w.spaceId || DEFAULT_SPACE_ID) === targetSpaceId) {
        const f = normalizeFolderPath(w.folder)
        if (f) set.add(f)
      }
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b))
  }, [activeWorkspaces, targetSpaceId])

  const firstName = useMemo(() => {
    const raw = (currentMember?.name || 'Kevin').trim()
    return raw.split(/\s+/)[0] || 'Kevin'
  }, [currentMember?.name])

  const handleComposerSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault()
    if (isSubmitting) return
    const raw = composerText.trim()
    let title = raw || 'Sin título'
    let docContent: string | undefined

    if (raw && (raw.includes('\n') || raw.length > 90)) {
      const lines = raw.split(/\r?\n/)
      const firstLine = (lines[0] || '').trim()
      title = firstLine
        ? firstLine.length > 72
          ? `${firstLine.slice(0, 72).trim()}…`
          : firstLine
        : 'Sin título'
      docContent = lines
        .map((line) => (line.trim() ? `<p>${escapeHtml(line)}</p>` : '<p></p>'))
        .join('')
    }

    setIsSubmitting(true)
    try {
      await onQuickCreateNote({
        title,
        spaceId: targetSpaceId || currentSpaceId || DEFAULT_SPACE_ID,
        folder: targetFolder || null,
        viewMode: targetViewMode,
        docContent
      })
      setComposerText('')
    } finally {
      setIsSubmitting(false)
    }
  }

  // Saludo según la hora, con variantes aleatorias (se elige una vez por montaje)
  const createGreeting = useMemo(() => {
    const h = new Date().getHours()
    const n = firstName
    const options: string[] = h >= 5 && h < 12
      ? [
          `Buenos días, ${n} ☀️ ¿Qué creamos hoy?`,
          `¡Arriba, ${n}! ¿Por dónde empezamos?`,
          `Café en mano, ${n}: ¿qué sigue hoy?`,
          `Mañana fresca, ideas frescas, ${n} ✨`,
          `¡Buen día, ${n}! ¿Qué toca primero?`,
        ]
      : h >= 12 && h < 19
      ? [
          `Buenas tardes, ${n} 🌤️ ¿Qué sigue?`,
          `¿Cómo va el día, ${n}? ¿Qué armamos?`,
          `Tarde productiva, ${n} 💪 ¿Qué toca?`,
          `Hola, ${n}. ¿Seguimos con lo bueno?`,
          `A medio día y con ganas, ${n}: ¿qué creamos?`,
        ]
      : h >= 19 && h < 24
      ? [
          `Buenas noches, ${n} 🌙 ¿Qué sigue hoy?`,
          `¿Un último apunte, ${n}?`,
          `La noche es joven, ${n} ✨ ¿Qué creamos?`,
          `Cerrando el día con estilo, ${n} 😄`,
          `Hola, ${n}. ¿Qué te falta por anotar hoy?`,
        ]
      : [
          `¿Trasnochando, ${n}? 🦉 Aquí te acompaño`,
          `Madrugada creativa, ${n} 🌌 ¿Qué sigue?`,
          `Las mejores ideas llegan tarde, ${n} 😴✨`,
          `${n}, ¿y el sueño? Bueno, ¿qué anotamos?`,
        ]
    return options[Math.floor(Math.random() * options.length)]
  }, [firstName])

  const literaryComparisonText = useMemo(() => {
    if (stats.totalWords === 0) {
      return 'Empieza a escribir tu primera nota para registrar tu progreso.'
    }
    if (stats.littlePrinceRatio >= 1) {
      return `Has escrito ~${stats.littlePrinceRatio.toFixed(1)}× las palabras de El Principito.`
    }
    const pct = Math.max(1, Math.round(stats.littlePrinceRatio * 100))
    return `Has escrito ~${pct}% de las palabras de El Principito (${stats.totalWords.toLocaleString('es-ES')} palabras).`
  }, [stats.littlePrinceRatio, stats.totalWords])

  return (
    <div className="relative flex-1 flex flex-col h-full w-full overflow-hidden bg-[var(--app-bg-primary)] text-[var(--app-text-primary)] select-none">
      {/* Theme-adaptive Obsidian Prism optical horizon glow (anchored to viewport, never clips on scroll) */}
      <AmbientGlowBackdrop variant="hero" />

      {/* Scrollable Main Content Viewport */}
      <div className="relative z-10 flex-1 w-full overflow-y-auto overflow-x-hidden custom-scrollbar">
        <div
          className={`min-h-full flex flex-col justify-between w-full mx-auto px-4 sm:px-8 pt-7 sm:pt-10 pb-6 sm:pb-10 gap-6 transition-[max-width] duration-300 ${
            homeMode === 'read' ? 'max-w-[1040px]' : 'max-w-[720px]'
          }`}
        >
        {/* Top Section: Greeting + Classic Mode Switcher Pill (Crear | Leer) */}
        <div className="flex flex-col gap-5 flex-1">
          <div className="flex flex-col items-start gap-3">
            {/* Brand Mark + Greeting */}
            <div className="flex items-center gap-3">
              <div className="w-6 h-6 rounded-md flex items-center justify-center shrink-0">
                <img
                  src="/app-logo-light.png"
                  alt=""
                  className="w-5 h-5 object-contain dark:hidden"
                />
                <img
                  src="/app-logo-dark.png"
                  alt=""
                  className="w-5 h-5 object-contain hidden dark:block"
                />
              </div>
              <h1 className="text-lg sm:text-[21px] font-medium tracking-tight text-[var(--app-text-primary)]">
                {homeMode === 'create'
                  ? createGreeting
                  : `Lecturas y apuntes, ${firstName}`}
              </h1>
            </div>

            {/* Classic 2-Mode Segmented Pill (Crear | Leer) */}
            <div
              role="tablist"
              aria-label="Modo de inicio"
              className="inline-flex items-center p-1 rounded-full bg-[var(--app-bg-overlay)]/85 backdrop-blur-md border border-[var(--app-border-strong)]"
              style={{
                boxShadow: 'inset 0 1px 0 var(--prism-specular), 0 6px 20px -8px rgba(0,0,0,0.28)'
              }}
            >
              <button
                type="button"
                role="tab"
                aria-selected={homeMode === 'create'}
                onClick={() => setHomeMode('create')}
                className={`h-7 px-3.5 rounded-full text-xs font-medium inline-flex items-center gap-1.5 transition-all cursor-pointer ${
                  homeMode === 'create'
                    ? 'text-white shadow-sm'
                    : 'text-[var(--app-text-secondary)] hover:text-[var(--app-text-primary)]'
                }`}
                style={
                  homeMode === 'create'
                    ? {
                        background:
                          'linear-gradient(135deg, var(--prism-1) 0%, var(--prism-2) 60%, var(--prism-3) 100%)',
                        boxShadow:
                          '0 0 12px -2px color-mix(in srgb, var(--prism-1) 50%, transparent)'
                      }
                    : undefined
                }
              >
                <PencilSimpleLine size={13} weight={homeMode === 'create' ? 'fill' : 'regular'} />
                <span>Crear</span>
              </button>

              <button
                type="button"
                role="tab"
                aria-selected={homeMode === 'read'}
                onClick={() => setHomeMode('read')}
                className={`h-7 px-3.5 rounded-full text-xs font-medium inline-flex items-center gap-1.5 transition-all cursor-pointer ${
                  homeMode === 'read'
                    ? 'text-white shadow-sm'
                    : 'text-[var(--app-text-secondary)] hover:text-[var(--app-text-primary)]'
                }`}
                style={
                  homeMode === 'read'
                    ? {
                        background:
                          'linear-gradient(135deg, var(--prism-1) 0%, var(--prism-2) 60%, var(--prism-3) 100%)',
                        boxShadow:
                          '0 0 12px -2px color-mix(in srgb, var(--prism-1) 50%, transparent)'
                      }
                    : undefined
                }
              >
                <BookOpen size={13} weight={homeMode === 'read' ? 'fill' : 'regular'} />
                <span>Leer</span>
              </button>
            </div>
          </div>

          {/* ==============================================================
              MODE 1: CREAR (Overview Stats Card + Quick-Capture Composer)
             ============================================================== */}
          {homeMode === 'create' ? (
            <div
              className="relative w-full max-w-[460px] rounded-2xl bg-[var(--app-bg-overlay)]/90 backdrop-blur-xl border border-[var(--app-border-strong)] p-4 sm:p-5 flex flex-col gap-3.5"
              style={{
                backgroundImage: 'var(--prism-sheen)',
                boxShadow:
                  'inset 0 1px 0 var(--prism-specular), 0 14px 40px -10px rgba(0, 0, 0, 0.28)'
              }}
            >
              {/* Top 1px Theme-Adaptive Prism optical caustic rim */}
              <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-x-4 top-0 h-px opacity-80"
                style={{
                  background:
                    'linear-gradient(90deg, transparent, var(--prism-1) 24%, var(--prism-2) 50%, var(--prism-3) 76%, var(--prism-4) 90%, transparent)'
                }}
              />

              {/* Tabs Row */}
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1" role="tablist" aria-label="Secciones de inicio">
                  {(
                    [
                      { id: 'overview', label: 'Resumen' },
                      { id: 'spaces', label: 'Espacios' },
                      { id: 'recent', label: 'Recientes' }
                    ] as const
                  ).map((tab) => {
                    const active = activeTab === tab.id
                    return (
                      <button
                        key={tab.id}
                        type="button"
                        role="tab"
                        aria-selected={active}
                        onClick={() => setActiveTab(tab.id)}
                        className={`px-2.5 py-1 rounded-full text-xs font-medium transition cursor-pointer ${
                          active
                            ? 'bg-black/[0.08] dark:bg-white/[0.11] text-[var(--app-text-primary)]'
                            : 'text-[var(--app-text-muted)] hover:text-[var(--app-text-primary)]'
                        }`}
                      >
                        {tab.label}
                      </button>
                    )
                  })}
                </div>

                <button
                  type="button"
                  onClick={onOpenAllDocs}
                  className="text-[11px] text-[var(--app-text-muted)] hover:text-[var(--app-accent)] transition flex items-center gap-1 cursor-pointer"
                >
                  <span>Ver todo</span>
                  <ArrowRight size={11} />
                </button>
              </div>

              {activeTab === 'overview' && (
                <>
                  {/* Filter Row: Space Dropdown + Time Range Pills */}
                  <div className="flex items-center gap-2 flex-wrap">
                    <PrismSelectMenu
                      ariaLabel="Filtrar por espacio"
                      value={selectedSpaceFilter}
                      onChange={setSelectedSpaceFilter}
                      placement="down"
                      options={[
                        {
                          value: 'all',
                          label: 'Todos los espacios',
                          icon: <SquaresFour size={13} className="text-[var(--prism-1)]" />
                        },
                        ...spaces.map((s) => ({
                          value: s.id,
                          label: s.name,
                          icon: s.icon ? (
                            <AppleEmoji emoji={s.icon} size={13} />
                          ) : (
                            <SquaresFour size={13} className="text-[var(--app-text-muted)]" />
                          )
                        }))
                      ]}
                    />

                    <div className="flex items-center gap-0.5 ml-0.5">
                      {(
                        [
                          { id: 'all', label: 'Todo' },
                          { id: '30d', label: '30d' },
                          { id: '7d', label: '7d' }
                        ] as const
                      ).map((range) => {
                        const active = timeRange === range.id
                        return (
                          <button
                            key={range.id}
                            type="button"
                            onClick={() => setTimeRange(range.id)}
                            className={`px-2 py-0.5 rounded-full text-[11px] font-medium transition cursor-pointer ${
                              active
                                ? 'bg-black/[0.08] dark:bg-white/[0.12] text-[var(--app-text-primary)]'
                                : 'text-[var(--app-text-muted)] hover:text-[var(--app-text-primary)]'
                            }`}
                          >
                            {range.label}
                          </button>
                        )
                      })}
                    </div>
                  </div>

                  {/* 2x3 Metric Cards Grid */}
                  <div className="grid grid-cols-3 gap-2">
                    <div className="rounded-xl bg-[var(--app-bg-secondary)]/80 dark:bg-white/[0.025] border border-[var(--app-border)] px-2.5 py-2 flex flex-col gap-0.5">
                      <span className="text-[10.5px] text-[var(--app-text-muted)]">Notas</span>
                      <span className="text-[15px] font-semibold tabular-nums tracking-tight text-[var(--app-text-primary)]">
                        {formatCompactNumber(stats.totalNotes)}
                      </span>
                      <span className="text-[9.5px] text-[var(--app-text-muted)] truncate">
                        Docs {stats.docPct}% · Canvas {stats.canvasPct}%
                      </span>
                    </div>

                    <div className="rounded-xl bg-[var(--app-bg-secondary)]/80 dark:bg-white/[0.025] border border-[var(--app-border)] px-2.5 py-2 flex flex-col gap-0.5">
                      <span className="text-[10.5px] text-[var(--app-text-muted)]">Palabras</span>
                      <span className="text-[15px] font-semibold tabular-nums tracking-tight text-[var(--app-text-primary)]">
                        {formatCompactNumber(stats.totalWords)}
                      </span>
                      <span className="text-[9.5px] text-[var(--app-text-muted)] truncate">
                        en notas activas
                      </span>
                    </div>

                    <div className="rounded-xl bg-[var(--app-bg-secondary)]/80 dark:bg-white/[0.025] border border-[var(--app-border)] px-2.5 py-2 flex flex-col gap-0.5">
                      <span className="text-[10.5px] text-[var(--app-text-muted)]">Carpetas</span>
                      <span className="text-[15px] font-semibold tabular-nums tracking-tight text-[var(--app-text-primary)]">
                        {stats.folderCount}
                      </span>
                      <span className="text-[9.5px] text-[var(--app-text-muted)] truncate">
                        {spaces.length} {spaces.length === 1 ? 'espacio' : 'espacios'}
                      </span>
                    </div>

                    <div className="rounded-xl bg-[var(--app-bg-secondary)]/80 dark:bg-white/[0.025] border border-[var(--app-border)] px-2.5 py-2 flex flex-col gap-0.5">
                      <span className="text-[10.5px] text-[var(--app-text-muted)]">Días activos</span>
                      <span className="text-[15px] font-semibold tabular-nums tracking-tight text-[var(--app-text-primary)]">
                        {stats.activeDays}
                      </span>
                    </div>

                    <div className="rounded-xl bg-[var(--app-bg-secondary)]/80 dark:bg-white/[0.025] border border-[var(--app-border)] px-2.5 py-2 flex flex-col gap-0.5">
                      <span className="text-[10.5px] text-[var(--app-text-muted)]">Favoritas</span>
                      <span className="text-[15px] font-semibold tabular-nums tracking-tight text-[var(--app-text-primary)]">
                        {stats.favoriteCount}{' '}
                        <span className="text-[10px] font-normal text-[var(--app-text-muted)]">
                          ({stats.favPct}%)
                        </span>
                      </span>
                    </div>

                    <div className="rounded-xl bg-[var(--app-bg-secondary)]/80 dark:bg-white/[0.025] border border-[var(--app-border)] px-2.5 py-2 flex flex-col gap-0.5 min-w-0">
                      <span className="text-[10.5px] text-[var(--app-text-muted)]">Carpeta top</span>
                      <span
                        className="text-[13px] font-semibold tracking-tight text-[var(--app-text-primary)] truncate leading-tight pt-0.5"
                        title={stats.topFolder}
                      >
                        {stats.topFolder}
                      </span>
                    </div>
                  </div>

                  {/* Personalized User Activity Strip (clean editorial 3-column hairline bar) */}
                  <div className="grid grid-cols-3 divide-x divide-[var(--app-border)] rounded-xl bg-[var(--app-bg-secondary)]/55 dark:bg-white/[0.018] border border-[var(--app-border)]">
                    <div className="px-2.5 py-2 flex flex-col gap-1 min-w-0">
                      <div className="flex items-center justify-between gap-1">
                        <span className="text-[10.5px] text-[var(--app-text-muted)]">Leídas</span>
                        <span className="text-[10px] text-[var(--app-text-muted)] tabular-nums">
                          {stats.readPct}%
                        </span>
                      </div>
                      <div className="text-[14px] font-semibold tabular-nums tracking-tight text-[var(--app-text-primary)] leading-none">
                        {stats.readByUser}
                        <span className="text-[11px] font-normal text-[var(--app-text-muted)]">
                          {' '}
                          / {stats.totalNotes}
                        </span>
                      </div>
                      <div className="mt-0.5 h-[2px] w-full rounded-full bg-black/[0.08] dark:bg-white/[0.08] overflow-hidden">
                        <div
                          className="h-full rounded-full bg-[var(--app-text-primary)]/65 transition-all duration-300"
                          style={{ width: `${Math.min(100, stats.readPct)}%` }}
                        />
                      </div>
                    </div>

                    <div className="px-2.5 py-2 flex flex-col gap-0.5 min-w-0">
                      <span className="text-[10.5px] text-[var(--app-text-muted)] truncate">
                        Creadas por ti
                      </span>
                      <span className="text-[14px] font-semibold tabular-nums tracking-tight text-[var(--app-text-primary)] leading-tight">
                        {stats.createdByUser}
                      </span>
                      <span className="text-[9.5px] text-[var(--app-text-muted)] tabular-nums truncate">
                        {stats.createdPct}% del total
                      </span>
                    </div>

                    <div className="px-2.5 py-2 flex flex-col gap-0.5 min-w-0">
                      <span className="text-[10.5px] text-[var(--app-text-muted)] truncate">
                        Privadas
                      </span>
                      <span className="text-[14px] font-semibold tabular-nums tracking-tight text-[var(--app-text-primary)] leading-tight">
                        {stats.privateByUser}
                      </span>
                      <span className="text-[9.5px] text-[var(--app-text-muted)] tabular-nums truncate">
                        {stats.totalAnnotations}{' '}
                        {stats.totalAnnotations === 1 ? 'apunte' : 'apuntes'}
                      </span>
                    </div>
                  </div>

                  {/* Last Edited Note Quick Resume Card */}
                  {lastEditedNote && (() => {
                    const lastSpace =
                      spaceNameMap.get(lastEditedNote.spaceId || DEFAULT_SPACE_ID) || 'Espacio'
                    const lastFolder = normalizeFolderPath(lastEditedNote.folder)
                    return (
                      <button
                        type="button"
                        onClick={() =>
                          onSelectWorkspace(
                            lastEditedNote.id,
                            lastEditedNote.spaceId,
                            lastEditedNote
                          )
                        }
                        className="group relative w-full flex flex-col gap-1.5 px-3 py-2.5 rounded-xl bg-[var(--app-bg-secondary)]/70 dark:bg-white/[0.025] hover:bg-[var(--app-hover)] border border-[var(--app-border)] hover:border-[var(--app-border-strong)] transition-all duration-150 text-left cursor-pointer"
                        style={{ boxShadow: 'inset 0 1px 0 var(--prism-specular)' }}
                      >
                        {/* Top metadata row */}
                        <div className="flex items-center justify-between gap-2">
                          <span className="inline-flex items-center gap-1.5 text-[9.5px] font-medium uppercase tracking-[0.06em] text-[var(--app-text-muted)]">
                            <span className="w-1.5 h-1.5 rounded-full bg-[var(--app-accent)]" />
                            Continuar editando
                          </span>
                          <span className="text-[10px] text-[var(--app-text-muted)] tabular-nums">
                            {formatRelativeTime(lastEditedNote.updatedAt || lastEditedNote.createdAt)}
                          </span>
                        </div>

                        {/* Main note row */}
                        <div className="flex items-center justify-between gap-2.5">
                          <div className="flex items-center gap-2 min-w-0 flex-1">
                            <span className="shrink-0 text-[var(--app-text-secondary)] flex items-center">
                              {lastEditedNote.icon ? (
                                <AppleEmoji emoji={lastEditedNote.icon} size={16} />
                              ) : lastEditedNote.viewMode === 'canvas' ? (
                                <Kanban size={15} weight="duotone" />
                              ) : (
                                <FileText size={15} weight="duotone" />
                              )}
                            </span>
                            <div className="min-w-0 flex-1">
                              <div className="text-[12.5px] font-semibold text-[var(--app-text-primary)] truncate leading-snug">
                                {renderWithAppleEmoji(lastEditedNote.title || 'Sin título')}
                              </div>
                              <div className="text-[10px] text-[var(--app-text-muted)] truncate">
                                {lastSpace}
                                {lastFolder ? ` · ${lastFolder.split('/').pop()}` : ''}
                              </div>
                            </div>
                          </div>

                          <span className="shrink-0 inline-flex items-center gap-1 px-2 py-1 rounded-md bg-black/[0.04] dark:bg-white/[0.05] group-hover:bg-[var(--app-accent-soft)] text-[10.5px] font-medium text-[var(--app-text-secondary)] group-hover:text-[var(--app-accent)] transition-colors">
                            <span>Abrir</span>
                            <ArrowRight
                              size={11}
                              className="group-hover:translate-x-0.5 transition-transform"
                            />
                          </span>
                        </div>
                      </button>
                    )
                  })()}

                  {/* Literary Footer */}
                  <p className="text-[11px] text-[var(--app-text-secondary)] pt-0.5">
                    {literaryComparisonText}
                  </p>
                </>
              )}

              {activeTab === 'spaces' && (
                <div className="flex flex-col gap-1.5 max-h-[260px] overflow-y-auto pr-0.5">
                  {spaceSummaries.map(({ space, noteCount, wordCount, folderCount }) => {
                    const isCurrent = space.id === currentSpaceId
                    return (
                      <button
                        key={space.id}
                        type="button"
                        onClick={() => {
                          onSelectSpace(space.id)
                          setTargetSpaceId(space.id)
                        }}
                        className={`w-full flex items-center justify-between gap-3 px-3 py-2.5 rounded-xl border text-left transition cursor-pointer ${
                          isCurrent
                            ? 'bg-[var(--app-accent-soft)] border-[var(--app-accent)]/40 text-[var(--app-text-primary)]'
                            : 'bg-[var(--app-bg-secondary)]/70 dark:bg-white/[0.025] border-[var(--app-border)] hover:border-[var(--app-accent)]/35'
                        }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <span className="text-[var(--app-accent)] flex items-center justify-center shrink-0">
                            {space.icon ? (
                              <AppleEmoji emoji={space.icon} size={18} />
                            ) : (
                              <SquaresFour size={17} weight="duotone" />
                            )}
                          </span>
                          <div className="min-w-0">
                            <div className="text-xs font-semibold truncate">{space.name}</div>
                            <div className="text-[10.5px] text-[var(--app-text-muted)]">
                              {folderCount} {folderCount === 1 ? 'carpeta' : 'carpetas'} ·{' '}
                              {formatCompactNumber(wordCount)} palabras
                            </div>
                          </div>
                        </div>
                        <span className="text-xs font-semibold tabular-nums text-[var(--app-text-secondary)] shrink-0">
                          {noteCount} {noteCount === 1 ? 'nota' : 'notas'}
                        </span>
                      </button>
                    )
                  })}
                </div>
              )}

              {activeTab === 'recent' && (
                <div className="flex flex-col gap-1 max-h-[260px] overflow-y-auto pr-0.5">
                  {recentNotes.length === 0 ? (
                    <div className="py-8 text-center text-xs text-[var(--app-text-muted)]">
                      Aún no hay notas recientes.
                    </div>
                  ) : (
                    recentNotes.map((doc) => {
                      const folder = normalizeFolderPath(doc.folder)
                      return (
                        <button
                          key={doc.id}
                          type="button"
                          onClick={() => onSelectWorkspace(doc.id, doc.spaceId, doc)}
                          className="w-full flex items-center justify-between gap-2.5 px-2.5 py-2 rounded-xl hover:bg-black/[0.05] dark:hover:bg-white/[0.06] transition text-left cursor-pointer group"
                        >
                          <div className="flex items-center gap-2.5 min-w-0 flex-1">
                            <span className="shrink-0 text-[var(--app-text-secondary)]">
                              {doc.icon ? (
                                <AppleEmoji emoji={doc.icon} size={15} />
                              ) : doc.viewMode === 'canvas' ? (
                                <Kanban size={15} weight="duotone" />
                              ) : (
                                <FileText size={15} weight="duotone" />
                              )}
                            </span>
                            <div className="min-w-0 flex-1">
                              <div className="text-xs font-medium text-[var(--app-text-primary)] truncate">
                                {renderWithAppleEmoji(doc.title || 'Sin título')}
                              </div>
                              <div className="text-[10px] text-[var(--app-text-muted)] truncate flex items-center gap-1.5">
                                <span>{spaceNameMap.get(doc.spaceId || DEFAULT_SPACE_ID) || 'Espacio'}</span>
                                {folder && (
                                  <>
                                    <span>·</span>
                                    <span className="truncate">{folder}</span>
                                  </>
                                )}
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0">
                            {doc.isFavorite && (
                              <Star size={12} weight="fill" className="text-amber-400" />
                            )}
                            <span className="text-[10.5px] text-[var(--app-text-muted)] tabular-nums flex items-center gap-1">
                              <Clock size={11} />
                              {formatRelativeTime(doc.updatedAt || doc.createdAt)}
                            </span>
                          </div>
                        </button>
                      )
                    })
                  )}
                </div>
              )}
            </div>
          ) : (
            /* ==============================================================
               MODE 2: LEER (Large Admin-Curated Folders + Most Read + Private Notes)
               ============================================================== */
            <HomeReadHub
              workspaces={activeWorkspaces}
              spaces={spaces}
              currentSpaceId={currentSpaceId}
              currentMember={currentMember}
              memberIdentityKeys={memberIdentityKeys}
              readStatsMap={readStatsMap}
              privateAnnotations={privateAnnotations}
              onAddAnnotation={handleAddAnnotationForDoc}
              onDeleteAnnotation={handleDeletePrivateAnnotation}
              onPromoteAnnotations={handlePromoteAnnotationsForDoc}
              onSelectWorkspace={onSelectWorkspace}
            />
          )}
        </div>

        {/* Bottom Quick-Capture Composer (shown in Crear mode) */}
        {homeMode === 'create' && (
          <div className="relative w-full shrink-0 mt-auto h-[128px]">
            {/* Docked bottom stack: Context pills + Composer grow upward together over background content */}
            <div className="absolute bottom-0 inset-x-0 z-30 flex flex-col gap-2.5">
              {/* Context Selector Pills */}
              <div className="relative z-10 flex items-center gap-2 flex-wrap px-0.5">
              <PrismSelectMenu
                ariaLabel="Espacio destino"
                value={targetSpaceId}
                onChange={(val) => {
                  setTargetSpaceId(val)
                  setTargetFolder('')
                }}
                placement="up"
                icon={<SquaresFour size={13} className="text-[var(--prism-1)]" />}
                options={spaces.map((s) => ({
                  value: s.id,
                  label: s.name,
                  icon: s.icon ? (
                    <AppleEmoji emoji={s.icon} size={13} />
                  ) : (
                    <SquaresFour size={13} className="text-[var(--prism-1)]" />
                  )
                }))}
              />

              <PrismSelectMenu
                ariaLabel="Carpeta destino"
                value={targetFolder}
                onChange={setTargetFolder}
                placement="up"
                icon={<FolderSimple size={13} className="text-[var(--prism-2)]" />}
                options={[
                  {
                    value: '',
                    label: 'Sin carpeta',
                    icon: <FolderSimple size={13} className="text-[var(--app-text-muted)]" />
                  },
                  ...targetSpaceFolders.map((f) => ({
                    value: f,
                    label: f,
                    icon: <FolderSimple size={13} className="text-[var(--prism-2)]" />
                  }))
                ]}
              />

              <button
                type="button"
                onClick={() => setTargetViewMode((m) => (m === 'doc' ? 'canvas' : 'doc'))}
                className="h-7 px-2.5 rounded-lg bg-[var(--app-bg-overlay)]/88 backdrop-blur-md border border-[var(--app-border-strong)] text-[11.5px] font-medium text-[var(--app-text-primary)] hover:border-[var(--app-accent)]/50 transition inline-flex items-center gap-1.5 cursor-pointer"
                style={{ boxShadow: 'inset 0 1px 0 var(--prism-specular)' }}
                title="Cambiar tipo de nota a crear"
              >
                {targetViewMode === 'canvas' ? (
                  <>
                    <Kanban size={13} className="text-[var(--prism-3)]" />
                    <span>Canvas</span>
                  </>
                ) : (
                  <>
                    <FileText size={13} className="text-[var(--prism-1)]" />
                    <span>Documento</span>
                  </>
                )}
              </button>
            </div>

              {/* Elevated Quick-Capture Box */}
              <form
                onSubmit={handleComposerSubmit}
                className="relative overflow-hidden w-full rounded-2xl bg-[var(--app-bg-overlay)]/96 backdrop-blur-xl border border-[var(--app-border-strong)] focus-within:border-[var(--app-accent)]/60 transition-colors px-4 pt-3.5 pb-2.5 flex flex-col gap-3"
                style={{
                  backgroundImage: 'var(--prism-sheen)',
                  boxShadow:
                    'inset 0 1px 0 var(--prism-specular), 0 18px 48px -8px rgba(0, 0, 0, 0.45)'
                }}
              >
              <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-x-3 bottom-0 h-[1.5px] opacity-85"
                style={{
                  background:
                    'linear-gradient(90deg, transparent, var(--prism-1) 22%, var(--prism-2) 48%, var(--prism-3) 74%, var(--prism-4) 90%, transparent)'
                }}
              />

              <textarea
                ref={inputRef}
                rows={1}
                value={composerText}
                onChange={(e) => setComposerText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault()
                    void handleComposerSubmit()
                  }
                }}
                placeholder="¿Qué quieres anotar hoy?"
                aria-label="Título o contenido de nueva nota rápida"
                style={{ outline: 'none', boxShadow: 'none' }}
                className="w-full bg-transparent border-0 text-sm sm:text-[15px] leading-relaxed text-[var(--app-text-primary)] placeholder:text-[var(--app-text-muted)] outline-none focus:outline-none focus-visible:outline-none focus:ring-0 resize-none overflow-y-auto max-h-[240px] custom-scrollbar caret-[var(--app-accent)]"
              />

              <div className="flex items-center justify-between gap-2 pt-0.5">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="h-7 px-2.5 rounded-full border text-[var(--app-accent)] text-xs font-medium inline-flex items-center gap-1.5 transition cursor-pointer hover:brightness-110 disabled:opacity-50"
                    style={{
                      background:
                        'linear-gradient(90deg, color-mix(in srgb, var(--prism-1) 16%, transparent), color-mix(in srgb, var(--prism-2) 14%, transparent), color-mix(in srgb, var(--prism-3) 14%, transparent))',
                      borderColor: 'color-mix(in srgb, var(--prism-1) 36%, transparent)'
                    }}
                  >
                    <Sparkle size={13} weight="fill" />
                    <span>Crear {targetViewMode === 'canvas' ? 'canvas' : 'nota'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={onOpenTemplates}
                    className="h-7 px-2.5 rounded-full bg-[var(--app-hover)] hover:bg-[var(--app-active)] text-[var(--app-text-secondary)] hover:text-[var(--app-text-primary)] text-xs font-medium inline-flex items-center gap-1.5 transition cursor-pointer"
                  >
                    <Books size={13} />
                    <span>Plantillas</span>
                  </button>

                  <button
                    type="button"
                    onClick={onOpenSearch}
                    className="h-7 px-2.5 rounded-full bg-[var(--app-hover)] hover:bg-[var(--app-active)] text-[var(--app-text-secondary)] hover:text-[var(--app-text-primary)] text-xs font-medium inline-flex items-center gap-1.5 transition cursor-pointer"
                  >
                    <MagnifyingGlass size={13} />
                    <span className="hidden sm:inline">Buscar</span>
                    <kbd className="hidden sm:inline text-[10px] font-mono opacity-70">Ctrl+K</kbd>
                  </button>
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  aria-label="Crear nota"
                  title="Crear nota (Enter)"
                  className="w-7 h-7 rounded-full text-white flex items-center justify-center transition cursor-pointer active:scale-95 disabled:opacity-50 hover:brightness-110"
                  style={{
                    background:
                      'linear-gradient(135deg, var(--prism-1) 0%, var(--prism-2) 52%, var(--prism-3) 100%)',
                    boxShadow: '0 0 14px -2px color-mix(in srgb, var(--prism-1) 55%, transparent)'
                  }}
                >
                  {composerText.trim() ? (
                    <ArrowElbowDownLeft size={14} weight="bold" />
                  ) : (
                    <Plus size={14} weight="bold" />
                  )}
                </button>
              </div>
            </form>
            </div>
          </div>
        )}
        </div>
      </div>
    </div>
  )
}
