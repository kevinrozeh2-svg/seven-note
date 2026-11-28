import { useState, useEffect } from 'react'
import {
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
import {
  Bell,
  Check,
  CloudCheck,
  Eye,
  EyeSlash,
  HardDrives,
  Palette,
  PlugsConnected,
  Robot,
  ShieldCheck,
  Shuffle,
  Sparkle,
  TextAa,
  Trash,
  X
} from '@phosphor-icons/react'
import {
  getStoredSupabaseConfig,
  saveSupabaseConfig,
  testSupabaseConnection
} from '../../lib/supabase'
import { syncEngine, type SyncEngineStatus } from '../../lib/syncEngine'
import { db, markAccountSeeded, normalizeFolderPath } from '../../db'
import schemaSql from '../../supabase_schema.sql?raw'
import { toast } from '../../lib/toast'
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

import {
  ACCENT_PRESETS,
  APP_THEMES,
  type AppThemeCategory,
  type AppThemeId,
  applyAppTheme,
  getCustomAccentId,
  getRandomThemeId,
  getThemeById,
  getThemeEffectsEnabled,
  setCustomAccentId,
  setThemeEffectsEnabled
} from '../../lib/themes'
import {
  type EditorPreferences,
  getEditorPreferences,
  updateEditorPreferences,
  subscribeEditorPreferences
} from '../../lib/editorPreferences'

interface SettingsModalProps {
  isOpen: boolean
  onClose: () => void
  syncStatus: SyncEngineStatus
  uiScale?: string
  onUiScaleChange?: (scale: string) => void
  themeId?: AppThemeId
  onThemeChange?: (theme: AppThemeId) => void
}

export function SettingsModal({
  isOpen,
  onClose,
  syncStatus,
  uiScale = '100',
  onUiScaleChange,
  themeId = 'obsidian',
  onThemeChange
}: SettingsModalProps) {
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
  const [activeSection, setActiveSection] = useState<
    'appearance' | 'editor' | 'notifications' | 'sync' | 'mcp' | 'backup'
  >('appearance')
  const [themeCategoryFilter, setThemeCategoryFilter] = useState<'all' | AppThemeCategory>('all')
  const [themeModeFilter, setThemeModeFilter] = useState<'all' | 'dark' | 'light'>('all')
  const [themeEffectsEnabled, setThemeEffectsEnabledState] = useState<boolean>(() =>
    getThemeEffectsEnabled()
  )
  const [customAccentId, setCustomAccentIdState] = useState<string | null>(() => getCustomAccentId())
  const [editorPrefs, setEditorPrefs] = useState<EditorPreferences>(() => getEditorPreferences())
  const [storageStats, setStorageStats] = useState<{
    activeNotes: number
    trashedNotes: number
    canvasNodes: number
    usageLabel: string
  } | null>(null)
  const [confirmEmptyTrash, setConfirmEmptyTrash] = useState(false)
  const [emptyingTrash, setEmptyingTrash] = useState(false)

  useEffect(() => {
    return subscribeEditorPreferences(setEditorPrefs)
  }, [])

  useEffect(() => {
    if (!isOpen || activeSection !== 'backup') return
    let cancelled = false
    const loadStats = async () => {
      try {
        const [allWs, allNodes] = await Promise.all([
          db.workspaces.toArray(),
          db.canvasNodes.toArray()
        ])
        const activeNotes = allWs.filter((w) => !w.isDeleted).length
        const trashedNotes = allWs.filter((w) => w.isDeleted).length
        const canvasNodes = allNodes.filter((n) => !n.isDeleted).length
        let usageLabel = '—'
        if (typeof navigator !== 'undefined' && navigator.storage?.estimate) {
          const est = await navigator.storage.estimate()
          if (typeof est.usage === 'number') {
            const mb = est.usage / (1024 * 1024)
            usageLabel = mb < 0.1 ? '< 0.1 MB' : `${mb.toFixed(1)} MB`
          }
        }
        if (!cancelled) {
          setStorageStats({ activeNotes, trashedNotes, canvasNodes, usageLabel })
        }
      } catch {
        // ignore storage read failure
      }
    }
    void loadStats()
    return () => {
      cancelled = true
    }
  }, [isOpen, activeSection])

  const handleEmptyTrash = async () => {
    setEmptyingTrash(true)
    try {
      const trashed = await db.workspaces.filter((w) => !!w.isDeleted).toArray()
      const trashedIds = trashed.map((w) => w.id)
      if (trashedIds.length > 0) {
        await db.workspaces.bulkDelete(trashedIds)
        const orphanNodes = await db.canvasNodes
          .filter((n) => !!n.isDeleted || trashedIds.includes(n.workspaceId))
          .toArray()
        if (orphanNodes.length > 0) {
          await db.canvasNodes.bulkDelete(orphanNodes.map((n) => n.id))
        }
      }
      setConfirmEmptyTrash(false)
      setStorageStats((prev) => (prev ? { ...prev, trashedNotes: 0 } : prev))
      toast.success(
        trashedIds.length > 0
          ? `Papelera vaciada (${trashedIds.length} notas eliminadas)`
          : 'La papelera ya estaba vacía'
      )
    } catch {
      toast.error('No se pudo vaciar la papelera')
    } finally {
      setEmptyingTrash(false)
    }
  }

  useEffect(() => {
    if (!isOpen) return
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [isOpen, onClose])

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

  const navItems = [
    { id: 'appearance' as const, label: 'Apariencia', icon: Palette },
    { id: 'editor' as const, label: 'Editor y Escritura', icon: TextAa },
    { id: 'notifications' as const, label: 'Notificaciones', icon: Bell },
    { id: 'sync' as const, label: 'Sincronización', icon: CloudCheck },
    { id: 'mcp' as const, label: 'Cerebro IA (MCP)', icon: Robot },
    { id: 'backup' as const, label: 'Respaldo y App', icon: HardDrives }
  ]

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 backdrop-blur-xs p-2 sm:p-5 animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Configuración de Seven Note"
        className="w-full max-w-4xl h-[86vh] sm:h-[78vh] max-h-[680px] rounded-xl border border-[var(--app-border-strong)] shadow-[var(--app-shadow-popover)] overflow-hidden flex flex-col md:flex-row bg-[var(--app-bg-primary)] text-[var(--app-text-primary)] font-sans"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Left Navigation Sidebar (Desktop) / Top Tab Strip (Mobile) */}
        <aside className="md:w-56 shrink-0 bg-[var(--app-bg-secondary)] border-b md:border-b-0 md:border-r border-[var(--app-border)] flex flex-col">
          <div className="px-4 py-3.5 flex items-center justify-between border-b border-[var(--app-divider)]">
            <div className="flex items-center gap-2 min-w-0">
              <SettingsIcon style={{ width: 16, height: 16, color: 'var(--app-text-secondary)' }} />
              <h2 className="text-[13px] font-semibold text-[var(--app-text-primary)] truncate">
                Configuración
              </h2>
            </div>
            <button
              type="button"
              aria-label="Cerrar configuración"
              onClick={onClose}
              className="md:hidden w-8 h-8 rounded-md flex items-center justify-center text-[var(--app-text-secondary)] hover:text-[var(--app-text-primary)] hover:bg-[var(--app-hover)] transition cursor-pointer"
            >
              <X size={16} weight="bold" />
            </button>
          </div>

          <nav
            aria-label="Secciones de configuración"
            className="flex md:flex-col gap-1 p-2 overflow-x-auto md:overflow-y-auto no-scrollbar flex-1"
          >
            {navItems.map((item) => {
              const Icon = item.icon
              const isActive = activeSection === item.id
              return (
                <button
                  key={item.id}
                  type="button"
                  aria-current={isActive ? 'page' : undefined}
                  onClick={() => setActiveSection(item.id)}
                  className={`flex items-center gap-2.5 px-3 py-2 rounded-md text-xs font-medium whitespace-nowrap transition cursor-pointer shrink-0 ${
                    isActive
                      ? 'bg-[var(--app-active)] text-[var(--app-text-primary)] font-semibold'
                      : 'text-[var(--app-text-secondary)] hover:text-[var(--app-text-primary)] hover:bg-[var(--app-hover)]'
                  }`}
                >
                  <Icon size={16} weight={isActive ? 'fill' : 'regular'} className="shrink-0" />
                  <span>{item.label}</span>
                </button>
              )
            })}
          </nav>

          {/* Subtle status footer on desktop */}
          <div className="hidden md:flex items-center justify-between px-4 py-3 border-t border-[var(--app-divider)] text-[11px] text-[var(--app-text-muted)]">
            <span>Seven Note</span>
            <span className="font-mono">{uiScale}%</span>
          </div>
        </aside>

        {/* Right Content Pane */}
        <div className="flex-1 flex flex-col min-w-0 min-h-0 bg-[var(--app-bg-primary)]">
          {/* Desktop Pane Header */}
          <div className="hidden md:flex items-center justify-between px-6 py-3.5 border-b border-[var(--app-divider)] shrink-0">
            <div>
              <h3 className="text-sm font-semibold text-[var(--app-text-primary)]">
                {activeSection === 'appearance' && 'Apariencia'}
                {activeSection === 'editor' && 'Editor y Escritura'}
                {activeSection === 'notifications' && 'Notificaciones y Alertas'}
                {activeSection === 'sync' && 'Sincronización en la nube'}
                {activeSection === 'mcp' && 'Cerebro IA · Servidor MCP'}
                {activeSection === 'backup' && 'Respaldo local y Aplicación'}
              </h3>
              <p className="text-xs text-[var(--app-text-muted)] mt-0.5">
                {activeSection === 'appearance' && 'Personaliza la paleta de colores y el tamaño global de la interfaz.'}
                {activeSection === 'editor' && 'Configura tipografía, interlineado y valores por defecto para tus notas nuevas.'}
                {activeSection === 'notifications' && 'Controla avisos flotantes, sonido, horario silencioso y push en segundo plano.'}
                {activeSection === 'sync' && 'Gestiona la frecuencia de respaldo automático y tu conexión con Supabase.'}
                {activeSection === 'mcp' && 'Conecta agentes externos y bots a Seven Note mediante Model Context Protocol.'}
                {activeSection === 'backup' && 'Revisa el almacenamiento local, exporta copias JSON o actualiza la aplicación.'}
              </p>
            </div>
            <button
              type="button"
              aria-label="Cerrar configuración"
              onClick={onClose}
              className="w-8 h-8 rounded-md flex items-center justify-center text-[var(--app-text-secondary)] hover:text-[var(--app-text-primary)] hover:bg-[var(--app-hover)] transition cursor-pointer shrink-0"
              title="Cerrar (Esc)"
            >
              <X size={17} weight="bold" />
            </button>
          </div>

          {/* Scrollable Active Section Body */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5 text-xs custom-scrollbar">
            {/* TAB 1: APARIENCIA */}
            {activeSection === 'appearance' && (() => {
              const filteredThemes = APP_THEMES.filter((t) => {
                if (themeCategoryFilter !== 'all' && t.category !== themeCategoryFilter) return false
                if (themeModeFilter !== 'all' && t.mode !== themeModeFilter) return false
                return true
              })
              const activeTheme = getThemeById(themeId)
              const categoryCounts = {
                all: APP_THEMES.length,
                classic: APP_THEMES.filter((t) => t.category === 'classic').length,
                colorful: APP_THEMES.filter((t) => t.category === 'colorful').length,
                exotic: APP_THEMES.filter((t) => t.category === 'exotic').length
              }

              return (
              <>
                {/* Theme Selector Section */}
                <div className="space-y-3 p-4 rounded-lg border border-[var(--app-border)] bg-[var(--app-bg-secondary)]">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <h4 className="text-[13px] font-semibold text-[var(--app-text-primary)]">
                        Tema de la interfaz
                      </h4>
                      <p className="text-xs mt-0.5 text-[var(--app-text-muted)]">
                        Elige entre paletas clásicas, vibrantes o temas exóticos que transforman la UI.
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => {
                          const nextId = getRandomThemeId(themeId)
                          onThemeChange?.(nextId)
                          toast.info(`Tema aplicado: ${getThemeById(nextId).name}`)
                        }}
                        className="inline-flex items-center gap-1.5 text-[11px] font-medium px-2.5 py-1 rounded-md bg-[var(--app-bg-primary)] border border-[var(--app-border)] text-[var(--app-text-secondary)] hover:text-[var(--app-text-primary)] hover:border-[var(--app-border-strong)] hover:bg-[var(--app-hover)] transition cursor-pointer"
                        title="Probar un tema aleatorio"
                      >
                        <Shuffle size={13} weight="bold" />
                        <span>Sorpréndeme</span>
                      </button>
                      <span className="text-xs font-medium px-2.5 py-1 rounded-md bg-[var(--app-bg-primary)] border border-[var(--app-border)] text-[var(--app-text-primary)]">
                        {activeTheme.name}
                      </span>
                    </div>
                  </div>

                  {/* Category & Mode Filters */}
                  <div className="flex flex-wrap items-center justify-between gap-2 pt-0.5">
                    <div className="inline-flex flex-wrap items-center gap-1 bg-[var(--app-bg-primary)]/70 p-1 rounded-lg border border-[var(--app-border)]">
                      {(
                        [
                          { id: 'all', label: 'Todos', count: categoryCounts.all },
                          { id: 'classic', label: 'Clásicos', count: categoryCounts.classic },
                          { id: 'colorful', label: 'Colores', count: categoryCounts.colorful },
                          { id: 'exotic', label: 'Exóticos', count: categoryCounts.exotic, icon: true }
                        ] as const
                      ).map((cat) => {
                        const active = themeCategoryFilter === cat.id
                        return (
                          <button
                            key={cat.id}
                            type="button"
                            aria-pressed={active}
                            onClick={() => setThemeCategoryFilter(cat.id)}
                            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-medium transition cursor-pointer ${
                              active
                                ? 'bg-[var(--app-accent)] text-white shadow-xs'
                                : 'text-[var(--app-text-secondary)] hover:text-[var(--app-text-primary)] hover:bg-[var(--app-hover)]'
                            }`}
                          >
                            {'icon' in cat && cat.icon && <Sparkle size={11} weight="fill" />}
                            <span>{cat.label}</span>
                            <span className={`text-[10px] ${active ? 'opacity-85' : 'opacity-60'}`}>
                              {cat.count}
                            </span>
                          </button>
                        )
                      })}
                    </div>

                    <div className="inline-flex items-center gap-0.5 bg-[var(--app-bg-primary)]/70 p-1 rounded-lg border border-[var(--app-border)]">
                      {(
                        [
                          { id: 'all', label: 'Todos' },
                          { id: 'dark', label: 'Oscuro' },
                          { id: 'light', label: 'Claro' }
                        ] as const
                      ).map((m) => {
                        const active = themeModeFilter === m.id
                        return (
                          <button
                            key={m.id}
                            type="button"
                            aria-pressed={active}
                            onClick={() => setThemeModeFilter(m.id)}
                            className={`px-2 py-1 rounded-md text-[11px] font-medium transition cursor-pointer ${
                              active
                                ? 'bg-[var(--app-bg-secondary)] text-[var(--app-text-primary)] border border-[var(--app-border-strong)]'
                                : 'text-[var(--app-text-muted)] hover:text-[var(--app-text-primary)]'
                            }`}
                          >
                            {m.label}
                          </button>
                        )
                      })}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 pt-1">
                    {filteredThemes.map((theme) => {
                      const isSelected = themeId === theme.id
                      const isExotic = theme.category === 'exotic'
                      const previewRadius =
                        theme.fx === 'cyberpunk' || theme.fx === 'matrix' || theme.fx === 'blueprint'
                          ? 'rounded-[3px]'
                          : 'rounded-md'
                      return (
                        <button
                          key={theme.id}
                          type="button"
                          aria-pressed={isSelected}
                          onClick={() => onThemeChange?.(theme.id)}
                          className={`group p-2.5 rounded-lg border text-left transition cursor-pointer flex flex-col gap-2 ${
                            isSelected
                              ? 'border-[var(--app-accent)] bg-[var(--app-bg-primary)] ring-1 ring-[var(--app-accent)]/40'
                              : 'border-[var(--app-border)] bg-[var(--app-bg-primary)]/70 hover:bg-[var(--app-hover)] hover:border-[var(--app-border-strong)]'
                          }`}
                        >
                          {/* Mini app layout preview */}
                          <div
                            className={`relative w-full h-14 ${previewRadius} overflow-hidden border flex`}
                            style={{
                              backgroundColor: theme.swatches.editor,
                              borderColor:
                                theme.fx === 'cyberpunk'
                                  ? 'rgba(0, 240, 255, 0.5)'
                                  : theme.fx === 'matrix'
                                  ? 'rgba(0, 255, 102, 0.45)'
                                  : theme.fx === 'art-deco'
                                  ? 'rgba(212, 175, 55, 0.5)'
                                  : theme.fx === 'blueprint'
                                  ? 'rgba(125, 211, 252, 0.45)'
                                  : theme.mode === 'dark'
                                  ? 'rgba(255,255,255,0.1)'
                                  : 'rgba(0,0,0,0.1)',
                              boxShadow:
                                theme.fx === 'cyberpunk'
                                  ? '0 0 10px rgba(0,240,255,0.18)'
                                  : theme.fx === 'synthwave'
                                  ? '0 0 10px rgba(255,79,216,0.22)'
                                  : undefined
                            }}
                          >
                            {/* Exotic mini visual hints */}
                            {theme.fx === 'aurora' && (
                              <div
                                className="pointer-events-none absolute inset-0 opacity-45"
                                style={{
                                  background:
                                    'radial-gradient(circle at 75% 20%, rgba(45,212,191,0.55), transparent 55%), radial-gradient(circle at 35% 90%, rgba(167,139,250,0.5), transparent 55%)'
                                }}
                              />
                            )}
                            {theme.fx === 'blueprint' && (
                              <div
                                className="pointer-events-none absolute inset-0 opacity-35"
                                style={{
                                  backgroundImage:
                                    'linear-gradient(to right, rgba(125,211,252,0.35) 1px, transparent 1px), linear-gradient(to bottom, rgba(125,211,252,0.35) 1px, transparent 1px)',
                                  backgroundSize: '8px 8px'
                                }}
                              />
                            )}
                            {theme.fx === 'synthwave' && (
                              <div
                                className="pointer-events-none absolute inset-x-0 bottom-0 h-3 opacity-60"
                                style={{
                                  background:
                                    'linear-gradient(180deg, transparent, rgba(255,79,216,0.55))'
                                }}
                              />
                            )}
                            {theme.fx === 'cyberpunk' && (
                              <div
                                className="pointer-events-none absolute inset-0 opacity-20"
                                style={{
                                  backgroundImage:
                                    'repeating-linear-gradient(0deg, rgba(0,240,255,0.5) 0px, rgba(0,240,255,0.5) 1px, transparent 1px, transparent 3px)'
                                }}
                              />
                            )}
                            {theme.fx === 'art-deco' && (
                              <div className="pointer-events-none absolute inset-1 border border-[#d4af37]/35" />
                            )}
                            {theme.fx === 'zen-petals' && (
                              <>
                                <span className="pointer-events-none absolute top-1.5 right-2 w-1.5 h-1.5 rounded-full bg-[#f472b6]/80" />
                                <span className="pointer-events-none absolute bottom-2 right-4 w-1 h-1 rounded-full bg-[#e11d64]/70" />
                              </>
                            )}

                            <div
                              className="w-3 h-full shrink-0 flex flex-col items-center justify-start pt-1.5 gap-1 relative z-10"
                              style={{ backgroundColor: theme.swatches.ribbon }}
                            >
                              <span
                                className="w-1.5 h-1.5 rounded-full"
                                style={{ backgroundColor: theme.swatches.accent }}
                              />
                              {theme.swatches.secondary && (
                                <span
                                  className="w-1.5 h-1.5 rounded-full opacity-90"
                                  style={{ backgroundColor: theme.swatches.secondary }}
                                />
                              )}
                            </div>
                            <div
                              className="w-7 h-full shrink-0 p-1 flex flex-col gap-1 relative z-10"
                              style={{ backgroundColor: theme.swatches.sidebar }}
                            >
                              <span
                                className="h-1 w-full rounded-full opacity-35"
                                style={{ backgroundColor: theme.swatches.text }}
                              />
                              <span
                                className="h-1 w-3/4 rounded-full opacity-20"
                                style={{ backgroundColor: theme.swatches.text }}
                              />
                              <span
                                className="mt-auto h-1 w-4/5 rounded-full opacity-70"
                                style={{ backgroundColor: theme.swatches.accent }}
                              />
                            </div>
                            <div className="flex-1 p-1.5 flex flex-col gap-1 relative z-10">
                              <span
                                className="h-1.5 w-2/3 rounded-full opacity-85"
                                style={{ backgroundColor: theme.swatches.text }}
                              />
                              <span
                                className="h-1 w-full rounded-full opacity-30"
                                style={{ backgroundColor: theme.swatches.text }}
                              />
                              <span
                                className="h-1 w-4/5 rounded-full opacity-20"
                                style={{ backgroundColor: theme.swatches.text }}
                              />
                            </div>
                          </div>

                          <div className="space-y-0.5 px-0.5">
                            <div className="flex items-center justify-between gap-1">
                              <span className="text-xs font-semibold text-[var(--app-text-primary)] truncate">
                                {theme.name}
                              </span>
                              {isExotic && theme.badge ? (
                                <span className="text-[9px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded bg-[var(--app-accent-soft)] text-[var(--app-accent)] shrink-0">
                                  {theme.badge}
                                </span>
                              ) : (
                                <span className="text-[10px] uppercase tracking-wider text-[var(--app-text-muted)] shrink-0">
                                  {theme.mode === 'dark' ? 'Oscuro' : 'Claro'}
                                </span>
                              )}
                            </div>
                            <p className="text-[10.5px] text-[var(--app-text-muted)] truncate">
                              {theme.features ? theme.features.join(' · ') : theme.description}
                            </p>
                          </div>
                        </button>
                      )
                    })}
                  </div>
                </div>

                {/* Exotic Visual Effects & Custom Accent Section */}
                <div className="space-y-4 p-4 rounded-lg border border-[var(--app-border)] bg-[var(--app-bg-secondary)]">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <Sparkle size={14} weight="fill" className="text-[var(--app-accent)] shrink-0" />
                        <h4 className="text-[13px] font-semibold text-[var(--app-text-primary)]">
                          Efectos visuales de temas exóticos
                        </h4>
                      </div>
                      <p className="text-xs mt-0.5 text-[var(--app-text-muted)]">
                        Activa capas ambientales sutiles (scanlines, grilla láser, pétalos, auroras, miras CAD y filigranas).
                      </p>
                    </div>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={themeEffectsEnabled}
                      aria-label="Activar efectos visuales de temas exóticos"
                      onClick={() => {
                        const next = !themeEffectsEnabled
                        setThemeEffectsEnabled(next)
                        setThemeEffectsEnabledState(next)
                        applyAppTheme(themeId)
                      }}
                      className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full border transition cursor-pointer ${
                        themeEffectsEnabled
                          ? 'bg-[var(--app-accent)] border-[var(--app-accent)]'
                          : 'bg-[var(--app-bg-primary)] border-[var(--app-border-strong)]'
                      }`}
                    >
                      <span
                        className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition ${
                          themeEffectsEnabled ? 'translate-x-4' : 'translate-x-0.5'
                        }`}
                      />
                    </button>
                  </div>

                  <div className="border-t border-[var(--app-divider)] pt-3 space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <h5 className="text-xs font-semibold text-[var(--app-text-primary)]">
                          Acento personalizado
                        </h5>
                        <p className="text-[11px] text-[var(--app-text-muted)]">
                          Sobrescribe el color principal de botones, foco y pestañas activas.
                        </p>
                      </div>
                      {customAccentId && (
                        <button
                          type="button"
                          onClick={() => {
                            setCustomAccentId(null)
                            setCustomAccentIdState(null)
                            applyAppTheme(themeId)
                          }}
                          className="text-[11px] text-[var(--app-accent)] hover:underline cursor-pointer shrink-0"
                        >
                          Usar del tema
                        </button>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-2 pt-0.5">
                      <button
                        type="button"
                        aria-pressed={customAccentId === null}
                        onClick={() => {
                          setCustomAccentId(null)
                          setCustomAccentIdState(null)
                          applyAppTheme(themeId)
                        }}
                        className={`inline-flex items-center gap-1.5 h-7 px-2.5 rounded-full border text-[11px] font-medium transition cursor-pointer ${
                          customAccentId === null
                            ? 'border-[var(--app-accent)] bg-[var(--app-bg-primary)] text-[var(--app-text-primary)] ring-1 ring-[var(--app-accent)]/40'
                            : 'border-[var(--app-border)] bg-[var(--app-bg-primary)]/70 text-[var(--app-text-secondary)] hover:bg-[var(--app-hover)]'
                        }`}
                        title="Usar el color de acento original del tema"
                      >
                        <span
                          className="w-3 h-3 rounded-full border border-white/20"
                          style={{ backgroundColor: activeTheme.swatches.accent }}
                        />
                        <span>Del tema</span>
                      </button>

                      {ACCENT_PRESETS.map((preset) => {
                        const isPresetActive = customAccentId === preset.id
                        return (
                          <button
                            key={preset.id}
                            type="button"
                            aria-label={`Acento ${preset.name}`}
                            aria-pressed={isPresetActive}
                            onClick={() => {
                              setCustomAccentId(preset.id)
                              setCustomAccentIdState(preset.id)
                              applyAppTheme(themeId)
                            }}
                            title={preset.name}
                            className={`w-7 h-7 rounded-full flex items-center justify-center border transition cursor-pointer ${
                              isPresetActive
                                ? 'scale-110 ring-2 ring-offset-2 ring-offset-[var(--app-bg-secondary)] ring-[var(--app-text-primary)] border-white/60'
                                : 'border-white/20 hover:scale-105'
                            }`}
                            style={{ backgroundColor: preset.color }}
                          >
                            {isPresetActive && <Check size={13} weight="bold" className="text-white drop-shadow" />}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                </div>

                {/* UI Scale / Zoom Section */}
                <div className="space-y-3 p-4 rounded-lg border border-[var(--app-border)] bg-[var(--app-bg-secondary)]">
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <h4 className="text-[13px] font-semibold text-[var(--app-text-primary)]">
                        Tamaño y escala de la interfaz
                      </h4>
                      <p className="text-xs mt-0.5 text-[var(--app-text-muted)]">
                        Ajusta el tamaño global de botones, textos e iconos.
                      </p>
                    </div>
                    <span className="text-xs font-mono font-medium px-2.5 py-1 rounded-md bg-[var(--app-bg-primary)] border border-[var(--app-border)] text-[var(--app-text-primary)] shrink-0">
                      {uiScale}%
                    </span>
                  </div>

                  <div className="grid grid-cols-5 gap-2 pt-1">
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
                          aria-pressed={isSelected}
                          onClick={() => onUiScaleChange?.(opt.value)}
                          className={`py-2.5 px-2 rounded-md border text-center transition-colors flex flex-col items-center justify-center gap-0.5 cursor-pointer ${
                            isSelected
                              ? 'border-[var(--app-accent)] bg-[var(--app-bg-primary)] text-[var(--app-text-primary)] ring-1 ring-[var(--app-accent)]/40 font-semibold'
                              : 'border-[var(--app-border)] bg-[var(--app-bg-primary)]/70 text-[var(--app-text-secondary)] hover:bg-[var(--app-hover)] hover:text-[var(--app-text-primary)]'
                          }`}
                        >
                          <span className="text-xs font-semibold">{opt.label}</span>
                          <span className="text-[10px] opacity-75">{opt.sub}</span>
                        </button>
                      )
                    })}
                  </div>

                  <div className="flex items-center justify-between pt-1 text-xs text-[var(--app-text-muted)]">
                    <span>Atajo rápido de escala</span>
                    <span className="font-mono text-[11px] bg-[var(--app-bg-primary)] px-2 py-0.5 rounded border border-[var(--app-border)] text-[var(--app-text-secondary)]">
                      Ctrl + / Ctrl - / Ctrl 0
                    </span>
                  </div>
                </div>
              </>
              )
            })()}

            {/* TAB 2: EDITOR Y ESCRITURA */}
            {activeSection === 'editor' && (
              <div className="space-y-4">
                {/* Typography & Live Preview */}
                <div className="space-y-4 p-4 rounded-lg border border-[var(--app-border)] bg-[var(--app-bg-secondary)]">
                  <div>
                    <h4 className="text-[13px] font-semibold text-[var(--app-text-primary)]">
                      Tipografía y lectura
                    </h4>
                    <p className="text-xs mt-0.5 text-[var(--app-text-muted)]">
                      Se aplica al cuerpo del editor de notas sin alterar el tamaño de los botones.
                    </p>
                  </div>

                  {/* Font family */}
                  <div className="grid grid-cols-3 gap-2">
                    {(
                      [
                        { id: 'sans', label: 'Sans', sample: 'Aa', font: 'var(--app-font-sans)' },
                        { id: 'serif', label: 'Serif', sample: 'Aa', font: 'var(--app-font-serif)' },
                        { id: 'mono', label: 'Mono', sample: 'Aa', font: 'var(--app-font-mono)' }
                      ] as const
                    ).map((f) => {
                      const active = editorPrefs.editorFont === f.id
                      return (
                        <button
                          key={f.id}
                          type="button"
                          aria-pressed={active}
                          onClick={() => setEditorPrefs(updateEditorPreferences({ editorFont: f.id }))}
                          className={`p-2.5 rounded-md border text-center transition cursor-pointer flex flex-col items-center gap-0.5 ${
                            active
                              ? 'border-[var(--app-accent)] bg-[var(--app-bg-primary)] ring-1 ring-[var(--app-accent)]/40 text-[var(--app-text-primary)]'
                              : 'border-[var(--app-border)] bg-[var(--app-bg-primary)]/70 text-[var(--app-text-secondary)] hover:bg-[var(--app-hover)]'
                          }`}
                        >
                          <span className="text-base font-semibold" style={{ fontFamily: f.font }}>
                            {f.sample}
                          </span>
                          <span className="text-[11px] font-medium">{f.label}</span>
                        </button>
                      )
                    })}
                  </div>

                  {/* Font size & Line height */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                    <div className="space-y-1.5">
                      <span className="block text-[11px] font-medium text-[var(--app-text-secondary)]">
                        Tamaño de fuente
                      </span>
                      <div className="grid grid-cols-4 gap-1.5">
                        {(['14', '15', '16', '18'] as const).map((size) => {
                          const active = editorPrefs.editorFontSize === size
                          return (
                            <button
                              key={size}
                              type="button"
                              aria-pressed={active}
                              onClick={() =>
                                setEditorPrefs(updateEditorPreferences({ editorFontSize: size }))
                              }
                              className={`h-8 rounded-md border text-xs font-medium transition cursor-pointer ${
                                active
                                  ? 'border-[var(--app-accent)] bg-[var(--app-bg-primary)] text-[var(--app-text-primary)] font-semibold'
                                  : 'border-[var(--app-border)] bg-[var(--app-bg-primary)]/70 text-[var(--app-text-secondary)] hover:bg-[var(--app-hover)]'
                              }`}
                            >
                              {size}px
                            </button>
                          )
                        })}
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <span className="block text-[11px] font-medium text-[var(--app-text-secondary)]">
                        Interlineado
                      </span>
                      <div className="grid grid-cols-3 gap-1.5">
                        {(
                          [
                            { id: 'compact', label: 'Compacto' },
                            { id: 'comfortable', label: 'Cómodo' },
                            { id: 'relaxed', label: 'Amplio' }
                          ] as const
                        ).map((lh) => {
                          const active = editorPrefs.editorLineHeight === lh.id
                          return (
                            <button
                              key={lh.id}
                              type="button"
                              aria-pressed={active}
                              onClick={() =>
                                setEditorPrefs(updateEditorPreferences({ editorLineHeight: lh.id }))
                              }
                              className={`h-8 rounded-md border text-xs font-medium transition cursor-pointer ${
                                active
                                  ? 'border-[var(--app-accent)] bg-[var(--app-bg-primary)] text-[var(--app-text-primary)] font-semibold'
                                  : 'border-[var(--app-border)] bg-[var(--app-bg-primary)]/70 text-[var(--app-text-secondary)] hover:bg-[var(--app-hover)]'
                              }`}
                            >
                              {lh.label}
                            </button>
                          )
                        })}
                      </div>
                    </div>
                  </div>

                  {/* Live text sample */}
                  <div
                    className="p-3.5 rounded-md border border-[var(--app-border)] bg-[var(--app-bg-primary)] text-[var(--app-text-primary)]"
                    style={{
                      fontFamily: 'var(--sn-editor-font, var(--app-font-sans))',
                      fontSize: 'var(--sn-editor-font-size, 15px)',
                      lineHeight: 'var(--sn-editor-line-height, 1.65)'
                    }}
                  >
                    Las ideas claras nacen en espacios tranquilos. Así se verá el cuerpo de tus notas en Seven Note.
                  </div>
                </div>

                {/* New Note Defaults & Privacy */}
                <div className="space-y-3 p-4 rounded-lg border border-[var(--app-border)] bg-[var(--app-bg-secondary)]">
                  <div>
                    <h4 className="text-[13px] font-semibold text-[var(--app-text-primary)]">
                      Valores por defecto en notas nuevas
                    </h4>
                    <p className="text-xs mt-0.5 text-[var(--app-text-muted)]">
                      Define cómo se crea cada nueva nota cuando pulsas <span className="font-mono">+</span> o <span className="font-mono">Ctrl+N</span>.
                    </p>
                  </div>

                  <div className="divide-y divide-[var(--app-divider)] rounded-md border border-[var(--app-border)] bg-[var(--app-bg-primary)]">
                    {/* Default View Mode */}
                    <div className="flex items-center justify-between gap-3 px-3.5 py-2.5">
                      <div>
                        <div className="text-xs font-medium text-[var(--app-text-primary)]">
                          Vista inicial
                        </div>
                        <div className="text-[11px] text-[var(--app-text-muted)]">
                          Abrir nuevas páginas en documento o en lienzo espacial
                        </div>
                      </div>
                      <div className="inline-flex rounded-md border border-[var(--app-border)] bg-[var(--app-bg-secondary)] p-0.5 shrink-0">
                        {(
                          [
                            { id: 'doc', label: 'Nota' },
                            { id: 'canvas', label: 'Lienzo' }
                          ] as const
                        ).map((mode) => (
                          <button
                            key={mode.id}
                            type="button"
                            onClick={() =>
                              setEditorPrefs(updateEditorPreferences({ defaultViewMode: mode.id }))
                            }
                            className={`px-2.5 py-1 rounded text-xs font-medium transition cursor-pointer ${
                              editorPrefs.defaultViewMode === mode.id
                                ? 'bg-[var(--app-bg-primary)] text-[var(--app-text-primary)] shadow-xs'
                                : 'text-[var(--app-text-muted)] hover:text-[var(--app-text-primary)]'
                            }`}
                          >
                            {mode.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Default Page Width */}
                    <div className="flex items-center justify-between gap-3 px-3.5 py-2.5">
                      <div>
                        <div className="text-xs font-medium text-[var(--app-text-primary)]">
                          Ancho de página por defecto
                        </div>
                        <div className="text-[11px] text-[var(--app-text-muted)]">
                          Columna centrada de lectura o ancho completo
                        </div>
                      </div>
                      <div className="inline-flex rounded-md border border-[var(--app-border)] bg-[var(--app-bg-secondary)] p-0.5 shrink-0">
                        {(
                          [
                            { id: 'standard', label: 'Estándar' },
                            { id: 'full', label: 'Completo' }
                          ] as const
                        ).map((w) => (
                          <button
                            key={w.id}
                            type="button"
                            onClick={() =>
                              setEditorPrefs(updateEditorPreferences({ defaultPageWidth: w.id }))
                            }
                            className={`px-2.5 py-1 rounded text-xs font-medium transition cursor-pointer ${
                              editorPrefs.defaultPageWidth === w.id
                                ? 'bg-[var(--app-bg-primary)] text-[var(--app-text-primary)] shadow-xs'
                                : 'text-[var(--app-text-muted)] hover:text-[var(--app-text-primary)]'
                            }`}
                          >
                            {w.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Default Privacy */}
                    <div className="flex items-center justify-between gap-3 px-3.5 py-2.5">
                      <div>
                        <div className="text-xs font-medium text-[var(--app-text-primary)]">
                          Crear notas como Privadas por defecto
                        </div>
                        <div className="text-[11px] text-[var(--app-text-muted)]">
                          Útil para borradores personales antes de compartir con el equipo
                        </div>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer shrink-0">
                        <input
                          type="checkbox"
                          checked={editorPrefs.defaultPrivate}
                          onChange={(e) =>
                            setEditorPrefs(
                              updateEditorPreferences({ defaultPrivate: e.target.checked })
                            )
                          }
                          className="sr-only peer"
                        />
                        <span className="w-9 h-5 bg-[var(--app-border-strong)] rounded-full peer peer-checked:after:translate-x-4 after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[var(--app-accent)]" />
                      </label>
                    </div>

                    {/* Spellcheck */}
                    <div className="flex items-center justify-between gap-3 px-3.5 py-2.5">
                      <div>
                        <div className="text-xs font-medium text-[var(--app-text-primary)]">
                          Corrector ortográfico
                        </div>
                        <div className="text-[11px] text-[var(--app-text-muted)]">
                          Subraya posibles errores de ortografía al escribir
                        </div>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer shrink-0">
                        <input
                          type="checkbox"
                          checked={editorPrefs.spellCheck}
                          onChange={(e) =>
                            setEditorPrefs(updateEditorPreferences({ spellCheck: e.target.checked }))
                          }
                          className="sr-only peer"
                        />
                        <span className="w-9 h-5 bg-[var(--app-border-strong)] rounded-full peer peer-checked:after:translate-x-4 after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[var(--app-accent)]" />
                      </label>
                    </div>

                    {/* Reduce Motion */}
                    <div className="flex items-center justify-between gap-3 px-3.5 py-2.5">
                      <div>
                        <div className="text-xs font-medium text-[var(--app-text-primary)]">
                          Reducir animaciones
                        </div>
                        <div className="text-[11px] text-[var(--app-text-muted)]">
                          Desactiva transiciones y efectos de movimiento en la interfaz
                        </div>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer shrink-0">
                        <input
                          type="checkbox"
                          checked={editorPrefs.reduceMotion}
                          onChange={(e) =>
                            setEditorPrefs(
                              updateEditorPreferences({ reduceMotion: e.target.checked })
                            )
                          }
                          className="sr-only peer"
                        />
                        <span className="w-9 h-5 bg-[var(--app-border-strong)] rounded-full peer peer-checked:after:translate-x-4 after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[var(--app-accent)]" />
                      </label>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 3: NOTIFICACIONES */}
            {activeSection === 'notifications' && (
              <div className="space-y-4">
                <div className="space-y-3 p-4 rounded-lg border border-[var(--app-border)] bg-[var(--app-bg-secondary)]">
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <h4 className="text-[13px] font-semibold text-[var(--app-text-primary)]">
                        Preferencias generales
                      </h4>
                      <p className="text-xs mt-0.5 text-[var(--app-text-muted)]">
                        Elige cómo recibir avisos en la aplicación.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => void notificationService.sendTestNotification()}
                      className="h-8 px-3 rounded-md border border-[var(--app-border-strong)] bg-[var(--app-bg-primary)] hover:bg-[var(--app-hover)] text-xs font-medium text-[var(--app-text-primary)] transition cursor-pointer shrink-0"
                    >
                      Probar alerta
                    </button>
                  </div>

                  <div className="divide-y divide-[var(--app-divider)] rounded-md border border-[var(--app-border)] bg-[var(--app-bg-primary)]">
                    {[
                      {
                        key: 'toastsEnabled' as const,
                        label: 'Avisos flotantes (Toasts)',
                        desc: 'Muestra confirmaciones breves en la esquina inferior.',
                        value: notifPrefs.toastsEnabled
                      },
                      {
                        key: 'soundEnabled' as const,
                        label: 'Sonido sutil de alerta',
                        desc: 'Reproduce un tono suave al recibir notificaciones.',
                        value: notifPrefs.soundEnabled
                      },
                      {
                        key: 'dndEnabled' as const,
                        label: 'Modo No Molestar',
                        desc: 'Pausa todos los avisos visuales y de sonido.',
                        value: notifPrefs.dndEnabled
                      },
                      {
                        key: 'quietHoursEnabled' as const,
                        label: 'Horario silencioso automático',
                        desc: 'Silencia notificaciones durante un rango horario.',
                        value: notifPrefs.quietHoursEnabled
                      }
                    ].map((item) => (
                      <label
                        key={item.key}
                        className="flex items-center justify-between gap-3 px-3.5 py-2.5 cursor-pointer hover:bg-[var(--app-hover)]/60 transition"
                      >
                        <div className="min-w-0">
                          <div className="text-xs font-medium text-[var(--app-text-primary)]">
                            {item.label}
                          </div>
                          <div className="text-[11px] text-[var(--app-text-muted)]">
                            {item.desc}
                          </div>
                        </div>
                        <span className="relative inline-flex items-center shrink-0">
                          <input
                            type="checkbox"
                            checked={item.value}
                            onChange={(e) =>
                              notificationService.updatePreferences({ [item.key]: e.target.checked })
                            }
                            className="sr-only peer"
                          />
                          <span className="w-9 h-5 bg-[var(--app-border-strong)] rounded-full peer peer-checked:after:translate-x-4 after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[var(--app-accent)]" />
                        </span>
                      </label>
                    ))}
                  </div>

                  {notifPrefs.quietHoursEnabled && (
                    <div className="flex items-center justify-between gap-3 px-3.5 py-2.5 rounded-md border border-[var(--app-border)] bg-[var(--app-bg-primary)]">
                      <span className="text-xs text-[var(--app-text-secondary)] font-medium">
                        Rango silencioso
                      </span>
                      <div className="flex items-center gap-2">
                        <input
                          type="time"
                          value={notifPrefs.quietHoursStart}
                          onChange={(e) =>
                            notificationService.updatePreferences({ quietHoursStart: e.target.value })
                          }
                          className="px-2 py-1 text-xs rounded-md border border-[var(--app-border-strong)] bg-[var(--app-bg-secondary)] text-[var(--app-text-primary)]"
                        />
                        <span className="text-[var(--app-text-muted)]">a</span>
                        <input
                          type="time"
                          value={notifPrefs.quietHoursEnd}
                          onChange={(e) =>
                            notificationService.updatePreferences({ quietHoursEnd: e.target.value })
                          }
                          className="px-2 py-1 text-xs rounded-md border border-[var(--app-border-strong)] bg-[var(--app-bg-secondary)] text-[var(--app-text-primary)]"
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* Desktop & Web Push */}
                <div className="space-y-2.5 p-4 rounded-lg border border-[var(--app-border)] bg-[var(--app-bg-secondary)]">
                  <h4 className="text-[13px] font-semibold text-[var(--app-text-primary)]">
                    Sistema y segundo plano
                  </h4>

                  <div className="flex items-center justify-between gap-3 px-3.5 py-2.5 rounded-md border border-[var(--app-border)] bg-[var(--app-bg-primary)]">
                    <div>
                      <div className="text-xs font-medium text-[var(--app-text-primary)]">
                        Notificaciones de escritorio / sistema
                      </div>
                      <div className="text-[11px] text-[var(--app-text-muted)]">
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
                      <label className="relative inline-flex items-center cursor-pointer shrink-0">
                        <input
                          type="checkbox"
                          checked={notifPrefs.desktopEnabled}
                          onChange={(e) =>
                            notificationService.updatePreferences({ desktopEnabled: e.target.checked })
                          }
                          className="sr-only peer"
                        />
                        <span className="w-9 h-5 bg-[var(--app-border-strong)] rounded-full peer peer-checked:after:translate-x-4 after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[var(--app-accent)]" />
                      </label>
                    ) : desktopPerm === 'default' ? (
                      <button
                        type="button"
                        onClick={async () => {
                          const res = await notificationService.requestDesktopPermission()
                          setDesktopPerm(res)
                        }}
                        className="h-8 px-3 rounded-md text-xs font-medium bg-[var(--app-bg-secondary)] hover:bg-[var(--app-hover-filled)] text-[var(--app-text-primary)] border border-[var(--app-border-strong)] transition cursor-pointer"
                      >
                        Activar
                      </button>
                    ) : null}
                  </div>

                  {webPushStatus?.supported && (
                    <div className="space-y-2 px-3.5 py-2.5 rounded-md border border-[var(--app-border)] bg-[var(--app-bg-primary)]">
                      <div className="flex items-center justify-between gap-2">
                        <div>
                          <div className="text-xs font-medium text-[var(--app-text-primary)]">
                            Push en segundo plano (web cerrada)
                          </div>
                          <div className="text-[11px] text-[var(--app-text-muted)]">
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
                          className={`h-8 px-3 rounded-md text-xs font-medium border transition cursor-pointer disabled:opacity-50 ${
                            webPushStatus.subscribed
                              ? 'border-rose-500/30 bg-rose-500/10 text-rose-500 hover:bg-rose-500/20'
                              : 'border-[var(--app-border-strong)] bg-[var(--app-bg-secondary)] hover:bg-[var(--app-hover-filled)] text-[var(--app-text-primary)]'
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
                        <input
                          type="text"
                          value={vapidInput}
                          onChange={(e) => {
                            setVapidInput(e.target.value)
                            saveVapidPublicKey(e.target.value)
                          }}
                          placeholder="Clave pública VAPID (ej. BEl62iUYg...)"
                          className="w-full px-2.5 py-1.5 text-xs rounded-md border border-[var(--app-border-strong)] bg-[var(--app-bg-secondary)] text-[var(--app-text-primary)] placeholder:text-[var(--app-text-muted)] font-mono"
                        />
                      )}
                    </div>
                  )}
                </div>

                {/* Category Filters */}
                <div className="space-y-2.5 p-4 rounded-lg border border-[var(--app-border)] bg-[var(--app-bg-secondary)]">
                  <h4 className="text-[13px] font-semibold text-[var(--app-text-primary)]">
                    Categorías activas
                  </h4>
                  <div className="flex flex-wrap items-center gap-2">
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
                          aria-pressed={active}
                          onClick={() =>
                            notificationService.updatePreferences({
                              categories: { ...notifPrefs.categories, [cat.id]: !active }
                            })
                          }
                          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium border transition cursor-pointer ${
                            active
                              ? 'border-[var(--app-border-strong)] bg-[var(--app-active)] text-[var(--app-text-primary)]'
                              : 'border-[var(--app-border)] bg-[var(--app-bg-primary)] text-[var(--app-text-muted)] hover:text-[var(--app-text-primary)]'
                          }`}
                        >
                          {active && <Check size={13} weight="bold" className="text-[var(--app-accent)]" />}
                          <span>{cat.label}</span>
                        </button>
                      )
                    })}
                  </div>
                </div>
              </div>
            )}

            {/* TAB 3: SINCRONIZACIÓN */}
            {activeSection === 'sync' && (
              <div className="space-y-4">
                {/* Live Sync Status Card */}
                <div className="p-4 rounded-lg border border-[var(--app-border)] bg-[var(--app-bg-secondary)] flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-9 h-9 rounded-md flex items-center justify-center bg-[var(--app-bg-primary)] border border-[var(--app-border)] shrink-0">
                      <CloudWorkspaceIcon style={{ width: 18, height: 18, color: 'var(--app-text-secondary)' }} />
                    </div>
                    <div className="min-w-0">
                      <div className="text-[13px] font-semibold text-[var(--app-text-primary)]">
                        Estado de sincronización
                      </div>
                      <div className="text-xs text-[var(--app-text-muted)] truncate">
                        {syncStatus.pendingCount === 0
                          ? 'Todo sincronizado con la nube'
                          : `${syncStatus.pendingCount} cambios pendientes en almacenamiento local`}
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={handleManualSync}
                    disabled={manualSyncing || !enabled}
                    className="h-8 px-3 rounded-md text-xs font-medium border border-[var(--app-border-strong)] bg-[var(--app-bg-primary)] hover:bg-[var(--app-hover)] text-[var(--app-text-primary)] transition-colors flex items-center gap-1.5 disabled:opacity-50 cursor-pointer shrink-0"
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

                {/* Supabase Settings Card */}
                <div className="space-y-4 p-4 rounded-lg border border-[var(--app-border)] bg-[var(--app-bg-secondary)]">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <h4 className="text-[13px] font-semibold text-[var(--app-text-primary)]">
                        Respaldo automático (Supabase)
                      </h4>
                      <p className="text-xs text-[var(--app-text-muted)] mt-0.5">
                        Seven Note funciona 100% offline; activa Supabase para sincronizar entre dispositivos.
                      </p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer shrink-0">
                      <input
                        type="checkbox"
                        checked={enabled}
                        onChange={(e) => setEnabled(e.target.checked)}
                        className="sr-only peer"
                      />
                      <div className="w-9 h-5 bg-[var(--app-border-strong)] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-4 after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[var(--app-accent)]" />
                    </label>
                  </div>

                  <div className="flex items-center justify-between gap-3 pt-2 border-t border-[var(--app-divider)]">
                    <div>
                      <label htmlFor="sync-interval-select" className="block text-xs font-medium text-[var(--app-text-primary)]">
                        Frecuencia de sincronización
                      </label>
                      <p className="text-[11px] text-[var(--app-text-muted)]">
                        Sincroniza en segundo plano cuando estés conectado
                      </p>
                    </div>
                    <select
                      id="sync-interval-select"
                      value={syncInterval}
                      onChange={(e) => setSyncInterval(Number(e.target.value))}
                      className="h-8 text-xs px-2.5 rounded-md border border-[var(--app-border-strong)] bg-[var(--app-bg-primary)] text-[var(--app-text-primary)] outline-none focus:border-[var(--app-accent)] cursor-pointer"
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
                          ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-300 border-emerald-500/25'
                          : 'bg-rose-500/10 text-rose-600 dark:text-rose-300 border-rose-500/25'
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

                  <div className="flex items-center justify-between pt-2 border-t border-[var(--app-divider)] gap-2 flex-wrap">
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={handleTest}
                        disabled={testing || !url || !anonKey}
                        className="h-8 px-3 rounded-md text-xs font-medium border border-[var(--app-border-strong)] bg-[var(--app-bg-primary)] hover:bg-[var(--app-hover)] text-[var(--app-text-primary)] transition-colors disabled:opacity-50 cursor-pointer"
                      >
                        {testing ? 'Probando...' : 'Probar conexión'}
                      </button>
                      <button
                        type="button"
                        onClick={copySqlSchema}
                        className="h-8 px-3 rounded-md text-xs font-medium border border-[var(--app-border-strong)] bg-[var(--app-bg-primary)] hover:bg-[var(--app-hover)] text-[var(--app-text-primary)] transition-colors flex items-center gap-1.5 cursor-pointer"
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
                      type="button"
                      onClick={handleSave}
                      className="h-8 px-4 rounded-md text-xs font-semibold text-white bg-[var(--app-accent)] hover:bg-[var(--app-accent-hover)] transition-colors cursor-pointer"
                    >
                      Guardar
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 4: CEREBRO IA (MCP) */}
            {activeSection === 'mcp' && (
              <div className="space-y-4 p-4 rounded-lg border border-[var(--app-border)] bg-[var(--app-bg-secondary)]">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h4 className="text-[13px] font-semibold text-[var(--app-text-primary)]">
                      Conexión Streamable HTTP
                    </h4>
                    <p className="text-xs text-[var(--app-text-muted)] mt-0.5">
                      Usa este endpoint y tu token para dar acceso seguro a agentes externos.
                    </p>
                  </div>
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-medium bg-[var(--app-bg-primary)] text-[var(--app-text-secondary)] border border-[var(--app-border-strong)] shrink-0">
                    <PlugsConnected size={13} />
                    Remoto
                  </span>
                </div>

                {/* Endpoint URL */}
                <div className="space-y-1.5">
                  <label htmlFor="mcp-endpoint-url" className="block text-xs font-medium text-[var(--app-text-secondary)]">
                    Endpoint MCP (URL)
                  </label>
                  <div className="flex gap-2">
                    <input
                      id="mcp-endpoint-url"
                      type="text"
                      value={mcpUrl}
                      onChange={(e) => handleMcpUrlChange(e.target.value)}
                      placeholder="https://note.sevenestudio.com/api/mcp"
                      className="flex-1 h-9 text-xs font-mono px-3 rounded-md border border-[var(--app-border-strong)] bg-[var(--app-bg-primary)] text-[var(--app-text-primary)] outline-none focus:border-[var(--app-accent)]"
                    />
                    <button
                      type="button"
                      onClick={() => void copyMcpSnippet('url')}
                      className="h-9 px-3 rounded-md text-xs font-medium border border-[var(--app-border-strong)] bg-[var(--app-bg-primary)] hover:bg-[var(--app-hover)] text-[var(--app-text-primary)] transition-colors flex items-center gap-1.5 cursor-pointer shrink-0"
                    >
                      {copiedMcpItem === 'url' ? (
                        <DoneIcon style={{ width: 14, height: 14, color: '#10b981' }} />
                      ) : (
                        <CopyIcon style={{ width: 14, height: 14 }} />
                      )}
                      <span>{copiedMcpItem === 'url' ? 'Copiada' : 'Copiar'}</span>
                    </button>
                  </div>
                </div>

                {/* Token MCP */}
                <div className="space-y-1.5">
                  <label htmlFor="mcp-api-token" className="block text-xs font-medium text-[var(--app-text-secondary)]">
                    Token de acceso (SEVEN_NOTE_MCP_API_KEY)
                  </label>
                  <div className="relative">
                    <input
                      id="mcp-api-token"
                      type={showMcpKey ? 'text' : 'password'}
                      value={mcpApiKey}
                      onChange={(e) => handleMcpKeyChange(e.target.value)}
                      placeholder="sn_mcp_... (se guarda solo en tu navegador)"
                      className="w-full h-9 text-xs font-mono pl-3 pr-9 rounded-md border border-[var(--app-border-strong)] bg-[var(--app-bg-primary)] text-[var(--app-text-primary)] outline-none focus:border-[var(--app-accent)]"
                    />
                    <button
                      type="button"
                      aria-label={showMcpKey ? 'Ocultar token' : 'Mostrar token'}
                      onClick={() => setShowMcpKey((v) => !v)}
                      title={showMcpKey ? 'Ocultar token' : 'Mostrar token'}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--app-text-muted)] hover:text-[var(--app-text-primary)] cursor-pointer"
                    >
                      {showMcpKey ? <EyeSlash size={15} /> : <Eye size={15} />}
                    </button>
                  </div>
                </div>

                {/* Permisos y alcance */}
                <div className="flex items-start gap-2.5 p-3 rounded-md bg-[var(--app-bg-primary)] border border-[var(--app-border)] text-xs text-[var(--app-text-muted)]">
                  <ShieldCheck size={16} weight="duotone" className="text-[var(--app-text-secondary)] shrink-0 mt-0.5" />
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
                        ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-300 border-emerald-500/25'
                        : 'bg-rose-500/10 text-rose-600 dark:text-rose-300 border-rose-500/25'
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
                <div className="flex items-center justify-between pt-2 border-t border-[var(--app-divider)] gap-2 flex-wrap">
                  <div className="flex gap-2 flex-wrap">
                    <button
                      type="button"
                      onClick={() => void copyMcpSnippet('json')}
                      className="h-8 px-3 rounded-md text-xs font-medium border border-[var(--app-border-strong)] bg-[var(--app-bg-primary)] hover:bg-[var(--app-hover)] text-[var(--app-text-primary)] transition-colors flex items-center gap-1.5 cursor-pointer"
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
                      className="h-8 px-3 rounded-md text-xs font-medium border border-[var(--app-border-strong)] bg-[var(--app-bg-primary)] hover:bg-[var(--app-hover)] text-[var(--app-text-primary)] transition-colors flex items-center gap-1.5 cursor-pointer"
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
                    className="h-8 px-4 rounded-md text-xs font-semibold text-white bg-[var(--app-accent)] hover:bg-[var(--app-accent-hover)] transition-colors disabled:opacity-50 cursor-pointer"
                  >
                    {mcpTesting ? 'Probando...' : 'Probar MCP'}
                  </button>
                </div>
              </div>
            )}

            {/* TAB 5: RESPALDO Y APP */}
            {activeSection === 'backup' && (
              <div className="space-y-4">
                {/* Local Storage Summary (IndexedDB) */}
                <div className="space-y-3 p-4 rounded-lg border border-[var(--app-border)] bg-[var(--app-bg-secondary)]">
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <h4 className="text-[13px] font-semibold text-[var(--app-text-primary)]">
                        Almacenamiento local (IndexedDB)
                      </h4>
                      <p className="text-xs text-[var(--app-text-muted)] mt-0.5">
                        Resumen de datos guardados en este dispositivo para trabajo offline.
                      </p>
                    </div>
                    <span className="text-xs font-mono font-medium px-2.5 py-1 rounded-md bg-[var(--app-bg-primary)] border border-[var(--app-border)] text-[var(--app-text-primary)] shrink-0">
                      {storageStats ? storageStats.usageLabel : '…'}
                    </span>
                  </div>

                  <div className="grid grid-cols-3 gap-2">
                    <div className="p-2.5 rounded-md border border-[var(--app-border)] bg-[var(--app-bg-primary)]">
                      <div className="text-[11px] text-[var(--app-text-muted)]">Notas activas</div>
                      <div className="text-base font-semibold font-mono text-[var(--app-text-primary)] mt-0.5">
                        {storageStats ? storageStats.activeNotes : '—'}
                      </div>
                    </div>
                    <div className="p-2.5 rounded-md border border-[var(--app-border)] bg-[var(--app-bg-primary)]">
                      <div className="text-[11px] text-[var(--app-text-muted)]">Nodos de lienzo</div>
                      <div className="text-base font-semibold font-mono text-[var(--app-text-primary)] mt-0.5">
                        {storageStats ? storageStats.canvasNodes : '—'}
                      </div>
                    </div>
                    <div className="p-2.5 rounded-md border border-[var(--app-border)] bg-[var(--app-bg-primary)]">
                      <div className="text-[11px] text-[var(--app-text-muted)]">En papelera</div>
                      <div className="text-base font-semibold font-mono text-[var(--app-text-primary)] mt-0.5">
                        {storageStats ? storageStats.trashedNotes : '—'}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-[var(--app-divider)] gap-2 flex-wrap">
                    <span className="text-[11px] text-[var(--app-text-muted)]">
                      {confirmEmptyTrash
                        ? 'Esta acción eliminará permanentemente las notas en papelera.'
                        : 'Libera espacio borrando notas ya enviadas a la papelera.'}
                    </span>
                    {confirmEmptyTrash ? (
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => setConfirmEmptyTrash(false)}
                          className="h-8 px-2.5 rounded-md text-xs font-medium text-[var(--app-text-secondary)] hover:bg-[var(--app-hover)] transition cursor-pointer"
                        >
                          Cancelar
                        </button>
                        <button
                          type="button"
                          disabled={emptyingTrash}
                          onClick={() => void handleEmptyTrash()}
                          className="h-8 px-3 rounded-md text-xs font-semibold bg-rose-600 hover:bg-rose-500 text-white transition cursor-pointer disabled:opacity-50"
                        >
                          {emptyingTrash ? 'Vaciando...' : 'Confirmar borrado'}
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        disabled={!storageStats || storageStats.trashedNotes === 0}
                        onClick={() => setConfirmEmptyTrash(true)}
                        className="h-8 px-3 rounded-md text-xs font-medium border border-[var(--app-border-strong)] bg-[var(--app-bg-primary)] hover:bg-rose-500/10 hover:text-rose-500 hover:border-rose-500/30 text-[var(--app-text-primary)] transition flex items-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                      >
                        <Trash size={14} />
                        <span>Vaciar papelera</span>
                      </button>
                    )}
                  </div>
                </div>

                {/* Local Backups (Offline First) */}
                <div className="space-y-3 p-4 rounded-lg border border-[var(--app-border)] bg-[var(--app-bg-secondary)]">
                  <div>
                    <h4 className="text-[13px] font-semibold flex items-center gap-2 text-[var(--app-text-primary)]">
                      <DatabaseTableViewIcon style={{ width: 16, height: 16, color: 'var(--app-text-secondary)' }} />
                      <span>Copia de seguridad local (JSON)</span>
                    </h4>
                    <p className="text-xs text-[var(--app-text-muted)] mt-0.5">
                      Exporta o restaura todo tu espacio de trabajo localmente sin depender de ningún servidor.
                    </p>
                  </div>

                  <div className="flex flex-col sm:flex-row gap-2.5 pt-1">
                    <button
                      type="button"
                      onClick={exportBackupJson}
                      className="flex-1 h-9 px-3 rounded-md text-xs font-medium border border-[var(--app-border-strong)] bg-[var(--app-bg-primary)] hover:bg-[var(--app-hover)] text-[var(--app-text-primary)] transition-colors flex items-center justify-center gap-2 cursor-pointer"
                    >
                      <DownloadIcon style={{ width: 15, height: 15 }} />
                      <span>Exportar copia (JSON)</span>
                    </button>

                    <label className="flex-1 h-9 px-3 rounded-md text-xs font-medium border border-[var(--app-border-strong)] bg-[var(--app-bg-primary)] hover:bg-[var(--app-hover)] text-[var(--app-text-primary)] transition-colors flex items-center justify-center gap-2 cursor-pointer">
                      <UploadIcon style={{ width: 15, height: 15 }} />
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
                <div className="p-4 rounded-lg border border-[var(--app-border)] bg-[var(--app-bg-secondary)] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-9 h-9 rounded-md flex items-center justify-center bg-[var(--app-bg-primary)] border border-[var(--app-border-strong)] text-[var(--app-text-primary)] font-bold text-sm shrink-0">
                      7
                    </div>
                    <div className="min-w-0">
                      <div className="text-[13px] font-semibold text-[var(--app-text-primary)]">
                        {isTauri ? 'Seven Note para Escritorio (Nativo)' : 'Aplicación de Escritorio / PWA'}
                      </div>
                      <div className="text-xs text-[var(--app-text-muted)]">
                        {isTauri
                          ? 'Versión nativa de escritorio v1.0.0. Actualizaciones automáticas activas.'
                          : isStandalone
                          ? 'Seven Note se está ejecutando en modo standalone (instalada).'
                          : 'Instala Seven Note en Windows, Mac, iPad o Android para acceso directo offline.'}
                      </div>
                    </div>
                  </div>

                  {isTauri ? (
                    <button
                      type="button"
                      onClick={() => checkForAppUpdates(true)}
                      className="h-8 px-3.5 rounded-md text-xs font-semibold text-white bg-[var(--app-accent)] hover:bg-[var(--app-accent-hover)] transition-colors cursor-pointer shrink-0"
                    >
                      Buscar actualizaciones
                    </button>
                  ) : (
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => checkForWebUpdates(true)}
                        className="h-8 px-3 rounded-md text-xs font-medium border border-[var(--app-border-strong)] bg-[var(--app-bg-primary)] hover:bg-[var(--app-hover)] text-[var(--app-text-primary)] transition-colors cursor-pointer"
                      >
                        Buscar actualizaciones
                      </button>
                      {!isStandalone && (
                        <button
                          type="button"
                          onClick={handleInstallApp}
                          className="h-8 px-3.5 rounded-md text-xs font-semibold text-white bg-[var(--app-accent)] hover:bg-[var(--app-accent-hover)] transition-colors cursor-pointer"
                        >
                          Instalar App
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
