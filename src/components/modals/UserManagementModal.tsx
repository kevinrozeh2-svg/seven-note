import React, { useState, useEffect } from 'react'
import { CloseIcon } from '@blocksuite/icons/rc'
import {
  Users,
  UserCheck,
  UserX,
  Mail,
  Shield,
  Plus,
  Trash2,
  RefreshCw,
  Search
} from 'lucide-react'
import {
  fetchAllProfiles,
  updateMemberRoleAndStatus,
  fetchInvitations,
  createInvitation,
  deleteInvitation,
  type TeamInvitation
} from '../../lib/supabase'
import { type UserProfile, type UserRole, type UserStatus } from '../../lib/teamAuth'
import { UserAvatar } from '../ui/UserAvatar'
import { subscribeToTeamProfiles, refreshTeamProfiles } from '../../lib/teamProfiles'
import { toast } from '../../lib/toast'

interface UserManagementModalProps {
  isOpen: boolean
  onClose: () => void
  currentUserId?: string
}

export const UserManagementModal: React.FC<UserManagementModalProps> = ({
  isOpen,
  onClose,
  currentUserId
}) => {
  const [activeTab, setActiveTab] = useState<'members' | 'invitations'>('members')
  const [profiles, setProfiles] = useState<UserProfile[]>([])
  const [invitations, setInvitations] = useState<TeamInvitation[]>([])
  const [loading, setLoading] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [showPermissionsInfo, setShowPermissionsInfo] = useState(false)

  useEffect(() => {
    if (!isOpen) return
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [isOpen, onClose])

  // Invite form state
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState<UserRole>('member')
  const [inviting, setInviting] = useState(false)

  const loadData = async () => {
    setLoading(true)
    try {
      const [allProfiles, allInvitations] = await Promise.all([
        fetchAllProfiles(),
        fetchInvitations()
      ])
      setProfiles(allProfiles)
      setInvitations(allInvitations)
    } catch (e) {
      console.error('Error loading team data:', e)
      toast.error('Error al cargar la información del equipo')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!isOpen) return
    loadData()
    void refreshTeamProfiles(true)
    return subscribeToTeamProfiles((next) => {
      if (next.length > 0) setProfiles(next)
    })
  }, [isOpen])

  if (!isOpen) return null

  const handleRoleChange = async (userId: string, newRole: UserRole, currentStatus: UserStatus) => {
    try {
      const res = await updateMemberRoleAndStatus(userId, newRole, currentStatus)
      if (!res.success) throw new Error(res.error)

      setProfiles((prev) =>
        prev.map((p) => (p.id === userId ? { ...p, role: newRole } : p))
      )
      toast.success('Rol de usuario actualizado')
    } catch (err: any) {
      console.error('Error updating role:', err)
      toast.error(err?.message || 'No fue posible cambiar el rol')
    }
  }

  const handleToggleStatus = async (userId: string, currentRole: UserRole, currentStatus: UserStatus) => {
    if (userId === currentUserId) {
      toast.error('No puedes suspender tu propia cuenta de administrador.')
      return
    }

    const nextStatus: UserStatus = currentStatus === 'active' ? 'suspended' : 'active'
    try {
      const res = await updateMemberRoleAndStatus(userId, currentRole, nextStatus)
      if (!res.success) throw new Error(res.error)

      setProfiles((prev) =>
        prev.map((p) => (p.id === userId ? { ...p, status: nextStatus } : p))
      )
      toast.success(
        nextStatus === 'active' ? 'Usuario reactivado con éxito' : 'Usuario suspendido correctamente'
      )
    } catch (err: any) {
      console.error('Error toggling status:', err)
      toast.error(err?.message || 'No fue posible actualizar el estado')
    }
  }

  const handleCreateInvitation = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!inviteEmail.trim()) {
      toast.error('Ingresa un correo electrónico.')
      return
    }

    setInviting(true)
    try {
      const res = await createInvitation(inviteEmail.trim(), inviteRole)
      if (!res.success) throw new Error(res.error)

      toast.success(`Invitación creada para ${inviteEmail}`)
      setInviteEmail('')
      const updated = await fetchInvitations()
      setInvitations(updated)
    } catch (err: any) {
      console.error('Error inviting:', err)
      toast.error(err?.message || 'Error al crear la invitación')
    } finally {
      setInviting(false)
    }
  }

  const handleDeleteInvitation = async (id: string) => {
    try {
      const res = await deleteInvitation(id)
      if (!res.success) throw new Error(res.error)

      setInvitations((prev) => prev.filter((i) => i.id !== id))
      toast.info('Invitación eliminada')
    } catch (err: any) {
      toast.error(err?.message || 'Error al eliminar invitación')
    }
  }

  const filteredProfiles = profiles.filter((p) => {
    const q = searchQuery.toLowerCase().trim()
    if (!q) return true
    return (
      p.fullName.toLowerCase().includes(q) ||
      (p.email || '').toLowerCase().includes(q) ||
      p.role.toLowerCase().includes(q)
    )
  })

  const formatRoleBadge = (role: string) => {
    if (role === 'admin') return 'Admin'
    if (role === 'viewer') return 'Lector'
    return 'Trabajador'
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 backdrop-blur-xs p-2 sm:p-5 animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Gestión de Usuarios y Equipo"
        className="w-full max-w-4xl h-[86vh] sm:h-[78vh] max-h-[660px] bg-[var(--app-bg-primary)] border border-[var(--app-border-strong)] rounded-xl shadow-[var(--app-shadow-popover)] overflow-hidden flex flex-col md:flex-row text-[var(--app-text-primary)] font-sans"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Left Navigation Sidebar */}
        <aside className="md:w-56 shrink-0 bg-[var(--app-bg-secondary)] border-b md:border-b-0 md:border-r border-[var(--app-border)] flex flex-col">
          <div className="px-4 py-3.5 flex items-center justify-between border-b border-[var(--app-divider)]">
            <div className="flex items-center gap-2 min-w-0">
              <Shield className="w-4 h-4 text-[var(--app-text-secondary)] shrink-0" />
              <h2 className="text-[13px] font-semibold truncate">Equipo</h2>
            </div>
            <button
              type="button"
              aria-label="Cerrar gestión de usuarios"
              onClick={onClose}
              className="md:hidden w-8 h-8 rounded-md flex items-center justify-center text-[var(--app-text-secondary)] hover:text-[var(--app-text-primary)] hover:bg-[var(--app-hover)] transition-colors cursor-pointer shrink-0"
            >
              <CloseIcon style={{ width: 16, height: 16 }} />
            </button>
          </div>

          <nav
            aria-label="Secciones de equipo"
            className="flex md:flex-col gap-1 p-2 overflow-x-auto md:overflow-y-auto no-scrollbar flex-1"
          >
            <button
              type="button"
              aria-current={activeTab === 'members' ? 'page' : undefined}
              onClick={() => setActiveTab('members')}
              className={`flex items-center justify-between gap-2 px-3 py-2 rounded-md text-xs font-medium whitespace-nowrap transition cursor-pointer shrink-0 ${
                activeTab === 'members'
                  ? 'bg-[var(--app-active)] text-[var(--app-text-primary)] font-semibold'
                  : 'text-[var(--app-text-secondary)] hover:text-[var(--app-text-primary)] hover:bg-[var(--app-hover)]'
              }`}
            >
              <span className="flex items-center gap-2">
                <Users className="w-4 h-4 shrink-0" />
                <span>Miembros</span>
              </span>
              <span className="text-[11px] font-mono text-[var(--app-text-muted)]">{profiles.length}</span>
            </button>

            <button
              type="button"
              aria-current={activeTab === 'invitations' ? 'page' : undefined}
              onClick={() => setActiveTab('invitations')}
              className={`flex items-center justify-between gap-2 px-3 py-2 rounded-md text-xs font-medium whitespace-nowrap transition cursor-pointer shrink-0 ${
                activeTab === 'invitations'
                  ? 'bg-[var(--app-active)] text-[var(--app-text-primary)] font-semibold'
                  : 'text-[var(--app-text-secondary)] hover:text-[var(--app-text-primary)] hover:bg-[var(--app-hover)]'
              }`}
            >
              <span className="flex items-center gap-2">
                <Mail className="w-4 h-4 shrink-0" />
                <span>Invitaciones</span>
              </span>
              <span className="text-[11px] font-mono text-[var(--app-text-muted)]">{invitations.length}</span>
            </button>
          </nav>

          <div className="hidden md:block px-4 py-3 border-t border-[var(--app-divider)] text-[11px] text-[var(--app-text-muted)]">
            <span className="font-medium text-[var(--app-text-secondary)]">Rol:</span> Administrador
          </div>
        </aside>

        {/* Right Content Pane */}
        <div className="flex-1 flex flex-col min-w-0 min-h-0">
          {/* Desktop Pane Header */}
          <div className="hidden md:flex items-center justify-between px-6 py-3.5 border-b border-[var(--app-divider)] shrink-0">
            <div>
              <h3 className="text-sm font-semibold text-[var(--app-text-primary)]">
                {activeTab === 'members' ? 'Miembros activos' : 'Invitaciones y pre-autorización'}
              </h3>
              <p className="text-xs text-[var(--app-text-muted)] mt-0.5">
                {activeTab === 'members'
                  ? `${profiles.length} miembros registrados en el espacio de trabajo.`
                  : `${invitations.length} correos pre-autorizados pendientes de registro.`}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setShowPermissionsInfo((v) => !v)}
                aria-expanded={showPermissionsInfo}
                className="h-8 px-2.5 rounded-md border border-[var(--app-border)] bg-[var(--app-bg-secondary)] hover:bg-[var(--app-hover)] text-xs font-medium text-[var(--app-text-secondary)] hover:text-[var(--app-text-primary)] transition cursor-pointer flex items-center gap-1.5"
              >
                <Shield className="w-3.5 h-3.5" />
                <span>Permisos</span>
              </button>
              <button
                type="button"
                aria-label="Cerrar gestión de usuarios"
                onClick={onClose}
                className="w-8 h-8 rounded-md flex items-center justify-center text-[var(--app-text-secondary)] hover:text-[var(--app-text-primary)] hover:bg-[var(--app-hover)] transition-colors cursor-pointer"
                title="Cerrar (Esc)"
              >
                <CloseIcon style={{ width: 16, height: 16 }} />
              </button>
            </div>
          </div>

          {/* Scrollable Body */}
          <div className="p-4 sm:p-6 overflow-y-auto flex-1 custom-scrollbar space-y-4 text-xs">
            {/* Collapsible 3 Layers Info Banner */}
            {showPermissionsInfo && (
              <div className="p-3.5 rounded-lg bg-[var(--app-bg-secondary)] border border-[var(--app-border)] text-[var(--app-text-secondary)] space-y-1.5 text-xs leading-relaxed">
                <div className="font-semibold text-[var(--app-text-primary)] flex items-center gap-1.5">
                  <Shield className="w-3.5 h-3.5 text-[var(--app-text-secondary)]" />
                  <span>Sistema de Permisos de 3 Capas</span>
                </div>
                <ul className="space-y-1 text-[11px] list-disc list-inside text-[var(--app-text-muted)]">
                  <li><strong className="text-[var(--app-text-primary)] font-medium">Capa 1 (Admins):</strong> Control total del contenido compartido. Las notas privadas ajenas siempre quedan ocultas.</li>
                  <li><strong className="text-[var(--app-text-primary)] font-medium">Capa 2 (Trabajadores):</strong> Leen todas las notas compartidas y solo editan las que ellos mismos crean.</li>
                  <li><strong className="text-[var(--app-text-primary)] font-medium">Capa 3 (Enlaces externos):</strong> Invitados web sin registro con lectura exclusiva de la nota compartida.</li>
                </ul>
              </div>
            )}

            {/* TAB 1: MEMBERS */}
            {activeTab === 'members' && (
              <div className="space-y-3">
                {/* Search & Refresh */}
                <div className="flex items-center gap-2">
                  <div className="relative flex-1 flex items-center">
                    <Search className="w-4 h-4 absolute left-3 text-[var(--app-text-muted)] pointer-events-none" />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Buscar por nombre, correo o rol..."
                      aria-label="Buscar miembros"
                      className="w-full h-9 pl-9 pr-3 rounded-md border border-[var(--app-border-strong)] bg-[var(--app-bg-secondary)] text-[var(--app-text-primary)] placeholder:text-[var(--app-text-muted)] text-xs outline-none focus:border-[var(--app-accent)] transition-colors"
                    />
                  </div>
                  <button
                    type="button"
                    aria-label="Actualizar lista de miembros"
                    onClick={loadData}
                    disabled={loading}
                    className="w-9 h-9 rounded-md border border-[var(--app-border-strong)] bg-[var(--app-bg-secondary)] hover:bg-[var(--app-hover)] text-[var(--app-text-secondary)] hover:text-[var(--app-text-primary)] flex items-center justify-center transition-colors cursor-pointer shrink-0"
                    title="Actualizar lista"
                  >
                    <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                  </button>
                </div>

                {/* Members List (Unified hairline divider container) */}
                {filteredProfiles.length === 0 ? (
                  <div className="p-10 text-center text-[var(--app-text-muted)] rounded-lg border border-dashed border-[var(--app-border-strong)]">
                    No se encontraron miembros registrados.
                  </div>
                ) : (
                  <div className="rounded-lg border border-[var(--app-border)] bg-[var(--app-bg-secondary)] divide-y divide-[var(--app-divider)] overflow-hidden">
                    {filteredProfiles.map((p) => {
                      const isSelf = p.id === currentUserId
                      const isSuspended = p.status === 'suspended'

                      return (
                        <div
                          key={p.id}
                          className={`px-3.5 py-3 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                            isSuspended ? 'bg-rose-500/5 opacity-75' : 'hover:bg-[var(--app-hover)]/50'
                          }`}
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <UserAvatar
                              name={p.fullName || p.email || 'Usuario'}
                              avatarUrl={p.avatarUrl}
                              color={p.color || '#7c3aed'}
                              size="md"
                              shape="rounded"
                              className="w-9 h-9"
                            />
                            <div className="min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="font-semibold text-[13px] truncate max-w-[180px] text-[var(--app-text-primary)]">
                                  {p.fullName || 'Sin nombre'}
                                </span>
                                {isSelf && (
                                  <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-[var(--app-bg-primary)] border border-[var(--app-border-strong)] text-[var(--app-text-secondary)] font-medium">
                                    Tú
                                  </span>
                                )}
                                {isSuspended && (
                                  <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-rose-500/15 text-rose-500 font-medium">
                                    Suspendido
                                  </span>
                                )}
                              </div>
                              <div className="text-xs text-[var(--app-text-muted)] truncate max-w-[220px]">
                                {p.email}
                              </div>
                            </div>
                          </div>

                          {/* Actions: Role Selector and Status Toggle */}
                          <div className="flex items-center justify-end gap-2 shrink-0">
                            <select
                              aria-label={`Rol de ${p.fullName || p.email}`}
                              value={p.role}
                              disabled={isSelf}
                              onChange={(e) => handleRoleChange(p.id, e.target.value as UserRole, p.status)}
                              className="h-8 text-xs px-2.5 rounded-md border border-[var(--app-border-strong)] bg-[var(--app-bg-primary)] text-[var(--app-text-primary)] outline-none focus:border-[var(--app-accent)] cursor-pointer disabled:opacity-55 flex-1 sm:flex-none"
                            >
                              <option value="admin">Administrador (Capa 1)</option>
                              <option value="member">Trabajador (Capa 2)</option>
                              <option value="viewer">Lector (Solo ver)</option>
                            </select>

                            {!isSelf && (
                              <button
                                type="button"
                                aria-label={isSuspended ? 'Reactivar usuario' : 'Suspender usuario'}
                                onClick={() => handleToggleStatus(p.id, p.role, p.status)}
                                className={`w-8 h-8 rounded-md border flex items-center justify-center transition-colors cursor-pointer shrink-0 ${
                                  isSuspended
                                    ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20'
                                    : 'border-[var(--app-border-strong)] bg-[var(--app-bg-primary)] text-[var(--app-text-muted)] hover:text-rose-500 hover:border-rose-500/30 hover:bg-rose-500/10'
                                }`}
                                title={isSuspended ? 'Reactivar usuario' : 'Suspender usuario'}
                              >
                                {isSuspended ? <UserCheck className="w-4 h-4" /> : <UserX className="w-4 h-4" />}
                              </button>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )}

            {/* TAB 2: INVITATIONS */}
            {activeTab === 'invitations' && (
              <div className="space-y-4">
                {/* Form to Invite / Whitelist Email */}
                <form
                  onSubmit={handleCreateInvitation}
                  className="p-4 rounded-lg border border-[var(--app-border)] bg-[var(--app-bg-secondary)] space-y-3"
                >
                  <div>
                    <div className="font-semibold text-[13px] text-[var(--app-text-primary)]">
                      Pre-autorizar nuevo correo
                    </div>
                    <p className="text-xs text-[var(--app-text-muted)] mt-0.5">
                      Al registrarse con este correo, recibirá automáticamente el rol elegido.
                    </p>
                  </div>
                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                    <div className="relative flex-1">
                      <Mail className="w-4 h-4 absolute left-3 top-2.5 text-[var(--app-text-muted)] pointer-events-none" />
                      <input
                        type="email"
                        required
                        value={inviteEmail}
                        onChange={(e) => setInviteEmail(e.target.value)}
                        placeholder="nuevo-miembro@equipo.com"
                        aria-label="Correo a pre-autorizar"
                        className="w-full h-9 pl-9 pr-3 rounded-md border border-[var(--app-border-strong)] bg-[var(--app-bg-primary)] text-[var(--app-text-primary)] placeholder:text-[var(--app-text-muted)] text-xs outline-none focus:border-[var(--app-accent)] transition-colors"
                      />
                    </div>

                    <select
                      aria-label="Rol para invitación"
                      value={inviteRole}
                      onChange={(e) => setInviteRole(e.target.value as UserRole)}
                      className="h-9 text-xs px-2.5 rounded-md border border-[var(--app-border-strong)] bg-[var(--app-bg-primary)] text-[var(--app-text-primary)] outline-none focus:border-[var(--app-accent)] cursor-pointer"
                    >
                      <option value="member">Trabajador (Capa 2)</option>
                      <option value="admin">Administrador (Capa 1)</option>
                      <option value="viewer">Lector (Solo ver)</option>
                    </select>

                    <button
                      type="submit"
                      disabled={inviting}
                      className="h-9 px-4 rounded-md bg-[var(--app-accent)] hover:bg-[var(--app-accent-hover)] text-white font-semibold text-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50 shrink-0"
                    >
                      {inviting ? (
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <>
                          <Plus className="w-3.5 h-3.5" />
                          <span>Pre-autorizar</span>
                        </>
                      )}
                    </button>
                  </div>
                </form>

                {/* Pending Invitations List */}
                <div className="space-y-2">
                  <div className="font-medium text-xs text-[var(--app-text-secondary)]">
                    Correos autorizados pendientes ({invitations.length})
                  </div>

                  {invitations.length === 0 ? (
                    <div className="p-8 text-center text-[var(--app-text-muted)] border border-dashed border-[var(--app-border-strong)] rounded-lg">
                      No hay invitaciones pendientes.
                    </div>
                  ) : (
                    <div className="rounded-lg border border-[var(--app-border)] bg-[var(--app-bg-secondary)] divide-y divide-[var(--app-divider)] overflow-hidden">
                      {invitations.map((inv) => (
                        <div
                          key={inv.id}
                          className="px-3.5 py-2.5 flex items-center justify-between gap-3 hover:bg-[var(--app-hover)]/50 transition-colors"
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <Mail className="w-4 h-4 text-[var(--app-text-muted)] shrink-0" />
                            <span className="font-mono text-xs truncate text-[var(--app-text-primary)]">{inv.email}</span>
                            <span className="text-[10px] px-2 py-0.5 rounded-md bg-[var(--app-bg-primary)] border border-[var(--app-border)] text-[var(--app-text-secondary)] font-medium shrink-0">
                              {formatRoleBadge(inv.role)}
                            </span>
                          </div>

                          <button
                            type="button"
                            aria-label={`Revocar invitación de ${inv.email}`}
                            onClick={() => handleDeleteInvitation(inv.id)}
                            className="w-8 h-8 rounded-md flex items-center justify-center text-[var(--app-text-muted)] hover:text-rose-500 hover:bg-rose-500/10 transition-colors cursor-pointer shrink-0"
                            title="Revocar autorización"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
