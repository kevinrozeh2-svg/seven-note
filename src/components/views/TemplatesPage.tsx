import React, { useState } from 'react'
import { LayoutTemplate, Plus } from 'lucide-react'
import { APP_TEMPLATES, type AppTemplate } from '../../lib/templates'

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
      <header className="h-14 px-8 border-b border-neutral-800 flex items-center justify-between shrink-0 bg-[#18181b]">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-indigo-500/10 text-indigo-400 flex items-center justify-center">
            <LayoutTemplate className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-white">Galería de Plantillas</h2>
            <p className="text-[11px] text-neutral-400">
              Inicia proyectos con esquemas visuales y documentos predefinidos
            </p>
          </div>
        </div>

        {/* Categories */}
        <div className="flex items-center gap-1.5">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-3 py-1 rounded-md text-xs font-medium transition ${
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
      <div className="flex-1 overflow-y-auto px-10 py-8 max-w-6xl w-full mx-auto custom-scrollbar">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((tpl) => (
            <div
              key={tpl.id}
              onClick={() => onSelectTemplate(tpl)}
              className="group p-5 rounded-xl bg-neutral-900/50 border border-neutral-800 hover:border-neutral-700 hover:bg-neutral-900/90 transition flex flex-col justify-between cursor-pointer space-y-4"
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-2xl">{tpl.icon || '📄'}</span>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-neutral-800 text-neutral-400 border border-neutral-700 font-medium">
                    {tpl.type === 'canvas' ? 'Lienzo' : 'Documento'}
                  </span>
                </div>
                <div>
                  <h3 className="font-semibold text-sm text-neutral-100 group-hover:text-white transition">
                    {tpl.title}
                  </h3>
                  <p className="text-xs text-neutral-400 mt-1 line-clamp-2 leading-relaxed">
                    {tpl.description}
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
