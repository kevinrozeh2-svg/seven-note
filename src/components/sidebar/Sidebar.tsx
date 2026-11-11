import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react'
import { createPortal } from 'react-dom'
import {
  MagnifyingGlass,
  Plus,
  Star,
  Trash,
  Folder,
  FolderSimplePlus,
  CaretDown,
  CaretRight,
  CalendarBlank,
  Tag,
  ArrowsClockwise,
  SidebarSimple,
  PencilSimple,
  Check,
  Lock,
  FilmSlate,
  RocketLaunch,
  Lightning,
  Lightbulb,
  Sparkle,
  ChartBar,
  PushPin,
  Kanban,
  Copy,
  ArrowSquareOut,
  DotsThree,
  Vault,
  NotePencil,
  ArrowsDownUp,
  CaretDoubleUp,
  SortAscending,
  SortDescending,
  Clock,
  Calendar,
  Folders
} from '@phosphor-icons/react'
import {
  db,
  type WorkspaceItem,
  type SpaceItem,
  DEFAULT_SPACE_ID,
  updateSpace
} from '../../db'
import { isItemUnread, NewBadge, NewDot, useUnreadTrigger } from '../../lib/unreadTracker'
import { type SyncEngineStatus, syncEngine } from '../../lib/syncEngine'
import { AppleEmoji, isEmoji, renderWithAppleEmoji } from '../ui/AppleEmoji'
import { EmojiPickerPopover } from '../modals/EmojiPickerPopover'
import {
  PastelFolderIcon,
  PastelFileIcon,
  FOLDER_PALETTE,
  folderColorIndex,
  setFolderColor,
  useFolderColors
} from '../ui/PastelIcons'
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
  onSelectWorkspace: (id: string, spaceId?: string, workspaceItem?: WorkspaceItem) => void
  onToggleSidebar: () => void
  onOpenSettings: () => void
  onOpenSearch?: () => void
  onOpenAllDocs?: () => void
  onOpenTrash?: () => void
  onOpenImport?: () => void
  onOpenTemplates?: () => void
  onOpenShortcuts?: () => void

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

    // Sidebar: always use the unified file-style icon by type
    const s = size + 3
    const CANVAS_ICONS = ['🎨', '🖼️', '🖼', 'canvas', 'palette', 'board', 'whiteboard']
    if (viewMode === 'canvas' || (icon && CANVAS_ICONS.includes(icon))) {
      return <PastelFileIcon kind="canvas" size={s} />
    }
    if (viewMode === 'split') return <PastelFileIcon kind="split" size={s} />
    if (s > 0) return <PastelFileIcon kind="doc" size={s} />
    const NOTE_ICONS = ['📝', '📄', '📃', '🗒️', '🗒', '📋', '🧾', 'doc', 'file-text', 'note', 'page']
    if (!icon || NOTE_ICONS.includes(icon) || CANVAS_ICONS.includes(icon)) {
      if (icon && CANVAS_ICONS.includes(icon)) return <PastelFileIcon kind="canvas" size={s} />
      if (viewMode === 'canvas') return <PastelFileIcon kind="canvas" size={s} />
      if (viewMode === 'split') return <PastelFileIcon kind="split" size={s} />
      return <PastelFileIcon kind="doc" size={s} />
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
      case 'sparkles':
        return <Sparkle size={size} weight="duotone" className={className} />
      case '⭐':
      case 'star':
        return <Star size={size} weight="duotone" className={className} />
      case '📁':
      case 'folder':
        return <PastelFolderIcon name={title || ''} size={size + 3} />
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
      case 'file-text':
        return <PastelFileIcon kind="doc" size={size + 3} />
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
      return <PastelFileIcon kind="canvas" size={size + 3} />
    }

    if (viewMode === 'canvas') {
      return <PastelFileIcon kind="canvas" size={size + 3} />
    }
    if (viewMode === 'split') {
      return <PastelFileIcon kind="split" size={size + 3} />
    }

    return <PastelFileIcon kind="doc" size={size + 3} />
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

export type DocSortMode =
  | 'custom'
  | 'title-asc'
  | 'title-desc'
  | 'updated-desc'
  | 'updated-asc'
  | 'created-desc'
  | 'created-asc'

export interface SortOptionItem {
  id: DocSortMode
  label: string
  desc?: string
  icon: React.ReactNode
}

export const SORT_OPTIONS: SortOptionItem[] = [
  { id: 'custom', label: 'Personalizado', desc: 'Arrastrar y soltar libremente', icon: <ArrowsDownUp size={14} /> },
  { id: 'title-asc', label: 'Título / Nombre (A → Z)', desc: 'Alfabético ascendente', icon: <SortAscending size={14} /> },
  { id: 'title-desc', label: 'Título / Nombre (Z → A)', desc: 'Alfabético descendente', icon: <SortDescending size={14} /> },
  { id: 'updated-desc', label: 'Última edición (Recientes)', desc: 'Notas modificadas recientemente', icon: <Clock size={14} /> },
  { id: 'updated-asc', label: 'Última edición (Antiguos)', desc: 'Notas menos recientes primero', icon: <Clock size={14} /> },
  { id: 'created-desc', label: 'Fecha de creación (Nuevos)', desc: 'Notas creadas recientemente', icon: <Calendar size={14} /> },
  { id: 'created-asc', label: 'Fecha de creación (Antiguos)', desc: 'Notas más antiguas primero', icon: <Calendar size={14} /> }
]

