import {
  FileText,
  MagnifyingGlass,
  Graph,
  Plus,
  Gear,
  Trash,
  Books,
  SidebarSimple,
  Sun,
  Moon,
  CloudCheck,
  CloudSlash,
  ArrowsClockwise,
  Bell,
  BellSlash,
  CalendarBlank
} from '@phosphor-icons/react'
import { type SyncEngineStatus } from '../../lib/syncEngine'
import { TeamMemberSwitcher } from './TeamMemberSwitcher'
import { type TeamMember } from '../../lib/teamAuth'

export interface ObsidianRibbonProps {
  sidebarOpen: boolean
  onToggleSidebar: () => void
  onNewNote: () => void
  onOpenSearch: () => void
  onOpenCalendar?: () => void
  calendarSidebarActive?: boolean
  onOpenKnowledgeGraph: () => void
  onOpenAllDocs: () => void
  onOpenTemplates: () => void
  onOpenImport: () => void
  onOpenShortcuts: () => void
  onOpenTrash: () => void
  onOpenSettings: () => void
  onToggleNotifications?: () => void
  notificationsOpen?: boolean
  unreadNotificationsCount?: number
  notificationsDnd?: boolean
  activeView?: string

  // Status & User Profile in Ribbon footer
  syncStatus?: SyncEngineStatus
  onForceSync?: () => void
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
  onOpenCalendar,
  calendarSidebarActive: _calendarSidebarActive = false,
  onOpenKnowledgeGraph,
  onOpenAllDocs,
  onOpenTemplates,
  onOpenImport: _onOpenImport,
  onOpenShortcuts: _onOpenShortcuts,
  onOpenTrash,
  onOpenSettings,
  onToggleNotifications,
  notificationsOpen = false,
  unreadNotificationsCount = 0,
  notificationsDnd = false,
  activeView,
  syncStatus,
  onForceSync,
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
      aria-label="Navegación principal"
      className="w-12 h-full bg-[var(--obsidian-ribbon-bg)] border-r border-[var(--app-border)] flex flex-col items-center justify-between gap-2 pt-[max(0.5rem,env(safe-area-inset-top))] pb-[max(0.5rem,env(safe-area-inset-bottom))] overflow-y-auto overflow-x-hidden [scrollbar-width:none] [&::-webkit-scrollbar]:hidden shrink-0 select-none z-30"
    >
      {/* Top tools list */}
      <div className="flex flex-col items-center gap-1.5 w-full px-1">
        {/* Brand App Icon (Navigates to All Notes) */}
        <button
          type="button"
          onClick={onOpenAllDocs}
          aria-label="Seven Note — Todas las notas"
          className="w-10 h-10 rounded-md flex items-center justify-center p-0.5 mb-1 transition cursor-pointer hover:bg-[var(--app-hover)]"
          title="Seven Note — Todas las notas"
        >
          <img
            src="/app-logo-light.png"
            alt=""
            className="w-full h-full object-contain dark:hidden"
          />
          <img
            src="/app-logo-dark.png"
            alt=""
            className="w-full h-full object-contain hidden dark:block"
          />
        </button>

        {/* Toggle File Explorer / Sidebar */}
        <button
          type="button"
          onClick={onToggleSidebar}
          aria-label={sidebarOpen ? 'Ocultar explorador lateral' : 'Mostrar explorador lateral'}
          aria-pressed={sidebarOpen}
          className={`w-9 h-9 rounded-md flex items-center justify-center transition cursor-pointer ${
            sidebarOpen
              ? 'text-[var(--app-text-primary)] bg-[var(--app-active)]'
              : 'text-[var(--app-text-muted)] hover:text-[var(--app-text-primary)] hover:bg-[var(--app-hover)]'
          }`}
          title={sidebarOpen ? 'Ocultar explorador (Ctrl+\\)' : 'Mostrar explorador (Ctrl+\\)'}
        >
          <SidebarSimple size={20} weight={sidebarOpen ? 'fill' : 'regular'} />
        </button>

        {/* Quick Search */}
        <button
          type="button"
          onClick={onOpenSearch}
          aria-label="Búsqueda rápida"
          className="w-9 h-9 rounded-md flex items-center justify-center text-[var(--app-text-muted)] hover:text-[var(--app-text-primary)] hover:bg-[var(--app-hover)] transition cursor-pointer"
          title="Búsqueda rápida (Ctrl+K)"
        >
          <MagnifyingGlass size={20} />
        </button>

