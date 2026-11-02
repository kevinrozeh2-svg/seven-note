import React, { useState } from 'react'
import { LayoutTemplate, Plus } from 'lucide-react'
import { APP_TEMPLATES, type AppTemplate } from '../../lib/templates'
import { AppleEmoji, renderWithAppleEmoji } from '../ui/AppleEmoji'
import { DocThumbnailPreview } from '../ui/DocThumbnailPreview'

interface TemplatesPageProps {
  onSelectTemplate: (template: AppTemplate) => void
}

export const TemplatesPage: React.FC<TemplatesPageProps> = ({ onSelectTemplate }) => {
  const [selectedCategory, setSelectedCategory] = useState<string>('Todas')

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
    <div className="flex-1 flex flex-col h-full bg-[#18181b] text-neutral-200 select-none overflow-hidden">
      {/* Header */}
      <header className="h-auto min-h-14 py-2 px-4 sm:px-8 border-b border-neutral-800 flex flex-col sm:flex-row sm:items-center justify-between shrink-0 bg-[#18181b] gap-2.5">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-indigo-500/10 text-indigo-400 flex items-center justify-center shrink-0">
            <LayoutTemplate className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-white">Galería de Plantillas</h2>
            <p className="text-[11px] text-neutral-400 hidden sm:block">
              Inicia proyectos con esquemas visuales y documentos predefinidos
            </p>
          </div>
        </div>

        {/* Categories */}
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-3 py-1 rounded-md text-xs font-medium transition whitespace-nowrap cursor-pointer ${
                selectedCategory === cat
                  ? 'bg-neutral-800 text-white border border-neutral-700'
                  : 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800/40'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </header>

      {/* Main Grid */}
      <div className="flex-1 overflow-y-auto px-3 sm:px-6 md:px-10 py-4 sm:py-8 max-w-6xl w-full mx-auto custom-scrollbar">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((tpl) => (
            <div
              key={tpl.id}
              onClick={() => onSelectTemplate(tpl)}
              className="group p-5 rounded-xl bg-neutral-900/50 border border-neutral-800 hover:border-neutral-700 hover:bg-neutral-900/90 transition flex flex-col justify-between cursor-pointer space-y-4"
            >
              <div className="space-y-3">
                <DocThumbnailPreview template={tpl} size="lg" className="w-full h-28 rounded-lg" />
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 min-w-0">
                    {tpl.icon && (
                      <span className="shrink-0 flex items-center">
                        <AppleEmoji emoji={tpl.icon} size={16} />
                      </span>
                    )}
                    <h3 className="font-semibold text-sm text-neutral-100 group-hover:text-white transition truncate">
                      {renderWithAppleEmoji(tpl.title)}
                    </h3>
                  </div>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-neutral-800 text-neutral-400 border border-neutral-700 font-medium shrink-0 ml-2">
                    {tpl.type === 'canvas' ? 'Lienzo' : 'Documento'}
                  </span>
                </div>
                <div>
                  <p className="text-xs text-neutral-400 mt-1 line-clamp-2 leading-relaxed">
                    {renderWithAppleEmoji(tpl.description)}
                  </p>
                </div>
              </div>

              <div className="pt-3 border-t border-neutral-800/60 flex items-center justify-between">
                <span className="text-[11px] text-neutral-500 font-medium">
                  {tpl.category}
                </span>
                <span className="text-xs text-indigo-400 group-hover:translate-x-0.5 transition flex items-center gap-1 font-semibold">
                  <span>Usar</span>
                  <Plus className="w-3.5 h-3.5" />
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
