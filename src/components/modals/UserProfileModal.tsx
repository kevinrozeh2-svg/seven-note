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
  X,
  Shuffle,
  Camera
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
import {
  AVATAR_CATEGORIES,
  PRESET_AVATARS,
  generateRandomAvatarUrl,
  resizeAvatarFile,
  type AvatarCategoryId
} from '../../lib/avatars'
import { invalidateDocumentReadsProfileCache } from '../../lib/documentReads'
import { updateCachedTeamProfile } from '../../lib/teamProfiles'
import { UserAvatar } from '../ui/UserAvatar'
import { clearLocalUserData } from '../../db'
import { toast } from '../../lib/toast'

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
  const [avatarCategory, setAvatarCategory] = useState<AvatarCategoryId>('editorial')
  const [uploadingAvatar, setUploadingAvatar] = useState(false)
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
      const cleanAvatar =
        currentMember.avatarUrl && !/^https?:\/\/unavatar\.io\//i.test(currentMember.avatarUrl)
          ? currentMember.avatarUrl
          : ''
      setAvatarUrl(cleanAvatar)
      const matchedPreset = PRESET_AVATARS.find((a) => a.url === cleanAvatar)
      if (matchedPreset) {
        setAvatarCategory(matchedPreset.category)
      }
      setNewPassword('')
      setConfirmPassword('')
      setPasswordError(null)
      setPasswordSuccess(null)
    }
  }, [isOpen, currentMember])

  useEffect(() => {
    if (!isOpen) return
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [isOpen, onClose])

  if (!isOpen) return null

  const handleAvatarFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploadingAvatar(true)
    try {
      const dataUrl = await resizeAvatarFile(file)
      setAvatarUrl(dataUrl)
      toast.success('Foto lista. Pulsa «Guardar cambios» para aplicarla.')
    } catch (err: any) {
      toast.error(err?.message || 'No se pudo procesar la imagen seleccionada.')
    } finally {
      setUploadingAvatar(false)
      e.target.value = ''
    }
  }

  const handleRandomAvatar = () => {
    const cat = AVATAR_CATEGORIES.find((c) => c.id === avatarCategory)
    setAvatarUrl(generateRandomAvatarUrl(cat?.defaultStyle || 'notionists'))
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
          avatarUrl: avatarUrl,
          email: user.email || currentMember.email
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

      invalidateDocumentReadsProfileCache()
      updateCachedTeamProfile({
        id: updated.id,
        email: updated.email,
        fullName: updated.fullName,
        color: updated.color,
        avatarUrl: avatarUrl || ''
      })
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
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 backdrop-blur-xs p-2 sm:p-5 animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Mi Perfil y Seguridad"
        className="w-full max-w-3xl h-[86vh] sm:h-[78vh] max-h-[650px] bg-[var(--app-bg-primary)] border border-[var(--app-border-strong)] rounded-xl shadow-[var(--app-shadow-popover)] overflow-hidden flex flex-col md:flex-row text-[var(--app-text-primary)] font-sans"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Left Navigation Sidebar */}
        <aside className="md:w-56 shrink-0 bg-[var(--app-bg-secondary)] border-b md:border-b-0 md:border-r border-[var(--app-border)] flex flex-col">
          <div className="px-4 py-3.5 flex items-center justify-between gap-2 border-b border-[var(--app-divider)]">
            <div className="flex items-center gap-2.5 min-w-0">
              <UserAvatar
                name={fullName || currentMember.name}
                avatarUrl={avatarUrl}
                color={color}
                size="sm"
                shape="rounded"
                className="w-8 h-8 shrink-0"
              />
              <div className="min-w-0 leading-tight">
                <div className="text-[13px] font-semibold truncate text-[var(--app-text-primary)]">
                  {fullName || currentMember.name}
                </div>
                <div className="text-[11px] text-[var(--app-text-muted)] truncate">
                  {roleLabel}
                </div>
              </div>
            </div>
            <button
              type="button"
              aria-label="Cerrar perfil"
              onClick={onClose}
              className="md:hidden w-8 h-8 rounded-md flex items-center justify-center text-[var(--app-text-secondary)] hover:text-[var(--app-text-primary)] hover:bg-[var(--app-hover)] transition-colors cursor-pointer shrink-0"
            >
              <CloseIcon style={{ width: 16, height: 16 }} />
            </button>
          </div>

          <nav
            aria-label="Secciones de perfil"
            className="flex md:flex-col gap-1 p-2 overflow-x-auto md:overflow-y-auto no-scrollbar flex-1"
          >
            <button
              type="button"
              aria-current={activeTab === 'profile' ? 'page' : undefined}
              onClick={() => setActiveTab('profile')}
              className={`flex items-center gap-2.5 px-3 py-2 rounded-md text-xs font-medium whitespace-nowrap transition cursor-pointer shrink-0 ${
                activeTab === 'profile'
                  ? 'bg-[var(--app-active)] text-[var(--app-text-primary)] font-semibold'
                  : 'text-[var(--app-text-secondary)] hover:text-[var(--app-text-primary)] hover:bg-[var(--app-hover)]'
              }`}
            >
              <User className="w-4 h-4 shrink-0" />
              <span>Perfil y Apariencia</span>
            </button>

            <button
              type="button"
              aria-current={activeTab === 'security' ? 'page' : undefined}
              onClick={() => setActiveTab('security')}
              className={`flex items-center gap-2.5 px-3 py-2 rounded-md text-xs font-medium whitespace-nowrap transition cursor-pointer shrink-0 ${
                activeTab === 'security'
                  ? 'bg-[var(--app-active)] text-[var(--app-text-primary)] font-semibold'
                  : 'text-[var(--app-text-secondary)] hover:text-[var(--app-text-primary)] hover:bg-[var(--app-hover)]'
              }`}
            >
              <Shield className="w-4 h-4 shrink-0" />
              <span>Seguridad y Sesión</span>
            </button>
          </nav>

          <div className="hidden md:block px-4 py-3 border-t border-[var(--app-divider)] text-[11px] text-[var(--app-text-muted)] truncate">
            {currentMember.email || 'Cuenta local'}
          </div>
        </aside>

        {/* Right Content Pane */}
        <div className="flex-1 flex flex-col min-w-0 min-h-0">
          {/* Desktop Pane Header */}
          <div className="hidden md:flex items-center justify-between px-6 py-3.5 border-b border-[var(--app-divider)] shrink-0">
            <div>
              <h2 className="text-sm font-semibold text-[var(--app-text-primary)]">
                {activeTab === 'profile' ? 'Perfil y Apariencia' : 'Seguridad y Sesión'}
              </h2>
              <p className="text-xs text-[var(--app-text-muted)] mt-0.5">
                {activeTab === 'profile'
                  ? 'Edita tu nombre, avatar y color identificador en el equipo.'
                  : 'Actualiza tu contraseña o cierra sesión en este dispositivo.'}
              </p>
            </div>
            <button
              type="button"
              aria-label="Cerrar perfil"
              onClick={onClose}
              className="w-8 h-8 rounded-md flex items-center justify-center text-[var(--app-text-secondary)] hover:text-[var(--app-text-primary)] hover:bg-[var(--app-hover)] transition-colors cursor-pointer"
              title="Cerrar (Esc)"
            >
              <CloseIcon style={{ width: 16, height: 16 }} />
            </button>
          </div>

          {/* Scrollable Body */}
          <div className="p-4 sm:p-6 space-y-5 text-xs overflow-y-auto flex-1 custom-scrollbar">
            {activeTab === 'profile' && (
              <form onSubmit={handleSaveProfile} className="space-y-4">
                <div className="p-4 rounded-lg bg-[var(--app-bg-secondary)] border border-[var(--app-border)] space-y-3">
                  <div>
                    <label htmlFor="profile-display-name" className="block text-xs font-medium text-[var(--app-text-secondary)] mb-1.5">
                      Nombre para mostrar
                    </label>
                    <input
                      id="profile-display-name"
                      type="text"
                      required
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      placeholder="Tu nombre completo"
                      className="w-full h-9 px-3 rounded-md border border-[var(--app-border-strong)] bg-[var(--app-bg-primary)] text-xs text-[var(--app-text-primary)] outline-none focus:border-[var(--app-accent)] transition-colors"
                    />
                  </div>
                </div>

                <div className="p-4 rounded-lg bg-[var(--app-bg-secondary)] border border-[var(--app-border)] space-y-3.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[13px] font-semibold text-[var(--app-text-primary)]">
                      Foto de perfil y avatar
                    </span>
                    <input
                      ref={avatarInputRef}
                      type="file"
                      accept="image/png,image/jpeg,image/webp,image/gif"
                      onChange={handleAvatarFileChange}
                      className="hidden"
                    />
                  </div>

                  {/* Vista previa interactiva + acciones rápidas */}
                  <div className="flex items-center gap-3.5 p-3 rounded-md bg-[var(--app-bg-primary)] border border-[var(--app-border)]">
                    <button
                      type="button"
                      onClick={() => avatarInputRef.current?.click()}
                      disabled={uploadingAvatar}
                      className="relative group shrink-0 rounded-lg cursor-pointer"
                      title="Cambiar foto de perfil"
                    >
                      <UserAvatar
                        name={fullName || currentMember.name}
                        avatarUrl={avatarUrl}
                        color={color}
                        size="xl"
                        shape="rounded"
                      />
                      <span className="absolute inset-0 rounded-lg bg-black/45 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white">
                        {uploadingAvatar ? (
                          <RefreshCw className="w-4 h-4 animate-spin" />
                        ) : (
                          <Camera className="w-4 h-4" />
                        )}
                      </span>
                    </button>

                    <div className="min-w-0 flex-1 space-y-2">
                      <div className="text-xs text-[var(--app-text-secondary)] leading-snug">
                        Sube una foto propia o elige un avatar ilustrado.
                      </div>
                      <div className="flex items-center flex-wrap gap-1.5">
                        <button
                          type="button"
                          onClick={() => avatarInputRef.current?.click()}
                          disabled={uploadingAvatar}
                          className="inline-flex items-center gap-1.5 h-8 px-2.5 rounded-md border border-[var(--app-border-strong)] bg-[var(--app-bg-secondary)] hover:bg-[var(--app-hover)] text-xs font-medium text-[var(--app-text-primary)] transition-colors cursor-pointer disabled:opacity-50"
                        >
                          {uploadingAvatar ? (
                            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <Upload className="w-3.5 h-3.5" />
                          )}
                          <span>{uploadingAvatar ? 'Procesando...' : 'Subir foto'}</span>
                        </button>

                        <button
                          type="button"
                          onClick={handleRandomAvatar}
                          className="inline-flex items-center gap-1.5 h-8 px-2.5 rounded-md border border-[var(--app-border-strong)] bg-[var(--app-bg-secondary)] hover:bg-[var(--app-hover)] text-xs font-medium text-[var(--app-text-secondary)] hover:text-[var(--app-text-primary)] transition-colors cursor-pointer"
                          title="Generar avatar aleatorio en este estilo"
                        >
                          <Shuffle className="w-3.5 h-3.5" />
                          <span>Aleatorio</span>
                        </button>

                        {avatarUrl && (
                          <button
                            type="button"
                            onClick={() => setAvatarUrl('')}
                            className="inline-flex items-center gap-1 h-8 px-2.5 rounded-md border border-[var(--app-border)] hover:bg-[var(--app-hover)] text-xs text-[var(--app-text-muted)] hover:text-[var(--app-text-primary)] transition-colors cursor-pointer"
                            title="Usar inicial"
                          >
                            <X className="w-3.5 h-3.5" />
                            <span>Usar inicial</span>
                          </button>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Selector de categoría de avatares */}
                  <div className="flex items-center gap-1 p-1 rounded-md bg-[var(--app-bg-primary)] border border-[var(--app-border)]">
                    {AVATAR_CATEGORIES.map((cat) => {
                      const active = avatarCategory === cat.id
                      return (
                        <button
                          key={cat.id}
                          type="button"
                          onClick={() => setAvatarCategory(cat.id)}
                          className={`flex-1 py-1.5 px-2 rounded text-xs font-medium transition-colors cursor-pointer ${
                            active
                              ? 'bg-[var(--app-active)] text-[var(--app-text-primary)] font-semibold'
                              : 'text-[var(--app-text-secondary)] hover:text-[var(--app-text-primary)]'
                          }`}
                        >
                          {cat.label}
                        </button>
                      )
                    })}
                  </div>

                  {/* Cuadrícula de avatares */}
                  <div className="grid grid-cols-4 sm:grid-cols-8 gap-2">
                    {PRESET_AVATARS.filter((av) => av.category === avatarCategory).map((av) => {
                      const isSelected = avatarUrl === av.url
                      return (
                        <button
                          key={av.id}
                          type="button"
                          onClick={() => setAvatarUrl(av.url)}
                          title={av.label}
                          className={`relative aspect-square rounded-lg overflow-hidden border bg-[var(--app-bg-primary)] transition-all cursor-pointer ${
                            isSelected
                              ? 'border-[var(--app-accent)] ring-1 ring-[var(--app-accent)] scale-[1.02]'
                              : 'border-[var(--app-border)] hover:border-[var(--app-border-strong)]'
                          }`}
                        >
                          <img
                            src={av.url}
                            alt={av.label}
                            loading="lazy"
                            decoding="async"
                            referrerPolicy="no-referrer"
                            className="w-full h-full object-cover"
                          />
                          {isSelected && (
                            <span className="absolute bottom-1 right-1 w-4 h-4 rounded-full bg-[var(--app-accent)] text-white flex items-center justify-center shadow-xs">
                              <Check className="w-2.5 h-2.5 stroke-[3]" />
                            </span>
                          )}
                        </button>
                      )
                    })}
                  </div>

                  {/* Color identificador */}
                  <div className="pt-2 border-t border-[var(--app-divider)]">
                    <span className="text-xs font-medium text-[var(--app-text-secondary)] mb-2 flex items-center gap-1.5">
                      <Palette className="w-3.5 h-3.5 text-[var(--app-text-muted)]" />
                      Color identificador de avatar y notas
                    </span>
                    <div className="flex items-center gap-2 flex-wrap">
                      {PRESET_COLORS.map((c) => (
                        <button
                          key={c}
                          type="button"
                          aria-label={`Color ${c}`}
                          onClick={() => setColor(c)}
                          className={`w-6 h-6 rounded-md transition flex items-center justify-center cursor-pointer ${
                            color === c ? 'ring-2 ring-offset-2 ring-[var(--app-text-primary)] ring-offset-[var(--app-bg-secondary)]' : 'hover:opacity-90'
                          }`}
                          style={{ backgroundColor: c }}
                        >
                          {color === c && <Check className="w-3.5 h-3.5 text-white" />}
                        </button>
                      ))}
                      <input
                        type="color"
                        aria-label="Color personalizado"
                        value={color}
                        onChange={(e) => setColor(e.target.value)}
                        className="w-6 h-6 rounded-md border border-[var(--app-border-strong)] cursor-pointer p-0 bg-transparent"
                        title="Color personalizado"
                      />
                    </div>
                  </div>
                </div>

                {/* ID de usuario y Metadatos */}
                <div className="p-3.5 rounded-lg bg-[var(--app-bg-secondary)] border border-[var(--app-border)] divide-y divide-[var(--app-divider)]">
                  <div className="flex items-center justify-between pb-2">
                    <span className="text-xs text-[var(--app-text-secondary)]">ID de Usuario</span>
                    <div className="flex items-center gap-1.5">
                      <code className="font-mono text-[11px] bg-[var(--app-bg-primary)] border border-[var(--app-border)] text-[var(--app-text-primary)] px-2 py-0.5 rounded">
                        {currentMember.id ? `${currentMember.id.slice(0, 12)}...` : 'N/A'}
                      </code>
                      <button
                        type="button"
                        aria-label="Copiar ID completo"
                        onClick={handleCopyUserId}
                        className="w-7 h-7 rounded-md flex items-center justify-center text-[var(--app-text-muted)] hover:text-[var(--app-text-primary)] hover:bg-[var(--app-hover)] transition-colors cursor-pointer"
                        title="Copiar ID completo"
                      >
                        {copiedId ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-2 text-xs text-[var(--app-text-secondary)]">
                    <span>Rol asignado</span>
                    <span className="font-semibold text-[var(--app-text-primary)]">
                      {roleLabel}
                    </span>
                  </div>
                </div>

                <div className="pt-1 flex justify-end">
                  <button
                    type="submit"
                    disabled={savingProfile}
                    className="h-9 px-5 rounded-md bg-[var(--app-accent)] hover:bg-[var(--app-accent-hover)] text-white font-semibold text-xs transition cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50"
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
              <div className="space-y-4">
                {/* Change Password Form */}
                <form
                  onSubmit={handleChangePassword}
                  className="p-4 rounded-lg bg-[var(--app-bg-secondary)] border border-[var(--app-border)] space-y-3.5"
                >
                  <div className="flex items-center gap-2">
                    <Key className="w-4 h-4 text-[var(--app-text-secondary)]" />
                    <h3 className="text-[13px] font-semibold text-[var(--app-text-primary)]">Cambiar contraseña</h3>
                  </div>

                  {passwordError && (
                    <div className="p-2.5 rounded-md bg-rose-500/10 border border-rose-500/20 text-rose-500 text-xs flex items-start gap-2">
                      <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                      <span>{passwordError}</span>
                    </div>
                  )}

                  {passwordSuccess && (
                    <div className="p-2.5 rounded-md bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-300 text-xs flex items-start gap-2">
                      <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
                      <span>{passwordSuccess}</span>
                    </div>
                  )}

                  <div>
                    <label htmlFor="profile-new-password" className="block text-xs font-medium text-[var(--app-text-secondary)] mb-1.5">
                      Nueva contraseña (mínimo 8 caracteres)
                    </label>
                    <input
                      id="profile-new-password"
                      type="password"
                      autoComplete="new-password"
                      required
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full h-9 px-3 rounded-md border border-[var(--app-border-strong)] bg-[var(--app-bg-primary)] text-xs text-[var(--app-text-primary)] outline-none focus:border-[var(--app-accent)] transition-colors [&:-webkit-autofill]:shadow-[inset_0_0_0_1000px_var(--app-bg-primary)] [&:-webkit-autofill]:[-webkit-text-fill-color:var(--app-text-primary)]"
                    />
                  </div>

                  <div>
                    <label htmlFor="profile-confirm-password" className="block text-xs font-medium text-[var(--app-text-secondary)] mb-1.5">
                      Confirmar nueva contraseña
                    </label>
                    <input
                      id="profile-confirm-password"
                      type="password"
                      autoComplete="new-password"
                      required
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full h-9 px-3 rounded-md border border-[var(--app-border-strong)] bg-[var(--app-bg-primary)] text-xs text-[var(--app-text-primary)] outline-none focus:border-[var(--app-accent)] transition-colors [&:-webkit-autofill]:shadow-[inset_0_0_0_1000px_var(--app-bg-primary)] [&:-webkit-autofill]:[-webkit-text-fill-color:var(--app-text-primary)]"
                    />
                  </div>

                  <div className="flex justify-end pt-1">
                    <button
                      type="submit"
                      disabled={savingPassword}
                      className="h-9 px-4 rounded-md bg-[var(--app-accent)] hover:bg-[var(--app-accent-hover)] text-white text-xs font-semibold transition-colors cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                      {savingPassword ? (
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <span>Actualizar contraseña</span>
                      )}
                    </button>
                  </div>
                </form>

                {/* Session Termination / Logout */}
                <div className="p-4 rounded-lg bg-[var(--app-bg-secondary)] border border-[var(--app-border)] space-y-3.5">
                  <div className="flex items-center gap-2">
                    <LogOut className="w-4 h-4 text-rose-500" />
                    <h3 className="text-[13px] font-semibold text-[var(--app-text-primary)]">
                      Sesión activa
                    </h3>
                  </div>

                  <label className="flex items-center justify-between gap-3 px-3 py-2.5 rounded-md border border-[var(--app-border)] bg-[var(--app-bg-primary)] cursor-pointer">
                    <div>
                      <div className="text-xs font-medium text-[var(--app-text-primary)]">
                        Limpiar caché local al salir
                      </div>
                      <div className="text-[11px] text-[var(--app-text-muted)]">
                        Borra la copia local de documentos en este navegador al cerrar sesión.
                      </div>
                    </div>
                    <span className="relative inline-flex items-center shrink-0">
                      <input
                        type="checkbox"
                        checked={clearCacheOnLogout}
                        onChange={(e) => setClearCacheOnLogout(e.target.checked)}
                        className="sr-only peer"
                      />
                      <span className="w-9 h-5 bg-[var(--app-border-strong)] rounded-full peer peer-checked:after:translate-x-4 after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[var(--app-accent)]" />
                    </span>
                  </label>

                  <div className="flex justify-end">
                    <button
                      type="button"
                      onClick={handleLogout}
                      className="h-9 px-4 rounded-md bg-rose-500/10 hover:bg-rose-500/20 text-rose-500 font-semibold text-xs border border-rose-500/25 transition-colors flex items-center justify-center gap-2 cursor-pointer"
                    >
                      <LogOut className="w-3.5 h-3.5" />
                      <span>Cerrar sesión</span>
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
