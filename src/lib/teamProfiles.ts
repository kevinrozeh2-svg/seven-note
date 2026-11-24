import { useEffect, useState } from 'react'
import {
  fetchAllProfiles,
  getSupabaseClient,
  isSupabaseConfigured
} from './supabase'
import { TEAM_MEMBERS, type UserProfile } from './teamAuth'

const TEAM_PROFILES_EVENT = 'seven_note_team_profiles_updated'
const CACHE_TTL_MS = 60_000

let cachedProfiles: UserProfile[] = []
let lastFetchedAt = 0
let inFlightFetch: Promise<UserProfile[]> | null = null
let realtimeChannel: any = null
let realtimeInitialized = false

export function sanitizeAvatarUrl(url?: string | null): string | undefined {
  if (typeof url !== 'string') return undefined
  const trimmed = url.trim()
  if (!trimmed) return undefined
  if (/^https?:\/\/unavatar\.io\//i.test(trimmed)) return undefined
  return trimmed
}

function emitProfilesUpdated() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(TEAM_PROFILES_EVENT, { detail: cachedProfiles }))
  }
}

export function getCachedTeamProfiles(): UserProfile[] {
  return cachedProfiles
}

export function updateCachedTeamProfile(updated: Partial<UserProfile> & { id: string }): void {
  const idx = cachedProfiles.findIndex((p) => p.id === updated.id)
  const cleanAvatar =
    updated.avatarUrl !== undefined ? sanitizeAvatarUrl(updated.avatarUrl) : undefined

  if (idx >= 0) {
    cachedProfiles = cachedProfiles.map((p, i) =>
      i === idx
        ? {
            ...p,
            ...updated,
            avatarUrl: updated.avatarUrl !== undefined ? cleanAvatar : p.avatarUrl,
            initial:
              (updated.fullName || p.fullName || updated.email || p.email || 'U')
                .charAt(0)
                .toUpperCase()
          }
        : p
    )
  } else if (updated.email || updated.fullName) {
    cachedProfiles = [
      ...cachedProfiles,
      {
        id: updated.id,
        email: updated.email,
        fullName: updated.fullName || updated.email?.split('@')[0] || 'Usuario',
        avatarUrl: cleanAvatar,
        color: updated.color || '#2563eb',
        initial: (updated.fullName || updated.email || 'U').charAt(0).toUpperCase(),
        role: updated.role || 'member',
        status: updated.status || 'active',
        createdAt: updated.createdAt,
        updatedAt: updated.updatedAt || Date.now()
      }
    ]
  }

  lastFetchedAt = Date.now()
  emitProfilesUpdated()
}

export function invalidateTeamProfilesCache(): void {
  lastFetchedAt = 0
}

export async function refreshTeamProfiles(force = false): Promise<UserProfile[]> {
  if (!isSupabaseConfigured()) {
    return cachedProfiles.length > 0 ? cachedProfiles : TEAM_MEMBERS
  }

  const now = Date.now()
  if (!force && cachedProfiles.length > 0 && now - lastFetchedAt < CACHE_TTL_MS) {
    return cachedProfiles
  }

  if (inFlightFetch) return inFlightFetch

  inFlightFetch = fetchAllProfiles()
    .then((rows) => {
      if (rows.length > 0) {
        cachedProfiles = rows.map((r) => ({
          ...r,
          avatarUrl: sanitizeAvatarUrl(r.avatarUrl)
        }))
        lastFetchedAt = Date.now()
        emitProfilesUpdated()
      }
      return cachedProfiles.length > 0 ? cachedProfiles : TEAM_MEMBERS
    })
    .catch((err) => {
      console.warn('Error refreshing team profiles:', err)
      return cachedProfiles.length > 0 ? cachedProfiles : TEAM_MEMBERS
    })
    .finally(() => {
      inFlightFetch = null
    })

  return inFlightFetch
}

export function initTeamProfilesRealtime(): void {
  if (realtimeInitialized || !isSupabaseConfigured()) return
  const supabase = getSupabaseClient()
  if (!supabase) return

  realtimeInitialized = true

  try {
    realtimeChannel = supabase
      .channel('seven-note-user-profiles-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'user_profiles' },
        (payload: any) => {
          const row = payload?.new
          if (payload?.eventType === 'DELETE' && payload?.old?.id) {
            cachedProfiles = cachedProfiles.filter((p) => p.id !== payload.old.id)
            emitProfilesUpdated()
            return
          }
          if (row && row.id) {
            updateCachedTeamProfile({
              id: row.id,
              email: row.email,
              fullName: row.full_name || '',
              avatarUrl: row.avatar_url ?? '',
              color: row.color || '#2563eb',
              role: row.role || 'member',
              status: row.status || 'active',
              createdAt: row.created_at,
              updatedAt: row.updated_at
            })
          } else {
            void refreshTeamProfiles(true)
          }
        }
      )
      .subscribe()
  } catch (err) {
    realtimeInitialized = false
    console.warn('Error subscribing to user_profiles realtime:', err)
  }
}

