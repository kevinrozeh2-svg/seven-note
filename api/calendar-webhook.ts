const ALLOWED_WEBHOOK_HOST = 'script.google.com'
const ALLOWED_REDIRECT_HOSTS = new Set(['script.google.com', 'script.googleusercontent.com'])
const MAX_REDIRECTS = 3
const MAX_PAYLOAD_BYTES = 256 * 1024 // 256 KB
const MAX_RESPONSE_BYTES = 1024 * 1024 // 1 MB
const FETCH_TIMEOUT_MS = 15000

function parseAllowedWebhookUrl(rawUrl: string, allowRedirectHosts = false): URL {
  let parsed: URL
  try {
    parsed = new URL(rawUrl)
  } catch {
    throw new Error('INVALID_URL')
  }

  if (parsed.protocol !== 'https:') {
    throw new Error('INVALID_URL')
  }
  if (parsed.username || parsed.password) {
    throw new Error('INVALID_URL')
  }
  if (parsed.port && parsed.port !== '443') {
    throw new Error('INVALID_URL')
  }

  const host = parsed.hostname.toLowerCase()
  if (allowRedirectHosts) {
    if (!ALLOWED_REDIRECT_HOSTS.has(host)) {
      throw new Error('HOST_NOT_ALLOWED')
    }
  } else {
    if (host !== ALLOWED_WEBHOOK_HOST || !parsed.pathname.startsWith('/macros/')) {
      throw new Error('HOST_NOT_ALLOWED')
    }
  }

  return parsed
}

export default async function handler(req: any, res: any) {
  res.setHeader('X-Content-Type-Options', 'nosniff')
  res.setHeader('Cache-Control', 'no-store')

  if (req.method !== 'POST') {
    res.status(405).json({ ok: false, error: 'Method Not Allowed' })
    return
  }

  const webhookUrl = typeof req.body?.webhookUrl === 'string' ? req.body.webhookUrl.trim() : ''
  let currentUrl: URL
  try {
    currentUrl = parseAllowedWebhookUrl(webhookUrl, false)
  } catch {
    res.status(400).json({
      ok: false,
      error: 'La URL debe ser un endpoint válido de Google Apps Script (https://script.google.com/macros/...)',
    })
    return
  }

  const serializedPayload = JSON.stringify(req.body?.payload ?? {})
  if (Buffer.byteLength(serializedPayload, 'utf8') > MAX_PAYLOAD_BYTES) {
    res.status(413).json({ ok: false, error: 'El payload excede el tamaño máximo permitido.' })
    return
  }

  try {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)

    let upstream: Response | null = null
    let method: 'POST' | 'GET' = 'POST'
    let body: string | undefined = serializedPayload

    try {
      for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
        const response = await fetch(currentUrl.toString(), {
          method,
          signal: controller.signal,
          headers: method === 'POST' ? { 'Content-Type': 'application/json' } : undefined,
          body,
          redirect: 'manual',
        })

        if (response.status >= 300 && response.status < 400) {
          const location = response.headers.get('location')
          if (!location || hop === MAX_REDIRECTS) {
            res.status(502).json({ ok: false, error: 'Demasiadas redirecciones en Google Apps Script.' })
            return
          }
          const nextUrl = new URL(location, currentUrl).toString()
          currentUrl = parseAllowedWebhookUrl(nextUrl, true)
          // Google Apps Script responds with 302 to script.googleusercontent.com expecting a GET
          if (response.status === 301 || response.status === 302 || response.status === 303) {
            method = 'GET'
            body = undefined
          }
          continue
        }

        upstream = response
        break
      }
    } finally {
      clearTimeout(timer)
    }

    if (!upstream) {
      res.status(502).json({ ok: false, error: 'Error al conectar con Google Apps Script.' })
      return
    }

    const text = await upstream.text()
    if (Buffer.byteLength(text, 'utf8') > MAX_RESPONSE_BYTES) {
      res.status(502).json({ ok: false, error: 'Respuesta del webhook demasiado grande.' })
      return
    }

    res.setHeader('Content-Type', 'application/json; charset=utf-8')
    res.status(upstream.status).send(text)
  } catch (err: any) {
    if (err?.message === 'HOST_NOT_ALLOWED') {
      res.status(403).json({ ok: false, error: 'Redirección hacia host no permitido.' })
      return
    }
    res.status(502).json({ ok: false, error: 'Error al conectar con Google Apps Script.' })
  }
}
