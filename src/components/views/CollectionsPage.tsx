import React, { useState } from 'react'
import { Folder, Plus, Trash2, FileText, Layout } from 'lucide-react'
import { useLiveQuery } from 'dexie-react-hooks'
import {
  db,
  type WorkspaceItem,
  type CollectionItem,
  createCollection,
  deleteCollection
} from '../../db'
import { toast } from 'sonner'

interface CollectionsPageProps {
  spaceId: string
  workspaces: WorkspaceItem[]
  onSelectWorkspace: (id: string) => void
}

const COLLECTION_COLORS = [
  '#1e96eb',
  '#8b5cf6',
  '#22c55e',
  '#eab308',
  '#f97316',
  '#eb4335',
  '#14b8a6',
  '#ec4899',
  '#64748b'
]

export const CollectionsPage: React.FC<CollectionsPageProps> = ({
  spaceId,
  workspaces,
  onSelectWorkspace
}) => {
  const collections = useLiveQuery(
    () => db.collections.where('spaceId').equals(spaceId).toArray(),
    [spaceId]
  ) ?? []

  const [selectedColId, setSelectedColId] = useState<string | null>(null)
  const [isCreating, setIsCreating] = useState(false)
  const [newColName, setNewColName] = useState('')
  const [newColColor, setNewColColor] = useState('#1e96eb')

  const activeWorkspaces = workspaces.filter((w) => !w.isDeleted)
  const activeCol = collections.find((c) => c.id === selectedColId) || collections[0]

  const handleCreate = async () => {
    if (!newColName.trim()) {
      toast.error('Introduce un nombre para la colección')
      return
    }
    const created = await createCollection(spaceId, newColName.trim(), '📁', newColColor)
    setNewColName('')
    setIsCreating(false)
    setSelectedColId(created.id)
    toast.success('Colección creada')
  }

  const handleDelete = async (col: CollectionItem) => {
    if (!confirm(`¿Eliminar la colección "${col.name}"? Los documentos se mantendrán intactos.`)) return
    await deleteCollection(col.id)
    toast.info('Colección eliminada')
    if (selectedColId === col.id) {
      setSelectedColId(null)
    }
  }

  const collectionDocs = activeCol
    ? activeWorkspaces.filter((w) => activeCol.docIds.includes(w.id))
    : []

  return (
    <div className="flex-1 flex flex-col h-full bg-[#18181b] text-neutral-200 select-none overflow-hidden">
      {/* Header */}
      <header className="h-14 px-8 border-b border-neutral-800 flex items-center justify-between shrink-0 bg-[#18181b]">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
            <Folder className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-white">Colecciones</h2>
            <p className="text-[11px] text-neutral-400">
              Agrupa y clasifica páginas bajo carpetas personalizadas
            </p>
          </div>
        </div>

        <button
          onClick={() => setIsCreating(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-neutral-800 hover:bg-neutral-700 text-white text-xs font-medium border border-neutral-700 transition"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Nueva colección</span>
        </button>
      </header>

      {/* Main split: Collections sidebar & content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Collections Left Pane */}
        <div className="w-72 border-r border-neutral-800 bg-neutral-900/30 p-4 space-y-2 overflow-y-auto custom-scrollbar">
          {isCreating && (
            <div className="p-3 rounded-lg bg-neutral-800 border border-neutral-700 space-y-3 mb-3">
              <input
                type="text"
                value={newColName}
                onChange={(e) => setNewColName(e.target.value)}
                placeholder="Nombre de colección..."
                className="w-full px-2.5 py-1 bg-neutral-900 border border-neutral-700 rounded text-xs text-white outline-none"
                autoFocus
                onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
              />
              <div className="flex items-center gap-1.5">
                {COLLECTION_COLORS.slice(0, 6).map((c) => (
                  <button
                    key={c}
                    onClick={() => setNewColColor(c)}
                    className={`w-5 h-5 rounded-full transition ${
                      newColColor === c ? 'ring-2 ring-white scale-110' : ''
                    }`}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
              <div className="flex justify-end gap-1.5 pt-1">
                <button
                  onClick={() => setIsCreating(false)}
                  className="px-2 py-1 text-xs text-neutral-400 hover:text-white"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleCreate}
                  className="px-3 py-1 bg-indigo-600 hover:bg-indigo-500 text-white rounded text-xs font-semibold"
                >
                  Guardar
                </button>
              </div>
            </div>
          )}

          {collections.length === 0 && !isCreating ? (
            <div className="py-12 text-center text-xs text-neutral-500">
              No hay colecciones creadas
            </div>
          ) : (
            collections.map((col) => {
              const isSelected = activeCol?.id === col.id
              return (
                <div
                  key={col.id}
                  onClick={() => setSelectedColId(col.id)}
                  className={`group flex items-center justify-between p-2.5 rounded-lg transition cursor-pointer ${
                    isSelected
                      ? 'bg-neutral-800 text-white font-medium border border-neutral-700'
                      : 'text-neutral-400 hover:bg-neutral-800/50 hover:text-neutral-200'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span
                      className="w-2.5 h-2.5 rounded-full shrink-0"
                      style={{ backgroundColor: col.color || '#1e96eb' }}
                    />
                    <span className="truncate text-xs font-medium">{col.name}</span>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <span className="text-[10px] font-mono opacity-60">
                      {col.docIds.length}
                    </span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        handleDelete(col)
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

        {/* Right Pane: Documents in active collection */}
        <div className="flex-1 p-8 overflow-y-auto max-w-4xl custom-scrollbar">
          {activeCol ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between border-b border-neutral-800 pb-3">
                <div className="flex items-center gap-2.5">
                  <span
                    className="w-3.5 h-3.5 rounded-full"
                    style={{ backgroundColor: activeCol.color || '#1e96eb' }}
                  />
                  <h3 className="text-base font-semibold text-white">{activeCol.name}</h3>
                </div>
                <span className="text-xs text-neutral-400">
                  {collectionDocs.length} documentos
                </span>
              </div>

              {collectionDocs.length === 0 ? (
                <div className="py-20 text-center text-sm text-neutral-500">
                  Esta colección está vacía. Añade páginas a esta colección desde las propiedades de cualquier documento.
                </div>
              ) : (
                <div className="space-y-2">
                  {collectionDocs.map((doc) => (
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
              Selecciona o crea una colección para ver sus documentos.
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
