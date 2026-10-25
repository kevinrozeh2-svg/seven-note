import { useState, useEffect } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import {
  FileText,
  Network,
  Star,
  Info,
  MoreHorizontal,
  Lock,
  Sparkles,
  List,
  Calendar,
  SlidersHorizontal,
  PanelRightClose,
  PanelRight,
  Copy,
  Trash2,
  Maximize2,
  Presentation,
  GripVertical
} from 'lucide-react'
import { db, seedInitialData, type ViewMode, type WorkspaceItem } from './db'
import { syncEngine, type SyncEngineStatus } from './lib/syncEngine'
import { Sidebar } from './components/sidebar/Sidebar'
import { DocEditor } from './components/editor/DocEditor'
import { CanvasBoard } from './components/canvas/CanvasBoard'
import { RightSidebar } from './components/sidebar/RightSidebar'
import { CommandPalette } from './components/modals/CommandPalette'
import { SettingsModal } from './components/modals/SettingsModal'
import { TrashModal } from './components/modals/TrashModal'
import { ShareModal } from './components/modals/ShareModal'
import { TemplatesModal } from './components/modals/TemplatesModal'
import { AIModal } from './components/modals/AIModal'
import { AllDocsModal } from './components/modals/AllDocsModal'
import { ImportModal } from './components/modals/ImportModal'
import { PresentationViewer } from './components/presentation/PresentationViewer'
import { type AppTemplate } from './lib/templates'

