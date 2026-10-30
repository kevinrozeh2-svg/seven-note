import React, { useState } from 'react'
import { Tag as TagIcon, Plus, Trash2, FileText, Layout } from 'lucide-react'
import { useLiveQuery } from 'dexie-react-hooks'
import {
  db,
  type WorkspaceItem,
  getOrCreateTag,
  deleteTag
} from '../../db'
import { toast } from 'sonner'

interface TagsPageProps {
  spaceId: string
  workspaces: WorkspaceItem[]
  onSelectWorkspace: (id: string) => void
  initialSelectedTag?: string | null
}

export const TagsPage: React.FC<TagsPageProps> = ({
  spaceId,
  workspaces,
  onSelectWorkspace,
  initialSelectedTag = null
}) => {
  const dbTags = useLiveQuery(
    () => db.tags.where('spaceId').equals(spaceId).toArray(),
    [spaceId]
  ) ?? []

  const activeWorkspaces = workspaces.filter((w) => !w.isDeleted)
  const workspaceTagNames = Array.from(
    new Set(activeWorkspaces.flatMap((w) => w.tags || []).filter(Boolean))
  )
  const allTagNames = Array.from(
    new Set([...dbTags.map((t) => t.name), ...workspaceTagNames])
  )

  const [selectedTag, setSelectedTag] = useState<string | null>(
    initialSelectedTag || allTagNames[0] || null
  )
  const [newTagInput, setNewTagInput] = useState('')
  const [isCreating, setIsCreating] = useState(false)

  const activeTagName = selectedTag || allTagNames[0] || null

  const getTagColor = (name: string) => {
    const found = dbTags.find((t) => t.name.toLowerCase() === name.toLowerCase())
    return found?.color || '#1e96eb'
  }

  const handleCreateTag = async () => {
    if (!newTagInput.trim()) return
    await getOrCreateTag(spaceId, newTagInput.trim(), '#1e96eb')
    setSelectedTag(newTagInput.trim())
    setNewTagInput('')
    setIsCreating(false)
    toast.success('Etiqueta creada')
  }

  const handleDeleteTag = async (name: string) => {
    if (!confirm(`¿Eliminar la etiqueta #${name}?`)) return
    const found = dbTags.find((t) => t.name.toLowerCase() === name.toLowerCase())
    if (found) await deleteTag(found.id, spaceId, name)
    if (selectedTag === name) setSelectedTag(null)
    toast.info('Etiqueta eliminada')
  }

  const taggedDocs = activeTagName
    ? activeWorkspaces.filter((w) => (w.tags || []).includes(activeTagName))
    : []

  return (
    <div className="flex-1 flex flex-col h-full bg-[#18181b] text-neutral-200 select-none overflow-hidden">
      {/* Header */}
      <header className="h-14 px-8 border-b border-neutral-800 flex items-center justify-between shrink-0 bg-[#18181b]">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-sky-500/10 text-sky-400 flex items-center justify-center">
            <TagIcon className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-white">Etiquetas</h2>
            <p className="text-[11px] text-neutral-400">
              Organiza páginas mediante etiquetas transversales
            </p>
          </div>
        </div>

        <button
          onClick={() => setIsCreating(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-neutral-800 hover:bg-neutral-700 text-white text-xs font-medium border border-neutral-700 transition"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Nueva etiqueta</span>
        </button>
      </header>

      {/* Main split */}
      <div className="flex-1 flex overflow-hidden">
        {/* Tags list pane */}
        <div className="w-72 border-r border-neutral-800 bg-neutral-900/30 p-4 space-y-2 overflow-y-auto custom-scrollbar">
          {isCreating && (
            <div className="p-3 rounded-lg bg-neutral-800 border border-neutral-700 space-y-2 mb-3">
              <input
                type="text"
                value={newTagInput}
                onChange={(e) => setNewTagInput(e.target.value)}
                placeholder="Nombre de etiqueta..."
                className="w-full px-2.5 py-1 bg-neutral-900 border border-neutral-700 rounded text-xs text-white outline-none"
                autoFocus
                onKeyDown={(e) => e.key === 'Enter' && handleCreateTag()}
              />
              <div className="flex justify-end gap-1.5">
                <button
                  onClick={() => setIsCreating(false)}
                  className="px-2 py-1 text-xs text-neutral-400 hover:text-white"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleCreateTag}
                  className="px-3 py-1 bg-sky-600 hover:bg-sky-500 text-white rounded text-xs font-semibold"
                >
                  Guardar
                </button>
              </div>
            </div>
          )}

          {allTagNames.length === 0 && !isCreating ? (
            <div className="py-12 text-center text-xs text-neutral-500">
              No hay etiquetas aún
            </div>
          ) : (
            allTagNames.map((name) => {
              const color = getTagColor(name)
              const count = activeWorkspaces.filter((w) => (w.tags || []).includes(name)).length
              const isSelected = activeTagName === name

              return (
                <div
                  key={name}
                  onClick={() => setSelectedTag(name)}
                  className={`group flex items-center justify-between p-2.5 rounded-lg transition cursor-pointer ${
                    isSelected
                      ? 'bg-neutral-800 text-white font-medium border border-neutral-700'
                      : 'text-neutral-400 hover:bg-neutral-800/50 hover:text-neutral-200'
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span
                      className="w-2.5 h-2.5 rounded-full shrink-0"
                      style={{ backgroundColor: color }}
                    />
                    <span className="truncate text-xs font-medium">#{name}</span>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <span className="text-[10px] font-mono opacity-60">{count}</span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        handleDeleteTag(name)
                      }}
                      className="opacity-0 group-hover:opacity-100 p-1 hover:text-rose-400"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              )
            })
          )}
        </div>

        {/* Right Pane: Tagged Docs */}
        <div className="flex-1 p-8 overflow-y-auto max-w-4xl custom-scrollbar">
          {activeTagName ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between border-b border-neutral-800 pb-3">
                <div className="flex items-center gap-2">
                  <span
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: getTagColor(activeTagName) }}
                  />
                  <h3 className="text-base font-semibold text-white">#{activeTagName}</h3>
                </div>
                <span className="text-xs text-neutral-400">
                  {taggedDocs.length} documentos
                </span>
              </div>

              {taggedDocs.length === 0 ? (
                <div className="py-20 text-center text-sm text-neutral-500">
                  No hay documentos con la etiqueta #{activeTagName}.
                </div>
              ) : (
                <div className="space-y-2">
                  {taggedDocs.map((doc) => (
                    <div
                      key={doc.id}
                      onClick={() => onSelectWorkspace(doc.id)}
                      className="flex items-center justify-between p-3 rounded-lg bg-neutral-900/50 border border-neutral-800 hover:border-neutral-700 transition cursor-pointer"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-8 h-8 rounded bg-neutral-800 flex items-center justify-center text-neutral-300 shrink-0">
                          {doc.icon ? (
                            <span>{doc.icon}</span>
                          ) : doc.viewMode === 'canvas' ? (
                            <Layout className="w-4 h-4 text-indigo-400" />
                          ) : (
                            <FileText className="w-4 h-4 text-blue-400" />
                          )}
                        </div>
                        <span className="font-medium text-xs text-neutral-200 truncate">
                          {doc.title || 'Sin título'}
                        </span>
                      </div>
                      <span className="text-xs text-neutral-500 font-mono">
                        {new Date(doc.updatedAt).toLocaleDateString('es-ES', {
                          day: 'numeric',
                          month: 'short'
                        })}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="py-20 text-center text-sm text-neutral-500">
              Selecciona una etiqueta para ver sus documentos asociados.
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
