import { memo, useState, useEffect } from 'react'
import { Handle, Position } from '@xyflow/react'
import {
  Maximize2,
  Info,
  Link,
  ChevronDown,
  Check,
  FileText,
  Clock
} from 'lucide-react'
import { db } from '../../../db'
import { syncEngine } from '../../../lib/syncEngine'

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
      className={`relative w-[340px] rounded-xl bg-[#1e1e21] border border-[#2b2b32] shadow-2xl transition-all duration-150 select-none ${
        selected ? 'ring-2 ring-blue-500/80 shadow-blue-500/10' : 'hover:border-[#3a3a44]'
      }`}
    >
      {/* Connector Handles */}
      <Handle
        type="target"
        position={Position.Top}
        className="!w-2.5 !h-2.5 !bg-blue-500 !border-2 !border-[#1e1e21]"
      />
      <Handle
        type="source"
        position={Position.Bottom}
        className="!w-2.5 !h-2.5 !bg-blue-500 !border-2 !border-[#1e1e21]"
      />
      <Handle
        type="target"
        position={Position.Left}
        className="!w-2.5 !h-2.5 !bg-blue-500 !border-2 !border-[#1e1e21]"
      />
      <Handle
        type="source"
        position={Position.Right}
        className="!w-2.5 !h-2.5 !bg-blue-500 !border-2 !border-[#1e1e21]"
      />

      {/* Top Header of the Card (Matches Screenshot: ▾ on left, ⤢ ⓘ 🔗 on right) */}
      <div className="flex items-center justify-between px-3.5 pt-3 pb-1 text-zinc-400">
        {/* Left: Caret */}
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="p-1 rounded hover:bg-[#28282e] hover:text-zinc-200 transition"
          title={isExpanded ? 'Contraer vista previa' : 'Expandir vista previa'}
        >
          <ChevronDown
            size={15}
            className={`transition-transform duration-150 ${isExpanded ? 'rotate-180' : ''}`}
          />
        </button>

        {/* Right: Expand / Open in Doc, Info, Link */}
        <div className="flex items-center gap-1.5 relative">
          {/* ⤢ Maximize to full doc editor */}
          <button
            onClick={handleOpenDoc}
            className="p-1 rounded hover:bg-[#28282e] hover:text-zinc-200 transition"
            title="Abrir en Modo Documento"
          >
            <Maximize2 size={13} />
          </button>

          {/* ⓘ Info popover */}
          <button
            onClick={() => setShowInfo(!showInfo)}
            className="p-1 rounded hover:bg-[#28282e] hover:text-zinc-200 transition"
            title="Información de la tarjeta"
          >
            <Info size={13} />
          </button>

          {showInfo && (
            <div
              className="absolute right-0 top-7 z-30 w-52 bg-[#18181b] border border-[#2d2d34] rounded-lg shadow-2xl p-2.5 text-[11px] text-zinc-300"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center gap-1.5 font-semibold text-zinc-100 pb-1.5 border-b border-[#26262c] mb-1.5">
                <FileText size={12} className="text-blue-400" />
                <span>Tarjeta de Página</span>
              </div>
              <p className="text-zinc-400">
                Esta tarjeta está sincronizada en tiempo real con el documento principal.
              </p>
              <div className="flex items-center gap-1 text-zinc-500 mt-2">
                <Clock size={10} />
                <span>Modo lienzo conectado</span>
              </div>
            </div>
          )}

          {/* 🔗 Copy Link */}
          <button
            onClick={handleCopyLink}
            className="p-1 rounded hover:bg-[#28282e] hover:text-zinc-200 transition"
            title={copied ? '¡Enlace copiado!' : 'Copiar enlace a nota'}
          >
            {copied ? <Check size={13} className="text-emerald-400" /> : <Link size={13} />}
          </button>
        </div>
      </div>

      {/* Card Body: Large Title Placeholder "Title" (Matches Screenshot) */}
      <div className="px-4 py-4 min-h-[110px] flex flex-col justify-start">
        <input
          type="text"
          value={title === 'Untitled' ? '' : title}
          onChange={(e) => handleTitleChange(e.target.value)}
          placeholder="Title"
          className="text-2xl font-bold tracking-tight text-zinc-100 placeholder:text-zinc-600 bg-transparent border-none outline-none focus:outline-none w-full"
        />

        {/* Optional preview of page text if expanded or available */}
        {isExpanded && (
          <div className="mt-3 text-xs text-zinc-400 leading-relaxed border-t border-[#26262c] pt-2 max-h-36 overflow-y-auto font-sans">
            {cleanContent ? (
              <p>{cleanContent}</p>
            ) : (
              <p className="italic text-zinc-600">Documento vacío. Haz clic en ⤢ para escribir.</p>
            )}
          </div>
        )}
      </div>
    </div>
  )
})
