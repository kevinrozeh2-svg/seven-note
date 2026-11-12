import { useState, useRef } from 'react'
import { createPortal } from 'react-dom'
import { CloseIcon } from '@blocksuite/icons/rc'
import {
  ArrowDown,
  ArrowDownAZ,
  ArrowUp,
  Check,
  GripVertical,
  Lock,
  Pencil,
  Plus,
  Shield,
  Trash2,
  Users,
  X
} from 'lucide-react'
import type { SpaceItem } from '../../db'
import { canUserManageSpace, type TeamMember } from '../../lib/teamAuth'
import { AppleEmoji } from '../ui/AppleEmoji'
import { EmojiPickerPopover } from './EmojiPickerPopover'

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

interface ManageSpacesModalProps {
  isOpen: boolean
  onClose: () => void
  spaces: SpaceItem[]
  activeSpaceId: string
  onSelectSpace: (spaceId: string) => void
  onUpdateSpace: (
    spaceId: string,
    updates: Partial<Pick<SpaceItem, 'name' | 'icon' | 'color' | 'isPrivate' | 'adminOnly'>>
  ) => Promise<void>
  onReorderSpaces: (orderedSpaceIds: string[]) => Promise<void>
  onDeleteSpace: (spaceId: string) => Promise<void> | void
  onOpenCreateSpace: () => void
  isAdmin: boolean
  currentMember: TeamMember | null
  authUserId?: string
}

