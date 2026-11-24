import {
  useState,
  useMemo,
  useEffect,
  useRef,
  useCallback,
  type CSSProperties
} from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { AnimatePresence, motion } from 'motion/react'
import { toast } from '../../lib/toast'
import { UserAvatar } from '../ui/UserAvatar'
import {
  Archive,
  ArrowLeft,
  ArrowsClockwise,
  At,
  Bell,
  BellSlash,
  CalendarCheck,
  CaretDown,
  CaretRight,
  ChatCircleText,
  Check,
  CheckCircle,
  Checks,
  Clock,
  ClockCounterClockwise,
  Envelope,
  EnvelopeOpen,
  FileText,
  Funnel,
  Info,
  MagnifyingGlass,
  SlidersHorizontal,
  Trash,
  UserCheck,
  WarningCircle,
  X
} from '@phosphor-icons/react'
import { db, type NotificationItem, type SpaceItem, type WorkspaceItem } from '../../db'
import {
  notificationService,
  getNotificationCategory,
  partitionMemberNotifications,
  resolveActorProfile,
  extractNoteTitleFromLegacyMessage,
  type NotificationPreferences,
  type NotificationCategory,
  type ResolvedActorProfile
} from '../../lib/notificationService'
import { isSupabaseConfigured } from '../../lib/supabase'
import { refreshTeamProfiles, subscribeToTeamProfiles } from '../../lib/teamProfiles'
import { getCurrentMember, type TeamMember, type UserProfile } from '../../lib/teamAuth'

interface NotificationCenterProps {
  isOpen: boolean
  onClose: () => void
  onOpenSettings: () => void
  currentMember?: TeamMember | null
  authUserId?: string | null
  currentMemberId?: string
}

type InboxView = 'active' | 'snoozed' | 'archived'
type FilterTab = 'all' | 'unread' | 'collaboration' | 'reminders' | 'activity' | 'system'
type TimeBucket = 'Hoy' | 'Ayer' | 'Esta semana' | 'Anteriores'

interface EnrichedNotification {
  item: NotificationItem
  workspace?: WorkspaceItem
  space?: SpaceItem
  actor: ResolvedActorProfile
  noteTitle: string
  isDeletedTarget: boolean
  isNavigable: boolean
}

interface ActivityBundle {
  kind: 'bundle'
  id: string
  bucket: TimeBucket
  entries: EnrichedNotification[]
  actors: ResolvedActorProfile[]
  unreadCount: number
  newestCreatedAt: number
}

interface SingleEntry {
  kind: 'item'
  id: string
  entry: EnrichedNotification
}

type TimelineRow = ActivityBundle | SingleEntry

function formatCompactTime(ts: number, now: number): string {
  const diff = Math.max(0, now - ts)
  const mins = Math.floor(diff / 60_000)
  if (mins < 1) return 'ahora'
  if (mins < 60) return `${mins}m`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}d`
  return new Date(ts).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })
}

function formatFullDateTime(ts: number): string {
  return new Date(ts).toLocaleString('es-ES', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
}

function formatSnoozeWake(ts?: number, now = Date.now()): string {
  if (!ts) return 'Pospuesta'
  const date = new Date(ts)
  const current = new Date(now)
  const timeStr = date.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })
  const startOfToday = new Date(current.getFullYear(), current.getMonth(), current.getDate()).getTime()
  const startOfTarget = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime()
  const dayDiff = Math.round((startOfTarget - startOfToday) / 86_400_000)

  if (dayDiff === 0) return `Vuelve hoy · ${timeStr}`
  if (dayDiff === 1) return `Vuelve mañana · ${timeStr}`
  return `Vuelve ${date.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })} · ${timeStr}`
}

function getTimeBucket(ts: number, now: number): TimeBucket {
  const d = new Date(now)
  const todayStart = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
  const yesterdayStart = todayStart - 86_400_000
  const weekStart = todayStart - 6 * 86_400_000

  if (ts >= todayStart) return 'Hoy'
  if (ts >= yesterdayStart) return 'Ayer'
  if (ts >= weekStart) return 'Esta semana'
  return 'Anteriores'
}

function getSnoozePresets(nowMs = Date.now()) {
  const d = new Date(nowMs)
  const presets: Array<{ id: string; label: string; hint: string; until: number }> = [
    {
      id: '15m',
      label: 'En 15 minutos',
      hint: new Date(nowMs + 15 * 60_000).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }),
      until: nowMs + 15 * 60_000
    },
    {
      id: '1h',
      label: 'En 1 hora',
      hint: new Date(nowMs + 60 * 60_000).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }),
      until: nowMs + 60 * 60_000
    }
  ]

  if (d.getHours() < 17) {
    const evening = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 18, 0, 0, 0).getTime()
    presets.push({
      id: 'evening',
      label: 'Esta tarde',
      hint: '18:00',
      until: evening
    })
  } else {
    const threeHours = nowMs + 3 * 60 * 60_000
    presets.push({
      id: '3h',
      label: 'En 3 horas',
      hint: new Date(threeHours).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }),
      until: threeHours
    })
  }

  const tomorrow = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1, 9, 0, 0, 0)
  presets.push({
    id: 'tomorrow',
    label: 'Mañana',
    hint: '09:00',
    until: tomorrow.getTime()
  })

  const daysUntilMonday = (8 - d.getDay()) % 7 || 7
  const nextMonday = new Date(d.getFullYear(), d.getMonth(), d.getDate() + daysUntilMonday, 9, 0, 0, 0)
  presets.push({
    id: 'monday',
    label: 'Próximo lunes',
    hint: nextMonday.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' }),
    until: nextMonday.getTime()
  })

  return presets
}

function positionPopoverElement(triggerEl: HTMLElement | null, popoverEl: HTMLElement | null) {
  if (!triggerEl || !popoverEl || typeof window === 'undefined') return
  const supportsAnchor =
    typeof CSS !== 'undefined' &&
    typeof CSS.supports === 'function' &&
    CSS.supports('position-area: block-end')

  if (supportsAnchor) {
    popoverEl.classList.remove('sn-anchored-popover--js')
    popoverEl.style.top = ''
    popoverEl.style.left = ''
    return
  }

  popoverEl.classList.add('sn-anchored-popover--js')
  const triggerRect = triggerEl.getBoundingClientRect()
  const popRect = popoverEl.getBoundingClientRect()
  const margin = 8
  const gap = 6

  let top = triggerRect.bottom + gap
  if (top + popRect.height > window.innerHeight - margin) {
    const aboveTop = triggerRect.top - popRect.height - gap
    top = aboveTop >= margin ? aboveTop : Math.max(margin, window.innerHeight - popRect.height - margin)
  }

  let left = triggerRect.right - popRect.width
  if (left < margin) left = triggerRect.left
  if (left + popRect.width > window.innerWidth - margin) {
    left = window.innerWidth - popRect.width - margin
  }
  left = Math.max(margin, left)

  popoverEl.style.top = `${Math.round(top)}px`
  popoverEl.style.left = `${Math.round(left)}px`
}

function safeShowPopover(el: HTMLElement | null, sourceEl?: HTMLElement | null) {
  if (!el) return
  const anyEl = el as HTMLElement & { showPopover?: (options?: { source?: HTMLElement }) => void }
  if (typeof anyEl.showPopover === 'function') {
    try {
      if (sourceEl) {
        anyEl.showPopover({ source: sourceEl })
      } else {
        anyEl.showPopover()
      }
    } catch {
      try {
        anyEl.showPopover()
      } catch {
        // already open or unsupported
      }
    }
  }
}

function safeHidePopover(el: HTMLElement | null) {
  if (!el) return
  const anyEl = el as HTMLElement & { hidePopover?: () => void }
  if (typeof anyEl.hidePopover === 'function') {
    try {
      anyEl.hidePopover()
    } catch {
      // already closed
    }
  }
}

function isPopoverOpen(el: HTMLElement | null): boolean {
  if (!el) return false
  try {
    return el.matches(':popover-open')
  } catch {
    return el.classList.contains(':popover-open')
  }
}

function renderSystemTileIcon(item: NotificationItem) {
  if (item.severity === 'error') {
    return (
      <div className="w-7 h-7 rounded-lg flex items-center justify-center bg-rose-500/12 text-rose-600 dark:text-rose-400 shrink-0">
        <WarningCircle size={15} weight="fill" />
      </div>
    )
  }
  if (item.severity === 'warning' || item.type === 'reminder') {
    const isReminder = item.type === 'reminder'
    return (
      <div
        className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
          item.severity === 'warning'
            ? 'bg-amber-500/14 text-amber-600 dark:text-amber-400'
            : 'bg-sky-500/12 text-sky-600 dark:text-sky-400'
        }`}
      >
        {isReminder ? <CalendarCheck size={15} weight="fill" /> : <WarningCircle size={15} weight="fill" />}
      </div>
    )
  }
  if (item.severity === 'success') {
    return (
      <div className="w-7 h-7 rounded-lg flex items-center justify-center bg-emerald-500/12 text-emerald-600 dark:text-emerald-400 shrink-0">
        <CheckCircle size={15} weight="fill" />
      </div>
    )
  }
  if (item.type === 'sync') {
    return (
      <div className="w-7 h-7 rounded-lg flex items-center justify-center bg-sky-500/12 text-sky-600 dark:text-sky-400 shrink-0">
        <ArrowsClockwise size={15} weight="bold" />
      </div>
    )
  }
  return (
    <div className="w-7 h-7 rounded-lg flex items-center justify-center bg-[var(--app-bg-tertiary)] text-[var(--app-text-secondary)] shrink-0">
      <Info size={15} weight="fill" />
    </div>
  )
}

