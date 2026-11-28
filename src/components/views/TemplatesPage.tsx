import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react'
import {
  MagnifyingGlass,
  X,
  Plus,
  Star,
  ClockCounterClockwise,
  Sparkle,
  SquaresFour,
  FileText,
  FlowArrow,
  Briefcase,
  FolderSimple,
  User,
  PaintBrush,
  GraduationCap,
  BookmarkSimple,
  FloppyDisk,
  Eye,
  Trash
} from '@phosphor-icons/react'
import {
  TEMPLATE_CATEGORIES,
  type AppTemplate,
  type TemplateCategory,
  resolveTemplateContent
} from '../../lib/templates'
import {
  getAllTemplates,
  getFavoriteTemplateIds,
  toggleFavoriteTemplateId,
  getRecentTemplateIds,
  recordTemplateUsed,
  deleteCustomTemplate,
  saveCustomTemplate,
  TEMPLATES_STORAGE_EVENT
} from '../../lib/customTemplates'
import { type WorkspaceItem } from '../../db'
import { TemplateVisualPreview } from '../templates/TemplateVisualPreview'
import { TemplatePreviewModal } from '../templates/TemplatePreviewModal'
import { CreateTemplateModal } from '../templates/CreateTemplateModal'
import { toast } from '../../lib/toast'
import { AmbientGlowBackdrop } from '../ui/AmbientGlowBackdrop'

interface TemplatesPageProps {
  onSelectTemplate: (template: AppTemplate) => void
  onCreateFromTemplate?: (template: AppTemplate) => void
  currentWorkspace?: WorkspaceItem
  isCurrentWorkspaceReadOnly?: boolean
}

type CollectionFilter = 'all' | 'featured' | 'favorites' | 'recents' | 'custom' | TemplateCategory
type TypeFilter = 'all' | 'doc' | 'canvas'

const CATEGORY_ICONS: Record<TemplateCategory, React.ReactNode> = {
  'Tableros Edgeless': <FlowArrow size={15} />,
  Proyectos: <FolderSimple size={15} />,
  Trabajo: <Briefcase size={15} />,
  Personal: <User size={15} />,
  Creatividad: <PaintBrush size={15} />,
  Estudio: <GraduationCap size={15} />
}

function getCardMeta(tpl: AppTemplate): string {
  if (tpl.type === 'canvas') {
    const count = tpl.nodes?.length || 0
    return `${count} ${count === 1 ? 'elemento' : 'elementos'}`
  }
  const html = resolveTemplateContent(tpl.docContent)
  const tasks = (html.match(/data-checked=/gi) || []).length
  if (tasks > 0) return `${tasks} ${tasks === 1 ? 'tarea' : 'tareas'}`
  const headings = (html.match(/<h[1-3][^>]*>/gi) || []).length
  return `${Math.max(1, headings)} ${headings === 1 ? 'sección' : 'secciones'}`
}

