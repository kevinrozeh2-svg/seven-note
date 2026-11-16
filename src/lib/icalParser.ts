/**
 * RFC 5545 iCalendar (.ics) parser & recurrence expander,
 * plus importer for My Widget's google_calendar_cache.json.
 */

export interface ParsedIcalEvent {
  id: string
  uid: string
  title: string
  startIso: string // ISO 8601 instant or local wall-clock ISO for all-day (YYYY-MM-DDT00:00:00)
  endIso: string
  isAllDay: boolean
  description: string
  location: string
  url?: string
  status?: string
  organizer?: string
  recurrenceId?: string
  platform?: string
  colorOverride?: string
  googleEventId?: string
  targetCalendarId?: string
  teamMemberIds?: string[]
  reminder?: boolean
}

export interface IcalParseOutput {
  calendarName: string
  events: ParsedIcalEvent[]
  warnings: string[]
}

const WINDOWS_TO_IANA: Record<string, string> = {
  'Eastern Standard Time': 'America/New_York',
  'US Eastern Standard Time': 'America/Indiana/Indianapolis',
  'Central Standard Time': 'America/Chicago',
  'Mountain Standard Time': 'America/Denver',
  'Pacific Standard Time': 'America/Los_Angeles',
  'SA Pacific Standard Time': 'America/Bogota',
  'SA Eastern Standard Time': 'America/Cayenne',
  'SA Western Standard Time': 'America/La_Paz',
  'Venezuela Standard Time': 'America/Caracas',
  'Cuba Standard Time': 'America/Havana',
  'Mexico Standard Time': 'America/Mexico_City',
  'Central America Standard Time': 'America/Guatemala',
  'Argentina Standard Time': 'America/Argentina/Buenos_Aires',
  'E. South America Standard Time': 'America/Sao_Paulo',
  'GMT Standard Time': 'Europe/London',
  'Romance Standard Time': 'Europe/Paris',
  'W. Europe Standard Time': 'Europe/Berlin',
  'Central European Standard Time': 'Europe/Warsaw',
  'UTC': 'UTC',
  'Coordinated Universal Time': 'UTC',
}

function resolveTimeZone(tzid?: string): string | undefined {
  if (!tzid) return undefined
  const cleaned = tzid.trim().replace(/^"|"$/g, '')
  if (!cleaned) return undefined
  if (WINDOWS_TO_IANA[cleaned]) return WINDOWS_TO_IANA[cleaned]
  try {
    Intl.DateTimeFormat(undefined, { timeZone: cleaned })
    return cleaned
  } catch {
    return undefined
  }
}

function unfoldLines(raw: string): string[] {
  const normalized = raw.replace(/\r\n/g, '\n').replace(/\r/g, '\n')
  const rawLines = normalized.split('\n')
  const out: string[] = []
  for (const line of rawLines) {
    if ((line.startsWith(' ') || line.startsWith('\t')) && out.length > 0) {
      out[out.length - 1] += line.slice(1)
    } else {
      out.push(line)
    }
  }
  return out
}

function unescapeIcalText(val: string): string {
  return val
    .replace(/\\n/gi, '\n')
    .replace(/\\,/g, ',')
    .replace(/\\;/g, ';')
    .replace(/\\\\/g, '\\')
}

interface IcalProperty {
  name: string
  params: Record<string, string>
  value: string
}

function parsePropertyLine(line: string): IcalProperty | null {
  const colonIdx = findUnquotedColon(line)
  if (colonIdx <= 0) return null
  const left = line.slice(0, colonIdx)
  const value = line.slice(colonIdx + 1)

  const parts = splitParams(left)
  const name = (parts[0] || '').toUpperCase().trim()
  if (!name) return null

  const params: Record<string, string> = {}
  for (let i = 1; i < parts.length; i++) {
    const eq = parts[i].indexOf('=')
    if (eq > 0) {
      const k = parts[i].slice(0, eq).toUpperCase().trim()
      const v = parts[i].slice(eq + 1).trim().replace(/^"|"$/g, '')
      params[k] = v
    }
  }

  return { name, params, value }
}

function findUnquotedColon(line: string): number {
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (ch === '"') inQuotes = !inQuotes
    else if (ch === ':' && !inQuotes) return i
  }
  return -1
}