        {/* New Note Button */}
        <button
          type="button"
          onClick={onNewNote}
          aria-label="Crear nueva nota"
          className="w-9 h-9 rounded-md flex items-center justify-center text-[var(--app-text-secondary)] hover:text-[var(--app-text-primary)] hover:bg-[var(--app-hover)] transition cursor-pointer"
          title="Crear nueva nota (Ctrl+N)"
        >
          <Plus size={20} weight="bold" />
        </button>

        <div className="w-6 h-px bg-[var(--app-divider)] my-1" />

        {/* Calendario */}
        {onOpenCalendar && (
          <button
            type="button"
            onClick={onOpenCalendar}
            aria-label="Calendario"
            aria-current={activeView === 'calendar' ? 'page' : undefined}
            className={`w-9 h-9 rounded-md flex items-center justify-center transition cursor-pointer ${
              activeView === 'calendar'
                ? 'text-[var(--app-text-primary)] bg-[var(--app-active)]'
                : 'text-[var(--app-text-muted)] hover:text-[var(--app-text-primary)] hover:bg-[var(--app-hover)]'
            }`}
            title="Calendario"
          >
            <CalendarBlank size={20} />
          </button>
        )}

        {/* Knowledge Graph View */}
        <button
          type="button"
          onClick={onOpenKnowledgeGraph}
          aria-label="Grafo de conocimiento"
          aria-current={activeView === 'knowledge-graph' ? 'page' : undefined}
          className={`w-9 h-9 rounded-md flex items-center justify-center transition cursor-pointer ${
            activeView === 'knowledge-graph'
              ? 'text-[var(--app-text-primary)] bg-[var(--app-active)]'
              : 'text-[var(--app-text-muted)] hover:text-[var(--app-text-primary)] hover:bg-[var(--app-hover)]'
          }`}
          title="Grafo de conocimiento"
        >
          <Graph size={20} />
        </button>

        {/* All Documents */}
        <button
          type="button"
          onClick={onOpenAllDocs}
          aria-label="Todas las notas"
          aria-current={activeView === 'all-docs' ? 'page' : undefined}
          className={`w-9 h-9 rounded-md flex items-center justify-center transition cursor-pointer ${
            activeView === 'all-docs'
              ? 'text-[var(--app-text-primary)] bg-[var(--app-active)]'
              : 'text-[var(--app-text-muted)] hover:text-[var(--app-text-primary)] hover:bg-[var(--app-hover)]'
          }`}
          title="Todas las notas"
        >
          <FileText size={20} />
        </button>

        {/* Plantillas */}
        <button
          type="button"
          onClick={onOpenTemplates}
          aria-label="Plantillas"
          aria-current={activeView === 'templates' ? 'page' : undefined}
          className={`w-9 h-9 rounded-md flex items-center justify-center transition cursor-pointer ${
            activeView === 'templates'
              ? 'text-[var(--app-text-primary)] bg-[var(--app-active)]'
              : 'text-[var(--app-text-muted)] hover:text-[var(--app-text-primary)] hover:bg-[var(--app-hover)]'
          }`}
          title="Plantillas"
        >
          <Books size={20} />
        </button>
      </div>

