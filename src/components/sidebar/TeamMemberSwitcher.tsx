import React, { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
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
  variant?: 'full' | 'circular'
  popoverDirection?: 'up' | 'down'
}

export const TeamMemberSwitcher: React.FC<TeamMemberSwitcherProps> = ({
  currentMember,
  privateNotesCount,
  authUser,
  onOpenAuthModal,
  onOpenProfileModal,
  onOpenUserManagementModal,
  onSignOut,
  variant = 'circular'
}) => {
  const [isOpen, setIsOpen] = useState(false)
  const [popoverPos, setPopoverPos] = useState<{ bottom: number; left: number } | null>(null)
  const buttonRef = React.useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!isOpen) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsOpen(false)
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen])

  const handleToggle = () => {
    if (!isOpen && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect()
      setPopoverPos({
        bottom: window.innerHeight - rect.bottom,
        left: rect.right + 10
      })
    }
    setIsOpen(!isOpen)
  }

  const displayName = currentMember.fullName || authUser?.user_metadata?.full_name || currentMember.name
  const displayEmail = currentMember.email || authUser?.email
  const isAdmin = isUserAdmin(currentMember)

  const [imgError, setImgError] = useState(false)

  // Reset img error if user changes
  useEffect(() => {
    setImgError(false)
  }, [displayEmail, currentMember.avatarUrl])

  const effectiveAvatar = !imgError ? (
    currentMember.avatarUrl ||
    authUser?.user_metadata?.avatar_url ||
    authUser?.user_metadata?.picture ||
    authUser?.user_metadata?.avatar ||
    (authUser?.identities && authUser.identities[0]?.identity_data?.avatar_url) ||
    (authUser?.identities && authUser.identities[0]?.identity_data?.picture) ||
    (displayEmail ? `https://unavatar.io/${encodeURIComponent(displayEmail)}?fallback=false` : undefined)
  ) : undefined

  const roleLabel =
    currentMember.role === 'admin'
      ? 'Administrador'
      : currentMember.role === 'viewer'
      ? 'Lector'
      : 'Miembro'

  return (
    <div className="relative">
      {variant === 'circular' ? (
        <button
          ref={buttonRef}
          type="button"
          onClick={handleToggle}
          className="relative w-7 h-7 rounded-full flex items-center justify-center text-white font-bold text-xs shadow-xs hover:scale-105 active:scale-95 transition-all cursor-pointer ring-1 ring-black/10 dark:ring-white/15 overflow-hidden"
          style={{ backgroundColor: currentMember.color || '#2563eb' }}
          title={`Mi Cuenta: ${displayName} (${roleLabel})`}
        >
          {effectiveAvatar ? (
            <img
              src={effectiveAvatar}
              alt={displayName}
              onError={() => setImgError(true)}
              className="w-full h-full rounded-full object-cover"
            />
          ) : (
            <span>{displayName.charAt(0).toUpperCase()}</span>
          )}
          {authUser && (
            <span
              className="w-2 h-2 rounded-full bg-emerald-500 ring-2 ring-white dark:ring-[#161619] absolute -bottom-0.5 -right-0.5"
              title="Sesión activa"
            />
          )}
        </button>
      ) : (
        <button
          ref={buttonRef}
          type="button"
          onClick={handleToggle}
          className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-xl hover:bg-black/[0.04] dark:hover:bg-white/[0.06] border border-black/[0.04] dark:border-white/[0.06] transition text-left group cursor-pointer"
          title="Opciones de cuenta y usuario"
        >
          <div className="flex items-center gap-2 min-w-0">
            <div
              className="w-6 h-6 rounded-lg flex items-center justify-center text-white font-bold text-xs shrink-0 shadow-2xs transition-transform group-hover:scale-105 overflow-hidden"
              style={{ backgroundColor: currentMember.color || '#2563eb' }}
            >
              {effectiveAvatar ? (
                <img
                  src={effectiveAvatar}
                  alt={displayName}
                  onError={() => setImgError(true)}
                  className="w-full h-full object-cover"
                />
              ) : (
                displayName.charAt(0).toUpperCase()
              )}
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
      )}

      {isOpen && typeof document !== 'undefined' && createPortal(
        <>
          <div
            className="fixed inset-0 z-[99990]"
            onClick={() => setIsOpen(false)}
          />
          <div
            className="fixed z-[99999] bg-white dark:bg-[#1e1f23] border border-black/[0.08] dark:border-white/[0.1] rounded-2xl shadow-2xl p-2.5 animate-in fade-in zoom-in-95 duration-100 flex flex-col gap-1.5 sm:gap-2 font-sans text-xs max-h-[min(420px,80vh)] overflow-y-auto custom-scrollbar w-64"
            style={
              variant === 'circular'
                ? {
                    bottom: popoverPos ? `${popoverPos.bottom}px` : '16px',
                    left: popoverPos ? `${popoverPos.left}px` : '52px'
                  }
                : {
                    bottom: popoverPos ? `${popoverPos.bottom}px` : '16px',
                    left: popoverPos ? `${popoverPos.left}px` : '260px'
                  }
            }
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-1">
              <span className="text-[9px] sm:text-[10px] uppercase font-bold text-neutral-400 tracking-wider">
                Mi Cuenta
              </span>
              <span className={`text-[9px] sm:text-[10px] px-1.5 py-0.5 rounded-full font-bold ${
                authUser
                  ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                  : 'bg-black/5 dark:bg-white/10 text-neutral-500'
              }`}>
                {roleLabel}
              </span>
            </div>

            {/* Tarjeta de la cuenta conectada */}
            <div className="p-2 sm:p-2.5 rounded-lg sm:rounded-xl bg-black/[0.03] dark:bg-white/[0.04] border border-black/[0.04] dark:border-white/[0.06] flex items-center gap-2 sm:gap-2.5">
              <div
                className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg sm:rounded-xl flex items-center justify-center text-white font-bold text-xs sm:text-sm shrink-0 shadow-2xs overflow-hidden"
                style={{ backgroundColor: currentMember.color || '#2563eb' }}
              >
                {effectiveAvatar ? (
                  <img
                    src={effectiveAvatar}
                    alt={displayName}
                    onError={() => setImgError(true)}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  displayName.charAt(0).toUpperCase()
                )}
              </div>
              <div className="min-w-0 flex-1 leading-tight">
                <div className="font-semibold text-neutral-900 dark:text-neutral-100 text-xs truncate">
                  {displayName}
                </div>
                {displayEmail && (
                  <div className="text-[10px] sm:text-[11px] text-neutral-400 truncate">
                    {displayEmail}
                  </div>
                )}
              </div>
            </div>

            {/* Acciones de Cuenta */}
            <div className="space-y-0.5 sm:space-y-1 pt-0.5 sm:pt-1">
              {authUser ? (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      setIsOpen(false)
                      onOpenProfileModal?.()
                    }}
                    className="w-full py-1 sm:py-1.5 px-2 sm:px-2.5 rounded-lg sm:rounded-xl hover:bg-black/5 dark:hover:bg-white/10 text-neutral-700 dark:text-neutral-300 text-[11px] sm:text-xs font-medium transition flex items-center gap-2 cursor-pointer"
                  >
                    <User className="w-3.5 h-3.5 text-blue-500 shrink-0" />
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
        </>,
        document.body
      )}
    </div>
  )
}
