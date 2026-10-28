import { useState } from 'react'
import {
  CloseIcon,
  AiIcon,
  AiOutlineIcon,
  AiThinkingIcon,
  ArrowRightSmallIcon,
  CopyIcon,
  DoneIcon,
  PlusIcon,
  CheckBoxCheckSolidIcon,
  PageIcon
} from '@blocksuite/icons/rc'

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
    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150">
      <div
        className="rounded-xl max-w-xl w-full border border-[var(--app-border)] shadow-[var(--app-shadow-modal)] overflow-hidden flex flex-col max-h-[85vh] bg-[var(--app-bg-overlay)] text-[var(--app-text-primary)]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 py-3.5 border-b border-[var(--app-border)] flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-md flex items-center justify-center bg-[var(--app-hover)] text-[var(--app-text-primary)]">
              <AiIcon style={{ width: 16, height: 16 }} />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-[var(--app-text-primary)]">
                Seven AI Asistente
              </h3>
              <p className="text-[11px] text-[var(--app-text-secondary)]">
                Genera, resume y transforma contenidos con inteligencia artificial
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

        {/* Quick prompt buttons */}
        <div className="p-3.5 border-b border-[var(--app-border)] shrink-0 bg-[var(--app-bg-secondary)]">
          <span className="text-[11px] font-medium block mb-2 text-[var(--app-text-secondary)]">
            Selecciona una instrucción rápida:
          </span>
          <div className="flex flex-wrap gap-1.5">
            <button
              onClick={() => {
                setPrompt('Crear lista de tareas y checklist de acción')
                handleGenerate('Crear lista de tareas y checklist de acción')
              }}
              className="px-2.5 py-1 rounded-md border border-[var(--app-border)] bg-[var(--app-bg-primary)] hover:bg-[var(--app-hover)] text-xs text-[var(--app-text-primary)] flex items-center gap-1.5 transition"
            >
              <CheckBoxCheckSolidIcon style={{ width: 13, height: 13, color: '#10b981' }} />
              <span>Crear checklist</span>
            </button>
            <button
              onClick={() => {
                setPrompt('Resumir y sintetizar los puntos clave')
                handleGenerate('Resumir y sintetizar los puntos clave')
              }}
              className="px-2.5 py-1 rounded-md border border-[var(--app-border)] bg-[var(--app-bg-primary)] hover:bg-[var(--app-hover)] text-xs text-[var(--app-text-primary)] flex items-center gap-1.5 transition"
            >
              <PageIcon style={{ width: 13, height: 13, color: 'var(--app-accent)' }} />
              <span>Resumir contenido</span>
            </button>
            <button
              onClick={() => {
                setPrompt('Lluvia de ideas innovadoras')
                handleGenerate('Lluvia de ideas innovadoras')
              }}
              className="px-2.5 py-1 rounded-md border border-[var(--app-border)] bg-[var(--app-bg-primary)] hover:bg-[var(--app-hover)] text-xs text-[var(--app-text-primary)] flex items-center gap-1.5 transition"
            >
              <AiIcon style={{ width: 13, height: 13, color: '#f59e0b' }} />
              <span>Lluvia de ideas</span>
            </button>
            <button
              onClick={() => {
                setPrompt('Estructurar propuesta de proyecto')
                handleGenerate('Estructurar propuesta de proyecto')
              }}
              className="px-2.5 py-1 rounded-md border border-[var(--app-border)] bg-[var(--app-bg-primary)] hover:bg-[var(--app-hover)] text-xs text-[var(--app-text-primary)] flex items-center gap-1.5 transition"
            >
              <AiOutlineIcon style={{ width: 13, height: 13, color: '#8b5cf6' }} />
              <span>Propuesta guiada</span>
            </button>
          </div>
        </div>

        {/* Response / Workspace Area */}
        <div className="p-5 flex-1 overflow-y-auto text-xs">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-12 gap-3 text-[var(--app-text-secondary)]">
              <AiThinkingIcon
                style={{
                  width: 26,
                  height: 26,
                  color: 'var(--app-accent)',
                  animation: 'spin 2s linear infinite'
                }}
              />
              <span className="font-medium">Redactando con Seven AI...</span>
            </div>
          ) : response ? (
            <div className="space-y-4">
              <div
                className="prose max-w-none p-4 rounded-lg border border-[var(--app-border)] bg-[var(--app-bg-secondary)] text-[var(--app-text-primary)] leading-relaxed"
                dangerouslySetInnerHTML={{ __html: response }}
              />
              <div className="flex gap-2 justify-end">
                <button
                  onClick={handleCopy}
                  className="px-3 py-1.5 rounded-md border border-[var(--app-border)] bg-[var(--app-bg-primary)] hover:bg-[var(--app-hover)] text-[var(--app-text-primary)] flex items-center gap-1.5 transition font-medium"
                >
                  {copied ? (
                    <DoneIcon style={{ width: 14, height: 14, color: '#10b981' }} />
                  ) : (
                    <CopyIcon style={{ width: 14, height: 14 }} />
                  )}
                  <span>{copied ? '¡Copiado!' : 'Copiar'}</span>
                </button>
                <button
                  onClick={() => {
                    onInsertContent(response)
                    onClose()
                  }}
                  className="px-3.5 py-1.5 rounded-md text-[var(--app-bg-primary)] bg-[var(--app-text-primary)] flex items-center gap-1.5 transition font-medium hover:opacity-90 shadow-xs"
                >
                  <PlusIcon style={{ width: 14, height: 14 }} />
                  <span>Insertar en la página</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="text-center py-12 space-y-1.5 text-[var(--app-text-secondary)]">
              <div className="w-10 h-10 rounded-full mx-auto flex items-center justify-center mb-2 bg-[var(--app-hover)] text-[var(--app-text-primary)]">
                <AiIcon style={{ width: 20, height: 20 }} />
              </div>
              <p className="text-sm font-semibold text-[var(--app-text-primary)]">
                Escribe qué deseas crear
              </p>
              <p className="text-xs max-w-sm mx-auto">
                Por ejemplo: "Redacta un plan de acción para el lanzamiento", o selecciona una de las opciones rápidas arriba.
              </p>
            </div>
          )}
        </div>

        {/* Input box */}
        <div className="p-3.5 border-t border-[var(--app-border)] flex gap-2 shrink-0 bg-[var(--app-bg-secondary)]">
          <input
            type="text"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleGenerate()}
            placeholder="Pídele a Seven AI que escriba, resuma o planifique..."
            className="flex-1 rounded-md px-3 py-1.5 text-xs outline-none border border-[var(--app-border)] bg-[var(--app-bg-primary)] text-[var(--app-text-primary)] focus:border-[var(--app-accent)] transition"
          />
          <button
            onClick={() => handleGenerate()}
            disabled={!prompt.trim() || loading}
            className="px-3.5 py-1.5 disabled:opacity-40 text-[var(--app-bg-primary)] bg-[var(--app-text-primary)] hover:opacity-90 rounded-md flex items-center gap-1.5 font-medium transition text-xs shadow-xs"
          >
            <span>Generar</span>
            <ArrowRightSmallIcon style={{ width: 14, height: 14 }} />
          </button>
        </div>
      </div>
    </div>
  )
}
