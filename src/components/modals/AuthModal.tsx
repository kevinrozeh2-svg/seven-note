import React, { useState, useEffect } from 'react'
import { CloseIcon } from '@blocksuite/icons/rc'
import {
  Lock,
  Mail,
  Shield,
  AlertCircle,
  LogIn,
  Eye,
  EyeOff,
  UserPlus,
  Key,
  RefreshCw,
  CheckCircle2,
  ArrowLeft,
  Settings,
  Sparkles,
  User
} from 'lucide-react'
import {
  signInUser,
  signUpUser,
  resetPasswordForEmail,
  updateUserPassword,
  fetchUserProfile,
  getStoredSupabaseConfig,
  saveSupabaseConfig,
  testSupabaseConnection,
  isSupabaseConfigured
} from '../../lib/supabase'
import { setCurrentMember, mapSupabaseUserToMember, type TeamMember } from '../../lib/teamAuth'
import { syncEngine } from '../../lib/syncEngine'
import { toast } from 'sonner'

export type AuthMode = 'login' | 'register' | 'forgot' | 'reset' | 'config'

interface AuthModalProps {
  isOpen: boolean
  onClose: () => void
  initialMode?: AuthMode
  onAuthSuccess?: (member: TeamMember) => void
  canDismiss?: boolean
  onContinueAsGuest?: () => void
}

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  onClose,
  initialMode = 'login',
  onAuthSuccess,
  canDismiss = true,
  onContinueAsGuest
}) => {
  const [mode, setMode] = useState<AuthMode>(initialMode)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)

  // Quick config fields for Supabase
  const [supabaseUrl, setSupabaseUrl] = useState('')
  const [supabaseKey, setSupabaseKey] = useState('')
  const [configTesting, setConfigTesting] = useState(false)

  useEffect(() => {
    if (isOpen) {
      setMode(initialMode)
      setErrorMsg(null)
      setSuccessMsg(null)
      const conf = getStoredSupabaseConfig()
      setSupabaseUrl(conf.url)
      setSupabaseKey(conf.anonKey)

      // If Supabase is not configured and user opened auth, suggest configuring
      if (!isSupabaseConfigured() && initialMode !== 'config') {
        // Can still show login or prompt configuration
      }
    }
  }, [isOpen, initialMode])

  if (!isOpen) return null

  // Password validation: at least 8 chars
  const isPasswordValid = password.length >= 8
  const doPasswordsMatch = password === confirmPassword

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email || !password) {
      setErrorMsg('Por favor completa el correo y la contraseña.')
      return
    }

    setLoading(true)
    setErrorMsg(null)

    try {
      const { data, error } = await signInUser(email, password)
      if (error) throw error

      if (data?.user) {
        // Fetch detailed profile from user_profiles table if available
        const profile = await fetchUserProfile(data.user.id)
        const member = mapSupabaseUserToMember(data.user, profile)
        setCurrentMember(member)
        onAuthSuccess?.(member)
        toast.success(`¡Bienvenido, ${member.fullName}! Sesión iniciada correctamente.`)
        syncEngine.triggerSync()
        onClose()
      }
    } catch (err: any) {
      console.error('Error in login:', err)
      const msg = err?.message || 'Error de autenticación'
      if (msg.includes('Invalid login credentials')) {
        setErrorMsg('Credenciales incorrectas o usuario no registrado.')
      } else if (msg.includes('Email not confirmed')) {
        setErrorMsg('Tu correo aún no ha sido confirmado. Revisa tu bandeja de entrada o desactiva la confirmación requerida en Supabase.')
      } else {
        setErrorMsg(msg)
      }
    } finally {
      setLoading(false)
    }
  }

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email || !password || !fullName.trim()) {
      setErrorMsg('Por favor completa todos los campos requeridos.')
      return
    }

    if (!isPasswordValid) {
      setErrorMsg('La contraseña debe tener al menos 8 caracteres para mayor seguridad.')
      return
    }

    if (!doPasswordsMatch) {
      setErrorMsg('Las contraseñas no coinciden.')
      return
    }

    setLoading(true)
    setErrorMsg(null)

    try {
      const { data, error } = await signUpUser(email, password, fullName.trim())
      if (error) throw error

      if (data?.session) {
        // Auto-login if email confirmation is disabled
        const profile = await fetchUserProfile(data.user!.id)
        const member = mapSupabaseUserToMember(data.user!, profile)
        setCurrentMember(member)
        onAuthSuccess?.(member)
        toast.success(`¡Cuenta creada con éxito! Bienvenido, ${member.fullName}.`)
        syncEngine.triggerSync()
        onClose()
      } else if (data?.user) {
        // Confirmation required
        setSuccessMsg(
          '¡Cuenta creada correctamente! Se ha enviado un correo de verificación. Por favor confirma tu dirección antes de iniciar sesión.'
        )
      }
    } catch (err: any) {
      console.error('Error in registration:', err)
      const msg = err?.message || 'Error al registrar usuario'
      if (msg.includes('User already registered')) {
        setErrorMsg('Este correo ya está registrado. Por favor inicia sesión o recupera tu contraseña.')
      } else {
        setErrorMsg(msg)
      }
    } finally {
      setLoading(false)
    }
  }

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email) {
      setErrorMsg('Ingresa tu correo para recibir las instrucciones.')
      return
    }

    setLoading(true)
    setErrorMsg(null)

    try {
      const { error } = await resetPasswordForEmail(email)
      if (error) throw error
      setSuccessMsg('Hemos enviado un enlace de recuperación a tu correo. Revisa tu bandeja de entrada (y la carpeta de spam).')
    } catch (err: any) {
      console.error('Error in reset password request:', err)
      setErrorMsg(err?.message || 'Error al solicitar recuperación de contraseña.')
    } finally {
      setLoading(false)
    }
  }

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!password) {
      setErrorMsg('Ingresa tu nueva contraseña.')
      return
    }

    if (!isPasswordValid) {
      setErrorMsg('La nueva contraseña debe tener al menos 8 caracteres.')
      return
    }

    if (!doPasswordsMatch) {
      setErrorMsg('Las contraseñas no coinciden.')
      return
    }

    setLoading(true)
    setErrorMsg(null)

    try {
      const { error } = await updateUserPassword(password)
      if (error) throw error
      toast.success('¡Contraseña actualizada con éxito! Ya puedes usar tu nueva clave.')
      setMode('login')
      setPassword('')
      setConfirmPassword('')
      setSuccessMsg('Contraseña actualizada correctamente. Inicia sesión con tus nuevas credenciales.')
    } catch (err: any) {
      console.error('Error updating password:', err)
      setErrorMsg(err?.message || 'Error al actualizar la contraseña.')
    } finally {
      setLoading(false)
    }
  }

  const handleSaveConfig = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!supabaseUrl.trim() || !supabaseKey.trim()) {
      setErrorMsg('Debes ingresar la URL y la Anon Key de tu proyecto Supabase.')
      return
    }

    setConfigTesting(true)
    setErrorMsg(null)

    const test = await testSupabaseConnection(supabaseUrl.trim(), supabaseKey.trim())
    setConfigTesting(false)

    if (test.success) {
      saveSupabaseConfig({
        url: supabaseUrl.trim(),
        anonKey: supabaseKey.trim(),
        enabled: true
      })
      toast.success('¡Conexión a Supabase configurada con éxito!')
      setMode('login')
      syncEngine.scheduleSync(1000)
    } else {
      setErrorMsg(test.message || 'No fue posible conectar con el servidor de Supabase.')
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 animate-in fade-in duration-150">
      <div
        className="w-full max-w-md bg-white dark:bg-[#1a1b1e] border border-black/[0.08] dark:border-white/[0.1] rounded-3xl shadow-2xl overflow-hidden flex flex-col text-neutral-900 dark:text-neutral-100 font-sans"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-black/[0.06] dark:border-white/[0.08]">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-2xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold shadow-2xs">
              <Shield className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold">
                {mode === 'login' && 'Iniciar Sesión en el Equipo'}
                {mode === 'register' && 'Crear Cuenta de Miembro'}
                {mode === 'forgot' && 'Recuperar Contraseña'}
                {mode === 'reset' && 'Nueva Contraseña'}
                {mode === 'config' && 'Conectar con Supabase'}
              </h2>
              <p className="text-[11px] text-neutral-400">
                {mode === 'login' && 'Ingresa con tu correo y contraseña'}
                {mode === 'register' && 'Únete al espacio de trabajo de Seven Note'}
                {mode === 'forgot' && 'Te enviaremos un enlace seguro a tu correo'}
                {mode === 'reset' && 'Elige una contraseña fuerte para tu cuenta'}
                {mode === 'config' && 'Configura el backend en la nube para sincronizar'}
              </p>
            </div>
          </div>
          {canDismiss && (
            <button
              onClick={onClose}
              className="p-1.5 rounded-xl text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 hover:bg-black/5 dark:hover:bg-white/10 transition cursor-pointer"
            >
              <CloseIcon style={{ width: 16, height: 16 }} />
            </button>
          )}
        </div>

        {/* Content */}
        <div className="p-5 space-y-4 text-xs overflow-y-auto max-h-[80vh] custom-scrollbar">
          {/* Notification Alert / Errors */}
          {errorMsg && (
            <div className="p-3 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-xs flex items-start gap-2.5 animate-in fade-in">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <div className="leading-relaxed">{errorMsg}</div>
            </div>
          )}

          {successMsg && (
            <div className="p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 dark:text-emerald-300 text-xs flex items-start gap-2.5 animate-in fade-in">
              <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
              <div className="leading-relaxed">{successMsg}</div>
            </div>
          )}

          {/* MODE 1: LOGIN */}
          {mode === 'login' && (
            <form onSubmit={handleLogin} className="space-y-3.5">
              <div>
                <label className="block text-[11px] font-medium text-neutral-600 dark:text-neutral-400 mb-1">
                  Correo electrónico:
                </label>
                <div className="relative flex items-center">
                  <Mail className="w-4 h-4 absolute left-3 text-neutral-400 pointer-events-none" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="ejemplo@equipo.com"
                    className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-black/10 dark:border-white/10 bg-black/[0.02] dark:bg-white/[0.04] text-xs outline-none focus:border-blue-500 transition"
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-[11px] font-medium text-neutral-600 dark:text-neutral-400">
                    Contraseña:
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      setErrorMsg(null)
                      setSuccessMsg(null)
                      setMode('forgot')
                    }}
                    className="text-[11px] text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
                  >
                    ¿Olvidaste tu contraseña?
                  </button>
                </div>
                <div className="relative flex items-center">
                  <Lock className="w-4 h-4 absolute left-3 text-neutral-400 pointer-events-none" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full pl-9 pr-10 py-2.5 rounded-xl border border-black/10 dark:border-white/10 bg-black/[0.02] dark:bg-white/[0.04] text-xs outline-none focus:border-blue-500 transition"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 cursor-pointer"
                    title={showPassword ? 'Ocultar contraseña' : 'Ver contraseña'}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="pt-2 space-y-2">
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-2.5 px-4 rounded-xl bg-neutral-900 hover:bg-black dark:bg-white dark:hover:bg-neutral-100 text-white dark:text-neutral-900 font-semibold text-xs shadow-md transition cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50 active:scale-98"
                >
                  {loading ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <>
                      <LogIn className="w-4 h-4" />
                      <span>Iniciar Sesión</span>
                    </>
                  )}
                </button>

                <div className="text-center pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      setErrorMsg(null)
                      setSuccessMsg(null)
                      setMode('register')
                    }}
                    className="text-[11px] text-neutral-500 dark:text-neutral-400 hover:text-blue-600 dark:hover:text-blue-400 cursor-pointer"
                  >
                    ¿No tienes cuenta? <span className="font-semibold underline">Crear una cuenta</span>
                  </button>
                </div>
              </div>
            </form>
          )}

          {/* MODE 2: REGISTER */}
          {mode === 'register' && (
            <form onSubmit={handleRegister} className="space-y-3">
              <div>
                <label className="block text-[11px] font-medium text-neutral-600 dark:text-neutral-400 mb-1">
                  Nombre completo:
                </label>
                <div className="relative flex items-center">
                  <User className="w-4 h-4 absolute left-3 text-neutral-400 pointer-events-none" />
                  <input
                    type="text"
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Ej. Kevin González"
                    className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-black/10 dark:border-white/10 bg-black/[0.02] dark:bg-white/[0.04] text-xs outline-none focus:border-blue-500 transition"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-medium text-neutral-600 dark:text-neutral-400 mb-1">
                  Correo electrónico:
                </label>
                <div className="relative flex items-center">
                  <Mail className="w-4 h-4 absolute left-3 text-neutral-400 pointer-events-none" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="tu-correo@equipo.com"
                    className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-black/10 dark:border-white/10 bg-black/[0.02] dark:bg-white/[0.04] text-xs outline-none focus:border-blue-500 transition"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-medium text-neutral-600 dark:text-neutral-400 mb-1">
                  Contraseña (mínimo 8 caracteres):
                </label>
                <div className="relative flex items-center">
                  <Lock className="w-4 h-4 absolute left-3 text-neutral-400 pointer-events-none" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full pl-9 pr-10 py-2.5 rounded-xl border border-black/10 dark:border-white/10 bg-black/[0.02] dark:bg-white/[0.04] text-xs outline-none focus:border-blue-500 transition"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 cursor-pointer"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {/* Strength meter */}
                <div className="flex items-center gap-1.5 mt-1.5">
                  <div
                    className={`h-1 flex-1 rounded-full transition-all ${
                      password.length > 0 ? (password.length >= 8 ? 'bg-emerald-500' : 'bg-amber-500') : 'bg-neutral-200 dark:bg-neutral-800'
                    }`}
                  />
                  <div
                    className={`h-1 flex-1 rounded-full transition-all ${
                      password.length >= 10 ? 'bg-emerald-500' : 'bg-neutral-200 dark:bg-neutral-800'
                    }`}
                  />
                  <span className="text-[10px] text-neutral-400">
                    {password.length < 8 ? 'Corta' : password.length < 10 ? 'Aceptable' : 'Fuerte'}
                  </span>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-medium text-neutral-600 dark:text-neutral-400 mb-1">
                  Confirmar contraseña:
                </label>
                <div className="relative flex items-center">
                  <Lock className="w-4 h-4 absolute left-3 text-neutral-400 pointer-events-none" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-black/10 dark:border-white/10 bg-black/[0.02] dark:bg-white/[0.04] text-xs outline-none focus:border-blue-500 transition"
                  />
                </div>
              </div>

              <div className="pt-2 space-y-2">
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-2.5 px-4 rounded-xl bg-neutral-900 hover:bg-black dark:bg-white dark:hover:bg-neutral-100 text-white dark:text-neutral-900 font-semibold text-xs shadow-md transition cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50 active:scale-98"
                >
                  {loading ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <>
                      <UserPlus className="w-4 h-4" />
                      <span>Registrarse en el Equipo</span>
                    </>
                  )}
                </button>

                <div className="text-center pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      setErrorMsg(null)
                      setSuccessMsg(null)
                      setMode('login')
                    }}
                    className="text-[11px] text-neutral-500 dark:text-neutral-400 hover:text-blue-600 dark:hover:text-blue-400 cursor-pointer"
                  >
                    ¿Ya tienes una cuenta? <span className="font-semibold underline">Iniciar sesión</span>
                  </button>
                </div>
              </div>
            </form>
          )}

          {/* MODE 3: FORGOT PASSWORD */}
          {mode === 'forgot' && (
            <form onSubmit={handleForgotPassword} className="space-y-3.5">
              <p className="text-[11px] text-neutral-500 dark:text-neutral-400 leading-relaxed">
                Ingresa el correo asociado a tu cuenta. Te enviaremos un correo con un enlace seguro para que puedas establecer una nueva contraseña.
              </p>

              <div>
                <label className="block text-[11px] font-medium text-neutral-600 dark:text-neutral-400 mb-1">
                  Correo electrónico:
                </label>
                <div className="relative flex items-center">
                  <Mail className="w-4 h-4 absolute left-3 text-neutral-400 pointer-events-none" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="tu-correo@equipo.com"
                    className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-black/10 dark:border-white/10 bg-black/[0.02] dark:bg-white/[0.04] text-xs outline-none focus:border-blue-500 transition"
                  />
                </div>
              </div>

              <div className="pt-2 space-y-2">
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-2.5 px-4 rounded-xl bg-neutral-900 hover:bg-black dark:bg-white dark:hover:bg-neutral-100 text-white dark:text-neutral-900 font-semibold text-xs shadow-md transition cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50 active:scale-98"
                >
                  {loading ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <>
                      <Key className="w-4 h-4" />
                      <span>Enviar Enlace de Recuperación</span>
                    </>
                  )}
                </button>

                <div className="text-center pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      setErrorMsg(null)
                      setSuccessMsg(null)
                      setMode('login')
                    }}
                    className="text-[11px] text-neutral-500 dark:text-neutral-400 hover:text-blue-600 dark:hover:text-blue-400 flex items-center justify-center gap-1 mx-auto cursor-pointer"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                    <span>Volver al inicio de sesión</span>
                  </button>
                </div>
              </div>
            </form>
          )}

          {/* MODE 4: RESET PASSWORD (NEW PASSWORD) */}
          {mode === 'reset' && (
            <form onSubmit={handleUpdatePassword} className="space-y-3.5">
              <p className="text-[11px] text-neutral-500 dark:text-neutral-400 leading-relaxed">
                Ingresa y confirma tu nueva contraseña para volver a acceder a tu cuenta.
              </p>

              <div>
                <label className="block text-[11px] font-medium text-neutral-600 dark:text-neutral-400 mb-1">
                  Nueva Contraseña:
                </label>
                <div className="relative flex items-center">
                  <Lock className="w-4 h-4 absolute left-3 text-neutral-400 pointer-events-none" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Mínimo 8 caracteres"
                    className="w-full pl-9 pr-10 py-2.5 rounded-xl border border-black/10 dark:border-white/10 bg-black/[0.02] dark:bg-white/[0.04] text-xs outline-none focus:border-blue-500 transition"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 cursor-pointer"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-medium text-neutral-600 dark:text-neutral-400 mb-1">
                  Confirmar Nueva Contraseña:
                </label>
                <div className="relative flex items-center">
                  <Lock className="w-4 h-4 absolute left-3 text-neutral-400 pointer-events-none" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Repite la contraseña"
                    className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-black/10 dark:border-white/10 bg-black/[0.02] dark:bg-white/[0.04] text-xs outline-none focus:border-blue-500 transition"
                  />
                </div>
              </div>

              <div className="pt-2 space-y-2">
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-2.5 px-4 rounded-xl bg-neutral-900 hover:bg-black dark:bg-white dark:hover:bg-neutral-100 text-white dark:text-neutral-900 font-semibold text-xs shadow-md transition cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50 active:scale-98"
                >
                  {loading ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <>
                      <Key className="w-4 h-4" />
                      <span>Guardar Nueva Contraseña</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          )}

          {/* MODE 5: SUPABASE CONFIG */}
          {mode === 'config' && (
            <form onSubmit={handleSaveConfig} className="space-y-3.5">
              <p className="text-[11px] text-neutral-500 dark:text-neutral-400 leading-relaxed">
                Ingresa las credenciales de tu proyecto Supabase (las encuentras en Project Settings &gt; API en supabase.com).
              </p>

              <div>
                <label className="block text-[11px] font-medium text-neutral-600 dark:text-neutral-400 mb-1">
                  URL del Proyecto Supabase:
                </label>
                <input
                  type="url"
                  required
                  value={supabaseUrl}
                  onChange={(e) => setSupabaseUrl(e.target.value)}
                  placeholder="https://xyzcompany.supabase.co"
                  className="w-full px-3 py-2 rounded-xl border border-black/10 dark:border-white/10 bg-black/[0.02] dark:bg-white/[0.04] text-xs outline-none focus:border-blue-500 transition"
                />
              </div>

              <div>
                <label className="block text-[11px] font-medium text-neutral-600 dark:text-neutral-400 mb-1">
                  Anon Public Key:
                </label>
                <input
                  type="password"
                  required
                  value={supabaseKey}
                  onChange={(e) => setSupabaseKey(e.target.value)}
                  placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                  className="w-full px-3 py-2 rounded-xl border border-black/10 dark:border-white/10 bg-black/[0.02] dark:bg-white/[0.04] text-xs outline-none focus:border-blue-500 transition"
                />
              </div>

              <div className="pt-2 flex gap-2">
                <button
                  type="button"
                  onClick={() => setMode('login')}
                  className="px-4 py-2 rounded-xl border border-black/10 dark:border-white/10 text-xs font-semibold hover:bg-black/5 dark:hover:bg-white/10 transition cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={configTesting}
                  className="flex-1 py-2 px-4 rounded-xl bg-neutral-900 hover:bg-black dark:bg-white dark:hover:bg-neutral-100 text-white dark:text-neutral-900 font-semibold text-xs shadow-md transition cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {configTesting ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <span>Probar y Guardar Conexión</span>
                  )}
                </button>
              </div>
            </form>
          )}

          {/* Bottom Security Info & Offline Fallback */}
          <div className="p-3 rounded-2xl bg-black/[0.02] dark:bg-white/[0.02] border border-black/[0.04] dark:border-white/[0.06] text-[11px] text-neutral-500 dark:text-neutral-400 leading-relaxed space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-neutral-800 dark:text-neutral-200 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-blue-500" />
                Seguridad &amp; Privacidad
              </span>
              <button
                type="button"
                onClick={() => setMode(mode === 'config' ? 'login' : 'config')}
                className="text-[10px] text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1 cursor-pointer"
              >
                <Settings className="w-3 h-3" />
                <span>{mode === 'config' ? 'Volver al Login' : 'Configurar Servidor'}</span>
              </button>
            </div>
            <p>
              • Las notas privadas solo son accesibles desde tu propia cuenta autenticada.
            </p>
            <p>
              • Tus datos se respaldan en la nube de Supabase con cifrado y control de acceso RLS.
            </p>
          </div>

          {onContinueAsGuest && (
            <div className="pt-0.5 text-center">
              <button
                type="button"
                onClick={onContinueAsGuest}
                className="text-[11px] text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 transition cursor-pointer underline underline-offset-2"
              >
                Continuar en modo local / sin conexión →
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
