import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import {
  CloseIcon,
  FolderIcon,
  PlusIcon,
  DeleteIcon,
  DoneIcon
} from '@blocksuite/icons/rc'
import {
  db,
  type WorkspaceItem,
  type CollectionItem,
  createCollection,
  deleteCollection,
  toggleDocInCollection
} from '../../db'
import { toast } from 'sonner'

interface CollectionsModalProps {
  isOpen: boolean
  onClose: () => void
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

const DEFAULT_ICONS = ['📁', '🚀', '💡', '📚', '🎯', '✨', '⚡', '💼', '📌']

export function CollectionsModal({
  isOpen,
  onClose,
  spaceId,
  workspaces,
  onSelectWorkspace
}: CollectionsModalProps) {
  const collections = useLiveQuery(
    () => db.collections.where('spaceId').equals(spaceId).toArray(),
    [spaceId]
  ) ?? []

  const [selectedColId, setSelectedColId] = useState<string | null>(null)
  const [isCreating, setIsCreating] = useState(false)
  const [newColName, setNewColName] = useState('')
  const [newColIcon, setNewColIcon] = useState('📁')
  const [newColColor, setNewColColor] = useState('#1e96eb')
  const [isManagingDocs, setIsManagingDocs] = useState(false)
  const [docSearchQuery, setDocSearchQuery] = useState('')

  if (!isOpen) return null

  const activeCollection = collections.find((c) => c.id === selectedColId) || collections[0]

  const handleCreate = async () => {
    if (!newColName.trim()) {
      toast.error('Introduce un nombre para la colección')
      return
    }
    const created = await createCollection(spaceId, newColName.trim(), newColIcon, newColColor)
    setNewColName('')
    setIsCreating(false)
    setSelectedColId(created.id)
    toast.success('Colección creada')
  }

  const handleDelete = async (col: CollectionItem) => {
    if (!confirm(`¿Eliminar la colección "${col.name}"? Los documentos no se borrarán.`)) return
    await deleteCollection(col.id)
    if (selectedColId === col.id) {
      setSelectedColId(null)
    }
    toast.success('Colección eliminada')
  }

  // Active documents belonging to the space
  const spaceDocs = workspaces.filter((w) => !w.isDeleted)

  // Documents inside current collection
  const collectionDocs = activeCollection
    ? spaceDocs.filter((w) => activeCollection.docIds.includes(w.id))
    : []

  // Filtered documents for adding/removing
  const searchableDocs = spaceDocs.filter((w) =>
    (w.title || 'Untitled').toLowerCase().includes(docSearchQuery.toLowerCase())
  )

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 animate-in fade-in duration-150">
      <div className="w-full max-w-3xl rounded-2xl border border-[var(--affine-border-color)] bg-[var(--affine-background-overlay-panel-color)] shadow-[var(--affine-popover-shadow)] overflow-hidden flex flex-col h-[580px] text-[var(--affine-text-primary-color)] font-sans">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--affine-border-color)] shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[var(--affine-primary-color)]/10 text-[var(--affine-primary-color)] flex items-center justify-center">
              <FolderIcon className="w-4.5 h-4.5" />
            </div>
            <div>
              <h2 className="text-base font-semibold">Colecciones</h2>
              <p className="text-xs text-[var(--affine-text-secondary-color)]">
                Organiza tus documentos y notas por proyectos o temáticas
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

        {/* Body Split Columns */}
        <div className="flex-1 flex overflow-hidden">
          {/* Left Column: Collections list */}
          <div className="w-64 border-r border-[var(--affine-border-color)] p-3 flex flex-col justify-between shrink-0 bg-[var(--affine-background-secondary-color)]">
            <div className="overflow-y-auto space-y-1">
              <div className="text-[10px] uppercase font-bold text-[var(--affine-text-secondary-color)] px-2 py-1">
                Mis Colecciones ({collections.length})
              </div>

              {collections.map((col) => {
                const isSelected = activeCollection?.id === col.id
                return (
                  <div
                    key={col.id}
                    onClick={() => {
                      setSelectedColId(col.id)
                      setIsManagingDocs(false)
                    }}
                    className={`group flex items-center justify-between px-2.5 py-2 rounded-xl text-xs cursor-pointer transition ${
                      isSelected
                        ? 'bg-[var(--affine-hover-color)] font-semibold text-[var(--affine-text-primary-color)] shadow-2xs'
                        : 'text-[var(--affine-text-secondary-color)] hover:text-[var(--affine-text-primary-color)] hover:bg-[var(--affine-hover-color)]'
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <span className="text-sm shrink-0">{col.icon || '📁'}</span>
                      <span className="truncate flex-1">{col.name}</span>
                      <span className="text-[10px] opacity-60 font-mono shrink-0">
                        {col.docIds.length}
                      </span>
                    </div>

                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        handleDelete(col)
                      }}
                      className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-rose-500/10 text-rose-500 transition ml-1 shrink-0"
                      title="Eliminar colección"
                    >
                      <DeleteIcon className="w-3 h-3" />
                    </button>
                  </div>
                )
              })}

              {collections.length === 0 && !isCreating && (
                <div className="text-center py-8 text-xs text-[var(--affine-text-secondary-color)]">
                  No hay colecciones creadas.
                </div>
              )}
            </div>

            {/* Create Collection Button / Form */}
            <div className="pt-2 border-t border-[var(--affine-divider-color)]">
              {isCreating ? (
                <div className="space-y-2 p-2 bg-[var(--affine-background-primary-color)] rounded-xl border border-[var(--affine-border-color)]">
                  <div className="flex items-center gap-1.5">
                    <input
                      type="text"
                      value={newColName}
                      onChange={(e) => setNewColName(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
                      placeholder="Nombre..."
                      autoFocus
                      className="flex-1 bg-transparent text-xs outline-none px-1 py-0.5 border-b border-[var(--affine-border-color)]"
                    />
                  </div>

                  {/* Icon options */}
                  <div className="flex items-center gap-1 overflow-x-auto py-1">
                    {DEFAULT_ICONS.map((ic) => (
                      <button
                        key={ic}
                        type="button"
                        onClick={() => setNewColIcon(ic)}
                        className={`p-1 rounded text-xs transition ${
                          newColIcon === ic ? 'bg-[var(--affine-hover-color)] scale-110' : 'opacity-70'
                        }`}
                      >
                        {ic}
                      </button>
                    ))}
                  </div>

                  {/* Color options */}
                  <div className="flex items-center gap-1.5 py-1">
                    {COLLECTION_COLORS.map((col) => (
                      <button
                        key={col}
                        type="button"
                        onClick={() => setNewColColor(col)}
                        className={`w-3.5 h-3.5 rounded-full transition ${
                          newColColor === col ? 'ring-2 ring-[var(--affine-text-primary-color)] scale-110' : 'opacity-80'
                        }`}
                        style={{ backgroundColor: col }}
                      />
                    ))}
                  </div>

                  <div className="flex justify-end gap-1.5 pt-1">
                    <button
                      onClick={() => setIsCreating(false)}
                      className="px-2 py-1 text-[11px] rounded text-[var(--affine-text-secondary-color)] hover:bg-[var(--affine-hover-color)]"
                    >
                      Cancelar
                    </button>
                    <button
                      onClick={handleCreate}
                      className="px-2.5 py-1 text-[11px] rounded bg-[var(--affine-primary-color)] text-white font-medium"
                    >
                      Guardar
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => setIsCreating(true)}
                  className="w-full flex items-center justify-center gap-2 py-2 rounded-xl border border-dashed border-[var(--affine-border-color)] text-xs text-[var(--affine-text-secondary-color)] hover:text-[var(--affine-text-primary-color)] hover:border-[var(--affine-primary-color)] transition"
                >
                  <PlusIcon className="w-3.5 h-3.5" />
                  <span>Nueva Colección</span>
                </button>
              )}
            </div>
          </div>

          {/* Right Column: Collection details & Docs */}
          <div className="flex-1 p-5 flex flex-col overflow-hidden">
            {activeCollection ? (
              <>
                <div className="flex items-center justify-between pb-3 border-b border-[var(--affine-border-color)] mb-4">
                  <div className="flex items-center gap-2.5">
                    <span className="text-2xl">{activeCollection.icon || '📁'}</span>
                    <div>
                      <h3 className="text-base font-bold">{activeCollection.name}</h3>
                      <p className="text-xs text-[var(--affine-text-secondary-color)]">
                        {activeCollection.docIds.length} documento(s) asociados
                      </p>
                    </div>
                  </div>

                  <button
                    onClick={() => setIsManagingDocs(!isManagingDocs)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[var(--affine-hover-color)] hover:bg-[var(--affine-hover-color-filled)] text-xs font-semibold transition"
                  >
                    <PlusIcon className="w-3.5 h-3.5" />
                    <span>{isManagingDocs ? 'Listo' : 'Añadir / Quitar Notas'}</span>
                  </button>
                </div>

                {/* Content: Doc list or Managing Picker */}
                {isManagingDocs ? (
                  <div className="flex-1 flex flex-col overflow-hidden space-y-2">
                    <input
                      type="text"
                      placeholder="Buscar notas para incluir..."
                      value={docSearchQuery}
                      onChange={(e) => setDocSearchQuery(e.target.value)}
                      className="w-full px-3 py-2 text-xs bg-[var(--affine-background-primary-color)] border border-[var(--affine-border-color)] rounded-xl outline-none"
                    />

                    <div className="flex-1 overflow-y-auto space-y-1">
                      {searchableDocs.map((doc) => {
                        const isInCol = activeCollection.docIds.includes(doc.id)
                        return (
                          <div
                            key={doc.id}
                            onClick={() => toggleDocInCollection(activeCollection.id, doc.id)}
                            className="flex items-center justify-between p-2.5 rounded-xl hover:bg-[var(--affine-hover-color)] cursor-pointer text-xs transition border border-transparent hover:border-[var(--affine-border-color)]"
                          >
                            <div className="flex items-center gap-2 truncate">
                              <span className="text-sm">{doc.icon || '📄'}</span>
                              <span className="font-medium truncate">{doc.title || 'Untitled'}</span>
                            </div>
                            <div
                              className={`w-5 h-5 rounded-md flex items-center justify-center transition ${
                                isInCol
                                  ? 'bg-[var(--affine-primary-color)] text-white'
                                  : 'border border-[var(--affine-border-color)]'
                              }`}
                            >
                              {isInCol && <DoneIcon className="w-3.5 h-3.5" />}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                ) : (
                  <div className="flex-1 overflow-y-auto space-y-1.5">
                    {collectionDocs.length === 0 ? (
                      <div className="py-16 text-center text-xs text-[var(--affine-text-secondary-color)] space-y-2">
                        <p>No hay documentos en esta colección.</p>
                        <button
                          onClick={() => setIsManagingDocs(true)}
                          className="text-[var(--affine-primary-color)] hover:underline font-semibold"
                        >
                          Haz clic aquí para añadir documentos
                        </button>
                      </div>
                    ) : (
                      collectionDocs.map((doc) => (
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
                              <div className="text-[10px] text-[var(--affine-text-secondary-color)] flex items-center gap-2">
                                <span>{doc.viewMode === 'canvas' ? 'Sin bordes' : 'Página'}</span>
                                <span>•</span>
                                <span>
                                  {new Date(doc.updatedAt).toLocaleDateString('es-ES', {
                                    day: 'numeric',
                                    month: 'short'
                                  })}
                                </span>
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
                )}
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center text-xs text-[var(--affine-text-secondary-color)]">
                Selecciona o crea una colección.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
