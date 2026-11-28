import { getSupabaseClient, isSupabaseConfigured } from './supabase'
import {
  TEAM_MEMBERS,
  getCurrentMember,
  type TeamMember,
  type UserProfile,
  type UserRole
} from './teamAuth'
import {
  refreshTeamProfiles,
  invalidateTeamProfilesCache,
  resolveTeamProfile,
  sanitizeAvatarUrl
} from './teamProfiles'

export const DOCUMENT_READS_CHANGED_EVENT = 'seven_note_document_reads_changed'

const LOCAL_READS_STORAGE_KEY = 'seven_note_document_reads_v1'
const RECORD_DEDUPE_MS = 5000

export interface DocumentReadEntry {
  workspaceId: string
  userId: string
  userName: string
  userEmail?: string
  userColor: string
  userAvatarUrl?: string
  role?: UserRole
  firstReadAt: number
  lastReadAt: number
  readCount: number
}

export interface DocumentReadsResult {
  reads: DocumentReadEntry[]
  pendingMembers: UserProfile[]
  tableMissing: boolean
}

type LocalReadsStore = Record<string, DocumentReadEntry[]>

const recentRecordTimestamps = new Map<string, number>()
let cachedProfiles: { items: UserProfile[]; fetchedAt: number } | null = null

export function invalidateDocumentReadsProfileCache(): void {
  cachedProfiles = null
  invalidateTeamProfilesCache()
}

function readLocalStore(): LocalReadsStore {
  if (typeof window === 'undefined') return {}
  try {
    const raw = localStorage.getItem(LOCAL_READS_STORAGE_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw)
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    return {}
  }
}

export interface DocumentReadSummary {
  totalReads: number
  uniqueReaders: number
  lastReadAt: number
  readerIds: string[]
}

/**
 * Devuelve un mapa rápido workspaceId -> métricas de lectura locales
 * para ordenar documentos por "Más leídos" en la pantalla de Inicio.
 */
export function getDocumentReadStatsMap(): Record<string, DocumentReadSummary> {
  const store = readLocalStore()
  const result: Record<string, DocumentReadSummary> = {}
  for (const [workspaceId, entries] of Object.entries(store)) {
    if (!Array.isArray(entries) || entries.length === 0) continue
    let totalReads = 0
    let lastReadAt = 0
    const readerSet = new Set<string>()
    for (const entry of entries) {
      totalReads += Math.max(1, Number(entry?.readCount) || 1)
      if ((entry?.lastReadAt || 0) > lastReadAt) {
        lastReadAt = entry.lastReadAt
      }
      if (entry?.userId) readerSet.add(String(entry.userId).toLowerCase().trim())
      if (entry?.userEmail) readerSet.add(String(entry.userEmail).toLowerCase().trim())
      if (entry?.userName) readerSet.add(String(entry.userName).toLowerCase().trim())
    }
    result[workspaceId] = {
      totalReads,
      uniqueReaders: entries.length,
      lastReadAt,
      readerIds: Array.from(readerSet)
    }
  }
  return result
}

function writeLocalStore(store: LocalReadsStore): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(LOCAL_READS_STORAGE_KEY, JSON.stringify(store))
  } catch {
    // ignore quota errors
  }
}

function upsertLocalRead(entry: DocumentReadEntry): void {
  const store = readLocalStore()
  const list = Array.isArray(store[entry.workspaceId]) ? [...store[entry.workspaceId]] : []
  const normalizedEmail = entry.userEmail?.toLowerCase().trim()

  const existingIdx = list.findIndex(
    (item) =>
      item.userId === entry.userId ||
      (normalizedEmail && item.userEmail?.toLowerCase().trim() === normalizedEmail)
  )

  if (existingIdx >= 0) {
    const prev = list[existingIdx]
    list[existingIdx] = {
      ...prev,
      ...entry,
      firstReadAt: Math.min(prev.firstReadAt || entry.firstReadAt, entry.firstReadAt),
      lastReadAt: Math.max(prev.lastReadAt || 0, entry.lastReadAt),
      readCount: Math.max(prev.readCount || 1, entry.readCount || 1)
    }
  } else {
    list.push(entry)
  }

  store[entry.workspaceId] = list
  writeLocalStore(store)
}

