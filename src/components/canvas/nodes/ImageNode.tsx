import { memo, useState, useRef } from 'react'
import { Handle, Position } from '@xyflow/react'
import { Trash2, Upload, Image as ImageIcon } from 'lucide-react'
import { db } from '../../../db'
import { syncEngine } from '../../../lib/syncEngine'

export const ImageNode = memo(({ id, data, selected }: any) => {
  const [imageUrl, setImageUrl] = useState<string | null>(data.imageUrl ?? null)
  const [caption, setCaption] = useState(data.caption ?? '')
  const fileInputRef = useRef<HTMLInputElement>(null)

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
      console.error('Error saving image node', e)
    }
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = async () => {
      const base64 = reader.result as string
      setImageUrl(base64)
      save({ imageUrl: base64 })
    }
    reader.readAsDataURL(file)
  }

  const handleDelete = async () => {
    try {
      await db.canvasNodes.update(id, { isDeleted: true, updatedAt: Date.now(), syncStatus: 'pending' })
      syncEngine.scheduleSync(1000)
    } catch (e) {
      console.error('Error deleting image node', e)
    }
  }

  return (
    <div
      className={`relative w-[280px] rounded-xl shadow-md transition-all duration-150 border-2 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 ${
        selected ? 'ring-2 ring-indigo-500 ring-offset-2 dark:ring-offset-slate-950 shadow-xl' : 'hover:shadow-lg'
      }`}
    >
      <Handle type="target" position={Position.Top} className="!w-3 !h-3 !bg-indigo-500 !border-2 !border-white dark:!border-slate-900" />
      <Handle type="source" position={Position.Bottom} className="!w-3 !h-3 !bg-indigo-500 !border-2 !border-white dark:!border-slate-900" />
      <Handle type="target" position={Position.Left} className="!w-3 !h-3 !bg-indigo-500 !border-2 !border-white dark:!border-slate-900" />
      <Handle type="source" position={Position.Right} className="!w-3 !h-3 !bg-indigo-500 !border-2 !border-white dark:!border-slate-900" />

      {/* Header bar */}
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-slate-100 dark:border-slate-800">
        <div className="flex items-center gap-1.5 text-xs font-medium text-slate-500 dark:text-slate-400">
          <ImageIcon size={13} />
          <span>Imagen</span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => fileInputRef.current?.click()}
            className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400"
            title="Subir imagen"
          >
            <Upload size={13} />
          </button>
          <button
            onClick={handleDelete}
            className="p-1 rounded hover:bg-rose-500/20 text-slate-500 hover:text-rose-600 transition"
            title="Eliminar tarjeta"
          >
            <Trash2 size={13} />
          </button>
        </div>
      </div>

      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        accept="image/*"
        className="hidden"
      />

      {/* Image body */}
      <div className="p-2">
        {imageUrl ? (
          <div className="relative rounded-lg overflow-hidden max-h-[220px] bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
            <img src={imageUrl} alt="Subida" className="w-full h-auto object-cover rounded-md" />
          </div>
        ) : (
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="w-full py-10 rounded-lg border-2 border-dashed border-slate-300 dark:border-slate-700 hover:border-indigo-500 flex flex-col items-center justify-center gap-2 text-slate-400 hover:text-indigo-500 transition"
          >
            <Upload size={24} />
            <span className="text-xs font-medium">Subir imagen offline</span>
          </button>
        )}

        <input
          type="text"
          value={caption}
          onChange={(e) => {
            setCaption(e.target.value)
            save({ caption: e.target.value })
          }}
          placeholder="Añadir pie de foto..."
          className="mt-2 w-full text-xs text-center bg-transparent border-none outline-none text-slate-500 dark:text-slate-400 placeholder-slate-400"
        />
      </div>
    </div>
  )
})