export function ManageSpacesModal({
  isOpen,
  onClose,
  spaces,
  activeSpaceId,
  onSelectSpace,
  onUpdateSpace,
  onReorderSpaces,
  onDeleteSpace,
  onOpenCreateSpace,
  isAdmin,
  currentMember,
  authUserId
}: ManageSpacesModalProps) {
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [editIcon, setEditIcon] = useState('💼')
  const [editColor, setEditColor] = useState('#1e96eb')
  const [editIsPrivate, setEditIsPrivate] = useState(false)
  const [editAdminOnly, setEditAdminOnly] = useState(false)
  const [isPickerOpen, setIsPickerOpen] = useState(false)
  const [savingId, setSavingId] = useState<string | null>(null)
  const [draggedId, setDraggedId] = useState<string | null>(null)
  const [dragOverId, setDragOverId] = useState<string | null>(null)
  const emojiBtnRef = useRef<HTMLButtonElement>(null)

  if (!isOpen) return null

  const startEditing = (sp: SpaceItem) => {
    setEditingId(sp.id)
    setEditName(sp.name)
    setEditIcon(sp.icon || '💼')
    setEditColor(sp.color || '#1e96eb')
    setEditIsPrivate(Boolean(sp.isPrivate))
    setEditAdminOnly(Boolean(sp.adminOnly))
    setIsPickerOpen(false)
  }

  const cancelEditing = () => {
    setEditingId(null)
    setIsPickerOpen(false)
  }

  const handleSaveEdit = async (sp: SpaceItem) => {
    const trimmed = editName.trim()
    if (!trimmed) return
    try {
      setSavingId(sp.id)
      await onUpdateSpace(sp.id, {
        name: trimmed,
        icon: editIcon,
        color: editColor,
        isPrivate: editIsPrivate,
        adminOnly: isAdmin ? (!editIsPrivate && editAdminOnly) : Boolean(sp.adminOnly)
      })
      setEditingId(null)
      setIsPickerOpen(false)
    } finally {
      setSavingId(null)
    }
  }

  const moveSpace = async (index: number, direction: -1 | 1) => {
    const targetIndex = index + direction
    if (targetIndex < 0 || targetIndex >= spaces.length) return
    const next = [...spaces]
    const [moved] = next.splice(index, 1)
    next.splice(targetIndex, 0, moved)
    await onReorderSpaces(next.map((s) => s.id))
  }

  const handleSortAlphabetical = async () => {
    const sorted = [...spaces].sort((a, b) => a.name.localeCompare(b.name, 'es', { sensitivity: 'base' }))
    await onReorderSpaces(sorted.map((s) => s.id))
  }

  const handleDropOnRow = async (targetId: string) => {
    if (!draggedId || draggedId === targetId) {
      setDraggedId(null)
      setDragOverId(null)
      return
    }
    const fromIndex = spaces.findIndex((s) => s.id === draggedId)
    const toIndex = spaces.findIndex((s) => s.id === targetId)
    if (fromIndex === -1 || toIndex === -1) {
      setDraggedId(null)
      setDragOverId(null)
      return
    }
    const next = [...spaces]
    const [moved] = next.splice(fromIndex, 1)
    next.splice(toIndex, 0, moved)
    setDraggedId(null)
    setDragOverId(null)
    await onReorderSpaces(next.map((s) => s.id))
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl rounded-2xl border shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150 flex flex-col max-h-[88vh]"
        style={{
          backgroundColor: 'var(--affine-background-primary-color)',
          borderColor: 'var(--affine-border-color)'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-5 py-4 border-b shrink-0"
          style={{ borderColor: 'var(--affine-border-color)' }}
        >
          <div>
            <h2 className="text-base font-semibold" style={{ color: 'var(--affine-text-primary-color)' }}>
              Administrar espacios de trabajo
            </h2>
            <p className="text-xs mt-0.5" style={{ color: 'var(--affine-text-secondary-color)' }}>
              Ordena tus espacios, personaliza su aspecto y controla quién puede verlos.
            </p>
          </div>
          <div className="flex items-center gap-2">
            {spaces.length > 1 && (
              <button
                type="button"
                onClick={handleSortAlphabetical}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium border border-black/[0.08] dark:border-white/[0.1] hover:bg-black/[0.04] dark:hover:bg-white/[0.06] transition cursor-pointer"
                style={{ color: 'var(--affine-text-secondary-color)' }}
                title="Ordenar espacios alfabéticamente (A-Z)"
              >
                <ArrowDownAZ className="w-3.5 h-3.5" />
                <span>Ordenar A–Z</span>
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/10 transition text-neutral-400 hover:text-neutral-200 cursor-pointer"
            >
              <CloseIcon className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Space List */}
        <div className="p-4 overflow-y-auto space-y-2.5 flex-1">
          {spaces.map((sp, idx) => {
            const isEditing = editingId === sp.id
            const canManage = canUserManageSpace(sp, currentMember, authUserId)
            const isActive = sp.id === activeSpaceId
            const isDragOver = dragOverId === sp.id && draggedId !== sp.id

            return (
              <div
                key={sp.id}
                draggable={!isEditing}
                onDragStart={(e) => {
                  setDraggedId(sp.id)
                  e.dataTransfer.effectAllowed = 'move'
                }}
                onDragOver={(e) => {
                  e.preventDefault()
                  if (draggedId && draggedId !== sp.id) {
                    setDragOverId(sp.id)
                  }
                }}
                onDragLeave={() => {
                  if (dragOverId === sp.id) setDragOverId(null)
                }}
                onDrop={(e) => {
                  e.preventDefault()
                  handleDropOnRow(sp.id)
                }}
                onDragEnd={() => {
                  setDraggedId(null)
                  setDragOverId(null)
                }}
                className={`rounded-xl border transition-all ${
                  isDragOver
                    ? 'border-blue-500 ring-2 ring-blue-500/30 bg-blue-500/5'
                    : isActive
                      ? 'border-blue-500/40 bg-black/[0.02] dark:bg-white/[0.03]'
                      : 'border-black/[0.08] dark:border-white/[0.08]'
                } ${draggedId === sp.id ? 'opacity-50' : ''}`}
              >
                {/* Row Summary */}
                <div className="flex items-center gap-2.5 px-3 py-2.5">
                  <div
                    className="cursor-grab active:cursor-grabbing text-neutral-400 hover:text-neutral-200 p-0.5 shrink-0"
                    title="Arrastra para reordenar"
                  >
                    <GripVertical className="w-4 h-4" />
                  </div>

                  {/* Space Avatar */}
                  <button
                    type="button"
                    onClick={() => onSelectSpace(sp.id)}
                    className="w-8 h-8 rounded-lg flex items-center justify-center text-white shrink-0 shadow-xs cursor-pointer transition hover:scale-105"
                    style={{ backgroundColor: sp.color || '#1e96eb' }}
                    title="Abrir espacio"
                  >
                    {sp.icon ? <AppleEmoji emoji={sp.icon} size={17} /> : sp.name.charAt(0).toUpperCase()}
                  </button>

                  {/* Name & Visibility Badge */}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <button
                        type="button"
                        onClick={() => onSelectSpace(sp.id)}
                        className="text-sm font-semibold truncate hover:underline text-left cursor-pointer"
                        style={{ color: 'var(--affine-text-primary-color)' }}
                      >
                        {sp.name}
                      </button>

                      {isActive && (
                        <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-500">
                          Activo
                        </span>
                      )}

                      {sp.isPrivate ? (
                        <span
                          className="inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-500"
                          title="Solo visible para su creador"
                        >
                          <Lock className="w-2.5 h-2.5" />
                          Privado
                        </span>
                      ) : sp.adminOnly ? (
                        <span
                          className="inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded bg-indigo-500/15 text-indigo-400"
                          title="Solo visible para administradores (oculto para empleados)"
                        >
                          <Shield className="w-2.5 h-2.5" />
                          Solo Admins
                        </span>
                      ) : (
                        <span
                          className="inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-400"
                          title="Visible para administradores y empleados"
                        >
                          <Users className="w-2.5 h-2.5" />
                          Todo el equipo
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Row Actions: Reorder + Edit + Delete */}
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      disabled={idx === 0}
                      onClick={() => moveSpace(idx, -1)}
                      className="p-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/10 text-neutral-400 hover:text-neutral-200 disabled:opacity-25 disabled:pointer-events-none transition cursor-pointer"
                      title="Subir"
                    >
                      <ArrowUp className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      disabled={idx === spaces.length - 1}
                      onClick={() => moveSpace(idx, 1)}
                      className="p-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/10 text-neutral-400 hover:text-neutral-200 disabled:opacity-25 disabled:pointer-events-none transition cursor-pointer"
                      title="Bajar"
                    >
                      <ArrowDown className="w-3.5 h-3.5" />
                    </button>

                    {canManage && (
                      <button
                        type="button"
                        onClick={() => (isEditing ? cancelEditing() : startEditing(sp))}
                        className={`p-1.5 rounded-lg transition cursor-pointer ${
                          isEditing
                            ? 'bg-blue-500/15 text-blue-400'
                            : 'hover:bg-black/5 dark:hover:bg-white/10 text-neutral-400 hover:text-neutral-200'
                        }`}
                        title="Editar espacio"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                    )}

                    {canManage && spaces.length > 1 && (
                      <button
                        type="button"
                        onClick={() => onDeleteSpace(sp.id)}
                        className="p-1.5 rounded-lg hover:bg-rose-500/15 text-neutral-400 hover:text-rose-400 transition cursor-pointer"
                        title="Eliminar espacio"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Inline Editor */}
                {isEditing && (
                  <div
                    className="px-4 pb-4 pt-3 border-t space-y-3 bg-black/[0.02] dark:bg-white/[0.02]"
                    style={{ borderColor: 'var(--affine-border-color)' }}
                  >
                    {/* Name & Icon */}
                    <div className="flex items-center gap-2.5">
                      <button
                        ref={emojiBtnRef}
                        type="button"
                        onClick={() => setIsPickerOpen((p) => !p)}
                        className="w-10 h-10 rounded-xl border flex items-center justify-center shrink-0 hover:bg-black/5 dark:hover:bg-white/5 transition cursor-pointer"
                        style={{
                          borderColor: 'var(--affine-border-color)',
                          backgroundColor: 'var(--affine-background-secondary-color)'
                        }}
                        title="Cambiar icono"
                      >
                        <AppleEmoji emoji={editIcon} size={22} />
                      </button>

                      {isPickerOpen && typeof document !== 'undefined' && createPortal(
                        <div
                          className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-100"
                          onClick={() => setIsPickerOpen(false)}
                        >
                          <div onClick={(e) => e.stopPropagation()} className="relative">
                            <EmojiPickerPopover
                              currentIcon={editIcon}
                              isOpen={isPickerOpen}
                              onSelectEmoji={(emoji: string) => {
                                setEditIcon(emoji)
                                setIsPickerOpen(false)
                              }}
                              onClose={() => setIsPickerOpen(false)}
                              title="Seleccionar Icono del Espacio"
                              isModal={true}
                            />
                          </div>
                        </div>,
                        document.body
                      )}

                      <input
                        type="text"
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        placeholder="Nombre del espacio"
                        className="flex-1 px-3 py-2 rounded-xl border text-sm outline-none focus:ring-2 focus:ring-blue-500/40"
                        style={{
                          backgroundColor: 'var(--affine-background-secondary-color)',
                          borderColor: 'var(--affine-border-color)',
                          color: 'var(--affine-text-primary-color)'
                        }}
                      />
                    </div>

                    {/* Color */}
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-medium mr-1" style={{ color: 'var(--affine-text-secondary-color)' }}>
                        Color:
                      </span>
                      {PRESET_COLORS.map((c) => (
                        <button
                          key={c.value}
                          type="button"
                          onClick={() => setEditColor(c.value)}
                          title={c.name}
                          className={`w-5 h-5 rounded-full transition-transform cursor-pointer ${
                            editColor === c.value ? 'scale-125 ring-2 ring-white shadow-sm' : 'opacity-75 hover:opacity-100'
                          }`}
                          style={{ backgroundColor: c.value }}
                        />
                      ))}
                    </div>

                    {/* Visibility */}
                    <div>
                      <span className="block text-xs font-medium mb-1.5" style={{ color: 'var(--affine-text-secondary-color)' }}>
                        ¿Quién puede ver este espacio?
                      </span>
                      <div className={`grid gap-2 ${isAdmin ? 'grid-cols-3' : 'grid-cols-2'}`}>
                        <button
                          type="button"
                          onClick={() => {
                            setEditIsPrivate(false)
                            setEditAdminOnly(false)
                          }}
                          className={`p-2 rounded-xl border text-left transition flex flex-col gap-0.5 cursor-pointer ${
                            !editIsPrivate && !editAdminOnly
                              ? 'border-blue-500 bg-blue-500/10 ring-1 ring-blue-500'
                              : 'border-black/[0.08] dark:border-white/[0.08] hover:bg-black/[0.03] dark:hover:bg-white/[0.03]'
                          }`}
                        >
                          <div className="flex items-center gap-1.5 font-semibold text-xs text-blue-500">
                            <Users className="w-3.5 h-3.5 shrink-0" />
                            <span>Todo el equipo</span>
                          </div>
                          <span className="text-[10px] text-neutral-500 dark:text-neutral-400">
                            Admins y empleados
                          </span>
                        </button>

                        {isAdmin && (
                          <button
                            type="button"
                            onClick={() => {
                              setEditIsPrivate(false)
                              setEditAdminOnly(true)
                            }}
                            className={`p-2 rounded-xl border text-left transition flex flex-col gap-0.5 cursor-pointer ${
                              !editIsPrivate && editAdminOnly
                                ? 'border-indigo-500 bg-indigo-500/10 ring-1 ring-indigo-500'
                                : 'border-black/[0.08] dark:border-white/[0.08] hover:bg-black/[0.03] dark:hover:bg-white/[0.03]'
                            }`}
                          >
                            <div className="flex items-center gap-1.5 font-semibold text-xs text-indigo-400">
                              <Shield className="w-3.5 h-3.5 shrink-0" />
                              <span>Solo Admins</span>
                            </div>
                            <span className="text-[10px] text-neutral-500 dark:text-neutral-400">
                              Oculto a empleados
                            </span>
                          </button>
                        )}

                        <button
                          type="button"
                          onClick={() => {
                            setEditIsPrivate(true)
                            setEditAdminOnly(false)
                          }}
                          className={`p-2 rounded-xl border text-left transition flex flex-col gap-0.5 cursor-pointer ${
                            editIsPrivate
                              ? 'border-amber-500 bg-amber-500/10 ring-1 ring-amber-500'
                              : 'border-black/[0.08] dark:border-white/[0.08] hover:bg-black/[0.03] dark:hover:bg-white/[0.03]'
                          }`}
                        >
                          <div className="flex items-center gap-1.5 font-semibold text-xs text-amber-500">
                            <Lock className="w-3.5 h-3.5 shrink-0" />
                            <span>Privado</span>
                          </div>
                          <span className="text-[10px] text-neutral-500 dark:text-neutral-400">
                            Solo tú lo ves
                          </span>
                        </button>
                      </div>
                    </div>

                    {/* Save / Cancel */}
                    <div className="flex items-center justify-end gap-2 pt-1">
                      <button
                        type="button"
                        onClick={cancelEditing}
                        className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-black/5 dark:hover:bg-white/10 transition cursor-pointer"
                        style={{ color: 'var(--affine-text-secondary-color)' }}
                      >
                        <X className="w-3.5 h-3.5" />
                        Cancelar
                      </button>
                      <button
                        type="button"
                        disabled={!editName.trim() || savingId === sp.id}
                        onClick={() => handleSaveEdit(sp)}
                        className="flex items-center gap-1 px-3.5 py-1.5 rounded-lg text-xs font-medium bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-50 transition cursor-pointer"
                      >
                        <Check className="w-3.5 h-3.5" />
                        {savingId === sp.id ? 'Guardando...' : 'Guardar cambios'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {/* Footer */}
        <div
          className="px-5 py-3.5 border-t flex items-center justify-between shrink-0"
          style={{
            borderColor: 'var(--affine-border-color)',
            backgroundColor: 'var(--affine-background-secondary-color)'
          }}
        >
          <span className="text-[11px]" style={{ color: 'var(--affine-text-secondary-color)' }}>
            Tip: arrastra las filas o usa las flechas para cambiar el orden.
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                onClose()
                onOpenCreateSpace()
              }}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-medium bg-blue-600 hover:bg-blue-700 text-white transition cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Nuevo espacio</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