export function Sidebar({
  spaces = [],
  currentSpaceId = DEFAULT_SPACE_ID,
  onSelectSpace,
  currentMember,
  onSelectMember: _onSelectMember,
  authUser,
  onOpenAuthModal: _onOpenAuthModal,
  onOpenProfileModal: _onOpenProfileModal,
  onOpenUserManagementModal: _onOpenUserManagementModal,
  onSignOut: _onSignOut,
  onOpenCreateSpace,
  onRenameSpace,
  onDeleteSpace,
  workspaces,
  currentWorkspaceId,
  onSelectWorkspace,
  onToggleSidebar,
  onOpenSettings: _onOpenSettings,
  onOpenSearch: _onOpenSearch,
  onOpenAllDocs: _onOpenAllDocs,
  onOpenTrash: _onOpenTrash,
  onOpenImport: _onOpenImport,
  onOpenTemplates: _onOpenTemplates,
  onOpenShortcuts: _onOpenShortcuts,
  onOpenKnowledgeGraph: _onOpenKnowledgeGraph,
  syncStatus: _syncStatus,
  darkMode: _darkMode,
  onToggleDarkMode: _onToggleDarkMode,
  activeNavigation: _activeNavigation,
  onSelectNavigation
}: SidebarProps) {
  // Collapsible sections state
  const [favoritesOpen, setFavoritesOpen] = useState(true)
  const [privateNotesOpen, setPrivateNotesOpen] = useState(true)
  const [pagesOpen, setPagesOpen] = useState(true)
  const [folderOpenMap, setFolderOpenMap] = useState<Record<string, boolean>>({ 'First Folder': true })
  const folderColors = useFolderColors()
  const [isCreatingFolder, setIsCreatingFolder] = useState(false)
  const [newFolderName, setNewFolderName] = useState('')
  const [creatingSubfolderParent, setCreatingSubfolderParent] = useState<string | null>(null)
  const [newSubfolderName, setNewSubfolderName] = useState('')

  const [docSortMode, setDocSortMode] = useState<DocSortMode>(() => {
    try {
      const saved = localStorage.getItem('seven_note_doc_sort_mode')
      if (saved) {
        if (saved === 'title') return 'title-asc'
        if (saved === 'date') return 'updated-desc'
        return saved as DocSortMode
      }
    } catch {}
    return 'custom'
  })
  const [sortFoldersToo, setSortFoldersToo] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('seven_note_sort_folders_too')
      if (saved !== null) return saved === 'true'
    } catch {}
    return true
  })
  const [foldersFirst, setFoldersFirst] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('seven_note_folders_first')
      if (saved !== null) return saved === 'true'
    } catch {}
    return true
  })
  const [isSortMenuOpen, setIsSortMenuOpen] = useState(false)

  useEffect(() => {
    try {
      localStorage.setItem('seven_note_doc_sort_mode', docSortMode)
    } catch {}
  }, [docSortMode])

  useEffect(() => {
    try {
      localStorage.setItem('seven_note_sort_folders_too', String(sortFoldersToo))
    } catch {}
  }, [sortFoldersToo])

  useEffect(() => {
    try {
      localStorage.setItem('seven_note_folders_first', String(foldersFirst))
    } catch {}
  }, [foldersFirst])

  // Context / Click Menu for Notes and Folders (Obsidian style)
  const [activeItemMenu, setActiveItemMenu] = useState<{
    type: 'doc' | 'folder'
    id?: string
    path?: string
    name?: string
    x: number
    y: number
    isPrivate?: boolean
  } | null>(null)

  useEffect(() => {
    const handleCloseMenu = () => setActiveItemMenu(null)
    window.addEventListener('click', handleCloseMenu)
    window.addEventListener('contextmenu', handleCloseMenu)
    return () => {
      window.removeEventListener('click', handleCloseMenu)
      window.removeEventListener('contextmenu', handleCloseMenu)
    }
  }, [])

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
  useUnreadTrigger()

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
    const newWs: WorkspaceItem = {
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
      userId: authUser?.id || undefined,
      viewedBy: [activeMember.id, activeMember.name, activeMember.email, authUser?.id].filter(Boolean) as string[],
      isNewItem: true,
      activeProperties: [
        'tags',
        'documentMode',
        'isJournal',
        'templateName',
        'createdAt',
        'updatedAt'
      ]
    }
    try {
      await db.workspaces.add(newWs)
      if (folderName) {
        setFolderOpenMap((prev) => {
          const next = { ...prev }
          const parts = folderName.split('/')
          let curr = ''
          for (const p of parts) {
            curr = curr ? `${curr}/${p}` : p
            next[curr] = true
          }
          return next
        })
      }
      onSelectWorkspace(newId, currentSpace.id, newWs)
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

  // Duplicate a note
  const handleDuplicateWorkspace = async (docId: string) => {
    const doc = workspaces.find((w) => w.id === docId)
    if (!doc) return
    const newId = crypto.randomUUID()
    const now = Date.now()
    const dupWs: WorkspaceItem = {
      ...doc,
      id: newId,
      title: `${doc.title || 'Sin título'} (Copia)`,
      createdAt: now,
      updatedAt: now,
      syncStatus: 'pending',
      isNewItem: true
    }
    await db.workspaces.add(dupWs)
    onSelectWorkspace(newId, doc.spaceId || currentSpace.id, dupWs)
    toast.success('Copia de la nota creada')
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

  const sortByOrder = useCallback(
    (a: WorkspaceItem, b: WorkspaceItem) => {
      if (docSortMode === 'title-asc' || (docSortMode as string) === 'title') {
        return (a.title || '').localeCompare(b.title || '', undefined, { numeric: true, sensitivity: 'base' })
      }
      if (docSortMode === 'title-desc') {
        return (b.title || '').localeCompare(a.title || '', undefined, { numeric: true, sensitivity: 'base' })
      }
      if (docSortMode === 'updated-desc' || (docSortMode as string) === 'date') {
        const timeA = a.updatedAt || a.createdAt || 0
        const timeB = b.updatedAt || b.createdAt || 0
        if (timeB !== timeA) return timeB - timeA
        return (a.title || '').localeCompare(b.title || '')
      }
      if (docSortMode === 'updated-asc') {
        const timeA = a.updatedAt || a.createdAt || 0
        const timeB = b.updatedAt || b.createdAt || 0
        if (timeA !== timeB) return timeA - timeB
        return (a.title || '').localeCompare(b.title || '')
      }
      if (docSortMode === 'created-desc') {
        const timeA = a.createdAt || 0
        const timeB = b.createdAt || 0
        if (timeB !== timeA) return timeB - timeA
        return (a.title || '').localeCompare(b.title || '')
      }
      if (docSortMode === 'created-asc') {
        const timeA = a.createdAt || 0
        const timeB = b.createdAt || 0
        if (timeA !== timeB) return timeA - timeB
        return (a.title || '').localeCompare(b.title || '')
      }
      const diff = getSortOrder(a) - getSortOrder(b)
      if (diff !== 0) return diff
      return (a.createdAt || 0) - (b.createdAt || 0)
    },
    [docSortMode]
  )

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

  // Helper: folder date statistics based on notes inside it
  const getFolderTimestamps = useCallback(
    (folderPath: string) => {
      const insideDocs = teamDocs.filter(
        (w) => w.folder === folderPath || (w.folder && w.folder.startsWith(folderPath + '/'))
      )
      if (insideDocs.length === 0) {
        return { maxUpdated: 0, minUpdated: 0, maxCreated: 0, minCreated: 0 }
      }
      const updatedTimes = insideDocs.map((w) => w.updatedAt || w.createdAt || 0)
      const createdTimes = insideDocs.map((w) => w.createdAt || 0)
      return {
        maxUpdated: Math.max(...updatedTimes),
        minUpdated: Math.min(...updatedTimes),
        maxCreated: Math.max(...createdTimes),
        minCreated: Math.min(...createdTimes)
      }
    },
    [teamDocs]
  )

  const getFolderLeafName = (path: string): string => {
    const parts = path.split('/')
    return parts[parts.length - 1] || path
  }

  const getParentFolderPath = (path: string): string | null => {
    const idx = path.lastIndexOf('/')
    if (idx === -1) return null
    return path.slice(0, idx)
  }

  const allFolders = useMemo(() => {
    const rawList = new Set<string>()
    teamDocs.forEach((w) => {
      if (w.folder && w.folder.trim()) {
        rawList.add(w.folder.trim())
      }
    })
    if (folderOrder && Array.isArray(folderOrder)) {
      folderOrder.forEach((f) => {
        if (f && f.trim()) {
          rawList.add(f.trim())
        }
      })
    }
    const fullSet = new Set<string>()
    rawList.forEach((path) => {
      const parts = path.split('/')
      let cur = ''
      for (const part of parts) {
        cur = cur ? `${cur}/${part}` : part
        fullSet.add(cur)
      }
    })
    return Array.from(fullSet)
  }, [teamDocs, folderOrder])

  const sortFolders = useCallback(
    (folders: string[]) => {
      return [...folders].sort((a, b) => {
        if (!sortFoldersToo || docSortMode === 'custom') {
          const idxA = folderOrder.indexOf(a)
          const idxB = folderOrder.indexOf(b)
          if (idxA !== -1 && idxB !== -1) return idxA - idxB
          if (idxA !== -1) return -1
          if (idxB !== -1) return 1
          return a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' })
        }

        const nameA = getFolderLeafName(a)
        const nameB = getFolderLeafName(b)

        if (docSortMode === 'title-asc' || (docSortMode as string) === 'title') {
          return nameA.localeCompare(nameB, undefined, { numeric: true, sensitivity: 'base' })
        }
        if (docSortMode === 'title-desc') {
          return nameB.localeCompare(nameA, undefined, { numeric: true, sensitivity: 'base' })
        }

        const statsA = getFolderTimestamps(a)
        const statsB = getFolderTimestamps(b)

        if (docSortMode === 'updated-desc' || (docSortMode as string) === 'date') {
          if (statsB.maxUpdated !== statsA.maxUpdated) return statsB.maxUpdated - statsA.maxUpdated
          return nameA.localeCompare(nameB)
        }
        if (docSortMode === 'updated-asc') {
          if (statsA.minUpdated !== statsB.minUpdated) return statsA.minUpdated - statsB.minUpdated
          return nameA.localeCompare(nameB)
        }
        if (docSortMode === 'created-desc') {
          if (statsB.maxCreated !== statsA.maxCreated) return statsB.maxCreated - statsA.maxCreated
          return nameA.localeCompare(nameB)
        }
        if (docSortMode === 'created-asc') {
          if (statsA.minCreated !== statsB.minCreated) return statsA.minCreated - statsB.minCreated
          return nameA.localeCompare(nameB)
        }

        return nameA.localeCompare(nameB)
      })
    },
    [folderOrder, docSortMode, sortFoldersToo, getFolderTimestamps]
  )

  type MixedExplorerItem =
    | { type: 'folder'; path: string; name: string; updated: number; created: number }
    | { type: 'doc'; doc: WorkspaceItem; name: string; updated: number; created: number }

  const sortMixedItems = useCallback(
    (items: MixedExplorerItem[]) => {
      return [...items].sort((a, b) => {
        if (foldersFirst) {
          if (a.type !== b.type) {
            return a.type === 'folder' ? -1 : 1
          }
        }

        if (docSortMode === 'title-asc' || (docSortMode as string) === 'title') {
          return a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' })
        }
        if (docSortMode === 'title-desc') {
          return b.name.localeCompare(a.name, undefined, { numeric: true, sensitivity: 'base' })
        }
        if (docSortMode === 'updated-desc' || (docSortMode as string) === 'date') {
          if (b.updated !== a.updated) return b.updated - a.updated
          return a.name.localeCompare(b.name)
        }
        if (docSortMode === 'updated-asc') {
          if (a.updated !== b.updated) return a.updated - b.updated
          return a.name.localeCompare(b.name)
        }
        if (docSortMode === 'created-desc') {
          if (b.created !== a.created) return b.created - a.created
          return a.name.localeCompare(b.name)
        }
        if (docSortMode === 'created-asc') {
          if (a.created !== b.created) return a.created - b.created
          return a.name.localeCompare(b.name)
        }

        // custom:
        if (a.type === 'folder' && b.type === 'folder') {
          const idxA = folderOrder.indexOf(a.path)
          const idxB = folderOrder.indexOf(b.path)
          if (idxA !== -1 && idxB !== -1) return idxA - idxB
          if (idxA !== -1) return -1
          if (idxB !== -1) return 1
          return a.name.localeCompare(b.name)
        }
        if (a.type === 'doc' && b.type === 'doc') {
          return sortByOrder(a.doc, b.doc)
        }
        return a.type === 'folder' ? -1 : 1
      })
    },
    [foldersFirst, docSortMode, folderOrder, sortByOrder]
  )

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
      setDocSortMode('custom')
      try {
        localStorage.setItem('seven_note_doc_sort_mode', 'custom')
      } catch {}
    } catch (err) {
      console.error('Error reordering document', err)
    }
  }

  // Folder hierarchy move & rename handler
  const moveOrRenameFolderHierarchy = async (oldPath: string, newPath: string) => {
    if (oldPath === newPath) return

    // Find all affected docs (either directly in oldPath or in subfolders of oldPath)
    const affectedDocs = teamDocs.filter(
      (w) => w.folder === oldPath || w.folder?.startsWith(oldPath + '/')
    )

    const now = Date.now()
    const updates = affectedDocs.map((w) => {
      let updatedFolder = newPath
      if (w.folder && w.folder !== oldPath && w.folder.startsWith(oldPath + '/')) {
        const suffix = w.folder.slice(oldPath.length)
        updatedFolder = `${newPath}${suffix}`
      }
      return {
        key: w.id,
        changes: {
          folder: updatedFolder,
          updatedAt: now,
          syncStatus: 'pending' as const
        }
      }
    })

    if (updates.length > 0) {
      await db.workspaces.bulkUpdate(updates)
      syncEngine.scheduleSync(500)
    }

    // Update folderOrder in state and localStorage
    setFolderOrder((prev) => {
      const next = prev.map((f) => {
        if (f === oldPath) return newPath
        if (f.startsWith(oldPath + '/')) {
          return `${newPath}${f.slice(oldPath.length)}`
        }
        return f
      })
      if (!next.includes(newPath)) {
        next.push(newPath)
      }
      try {
        localStorage.setItem(`seven_note_folder_order_${currentSpace.id}`, JSON.stringify(next))
      } catch (err) {
        console.warn('Error saving folder order', err)
      }
      return next
    })

    // Update folderOpenMap
    setFolderOpenMap((prev) => {
      const next = { ...prev }
      Object.keys(prev).forEach((key) => {
        if (key === oldPath) {
          next[newPath] = prev[oldPath]
          delete next[oldPath]
        } else if (key.startsWith(oldPath + '/')) {
          const mappedKey = `${newPath}${key.slice(oldPath.length)}`
          next[mappedKey] = prev[key]
          delete next[key]
        }
      })
      next[newPath] = true
      return next
    })
  }

  // Helper to construct a clean, hierarchical full folder order (DFS traversal)
  // that preserves previous order for all levels while updating the specific target parent level
  const buildFullFolderOrder = useCallback(
    (
      targetParent: string | null,
      newSiblingsOrder: string[],
      currentFolderOrder: string[],
      foldersPool: string[]
    ): string[] => {
      const getLevelFolders = (parent: string | null): string[] => {
        if (parent === targetParent) {
          return newSiblingsOrder
        }
        const siblings = foldersPool.filter((f) => getParentFolderPath(f) === parent)
        return [...siblings].sort((a, b) => {
          const idxA = currentFolderOrder.indexOf(a)
          const idxB = currentFolderOrder.indexOf(b)
          if (idxA !== -1 && idxB !== -1) return idxA - idxB
          if (idxA !== -1) return -1
          if (idxB !== -1) return 1
          return a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' })
        })
      }

      const result: string[] = []
      const visited = new Set<string>()

      const traverse = (parent: string | null) => {
        const levelItems = getLevelFolders(parent)
        for (const item of levelItems) {
          if (!visited.has(item)) {
            visited.add(item)
            result.push(item)
            traverse(item)
          }
        }
      }

      traverse(null)

      for (const f of foldersPool) {
        if (!visited.has(f)) {
          visited.add(f)
          result.push(f)
        }
      }

      return result
    },
    []
  )

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
      // Disallow dragging a folder into its own descendant
      if (folderName.startsWith(currentDraggedFolder + '/')) return

      const rect = e.currentTarget.getBoundingClientRect()
      const relY = e.clientY - rect.top
      const height = rect.height

      let position: 'before' | 'after' | 'inside'
      if (relY < height * 0.35) {
        position = 'before'
      } else if (relY > height * 0.65) {
        position = 'after'
      } else {
        position = 'inside'
      }

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
    const currentPosition = dropTarget?.position || 'after'

    draggedDocIdRef.current = null
    draggedFolderNameRef.current = null
    setDraggedDocId(null)
    setDraggedFolderName(null)
    setDropTarget(null)
    setTimeout(() => {
      hasJustDraggedRef.current = false
    }, 120)

    if (movingFolder && movingFolder !== folderName) {
      // Disallow moving into own descendant
      if (folderName.startsWith(movingFolder + '/')) return

      if (currentPosition === 'inside') {
        const leafName = getFolderLeafName(movingFolder)
        let targetPath = `${folderName}/${leafName}`
        if (allFolders.includes(targetPath) && targetPath !== movingFolder) {
          let count = 2
          while (allFolders.includes(`${targetPath} ${count}`)) {
            count++
          }
          targetPath = `${targetPath} ${count}`
        }
        await moveOrRenameFolderHierarchy(movingFolder, targetPath)
        setFolderOpenMap((prev) => ({ ...prev, [folderName]: true, [targetPath]: true }))
        toast.success(`Carpeta "${leafName}" movida dentro de "${getFolderLeafName(folderName)}"`)
        return
      }

      // Reorder before or after folderName at target folder's level
      const targetParent = getParentFolderPath(folderName)
      const movingParent = getParentFolderPath(movingFolder)
      const leafName = getFolderLeafName(movingFolder)

      let effectiveMovingFolder = movingFolder

      if (targetParent !== movingParent) {
        let newPath = targetParent ? `${targetParent}/${leafName}` : leafName
        if (allFolders.includes(newPath) && newPath !== movingFolder) {
          let count = 2
          while (allFolders.includes(`${newPath} ${count}`)) {
            count++
          }
          newPath = `${newPath} ${count}`
        }
        await moveOrRenameFolderHierarchy(movingFolder, newPath)
        effectiveMovingFolder = newPath
      }

      // Ensure all current folders are in the pool
      const foldersPoolSet = new Set<string>(allFolders)
      foldersPoolSet.add(effectiveMovingFolder)
      foldersPoolSet.add(folderName)
      const foldersPool = Array.from(foldersPoolSet)

      // Get siblings for this level
      const siblings = foldersPool.filter((f) => getParentFolderPath(f) === targetParent)
      // Visual current order of siblings
      const currentOrderedSiblings = sortFolders(siblings)

      // Remove moving folder from list of siblings
      const withoutMoving = currentOrderedSiblings.filter(
        (f) => f !== effectiveMovingFolder && f !== movingFolder
      )

      // Find index of target folder
      const targetIdx = withoutMoving.indexOf(folderName)
      const insertIndex =
        targetIdx === -1
          ? withoutMoving.length
          : currentPosition === 'before'
            ? targetIdx
            : targetIdx + 1

      const newSiblingsOrder = [...withoutMoving]
      newSiblingsOrder.splice(insertIndex, 0, effectiveMovingFolder)

      // Build complete consistent folder order
      const updatedFolderOrder = buildFullFolderOrder(
        targetParent,
        newSiblingsOrder,
        folderOrder,
        foldersPool
      )

      setFolderOrder(updatedFolderOrder)
      setDocSortMode('custom')

      try {
        localStorage.setItem(
          `seven_note_folder_order_${currentSpace.id}`,
          JSON.stringify(updatedFolderOrder)
        )
        localStorage.setItem('seven_note_doc_sort_mode', 'custom')
      } catch (err) {
        console.warn('Error saving folder order', err)
      }

      toast.success(
        `Carpeta "${leafName}" colocada ${currentPosition === 'before' ? 'encima' : 'debajo'} de "${getFolderLeafName(folderName)}"`
      )
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
    const currentDraggedDoc = draggedDocIdRef.current || draggedDocId
    const currentDraggedFolder = draggedFolderNameRef.current || draggedFolderName
    if (!currentDraggedDoc && !currentDraggedFolder) return
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

    const movingFolder =
      draggedFolderNameRef.current ||
      draggedFolderName ||
      e.dataTransfer.getData('application/seven-note-folder')
    const movingDocId =
      draggedDocIdRef.current ||
      draggedDocId ||
      e.dataTransfer.getData('application/seven-note-doc') ||
      (!movingFolder ? e.dataTransfer.getData('text/plain') : null)

    draggedDocIdRef.current = null
    draggedFolderNameRef.current = null
    setDraggedDocId(null)
    setDraggedFolderName(null)
    setDropTarget(null)
    setTimeout(() => {
      hasJustDraggedRef.current = false
    }, 120)

    if (movingFolder) {
      if (movingFolder.includes('/')) {
        const leaf = getFolderLeafName(movingFolder)
        let newRoot = leaf
        if (allFolders.some((f) => f === newRoot && f !== movingFolder)) {
          let c = 2
          while (allFolders.some((f) => f === `${leaf} ${c}`)) {
            c++
          }
          newRoot = `${leaf} ${c}`
        }
        await moveOrRenameFolderHierarchy(movingFolder, newRoot)
        toast.success(`Carpeta "${leaf}" movida a la raíz`)
      }
      return
    }

    if (movingDocId) {
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
      setDocSortMode('custom')
      try {
        localStorage.setItem('seven_note_doc_sort_mode', 'custom')
      } catch {}
      toast.success('Documento movido fuera de la carpeta')
    }
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

    setFolderOrder((prev) => {
      const next = prev.includes(trimmed) ? prev : [...prev, trimmed]
      try {
        localStorage.setItem(`seven_note_folder_order_${currentSpace.id}`, JSON.stringify(next))
      } catch (err) {
        console.warn('Error saving folder order', err)
      }
      return next
    })

    await handleCreateWorkspace(null, trimmed, 'doc', false)
    toast.success(`Carpeta "${trimmed}" creada`)
  }

  const handleCreateSubfolder = async (parentPath: string, name: string) => {
    const trimmed = name.trim()
    if (!trimmed) {
      setCreatingSubfolderParent(null)
      setNewSubfolderName('')
      return
    }

    const fullPath = `${parentPath}/${trimmed}`
    setFolderOpenMap((prev) => ({ ...prev, [parentPath]: true, [fullPath]: true }))
    setCreatingSubfolderParent(null)
    setNewSubfolderName('')

    setFolderOrder((prev) => {
      const next = prev.includes(fullPath) ? prev : [...prev, fullPath]
      try {
        localStorage.setItem(`seven_note_folder_order_${currentSpace.id}`, JSON.stringify(next))
      } catch (err) {
        console.warn('Error saving folder order', err)
      }
      return next
    })

    await handleCreateWorkspace(null, fullPath, 'doc', false)
    toast.success(`Subcarpeta "${trimmed}" creada`)
  }

  const handleRenameFolder = async (oldPath: string, newLeafName: string) => {
    const trimmed = newLeafName.trim()
    if (!trimmed) return
    const parent = getParentFolderPath(oldPath)
    const newPath = parent ? `${parent}/${trimmed}` : trimmed
    if (newPath === oldPath) return

    await moveOrRenameFolderHierarchy(oldPath, newPath)
    toast.success(`Carpeta renombrada a "${trimmed}"`)
  }

  const handleDeleteFolder = async (folderPath: string) => {
    const leaf = getFolderLeafName(folderPath)
    if (!confirm(`¿Eliminar la carpeta "${leaf}" y mover sus notas a la raíz?`)) return

    const docsToUpdate = teamDocs.filter(
      (w) => w.folder === folderPath || w.folder?.startsWith(folderPath + '/')
    )

    try {
      if (docsToUpdate.length > 0) {
        await Promise.all(
          docsToUpdate.map((w) =>
            db.workspaces.update(w.id, {
              folder: null,
              updatedAt: Date.now(),
              syncStatus: 'pending'
            })
          )
        )
        syncEngine.scheduleSync(500)
      }

      setFolderOrder((prev) => {
        const next = prev.filter(
          (f) => f !== folderPath && !f.startsWith(folderPath + '/')
        )
        try {
          localStorage.setItem(`seven_note_folder_order_${currentSpace.id}`, JSON.stringify(next))
        } catch (err) {
          console.warn('Error saving folder order', err)
        }
        return next
      })

      setFolderOpenMap((prev) => {
        const next = { ...prev }
        Object.keys(next).forEach((k) => {
          if (k === folderPath || k.startsWith(folderPath + '/')) {
            delete next[k]
          }
        })
        return next
      })

      toast.success(`Carpeta "${leaf}" eliminada`)
    } catch (err) {
      console.error('Error deleting folder', err)
    }
  }

  // Document row renderer with subpages support
  const renderDocNode = (doc: WorkspaceItem, folderPath: string | null = null) => {
    const isActive = doc.id === currentWorkspaceId
    const isBeingDragged = draggedDocId === doc.id
    const isDropTargetBefore = dropTarget?.id === doc.id && dropTarget?.position === 'before'
    const isDropTargetAfter = dropTarget?.id === doc.id && dropTarget?.position === 'after'
    const subpages = activeWorkspaces
      .filter((w) => w.parentId === doc.id)
      .sort(sortByOrder)

    return (
      <div key={doc.id} className="space-y-0.5">
        <div
          draggable={true}
          onDragStart={(e) => handleDocDragStart(e, doc)}
          onDragEnd={handleDocDragEnd}
          onDragOver={(e) => handleDocDragOver(e, doc, folderPath)}
          onDrop={(e) => handleDocDrop(e, doc, folderPath)}
          onClick={() => {
            if (hasJustDraggedRef.current) return
            onSelectWorkspace(doc.id)
          }}
          onContextMenu={(e) => {
            e.preventDefault()
            e.stopPropagation()
            setActiveItemMenu({
              type: 'doc',
              id: doc.id,
              name: doc.title,
              x: e.clientX,
              y: e.clientY,
              isPrivate: doc.isPrivate
            })
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
              isPrivate={doc.isPrivate}
              onClick={(e) => {
                e.stopPropagation()
                setEmojiPickerTarget({ id: doc.id, type: 'doc', currentIcon: doc.icon })
              }}
            />
            <span className="truncate flex-1 text-[13px] select-none pointer-events-none">
              {renderWithAppleEmoji(doc.title || 'Untitled')}
            </span>
            {isItemUnread(doc, 'workspace', activeMember, authUser?.id) && (
              <NewBadge className="ml-1.5" />
            )}
          </div>
          <div
            className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <button
              onClick={(e) => {
                e.stopPropagation()
                const rect = e.currentTarget.getBoundingClientRect()
                setActiveItemMenu({
                  type: 'doc',
                  id: doc.id,
                  name: doc.title,
                  x: rect.right + 4,
                  y: rect.top,
                  isPrivate: doc.isPrivate
                })
              }}
              className="p-1 rounded text-neutral-400 hover:text-neutral-800 dark:hover:text-neutral-200"
              title="Opciones de nota"
            >
              <DotsThree size={14} weight="bold" />
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
                  onDragOver={(e) => handleDocDragOver(e, sub, folderPath)}
                  onDrop={(e) => handleDocDrop(e, sub, folderPath)}
                  onClick={() => onSelectWorkspace(sub.id)}
                  onContextMenu={(e) => {
                    e.preventDefault()
                    e.stopPropagation()
                    setActiveItemMenu({
                      type: 'doc',
                      id: sub.id,
                      name: sub.title,
                      x: e.clientX,
                      y: e.clientY,
                      isPrivate: sub.isPrivate
                    })
                  }}
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
                      isPrivate={sub.isPrivate}
                      onClick={(e) => {
                        e.stopPropagation()
                        setEmojiPickerTarget({ id: sub.id, type: 'doc', currentIcon: sub.icon })
                      }}
                    />
                    <span className="truncate flex-1 select-none pointer-events-none">
                      {renderWithAppleEmoji(sub.title || 'Untitled')}
                    </span>
                    {isItemUnread(sub, 'workspace', activeMember, authUser?.id) && (
                      <NewBadge className="ml-1.5" />
                    )}
                  </div>
                  <div
                    className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                    onMouseDown={(e) => e.stopPropagation()}
                  >
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        const rect = e.currentTarget.getBoundingClientRect()
                        setActiveItemMenu({
                          type: 'doc',
                          id: sub.id,
                          name: sub.title,
                          x: rect.right + 4,
                          y: rect.top,
                          isPrivate: sub.isPrivate
                        })
                      }}
                      className="p-1 rounded text-neutral-400 hover:text-neutral-800 dark:hover:text-neutral-200"
                      title="Opciones de nota"
                    >
                      <DotsThree size={14} weight="bold" />
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    )
  }

  // Recursive renderer for folders and subfolders
  const renderFolderItem = (folderPath: string, level = 0): React.ReactNode => {
    const leafName = getFolderLeafName(folderPath)
    const folderDocs = teamDocs
      .filter((w) => w.folder === folderPath)
      .sort(sortByOrder)
    const childFolders = sortFolders(allFolders.filter((f) => getParentFolderPath(f) === folderPath))
    const isFolderOpen = folderOpenMap[folderPath] !== false
    const isFolderTarget =
      (dropTarget?.type === 'folderHeader' ||
        (dropTarget?.type === 'folder' && dropTarget?.position === 'inside')) &&
      dropTarget?.folder === folderPath
    const isFolderDropBefore =
      dropTarget?.type === 'folder' && dropTarget?.folder === folderPath && dropTarget?.position === 'before'
    const isFolderDropAfter =
      dropTarget?.type === 'folder' && dropTarget?.folder === folderPath && dropTarget?.position === 'after'
    const isBeingDraggedFolder = draggedFolderName === folderPath
    const isInsideDropTarget =
      dropTarget?.type === 'folder' && dropTarget?.position === 'inside' && dropTarget?.folder === folderPath

    return (
      <div key={`folder-${folderPath}`} className="mb-0.5 relative">
        <div
          draggable={true}
          onDragStart={(e) => handleFolderDragStart(e, folderPath)}
          onDragEnd={handleFolderDragEnd}
          onDragOver={(e) => handleFolderHeaderDragOver(e, folderPath)}
          onDrop={(e) => handleFolderHeaderDrop(e, folderPath)}
          onClick={() => {
            if (hasJustDraggedRef.current) return
            toggleFolder(folderPath)
          }}
          onContextMenu={(e) => {
            e.preventDefault()
            e.stopPropagation()
            setActiveItemMenu({
              type: 'folder',
              path: folderPath,
              name: leafName,
              x: e.clientX,
              y: e.clientY
            })
          }}
          style={{ paddingLeft: `${10 + level * 14}px` }}
          className={`group relative flex items-center justify-between pr-2.5 py-1.5 rounded-[10px] cursor-grab active:cursor-grabbing hover:bg-black/[0.05] dark:hover:bg-white/[0.06] text-neutral-600 dark:text-neutral-400 font-medium transition select-none ${
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
            <CaretRight
              size={11}
              weight="bold"
              className={`text-neutral-400 shrink-0 transition-transform duration-200 ${isFolderOpen ? 'rotate-90' : ''}`}
            />
            <PastelFolderIcon name={folderPath} size={19} open={isFolderOpen} />
            <span className="truncate text-[13px] font-medium text-neutral-800 dark:text-neutral-200 select-none pointer-events-none">{leafName}</span>
            {folderDocs.some((d) => isItemUnread(d, 'workspace', activeMember, authUser?.id)) && !isFolderOpen && (
              <NewBadge className="ml-1" />
            )}
            {isFolderTarget && (
              <span className="text-[9px] bg-blue-500 text-white px-1.5 py-0.2 rounded-full font-medium ml-1">
                {isInsideDropTarget ? 'Mover dentro' : 'Mover aquí'}
              </span>
            )}
          </div>
          <div
            className="flex items-center gap-1"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <span className="text-[11px] text-neutral-400 dark:text-neutral-500 tabular-nums group-hover:hidden">
              {folderDocs.length}
            </span>
            <div className="hidden group-hover:flex items-center gap-0.5">
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  handleCreateWorkspace(null, folderPath, 'doc', false)
                }}
                className="p-1 rounded text-neutral-400 hover:text-neutral-800 dark:hover:text-neutral-200"
                title={`Crear nota en ${leafName}`}
              >
                <Plus size={12} />
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  setCreatingSubfolderParent(folderPath)
                  setFolderOpenMap((prev) => ({ ...prev, [folderPath]: true }))
                  setNewSubfolderName('')
                }}
                className="p-1 rounded text-neutral-400 hover:text-blue-500"
                title="Crear subcarpeta"
              >
                <FolderSimplePlus size={12} weight="duotone" />
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  const rect = e.currentTarget.getBoundingClientRect()
                  setActiveItemMenu({
                    type: 'folder',
                    path: folderPath,
                    name: leafName,
                    x: rect.right + 4,
                    y: rect.top
                  })
                }}
                className="p-1 rounded text-neutral-400 hover:text-neutral-800 dark:hover:text-neutral-200"
                title="Opciones de carpeta"
              >
                <DotsThree size={14} weight="bold" />
              </button>
            </div>
          </div>
        </div>

        {/* Input inline para crear subcarpeta dentro de esta carpeta */}
        {isFolderOpen && creatingSubfolderParent === folderPath && (
          <div
            style={{ paddingLeft: `${14 + (level + 1) * 14}px` }}
            className="py-1 pr-2 my-0.5"
          >
            <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-xl bg-black/[0.04] dark:bg-white/[0.06] border border-blue-500/40">
              <PastelFolderIcon name="nueva" size={17} />
              <input
                type="text"
                value={newSubfolderName}
                onChange={(e) => setNewSubfolderName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handleCreateSubfolder(folderPath, newSubfolderName)
                  } else if (e.key === 'Escape') {
                    setCreatingSubfolderParent(null)
                    setNewSubfolderName('')
                  }
                }}
                onBlur={() => {
                  if (newSubfolderName.trim()) {
                    handleCreateSubfolder(folderPath, newSubfolderName)
                  } else {
                    setCreatingSubfolderParent(null)
                    setNewSubfolderName('')
                  }
                }}
                placeholder="Nombre de la subcarpeta..."
                autoFocus
                className="w-full bg-transparent text-xs text-neutral-900 dark:text-neutral-100 outline-none placeholder:text-neutral-400"
              />
            </div>
          </div>
        )}

        {/* Empty placeholder */}
        {isFolderOpen &&
          folderDocs.length === 0 &&
          childFolders.length === 0 &&
          creatingSubfolderParent !== folderPath && (
            <div
              style={{ marginLeft: `${14 + (level + 1) * 14}px` }}
              onDragOver={(e) => handleEmptyFolderDragOver(e, folderPath)}
              onDrop={(e) => handleFolderHeaderDrop(e, folderPath)}
              className="py-2 px-3 text-[11px] text-neutral-400 italic rounded-lg border border-dashed border-black/10 dark:border-white/10 my-1 mr-2 select-none"
            >
              Carpeta vacía (arrastra notas o carpetas aquí)
            </div>
          )}

        {/* Folders and documents content */}
        {isFolderOpen && (
          <>
            {foldersFirst ? (
              <>
                {/* Child subfolders */}
                {childFolders.length > 0 && (
                  <div className="space-y-0.5 my-0.5">
                    {childFolders.map((childPath: string) => renderFolderItem(childPath, level + 1))}
                  </div>
                )}
                {/* Direct docs inside this folder */}
                {folderDocs.length > 0 && (
                  <div
                    style={{ marginLeft: `${19 + level * 14}px` }}
                    className="space-y-0.5 my-0.5 mr-0.5"
                  >
                    {folderDocs.map((doc) => renderDocNode(doc, folderPath))}
                  </div>
                )}
              </>
            ) : (
              /* Interleaved folders and documents */
              (childFolders.length > 0 || folderDocs.length > 0) && (
                <div className="space-y-0.5 my-0.5">
                  {sortMixedItems([
                    ...childFolders.map((p) => {
                      const stats = getFolderTimestamps(p)
                      return {
                        type: 'folder' as const,
                        path: p,
                        name: getFolderLeafName(p),
                        updated: stats.maxUpdated,
                        created: stats.maxCreated
                      }
                    }),
                    ...folderDocs.map((doc) => ({
                      type: 'doc' as const,
                      doc,
                      name: doc.title || 'Untitled',
                      updated: doc.updatedAt || doc.createdAt || 0,
                      created: doc.createdAt || 0
                    }))
                  ]).map((item) => {
                    if (item.type === 'folder') {
                      return renderFolderItem(item.path, level + 1)
                    }
                    return (
                      <div
                        key={item.doc.id}
                        style={{ marginLeft: `${19 + level * 14}px` }}
                        className="mr-0.5"
                      >
                        {renderDocNode(item.doc, folderPath)}
                      </div>
                    )
                  })}
                </div>
              )
            )}
          </>
        )}
      </div>
    )
  }

  return (
    <aside
      style={{ width: `${sidebarWidth}px` }}
      className={`relative h-full flex flex-col bg-[var(--obsidian-sidebar-bg,#181818)] border-r border-[var(--app-border)] text-[var(--app-text-primary)] select-none shrink-0 text-xs font-sans shadow-2xl md:shadow-none max-w-[85vw] ${
        isResizing ? '' : 'transition-[width] duration-75'
      }`}
    >
      {/* 1. Workspace Bar (Minimalist Obsidian Vault style) */}
      <div className="px-3 pt-2 pb-1 relative">
        <button
          type="button"
          onClick={() => setShowSpaceMenu(!showSpaceMenu)}
          className="w-full flex items-center justify-between px-2 py-1.5 rounded-md hover:bg-black/[0.04] dark:hover:bg-white/[0.06] cursor-pointer transition text-left group"
          title="Cambiar espacio de trabajo"
        >
          <div className="flex items-center gap-1.5 min-w-0 flex-1">
            <span className="font-semibold text-neutral-800 dark:text-neutral-200 truncate text-[13px] tracking-tight">
              {currentSpace.name}
            </span>
            {isCurrentSpacePrivate && (
              <span className="text-amber-500 shrink-0" title="Espacio privado: Solo visible para ti">
                <Lock size={12} weight="bold" />
              </span>
            )}
          </div>
          <div className="flex items-center gap-1 shrink-0 ml-1">
            {visibleSpaces.some((s) => s.id !== currentSpace.id && isItemUnread(s, 'space', activeMember, authUser?.id)) && (
              <NewDot title="Nuevos espacios de trabajo disponibles" />
            )}
            <CaretDown size={12} className="text-neutral-400 group-hover:text-neutral-700 dark:group-hover:text-neutral-300 transition shrink-0" />
          </div>
        </button>

        {/* Space Switcher Popover Dropdown (Obsidian Vaults Popover) */}
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
              className="absolute left-3 right-3 top-10 z-50 bg-[#252525] dark:bg-[#202020] text-neutral-200 border border-black/20 dark:border-white/10 rounded-lg shadow-xl p-1 animate-in fade-in zoom-in-95 duration-100 flex flex-col max-h-[60vh] overflow-y-auto custom-scrollbar"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="space-y-0.5 max-h-48 overflow-y-auto custom-scrollbar">
                {visibleSpaces.map((sp) => {
                  const isSelected = sp.id === currentSpace.id
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
                          className="w-full bg-black/30 border border-white/20 rounded px-2 py-1 text-xs text-white outline-none"
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
                      className={`group w-full flex items-center justify-between px-2.5 py-1.5 rounded-md text-xs cursor-pointer transition ${
                        isSelected
                          ? 'bg-white/10 text-white font-medium'
                          : 'text-neutral-300 hover:text-white hover:bg-white/5'
                      }`}
                    >
                      <div className="flex items-center gap-1.5 min-w-0 flex-1">
                        <span className="truncate text-left text-[13px]">{sp.name}</span>
                        {isItemUnread(sp, 'space', activeMember, authUser?.id) && (
                          <NewBadge className="ml-1" />
                        )}
                        {sp.isPrivate && (
                          <span
                            className="inline-flex items-center gap-0.5 px-1 py-0.2 rounded text-[9px] font-semibold bg-amber-500/20 text-amber-400 shrink-0"
                            title="Espacio privado: Solo visible para ti"
                          >
                            <Lock size={9} weight="bold" />
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0 ml-2">
                        {isSelected && <Check size={14} weight="bold" className="text-white shrink-0" />}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation()
                            setEditingSpaceId(sp.id)
                            setEditingSpaceName(sp.name)
                          }}
                          className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-white/10 text-neutral-400 hover:text-white transition"
                          title="Renombrar espacio"
                        >
                          <PencilSimple size={12} weight="bold" />
                        </button>
                        {visibleSpaces.length > 1 && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation()
                              if (onDeleteSpace) onDeleteSpace(sp.id)
                            }}
                            className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-rose-500/20 text-neutral-400 hover:text-rose-400 transition"
                            title="Eliminar espacio"
                          >
                            <Trash size={12} weight="bold" />
                          </button>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>

              <div className="h-px bg-white/10 my-1" />

              <button
                type="button"
                onClick={() => {
                  setShowSpaceMenu(false)
                  if (onOpenCreateSpace) onOpenCreateSpace()
                }}
                className="w-full text-left px-2.5 py-1.5 rounded-md hover:bg-white/5 text-neutral-200 hover:text-white transition text-xs flex items-center gap-2 cursor-pointer font-medium"
              >
                <Vault size={14} weight="regular" className="shrink-0 text-neutral-400" />
                <span>Administrar bóvedas...</span>
              </button>
            </div>
          </>
        )}
      </div>

      {/* 2. Obsidian Action Toolbar (agrupado en el medio justo debajo de los espacios) */}
      <div className="px-3 py-1 flex items-center justify-center border-b border-black/[0.04] dark:border-white/[0.04] shrink-0 mb-1 relative">
        <div className="flex items-center gap-1 text-neutral-400">
          <button
            type="button"
            onClick={() => handleCreateWorkspace(null, null, 'doc', isCurrentSpacePrivate)}
            className="p-1.5 rounded hover:text-neutral-800 dark:hover:text-neutral-200 hover:bg-black/[0.04] dark:hover:bg-white/[0.06] transition cursor-pointer"
            title="Nueva nota"
          >
            <NotePencil size={16} weight="regular" />
          </button>
          <button
            type="button"
            onClick={() => setIsCreatingFolder(true)}
            className="p-1.5 rounded hover:text-neutral-800 dark:hover:text-neutral-200 hover:bg-black/[0.04] dark:hover:bg-white/[0.06] transition cursor-pointer"
            title="Nueva carpeta"
          >
            <FolderSimplePlus size={16} weight="regular" />
          </button>
          <button
            type="button"
            onClick={() => setIsSortMenuOpen(!isSortMenuOpen)}
            className={`p-1.5 rounded hover:text-neutral-800 dark:hover:text-neutral-200 hover:bg-black/[0.04] dark:hover:bg-white/[0.06] transition cursor-pointer ${
              isSortMenuOpen || docSortMode !== 'custom'
                ? 'text-blue-500 dark:text-blue-400 bg-blue-500/10'
                : ''
            }`}
            title={`Cambiar orden de notas y carpetas (Activo: ${
              SORT_OPTIONS.find((o) => o.id === docSortMode)?.label || 'Personalizado'
            })`}
          >
            <ArrowsDownUp size={16} weight={docSortMode !== 'custom' ? 'bold' : 'regular'} />
          </button>
          <button
            type="button"
            onClick={() => {
              // Collapse all folders & sections
              setFolderOpenMap({})
              setPagesOpen(false)
              setPrivateNotesOpen(false)
              setFavoritesOpen(false)
            }}
            className="p-1.5 rounded hover:text-neutral-800 dark:hover:text-neutral-200 hover:bg-black/[0.04] dark:hover:bg-white/[0.06] transition cursor-pointer"
            title="Plegar todo"
          >
            <CaretDoubleUp size={16} weight="regular" />
          </button>
          <button
            type="button"
            onClick={onToggleSidebar}
            className="p-1.5 rounded hover:text-neutral-800 dark:hover:text-neutral-200 hover:bg-black/[0.04] dark:hover:bg-white/[0.06] transition cursor-pointer"
            title="Ocultar explorador (Ctrl+\)"
          >
            <SidebarSimple size={16} weight="regular" />
          </button>
        </div>

        {/* Popover / Menú desplegable para ordenar notas y carpetas */}
        {isSortMenuOpen && (
          <>
            <div
              className="fixed inset-0 z-40"
              onClick={() => setIsSortMenuOpen(false)}
            />
            <div className="absolute left-2 right-2 top-full mt-1 bg-white dark:bg-[#1e1e22] border border-black/10 dark:border-white/10 rounded-xl shadow-2xl p-1.5 z-50 text-xs backdrop-blur-md animate-in fade-in zoom-in-95 duration-100 max-h-[460px] overflow-y-auto custom-scrollbar">
              <div className="px-2 py-1 text-[10px] font-semibold tracking-wider uppercase text-neutral-400 dark:text-neutral-500">
                Ordenar notas y carpetas
              </div>
              <div className="space-y-0.5">
                {SORT_OPTIONS.map((opt) => {
                  const isSelected = docSortMode === opt.id
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => {
                        setDocSortMode(opt.id)
                        toast.success(`Orden: ${opt.label}`)
                        setIsSortMenuOpen(false)
                      }}
                      className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-left transition cursor-pointer ${
                        isSelected
                          ? 'bg-blue-500/10 dark:bg-blue-500/15 text-blue-600 dark:text-blue-400 font-medium'
                          : 'hover:bg-black/[0.04] dark:hover:bg-white/[0.06] text-neutral-700 dark:text-neutral-300'
                      }`}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span className={isSelected ? 'text-blue-500 dark:text-blue-400' : 'text-neutral-400'}>
                          {opt.icon}
                        </span>
                        <div className="truncate">
                          <div className="truncate text-xs">{opt.label}</div>
                          {opt.desc && (
                            <div className="text-[10px] text-neutral-400 dark:text-neutral-500 truncate">
                              {opt.desc}
                            </div>
                          )}
                        </div>
                      </div>
                      {isSelected && (
                        <Check size={14} weight="bold" className="text-blue-500 dark:text-blue-400 shrink-0 ml-2" />
                      )}
                    </button>
                  )
                })}
              </div>

              <div className="pt-1.5 mt-1.5 border-t border-black/[0.06] dark:border-white/[0.08] space-y-0.5">
                <div className="px-2 py-0.5 text-[10px] font-semibold tracking-wider uppercase text-neutral-400 dark:text-neutral-500">
                  Opciones de carpetas
                </div>
                <button
                  type="button"
                  onClick={() => {
                    const nextVal = !sortFoldersToo
                    setSortFoldersToo(nextVal)
                    toast.info(nextVal ? 'Las carpetas seguirán el orden seleccionado' : 'Carpetas en orden manual')
                  }}
                  className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-left text-xs hover:bg-black/[0.04] dark:hover:bg-white/[0.06] transition text-neutral-700 dark:text-neutral-300 cursor-pointer"
                >
                  <div className="flex items-center gap-2">
                    <Folders size={14} className="text-neutral-400 shrink-0" />
                    <div className="flex flex-col">
                      <span>Ordenar también carpetas</span>
                      <span className="text-[10px] text-neutral-400 dark:text-neutral-500">Aplica el criterio a las carpetas</span>
                    </div>
                  </div>
                  <div
                    className={`w-4 h-4 rounded border flex items-center justify-center transition shrink-0 ml-2 ${
                      sortFoldersToo
                        ? 'bg-blue-500 border-blue-500 text-white'
                        : 'border-neutral-300 dark:border-neutral-600'
                    }`}
                  >
                    {sortFoldersToo && <Check size={12} weight="bold" />}
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    const nextVal = !foldersFirst
                    setFoldersFirst(nextVal)
                    toast.info(nextVal ? 'Carpetas agrupadas al inicio' : 'Carpetas y notas ordenadas juntas')
                  }}
                  className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-left text-xs hover:bg-black/[0.04] dark:hover:bg-white/[0.06] transition text-neutral-700 dark:text-neutral-300 cursor-pointer"
                >
                  <div className="flex items-center gap-2">
                    <Folder size={14} className="text-neutral-400 shrink-0" />
                    <div className="flex flex-col">
                      <span>Carpetas siempre arriba</span>
                      <span className="text-[10px] text-neutral-400 dark:text-neutral-500">Mantener carpetas sobre las notas</span>
                    </div>
                  </div>
                  <div
                    className={`w-4 h-4 rounded border flex items-center justify-center transition shrink-0 ml-2 ${
                      foldersFirst
                        ? 'bg-blue-500 border-blue-500 text-white'
                        : 'border-neutral-300 dark:border-neutral-600'
                    }`}
                  >
                    {foldersFirst && <Check size={12} weight="bold" />}
                  </div>
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      {/* 6. Scrollable Structure: Favorites, Documents, Tags */}
      <div className="flex-1 overflow-y-auto px-2 space-y-4 custom-scrollbar">
        {/* FAVORITES */}
        <div>
          <div
            onClick={() => setFavoritesOpen(!favoritesOpen)}
            className="flex items-center justify-between px-2.5 py-1 text-[12px] font-medium text-neutral-400 dark:text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300 cursor-pointer transition group"
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
                        {isItemUnread(fav, 'workspace', activeMember, authUser?.id) && (
                          <NewBadge className="ml-1.5" />
                        )}
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
            className="flex items-center justify-between px-2.5 py-1 text-[12px] font-medium text-neutral-400 dark:text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300 cursor-pointer transition group"
          >
            <div className="flex items-center gap-1.5">
              {privateNotesOpen ? (
                <CaretDown size={13} className="text-neutral-400 transition-transform" />
              ) : (
                <CaretRight size={13} className="text-neutral-400 transition-transform" />
              )}
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
                      onContextMenu={(e) => {
                        e.preventDefault()
                        e.stopPropagation()
                        setActiveItemMenu({
                          type: 'doc',
                          id: doc.id,
                          name: doc.title,
                          x: e.clientX,
                          y: e.clientY,
                          isPrivate: true
                        })
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
                        <span className="truncate flex-1 text-[13px] select-none pointer-events-none">{renderWithAppleEmoji(doc.title || 'Untitled')}</span>
                    {isItemUnread(doc, 'workspace', activeMember, authUser?.id) && (
                      <NewBadge className="ml-1.5" />
                    )}
                        {isItemUnread(doc, 'workspace', activeMember, authUser?.id) && (
                          <NewBadge className="ml-1.5" />
                        )}
                      </div>
                      <div
                        className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                        onMouseDown={(e) => e.stopPropagation()}
                      >
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            const rect = e.currentTarget.getBoundingClientRect()
                            setActiveItemMenu({
                              type: 'doc',
                              id: doc.id,
                              name: doc.title,
                              x: rect.right + 4,
                              y: rect.top,
                              isPrivate: true
                            })
                          }}
                          className="p-1 rounded text-neutral-400 hover:text-neutral-800 dark:hover:text-neutral-200"
                          title="Opciones de nota"
                        >
                          <DotsThree size={14} weight="bold" />
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
            className={`flex items-center justify-between px-2.5 py-1 text-[12px] font-medium text-neutral-400 dark:text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300 cursor-pointer transition group rounded-lg ${
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
                    <PastelFolderIcon name="nueva" size={17} />
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

              {foldersFirst ? (
                <>
                  {/* Dynamic recursive folders list */}
                  {sortFolders(allFolders.filter((f: string) => getParentFolderPath(f) === null)).map((folderName: string) =>
                    renderFolderItem(folderName, 0)
                  )}

                  {/* Root pages */}
                  {rootPages.map((page) => renderDocNode(page, null))}
                </>
              ) : (
                <div className="space-y-0.5">
                  {sortMixedItems([
                    ...allFolders
                      .filter((f: string) => getParentFolderPath(f) === null)
                      .map((p) => {
                        const stats = getFolderTimestamps(p)
                        return {
                          type: 'folder' as const,
                          path: p,
                          name: getFolderLeafName(p),
                          updated: stats.maxUpdated,
                          created: stats.maxCreated
                        }
                      }),
                    ...rootPages.map((page) => ({
                      type: 'doc' as const,
                      doc: page,
                      name: page.title || 'Untitled',
                      updated: page.updatedAt || page.createdAt || 0,
                      created: page.createdAt || 0
                    }))
                  ]).map((item) => {
                    if (item.type === 'folder') {
                      return renderFolderItem(item.path, 0)
                    }
                    return renderDocNode(item.doc, null)
                  })}
                </div>
              )}
            </div>
          )}
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

      {/* Obsidian-Style Context / Dropdown Menu for Notes & Folders */}
      {activeItemMenu && typeof document !== 'undefined' && createPortal(
        <div
          className="fixed z-[99999] bg-[#252525] dark:bg-[#202020] border border-white/[0.08] text-[var(--app-text-primary)] rounded-xl shadow-2xl p-1 text-xs select-none w-52 animate-in fade-in zoom-in-95 duration-75"
          style={{
            left: `${Math.min(activeItemMenu.x, window.innerWidth - 220)}px`,
            top: `${Math.min(activeItemMenu.y, window.innerHeight - 340)}px`
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {activeItemMenu.type === 'folder' ? (
            /* FOLDER ACTIONS (Identical to user's photo!) */
            <div className="space-y-0.5">
              <button
                onClick={() => {
                  if (activeItemMenu.path) {
                    handleCreateWorkspace(null, activeItemMenu.path, 'doc', false)
                  }
                  setActiveItemMenu(null)
                }}
                className="w-full flex items-center gap-2.5 px-3 py-1.5 rounded-lg hover:bg-white/10 text-left transition cursor-pointer"
              >
                <PencilSimple size={15} />
                <span>Nueva nota</span>
              </button>

              <button
                onClick={() => {
                  if (activeItemMenu.path) {
                    setCreatingSubfolderParent(activeItemMenu.path)
                    setFolderOpenMap((prev) => ({ ...prev, [activeItemMenu.path!]: true }))
                    setNewSubfolderName('')
                  }
                  setActiveItemMenu(null)
                }}
                className="w-full flex items-center gap-2.5 px-3 py-1.5 rounded-lg hover:bg-white/10 text-left transition cursor-pointer"
              >
                <Folder size={15} />
                <span>Nueva carpeta</span>
              </button>

              <button
                onClick={() => {
                  if (activeItemMenu.path) {
                    handleCreateWorkspace(null, activeItemMenu.path, 'canvas', false)
                  }
                  setActiveItemMenu(null)
                }}
                className="w-full flex items-center gap-2.5 px-3 py-1.5 rounded-lg hover:bg-white/10 text-left transition cursor-pointer"
              >
                <Kanban size={15} />
                <span>Nuevo lienzo</span>
              </button>

              <div className="h-px bg-white/[0.06] my-1" />

              <div className="px-3 pt-1 pb-1.5">
                <div className="text-[10px] text-white/40 mb-1.5">Color de carpeta</div>
                <div className="grid grid-cols-9 gap-1">
                  {FOLDER_PALETTE.map((c, i) => {
                    const path = activeItemMenu.path || ''
                    const current = folderColors[path] ?? folderColorIndex(path)
                    return (
                      <button
                        key={c.label}
                        title={c.label}
                        onClick={() => {
                          if (activeItemMenu.path) setFolderColor(activeItemMenu.path, i)
                        }}
                        className={`w-4 h-4 rounded-full border transition hover:scale-110 cursor-pointer ${
                          current === i ? 'ring-2 ring-white/80 ring-offset-1 ring-offset-[#252525]' : ''
                        }`}
                        style={{ background: c.bottom, borderColor: c.stroke }}
                      />
                    )
                  })}
                </div>
              </div>

              <div className="h-px bg-white/[0.06] my-1" />

              <button
                onClick={() => {
                  if (activeItemMenu.path) {
                    navigator.clipboard.writeText(activeItemMenu.path)
                    toast.success('Ruta de carpeta copiada')
                  }
                  setActiveItemMenu(null)
                }}
                className="w-full flex items-center gap-2.5 px-3 py-1.5 rounded-lg hover:bg-white/10 text-left transition cursor-pointer"
              >
                <Copy size={15} />
                <span>Copiar ruta</span>
              </button>

              <div className="h-px bg-white/[0.06] my-1" />

              <button
                onClick={() => {
                  if (activeItemMenu.path && activeItemMenu.name) {
                    const newName = prompt(`Renombrar carpeta "${activeItemMenu.name}":`, activeItemMenu.name)
                    if (newName) handleRenameFolder(activeItemMenu.path, newName)
                  }
                  setActiveItemMenu(null)
                }}
                className="w-full flex items-center gap-2.5 px-3 py-1.5 rounded-lg hover:bg-white/10 text-left transition cursor-pointer"
              >
                <PencilSimple size={15} />
                <span>Renombrar</span>
              </button>

              <button
                onClick={() => {
                  if (activeItemMenu.path) {
                    handleDeleteFolder(activeItemMenu.path)
                  }
                  setActiveItemMenu(null)
                }}
                className="w-full flex items-center gap-2.5 px-3 py-1.5 rounded-lg hover:bg-rose-500/20 text-rose-400 text-left transition cursor-pointer"
              >
                <Trash size={15} />
                <span>Borrar</span>
              </button>
            </div>
          ) : (
            /* NOTE / DOCUMENT ACTIONS (Obsidian Style) */
            <div className="space-y-0.5">
              <button
                onClick={() => {
                  if (activeItemMenu.id) {
                    onSelectWorkspace(activeItemMenu.id)
                  }
                  setActiveItemMenu(null)
                }}
                className="w-full flex items-center gap-2.5 px-3 py-1.5 rounded-lg hover:bg-white/10 text-left transition cursor-pointer"
              >
                <ArrowSquareOut size={15} />
                <span>Abrir nota</span>
              </button>

              <button
                onClick={() => {
                  if (activeItemMenu.id) {
                    handleDuplicateWorkspace(activeItemMenu.id)
                  }
                  setActiveItemMenu(null)
                }}
                className="w-full flex items-center gap-2.5 px-3 py-1.5 rounded-lg hover:bg-white/10 text-left transition cursor-pointer"
              >
                <Copy size={15} />
                <span>Hacer una copia</span>
              </button>

              <button
                onClick={() => {
                  const doc = workspaces.find((w) => w.id === activeItemMenu.id)
                  if (doc) {
                    handleToggleFavorite({ stopPropagation: () => {} } as any, doc)
                    toast.success(doc.isFavorite ? 'Quitado de favoritos' : 'Añadido a favoritos')
                  }
                  setActiveItemMenu(null)
                }}
                className="w-full flex items-center gap-2.5 px-3 py-1.5 rounded-lg hover:bg-white/10 text-left transition cursor-pointer"
              >
                <Star size={15} />
                <span>Marcar favorito</span>
              </button>

              <button
                onClick={() => {
                  const doc = workspaces.find((w) => w.id === activeItemMenu.id)
                  if (doc) {
                    handleTogglePrivateWorkspace({ stopPropagation: () => {} } as any, doc)
                  }
                  setActiveItemMenu(null)
                }}
                className="w-full flex items-center gap-2.5 px-3 py-1.5 rounded-lg hover:bg-white/10 text-left transition cursor-pointer"
              >
                <Lock size={15} />
                <span>{activeItemMenu.isPrivate ? 'Hacer pública (Equipo)' : 'Hacer privada (Solo tú)'}</span>
              </button>

              <button
                onClick={() => {
                  if (activeItemMenu.id) {
                    setEmojiPickerTarget({ id: activeItemMenu.id, type: 'doc' })
                  }
                  setActiveItemMenu(null)
                }}
                className="w-full flex items-center gap-2.5 px-3 py-1.5 rounded-lg hover:bg-white/10 text-left transition cursor-pointer"
              >
                <Tag size={15} />
                <span>Cambiar icono...</span>
              </button>

              <div className="h-px bg-white/[0.06] my-1" />

              <button
                onClick={() => {
                  if (activeItemMenu.id) {
                    const currentTitle = activeItemMenu.name || 'Untitled'
                    const newTitle = prompt('Renombrar nota:', currentTitle)
                    if (newTitle && newTitle.trim()) {
                      db.workspaces.update(activeItemMenu.id, {
                        title: newTitle.trim(),
                        updatedAt: Date.now(),
                        syncStatus: 'pending'
                      })
                      syncEngine.scheduleSync(500)
                    }
                  }
                  setActiveItemMenu(null)
                }}
                className="w-full flex items-center gap-2.5 px-3 py-1.5 rounded-lg hover:bg-white/10 text-left transition cursor-pointer"
              >
                <PencilSimple size={15} />
                <span>Renombrar</span>
              </button>

              <button
                onClick={() => {
                  if (activeItemMenu.id) {
                    handleDeleteWorkspace({ stopPropagation: () => {} } as any, activeItemMenu.id)
                  }
                  setActiveItemMenu(null)
                }}
                className="w-full flex items-center gap-2.5 px-3 py-1.5 rounded-lg hover:bg-rose-500/20 text-rose-400 text-left transition cursor-pointer"
              >
                <Trash size={15} />
                <span>Borrar</span>
              </button>
            </div>
          )}
        </div>,
        document.body
      )}
    </aside>
  )
}
