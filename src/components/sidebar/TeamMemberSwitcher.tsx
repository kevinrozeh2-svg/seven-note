import React, { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { ChevronDown, Shield, LogOut, Key, User, Users, Lock } from 'lucide-react'
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
          className="relative w-7 h-7 rounded-full flex items-center justify-center font-semibold text-xs transition-colors cursor-pointer bg-black/[0.06] dark:bg-white/[0.08] hover:bg-black/[0.1] dark:hover:bg-white/[0.14] text-[var(--app-text-primary)] border border-black/[0.08] dark:border-white/[0.12] overflow-hidden"
          title={`Mi Cuenta: ${displayName} (${roleLabel})`}
        >
          {effectiveAvatar ? (
            <img
              src={effectiveAvatar}
              alt={displayName}
              onError={() => setImgError(true)}
              className="w-full h-full object-cover"
            />
          ) : (
            <span>{displayName.charAt(0).toUpperCase()}</span>
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
            className="fixed z-[99999] bg-[var(--app-bg-overlay)] border border-[var(--app-border-strong)] rounded-xl shadow-[var(--app-shadow-popover)] p-1.5 animate-in fade-in zoom-in-95 duration-100 flex flex-col gap-1 font-sans text-xs max-h-[min(420px,80vh)] overflow-y-auto custom-scrollbar w-60 text-[var(--app-text-primary)]"
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
            {/* Account Header */}
            <div className="px-2 py-2 flex items-center gap-2.5 border-b border-[var(--app-divider)]">
              <div
                className="w-8 h-8 rounded-lg flex items-center justify-center text-white font-semibold text-xs shrink-0 overflow-hidden"
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
                <div className="flex items-center justify-between gap-1.5">
                  <span className="font-semibold text-[var(--app-text-primary)] text-xs truncate">
                    {displayName}
                  </span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded font-medium bg-[var(--app-hover)] text-[var(--app-text-secondary)] shrink-0">
                    {roleLabel}
                  </span>
                </div>
                {displayEmail && (
                  <div className="text-[11px] text-[var(--app-text-muted)] truncate mt-0.5">
                    {displayEmail}
                  </div>
                )}
              </div>
            </div>

            {/* Acciones de Cuenta */}
            <div className="space-y-0.5 py-0.5">
              {authUser ? (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      setIsOpen(false)
                      onOpenProfileModal?.()
                    }}
                    className="w-full py-1.5 px-2 rounded-md hover:bg-[var(--app-hover)] text-[var(--app-text-primary)] text-xs font-medium transition-colors flex items-center gap-2.5 cursor-pointer"
                  >
                    <User className="w-3.5 h-3.5 text-[var(--app-text-secondary)] shrink-0" />
                    <span>Mi Perfil y Seguridad</span>
                  </button>

                  {isAdmin && (
                    <button
                      type="button"
                      onClick={() => {
                        setIsOpen(false)
                        onOpenUserManagementModal?.()
                      }}
                      className="w-full py-1.5 px-2 rounded-md hover:bg-[var(--app-hover)] text-[var(--app-text-primary)] text-xs font-medium transition-colors flex items-center gap-2.5 cursor-pointer"
                    >
                      <Users className="w-3.5 h-3.5 text-[var(--app-text-secondary)] shrink-0" />
                      <span>Gestión de Usuarios</span>
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => {
                      setIsOpen(false)
                      onSignOut?.()
                    }}
                    className="w-full py-1.5 px-2 rounded-md hover:bg-rose-500/10 text-rose-500 dark:text-rose-400 text-xs font-medium transition-colors flex items-center gap-2.5 cursor-pointer"
                  >
                    <LogOut className="w-3.5 h-3.5 shrink-0" />
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
                  className="w-full py-1.5 px-2.5 rounded-md bg-[var(--app-text-primary)] text-[var(--app-bg-primary)] hover:opacity-90 text-xs font-medium transition flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Key className="w-3.5 h-3.5" />
                  <span>Iniciar Sesión / Registrarse</span>
                </button>
              )}
            </div>

            <div className="px-2 py-1.5 text-[11px] text-[var(--app-text-muted)] leading-snug border-t border-[var(--app-divider)] flex items-start gap-1.5">
              <Lock className="w-3 h-3 shrink-0 mt-0.5 text-[var(--app-text-muted)]" />
              <span>Tus notas privadas solo son visibles para ti.</span>
            </div>
          </div>
        </>,
        document.body
      )}
    </div>
  )
}
