import { memo, useState, useEffect } from 'react'
import { Handle, Position } from '@xyflow/react'
import {
  ToggleDownIcon,
  ExpandFullIcon,
  InfoIcon,
  LinkIcon,
  DoneIcon,
  PageIcon
} from '@blocksuite/icons/rc'
import { db } from '../../../db'
import { syncEngine } from '../../../lib/syncEngine'
import { areNodePropsEqual } from './nodeUtils'

export const DocFrameNode = memo(({ id, data, selected }: any) => {
  const [title, setTitle] = useState(data.title || '')
  const [isExpanded, setIsExpanded] = useState(data.isExpanded ?? false)
  const [showInfo, setShowInfo] = useState(false)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    setTitle(data.title || '')
  }, [data.title])

  const handleTitleChange = async (newTitle: string) => {
    setTitle(newTitle)
    try {
      // Update canvas node data
      await db.canvasNodes.update(id, {
        data: { ...data, title: newTitle },
        updatedAt: Date.now(),
        syncStatus: 'pending'
      })

      // Also update workspace title if this node represents the current workspace
      if (data.workspaceId) {
        await db.workspaces.update(data.workspaceId, {
          title: newTitle || 'Untitled',
          updatedAt: Date.now(),
          syncStatus: 'pending'
        })
      }
      syncEngine.scheduleSync(1500)
    } catch (e) {
      console.error('Error updating title from doc card', e)
    }
  }

  const handleOpenDoc = () => {
    if (data.onOpenDoc) {
      data.onOpenDoc(data.workspaceId)
    } else {
      window.dispatchEvent(
        new CustomEvent('seven-note-switch-mode', {
          detail: { mode: 'doc', workspaceId: data.workspaceId }
        })
      )
    }
  }

  const handleCopyLink = () => {
    const url = `${window.location.origin}/#note=${data.workspaceId || id}`
    navigator.clipboard.writeText(url)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  // Strip HTML for clean preview text
  const cleanContent = data.content
    ? data.content.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()
    : ''

  return (
    <div
      className={`relative w-[340px] rounded-lg bg-[var(--app-bg-primary)] border border-[var(--app-border)] transition-[box-shadow,border-color] duration-150 select-none ${
        selected ? 'ring-1.5 ring-[var(--app-accent)] shadow-[var(--app-shadow-card-hover)]' : 'shadow-[var(--app-shadow-card)] hover:border-[var(--app-border-strong)]'
      }`}
    >
      {/* Connector Handles */}
      <Handle
        id="top"
        type="source"
        position={Position.Top}
        className="!w-2.5 !h-2.5 !bg-[var(--app-accent)] !border !border-white dark:!border-zinc-800"
      />
      <Handle
        id="bottom"
        type="source"
        position={Position.Bottom}
        className="!w-2.5 !h-2.5 !bg-[var(--app-accent)] !border !border-white dark:!border-zinc-800"
      />
      <Handle
        id="left"
        type="source"
        position={Position.Left}
        className="!w-2.5 !h-2.5 !bg-[var(--app-accent)] !border !border-white dark:!border-zinc-800"
      />
      <Handle
        id="right"
        type="source"
        position={Position.Right}
        className="!w-2.5 !h-2.5 !bg-[var(--app-accent)] !border !border-white dark:!border-zinc-800"
      />

      {/* Top Header of the Card (Authentic AFFiNE edgeless-note-header) */}
      <div className="flex items-center justify-between px-2.5 py-1.5 text-[var(--affine-text-secondary-color)] border-b border-[var(--affine-border-color)]/30">
        {/* Left: Caret Toggle & Collapsed Title */}
        <div className="flex items-center gap-1.5 min-w-0 flex-1">
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-1 rounded-md hover:bg-[var(--affine-hover-color)] hover:text-[var(--affine-text-primary-color)] transition shrink-0"
            title={isExpanded ? 'Contraer nota' : 'Expandir nota'}
          >
            <ToggleDownIcon
              className={`w-3.5 h-3.5 transition-transform duration-200 ${!isExpanded ? '-rotate-90' : 'rotate-0'}`}
            />
          </button>

          {/* When collapsed, render emoji & title in header like AFFiNE */}
          {!isExpanded && (
            <div className="flex items-center gap-1.5 min-w-0 flex-1 pr-2">
              <PageIcon className="w-3.5 h-3.5 text-[#1e96eb] shrink-0" />
              <span className="font-semibold text-xs text-[var(--affine-text-primary-color)] truncate">
                {title || 'Untitled'}
              </span>
            </div>
          )}
        </div>

        {/* Right: Expand / Open in Doc, Info, Link */}
        <div className="flex items-center gap-0.5 relative shrink-0">
          {/* Maximize to full doc editor */}
          <button
            onClick={handleOpenDoc}
            className="p-1 rounded-md hover:bg-[var(--affine-hover-color)] hover:text-[var(--affine-text-primary-color)] transition"
            title="Abrir en Modo Página"
          >
            <ExpandFullIcon className="w-3.5 h-3.5" />
          </button>

          {/* Info popover */}
          <button
            onClick={() => setShowInfo(!showInfo)}
            className="p-1 rounded-md hover:bg-[var(--affine-hover-color)] hover:text-[var(--affine-text-primary-color)] transition"
            title="Información de la nota"
          >
            <InfoIcon className="w-3.5 h-3.5" />
          </button>

          {showInfo && (
            <div
              className="absolute right-0 top-7 z-30 w-52 bg-[var(--affine-background-overlay-panel-color)] border border-[var(--affine-border-color)] rounded-xl shadow-[var(--affine-popover-shadow)] p-3 text-[11px] text-[var(--affine-text-secondary-color)] backdrop-blur-md"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center gap-1.5 font-semibold text-[var(--affine-text-primary-color)] pb-1.5 border-b border-[var(--affine-divider-color)] mb-1.5">
                <PageIcon className="w-4 h-4 text-[#1e96eb]" />
                <span>Tarjeta de Página</span>
              </div>
              <p>
                Esta tarjeta está sincronizada en tiempo real con el documento principal.
              </p>
            </div>
          )}

          {/* Copy Link */}
          <button
            onClick={handleCopyLink}
            className="p-1 rounded-md hover:bg-[var(--affine-hover-color)] hover:text-[var(--affine-text-primary-color)] transition"
            title={copied ? '¡Enlace copiado!' : 'Copiar enlace a nota'}
          >
            {copied ? <DoneIcon className="w-3.5 h-3.5 text-emerald-500" /> : <LinkIcon className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {/* Card Body - Only shown if expanded */}
      {isExpanded && (
        <div className="px-4 py-3 min-h-[90px] flex flex-col justify-start">
          <input
            type="text"
            value={title === 'Untitled' ? '' : title}
            onChange={(e) => handleTitleChange(e.target.value)}
            placeholder="Título..."
            className="text-xl font-bold tracking-tight text-[var(--affine-text-primary-color)] placeholder:text-[var(--affine-placeholder-color)] bg-transparent border-none outline-none focus:outline-none w-full"
          />

          {/* Preview of page text */}
          <div className="mt-2.5 text-xs text-[var(--affine-text-secondary-color)] leading-relaxed border-t border-[var(--affine-divider-color)] pt-2 max-h-36 overflow-y-auto font-sans">
            {cleanContent ? (
              <p>{cleanContent}</p>
            ) : (
              <p className="italic text-[var(--affine-placeholder-color)] text-[11px]">Nota vacía. Escribe arriba o abre el modo documento.</p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}, areNodePropsEqual)