function renderCollabBadgeIcon(type: NotificationItem['type']) {
  switch (type) {
    case 'mention':
      return <At size={9} weight="bold" className="text-[var(--app-accent)]" />
    case 'comment':
      return <ChatCircleText size={9} weight="fill" className="text-sky-600 dark:text-sky-400" />
    case 'assignment':
      return <UserCheck size={9} weight="bold" className="text-emerald-600 dark:text-emerald-400" />
    default:
      return <FileText size={9} weight="fill" className="text-[var(--app-text-secondary)]" />
  }
}

function ActorAvatar({
  actor,
  badgeType,
  size = 'md'
}: {
  actor: ResolvedActorProfile
  badgeType?: NotificationItem['type']
  size?: 'sm' | 'md'
}) {
  return (
    <div className="relative shrink-0">
      <UserAvatar
        name={actor.name}
        avatarUrl={actor.avatarUrl}
        color={actor.color}
        size={size === 'sm' ? 'sm' : 'md'}
        shape="circle"
        className={size === 'sm' ? 'w-5 h-5 text-[9px]' : undefined}
      />
      {badgeType && size === 'md' && (
        <span
          className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-[var(--app-bg-primary)] border border-[var(--app-border-strong)] flex items-center justify-center shadow-2xs"
          aria-hidden="true"
        >
          {renderCollabBadgeIcon(badgeType)}
        </span>
      )}
    </div>
  )
}

function ToggleSwitch({
  checked,
  onChange,
  label
}: {
  checked: boolean
  onChange: (next: boolean) => void
  label: string
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border border-transparent transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--app-accent)] ${
        checked ? 'bg-[var(--app-accent)]' : 'bg-[var(--app-border-strong)]'
      }`}
    >
      <span
        className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-xs transition duration-150 translate-y-[1px] ${
          checked ? 'translate-x-[17px]' : 'translate-x-[1px]'
        }`}
      />
    </button>
  )
}

