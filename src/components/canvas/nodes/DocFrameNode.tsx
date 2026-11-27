import { memo, useState, useEffect, useRef } from 'react'
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
import { areNodePropsEqual, NodeHandles, SourceNodeBadge } from './nodeUtils'
import { renderWithAppleEmoji } from '../../ui/AppleEmoji'
import { renderNoteIcon } from '../../editor/NoteIconPickerModal'

export const DocFrameNode = memo(({ id, data, selected }: any) => {
  const [title, setTitle] = useState(data.title === 'Untitled' ? '' : data.title || '')
  const [isExpanded, setIsExpanded] = useState(data.isExpanded ?? false)
  const [showInfo, setShowInfo] = useState(false)
  const [copied, setCopied] = useState(false)
  const titleTextareaRef = useRef<HTMLTextAreaElement>(null)
  const isTitleFocusedRef = useRef(false)
  const titleSaveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pendingTitleRef = useRef<string | null>(null)
  const dataRef = useRef(data)
  dataRef.current = data

  useEffect(() => {
    if (!isTitleFocusedRef.current && pendingTitleRef.current === null) {
      setTitle(data.title === 'Untitled' ? '' : data.title || '')
    }
  }, [data.title])

  const flushTitleSave = async () => {
    if (titleSaveTimeoutRef.current) {
      clearTimeout(titleSaveTimeoutRef.current)
      titleSaveTimeoutRef.current = null
    }
    const nextTitle = pendingTitleRef.current
    if (nextTitle === null) return
    pendingTitleRef.current = null
    const latestData = dataRef.current
    try {
      await db.canvasNodes.update(id, {
        data: { ...latestData, title: nextTitle || 'Untitled' },
        updatedAt: Date.now(),
        syncStatus: 'pending'
      })
      if (latestData.workspaceId) {
        await db.workspaces.update(latestData.workspaceId, {
          title: nextTitle || 'Untitled',
          updatedAt: Date.now(),
          syncStatus: 'pending'
        })
      }
      syncEngine.scheduleSync(1500)
    } catch (e) {
      console.error('Error updating title from doc card', e)
    }
  }

  useEffect(() => {
    return () => {
      void flushTitleSave()
    }
  }, [id])

  const handleTitleChange = (newTitle: string) => {
    setTitle(newTitle)
    pendingTitleRef.current = newTitle
    if (titleSaveTimeoutRef.current) {
      clearTimeout(titleSaveTimeoutRef.current)
    }
    titleSaveTimeoutRef.current = setTimeout(() => {
      void flushTitleSave()
    }, 350)
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
  const isConnectorActive = Boolean(data?.isConnectorActive)
  const isConnectSource = Boolean(data?.isConnectSource)

  return (
    <div
      className={`group relative w-[340px] rounded-xl bg-white dark:bg-[#18181b] transition-all duration-200 select-none shadow-md hover:shadow-xl ${
        selected ? 'ring-2 ring-[var(--app-accent)] shadow-2xl' : ''
      } ${
        isConnectSource
          ? 'ring-4 ring-amber-500 shadow-2xl scale-[1.02]'
          : isConnectorActive
          ? 'ring-2 ring-blue-500/50 hover:ring-2 hover:ring-blue-500 cursor-pointer'
          : ''
      }`}
    >
      <SourceNodeBadge isConnectSource={isConnectSource} isConnectorActive={isConnectorActive} />
      <NodeHandles
        selected={selected}
        isConnectorActive={isConnectorActive}
        isConnectSource={isConnectSource}
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
              {data.icon ? (
                <span className="shrink-0">{renderNoteIcon(data.icon, 14)}</span>
              ) : (
                <PageIcon className="w-3.5 h-3.5 text-[#1e96eb] shrink-0" />
              )}
              <span className="font-semibold text-xs text-[var(--affine-text-primary-color)] truncate">
                {renderWithAppleEmoji(title || 'Untitled')}
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
            {copied ? <DoneIcon className="w-3.5 h-3.5 text-emerald-500" /> : <LinkIcon className="w-3.5 h-3.5 text-neutral-400" />}
          </button>
        </div>
      </div>

      {/* Mini Cover Banner if note has cover */}
      {isExpanded && data.hasCover && (
        <div
          className="w-full h-18 overflow-hidden flex flex-col items-center justify-center border-b border-black/5 dark:border-white/5 select-none"
          style={{ backgroundColor: data.coverColor || '#ffffff' }}
        >
          {data.coverType === 'bannerText' ? (
            <div className="flex flex-col items-center justify-center pointer-events-none">
              <span
                className="font-serif italic tracking-[0.2em] text-[11px] uppercase font-light leading-tight"
                style={{ color: data.coverColor === '#18181b' ? '#f4f4f5' : '#18181b' }}
              >
                {data.coverBannerTitle || 'PROJECTS &'}
              </span>
              <span
                className="font-serif italic tracking-[0.2em] text-[11px] uppercase font-light leading-tight mt-0.5"
                style={{ color: data.coverColor === '#18181b' ? '#f4f4f5' : '#18181b' }}
              >
                {data.coverBannerSubtitle || 'SUB-PROJECTS'}
              </span>
            </div>
          ) : data.coverType === 'image' && data.coverUrl ? (
            <img src={data.coverUrl} alt="" className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full" style={{ background: data.coverColor || '#ffffff' }} />
          )}
        </div>
      )}

      {/* Card Body - Only shown if expanded */}
      {isExpanded && (
        <div className={`px-4 pb-3 min-h-[90px] flex flex-col justify-start ${data.hasCover ? 'pt-0' : 'pt-3'}`}>
          {/* Overlapping Icon Squircle */}
          {(data.icon || data.hasCover) && (
            <div className={`mb-1.5 ${data.hasCover ? '-mt-5 relative z-10' : ''}`}>
              <div className="w-10 h-10 rounded-xl bg-white text-neutral-900 border border-neutral-200/90 shadow-md flex items-center justify-center">
                {renderNoteIcon(data.icon || 'folder', 20)}
              </div>
            </div>
          )}
          <div className="grid">
            <div
              aria-hidden="true"
              className="col-start-1 row-start-1 min-w-0 w-full p-0 invisible pointer-events-none select-none text-xl font-bold tracking-tight leading-snug break-words whitespace-pre-wrap min-h-[1.35em]"
            >
              {(title || 'Título...') + ' '}
            </div>
            <textarea
              ref={titleTextareaRef}
              rows={1}
              value={title}
              onFocus={() => {
                isTitleFocusedRef.current = true
              }}
              onBlur={() => {
                isTitleFocusedRef.current = false
                void flushTitleSave()
              }}
              onChange={(e) => {
                handleTitleChange(e.target.value)
              }}
              placeholder="Título..."
              className="col-start-1 row-start-1 min-w-0 w-full h-full p-0 text-xl font-bold tracking-tight text-[var(--affine-text-primary-color)] placeholder:text-[var(--affine-placeholder-color)] bg-transparent border-none outline-none focus:outline-none resize-none overflow-hidden leading-snug break-words whitespace-pre-wrap block"
            />
          </div>

          {/* Preview of page text */}
          <div className="mt-2.5 text-xs text-[var(--affine-text-secondary-color)] leading-relaxed border-t border-[var(--affine-divider-color)] pt-2 max-h-36 overflow-y-auto font-sans">
            {cleanContent ? (
              <p>{renderWithAppleEmoji(cleanContent)}</p>
            ) : (
              <p className="italic text-[var(--affine-placeholder-color)] text-[11px]">Nota vacía. Escribe arriba o abre el modo documento.</p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}, areNodePropsEqual)
