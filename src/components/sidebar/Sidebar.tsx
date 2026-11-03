import React, { useState } from 'react'
import { createPortal } from 'react-dom'
import { useLiveQuery } from 'dexie-react-hooks'
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
  Stack,
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
  onOpenTags?: (tag?: string) => void
  onOpenCollections?: () => void
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
  onOpenTags,
  onOpenCollections,
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
  const [collectionsOpen, setCollectionsOpen] = useState(false)
  const [tagsOpen, setTagsOpen] = useState(false)
  const [toolsOpen, setToolsOpen] = useState(false)

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

  // Live queries for collections and tags in current space
  const dbCollections = useLiveQuery(
    () => db.collections.where('spaceId').equals(currentSpace.id).toArray(),
    [currentSpace.id]
  ) ?? []

  const dbTags = useLiveQuery(
    () => db.tags.where('spaceId').equals(currentSpace.id).toArray(),
    [currentSpace.id]
  ) ?? []

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

  // Filter: Visible items for activeMember (Team docs OR private docs owned by activeMember)
  const activeWorkspaces = workspaces.filter(
    (w) =>
      !w.isDeleted &&
      (w.spaceId || DEFAULT_SPACE_ID) === currentSpace.id &&
      isWorkspaceVisible(w, activeMember, authUser?.id)
  )
  const privateDocs = activeWorkspaces.filter((w) => w.isPrivate)
  const teamDocs = activeWorkspaces.filter((w) => !w.isPrivate)
  const favorites = activeWorkspaces.filter((w) => w.isFavorite)

  const allTags = Array.from(
    new Set([
      ...dbTags.map((t) => t.name),
      ...activeWorkspaces.flatMap((w) => w.tags || [])
    ])
  ).filter(Boolean)

  const allFolders = Array.from(
    new Set(
      teamDocs
        .map((w) => w.folder?.trim())
        .filter((f): f is string => Boolean(f))
    )
  )

  const rootPages = teamDocs.filter(
    (w) => !w.parentId && (!w.folder || !w.folder.trim())
  )

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
    <aside className="w-72 sm:w-64 h-full flex flex-col bg-[#fbfbfa] dark:bg-[#161619] border-r border-black/[0.05] dark:border-white/[0.06] text-neutral-800 dark:text-neutral-200 select-none shrink-0 text-xs transition-colors duration-200 font-sans shadow-2xl md:shadow-none">
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
                        <span className="truncate flex-1 text-left">{sp.name}</span>
                        {sp.isPrivate && (
                          <span
                            className="inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded-full text-[9px] font-semibold bg-amber-500/15 text-amber-600 dark:text-amber-400 shrink-0"
                            title="Espacio privado: Solo visible para ti"
                          >
                            <Lock size={9} weight="bold" />
                            <span>Privado</span>
                          </span>
                        )}
                        <span className="text-[10px] opacity-60 font-mono shrink-0">
                          {docsInSpace}
                        </span>
                      </div>

                      <div className="flex items-center gap-1 shrink-0 ml-1.5">
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

      {/* 6. Scrollable Structure: Favorites, Documents, Collections, Tags, Tools */}
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
                  return (
                    <div
                      key={`priv-${doc.id}`}
                      onClick={() => onSelectWorkspace(doc.id)}
                      className={`group flex items-center justify-between px-2.5 py-1.5 rounded-xl cursor-pointer transition ${
                        isActive
                          ? 'bg-amber-500/10 dark:bg-amber-500/15 text-amber-900 dark:text-amber-200 font-semibold shadow-xs border border-amber-500/30'
                          : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-100 hover:bg-black/[0.03] dark:hover:bg-white/[0.05] font-medium'
                      }`}
                    >
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
                        <span className="truncate flex-1 text-xs">{renderWithAppleEmoji(doc.title || 'Untitled')}</span>
                      </div>
                      <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
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
            className="flex items-center justify-between px-2.5 py-1 text-[11px] font-semibold tracking-wider uppercase text-neutral-400 dark:text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300 cursor-pointer transition group"
          >
            <div className="flex items-center gap-1.5">
              {pagesOpen ? (
                <CaretDown size={13} className="text-neutral-400 transition-transform" />
              ) : (
                <CaretRight size={13} className="text-neutral-400 transition-transform" />
              )}
              <span>Documentos (Equipo)</span>
            </div>
            <div className="flex items-center gap-1">
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
              {allFolders.map((folderName) => {
                const folderDocs = teamDocs.filter((w) => w.folder === folderName)
                const isFolderOpen = folderOpenMap[folderName] !== false

                return (
                  <div key={`folder-${folderName}`} className="mb-1">
                    <div
                      onClick={() => toggleFolder(folderName)}
                      className="group flex items-center justify-between px-2.5 py-1.5 rounded-xl cursor-pointer hover:bg-black/[0.03] dark:hover:bg-white/[0.05] text-neutral-600 dark:text-neutral-400 font-medium transition"
                    >
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        {isFolderOpen ? (
                          <CaretDown size={11} className="text-neutral-400 shrink-0" />
                        ) : (
                          <CaretRight size={11} className="text-neutral-400 shrink-0" />
                        )}
                        <Folder size={15} weight="duotone" className="text-neutral-700 dark:text-neutral-300 shrink-0" />
                        <span className="truncate text-xs font-semibold">{folderName}</span>
                      </div>
                      <div className="flex items-center gap-1">
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

                    {isFolderOpen && folderDocs.length > 0 && (
                      <div className="pl-4 space-y-0.5 border-l border-black/[0.04] dark:border-white/[0.06] ml-3.5 my-0.5">
                        {folderDocs.map((doc) => {
                          const isActive = doc.id === currentWorkspaceId
                          return (
                            <div
                              key={doc.id}
                              onClick={() => onSelectWorkspace(doc.id)}
                              className={`group flex items-center justify-between px-2.5 py-1.5 rounded-xl cursor-pointer transition ${
                                isActive
                                  ? 'bg-white dark:bg-[#202024] text-neutral-900 dark:text-neutral-100 font-semibold shadow-xs border border-black/[0.04] dark:border-white/[0.06]'
                                  : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-100 hover:bg-black/[0.03] dark:hover:bg-white/[0.05] font-medium'
                              }`}
                            >
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
                                <span className="truncate flex-1 text-xs">{renderWithAppleEmoji(doc.title || 'Untitled')}</span>
                                {(doc.ownerName || doc.createdBy) && (
                                  <span
                                    className="text-[9px] text-neutral-400 dark:text-neutral-500 shrink-0 font-normal truncate max-w-[65px] px-1 py-0.5 rounded bg-black/[0.03] dark:bg-white/[0.04]"
                                    title={`Creado por ${doc.ownerName || doc.createdBy}`}
                                  >
                                    {doc.ownerName || doc.createdBy}
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button
                                  onClick={(e) => handleToggleFavorite(e, doc)}
                                  className="p-1 rounded text-neutral-400 hover:text-amber-500"
                                >
                                  <Star size={13} weight={doc.isFavorite ? 'fill' : 'duotone'} className={doc.isFavorite ? 'text-amber-500' : 'text-neutral-400'} />
                                </button>
                                <button
                                  onClick={(e) => handleDeleteWorkspace(e, doc.id)}
                                  className="p-1 rounded text-neutral-400 hover:text-rose-500"
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
                const subpages = activeWorkspaces.filter((w) => w.parentId === page.id)

                return (
                  <div key={page.id} className="space-y-0.5">
                    <div
                      onClick={() => onSelectWorkspace(page.id)}
                      className={`group flex items-center justify-between px-2.5 py-1.5 rounded-xl cursor-pointer transition ${
                        isActive
                          ? 'bg-white dark:bg-[#202024] text-neutral-900 dark:text-neutral-100 font-semibold shadow-xs border border-black/[0.04] dark:border-white/[0.06]'
                          : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-100 hover:bg-black/[0.03] dark:hover:bg-white/[0.05] font-medium'
                      }`}
                    >
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
                        <span className="truncate flex-1">{renderWithAppleEmoji(page.title || 'Untitled')}</span>
                        {(page.ownerName || page.createdBy) && (
                          <span
                            className="text-[9px] text-neutral-400 dark:text-neutral-500 shrink-0 font-normal truncate max-w-[65px] px-1 py-0.5 rounded bg-black/[0.03] dark:bg-white/[0.04]"
                            title={`Creado por ${page.ownerName || page.createdBy}`}
                          >
                            {page.ownerName || page.createdBy}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
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
                          return (
                            <div
                              key={sub.id}
                              onClick={() => onSelectWorkspace(sub.id)}
                              className={`group flex items-center justify-between px-2.5 py-1 rounded-xl cursor-pointer transition ${
                                isSubActive
                                  ? 'bg-white dark:bg-[#202024] text-neutral-900 dark:text-neutral-100 font-semibold shadow-xs border border-black/[0.04] dark:border-white/[0.06]'
                                  : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-100 hover:bg-black/[0.03] dark:hover:bg-white/[0.05] font-medium'
                              }`}
                            >
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
                                <span className="truncate flex-1 text-xs">{renderWithAppleEmoji(sub.title || 'Untitled')}</span>
                                {(sub.ownerName || sub.createdBy) && (
                                  <span
                                    className="text-[9px] text-neutral-400 dark:text-neutral-500 shrink-0 font-normal truncate max-w-[65px] px-1 py-0.5 rounded bg-black/[0.03] dark:bg-white/[0.04]"
                                    title={`Creado por ${sub.ownerName || sub.createdBy}`}
                                  >
                                    {sub.ownerName || sub.createdBy}
                                  </span>
                                )}
                              </div>
                              <button
                                onClick={(e) => handleDeleteWorkspace(e, sub.id)}
                                className="opacity-0 group-hover:opacity-100 p-0.5 rounded text-neutral-400 hover:text-rose-500"
                              >
                                <Trash size={13} weight="duotone" />
                              </button>
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

        {/* COLLECTIONS */}
        <div>
          <div
            onClick={() => setCollectionsOpen(!collectionsOpen)}
            className="flex items-center justify-between px-2.5 py-1 text-[11px] font-semibold tracking-wider uppercase text-neutral-400 dark:text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300 cursor-pointer transition group"
          >
            <div className="flex items-center gap-1.5">
              {collectionsOpen ? (
                <CaretDown size={13} className="text-neutral-400 transition-transform" />
              ) : (
                <CaretRight size={13} className="text-neutral-400 transition-transform" />
              )}
              <span>Colecciones</span>
            </div>
            {onOpenCollections && (
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  onOpenCollections()
                }}
                className="p-0.5 rounded hover:bg-black/10 dark:hover:bg-white/10 text-neutral-400 hover:text-neutral-800 dark:hover:text-neutral-200"
                title="Administrar colecciones"
              >
                <Plus size={13} />
              </button>
            )}
          </div>

          {collectionsOpen && (
            <div className="mt-1 space-y-0.5">
              {dbCollections.length === 0 ? (
                <div className="px-3 py-1.5 text-[11px] text-neutral-400 italic">
                  Sin colecciones creadas
                </div>
              ) : (
                dbCollections.map((col) => (
                  <div
                    key={col.id}
                    onClick={() => onOpenCollections && onOpenCollections()}
                    className="flex items-center justify-between px-2.5 py-1.5 rounded-xl cursor-pointer hover:bg-black/[0.03] dark:hover:bg-white/[0.05] text-neutral-600 dark:text-neutral-400 font-medium transition"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <Stack size={15} weight="duotone" className="text-neutral-700 dark:text-neutral-300 shrink-0" />
                      <span className="truncate">{col.name}</span>
                    </div>
                    <span className="text-[10px] font-mono text-neutral-400">
                      {col.docIds?.length || 0}
                    </span>
                  </div>
                ))
              )}
            </div>
          )}
        </div>

        {/* TAGS */}
        <div>
          <div
            onClick={() => setTagsOpen(!tagsOpen)}
            className="flex items-center justify-between px-2.5 py-1 text-[11px] font-semibold tracking-wider uppercase text-neutral-400 dark:text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300 cursor-pointer transition group"
          >
            <div className="flex items-center gap-1.5">
              {tagsOpen ? (
                <CaretDown size={13} className="text-neutral-400 transition-transform" />
              ) : (
                <CaretRight size={13} className="text-neutral-400 transition-transform" />
              )}
              <span>Etiquetas</span>
            </div>
            {allTags.length > 0 && (
              <span className="text-[10px] font-mono text-neutral-400">
                {allTags.length}
              </span>
            )}
          </div>

          {tagsOpen && (
            <div className="mt-1 flex flex-wrap gap-1 px-2 py-1">
              {allTags.length === 0 ? (
                <span className="text-[11px] text-neutral-400 italic">Sin etiquetas</span>
              ) : (
                allTags.map((tag) => (
                  <button
                    key={tag}
                    onClick={() => onOpenTags && onOpenTags(tag)}
                    className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-lg bg-black/[0.04] dark:bg-white/[0.06] hover:bg-black/[0.08] dark:hover:bg-white/[0.1] text-[11px] font-medium text-neutral-700 dark:text-neutral-300 transition cursor-pointer"
                  >
                    <Tag size={12} weight="duotone" className="text-neutral-500 shrink-0" />
                    <span>{tag}</span>
                  </button>
                ))
              )}
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
    </aside>
  )
}
