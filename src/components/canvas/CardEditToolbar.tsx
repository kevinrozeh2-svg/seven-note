import { useState, useRef, useEffect, memo } from 'react'
import { NodeToolbar, Position } from '@xyflow/react'
import {
  Palette,
  ChevronDown,
  ArrowUpRight,
  Lock,
  Unlock,
  MoreVertical,
  Hash,
  BoxSelect,
  ArrowUpToLine,
  ArrowUp,
  ArrowDown,
  ArrowDownToLine,
  Copy,
  Image as ImageIcon,
  FileCode,
  Link2,
  CopyPlus,
  FileSymlink,
  Trash2,
  Ban
} from 'lucide-react'
import { toBlob } from 'html-to-image'
import { toast } from 'sonner'

export interface CardEditToolbarProps {
  node: any
  onUpdateNode: (nodeId: string, updates: Record<string, any>) => void
  onStartConnect: (nodeId: string) => void
  onDuplicate: (nodeId: string) => void
  onDelete: (nodeId: string) => void
  onBringToFront?: (nodeId: string) => void
  onBringForward?: (nodeId: string) => void
  onSendBackward?: (nodeId: string) => void
  onSendToBack?: (nodeId: string) => void
  onFrameSection?: (nodeId: string) => void
  onGroupSection?: (nodeId: string) => void
  onTurnIntoLinkedDoc?: (nodeId: string) => void
}

const FILL_COLORS = [
  { id: 'dark-red', hex: '#7f1d1d', label: 'Rojo vino' },
  { id: 'orange', hex: '#c2410c', label: 'Naranja óxido' },
  { id: 'amber', hex: '#b45309', label: 'Ámbar' },
  { id: 'olive', hex: '#3f6212', label: 'Verde oliva' },
  { id: 'sky', hex: '#0284c7', label: 'Azul cian' },
  { id: 'indigo', hex: '#4338ca', label: 'Índigo' },
  { id: 'plum', hex: '#86198f', label: 'Ciruela' },
  { id: 'slate', hex: '#18181b', label: 'Gris oscuro' }
]

const BORDER_WIDTH_STEPS = [0, 1, 2, 3, 4, 5, 6]
const CORNER_RADIUS_STEPS = [0, 4, 8, 12, 16, 24, 32]
const OPACITY_PRESETS = [1, 0.8, 0.6, 0.4, 0.2]

