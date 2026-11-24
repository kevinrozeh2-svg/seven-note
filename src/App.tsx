import { Component, useState, useEffect, useCallback, useMemo, useRef, lazy, Suspense, type ReactNode } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { AnimatePresence, motion, MotionConfig } from 'motion/react'
import {
  FileText,
  Kanban,
  SidebarSimple,
  Columns,
  Star,
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
  moveSpaceToTrash,
  getSafeTimestamp
} from './db'
import { markItemAsRead } from './lib/unreadTracker'
import { recordDocumentRead } from './lib/documentReads'
import { DocumentReadersBadge } from './components/ui/DocumentReadersBadge'
import { syncEngine, type SyncEngineStatus } from './lib/syncEngine'
import { ObsidianRibbon } from './components/sidebar/ObsidianRibbon'
import { Sidebar } from './components/sidebar/Sidebar'
import { RightSidebar } from './components/sidebar/RightSidebar'
import { CommandPalette } from './components/modals/CommandPalette'
import { initTauriUpdater } from './lib/tauriUpdater'
import {
  subscribeToWebUpdate,
  applyWebUpdate,
  showUpdateAvailableToast
} from './lib/pwaUpdater'
import { FindInPage } from './components/search/FindInPage'
import { type WorkbenchTab } from './components/tabs/WorkbenchTabs'
const ExternalShareView = lazy(() => import('./components/views/ExternalShareView').then(m => ({ default: m.ExternalShareView })))
const CalendarPage = lazy(() => import('./components/views/CalendarPage').then(m => ({ default: m.CalendarPage })))
import { type AppTemplate, resolveTemplateContent } from './lib/templates'
import {
  initTeamProfilesRealtime,
  refreshTeamProfiles,
  cleanupTeamProfilesRealtime
} from './lib/teamProfiles'
import {
  getCurrentMember,
  setCurrentMember,
  clearCurrentMember,
  subscribeToMemberChanges,
  mapSupabaseUserToMember,
  type TeamMember,
  isWorkspaceVisible,
  isSpaceVisible,
  isUserAdmin,
  canUserEditWorkspace,
  canUserDeleteWorkspace,
  canUserTogglePrivacy,
  canUserManageSpace
} from './lib/teamAuth'
import { getAuthUser, onAuthChange, signOutUser, fetchUserProfile, isSupabaseConfigured } from './lib/supabase'
import {
  exportDocumentAsMarkdown,
  exportDocumentAsHtml,
  exportDocumentAsJson,
  copyAsPlainText,
  printDocument
} from './lib/exportUtils'
import { toast } from './lib/toast'
import { AppToaster } from './components/ui/AppToaster'
import { NotificationCenter } from './components/notifications/NotificationCenter'
import {
  notificationService,
  NOTIFICATION_ACTION_EVENT,
  NOTIFICATION_CHANGED_EVENT,
  partitionMemberNotifications,
  type NotificationPreferences
} from './lib/notificationService'
import { type NotificationActionPayload } from './db'
import { useAppStore } from './store/useAppStore'
import {
  type AppThemeId,
  getInitialThemeId,
  getThemeById,
  getToggledThemeId,
  applyAppTheme
} from './lib/themes'
import {
  type EditorPreferences,
  getEditorPreferences,
  applyEditorPreferences,
  subscribeEditorPreferences
} from './lib/editorPreferences'

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
const ManageSpacesModal = lazy(() => import('./components/modals/ManageSpacesModal').then(m => ({ default: m.ManageSpacesModal })))
const AuthModal = lazy(() => import('./components/modals/AuthModal').then(m => ({ default: m.AuthModal })))
const UserProfileModal = lazy(() => import('./components/modals/UserProfileModal').then(m => ({ default: m.UserProfileModal })))
const UserManagementModal = lazy(() => import('./components/modals/UserManagementModal').then(m => ({ default: m.UserManagementModal })))
const QuickCaptureModal = lazy(() => import('./components/modals/QuickCaptureModal').then(m => ({ default: m.QuickCaptureModal })))


