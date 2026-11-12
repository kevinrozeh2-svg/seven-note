import {
  FileText,
  MagnifyingGlass,
  Graph,
  Plus,
  Gear,
  Trash,
  Books,
  DownloadSimple,
  Keyboard,
  SidebarSimple,
  Sun,
  Moon,
  CloudCheck,
  CloudSlash,
  ArrowsClockwise
} from '@phosphor-icons/react'
import { type SyncEngineStatus } from '../../lib/syncEngine'
import { TeamMemberSwitcher } from './TeamMemberSwitcher'
import { type TeamMember } from '../../lib/teamAuth'

export interface ObsidianRibbonProps {
  sidebarOpen: boolean
  onToggleSidebar: () => void
  onNewNote: () => void
  onOpenSearch: () => void
  onOpenKnowledgeGraph: () => void
  onOpenAllDocs: () => void
  onOpenTemplates: () => void
  onOpenImport: () => void
  onOpenShortcuts: () => void
  onOpenTrash: () => void
  onOpenSettings: () => void
  activeView?: string

  // Status & User Profile in Ribbon footer
  syncStatus?: SyncEngineStatus
  darkMode?: boolean
  onToggleDarkMode?: () => void
  currentMember?: TeamMember
  onSelectMember?: (id: string) => void
  privateNotesCount?: number
  authUser?: any
  onOpenAuthModal?: () => void
  onOpenProfileModal?: () => void
  onOpenUserManagementModal?: () => void
  onSignOut?: () => void
}

