import { memo, useState } from 'react'
import { Handle, Position } from '@xyflow/react'
import { FileText, Download, Trash2, Film, Music } from 'lucide-react'
import { db } from '../../../db'
import { syncEngine } from '../../../lib/syncEngine'
import { toast } from 'sonner'
import { areNodePropsEqual } from './nodeUtils'

export const FileNode = memo(({ id, data, selected }: any) => {
  const [fileName, setFileName] = useState(data.fileName || data.title || 'Documento.doc')
  const [fileSize] = useState(data.fileSize || data.fileWords || '12 KB')
  const [fileType] = useState<'doc' | 'ai' | 'pdf' | 'video' | 'audio' | 'txt'>(data.fileType || 'doc')
  const [isEditing, setIsEditing] = useState(false)

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
      console.error('Error saving file node', e)
    }
  }

  const handleDelete = async () => {
    try {
      await db.canvasNodes.update(id, { isDeleted: true, updatedAt: Date.now(), syncStatus: 'pending' })
      syncEngine.scheduleSync(1000)
      toast.info('Archivo eliminado del lienzo')
    } catch (e) {
      console.error('Error deleting file node', e)
    }
  }

  const handleDownload = () => {
    toast.success(`Descargando ${fileName} (${fileSize})`)
  }

  // Render file icon based on Milanote visual design
  const renderIcon = () => {
    if (fileType === 'ai') {
      return (
        <div className="w-14 h-16 rounded-xl bg-gradient-to-b from-neutral-800 to-neutral-900 border border-neutral-700/80 flex flex-col items-center justify-center shadow-md select-none group-hover:scale-105 transition-transform">
          <span className="text-amber-500 font-bold text-xl tracking-wider font-mono">Ai</span>
        </div>
      )
    }
    if (fileType === 'doc') {
      return (
        <div className="w-14 h-16 rounded-xl bg-white dark:bg-neutral-800 border-2 border-neutral-200 dark:border-neutral-700 flex flex-col items-center justify-center shadow-md select-none group-hover:scale-105 transition-transform relative overflow-hidden">
          <div className="absolute top-0 right-0 w-4 h-4 bg-neutral-100 dark:bg-neutral-700 border-l border-b border-neutral-200 dark:border-neutral-600 rounded-bl" />
          <span className="text-[#2b579a] dark:text-[#4b82d4] font-extrabold text-2xl font-serif">W</span>
        </div>
      )
    }
    if (fileType === 'pdf') {
      return (
        <div className="w-14 h-16 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 flex flex-col items-center justify-center shadow-md select-none group-hover:scale-105 transition-transform">
          <span className="text-rose-600 font-bold text-sm tracking-wider">PDF</span>
        </div>
      )
    }
    if (fileType === 'video') {
      return (
        <div className="w-14 h-16 rounded-xl bg-neutral-800 border border-neutral-700 flex flex-col items-center justify-center shadow-md select-none group-hover:scale-105 transition-transform">
          <Film className="w-7 h-7 text-sky-400" />
        </div>
      )
    }
    if (fileType === 'audio') {
      return (
        <div className="w-14 h-16 rounded-xl bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800 flex flex-col items-center justify-center shadow-md select-none group-hover:scale-105 transition-transform">
          <Music className="w-7 h-7 text-indigo-500" />
        </div>
      )
    }
    // Default text document
    return (
      <div className="w-14 h-16 rounded-xl bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 flex flex-col items-center justify-center shadow-md select-none group-hover:scale-105 transition-transform relative overflow-hidden p-2">
        <FileText className="w-7 h-7 text-neutral-500 dark:text-neutral-400" />
      </div>
    )
  }

  return (
    <div
      className={`group relative flex flex-col items-center justify-center p-3 rounded-2xl transition-[box-shadow,background-color] duration-150 cursor-pointer ${
        selected ? 'ring-2 ring-[var(--app-accent)] shadow-lg' : ''
      }`}
      style={{
        minWidth: 140,
        maxWidth: 200
      }}
    >
      {/* Handles */}
      <Handle id="top" type="source" position={Position.Top} className="!w-2.5 !h-2.5 !bg-[var(--app-accent)] !border !border-white dark:!border-zinc-800" />
      <Handle id="bottom" type="source" position={Position.Bottom} className="!w-2.5 !h-2.5 !bg-[var(--app-accent)] !border !border-white dark:!border-zinc-800" />
      <Handle id="left" type="source" position={Position.Left} className="!w-2.5 !h-2.5 !bg-[var(--app-accent)] !border !border-white dark:!border-zinc-800" />
      <Handle id="right" type="source" position={Position.Right} className="!w-2.5 !h-2.5 !bg-[var(--app-accent)] !border !border-white dark:!border-zinc-800" />

      {/* Floating delete button on hover */}
      <button
        onClick={handleDelete}
        className="absolute -top-2 -right-2 p-1.5 rounded-full bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 text-neutral-400 hover:text-rose-500 shadow-sm opacity-0 group-hover:opacity-100 transition z-10"
        title="Eliminar archivo"
      >
        <Trash2 className="w-3.5 h-3.5" />
      </button>

      {/* Icon Area */}
      <div onClick={handleDownload} className="mb-2">
        {renderIcon()}
      </div>

      {/* Title & Metadata */}
      <div className="w-full text-center flex flex-col items-center">
        {isEditing ? (
          <input
            type="text"
            value={fileName}
            autoFocus
            onChange={(e) => {
              setFileName(e.target.value)
              save({ fileName: e.target.value })
            }}
            onBlur={() => setIsEditing(false)}
            onKeyDown={(e) => e.key === 'Enter' && setIsEditing(false)}
            className="text-xs font-semibold text-center bg-white dark:bg-neutral-800 border border-blue-500 rounded px-1.5 py-0.5 outline-none w-full text-neutral-800 dark:text-neutral-100"
          />
        ) : (
          <span
            onDoubleClick={() => setIsEditing(true)}
            className="text-xs font-semibold text-neutral-900 dark:text-neutral-100 hover:underline leading-tight line-clamp-2 max-w-[160px] select-none"
            title="Doble clic para editar nombre"
          >
            {fileName}
          </span>
        )}

        <span className="text-[11px] text-neutral-500 dark:text-neutral-400 mt-0.5 select-none font-medium">
          {fileSize}
        </span>
      </div>

      {/* Quick download pill on hover */}
      <button
        onClick={handleDownload}
        className="mt-1.5 inline-flex items-center gap-1 text-[10px] font-medium text-neutral-600 dark:text-neutral-300 hover:text-blue-500 px-2 py-0.5 rounded-full bg-neutral-100 dark:bg-neutral-800/80 hover:bg-neutral-200 dark:hover:bg-neutral-700 transition opacity-0 group-hover:opacity-100"
      >
        <Download className="w-3 h-3" />
        <span>Descargar</span>
      </button>
    </div>
  )
}, areNodePropsEqual)
