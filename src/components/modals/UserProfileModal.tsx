import React, { useState, useEffect } from 'react'
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
  CheckCircle2
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
  const [savingProfile, setSavingProfile] = useState(false)

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
      setNewPassword('')
      setConfirmPassword('')
      setPasswordError(null)
      setPasswordSuccess(null)
    }
  }, [isOpen, currentMember])

  if (!isOpen) return null

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
          color: color
        })
        if (!res.success) throw new Error(res.error)
      }

      const updated: TeamMember = {
        ...currentMember,
        name: fullName.trim(),
        fullName: fullName.trim(),
        color: color,
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

  const roleBadgeStyle =
    currentMember.role === 'admin'
      ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20'
      : currentMember.role === 'viewer'
      ? 'bg-neutral-500/10 text-neutral-600 dark:text-neutral-400 border-neutral-500/20'
      : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 animate-in fade-in duration-150">
      <div
        className="w-full max-w-lg bg-white dark:bg-[#1a1b1e] border border-black/[0.08] dark:border-white/[0.1] rounded-3xl shadow-2xl overflow-hidden flex flex-col text-neutral-900 dark:text-neutral-100 font-sans"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-black/[0.06] dark:border-white/[0.08]">
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-2xl flex items-center justify-center text-white font-bold text-base shadow-2xs"
              style={{ backgroundColor: color }}
            >
              {(fullName || currentMember.name || 'U').charAt(0).toUpperCase()}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-bold truncate max-w-[200px]">
                  {fullName || currentMember.name}
                </h2>
                <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold border ${roleBadgeStyle}`}>
                  {roleLabel}
                </span>
              </div>
              <p className="text-[11px] text-neutral-400 truncate max-w-[250px]">
                {currentMember.email || 'Sin correo asociado'}
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

        {/* Navigation Tabs */}
        <div className="flex border-b border-black/[0.06] dark:border-white/[0.08] px-6 pt-2 bg-black/[0.01] dark:bg-white/[0.01]">
          <button
            type="button"
            onClick={() => setActiveTab('profile')}
            className={`pb-2.5 px-3 text-xs font-semibold border-b-2 transition flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'profile'
                ? 'border-blue-600 text-blue-600 dark:border-blue-400 dark:text-blue-400'
                : 'border-transparent text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200'
            }`}
          >
            <User className="w-3.5 h-3.5" />
            <span>Perfil &amp; Apariencia</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('security')}
            className={`pb-2.5 px-3 text-xs font-semibold border-b-2 transition flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'security'
                ? 'border-blue-600 text-blue-600 dark:border-blue-400 dark:text-blue-400'
                : 'border-transparent text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200'
            }`}
          >
            <Shield className="w-3.5 h-3.5" />
            <span>Seguridad &amp; Sesión</span>
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-5 text-xs overflow-y-auto max-h-[75vh] custom-scrollbar">
          {activeTab === 'profile' && (
            <form onSubmit={handleSaveProfile} className="space-y-4">
              <div>
                <label className="block text-[11px] font-semibold text-neutral-600 dark:text-neutral-400 mb-1">
                  Nombre para mostrar:
                </label>
                <input
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Tu nombre completo"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-black/10 dark:border-white/10 bg-black/[0.02] dark:bg-white/[0.04] text-xs outline-none focus:border-blue-500 transition"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-neutral-600 dark:text-neutral-400 mb-1.5 flex items-center gap-1.5">
                  <Palette className="w-3.5 h-3.5 text-neutral-400" />
                  Color identificador de avatar y notas:
                </label>
                <div className="flex items-center gap-2 flex-wrap">
                  {PRESET_COLORS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setColor(c)}
                      className={`w-7 h-7 rounded-xl transition flex items-center justify-center cursor-pointer ${
                        color === c ? 'scale-110 ring-2 ring-offset-2 ring-blue-500' : 'hover:scale-105'
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
                    className="w-7 h-7 rounded-xl border-0 cursor-pointer p-0 bg-transparent"
                    title="Color personalizado"
                  />
                </div>
              </div>

              {/* ID de usuario y Metadatos */}
              <div className="p-3.5 rounded-2xl bg-black/[0.02] dark:bg-white/[0.02] border border-black/[0.05] dark:border-white/[0.07] space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-neutral-400">ID de Usuario:</span>
                  <div className="flex items-center gap-1.5">
                    <code className="font-mono text-[10px] bg-black/5 dark:bg-white/10 px-2 py-0.5 rounded-md">
                      {currentMember.id ? `${currentMember.id.slice(0, 12)}...` : 'N/A'}
                    </code>
                    <button
                      type="button"
                      onClick={handleCopyUserId}
                      className="p-1 rounded-lg text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 hover:bg-black/5 dark:hover:bg-white/10 transition cursor-pointer"
                      title="Copiar ID completo"
                    >
                      {copiedId ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>

                <div className="flex items-center justify-between text-[11px] text-neutral-400">
                  <span>Rol asignado:</span>
                  <span className="font-semibold text-neutral-700 dark:text-neutral-300">
                    {roleLabel} ({currentMember.role})
                  </span>
                </div>
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={savingProfile}
                  className="w-full py-2.5 px-4 rounded-xl bg-neutral-900 hover:bg-black dark:bg-white dark:hover:bg-neutral-100 text-white dark:text-neutral-900 font-semibold text-xs shadow-md transition cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {savingProfile ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <span>Guardar Cambios de Perfil</span>
                  )}
                </button>
              </div>
            </form>
          )}

          {activeTab === 'security' && (
            <div className="space-y-5">
              {/* Change Password Form */}
              <form onSubmit={handleChangePassword} className="space-y-3.5">
                <div className="flex items-center gap-2">
                  <Key className="w-4 h-4 text-blue-500" />
                  <h3 className="text-xs font-bold">Cambiar Contraseña</h3>
                </div>

                {passwordError && (
                  <div className="p-3 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-xs flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                    <span>{passwordError}</span>
                  </div>
                )}

                {passwordSuccess && (
                  <div className="p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 dark:text-emerald-300 text-xs flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
                    <span>{passwordSuccess}</span>
                  </div>
                )}

                <div>
                  <label className="block text-[11px] font-medium text-neutral-600 dark:text-neutral-400 mb-1">
                    Nueva Contraseña (mínimo 8 caracteres):
                  </label>
                  <input
                    type="password"
                    required
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-black/10 dark:border-white/10 bg-black/[0.02] dark:bg-white/[0.04] text-xs outline-none focus:border-blue-500 transition"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-medium text-neutral-600 dark:text-neutral-400 mb-1">
                    Confirmar Nueva Contraseña:
                  </label>
                  <input
                    type="password"
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-black/10 dark:border-white/10 bg-black/[0.02] dark:bg-white/[0.04] text-xs outline-none focus:border-blue-500 transition"
                  />
                </div>

                <button
                  type="submit"
                  disabled={savingPassword}
                  className="w-full py-2.5 px-4 rounded-xl border border-black/10 dark:border-white/10 bg-white dark:bg-[#222428] hover:bg-black/5 dark:hover:bg-white/10 text-xs font-semibold transition cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {savingPassword ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <span>Actualizar Contraseña</span>
                  )}
                </button>
              </form>

              {/* Session Termination / Logout */}
              <div className="pt-3 border-t border-black/[0.06] dark:border-white/[0.08] space-y-3">
                <div className="flex items-center gap-2">
                  <LogOut className="w-4 h-4 text-rose-500" />
                  <h3 className="text-xs font-bold text-rose-600 dark:text-rose-400">
                    Cerrar Sesión Activa
                  </h3>
                </div>

                <label className="flex items-center gap-2 text-[11px] text-neutral-500 dark:text-neutral-400 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={clearCacheOnLogout}
                    onChange={(e) => setClearCacheOnLogout(e.target.checked)}
                    className="rounded text-blue-600"
                  />
                  <span>Limpiar caché local de documentos al salir para mayor privacidad</span>
                </label>

                <button
                  type="button"
                  onClick={handleLogout}
                  className="w-full py-2.5 px-4 rounded-xl bg-rose-50 dark:bg-rose-950/30 hover:bg-rose-100 dark:hover:bg-rose-900/40 text-rose-600 dark:text-rose-400 font-semibold text-xs border border-rose-500/20 transition flex items-center justify-center gap-2 cursor-pointer active:scale-98"
                >
                  <LogOut className="w-4 h-4" />
                  <span>Cerrar Sesión Segura</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