function isMissingTableOrFunctionError(error: any): boolean {
  if (!error) return false
  const code = String(error.code || '')
  const msg = String(error.message || '').toLowerCase()
  return (
    code === '42P01' ||
    code === '42883' ||
    code === 'PGRST202' ||
    code === 'PGRST205' ||
    msg.includes('seven_document_reads') ||
    msg.includes('record_document_read')
  )
}

async function getProfilesCached(forceRefresh = false): Promise<UserProfile[]> {
  if (!isSupabaseConfigured()) {
    return TEAM_MEMBERS
  }
  const profiles = await refreshTeamProfiles(forceRefresh)
  if (profiles.length > 0) {
    cachedProfiles = { items: profiles, fetchedAt: Date.now() }
    return profiles
  }
  return cachedProfiles?.items || TEAM_MEMBERS
}

/**
 * Registra automáticamente que el usuario actual entró al documento.
 * Cumple la condición de "leído" con solo abrir el documento.
 */
export async function recordDocumentRead(
  workspaceId: string,
  currentMember?: TeamMember | null,
  authUserId?: string | null
): Promise<void> {
  if (!workspaceId) return

  const member = currentMember || getCurrentMember()
  const effectiveUserId = (authUserId || member?.id || '').trim()
  if (!effectiveUserId) return

  const dedupeKey = `${workspaceId}:${effectiveUserId.toLowerCase()}`
  const now = Date.now()
  const lastRecorded = recentRecordTimestamps.get(dedupeKey)
  if (lastRecorded && now - lastRecorded < RECORD_DEDUPE_MS) {
    return
  }
  recentRecordTimestamps.set(dedupeKey, now)

  const displayName =
    (member?.fullName || member?.name || member?.email?.split('@')[0] || 'Usuario').trim()

  const localEntry: DocumentReadEntry = {
    workspaceId,
    userId: effectiveUserId,
    userName: displayName,
    userEmail: member?.email?.toLowerCase().trim(),
    userColor: member?.color || '#2563eb',
    userAvatarUrl: member?.avatarUrl,
    role: member?.role,
    firstReadAt: now,
    lastReadAt: now,
    readCount: 1
  }

  upsertLocalRead(localEntry)

  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent(DOCUMENT_READS_CHANGED_EVENT, {
        detail: { workspaceId, userId: effectiveUserId }
      })
    )
  }

  // Sincronizar con Supabase si está configurado y autenticado
  if (!isSupabaseConfigured() || !authUserId) return
  const supabase = getSupabaseClient()
  if (!supabase) return

  try {
    const { error: rpcError } = await supabase.rpc('record_document_read', {
      p_workspace_id: workspaceId
    })

    if (!rpcError) return

    // Fallback si el RPC aún no existe pero la tabla sí
    if (isMissingTableOrFunctionError(rpcError)) {
      const { error: upsertError } = await supabase
        .from('seven_document_reads')
        .upsert(
          {
            workspace_id: workspaceId,
            user_id: authUserId,
            user_name: displayName,
            user_email: member?.email?.toLowerCase().trim() || null,
            user_color: member?.color || '#2563eb',
            user_avatar_url: member?.avatarUrl || null,
            last_read_at: now
          },
          { onConflict: 'workspace_id,user_id' }
        )

      if (upsertError && !isMissingTableOrFunctionError(upsertError)) {
        console.warn('Error recording document read (fallback):', upsertError.message)
      }
    } else {
      console.warn('Error recording document read via RPC:', rpcError.message)
    }
  } catch (err) {
    console.warn('Error syncing document read to Supabase:', err)
  }
}

/**
 * Obtiene la lista de personas que han leído el documento (para administradores).
 */
