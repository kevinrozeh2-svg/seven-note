import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'
import { lookup } from 'node:dns/promises'
import net from 'node:net'

function isPrivateIp(ip: string): boolean {
  const cleaned = ip.trim().toLowerCase()
  const v = net.isIP(cleaned)
  if (v === 4) {
    const [a, b] = cleaned.split('.').map(Number)
    return (
      a === 0 ||
      a === 10 ||
      a === 127 ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      (a === 100 && b >= 64 && b <= 127) ||
      a >= 224
    )
  }
  if (v === 6) {
    if (cleaned === '::' || cleaned === '::1') return true
    if (cleaned.startsWith('fc') || cleaned.startsWith('fd') || /^fe[89ab]/.test(cleaned) || cleaned.startsWith('ff')) return true
    const m = cleaned.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/)
    if (m) return isPrivateIp(m[1])
    return false
  }
  return true
}

async function assertSafeDevHttpsUrl(rawUrl: string): Promise<URL> {
  const parsed = new URL(rawUrl)
  if (parsed.protocol !== 'https:' || parsed.username || parsed.password || (parsed.port && parsed.port !== '443')) {
    throw new Error('Blocked URL')
  }
  const host = parsed.hostname.toLowerCase().replace(/^\[|\]$/g, '')
  if (!host || host === 'localhost' || host.endsWith('.local') || host.endsWith('.internal')) {
    throw new Error('Blocked host')
  }
  if (net.isIP(host)) {
    if (isPrivateIp(host)) throw new Error('Blocked IP')
    return parsed
  }
  const addrs = await lookup(host, { all: true })
  if (!addrs.length || addrs.some((a) => isPrivateIp(a.address))) {
    throw new Error('Blocked resolved IP')
  }
  return parsed
}

function icalProxyPlugin(): Plugin {
  return {
    name: 'seven-note-ical-proxy',
    configureServer(server) {
      server.middlewares.use('/api/ical-proxy', async (req, res) => {
        res.setHeader('X-Content-Type-Options', 'nosniff')
        res.setHeader('Cache-Control', 'no-store')
        if (req.method && req.method !== 'GET') {
          res.statusCode = 405
          res.end('Method Not Allowed')
          return
        }
        try {
          const reqUrl = new URL(req.url || '', 'http://localhost')
          const target = reqUrl.searchParams.get('url')?.trim() || ''
          if (!target || target.length > 2048) {
            res.statusCode = 400
            res.end('Missing or invalid url parameter')
            return
          }
          let currentUrl = await assertSafeDevHttpsUrl(target)
          let upstream: Response | null = null
          for (let hop = 0; hop <= 3; hop++) {
            const response = await fetch(currentUrl.toString(), {
              redirect: 'manual',
              headers: { 'User-Agent': 'SevenNote-Calendar/1.0', Accept: 'text/calendar, text/plain' }
            })
            if (response.status >= 300 && response.status < 400) {
              const loc = response.headers.get('location')
              if (!loc || hop === 3) {
                res.statusCode = 502
                res.end('Too many redirects')
                return
              }
              currentUrl = await assertSafeDevHttpsUrl(new URL(loc, currentUrl).toString())
              continue
            }
            upstream = response
            break
          }
          if (!upstream) {
            res.statusCode = 502
            res.end('Proxy fetch failed')
            return
          }
          const body = await upstream.text()
          if (Buffer.byteLength(body, 'utf8') > 5 * 1024 * 1024) {
            res.statusCode = 413
            res.end('Response too large')
            return
          }
          if (upstream.ok && !body.includes('BEGIN:VCALENDAR')) {
            res.statusCode = 422
            res.end('Invalid iCalendar response')
            return
          }
          res.statusCode = upstream.status
          res.setHeader('Content-Type', 'text/calendar; charset=utf-8')
          res.end(body)
        } catch {
          res.statusCode = 403
          res.end('Host not allowed or proxy fetch failed')
        }
      })

      server.middlewares.use('/api/calendar-webhook', async (req, res) => {
        res.setHeader('X-Content-Type-Options', 'nosniff')
        res.setHeader('Cache-Control', 'no-store')
        if (req.method !== 'POST') {
          res.statusCode = 405
          res.end('Method Not Allowed')
          return
        }
        try {
          const chunks: Buffer[] = []
          let totalBytes = 0
          for await (const chunk of req) {
            const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)
            totalBytes += buf.byteLength
            if (totalBytes > 256 * 1024) {
              res.statusCode = 413
              res.end(JSON.stringify({ ok: false, error: 'Payload too large' }))
              return
            }
            chunks.push(buf)
          }
          const rawBody = JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}') as {
            webhookUrl?: string
            payload?: unknown
          }
          const webhookUrl = String(rawBody.webhookUrl || '').trim()
          const parsed = new URL(webhookUrl)
          if (
            parsed.protocol !== 'https:' ||
            parsed.hostname.toLowerCase() !== 'script.google.com' ||
            !parsed.pathname.startsWith('/macros/') ||
            parsed.username ||
            parsed.password
          ) {
            res.statusCode = 400
            res.end(JSON.stringify({ ok: false, error: 'Invalid Google Apps Script webhookUrl' }))
            return
          }
          const allowedRedirectHosts = new Set(['script.google.com', 'script.googleusercontent.com'])
          let currentUrl = parsed
          let method: 'POST' | 'GET' = 'POST'
          let body: string | undefined = JSON.stringify(rawBody.payload ?? {})
          let upstream: Response | null = null
          for (let hop = 0; hop <= 3; hop++) {
            const response = await fetch(currentUrl.toString(), {
              method,
              headers: method === 'POST' ? { 'Content-Type': 'application/json' } : undefined,
              body,
              redirect: 'manual'
            })
            if (response.status >= 300 && response.status < 400) {
              const loc = response.headers.get('location')
              if (!loc || hop === 3) {
                res.statusCode = 502
                res.end(JSON.stringify({ ok: false, error: 'Too many redirects' }))
                return
              }
              const next = new URL(loc, currentUrl)
              if (next.protocol !== 'https:' || !allowedRedirectHosts.has(next.hostname.toLowerCase())) {
                res.statusCode = 403
                res.end(JSON.stringify({ ok: false, error: 'Blocked redirect host' }))
                return
              }
              currentUrl = next
              if (response.status === 301 || response.status === 302 || response.status === 303) {
                method = 'GET'
                body = undefined
              }
              continue
            }
            upstream = response
            break
          }
          if (!upstream) {
            res.statusCode = 502
            res.end(JSON.stringify({ ok: false, error: 'Webhook failed' }))
            return
          }
          const text = await upstream.text()
          res.statusCode = upstream.status
          res.setHeader('Content-Type', 'application/json; charset=utf-8')
          res.end(text)
        } catch {
          res.statusCode = 502
          res.end(JSON.stringify({ ok: false, error: 'Webhook failed' }))
        }
      })
    }
  }
}

