import { X } from 'lucide-react'
import { type WorkspaceItem } from '../../db'
import { KnowledgeGraphPage } from '../views/KnowledgeGraphPage'

interface KnowledgeGraphModalProps {
  isOpen: boolean
  onClose: () => void
  workspaces: WorkspaceItem[]
  currentWorkspaceId: string
  onSelectWorkspace: (id: string) => void
  onCreateWorkspace?: (title: string) => Promise<void> | void
}

export function KnowledgeGraphModal({
  isOpen,
  onClose,
  workspaces,
  currentWorkspaceId,
  onSelectWorkspace,
  onCreateWorkspace
}: KnowledgeGraphModalProps) {
  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-6 bg-black/75 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="relative w-full h-[90vh] max-w-6xl bg-[#181818] border border-[#333] rounded-2xl shadow-2xl flex flex-col overflow-hidden">
        {/* Floating close button */}
        <button
          onClick={onClose}
          className="absolute top-2 right-2 z-40 p-1.5 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-800 transition cursor-pointer"
          title="Cerrar vista gráfica"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="flex-1 w-full h-full overflow-hidden">
          <KnowledgeGraphPage
            workspaces={workspaces}
            currentWorkspaceId={currentWorkspaceId}
            onSelectWorkspace={(id) => {
              onSelectWorkspace(id)
              onClose()
            }}
            onCreateWorkspace={onCreateWorkspace ? async (title) => {
              await onCreateWorkspace(title)
              onClose()
            } : undefined}
          />
        </div>
      </div>
    </div>
  )
}