export async function fetchDocumentReads(
  workspaceId: string,
  options?: {
    fallbackViewedBy?: string[]
    isPrivate?: boolean
    forceRefreshProfiles?: boolean
  }
): Promise<DocumentReadsResult> {
  if (!workspaceId) {
    return { reads: [], pendingMembers: [], tableMissing: false }
  }

  const profiles = await getProfilesCached(Boolean(options?.forceRefreshProfiles))
  const byId = new Map<string, UserProfile>()
  const byEmail = new Map<string, UserProfile>()
  const byName = new Map<string, UserProfile>()

  for (const p of profiles) {
    if (p.id) byId.set(p.id.toLowerCase(), p)
    if (p.email) byEmail.set(p.email.toLowerCase().trim(), p)
    if (p.fullName) byName.set(p.fullName.toLowerCase().trim(), p)
  }
  for (const tm of TEAM_MEMBERS) {
    if (tm.id && !byId.has(tm.id.toLowerCase())) byId.set(tm.id.toLowerCase(), tm)
    if (tm.email && !byEmail.has(tm.email.toLowerCase())) byEmail.set(tm.email.toLowerCase(), tm)
    if (tm.name && !byName.has(tm.name.toLowerCase())) byName.set(tm.name.toLowerCase(), tm)
  }

  let tableMissing = false
  const mergedMap = new Map<string, DocumentReadEntry>()

  const getCanonicalKey = (userId?: string, email?: string): string => {
    const cleanEmail = email?.toLowerCase().trim()
    if (cleanEmail) return `email:${cleanEmail}`
    return `id:${(userId || '').toLowerCase().trim()}`
  }

  const addOrMergeEntry = (raw: DocumentReadEntry) => {
    const profile =
      resolveTeamProfile(
        { id: raw.userId, email: raw.userEmail, name: raw.userName },
        profiles
      ) ||
      (raw.userId && byId.get(raw.userId.toLowerCase())) ||
      (raw.userEmail && byEmail.get(raw.userEmail.toLowerCase().trim())) ||
      (raw.userName && byName.get(raw.userName.toLowerCase().trim())) ||
      undefined

    const enriched: DocumentReadEntry = {
      ...raw,
      userName: profile?.fullName || raw.userName || raw.userEmail?.split('@')[0] || 'Usuario',
      userEmail: profile?.email || raw.userEmail,
      userColor: profile?.color || raw.userColor || '#2563eb',
      userAvatarUrl:
        sanitizeAvatarUrl(profile?.avatarUrl) || sanitizeAvatarUrl(raw.userAvatarUrl),
      role: profile?.role || raw.role
    }

    const key = getCanonicalKey(enriched.userId, enriched.userEmail)
    const existing = mergedMap.get(key)
    if (!existing) {
      mergedMap.set(key, enriched)
    } else {
      mergedMap.set(key, {
        ...existing,
        ...enriched,
        firstReadAt:
          existing.firstReadAt && enriched.firstReadAt
            ? Math.min(existing.firstReadAt, enriched.firstReadAt)
            : existing.firstReadAt || enriched.firstReadAt,
        lastReadAt: Math.max(existing.lastReadAt || 0, enriched.lastReadAt || 0),
        readCount: Math.max(existing.readCount || 1, enriched.readCount || 1)
      })
    }
  }

  // 1. Leer desde Supabase (fuente principal compartida entre dispositivos)
  if (isSupabaseConfigured()) {
    const supabase = getSupabaseClient()
    if (supabase) {
      try {
        const { data, error } = await supabase
          .from('seven_document_reads')
          .select('*')
          .eq('workspace_id', workspaceId)
          .order('last_read_at', { ascending: false })

        if (error) {
          if (isMissingTableOrFunctionError(error)) {
            tableMissing = true
          } else {
            console.warn('Error fetching document reads:', error.message)
          }
        } else if (Array.isArray(data)) {
          for (const row of data) {
            addOrMergeEntry({
              workspaceId: row.workspace_id,
              userId: row.user_id,
              userName: row.user_name || '',
              userEmail: row.user_email || undefined,
              userColor: row.user_color || '#2563eb',
              userAvatarUrl: row.user_avatar_url || undefined,
              firstReadAt: Number(row.first_read_at) || 0,
              lastReadAt: Number(row.last_read_at) || 0,
              readCount: Number(row.read_count) || 1
            })
          }
        }
      } catch (err) {
        console.warn('Error querying seven_document_reads:', err)
      }
    }
  }

  // 2. Combinar con lecturas locales (offline o mientras sincroniza)
  const localStore = readLocalStore()
  const localList = Array.isArray(localStore[workspaceId]) ? localStore[workspaceId] : []
  for (const item of localList) {
    addOrMergeEntry(item)
  }

  // 3. Compatibilidad con viewedBy previo del documento (si hay tokens que aún no están en la tabla)
  if (Array.isArray(options?.fallbackViewedBy) && options.fallbackViewedBy.length > 0) {
    for (const rawToken of options.fallbackViewedBy) {
      const token = (rawToken || '').toLowerCase().trim()
      if (!token) continue
      const matched = byId.get(token) || byEmail.get(token) || byName.get(token)
      if (!matched) continue

      const key = getCanonicalKey(matched.id, matched.email)
      if (!mergedMap.has(key)) {
        addOrMergeEntry({
          workspaceId,
          userId: matched.id,
          userName: matched.fullName || matched.email?.split('@')[0] || 'Usuario',
          userEmail: matched.email,
          userColor: matched.color || '#2563eb',
          userAvatarUrl: matched.avatarUrl,
          role: matched.role,
          firstReadAt: 0,
          lastReadAt: 0,
          readCount: 1
        })
      }
    }
  }

  const reads = Array.from(mergedMap.values()).sort((a, b) => (b.lastReadAt || 0) - (a.lastReadAt || 0))

  // Calcular miembros activos que aún no han leído (solo para notas compartidas)
  const pendingMembers: UserProfile[] = []
  if (!options?.isPrivate) {
    const readKeys = new Set<string>()
    for (const r of reads) {
      if (r.userId) readKeys.add(r.userId.toLowerCase())
      if (r.userEmail) readKeys.add(r.userEmail.toLowerCase().trim())
    }

    const activeProfiles = profiles.filter((p) => p.status !== 'suspended')
    for (const p of activeProfiles) {
      const idMatch = p.id && readKeys.has(p.id.toLowerCase())
      const emailMatch = p.email && readKeys.has(p.email.toLowerCase().trim())
      if (!idMatch && !emailMatch) {
        pendingMembers.push(p)
      }
    }
  }

  return { reads, pendingMembers, tableMissing }
}

