import { memo, useState, useRef } from 'react'
import { Handle, Position, NodeResizer } from '@xyflow/react'
import { DeleteIcon, UploadIcon, ImageIcon, EditIcon, LinkIcon } from '@blocksuite/icons/rc'
import { db } from '../../../db'
import { syncEngine } from '../../../lib/syncEngine'
import { areNodePropsEqual } from './nodeUtils'

export const ImageNode = memo(({ id, data, selected }: any) => {
  const [imageUrl, setImageUrl] = useState<string | null>(data.imageUrl ?? null)
  const [caption, setCaption] = useState(data.caption ?? '')
  const [showUrlInput, setShowUrlInput] = useState(false)
  const [urlInput, setUrlInput] = useState('')
  const [width, setWidth] = useState<number>(data.width || 280)
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
      const newCaption = caption || file.name.replace(/\.[^/.]+$/, '')
      setCaption(newCaption)
      save({ imageUrl: base64, caption: newCaption })
    }
    reader.readAsDataURL(file)
    e.target.value = ''
  }

  const handleSaveUrl = () => {
    if (urlInput.trim()) {
      setImageUrl(urlInput.trim())
      save({ imageUrl: urlInput.trim() })
      setShowUrlInput(false)
      setUrlInput('')
    }
  }

  const handleDelete = async () => {
    try {
      await db.canvasNodes.update(id, { isDeleted: true, updatedAt: Date.now(), syncStatus: 'pending' })
      syncEngine.scheduleSync(1000)
    } catch (e) {
      console.error('Error deleting image node', e)
    }
  }

  // If has image: Pure borderless image mode
  if (imageUrl) {
    return (
      <div
        className="relative group transition-shadow duration-150"
        style={{ width: `${width}px` }}
      >
        <NodeResizer
          isVisible={selected}
          minWidth={120}
          maxWidth={1200}
          keepAspectRatio={true}
          onResize={(_, params) => {
            setWidth(params.width)
          }}
          onResizeEnd={(_, params) => {
            setWidth(params.width)
            save({ width: params.width })
          }}
          lineClassName="!border-[#1e96eb]"
          handleClassName="!w-2.5 !h-2.5 !bg-white !border-2 !border-[#1e96eb] !rounded-full shadow-sm"
        />

        {/* 4 Handles for connecting lines */}
        <Handle
          type="target"
          position={Position.Top}
          className={`!w-2.5 !h-2.5 !bg-[var(--app-accent)] !border !border-white dark:!border-zinc-800 transition-opacity ${
            selected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
          }`}
        />
        <Handle
          type="source"
          position={Position.Bottom}
          className={`!w-2.5 !h-2.5 !bg-[var(--app-accent)] !border !border-white dark:!border-zinc-800 transition-opacity ${
            selected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
          }`}
        />
        <Handle
          type="target"
          position={Position.Left}
          className={`!w-2.5 !h-2.5 !bg-[var(--app-accent)] !border !border-white dark:!border-zinc-800 transition-opacity ${
            selected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
          }`}
        />
        <Handle
          type="source"
          position={Position.Right}
          className={`!w-2.5 !h-2.5 !bg-[var(--app-accent)] !border !border-white dark:!border-zinc-800 transition-opacity ${
            selected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
          }`}
        />

        {/* Floating Quick Action Overlay on Hover/Selected */}
        <div
          className={`absolute top-2 right-2 z-20 flex items-center gap-1 bg-black/60 backdrop-blur-md px-1.5 py-1 rounded-lg border border-white/10 transition-opacity duration-150 ${
            selected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
          }`}
        >
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="p-1 rounded text-white/80 hover:text-white hover:bg-white/20 transition"
            title="Cambiar foto"
          >
            <EditIcon style={{ width: 13, height: 13 }} />
          </button>
          <button
            type="button"
            onClick={handleDelete}
            className="p-1 rounded text-rose-400 hover:text-rose-300 hover:bg-rose-500/20 transition"
            title="Eliminar foto"
          >
            <DeleteIcon style={{ width: 13, height: 13 }} />
          </button>
        </div>

        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileChange}
          accept="image/*"
          className="hidden"
        />

        {/* Pure Image completely flat without shadow */}
        <div className={`overflow-hidden rounded-xl transition-all ${selected ? 'ring-2 ring-[#1e96eb] ring-offset-2 ring-offset-transparent' : ''}`}>
          <img
            src={imageUrl}
            alt={caption || 'Foto'}
            className="w-full h-auto block select-none pointer-events-none"
            draggable={false}
          />
        </div>

        {/* Optional clean caption below (only if user adds text) */}
        {(caption || selected) && (
          <input
            type="text"
            value={caption}
            onChange={(e) => {
              setCaption(e.target.value)
              save({ caption: e.target.value })
            }}
            placeholder="Añadir pie de foto..."
            className={`w-full mt-1.5 text-xs text-center bg-transparent border-none outline-none transition-opacity ${
              caption ? 'opacity-90' : 'opacity-0 group-hover:opacity-75 focus:opacity-100'
            }`}
            style={{ color: 'var(--affine-text-secondary-color)' }}
          />
        )}
      </div>
    )
  }

  // Placeholder mode (when no image is set yet)
  return (
    <div
      className="relative w-[280px] rounded-2xl transition-[box-shadow,border-color] duration-150 border overflow-hidden p-3"
      style={{
        backgroundColor: 'var(--app-bg-primary)',
        borderColor: selected ? 'var(--app-accent)' : 'var(--app-border)',
        boxShadow: selected ? '0 0 0 1.5px var(--app-accent), var(--app-shadow-card-hover)' : 'var(--app-shadow-card)'
      }}
    >
      <Handle type="target" position={Position.Top} className="!w-2.5 !h-2.5 !bg-[var(--app-accent)] !border !border-white dark:!border-zinc-800" />
      <Handle type="source" position={Position.Bottom} className="!w-2.5 !h-2.5 !bg-[var(--app-accent)] !border !border-white dark:!border-zinc-800" />
      <Handle type="target" position={Position.Left} className="!w-2.5 !h-2.5 !bg-[var(--app-accent)] !border !border-white dark:!border-zinc-800" />
      <Handle type="source" position={Position.Right} className="!w-2.5 !h-2.5 !bg-[var(--app-accent)] !border !border-white dark:!border-zinc-800" />

      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        accept="image/*"
        className="hidden"
      />

      {showUrlInput ? (
        <div className="p-2 rounded-xl border space-y-2" style={{ backgroundColor: 'var(--affine-background-secondary-color)', borderColor: 'var(--affine-border-color)' }}>
          <input
            type="url"
            value={urlInput}
            onChange={(e) => setUrlInput(e.target.value)}
            placeholder="https://ejemplo.com/imagen.jpg"
            autoFocus
            className="w-full px-2 py-1 text-xs rounded border outline-none bg-[var(--affine-background-primary-color)] text-[var(--affine-text-primary-color)] border-[var(--affine-border-color)]"
            onKeyDown={(e) => e.key === 'Enter' && handleSaveUrl()}
          />
          <div className="flex justify-end gap-1.5">
            <button
              type="button"
              onClick={() => setShowUrlInput(false)}
              className="px-2 py-0.5 text-[11px] rounded text-[var(--affine-text-secondary-color)] hover:bg-[var(--affine-hover-color)]"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleSaveUrl}
              className="px-2 py-0.5 text-[11px] rounded bg-[#1e96eb] text-white font-medium"
            >
              Guardar URL
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-1.5">
          <div className="flex items-center justify-between pb-1 text-[var(--affine-text-secondary-color)]">
            <div className="flex items-center gap-1.5 text-xs font-medium">
              <ImageIcon style={{ width: 13, height: 13 }} />
              <span>Insertar Foto</span>
            </div>
            <button
              onClick={handleDelete}
              className="p-1 rounded text-rose-500 hover:bg-rose-500/10 transition"
              title="Eliminar"
            >
              <DeleteIcon style={{ width: 13, height: 13 }} />
            </button>
          </div>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="w-full py-7 rounded-xl border-2 border-dashed flex flex-col items-center justify-center gap-1.5 transition cursor-pointer"
            style={{
              borderColor: 'var(--affine-border-color)',
              backgroundColor: 'var(--affine-background-secondary-color)',
              color: 'var(--affine-text-secondary-color)'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = '#1e96eb'
              e.currentTarget.style.color = '#1e96eb'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = 'var(--affine-border-color)'
              e.currentTarget.style.color = 'var(--affine-text-secondary-color)'
            }}
          >
            <UploadIcon style={{ width: 22, height: 22 }} />
            <span className="text-xs font-semibold">Elegir foto del almacenamiento</span>
            <span className="text-[10px] opacity-75">Celular (Galería/Cámara) o PC</span>
          </button>
          <button
            type="button"
            onClick={() => setShowUrlInput(true)}
            className="w-full py-1 text-[11px] text-[var(--affine-text-secondary-color)] hover:text-[#1e96eb] transition flex items-center justify-center gap-1"
          >
            <LinkIcon style={{ width: 11, height: 11 }} />
            <span>O insertar mediante URL</span>
          </button>
        </div>
      )}
    </div>
  )
}, areNodePropsEqual)
