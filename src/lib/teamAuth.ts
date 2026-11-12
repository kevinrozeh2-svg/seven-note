export type UserRole = 'admin' | 'member' | 'viewer'
export type UserStatus = 'active' | 'suspended' | 'pending'
export type UserTier = 'admin' | 'worker' | 'guest'

export interface UserProfile {
  id: string
  email?: string
  fullName: string
  avatarUrl?: string
  color: string
  initial: string
  role: UserRole
  status: UserStatus
  createdAt?: number
  updatedAt?: number
}

export interface TeamMember extends UserProfile {
  name: string // Alias de compatibilidad para fullName
  icon: string
}

/**
 * CAPA 1: ADMINISTRADORES
 * Correos de administradores con acceso y gestión total del sistema:
 * - Kevin (kevin.rozeh@gmail.com, kevin.rozeh2@gmail.com)
 * - Maikol (badmaik60@gmail.com)
 * - Marcos (marcos@sevennote.local / marcos.sevennote@gmail.com)
 * 
 * NOTA DE PRIVACIDAD: Los administradores pueden gestionar y editar todas las notas
 * y espacios compartidos del equipo, pero NO tienen acceso al contenido privado de
 * ningún usuario (cada cual conserva su privacidad personal al 100%).
 */
export const AUTHORIZED_ADMIN_EMAILS: string[] = [
  'kevin.rozeh@gmail.com',
  'kevin.rozeh2@gmail.com',
  'badmaik60@gmail.com',
  'marcos@sevennote.local',
  'marcos.sevennote@gmail.com'
]

/**
 * CAPA 2: TRABAJADORES (WORKERS)
 * Lista de correos autorizados para trabajadores del equipo:
 * - Tienen acceso a todos los espacios de trabajo del equipo.
 * - Pueden LEER todas las notas y tableros compartidos.
 * - SOLO pueden EDITAR lo que ellos mismos creen.
 * - Pueden crear notas/espacios privados que NADIE más (ni los administradores) podrá ver.
 * 
 * Puedes agregar más correos a este array o pre-autorizarlos desde el Panel de Administrador.
 */
export const AUTHORIZED_WORKER_EMAILS: string[] = [
  'melgilez@gmail.com'
]

export const TEAM_MEMBERS: TeamMember[] = [
  {
    id: 'kevin',
    name: 'Kevin',
    fullName: 'Kevin',
    color: '#2563eb',
    initial: 'K',
    role: 'admin',
    status: 'active',
    icon: '⚡',
    email: 'kevin.rozeh@gmail.com'
  },
  {
    id: 'maikol',
    name: 'Maikol',
    fullName: 'Maikol',
    color: '#10b981',
    initial: 'M',
    role: 'admin',
    status: 'active',
    icon: '⚡',
    email: 'badmaik60@gmail.com'
  },
  {
    id: 'marcos',
    name: 'Marcos',
    fullName: 'Marcos',
    color: '#8b5cf6',
    initial: 'Mc',
    role: 'admin',
    status: 'active',
    icon: '⚡',
    email: 'marcos@sevennote.local'
  },
  {
    id: 'mel',
    name: 'Mel',
    fullName: 'Mel',
    color: '#ec4899',
    initial: 'M',
    role: 'member',
    status: 'active',
    icon: '💼',
    email: 'melgilez@gmail.com'
  }
]

export function isAuthorizedAdminEmail(email?: string | null): boolean {
  if (!email) return false
  const normalized = email.toLowerCase().trim()
  return (
    AUTHORIZED_ADMIN_EMAILS.some((e) => e.toLowerCase() === normalized) ||
    TEAM_MEMBERS.some((m) => m.email?.toLowerCase() === normalized && m.role === 'admin')
  )
}

export function isAuthorizedWorkerEmail(email?: string | null): boolean {
  if (!email) return false
  const normalized = email.toLowerCase().trim()
  return AUTHORIZED_WORKER_EMAILS.some((e) => e.toLowerCase() === normalized)
}

/**
 * Identifica a qué capa pertenece un usuario:
 * - 'admin': Capa 1 (Admins: Kevin, Maikol, Marcos)
 * - 'worker': Capa 2 (Trabajadores con correo registrado)
 * - 'guest': Capa 3 (Visitante externo sin correo vía enlace compartido)
 */