export default defineConfig({
  base: process.env.GITHUB_PAGES === 'true' ? '/seven-note/' : '/',
  plugins: [
    icalProxyPlugin(),
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'prompt',
      devOptions: {
        enabled: false
      },
      includeAssets: [
        'favicon.svg',
        'apple-touch-icon.png',
        'icons.svg',
        'noise.avif',
        'pwa-192x192.png',
        'pwa-512x512.png',
        'sw-push.js'
      ],
      manifest: {
        name: 'Seven Note - Offline Notion & Milanote Hybrid',
        short_name: 'Seven Note',
        description: 'Lightweight offline-first visual notes & infinite canvas',
        theme_color: '#0f172a',
        background_color: '#0f172a',
        display: 'standalone',
        start_url: '/',
        orientation: 'any',
        icons: [
          {
            src: '/pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any maskable'
          },
          {
            src: '/pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable'
          }
        ]
      },
      workbox: {
        importScripts: ['sw-push.js'],
        cleanupOutdatedCaches: true,
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2,avif,webp}'],
        maximumFileSizeToCacheInBytes: 6 * 1024 * 1024,
        runtimeCaching: [
          {
            // Apple Emoji CDN - Cache-First so loaded emojis stay available offline
            urlPattern: /^https:\/\/cdn\.jsdelivr\.net\/npm\/emoji-datasource-apple@.+/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'apple-emojis-cache',
              expiration: {
                maxEntries: 3000,
                maxAgeSeconds: 365 * 24 * 60 * 60 // 1 year
              },
              cacheableResponse: {
                statuses: [0, 200]
              }
            }
          },
          {
            // Google Fonts Stylesheets - Stale-While-Revalidate
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'google-fonts-stylesheets',
              cacheableResponse: {
                statuses: [0, 200]
              }
            }
          },
          {
            // Google Fonts Webfont files (.woff2) - Cache-First
            urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-webfonts',
              expiration: {
                maxEntries: 120,
                maxAgeSeconds: 365 * 24 * 60 * 60 // 1 year
              },
              cacheableResponse: {
                statuses: [0, 200]
              }
            }
          },
          {
            // Unsplash Images (Used in Templates & Moodboards) - Cache-First
            urlPattern: /^https:\/\/images\.unsplash\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'unsplash-images-cache',
              expiration: {
                maxEntries: 100,
                maxAgeSeconds: 30 * 24 * 60 * 60 // 30 days
              },
              cacheableResponse: {
                statuses: [0, 200]
              }
            }
          }
        ]
      }
    })
  ],
  build: {
    chunkSizeWarningLimit: 1200,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('@xyflow')) {
              return 'vendor-xyflow'
            }
            if (id.includes('@tiptap') || id.includes('prosemirror') || id.includes('lowlight')) {
              return 'vendor-editor'
            }
            if (id.includes('@phosphor-icons') || id.includes('lucide-react')) {
              return 'vendor-icons'
            }
            if (id.includes('@supabase')) {
              return 'vendor-supabase'
            }
            if (id.includes('dexie')) {
              return 'vendor-dexie'
            }
          }
        }
      }
    }
  }
})
