export type UserRole = 'admin' | 'member' | 'viewer'
export type UserStatus = 'active' | 'suspended' | 'pending'

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
    role: 'member',
    status: 'active',
    icon: '🚀',
    email: 'badmaik60@gmail.com'
  },
  {
    id: 'marcos',
    name: 'Marcos',
    fullName: 'Marcos',
    color: '#8b5cf6',
    initial: 'Mc',
    role: 'member',
    status: 'active',
    icon: '🎯',
    email: 'marcos@sevennote.local'
  }
]

const CURRENT_MEMBER_STORAGE_KEY = 'seven_note_current_member_id'
const CURRENT_PROFILE_STORAGE_KEY = 'seven_note_current_user_profile'
const MEMBER_CHANGE_EVENT = 'seven_note_member_changed'

let activeProfileMemory: TeamMember | null = null

export function getCurrentMember(): TeamMember {
  if (activeProfileMemory) return activeProfileMemory

  if (typeof window === 'undefined') return TEAM_MEMBERS[0]

  try {
    const savedProfile = localStorage.getItem(CURRENT_PROFILE_STORAGE_KEY)
    if (savedProfile) {
      const parsed = JSON.parse(savedProfile)
      if (parsed && parsed.id) {
        activeProfileMemory = parsed
        return parsed
      }
    }

    const savedId = localStorage.getItem(CURRENT_MEMBER_STORAGE_KEY)
    const found = TEAM_MEMBERS.find((m) => m.id === savedId)
    if (found) {
      activeProfileMemory = found
      return found
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
      memberToSet = found
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
    memberToSet = memberIdOrMember
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

  const email = (user.email || profile?.email || '').toLowerCase()
  const fullName = profile?.fullName || user.user_metadata?.full_name || email.split('@')[0] || 'Usuario'
  const initial = fullName.charAt(0).toUpperCase() || 'U'
  const color = profile?.color || '#2563eb'
  const role: UserRole = profile?.role || (email === 'kevin.rozeh@gmail.com' ? 'admin' : 'member')
  const status: UserStatus = profile?.status || 'active'

  const member: TeamMember = {
    id: user.id || profile?.id || 'kevin',
    name: fullName,
    fullName: fullName,
    email: email,
    avatarUrl: profile?.avatarUrl || user.user_metadata?.avatar_url,
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
 * Comprueba si un usuario tiene permisos de Administrador
 */
export function isUserAdmin(member?: TeamMember | UserProfile | null): boolean {
  if (!member) return false
  return member.role === 'admin'
}

/**
 * Comprueba si el usuario tiene permiso de edición (Admin o Miembro)
 */
export function canUserEdit(member?: TeamMember | UserProfile | null): boolean {
  if (!member) return true
  if (member.status === 'suspended') return false
  return member.role === 'admin' || member.role === 'member'
}

/**
 * Determina si una nota o documento es visible para el miembro actual.
 * - Si no es privada (isPrivate === false o undefined): visible para todo el equipo.
 * - Si es privada (isPrivate === true): SOLO visible si ownerMember coincide con el miembro actual o si es administrador.
 */
export function isWorkspaceVisible(
  workspace: { isPrivate?: boolean; ownerMember?: string; user_id?: string },
  currentMemberIdOrMember: string | TeamMember
): boolean {
  if (!workspace.isPrivate) return true

  const memberId = typeof currentMemberIdOrMember === 'string'
    ? currentMemberIdOrMember
    : currentMemberIdOrMember.id

  const isAdmin = typeof currentMemberIdOrMember !== 'string' && isUserAdmin(currentMemberIdOrMember)

  // Si es privada, visible para su autor o admin
  return workspace.ownerMember === memberId || (workspace.user_id && workspace.user_id === memberId) || isAdmin
}
