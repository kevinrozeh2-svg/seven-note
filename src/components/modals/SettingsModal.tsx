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
import {
  getStoredSupabaseConfig,
  saveSupabaseConfig,
  testSupabaseConnection
} from '../../lib/supabase'
import { syncEngine, type SyncEngineStatus } from '../../lib/syncEngine'
import { db } from '../../db'
import schemaSql from '../../supabase_schema.sql?raw'
import { toast } from 'sonner'

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
          if (parsed.spaces && parsed.spaces.length > 0) {
            await db.spaces.bulkPut(parsed.spaces)
          }
          await db.workspaces.bulkPut(parsed.workspaces)
          await db.canvasNodes.bulkPut(parsed.nodes)
          if (parsed.edges) await db.canvasEdges.bulkPut(parsed.edges)
          if (parsed.collections) await db.collections.bulkPut(parsed.collections)
          if (parsed.tags) await db.tags.bulkPut(parsed.tags)

          syncEngine.scheduleSync(500)
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-2 sm:p-4 animate-in fade-in duration-150">
      <div className="w-full max-w-xl rounded-3xl border border-black/[0.08] dark:border-white/[0.1] shadow-2xl overflow-hidden flex flex-col max-h-[90vh] bg-white/95 dark:bg-[#1a1b1e]/95 backdrop-blur-2xl text-[var(--app-text-primary)]">
        {/* Header */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-3 sm:py-4 border-b border-black/[0.06] dark:border-white/[0.08] shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full flex items-center justify-center bg-black/[0.05] dark:bg-white/[0.08] text-[var(--app-text-primary)] shadow-2xs shrink-0">
              <SettingsIcon style={{ width: 16, height: 16 }} />
            </div>
            <div className="min-w-0">
              <h2 className="text-sm font-bold text-[var(--app-text-primary)] truncate">
                Configuración y Sincronización
              </h2>
              <p className="text-[11px] text-neutral-400 truncate">
                Gestión de nube Supabase y copias de seguridad locales
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full text-neutral-400 hover:text-neutral-800 dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/10 transition cursor-pointer shrink-0"
          >
            <CloseIcon style={{ width: 16, height: 16 }} />
          </button>
        </div>

        {/* Modal Content */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 sm:space-y-5 text-xs custom-scrollbar">
          {/* UI Scale / Zoom Section */}
          <div className="space-y-3 p-4 rounded-3xl border border-black/[0.06] dark:border-white/[0.08] bg-black/[0.02] dark:bg-white/[0.02]">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-xs font-bold text-[var(--app-text-primary)]">
                  Tamaño y Escala de la Interfaz
                </h3>
                <p className="text-[11px] mt-0.5 text-neutral-400">
                  Ajusta el tamaño global de los botones, textos e iconos para adaptarlos a tu pantalla.
                </p>
              </div>
              <span className="text-xs font-mono font-bold px-3 py-1 rounded-full bg-black/[0.04] dark:bg-white/[0.06] border border-black/[0.06] dark:border-white/[0.08] text-[var(--app-text-primary)]">
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
                    onClick={() => onUiScaleChange?.(opt.value)}
                    className={`py-2 px-1.5 rounded-2xl border text-center transition flex flex-col items-center justify-center gap-0.5 cursor-pointer active:scale-95 ${
                      isSelected
                        ? 'border-transparent bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 font-bold shadow-sm'
                        : 'border-black/[0.06] dark:border-white/[0.08] bg-white/70 dark:bg-white/[0.05] text-neutral-700 dark:text-neutral-300 hover:bg-black/5 dark:hover:bg-white/10'
                    }`}
                  >
                    <span className="text-xs font-bold">{opt.label}</span>
                    <span className="text-[10px] opacity-70">{opt.sub}</span>
                  </button>
                )
              })}
            </div>

            <div className="flex items-center justify-between pt-1 text-[11px] text-neutral-400">
              <span>Atajo de teclado:</span>
              <span className="font-mono bg-black/[0.04] dark:bg-white/[0.06] px-2.5 py-0.5 rounded-full border border-black/[0.04] dark:border-white/[0.06]">
                Ctrl + / Ctrl - / Ctrl 0
              </span>
            </div>
          </div>

          {/* Supabase Section */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-xs font-bold text-[var(--app-text-primary)]">
                  Sincronización en la Nube (Supabase)
                </h3>
                <p className="text-[11px] text-neutral-400">
                  Opcional. Seven Note funciona 100% offline; conecta Supabase para respaldar tus notas en la nube automáticamente.
                </p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={enabled}
                  onChange={(e) => setEnabled(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-10 h-6 bg-zinc-300 dark:bg-zinc-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-zinc-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-neutral-900 dark:peer-checked:bg-white"></div>
              </label>
            </div>

            <div className="space-y-3 p-4 rounded-3xl border border-black/[0.06] dark:border-white/[0.08] bg-black/[0.02] dark:bg-white/[0.02]">
              {/* Intervalo de sincronización periódica */}
              <div className="flex items-center justify-between">
                <div>
                  <label className="block text-xs font-semibold text-[var(--app-text-primary)]">
                    Frecuencia de sincronización automática
                  </label>
                  <p className="text-[11px] text-neutral-400">
                    Sincroniza en segundo plano cuando estés conectado
                  </p>
                </div>
                <select
                  value={syncInterval}
                  onChange={(e) => setSyncInterval(Number(e.target.value))}
                  className="text-xs px-3 py-1.5 rounded-full border border-black/[0.08] dark:border-white/[0.1] bg-white dark:bg-[#121214] text-[var(--app-text-primary)] outline-none cursor-pointer"
                >
                  <option value={10}>Cada 10 segundos</option>
                  <option value={30}>Cada 30 segundos (Recomendado)</option>
                  <option value={60}>Cada 1 minuto</option>
                  <option value={300}>Cada 5 minutos</option>
                </select>
              </div>

              {testResult && (
                <div
                  className={`flex items-center gap-2 p-3 rounded-2xl text-xs border ${
                    testResult.success
                      ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30'
                      : 'bg-rose-500/10 text-rose-700 dark:text-rose-300 border-rose-500/30'
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

              <div className="flex items-center justify-between pt-2">
                <div className="flex gap-2">
                  <button
                    onClick={handleTest}
                    disabled={testing || !url || !anonKey}
                    className="px-3.5 py-1.5 rounded-full text-xs font-semibold border border-black/[0.08] dark:border-white/[0.1] bg-white dark:bg-[#1a1b1e] hover:bg-black/5 dark:hover:bg-white/10 text-[var(--app-text-primary)] transition disabled:opacity-50 cursor-pointer active:scale-95 shadow-2xs"
                  >
                    {testing ? 'Probando...' : 'Probar conexión'}
                  </button>
                  <button
                    onClick={copySqlSchema}
                    className="px-3.5 py-1.5 rounded-full text-xs font-semibold border border-black/[0.08] dark:border-white/[0.1] bg-white dark:bg-[#1a1b1e] hover:bg-black/5 dark:hover:bg-white/10 text-[var(--app-text-primary)] transition flex items-center gap-1.5 cursor-pointer active:scale-95 shadow-2xs"
                    title="Copiar script SQL para crear las tablas en Supabase"
                  >
                    {copiedSql ? (
                      <DoneIcon style={{ width: 14, height: 14, color: '#10b981' }} />
                    ) : (
                      <CopyIcon style={{ width: 14, height: 14 }} />
                    )}
                    <span>{copiedSql ? '¡SQL Copiado!' : 'Copiar Esquema SQL'}</span>
                  </button>
                </div>

                <button
                  onClick={handleSave}
                  className="px-5 py-1.5 rounded-full text-xs font-bold text-white dark:text-neutral-900 bg-neutral-900 dark:bg-white hover:opacity-90 transition shadow-xs cursor-pointer active:scale-95"
                >
                  Guardar
                </button>
              </div>
            </div>
          </div>

          {/* Sync Actions */}
          <div className="p-4 rounded-3xl border border-black/[0.06] dark:border-white/[0.08] bg-black/[0.02] dark:bg-white/[0.02] flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full flex items-center justify-center bg-black/[0.04] dark:bg-white/[0.06]">
                <CloudWorkspaceIcon style={{ width: 16, height: 16, color: 'var(--app-text-secondary)' }} />
              </div>
              <div>
                <div className="text-xs font-bold text-[var(--app-text-primary)]">
                  Estado de sincronización
                </div>
                <div className="text-[11px] text-neutral-400">
                  {syncStatus.pendingCount === 0
                    ? 'Todo sincronizado con la nube'
                    : `${syncStatus.pendingCount} cambios pendientes en IndexedDB`}
                </div>
              </div>
            </div>
            <button
              onClick={handleManualSync}
              disabled={manualSyncing || !enabled}
              className="px-3.5 py-1.5 rounded-full text-xs font-semibold border border-black/[0.08] dark:border-white/[0.1] bg-white dark:bg-[#1a1b1e] hover:bg-black/5 dark:hover:bg-white/10 text-[var(--app-text-primary)] transition flex items-center gap-1.5 disabled:opacity-50 cursor-pointer active:scale-95 shadow-2xs"
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
          <div className="space-y-3">
            <div>
              <h3 className="text-xs font-bold flex items-center gap-2 text-[var(--app-text-primary)]">
                <DatabaseTableViewIcon style={{ width: 15, height: 15, color: 'var(--app-text-secondary)' }} />
                <span>Copia de Seguridad Local (JSON)</span>
              </h3>
              <p className="text-[11px] text-neutral-400 mt-0.5">
                Exporta o restaura todo tu espacio de trabajo localmente sin depender de ningún servidor.
              </p>
            </div>

            <div className="flex gap-2.5">
              <button
                onClick={exportBackupJson}
                className="flex-1 py-2 px-3.5 rounded-2xl text-xs font-semibold border border-black/[0.08] dark:border-white/[0.1] bg-white dark:bg-[#1a1b1e] hover:bg-black/5 dark:hover:bg-white/10 text-[var(--app-text-primary)] transition flex items-center justify-center gap-2 cursor-pointer active:scale-95 shadow-2xs"
              >
                <DownloadIcon style={{ width: 14, height: 14 }} />
                <span>Exportar Copia (JSON)</span>
              </button>

              <label className="flex-1 py-2 px-3.5 rounded-2xl text-xs font-semibold border border-black/[0.08] dark:border-white/[0.1] bg-white dark:bg-[#1a1b1e] hover:bg-black/5 dark:hover:bg-white/10 text-[var(--app-text-primary)] transition flex items-center justify-center gap-2 cursor-pointer active:scale-95 shadow-2xs">
                <UploadIcon style={{ width: 14, height: 14 }} />
                <span>Restaurar Copia</span>
                <input
                  type="file"
                  accept=".json"
                  onChange={importBackupJson}
                  className="hidden"
                />
              </label>
            </div>
          </div>

          {/* PWA / Desktop App Install */}
          <div className="p-4 rounded-3xl border border-black/[0.06] dark:border-white/[0.08] bg-black/[0.02] dark:bg-white/[0.02] flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full flex items-center justify-center bg-indigo-500/10 text-indigo-500 font-bold text-sm">
                7
              </div>
              <div>
                <div className="text-xs font-bold text-[var(--app-text-primary)]">
                  Aplicación de Escritorio / PWA
                </div>
                <div className="text-[11px] text-neutral-400">
                  {isStandalone
                    ? 'Seven Note se está ejecutando en modo standalone (instalada).'
                    : 'Instala Seven Note en Windows, Mac, iPad o Android para acceso directo y 100% offline.'}
                </div>
              </div>
            </div>

            {!isStandalone && (
              <button
                onClick={handleInstallApp}
                className="px-4 py-1.5 rounded-full text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 transition shadow-xs cursor-pointer active:scale-95 shrink-0"
              >
                Instalar App
              </button>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-4 sm:px-6 py-3 border-t border-black/[0.06] dark:border-white/[0.08] text-xs flex items-center justify-between shrink-0 bg-black/[0.02] dark:bg-white/[0.02] text-neutral-400">
          <span className="font-medium">Seven Note • Milanote & Notion Canvas</span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-full text-xs font-bold border border-black/[0.08] dark:border-white/[0.1] bg-white dark:bg-[#1a1b1e] hover:bg-black/5 dark:hover:bg-white/10 text-[var(--app-text-primary)] transition cursor-pointer active:scale-95 shadow-2xs"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  )
}
