import { useState, useRef } from 'react'
import {
  X,
  Upload,
  CheckCircle2,
  AlertCircle
} from 'lucide-react'
import { db } from '../../db'
import { syncEngine } from '../../lib/syncEngine'

interface ImportModalProps {
  isOpen: boolean
  onClose: () => void
  onWorkspaceImported: (newId: string) => void
}

export function ImportModal({ isOpen, onClose, onWorkspaceImported }: ImportModalProps) {
  const [fileName, setFileName] = useState<string | null>(null)
  const [importedTitle, setImportedTitle] = useState('')
  const [importedContent, setImportedContent] = useState('')
  const [error, setError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  if (!isOpen) return null

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setFileName(file.name)
    const titleWithoutExt = file.name.replace(/\.[^/.]+$/, '')
    setImportedTitle(titleWithoutExt)
    setError(null)

    const reader = new FileReader()
    reader.onload = (event) => {
      const text = event.target?.result as string
      if (file.name.endsWith('.json')) {
        try {
          const parsed = JSON.parse(text)
          if (parsed.title) setImportedTitle(parsed.title)
          if (parsed.content || parsed.docContent) {
            setImportedContent(parsed.content || parsed.docContent)
          } else {
            setImportedContent(`<pre>${JSON.stringify(parsed, null, 2)}</pre>`)
          }
        } catch (err) {
          setError('El archivo JSON no es válido.')
        }
      } else {
        // Markdown or plain text
        const html = text
          .split('\n\n')
          .map((p) => {
            if (p.startsWith('# ')) return `<h1>${p.slice(2)}</h1>`
            if (p.startsWith('## ')) return `<h2>${p.slice(3)}</h2>`
            if (p.startsWith('### ')) return `<h3>${p.slice(4)}</h3>`
            if (p.startsWith('- ')) {
              const items = p
                .split('\n')
                .map((li) => `<li>${li.replace(/^- /, '')}</li>`)
                .join('')
              return `<ul>${items}</ul>`
            }
            return `<p>${p}</p>`
          })
          .join('')
        setImportedContent(html)
      }
    }
    reader.readAsText(file)
  }

  const handleConfirmImport = async () => {
    if (!importedTitle && !importedContent) {
      setError('Por favor selecciona un archivo con contenido.')
      return
    }

    const newId = crypto.randomUUID()
    const now = Date.now()

    try {
      await db.workspaces.add({
        id: newId,
        parentId: null,
        title: importedTitle || 'Documento Importado',
        icon: '📥',
        color: '#3b82f6',
        viewMode: 'doc',
        docContent: importedContent || '<p>Contenido importado vacío</p>',
        createdAt: now,
        updatedAt: now,
        isFavorite: false,
        isDeleted: false,
        syncStatus: 'pending',
        tags: ['Importado']
      })
      syncEngine.scheduleSync(1000)
      onWorkspaceImported(newId)
      onClose()
    } catch (err) {
      console.error('Error importing document', err)
      setError('Error al guardar el documento importado.')
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div
        className="bg-[#18181b] border border-[#27272a] rounded-xl max-w-md w-full shadow-2xl overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-[#27272a] flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <Upload size={18} className="text-cyan-400" />
            <h3 className="text-sm font-semibold text-zinc-100">Importar archivo</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-md text-zinc-400 hover:text-zinc-100 hover:bg-[#27272a] transition"
          >
            <X size={16} />
          </button>
        </div>

        <div className="p-5 space-y-4 text-xs text-zinc-300">
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            accept=".md,.markdown,.txt,.json,.html"
            className="hidden"
          />

          {/* Upload Drop Area */}
          <div
            onClick={() => fileInputRef.current?.click()}
            className="border-2 border-dashed border-[#2d2d34] hover:border-blue-500 rounded-xl p-6 text-center cursor-pointer bg-[#141416] transition flex flex-col items-center gap-2"
          >
            <div className="p-3 rounded-full bg-[#222226] text-zinc-300">
              <Upload size={22} className="text-blue-400" />
            </div>
            <p className="font-semibold text-zinc-200">
              {fileName ? fileName : 'Selecciona o arrastra un archivo'}
            </p>
            <p className="text-[11px] text-zinc-500">
              Formatos soportados: Markdown (.md), Texto plano (.txt), JSON (.json)
            </p>
          </div>

          {error && (
            <div className="p-2.5 rounded-lg bg-rose-950/40 border border-rose-800 text-rose-300 flex items-center gap-2">
              <AlertCircle size={14} />
              <span>{error}</span>
            </div>
          )}

          {fileName && (
            <div className="space-y-3 pt-2">
              <div>
                <label className="block text-[11px] font-medium text-zinc-400 mb-1">
                  Título del documento:
                </label>
                <input
                  type="text"
                  value={importedTitle}
                  onChange={(e) => setImportedTitle(e.target.value)}
                  className="w-full bg-[#141416] border border-[#2d2d34] rounded-lg px-3 py-1.5 text-xs text-zinc-100 focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="p-2.5 rounded-lg bg-[#141416] border border-[#242428] text-zinc-400 text-[11px] flex items-center gap-2">
                <CheckCircle2 size={14} className="text-emerald-400 shrink-0" />
                <span>Archivo leído y listo para crear nueva página.</span>
              </div>
            </div>
          )}

          <div className="flex gap-2 justify-end pt-2">
            <button
              onClick={onClose}
              className="px-3 py-1.5 rounded-lg bg-[#222226] hover:bg-[#2a2a30] text-zinc-300 font-medium transition"
            >
              Cancelar
            </button>
            <button
              onClick={handleConfirmImport}
              disabled={!fileName}
              className="px-4 py-1.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white rounded-lg font-medium transition"
            >
              Crear documento
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
