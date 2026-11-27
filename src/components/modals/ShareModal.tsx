import { useState, useEffect } from 'react'
import {
  CloseIcon,
  ShareIcon,
  CopyIcon,
  DoneIcon,
  WebIcon,
  PageIcon,
  CodeIcon,
  PrinterIcon
} from '@blocksuite/icons/rc'
import { Lock, Unlock } from 'lucide-react'
import { db, type WorkspaceItem } from '../../db'
import { syncEngine } from '../../lib/syncEngine'
import { getCurrentMember, canUserTogglePrivacy, canUserEditWorkspace } from '../../lib/teamAuth'
import {
  htmlToMarkdown,
  exportDocumentAsMarkdown,
  exportDocumentAsHtml,
  exportDocumentAsJson,
  printDocument
} from '../../lib/exportUtils'
import { toast } from '../../lib/toast'
import { AppleEmoji } from '../ui/AppleEmoji'

interface ShareModalProps {
  isOpen: boolean
  onClose: () => void
  workspace: WorkspaceItem | undefined
}

export function ShareModal({ isOpen, onClose, workspace }: ShareModalProps) {
  const [copiedLink, setCopiedLink] = useState(false)
  const [copiedMd, setCopiedMd] = useState(false)
  const [isPublic, setIsPublic] = useState(false)
  const [shareToken, setShareToken] = useState('')
  const [isPrivate, setIsPrivate] = useState(false)

  const currentMember = getCurrentMember()

  useEffect(() => {
    if (workspace && isOpen) {
      setIsPublic(Boolean(workspace.isPublicShared))
      setShareToken(workspace.shareToken || crypto.randomUUID())
      setIsPrivate(Boolean(workspace.isPrivate))
    }
  }, [workspace, isOpen, currentMember.id])

  if (!isOpen || !workspace) return null

  const externalShareUrl = `${window.location.origin}/?share=${encodeURIComponent(workspace.id)}&token=${encodeURIComponent(shareToken)}`
  const internalShareUrl = `${window.location.origin}/#note=${encodeURIComponent(workspace.id)}`
  const currentUrl = isPublic ? externalShareUrl : internalShareUrl

  const handleCopy = () => {
    navigator.clipboard.writeText(currentUrl)
    setCopiedLink(true)
    toast.success('Enlace copiado al portapapeles')
    setTimeout(() => setCopiedLink(false), 2000)
  }

  const handleTogglePublic = async () => {
    if (!canUserEditWorkspace(workspace, currentMember)) {
      toast.error('No tienes permisos para cambiar el acceso público de esta nota.')
      return
    }
    const nextPublic = !isPublic
    if (nextPublic && isPrivate) {
      toast.error('Una nota privada no puede compartirse públicamente. Hazla de equipo primero.')
      return
    }

    // Generate a fresh token on enable and revoke (clear) the old token on disable
    const nextToken = nextPublic ? crypto.randomUUID() : ''
    setShareToken(nextToken)
    setIsPublic(nextPublic)

    await db.workspaces.update(workspace.id, {
      isPublicShared: nextPublic,
      shareToken: nextToken || undefined,
      sharePermission: 'view',
      updatedAt: Date.now(),
      syncStatus: 'pending'
    })
    if (nextPublic) {
      void syncEngine.triggerSync()
    } else {
      syncEngine.scheduleSync(500)
    }
    toast.success(nextPublic ? 'Enlace público externo activado' : 'Enlace público externo revocado')
  }

  const handleTogglePrivate = async () => {
    if (!canUserTogglePrivacy(workspace, currentMember)) {
      toast.error('Solo el creador o un administrador puede cambiar la privacidad de esta nota.')
      return
    }
    const nextPrivate = !isPrivate
    setIsPrivate(nextPrivate)
    const targetOwner = workspace.ownerMember || currentMember.id

    // Security: making a note private MUST immediately revoke any active public share link
    const revokePublic = nextPrivate && isPublic
    if (revokePublic) {
      setIsPublic(false)
      setShareToken('')
    }

    await db.workspaces.update(workspace.id, {
      isPrivate: nextPrivate,
      ...(nextPrivate ? { isPublicShared: false, shareToken: undefined } : {}),
      ownerMember: targetOwner,
      ownerName: currentMember.name,
      updatedAt: Date.now(),
      syncStatus: 'pending'
    })
    syncEngine.scheduleSync(500)
    toast.success(
      nextPrivate
        ? revokePublic
          ? 'Nota cambiada a MODO PRIVADO y enlace público revocado'
          : 'Nota cambiada a MODO PRIVADO'
        : 'Nota compartida con todo el equipo'
    )
  }

  const handleCopyMarkdown = async () => {
    const bodyMd = htmlToMarkdown(workspace.docContent || '')
    const titleHeader = `# ${workspace.title}`
    const md = bodyMd.startsWith(titleHeader) ? bodyMd : `${titleHeader}\n\n${bodyMd}`
    await navigator.clipboard.writeText(md)
    setCopiedMd(true)
    setTimeout(() => setCopiedMd(false), 2000)
  }

  const exportJSONSnapshot = async () => {
    const nodes = await db.canvasNodes.where('workspaceId').equals(workspace.id).toArray()
    const edges = await db.canvasEdges.where('workspaceId').equals(workspace.id).toArray()
    exportDocumentAsJson(workspace, nodes, edges)
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 animate-in fade-in duration-150">
      <div
        className="rounded-xl max-w-md w-full max-h-[90vh] border border-[var(--app-border)] shadow-[var(--app-shadow-modal)] overflow-hidden flex flex-col bg-[var(--app-bg-overlay)] text-[var(--app-text-primary)]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-4 sm:px-5 py-3.5 border-b border-[var(--app-border)] flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-md flex items-center justify-center bg-[var(--app-hover)] text-[var(--app-text-primary)] shrink-0">
              <ShareIcon style={{ width: 16, height: 16 }} />
            </div>
            <div className="min-w-0">
              <h3 className="text-sm font-semibold text-[var(--app-text-primary)] truncate">
                Compartir y Exportar
              </h3>
              <p className="text-[11px] text-[var(--app-text-secondary)] truncate">
                Enlace web y formatos compatibles con Notion y Markdown
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-md text-[var(--app-text-secondary)] hover:text-[var(--app-text-primary)] hover:bg-[var(--app-hover)] transition shrink-0"
          >
            <CloseIcon style={{ width: 16, height: 16 }} />
          </button>
        </div>

        <div className="p-4 sm:p-5 space-y-4 text-xs overflow-y-auto custom-scrollbar">
          {/* Document summary and Privacy Badge */}
          <div className="p-3 rounded-lg border border-[var(--app-border)] bg-[var(--app-bg-secondary)] flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0 flex-1">
              <AppleEmoji emoji={workspace.icon || '📄'} size={26} className="shrink-0" />
              <div className="min-w-0 flex-1">
                <h4 className="font-semibold text-xs text-[var(--app-text-primary)] truncate">
                  {workspace.title || 'Untitled'}
                </h4>
                <div className="flex items-center gap-2 mt-0.5 text-[11px] text-[var(--app-text-secondary)]">
                  <span>Modo {workspace.viewMode}</span>
                  <span>•</span>
                  <span className="flex items-center gap-1 font-medium">
                    {isPrivate ? (
                      <span className="text-amber-600 dark:text-amber-400 flex items-center gap-0.5">
                        <Lock className="w-3 h-3" /> Privada
                      </span>
                    ) : (
                      <span className="text-blue-600 dark:text-blue-400 flex items-center gap-0.5">
                        <Unlock className="w-3 h-3" /> Equipo
                      </span>
                    )}
                  </span>
                </div>
              </div>
            </div>

            {/* Toggle Private Button */}
            <button
              onClick={handleTogglePrivate}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-medium border flex items-center gap-1.5 transition cursor-pointer ${
                isPrivate
                  ? 'border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300 hover:bg-amber-500/20'
                  : 'border-blue-500/30 bg-blue-500/10 text-blue-700 dark:text-blue-300 hover:bg-blue-500/20'
              }`}
              title={isPrivate ? 'Hacer accesible a todo el equipo' : 'Hacer privada solo para mí'}
            >
              {isPrivate ? <Lock className="w-3.5 h-3.5" /> : <Unlock className="w-3.5 h-3.5" />}
              <span>{isPrivate ? 'Hacer Pública' : 'Hacer Privada'}</span>
            </button>
          </div>

          {/* Share link input */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-[11px] font-medium text-[var(--app-text-secondary)]">
                {isPublic ? '🔗 Enlace para personas externas (con token seguro)' : 'Enlace interno de la nota'}
              </label>
              {isPublic && (
                <span className="text-[10px] bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-medium px-2 py-0.5 rounded-full">
                  Acceso externo activo
                </span>
              )}
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                readOnly
                value={currentUrl}
                className="flex-1 rounded-md px-3 py-1.5 text-xs font-mono select-all focus:outline-none border border-[var(--app-border)] bg-[var(--app-bg-primary)] text-[var(--app-text-primary)]"
              />
              <button
                onClick={handleCopy}
                className="px-3 py-1.5 rounded-md font-medium flex items-center gap-1.5 transition text-[var(--app-bg-primary)] bg-[var(--app-text-primary)] hover:opacity-90 shadow-xs cursor-pointer"
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
                    Compartir con alguien externo mediante enlace
                  </p>
                  <p className="text-[11px] text-[var(--app-text-secondary)]">
                    Cualquier persona con este enlace podrá abrir este documento sin pertenecer al equipo
                  </p>
                </div>
              </div>
              <button
                onClick={handleTogglePublic}
                className="w-9 h-5 rounded-full p-0.5 transition-colors relative cursor-pointer"
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
              <div className="flex items-center justify-between p-2.5 rounded-lg border border-[var(--app-border)] bg-[var(--app-bg-secondary)] animate-in fade-in">
                <span className="text-[11px] text-[var(--app-text-secondary)]">
                  Acceso para visitantes externos sin cuenta
                </span>
                <span className="px-2 py-0.5 rounded-md border border-[var(--app-border)] bg-[var(--app-bg-primary)] text-[11px] font-medium text-[var(--app-text-primary)]">
                  Solo lectura
                </span>
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
                onClick={() => exportDocumentAsMarkdown(workspace)}
                className="flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-md border border-[var(--app-border)] bg-[var(--app-bg-secondary)] hover:bg-[var(--app-hover)] text-[var(--app-text-primary)] font-medium transition cursor-pointer"
              >
                <CodeIcon style={{ width: 14, height: 14 }} />
                <span>Markdown (.md)</span>
              </button>

              <button
                onClick={handleCopyMarkdown}
                className="flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-md border border-[var(--app-border)] bg-[var(--app-bg-secondary)] hover:bg-[var(--app-hover)] text-[var(--app-text-primary)] font-medium transition cursor-pointer"
              >
                {copiedMd ? (
                  <DoneIcon style={{ width: 14, height: 14, color: '#10b981' }} />
                ) : (
                  <CopyIcon style={{ width: 14, height: 14 }} />
                )}
                <span>{copiedMd ? '¡Copiado!' : 'Copiar MD'}</span>
              </button>

              <button
                onClick={() => exportDocumentAsHtml(workspace)}
                className="flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-md border border-[var(--app-border)] bg-[var(--app-bg-secondary)] hover:bg-[var(--app-hover)] text-[var(--app-text-primary)] font-medium transition cursor-pointer"
              >
                <PageIcon style={{ width: 14, height: 14 }} />
                <span>Página (.html)</span>
              </button>

              <button
                onClick={printDocument}
                className="flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-md border border-[var(--app-border)] bg-[var(--app-bg-secondary)] hover:bg-[var(--app-hover)] text-[var(--app-text-primary)] font-medium transition cursor-pointer"
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
