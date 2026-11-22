import React, { useEffect, useMemo, useRef, useState } from 'react'
import { toSafeExternalUrl } from '../../lib/securityUtils'
import {
  CalendarBlank,
  CaretDown,
  CaretLeft,
  CaretRight,
  ArrowsClockwise,
  Plus,
  GearSix,
  Clock,
  MapPin,
  LinkSimple,
  Trash,
  PencilSimple,
  Check,
  X,
  UploadSimple,
  WarningCircle,
  VideoCamera,
  SidebarSimple,
  MagnifyingGlass,
  SlidersHorizontal,
  DotsThree,
  FigmaLogo,
  SlackLogo,
  Megaphone,
  TextAlignLeft,
  Users,
  Copy,
} from '@phosphor-icons/react'
import { GOOGLE_APPS_SCRIPT_TEMPLATE } from '../../lib/googleAppsScriptTemplate'
import { toast } from 'sonner'
import {
  useCalendarStore,
  getVisibleEvents,
  eventOccursOnDate,
  isCalendarVisibleToMember,
  toDateKey,
  fromDateKey,
  GOOGLE_CALENDAR_PALETTE,
  LOCAL_CALENDAR_ID,
  type CalendarEventView,
  type CalendarPlatformId,
} from '../../lib/calendarStore'
import {
  TEAM_MEMBERS,
  getCurrentMember,
  subscribeToMemberChanges,
  isUserAdmin,
  type TeamMember,
} from '../../lib/teamAuth'

type FullPageViewMode = 'day' | 'week' | 'month' | 'agenda'

const MONTH_NAMES_ES = [
  'Enero',
  'Febrero',
  'Marzo',
  'Abril',
  'Mayo',
  'Junio',
  'Julio',
  'Agosto',
  'Septiembre',
  'Octubre',
  'Noviembre',
  'Diciembre',
]

const PLATFORM_META: Record<
  CalendarPlatformId,
  { label: string; badgeBg: string; badgeText: string; dotColor: string }
> = {
  meet: {
    label: 'Meeting',
    badgeBg: 'bg-emerald-500/15',
    badgeText: 'text-emerald-700 dark:text-emerald-300',
    dotColor: '#10b981',
  },
  zoom: {
    label: 'Zoom',
    badgeBg: 'bg-sky-500/15',
    badgeText: 'text-sky-700 dark:text-sky-300',
    dotColor: '#0ea5e9',
  },
  figma: {
    label: 'Figma / Diseño',
    badgeBg: 'bg-violet-500/15',
    badgeText: 'text-violet-700 dark:text-violet-300',
    dotColor: '#8b5cf6',
  },
  slack: {
    label: 'Slack',
    badgeBg: 'bg-amber-500/15',
    badgeText: 'text-amber-700 dark:text-amber-300',
    dotColor: '#f59e0b',
  },
  redes: {
    label: 'Redes',
    badgeBg: 'bg-fuchsia-500/15',
    badgeText: 'text-fuchsia-700 dark:text-fuchsia-300',
    dotColor: '#d946ef',
  },
  general: {
    label: 'Evento',
    badgeBg: 'bg-blue-500/15',
    badgeText: 'text-blue-700 dark:text-blue-300',
    dotColor: '#1a73e8',
  },
}

function PlatformIcon({ platform, size = 12 }: { platform: CalendarPlatformId; size?: number }) {
  switch (platform) {
    case 'meet':
    case 'zoom':
      return <VideoCamera size={size} weight="fill" />
    case 'figma':
      return <FigmaLogo size={size} weight="duotone" />
    case 'slack':
      return <SlackLogo size={size} weight="duotone" />
    case 'redes':
      return <Megaphone size={size} weight="duotone" />
    default:
      return <CalendarBlank size={size} weight="duotone" />
  }
}

function getPastelCardStyle(hex: string): React.CSSProperties {
  // Uses CSS color-mix (Baseline Widely Available) for crisp pastel surface in both light & dark modes
  return {
    backgroundColor: `color-mix(in srgb, ${hex} 14%, var(--app-bg-primary))`,
    borderColor: `color-mix(in srgb, ${hex} 28%, transparent)`,
  }
}

function formatTimeShort(iso: string, timeFormat: '24h' | '12h'): string {
  const d = new Date(iso)
  return new Intl.DateTimeFormat(timeFormat === '12h' ? 'en-US' : 'es-ES', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: timeFormat === '12h',
  }).format(d)
}

function formatHourAxis(hour: number, timeFormat: '24h' | '12h'): string {
  if (timeFormat === '24h') return `${String(hour).padStart(2, '0')}:00`
  if (hour === 0) return '12 AM'
  if (hour < 12) return `${hour} AM`
  if (hour === 12) return '12 PM'
  return `${hour - 12} PM`
}

function formatTimeRange(ev: CalendarEventView, timeFormat: '24h' | '12h'): string {
  if (ev.isAllDay) return 'Todo el día'
  return `${formatTimeShort(ev.startIso, timeFormat)} – ${formatTimeShort(ev.endIso, timeFormat)}`
}

