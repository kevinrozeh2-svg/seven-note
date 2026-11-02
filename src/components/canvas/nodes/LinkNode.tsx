import { memo, useState } from 'react'
import { ExternalLink, Trash2, Play, Globe } from 'lucide-react'
import { db } from '../../../db'
import { syncEngine } from '../../../lib/syncEngine'
import { areNodePropsEqual, NodeHandles, SourceNodeBadge, getCardCustomStyle, isColorDark, CardSelectionOverlay } from './nodeUtils'

export const LinkNode = memo(({ id, data, selected }: any) => {
  const [title, setTitle] = useState(data.title ?? 'Designmuseum Denmark')
  const [url] = useState(data.url ?? 'https://designmuseum.dk/en/')
  const [description] = useState(data.description ?? '')
  const [imageUrl] = useState(data.imageUrl ?? '')
  const [hasImageError, setHasImageError] = useState(false)
  const [isVideo] = useState(data.isVideo ?? (url.includes('youtube') || url.includes('youtu.be')))

  const save = async (updates: any) => {
    try {
      const node = await db.canvasNodes.get(id)
      if (node) {
        await db.canvasNodes.update(id, {
          data: { ...node.data, ...updates },
          updatedAt: Date.now(),
          syncStatus: 'pending'
        })
        syncEngine.scheduleSync(1500)
      }
    } catch (e) {
      console.error('Error saving link node', e)
    }
  }

  const handleDelete = async () => {
    try {
      await db.canvasNodes.update(id, { isDeleted: true, updatedAt: Date.now(), syncStatus: 'pending' })
      syncEngine.scheduleSync(1000)
    } catch (e) {
      console.error('Error deleting link node', e)
    }
  }

  const isYouTube = url.includes('youtube') || url.includes('youtu.be')
  const isConnectorActive = Boolean(data?.isConnectorActive)
  const isConnectSource = Boolean(data?.isConnectSource)
  const customCardStyle = getCardCustomStyle(data, 12)
  const isDarkFill = isColorDark(data?.fillColor)

  return (
    <div
      className={`group relative rounded-xl bg-white dark:bg-[#252525] transition-[box-shadow] duration-150 overflow-visible ${
        selected ? 'shadow-xl' : 'shadow-[0_2px_8px_rgba(0,0,0,0.06)] dark:shadow-[0_4px_16px_rgba(0,0,0,0.35)]'
      } ${
        isConnectSource
          ? 'ring-4 ring-amber-500 shadow-2xl scale-[1.02]'
          : isConnectorActive
          ? 'ring-2 ring-blue-500/50 hover:ring-2 hover:ring-blue-500 cursor-pointer'
          : ''
      } ${isDarkFill ? 'text-zinc-100' : ''}`}
      style={{ width: data.width || 280, ...customCardStyle }}
    >
      <CardSelectionOverlay selected={selected} />
      <SourceNodeBadge isConnectSource={isConnectSource} isConnectorActive={isConnectorActive} />
      <NodeHandles
        selected={selected}
        isConnectorActive={isConnectorActive}
        isConnectSource={isConnectSource}
      />

      {/* Floating delete button */}
      <button
        onClick={handleDelete}
        className="absolute top-2 right-2 p-1.5 rounded-full bg-white/80 dark:bg-neutral-800/80 hover:bg-white text-neutral-400 hover:text-rose-500 shadow-sm opacity-0 group-hover:opacity-100 transition z-20 backdrop-blur-xs"
        title="Eliminar enlace"
      >
        <Trash2 className="w-3.5 h-3.5" />
      </button>

      {/* Media / Image Thumbnail Banner */}
      {imageUrl && !hasImageError && (
        <div className="relative w-full h-36 bg-neutral-100 dark:bg-neutral-800 overflow-hidden">
          <img
            src={imageUrl}
            alt={title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            onError={() => setHasImageError(true)}
          />
          {isVideo && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/20">
              <div className="w-10 h-10 rounded-full bg-neutral-900/80 hover:bg-neutral-900 text-white flex items-center justify-center shadow-lg transition transform group-hover:scale-110">
                <Play className="w-4 h-4 fill-current ml-0.5" />
              </div>
            </div>
          )}
        </div>
      )}

      {/* Content Details */}
      <div className="p-3">
        {/* Domain / Favicon */}
        <div className="flex items-center gap-1.5 mb-1.5">
          {isYouTube ? (
            <div className="w-4 h-3 rounded bg-red-600 flex items-center justify-center shrink-0">
              <Play className="w-2 h-2 text-white fill-current ml-0.5" />
            </div>
          ) : (
            <Globe className="w-3.5 h-3.5 text-neutral-400 shrink-0" />
          )}
          <span className="text-[10px] text-neutral-400 dark:text-neutral-500 truncate flex-1 font-mono">
            {url}
          </span>
          <a
            href={url.startsWith('http') ? url : `https://${url}`}
            target="_blank"
            rel="noreferrer"
            className="text-neutral-400 hover:text-neutral-800 dark:hover:text-neutral-200"
            title="Abrir en pestaña nueva"
          >
            <ExternalLink className="w-3 h-3" />
          </a>
        </div>

        {/* Title in bold red / orange Milanote style */}
        <input
          type="text"
          value={title}
          onChange={(e) => {
            setTitle(e.target.value)
            save({ title: e.target.value })
          }}
          className="font-bold text-xs leading-snug text-[#d4380d] dark:text-[#ff7a45] bg-transparent border-none outline-none w-full mb-1 hover:underline cursor-text"
        />

        {/* Description Snippet */}
        {description && (
          <p className="text-[11px] text-neutral-600 dark:text-neutral-400 line-clamp-2 leading-relaxed">
            {description}
          </p>
        )}
      </div>
    </div>
  )
}, areNodePropsEqual)
