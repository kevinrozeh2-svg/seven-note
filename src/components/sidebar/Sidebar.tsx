import { useState } from 'react'
import {
  Star,
  Plus,
  Trash2,
  Settings,
  Search,
  ChevronRight,
  ChevronDown,
  FileText,
  Calendar,
  Folder,
  FolderOpen,
  Tag,
  Layers,
  Upload,
  PanelLeftClose,
  User
} from 'lucide-react'
import { db, type WorkspaceItem } from '../../db'
import { syncEngine, type SyncEngineStatus } from '../../lib/syncEngine'

interface SidebarProps {
  workspaces: WorkspaceItem[]
  currentWorkspaceId: string
  onSelectWorkspace: (id: string) => void
  onToggleSidebar: () => void
  onOpenSettings: () => void
  onOpenSearch: () => void
  onOpenAllDocs: () => void
  onOpenDailyJournal: () => void
  onOpenTrash: () => void
  onOpenImport: () => void
  onOpenTemplates: () => void
  syncStatus: SyncEngineStatus
  darkMode: boolean
  onToggleDarkMode: () => void
}

export function Sidebar({
  workspaces,
  currentWorkspaceId,
  onSelectWorkspace,
  onToggleSidebar,
  onOpenSettings,
  onOpenSearch,
  onOpenAllDocs,
  onOpenDailyJournal,
  onOpenTrash,
  onOpenImport,
  onOpenTemplates
}: SidebarProps) {
  // Collapsible sections state
  const [favoritesOpen, setFavoritesOpen] = useState(true)
  const [organizeOpen, setOrganizeOpen] = useState(true)
  const [tagsOpen, setTagsOpen] = useState(false)
  const [collectionsOpen, setCollectionsOpen] = useState(false)
  const [othersOpen, setOthersOpen] = useState(true)

  // Folder collapse states
  const [firstFolderOpen, setFirstFolderOpen] = useState(true)

  // Workspace name popup / switcher
  const [showWorkspaceMenu, setShowWorkspaceMenu] = useState(false)
  const [workspaceName, setWorkspaceName] = useState('Demo Workspace')
  const [isEditingWsName, setIsEditingWsName] = useState(false)

  // Create new page
  const handleCreateWorkspace = async (parentId: string | null = null, folderName: string | null = null) => {
    const newId = crypto.randomUUID()
    const now = Date.now()
    try {
      await db.workspaces.add({
        id: newId,
        parentId,
        folder: folderName,
        title: 'Untitled',
        icon: '',
        color: '#3b82f6',
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
      syncEngine.scheduleSync(1000)
      onSelectWorkspace(newId)
    } catch (err) {
      console.error('Error creating workspace', err)
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
      syncEngine.scheduleSync(1000)
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
      syncEngine.scheduleSync(1000)

      if (id === currentWorkspaceId) {
        const remaining = workspaces.filter((w) => w.id !== id && !w.isDeleted)
        if (remaining.length > 0) onSelectWorkspace(remaining[0].id)
      }
    } catch (err) {
      console.error('Error moving to trash', err)
    }
  }

  const activeWorkspaces = workspaces.filter((w) => !w.isDeleted)
  const favorites = activeWorkspaces.filter((w) => w.isFavorite)

  // Distinct tags across all notes
  const allTags = Array.from(
    new Set(activeWorkspaces.flatMap((w) => w.tags || []).filter(Boolean))
  )

  // Documents inside "First Folder" or default folder
  const firstFolderDocs = activeWorkspaces.filter(
    (w) => w.folder === 'First Folder' || w.parentId === 'folder-first'
  )
  const rootPages = activeWorkspaces.filter(
    (w) => !w.parentId && w.folder !== 'First Folder'
  )

  return (
    <aside className="w-60 h-full flex flex-col bg-[#141416] border-r border-[#242428] text-zinc-300 select-none shrink-0 text-xs">
      {/* Top Sidebar Bar with Collapse Button */}
      <div className="h-10 px-3 flex items-center justify-between shrink-0">
        <button
          onClick={onToggleSidebar}
          className="p-1 rounded text-zinc-400 hover:text-zinc-100 hover:bg-[#202024] transition"
          title="Ocultar barra lateral"
        >
          <PanelLeftClose size={16} />
        </button>
      </div>

      {/* Workspace Selector Item (Matches Screenshot) */}
      <div className="px-3 pb-2 relative">
        <div
          onClick={() => setShowWorkspaceMenu(!showWorkspaceMenu)}
          className="flex items-center justify-between p-1.5 rounded-lg hover:bg-[#202024] cursor-pointer transition group"
        >
          <div className="flex items-center gap-2.5 min-w-0">
            {/* Teal rounded square icon */}
            <div className="w-6 h-6 rounded-md bg-[#0d9488] flex items-center justify-center text-white shrink-0 shadow-xs">
              <span className="text-[11px] font-bold">▢</span>
            </div>
            <span className="font-semibold text-zinc-100 truncate text-xs">
              {workspaceName}
            </span>
          </div>

          {/* User profile icon */}
          <div className="w-5 h-5 rounded-full bg-[#27272a] flex items-center justify-center text-zinc-400 shrink-0">
            <User size={12} />
          </div>
        </div>

        {/* Workspace Dropdown */}
        {showWorkspaceMenu && (
          <div
            className="absolute left-3 right-3 top-11 z-30 bg-[#1b1b1e] border border-[#2c2c32] rounded-xl shadow-2xl p-2"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="text-[10px] uppercase font-bold text-zinc-500 px-2 py-1">
              Espacio de trabajo
            </div>
            {isEditingWsName ? (
              <div className="flex gap-1 p-1">
                <input
                  type="text"
                  value={workspaceName}
                  onChange={(e) => setWorkspaceName(e.target.value)}
                  onBlur={() => setIsEditingWsName(false)}
                  onKeyDown={(e) => e.key === 'Enter' && setIsEditingWsName(false)}
                  autoFocus
                  className="flex-1 bg-[#121214] border border-[#3b3b44] rounded px-2 py-1 text-xs text-zinc-100"
                />
              </div>
            ) : (
              <button
                onClick={() => setIsEditingWsName(true)}
                className="w-full text-left px-2 py-1.5 rounded hover:bg-[#27272e] text-zinc-200 transition text-xs flex items-center justify-between"
              >
                <span>Renombrar espacio</span>
                <span className="text-[10px] text-zinc-500">Editar</span>
              </button>
            )}
            <button
              onClick={() => {
                setShowWorkspaceMenu(false)
                onOpenSettings()
              }}
              className="w-full text-left px-2 py-1.5 rounded hover:bg-[#27272e] text-zinc-200 transition text-xs"
            >
              Ajustes del espacio
            </button>
          </div>
        )}
      </div>

      {/* Quick Search Row (Matches Screenshot) */}
      <div className="px-3 py-1">
        <div className="flex items-center justify-between rounded-lg hover:bg-[#202024] p-1.5 transition cursor-pointer text-zinc-400 hover:text-zinc-200 group">
          <div
            onClick={onOpenSearch}
            className="flex items-center gap-2.5 flex-1 min-w-0"
          >
            <Search size={14} className="shrink-0 text-zinc-400" />
            <span className="text-xs truncate">Búsqueda rápida</span>
          </div>
          <button
            onClick={(e) => {
              e.stopPropagation()
              handleCreateWorkspace()
            }}
            className="p-0.5 rounded hover:bg-[#2c2c34] text-zinc-400 hover:text-white transition"
            title="Crear nueva página"
          >
            <Plus size={14} />
          </button>
        </div>
      </div>

      {/* Main Navigation Links */}
      <div className="px-3 py-1 space-y-0.5">
        {/* Todos los documentos */}
        <button
          onClick={onOpenAllDocs}
          className="w-full flex items-center gap-2.5 p-1.5 rounded-lg hover:bg-[#202024] text-zinc-300 hover:text-zinc-100 transition text-left"
        >
          <FileText size={14} className="text-zinc-400 shrink-0" />
          <span className="truncate">Todos los documentos</span>
        </button>

        {/* Diarios */}
        <button
          onClick={onOpenDailyJournal}
          className="w-full flex items-center gap-2.5 p-1.5 rounded-lg hover:bg-[#202024] text-zinc-300 hover:text-zinc-100 transition text-left"
        >
          <Calendar size={14} className="text-zinc-400 shrink-0" />
          <span className="truncate">Diarios</span>
        </button>

        {/* Configuración */}
        <button
          onClick={onOpenSettings}
          className="w-full flex items-center gap-2.5 p-1.5 rounded-lg hover:bg-[#202024] text-zinc-300 hover:text-zinc-100 transition text-left"
        >
          <Settings size={14} className="text-zinc-400 shrink-0" />
          <span className="truncate">Configuración</span>
        </button>
      </div>

      {/* Scrollable Navigation Tree */}
      <div className="flex-1 overflow-y-auto px-3 py-2 space-y-3">
        {/* Section: Favoritos */}
        <div>
          <button
            onClick={() => setFavoritesOpen(!favoritesOpen)}
            className="w-full flex items-center justify-between py-1 text-zinc-400 hover:text-zinc-200 transition text-[11px] font-medium"
          >
            <div className="flex items-center gap-1">
              <span>Favoritos</span>
              {favoritesOpen ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
            </div>
          </button>

          {favoritesOpen && (
            <div className="mt-1">
              {favorites.length === 0 ? (
                /* Empty state matching screenshot */
                <div className="flex flex-col items-center justify-center py-4 text-center">
                  <div className="w-8 h-8 rounded-full border border-dashed border-[#2f2f36] flex items-center justify-center text-zinc-500 mb-1.5">
                    <Star size={14} />
                  </div>
                  <span className="text-[11px] text-zinc-500">No hay favoritos</span>
                </div>
              ) : (
                <div className="space-y-0.5">
                  {favorites.map((fav) => (
                    <div
                      key={`fav-${fav.id}`}
                      onClick={() => onSelectWorkspace(fav.id)}
                      className={`group flex items-center justify-between p-1.5 rounded-lg cursor-pointer transition ${
                        fav.id === currentWorkspaceId
                          ? 'bg-[#222226] text-zinc-100 font-semibold'
                          : 'text-zinc-400 hover:bg-[#1a1a1e] hover:text-zinc-200'
                      }`}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-xs">{fav.icon || '📄'}</span>
                        <span className="truncate">{fav.title || 'Untitled'}</span>
                      </div>
                      <button
                        onClick={(e) => handleToggleFavorite(e, fav)}
                        className="opacity-0 group-hover:opacity-100 p-0.5 text-amber-400 transition"
                      >
                        <Star size={12} fill="currentColor" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Section: Organizar */}
        <div>
          <div className="flex items-center justify-between py-1 text-zinc-400 text-[11px] font-medium">
            <button
              onClick={() => setOrganizeOpen(!organizeOpen)}
              className="flex items-center gap-1 hover:text-zinc-200 transition"
            >
              <span>Organizar</span>
              {organizeOpen ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
            </button>
            <button
              onClick={() => handleCreateWorkspace(null, 'First Folder')}
              className="p-0.5 rounded hover:bg-[#242428] text-zinc-500 hover:text-zinc-200"
              title="Añadir página en First Folder"
            >
              <Plus size={12} />
            </button>
          </div>

          {organizeOpen && (
            <div className="mt-1 space-y-1">
              {/* Folder: First Folder (Matches Screenshot) */}
              <div className="space-y-0.5">
                <div
                  onClick={() => setFirstFolderOpen(!firstFolderOpen)}
                  className="flex items-center justify-between p-1.5 rounded-lg hover:bg-[#202024] cursor-pointer text-zinc-300 hover:text-zinc-100 transition group"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-zinc-400 group-hover:text-zinc-200">
                      {firstFolderOpen ? <FolderOpen size={14} /> : <Folder size={14} />}
                    </span>
                    <span className="truncate text-xs font-medium">First Folder</span>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      handleCreateWorkspace(null, 'First Folder')
                    }}
                    className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-[#28282e] text-zinc-400 hover:text-white transition"
                    title="Nueva página dentro de carpeta"
                  >
                    <Plus size={12} />
                  </button>
                </div>

                {/* Sub-pages inside First Folder */}
                {firstFolderOpen && (
                  <div className="pl-4 space-y-0.5">
                    {firstFolderDocs.length === 0 ? (
                      <div className="text-[10px] text-zinc-600 py-1 pl-2">
                        Carpeta vacía
                      </div>
                    ) : (
                      firstFolderDocs.map((doc) => (
                        <div
                          key={doc.id}
                          onClick={() => onSelectWorkspace(doc.id)}
                          className={`group flex items-center justify-between p-1 rounded-md cursor-pointer transition ${
                            doc.id === currentWorkspaceId
                              ? 'bg-[#222226] text-zinc-100 font-medium'
                              : 'text-zinc-400 hover:bg-[#1a1a1e] hover:text-zinc-200'
                          }`}
                        >
                          <div className="flex items-center gap-1.5 min-w-0">
                            <span className="text-xs">{doc.icon || '📄'}</span>
                            <span className="truncate text-xs">{doc.title || 'Untitled'}</span>
                          </div>
                          <div className="opacity-0 group-hover:opacity-100 flex items-center gap-1">
                            <button
                              onClick={(e) => handleToggleFavorite(e, doc)}
                              className="p-0.5 hover:text-amber-400 text-zinc-500"
                            >
                              <Star size={11} fill={doc.isFavorite ? 'currentColor' : 'none'} />
                            </button>
                            <button
                              onClick={(e) => handleDeleteWorkspace(e, doc.id)}
                              className="p-0.5 hover:text-rose-400 text-zinc-500"
                            >
                              <Trash2 size={11} />
                            </button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>

              {/* Other Root Pages */}
              {rootPages.map((doc) => (
                <div
                  key={doc.id}
                  onClick={() => onSelectWorkspace(doc.id)}
                  className={`group flex items-center justify-between p-1.5 rounded-lg cursor-pointer transition ${
                    doc.id === currentWorkspaceId
                      ? 'bg-[#222226] text-zinc-100 font-medium'
                      : 'text-zinc-400 hover:bg-[#1a1a1e] hover:text-zinc-200'
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-xs">{doc.icon || '📄'}</span>
                    <span className="truncate text-xs">{doc.title || 'Untitled'}</span>
                  </div>
                  <div className="opacity-0 group-hover:opacity-100 flex items-center gap-1">
                    <button
                      onClick={(e) => handleToggleFavorite(e, doc)}
                      className="p-0.5 hover:text-amber-400 text-zinc-500"
                    >
                      <Star size={11} fill={doc.isFavorite ? 'currentColor' : 'none'} />
                    </button>
                    <button
                      onClick={(e) => handleDeleteWorkspace(e, doc.id)}
                      className="p-0.5 hover:text-rose-400 text-zinc-500"
                    >
                      <Trash2 size={11} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Section: Etiquetas ▸ */}
        <div>
          <button
            onClick={() => setTagsOpen(!tagsOpen)}
            className="w-full flex items-center justify-between py-1 text-zinc-400 hover:text-zinc-200 transition text-[11px] font-medium"
          >
            <div className="flex items-center gap-1">
              <span>Etiquetas</span>
              {tagsOpen ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
            </div>
          </button>

          {tagsOpen && (
            <div className="mt-1 pl-2 space-y-1">
              {allTags.length === 0 ? (
                <span className="text-[11px] text-zinc-500">No hay etiquetas creadas</span>
              ) : (
                allTags.map((tag) => (
                  <div
                    key={tag}
                    onClick={onOpenAllDocs}
                    className="flex items-center gap-1.5 py-1 px-1.5 rounded hover:bg-[#1f1f24] text-zinc-400 hover:text-zinc-200 cursor-pointer text-xs"
                  >
                    <Tag size={12} className="text-zinc-500" />
                    <span>#{tag}</span>
                  </div>
                ))
              )}
            </div>
          )}
        </div>

        {/* Section: Colecciones ▸ */}
        <div>
          <button
            onClick={() => setCollectionsOpen(!collectionsOpen)}
            className="w-full flex items-center justify-between py-1 text-zinc-400 hover:text-zinc-200 transition text-[11px] font-medium"
          >
            <div className="flex items-center gap-1">
              <span>Colecciones</span>
              {collectionsOpen ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
            </div>
          </button>

          {collectionsOpen && (
            <div className="mt-1 pl-2 space-y-1">
              <div
                onClick={onOpenAllDocs}
                className="flex items-center gap-1.5 py-1 px-1.5 rounded hover:bg-[#1f1f24] text-zinc-400 hover:text-zinc-200 cursor-pointer text-xs"
              >
                <Layers size={12} className="text-zinc-500" />
                <span>Proyectos Activos</span>
              </div>
              <div
                onClick={onOpenAllDocs}
                className="flex items-center gap-1.5 py-1 px-1.5 rounded hover:bg-[#1f1f24] text-zinc-400 hover:text-zinc-200 cursor-pointer text-xs"
              >
                <Layers size={12} className="text-zinc-500" />
                <span>Recursos & Guías</span>
              </div>
            </div>
          )}
        </div>

        {/* Section: Otros ▾ */}
        <div>
          <button
            onClick={() => setOthersOpen(!othersOpen)}
            className="w-full flex items-center justify-between py-1 text-zinc-400 hover:text-zinc-200 transition text-[11px] font-medium"
          >
            <div className="flex items-center gap-1">
              <span>Otros</span>
              {othersOpen ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
            </div>
          </button>

          {othersOpen && (
            <div className="mt-1 space-y-0.5">
              {/* Papelera de reciclaje */}
              <button
                onClick={onOpenTrash}
                className="w-full flex items-center gap-2 p-1.5 rounded-lg hover:bg-[#202024] text-zinc-400 hover:text-zinc-200 transition text-left"
              >
                <Trash2 size={14} className="shrink-0" />
                <span>Papelera de reciclaje</span>
              </button>

              {/* Importar */}
              <button
                onClick={onOpenImport}
                className="w-full flex items-center gap-2 p-1.5 rounded-lg hover:bg-[#202024] text-zinc-400 hover:text-zinc-200 transition text-left"
              >
                <Upload size={14} className="shrink-0" />
                <span>Importar</span>
              </button>

              {/* Plantilla */}
              <button
                onClick={onOpenTemplates}
                className="w-full flex items-center gap-2 p-1.5 rounded-lg hover:bg-[#202024] text-zinc-400 hover:text-zinc-200 transition text-left"
              >
                <Layers size={14} className="shrink-0" />
                <span>Plantilla</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </aside>
  )
}
