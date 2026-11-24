import { useState, useEffect } from 'react'
import {
  CloseIcon,
  CloudWorkspaceIcon,
  DatabaseTableViewIcon,
  DownloadIcon,
  UploadIcon,
  DoneIcon,
  InformationIcon,
  CopyIcon,
  ResetIcon,
  SettingsIcon
} from '@blocksuite/icons/rc'
import { Check, Eye, EyeSlash, PlugsConnected, Robot, ShieldCheck } from '@phosphor-icons/react'
import {
  getStoredSupabaseConfig,
  saveSupabaseConfig,
  testSupabaseConnection
} from '../../lib/supabase'
import { syncEngine, type SyncEngineStatus } from '../../lib/syncEngine'
import { db, markAccountSeeded, normalizeFolderPath } from '../../db'
import schemaSql from '../../supabase_schema.sql?raw'
import { toast } from 'sonner'
import { isTauri, checkForAppUpdates } from '../../lib/tauriUpdater'
import { checkForWebUpdates } from '../../lib/pwaUpdater'
import { notificationService, type NotificationPreferences } from '../../lib/notificationService'
import {
  getWebPushStatus,
  subscribeToWebPush,
  unsubscribeFromWebPush,
  saveVapidPublicKey,
  type WebPushStatus
} from '../../lib/webPush'

interface SettingsModalProps {
  isOpen: boolean
  onClose: () => void
  syncStatus: SyncEngineStatus
  uiScale?: string
  onUiScaleChange?: (scale: string) => void
}

