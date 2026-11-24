import React, { useEffect, useMemo } from 'react'
import DOMPurify from 'dompurify'
import {
  X,
  Star,
  Plus,
  ArrowSquareIn,
  Copy,
  Trash,
  FileText,
  FlowArrow,
  CheckSquare,
  ListBullets,
  Tag,
  Sparkle
} from '@phosphor-icons/react'
import { type AppTemplate, resolveTemplateContent } from '../../lib/templates'
import { TemplateVisualPreview } from './TemplateVisualPreview'

interface TemplatePreviewModalProps {
  template: AppTemplate | null
  isFavorite: boolean
  canApplyToCurrent?: boolean
  currentWorkspaceTitle?: string
  onClose: () => void
  onCreateNew: (template: AppTemplate) => void
  onApplyToCurrent?: (template: AppTemplate) => void
  onToggleFavorite: (id: string) => void
  onDuplicateAsCustom?: (template: AppTemplate) => void
  onDeleteCustom?: (id: string) => void
}

function getTemplateStats(template: AppTemplate) {
  if (template.type === 'canvas') {
    const nodes = template.nodes || []
    const edges = template.edges || []
    const frames = nodes.filter((n) => n.type === 'frame').length
    const notes = nodes.filter((n) => n.type === 'note').length
    const todos = nodes.filter((n) => n.type === 'todo').length
    const shapes = nodes.filter((n) => n.type === 'shape').length
    const images = nodes.filter((n) => n.type === 'image').length
    const breakdown: string[] = []
    if (frames > 0) breakdown.push(`${frames} ${frames === 1 ? 'marco' : 'marcos'}`)
    if (notes > 0) breakdown.push(`${notes} ${notes === 1 ? 'nota' : 'notas'}`)
    if (shapes > 0) breakdown.push(`${shapes} ${shapes === 1 ? 'forma' : 'formas'}`)
    if (todos > 0) breakdown.push(`${todos} ${todos === 1 ? 'lista' : 'listas'}`)
    if (images > 0) breakdown.push(`${images} ${images === 1 ? 'imagen' : 'imágenes'}`)
    return {
      primary: `${nodes.length} elementos`,
      secondary: edges.length > 0 ? `${edges.length} conexiones` : 'Lienzo libre',
      breakdown
    }
  }

  const html = resolveTemplateContent(template.docContent)
  const headings = (html.match(/<h[1-3][^>]*>/gi) || []).length
  const tasks = (html.match(/data-checked=/gi) || []).length
  const plainText = html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()
  const words = plainText ? plainText.split(' ').length : 0
  return {
    primary: `${headings} ${headings === 1 ? 'sección' : 'secciones'}`,
    secondary: tasks > 0 ? `${tasks} tareas interactivas` : `${words} palabras base`,
    breakdown: [] as string[]
  }
}

