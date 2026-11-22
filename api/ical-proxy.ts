import { lookup } from 'node:dns/promises'
import net from 'node:net'

const MAX_REDIRECTS = 3
const MAX_RESPONSE_BYTES = 5 * 1024 * 1024 // 5 MB
const FETCH_TIMEOUT_MS = 12000

const BLOCKED_HOSTNAMES = new Set([
  'localhost',
  'localhost.localdomain',
  'metadata.google.internal',
  'metadata',
])

function isPrivateOrReservedIPv4(ip: string): boolean {
  const parts = ip.split('.').map(Number)
  if (parts.length !== 4 || parts.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) {
    return true
  }
  const [a, b] = parts
  if (a === 0) return true // 0.0.0.0/8
  if (a === 10) return true // 10.0.0.0/8
  if (a === 127) return true // 127.0.0.0/8 loopback
  if (a === 169 && b === 254) return true // 169.254.0.0/16 link-local & cloud metadata
  if (a === 172 && b >= 16 && b <= 31) return true // 172.16.0.0/12
  if (a === 192 && b === 168) return true // 192.168.0.0/16
  if (a === 100 && b >= 64 && b <= 127) return true // 100.64.0.0/10 CGNAT
  if (a === 192 && b === 0) return true // 192.0.0.0/24 & 192.0.2.0/24
  if (a === 198 && (b === 18 || b === 19)) return true // 198.18.0.0/15 benchmark
  if (a >= 224) return true // Multicast & reserved
  return false
}

function isPrivateOrReservedIp(ip: string): boolean {
  const cleaned = ip.trim().toLowerCase()
  const version = net.isIP(cleaned)
  if (version === 4) {
    return isPrivateOrReservedIPv4(cleaned)
  }
  if (version === 6) {
    if (cleaned === '::' || cleaned === '::1') return true
    if (cleaned.startsWith('fc') || cleaned.startsWith('fd')) return true // Unique local fc00::/7
    if (/^fe[89ab]/.test(cleaned)) return true // Link-local fe80::/10
    if (cleaned.startsWith('ff')) return true // Multicast ff00::/8
    // IPv4-mapped IPv6 addresses (e.g. ::ffff:127.0.0.1)
    const v4Mapped = cleaned.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/)
    if (v4Mapped) {
      return isPrivateOrReservedIPv4(v4Mapped[1])
    }
    return false
  }
  return true
}

async function assertSafePublicHttpsUrl(rawUrl: string): Promise<URL> {
  let parsed: URL
  try {
    parsed = new URL(rawUrl)
  } catch {
    throw new Error('URL_INVALID')
  }

  if (parsed.protocol !== 'https:') {
    throw new Error('PROTOCOL_NOT_ALLOWED')
  }
  if (parsed.username || parsed.password) {
    throw new Error('CREDENTIALS_NOT_ALLOWED')
  }
  if (parsed.port && parsed.port !== '443') {
    throw new Error('PORT_NOT_ALLOWED')
  }

  const host = parsed.hostname.toLowerCase().replace(/^\[|\]$/g, '')
  if (
    !host ||
    BLOCKED_HOSTNAMES.has(host) ||
    host.endsWith('.local') ||
    host.endsWith('.internal') ||
    host.endsWith('.localhost')
  ) {
    throw new Error('HOST_NOT_ALLOWED')
  }

  if (net.isIP(host)) {
    if (isPrivateOrReservedIp(host)) {
      throw new Error('HOST_NOT_ALLOWED')
    }
    return parsed
  }

  let addresses: { address: string }[]
  try {
    addresses = await lookup(host, { all: true })
  } catch {
    throw new Error('DNS_LOOKUP_FAILED')
  }

  if (!addresses || addresses.length === 0) {
    throw new Error('DNS_LOOKUP_FAILED')
  }

  for (const entry of addresses) {
    if (isPrivateOrReservedIp(entry.address)) {
      throw new Error('HOST_NOT_ALLOWED')
    }
  }

  return parsed
}

