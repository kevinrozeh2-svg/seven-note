import { create } from 'zustand'
import { fetchIcalFeed, postCalendarWebhook } from './calendarFetcher'
import { parseIcalText, parseMyWidgetCacheJson, type ParsedIcalEvent } from './icalParser'
import { getCurrentMember, isUserAdmin } from './teamAuth'

export const GOOGLE_CALENDAR_PALETTE = [
  { name: 'Azul Google', hex: '#1a73e8' },
  { name: 'Tomate', hex: '#d93025' },
  { name: 'Mandarina', hex: '#f4511e' },
  { name: 'Banana', hex: '#f6bf26' },
  { name: 'Salvia', hex: '#0b8043' },
  { name: 'Pavo real', hex: '#039be5' },
  { name: 'Arándano', hex: '#3f51b5' },
  { name: 'Lavanda', hex: '#7986cb' },
  { name: 'Uva', hex: '#8e24aa' },
  { name: 'Grafito', hex: '#616161' },
]

export interface CalendarSource {
  id: string
  name: string
  icalUrl: string
  googleCalendarId?: string
  color: string
  enabled: boolean
  isLocalOnly?: boolean
  lastSync?: number
  lastError?: string | null
  eventCount?: number
  /** Empty / undefined means visible to all team members */
  visibleToMemberIds?: string[]
}

export interface CalendarWebhookConfig {
  enabled: boolean
  url: string
  secret: string
}

export interface CalendarEventView extends ParsedIcalEvent {
  calendarId: string
  calendarName: string
  color: string
  isLocal: boolean
  platform?: CalendarPlatformId
}

export type CalendarPlatformId = 'general' | 'meet' | 'zoom' | 'figma' | 'slack' | 'redes'

export interface CalendarPreferences {
  weekStartsOn: 'monday' | 'sunday'
  timeFormat: '24h' | '12h'
  cardStyle: 'pastel' | 'classic'
  hourDensity: 'compact' | 'comfortable' | 'spacious'
}

export type CalendarSidebarViewMode = 'month' | 'agenda' | 'day'

const STORAGE_SOURCES_KEY = 'seven_note_cal_sources_v1'
const STORAGE_CACHE_KEY = 'seven_note_cal_cache_v1'
const STORAGE_LOCAL_EVENTS_KEY = 'seven_note_cal_local_events_v1'
const STORAGE_UI_KEY = 'seven_note_cal_ui_v1'
const STORAGE_PREFS_KEY = 'seven_note_cal_prefs_v1'
const STORAGE_WEBHOOK_KEY = 'seven_note_cal_webhook_v1'
const STORAGE_DEFAULTS_SEEDED_KEY = 'seven_note_cal_defaults_seeded_v1'

const DEFAULT_WEBHOOK_CONFIG: CalendarWebhookConfig = {
  enabled: false,
  url: '',
  secret: '',
}

const DEFAULT_PREFERENCES: CalendarPreferences = {
  weekStartsOn: 'monday',
  timeFormat: '12h',
  cardStyle: 'pastel',
  hourDensity: 'spacious',
}

export const LOCAL_CALENDAR_ID = 'local-personal'

const DEFAULT_LOCAL_CALENDAR: CalendarSource = {
  id: LOCAL_CALENDAR_ID,
  name: 'Personal (Seven Note)',
  icalUrl: '',
  color: '#1a73e8',
  enabled: true,
  isLocalOnly: true,
}

// Security: never hardcode private Google Calendar iCal URLs or secrets in the client bundle.
// Users configure their own calendar URLs locally in Settings / Calendar.
const DEFAULT_GOOGLE_CALENDARS: CalendarSource[] = []

export function toDateKey(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export function fromDateKey(key: string): Date {
  const [y, m, d] = key.split('-').map(Number)
  return new Date(y || 2026, (m || 1) - 1, d || 1, 0, 0, 0, 0)
}

function loadJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return fallback
    return JSON.parse(raw) as T
  } catch {
    return fallback
  }
}

function saveJson(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // Ignore storage quota issues
  }
}

