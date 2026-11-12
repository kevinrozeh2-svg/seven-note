import React, { useState, useEffect, useRef } from 'react'
import { CloseIcon } from '@blocksuite/icons/rc'
import {
  User,
  Shield,
  Key,
  Copy,
  Check,
  LogOut,
  RefreshCw,
  Palette,
  AlertCircle,
  CheckCircle2,
  Upload,
  X
} from 'lucide-react'
import {
  updateUserProfile,
  updateUserPassword,
  signOutUser,
  getAuthUser
} from '../../lib/supabase'
import {
  setCurrentMember,
  type TeamMember
} from '../../lib/teamAuth'
import { PRESET_AVATARS, resizeAvatarFile } from '../../lib/avatars'
import { clearLocalUserData } from '../../db'
import { toast } from 'sonner'

interface UserProfileModalProps {
  isOpen: boolean
  onClose: () => void
  currentMember: TeamMember
  onProfileUpdated?: (updated: TeamMember) => void
  onSignOut?: () => void
}

const PRESET_COLORS = [
  '#2563eb', // Blue
  '#10b981', // Emerald
  '#8b5cf6', // Purple
  '#f59e0b', // Amber
  '#ef4444', // Red
  '#06b6d4', // Cyan
  '#ec4899', // Pink
  '#64748b'  // Slate
]

