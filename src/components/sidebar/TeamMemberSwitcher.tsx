import React, { useState, useEffect } from 'react'
import { ChevronDown, Shield, LogOut, Key, User, Users } from 'lucide-react'
import { type TeamMember, isUserAdmin } from '../../lib/teamAuth'

interface TeamMemberSwitcherProps {
  currentMember: TeamMember
  onSelectMember?: (memberId: string) => void
  privateNotesCount: number
  authUser?: any
  onOpenAuthModal?: () => void
  onOpenProfileModal?: () => void
  onOpenUserManagementModal?: () => void
  onSignOut?: () => void
}

export const TeamMemberSwitcher: React.FC<TeamMemberSwitcherProps> = ({
  currentMember,
  privateNotesCount,
  authUser,
  onOpenAuthModal,
  onOpenProfileModal,
  onOpenUserManagementModal,
  onSignOut
}) => {
  const [isOpen, setIsOpen] = useState(false)

  useEffect(() => {
    if (!isOpen) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsOpen(false)
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen])

  const displayName = currentMember.fullName || authUser?.user_metadata?.full_name || currentMember.name
  const displayEmail = currentMember.email || authUser?.email
  const isAdmin = isUserAdmin(currentMember)

  const roleLabel =
    currentMember.role === 'admin'
      ? 'Administrador'
      : currentMember.role === 'viewer'
      ? 'Lector'
      : 'Miembro'

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-xl hover:bg-black/[0.04] dark:hover:bg-white/[0.06] border border-black/[0.04] dark:border-white/[0.06] transition text-left group cursor-pointer"
        title="Opciones de cuenta y usuario"
      >
        <div className="flex items-center gap-2 min-w-0">
          <div
            className="w-6 h-6 rounded-lg flex items-center justify-center text-white font-bold text-xs shrink-0 shadow-2xs transition-transform group-hover:scale-105"
            style={{ backgroundColor: currentMember.color || '#2563eb' }}
          >
            {displayName.charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0 flex-1 leading-tight">
            <div className="flex items-center gap-1.5">
              <span className="font-semibold text-neutral-900 dark:text-neutral-100 text-xs truncate">
                {displayName}
              </span>
              {authUser && (
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" title="Sesión activa" />
              )}
            </div>
            <div className="text-[10px] text-neutral-400 dark:text-neutral-500 flex items-center gap-1">
              <Shield className="w-2.5 h-2.5 text-blue-500 shrink-0" />
              <span>{roleLabel}</span>
              <span className="text-[9px] text-neutral-400 truncate max-w-[85px]">
                • {privateNotesCount} priv.
              </span>
            </div>
          </div>
        </div>

        <ChevronDown className="w-3.5 h-3.5 text-neutral-400 group-hover:text-neutral-700 dark:group-hover:text-neutral-200 transition shrink-0" />
      </button>

      {isOpen && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setIsOpen(false)}
          />
          <div
            className="absolute left-0 right-0 top-12 z-50 w-full min-w-[220px] bg-white dark:bg-[#1e1f23] border border-black/[0.08] dark:border-white/[0.1] rounded-2xl shadow-2xl p-2.5 animate-in fade-in zoom-in-95 duration-100 flex flex-col gap-2 font-sans text-xs"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-1">
              <span className="text-[10px] uppercase font-bold text-neutral-400 tracking-wider">
                Mi Cuenta
              </span>
              <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${
                authUser
                  ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                  : 'bg-black/5 dark:bg-white/10 text-neutral-500'
              }`}>
                {roleLabel}
              </span>
            </div>

            {/* Tarjeta de la cuenta conectada */}
            <div className="p-2.5 rounded-xl bg-black/[0.03] dark:bg-white/[0.04] border border-black/[0.04] dark:border-white/[0.06] flex items-center gap-2.5">
              <div
                className="w-8 h-8 rounded-xl flex items-center justify-center text-white font-bold text-sm shrink-0 shadow-2xs"
                style={{ backgroundColor: currentMember.color || '#2563eb' }}
              >
                {displayName.charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0 flex-1 leading-tight">
                <div className="font-semibold text-neutral-900 dark:text-neutral-100 text-xs truncate">
                  {displayName}
                </div>
                {displayEmail && (
                  <div className="text-[11px] text-neutral-400 truncate">
                    {displayEmail}
                  </div>
                )}
              </div>
            </div>

            {/* Acciones de Cuenta */}
            <div className="space-y-1 pt-1">
              {authUser ? (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      setIsOpen(false)
                      onOpenProfileModal?.()
                    }}
                    className="w-full py-1.5 px-2.5 rounded-xl hover:bg-black/5 dark:hover:bg-white/10 text-neutral-700 dark:text-neutral-300 text-xs font-medium transition flex items-center gap-2 cursor-pointer"
                  >
                    <User className="w-3.5 h-3.5 text-blue-500" />
                    <span>Mi Perfil &amp; Seguridad</span>
                  </button>

                  {isAdmin && (
                    <button
                      type="button"
                      onClick={() => {
                        setIsOpen(false)
                        onOpenUserManagementModal?.()
                      }}
                      className="w-full py-1.5 px-2.5 rounded-xl hover:bg-black/5 dark:hover:bg-white/10 text-neutral-700 dark:text-neutral-300 text-xs font-medium transition flex items-center gap-2 cursor-pointer"
                    >
                      <Users className="w-3.5 h-3.5 text-purple-500" />
                      <span>Gestión de Usuarios</span>
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => {
                      setIsOpen(false)
                      onSignOut?.()
                    }}
                    className="w-full py-1.5 px-2.5 rounded-xl hover:bg-rose-50 dark:hover:bg-rose-950/30 text-rose-600 dark:text-rose-400 text-xs font-medium transition flex items-center gap-2 cursor-pointer"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    <span>Cerrar Sesión</span>
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setIsOpen(false)
                    onOpenAuthModal?.()
                  }}
                  className="w-full py-2 px-3 rounded-xl bg-blue-50 dark:bg-blue-950/40 hover:bg-blue-100 dark:hover:bg-blue-900/40 text-blue-600 dark:text-blue-400 text-xs font-semibold border border-blue-500/20 transition flex items-center justify-center gap-2 cursor-pointer active:scale-98"
                >
                  <Key className="w-3.5 h-3.5" />
                  <span>Iniciar Sesión / Registrarse</span>
                </button>
              )}
            </div>

            <div className="px-1 text-[10px] text-neutral-400 dark:text-neutral-500 leading-normal border-t border-black/[0.04] dark:border-white/[0.06] pt-1.5">
              🔒 Privacidad activa: Tus notas privadas solo son visibles para ti.
            </div>
          </div>
        </>
      )}
    </div>
  )
}