function formatFullDateEs(dateKey: string): string {
  const d = fromDateKey(dateKey)
  return new Intl.DateTimeFormat('es-ES', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(d)
}

function extractMeetUrl(ev: CalendarEventView): string | null {
  const haystack = `${ev.url || ''} ${ev.location || ''} ${ev.description || ''}`
  const match = haystack.match(/https:\/\/(?:meet\.google\.com|zoom\.us|teams\.microsoft\.com)\/[^\s<>"')]+/i)
  return match ? match[0] : null
}

function useLightDismissDialog(
  ref: React.RefObject<HTMLDialogElement | null>,
  isOpen: boolean,
  onClose: () => void
) {
  useEffect(() => {
    const dialog = ref.current
    if (!dialog) return
    if (isOpen) {
      if (!dialog.open) dialog.showModal()
    } else if (dialog.open) {
      dialog.close()
    }
  }, [ref, isOpen])

  useEffect(() => {
    const dialog = ref.current
    if (!dialog) return
    const handleClose = () => onClose()
    dialog.addEventListener('close', handleClose)

    const handleFallbackClick = (event: MouseEvent) => {
      if ('closedBy' in HTMLDialogElement.prototype) return
      if (event.target !== dialog) return
      const rect = dialog.getBoundingClientRect()
      const isInside =
        rect.top <= event.clientY &&
        event.clientY <= rect.top + rect.height &&
        rect.left <= event.clientX &&
        event.clientX <= rect.left + rect.width
      if (!isInside) dialog.close()
    }
    dialog.addEventListener('click', handleFallbackClick)
    return () => {
      dialog.removeEventListener('close', handleClose)
      dialog.removeEventListener('click', handleFallbackClick)
    }
  }, [ref, onClose])
}

interface PositionedTimedEvent {
  event: CalendarEventView
  topPx: number
  heightPx: number
  col: number
  totalCols: number
}

function layoutTimedEvents(events: CalendarEventView[], hourHeight: number): PositionedTimedEvent[] {
  const timed = events
    .filter((e) => !e.isAllDay)
    .map((e) => {
      const s = new Date(e.startIso)
      const en = new Date(e.endIso)
      const startMin = s.getHours() * 60 + s.getMinutes()
      let endMin = en.getHours() * 60 + en.getMinutes()
      if (en.getDate() !== s.getDate() || endMin <= startMin) {
        endMin = Math.max(startMin + 45, 24 * 60)
      }
      return { event: e, startMin, endMin: Math.max(startMin + 35, endMin) }
    })
    .sort((a, b) => a.startMin - b.startMin || a.endMin - b.endMin)

  const placed: Array<{
    event: CalendarEventView
    startMin: number
    endMin: number
    col: number
    totalCols: number
  }> = []

  let cluster: typeof timed = []
  let clusterEnd = -1

  const flushCluster = () => {
    if (cluster.length === 0) return
    const colsEnd: number[] = []
    const itemsWithCol = cluster.map((item) => {
      let col = colsEnd.findIndex((end) => end <= item.startMin)
      if (col === -1) {
        col = colsEnd.length
        colsEnd.push(item.endMin)
      } else {
        colsEnd[col] = item.endMin
      }
      return { ...item, col }
    })
    const totalCols = Math.max(1, colsEnd.length)
    for (const it of itemsWithCol) {
      placed.push({ ...it, totalCols })
    }
    cluster = []
    clusterEnd = -1
  }

  for (const item of timed) {
    if (cluster.length > 0 && item.startMin >= clusterEnd) {
      flushCluster()
    }
    cluster.push(item)
    clusterEnd = Math.max(clusterEnd, item.endMin)
  }
  flushCluster()

  return placed.map((p) => ({
    event: p.event,
    topPx: (p.startMin / 60) * hourHeight,
    heightPx: Math.max(64, ((p.endMin - p.startMin) / 60) * hourHeight),
    col: p.col,
    totalCols: p.totalCols,
  }))
}

export function CalendarPage() {
  const {
    sources,
    eventsByCalendar,
    localEvents,
    syncingIds,
    selectedDateKey,
    preferences,
    webhookConfig,
    setSelectedDateKey,
    updatePreferences,
    updateWebhookConfig,
    testWebhookConnection,
    addIcalSource,
    updateSource,
    setSourceMembers,
    removeSource,
    toggleSource,
    syncSource,
    syncAllSources,
    addLocalEvent,
    updateLocalEvent,
    deleteLocalEvent,
    importIcsFile,
    importMyWidgetCache,
  } = useCalendarStore()

  const todayKey = toDateKey(new Date())
  const selectedDate = useMemo(() => fromDateKey(selectedDateKey), [selectedDateKey])
  const [currentMember, setCurrentMemberState] = useState<TeamMember>(() => getCurrentMember())
  const [previewMemberId, setPreviewMemberId] = useState<string | null>(null)
  const [editingAccessCalId, setEditingAccessCalId] = useState<string | null>(null)

  useEffect(() => {
    return subscribeToMemberChanges((m) => {
      setCurrentMemberState(m)
      if (!isUserAdmin(m)) {
        setPreviewMemberId(null)
        setEditingAccessCalId(null)
      }
    })
  }, [])

  const isAdmin = isUserAdmin(currentMember)
  const effectiveMemberId = isAdmin ? previewMemberId || undefined : currentMember.id
  const previewMember = useMemo(
    () => (previewMemberId ? TEAM_MEMBERS.find((m) => m.id === previewMemberId) || null : null),
    [previewMemberId]
  )

  const [pageView, setPageView] = useState<FullPageViewMode>(() =>
    typeof window !== 'undefined' && window.innerWidth < 768 ? 'day' : 'week'
  )
  const [drawerOpen, setDrawerOpen] = useState(() =>
    typeof window !== 'undefined' ? window.innerWidth >= 768 : true
  )
  const [calendarsOpen, setCalendarsOpen] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [showCustomizeMenu, setShowCustomizeMenu] = useState(false)
  const [cursorMonth, setCursorMonth] = useState<{ year: number; month: number }>(() => ({
    year: selectedDate.getFullYear(),
    month: selectedDate.getMonth(),
  }))

  // Modals
  const [detailEvent, setDetailEvent] = useState<CalendarEventView | null>(null)
  const [isManageModalOpen, setIsManageModalOpen] = useState(false)
  const [isEventFormOpen, setIsEventFormOpen] = useState(false)
  const [editingLocalEventId, setEditingLocalEventId] = useState<string | null>(null)

  // Local event form
  const [evTitle, setEvTitle] = useState('')
  const [evDate, setEvDate] = useState(selectedDateKey)
  const [evAllDay, setEvAllDay] = useState(false)
  const [evStartTime, setEvStartTime] = useState('09:00')
  const [evEndTime, setEvEndTime] = useState('10:00')
  const [evLocation, setEvLocation] = useState('')
  const [evDescription, setEvDescription] = useState('')
  const [evPlatform, setEvPlatform] = useState<CalendarPlatformId>('general')
  const [evColor, setEvColor] = useState(GOOGLE_CALENDAR_PALETTE[0].hex)
  const [evTargetCalId, setEvTargetCalId] = useState<string>(LOCAL_CALENDAR_ID)
  const [evTeamMemberIds, setEvTeamMemberIds] = useState<string[]>([TEAM_MEMBERS[0].id])
  const [evReminder, setEvReminder] = useState(true)
  const [showTeamDropdown, setShowTeamDropdown] = useState(false)
  const [isTestingWebhook, setIsTestingWebhook] = useState(false)

  // Add iCal form
  const [newCalName, setNewCalName] = useState('')
  const [newCalUrl, setNewCalUrl] = useState('')
  const [newCalColor, setNewCalColor] = useState(GOOGLE_CALENDAR_PALETTE[0].hex)
  const [isAddingCal, setIsAddingCal] = useState(false)

  // Live current-time line ticker
  const [nowTick, setNowTick] = useState(() => new Date())
  useEffect(() => {
    const id = setInterval(() => setNowTick(new Date()), 60_000)
    return () => clearInterval(id)
  }, [])

  // Auto-sync Google Calendars on mount & every 15 minutes
  useEffect(() => {
    const hasRemote = sources.some((s) => !s.isLocalOnly && s.icalUrl)
    if (hasRemote) {
      syncAllSources()
    }
    const timer = setInterval(() => {
      if (navigator.onLine) syncAllSources()
    }, 15 * 60 * 1000)
    return () => clearInterval(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const HOUR_HEIGHT =
    preferences.hourDensity === 'compact' ? 44 : preferences.hourDensity === 'comfortable' ? 60 : 76

  const isAnySyncing = Object.keys(syncingIds).length > 0
  const hasRemoteCalendars = sources.some((s) => !s.isLocalOnly && s.icalUrl)

  const visibleSources = useMemo(() => {
    if (!effectiveMemberId) return sources
    return sources.filter((src) => isCalendarVisibleToMember(src, effectiveMemberId))
  }, [sources, effectiveMemberId])

  const allVisibleEvents = useMemo(() => {
    const base = getVisibleEvents(sources, eventsByCalendar, localEvents, effectiveMemberId)
    const q = searchQuery.trim().toLowerCase()
    if (!q) return base
    return base.filter(
      (ev) =>
        ev.title.toLowerCase().includes(q) ||
        ev.description.toLowerCase().includes(q) ||
        ev.location.toLowerCase().includes(q) ||
        ev.calendarName.toLowerCase().includes(q)
    )
  }, [sources, eventsByCalendar, localEvents, effectiveMemberId, searchQuery])

  const weekdayLabelsMini =
    preferences.weekStartsOn === 'sunday'
      ? ['D', 'L', 'M', 'X', 'J', 'V', 'S']
      : ['L', 'M', 'X', 'J', 'V', 'S', 'D']

  const weekdayLabelsFull =
    preferences.weekStartsOn === 'sunday'
      ? ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']
      : ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo']

  // 42-day grid for cursorMonth
  const monthGrid = useMemo(() => {
    const firstOfMonth = new Date(cursorMonth.year, cursorMonth.month, 1)
    const jsDay = firstOfMonth.getDay()
    const offset = preferences.weekStartsOn === 'sunday' ? jsDay : (jsDay + 6) % 7
    const gridStart = new Date(cursorMonth.year, cursorMonth.month, 1 - offset)

    const cells: Array<{
      dateKey: string
      dayNumber: number
      inCurrentMonth: boolean
      events: CalendarEventView[]
    }> = []

    for (let i = 0; i < 42; i++) {
      const d = new Date(gridStart.getFullYear(), gridStart.getMonth(), gridStart.getDate() + i)
      const key = toDateKey(d)
      const events = allVisibleEvents.filter((ev) => eventOccursOnDate(ev, key))
      cells.push({
        dateKey: key,
        dayNumber: d.getDate(),
        inCurrentMonth: d.getMonth() === cursorMonth.month,
        events,
      })
    }
    return cells
  }, [cursorMonth, allVisibleEvents, preferences.weekStartsOn])

  // Week days (7 days) containing selectedDateKey
  const weekDays = useMemo(() => {
    const d = fromDateKey(selectedDateKey)
    const jsDay = d.getDay()
    const offset = preferences.weekStartsOn === 'sunday' ? jsDay : (jsDay + 6) % 7
    const weekStart = new Date(d.getFullYear(), d.getMonth(), d.getDate() - offset)
    return Array.from({ length: 7 }, (_, i) => {
      const cur = new Date(weekStart.getFullYear(), weekStart.getMonth(), weekStart.getDate() + i)
      const key = toDateKey(cur)
      const events = allVisibleEvents.filter((ev) => eventOccursOnDate(ev, key))
      return {
        dateKey: key,
        dayNumber: cur.getDate(),
        weekdayLabel: weekdayLabelsFull[i],
        events,
        allDayEvents: events.filter((e) => e.isAllDay),
        timedPositioned: layoutTimedEvents(events, HOUR_HEIGHT),
      }
    })
  }, [selectedDateKey, allVisibleEvents, preferences.weekStartsOn, weekdayLabelsFull, HOUR_HEIGHT])

  // Day view data
  const timelineScrollRef = useRef<HTMLDivElement | null>(null)
  const selectedDayEvents = useMemo(
    () => allVisibleEvents.filter((ev) => eventOccursOnDate(ev, selectedDateKey)),
    [allVisibleEvents, selectedDateKey]
  )
  const dayAllDayEvents = useMemo(
    () => selectedDayEvents.filter((e) => e.isAllDay),
    [selectedDayEvents]
  )
  const dayTimedPositioned = useMemo(
    () => layoutTimedEvents(selectedDayEvents, HOUR_HEIGHT),
    [selectedDayEvents, HOUR_HEIGHT]
  )

  useEffect(() => {
    if ((pageView === 'week' || pageView === 'day') && timelineScrollRef.current) {
      const targetHour = selectedDateKey === todayKey ? Math.max(0, new Date().getHours() - 2) : 8
      timelineScrollRef.current.scrollTop = targetHour * HOUR_HEIGHT
    }
  }, [pageView, selectedDateKey, todayKey, HOUR_HEIGHT])

  // Agenda 45 days
  const agendaGroups = useMemo(() => {
    const start = fromDateKey(selectedDateKey)
    const groups: Array<{ dateKey: string; label: string; events: CalendarEventView[] }> = []
    for (let i = 0; i < 45; i++) {
      const d = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i)
      const key = toDateKey(d)
      const events = allVisibleEvents.filter((ev) => eventOccursOnDate(ev, key))
      if (events.length === 0 && i > 0) continue
      groups.push({
        dateKey: key,
        label: key === todayKey ? `Hoy · ${formatFullDateEs(key)}` : formatFullDateEs(key),
        events,
      })
    }
    return groups
  }, [allVisibleEvents, selectedDateKey, todayKey])

  const handleGoToday = () => {
    const now = new Date()
    setSelectedDateKey(toDateKey(now))
    setCursorMonth({ year: now.getFullYear(), month: now.getMonth() })
  }

  const handlePrev = () => {
    if (pageView === 'day') {
      const d = fromDateKey(selectedDateKey)
      d.setDate(d.getDate() - 1)
      setSelectedDateKey(toDateKey(d))
      setCursorMonth({ year: d.getFullYear(), month: d.getMonth() })
    } else if (pageView === 'week' || pageView === 'agenda') {
      const d = fromDateKey(selectedDateKey)
      d.setDate(d.getDate() - 7)
      setSelectedDateKey(toDateKey(d))
      setCursorMonth({ year: d.getFullYear(), month: d.getMonth() })
    } else {
      const d = new Date(cursorMonth.year, cursorMonth.month - 1, 1)
      setCursorMonth({ year: d.getFullYear(), month: d.getMonth() })
    }
  }

  const handleNext = () => {
    if (pageView === 'day') {
      const d = fromDateKey(selectedDateKey)
      d.setDate(d.getDate() + 1)
      setSelectedDateKey(toDateKey(d))
      setCursorMonth({ year: d.getFullYear(), month: d.getMonth() })
    } else if (pageView === 'week' || pageView === 'agenda') {
      const d = fromDateKey(selectedDateKey)
      d.setDate(d.getDate() + 7)
      setSelectedDateKey(toDateKey(d))
      setCursorMonth({ year: d.getFullYear(), month: d.getMonth() })
    } else {
      const d = new Date(cursorMonth.year, cursorMonth.month + 1, 1)
      setCursorMonth({ year: d.getFullYear(), month: d.getMonth() })
    }
  }

  const openCreateEvent = (presetDateKey = selectedDateKey, presetHour?: number) => {
    setEditingLocalEventId(null)
    setEvTitle('')
    setEvDate(presetDateKey)
    setEvAllDay(false)
    if (presetHour !== undefined) {
      const h1 = String(presetHour).padStart(2, '0')
      const h2 = String(Math.min(23, presetHour + 1)).padStart(2, '0')
      setEvStartTime(`${h1}:00`)
      setEvEndTime(`${h2}:00`)
    } else {
      setEvStartTime('09:00')
      setEvEndTime('10:00')
    }
    setEvLocation('')
    setEvDescription('')
    setEvPlatform('general')
    setEvColor(GOOGLE_CALENDAR_PALETTE[0].hex)
    setEvTeamMemberIds([currentMember.id])
    setEvReminder(true)
    setShowTeamDropdown(false)
    setEvTargetCalId(
      webhookConfig.enabled
        ? sources.find((s) => !s.isLocalOnly && s.enabled)?.id || LOCAL_CALENDAR_ID
        : LOCAL_CALENDAR_ID
    )
    setIsEventFormOpen(true)
  }

  const openEditLocalEvent = (ev: CalendarEventView) => {
    setDetailEvent(null)
    setEditingLocalEventId(ev.id)
    setEvTitle(ev.title)
    setEvDate(ev.startIso.slice(0, 10))
    setEvAllDay(ev.isAllDay)
    if (!ev.isAllDay) {
      const s = new Date(ev.startIso)
      const e = new Date(ev.endIso)
      setEvStartTime(`${String(s.getHours()).padStart(2, '0')}:${String(s.getMinutes()).padStart(2, '0')}`)
      setEvEndTime(`${String(e.getHours()).padStart(2, '0')}:${String(e.getMinutes()).padStart(2, '0')}`)
    }
    setEvLocation(ev.location || '')
    setEvDescription(ev.description || '')
    setEvPlatform(ev.platform || 'general')
    setEvColor(ev.color || GOOGLE_CALENDAR_PALETTE[0].hex)
    setEvTargetCalId(ev.targetCalendarId || LOCAL_CALENDAR_ID)
    setEvTeamMemberIds(ev.teamMemberIds && ev.teamMemberIds.length > 0 ? ev.teamMemberIds : [currentMember.id])
    setEvReminder(ev.reminder ?? true)
    setShowTeamDropdown(false)
    setIsEventFormOpen(true)
  }

  const handleSaveLocalEvent = (e: React.FormEvent) => {
    e.preventDefault()
    if (!evTitle.trim()) {
      toast.error('Escribe un título para el evento')
      return
    }
    let startIso: string
    let endIso: string
    if (evAllDay) {
      const d = fromDateKey(evDate)
      const next = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1)
      startIso = `${evDate}T00:00:00`
      endIso = `${toDateKey(next)}T00:00:00`
    } else {
      const [sh, sm] = evStartTime.split(':').map(Number)
      const [eh, em] = evEndTime.split(':').map(Number)
      const base = fromDateKey(evDate)
      const start = new Date(base.getFullYear(), base.getMonth(), base.getDate(), sh || 0, sm || 0)
      let end = new Date(base.getFullYear(), base.getMonth(), base.getDate(), eh || 0, em || 0)
      if (end <= start) end = new Date(start.getTime() + 3600000)
      startIso = start.toISOString()
      endIso = end.toISOString()
    }

    if (editingLocalEventId) {
      updateLocalEvent(editingLocalEventId, {
        title: evTitle.trim(),
        startIso,
        endIso,
        isAllDay: evAllDay,
        location: evLocation.trim(),
        description: evDescription.trim(),
        platform: evPlatform,
        colorOverride: evColor,
        targetCalendarId: evTargetCalId,
        teamMemberIds: evTeamMemberIds,
        reminder: evReminder,
      })
      toast.success('Evento actualizado')
    } else {
      addLocalEvent({
        title: evTitle.trim(),
        startIso,
        endIso,
        isAllDay: evAllDay,
        location: evLocation.trim(),
        description: evDescription.trim(),
        platform: evPlatform,
        colorOverride: evColor,
        targetCalendarId: evTargetCalId,
        teamMemberIds: evTeamMemberIds,
        reminder: evReminder,
      })
      const targetSrc = sources.find((s) => s.id === evTargetCalId)
      if (webhookConfig.enabled && targetSrc && !targetSrc.isLocalOnly) {
        toast.success(`Evento creado y enviado a ${targetSrc.name}`)
      } else {
        toast.success('Evento creado')
      }
    }
    setIsEventFormOpen(false)
  }

  const handleAddIcal = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newCalUrl.trim()) {
      toast.error('Pega la URL secreta o pública iCal de Google Calendar')
      return
    }
    setIsAddingCal(true)
    try {
      const added = await addIcalSource({
        name: newCalName.trim() || 'Google Calendar',
        icalUrl: newCalUrl.trim(),
        color: newCalColor,
      })
      if (added.lastError) {
        toast.error(`Calendario guardado, pero falló la sincronización: ${added.lastError}`)
      } else {
        toast.success(`Conectado "${added.name}" (${added.eventCount || 0} eventos)`)
      }
      setNewCalName('')
      setNewCalUrl('')
    } finally {
      setIsAddingCal(false)
    }
  }

  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      const text = await file.text()
      if (file.name.toLowerCase().endsWith('.json')) {
        const count = importMyWidgetCache(text, `My Widget (${file.name})`)
        toast.success(`Importados ${count} eventos desde caché de My Widget`)
      } else {
        const count = importIcsFile(file.name, text)
        toast.success(`Importados ${count} eventos desde ${file.name}`)
      }
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'No se pudo importar el archivo')
    } finally {
      e.target.value = ''
    }
  }

  const detailDialogRef = useRef<HTMLDialogElement | null>(null)
  const manageDialogRef = useRef<HTMLDialogElement | null>(null)
  const eventFormDialogRef = useRef<HTMLDialogElement | null>(null)

  useLightDismissDialog(detailDialogRef, Boolean(detailEvent), () => setDetailEvent(null))
  useLightDismissDialog(manageDialogRef, isManageModalOpen, () => setIsManageModalOpen(false))
  useLightDismissDialog(eventFormDialogRef, isEventFormOpen, () => setIsEventFormOpen(false))

  const currentMinuteTopPx = ((nowTick.getHours() * 60 + nowTick.getMinutes()) / 60) * HOUR_HEIGHT
  const currentTimePillLabel = formatTimeShort(nowTick.toISOString(), preferences.timeFormat)

  return (
    <div className="flex-1 h-full flex flex-col bg-[var(--app-bg-primary)] text-[var(--app-text-primary)] overflow-hidden select-none">
      {/* Top Skejulio-inspired Header */}
      <header className="min-h-14 py-2 px-2.5 sm:px-4 border-b border-[var(--app-border)] flex flex-wrap items-center justify-between gap-2 shrink-0 bg-[var(--app-bg-primary)]">
        <div className="flex items-center gap-1.5 sm:gap-2.5 min-w-0">
          <button
            type="button"
            onClick={() => setDrawerOpen((p) => !p)}
            className="p-1.5 rounded-lg hover:bg-black/[0.05] dark:hover:bg-white/[0.08] text-neutral-500 dark:text-neutral-400 cursor-pointer transition shrink-0"
            title={drawerOpen ? 'Ocultar panel lateral' : 'Mostrar panel lateral'}
          >
            <SidebarSimple size={18} />
          </button>

          {/* Segmented View Switcher: Día | Semana | Mes | Agenda */}
          <div className="flex items-center p-0.5 rounded-lg bg-black/[0.04] dark:bg-white/[0.06] border border-[var(--app-border)] shrink-0">
            {(
              [
                { id: 'day', label: 'Día' },
                { id: 'week', label: 'Semana' },
                { id: 'month', label: 'Mes' },
                { id: 'agenda', label: 'Agenda' },
              ] as Array<{ id: FullPageViewMode; label: string }>
            ).map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setPageView(tab.id)}
                className={`px-2 sm:px-3 py-1 rounded-md text-[11px] sm:text-xs font-medium transition cursor-pointer ${
                  pageView === tab.id
                    ? 'bg-white dark:bg-[#2c2c2c] text-[var(--app-text-primary)] shadow-xs'
                    : 'text-neutral-500 dark:text-neutral-400 hover:text-[var(--app-text-primary)]'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={handleGoToday}
            className="px-2 sm:px-2.5 py-1.5 rounded-lg border border-[var(--app-border)] hover:bg-black/[0.04] dark:hover:bg-white/[0.06] text-[11px] sm:text-xs font-medium cursor-pointer transition shrink-0"
          >
            Hoy
          </button>

          <div className="flex items-center gap-0.5 shrink-0">
            <button
              type="button"
              onClick={handlePrev}
              className="p-1.5 rounded-lg hover:bg-black/[0.05] dark:hover:bg-white/[0.08] text-neutral-500 cursor-pointer"
              title="Anterior"
            >
              <CaretLeft size={14} weight="bold" />
            </button>
            <button
              type="button"
              onClick={handleNext}
              className="p-1.5 rounded-lg hover:bg-black/[0.05] dark:hover:bg-white/[0.08] text-neutral-500 cursor-pointer"
              title="Siguiente"
            >
              <CaretRight size={14} weight="bold" />
            </button>
            <span className="text-xs sm:text-sm font-semibold tracking-tight ml-1 hidden sm:inline">
              {MONTH_NAMES_ES[cursorMonth.month]} {cursorMonth.year}
            </span>
          </div>
        </div>

        {/* Right Controls: Search, Personalizar, Sync, + Nuevo */}
        <div className="flex items-center gap-2 shrink-0 relative">
          <div className="relative hidden lg:block w-52">
            <MagnifyingGlass size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-neutral-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar evento o nota..."
              className="w-full pl-8 pr-6 py-1.5 rounded-lg bg-black/[0.03] dark:bg-white/[0.05] border border-[var(--app-border)] text-xs outline-none focus:border-neutral-400 dark:focus:border-neutral-500"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-[var(--app-text-primary)] cursor-pointer"
              >
                <X size={12} />
              </button>
            )}
          </div>

          <button
            type="button"
            onClick={() => setShowCustomizeMenu((p) => !p)}
            className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-[var(--app-border)] text-xs font-medium cursor-pointer transition ${
              showCustomizeMenu
                ? 'bg-black/[0.06] dark:bg-white/[0.1]'
                : 'hover:bg-black/[0.04] dark:hover:bg-white/[0.06]'
            }`}
            title="Personalizar vista del almanaque"
          >
            <SlidersHorizontal size={14} />
            <span className="hidden sm:inline">Personalizar</span>
          </button>

          {showCustomizeMenu && (
            <>
              <div className="fixed inset-0 z-30" onClick={() => setShowCustomizeMenu(false)} />
              <div className="absolute right-0 top-11 z-40 w-64 rounded-xl bg-white dark:bg-[#232325] border border-[var(--app-border)] shadow-xl p-3 space-y-3 text-xs">
                <div className="font-semibold text-xs">Personalizar Almanaque</div>

                <div className="space-y-1">
                  <div className="text-[10.5px] uppercase tracking-wider text-neutral-500 font-semibold">
                    Estilo de tarjetas
                  </div>
                  <div className="grid grid-cols-2 gap-1">
                    {(
                      [
                        { id: 'pastel', label: 'Pastel Skejulio' },
                        { id: 'classic', label: 'Clásico Google' },
                      ] as const
                    ).map((opt) => (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => updatePreferences({ cardStyle: opt.id })}
                        className={`py-1.5 px-2 rounded-lg border text-[11px] font-medium cursor-pointer transition ${
                          preferences.cardStyle === opt.id
                            ? 'border-neutral-900 dark:border-white bg-neutral-900 text-white dark:bg-white dark:text-neutral-900'
                            : 'border-[var(--app-border)] hover:bg-black/[0.04] dark:hover:bg-white/[0.06]'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-1">
                  <div className="text-[10.5px] uppercase tracking-wider text-neutral-500 font-semibold">
                    Formato de hora
                  </div>
                  <div className="grid grid-cols-2 gap-1">
                    {(
                      [
                        { id: '12h', label: '12h (AM/PM)' },
                        { id: '24h', label: '24h (14:00)' },
                      ] as const
                    ).map((opt) => (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => updatePreferences({ timeFormat: opt.id })}
                        className={`py-1.5 px-2 rounded-lg border text-[11px] font-medium cursor-pointer transition ${
                          preferences.timeFormat === opt.id
                            ? 'border-neutral-900 dark:border-white bg-neutral-900 text-white dark:bg-white dark:text-neutral-900'
                            : 'border-[var(--app-border)] hover:bg-black/[0.04] dark:hover:bg-white/[0.06]'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-1">
                  <div className="text-[10.5px] uppercase tracking-wider text-neutral-500 font-semibold">
                    Inicio de semana
                  </div>
                  <div className="grid grid-cols-2 gap-1">
                    {(
                      [
                        { id: 'monday', label: 'Lunes' },
                        { id: 'sunday', label: 'Domingo' },
                      ] as const
                    ).map((opt) => (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => updatePreferences({ weekStartsOn: opt.id })}
                        className={`py-1.5 px-2 rounded-lg border text-[11px] font-medium cursor-pointer transition ${
                          preferences.weekStartsOn === opt.id
                            ? 'border-neutral-900 dark:border-white bg-neutral-900 text-white dark:bg-white dark:text-neutral-900'
                            : 'border-[var(--app-border)] hover:bg-black/[0.04] dark:hover:bg-white/[0.06]'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-1">
                  <div className="text-[10.5px] uppercase tracking-wider text-neutral-500 font-semibold">
                    Densidad horaria
                  </div>
                  <div className="grid grid-cols-3 gap-1">
                    {(
                      [
                        { id: 'compact', label: 'Compacta' },
                        { id: 'comfortable', label: 'Cómoda' },
                        { id: 'spacious', label: 'Amplia' },
                      ] as const
                    ).map((opt) => (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => updatePreferences({ hourDensity: opt.id })}
                        className={`py-1.5 px-1.5 rounded-lg border text-[11px] font-medium cursor-pointer transition ${
                          preferences.hourDensity === opt.id
                            ? 'border-neutral-900 dark:border-white bg-neutral-900 text-white dark:bg-white dark:text-neutral-900'
                            : 'border-[var(--app-border)] hover:bg-black/[0.04] dark:hover:bg-white/[0.06]'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </>
          )}

          <button
            type="button"
            onClick={() => syncAllSources()}
            disabled={isAnySyncing || !hasRemoteCalendars}
            className="p-1.5 rounded-lg border border-[var(--app-border)] hover:bg-black/[0.04] dark:hover:bg-white/[0.06] disabled:opacity-40 cursor-pointer transition"
            title="Sincronizar Google Calendars"
          >
            <ArrowsClockwise size={15} className={isAnySyncing ? 'animate-spin text-purple-400' : ''} />
          </button>

          <button
            type="button"
            onClick={() => setIsManageModalOpen(true)}
            className="p-1.5 rounded-lg border border-[var(--app-border)] hover:bg-black/[0.04] dark:hover:bg-white/[0.06] cursor-pointer transition"
            title="Gestionar iCal de Google Calendar"
          >
            <GearSix size={15} />
          </button>

          <button
            type="button"
            onClick={() => openCreateEvent(selectedDateKey)}
            className="inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg bg-neutral-900 hover:bg-neutral-800 text-white dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-200 text-xs font-semibold cursor-pointer transition shadow-xs"
            title="Nuevo evento"
          >
            <Plus size={13} weight="bold" />
            <span className="hidden sm:inline">Nuevo</span>
          </button>
        </div>
      </header>

      {/* Main Body */}
      <div className="flex-1 flex min-h-0 overflow-hidden relative">
        {drawerOpen && (
          <>
            <div
              className="fixed inset-0 z-30 bg-black/45 backdrop-blur-xs md:hidden"
              onClick={() => setDrawerOpen(false)}
            />
            <aside className="fixed inset-y-0 left-0 z-40 w-72 max-w-[85vw] shadow-2xl md:static md:w-64 md:shadow-none shrink-0 border-r border-[var(--app-border)] bg-[var(--obsidian-sidebar-bg,#181818)] p-3 flex flex-col gap-4 overflow-y-auto custom-scrollbar">
            {/* Mini Month Picker Card */}
            <div className="space-y-2">
              <div className="flex items-center justify-between px-1">
                <button
                  type="button"
                  onClick={() => {
                    const d = new Date(cursorMonth.year, cursorMonth.month - 1, 1)
                    setCursorMonth({ year: d.getFullYear(), month: d.getMonth() })
                  }}
                  className="p-1 rounded-md border border-[var(--app-border)] hover:bg-black/[0.05] dark:hover:bg-white/[0.08] cursor-pointer"
                >
                  <CaretLeft size={12} />
                </button>
                <span className="text-xs font-semibold">
                  {MONTH_NAMES_ES[cursorMonth.month]} {cursorMonth.year}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    const d = new Date(cursorMonth.year, cursorMonth.month + 1, 1)
                    setCursorMonth({ year: d.getFullYear(), month: d.getMonth() })
                  }}
                  className="p-1 rounded-md border border-[var(--app-border)] hover:bg-black/[0.05] dark:hover:bg-white/[0.08] cursor-pointer"
                >
                  <CaretRight size={12} />
                </button>
              </div>

              <div className="grid grid-cols-7 text-center text-[10px] font-semibold text-neutral-400">
                {weekdayLabelsMini.map((d, idx) => (
                  <span key={`${d}-${idx}`} className="py-0.5">
                    {d}
                  </span>
                ))}
              </div>

              <div className="grid grid-cols-7 gap-y-0.5 text-center">
                {monthGrid.map((cell) => {
                  const isToday = cell.dateKey === todayKey
                  const isSelected = cell.dateKey === selectedDateKey
                  const hasEvents = cell.events.length > 0
                  return (
                    <button
                      key={`mini-${cell.dateKey}`}
                      type="button"
                      onClick={() => setSelectedDateKey(cell.dateKey)}
                      className={`relative h-7 w-7 mx-auto rounded-full text-[11px] flex flex-col items-center justify-center tabular-nums cursor-pointer transition ${
                        isSelected
                          ? 'bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 font-semibold'
                          : isToday
                          ? 'ring-1 ring-neutral-900 dark:ring-white font-semibold'
                          : 'hover:bg-black/[0.05] dark:hover:bg-white/[0.08]'
                      } ${!cell.inCurrentMonth ? 'opacity-35' : ''}`}
                    >
                      <span>{cell.dayNumber}</span>
                      {hasEvents && !isSelected && (
                        <span
                          className="w-1 h-1 rounded-full absolute bottom-0.5"
                          style={{ backgroundColor: cell.events[0].color }}
                        />
                      )}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Mis Calendarios (Skejulio pill cards) */}
            <div className="space-y-1.5 pt-2 border-t border-[var(--app-border)]">
              <div className="flex items-center justify-between px-0.5">
                <button
                  type="button"
                  onClick={() => setCalendarsOpen((p) => !p)}
                  className="flex items-center gap-1 text-xs font-semibold cursor-pointer"
                >
                  <span>Mis calendarios</span>
                  {calendarsOpen ? <CaretDown size={11} /> : <CaretRight size={11} />}
                </button>
                <button
                  type="button"
                  onClick={() => setIsManageModalOpen(true)}
                  className="p-1 rounded-md hover:bg-black/[0.05] dark:hover:bg-white/[0.08] text-neutral-400 hover:text-[var(--app-text-primary)] cursor-pointer"
                  title="Conectar Google Calendar"
                >
                  <Plus size={13} />
                </button>
              </div>

              {calendarsOpen && (
                <div className="space-y-1.5">
                  {visibleSources.map((src) => {
                    const isSyncing = Boolean(syncingIds[src.id])
                    const assignedMembers =
                      !src.visibleToMemberIds || src.visibleToMemberIds.length === 0
                        ? TEAM_MEMBERS
                        : TEAM_MEMBERS.filter((m) => src.visibleToMemberIds?.includes(m.id))
                    const isAllMembers =
                      !src.visibleToMemberIds ||
                      src.visibleToMemberIds.length === 0 ||
                      src.visibleToMemberIds.length >= TEAM_MEMBERS.length

                    return (
                      <div key={src.id} className="space-y-1">
                        <div className="flex items-center justify-between gap-1.5 px-2.5 py-2 rounded-lg border border-[var(--app-border)] bg-white/50 dark:bg-white/[0.025] hover:bg-black/[0.03] dark:hover:bg-white/[0.05] transition">
                          <button
                            type="button"
                            onClick={() => toggleSource(src.id)}
                            className="flex items-center gap-2 min-w-0 flex-1 text-left cursor-pointer"
                          >
                            <span
                              className="w-3.5 h-3.5 rounded-[4px] flex items-center justify-center shrink-0 border transition"
                              style={{
                                backgroundColor: src.enabled ? src.color : 'transparent',
                                borderColor: src.color,
                              }}
                            >
                              {src.enabled && <Check size={9} weight="bold" className="text-white" />}
                            </span>
                            <span className="text-[11.5px] font-medium truncate">{src.name}</span>
                          </button>

                          {/* Worker visibility indicator / quick editor for Admins */}
                          {isAdmin && (
                            <button
                              type="button"
                              onClick={() =>
                                setEditingAccessCalId((prev) => (prev === src.id ? null : src.id))
                              }
                              title={
                                isAllMembers
                                  ? 'Visible para todos los trabajadores (clic para editar)'
                                  : `Visible para: ${assignedMembers.map((m) => m.name).join(', ')}`
                              }
                              className="flex items-center -space-x-1 shrink-0 cursor-pointer hover:opacity-80 transition"
                            >
                              {isAllMembers ? (
                                <span className="px-1.5 py-0.5 rounded-full text-[9px] font-semibold bg-black/[0.05] dark:bg-white/[0.08] text-neutral-500">
                                  Todos
                                </span>
                              ) : (
                                assignedMembers.slice(0, 4).map((m) => (
                                  <span
                                    key={m.id}
                                    className="w-4 h-4 rounded-full text-[8.5px] font-bold text-white flex items-center justify-center ring-1 ring-white dark:ring-[#181818]"
                                    style={{ backgroundColor: m.color }}
                                  >
                                    {m.initial}
                                  </span>
                                ))
                              )}
                            </button>
                          )}

                          {/* Quick color cycle dot */}
                          <button
                            type="button"
                            onClick={() => {
                              const idx = GOOGLE_CALENDAR_PALETTE.findIndex((c) => c.hex === src.color)
                              const next = GOOGLE_CALENDAR_PALETTE[(idx + 1) % GOOGLE_CALENDAR_PALETTE.length]
                              updateSource(src.id, { color: next.hex })
                            }}
                            title="Cambiar color del calendario"
                            className="w-2.5 h-2.5 rounded-full shrink-0 cursor-pointer hover:scale-125 transition"
                            style={{ backgroundColor: src.color }}
                          />

                          {isSyncing && <ArrowsClockwise size={11} className="animate-spin text-purple-400 shrink-0" />}
                          {!isSyncing && src.lastError && (
                            <span title={src.lastError} className="text-rose-500 shrink-0">
                              <WarningCircle size={12} weight="fill" />
                            </span>
                          )}
                        </div>

                        {/* Inline Worker Access Editor for Admins */}
                        {isAdmin && editingAccessCalId === src.id && (
                          <div className="px-2 py-1.5 rounded-lg border border-[var(--app-border)] bg-black/[0.025] dark:bg-white/[0.03] space-y-1.5">
                            <div className="flex items-center justify-between text-[10px] text-neutral-500 font-semibold">
                              <span>Visible para trabajadores:</span>
                              <button
                                type="button"
                                onClick={() => setSourceMembers(src.id, [])}
                                className="text-blue-500 hover:underline cursor-pointer"
                              >
                                Todos
                              </button>
                            </div>
                            <div className="flex flex-wrap gap-1">
                              {TEAM_MEMBERS.map((m) => {
                                const active = isCalendarVisibleToMember(src, m.id)
                                return (
                                  <button
                                    key={m.id}
                                    type="button"
                                    onClick={() => {
                                      const currentIds =
                                        !src.visibleToMemberIds || src.visibleToMemberIds.length === 0
                                          ? TEAM_MEMBERS.map((tm) => tm.id)
                                          : src.visibleToMemberIds
                                      const nextIds = currentIds.includes(m.id)
                                        ? currentIds.filter((id) => id !== m.id)
                                        : [...currentIds, m.id]
                                      if (nextIds.length === 0) {
                                        toast.error('Deja al menos 1 trabajador o usa "Todos"')
                                        return
                                      }
                                      setSourceMembers(
                                        src.id,
                                        nextIds.length >= TEAM_MEMBERS.length ? [] : nextIds
                                      )
                                    }}
                                    className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-medium border cursor-pointer transition ${
                                      active
                                        ? 'border-transparent text-white'
                                        : 'border-[var(--app-border)] text-neutral-400 opacity-60'
                                    }`}
                                    style={active ? { backgroundColor: m.color } : undefined}
                                  >
                                    <span>{m.name}</span>
                                  </button>
                                )
                              })}
                            </div>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            {/* Bottom-left Trabajadores / Equipo Avatar Strip (Skejulio style) */}
            {isAdmin && (
              <div className="mt-auto pt-3 border-t border-[var(--app-border)] space-y-2">
                <div className="flex items-center justify-between text-[10.5px] text-neutral-500 font-semibold">
                  <span className="flex items-center gap-1">
                    <Users size={12} />
                    <span>Ver como trabajador</span>
                  </span>
                  {previewMember && (
                    <button
                      type="button"
                      onClick={() => setPreviewMemberId(null)}
                      className="text-blue-500 hover:underline cursor-pointer"
                    >
                      Ver todo
                    </button>
                  )}
                </div>

                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center -space-x-1.5">
                    {TEAM_MEMBERS.map((m) => {
                      const isPreviewing = previewMemberId === m.id
                      const countForMember = sources.filter((s) =>
                        isCalendarVisibleToMember(s, m.id)
                      ).length
                      return (
                        <button
                          key={m.id}
                          type="button"
                          onClick={() =>
                            setPreviewMemberId((prev) => (prev === m.id ? null : m.id))
                          }
                          title={`${m.name} (${m.role === 'admin' ? 'Admin' : 'Trabajador'}) · Ve ${countForMember} calendarios`}
                          className={`w-7 h-7 rounded-full text-[11px] font-bold text-white flex items-center justify-center cursor-pointer transition hover:scale-110 hover:z-10 ${
                            isPreviewing
                              ? 'ring-2 ring-offset-2 ring-purple-500 dark:ring-offset-[#181818] z-10 scale-110'
                              : 'ring-2 ring-white dark:ring-[#181818]'
                          }`}
                          style={{ backgroundColor: m.color }}
                        >
                          {m.initial}
                        </button>
                      )
                    })}
                  </div>
                  <span className="text-[10.5px] text-neutral-400 truncate">
                    {previewMember ? previewMember.name : 'Todos'}
                  </span>
                </div>
              </div>
            )}
          </aside>
          </>
        )}

        {/* Main Calendar Canvas */}
        <main className="flex-1 flex flex-col min-w-0 min-h-0 overflow-hidden">
          {previewMember && (
            <div className="px-4 py-1.5 bg-purple-500/10 border-b border-purple-500/20 flex items-center justify-between text-xs shrink-0">
              <div className="flex items-center gap-2">
                <span
                  className="w-5 h-5 rounded-full text-[10px] font-bold text-white flex items-center justify-center"
                  style={{ backgroundColor: previewMember.color }}
                >
                  {previewMember.initial}
                </span>
                <span>
                  Viendo los calendarios asignados a <strong>{previewMember.name}</strong> ({visibleSources.length}{' '}
                  {visibleSources.length === 1 ? 'calendario' : 'calendarios'})
                </span>
              </div>
              <button
                type="button"
                onClick={() => setPreviewMemberId(null)}
                className="text-purple-400 hover:underline font-medium cursor-pointer"
              >
                Salir de vista previa
              </button>
            </div>
          )}
          {pageView === 'month' && (
            <div className="flex-1 flex flex-col min-h-0 overflow-x-auto">
              <div className="flex-1 flex flex-col min-h-0 min-w-[680px] md:min-w-0">
              <div className="grid grid-cols-7 border-b border-[var(--app-border)] shrink-0">
                {weekdayLabelsFull.map((d) => (
                  <div
                    key={d}
                    className="py-2 text-center text-[11px] font-semibold text-neutral-500 border-r last:border-r-0 border-[var(--app-border)]"
                  >
                    {d}
                  </div>
                ))}
              </div>
              <div className="flex-1 overflow-y-auto custom-scrollbar grid grid-cols-7 auto-rows-[minmax(132px,1fr)]">
                {monthGrid.map((cell) => {
                  const isToday = cell.dateKey === todayKey
                  const isSelected = cell.dateKey === selectedDateKey
                  const visiblePills = cell.events
                  return (
                    <div
                      key={cell.dateKey}
                      onClick={() => setSelectedDateKey(cell.dateKey)}
                      onDoubleClick={() => openCreateEvent(cell.dateKey)}
                      className={`border-r border-b border-[var(--app-border)] p-1.5 flex flex-col gap-1 cursor-pointer transition ${
                        isSelected ? 'bg-black/[0.025] dark:bg-white/[0.03]' : 'hover:bg-black/[0.015] dark:hover:bg-white/[0.02]'
                      } ${!cell.inCurrentMonth ? 'opacity-45 bg-black/[0.01] dark:bg-white/[0.01]' : ''}`}
                    >
                      <div className="flex items-center justify-between shrink-0">
                        <span
                          className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium tabular-nums ${
                            isToday
                              ? 'bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 font-semibold'
                              : isSelected
                              ? 'ring-1 ring-neutral-400 font-semibold'
                              : ''
                          }`}
                        >
                          {cell.dayNumber}
                        </span>
                      </div>

                      <div className="flex-1 flex flex-col gap-1">
                        {visiblePills.map((ev) => {
                          if (preferences.cardStyle === 'pastel') {
                            const plat = ev.platform || 'general'
                            const platMeta = PLATFORM_META[plat]
                            return (
                              <button
                                key={ev.id}
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  setDetailEvent(ev)
                                }}
                                style={getPastelCardStyle(ev.color)}
                                className="w-full rounded-lg border overflow-hidden text-left shadow-2xs hover:shadow-sm transition cursor-pointer shrink-0"
                                title={`${ev.title} (${formatTimeRange(ev, preferences.timeFormat)})`}
                              >
                                <div
                                  className="px-1.5 py-0.5 flex items-center justify-between gap-1"
                                  style={{
                                    backgroundColor: `color-mix(in srgb, ${ev.color} 26%, var(--app-bg-primary))`,
                                  }}
                                >
                                  <span
                                    className={`inline-flex items-center gap-1 px-1 py-0 rounded bg-white/90 dark:bg-[#1e1e20]/90 text-[8.5px] font-medium ${platMeta.badgeText} truncate`}
                                  >
                                    <PlatformIcon platform={plat} size={8} />
                                    <span className="truncate">{ev.calendarName}</span>
                                  </span>
                                  {!ev.isAllDay && (
                                    <span className="text-[8.5px] font-semibold tabular-nums text-neutral-600 dark:text-neutral-300 shrink-0">
                                      {formatTimeShort(ev.startIso, preferences.timeFormat)}
                                    </span>
                                  )}
                                </div>
                                <div className="px-1.5 py-1 text-[10.5px] font-semibold leading-snug break-words text-[var(--app-text-primary)]">
                                  {ev.title}
                                </div>
                              </button>
                            )
                          }

                          return (
                            <button
                              key={ev.id}
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation()
                                setDetailEvent(ev)
                              }}
                              style={
                                ev.isAllDay
                                  ? { backgroundColor: ev.color, color: '#ffffff' }
                                  : { backgroundColor: `${ev.color}20`, borderLeft: `3px solid ${ev.color}` }
                              }
                              className="w-full text-left px-1.5 py-0.5 rounded-md border border-transparent text-[11px] leading-tight truncate cursor-pointer hover:brightness-105 transition flex items-center gap-1"
                              title={`${ev.title} (${formatTimeRange(ev, preferences.timeFormat)})`}
                            >
                              {!ev.isAllDay && (
                                <span className="font-semibold tabular-nums opacity-75 shrink-0">
                                  {formatTimeShort(ev.startIso, preferences.timeFormat)}
                                </span>
                              )}
                              <span className="font-medium truncate">{ev.title}</span>
                            </button>
                          )
                        })}
                      </div>
                    </div>
                  )
                })}
              </div>
              </div>
            </div>
          )}

          {(pageView === 'week' || pageView === 'day') && (
            <div className="flex-1 flex flex-col min-h-0 overflow-x-auto">
              <div
                className={`flex-1 flex flex-col min-h-0 overflow-hidden ${
                  pageView === 'week' ? 'min-w-[760px] md:min-w-0' : 'min-w-0'
                }`}
              >
              {/* Header row for Week / Day */}
              <div className="flex border-b border-[var(--app-border)] shrink-0">
                <div className="w-16 shrink-0 border-r border-[var(--app-border)] flex items-center justify-center text-[10px] font-medium text-neutral-400">
                  GMT
                </div>
                {(pageView === 'week'
                  ? weekDays
                  : [
                      {
                        dateKey: selectedDateKey,
                        dayNumber: selectedDate.getDate(),
                        weekdayLabel:
                          weekdayLabelsFull[
                            preferences.weekStartsOn === 'sunday'
                              ? selectedDate.getDay()
                              : (selectedDate.getDay() + 6) % 7
                          ],
                        allDayEvents: dayAllDayEvents,
                      },
                    ]
                ).map((col) => {
                  const isToday = col.dateKey === todayKey
                  return (
                    <div
                      key={col.dateKey}
                      onClick={() => setSelectedDateKey(col.dateKey)}
                      className="flex-1 min-w-0 border-r last:border-r-0 border-[var(--app-border)] py-2.5 px-2 text-center cursor-pointer"
                    >
                      <div className="inline-flex items-center justify-center gap-1.5">
                        <span className="text-xs font-medium text-neutral-500 dark:text-neutral-400">
                          {col.weekdayLabel}
                        </span>
                        <span
                          className={`px-1.5 py-0.5 rounded-full text-xs font-semibold tabular-nums ${
                            isToday
                              ? 'bg-neutral-900 text-white dark:bg-white dark:text-neutral-900'
                              : 'bg-black/[0.04] dark:bg-white/[0.06] text-neutral-600 dark:text-neutral-300'
                          }`}
                        >
                          {col.dayNumber}
                        </span>
                      </div>

                      {col.allDayEvents.length > 0 && (
                        <div className="mt-2 space-y-1.5 text-left">
                          {col.allDayEvents.map((ev) => {
                            const plat = ev.platform || 'general'
                            const platMeta = PLATFORM_META[plat]
                            const srcObj = sources.find((s) => s.id === ev.calendarId)
                            const cardMembers =
                              ev.teamMemberIds && ev.teamMemberIds.length > 0
                                ? TEAM_MEMBERS.filter((m) => ev.teamMemberIds?.includes(m.id))
                                : !srcObj?.visibleToMemberIds || srcObj.visibleToMemberIds.length === 0
                                ? TEAM_MEMBERS
                                : TEAM_MEMBERS.filter((m) => srcObj.visibleToMemberIds?.includes(m.id))

                            if (preferences.cardStyle !== 'pastel') {
                              return (
                                <button
                                  key={ev.id}
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    setDetailEvent(ev)
                                  }}
                                  style={{ backgroundColor: ev.color }}
                                  className="w-full px-2 py-0.5 rounded-md text-[10.5px] font-medium text-white truncate block text-left cursor-pointer hover:opacity-90"
                                >
                                  {ev.title}
                                </button>
                              )
                            }

                            return (
                              <button
                                key={ev.id}
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  setDetailEvent(ev)
                                }}
                                style={getPastelCardStyle(ev.color)}
                                className="w-full rounded-xl border overflow-hidden text-left shadow-2xs hover:shadow-md transition cursor-pointer flex flex-col"
                              >
                                <div
                                  className="px-2 py-1 flex items-center justify-between gap-1"
                                  style={{
                                    backgroundColor: `color-mix(in srgb, ${ev.color} 26%, var(--app-bg-primary))`,
                                  }}
                                >
                                  <span
                                    className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-white/90 dark:bg-[#1e1e20]/90 text-[9.5px] font-medium ${platMeta.badgeText} truncate`}
                                  >
                                    <PlatformIcon platform={plat} size={9} />
                                    <span className="truncate">{ev.calendarName}</span>
                                  </span>
                                  <DotsThree size={13} weight="bold" className="text-neutral-600 dark:text-neutral-300 shrink-0" />
                                </div>
                                <div className="px-2.5 py-1.5 space-y-1">
                                  <div className="text-[11.5px] font-semibold leading-snug line-clamp-2 text-[var(--app-text-primary)]">
                                    {ev.title}
                                  </div>
                                  {ev.description && (
                                    <div className="text-[10px] text-neutral-500 dark:text-neutral-400 line-clamp-1">
                                      {ev.description}
                                    </div>
                                  )}
                                  <div className="flex items-center justify-between gap-1 pt-0.5">
                                    <span className="text-[9.5px] text-neutral-500 dark:text-neutral-400">
                                      Todo el día
                                    </span>
                                    <div className="flex items-center -space-x-1 shrink-0">
                                      {cardMembers.slice(0, 4).map((m) => (
                                        <span
                                          key={m.id}
                                          className="w-3.5 h-3.5 rounded-full text-[7.5px] font-bold text-white flex items-center justify-center ring-1 ring-white dark:ring-[#1e1e20]"
                                          style={{ backgroundColor: m.color }}
                                          title={m.name}
                                        >
                                          {m.initial}
                                        </span>
                                      ))}
                                    </div>
                                  </div>
                                </div>
                              </button>
                            )
                          })}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>

              {/* Scrollable 24-hour grid */}
              <div ref={timelineScrollRef} className="flex-1 overflow-y-auto custom-scrollbar relative">
                <div className="flex relative" style={{ height: `${24 * HOUR_HEIGHT}px` }}>
                  {/* Hour labels */}
                  <div className="w-16 shrink-0 border-r border-[var(--app-border)] select-none relative">
                    {Array.from({ length: 24 }, (_, hour) => (
                      <div
                        key={hour}
                        style={{ height: `${HOUR_HEIGHT}px` }}
                        className="pr-2 pt-1 text-right text-[10.5px] text-neutral-400 tabular-nums"
                      >
                        {formatHourAxis(hour, preferences.timeFormat)}
                      </div>
                    ))}

                    {/* Current-time pill on the left axis */}
                    <div
                      className="absolute right-1 -translate-y-1/2 z-30 px-1.5 py-0.5 rounded-full bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 text-[9.5px] font-semibold tabular-nums shadow-xs"
                      style={{ top: `${currentMinuteTopPx}px` }}
                    >
                      {currentTimePillLabel}
                    </div>
                  </div>

                  {/* Day columns */}
                  {(pageView === 'week'
                    ? weekDays
                    : [
                        {
                          dateKey: selectedDateKey,
                          timedPositioned: dayTimedPositioned,
                        },
                      ]
                  ).map((col) => (
                    <div
                      key={`col-${col.dateKey}`}
                      className="flex-1 min-w-0 relative border-r last:border-r-0 border-[var(--app-border)]"
                    >
                      {Array.from({ length: 24 }, (_, hour) => (
                        <div
                          key={hour}
                          onClick={() => openCreateEvent(col.dateKey, hour)}
                          style={{ height: `${HOUR_HEIGHT}px` }}
                          className="border-b border-black/[0.04] dark:border-white/[0.04] hover:bg-black/[0.015] dark:hover:bg-white/[0.02] cursor-pointer"
                        />
                      ))}

                      {/* Current time horizontal hairline */}
                      <div
                        className="absolute left-0 right-0 pointer-events-none z-20 h-[1.5px] bg-neutral-900/50 dark:bg-white/50"
                        style={{ top: `${currentMinuteTopPx}px` }}
                      />

                      {col.timedPositioned.map((item) => {
                        const widthPct = 100 / item.totalCols
                        const leftPct = item.col * widthPct
                        const ev = item.event
                        const plat = ev.platform || 'general'
                        const platMeta = PLATFORM_META[plat]
                        const isPastel = preferences.cardStyle === 'pastel'
                        const srcObj = sources.find((s) => s.id === ev.calendarId)
                        const cardMembers =
                          ev.teamMemberIds && ev.teamMemberIds.length > 0
                            ? TEAM_MEMBERS.filter((m) => ev.teamMemberIds?.includes(m.id))
                            : !srcObj?.visibleToMemberIds || srcObj.visibleToMemberIds.length === 0
                            ? TEAM_MEMBERS
                            : TEAM_MEMBERS.filter((m) => srcObj.visibleToMemberIds?.includes(m.id))

                        return (
                          <button
                            key={ev.id}
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation()
                              setDetailEvent(ev)
                            }}
                            style={{
                              top: `${item.topPx + 2}px`,
                              height: `${item.heightPx - 4}px`,
                              left: `calc(${leftPct}% + 4px)`,
                              width: `calc(${widthPct}% - 8px)`,
                              ...(isPastel
                                ? getPastelCardStyle(ev.color)
                                : {
                                    backgroundColor: `${ev.color}22`,
                                    borderLeft: `3px solid ${ev.color}`,
                                    borderColor: `${ev.color}40`,
                                  }),
                            }}
                            className={`absolute text-left overflow-hidden transition cursor-pointer z-10 flex flex-col ${
                              isPastel
                                ? 'rounded-xl border shadow-2xs hover:shadow-md'
                                : 'rounded-md border px-2 py-1 justify-between hover:brightness-105'
                            }`}
                          >
                            {isPastel ? (
                              <>
                                {/* Top header strip (Skejulio two-tone) */}
                                {item.heightPx >= 56 && (
                                  <div
                                    className="px-2 py-1.5 flex items-center justify-between gap-1 shrink-0"
                                    style={{
                                      backgroundColor: `color-mix(in srgb, ${ev.color} 26%, var(--app-bg-primary))`,
                                    }}
                                  >
                                    <span
                                      className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-white/90 dark:bg-[#1e1e20]/90 text-[10px] font-medium shadow-2xs ${platMeta.badgeText} truncate`}
                                    >
                                      <PlatformIcon platform={plat} size={10} />
                                      <span className="truncate">{ev.calendarName}</span>
                                    </span>
                                    <DotsThree size={15} weight="bold" className="text-neutral-600 dark:text-neutral-300 shrink-0" />
                                  </div>
                                )}

                                {/* Body */}
                                <div className="flex-1 px-2.5 py-2 flex flex-col justify-between min-h-0">
                                  <div className="space-y-1 min-w-0">
                                    <div className="text-[12px] font-semibold leading-snug line-clamp-2 text-[var(--app-text-primary)]">
                                      {ev.title}
                                    </div>
                                    {ev.description && item.heightPx >= 95 && (
                                      <div className="text-[10px] text-neutral-500 dark:text-neutral-400 line-clamp-2 leading-tight">
                                        {ev.description}
                                      </div>
                                    )}
                                  </div>

                                  {item.heightPx >= 72 && (
                                    <div className="flex items-center justify-between gap-1 pt-1.5">
                                      <span className="text-[10px] font-medium text-neutral-500 dark:text-neutral-400 tabular-nums truncate">
                                        {formatTimeShort(ev.startIso, preferences.timeFormat)}
                                      </span>
                                      <div className="flex items-center -space-x-1.5 shrink-0">
                                        {cardMembers.slice(0, 4).map((m) => (
                                          <span
                                            key={m.id}
                                            className="w-4 h-4 rounded-full text-[8px] font-bold text-white flex items-center justify-center ring-1 ring-white dark:ring-[#1e1e20]"
                                            style={{ backgroundColor: m.color }}
                                            title={m.name}
                                          >
                                            {m.initial}
                                          </span>
                                        ))}
                                      </div>
                                    </div>
                                  )}
                                </div>
                              </>
                            ) : (
                              <>
                                <div className="text-[11.5px] font-semibold leading-snug line-clamp-2">
                                  {ev.title}
                                </div>
                                {item.heightPx >= 40 && (
                                  <div className="flex items-center justify-between gap-1 pt-1 text-[10px] text-neutral-500 dark:text-neutral-400">
                                    <span className="truncate font-medium">{ev.calendarName}</span>
                                    <span className="tabular-nums shrink-0">
                                      {formatTimeShort(ev.startIso, preferences.timeFormat)}
                                    </span>
                                  </div>
                                )}
                              </>
                            )}
                          </button>
                        )
                      })}
                    </div>
                  ))}
                </div>
              </div>
              </div>
            </div>
          )}

          {pageView === 'agenda' && (
            <div className="flex-1 overflow-y-auto custom-scrollbar p-4 sm:p-6 max-w-3xl w-full mx-auto space-y-4">
              {agendaGroups.map((group) => (
                <div key={group.dateKey} className="space-y-1.5">
                  <div className="flex items-center justify-between pb-1 border-b border-[var(--app-border)]">
                    <span
                      className={`text-xs font-semibold capitalize ${
                        group.dateKey === todayKey ? 'text-purple-400' : 'text-neutral-600 dark:text-neutral-300'
                      }`}
                    >
                      {group.label}
                    </span>
                    <button
                      type="button"
                      onClick={() => openCreateEvent(group.dateKey)}
                      className="text-xs text-neutral-400 hover:text-[var(--app-text-primary)] cursor-pointer"
                    >
                      + Añadir
                    </button>
                  </div>
                  {group.events.length === 0 ? (
                    <div className="text-xs text-neutral-400 italic py-1">Sin eventos programados</div>
                  ) : (
                    <div className="space-y-2">
                      {group.events.map((ev) => {
                        if (preferences.cardStyle === 'pastel') {
                          const plat = ev.platform || 'general'
                          const platMeta = PLATFORM_META[plat]
                          const srcObj = sources.find((s) => s.id === ev.calendarId)
                          const cardMembers =
                            ev.teamMemberIds && ev.teamMemberIds.length > 0
                              ? TEAM_MEMBERS.filter((m) => ev.teamMemberIds?.includes(m.id))
                              : !srcObj?.visibleToMemberIds || srcObj.visibleToMemberIds.length === 0
                              ? TEAM_MEMBERS
                              : TEAM_MEMBERS.filter((m) => srcObj.visibleToMemberIds?.includes(m.id))

                          return (
                            <button
                              key={`${group.dateKey}-${ev.id}`}
                              type="button"
                              onClick={() => setDetailEvent(ev)}
                              style={getPastelCardStyle(ev.color)}
                              className="w-full rounded-xl border overflow-hidden text-left shadow-2xs hover:shadow-md transition cursor-pointer flex flex-col"
                            >
                              <div
                                className="px-3 py-1.5 flex items-center justify-between gap-2"
                                style={{
                                  backgroundColor: `color-mix(in srgb, ${ev.color} 26%, var(--app-bg-primary))`,
                                }}
                              >
                                <span
                                  className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-white/90 dark:bg-[#1e1e20]/90 text-[10px] font-medium ${platMeta.badgeText} truncate`}
                                >
                                  <PlatformIcon platform={plat} size={10} />
                                  <span className="truncate">{ev.calendarName}</span>
                                </span>
                                <span className="text-[10.5px] font-semibold tabular-nums text-neutral-600 dark:text-neutral-300 shrink-0">
                                  {formatTimeRange(ev, preferences.timeFormat)}
                                </span>
                              </div>
                              <div className="px-3 py-2 flex items-center justify-between gap-3">
                                <div className="min-w-0 space-y-0.5">
                                  <div className="text-xs font-semibold break-words text-[var(--app-text-primary)]">
                                    {ev.title}
                                  </div>
                                  {ev.description && (
                                    <div className="text-[10.5px] text-neutral-500 dark:text-neutral-400 line-clamp-1">
                                      {ev.description}
                                    </div>
                                  )}
                                </div>
                                <div className="flex items-center -space-x-1.5 shrink-0">
                                  {cardMembers.slice(0, 4).map((m) => (
                                    <span
                                      key={m.id}
                                      className="w-4.5 h-4.5 rounded-full text-[8.5px] font-bold text-white flex items-center justify-center ring-1 ring-white dark:ring-[#1e1e20]"
                                      style={{ backgroundColor: m.color }}
                                      title={m.name}
                                    >
                                      {m.initial}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            </button>
                          )
                        }

                        return (
                          <button
                            key={`${group.dateKey}-${ev.id}`}
                            type="button"
                            onClick={() => setDetailEvent(ev)}
                            className="w-full text-left px-3 py-2.5 rounded-xl border border-[var(--app-border)] hover:brightness-105 flex items-center gap-3 cursor-pointer transition"
                          >
                            <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: ev.color }} />
                            <span className="w-32 shrink-0 text-xs text-neutral-500 tabular-nums">
                              {formatTimeRange(ev, preferences.timeFormat)}
                            </span>
                            <span className="text-xs font-semibold truncate flex-1">{ev.title}</span>
                            <span className="text-[10.5px] text-neutral-500 hidden sm:inline truncate max-w-[140px]">
                              {ev.calendarName}
                            </span>
                          </button>
                        )
                      })}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </main>
      </div>

      {/* Event Detail Modal */}
      <dialog
        ref={detailDialogRef}
        {...({ closedby: 'any' } as Record<string, string>)}
        aria-labelledby="page-cal-detail-title"
        className="m-auto w-[92vw] max-w-md rounded-xl bg-white dark:bg-[#232325] text-[var(--app-text-primary)] border border-[var(--app-border)] shadow-2xl p-0 backdrop:bg-black/45 backdrop:backdrop-blur-[2px]"
      >
        {detailEvent && (
          <div className="p-4 space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-2.5 min-w-0">
                <span className="w-3 h-3 rounded-sm mt-1 shrink-0" style={{ backgroundColor: detailEvent.color }} />
                <div className="min-w-0">
                  <h2 id="page-cal-detail-title" className="text-sm font-semibold leading-snug break-words">
                    {detailEvent.title}
                  </h2>
                  <p className="text-[11px] text-neutral-500 dark:text-neutral-400 mt-0.5">
                    {detailEvent.calendarName}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setDetailEvent(null)}
                className="p-1 rounded-md hover:bg-black/[0.06] dark:hover:bg-white/[0.08] text-neutral-400 cursor-pointer"
                aria-label="Cerrar"
              >
                <X size={15} />
              </button>
            </div>

            <div className="space-y-2 text-xs text-neutral-600 dark:text-neutral-300">
              <div className="flex items-center gap-2">
                <Clock size={14} className="text-neutral-400 shrink-0" />
                <span className="capitalize">
                  {formatFullDateEs(detailEvent.startIso.slice(0, 10))} · {formatTimeRange(detailEvent, preferences.timeFormat)}
                </span>
              </div>

              {detailEvent.location && (
                <div className="flex items-start gap-2">
                  <MapPin size={14} className="text-neutral-400 shrink-0 mt-0.5" />
                  <span className="break-words">{detailEvent.location}</span>
                </div>
              )}

              {(() => {
                const meet = toSafeExternalUrl(extractMeetUrl(detailEvent))
                if (!meet) return null
                return (
                  <a
                    href={meet}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-[#1a73e8] hover:bg-[#1765cc] text-white font-medium text-xs transition"
                  >
                    <VideoCamera size={14} weight="fill" />
                    <span>Unirse a la videollamada</span>
                  </a>
                )
              })()}

              {detailEvent.description && (
                <div className="p-2.5 rounded-lg bg-black/[0.03] dark:bg-white/[0.04] border border-[var(--app-border)] max-h-44 overflow-y-auto custom-scrollbar whitespace-pre-wrap break-words text-[11.5px] leading-relaxed">
                  {detailEvent.description}
                </div>
              )}
            </div>

            {detailEvent.isLocal && (
              <div className="flex items-center justify-end gap-2 pt-2 border-t border-[var(--app-border)]">
                <button
                  type="button"
                  onClick={() => openEditLocalEvent(detailEvent)}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md border border-[var(--app-border)] hover:bg-black/[0.04] dark:hover:bg-white/[0.06] text-xs font-medium cursor-pointer"
                >
                  <PencilSimple size={13} />
                  <span>Editar</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    deleteLocalEvent(detailEvent.id)
                    setDetailEvent(null)
                    toast.success('Evento eliminado')
                  }}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-rose-500/10 hover:bg-rose-500/20 text-rose-500 text-xs font-medium cursor-pointer"
                >
                  <Trash size={13} />
                  <span>Eliminar</span>
                </button>
              </div>
            )}
          </div>
        )}
      </dialog>

      {/* Skejulio-style Create / Edit Local Event Modal */}
      <dialog
        ref={eventFormDialogRef}
        {...({ closedby: 'any' } as Record<string, string>)}
        aria-labelledby="page-cal-form-title"
        className="m-auto w-[92vw] max-w-[430px] rounded-2xl bg-white dark:bg-[#232325] text-[var(--app-text-primary)] border border-[var(--app-border)] shadow-2xl p-0 backdrop:bg-black/45 backdrop:backdrop-blur-[2px]"
      >
        <form onSubmit={handleSaveLocalEvent} className="p-5 space-y-4">
          {/* Header with square icon */}
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 flex items-center justify-center shrink-0 shadow-xs">
                <CalendarBlank size={18} weight="fill" />
              </div>
              <div>
                <h2 id="page-cal-form-title" className="text-sm font-semibold leading-tight">
                  {editingLocalEventId ? 'Editar horario' : 'Crear horario'}
                </h2>
                <p className="text-[11px] text-neutral-500 mt-0.5">
                  Completa los datos para añadirlo al calendario.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setIsEventFormOpen(false)}
              className="p-1 rounded-md hover:bg-black/[0.06] dark:hover:bg-white/[0.08] text-neutral-400 cursor-pointer"
            >
              <X size={15} />
            </button>
          </div>

          {/* 2-Column Aligned Form Rows */}
          <div className="space-y-2.5 text-xs">
            <div className="grid grid-cols-[92px_1fr] items-center gap-2">
              <label className="flex items-center gap-1.5 text-neutral-500 font-medium">
                <PencilSimple size={14} />
                <span>Título</span>
              </label>
              <input
                type="text"
                value={evTitle}
                onChange={(e) => setEvTitle(e.target.value)}
                placeholder="Título del evento..."
                autoFocus
                className="w-full px-2.5 py-1.5 rounded-lg bg-black/[0.025] dark:bg-white/[0.05] border border-[var(--app-border)] outline-none focus:border-neutral-500 font-medium"
              />
            </div>

            <div className="grid grid-cols-[92px_1fr] items-start gap-2">
              <label className="flex items-center gap-1.5 text-neutral-500 font-medium pt-1.5">
                <TextAlignLeft size={14} />
                <span>Descripción</span>
              </label>
              <textarea
                value={evDescription}
                onChange={(e) => setEvDescription(e.target.value)}
                placeholder="Añadir descripción..."
                rows={2}
                className="w-full px-2.5 py-1.5 rounded-lg bg-black/[0.025] dark:bg-white/[0.05] border border-[var(--app-border)] outline-none resize-none"
              />
            </div>

            <div className="grid grid-cols-[92px_1fr] items-center gap-2">
              <label className="flex items-center gap-1.5 text-neutral-500 font-medium">
                <CalendarBlank size={14} />
                <span>Fecha</span>
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="date"
                  value={evDate}
                  onChange={(e) => setEvDate(e.target.value)}
                  className="flex-1 px-2.5 py-1.5 rounded-lg bg-black/[0.025] dark:bg-white/[0.05] border border-[var(--app-border)] outline-none"
                />
                <label className="inline-flex items-center gap-1 text-[11px] text-neutral-500 cursor-pointer shrink-0">
                  <input
                    type="checkbox"
                    checked={evAllDay}
                    onChange={(e) => setEvAllDay(e.target.checked)}
                    className="rounded accent-neutral-900 dark:accent-white"
                  />
                  <span>Todo el día</span>
                </label>
              </div>
            </div>

            {!evAllDay && (
              <div className="grid grid-cols-[92px_1fr] items-center gap-2">
                <label className="flex items-center gap-1.5 text-neutral-500 font-medium">
                  <Clock size={14} />
                  <span>Hora</span>
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="time"
                    value={evStartTime}
                    onChange={(e) => setEvStartTime(e.target.value)}
                    className="flex-1 px-2.5 py-1.5 rounded-lg bg-black/[0.025] dark:bg-white/[0.05] border border-[var(--app-border)] outline-none tabular-nums"
                  />
                  <span className="text-neutral-400">→</span>
                  <input
                    type="time"
                    value={evEndTime}
                    onChange={(e) => setEvEndTime(e.target.value)}
                    className="flex-1 px-2.5 py-1.5 rounded-lg bg-black/[0.025] dark:bg-white/[0.05] border border-[var(--app-border)] outline-none tabular-nums"
                  />
                </div>
              </div>
            )}

            {/* Equipo chips with x and + */}
            <div className="grid grid-cols-[92px_1fr] items-start gap-2">
              <label className="flex items-center gap-1.5 text-neutral-500 font-medium pt-1.5">
                <Users size={14} />
                <span>Equipo</span>
              </label>
              <div className="relative">
                <div className="flex flex-wrap items-center gap-1.5">
                  {evTeamMemberIds.map((mid) => {
                    const m = TEAM_MEMBERS.find((tm) => tm.id === mid)
                    if (!m) return null
                    return (
                      <span
                        key={m.id}
                        className="inline-flex items-center gap-1.5 pl-1 pr-1.5 py-0.5 rounded-lg border border-[var(--app-border)] bg-black/[0.02] dark:bg-white/[0.04] text-[11px] font-medium"
                      >
                        <span
                          className="w-4 h-4 rounded-full text-[8.5px] font-bold text-white flex items-center justify-center"
                          style={{ backgroundColor: m.color }}
                        >
                          {m.initial}
                        </span>
                        <span>{m.name}</span>
                        <button
                          type="button"
                          onClick={() =>
                            setEvTeamMemberIds((prev) => prev.filter((id) => id !== m.id))
                          }
                          className="text-neutral-400 hover:text-neutral-700 dark:hover:text-white cursor-pointer"
                        >
                          <X size={10} />
                        </button>
                      </span>
                    )
                  })}

                  <button
                    type="button"
                    onClick={() => setShowTeamDropdown((p) => !p)}
                    className="w-6 h-6 rounded-lg border border-[var(--app-border)] hover:bg-black/[0.05] dark:hover:bg-white/[0.08] flex items-center justify-center text-neutral-500 cursor-pointer"
                    title="Añadir miembro del equipo"
                  >
                    <Plus size={12} weight="bold" />
                  </button>
                </div>

                {showTeamDropdown && (
                  <div className="mt-1.5 p-1 rounded-lg border border-[var(--app-border)] bg-white dark:bg-[#1b1b1d] shadow-lg flex flex-wrap gap-1">
                    {TEAM_MEMBERS.filter((m) => !evTeamMemberIds.includes(m.id)).map((m) => (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => {
                          setEvTeamMemberIds((prev) => [...prev, m.id])
                          setShowTeamDropdown(false)
                        }}
                        className="inline-flex items-center gap-1 px-2 py-1 rounded-md hover:bg-black/[0.05] dark:hover:bg-white/[0.08] text-[11px] cursor-pointer"
                      >
                        <span
                          className="w-4 h-4 rounded-full text-[8.5px] font-bold text-white flex items-center justify-center"
                          style={{ backgroundColor: m.color }}
                        >
                          {m.initial}
                        </span>
                        <span>{m.name}</span>
                      </button>
                    ))}
                    {TEAM_MEMBERS.every((m) => evTeamMemberIds.includes(m.id)) && (
                      <span className="px-2 py-1 text-[10.5px] text-neutral-400">
                        Todo el equipo añadido
                      </span>
                    )}
                  </div>
                )}
              </div>
            </div>

            <div className="border-t border-[var(--app-border)] my-1" />

            <div className="grid grid-cols-[92px_1fr] items-center gap-2">
              <label className="flex items-center gap-1.5 text-neutral-500 font-medium">
                <LinkSimple size={14} />
                <span>Enlace</span>
              </label>
              <input
                type="text"
                value={evLocation}
                onChange={(e) => setEvLocation(e.target.value)}
                placeholder="https://meet.google.com/..."
                className="w-full px-2.5 py-1.5 rounded-lg bg-black/[0.025] dark:bg-white/[0.05] border border-[var(--app-border)] outline-none text-blue-600 dark:text-blue-400"
              />
            </div>

            <div className="grid grid-cols-[92px_1fr] items-center gap-2">
              <label className="flex items-center gap-1.5 text-neutral-500 font-medium">
                <CalendarBlank size={14} />
                <span>Calendario</span>
              </label>
              <select
                value={evTargetCalId}
                onChange={(e) => setEvTargetCalId(e.target.value)}
                className="w-full px-2.5 py-1.5 rounded-lg bg-black/[0.025] dark:bg-[#1a1a1c] border border-[var(--app-border)] outline-none font-medium"
              >
                {visibleSources.map((src) => (
                  <option key={src.id} value={src.id}>
                    {src.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-1.5 pt-0.5 pl-[100px]">
              {GOOGLE_CALENDAR_PALETTE.slice(0, 8).map((c) => (
                <button
                  key={c.hex}
                  type="button"
                  onClick={() => setEvColor(c.hex)}
                  title={c.name}
                  className={`w-4 h-4 rounded-full cursor-pointer transition ${
                    evColor === c.hex ? 'ring-2 ring-offset-2 ring-neutral-900 dark:ring-white dark:ring-offset-[#232325]' : ''
                  }`}
                  style={{ backgroundColor: c.hex }}
                />
              ))}
            </div>
          </div>

          {/* Footer: Recordatorio + Cancelar + Guardar */}
          <div className="flex items-center justify-between gap-2 pt-3 border-t border-[var(--app-border)]">
            <label className="inline-flex items-center gap-1.5 text-xs font-medium cursor-pointer">
              <input
                type="checkbox"
                checked={evReminder}
                onChange={(e) => setEvReminder(e.target.checked)}
                className="rounded-full accent-neutral-900 dark:accent-white"
              />
              <span>Recordatorio</span>
            </label>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setIsEventFormOpen(false)}
                className="px-3.5 py-1.5 rounded-lg border border-[var(--app-border)] text-xs font-medium hover:bg-black/[0.04] dark:hover:bg-white/[0.06] cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="px-4 py-1.5 rounded-lg bg-neutral-900 hover:bg-neutral-800 text-white dark:bg-white dark:text-neutral-900 text-xs font-semibold cursor-pointer"
              >
                Guardar
              </button>
            </div>
          </div>
        </form>
      </dialog>

      {/* Manage Google Calendar iCal Feeds & Import Modal */}
      <dialog
        ref={manageDialogRef}
        {...({ closedby: 'any' } as Record<string, string>)}
        aria-labelledby="page-cal-manage-title"
        className="m-auto w-[94vw] max-w-lg rounded-xl bg-white dark:bg-[#232325] text-[var(--app-text-primary)] border border-[var(--app-border)] shadow-2xl p-0 backdrop:bg-black/45 backdrop:backdrop-blur-[2px]"
      >
        <div className="p-4 space-y-4 max-h-[85dvh] overflow-y-auto custom-scrollbar">
          <div className="flex items-center justify-between">
            <div>
              <h2 id="page-cal-manage-title" className="text-sm font-semibold">
                Calendarios de Google (iCal)
              </h2>
              <p className="text-[11px] text-neutral-500 dark:text-neutral-400">
                Conecta uno o varios Google Calendars mediante su dirección iCal secreta o pública.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setIsManageModalOpen(false)}
              className="p-1 rounded-md hover:bg-black/[0.06] dark:hover:bg-white/[0.08] text-neutral-400 cursor-pointer"
            >
              <X size={15} />
            </button>
          </div>

          <form onSubmit={handleAddIcal} className="p-3 rounded-lg bg-black/[0.025] dark:bg-white/[0.03] border border-[var(--app-border)] space-y-2.5">
            <div className="text-xs font-semibold flex items-center gap-1.5">
              <LinkSimple size={14} className="text-[#1a73e8]" />
              <span>Añadir nuevo enlace iCal</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <input
                type="text"
                value={newCalName}
                onChange={(e) => setNewCalName(e.target.value)}
                placeholder="Nombre (ej. Trabajo, Estudio Seven)"
                className="px-2.5 py-1.5 rounded-md bg-white dark:bg-[#1a1a1c] border border-[var(--app-border)] text-xs outline-none focus:border-[#1a73e8]"
              />
              <div className="flex items-center gap-1.5 flex-wrap">
                {GOOGLE_CALENDAR_PALETTE.slice(0, 7).map((c) => (
                  <button
                    key={c.hex}
                    type="button"
                    onClick={() => setNewCalColor(c.hex)}
                    title={c.name}
                    className={`w-5 h-5 rounded-full cursor-pointer transition ${
                      newCalColor === c.hex ? 'ring-2 ring-offset-2 ring-[#1a73e8] dark:ring-offset-[#232325]' : ''
                    }`}
                    style={{ backgroundColor: c.hex }}
                  />
                ))}
              </div>
            </div>

            <input
              type="url"
              value={newCalUrl}
              onChange={(e) => setNewCalUrl(e.target.value)}
              placeholder="https://calendar.google.com/calendar/ical/.../basic.ics"
              className="w-full px-2.5 py-1.5 rounded-md bg-white dark:bg-[#1a1a1c] border border-[var(--app-border)] text-xs outline-none focus:border-[#1a73e8]"
            />

            <div className="flex items-center justify-between gap-2">
              <span className="text-[10.5px] text-neutral-500">
                Google Calendar → Configuración → Integrar → Dirección secreta en formato iCal
              </span>
              <button
                type="submit"
                disabled={isAddingCal}
                className="px-3 py-1.5 rounded-md bg-[#1a73e8] hover:bg-[#1765cc] disabled:opacity-50 text-white text-xs font-medium shrink-0 cursor-pointer"
              >
                {isAddingCal ? 'Conectando...' : 'Conectar'}
              </button>
            </div>
          </form>

          <div className="space-y-1.5">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-neutral-500">
              Calendarios configurados
            </div>
            {sources.map((src) => (
              <div
                key={src.id}
                className="p-2.5 rounded-lg border border-[var(--app-border)] space-y-2"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: src.color }} />
                    <div className="min-w-0">
                      <div className="text-xs font-medium truncate">{src.name}</div>
                      <div className="text-[10.5px] text-neutral-500 truncate">
                        {src.isLocalOnly
                          ? `${localEvents.length} eventos locales`
                          : src.lastError
                          ? `Error: ${src.lastError}`
                          : `${src.eventCount ?? (eventsByCalendar[src.id]?.length || 0)} eventos${
                              src.lastSync ? ` · Sync ${new Date(src.lastSync).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}` : ''
                            }`}
                      </div>
                    </div>
                  </div>

                  {src.id !== LOCAL_CALENDAR_ID && isAdmin && (
                    <div className="flex items-center gap-1 shrink-0">
                      {src.icalUrl && (
                        <button
                          type="button"
                          onClick={() => syncSource(src.id)}
                          className="p-1.5 rounded-md hover:bg-black/[0.05] dark:hover:bg-white/[0.08] text-neutral-500 cursor-pointer"
                          title="Sincronizar ahora"
                        >
                          <ArrowsClockwise size={13} className={syncingIds[src.id] ? 'animate-spin text-blue-500' : ''} />
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => removeSource(src.id)}
                        className="p-1.5 rounded-md hover:bg-rose-500/15 text-neutral-400 hover:text-rose-500 cursor-pointer"
                        title="Eliminar calendario"
                      >
                        <Trash size={13} />
                      </button>
                    </div>
                  )}
                </div>

                {isAdmin && (
                  <div className="flex items-center flex-wrap gap-1 pt-1.5 border-t border-[var(--app-border)]">
                    <span className="text-[10px] text-neutral-500 mr-1">Trabajadores:</span>
                    <button
                      type="button"
                      onClick={() => setSourceMembers(src.id, [])}
                      className={`px-2 py-0.5 rounded-full text-[10px] font-medium border cursor-pointer transition ${
                        !src.visibleToMemberIds || src.visibleToMemberIds.length === 0
                          ? 'bg-neutral-900 text-white border-neutral-900 dark:bg-white dark:text-neutral-900 dark:border-white'
                          : 'border-[var(--app-border)] text-neutral-500'
                      }`}
                    >
                      Todos
                    </button>
                    {TEAM_MEMBERS.map((m) => {
                      const active = isCalendarVisibleToMember(src, m.id)
                      return (
                        <button
                          key={m.id}
                          type="button"
                          onClick={() => {
                            const currentIds =
                              !src.visibleToMemberIds || src.visibleToMemberIds.length === 0
                                ? TEAM_MEMBERS.map((tm) => tm.id)
                                : src.visibleToMemberIds
                            const nextIds = currentIds.includes(m.id)
                              ? currentIds.filter((id) => id !== m.id)
                              : [...currentIds, m.id]
                            if (nextIds.length === 0) return
                            setSourceMembers(
                              src.id,
                              nextIds.length >= TEAM_MEMBERS.length ? [] : nextIds
                            )
                          }}
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium border cursor-pointer transition ${
                            active
                              ? 'border-transparent text-white'
                              : 'border-[var(--app-border)] text-neutral-400 opacity-60'
                          }`}
                          style={active ? { backgroundColor: m.color } : undefined}
                        >
                          <span>{m.name}</span>
                        </button>
                      )
                    })}
                  </div>
                )}
              </div>
            ))}
          </div>

          {isAdmin && (
            <div className="p-3 rounded-lg bg-black/[0.025] dark:bg-white/[0.03] border border-[var(--app-border)] space-y-2.5">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <div className="text-xs font-semibold">Sincronización Bidireccional (Google Apps Script)</div>
                  <div className="text-[10.5px] text-neutral-500">
                    Permite que al crear, editar o borrar en Seven Note también se aplique en Google Calendar.
                  </div>
                </div>
                <label className="inline-flex items-center gap-1.5 text-xs cursor-pointer shrink-0">
                  <input
                    type="checkbox"
                    checked={webhookConfig.enabled}
                    onChange={(e) => updateWebhookConfig({ enabled: e.target.checked })}
                    className="rounded accent-[#1a73e8]"
                  />
                  <span>Activar</span>
                </label>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <input
                  type="url"
                  value={webhookConfig.url}
                  onChange={(e) => updateWebhookConfig({ url: e.target.value })}
                  placeholder="https://script.google.com/macros/s/.../exec"
                  className="px-2.5 py-1.5 rounded-md bg-white dark:bg-[#1a1a1c] border border-[var(--app-border)] text-xs outline-none focus:border-[#1a73e8]"
                />
                <input
                  type="password"
                  value={webhookConfig.secret}
                  onChange={(e) => updateWebhookConfig({ secret: e.target.value })}
                  placeholder="Token secreto (SECRET_TOKEN)"
                  className="px-2.5 py-1.5 rounded-md bg-white dark:bg-[#1a1a1c] border border-[var(--app-border)] text-xs outline-none focus:border-[#1a73e8]"
                />
              </div>

              <div className="flex items-center justify-between gap-2 flex-wrap">
                <button
                  type="button"
                  onClick={async () => {
                    await navigator.clipboard.writeText(GOOGLE_APPS_SCRIPT_TEMPLATE)
                    toast.success('Código de Google Apps Script copiado al portapapeles')
                  }}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md border border-[var(--app-border)] hover:bg-black/[0.04] dark:hover:bg-white/[0.06] text-[11px] font-medium cursor-pointer"
                >
                  <Copy size={12} />
                  <span>Copiar script (.gs)</span>
                </button>

                <button
                  type="button"
                  disabled={isTestingWebhook}
                  onClick={async () => {
                    setIsTestingWebhook(true)
                    try {
                      const res = await testWebhookConnection()
                      if (res.ok) toast.success(res.message)
                      else toast.error(res.message)
                    } finally {
                      setIsTestingWebhook(false)
                    }
                  }}
                  className="px-2.5 py-1 rounded-md bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 text-[11px] font-semibold cursor-pointer disabled:opacity-50"
                >
                  {isTestingWebhook ? 'Probando...' : 'Probar conexión'}
                </button>
              </div>
            </div>
          )}

          <div className="pt-2 border-t border-[var(--app-border)] flex items-center justify-between gap-2">
            <span className="text-[11px] text-neutral-500">
              ¿Tienes un archivo <code>.ics</code> o <code>google_calendar_cache.json</code>?
            </span>
            <label className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border border-[var(--app-border)] hover:bg-black/[0.04] dark:hover:bg-white/[0.06] text-xs font-medium cursor-pointer shrink-0">
              <UploadSimple size={13} />
              <span>Importar .ics / JSON</span>
              <input type="file" accept=".ics,.json,text/calendar,application/json" onChange={handleImportFile} className="hidden" />
            </label>
          </div>
        </div>
      </dialog>
    </div>
  )
}
