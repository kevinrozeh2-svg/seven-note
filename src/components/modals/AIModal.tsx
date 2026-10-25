import { useState } from 'react'
import {
  X,
  Sparkles,
  Send,
  Loader2,
  Copy,
  Check,
  PlusCircle,
  Wand2,
  ListTodo,
  FileText,
  Lightbulb
} from 'lucide-react'

interface AIModalProps {
  isOpen: boolean
  onClose: () => void
  onInsertContent: (content: string) => void
  currentTitle?: string
}

export function AIModal({ isOpen, onClose, onInsertContent, currentTitle }: AIModalProps) {
  const [prompt, setPrompt] = useState('')
  const [loading, setLoading] = useState(false)
  const [response, setResponse] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  if (!isOpen) return null

  const handleGenerate = (customPrompt?: string) => {
    const textToRun = customPrompt || prompt
    if (!textToRun.trim()) return

    setLoading(true)
    setResponse(null)

    setTimeout(() => {
      let generated = ''
      const lower = textToRun.toLowerCase()

      if (lower.includes('resum') || lower.includes('resumen')) {
        generated = `<h3>📋 Resumen Generado por IA</h3>\n<p>El documento <em>${currentTitle || 'actual'}</em> sintetiza los conceptos medulares de la estrategia del proyecto, priorizando la ejecución ágil, la simplicidad de arquitectura y la sincronización confiable sin fricciones.</p>\n<ul>\n<li><strong>Enfoque:</strong> Productividad y diseño limpio</li>\n<li><strong>Prioridad:</strong> Modo offline y enlaces rápidos</li>\n<li><strong>Estado:</strong> Activo y verificado</li>\n</ul>`
      } else if (lower.includes('tarea') || lower.includes('checklist') || lower.includes('todo')) {
        generated = `<h3>✅ Plan de Tareas Clave</h3>\n<ul data-type="taskList">\n<li data-checked="false"><label><input type="checkbox"><span></span></label><div>Diseñar prototipo de alta fidelidad</div></li>\n<li data-checked="false"><label><input type="checkbox"><span></span></label><div>Conectar base de datos local y sincronización</div></li>\n<li data-checked="false"><label><input type="checkbox"><span></span></label><div>Escribir documentación de usuario y guía rápida</div></li>\n<li data-checked="false"><label><input type="checkbox"><span></span></label><div>Revisar retroalimentación con el equipo</div></li>\n</ul>`
      } else if (lower.includes('idea') || lower.includes('brainstorm')) {
        generated = `<h3>💡 Propuestas Creativas</h3>\n<ol>\n<li><strong>Modo Zen sin distracciones:</strong> Ocultar todas las barras laterales con un solo comando para escritura enfocada.</li>\n<li><strong>Etiquetado semántico inteligente:</strong> Sugerir etiquetas automáticas basadas en el contenido de la nota.</li>\n<li><strong>Exportación a diapositivas:</strong> Convertir encabezados en una presentación rápida para reuniones.</li>\n</ol>`
      } else {
        generated = `<h3>✨ Borrador Asistido: ${textToRun}</h3>\n<p>Este apartado profundiza en <strong>${textToRun}</strong>, aportando una visión estructurada para avanzar con claridad:</p>\n<blockquote><em>"La consistencia en la ejecución supera cualquier plan complejo sin acción."</em></blockquote>\n<p>Puntos de acción recomendados:</p>\n<ul>\n<li>Punto 1: Diagnóstico inicial y validación.</li>\n<li>Punto 2: Implementación incremental en bloques modulares.</li>\n<li>Punto 3: Medición de resultados y optimización continua.</li>\n</ul>`
      }

      setResponse(generated)
      setLoading(false)
    }, 800)
  }

  const handleCopy = () => {
    if (!response) return
    const plainText = response.replace(/<[^>]*>/g, '')
    navigator.clipboard.writeText(plainText)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div
        className="bg-[#18181b] border border-[#27272a] rounded-xl max-w-xl w-full shadow-2xl overflow-hidden flex flex-col max-h-[85vh] animate-in fade-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-[#27272a] flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <Sparkles size={18} className="text-cyan-400" />
            <h3 className="text-sm font-semibold text-zinc-100">Iniciar con Inteligencia Artificial</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-md text-zinc-400 hover:text-zinc-100 hover:bg-[#27272a] transition"
          >
            <X size={16} />
          </button>
        </div>

        {/* Quick prompt buttons */}
        <div className="p-4 bg-[#141416] border-b border-[#27272a] shrink-0">
          <span className="text-[11px] font-medium text-zinc-400 block mb-2">
            Selecciona una instrucción rápida:
          </span>
          <div className="flex flex-wrap gap-1.5">
            <button
              onClick={() => {
                setPrompt('Crear lista de tareas y checklist de acción')
                handleGenerate('Crear lista de tareas y checklist de acción')
              }}
              className="px-2.5 py-1 rounded-md bg-[#222226] hover:bg-[#2c2c32] text-zinc-300 text-xs flex items-center gap-1.5 transition"
            >
              <ListTodo size={13} className="text-emerald-400" />
              <span>Crear checklist</span>
            </button>
            <button
              onClick={() => {
                setPrompt('Resumir y sintetizar los puntos clave')
                handleGenerate('Resumir y sintetizar los puntos clave')
              }}
              className="px-2.5 py-1 rounded-md bg-[#222226] hover:bg-[#2c2c32] text-zinc-300 text-xs flex items-center gap-1.5 transition"
            >
              <FileText size={13} className="text-blue-400" />
              <span>Resumir contenido</span>
            </button>
            <button
              onClick={() => {
                setPrompt('Lluvia de ideas innovadoras')
                handleGenerate('Lluvia de ideas innovadoras')
              }}
              className="px-2.5 py-1 rounded-md bg-[#222226] hover:bg-[#2c2c32] text-zinc-300 text-xs flex items-center gap-1.5 transition"
            >
              <Lightbulb size={13} className="text-amber-400" />
              <span>Lluvia de ideas</span>
            </button>
            <button
              onClick={() => {
                setPrompt('Estructurar propuesta de proyecto')
                handleGenerate('Estructurar propuesta de proyecto')
              }}
              className="px-2.5 py-1 rounded-md bg-[#222226] hover:bg-[#2c2c32] text-zinc-300 text-xs flex items-center gap-1.5 transition"
            >
              <Wand2 size={13} className="text-purple-400" />
              <span>Propuesta guiada</span>
            </button>
          </div>
        </div>

        {/* Response / Workspace Area */}
        <div className="p-5 flex-1 overflow-y-auto text-xs text-zinc-300">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-12 gap-3 text-zinc-400">
              <Loader2 size={24} className="animate-spin text-cyan-400" />
              <span>Redactando con Inteligencia Artificial...</span>
            </div>
          ) : response ? (
            <div className="space-y-4">
              <div
                className="prose prose-invert max-w-none p-4 rounded-xl bg-[#141416] border border-[#27272a] text-zinc-200"
                dangerouslySetInnerHTML={{ __html: response }}
              />
              <div className="flex gap-2 justify-end">
                <button
                  onClick={handleCopy}
                  className="px-3 py-1.5 rounded-lg bg-[#222226] hover:bg-[#2a2a30] text-zinc-300 flex items-center gap-1.5 transition font-medium"
                >
                  {copied ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
                  <span>{copied ? 'Copiado' : 'Copiar'}</span>
                </button>
                <button
                  onClick={() => {
                    onInsertContent(response)
                    onClose()
                  }}
                  className="px-4 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white flex items-center gap-1.5 transition font-medium"
                >
                  <PlusCircle size={14} />
                  <span>Insertar en la página</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="text-center py-12 text-zinc-500 space-y-1">
              <p className="text-sm font-medium text-zinc-400">Escribe qué deseas crear</p>
              <p className="text-xs">
                Por ejemplo: "Redacta un plan de acción para el lanzamiento", o selecciona un botón arriba.
              </p>
            </div>
          )}
        </div>

        {/* Input box */}
        <div className="p-4 border-t border-[#27272a] bg-[#141416] flex gap-2 shrink-0">
          <input
            type="text"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleGenerate()}
            placeholder="Pídele a la IA que escriba, resuma, planifique..."
            className="flex-1 bg-[#1a1a1e] border border-[#2d2d34] rounded-lg px-3 py-2 text-xs text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-cyan-500"
          />
          <button
            onClick={() => handleGenerate()}
            disabled={!prompt.trim() || loading}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-lg flex items-center gap-1.5 font-medium transition text-xs"
          >
            <Send size={13} />
            <span>Generar</span>
          </button>
        </div>
      </div>
    </div>
  )
}