function MainApp() {

  // Miembro activo del equipo
  const [currentMember, setCurrentMemberState] = useState<TeamMember>(() => getCurrentMember())
  const [authUser, setAuthUser] = useState<any>(null)
  const [authLoading, setAuthLoading] = useState(true)
  const [webUpdateAvailable, setWebUpdateAvailable] = useState(false)
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false)
  const [authModalMode, setAuthModalMode] = useState<AuthMode>('login')
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false)
  const [isUserManagementModalOpen, setIsUserManagementModalOpen] = useState(false)
  const isNotificationCenterOpen = useAppStore((s) => s.isNotificationCenterOpen)
  const setNotificationCenterOpen = useAppStore((s) => s.setNotificationCenterOpen)
  const toggleNotificationCenter = useAppStore((s) => s.toggleNotificationCenter)
  const [notifPrefs, setNotifPrefs] = useState<NotificationPreferences>(() =>
    notificationService.getPreferences()
  )
  const [notifTick, setNotifTick] = useState(0)

  useEffect(() => {
    return notificationService.subscribeToPreferences(setNotifPrefs)
  }, [])

  useEffect(() => {
    const bump = () => setNotifTick((t) => t + 1)
    window.addEventListener(NOTIFICATION_CHANGED_EVENT, bump)
    const interval = setInterval(bump, 60_000)
    return () => {
      window.removeEventListener(NOTIFICATION_CHANGED_EVENT, bump)
      clearInterval(interval)
    }
  }, [])

  const unreadNotificationsCount =
    useLiveQuery(async () => {
      const [rows, wsRows] = await Promise.all([
        db.notifications.orderBy('createdAt').reverse().toArray(),
        db.workspaces.toArray()
      ])
      const wsMap = new Map(wsRows.map((w) => [w.id, w]))
      const { active } = partitionMemberNotifications(
        rows,
        wsMap,
        currentMember,
        authUser?.id,
        Date.now()
      )
      return active.filter((n) => !n.isRead).length
    }, [currentMember, authUser?.id, notifTick]) || 0

  useEffect(() => {
    if (!authUser) return
    notificationService.startSchedulers()
    return () => notificationService.stopSchedulers()
  }, [authUser])

  useEffect(() => {
    return subscribeToWebUpdate(setWebUpdateAvailable)
  }, [])

  useEffect(() => {
    if (!authLoading && webUpdateAvailable) {
      showUpdateAvailableToast()
    }
  }, [authLoading, webUpdateAvailable])

  const lastAuthUserIdRef = useRef<string | null>(null)

  // Sincronizar sesión activa de Supabase Auth
  useEffect(() => {
    initTauriUpdater()
    // Detectar si el usuario llega con un token de recuperación de contraseña (#type=recovery)
    if (typeof window !== 'undefined' && window.location.hash.includes('type=recovery')) {
      setAuthModalMode('reset')
      setIsAuthModalOpen(true)
    }

    let isMounted = true

    const hydrateAuthenticatedUser = async (
      user: any,
      options: { resetSync?: boolean } = {}
    ) => {
      if (!isMounted || !user) return
      const profile = await fetchUserProfile(user.id)
      if (!isMounted || lastAuthUserIdRef.current !== user.id) return
      const mapped = mapSupabaseUserToMember(user, profile)
      setCurrentMember(mapped)
      setCurrentMemberState(mapped)
      if (options.resetSync) {
        syncEngine.resetLastSyncTime()
      }
      syncEngine.initRealtimeSubscription()
      syncEngine.triggerSync()
    }

    // 1. Comprobar usuario ya autenticado
    getAuthUser().then((user) => {
      if (!isMounted) return
      if (user) {
        const alreadyHydrated = lastAuthUserIdRef.current === user.id
        lastAuthUserIdRef.current = user.id
        setAuthUser((prev: any) => (prev?.id === user.id ? prev : user))
        if (!alreadyHydrated) {
          void hydrateAuthenticatedUser(user)
        }
      }
      setAuthLoading(false)
    }).catch(() => {
      if (isMounted) setAuthLoading(false)
    })

    // 2. Suscribirse a cambios de sesión (Login, Logout, Token refresh, Recovery)
    const unsubAuth = onAuthChange((event, session) => {
      if (!isMounted) return

      if (event === 'PASSWORD_RECOVERY') {
        setAuthModalMode('reset')
        setIsAuthModalOpen(true)
      }

      const user = session?.user || null

      // En TOKEN_REFRESHED para el mismo usuario, el JWT ya se rotó en segundo plano:
      // no re-hidratar perfil ni reiniciar realtime/sync (evita bucles y peticiones redundantes)
      if (event === 'TOKEN_REFRESHED' && user && lastAuthUserIdRef.current === user.id) {
        setAuthLoading(false)
        return
      }

      if (user) {
        const previousUserId = lastAuthUserIdRef.current
        const isDifferentUser = Boolean(previousUserId && previousUserId !== user.id)
        const isFreshSignIn = event === 'SIGNED_IN' && previousUserId !== user.id
        const shouldHydrate = previousUserId !== user.id || event === 'USER_UPDATED'

        lastAuthUserIdRef.current = user.id
        setAuthUser((prev: any) => (prev?.id === user.id && event !== 'USER_UPDATED' ? prev : user))

        if (shouldHydrate) {
          window.setTimeout(() => {
            void hydrateAuthenticatedUser(user, { resetSync: isDifferentUser || isFreshSignIn })
          }, 0)
        }
        initTeamProfilesRealtime()
        void refreshTeamProfiles(true)
      } else {
        lastAuthUserIdRef.current = null
        setAuthUser(null)
        syncEngine.stopRealtimeSubscription()
        cleanupTeamProfilesRealtime()
      }
      setAuthLoading(false)
    })

    // 3. Suscribirse a cambios de miembro local
    const unsubMember = subscribeToMemberChanges((m) => {
      setCurrentMemberState(m)
    })

    return () => {
      isMounted = false
      unsubAuth()
      unsubMember()
      syncEngine.stopRealtimeSubscription()
    }
  }, [])

  const handleSelectMember = (memberId: string) => {
    const m = setCurrentMember(memberId)
    setCurrentMemberState(m)
    toast.info(`Perfil activo: ${m.name}`)
  }

  const handleSignOut = async () => {
    lastAuthUserIdRef.current = null
    syncEngine.abortForSignOut()
    cleanupTeamProfilesRealtime()
    await signOutUser()
    await clearLocalUserData()
    clearCurrentMember()
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
  const [themeId, setThemeId] = useState<AppThemeId>(() => getInitialThemeId())
  const darkMode = getThemeById(themeId).mode === 'dark'
  const handleToggleDarkMode = () => {
    setThemeId((prev) => getToggledThemeId(prev))
  }

  const [editorPrefs, setEditorPrefs] = useState<EditorPreferences>(() => getEditorPreferences())

  useEffect(() => {
    applyEditorPreferences(editorPrefs)
    return subscribeEditorPreferences(setEditorPrefs)
  }, [])

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
  const spacesRaw = useLiveQuery(() => db.spaces.toArray())
  const workspacesRaw = useLiveQuery(() => db.workspaces.toArray())
  const isDbHydrating = spacesRaw === undefined || workspacesRaw === undefined
  const spaces = spacesRaw ?? []
  const workspaces = workspacesRaw ?? []
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
  const [isManageSpacesOpen, setIsManageSpacesOpen] = useState(false)

  // Modals state
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)
  const [isSearchOpen, setIsSearchOpen] = useState(false)
  const [isShareOpen, setIsShareOpen] = useState(false)
  const [isTemplatesOpen, setIsTemplatesOpen] = useState(false)
  const [isImportOpen, setIsImportOpen] = useState(false)
  const [isShortcutsOpen, setIsShortcutsOpen] = useState(false)
  const [isFindInPageOpen, setIsFindInPageOpen] = useState(false)
  const [isQuickCaptureOpen, setIsQuickCaptureOpen] = useState(false)

  const [activeDropdown, setActiveDropdown] = useState<'info' | 'more' | 'export' | 'readers' | 'privacy' | null>(null)
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

  // Keep refs for event listeners so they don't capture stale closures
  const tabsRef = useRef(tabs)
  tabsRef.current = tabs
  const activeTabIdRef = useRef(activeTabId)
  activeTabIdRef.current = activeTabId

  // Persist tabs and active tab
  useEffect(() => {
    localStorage.setItem('seven_note_workbench_tabs', JSON.stringify(tabs))
  }, [tabs])

  useEffect(() => {
    localStorage.setItem('seven_note_workbench_active_tab', activeTabId)
  }, [activeTabId])

  // Mark currently open note and space as read for the active member
  useEffect(() => {
    const currentTab = tabsRef.current.find((t) => t.id === activeTabId)
    const isSpecialView = Boolean(currentTab?.viewType && currentTab.viewType !== 'doc')
    if (currentWorkspaceId && !isSpecialView) {
      markItemAsRead(currentWorkspaceId, 'workspace', currentMember, authUser?.id)
      void recordDocumentRead(currentWorkspaceId, currentMember, authUser?.id)
    }
    if (currentSpaceId) {
      markItemAsRead(currentSpaceId, 'space', currentMember, authUser?.id)
    }
  }, [currentWorkspaceId, currentSpaceId, activeTabId, currentMember, authUser?.id])

  // Synchronize and deduplicate tabs whenever workspaces are loaded or changed
  useEffect(() => {
    if (isDbHydrating || workspaces.length === 0) return
    const canPruneMissingTabs = !isSupabaseConfigured() || syncEngine.hasCompletedInitialSync()

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
          const ws = workspaces.find((w) => w.id === t.workspaceId)
          if (!ws) {
            if (canPruneMissingTabs) {
              changed = true
              continue
            }
            sanitized.push(t)
            continue
          }
          if (ws.isDeleted) {
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
  }, [workspaces, isDbHydrating])

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
    markItemAsRead(wsId, 'workspace', currentMember, authUser?.id)
    void recordDocumentRead(wsId, currentMember, authUser?.id)

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

  useEffect(() => {
    const handleNotificationAction = (e: Event) => {
      const detail = (e as CustomEvent<{ payload?: NotificationActionPayload }>).detail
      const payload = detail?.payload
      if (!payload) return

      if (payload.type === 'open_notifications') {
        setNotificationCenterOpen(true)
      } else if (payload.type === 'open_workspace' && payload.workspaceId) {
        void (async () => {
          const targetWs = await db.workspaces.get(payload.workspaceId!)
          if (!targetWs || targetWs.isDeleted) {
            toast.error('Esta nota fue eliminada o movida a la papelera')
            return
          }
          await selectWorkspaceWithTab(
            payload.workspaceId!,
            payload.spaceId || targetWs.spaceId,
            targetWs
          )
          if (payload.nodeId && targetWs.viewMode === 'doc') {
            const canSyncMode = canUserEditWorkspace(targetWs, currentMember, authUser?.id)
            await db.workspaces.update(targetWs.id, {
              viewMode: 'canvas',
              documentMode: 'Sin bordes',
              ...(canSyncMode
                ? { updatedAt: Date.now(), syncStatus: 'pending' as const }
                : { syncStatus: targetWs.syncStatus || 'synced' })
            })
            if (canSyncMode) {
              syncEngine.scheduleSync(1000)
            }
          }
        })()
      } else if (payload.type === 'open_settings') {
        setIsSettingsOpen(true)
      } else if (payload.type === 'retry_sync') {
        void syncEngine.triggerSync()
      } else if (payload.type === 'apply_update') {
        void applyWebUpdate()
      }
    }
    window.addEventListener(NOTIFICATION_ACTION_EVENT, handleNotificationAction)

    const handleSwMessage = (event: MessageEvent) => {
      if (event.data?.type === 'SEVEN_NOTE_PUSH_NAVIGATE' && event.data?.workspaceId) {
        void selectWorkspaceWithTab(event.data.workspaceId)
      }
    }
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.addEventListener('message', handleSwMessage)
    }

    return () => {
      window.removeEventListener(NOTIFICATION_ACTION_EVENT, handleNotificationAction)
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.removeEventListener('message', handleSwMessage)
      }
    }
  }, [currentSpaceId, effectiveWorkspaces, currentMember, authUser?.id])

  const openSpecialViewTab = (
    viewType: 'all-docs' | 'knowledge-graph' | 'calendar' | 'trash' | 'templates',
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

  const handleDeleteWorkspaceWithUndo = async (targetWs: WorkspaceItem) => {
    if (!canUserDeleteWorkspace(targetWs, currentMember, authUser?.id)) {
      toast.error('Solo el autor o un administrador pueden eliminar esta nota.')
      return
    }
    await db.workspaces.update(targetWs.id, {
      isDeleted: true,
      trashedFolder: undefined,
      trashedWithSpaceId: undefined,
      updatedAt: getSafeTimestamp(targetWs.updatedAt),
      syncStatus: 'pending'
    })
    const children = workspaces.filter((w) => w.parentId === targetWs.id && !w.isDeleted)
    const promotedChildIds: string[] = []
    for (const child of children) {
      if (canUserEditWorkspace(child, currentMember, authUser?.id)) {
        promotedChildIds.push(child.id)
        await db.workspaces.update(child.id, {
          parentId: targetWs.parentId || null,
          folder: child.folder || targetWs.folder || null,
          updatedAt: getSafeTimestamp(child.updatedAt),
          syncStatus: 'pending'
        })
      }
    }
    syncEngine.scheduleSync(50)
    toast('Nota movida a la papelera', {
      description: targetWs.title || 'Sin título',
      duration: 6000,
      action: {
        label: 'Deshacer',
        onClick: () => {
          void (async () => {
            await db.workspaces.update(targetWs.id, {
              isDeleted: false,
              updatedAt: Date.now(),
              syncStatus: 'pending'
            })
            for (const cid of promotedChildIds) {
              await db.workspaces.update(cid, {
                parentId: targetWs.id,
                updatedAt: Date.now(),
                syncStatus: 'pending'
              })
            }
            syncEngine.scheduleSync(50)
            toast.success('Nota restaurada')
          })()
        }
      }
    })
  }

  const handleNewTab = async () => {
    if (typeof window !== 'undefined' && window.innerWidth < 768) {
      setSidebarOpen(false)
    }
    const newId = crypto.randomUUID()
    const now = Date.now()
    const newWs: WorkspaceItem = {
      id: newId,
      parentId: null,
      spaceId: currentSpaceId,
      title: 'Sin título',
      icon: '',
      color: '#7c3aed',
      viewMode: editorPrefs.defaultViewMode,
      pageWidth: editorPrefs.defaultPageWidth,
      isPrivate: editorPrefs.defaultPrivate,
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
    syncEngine.scheduleSync(500)
    setOptimisticWorkspace(newWs)
    const newTab: WorkbenchTab = {
      id: `tab-${crypto.randomUUID()}`,
      workspaceId: newId,
      viewType: 'doc',
      title: 'Sin título',
      icon: '',
      spaceId: currentSpaceId,
      pinned: false
    }
    setTabs((prev) => [...prev, newTab])
    setActiveTabId(newTab.id)
    setCurrentWorkspaceId(newId)
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
  const isWorkspacesLoading =
    isDbHydrating || (Boolean(authUser) && workspaces.length === 0 && syncStatus.state === 'syncing')

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

      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'n') {
        e.preventDefault()
        toggleNotificationCenter()
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
      } else if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === '\\' || e.key === '|' || e.code === 'Backslash')) {
        e.preventDefault()
        setRightSidebarOpen((prev) => !prev)
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

  // Apply selected color theme and dark/light mode class on document
  useEffect(() => {
    applyAppTheme(themeId)
  }, [themeId])

  // Filter visible spaces for current member (Strict privacy & Admin-only spaces) and sort by custom sortOrder
  const visibleSpaces = useMemo(() => {
    return spaces
      .filter((s: SpaceItem) => !s.isDeleted && isSpaceVisible(s, currentMember, authUser?.id))
      .sort((a, b) => {
        const orderA = typeof a.sortOrder === 'number' ? a.sortOrder : (a.createdAt || 0)
        const orderB = typeof b.sortOrder === 'number' ? b.sortOrder : (b.createdAt || 0)
        return orderA - orderB
      })
  }, [spaces, currentMember, authUser?.id])

  // Keep currentSpaceId in sync with visible spaces and auto-select space with content
  useEffect(() => {
    if (visibleSpaces.length === 0) return

    const hasCurrentSpace = visibleSpaces.some((s: SpaceItem) => s.id === currentSpaceId)
    // El espacio actual es válido: nunca redirigir (p. ej. al borrar notas o carpetas).
    if (hasCurrentSpace) return

    const savedSpaceId = localStorage.getItem('seven_note_active_space_id')
    if (savedSpaceId && visibleSpaces.some((s) => s.id === savedSpaceId)) {
      setCurrentSpaceId(savedSpaceId)
      return
    }

    // Solo si el espacio actual ya no existe, cambiamos a otro disponible.
    if (!hasCurrentSpace) {
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
        }).catch(() => {
          if (isMounted) {
            const first = activeWorkspaces[0]
            setCurrentWorkspaceId(first.id)
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

    const dbSpacePages = await db.workspaces
      .where('spaceId')
      .equals(spaceId)
      .toArray()
    const targetSpacePages = dbSpacePages.filter(
      (w) => !w.isDeleted && isWorkspaceVisible(w, currentMember, authUser?.id)
    )
    if (targetSpacePages.length > 0) {
      setCurrentWorkspaceId(targetSpacePages[0].id)
      markItemAsRead(targetSpacePages[0].id, 'workspace', currentMember, authUser?.id)
    } else if (isSupabaseConfigured() && !syncEngine.hasCompletedInitialSync()) {
      void syncEngine.triggerSync()
    } else if (!isSupabaseConfigured() || syncEngine.hasCompletedInitialSync()) {
      // Solo crear página inicial si la sincronización inicial ya terminó y el espacio realmente no tiene páginas
      if (dbSpacePages.length > 0) return
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
      syncEngine.scheduleSync(500)
      setCurrentWorkspaceId(newPageId)
    }
  }

  const handleCreateSpace = async (
    name: string,
    icon: string,
    color: string,
    isPrivate: boolean = false,
    adminOnly: boolean = false
  ) => {
    const effectiveAdminOnly = isUserAdmin(currentMember) ? (!isPrivate && adminOnly) : false
    const { space, initialPageId } = await createSpace(
      name,
      icon,
      color,
      isPrivate,
      currentMember.id,
      currentMember.fullName || currentMember.name,
      authUser?.id,
      effectiveAdminOnly
    )
    setCurrentSpaceId(space.id)
    localStorage.setItem('seven_note_active_space_id', space.id)
    setCurrentWorkspaceId(initialPageId)
    syncEngine.scheduleSync(50)
    toast.success(
      isPrivate
        ? `Espacio privado "${space.name}" creado (solo visible para ti)`
        : effectiveAdminOnly
          ? `Espacio "${space.name}" creado (solo visible para administradores)`
          : `Espacio "${space.name}" creado`
    )
  }

  const handleUpdateSpace = async (
    id: string,
    updates: Partial<Pick<SpaceItem, 'name' | 'icon' | 'color' | 'isPrivate' | 'adminOnly'>>
  ) => {
    const sp = spaces.find((s) => s.id === id)
    if (sp && !canUserManageSpace(sp, currentMember, authUser?.id)) {
      toast.error('Solo el creador o un administrador pueden editar este espacio.')
      return
    }
    const safeUpdates = { ...updates }
    if (!isUserAdmin(currentMember)) {
      delete safeUpdates.adminOnly
    }
    await updateSpace(id, safeUpdates)
    syncEngine.scheduleSync(50)
    toast.success('Espacio actualizado')
  }

  const handleReorderSpaces = async (orderedSpaceIds: string[]) => {
    await Promise.all(
      orderedSpaceIds.map((id, idx) => {
        const sp = spaces.find((s) => s.id === id)
        return db.spaces.update(id, {
          sortOrder: (idx + 1) * 1000,
          updatedAt: getSafeTimestamp(sp?.updatedAt),
          syncStatus: 'pending'
        })
      })
    )
    syncEngine.scheduleSync(50)
  }

  const handleRenameSpace = async (id: string, newName: string) => {
    const sp = spaces.find((s) => s.id === id)
    if (sp && !canUserManageSpace(sp, currentMember, authUser?.id)) {
      toast.error('Solo el creador o un administrador pueden renombrar este espacio.')
      return
    }
    await updateSpace(id, { name: newName })
    syncEngine.scheduleSync(50)
  }

  const handleDeleteSpace = async (id: string) => {
    const sp = spaces.find((s) => s.id === id)
    if (!canUserManageSpace(sp, currentMember, authUser?.id)) {
      toast.error('Solo el creador o un administrador pueden eliminar este espacio.')
      return
    }
    const remaining = spaces.filter(
      (s) => s.id !== id && !s.isDeleted && isSpaceVisible(s, currentMember, authUser?.id)
    )
    if (remaining.length === 0) {
      toast.error('Debes mantener al menos un espacio activo.')
      return
    }
    if (!confirm(`¿Mover el espacio "${sp?.name || 'Espacio'}" y sus notas a la papelera?`)) {
      return
    }
    await moveSpaceToTrash(id)
    setTabs((prev) => prev.filter((t) => t.spaceId !== id))
    syncEngine.scheduleSync(50)
    await handleSelectSpace(remaining[0].id)
    toast.success('Espacio movido a la papelera')
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
      const canSync = canUserEditWorkspace(currentWorkspace, currentMember, authUser?.id)
      await db.workspaces.update(currentWorkspace.id, {
        isFavorite: !currentWorkspace.isFavorite,
        ...(canSync
          ? { updatedAt: Date.now(), syncStatus: 'pending' as const }
          : { syncStatus: currentWorkspace.syncStatus || 'synced' })
      })
      if (canSync) syncEngine.scheduleSync(1000)
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
        title: currentWorkspace.title === 'Untitled' || currentWorkspace.title === 'Sin título' ? template.title : currentWorkspace.title,
        icon: template.icon,
        docContent: resolveTemplateContent(template.docContent),
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

    toast.success(`Plantilla "${template.title}" aplicada.`)
    syncEngine.scheduleSync(1000)
  }

  // Create a brand new workspace populated with the chosen template
  const handleCreateFromTemplate = async (template: AppTemplate) => {
    const newId = crypto.randomUUID()
    const now = Date.now()
    const isCanvas = template.type === 'canvas'

    const newWs: WorkspaceItem = {
      id: newId,
      parentId: null,
      spaceId: currentSpaceId,
      title: template.title,
      icon: template.icon || '',
      color: '#7c3aed',
      viewMode: isCanvas ? 'canvas' : 'doc',
      docContent: isCanvas ? '<p></p>' : resolveTemplateContent(template.docContent),
      templateName: template.title,
      hasCover: template.hasCover,
      coverType: template.coverType,
      coverBannerTitle: template.coverBannerTitle,
      coverBannerSubtitle: template.coverBannerSubtitle,
      coverColor: template.coverColor,
      coverBannerStyle: template.coverBannerStyle,
      createdAt: now,
      updatedAt: now,
      isFavorite: false,
      isDeleted: false,
      syncStatus: 'pending',
      ownerMember: currentMember.id,
      ownerName: currentMember.name,
      createdBy: currentMember.name,
      userId: authUser?.id || undefined,
      viewedBy: [
        currentMember.id,
        currentMember.fullName || currentMember.name,
        currentMember.email,
        authUser?.id
      ].filter(Boolean) as string[],
      isNewItem: true
    }

    await db.workspaces.add(newWs)

    if (isCanvas && template.nodes && template.nodes.length > 0) {
      const createdNodeIds: string[] = []
      for (let i = 0; i < template.nodes.length; i++) {
        const nodeDef = template.nodes[i]
        const newNodeId = crypto.randomUUID()
        createdNodeIds.push(newNodeId)
        await db.canvasNodes.add({
          id: newNodeId,
          workspaceId: newId,
          type: nodeDef.type,
          positionX: nodeDef.positionX,
          positionY: nodeDef.positionY,
          data: {
            ...nodeDef.data,
            workspaceId: newId
          },
          createdAt: now + i,
          updatedAt: now + i,
          isDeleted: false,
          syncStatus: 'pending'
        })
      }

      if (template.edges && template.edges.length > 0) {
        for (let i = 0; i < template.edges.length; i++) {
          const edgeDef = template.edges[i]
          const sourceId = createdNodeIds[edgeDef.sourceIndex]
          const targetId = createdNodeIds[edgeDef.targetIndex]
          if (sourceId && targetId) {
            await db.canvasEdges.add({
              id: crypto.randomUUID(),
              workspaceId: newId,
              source: sourceId,
              target: targetId,
              label: edgeDef.label,
              animated: true,
              color: edgeDef.color || '#7c3aed',
              createdAt: now + i,
              updatedAt: now + i,
              isDeleted: false,
              syncStatus: 'pending'
            })
          }
        }
      }
    }

    syncEngine.scheduleSync(500)
    setOptimisticWorkspace(newWs)
    const newTab: WorkbenchTab = {
      id: `tab-${crypto.randomUUID()}`,
      workspaceId: newId,
      viewType: 'doc',
      title: newWs.title,
      icon: newWs.icon || '',
      spaceId: currentSpaceId,
      pinned: false
    }
    setTabs((prev) => [...prev, newTab])
    setActiveTabId(newTab.id)
    setCurrentWorkspaceId(newId)
    toast.success(`${isCanvas ? 'Lienzo' : 'Nota'} "${template.title}" creada desde plantilla.`)
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

  const pendingHashNoteIdRef = useRef<string | null>(
    typeof window !== 'undefined' && window.location.hash.startsWith('#note=')
      ? decodeURIComponent(window.location.hash.slice('#note='.length).split('&')[0])
      : null
  )

  useEffect(() => {
    if (!authUser) return
    const pendingId = pendingHashNoteIdRef.current
    if (!pendingId) return

    if (workspaces.length > 0) {
      const target = workspaces.find(
        (w) => w.id === pendingId && !w.isDeleted && isWorkspaceVisible(w, currentMember, authUser?.id)
      )
      if (target) {
        pendingHashNoteIdRef.current = null
        selectWorkspaceWithTab(target.id)
        return
      }
    }

    const timer = window.setTimeout(() => {
      pendingHashNoteIdRef.current = null
    }, 3500)
    return () => window.clearTimeout(timer)
  }, [authUser, workspaces, currentMember])

  useEffect(() => {
    if (typeof window === 'undefined' || !authUser) return
    const hash = window.location.hash || ''
    if (hash.includes('type=recovery') || hash.includes('access_token=') || hash.includes('error=')) {
      return
    }
    const isSpecialView = Boolean(activeTab?.viewType && activeTab.viewType !== 'doc')
    if (!pendingHashNoteIdRef.current && !isSpecialView && currentWorkspace?.id) {
      const targetHash = `#note=${encodeURIComponent(currentWorkspace.id)}`
      if (window.location.hash !== targetHash) {
        window.history.replaceState(null, '', targetHash)
      }
    }
  }, [authUser, currentWorkspace?.id, activeTab?.viewType])

  useEffect(() => {
    if (typeof window === 'undefined') return
    const handleHashChange = () => {
      const hash = window.location.hash || ''
      if (!hash.startsWith('#note=')) return
      const noteId = decodeURIComponent(hash.slice('#note='.length).split('&')[0])
      if (!noteId || noteId === currentWorkspace?.id) return
      if (!authUser) {
        pendingHashNoteIdRef.current = noteId
        return
      }
      const target = workspaces.find(
        (w) => w.id === noteId && !w.isDeleted && isWorkspaceVisible(w, currentMember, authUser?.id)
      )
      if (target) {
        pendingHashNoteIdRef.current = null
        selectWorkspaceWithTab(target.id)
      }
    }
    window.addEventListener('hashchange', handleHashChange)
    return () => window.removeEventListener('hashchange', handleHashChange)
  }, [authUser, workspaces, currentMember, currentWorkspace?.id])

  // Pantalla de carga mientras se verifica la sesión o se hidratan los datos locales
  if (authLoading || (authUser && isDbHydrating)) {
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

  // Auth Gate: Bloqueo si no hay sesión iniciada
  if (!authUser) {
    return (
      <div className="relative flex h-screen w-screen items-center justify-center bg-[#f8f9fa] dark:bg-[#121214] text-neutral-900 dark:text-neutral-100 font-sans select-none overflow-hidden">
        <AppToaster position="top-right" theme={darkMode ? 'dark' : 'light'} />
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
    <MotionConfig reducedMotion={editorPrefs.reduceMotion ? 'always' : 'user'}>
    <div className="relative flex h-dvh w-full overflow-hidden bg-[var(--obsidian-sidebar-bg,#181818)] text-[var(--app-text-primary)] font-sans select-none">
      {/* 0. Obsidian Left Ribbon (Compact 40px Tool strip) */}
      {!isPresentationMode && !focusMode && (
        <ObsidianRibbon
          sidebarOpen={sidebarOpen}
          onToggleSidebar={() => setSidebarOpen((prev) => !prev)}
          onNewNote={handleNewTab}
          onOpenSearch={() => setIsSearchOpen(true)}
          onOpenCalendar={() => openSpecialViewTab('calendar', 'Almanaque')}
          calendarSidebarActive={activeTab?.viewType === 'calendar'}
          onOpenKnowledgeGraph={() => openSpecialViewTab('knowledge-graph', 'Vista gráfica')}
          onOpenAllDocs={() => openSpecialViewTab('all-docs', 'Todos los documentos')}
          onOpenTemplates={() => openSpecialViewTab('templates', 'Plantillas')}
          onOpenImport={() => setIsImportOpen(true)}
          onOpenShortcuts={() => setIsShortcutsOpen(true)}
          onOpenTrash={() => openSpecialViewTab('trash', 'Papelera')}
          onOpenSettings={() => setIsSettingsOpen(true)}
          onToggleNotifications={toggleNotificationCenter}
          notificationsOpen={isNotificationCenterOpen}
          unreadNotificationsCount={unreadNotificationsCount}
          notificationsDnd={notifPrefs.dndEnabled || notificationService.isInQuietHours()}
          activeView={activeTab?.viewType || activeViewMode}
          syncStatus={syncStatus}
          onForceSync={() => {
            if (!isSupabaseConfigured()) {
              toast.info('Modo local activo (sin Supabase configurado)')
              return
            }
            toast.info('Sincronizando todo con la nube...')
            void syncEngine.forceFullSync().then((res) => {
              if (res.success) {
                toast.success('Datos actualizados desde la nube')
              } else {
                toast.error(res.message || 'No se pudo completar la sincronización')
              }
            })
          }}
          darkMode={darkMode}
          onToggleDarkMode={handleToggleDarkMode}
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
      <AnimatePresence initial={false}>
        {sidebarOpen && !isPresentationMode && !focusMode && activeTab?.viewType !== 'calendar' && (
          <>
            {/* Mobile backdrop overlay */}
            <motion.div
              key="sidebar-backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
              className="fixed inset-y-0 left-12 right-0 bg-black/50 backdrop-blur-xs z-40 md:hidden"
              onClick={() => setSidebarOpen(false)}
            />
            <motion.div
              key="sidebar-panel"
              initial={{ opacity: 0, x: -16 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -16 }}
              transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
              className="fixed inset-y-0 left-12 md:left-0 z-50 md:relative md:z-auto h-full w-[calc(100vw-48px)] md:w-auto flex shrink-0"
            >
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
                onOpenManageSpaces={() => setIsManageSpacesOpen(true)}
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
                isLoading={isWorkspacesLoading}
                darkMode={darkMode}
                onToggleDarkMode={handleToggleDarkMode}
              />
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* 2. Main Content Center Column */}
      <div className="flex-1 flex flex-col h-full min-w-0 overflow-hidden bg-transparent">
        {/* Main Document / Canvas / Full Page Views */}
        <main className="flex-1 relative flex flex-col overflow-hidden">
          <AppErrorBoundary
            resetKey={`${activeTab?.id || ''}:${currentWorkspace?.id || ''}:${currentWorkspace?.coverUrl || ''}`}
          >
          {/* Secondary Header for Document/Split Mode */}
          {!isPresentationMode && !focusMode && (!activeTab || !activeTab.viewType || activeTab.viewType === 'doc') && currentWorkspace && (
            <header className={`h-12 px-3 sm:px-4 flex items-center justify-between select-none text-xs transition-colors duration-150 ${
              activeViewMode === 'canvas'
                ? 'absolute top-0 left-0 right-0 z-20 pointer-events-none bg-transparent border-none'
                : 'relative border-b border-[var(--app-border)] bg-[var(--obsidian-editor-bg)] shrink-0 z-15'
            }`}>
              {/* Left section: Mode Switcher, Favorite, Privacy, Readers */}
              <div className="flex items-center gap-1.5 min-w-0 pointer-events-auto">
              {/* Mode Switcher */}
              <div className="inline-flex items-center bg-[var(--app-bg-secondary)] p-0.5 rounded-lg border border-[var(--app-border)]">
                <button
                  type="button"
                  onClick={() => setViewMode('doc')}
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs transition cursor-pointer ${
                    activeViewMode === 'doc'
                      ? 'bg-[var(--app-bg-overlay)] text-[var(--app-text-primary)] font-medium shadow-xs'
                      : 'text-[var(--app-text-muted)] hover:text-[var(--app-text-primary)]'
                  }`}
                  title="Modo Nota (Alt+S)"
                >
                  <FileText size={15} />
                  <span className="hidden sm:inline">Nota</span>
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode('canvas')}
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs transition cursor-pointer ${
                    activeViewMode === 'canvas'
                      ? 'bg-[var(--app-bg-overlay)] text-[var(--app-text-primary)] font-medium shadow-xs'
                      : 'text-[var(--app-text-muted)] hover:text-[var(--app-text-primary)]'
                  }`}
                  title="Modo Lienzo (Alt+S)"
                >
                  <Kanban size={15} />
                  <span className="hidden sm:inline">Lienzo</span>
                </button>
              </div>

              {/* Star Favorite Button */}
              <button
                type="button"
                onClick={handleToggleFavorite}
                aria-label={currentWorkspace?.isFavorite ? 'Quitar de favoritos' : 'Añadir a favoritos'}
                aria-pressed={!!currentWorkspace?.isFavorite}
                className={`w-8 h-8 rounded-md flex items-center justify-center transition cursor-pointer ${
                  currentWorkspace?.isFavorite
                    ? 'text-amber-400 hover:text-amber-300'
                    : 'text-[var(--app-text-muted)] hover:text-[var(--app-text-primary)] hover:bg-[var(--app-hover)]'
                }`}
                title={currentWorkspace?.isFavorite ? 'Quitar de favoritos' : 'Añadir a favoritos'}
              >
                {currentWorkspace?.isFavorite ? (
                  <Star size={17} weight="fill" />
                ) : (
                  <Star size={17} />
                )}
              </button>

              {/* Read Only Indicator for Layer 2 & Layer 3 */}
              {isCurrentWorkspaceReadOnly && (
                <div
                  className="h-8 px-2.5 rounded-md bg-amber-500/10 border border-amber-500/20 text-amber-500 flex items-center gap-1.5 text-xs font-medium select-none"
                  title={`Solo lectura: Creado por ${currentWorkspace?.ownerName || currentWorkspace?.createdBy || 'otro miembro'}`}
                >
                  <LockKey size={14} weight="fill" />
                  <span className="hidden sm:inline">Solo lectura</span>
                </div>
              )}

              {/* Privacy Selector Button (Canonical location with 2-step confirmation for Privada -> Pública) */}
              <div className="relative">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    if (!canEditCurrentPrivacy) return
                    if (currentWorkspace?.isPrivate) {
                      setActiveDropdown(activeDropdown === 'privacy' ? null : 'privacy')
                    } else {
                      void handleTogglePrivacy()
                    }
                  }}
                  disabled={!canEditCurrentPrivacy}
                  aria-label={currentWorkspace?.isPrivate ? 'Nota privada, cambiar visibilidad' : 'Nota pública, hacer privada'}
                  aria-expanded={activeDropdown === 'privacy'}
                  className={`h-8 px-2.5 rounded-md flex items-center gap-1.5 text-xs font-medium transition select-none ${
                    !canEditCurrentPrivacy ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'
                  } ${
                    currentWorkspace?.isPrivate
                      ? 'text-amber-400 hover:bg-amber-400/10'
                      : 'text-[var(--app-text-secondary)] hover:text-[var(--app-text-primary)] hover:bg-[var(--app-hover)]'
                  }`}
                  title={
                    !canEditCurrentPrivacy
                      ? `Privacidad gestionada por el autor original (${currentWorkspace?.ownerName || currentWorkspace?.createdBy || 'propietario'})`
                      : currentWorkspace?.isPrivate
                      ? 'Nota privada (solo tú). Pulsa para compartir con el equipo'
                      : 'Nota pública (visible para todo el equipo). Pulsa para hacerla privada'
                  }
                >
                  {currentWorkspace?.isPrivate ? (
                    <LockKey size={15} weight="fill" className="text-amber-400 shrink-0" />
                  ) : (
                    <LockKeyOpen size={15} className="shrink-0" />
                  )}
                  <span className="hidden sm:inline">
                    {currentWorkspace?.isPrivate ? 'Privada' : 'Pública'}
                  </span>
                </button>

                {activeDropdown === 'privacy' && currentWorkspace?.isPrivate && (
                  <div
                    role="dialog"
                    aria-label="Confirmar cambio a nota pública"
                    onClick={(e) => e.stopPropagation()}
                    className="fixed right-3 top-14 sm:absolute sm:left-0 sm:right-auto sm:top-10 z-50 w-64 bg-[var(--app-bg-overlay)] border border-[var(--app-border-strong)] rounded-xl shadow-[var(--app-shadow-popover)] p-3 text-xs text-[var(--app-text-primary)] animate-in fade-in zoom-in-95 duration-100"
                  >
                    <p className="font-semibold text-[var(--app-text-primary)] mb-1">
                      ¿Hacer pública esta nota?
                    </p>
                    <p className="text-[11px] text-[var(--app-text-secondary)] leading-relaxed mb-3">
                      Pasará a ser visible para todos los miembros del equipo en este espacio.
                    </p>
                    <div className="flex items-center justify-end gap-1.5">
                      <button
                        type="button"
                        onClick={() => setActiveDropdown(null)}
                        className="px-2.5 py-1 rounded-md text-[11px] font-medium text-[var(--app-text-secondary)] hover:bg-[var(--app-hover)] transition cursor-pointer"
                      >
                        Cancelar
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          void handleTogglePrivacy()
                          setActiveDropdown(null)
                        }}
                        className="px-2.5 py-1 rounded-md text-[11px] font-semibold bg-[var(--app-accent)] hover:bg-[var(--app-accent-hover)] text-white transition cursor-pointer"
                      >
                        Hacer pública
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Admin-only Read Receipts: "Leído por X persona" */}
              {isUserAdmin(currentMember) && currentWorkspace && (
                <DocumentReadersBadge
                  workspace={currentWorkspace}
                  currentMember={currentMember}
                  authUserId={authUser?.id}
                  isOpen={activeDropdown === 'readers'}
                  onToggle={() =>
                    setActiveDropdown(activeDropdown === 'readers' ? null : 'readers')
                  }
                />
              )}

              {/* Ambient Sync Status Indicator */}
              <button
                type="button"
                onClick={() => void syncEngine.triggerSync()}
                aria-label={
                  syncStatus.state === 'syncing'
                    ? 'Sincronizando cambios'
                    : syncStatus.state === 'error'
                    ? 'Error de sincronización, pulsar para reintentar'
                    : syncStatus.state === 'offline'
                    ? 'Sin conexión, guardado localmente'
                    : 'Cambios guardados y sincronizados'
                }
                className="hidden lg:inline-flex items-center gap-1.5 h-8 px-2.5 rounded-md text-xs text-[var(--app-text-muted)] hover:text-[var(--app-text-primary)] hover:bg-[var(--app-hover)] transition cursor-pointer"
                title="Estado de sincronización (pulsa para sincronizar)"
              >
                <span
                  className={`w-1.5 h-1.5 rounded-full ${
                    syncStatus.state === 'syncing'
                      ? 'bg-[var(--app-accent)] animate-pulse'
                      : syncStatus.state === 'error' || syncStatus.state === 'offline'
                      ? 'bg-amber-400'
                      : 'bg-emerald-500/80'
                  }`}
                />
                <span>
                  {syncStatus.state === 'syncing'
                    ? 'Sincronizando…'
                    : syncStatus.state === 'error'
                    ? 'Reintentar sync'
                    : syncStatus.state === 'offline'
                    ? 'Sin conexión'
                    : 'Guardado'}
                </span>
              </button>
            </div>

            {/* Center: Board Title (touch/click to rename) */}
            {activeViewMode === 'canvas' && (
              <div className="hidden md:flex flex-1 min-w-0 items-center justify-center px-3 pointer-events-auto z-10">
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
                    placeholder="Título del lienzo..."
                    className="font-serif font-bold text-base md:text-lg text-center text-[var(--app-text-primary)] bg-[var(--app-bg-overlay)] px-4 py-1 rounded-lg border border-[var(--app-border-strong)] shadow-md outline-none min-w-[160px] max-w-full focus:border-[var(--app-accent)]"
                  />
                ) : (
                  <button
                    type="button"
                    onClick={startEditingBoardTitle}
                    className="group flex items-center gap-2 px-3 py-1 rounded-lg hover:bg-[var(--app-hover)] transition cursor-pointer select-none tracking-tight text-center active:scale-95 max-w-full min-w-0"
                    title="Toca para cambiar el nombre del lienzo"
                  >
                    <span className="font-serif font-bold text-base md:text-lg text-[var(--app-text-primary)] group-hover:text-[var(--app-accent)] transition truncate">
                      {currentWorkspace?.title || 'Sin título'}
                    </span>
                    <PencilSimpleLine size={15} weight="duotone" className="text-[var(--app-text-muted)] group-hover:text-[var(--app-accent)] opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition shrink-0" />
                  </button>
                )}
              </div>
            )}

            {/* Right section: Actualizar, Propiedades, Exportar, Compartir, Más acciones */}
            <div className="flex items-center gap-1.5 shrink-0 pointer-events-auto">
              {webUpdateAvailable && (
                <button
                  type="button"
                  onClick={() => applyWebUpdate()}
                  className="h-8 px-3 rounded-md bg-[var(--app-accent)] hover:bg-[var(--app-accent-hover)] text-white text-xs font-medium flex items-center gap-1.5 transition cursor-pointer shadow-xs"
                  title="Hay una nueva versión disponible. Haz clic para actualizar la página."
                >
                  <Sparkle size={14} weight="fill" />
                  <span>Actualizar</span>
                </button>
              )}

              {(activeViewMode === 'doc' || activeViewMode === 'split') && (
                <button
                  type="button"
                  onClick={() => setRightSidebarOpen((prev) => !prev)}
                  aria-label={rightSidebarOpen ? 'Ocultar propiedades y esquema' : 'Mostrar propiedades y esquema'}
                  aria-pressed={rightSidebarOpen}
                  className={`w-8 h-8 rounded-md flex items-center justify-center transition cursor-pointer ${
                    rightSidebarOpen
                      ? 'bg-[var(--app-active)] text-[var(--app-text-primary)]'
                      : 'text-[var(--app-text-secondary)] hover:text-[var(--app-text-primary)] hover:bg-[var(--app-hover)]'
                  }`}
                  title="Propiedades y Esquema (Ctrl+Shift+\)"
                >
                  <SidebarSimple size={17} weight={rightSidebarOpen ? 'fill' : 'regular'} />
                </button>
              )}

              {/* Exportar Dropdown (Single canonical export entry) */}
              <div className="relative">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    setActiveDropdown(activeDropdown === 'export' ? null : 'export')
                  }}
                  aria-label="Exportar nota"
                  aria-haspopup="menu"
                  aria-expanded={activeDropdown === 'export'}
                  className={`h-8 px-2.5 rounded-md flex items-center gap-1.5 text-xs font-medium text-[var(--app-text-secondary)] hover:text-[var(--app-text-primary)] hover:bg-[var(--app-hover)] transition cursor-pointer select-none ${
                    activeDropdown === 'export' ? 'bg-[var(--app-active)] text-[var(--app-text-primary)]' : ''
                  }`}
                  title="Exportar nota o lienzo"
                >
                  <DownloadSimple size={15} />
                  <span className="hidden sm:inline">Exportar</span>
                </button>

                {activeDropdown === 'export' && (
                  <div
                    role="menu"
                    className="fixed right-3 top-14 sm:absolute sm:right-0 sm:top-10 z-50 w-[calc(100vw-24px)] max-w-[240px] sm:w-56 bg-[var(--app-bg-overlay)] border border-[var(--app-border-strong)] rounded-xl shadow-[var(--app-shadow-popover)] p-1.5 text-xs text-[var(--app-text-primary)] animate-in fade-in zoom-in-95 space-y-0.5"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        if (currentWorkspace) exportDocumentAsMarkdown(currentWorkspace)
                        setActiveDropdown(null)
                      }}
                      className="w-full text-left px-2.5 py-1.5 rounded-md hover:bg-[var(--app-hover)] flex items-center gap-2 font-medium transition cursor-pointer"
                    >
                      <DownloadSimple size={15} weight="duotone" className="shrink-0 text-[var(--app-text-secondary)]" />
                      <span className="truncate">Exportar como Markdown (.md)</span>
                    </button>
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        if (currentWorkspace) exportDocumentAsHtml(currentWorkspace)
                        setActiveDropdown(null)
                      }}
                      className="w-full text-left px-2.5 py-1.5 rounded-md hover:bg-[var(--app-hover)] flex items-center gap-2 font-medium transition cursor-pointer"
                    >
                      <FileHtml size={15} weight="duotone" className="shrink-0 text-[var(--app-text-secondary)]" />
                      <span className="truncate">Exportar como HTML (.html)</span>
                    </button>
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        printDocument()
                        setActiveDropdown(null)
                      }}
                      className="w-full text-left px-2.5 py-1.5 rounded-md hover:bg-[var(--app-hover)] flex items-center gap-2 font-medium transition cursor-pointer"
                    >
                      <Printer size={15} weight="duotone" className="shrink-0 text-[var(--app-text-secondary)]" />
                      <span className="truncate">Imprimir / Guardar como PDF</span>
                    </button>
                    <button
                      type="button"
                      role="menuitem"
                      onClick={async () => {
                        if (currentWorkspace) {
                          const nodes = await db.canvasNodes.where('workspaceId').equals(currentWorkspace.id).and((n) => !n.isDeleted).toArray()
                          exportDocumentAsJson(currentWorkspace, nodes)
                        }
                        setActiveDropdown(null)
                      }}
                      className="w-full text-left px-2.5 py-1.5 rounded-md hover:bg-[var(--app-hover)] flex items-center gap-2 font-medium transition cursor-pointer"
                    >
                      <FileCode size={15} weight="duotone" className="shrink-0 text-[var(--app-text-secondary)]" />
                      <span className="truncate">Exportar copia JSON (.json)</span>
                    </button>
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        if (currentWorkspace) copyAsPlainText(currentWorkspace.docContent)
                        setActiveDropdown(null)
                      }}
                      className="w-full text-left px-2.5 py-1.5 rounded-md hover:bg-[var(--app-hover)] flex items-center gap-2 font-medium transition cursor-pointer"
                    >
                      <Copy size={15} weight="duotone" className="shrink-0 text-[var(--app-text-secondary)]" />
                      <span className="truncate">Copiar como texto plano</span>
                    </button>
                  </div>
                )}
              </div>

              {/* Compartir Button */}
              <button
                type="button"
                onClick={() => setIsShareOpen(true)}
                className="h-8 px-3 rounded-md text-xs font-medium text-[var(--app-text-primary)] bg-[var(--app-bg-secondary)] hover:bg-[var(--app-hover-filled)] border border-[var(--app-border-strong)] flex items-center gap-1.5 transition cursor-pointer select-none"
                title="Compartir con colaboradores"
              >
                <ShareNetwork size={15} />
                <span className="hidden sm:inline">Compartir</span>
              </button>

              {/* More options menu `...` (Distilled, zero duplicates) */}
              <div className="relative">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    setActiveDropdown(activeDropdown === 'more' ? null : 'more')
                  }}
                  aria-label="Más acciones de la nota"
                  aria-haspopup="menu"
                  aria-expanded={activeDropdown === 'more'}
                  className={`w-8 h-8 rounded-md flex items-center justify-center transition cursor-pointer ${
                    activeDropdown === 'more'
                      ? 'bg-[var(--app-active)] text-[var(--app-text-primary)]'
                      : 'text-[var(--app-text-secondary)] hover:text-[var(--app-text-primary)] hover:bg-[var(--app-hover)]'
                  }`}
                  title="Más acciones de la nota"
                >
                  <DotsThree size={19} weight="bold" />
                </button>

                {activeDropdown === 'more' && (
                  <div
                    role="menu"
                    className="fixed right-3 top-14 sm:absolute sm:right-0 sm:top-10 z-50 w-[calc(100vw-24px)] max-w-[260px] sm:w-64 bg-[var(--app-bg-overlay)] border border-[var(--app-border-strong)] rounded-xl shadow-[var(--app-shadow-popover)] p-1.5 text-xs text-[var(--app-text-primary)] animate-in fade-in zoom-in-95 duration-100 space-y-0.5 max-h-[calc(100vh-64px)] overflow-y-auto custom-scrollbar"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        setViewMode(activeViewMode === 'split' ? 'doc' : 'split')
                        setActiveDropdown(null)
                      }}
                      className="w-full text-left px-2.5 py-1.5 rounded-md hover:bg-[var(--app-hover)] flex items-center gap-2 font-medium transition cursor-pointer"
                    >
                      <Columns size={15} weight="duotone" className="shrink-0 text-[var(--app-text-secondary)]" />
                      <span>{activeViewMode === 'split' ? 'Cerrar vista dividida' : 'Vista dividida'}</span>
                    </button>

                    <button
                      type="button"
                      role="menuitem"
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
                      className="w-full text-left px-2.5 py-1.5 rounded-md hover:bg-[var(--app-hover)] flex items-center justify-between font-medium transition cursor-pointer"
                    >
                      <div className="flex items-center gap-2 truncate">
                        <ArrowsOutLineHorizontal size={15} weight="duotone" className="shrink-0 text-[var(--app-text-secondary)]" />
                        <span className="truncate">Ancho completo</span>
                      </div>
                      <div
                        className={`w-7 h-4 rounded-full transition-colors p-0.5 flex items-center ${
                          (currentWorkspace?.pageWidth || 'full') === 'full'
                            ? 'bg-[var(--app-accent)] justify-end'
                            : 'bg-[var(--app-border-strong)] justify-start'
                        }`}
                      >
                        <div className="w-3 h-3 rounded-full bg-white shadow-xs" />
                      </div>
                    </button>

                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        setFocusMode(true)
                        setActiveDropdown(null)
                      }}
                      className="w-full text-left px-2.5 py-1.5 rounded-md hover:bg-[var(--app-hover)] flex items-center justify-between font-medium transition cursor-pointer"
                    >
                      <div className="flex items-center gap-2 truncate">
                        <ArrowsOutLineHorizontal size={15} weight="duotone" className="shrink-0 text-[var(--app-text-secondary)]" />
                        <span className="truncate">Modo concentración</span>
                      </div>
                      <kbd className="text-[10px] bg-[var(--app-bg-tertiary)] px-1.5 py-0.5 rounded text-[var(--app-text-muted)] border border-[var(--app-border)] shrink-0">
                        Ctrl+Shift+F
                      </kbd>
                    </button>

                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        setIsPresentationMode(true)
                        setActiveDropdown(null)
                      }}
                      className="w-full text-left px-2.5 py-1.5 rounded-md hover:bg-[var(--app-hover)] flex items-center justify-between font-medium transition cursor-pointer"
                    >
                      <div className="flex items-center gap-2 truncate">
                        <Presentation size={15} weight="duotone" className="shrink-0 text-[var(--app-text-secondary)]" />
                        <span className="truncate">Modo presentación</span>
                      </div>
                      <kbd className="text-[10px] bg-[var(--app-bg-tertiary)] px-1.5 py-0.5 rounded text-[var(--app-text-muted)] border border-[var(--app-border)] shrink-0">
                        F5
                      </kbd>
                    </button>

                    <div className="border-t border-[var(--app-divider)] my-1" />

                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        setIsQuickCaptureOpen(true)
                        setActiveDropdown(null)
                      }}
                      className="w-full text-left px-2.5 py-1.5 rounded-md hover:bg-[var(--app-hover)] flex items-center justify-between font-medium transition cursor-pointer"
                    >
                      <div className="flex items-center gap-2 truncate">
                        <Sparkle size={15} weight="duotone" className="shrink-0 text-[var(--app-text-secondary)]" />
                        <span className="truncate">Captura rápida</span>
                      </div>
                      <kbd className="text-[10px] bg-[var(--app-bg-tertiary)] px-1.5 py-0.5 rounded text-[var(--app-text-muted)] border border-[var(--app-border)] shrink-0">
                        Alt+N
                      </kbd>
                    </button>

                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        setIsFindInPageOpen(true)
                        setActiveDropdown(null)
                      }}
                      className="w-full text-left px-2.5 py-1.5 rounded-md hover:bg-[var(--app-hover)] flex items-center justify-between font-medium transition cursor-pointer"
                    >
                      <div className="flex items-center gap-2 truncate">
                        <MagnifyingGlass size={15} weight="duotone" className="shrink-0 text-[var(--app-text-secondary)]" />
                        <span className="truncate">Buscar en nota</span>
                      </div>
                      <kbd className="text-[10px] bg-[var(--app-bg-tertiary)] px-1.5 py-0.5 rounded text-[var(--app-text-muted)] border border-[var(--app-border)] shrink-0">
                        Ctrl+F
                      </kbd>
                    </button>

                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        const targetId = currentWorkspace?.id || currentWorkspaceId
                        const noteUrl = targetId
                          ? `${window.location.origin}/#note=${encodeURIComponent(targetId)}`
                          : window.location.href
                        navigator.clipboard.writeText(noteUrl)
                        setCopiedLink(true)
                        toast.success('Enlace copiado al portapapeles')
                        setTimeout(() => setCopiedLink(false), 2000)
                        setActiveDropdown(null)
                      }}
                      className="w-full text-left px-2.5 py-1.5 rounded-md hover:bg-[var(--app-hover)] flex items-center gap-2 font-medium transition cursor-pointer"
                    >
                      <Copy size={15} weight="duotone" className="shrink-0 text-[var(--app-text-secondary)]" />
                      <span className="truncate">{copiedLink ? '¡Enlace copiado!' : 'Copiar enlace'}</span>
                    </button>

                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        setIsShortcutsOpen(true)
                        setActiveDropdown(null)
                      }}
                      className="w-full text-left px-2.5 py-1.5 rounded-md hover:bg-[var(--app-hover)] flex items-center justify-between font-medium transition cursor-pointer"
                    >
                      <div className="flex items-center gap-2 truncate">
                        <Keyboard size={15} weight="duotone" className="shrink-0 text-[var(--app-text-secondary)]" />
                        <span className="truncate">Atajos de teclado</span>
                      </div>
                      <kbd className="text-[10px] bg-[var(--app-bg-tertiary)] px-1.5 py-0.5 rounded text-[var(--app-text-muted)] border border-[var(--app-border)] shrink-0">
                        ?
                      </kbd>
                    </button>

                    {/* Compact inline note statistics */}
                    <div className="border-t border-[var(--app-divider)] my-1 pt-1.5 px-2.5 flex items-center justify-between text-[11px] text-[var(--app-text-muted)] font-mono">
                      <span>{stats.words} palabras</span>
                      <span>~{stats.time} min</span>
                    </div>

                    <div className="border-t border-[var(--app-divider)] my-1" />

                    <button
                      type="button"
                      role="menuitem"
                      onClick={async () => {
                        if (currentWorkspace) {
                          await handleDeleteWorkspaceWithUndo(currentWorkspace)
                        }
                        setActiveDropdown(null)
                      }}
                      className="w-full text-left px-2.5 py-1.5 rounded-md hover:bg-rose-500/10 text-rose-500 flex items-center gap-2 font-semibold transition cursor-pointer"
                    >
                      <Trash size={15} weight="duotone" className="shrink-0 text-rose-500" />
                      <span className="truncate">Eliminar nota</span>
                    </button>
                  </div>
                )}
              </div>
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
                onCreateWorkspace={async () => {
                  const newId = crypto.randomUUID()
                  const now = Date.now()
                  const newWs: WorkspaceItem = {
                    id: newId,
                    parentId: null,
                    spaceId: currentSpaceId,
                    title: 'Sin título',
                    icon: '',
                    color: '#7c3aed',
                    viewMode: editorPrefs.defaultViewMode,
                    pageWidth: editorPrefs.defaultPageWidth,
                    isPrivate: editorPrefs.defaultPrivate,
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
                  syncEngine.scheduleSync(500)
                  selectWorkspaceWithTab(newId, currentSpaceId, newWs)
                }}
                onToggleFavorite={async (e, ws) => {
                  e.stopPropagation()
                  const canSync = canUserEditWorkspace(ws, currentMember, authUser?.id)
                  await db.workspaces.update(ws.id, {
                    isFavorite: !ws.isFavorite,
                    ...(canSync ? { updatedAt: Date.now(), syncStatus: 'pending' as const } : { syncStatus: ws.syncStatus || 'synced' })
                  })
                  if (canSync) syncEngine.scheduleSync(500)
                }}
                onDeleteWorkspace={async (e, id) => {
                  e.stopPropagation()
                  const target = workspaces.find((w) => w.id === id)
                  if (!canUserDeleteWorkspace(target, currentMember, authUser?.id)) {
                    toast.error('Solo el autor o un administrador pueden eliminar esta nota.')
                    return
                  }
                  await db.workspaces.update(id, {
                    isDeleted: true,
                    trashedFolder: undefined,
                    trashedWithSpaceId: undefined,
                    updatedAt: getSafeTimestamp(target?.updatedAt),
                    syncStatus: 'pending'
                  })
                  const children = workspaces.filter((w) => w.parentId === id && !w.isDeleted)
                  for (const child of children) {
                    if (canUserEditWorkspace(child, currentMember, authUser?.id)) {
                      await db.workspaces.update(child.id, {
                        parentId: target?.parentId || null,
                        folder: child.folder || target?.folder || null,
                        updatedAt: getSafeTimestamp(child.updatedAt),
                        syncStatus: 'pending'
                      })
                    }
                  }
                  syncEngine.scheduleSync(50)
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
                  syncEngine.scheduleSync(500)
                  setOptimisticWorkspace(newWs)
                  selectWorkspaceWithTab(newId, currentSpaceId, newWs)
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
            ) : activeTab?.viewType === 'calendar' ? (
              <CalendarPage />
            ) : activeTab?.viewType === 'trash' ? (
              <TrashPage
                onSelectWorkspace={(id) => selectWorkspaceWithTab(id)}
                authUserId={authUser?.id}
              />
            ) : activeTab?.viewType === 'templates' ? (
              <TemplatesPage
                onSelectTemplate={(template) => {
                  handleApplyTemplate(template)
                  if (currentWorkspace?.id) {
                    selectWorkspaceWithTab(currentWorkspace.id)
                  }
                }}
                onCreateFromTemplate={handleCreateFromTemplate}
                currentWorkspace={currentWorkspace}
                isCurrentWorkspaceReadOnly={isCurrentWorkspaceReadOnly}
              />
            ) : currentWorkspace ? (
              activeViewMode === 'doc' ? (
                <div key={`doc-${currentWorkspace.id}`} className="flex-1 h-full overflow-hidden relative sn-view-enter">
                  <DocEditor
                    workspace={currentWorkspace}
                    allWorkspaces={publicWorkspaces}
                    spaces={spaces}
                    onSelectWorkspace={(id) => selectWorkspaceWithTab(id)}
                    onTitleChange={isCurrentWorkspaceReadOnly ? undefined : handleTitleChange}
                    onToggleViewMode={() => setViewMode('canvas')}
                    onOpenTemplatesModal={() => setIsTemplatesOpen(true)}
                    readOnly={isCurrentWorkspaceReadOnly}
                    hideChrome={focusMode}
                  />
                  {focusMode && (
                    <button
                      type="button"
                      onClick={() => setFocusMode(false)}
                      className="absolute top-3 right-3 z-50 h-8 px-3 rounded-md bg-[var(--app-bg-overlay)] border border-[var(--app-border-strong)] text-xs font-medium text-[var(--app-text-secondary)] hover:text-[var(--app-text-primary)] opacity-50 hover:opacity-100 transition shadow-[var(--app-shadow-popover)] cursor-pointer"
                      title="Salir de modo concentración (Esc)"
                    >
                      Salir de concentración
                    </button>
                  )}
                </div>
              ) : activeViewMode === 'canvas' ? (
                <div key={`canvas-${currentWorkspace.id}`} className="flex-1 h-full overflow-hidden relative sn-view-enter">
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
                      type="button"
                      onClick={() => setFocusMode(false)}
                      className="absolute top-3 right-3 z-50 h-8 px-3 rounded-md bg-[var(--app-bg-overlay)] border border-[var(--app-border-strong)] text-xs font-medium text-[var(--app-text-secondary)] hover:text-[var(--app-text-primary)] opacity-50 hover:opacity-100 transition shadow-[var(--app-shadow-popover)] cursor-pointer"
                      title="Mostrar herramientas y menús (Esc)"
                    >
                      Salir de concentración
                    </button>
                  )}
                </div>
              ) : (
                /* Split View */
                <div key={`split-${currentWorkspace.id}`} className="flex-1 flex h-full overflow-hidden relative sn-view-enter">
                  <div className="w-1/2 h-full overflow-hidden border-r border-[var(--app-border)]">
                    <DocEditor
                      workspace={currentWorkspace}
                      allWorkspaces={publicWorkspaces}
                      spaces={spaces}
                      onSelectWorkspace={(id) => selectWorkspaceWithTab(id)}
                      onTitleChange={isCurrentWorkspaceReadOnly ? undefined : handleTitleChange}
                      onToggleViewMode={() => setViewMode('canvas')}
                      onOpenTemplatesModal={() => setIsTemplatesOpen(true)}
                      readOnly={isCurrentWorkspaceReadOnly}
                      hideChrome={focusMode}
                    />
                  </div>
                  <div className="w-1/2 h-full overflow-hidden">
                    <CanvasBoard
                      workspaceId={currentWorkspace.id}
                      currentWorkspace={currentWorkspace}
                      onSwitchToDoc={handleSwitchToDoc}
                      darkMode={darkMode}
                      hideChrome={focusMode}
                      readOnly={isCurrentWorkspaceReadOnly}
                    />
                  </div>
                  {focusMode && (
                    <button
                      type="button"
                      onClick={() => setFocusMode(false)}
                      className="absolute top-3 right-3 z-50 h-8 px-3 rounded-md bg-[var(--app-bg-overlay)] border border-[var(--app-border-strong)] text-xs font-medium text-[var(--app-text-secondary)] hover:text-[var(--app-text-primary)] opacity-50 hover:opacity-100 transition shadow-[var(--app-shadow-popover)] cursor-pointer"
                      title="Salir de modo concentración (Esc)"
                    >
                      Salir de concentración
                    </button>
                  )}
                </div>
              )
            ) : isWorkspacesLoading ? (
              <div className="flex-1 flex flex-col items-center justify-center p-6 text-center text-zinc-500 text-sm gap-3 select-none">
                <div className="w-10 h-10 rounded-2xl bg-neutral-900 dark:bg-white flex items-center justify-center text-white dark:text-neutral-900 font-black text-lg shadow-sm animate-pulse">
                  7
                </div>
                <div className="font-medium text-neutral-600 dark:text-neutral-300 text-xs">
                  Sincronizando tus notas...
                </div>
              </div>
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
          </AppErrorBoundary>
        </main>
      </div>

      {/* 3. Right Sidebar (Propiedades, Outline, Historial) */}
      <AnimatePresence initial={false}>
        {rightSidebarOpen && !isPresentationMode && !focusMode && (activeViewMode === 'doc' || activeViewMode === 'split') && (
          <motion.div
            key="right-sidebar"
            initial={{ opacity: 0, x: 16 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 16 }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
            className="h-full flex shrink-0"
          >
            <RightSidebar
              workspace={currentWorkspace}
              isOpen={rightSidebarOpen}
              onClose={() => setRightSidebarOpen(false)}
              activeTab={rightSidebarTab}
              onTabChange={(tab) => setRightSidebarTab(tab)}
              onScrollToHeading={handleScrollToHeading}
              readOnly={isCurrentWorkspaceReadOnly}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* 4. Global Modals */}
      <CommandPalette
        isOpen={isSearchOpen}
        onClose={() => setIsSearchOpen(false)}
        workspaces={currentSpaceWorkspaces}
        onSelectWorkspace={(id) => selectWorkspaceWithTab(id)}
        darkMode={darkMode}
        onToggleDarkMode={handleToggleDarkMode}
        onCreateWorkspace={async () => {
          const newId = crypto.randomUUID()
          const now = Date.now()
          await db.workspaces.add({
            id: newId,
            parentId: null,
            spaceId: currentSpaceId,
            title: 'Sin título',
            icon: '',
            color: '#7c3aed',
            viewMode: editorPrefs.defaultViewMode,
            pageWidth: editorPrefs.defaultPageWidth,
            isPrivate: editorPrefs.defaultPrivate,
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
          syncEngine.scheduleSync(500)
          selectWorkspaceWithTab(newId)
          toast.success('Página creada')
        }}
        onToggleViewMode={() => setViewMode(activeViewMode === 'canvas' ? 'doc' : 'canvas')}
        onOpenSettings={() => setIsSettingsOpen(true)}
        onOpenShortcuts={() => setIsShortcutsOpen(true)}
        onOpenImport={() => setIsImportOpen(true)}
        onOpenAllDocs={() => openSpecialViewTab('all-docs', 'Todos los documentos')}
        onOpenKnowledgeGraph={() => openSpecialViewTab('knowledge-graph', 'Grafo de Conocimiento')}
        onOpenTemplates={() => setIsTemplatesOpen(true)}
      />

      <Suspense fallback={null}>
        <SettingsModal
          isOpen={isSettingsOpen}
          onClose={() => setIsSettingsOpen(false)}
          syncStatus={syncStatus}
          uiScale={uiScale}
          onUiScaleChange={setUiScale}
          themeId={themeId}
          onThemeChange={setThemeId}
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
          onCreateFromTemplate={handleCreateFromTemplate}
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
          isAdmin={isUserAdmin(currentMember)}
        />

        <ManageSpacesModal
          isOpen={isManageSpacesOpen}
          onClose={() => setIsManageSpacesOpen(false)}
          spaces={visibleSpaces}
          activeSpaceId={currentSpaceId}
          onSelectSpace={async (id) => {
            await handleSelectSpace(id)
            setIsManageSpacesOpen(false)
          }}
          onUpdateSpace={handleUpdateSpace}
          onReorderSpaces={handleReorderSpaces}
          onDeleteSpace={handleDeleteSpace}
          onOpenCreateSpace={() => setIsCreateWorkspaceOpen(true)}
          isAdmin={isUserAdmin(currentMember)}
          currentMember={currentMember}
          authUserId={authUser?.id}
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

      {/* 6. Notification Center Drawer */}
      <NotificationCenter
        isOpen={isNotificationCenterOpen}
        onClose={() => setNotificationCenterOpen(false)}
        onOpenSettings={() => setIsSettingsOpen(true)}
        currentMember={currentMember}
        authUserId={authUser?.id}
      />

      {/* 7. Sileo Physics-Based Notification Toaster */}
      <AppToaster position="bottom-right" theme={darkMode ? 'dark' : 'light'} />
    </div>
    </MotionConfig>
  )
}

interface AppErrorBoundaryProps {
  children: ReactNode
  resetKey?: string
}

interface AppErrorBoundaryState {
  hasError: boolean
  errorMessage: string
}

class AppErrorBoundary extends Component<AppErrorBoundaryProps, AppErrorBoundaryState> {
  state: AppErrorBoundaryState = { hasError: false, errorMessage: '' }

  static getDerivedStateFromError(error: Error): AppErrorBoundaryState {
    return {
      hasError: true,
      errorMessage: error?.message || 'Error inesperado al renderizar la vista'
    }
  }

  componentDidUpdate(prevProps: AppErrorBoundaryProps) {
    if (this.state.hasError && prevProps.resetKey !== this.props.resetKey) {
      this.setState({ hasError: false, errorMessage: '' })
    }
  }

  componentDidCatch(error: Error) {
    console.error('AppErrorBoundary caught error:', error)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex-1 h-full w-full flex flex-col items-center justify-center p-6 text-center bg-[var(--app-bg-primary)] text-[var(--app-text-primary)] select-none gap-3">
          <div className="w-11 h-11 rounded-2xl bg-rose-500/10 text-rose-500 flex items-center justify-center text-xl font-bold">
            !
          </div>
          <div className="text-sm font-semibold">Ocurrió un error al mostrar esta vista</div>
          <p className="text-xs text-[var(--app-text-muted)] max-w-sm">
            Algo salió mal al cargar esta pantalla. Tus notas siguen guardadas de forma segura.
          </p>
          <div className="flex items-center gap-2 pt-1">
            <button
              type="button"
              onClick={() => this.setState({ hasError: false, errorMessage: '' })}
              className="px-3.5 py-1.5 rounded-md bg-[var(--app-accent)] hover:bg-[var(--app-accent-hover)] text-white text-xs font-medium transition cursor-pointer"
            >
              Reintentar
            </button>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="px-3.5 py-1.5 rounded-md bg-[var(--app-bg-secondary)] hover:bg-[var(--app-hover)] border border-[var(--app-border)] text-xs font-medium transition cursor-pointer"
            >
              Recargar página
            </button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}

export default function App() {
  const urlParams = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null
  const externalShareId = urlParams?.get('share')
  const externalToken = urlParams?.get('token')

  if (externalShareId && externalToken) {
    return (
      <AppErrorBoundary>
        <Suspense fallback={<div className="h-screen w-screen flex items-center justify-center p-8 text-neutral-400 text-xs">Cargando nota compartida...</div>}>
          <ExternalShareView workspaceId={externalShareId} token={externalToken} />
        </Suspense>
      </AppErrorBoundary>
    )
  }

  return (
    <AppErrorBoundary>
      <MainApp />
    </AppErrorBoundary>
  )
}