export function getUserTier(member?: TeamMember | UserProfile | null, isExternalGuest?: boolean): UserTier {
  if (isExternalGuest) return 'guest'
  if (!member) return 'guest'
  if (isUserAdmin(member)) return 'admin'
  return 'worker'
}

const CURRENT_MEMBER_STORAGE_KEY = 'seven_note_current_member_id'
const CURRENT_PROFILE_STORAGE_KEY = 'seven_note_current_user_profile'
const MEMBER_CHANGE_EVENT = 'seven_note_member_changed'

let activeProfileMemory: TeamMember | null = null

export function getCurrentMember(): TeamMember {
  if (activeProfileMemory) {
    if (
      (activeProfileMemory.email && isAuthorizedAdminEmail(activeProfileMemory.email)) ||
      activeProfileMemory.id === 'kevin' ||
      activeProfileMemory.id === 'maikol'
    ) {
      activeProfileMemory.role = 'admin'
    }
    return activeProfileMemory
  }

  if (typeof window === 'undefined') return TEAM_MEMBERS[0]

  try {
    const savedProfile = localStorage.getItem(CURRENT_PROFILE_STORAGE_KEY)
    if (savedProfile) {
      const parsed = JSON.parse(savedProfile)
      if (parsed && parsed.id) {
        if (
          (parsed.email && isAuthorizedAdminEmail(parsed.email)) ||
          parsed.id === 'kevin' ||
          parsed.id === 'maikol'
        ) {
          parsed.role = 'admin'
        }
        activeProfileMemory = parsed
        return parsed
      }
    }

    const savedId = localStorage.getItem(CURRENT_MEMBER_STORAGE_KEY)
    const found = TEAM_MEMBERS.find((m) => m.id === savedId)
    if (found) {
      const copy = { ...found }
      if (
        (copy.email && isAuthorizedAdminEmail(copy.email)) ||
        copy.id === 'kevin' ||
        copy.id === 'maikol'
      ) {
        copy.role = 'admin'
      }
      activeProfileMemory = copy
      return copy
    }
  } catch (e) {
    console.warn('Error reading current member from localStorage', e)
  }

  return TEAM_MEMBERS[0] // Default Kevin
}

export function setCurrentMember(memberIdOrMember: string | TeamMember): TeamMember {
  let memberToSet: TeamMember

  if (typeof memberIdOrMember === 'string') {
    const found = TEAM_MEMBERS.find((m) => m.id === memberIdOrMember)
    if (found) {
      memberToSet = { ...found }
    } else {
      memberToSet = {
        id: memberIdOrMember,
        name: 'Usuario',
        fullName: 'Usuario',
        color: '#2563eb',
        initial: 'U',
        role: 'member',
        status: 'active',
        icon: '👤'
      }
    }
  } else {
    memberToSet = { ...memberIdOrMember }
  }

  if (
    (memberToSet.email && isAuthorizedAdminEmail(memberToSet.email)) ||
    memberToSet.id === 'kevin' ||
    memberToSet.id === 'maikol'
  ) {
    memberToSet.role = 'admin'
    memberToSet.icon = '⚡'
  }

  activeProfileMemory = memberToSet

  try {
    localStorage.setItem(CURRENT_MEMBER_STORAGE_KEY, memberToSet.id)
    localStorage.setItem(CURRENT_PROFILE_STORAGE_KEY, JSON.stringify(memberToSet))
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent(MEMBER_CHANGE_EVENT, { detail: memberToSet }))
    }
  } catch (e) {
    console.warn('Error saving current member', e)
  }

  return memberToSet
}

export function subscribeToMemberChanges(callback: (member: TeamMember) => void): () => void {
  if (typeof window === 'undefined') return () => {}
  const handler = (e: any) => {
    callback(e.detail || getCurrentMember())
  }
  window.addEventListener(MEMBER_CHANGE_EVENT, handler)
  return () => window.removeEventListener(MEMBER_CHANGE_EVENT, handler)
}

/**
 * Mapea un usuario autenticado de Supabase y su perfil en base de datos.
 */
