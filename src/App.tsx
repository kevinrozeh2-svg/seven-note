import { useState, useEffect } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import {
  FileText,
  LayoutGrid,
  Columns,
  PanelLeftClose,
  PanelLeft,
  Cloud,
  CloudOff,
  RefreshCw
} from 'lucide-react'
import { db, seedInitialData, type ViewMode, type WorkspaceItem } from './db'
import { syncEngine, type SyncEngineStatus } from './lib/syncEngine'
import { Sidebar } from './components/sidebar/Sidebar'
import { DocEditor } from './components/editor/DocEditor'
import { CanvasBoard } from './components/canvas/CanvasBoard'
import { CommandPalette } from './components/modals/CommandPalette'
import { SettingsModal } from './components/modals/SettingsModal'
import { TrashModal } from './components/modals/TrashModal'

export default function App() {
  const [currentWorkspaceId, setCurrentWorkspaceId] = useState<string>('welcome-workspace')
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [darkMode, setDarkMode] = useState(() => {
    return localStorage.getItem('seven_note_theme') === 'dark' ||
      (!('seven_note_theme' in localStorage) && window.matchMedia('(prefers-color-scheme: dark)').matches)
  })

  // Modals state
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)
  const [isSearchOpen, setIsSearchOpen] = useState(false)
  const [isTrashOpen, setIsTrashOpen] = useState(false)

  // Sync engine status
  const [syncStatus, setSyncStatus] = useState<SyncEngineStatus>(syncEngine.getStatus())

  // Reactive DB queries
  const workspaces = useLiveQuery(() => db.workspaces.toArray()) ?? []
  const allNodes = useLiveQuery(() => db.canvasNodes.toArray()) ?? []

  // Initialize DB and subscribe to sync
  useEffect(() => {
    seedInitialData()
    const unsubscribe = syncEngine.subscribe((status) => {
      setSyncStatus(status)
    })

    // Listen for custom sub-board navigation events
    const handleNavigate = (e: any) => {
      if (e.detail?.workspaceId) {
        setCurrentWorkspaceId(e.detail.workspaceId)
      }
    }
    window.addEventListener('seven-note-navigate-workspace', handleNavigate)

    return () => {
      unsubscribe()
      window.removeEventListener('seven-note-navigate-workspace', handleNavigate)
    }
  }, [])

  // Handle dark mode class on document
  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark')
      localStorage.setItem('seven_note_theme', 'dark')
    } else {
      document.documentElement.classList.remove('dark')
      localStorage.setItem('seven_note_theme', 'light')
    }
  }, [darkMode])

  // Select active workspace or fallback to first available
  const activeWorkspaces = workspaces.filter((w) => !w.isDeleted)
  const currentWorkspace: WorkspaceItem | undefined =
    activeWorkspaces.find((w) => w.id === currentWorkspaceId) || activeWorkspaces[0]

  // Update view mode
  const setViewMode = async (mode: ViewMode) => {
    if (!currentWorkspace) return
    try {
      await db.workspaces.update(currentWorkspace.id, {
        viewMode: mode,
        updatedAt: Date.now(),
        syncStatus: 'pending'
      })
      syncEngine.scheduleSync(1000)
    } catch (e) {
      console.error('Error changing view mode', e)
    }
  }

  // Update title
  const handleTitleChange = async (newTitle: string) => {
    if (!currentWorkspace) return
    try {
      await db.workspaces.update(currentWorkspace.id, {
        title: newTitle,
        updatedAt: Date.now(),
        syncStatus: 'pending'
      })
      syncEngine.scheduleSync(1500)
    } catch (e) {
      console.error('Error changing title', e)
    }
  }

  // Compute breadcrumbs for nested boards
  const getBreadcrumbs = () => {
    if (!currentWorkspace) return []
    const trail: WorkspaceItem[] = [currentWorkspace]
    let parentId = currentWorkspace.parentId
    while (parentId) {
      const parent = activeWorkspaces.find((w) => w.id === parentId)
      if (parent) {
        trail.unshift(parent)
        parentId = parent.parentId
      } else {
        break
      }
    }
    return trail
  }

  const breadcrumbs = getBreadcrumbs()
  const activeViewMode: ViewMode = currentWorkspace?.viewMode || 'split'

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100">
      {/* Sidebar Navigation */}
      {sidebarOpen && (
        <Sidebar
          workspaces={workspaces}
          currentWorkspaceId={currentWorkspace?.id || ''}
          onSelectWorkspace={(id) => setCurrentWorkspaceId(id)}
          onOpenSettings={() => setIsSettingsOpen(true)}
          onOpenSearch={() => setIsSearchOpen(true)}
          onOpenTrash={() => setIsTrashOpen(true)}
          syncStatus={syncStatus}
          darkMode={darkMode}
          onToggleDarkMode={() => setDarkMode(!darkMode)}
        />
      )}

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col h-full min-w-0 overflow-hidden">
        {/* Top Header Bar */}
        <header className="h-13 border-b border-slate-200 dark:border-slate-800 bg-white/95 dark:bg-slate-900/95 backdrop-blur px-4 flex items-center justify-between shrink-0 z-20">
          {/* Left: Sidebar toggle & Breadcrumbs */}
          <div className="flex items-center gap-2 min-w-0">
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400 transition"
              title={sidebarOpen ? 'Ocultar barra lateral' : 'Mostrar barra lateral'}
            >
              {sidebarOpen ? <PanelLeftClose size={18} /> : <PanelLeft size={18} />}
            </button>

            {/* Breadcrumbs */}
            <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 overflow-hidden truncate">
              {breadcrumbs.map((crumb, idx) => (
                <div key={crumb.id} className="flex items-center gap-1.5 truncate">
                  {idx > 0 && <span className="text-slate-300 dark:text-slate-600">/</span>}
                  <button
                    onClick={() => setCurrentWorkspaceId(crumb.id)}
                    className={`hover:text-indigo-600 dark:hover:text-indigo-400 transition truncate ${
                      idx === breadcrumbs.length - 1
                        ? 'font-bold text-slate-800 dark:text-slate-200'
                        : ''
                    }`}
                  >
                    <span>{crumb.icon} </span>
                    <span>{crumb.title}</span>
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Center: View Mode Switcher (Doc vs Canvas vs Split) */}
          <div className="flex items-center p-1 rounded-xl bg-slate-100 dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700/60 shadow-xs">
            <button
              onClick={() => setViewMode('doc')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                activeViewMode === 'doc'
                  ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
              title="Modo Documento (estilo Notion)"
            >
              <FileText size={14} />
              <span className="hidden sm:inline">Documento</span>
            </button>

            <button
              onClick={() => setViewMode('canvas')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                activeViewMode === 'canvas'
                  ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
              title="Modo Tablero (estilo Milanote)"
            >
              <LayoutGrid size={14} />
              <span className="hidden sm:inline">Tablero</span>
            </button>

            <button
              onClick={() => setViewMode('split')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                activeViewMode === 'split'
                  ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
              title="Modo Dividido (AFFiNE híbrido)"
            >
              <Columns size={14} />
              <span className="hidden sm:inline">Dividido</span>
            </button>
          </div>

          {/* Right: Cloud Sync Badge & Settings */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsSettingsOpen(true)}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 transition"
              title="Estado de sincronización y configuración"
            >
              {syncStatus.state === 'syncing' ? (
                <RefreshCw size={13} className="text-indigo-500 animate-spin" />
              ) : syncStatus.state === 'synced' ? (
                <Cloud size={13} className="text-emerald-500" />
              ) : syncStatus.state === 'offline' ? (
                <CloudOff size={13} className="text-amber-500" />
              ) : (
                <Cloud size={13} className="text-slate-400" />
              )}
              <span className="hidden md:inline">
                {syncStatus.state === 'synced'
                  ? 'Sincronizado'
                  : syncStatus.state === 'syncing'
                  ? 'Sincronizando'
                  : syncStatus.state === 'offline'
                  ? 'Offline'
                  : 'Local'}
              </span>
            </button>
          </div>
        </header>

        {/* Workspace Views */}
        <main className="flex-1 relative flex overflow-hidden">
          {currentWorkspace ? (
            activeViewMode === 'doc' ? (
              <div className="flex-1 h-full overflow-hidden">
                <DocEditor
                  workspaceId={currentWorkspace.id}
                  initialContent={currentWorkspace.docContent}
                  title={currentWorkspace.title}
                  onTitleChange={handleTitleChange}
                />
              </div>
            ) : activeViewMode === 'canvas' ? (
              <div className="flex-1 h-full overflow-hidden">
                <CanvasBoard workspaceId={currentWorkspace.id} />
              </div>
            ) : (
              /* Split View: Notion on Left, Milanote on Right */
              <div className="flex-1 flex h-full overflow-hidden">
                <div className="w-1/2 h-full overflow-hidden border-r border-slate-200 dark:border-slate-800">
                  <DocEditor
                    workspaceId={currentWorkspace.id}
                    initialContent={currentWorkspace.docContent}
                    title={currentWorkspace.title}
                    onTitleChange={handleTitleChange}
                  />
                </div>
                <div className="w-1/2 h-full overflow-hidden">
                  <CanvasBoard workspaceId={currentWorkspace.id} />
                </div>
              </div>
            )
          ) : (
            <div className="flex-1 flex items-center justify-center text-slate-400 text-sm">
              Selecciona o crea una página para comenzar.
            </div>
          )}
        </main>
      </div>

      {/* Global Modals */}
      <CommandPalette
        isOpen={isSearchOpen}
        onClose={() => setIsSearchOpen(false)}
        workspaces={workspaces}
        nodes={allNodes}
        onSelectWorkspace={(id) => setCurrentWorkspaceId(id)}
      />

      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        syncStatus={syncStatus}
      />

      <TrashModal
        isOpen={isTrashOpen}
        onClose={() => setIsTrashOpen(false)}
      />
    </div>
  )
}