export function SettingsModal({ isOpen, onClose, syncStatus, uiScale = '100', onUiScaleChange }: SettingsModalProps) {
  const [url, setUrl] = useState('')
  const [anonKey, setAnonKey] = useState('')
  const [enabled, setEnabled] = useState(false)
  const [syncInterval, setSyncInterval] = useState(syncEngine.getSyncInterval())
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null)
  const [copiedSql, setCopiedSql] = useState(false)
  const [manualSyncing, setManualSyncing] = useState(false)
  const [installPrompt, setInstallPrompt] = useState<any>(null)
  const [isStandalone, setIsStandalone] = useState(false)
  const [notifPrefs, setNotifPrefs] = useState<NotificationPreferences>(() =>
    notificationService.getPreferences()
  )
  const [desktopPerm, setDesktopPerm] = useState<NotificationPermission | 'unsupported'>(() =>
    notificationService.getDesktopPermission()
  )
  const [webPushStatus, setWebPushStatus] = useState<WebPushStatus | null>(null)
  const [vapidInput, setVapidInput] = useState('')
  const [pushLoading, setPushLoading] = useState(false)

  // MCP (AI Brain) section state
  const defaultMcpUrl =
    typeof window !== 'undefined' &&
    window.location.origin.startsWith('http') &&
    !window.location.hostname.includes('localhost') &&
    !window.location.hostname.includes('127.0.0.1')
      ? `${window.location.origin}/api/mcp`
      : 'https://note.sevenestudio.com/api/mcp'
  const [mcpUrl, setMcpUrl] = useState<string>(() => {
    try {
      return localStorage.getItem('seven_note_mcp_url') || defaultMcpUrl
    } catch {
      return defaultMcpUrl
    }
  })
  const [mcpApiKey, setMcpApiKey] = useState<string>(() => {
    try {
      return localStorage.getItem('seven_note_mcp_api_key') || ''
    } catch {
      return ''
    }
  })
  const [showMcpKey, setShowMcpKey] = useState(false)
  const [mcpTesting, setMcpTesting] = useState(false)
  const [mcpStatus, setMcpStatus] = useState<{
    ok: boolean
    message: string
    toolsCount?: number
    spacesCount?: number
    adminSpacesCount?: number
  } | null>(null)
  const [copiedMcpItem, setCopiedMcpItem] = useState<'url' | 'json' | 'header' | null>(null)

  useEffect(() => {
    return notificationService.subscribeToPreferences(setNotifPrefs)
  }, [])

  useEffect(() => {
    if (isOpen) {
      void getWebPushStatus().then((st) => {
        setWebPushStatus(st)
        setVapidInput(st.vapidKey)
      })
    }
  }, [isOpen])

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const isApp = window.matchMedia('(display-mode: standalone)').matches || (navigator as any).standalone
      setIsStandalone(Boolean(isApp))

      const handleBeforeInstall = (e: Event) => {
        e.preventDefault()
        setInstallPrompt(e)
      }
      window.addEventListener('beforeinstallprompt', handleBeforeInstall)
      return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstall)
    }
  }, [])

  const handleInstallApp = async () => {
    if (installPrompt) {
      installPrompt.prompt()
      const { outcome } = await installPrompt.userChoice
      if (outcome === 'accepted') {
        setInstallPrompt(null)
        setIsStandalone(true)
        toast.success('¡Seven Note instalada con éxito!')
      }
    } else {
      toast.info('Para instalar, pulsa el botón de instalación (📥) en la barra de tu navegador o "Añadir a pantalla de inicio" en móviles.')
    }
  }

  useEffect(() => {
    if (isOpen) {
      const config = getStoredSupabaseConfig()
      setUrl(config.url)
      setAnonKey(config.anonKey)
      setEnabled(config.enabled)
      setSyncInterval(syncEngine.getSyncInterval())
      setTestResult(null)
    }
  }, [isOpen])

  if (!isOpen) return null

  const handleSave = () => {
    saveSupabaseConfig({ url, anonKey, enabled })
    syncEngine.setSyncInterval(syncInterval)
    syncEngine.scheduleSync(500)
    setTestResult({ success: true, message: 'Configuración guardada correctamente' })
  }

  const handleTest = async () => {
    setTesting(true)
    setTestResult(null)
    const res = await testSupabaseConnection(url, anonKey)
    setTesting(false)
    setTestResult(res)
  }

  const handleManualSync = async () => {
    setManualSyncing(true)
    await syncEngine.triggerSync()
    setManualSyncing(false)
  }

  const copySqlSchema = async () => {
    await navigator.clipboard.writeText(schemaSql)
    setCopiedSql(true)
    setTimeout(() => setCopiedSql(false), 2000)
  }

  const handleMcpUrlChange = (val: string) => {
    setMcpUrl(val)
    try {
      localStorage.setItem('seven_note_mcp_url', val)
    } catch {
      // ignore storage errors
    }
  }

  const handleMcpKeyChange = (val: string) => {
    setMcpApiKey(val)
    try {
      localStorage.setItem('seven_note_mcp_api_key', val)
    } catch {
      // ignore storage errors
    }
  }

  const copyMcpSnippet = async (kind: 'url' | 'json' | 'header') => {
    const cleanUrl = mcpUrl.trim() || defaultMcpUrl
    const token = mcpApiKey.trim() || 'TU_SEVEN_NOTE_MCP_API_KEY'
    let text = cleanUrl
    if (kind === 'header') {
      text = `Authorization: Bearer ${token}`
    } else if (kind === 'json') {
      text = JSON.stringify(
        {
          mcpServers: {
            'seven-note': {
              url: cleanUrl,
              headers: {
                Authorization: `Bearer ${token}`
              }
            }
          }
        },
        null,
        2
      )
    }
    await navigator.clipboard.writeText(text)
    setCopiedMcpItem(kind)
    toast.success(
      kind === 'url'
        ? 'URL del MCP copiada'
        : kind === 'header'
        ? 'Header de autenticación copiado'
        : 'Configuración JSON de MCP copiada'
    )
    setTimeout(() => setCopiedMcpItem(null), 2000)
  }

  const handleTestMcp = async () => {
    const cleanUrl = mcpUrl.trim() || defaultMcpUrl
    setMcpTesting(true)
    setMcpStatus(null)
    try {
      const healthRes = await fetch(cleanUrl, { method: 'GET' })
      if (!healthRes.ok) {
        setMcpStatus({
          ok: false,
          message: `El servidor respondió HTTP ${healthRes.status}. Verifica la URL y el despliegue en Vercel.`
        })
        return
      }
      const healthJson = await healthRes.json().catch(() => null)
      const version = healthJson?.version || '1.0.0'

      if (!mcpApiKey.trim()) {
        setMcpStatus({
          ok: true,
          message: `Servidor MCP activo (v${version}). Pega tu token para verificar autenticación, herramientas y espacios.`
        })
        return
      }

      const headers = {
        Authorization: `Bearer ${mcpApiKey.trim()}`,
        'Content-Type': 'application/json',
        Accept: 'application/json, text/event-stream'
      }

      const [toolsRes, spacesRes] = await Promise.all([
        fetch(cleanUrl, {
          method: 'POST',
          headers,
          body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list', params: {} })
        }),
        fetch(cleanUrl, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            jsonrpc: '2.0',
            id: 2,
            method: 'tools/call',
            params: { name: 'list_spaces', arguments: {} }
          })
        })
      ])

      if (toolsRes.status === 401 || spacesRes.status === 401) {
        setMcpStatus({
          ok: false,
          message: 'Token MCP inválido (401 Unauthorized). Verifica tu SEVEN_NOTE_MCP_API_KEY.'
        })
        return
      }

      const toolsJson = await toolsRes.json()
      const spacesJson = await spacesRes.json()
      const toolsCount = Array.isArray(toolsJson?.result?.tools) ? toolsJson.result.tools.length : 0

      let spacesCount = 0
      let adminSpacesCount = 0
      const rawSpacesText = spacesJson?.result?.content?.[0]?.text
      if (typeof rawSpacesText === 'string') {
        try {
          const parsed = JSON.parse(rawSpacesText)
          if (Array.isArray(parsed?.spaces)) {
            spacesCount = parsed.spaces.length
            adminSpacesCount = parsed.spaces.filter((s: any) => s?.admin_only).length
          }
        } catch {
          // ignore parse errors
        }
      }

      setMcpStatus({
        ok: true,
        toolsCount,
        spacesCount,
        adminSpacesCount,
        message: `MCP conectado (v${version}) · ${toolsCount} herramientas · ${spacesCount} espacios visibles (${adminSpacesCount} solo admin).`
      })
    } catch (err: any) {
      setMcpStatus({
        ok: false,
        message: `No se pudo conectar con el servidor MCP: ${err?.message || 'Error de red'}`
      })
    } finally {
      setMcpTesting(false)
    }
  }

  const exportBackupJson = async () => {
    const spaces = await db.spaces.toArray()
    const workspaces = await db.workspaces.toArray()
    const nodes = await db.canvasNodes.toArray()
    const edges = await db.canvasEdges.toArray()
    const collections = await db.collections.toArray()
    const tags = await db.tags.toArray()

    const backup = {
      version: 3,
      appName: 'Seven Note',
      exportedAt: new Date().toISOString(),
      spaces,
      workspaces,
      nodes,
      edges,
      collections,
      tags
    }

    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `seven-note-backup-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  const importBackupJson = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = async () => {
      try {
        const parsed = JSON.parse(reader.result as string)
        if (!parsed.workspaces || !parsed.nodes) {
          alert('El archivo no parece una copia de seguridad válida de Seven Note.')
          return
        }

        if (confirm(`Se importarán ${parsed.workspaces.length} páginas y ${parsed.nodes.length} tarjetas. ¿Continuar?`)) {
          const markPending = <T extends Record<string, any>>(rows: T[]) =>
            rows.map((r) => ({ ...r, syncStatus: 'pending' as const }))
          if (parsed.spaces && parsed.spaces.length > 0) {
            await db.spaces.bulkPut(markPending(parsed.spaces))
          }
          await db.workspaces.bulkPut(
            markPending(parsed.workspaces).map((w: any) => ({
              ...w,
              folder: normalizeFolderPath(w.folder)
            }))
          )
          await db.canvasNodes.bulkPut(markPending(parsed.nodes))
          if (parsed.edges) await db.canvasEdges.bulkPut(markPending(parsed.edges))
          if (parsed.collections) await db.collections.bulkPut(markPending(parsed.collections))
          if (parsed.tags) await db.tags.bulkPut(markPending(parsed.tags))

          markAccountSeeded()
          await syncEngine.triggerSync()
          alert('¡Copia de seguridad restaurada con éxito!')
          window.location.reload()
        }
      } catch {
        alert('Error al procesar el archivo JSON.')
      }
    }
    reader.readAsText(file)
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-2 sm:p-4 animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        className="w-full max-w-xl rounded-xl border border-[var(--app-border-strong)] shadow-[var(--app-shadow-popover)] overflow-hidden flex flex-col max-h-[90vh] bg-[var(--app-bg-overlay)] text-[var(--app-text-primary)] font-sans"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-[var(--app-divider)] shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-7 h-7 rounded-md flex items-center justify-center bg-[var(--app-hover)] text-[var(--app-text-secondary)] shrink-0">
              <SettingsIcon style={{ width: 16, height: 16 }} />
            </div>
            <div className="min-w-0">
              <h2 className="text-sm font-semibold text-[var(--app-text-primary)] truncate">
                Configuración y Sincronización
              </h2>
              <p className="text-[11px] text-[var(--app-text-muted)] truncate">
                Gestión de nube Supabase y copias de seguridad locales
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-md text-[var(--app-text-secondary)] hover:text-[var(--app-text-primary)] hover:bg-[var(--app-hover)] transition-colors cursor-pointer shrink-0"
          >
            <CloseIcon style={{ width: 16, height: 16 }} />
          </button>
        </div>

        {/* Modal Content */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4 text-xs custom-scrollbar">
          {/* UI Scale / Zoom Section */}
          <div className="space-y-3 p-3.5 rounded-lg border border-[var(--app-border)] bg-[var(--app-bg-secondary)]">
            <div className="flex items-center justify-between gap-2">
              <div>
                <h3 className="text-xs font-semibold text-[var(--app-text-primary)]">
                  Tamaño y escala de la interfaz
                </h3>
                <p className="text-[11px] mt-0.5 text-[var(--app-text-muted)]">
                  Ajusta el tamaño global de los botones, textos e iconos.
                </p>
              </div>
              <span className="text-[11px] font-mono font-medium px-2 py-0.5 rounded bg-[var(--app-hover)] border border-[var(--app-border)] text-[var(--app-text-primary)] shrink-0">
                {uiScale}%
              </span>
            </div>

            <div className="grid grid-cols-5 gap-1.5 pt-0.5">
              {[
                { value: '90', label: '90%', sub: 'Compacto' },
                { value: '100', label: '100%', sub: 'Normal' },
                { value: '110', label: '110%', sub: 'Grande' },
                { value: '120', label: '120%', sub: 'Muy grande' },
                { value: '130', label: '130%', sub: 'Accesible' },
              ].map((opt) => {
                const isSelected = uiScale === opt.value
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => onUiScaleChange?.(opt.value)}
                    className={`py-2 px-1.5 rounded-md border text-center transition-colors flex flex-col items-center justify-center gap-0.5 cursor-pointer ${
                      isSelected
                        ? 'border-[var(--app-accent)] bg-[var(--app-accent-soft)] text-[var(--app-text-primary)] font-semibold'
                        : 'border-[var(--app-border)] bg-[var(--app-bg-primary)] text-[var(--app-text-secondary)] hover:bg-[var(--app-hover)] hover:text-[var(--app-text-primary)]'
                    }`}
                  >
                    <span className="text-xs font-semibold">{opt.label}</span>
                    <span className="text-[10px] opacity-75">{opt.sub}</span>
                  </button>
                )
              })}
            </div>

            <div className="flex items-center justify-between pt-1 text-[11px] text-[var(--app-text-muted)]">
              <span>Atajo de teclado</span>
              <span className="font-mono bg-[var(--app-bg-primary)] px-2 py-0.5 rounded border border-[var(--app-border)] text-[var(--app-text-secondary)]">
                Ctrl + / Ctrl - / Ctrl 0
              </span>
            </div>
          </div>

          {/* Notifications Section */}
          <div className="space-y-3 p-3.5 rounded-lg border border-[var(--app-border)] bg-[var(--app-bg-secondary)]">
            <div className="flex items-center justify-between gap-2">
              <div>
                <h3 className="text-xs font-semibold text-[var(--app-text-primary)]">
                  Notificaciones y Alertas
                </h3>
                <p className="text-[11px] mt-0.5 text-[var(--app-text-muted)]">
                  Controla avisos en la app, notificaciones nativas, sonido y horario silencioso.
                </p>
              </div>
              <button
                type="button"
                onClick={() => void notificationService.sendTestNotification()}
                className="px-2.5 py-1 rounded-md border border-[var(--app-border)] bg-[var(--app-bg-primary)] hover:bg-[var(--app-hover)] text-[11px] font-medium text-[var(--app-text-primary)] transition cursor-pointer shrink-0"
              >
                Probar alerta
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {[
                {
                  key: 'toastsEnabled' as const,
                  label: 'Avisos flotantes (Toasts)',
                  value: notifPrefs.toastsEnabled
                },
                {
                  key: 'soundEnabled' as const,
                  label: 'Sonido sutil de alerta',
                  value: notifPrefs.soundEnabled
                },
                {
                  key: 'dndEnabled' as const,
                  label: 'Modo No Molestar',
                  value: notifPrefs.dndEnabled
                },
                {
                  key: 'quietHoursEnabled' as const,
                  label: 'Horario silencioso automático',
                  value: notifPrefs.quietHoursEnabled
                }
              ].map((item) => (
                <label
                  key={item.key}
                  className="flex items-center justify-between gap-2 px-2.5 py-2 rounded-md border border-[var(--app-border)] bg-[var(--app-bg-primary)] cursor-pointer"
                >
                  <span className="text-[11px] font-medium text-[var(--app-text-primary)]">
                    {item.label}
                  </span>
                  <input
                    type="checkbox"
                    checked={item.value}
                    onChange={(e) =>
                      notificationService.updatePreferences({ [item.key]: e.target.checked })
                    }
                    className="accent-[var(--app-accent)] cursor-pointer"
                  />
                </label>
              ))}
            </div>

            {notifPrefs.quietHoursEnabled && (
              <div className="flex items-center justify-between gap-3 px-2.5 py-2 rounded-md border border-[var(--app-border)] bg-[var(--app-bg-primary)]">
                <span className="text-[11px] text-[var(--app-text-secondary)]">
                  Rango silencioso
                </span>
                <div className="flex items-center gap-1.5">
                  <input
                    type="time"
                    value={notifPrefs.quietHoursStart}
                    onChange={(e) =>
                      notificationService.updatePreferences({ quietHoursStart: e.target.value })
                    }
                    className="px-1.5 py-0.5 text-[11px] rounded border border-[var(--app-border)] bg-[var(--app-bg-secondary)] text-[var(--app-text-primary)]"
                  />
                  <span className="text-[var(--app-text-muted)]">a</span>
                  <input
                    type="time"
                    value={notifPrefs.quietHoursEnd}
                    onChange={(e) =>
                      notificationService.updatePreferences({ quietHoursEnd: e.target.value })
                    }
                    className="px-1.5 py-0.5 text-[11px] rounded border border-[var(--app-border)] bg-[var(--app-bg-secondary)] text-[var(--app-text-primary)]"
                  />
                </div>
              </div>
            )}

            {/* Desktop Permission */}
            <div className="flex items-center justify-between gap-2 px-2.5 py-2 rounded-md border border-[var(--app-border)] bg-[var(--app-bg-primary)]">
              <div>
                <div className="text-[11px] font-medium text-[var(--app-text-primary)]">
                  Notificaciones de escritorio / sistema
                </div>
                <div className="text-[10px] text-[var(--app-text-muted)]">
                  Estado:{' '}
                  {desktopPerm === 'granted'
                    ? 'Permitido'
                    : desktopPerm === 'denied'
                    ? 'Bloqueado por el navegador'
                    : desktopPerm === 'unsupported'
                    ? 'No soportado en este entorno'
                    : 'Pendiente de permiso'}
                </div>
              </div>
              {desktopPerm === 'granted' ? (
                <input
                  type="checkbox"
                  checked={notifPrefs.desktopEnabled}
                  onChange={(e) =>
                    notificationService.updatePreferences({ desktopEnabled: e.target.checked })
                  }
                  className="accent-[var(--app-accent)] cursor-pointer"
                />
              ) : desktopPerm === 'default' ? (
                <button
                  type="button"
                  onClick={async () => {
                    const res = await notificationService.requestDesktopPermission()
                    setDesktopPerm(res)
                  }}
                  className="px-2.5 py-1 rounded text-[11px] font-medium bg-[var(--app-accent-soft)] text-[var(--app-accent)] hover:opacity-90 border border-[var(--app-accent)]/30 transition cursor-pointer"
                >
                  Activar
                </button>
              ) : null}
            </div>

            {/* Background Web Push (even when browser is closed) */}
            {webPushStatus?.supported && (
              <div className="space-y-2 px-2.5 py-2.5 rounded-md border border-[var(--app-border)] bg-[var(--app-bg-primary)]">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <div className="text-[11px] font-medium text-[var(--app-text-primary)]">
                      Push en segundo plano (web cerrada)
                    </div>
                    <div className="text-[10px] text-[var(--app-text-muted)]">
                      {webPushStatus.subscribed
                        ? 'Suscrito en este dispositivo'
                        : 'Recibe alertas aunque cierres el navegador'}
                    </div>
                  </div>
                  <button
                    type="button"
                    disabled={pushLoading}
                    onClick={async () => {
                      setPushLoading(true)
                      const res = webPushStatus.subscribed
                        ? await unsubscribeFromWebPush()
                        : await subscribeToWebPush(vapidInput)
                      setPushLoading(false)
                      if (res.success) {
                        toast.success(res.message)
                      } else {
                        toast.error(res.message)
                      }
                      const next = await getWebPushStatus()
                      setWebPushStatus(next)
                    }}
                    className={`px-2.5 py-1 rounded text-[11px] font-medium border transition cursor-pointer disabled:opacity-50 ${
                      webPushStatus.subscribed
                        ? 'border-rose-500/30 bg-rose-500/10 text-rose-500 dark:text-rose-400 hover:bg-rose-500/20'
                        : 'border-[var(--app-accent)]/30 bg-[var(--app-accent-soft)] text-[var(--app-accent)] hover:opacity-90'
                    }`}
                  >
                    {pushLoading
                      ? 'Procesando...'
                      : webPushStatus.subscribed
                      ? 'Desactivar'
                      : 'Activar Push'}
                  </button>
                </div>

                {!import.meta.env.VITE_VAPID_PUBLIC_KEY && (
                  <div className="flex items-center gap-1.5">
                    <input
                      type="text"
                      value={vapidInput}
                      onChange={(e) => {
                        setVapidInput(e.target.value)
                        saveVapidPublicKey(e.target.value)
                      }}
                      placeholder="Clave pública VAPID (ej. BEl62iUYg...)"
                      className="flex-1 px-2 py-1 text-[11px] rounded border border-[var(--app-border)] bg-[var(--app-bg-secondary)] text-[var(--app-text-primary)] placeholder:text-[var(--app-text-muted)] font-mono"
                    />
                  </div>
                )}
              </div>
            )}

            {/* Category Filters */}
            <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
              {(
                [
                  { id: 'collaboration', label: 'Menciones y comentarios' },
                  { id: 'activity', label: 'Nuevas notas del equipo' },
                  { id: 'reminders', label: 'Recordatorios de tareas' },
                  { id: 'sync', label: 'Sincronización' },
                  { id: 'system', label: 'Sistema' }
                ] as const
              ).map((cat) => {
                const active = notifPrefs.categories[cat.id]
                return (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() =>
                      notificationService.updatePreferences({
                        categories: { ...notifPrefs.categories, [cat.id]: !active }
                      })
                    }
                    className={`inline-flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-medium border transition cursor-pointer ${
                      active
                        ? 'border-[var(--app-accent)]/40 bg-[var(--app-accent-soft)] text-[var(--app-accent)]'
                        : 'border-[var(--app-border)] bg-[var(--app-bg-primary)] text-[var(--app-text-muted)] hover:text-[var(--app-text-primary)]'
                    }`}
                  >
                    {active && <Check size={11} weight="bold" />}
                    <span>{cat.label}</span>
                  </button>
                )
              })}
            </div>
          </div>

          {/* MCP Server (AI Brain for Team Bots) */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h3 className="text-xs font-semibold flex items-center gap-1.5 text-[var(--app-text-primary)]">
                  <Robot size={15} weight="duotone" className="text-[var(--app-accent)]" />
                  <span>Cerebro IA · Servidor MCP</span>
                </h3>
                <p className="text-[11px] text-[var(--app-text-muted)]">
                  Conecta tus bots y agentes externos a Seven Note mediante Model Context Protocol (Streamable HTTP).
                </p>
              </div>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/25 shrink-0">
                <PlugsConnected size={11} weight="bold" />
                Remoto
              </span>
            </div>

            <div className="space-y-3 p-3.5 rounded-lg border border-[var(--app-border)] bg-[var(--app-bg-secondary)]">
              {/* Endpoint URL */}
              <div className="space-y-1">
                <label className="block text-[11px] font-medium text-[var(--app-text-secondary)]">
                  Endpoint MCP (URL)
                </label>
                <div className="flex gap-1.5">
                  <input
                    type="text"
                    value={mcpUrl}
                    onChange={(e) => handleMcpUrlChange(e.target.value)}
                    placeholder="https://note.sevenestudio.com/api/mcp"
                    className="flex-1 text-xs font-mono px-2.5 py-1.5 rounded-md border border-[var(--app-border-strong)] bg-[var(--app-bg-primary)] text-[var(--app-text-primary)] outline-none focus:border-[var(--app-accent)]"
                  />
                  <button
                    type="button"
                    onClick={() => void copyMcpSnippet('url')}
                    className="px-2.5 py-1.5 rounded-md text-xs font-medium border border-[var(--app-border-strong)] bg-[var(--app-bg-primary)] hover:bg-[var(--app-hover)] text-[var(--app-text-primary)] transition-colors flex items-center gap-1 cursor-pointer shrink-0"
                  >
                    {copiedMcpItem === 'url' ? (
                      <DoneIcon style={{ width: 13, height: 13, color: '#10b981' }} />
                    ) : (
                      <CopyIcon style={{ width: 13, height: 13 }} />
                    )}
                    <span>{copiedMcpItem === 'url' ? 'Copiada' : 'Copiar'}</span>
                  </button>
                </div>
              </div>

              {/* Token MCP */}
              <div className="space-y-1">
                <label className="block text-[11px] font-medium text-[var(--app-text-secondary)]">
                  Token de acceso (SEVEN_NOTE_MCP_API_KEY)
                </label>
                <div className="flex gap-1.5">
                  <div className="relative flex-1">
                    <input
                      type={showMcpKey ? 'text' : 'password'}
                      value={mcpApiKey}
                      onChange={(e) => handleMcpKeyChange(e.target.value)}
                      placeholder="sn_mcp_... (se guarda solo en tu navegador)"
                      className="w-full text-xs font-mono pl-2.5 pr-8 py-1.5 rounded-md border border-[var(--app-border-strong)] bg-[var(--app-bg-primary)] text-[var(--app-text-primary)] outline-none focus:border-[var(--app-accent)]"
                    />
                    <button
                      type="button"
                      onClick={() => setShowMcpKey((v) => !v)}
                      title={showMcpKey ? 'Ocultar token' : 'Mostrar token'}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-[var(--app-text-muted)] hover:text-[var(--app-text-primary)] cursor-pointer"
                    >
                      {showMcpKey ? <EyeSlash size={14} /> : <Eye size={14} />}
                    </button>
                  </div>
                </div>
              </div>

              {/* Permisos y alcance */}
              <div className="flex items-start gap-2 p-2.5 rounded-md bg-[var(--app-bg-primary)] border border-[var(--app-border)] text-[11px] text-[var(--app-text-muted)]">
                <ShieldCheck size={15} weight="duotone" className="text-emerald-500 shrink-0 mt-0.5" />
                <div>
                  <span className="font-medium text-[var(--app-text-primary)]">Alcance activo:</span> los bots pueden leer y escribir en{' '}
                  <span className="text-[var(--app-text-primary)]">espacios compartidos</span> y{' '}
                  <span className="text-[var(--app-text-primary)]">espacios solo admins</span>. Los{' '}
                  <span className="text-rose-500 font-medium">espacios y notas privadas están bloqueados</span>.
                </div>
              </div>

              {/* Live Test Result */}
              {mcpStatus && (
                <div
                  className={`flex items-center gap-2 p-2.5 rounded-md text-xs border ${
                    mcpStatus.ok
                      ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/25'
                      : 'bg-rose-500/10 text-rose-700 dark:text-rose-300 border-rose-500/25'
                  }`}
                >
                  {mcpStatus.ok ? (
                    <DoneIcon style={{ width: 14, height: 14, flexShrink: 0 }} />
                  ) : (
                    <InformationIcon style={{ width: 14, height: 14, flexShrink: 0 }} />
                  )}
                  <span>{mcpStatus.message}</span>
                </div>
              )}

              {/* Actions */}
              <div className="flex items-center justify-between pt-1 gap-2 flex-wrap">
                <div className="flex gap-1.5 flex-wrap">
                  <button
                    type="button"
                    onClick={() => void copyMcpSnippet('json')}
                    className="px-2.5 py-1.5 rounded-md text-xs font-medium border border-[var(--app-border-strong)] bg-[var(--app-bg-primary)] hover:bg-[var(--app-hover)] text-[var(--app-text-primary)] transition-colors flex items-center gap-1.5 cursor-pointer"
                    title="Copiar bloque JSON listo para Claude, Cursor, Antigravity u OpenAI Agents"
                  >
                    {copiedMcpItem === 'json' ? (
                      <DoneIcon style={{ width: 13, height: 13, color: '#10b981' }} />
                    ) : (
                      <CopyIcon style={{ width: 13, height: 13 }} />
                    )}
                    <span>{copiedMcpItem === 'json' ? 'JSON copiado' : 'Copiar config JSON'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => void copyMcpSnippet('header')}
                    className="px-2.5 py-1.5 rounded-md text-xs font-medium border border-[var(--app-border-strong)] bg-[var(--app-bg-primary)] hover:bg-[var(--app-hover)] text-[var(--app-text-primary)] transition-colors flex items-center gap-1.5 cursor-pointer"
                    title="Copiar header Authorization: Bearer para n8n o bots propios"
                  >
                    {copiedMcpItem === 'header' ? (
                      <DoneIcon style={{ width: 13, height: 13, color: '#10b981' }} />
                    ) : (
                      <CopyIcon style={{ width: 13, height: 13 }} />
                    )}
                    <span>{copiedMcpItem === 'header' ? 'Header copiado' : 'Copiar Bearer'}</span>
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => void handleTestMcp()}
                  disabled={mcpTesting}
                  className="px-3.5 py-1.5 rounded-md text-xs font-medium text-white bg-[var(--app-accent)] hover:bg-[var(--app-accent-hover)] transition-colors disabled:opacity-50 cursor-pointer"
                >
                  {mcpTesting ? 'Probando...' : 'Probar MCP'}
                </button>
              </div>
            </div>
          </div>

          {/* Supabase Section */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h3 className="text-xs font-semibold text-[var(--app-text-primary)]">
                  Sincronización en la nube (Supabase)
                </h3>
                <p className="text-[11px] text-[var(--app-text-muted)]">
                  Opcional. Seven Note funciona 100% offline; conecta Supabase para respaldar tus notas automáticamente.
                </p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer shrink-0">
                <input
                  type="checkbox"
                  checked={enabled}
                  onChange={(e) => setEnabled(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-9 h-5 bg-[var(--app-border-strong)] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-4 after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[var(--app-accent)]"></div>
              </label>
            </div>

            <div className="space-y-3 p-3.5 rounded-lg border border-[var(--app-border)] bg-[var(--app-bg-secondary)]">
              {/* Intervalo de sincronización periódica */}
              <div className="flex items-center justify-between gap-2">
                <div>
                  <label className="block text-xs font-medium text-[var(--app-text-primary)]">
                    Frecuencia de sincronización
                  </label>
                  <p className="text-[11px] text-[var(--app-text-muted)]">
                    Sincroniza en segundo plano cuando estés conectado
                  </p>
                </div>
                <select
                  value={syncInterval}
                  onChange={(e) => setSyncInterval(Number(e.target.value))}
                  className="text-xs px-2.5 py-1.5 rounded-md border border-[var(--app-border-strong)] bg-[var(--app-bg-primary)] text-[var(--app-text-primary)] outline-none focus:border-[var(--app-accent)] cursor-pointer"
                >
                  <option value={10}>Cada 10 segundos</option>
                  <option value={30}>Cada 30 segundos (Recomendado)</option>
                  <option value={60}>Cada 1 minuto</option>
                  <option value={300}>Cada 5 minutos</option>
                </select>
              </div>

              {testResult && (
                <div
                  className={`flex items-center gap-2 p-2.5 rounded-md text-xs border ${
                    testResult.success
                      ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/25'
                      : 'bg-rose-500/10 text-rose-700 dark:text-rose-300 border-rose-500/25'
                  }`}
                >
                  {testResult.success ? (
                    <DoneIcon style={{ width: 14, height: 14 }} />
                  ) : (
                    <InformationIcon style={{ width: 14, height: 14 }} />
                  )}
                  <span>{testResult.message}</span>
                </div>
              )}

              <div className="flex items-center justify-between pt-1 gap-2 flex-wrap">
                <div className="flex gap-2">
                  <button
                    onClick={handleTest}
                    disabled={testing || !url || !anonKey}
                    className="px-3 py-1.5 rounded-md text-xs font-medium border border-[var(--app-border-strong)] bg-[var(--app-bg-primary)] hover:bg-[var(--app-hover)] text-[var(--app-text-primary)] transition-colors disabled:opacity-50 cursor-pointer"
                  >
                    {testing ? 'Probando...' : 'Probar conexión'}
                  </button>
                  <button
                    onClick={copySqlSchema}
                    className="px-3 py-1.5 rounded-md text-xs font-medium border border-[var(--app-border-strong)] bg-[var(--app-bg-primary)] hover:bg-[var(--app-hover)] text-[var(--app-text-primary)] transition-colors flex items-center gap-1.5 cursor-pointer"
                    title="Copiar script SQL para crear las tablas en Supabase"
                  >
                    {copiedSql ? (
                      <DoneIcon style={{ width: 14, height: 14, color: '#10b981' }} />
                    ) : (
                      <CopyIcon style={{ width: 14, height: 14 }} />
                    )}
                    <span>{copiedSql ? 'SQL copiado' : 'Copiar esquema SQL'}</span>
                  </button>
                </div>

                <button
                  onClick={handleSave}
                  className="px-4 py-1.5 rounded-md text-xs font-medium text-[var(--app-bg-primary)] bg-[var(--app-text-primary)] hover:opacity-90 transition-opacity cursor-pointer"
                >
                  Guardar
                </button>
              </div>
            </div>
          </div>

          {/* Sync Actions */}
          <div className="p-3.5 rounded-lg border border-[var(--app-border)] bg-[var(--app-bg-secondary)] flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-8 h-8 rounded-md flex items-center justify-center bg-[var(--app-hover)] shrink-0">
                <CloudWorkspaceIcon style={{ width: 16, height: 16, color: 'var(--app-text-secondary)' }} />
              </div>
              <div className="min-w-0">
                <div className="text-xs font-semibold text-[var(--app-text-primary)]">
                  Estado de sincronización
                </div>
                <div className="text-[11px] text-[var(--app-text-muted)] truncate">
                  {syncStatus.pendingCount === 0
                    ? 'Todo sincronizado con la nube'
                    : `${syncStatus.pendingCount} cambios pendientes en IndexedDB`}
                </div>
              </div>
            </div>
            <button
              onClick={handleManualSync}
              disabled={manualSyncing || !enabled}
              className="px-3 py-1.5 rounded-md text-xs font-medium border border-[var(--app-border-strong)] bg-[var(--app-bg-primary)] hover:bg-[var(--app-hover)] text-[var(--app-text-primary)] transition-colors flex items-center gap-1.5 disabled:opacity-50 cursor-pointer shrink-0"
            >
              <ResetIcon
                style={{
                  width: 14,
                  height: 14,
                  animation: manualSyncing ? 'spin 1s linear infinite' : 'none'
                }}
              />
              <span>Sincronizar ahora</span>
            </button>
          </div>

          {/* Local Backups (Offline First) */}
          <div className="space-y-2.5">
            <div>
              <h3 className="text-xs font-semibold flex items-center gap-2 text-[var(--app-text-primary)]">
                <DatabaseTableViewIcon style={{ width: 15, height: 15, color: 'var(--app-text-secondary)' }} />
                <span>Copia de seguridad local (JSON)</span>
              </h3>
              <p className="text-[11px] text-[var(--app-text-muted)] mt-0.5">
                Exporta o restaura todo tu espacio de trabajo localmente sin depender de ningún servidor.
              </p>
            </div>

            <div className="flex gap-2">
              <button
                onClick={exportBackupJson}
                className="flex-1 py-2 px-3 rounded-md text-xs font-medium border border-[var(--app-border-strong)] bg-[var(--app-bg-secondary)] hover:bg-[var(--app-hover)] text-[var(--app-text-primary)] transition-colors flex items-center justify-center gap-2 cursor-pointer"
              >
                <DownloadIcon style={{ width: 14, height: 14 }} />
                <span>Exportar copia (JSON)</span>
              </button>

              <label className="flex-1 py-2 px-3 rounded-md text-xs font-medium border border-[var(--app-border-strong)] bg-[var(--app-bg-secondary)] hover:bg-[var(--app-hover)] text-[var(--app-text-primary)] transition-colors flex items-center justify-center gap-2 cursor-pointer">
                <UploadIcon style={{ width: 14, height: 14 }} />
                <span>Restaurar copia</span>
                <input
                  type="file"
                  accept=".json"
                  onChange={importBackupJson}
                  className="hidden"
                />
              </label>
            </div>
          </div>

          {/* PWA / Desktop App Install & Updates */}
          <div className="p-3.5 rounded-lg border border-[var(--app-border)] bg-[var(--app-bg-secondary)] flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-8 h-8 rounded-md flex items-center justify-center bg-[var(--app-accent-soft)] text-[var(--app-accent)] font-semibold text-sm shrink-0">
                7
              </div>
              <div className="min-w-0">
                <div className="text-xs font-semibold text-[var(--app-text-primary)]">
                  {isTauri ? 'Seven Note para Escritorio (Nativo)' : 'Aplicación de Escritorio / PWA'}
                </div>
                <div className="text-[11px] text-[var(--app-text-muted)]">
                  {isTauri
                    ? 'Versión nativa de escritorio v1.0.0. Actualizaciones automáticas activas.'
                    : isStandalone
                    ? 'Seven Note se está ejecutando en modo standalone (instalada).'
                    : 'Instala Seven Note en Windows, Mac, iPad o Android para acceso directo y 100% offline.'}
                </div>
              </div>
            </div>

            {isTauri ? (
              <button
                type="button"
                onClick={() => checkForAppUpdates(true)}
                className="px-3.5 py-1.5 rounded-md text-xs font-medium text-white bg-[var(--app-accent)] hover:bg-[var(--app-accent-hover)] transition-colors cursor-pointer shrink-0"
              >
                Buscar actualizaciones
              </button>
            ) : (
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => checkForWebUpdates(true)}
                  className="px-3 py-1.5 rounded-md text-xs font-medium border border-[var(--app-border-strong)] bg-[var(--app-bg-primary)] hover:bg-[var(--app-hover)] text-[var(--app-text-primary)] transition-colors cursor-pointer"
                >
                  Buscar actualizaciones
                </button>
                {!isStandalone && (
                  <button
                    onClick={handleInstallApp}
                    className="px-3.5 py-1.5 rounded-md text-xs font-medium text-white bg-[var(--app-accent)] hover:bg-[var(--app-accent-hover)] transition-colors cursor-pointer"
                  >
                    Instalar App
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-[var(--app-divider)] text-xs flex items-center justify-between shrink-0 bg-[var(--app-bg-secondary)] text-[var(--app-text-muted)]">
          <span>Seven Note</span>
          <button
            onClick={onClose}
            className="px-3.5 py-1.5 rounded-md text-xs font-medium border border-[var(--app-border-strong)] bg-[var(--app-bg-primary)] hover:bg-[var(--app-hover)] text-[var(--app-text-primary)] transition-colors cursor-pointer"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  )
}
