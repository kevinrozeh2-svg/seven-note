import React, { useState, useMemo, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import {
  MagnifyingGlass,
  Plus,
  Star,
  Trash,
  Folder,
  FolderSimplePlus,
  Gear,
  Sun,
  Moon,
  CaretDown,
  CaretRight,
  FileText,
  CalendarBlank,
  Graph,
  Tag,
  Books,
  DownloadSimple,
  Keyboard,
  CloudCheck,
  CloudSlash,
  ArrowsClockwise,
  SidebarSimple,
  PencilSimple,
  Check,
  Lock,
  LockOpen,
  FilmSlate,
  RocketLaunch,
  Lightning,
  Lightbulb,
  Sparkle,
  ChartBar,
  PushPin,
  Kanban,
  Columns,
  X
} from '@phosphor-icons/react'
import {
  db,
  type WorkspaceItem,
  type SpaceItem,
  DEFAULT_SPACE_ID,
  updateSpace
} from '../../db'
import { type SyncEngineStatus, syncEngine } from '../../lib/syncEngine'
import { TeamMemberSwitcher } from './TeamMemberSwitcher'
import { AppleEmoji, isEmoji, renderWithAppleEmoji } from '../ui/AppleEmoji'
import { EmojiPickerPopover } from '../modals/EmojiPickerPopover'
import { getCurrentMember, type TeamMember, isWorkspaceVisible, isSpaceVisible } from '../../lib/teamAuth'
import { toast } from 'sonner'

export interface SidebarProps {
  spaces?: SpaceItem[]
  currentSpaceId?: string
  onSelectSpace?: (id: string) => void
  currentMember?: TeamMember
  onSelectMember?: (id: string) => void
  authUser?: any
  onOpenAuthModal?: () => void
  onOpenProfileModal?: () => void
  onOpenUserManagementModal?: () => void
  onSignOut?: () => void
  onOpenCreateSpace?: () => void
  onRenameSpace?: (id: string, newName: string) => void
  onDeleteSpace?: (id: string) => void
  workspaces: WorkspaceItem[]
  currentWorkspaceId: string
  onSelectWorkspace: (id: string) => void
  onToggleSidebar: () => void
  onOpenSettings: () => void
  onOpenSearch: () => void
  onOpenAllDocs: () => void
  onOpenTrash: () => void
  onOpenImport: () => void
  onOpenTemplates: () => void
  onOpenShortcuts: () => void

  onOpenKnowledgeGraph?: () => void
  syncStatus: SyncEngineStatus
  darkMode: boolean
  onToggleDarkMode: () => void
  activeNavigation?: string
  onSelectNavigation?: (nav: string) => void
}

function DocumentItemIcon({
  icon,
  viewMode,
  title,
  size = 15,
  isPrivate = false,
  className = 'text-neutral-500 dark:text-neutral-400 shrink-0',
  onClick
}: {
  icon?: string | null
  viewMode?: string
  title?: string
  size?: number
  isPrivate?: boolean
  className?: string
  onClick?: (e: React.MouseEvent) => void
}) {
  const renderIcon = () => {
    if (isPrivate && (!icon || icon === '🔒')) {
      return <Lock size={size} weight="duotone" className={className} />
    }

    if (icon && isEmoji(icon)) {
      return <AppleEmoji emoji={icon} size={size} className="shrink-0" />
    }

    switch (icon) {
      case '📅':
      case 'calendar':
        return <CalendarBlank size={size} weight="duotone" className={className} />
      case '🎨':
      case 'palette':
      case 'canvas':
        return <Kanban size={size} weight="duotone" className={className} />
      case '🔍':
      case 'search':
      case 'research':
        return <MagnifyingGlass size={size} weight="duotone" className={className} />
      case '🎬':
      case 'clapperboard':
      case 'project':
        return <FilmSlate size={size} weight="duotone" className={className} />
      case '🚀':
      case 'rocket':
        return <RocketLaunch size={size} weight="duotone" className={className} />
      case '🔒':
      case 'lock':
        return <Lock size={size} weight="duotone" className={className} />
      case '⚡':
      case 'lightning':
        return <Lightning size={size} weight="duotone" className={className} />
      case '🔄':
      case 'sync':
        return <ArrowsClockwise size={size} weight="duotone" className={className} />
      case '💡':
      case 'idea':
        return <Lightbulb size={size} weight="duotone" className={className} />
      case '✨':
      case '✦':
      case 'sparkle':
        return <Sparkle size={size} weight="duotone" className={className} />
      case '📁':
      case 'folder':
        return <Folder size={size} weight="duotone" className={className} />
      case '🏷️':
      case 'tag':
        return <Tag size={size} weight="duotone" className={className} />
      case '📊':
      case 'chart':
        return <ChartBar size={size} weight="duotone" className={className} />
      case '📌':
      case 'pin':
        return <PushPin size={size} weight="duotone" className={className} />
      case '📝':
      case '📄':
      case 'doc':
        return <FileText size={size} weight="duotone" className={className} />
    }

    const lower = (title || '').toLowerCase()
    if (lower.includes('diario') || lower.includes('journal')) {
      return <CalendarBlank size={size} weight="duotone" className={className} />
    }
    if (lower.includes('investig') || lower.includes('research')) {
      return <MagnifyingGlass size={size} weight="duotone" className={className} />
    }
    if (lower.includes('plano') || lower.includes('proyecto')) {
      return <FilmSlate size={size} weight="duotone" className={className} />
    }
    if (lower.includes('tablero') || lower.includes('inspiraci')) {
      return <Kanban size={size} weight="duotone" className={className} />
    }

    if (viewMode === 'canvas') {
      return <Kanban size={size} weight="duotone" className={className} />
    }
    if (viewMode === 'split') {
      return <Columns size={size} weight="duotone" className={className} />
    }

    return <FileText size={size} weight="duotone" className={className} />
  }

  if (onClick) {
    return (
      <span
        onClick={onClick}
        className="shrink-0 hover:scale-120 transition-transform cursor-pointer p-0.5 rounded hover:bg-black/10 dark:hover:bg-white/10 flex items-center justify-center"
        title="Cambiar icono de nota"
      >
        {renderIcon()}
      </span>
    )
  }

  return renderIcon()
}

export function Sidebar({
  spaces = [],
  currentSpaceId = DEFAULT_SPACE_ID,
  onSelectSpace,
  currentMember,
  onSelectMember,
  authUser,
  onOpenAuthModal,
  onOpenProfileModal,
  onOpenUserManagementModal,
  onSignOut,
  onOpenCreateSpace,
  onRenameSpace,
  onDeleteSpace,
  workspaces,
  currentWorkspaceId,
  onSelectWorkspace,
  onToggleSidebar,
  onOpenSettings,
  onOpenSearch,
  onOpenAllDocs,
  onOpenTrash,
  onOpenImport,
  onOpenTemplates,
  onOpenShortcuts,
  onOpenKnowledgeGraph,
  syncStatus,
  darkMode,
  onToggleDarkMode,
  activeNavigation,
  onSelectNavigation
}: SidebarProps) {
  // Collapsible sections state
  const [favoritesOpen, setFavoritesOpen] = useState(true)
  const [privateNotesOpen, setPrivateNotesOpen] = useState(true)
  const [pagesOpen, setPagesOpen] = useState(true)
  const [folderOpenMap, setFolderOpenMap] = useState<Record<string, boolean>>({ 'First Folder': true })
  const [isCreatingFolder, setIsCreatingFolder] = useState(false)
  const [newFolderName, setNewFolderName] = useState('')
  const [toolsOpen, setToolsOpen] = useState(false)

  // Resizable sidebar state (min: 200px, max: 600px)
  const [sidebarWidth, setSidebarWidth] = useState<number>(() => {
    try {
      const saved = localStorage.getItem('seven_note_sidebar_width')
      if (saved) {
        const parsed = parseInt(saved, 10)
        if (!isNaN(parsed) && parsed >= 180 && parsed <= 700) {
          return parsed
        }
      }
    } catch {
      // ignore
    }
    return 260
  })
  const [isResizing, setIsResizing] = useState(false)

  useEffect(() => {
    if (!isResizing) return

    const handleMouseMove = (e: MouseEvent) => {
      // Sidebar is on the left, so width is directly mouse X position
      const clampedWidth = Math.min(Math.max(e.clientX, 180), 650)
      setSidebarWidth(clampedWidth)
    }

    const handleMouseUp = () => {
      setIsResizing(false)
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }

    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'

    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)

    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }
  }, [isResizing])

  // Save width to localStorage when resizing ends or changes
  useEffect(() => {
    try {
      localStorage.setItem('seven_note_sidebar_width', sidebarWidth.toString())
    } catch {
      // ignore
    }
  }, [sidebarWidth])

  const activeMember = currentMember || getCurrentMember()

  // Workspace switcher dropdown state
  const [showSpaceMenu, setShowSpaceMenu] = useState(false)
  const [editingSpaceId, setEditingSpaceId] = useState<string | null>(null)
  const [editingSpaceName, setEditingSpaceName] = useState('')
  const [emojiPickerTarget, setEmojiPickerTarget] = useState<{ id: string; type: 'space' | 'doc'; currentIcon?: string } | null>(null)

  const visibleSpaces = spaces.filter(
    (s) => !s.isDeleted && isSpaceVisible(s, activeMember, authUser?.id)
  )

  const currentSpace = visibleSpaces.find((s) => s.id === currentSpaceId) || visibleSpaces[0] || {
    id: DEFAULT_SPACE_ID,
    name: 'Espacio Principal',
    icon: '✦',
    color: '#1e96eb'
  }

  const isCurrentSpacePrivate = Boolean(currentSpace.isPrivate)

  // Drag and Drop state & refs (direct grab & move)
  const [draggedDocId, setDraggedDocId] = useState<string | null>(null)
  const [draggedFolderName, setDraggedFolderName] = useState<string | null>(null)
  const [dropTarget, setDropTarget] = useState<{
    type: 'doc' | 'folder' | 'folderHeader' | 'root'
    id?: string
    folder?: string | null
    position?: 'before' | 'after' | 'inside'
  } | null>(null)

  const draggedDocIdRef = useRef<string | null>(null)
  const draggedFolderNameRef = useRef<string | null>(null)
  const hasJustDraggedRef = useRef<boolean>(false)

  // Persisted folder order for current space
  const [folderOrder, setFolderOrder] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem(`seven_note_folder_order_${currentSpace.id}`)
      return saved ? JSON.parse(saved) : []
    } catch {
      return []
    }
  })

  useEffect(() => {
    try {
      const saved = localStorage.getItem(`seven_note_folder_order_${currentSpace.id}`)
      setFolderOrder(saved ? JSON.parse(saved) : [])
    } catch {
      setFolderOrder([])
    }
  }, [currentSpace.id])


  // Create new page inside current workspace (can be private for activeMember or team document)
  const handleCreateWorkspace = async (
    parentId: string | null = null,
    folderName: string | null = null,
    viewMode: 'doc' | 'canvas' = 'doc',
    isPrivate: boolean = isCurrentSpacePrivate
  ) => {
    const newId = crypto.randomUUID()
    const now = Date.now()
    try {
      await db.workspaces.add({
        id: newId,
        parentId,
        spaceId: currentSpace.id,
        folder: folderName,
        title: isPrivate
          ? (viewMode === 'canvas' ? 'Tablero privado sin título' : 'Nota privada sin título')
          : (viewMode === 'canvas' ? 'Tablero sin título' : 'Nota sin título'),
        icon: '',
        color: isPrivate ? activeMember.color : '#1e96eb',
        viewMode,
        docContent: '<p></p>',
        createdAt: now,
        updatedAt: now,
        isFavorite: false,
        isDeleted: false,
        syncStatus: 'pending',
        isPrivate,
        ownerMember: activeMember.id,
        ownerName: activeMember.name,
        createdBy: activeMember.name,
        activeProperties: [
          'tags',
          'documentMode',
          'isJournal',
          'templateName',
          'createdAt',
          'updatedAt'
        ]
      })
      onSelectWorkspace(newId)
      if (onSelectNavigation) onSelectNavigation('workspace')
    } catch (err) {
      console.error('Error creating page', err)
    }
  }

  // Toggle favorite
  const handleToggleFavorite = async (e: React.MouseEvent, ws: WorkspaceItem) => {
    e.stopPropagation()
    try {
      await db.workspaces.update(ws.id, {
        isFavorite: !ws.isFavorite,
        updatedAt: Date.now(),
        syncStatus: 'pending'
      })
    } catch (err) {
      console.error('Error toggling favorite', err)
    }
  }

  // Toggle private vs team
  const handleTogglePrivateWorkspace = async (e: React.MouseEvent, ws: WorkspaceItem) => {
    e.stopPropagation()
    const nextPrivate = !ws.isPrivate
    try {
      await db.workspaces.update(ws.id, {
        isPrivate: nextPrivate,
        ownerMember: nextPrivate ? (ws.ownerMember || activeMember.id) : (ws.ownerMember || activeMember.id),
        ownerName: nextPrivate ? (ws.ownerName || activeMember.name) : ws.ownerName,
        updatedAt: Date.now(),
        syncStatus: 'pending'
      })
      syncEngine.scheduleSync(500)
      toast.success(nextPrivate ? 'Nota cambiada a MODO PRIVADO (solo tú)' : 'Nota cambiada a MODO EQUIPO (pública)')
    } catch (err) {
      console.error('Error toggling private', err)
    }
  }

  // Move to trash
  const handleDeleteWorkspace = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation()
    if (!confirm('¿Mover esta página a la papelera?')) return
    try {
      await db.workspaces.update(id, {
        isDeleted: true,
        updatedAt: Date.now(),
        syncStatus: 'pending'
      })

      if (id === currentWorkspaceId) {
        const remaining = workspaces.filter((w) => w.id !== id && !w.isDeleted)
        if (remaining.length > 0) onSelectWorkspace(remaining[0].id)
      }
    } catch (err) {
      console.error('Error moving to trash', err)
    }
  }

  const getSortOrder = (item: WorkspaceItem) => {
    return typeof item.sortOrder === 'number' && !isNaN(item.sortOrder) ? item.sortOrder : (item.createdAt || 0)
  }

  const sortByOrder = (a: WorkspaceItem, b: WorkspaceItem) => {
    const diff = getSortOrder(a) - getSortOrder(b)
    if (diff !== 0) return diff
    return (a.createdAt || 0) - (b.createdAt || 0)
  }

  // Filter: Visible items for activeMember (Team docs OR private docs owned by activeMember)
  const activeWorkspaces = workspaces.filter(
    (w) =>
      !w.isDeleted &&
      (w.spaceId || DEFAULT_SPACE_ID) === currentSpace.id &&
      isWorkspaceVisible(w, activeMember, authUser?.id)
  )
  const privateDocs = activeWorkspaces.filter((w) => w.isPrivate).sort(sortByOrder)
  const teamDocs = activeWorkspaces.filter((w) => !w.isPrivate)
  const favorites = activeWorkspaces.filter((w) => w.isFavorite)


  const allFolders = Array.from(
    new Set(
      teamDocs
        .map((w) => w.folder?.trim())
        .filter((f): f is string => Boolean(f))
    )
  )

  const orderedFolders = useMemo(() => {
    const list = [...allFolders]
    if (!folderOrder || folderOrder.length === 0) return list
    return list.sort((a, b) => {
      const idxA = folderOrder.indexOf(a)
      const idxB = folderOrder.indexOf(b)
      if (idxA !== -1 && idxB !== -1) return idxA - idxB
      if (idxA !== -1) return -1
      if (idxB !== -1) return 1
      return a.localeCompare(b)
    })
  }, [allFolders, folderOrder])

  const rootPages = teamDocs
    .filter((w) => !w.parentId && (!w.folder || !w.folder.trim()))
    .sort(sortByOrder)

  // Direct grab & move Drag & Drop Handlers
  const handleDocDragStart = (e: React.DragEvent, doc: WorkspaceItem) => {
    draggedDocIdRef.current = doc.id
    draggedFolderNameRef.current = null
    hasJustDraggedRef.current = true
    e.dataTransfer.setData('text/plain', doc.id)
    e.dataTransfer.setData('application/seven-note-doc', doc.id)
    e.dataTransfer.effectAllowed = 'move'

    // Defer state update so HTML5 drag ghost image is created without layout flickering
    setTimeout(() => {
      setDraggedDocId(doc.id)
      setDraggedFolderName(null)
    }, 0)
  }

  const handleDocDragEnd = () => {
    draggedDocIdRef.current = null
    draggedFolderNameRef.current = null
    setDraggedDocId(null)
    setDraggedFolderName(null)
    setDropTarget(null)
    setTimeout(() => {
      hasJustDraggedRef.current = false
    }, 120)
  }

  const handleDocDragOver = (
    e: React.DragEvent,
    targetDoc: WorkspaceItem,
    targetFolder: string | null
  ) => {
    const currentDraggedId = draggedDocIdRef.current || draggedDocId
    if (!currentDraggedId || currentDraggedId === targetDoc.id) return
    e.preventDefault()
    e.stopPropagation()
    e.dataTransfer.dropEffect = 'move'

    const rect = e.currentTarget.getBoundingClientRect()
    const relY = e.clientY - rect.top
    const position: 'before' | 'after' = relY < rect.height / 2 ? 'before' : 'after'

    if (
      dropTarget?.type !== 'doc' ||
      dropTarget?.id !== targetDoc.id ||
      dropTarget?.position !== position ||
      dropTarget?.folder !== targetFolder
    ) {
      setDropTarget({
        type: 'doc',
        id: targetDoc.id,
        folder: targetFolder,
        position
      })
    }
  }

  const handleDocDrop = async (
    e: React.DragEvent,
    targetDoc: WorkspaceItem,
    targetFolder: string | null
  ) => {
    e.preventDefault()
    e.stopPropagation()

    const movingDocId =
      draggedDocIdRef.current ||
      e.dataTransfer.getData('application/seven-note-doc') ||
      e.dataTransfer.getData('text/plain') ||
      draggedDocId
    const currentPosition = dropTarget?.position || 'after'

    draggedDocIdRef.current = null
    draggedFolderNameRef.current = null
    setDraggedDocId(null)
    setDraggedFolderName(null)
    setDropTarget(null)
    setTimeout(() => {
      hasJustDraggedRef.current = false
    }, 120)

    if (!movingDocId || movingDocId === targetDoc.id) return

    const movingDoc = workspaces.find((w) => w.id === movingDocId)
    if (!movingDoc) return

    // Prevent moving parent page into its child
    if (targetDoc.parentId === movingDocId) return

    // Determine target group docs
    let groupDocs: WorkspaceItem[] = []
    if (movingDoc.isPrivate) {
      groupDocs = activeWorkspaces.filter((w) => w.isPrivate)
    } else if (targetDoc.parentId) {
      groupDocs = activeWorkspaces.filter((w) => w.parentId === targetDoc.parentId)
    } else if (targetFolder) {
      groupDocs = teamDocs.filter((w) => w.folder === targetFolder)
    } else {
      groupDocs = teamDocs.filter((w) => !w.parentId && (!w.folder || !w.folder.trim()))
    }

    // Sort according to current order
    groupDocs.sort(sortByOrder)

    // Remove movingDoc if already in this group
    groupDocs = groupDocs.filter((w) => w.id !== movingDocId)

    // Insert movingDoc at target position relative to targetDoc
    const targetIdx = groupDocs.findIndex((w) => w.id === targetDoc.id)
    const insertIdx = targetIdx === -1
      ? groupDocs.length
      : currentPosition === 'before'
        ? targetIdx
        : targetIdx + 1

    const updatedMovingDoc: WorkspaceItem = {
      ...movingDoc,
      folder: movingDoc.isPrivate ? null : targetFolder,
      parentId: targetDoc.parentId || null
    }
    groupDocs.splice(insertIdx, 0, updatedMovingDoc)

    // Assign spaced sortOrder values to ensure persistent order
    const now = Date.now()
    const updates = groupDocs.map((w, idx) => ({
      key: w.id,
      changes: {
        folder: movingDoc.isPrivate ? null : targetFolder,
        parentId: targetDoc.parentId || null,
        sortOrder: (idx + 1) * 1000,
        updatedAt: now,
        syncStatus: 'pending' as const
      }
    }))

    try {
      await db.workspaces.bulkUpdate(updates)
      syncEngine.scheduleSync(500)
    } catch (err) {
      console.error('Error reordering document', err)
    }
  }

  // Folder header drag and drop handlers
  const handleFolderHeaderDragOver = (e: React.DragEvent, folderName: string) => {
    const currentDraggedDoc = draggedDocIdRef.current || draggedDocId
    const currentDraggedFolder = draggedFolderNameRef.current || draggedFolderName
    if (!currentDraggedDoc && !currentDraggedFolder) return
    e.preventDefault()
    e.stopPropagation()
    e.dataTransfer.dropEffect = 'move'

    if (currentDraggedDoc) {
      if (dropTarget?.type !== 'folderHeader' || dropTarget?.folder !== folderName) {
        setDropTarget({
          type: 'folderHeader',
          folder: folderName,
          position: 'inside'
        })
      }
    } else if (currentDraggedFolder && currentDraggedFolder !== folderName) {
      const rect = e.currentTarget.getBoundingClientRect()
      const relY = e.clientY - rect.top
      const position: 'before' | 'after' = relY < rect.height / 2 ? 'before' : 'after'
      if (dropTarget?.folder !== folderName || dropTarget?.position !== position) {
        setDropTarget({
          type: 'folder',
          folder: folderName,
          position
        })
      }
    }
  }

  const handleFolderHeaderDrop = async (e: React.DragEvent, folderName: string) => {
    e.preventDefault()
    e.stopPropagation()

    const movingFolder =
      draggedFolderNameRef.current ||
      draggedFolderName ||
      e.dataTransfer.getData('application/seven-note-folder')
    const movingDocId =
      draggedDocIdRef.current ||
      draggedDocId ||
      e.dataTransfer.getData('application/seven-note-doc') ||
      (!movingFolder ? e.dataTransfer.getData('text/plain') : null)
    const currentPosition = dropTarget?.position

    draggedDocIdRef.current = null
    draggedFolderNameRef.current = null
    setDraggedDocId(null)
    setDraggedFolderName(null)
    setDropTarget(null)
    setTimeout(() => {
      hasJustDraggedRef.current = false
    }, 120)

    if (movingFolder && movingFolder !== folderName) {
      const currentList = [...orderedFolders]
      const filtered = currentList.filter((f) => f !== movingFolder)
      const toIndex = filtered.indexOf(folderName)
      const insertIndex = toIndex === -1
        ? filtered.length
        : currentPosition === 'before'
          ? toIndex
          : toIndex + 1

      filtered.splice(insertIndex, 0, movingFolder)
      setFolderOrder(filtered)
      try {
        localStorage.setItem(`seven_note_folder_order_${currentSpace.id}`, JSON.stringify(filtered))
      } catch (err) {
        console.warn('Error saving folder order', err)
      }
      return
    }

    if (movingDocId) {
      const movingDoc = workspaces.find((w) => w.id === movingDocId)
      if (!movingDoc) return

      const existingInFolder = teamDocs
        .filter((w) => w.folder === folderName && w.id !== movingDocId)
        .sort(sortByOrder)

      const maxOrder = existingInFolder.length > 0
        ? Math.max(...existingInFolder.map((w, idx) => (typeof w.sortOrder === 'number' ? w.sortOrder : (idx + 1) * 1000)))
        : 0

      await db.workspaces.update(movingDocId, {
        folder: folderName,
        parentId: null,
        sortOrder: maxOrder + 1000,
        updatedAt: Date.now(),
        syncStatus: 'pending'
      })
      syncEngine.scheduleSync(500)
      setFolderOpenMap((prev) => ({ ...prev, [folderName]: true }))
    }
  }

  const handleFolderDragStart = (e: React.DragEvent, folderName: string) => {
    draggedFolderNameRef.current = folderName
    draggedDocIdRef.current = null
    hasJustDraggedRef.current = true
    e.dataTransfer.setData('application/seven-note-folder', folderName)
    e.dataTransfer.effectAllowed = 'move'
    setTimeout(() => {
      setDraggedFolderName(folderName)
      setDraggedDocId(null)
    }, 0)
  }

  const handleFolderDragEnd = () => {
    draggedFolderNameRef.current = null
    draggedDocIdRef.current = null
    setDraggedFolderName(null)
    setDraggedDocId(null)
    setDropTarget(null)
    setTimeout(() => {
      hasJustDraggedRef.current = false
    }, 120)
  }

  const handleEmptyFolderDragOver = (e: React.DragEvent, folderName: string) => {
    if (!draggedDocIdRef.current && !draggedDocId) return
    e.preventDefault()
    e.stopPropagation()
    e.dataTransfer.dropEffect = 'move'
    if (dropTarget?.type !== 'folderHeader' || dropTarget?.folder !== folderName) {
      setDropTarget({
        type: 'folderHeader',
        folder: folderName,
        position: 'inside'
      })
    }
  }

  const handleRootHeaderDragOver = (e: React.DragEvent) => {
    if (!draggedDocIdRef.current && !draggedDocId) return
    e.preventDefault()
    e.stopPropagation()
    e.dataTransfer.dropEffect = 'move'
    if (dropTarget?.type !== 'root') {
      setDropTarget({
        type: 'root',
        position: 'inside'
      })
    }
  }

  const handleRootHeaderDrop = async (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    const movingDocId =
      draggedDocIdRef.current ||
      e.dataTransfer.getData('application/seven-note-doc') ||
      e.dataTransfer.getData('text/plain') ||
      draggedDocId

    draggedDocIdRef.current = null
    setDraggedDocId(null)
    setDropTarget(null)
    if (!movingDocId) return

    const movingDoc = workspaces.find((w) => w.id === movingDocId)
    if (!movingDoc || (!movingDoc.folder && !movingDoc.parentId)) return

    const existingRoot = teamDocs
      .filter((w) => !w.parentId && (!w.folder || !w.folder.trim()) && w.id !== movingDocId)
      .sort(sortByOrder)

    const maxOrder = existingRoot.length > 0
      ? Math.max(...existingRoot.map((w, idx) => (typeof w.sortOrder === 'number' ? w.sortOrder : (idx + 1) * 1000)))
      : 0

    await db.workspaces.update(movingDocId, {
      folder: null,
      parentId: null,
      sortOrder: maxOrder + 1000,
      updatedAt: Date.now(),
      syncStatus: 'pending'
    })
    syncEngine.scheduleSync(500)
    toast.success('Documento movido fuera de la carpeta')
  }

  const toggleFolder = (folderName: string) => {
    setFolderOpenMap((prev) => ({
      ...prev,
      [folderName]: prev[folderName] === undefined ? false : !prev[folderName]
    }))
  }

  const handleCreateFolder = async (name: string) => {
    const trimmed = name.trim()
    if (!trimmed) {
      setIsCreatingFolder(false)
      setNewFolderName('')
      return
    }

    setFolderOpenMap((prev) => ({ ...prev, [trimmed]: true }))
    setIsCreatingFolder(false)
    setNewFolderName('')

    await handleCreateWorkspace(null, trimmed, 'doc', false)
    toast.success(`Carpeta "${trimmed}" creada`)
  }

  const handleRenameFolder = async (oldName: string, newName: string) => {
    const trimmed = newName.trim()
    if (!trimmed || trimmed === oldName) return

    const docsToUpdate = teamDocs.filter((w) => w.folder === oldName)
    try {
      await Promise.all(
        docsToUpdate.map((w) =>
          db.workspaces.update(w.id, {
            folder: trimmed,
            updatedAt: Date.now(),
            syncStatus: 'pending'
          })
        )
      )
      setFolderOpenMap((prev) => {
        const next = { ...prev }
        next[trimmed] = next[oldName] ?? true
        delete next[oldName]
        return next
      })
      toast.success(`Carpeta renombrada a "${trimmed}"`)
    } catch (err) {
      console.error('Error renaming folder', err)
    }
  }

  const handleDeleteFolder = async (folderName: string) => {
    if (!confirm(`¿Eliminar la carpeta "${folderName}" y mover sus notas a la raíz?`)) return
    const docsToUpdate = teamDocs.filter((w) => w.folder === folderName)
    try {
      await Promise.all(
        docsToUpdate.map((w) =>
          db.workspaces.update(w.id, {
            folder: null,
            updatedAt: Date.now(),
            syncStatus: 'pending'
          })
        )
      )
      toast.success(`Carpeta "${folderName}" eliminada`)
    } catch (err) {
      console.error('Error deleting folder', err)
    }
  }

  return (
    <aside
      style={{ width: `${sidebarWidth}px` }}
      className={`relative h-full flex flex-col bg-[#fbfbfa] dark:bg-[#161619] border-r border-black/[0.05] dark:border-white/[0.06] text-neutral-800 dark:text-neutral-200 select-none shrink-0 text-xs font-sans shadow-2xl md:shadow-none max-w-[85vw] ${
        isResizing ? '' : 'transition-[width] duration-75'
      }`}
    >
      {/* 1. Header: Brand & Collapse Sidebar */}
      <div className="h-10 px-3 pt-2 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 rounded-md bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 flex items-center justify-center font-bold text-xs shadow-xs">
            7
          </div>
          <span className="font-semibold text-xs tracking-tight text-neutral-800 dark:text-neutral-200">
            Seven Note
          </span>
        </div>

        {/* Right buttons: Collapse on desktop, Close on mobile */}
        <div className="flex items-center gap-0.5 shrink-0">
          <button
            onClick={onToggleSidebar}
            className="p-1.5 rounded-lg text-neutral-400 hover:text-neutral-800 dark:hover:text-neutral-200 hover:bg-black/[0.04] dark:hover:bg-white/[0.06] transition cursor-pointer"
            title="Cerrar barra lateral"
          >
            <X size={16} weight="bold" className="md:hidden text-neutral-600 dark:text-neutral-300" />
            <SidebarSimple size={15} weight="duotone" className="hidden md:block" />
          </button>
        </div>
      </div>

      {/* 2. Workspace Bar (Arriba de Nueva Nota) */}
      <div className="px-3 pt-2 pb-1 relative">
        <button
          type="button"
          onClick={() => setShowSpaceMenu(!showSpaceMenu)}
          className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-xl border border-black/[0.06] dark:border-white/[0.08] hover:border-black/[0.12] dark:hover:border-white/[0.15] bg-black/[0.02] dark:bg-white/[0.03] hover:bg-black/[0.05] dark:hover:bg-white/[0.06] cursor-pointer transition text-left group shadow-2xs"
          title="Cambiar espacio de trabajo"
        >
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <div
              className="w-5 h-5 rounded-lg flex items-center justify-center text-white shrink-0 shadow-2xs font-semibold text-[11px] transition-transform group-hover:scale-105"
              style={{ backgroundColor: currentSpace.color || '#1e96eb' }}
            >
              <AppleEmoji emoji={currentSpace.icon || currentSpace.name.charAt(0) || '✦'} size={13} />
            </div>
            <div className="flex flex-col min-w-0 flex-1 leading-tight">
              <div className="flex items-center gap-1 min-w-0">
                <span className="font-semibold text-neutral-900 dark:text-neutral-100 truncate text-xs">
                  {currentSpace.name}
                </span>
                {isCurrentSpacePrivate && (
                  <span className="text-amber-500 shrink-0" title="Espacio privado: Solo visible para ti">
                    <Lock size={11} weight="bold" />
                  </span>
                )}
              </div>
              <span className="text-[10px] text-neutral-400 dark:text-neutral-500 truncate">
                {isCurrentSpacePrivate ? 'Espacio privado' : 'Espacio de trabajo'}
              </span>
            </div>
          </div>
          <CaretDown size={14} className="text-neutral-400 group-hover:text-neutral-700 dark:group-hover:text-neutral-200 transition shrink-0 ml-1.5" />
        </button>

        {/* Space Switcher Popover Dropdown */}
        {showSpaceMenu && (
          <>
            <div
              className="fixed inset-0 z-40"
              onClick={() => {
                setShowSpaceMenu(false)
                setEditingSpaceId(null)
              }}
            />
            <div
              className="absolute left-3 right-3 top-12 z-50 bg-white dark:bg-[#1e1f23] border border-black/[0.08] dark:border-white/[0.1] rounded-xl sm:rounded-2xl shadow-2xl p-1.5 sm:p-2 animate-in fade-in zoom-in-95 duration-100 flex flex-col gap-1 max-h-[60vh] overflow-y-auto custom-scrollbar"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between px-2.5 py-1">
                <span className="text-[10px] uppercase font-bold text-neutral-400 tracking-wider">
                  Espacios
                </span>
                <span className="text-[10px] bg-black/5 dark:bg-white/10 text-neutral-500 px-1.5 py-0.5 rounded-full font-mono">
                  {visibleSpaces.length}
                </span>
              </div>

              <div className="space-y-0.5 max-h-48 overflow-y-auto custom-scrollbar">
                {visibleSpaces.map((sp) => {
                  const isSelected = sp.id === currentSpace.id
                  const docsInSpace = workspaces.filter(
                    (w) => !w.isDeleted && (w.spaceId || DEFAULT_SPACE_ID) === sp.id && isWorkspaceVisible(w, activeMember, authUser?.id)
                  ).length
                  const isEditingThis = editingSpaceId === sp.id

                  if (isEditingThis) {
                    return (
                      <div key={sp.id} className="p-1">
                        <input
                          type="text"
                          value={editingSpaceName}
                          onChange={(e) => setEditingSpaceName(e.target.value)}
                          onBlur={() => {
                            if (editingSpaceName.trim() && onRenameSpace) {
                              onRenameSpace(sp.id, editingSpaceName.trim())
                            }
                            setEditingSpaceId(null)
                          }}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              if (editingSpaceName.trim() && onRenameSpace) {
                                onRenameSpace(sp.id, editingSpaceName.trim())
                              }
                              setEditingSpaceId(null)
                            } else if (e.key === 'Escape') {
                              setEditingSpaceId(null)
                            }
                          }}
                          autoFocus
                          className="w-full bg-neutral-100 dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-600 rounded-lg px-2.5 py-1 text-xs outline-none ring-1 ring-blue-500"
                        />
                      </div>
                    )
                  }

                  return (
                    <div
                      key={sp.id}
                      onClick={() => {
                        if (onSelectSpace) onSelectSpace(sp.id)
                        setShowSpaceMenu(false)
                      }}
                      className={`group w-full flex items-center justify-between px-2.5 py-1.5 rounded-xl text-xs cursor-pointer transition ${
                        isSelected
                          ? 'bg-black/[0.05] dark:bg-white/[0.08] text-neutral-900 dark:text-neutral-100 font-semibold'
                          : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-100 hover:bg-black/[0.03] dark:hover:bg-white/[0.05]'
                      }`}
                    >
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        <div
                          onClick={(e) => {
                            e.stopPropagation()
                            setShowSpaceMenu(false)
                            setEmojiPickerTarget({ id: sp.id, type: 'space', currentIcon: sp.icon })
                          }}
                          className="w-5 h-5 rounded-md flex items-center justify-center text-[10px] text-white shrink-0 shadow-2xs font-bold hover:scale-115 active:scale-95 transition-transform cursor-pointer"
                          style={{ backgroundColor: sp.color || '#1e96eb' }}
                          title="Cambiar icono de este espacio"
                        >
                          <AppleEmoji emoji={sp.icon || sp.name.charAt(0)} size={12} />
                        </div>
                        <span className="truncate min-w-0 flex-1 text-left">{sp.name}</span>
                        {sp.isPrivate && (
                          <span
                            className="inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded-full text-[9px] font-semibold bg-amber-500/15 text-amber-600 dark:text-amber-400 shrink-0"
                            title="Espacio privado: Solo visible para ti"
                          >
                            <Lock size={9} weight="bold" />
                            <span>Privado</span>
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0 ml-2">
                        <span className="text-[10px] opacity-60 font-mono tabular-nums">
                          {docsInSpace}
                        </span>
                        {isSelected && <Check size={14} weight="bold" className="text-neutral-900 dark:text-white shrink-0" />}
                        <button
                          type="button"
                          onClick={async (e) => {
                            e.stopPropagation()
                            const nextPrivate = !sp.isPrivate
                            await updateSpace(sp.id, {
                              isPrivate: nextPrivate,
                              ownerMember: nextPrivate ? (sp.ownerMember || activeMember.id) : sp.ownerMember,
                              ownerName: nextPrivate ? (sp.ownerName || activeMember.name) : sp.ownerName,
                              userId: nextPrivate ? (sp.userId || authUser?.id) : sp.userId,
                              updatedAt: Date.now(),
                              syncStatus: 'pending'
                            })
                            syncEngine.scheduleSync(500)
                            toast.success(nextPrivate ? `Espacio "${sp.name}" cambiado a MODO PRIVADO (solo tú)` : `Espacio "${sp.name}" cambiado a MODO EQUIPO (público)`)
                          }}
                          className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-black/10 dark:hover:bg-white/10 text-neutral-400 hover:text-neutral-800 dark:hover:text-neutral-200 transition"
                          title={sp.isPrivate ? 'Hacer público para el equipo' : 'Hacer privado (solo tú)'}
                        >
                          {sp.isPrivate ? (
                            <LockOpen size={13} weight="duotone" className="text-amber-500" />
                          ) : (
                            <Lock size={13} weight="duotone" className="text-neutral-400 hover:text-amber-500" />
                          )}
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation()
                            setEditingSpaceId(sp.id)
                            setEditingSpaceName(sp.name)
                          }}
                          className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-black/10 dark:hover:bg-white/10 text-neutral-400 hover:text-neutral-800 dark:hover:text-neutral-200 transition"
                          title="Renombrar espacio"
                        >
                          <PencilSimple size={13} weight="duotone" />
                        </button>
                        {visibleSpaces.length > 1 && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation()
                              if (onDeleteSpace) onDeleteSpace(sp.id)
                            }}
                            className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-rose-500/10 text-neutral-400 hover:text-rose-500 transition"
                            title="Eliminar espacio"
                          >
                            <Trash size={13} weight="duotone" />
                          </button>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>

              <div className="h-[1px] bg-black/[0.06] dark:border-white/[0.06] my-1" />

              <button
                type="button"
                onClick={() => {
                  setShowSpaceMenu(false)
                  if (onOpenCreateSpace) onOpenCreateSpace()
                }}
                className="w-full text-left px-2.5 py-1.5 rounded-xl hover:bg-black/[0.04] dark:hover:bg-white/[0.06] text-neutral-900 dark:text-neutral-100 font-semibold transition text-xs flex items-center gap-2 cursor-pointer"
              >
                <Plus size={14} weight="bold" className="shrink-0" />
                <span>Nuevo espacio de trabajo</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setShowSpaceMenu(false)
                  onOpenSettings()
                }}
                className="w-full text-left px-2.5 py-1.5 rounded-xl hover:bg-black/[0.04] dark:hover:bg-white/[0.06] text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-100 transition text-xs flex items-center gap-2 cursor-pointer"
              >
                <Gear size={14} weight="duotone" className="shrink-0" />
                <span>Ajustes del espacio</span>
              </button>
            </div>
          </>
        )}
      </div>

      {/* 2. Tactile Pill Button: "+ Nueva Nota / Página" */}
      <div className="px-3 py-2">
        <button
          onClick={() => handleCreateWorkspace(null, null, 'doc', isCurrentSpacePrivate)}
          className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-2xl bg-neutral-900 hover:bg-black dark:bg-white dark:hover:bg-neutral-100 text-white dark:text-neutral-900 font-semibold text-xs shadow-md hover:shadow-lg transition-all active:scale-[0.98] cursor-pointer group"
          title={isCurrentSpacePrivate ? 'Crear nueva nota en espacio privado' : 'Crear nueva página o nota'}
        >
          <Plus size={14} weight="bold" className="transition-transform group-hover:rotate-90" />
          <span>{isCurrentSpacePrivate ? 'Nueva Nota Privada' : 'Nueva Nota'}</span>
        </button>
      </div>

      {/* 4. Search Input Button */}
      <div className="px-3 pb-2">
        <div
          onClick={onOpenSearch}
          className="flex items-center justify-between px-3 py-1.5 rounded-xl bg-black/[0.03] dark:bg-white/[0.05] hover:bg-black/[0.05] dark:hover:bg-white/[0.08] border border-black/[0.04] dark:border-white/[0.06] text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 cursor-pointer transition"
        >
          <div className="flex items-center gap-2">
            <MagnifyingGlass size={14} weight="duotone" />
            <span className="text-xs">Buscar...</span>
          </div>
          <kbd className="px-1.5 py-0.5 rounded-md bg-white dark:bg-neutral-800 text-[10px] font-mono text-neutral-500 border border-black/5 dark:border-white/10 shadow-2xs">
            Ctrl K
          </kbd>
        </div>
      </div>

      {/* 5. Primary Views Navigation */}
      <div className="px-2 space-y-0.5">
        {/* All Docs */}
        <button
          onClick={onOpenAllDocs}
          className={`w-full flex items-center justify-between px-3 py-2 rounded-xl font-medium transition cursor-pointer ${
            activeNavigation === 'all-docs'
              ? 'bg-black/[0.06] dark:bg-white/[0.08] text-neutral-900 dark:text-neutral-100 font-semibold'
              : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-100 hover:bg-black/[0.03] dark:hover:bg-white/[0.05]'
          }`}
        >
          <div className="flex items-center gap-2.5">
            <FileText size={16} weight="duotone" className="text-neutral-700 dark:text-neutral-300 shrink-0" />
            <span>Todos los documentos</span>
          </div>
          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded-full bg-black/5 dark:bg-white/10 text-neutral-500 font-medium">
            {activeWorkspaces.length}
          </span>
        </button>

        {/* Knowledge Graph */}
        {onOpenKnowledgeGraph && (
          <button
            onClick={onOpenKnowledgeGraph}
            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-100 hover:bg-black/[0.03] dark:hover:bg-white/[0.05] font-medium transition cursor-pointer text-left"
          >
            <Graph size={16} weight="duotone" className="text-neutral-700 dark:text-neutral-300 shrink-0" />
            <span>Grafo de Conocimiento</span>
          </button>
        )}
      </div>

      {/* Divider */}
      <div className="px-4 py-2">
        <div className="h-[1px] bg-black/[0.04] dark:bg-white/[0.06]" />
      </div>

      {/* 6. Scrollable Structure: Favorites, Documents, Tags, Tools */}
      <div className="flex-1 overflow-y-auto px-2 space-y-4 custom-scrollbar">
        {/* FAVORITES */}
        <div>
          <div
            onClick={() => setFavoritesOpen(!favoritesOpen)}
            className="flex items-center justify-between px-2.5 py-1 text-[11px] font-semibold tracking-wider uppercase text-neutral-400 dark:text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300 cursor-pointer transition group"
          >
            <div className="flex items-center gap-1.5">
              {favoritesOpen ? (
                <CaretDown size={13} className="text-neutral-400 transition-transform" />
              ) : (
                <CaretRight size={13} className="text-neutral-400 transition-transform" />
              )}
              <span>Favoritos</span>
            </div>
            {favorites.length > 0 && (
              <span className="text-[10px] font-mono text-neutral-400">
                {favorites.length}
              </span>
            )}
          </div>

          {favoritesOpen && (
            <div className="mt-1 space-y-0.5">
              {favorites.length === 0 ? (
                <div className="px-3 py-1.5 text-[11px] text-neutral-400 italic">
                  Sin favoritos fijados
                </div>
              ) : (
                favorites.map((fav) => {
                  const isActive = fav.id === currentWorkspaceId
                  return (
                    <div
                      key={`fav-${fav.id}`}
                      onClick={() => onSelectWorkspace(fav.id)}
                      className={`group flex items-center justify-between px-2.5 py-1.5 rounded-xl cursor-pointer transition ${
                        isActive
                          ? 'bg-white dark:bg-[#202024] text-neutral-900 dark:text-neutral-100 font-semibold shadow-xs border border-black/[0.04] dark:border-white/[0.06]'
                          : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-100 hover:bg-black/[0.03] dark:hover:bg-white/[0.05] font-medium'
                      }`}
                    >
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        <DocumentItemIcon
                          icon={fav.icon}
                          viewMode={fav.viewMode}
                          title={fav.title}
                          onClick={(e) => {
                            e.stopPropagation()
                            setEmojiPickerTarget({ id: fav.id, type: 'doc', currentIcon: fav.icon })
                          }}
                        />
                        <span className="truncate flex-1">{renderWithAppleEmoji(fav.title || 'Untitled')}</span>
                      </div>
                      <button
                        onClick={(e) => handleToggleFavorite(e, fav)}
                        className="opacity-0 group-hover:opacity-100 text-amber-500 p-1"
                        title="Quitar de favoritos"
                      >
                        <Star size={13} weight="fill" className="text-amber-500" />
                      </button>
                    </div>
                  )
                })
              )}
            </div>
          )}
        </div>

        {/* SECCIÓN 1: NOTAS PRIVADAS DEL MIEMBRO ACTIVO */}
        <div>
          <div
            onClick={() => setPrivateNotesOpen(!privateNotesOpen)}
            className="flex items-center justify-between px-2.5 py-1 text-[11px] font-semibold tracking-wider uppercase text-neutral-400 dark:text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300 cursor-pointer transition group"
          >
            <div className="flex items-center gap-1.5">
              {privateNotesOpen ? (
                <CaretDown size={13} className="text-neutral-400 transition-transform" />
              ) : (
                <CaretRight size={13} className="text-neutral-400 transition-transform" />
              )}
              <Lock size={13} weight="duotone" className="text-neutral-500 dark:text-neutral-400 shrink-0" />
              <span>Mis Notas Privadas</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="text-[10px] font-mono text-neutral-400">
                {privateDocs.length}
              </span>
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  handleCreateWorkspace(null, null, 'doc', true)
                }}
                className="p-0.5 rounded hover:bg-black/10 dark:hover:bg-white/10 text-neutral-400 hover:text-neutral-800 dark:hover:text-neutral-200 transition"
                title="Crear nueva nota privada"
              >
                <Plus size={13} />
              </button>
            </div>
          </div>

          {privateNotesOpen && (
            <div className="mt-1 space-y-0.5">
              {privateDocs.length === 0 ? (
                <div className="px-3 py-1.5 text-[11px] text-neutral-400 italic flex items-center justify-between">
                  <span>Sin notas privadas</span>
                  <button
                    onClick={() => handleCreateWorkspace(null, null, 'doc', true)}
                    className="text-blue-500 hover:underline not-italic text-[11px]"
                  >
                    + Crear
                  </button>
                </div>
              ) : (
                privateDocs.map((doc) => {
                  const isActive = doc.id === currentWorkspaceId
                  const isBeingDragged = draggedDocId === doc.id
                  const isDropTargetBefore = dropTarget?.id === doc.id && dropTarget?.position === 'before'
                  const isDropTargetAfter = dropTarget?.id === doc.id && dropTarget?.position === 'after'

                  return (
                    <div
                      key={`priv-${doc.id}`}
                      draggable={true}
                      onDragStart={(e) => handleDocDragStart(e, doc)}
                      onDragEnd={handleDocDragEnd}
                      onDragOver={(e) => handleDocDragOver(e, doc, null)}
                      onDrop={(e) => handleDocDrop(e, doc, null)}
                      onClick={() => {
                        if (hasJustDraggedRef.current) return
                        onSelectWorkspace(doc.id)
                      }}
                      className={`group relative flex items-center justify-between px-2.5 py-1.5 rounded-xl cursor-grab active:cursor-grabbing transition select-none ${
                        isBeingDragged
                          ? 'opacity-40 bg-black/[0.04] dark:bg-white/[0.04] scale-[0.98]'
                          : isActive
                          ? 'bg-amber-500/10 dark:bg-amber-500/15 text-amber-900 dark:text-amber-200 font-semibold shadow-xs border border-amber-500/30'
                          : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-100 hover:bg-black/[0.03] dark:hover:bg-white/[0.05] font-medium'
                      }`}
                    >
                      {isDropTargetBefore && (
                        <div className="absolute -top-1 left-1.5 right-1.5 h-[3px] bg-amber-500 rounded-full z-40 pointer-events-none shadow-[0_0_8px_rgba(245,158,11,1)]">
                          <div className="absolute -left-1 -top-[2.5px] w-2 h-2 rounded-full bg-amber-500" />
                        </div>
                      )}
                      {isDropTargetAfter && (
                        <div className="absolute -bottom-1 left-1.5 right-1.5 h-[3px] bg-amber-500 rounded-full z-40 pointer-events-none shadow-[0_0_8px_rgba(245,158,11,1)]">
                          <div className="absolute -left-1 -top-[2.5px] w-2 h-2 rounded-full bg-amber-500" />
                        </div>
                      )}

                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        <DocumentItemIcon
                          icon={doc.icon}
                          viewMode={doc.viewMode}
                          title={doc.title}
                          isPrivate
                          onClick={(e) => {
                            e.stopPropagation()
                            setEmojiPickerTarget({ id: doc.id, type: 'doc', currentIcon: doc.icon })
                          }}
                        />
                        <span className="truncate flex-1 text-xs select-none pointer-events-none">{renderWithAppleEmoji(doc.title || 'Untitled')}</span>
                      </div>
                      <div
                        className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                        onMouseDown={(e) => e.stopPropagation()}
                      >
                        <button
                          onClick={(e) => handleTogglePrivateWorkspace(e, doc)}
                          className="p-1 rounded text-neutral-400 hover:text-blue-500"
                          title="Hacer pública para el equipo"
                        >
                          <LockOpen size={13} weight="duotone" />
                        </button>
                        <button
                          onClick={(e) => handleToggleFavorite(e, doc)}
                          className="p-1 rounded text-neutral-400 hover:text-amber-500"
                          title="Favorito"
                        >
                          <Star size={13} weight={doc.isFavorite ? 'fill' : 'duotone'} className={doc.isFavorite ? 'text-amber-500' : 'text-neutral-400'} />
                        </button>
                        <button
                          onClick={(e) => handleDeleteWorkspace(e, doc.id)}
                          className="p-1 rounded text-neutral-400 hover:text-rose-500"
                          title="Eliminar"
                        >
                          <Trash size={13} weight="duotone" />
                        </button>
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          )}
        </div>

        {/* SECCIÓN 2: DOCUMENTOS DE EQUIPO */}
        <div>
          <div
            onClick={() => setPagesOpen(!pagesOpen)}
            onDragOver={handleRootHeaderDragOver}
            onDrop={handleRootHeaderDrop}
            className={`flex items-center justify-between px-2.5 py-1 text-[11px] font-semibold tracking-wider uppercase text-neutral-400 dark:text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300 cursor-pointer transition group rounded-lg ${
              dropTarget?.type === 'root'
                ? 'bg-blue-500/15 dark:bg-blue-500/25 ring-1 ring-blue-500/50 text-blue-600 dark:text-blue-400'
                : ''
            }`}
            title="Arrastra una nota aquí para sacarla a la raíz"
          >
            <div className="flex items-center gap-1.5">
              {pagesOpen ? (
                <CaretDown size={13} className="text-neutral-400 transition-transform" />
              ) : (
                <CaretRight size={13} className="text-neutral-400 transition-transform" />
              )}
              <span>Documentos (Equipo)</span>
              {dropTarget?.type === 'root' && (
                <span className="text-[9px] bg-blue-500 text-white px-1.5 py-0.2 rounded-full font-medium ml-1">
                  Mover a raíz
                </span>
              )}
            </div>
            <div className="flex items-center gap-1" onMouseDown={(e) => e.stopPropagation()}>
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  setIsCreatingFolder(true)
                  setPagesOpen(true)
                }}
                className="p-1 rounded hover:bg-black/10 dark:hover:bg-white/10 text-neutral-400 hover:text-neutral-800 dark:hover:text-neutral-200 transition"
                title="Nueva Carpeta"
              >
                <FolderSimplePlus size={14} weight="duotone" />
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  handleCreateWorkspace(null, null, 'doc', false)
                }}
                className="p-0.5 rounded hover:bg-black/10 dark:hover:bg-white/10 text-neutral-400 hover:text-neutral-800 dark:hover:text-neutral-200 transition"
                title="Añadir nueva página de equipo"
              >
                <Plus size={13} />
              </button>
            </div>
          </div>

          {pagesOpen && (
            <div className="mt-1 space-y-0.5">
              {/* Inline input for creating a new folder */}
              {isCreatingFolder && (
                <div className="px-2 py-1 mb-1">
                  <div className="flex items-center gap-1.5 px-2 py-1 rounded-xl bg-white dark:bg-[#202024] border border-blue-500/40 shadow-xs">
                    <Folder size={14} weight="duotone" className="text-blue-500 shrink-0" />
                    <input
                      type="text"
                      value={newFolderName}
                      onChange={(e) => setNewFolderName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          handleCreateFolder(newFolderName)
                        } else if (e.key === 'Escape') {
                          setIsCreatingFolder(false)
                          setNewFolderName('')
                        }
                      }}
                      onBlur={() => {
                        if (newFolderName.trim()) {
                          handleCreateFolder(newFolderName)
                        } else {
                          setIsCreatingFolder(false)
                          setNewFolderName('')
                        }
                      }}
                      placeholder="Nombre de la carpeta..."
                      autoFocus
                      className="w-full bg-transparent text-xs text-neutral-900 dark:text-neutral-100 outline-none placeholder:text-neutral-400"
                    />
                  </div>
                </div>
              )}

              {/* Dynamic folders list */}
              {orderedFolders.map((folderName) => {
                const folderDocs = teamDocs
                  .filter((w) => w.folder === folderName)
                  .sort(sortByOrder)
                const isFolderOpen = folderOpenMap[folderName] !== false
                const isFolderTarget = dropTarget?.type === 'folderHeader' && dropTarget?.folder === folderName
                const isFolderDropBefore = dropTarget?.type === 'folder' && dropTarget?.folder === folderName && dropTarget?.position === 'before'
                const isFolderDropAfter = dropTarget?.type === 'folder' && dropTarget?.folder === folderName && dropTarget?.position === 'after'
                const isBeingDraggedFolder = draggedFolderName === folderName

                return (
                  <div
                    key={`folder-${folderName}`}
                    className="mb-1 relative"
                  >
                    <div
                      draggable={true}
                      onDragStart={(e) => handleFolderDragStart(e, folderName)}
                      onDragEnd={handleFolderDragEnd}
                      onDragOver={(e) => handleFolderHeaderDragOver(e, folderName)}
                      onDrop={(e) => handleFolderHeaderDrop(e, folderName)}
                      onClick={() => {
                        if (hasJustDraggedRef.current) return
                        toggleFolder(folderName)
                      }}
                      className={`group relative flex items-center justify-between px-2.5 py-1.5 rounded-xl cursor-grab active:cursor-grabbing hover:bg-black/[0.03] dark:hover:bg-white/[0.05] text-neutral-600 dark:text-neutral-400 font-medium transition select-none ${
                        isBeingDraggedFolder ? 'opacity-40 bg-black/[0.04] dark:bg-white/[0.04]' : ''
                      } ${
                        isFolderTarget
                          ? 'bg-blue-500/15 dark:bg-blue-500/25 ring-1 ring-blue-500/60 text-blue-600 dark:text-blue-300'
                          : ''
                      }`}
                    >
                      {isFolderDropBefore && (
                        <div className="absolute -top-1 left-1.5 right-1.5 h-[3px] bg-blue-500 dark:bg-blue-400 rounded-full z-40 pointer-events-none shadow-[0_0_8px_rgba(59,130,246,1)]">
                          <div className="absolute -left-1 -top-[2.5px] w-2 h-2 rounded-full bg-blue-500 dark:bg-blue-400" />
                        </div>
                      )}
                      {isFolderDropAfter && (
                        <div className="absolute -bottom-1 left-1.5 right-1.5 h-[3px] bg-blue-500 dark:bg-blue-400 rounded-full z-40 pointer-events-none shadow-[0_0_8px_rgba(59,130,246,1)]">
                          <div className="absolute -left-1 -top-[2.5px] w-2 h-2 rounded-full bg-blue-500 dark:bg-blue-400" />
                        </div>
                      )}

                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        {isFolderOpen ? (
                          <CaretDown size={11} className="text-neutral-400 shrink-0" />
                        ) : (
                          <CaretRight size={11} className="text-neutral-400 shrink-0" />
                        )}
                        <Folder size={15} weight="duotone" className="text-neutral-700 dark:text-neutral-300 shrink-0" />
                        <span className="truncate text-xs font-semibold select-none pointer-events-none">{folderName}</span>
                        {isFolderTarget && (
                          <span className="text-[9px] bg-blue-500 text-white px-1.5 py-0.2 rounded-full font-medium ml-1">
                            Mover aquí
                          </span>
                        )}
                      </div>
                      <div
                        className="flex items-center gap-1"
                        onMouseDown={(e) => e.stopPropagation()}
                      >
                        <span className="text-[10px] text-neutral-400 font-mono">
                          {folderDocs.length}
                        </span>
                        <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              handleCreateWorkspace(null, folderName, 'doc', false)
                            }}
                            className="p-1 rounded text-neutral-400 hover:text-neutral-800 dark:hover:text-neutral-200"
                            title={`Crear nota en ${folderName}`}
                          >
                            <Plus size={12} />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              const newName = prompt(`Renombrar carpeta "${folderName}":`, folderName)
                              if (newName) handleRenameFolder(folderName, newName)
                            }}
                            className="p-1 rounded text-neutral-400 hover:text-neutral-800 dark:hover:text-neutral-200"
                            title="Renombrar carpeta"
                          >
                            <PencilSimple size={12} weight="duotone" />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              handleDeleteFolder(folderName)
                            }}
                            className="p-1 rounded text-neutral-400 hover:text-rose-500"
                            title="Eliminar carpeta"
                          >
                            <Trash size={12} weight="duotone" />
                          </button>
                        </div>
                      </div>
                    </div>

                    {isFolderOpen && folderDocs.length === 0 && (
                      <div
                        onDragOver={(e) => handleEmptyFolderDragOver(e, folderName)}
                        onDrop={(e) => handleFolderHeaderDrop(e, folderName)}
                        className="pl-6 py-2 text-[11px] text-neutral-400 italic rounded-lg border border-dashed border-black/10 dark:border-white/10 my-1 ml-3 select-none"
                      >
                        Carpeta vacía (arrastra notas aquí)
                      </div>
                    )}

                    {isFolderOpen && folderDocs.length > 0 && (
                      <div className="pl-4 space-y-0.5 border-l border-black/[0.04] dark:border-white/[0.06] ml-3.5 my-0.5">
                        {folderDocs.map((doc) => {
                          const isActive = doc.id === currentWorkspaceId
                          const isBeingDragged = draggedDocId === doc.id
                          const isDropTargetBefore = dropTarget?.id === doc.id && dropTarget?.position === 'before'
                          const isDropTargetAfter = dropTarget?.id === doc.id && dropTarget?.position === 'after'

                          return (
                            <div
                              key={doc.id}
                              draggable={true}
                              onDragStart={(e) => handleDocDragStart(e, doc)}
                              onDragEnd={handleDocDragEnd}
                              onDragOver={(e) => handleDocDragOver(e, doc, folderName)}
                              onDrop={(e) => handleDocDrop(e, doc, folderName)}
                              onClick={() => {
                                if (hasJustDraggedRef.current) return
                                onSelectWorkspace(doc.id)
                              }}
                              className={`group relative flex items-center justify-between px-2.5 py-1.5 rounded-xl cursor-grab active:cursor-grabbing transition select-none ${
                                isBeingDragged
                                  ? 'opacity-40 bg-black/[0.04] dark:bg-white/[0.04] scale-[0.98]'
                                  : isActive
                                  ? 'bg-white dark:bg-[#202024] text-neutral-900 dark:text-neutral-100 font-semibold shadow-xs border border-black/[0.04] dark:border-white/[0.06]'
                                  : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-100 hover:bg-black/[0.03] dark:hover:bg-white/[0.05] font-medium'
                              }`}
                            >
                              {isDropTargetBefore && (
                                <div className="absolute -top-1 left-1.5 right-1.5 h-[3px] bg-blue-500 dark:bg-blue-400 rounded-full z-40 pointer-events-none shadow-[0_0_8px_rgba(59,130,246,1)]">
                                  <div className="absolute -left-1 -top-[2.5px] w-2 h-2 rounded-full bg-blue-500 dark:bg-blue-400" />
                                </div>
                              )}
                              {isDropTargetAfter && (
                                <div className="absolute -bottom-1 left-1.5 right-1.5 h-[3px] bg-blue-500 dark:bg-blue-400 rounded-full z-40 pointer-events-none shadow-[0_0_8px_rgba(59,130,246,1)]">
                                  <div className="absolute -left-1 -top-[2.5px] w-2 h-2 rounded-full bg-blue-500 dark:bg-blue-400" />
                                </div>
                              )}

                              <div className="flex items-center gap-2 min-w-0 flex-1">
                                <DocumentItemIcon
                                  icon={doc.icon}
                                  viewMode={doc.viewMode}
                                  title={doc.title}
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    setEmojiPickerTarget({ id: doc.id, type: 'doc', currentIcon: doc.icon })
                                  }}
                                />
                                <span className="truncate flex-1 text-xs select-none pointer-events-none">{renderWithAppleEmoji(doc.title || 'Untitled')}</span>
                              </div>
                              <div
                                className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                                onMouseDown={(e) => e.stopPropagation()}
                              >
                                <button
                                  onClick={(e) => handleToggleFavorite(e, doc)}
                                  className="p-1 rounded text-neutral-400 hover:text-amber-500"
                                  title="Favorito"
                                >
                                  <Star size={13} weight={doc.isFavorite ? 'fill' : 'duotone'} className={doc.isFavorite ? 'text-amber-500' : 'text-neutral-400'} />
                                </button>
                                <button
                                  onClick={(e) => handleDeleteWorkspace(e, doc.id)}
                                  className="p-1 rounded text-neutral-400 hover:text-rose-500"
                                  title="Eliminar"
                                >
                                  <Trash size={13} weight="duotone" />
                                </button>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>
                )
              })}

              {/* Root pages */}
              {rootPages.map((page) => {
                const isActive = page.id === currentWorkspaceId
                const subpages = activeWorkspaces
                  .filter((w) => w.parentId === page.id)
                  .sort(sortByOrder)
                const isBeingDragged = draggedDocId === page.id
                const isDropTargetBefore = dropTarget?.id === page.id && dropTarget?.position === 'before'
                const isDropTargetAfter = dropTarget?.id === page.id && dropTarget?.position === 'after'

                return (
                  <div key={page.id} className="space-y-0.5">
                    <div
                      draggable={true}
                      onDragStart={(e) => handleDocDragStart(e, page)}
                      onDragEnd={handleDocDragEnd}
                      onDragOver={(e) => handleDocDragOver(e, page, null)}
                      onDrop={(e) => handleDocDrop(e, page, null)}
                      onClick={() => {
                        if (hasJustDraggedRef.current) return
                        onSelectWorkspace(page.id)
                      }}
                      className={`group relative flex items-center justify-between px-2.5 py-1.5 rounded-xl cursor-grab active:cursor-grabbing transition select-none ${
                        isBeingDragged
                          ? 'opacity-40 bg-black/[0.04] dark:bg-white/[0.04] scale-[0.98]'
                          : isActive
                          ? 'bg-white dark:bg-[#202024] text-neutral-900 dark:text-neutral-100 font-semibold shadow-xs border border-black/[0.04] dark:border-white/[0.06]'
                          : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-100 hover:bg-black/[0.03] dark:hover:bg-white/[0.05] font-medium'
                      }`}
                    >
                      {isDropTargetBefore && (
                        <div className="absolute -top-1 left-1.5 right-1.5 h-[3px] bg-blue-500 dark:bg-blue-400 rounded-full z-40 pointer-events-none shadow-[0_0_8px_rgba(59,130,246,1)]">
                          <div className="absolute -left-1 -top-[2.5px] w-2 h-2 rounded-full bg-blue-500 dark:bg-blue-400" />
                        </div>
                      )}
                      {isDropTargetAfter && (
                        <div className="absolute -bottom-1 left-1.5 right-1.5 h-[3px] bg-blue-500 dark:bg-blue-400 rounded-full z-40 pointer-events-none shadow-[0_0_8px_rgba(59,130,246,1)]">
                          <div className="absolute -left-1 -top-[2.5px] w-2 h-2 rounded-full bg-blue-500 dark:bg-blue-400" />
                        </div>
                      )}

                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        <DocumentItemIcon
                          icon={page.icon}
                          viewMode={page.viewMode}
                          title={page.title}
                          onClick={(e) => {
                            e.stopPropagation()
                            setEmojiPickerTarget({ id: page.id, type: 'doc', currentIcon: page.icon })
                          }}
                        />
                        <span className="truncate flex-1 select-none pointer-events-none">{renderWithAppleEmoji(page.title || 'Untitled')}</span>
                      </div>
                      <div
                        className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                        onMouseDown={(e) => e.stopPropagation()}
                      >
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            handleCreateWorkspace(page.id, null, 'doc')
                          }}
                          className="p-1 rounded text-neutral-400 hover:text-neutral-800 dark:hover:text-neutral-200"
                          title="Añadir subpágina"
                        >
                          <Plus size={12} />
                        </button>
                        <button
                          onClick={(e) => handleToggleFavorite(e, page)}
                          className="p-1 rounded text-neutral-400 hover:text-amber-500"
                          title="Favorito"
                        >
                          <Star size={13} weight={page.isFavorite ? 'fill' : 'duotone'} className={page.isFavorite ? 'text-amber-500' : 'text-neutral-400'} />
                        </button>
                        <button
                          onClick={(e) => handleDeleteWorkspace(e, page.id)}
                          className="p-1 rounded text-neutral-400 hover:text-rose-500"
                          title="Eliminar"
                        >
                          <Trash size={13} weight="duotone" />
                        </button>
                      </div>
                    </div>

                    {/* Subpages indented */}
                    {subpages.length > 0 && (
                      <div className="pl-4 space-y-0.5 border-l border-black/[0.04] dark:border-white/[0.06] ml-3.5 my-0.5">
                        {subpages.map((sub) => {
                          const isSubActive = sub.id === currentWorkspaceId
                          const isSubBeingDragged = draggedDocId === sub.id
                          const isSubDropTargetBefore = dropTarget?.id === sub.id && dropTarget?.position === 'before'
                          const isSubDropTargetAfter = dropTarget?.id === sub.id && dropTarget?.position === 'after'

                          return (
                            <div
                              key={sub.id}
                              draggable={true}
                              onDragStart={(e) => handleDocDragStart(e, sub)}
                              onDragEnd={handleDocDragEnd}
                              onDragOver={(e) => handleDocDragOver(e, sub, null)}
                              onDrop={(e) => handleDocDrop(e, sub, null)}
                              onClick={() => onSelectWorkspace(sub.id)}
                              className={`group relative flex items-center justify-between px-2.5 py-1 rounded-xl cursor-grab active:cursor-grabbing transition select-none ${
                                isSubBeingDragged
                                  ? 'opacity-40 bg-black/[0.04] dark:bg-white/[0.04] scale-[0.98]'
                                  : isSubActive
                                  ? 'bg-white dark:bg-[#202024] text-neutral-900 dark:text-neutral-100 font-semibold shadow-xs border border-black/[0.04] dark:border-white/[0.06]'
                                  : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-100 hover:bg-black/[0.03] dark:hover:bg-white/[0.05] font-medium'
                              }`}
                            >
                              {isSubDropTargetBefore && (
                                <div className="absolute -top-1 left-1.5 right-1.5 h-[3px] bg-blue-500 dark:bg-blue-400 rounded-full z-40 pointer-events-none shadow-[0_0_8px_rgba(59,130,246,1)]">
                                  <div className="absolute -left-1 -top-[2.5px] w-2 h-2 rounded-full bg-blue-500 dark:bg-blue-400" />
                                </div>
                              )}
                              {isSubDropTargetAfter && (
                                <div className="absolute -bottom-1 left-1.5 right-1.5 h-[3px] bg-blue-500 dark:bg-blue-400 rounded-full z-40 pointer-events-none shadow-[0_0_8px_rgba(59,130,246,1)]">
                                  <div className="absolute -left-1 -top-[2.5px] w-2 h-2 rounded-full bg-blue-500 dark:bg-blue-400" />
                                </div>
                              )}

                              <div className="flex items-center gap-2 min-w-0 flex-1">
                                <DocumentItemIcon
                                  icon={sub.icon}
                                  viewMode={sub.viewMode}
                                  title={sub.title}
                                  size={14}
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    setEmojiPickerTarget({ id: sub.id, type: 'doc', currentIcon: sub.icon })
                                  }}
                                />
                                <span className="truncate flex-1 text-xs select-none pointer-events-none">{renderWithAppleEmoji(sub.title || 'Untitled')}</span>
                              </div>
                              <div
                                className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                                onMouseDown={(e) => e.stopPropagation()}
                              >
                                <button
                                  onClick={(e) => handleDeleteWorkspace(e, sub.id)}
                                  className="p-0.5 rounded text-neutral-400 hover:text-rose-500"
                                  title="Eliminar"
                                >
                                  <Trash size={13} weight="duotone" />
                                </button>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>


        {/* TOOLS & MORE */}
        <div>
          <div
            onClick={() => setToolsOpen(!toolsOpen)}
            className="flex items-center justify-between px-2.5 py-1 text-[11px] font-semibold tracking-wider uppercase text-neutral-400 dark:text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300 cursor-pointer transition group"
          >
            <div className="flex items-center gap-1.5">
              {toolsOpen ? (
                <CaretDown size={13} className="text-neutral-400 transition-transform" />
              ) : (
                <CaretRight size={13} className="text-neutral-400 transition-transform" />
              )}
              <span>Herramientas</span>
            </div>
          </div>

          {toolsOpen && (
            <div className="mt-1 space-y-0.5">
              <button
                onClick={onOpenTemplates}
                className="w-full flex items-center gap-2.5 px-3 py-1.5 rounded-xl hover:bg-black/[0.03] dark:hover:bg-white/[0.05] text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-100 font-medium transition cursor-pointer text-left"
              >
                <Books size={15} weight="duotone" className="text-neutral-700 dark:text-neutral-300 shrink-0" />
                <span>Plantillas</span>
              </button>

              <button
                onClick={onOpenImport}
                className="w-full flex items-center gap-2.5 px-3 py-1.5 rounded-xl hover:bg-black/[0.03] dark:hover:bg-white/[0.05] text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-100 font-medium transition cursor-pointer text-left"
              >
                <DownloadSimple size={15} weight="duotone" className="text-neutral-700 dark:text-neutral-300 shrink-0" />
                <span>Importar / Exportar</span>
              </button>

              <button
                onClick={onOpenShortcuts}
                className="w-full flex items-center gap-2.5 px-3 py-1.5 rounded-xl hover:bg-black/[0.03] dark:hover:bg-white/[0.05] text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-100 font-medium transition cursor-pointer text-left"
              >
                <Keyboard size={15} weight="duotone" className="text-neutral-700 dark:text-neutral-300 shrink-0" />
                <span>Atajos de teclado</span>
              </button>

              <button
                onClick={onOpenTrash}
                className="w-full flex items-center gap-2.5 px-3 py-1.5 rounded-xl hover:bg-rose-50 dark:hover:bg-rose-950/30 text-neutral-600 dark:text-neutral-400 hover:text-rose-600 dark:hover:text-rose-400 font-medium transition cursor-pointer text-left"
              >
                <Trash size={15} weight="duotone" className="text-neutral-700 dark:text-neutral-300 group-hover:text-rose-500 shrink-0" />
                <span>Papelera</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* 7. Footer: Sync Status, Dark Mode Toggle & Bottom Controls */}
      <div className="p-3 border-t border-black/[0.04] dark:border-white/[0.06] flex items-center justify-between text-neutral-500 shrink-0">
        {/* Sync Status indicator */}
        <div className="flex items-center gap-2 text-[11px] font-medium">
          {syncStatus?.state === 'syncing' ? (
            <ArrowsClockwise size={15} weight="duotone" className="text-blue-500 animate-spin" />
          ) : syncStatus?.state === 'error' ? (
            <CloudSlash size={15} weight="duotone" className="text-rose-500" />
          ) : syncStatus?.state === 'offline' ? (
            <CloudSlash size={15} weight="duotone" className="text-amber-500" />
          ) : (
            <CloudCheck size={15} weight="duotone" className="text-emerald-500" />
          )}
          <span className="capitalize">
            {syncStatus?.state === 'syncing'
              ? 'Sincronizando'
              : syncStatus?.state === 'error'
              ? 'Error'
              : syncStatus?.state === 'offline'
              ? 'Offline'
              : syncStatus?.state === 'unconfigured'
              ? 'Local (Offline)'
              : 'Sincronizado'}
          </span>
        </div>

        {/* Controls: Dark mode, Account & Settings */}
        <div className="flex items-center gap-1.5">
          <button
            onClick={onToggleDarkMode}
            className="w-7 h-7 rounded-full flex items-center justify-center hover:bg-black/[0.05] dark:hover:bg-white/[0.08] text-neutral-600 dark:text-neutral-300 transition cursor-pointer"
            title={darkMode ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
          >
            {darkMode ? <Sun size={15} weight="duotone" /> : <Moon size={15} weight="duotone" />}
          </button>

          <TeamMemberSwitcher
            variant="circular"
            popoverDirection="up"
            currentMember={activeMember}
            onSelectMember={(id) => onSelectMember && onSelectMember(id)}
            privateNotesCount={privateDocs.length}
            authUser={authUser}
            onOpenAuthModal={onOpenAuthModal}
            onOpenProfileModal={onOpenProfileModal}
            onOpenUserManagementModal={onOpenUserManagementModal}
            onSignOut={onSignOut}
          />

          <button
            onClick={onOpenSettings}
            className="w-7 h-7 rounded-full flex items-center justify-center hover:bg-black/[0.05] dark:hover:bg-white/[0.08] text-neutral-600 dark:text-neutral-300 transition cursor-pointer"
            title="Ajustes de la aplicación"
          >
            <Gear size={15} weight="duotone" />
          </button>
        </div>
      </div>

      {/* Apple Emoji Picker Modal for Spaces and Documents (Rendered in Portal to avoid clipping) */}
      {emojiPickerTarget && typeof document !== 'undefined' && createPortal(
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-100"
          onClick={() => setEmojiPickerTarget(null)}
        >
          <div onClick={(e) => e.stopPropagation()} className="relative">
            <EmojiPickerPopover
              currentIcon={emojiPickerTarget.currentIcon}
              isOpen={Boolean(emojiPickerTarget)}
              onClose={() => setEmojiPickerTarget(null)}
              onSelectEmoji={async (emoji: string) => {
                if (emojiPickerTarget.type === 'space') {
                  await updateSpace(emojiPickerTarget.id, { icon: emoji })
                } else {
                  await db.workspaces.update(emojiPickerTarget.id, {
                    icon: emoji,
                    updatedAt: Date.now(),
                    syncStatus: 'pending'
                  })
                }
                setEmojiPickerTarget(null)
              }}
              onRemoveEmoji={async () => {
                if (emojiPickerTarget.type === 'space') {
                  await updateSpace(emojiPickerTarget.id, { icon: '' })
                } else {
                  await db.workspaces.update(emojiPickerTarget.id, {
                    icon: '',
                    updatedAt: Date.now(),
                    syncStatus: 'pending'
                  })
                }
                setEmojiPickerTarget(null)
              }}
              title={
                emojiPickerTarget.type === 'space'
                  ? 'Icono del Espacio de Trabajo'
                  : 'Icono del Documento'
              }
              isModal={true}
            />
          </div>
        </div>,
        document.body
      )}

      {/* Resize Handle (Borde interactivo para estirar a la derecha y a la izquierda) */}
      <div
        onMouseDown={(e) => {
          e.preventDefault()
          setIsResizing(true)
        }}
        className={`absolute top-0 right-0 w-2 h-full cursor-col-resize z-50 transition-colors group flex items-center justify-center hover:bg-blue-500/20 active:bg-blue-500/30 ${
          isResizing ? 'bg-blue-500/40 w-2.5' : ''
        }`}
        title="Arrastra para redimensionar la barra lateral"
      >
        <div className={`w-[2px] h-full transition-colors ${
          isResizing ? 'bg-blue-500' : 'group-hover:bg-blue-500/60 bg-transparent'
        }`} />
      </div>
    </aside>
  )
}
