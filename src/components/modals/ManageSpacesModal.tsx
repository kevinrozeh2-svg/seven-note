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
      className="fixed inset-0 z-50 flex items-center justify-center p-2.5 sm:p-4 bg-black/50 backdrop-blur-xs animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl rounded-xl border border-[var(--app-border-strong)] bg-[var(--app-bg-overlay)] text-[var(--app-text-primary)] shadow-[var(--app-shadow-popover)] overflow-hidden animate-in fade-in zoom-in-95 duration-150 flex flex-col max-h-[90dvh] font-sans"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start sm:items-center justify-between gap-2 px-5 py-3.5 border-b border-[var(--app-divider)] shrink-0">
          <div className="min-w-0">
            <h2 className="text-sm font-semibold text-[var(--app-text-primary)]">
              Administrar espacios de trabajo
            </h2>
            <p className="text-[11px] mt-0.5 text-[var(--app-text-muted)]">
              Ordena tus espacios, personaliza su aspecto y controla quién puede verlos.
            </p>
          </div>
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            {spaces.length > 1 && (
              <button
                type="button"
                onClick={handleSortAlphabetical}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium border border-[var(--app-border-strong)] bg-[var(--app-bg-secondary)] text-[var(--app-text-secondary)] hover:text-[var(--app-text-primary)] hover:bg-[var(--app-hover)] transition-colors cursor-pointer"
                title="Ordenar espacios alfabéticamente (A-Z)"
                aria-label="Ordenar espacios alfabéticamente (A-Z)"
              >
                <ArrowDownAZ className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Ordenar A–Z</span>
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-md hover:bg-[var(--app-hover)] transition-colors text-[var(--app-text-secondary)] hover:text-[var(--app-text-primary)] cursor-pointer"
              aria-label="Cerrar modal"
            >
              <CloseIcon className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Space List */}
        <div className="p-4 overflow-y-auto space-y-2 flex-1 custom-scrollbar">
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
                className={`rounded-lg border transition-colors ${
                  isDragOver
                    ? 'border-[var(--app-accent)] bg-[var(--app-accent-soft)]'
                    : isActive
                      ? 'border-[var(--app-border-strong)] bg-[var(--app-hover-filled)]'
                      : 'border-[var(--app-border)] bg-[var(--app-bg-secondary)] hover:border-[var(--app-border-strong)]'
                } ${draggedId === sp.id ? 'opacity-50' : ''}`}
              >
                {/* Row Summary */}
                <div className="flex flex-wrap sm:flex-nowrap items-center gap-2.5 px-3 py-2">
                  <div
                    className="hidden sm:block cursor-grab active:cursor-grabbing text-[var(--app-text-muted)] hover:text-[var(--app-text-primary)] p-0.5 shrink-0"
                    title="Arrastra para reordenar"
                  >
                    <GripVertical className="w-4 h-4" />
                  </div>

                  {/* Space Avatar */}
                  <button
                    type="button"
                    onClick={() => onSelectSpace(sp.id)}
                    className="w-7 h-7 rounded-md flex items-center justify-center text-white shrink-0 cursor-pointer transition-opacity hover:opacity-90"
                    style={{ backgroundColor: sp.color || '#7c3aed' }}
                    title="Abrir espacio"
                  >
                    {sp.icon ? <AppleEmoji emoji={sp.icon} size={16} /> : sp.name.charAt(0).toUpperCase()}
                  </button>

                  {/* Name & Visibility Badge */}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <button
                        type="button"
                        onClick={() => onSelectSpace(sp.id)}
                        className="text-xs sm:text-sm font-medium truncate hover:underline text-left cursor-pointer text-[var(--app-text-primary)]"
                      >
                        {sp.name}
                      </button>

                      {isActive && (
                        <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-[var(--app-accent-soft)] text-[var(--app-accent)]">
                          Activo
                        </span>
                      )}

                      {sp.isPrivate ? (
                        <span
                          className="inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-600 dark:text-amber-400"
                          title="Solo visible para su creador"
                        >
                          <Lock className="w-2.5 h-2.5" />
                          Privado
                        </span>
                      ) : sp.adminOnly ? (
                        <span
                          className="inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded bg-[var(--app-hover)] text-[var(--app-text-secondary)]"
                          title="Solo visible para administradores (oculto para empleados)"
                        >
                          <Shield className="w-2.5 h-2.5" />
                          Solo Admins
                        </span>
                      ) : (
                        <span
                          className="inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded bg-[var(--app-hover)] text-[var(--app-text-muted)]"
                          title="Visible para administradores y empleados"
                        >
                          <Users className="w-2.5 h-2.5" />
                          Todo el equipo
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Row Actions: Reorder + Edit + Delete */}
                  <div className="flex items-center gap-0.5 shrink-0 ml-auto">
                    <button
                      type="button"
                      disabled={idx === 0}
                      onClick={() => moveSpace(idx, -1)}
                      className="p-1.5 rounded-md hover:bg-[var(--app-hover)] text-[var(--app-text-muted)] hover:text-[var(--app-text-primary)] disabled:opacity-25 disabled:pointer-events-none transition-colors cursor-pointer"
                      title="Subir"
                      aria-label="Subir espacio"
                    >
                      <ArrowUp className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      disabled={idx === spaces.length - 1}
                      onClick={() => moveSpace(idx, 1)}
                      className="p-1.5 rounded-md hover:bg-[var(--app-hover)] text-[var(--app-text-muted)] hover:text-[var(--app-text-primary)] disabled:opacity-25 disabled:pointer-events-none transition-colors cursor-pointer"
                      title="Bajar"
                      aria-label="Bajar espacio"
                    >
                      <ArrowDown className="w-3.5 h-3.5" />
                    </button>

                    {canManage && (
                      <button
                        type="button"
                        onClick={() => (isEditing ? cancelEditing() : startEditing(sp))}
                        className={`p-1.5 rounded-md transition-colors cursor-pointer ${
                          isEditing
                            ? 'bg-[var(--app-accent-soft)] text-[var(--app-accent)]'
                            : 'hover:bg-[var(--app-hover)] text-[var(--app-text-muted)] hover:text-[var(--app-text-primary)]'
                        }`}
                        title="Editar espacio"
                        aria-label="Editar espacio"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                    )}

                    {canManage && spaces.length > 1 && (
                      <button
                        type="button"
                        onClick={() => onDeleteSpace(sp.id)}
                        className="p-1.5 rounded-md hover:bg-rose-500/10 text-[var(--app-text-muted)] hover:text-rose-500 transition-colors cursor-pointer"
                        title="Eliminar espacio"
                        aria-label="Eliminar espacio"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Inline Editor */}
                {isEditing && (
                  <div className="px-4 pb-3.5 pt-3 border-t border-[var(--app-divider)] space-y-3 bg-[var(--app-bg-primary)] rounded-b-lg">
                    {/* Name & Icon */}
                    <div className="flex items-center gap-2.5">
                      <button
                        ref={emojiBtnRef}
                        type="button"
                        onClick={() => setIsPickerOpen((p) => !p)}
                        className="w-9 h-9 rounded-md border border-[var(--app-border-strong)] bg-[var(--app-bg-secondary)] flex items-center justify-center shrink-0 hover:bg-[var(--app-hover)] transition-colors cursor-pointer"
                        title="Cambiar icono"
                      >
                        <AppleEmoji emoji={editIcon} size={20} />
                      </button>

                      {isPickerOpen && typeof document !== 'undefined' && createPortal(
                        <div
                          className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 animate-in fade-in duration-100"
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
                        className="flex-1 px-3 py-1.5 rounded-md border border-[var(--app-border-strong)] bg-[var(--app-bg-secondary)] text-[var(--app-text-primary)] text-xs outline-none focus:border-[var(--app-accent)] transition-colors"
                      />
                    </div>

                    {/* Color */}
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[11px] font-medium mr-1 text-[var(--app-text-secondary)]">
                        Color
                      </span>
                      {PRESET_COLORS.map((c) => (
                        <button
                          key={c.value}
                          type="button"
                          onClick={() => setEditColor(c.value)}
                          title={c.name}
                          className={`w-5 h-5 rounded-md transition-transform cursor-pointer ${
                            editColor === c.value ? 'ring-2 ring-offset-2 ring-[var(--app-text-primary)] ring-offset-[var(--app-bg-primary)]' : 'opacity-80 hover:opacity-100'
                          }`}
                          style={{ backgroundColor: c.value }}
                        />
                      ))}
                    </div>

                    {/* Visibility */}
                    <div>
                      <span className="block text-[11px] font-medium mb-1.5 text-[var(--app-text-secondary)]">
                        Visibilidad
                      </span>
                      <div className={`grid gap-2 ${isAdmin ? 'grid-cols-1 sm:grid-cols-3' : 'grid-cols-1 sm:grid-cols-2'}`}>
                        <button
                          type="button"
                          onClick={() => {
                            setEditIsPrivate(false)
                            setEditAdminOnly(false)
                          }}
                          className={`p-2 rounded-md border text-left transition-colors flex flex-col gap-0.5 cursor-pointer ${
                            !editIsPrivate && !editAdminOnly
                              ? 'border-[var(--app-accent)] bg-[var(--app-accent-soft)]'
                              : 'border-[var(--app-border)] bg-[var(--app-bg-secondary)] hover:bg-[var(--app-hover)]'
                          }`}
                        >
                          <div className="flex items-center gap-1.5 font-medium text-xs text-[var(--app-text-primary)]">
                            <Users className="w-3.5 h-3.5 shrink-0 text-[var(--app-text-secondary)]" />
                            <span>Todo el equipo</span>
                          </div>
                          <span className="text-[10px] text-[var(--app-text-muted)]">
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
                            className={`p-2 rounded-md border text-left transition-colors flex flex-col gap-0.5 cursor-pointer ${
                              !editIsPrivate && editAdminOnly
                                ? 'border-[var(--app-accent)] bg-[var(--app-accent-soft)]'
                                : 'border-[var(--app-border)] bg-[var(--app-bg-secondary)] hover:bg-[var(--app-hover)]'
                            }`}
                          >
                            <div className="flex items-center gap-1.5 font-medium text-xs text-[var(--app-text-primary)]">
                              <Shield className="w-3.5 h-3.5 shrink-0 text-[var(--app-text-secondary)]" />
                              <span>Solo Admins</span>
                            </div>
                            <span className="text-[10px] text-[var(--app-text-muted)]">
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
                          className={`p-2 rounded-md border text-left transition-colors flex flex-col gap-0.5 cursor-pointer ${
                            editIsPrivate
                              ? 'border-[var(--app-accent)] bg-[var(--app-accent-soft)]'
                              : 'border-[var(--app-border)] bg-[var(--app-bg-secondary)] hover:bg-[var(--app-hover)]'
                          }`}
                        >
                          <div className="flex items-center gap-1.5 font-medium text-xs text-[var(--app-text-primary)]">
                            <Lock className="w-3.5 h-3.5 shrink-0 text-[var(--app-text-secondary)]" />
                            <span>Privado</span>
                          </div>
                          <span className="text-[10px] text-[var(--app-text-muted)]">
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
                        className="flex items-center gap-1 px-3 py-1.5 rounded-md text-xs font-medium border border-[var(--app-border-strong)] bg-[var(--app-bg-secondary)] hover:bg-[var(--app-hover)] text-[var(--app-text-secondary)] hover:text-[var(--app-text-primary)] transition-colors cursor-pointer"
                      >
                        <X className="w-3.5 h-3.5" />
                        Cancelar
                      </button>
                      <button
                        type="button"
                        disabled={!editName.trim() || savingId === sp.id}
                        onClick={() => handleSaveEdit(sp)}
                        className="flex items-center gap-1 px-3.5 py-1.5 rounded-md text-xs font-medium bg-[var(--app-text-primary)] text-[var(--app-bg-primary)] hover:opacity-90 disabled:opacity-50 transition-opacity cursor-pointer"
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
        <div className="px-5 py-3 border-t border-[var(--app-divider)] bg-[var(--app-bg-secondary)] flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2 shrink-0">
          <span className="text-[11px] text-center sm:text-left text-[var(--app-text-muted)]">
            Usa las flechas o arrastra las filas para cambiar el orden.
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                onClose()
                onOpenCreateSpace()
              }}
              className="w-full sm:w-auto flex items-center justify-center gap-1.5 px-3.5 py-1.5 rounded-md text-xs font-medium bg-[var(--app-text-primary)] text-[var(--app-bg-primary)] hover:opacity-90 transition-opacity cursor-pointer"
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