export function NotificationCenter({
  isOpen,
  onClose,
  onOpenSettings,
  currentMember,
  authUserId,
  currentMemberId
}: NotificationCenterProps) {
  const activeMember = useMemo(() => {
    if (currentMember) return currentMember
    const fallback = getCurrentMember()
    if (currentMemberId && fallback.id !== currentMemberId) {
      return { ...fallback, id: currentMemberId }
    }
    return fallback
  }, [currentMember, currentMemberId])

  const [inboxView, setInboxView] = useState<InboxView>('active')
  const [filter, setFilter] = useState<FilterTab>('all')
  const [searchOpen, setSearchOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [showQuickPrefs, setShowQuickPrefs] = useState(false)
  const [expandedBundles, setExpandedBundles] = useState<Record<string, boolean>>({})
  const [focusedRowId, setFocusedRowId] = useState<string | null>(null)
  const [confirmEmptyArchive, setConfirmEmptyArchive] = useState(false)
  const [snoozeTarget, setSnoozeTarget] = useState<NotificationItem | null>(null)
  const [viewMenuOpen, setViewMenuOpen] = useState(false)
  const [profiles, setProfiles] = useState<UserProfile[]>([])
  const [nowTick, setNowTick] = useState(() => Date.now())
  const [prefs, setPrefs] = useState<NotificationPreferences>(() => notificationService.getPreferences())
  const [desktopPerm, setDesktopPerm] = useState<NotificationPermission | 'unsupported'>(() =>
    notificationService.getDesktopPermission()
  )

  const drawerRef = useRef<HTMLElement>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)
  const viewMenuTriggerRef = useRef<HTMLButtonElement>(null)
  const viewPopoverRef = useRef<HTMLDivElement>(null)
  const snoozePopoverRef = useRef<HTMLDivElement>(null)
  const snoozeTriggerRef = useRef<HTMLElement | null>(null)
  const previousFocusRef = useRef<HTMLElement | null>(null)

  useEffect(() => {
    return notificationService.subscribeToPreferences(setPrefs)
  }, [])

  useEffect(() => {
    if (!isOpen) return
    const viewEl = viewPopoverRef.current
    const snoozeEl = snoozePopoverRef.current
    const prevFocus = document.activeElement as HTMLElement | null
    previousFocusRef.current = prevFocus
    const focusTimer = window.setTimeout(() => {
      drawerRef.current?.focus({ preventScroll: true })
    }, 30)

    const tickInterval = window.setInterval(() => {
      setNowTick(Date.now())
    }, 60_000)

    if (isSupabaseConfigured()) {
      void refreshTeamProfiles(true).then((rows) => {
        if (rows.length > 0) setProfiles(rows)
      })
    }
    const unsubProfiles = subscribeToTeamProfiles((next) => {
      if (next.length > 0) setProfiles(next)
    })

    return () => {
      unsubProfiles()
      window.clearTimeout(focusTimer)
      window.clearInterval(tickInterval)
      safeHidePopover(viewEl)
      safeHidePopover(snoozeEl)
      snoozeTriggerRef.current?.style.removeProperty('anchor-name')
      if (prevFocus && typeof prevFocus.focus === 'function') {
        prevFocus.focus({ preventScroll: true })
      }
    }
  }, [isOpen])

  useEffect(() => {
    const viewEl = viewPopoverRef.current
    const snoozeEl = snoozePopoverRef.current

    const handleViewToggle = (e: Event) => {
      const nextOpen = (e as ToggleEvent).newState === 'open'
      setViewMenuOpen(nextOpen)
      if (nextOpen) {
        requestAnimationFrame(() => positionPopoverElement(viewMenuTriggerRef.current, viewEl))
      }
    }

    const handleSnoozeToggle = (e: Event) => {
      const nextOpen = (e as ToggleEvent).newState === 'open'
      if (nextOpen) {
        requestAnimationFrame(() => positionPopoverElement(snoozeTriggerRef.current, snoozeEl))
      } else {
        snoozeTriggerRef.current?.style.removeProperty('anchor-name')
        setSnoozeTarget(null)
      }
    }

    viewEl?.addEventListener('toggle', handleViewToggle)
    snoozeEl?.addEventListener('toggle', handleSnoozeToggle)
    return () => {
      viewEl?.removeEventListener('toggle', handleViewToggle)
      snoozeEl?.removeEventListener('toggle', handleSnoozeToggle)
    }
  }, [isOpen])

  const liveData = useLiveQuery(async () => {
    const [notifs, workspaces, spaces] = await Promise.all([
      db.notifications.orderBy('createdAt').reverse().toArray(),
      db.workspaces.toArray(),
      db.spaces.toArray()
    ])
    return { notifs, workspaces, spaces }
  }, [])

  const wsMap = useMemo(
    () => new Map((liveData?.workspaces || []).map((w) => [w.id, w])),
    [liveData?.workspaces]
  )
  const spaceMap = useMemo(
    () => new Map((liveData?.spaces || []).map((s) => [s.id, s])),
    [liveData?.spaces]
  )

  const partitioned = useMemo(() => {
    const rows = liveData?.notifs || []
    return partitionMemberNotifications(rows, wsMap, activeMember, authUserId, nowTick)
  }, [liveData?.notifs, wsMap, activeMember, authUserId, nowTick])

  const unreadCount = useMemo(
    () => partitioned.active.filter((n) => !n.isRead).length,
    [partitioned.active]
  )
  const unreadMentionsCount = useMemo(
    () =>
      partitioned.active.filter(
        (n) => !n.isRead && getNotificationCategory(n.type) === 'collaboration'
      ).length,
    [partitioned.active]
  )
  const unreadRemindersCount = useMemo(
    () =>
      partitioned.active.filter(
        (n) => !n.isRead && getNotificationCategory(n.type) === 'reminders'
      ).length,
    [partitioned.active]
  )

  const baseList = useMemo(() => {
    if (inboxView === 'snoozed') return partitioned.snoozed
    if (inboxView === 'archived') return partitioned.archived
    return partitioned.active
  }, [inboxView, partitioned])

  const filteredItems = useMemo<EnrichedNotification[]>(() => {
    const q = search.trim().toLowerCase()
    const hasWorkspacesLoaded = (liveData?.workspaces?.length || 0) > 0

    return baseList
      .filter((n) => {
        if (inboxView === 'active') {
          const cat = getNotificationCategory(n.type)
          if (filter === 'unread' && n.isRead) return false
          if (filter === 'collaboration' && cat !== 'collaboration') return false
          if (filter === 'reminders' && cat !== 'reminders') return false
          if (filter === 'activity' && cat !== 'activity') return false
          if (filter === 'system' && cat !== 'system' && cat !== 'sync') return false
        }
        return true
      })
      .map((item) => {
        const workspace = item.workspaceId ? wsMap.get(item.workspaceId) : undefined
        const resolvedSpaceId = item.spaceId || workspace?.spaceId
        const space = resolvedSpaceId ? spaceMap.get(resolvedSpaceId) : undefined
        const actor = resolveActorProfile(item.actorId, item.actorName, profiles)
        const isDeletedTarget = Boolean(
          item.workspaceId && (workspace?.isDeleted || (hasWorkspacesLoaded && !workspace))
        )
        const legacyTitle = extractNoteTitleFromLegacyMessage(item.message)
        const noteTitle =
          workspace?.title?.trim() ||
          legacyTitle ||
          (item.type === 'workspace_update' ? item.title : '') ||
          'Nota sin título'
        const isNavigable = Boolean(
          !isDeletedTarget &&
            ((item.actionPayload && item.actionPayload.type !== 'custom') || item.workspaceId)
        )

        return {
          item,
          workspace,
          space,
          actor,
          noteTitle,
          isDeletedTarget,
          isNavigable
        }
      })
      .filter((enriched) => {
        if (!q) return true
        const { item, workspace, space, actor, noteTitle } = enriched
        const hay = [
          item.title,
          item.message,
          actor.name,
          noteTitle,
          workspace?.title,
          workspace?.folder,
          space?.name
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase()
        return hay.includes(q)
      })
  }, [baseList, inboxView, filter, search, wsMap, spaceMap, profiles, liveData?.workspaces?.length])

  const groupedTimeline = useMemo(() => {
    if (inboxView === 'snoozed') {
      return [
        {
          bucket: 'Posponer hasta' as const,
          rows: filteredItems.map<TimelineRow>((entry) => ({
            kind: 'item',
            id: entry.item.id,
            entry
          }))
        }
      ].filter((g) => g.rows.length > 0)
    }

    const bucketOrder: TimeBucket[] = ['Hoy', 'Ayer', 'Esta semana', 'Anteriores']
    const bucketMap = new Map<TimeBucket, EnrichedNotification[]>()
    for (const b of bucketOrder) bucketMap.set(b, [])

    for (const entry of filteredItems) {
      const b = getTimeBucket(entry.item.createdAt, nowTick)
      bucketMap.get(b)!.push(entry)
    }

    const canBundle =
      inboxView === 'active' &&
      !search.trim() &&
      (filter === 'all' || filter === 'unread' || filter === 'activity')

    const result: Array<{ bucket: TimeBucket; rows: TimelineRow[] }> = []

    for (const bucket of bucketOrder) {
      const entries = bucketMap.get(bucket)!
      if (entries.length === 0) continue

      if (!canBundle) {
        result.push({
          bucket,
          rows: entries.map((entry) => ({ kind: 'item', id: entry.item.id, entry }))
        })
        continue
      }

      const rows: TimelineRow[] = []
      let i = 0
      while (i < entries.length) {
        if (entries[i].item.type === 'workspace_update') {
          let j = i
          while (j < entries.length && entries[j].item.type === 'workspace_update') {
            j++
          }
          const run = entries.slice(i, j)
          if (run.length >= 3) {
            const actorMap = new Map<string, ResolvedActorProfile>()
            for (const r of run) {
              if (!actorMap.has(r.actor.name)) actorMap.set(r.actor.name, r.actor)
            }
            rows.push({
              kind: 'bundle',
              id: `bundle:${bucket}:${run[0].item.id}`,
              bucket,
              entries: run,
              actors: Array.from(actorMap.values()),
              unreadCount: run.filter((r) => !r.item.isRead).length,
              newestCreatedAt: run[0].item.createdAt
            })
          } else {
            for (const r of run) {
              rows.push({ kind: 'item', id: r.item.id, entry: r })
            }
          }
          i = j
        } else {
          rows.push({ kind: 'item', id: entries[i].item.id, entry: entries[i] })
          i++
        }
      }

      result.push({ bucket, rows })
    }

    return result
  }, [filteredItems, inboxView, search, filter, nowTick])

  const flatKeyboardIds = useMemo(() => {
    const ids: string[] = []
    for (const group of groupedTimeline) {
      for (const row of group.rows) {
        if (row.kind === 'bundle') {
          ids.push(row.id)
          if (expandedBundles[row.id]) {
            for (const child of row.entries) ids.push(child.item.id)
          }
        } else {
          ids.push(row.id)
        }
      }
    }
    return ids
  }, [groupedTimeline, expandedBundles])

  const closeDrawer = useCallback(() => {
    safeHidePopover(viewPopoverRef.current)
    safeHidePopover(snoozePopoverRef.current)
    setConfirmEmptyArchive(false)
    onClose()
  }, [onClose])

  const archiveWithUndo = useCallback(async (ids: string[], label: string) => {
    const archivedIds = await notificationService.archiveNotifications(ids)
    if (archivedIds.length === 0) return
    toast(label, {
      action: {
        label: 'Deshacer',
        onClick: () => void notificationService.restoreNotifications(archivedIds)
      }
    })
  }, [])

  const openItem = useCallback(
    (enriched: EnrichedNotification) => {
      if (enriched.isDeletedTarget) {
        toast.info('Esta nota fue eliminada o movida a la papelera')
        void notificationService.markAsRead(enriched.item.id)
        return
      }
      if (!enriched.isNavigable) {
        void notificationService.markAsRead(enriched.item.id)
        return
      }
      notificationService.triggerAction(enriched.item)
      closeDrawer()
    },
    [closeDrawer]
  )

  const openSnoozeFor = useCallback((item: NotificationItem, triggerEl: HTMLElement | null) => {
    if (snoozeTriggerRef.current && snoozeTriggerRef.current !== triggerEl) {
      snoozeTriggerRef.current.style.removeProperty('anchor-name')
    }
    snoozeTriggerRef.current = triggerEl
    if (triggerEl) {
      triggerEl.style.setProperty('anchor-name', '--notif-snooze-anchor')
    }
    setSnoozeTarget(item)
    safeShowPopover(snoozePopoverRef.current, triggerEl)
    requestAnimationFrame(() => positionPopoverElement(triggerEl, snoozePopoverRef.current))
  }, [])

  const handleClearRead = useCallback(async () => {
    const archivedIds = await notificationService.clearReadNotifications(activeMember, authUserId)
    if (archivedIds.length === 0) return
    toast(
      archivedIds.length === 1
        ? '1 notificación archivada'
        : `${archivedIds.length} notificaciones archivadas`,
      {
        action: {
          label: 'Deshacer',
          onClick: () => void notificationService.restoreNotifications(archivedIds)
        }
      }
    )
  }, [activeMember, authUserId])

  useEffect(() => {
    if (!isOpen) return

    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null
      const inInput =
        target &&
        (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)

      if (e.key === 'Escape') {
        if (isPopoverOpen(snoozePopoverRef.current) || isPopoverOpen(viewPopoverRef.current)) {
          return
        }
        e.preventDefault()
        if (showQuickPrefs) {
          setShowQuickPrefs(false)
        } else if (searchOpen || search) {
          setSearchOpen(false)
          setSearch('')
        } else {
          closeDrawer()
        }
        return
      }

      if (inInput || showQuickPrefs) return

      if (e.key === '/') {
        e.preventDefault()
        setSearchOpen(true)
        requestAnimationFrame(() => searchInputRef.current?.focus())
        return
      }

      if (flatKeyboardIds.length === 0) return

      if (e.key === 'ArrowDown' || e.key.toLowerCase() === 'j') {
        e.preventDefault()
        setFocusedRowId((prev) => {
          if (!prev) return flatKeyboardIds[0]
          const idx = flatKeyboardIds.indexOf(prev)
          return idx === -1 ? flatKeyboardIds[0] : flatKeyboardIds[Math.min(idx + 1, flatKeyboardIds.length - 1)]
        })
        return
      }

      if (e.key === 'ArrowUp' || e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setFocusedRowId((prev) => {
          if (!prev) return flatKeyboardIds[flatKeyboardIds.length - 1]
          const idx = flatKeyboardIds.indexOf(prev)
          return idx === -1 ? flatKeyboardIds[0] : flatKeyboardIds[Math.max(idx - 1, 0)]
        })
        return
      }

      if (!focusedRowId) return

      const bundleRow = groupedTimeline
        .flatMap((g) => g.rows)
        .find((r): r is ActivityBundle => r.kind === 'bundle' && r.id === focusedRowId)

      if (bundleRow) {
        if (e.key === 'Enter') {
          e.preventDefault()
          setExpandedBundles((prev) => ({ ...prev, [bundleRow.id]: !prev[bundleRow.id] }))
        } else if (e.key.toLowerCase() === 'm') {
          e.preventDefault()
          void notificationService.markNotificationsAsRead(bundleRow.entries.map((x) => x.item.id))
        } else if (e.key.toLowerCase() === 'e') {
          e.preventDefault()
          void archiveWithUndo(
            bundleRow.entries.map((x) => x.item.id),
            `${bundleRow.entries.length} notas archivadas`
          )
        }
        return
      }

      const targetEntry = filteredItems.find((x) => x.item.id === focusedRowId)
      if (!targetEntry) return

      if (e.key === 'Enter') {
        e.preventDefault()
        openItem(targetEntry)
      } else if (e.key.toLowerCase() === 'm') {
        e.preventDefault()
        void (targetEntry.item.isRead
          ? notificationService.markAsUnread(targetEntry.item.id)
          : notificationService.markAsRead(targetEntry.item.id))
      } else if (e.key.toLowerCase() === 'e') {
        e.preventDefault()
        if (inboxView === 'archived') {
          void notificationService.unarchiveNotification(targetEntry.item.id)
        } else {
          void archiveWithUndo([targetEntry.item.id], 'Notificación archivada')
        }
      } else if (e.key.toLowerCase() === 's' && inboxView === 'active') {
        e.preventDefault()
        const triggerEl = drawerRef.current?.querySelector(
          `[data-notif-row-id="${CSS.escape(targetEntry.item.id)}"] [data-snooze-trigger]`
        ) as HTMLElement | null
        openSnoozeFor(targetEntry.item, triggerEl)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [
    isOpen,
    showQuickPrefs,
    searchOpen,
    search,
    closeDrawer,
    flatKeyboardIds,
    focusedRowId,
    groupedTimeline,
    filteredItems,
    inboxView,
    openItem,
    archiveWithUndo,
    openSnoozeFor
  ])

  const isSilenced = prefs.dndEnabled || notificationService.isInQuietHours()
  const visibleUnreadIds = useMemo(
    () => filteredItems.filter((x) => !x.item.isRead).map((x) => x.item.id),
    [filteredItems]
  )
  const visibleReadCount = useMemo(
    () => filteredItems.filter((x) => x.item.isRead).length,
    [filteredItems]
  )
  const hasSecondaryViewOrFilter =
    inboxView !== 'active' || filter === 'activity' || filter === 'system'
  const snoozePresets = useMemo(() => getSnoozePresets(nowTick), [nowTick])

  const renderPrimarySentence = (enriched: EnrichedNotification) => {
    const { item, actor, noteTitle, workspace } = enriched
    const titleWeight = item.isRead
      ? 'font-medium text-[var(--app-text-primary)]'
      : 'font-semibold text-[var(--app-text-primary)]'

    switch (item.type) {
      case 'workspace_update':
        return (
          <>
            <span className="font-medium text-[var(--app-text-primary)]">{actor.name}</span>{' '}
            <span className="text-[var(--app-text-secondary)]">creó</span>{' '}
            <span className={titleWeight}>{noteTitle}</span>
          </>
        )
      case 'mention':
        return (
          <>
            <span className="font-medium text-[var(--app-text-primary)]">{actor.name}</span>{' '}
            <span className="text-[var(--app-text-secondary)]">te mencionó en</span>{' '}
            <span className={titleWeight}>{workspace?.title || 'un tablero'}</span>
          </>
        )
      case 'comment':
        return (
          <>
            <span className="font-medium text-[var(--app-text-primary)]">{actor.name}</span>{' '}
            <span className="text-[var(--app-text-secondary)]">comentó en</span>{' '}
            <span className={titleWeight}>{workspace?.title || 'un tablero'}</span>
          </>
        )
      case 'assignment':
        return (
          <>
            <span className="font-medium text-[var(--app-text-primary)]">{actor.name}</span>{' '}
            <span className="text-[var(--app-text-secondary)]">te asignó</span>{' '}
            <span className={titleWeight}>{item.title}</span>
          </>
        )
      default:
        return <span className={titleWeight}>{item.title}</span>
    }
  }

  const renderContextLine = (enriched: EnrichedNotification) => {
    const { item, workspace, space, isDeletedTarget } = enriched

    if (item.type === 'workspace_update') {
      if (isDeletedTarget) {
        return <span className="italic text-[var(--app-text-secondary)]">Nota eliminada</span>
      }
      const parts = [space?.name || 'Espacio', workspace?.folder].filter(Boolean)
      return (
        <span className="text-[var(--app-text-secondary)] truncate block">
          {parts.join(' · ')}
        </span>
      )
    }

    if (item.type === 'reminder') {
      const isOverdue = item.severity === 'warning'
      return (
        <div className="flex items-center gap-1.5 flex-wrap mt-0.5">
          <span
            className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium leading-none ${
              isOverdue
                ? 'bg-amber-500/14 text-amber-600 dark:text-amber-400'
                : 'bg-sky-500/12 text-sky-600 dark:text-sky-400'
            }`}
          >
            {isOverdue ? 'Vencida' : 'Hoy'}
          </span>
          <span className="text-[11.5px] text-[var(--app-text-secondary)] truncate">
            {workspace?.title || item.message}
          </span>
        </div>
      )
    }

    if (!item.message) return null

    return (
      <p className="text-[12px] text-[var(--app-text-secondary)] leading-[1.45] line-clamp-2 break-words">
        {item.message}
      </p>
    )
  }

  const renderSingleRow = (enriched: EnrichedNotification, nested = false) => {
    const { item, actor, isDeletedTarget } = enriched
    const isFocused = focusedRowId === item.id
    const isSnoozeOpenForRow = snoozeTarget?.id === item.id
    const isCollab =
      item.type === 'mention' ||
      item.type === 'comment' ||
      item.type === 'assignment' ||
      item.type === 'workspace_update'
    const hasInlineButton = Boolean(
      item.actionLabel &&
        item.actionPayload &&
        item.actionPayload.type !== 'open_workspace' &&
        item.actionPayload.type !== 'custom'
    )

    return (
      <div
        key={item.id}
        data-notif-row-id={item.id}
        className={`group relative flex items-start gap-2.5 transition-colors ${
          nested ? 'pl-10 pr-3.5 py-2.5' : 'px-3.5 py-2.5'
        } ${
          isFocused
            ? 'bg-[var(--app-hover)] ring-1 ring-inset ring-[var(--app-accent)]'
            : !item.isRead && inboxView === 'active'
            ? 'bg-black/[0.02] dark:bg-white/[0.025] hover:bg-[var(--app-hover)]'
            : 'hover:bg-[var(--app-hover)]'
        }`}
      >
        <div className="flex-1 min-w-0">
          <button
            type="button"
            onClick={() => openItem(enriched)}
            className={`w-full flex items-start gap-2.5 text-left cursor-pointer focus-visible:outline-none ${
              isDeletedTarget ? 'opacity-60' : ''
            }`}
          >
            {isCollab ? (
              <ActorAvatar actor={actor} badgeType={item.type} />
            ) : (
              renderSystemTileIcon(item)
            )}

            <div className="flex-1 min-w-0">
              <div className="text-[12.5px] leading-[1.35] break-words pr-12 sm:pr-14">
                {renderPrimarySentence(enriched)}
              </div>
              <div className="text-[11.5px] mt-0.5 min-w-0">{renderContextLine(enriched)}</div>
              {inboxView === 'snoozed' && item.snoozedUntil && (
                <div className="mt-1 inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-amber-500/12 text-amber-600 dark:text-amber-400">
                  <Clock size={10} weight="bold" />
                  <span>{formatSnoozeWake(item.snoozedUntil, nowTick)}</span>
                </div>
              )}
            </div>
          </button>

          {hasInlineButton && (
            <div className="pl-[38px] mt-1.5">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  notificationService.triggerAction(item)
                  closeDrawer()
                }}
                className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-medium border border-[var(--app-border-strong)] bg-[var(--app-bg-secondary)] hover:bg-[var(--app-hover-filled)] text-[var(--app-text-primary)] transition cursor-pointer"
              >
                {item.actionLabel}
              </button>
            </div>
          )}
        </div>

        {/* Timestamp + Unread Dot + Hover/Focus Quick Actions */}
        <div className="shrink-0 flex flex-col items-end gap-1 pt-0.5">
          <div
            className={`flex items-center gap-1.5 sm:group-hover:opacity-0 sm:group-focus-within:opacity-0 transition-opacity ${
              isSnoozeOpenForRow ? 'sm:opacity-0' : ''
            }`}
          >
            <span
              className="text-[11px] tabular-nums text-[var(--app-text-secondary)]"
              title={formatFullDateTime(item.createdAt)}
            >
              {formatCompactTime(item.createdAt, nowTick)}
            </span>
            {!item.isRead && inboxView === 'active' && (
              <span
                className="w-1.5 h-1.5 rounded-full bg-[var(--app-accent)] shrink-0"
                title="Sin leer"
              />
            )}
          </div>

          <div
            className={`flex items-center gap-0.5 sm:absolute sm:right-2.5 sm:top-2 sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100 transition-opacity sm:rounded-md sm:border sm:border-[var(--app-border-strong)] sm:bg-[var(--app-bg-overlay)] sm:shadow-sm sm:p-0.5 ${
              isSnoozeOpenForRow ? 'sm:opacity-100' : ''
            }`}
          >
            {inboxView === 'active' && (
              <button
                type="button"
                data-snooze-trigger
                onClick={(e) => {
                  e.stopPropagation()
                  openSnoozeFor(item, e.currentTarget)
                }}
                aria-label="Posponer notificación"
                title="Posponer (s)"
                className="p-1 rounded text-[var(--app-text-secondary)] hover:text-amber-600 dark:hover:text-amber-400 hover:bg-[var(--app-hover)] transition cursor-pointer"
              >
                <Clock size={13} />
              </button>
            )}

            {inboxView === 'snoozed' ? (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  void notificationService.unsnoozeNotification(item.id)
                }}
                aria-label="Reactivar notificación"
                title="Reactivar ahora"
                className="p-1 rounded text-[var(--app-text-secondary)] hover:text-[var(--app-accent)] hover:bg-[var(--app-hover)] transition cursor-pointer"
              >
                <ClockCounterClockwise size={13} />
              </button>
            ) : (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  void (item.isRead
                    ? notificationService.markAsUnread(item.id)
                    : notificationService.markAsRead(item.id))
                }}
                aria-label={item.isRead ? 'Marcar como no leída' : 'Marcar como leída'}
                title={item.isRead ? 'Marcar como no leída (m)' : 'Marcar como leída (m)'}
                className="p-1 rounded text-[var(--app-text-secondary)] hover:text-[var(--app-text-primary)] hover:bg-[var(--app-hover)] transition cursor-pointer"
              >
                {item.isRead ? <Envelope size={13} /> : <EnvelopeOpen size={13} />}
              </button>
            )}

            {inboxView === 'archived' ? (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  void notificationService.unarchiveNotification(item.id)
                }}
                aria-label="Restaurar a la bandeja"
                title="Restaurar (e)"
                className="p-1 rounded text-[var(--app-text-secondary)] hover:text-emerald-600 dark:hover:text-emerald-400 hover:bg-[var(--app-hover)] transition cursor-pointer"
              >
                <ClockCounterClockwise size={13} />
              </button>
            ) : (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  void archiveWithUndo([item.id], 'Notificación archivada')
                }}
                aria-label="Archivar notificación"
                title="Archivar (e)"
                className="p-1 rounded text-[var(--app-text-secondary)] hover:text-rose-600 dark:hover:text-rose-400 hover:bg-[var(--app-hover)] transition cursor-pointer"
              >
                <Archive size={13} />
              </button>
            )}
          </div>
        </div>
      </div>
    )
  }

  const renderBundleRow = (bundle: ActivityBundle) => {
    const isExpanded = Boolean(expandedBundles[bundle.id])
    const isFocused = focusedRowId === bundle.id
    const primaryActor = bundle.actors[0]?.name || 'Equipo'
    const otherActors = bundle.actors.length - 1
    const actorSummary =
      otherActors > 0 ? `${primaryActor} y ${otherActors} más` : primaryActor
    const previewTitles = bundle.entries.slice(0, 2).map((e) => e.noteTitle)
    const remainingCount = bundle.entries.length - previewTitles.length

    return (
      <div key={bundle.id} className="divide-y divide-[var(--app-divider)]">
        <div
          data-notif-row-id={bundle.id}
          className={`group relative flex items-start gap-2.5 px-3.5 py-2.5 transition-colors ${
            isFocused
              ? 'bg-[var(--app-hover)] ring-1 ring-inset ring-[var(--app-accent)]'
              : bundle.unreadCount > 0
              ? 'bg-black/[0.02] dark:bg-white/[0.025] hover:bg-[var(--app-hover)]'
              : 'hover:bg-[var(--app-hover)]'
          }`}
        >
          <button
            type="button"
            aria-expanded={isExpanded}
            onClick={() =>
              setExpandedBundles((prev) => ({ ...prev, [bundle.id]: !prev[bundle.id] }))
            }
            className="flex-1 min-w-0 flex items-start gap-2.5 text-left cursor-pointer focus-visible:outline-none"
          >
            <div className="flex items-center -space-x-2 shrink-0 pt-0.5">
              {bundle.actors.slice(0, 3).map((actor, idx) => (
                <div
                  key={`${actor.name}-${idx}`}
                  className="rounded-full ring-2 ring-[var(--app-bg-primary)]"
                >
                  <ActorAvatar actor={actor} size="sm" />
                </div>
              ))}
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5 text-[12.5px] leading-[1.35] pr-14">
                <span className="truncate">
                  <span className="font-medium text-[var(--app-text-primary)]">{actorSummary}</span>{' '}
                  <span className="text-[var(--app-text-secondary)]">crearon</span>{' '}
                  <span className={bundle.unreadCount > 0 ? 'font-semibold' : 'font-medium'}>
                    {bundle.entries.length} notas
                  </span>
                </span>
                <span className="text-[var(--app-text-secondary)] shrink-0">
                  {isExpanded ? <CaretDown size={11} /> : <CaretRight size={11} />}
                </span>
              </div>

              <div className="flex items-center flex-wrap gap-1 mt-1">
                {previewTitles.map((title, idx) => (
                  <span
                    key={`${bundle.id}-p-${idx}`}
                    className="inline-block max-w-[140px] truncate px-1.5 py-0.5 rounded bg-[var(--app-bg-secondary)] border border-[var(--app-border)] text-[10.5px] text-[var(--app-text-secondary)]"
                  >
                    {title}
                  </span>
                ))}
                {remainingCount > 0 && (
                  <span className="text-[10.5px] text-[var(--app-text-secondary)] tabular-nums">
                    +{remainingCount} más
                  </span>
                )}
              </div>
            </div>
          </button>

          <div className="shrink-0 flex flex-col items-end gap-1 pt-0.5">
            <div className="flex items-center gap-1.5 sm:group-hover:opacity-0 sm:group-focus-within:opacity-0 transition-opacity">
              <span className="text-[11px] tabular-nums text-[var(--app-text-secondary)]">
                {formatCompactTime(bundle.newestCreatedAt, nowTick)}
              </span>
              {bundle.unreadCount > 0 && (
                <span
                  className="w-1.5 h-1.5 rounded-full bg-[var(--app-accent)] shrink-0"
                  title={`${bundle.unreadCount} sin leer`}
                />
              )}
            </div>

            <div className="flex items-center gap-0.5 sm:absolute sm:right-2.5 sm:top-2 sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100 transition-opacity sm:rounded-md sm:border sm:border-[var(--app-border-strong)] sm:bg-[var(--app-bg-overlay)] sm:shadow-sm sm:p-0.5">
              {bundle.unreadCount > 0 && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    void notificationService.markNotificationsAsRead(
                      bundle.entries.map((x) => x.item.id)
                    )
                  }}
                  aria-label="Marcar grupo como leído"
                  title="Marcar grupo como leído (m)"
                  className="p-1 rounded text-[var(--app-text-secondary)] hover:text-[var(--app-text-primary)] hover:bg-[var(--app-hover)] transition cursor-pointer"
                >
                  <Checks size={13} />
                </button>
              )}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  void archiveWithUndo(
                    bundle.entries.map((x) => x.item.id),
                    `${bundle.entries.length} notas archivadas`
                  )
                }}
                aria-label="Archivar grupo"
                title="Archivar grupo (e)"
                className="p-1 rounded text-[var(--app-text-secondary)] hover:text-rose-600 dark:hover:text-rose-400 hover:bg-[var(--app-hover)] transition cursor-pointer"
              >
                <Archive size={13} />
              </button>
            </div>
          </div>
        </div>

        {isExpanded && (
          <div className="bg-[var(--app-bg-secondary)]/50 divide-y divide-[var(--app-divider)]">
            {bundle.entries.map((child) => renderSingleRow(child, true))}
          </div>
        )}
      </div>
    )
  }

  const renderEmptyState = () => {
    let icon = <Bell size={20} />
    let heading = 'Estás al día'
    let subtitle = 'Aquí aparecerán menciones, comentarios, tareas próximas y alertas del equipo.'

    if (search.trim()) {
      icon = <MagnifyingGlass size={20} />
      heading = `Sin resultados para "${search.trim()}"`
      subtitle = 'Prueba con otro término o limpia el filtro activo.'
    } else if (inboxView === 'snoozed') {
      icon = <Clock size={20} />
      heading = 'No hay notificaciones pospuestas'
      subtitle = 'Usa el icono de reloj en cualquier alerta para posponerla para más tarde.'
    } else if (inboxView === 'archived') {
      icon = <Archive size={20} />
      heading = 'El archivo está vacío'
      subtitle = 'Las notificaciones archivadas aparecen aquí por si necesitas recuperarlas.'
    } else if (filter === 'unread') {
      icon = <Checks size={20} />
      heading = 'No tienes notificaciones sin leer'
      subtitle = 'Todas tus alertas activas están revisadas.'
    } else if (filter === 'collaboration') {
      icon = <At size={20} />
      heading = 'Sin menciones ni comentarios'
      subtitle = 'Cuando alguien te mencione con @ o responda en un tablero lo verás aquí.'
    } else if (filter === 'reminders') {
      icon = <CalendarCheck size={20} />
      heading = 'Sin tareas pendientes por vencer'
      subtitle = 'Los recordatorios de fechas límite aparecen aquí automáticamente.'
    } else if (filter === 'activity') {
      icon = <FileText size={20} />
      heading = 'Sin actividad reciente de notas'
      subtitle = 'Las nuevas notas compartidas por tu equipo aparecerán agrupadas aquí.'
    } else if (filter === 'system') {
      icon = <ArrowsClockwise size={20} />
      heading = 'Todo funciona con normalidad'
      subtitle = 'Las alertas de sincronización o actualizaciones aparecerán aquí si ocurre algo.'
    }

    return (
      <div className="flex flex-col items-center justify-center text-center py-16 px-6">
        <div className="w-10 h-10 rounded-full bg-[var(--app-bg-secondary)] border border-[var(--app-border)] flex items-center justify-center text-[var(--app-text-secondary)] mb-3">
          {icon}
        </div>
        <p className="text-[13px] font-medium text-[var(--app-text-primary)]">{heading}</p>
        <p className="text-[12px] text-[var(--app-text-secondary)] mt-1 max-w-[260px] leading-relaxed">
          {subtitle}
        </p>
        {(search.trim() || filter !== 'all' || inboxView !== 'active') && (
          <button
            type="button"
            onClick={() => {
              setSearch('')
              setFilter('all')
              setInboxView('active')
            }}
            className="mt-4 px-3 py-1.5 rounded-md text-[11.5px] font-medium border border-[var(--app-border-strong)] bg-[var(--app-bg-secondary)] hover:bg-[var(--app-hover-filled)] text-[var(--app-text-primary)] transition cursor-pointer"
          >
            Volver a todas
          </button>
        )}
      </div>
    )
  }

  const renderQuickPreferences = () => {
    return (
      <div className="flex-1 overflow-y-auto overscroll-contain custom-scrollbar">
        <div className="px-3.5 py-2.5 border-b border-[var(--app-divider)] flex items-center justify-between">
          <button
            type="button"
            onClick={() => setShowQuickPrefs(false)}
            className="inline-flex items-center gap-1.5 text-[12px] font-medium text-[var(--app-text-secondary)] hover:text-[var(--app-text-primary)] transition cursor-pointer"
          >
            <ArrowLeft size={14} />
            <span>Volver a notificaciones</span>
          </button>
          <span className="text-[11px] text-[var(--app-text-secondary)]">Preferencias rápidas</span>
        </div>

        <div className="p-3.5 space-y-5">
          {/* Silencing & Delivery */}
          <div className="space-y-2">
            <h3 className="text-[11px] font-semibold uppercase tracking-[0.04em] text-[var(--app-text-secondary)]">
              Entrega y silencio
            </h3>
            <div className="divide-y divide-[var(--app-divider)] rounded-lg border border-[var(--app-border)] bg-[var(--app-bg-secondary)]/50">
              <div className="flex items-center justify-between gap-3 px-3 py-2.5">
                <div>
                  <div className="text-[12.5px] font-medium text-[var(--app-text-primary)]">
                    Modo No Molestar
                  </div>
                  <div className="text-[11px] text-[var(--app-text-secondary)]">
                    Silencia avisos emergentes, sonido y escritorio
                  </div>
                </div>
                <ToggleSwitch
                  checked={prefs.dndEnabled}
                  label="Modo No Molestar"
                  onChange={(next) => notificationService.updatePreferences({ dndEnabled: next })}
                />
              </div>

              <div className="px-3 py-2.5 space-y-2">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-[12.5px] font-medium text-[var(--app-text-primary)]">
                      Horario silencioso
                    </div>
                    <div className="text-[11px] text-[var(--app-text-secondary)]">
                      Pausa automática cada noche
                    </div>
                  </div>
                  <ToggleSwitch
                    checked={prefs.quietHoursEnabled}
                    label="Horario silencioso"
                    onChange={(next) =>
                      notificationService.updatePreferences({ quietHoursEnabled: next })
                    }
                  />
                </div>
                {prefs.quietHoursEnabled && (
                  <div className="flex items-center gap-2 pt-1">
                    <input
                      type="time"
                      value={prefs.quietHoursStart}
                      onChange={(e) =>
                        notificationService.updatePreferences({ quietHoursStart: e.target.value })
                      }
                      aria-label="Inicio horario silencioso"
                      className="px-2 py-1 text-[11.5px] tabular-nums rounded-md border border-[var(--app-border-strong)] bg-[var(--app-bg-primary)] text-[var(--app-text-primary)]"
                    />
                    <span className="text-[11px] text-[var(--app-text-secondary)]">a</span>
                    <input
                      type="time"
                      value={prefs.quietHoursEnd}
                      onChange={(e) =>
                        notificationService.updatePreferences({ quietHoursEnd: e.target.value })
                      }
                      aria-label="Fin horario silencioso"
                      className="px-2 py-1 text-[11.5px] tabular-nums rounded-md border border-[var(--app-border-strong)] bg-[var(--app-bg-primary)] text-[var(--app-text-primary)]"
                    />
                  </div>
                )}
              </div>

              <div className="flex items-center justify-between gap-3 px-3 py-2.5">
                <div className="text-[12.5px] font-medium text-[var(--app-text-primary)]">
                  Avisos flotantes (Toasts)
                </div>
                <ToggleSwitch
                  checked={prefs.toastsEnabled}
                  label="Avisos flotantes"
                  onChange={(next) => notificationService.updatePreferences({ toastsEnabled: next })}
                />
              </div>

              <div className="flex items-center justify-between gap-3 px-3 py-2.5">
                <div className="text-[12.5px] font-medium text-[var(--app-text-primary)]">
                  Sonido sutil de alerta
                </div>
                <ToggleSwitch
                  checked={prefs.soundEnabled}
                  label="Sonido sutil de alerta"
                  onChange={(next) => notificationService.updatePreferences({ soundEnabled: next })}
                />
              </div>

              <div className="flex items-center justify-between gap-3 px-3 py-2.5">
                <div>
                  <div className="text-[12.5px] font-medium text-[var(--app-text-primary)]">
                    Notificaciones de escritorio
                  </div>
                  <div className="text-[11px] text-[var(--app-text-secondary)]">
                    {desktopPerm === 'granted'
                      ? 'Permiso concedido'
                      : desktopPerm === 'denied'
                      ? 'Bloqueado en navegador'
                      : desktopPerm === 'unsupported'
                      ? 'No disponible en este entorno'
                      : 'Requiere permiso del navegador'}
                  </div>
                </div>
                {desktopPerm === 'granted' ? (
                  <ToggleSwitch
                    checked={prefs.desktopEnabled}
                    label="Notificaciones de escritorio"
                    onChange={(next) =>
                      notificationService.updatePreferences({ desktopEnabled: next })
                    }
                  />
                ) : desktopPerm === 'default' ? (
                  <button
                    type="button"
                    onClick={async () => {
                      const res = await notificationService.requestDesktopPermission()
                      setDesktopPerm(res)
                    }}
                    className="px-2.5 py-1 rounded-md text-[11.5px] font-medium bg-[var(--app-accent-soft)] text-[var(--app-accent)] hover:opacity-90 transition cursor-pointer"
                  >
                    Activar
                  </button>
                ) : null}
              </div>
            </div>
          </div>

          {/* Categories */}
          <div className="space-y-2">
            <h3 className="text-[11px] font-semibold uppercase tracking-[0.04em] text-[var(--app-text-secondary)]">
              Categorías
            </h3>
            <div className="divide-y divide-[var(--app-divider)] rounded-lg border border-[var(--app-border)] bg-[var(--app-bg-secondary)]/50">
              {(
                [
                  { id: 'collaboration', label: 'Menciones y comentarios', desc: 'Etiquetas @ y respuestas en tableros' },
                  { id: 'activity', label: 'Nuevas notas del equipo', desc: 'Páginas compartidas creadas por otros' },
                  { id: 'reminders', label: 'Recordatorios de tareas', desc: 'Fechas límite de bases de datos' },
                  { id: 'sync', label: 'Sincronización', desc: 'Errores o conflictos de respaldo' },
                  { id: 'system', label: 'Sistema', desc: 'Actualizaciones y avisos generales' }
                ] as Array<{ id: NotificationCategory; label: string; desc: string }>
              ).map((cat) => (
                <div key={cat.id} className="flex items-center justify-between gap-3 px-3 py-2.5">
                  <div>
                    <div className="text-[12.5px] font-medium text-[var(--app-text-primary)]">
                      {cat.label}
                    </div>
                    <div className="text-[11px] text-[var(--app-text-secondary)]">{cat.desc}</div>
                  </div>
                  <ToggleSwitch
                    checked={prefs.categories[cat.id]}
                    label={cat.label}
                    onChange={(next) =>
                      notificationService.updatePreferences({
                        categories: { ...prefs.categories, [cat.id]: next }
                      })
                    }
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Footer actions */}
          <div className="flex flex-col gap-2 pt-1">
            <button
              type="button"
              onClick={() => void notificationService.sendTestNotification()}
              className="w-full py-2 px-3 rounded-lg text-[12px] font-medium border border-[var(--app-border-strong)] bg-[var(--app-bg-secondary)] hover:bg-[var(--app-hover-filled)] text-[var(--app-text-primary)] transition cursor-pointer"
            >
              Enviar notificación de prueba
            </button>
            <button
              type="button"
              onClick={() => {
                closeDrawer()
                onOpenSettings()
              }}
              className="w-full py-2 px-3 rounded-lg text-[12px] font-medium text-[var(--app-accent)] hover:bg-[var(--app-accent-soft)] transition cursor-pointer"
            >
              Push en segundo plano y más ajustes →
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            key="notif-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.16 }}
            onClick={closeDrawer}
            className="fixed inset-0 left-11 z-40 bg-black/25 dark:bg-black/40"
          />

          <motion.aside
            ref={drawerRef}
            id="seven-notification-center"
            key="notif-drawer"
            role="dialog"
            aria-modal="true"
            aria-label="Centro de notificaciones"
            tabIndex={-1}
            initial={{ opacity: 0, x: -16 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -16 }}
            transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
            className="fixed inset-y-0 left-11 z-50 w-[min(420px,calc(100vw-44px))] flex flex-col bg-[var(--app-bg-primary)] border-r border-[var(--app-border-strong)] shadow-[var(--app-shadow-popover)] text-[var(--app-text-primary)] select-none outline-none"
          >
            {/* Compact Header */}
            <div className="flex items-center justify-between px-3.5 h-12 border-b border-[var(--app-divider)] shrink-0">
              <div className="flex items-center gap-2 min-w-0">
                <h2 className="text-[14px] font-semibold tracking-[-0.01em] text-[var(--app-text-primary)] truncate">
                  Notificaciones
                </h2>
                {unreadCount > 0 && (
                  <span className="px-1.5 py-0.5 text-[11px] font-semibold tabular-nums rounded-md bg-[var(--app-accent-soft)] text-[var(--app-accent)] leading-none">
                    {unreadCount > 99 ? '99+' : unreadCount}
                  </span>
                )}
                {isSilenced && (
                  <button
                    type="button"
                    onClick={() =>
                      notificationService.updatePreferences({
                        dndEnabled: false,
                        quietHoursEnabled: false
                      })
                    }
                    title="Haz clic para reactivar avisos"
                    className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10.5px] font-medium bg-amber-500/12 text-amber-600 dark:text-amber-400 hover:bg-amber-500/20 transition cursor-pointer shrink-0"
                  >
                    <BellSlash size={11} weight="fill" />
                    <span className="hidden sm:inline">Silenciado</span>
                  </button>
                )}
              </div>

              <div className="flex items-center gap-0.5 shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    const next = !searchOpen
                    setSearchOpen(next)
                    if (next) {
                      setShowQuickPrefs(false)
                      requestAnimationFrame(() => searchInputRef.current?.focus())
                    } else {
                      setSearch('')
                    }
                  }}
                  aria-label="Buscar notificaciones"
                  aria-pressed={searchOpen}
                  title="Buscar (/)"
                  className={`w-7 h-7 rounded-md flex items-center justify-center transition cursor-pointer ${
                    searchOpen || search
                      ? 'bg-[var(--app-active)] text-[var(--app-text-primary)]'
                      : 'text-[var(--app-text-secondary)] hover:text-[var(--app-text-primary)] hover:bg-[var(--app-hover)]'
                  }`}
                >
                  <MagnifyingGlass size={16} />
                </button>

                <button
                  type="button"
                  onClick={() =>
                    notificationService.updatePreferences({ dndEnabled: !prefs.dndEnabled })
                  }
                  aria-label={prefs.dndEnabled ? 'Desactivar No Molestar' : 'Activar No Molestar'}
                  aria-pressed={prefs.dndEnabled}
                  title={prefs.dndEnabled ? 'Desactivar No Molestar' : 'Activar No Molestar'}
                  className={`w-7 h-7 rounded-md flex items-center justify-center transition cursor-pointer ${
                    prefs.dndEnabled
                      ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400'
                      : 'text-[var(--app-text-secondary)] hover:text-[var(--app-text-primary)] hover:bg-[var(--app-hover)]'
                  }`}
                >
                  {prefs.dndEnabled ? <BellSlash size={16} weight="fill" /> : <Bell size={16} />}
                </button>

                <button
                  type="button"
                  onClick={() => setShowQuickPrefs((prev) => !prev)}
                  aria-label="Preferencias rápidas"
                  aria-pressed={showQuickPrefs}
                  title="Preferencias de notificaciones"
                  className={`w-7 h-7 rounded-md flex items-center justify-center transition cursor-pointer ${
                    showQuickPrefs
                      ? 'bg-[var(--app-active)] text-[var(--app-text-primary)]'
                      : 'text-[var(--app-text-secondary)] hover:text-[var(--app-text-primary)] hover:bg-[var(--app-hover)]'
                  }`}
                >
                  <SlidersHorizontal size={16} />
                </button>

                <button
                  type="button"
                  onClick={closeDrawer}
                  aria-label="Cerrar notificaciones"
                  title="Cerrar (Esc)"
                  className="w-7 h-7 rounded-md flex items-center justify-center text-[var(--app-text-secondary)] hover:text-[var(--app-text-primary)] hover:bg-[var(--app-hover)] transition cursor-pointer"
                >
                  <X size={16} />
                </button>
              </div>
            </div>

            {showQuickPrefs ? (
              renderQuickPreferences()
            ) : (
              <>
                {/* Collapsible Search Input */}
                {(searchOpen || search) && (
                  <div className="px-3.5 py-2 border-b border-[var(--app-divider)] bg-[var(--app-bg-secondary)]/60 shrink-0">
                    <div className="relative flex items-center">
                      <MagnifyingGlass
                        size={14}
                        className="absolute left-2.5 text-[var(--app-text-secondary)] pointer-events-none"
                      />
                      <input
                        ref={searchInputRef}
                        type="text"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Filtrar por nota, persona o mensaje..."
                        className="w-full pl-8 pr-7 py-1.5 text-[12px] rounded-md bg-[var(--app-bg-primary)] border border-[var(--app-border-strong)] text-[var(--app-text-primary)] placeholder:text-[var(--app-text-secondary)] focus:outline-none focus:border-[var(--app-accent)]"
                      />
                      {search && (
                        <button
                          type="button"
                          onClick={() => setSearch('')}
                          aria-label="Limpiar búsqueda"
                          className="absolute right-2 p-0.5 rounded text-[var(--app-text-secondary)] hover:text-[var(--app-text-primary)] cursor-pointer"
                        >
                          <X size={12} />
                        </button>
                      )}
                    </div>
                  </div>
                )}

                {/* Zero-clipping 4-tab bar + View/Filter Menu */}
                <div className="flex items-center justify-between px-3.5 border-b border-[var(--app-divider)] shrink-0">
                  <div className="flex items-center gap-1 min-w-0">
                    {(
                      [
                        { id: 'all', label: 'Todas', count: 0 },
                        { id: 'unread', label: 'Sin leer', count: unreadCount },
                        { id: 'collaboration', label: 'Menciones', count: unreadMentionsCount },
                        { id: 'reminders', label: 'Tareas', count: unreadRemindersCount }
                      ] as const
                    ).map((tab) => {
                      const isActive = inboxView === 'active' && filter === tab.id
                      return (
                        <button
                          key={tab.id}
                          type="button"
                          onClick={() => {
                            setInboxView('active')
                            setFilter(tab.id)
                            setConfirmEmptyArchive(false)
                          }}
                          className={`relative py-2.5 px-2 text-[12px] whitespace-nowrap transition cursor-pointer flex items-center gap-1 ${
                            isActive
                              ? 'text-[var(--app-text-primary)] font-semibold'
                              : 'text-[var(--app-text-secondary)] hover:text-[var(--app-text-primary)] font-medium'
                          }`}
                        >
                          <span>{tab.label}</span>
                          {tab.count > 0 && (
                            <span className="text-[10.5px] tabular-nums text-[var(--app-text-secondary)]">
                              {tab.count > 99 ? '99+' : tab.count}
                            </span>
                          )}
                          {isActive && (
                            <span
                              className="absolute inset-x-1.5 bottom-0 h-[2px] rounded-full bg-[var(--app-accent)]"
                              aria-hidden="true"
                            />
                          )}
                        </button>
                      )
                    })}
                  </div>

                  {/* Native Popover View & Extra Category Filter Trigger */}
                  <button
                    ref={viewMenuTriggerRef}
                    type="button"
                    aria-expanded={viewMenuOpen}
                    aria-controls="notif-view-popover"
                    title="Vistas y más filtros"
                    style={{ anchorName: '--notif-view-anchor' } as CSSProperties}
                    onClick={() => {
                      const el = viewPopoverRef.current
                      if (!el) return
                      if (isPopoverOpen(el)) {
                        safeHidePopover(el)
                      } else {
                        safeShowPopover(el, viewMenuTriggerRef.current)
                      }
                    }}
                    className={`relative px-2 py-1 rounded-md text-[11.5px] font-medium flex items-center gap-1 transition cursor-pointer shrink-0 ${
                      hasSecondaryViewOrFilter || viewMenuOpen
                        ? 'bg-[var(--app-accent-soft)] text-[var(--app-accent)]'
                        : 'text-[var(--app-text-secondary)] hover:text-[var(--app-text-primary)] hover:bg-[var(--app-hover)]'
                    }`}
                  >
                    <Funnel size={13} weight={hasSecondaryViewOrFilter ? 'fill' : 'regular'} />
                    <span className={hasSecondaryViewOrFilter ? 'inline' : 'hidden sm:inline'}>
                      {inboxView === 'snoozed'
                        ? 'Pospuestas'
                        : inboxView === 'archived'
                        ? 'Archivadas'
                        : filter === 'activity'
                        ? 'Notas'
                        : filter === 'system'
                        ? 'Sistema'
                        : 'Más'}
                    </span>
                  </button>
                </div>

                {/* Contextual Utility Bar (only when actionable) */}
                {inboxView === 'active' &&
                  (visibleUnreadIds.length > 0 || visibleReadCount > 0) && (
                    <div className="flex items-center justify-between px-3.5 py-1.5 border-b border-[var(--app-divider)] bg-[var(--app-bg-secondary)]/50 text-[11.5px] shrink-0">
                      <div className="flex items-center gap-3">
                        {visibleUnreadIds.length > 0 ? (
                          <button
                            type="button"
                            onClick={() =>
                              void notificationService.markNotificationsAsRead(visibleUnreadIds)
                            }
                            className="inline-flex items-center gap-1 font-medium text-[var(--app-text-secondary)] hover:text-[var(--app-text-primary)] transition cursor-pointer"
                          >
                            <Checks size={14} />
                            <span>
                              {visibleUnreadIds.length === unreadCount
                                ? 'Marcar todas leídas'
                                : `Marcar ${visibleUnreadIds.length} leídas`}
                            </span>
                          </button>
                        ) : (
                          <span className="text-[var(--app-text-secondary)]">
                            {filteredItems.length} revisadas
                          </span>
                        )}
                      </div>

                      {visibleReadCount > 0 && (
                        <button
                          type="button"
                          onClick={() => void handleClearRead()}
                          className="inline-flex items-center gap-1 text-[var(--app-text-secondary)] hover:text-[var(--app-text-primary)] transition cursor-pointer"
                        >
                          <Archive size={13} />
                          <span>Limpiar leídas</span>
                        </button>
                      )}
                    </div>
                  )}

                {inboxView === 'snoozed' && partitioned.snoozed.length > 0 && (
                  <div className="flex items-center justify-between px-3.5 py-1.5 border-b border-[var(--app-divider)] bg-[var(--app-bg-secondary)]/50 text-[11.5px] shrink-0">
                    <span className="text-[var(--app-text-secondary)] tabular-nums">
                      {partitioned.snoozed.length} pospuestas
                    </span>
                    <button
                      type="button"
                      onClick={() => void notificationService.unsnoozeAll(activeMember, authUserId)}
                      className="inline-flex items-center gap-1 font-medium text-[var(--app-accent)] hover:underline cursor-pointer"
                    >
                      <ClockCounterClockwise size={13} />
                      <span>Reactivar todas</span>
                    </button>
                  </div>
                )}

                {inboxView === 'archived' && partitioned.archived.length > 0 && (
                  <div className="flex items-center justify-between px-3.5 py-1.5 border-b border-[var(--app-divider)] bg-[var(--app-bg-secondary)]/50 text-[11.5px] shrink-0">
                    <span className="text-[var(--app-text-secondary)] tabular-nums">
                      {partitioned.archived.length} archivadas
                    </span>
                    {confirmEmptyArchive ? (
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={async () => {
                            await notificationService.deleteArchivedNotifications(
                              activeMember,
                              authUserId
                            )
                            setConfirmEmptyArchive(false)
                            toast.success('Archivo vaciado')
                          }}
                          className="font-semibold text-rose-600 dark:text-rose-400 hover:underline cursor-pointer"
                        >
                          Confirmar vaciado
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmEmptyArchive(false)}
                          className="text-[var(--app-text-secondary)] hover:text-[var(--app-text-primary)] cursor-pointer"
                        >
                          Cancelar
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setConfirmEmptyArchive(true)}
                        className="inline-flex items-center gap-1 text-[var(--app-text-secondary)] hover:text-rose-600 dark:hover:text-rose-400 transition cursor-pointer"
                      >
                        <Trash size={13} />
                        <span>Vaciar archivo</span>
                      </button>
                    )}
                  </div>
                )}

                {/* Main Scrollable Inbox Timeline */}
                <div className="flex-1 overflow-y-auto overscroll-contain custom-scrollbar">
                  {groupedTimeline.length === 0
                    ? renderEmptyState()
                    : groupedTimeline.map((group) => (
                        <section key={group.bucket} aria-label={group.bucket}>
                          <div className="sticky top-0 z-10 px-3.5 pt-3 pb-1.5 bg-[var(--app-bg-primary)]/95 backdrop-blur-xs border-b border-[var(--app-divider)]">
                            <h3 className="text-[11px] font-semibold uppercase tracking-[0.04em] text-[var(--app-text-secondary)]">
                              {group.bucket}
                            </h3>
                          </div>
                          <div className="divide-y divide-[var(--app-divider)]">
                            {group.rows.map((row) =>
                              row.kind === 'bundle'
                                ? renderBundleRow(row)
                                : renderSingleRow(row.entry)
                            )}
                          </div>
                        </section>
                      ))}
                </div>

                {/* Subtle Footer Hint & Snoozed Shortcut */}
                {(partitioned.snoozed.length > 0 || groupedTimeline.length > 0) && (
                  <div className="px-3.5 py-2 border-t border-[var(--app-divider)] bg-[var(--app-bg-secondary)]/40 flex items-center justify-between gap-2 text-[11px] text-[var(--app-text-secondary)] shrink-0">
                    <div className="hidden sm:flex items-center gap-2.5 truncate">
                      <span>
                        <kbd className="font-mono px-1 py-0.5 rounded border border-[var(--app-border)] bg-[var(--app-bg-primary)] text-[10px]">
                          ↑↓
                        </kbd>{' '}
                        navegar
                      </span>
                      <span>
                        <kbd className="font-mono px-1 py-0.5 rounded border border-[var(--app-border)] bg-[var(--app-bg-primary)] text-[10px]">
                          m
                        </kbd>{' '}
                        leída
                      </span>
                      <span>
                        <kbd className="font-mono px-1 py-0.5 rounded border border-[var(--app-border)] bg-[var(--app-bg-primary)] text-[10px]">
                          e
                        </kbd>{' '}
                        archivar
                      </span>
                      <span>
                        <kbd className="font-mono px-1 py-0.5 rounded border border-[var(--app-border)] bg-[var(--app-bg-primary)] text-[10px]">
                          s
                        </kbd>{' '}
                        posponer
                      </span>
                    </div>

                    <div className="flex items-center gap-2 ml-auto">
                      {inboxView === 'active' && partitioned.snoozed.length > 0 && (
                        <button
                          type="button"
                          onClick={() => {
                            setInboxView('snoozed')
                            setFilter('all')
                          }}
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-500/12 text-amber-600 dark:text-amber-400 font-medium tabular-nums hover:bg-amber-500/20 transition cursor-pointer"
                        >
                          <Clock size={11} weight="bold" />
                          <span>{partitioned.snoozed.length} pospuestas</span>
                        </button>
                      )}
                      {inboxView !== 'active' && (
                        <button
                          type="button"
                          onClick={() => {
                            setInboxView('active')
                            setFilter('all')
                          }}
                          className="font-medium text-[var(--app-accent)] hover:underline cursor-pointer"
                        >
                          Volver a bandeja
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </>
            )}

            {/* Native Viewport-Aware Popover: Views & Extra Categories */}
            <div
              ref={viewPopoverRef}
              id="notif-view-popover"
              {...({ popover: 'auto' } as Record<string, unknown>)}
              style={{ positionAnchor: '--notif-view-anchor' } as CSSProperties}
              className="sn-anchored-popover w-56 text-[12px]"
            >
              <div className="px-2 py-1 text-[10.5px] font-semibold uppercase tracking-[0.04em] text-[var(--app-text-secondary)]">
                Bandeja
              </div>
              <button
                type="button"
                onClick={() => {
                  setInboxView('active')
                  if (filter === 'activity' || filter === 'system') setFilter('all')
                  safeHidePopover(viewPopoverRef.current)
                }}
                className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-md hover:bg-[var(--app-hover)] text-left cursor-pointer"
              >
                <span>Bandeja activa</span>
                {inboxView === 'active' && filter !== 'activity' && filter !== 'system' && (
                  <Check size={13} weight="bold" className="text-[var(--app-accent)]" />
                )}
              </button>
              <button
                type="button"
                onClick={() => {
                  setInboxView('snoozed')
                  setFilter('all')
                  safeHidePopover(viewPopoverRef.current)
                }}
                className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-md hover:bg-[var(--app-hover)] text-left cursor-pointer"
              >
                <span>Pospuestas</span>
                <span className="flex items-center gap-1.5 tabular-nums text-[11px] text-[var(--app-text-secondary)]">
                  {partitioned.snoozed.length}
                  {inboxView === 'snoozed' && (
                    <Check size={13} weight="bold" className="text-[var(--app-accent)]" />
                  )}
                </span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setInboxView('archived')
                  setFilter('all')
                  setConfirmEmptyArchive(false)
                  safeHidePopover(viewPopoverRef.current)
                }}
                className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-md hover:bg-[var(--app-hover)] text-left cursor-pointer"
              >
                <span>Archivadas</span>
                <span className="flex items-center gap-1.5 tabular-nums text-[11px] text-[var(--app-text-secondary)]">
                  {partitioned.archived.length}
                  {inboxView === 'archived' && (
                    <Check size={13} weight="bold" className="text-[var(--app-accent)]" />
                  )}
                </span>
              </button>

              <div className="my-1 border-t border-[var(--app-divider)]" />
              <div className="px-2 py-1 text-[10.5px] font-semibold uppercase tracking-[0.04em] text-[var(--app-text-secondary)]">
                Filtrar por tipo
              </div>
              <button
                type="button"
                onClick={() => {
                  setInboxView('active')
                  setFilter('activity')
                  safeHidePopover(viewPopoverRef.current)
                }}
                className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-md hover:bg-[var(--app-hover)] text-left cursor-pointer"
              >
                <span>Actividad de notas</span>
                {inboxView === 'active' && filter === 'activity' && (
                  <Check size={13} weight="bold" className="text-[var(--app-accent)]" />
                )}
              </button>
              <button
                type="button"
                onClick={() => {
                  setInboxView('active')
                  setFilter('system')
                  safeHidePopover(viewPopoverRef.current)
                }}
                className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-md hover:bg-[var(--app-hover)] text-left cursor-pointer"
              >
                <span>Sistema y sincronización</span>
                {inboxView === 'active' && filter === 'system' && (
                  <Check size={13} weight="bold" className="text-[var(--app-accent)]" />
                )}
              </button>
            </div>

            {/* Native Viewport-Aware Popover: Snooze Presets */}
            <div
              ref={snoozePopoverRef}
              id="notif-snooze-popover"
              {...({ popover: 'auto' } as Record<string, unknown>)}
              style={{ positionAnchor: '--notif-snooze-anchor' } as CSSProperties}
              className="sn-anchored-popover w-56 text-[12px]"
            >
              <div className="px-2 py-1 text-[10.5px] font-semibold uppercase tracking-[0.04em] text-[var(--app-text-secondary)]">
                Posponer hasta
              </div>
              {snoozePresets.map((preset) => (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => {
                    const target = snoozeTarget
                    safeHidePopover(snoozePopoverRef.current)
                    if (target) {
                      void notificationService.snoozeNotificationUntil(
                        target.id,
                        preset.until,
                        preset.label
                      )
                    }
                  }}
                  className="w-full flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-md hover:bg-[var(--app-hover)] text-left cursor-pointer"
                >
                  <span className="text-[var(--app-text-primary)]">{preset.label}</span>
                  <span className="text-[11px] tabular-nums text-[var(--app-text-secondary)]">
                    {preset.hint}
                  </span>
                </button>
              ))}
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  )
}
