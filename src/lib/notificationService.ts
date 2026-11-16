import { toast } from 'sonner'
import {
  db,
  type NotificationItem,
  type NotificationSeverity,
  type NotificationType,
  type NotificationActionPayload
} from '../db'
import { getCurrentMember, TEAM_MEMBERS } from './teamAuth'
import { triggerRemoteWebPush } from './webPush'

export type NotificationCategory = 'collaboration' | 'reminders' | 'sync' | 'system'

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
}

export const NOTIFICATION_ACTION_EVENT = 'seven_note_notification_action'
export const NOTIFICATION_CHANGED_EVENT = 'seven_note_notification_changed'

const PREFS_STORAGE_KEY = 'seven_note_notification_prefs_v1'
const DEFAULT_DEDUPE_WINDOW_MS = 5 * 60 * 1000
const MAX_STORED_NOTIFICATIONS = 250

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
    case 'workspace_update':
      return 'collaboration'
    case 'reminder':
      return 'reminders'
    case 'sync':
      return 'sync'
    case 'system':
    default:
      return 'system'
  }
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
    if (typeof window === 'undefined') return { ...DEFAULT_PREFERENCES }
    try {
      const raw = localStorage.getItem(PREFS_STORAGE_KEY)
      if (!raw) return { ...DEFAULT_PREFERENCES }
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
      return { ...DEFAULT_PREFERENCES }
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

  public triggerAction(item: Pick<NotificationItem, 'id' | 'actionPayload' | 'workspaceId' | 'spaceId' | 'nodeId'>) {
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
        window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
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
      syncStatus: 'pending'
    }

    try {
      await db.notifications.put(item)
      void this.pruneOldNotifications()
    } catch (e) {
      console.warn('Error persisting notification', e)
    }

    this.emitChange()

    const silenced = this.isSilenced()
    if (!input.silent && (!silenced || input.force)) {
      this.dispatchToast(item)
      this.playSound(item.severity)
      void this.dispatchDesktopNotification(item)
    }

    if (
      item.type === 'mention' ||
      item.type === 'comment' ||
      item.type === 'assignment'
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
    const now = Date.now()
    await db.notifications.update(id, {
      isRead: true,
      readAt: now,
      snoozedUntil: undefined,
      updatedAt: now,
      syncStatus: 'pending'
    })
    this.emitChange()
  }

  public async markAsUnread(id: string): Promise<void> {
    if (!id) return
    await db.notifications.update(id, {
      isRead: false,
      readAt: undefined,
      updatedAt: Date.now(),
      syncStatus: 'pending'
    })
    this.emitChange()
  }

  public async markAllAsRead(): Promise<void> {
    const now = Date.now()
    const unread = await db.notifications.filter((n) => !n.isRead && !n.isArchived).toArray()
    if (unread.length === 0) return
    await Promise.all(
      unread.map((n) =>
        db.notifications.update(n.id, {
          isRead: true,
          readAt: now,
          updatedAt: now,
          syncStatus: 'pending'
        })
      )
    )
    this.emitChange()
  }

  public async archiveNotification(id: string): Promise<void> {
    if (!id) return
    await db.notifications.update(id, {
      isArchived: true,
      isRead: true,
      updatedAt: Date.now(),
      syncStatus: 'pending'
    })
    this.emitChange()
  }

  public async clearReadNotifications(): Promise<void> {
    const now = Date.now()
    const readItems = await db.notifications.filter((n) => n.isRead && !n.isArchived).toArray()
    if (readItems.length === 0) return
    await Promise.all(
      readItems.map((n) =>
        db.notifications.update(n.id, {
          isArchived: true,
          updatedAt: now,
          syncStatus: 'pending'
        })
      )
    )
    this.emitChange()
  }

  public async snoozeNotification(id: string, durationMs: number): Promise<void> {
    if (!id) return
    const now = Date.now()
    await db.notifications.update(id, {
      isRead: true,
      snoozedUntil: now + durationMs,
      updatedAt: now,
      syncStatus: 'pending'
    })
    this.emitChange()
    toast.success('Notificación pospuesta')
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
      force: true
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

      for (const n of dueSnoozed) {
        await db.notifications.update(n.id, {
          isRead: false,
          snoozedUntil: undefined,
          updatedAt: now,
          syncStatus: 'pending'
        })
        if (!this.isSilenced()) {
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

      const workspaces = await db.workspaces
        .filter((w) => !w.isDeleted && Boolean(w.databaseData?.enabled) && Array.isArray(w.databaseData?.items))
        .toArray()

      for (const ws of workspaces) {
        const items = ws.databaseData?.items || []
        for (const item of items) {
          if (!item.date || item.completed || item.status === 'Completado') continue
          const isDueToday = item.date === todayStr
          const isOverdue = item.date < todayStr

          if (!isDueToday && !isOverdue) continue

          await this.notify({
            type: 'reminder',
            severity: isOverdue ? 'warning' : 'info',
            title: isOverdue ? `Tarea vencida: ${item.title}` : `Vence hoy: ${item.title}`,
            message: `En "${ws.title || 'Sin título'}" · Fecha límite ${item.date}`,
            workspaceId: ws.id,
            spaceId: ws.spaceId,
            actionLabel: 'Abrir nota',
            actionPayload: { type: 'open_workspace', workspaceId: ws.id },
            dedupeKey: `reminder:${ws.id}:${item.id}:${todayStr}`,
            dedupeWindowMs: 24 * 60 * 60 * 1000
          })
        }
      }
    } catch (e) {
      console.warn('Error checking due date reminders', e)
    }
  }
}

export const notificationService = new NotificationService()
