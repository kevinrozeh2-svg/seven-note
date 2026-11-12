import { useState, useEffect, useCallback, useMemo, useRef, lazy, Suspense } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import {
  FileText,
  Kanban,
  SidebarSimple,
  Columns,
  Star,
  Info,
  DotsThree,
  Presentation,
  ShareNetwork,
  Copy,
  Keyboard,
  Trash,
  MagnifyingGlass,
  DownloadSimple,
  FileHtml,
  FileCode,
  Graph,
  PencilSimpleLine,
  LockKey,
  LockKeyOpen,
  ArrowsOutLineHorizontal,
  Printer,
  Sparkle
} from '@phosphor-icons/react'
import {
  db,
  clearLocalUserData,
  seedInitialData,
  type ViewMode,
  type WorkspaceItem,
  type SpaceItem,
  DEFAULT_SPACE_ID,
  createSpace,
  updateSpace,
  deleteSpace
} from './db'
import { markItemAsRead } from './lib/unreadTracker'
import { syncEngine, type SyncEngineStatus } from './lib/syncEngine'
import { ObsidianRibbon } from './components/sidebar/ObsidianRibbon'
import { Sidebar } from './components/sidebar/Sidebar'
import { RightSidebar } from './components/sidebar/RightSidebar'
import { CommandPalette } from './components/modals/CommandPalette'
import { initTauriUpdater } from './lib/tauriUpdater'
import { FindInPage } from './components/search/FindInPage'
import { WorkbenchTabs, type WorkbenchTab } from './components/tabs/WorkbenchTabs'
const ExternalShareView = lazy(() => import('./components/views/ExternalShareView').then(m => ({ default: m.ExternalShareView })))
import { type AppTemplate } from './lib/templates'
import {
  getCurrentMember,
  setCurrentMember,
  subscribeToMemberChanges,
  mapSupabaseUserToMember,
  type TeamMember,
  isWorkspaceVisible,
  isSpaceVisible,
  canUserEditWorkspace,
  canUserDeleteWorkspace,
  canUserTogglePrivacy
} from './lib/teamAuth'
import { getAuthUser, onAuthChange, signOutUser, fetchUserProfile } from './lib/supabase'
import {
  exportDocumentAsMarkdown,
  exportDocumentAsHtml,
  exportDocumentAsJson,
  copyAsPlainText,
  printDocument
} from './lib/exportUtils'
import { Toaster, toast } from 'sonner'

// Lazy-loaded heavy components for instant initial load (code-splitting)
const DocEditor = lazy(() => import('./components/editor/DocEditor').then(m => ({ default: m.DocEditor })))
const CanvasBoard = lazy(() => import('./components/canvas/CanvasBoard').then(m => ({ default: m.CanvasBoard })))
const PresentationViewer = lazy(() => import('./components/presentation/PresentationViewer').then(m => ({ default: m.PresentationViewer })))
const AllDocsPage = lazy(() => import('./components/views/AllDocsPage').then(m => ({ default: m.AllDocsPage })))
const KnowledgeGraphPage = lazy(() => import('./components/views/KnowledgeGraphPage').then(m => ({ default: m.KnowledgeGraphPage })))
const TrashPage = lazy(() => import('./components/views/TrashPage').then(m => ({ default: m.TrashPage })))
const TemplatesPage = lazy(() => import('./components/views/TemplatesPage').then(m => ({ default: m.TemplatesPage })))

import type { AuthMode } from './components/modals/AuthModal'

const SettingsModal = lazy(() => import('./components/modals/SettingsModal').then(m => ({ default: m.SettingsModal })))
const ShareModal = lazy(() => import('./components/modals/ShareModal').then(m => ({ default: m.ShareModal })))
const TemplatesModal = lazy(() => import('./components/modals/TemplatesModal').then(m => ({ default: m.TemplatesModal })))
const ImportModal = lazy(() => import('./components/modals/ImportModal').then(m => ({ default: m.ImportModal })))
const ShortcutsModal = lazy(() => import('./components/modals/ShortcutsModal').then(m => ({ default: m.ShortcutsModal })))
const CreateWorkspaceModal = lazy(() => import('./components/modals/CreateWorkspaceModal').then(m => ({ default: m.CreateWorkspaceModal })))
const AuthModal = lazy(() => import('./components/modals/AuthModal').then(m => ({ default: m.AuthModal })))
const UserProfileModal = lazy(() => import('./components/modals/UserProfileModal').then(m => ({ default: m.UserProfileModal })))
const UserManagementModal = lazy(() => import('./components/modals/UserManagementModal').then(m => ({ default: m.UserManagementModal })))
const QuickCaptureModal = lazy(() => import('./components/modals/QuickCaptureModal').then(m => ({ default: m.QuickCaptureModal })))