      {/* Bottom tools: Notifications, Sync status, Theme, User Avatar, Trash, Settings */}
      <div className="flex flex-col items-center gap-1.5 w-full px-1">
        {/* Centro de Notificaciones */}
        {onToggleNotifications && (
          <button
            type="button"
            onClick={onToggleNotifications}
            aria-label={
              notificationsDnd
                ? 'Notificaciones (No Molestar activo)'
                : unreadNotificationsCount > 0
                ? `Notificaciones (${unreadNotificationsCount} sin leer)`
                : 'Notificaciones'
            }
            aria-expanded={notificationsOpen}
            aria-controls="seven-notification-center"
            className={`relative w-9 h-9 rounded-md flex items-center justify-center transition cursor-pointer ${
              notificationsOpen
                ? 'text-[var(--app-text-primary)] bg-[var(--app-active)]'
                : notificationsDnd
                ? 'text-amber-500 hover:bg-[var(--app-hover)]'
                : 'text-[var(--app-text-muted)] hover:text-[var(--app-text-primary)] hover:bg-[var(--app-hover)]'
            }`}
            title={
              notificationsDnd
                ? 'Notificaciones (No Molestar activo · Ctrl+Shift+N)'
                : unreadNotificationsCount > 0
                ? `Notificaciones (${unreadNotificationsCount} sin leer · Ctrl+Shift+N)`
                : 'Notificaciones (Ctrl+Shift+N)'
            }
          >
            {notificationsDnd ? (
              <BellSlash size={19} weight={notificationsOpen ? 'fill' : 'regular'} />
            ) : (
              <Bell size={19} weight={notificationsOpen ? 'fill' : 'regular'} />
            )}
            {notificationsDnd ? (
              <span
                className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-amber-400 ring-2 ring-[var(--obsidian-ribbon-bg)]"
                aria-hidden="true"
              />
            ) : (
              unreadNotificationsCount > 0 && (
                <span className="absolute top-0.5 right-0.5 min-w-[16px] h-[16px] px-1 rounded-full bg-[var(--app-accent)] text-white text-[10px] font-bold tabular-nums flex items-center justify-center leading-none shadow-sm">
                  {unreadNotificationsCount > 99 ? '99+' : unreadNotificationsCount}
                </span>
              )
            )}
          </button>
        )}

        {/* Sync Status Icon (Tappable to force full sync) */}
        {syncStatus && (
          <button
            type="button"
            onClick={onForceSync}
            aria-label={
              syncStatus.state === 'syncing'
                ? 'Sincronizando notas'
                : syncStatus.state === 'error'
                ? 'Error de sincronización, pulsar para reintentar'
                : syncStatus.state === 'offline'
                ? 'Modo sin conexión'
                : 'Sincronizado, pulsar para resincronizar'
            }
            className="relative w-9 h-9 rounded-md flex items-center justify-center text-[var(--app-text-muted)] hover:text-[var(--app-text-primary)] hover:bg-[var(--app-hover)] cursor-pointer transition active:scale-95"
            title={
              syncStatus.state === 'syncing'
                ? 'Sincronizando notas...'
                : syncStatus.state === 'error'
                ? 'Error de sincronización (pulsa para reintentar)'
                : syncStatus.state === 'offline'
                ? 'Modo sin conexión'
                : 'Sincronizado (pulsa para resincronizar)'
            }
          >
            {syncStatus.state === 'syncing' ? (
              <ArrowsClockwise size={19} className="animate-spin text-[var(--app-accent)]" />
            ) : syncStatus.state === 'error' || syncStatus.state === 'offline' ? (
              <CloudSlash size={19} className="text-amber-500" />
            ) : (
              <CloudCheck size={19} />
            )}
            {syncStatus.pendingCount > 0 && (
              <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-amber-400" />
            )}
          </button>
        )}

        {/* Dark / Light Mode Toggle */}
        {onToggleDarkMode && (
          <button
            type="button"
            onClick={onToggleDarkMode}
            aria-label={darkMode ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
            className="w-9 h-9 rounded-md flex items-center justify-center text-[var(--app-text-muted)] hover:text-[var(--app-text-primary)] hover:bg-[var(--app-hover)] transition cursor-pointer"
            title={darkMode ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
          >
            {darkMode ? <Sun size={19} /> : <Moon size={19} />}
          </button>
        )}

        {/* Team Member / User Profile Switcher */}
        {currentMember && (
          <div className="w-9 h-9 flex items-center justify-center">
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
          type="button"
          onClick={onOpenTrash}
          aria-label="Papelera"
          aria-current={activeView === 'trash' ? 'page' : undefined}
          className={`w-9 h-9 rounded-md flex items-center justify-center transition cursor-pointer ${
            activeView === 'trash'
              ? 'text-rose-500 bg-rose-500/15'
              : 'text-[var(--app-text-muted)] hover:text-rose-500 hover:bg-rose-500/10'
          }`}
          title="Papelera"
        >
          <Trash size={19} />
        </button>

        {/* Ajustes */}
        <button
          type="button"
          onClick={onOpenSettings}
          aria-label="Ajustes"
          className="w-9 h-9 rounded-md flex items-center justify-center text-[var(--app-text-muted)] hover:text-[var(--app-text-primary)] hover:bg-[var(--app-hover)] transition cursor-pointer"
          title="Ajustes"
        >
          <Gear size={19} />
        </button>
      </div>
    </nav>
  )
}