export const TemplatesPage: React.FC<TemplatesPageProps> = ({
  onSelectTemplate,
  onCreateFromTemplate,
  currentWorkspace,
  isCurrentWorkspaceReadOnly = false
}) => {
  const [templates, setTemplates] = useState<AppTemplate[]>(() => getAllTemplates())
  const [favoriteIds, setFavoriteIds] = useState<string[]>(() => getFavoriteTemplateIds())
  const [recentIds, setRecentIds] = useState<string[]>(() => getRecentTemplateIds())

  const [activeCollection, setActiveCollection] = useState<CollectionFilter>('all')
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [previewTemplate, setPreviewTemplate] = useState<AppTemplate | null>(null)
  const [createModalState, setCreateModalState] = useState<{
    open: boolean
    mode: 'blank' | 'from-current'
  }>({ open: false, mode: 'blank' })

  const searchInputRef = useRef<HTMLInputElement>(null)

  const refreshStorage = useCallback(() => {
    setTemplates(getAllTemplates())
    setFavoriteIds(getFavoriteTemplateIds())
    setRecentIds(getRecentTemplateIds())
  }, [])

  useEffect(() => {
    window.addEventListener(TEMPLATES_STORAGE_EVENT, refreshStorage)
    return () => window.removeEventListener(TEMPLATES_STORAGE_EVENT, refreshStorage)
  }, [refreshStorage])

  // Keyboard shortcut: "/" focuses search
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (
        e.key === '/' &&
        !previewTemplate &&
        !createModalState.open &&
        document.activeElement?.tagName !== 'INPUT' &&
        document.activeElement?.tagName !== 'TEXTAREA' &&
        document.activeElement?.tagName !== 'SELECT'
      ) {
        e.preventDefault()
        searchInputRef.current?.focus()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [previewTemplate, createModalState.open])

  const favoriteSet = useMemo(() => new Set(favoriteIds), [favoriteIds])

  const handleUseNew = useCallback(
    (tpl: AppTemplate) => {
      recordTemplateUsed(tpl.id)
      if (onCreateFromTemplate) {
        onCreateFromTemplate(tpl)
      } else {
        onSelectTemplate(tpl)
      }
    },
    [onCreateFromTemplate, onSelectTemplate]
  )

  const handleApplyCurrent = useCallback(
    (tpl: AppTemplate) => {
      recordTemplateUsed(tpl.id)
      onSelectTemplate(tpl)
    },
    [onSelectTemplate]
  )

  const handleToggleFavorite = useCallback((id: string) => {
    setFavoriteIds(toggleFavoriteTemplateId(id))
  }, [])

  const handleDuplicateAsCustom = useCallback((tpl: AppTemplate) => {
    const copy: AppTemplate = {
      ...tpl,
      id: `custom-${crypto.randomUUID()}`,
      title: `${tpl.title} (Copia)`,
      isCustom: true,
      featured: false,
      createdAt: Date.now()
    }
    saveCustomTemplate(copy)
    toast.success('Copia guardada en Mis plantillas.')
  }, [])

  const handleDeleteCustom = useCallback((id: string) => {
    deleteCustomTemplate(id)
    toast.success('Plantilla eliminada.')
  }, [])

  // Live counts for rail
  const counts = useMemo(() => {
    const map: Record<string, number> = {
      all: templates.length,
      featured: templates.filter((t) => t.featured).length,
      favorites: templates.filter((t) => favoriteSet.has(t.id)).length,
      recents: recentIds.filter((id) => templates.some((t) => t.id === id)).length,
      custom: templates.filter((t) => t.isCustom).length
    }
    for (const cat of TEMPLATE_CATEGORIES) {
      map[cat] = templates.filter((t) => t.category === cat).length
    }
    return map
  }, [templates, favoriteSet, recentIds])

  const filteredTemplates = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    let list = templates

    if (activeCollection === 'featured') {
      list = list.filter((t) => t.featured)
    } else if (activeCollection === 'favorites') {
      list = list.filter((t) => favoriteSet.has(t.id))
    } else if (activeCollection === 'recents') {
      const byId = new Map(list.map((t) => [t.id, t]))
      list = recentIds.map((id) => byId.get(id)).filter(Boolean) as AppTemplate[]
    } else if (activeCollection === 'custom') {
      list = list.filter((t) => t.isCustom)
    } else if (activeCollection !== 'all') {
      list = list.filter((t) => t.category === activeCollection)
    }

    if (typeFilter !== 'all') {
      list = list.filter((t) => t.type === typeFilter)
    }

    if (q) {
      list = list.filter((t) => {
        const hay = [
          t.title,
          t.description,
          t.category,
          ...(t.tags || []),
          t.type === 'canvas' ? 'lienzo tablero canvas' : 'documento nota doc'
        ]
          .join(' ')
          .toLowerCase()
        return hay.includes(q)
      })
    }

    return list
  }, [templates, activeCollection, typeFilter, searchQuery, favoriteSet, recentIds])

  const spotlightTemplates = useMemo(() => {
    const canvasPick = templates.find((t) => t.id === 'milanote-inspiration')
    const docPick = templates.find((t) => t.id === 'product-prd') || templates.find((t) => t.id === 'projects-and-subprojects')
    return [docPick, canvasPick].filter(Boolean) as AppTemplate[]
  }, [templates])

  const showSpotlight =
    activeCollection === 'all' &&
    typeFilter === 'all' &&
    !searchQuery.trim() &&
    spotlightTemplates.length === 2

  const collectionHeading = useMemo(() => {
    switch (activeCollection) {
      case 'all':
        return 'Todas las plantillas'
      case 'featured':
        return 'Destacadas'
      case 'favorites':
        return 'Favoritas'
      case 'recents':
        return 'Usadas recientemente'
      case 'custom':
        return 'Mis plantillas'
      default:
        return activeCollection
    }
  }, [activeCollection])

  const collectionItems: { id: CollectionFilter; label: string; icon: React.ReactNode }[] = [
    { id: 'all', label: 'Todas', icon: <SquaresFour size={15} /> },
    { id: 'featured', label: 'Destacadas', icon: <Sparkle size={15} /> },
    { id: 'favorites', label: 'Favoritas', icon: <Star size={15} /> },
    { id: 'recents', label: 'Recientes', icon: <ClockCounterClockwise size={15} /> },
    { id: 'custom', label: 'Mis plantillas', icon: <BookmarkSimple size={15} /> }
  ]

  return (
    <div className="relative flex-1 flex flex-col h-full bg-[var(--app-bg-primary)] text-[var(--app-text-primary)] select-none overflow-hidden">
      <AmbientGlowBackdrop variant="subtle" />
      {/* Top Bar */}
      <header className="relative z-10 min-h-14 py-2.5 px-4 sm:px-6 border-b border-[var(--app-border)] flex flex-wrap items-center justify-between gap-3 shrink-0 bg-[var(--app-bg-primary)]/85 backdrop-blur-sm">
        <div className="flex items-center gap-2.5 min-w-0">
          <h1 className="text-sm sm:text-[15px] font-semibold text-[var(--app-text-primary)] tracking-tight">
            Plantillas
          </h1>
          <span className="px-1.5 py-0.5 rounded-md text-[11px] font-medium bg-[var(--app-bg-secondary)] border border-[var(--app-border)] text-[var(--app-text-secondary)] tabular-nums">
            {filteredTemplates.length}
          </span>
        </div>

        {/* Search + Type Filter + Actions */}
        <div className="flex items-center gap-2 flex-1 sm:flex-initial justify-end min-w-0">
          {/* Search Input */}
          <div className="relative flex-1 sm:w-64 md:w-72 max-w-xs">
            <MagnifyingGlass
              size={14}
              className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--app-text-muted)] pointer-events-none"
            />
            <input
              ref={searchInputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Escape') {
                  setSearchQuery('')
                  searchInputRef.current?.blur()
                }
              }}
              placeholder="Buscar plantillas o etiquetas..."
              aria-label="Buscar plantillas"
              className="w-full h-8 pl-8 pr-8 rounded-md bg-[var(--app-bg-secondary)] border border-[var(--app-border-strong)] text-xs text-[var(--app-text-primary)] placeholder:text-[var(--app-text-muted)] focus:outline-none focus:border-[var(--app-accent)] transition"
            />
            {searchQuery ? (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                aria-label="Limpiar búsqueda"
                className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 rounded text-[var(--app-text-muted)] hover:text-[var(--app-text-primary)] cursor-pointer"
              >
                <X size={13} />
              </button>
            ) : (
              <kbd className="hidden sm:inline-flex items-center justify-center absolute right-2 top-1/2 -translate-y-1/2 px-1 h-4 rounded text-[10px] font-mono bg-[var(--app-bg-tertiary)] border border-[var(--app-border)] text-[var(--app-text-muted)] pointer-events-none">
                /
              </kbd>
            )}
          </div>

          {/* Segmented Type Filter */}
          <div
            role="group"
            aria-label="Filtrar por tipo"
            className="hidden md:flex items-center p-0.5 rounded-md bg-[var(--app-bg-secondary)] border border-[var(--app-border)]"
          >
            {(
              [
                { id: 'all', label: 'Todos' },
                { id: 'doc', label: 'Documentos' },
                { id: 'canvas', label: 'Lienzos' }
              ] as const
            ).map((opt) => (
              <button
                key={opt.id}
                type="button"
                aria-pressed={typeFilter === opt.id}
                onClick={() => setTypeFilter(opt.id)}
                className={`h-7 px-2.5 rounded-[5px] text-xs font-medium transition cursor-pointer ${
                  typeFilter === opt.id
                    ? 'bg-[var(--app-active)] text-[var(--app-text-primary)]'
                    : 'text-[var(--app-text-secondary)] hover:text-[var(--app-text-primary)]'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          {/* Primary Create Custom Button */}
          <button
            type="button"
            onClick={() => setCreateModalState({ open: true, mode: 'blank' })}
            className="h-8 px-3 rounded-md bg-[var(--app-accent)] hover:bg-[var(--app-accent-hover)] text-white text-xs font-medium flex items-center gap-1.5 transition shrink-0 cursor-pointer"
          >
            <Plus size={14} weight="bold" />
            <span className="hidden sm:inline">Nueva plantilla</span>
          </button>
        </div>
      </header>

      {/* Mobile & Tablet Horizontal Filter Strip */}
      <div className="lg:hidden px-4 py-2 border-b border-[var(--app-border)] bg-[var(--app-bg-secondary)] flex items-center gap-1.5 overflow-x-auto no-scrollbar shrink-0">
        {collectionItems.map((item) => {
          const active = activeCollection === item.id
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setActiveCollection(item.id)}
              className={`px-2.5 py-1 rounded-md text-xs font-medium flex items-center gap-1.5 whitespace-nowrap transition cursor-pointer ${
                active
                  ? 'bg-[var(--app-active)] text-[var(--app-text-primary)]'
                  : 'text-[var(--app-text-secondary)] hover:text-[var(--app-text-primary)] hover:bg-[var(--app-hover)]'
              }`}
            >
              {item.icon}
              <span>{item.label}</span>
            </button>
          )
        })}
        <div className="w-px h-4 bg-[var(--app-border-strong)] mx-1 shrink-0" />
        {TEMPLATE_CATEGORIES.map((cat) => {
          const active = activeCollection === cat
          return (
            <button
              key={cat}
              type="button"
              onClick={() => setActiveCollection(cat)}
              className={`px-2.5 py-1 rounded-md text-xs font-medium flex items-center gap-1.5 whitespace-nowrap transition cursor-pointer ${
                active
                  ? 'bg-[var(--app-active)] text-[var(--app-text-primary)]'
                  : 'text-[var(--app-text-secondary)] hover:text-[var(--app-text-primary)] hover:bg-[var(--app-hover)]'
              }`}
            >
              {CATEGORY_ICONS[cat]}
              <span>{cat}</span>
            </button>
          )
        })}
      </div>

      {/* Body: Left Rail + Main Content */}
      <div className="flex-1 flex min-h-0 overflow-hidden">
        {/* Desktop Left Rail */}
        <aside className="hidden lg:flex w-56 shrink-0 border-r border-[var(--app-border)] bg-[var(--app-bg-secondary)] flex-col justify-between p-3 overflow-y-auto custom-scrollbar">
          <div className="space-y-5">
            {/* Collections */}
            <nav aria-label="Colecciones de plantillas" className="space-y-0.5">
              {collectionItems.map((item) => {
                const active = activeCollection === item.id
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setActiveCollection(item.id)}
                    className={`w-full h-8 px-2.5 rounded-md text-xs font-medium flex items-center justify-between transition cursor-pointer ${
                      active
                        ? 'bg-[var(--app-active)] text-[var(--app-text-primary)]'
                        : 'text-[var(--app-text-secondary)] hover:text-[var(--app-text-primary)] hover:bg-[var(--app-hover)]'
                    }`}
                  >
                    <span className="flex items-center gap-2 min-w-0">
                      <span className={active ? 'text-[var(--app-accent)]' : 'opacity-80'}>
                        {item.icon}
                      </span>
                      <span className="truncate">{item.label}</span>
                    </span>
                    <span className="text-[11px] text-[var(--app-text-muted)] tabular-nums">
                      {counts[item.id] ?? 0}
                    </span>
                  </button>
                )
              })}
            </nav>

            {/* Categories */}
            <div className="space-y-1.5">
              <div className="px-2.5 text-[11px] font-medium text-[var(--app-text-muted)]">
                Categorías
              </div>
              <nav aria-label="Categorías de plantillas" className="space-y-0.5">
                {TEMPLATE_CATEGORIES.map((cat) => {
                  const active = activeCollection === cat
                  return (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => setActiveCollection(cat)}
                      className={`w-full h-8 px-2.5 rounded-md text-xs font-medium flex items-center justify-between transition cursor-pointer ${
                        active
                          ? 'bg-[var(--app-active)] text-[var(--app-text-primary)]'
                          : 'text-[var(--app-text-secondary)] hover:text-[var(--app-text-primary)] hover:bg-[var(--app-hover)]'
                      }`}
                    >
                      <span className="flex items-center gap-2 min-w-0">
                        <span className={active ? 'text-[var(--app-accent)]' : 'opacity-80'}>
                          {CATEGORY_ICONS[cat]}
                        </span>
                        <span className="truncate">{cat}</span>
                      </span>
                      <span className="text-[11px] text-[var(--app-text-muted)] tabular-nums">
                        {counts[cat] ?? 0}
                      </span>
                    </button>
                  )
                })}
              </nav>
            </div>
          </div>

          {/* Save Current Workspace as Template CTA */}
          {currentWorkspace && (
            <div className="pt-3 mt-4 border-t border-[var(--app-border)]">
              <button
                type="button"
                onClick={() => setCreateModalState({ open: true, mode: 'from-current' })}
                className="w-full p-2.5 rounded-lg bg-[var(--app-bg-primary)] hover:bg-[var(--app-hover)] border border-[var(--app-border-strong)] text-left transition cursor-pointer group"
              >
                <div className="flex items-center gap-2 text-xs font-medium text-[var(--app-text-primary)]">
                  <FloppyDisk size={14} className="text-[var(--app-accent)] shrink-0" />
                  <span className="truncate">Guardar nota actual</span>
                </div>
                <p className="mt-1 text-[11px] text-[var(--app-text-muted)] truncate">
                  {currentWorkspace.title || 'Sin título'}
                </p>
              </button>
            </div>
          )}
        </aside>

        {/* Main Gallery Scroll Area */}
        <main className="flex-1 overflow-y-auto px-4 sm:px-8 py-6 custom-scrollbar">
          <div className="max-w-5xl mx-auto space-y-8">
            {/* Spotlight Section (only on default 'all' view with no active search) */}
            {showSpotlight && (
              <section aria-label="Recomendadas para empezar" className="space-y-3">
                <div className="flex items-center justify-between">
                  <h2 className="text-xs font-semibold text-[var(--app-text-secondary)]">
                    Recomendadas para empezar
                  </h2>
                  {currentWorkspace && (
                    <button
                      type="button"
                      onClick={() => setCreateModalState({ open: true, mode: 'from-current' })}
                      className="lg:hidden text-xs font-medium text-[var(--app-accent)] hover:underline flex items-center gap-1 cursor-pointer"
                    >
                      <FloppyDisk size={13} />
                      <span>Guardar nota actual</span>
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                  {spotlightTemplates.map((tpl) => {
                    const isFav = favoriteSet.has(tpl.id)
                    return (
                      <div
                        key={`spotlight-${tpl.id}`}
                        onClick={() => setPreviewTemplate(tpl)}
                        className="group rounded-[10px] bg-[var(--app-bg-secondary)] border border-[var(--app-border)] hover:border-[var(--app-border-strong)] hover:shadow-[var(--app-shadow-card-hover)] transition overflow-hidden flex flex-col sm:flex-row cursor-pointer"
                      >
                        <div className="sm:w-44 shrink-0">
                          <TemplateVisualPreview
                            template={tpl}
                            variant="card"
                            className="h-32 sm:h-full rounded-none sm:border-b-0 sm:border-r border-[var(--app-border)]"
                          />
                        </div>
                        <div className="flex-1 p-4 flex flex-col justify-between gap-3 min-w-0">
                          <div>
                            <div className="flex items-center justify-between gap-2">
                              <span className="inline-flex items-center gap-1 text-[11px] font-medium text-[var(--app-accent)]">
                                {tpl.type === 'canvas' ? (
                                  <FlowArrow size={12} />
                                ) : (
                                  <FileText size={12} />
                                )}
                                <span>{tpl.type === 'canvas' ? 'Lienzo' : 'Documento'}</span>
                              </span>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  handleToggleFavorite(tpl.id)
                                }}
                                aria-label={isFav ? 'Quitar de favoritas' : 'Agregar a favoritas'}
                                className={`p-1 rounded-md transition cursor-pointer ${
                                  isFav
                                    ? 'text-amber-500'
                                    : 'text-[var(--app-text-muted)] opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 hover:text-[var(--app-text-primary)]'
                                }`}
                              >
                                <Star size={14} weight={isFav ? 'fill' : 'regular'} />
                              </button>
                            </div>
                            <h3 className="mt-1 text-sm font-semibold text-[var(--app-text-primary)] truncate">
                              {tpl.title}
                            </h3>
                            <p className="mt-1 text-xs text-[var(--app-text-secondary)] line-clamp-2 leading-relaxed">
                              {tpl.description}
                            </p>
                          </div>

                          <div className="flex items-center justify-between gap-2 pt-2 border-t border-[var(--app-border)]">
                            <span className="text-[11px] text-[var(--app-text-muted)] tabular-nums">
                              {getCardMeta(tpl)}
                            </span>
                            <div className="flex items-center gap-1.5">
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  setPreviewTemplate(tpl)
                                }}
                                className="h-7 px-2 rounded-md text-[11px] font-medium text-[var(--app-text-secondary)] hover:text-[var(--app-text-primary)] hover:bg-[var(--app-hover)] transition cursor-pointer"
                              >
                                Vista previa
                              </button>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  handleUseNew(tpl)
                                }}
                                className="h-7 px-2.5 rounded-md bg-[var(--app-accent)] hover:bg-[var(--app-accent-hover)] text-white text-[11px] font-semibold flex items-center gap-1 transition cursor-pointer"
                              >
                                <Plus size={12} weight="bold" />
                                <span>Usar</span>
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </section>
            )}

            {/* Main Grid Section */}
            <section className="space-y-3.5">
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-xs font-semibold text-[var(--app-text-secondary)]">
                  {searchQuery.trim()
                    ? `Resultados para "${searchQuery.trim()}"`
                    : collectionHeading}
                </h2>

                {/* Mobile Type Filter */}
                <div className="flex md:hidden items-center gap-1">
                  {(['all', 'doc', 'canvas'] as const).map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setTypeFilter(t)}
                      className={`px-2 py-0.5 rounded text-[11px] font-medium cursor-pointer ${
                        typeFilter === t
                          ? 'bg-[var(--app-active)] text-[var(--app-text-primary)]'
                          : 'text-[var(--app-text-muted)]'
                      }`}
                    >
                      {t === 'all' ? 'Todos' : t === 'doc' ? 'Docs' : 'Lienzos'}
                    </button>
                  ))}
                </div>
              </div>

              {filteredTemplates.length === 0 ? (
                <div className="py-16 px-6 rounded-[10px] border border-dashed border-[var(--app-border-strong)] bg-[var(--app-bg-secondary)]/50 text-center flex flex-col items-center justify-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-[var(--app-bg-tertiary)] border border-[var(--app-border)] flex items-center justify-center text-[var(--app-text-muted)]">
                    {activeCollection === 'favorites' ? (
                      <Star size={18} />
                    ) : activeCollection === 'recents' ? (
                      <ClockCounterClockwise size={18} />
                    ) : activeCollection === 'custom' ? (
                      <BookmarkSimple size={18} />
                    ) : (
                      <MagnifyingGlass size={18} />
                    )}
                  </div>
                  <div className="space-y-1 max-w-sm">
                    <h3 className="text-sm font-semibold text-[var(--app-text-primary)]">
                      {activeCollection === 'favorites'
                        ? 'Aún no tienes plantillas favoritas'
                        : activeCollection === 'recents'
                        ? 'Todavía no has usado ninguna plantilla'
                        : activeCollection === 'custom'
                        ? 'Aún no has creado plantillas propias'
                        : 'No encontramos plantillas con esos filtros'}
                    </h3>
                    <p className="text-xs text-[var(--app-text-secondary)]">
                      {activeCollection === 'favorites'
                        ? 'Marca con la estrella las plantillas que más utilizas para acceder a ellas al instante.'
                        : activeCollection === 'recents'
                        ? 'Las plantillas que uses aparecerán aquí automáticamente.'
                        : activeCollection === 'custom'
                        ? 'Guarda tu nota actual o crea una estructura reutilizable desde cero.'
                        : 'Prueba con otro término de búsqueda o limpia los filtros activos.'}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    {activeCollection === 'custom' ? (
                      <>
                        <button
                          type="button"
                          onClick={() => setCreateModalState({ open: true, mode: 'blank' })}
                          className="h-8 px-3 rounded-md bg-[var(--app-accent)] hover:bg-[var(--app-accent-hover)] text-white text-xs font-medium flex items-center gap-1.5 transition cursor-pointer"
                        >
                          <Plus size={14} weight="bold" />
                          <span>Crear plantilla</span>
                        </button>
                        {currentWorkspace && (
                          <button
                            type="button"
                            onClick={() =>
                              setCreateModalState({ open: true, mode: 'from-current' })
                            }
                            className="h-8 px-3 rounded-md bg-[var(--app-bg-primary)] hover:bg-[var(--app-hover)] border border-[var(--app-border-strong)] text-xs font-medium text-[var(--app-text-primary)] transition cursor-pointer"
                          >
                            Guardar nota actual
                          </button>
                        )}
                      </>
                    ) : (
                      <button
                        type="button"
                        onClick={() => {
                          setSearchQuery('')
                          setTypeFilter('all')
                          setActiveCollection('all')
                        }}
                        className="h-8 px-3 rounded-md bg-[var(--app-bg-primary)] hover:bg-[var(--app-hover)] border border-[var(--app-border-strong)] text-xs font-medium text-[var(--app-text-primary)] transition cursor-pointer"
                      >
                        Ver todas las plantillas
                      </button>
                    )}
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                  {filteredTemplates.map((tpl) => {
                    const isFav = favoriteSet.has(tpl.id)
                    return (
                      <article
                        key={tpl.id}
                        onClick={() => setPreviewTemplate(tpl)}
                        className="group rounded-[10px] bg-[var(--app-bg-secondary)] border border-[var(--app-border)] hover:border-[var(--app-border-strong)] hover:shadow-[var(--app-shadow-card-hover)] transition flex flex-col overflow-hidden cursor-pointer"
                      >
                        {/* Visual Thumbnail Header */}
                        <div className="relative">
                          <TemplateVisualPreview template={tpl} variant="card" />

                          {/* Top-left Type & Custom Badges */}
                          <div className="absolute top-2 left-2 flex items-center gap-1">
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-medium bg-[var(--app-bg-overlay)]/92 border border-[var(--app-border-strong)] text-[var(--app-text-primary)] backdrop-blur-xs">
                              {tpl.type === 'canvas' ? (
                                <>
                                  <FlowArrow size={11} className="text-[var(--app-accent)]" />
                                  <span>Lienzo</span>
                                </>
                              ) : (
                                <>
                                  <FileText size={11} className="text-[var(--app-accent)]" />
                                  <span>Doc</span>
                                </>
                              )}
                            </span>
                            {tpl.isCustom && (
                              <span className="px-1.5 py-0.5 rounded-md text-[10px] font-medium bg-[var(--app-accent)] text-white">
                                Propia
                              </span>
                            )}
                          </div>

                          {/* Top-right Favorite & Delete Actions */}
                          <div className="absolute top-2 right-2 flex items-center gap-1">
                            {tpl.isCustom && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  handleDeleteCustom(tpl.id)
                                }}
                                aria-label={`Eliminar ${tpl.title}`}
                                title="Eliminar plantilla"
                                className="p-1.5 rounded-md bg-[var(--app-bg-overlay)]/90 border border-[var(--app-border-strong)] text-[var(--app-text-secondary)] hover:text-rose-500 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition cursor-pointer"
                              >
                                <Trash size={13} />
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation()
                                handleToggleFavorite(tpl.id)
                              }}
                              aria-label={
                                isFav
                                  ? `Quitar ${tpl.title} de favoritas`
                                  : `Agregar ${tpl.title} a favoritas`
                              }
                              title={isFav ? 'Quitar de favoritas' : 'Agregar a favoritas'}
                              className={`p-1.5 rounded-md bg-[var(--app-bg-overlay)]/90 border border-[var(--app-border-strong)] transition cursor-pointer ${
                                isFav
                                  ? 'text-amber-500 opacity-100'
                                  : 'text-[var(--app-text-secondary)] hover:text-[var(--app-text-primary)] opacity-0 group-hover:opacity-100 group-focus-within:opacity-100'
                              }`}
                            >
                              <Star size={13} weight={isFav ? 'fill' : 'regular'} />
                            </button>
                          </div>
                        </div>

                        {/* Card Body */}
                        <div className="p-4 flex-1 flex flex-col justify-between gap-3">
                          <div className="space-y-1.5">
                            <h3 className="text-[13px] font-semibold text-[var(--app-text-primary)] leading-snug line-clamp-1">
                              {tpl.title}
                            </h3>
                            <p className="text-xs text-[var(--app-text-secondary)] line-clamp-2 leading-relaxed">
                              {tpl.description}
                            </p>
                          </div>

                          {/* Card Footer */}
                          <div className="pt-2.5 border-t border-[var(--app-border)] flex items-center justify-between gap-2">
                            <div className="flex items-center gap-1.5 text-[11px] text-[var(--app-text-muted)] min-w-0">
                              <span className="truncate">{tpl.category}</span>
                              <span aria-hidden="true">·</span>
                              <span className="shrink-0 tabular-nums">{getCardMeta(tpl)}</span>
                            </div>

                            <div className="flex items-center gap-1 shrink-0">
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  setPreviewTemplate(tpl)
                                }}
                                aria-label={`Vista previa de ${tpl.title}`}
                                title="Vista previa"
                                className="p-1.5 rounded-md text-[var(--app-text-secondary)] hover:text-[var(--app-text-primary)] hover:bg-[var(--app-hover)] opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition cursor-pointer"
                              >
                                <Eye size={14} />
                              </button>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  handleUseNew(tpl)
                                }}
                                className="h-7 px-2.5 rounded-md text-xs font-medium bg-[var(--app-bg-primary)] group-hover:bg-[var(--app-accent)] text-[var(--app-text-primary)] group-hover:text-white border border-[var(--app-border-strong)] group-hover:border-transparent flex items-center gap-1 transition cursor-pointer"
                              >
                                <span>Usar</span>
                                <Plus size={12} weight="bold" />
                              </button>
                            </div>
                          </div>
                        </div>
                      </article>
                    )
                  })}
                </div>
              )}
            </section>
          </div>
        </main>
      </div>

      {/* Rich Preview Inspector Modal */}
      <TemplatePreviewModal
        template={previewTemplate}
        isFavorite={previewTemplate ? favoriteSet.has(previewTemplate.id) : false}
        canApplyToCurrent={Boolean(currentWorkspace) && !isCurrentWorkspaceReadOnly}
        currentWorkspaceTitle={currentWorkspace?.title}
        onClose={() => setPreviewTemplate(null)}
        onCreateNew={handleUseNew}
        onApplyToCurrent={handleApplyCurrent}
        onToggleFavorite={handleToggleFavorite}
        onDuplicateAsCustom={handleDuplicateAsCustom}
        onDeleteCustom={handleDeleteCustom}
      />

      {/* Create / Save Custom Template Modal */}
      <CreateTemplateModal
        isOpen={createModalState.open}
        mode={createModalState.mode}
        currentWorkspace={currentWorkspace}
        onClose={() => setCreateModalState((s) => ({ ...s, open: false }))}
        onCreated={() => {
          refreshStorage()
          setActiveCollection('custom')
        }}
      />
    </div>
  )
}
