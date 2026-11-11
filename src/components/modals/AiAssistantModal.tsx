import React, { useState, useEffect } from 'react'
import { Sparkles, Key, Send, X, Check, Copy, PlusCircle, Wand2, RefreshCw } from 'lucide-react'
import { db, type WorkspaceItem } from '../../db'
import { syncEngine } from '../../lib/syncEngine'
import { toast } from 'sonner'

interface AiAssistantModalProps {
  isOpen: boolean
  onClose: () => void
  currentWorkspace?: WorkspaceItem | null
}

type AiProvider = 'gemini' | 'openai'

export const AiAssistantModal: React.FC<AiAssistantModalProps> = ({
  isOpen,
  onClose,
  currentWorkspace
}) => {
  const [provider, setProvider] = useState<AiProvider>(() => {
    return (localStorage.getItem('seven_note_ai_provider') as AiProvider) || 'gemini'
  })
  const [apiKey, setApiKey] = useState(() => {
    return localStorage.getItem('seven_note_ai_key') || ''
  })
  const [showKeyInput, setShowKeyInput] = useState(false)
  const [prompt, setPrompt] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState('')
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (isOpen) {
      setResult('')
      setPrompt('')
      if (!apiKey) {
        setShowKeyInput(true)
      }
    }
  }, [isOpen, apiKey])

  if (!isOpen) return null

  const handleSaveKey = () => {
    localStorage.setItem('seven_note_ai_provider', provider)
    localStorage.setItem('seven_note_ai_key', apiKey.trim())
    setShowKeyInput(false)
    toast.success('Clave de API guardada localmente')
  }

  const callAI = async (userInstruction: string, contextContent?: string) => {
    if (!apiKey.trim()) {
      setShowKeyInput(true)
      toast.info('Introduce tu clave de API para usar el asistente')
      return
    }

    setLoading(true)
    setResult('')

    const systemPrompt = `Eres el asistente inteligente de Seven Note (un espacio híbrido tipo Notion y Milanote).
Ayuda al usuario a estructurar sus pensamientos, notas, listas y tableros visuales. Responde siempre en español con claridad, concisión y tono profesional.`

    const fullMessage = `${userInstruction}\n\nContexto actual del documento:\n"""\n${contextContent || currentWorkspace?.docContent?.replace(/<[^>]*>?/gm, '') || '(Documento vacío)'}\n"""`

    try {
      if (provider === 'gemini') {
        const res = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey.trim()}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [{ role: 'user', parts: [{ text: `${systemPrompt}\n\n${fullMessage}` }] }]
            })
          }
        )

        if (!res.ok) {
          const errData = await res.json().catch(() => ({}))
          throw new Error(errData?.error?.message || `Error HTTP ${res.status}`)
        }

        const data = await res.json()
        const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || 'No se obtuvo respuesta.'
        setResult(text)
      } else {
        // OpenAI
        const res = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${apiKey.trim()}`
          },
          body: JSON.stringify({
            model: 'gpt-4o-mini',
            messages: [
              { role: 'system', content: systemPrompt },
              { role: 'user', content: fullMessage }
            ],
            temperature: 0.7
          })
        })

        if (!res.ok) {
          const errData = await res.json().catch(() => ({}))
          throw new Error(errData?.error?.message || `Error HTTP ${res.status}`)
        }

        const data = await res.json()
        const text = data?.choices?.[0]?.message?.content || 'No se obtuvo respuesta.'
        setResult(text)
      }
    } catch (e: any) {
      console.error('Error al conectar con la IA:', e)
      toast.error(`Error: ${e.message || 'Fallo de conexión'}`)
    } finally {
      setLoading(false)
    }
  }

  // Pre-built actions
  const handleAction = (type: 'summarize' | 'brainstorm' | 'actionItems' | 'improve') => {
    switch (type) {
      case 'summarize':
        callAI('Genera un resumen ejecutivo claro y conciso con viñetas de las ideas clave.')
        break
      case 'brainstorm':
        callAI(
          'Genera 5 ideas creativas e innovadoras basadas en el contenido. Separa cada idea con un guion o viñeta con formato: "- [Título breve]: [Explicación concisa]".'
        )
        break
      case 'actionItems':
        callAI('Extrae una lista de tareas de acción (checklist) ordenada por prioridad y pasos concretos.')
        break
      case 'improve':
        callAI('Mejora la redacción, claridad, fluidez y ortografía del texto conservando su mensaje principal.')
        break
    }
  }

  // Convert brainstormed lines into physical canvas sticky notes!
  const handleAddAsCanvasStickies = async () => {
    if (!result || !currentWorkspace) return
    const lines = result
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l.startsWith('-') || l.startsWith('*') || /^\d+\./.test(l))

    const colors = ['yellow', 'green', 'blue', 'orange', 'purple', 'slate']
    let added = 0
    const now = Date.now()

    for (let i = 0; i < lines.length && i < 6; i++) {
      const cleanText = lines[i].replace(/^[-*•\d.]+\s*/, '')
      const parts = cleanText.split(':')
      const title = parts[0]?.trim() || `Idea #${i + 1}`
      const body = parts[1]?.trim() || ''

      const newId = crypto.randomUUID()
      await db.canvasNodes.add({
        id: newId,
        workspaceId: currentWorkspace.id,
        type: 'note',
        positionX: 180 + (i % 3) * 280,
        positionY: 200 + Math.floor(i / 3) * 220,
        data: {
          title,
          content: body,
          color: colors[i % colors.length]
        },
        createdAt: now,
        updatedAt: now,
        isDeleted: false,
        syncStatus: 'pending'
      })
      added++
    }

    if (added > 0) {
      syncEngine.scheduleSync(1000)
      toast.success(`${added} tarjetas añadidas al tablero visual`)
      onClose()
    } else {
      toast.info('No se encontraron líneas estructuradas para convertir en tarjetas')
    }
  }

  const handleCopy = () => {
    if (!result) return
    navigator.clipboard.writeText(result)
    setCopied(true)
    toast.success('Respuesta copiada al portapapeles')
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        className="w-full max-w-xl rounded-2xl bg-[var(--app-bg-overlay,#ffffff)] dark:bg-[#202020] border border-[var(--app-border,#e5e5e5)] dark:border-[#333333] shadow-2xl p-5 text-[var(--app-text-primary,#111111)] dark:text-[#f0f0f0] animate-in zoom-in-95 duration-150 flex flex-col max-h-[85vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-black/[0.06] dark:border-white/[0.08]">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-indigo-500 to-purple-500 text-white flex items-center justify-center shadow-xs">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-semibold leading-none">Asistente de IA (BYOK)</h3>
              <p className="text-[11px] text-neutral-400 dark:text-neutral-500 mt-0.5">
                Privado, local y con tu propia API Key (Gemini o OpenAI)
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setShowKeyInput((prev) => !prev)}
              className="p-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/10 text-neutral-400 hover:text-neutral-700 dark:hover:text-white transition cursor-pointer"
              title="Configurar clave de API"
            >
              <Key className="w-4 h-4" />
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/10 text-neutral-400 hover:text-neutral-700 dark:hover:text-white transition cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* API Key Drawer */}
        {showKeyInput && (
          <div className="mt-3 p-3 rounded-xl bg-neutral-100 dark:bg-neutral-800/60 border border-neutral-200 dark:border-neutral-700/60 space-y-2 text-xs">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-neutral-700 dark:text-neutral-300">Proveedor de IA:</span>
              <div className="flex gap-1">
                <button
                  type="button"
                  onClick={() => setProvider('gemini')}
                  className={`px-2 py-0.5 rounded-lg font-medium cursor-pointer ${
                    provider === 'gemini'
                      ? 'bg-blue-600 text-white'
                      : 'bg-black/5 dark:bg-white/5 text-neutral-500'
                  }`}
                >
                  Google Gemini (Gratuito)
                </button>
                <button
                  type="button"
                  onClick={() => setProvider('openai')}
                  className={`px-2 py-0.5 rounded-lg font-medium cursor-pointer ${
                    provider === 'openai'
                      ? 'bg-emerald-600 text-white'
                      : 'bg-black/5 dark:bg-white/5 text-neutral-500'
                  }`}
                >
                  OpenAI
                </button>
              </div>
            </div>
            <div className="flex gap-2">
              <input
                type="password"
                placeholder={provider === 'gemini' ? 'AIzaSy...' : 'sk-...'}
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                className="flex-1 px-2.5 py-1.5 rounded-lg bg-white dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700 text-xs outline-none focus:border-blue-500"
              />
              <button
                type="button"
                onClick={handleSaveKey}
                className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-medium text-xs transition cursor-pointer"
              >
                Guardar
              </button>
            </div>
            <p className="text-[10px] text-neutral-400">
              Tu clave se almacena exclusivamente en tu navegador y no pasa por ningún servidor intermediario.
            </p>
          </div>
        )}

        {/* Action Pills */}
        <div className="mt-3 flex flex-wrap gap-1.5">
          <button
            onClick={() => handleAction('summarize')}
            disabled={loading}
            className="px-2.5 py-1 rounded-xl text-xs font-medium bg-black/[0.04] dark:bg-white/[0.06] hover:bg-blue-500/10 hover:text-blue-500 text-neutral-600 dark:text-neutral-300 transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
          >
            <span>📝 Resumir nota</span>
          </button>
          <button
            onClick={() => handleAction('brainstorm')}
            disabled={loading}
            className="px-2.5 py-1 rounded-xl text-xs font-medium bg-black/[0.04] dark:bg-white/[0.06] hover:bg-amber-500/10 hover:text-amber-500 text-neutral-600 dark:text-neutral-300 transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
          >
            <span>💡 Lluvia de ideas (Tablero)</span>
          </button>
          <button
            onClick={() => handleAction('actionItems')}
            disabled={loading}
            className="px-2.5 py-1 rounded-xl text-xs font-medium bg-black/[0.04] dark:bg-white/[0.06] hover:bg-emerald-500/10 hover:text-emerald-500 text-neutral-600 dark:text-neutral-300 transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
          >
            <span>✅ Lista de tareas</span>
          </button>
          <button
            onClick={() => handleAction('improve')}
            disabled={loading}
            className="px-2.5 py-1 rounded-xl text-xs font-medium bg-black/[0.04] dark:bg-white/[0.06] hover:bg-purple-500/10 hover:text-purple-500 text-neutral-600 dark:text-neutral-300 transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
          >
            <span>✍️ Pulir redacción</span>
          </button>
        </div>

        {/* Custom Prompt Input */}
        <div className="mt-3 flex gap-2">
          <input
            type="text"
            placeholder="O escribe una instrucción personalizada..."
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && prompt.trim()) {
                callAI(prompt.trim())
              }
            }}
            className="flex-1 px-3 py-2 text-xs rounded-xl bg-black/[0.03] dark:bg-white/[0.05] border border-black/[0.06] dark:border-white/[0.08] outline-none focus:border-blue-500 transition"
          />
          <button
            onClick={() => prompt.trim() && callAI(prompt.trim())}
            disabled={loading || !prompt.trim()}
            className="px-4 py-2 rounded-full btn-pill-purple text-xs font-semibold flex items-center gap-1.5 disabled:opacity-40 cursor-pointer shrink-0"
          >
            {loading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
            <span>Consultar</span>
          </button>
        </div>

        {/* Result Area */}
        <div className="mt-3 flex-1 overflow-y-auto min-h-[140px] max-h-[300px] p-3 rounded-xl bg-black/[0.02] dark:bg-white/[0.03] border border-black/[0.06] dark:border-white/[0.08] text-xs leading-relaxed custom-scrollbar">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-8 text-neutral-400 gap-2">
              <RefreshCw className="w-5 h-5 animate-spin text-blue-500" />
              <span>Generando respuesta con {provider === 'gemini' ? 'Gemini 1.5' : 'OpenAI'}...</span>
            </div>
          ) : result ? (
            <div className="whitespace-pre-wrap text-neutral-800 dark:text-neutral-200">
              {result}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-8 text-neutral-400 dark:text-neutral-500 text-center text-xs">
              <Wand2 className="w-6 h-6 mb-1.5 opacity-50" />
              <span>Selecciona una acción rápida o escribe una consulta para procesar el documento</span>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        {result && (
          <div className="mt-3 flex items-center justify-between pt-3 border-t border-black/[0.06] dark:border-white/[0.08]">
            <button
              onClick={handleCopy}
              className="px-3 py-1.5 rounded-xl hover:bg-black/5 dark:hover:bg-white/10 text-neutral-600 dark:text-neutral-300 text-xs font-medium flex items-center gap-1.5 transition cursor-pointer"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? 'Copiado' : 'Copiar texto'}</span>
            </button>

            <button
              onClick={handleAddAsCanvasStickies}
              className="px-4 py-1.5 rounded-full btn-pill-purple font-medium text-xs flex items-center gap-1.5 cursor-pointer"
            >
              <PlusCircle className="w-3.5 h-3.5" />
              <span>Añadir como tarjetas al tablero</span>
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
