import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import {
  SidebarIcon,
  AllDocsIcon,
  JournalIcon,
  SettingsIcon,
  SearchIcon,
  PlusIcon,
  FavoriteIcon,
  FavoritedIcon,
  FolderIcon,
  TemplateIcon,
  ImportIcon,
  DeleteIcon,
  KeyboardIcon,
  UserIcon,
  ToggleDownIcon,
  ToggleRightIcon,
  PageIcon,
  EdgelessIcon,
  SunPanelIcon,
  MoonPanelIcon,
  DoneIcon,
  EditIcon,
  TodayIcon
} from '@blocksuite/icons/rc'
import {
  db,
  type WorkspaceItem,
  type SpaceItem,
  DEFAULT_SPACE_ID
} from '../../db'
import { type SyncEngineStatus } from '../../lib/syncEngine'
import { JournalCalendarPopover } from '../journal/JournalCalendarPopover'

interface SidebarProps {
  spaces?: SpaceItem[]
  currentSpaceId?: string
  onSelectSpace?: (id: string) => void
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
  onOpenDailyJournal: () => void
  onSelectJournalDate?: (date: Date) => void
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
}

export function Sidebar({
  spaces = [],
  currentSpaceId = DEFAULT_SPACE_ID,
  onSelectSpace,
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
  onOpenDailyJournal,
  onSelectJournalDate,
  onOpenTrash,
  onOpenImport,
  onOpenTemplates,
  onOpenShortcuts,
  onOpenTags,
  onOpenCollections,
  onOpenKnowledgeGraph,
  syncStatus,
  darkMode,
  onToggleDarkMode
}: SidebarProps) {
  // Collapsible sections state
  const [favoritesOpen, setFavoritesOpen] = useState(true)
  const [organizeOpen, setOrganizeOpen] = useState(true)
  const [tagsOpen, setTagsOpen] = useState(true)
  const [collectionsOpen, setCollectionsOpen] = useState(true)
  const [othersOpen, setOthersOpen] = useState(true)

  // Calendar popover state
  const [isCalendarOpen, setIsCalendarOpen] = useState(false)

  // Folder collapse states
  const [firstFolderOpen, setFirstFolderOpen] = useState(true)

  // Workspace switcher & dropdown state
  const [showWorkspaceMenu, setShowWorkspaceMenu] = useState(false)
  const [editingSpaceId, setEditingSpaceId] = useState<string | null>(null)
  const [editingSpaceName, setEditingSpaceName] = useState('')

  const currentSpace = spaces.find((s) => s.id === currentSpaceId) || spaces[0] || {
    id: DEFAULT_SPACE_ID,
    name: 'Demo Workspace',
    icon: '⚡',
    color: '#1e96eb'
  }

  // Live queries for collections and tags in current space
  const dbCollections = useLiveQuery(
    () => db.collections.where('spaceId').equals(currentSpace.id).toArray(),
    [currentSpace.id]
  ) ?? []

  const dbTags = useLiveQuery(
    () => db.tags.where('spaceId').equals(currentSpace.id).toArray(),
    [currentSpace.id]
  ) ?? []

  // Create new page inside current workspace
  const handleCreateWorkspace = async (parentId: string | null = null, folderName: string | null = null) => {
    const newId = crypto.randomUUID()
    const now = Date.now()
    try {
      await db.workspaces.add({
        id: newId,
        parentId,
        spaceId: currentSpace.id,
        folder: folderName,
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
        activeProperties: [
          'tags',
          'documentMode',
          'isJournal',
          'templateName',
          'createdAt',
          'updatedAt',
          'createdBy',
          'borderlessTheme',
          'pageWidth'
        ],
        propertyVisibility: {
          tags: 'always_show',
          documentMode: 'always_hide',
          isJournal: 'always_hide',
          templateName: 'always_hide',
          createdAt: 'always_show',
          updatedAt: 'always_show',
          createdBy: 'always_hide',
          borderlessTheme: 'always_hide',
          pageWidth: 'always_hide'
        }
      })
      onSelectWorkspace(newId)
    } catch (err) {
      console.error('Error creating workspace page', err)
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

  const activeWorkspaces = workspaces.filter(
    (w) => !w.isDeleted && (w.spaceId || DEFAULT_SPACE_ID) === currentSpace.id
  )
  const favorites = activeWorkspaces.filter((w) => w.isFavorite)

  // Distinct tags across all notes in this space
  const allTags = Array.from(
    new Set(activeWorkspaces.flatMap((w) => w.tags || []).filter(Boolean))
  )

  // Documents inside "First Folder" or default folder in this space
  const firstFolderDocs = activeWorkspaces.filter(
    (w) => w.folder === 'First Folder' || w.parentId === 'folder-first'
  )
  const rootPages = activeWorkspaces.filter(
    (w) => !w.parentId && w.folder !== 'First Folder'
  )

  return (
    <aside className="w-64 h-full flex flex-col bg-[var(--app-bg-secondary)] border-r border-[var(--app-border)] text-[var(--app-text-primary)] select-none shrink-0 text-sm transition-colors duration-150 font-sans">
      {/* 1. Top Workspace & User Header (Notion Workspace Switcher) */}
      <div className="h-11 px-3 flex items-center justify-between shrink-0 border-b border-[var(--app-border)] relative">
        <div className="flex items-center gap-2 min-w-0 flex-1 relative">
          <div
            onClick={() => setShowWorkspaceMenu(!showWorkspaceMenu)}
            className="flex items-center gap-2 p-1 rounded-md hover:bg-[var(--app-hover)] cursor-pointer transition min-w-0 flex-1 group"
            title="Cambiar espacio de trabajo"
          >
            {/* Notion style workspace icon */}
            <div
              className="w-5 h-5 rounded flex items-center justify-center text-white shrink-0 shadow-2xs font-semibold text-[11px]"
              style={{ backgroundColor: currentSpace.color || '#2383e2' }}
            >
              {currentSpace.icon || currentSpace.name.charAt(0) || '7'}
            </div>
            <span className="font-semibold text-[var(--app-text-primary)] truncate text-xs flex-1 text-left">
              {currentSpace.name}
            </span>
            <div className="flex items-center gap-1 text-[var(--app-text-muted)] shrink-0">
              <ToggleDownIcon className="w-3.5 h-3.5 group-hover:text-[var(--app-text-primary)] transition" />
            </div>
          </div>

          {/* Workspace Dropdown */}
          {showWorkspaceMenu && (
            <>
              {/* Invisible backdrop to close on outside click */}
              <div
                className="fixed inset-0 z-30"
                onClick={() => {
                  setShowWorkspaceMenu(false)
                  setEditingSpaceId(null)
                }}
              />
              <div
                className="absolute left-0 top-10 z-40 w-64 bg-[var(--affine-background-overlay-panel-color)] border border-[var(--affine-border-color)] rounded-xl shadow-[var(--affine-menu-shadow)] p-1.5 animate-in fade-in zoom-in-95 duration-100 flex flex-col gap-1 max-h-[360px] overflow-y-auto"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-center justify-between px-2 py-1">
                  <span className="text-[10px] uppercase font-bold text-[var(--affine-text-secondary-color)]">
                    Espacios de trabajo
                  </span>
                  <span className="text-[10px] bg-[var(--affine-hover-color)] text-[var(--affine-text-secondary-color)] px-1.5 py-0.5 rounded-full font-mono">
                    {spaces.length}
                  </span>
                </div>

                {/* Spaces List */}
                <div className="space-y-0.5 max-h-56 overflow-y-auto custom-scrollbar">
                  {spaces.map((sp) => {
                    const isSelected = sp.id === currentSpace.id
                    const docsInSpace = workspaces.filter(
                      (w) => !w.isDeleted && (w.spaceId || DEFAULT_SPACE_ID) === sp.id
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
                            className="w-full bg-[var(--affine-background-primary-color)] border border-[var(--affine-border-color)] rounded px-2 py-1 text-xs text-[var(--affine-text-primary-color)] outline-none ring-1 ring-[#1e96eb]"
                          />
                        </div>
                      )
                    }

                    return (
                      <div
                        key={sp.id}
                        onClick={() => {
                          if (onSelectSpace) onSelectSpace(sp.id)
                          setShowWorkspaceMenu(false)
                        }}
                        className={`group w-full flex items-center justify-between px-2 py-1.5 rounded-lg text-xs cursor-pointer transition ${
                          isSelected
                            ? 'bg-[var(--affine-hover-color)] text-[var(--affine-text-primary-color)] font-medium'
                            : 'text-[var(--affine-text-secondary-color)] hover:text-[var(--affine-text-primary-color)] hover:bg-[var(--affine-hover-color)]'
                        }`}
                      >
                        <div className="flex items-center gap-2 min-w-0 flex-1">
                          <div
                            className="w-5 h-5 rounded flex items-center justify-center text-[10px] text-white shrink-0 shadow-2xs"
                            style={{ backgroundColor: sp.color || '#1e96eb' }}
                          >
                            {sp.icon || sp.name.charAt(0)}
                          </div>
                          <span className="truncate flex-1 text-left">{sp.name}</span>
                          <span className="text-[10px] opacity-60 font-mono shrink-0">
                            {docsInSpace} {docsInSpace === 1 ? 'doc' : 'docs'}
                          </span>
                        </div>

                        <div className="flex items-center gap-1 shrink-0 ml-1.5">
                          {isSelected && (
                            <DoneIcon className="w-3.5 h-3.5 text-[#1e96eb] shrink-0" />
                          )}
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation()
                              setEditingSpaceId(sp.id)
                              setEditingSpaceName(sp.name)
                            }}
                            className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-[var(--affine-background-primary-color)] text-[var(--affine-icon-color)] hover:text-[var(--affine-text-primary-color)] transition"
                            title="Renombrar espacio"
                          >
                            <EditIcon className="w-3 h-3" />
                          </button>
                          {spaces.length > 1 && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation()
                                if (onDeleteSpace) onDeleteSpace(sp.id)
                              }}
                              className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-rose-500/10 text-[var(--affine-icon-color)] hover:text-rose-500 transition"
                              title="Eliminar espacio"
                            >
                              <DeleteIcon className="w-3 h-3" />
                            </button>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>

                {/* Divider */}
                <div className="h-[1px] bg-[var(--affine-divider-color)]/60 my-1" />

                {/* Add Workspace Action */}
                <button
                  type="button"
                  onClick={() => {
                    setShowWorkspaceMenu(false)
                    if (onOpenCreateSpace) onOpenCreateSpace()
                  }}
                  className="w-full text-left px-2 py-1.5 rounded-lg hover:bg-[var(--affine-hover-color)] text-[#1e96eb] font-semibold transition text-xs flex items-center gap-2"
                >
                  <PlusIcon className="w-3.5 h-3.5 shrink-0" />
                  <span>Añadir espacio de trabajo</span>
                </button>

                {/* Settings Action */}
                <button
                  type="button"
                  onClick={() => {
                    setShowWorkspaceMenu(false)
                    onOpenSettings()
                  }}
                  className="w-full text-left px-2 py-1.5 rounded-lg hover:bg-[var(--affine-hover-color)] text-[var(--affine-text-secondary-color)] hover:text-[var(--affine-text-primary-color)] transition text-xs flex items-center gap-2"
                >
                  <SettingsIcon className="w-3.5 h-3.5 shrink-0" />
                  <span>Ajustes del espacio</span>
                </button>
              </div>
            </>
          )}
        </div>

        {/* Right side buttons: User Profile & Collapse sidebar */}
        <div className="flex items-center gap-0.5 shrink-0 ml-1">
          <button
            onClick={onOpenSettings}
            className="p-1.5 rounded-md text-[var(--app-text-secondary)] hover:text-[var(--app-text-primary)] hover:bg-[var(--app-hover)] transition"
            title="Ajustes de usuario"
          >
            <UserIcon className="w-4 h-4" />
          </button>
          <button
            onClick={onToggleSidebar}
            className="p-1.5 rounded-md text-[var(--app-text-secondary)] hover:text-[var(--app-text-primary)] hover:bg-[var(--app-hover)] transition"
            title="Ocultar barra lateral (Ctrl+\)"
          >
            <SidebarIcon className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* 2. Quick Search & New Page Button (Notion Search & New Page) */}
      <div className="px-2.5 pt-2 pb-1.5 flex items-center gap-1.5">
        <div
          onClick={onOpenSearch}
          className="flex-1 flex items-center justify-between h-[30px] px-2.5 rounded-md bg-[var(--app-bg-primary)] border border-[var(--app-border)] hover:border-[var(--app-border-strong)] cursor-pointer transition text-xs group shadow-2xs"
        >
          <div className="flex items-center gap-2 min-w-0">
            <SearchIcon className="w-3.5 h-3.5 text-[var(--app-text-muted)] group-hover:text-[var(--app-text-primary)] shrink-0 transition" />
            <span className="text-[var(--app-text-muted)] truncate text-xs">Buscar...</span>
          </div>
          <kbd className="text-[9px] bg-[var(--app-hover)] text-[var(--app-text-muted)] px-1 py-0.2 rounded border border-[var(--app-border)] font-mono shrink-0">
            Ctrl K
          </kbd>
        </div>

        {/* Direct Add Page Button */}
        <button
          onClick={() => handleCreateWorkspace()}
          className="w-[30px] h-[30px] rounded-md bg-[var(--app-bg-primary)] border border-[var(--app-border)] hover:border-[var(--app-border-strong)] hover:bg-[var(--app-hover)] text-[var(--app-text-secondary)] hover:text-[var(--app-accent)] flex items-center justify-center shrink-0 transition shadow-2xs"
          title="Nueva página"
        >
          <PlusIcon className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* 3. Primary Navigation Items */}
      <div className="px-2 py-0.5 space-y-0.5">
        <button
          onClick={onOpenAllDocs}
          className="w-full flex items-center justify-between px-2.5 h-[28px] rounded-md hover:bg-[var(--app-hover)] text-[var(--app-text-primary)] transition text-left text-xs"
        >
          <div className="flex items-center gap-2 min-w-0">
            <AllDocsIcon className="w-4 h-4 text-[var(--app-text-secondary)] shrink-0" />
            <span className="truncate text-xs font-medium">Todos los documentos</span>
          </div>
          <span className="text-[10px] text-[var(--app-text-muted)] bg-[var(--app-hover)] px-1.5 py-0.2 rounded font-mono font-medium">
            {activeWorkspaces.length}
          </span>
        </button>

        {onOpenKnowledgeGraph && (
          <button
            onClick={onOpenKnowledgeGraph}
            className="w-full flex items-center gap-2.5 px-3 h-[34px] rounded-lg hover:bg-[var(--affine-hover-color)] text-[var(--affine-text-primary-color)] transition text-left"
          >
            <span className="text-base shrink-0">🌐</span>
            <span className="truncate text-sm font-medium">Grafo de Conocimiento</span>
          </button>
        )}

        <div className="flex items-center gap-1 w-full">
          <button
            onClick={onOpenDailyJournal}
            className="flex-1 flex items-center gap-2.5 px-3 h-[34px] rounded-lg hover:bg-[var(--affine-hover-color)] text-[var(--affine-text-primary-color)] transition text-left"
          >
            <JournalIcon className="w-4.5 h-4.5 text-[var(--affine-icon-color)] shrink-0" />
            <span className="truncate text-sm font-medium">Diario</span>
          </button>
          <div className="relative">
            <button
              onClick={() => setIsCalendarOpen(!isCalendarOpen)}
              className="p-2 rounded-lg text-[var(--affine-icon-color)] hover:text-[var(--affine-text-primary-color)] hover:bg-[var(--affine-hover-color)] transition"
              title="Abrir calendario del diario"
            >
              <TodayIcon className="w-4 h-4" />
            </button>
            <JournalCalendarPopover
              isOpen={isCalendarOpen}
              onClose={() => setIsCalendarOpen(false)}
              workspaces={workspaces}
              onSelectDate={(date) => {
                if (onSelectJournalDate) onSelectJournalDate(date)
                setIsCalendarOpen(false)
              }}
            />
          </div>
        </div>

        <button
          onClick={onOpenSettings}
          className="w-full flex items-center gap-2.5 px-3 h-[34px] rounded-lg hover:bg-[var(--affine-hover-color)] text-[var(--affine-text-primary-color)] transition text-left"
        >
          <SettingsIcon className="w-4.5 h-4.5 text-[var(--affine-icon-color)] shrink-0" />
          <span className="truncate text-sm font-medium">Configuración</span>
        </button>
      </div>

      {/* Divider */}
      <div className="px-3.5 py-1.5">
        <div className="h-[1px] bg-[var(--affine-divider-color)]/60" />
      </div>

      {/* Scrollable Navigation Tree */}
      <div className="flex-1 overflow-y-auto px-2.5 py-1 space-y-3 custom-scrollbar">
        {/* NavigationPanelFavorites */}
        <div>
          <div
            onClick={() => setFavoritesOpen(!favoritesOpen)}
            className="flex items-center justify-between px-2.5 h-7 rounded-lg cursor-pointer hover:bg-[var(--affine-hover-color)] text-[var(--affine-text-secondary-color)] hover:text-[var(--affine-text-primary-color)] transition group"
          >
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider">
              <ToggleRightIcon
                className={`w-3.5 h-3.5 text-[var(--affine-icon-color)] transition-transform duration-200 ${
                  favoritesOpen ? 'rotate-90' : 'rotate-0'
                }`}
              />
              <span>Favoritos</span>
            </div>
            {favorites.length > 0 && (
              <span className="text-[11px] text-[var(--affine-text-secondary-color)] font-mono font-medium">
                {favorites.length}
              </span>
            )}
          </div>

          {favoritesOpen && (
            <div className="mt-1 space-y-0.5">
              {favorites.length === 0 ? (
                <div className="py-2 px-3 text-xs text-[var(--affine-text-secondary-color)] italic">
                  Sin favoritos fijados
                </div>
              ) : (
                favorites.map((fav) => {
                  const isActive = fav.id === currentWorkspaceId
                  return (
                    <div
                      key={`fav-${fav.id}`}
                      onClick={() => onSelectWorkspace(fav.id)}
                      className={`group flex items-center justify-between px-2.5 h-[32px] rounded-lg cursor-pointer transition ${
                        isActive
                          ? 'bg-[var(--affine-background-primary-color)] text-[var(--affine-text-primary-color)] shadow-2xs font-semibold'
                          : 'text-[var(--affine-text-secondary-color)] hover:bg-[var(--affine-hover-color)] hover:text-[var(--affine-text-primary-color)] font-medium'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        {fav.icon ? (
                          <span className="text-sm shrink-0">{fav.icon}</span>
                        ) : fav.viewMode === 'canvas' ? (
                          <EdgelessIcon className="w-4 h-4 text-[#1e96eb] shrink-0" />
                        ) : (
                          <PageIcon className="w-4 h-4 text-[var(--affine-icon-color)] shrink-0" />
                        )}
                        <span className="truncate text-sm">{fav.title || 'Untitled'}</span>
                      </div>
                      <button
                        onClick={(e) => handleToggleFavorite(e, fav)}
                        className="opacity-0 group-hover:opacity-100 p-1 text-amber-400 hover:scale-110 transition shrink-0"
                        title="Quitar de favoritos"
                      >
                        <FavoritedIcon className="w-4 h-4" />
                      </button>
                    </div>
                  )
                })
              )}
            </div>
          )}
        </div>

        {/* NavigationPanelOrganize */}
        <div>
          <div
            onClick={() => setOrganizeOpen(!organizeOpen)}
            className="flex items-center justify-between px-2.5 h-7 rounded-lg cursor-pointer hover:bg-[var(--affine-hover-color)] text-[var(--affine-text-secondary-color)] hover:text-[var(--affine-text-primary-color)] transition group"
          >
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider">
              <ToggleRightIcon
                className={`w-3.5 h-3.5 text-[var(--affine-icon-color)] transition-transform duration-200 ${
                  organizeOpen ? 'rotate-90' : 'rotate-0'
                }`}
              />
              <span>Organizar</span>
            </div>
            <button
              onClick={(e) => {
                e.stopPropagation()
                handleCreateWorkspace(null, 'First Folder')
              }}
              className="opacity-0 group-hover:opacity-100 p-1 rounded-md hover:bg-[var(--affine-hover-color)] text-[var(--affine-icon-color)] hover:text-[var(--affine-text-primary-color)] transition"
              title="Añadir página en carpeta"
            >
              <PlusIcon className="w-4 h-4" />
            </button>
          </div>

          {organizeOpen && (
            <div className="mt-1 space-y-0.5">
              {/* Folder: First Folder */}
              <div>
                <div
                  onClick={() => setFirstFolderOpen(!firstFolderOpen)}
                  className="flex items-center justify-between px-2.5 h-[32px] rounded-lg hover:bg-[var(--affine-hover-color)] cursor-pointer text-[var(--affine-text-primary-color)] transition group"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <ToggleRightIcon
                      className={`w-3.5 h-3.5 text-[var(--affine-icon-color)] transition-transform duration-150 ${
                        firstFolderOpen ? 'rotate-90' : 'rotate-0'
                      }`}
                    />
                    <FolderIcon className="w-4 h-4 text-[var(--affine-icon-color)] shrink-0" />
                    <span className="truncate text-sm font-semibold">First Folder</span>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      handleCreateWorkspace(null, 'First Folder')
                    }}
                    className="opacity-0 group-hover:opacity-100 p-1 rounded-md hover:bg-[var(--affine-hover-color)] text-[var(--affine-icon-color)] hover:text-[var(--affine-text-primary-color)] transition"
                    title="Nueva página dentro de carpeta"
                  >
                    <PlusIcon className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* Sub-pages inside First Folder */}
                {firstFolderOpen && (
                  <div className="pl-4 space-y-0.5 border-l border-[var(--affine-border-color)]/50 ml-3.5 my-0.5">
                    {firstFolderDocs.length === 0 ? (
                      <div className="text-xs text-[var(--affine-text-secondary-color)] py-1 pl-2 italic">
                        Carpeta vacía
                      </div>
                    ) : (
                      firstFolderDocs.map((doc) => {
                        const isActive = doc.id === currentWorkspaceId
                        return (
                          <div
                            key={doc.id}
                            onClick={() => onSelectWorkspace(doc.id)}
                            className={`group flex items-center justify-between px-2.5 h-[30px] rounded-lg cursor-pointer transition ${
                              isActive
                                ? 'bg-[var(--affine-background-primary-color)] text-[var(--affine-text-primary-color)] shadow-2xs font-semibold'
                                : 'text-[var(--affine-text-secondary-color)] hover:bg-[var(--affine-hover-color)] hover:text-[var(--affine-text-primary-color)] font-medium'
                            }`}
                          >
                            <div className="flex items-center gap-2.5 min-w-0">
                              {doc.icon ? (
                                <span className="text-sm shrink-0">{doc.icon}</span>
                              ) : doc.viewMode === 'canvas' ? (
                                <EdgelessIcon className="w-3.5 h-3.5 text-[#1e96eb] shrink-0" />
                              ) : (
                                <PageIcon className="w-3.5 h-3.5 text-[var(--affine-icon-color)] shrink-0" />
                              )}
                              <span className="truncate text-sm">{doc.title || 'Untitled'}</span>
                            </div>
                            <div className="opacity-0 group-hover:opacity-100 flex items-center gap-1">
                              <button
                                onClick={(e) => handleToggleFavorite(e, doc)}
                                className="p-1 hover:text-amber-400 text-[var(--affine-icon-color)]"
                                title={doc.isFavorite ? 'Quitar favorito' : 'Favorito'}
                              >
                                {doc.isFavorite ? (
                                  <FavoritedIcon className="w-3.5 h-3.5 text-amber-400" />
                                ) : (
                                  <FavoriteIcon className="w-3.5 h-3.5" />
                                )}
                              </button>
                              <button
                                onClick={(e) => handleDeleteWorkspace(e, doc.id)}
                                className="p-1 hover:text-rose-500 text-[var(--affine-icon-color)]"
                                title="Eliminar"
                              >
                                <DeleteIcon className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        )
                      })
                    )}
                  </div>
                )}
              </div>

              {/* Other Root Pages */}
              {rootPages.map((doc) => {
                const isActive = doc.id === currentWorkspaceId
                return (
                  <div
                    key={doc.id}
                    onClick={() => onSelectWorkspace(doc.id)}
                    className={`group flex items-center justify-between px-2.5 h-[32px] rounded-lg cursor-pointer transition ${
                      isActive
                        ? 'bg-[var(--affine-background-primary-color)] text-[var(--affine-text-primary-color)] shadow-2xs font-semibold'
                        : 'text-[var(--affine-text-secondary-color)] hover:bg-[var(--affine-hover-color)] hover:text-[var(--affine-text-primary-color)] font-medium'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      {doc.icon ? (
                        <span className="text-sm shrink-0">{doc.icon}</span>
                      ) : doc.viewMode === 'canvas' ? (
                        <EdgelessIcon className="w-4 h-4 text-[#1e96eb] shrink-0" />
                      ) : (
                        <PageIcon className="w-4 h-4 text-[var(--affine-icon-color)] shrink-0" />
                      )}
                      <span className="truncate text-sm">{doc.title || 'Untitled'}</span>
                    </div>
                    <div className="opacity-0 group-hover:opacity-100 flex items-center gap-1">
                      <button
                        onClick={(e) => handleToggleFavorite(e, doc)}
                        className="p-1 hover:text-amber-400 text-[var(--affine-icon-color)]"
                        title={doc.isFavorite ? 'Quitar favorito' : 'Favorito'}
                      >
                        {doc.isFavorite ? (
                          <FavoritedIcon className="w-3.5 h-3.5 text-amber-400" />
                        ) : (
                          <FavoriteIcon className="w-3.5 h-3.5" />
                        )}
                      </button>
                      <button
                        onClick={(e) => handleDeleteWorkspace(e, doc.id)}
                        className="p-1 hover:text-rose-500 text-[var(--affine-icon-color)]"
                        title="Eliminar"
                      >
                        <DeleteIcon className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* NavigationPanelTags */}
        <div>
          <div
            onClick={() => setTagsOpen(!tagsOpen)}
            className="flex items-center justify-between px-2.5 h-7 rounded-lg cursor-pointer hover:bg-[var(--affine-hover-color)] text-[var(--affine-text-secondary-color)] hover:text-[var(--affine-text-primary-color)] transition group"
          >
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider">
              <ToggleRightIcon
                className={`w-3.5 h-3.5 text-[var(--affine-icon-color)] transition-transform duration-200 ${
                  tagsOpen ? 'rotate-90' : 'rotate-0'
                }`}
              />
              <span>Etiquetas</span>
            </div>
            <div className="flex items-center gap-1">
              {allTags.length > 0 && (
                <span className="text-[11px] text-[var(--affine-text-secondary-color)] font-mono font-medium">
                  {allTags.length}
                </span>
              )}
              {onOpenTags && (
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    onOpenTags()
                  }}
                  className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-[var(--affine-hover-color-filled)] text-[var(--affine-icon-color)]"
                  title="Gestionar etiquetas"
                >
                  <PlusIcon className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          {tagsOpen && (
            <div className="mt-1 space-y-0.5">
              {allTags.length === 0 ? (
                <div
                  onClick={() => onOpenTags && onOpenTags()}
                  className="py-2 px-3 text-xs text-[var(--affine-text-secondary-color)] italic cursor-pointer hover:underline"
                >
                  + Añadir primera etiqueta
                </div>
              ) : (
                allTags.map((name) => {
                  const tagItem = dbTags.find((t) => t.name.toLowerCase() === name.toLowerCase())
                  const color = tagItem?.color || '#1e96eb'
                  const count = activeWorkspaces.filter((w) => w.tags && w.tags.includes(name)).length

                  return (
                    <div
                      key={name}
                      onClick={() => onOpenTags && onOpenTags(name)}
                      className="flex items-center justify-between h-[30px] px-2.5 rounded-lg hover:bg-[var(--affine-hover-color)] text-[var(--affine-text-secondary-color)] hover:text-[var(--affine-text-primary-color)] cursor-pointer text-sm transition"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span
                          className="w-2.5 h-2.5 rounded-full shrink-0 shadow-2xs"
                          style={{ backgroundColor: color }}
                        />
                        <span className="truncate">#{name}</span>
                      </div>
                      <span className="text-[10px] font-mono text-[var(--affine-text-secondary-color)]">
                        {count}
                      </span>
                    </div>
                  )
                })
              )}
            </div>
          )}
        </div>

        {/* NavigationPanelCollections */}
        <div>
          <div
            onClick={() => setCollectionsOpen(!collectionsOpen)}
            className="flex items-center justify-between px-2.5 h-7 rounded-lg cursor-pointer hover:bg-[var(--affine-hover-color)] text-[var(--affine-text-secondary-color)] hover:text-[var(--affine-text-primary-color)] transition group"
          >
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider">
              <ToggleRightIcon
                className={`w-3.5 h-3.5 text-[var(--affine-icon-color)] transition-transform duration-200 ${
                  collectionsOpen ? 'rotate-90' : 'rotate-0'
                }`}
              />
              <span>Colecciones</span>
            </div>
            <div className="flex items-center gap-1">
              {dbCollections.length > 0 && (
                <span className="text-[11px] text-[var(--affine-text-secondary-color)] font-mono font-medium">
                  {dbCollections.length}
                </span>
              )}
              {onOpenCollections && (
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    onOpenCollections()
                  }}
                  className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-[var(--affine-hover-color-filled)] text-[var(--affine-icon-color)]"
                  title="Gestionar colecciones"
                >
                  <PlusIcon className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          {collectionsOpen && (
            <div className="mt-1 space-y-0.5">
              {dbCollections.length === 0 ? (
                <div
                  onClick={() => onOpenCollections && onOpenCollections()}
                  className="py-2 px-3 text-xs text-[var(--affine-text-secondary-color)] italic cursor-pointer hover:underline"
                >
                  + Crear primera colección
                </div>
              ) : (
                dbCollections.map((col) => (
                  <div
                    key={col.id}
                    onClick={() => onOpenCollections && onOpenCollections()}
                    className="flex items-center justify-between h-[30px] px-2.5 rounded-lg hover:bg-[var(--affine-hover-color)] text-[var(--affine-text-secondary-color)] hover:text-[var(--affine-text-primary-color)] cursor-pointer text-sm transition"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-sm shrink-0">{col.icon || '📁'}</span>
                      <span className="truncate">{col.name}</span>
                    </div>
                    <span className="text-[10px] font-mono text-[var(--affine-text-secondary-color)]">
                      {col.docIds.length}
                    </span>
                  </div>
                ))
              )}
            </div>
          )}
        </div>

        {/* CollapsibleSection Others */}
        <div>
          <div
            onClick={() => setOthersOpen(!othersOpen)}
            className="flex items-center justify-between px-2.5 h-7 rounded-lg cursor-pointer hover:bg-[var(--affine-hover-color)] text-[var(--affine-text-secondary-color)] hover:text-[var(--affine-text-primary-color)] transition group"
          >
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider">
              <ToggleRightIcon
                className={`w-3.5 h-3.5 text-[var(--affine-icon-color)] transition-transform duration-200 ${
                  othersOpen ? 'rotate-90' : 'rotate-0'
                }`}
              />
              <span>Otros</span>
            </div>
          </div>

          {othersOpen && (
            <div className="mt-1 space-y-0.5">
              <button
                onClick={onOpenTrash}
                className="w-full flex items-center gap-2.5 px-3 h-[32px] rounded-lg hover:bg-[var(--affine-hover-color)] text-[var(--affine-text-secondary-color)] hover:text-[var(--affine-text-primary-color)] transition text-left text-sm"
              >
                <DeleteIcon className="w-4.5 h-4.5 text-[var(--affine-icon-color)] shrink-0" />
                <span className="truncate">Papelera de reciclaje</span>
              </button>

              <button
                onClick={onOpenImport}
                className="w-full flex items-center gap-2.5 px-3 h-[32px] rounded-lg hover:bg-[var(--affine-hover-color)] text-[var(--affine-text-secondary-color)] hover:text-[var(--affine-text-primary-color)] transition text-left text-sm"
              >
                <ImportIcon className="w-4.5 h-4.5 text-[var(--affine-icon-color)] shrink-0" />
                <span className="truncate">Importar</span>
              </button>

              <button
                onClick={onOpenTemplates}
                className="w-full flex items-center gap-2.5 px-3 h-[32px] rounded-lg hover:bg-[var(--affine-hover-color)] text-[var(--affine-text-secondary-color)] hover:text-[var(--affine-text-primary-color)] transition text-left text-sm"
              >
                <TemplateIcon className="w-4.5 h-4.5 text-[var(--affine-icon-color)] shrink-0" />
                <span className="truncate">Plantillas</span>
              </button>

              <button
                onClick={onOpenShortcuts}
                className="w-full flex items-center gap-2.5 px-3 h-[32px] rounded-lg hover:bg-[var(--affine-hover-color)] text-[var(--affine-text-secondary-color)] hover:text-[var(--affine-text-primary-color)] transition text-left text-sm"
              >
                <KeyboardIcon className="w-4.5 h-4.5 text-[var(--affine-icon-color)] shrink-0" />
                <span className="truncate">Atajos de teclado</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* 5. Bottom Footer Bar (AFFiNE BottomContainer: Sync Status, Dark Mode Toggle, Shortcuts) */}
      <div className="h-12 px-3.5 border-t border-[var(--affine-border-color)]/50 flex items-center justify-between text-xs text-[var(--affine-text-secondary-color)] shrink-0 bg-[var(--affine-background-secondary-color)]">
        <div className="flex items-center gap-2">
          <div
            className={`w-2.5 h-2.5 rounded-full ${
              syncStatus.state === 'syncing'
                ? 'bg-amber-500 animate-pulse'
                : syncStatus.isOnline
                ? 'bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.5)]'
                : 'bg-zinc-400'
            }`}
            title={syncStatus.isOnline ? 'Conectado / En línea' : 'Modo local sin conexión'}
          />
          <span className="truncate text-xs font-semibold">
            {syncStatus.state === 'syncing' ? 'Sincronizando...' : syncStatus.isOnline ? 'En línea' : 'Local'}
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            onClick={onToggleDarkMode}
            className="p-1.5 rounded-lg hover:bg-[var(--affine-hover-color)] text-[var(--affine-icon-color)] hover:text-[var(--affine-text-primary-color)] transition"
            title={darkMode ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
          >
            {darkMode ? <SunPanelIcon className="w-4 h-4 text-amber-400" /> : <MoonPanelIcon className="w-4 h-4 text-indigo-500" />}
          </button>
          <button
            onClick={onOpenShortcuts}
            className="p-1.5 rounded-lg hover:bg-[var(--affine-hover-color)] text-[var(--affine-icon-color)] hover:text-[var(--affine-text-primary-color)] transition"
            title="Atajos de teclado (?)"
          >
            <KeyboardIcon className="w-4 h-4" />
          </button>
        </div>
      </div>
    </aside>
  )
}
