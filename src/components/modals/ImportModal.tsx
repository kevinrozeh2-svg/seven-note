import { useState, useRef } from 'react'
import {
  CloseIcon,
  UploadIcon,
  DoneIcon,
  InformationIcon
} from '@blocksuite/icons/rc'
import { db, DEFAULT_SPACE_ID } from '../../db'
import { syncEngine } from '../../lib/syncEngine'
import { importObsidianCanvas } from '../../lib/canvasExchange'
import { toast } from 'sonner'

interface ImportModalProps {
  isOpen: boolean
  onClose: () => void
  onWorkspaceImported: (newId: string) => void
  currentSpaceId?: string
}

export function ImportModal({ isOpen, onClose, onWorkspaceImported, currentSpaceId }: ImportModalProps) {
  const [fileName, setFileName] = useState<string | null>(null)
  const [importedTitle, setImportedTitle] = useState('')
  const [importedContent, setImportedContent] = useState('')
  const [error, setError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  if (!isOpen) return null

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setFileName(file.name)
    const titleWithoutExt = file.name.replace(/\.[^/.]+$/, '')
    setImportedTitle(titleWithoutExt)
    setError(null)

    // Handle Obsidian JSON Canvas format (.canvas)
    if (file.name.endsWith('.canvas')) {
      try {
        const newId = crypto.randomUUID()
        const now = Date.now()
        await db.workspaces.add({
          id: newId,
          parentId: null,
          spaceId: currentSpaceId || DEFAULT_SPACE_ID,
          title: titleWithoutExt || 'Tablero Canvas Importado',
          icon: '🎨',
          color: '#8b5cf6',
          viewMode: 'canvas',
          docContent: '<p>Tablero importado desde Obsidian Canvas</p>',
          createdAt: now,
          updatedAt: now,
          isFavorite: false,
          isDeleted: false,
          syncStatus: 'pending',
          tags: ['Obsidian', 'Canvas']
        })

        const count = await importObsidianCanvas(newId, file)
        toast.success(`Tablero Obsidian importado con éxito (${count} tarjetas)`)
        syncEngine.scheduleSync(1000)
        onWorkspaceImported(newId)
        onClose()
        return
      } catch (err: any) {
        setError(err.message || 'Error al importar archivo .canvas')
        return
      }
    }

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
        spaceId: currentSpaceId || DEFAULT_SPACE_ID,
        title: importedTitle || 'Documento Importado',
        icon: '📥',
        color: '#1e96eb',
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
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150">
      <div
        className="rounded-2xl max-w-md w-full border shadow-2xl overflow-hidden flex flex-col"
        style={{
          backgroundColor: 'var(--affine-background-overlay-panel-color)',
          borderColor: 'var(--affine-border-color)',
          boxShadow: 'var(--affine-popover-shadow)',
          color: 'var(--affine-text-primary-color)'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          className="px-5 py-4 border-b flex items-center justify-between shrink-0"
          style={{ borderColor: 'var(--affine-border-color)' }}
        >
          <div className="flex items-center gap-2.5">
            <div
              className="w-7 h-7 rounded-lg flex items-center justify-center"
              style={{
                backgroundColor: 'rgba(30, 150, 235, 0.1)',
                color: '#1e96eb'
              }}
            >
              <UploadIcon style={{ width: 18, height: 18 }} />
            </div>
            <div>
              <h3 className="text-sm font-semibold" style={{ color: 'var(--affine-text-primary-color)' }}>
                Importar Archivo
              </h3>
              <p className="text-[11px]" style={{ color: 'var(--affine-text-secondary-color)' }}>
                Convierte archivos Markdown o JSON a páginas de Seven Note
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg transition"
            style={{ color: 'var(--affine-text-secondary-color)' }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = 'var(--affine-hover-color)'
              e.currentTarget.style.color = 'var(--affine-text-primary-color)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent'
              e.currentTarget.style.color = 'var(--affine-text-secondary-color)'
            }}
          >
            <CloseIcon style={{ width: 16, height: 16 }} />
          </button>
        </div>

        <div className="p-5 space-y-4 text-xs">
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            accept=".md,.markdown,.txt,.json,.html,.canvas"
            className="hidden"
          />

          {/* Upload Drop Area */}
          <div
            onClick={() => fileInputRef.current?.click()}
            className="border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition flex flex-col items-center gap-2"
            style={{
              borderColor: 'var(--affine-border-color)',
              backgroundColor: 'var(--affine-background-secondary-color)'
            }}
            onMouseEnter={(e) => (e.currentTarget.style.borderColor = '#1e96eb')}
            onMouseLeave={(e) => (e.currentTarget.style.borderColor = 'var(--affine-border-color)')}
          >
            <div
              className="p-3 rounded-full flex items-center justify-center"
              style={{
                backgroundColor: 'var(--affine-hover-color)',
                color: '#1e96eb'
              }}
            >
              <UploadIcon style={{ width: 22, height: 22 }} />
            </div>
            <p className="font-semibold text-xs" style={{ color: 'var(--affine-text-primary-color)' }}>
              {fileName ? fileName : 'Selecciona o arrastra un archivo'}
            </p>
            <p className="text-[11px]" style={{ color: 'var(--affine-text-secondary-color)' }}>
              Formatos soportados: Markdown (.md), Obsidian Canvas (.canvas), JSON (.json)
            </p>
          </div>

          {error && (
            <div className="p-2.5 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-500 flex items-center gap-2">
              <InformationIcon style={{ width: 14, height: 14 }} />
              <span>{error}</span>
            </div>
          )}

          {fileName && (
            <div className="space-y-3 pt-2">
              <div>
                <label className="block text-[11px] font-medium mb-1" style={{ color: 'var(--affine-text-secondary-color)' }}>
                  Título del documento:
                </label>
                <input
                  type="text"
                  value={importedTitle}
                  onChange={(e) => setImportedTitle(e.target.value)}
                  className="w-full rounded-lg px-3 py-1.5 text-xs outline-none border transition"
                  style={{
                    backgroundColor: 'var(--affine-background-primary-color)',
                    borderColor: 'var(--affine-border-color)',
                    color: 'var(--affine-text-primary-color)'
                  }}
                  onFocus={(e) => (e.currentTarget.style.borderColor = '#1e96eb')}
                  onBlur={(e) => (e.currentTarget.style.borderColor = 'var(--affine-border-color)')}
                />
              </div>

              <div
                className="p-2.5 rounded-lg border text-[11px] flex items-center gap-2"
                style={{
                  backgroundColor: 'var(--affine-background-secondary-color)',
                  borderColor: 'var(--affine-border-color)',
                  color: 'var(--affine-text-secondary-color)'
                }}
              >
                <DoneIcon style={{ width: 14, height: 14, color: '#10b981' }} />
                <span>Archivo leído y listo para crear nueva página.</span>
              </div>
            </div>
          )}

          <div className="flex gap-2 justify-end pt-2">
            <button
              onClick={onClose}
              className="px-3 py-1.5 rounded-lg border font-medium transition"
              style={{
                backgroundColor: 'var(--affine-background-secondary-color)',
                borderColor: 'var(--affine-border-color)',
                color: 'var(--affine-text-primary-color)'
              }}
              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--affine-hover-color)')}
              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'var(--affine-background-secondary-color)')}
            >
              Cancelar
            </button>
            <button
              onClick={handleConfirmImport}
              disabled={!fileName}
              className="px-4 py-1.5 disabled:opacity-40 text-white rounded-lg font-medium transition shadow-xs"
              style={{ backgroundColor: '#1e96eb' }}
              onMouseEnter={(e) => {
                if (fileName) e.currentTarget.style.backgroundColor = '#197ec6'
              }}
              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#1e96eb')}
            >
              Crear documento
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
