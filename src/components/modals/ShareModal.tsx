import { useState } from 'react'
import {
  CloseIcon,
  ShareIcon,
  CopyIcon,
  DoneIcon,
  WebIcon,
  PageIcon,
  CodeIcon,
  PrinterIcon,
  AdminIcon
} from '@blocksuite/icons/rc'
import { db, type WorkspaceItem } from '../../db'

interface ShareModalProps {
  isOpen: boolean
  onClose: () => void
  workspace: WorkspaceItem | undefined
}

export function ShareModal({ isOpen, onClose, workspace }: ShareModalProps) {
  const [copiedLink, setCopiedLink] = useState(false)
  const [copiedMd, setCopiedMd] = useState(false)
  const [isPublic, setIsPublic] = useState(false)
  const [permission, setPermission] = useState<'view' | 'edit'>('view')

  if (!isOpen || !workspace) return null

  const shareUrl = `${window.location.origin}/#note=${workspace.id}`

  const handleCopy = () => {
    navigator.clipboard.writeText(shareUrl)
    setCopiedLink(true)
    setTimeout(() => setCopiedLink(false), 2000)
  }

  // Convert HTML content into high-fidelity markdown
  const getMarkdownContent = () => {
    let md = workspace.docContent || ''

    // 1. Code blocks with language
    md = md.replace(/<pre><code(?:\s+class="language-([a-zA-Z0-9_-]+)")?>([\s\S]*?)<\/code><\/pre>/gi, (_, lang, code) => {
      const cleanCode = code
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&amp;/g, '&')
      return `\n\`\`\`${lang || ''}\n${cleanCode.trim()}\n\`\`\`\n\n`
    })

    // 2. Callout containers
    md = md.replace(/<div\s+class="callout(?:\s+callout-([a-zA-Z]+))?"[^>]*>([\s\S]*?)<\/div>/gi, (_, type, content) => {
      const cleanContent = content.replace(/<[^>]*>/g, '').trim()
      const alertType = type ? type.toUpperCase() : 'NOTE'
      return `\n> [!${alertType}]\n> ${cleanContent.replace(/\n/g, '\n> ')}\n\n`
    })

    // 3. Details / Toggle blocks
    md = md.replace(/<details[^>]*>\s*<summary[^>]*>([\s\S]*?)<\/summary>([\s\S]*?)<\/details>/gi, (_, summary, body) => {
      const cleanSum = summary.replace(/<[^>]*>/g, '').trim()
      const cleanBody = body.replace(/<[^>]*>/g, '').trim()
      return `\n<details>\n<summary>${cleanSum}</summary>\n\n${cleanBody}\n</details>\n\n`
    })

    // 4. Blockquotes
    md = md.replace(/<blockquote[^>]*>([\s\S]*?)<\/blockquote>/gi, (_, quote) => {
      const cleanQuote = quote.replace(/<[^>]*>/g, '').trim()
      return `\n> ${cleanQuote.replace(/\n/g, '\n> ')}\n\n`
    })

    // 5. Task list items (checked vs unchecked)
    md = md.replace(/<li[^>]*data-type="taskItem"[^>]*data-checked="true"[^>]*>([\s\S]*?)<\/li>/gi, '- [x] $1\n')
    md = md.replace(/<li[^>]*data-type="taskItem"[^>]*data-checked="false"[^>]*>([\s\S]*?)<\/li>/gi, '- [ ] $1\n')
    md = md.replace(/<li[^>]*data-checked="true"[^>]*>([\s\S]*?)<\/li>/gi, '- [x] $1\n')
    md = md.replace(/<li[^>]*data-checked="false"[^>]*>([\s\S]*?)<\/li>/gi, '- [ ] $1\n')

    // 6. Regular list items
    md = md.replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, '- $1\n')

    // 7. Headings & paragraphs & formatting
    md = md
      .replace(/<h1>([\s\S]*?)<\/h1>/gi, '\n# $1\n\n')
      .replace(/<h2>([\s\S]*?)<\/h2>/gi, '\n## $1\n\n')
      .replace(/<h3>([\s\S]*?)<\/h3>/gi, '\n### $1\n\n')
      .replace(/<p>([\s\S]*?)<\/p>/gi, '$1\n\n')
      .replace(/<strong>([\s\S]*?)<\/strong>/gi, '**$1**')
      .replace(/<em>([\s\S]*?)<\/em>/gi, '*$1*')
      .replace(/<code>([\s\S]*?)<\/code>/gi, '`$1`')
      .replace(/<hr\s*\/?>/gi, '\n---\n\n')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<[^>]*>/g, '')
      .replace(/&nbsp;/g, ' ')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&amp;/g, '&')
      .trim()

    // Title deduplication
    const titleHeader = `# ${workspace.title}`
    if (md.startsWith(titleHeader)) {
      return md
    }
    return `${titleHeader}\n\n${md}`
  }

  const exportMarkdown = () => {
    const md = getMarkdownContent()
    const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${workspace.title.replace(/\s+/g, '_').toLowerCase() || 'nota'}.md`
    a.click()
    URL.revokeObjectURL(url)
  }

  const handleCopyMarkdown = async () => {
    const md = getMarkdownContent()
    await navigator.clipboard.writeText(md)
    setCopiedMd(true)
    setTimeout(() => setCopiedMd(false), 2000)
  }

  const exportHTML = () => {
    const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>${workspace.title}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; line-height: 1.6; max-width: 760px; margin: 40px auto; padding: 0 20px; color: #222; }
    h1 { border-bottom: 1px solid #eee; padding-bottom: 8px; }
    ul[data-type="taskList"] { list-style: none; padding-left: 0; }
    ul[data-type="taskList"] li { display: flex; align-items: center; gap: 8px; margin-bottom: 6px; }
    blockquote { border-left: 3px solid #1e96eb; padding-left: 12px; color: #555; }
    .callout { padding: 12px; border-radius: 8px; background: #f3f4f6; margin: 16px 0; }
  </style>
</head>
<body>
  <h1>${workspace.icon ? `${workspace.icon} ` : ''}${workspace.title}</h1>
  ${workspace.docContent}
</body>
</html>`
    const blob = new Blob([html], { type: 'text/html;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${workspace.title.replace(/\s+/g, '_').toLowerCase() || 'nota'}.html`
    a.click()
    URL.revokeObjectURL(url)
  }

  const handlePrintPDF = () => {
    window.print()
  }

  const exportJSONSnapshot = async () => {
    const nodes = await db.canvasNodes.where('workspaceId').equals(workspace.id).toArray()
    const edges = await db.canvasEdges.where('workspaceId').equals(workspace.id).toArray()

    const snapshot = {
      type: 'seven-note-snapshot',
      version: '1.0',
      exportedAt: new Date().toISOString(),
      workspace,
      canvas: {
        nodes,
        edges
      }
    }

    const blob = new Blob([JSON.stringify(snapshot, null, 2)], {
      type: 'application/json;charset=utf-8'
    })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${workspace.title.replace(/\s+/g, '_').toLowerCase() || 'nota'}_snapshot.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150">
      <div
        className="rounded-xl max-w-md w-full border border-[var(--app-border)] shadow-[var(--app-shadow-modal)] overflow-hidden flex flex-col bg-[var(--app-bg-overlay)] text-[var(--app-text-primary)]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 py-3.5 border-b border-[var(--app-border)] flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-md flex items-center justify-center bg-[var(--app-hover)] text-[var(--app-text-primary)]">
              <ShareIcon style={{ width: 16, height: 16 }} />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-[var(--app-text-primary)]">
                Compartir y Exportar
              </h3>
              <p className="text-[11px] text-[var(--app-text-secondary)]">
                Enlace web y formatos compatibles con Notion y Markdown
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

        <div className="p-5 space-y-4 text-xs">
          {/* Document summary */}
          <div className="p-3 rounded-lg border border-[var(--app-border)] bg-[var(--app-bg-secondary)] flex items-center gap-3">
            <span className="text-2xl">{workspace.icon || '📄'}</span>
            <div className="min-w-0 flex-1">
              <h4 className="font-semibold text-xs text-[var(--app-text-primary)] truncate">
                {workspace.title || 'Untitled'}
              </h4>
              <p className="text-[11px] text-[var(--app-text-secondary)]">
                Modo {workspace.viewMode}
              </p>
            </div>
          </div>

          {/* Share link input */}
          <div>
            <label className="block text-[11px] font-medium mb-1.5 text-[var(--app-text-secondary)]">
              Enlace directo al documento
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                readOnly
                value={shareUrl}
                className="flex-1 rounded-md px-3 py-1.5 text-xs font-mono select-all focus:outline-none border border-[var(--app-border)] bg-[var(--app-bg-primary)] text-[var(--app-text-primary)]"
              />
              <button
                onClick={handleCopy}
                className="px-3 py-1.5 rounded-md font-medium flex items-center gap-1.5 transition text-[var(--app-bg-primary)] bg-[var(--app-text-primary)] hover:opacity-90 shadow-xs"
              >
                {copiedLink ? (
                  <DoneIcon style={{ width: 14, height: 14 }} />
                ) : (
                  <CopyIcon style={{ width: 14, height: 14 }} />
                )}
                <span>{copiedLink ? 'Copiado' : 'Copiar'}</span>
              </button>
            </div>
          </div>

          {/* Web Access Settings */}
          <div className="pt-3 border-t border-[var(--app-border)] space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <WebIcon
                  style={{
                    width: 16,
                    height: 16,
                    color: isPublic ? 'var(--app-accent)' : 'var(--app-text-secondary)'
                  }}
                />
                <div>
                  <p className="font-medium text-xs text-[var(--app-text-primary)]">
                    Publicar en la Web
                  </p>
                  <p className="text-[11px] text-[var(--app-text-secondary)]">
                    Cualquiera con el enlace podrá acceder al documento
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsPublic(!isPublic)}
                className="w-9 h-5 rounded-full p-0.5 transition-colors relative"
                style={{
                  backgroundColor: isPublic ? 'var(--app-accent)' : 'var(--app-hover)'
                }}
              >
                <div
                  className="w-4 h-4 rounded-full bg-white transition-transform"
                  style={{
                    transform: isPublic ? 'translateX(16px)' : 'translateX(0)'
                  }}
                />
              </button>
            </div>

            {isPublic && (
              <div className="flex items-center justify-between p-2 rounded-md border border-[var(--app-border)] bg-[var(--app-bg-secondary)]">
                <div className="flex items-center gap-2 text-[var(--app-text-secondary)]">
                  <AdminIcon style={{ width: 14, height: 14 }} />
                  <span>Nivel de permisos:</span>
                </div>
                <select
                  value={permission}
                  onChange={(e) => setPermission(e.target.value as any)}
                  className="rounded-md px-2 py-1 text-xs focus:outline-none border border-[var(--app-border)] bg-[var(--app-bg-primary)] text-[var(--app-text-primary)]"
                >
                  <option value="view">Solo lectura</option>
                  <option value="edit">Permitir edición</option>
                </select>
              </div>
            )}
          </div>

          {/* Quick Exports */}
          <div className="pt-3 border-t border-[var(--app-border)]">
            <label className="block text-[11px] font-medium mb-2 text-[var(--app-text-secondary)]">
              Exportar documento y lienzo
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={exportMarkdown}
                className="flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-md border border-[var(--app-border)] bg-[var(--app-bg-secondary)] hover:bg-[var(--app-hover)] text-[var(--app-text-primary)] font-medium transition"
              >
                <CodeIcon style={{ width: 14, height: 14 }} />
                <span>Markdown (.md)</span>
              </button>

              <button
                onClick={handleCopyMarkdown}
                className="flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-md border border-[var(--app-border)] bg-[var(--app-bg-secondary)] hover:bg-[var(--app-hover)] text-[var(--app-text-primary)] font-medium transition"
              >
                {copiedMd ? (
                  <DoneIcon style={{ width: 14, height: 14, color: '#10b981' }} />
                ) : (
                  <CopyIcon style={{ width: 14, height: 14 }} />
                )}
                <span>{copiedMd ? '¡Copiado!' : 'Copiar MD'}</span>
              </button>

              <button
                onClick={exportHTML}
                className="flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-md border border-[var(--app-border)] bg-[var(--app-bg-secondary)] hover:bg-[var(--app-hover)] text-[var(--app-text-primary)] font-medium transition"
              >
                <PageIcon style={{ width: 14, height: 14 }} />
                <span>Página (.html)</span>
              </button>

              <button
                onClick={handlePrintPDF}
                className="flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-md border border-[var(--app-border)] bg-[var(--app-bg-secondary)] hover:bg-[var(--app-hover)] text-[var(--app-text-primary)] font-medium transition"
              >
                <PrinterIcon style={{ width: 14, height: 14 }} />
                <span>Imprimir / PDF</span>
              </button>

              <button
                onClick={exportJSONSnapshot}
                className="col-span-2 flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-md border border-[var(--app-border)] bg-[var(--app-bg-secondary)] hover:bg-[var(--app-hover)] text-[var(--app-text-primary)] font-medium transition"
              >
                <CodeIcon style={{ width: 14, height: 14 }} />
                <span>Instantánea completa JSON (Lienzo + Doc)</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