function loadInitialSources(): CalendarSource[] {
  let saved = loadJson<CalendarSource[]>(STORAGE_SOURCES_KEY, [])
  if (!saved.some((s) => s.id === LOCAL_CALENDAR_ID)) {
    saved = [DEFAULT_LOCAL_CALENDAR, ...saved]
  }

  try {
    if (!localStorage.getItem(STORAGE_DEFAULTS_SEEDED_KEY)) {
      for (const defCal of DEFAULT_GOOGLE_CALENDARS) {
        const alreadyExists = saved.some(
          (s) => s.id === defCal.id || (s.icalUrl && s.icalUrl === defCal.icalUrl)
        )
        if (!alreadyExists) {
          saved.push(defCal)
        }
      }
      localStorage.setItem(STORAGE_DEFAULTS_SEEDED_KEY, '1')
      saveJson(STORAGE_SOURCES_KEY, saved)
    }
  } catch {
    // Ignore storage access errors
  }

  return saved
}

interface CalendarState {
  sources: CalendarSource[]
  eventsByCalendar: Record<string, ParsedIcalEvent[]>
  localEvents: ParsedIcalEvent[]
  syncingIds: Record<string, boolean>
  selectedDateKey: string
  viewMode: CalendarSidebarViewMode
  calendarsPanelOpen: boolean
  preferences: CalendarPreferences
  enabledPlatforms: Record<CalendarPlatformId, boolean>
  webhookConfig: CalendarWebhookConfig

  setSelectedDateKey: (key: string) => void
  setViewMode: (mode: CalendarSidebarViewMode) => void
  setCalendarsPanelOpen: (open: boolean) => void
  updatePreferences: (patch: Partial<CalendarPreferences>) => void
  togglePlatform: (platform: CalendarPlatformId) => void
  updateWebhookConfig: (patch: Partial<CalendarWebhookConfig>) => void
  testWebhookConnection: () => Promise<{ ok: boolean; message: string }>

  addIcalSource: (input: { name: string; icalUrl: string; color: string }) => Promise<CalendarSource>
  updateSource: (
    id: string,
    patch: Partial<Pick<CalendarSource, 'name' | 'icalUrl' | 'color' | 'enabled' | 'visibleToMemberIds'>>
  ) => void
  setSourceMembers: (id: string, memberIds: string[]) => void
  removeSource: (id: string) => void
  toggleSource: (id: string) => void

  syncSource: (id: string) => Promise<{ ok: boolean; count: number; error?: string }>
  syncAllSources: () => Promise<void>

  addLocalEvent: (ev: Omit<ParsedIcalEvent, 'id' | 'uid'> & { color?: string }) => void
  updateLocalEvent: (id: string, patch: Partial<ParsedIcalEvent>) => void
  deleteLocalEvent: (id: string) => void

  importIcsFile: (name: string, icsText: string, color?: string) => number
  importMyWidgetCache: (jsonText: string, calendarName?: string, color?: string) => number
}

const initialUi = loadJson<{ viewMode?: CalendarSidebarViewMode; calendarsPanelOpen?: boolean }>(
  STORAGE_UI_KEY,
  {}
)
const initialPrefs = {
  ...DEFAULT_PREFERENCES,
  ...loadJson<Partial<CalendarPreferences>>(STORAGE_PREFS_KEY, {}),
}
const savedWebhook = loadJson<Partial<CalendarWebhookConfig>>(STORAGE_WEBHOOK_KEY, {})
const initialWebhook: CalendarWebhookConfig = {
  enabled: savedWebhook.url ? Boolean(savedWebhook.enabled) : DEFAULT_WEBHOOK_CONFIG.enabled,
  url: savedWebhook.url || DEFAULT_WEBHOOK_CONFIG.url,
  secret: savedWebhook.secret || DEFAULT_WEBHOOK_CONFIG.secret,
}

