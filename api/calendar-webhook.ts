export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    res.status(405).json({ ok: false, error: 'Method Not Allowed' })
    return
  }

  const webhookUrl = typeof req.body?.webhookUrl === 'string' ? req.body.webhookUrl.trim() : ''
  if (!webhookUrl.startsWith('https://script.google.com/')) {
    res.status(400).json({ ok: false, error: 'La URL debe ser de Google Apps Script (https://script.google.com/...)' })
    return
  }

  try {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 15000)
    const upstream = await fetch(webhookUrl, {
      method: 'POST',
      signal: controller.signal,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req.body?.payload ?? {}),
      redirect: 'follow',
    })
    clearTimeout(timer)

    const text = await upstream.text()
    res.setHeader('Content-Type', 'application/json; charset=utf-8')
    res.status(upstream.status).send(text)
  } catch (err: any) {
    res.status(502).json({ ok: false, error: err?.message || 'Error al conectar con Google Apps Script' })
  }
}
