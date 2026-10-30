import { useState, useEffect, useCallback } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import {
  PageIcon,
  EdgelessIcon,
  SidebarIcon,
  SplitViewIcon,
  FavoriteIcon,
  FavoritedIcon,
  InfoIcon,
  MoreHorizontalIcon,
  PresentationIcon,
  ShareIcon,
  CopyIcon,
  KeyboardIcon,
  DeleteIcon,
  SearchIcon,
  DownloadIcon
} from '@blocksuite/icons/rc'
import {
  db,
  seedInitialData,
  type ViewMode,
  type WorkspaceItem,
  DEFAULT_SPACE_ID,
  createSpace,
  updateSpace,
  deleteSpace
} from './db'
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
import { ShortcutsModal } from './components/modals/ShortcutsModal'
import { CreateWorkspaceModal } from './components/modals/CreateWorkspaceModal'
import { CollectionsModal } from './components/modals/CollectionsModal'
import { TagsModal } from './components/modals/TagsModal'
import { KnowledgeGraphModal } from './components/modals/KnowledgeGraphModal'
import { FindInPage } from './components/search/FindInPage'
import { WorkbenchTabs, type WorkbenchTab } from './components/tabs/WorkbenchTabs'
import { PresentationViewer } from './components/presentation/PresentationViewer'
import { AllDocsPage } from './components/views/AllDocsPage'
import { KnowledgeGraphPage } from './components/views/KnowledgeGraphPage'
import { TrashPage } from './components/views/TrashPage'
import { TemplatesPage } from './components/views/TemplatesPage'
import { CollectionsPage } from './components/views/CollectionsPage'
import { TagsPage } from './components/views/TagsPage'
import { type AppTemplate } from './lib/templates'
import {
  exportDocumentAsMarkdown,
  exportDocumentAsHtml,
  exportDocumentAsJson,
  copyAsPlainText
} from './lib/exportUtils'
import { Toaster, toast } from 'sonner'

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

  // Interface scaling (Zoom UI)
  const UI_SCALES = ['90', '100', '110', '120', '130']
  const [uiScale, setUiScale] = useState<string>(() => {
    return localStorage.getItem('seven_note_ui_scale') || '100'
  })

  useEffect(() => {
    document.documentElement.setAttribute('data-ui-scale', uiScale)
    localStorage.setItem('seven_note_ui_scale', uiScale)
  }, [uiScale])

  const handleStepUiScale = (dir: 1 | -1) => {
    setUiScale((current) => {
      const idx = UI_SCALES.indexOf(current)
      const nextIdx = Math.max(0, Math.min(UI_SCALES.length - 1, (idx === -1 ? 1 : idx) + dir))
      const nextScale = UI_SCALES[nextIdx]
      toast.info(`Escala de interfaz: ${nextScale}%`)
      return nextScale
    })
  }

  // Workspaces (Spaces) management
  const spaces = useLiveQuery(() => db.spaces.toArray()) ?? []
  const [currentSpaceId, setCurrentSpaceId] = useState<string>(() => {
    return localStorage.getItem('seven_note_active_space_id') || DEFAULT_SPACE_ID
  })
  const [isCreateWorkspaceOpen, setIsCreateWorkspaceOpen] = useState(false)

  // Modals state
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)
  const [isSearchOpen, setIsSearchOpen] = useState(false)
  const [isTrashOpen, setIsTrashOpen] = useState(false)
  const [isShareOpen, setIsShareOpen] = useState(false)
  const [isTemplatesOpen, setIsTemplatesOpen] = useState(false)
  const [isAIOpen, setIsAIOpen] = useState(false)
  const [isAllDocsOpen, setIsAllDocsOpen] = useState(false)
  const [isImportOpen, setIsImportOpen] = useState(false)
  const [isShortcutsOpen, setIsShortcutsOpen] = useState(false)
  const [isCollectionsOpen, setIsCollectionsOpen] = useState(false)
  const [isTagsOpen, setIsTagsOpen] = useState(false)
  const [selectedTagForModal, setSelectedTagForModal] = useState<string | null>(null)
  const [isKnowledgeGraphOpen, setIsKnowledgeGraphOpen] = useState(false)
  const [isFindInPageOpen, setIsFindInPageOpen] = useState(false)
  const [activeDropdown, setActiveDropdown] = useState<'info' | 'more' | 'export' | null>(null)
  const [focusMode, setFocusMode] = useState(false)

  // Workbench tabs state
  const [tabs, setTabs] = useState<WorkbenchTab[]>(() => {
    try {
      const saved = localStorage.getItem('seven_note_workbench_tabs')
      if (saved) {
        const parsed = JSON.parse(saved)
        if (Array.isArray(parsed) && parsed.length > 0) return parsed
      }
    } catch (e) {
      // fallback
    }
    return [{ id: 'tab-initial', workspaceId: 'untitled-workspace', pinned: false }]
  })
  const [activeTabId, setActiveTabId] = useState<string>('tab-initial')

  useEffect(() => {
    localStorage.setItem('seven_note_workbench_tabs', JSON.stringify(tabs))
  }, [tabs])

  const selectWorkspaceWithTab = (wsId: string) => {
    setCurrentWorkspaceId(wsId)
    setTabs((prev) => {
      const existing = prev.find((t) => t.workspaceId === wsId && (!t.viewType || t.viewType === 'doc'))
      if (existing) {
        setActiveTabId(existing.id)
        return prev
      }
      const newTab: WorkbenchTab = {
        id: `tab-${crypto.randomUUID()}`,
        workspaceId: wsId,
        viewType: 'doc',
        pinned: false
      }
      setActiveTabId(newTab.id)
      return [...prev, newTab]
    })
  }

  const openSpecialViewTab = (
    viewType: 'all-docs' | 'knowledge-graph' | 'trash' | 'templates' | 'collections' | 'tags',
    title: string
  ) => {
    setTabs((prev) => {
      const existing = prev.find((t) => t.viewType === viewType)
      if (existing) {
        setActiveTabId(existing.id)
        return prev
      }
      const newTab: WorkbenchTab = {
        id: `tab-${viewType}`,
        workspaceId: currentWorkspaceId || '',
        viewType,
        title,
        pinned: false
      }
      setActiveTabId(newTab.id)
      return [...prev, newTab]
    })
  }

  const handleSelectTab = (tabId: string) => {
    const tab = tabs.find((t) => t.id === tabId)
    if (tab) {
      setActiveTabId(tabId)
      setCurrentWorkspaceId(tab.workspaceId)
    }
  }

  const handleCloseTab = (tabId: string) => {
    const tabIndex = tabs.findIndex((t) => t.id === tabId)
    if (tabIndex === -1) return

    const remaining = tabs.filter((t) => t.id !== tabId)
    if (remaining.length === 0) {
      const newId = crypto.randomUUID()
      const now = Date.now()
      db.workspaces.add({
        id: newId,
        parentId: null,
        spaceId: currentSpaceId,
        title: 'Untitled',
        icon: '',
        color: '#1e96eb',
        viewMode: 'doc',
        docContent: '<p></p>',
        createdAt: now,
        updatedAt: now,
        isFavorite: false,
        isDeleted: false,
        syncStatus: 'pending'
      })
      const fallbackTab: WorkbenchTab = {
        id: `tab-${crypto.randomUUID()}`,
        workspaceId: newId,
        pinned: false
      }
      setTabs([fallbackTab])
      setActiveTabId(fallbackTab.id)
      setCurrentWorkspaceId(newId)
    } else {
      setTabs(remaining)
      if (activeTabId === tabId) {
        const nextActive = remaining[Math.min(tabIndex, remaining.length - 1)]
        setActiveTabId(nextActive.id)
        setCurrentWorkspaceId(nextActive.workspaceId)
      }
    }
  }

  const handleCloseOtherTabs = (tabId: string) => {
    const keep = tabs.filter((t) => t.id === tabId || t.pinned)
    setTabs(keep)
    setActiveTabId(tabId)
    const activeWs = tabs.find((t) => t.id === tabId)
    if (activeWs) setCurrentWorkspaceId(activeWs.workspaceId)
  }

  const handleNewTab = async () => {
    const newId = crypto.randomUUID()
    const now = Date.now()
    await db.workspaces.add({
      id: newId,
      parentId: null,
      spaceId: currentSpaceId,
      title: 'Untitled',
      icon: '',
      color: '#1e96eb',
      viewMode: 'doc',
      docContent: '<p></p>',
      createdAt: now,
      updatedAt: now,
      isFavorite: false,
      isDeleted: false,
      syncStatus: 'pending'
    })
    const newTab: WorkbenchTab = {
      id: `tab-${crypto.randomUUID()}`,
      workspaceId: newId,
      pinned: false
    }
    setTabs((prev) => [...prev, newTab])
    setActiveTabId(newTab.id)
    setCurrentWorkspaceId(newId)
  }

  const handleTogglePinTab = (tabId: string) => {
    setTabs((prev) =>
      prev.map((t) => (t.id === tabId ? { ...t, pinned: !t.pinned } : t))
    )
  }

  const handleDuplicateTab = async (tabId: string) => {
    const sourceTab = tabs.find((t) => t.id === tabId)
    if (!sourceTab) return
    const sourceWs = await db.workspaces.get(sourceTab.workspaceId)
    if (!sourceWs) return

    const newId = crypto.randomUUID()
    const now = Date.now()
    await db.workspaces.add({
      ...sourceWs,
      id: newId,
      title: `${sourceWs.title} (Copia)`,
      createdAt: now,
      updatedAt: now,
      syncStatus: 'pending'
    })

    const newTab: WorkbenchTab = {
      id: `tab-${crypto.randomUUID()}`,
      workspaceId: newId,
      pinned: false
    }
    setTabs((prev) => [...prev, newTab])
    setActiveTabId(newTab.id)
    setCurrentWorkspaceId(newId)
    toast.success('Pestaña duplicada')
  }

  const [copiedLink, setCopiedLink] = useState(false)
  const [isEditingHeaderTitle, setIsEditingHeaderTitle] = useState(false)

  // Close menus on outside click
  useEffect(() => {
    const handleCloseMenus = () => setActiveDropdown(null)
    window.addEventListener('click', handleCloseMenus)
    return () => window.removeEventListener('click', handleCloseMenus)
  }, [])

  // Sync engine status
  const [syncStatus, setSyncStatus] = useState<SyncEngineStatus>(syncEngine.getStatus())

  // Reactive DB queries
  const workspaces = useLiveQuery(() => db.workspaces.toArray()) ?? []

  // Initialize DB and subscribe to sync
  useEffect(() => {
    seedInitialData()
    const unsubscribe = syncEngine.subscribe((status) => {
      setSyncStatus(status)
    })

    // Listen for custom sub-board navigation events
    const handleNavigate = (e: any) => {
      if (e.detail?.workspaceId) {
        selectWorkspaceWithTab(e.detail.workspaceId)
      }
    }

    // Listen for custom mode switch events
    const handleSwitchMode = (e: any) => {
      const targetMode = e.detail?.mode
      const targetWsId = e.detail?.workspaceId || currentWorkspaceId
      if (targetMode && targetWsId) {
        db.workspaces.update(targetWsId, {
          viewMode: targetMode,
          documentMode: targetMode === 'canvas' ? 'Sin bordes' : targetMode === 'doc' ? 'Estándar' : 'Dividido',
          updatedAt: Date.now(),
          syncStatus: 'pending'
        })
      }
      if (e.detail?.workspaceId) {
        selectWorkspaceWithTab(e.detail.workspaceId)
      }
    }

    // Listen for presentation start events from canvas frames
    const handleStartPresentation = (e: any) => {
      if (e.detail?.frameId) {
        setPresentationFrameId(e.detail.frameId)
      }
      setIsPresentationMode(true)
    }

    // Global keyboard shortcuts (Escape, ?, Ctrl+/, Ctrl+\, Ctrl+F)
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && focusMode) {
        setFocusMode(false)
        return
      }

      if (e.key === 'Escape' && isPresentationMode) {
        setIsPresentationMode(false)
        setPresentationFrameId(undefined)
        return
      }

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'f') {
        e.preventDefault()
        setIsFindInPageOpen((prev) => !prev)
        return
      }

      const target = e.target as HTMLElement
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) {
        return
      }

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setIsSearchOpen((prev) => !prev)
        return
      }

      if (e.key === '?' || ((e.ctrlKey || e.metaKey) && e.key === '/')) {
        e.preventDefault()
        setIsShortcutsOpen((prev) => !prev)
      } else if ((e.ctrlKey || e.metaKey) && e.key === '\\') {
        e.preventDefault()
        setSidebarOpen((prev) => !prev)
      } else if ((e.ctrlKey || e.metaKey) && (e.key === '=' || e.key === '+')) {
        e.preventDefault()
        handleStepUiScale(1)
      } else if ((e.ctrlKey || e.metaKey) && e.key === '-') {
        e.preventDefault()
        handleStepUiScale(-1)
      } else if ((e.ctrlKey || e.metaKey) && e.key === '0') {
        e.preventDefault()
        setUiScale('100')
        toast.info('Escala de interfaz: 100% (predeterminada)')
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
  }, [isPresentationMode, currentWorkspaceId, focusMode])

  // Handle dark mode class on document
  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark')
      document.documentElement.setAttribute('data-theme', 'dark')
      localStorage.setItem('seven_note_theme', 'dark')
    } else {
      document.documentElement.classList.remove('dark')
      document.documentElement.setAttribute('data-theme', 'light')
      localStorage.setItem('seven_note_theme', 'light')
    }
  }, [darkMode])

  // Keep currentSpaceId in sync with spaces
  useEffect(() => {
    if (spaces.length > 0 && !spaces.some((s) => s.id === currentSpaceId)) {
      const fallbackId = spaces[0].id
      setCurrentSpaceId(fallbackId)
      localStorage.setItem('seven_note_active_space_id', fallbackId)
    }
  }, [spaces, currentSpaceId])

  // Select active workspace items belonging to current space
  const currentSpaceWorkspaces = workspaces.filter(
    (w) => (w.spaceId || DEFAULT_SPACE_ID) === currentSpaceId
  )
  const activeWorkspaces = currentSpaceWorkspaces.filter((w) => !w.isDeleted)
  const currentWorkspace: WorkspaceItem | undefined =
    activeWorkspaces.find((w) => w.id === currentWorkspaceId) || activeWorkspaces[0]

  // Space switcher actions
  const handleSelectSpace = async (spaceId: string) => {
    setCurrentSpaceId(spaceId)
    localStorage.setItem('seven_note_active_space_id', spaceId)

    const targetSpacePages = workspaces.filter(
      (w) => !w.isDeleted && (w.spaceId || DEFAULT_SPACE_ID) === spaceId
    )
    if (targetSpacePages.length > 0) {
      setCurrentWorkspaceId(targetSpacePages[0].id)
    } else {
      // Auto-create initial page if space has no pages
      const sp = spaces.find((s) => s.id === spaceId)
      const newPageId = crypto.randomUUID()
      const now = Date.now()
      await db.workspaces.add({
        id: newPageId,
        parentId: null,
        spaceId: spaceId,
        title: 'Página inicial',
        icon: sp?.icon || '📄',
        color: sp?.color || '#1e96eb',
        viewMode: 'doc',
        docContent: `<h1>✨ ${sp?.name || 'Nuevo Espacio'}</h1><p>¡Bienvenido a tu espacio de trabajo! Comienza a escribir o planificar aquí.</p>`,
        createdAt: now,
        updatedAt: now,
        isFavorite: false,
        isDeleted: false,
        syncStatus: 'pending'
      })
      setCurrentWorkspaceId(newPageId)
    }
  }

  const handleCreateSpace = async (name: string, icon: string, color: string) => {
    const { space, initialPageId } = await createSpace(name, icon, color)
    setCurrentSpaceId(space.id)
    localStorage.setItem('seven_note_active_space_id', space.id)
    setCurrentWorkspaceId(initialPageId)
  }

  const handleRenameSpace = async (id: string, newName: string) => {
    await updateSpace(id, { name: newName })
  }

  const handleDeleteSpace = async (id: string) => {
    const sp = spaces.find((s) => s.id === id)
    if (!confirm(`¿Eliminar el espacio "${sp?.name || 'Espacio'}" y todos sus documentos asociados?`)) {
      return
    }
    await deleteSpace(id)
    const remaining = spaces.filter((s) => s.id !== id)
    if (remaining.length > 0) {
      await handleSelectSpace(remaining[0].id)
    }
  }

  // Update view mode
  const setViewMode = useCallback(async (mode: ViewMode) => {
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
  }, [currentWorkspace])

  const handleSwitchToDoc = useCallback(() => {
    setViewMode('doc')
  }, [setViewMode])

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

    // Check if journal for today exists in current space
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
      spaceId: currentSpaceId,
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

      // 2. Clean up initial placeholder docframe if it is the only card
      const existingWorkspaceNodes = await db.canvasNodes.where('workspaceId').equals(currentWorkspace.id).toArray()
      const isPlaceholderOnly = existingWorkspaceNodes.length === 1 && existingWorkspaceNodes[0].id === `docframe-${currentWorkspace.id}`
      if (isPlaceholderOnly) {
        await db.canvasNodes.delete(`docframe-${currentWorkspace.id}`)
      }

      // 3. Insert canvas nodes
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

  // Handle Calendar Date Jump or Creation for Daily Journal
  const handleSelectJournalDate = async (date: Date) => {
    const dateStr = date.toLocaleDateString('es-ES', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    })
    const journalTitle = `Diario: ${dateStr}`

    const existing = workspaces.find(
      (w) =>
        !w.isDeleted &&
        (w.spaceId || DEFAULT_SPACE_ID) === currentSpaceId &&
        (w.title === journalTitle || w.journalDate === dateStr)
    )

    if (existing) {
      selectWorkspaceWithTab(existing.id)
      return
    }

    const newId = crypto.randomUUID()
    const now = Date.now()
    const journalDoc = `
      <h1>📅 Diario: ${dateStr}</h1>
      <p><em>"Cada día es una nueva oportunidad para avanzar y aprender."</em></p>
      
      <h3>🎯 Enfoque Principal</h3>
      <ul data-type="taskList">
        <li data-checked="false"><label><input type="checkbox"><span></span></label><div>Meta prioritaria del día: </div></li>
        <li data-checked="false"><label><input type="checkbox"><span></span></label><div>Reuniones o notas clave: </div></li>
      </ul>

      <h3>💡 Notas & Reflexiones</h3>
      <p>Anota ideas, descubrimientos o reflexiones del día...</p>
    `

    await db.workspaces.add({
      id: newId,
      parentId: null,
      spaceId: currentSpaceId,
      folder: 'First Folder',
      title: journalTitle,
      icon: '📅',
      color: '#0ea5e9',
      viewMode: 'doc',
      docContent: journalDoc,
      createdAt: now,
      updatedAt: now,
      isFavorite: false,
      isDeleted: false,
      syncStatus: 'pending',
      isJournal: true,
      journalDate: dateStr,
      activeProperties: ['tags', 'isJournal', 'createdAt', 'updatedAt']
    })

    selectWorkspaceWithTab(newId)
    toast.success(`Diario para ${dateStr} abierto`)
  }

  const stats = getStats()
  const activeTab = tabs.find((t) => t.id === activeTabId)
  const activeViewMode: ViewMode = currentWorkspace?.viewMode || 'canvas'

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-[var(--app-bg-primary)] text-[var(--app-text-primary)] font-sans">
      {/* 1. Left Sidebar Navigation */}
      {sidebarOpen && !isPresentationMode && !focusMode && (
        <Sidebar
          spaces={spaces}
          currentSpaceId={currentSpaceId}
          onSelectSpace={handleSelectSpace}
          onOpenCreateSpace={() => setIsCreateWorkspaceOpen(true)}
          onRenameSpace={handleRenameSpace}
          onDeleteSpace={handleDeleteSpace}
          workspaces={workspaces}
          currentWorkspaceId={currentWorkspace?.id || ''}
          onSelectWorkspace={selectWorkspaceWithTab}
          onToggleSidebar={() => setSidebarOpen(false)}
          onOpenSettings={() => setIsSettingsOpen(true)}
          onOpenSearch={() => setIsSearchOpen(true)}
          onOpenAllDocs={() => openSpecialViewTab('all-docs', 'Todos los documentos')}
          onOpenDailyJournal={handleOpenDailyJournal}
          onSelectJournalDate={handleSelectJournalDate}
          onOpenTrash={() => openSpecialViewTab('trash', 'Papelera')}
          onOpenImport={() => setIsImportOpen(true)}
          onOpenTemplates={() => openSpecialViewTab('templates', 'Plantillas')}
          onOpenShortcuts={() => setIsShortcutsOpen(true)}
          onOpenTags={(tag) => {
            setSelectedTagForModal(tag || null)
            openSpecialViewTab('tags', 'Etiquetas')
          }}
          onOpenCollections={() => openSpecialViewTab('collections', 'Colecciones')}
          onOpenKnowledgeGraph={() => openSpecialViewTab('knowledge-graph', 'Grafo de Conocimiento')}
          syncStatus={syncStatus}
          darkMode={darkMode}
          onToggleDarkMode={() => setDarkMode(!darkMode)}
        />
      )}

      {/* 2. Main Content Center Column */}
      <div className="flex-1 flex flex-col h-full min-w-0 overflow-hidden bg-[var(--affine-background-primary-color)]">
        {/* Top Workbench Tabs Header */}
        {!isPresentationMode && !focusMode && (
          <WorkbenchTabs
            tabs={tabs}
            activeTabId={activeTabId}
            workspaces={activeWorkspaces}
            onSelectTab={handleSelectTab}
            onCloseTab={handleCloseTab}
            onCloseOtherTabs={handleCloseOtherTabs}
            onNewTab={handleNewTab}
            onTogglePinTab={handleTogglePinTab}
            onDuplicateTab={handleDuplicateTab}
          />
        )}
        {/* Top Header Bar (Notion & Milanote Clean Human-Crafted Aesthetic) */}
        {!isPresentationMode && !focusMode && (!activeTab || !activeTab.viewType || activeTab.viewType === 'doc') && (
          <header className="relative h-11 border-b border-[var(--app-border)] bg-[var(--app-bg-primary)] px-3 flex items-center justify-between shrink-0 z-[60] select-none text-sm transition-colors duration-150">
            {/* Left section: Sidebar toggle, Mode Switcher [ Page | Edgeless ], Title, Favorite, Info, More */}
            <div className="flex items-center gap-2 min-w-0">
              {/* Sidebar Toggle */}
              <button
                onClick={() => setSidebarOpen(!sidebarOpen)}
                className="p-1.5 rounded-md text-[var(--app-text-secondary)] hover:text-[var(--app-text-primary)] hover:bg-[var(--app-hover)] transition"
                title={sidebarOpen ? 'Ocultar barra lateral (Ctrl+\\)' : 'Mostrar barra lateral (Ctrl+\\)'}
              >
                <SidebarIcon className="w-4.5 h-4.5" />
              </button>

              {/* Notion Segmented Mode Switcher */}
              <div className="inline-flex items-center bg-[var(--app-hover)] p-0.5 rounded-md border border-[var(--app-border)]">
                <button
                  onClick={() => setViewMode('doc')}
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-[5px] text-xs transition ${
                    activeViewMode === 'doc'
                      ? 'bg-[var(--app-bg-primary)] text-[var(--app-text-primary)] shadow-xs font-semibold'
                      : 'text-[var(--app-text-secondary)] hover:text-[var(--app-text-primary)]'
                  }`}
                  title="Modo Página / Documento (Alt+S)"
                >
                  <PageIcon className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline font-medium">Página</span>
                </button>
                <button
                  onClick={() => setViewMode('canvas')}
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-[5px] text-xs transition ${
                    activeViewMode === 'canvas'
                      ? 'bg-[var(--app-bg-primary)] text-[var(--app-text-primary)] shadow-xs font-semibold'
                      : 'text-[var(--app-text-secondary)] hover:text-[var(--app-text-primary)]'
                  }`}
                  title="Modo Tablero de Tarjetas (Milanote)"
                >
                  <EdgelessIcon className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline font-medium">Tablero</span>
                </button>
              </div>

              {/* Document Icon & Title synced (Inline editable like Notion) */}
              <div className="flex items-center gap-1.5 min-w-0 max-w-[180px] sm:max-w-[300px]">
                {currentWorkspace?.icon ? (
                  <span className="text-sm shrink-0">{currentWorkspace.icon}</span>
                ) : (
                  <span className="text-[var(--app-text-secondary)] shrink-0">
                    {activeViewMode === 'canvas' ? (
                      <EdgelessIcon className="w-4 h-4" />
                    ) : (
                      <PageIcon className="w-4 h-4" />
                    )}
                  </span>
                )}
                {isEditingHeaderTitle ? (
                  <input
                    type="text"
                    value={currentWorkspace?.title === 'Untitled' ? '' : (currentWorkspace?.title || '')}
                    onChange={(e) => handleTitleChange(e.target.value || 'Untitled')}
                    onBlur={() => setIsEditingHeaderTitle(false)}
                    onKeyDown={(e) => e.key === 'Enter' && setIsEditingHeaderTitle(false)}
                    autoFocus
                    placeholder="Untitled"
                    className="font-medium text-xs text-[var(--app-text-primary)] bg-[var(--app-bg-primary)] px-1.5 py-0.5 rounded border border-[var(--app-accent)] outline-none w-full"
                  />
                ) : (
                  <span
                    onClick={() => setIsEditingHeaderTitle(true)}
                    className="font-medium text-xs text-[var(--app-text-primary)] truncate cursor-pointer hover:bg-[var(--app-hover)] px-1.5 py-0.5 rounded transition"
                    title="Haz clic para renombrar documento"
                  >
                    {currentWorkspace?.title || 'Untitled'}
                  </span>
                )}
              </div>

              {/* Star Favorite Button */}
              <button
                onClick={handleToggleFavorite}
                className="p-1.5 rounded-md hover:bg-[var(--app-hover)] text-[var(--app-text-secondary)] hover:text-[var(--app-text-primary)] transition"
                title={currentWorkspace?.isFavorite ? 'Quitar de favoritos' : 'Añadir a favoritos'}
              >
                {currentWorkspace?.isFavorite ? (
                  <FavoritedIcon className="w-4.5 h-4.5 text-amber-500" />
                ) : (
                  <FavoriteIcon className="w-4.5 h-4.5" />
                )}
              </button>

              {/* Info Button ⓘ */}
              <div className="relative">
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    setActiveDropdown(activeDropdown === 'info' ? null : 'info')
                  }}
                  className="p-1.5 rounded-md hover:bg-[var(--app-hover)] text-[var(--app-text-secondary)] hover:text-[var(--app-text-primary)] transition"
                  title="Información del documento"
                >
                  <InfoIcon className="w-4.5 h-4.5" />
                </button>

                {activeDropdown === 'info' && (
                  <div
                    className="absolute left-0 top-9 z-50 w-72 bg-[var(--app-bg-overlay)] border border-[var(--app-border)] rounded-lg shadow-[var(--app-shadow-popover)] p-3 text-xs text-[var(--app-text-primary)] animate-in fade-in zoom-in-95 duration-100"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="font-semibold pb-2 border-b border-[var(--app-divider)] mb-2 flex items-center justify-between">
                      <span className="text-xs font-semibold">Estadísticas de la página</span>
                      <span className="text-[10px] text-[var(--app-text-muted)] uppercase font-mono">Info</span>
                    </div>
                    <div className="space-y-1.5 text-xs">
                      <div className="flex justify-between">
                        <span className="text-[var(--app-text-secondary)]">Palabras:</span>
                        <span className="font-mono font-medium">{stats.words}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-[var(--app-text-secondary)]">Caracteres:</span>
                        <span className="font-mono font-medium">{stats.chars}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-[var(--app-text-secondary)]">Tiempo de lectura:</span>
                        <span className="font-mono font-medium">~{stats.time} min</span>
                      </div>
                      <div className="flex justify-between pt-1 border-t border-[var(--app-divider)]">
                        <span className="text-[var(--app-text-secondary)]">Modo:</span>
                        <span className="capitalize font-semibold text-[var(--app-accent)]">{currentWorkspace?.viewMode}</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* More options menu `...` */}
              <div className="relative">
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    setActiveDropdown(activeDropdown === 'more' ? null : 'more')
                  }}
                  className="p-1.5 rounded-md hover:bg-[var(--app-hover)] text-[var(--app-text-secondary)] hover:text-[var(--app-text-primary)] transition"
                  title="Más acciones"
                >
                  <MoreHorizontalIcon className="w-4.5 h-4.5" />
                </button>

                {activeDropdown === 'more' && (
                  <div
                    className="absolute left-0 top-10 z-50 w-60 bg-[var(--affine-background-overlay-panel-color)] border border-[var(--affine-border-color)] rounded-xl shadow-[var(--affine-menu-shadow)] py-1.5 text-xs text-[var(--affine-text-primary-color)] animate-in fade-in zoom-in-95 duration-100"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <button
                      onClick={() => {
                        setViewMode('doc')
                        setActiveDropdown(null)
                      }}
                      className="w-full text-left px-3.5 py-2 hover:bg-[var(--affine-hover-color)] flex items-center gap-2.5 text-sm"
                    >
                      <PageIcon className="w-4.5 h-4.5 text-[var(--affine-primary-color)]" />
                      <span>Modo Página</span>
                    </button>

                    <button
                      onClick={() => {
                        setViewMode('canvas')
                        setActiveDropdown(null)
                      }}
                      className="w-full text-left px-3.5 py-2 hover:bg-[var(--affine-hover-color)] flex items-center gap-2.5 text-sm"
                    >
                      <EdgelessIcon className="w-4.5 h-4.5 text-[var(--affine-primary-color)]" />
                      <span>Modo Tablero (Milanote)</span>
                    </button>

                    <button
                      onClick={() => {
                        setViewMode(activeViewMode === 'split' ? 'doc' : 'split')
                        setActiveDropdown(null)
                      }}
                      className="w-full text-left px-3.5 py-2 hover:bg-[var(--affine-hover-color)] flex items-center gap-2.5 text-sm"
                    >
                      <SplitViewIcon className="w-4.5 h-4.5" />
                      <span>{activeViewMode === 'split' ? 'Cerrar vista dividida' : 'Vista dividida'}</span>
                    </button>

                    <button
                      onClick={() => {
                        openSpecialViewTab('knowledge-graph', 'Grafo de Conocimiento')
                        setActiveDropdown(null)
                      }}
                      className="w-full text-left px-3.5 py-2 hover:bg-[var(--affine-hover-color)] flex items-center justify-between text-sm"
                    >
                      <div className="flex items-center gap-2.5">
                        <span className="text-indigo-400">🌐</span>
                        <span>Grafo Global de Conocimiento</span>
                      </div>
                      <span className="text-[10px] text-indigo-400 font-mono">Obsidian</span>
                    </button>

                    <button
                      onClick={() => {
                        setIsFindInPageOpen(true)
                        setActiveDropdown(null)
                      }}
                      className="w-full text-left px-3.5 py-2 hover:bg-[var(--affine-hover-color)] flex items-center justify-between text-sm"
                    >
                      <div className="flex items-center gap-2.5">
                        <SearchIcon className="w-4.5 h-4.5 text-[var(--affine-primary-color)]" />
                        <span>Buscar en página</span>
                      </div>
                      <kbd className="text-[10px] bg-[var(--affine-background-tertiary-color)] px-1.5 py-0.5 rounded text-[var(--affine-text-secondary-color)] border border-[var(--affine-border-color)]">
                        Ctrl F
                      </kbd>
                    </button>

                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(window.location.href)
                        setCopiedLink(true)
                        toast.success('Enlace copiado al portapapeles')
                        setTimeout(() => setCopiedLink(false), 2000)
                        setActiveDropdown(null)
                      }}
                      className="w-full text-left px-3.5 py-2 hover:bg-[var(--affine-hover-color)] flex items-center gap-2.5 text-sm"
                    >
                      <CopyIcon className="w-4.5 h-4.5" />
                      <span>{copiedLink ? '¡Enlace copiado!' : 'Copiar enlace a nota'}</span>
                    </button>

                    <div className="border-t border-[var(--affine-divider-color)] my-1" />

                    {/* Export suite */}
                    <div className="px-3.5 py-1 text-[11px] font-semibold text-[var(--affine-text-secondary-color)] uppercase">
                      Exportar
                    </div>

                    <button
                      onClick={() => {
                        if (currentWorkspace) exportDocumentAsMarkdown(currentWorkspace)
                        setActiveDropdown(null)
                      }}
                      className="w-full text-left px-3.5 py-2 hover:bg-[var(--affine-hover-color)] flex items-center gap-2.5 text-sm"
                    >
                      <DownloadIcon className="w-4.5 h-4.5" />
                      <span>Exportar como Markdown (.md)</span>
                    </button>

                    <button
                      onClick={() => {
                        if (currentWorkspace) exportDocumentAsHtml(currentWorkspace)
                        setActiveDropdown(null)
                      }}
                      className="w-full text-left px-3.5 py-2 hover:bg-[var(--affine-hover-color)] flex items-center gap-2.5 text-sm"
                    >
                      <DownloadIcon className="w-4.5 h-4.5" />
                      <span>Exportar como HTML (.html)</span>
                    </button>

                    <button
                      onClick={async () => {
                        if (currentWorkspace) {
                          const nodes = await db.canvasNodes.where('workspaceId').equals(currentWorkspace.id).and((n) => !n.isDeleted).toArray()
                          exportDocumentAsJson(currentWorkspace, nodes)
                        }
                        setActiveDropdown(null)
                      }}
                      className="w-full text-left px-3.5 py-2 hover:bg-[var(--affine-hover-color)] flex items-center gap-2.5 text-sm"
                    >
                      <DownloadIcon className="w-4.5 h-4.5" />
                      <span>Exportar copia JSON (.json)</span>
                    </button>

                    <button
                      onClick={() => {
                        if (currentWorkspace) copyAsPlainText(currentWorkspace.docContent)
                        setActiveDropdown(null)
                      }}
                      className="w-full text-left px-3.5 py-2 hover:bg-[var(--affine-hover-color)] flex items-center gap-2.5 text-sm"
                    >
                      <CopyIcon className="w-4.5 h-4.5" />
                      <span>Copiar como texto plano</span>
                    </button>

                    <div className="border-t border-[var(--affine-divider-color)] my-1" />

                    {/* Quick Scale controls in More Menu */}
                    <div className="px-3.5 py-1.5 text-[11px] font-semibold text-[var(--affine-text-secondary-color)] uppercase">
                      Escala de interfaz: {uiScale}%
                    </div>
                    <div className="flex items-center gap-1 px-3 pb-1">
                      <button
                        onClick={() => handleStepUiScale(-1)}
                        className="flex-1 py-1 px-2 rounded-lg bg-[var(--affine-hover-color)] hover:bg-[var(--affine-hover-color-filled)] text-xs font-semibold text-center transition"
                      >
                        - Reducir
                      </button>
                      <button
                        onClick={() => {
                          setUiScale('100')
                          toast.info('Escala restablecida al 100%')
                        }}
                        className="py-1 px-2 rounded-lg bg-[var(--affine-hover-color)] hover:bg-[var(--affine-hover-color-filled)] text-xs font-mono font-semibold transition"
                      >
                        100%
                      </button>
                      <button
                        onClick={() => handleStepUiScale(1)}
                        className="flex-1 py-1 px-2 rounded-lg bg-[var(--affine-hover-color)] hover:bg-[var(--affine-hover-color-filled)] text-xs font-semibold text-center transition"
                      >
                        + Aumentar
                      </button>
                    </div>

                    <div className="border-t border-[var(--affine-divider-color)] my-1" />

                    <button
                      onClick={() => {
                        setIsShortcutsOpen(true)
                        setActiveDropdown(null)
                      }}
                      className="w-full text-left px-3.5 py-2 hover:bg-[var(--affine-hover-color)] flex items-center justify-between text-sm"
                    >
                      <div className="flex items-center gap-2.5">
                        <KeyboardIcon className="w-4.5 h-4.5 text-[var(--affine-primary-color)]" />
                        <span>Atajos de teclado</span>
                      </div>
                      <kbd className="text-[10px] bg-[var(--affine-background-tertiary-color)] px-1.5 py-0.5 rounded text-[var(--affine-text-secondary-color)] border border-[var(--affine-border-color)]">?</kbd>
                    </button>

                    <div className="border-t border-[var(--affine-divider-color)] my-1" />

                    <button
                      onClick={() => {
                        if (currentWorkspace) {
                          db.workspaces.update(currentWorkspace.id, {
                            isDeleted: true,
                            updatedAt: Date.now()
                          })
                        }
                        setActiveDropdown(null)
                      }}
                      className="w-full text-left px-3.5 py-2 hover:bg-rose-500/10 text-rose-500 flex items-center gap-2.5 text-sm"
                    >
                      <DeleteIcon className="w-4.5 h-4.5" />
                      <span>Eliminar página</span>
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Center: Milanote Iconic Centered Editorial Serif Title */}
            <div className="absolute left-1/2 -translate-x-1/2 flex items-center justify-center pointer-events-auto z-10">
              {isEditingHeaderTitle ? (
                <input
                  type="text"
                  value={currentWorkspace?.title === 'Untitled' ? '' : (currentWorkspace?.title || '')}
                  onChange={(e) => handleTitleChange(e.target.value || 'Untitled')}
                  onBlur={() => setIsEditingHeaderTitle(false)}
                  onKeyDown={(e) => e.key === 'Enter' && setIsEditingHeaderTitle(false)}
                  autoFocus
                  placeholder="Título del tablero..."
                  className="font-serif font-bold text-base md:text-lg text-center text-[var(--app-text-primary)] bg-[var(--app-bg-primary)] px-2 py-0.5 rounded border border-[var(--app-accent)] outline-none min-w-[200px]"
                />
              ) : (
                <h1
                  onClick={() => setIsEditingHeaderTitle(true)}
                  className="font-serif font-bold text-base md:text-lg text-[var(--app-text-primary)] hover:opacity-75 transition cursor-pointer select-none tracking-tight text-center truncate max-w-[220px] md:max-w-[400px]"
                  title="Haz clic para renombrar tablero"
                >
                  {currentWorkspace?.title || 'Tablero de inspiración'}
                </h1>
              )}
            </div>

            {/* Right section: Presentation Icon, Exportar, Collabs + Compartir, and Sin clasificar */}
            <div className="flex items-center gap-1">
              {/* Focus mode (board only) */}
              {activeViewMode === 'canvas' && (
                <button
                  onClick={() => setFocusMode(true)}
                  className="h-7 px-2.5 rounded-md hover:bg-[var(--app-hover)] text-xs font-medium text-[var(--app-text-secondary)] hover:text-[var(--app-text-primary)] transition select-none"
                  title="Ocultar herramientas y menús (solo tablero)"
                >
                  Solo tablero
                </button>
              )}

              {/* Presentation Icon */}
              <button
                onClick={() => setIsPresentationMode(true)}
                className="p-1.5 rounded-md text-[var(--app-text-secondary)] hover:text-[var(--app-text-primary)] hover:bg-[var(--app-hover)] transition"
                title="Modo Presentación pantalla completa (F5)"
              >
                <PresentationIcon className="w-4.5 h-4.5" />
              </button>

              {/* Milanote Exportar ⌵ Dropdown */}
              <div className="relative">
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    setActiveDropdown(activeDropdown === 'export' ? null : 'export')
                  }}
                  className="h-7 px-2.5 rounded-md hover:bg-[var(--app-hover)] text-xs font-medium text-[var(--app-text-secondary)] hover:text-[var(--app-text-primary)] flex items-center gap-1 transition select-none"
                  title="Exportar tablero"
                >
                  <span>Exportar</span>
                  <span className="text-[10px] opacity-60">⌵</span>
                </button>

                {activeDropdown === 'export' && (
                  <div
                    className="absolute right-0 top-8 z-50 w-52 bg-white dark:bg-[#252525] border border-neutral-200 dark:border-neutral-700 rounded-xl shadow-xl py-1 text-xs text-neutral-800 dark:text-neutral-200 animate-in fade-in zoom-in-95"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <button
                      onClick={() => {
                        if (currentWorkspace) exportDocumentAsMarkdown(currentWorkspace)
                        setActiveDropdown(null)
                      }}
                      className="w-full text-left px-3 py-1.5 hover:bg-neutral-100 dark:hover:bg-neutral-800 flex items-center gap-2"
                    >
                      <DownloadIcon className="w-4 h-4 text-blue-500" />
                      <span>Exportar como Markdown (.md)</span>
                    </button>
                    <button
                      onClick={() => {
                        if (currentWorkspace) exportDocumentAsHtml(currentWorkspace)
                        setActiveDropdown(null)
                      }}
                      className="w-full text-left px-3 py-1.5 hover:bg-neutral-100 dark:hover:bg-neutral-800 flex items-center gap-2"
                    >
                      <DownloadIcon className="w-4 h-4 text-emerald-500" />
                      <span>Exportar como HTML (.html)</span>
                    </button>
                    <button
                      onClick={async () => {
                        if (currentWorkspace) {
                          const nodes = await db.canvasNodes.where('workspaceId').equals(currentWorkspace.id).and((n) => !n.isDeleted).toArray()
                          exportDocumentAsJson(currentWorkspace, nodes)
                        }
                        setActiveDropdown(null)
                      }}
                      className="w-full text-left px-3 py-1.5 hover:bg-neutral-100 dark:hover:bg-neutral-800 flex items-center gap-2"
                    >
                      <DownloadIcon className="w-4 h-4 text-purple-500" />
                      <span>Exportar copia JSON (.json)</span>
                    </button>
                  </div>
                )}
              </div>

              {/* Milanote Collaborators & Compartir Button */}
              <button
                onClick={() => setIsShareOpen(true)}
                className="h-7 px-2.5 rounded-md hover:bg-[var(--app-hover)] text-xs font-medium text-[var(--app-text-secondary)] hover:text-[var(--app-text-primary)] flex items-center gap-1.5 transition select-none"
                title="Compartir tablero con colaboradores"
              >
                <div className="flex items-center -space-x-1">
                  <div className="w-5 h-5 rounded-full bg-amber-500 text-white font-bold text-[9px] flex items-center justify-center border border-white dark:border-neutral-900 shadow-xs" title="Natali">
                    N
                  </div>
                  <div className="w-5 h-5 rounded-full bg-blue-600 text-white font-bold text-[9px] flex items-center justify-center border border-white dark:border-neutral-900 shadow-xs" title="Kevin">
                    K
                  </div>
                </div>
                <span>Compartir</span>
                <ShareIcon className="w-3 h-3 text-neutral-400" />
              </button>
            </div>
          </header>
        )}

        {/* Main Document / Canvas / Full Page Views */}
        <main className="flex-1 relative flex overflow-hidden">
          {/* Find In Page Floating Search (Ctrl+F) */}
          <FindInPage
            isOpen={isFindInPageOpen}
            onClose={() => setIsFindInPageOpen(false)}
          />

          {activeTab?.viewType === 'all-docs' ? (
            <AllDocsPage
              workspaces={currentSpaceWorkspaces}
              currentWorkspaceId={currentWorkspace?.id}
              currentSpaceId={currentSpaceId}
              onSelectWorkspace={(id) => selectWorkspaceWithTab(id)}
              onCreateWorkspace={() => {
                const newId = crypto.randomUUID()
                const now = Date.now()
                db.workspaces.add({
                  id: newId,
                  parentId: null,
                  spaceId: currentSpaceId,
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
                selectWorkspaceWithTab(newId)
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
          ) : activeTab?.viewType === 'knowledge-graph' ? (
            <KnowledgeGraphPage
              workspaces={currentSpaceWorkspaces}
              currentWorkspaceId={currentWorkspace?.id}
              onSelectWorkspace={(id) => selectWorkspaceWithTab(id)}
            />
          ) : activeTab?.viewType === 'trash' ? (
            <TrashPage
              onSelectWorkspace={(id) => selectWorkspaceWithTab(id)}
            />
          ) : activeTab?.viewType === 'templates' ? (
            <TemplatesPage
              onSelectTemplate={(template) => {
                handleApplyTemplate(template)
                selectWorkspaceWithTab(currentWorkspace?.id || '')
              }}
            />
          ) : activeTab?.viewType === 'collections' ? (
            <CollectionsPage
              spaceId={currentSpaceId}
              workspaces={currentSpaceWorkspaces}
              onSelectWorkspace={(id) => selectWorkspaceWithTab(id)}
            />
          ) : activeTab?.viewType === 'tags' ? (
            <TagsPage
              spaceId={currentSpaceId}
              workspaces={currentSpaceWorkspaces}
              onSelectWorkspace={(id) => selectWorkspaceWithTab(id)}
              initialSelectedTag={selectedTagForModal}
            />
          ) : currentWorkspace ? (
            activeViewMode === 'doc' ? (
              <div className="flex-1 h-full overflow-hidden">
                <DocEditor
                  workspace={currentWorkspace}
                  allWorkspaces={activeWorkspaces}
                  onSelectWorkspace={(id) => selectWorkspaceWithTab(id)}
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
                  onSwitchToDoc={handleSwitchToDoc}
                  darkMode={darkMode}
                  hideChrome={focusMode}
                />
                {focusMode && (
                  <button
                    onClick={() => setFocusMode(false)}
                    className="absolute top-3 right-3 z-50 h-7 px-2.5 rounded-md bg-[var(--app-bg-overlay)] border border-[var(--app-border)] text-xs font-medium text-[var(--app-text-secondary)] hover:text-[var(--app-text-primary)] opacity-40 hover:opacity-100 transition shadow-[var(--app-shadow-popover)]"
                    title="Mostrar herramientas y menús (Esc)"
                  >
                    Mostrar herramientas
                  </button>
                )}
              </div>
            ) : (
              /* Split View */
              <div className="flex-1 flex h-full overflow-hidden">
                <div className="w-1/2 h-full overflow-hidden border-r border-[#242428]">
                  <DocEditor
                    workspace={currentWorkspace}
                    allWorkspaces={activeWorkspaces}
                    onSelectWorkspace={(id) => selectWorkspaceWithTab(id)}
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
                    onSwitchToDoc={handleSwitchToDoc}
                    darkMode={darkMode}
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
        workspaces={currentSpaceWorkspaces}
        onSelectWorkspace={(id) => selectWorkspaceWithTab(id)}
        darkMode={darkMode}
        onToggleDarkMode={() => setDarkMode(!darkMode)}
        onCreateWorkspace={async () => {
          const newId = crypto.randomUUID()
          const now = Date.now()
          await db.workspaces.add({
            id: newId,
            parentId: null,
            spaceId: currentSpaceId,
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
          selectWorkspaceWithTab(newId)
          toast.success('Página creada')
        }}
        onToggleViewMode={() => setViewMode(activeViewMode === 'canvas' ? 'doc' : 'canvas')}
      />

      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        syncStatus={syncStatus}
        uiScale={uiScale}
        onUiScaleChange={setUiScale}
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
        workspaces={currentSpaceWorkspaces}
        currentWorkspaceId={currentWorkspace?.id || ''}
        onSelectWorkspace={(id) => selectWorkspaceWithTab(id)}
        onCreateWorkspace={() => {
          const newId = crypto.randomUUID()
          const now = Date.now()
          db.workspaces.add({
            id: newId,
            parentId: null,
            spaceId: currentSpaceId,
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
          selectWorkspaceWithTab(newId)
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
        onWorkspaceImported={(newId) => selectWorkspaceWithTab(newId)}
        currentSpaceId={currentSpaceId}
      />

      <CreateWorkspaceModal
        isOpen={isCreateWorkspaceOpen}
        onClose={() => setIsCreateWorkspaceOpen(false)}
        onCreate={handleCreateSpace}
      />

      <ShortcutsModal
        isOpen={isShortcutsOpen}
        onClose={() => setIsShortcutsOpen(false)}
      />

      <CollectionsModal
        isOpen={isCollectionsOpen}
        onClose={() => setIsCollectionsOpen(false)}
        spaceId={currentSpaceId}
        workspaces={currentSpaceWorkspaces}
        onSelectWorkspace={selectWorkspaceWithTab}
      />

      <TagsModal
        isOpen={isTagsOpen}
        onClose={() => {
          setIsTagsOpen(false)
          setSelectedTagForModal(null)
        }}
        spaceId={currentSpaceId}
        workspaces={currentSpaceWorkspaces}
        onSelectWorkspace={selectWorkspaceWithTab}
        initialSelectedTag={selectedTagForModal}
      />

      <KnowledgeGraphModal
        isOpen={isKnowledgeGraphOpen}
        onClose={() => setIsKnowledgeGraphOpen(false)}
        workspaces={activeWorkspaces}
        currentWorkspaceId={currentWorkspaceId}
        onSelectWorkspace={selectWorkspaceWithTab}
      />

      {/* 5. AFFiNE Fullscreen Presentation Mode Player */}
      <PresentationViewer
        isOpen={isPresentationMode}
        onClose={() => {
          setIsPresentationMode(false)
          setPresentationFrameId(undefined)
        }}
        workspace={currentWorkspace}
        initialFrameId={presentationFrameId}
      />

      {/* 6. Pro Sonner Notification Toaster */}
      <Toaster richColors position="bottom-right" closeButton theme={darkMode ? 'dark' : 'light'} />
    </div>
  )
}