function splitParams(left: string): string[] {
  const out: string[] = []
  let current = ''
  let inQuotes = false
  for (let i = 0; i < left.length; i++) {
    const ch = left[i]
    if (ch === '"') {
      inQuotes = !inQuotes
      current += ch
    } else if (ch === ';' && !inQuotes) {
      out.push(current)
      current = ''
    } else {
      current += ch
    }
  }
  out.push(current)
  return out
}

interface ParsedDateValue {
  date: Date
  isAllDay: boolean
  tzid?: string
}

/**
 * Converts a wall-clock date/time in a given IANA timezone to a UTC Date.
 */
function zonedWallClockToDate(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  second: number,
  timeZone: string
): Date {
  const utcGuess = new Date(Date.UTC(year, month - 1, day, hour, minute, second))
  try {
    const dtf = new Intl.DateTimeFormat('en-US', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    })
    const parts = dtf.formatToParts(utcGuess)
    const get = (type: string) => Number(parts.find((p) => p.type === type)?.value || '0')
    const h = get('hour') === 24 ? 0 : get('hour')
    const tzAsUtc = Date.UTC(get('year'), get('month') - 1, get('day'), h, get('minute'), get('second'))
    const offsetMs = tzAsUtc - utcGuess.getTime()
    return new Date(utcGuess.getTime() - offsetMs)
  } catch {
    return new Date(year, month - 1, day, hour, minute, second)
  }
}

function parseIcalDate(raw: string, params: Record<string, string>): ParsedDateValue | null {
  const val = raw.trim()
  if (!val) return null

  const valueType = (params.VALUE || '').toUpperCase()
  const tzid = resolveTimeZone(params.TZID)

  // All-day YYYYMMDD
  if (valueType === 'DATE' || /^\d{8}$/.test(val)) {
    const m = /^(\d{4})(\d{2})(\d{2})/.exec(val)
    if (!m) return null
    const y = Number(m[1])
    const mo = Number(m[2])
    const d = Number(m[3])
    return {
      date: new Date(y, mo - 1, d, 0, 0, 0, 0),
      isAllDay: true,
      tzid,
    }
  }

  // DateTime YYYYMMDDTHHMMSS(Z)?
  const dtMatch = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})(Z)?$/i.exec(val)
  if (!dtMatch) return null

  const y = Number(dtMatch[1])
  const mo = Number(dtMatch[2])
  const d = Number(dtMatch[3])
  const h = Number(dtMatch[4])
  const mi = Number(dtMatch[5])
  const s = Number(dtMatch[6])
  const isUtc = Boolean(dtMatch[7])

  if (isUtc) {
    return {
      date: new Date(Date.UTC(y, mo - 1, d, h, mi, s)),
      isAllDay: false,
      tzid: 'UTC',
    }
  }

  if (tzid) {
    return {
      date: zonedWallClockToDate(y, mo, d, h, mi, s, tzid),
      isAllDay: false,
      tzid,
    }
  }

  // Floating local time
  return {
    date: new Date(y, mo - 1, d, h, mi, s),
    isAllDay: false,
  }
}