export function mapSupabaseUserToMember(user: any, profile?: Partial<UserProfile> | null): TeamMember {
  if (!user) return TEAM_MEMBERS[0]

  const email = (user.email || profile?.email || '').toLowerCase().trim()
  const fullName = profile?.fullName || user.user_metadata?.full_name || email.split('@')[0] || 'Usuario'
  const initial = fullName.charAt(0).toUpperCase() || 'U'
  const color = profile?.color || '#2563eb'
  const isAuthorized = isAuthorizedAdminEmail(email) || user.id === 'kevin' || user.id === 'maikol'
  const role: UserRole = isAuthorized ? 'admin' : (profile?.role || 'member')
  const status: UserStatus = profile?.status || 'active'

  const rawAvatar =
    profile?.avatarUrl ||
    user.user_metadata?.avatar_url ||
    user.user_metadata?.picture ||
    user.user_metadata?.avatar ||
    (user.identities && user.identities[0]?.identity_data?.avatar_url) ||
    (user.identities && user.identities[0]?.identity_data?.picture) ||
    (email ? `https://unavatar.io/${encodeURIComponent(email)}?fallback=false` : undefined)

  const matchedPreset = TEAM_MEMBERS.find((tm) => tm.email && tm.email.toLowerCase() === email.toLowerCase())
  const fallbackId = matchedPreset ? matchedPreset.id : (email.includes('maikol') || email === 'badmaik60@gmail.com' ? 'maikol' : 'kevin')

  const member: TeamMember = {
    id: user.id || profile?.id || fallbackId,
    name: fullName,
    fullName: fullName,
    email: email,
    avatarUrl: rawAvatar,
    color: color,
    initial: initial,
    role: role,
    status: status,
    icon: role === 'admin' ? '⚡' : '👤',
    createdAt: profile?.createdAt,
    updatedAt: profile?.updatedAt
  }

  return member
}

/**
 * Comprueba si un usuario tiene permisos de Administrador (Capa 1).
 * Kevin, Maikol y Marcos siempre tienen rol de Administrador.
 */
export function isUserAdmin(member?: TeamMember | UserProfile | null): boolean {
  if (!member) return false
  if (member.role === 'admin') return true
  if (member.email && isAuthorizedAdminEmail(member.email)) return true
  if (member.id && (member.id === 'kevin' || member.id === 'maikol' || member.id === 'marcos')) return true
  if (member.id && TEAM_MEMBERS.some((tm) => tm.id === member.id && tm.role === 'admin')) return true
  return false
}

/**
 * Comprueba si el usuario tiene permiso básico de edición activo.
 */
export function canUserEdit(member?: TeamMember | UserProfile | null): boolean {
  if (!member) return true
  if (member.status === 'suspended') return false
  return member.role === 'admin' || member.role === 'member'
}

/**
 * Comprueba si el usuario actual es el autor/creador de un documento o tablero.
 */
export function isWorkspaceOwner(
  workspace?: {
    ownerMember?: string
    ownerName?: string
    createdBy?: string
    userId?: string
    user_id?: string
  } | null,
  currentMemberOrId?: string | TeamMember | null,
  authUserId?: string
): boolean {
  if (!workspace || !currentMemberOrId) return false

  const member = typeof currentMemberOrId === 'string'
    ? TEAM_MEMBERS.find((m: TeamMember) => m.id === currentMemberOrId) || getCurrentMember()
    : currentMemberOrId

  const memberId = typeof currentMemberOrId === 'string' ? currentMemberOrId : currentMemberOrId.id
  const effectiveAuthId = authUserId || (member?.id !== 'kevin' && member?.id !== 'maikol' && member?.id !== 'marcos' ? member?.id : undefined)

  // 1. Coincidencia por userId (UUID de auth de Supabase)
  const wsUserId = workspace.userId || workspace.user_id
  if (wsUserId) {
    if (effectiveAuthId && wsUserId === effectiveAuthId) return true
    if (memberId && wsUserId === memberId) return true
  }

  // 2. Coincidencia por ownerMember (ID, nombre o correo del miembro)
  if (workspace.ownerMember) {
    const om = workspace.ownerMember.toLowerCase().trim()
    if (om === memberId.toLowerCase().trim()) return true
    if (member?.name && om === member.name.toLowerCase().trim()) return true
    if (member?.fullName && om === member.fullName.toLowerCase().trim()) return true
    if (member?.email && om === member.email.toLowerCase().trim()) return true

    if (
      TEAM_MEMBERS.some(
        (tm) =>
          (tm.id === workspace.ownerMember || tm.name.toLowerCase() === workspace.ownerMember?.toLowerCase()) &&
          (tm.id === memberId || (member?.email && tm.email?.toLowerCase() === member.email.toLowerCase()))
      )
    ) {
      return true
    }
  }

  // 3. Coincidencia por createdBy
  if (workspace.createdBy) {
    const cb = workspace.createdBy.toLowerCase().trim()
    if (member?.name && cb === member.name.toLowerCase().trim()) return true
    if (member?.fullName && cb === member.fullName.toLowerCase().trim()) return true
    if (member?.email && cb === member.email.toLowerCase().trim()) return true
  }

  return false
}

