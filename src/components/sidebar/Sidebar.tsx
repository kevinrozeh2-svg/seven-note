import { useState } from 'react'
import {
  Star,
  Plus,
  Trash2,
  Settings,
  Search,
  ChevronRight,
  ChevronDown,
  Cloud,
  CloudOff,
  RefreshCw,
  Sun,
  Moon
} from 'lucide-react'
import { db, type WorkspaceItem } from '../../db'
import { syncEngine, type SyncEngineStatus } from '../../lib/syncEngine'

interface SidebarProps {
  workspaces: WorkspaceItem[]
  currentWorkspaceId: string
  onSelectWorkspace: (id: string) => void
  onOpenSettings: () => void
  onOpenSearch: () => void
  onOpenTrash: () => void
  syncStatus: SyncEngineStatus
  darkMode: boolean
  onToggleDarkMode: () => void
}

export function Sidebar({
  workspaces,
  currentWorkspaceId,
  onSelectWorkspace,
  onOpenSettings,
  onOpenSearch,
  onOpenTrash,
  syncStatus,
  darkMode,
  onToggleDarkMode
}: SidebarProps) {
  const [collapsedParents, setCollapsedParents] = useState<Record<string, boolean>>({})

  const toggleCollapse = (id: string) => {
    setCollapsedParents((prev) => ({ ...prev, [id]: !prev[id] }))
  }

  // Create new page
  const handleCreateWorkspace = async (parentId: string | null = null) => {
    const newId = crypto.randomUUID()
    const now = Date.now()
    try {
      await db.workspaces.add({
        id: newId,
        parentId,
        title: 'Nueva Página',
        icon: '📄',
        color: '#6366f1',
        viewMode: 'split',
        docContent: '<h1>Nueva Página</h1><p>Comienza a escribir o cambia al modo tablero...</p>',
        createdAt: now,
        updatedAt: now,
        isFavorite: false,
        isDeleted: false,
        syncStatus: 'pending'
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

      // If active page was deleted, select first available
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
  const rootPages = activeWorkspaces.filter((w) => !w.parentId)

  // Render a workspace item and recursively render its sub-boards
  const renderItem = (ws: WorkspaceItem, level = 0) => {
    const children = activeWorkspaces.filter((w) => w.parentId === ws.id)
    const hasChildren = children.length > 0
    const isCollapsed = collapsedParents[ws.id]
    const isActive = ws.id === currentWorkspaceId

    return (
      <div key={ws.id} className="select-none">
        <div
          onClick={() => onSelectWorkspace(ws.id)}
          className={`group flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-medium cursor-pointer transition ${
            isActive
              ? 'bg-indigo-50 dark:bg-indigo-950/70 text-indigo-700 dark:text-indigo-300 font-semibold'
              : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
          style={{ paddingLeft: `${8 + level * 14}px` }}
        >
          <div className="flex items-center gap-1.5 min-w-0 flex-1">
            {hasChildren ? (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  toggleCollapse(ws.id)
                }}
                className="p-0.5 hover:bg-slate-200 dark:hover:bg-slate-700 rounded text-slate-400"
              >
                {isCollapsed ? <ChevronRight size={12} /> : <ChevronDown size={12} />}
              </button>
            ) : (
              <span className="w-3 text-center">{ws.icon || '📄'}</span>
            )}
            <span className="truncate">{ws.title || 'Sin título'}</span>
          </div>

          <div className="opacity-0 group-hover:opacity-100 flex items-center gap-1 transition">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                handleCreateWorkspace(ws.id)
              }}
              className="p-1 hover:bg-slate-200 dark:hover:bg-slate-700 rounded text-slate-400 hover:text-indigo-500"
              title="Añadir sub-página"
            >
              <Plus size={11} />
            </button>
            <button
              type="button"
              onClick={(e) => handleToggleFavorite(e, ws)}
              className={`p-1 hover:bg-slate-200 dark:hover:bg-slate-700 rounded ${
                ws.isFavorite ? 'text-amber-500' : 'text-slate-400'
              }`}
              title={ws.isFavorite ? 'Quitar de favoritos' : 'Añadir a favoritos'}
            >
              <Star size={11} fill={ws.isFavorite ? 'currentColor' : 'none'} />
            </button>
            <button
              type="button"
              onClick={(e) => handleDeleteWorkspace(e, ws.id)}
              className="p-1 hover:bg-rose-100 dark:hover:bg-rose-900/50 rounded text-slate-400 hover:text-rose-600"
              title="Mover a papelera"
            >
              <Trash2 size={11} />
            </button>
          </div>
        </div>

        {/* Sub-pages */}
        {hasChildren && !isCollapsed && (
          <div className="mt-0.5 space-y-0.5">
            {children.map((child) => renderItem(child, level + 1))}
          </div>
        )}
      </div>
    )
  }

  return (
    <aside className="w-64 h-full flex flex-col bg-slate-50/90 dark:bg-slate-900/90 border-r border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200 shrink-0">
      {/* Brand & Workspace Header */}
      <div className="flex items-center justify-between px-4 py-3.5 border-b border-slate-200 dark:border-slate-800">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-indigo-600 text-white flex items-center justify-center font-bold text-sm shadow-md">
            7
          </div>
          <span className="font-bold text-sm tracking-tight text-slate-900 dark:text-white">
            Seven Note
          </span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={onToggleDarkMode}
            className="p-1.5 rounded-md hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400 transition"
            title={darkMode ? 'Modo claro' : 'Modo oscuro'}
          >
            {darkMode ? <Sun size={15} /> : <Moon size={15} />}
          </button>
          <button
            onClick={onOpenSettings}
            className="p-1.5 rounded-md hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400 transition"
            title="Configuración"
          >
            <Settings size={15} />
          </button>
        </div>
      </div>

      {/* Global Search Button */}
      <div className="px-3 pt-3">
        <button
          onClick={onOpenSearch}
          className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700/80 text-slate-400 text-xs hover:border-slate-300 dark:hover:border-slate-600 transition shadow-xs"
        >
          <div className="flex items-center gap-1.5">
            <Search size={13} />
            <span>Buscar notas...</span>
          </div>
          <kbd className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-700 text-slate-500">
            Ctrl K
          </kbd>
        </button>
      </div>

      {/* Navigation List */}
      <div className="flex-1 overflow-y-auto px-2 py-3 space-y-4">
        {/* Favorites section */}
        {favorites.length > 0 && (
          <div>
            <div className="px-2 mb-1 text-[11px] font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1">
              <Star size={11} className="text-amber-500" />
              <span>Favoritos</span>
            </div>
            <div className="space-y-0.5">
              {favorites.map((fav) => (
                <div
                  key={`fav-${fav.id}`}
                  onClick={() => onSelectWorkspace(fav.id)}
                  className={`flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-medium cursor-pointer transition ${
                    fav.id === currentWorkspaceId
                      ? 'bg-indigo-50 dark:bg-indigo-950/70 text-indigo-700 dark:text-indigo-300 font-semibold'
                      : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                  }`}
                >
                  <div className="flex items-center gap-1.5 truncate">
                    <span>{fav.icon || '⭐'}</span>
                    <span className="truncate">{fav.title}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Workspaces / Pages list */}
        <div>
          <div className="flex items-center justify-between px-2 mb-1 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
            <span>Páginas & Tableros</span>
            <button
              onClick={() => handleCreateWorkspace(null)}
              className="p-0.5 hover:bg-slate-200 dark:hover:bg-slate-700 rounded text-slate-400 hover:text-indigo-600"
              title="Nueva página raíz"
            >
              <Plus size={13} />
            </button>
          </div>
          <div className="space-y-0.5">
            {rootPages.map((ws) => renderItem(ws, 0))}
          </div>
        </div>
      </div>

      {/* Bottom Footer & Offline/Cloud Status */}
      <div className="p-3 border-t border-slate-200 dark:border-slate-800 bg-slate-100/50 dark:bg-slate-900/50 space-y-2">
        {/* Sync Status Badge */}
        <div
          onClick={onOpenSettings}
          className="flex items-center justify-between p-2 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs cursor-pointer hover:border-indigo-400 transition"
        >
          <div className="flex items-center gap-2">
            {syncStatus.state === 'syncing' ? (
              <RefreshCw size={14} className="text-indigo-500 animate-spin" />
            ) : syncStatus.state === 'synced' ? (
              <Cloud size={14} className="text-emerald-500" />
            ) : syncStatus.state === 'offline' ? (
              <CloudOff size={14} className="text-amber-500" />
            ) : (
              <Cloud size={14} className="text-slate-400" />
            )}
            <div className="flex flex-col">
              <span className="font-medium text-[11px] text-slate-700 dark:text-slate-200">
                {syncStatus.state === 'syncing'
                  ? 'Sincronizando...'
                  : syncStatus.state === 'synced'
                  ? 'Supabase Conectado'
                  : syncStatus.state === 'offline'
                  ? 'Modo 100% Offline'
                  : 'Modo Local (Sin nube)'}
              </span>
              {syncStatus.pendingCount > 0 && (
                <span className="text-[10px] text-amber-600 dark:text-amber-400">
                  {syncStatus.pendingCount} cambio(s) pendientes
                </span>
              )}
            </div>
          </div>
          <span className="text-[10px] text-indigo-600 dark:text-indigo-400 hover:underline">
            Ajustes
          </span>
        </div>

        {/* Papelera / Trash Link */}
        <button
          onClick={onOpenTrash}
          className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs font-medium text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800 transition"
        >
          <Trash2 size={13} />
          <span>Papelera de reciclaje</span>
        </button>
      </div>
    </aside>
  )
}
