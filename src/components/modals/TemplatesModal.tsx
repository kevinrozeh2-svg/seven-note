import { useState, useEffect, useMemo } from 'react'
import {
  X,
  MagnifyingGlass,
  Star,
  FileText,
  FlowArrow,
  Plus,
  ArrowSquareIn,
  SquaresFour
} from '@phosphor-icons/react'
import { TEMPLATE_CATEGORIES, type AppTemplate } from '../../lib/templates'
import {
  getAllTemplates,
  getFavoriteTemplateIds,
  toggleFavoriteTemplateId,
  recordTemplateUsed,
  TEMPLATES_STORAGE_EVENT
} from '../../lib/customTemplates'
import { TemplateVisualPreview } from '../templates/TemplateVisualPreview'

interface TemplatesModalProps {
  isOpen: boolean
  onClose: () => void
  onSelectTemplate: (template: AppTemplate) => void
  onCreateFromTemplate?: (template: AppTemplate) => void
  defaultCategory?: string
}

export function TemplatesModal(props: TemplatesModalProps) {
  if (!props.isOpen) return null
  return <TemplatesModalInner key={props.defaultCategory || 'Todas'} {...props} />
}

function TemplatesModalInner({
  onClose,
  onSelectTemplate,
  onCreateFromTemplate,
  defaultCategory = 'Todas'
}: TemplatesModalProps) {
  const [selectedCategory, setSelectedCategory] = useState<string>(defaultCategory)
  const [typeFilter, setTypeFilter] = useState<'all' | 'doc' | 'canvas'>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [templates, setTemplates] = useState<AppTemplate[]>(() => getAllTemplates())
  const [favoriteIds, setFavoriteIds] = useState<string[]>(() => getFavoriteTemplateIds())

  useEffect(() => {
    const refresh = () => {
      setTemplates(getAllTemplates())
      setFavoriteIds(getFavoriteTemplateIds())
    }
    window.addEventListener(TEMPLATES_STORAGE_EVENT, refresh)
    return () => window.removeEventListener(TEMPLATES_STORAGE_EVENT, refresh)
  }, [])

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  const favoriteSet = useMemo(() => new Set(favoriteIds), [favoriteIds])

  const categories = ['Todas', 'Favoritas', 'Mis plantillas', ...TEMPLATE_CATEGORIES]

  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    return templates.filter((t) => {
      if (selectedCategory === 'Favoritas' && !favoriteSet.has(t.id)) return false
      if (selectedCategory === 'Mis plantillas' && !t.isCustom) return false
      if (
        selectedCategory !== 'Todas' &&
        selectedCategory !== 'Favoritas' &&
        selectedCategory !== 'Mis plantillas' &&
        t.category !== selectedCategory
      ) {
        return false
      }
      if (typeFilter !== 'all' && t.type !== typeFilter) return false
      if (q) {
        const hay = [t.title, t.description, t.category, ...(t.tags || [])]
          .join(' ')
          .toLowerCase()
        if (!hay.includes(q)) return false
      }
      return true
    })
  }, [templates, selectedCategory, typeFilter, searchQuery, favoriteSet])

  const handleApply = (tpl: AppTemplate) => {
    recordTemplateUsed(tpl.id)
    onSelectTemplate(tpl)
    onClose()
  }

  const handleCreate = (tpl: AppTemplate) => {
    recordTemplateUsed(tpl.id)
    if (onCreateFromTemplate) {
      onCreateFromTemplate(tpl)
    } else {
      onSelectTemplate(tpl)
    }
    onClose()
  }

  return (
    <div
      className="fixed inset-0 z-50 bg-black/45 backdrop-blur-[2px] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="templates-modal-title"
      onClick={onClose}
    >
      <div
        className="rounded-xl max-w-3xl w-full border border-[var(--app-border-strong)] shadow-[var(--app-shadow-popover)] overflow-hidden flex flex-col max-h-[85vh] bg-[var(--app-bg-overlay)] text-[var(--app-text-primary)]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 py-3.5 border-b border-[var(--app-border)] flex items-center justify-between gap-3 shrink-0 bg-[var(--app-bg-secondary)]">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-7 h-7 rounded-md flex items-center justify-center bg-[var(--app-accent-soft)] text-[var(--app-accent)] shrink-0">
              <SquaresFour size={15} weight="duotone" />
            </div>
            <div className="min-w-0">
              <h3
                id="templates-modal-title"
                className="text-sm font-semibold text-[var(--app-text-primary)] truncate"
              >
                Insertar plantilla
              </h3>
              <p className="text-[11px] text-[var(--app-text-secondary)] truncate">
                Aplica una estructura aquí o crea una nota nueva
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {/* Search */}
            <div className="relative w-44 sm:w-56">
              <MagnifyingGlass
                size={13}
                className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--app-text-muted)] pointer-events-none"
              />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Buscar..."
                autoFocus
                aria-label="Buscar plantillas"
                className="w-full h-8 pl-7 pr-6 rounded-md bg-[var(--app-bg-primary)] border border-[var(--app-border-strong)] text-xs text-[var(--app-text-primary)] placeholder:text-[var(--app-text-muted)] focus:outline-none focus:border-[var(--app-accent)] transition"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  aria-label="Limpiar búsqueda"
                  className="absolute right-1.5 top-1/2 -translate-y-1/2 p-0.5 text-[var(--app-text-muted)] hover:text-[var(--app-text-primary)] cursor-pointer"
                >
                  <X size={12} />
                </button>
              )}
            </div>

            <button
              type="button"
              onClick={onClose}
              aria-label="Cerrar galería de plantillas"
              className="p-1.5 rounded-md text-[var(--app-text-secondary)] hover:text-[var(--app-text-primary)] hover:bg-[var(--app-hover)] transition cursor-pointer"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Category Pills + Type Switch */}
        <div className="px-5 py-2 border-b border-[var(--app-border)] flex items-center justify-between gap-3 shrink-0 bg-[var(--app-bg-primary)]">
          <div className="flex items-center gap-1 overflow-x-auto no-scrollbar py-0.5">
            {categories.map((cat) => {
              const active = selectedCategory === cat
              return (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-2.5 py-1 rounded-md text-xs font-medium transition whitespace-nowrap cursor-pointer ${
                    active
                      ? 'bg-[var(--app-active)] text-[var(--app-text-primary)]'
                      : 'text-[var(--app-text-secondary)] hover:text-[var(--app-text-primary)] hover:bg-[var(--app-hover)]'
                  }`}
                >
                  {cat}
                </button>
              )
            })}
          </div>

          <div className="hidden sm:flex items-center p-0.5 rounded-md bg-[var(--app-bg-secondary)] border border-[var(--app-border)] shrink-0">
            {(['all', 'doc', 'canvas'] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTypeFilter(t)}
                className={`px-2 py-0.5 rounded-[5px] text-[11px] font-medium transition cursor-pointer ${
                  typeFilter === t
                    ? 'bg-[var(--app-active)] text-[var(--app-text-primary)]'
                    : 'text-[var(--app-text-secondary)] hover:text-[var(--app-text-primary)]'
                }`}
              >
                {t === 'all' ? 'Todos' : t === 'doc' ? 'Docs' : 'Lienzos'}
              </button>
            ))}
          </div>
        </div>

        {/* Templates List */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-2 flex-1 custom-scrollbar">
          {filtered.length === 0 ? (
            <div className="py-12 text-center space-y-2">
              <p className="text-xs font-medium text-[var(--app-text-primary)]">
                No hay plantillas que coincidan con tu búsqueda
              </p>
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('')
                  setSelectedCategory('Todas')
                  setTypeFilter('all')
                }}
                className="text-xs text-[var(--app-accent)] hover:underline cursor-pointer"
              >
                Mostrar todas las plantillas
              </button>
            </div>
          ) : (
            filtered.map((tpl) => {
              const isFav = favoriteSet.has(tpl.id)
              return (
                <div
                  key={tpl.id}
                  onClick={() => handleApply(tpl)}
                  className="p-3 rounded-[10px] border border-[var(--app-border)] bg-[var(--app-bg-secondary)] hover:bg-[var(--app-hover)] hover:border-[var(--app-border-strong)] transition cursor-pointer flex items-center gap-3.5 group"
                >
                  <TemplateVisualPreview
                    template={tpl}
                    variant="compact"
                    className="shrink-0 border border-[var(--app-border-strong)]"
                  />

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h4 className="font-semibold text-xs text-[var(--app-text-primary)] truncate">
                        {tpl.title}
                      </h4>
                      <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-[var(--app-bg-primary)] border border-[var(--app-border)] text-[var(--app-text-secondary)] shrink-0">
                        {tpl.type === 'canvas' ? (
                          <>
                            <FlowArrow size={10} className="text-[var(--app-accent)]" />
                            <span>Lienzo</span>
                          </>
                        ) : (
                          <>
                            <FileText size={10} className="text-[var(--app-accent)]" />
                            <span>Doc</span>
                          </>
                        )}
                      </span>
                      <span className="hidden sm:inline text-[10px] text-[var(--app-text-muted)] shrink-0">
                        {tpl.category}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-[var(--app-text-secondary)] line-clamp-1">
                      {tpl.description}
                    </p>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        setFavoriteIds(toggleFavoriteTemplateId(tpl.id))
                      }}
                      aria-label={isFav ? 'Quitar de favoritas' : 'Agregar a favoritas'}
                      className={`p-1.5 rounded-md transition cursor-pointer ${
                        isFav
                          ? 'text-amber-500'
                          : 'text-[var(--app-text-muted)] opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 hover:text-[var(--app-text-primary)]'
                      }`}
                    >
                      <Star size={14} weight={isFav ? 'fill' : 'regular'} />
                    </button>

                    {onCreateFromTemplate && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation()
                          handleCreate(tpl)
                        }}
                        title="Crear en una nota nueva"
                        className="h-7 px-2.5 rounded-md text-[11px] font-medium border border-[var(--app-border-strong)] bg-[var(--app-bg-primary)] hover:bg-[var(--app-hover)] text-[var(--app-text-primary)] hidden sm:flex items-center gap-1 transition cursor-pointer"
                      >
                        <Plus size={12} />
                        <span>Nueva</span>
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        handleApply(tpl)
                      }}
                      className="h-7 px-2.5 rounded-md text-[11px] font-semibold bg-[var(--app-accent)] hover:bg-[var(--app-accent-hover)] text-white flex items-center gap-1 transition cursor-pointer"
                    >
                      <ArrowSquareIn size={12} />
                      <span>Aplicar</span>
                    </button>
                  </div>
                </div>
              )
            })
          )}
        </div>
      </div>
    </div>
  )
}