export const UserProfileModal: React.FC<UserProfileModalProps> = ({
  isOpen,
  onClose,
  currentMember,
  onProfileUpdated,
  onSignOut
}) => {
  const [activeTab, setActiveTab] = useState<'profile' | 'security'>('profile')
  const [fullName, setFullName] = useState('')
  const [color, setColor] = useState('#2563eb')
  const [avatarUrl, setAvatarUrl] = useState<string>('')
  const [savingProfile, setSavingProfile] = useState(false)
  const avatarInputRef = useRef<HTMLInputElement>(null)

  // Password change state
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [savingPassword, setSavingPassword] = useState(false)
  const [passwordError, setPasswordError] = useState<string | null>(null)
  const [passwordSuccess, setPasswordSuccess] = useState<string | null>(null)

  const [copiedId, setCopiedId] = useState(false)
  const [clearCacheOnLogout, setClearCacheOnLogout] = useState(true)

  useEffect(() => {
    if (isOpen) {
      setFullName(currentMember.fullName || currentMember.name || '')
      setColor(currentMember.color || '#2563eb')
      setAvatarUrl(currentMember.avatarUrl || '')
      setNewPassword('')
      setConfirmPassword('')
      setPasswordError(null)
      setPasswordSuccess(null)
    }
  }, [isOpen, currentMember])

  if (!isOpen) return null

  const handleAvatarFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      const dataUrl = await resizeAvatarFile(file)
      setAvatarUrl(dataUrl)
    } catch {
      toast.error('No se pudo procesar la imagen seleccionada.')
    } finally {
      e.target.value = ''
    }
  }

  const handleCopyUserId = async () => {
    if (currentMember.id) {
      await navigator.clipboard.writeText(currentMember.id)
      setCopiedId(true)
      setTimeout(() => setCopiedId(false), 2000)
    }
  }

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!fullName.trim()) {
      toast.error('El nombre no puede estar vacío.')
      return
    }

    setSavingProfile(true)
    try {
      const user = await getAuthUser()
      if (user?.id) {
        const res = await updateUserProfile(user.id, {
          fullName: fullName.trim(),
          color: color,
          avatarUrl: avatarUrl
        })
        if (!res.success) throw new Error(res.error)
      }

      const updated: TeamMember = {
        ...currentMember,
        name: fullName.trim(),
        fullName: fullName.trim(),
        color: color,
        avatarUrl: avatarUrl || undefined,
        initial: fullName.trim().charAt(0).toUpperCase()
      }

      setCurrentMember(updated)
      onProfileUpdated?.(updated)
      toast.success('¡Perfil actualizado con éxito!')
      onClose()
    } catch (err: any) {
      console.error('Error saving profile:', err)
      toast.error(err?.message || 'Error al guardar los cambios.')
    } finally {
      setSavingProfile(false)
    }
  }

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault()
    setPasswordError(null)
    setPasswordSuccess(null)

    if (newPassword.length < 8) {
      setPasswordError('La contraseña debe tener al menos 8 caracteres.')
      return
    }

    if (newPassword !== confirmPassword) {
      setPasswordError('Las contraseñas no coinciden.')
      return
    }

    setSavingPassword(true)
    try {
      const { error } = await updateUserPassword(newPassword)
      if (error) throw error
      setPasswordSuccess('¡Tu contraseña ha sido actualizada correctamente!')
      setNewPassword('')
      setConfirmPassword('')
      toast.success('Contraseña cambiada exitosamente.')
    } catch (err: any) {
      console.error('Error updating password:', err)
      setPasswordError(err?.message || 'Error al actualizar la contraseña.')
    } finally {
      setSavingPassword(false)
    }
  }

  const handleLogout = async () => {
    if (confirm('¿Estás seguro de que deseas cerrar sesión?')) {
      if (clearCacheOnLogout) {
        await clearLocalUserData()
      }
      await signOutUser()
      onSignOut?.()
      onClose()
      toast.info('Sesión cerrada correctamente')
      window.location.reload()
    }
  }

  const roleLabel =
    currentMember.role === 'admin'
      ? 'Administrador'
      : currentMember.role === 'viewer'
      ? 'Lector'
      : 'Miembro'

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg bg-[var(--app-bg-overlay)] border border-[var(--app-border-strong)] rounded-xl shadow-[var(--app-shadow-popover)] overflow-hidden flex flex-col text-[var(--app-text-primary)] font-sans"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-[var(--app-divider)]">
          <div className="flex items-center gap-3 min-w-0">
            <div
              className="w-9 h-9 rounded-lg flex items-center justify-center text-white font-semibold text-sm shrink-0 overflow-hidden"
              style={{ backgroundColor: avatarUrl ? 'transparent' : color }}
            >
              {avatarUrl ? (
                <img src={avatarUrl} alt={fullName || currentMember.name} className="w-full h-full object-cover" />
              ) : (
                (fullName || currentMember.name || 'U').charAt(0).toUpperCase()
              )}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-semibold truncate max-w-[160px] sm:max-w-[200px]">
                  {fullName || currentMember.name}
                </h2>
                <span className="text-[10px] px-1.5 py-0.5 rounded font-medium bg-[var(--app-hover)] text-[var(--app-text-secondary)]">
                  {roleLabel}
                </span>
              </div>
              <p className="text-[11px] text-[var(--app-text-muted)] truncate max-w-[200px] sm:max-w-[250px]">
                {currentMember.email || 'Sin correo asociado'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-md text-[var(--app-text-secondary)] hover:text-[var(--app-text-primary)] hover:bg-[var(--app-hover)] transition-colors cursor-pointer"
          >
            <CloseIcon style={{ width: 16, height: 16 }} />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="flex border-b border-[var(--app-divider)] px-5 bg-[var(--app-bg-secondary)] overflow-x-auto no-scrollbar gap-1">
          <button
            type="button"
            onClick={() => setActiveTab('profile')}
            className={`py-2.5 px-3 text-xs font-medium border-b-2 transition-colors flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
              activeTab === 'profile'
                ? 'border-[var(--app-accent)] text-[var(--app-text-primary)]'
                : 'border-transparent text-[var(--app-text-secondary)] hover:text-[var(--app-text-primary)]'
            }`}
          >
            <User className="w-3.5 h-3.5" />
            <span>Perfil y Apariencia</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('security')}
            className={`py-2.5 px-3 text-xs font-medium border-b-2 transition-colors flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
              activeTab === 'security'
                ? 'border-[var(--app-accent)] text-[var(--app-text-primary)]'
                : 'border-transparent text-[var(--app-text-secondary)] hover:text-[var(--app-text-primary)]'
            }`}
          >
            <Shield className="w-3.5 h-3.5" />
            <span>Seguridad y Sesión</span>
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-5 text-xs overflow-y-auto max-h-[75vh] custom-scrollbar">
          {activeTab === 'profile' && (
            <form onSubmit={handleSaveProfile} className="space-y-4">
              <div>
                <label className="block text-[11px] font-medium text-[var(--app-text-secondary)] mb-1.5">
                  Nombre para mostrar
                </label>
                <input
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Tu nombre completo"
                  className="w-full px-3 py-2 rounded-lg border border-[var(--app-border-strong)] bg-[var(--app-bg-primary)] text-xs text-[var(--app-text-primary)] outline-none focus:border-[var(--app-accent)] transition-colors"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-[11px] font-medium text-[var(--app-text-secondary)]">
                    Avatar
                  </label>
                  <div className="flex items-center gap-1.5">
                    <input
                      ref={avatarInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handleAvatarFileChange}
                      className="hidden"
                    />
                    <button
                      type="button"
                      onClick={() => avatarInputRef.current?.click()}
                      className="inline-flex items-center gap-1 px-2 py-1 rounded-md border border-[var(--app-border-strong)] bg-[var(--app-bg-secondary)] hover:bg-[var(--app-hover)] text-[11px] text-[var(--app-text-secondary)] hover:text-[var(--app-text-primary)] transition-colors cursor-pointer"
                    >
                      <Upload className="w-3 h-3" />
                      <span>Subir imagen</span>
                    </button>
                    {avatarUrl && (
                      <button
                        type="button"
                        onClick={() => setAvatarUrl('')}
                        className="inline-flex items-center gap-1 px-2 py-1 rounded-md border border-[var(--app-border)] hover:bg-[var(--app-hover)] text-[11px] text-[var(--app-text-muted)] hover:text-[var(--app-text-primary)] transition-colors cursor-pointer"
                        title="Usar inicial"
                      >
                        <X className="w-3 h-3" />
                        <span>Quitar</span>
                      </button>
                    )}
                  </div>
                </div>
                <div className="grid grid-cols-6 sm:grid-cols-9 gap-2">
                  {PRESET_AVATARS.map((av) => {
                    const isSelected = avatarUrl === av.url
                    return (
                      <button
                        key={av.id}
                        type="button"
                        onClick={() => setAvatarUrl(av.url)}
                        title={av.label}
                        className={`aspect-square rounded-lg overflow-hidden border transition-all cursor-pointer ${
                          isSelected
                            ? 'border-[var(--app-accent)] ring-2 ring-[var(--app-accent)] ring-offset-2 ring-offset-[var(--app-bg-overlay)]'
                            : 'border-[var(--app-border)] hover:border-[var(--app-border-strong)] opacity-85 hover:opacity-100'
                        }`}
                      >
                        <img src={av.url} alt={av.label} className="w-full h-full object-cover" />
                      </button>
                    )
                  })}
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-medium text-[var(--app-text-secondary)] mb-2 flex items-center gap-1.5">
                  <Palette className="w-3.5 h-3.5 text-[var(--app-text-muted)]" />
                  Color identificador de avatar y notas
                </label>
                <div className="flex items-center gap-2 flex-wrap">
                  {PRESET_COLORS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setColor(c)}
                      className={`w-6 h-6 rounded-md transition flex items-center justify-center cursor-pointer ${
                        color === c ? 'ring-2 ring-offset-2 ring-[var(--app-text-primary)] ring-offset-[var(--app-bg-overlay)]' : 'hover:opacity-90'
                      }`}
                      style={{ backgroundColor: c }}
                    >
                      {color === c && <Check className="w-3.5 h-3.5 text-white" />}
                    </button>
                  ))}
                  <input
                    type="color"
                    value={color}
                    onChange={(e) => setColor(e.target.value)}
                    className="w-6 h-6 rounded-md border border-[var(--app-border-strong)] cursor-pointer p-0 bg-transparent"
                    title="Color personalizado"
                  />
                </div>
              </div>

              {/* ID de usuario y Metadatos */}
              <div className="p-3 rounded-lg bg-[var(--app-bg-secondary)] border border-[var(--app-border)] space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-[var(--app-text-secondary)]">ID de Usuario</span>
                  <div className="flex items-center gap-1.5">
                    <code className="font-mono text-[11px] bg-[var(--app-hover)] text-[var(--app-text-primary)] px-1.5 py-0.5 rounded">
                      {currentMember.id ? `${currentMember.id.slice(0, 12)}...` : 'N/A'}
                    </code>
                    <button
                      type="button"
                      onClick={handleCopyUserId}
                      className="p-1 rounded text-[var(--app-text-muted)] hover:text-[var(--app-text-primary)] hover:bg-[var(--app-hover)] transition-colors cursor-pointer"
                      title="Copiar ID completo"
                    >
                      {copiedId ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>

                <div className="flex items-center justify-between text-[11px] text-[var(--app-text-secondary)]">
                  <span>Rol asignado</span>
                  <span className="font-medium text-[var(--app-text-primary)]">
                    {roleLabel} ({currentMember.role})
                  </span>
                </div>
              </div>

              <div className="pt-1 flex justify-end">
                <button
                  type="submit"
                  disabled={savingProfile}
                  className="w-full py-2 px-4 rounded-lg bg-[var(--app-text-primary)] text-[var(--app-bg-primary)] hover:opacity-90 font-medium text-xs transition cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {savingProfile ? (
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <span>Guardar cambios</span>
                  )}
                </button>
              </div>
            </form>
          )}

          {activeTab === 'security' && (
            <div className="space-y-5">
              {/* Change Password Form */}
              <form onSubmit={handleChangePassword} className="space-y-3">
                <div className="flex items-center gap-2">
                  <Key className="w-3.5 h-3.5 text-[var(--app-text-secondary)]" />
                  <h3 className="text-xs font-semibold text-[var(--app-text-primary)]">Cambiar contraseña</h3>
                </div>

                {passwordError && (
                  <div className="p-2.5 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-xs flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                    <span>{passwordError}</span>
                  </div>
                )}

                {passwordSuccess && (
                  <div className="p-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 dark:text-emerald-300 text-xs flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
                    <span>{passwordSuccess}</span>
                  </div>
                )}

                <div>
                  <label className="block text-[11px] font-medium text-[var(--app-text-secondary)] mb-1">
                    Nueva contraseña (mínimo 8 caracteres)
                  </label>
                  <input
                    type="password"
                    required
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full px-3 py-2 rounded-lg border border-[var(--app-border-strong)] bg-[var(--app-bg-primary)] text-xs text-[var(--app-text-primary)] outline-none focus:border-[var(--app-accent)] transition-colors [&:-webkit-autofill]:shadow-[inset_0_0_0_1000px_var(--app-bg-primary)] [&:-webkit-autofill]:[-webkit-text-fill-color:var(--app-text-primary)]"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-medium text-[var(--app-text-secondary)] mb-1">
                    Confirmar nueva contraseña
                  </label>
                  <input
                    type="password"
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full px-3 py-2 rounded-lg border border-[var(--app-border-strong)] bg-[var(--app-bg-primary)] text-xs text-[var(--app-text-primary)] outline-none focus:border-[var(--app-accent)] transition-colors [&:-webkit-autofill]:shadow-[inset_0_0_0_1000px_var(--app-bg-primary)] [&:-webkit-autofill]:[-webkit-text-fill-color:var(--app-text-primary)]"
                  />
                </div>

                <button
                  type="submit"
                  disabled={savingPassword}
                  className="w-full py-2 px-4 rounded-lg border border-[var(--app-border-strong)] bg-[var(--app-bg-secondary)] hover:bg-[var(--app-hover)] text-[var(--app-text-primary)] text-xs font-medium transition-colors cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {savingPassword ? (
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <span>Actualizar contraseña</span>
                  )}
                </button>
              </form>

              {/* Session Termination / Logout */}
              <div className="pt-4 border-t border-[var(--app-divider)] space-y-3">
                <div className="flex items-center gap-2">
                  <LogOut className="w-3.5 h-3.5 text-rose-500 dark:text-rose-400" />
                  <h3 className="text-xs font-semibold text-[var(--app-text-primary)]">
                    Sesión activa
                  </h3>
                </div>

                <label className="flex items-center gap-2 text-[11px] text-[var(--app-text-secondary)] cursor-pointer">
                  <input
                    type="checkbox"
                    checked={clearCacheOnLogout}
                    onChange={(e) => setClearCacheOnLogout(e.target.checked)}
                    className="rounded accent-[var(--app-accent)]"
                  />
                  <span>Limpiar caché local de documentos al salir</span>
                </label>

                <button
                  type="button"
                  onClick={handleLogout}
                  className="w-full py-2 px-4 rounded-lg bg-rose-500/8 hover:bg-rose-500/15 text-rose-500 dark:text-rose-400 font-medium text-xs border border-rose-500/20 transition-colors flex items-center justify-center gap-2 cursor-pointer"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>Cerrar sesión</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
