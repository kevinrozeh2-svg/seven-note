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
import { isTauri, checkForAppUpdates } from '../../lib/tauriUpdater'

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
            ) : !isStandalone ? (
              <button
                onClick={handleInstallApp}
                className="px-3.5 py-1.5 rounded-md text-xs font-medium text-white bg-[var(--app-accent)] hover:bg-[var(--app-accent-hover)] transition-colors cursor-pointer shrink-0"
              >
                Instalar App
              </button>
            ) : null}
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