/**
 * Suscripción en tiempo real a lecturas de un documento específico.
 */
export function subscribeToDocumentReads(
  workspaceId: string,
  onChange: () => void
): () => void {
  if (!workspaceId) return () => {}

  const handleLocalEvent = (e: Event) => {
    const detail = (e as CustomEvent<{ workspaceId?: string }>).detail
    if (!detail?.workspaceId || detail.workspaceId === workspaceId) {
      onChange()
    }
  }

  if (typeof window !== 'undefined') {
    window.addEventListener(DOCUMENT_READS_CHANGED_EVENT, handleLocalEvent)
  }

  let channel: any = null
  const supabase = isSupabaseConfigured() ? getSupabaseClient() : null

  if (supabase) {
    try {
      channel = supabase
        .channel(`doc-reads:${workspaceId}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'seven_document_reads',
            filter: `workspace_id=eq.${workspaceId}`
          },
          () => {
            onChange()
          }
        )
        .subscribe()
    } catch {
      // ignore realtime errors if table not yet created
    }
  }

  return () => {
    if (typeof window !== 'undefined') {
      window.removeEventListener(DOCUMENT_READS_CHANGED_EVENT, handleLocalEvent)
    }
    if (channel && supabase) {
      try {
        supabase.removeChannel(channel)
      } catch {
        // ignore
      }
    }
  }
}

export function getShortFirstName(fullName: string): string {
  const clean = (fullName || 'Usuario').trim()
  const first = clean.split(/\s+/)[0]
  return first || clean
}

export function formatReadSummary(reads: DocumentReadEntry[]): string {
  if (!reads || reads.length === 0) return 'Sin lecturas'
  const first = getShortFirstName(reads[0].userName)
  if (reads.length === 1) return `Leído por ${first}`
  if (reads.length === 2) {
    const second = getShortFirstName(reads[1].userName)
    return `Leído por ${first} y ${second}`
  }
  return `Leído por ${first} y ${reads.length - 1} más`
}

export function formatRelativeReadTime(timestampMs?: number): string {
  if (!timestampMs || timestampMs <= 0) return 'Leído'
  const diffMs = Date.now() - timestampMs
  if (diffMs < 60_000) return 'Ahora mismo'
  const mins = Math.floor(diffMs / 60_000)
  if (mins < 60) return `Hace ${mins} min`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `Hace ${hours} h`
  const days = Math.floor(hours / 24)
  if (days === 1) return 'Ayer'
  if (days < 7) return `Hace ${days} días`

  try {
    return new Intl.DateTimeFormat('es-ES', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit'
    }).format(new Date(timestampMs))
  } catch {
    return new Date(timestampMs).toLocaleDateString()
  }
}

export function formatExactReadTime(timestampMs?: number): string {
  if (!timestampMs || timestampMs <= 0) return ''
  try {
    return new Intl.DateTimeFormat('es-ES', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(new Date(timestampMs))
  } catch {
    return new Date(timestampMs).toLocaleString()
  }
}
