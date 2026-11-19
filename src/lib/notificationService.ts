import { toast } from 'sonner'
import {
  db,
  type NotificationItem,
  type NotificationSeverity,
  type NotificationType,
  type NotificationActionPayload,
  type WorkspaceItem
} from '../db'
import {
  getCurrentMember,
  TEAM_MEMBERS,
  isWorkspaceOwner,
  type TeamMember,
  type UserProfile
} from './teamAuth'
import { triggerRemoteWebPush } from './webPush'

export type NotificationCategory = 'collaboration' | 'activity' | 'reminders' | 'sync' | 'system'

export interface NotificationPreferences {
  toastsEnabled: boolean
  desktopEnabled: boolean
  desktopOnlyWhenHidden: boolean
  soundEnabled: boolean
  dndEnabled: boolean
  quietHoursEnabled: boolean
  quietHoursStart: string // HH:mm
  quietHoursEnd: string // HH:mm
  categories: Record<NotificationCategory, boolean>
}

export interface NotifyInput {
  type: NotificationType
  severity?: NotificationSeverity
  title: string
  message: string
  workspaceId?: string
  spaceId?: string
  nodeId?: string
  actorId?: string
  actorName?: string
  recipientId?: string
  actionLabel?: string
  actionPayload?: NotificationActionPayload
  dedupeKey?: string
  dedupeWindowMs?: number
  /** If true, persists to inbox without popping a toast/desktop alert */
  silent?: boolean
  /** If true, bypasses category mute (e.g., explicit user test) */
  force?: boolean
  /** If true, keeps notification purely local (syncStatus = 'synced', never pushed to Supabase) */
  localOnly?: boolean
}

export interface ResolvedActorProfile {
  name: string
  initial: string
  color: string
  avatarUrl?: string
}

export const NOTIFICATION_ACTION_EVENT = 'seven_note_notification_action'
export const NOTIFICATION_CHANGED_EVENT = 'seven_note_notification_changed'

const PREFS_STORAGE_KEY = 'seven_note_notification_prefs_v1'
const DEFAULT_DEDUPE_WINDOW_MS = 5 * 60 * 1000
const MAX_STORED_NOTIFICATIONS = 250

const GENERIC_ACTOR_PLACEHOLDERS = new Set([
  'un miembro',
  'alguien',
  'usuario',
  'un compañero',
  'equipo'
])

const DEFAULT_PREFERENCES: NotificationPreferences = {
  toastsEnabled: true,
  desktopEnabled: true,
  desktopOnlyWhenHidden: true,
  soundEnabled: true,
  dndEnabled: false,
  quietHoursEnabled: false,
  quietHoursStart: '22:00',
  quietHoursEnd: '08:00',
  categories: {
    collaboration: true,
    activity: true,
    reminders: true,
    sync: true,
    system: true
  }
}

export function getNotificationCategory(type: NotificationType): NotificationCategory {
  switch (type) {
    case 'mention':
    case 'comment':
    case 'assignment':
      return 'collaboration'
    case 'workspace_update':
      return 'activity'
    case 'reminder':
      return 'reminders'
    case 'sync':
      return 'sync'
    case 'system':
    default:
      return 'system'
  }
}

export function isSyncableNotificationType(type: NotificationType): boolean {
  return type === 'mention' || type === 'comment' || type === 'assignment'
}

export function shouldSyncNotificationStateUpdate(
  item: Pick<NotificationItem, 'type' | 'recipientId' | 'dedupeKey'>
): boolean {
  return (
    isSyncableNotificationType(item.type) &&
    !item.dedupeKey?.startsWith('comment-node:') &&
    Boolean(item.recipientId) &&
    item.recipientId !== 'all'
  )
}

export function getMemberIdentifiers(
  member?: TeamMember | UserProfile | null,
  authUserId?: string | null
): Set<string> {
  const ids = new Set<string>()
  const add = (val?: string | null) => {
    const clean = val?.toLowerCase().trim()
    if (clean) ids.add(clean)
  }

  add(authUserId)
  if (member) {
    add(member.id)
    add((member as TeamMember).name)
    add(member.fullName)
    add(member.email)

    const memberEmail = member.email?.toLowerCase().trim()
    const memberId = member.id?.toLowerCase().trim()
    const memberName = ((member as TeamMember).name || member.fullName || '').toLowerCase().trim()

    for (const preset of TEAM_MEMBERS) {
      const matchesPreset =
        (memberId && preset.id.toLowerCase() === memberId) ||
        (memberEmail && preset.email?.toLowerCase() === memberEmail) ||
        (memberName && preset.name.toLowerCase() === memberName)
      if (matchesPreset) {
        add(preset.id)
        add(preset.name)
        add(preset.fullName)
        add(preset.email)
      }
    }
  }

  return ids
}