export const CardEditToolbar = memo(function CardEditToolbar({
  node,
  onUpdateNode,
  onStartConnect,
  onDuplicate,
  onDelete,
  onBringToFront,
  onBringForward,
  onSendBackward,
  onSendToBack,
  onFrameSection,
  onGroupSection,
  onTurnIntoLinkedDoc
}: CardEditToolbarProps) {
  const [isPaletteOpen, setIsPaletteOpen] = useState(false)
  const [isOpacityOpen, setIsOpacityOpen] = useState(false)
  const [isMoreOpen, setIsMoreOpen] = useState(false)

  const colorInputRef = useRef<HTMLInputElement>(null)
  const toolbarRef = useRef<HTMLDivElement>(null)

  const data = (node.data || {}) as Record<string, any>
  const currentColor = data.fillColor || (data.color ? data.color : '#18181b')
  const currentShadow = data.shadowType || 'subtle'
  const currentBorderWidth = data.borderWidth ?? 1
  const currentBorderStyle = data.borderStyle ?? 'solid'
  const currentRadius = data.borderRadius ?? 8
  const currentOpacity = typeof data.opacity === 'number' ? data.opacity : 1
  const isLocked = Boolean(data.isLocked)

  // Close popovers if clicked outside
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (toolbarRef.current && !toolbarRef.current.contains(e.target as unknown as globalThis.Node)) {
        setIsPaletteOpen(false)
        setIsOpacityOpen(false)
        setIsMoreOpen(false)
      }
    }
    window.addEventListener('pointerdown', handleOutsideClick)
    return () => window.removeEventListener('pointerdown', handleOutsideClick)
  }, [])

  const handleUpdate = (updates: Record<string, any>) => {
    onUpdateNode(node.id, updates)
  }

  // Copy standard card text to clipboard
  const handleCopy = async () => {
    try {
      const content = data.content || data.title || JSON.stringify(data, null, 2)
      await navigator.clipboard.writeText(content)
      toast.success('Copiado al portapapeles')
      setIsMoreOpen(false)
    } catch {
      toast.error('Error al copiar')
    }
  }

  // Copy card as Image (PNG Blob)
  const handleCopyAsImage = async () => {
    try {
      const nodeElem = document.querySelector(`.react-flow__node[data-id="${node.id}"]`) as HTMLElement
      if (!nodeElem) {
        toast.error('No se pudo encontrar el elemento visual')
      } else {
        toast.info('Capturando imagen...')
        const blob = await toBlob(nodeElem, {
          backgroundColor: 'transparent',
          filter: (el) => !el.classList?.contains('nodrag') && !el.classList?.contains('react-flow__handle')
        })
        if (blob) {
          await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })])
          toast.success('Tarjeta copiada como imagen al portapapeles')
        } else {
          toast.error('No se pudo generar la imagen')
        }
      }
      setIsMoreOpen(false)
    } catch (err) {
      console.error(err)
      toast.error('El navegador no permitió copiar la imagen')
    }
  }

  // Copy card as Markdown
  const handleCopyAsMarkdown = async () => {
    try {
      let md = ''
      if (data.title) md += `### ${data.title}\n\n`
      if (data.content) md += `${data.content}\n\n`
      if (data.todos && Array.isArray(data.todos)) {
        md += data.todos.map((t: any) => `- [${t.completed ? 'x' : ' '}] ${t.text}`).join('\n') + '\n\n'
      }
      if (data.url) md += `[${data.title || data.url}](${data.url})\n\n`
      await navigator.clipboard.writeText(md.trim())
      toast.success('Copiado como Markdown')
      setIsMoreOpen(false)
    } catch {
      toast.error('Error al copiar Markdown')
    }
  }

  // Copy deep link to this block
  const handleCopyLinkToBlock = async () => {
    try {
      const url = `${window.location.origin}${window.location.pathname}#node-${node.id}`
      await navigator.clipboard.writeText(url)
      toast.success('Enlace al bloque copiado')
      setIsMoreOpen(false)
    } catch {
      toast.error('Error al copiar enlace')
    }
  }

  return (
    <NodeToolbar
      nodeId={node.id}
      isVisible={node.selected}
      position={Position.Top}
      offset={12}
      align="center"
      className="nodrag nopan nowheel z-50 pointer-events-auto"
    >
      <div ref={toolbarRef} className="relative flex flex-col items-center">
        {/* Main Floating Pill Toolbar */}
        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#1c1c1e] text-white shadow-2xl border border-white/10 text-xs backdrop-blur-md select-none transition-all duration-150">
          {/* 1. 🎨 Palette Button */}
          <button
            onClick={() => {
              setIsPaletteOpen(!isPaletteOpen)
              setIsOpacityOpen(false)
              setIsMoreOpen(false)
            }}
            className={`p-1.5 rounded-full transition-all cursor-pointer ${
              isPaletteOpen
                ? 'bg-white/20 text-sky-400 shadow-sm'
                : 'text-zinc-300 hover:text-white hover:bg-white/10 active:scale-95'
            }`}
            title="Editar estilos (Color, Sombra, Borde, Radio)"
          >
            <Palette className="w-4 h-4" />
          </button>

          {/* 2. 100% ⌄ Opacity Button */}
          <div className="relative">
            <button
              onClick={() => {
                setIsOpacityOpen(!isOpacityOpen)
                setIsPaletteOpen(false)
                setIsMoreOpen(false)
              }}
              className={`flex items-center gap-1 px-2 py-1 rounded-lg text-zinc-300 hover:text-white hover:bg-white/10 transition-all text-xs font-medium cursor-pointer ${
                isOpacityOpen ? 'bg-white/15 text-white' : ''
              }`}
              title="Ajustar opacidad de la tarjeta"
            >
              <span>{Math.round(currentOpacity * 100)}%</span>
              <ChevronDown className="w-3 h-3 text-zinc-400" />
            </button>

            {/* Opacity Dropdown Popover */}
            {isOpacityOpen && (
              <div className="absolute top-full mt-2 left-1/2 -translate-x-1/2 w-48 p-3 rounded-xl bg-[#1c1c1e] border border-white/10 shadow-2xl text-white z-50 flex flex-col gap-2.5">
                <div className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">
                  Opacidad
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="range"
                    min="10"
                    max="100"
                    step="5"
                    value={Math.round(currentOpacity * 100)}
                    onChange={(e) => handleUpdate({ opacity: Number(e.target.value) / 100 })}
                    className="w-full accent-sky-500 h-1.5 bg-zinc-700 rounded-lg cursor-pointer"
                  />
                  <span className="text-xs font-mono w-9 text-right">
                    {Math.round(currentOpacity * 100)}%
                  </span>
                </div>
                <div className="grid grid-cols-5 gap-1 pt-1 border-t border-white/10">
                  {OPACITY_PRESETS.map((op) => (
                    <button
                      key={op}
                      onClick={() => handleUpdate({ opacity: op })}
                      className={`px-1 py-0.5 rounded text-[11px] font-mono transition cursor-pointer ${
                        Math.abs(currentOpacity - op) < 0.05
                          ? 'bg-sky-500 text-white font-bold'
                          : 'bg-white/5 hover:bg-white/10 text-zinc-300'
                      }`}
                    >
                      {Math.round(op * 100)}%
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* 3. ↗ Connector Arrow Button */}
          <button
            onClick={() => onStartConnect(node.id)}
            className="p-1.5 rounded-full text-zinc-300 hover:text-white hover:bg-white/10 transition-all active:scale-95 cursor-pointer"
            title="Conectar tarjeta con flecha a otra (Modo conector)"
          >
            <ArrowUpRight className="w-4 h-4" />
          </button>

          {/* 4. 🔒 Lock / Unlock Button */}
          <button
            onClick={() => {
              const nextLocked = !isLocked
              handleUpdate({ isLocked: nextLocked })
              toast.info(nextLocked ? 'Tarjeta bloqueada' : 'Tarjeta desbloqueada')
            }}
            className={`p-1.5 rounded-full transition-all active:scale-95 cursor-pointer ${
              isLocked
                ? 'bg-amber-500/20 text-amber-400 ring-1 ring-amber-500/40'
                : 'text-zinc-300 hover:text-white hover:bg-white/10'
            }`}
            title={isLocked ? 'Desbloquear posición de tarjeta' : 'Bloquear posición de tarjeta'}
          >
            {isLocked ? <Lock className="w-4 h-4 text-amber-400" /> : <Unlock className="w-4 h-4" />}
          </button>

          {/* 5. ⋮ More Options Button */}
          <div className="relative">
            <button
              onClick={() => {
                setIsMoreOpen(!isMoreOpen)
                setIsPaletteOpen(false)
                setIsOpacityOpen(false)
              }}
              className={`p-1.5 rounded-full text-zinc-300 hover:text-white hover:bg-white/10 transition-all active:scale-95 cursor-pointer ${
                isMoreOpen ? 'bg-white/15 text-white' : ''
              }`}
              title="Más opciones de tarjeta"
            >
              <MoreVertical className="w-4 h-4" />
            </button>

            {/* ========================================================================= */}
            {/* 3-Dots Dropdown Menu (Matches user screenshot 2 exactly)                  */}
            {/* ========================================================================= */}
            {isMoreOpen && (
              <div className="absolute top-full mt-2 right-0 w-[210px] p-1.5 rounded-2xl bg-[#1c1c1e] border border-white/10 shadow-2xl text-white z-50 flex flex-col gap-0.5 select-none animate-in fade-in zoom-in-95 duration-100">
                {/* Group 1: Frame section & Group section */}
                {onFrameSection && (
                  <button
                    onClick={() => {
                      onFrameSection(node.id)
                      setIsMoreOpen(false)
                    }}
                    className="flex items-center gap-2.5 px-3 py-1.5 rounded-lg text-[13px] hover:bg-white/10 transition text-zinc-200 text-left cursor-pointer"
                  >
                    <Hash className="w-4 h-4 text-zinc-400 shrink-0" />
                    <span>Frame section</span>
                  </button>
                )}

                {onGroupSection && (
                  <button
                    onClick={() => {
                      onGroupSection(node.id)
                      setIsMoreOpen(false)
                    }}
                    className="flex items-center gap-2.5 px-3 py-1.5 rounded-lg text-[13px] hover:bg-white/10 transition text-zinc-200 text-left cursor-pointer"
                  >
                    <BoxSelect className="w-4 h-4 text-zinc-400 shrink-0" />
                    <span>Group section</span>
                  </button>
                )}

                <div className="my-1 border-t border-white/10" />

                {/* Group 2: Z-Index Ordering */}
                {onBringToFront && (
                  <button
                    onClick={() => {
                      onBringToFront(node.id)
                      setIsMoreOpen(false)
                    }}
                    className="flex items-center gap-2.5 px-3 py-1.5 rounded-lg text-[13px] hover:bg-white/10 transition text-zinc-200 text-left cursor-pointer"
                  >
                    <ArrowUpToLine className="w-4 h-4 text-zinc-400 shrink-0" />
                    <span>Bring to Front</span>
                  </button>
                )}

                {onBringForward && (
                  <button
                    onClick={() => {
                      onBringForward(node.id)
                      setIsMoreOpen(false)
                    }}
                    className="flex items-center gap-2.5 px-3 py-1.5 rounded-lg text-[13px] hover:bg-white/10 transition text-zinc-200 text-left cursor-pointer"
                  >
                    <ArrowUp className="w-4 h-4 text-zinc-400 shrink-0" />
                    <span>Bring Forward</span>
                  </button>
                )}

                {onSendBackward && (
                  <button
                    onClick={() => {
                      onSendBackward(node.id)
                      setIsMoreOpen(false)
                    }}
                    className="flex items-center gap-2.5 px-3 py-1.5 rounded-lg text-[13px] hover:bg-white/10 transition text-zinc-200 text-left cursor-pointer"
                  >
                    <ArrowDown className="w-4 h-4 text-zinc-400 shrink-0" />
                    <span>Send Backward</span>
                  </button>
                )}

                {onSendToBack && (
                  <button
                    onClick={() => {
                      onSendToBack(node.id)
                      setIsMoreOpen(false)
                    }}
                    className="flex items-center gap-2.5 px-3 py-1.5 rounded-lg text-[13px] hover:bg-white/10 transition text-zinc-200 text-left cursor-pointer"
                  >
                    <ArrowDownToLine className="w-4 h-4 text-zinc-400 shrink-0" />
                    <span>Send to Back</span>
                  </button>
                )}

                <div className="my-1 border-t border-white/10" />

                {/* Group 3: Copy, Copy as Image, Copy as Markdown, Copy link to block, Duplicate */}
                <button
                  onClick={handleCopy}
                  className="flex items-center gap-2.5 px-3 py-1.5 rounded-lg text-[13px] hover:bg-white/10 transition text-zinc-200 text-left cursor-pointer"
                >
                  <Copy className="w-4 h-4 text-zinc-400 shrink-0" />
                  <span>Copy</span>
                </button>

                <button
                  onClick={handleCopyAsImage}
                  className="flex items-center gap-2.5 px-3 py-1.5 rounded-lg text-[13px] hover:bg-white/10 transition text-zinc-200 text-left cursor-pointer"
                >
                  <ImageIcon className="w-4 h-4 text-zinc-400 shrink-0" />
                  <span>Copy as Image</span>
                </button>

                <button
                  onClick={handleCopyAsMarkdown}
                  className="flex items-center gap-2.5 px-3 py-1.5 rounded-lg text-[13px] hover:bg-white/10 transition text-zinc-200 text-left cursor-pointer"
                >
                  <FileCode className="w-4 h-4 text-zinc-400 shrink-0" />
                  <span>Copy as Markdown</span>
                </button>

                <button
                  onClick={handleCopyLinkToBlock}
                  className="flex items-center gap-2.5 px-3 py-1.5 rounded-lg text-[13px] hover:bg-white/10 transition text-zinc-200 text-left cursor-pointer"
                >
                  <Link2 className="w-4 h-4 text-zinc-400 shrink-0" />
                  <span>Copy link to block</span>
                </button>

                <button
                  onClick={() => {
                    onDuplicate(node.id)
                    setIsMoreOpen(false)
                  }}
                  className="flex items-center gap-2.5 px-3 py-1.5 rounded-lg text-[13px] hover:bg-white/10 transition text-zinc-200 text-left cursor-pointer"
                >
                  <CopyPlus className="w-4 h-4 text-zinc-400 shrink-0" />
                  <span>Duplicate</span>
                </button>

                <div className="my-1 border-t border-white/10" />

                {/* Group 4: Turn into linked doc */}
                {onTurnIntoLinkedDoc && (
                  <button
                    onClick={() => {
                      onTurnIntoLinkedDoc(node.id)
                      setIsMoreOpen(false)
                    }}
                    className="flex items-center gap-2.5 px-3 py-1.5 rounded-lg text-[13px] hover:bg-white/10 transition text-zinc-200 text-left cursor-pointer"
                  >
                    <FileSymlink className="w-4 h-4 text-zinc-400 shrink-0" />
                    <span>Turn into linked doc</span>
                  </button>
                )}

                <div className="my-1 border-t border-white/10" />

                {/* Group 5: Delete */}
                <button
                  onClick={() => {
                    onDelete(node.id)
                    setIsMoreOpen(false)
                  }}
                  className="flex items-center gap-2.5 px-3 py-1.5 rounded-lg text-[13px] hover:bg-rose-500/20 text-rose-400 transition text-left cursor-pointer"
                >
                  <Trash2 className="w-4 h-4 shrink-0" />
                  <span>Delete</span>
                </button>
              </div>
            )}
          </div>
        </div>

        {/* ========================================================================= */}
        {/* Style Editor Popover (Fill color, Shadow, Border, Corner Radius)         */}
        {/* Matches user screenshot 1 exactly                                         */}
        {/* ========================================================================= */}
        {isPaletteOpen && (
          <div className="absolute top-full mt-2 left-1/2 -translate-x-1/2 w-[340px] p-4 rounded-2xl bg-[#1c1c1e] text-white border border-white/10 shadow-2xl z-50 flex flex-col gap-4 select-none transition-all">
            {/* Section 1: Fill color */}
            <div>
              <div className="text-zinc-400 text-xs font-medium mb-2.5">Fill color</div>
              <div className="flex items-center justify-between gap-1.5 flex-wrap">
                {/* 8 Color Swatches */}
                {FILL_COLORS.map((c) => {
                  const isSelected = currentColor?.toLowerCase() === c.hex.toLowerCase()
                  return (
                    <button
                      key={c.id}
                      onClick={() => handleUpdate({ fillColor: c.hex })}
                      style={{ backgroundColor: c.hex }}
                      className={`w-6 h-6 rounded-full transition-transform active:scale-90 relative cursor-pointer ${
                        isSelected
                          ? 'ring-2 ring-sky-400 ring-offset-2 ring-offset-[#1c1c1e] scale-110'
                          : 'hover:scale-105 opacity-90 hover:opacity-100'
                      }`}
                      title={c.label}
                    />
                  )
                })}

                {/* Transparent Swatch (Checkered pattern) */}
                <button
                  onClick={() => handleUpdate({ fillColor: 'transparent' })}
                  className={`w-6 h-6 rounded-full border border-white/20 transition-transform active:scale-90 relative overflow-hidden cursor-pointer ${
                    currentColor === 'transparent'
                      ? 'ring-2 ring-sky-400 ring-offset-2 ring-offset-[#1c1c1e] scale-110'
                      : 'hover:scale-105'
                  }`}
                  style={{
                    backgroundImage:
                      'linear-gradient(45deg, #3f3f46 25%, transparent 25%), linear-gradient(-45deg, #3f3f46 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #3f3f46 75%), linear-gradient(-45deg, transparent 75%, #3f3f46 75%)',
                    backgroundSize: '8px 8px',
                    backgroundPosition: '0 0, 0 4px, 4px -4px, -4px 0px'
                  }}
                  title="Transparente"
                />

                {/* Custom Color Rainbow Picker */}
                <button
                  onClick={() => colorInputRef.current?.click()}
                  className="w-6 h-6 rounded-full transition-transform active:scale-90 relative overflow-hidden hover:scale-105 shadow-sm cursor-pointer"
                  style={{
                    background:
                      'conic-gradient(from 90deg, #ef4444, #f97316, #eab308, #22c55e, #06b6d4, #3b82f6, #a855f7, #ec4899, #ef4444)'
                  }}
                  title="Color personalizado"
                >
                  <input
                    ref={colorInputRef}
                    type="color"
                    value={currentColor.startsWith('#') ? currentColor : '#18181b'}
                    onChange={(e) => handleUpdate({ fillColor: e.target.value })}
                    className="opacity-0 absolute inset-0 w-full h-full cursor-pointer"
                  />
                </button>
              </div>
            </div>

            {/* Section 2: Shadow */}
            <div>
              <div className="text-zinc-400 text-xs font-medium mb-2.5">Shadow</div>
              <div className="grid grid-cols-6 gap-2">
                {/* 1. None */}
                <button
                  onClick={() => handleUpdate({ shadowType: 'none' })}
                  className={`h-11 rounded-lg bg-[#27272a]/60 border flex items-center justify-center transition-all cursor-pointer ${
                    currentShadow === 'none'
                      ? 'border-sky-500 bg-sky-500/10 text-sky-400 ring-1 ring-sky-500/50'
                      : 'border-white/10 hover:border-white/25 text-zinc-500'
                  }`}
                  title="Sin sombra"
                >
                  <Ban className="w-4 h-4" />
                </button>

                {/* 2. Subtle */}
                <button
                  onClick={() => handleUpdate({ shadowType: 'subtle' })}
                  className={`h-11 rounded-lg bg-[#27272a] border p-1.5 flex flex-col justify-center items-center gap-1 transition-all shadow-sm cursor-pointer ${
                    currentShadow === 'subtle'
                      ? 'border-sky-500 bg-sky-500/10 ring-1 ring-sky-500/50'
                      : 'border-white/10 hover:border-white/25'
                  }`}
                  title="Sombra sutil"
                >
                  <div className="w-5 h-6 rounded bg-zinc-700/80 p-1 flex flex-col gap-0.5 shadow-xs">
                    <div className="w-full h-0.5 bg-zinc-500 rounded" />
                    <div className="w-2/3 h-0.5 bg-zinc-500 rounded" />
                    <div className="w-full h-0.5 bg-zinc-500 rounded" />
                  </div>
                </button>

                {/* 3. Elevated (Dark bottom drop shadow) */}
                <button
                  onClick={() => handleUpdate({ shadowType: 'elevated' })}
                  className={`h-11 rounded-lg bg-[#27272a] border p-1.5 flex flex-col justify-center items-center gap-1 transition-all cursor-pointer ${
                    currentShadow === 'elevated'
                      ? 'border-sky-500 bg-sky-500/10 ring-1 ring-sky-500/50'
                      : 'border-white/10 hover:border-white/25'
                  }`}
                  title="Sombra profunda elevada"
                >
                  <div className="w-5 h-6 rounded bg-zinc-700 p-1 flex flex-col gap-0.5 shadow-[0_5px_8px_rgba(0,0,0,0.9)]">
                    <div className="w-full h-0.5 bg-zinc-500 rounded" />
                    <div className="w-2/3 h-0.5 bg-zinc-500 rounded" />
                    <div className="w-full h-0.5 bg-zinc-500 rounded" />
                  </div>
                </button>

                {/* 4. Border (High-contrast outline) */}
                <button
                  onClick={() => handleUpdate({ shadowType: 'border' })}
                  className={`h-11 rounded-lg bg-[#27272a] border p-1.5 flex flex-col justify-center items-center gap-1 transition-all cursor-pointer ${
                    currentShadow === 'border'
                      ? 'border-sky-500 bg-sky-500/10 ring-1 ring-sky-500/50'
                      : 'border-white/10 hover:border-white/25'
                  }`}
                  title="Contorno nítido"
                >
                  <div className="w-5 h-6 rounded bg-zinc-800 border-1.5 border-zinc-400 p-1 flex flex-col gap-0.5">
                    <div className="w-full h-0.5 bg-zinc-500 rounded" />
                    <div className="w-2/3 h-0.5 bg-zinc-500 rounded" />
                    <div className="w-full h-0.5 bg-zinc-500 rounded" />
                  </div>
                </button>

                {/* 5. Glow */}
                <button
                  onClick={() => handleUpdate({ shadowType: 'glow' })}
                  className={`h-11 rounded-lg bg-[#27272a] border p-1.5 flex flex-col justify-center items-center gap-1 transition-all cursor-pointer ${
                    currentShadow === 'glow'
                      ? 'border-sky-500 bg-sky-500/10 ring-1 ring-sky-500/50'
                      : 'border-white/10 hover:border-white/25'
                  }`}
                  title="Resplandor suave"
                >
                  <div className="w-5 h-6 rounded bg-zinc-700 p-1 flex flex-col gap-0.5 shadow-[0_0_8px_rgba(56,189,248,0.7)]">
                    <div className="w-full h-0.5 bg-zinc-400 rounded" />
                    <div className="w-2/3 h-0.5 bg-zinc-400 rounded" />
                    <div className="w-full h-0.5 bg-zinc-400 rounded" />
                  </div>
                </button>

                {/* 6. Stacked */}
                <button
                  onClick={() => handleUpdate({ shadowType: 'stacked' })}
                  className={`h-11 rounded-lg bg-[#27272a] border p-1.5 flex flex-col justify-center items-center gap-1 transition-all cursor-pointer ${
                    currentShadow === 'stacked'
                      ? 'border-sky-500 bg-sky-500/10 ring-1 ring-sky-500/50'
                      : 'border-white/10 hover:border-white/25'
                  }`}
                  title="Tarjetas apiladas"
                >
                  <div className="relative w-5 h-6">
                    <div className="absolute top-0.5 right-0.5 w-4.5 h-5.5 rounded bg-zinc-600/60 border border-white/20" />
                    <div className="absolute top-0 left-0 w-4.5 h-5.5 rounded bg-zinc-700 border border-white/30 p-0.5 flex flex-col gap-0.5 shadow-sm">
                      <div className="w-full h-0.5 bg-zinc-400 rounded" />
                      <div className="w-2/3 h-0.5 bg-zinc-400 rounded" />
                    </div>
                  </div>
                </button>
              </div>
            </div>

            {/* Section 3: Border */}
            <div>
              <div className="text-zinc-400 text-xs font-medium mb-2.5">Border</div>
              <div className="flex items-center justify-between gap-4">
                {/* Stepped Width Dots Slider */}
                <div className="flex-1 relative flex items-center h-6">
                  {/* Track line */}
                  <div className="absolute left-1 right-1 h-0.5 bg-zinc-700" />
                  {/* Active track line */}
                  <div
                    className="absolute left-1 h-0.5 bg-zinc-400"
                    style={{
                      width: `${(Math.min(currentBorderWidth, 6) / 6) * 100}%`
                    }}
                  />
                  {/* Step dots */}
                  <div className="relative z-10 w-full flex items-center justify-between">
                    {BORDER_WIDTH_STEPS.map((step) => {
                      const isCurrent = currentBorderWidth === step
                      return (
                        <button
                          key={step}
                          onClick={() =>
                            handleUpdate({
                              borderWidth: step,
                              borderStyle: step === 0 ? 'none' : currentBorderStyle === 'none' ? 'solid' : currentBorderStyle
                            })
                          }
                          className={`group relative flex items-center justify-center w-4 h-4 rounded-full transition-all cursor-pointer ${
                            isCurrent ? 'scale-125' : ''
                          }`}
                          title={`${step}px`}
                        >
                          <span
                            className={`rounded-full transition-all ${
                              isCurrent
                                ? 'w-3 h-3 bg-white ring-2 ring-sky-400'
                                : 'w-1.5 h-1.5 bg-zinc-600 group-hover:bg-zinc-400'
                            }`}
                          />
                        </button>
                      )
                    })}
                  </div>
                </div>

                {/* Border Style Controls: Solid / Dashed / None */}
                <div className="flex items-center bg-[#27272a] rounded-lg p-0.5 border border-white/10">
                  {/* Solid */}
                  <button
                    onClick={() =>
                      handleUpdate({
                        borderStyle: 'solid',
                        borderWidth: currentBorderWidth === 0 ? 1 : currentBorderWidth
                      })
                    }
                    className={`w-7 h-6 rounded flex items-center justify-center transition cursor-pointer ${
                      currentBorderStyle === 'solid' && currentBorderWidth > 0
                        ? 'bg-white/20 text-white'
                        : 'text-zinc-400 hover:text-white'
                    }`}
                    title="Borde continuo"
                  >
                    <span className="w-3.5 border-b-[1.5px] border-current rotate-[-45deg]" />
                  </button>

                  {/* Dashed */}
                  <button
                    onClick={() =>
                      handleUpdate({
                        borderStyle: 'dashed',
                        borderWidth: currentBorderWidth === 0 ? 1 : currentBorderWidth
                      })
                    }
                    className={`w-7 h-6 rounded flex items-center justify-center transition cursor-pointer ${
                      currentBorderStyle === 'dashed' && currentBorderWidth > 0
                        ? 'bg-white/20 text-white'
                        : 'text-zinc-400 hover:text-white'
                    }`}
                    title="Borde discontinuo"
                  >
                    <span className="w-3.5 border-b-[1.5px] border-dashed border-current rotate-[-45deg]" />
                  </button>

                  {/* None */}
                  <button
                    onClick={() =>
                      handleUpdate({
                        borderStyle: 'none',
                        borderWidth: 0
                      })
                    }
                    className={`w-7 h-6 rounded flex items-center justify-center transition cursor-pointer ${
                      currentBorderStyle === 'none' || currentBorderWidth === 0
                        ? 'bg-white/20 text-white'
                        : 'text-zinc-400 hover:text-white'
                    }`}
                    title="Sin borde"
                  >
                    <Ban className="w-3 h-3" />
                  </button>
                </div>
              </div>
            </div>

            {/* Section 4: Corner Radius */}
            <div>
              <div className="text-zinc-400 text-xs font-medium mb-2.5">Corner Radius</div>
              <div className="flex items-center justify-between gap-4">
                {/* Stepped Radius Dots Slider */}
                <div className="flex-1 relative flex items-center h-6">
                  {/* Track line */}
                  <div className="absolute left-1 right-1 h-0.5 bg-zinc-700" />
                  {/* Active track line */}
                  <div
                    className="absolute left-1 h-0.5 bg-zinc-400"
                    style={{
                      width: `${(CORNER_RADIUS_STEPS.indexOf(currentRadius) >= 0 ? CORNER_RADIUS_STEPS.indexOf(currentRadius) : (currentRadius / 32) * (CORNER_RADIUS_STEPS.length - 1)) / (CORNER_RADIUS_STEPS.length - 1) * 100}%`
                    }}
                  />
                  {/* Step dots */}
                  <div className="relative z-10 w-full flex items-center justify-between">
                    {CORNER_RADIUS_STEPS.map((step) => {
                      const isCurrent = currentRadius === step
                      return (
                        <button
                          key={step}
                          onClick={() => handleUpdate({ borderRadius: step })}
                          className={`group relative flex items-center justify-center w-4 h-4 rounded-full transition-all cursor-pointer ${
                            isCurrent ? 'scale-125' : ''
                          }`}
                          title={`${step}px`}
                        >
                          <span
                            className={`rounded-full transition-all ${
                              isCurrent
                                ? 'w-3 h-3 bg-white ring-2 ring-sky-400'
                                : 'w-1.5 h-1.5 bg-zinc-600 group-hover:bg-zinc-400'
                            }`}
                          />
                        </button>
                      )
                    })}
                  </div>
                </div>

                {/* Number input box */}
                <input
                  type="number"
                  min="0"
                  max="64"
                  value={currentRadius}
                  onChange={(e) => handleUpdate({ borderRadius: Math.max(0, Math.min(64, Number(e.target.value) || 0)) })}
                  className="w-13 h-7 bg-[#27272a] border border-white/10 rounded-lg text-xs font-mono text-white text-center outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500 transition"
                />
              </div>
            </div>
          </div>
        )}
      </div>
    </NodeToolbar>
  )
})
