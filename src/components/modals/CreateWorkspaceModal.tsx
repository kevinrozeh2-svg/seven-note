import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { CloseIcon, LocalWorkspaceIcon } from '@blocksuite/icons/rc'
import { Lock, Shield, Users } from 'lucide-react'
import { AppleEmoji } from '../ui/AppleEmoji'
import { EmojiPickerPopover } from './EmojiPickerPopover'

interface CreateWorkspaceModalProps {
  isOpen: boolean
  onClose: () => void
  onCreate: (name: string, icon: string, color: string, isPrivate?: boolean, adminOnly?: boolean) => Promise<void>
  isAdmin?: boolean
}

const PRESET_EMOJIS = ['✨', '🤍', '🫧', '🎧', '🪐', '🌿', '☕', '🧸', '💼', '🚀', '💡', '📚', '🎨', '💻', '🎯', '⚡']

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

export function CreateWorkspaceModal({ isOpen, onClose, onCreate, isAdmin = false }: CreateWorkspaceModalProps) {
  const [name, setName] = useState('')
  const [selectedIcon, setSelectedIcon] = useState('💼')
  const [selectedColor, setSelectedColor] = useState('#1e96eb')
  const [isPrivate, setIsPrivate] = useState(false)
  const [adminOnly, setAdminOnly] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isPickerOpen, setIsPickerOpen] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (isOpen) {
      setName('')
      setSelectedIcon('💼')
      setSelectedColor('#1e96eb')
      setIsPrivate(false)
      setAdminOnly(false)
      setIsSubmitting(false)
      setIsPickerOpen(false)
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
      await onCreate(trimmed, selectedIcon, selectedColor, isPrivate, isAdmin ? (!isPrivate && adminOnly) : false)
      onClose()
    } catch (err) {
      console.error('Error creating workspace', err)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-2.5 sm:p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-2xl border shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150 flex flex-col max-h-[90dvh] overflow-y-auto"
        style={{
          backgroundColor: 'var(--affine-background-primary-color)',
          borderColor: 'var(--affine-border-color)'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          className="px-4 sm:px-5 py-3.5 sm:py-4 border-b flex items-center justify-between gap-2"
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
        <form onSubmit={handleSubmit} className="p-4 sm:p-5 space-y-4 text-xs">
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
          <div className="relative">
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-medium" style={{ color: 'var(--affine-text-secondary-color)' }}>
                Icono / Emoji del espacio
              </label>
              <button
                type="button"
                onClick={() => setIsPickerOpen(!isPickerOpen)}
                className="text-[11px] font-medium text-blue-500 hover:text-blue-600 dark:hover:text-blue-400 cursor-pointer flex items-center gap-1"
              >
                <span>Explorar todos (1,870)</span>
                <span>→</span>
              </button>
            </div>

            <div className="flex items-center gap-2 mb-2">
              <button
                type="button"
                onClick={() => setIsPickerOpen(!isPickerOpen)}
                className="w-10 h-10 rounded-xl flex items-center justify-center border transition hover:scale-105 active:scale-95 shadow-xs cursor-pointer shrink-0"
                style={{
                  borderColor: selectedColor,
                  backgroundColor: `${selectedColor}15`
                }}
                title="Clic para abrir todos los emojis Apple"
              >
                <AppleEmoji emoji={selectedIcon} size={24} />
              </button>
              <div className="text-[11px] text-neutral-500 dark:text-neutral-400 leading-tight">
                Icono seleccionado. Puedes escoger uno de los accesos rápidos o abrir la lista completa.
              </div>
            </div>

            <div className="grid grid-cols-6 sm:grid-cols-8 gap-1.5 p-2 rounded-xl border place-items-center" style={{ borderColor: 'var(--affine-border-color)', backgroundColor: 'var(--affine-background-secondary-color)' }}>
              {PRESET_EMOJIS.map((emoji) => (
                <button
                  key={emoji}
                  type="button"
                  onClick={() => setSelectedIcon(emoji)}
                  className={`w-9 h-9 sm:w-8 sm:h-8 rounded-lg flex items-center justify-center transition cursor-pointer ${
                    selectedIcon === emoji
                      ? 'scale-110 shadow-sm ring-2 ring-offset-1'
                      : 'hover:bg-[var(--affine-hover-color)] opacity-85 hover:opacity-100'
                  }`}
                  style={{
                    backgroundColor: selectedIcon === emoji ? `${selectedColor}25` : 'transparent',
                    boxShadow: selectedIcon === emoji ? `0 0 0 2px ${selectedColor}` : 'none'
                  }}
                >
                  <AppleEmoji emoji={emoji} size={18} />
                </button>
              ))}
            </div>

            {isPickerOpen && typeof document !== 'undefined' && createPortal(
              <div
                className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-100"
                onClick={() => setIsPickerOpen(false)}
              >
                <div onClick={(e) => e.stopPropagation()} className="relative">
                  <EmojiPickerPopover
                    currentIcon={selectedIcon}
                    isOpen={isPickerOpen}
                    onClose={() => setIsPickerOpen(false)}
                    onSelectEmoji={(emoji) => {
                      setSelectedIcon(emoji)
                      setIsPickerOpen(false)
                    }}
                    title="Seleccionar Icono del Espacio"
                    isModal={true}
                  />
                </div>
              </div>,
              document.body
            )}
          </div>

          {/* Workspace Visibility */}
          <div>
            <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--affine-text-secondary-color)' }}>
              Visibilidad del espacio
            </label>
            <div className={`grid gap-2 ${isAdmin ? 'grid-cols-1 sm:grid-cols-3' : 'grid-cols-1 sm:grid-cols-2'}`}>
              <button
                type="button"
                onClick={() => {
                  setIsPrivate(false)
                  setAdminOnly(false)
                }}
                className={`p-2.5 rounded-xl border text-left transition flex flex-col gap-1 cursor-pointer ${
                  !isPrivate && !adminOnly
                    ? 'border-blue-500 bg-blue-500/10 shadow-xs ring-1 ring-blue-500'
                    : 'border-black/[0.08] dark:border-white/[0.08] hover:bg-black/[0.03] dark:hover:bg-white/[0.03]'
                }`}
              >
                <div className="flex items-center gap-1.5 font-semibold text-xs" style={{ color: !isPrivate && !adminOnly ? '#2563eb' : 'var(--affine-text-primary-color)' }}>
                  <Users className="w-3.5 h-3.5 shrink-0" />
                  <span>Todo el equipo</span>
                </div>
                <p className="text-[10px] leading-tight text-neutral-500 dark:text-neutral-400">
                  Visible para admins y empleados.
                </p>
              </button>

              {isAdmin && (
                <button
                  type="button"
                  onClick={() => {
                    setIsPrivate(false)
                    setAdminOnly(true)
                  }}
                  className={`p-2.5 rounded-xl border text-left transition flex flex-col gap-1 cursor-pointer ${
                    !isPrivate && adminOnly
                      ? 'border-indigo-500 bg-indigo-500/10 shadow-xs ring-1 ring-indigo-500'
                      : 'border-black/[0.08] dark:border-white/[0.08] hover:bg-black/[0.03] dark:hover:bg-white/[0.03]'
                  }`}
                >
                  <div className="flex items-center gap-1.5 font-semibold text-xs text-indigo-500 dark:text-indigo-400">
                    <Shield className="w-3.5 h-3.5 shrink-0" />
                    <span>Solo Admins</span>
                  </div>
                  <p className="text-[10px] leading-tight text-neutral-500 dark:text-neutral-400">
                    Oculto para empleados. Solo administradores.
                  </p>
                </button>
              )}

              <button
                type="button"
                onClick={() => {
                  setIsPrivate(true)
                  setAdminOnly(false)
                }}
                className={`p-2.5 rounded-xl border text-left transition flex flex-col gap-1 cursor-pointer ${
                  isPrivate
                    ? 'border-amber-500 bg-amber-500/10 shadow-xs ring-1 ring-amber-500'
                    : 'border-black/[0.08] dark:border-white/[0.08] hover:bg-black/[0.03] dark:hover:bg-white/[0.03]'
                }`}
              >
                <div className="flex items-center gap-1.5 font-semibold text-xs text-amber-600 dark:text-amber-400">
                  <Lock className="w-3.5 h-3.5 shrink-0" />
                  <span>Privado</span>
                </div>
                <p className="text-[10px] leading-tight text-neutral-500 dark:text-neutral-400">
                  Solo tú tienes acceso. Nadie más puede verlo.
                </p>
              </button>
            </div>
          </div>

          {/* Color Selection */}
          <div>
            <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--affine-text-secondary-color)' }}>
              Color del espacio
            </label>
            <div className="flex items-center flex-wrap gap-2.5 sm:gap-2 p-2.5 sm:p-2 rounded-xl border" style={{ borderColor: 'var(--affine-border-color)', backgroundColor: 'var(--affine-background-secondary-color)' }}>
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
                <AppleEmoji emoji={selectedIcon} size={18} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="font-semibold text-xs truncate" style={{ color: 'var(--affine-text-primary-color)' }}>
                  {name.trim() || 'Nuevo Espacio'}
                </div>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-[10px]" style={{ color: 'var(--affine-text-secondary-color)' }}>
                    1 página inicial incluida
                  </span>
                  <span className="text-[10px] text-neutral-300 dark:text-neutral-600">•</span>
                  <span className={`text-[10px] font-semibold px-1.5 py-0.2 rounded-full inline-flex items-center gap-1 ${
                    isPrivate
                      ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30'
                      : 'bg-blue-500/15 text-blue-600 dark:text-blue-400 border border-blue-500/20'
                  }`}>
                    {isPrivate ? <Lock className="w-2.5 h-2.5" /> : <Users className="w-2.5 h-2.5" />}
                    <span>{isPrivate ? 'Privado (Solo tú)' : 'Público (Equipo)'}</span>
                  </span>
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
