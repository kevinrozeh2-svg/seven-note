import { useState } from 'react'
import { X, Layers, Sparkles } from 'lucide-react'
import { APP_TEMPLATES, type AppTemplate } from '../../lib/templates'

interface TemplatesModalProps {
  isOpen: boolean
  onClose: () => void
  onSelectTemplate: (template: AppTemplate) => void
}

export function TemplatesModal({ isOpen, onClose, onSelectTemplate }: TemplatesModalProps) {
  const [selectedCategory, setSelectedCategory] = useState<string>('Todas')

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
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div
        className="bg-[#18181b] border border-[#27272a] rounded-2xl max-w-2xl w-full shadow-2xl overflow-hidden flex flex-col max-h-[85vh] animate-in fade-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-[#27272a] flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <Layers size={18} className="text-amber-400" />
            <h3 className="text-sm font-semibold text-zinc-100">Galería de Plantillas AFFiNE</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-md text-zinc-400 hover:text-zinc-100 hover:bg-[#27272a] transition"
          >
            <X size={16} />
          </button>
        </div>

        {/* Categories Pills */}
        <div className="px-5 py-2.5 border-b border-[#27272a] flex gap-1.5 overflow-x-auto shrink-0 bg-[#141416]">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-3 py-1 rounded-lg text-xs font-medium transition shrink-0 ${
                selectedCategory === cat
                  ? 'bg-blue-600 text-white'
                  : 'bg-[#222226] text-zinc-400 hover:text-zinc-200 hover:bg-[#2a2a30]'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Templates List */}
        <div className="p-5 overflow-y-auto space-y-3 flex-1 text-xs">
          {filtered.map((tpl) => (
            <div
              key={tpl.id}
              className="p-4 rounded-xl bg-[#141416] border border-[#27272a] hover:border-[#3f3f46] hover:bg-[#1a1a1e] transition cursor-pointer flex items-start gap-4 group"
              onClick={() => {
                onSelectTemplate(tpl)
                onClose()
              }}
            >
              <span className="text-3xl p-2 rounded-xl bg-[#222226] shrink-0">{tpl.icon}</span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <h4 className="font-semibold text-zinc-100 group-hover:text-blue-400 transition text-sm">
                      {tpl.title}
                    </h4>
                    {tpl.type === 'canvas' && (
                      <span className="text-[10px] px-1.5 py-0.2 rounded bg-indigo-950/80 border border-indigo-800 text-indigo-300 font-medium">
                        Lienzo Edgeless
                      </span>
                    )}
                  </div>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#27272a] text-zinc-400">
                    {tpl.category}
                  </span>
                </div>
                <p className="text-zinc-400 mt-1 leading-relaxed">{tpl.description}</p>
                <div className="mt-3 flex justify-end">
                  <button className="px-3 py-1 bg-blue-600/20 text-blue-400 hover:bg-blue-600 hover:text-white rounded-md font-medium text-xs transition flex items-center gap-1.5">
                    <Sparkles size={12} />
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
