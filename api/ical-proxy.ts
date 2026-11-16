const BLOCKED_HOSTS = new Set(['localhost', '127.0.0.1', '0.0.0.0', '::1'])

export default async function handler(req: any, res: any) {
  const rawUrl = typeof req.query?.url === 'string' ? req.query.url : ''
  if (!rawUrl) {
    res.status(400).send('Falta el parámetro url.')
    return
  }

  let parsed: URL
  try {
    parsed = new URL(rawUrl)
  } catch {
    res.status(400).send('URL no válida.')
    return
  }

  if (parsed.protocol !== 'https:') {
    res.status(400).send('Solo se permiten URLs HTTPS.')
    return
  }

  const host = parsed.hostname.toLowerCase()
  if (
    BLOCKED_HOSTS.has(host) ||
    host.endsWith('.local') ||
    host.startsWith('10.') ||
    host.startsWith('192.168.') ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(host)
  ) {
    res.status(403).send('Host no permitido.')
    return
  }

  try {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 12000)
    const upstream = await fetch(parsed.toString(), {
      signal: controller.signal,
      headers: {
        'User-Agent': 'SevenNote-Calendar/1.0',
        Accept: 'text/calendar, text/plain, */*',
      },
    })
    clearTimeout(timer)

    if (!upstream.ok) {
      res.status(upstream.status).send(`Error HTTP ${upstream.status} desde Google Calendar.`)
      return
    }

    const text = await upstream.text()
    res.setHeader('Content-Type', 'text/calendar; charset=utf-8')
    res.setHeader('Cache-Control', 'no-store')
    res.status(200).send(text)
  } catch (err: any) {
    res.status(502).send(err?.message || 'No se pudo descargar el feed iCal.')
  }
}