export function ObsidianRibbon({
  sidebarOpen,
  onToggleSidebar,
  onNewNote,
  onOpenSearch,
  onOpenKnowledgeGraph,
  onOpenAllDocs,
  onOpenTemplates,
  onOpenImport,
  onOpenShortcuts,
  onOpenTrash,
  onOpenSettings,
  activeView,
  syncStatus,
  darkMode,
  onToggleDarkMode,
  currentMember,
  onSelectMember,
  privateNotesCount = 0,
  authUser,
  onOpenAuthModal,
  onOpenProfileModal,
  onOpenUserManagementModal,
  onSignOut
}: ObsidianRibbonProps) {
  return (
    <nav
      aria-label="Barra de acciones rápidas (Ribbon)"
      className="w-11 h-full bg-[#141414] dark:bg-[#141414] light:bg-[#f3f3f3] border-r border-white/[0.06] dark:border-white/[0.06] flex flex-col items-center justify-between gap-2 pt-[max(0.5rem,env(safe-area-inset-top))] pb-[max(0.5rem,env(safe-area-inset-bottom))] overflow-y-auto overflow-x-hidden [scrollbar-width:none] [&::-webkit-scrollbar]:hidden shrink-0 select-none z-30"
      style={{
        backgroundColor: 'var(--obsidian-ribbon-bg, #141414)'
      }}
    >
      {/* Top tools list */}
      <div className="flex flex-col items-center gap-1 w-full px-1">
        {/* Brand App Icon (Original Kevin/Seven Note Logo) */}
        <div
          className="w-9 h-9 rounded-lg flex items-center justify-center p-0.5 mb-1.5 transition cursor-pointer hover:scale-105"
          title="Seven Note"
        >
          <img
            src="/app-logo-light.png"
            alt="Seven Note Logo"
            className="w-full h-full object-contain dark:hidden"
          />
          <img
            src="/app-logo-dark.png"
            alt="Seven Note Logo"
            className="w-full h-full object-contain hidden dark:block"
          />
        </div>

        {/* Toggle File Explorer / Sidebar */}
        <button
          onClick={onToggleSidebar}
          className={`w-8 h-8 rounded-md flex items-center justify-center transition cursor-pointer ${
            sidebarOpen
              ? 'text-[var(--app-text-primary)] bg-white/10'
              : 'text-[var(--app-text-muted)] hover:text-[var(--app-text-primary)] hover:bg-white/5'
          }`}
          title={sidebarOpen ? 'Ocultar explorador de archivos' : 'Mostrar explorador de archivos (Ctrl+\\)'}
        >
          <SidebarSimple size={18} weight={sidebarOpen ? 'fill' : 'regular'} />
        </button>

        {/* Quick Search */}
        <button
          onClick={onOpenSearch}
          className="w-8 h-8 rounded-md flex items-center justify-center text-[var(--app-text-muted)] hover:text-[var(--app-text-primary)] hover:bg-white/5 transition cursor-pointer"
          title="Búsqueda rápida en notas (Ctrl+K)"
        >
          <MagnifyingGlass size={18} />
        </button>

        {/* New Note Button */}
        <button
          onClick={onNewNote}
          className="w-8 h-8 rounded-md flex items-center justify-center text-[var(--app-text-muted)] hover:text-purple-400 hover:bg-purple-500/10 transition cursor-pointer"
          title="Crear nueva nota (Ctrl+N)"
        >
          <Plus size={18} weight="bold" />
        </button>

        <div className="w-5 h-px bg-white/[0.08] my-1" />

        {/* Knowledge Graph View */}
        <button
          onClick={onOpenKnowledgeGraph}
          className={`w-8 h-8 rounded-md flex items-center justify-center transition cursor-pointer ${
            activeView === 'knowledge-graph'
              ? 'text-purple-400 bg-purple-500/15'
              : 'text-[var(--app-text-muted)] hover:text-[var(--app-text-primary)] hover:bg-white/5'
          }`}
          title="Abrir vista gráfica"
        >
          <Graph size={18} />
        </button>

        {/* All Documents */}
        <button
          onClick={onOpenAllDocs}
          className={`w-8 h-8 rounded-md flex items-center justify-center transition cursor-pointer ${
            activeView === 'all-docs'
              ? 'text-purple-400 bg-purple-500/15'
              : 'text-[var(--app-text-muted)] hover:text-[var(--app-text-primary)] hover:bg-white/5'
          }`}
          title="Todos los documentos"
        >
          <FileText size={18} />
        </button>

        {/* Plantillas */}
        <button
          onClick={onOpenTemplates}
          className={`w-8 h-8 rounded-md flex items-center justify-center transition cursor-pointer ${
            activeView === 'templates'
              ? 'text-purple-400 bg-purple-500/15'
              : 'text-[var(--app-text-muted)] hover:text-[var(--app-text-primary)] hover:bg-white/5'
          }`}
          title="Plantillas de notas"
        >
          <Books size={18} />
        </button>

        {/* Importar / Exportar */}
        <button
          onClick={onOpenImport}
          className="w-8 h-8 rounded-md flex items-center justify-center text-[var(--app-text-muted)] hover:text-[var(--app-text-primary)] hover:bg-white/5 transition cursor-pointer"
          title="Importar / Exportar notas y archivos"
        >
          <DownloadSimple size={18} />
        </button>

        {/* Atajos de teclado */}
        <button
          onClick={onOpenShortcuts}
          className="w-8 h-8 rounded-md flex items-center justify-center text-[var(--app-text-muted)] hover:text-[var(--app-text-primary)] hover:bg-white/5 transition cursor-pointer"
          title="Atajos de teclado (?)"
        >
          <Keyboard size={18} />
        </button>
      </div>

      {/* Bottom tools: Sync status, Theme, User Avatar, Trash, Settings */}
      <div className="flex flex-col items-center gap-1.5 w-full px-1">
        {/* Sync Status Icon Button */}
        {syncStatus && (
          <div
            className="w-8 h-8 rounded-md flex items-center justify-center cursor-default transition"
            title={
              syncStatus.state === 'syncing'
                ? 'Sincronizando notas...'
                : syncStatus.state === 'error'
                ? 'Error de sincronización'
                : syncStatus.state === 'offline'
                ? 'Modo sin conexión'
                : 'Sincronizado'
            }
          >
            {syncStatus.state === 'syncing' ? (
              <ArrowsClockwise size={16} weight="duotone" className="text-blue-400 animate-spin" />
            ) : syncStatus.state === 'error' ? (
              <CloudSlash size={16} weight="duotone" className="text-rose-400" />
            ) : syncStatus.state === 'offline' ? (
              <CloudSlash size={16} weight="duotone" className="text-amber-400" />
            ) : (
              <CloudCheck size={16} weight="duotone" className="text-emerald-400" />
            )}
          </div>
        )}

        {/* Dark / Light Mode Toggle */}
        {onToggleDarkMode && (
          <button
            onClick={onToggleDarkMode}
            className="w-8 h-8 rounded-md flex items-center justify-center text-[var(--app-text-muted)] hover:text-[var(--app-text-primary)] hover:bg-white/5 transition cursor-pointer"
            title={darkMode ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
          >
            {darkMode ? <Sun size={17} weight="duotone" /> : <Moon size={17} weight="duotone" />}
          </button>
        )}

        {/* Team Member / User Profile Switcher */}
        {currentMember && (
          <div className="py-0.5">
            <TeamMemberSwitcher
              variant="circular"
              popoverDirection="up"
              currentMember={currentMember}
              onSelectMember={(id) => onSelectMember && onSelectMember(id)}
              privateNotesCount={privateNotesCount}
              authUser={authUser}
              onOpenAuthModal={onOpenAuthModal}
              onOpenProfileModal={onOpenProfileModal}
              onOpenUserManagementModal={onOpenUserManagementModal}
              onSignOut={onSignOut}
            />
          </div>
        )}

        {/* Papelera */}
        <button
          onClick={onOpenTrash}
          className={`w-8 h-8 rounded-md flex items-center justify-center transition cursor-pointer ${
            activeView === 'trash'
              ? 'text-rose-400 bg-rose-500/15'
              : 'text-[var(--app-text-muted)] hover:text-rose-400 hover:bg-rose-500/10'
          }`}
          title="Papelera"
        >
          <Trash size={17} />
        </button>

        {/* Ajustes */}
        <button
          onClick={onOpenSettings}
          className="w-8 h-8 rounded-md flex items-center justify-center text-[var(--app-text-muted)] hover:text-[var(--app-text-primary)] hover:bg-white/5 transition cursor-pointer"
          title="Ajustes y opciones"
        >
          <Gear size={18} />
        </button>
      </div>
    </nav>
  )
}