export function isNotificationAuthoredByMember(
  item: NotificationItem,
  member?: TeamMember | UserProfile | null,
  authUserId?: string | null
): boolean {
  if (item.type === 'system' || item.type === 'reminder' || item.type === 'sync') {
    return false
  }
  const ids = getMemberIdentifiers(member, authUserId)
  if (ids.size === 0) return false

  const actorId = item.actorId?.toLowerCase().trim()
  const actorName = item.actorName?.toLowerCase().trim()
  if (actorId && ids.has(actorId)) return true
  if (actorName && ids.has(actorName)) return true

  // Legacy fallback for workspace_update rows persisted without actorId/actorName match
  if (item.type === 'workspace_update' && item.message) {
    const msgLower = item.message.toLowerCase().trim()
    for (const ident of ids) {
      if (msgLower.startsWith(`${ident} creó `)) {
        return true
      }
    }
  }

  return false
}

export function isNotificationForMember(
  item: NotificationItem,
  member?: TeamMember | UserProfile | null,
  authUserId?: string | null
): boolean {
  if (isNotificationAuthoredByMember(item, member, authUserId)) {
    return false
  }
  if (!item.recipientId || item.recipientId === 'all') {
    return true
  }
  const ids = getMemberIdentifiers(member, authUserId)
  if (ids.size === 0) return false
  return ids.has(item.recipientId.toLowerCase().trim())
}

export function resolveActorProfile(
  actorId?: string,
  actorName?: string,
  profiles?: UserProfile[]
): ResolvedActorProfile {
  const cleanId = actorId?.trim()
  const cleanNameRaw = actorName?.trim()
  const cleanName =
    cleanNameRaw && !GENERIC_ACTOR_PLACEHOLDERS.has(cleanNameRaw.toLowerCase())
      ? cleanNameRaw
      : undefined

  const idLower = cleanId?.toLowerCase()
  const nameLower = cleanName?.toLowerCase()

  if (profiles && profiles.length > 0) {
    const matchedProfile = profiles.find((p) => {
      const pId = p.id?.toLowerCase().trim()
      const pEmail = p.email?.toLowerCase().trim()
      const pName = p.fullName?.toLowerCase().trim()
      return (
        (idLower && (pId === idLower || pEmail === idLower || pName === idLower)) ||
        (nameLower && (pName === nameLower || pEmail === nameLower || pId === nameLower))
      )
    })
    if (matchedProfile) {
      const displayName = matchedProfile.fullName?.trim() || cleanName || 'Equipo'
      return {
        name: displayName,
        initial: matchedProfile.initial || displayName.charAt(0).toUpperCase() || 'E',
        color: matchedProfile.color || '#2563eb',
        avatarUrl: matchedProfile.avatarUrl
      }
    }
  }

  const matchedPreset = TEAM_MEMBERS.find((m) => {
    const mId = m.id.toLowerCase()
    const mName = m.name.toLowerCase()
    const mEmail = m.email?.toLowerCase()
    return (
      (idLower && (mId === idLower || mName === idLower || mEmail === idLower)) ||
      (nameLower && (mName === nameLower || mId === nameLower || mEmail === nameLower))
    )
  })

  if (matchedPreset) {
    return {
      name: matchedPreset.name,
      initial: matchedPreset.initial,
      color: matchedPreset.color,
      avatarUrl: matchedPreset.avatarUrl
    }
  }

  const fallbackName = cleanName || 'Equipo'
  return {
    name: fallbackName,
    initial: fallbackName.charAt(0).toUpperCase() || 'E',
    color: '#6b7280'
  }
}

