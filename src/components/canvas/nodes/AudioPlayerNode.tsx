import { memo, useState, useRef, useEffect } from 'react'
import { Handle, Position } from '@xyflow/react'
import { Play, Pause, Volume2, Music, Download, Trash2 } from 'lucide-react'
import { db } from '../../../db'
import { syncEngine } from '../../../lib/syncEngine'
import { toast } from 'sonner'
import { areNodePropsEqual } from './nodeUtils'

export const AudioPlayerNode = memo(({ id, data, selected }: any) => {
  const [title, setTitle] = useState(data.title || 'Entrevistas de diseño')
  const [subtitle, setSubtitle] = useState(data.subtitle || '1 tarjeta, 1 archivo')
  const [audioFilename] = useState(data.audioFilename || 'Entrevista a Søren Vagner.mp3')
  const [fileDetails] = useState(data.fileDetails || 'Descargar • 1.0 MB')
  const [imageUrl] = useState(data.imageUrl || 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&auto=format&fit=crop&q=80')
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration] = useState(81) // 1:21 in seconds

  const intervalRef = useRef<any>(null)

  useEffect(() => {
    if (isPlaying) {
      intervalRef.current = setInterval(() => {
        setCurrentTime((t) => {
          if (t >= duration) {
            setIsPlaying(false)
            return 0
          }
          return t + 1
        })
      }, 1000)
    } else {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [isPlaying, duration])

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60)
    const s = Math.floor(secs % 60)
    return `${m}:${s < 10 ? '0' : ''}${s}`
  }

  const togglePlay = () => {
    setIsPlaying(!isPlaying)
  }

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
      console.error('Error saving audio node', e)
    }
  }

  const handleDelete = async () => {
    try {
      await db.canvasNodes.update(id, { isDeleted: true, updatedAt: Date.now(), syncStatus: 'pending' })
      syncEngine.scheduleSync(1000)
    } catch (e) {
      console.error('Error deleting audio node', e)
    }
  }

  return (
    <div
      className={`group relative w-[320px] rounded-xl bg-white dark:bg-[#252525] border border-neutral-200/90 dark:border-neutral-700/80 transition-[box-shadow,border-color] duration-150 overflow-hidden ${
        selected ? 'ring-2 ring-[var(--app-accent)] shadow-xl' : 'shadow-[0_2px_10px_rgba(0,0,0,0.06)] dark:shadow-[0_4px_16px_rgba(0,0,0,0.4)]'
      }`}
    >
      {/* Handles */}
      <Handle id="top" type="source" position={Position.Top} className="!w-2.5 !h-2.5 !bg-[var(--app-accent)] !border !border-white dark:!border-zinc-800" />
      <Handle id="bottom" type="source" position={Position.Bottom} className="!w-2.5 !h-2.5 !bg-[var(--app-accent)] !border !border-white dark:!border-zinc-800" />
      <Handle id="left" type="source" position={Position.Left} className="!w-2.5 !h-2.5 !bg-[var(--app-accent)] !border !border-white dark:!border-zinc-800" />
      <Handle id="right" type="source" position={Position.Right} className="!w-2.5 !h-2.5 !bg-[var(--app-accent)] !border !border-white dark:!border-zinc-800" />

      {/* Delete button */}
      <button
        onClick={handleDelete}
        className="absolute top-2 right-2 p-1.5 rounded-full bg-white/80 dark:bg-neutral-800/80 hover:bg-white dark:hover:bg-neutral-700 text-neutral-400 hover:text-rose-500 shadow-sm opacity-0 group-hover:opacity-100 transition z-20 backdrop-blur-xs"
        title="Eliminar tarjeta de audio"
      >
        <Trash2 className="w-3.5 h-3.5" />
      </button>

      {/* Card Header */}
      <div className="p-3 pb-2 text-center">
        <input
          type="text"
          value={title}
          onChange={(e) => {
            setTitle(e.target.value)
            save({ title: e.target.value })
          }}
          className="font-serif font-bold text-base text-center bg-transparent border-none outline-none w-full text-neutral-900 dark:text-neutral-100"
        />
        <input
          type="text"
          value={subtitle}
          onChange={(e) => {
            setSubtitle(e.target.value)
            save({ subtitle: e.target.value })
          }}
          className="text-[11px] text-center text-neutral-400 dark:text-neutral-500 bg-transparent border-none outline-none w-full -mt-0.5"
        />
      </div>

      {/* Photo / Media Box */}
      {imageUrl && (
        <div className="px-3 pb-2">
          <div className="w-full h-44 rounded-lg overflow-hidden bg-neutral-100 dark:bg-neutral-800 relative group/img">
            <img
              src={imageUrl}
              alt={title}
              className="w-full h-full object-cover grayscale contrast-110"
            />
          </div>
        </div>
      )}

      {/* Audio Player Controls */}
      <div className="px-3.5 py-2.5 bg-neutral-50/70 dark:bg-neutral-800/40 border-t border-neutral-100 dark:border-neutral-800 flex items-center gap-2.5">
        <button
          onClick={togglePlay}
          className="w-8 h-8 rounded-full bg-neutral-700 hover:bg-neutral-800 dark:bg-neutral-600 dark:hover:bg-neutral-500 text-white flex items-center justify-center shrink-0 shadow-sm transition active:scale-95"
        >
          {isPlaying ? <Pause className="w-4 h-4 fill-current" /> : <Play className="w-4 h-4 fill-current ml-0.5" />}
        </button>

        <Volume2 className="w-4 h-4 text-neutral-400 shrink-0" />

        {/* Timeline slider */}
        <div className="flex-1 flex flex-col justify-center gap-1">
          <div
            className="w-full h-1.5 bg-neutral-200 dark:bg-neutral-700 rounded-full cursor-pointer overflow-hidden"
            onClick={(e) => {
              const rect = e.currentTarget.getBoundingClientRect()
              const pos = (e.clientX - rect.left) / rect.width
              setCurrentTime(pos * duration)
            }}
          >
            <div
              className="h-full bg-neutral-600 dark:bg-neutral-400 rounded-full"
              style={{ width: `${(currentTime / duration) * 100}%` }}
            />
          </div>
        </div>

        <span className="text-[10px] font-mono text-neutral-500 dark:text-neutral-400 shrink-0">
          {formatTime(currentTime)} / {formatTime(duration)}
        </span>
      </div>

      {/* Download file attachment row */}
      <div
        onClick={() => toast.success(`Descargando ${audioFilename}`)}
        className="px-3 py-2 border-t border-neutral-100 dark:border-neutral-800/80 flex items-center gap-2.5 hover:bg-neutral-50 dark:hover:bg-neutral-800/60 cursor-pointer transition select-none"
      >
        <div className="w-6 h-6 rounded-md bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900 flex items-center justify-center shrink-0 text-blue-500">
          <Music className="w-3.5 h-3.5" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium text-neutral-800 dark:text-neutral-200 truncate leading-snug">
            {audioFilename}
          </p>
          <p className="text-[10px] text-neutral-400">
            {fileDetails}
          </p>
        </div>
        <Download className="w-3.5 h-3.5 text-neutral-400 hover:text-blue-500 shrink-0" />
      </div>
    </div>
  )
}, areNodePropsEqual)
