import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import {
  CloseIcon,
  TagsIcon,
  PlusIcon,
  DeleteIcon,
  EditIcon,
  DoneIcon
} from '@blocksuite/icons/rc'
import {
  db,
  type WorkspaceItem,
  AFFINE_TAG_COLORS,
  getOrCreateTag,
  updateTagColor,
  renameTag,
  deleteTag
} from '../../db'
import { toast } from 'sonner'

interface TagsModalProps {
  isOpen: boolean
  onClose: () => void
  spaceId: string
  workspaces: WorkspaceItem[]
  onSelectWorkspace: (id: string) => void
  initialSelectedTag?: string | null
}

export function TagsModal({
  isOpen,
  onClose,
  spaceId,
  workspaces,
  onSelectWorkspace,
  initialSelectedTag = null
}: TagsModalProps) {
  const dbTags = useLiveQuery(
    () => db.tags.where('spaceId').equals(spaceId).toArray(),
    [spaceId]
  ) ?? []

  // Collect all unique tag names from workspaces and dbTags
  const activeWorkspaces = workspaces.filter((w) => !w.isDeleted)
  const workspaceTagNames = Array.from(
    new Set(activeWorkspaces.flatMap((w) => w.tags || []).filter(Boolean))
  )

  const allTagNames = Array.from(
    new Set([...dbTags.map((t) => t.name), ...workspaceTagNames])
  )

  const [selectedTagName, setSelectedTagName] = useState<string | null>(initialSelectedTag || allTagNames[0] || null)
  const [newTagInput, setNewTagInput] = useState('')
  const [editingTagName, setEditingTagName] = useState<string | null>(null)
  const [editInputName, setEditInputName] = useState('')

  if (!isOpen) return null

  const getTagColor = (name: string) => {
    const found = dbTags.find((t) => t.name.toLowerCase() === name.toLowerCase())
    if (found) return found.color
    return '#1e96eb'
  }

  const activeTag = selectedTagName || allTagNames[0] || null

  const handleCreateTag = async () => {
    if (!newTagInput.trim()) return
    await getOrCreateTag(spaceId, newTagInput.trim())
    setSelectedTagName(newTagInput.trim())
    setNewTagInput('')
    toast.success('Etiqueta creada')
  }

  const handleRename = async (oldName: string) => {
    if (!editInputName.trim() || editInputName.trim() === oldName) {
      setEditingTagName(null)
      return
    }
    const tag = dbTags.find((t) => t.name === oldName)
    if (tag) {
      await renameTag(tag.id, spaceId, oldName, editInputName.trim())
    }
    setSelectedTagName(editInputName.trim())
    setEditingTagName(null)
    toast.success('Etiqueta renombrada')
  }

  const handleDelete = async (name: string) => {
    if (!confirm(`¿Eliminar la etiqueta "${name}" de todas las notas?`)) return
    const tag = dbTags.find((t) => t.name === name)
    if (tag) {
      await deleteTag(tag.id, spaceId, name)
    } else {
      // Clean from workspaces directly
      for (const w of activeWorkspaces) {
        if (w.tags && w.tags.includes(name)) {
          await db.workspaces.update(w.id, {
            tags: w.tags.filter((t) => t !== name),
            updatedAt: Date.now()
          })
        }
      }
    }
    if (selectedTagName === name) {
      setSelectedTagName(null)
    }
    toast.success('Etiqueta eliminada')
  }

  const handleColorChange = async (name: string, colorHex: string) => {
    const tag = await getOrCreateTag(spaceId, name, colorHex)
    await updateTagColor(tag.id, colorHex)
    toast.success('Color actualizado')
  }

  // Documents tagged with the active tag
  const matchingDocs = activeTag
    ? activeWorkspaces.filter((w) => w.tags && w.tags.includes(activeTag))
    : []

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 animate-in fade-in duration-150">
      <div className="w-full max-w-3xl rounded-2xl border border-[var(--affine-border-color)] bg-[var(--affine-background-overlay-panel-color)] shadow-[var(--affine-popover-shadow)] overflow-hidden flex flex-col h-[540px] text-[var(--affine-text-primary-color)] font-sans">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--affine-border-color)] shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[var(--affine-primary-color)]/10 text-[var(--affine-primary-color)] flex items-center justify-center">
              <TagsIcon className="w-4.5 h-4.5" />
            </div>
            <div>
              <h2 className="text-base font-semibold">Gestor de Etiquetas</h2>
              <p className="text-xs text-[var(--affine-text-secondary-color)]">
                Organiza y clasifica tus páginas con etiquetas de colores estilo AFFiNE
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-[var(--affine-text-secondary-color)] hover:text-[var(--affine-text-primary-color)] hover:bg-[var(--affine-hover-color)] transition"
          >
            <CloseIcon className="w-4 h-4" />
          </button>
        </div>

        {/* Content Split Columns */}
        <div className="flex-1 flex overflow-hidden">
          {/* Left Column: Tags List */}
          <div className="w-64 border-r border-[var(--affine-border-color)] p-3 flex flex-col justify-between shrink-0 bg-[var(--affine-background-secondary-color)]">
            <div className="overflow-y-auto space-y-1">
              <div className="text-[10px] uppercase font-bold text-[var(--affine-text-secondary-color)] px-2 py-1">
                Etiquetas ({allTagNames.length})
              </div>

              {allTagNames.map((name) => {
                const isSelected = activeTag === name
                const tagColor = getTagColor(name)
                const count = activeWorkspaces.filter((w) => w.tags && w.tags.includes(name)).length
                const isEditing = editingTagName === name

                if (isEditing) {
                  return (
                    <div key={name} className="p-1">
                      <input
                        type="text"
                        value={editInputName}
                        onChange={(e) => setEditInputName(e.target.value)}
                        onBlur={() => handleRename(name)}
                        onKeyDown={(e) => e.key === 'Enter' && handleRename(name)}
                        autoFocus
                        className="w-full bg-[var(--affine-background-primary-color)] border border-[var(--affine-border-color)] rounded px-2 py-1 text-xs outline-none"
                      />
                    </div>
                  )
                }

                return (
                  <div
                    key={name}
                    onClick={() => setSelectedTagName(name)}
                    className={`group flex items-center justify-between px-2.5 py-2 rounded-xl text-xs cursor-pointer transition ${
                      isSelected
                        ? 'bg-[var(--affine-hover-color)] font-semibold text-[var(--affine-text-primary-color)] shadow-2xs'
                        : 'text-[var(--affine-text-secondary-color)] hover:text-[var(--affine-text-primary-color)] hover:bg-[var(--affine-hover-color)]'
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <span
                        className="w-2.5 h-2.5 rounded-full shrink-0 shadow-2xs"
                        style={{ backgroundColor: tagColor }}
                      />
                      <span className="truncate flex-1">{name}</span>
                      <span className="text-[10px] opacity-60 font-mono shrink-0">
                        {count}
                      </span>
                    </div>

                    <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition shrink-0 ml-1">
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          setEditingTagName(name)
                          setEditInputName(name)
                        }}
                        className="p-1 rounded hover:bg-[var(--affine-hover-color)] text-[var(--affine-icon-color)]"
                        title="Renombrar"
                      >
                        <EditIcon className="w-3 h-3" />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          handleDelete(name)
                        }}
                        className="p-1 rounded hover:bg-rose-500/10 text-rose-500"
                        title="Eliminar etiqueta"
                      >
                        <DeleteIcon className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                )
              })}

              {allTagNames.length === 0 && (
                <div className="text-center py-8 text-xs text-[var(--affine-text-secondary-color)]">
                  No hay etiquetas creadas.
                </div>
              )}
            </div>

            {/* Quick Add Tag Input */}
            <div className="pt-2 border-t border-[var(--affine-divider-color)]">
              <div className="flex items-center gap-1.5 p-1 bg-[var(--affine-background-primary-color)] rounded-xl border border-[var(--affine-border-color)]">
                <input
                  type="text"
                  placeholder="Nueva etiqueta..."
                  value={newTagInput}
                  onChange={(e) => setNewTagInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleCreateTag()}
                  className="flex-1 text-xs bg-transparent outline-none px-1.5 py-1 text-[var(--affine-text-primary-color)]"
                />
                <button
                  onClick={handleCreateTag}
                  className="p-1.5 rounded-lg bg-[var(--affine-primary-color)] text-white hover:opacity-90 transition"
                  title="Añadir"
                >
                  <PlusIcon className="w-3 h-3" />
                </button>
              </div>
            </div>
          </div>

          {/* Right Column: Tag Details & Filtered Docs */}
          <div className="flex-1 p-5 flex flex-col overflow-hidden">
            {activeTag ? (
              <>
                <div className="flex items-center justify-between pb-3 border-b border-[var(--affine-border-color)] mb-4">
                  <div className="flex items-center gap-2.5">
                    <span
                      className="w-3.5 h-3.5 rounded-full shadow-2xs"
                      style={{ backgroundColor: getTagColor(activeTag) }}
                    />
                    <div>
                      <h3 className="text-base font-bold">{activeTag}</h3>
                      <p className="text-xs text-[var(--affine-text-secondary-color)]">
                        {matchingDocs.length} documento(s) con esta etiqueta
                      </p>
                    </div>
                  </div>

                  {/* Palette color picker */}
                  <div className="flex items-center gap-1">
                    {AFFINE_TAG_COLORS.map((c) => (
                      <button
                        key={c.hex}
                        onClick={() => handleColorChange(activeTag, c.hex)}
                        className={`w-5 h-5 rounded-full transition transform hover:scale-110 flex items-center justify-center ${
                          getTagColor(activeTag) === c.hex ? 'ring-2 ring-[var(--affine-text-primary-color)] scale-110' : ''
                        }`}
                        style={{ backgroundColor: c.hex }}
                        title={c.name}
                      >
                        {getTagColor(activeTag) === c.hex && (
                          <DoneIcon className="w-2.5 h-2.5 text-white" />
                        )}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Documents List */}
                <div className="flex-1 overflow-y-auto space-y-1.5">
                  {matchingDocs.length === 0 ? (
                    <div className="py-16 text-center text-xs text-[var(--affine-text-secondary-color)]">
                      Ningún documento tiene asignada la etiqueta "{activeTag}".
                    </div>
                  ) : (
                    matchingDocs.map((doc) => (
                      <div
                        key={doc.id}
                        onClick={() => {
                          onSelectWorkspace(doc.id)
                          onClose()
                        }}
                        className="flex items-center justify-between p-3 rounded-xl bg-[var(--affine-background-primary-color)] hover:bg-[var(--affine-hover-color)] cursor-pointer text-xs border border-[var(--affine-border-color)] transition group shadow-2xs"
                      >
                        <div className="flex items-center gap-2.5 truncate">
                          <span className="text-base shrink-0">{doc.icon || '📄'}</span>
                          <div className="truncate">
                            <div className="font-semibold truncate">{doc.title || 'Untitled'}</div>
                            <div className="text-[10px] text-[var(--affine-text-secondary-color)]">
                              Modificado:{' '}
                              {new Date(doc.updatedAt).toLocaleDateString('es-ES', {
                                day: 'numeric',
                                month: 'short',
                                year: 'numeric'
                              })}
                            </div>
                          </div>
                        </div>

                        <span className="text-[11px] font-semibold text-[var(--affine-primary-color)] opacity-0 group-hover:opacity-100 transition">
                          Abrir →
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center text-xs text-[var(--affine-text-secondary-color)]">
                Selecciona o crea una etiqueta para ver las notas asociadas.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