export function extractNoteTitleFromLegacyMessage(message?: string): string | null {
  if (!message) return null
  const createdMatch = message.match(/creó\s+["“«]([^"”»]+)["”»]/i)
  if (createdMatch?.[1]) return createdMatch[1].trim()
  const quotedMatch = message.match(/["“«]([^"”»]+)["”»]/)
  if (quotedMatch?.[1]) return quotedMatch[1].trim()
  return null
}

export interface PartitionedNotifications {
  active: NotificationItem[]
  snoozed: NotificationItem[]
  archived: NotificationItem[]
}

export function partitionMemberNotifications(
  rows: NotificationItem[],
  workspaceMap: Map<string, WorkspaceItem>,
  member?: TeamMember | UserProfile | null,
  authUserId?: string | null,
  now = Date.now()
): PartitionedNotifications {
  const active: NotificationItem[] = []
  const snoozed: NotificationItem[] = []
  const archived: NotificationItem[] = []
  const seenWorkspaceUpdates = new Set<string>()
  const teamMemberArg: TeamMember | null | undefined = member
    ? 'name' in member
      ? member
      : { ...member, name: member.fullName, icon: '👤' }
    : member

  const sorted = [...rows].sort((a, b) => b.createdAt - a.createdAt)

  for (const item of sorted) {
    if (!isNotificationForMember(item, member, authUserId)) continue

    if (item.type === 'workspace_update' && item.workspaceId) {
      const ws = workspaceMap.get(item.workspaceId)
      if (ws && isWorkspaceOwner(ws, teamMemberArg, authUserId || undefined)) {
        continue
      }
      if (seenWorkspaceUpdates.has(item.workspaceId)) {
        continue
      }
      seenWorkspaceUpdates.add(item.workspaceId)
    }

    if (item.isArchived) {
      archived.push(item)
    } else if (typeof item.snoozedUntil === 'number' && item.snoozedUntil > now) {
      snoozed.push(item)
    } else {
      active.push(item)
    }
  }

  snoozed.sort((a, b) => (a.snoozedUntil || 0) - (b.snoozedUntil || 0))
  return { active, snoozed, archived }
}

export function extractMentions(text: string): string[] {
  if (!text) return []
  const matches = text.match(/@([a-zA-Z0-9_.-]+)/g) || []
  const normalized = new Set<string>()
  for (const raw of matches) {
    const handle = raw.slice(1).toLowerCase().trim()
    if (!handle) continue
    if (handle === 'all' || handle === 'todos') {
      normalized.add('all')
      continue
    }
    const member = TEAM_MEMBERS.find(
      (m) => m.id.toLowerCase() === handle || m.name.toLowerCase() === handle
    )
    if (member) {
      normalized.add(member.id)
    } else {
      normalized.add(handle)
    }
  }
  return Array.from(normalized)
}

class NotificationService {
  private prefs: NotificationPreferences
  private prefsListeners = new Set<(prefs: NotificationPreferences) => void>()
  private schedulerInterval: ReturnType<typeof setInterval> | null = null
  private startupTimeout: ReturnType<typeof setTimeout> | null = null
  private broadcastChannel: BroadcastChannel | null = null
  private audioCtx: AudioContext | null = null
  private recentDedupeCache = new Map<string, number>()

  constructor() {
    this.prefs = this.loadPreferences()
    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      try {
        this.broadcastChannel = new BroadcastChannel('seven_note_notifications')
        this.broadcastChannel.onmessage = () => {
          window.dispatchEvent(new CustomEvent(NOTIFICATION_CHANGED_EVENT))
        }
      } catch {
        // BroadcastChannel not available in some restricted contexts
      }
    }
  }

  private loadPreferences(): NotificationPreferences {
    if (typeof window === 'undefined') {
      return { ...DEFAULT_PREFERENCES, categories: { ...DEFAULT_PREFERENCES.categories } }
    }
    try {
      const raw = localStorage.getItem(PREFS_STORAGE_KEY)
      if (!raw) {
        return { ...DEFAULT_PREFERENCES, categories: { ...DEFAULT_PREFERENCES.categories } }
      }
      const parsed = JSON.parse(raw)
      return {
        ...DEFAULT_PREFERENCES,
        ...parsed,
        categories: {
          ...DEFAULT_PREFERENCES.categories,
          ...(parsed.categories || {})
        }
      }
    } catch {
      return { ...DEFAULT_PREFERENCES, categories: { ...DEFAULT_PREFERENCES.categories } }
    }
  }

  public getPreferences(): NotificationPreferences {
    return {
      ...this.prefs,
      categories: { ...this.prefs.categories }
    }
  }

  public updatePreferences(partial: Partial<NotificationPreferences>): NotificationPreferences {
    this.prefs = {
      ...this.prefs,
      ...partial,
      categories: {
        ...this.prefs.categories,
        ...(partial.categories || {})
      }
    }
    try {
      localStorage.setItem(PREFS_STORAGE_KEY, JSON.stringify(this.prefs))
    } catch {
      // ignore storage quota errors
    }
    const snapshot = this.getPreferences()
    this.prefsListeners.forEach((fn) => fn(snapshot))
    return snapshot
  }

  public subscribeToPreferences(fn: (prefs: NotificationPreferences) => void): () => void {
    this.prefsListeners.add(fn)
    fn(this.getPreferences())
    return () => {
      this.prefsListeners.delete(fn)
    }
  }

  public isInQuietHours(now = new Date()): boolean {
    if (!this.prefs.quietHoursEnabled) return false
    const parseTime = (hhmm: string) => {
      const [h, m] = (hhmm || '00:00').split(':').map((n) => parseInt(n, 10) || 0)
      return h * 60 + m
    }
    const current = now.getHours() * 60 + now.getMinutes()
    const start = parseTime(this.prefs.quietHoursStart)
    const end = parseTime(this.prefs.quietHoursEnd)

    if (start === end) return false
    if (start < end) {
      return current >= start && current < end
    }
    // Overnight range (e.g. 22:00 -> 08:00)
    return current >= start || current < end
  }

  public isSilenced(): boolean {
    return this.prefs.dndEnabled || this.isInQuietHours()
  }

  public getDesktopPermission(): NotificationPermission | 'unsupported' {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      return 'unsupported'
    }
    return Notification.permission
  }

  public async requestDesktopPermission(): Promise<NotificationPermission | 'unsupported'> {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      return 'unsupported'
    }
    try {
      const res = await Notification.requestPermission()
      if (res === 'granted') {
        this.updatePreferences({ desktopEnabled: true })
      }
      return res
    } catch {
      return Notification.permission
    }
  }

  private emitChange() {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent(NOTIFICATION_CHANGED_EVENT))
    }
    try {
      this.broadcastChannel?.postMessage({ type: 'changed', ts: Date.now() })
    } catch {
      // ignore
    }
  }

  public triggerAction(
    item: Pick<NotificationItem, 'id' | 'actionPayload' | 'workspaceId' | 'spaceId' | 'nodeId'>
  ) {
    if (typeof window === 'undefined') return
    const payload: NotificationActionPayload = item.actionPayload || {
      type: item.workspaceId ? 'open_workspace' : 'custom',
      workspaceId: item.workspaceId,
      spaceId: item.spaceId,
      nodeId: item.nodeId
    }
    window.dispatchEvent(
      new CustomEvent(NOTIFICATION_ACTION_EVENT, {
        detail: { notificationId: item.id, payload }
      })
    )
    void this.markAsRead(item.id)
  }

  private playSound(severity: NotificationSeverity) {
    if (!this.prefs.soundEnabled || typeof window === 'undefined') return
    try {
      const AudioContextCtor =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
      if (!AudioContextCtor) return
      if (!this.audioCtx) {
        this.audioCtx = new AudioContextCtor()
      }
      const ctx = this.audioCtx
      if (ctx.state === 'suspended') {
        void ctx.resume().catch(() => {})
      }

      const now = ctx.currentTime
      const gain = ctx.createGain()
      gain.connect(ctx.destination)
      gain.gain.setValueAtTime(0.001, now)
      gain.gain.exponentialRampToValueAtTime(0.06, now + 0.02)
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.28)

      const osc = ctx.createOscillator()
      osc.type = severity === 'error' || severity === 'warning' ? 'triangle' : 'sine'
      const firstFreq = severity === 'error' ? 440 : severity === 'warning' ? 523.25 : 659.25
      const secondFreq = severity === 'error' ? 349.23 : severity === 'warning' ? 659.25 : 880

      osc.frequency.setValueAtTime(firstFreq, now)
      osc.frequency.setValueAtTime(secondFreq, now + 0.09)
      osc.connect(gain)
      osc.start(now)
      osc.stop(now + 0.3)
    } catch {
      // Ignore audio errors when autoplay is blocked
    }
  }

  private dispatchToast(item: NotificationItem) {
    if (!this.prefs.toastsEnabled) return
    const hasAction = Boolean(item.actionLabel && (item.actionPayload || item.workspaceId))
    const options: Parameters<typeof toast>[1] = {
      id: item.dedupeKey || item.id,
      description: item.message,
      duration: item.severity === 'error' ? 6500 : 4500,
      action: hasAction
        ? {
            label: item.actionLabel!,
            onClick: () => this.triggerAction(item)
          }
        : undefined
    }

    switch (item.severity) {
      case 'success':
        toast.success(item.title, options)
        break
      case 'warning':
        toast.warning(item.title, options)
        break
      case 'error':
        toast.error(item.title, options)
        break
      default:
        toast.info(item.title, options)
        break
    }
  }

  private async dispatchDesktopNotification(item: NotificationItem) {
    if (!this.prefs.desktopEnabled || typeof window === 'undefined') return
    if (this.prefs.desktopOnlyWhenHidden && document.visibilityState === 'visible' && document.hasFocus()) {
      return
    }
    if (!('Notification' in window) || Notification.permission !== 'granted') {
      return
    }

    const title = item.title
    const options: NotificationOptions = {
      body: item.message,
      icon: '/app-logo-dark.png',
      badge: '/app-logo-dark.png',
      tag: item.dedupeKey || item.id,
      silent: !this.prefs.soundEnabled
    }

    try {
      const notif = new Notification(title, options)
      notif.onclick = () => {
        window.focus()
        this.triggerAction(item)
        notif.close()
      }
      return
    } catch {
      // Fallback to Service Worker registration (required on some mobile browsers)
    }

    if ('serviceWorker' in navigator) {
      try {
        const reg = await navigator.serviceWorker.ready
        await reg.showNotification(title, options)
      } catch {
        // ignore SW notification failure
      }
    }
  }

  public deliverPulledNotification(item: NotificationItem): void {
    const category = getNotificationCategory(item.type)
    if (!this.prefs.categories[category]) return
    if (this.isSilenced()) return
    if (!isNotificationForMember(item, getCurrentMember())) return

    this.dispatchToast(item)
    this.playSound(item.severity)
    void this.dispatchDesktopNotification(item)
  }

  public dispatchBatchSummaryToast(count: number, description: string): void {
    if (!this.prefs.categories.activity || !this.prefs.toastsEnabled || this.isSilenced()) {
      return
    }
    toast.info(
      count === 1 ? '1 nueva nota del equipo' : `${count} nuevas notas compartidas`,
      {
        id: 'workspace-batch-sync',
        description,
        duration: 5000,
        action: {
          label: 'Ver bandeja',
          onClick: () => {
            if (typeof window !== 'undefined') {
              window.dispatchEvent(
                new CustomEvent(NOTIFICATION_ACTION_EVENT, {
                  detail: { payload: { type: 'open_notifications' } }
                })
              )
            }
          }
        }
      }
    )
    this.playSound('info')
  }

  public async notify(input: NotifyInput): Promise<NotificationItem | null> {
    const category = getNotificationCategory(input.type)
    if (!input.force && !this.prefs.categories[category]) {
      return null
    }

    const now = Date.now()
    const windowMs = input.dedupeWindowMs ?? DEFAULT_DEDUPE_WINDOW_MS

    if (input.dedupeKey) {
      const cachedAt = this.recentDedupeCache.get(input.dedupeKey)
      if (cachedAt && now - cachedAt < windowMs) {
        return null
      }

      try {
        const existing = await db.notifications
          .where('dedupeKey')
          .equals(input.dedupeKey)
          .filter((n) => !n.isArchived && now - n.createdAt < windowMs)
          .first()
        if (existing) {
          this.recentDedupeCache.set(input.dedupeKey, existing.createdAt)
          return existing
        }
      } catch {
        // continue if index lookup fails
      }
      this.recentDedupeCache.set(input.dedupeKey, now)
    }

    const syncable = !input.localOnly && isSyncableNotificationType(input.type)

    const item: NotificationItem = {
      id: crypto.randomUUID(),
      type: input.type,
      severity: input.severity || 'info',
      title: input.title,
      message: input.message,
      workspaceId: input.workspaceId,
      spaceId: input.spaceId,
      nodeId: input.nodeId,
      actorId: input.actorId,
      actorName: input.actorName,
      recipientId: input.recipientId || 'all',
      actionLabel: input.actionLabel,
      actionPayload: input.actionPayload,
      dedupeKey: input.dedupeKey,
      isRead: false,
      isArchived: false,
      createdAt: now,
      updatedAt: now,
      syncStatus: syncable ? 'pending' : 'synced'
    }

    try {
      await db.notifications.put(item)
      void this.pruneOldNotifications()
    } catch (e) {
      console.warn('Error persisting notification', e)
    }

    this.emitChange()

    const silenced = this.isSilenced()
    const isForSelf = input.force || isNotificationForMember(item, getCurrentMember())
    if (isForSelf && !input.silent && (!silenced || input.force)) {
      this.dispatchToast(item)
      this.playSound(item.severity)
      void this.dispatchDesktopNotification(item)
    }

    if (
      !input.localOnly &&
      (item.type === 'mention' ||
        item.type === 'comment' ||
        item.type === 'assignment')
    ) {
      void triggerRemoteWebPush({
        title: item.title,
        message: item.message,
        workspaceId: item.workspaceId,
        nodeId: item.nodeId,
        recipientId: item.recipientId
      })
    }

    return item
  }

  private async pruneOldNotifications() {
    try {
      const total = await db.notifications.count()
      if (total <= MAX_STORED_NOTIFICATIONS) return
      const all = await db.notifications.orderBy('createdAt').toArray()
      const excess = all.length - MAX_STORED_NOTIFICATIONS
      if (excess > 0) {
        const toDelete = all
          .filter((n) => n.isArchived || n.isRead)
          .slice(0, excess)
          .map((n) => n.id)
        if (toDelete.length > 0) {
          await db.notifications.bulkDelete(toDelete)
        }
      }
    } catch {
      // ignore pruning error
    }
  }

  public async markAsRead(id: string): Promise<void> {
    if (!id) return
    const existing = await db.notifications.get(id)
    if (!existing) return
    const now = Date.now()
    await db.notifications.update(id, {
      isRead: true,
      readAt: now,
      snoozedUntil: undefined,
      updatedAt: now,
      syncStatus: shouldSyncNotificationStateUpdate(existing) ? 'pending' : 'synced'
    })
    this.emitChange()
  }

  public async markAsUnread(id: string): Promise<void> {
    if (!id) return
    const existing = await db.notifications.get(id)
    if (!existing) return
    await db.notifications.update(id, {
      isRead: false,
      readAt: undefined,
      updatedAt: Date.now(),
      syncStatus: shouldSyncNotificationStateUpdate(existing) ? 'pending' : 'synced'
    })
    this.emitChange()
  }

  public async markNotificationsAsRead(ids: string[]): Promise<void> {
    const uniqueIds = Array.from(new Set(ids.filter(Boolean)))
    if (uniqueIds.length === 0) return
    const rows = (await db.notifications.bulkGet(uniqueIds)).filter(
      (n): n is NotificationItem => Boolean(n && !n.isRead && !n.isArchived)
    )
    if (rows.length === 0) return
    const now = Date.now()
    await db.notifications.bulkUpdate(
      rows.map((n) => ({
        key: n.id,
        changes: {
          isRead: true,
          readAt: now,
          snoozedUntil: undefined,
          updatedAt: now,
          syncStatus: shouldSyncNotificationStateUpdate(n) ? ('pending' as const) : ('synced' as const)
        }
      }))
    )
    this.emitChange()
  }

  public async markAllAsRead(
    member?: TeamMember | null,
    authUserId?: string | null
  ): Promise<number> {
    const activeMember = member === undefined ? getCurrentMember() : member
    const now = Date.now()
    const unread = await db.notifications
      .filter(
        (n) =>
          !n.isRead &&
          !n.isArchived &&
          !(n.snoozedUntil && n.snoozedUntil > now) &&
          isNotificationForMember(n, activeMember, authUserId)
      )
      .toArray()
    if (unread.length === 0) return 0
    await db.notifications.bulkUpdate(
      unread.map((n) => ({
        key: n.id,
        changes: {
          isRead: true,
          readAt: now,
          updatedAt: now,
          syncStatus: shouldSyncNotificationStateUpdate(n) ? ('pending' as const) : ('synced' as const)
        }
      }))
    )
    this.emitChange()
    return unread.length
  }

  public async archiveNotification(id: string): Promise<void> {
    if (!id) return
    const existing = await db.notifications.get(id)
    if (!existing) return
    await db.notifications.update(id, {
      isArchived: true,
      isRead: true,
      snoozedUntil: undefined,
      updatedAt: Date.now(),
      syncStatus: shouldSyncNotificationStateUpdate(existing) ? 'pending' : 'synced'
    })
    this.emitChange()
  }

  public async unarchiveNotification(id: string): Promise<void> {
    if (!id) return
    const existing = await db.notifications.get(id)
    if (!existing) return
    await db.notifications.update(id, {
      isArchived: false,
      updatedAt: Date.now(),
      syncStatus: shouldSyncNotificationStateUpdate(existing) ? 'pending' : 'synced'
    })
    this.emitChange()
  }

  public async archiveNotifications(ids: string[]): Promise<string[]> {
    const uniqueIds = Array.from(new Set(ids.filter(Boolean)))
    if (uniqueIds.length === 0) return []
    const rows = (await db.notifications.bulkGet(uniqueIds)).filter(
      (n): n is NotificationItem => Boolean(n && !n.isArchived)
    )
    if (rows.length === 0) return []
    const now = Date.now()
    await db.notifications.bulkUpdate(
      rows.map((n) => ({
        key: n.id,
        changes: {
          isArchived: true,
          isRead: true,
          snoozedUntil: undefined,
          updatedAt: now,
          syncStatus: shouldSyncNotificationStateUpdate(n) ? ('pending' as const) : ('synced' as const)
        }
      }))
    )
    this.emitChange()
    return rows.map((n) => n.id)
  }

  public async restoreNotifications(ids: string[]): Promise<void> {
    const uniqueIds = Array.from(new Set(ids.filter(Boolean)))
    if (uniqueIds.length === 0) return
    const rows = (await db.notifications.bulkGet(uniqueIds)).filter(
      (n): n is NotificationItem => Boolean(n && n.isArchived)
    )
    if (rows.length === 0) return
    const now = Date.now()
    await db.notifications.bulkUpdate(
      rows.map((n) => ({
        key: n.id,
        changes: {
          isArchived: false,
          updatedAt: now,
          syncStatus: shouldSyncNotificationStateUpdate(n) ? ('pending' as const) : ('synced' as const)
        }
      }))
    )
    this.emitChange()
  }

  public async clearReadNotifications(
    member?: TeamMember | null,
    authUserId?: string | null
  ): Promise<string[]> {
    const activeMember = member === undefined ? getCurrentMember() : member
    const now = Date.now()
    const readItems = await db.notifications
      .filter(
        (n) =>
          n.isRead &&
          !n.isArchived &&
          !(n.snoozedUntil && n.snoozedUntil > now) &&
          isNotificationForMember(n, activeMember, authUserId)
      )
      .toArray()
    if (readItems.length === 0) return []
    await db.notifications.bulkUpdate(
      readItems.map((n) => ({
        key: n.id,
        changes: {
          isArchived: true,
          updatedAt: now,
          syncStatus: shouldSyncNotificationStateUpdate(n) ? ('pending' as const) : ('synced' as const)
        }
      }))
    )
    this.emitChange()
    return readItems.map((n) => n.id)
  }

  public async deleteArchivedNotifications(
    member?: TeamMember | null,
    authUserId?: string | null
  ): Promise<number> {
    const activeMember = member === undefined ? getCurrentMember() : member
    const archived = await db.notifications
      .filter(
        (n) =>
          n.isArchived &&
          (!shouldSyncNotificationStateUpdate(n) ||
            isNotificationForMember(n, activeMember, authUserId) ||
            isNotificationAuthoredByMember(n, activeMember, authUserId))
      )
      .toArray()
    if (archived.length === 0) return 0
    await db.notifications.bulkDelete(archived.map((n) => n.id))
    this.emitChange()
    return archived.length
  }

  public async snoozeNotificationUntil(
    id: string,
    untilTs: number,
    label?: string
  ): Promise<void> {
    if (!id) return
    const existing = await db.notifications.get(id)
    if (!existing) return
    const now = Date.now()
    await db.notifications.update(id, {
      isRead: true,
      snoozedUntil: untilTs,
      updatedAt: now,
      syncStatus: shouldSyncNotificationStateUpdate(existing) ? 'pending' : 'synced'
    })
    this.emitChange()
    toast.success(label ? `Pospuesta · ${label}` : 'Notificación pospuesta', {
      action: {
        label: 'Deshacer',
        onClick: () => void this.unsnoozeNotification(id)
      }
    })
  }

  public async snoozeNotification(
    id: string,
    durationMs: number,
    label?: string
  ): Promise<void> {
    await this.snoozeNotificationUntil(id, Date.now() + durationMs, label)
  }

  public async unsnoozeNotification(id: string): Promise<void> {
    if (!id) return
    const existing = await db.notifications.get(id)
    if (!existing) return
    await db.notifications.update(id, {
      isRead: false,
      snoozedUntil: undefined,
      updatedAt: Date.now(),
      syncStatus: shouldSyncNotificationStateUpdate(existing) ? 'pending' : 'synced'
    })
    this.emitChange()
  }

  public async unsnoozeAll(
    member?: TeamMember | null,
    authUserId?: string | null
  ): Promise<number> {
    const activeMember = member === undefined ? getCurrentMember() : member
    const now = Date.now()
    const snoozed = await db.notifications
      .filter(
        (n) =>
          !n.isArchived &&
          typeof n.snoozedUntil === 'number' &&
          n.snoozedUntil > now &&
          isNotificationForMember(n, activeMember, authUserId)
      )
      .toArray()
    if (snoozed.length === 0) return 0
    await db.notifications.bulkUpdate(
      snoozed.map((n) => ({
        key: n.id,
        changes: {
          isRead: false,
          snoozedUntil: undefined,
          updatedAt: now,
          syncStatus: shouldSyncNotificationStateUpdate(n) ? ('pending' as const) : ('synced' as const)
        }
      }))
    )
    this.emitChange()
    return snoozed.length
  }

  public async sendTestNotification(): Promise<void> {
    const member = getCurrentMember()
    await this.notify({
      type: 'system',
      severity: 'success',
      title: 'Notificaciones activas en Seven Note',
      message: `Todo listo, ${member?.name || 'equipo'}. Las alertas en app, sonido y escritorio están operativas.`,
      actionLabel: 'Ajustes',
      actionPayload: { type: 'open_settings' },
      force: true,
      localOnly: true
    })
  }

  public startSchedulers() {
    this.stopSchedulers()
    if (typeof window === 'undefined') return

    this.startupTimeout = setTimeout(() => {
      void this.runScheduledChecks()
    }, 3000)

    this.schedulerInterval = setInterval(() => {
      void this.runScheduledChecks()
    }, 60_000)

    window.addEventListener('focus', this.handleWindowFocus)
  }

  public stopSchedulers() {
    if (this.startupTimeout) {
      clearTimeout(this.startupTimeout)
      this.startupTimeout = null
    }
    if (this.schedulerInterval) {
      clearInterval(this.schedulerInterval)
      this.schedulerInterval = null
    }
    if (typeof window !== 'undefined') {
      window.removeEventListener('focus', this.handleWindowFocus)
    }
  }

  private handleWindowFocus = () => {
    void this.checkSnoozedNotifications()
  }

  public async runScheduledChecks() {
    await this.checkSnoozedNotifications()
    await this.checkDueDateReminders()
  }

  private async checkSnoozedNotifications() {
    try {
      const now = Date.now()
      const dueSnoozed = await db.notifications
        .filter((n) => !n.isArchived && typeof n.snoozedUntil === 'number' && n.snoozedUntil <= now)
        .toArray()

      const currentMember = getCurrentMember()
      for (const n of dueSnoozed) {
        await db.notifications.update(n.id, {
          isRead: false,
          snoozedUntil: undefined,
          updatedAt: now,
          syncStatus: shouldSyncNotificationStateUpdate(n) ? 'pending' : 'synced'
        })
        if (!this.isSilenced() && isNotificationForMember(n, currentMember)) {
          this.dispatchToast(n)
          this.playSound(n.severity)
          void this.dispatchDesktopNotification(n)
        }
      }

      if (dueSnoozed.length > 0) {
        this.emitChange()
      }
    } catch {
      // ignore
    }
  }

  private async checkDueDateReminders() {
    if (!this.prefs.categories.reminders) return
    try {
      const now = new Date()
      const todayStr = [
        now.getFullYear(),
        String(now.getMonth() + 1).padStart(2, '0'),
        String(now.getDate()).padStart(2, '0')
      ].join('-')
      const todayMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
      const memberIds = getMemberIdentifiers(getCurrentMember())

      const workspaces = await db.workspaces
        .filter((w) => !w.isDeleted && Boolean(w.databaseData?.enabled) && Array.isArray(w.databaseData?.items))
        .toArray()

      for (const ws of workspaces) {
        const items = ws.databaseData?.items || []
        for (const item of items) {
          if (!item.date || item.completed || item.status === 'Completado') continue
          if (item.assignee && !memberIds.has(item.assignee.toLowerCase().trim())) {
            continue
          }
          const isDueToday = item.date === todayStr
          const isOverdue = item.date < todayStr

          if (!isDueToday && !isOverdue) continue

          let statusText = 'Vence hoy'
          if (isOverdue) {
            const parts = item.date.split('-').map((p) => parseInt(p, 10))
            if (parts.length === 3 && parts.every((n) => Number.isFinite(n))) {
              const dueMidnight = new Date(parts[0], parts[1] - 1, parts[2]).getTime()
              const diffDays = Math.max(1, Math.round((todayMidnight - dueMidnight) / 86_400_000))
              statusText = diffDays === 1 ? 'Vencida hace 1 día' : `Vencida hace ${diffDays} días`
            } else {
              statusText = `Vencida (${item.date})`
            }
          }

          await this.notify({
            type: 'reminder',
            severity: isOverdue ? 'warning' : 'info',
            title: item.title,
            message: `En "${ws.title || 'Sin título'}" · ${statusText}`,
            workspaceId: ws.id,
            spaceId: ws.spaceId,
            actionLabel: 'Abrir tarea',
            actionPayload: { type: 'open_workspace', workspaceId: ws.id, spaceId: ws.spaceId },
            dedupeKey: `reminder:${ws.id}:${item.id}:${todayStr}`,
            dedupeWindowMs: 24 * 60 * 60 * 1000,
            localOnly: true
          })
        }
      }
    } catch (e) {
      console.warn('Error checking due date reminders', e)
    }
  }
}

export const notificationService = new NotificationService()