export const TemplatePreviewModal: React.FC<TemplatePreviewModalProps> = ({
  template,
  isFavorite,
  canApplyToCurrent = false,
  currentWorkspaceTitle,
  onClose,
  onCreateNew,
  onApplyToCurrent,
  onToggleFavorite,
  onDuplicateAsCustom,
  onDeleteCustom
}) => {
  useEffect(() => {
    if (!template) return
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [template, onClose])

  const sanitizedHtml = useMemo(() => {
    if (!template || template.type !== 'doc') return ''
    return DOMPurify.sanitize(resolveTemplateContent(template.docContent), {
      USE_PROFILES: { html: true }
    })
  }, [template])

  const stats = useMemo(() => (template ? getTemplateStats(template) : null), [template])

  if (!template || !stats) return null

  const isBannerDark =
    template.coverColor === '#18181b' || template.coverBannerStyle === 'minimal-dark'

  return (
    <div
      className="fixed inset-0 z-50 bg-black/50 backdrop-blur-[2px] flex items-center justify-center p-3 sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="template-preview-title"
      onClick={onClose}
    >
      <div
        className="w-full max-w-4xl max-h-[88vh] rounded-xl bg-[var(--app-bg-overlay)] border border-[var(--app-border-strong)] shadow-[var(--app-shadow-popover)] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Bar */}
        <div className="px-5 py-3.5 border-b border-[var(--app-border)] flex items-center justify-between gap-3 shrink-0 bg-[var(--app-bg-secondary)]">
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[11px] font-medium bg-[var(--app-bg-primary)] border border-[var(--app-border)] text-[var(--app-text-secondary)] shrink-0">
              {template.type === 'canvas' ? (
                <>
                  <FlowArrow size={13} className="text-[var(--app-accent)]" />
                  <span>Lienzo</span>
                </>
              ) : (
                <>
                  <FileText size={13} className="text-[var(--app-accent)]" />
                  <span>Documento</span>
                </>
              )}
            </span>
            <span className="text-xs text-[var(--app-text-muted)] truncate">
              {template.category}
            </span>
            {template.isCustom && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium bg-[var(--app-accent-soft)] text-[var(--app-accent)] shrink-0">
                <Sparkle size={11} weight="fill" />
                <span>Propia</span>
              </span>
            )}
          </div>

          <div className="flex items-center gap-1 shrink-0">
            <button
              type="button"
              onClick={() => onToggleFavorite(template.id)}
              aria-label={isFavorite ? 'Quitar de favoritas' : 'Agregar a favoritas'}
              title={isFavorite ? 'Quitar de favoritas' : 'Agregar a favoritas'}
              className={`p-1.5 rounded-md transition cursor-pointer ${
                isFavorite
                  ? 'text-amber-500 bg-amber-500/10'
                  : 'text-[var(--app-text-secondary)] hover:text-[var(--app-text-primary)] hover:bg-[var(--app-hover)]'
              }`}
            >
              <Star size={16} weight={isFavorite ? 'fill' : 'regular'} />
            </button>

            {onDuplicateAsCustom && !template.isCustom && (
              <button
                type="button"
                onClick={() => onDuplicateAsCustom(template)}
                aria-label="Guardar copia en Mis plantillas"
                title="Guardar copia en Mis plantillas"
                className="p-1.5 rounded-md text-[var(--app-text-secondary)] hover:text-[var(--app-text-primary)] hover:bg-[var(--app-hover)] transition cursor-pointer"
              >
                <Copy size={16} />
              </button>
            )}

            {template.isCustom && onDeleteCustom && (
              <button
                type="button"
                onClick={() => {
                  onDeleteCustom(template.id)
                  onClose()
                }}
                aria-label="Eliminar plantilla personalizada"
                title="Eliminar plantilla personalizada"
                className="p-1.5 rounded-md text-[var(--app-text-secondary)] hover:text-rose-500 hover:bg-rose-500/10 transition cursor-pointer"
              >
                <Trash size={16} />
              </button>
            )}

            <button
              type="button"
              onClick={onClose}
              aria-label="Cerrar vista previa"
              className="p-1.5 rounded-md text-[var(--app-text-secondary)] hover:text-[var(--app-text-primary)] hover:bg-[var(--app-hover)] transition cursor-pointer ml-1"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Body: Split Preview + Details */}
        <div className="flex-1 overflow-y-auto grid grid-cols-1 lg:grid-cols-12 min-h-0 custom-scrollbar">
          {/* Left: High-Fidelity Preview Surface */}
          <div className="lg:col-span-7 p-5 sm:p-6 bg-[var(--app-bg-tertiary)] border-b lg:border-b-0 lg:border-r border-[var(--app-border)] flex flex-col">
            {template.type === 'canvas' ? (
              <div className="space-y-4 my-auto">
                <TemplateVisualPreview
                  template={template}
                  variant="inspector"
                  className="border border-[var(--app-border-strong)] shadow-[var(--app-shadow-card)]"
                />
                {stats.breakdown.length > 0 && (
                  <div className="flex flex-wrap items-center gap-1.5">
                    {stats.breakdown.map((item) => (
                      <span
                        key={item}
                        className="px-2 py-0.5 rounded-md text-[11px] font-medium bg-[var(--app-bg-primary)] border border-[var(--app-border)] text-[var(--app-text-secondary)]"
                      >
                        {item}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div className="rounded-[10px] bg-[var(--app-bg-primary)] border border-[var(--app-border-strong)] shadow-[var(--app-shadow-card)] overflow-hidden flex-1 flex flex-col">
                {template.hasCover && template.coverType === 'bannerText' && (
                  <div
                    className="px-6 py-7 flex flex-col items-center justify-center border-b border-[var(--app-border)]"
                    style={{
                      backgroundColor: template.coverColor || '#ffffff',
                      color: isBannerDark ? '#f4f4f5' : '#18181b'
                    }}
                  >
                    <span className="font-serif italic tracking-[0.2em] text-base uppercase font-light text-center">
                      {template.coverBannerTitle}
                    </span>
                    {template.coverBannerSubtitle && (
                      <span className="font-serif italic tracking-[0.2em] text-sm uppercase font-light text-center opacity-80 mt-0.5">
                        {template.coverBannerSubtitle}
                      </span>
                    )}
                  </div>
                )}
                <div
                  className="p-5 sm:p-6 text-xs sm:text-[13px] leading-relaxed text-[var(--app-text-primary)] space-y-2.5 [&_h1]:text-base [&_h1]:font-semibold [&_h1]:mb-2 [&_h2]:text-sm [&_h2]:font-semibold [&_h2]:mt-4 [&_h2]:mb-1.5 [&_h3]:text-[13px] [&_h3]:font-semibold [&_h3]:mt-3.5 [&_h3]:mb-1 [&_p]:text-[var(--app-text-secondary)] [&_ul]:space-y-1 [&_ul]:pl-4 [&_ul]:list-disc [&_ul[data-type='taskList']]:list-none [&_ul[data-type='taskList']]:pl-0 [&_li]:text-[var(--app-text-secondary)] [&_li[data-checked]]:flex [&_li[data-checked]]:items-start [&_li[data-checked]]:gap-2 [&_input[type='checkbox']]:mt-0.5 [&_input[type='checkbox']]:accent-[var(--app-accent)] [&_input[type='checkbox']]:pointer-events-none [&_blockquote]:border-l [&_blockquote]:border-[var(--app-accent)] [&_blockquote]:pl-3 [&_blockquote]:py-0.5 [&_blockquote]:text-[var(--app-text-secondary)]"
                  dangerouslySetInnerHTML={{ __html: sanitizedHtml }}
                />
              </div>
            )}
          </div>

          {/* Right: Metadata & Actions */}
          <div className="lg:col-span-5 p-5 sm:p-6 flex flex-col justify-between gap-6 bg-[var(--app-bg-overlay)]">
            <div className="space-y-5">
              <div>
                <h2
                  id="template-preview-title"
                  className="text-lg font-semibold text-[var(--app-text-primary)] tracking-tight leading-snug"
                >
                  {template.title}
                </h2>
                <p className="mt-2 text-xs sm:text-[13px] text-[var(--app-text-secondary)] leading-relaxed">
                  {template.description}
                </p>
              </div>

              {/* Structure summary */}
              <div className="grid grid-cols-2 gap-2.5">
                <div className="p-3 rounded-lg bg-[var(--app-bg-secondary)] border border-[var(--app-border)]">
                  <div className="flex items-center gap-1.5 text-[11px] text-[var(--app-text-muted)]">
                    <ListBullets size={13} />
                    <span>Estructura</span>
                  </div>
                  <div className="mt-1 text-xs font-semibold text-[var(--app-text-primary)] tabular-nums">
                    {stats.primary}
                  </div>
                </div>
                <div className="p-3 rounded-lg bg-[var(--app-bg-secondary)] border border-[var(--app-border)]">
                  <div className="flex items-center gap-1.5 text-[11px] text-[var(--app-text-muted)]">
                    <CheckSquare size={13} />
                    <span>Detalle</span>
                  </div>
                  <div className="mt-1 text-xs font-semibold text-[var(--app-text-primary)] tabular-nums">
                    {stats.secondary}
                  </div>
                </div>
              </div>

              {/* Tags */}
              {template.tags && template.tags.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center gap-1.5 text-[11px] font-medium text-[var(--app-text-muted)]">
                    <Tag size={12} />
                    <span>Etiquetas</span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {template.tags.map((tag) => (
                      <span
                        key={tag}
                        className="px-2 py-0.5 rounded-md text-[11px] bg-[var(--app-bg-secondary)] border border-[var(--app-border)] text-[var(--app-text-secondary)]"
                      >
                        #{tag}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Action Buttons */}
            <div className="space-y-2.5 pt-4 border-t border-[var(--app-border)]">
              <button
                type="button"
                onClick={() => {
                  onCreateNew(template)
                  onClose()
                }}
                className="w-full h-9 px-4 rounded-md bg-[var(--app-accent)] hover:bg-[var(--app-accent-hover)] text-white text-xs font-semibold flex items-center justify-center gap-2 transition cursor-pointer"
              >
                <Plus size={15} weight="bold" />
                <span>
                  {template.type === 'canvas' ? 'Crear nuevo lienzo' : 'Crear nueva nota'}
                </span>
              </button>

              {canApplyToCurrent && onApplyToCurrent && (
                <button
                  type="button"
                  onClick={() => {
                    onApplyToCurrent(template)
                    onClose()
                  }}
                  className="w-full h-9 px-4 rounded-md bg-[var(--app-bg-secondary)] hover:bg-[var(--app-hover)] text-[var(--app-text-primary)] border border-[var(--app-border-strong)] text-xs font-medium flex items-center justify-center gap-2 transition cursor-pointer"
                >
                  <ArrowSquareIn size={15} />
                  <span className="truncate">
                    Aplicar en &ldquo;{currentWorkspaceTitle || 'nota actual'}&rdquo;
                  </span>
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
