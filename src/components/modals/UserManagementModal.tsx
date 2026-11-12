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
import { toast } from 'sonner'

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
    if (isOpen) {
      loadData()
    }
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

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl bg-[var(--app-bg-overlay)] border border-[var(--app-border-strong)] rounded-xl shadow-[var(--app-shadow-popover)] overflow-hidden flex flex-col text-[var(--app-text-primary)] font-sans max-h-[85vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-[var(--app-divider)] shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-8 h-8 rounded-md bg-[var(--app-hover)] text-[var(--app-text-secondary)] flex items-center justify-center shrink-0">
              <Shield className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-semibold truncate">Gestión de Usuarios y Equipo</h2>
                <span className="hidden sm:inline-block text-[10px] px-1.5 py-0.5 rounded font-medium bg-[var(--app-hover)] text-[var(--app-text-secondary)]">
                  Administrador
                </span>
              </div>
              <p className="text-[11px] text-[var(--app-text-muted)]">
                {profiles.length} miembros registrados • {invitations.length} invitaciones pendientes
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-md text-[var(--app-text-secondary)] hover:text-[var(--app-text-primary)] hover:bg-[var(--app-hover)] transition-colors cursor-pointer shrink-0"
          >
            <CloseIcon style={{ width: 16, height: 16 }} />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-[var(--app-divider)] px-5 bg-[var(--app-bg-secondary)] shrink-0 overflow-x-auto no-scrollbar gap-1">
          <button
            type="button"
            onClick={() => setActiveTab('members')}
            className={`py-2.5 px-3 text-xs font-medium border-b-2 transition-colors flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
              activeTab === 'members'
                ? 'border-[var(--app-accent)] text-[var(--app-text-primary)]'
                : 'border-transparent text-[var(--app-text-secondary)] hover:text-[var(--app-text-primary)]'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            <span>Miembros Activos ({profiles.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('invitations')}
            className={`py-2.5 px-3 text-xs font-medium border-b-2 transition-colors flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
              activeTab === 'invitations'
                ? 'border-[var(--app-accent)] text-[var(--app-text-primary)]'
                : 'border-transparent text-[var(--app-text-secondary)] hover:text-[var(--app-text-primary)]'
            }`}
          >
            <Mail className="w-3.5 h-3.5" />
            <span>Invitaciones ({invitations.length})</span>
          </button>
        </div>

        {/* Tab Content */}
        <div className="p-5 overflow-y-auto flex-1 custom-scrollbar space-y-4 text-xs">
          {/* Architecture 3 Layers Info Banner */}
          <div className="p-3 rounded-lg bg-[var(--app-bg-secondary)] border border-[var(--app-border)] text-[var(--app-text-secondary)] space-y-1.5 text-[11px] leading-relaxed">
            <div className="font-semibold text-[var(--app-text-primary)] flex items-center gap-1.5 text-xs">
              <Shield className="w-3.5 h-3.5 text-[var(--app-text-secondary)]" />
              <span>Sistema de Permisos de 3 Capas</span>
            </div>
            <ul className="space-y-1 text-[11px] list-disc list-inside text-[var(--app-text-muted)]">
              <li><strong className="text-[var(--app-text-primary)] font-medium">Capa 1 (Admins):</strong> Control total del equipo, editan y gestionan todo el contenido compartido. Privacidad personal preservada (nadie ve notas privadas ajenas).</li>
              <li><strong className="text-[var(--app-text-primary)] font-medium">Capa 2 (Trabajadores):</strong> Acceso a todos los espacios de trabajo. Leen todas las notas y tableros. <em>Solo pueden editar lo que ellos mismos creen</em>.</li>
              <li><strong className="text-[var(--app-text-primary)] font-medium">Capa 3 (Enlaces Externos):</strong> Invitados web sin registro con lectura exclusiva de la nota compartida.</li>
            </ul>
          </div>

          {/* TAB 1: MEMBERS */}
          {activeTab === 'members' && (
            <div className="space-y-3">
              {/* Search & Refresh */}
              <div className="flex items-center gap-2">
                <div className="relative flex-1 flex items-center">
                  <Search className="w-3.5 h-3.5 absolute left-3 text-[var(--app-text-muted)] pointer-events-none" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Buscar por nombre, correo o rol..."
                    className="w-full pl-8 pr-3 py-1.5 rounded-md border border-[var(--app-border-strong)] bg-[var(--app-bg-primary)] text-[var(--app-text-primary)] placeholder:text-[var(--app-text-muted)] text-xs outline-none focus:border-[var(--app-accent)] transition-colors"
                  />
                </div>
                <button
                  type="button"
                  onClick={loadData}
                  disabled={loading}
                  className="p-1.5 rounded-md border border-[var(--app-border-strong)] bg-[var(--app-bg-secondary)] hover:bg-[var(--app-hover)] text-[var(--app-text-secondary)] hover:text-[var(--app-text-primary)] transition-colors cursor-pointer"
                  title="Actualizar lista"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
                </button>
              </div>

              {/* Members List */}
              <div className="space-y-2">
                {filteredProfiles.length === 0 ? (
                  <div className="p-8 text-center text-[var(--app-text-muted)]">
                    No se encontraron miembros registrados.
                  </div>
                ) : (
                  filteredProfiles.map((p) => {
                    const isSelf = p.id === currentUserId
                    const isSuspended = p.status === 'suspended'

                    return (
                      <div
                        key={p.id}
                        className={`p-2.5 rounded-lg border transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 sm:gap-3 ${
                          isSuspended
                            ? 'bg-rose-500/5 border-rose-500/20 opacity-75'
                            : 'bg-[var(--app-bg-secondary)] border-[var(--app-border)]'
                        }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div
                            className="w-8 h-8 rounded-md flex items-center justify-center text-white font-semibold text-xs shrink-0"
                            style={{ backgroundColor: p.color || '#7c3aed' }}
                          >
                            {p.initial || p.fullName.charAt(0).toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-medium truncate max-w-[170px] text-[var(--app-text-primary)]">
                                {p.fullName || 'Sin nombre'}
                              </span>
                              {isSelf && (
                                <span className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--app-accent-soft)] text-[var(--app-accent)] font-medium">
                                  Tú
                                </span>
                              )}
                              {isSuspended && (
                                <span className="text-[10px] px-1.5 py-0.5 rounded bg-rose-500/15 text-rose-500 font-medium">
                                  Suspendido
                                </span>
                              )}
                            </div>
                            <div className="text-[11px] text-[var(--app-text-muted)] truncate max-w-[200px]">
                              {p.email}
                            </div>
                          </div>
                        </div>

                        {/* Actions: Role Selector and Status Toggle */}
                        <div className="flex items-center justify-end gap-2 shrink-0 pt-1 sm:pt-0 border-t sm:border-t-0 border-[var(--app-divider)]">
                          <select
                            value={p.role}
                            disabled={isSelf}
                            onChange={(e) => handleRoleChange(p.id, e.target.value as UserRole, p.status)}
                            className="text-xs px-2.5 py-1.5 rounded-md border border-[var(--app-border-strong)] bg-[var(--app-bg-primary)] text-[var(--app-text-primary)] outline-none focus:border-[var(--app-accent)] cursor-pointer disabled:opacity-60 flex-1 sm:flex-none"
                          >
                            <option value="admin">Administrador (Capa 1)</option>
                            <option value="member">Trabajador (Capa 2)</option>
                            <option value="viewer">Lector (Solo ver)</option>
                          </select>

                          {!isSelf && (
                            <button
                              type="button"
                              onClick={() => handleToggleStatus(p.id, p.role, p.status)}
                              className={`p-1.5 rounded-md border transition-colors cursor-pointer shrink-0 ${
                                isSuspended
                                  ? 'border-emerald-500/25 bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20'
                                  : 'border-[var(--app-border-strong)] bg-[var(--app-bg-primary)] text-[var(--app-text-muted)] hover:text-rose-500 hover:border-rose-500/25 hover:bg-rose-500/10'
                              }`}
                              title={isSuspended ? 'Reactivar usuario' : 'Suspender usuario'}
                            >
                              {isSuspended ? <UserCheck className="w-3.5 h-3.5" /> : <UserX className="w-3.5 h-3.5" />}
                            </button>
                          )}
                        </div>
                      </div>
                    )
                  })
                )}
              </div>
            </div>
          )}

          {/* TAB 2: INVITATIONS */}
          {activeTab === 'invitations' && (
            <div className="space-y-4">
              {/* Form to Invite / Whitelist Email */}
              <form
                onSubmit={handleCreateInvitation}
                className="p-3.5 rounded-lg border border-[var(--app-border)] bg-[var(--app-bg-secondary)] space-y-2.5"
              >
                <div className="font-medium text-xs text-[var(--app-text-primary)]">
                  Pre-autorizar nuevo correo en el equipo
                </div>
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                  <div className="relative flex-1">
                    <Mail className="w-3.5 h-3.5 absolute left-3 top-2.5 text-[var(--app-text-muted)] pointer-events-none" />
                    <input
                      type="email"
                      required
                      value={inviteEmail}
                      onChange={(e) => setInviteEmail(e.target.value)}
                      placeholder="nuevo-miembro@equipo.com"
                      className="w-full pl-8 pr-3 py-1.5 rounded-md border border-[var(--app-border-strong)] bg-[var(--app-bg-primary)] text-[var(--app-text-primary)] placeholder:text-[var(--app-text-muted)] text-xs outline-none focus:border-[var(--app-accent)] transition-colors"
                    />
                  </div>

                  <select
                    value={inviteRole}
                    onChange={(e) => setInviteRole(e.target.value as UserRole)}
                    className="text-xs px-2.5 py-1.5 rounded-md border border-[var(--app-border-strong)] bg-[var(--app-bg-primary)] text-[var(--app-text-primary)] outline-none focus:border-[var(--app-accent)] cursor-pointer"
                  >
                    <option value="member">Trabajador (Capa 2)</option>
                    <option value="admin">Administrador (Capa 1)</option>
                    <option value="viewer">Lector (Solo ver)</option>
                  </select>

                  <button
                    type="submit"
                    disabled={inviting}
                    className="py-1.5 px-3 rounded-md bg-[var(--app-text-primary)] text-[var(--app-bg-primary)] hover:opacity-90 font-medium text-xs transition-opacity flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
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
                <p className="text-[11px] text-[var(--app-text-muted)]">
                  Cuando este correo se registre en Seven Note, se le asignará automáticamente el rol predefinido.
                </p>
              </form>

              {/* Pending Invitations List */}
              <div className="space-y-2">
                <div className="font-medium text-xs text-[var(--app-text-secondary)]">
                  Correos autorizados pendientes de registro
                </div>

                {invitations.length === 0 ? (
                  <div className="p-6 text-center text-[var(--app-text-muted)] border border-dashed border-[var(--app-border-strong)] rounded-lg">
                    No hay invitaciones pendientes.
                  </div>
                ) : (
                  invitations.map((inv) => (
                    <div
                      key={inv.id}
                      className="p-2.5 rounded-lg border border-[var(--app-border)] bg-[var(--app-bg-secondary)] flex items-center justify-between gap-3"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <Mail className="w-3.5 h-3.5 text-[var(--app-text-secondary)] shrink-0" />
                        <span className="font-mono text-xs truncate text-[var(--app-text-primary)]">{inv.email}</span>
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--app-hover)] text-[var(--app-text-secondary)] font-medium capitalize">
                          {inv.role}
                        </span>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleDeleteInvitation(inv.id)}
                        className="p-1.5 rounded-md text-[var(--app-text-muted)] hover:text-rose-500 hover:bg-rose-500/10 transition-colors cursor-pointer"
                        title="Revocar autorización"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