/**
 * REGLA FUNDAMENTAL DE EDICIÓN DEL SISTEMA DE 3 CAPAS:
 * 
 * - Capa 1 (Admins: Kevin, Maikol, Marcos):
 *   Pueden editar cualquier nota o tablero compartido del equipo.
 *   NO pueden editar notas privadas de otros usuarios.
 * 
 * - Capa 2 (Trabajadores / Members):
 *   SOLO pueden editar lo que ellos mismos creen.
 *   Si la nota fue creada por otra persona, tienen acceso de SOLO LECTURA.
 * 
 * - Capa 3 (Invitados externos / Enlace público):
 *   Acceso estrictamente de SOLO LECTURA a esa nota específica.
 */
export function canUserEditWorkspace(
  workspace?: {
    isPrivate?: boolean
    ownerMember?: string
    ownerName?: string
    createdBy?: string
    userId?: string
    user_id?: string
    isPublicShared?: boolean
  } | null,
  currentMemberOrId?: string | TeamMember | null,
  authUserId?: string,
  isExternalGuest?: boolean
): boolean {
  // Capa 3: Enlaces externos compartidos son estrictamente de solo lectura
  if (isExternalGuest) return false
  if (!workspace || !currentMemberOrId) return false

  const member = typeof currentMemberOrId === 'string'
    ? TEAM_MEMBERS.find((m: TeamMember) => m.id === currentMemberOrId) || getCurrentMember()
    : currentMemberOrId

  if (member.status === 'suspended' || member.role === 'viewer') return false

  const isOwner = isWorkspaceOwner(workspace, member, authUserId)

  // Si la nota es privada: SOLO su creador puede verla y editarla (nadie más, ni los admins)
  if (workspace.isPrivate) {
    return isOwner
  }

  // Capa 1: Administradores pueden editar todo el contenido compartido del equipo
  if (isUserAdmin(member)) {
    return true
  }

  // Capa 2: Trabajadores SOLO pueden editar las notas y tableros que ellos mismos creen
  return isOwner
}

/**
 * Comprueba si el usuario tiene permiso para eliminar o enviar a la papelera una nota.
 * - Admins: pueden eliminar cualquier nota compartida o sus notas privadas.
 * - Trabajadores: SOLO pueden eliminar notas que ellos mismos crearon.
 */
export function canUserDeleteWorkspace(
  workspace?: {
    isPrivate?: boolean
    ownerMember?: string
    ownerName?: string
    createdBy?: string
    userId?: string
    user_id?: string
  } | null,
  currentMemberOrId?: string | TeamMember | null,
  authUserId?: string
): boolean {
  if (!workspace || !currentMemberOrId) return false

  const member = typeof currentMemberOrId === 'string'
    ? TEAM_MEMBERS.find((m: TeamMember) => m.id === currentMemberOrId) || getCurrentMember()
    : currentMemberOrId

  if (member.status === 'suspended' || member.role === 'viewer') return false

  const isOwner = isWorkspaceOwner(workspace, member, authUserId)

  if (workspace.isPrivate) {
    return isOwner
  }

  if (isUserAdmin(member)) {
    return true
  }

  return isOwner
}

