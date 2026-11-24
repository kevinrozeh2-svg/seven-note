import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { Command } from 'cmdk'
import { motion, AnimatePresence } from 'motion/react'
import { useLiveQuery } from 'dexie-react-hooks'
import { toast } from 'sonner'
import { EmojiPickerPopover } from './EmojiPickerPopover'
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
  KeyboardIcon,
  SettingsIcon,
  DeleteIcon,
  ImportIcon
} from '@blocksuite/icons/rc'
import { db, type WorkspaceItem, type CanvasNodeItem } from '../../db'
import { isItemUnread, NewBadge, useUnreadTrigger } from '../../lib/unreadTracker'
import { getCurrentMember } from '../../lib/teamAuth'
import { useAppStore } from '../../store/useAppStore'
import { AppleEmoji } from '../ui/AppleEmoji'
import { Graph, Books, FileText } from '@phosphor-icons/react'

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
  onOpenSettings?: () => void
  onOpenShortcuts?: () => void
  onOpenImport?: () => void
  onOpenAllDocs?: () => void
  onOpenKnowledgeGraph?: () => void
  onOpenTemplates?: () => void
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
  onToggleDarkMode,
  onOpenSettings,
  onOpenShortcuts,
  onOpenImport,
  onOpenAllDocs,
  onOpenKnowledgeGraph,
  onOpenTemplates
}: CommandPaletteProps) {
  const [isGlobalEmojiOpen, setIsGlobalEmojiOpen] = useState(false)
  useUnreadTrigger()
  const currentMember = getCurrentMember()
  const store = useAppStore()
  const darkMode = propDarkMode ?? store.darkMode
  const toggleDarkMode = onToggleDarkMode ?? store.toggleDarkMode
  const {
    setSettingsOpen,
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
    <>
      <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
          className="fixed inset-0 z-50 flex items-start justify-center pt-6 sm:pt-20 bg-black/40 backdrop-blur-xs p-2 sm:p-4"
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.97, y: -10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97, y: -6 }}
            transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
            className="w-full max-w-xl rounded-xl bg-[var(--app-bg-overlay)] border border-[var(--app-border-strong)] shadow-[var(--app-shadow-popover)] overflow-hidden flex flex-col text-[var(--app-text-primary)] p-1.5"
          >
            <Command
              label="Búsqueda global y comandos"
              className="w-full flex flex-col"
              onKeyDown={(e) => {
                if (e.key === 'Escape') onClose()
              }}
            >
              {/* Search Bar */}
              <div className="flex items-center gap-3 px-3.5 py-2.5 border-b border-[var(--app-divider)]">
                <SearchIcon className="w-4 h-4 text-[var(--app-text-muted)] shrink-0" />
                <Command.Input
                  autoFocus
                  placeholder="Escribe un comando o busca notas..."
                  className="flex-1 text-sm bg-transparent border-none outline-none text-[var(--app-text-primary)] placeholder:text-[var(--app-text-muted)] font-sans"
                />
                <button
                  type="button"
                  aria-label="Cerrar búsqueda rápida"
                  onClick={onClose}
                  className="p-1.5 rounded-md hover:bg-[var(--app-hover)] text-[var(--app-text-muted)] hover:text-[var(--app-text-primary)] transition cursor-pointer"
                >
                  <CloseIcon className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Command List */}
              <Command.List className="max-h-80 overflow-y-auto p-1.5 space-y-1 custom-scrollbar">
                <Command.Empty className="py-10 text-center text-xs text-neutral-400">
                  No se encontraron resultados
                </Command.Empty>

                {/* Acciones Rápidas */}
                <Command.Group
                  heading="Acciones Rápidas"
                  className="[&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-[10px] [&_[cmdk-group-heading]]:font-bold [&_[cmdk-group-heading]]:text-neutral-400 [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-wider"
                >
                  {onCreateWorkspace && (
                    <Command.Item
                      onSelect={() => {
                        onCreateWorkspace()
                        onClose()
                      }}
                      className="w-full flex items-center justify-between px-3 py-2 rounded-2xl text-left cursor-pointer transition text-xs text-[var(--app-text-primary)] data-[selected=true]:bg-black/[0.05] dark:data-[selected=true]:bg-white/[0.08] active:scale-[0.99]"
                    >
                      <div className="flex items-center gap-2.5">
                        <PlusIcon className="w-4 h-4 text-emerald-500" />
                        <span className="font-medium">Crear nueva página</span>
                      </div>
                      <span className="text-[10px] text-neutral-400 bg-black/[0.04] dark:bg-white/[0.06] px-2 py-0.5 rounded-full border border-black/[0.04] dark:border-white/[0.06]">
                        Ctrl+N
                      </span>
                    </Command.Item>
                  )}

                  <Command.Item
                    value="emojis apple selector lista completa todos iconos sticker copiar"
                    onSelect={() => {
                      setIsGlobalEmojiOpen(true)
                    }}
                    className="w-full flex items-center justify-between px-3 py-2 rounded-2xl text-left cursor-pointer transition text-xs text-[var(--app-text-primary)] data-[selected=true]:bg-black/[0.05] dark:data-[selected=true]:bg-white/[0.08] active:scale-[0.99]"
                  >
                    <div className="flex items-center gap-2.5">
                      <AppleEmoji emoji="✨" size={16} />
                      <span className="font-medium">Catálogo de emojis (1,870)</span>
                    </div>
                    <span className="text-[10px] text-[var(--app-accent)] font-semibold px-2 py-0.5 rounded-md bg-[var(--app-accent-soft)]">
                      Copiar y pegar
                    </span>
                  </Command.Item>

                  {onToggleViewMode && (
                    <Command.Item
                      onSelect={() => {
                        onToggleViewMode()
                        onClose()
                      }}
                      className="w-full flex items-center justify-between px-3 py-2 rounded-md text-left cursor-pointer transition text-xs text-[var(--app-text-primary)] data-[selected=true]:bg-[var(--app-hover)] active:scale-[0.99]"
                    >
                      <div className="flex items-center gap-2.5">
                        <EdgelessIcon className="w-4 h-4 text-[var(--app-accent)]" />
                        <span className="font-medium">Alternar Nota / Lienzo</span>
                      </div>
                      <span className="text-[10px] text-[var(--app-text-muted)] bg-[var(--app-bg-tertiary)] px-2 py-0.5 rounded border border-[var(--app-border)]">
                        Alt+S
                      </span>
                    </Command.Item>
                  )}

                  <Command.Item
                    onSelect={() => {
                      toggleDarkMode()
                      onClose()
                    }}
                    className="w-full flex items-center justify-between px-3 py-2 rounded-2xl text-left cursor-pointer transition text-xs text-[var(--app-text-primary)] data-[selected=true]:bg-black/[0.05] dark:data-[selected=true]:bg-white/[0.08] active:scale-[0.99]"
                  >
                    <div className="flex items-center gap-2.5">
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
                      if (onOpenSettings) {
                        onOpenSettings()
                      } else {
                        setSettingsOpen(true)
                      }
                      onClose()
                    }}
                    className="w-full flex items-center justify-between px-3 py-2 rounded-2xl text-left cursor-pointer transition text-xs text-[var(--app-text-primary)] data-[selected=true]:bg-black/[0.05] dark:data-[selected=true]:bg-white/[0.08] active:scale-[0.99]"
                  >
                    <div className="flex items-center gap-2.5">
                      <SettingsIcon className="w-4 h-4 text-neutral-400" />
                      <span className="font-medium">Preferencias y Configuración</span>
                    </div>
                  </Command.Item>

                  <Command.Item
                    onSelect={() => {
                      if (onOpenShortcuts) {
                        onOpenShortcuts()
                      } else {
                        setShortcutsOpen(true)
                      }
                      onClose()
                    }}
                    className="w-full flex items-center justify-between px-3 py-2 rounded-2xl text-left cursor-pointer transition text-xs text-[var(--app-text-primary)] data-[selected=true]:bg-black/[0.05] dark:data-[selected=true]:bg-white/[0.08] active:scale-[0.99]"
                  >
                    <div className="flex items-center gap-2.5">
                      <KeyboardIcon className="w-4 h-4 text-neutral-400" />
                      <span className="font-medium">Atajos de teclado</span>
                    </div>
                    <span className="text-[10px] text-neutral-400 bg-black/[0.04] dark:bg-white/[0.06] px-2 py-0.5 rounded-full border border-black/[0.04] dark:border-white/[0.06]">
                      ?
                    </span>
                  </Command.Item>

                  <Command.Item
                    onSelect={() => {
                      if (onOpenImport) {
                        onOpenImport()
                      } else {
                        setImportOpen(true)
                      }
                      onClose()
                    }}
                    className="w-full flex items-center justify-between px-3 py-2 rounded-2xl text-left cursor-pointer transition text-xs text-[var(--app-text-primary)] data-[selected=true]:bg-black/[0.05] dark:data-[selected=true]:bg-white/[0.08] active:scale-[0.99]"
                  >
                    <div className="flex items-center gap-2.5">
                      <ImportIcon className="w-4 h-4 text-neutral-400" />
                      <span className="font-medium">Importar Markdown / JSON</span>
                    </div>
                  </Command.Item>

                  <Command.Item
                    onSelect={() => {
                      if (onOpenAllDocs) {
                        onOpenAllDocs()
                      } else {
                        window.dispatchEvent(new CustomEvent('seven-note-navigate-workspace', { detail: { viewType: 'all-docs', title: 'Todos los documentos' } }))
                      }
                      onClose()
                    }}
                    className="w-full flex items-center justify-between px-3 py-2 rounded-2xl text-left cursor-pointer transition text-xs text-[var(--app-text-primary)] data-[selected=true]:bg-black/[0.05] dark:data-[selected=true]:bg-white/[0.08] active:scale-[0.99]"
                  >
                    <div className="flex items-center gap-2.5">
                      <FileText size={16} className="text-blue-500" />
                      <span className="font-medium">Todos los documentos</span>
                    </div>
                  </Command.Item>

                  <Command.Item
                    onSelect={() => {
                      if (onOpenKnowledgeGraph) {
                        onOpenKnowledgeGraph()
                      } else {
                        window.dispatchEvent(new CustomEvent('seven-note-navigate-workspace', { detail: { viewType: 'knowledge-graph', title: 'Vista gráfica' } }))
                      }
                      onClose()
                    }}
                    className="w-full flex items-center justify-between px-3 py-2 rounded-2xl text-left cursor-pointer transition text-xs text-[var(--app-text-primary)] data-[selected=true]:bg-black/[0.05] dark:data-[selected=true]:bg-white/[0.08] active:scale-[0.99]"
                  >
                    <div className="flex items-center gap-2.5">
                      <Graph size={16} className="text-purple-500" />
                      <span className="font-medium">Grafo Global (Knowledge Graph)</span>
                    </div>
                  </Command.Item>

                  <Command.Item
                    onSelect={() => {
                      if (onOpenTemplates) {
                        onOpenTemplates()
                      } else {
                        window.dispatchEvent(new CustomEvent('seven-note-navigate-workspace', { detail: { viewType: 'templates', title: 'Plantillas' } }))
                      }
                      onClose()
                    }}
                    className="w-full flex items-center justify-between px-3 py-2 rounded-2xl text-left cursor-pointer transition text-xs text-[var(--app-text-primary)] data-[selected=true]:bg-black/[0.05] dark:data-[selected=true]:bg-white/[0.08] active:scale-[0.99]"
                  >
                    <div className="flex items-center gap-2.5">
                      <Books size={16} className="text-amber-500" />
                      <span className="font-medium">Galería de Plantillas</span>
                    </div>
                  </Command.Item>

                  <Command.Item
                    onSelect={() => {
                      onClose()
                      window.dispatchEvent(new CustomEvent('seven-note-open-quick-capture'))
                    }}
                    className="w-full flex items-center justify-between px-3 py-2 rounded-2xl text-left cursor-pointer transition text-xs text-[var(--app-text-primary)] data-[selected=true]:bg-black/[0.05] dark:data-[selected=true]:bg-white/[0.08] active:scale-[0.99]"
                  >
                    <div className="flex items-center gap-2.5">
                      <span className="text-amber-500">⚡</span>
                      <span className="font-medium">Captura Rápida (Sticky Note)</span>
                    </div>
                    <span className="text-[10px] text-neutral-400 bg-black/[0.04] dark:bg-white/[0.06] px-2 py-0.5 rounded-full border border-black/[0.04] dark:border-white/[0.06]">
                      Alt N
                    </span>
                  </Command.Item>

                  <Command.Item
                    onSelect={() => {
                      window.dispatchEvent(new CustomEvent('seven-note-navigate-workspace', { detail: { viewType: 'trash', title: 'Papelera' } }))
                      onClose()
                    }}
                    className="w-full flex items-center justify-between px-3 py-2 rounded-2xl text-left cursor-pointer transition text-xs text-[var(--app-text-primary)] data-[selected=true]:bg-black/[0.05] dark:data-[selected=true]:bg-white/[0.08] active:scale-[0.99]"
                  >
                    <div className="flex items-center gap-2.5">
                      <DeleteIcon className="w-4 h-4 text-rose-500" />
                      <span className="font-medium">Papelera de reciclaje</span>
                    </div>
                  </Command.Item>
                </Command.Group>

                {/* Páginas */}
                {activeWorkspaces.length > 0 && (
                  <Command.Group
                    heading="Páginas y Documentos"
                    className="mt-2 pt-1.5 border-t border-black/[0.06] dark:border-white/[0.08] [&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-[10px] [&_[cmdk-group-heading]]:font-bold [&_[cmdk-group-heading]]:text-neutral-400 [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-wider"
                  >
                    {activeWorkspaces.map((ws) => (
                      <Command.Item
                        key={ws.id}
                        value={`${ws.title} ${ws.id}`}
                        onSelect={() => {
                          onSelectWorkspace(ws.id)
                          onClose()
                        }}
                        className="w-full flex items-center justify-between px-3 py-2 rounded-2xl text-left cursor-pointer transition text-xs text-[var(--app-text-primary)] data-[selected=true]:bg-black/[0.05] dark:data-[selected=true]:bg-white/[0.08] active:scale-[0.99]"
                      >
                        <div className="flex items-center gap-2.5">
                          <AppleEmoji emoji={ws.icon || '📄'} size={16} />
                          <span className="font-medium">{ws.title || 'Sin título'}</span>
                          {isItemUnread(ws, 'workspace', currentMember) && (
                            <NewBadge className="ml-1" />
                          )}
                        </div>
                        <ArrowRightSmallIcon className="w-3.5 h-3.5 text-neutral-400 opacity-60" />
                      </Command.Item>
                    ))}
                  </Command.Group>
                )}

                {/* Tarjetas del Tablero */}
                {activeNodes.length > 0 && (
                  <Command.Group
                    heading="Tarjetas del Lienzo"
                    className="mt-2 pt-1.5 border-t border-black/[0.06] dark:border-white/[0.08] [&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-[10px] [&_[cmdk-group-heading]]:font-bold [&_[cmdk-group-heading]]:text-neutral-400 [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-wider"
                  >
                    {activeNodes.slice(0, 15).map((n) => (
                      <Command.Item
                        key={n.id}
                        value={`${n.data.title || ''} ${n.data.content || ''} ${n.id}`}
                        onSelect={() => {
                          onSelectWorkspace(n.workspaceId)
                          onClose()
                        }}
                        className="w-full flex items-center justify-between px-3 py-2 rounded-2xl text-left cursor-pointer transition text-xs text-[var(--app-text-primary)] data-[selected=true]:bg-black/[0.05] dark:data-[selected=true]:bg-white/[0.08] active:scale-[0.99]"
                      >
                        <div className="flex items-center gap-2.5 truncate">
                          {n.type === 'note' && <PageIcon className="w-3.5 h-3.5 text-amber-500 shrink-0" />}
                          {n.type === 'todo' && <DatabaseKanbanViewIcon className="w-3.5 h-3.5 text-sky-500 shrink-0" />}
                          {n.type !== 'note' && n.type !== 'todo' && (
                            <PageIcon className="w-3.5 h-3.5 text-neutral-400 shrink-0" />
                          )}
                          <span className="font-medium truncate">
                            {n.data.title || 'Tarjeta sin título'}
                          </span>
                          {n.data.content && (
                            <span className="ml-2 text-neutral-400 text-[11px] truncate">
                              {n.data.content.slice(0, 35)}
                            </span>
                          )}
                        </div>
                        <span className="text-[10px] text-neutral-400 px-2 py-0.5 rounded-full bg-black/[0.04] dark:bg-white/[0.06] shrink-0 font-medium">
                          Lienzo
                        </span>
                      </Command.Item>
                    ))}
                  </Command.Group>
                )}
              </Command.List>

              {/* Footer */}
              <div className="px-4 py-2 border-t border-black/[0.06] dark:border-white/[0.08] bg-black/[0.02] dark:bg-white/[0.02] rounded-b-2xl text-[11px] text-neutral-400 flex items-center justify-between">
                <span className="hidden sm:inline">Navega con ↑↓ · Selecciona con ↵ · Sal con Esc</span>
                <span className="sm:hidden">Buscar y ejecutar</span>
                <span className="font-semibold text-neutral-500">Seven Search</span>
              </div>
            </Command>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>

    {/* Global Apple Emoji Explorer Modal */}
    {isGlobalEmojiOpen && typeof document !== 'undefined' && createPortal(
      <div
        className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-100"
        onClick={() => setIsGlobalEmojiOpen(false)}
      >
        <div onClick={(e) => e.stopPropagation()} className="relative">
          <EmojiPickerPopover
            isOpen={isGlobalEmojiOpen}
            onClose={() => setIsGlobalEmojiOpen(false)}
            onSelectEmoji={(emoji) => {
              navigator.clipboard.writeText(emoji)
              toast.success(`Emoji ${emoji} copiado al portapapeles. ¡Listo para pegar donde quieras!`)
              setIsGlobalEmojiOpen(false)
            }}
            title="Catálogo Completo de Emojis de Apple (1,870)"
            isModal={true}
          />
        </div>
      </div>,
      document.body
    )}
  </>
  )
}
