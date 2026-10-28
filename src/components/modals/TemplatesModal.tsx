import { useState } from 'react'
import {
  CloseIcon,
  TemplateIcon,
  AiIcon
} from '@blocksuite/icons/rc'
import { APP_TEMPLATES, type AppTemplate } from '../../lib/templates'

interface TemplatesModalProps {
  isOpen: boolean
  onClose: () => void
  onSelectTemplate: (template: AppTemplate) => void
  defaultCategory?: string
}

export function TemplatesModal({
  isOpen,
  onClose,
  onSelectTemplate,
  defaultCategory = 'Todas'
}: TemplatesModalProps) {
  const [selectedCategory, setSelectedCategory] = useState<string>(defaultCategory)

  if (!isOpen) return null

  const categories = [
    'Todas',
    'Tableros Edgeless',
    'Personal',
    'Trabajo',
    'Proyectos'
  ]

  const filtered =
    selectedCategory === 'Todas'
      ? APP_TEMPLATES
      : APP_TEMPLATES.filter((t) => t.category === selectedCategory)

  return (
    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150">
      <div
        className="rounded-xl max-w-2xl w-full border border-[var(--app-border)] shadow-[var(--app-shadow-modal)] overflow-hidden flex flex-col max-h-[85vh] bg-[var(--app-bg-overlay)] text-[var(--app-text-primary)]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 py-3.5 border-b border-[var(--app-border)] flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-md flex items-center justify-center bg-[var(--app-hover)] text-[var(--app-text-primary)]">
              <TemplateIcon style={{ width: 16, height: 16 }} />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-[var(--app-text-primary)]">
                Galería de Plantillas
              </h3>
              <p className="text-[11px] text-[var(--app-text-secondary)]">
                Comienza rápidamente con estructuras prediseñadas
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-md text-[var(--app-text-secondary)] hover:text-[var(--app-text-primary)] hover:bg-[var(--app-hover)] transition"
          >
            <CloseIcon style={{ width: 16, height: 16 }} />
          </button>
        </div>

        {/* Categories Pills */}
        <div className="px-5 py-2.5 border-b border-[var(--app-border)] flex gap-1.5 overflow-x-auto shrink-0 bg-[var(--app-bg-secondary)]">
          {categories.map((cat) => {
            const active = selectedCategory === cat
            return (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-2.5 py-1 rounded-md text-xs font-medium transition shrink-0 ${
                  active
                    ? 'bg-[var(--app-text-primary)] text-[var(--app-bg-primary)]'
                    : 'text-[var(--app-text-secondary)] hover:text-[var(--app-text-primary)] hover:bg-[var(--app-hover)]'
                }`}
              >
                {cat}
              </button>
            )
          })}
        </div>

        {/* Templates List */}
        <div className="p-5 overflow-y-auto space-y-2.5 flex-1 text-xs">
          {filtered.map((tpl) => (
            <div
              key={tpl.id}
              className="p-3.5 rounded-lg border border-[var(--app-border)] bg-[var(--app-bg-secondary)] hover:bg-[var(--app-hover)] hover:border-[var(--app-border-hover)] transition cursor-pointer flex items-start gap-3.5 group"
              onClick={() => {
                onSelectTemplate(tpl)
                onClose()
              }}
            >
              <span className="text-xl p-2 rounded-md border border-[var(--app-border)] bg-[var(--app-bg-primary)] shrink-0 flex items-center justify-center">
                {tpl.icon}
              </span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <h4 className="font-semibold text-xs text-[var(--app-text-primary)]">
                      {tpl.title}
                    </h4>
                    {tpl.type === 'canvas' && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded border border-[var(--app-border)] font-medium bg-[var(--app-bg-primary)] text-[var(--app-text-secondary)]">
                        Lienzo Milanote
                      </span>
                    )}
                  </div>
                  <span className="text-[10px] px-2 py-0.5 rounded-full font-medium bg-[var(--app-hover)] text-[var(--app-text-secondary)]">
                    {tpl.category}
                  </span>
                </div>
                <p className="mt-1 leading-relaxed text-xs text-[var(--app-text-secondary)]">
                  {tpl.description}
                </p>
                <div className="mt-2.5 flex justify-end">
                  <button className="px-2.5 py-1 rounded-md font-medium text-xs transition flex items-center gap-1.5 border border-[var(--app-border)] bg-[var(--app-bg-primary)] group-hover:border-[var(--app-text-primary)] text-[var(--app-text-primary)]">
                    <AiIcon style={{ width: 12, height: 12 }} />
                    <span>Usar esta plantilla</span>
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
