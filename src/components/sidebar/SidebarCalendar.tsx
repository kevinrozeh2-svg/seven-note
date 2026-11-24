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
} from '@phosphor-icons/react'
import { toast } from '../../lib/toast'
import {
  useCalendarStore,
  getVisibleEvents,
  eventOccursOnDate,
  toDateKey,
  fromDateKey,
  GOOGLE_CALENDAR_PALETTE,
  LOCAL_CALENDAR_ID,
  type CalendarEventView,
  type CalendarSidebarViewMode,
} from '../../lib/calendarStore'

const WEEKDAYS_SHORT = ['L', 'M', 'X', 'J', 'V', 'S', 'D']
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

function formatTimeRange(ev: CalendarEventView): string {
  if (ev.isAllDay) return 'Todo el día'
  const start = new Date(ev.startIso)
  const end = new Date(ev.endIso)
  const fmt = new Intl.DateTimeFormat('es-ES', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
  return `${fmt.format(start)} – ${fmt.format(end)}`
}

function formatFullDateEs(dateKey: string): string {
  const d = fromDateKey(dateKey)
  return new Intl.DateTimeFormat('es-ES', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(d)
}

function extractMeetUrl(ev: CalendarEventView): string | null {
  const haystack = `${ev.url || ''} ${ev.location || ''} ${ev.description || ''}`
  const match = haystack.match(/https:\/\/(?:meet\.google\.com|zoom\.us|teams\.microsoft\.com)\/[^\s<>"')]+/i)
  return match ? match[0] : null
}

/**
 * Light-dismiss helper for <dialog closedby="any"> with fallback for browsers
 * without native closedby support (following modern-web-guidance).
 */
function useLightDismissDialog(
  ref: React.RefObject<HTMLDialogElement | null>,
  isOpen: boolean,
  onClose: () => void
) {
  useEffect(() => {
    const dialog = ref.current
    if (!dialog) return

    if (isOpen) {
      if (!dialog.open) {
        dialog.showModal()
      }
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
      if (!isInside) {
        dialog.close()
      }
    }
    dialog.addEventListener('click', handleFallbackClick)

    return () => {
      dialog.removeEventListener('close', handleClose)
      dialog.removeEventListener('click', handleFallbackClick)
    }
  }, [ref, onClose])
}

interface PositionedDayEvent {
  event: CalendarEventView
  topPx: number
  heightPx: number
  col: number
  totalCols: number
}

function layoutDayEvents(events: CalendarEventView[], hourHeight: number): PositionedDayEvent[] {
  const timed = events
    .filter((e) => !e.isAllDay)
    .map((e) => {
      const s = new Date(e.startIso)
      const en = new Date(e.endIso)
      const startMin = s.getHours() * 60 + s.getMinutes()
      let endMin = en.getHours() * 60 + en.getMinutes()
      if (en.getDate() !== s.getDate() || endMin <= startMin) {
        endMin = Math.max(startMin + 30, 24 * 60)
      }
      return { event: e, startMin, endMin: Math.max(startMin + 25, endMin) }
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
    heightPx: Math.max(20, ((p.endMin - p.startMin) / 60) * hourHeight),
    col: p.col,
    totalCols: p.totalCols,
  }))
}

export function SidebarCalendar() {
  const {
    sources,
    eventsByCalendar,
    localEvents,
    syncingIds,
    selectedDateKey,
    viewMode,
    calendarsPanelOpen,
    setSelectedDateKey,
    setViewMode,
    setCalendarsPanelOpen,
    addIcalSource,
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
  const [cursorMonth, setCursorMonth] = useState<{ year: number; month: number }>(() => ({
    year: selectedDate.getFullYear(),
    month: selectedDate.getMonth(),
  }))

  // Modals state
  const [detailEvent, setDetailEvent] = useState<CalendarEventView | null>(null)
  const [isManageModalOpen, setIsManageModalOpen] = useState(false)
  const [isEventFormOpen, setIsEventFormOpen] = useState(false)
  const [editingLocalEventId, setEditingLocalEventId] = useState<string | null>(null)

  // Local event form state
  const [evTitle, setEvTitle] = useState('')
  const [evDate, setEvDate] = useState(selectedDateKey)
  const [evAllDay, setEvAllDay] = useState(false)
  const [evStartTime, setEvStartTime] = useState('09:00')
  const [evEndTime, setEvEndTime] = useState('10:00')
  const [evLocation, setEvLocation] = useState('')
  const [evDescription, setEvDescription] = useState('')

  // Add iCal form state
  const [newCalName, setNewCalName] = useState('')
  const [newCalUrl, setNewCalUrl] = useState('')
  const [newCalColor, setNewCalColor] = useState(GOOGLE_CALENDAR_PALETTE[0].hex)
  const [isAddingCal, setIsAddingCal] = useState(false)

  // Current time ticker for Day view red line
  const [nowTick, setNowTick] = useState(() => new Date())
  useEffect(() => {
    const id = setInterval(() => setNowTick(new Date()), 60_000)
    return () => clearInterval(id)
  }, [])

  // Auto-sync on mount & every 15 minutes
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

  const isAnySyncing = Object.keys(syncingIds).length > 0

  const allVisibleEvents = useMemo(
    () => getVisibleEvents(sources, eventsByCalendar, localEvents),
    [sources, eventsByCalendar, localEvents]
  )

  const selectedDayEvents = useMemo(
    () => allVisibleEvents.filter((ev) => eventOccursOnDate(ev, selectedDateKey)),
    [allVisibleEvents, selectedDateKey]
  )

  // Build 42-day grid for cursorMonth (Monday-first)
  const monthGrid = useMemo(() => {
    const firstOfMonth = new Date(cursorMonth.year, cursorMonth.month, 1)
    const jsDay = firstOfMonth.getDay() // 0=Sun..6=Sat
    const mondayOffset = (jsDay + 6) % 7
    const gridStart = new Date(cursorMonth.year, cursorMonth.month, 1 - mondayOffset)

    const cells: Array<{
      dateKey: string
      dayNumber: number
      inCurrentMonth: boolean
      dots: string[]
      extraCount: number
    }> = []

    for (let i = 0; i < 42; i++) {
      const d = new Date(gridStart.getFullYear(), gridStart.getMonth(), gridStart.getDate() + i)
      const key = toDateKey(d)
      const dayEvents = allVisibleEvents.filter((ev) => eventOccursOnDate(ev, key))
      const uniqueColors = Array.from(new Set(dayEvents.map((e) => e.color)))
      cells.push({
        dateKey: key,
        dayNumber: d.getDate(),
        inCurrentMonth: d.getMonth() === cursorMonth.month,
        dots: uniqueColors.slice(0, 3),
        extraCount: Math.max(0, dayEvents.length - 3),
      })
    }
    return cells
  }, [cursorMonth, allVisibleEvents])

  // Agenda view: next 30 days from selectedDateKey
  const agendaDays = useMemo(() => {
    const start = fromDateKey(selectedDateKey)
    const groups: Array<{ dateKey: string; label: string; events: CalendarEventView[] }> = []
    for (let i = 0; i < 30; i++) {
      const d = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i)
      const key = toDateKey(d)
      const dayEvents = allVisibleEvents.filter((ev) => eventOccursOnDate(ev, key))
      if (dayEvents.length === 0 && i > 0) continue
      const label =
        key === todayKey
          ? `Hoy · ${formatFullDateEs(key)}`
          : formatFullDateEs(key)
      groups.push({ dateKey: key, label, events: dayEvents })
    }
    return groups
  }, [allVisibleEvents, selectedDateKey, todayKey])

  // Day timeline layout
  const HOUR_HEIGHT = 42
  const dayTimelineRef = useRef<HTMLDivElement | null>(null)
  const dayAllDayEvents = useMemo(
    () => selectedDayEvents.filter((e) => e.isAllDay),
    [selectedDayEvents]
  )
  const dayTimedPositioned = useMemo(
    () => layoutDayEvents(selectedDayEvents, HOUR_HEIGHT),
    [selectedDayEvents]
  )

  useEffect(() => {
    if (viewMode === 'day' && dayTimelineRef.current) {
      const targetHour = selectedDateKey === todayKey ? Math.max(0, new Date().getHours() - 1) : 8
      dayTimelineRef.current.scrollTop = targetHour * HOUR_HEIGHT
    }
  }, [viewMode, selectedDateKey, todayKey])

  const handleGoToday = () => {
    const now = new Date()
    setSelectedDateKey(toDateKey(now))
    setCursorMonth({ year: now.getFullYear(), month: now.getMonth() })
  }

  const handlePrev = () => {
    if (viewMode === 'day') {
      const d = fromDateKey(selectedDateKey)
      d.setDate(d.getDate() - 1)
      setSelectedDateKey(toDateKey(d))
      setCursorMonth({ year: d.getFullYear(), month: d.getMonth() })
    } else if (viewMode === 'agenda') {
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
    if (viewMode === 'day') {
      const d = fromDateKey(selectedDateKey)
      d.setDate(d.getDate() + 1)
      setSelectedDateKey(toDateKey(d))
      setCursorMonth({ year: d.getFullYear(), month: d.getMonth() })
    } else if (viewMode === 'agenda') {
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
      if (end <= start) {
        end = new Date(start.getTime() + 3600000)
      }
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
      })
      toast.success('Evento creado')
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

  // Dialog refs
  const detailDialogRef = useRef<HTMLDialogElement | null>(null)
  const manageDialogRef = useRef<HTMLDialogElement | null>(null)
  const eventFormDialogRef = useRef<HTMLDialogElement | null>(null)

  useLightDismissDialog(detailDialogRef, Boolean(detailEvent), () => setDetailEvent(null))
  useLightDismissDialog(manageDialogRef, isManageModalOpen, () => setIsManageModalOpen(false))
  useLightDismissDialog(eventFormDialogRef, isEventFormOpen, () => setIsEventFormOpen(false))

  const hasRemoteCalendars = sources.some((s) => !s.isLocalOnly && s.icalUrl)
  const currentMinuteTopPx = ((nowTick.getHours() * 60 + nowTick.getMinutes()) / 60) * HOUR_HEIGHT

  return (
    <div className="flex-1 flex flex-col min-h-0 overflow-hidden text-[var(--app-text-primary)]">
      {/* 1. Calendar Top Bar */}
      <div className="px-2.5 pt-2 pb-1.5 border-b border-[var(--app-border)] shrink-0 space-y-2">
        <div className="flex items-center justify-between gap-1">
          <div className="flex items-center gap-1 min-w-0">
            <button
              type="button"
              onClick={handlePrev}
              className="p-1 rounded-md hover:bg-black/[0.05] dark:hover:bg-white/[0.08] text-neutral-500 dark:text-neutral-400 cursor-pointer transition"
              title="Anterior"
            >
              <CaretLeft size={13} weight="bold" />
            </button>
            <button
              type="button"
              onClick={handleNext}
              className="p-1 rounded-md hover:bg-black/[0.05] dark:hover:bg-white/[0.08] text-neutral-500 dark:text-neutral-400 cursor-pointer transition"
              title="Siguiente"
            >
              <CaretRight size={13} weight="bold" />
            </button>
            <span className="text-[12.5px] font-semibold tracking-tight truncate ml-0.5">
              {MONTH_NAMES_ES[cursorMonth.month]} {cursorMonth.year}
            </span>
          </div>

          <div className="flex items-center gap-1 shrink-0">
            <button
              type="button"
              onClick={handleGoToday}
              className="px-2 py-0.5 rounded-md text-[11px] font-medium border border-[var(--app-border)] hover:bg-black/[0.04] dark:hover:bg-white/[0.07] transition cursor-pointer"
              title="Ir a hoy"
            >
              Hoy
            </button>
            <button
              type="button"
              onClick={() => syncAllSources()}
              disabled={isAnySyncing || !hasRemoteCalendars}
              className="p-1 rounded-md hover:bg-black/[0.05] dark:hover:bg-white/[0.08] text-neutral-500 dark:text-neutral-400 disabled:opacity-40 cursor-pointer transition"
              title={hasRemoteCalendars ? 'Sincronizar Google Calendars' : 'Añade un iCal primero'}
            >
              <ArrowsClockwise size={14} className={isAnySyncing ? 'animate-spin text-blue-500' : ''} />
            </button>
            <button
              type="button"
              onClick={() => openCreateEvent(selectedDateKey)}
              className="p-1 rounded-md bg-[#1a73e8] hover:bg-[#1765cc] text-white cursor-pointer transition shadow-xs"
              title="Crear evento local"
            >
              <Plus size={13} weight="bold" />
            </button>
            <button
              type="button"
              onClick={() => setIsManageModalOpen(true)}
              className="p-1 rounded-md hover:bg-black/[0.05] dark:hover:bg-white/[0.08] text-neutral-500 dark:text-neutral-400 cursor-pointer transition"
              title="Conectar Google Calendar (iCal) / Importar"
            >
              <GearSix size={14} />
            </button>
          </div>
        </div>

        {/* View Mode Segmented Control */}
        <div className="grid grid-cols-3 gap-0.5 p-0.5 rounded-lg bg-black/[0.04] dark:bg-white/[0.06] border border-[var(--app-border)]">
          {(
            [
              { id: 'month', label: 'Mes' },
              { id: 'agenda', label: 'Agenda' },
              { id: 'day', label: 'Día' },
            ] as Array<{ id: CalendarSidebarViewMode; label: string }>
          ).map((tab) => {
            const active = viewMode === tab.id
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setViewMode(tab.id)}
                className={`py-1 rounded-md text-[11px] font-medium transition cursor-pointer ${
                  active
                    ? 'bg-white dark:bg-[#2c2c2c] text-[var(--app-text-primary)] shadow-xs'
                    : 'text-neutral-500 dark:text-neutral-400 hover:text-[var(--app-text-primary)]'
                }`}
              >
                {tab.label}
              </button>
            )
          })}
        </div>
      </div>

      {/* Onboarding banner if no Google Calendar iCal is connected yet */}
      {!hasRemoteCalendars && (
        <div className="mx-2.5 mt-2 p-2.5 rounded-lg bg-blue-500/[0.07] border border-blue-500/20 text-[11px] space-y-1.5 shrink-0">
          <div className="font-semibold text-blue-600 dark:text-blue-400 flex items-center gap-1.5">
            <CalendarBlank size={14} weight="duotone" />
            <span>Conecta tu Google Calendar</span>
          </div>
          <p className="text-neutral-600 dark:text-neutral-400 leading-snug">
            Pega tus enlaces iCal de Google Calendar o importa un archivo <code>.ics</code> / caché de My Widget.
          </p>
          <button
            type="button"
            onClick={() => setIsManageModalOpen(true)}
            className="w-full py-1.5 px-2.5 rounded-md bg-[#1a73e8] hover:bg-[#1765cc] text-white font-medium text-[11px] transition cursor-pointer"
          >
            + Conectar iCal / Importar
          </button>
        </div>
      )}

      {/* 2. Main View Area */}
      <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
        {viewMode === 'month' && (
          <>
            {/* Mini Month Grid */}
            <div className="px-2 pt-2 pb-1.5 shrink-0">
              <div className="grid grid-cols-7 mb-1">
                {WEEKDAYS_SHORT.map((d) => (
                  <div
                    key={d}
                    className="text-center text-[10px] font-semibold text-neutral-400 dark:text-neutral-500 py-0.5"
                  >
                    {d}
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-7 gap-y-0.5">
                {monthGrid.map((cell) => {
                  const isToday = cell.dateKey === todayKey
                  const isSelected = cell.dateKey === selectedDateKey
                  return (
                    <button
                      key={cell.dateKey}
                      type="button"
                      onClick={() => {
                        setSelectedDateKey(cell.dateKey)
                        const d = fromDateKey(cell.dateKey)
                        if (d.getMonth() !== cursorMonth.month || d.getFullYear() !== cursorMonth.year) {
                          setCursorMonth({ year: d.getFullYear(), month: d.getMonth() })
                        }
                      }}
                      onDoubleClick={() => openCreateEvent(cell.dateKey)}
                      className={`relative flex flex-col items-center justify-center py-1 rounded-md transition cursor-pointer tabular-nums ${
                        isSelected
                          ? 'bg-[#1a73e8]/15 dark:bg-[#1a73e8]/25 ring-1 ring-[#1a73e8]/50'
                          : 'hover:bg-black/[0.04] dark:hover:bg-white/[0.06]'
                      } ${
                        !cell.inCurrentMonth ? 'opacity-35' : ''
                      }`}
                    >
                      <span
                        className={`w-5 h-5 flex items-center justify-center rounded-full text-[11px] font-medium ${
                          isToday
                            ? 'bg-[#1a73e8] text-white font-semibold'
                            : isSelected
                            ? 'text-[#1a73e8] dark:text-blue-300 font-semibold'
                            : ''
                        }`}
                      >
                        {cell.dayNumber}
                      </span>
                      <div className="h-1.5 flex items-center justify-center gap-0.5 mt-0.5">
                        {cell.dots.map((color, idx) => (
                          <span
                            key={idx}
                            className="w-1 h-1 rounded-full"
                            style={{ backgroundColor: color }}
                          />
                        ))}
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Selected Day Events List */}
            <div className="flex-1 flex flex-col min-h-0 border-t border-[var(--app-border)]">
              <div className="px-3 py-1.5 flex items-center justify-between bg-black/[0.015] dark:bg-white/[0.02] shrink-0">
                <span className="text-[11px] font-semibold capitalize text-neutral-600 dark:text-neutral-300 truncate">
                  {selectedDateKey === todayKey ? `Hoy · ${formatFullDateEs(selectedDateKey)}` : formatFullDateEs(selectedDateKey)}
                </span>
                <span className="text-[10px] text-neutral-400 tabular-nums shrink-0 ml-1">
                  {selectedDayEvents.length} {selectedDayEvents.length === 1 ? 'evento' : 'eventos'}
                </span>
              </div>

              <div className="flex-1 overflow-y-auto custom-scrollbar px-2 py-1.5 space-y-1">
                {selectedDayEvents.length === 0 ? (
                  <div className="py-6 text-center text-[11px] text-neutral-400 dark:text-neutral-500 space-y-1.5">
                    <p>Sin eventos para este día</p>
                    <button
                      type="button"
                      onClick={() => openCreateEvent(selectedDateKey)}
                      className="text-[#1a73e8] dark:text-blue-400 hover:underline font-medium cursor-pointer"
                    >
                      + Añadir evento
                    </button>
                  </div>
                ) : (
                  selectedDayEvents.map((ev) => (
                    <EventCard key={ev.id} ev={ev} onClick={() => setDetailEvent(ev)} />
                  ))
                )}
              </div>
            </div>
          </>
        )}

        {viewMode === 'agenda' && (
          <div className="flex-1 overflow-y-auto custom-scrollbar px-2 py-2 space-y-3">
            {agendaDays.map((group) => (
              <div key={group.dateKey} className="space-y-1">
                <div className="sticky top-0 z-10 px-1.5 py-1 rounded bg-[var(--obsidian-sidebar-bg,#181818)]/95 backdrop-blur-xs border-b border-[var(--app-border)] flex items-center justify-between">
                  <span
                    className={`text-[11px] font-semibold capitalize ${
                      group.dateKey === todayKey ? 'text-[#1a73e8] dark:text-blue-400' : 'text-neutral-600 dark:text-neutral-300'
                    }`}
                  >
                    {group.label}
                  </span>
                  <button
                    type="button"
                    onClick={() => openCreateEvent(group.dateKey)}
                    className="p-0.5 rounded hover:bg-black/[0.06] dark:hover:bg-white/[0.08] text-neutral-400 hover:text-[var(--app-text-primary)] cursor-pointer"
                    title="Crear evento este día"
                  >
                    <Plus size={11} />
                  </button>
                </div>
                {group.events.length === 0 ? (
                  <div className="px-2 py-1.5 text-[11px] text-neutral-400 italic">Sin eventos</div>
                ) : (
                  group.events.map((ev) => (
                    <EventCard key={`${group.dateKey}-${ev.id}`} ev={ev} onClick={() => setDetailEvent(ev)} />
                  ))
                )}
              </div>
            ))}
          </div>
        )}

        {viewMode === 'day' && (
          <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
            {/* Day header + All-day strip */}
            <div className="px-2.5 py-1.5 border-b border-[var(--app-border)] shrink-0 space-y-1">
              <div className="text-[11px] font-semibold capitalize text-neutral-600 dark:text-neutral-300">
                {selectedDateKey === todayKey ? `Hoy · ${formatFullDateEs(selectedDateKey)}` : formatFullDateEs(selectedDateKey)}
              </div>
              {dayAllDayEvents.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {dayAllDayEvents.map((ev) => (
                    <button
                      key={ev.id}
                      type="button"
                      onClick={() => setDetailEvent(ev)}
                      className="px-1.5 py-0.5 rounded text-[10px] font-medium text-white truncate max-w-full cursor-pointer hover:opacity-90 transition"
                      style={{ backgroundColor: ev.color }}
                      title={ev.title}
                    >
                      {ev.title}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* 24-hour scrollable timeline */}
            <div ref={dayTimelineRef} className="flex-1 overflow-y-auto custom-scrollbar relative">
              <div className="relative" style={{ height: `${24 * HOUR_HEIGHT}px` }}>
                {Array.from({ length: 24 }, (_, hour) => (
                  <div
                    key={hour}
                    onClick={() => openCreateEvent(selectedDateKey, hour)}
                    className="flex border-b border-black/[0.04] dark:border-white/[0.04] hover:bg-black/[0.02] dark:hover:bg-white/[0.02] cursor-pointer"
                    style={{ height: `${HOUR_HEIGHT}px` }}
                    title={`Clic para crear evento a las ${String(hour).padStart(2, '0')}:00`}
                  >
                    <div className="w-10 shrink-0 pr-1.5 pt-0.5 text-right text-[10px] text-neutral-400 dark:text-neutral-500 tabular-nums select-none">
                      {String(hour).padStart(2, '0')}:00
                    </div>
                    <div className="flex-1 border-l border-[var(--app-border)]" />
                  </div>
                ))}

                {/* Current time indicator line */}
                {selectedDateKey === todayKey && (
                  <div
                    className="absolute left-9 right-0 pointer-events-none z-20 flex items-center"
                    style={{ top: `${currentMinuteTopPx}px` }}
                  >
                    <span className="w-2 h-2 rounded-full bg-red-500 -ml-1 shrink-0" />
                    <div className="flex-1 h-[1.5px] bg-red-500" />
                  </div>
                )}

                {/* Positioned timed events */}
                <div className="absolute top-0 bottom-0 left-11 right-1.5 pointer-events-none">
                  {dayTimedPositioned.map((item) => {
                    const widthPct = 100 / item.totalCols
                    const leftPct = item.col * widthPct
                    return (
                      <button
                        key={item.event.id}
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation()
                          setDetailEvent(item.event)
                        }}
                        style={{
                          top: `${item.topPx + 1}px`,
                          height: `${item.heightPx - 2}px`,
                          left: `calc(${leftPct}% + 1px)`,
                          width: `calc(${widthPct}% - 2px)`,
                          backgroundColor: `${item.event.color}22`,
                          borderLeft: `3px solid ${item.event.color}`,
                        }}
                        className="pointer-events-auto absolute rounded px-1.5 py-0.5 text-left overflow-hidden hover:brightness-110 transition cursor-pointer"
                      >
                        <div className="text-[10.5px] font-semibold leading-tight truncate text-[var(--app-text-primary)]">
                          {item.event.title}
                        </div>
                        {item.heightPx >= 32 && (
                          <div className="text-[9.5px] text-neutral-500 dark:text-neutral-400 tabular-nums truncate">
                            {formatTimeRange(item.event)}
                          </div>
                        )}
                      </button>
                    )
                  })}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 3. Collapsible "Mis calendarios" Footer */}
      <div className="border-t border-[var(--app-border)] shrink-0 bg-black/[0.015] dark:bg-white/[0.015]">
        <div className="px-2.5 py-1.5 flex items-center justify-between">
          <button
            type="button"
            onClick={() => setCalendarsPanelOpen(!calendarsPanelOpen)}
            className="flex items-center gap-1 text-[10.5px] font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400 hover:text-[var(--app-text-primary)] cursor-pointer"
          >
            {calendarsPanelOpen ? <CaretDown size={11} /> : <CaretRight size={11} />}
            <span>Mis calendarios</span>
          </button>
          <button
            type="button"
            onClick={() => setIsManageModalOpen(true)}
            className="text-[10.5px] text-[#1a73e8] dark:text-blue-400 hover:underline font-medium cursor-pointer"
          >
            + Añadir
          </button>
        </div>

        {calendarsPanelOpen && (
          <div className="px-2 pb-2 max-h-32 overflow-y-auto custom-scrollbar space-y-0.5">
            {sources.map((src) => {
              const isSyncing = Boolean(syncingIds[src.id])
              return (
                <div
                  key={src.id}
                  className="flex items-center justify-between gap-1.5 px-1.5 py-1 rounded-md hover:bg-black/[0.04] dark:hover:bg-white/[0.05] group"
                >
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
                    <span className="text-[11.5px] truncate">{src.name}</span>
                  </button>

                  {isSyncing && <ArrowsClockwise size={11} className="animate-spin text-blue-500 shrink-0" />}
                  {!isSyncing && src.lastError && (
                    <span title={src.lastError} className="text-rose-500 shrink-0">
                      <WarningCircle size={12} weight="fill" />
                    </span>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Modal 1: Event Detail Dialog */}
      <dialog
        ref={detailDialogRef}
        {...({ closedby: 'any' } as Record<string, string>)}
        aria-labelledby="cal-detail-title"
        className="m-auto w-[92vw] max-w-md rounded-xl bg-white dark:bg-[#232325] text-[var(--app-text-primary)] border border-[var(--app-border)] shadow-2xl p-0 backdrop:bg-black/45 backdrop:backdrop-blur-[2px]"
      >
        {detailEvent && (
          <div className="p-4 space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-2.5 min-w-0">
                <span
                  className="w-3 h-3 rounded-sm mt-1 shrink-0"
                  style={{ backgroundColor: detailEvent.color }}
                />
                <div className="min-w-0">
                  <h2 id="cal-detail-title" className="text-sm font-semibold leading-snug break-words">
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
                  {formatFullDateEs(detailEvent.startIso.slice(0, 10))} · {formatTimeRange(detailEvent)}
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

      {/* Modal 2: Create / Edit Local Event */}
      <dialog
        ref={eventFormDialogRef}
        {...({ closedby: 'any' } as Record<string, string>)}
        aria-labelledby="cal-form-title"
        className="m-auto w-[92vw] max-w-md rounded-xl bg-white dark:bg-[#232325] text-[var(--app-text-primary)] border border-[var(--app-border)] shadow-2xl p-0 backdrop:bg-black/45 backdrop:backdrop-blur-[2px]"
      >
        <form onSubmit={handleSaveLocalEvent} className="p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h2 id="cal-form-title" className="text-sm font-semibold">
              {editingLocalEventId ? 'Editar evento' : 'Nuevo evento'}
            </h2>
            <button
              type="button"
              onClick={() => setIsEventFormOpen(false)}
              className="p-1 rounded-md hover:bg-black/[0.06] dark:hover:bg-white/[0.08] text-neutral-400 cursor-pointer"
            >
              <X size={15} />
            </button>
          </div>

          <input
            type="text"
            value={evTitle}
            onChange={(e) => setEvTitle(e.target.value)}
            placeholder="Título del evento..."
            autoFocus
            className="w-full px-3 py-2 rounded-lg bg-black/[0.03] dark:bg-white/[0.05] border border-[var(--app-border)] text-xs outline-none focus:border-[#1a73e8]"
          />

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-[10.5px] text-neutral-500 mb-1">Fecha</label>
              <input
                type="date"
                value={evDate}
                onChange={(e) => setEvDate(e.target.value)}
                className="w-full px-2.5 py-1.5 rounded-lg bg-black/[0.03] dark:bg-white/[0.05] border border-[var(--app-border)] text-xs outline-none"
              />
            </div>
            <div className="flex items-end pb-1.5">
              <label className="inline-flex items-center gap-2 text-xs cursor-pointer">
                <input
                  type="checkbox"
                  checked={evAllDay}
                  onChange={(e) => setEvAllDay(e.target.checked)}
                  className="rounded accent-[#1a73e8]"
                />
                <span>Todo el día</span>
              </label>
            </div>
          </div>

          {!evAllDay && (
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[10.5px] text-neutral-500 mb-1">Inicio</label>
                <input
                  type="time"
                  value={evStartTime}
                  onChange={(e) => setEvStartTime(e.target.value)}
                  className="w-full px-2.5 py-1.5 rounded-lg bg-black/[0.03] dark:bg-white/[0.05] border border-[var(--app-border)] text-xs outline-none"
                />
              </div>
              <div>
                <label className="block text-[10.5px] text-neutral-500 mb-1">Fin</label>
                <input
                  type="time"
                  value={evEndTime}
                  onChange={(e) => setEvEndTime(e.target.value)}
                  className="w-full px-2.5 py-1.5 rounded-lg bg-black/[0.03] dark:bg-white/[0.05] border border-[var(--app-border)] text-xs outline-none"
                />
              </div>
            </div>
          )}

          <input
            type="text"
            value={evLocation}
            onChange={(e) => setEvLocation(e.target.value)}
            placeholder="Ubicación o enlace (opcional)"
            className="w-full px-3 py-1.5 rounded-lg bg-black/[0.03] dark:bg-white/[0.05] border border-[var(--app-border)] text-xs outline-none"
          />

          <textarea
            value={evDescription}
            onChange={(e) => setEvDescription(e.target.value)}
            placeholder="Notas o descripción..."
            rows={3}
            className="w-full px-3 py-1.5 rounded-lg bg-black/[0.03] dark:bg-white/[0.05] border border-[var(--app-border)] text-xs outline-none resize-none"
          />

          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={() => setIsEventFormOpen(false)}
              className="px-3 py-1.5 rounded-lg border border-[var(--app-border)] text-xs hover:bg-black/[0.04] dark:hover:bg-white/[0.06] cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-3.5 py-1.5 rounded-lg bg-[#1a73e8] hover:bg-[#1765cc] text-white text-xs font-medium cursor-pointer"
            >
              Guardar
            </button>
          </div>
        </form>
      </dialog>

      {/* Modal 3: Manage Google Calendar iCal Feeds & Import */}
      <dialog
        ref={manageDialogRef}
        {...({ closedby: 'any' } as Record<string, string>)}
        aria-labelledby="cal-manage-title"
        className="m-auto w-[94vw] max-w-lg rounded-xl bg-white dark:bg-[#232325] text-[var(--app-text-primary)] border border-[var(--app-border)] shadow-2xl p-0 backdrop:bg-black/45 backdrop:backdrop-blur-[2px]"
      >
        <div className="p-4 space-y-4 max-h-[85dvh] overflow-y-auto custom-scrollbar">
          <div className="flex items-center justify-between">
            <div>
              <h2 id="cal-manage-title" className="text-sm font-semibold">
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

          {/* Add new iCal form */}
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

          {/* Existing calendars list */}
          <div className="space-y-1.5">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-neutral-500">
              Calendarios configurados
            </div>
            {sources.map((src) => (
              <div
                key={src.id}
                className="p-2.5 rounded-lg border border-[var(--app-border)] flex items-center justify-between gap-2"
              >
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

                {src.id !== LOCAL_CALENDAR_ID && (
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
            ))}
          </div>

          {/* Import .ics or My Widget JSON cache */}
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

function EventCard({ ev, onClick }: { ev: CalendarEventView; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full text-left px-2 py-1.5 rounded-lg border border-[var(--app-border)] bg-white/70 dark:bg-white/[0.03] hover:bg-black/[0.03] dark:hover:bg-white/[0.06] transition flex items-stretch gap-2 cursor-pointer group"
    >
      <span
        className="w-1 rounded-full shrink-0"
        style={{ backgroundColor: ev.color }}
      />
      <div className="min-w-0 flex-1">
        <div className="text-[11.5px] font-medium leading-snug truncate group-hover:text-[#1a73e8] dark:group-hover:text-blue-400 transition">
          {ev.title}
        </div>
        <div className="flex items-center gap-2 text-[10px] text-neutral-500 dark:text-neutral-400 mt-0.5 tabular-nums">
          <span>{formatTimeRange(ev)}</span>
          {ev.location && (
            <span className="truncate flex items-center gap-0.5">
              <MapPin size={9} />
              {ev.location}
            </span>
          )}
        </div>
      </div>
    </button>
  )
}