/**
 * Comprueba si el usuario puede alternar la privacidad de una nota.
 * Solo el creador de la nota o los administradores pueden cambiar la privacidad.
 */
export function canUserTogglePrivacy(
  workspace?: {
    isPrivate?: boolean
    ownerMember?: string
    ownerName?: string
    createdBy?: string
    userId?: string
    user_id?: string
  } | null,
  currentMemberOrId?: string | TeamMember | null,
  authUserId?: string
): boolean {
  if (!workspace || !currentMemberOrId) return false
  const isOwner = isWorkspaceOwner(workspace, currentMemberOrId, authUserId)
  if (isOwner) return true
  // Si la nota ya es privada y no eres el dueño, no puedes cambiarla
  if (workspace.isPrivate) return false
  // Si es pública, un admin puede cambiarla
  return isUserAdmin(
    typeof currentMemberOrId === 'string'
      ? TEAM_MEMBERS.find((m) => m.id === currentMemberOrId) || getCurrentMember()
      : currentMemberOrId
  )
}

/**
 * Determina si un espacio de trabajo es visible para el miembro actual.
 * - Si no es privado (isPrivate === false o undefined): visible para todo el equipo (Admins y Trabajadores).
 * - Si es privado (isPrivate === true): SOLO visible si pertenece al usuario actual.
 *   ¡IMPORTANTE: Ni siquiera el administrador puede ver los espacios privados de otros usuarios, y viceversa!
 */
export function isSpaceVisible(
  space: { isPrivate?: boolean; ownerMember?: string; userId?: string; user_id?: string },
  currentMemberOrId?: string | TeamMember | null,
  authUserId?: string
): boolean {
  if (!space || !space.isPrivate) return true
  if (!currentMemberOrId) return false

  const member = typeof currentMemberOrId === 'string'
    ? TEAM_MEMBERS.find((m: TeamMember) => m.id === currentMemberOrId) || getCurrentMember()
    : currentMemberOrId

  const memberId = typeof currentMemberOrId === 'string' ? currentMemberOrId : currentMemberOrId.id
  const effectiveAuthId = authUserId || (member?.id !== 'kevin' && member?.id !== 'maikol' && member?.id !== 'marcos' ? member?.id : undefined)

  // Un espacio privado SOLO es visible si pertenece al usuario actual
  // Ni el administrador puede ver los espacios privados de los demás usuarios, y viceversa
  const matchesOwnerMember = Boolean(
    space.ownerMember && (
      space.ownerMember === memberId ||
      space.ownerMember.toLowerCase() === member?.name?.toLowerCase() ||
      (member?.email && space.ownerMember.toLowerCase() === member.email.toLowerCase()) ||
      TEAM_MEMBERS.some(
        (tm) =>
          (tm.id === space.ownerMember || tm.name.toLowerCase() === space.ownerMember?.toLowerCase()) &&
          (tm.id === memberId || (member?.email && tm.email?.toLowerCase() === member.email.toLowerCase()))
      )
    )
  )

  const spUserId = space.userId || space.user_id
  const matchesUserId = Boolean(
    spUserId && (
      spUserId === memberId ||
      (effectiveAuthId && spUserId === effectiveAuthId)
    )
  )

  return matchesOwnerMember || matchesUserId
}

/**
 * Determina si una nota o documento es visible para el miembro actual.
 * - Si no es privada (isPrivate === false o undefined): visible para todo el equipo (Admins y Trabajadores tienen acceso a todo).
 * - Si es privada (isPrivate === true): SOLO visible si pertenece al usuario actual (autor).
 *   ¡IMPORTANTE: Ni siquiera el administrador puede ver las notas privadas de otros usuarios, y viceversa!
 */
export function isWorkspaceVisible(
  workspace: { isPrivate?: boolean; ownerMember?: string; user_id?: string; userId?: string; spaceId?: string; ownerName?: string; createdBy?: string },
  currentMemberOrId?: string | TeamMember | null,
  authUserId?: string
): boolean {
  if (!workspace || !workspace.isPrivate) return true
  if (!currentMemberOrId) return false

  return isWorkspaceOwner(workspace, currentMemberOrId, authUserId)
}