function extractGoogleCalendarIdFromIcal(icalUrl: string): string | undefined {
  const m = icalUrl.match(/calendar\.google\.com\/calendar\/ical\/([^/]+)\//i)
  if (!m) return undefined
  try {
    return decodeURIComponent(m[1])
  } catch {
    return m[1]
  }
}

export const useCalendarStore = create<CalendarState>((set, get) => ({
  sources: loadInitialSources(),
  eventsByCalendar: loadJson<Record<string, ParsedIcalEvent[]>>(STORAGE_CACHE_KEY, {}),
  localEvents: loadJson<ParsedIcalEvent[]>(STORAGE_LOCAL_EVENTS_KEY, []),
  syncingIds: {},
  selectedDateKey: toDateKey(new Date()),
  viewMode: initialUi.viewMode || 'month',
  calendarsPanelOpen: initialUi.calendarsPanelOpen ?? true,
  preferences: initialPrefs,
  webhookConfig: initialWebhook,
  enabledPlatforms: {
    general: true,
    meet: true,
    zoom: true,
    figma: true,
    slack: true,
    redes: true,
  },

  setSelectedDateKey: (key) => set({ selectedDateKey: key }),

  updateWebhookConfig: (patch) => {
    const next = { ...get().webhookConfig, ...patch }
    set({ webhookConfig: next })
    saveJson(STORAGE_WEBHOOK_KEY, next)
  },

  testWebhookConnection: async () => {
    const cfg = get().webhookConfig
    if (!cfg.url.trim()) {
      return { ok: false, message: 'Introduce la URL del Google Apps Script.' }
    }
    try {
      const res = await postCalendarWebhook(cfg.url, {
        action: 'ping',
        secret: cfg.secret,
      })
      if (!res.ok) {
        return { ok: false, message: res.error || 'Error de autenticación o script.' }
      }
      return { ok: true, message: res.message || 'Conexión exitosa con Google Calendar.' }
    } catch (err: unknown) {
      return {
        ok: false,
        message: err instanceof Error ? err.message : 'No se pudo conectar con Google Apps Script.',
      }
    }
  },

  updatePreferences: (patch) => {
    const next = { ...get().preferences, ...patch }
    set({ preferences: next })
    saveJson(STORAGE_PREFS_KEY, next)
  },

  togglePlatform: (platform) => {
    const cur = get().enabledPlatforms
    set({ enabledPlatforms: { ...cur, [platform]: !cur[platform] } })
  },

  setViewMode: (mode) => {
    set({ viewMode: mode })
    saveJson(STORAGE_UI_KEY, { viewMode: mode, calendarsPanelOpen: get().calendarsPanelOpen })
  },

  setCalendarsPanelOpen: (open) => {
    set({ calendarsPanelOpen: open })
    saveJson(STORAGE_UI_KEY, { viewMode: get().viewMode, calendarsPanelOpen: open })
  },

  addIcalSource: async ({ name, icalUrl, color }) => {
    const id = `ical_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`
    const newSource: CalendarSource = {
      id,
      name: name.trim() || 'Google Calendar',
      icalUrl: icalUrl.trim(),
      googleCalendarId: extractGoogleCalendarIdFromIcal(icalUrl.trim()),
      color: color || GOOGLE_CALENDAR_PALETTE[0].hex,
      enabled: true,
      isLocalOnly: false,
    }
    const nextSources = [...get().sources, newSource]
    set({ sources: nextSources })
    saveJson(STORAGE_SOURCES_KEY, nextSources)

    if (newSource.icalUrl) {
      await get().syncSource(id)
    }
    return get().sources.find((s) => s.id === id) || newSource
  },

  updateSource: (id, patch) => {
    const nextSources = get().sources.map((s) => (s.id === id ? { ...s, ...patch } : s))
    set({ sources: nextSources })
    saveJson(STORAGE_SOURCES_KEY, nextSources)
  },

  setSourceMembers: (id, memberIds) => {
    if (!isUserAdmin(getCurrentMember())) return
    const nextSources = get().sources.map((s) =>
      s.id === id ? { ...s, visibleToMemberIds: memberIds } : s
    )
    set({ sources: nextSources })
    saveJson(STORAGE_SOURCES_KEY, nextSources)
  },

  removeSource: (id) => {
    if (id === LOCAL_CALENDAR_ID) return
    const nextSources = get().sources.filter((s) => s.id !== id)
    const nextCache = { ...get().eventsByCalendar }
    delete nextCache[id]
    set({ sources: nextSources, eventsByCalendar: nextCache })
    saveJson(STORAGE_SOURCES_KEY, nextSources)
    saveJson(STORAGE_CACHE_KEY, nextCache)
  },

  toggleSource: (id) => {
    const nextSources = get().sources.map((s) => (s.id === id ? { ...s, enabled: !s.enabled } : s))
    set({ sources: nextSources })
    saveJson(STORAGE_SOURCES_KEY, nextSources)
  },

  syncSource: async (id) => {
    const src = get().sources.find((s) => s.id === id)
    if (!src || src.isLocalOnly || !src.icalUrl) {
      return { ok: true, count: 0 }
    }

    set((state) => ({ syncingIds: { ...state.syncingIds, [id]: true } }))
    try {
      const icsText = await fetchIcalFeed(src.icalUrl)
      const parsed = parseIcalText(icsText)

      const nextCache = {
        ...get().eventsByCalendar,
        [id]: parsed.events,
      }
      const autoName =
        src.name === 'Google Calendar' && parsed.calendarName
          ? parsed.calendarName
          : src.name

      const nextSources = get().sources.map((s) =>
        s.id === id
          ? {
              ...s,
              name: autoName,
              lastSync: Date.now(),
              lastError: null,
              eventCount: parsed.events.length,
            }
          : s
      )

      set((state) => {
        const nextSyncing = { ...state.syncingIds }
        delete nextSyncing[id]
        return {
          eventsByCalendar: nextCache,
          sources: nextSources,
          syncingIds: nextSyncing,
        }
      })

      saveJson(STORAGE_CACHE_KEY, nextCache)
      saveJson(STORAGE_SOURCES_KEY, nextSources)
      return { ok: true, count: parsed.events.length }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Error al sincronizar el calendario.'
      const nextSources = get().sources.map((s) =>
        s.id === id ? { ...s, lastError: message } : s
      )
      set((state) => {
        const nextSyncing = { ...state.syncingIds }
        delete nextSyncing[id]
        return { sources: nextSources, syncingIds: nextSyncing }
      })
      saveJson(STORAGE_SOURCES_KEY, nextSources)
      return { ok: false, count: 0, error: message }
    }
  },

  syncAllSources: async () => {
    const remoteSources = get().sources.filter((s) => !s.isLocalOnly && s.icalUrl)
    await Promise.allSettled(remoteSources.map((s) => get().syncSource(s.id)))
  },

  addLocalEvent: (ev) => {
    const id = `local_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`
    const newEv: ParsedIcalEvent = {
      id,
      uid: id,
      title: ev.title,
      startIso: ev.startIso,
      endIso: ev.endIso,
      isAllDay: ev.isAllDay,
      description: ev.description || '',
      location: ev.location || '',
      url: ev.url,
      platform: ev.platform,
      colorOverride: ev.colorOverride,
      targetCalendarId: ev.targetCalendarId,
      teamMemberIds: ev.teamMemberIds,
      reminder: ev.reminder,
    }
    const next = [...get().localEvents, newEv]
    set({ localEvents: next })
    saveJson(STORAGE_LOCAL_EVENTS_KEY, next)

    // Two-way async push to Google Calendar via Apps Script if configured
    const { webhookConfig, sources } = get()
    const targetSrc = ev.targetCalendarId
      ? sources.find((s) => s.id === ev.targetCalendarId)
      : undefined
    const googleCalId =
      targetSrc?.googleCalendarId ||
      (targetSrc?.icalUrl ? extractGoogleCalendarIdFromIcal(targetSrc.icalUrl) : undefined)

    if (webhookConfig.enabled && webhookConfig.url && googleCalId) {
      postCalendarWebhook(webhookConfig.url, {
        action: 'create',
        secret: webhookConfig.secret,
        googleCalendarId: googleCalId,
        title: newEv.title,
        startIso: newEv.startIso,
        endIso: newEv.endIso,
        isAllDay: newEv.isAllDay,
        description: newEv.description,
        location: newEv.location,
      })
        .then((res) => {
          if (res.ok && res.googleEventId) {
            const updated = get().localEvents.map((item) =>
              item.id === id ? { ...item, googleEventId: res.googleEventId } : item
            )
            set({ localEvents: updated })
            saveJson(STORAGE_LOCAL_EVENTS_KEY, updated)
          }
          if (targetSrc) {
            setTimeout(() => {
              get().syncSource(targetSrc.id)
            }, 1500)
          }
        })
        .catch(() => {
          // Keep local event even if offline
        })
    }
  },

  updateLocalEvent: (id, patch) => {
    const existing = get().localEvents.find((ev) => ev.id === id)
    const next = get().localEvents.map((ev) => (ev.id === id ? { ...ev, ...patch } : ev))
    set({ localEvents: next })
    saveJson(STORAGE_LOCAL_EVENTS_KEY, next)

    const updatedEv = next.find((ev) => ev.id === id)
    const { webhookConfig, sources } = get()
    const targetSrc = updatedEv?.targetCalendarId
      ? sources.find((s) => s.id === updatedEv.targetCalendarId)
      : undefined
    const googleCalId =
      targetSrc?.googleCalendarId ||
      (targetSrc?.icalUrl ? extractGoogleCalendarIdFromIcal(targetSrc.icalUrl) : undefined)

    if (
      webhookConfig.enabled &&
      webhookConfig.url &&
      googleCalId &&
      (existing?.googleEventId || updatedEv?.googleEventId)
    ) {
      postCalendarWebhook(webhookConfig.url, {
        action: 'update',
        secret: webhookConfig.secret,
        googleCalendarId: googleCalId,
        googleEventId: updatedEv?.googleEventId || existing?.googleEventId,
        title: updatedEv?.title,
        startIso: updatedEv?.startIso,
        endIso: updatedEv?.endIso,
        isAllDay: updatedEv?.isAllDay,
        description: updatedEv?.description,
        location: updatedEv?.location,
      })
        .then(() => {
          if (targetSrc) {
            setTimeout(() => {
              get().syncSource(targetSrc.id)
            }, 1500)
          }
        })
        .catch(() => {})
    }
  },

  deleteLocalEvent: (id) => {
    const existing = get().localEvents.find((ev) => ev.id === id)
    const next = get().localEvents.filter((ev) => ev.id !== id)
    set({ localEvents: next })
    saveJson(STORAGE_LOCAL_EVENTS_KEY, next)

    const { webhookConfig, sources } = get()
    const targetSrc = existing?.targetCalendarId
      ? sources.find((s) => s.id === existing.targetCalendarId)
      : undefined
    const googleCalId =
      targetSrc?.googleCalendarId ||
      (targetSrc?.icalUrl ? extractGoogleCalendarIdFromIcal(targetSrc.icalUrl) : undefined)

    if (webhookConfig.enabled && webhookConfig.url && googleCalId && existing?.googleEventId) {
      postCalendarWebhook(webhookConfig.url, {
        action: 'delete',
        secret: webhookConfig.secret,
        googleCalendarId: googleCalId,
        googleEventId: existing.googleEventId,
      })
        .then(() => {
          if (targetSrc) {
            setTimeout(() => {
              get().syncSource(targetSrc.id)
            }, 1500)
          }
        })
        .catch(() => {})
    }
  },

  importIcsFile: (name, icsText, color = '#0b8043') => {
    const parsed = parseIcalText(icsText)
    const id = `imported_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`
    const newSource: CalendarSource = {
      id,
      name: parsed.calendarName || name.replace(/\.ics$/i, '') || 'Calendario importado',
      icalUrl: '',
      color,
      enabled: true,
      isLocalOnly: false,
      lastSync: Date.now(),
      eventCount: parsed.events.length,
    }
    const nextSources = [...get().sources, newSource]
    const nextCache = { ...get().eventsByCalendar, [id]: parsed.events }
    set({ sources: nextSources, eventsByCalendar: nextCache })
    saveJson(STORAGE_SOURCES_KEY, nextSources)
    saveJson(STORAGE_CACHE_KEY, nextCache)
    return parsed.events.length
  },

  importMyWidgetCache: (jsonText, calendarName = 'My Widget (Caché)', color = '#8e24aa') => {
    const events = parseMyWidgetCacheJson(jsonText)
    const id = `mywidget_${Date.now()}`
    const newSource: CalendarSource = {
      id,
      name: calendarName,
      icalUrl: '',
      color,
      enabled: true,
      isLocalOnly: false,
      lastSync: Date.now(),
      eventCount: events.length,
    }
    const nextSources = [...get().sources, newSource]
    const nextCache = { ...get().eventsByCalendar, [id]: events }
    set({ sources: nextSources, eventsByCalendar: nextCache })
    saveJson(STORAGE_SOURCES_KEY, nextSources)
    saveJson(STORAGE_CACHE_KEY, nextCache)
    return events.length
  },
}))

export function detectEventPlatform(ev: {
  platform?: string
  url?: string
  location?: string
  description?: string
  title?: string
  calendarName?: string
}): CalendarPlatformId {
  if (
    ev.platform === 'meet' ||
    ev.platform === 'zoom' ||
    ev.platform === 'figma' ||
    ev.platform === 'slack' ||
    ev.platform === 'redes' ||
    ev.platform === 'general'
  ) {
    return ev.platform
  }
  const text = `${ev.url || ''} ${ev.location || ''} ${ev.description || ''} ${ev.title || ''}`.toLowerCase()
  if (text.includes('meet.google.com') || text.includes('google meet')) return 'meet'
  if (text.includes('zoom.us')) return 'zoom'
  if (text.includes('figma.com') || text.includes('figma') || text.includes('diseño')) return 'figma'
  if (text.includes('slack.com') || text.includes('slack')) return 'slack'
  if ((ev.calendarName || '').toLowerCase().includes('redes') || text.includes('reel') || text.includes('instagram')) {
    return 'redes'
  }
  return 'general'
}

export function isCalendarVisibleToMember(src: CalendarSource, memberId?: string): boolean {
  if (!memberId) return true
  if (!src.visibleToMemberIds || src.visibleToMemberIds.length === 0) return true
  return src.visibleToMemberIds.includes(memberId)
}

/**
 * Computes all visible events from enabled calendars.
 */
export function getVisibleEvents(
  sources: CalendarSource[],
  eventsByCalendar: Record<string, ParsedIcalEvent[]>,
  localEvents: ParsedIcalEvent[],
  filterMemberId?: string
): CalendarEventView[] {
  const out: CalendarEventView[] = []
  for (const src of sources) {
    if (!src.enabled) continue
    if (filterMemberId && !isCalendarVisibleToMember(src, filterMemberId)) continue
    if (src.id === LOCAL_CALENDAR_ID) {
      for (const ev of localEvents) {
        out.push({
          ...ev,
          calendarId: src.id,
          calendarName: src.name,
          color: ev.colorOverride || src.color,
          isLocal: true,
          platform: detectEventPlatform({ ...ev, calendarName: src.name }),
        })
      }
    } else {
      const list = eventsByCalendar[src.id] || []
      for (const ev of list) {
        out.push({
          ...ev,
          calendarId: src.id,
          calendarName: src.name,
          color: src.color,
          isLocal: false,
          platform: detectEventPlatform({ ...ev, calendarName: src.name }),
        })
      }
    }
  }
  out.sort((a, b) => new Date(a.startIso).getTime() - new Date(b.startIso).getTime())
  return out
}

/**
 * Checks whether an event overlaps a given local date key (YYYY-MM-DD).
 * Respects exclusive DTEND for all-day events and multi-day timed events.
 */
export function eventOccursOnDate(ev: CalendarEventView, dateKey: string): boolean {
  if (ev.isAllDay) {
    const startKey = ev.startIso.slice(0, 10)
    const endKey = ev.endIso.slice(0, 10)
    // All-day DTEND is exclusive; if endKey <= startKey, treat as single day
    if (endKey <= startKey) {
      return dateKey === startKey
    }
    return dateKey >= startKey && dateKey < endKey
  }

  const dayStart = fromDateKey(dateKey)
  const dayEnd = new Date(dayStart.getFullYear(), dayStart.getMonth(), dayStart.getDate() + 1, 0, 0, 0, 0)
  const evStart = new Date(ev.startIso)
  const evEnd = new Date(ev.endIso)
  return evStart < dayEnd && evEnd > dayStart
}