function MainApp() {

  // Miembro activo del equipo
  const [currentMember, setCurrentMemberState] = useState<TeamMember>(() => getCurrentMember())
  const [authUser, setAuthUser] = useState<any>(null)
  const [authLoading, setAuthLoading] = useState(true)
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false)
  const [authModalMode, setAuthModalMode] = useState<AuthMode>('login')
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false)
  const [isUserManagementModalOpen, setIsUserManagementModalOpen] = useState(false)

  // Sincronizar sesión activa de Supabase Auth
  useEffect(() => {
    initTauriUpdater()
    // Detectar si el usuario llega con un token de recuperación de contraseña (#type=recovery)
    if (typeof window !== 'undefined' && window.location.hash.includes('type=recovery')) {
      setAuthModalMode('reset')
      setIsAuthModalOpen(true)
    }

    // 1. Comprobar usuario ya autenticado
    getAuthUser().then(async (user) => {
      if (user) {
        setAuthUser(user)
        const profile = await fetchUserProfile(user.id)
        const mapped = mapSupabaseUserToMember(user, profile)
        setCurrentMember(mapped)
        setCurrentMemberState(mapped)
        syncEngine.triggerSync()
      }
      setAuthLoading(false)
    }).catch(() => {
      setAuthLoading(false)
    })

    // 2. Suscribirse a cambios de sesión (Login, Logout, Token refresh, Recovery)
    const unsubAuth = onAuthChange(async (event, session) => {
      if (event === 'PASSWORD_RECOVERY') {
        setAuthModalMode('reset')
        setIsAuthModalOpen(true)
      }

      const user = session?.user || null
      setAuthUser(user)
      if (user) {
        const profile = await fetchUserProfile(user.id)
        const mapped = mapSupabaseUserToMember(user, profile)
        setCurrentMember(mapped)
        setCurrentMemberState(mapped)
        if (event === 'SIGNED_IN') {
          syncEngine.resetLastSyncTime()
        }
        syncEngine.triggerSync()
      }
      setAuthLoading(false)
    })

    // 3. Suscribirse a cambios de miembro local
    const unsubMember = subscribeToMemberChanges((m) => {
      setCurrentMemberState(m)
    })

    return () => {
      unsubAuth()
      unsubMember()
    }
  }, [])

  const handleSelectMember = (memberId: string) => {
    const m = setCurrentMember(memberId)
    setCurrentMemberState(m)
    toast.info(`Perfil activo: ${m.name}`)
  }

  const handleSignOut = async () => {
    await signOutUser()
    await clearLocalUserData()
    syncEngine.resetLastSyncTime()
    localStorage.removeItem('seven_note_workbench_tabs')
    localStorage.removeItem('seven_note_workbench_active_tab')
    localStorage.removeItem('seven_note_active_space_id')
    localStorage.removeItem('seven_note_current_member')
    localStorage.removeItem('seven_note_current_profile')
    setAuthUser(null)
    toast.info('Sesión cerrada correctamente')
  }

  const [currentWorkspaceId, setCurrentWorkspaceId] = useState<string>('ws-feature-priorities')
  const [sidebarOpen, setSidebarOpen] = useState(() => {
    if (typeof window !== 'undefined') {
      return window.innerWidth >= 768
    }
    return true
  })
  const [rightSidebarOpen, setRightSidebarOpen] = useState(false)
  const [rightSidebarTab, setRightSidebarTab] = useState<'properties' | 'outline' | 'history'>('properties')
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
  const workspaces = useLiveQuery(() => db.workspaces.toArray()) ?? []
  const [optimisticWorkspace, setOptimisticWorkspace] = useState<WorkspaceItem | null>(null)

  useEffect(() => {
    if (optimisticWorkspace && workspaces.some((w) => w.id === optimisticWorkspace.id)) {
      setOptimisticWorkspace(null)
    }
  }, [workspaces, optimisticWorkspace])

  const effectiveWorkspaces = useMemo(() => {
    if (optimisticWorkspace && !workspaces.some((w) => w.id === optimisticWorkspace.id)) {
      return [optimisticWorkspace, ...workspaces]
    }
    return workspaces
  }, [workspaces, optimisticWorkspace])

  const [currentSpaceId, setCurrentSpaceId] = useState<string>(() => {
    return localStorage.getItem('seven_note_active_space_id') || DEFAULT_SPACE_ID
  })
  const [isCreateWorkspaceOpen, setIsCreateWorkspaceOpen] = useState(false)

  // Modals state
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)
  const [isSearchOpen, setIsSearchOpen] = useState(false)
  const [isShareOpen, setIsShareOpen] = useState(false)
  const [isTemplatesOpen, setIsTemplatesOpen] = useState(false)
  const [isImportOpen, setIsImportOpen] = useState(false)
  const [isShortcutsOpen, setIsShortcutsOpen] = useState(false)
  const [isFindInPageOpen, setIsFindInPageOpen] = useState(false)
  const [isQuickCaptureOpen, setIsQuickCaptureOpen] = useState(false)

  const [activeDropdown, setActiveDropdown] = useState<'info' | 'more' | 'export' | null>(null)
  const [focusMode, setFocusMode] = useState(false)

  // Workbench tabs state (Browser-grade tab management)
  const [tabs, setTabs] = useState<WorkbenchTab[]>(() => {
    try {
      const saved = localStorage.getItem('seven_note_workbench_tabs')
      if (saved) {
        const parsed = JSON.parse(saved)
        if (Array.isArray(parsed) && parsed.length > 0) {
          // Deduplicate on initial parse
          const seen = new Set<string>()
          const cleaned: WorkbenchTab[] = []
          for (const t of parsed) {
            const key = t.viewType && t.viewType !== 'doc' 
              ? `view:${t.viewType}` 
              : (t.workspaceId ? `ws:${t.workspaceId}` : `title:${t.title || 'untitled'}`)
            if (!seen.has(key)) {
              seen.add(key)
              cleaned.push(t)
            }
          }
          if (cleaned.length > 0) return cleaned
        }
      }
    } catch (e) {
      // fallback
    }
    return [{ id: 'tab-initial', workspaceId: 'ws-feature-priorities', title: 'Plan de Producto', icon: '🎯', pinned: false }]
  })

  const [activeTabId, setActiveTabId] = useState<string>(() => {
    try {
      const saved = localStorage.getItem('seven_note_workbench_active_tab')
      if (saved) return saved
    } catch (e) {}
    return 'tab-initial'
  })

  // History of closed tabs for Reopening (Ctrl+Shift+T)
  const [closedTabsHistory, setClosedTabsHistory] = useState<WorkbenchTab[]>([])

  // Keep refs for event listeners so they don't capture stale closures
  const tabsRef = useRef(tabs)
  tabsRef.current = tabs
  const activeTabIdRef = useRef(activeTabId)
  activeTabIdRef.current = activeTabId
  const closedTabsHistoryRef = useRef(closedTabsHistory)
  closedTabsHistoryRef.current = closedTabsHistory

  // Persist tabs and active tab
  useEffect(() => {
    localStorage.setItem('seven_note_workbench_tabs', JSON.stringify(tabs))
  }, [tabs])

  useEffect(() => {
    localStorage.setItem('seven_note_workbench_active_tab', activeTabId)
  }, [activeTabId])

  // Mark currently open note and space as read for the active member
  useEffect(() => {
    if (currentWorkspaceId) {
      markItemAsRead(currentWorkspaceId, 'workspace', currentMember, authUser?.id)
    }
    if (currentSpaceId) {
      markItemAsRead(currentSpaceId, 'space', currentMember, authUser?.id)
    }
  }, [currentWorkspaceId, currentSpaceId, currentMember, authUser?.id])

  // Synchronize and deduplicate tabs whenever workspaces are loaded or changed
  useEffect(() => {
    if (workspaces.length === 0) return

    setTabs((prev) => {
      let changed = false
      const seen = new Set<string>()
      const sanitized: WorkbenchTab[] = []

      for (const t of prev) {
        const key = t.viewType && t.viewType !== 'doc'
          ? `view:${t.viewType}`
          : (t.workspaceId ? `ws:${t.workspaceId}` : `title:${t.title || 'untitled'}`)

        // Eliminate duplicates
        if (seen.has(key)) {
          changed = true
          continue
        }
        seen.add(key)

        // For workspace items, resolve and sync real title, icon, and spaceId from database
        if (t.workspaceId && (!t.viewType || t.viewType === 'doc')) {
          const ws = workspaces.find((w) => w.id === t.workspaceId && !w.isDeleted)
          if (!ws) {
            changed = true
            continue
          }
          const currentTitle = t.title || ''
          const realTitle = ws.title || 'Documento sin título'
          const realIcon = ws.icon || ''
          if (currentTitle !== realTitle || t.icon !== realIcon || t.spaceId !== ws.spaceId) {
            changed = true
            sanitized.push({
              ...t,
              title: realTitle,
              icon: realIcon,
              spaceId: ws.spaceId || t.spaceId
            })
            continue
          }
        }
        sanitized.push(t)
      }

      // If activeTabId is not in the sanitized list, switch to the first tab
      if (sanitized.length > 0 && !sanitized.some((t) => t.id === activeTabId)) {
        setActiveTabId(sanitized[0].id)
      }

      return changed ? sanitized : prev
    })
  }, [workspaces])

  const selectWorkspaceWithTab = async (
    wsId: string,
    explicitSpaceId?: string,
    wsItem?: WorkspaceItem
  ) => {
    if (typeof window !== 'undefined' && window.innerWidth < 768) {
      setSidebarOpen(false)
    }
    if (wsItem) {
      setOptimisticWorkspace(wsItem)
    }
    let ws = wsItem || effectiveWorkspaces.find((w) => w.id === wsId)
    if (!ws && wsId) {
      try {
        ws = await db.workspaces.get(wsId)
        if (ws) {
          setOptimisticWorkspace(ws)
        }
      } catch (err) {
        console.error('Error fetching workspace from db', err)
      }
    }
    const targetSpaceId = explicitSpaceId || ws?.spaceId || (ws ? DEFAULT_SPACE_ID : currentSpaceId)
    if (targetSpaceId && targetSpaceId !== currentSpaceId) {
      setCurrentSpaceId(targetSpaceId)
      localStorage.setItem('seven_note_active_space_id', targetSpaceId)
      markItemAsRead(targetSpaceId, 'space', currentMember, authUser?.id)
    }
    setCurrentWorkspaceId(wsId)
    setViewMode(ws?.viewMode || 'doc')
    markItemAsRead(wsId, 'workspace', currentMember, authUser?.id)

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
        title: ws?.title || 'Documento sin título',
        icon: ws?.icon || '',
        spaceId: targetSpaceId || currentSpaceId,
        pinned: false
      }
      setActiveTabId(newTab.id)
      return [...prev, newTab]
    })
  }

  const openSpecialViewTab = (
    viewType: 'all-docs' | 'knowledge-graph' | 'trash' | 'templates',
    title: string
  ) => {
    if (typeof window !== 'undefined' && window.innerWidth < 768) {
      setSidebarOpen(false)
    }
    setTabs((prev) => {
      const existing = prev.find((t) => t.viewType === viewType)
      if (existing) {
        setActiveTabId(existing.id)
        return prev
      }
      const newTab: WorkbenchTab = {
        id: `tab-${viewType}`,
        workspaceId: '',
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
      // 1. Special views (all-docs, knowledge-graph, trash, templates)
      if (tab.viewType && tab.viewType !== 'doc') {
        return
      }

      // 2. Regular document / canvas
      if (tab.workspaceId) {
        const ws = workspaces.find((w) => w.id === tab.workspaceId)
        if (ws) {
          if (ws.spaceId && ws.spaceId !== currentSpaceId) {
            setCurrentSpaceId(ws.spaceId)
          }
          setCurrentWorkspaceId(ws.id)
          setViewMode(ws.viewMode || 'doc')
        } else {
          setCurrentWorkspaceId(tab.workspaceId)
        }
      }
    }
  }

  const handleCloseTab = (tabId: string) => {
    const tabIndex = tabs.findIndex((t) => t.id === tabId)
    if (tabIndex === -1) return
    const closingTab = tabs[tabIndex]

    // Save to closed tabs history (max 20)
    setClosedTabsHistory((prev) => [closingTab, ...prev].slice(0, 20))

    const remaining = tabs.filter((t) => t.id !== tabId)
    setTabs(remaining)
    if (remaining.length === 0) {
      setActiveTabId('')
      setCurrentWorkspaceId('')
    } else {
      if (activeTabId === tabId) {
        const nextActive = remaining[Math.min(tabIndex, remaining.length - 1)]
        handleSelectTab(nextActive.id)
      }
    }
  }

  const handleNewTab = async () => {
    const newId = crypto.randomUUID()
    const now = Date.now()
    const newWs: WorkspaceItem = {
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
      syncStatus: 'pending',
      ownerMember: currentMember.id,
      ownerName: currentMember.name,
      createdBy: currentMember.name,
      userId: authUser?.id || undefined,
      viewedBy: [currentMember.id, currentMember.fullName || currentMember.name, currentMember.email, authUser?.id].filter(Boolean) as string[],
      isNewItem: true
    }
    await db.workspaces.add(newWs)
    setOptimisticWorkspace(newWs)
    const newTab: WorkbenchTab = {
      id: `tab-${crypto.randomUUID()}`,
      workspaceId: newId,
      viewType: 'doc',
      title: 'Untitled',
      icon: '📄',
      spaceId: currentSpaceId,
      pinned: false
    }
    setTabs((prev) => [...prev, newTab])
    setActiveTabId(newTab.id)
    setCurrentWorkspaceId(newId)
    setViewMode('doc')
  }

  const handleTogglePinTab = (tabId: string) => {
    setTabs((prev) =>
      prev.map((t) => (t.id === tabId ? { ...t, pinned: !t.pinned } : t))
    )
  }

  const handleDuplicateTab = (tabId: string) => {
    const tab = tabs.find((t) => t.id === tabId)
    if (!tab) return
    const newTab: WorkbenchTab = {
      ...tab,
      id: `tab-${crypto.randomUUID()}`,
      pinned: false
    }
    setTabs((prev) => [...prev, newTab])
    setActiveTabId(newTab.id)
  }

  const handleCloseOtherTabs = (tabId: string) => {
    const closed = tabs.filter((t) => t.id !== tabId && !t.pinned)
    if (closed.length > 0) {
      setClosedTabsHistory((prev) => [...closed, ...prev].slice(0, 20))
    }
    setTabs((prev) => prev.filter((t) => t.id === tabId || t.pinned))
    setActiveTabId(tabId)
  }

  const handleCloseTabsToRight = (tabId: string) => {
    const tabIndex = tabs.findIndex((t) => t.id === tabId)
    if (tabIndex === -1) return
    const kept = tabs.filter((t, i) => i <= tabIndex || t.pinned)
    const closed = tabs.filter((t, i) => i > tabIndex && !t.pinned)
    if (closed.length > 0) {
      setClosedTabsHistory((prev) => [...closed, ...prev].slice(0, 20))
    }
    setTabs(kept)
    if (!kept.some((t) => t.id === activeTabId)) {
      handleSelectTab(tabId)
    }
  }

  const handleReopenClosedTab = () => {
    if (closedTabsHistory.length === 0) return
    const [tabToReopen, ...rest] = closedTabsHistory
    setClosedTabsHistory(rest)
    setTabs((prev) => {
      if (prev.some((t) => t.id === tabToReopen.id || (tabToReopen.workspaceId && t.workspaceId === tabToReopen.workspaceId))) {
        return prev
      }
      return [...prev, tabToReopen]
    })
    handleSelectTab(tabToReopen.id)
    toast.info(`Pestaña "${tabToReopen.title || 'Documento'}" reabierta`)
  }

  const handleReorderTabs = (fromIndex: number, toIndex: number) => {
    if (fromIndex === toIndex || fromIndex < 0 || toIndex < 0) return
    setTabs((prev) => {
      const next = [...prev]
      const [moved] = next.splice(fromIndex, 1)
      next.splice(toIndex, 0, moved)
      return next
    })
  }

  const [copiedLink, setCopiedLink] = useState(false)
  const [isEditingBoardTitle, setIsEditingBoardTitle] = useState(false)
  const [boardTitleInput, setBoardTitleInput] = useState('')

  const startEditingBoardTitle = () => {
    if (isCurrentWorkspaceReadOnly) {
      toast.info('Solo el autor o un administrador pueden renombrar este tablero.')
      return
    }
    setBoardTitleInput(currentWorkspace?.title === 'Untitled' ? '' : (currentWorkspace?.title || ''))
    setIsEditingBoardTitle(true)
  }

  const commitBoardTitle = async () => {
    setIsEditingBoardTitle(false)
    const trimmed = boardTitleInput.trim() || 'Untitled'
    if (trimmed !== currentWorkspace?.title) {
      await handleTitleChange(trimmed)
    }
  }

  // Close menus on outside click
  useEffect(() => {
    const handleCloseMenus = () => setActiveDropdown(null)
    window.addEventListener('click', handleCloseMenus)
    return () => window.removeEventListener('click', handleCloseMenus)
  }, [])

  // Sync engine status
  const [syncStatus, setSyncStatus] = useState<SyncEngineStatus>(syncEngine.getStatus())

  // Initialize DB and subscribe to sync
  useEffect(() => {
    seedInitialData()
    const unsubscribe = syncEngine.subscribe((status) => {
      setSyncStatus(status)
    })

    // Listen for custom sub-board navigation events
    const handleNavigate = (e: any) => {
      if (e.detail?.viewType) {
        openSpecialViewTab(e.detail.viewType, e.detail.title || 'Vista')
      } else if (e.detail?.workspaceId) {
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

      if (e.altKey && e.key.toLowerCase() === 'n') {
        e.preventDefault()
        setIsQuickCaptureOpen((prev) => !prev)
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

    const handleOpenQuickCapture = () => setIsQuickCaptureOpen(true)

    window.addEventListener('seven-note-navigate-workspace', handleNavigate)
    window.addEventListener('seven-note-switch-mode', handleSwitchMode)
    window.addEventListener('seven-note-start-presentation', handleStartPresentation)
    window.addEventListener('seven-note-open-quick-capture', handleOpenQuickCapture)
    window.addEventListener('keydown', handleKeyDown)

    return () => {
      unsubscribe()
      window.removeEventListener('seven-note-navigate-workspace', handleNavigate)
      window.removeEventListener('seven-note-switch-mode', handleSwitchMode)
      window.removeEventListener('seven-note-start-presentation', handleStartPresentation)
      window.removeEventListener('seven-note-open-quick-capture', handleOpenQuickCapture)
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

  // Filter visible spaces for current member (Strict privacy: private spaces only visible to owner)
  const visibleSpaces = useMemo(() => {
    return spaces
      .filter((s: SpaceItem) => !s.isDeleted && isSpaceVisible(s, currentMember, authUser?.id))
      .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0))
  }, [spaces, currentMember, authUser?.id])

  // Keep currentSpaceId in sync with visible spaces and auto-select space with content
  useEffect(() => {
    if (visibleSpaces.length === 0) return

    const hasCurrentSpace = visibleSpaces.some((s: SpaceItem) => s.id === currentSpaceId)
    const savedSpaceId = localStorage.getItem('seven_note_active_space_id')

    if (savedSpaceId && visibleSpaces.some((s) => s.id === savedSpaceId)) {
      if (currentSpaceId !== savedSpaceId) {
        setCurrentSpaceId(savedSpaceId)
      }
      return
    }

    // Si el espacio actual no es válido o es el demo-workspace inicial pero existen otros espacios con notas,
    // cambiamos automáticamente al espacio activo del usuario.
    if (!hasCurrentSpace || currentSpaceId === DEFAULT_SPACE_ID) {
      const spaceWithNotes = visibleSpaces.find((s) => {
        if (s.id === DEFAULT_SPACE_ID) return false
        return workspaces.some(
          (w) => !w.isDeleted && (w.spaceId || DEFAULT_SPACE_ID) === s.id && isWorkspaceVisible(w, currentMember, authUser?.id)
        )
      })
      const targetSpace = spaceWithNotes || visibleSpaces.find((s) => s.id !== DEFAULT_SPACE_ID) || visibleSpaces[0]
      if (targetSpace && targetSpace.id !== currentSpaceId) {
        setCurrentSpaceId(targetSpace.id)
        localStorage.setItem('seven_note_active_space_id', targetSpace.id)
      }
    }
  }, [visibleSpaces, currentSpaceId, workspaces, currentMember, authUser?.id])

  // Select active workspace items belonging to current space and visible to currentMember
  const currentSpaceWorkspaces = effectiveWorkspaces.filter(
    (w) =>
      (w.spaceId || DEFAULT_SPACE_ID) === currentSpaceId &&
      isWorkspaceVisible(w, currentMember, authUser?.id)
  )
  const activeWorkspaces = currentSpaceWorkspaces.filter((w) => !w.isDeleted)
  const currentWorkspace: WorkspaceItem | undefined =
    activeWorkspaces.find((w) => w.id === currentWorkspaceId) || activeWorkspaces[0]

  // Keep currentWorkspaceId in sync with active workspaces in current space
  useEffect(() => {
    if (activeWorkspaces.length > 0) {
      if (!activeWorkspaces.some((w) => w.id === currentWorkspaceId)) {
        let isMounted = true
        db.workspaces.get(currentWorkspaceId).then((item) => {
          if (!isMounted) return
          if (item && !item.isDeleted && (item.spaceId || DEFAULT_SPACE_ID) === currentSpaceId) {
            return
          }
          const first = activeWorkspaces[0]
          setCurrentWorkspaceId(first.id)
          setViewMode(first.viewMode || 'doc')
        }).catch(() => {
          if (isMounted) {
            const first = activeWorkspaces[0]
            setCurrentWorkspaceId(first.id)
            setViewMode(first.viewMode || 'doc')
          }
        })
        return () => {
          isMounted = false
        }
      }
    }
  }, [activeWorkspaces, currentWorkspaceId, currentSpaceId])

  // Workspaces from all public spaces (for bidirectional links and cross-workspace referencing)
  const publicWorkspaces = useMemo(() => {
    const privateSpaceIds = new Set(
      spaces.filter((s: SpaceItem) => Boolean(s.isPrivate) && !s.isDeleted).map((s: SpaceItem) => s.id)
    )

    const map = new Map<string, WorkspaceItem>()

    // Add all non-deleted, non-private workspaces from public spaces
    workspaces.forEach((w) => {
      if (w.isDeleted) return
      const spaceId = w.spaceId || DEFAULT_SPACE_ID
      const isSpacePublic = !privateSpaceIds.has(spaceId)
      if (isSpacePublic && !w.isPrivate) {
        map.set(w.id, w)
      }
    })

    // Also include active workspaces from current space visible to current member
    activeWorkspaces.forEach((w) => {
      map.set(w.id, w)
    })

    return Array.from(map.values())
  }, [spaces, workspaces, activeWorkspaces])

  // ========================================================
  // SISTEMA DE 3 CAPAS - PERMISOS DINÁMICOS
  // - Capa 1 (Admins: Kevin, Maikol, Marcos): Control total de notas y tableros compartidos.
  // - Capa 2 (Trabajadores): Lectura de todo el equipo. SOLO pueden editar lo propio.
  // - Capa 3 (Externos): Solo lectura absoluta de la nota compartida.
  // ========================================================
  const isCurrentWorkspaceReadOnly = useMemo(() => {
    if (!currentWorkspace) return false
    return !canUserEditWorkspace(currentWorkspace, currentMember, authUser?.id)
  }, [currentWorkspace, currentMember, authUser?.id])

  const canEditCurrentPrivacy = useMemo(() => {
    if (!currentWorkspace) return false
    return canUserTogglePrivacy(currentWorkspace, currentMember, authUser?.id)
  }, [currentWorkspace, currentMember, authUser?.id])

  // Space switcher actions
  const handleSelectSpace = async (spaceId: string) => {
    setCurrentSpaceId(spaceId)
    localStorage.setItem('seven_note_active_space_id', spaceId)
    markItemAsRead(spaceId, 'space', currentMember, authUser?.id)

    const targetSpacePages = workspaces.filter(
      (w) => !w.isDeleted && (w.spaceId || DEFAULT_SPACE_ID) === spaceId && isWorkspaceVisible(w, currentMember, authUser?.id)
    )
    if (targetSpacePages.length > 0) {
      setCurrentWorkspaceId(targetSpacePages[0].id)
      markItemAsRead(targetSpacePages[0].id, 'workspace', currentMember, authUser?.id)
    } else {
      // Auto-create initial page if space has no visible pages
      const sp = spaces.find((s) => s.id === spaceId)
      const isSpPrivate = Boolean(sp?.isPrivate)
      const newPageId = crypto.randomUUID()
      const now = Date.now()
      const creatorTokens = [currentMember.id, currentMember.fullName || currentMember.name, currentMember.email, authUser?.id].filter(Boolean) as string[]
      await db.workspaces.add({
        id: newPageId,
        parentId: null,
        spaceId: spaceId,
        title: isSpPrivate ? 'Página inicial privada' : 'Página inicial',
        icon: '',
        color: sp?.color || '#1e96eb',
        viewMode: 'doc',
        docContent: isSpPrivate
          ? `<h1>🔒 ${sp?.name || 'Espacio Privado'}</h1><p>Espacio privado. Solo tú tienes acceso a este contenido.</p>`
          : `<h1>✨ ${sp?.name || 'Nuevo Espacio'}</h1><p>¡Bienvenido a tu espacio de trabajo! Comienza a escribir o planificar aquí.</p>`,
        createdAt: now,
        updatedAt: now,
        isFavorite: false,
        isDeleted: false,
        syncStatus: 'pending',
        isPrivate: isSpPrivate,
        ownerMember: currentMember.id,
        ownerName: currentMember.fullName || currentMember.name,
        createdBy: currentMember.fullName || currentMember.name,
        userId: authUser?.id || undefined,
        viewedBy: creatorTokens,
        isNewItem: true,
        activeProperties: ['tags', 'createdAt', 'updatedAt'],
        propertyVisibility: {
          tags: 'always_show',
          createdAt: 'always_show',
          updatedAt: 'always_show'
        }
      })
      setCurrentWorkspaceId(newPageId)
    }
  }

  const handleCreateSpace = async (name: string, icon: string, color: string, isPrivate: boolean = false) => {
    const { space, initialPageId } = await createSpace(
      name,
      icon,
      color,
      isPrivate,
      currentMember.id,
      currentMember.fullName || currentMember.name,
      authUser?.id
    )
    setCurrentSpaceId(space.id)
    localStorage.setItem('seven_note_active_space_id', space.id)
    setCurrentWorkspaceId(initialPageId)
    toast.success(isPrivate ? `Espacio privado "${space.name}" creado (solo visible para ti)` : `Espacio "${space.name}" creado`)
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
    if (!currentWorkspace || isCurrentWorkspaceReadOnly) return
    try {
      await db.workspaces.update(currentWorkspace.id, {
        title: newTitle,
        updatedAt: Date.now(),
        syncStatus: 'pending'
      })
      const docFrame = await db.canvasNodes.get(`docframe-${currentWorkspace.id}`)
      if (docFrame) {
        await db.canvasNodes.update(`docframe-${currentWorkspace.id}`, {
          data: { ...docFrame.data, title: newTitle },
          updatedAt: Date.now(),
          syncStatus: 'pending'
        })
      }
      setTabs((prev) =>
        prev.map((t) =>
          t.workspaceId === currentWorkspace.id ? { ...t, title: newTitle } : t
        )
      )
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

  // Toggle privacy (pública para el equipo vs privada solo para el autor)
  const handleTogglePrivacy = async () => {
    if (!currentWorkspace) return
    if (!canEditCurrentPrivacy) {
      toast.error('Solo el creador original o un administrador pueden modificar la privacidad.')
      return
    }
    const nextPrivate = !currentWorkspace.isPrivate
    try {
      await db.workspaces.update(currentWorkspace.id, {
        isPrivate: nextPrivate,
        ownerMember: nextPrivate ? (currentWorkspace.ownerMember || currentMember.id) : (currentWorkspace.ownerMember || currentMember.id),
        ownerName: nextPrivate ? (currentWorkspace.ownerName || currentMember.name) : undefined,
        updatedAt: Date.now(),
        syncStatus: 'pending'
      })
      syncEngine.scheduleSync(500)
      toast.success(nextPrivate ? 'Nota cambiada a MODO PRIVADO (solo tú)' : 'Nota cambiada a MODO EQUIPO (pública para todos)')
    } catch (e) {
      console.error('Error toggling privacy', e)
    }
  }

  // Apply template (Supports both Edgeless Canvas and Document templates)
  const handleApplyTemplate = async (template: AppTemplate) => {
    if (!currentWorkspace) return
    if (isCurrentWorkspaceReadOnly) {
      toast.error('Esta nota pertenece a otro miembro del equipo y está en modo solo lectura.')
      return
    }
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
        hasCover: template.hasCover,
        coverType: template.coverType,
        coverBannerTitle: template.coverBannerTitle,
        coverBannerSubtitle: template.coverBannerSubtitle,
        coverColor: template.coverColor,
        coverBannerStyle: template.coverBannerStyle,
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
  const activeTab = tabs.find((t) => t.id === activeTabId)
  const activeViewMode: ViewMode = currentWorkspace?.viewMode || 'doc'

  // Pantalla de carga mientras se verifica la sesión
  if (authLoading) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-[#fbfbfa] dark:bg-[#121214] text-neutral-900 dark:text-neutral-100 font-sans">
        <div className="flex flex-col items-center gap-3 animate-in fade-in duration-200">
          <div className="w-12 h-12 rounded-2xl bg-neutral-900 dark:bg-white flex items-center justify-center text-white dark:text-neutral-900 font-black text-xl shadow-lg">
            7
          </div>
          <div className="text-xs text-neutral-400 font-medium">Cargando Seven Note...</div>
        </div>
      </div>
    )
  }

  // Auth Gate: Bloqueo total de la web si no hay sesión iniciada
  if (!authUser) {
    return (
      <div className="relative flex h-screen w-screen items-center justify-center bg-[#f8f9fa] dark:bg-[#121214] text-neutral-900 dark:text-neutral-100 font-sans select-none overflow-hidden">
        <Toaster position="top-right" richColors closeButton />
        <AuthModal
          isOpen={true}
          canDismiss={false}
          initialMode={authModalMode}
          onClose={() => {}}
          onAuthSuccess={(member) => {
            setCurrentMemberState(member)
            syncEngine.resetLastSyncTime()
            syncEngine.triggerSync()
          }}
        />
      </div>
    )
  }

  return (
    <div className="relative flex h-screen w-screen overflow-hidden bg-[var(--obsidian-sidebar-bg,#181818)] text-[var(--app-text-primary)] font-sans select-none">
      {/* 0. Obsidian Left Ribbon (Compact 40px Tool strip) */}
      {!isPresentationMode && !focusMode && (
        <ObsidianRibbon
          sidebarOpen={sidebarOpen}
          onToggleSidebar={() => setSidebarOpen((prev) => !prev)}
          onNewNote={handleNewTab}
          onOpenSearch={() => setIsSearchOpen(true)}
          onOpenKnowledgeGraph={() => openSpecialViewTab('knowledge-graph', 'Vista gráfica')}
          onOpenCanvas={() => {
            if (activeViewMode === 'canvas') {
              setViewMode('doc')
            } else {
              setViewMode('canvas')
            }
          }}
          onOpenAllDocs={() => openSpecialViewTab('all-docs', 'Todos los documentos')}
          onOpenTemplates={() => openSpecialViewTab('templates', 'Plantillas')}
          onOpenImport={() => setIsImportOpen(true)}
          onOpenShortcuts={() => setIsShortcutsOpen(true)}
          onOpenTrash={() => openSpecialViewTab('trash', 'Papelera')}
          onOpenSettings={() => setIsSettingsOpen(true)}
          activeView={activeTab?.viewType || activeViewMode}
          syncStatus={syncStatus}
          darkMode={darkMode}
          onToggleDarkMode={() => setDarkMode(!darkMode)}
          currentMember={currentMember}
          onSelectMember={handleSelectMember}
          authUser={authUser}
          onOpenAuthModal={() => {
            setAuthModalMode('login')
            setIsAuthModalOpen(true)
          }}
          onOpenProfileModal={() => setIsProfileModalOpen(true)}
          onOpenUserManagementModal={() => setIsUserManagementModalOpen(true)}
          onSignOut={handleSignOut}
        />
      )}

      {/* 1. Left Sidebar Navigation */}
      {sidebarOpen && !isPresentationMode && !focusMode && (
        <>
          {/* Mobile backdrop overlay */}
          <div
            className="fixed inset-0 bg-black/50 backdrop-blur-xs z-40 md:hidden animate-in fade-in duration-150"
            onClick={() => setSidebarOpen(false)}
          />
          <div className="fixed inset-y-0 left-10 md:left-0 z-50 md:relative md:z-auto h-full flex shrink-0">
            <Sidebar
              spaces={visibleSpaces}
              currentSpaceId={currentSpaceId}
              currentMember={currentMember}
              onSelectMember={handleSelectMember}
              authUser={authUser}
              onOpenAuthModal={() => {
                setAuthModalMode('login')
                setIsAuthModalOpen(true)
              }}
              onOpenProfileModal={() => setIsProfileModalOpen(true)}
              onOpenUserManagementModal={() => setIsUserManagementModalOpen(true)}
              onSignOut={handleSignOut}
              onSelectSpace={handleSelectSpace}
              onOpenCreateSpace={() => setIsCreateWorkspaceOpen(true)}
              onRenameSpace={handleRenameSpace}
              onDeleteSpace={handleDeleteSpace}
              workspaces={effectiveWorkspaces}
              currentWorkspaceId={currentWorkspace?.id || ''}
              onSelectWorkspace={selectWorkspaceWithTab}
              onToggleSidebar={() => setSidebarOpen(false)}
              onOpenSettings={() => setIsSettingsOpen(true)}
              onOpenSearch={() => setIsSearchOpen(true)}
              onOpenAllDocs={() => openSpecialViewTab('all-docs', 'Todos los documentos')}
              onOpenTrash={() => openSpecialViewTab('trash', 'Papelera')}
              onOpenImport={() => setIsImportOpen(true)}
              onOpenTemplates={() => openSpecialViewTab('templates', 'Plantillas')}
              onOpenShortcuts={() => setIsShortcutsOpen(true)}
              onOpenKnowledgeGraph={() => openSpecialViewTab('knowledge-graph', 'Vista gráfica')}
              syncStatus={syncStatus}
              darkMode={darkMode}
              onToggleDarkMode={() => setDarkMode(!darkMode)}
            />
          </div>
        </>
      )}

      {/* 2. Main Content Center Column */}
      <div className="flex-1 flex flex-col h-full min-w-0 overflow-hidden bg-transparent">
        {/* Top Workbench Tabs Header */}
        {!isPresentationMode && !focusMode && (
          <WorkbenchTabs
            tabs={tabs}
            activeTabId={activeTabId}
            workspaces={activeWorkspaces}
            onSelectTab={handleSelectTab}
            onCloseTab={handleCloseTab}
            onNewTab={handleNewTab}
            onTogglePinTab={handleTogglePinTab}
            onDuplicateTab={handleDuplicateTab}
            onCloseOtherTabs={handleCloseOtherTabs}
            onCloseTabsToRight={handleCloseTabsToRight}
            onReopenClosedTab={handleReopenClosedTab}
            onReorderTabs={handleReorderTabs}
            onToggleSidebar={() => setSidebarOpen((prev) => !prev)}
            sidebarOpen={sidebarOpen}
          />
        )}

        {/* Main Document / Canvas / Full Page Views */}
        <main className="flex-1 relative flex flex-col overflow-hidden">
          {/* Secondary Header for Document/Split Mode: Obsidian Minimalist Stealth Header */}
          {!isPresentationMode && !focusMode && (!activeTab || !activeTab.viewType || activeTab.viewType === 'doc') && currentWorkspace && (
            <header className={`h-8 sm:h-9 px-2 sm:px-3 flex items-center justify-between select-none text-xs transition-colors duration-150 ${
              activeViewMode === 'canvas'
                ? 'absolute top-0 left-0 right-0 z-20 pointer-events-none bg-transparent border-none'
                : 'relative border-b border-[var(--app-border)] bg-[var(--obsidian-editor-bg,#1e1e1e)] shrink-0 z-15'
            }`}>
              {/* Left section: Mode Switcher, Favorite, Privacy */}
              <div className="flex items-center gap-1 min-w-0 pointer-events-auto">
              {/* Mode Switcher */}
              <div className="inline-flex items-center bg-black/5 dark:bg-white/5 p-0.5 rounded-md border border-[var(--app-border)]">
                <button
                  onClick={() => setViewMode('doc')}
                  className={`flex items-center gap-1 px-2 py-0.5 rounded text-[11px] transition cursor-pointer ${
                    activeViewMode === 'doc'
                      ? 'bg-white dark:bg-[#2c2c2c] text-[var(--app-text-primary)] font-medium shadow-xs'
                      : 'text-[var(--app-text-muted)] hover:text-[var(--app-text-primary)]'
                  }`}
                  title="Modo Documento (Alt+S)"
                >
                  <FileText size={13} />
                  <span className="hidden sm:inline">Nota</span>
                </button>
                <button
                  onClick={() => setViewMode('canvas')}
                  className={`flex items-center gap-1 px-2 py-0.5 rounded text-[11px] transition cursor-pointer ${
                    activeViewMode === 'canvas'
                      ? 'bg-white dark:bg-[#2c2c2c] text-[var(--app-text-primary)] font-medium shadow-xs'
                      : 'text-[var(--app-text-muted)] hover:text-[var(--app-text-primary)]'
                  }`}
                  title="Modo Lienzo / Canvas"
                >
                  <Kanban size={13} />
                  <span className="hidden sm:inline">Lienzo</span>
                </button>
              </div>

              {/* Star Favorite Button */}
              <button
                onClick={handleToggleFavorite}
                className={`w-6 h-6 rounded flex items-center justify-center transition cursor-pointer ${
                  currentWorkspace?.isFavorite
                    ? 'text-amber-400 hover:text-amber-300'
                    : 'text-[var(--app-text-muted)] hover:text-[var(--app-text-primary)] hover:bg-white/5'
                }`}
                title={currentWorkspace?.isFavorite ? 'Quitar de favoritos' : 'Añadir a favoritos'}
              >
                {currentWorkspace?.isFavorite ? (
                  <Star size={14} weight="fill" />
                ) : (
                  <Star size={14} />
                )}
              </button>

              {/* Read Only Indicator for Layer 2 & Layer 3 */}
              {isCurrentWorkspaceReadOnly && (
                <div
                  className="h-6 px-2 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-500 flex items-center gap-1 text-[11px] font-medium select-none"
                  title={`Solo lectura: Creado por ${currentWorkspace?.ownerName || currentWorkspace?.createdBy || 'otro miembro'}`}
                >
                  <LockKey size={12} weight="fill" />
                  <span className="hidden sm:inline">Solo lectura</span>
                </div>
              )}

              {/* Privacy Selector Button (Pública / Privada) */}
              <button
                onClick={handleTogglePrivacy}
                disabled={!canEditCurrentPrivacy}
                className={`h-6 px-2 rounded flex items-center gap-1 text-[11px] font-normal transition select-none ${
                  !canEditCurrentPrivacy ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'
                } ${
                  currentWorkspace?.isPrivate
                    ? 'text-amber-400 hover:bg-amber-400/10'
                    : 'text-[var(--app-text-muted)] hover:text-[var(--app-text-primary)] hover:bg-white/5'
                }`}
                title={
                  !canEditCurrentPrivacy
                    ? `Privacidad gestionada por el autor original (${currentWorkspace?.ownerName || currentWorkspace?.createdBy || 'propietario'})`
                    : currentWorkspace?.isPrivate
                    ? 'Nota privada (solo tú). Clic para cambiar a pública para el equipo'
                    : 'Nota pública (visible para todo el equipo). Clic para hacerla privada'
                }
              >
                {currentWorkspace?.isPrivate ? (
                  <LockKey size={13} weight="fill" className="text-amber-400 shrink-0" />
                ) : (
                  <LockKeyOpen size={13} className="shrink-0" />
                )}
                <span className="hidden sm:inline">
                  {currentWorkspace?.isPrivate ? 'Privada' : 'Pública'}
                </span>
              </button>

              {/* Quick Scratchpad / Captura Rápida (Alt + N) */}
              <button
                onClick={() => setIsQuickCaptureOpen(true)}
                className="h-6 px-2 rounded text-[11px] text-[var(--app-text-muted)] hover:text-amber-400 hover:bg-amber-400/10 flex items-center gap-1 transition cursor-pointer"
                title="Captura Rápida (Alt + N)"
              >
                <Sparkle size={13} />
                <span className="hidden md:inline">Rápida</span>
              </button>

              {/* Info Button ⓘ */}
              <div className="relative hidden sm:block">
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    setActiveDropdown(activeDropdown === 'info' ? null : 'info')
                  }}
                  className={`w-6 h-6 rounded flex items-center justify-center transition cursor-pointer ${
                    activeDropdown === 'info'
                      ? 'bg-white/10 text-[var(--app-text-primary)]'
                      : 'text-[var(--app-text-muted)] hover:text-[var(--app-text-primary)] hover:bg-white/5'
                  }`}
                  title="Información de la nota"
                >
                  <Info size={14} />
                </button>

                {activeDropdown === 'info' && (
                  <div
                    className="fixed right-3 top-12 sm:absolute sm:left-0 sm:right-auto sm:top-10 z-50 w-[calc(100vw-24px)] max-w-[270px] sm:w-72 sm:max-w-none bg-white/95 dark:bg-[#1a1b1e]/95 border border-black/[0.08] dark:border-white/[0.1] rounded-2xl sm:rounded-3xl shadow-2xl backdrop-blur-2xl p-2.5 sm:p-4 text-[11px] sm:text-xs text-[var(--app-text-primary)] animate-in fade-in zoom-in-95 duration-100 max-h-[calc(100vh-64px)] overflow-y-auto custom-scrollbar"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="font-bold pb-1.5 sm:pb-2.5 border-b border-black/[0.06] dark:border-white/[0.08] mb-1.5 sm:mb-2.5 flex items-center justify-between">
                      <span className="text-[11px] sm:text-xs font-semibold">Estadísticas de la página</span>
                      <span className="text-[9px] sm:text-[10px] text-neutral-400 uppercase font-mono px-1.5 sm:px-2 py-0.5 rounded-full bg-black/[0.04] dark:bg-white/[0.06]">Info</span>
                    </div>
                    <div className="space-y-1 sm:space-y-2 text-[11px] sm:text-xs">
                      <div className="flex justify-between">
                        <span className="text-neutral-500">Palabras:</span>
                        <span className="font-mono font-semibold">{stats.words}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-neutral-500">Caracteres:</span>
                        <span className="font-mono font-semibold">{stats.chars}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-neutral-500">Tiempo de lectura:</span>
                        <span className="font-mono font-semibold">~{stats.time} min</span>
                      </div>
                      <div className="flex justify-between pt-1.5 sm:pt-2 border-t border-black/[0.06] dark:border-white/[0.08]">
                        <span className="text-neutral-500">Modo:</span>
                        <span className="capitalize font-semibold text-blue-500">{currentWorkspace?.viewMode}</span>
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
                  className={`w-6 h-6 rounded flex items-center justify-center transition cursor-pointer ${
                    activeDropdown === 'more'
                      ? 'bg-white/10 text-[var(--app-text-primary)]'
                      : 'text-[var(--app-text-muted)] hover:text-[var(--app-text-primary)] hover:bg-white/5'
                  }`}
                  title="Más acciones de la nota"
                >
                  <DotsThree size={16} weight="bold" />
                </button>

                {activeDropdown === 'more' && (
                  <div
                    className="fixed right-3 top-12 sm:absolute sm:left-0 sm:right-auto sm:top-10 z-50 w-[calc(100vw-24px)] max-w-[260px] sm:w-64 sm:max-w-none bg-white/95 dark:bg-[#1a1b1e]/95 border border-black/[0.08] dark:border-white/[0.1] rounded-2xl sm:rounded-3xl shadow-2xl backdrop-blur-2xl p-1.5 sm:p-2.5 text-[11px] sm:text-xs text-[var(--app-text-primary)] animate-in fade-in zoom-in-95 duration-100 space-y-0.5 max-h-[calc(100vh-64px)] overflow-y-auto custom-scrollbar"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <button
                      onClick={() => {
                        setViewMode('doc')
                        setActiveDropdown(null)
                      }}
                      className="w-full text-left px-2.5 py-1.5 sm:px-3 sm:py-2 rounded-xl sm:rounded-2xl hover:bg-black/[0.05] dark:hover:bg-white/[0.08] flex items-center gap-2 sm:gap-2.5 text-[11px] sm:text-xs font-medium transition active:scale-[0.98] cursor-pointer"
                    >
                      <FileText size={15} weight="duotone" className="shrink-0 text-neutral-700 dark:text-neutral-300" />
                      <span>Modo Página</span>
                    </button>

                    <button
                      onClick={() => {
                        setViewMode('canvas')
                        setActiveDropdown(null)
                      }}
                      className="w-full text-left px-2.5 py-1.5 sm:px-3 sm:py-2 rounded-xl sm:rounded-2xl hover:bg-black/[0.05] dark:hover:bg-white/[0.08] flex items-center gap-2 sm:gap-2.5 text-[11px] sm:text-xs font-medium transition active:scale-[0.98] cursor-pointer"
                    >
                      <Kanban size={15} weight="duotone" className="shrink-0 text-neutral-700 dark:text-neutral-300" />
                      <span>Modo Tablero (Milanote)</span>
                    </button>

                    <button
                      onClick={() => {
                        setViewMode(activeViewMode === 'split' ? 'doc' : 'split')
                        setActiveDropdown(null)
                      }}
                      className="w-full text-left px-2.5 py-1.5 sm:px-3 sm:py-2 rounded-xl sm:rounded-2xl hover:bg-black/[0.05] dark:hover:bg-white/[0.08] flex items-center gap-2 sm:gap-2.5 text-[11px] sm:text-xs font-medium transition active:scale-[0.98] cursor-pointer"
                    >
                      <Columns size={15} weight="duotone" className="shrink-0 text-neutral-700 dark:text-neutral-300" />
                      <span>{activeViewMode === 'split' ? 'Cerrar vista dividida' : 'Vista dividida'}</span>
                    </button>

                    {/* Toggle Ancho completo (Notion Full Width Style) */}
                    <button
                      onClick={async () => {
                        if (!currentWorkspace) return
                        const isCurrentFull = (currentWorkspace.pageWidth || 'full') === 'full'
                        const nextWidth = isCurrentFull ? 'standard' : 'full'
                        await db.workspaces.update(currentWorkspace.id, {
                          pageWidth: nextWidth,
                          updatedAt: Date.now(),
                          syncStatus: 'pending'
                        })
                        syncEngine.scheduleSync(500)
                        toast.success(nextWidth === 'full' ? 'Ancho completo activado' : 'Ancho estándar activado')
                        setActiveDropdown(null)
                      }}
                      className="w-full text-left px-2.5 py-1.5 sm:px-3 sm:py-2 rounded-xl sm:rounded-2xl hover:bg-black/[0.05] dark:hover:bg-white/[0.08] flex items-center justify-between text-[11px] sm:text-xs font-medium transition active:scale-[0.98] cursor-pointer"
                    >
                      <div className="flex items-center gap-2 sm:gap-2.5 truncate">
                        <ArrowsOutLineHorizontal size={15} weight="duotone" className="shrink-0 text-neutral-700 dark:text-neutral-300" />
                        <span className="truncate">Ancho completo</span>
                      </div>
                      <div
                        className={`w-7 h-4 rounded-full transition-colors p-0.5 flex items-center ${
                          (currentWorkspace?.pageWidth || 'full') === 'full'
                            ? 'bg-blue-600 justify-end'
                            : 'bg-neutral-300 dark:bg-neutral-700 justify-start'
                        }`}
                      >
                        <div className="w-3 h-3 rounded-full bg-white shadow-xs" />
                      </div>
                    </button>

                    <div className="border-t border-black/[0.06] dark:border-white/[0.08] my-0.5 sm:my-1" />

                    <button
                      onClick={() => {
                        handleTogglePrivacy()
                        setActiveDropdown(null)
                      }}
                      className={`w-full text-left px-2.5 py-1.5 sm:px-3 sm:py-2 rounded-xl sm:rounded-2xl flex items-center justify-between text-[11px] sm:text-xs font-medium transition active:scale-[0.98] cursor-pointer ${
                        currentWorkspace?.isPrivate
                          ? 'hover:bg-amber-500/10 text-amber-700 dark:text-amber-300'
                          : 'hover:bg-blue-500/10 text-blue-600 dark:text-blue-400'
                      }`}
                    >
                      <div className="flex items-center gap-2 sm:gap-2.5 truncate">
                        {currentWorkspace?.isPrivate ? (
                          <LockKey size={15} weight="fill" className="shrink-0 text-amber-600 dark:text-amber-400" />
                        ) : (
                          <LockKeyOpen size={15} weight="duotone" className="shrink-0 text-blue-600 dark:text-blue-400" />
                        )}
                        <span className="truncate">
                          {currentWorkspace?.isPrivate ? 'Nota Privada (Hacer Pública)' : 'Nota Pública (Hacer Privada)'}
                        </span>
                      </div>
                      <span className={`text-[9px] sm:text-[10px] px-1.5 sm:px-2 py-0.5 rounded-full font-semibold shrink-0 ${
                        currentWorkspace?.isPrivate
                          ? 'bg-amber-500/20 text-amber-700 dark:text-amber-300'
                          : 'bg-blue-500/15 text-blue-600 dark:text-blue-400'
                      }`}>
                        {currentWorkspace?.isPrivate ? 'Privada' : 'Pública'}
                      </span>
                    </button>

                    <div className="border-t border-black/[0.06] dark:border-white/[0.08] my-0.5 sm:my-1" />

                    <button
                      onClick={() => {
                        openSpecialViewTab('knowledge-graph', 'Vista gráfica')
                        setActiveDropdown(null)
                      }}
                      className="w-full text-left px-2.5 py-1.5 sm:px-3 sm:py-2 rounded-xl sm:rounded-2xl hover:bg-black/[0.05] dark:hover:bg-white/[0.08] flex items-center justify-between text-[11px] sm:text-xs font-medium transition active:scale-[0.98] cursor-pointer"
                    >
                      <div className="flex items-center gap-2 sm:gap-2.5 truncate">
                        <Graph size={15} weight="duotone" className="shrink-0 text-neutral-700 dark:text-neutral-300" />
                        <span className="truncate">Grafo Global</span>
                      </div>
                      <span className="text-[9px] sm:text-[10px] text-neutral-500 font-mono px-1.5 sm:px-2 py-0.5 rounded-full bg-black/[0.04] dark:bg-white/[0.06] shrink-0">Obsidian</span>
                    </button>

                    <button
                      onClick={() => {
                        setIsFindInPageOpen(true)
                        setActiveDropdown(null)
                      }}
                      className="w-full text-left px-2.5 py-1.5 sm:px-3 sm:py-2 rounded-xl sm:rounded-2xl hover:bg-black/[0.05] dark:hover:bg-white/[0.08] flex items-center justify-between text-[11px] sm:text-xs font-medium transition active:scale-[0.98] cursor-pointer"
                    >
                      <div className="flex items-center gap-2 sm:gap-2.5 truncate">
                        <MagnifyingGlass size={15} weight="duotone" className="shrink-0 text-neutral-700 dark:text-neutral-300" />
                        <span className="truncate">Buscar en página</span>
                      </div>
                      <kbd className="text-[9px] sm:text-[10px] bg-black/[0.04] dark:bg-white/[0.06] px-1.5 sm:px-2 py-0.5 rounded-full text-neutral-400 border border-black/[0.04] dark:border-white/[0.06] shrink-0">
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
                      className="w-full text-left px-2.5 py-1.5 sm:px-3 sm:py-2 rounded-xl sm:rounded-2xl hover:bg-black/[0.05] dark:hover:bg-white/[0.08] flex items-center gap-2 sm:gap-2.5 text-[11px] sm:text-xs font-medium transition active:scale-[0.98] cursor-pointer"
                    >
                      <Copy size={15} weight="duotone" className="shrink-0 text-neutral-700 dark:text-neutral-300" />
                      <span className="truncate">{copiedLink ? '¡Enlace copiado!' : 'Copiar enlace a nota'}</span>
                    </button>

                    <div className="border-t border-black/[0.06] dark:border-white/[0.08] my-0.5 sm:my-1" />

                    {/* Export suite */}
                    <div className="px-2.5 py-0.5 sm:px-3 sm:py-1 text-[9px] sm:text-[10px] font-bold text-neutral-400 uppercase tracking-wider">
                      Exportar
                    </div>

                    <button
                      onClick={() => {
                        if (currentWorkspace) exportDocumentAsMarkdown(currentWorkspace)
                        setActiveDropdown(null)
                      }}
                      className="w-full text-left px-2.5 py-1.5 sm:px-3 sm:py-2 rounded-xl sm:rounded-2xl hover:bg-black/[0.05] dark:hover:bg-white/[0.08] flex items-center gap-2 sm:gap-2.5 text-[11px] sm:text-xs font-medium transition active:scale-[0.98] cursor-pointer"
                    >
                      <DownloadSimple size={15} weight="duotone" className="shrink-0 text-neutral-700 dark:text-neutral-300" />
                      <span className="truncate">Exportar como Markdown (.md)</span>
                    </button>

                    <button
                      onClick={() => {
                        if (currentWorkspace) exportDocumentAsHtml(currentWorkspace)
                        setActiveDropdown(null)
                      }}
                      className="w-full text-left px-2.5 py-1.5 sm:px-3 sm:py-2 rounded-xl sm:rounded-2xl hover:bg-black/[0.05] dark:hover:bg-white/[0.08] flex items-center gap-2 sm:gap-2.5 text-[11px] sm:text-xs font-medium transition active:scale-[0.98] cursor-pointer"
                    >
                      <FileHtml size={15} weight="duotone" className="shrink-0 text-neutral-700 dark:text-neutral-300" />
                      <span className="truncate">Exportar como HTML (.html)</span>
                    </button>

                    <button
                      onClick={() => {
                        printDocument()
                        setActiveDropdown(null)
                      }}
                      className="w-full text-left px-2.5 py-1.5 sm:px-3 sm:py-2 rounded-xl sm:rounded-2xl hover:bg-black/[0.05] dark:hover:bg-white/[0.08] flex items-center gap-2 sm:gap-2.5 text-[11px] sm:text-xs font-medium transition active:scale-[0.98] cursor-pointer"
                    >
                      <Printer size={15} weight="duotone" className="shrink-0 text-neutral-700 dark:text-neutral-300" />
                      <span className="truncate">Imprimir / Guardar como PDF</span>
                    </button>

                    <button
                      onClick={async () => {
                        if (currentWorkspace) {
                          const nodes = await db.canvasNodes.where('workspaceId').equals(currentWorkspace.id).and((n) => !n.isDeleted).toArray()
                          exportDocumentAsJson(currentWorkspace, nodes)
                        }
                        setActiveDropdown(null)
                      }}
                      className="w-full text-left px-2.5 py-1.5 sm:px-3 sm:py-2 rounded-xl sm:rounded-2xl hover:bg-black/[0.05] dark:hover:bg-white/[0.08] flex items-center gap-2 sm:gap-2.5 text-[11px] sm:text-xs font-medium transition active:scale-[0.98] cursor-pointer"
                    >
                      <FileCode size={15} weight="duotone" className="shrink-0 text-neutral-700 dark:text-neutral-300" />
                      <span className="truncate">Exportar copia JSON (.json)</span>
                    </button>

                    <button
                      onClick={() => {
                        if (currentWorkspace) copyAsPlainText(currentWorkspace.docContent)
                        setActiveDropdown(null)
                      }}
                      className="w-full text-left px-2.5 py-1.5 sm:px-3 sm:py-2 rounded-xl sm:rounded-2xl hover:bg-black/[0.05] dark:hover:bg-white/[0.08] flex items-center gap-2 sm:gap-2.5 text-[11px] sm:text-xs font-medium transition active:scale-[0.98] cursor-pointer"
                    >
                      <Copy size={15} weight="duotone" className="shrink-0 text-neutral-700 dark:text-neutral-300" />
                      <span className="truncate">Copiar como texto plano</span>
                    </button>

                    <div className="border-t border-black/[0.06] dark:border-white/[0.08] my-0.5 sm:my-1" />

                    {/* Quick Scale controls in More Menu */}
                    <div className="px-2.5 py-0.5 sm:px-3 sm:py-1 text-[9px] sm:text-[10px] font-bold text-neutral-400 uppercase tracking-wider">
                      Escala de interfaz: {uiScale}%
                    </div>
                    <div className="flex items-center gap-1 sm:gap-1.5 px-1.5 sm:px-2 pb-0.5 sm:pb-1">
                      <button
                        onClick={() => handleStepUiScale(-1)}
                        className="flex-1 py-1 px-1.5 sm:px-2 rounded-full bg-black/[0.04] dark:bg-white/[0.06] hover:bg-black/[0.08] dark:hover:bg-white/[0.12] text-[10px] sm:text-xs font-semibold text-center transition cursor-pointer active:scale-95"
                      >
                        - Reducir
                      </button>
                      <button
                        onClick={() => {
                          setUiScale('100')
                          toast.info('Escala restablecida al 100%')
                        }}
                        className="py-1 px-2 sm:px-2.5 rounded-full bg-black/[0.04] dark:bg-white/[0.06] hover:bg-black/[0.08] dark:hover:bg-white/[0.12] text-[10px] sm:text-xs font-mono font-semibold transition cursor-pointer active:scale-95"
                      >
                        100%
                      </button>
                      <button
                        onClick={() => handleStepUiScale(1)}
                        className="flex-1 py-1 px-1.5 sm:px-2 rounded-full bg-black/[0.04] dark:bg-white/[0.06] hover:bg-black/[0.08] dark:hover:bg-white/[0.12] text-[10px] sm:text-xs font-semibold text-center transition cursor-pointer active:scale-95"
                      >
                        + Aumentar
                      </button>
                    </div>

                    <div className="border-t border-black/[0.06] dark:border-white/[0.08] my-0.5 sm:my-1" />

                    <button
                      onClick={() => {
                        setIsShortcutsOpen(true)
                        setActiveDropdown(null)
                      }}
                      className="w-full text-left px-2.5 py-1.5 sm:px-3 sm:py-2 rounded-xl sm:rounded-2xl hover:bg-black/[0.05] dark:hover:bg-white/[0.08] flex items-center justify-between text-[11px] sm:text-xs font-medium transition active:scale-[0.98] cursor-pointer"
                    >
                      <div className="flex items-center gap-2 sm:gap-2.5 truncate">
                        <Keyboard size={15} weight="duotone" className="shrink-0 text-neutral-700 dark:text-neutral-300" />
                        <span className="truncate">Atajos de teclado</span>
                      </div>
                      <kbd className="text-[9px] sm:text-[10px] bg-black/[0.04] dark:bg-white/[0.06] px-1.5 sm:px-2 py-0.5 rounded-full text-neutral-400 border border-black/[0.04] dark:border-white/[0.06] shrink-0">?</kbd>
                    </button>

                    <div className="border-t border-black/[0.06] dark:border-white/[0.08] my-0.5 sm:my-1" />

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
                      className="w-full text-left px-2.5 py-1.5 sm:px-3 sm:py-2 rounded-xl sm:rounded-2xl hover:bg-rose-500/10 text-rose-500 flex items-center gap-2 sm:gap-2.5 text-[11px] sm:text-xs font-semibold transition active:scale-[0.98] cursor-pointer"
                    >
                      <Trash size={15} weight="duotone" className="shrink-0 text-rose-500" />
                      <span className="truncate">Eliminar página</span>
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Center: Board Title (touch/click to rename) */}
            {activeViewMode === 'canvas' && (
              <div className="hidden md:flex absolute left-1/2 -translate-x-1/2 items-center justify-center pointer-events-auto z-10 max-w-[50vw]">
                {isEditingBoardTitle ? (
                  <input
                    type="text"
                    value={boardTitleInput}
                    onChange={(e) => setBoardTitleInput(e.target.value)}
                    onBlur={commitBoardTitle}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') commitBoardTitle()
                      if (e.key === 'Escape') setIsEditingBoardTitle(false)
                    }}
                    autoFocus
                    placeholder="Título del tablero..."
                    className="font-serif font-bold text-base md:text-lg text-center text-neutral-900 dark:text-neutral-100 bg-white dark:bg-[#28292d] px-4 py-1 rounded-full border border-black/15 dark:border-white/20 shadow-md outline-none min-w-[220px] max-w-full focus:ring-2 focus:ring-blue-500/50"
                  />
                ) : (
                  <button
                    onClick={startEditingBoardTitle}
                    className="group flex items-center gap-2 px-3 py-1 rounded-xl hover:bg-black/[0.05] dark:hover:bg-white/[0.08] transition cursor-pointer select-none tracking-tight text-center active:scale-95"
                    title="Toca para cambiar el nombre del tablero"
                  >
                    <span className="font-serif font-bold text-base md:text-lg text-neutral-800 dark:text-neutral-100 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition truncate max-w-[250px] md:max-w-[420px]">
                      {currentWorkspace?.title || 'Sin título'}
                    </span>
                    <PencilSimpleLine size={15} weight="duotone" className="text-neutral-400 group-hover:text-blue-500 opacity-0 group-hover:opacity-100 transition shrink-0" />
                  </button>
                )}
              </div>
            )}

            {/* Right section: Modo Focus, Presentation, Exportar, Compartir */}
            <div className="flex items-center gap-1 shrink-0 pointer-events-auto">
              {/* Focus mode toggle */}
              <button
                onClick={() => setFocusMode(true)}
                className="w-6 h-6 rounded flex items-center justify-center text-[var(--app-text-muted)] hover:text-[var(--app-text-primary)] hover:bg-white/5 transition cursor-pointer"
                title="Modo Concentración Zen (Ctrl+Shift+F)"
              >
                <ArrowsOutLineHorizontal size={14} />
              </button>

              {/* Presentation Icon */}
              <button
                onClick={() => setIsPresentationMode(true)}
                className="w-6 h-6 rounded flex items-center justify-center text-[var(--app-text-muted)] hover:text-[var(--app-text-primary)] hover:bg-white/5 transition cursor-pointer"
                title="Modo Presentación (F5)"
              >
                <Presentation size={14} />
              </button>

              {/* Exportar ⌵ Dropdown */}
              <div className="relative">
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    setActiveDropdown(activeDropdown === 'export' ? null : 'export')
                  }}
                  className={`h-6 px-2 rounded flex items-center gap-1 text-[11px] text-[var(--app-text-muted)] hover:text-[var(--app-text-primary)] hover:bg-white/5 transition cursor-pointer select-none ${
                    activeDropdown === 'export' ? 'bg-white/10 text-[var(--app-text-primary)]' : ''
                  }`}
                  title="Exportar documento o tablero"
                >
                  <DownloadSimple size={13} />
                  <span className="hidden sm:inline">Exportar</span>
                </button>

                {activeDropdown === 'export' && (
                  <div
                    className="fixed right-3 top-12 sm:absolute sm:right-0 sm:top-8 z-50 w-[calc(100vw-24px)] max-w-[240px] sm:w-56 bg-[var(--app-bg-overlay)] border border-[var(--app-border)] rounded-xl shadow-2xl p-1.5 text-xs text-[var(--app-text-primary)] animate-in fade-in zoom-in-95 space-y-0.5"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <button
                      onClick={() => {
                        if (currentWorkspace) exportDocumentAsMarkdown(currentWorkspace)
                        setActiveDropdown(null)
                      }}
                      className="w-full text-left px-2.5 py-1.5 sm:px-3 sm:py-2 rounded-xl sm:rounded-2xl hover:bg-black/[0.05] dark:hover:bg-white/[0.08] flex items-center gap-2 sm:gap-2.5 font-medium transition active:scale-[0.98] cursor-pointer"
                    >
                      <DownloadSimple size={15} weight="duotone" className="shrink-0 text-neutral-700 dark:text-neutral-300" />
                      <span className="truncate">Exportar como Markdown (.md)</span>
                    </button>
                    <button
                      onClick={() => {
                        if (currentWorkspace) exportDocumentAsHtml(currentWorkspace)
                        setActiveDropdown(null)
                      }}
                      className="w-full text-left px-2.5 py-1.5 sm:px-3 sm:py-2 rounded-xl sm:rounded-2xl hover:bg-black/[0.05] dark:hover:bg-white/[0.08] flex items-center gap-2 sm:gap-2.5 font-medium transition active:scale-[0.98] cursor-pointer"
                    >
                      <FileHtml size={15} weight="duotone" className="shrink-0 text-neutral-700 dark:text-neutral-300" />
                      <span className="truncate">Exportar como HTML (.html)</span>
                    </button>
                    <button
                      onClick={() => {
                        printDocument()
                        setActiveDropdown(null)
                      }}
                      className="w-full text-left px-2.5 py-1.5 sm:px-3 sm:py-2 rounded-xl sm:rounded-2xl hover:bg-black/[0.05] dark:hover:bg-white/[0.08] flex items-center gap-2 sm:gap-2.5 font-medium transition active:scale-[0.98] cursor-pointer"
                    >
                      <Printer size={15} weight="duotone" className="shrink-0 text-neutral-700 dark:text-neutral-300" />
                      <span className="truncate">Imprimir / Guardar como PDF</span>
                    </button>
                    <button
                      onClick={async () => {
                        if (currentWorkspace) {
                          const nodes = await db.canvasNodes.where('workspaceId').equals(currentWorkspace.id).and((n) => !n.isDeleted).toArray()
                          exportDocumentAsJson(currentWorkspace, nodes)
                        }
                        setActiveDropdown(null)
                      }}
                      className="w-full text-left px-2.5 py-1.5 sm:px-3 sm:py-2 rounded-xl sm:rounded-2xl hover:bg-black/[0.05] dark:hover:bg-white/[0.08] flex items-center gap-2 sm:gap-2.5 font-medium transition active:scale-[0.98] cursor-pointer"
                    >
                      <FileCode size={15} weight="duotone" className="shrink-0 text-neutral-700 dark:text-neutral-300" />
                      <span className="truncate">Exportar copia JSON (.json)</span>
                    </button>
                  </div>
                )}
              </div>

              {/* Compartir Button */}
              <button
                onClick={() => setIsShareOpen(true)}
                className="h-6 px-2 rounded text-[11px] text-[var(--app-text-muted)] hover:text-[var(--app-text-primary)] hover:bg-white/5 flex items-center gap-1 transition cursor-pointer select-none"
                title="Compartir con colaboradores"
              >
                <ShareNetwork size={13} />
                <span className="hidden sm:inline">Compartir</span>
              </button>
            </div>
          </header>
        )}
          {/* Find In Page Floating Search (Ctrl+F) */}
          <FindInPage
            isOpen={isFindInPageOpen}
            onClose={() => setIsFindInPageOpen(false)}
          />

          <Suspense fallback={
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-neutral-400 dark:text-neutral-500 text-xs animate-pulse gap-2">
              <div className="w-8 h-8 rounded-xl bg-black/[0.04] dark:bg-white/[0.06] animate-spin" />
              <span>Cargando vista...</span>
            </div>
          }>
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
                    syncStatus: 'pending',
                    ownerMember: currentMember.id,
                    ownerName: currentMember.name,
                    createdBy: currentMember.name,
                    userId: authUser?.id || undefined,
                    viewedBy: [currentMember.id, currentMember.fullName || currentMember.name, currentMember.email, authUser?.id].filter(Boolean) as string[],
                    isNewItem: true
                  })
                  selectWorkspaceWithTab(newId)
                }}
                onToggleFavorite={async (e, ws) => {
                  e.stopPropagation()
                  await db.workspaces.update(ws.id, { isFavorite: !ws.isFavorite })
                }}
                onDeleteWorkspace={async (e, id) => {
                  e.stopPropagation()
                  const target = workspaces.find((w) => w.id === id)
                  if (!canUserDeleteWorkspace(target, currentMember, authUser?.id)) {
                    toast.error('Solo el autor o un administrador pueden eliminar esta nota.')
                    return
                  }
                  await db.workspaces.update(id, { isDeleted: true, updatedAt: Date.now(), syncStatus: 'pending' })
                  syncEngine.scheduleSync(500)
                }}
              />
            ) : activeTab?.viewType === 'knowledge-graph' ? (
              <KnowledgeGraphPage
                workspaces={currentSpaceWorkspaces}
                currentWorkspaceId={currentWorkspace?.id}
                onSelectWorkspace={(id) => selectWorkspaceWithTab(id)}
                onCreateWorkspace={async (title) => {
                  const newId = crypto.randomUUID()
                  const now = Date.now()
                  const newWs: WorkspaceItem = {
                    id: newId,
                    parentId: null,
                    spaceId: currentSpaceId,
                    title: title || 'Sin título',
                    icon: '',
                    color: '#1e96eb',
                    viewMode: 'doc',
                    docContent: '<p></p>',
                    createdAt: now,
                    updatedAt: now,
                    isFavorite: false,
                    isDeleted: false,
                    syncStatus: 'pending',
                    ownerMember: currentMember.id,
                    ownerName: currentMember.name,
                    createdBy: currentMember.name,
                    userId: authUser?.id || undefined,
                    viewedBy: [currentMember.id, currentMember.fullName || currentMember.name, currentMember.email, authUser?.id].filter(Boolean) as string[],
                    isNewItem: true
                  }
                  await db.workspaces.add(newWs)
                  setOptimisticWorkspace(newWs)
                  selectWorkspaceWithTab(newId)
                }}
                onBack={() => {
                  const currentIndex = tabs.findIndex((t) => t.id === activeTabId)
                  if (currentIndex > 0) {
                    setActiveTabId(tabs[currentIndex - 1].id)
                  }
                }}
                onForward={() => {
                  const currentIndex = tabs.findIndex((t) => t.id === activeTabId)
                  if (currentIndex >= 0 && currentIndex < tabs.length - 1) {
                    setActiveTabId(tabs[currentIndex + 1].id)
                  }
                }}
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
            ) : currentWorkspace ? (
              activeViewMode === 'doc' ? (
                <div className="flex-1 h-full overflow-hidden">
                  <DocEditor
                    workspace={currentWorkspace}
                    allWorkspaces={publicWorkspaces}
                    spaces={spaces}
                    onSelectWorkspace={(id) => selectWorkspaceWithTab(id)}
                    onTitleChange={isCurrentWorkspaceReadOnly ? undefined : handleTitleChange}
                    onToggleViewMode={() => setViewMode('canvas')}
                    onOpenTemplatesModal={() => setIsTemplatesOpen(true)}
                    readOnly={isCurrentWorkspaceReadOnly}
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
                    readOnly={isCurrentWorkspaceReadOnly}
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
                      allWorkspaces={publicWorkspaces}
                      spaces={spaces}
                      onSelectWorkspace={(id) => selectWorkspaceWithTab(id)}
                      onTitleChange={isCurrentWorkspaceReadOnly ? undefined : handleTitleChange}
                      onToggleViewMode={() => setViewMode('canvas')}
                      onOpenTemplatesModal={() => setIsTemplatesOpen(true)}
                      readOnly={isCurrentWorkspaceReadOnly}
                    />
                  </div>
                  <div className="w-1/2 h-full overflow-hidden">
                    <CanvasBoard
                      workspaceId={currentWorkspace.id}
                      currentWorkspace={currentWorkspace}
                      onSwitchToDoc={handleSwitchToDoc}
                      darkMode={darkMode}
                      readOnly={isCurrentWorkspaceReadOnly}
                    />
                  </div>
                </div>
              )
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center p-6 text-center text-zinc-500 text-sm gap-3 select-none">
                <div className="w-12 h-12 rounded-2xl bg-black/[0.04] dark:bg-white/[0.06] flex items-center justify-center text-2xl shadow-xs">
                  📝
                </div>
                <div className="font-semibold text-neutral-800 dark:text-neutral-200">
                  Selecciona o crea una página para comenzar
                </div>
                <p className="text-xs text-neutral-400 max-w-xs">
                  Abre la barra lateral para ver todos tus espacios de trabajo y notas sincronizadas.
                </p>
                <div className="flex items-center gap-2 pt-2">
                  <button
                    onClick={() => setSidebarOpen(true)}
                    className="px-4 py-2 rounded-xl bg-blue-600 text-white font-medium text-xs hover:bg-blue-700 active:scale-95 transition shadow-sm cursor-pointer flex items-center gap-1.5"
                  >
                    <SidebarSimple size={16} weight="duotone" />
                    <span>Ver espacios y notas</span>
                  </button>
                </div>
              </div>
            )}
          </Suspense>
        </main>
      </div>

      {/* 3. Right Sidebar (Propiedades, Outline, Historial) */}
      {rightSidebarOpen && !isPresentationMode && activeViewMode === 'doc' && (
        <RightSidebar
          workspace={currentWorkspace}
          isOpen={rightSidebarOpen}
          onClose={() => setRightSidebarOpen(false)}
          activeTab={rightSidebarTab}
          onTabChange={(tab) => setRightSidebarTab(tab)}
          onScrollToHeading={handleScrollToHeading}
          readOnly={isCurrentWorkspaceReadOnly}
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
            syncStatus: 'pending',
            ownerMember: currentMember.id,
            ownerName: currentMember.name,
            createdBy: currentMember.name,
            userId: authUser?.id || undefined,
            viewedBy: [currentMember.id, currentMember.fullName || currentMember.name, currentMember.email, authUser?.id].filter(Boolean) as string[],
            isNewItem: true
          })
          selectWorkspaceWithTab(newId)
          toast.success('Página creada')
        }}
        onToggleViewMode={() => setViewMode(activeViewMode === 'canvas' ? 'doc' : 'canvas')}
      />

      <Suspense fallback={null}>
        <SettingsModal
          isOpen={isSettingsOpen}
          onClose={() => setIsSettingsOpen(false)}
          syncStatus={syncStatus}
          uiScale={uiScale}
          onUiScaleChange={setUiScale}
        />

        <AuthModal
          isOpen={isAuthModalOpen}
          initialMode={authModalMode}
          onClose={() => setIsAuthModalOpen(false)}
          onAuthSuccess={(member) => {
            setCurrentMemberState(member)
            syncEngine.resetLastSyncTime()
            syncEngine.triggerSync()
          }}
        />

        <UserProfileModal
          isOpen={isProfileModalOpen}
          onClose={() => setIsProfileModalOpen(false)}
          currentMember={currentMember}
          onProfileUpdated={(updated) => {
            setCurrentMemberState(updated)
          }}
          onSignOut={handleSignOut}
        />

        <UserManagementModal
          isOpen={isUserManagementModalOpen}
          onClose={() => setIsUserManagementModalOpen(false)}
          currentUserId={currentMember.id}
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

        <QuickCaptureModal
          isOpen={isQuickCaptureOpen}
          onClose={() => setIsQuickCaptureOpen(false)}
          currentWorkspaceId={currentWorkspace?.id}
        />

        {/* 5. AFFiNE Fullscreen Presentation Mode Player */}
        {isPresentationMode && (
          <PresentationViewer
            isOpen={isPresentationMode}
            onClose={() => {
              setIsPresentationMode(false)
              setPresentationFrameId(undefined)
            }}
            workspace={currentWorkspace}
            initialFrameId={presentationFrameId}
          />
        )}
      </Suspense>

      {/* 6. Pro Sonner Notification Toaster */}
      <Toaster richColors position="bottom-right" closeButton theme={darkMode ? 'dark' : 'light'} />
    </div>
  )
}

export default function App() {
  const urlParams = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null
  const externalShareId = urlParams?.get('share')
  const externalToken = urlParams?.get('token')

  if (externalShareId && externalToken) {
    return (
      <Suspense fallback={<div className="h-screen w-screen flex items-center justify-center p-8 text-neutral-400 text-xs">Cargando nota compartida...</div>}>
        <ExternalShareView workspaceId={externalShareId} token={externalToken} />
      </Suspense>
    )
  }

  return <MainApp />
}

