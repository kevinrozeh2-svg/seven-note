import { useState, useEffect, useRef } from 'react'
import { CloseIcon, LocalWorkspaceIcon } from '@blocksuite/icons/rc'

interface CreateWorkspaceModalProps {
  isOpen: boolean
  onClose: () => void
  onCreate: (name: string, icon: string, color: string) => Promise<void>
}

const PRESET_EMOJIS = ['💼', '🚀', '💡', '📚', '🎨', '💻', '🎯', '⚡', '🏠', '☕', '🔬', '📊', '🌐', '📝', '✨', '🪐']

const PRESET_COLORS = [
  { name: 'Azul', value: '#1e96eb' },
  { name: 'Índigo', value: '#6366f1' },
  { name: 'Púrpura', value: '#8b5cf6' },
  { name: 'Rosa', value: '#ec4899' },
  { name: 'Esmeralda', value: '#10b981' },
  { name: 'Ámbar', value: '#f59e0b' },
  { name: 'Cian', value: '#06b6d4' },
  { name: 'Rojo', value: '#f43f5e' }
]

export function CreateWorkspaceModal({ isOpen, onClose, onCreate }: CreateWorkspaceModalProps) {
  const [name, setName] = useState('')
  const [selectedIcon, setSelectedIcon] = useState('💼')
  const [selectedColor, setSelectedColor] = useState('#1e96eb')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (isOpen) {
      setName('')
      setSelectedIcon('💼')
      setSelectedColor('#1e96eb')
      setIsSubmitting(false)
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }, [isOpen])

  if (!isOpen) return null

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    const trimmed = name.trim()
    if (!trimmed || isSubmitting) return

    try {
      setIsSubmitting(true)
      await onCreate(trimmed, selectedIcon, selectedColor)
      onClose()
    } catch (err) {
      console.error('Error creating workspace', err)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-2xl border shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150 flex flex-col"
        style={{
          backgroundColor: 'var(--affine-background-primary-color)',
          borderColor: 'var(--affine-border-color)'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          className="px-5 py-4 border-b flex items-center justify-between"
          style={{ borderColor: 'var(--affine-border-color)' }}
        >
          <div className="flex items-center gap-2.5">
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 shadow-2xs"
              style={{ backgroundColor: `${selectedColor}20`, color: selectedColor }}
            >
              <LocalWorkspaceIcon style={{ width: 18, height: 18 }} />
            </div>
            <div>
              <h2 className="text-sm font-semibold" style={{ color: 'var(--affine-text-primary-color)' }}>
                Nuevo espacio de trabajo
              </h2>
              <p className="text-[11px]" style={{ color: 'var(--affine-text-secondary-color)' }}>
                Crea un entorno para tus notas y tableros independientes
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-md text-[var(--affine-icon-color)] hover:text-[var(--affine-text-primary-color)] hover:bg-[var(--affine-hover-color)] transition"
          >
            <CloseIcon style={{ width: 16, height: 16 }} />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4 text-xs">
          {/* Workspace Name */}
          <div>
            <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--affine-text-secondary-color)' }}>
              Nombre del espacio
            </label>
            <input
              ref={inputRef}
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="p. ej. Proyectos 2026, Trabajo, Personal..."
              maxLength={40}
              className="w-full text-xs px-3 py-2 rounded-lg border outline-none transition"
              style={{
                backgroundColor: 'var(--affine-background-secondary-color)',
                borderColor: 'var(--affine-border-color)',
                color: 'var(--affine-text-primary-color)'
              }}
              onFocus={(e) => (e.currentTarget.style.borderColor = selectedColor)}
              onBlur={(e) => (e.currentTarget.style.borderColor = 'var(--affine-border-color)')}
            />
          </div>

          {/* Icon Selection */}
          <div>
            <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--affine-text-secondary-color)' }}>
              Icono / Emoji
            </label>
            <div className="grid grid-cols-8 gap-1.5 p-2 rounded-xl border" style={{ borderColor: 'var(--affine-border-color)', backgroundColor: 'var(--affine-background-secondary-color)' }}>
              {PRESET_EMOJIS.map((emoji) => (
                <button
                  key={emoji}
                  type="button"
                  onClick={() => setSelectedIcon(emoji)}
                  className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm transition ${
                    selectedIcon === emoji
                      ? 'scale-110 shadow-sm ring-2 ring-offset-1'
                      : 'hover:bg-[var(--affine-hover-color)] opacity-75 hover:opacity-100'
                  }`}
                  style={{
                    backgroundColor: selectedIcon === emoji ? `${selectedColor}25` : 'transparent',
                    boxShadow: selectedIcon === emoji ? `0 0 0 2px ${selectedColor}` : 'none'
                  }}
                >
                  {emoji}
                </button>
              ))}
            </div>
          </div>

          {/* Color Selection */}
          <div>
            <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--affine-text-secondary-color)' }}>
              Color del espacio
            </label>
            <div className="flex items-center gap-2 p-2 rounded-xl border" style={{ borderColor: 'var(--affine-border-color)', backgroundColor: 'var(--affine-background-secondary-color)' }}>
              {PRESET_COLORS.map((c) => (
                <button
                  key={c.value}
                  type="button"
                  onClick={() => setSelectedColor(c.value)}
                  title={c.name}
                  className={`w-6 h-6 rounded-full transition-transform ${
                    selectedColor === c.value ? 'scale-125 ring-2 ring-white shadow-md' : 'hover:scale-110 opacity-80 hover:opacity-100'
                  }`}
                  style={{ backgroundColor: c.value }}
                />
              ))}
            </div>
          </div>

          {/* Live Preview Card */}
          <div>
            <label className="block text-[11px] font-medium mb-1" style={{ color: 'var(--affine-text-secondary-color)' }}>
              Vista previa
            </label>
            <div
              className="p-2.5 rounded-xl border flex items-center gap-2.5 transition"
              style={{
                backgroundColor: 'var(--affine-background-secondary-color)',
                borderColor: 'var(--affine-border-color)'
              }}
            >
              <div
                className="w-7 h-7 rounded-lg flex items-center justify-center text-sm font-bold text-white shadow-2xs shrink-0"
                style={{ backgroundColor: selectedColor }}
              >
                {selectedIcon}
              </div>
              <div className="min-w-0 flex-1">
                <div className="font-semibold text-xs truncate" style={{ color: 'var(--affine-text-primary-color)' }}>
                  {name.trim() || 'Nuevo Espacio'}
                </div>
                <div className="text-[10px]" style={{ color: 'var(--affine-text-secondary-color)' }}>
                  1 página inicial incluida
                </div>
              </div>
            </div>
          </div>

          {/* Buttons */}
          <div className="pt-2 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-1.5 rounded-lg border text-xs font-medium transition hover:bg-[var(--affine-hover-color)]"
              style={{
                borderColor: 'var(--affine-border-color)',
                color: 'var(--affine-text-secondary-color)'
              }}
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={!name.trim() || isSubmitting}
              className="px-4 py-1.5 rounded-lg text-xs font-semibold text-white transition shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ backgroundColor: selectedColor }}
            >
              {isSubmitting ? 'Creando...' : 'Crear espacio'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