function parseDurationMs(raw: string): number {
  const m = /^([+-])?P(?:(\d+)W)?(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?$/i.exec(raw.trim())
  if (!m) return 0
  const sign = m[1] === '-' ? -1 : 1
  const weeks = Number(m[2] || 0)
  const days = Number(m[3] || 0)
  const hours = Number(m[4] || 0)
  const mins = Number(m[5] || 0)
  const secs = Number(m[6] || 0)
  return sign * (((weeks * 7 + days) * 86400 + hours * 3600 + mins * 60 + secs) * 1000)
}

function toLocalDateKey(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function formatAllDayIso(d: Date): string {
  return `${toLocalDateKey(d)}T00:00:00`
}

interface RawEventBag {
  props: IcalProperty[]
}

const BYDAY_MAP: Record<string, number> = {
  SU: 0,
  MO: 1,
  TU: 2,
  WE: 3,
  TH: 4,
  FR: 5,
  SA: 6,
}

function expandRRule(
  start: Date,
  rruleRaw: string,
  exdateKeys: Set<string>,
  windowStart: Date,
  windowEnd: Date,
  isAllDay: boolean
): Date[] {
  const parts: Record<string, string> = {}
  for (const token of rruleRaw.split(';')) {
    const eq = token.indexOf('=')
    if (eq > 0) {
      parts[token.slice(0, eq).toUpperCase().trim()] = token.slice(eq + 1).trim().toUpperCase()
    }
  }

  const freq = parts.FREQ
  if (!freq) return [start]

  const interval = Math.max(1, Number(parts.INTERVAL || 1))
  const count = parts.COUNT ? Math.max(1, Number(parts.COUNT)) : 400
  let until: Date | null = null
  if (parts.UNTIL) {
    const parsedUntil = parseIcalDate(parts.UNTIL, {})
    if (parsedUntil) {
      until = parsedUntil.date
      if (parsedUntil.isAllDay) {
        until = new Date(until.getFullYear(), until.getMonth(), until.getDate(), 23, 59, 59, 999)
      }
    }
  }

  const byDays = parts.BYDAY
    ? parts.BYDAY.split(',')
        .map((d) => d.replace(/^[+-]?\d+/, ''))
        .map((d) => BYDAY_MAP[d])
        .filter((n) => n !== undefined)
    : []

  const results: Date[] = []
  const maxIterations = 1200
  let generated = 0
  let cursor = new Date(start.getTime())

  for (let iter = 0; iter < maxIterations && generated < count; iter++) {
    if (until && cursor > until) break
    if (cursor > windowEnd) break

    if (freq === 'WEEKLY' && byDays.length > 0) {
      // Iterate each day in the current week
      const weekStart = new Date(cursor.getTime())
      const dayOfWeek = weekStart.getDay()
      weekStart.setDate(weekStart.getDate() - dayOfWeek)

      for (let d = 0; d < 7 && generated < count; d++) {
        const candidate = new Date(weekStart.getTime())
        candidate.setDate(weekStart.getDate() + d)
        candidate.setHours(start.getHours(), start.getMinutes(), start.getSeconds(), 0)
        if (candidate < start) continue
        if (until && candidate > until) break
        if (candidate > windowEnd) break
        if (!byDays.includes(candidate.getDay())) continue

        generated++
        const key = isAllDay ? toLocalDateKey(candidate) : String(candidate.getTime())
        if (!exdateKeys.has(key) && candidate >= windowStart) {
          results.push(candidate)
        }
      }
      cursor.setDate(cursor.getDate() + 7 * interval)
      continue
    }

    // Standard step
    if (cursor >= start) {
      generated++
      const key = isAllDay ? toLocalDateKey(cursor) : String(cursor.getTime())
      if (!exdateKeys.has(key) && cursor >= windowStart) {
        results.push(new Date(cursor.getTime()))
      }
    }

    if (freq === 'DAILY') {
      cursor.setDate(cursor.getDate() + interval)
    } else if (freq === 'WEEKLY') {
      cursor.setDate(cursor.getDate() + 7 * interval)
    } else if (freq === 'MONTHLY') {
      const targetDay = start.getDate()
      cursor.setMonth(cursor.getMonth() + interval, 1)
      const daysInMonth = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0).getDate()
      cursor.setDate(Math.min(targetDay, daysInMonth))
    } else if (freq === 'YEARLY') {
      cursor.setFullYear(cursor.getFullYear() + interval)
    } else {
      break
    }
  }

  return results
}

export function parseIcalText(
  icalText: string,
  options?: { windowStart?: Date; windowEnd?: Date }
): IcalParseOutput {
  const warnings: string[] = []
  if (!icalText || !icalText.trim()) {
    return { calendarName: '', events: [], warnings: ['El archivo iCal está vacío.'] }
  }

  const now = new Date()
  const windowStart = options?.windowStart ?? new Date(now.getFullYear() - 1, now.getMonth(), 1)
  const windowEnd = options?.windowEnd ?? new Date(now.getFullYear() + 2, now.getMonth(), 28)

  const lines = unfoldLines(icalText)
  let calendarName = ''
  const eventBags: RawEventBag[] = []
  let currentBag: RawEventBag | null = null
  let componentDepth = 0
  let inAlarm = false

  for (const rawLine of lines) {
    const line = rawLine.trimEnd()
    if (!line) continue
    const upper = line.toUpperCase()

    if (upper === 'BEGIN:VEVENT') {
      currentBag = { props: [] }
      componentDepth = 1
      inAlarm = false
      continue
    }
    if (upper === 'END:VEVENT') {
      if (currentBag) eventBags.push(currentBag)
      currentBag = null
      componentDepth = 0
      inAlarm = false
      continue
    }

    if (currentBag) {
      if (upper === 'BEGIN:VALARM') {
        inAlarm = true
        componentDepth++
        continue
      }
      if (upper === 'END:VALARM') {
        inAlarm = false
        componentDepth = Math.max(1, componentDepth - 1)
        continue
      }
      if (upper.startsWith('BEGIN:')) {
        componentDepth++
        continue
      }
      if (upper.startsWith('END:')) {
        componentDepth = Math.max(1, componentDepth - 1)
        continue
      }
      if (inAlarm || componentDepth > 1) continue

      const prop = parsePropertyLine(line)
      if (prop) currentBag.props.push(prop)
    } else {
      const prop = parsePropertyLine(line)
      if (prop && prop.name === 'X-WR-CALNAME' && !calendarName) {
        calendarName = unescapeIcalText(prop.value.trim())
      }
    }
  }

  const getProp = (bag: RawEventBag, name: string) =>
    bag.props.find((p) => p.name === name)

  const getAllProps = (bag: RawEventBag, name: string) =>
    bag.props.filter((p) => p.name === name)

  // Track RECURRENCE-ID overrides so we don't duplicate master instances
  const overrides = new Map<string, ParsedIcalEvent>()
  const masters: RawEventBag[] = []

  for (const bag of eventBags) {
    const recProp = getProp(bag, 'RECURRENCE-ID')
    if (!recProp) {
      masters.push(bag)
      continue
    }
    const uid = getProp(bag, 'UID')?.value.trim() || ''
    const recDate = parseIcalDate(recProp.value, recProp.params)
    const dtStartProp = getProp(bag, 'DTSTART')
    if (!dtStartProp) continue
    const startVal = parseIcalDate(dtStartProp.value, dtStartProp.params)
    if (!startVal) continue

    const status = getProp(bag, 'STATUS')?.value.trim().toUpperCase()
    if (status === 'CANCELLED') {
      if (uid && recDate) {
        const key = `${uid}__${startVal.isAllDay ? toLocalDateKey(recDate.date) : recDate.date.getTime()}`
        overrides.set(key, {
          id: key,
          uid,
          title: '',
          startIso: '',
          endIso: '',
          isAllDay: startVal.isAllDay,
          description: '',
          location: '',
          status: 'CANCELLED',
        })
      }
      continue
    }

    const ev = buildSingleEvent(bag, startVal, uid, getProp)
    if (ev && uid && recDate) {
      const key = `${uid}__${startVal.isAllDay ? toLocalDateKey(recDate.date) : recDate.date.getTime()}`
      overrides.set(key, ev)
    }
  }

  const finalEvents: ParsedIcalEvent[] = []
  const seenKeys = new Set<string>()

  for (const bag of masters) {
    const status = getProp(bag, 'STATUS')?.value.trim().toUpperCase()
    if (status === 'CANCELLED') continue

    const dtStartProp = getProp(bag, 'DTSTART')
    if (!dtStartProp) continue
    const startVal = parseIcalDate(dtStartProp.value, dtStartProp.params)
    if (!startVal) continue

    const uid = getProp(bag, 'UID')?.value.trim() || `ev_${Math.random().toString(36).slice(2, 10)}`
    const baseEvent = buildSingleEvent(bag, startVal, uid, getProp)
    if (!baseEvent) continue

    const durationMs = Math.max(
      startVal.isAllDay ? 86400000 : 1800000,
      new Date(baseEvent.endIso).getTime() - new Date(baseEvent.startIso).getTime()
    )

    const rruleProp = getProp(bag, 'RRULE')
    const exdateProps = getAllProps(bag, 'EXDATE')
    const exdateKeys = new Set<string>()
    for (const ex of exdateProps) {
      for (const part of ex.value.split(',')) {
        const parsedEx = parseIcalDate(part, ex.params)
        if (parsedEx) {
          exdateKeys.add(startVal.isAllDay ? toLocalDateKey(parsedEx.date) : String(parsedEx.date.getTime()))
        }
      }
    }

    if (rruleProp) {
      const occurrences = expandRRule(
        startVal.date,
        rruleProp.value,
        exdateKeys,
        windowStart,
        windowEnd,
        startVal.isAllDay
      )

      for (const occStart of occurrences) {
        const occKey = `${uid}__${startVal.isAllDay ? toLocalDateKey(occStart) : occStart.getTime()}`
        const override = overrides.get(occKey)
        if (override) {
          if (override.status !== 'CANCELLED' && !seenKeys.has(occKey)) {
            seenKeys.add(occKey)
            finalEvents.push(override)
          }
          continue
        }

        if (seenKeys.has(occKey)) continue
        seenKeys.add(occKey)

        const occEnd = new Date(occStart.getTime() + durationMs)
        finalEvents.push({
          ...baseEvent,
          id: occKey,
          startIso: startVal.isAllDay ? formatAllDayIso(occStart) : occStart.toISOString(),
          endIso: startVal.isAllDay ? formatAllDayIso(occEnd) : occEnd.toISOString(),
        })
      }
    } else {
      const key = `${uid}__${startVal.isAllDay ? toLocalDateKey(startVal.date) : startVal.date.getTime()}`
      if (!seenKeys.has(key)) {
        seenKeys.add(key)
        finalEvents.push({ ...baseEvent, id: key })
      }
    }
  }

  // Sort chronologically
  finalEvents.sort((a, b) => new Date(a.startIso).getTime() - new Date(b.startIso).getTime())

  return { calendarName, events: finalEvents, warnings }
}

function buildSingleEvent(
  bag: RawEventBag,
  startVal: ParsedDateValue,
  uid: string,
  getProp: (b: RawEventBag, n: string) => IcalProperty | undefined
): ParsedIcalEvent | null {
  const title = unescapeIcalText(getProp(bag, 'SUMMARY')?.value || '(Sin título)').trim() || '(Sin título)'
  const description = unescapeIcalText(getProp(bag, 'DESCRIPTION')?.value || '')
  const location = unescapeIcalText(getProp(bag, 'LOCATION')?.value || '')
  const url = getProp(bag, 'URL')?.value.trim()
  const organizer = getProp(bag, 'ORGANIZER')?.params?.CN || getProp(bag, 'ORGANIZER')?.value

  const dtEndProp = getProp(bag, 'DTEND')
  const durationProp = getProp(bag, 'DURATION')

  let endDate: Date
  if (dtEndProp) {
    const parsedEnd = parseIcalDate(dtEndProp.value, dtEndProp.params)
    endDate = parsedEnd ? parsedEnd.date : new Date(startVal.date.getTime() + (startVal.isAllDay ? 86400000 : 3600000))
  } else if (durationProp) {
    const ms = parseDurationMs(durationProp.value)
    endDate = new Date(startVal.date.getTime() + (ms > 0 ? ms : startVal.isAllDay ? 86400000 : 3600000))
  } else {
    endDate = new Date(startVal.date.getTime() + (startVal.isAllDay ? 86400000 : 3600000))
  }

  return {
    id: `${uid}__${startVal.date.getTime()}`,
    uid,
    title,
    startIso: startVal.isAllDay ? formatAllDayIso(startVal.date) : startVal.date.toISOString(),
    endIso: startVal.isAllDay ? formatAllDayIso(endDate) : endDate.toISOString(),
    isAllDay: startVal.isAllDay,
    description,
    location,
    url,
    organizer,
  }
}

/**
 * Parses My Widget's google_calendar_cache.json format into ParsedIcalEvent[]
 */
export function parseMyWidgetCacheJson(jsonText: string): ParsedIcalEvent[] {
  const parsed = JSON.parse(jsonText)
  const rawEvents = Array.isArray(parsed?.events) ? parsed.events : Array.isArray(parsed) ? parsed : []
  const out: ParsedIcalEvent[] = []
  for (const item of rawEvents) {
    if (!item || !item.start) continue
    const start = new Date(item.start)
    if (Number.isNaN(start.getTime())) continue
    const end = item.end ? new Date(item.end) : new Date(start.getTime() + (item.allDay ? 86400000 : 3600000))
    const isAllDay = Boolean(item.allDay)
    out.push({
      id: String(item.id || item.uid || Math.random().toString(36).slice(2)),
      uid: String(item.uid || item.id || ''),
      title: String(item.title || '(Sin título)'),
      startIso: isAllDay ? formatAllDayIso(start) : start.toISOString(),
      endIso: isAllDay ? formatAllDayIso(end) : end.toISOString(),
      isAllDay,
      description: String(item.description || ''),
      location: String(item.location || ''),
    })
  }
  return out
}