async function readLimitedText(response: Response, maxBytes: number): Promise<string> {
  const contentLength = Number(response.headers.get('content-length') || '0')
  if (Number.isFinite(contentLength) && contentLength > maxBytes) {
    throw new Error('RESPONSE_TOO_LARGE')
  }

  if (!response.body) {
    const text = await response.text()
    if (Buffer.byteLength(text, 'utf8') > maxBytes) {
      throw new Error('RESPONSE_TOO_LARGE')
    }
    return text
  }

  const reader = response.body.getReader()
  const chunks: Uint8Array[] = []
  let total = 0

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    if (value) {
      total += value.byteLength
      if (total > maxBytes) {
        await reader.cancel().catch(() => {})
        throw new Error('RESPONSE_TOO_LARGE')
      }
      chunks.push(value)
    }
  }

  return Buffer.concat(chunks.map((c) => Buffer.from(c))).toString('utf8')
}

export default async function handler(req: any, res: any) {
  res.setHeader('X-Content-Type-Options', 'nosniff')
  res.setHeader('Cache-Control', 'no-store')

  if (req.method && req.method !== 'GET') {
    res.status(405).send('Método no permitido.')
    return
  }

  const rawUrl = typeof req.query?.url === 'string' ? req.query.url.trim() : ''
  if (!rawUrl || rawUrl.length > 2048) {
    res.status(400).send('Falta el parámetro url o es demasiado largo.')
    return
  }

  let currentUrl: URL
  try {
    currentUrl = await assertSafePublicHttpsUrl(rawUrl)
  } catch (err: any) {
    const code = err?.message
    if (code === 'HOST_NOT_ALLOWED' || code === 'PORT_NOT_ALLOWED' || code === 'CREDENTIALS_NOT_ALLOWED') {
      res.status(403).send('Host o puerto no permitido.')
      return
    }
    if (code === 'PROTOCOL_NOT_ALLOWED') {
      res.status(400).send('Solo se permiten URLs HTTPS.')
      return
    }
    res.status(400).send('URL no válida.')
    return
  }

  try {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)

    let upstream: Response | null = null
    try {
      for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
        const response = await fetch(currentUrl.toString(), {
          signal: controller.signal,
          redirect: 'manual',
          headers: {
            'User-Agent': 'SevenNote-Calendar/1.0',
            Accept: 'text/calendar, text/plain',
          },
        })

        if (response.status >= 300 && response.status < 400) {
          const location = response.headers.get('location')
          if (!location || hop === MAX_REDIRECTS) {
            res.status(502).send('Demasiadas redirecciones al descargar el calendario.')
            return
          }
          const nextUrl = new URL(location, currentUrl).toString()
          currentUrl = await assertSafePublicHttpsUrl(nextUrl)
          continue
        }

        upstream = response
        break
      }
    } finally {
      clearTimeout(timer)
    }

    if (!upstream) {
      res.status(502).send('No se pudo descargar el feed iCal.')
      return
    }

    if (!upstream.ok) {
      res.status(upstream.status).send(`Error HTTP ${upstream.status} desde el servidor de calendario.`)
      return
    }

    const text = await readLimitedText(upstream, MAX_RESPONSE_BYTES)
    if (!text.includes('BEGIN:VCALENDAR')) {
      res.status(422).send('La respuesta remota no es un calendario iCalendar válido.')
      return
    }

    res.setHeader('Content-Type', 'text/calendar; charset=utf-8')
    res.status(200).send(text)
  } catch (err: any) {
    if (err?.message === 'RESPONSE_TOO_LARGE') {
      res.status(413).send('El feed iCal excede el tamaño máximo permitido (5 MB).')
      return
    }
    if (err?.message === 'HOST_NOT_ALLOWED') {
      res.status(403).send('Redirección hacia host no permitido.')
      return
    }
    res.status(502).send('No se pudo descargar el feed iCal.')
  }
}