export default function App() {
  const [currentWorkspaceId, setCurrentWorkspaceId] = useState<string>('untitled-workspace')
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [rightSidebarOpen, setRightSidebarOpen] = useState(false)
  const [rightSidebarTab, setRightSidebarTab] = useState<'properties' | 'outline' | 'ai' | 'history'>('properties')
  const [isPresentationMode, setIsPresentationMode] = useState(false)
  const [presentationFrameId, setPresentationFrameId] = useState<string | undefined>(undefined)
  const [darkMode, setDarkMode] = useState(() => {
    return localStorage.getItem('seven_note_theme') !== 'light'
  })

  // Modals state
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)
  const [isSearchOpen, setIsSearchOpen] = useState(false)
  const [isTrashOpen, setIsTrashOpen] = useState(false)
  const [isShareOpen, setIsShareOpen] = useState(false)
  const [isTemplatesOpen, setIsTemplatesOpen] = useState(false)
  const [isAIOpen, setIsAIOpen] = useState(false)
  const [isAllDocsOpen, setIsAllDocsOpen] = useState(false)
  const [isImportOpen, setIsImportOpen] = useState(false)

  // Top header popovers
  const [isInfoOpen, setIsInfoOpen] = useState(false)
  const [isMoreMenuOpen, setIsMoreMenuOpen] = useState(false)
  const [copiedLink, setCopiedLink] = useState(false)

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

    // Listen for custom mode switch events
    const handleSwitchMode = (e: any) => {
      if (e.detail?.mode) {
        setViewMode(e.detail.mode)
      }
      if (e.detail?.workspaceId) {
        setCurrentWorkspaceId(e.detail.workspaceId)
      }
    }

    // Listen for presentation start events from canvas frames
    const handleStartPresentation = (e: any) => {
      if (e.detail?.frameId) {
        setPresentationFrameId(e.detail.frameId)
      }
      setIsPresentationMode(true)
    }

    // Escape exits presentation mode
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isPresentationMode) {
        setIsPresentationMode(false)
        setPresentationFrameId(undefined)
      }
    }

    window.addEventListener('seven-note-navigate-workspace', handleNavigate)
    window.addEventListener('seven-note-switch-mode', handleSwitchMode)
    window.addEventListener('seven-note-start-presentation', handleStartPresentation)
    window.addEventListener('keydown', handleKeyDown)

    return () => {
      unsubscribe()
      window.removeEventListener('seven-note-navigate-workspace', handleNavigate)
      window.removeEventListener('seven-note-switch-mode', handleSwitchMode)
      window.removeEventListener('seven-note-start-presentation', handleStartPresentation)
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [isPresentationMode])

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
        documentMode: mode === 'canvas' ? 'Sin bordes' : mode === 'doc' ? 'Estándar' : 'Dividido',
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

  // Toggle favorite
  const handleToggleFavorite = async () => {
    if (!currentWorkspace) return
    try {
      await db.workspaces.update(currentWorkspace.id, {
        isFavorite: !currentWorkspace.isFavorite,
        updatedAt: Date.now(),
        syncStatus: 'pending'
      })
      syncEngine.scheduleSync(1000)
    } catch (e) {
      console.error('Error toggling favorite', e)
    }
  }

  // Handle Daily Journal creation or navigation
  const handleOpenDailyJournal = async () => {
    const todayStr = new Date().toLocaleDateString('es-ES', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    })
    const journalTitle = `Diario: ${todayStr}`

    // Check if journal for today exists
    const existing = activeWorkspaces.find(
      (w) => w.isJournal && (w.title === journalTitle || w.journalDate === todayStr)
    )

    if (existing) {
      setCurrentWorkspaceId(existing.id)
      return
    }

    // Create new daily journal note
    const newId = crypto.randomUUID()
    const now = Date.now()
    const journalDoc = `
      <h1>📅 Diario: ${todayStr}</h1>
      <p><em>"Cada día es una nueva oportunidad para avanzar y aprender."</em></p>
      
      <h3>🎯 Enfoque Principal</h3>
      <ul data-type="taskList">
        <li data-checked="false"><label><input type="checkbox"><span></span></label><div>Meta prioritaria del día: </div></li>
        <li data-checked="false"><label><input type="checkbox"><span></span></label><div>Reuniones o entregas pendientes: </div></li>
      </ul>

      <h3>💡 Notas & Reflexiones</h3>
      <p>Anota ideas clave, bloqueos o soluciones encontradas hoy...</p>
    `

    await db.workspaces.add({
      id: newId,
      parentId: null,
      folder: 'First Folder',
      title: journalTitle,
      icon: '📅',
      color: '#0ea5e9',
      viewMode: 'canvas',
      docContent: journalDoc,
      createdAt: now,
      updatedAt: now,
      isFavorite: false,
      isDeleted: false,
      syncStatus: 'pending',
      isJournal: true,
      journalDate: todayStr,
      activeProperties: ['tags', 'isJournal', 'createdAt', 'updatedAt']
    })
    syncEngine.scheduleSync(1000)
    setCurrentWorkspaceId(newId)
  }

  // Insert AI generated content
  const handleInsertAIContent = async (aiContent: string) => {
    if (!currentWorkspace) return
    const appended = `${currentWorkspace.docContent}<br/>${aiContent}`
    await db.workspaces.update(currentWorkspace.id, {
      docContent: appended,
      updatedAt: Date.now(),
      syncStatus: 'pending'
    })
    syncEngine.scheduleSync(1000)
  }

  // Apply template (Supports both Edgeless Canvas and Document templates)
  const handleApplyTemplate = async (template: AppTemplate) => {
    if (!currentWorkspace) return
    const now = Date.now()

    if (template.type === 'canvas' && template.nodes) {
      // 1. Update workspace title and viewMode to canvas
      await db.workspaces.update(currentWorkspace.id, {
        title: currentWorkspace.title === 'Untitled' ? template.title : currentWorkspace.title,
        icon: template.icon,
        viewMode: 'canvas',
        templateName: template.title,
        updatedAt: now,
        syncStatus: 'pending'
      })

      // 2. Insert canvas nodes
      const createdNodeIds: string[] = []
      for (const nodeDef of template.nodes) {
        const newNodeId = crypto.randomUUID()
        createdNodeIds.push(newNodeId)
        await db.canvasNodes.add({
          id: newNodeId,
          workspaceId: currentWorkspace.id,
          type: nodeDef.type,
          positionX: nodeDef.positionX,
          positionY: nodeDef.positionY,
          data: {
            ...nodeDef.data,
            workspaceId: currentWorkspace.id
          },
          createdAt: now,
          updatedAt: now,
          isDeleted: false,
          syncStatus: 'pending'
        })
      }

      // 3. Insert canvas edges
      if (template.edges) {
        for (const edgeDef of template.edges) {
          const sourceId = createdNodeIds[edgeDef.sourceIndex]
          const targetId = createdNodeIds[edgeDef.targetIndex]
          if (sourceId && targetId) {
            await db.canvasEdges.add({
              id: crypto.randomUUID(),
              workspaceId: currentWorkspace.id,
              source: sourceId,
              target: targetId,
              label: edgeDef.label,
              animated: true,
              color: edgeDef.color || '#3b82f6',
              createdAt: now,
              updatedAt: now,
              isDeleted: false,
              syncStatus: 'pending'
            })
          }
        }
      }
    } else {
      // Document template
      await db.workspaces.update(currentWorkspace.id, {
        title: currentWorkspace.title === 'Untitled' ? template.title : currentWorkspace.title,
        icon: template.icon,
        docContent: template.docContent || '<p></p>',
        templateName: template.title,
        updatedAt: now,
        syncStatus: 'pending'
      })
    }

    syncEngine.scheduleSync(1000)
  }

  // Scroll to heading in document
  const handleScrollToHeading = (headingText: string) => {
    const editorEl = document.querySelector('.ProseMirror')
    if (!editorEl) return
    const headings = Array.from(editorEl.querySelectorAll('h1, h2, h3'))
    const match = headings.find((h) => h.textContent?.trim() === headingText.trim())
    if (match) {
      match.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
  }

  // Word & character stats
  const getStats = () => {
    if (!currentWorkspace?.docContent) return { words: 0, chars: 0, time: 1 }
    const text = currentWorkspace.docContent.replace(/<[^>]*>/g, ' ').trim()
    const chars = text.length
    const words = text ? text.split(/\s+/).filter(Boolean).length : 0
    const time = Math.max(1, Math.ceil(words / 200))
    return { words, chars, time }
  }

  const stats = getStats()
  const activeViewMode: ViewMode = currentWorkspace?.viewMode || 'canvas'

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-[#121214] text-zinc-100 font-sans">
      {/* 1. Left Sidebar Navigation */}
      {sidebarOpen && !isPresentationMode && (
        <Sidebar
          workspaces={workspaces}
          currentWorkspaceId={currentWorkspace?.id || ''}
          onSelectWorkspace={(id) => setCurrentWorkspaceId(id)}
          onToggleSidebar={() => setSidebarOpen(false)}
          onOpenSettings={() => setIsSettingsOpen(true)}
          onOpenSearch={() => setIsSearchOpen(true)}
          onOpenAllDocs={() => setIsAllDocsOpen(true)}
          onOpenDailyJournal={handleOpenDailyJournal}
          onOpenTrash={() => setIsTrashOpen(true)}
          onOpenImport={() => setIsImportOpen(true)}
          onOpenTemplates={() => setIsTemplatesOpen(true)}
          syncStatus={syncStatus}
          darkMode={darkMode}
          onToggleDarkMode={() => setDarkMode(!darkMode)}
        />
      )}

      {/* 2. Main Content Center Column */}
      <div className="flex-1 flex flex-col h-full min-w-0 overflow-hidden bg-[#121214]">
        {/* Top Header Bar (Matches Screenshots 1 & 2) */}
        {!isPresentationMode && (
          <header className="h-12 border-b border-[#242428] bg-[#121214] px-3.5 flex items-center justify-between shrink-0 z-20 select-none">
            {/* Left section: Grip dots ::: , Segmented Mode Switcher [ 📄 | ☍ ], title, star, info, more */}
            <div className="flex items-center gap-2 min-w-0">
              {/* Grip Dots / Sidebar Toggle ::: */}
              <button
                onClick={() => setSidebarOpen(!sidebarOpen)}
                className="p-1 rounded text-zinc-400 hover:text-zinc-100 hover:bg-[#202024] transition"
                title={sidebarOpen ? 'Ocultar barra lateral' : 'Mostrar barra lateral'}
              >
                <GripVertical size={16} />
              </button>

              {/* Segmented Control [ 📄 | ☍ ] (Matches Screenshot) */}
              <div className="flex items-center p-0.5 rounded-lg bg-[#1a1a1e] border border-[#27272c]">
                <button
                  onClick={() => setViewMode('doc')}
                  className={`p-1 rounded-md transition ${
                    activeViewMode === 'doc'
                      ? 'bg-[#292930] text-zinc-100 shadow-xs'
                      : 'text-zinc-400 hover:text-zinc-200'
                  }`}
                  title="Modo Documento (📄)"
                >
                  <FileText size={14} />
                </button>
                <button
                  onClick={() => setViewMode('canvas')}
                  className={`p-1 rounded-md transition ${
                    activeViewMode === 'canvas'
                      ? 'bg-[#292930] text-zinc-100 shadow-xs'
                      : 'text-zinc-400 hover:text-zinc-200'
                  }`}
                  title="Modo Lienzo / Sin bordes (☍)"
                >
                  <Network size={14} />
                </button>
              </div>

              {/* Document Title synced */}
              <span className="font-semibold text-xs sm:text-sm text-zinc-200 truncate max-w-[140px] sm:max-w-[240px]">
                {currentWorkspace?.title || 'Untitled'}
              </span>

              {/* Star Favorite Button */}
              <button
                onClick={handleToggleFavorite}
                className="p-1.5 rounded-md hover:bg-[#202024] text-zinc-400 hover:text-zinc-100 transition"
                title={currentWorkspace?.isFavorite ? 'Quitar de favoritos' : 'Añadir a favoritos'}
              >
                <Star
                  size={14}
                  className={currentWorkspace?.isFavorite ? 'text-amber-400 fill-amber-400' : ''}
                />
              </button>

              {/* Info Button ⓘ */}
              <div className="relative">
                <button
                  onClick={() => setIsInfoOpen(!isInfoOpen)}
                  className="p-1.5 rounded-md hover:bg-[#202024] text-zinc-400 hover:text-zinc-100 transition"
                  title="Información del documento"
                >
                  <Info size={14} />
                </button>

                {isInfoOpen && (
                  <div
                    className="absolute left-0 top-8 z-40 w-64 bg-[#1b1b1e] border border-[#2c2c32] rounded-xl shadow-2xl p-3 text-xs text-zinc-300"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="font-semibold text-zinc-100 pb-2 border-b border-[#292930] mb-2">
                      Estadísticas de la página
                    </div>
                    <div className="space-y-1.5 text-[11px]">
                      <div className="flex justify-between">
                        <span className="text-zinc-500">Palabras:</span>
                        <span className="font-mono text-zinc-200">{stats.words}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-zinc-500">Caracteres:</span>
                        <span className="font-mono text-zinc-200">{stats.chars}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-zinc-500">Tiempo de lectura:</span>
                        <span className="font-mono text-zinc-200">~{stats.time} min</span>
                      </div>
                      <div className="flex justify-between pt-1 border-t border-[#292930]">
                        <span className="text-zinc-500">Modo:</span>
                        <span className="capitalize text-blue-400">{currentWorkspace?.viewMode}</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* More options menu `...` */}
              <div className="relative">
                <button
                  onClick={() => setIsMoreMenuOpen(!isMoreMenuOpen)}
                  className="p-1.5 rounded-md hover:bg-[#202024] text-zinc-400 hover:text-zinc-100 transition"
                  title="Más acciones"
                >
                  <MoreHorizontal size={14} />
                </button>

                {isMoreMenuOpen && (
                  <div
                    className="absolute left-0 top-8 z-40 w-52 bg-[#1b1b1e] border border-[#2c2c32] rounded-xl shadow-2xl py-1 text-xs text-zinc-300"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <button
                      onClick={() => {
                        setViewMode(activeViewMode === 'canvas' ? 'doc' : 'canvas')
                        setIsMoreMenuOpen(false)
                      }}
                      className="w-full text-left px-3 py-1.5 hover:bg-[#26262c] flex items-center gap-2"
                    >
                      <Maximize2 size={13} className="text-indigo-400" />
                      <span>{activeViewMode === 'canvas' ? 'Modo Documento' : 'Modo Sin bordes (Lienzo)'}</span>
                    </button>

                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(window.location.href)
                        setCopiedLink(true)
                        setTimeout(() => setCopiedLink(false), 2000)
                        setIsMoreMenuOpen(false)
                      }}
                      className="w-full text-left px-3 py-1.5 hover:bg-[#26262c] flex items-center gap-2"
                    >
                      <Copy size={13} />
                      <span>{copiedLink ? 'Enlace copiado!' : 'Copiar enlace a nota'}</span>
                    </button>

                    <div className="border-t border-[#292930] my-1" />

                    <button
                      onClick={() => {
                        if (currentWorkspace) {
                          db.workspaces.update(currentWorkspace.id, {
                            isDeleted: true,
                            updatedAt: Date.now()
                          })
                        }
                        setIsMoreMenuOpen(false)
                      }}
                      className="w-full text-left px-3 py-1.5 hover:bg-rose-950/40 text-rose-400 flex items-center gap-2"
                    >
                      <Trash2 size={13} />
                      <span>Eliminar página</span>
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Right section: Presentation Icon 📽️, Tabs (if in Doc mode), and Blue "Compartir" pill button */}
            <div className="flex items-center gap-2">
              {/* Presentation Icon (Matches Screenshot 2) */}
              <button
                onClick={() => setIsPresentationMode(true)}
                className="p-1.5 rounded-md text-zinc-400 hover:text-zinc-100 hover:bg-[#202024] transition"
                title="Modo Presentación pantalla completa"
              >
                <Presentation size={16} />
              </button>

              {/* Right Sidebar Tabs (shown when in doc mode or when right sidebar is toggled) */}
              {activeViewMode === 'doc' && (
                <>
                  <div className="w-[1px] h-4 bg-[#2f2f35] mx-1" />
                  <div className="flex items-center gap-0.5">
                    <button
                      onClick={() => {
                        setRightSidebarTab('ai')
                        setRightSidebarOpen(true)
                      }}
                      className={`p-1.5 rounded-md transition ${
                        rightSidebarOpen && rightSidebarTab === 'ai'
                          ? 'bg-[#28282e] text-zinc-100'
                          : 'text-zinc-400 hover:text-zinc-200 hover:bg-[#202024]'
                      }`}
                      title="IA Asistente"
                    >
                      <Sparkles size={15} />
                    </button>

                    <button
                      onClick={() => {
                        setRightSidebarTab('outline')
                        setRightSidebarOpen(true)
                      }}
                      className={`p-1.5 rounded-md transition ${
                        rightSidebarOpen && rightSidebarTab === 'outline'
                          ? 'bg-[#28282e] text-zinc-100'
                          : 'text-zinc-400 hover:text-zinc-200 hover:bg-[#202024]'
                      }`}
                      title="Esquema"
                    >
                      <List size={15} />
                    </button>

                    <button
                      onClick={() => {
                        setRightSidebarTab('history')
                        setRightSidebarOpen(true)
                      }}
                      className={`p-1.5 rounded-md transition ${
                        rightSidebarOpen && rightSidebarTab === 'history'
                          ? 'bg-[#28282e] text-zinc-100'
                          : 'text-zinc-400 hover:text-zinc-200 hover:bg-[#202024]'
                      }`}
                      title="Diarios / Historial"
                    >
                      <Calendar size={15} />
                    </button>

                    <button
                      onClick={() => {
                        setRightSidebarTab('properties')
                        setRightSidebarOpen(true)
                      }}
                      className={`p-1.5 rounded-md transition ${
                        rightSidebarOpen && rightSidebarTab === 'properties'
                          ? 'bg-[#28282e] text-zinc-100'
                          : 'text-zinc-400 hover:text-zinc-200 hover:bg-[#202024]'
                      }`}
                      title="Propiedades"
                    >
                      <SlidersHorizontal size={15} />
                    </button>

                    <button
                      onClick={() => setRightSidebarOpen(!rightSidebarOpen)}
                      className="p-1.5 rounded-md text-zinc-400 hover:text-zinc-200 hover:bg-[#202024] transition ml-0.5"
                      title={rightSidebarOpen ? 'Ocultar panel derecho' : 'Mostrar panel derecho'}
                    >
                      {rightSidebarOpen ? <PanelRightClose size={15} /> : <PanelRight size={15} />}
                    </button>
                  </div>
                </>
              )}

              {/* Blue "Compartir" Button (Matches Screenshot: blue pill `#1a73e8` / `#2563eb`) */}
              <button
                onClick={() => setIsShareOpen(true)}
                className="px-3.5 py-1.5 rounded-md bg-[#1a73e8] hover:bg-blue-600 active:bg-blue-700 text-white font-medium text-xs flex items-center gap-1.5 shadow-sm transition"
              >
                <Lock size={12} className="stroke-[2.5]" />
                <span>Compartir</span>
              </button>
            </div>
          </header>
        )}

        {/* Main Document / Canvas View */}
        <main className="flex-1 relative flex overflow-hidden">
          {currentWorkspace ? (
            activeViewMode === 'doc' ? (
              <div className="flex-1 h-full overflow-hidden">
                <DocEditor
                  workspace={currentWorkspace}
                  allWorkspaces={activeWorkspaces}
                  onSelectWorkspace={(id) => setCurrentWorkspaceId(id)}
                  onTitleChange={handleTitleChange}
                  onToggleViewMode={() => setViewMode('canvas')}
                  onOpenAIModal={() => setIsAIOpen(true)}
                  onOpenTemplatesModal={() => setIsTemplatesOpen(true)}
                />
              </div>
            ) : activeViewMode === 'canvas' ? (
              <div className="flex-1 h-full overflow-hidden relative">
                <CanvasBoard
                  workspaceId={currentWorkspace.id}
                  currentWorkspace={currentWorkspace}
                  onSwitchToDoc={() => setViewMode('doc')}
                />
              </div>
            ) : (
              /* Split View */
              <div className="flex-1 flex h-full overflow-hidden">
                <div className="w-1/2 h-full overflow-hidden border-r border-[#242428]">
                  <DocEditor
                    workspace={currentWorkspace}
                    allWorkspaces={activeWorkspaces}
                    onSelectWorkspace={(id) => setCurrentWorkspaceId(id)}
                    onTitleChange={handleTitleChange}
                    onToggleViewMode={() => setViewMode('canvas')}
                    onOpenAIModal={() => setIsAIOpen(true)}
                    onOpenTemplatesModal={() => setIsTemplatesOpen(true)}
                  />
                </div>
                <div className="w-1/2 h-full overflow-hidden">
                  <CanvasBoard
                    workspaceId={currentWorkspace.id}
                    currentWorkspace={currentWorkspace}
                    onSwitchToDoc={() => setViewMode('doc')}
                  />
                </div>
              </div>
            )
          ) : (
            <div className="flex-1 flex items-center justify-center text-zinc-500 text-sm">
              Selecciona o crea una página para comenzar.
            </div>
          )}
        </main>
      </div>

      {/* 3. Right Sidebar (Propiedades, Outline, AI, Historial) */}
      {rightSidebarOpen && !isPresentationMode && activeViewMode === 'doc' && (
        <RightSidebar
          workspace={currentWorkspace}
          isOpen={rightSidebarOpen}
          onClose={() => setRightSidebarOpen(false)}
          activeTab={rightSidebarTab}
          onTabChange={(tab) => setRightSidebarTab(tab)}
          onApplyAIContent={handleInsertAIContent}
          onScrollToHeading={handleScrollToHeading}
        />
      )}

      {/* 4. Global Modals */}
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

      <ShareModal
        isOpen={isShareOpen}
        onClose={() => setIsShareOpen(false)}
        workspace={currentWorkspace}
      />

      <TemplatesModal
        isOpen={isTemplatesOpen}
        onClose={() => setIsTemplatesOpen(false)}
        onSelectTemplate={handleApplyTemplate}
      />

      <AIModal
        isOpen={isAIOpen}
        onClose={() => setIsAIOpen(false)}
        onInsertContent={handleInsertAIContent}
        currentTitle={currentWorkspace?.title}
      />

      <AllDocsModal
        isOpen={isAllDocsOpen}
        onClose={() => setIsAllDocsOpen(false)}
        workspaces={workspaces}
        currentWorkspaceId={currentWorkspace?.id || ''}
        onSelectWorkspace={(id) => setCurrentWorkspaceId(id)}
        onCreateWorkspace={() => {
          const newId = crypto.randomUUID()
          const now = Date.now()
          db.workspaces.add({
            id: newId,
            parentId: null,
            title: 'Untitled',
            icon: '',
            color: '#3b82f6',
            viewMode: 'canvas',
            docContent: '<p></p>',
            createdAt: now,
            updatedAt: now,
            isFavorite: false,
            isDeleted: false,
            syncStatus: 'pending'
          })
          setCurrentWorkspaceId(newId)
        }}
        onToggleFavorite={async (e, ws) => {
          e.stopPropagation()
          await db.workspaces.update(ws.id, { isFavorite: !ws.isFavorite })
        }}
        onDeleteWorkspace={async (e, id) => {
          e.stopPropagation()
          await db.workspaces.update(id, { isDeleted: true })
        }}
      />

      <ImportModal
        isOpen={isImportOpen}
        onClose={() => setIsImportOpen(false)}
        onWorkspaceImported={(newId) => setCurrentWorkspaceId(newId)}
      />

      {/* 5. AFFiNE Fullscreen Presentation Mode Player */}
      <PresentationViewer
        isOpen={isPresentationMode}
        onClose={() => {
          setIsPresentationMode(false)
          setPresentationFrameId(undefined)
        }}
        workspace={currentWorkspace}
        nodes={allNodes.filter((n) => n.workspaceId === currentWorkspace?.id)}
        initialFrameId={presentationFrameId}
      />
    </div>
  )
}
