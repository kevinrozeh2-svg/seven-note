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
import { getCurrentMember } from '../../lib/teamAuth'
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
        const member = getCurrentMember()
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
          ownerMember: member.id,
          ownerName: member.name,
          createdBy: member.name,
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
        } catch {
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

    const member = getCurrentMember()
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
        ownerMember: member.id,
        ownerName: member.name,
        createdBy: member.name,
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
    <div
      className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        className="rounded-xl max-w-md w-full border border-[var(--app-border-strong)] shadow-[var(--app-shadow-popover)] overflow-hidden flex flex-col max-h-[90vh] overflow-y-auto bg-[var(--app-bg-overlay)] text-[var(--app-text-primary)] font-sans"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 py-3.5 border-b border-[var(--app-divider)] flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-md flex items-center justify-center bg-[var(--app-hover)] text-[var(--app-text-secondary)]">
              <UploadIcon style={{ width: 16, height: 16 }} />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-[var(--app-text-primary)]">
                Importar archivo
              </h3>
              <p className="text-[11px] text-[var(--app-text-muted)]">
                Convierte archivos Markdown o JSON a páginas de Seven Note
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-md text-[var(--app-text-secondary)] hover:text-[var(--app-text-primary)] hover:bg-[var(--app-hover)] transition-colors cursor-pointer"
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
            className="border border-dashed border-[var(--app-border-strong)] hover:border-[var(--app-accent)] bg-[var(--app-bg-secondary)] rounded-lg p-6 text-center cursor-pointer transition-colors flex flex-col items-center gap-2.5"
          >
            <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-[var(--app-hover)] text-[var(--app-text-secondary)]">
              <UploadIcon style={{ width: 20, height: 20 }} />
            </div>
            <p className="font-medium text-xs text-[var(--app-text-primary)]">
              {fileName ? fileName : 'Selecciona o arrastra un archivo'}
            </p>
            <p className="text-[11px] text-[var(--app-text-muted)]">
              Formatos soportados: Markdown (.md), Obsidian Canvas (.canvas), JSON (.json)
            </p>
          </div>

          {error && (
            <div className="p-2.5 rounded-md bg-rose-500/10 border border-rose-500/25 text-rose-500 flex items-center gap-2">
              <InformationIcon style={{ width: 14, height: 14 }} />
              <span>{error}</span>
            </div>
          )}

          {fileName && (
            <div className="space-y-3 pt-1">
              <div>
                <label className="block text-[11px] font-medium mb-1 text-[var(--app-text-secondary)]">
                  Título del documento
                </label>
                <input
                  type="text"
                  value={importedTitle}
                  onChange={(e) => setImportedTitle(e.target.value)}
                  className="w-full rounded-md px-3 py-1.5 text-xs outline-none border border-[var(--app-border-strong)] bg-[var(--app-bg-primary)] text-[var(--app-text-primary)] focus:border-[var(--app-accent)] transition-colors"
                />
              </div>

              <div className="p-2.5 rounded-md border border-[var(--app-border)] bg-[var(--app-bg-secondary)] text-[var(--app-text-secondary)] text-[11px] flex items-center gap-2">
                <DoneIcon style={{ width: 14, height: 14, color: '#10b981' }} />
                <span>Archivo leído y listo para crear nueva página.</span>
              </div>
            </div>
          )}

          <div className="flex gap-2 justify-end pt-1">
            <button
              onClick={onClose}
              className="px-3 py-1.5 rounded-md border border-[var(--app-border-strong)] bg-[var(--app-bg-secondary)] hover:bg-[var(--app-hover)] text-[var(--app-text-primary)] font-medium transition-colors cursor-pointer"
            >
              Cancelar
            </button>
            <button
              onClick={handleConfirmImport}
              disabled={!fileName}
              className="px-3.5 py-1.5 disabled:opacity-40 bg-[var(--app-text-primary)] text-[var(--app-bg-primary)] hover:opacity-90 rounded-md font-medium transition-opacity cursor-pointer"
            >
              Crear documento
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
