/**
 * Fetches an iCalendar (.ics) feed across Tauri Desktop, Vite Dev/Preview,
 * and Vercel Production without CORS blocks.
 */

export async function fetchIcalFeed(rawUrl: string): Promise<string> {
  const trimmed = rawUrl.trim()
  if (!trimmed) {
    throw new Error('La URL iCal está vacía.')
  }

  let normalized = trimmed
  if (normalized.startsWith('webcal://')) {
    normalized = 'https://' + normalized.slice('webcal://'.length)
  }

  let parsed: URL
  try {
    parsed = new URL(normalized)
  } catch {
    throw new Error('URL iCal no válida.')
  }

  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    throw new Error('La URL iCal debe empezar por https:// o webcal://')
  }

  // 1. Tauri Desktop native fetch (bypasses browser CORS completely)
  const isTauri =
    typeof window !== 'undefined' &&
    Boolean((window as unknown as { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__)

  if (isTauri) {
    const { invoke } = await import('@tauri-apps/api/core')
    const text = await invoke<string>('fetch_ical_url', { url: parsed.toString() })
    if (!text || !text.includes('BEGIN:VCALENDAR')) {
      throw new Error('La respuesta no es un feed iCalendar válido (falta BEGIN:VCALENDAR).')
    }
    return text
  }

  // 2. Web (Vite dev proxy or Vercel serverless /api/ical-proxy)
  const proxyUrl = `/api/ical-proxy?url=${encodeURIComponent(parsed.toString())}`
  try {
    const res = await fetch(proxyUrl, {
      headers: { Accept: 'text/calendar, text/plain, */*' },
    })
    if (res.ok) {
      const text = await res.text()
      if (text.includes('BEGIN:VCALENDAR')) {
        return text
      }
    } else if (res.status >= 400 && res.status < 500) {
      const msg = await res.text().catch(() => '')
      throw new Error(msg || `Error HTTP ${res.status} al descargar el calendario.`)
    }
  } catch (err) {
    // If proxy endpoint is unavailable (e.g. GitHub Pages static build), fall through to direct fetch
    if (err instanceof Error && err.message.startsWith('Error HTTP')) {
      throw err
    }
  }

  // 3. Direct fetch fallback (works if server allows CORS)
  const direct = await fetch(parsed.toString())
  if (!direct.ok) {
    throw new Error(`HTTP ${direct.status} al descargar el calendario.`)
  }
  const text = await direct.text()
  if (!text.includes('BEGIN:VCALENDAR')) {
    throw new Error('La respuesta no contiene un calendario iCal válido.')
  }
  return text
}

export interface CalendarWebhookResponse {
  ok: boolean
  googleEventId?: string
  message?: string
  error?: string
}

export async function postCalendarWebhook(
  webhookUrl: string,
  payload: Record<string, unknown>
): Promise<CalendarWebhookResponse> {
  const trimmed = webhookUrl.trim()
  if (!trimmed.startsWith('https://')) {
    throw new Error('La URL del Google Apps Script debe empezar por https://')
  }

  const isTauri =
    typeof window !== 'undefined' &&
    Boolean((window as unknown as { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__)

  if (isTauri) {
    const { invoke } = await import('@tauri-apps/api/core')
    const raw = await invoke<string>('post_calendar_webhook', {
      url: trimmed,
      payload: JSON.stringify(payload),
    })
    return JSON.parse(raw) as CalendarWebhookResponse
  }

  const res = await fetch('/api/calendar-webhook', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ webhookUrl: trimmed, payload }),
  })
  const text = await res.text()
  try {
    return JSON.parse(text) as CalendarWebhookResponse
  } catch {
    if (!res.ok) {
      throw new Error(text || `HTTP ${res.status}`)
    }
    return { ok: true, message: text }
  }
}
