import { useState } from 'react'
import {
  X,
  Share2,
  Copy,
  Check,
  Globe,
  FileText,
  FileCode,
  ShieldCheck
} from 'lucide-react'
import type { WorkspaceItem } from '../../db'

interface ShareModalProps {
  isOpen: boolean
  onClose: () => void
  workspace: WorkspaceItem | undefined
}

export function ShareModal({ isOpen, onClose, workspace }: ShareModalProps) {
  const [copiedLink, setCopiedLink] = useState(false)
  const [isPublic, setIsPublic] = useState(false)
  const [permission, setPermission] = useState<'view' | 'edit'>('view')

  if (!isOpen || !workspace) return null

  const shareUrl = `${window.location.origin}/#note=${workspace.id}`

  const handleCopy = () => {
    navigator.clipboard.writeText(shareUrl)
    setCopiedLink(true)
    setTimeout(() => setCopiedLink(false), 2000)
  }

  const exportMarkdown = () => {
    const blob = new Blob([`# ${workspace.title}\n\n${workspace.docContent.replace(/<[^>]*>/g, '')}`], {
      type: 'text/markdown;charset=utf-8'
    })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${workspace.title.replace(/\s+/g, '_').toLowerCase() || 'nota'}.md`
    a.click()
    URL.revokeObjectURL(url)
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
  </style>
</head>
<body>
  <h1>${workspace.title}</h1>
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

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div
        className="bg-[#18181b] border border-[#27272a] rounded-xl max-w-md w-full shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-[#27272a] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Share2 size={18} className="text-blue-400" />
            <h3 className="text-sm font-semibold text-zinc-100">Compartir documento</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-md text-zinc-400 hover:text-zinc-100 hover:bg-[#27272a] transition"
          >
            <X size={16} />
          </button>
        </div>

        <div className="p-5 space-y-5 text-xs text-zinc-300">
          {/* Document summary */}
          <div className="p-3 bg-[#131315] rounded-lg border border-[#242428] flex items-center gap-3">
            <span className="text-2xl">{workspace.icon || '📄'}</span>
            <div className="min-w-0 flex-1">
              <h4 className="font-semibold text-zinc-100 truncate">{workspace.title || 'Untitled'}</h4>
              <p className="text-[11px] text-zinc-500">Última edición hoy</p>
            </div>
          </div>

          {/* Share link input */}
          <div>
            <label className="block text-[11px] font-medium text-zinc-400 mb-1.5">
              Enlace directo al documento
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                readOnly
                value={shareUrl}
                className="flex-1 bg-[#121214] border border-[#2d2d34] rounded-lg px-3 py-2 text-xs text-zinc-300 font-mono select-all focus:outline-none"
              />
              <button
                onClick={handleCopy}
                className={`px-3 py-2 rounded-lg font-medium flex items-center gap-1.5 transition ${
                  copiedLink
                    ? 'bg-emerald-600 text-white'
                    : 'bg-blue-600 hover:bg-blue-500 text-white'
                }`}
              >
                {copiedLink ? <Check size={14} /> : <Copy size={14} />}
                <span>{copiedLink ? 'Copiado' : 'Copiar'}</span>
              </button>
            </div>
          </div>

          {/* Web Access Settings */}
          <div className="pt-2 border-t border-[#27272a] space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <Globe size={16} className={isPublic ? 'text-blue-400' : 'text-zinc-500'} />
                <div>
                  <p className="font-medium text-zinc-200">Publicar en la Web</p>
                  <p className="text-[11px] text-zinc-500">
                    Cualquiera con el enlace podrá acceder al documento
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsPublic(!isPublic)}
                className={`w-10 h-5 rounded-full p-0.5 transition-colors ${
                  isPublic ? 'bg-blue-600' : 'bg-[#27272a]'
                }`}
              >
                <div
                  className={`w-4 h-4 rounded-full bg-white transition-transform ${
                    isPublic ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>

            {isPublic && (
              <div className="flex items-center justify-between p-2.5 bg-[#141416] rounded-lg border border-[#242428]">
                <div className="flex items-center gap-2 text-zinc-400">
                  <ShieldCheck size={14} />
                  <span>Nivel de permisos:</span>
                </div>
                <select
                  value={permission}
                  onChange={(e) => setPermission(e.target.value as any)}
                  className="bg-[#1f1f24] border border-[#2e2e36] rounded px-2 py-1 text-xs text-zinc-200 focus:outline-none"
                >
                  <option value="view">Solo lectura</option>
                  <option value="edit">Permitir edición</option>
                </select>
              </div>
            )}
          </div>

          {/* Quick Exports */}
          <div className="pt-2 border-t border-[#27272a]">
            <label className="block text-[11px] font-medium text-zinc-400 mb-2">
              Exportar archivo
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={exportMarkdown}
                className="flex items-center justify-center gap-2 py-2 px-3 rounded-lg bg-[#222226] hover:bg-[#2a2a30] text-zinc-200 font-medium transition"
              >
                <FileCode size={14} className="text-blue-400" />
                <span>Markdown (.md)</span>
              </button>
              <button
                onClick={exportHTML}
                className="flex items-center justify-center gap-2 py-2 px-3 rounded-lg bg-[#222226] hover:bg-[#2a2a30] text-zinc-200 font-medium transition"
              >
                <FileText size={14} className="text-amber-400" />
                <span>Página Web (.html)</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
