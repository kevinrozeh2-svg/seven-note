import React, { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { ChevronDown, ChevronRight, Shield, LogOut, Key, User, Users, Lock } from 'lucide-react'
import { type TeamMember, isUserAdmin } from '../../lib/teamAuth'
import { UserAvatar } from '../ui/UserAvatar'

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

  // Respetar el avatar guardado en currentMember (evitando sobrescribir con unavatar.io o metadatos antiguos)
  const effectiveAvatar =
    currentMember.avatarUrl && !/^https?:\/\/unavatar\.io\//i.test(currentMember.avatarUrl)
      ? currentMember.avatarUrl
      : undefined

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
          className="relative rounded-full flex items-center justify-center transition-transform hover:scale-105 cursor-pointer"
          title={`Mi Cuenta: ${displayName} (${roleLabel})`}
        >
          <UserAvatar
            name={displayName}
            avatarUrl={effectiveAvatar}
            color={currentMember.color}
            size="md"
            shape="circle"
          />
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
            <UserAvatar
              name={displayName}
              avatarUrl={effectiveAvatar}
              color={currentMember.color}
              size="sm"
              shape="rounded"
              className="shadow-2xs transition-transform group-hover:scale-105"
            />
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
            role="menu"
            aria-label="Opciones de cuenta"
            className="fixed z-[99999] bg-[var(--app-bg-overlay)] border border-[var(--app-border-strong)] rounded-xl shadow-[var(--app-shadow-popover)] p-2.5 animate-in fade-in zoom-in-95 duration-100 flex flex-col gap-2 font-sans text-xs max-h-[min(460px,82vh)] overflow-y-auto custom-scrollbar w-72 text-[var(--app-text-primary)]"
            style={
              variant === 'circular'
                ? {
                    bottom: popoverPos ? `${popoverPos.bottom}px` : '16px',
                    left: popoverPos ? `${popoverPos.left}px` : '56px'
                  }
                : {
                    bottom: popoverPos ? `${popoverPos.bottom}px` : '16px',
                    left: popoverPos ? `${popoverPos.left}px` : '260px'
                  }
            }
            onClick={(e) => e.stopPropagation()}
          >
            {/* Account Identity Card */}
            <div className="p-2.5 rounded-lg bg-[var(--app-bg-secondary)] border border-[var(--app-border)] flex items-center gap-3">
              <div className="relative shrink-0">
                <UserAvatar
                  name={displayName}
                  avatarUrl={effectiveAvatar}
                  color={currentMember.color}
                  size="md"
                  shape="rounded"
                  className="w-10 h-10"
                />
                {authUser && (
                  <span
                    className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-500 ring-2 ring-[var(--app-bg-secondary)]"
                    title="Sesión activa"
                  />
                )}
              </div>
              <div className="min-w-0 flex-1 leading-tight">
                <div className="flex items-center justify-between gap-1.5">
                  <span className="font-semibold text-[var(--app-text-primary)] text-[13px] truncate">
                    {displayName}
                  </span>
                  <span className="text-[10px] px-2 py-0.5 rounded-md font-medium bg-[var(--app-bg-primary)] border border-[var(--app-border)] text-[var(--app-text-secondary)] shrink-0">
                    {roleLabel}
                  </span>
                </div>
                {displayEmail && (
                  <div className="text-[11px] text-[var(--app-text-muted)] truncate mt-1">
                    {displayEmail}
                  </div>
                )}
              </div>
            </div>

            {/* Acciones de Cuenta */}
            <div className="space-y-1">
              {authUser ? (
                <>
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setIsOpen(false)
                      onOpenProfileModal?.()
                    }}
                    className="group w-full px-2 py-2 rounded-lg hover:bg-[var(--app-hover)] text-left transition-colors flex items-center gap-2.5 cursor-pointer"
                  >
                    <span className="w-8 h-8 rounded-md bg-[var(--app-bg-secondary)] border border-[var(--app-border)] flex items-center justify-center text-[var(--app-text-secondary)] group-hover:text-[var(--app-text-primary)] shrink-0 transition-colors">
                      <User className="w-4 h-4" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="text-xs font-semibold text-[var(--app-text-primary)] truncate">
                        Mi Perfil y Seguridad
                      </div>
                      <div className="text-[11px] text-[var(--app-text-muted)] truncate">
                        Avatar, nombre y contraseña
                      </div>
                    </div>
                    <ChevronRight className="w-3.5 h-3.5 text-[var(--app-text-muted)] group-hover:text-[var(--app-text-primary)] shrink-0 transition-colors" />
                  </button>

                  {isAdmin && (
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        setIsOpen(false)
                        onOpenUserManagementModal?.()
                      }}
                      className="group w-full px-2 py-2 rounded-lg hover:bg-[var(--app-hover)] text-left transition-colors flex items-center gap-2.5 cursor-pointer"
                    >
                      <span className="w-8 h-8 rounded-md bg-[var(--app-bg-secondary)] border border-[var(--app-border)] flex items-center justify-center text-[var(--app-text-secondary)] group-hover:text-[var(--app-text-primary)] shrink-0 transition-colors">
                        <Users className="w-4 h-4" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="text-xs font-semibold text-[var(--app-text-primary)] truncate">
                          Gestión de Usuarios
                        </div>
                        <div className="text-[11px] text-[var(--app-text-muted)] truncate">
                          Miembros, roles e invitaciones
                        </div>
                      </div>
                      <ChevronRight className="w-3.5 h-3.5 text-[var(--app-text-muted)] group-hover:text-[var(--app-text-primary)] shrink-0 transition-colors" />
                    </button>
                  )}

                  <div className="my-1 border-t border-[var(--app-divider)]" />

                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setIsOpen(false)
                      onSignOut?.()
                    }}
                    className="w-full h-9 px-2.5 rounded-lg hover:bg-rose-500/10 text-rose-500 dark:text-rose-400 text-xs font-semibold transition-colors flex items-center gap-2.5 cursor-pointer"
                  >
                    <LogOut className="w-4 h-4 shrink-0" />
                    <span>Cerrar sesión</span>
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setIsOpen(false)
                    onOpenAuthModal?.()
                  }}
                  className="w-full h-9 px-3 rounded-lg bg-[var(--app-accent)] hover:bg-[var(--app-accent-hover)] text-white text-xs font-semibold transition flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Key className="w-3.5 h-3.5" />
                  <span>Iniciar Sesión / Registrarse</span>
                </button>
              )}
            </div>

            <div className="px-2.5 py-2 rounded-lg bg-[var(--app-bg-secondary)]/70 border border-[var(--app-border)] text-[11px] text-[var(--app-text-muted)] leading-snug flex items-center gap-2">
              <Lock className="w-3.5 h-3.5 shrink-0 text-[var(--app-text-muted)]" />
              <span>Tus notas privadas solo son visibles para ti.</span>
            </div>
          </div>
        </>,
        document.body
      )}
    </div>
  )
}
