import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

function icalProxyPlugin(): Plugin {
  return {
    name: 'seven-note-ical-proxy',
    configureServer(server) {
      server.middlewares.use('/api/ical-proxy', async (req, res) => {
        try {
          const reqUrl = new URL(req.url || '', 'http://localhost')
          const target = reqUrl.searchParams.get('url')
          if (!target) {
            res.statusCode = 400
            res.end('Missing url parameter')
            return
          }
          const parsed = new URL(target)
          if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
            res.statusCode = 400
            res.end('Invalid protocol')
            return
          }
          const upstream = await fetch(parsed.toString(), {
            headers: { 'User-Agent': 'SevenNote-Calendar/1.0' }
          })
          res.statusCode = upstream.status
          res.setHeader('Content-Type', 'text/calendar; charset=utf-8')
          res.setHeader('Cache-Control', 'no-store')
          const body = await upstream.text()
          res.end(body)
        } catch (err: unknown) {
          res.statusCode = 502
          res.end(err instanceof Error ? err.message : 'Proxy fetch failed')
        }
      })

      server.middlewares.use('/api/calendar-webhook', async (req, res) => {
        if (req.method !== 'POST') {
          res.statusCode = 405
          res.end('Method Not Allowed')
          return
        }
        try {
          const chunks: Buffer[] = []
          for await (const chunk of req) {
            chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
          }
          const rawBody = JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}') as {
            webhookUrl?: string
            payload?: unknown
          }
          const webhookUrl = String(rawBody.webhookUrl || '').trim()
          if (!webhookUrl.startsWith('https://')) {
            res.statusCode = 400
            res.end('Invalid webhookUrl')
            return
          }
          const upstream = await fetch(webhookUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(rawBody.payload ?? {}),
            redirect: 'follow'
          })
          const text = await upstream.text()
          res.statusCode = upstream.status
          res.setHeader('Content-Type', 'application/json; charset=utf-8')
          res.end(text)
        } catch (err: unknown) {
          res.statusCode = 502
          res.end(JSON.stringify({ ok: false, error: err instanceof Error ? err.message : 'Webhook failed' }))
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