export function cleanupTeamProfilesRealtime(): void {
  if (realtimeChannel) {
    const supabase = getSupabaseClient()
    if (supabase) {
      supabase.removeChannel(realtimeChannel)
    }
    realtimeChannel = null
  }
  realtimeInitialized = false
  cachedProfiles = []
  lastFetchedAt = 0
  emitProfilesUpdated()
}

export function subscribeToTeamProfiles(callback: (profiles: UserProfile[]) => void): () => void {
  if (typeof window === 'undefined') return () => {}
  const handler = () => callback(cachedProfiles)
  window.addEventListener(TEAM_PROFILES_EVENT, handler)
  return () => window.removeEventListener(TEAM_PROFILES_EVENT, handler)
}

/**
 * Resuelve el perfil real de cualquier miembro del equipo a partir de su UUID,
 * alias legado ('kevin', 'maikol', 'marcos', 'mel'), correo o nombre visible.
 * Garantiza que siempre se obtenga el avatar_url actualizado desde user_profiles.
 */
export function resolveTeamProfile(
  identifier: {
    id?: string | null
    email?: string | null
    name?: string | null
  },
  profilesOverride?: UserProfile[]
): UserProfile | undefined {
  const profiles = profilesOverride && profilesOverride.length > 0 ? profilesOverride : cachedProfiles

  const idLower = identifier.id?.trim().toLowerCase() || ''
  const emailLower = identifier.email?.trim().toLowerCase() || ''
  const nameLower = identifier.name?.trim().toLowerCase() || ''

  if (!idLower && !emailLower && !nameLower) return undefined

  // 1. Coincidencia directa en user_profiles reales (UUID, email o fullName exacto)
  if (profiles.length > 0) {
    const direct = profiles.find((p) => {
      const pId = p.id?.toLowerCase().trim()
      const pEmail = p.email?.toLowerCase().trim()
      const pName = p.fullName?.toLowerCase().trim()
      return (
        (idLower && (pId === idLower || pEmail === idLower || pName === idLower)) ||
        (emailLower && pEmail === emailLower) ||
        (nameLower && (pName === nameLower || pEmail === nameLower || pId === nameLower))
      )
    })
    if (direct) return direct
  }

  // 2. Puente mediante TEAM_MEMBERS: si el dato guardado usa un alias legado ('marcos', 'mel', etc.)
  //    resolvemos su correo canónico y buscamos la fila real en user_profiles para obtener su foto actual.
  const matchedPreset = TEAM_MEMBERS.find((m) => {
    const mId = m.id.toLowerCase()
    const mName = m.name.toLowerCase()
    const mEmail = m.email?.toLowerCase()
    return (
      (idLower && (mId === idLower || mName === idLower || mEmail === idLower)) ||
      (emailLower && mEmail === emailLower) ||
      (nameLower && (mName === nameLower || mId === nameLower || mEmail === nameLower))
    )
  })

  if (matchedPreset && matchedPreset.email && profiles.length > 0) {
    const presetEmail = matchedPreset.email.toLowerCase()
    const bridged = profiles.find((p) => p.email?.toLowerCase().trim() === presetEmail)
    if (bridged) return bridged
  }

  // 3. Coincidencia parcial por primer nombre (ej. "Melissa" -> "Melissa Gil")
  if (nameLower && profiles.length > 0) {
    const firstWord = nameLower.split(/\s+/)[0]
    if (firstWord.length >= 3) {
      const partial = profiles.find((p) => {
        const pFirst = p.fullName?.toLowerCase().trim().split(/\s+/)[0]
        return pFirst === firstWord
      })
      if (partial) return partial
    }
  }

  return matchedPreset
}

export function useTeamProfiles(): UserProfile[] {
  const [profiles, setProfiles] = useState<UserProfile[]>(() => cachedProfiles)

  useEffect(() => {
    initTeamProfilesRealtime()
    void refreshTeamProfiles(false).then((rows) => {
      if (rows.length > 0) setProfiles(rows)
    })
    return subscribeToTeamProfiles((next) => {
      setProfiles(next)
    })
  }, [])

  return profiles
}
