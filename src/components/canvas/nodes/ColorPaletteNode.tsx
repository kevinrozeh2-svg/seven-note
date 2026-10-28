import { memo, useState } from 'react'
import { Handle, Position } from '@xyflow/react'
import { Plus, Trash2, Check } from 'lucide-react'
import { db } from '../../../db'
import { syncEngine } from '../../../lib/syncEngine'
import { toast } from 'sonner'
import { areNodePropsEqual } from './nodeUtils'

export interface ColorSwatchItem {
  id: string
  hex: string
  name: string
}

export const ColorPaletteNode = memo(({ id, data, selected }: any) => {
  const [swatches, setSwatches] = useState<ColorSwatchItem[]>(() => {
    if (data.swatches && Array.isArray(data.swatches)) return data.swatches
    if (data.paletteColors && Array.isArray(data.paletteColors)) {
      return data.paletteColors.map((hex: string, i: number) => ({
        id: String(i),
        hex,
        name: i === 0 ? 'Color primario' : `Color ${i + 1}`
      }))
    }
    // Default matching Screenshot 1: Mañana, Hollywood, Azul Dodger
    return [
      { id: '1', hex: '#FFBF00', name: 'Mañana' },
      { id: '2', hex: '#D42511', name: 'Hollywood' },
      { id: '3', hex: '#257EF4', name: 'Azul Dodger' }
    ]
  })

  const [copiedId, setCopiedId] = useState<string | null>(null)

  const save = async (updatedSwatches: ColorSwatchItem[]) => {
    try {
      const node = await db.canvasNodes.get(id)
      if (node) {
        await db.canvasNodes.update(id, {
          data: {
            ...node.data,
            swatches: updatedSwatches,
            paletteColors: updatedSwatches.map((s) => s.hex)
          },
          updatedAt: Date.now(),
          syncStatus: 'pending'
        })
        syncEngine.scheduleSync(1500)
      }
    } catch (e) {
      console.error('Error saving color node', e)
    }
  }

  const handleDelete = async () => {
    try {
      await db.canvasNodes.update(id, { isDeleted: true, updatedAt: Date.now(), syncStatus: 'pending' })
      syncEngine.scheduleSync(1000)
      toast.info('Muestra de color eliminada')
    } catch (e) {
      console.error('Error deleting color node', e)
    }
  }

  const handleCopy = (hex: string, swatchId: string) => {
    navigator.clipboard.writeText(hex)
    setCopiedId(swatchId)
    toast.success(`Color ${hex.toUpperCase()} copiado`)
    setTimeout(() => setCopiedId(null), 1500)
  }

  const handleHexChange = (swatchId: string, newHex: string) => {
    const updated = swatches.map((s) => (s.id === swatchId ? { ...s, hex: newHex } : s))
    setSwatches(updated)
    save(updated)
  }

  const handleNameChange = (swatchId: string, newName: string) => {
    const updated = swatches.map((s) => (s.id === swatchId ? { ...s, name: newName } : s))
    setSwatches(updated)
    save(updated)
  }

  const addSwatch = () => {
    const randomHex = '#' + Math.floor(Math.random() * 16777215).toString(16).padStart(6, '0').toUpperCase()
    const newSwatch: ColorSwatchItem = {
      id: crypto.randomUUID(),
      hex: randomHex,
      name: 'Nuevo color'
    }
    const updated = [...swatches, newSwatch]
    setSwatches(updated)
    save(updated)
  }

  const removeSwatch = (swatchId: string) => {
    if (swatches.length <= 1) return
    const updated = swatches.filter((s) => s.id !== swatchId)
    setSwatches(updated)
    save(updated)
  }

  return (
    <div
      className={`group relative flex flex-col gap-3 rounded-xl transition-[box-shadow] duration-150 ${
        selected ? 'ring-2 ring-[var(--app-accent)] shadow-xl' : ''
      }`}
      style={{ width: 180 }}
    >
      {/* Handles */}
      <Handle id="top" type="source" position={Position.Top} className="!w-2.5 !h-2.5 !bg-[var(--app-accent)] !border !border-white dark:!border-zinc-800" />
      <Handle id="bottom" type="source" position={Position.Bottom} className="!w-2.5 !h-2.5 !bg-[var(--app-accent)] !border !border-white dark:!border-zinc-800" />
      <Handle id="left" type="source" position={Position.Left} className="!w-2.5 !h-2.5 !bg-[var(--app-accent)] !border !border-white dark:!border-zinc-800" />
      <Handle id="right" type="source" position={Position.Right} className="!w-2.5 !h-2.5 !bg-[var(--app-accent)] !border !border-white dark:!border-zinc-800" />

      {/* Floating delete button */}
      <button
        onClick={handleDelete}
        className="absolute -top-2 -right-2 p-1.5 rounded-full bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 text-neutral-400 hover:text-rose-500 shadow-sm opacity-0 group-hover:opacity-100 transition z-20"
        title="Eliminar tarjeta"
      >
        <Trash2 className="w-3.5 h-3.5" />
      </button>

      {/* Milanote Swatches List */}
      {swatches.map((swatch) => (
        <div
          key={swatch.id}
          className="group/card relative w-full rounded-lg bg-white dark:bg-[#252525] border border-neutral-200/90 dark:border-neutral-700/80 shadow-[0_2px_8px_rgba(0,0,0,0.06)] dark:shadow-[0_4px_16px_rgba(0,0,0,0.35)] overflow-hidden transition hover:shadow-md"
        >
          {/* Top Solid Color Block */}
          <div
            className="w-full h-24 relative flex items-start justify-start p-2.5 cursor-pointer group/block"
            style={{ backgroundColor: swatch.hex }}
            onClick={() => handleCopy(swatch.hex, swatch.id)}
            title="Haz clic para copiar código HEX"
          >
            {/* Hex code displayed in bold uppercase on top of swatch */}
            <span
              className="text-xs font-mono font-bold tracking-wider select-none px-1 rounded backdrop-blur-xs"
              style={{
                color: getContrastColor(swatch.hex)
              }}
            >
              {swatch.hex.toUpperCase()}
            </span>

            {/* Quick copy checkmark feedback */}
            {copiedId === swatch.id && (
              <span className="absolute top-2 right-2 p-1 rounded-full bg-black/40 text-white animate-in zoom-in-75">
                <Check className="w-3.5 h-3.5" />
              </span>
            )}

            {/* Hidden native color picker triggered by clicking swatch options */}
            <input
              type="color"
              value={swatch.hex}
              onChange={(e) => handleHexChange(swatch.id, e.target.value)}
              className="opacity-0 absolute inset-0 w-full h-full cursor-pointer"
              title="Cambiar color"
            />
          </div>

          {/* Bottom Label Area (Color Name) */}
          <div className="p-2.5 bg-white dark:bg-[#252525] flex items-center justify-between">
            <input
              type="text"
              value={swatch.name}
              onChange={(e) => handleNameChange(swatch.id, e.target.value)}
              placeholder="Nombre del color..."
              className="text-xs font-medium text-neutral-800 dark:text-neutral-200 bg-transparent border-none outline-none w-full"
            />

            {swatches.length > 1 && (
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  removeSwatch(swatch.id)
                }}
                className="opacity-0 group-hover/card:opacity-100 p-0.5 text-neutral-400 hover:text-rose-500 transition"
              >
                <Trash2 className="w-3 h-3" />
              </button>
            )}
          </div>
        </div>
      ))}

      {/* Add swatch button at bottom */}
      <button
        onClick={addSwatch}
        className="w-full py-1.5 rounded-lg border border-dashed border-neutral-300 dark:border-neutral-700 hover:border-neutral-400 text-[11px] font-medium text-neutral-500 dark:text-neutral-400 hover:text-neutral-800 dark:hover:text-neutral-200 bg-white/50 dark:bg-neutral-800/40 hover:bg-white dark:hover:bg-neutral-800 transition opacity-0 group-hover:opacity-100 flex items-center justify-center gap-1 shadow-xs"
      >
        <Plus className="w-3 h-3" />
        <span>Añadir muestra</span>
      </button>
    </div>
  )
}, areNodePropsEqual)

// Helper to determine text contrast on color swatch
function getContrastColor(hex: string): string {
  const cleanHex = hex.replace('#', '')
  if (cleanHex.length !== 6) return '#000000'
  const r = parseInt(cleanHex.substring(0, 2), 16)
  const g = parseInt(cleanHex.substring(2, 4), 16)
  const b = parseInt(cleanHex.substring(4, 6), 16)
  const yiq = (r * 299 + g * 587 + b * 114) / 1000
  return yiq >= 140 ? '#000000' : '#ffffff'
}
