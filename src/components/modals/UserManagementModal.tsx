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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 animate-in fade-in duration-150">
      <div
        className="w-full max-w-2xl bg-white dark:bg-[#1a1b1e] border border-black/[0.08] dark:border-white/[0.1] rounded-3xl shadow-2xl overflow-hidden flex flex-col text-neutral-900 dark:text-neutral-100 font-sans max-h-[85vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-3.5 sm:py-4 border-b border-black/[0.06] dark:border-white/[0.08] shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-purple-500/10 text-purple-600 dark:text-purple-400 flex items-center justify-center font-bold shadow-2xs shrink-0">
              <Shield className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-bold">Gestión de Usuarios y Equipo</h2>
                <span className="hidden sm:inline-block text-[10px] px-2 py-0.5 rounded-full font-bold bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20">
                  Panel de Administrador
                </span>
              </div>
              <p className="text-[11px] text-neutral-400">
                {profiles.length} miembros registrados • {invitations.length} invitaciones pendientes
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 hover:bg-black/5 dark:hover:bg-white/10 transition cursor-pointer"
          >
            <CloseIcon style={{ width: 16, height: 16 }} />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-black/[0.06] dark:border-white/[0.08] px-4 sm:px-6 pt-2 bg-black/[0.01] dark:bg-white/[0.01] shrink-0 overflow-x-auto no-scrollbar">
          <button
            type="button"
            onClick={() => setActiveTab('members')}
            className={`pb-2.5 px-3 text-xs font-semibold border-b-2 transition flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
              activeTab === 'members'
                ? 'border-blue-600 text-blue-600 dark:border-blue-400 dark:text-blue-400'
                : 'border-transparent text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            <span>Miembros Activos ({profiles.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('invitations')}
            className={`pb-2.5 px-3 text-xs font-semibold border-b-2 transition flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
              activeTab === 'invitations'
                ? 'border-blue-600 text-blue-600 dark:border-blue-400 dark:text-blue-400'
                : 'border-transparent text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200'
            }`}
          >
            <Mail className="w-3.5 h-3.5" />
            <span>Invitaciones ({invitations.length})</span>
          </button>
        </div>

        {/* Tab Content */}
        <div className="p-3.5 sm:p-6 overflow-y-auto flex-1 custom-scrollbar space-y-4 text-xs">
          {/* Architecture 3 Layers Info Banner */}
          <div className="p-3 rounded-2xl bg-blue-500/[0.06] border border-blue-500/15 text-neutral-600 dark:text-neutral-300 space-y-1.5 text-[11px] leading-relaxed">
            <div className="font-semibold text-blue-600 dark:text-blue-400 flex items-center gap-1.5 text-xs">
              <Shield className="w-3.5 h-3.5" />
              <span>Sistema de Permisos de 3 Capas</span>
            </div>
            <ul className="space-y-1 text-[11px] list-disc list-inside text-neutral-600 dark:text-neutral-400">
              <li><strong className="text-neutral-800 dark:text-neutral-200">Capa 1 (Admins - Kevin, Maikol, Marcos):</strong> Control total del equipo, editan y gestionan todo el contenido compartido. Privacidad personal preservada (nadie ve notas privadas ajenas).</li>
              <li><strong className="text-neutral-800 dark:text-neutral-200">Capa 2 (Trabajadores):</strong> Acceso a todos los espacios de trabajo. Leen todas las notas y tableros. <em>Solo pueden editar lo que ellos mismos creen</em>. Sus cosas privadas no las puede ver nadie más.</li>
              <li><strong className="text-neutral-800 dark:text-neutral-200">Capa 3 (Enlaces Externos):</strong> Invitados web sin registro ni inicio de sesión con lectura exclusiva de la nota compartida.</li>
            </ul>
          </div>

          {/* TAB 1: MEMBERS */}
          {activeTab === 'members' && (
            <div className="space-y-3.5">
              {/* Search & Refresh */}
              <div className="flex items-center gap-2">
                <div className="relative flex-1 flex items-center">
                  <Search className="w-3.5 h-3.5 absolute left-3 text-neutral-400 pointer-events-none" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Buscar por nombre, correo o rol..."
                    className="w-full pl-8 pr-3 py-2 rounded-xl border border-black/10 dark:border-white/10 bg-black/[0.02] dark:bg-white/[0.04] text-xs outline-none focus:border-blue-500 transition"
                  />
                </div>
                <button
                  type="button"
                  onClick={loadData}
                  disabled={loading}
                  className="p-2 rounded-xl border border-black/10 dark:border-white/10 hover:bg-black/5 dark:hover:bg-white/10 transition cursor-pointer"
                  title="Actualizar lista"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
                </button>
              </div>

              {/* Members List */}
              <div className="space-y-2">
                {filteredProfiles.length === 0 ? (
                  <div className="p-8 text-center text-neutral-400">
                    No se encontraron miembros registrados.
                  </div>
                ) : (
                  filteredProfiles.map((p) => {
                    const isSelf = p.id === currentUserId
                    const isSuspended = p.status === 'suspended'

                    return (
                      <div
                        key={p.id}
                        className={`p-3 rounded-2xl border transition flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 sm:gap-3 ${
                          isSuspended
                            ? 'bg-rose-50/50 dark:bg-rose-950/20 border-rose-500/20 opacity-75'
                            : 'bg-black/[0.015] dark:bg-white/[0.025] border-black/[0.05] dark:border-white/[0.07]'
                        }`}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div
                            className="w-8 h-8 rounded-xl flex items-center justify-center text-white font-bold text-xs shrink-0 shadow-2xs"
                            style={{ backgroundColor: p.color || '#2563eb' }}
                          >
                            {p.initial || p.fullName.charAt(0).toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-semibold truncate max-w-[170px]">
                                {p.fullName || 'Sin nombre'}
                              </span>
                              {isSelf && (
                                <span className="text-[9px] px-1.5 py-0.2 rounded-md bg-blue-500/10 text-blue-600 dark:text-blue-400 font-bold">
                                  Tú
                                </span>
                              )}
                              {isSuspended && (
                                <span className="text-[9px] px-1.5 py-0.2 rounded-md bg-rose-500/15 text-rose-600 dark:text-rose-400 font-bold">
                                  Suspendido
                                </span>
                              )}
                            </div>
                            <div className="text-[11px] text-neutral-400 truncate max-w-[200px]">
                              {p.email}
                            </div>
                          </div>
                        </div>

                        {/* Actions: Role Selector and Status Toggle */}
                        <div className="flex items-center justify-end gap-2 shrink-0 pt-1 sm:pt-0 border-t sm:border-t-0 border-black/[0.04] dark:border-white/[0.06]">
                          <select
                            value={p.role}
                            disabled={isSelf}
                            onChange={(e) => handleRoleChange(p.id, e.target.value as UserRole, p.status)}
                            className="text-xs px-2.5 py-1.5 rounded-xl border border-black/10 dark:border-white/10 bg-white dark:bg-[#1a1b1e] outline-none cursor-pointer disabled:opacity-60 flex-1 sm:flex-none"
                          >
                            <option value="admin">Administrador (Capa 1)</option>
                            <option value="member">Trabajador (Capa 2)</option>
                            <option value="viewer">Lector (Solo ver)</option>
                          </select>

                          {!isSelf && (
                            <button
                              type="button"
                              onClick={() => handleToggleStatus(p.id, p.role, p.status)}
                              className={`p-1.5 rounded-xl border transition cursor-pointer shrink-0 ${
                                isSuspended
                                  ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20 hover:bg-emerald-500/20'
                                  : 'bg-rose-500/10 text-rose-600 border-rose-500/20 hover:bg-rose-500/20'
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
                className="p-4 rounded-2xl border border-black/[0.06] dark:border-white/[0.08] bg-black/[0.02] dark:bg-white/[0.02] space-y-3"
              >
                <div className="font-semibold text-xs text-neutral-800 dark:text-neutral-200">
                  Pre-autorizar nuevo correo en el equipo
                </div>
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                  <div className="relative flex-1">
                    <Mail className="w-3.5 h-3.5 absolute left-3 top-3 text-neutral-400 pointer-events-none" />
                    <input
                      type="email"
                      required
                      value={inviteEmail}
                      onChange={(e) => setInviteEmail(e.target.value)}
                      placeholder="nuevo-miembro@equipo.com"
                      className="w-full pl-8 pr-3 py-2 rounded-xl border border-black/10 dark:border-white/10 bg-white dark:bg-[#1a1b1e] text-xs outline-none focus:border-blue-500 transition"
                    />
                  </div>

                  <select
                    value={inviteRole}
                    onChange={(e) => setInviteRole(e.target.value as UserRole)}
                    className="text-xs px-3 py-2 rounded-xl border border-black/10 dark:border-white/10 bg-white dark:bg-[#1a1b1e] outline-none cursor-pointer"
                  >
                    <option value="member">Trabajador (Capa 2)</option>
                    <option value="admin">Administrador (Capa 1)</option>
                    <option value="viewer">Lector (Solo ver)</option>
                  </select>

                  <button
                    type="submit"
                    disabled={inviting}
                    className="py-2 px-3.5 rounded-xl bg-neutral-900 hover:bg-black dark:bg-white dark:hover:bg-neutral-100 text-white dark:text-neutral-900 font-semibold text-xs shadow-sm transition flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
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
                <p className="text-[11px] text-neutral-400">
                  Cuando este correo se registre en Seven Note, se le asignará automáticamente el rol predefinido.
                </p>
              </form>

              {/* Pending Invitations List */}
              <div className="space-y-2">
                <div className="font-semibold text-xs text-neutral-600 dark:text-neutral-400">
                  Correos autorizados pendientes de registro:
                </div>

                {invitations.length === 0 ? (
                  <div className="p-6 text-center text-neutral-400 border border-dashed border-black/10 dark:border-white/10 rounded-2xl">
                    No hay invitaciones pendientes.
                  </div>
                ) : (
                  invitations.map((inv) => (
                    <div
                      key={inv.id}
                      className="p-3 rounded-2xl border border-black/[0.05] dark:border-white/[0.07] bg-black/[0.015] dark:bg-white/[0.025] flex items-center justify-between gap-3"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <Mail className="w-4 h-4 text-blue-500 shrink-0" />
                        <span className="font-mono text-xs truncate">{inv.email}</span>
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 font-medium capitalize">
                          {inv.role}
                        </span>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleDeleteInvitation(inv.id)}
                        className="p-1.5 rounded-xl text-neutral-400 hover:text-rose-600 hover:bg-rose-500/10 transition cursor-pointer"
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
