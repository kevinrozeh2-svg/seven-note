import { useEffect } from 'react'
import { Command } from 'cmdk'
import { motion, AnimatePresence } from 'motion/react'
import { useLiveQuery } from 'dexie-react-hooks'
import {
  SearchIcon,
  PageIcon,
  DatabaseKanbanViewIcon,
  CloseIcon,
  ArrowRightSmallIcon,
  PlusIcon,
  SunPanelIcon,
  MoonPanelIcon,
  EdgelessIcon,
  AiOutlineIcon,
  KeyboardIcon,
  SettingsIcon,
  DeleteIcon,
  ImportIcon
} from '@blocksuite/icons/rc'
import { db, type WorkspaceItem, type CanvasNodeItem } from '../../db'
import { useAppStore } from '../../store/useAppStore'

interface CommandPaletteProps {
  isOpen: boolean
  onClose: () => void
  workspaces: WorkspaceItem[]
  nodes?: CanvasNodeItem[]
  onSelectWorkspace: (id: string) => void
  onCreateWorkspace?: () => void
  onToggleViewMode?: () => void
  darkMode?: boolean
  onToggleDarkMode?: () => void
}

export function CommandPalette({
  isOpen,
  onClose,
  workspaces,
  nodes,
  onSelectWorkspace,
  onCreateWorkspace,
  onToggleViewMode,
  darkMode: propDarkMode,
  onToggleDarkMode
}: CommandPaletteProps) {
  const store = useAppStore()
  const darkMode = propDarkMode ?? store.darkMode
  const toggleDarkMode = onToggleDarkMode ?? store.toggleDarkMode
  const {
    setSettingsOpen,
    setTrashOpen,
    setAIOpen,
    setShortcutsOpen,
    setImportOpen
  } = store

  // Query nodes only when open, avoiding background re-renders
  const queriedNodes = useLiveQuery<CanvasNodeItem[]>(
    () => (isOpen ? db.canvasNodes.filter((n) => !n.isDeleted).toArray() : Promise.resolve<CanvasNodeItem[]>([])),
    [isOpen]
  ) ?? []
  const effectiveNodes = nodes ?? queriedNodes

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        if (isOpen) {
          onClose()
        }
      } else if (e.key === 'Escape' && isOpen) {
        onClose()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose])

  const activeWorkspaces = workspaces.filter((w) => !w.isDeleted)
  const activeNodes = effectiveNodes.filter((n) => !n.isDeleted)

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-20 bg-black/40 backdrop-blur-xs p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.98, y: -8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.98, y: -8 }}
            transition={{ duration: 0.12, ease: 'easeOut' }}
            className="w-full max-w-xl rounded-xl bg-[var(--app-bg-overlay)] border border-[var(--app-border)] shadow-[var(--app-shadow-modal)] overflow-hidden flex flex-col text-[var(--app-text-primary)]"
          >
            <Command
              label="Búsqueda global y comandos"
              className="w-full flex flex-col"
              onKeyDown={(e) => {
                if (e.key === 'Escape') onClose()
              }}
            >
              {/* Search Bar */}
              <div className="flex items-center gap-3 px-4 py-3 border-b border-[var(--app-border)]">
                <SearchIcon className="w-4 h-4 text-[var(--app-text-secondary)] shrink-0" />
                <Command.Input
                  autoFocus
                  placeholder="Escribe un comando o busca notas..."
                  className="flex-1 text-sm bg-transparent border-none outline-none text-[var(--app-text-primary)] placeholder:text-[var(--app-text-tertiary)]"
                />
                <button
                  onClick={onClose}
                  className="p-1 rounded-md hover:bg-[var(--app-hover)] text-[var(--app-text-secondary)] hover:text-[var(--app-text-primary)] transition"
                >
                  <CloseIcon className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Command List */}
              <Command.List className="max-h-80 overflow-y-auto p-1.5 space-y-0.5">
                <Command.Empty className="py-10 text-center text-xs text-[var(--app-text-secondary)]">
                  No se encontraron resultados
                </Command.Empty>

                {/* Acciones Rápidas */}
                <Command.Group
                  heading="Acciones Rápidas"
                  className="[&_[cmdk-group-heading]]:px-2.5 [&_[cmdk-group-heading]]:py-1 [&_[cmdk-group-heading]]:text-[10px] [&_[cmdk-group-heading]]:font-semibold [&_[cmdk-group-heading]]:text-[var(--app-text-tertiary)] [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-wider"
                >
                  {onCreateWorkspace && (
                    <Command.Item
                      onSelect={() => {
                        onCreateWorkspace()
                        onClose()
                      }}
                      className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-md text-left cursor-pointer transition text-xs text-[var(--app-text-primary)] data-[selected=true]:bg-[var(--app-hover)]"
                    >
                      <div className="flex items-center gap-2">
                        <PlusIcon className="w-4 h-4 text-emerald-500" />
                        <span className="font-medium">Crear nueva página</span>
                      </div>
                      <span className="text-[10px] text-[var(--app-text-secondary)] bg-[var(--app-bg-secondary)] px-1.5 py-0.5 rounded border border-[var(--app-border)]">
                        Ctrl+N
                      </span>
                    </Command.Item>
                  )}

                  {onToggleViewMode && (
                    <Command.Item
                      onSelect={() => {
                        onToggleViewMode()
                        onClose()
                      }}
                      className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-md text-left cursor-pointer transition text-xs text-[var(--app-text-primary)] data-[selected=true]:bg-[var(--app-hover)]"
                    >
                      <div className="flex items-center gap-2">
                        <EdgelessIcon className="w-4 h-4 text-[var(--app-accent)]" />
                        <span className="font-medium">Alternar Documento / Lienzo</span>
                      </div>
                      <span className="text-[10px] text-[var(--app-text-secondary)] bg-[var(--app-bg-secondary)] px-1.5 py-0.5 rounded border border-[var(--app-border)]">
                        Space
                      </span>
                    </Command.Item>
                  )}

                  <Command.Item
                    onSelect={() => {
                      toggleDarkMode()
                      onClose()
                    }}
                    className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-md text-left cursor-pointer transition text-xs text-[var(--app-text-primary)] data-[selected=true]:bg-[var(--app-hover)]"
                  >
                    <div className="flex items-center gap-2">
                      {darkMode ? (
                        <SunPanelIcon className="w-4 h-4 text-amber-500" />
                      ) : (
                        <MoonPanelIcon className="w-4 h-4 text-indigo-500" />
                      )}
                      <span className="font-medium">
                        Cambiar a modo {darkMode ? 'Claro' : 'Oscuro'}
                      </span>
                    </div>
                  </Command.Item>

                  <Command.Item
                    onSelect={() => {
                      setAIOpen(true)
                      onClose()
                    }}
                    className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-md text-left cursor-pointer transition text-xs text-[var(--app-text-primary)] data-[selected=true]:bg-[var(--app-hover)]"
                  >
                    <div className="flex items-center gap-2">
                      <AiOutlineIcon className="w-4 h-4 text-purple-500" />
                      <span className="font-medium">Asistente de Inteligencia Artificial</span>
                    </div>
                  </Command.Item>

                  <Command.Item
                    onSelect={() => {
                      setSettingsOpen(true)
                      onClose()
                    }}
                    className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-md text-left cursor-pointer transition text-xs text-[var(--app-text-primary)] data-[selected=true]:bg-[var(--app-hover)]"
                  >
                    <div className="flex items-center gap-2">
                      <SettingsIcon className="w-4 h-4 text-[var(--app-text-secondary)]" />
                      <span className="font-medium">Preferencias y Configuración</span>
                    </div>
                  </Command.Item>

                  <Command.Item
                    onSelect={() => {
                      setShortcutsOpen(true)
                      onClose()
                    }}
                    className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-md text-left cursor-pointer transition text-xs text-[var(--app-text-primary)] data-[selected=true]:bg-[var(--app-hover)]"
                  >
                    <div className="flex items-center gap-2">
                      <KeyboardIcon className="w-4 h-4 text-[var(--app-text-secondary)]" />
                      <span className="font-medium">Atajos de teclado</span>
                    </div>
                    <span className="text-[10px] text-[var(--app-text-secondary)] bg-[var(--app-bg-secondary)] px-1.5 py-0.5 rounded border border-[var(--app-border)]">
                      ?
                    </span>
                  </Command.Item>

                  <Command.Item
                    onSelect={() => {
                      setImportOpen(true)
                      onClose()
                    }}
                    className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-md text-left cursor-pointer transition text-xs text-[var(--app-text-primary)] data-[selected=true]:bg-[var(--app-hover)]"
                  >
                    <div className="flex items-center gap-2">
                      <ImportIcon className="w-4 h-4 text-[var(--app-text-secondary)]" />
                      <span className="font-medium">Importar Markdown / JSON</span>
                    </div>
                  </Command.Item>

                  <Command.Item
                    onSelect={() => {
                      setTrashOpen(true)
                      onClose()
                    }}
                    className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-md text-left cursor-pointer transition text-xs text-[var(--app-text-primary)] data-[selected=true]:bg-[var(--app-hover)]"
                  >
                    <div className="flex items-center gap-2">
                      <DeleteIcon className="w-4 h-4 text-rose-500" />
                      <span className="font-medium">Papelera de reciclaje</span>
                    </div>
                  </Command.Item>
                </Command.Group>

                {/* Páginas */}
                {activeWorkspaces.length > 0 && (
                  <Command.Group
                    heading="Páginas y Documentos"
                    className="mt-2 pt-1 border-t border-[var(--app-border)] [&_[cmdk-group-heading]]:px-2.5 [&_[cmdk-group-heading]]:py-1 [&_[cmdk-group-heading]]:text-[10px] [&_[cmdk-group-heading]]:font-semibold [&_[cmdk-group-heading]]:text-[var(--app-text-tertiary)] [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-wider"
                  >
                    {activeWorkspaces.map((ws) => (
                      <Command.Item
                        key={ws.id}
                        value={`${ws.title} ${ws.id}`}
                        onSelect={() => {
                          onSelectWorkspace(ws.id)
                          onClose()
                        }}
                        className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-md text-left cursor-pointer transition text-xs text-[var(--app-text-primary)] data-[selected=true]:bg-[var(--app-hover)]"
                      >
                        <div className="flex items-center gap-2">
                          <span>{ws.icon || '📄'}</span>
                          <span className="font-medium">{ws.title || 'Sin título'}</span>
                        </div>
                        <ArrowRightSmallIcon className="w-3.5 h-3.5 text-[var(--app-text-secondary)] opacity-60" />
                      </Command.Item>
                    ))}
                  </Command.Group>
                )}

                {/* Tarjetas del Tablero */}
                {activeNodes.length > 0 && (
                  <Command.Group
                    heading="Tarjetas del Lienzo"
                    className="mt-2 pt-1 border-t border-[var(--app-border)] [&_[cmdk-group-heading]]:px-2.5 [&_[cmdk-group-heading]]:py-1 [&_[cmdk-group-heading]]:text-[10px] [&_[cmdk-group-heading]]:font-semibold [&_[cmdk-group-heading]]:text-[var(--app-text-tertiary)] [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-wider"
                  >
                    {activeNodes.slice(0, 15).map((n) => (
                      <Command.Item
                        key={n.id}
                        value={`${n.data.title || ''} ${n.data.content || ''} ${n.id}`}
                        onSelect={() => {
                          onSelectWorkspace(n.workspaceId)
                          onClose()
                        }}
                        className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-md text-left cursor-pointer transition text-xs text-[var(--app-text-primary)] data-[selected=true]:bg-[var(--app-hover)]"
                      >
                        <div className="flex items-center gap-2 truncate">
                          {n.type === 'note' && <PageIcon className="w-3.5 h-3.5 text-amber-500 shrink-0" />}
                          {n.type === 'todo' && <DatabaseKanbanViewIcon className="w-3.5 h-3.5 text-sky-500 shrink-0" />}
                          {n.type !== 'note' && n.type !== 'todo' && (
                            <PageIcon className="w-3.5 h-3.5 text-[var(--app-text-secondary)] shrink-0" />
                          )}
                          <span className="font-medium truncate">
                            {n.data.title || 'Tarjeta sin título'}
                          </span>
                          {n.data.content && (
                            <span className="ml-2 text-[var(--app-text-secondary)] text-[11px] truncate">
                              {n.data.content.slice(0, 35)}
                            </span>
                          )}
                        </div>
                        <span className="text-[10px] text-[var(--app-text-secondary)] shrink-0">
                          Ir al lienzo
                        </span>
                      </Command.Item>
                    ))}
                  </Command.Group>
                )}
              </Command.List>

              {/* Footer */}
              <div className="px-3.5 py-2 border-t border-[var(--app-border)] bg-[var(--app-bg-secondary)] text-[11px] text-[var(--app-text-secondary)] flex items-center justify-between">
                <span>Navega con ↑↓ · Selecciona con ↵ · Sal con Esc</span>
                <span className="font-medium text-[var(--app-text-tertiary)]">Seven Search</span>
              </div>
            </Command>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )
}
