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
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null)
  const [copiedSql, setCopiedSql] = useState(false)
  const [manualSyncing, setManualSyncing] = useState(false)

  useEffect(() => {
    if (isOpen) {
      const config = getStoredSupabaseConfig()
      setUrl(config.url)
      setAnonKey(config.anonKey)
      setEnabled(config.enabled)
      setTestResult(null)
    }
  }, [isOpen])

  if (!isOpen) return null

  const handleSave = () => {
    saveSupabaseConfig({ url, anonKey, enabled })
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
    const sqlText = `-- ========================================================
-- SEVEN NOTE: ESQUEMA COMPLETO PARA SUPABASE
-- ========================================================
create extension if not exists "uuid-ossp";

create table if not exists public.workspaces (
  id text primary key,
  user_id uuid references auth.users(id) on delete cascade default auth.uid(),
  parent_id text,
  title text not null default 'Sin título',
  icon text default '📄',
  color text default '#6366f1',
  view_mode text not null default 'both',
  doc_content text not null default '',
  created_at bigint not null,
  updated_at bigint not null,
  is_favorite boolean not null default false,
  is_deleted boolean not null default false
);

create table if not exists public.canvas_nodes (
  id text primary key,
  workspace_id text not null references public.workspaces(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade default auth.uid(),
  type text not null default 'note',
  position_x double precision not null default 0,
  position_y double precision not null default 0,
  width double precision,
  height double precision,
  data jsonb not null default '{}'::jsonb,
  created_at bigint not null,
  updated_at bigint not null,
  is_deleted boolean not null default false
);

create table if not exists public.canvas_edges (
  id text primary key,
  workspace_id text not null references public.workspaces(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade default auth.uid(),
  source text not null,
  target text not null,
  source_handle text,
  target_handle text,
  label text,
  animated boolean default false,
  color text default '#6366f1',
  created_at bigint not null,
  updated_at bigint not null,
  is_deleted boolean not null default false
);

alter table public.workspaces enable row level security;
alter table public.canvas_nodes enable row level security;
alter table public.canvas_edges enable row level security;

create policy "Acceso total a workspaces" on public.workspaces for all using (true) with check (true);
create policy "Acceso total a canvas_nodes" on public.canvas_nodes for all using (true) with check (true);
create policy "Acceso total a canvas_edges" on public.canvas_edges for all using (true) with check (true);
`
    await navigator.clipboard.writeText(sqlText)
    setCopiedSql(true)
    setTimeout(() => setCopiedSql(false), 2000)
  }

  const exportBackupJson = async () => {
    const spaces = await db.spaces.toArray()
    const workspaces = await db.workspaces.toArray()
    const nodes = await db.canvasNodes.toArray()
    const edges = await db.canvasEdges.toArray()

    const backup = {
      version: 2,
      appName: 'Seven Note',
      exportedAt: new Date().toISOString(),
      spaces,
      workspaces,
      nodes,
      edges
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
          syncEngine.scheduleSync(500)
          alert('¡Copia de seguridad restaurada con éxito!')
          window.location.reload()
        }
      } catch (err) {
        alert('Error al procesar el archivo JSON.')
      }
    }
    reader.readAsText(file)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4 animate-in fade-in duration-150">
      <div className="w-full max-w-xl rounded-xl border border-[var(--app-border)] shadow-[var(--app-shadow-modal)] overflow-hidden flex flex-col max-h-[90vh] bg-[var(--app-bg-overlay)] text-[var(--app-text-primary)]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-[var(--app-border)] shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-md flex items-center justify-center bg-[var(--app-hover)] text-[var(--app-text-primary)]">
              <SettingsIcon style={{ width: 16, height: 16 }} />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-[var(--app-text-primary)]">
                Configuración y Sincronización
              </h2>
              <p className="text-[11px] text-[var(--app-text-secondary)]">
                Gestión de nube Supabase y copias de seguridad locales
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-md text-[var(--app-text-secondary)] hover:text-[var(--app-text-primary)] hover:bg-[var(--app-hover)] transition"
          >
            <CloseIcon style={{ width: 16, height: 16 }} />
          </button>
        </div>

        {/* Modal Content */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5 text-xs">
          {/* UI Scale / Zoom Section */}
          <div className="space-y-3 p-4 rounded-lg border border-[var(--app-border)] bg-[var(--app-bg-secondary)]">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-xs font-semibold text-[var(--app-text-primary)]">
                  Tamaño y Escala de la Interfaz
                </h3>
                <p className="text-[11px] mt-0.5 text-[var(--app-text-secondary)]">
                  Ajusta el tamaño global de los botones, textos e iconos para adaptarlos a tu pantalla.
                </p>
              </div>
              <span className="text-xs font-mono font-semibold px-2 py-0.5 rounded bg-[var(--app-hover)] border border-[var(--app-border)] text-[var(--app-text-primary)]">
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
                    className={`py-2 px-1.5 rounded-md border text-center transition flex flex-col items-center justify-center gap-0.5 ${
                      isSelected
                        ? 'border-[var(--app-accent)] bg-[var(--app-accent-subtle)] text-[var(--app-accent)] font-semibold shadow-xs'
                        : 'border-[var(--app-border)] bg-[var(--app-bg-primary)] text-[var(--app-text-primary)] hover:bg-[var(--app-hover)]'
                    }`}
                  >
                    <span className="text-xs font-semibold">{opt.label}</span>
                    <span className="text-[10px] text-[var(--app-text-secondary)]">{opt.sub}</span>
                  </button>
                )
              })}
            </div>

            <div className="flex items-center justify-between pt-1 text-[11px] text-[var(--app-text-secondary)]">
              <span>Atajo de teclado:</span>
              <span className="font-mono bg-[var(--app-bg-primary)] px-2 py-0.5 rounded border border-[var(--app-border)]">
                Ctrl + / Ctrl - / Ctrl 0
              </span>
            </div>
          </div>

          {/* Supabase Section */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-xs font-semibold text-[var(--app-text-primary)]">
                  Sincronización en la Nube (Supabase)
                </h3>
                <p className="text-[11px] text-[var(--app-text-secondary)]">
                  Opcional. Seven Note funciona 100% offline; conecta Supabase para respaldar tus notas en la nube.
                </p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={enabled}
                  onChange={(e) => setEnabled(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-9 h-5 bg-zinc-300 dark:bg-zinc-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-zinc-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[var(--app-accent)]"></div>
              </label>
            </div>

            <div className="space-y-3 p-4 rounded-lg border border-[var(--app-border)] bg-[var(--app-bg-secondary)]">
              <div>
                <label className="block text-xs font-medium mb-1 text-[var(--app-text-secondary)]">
                  Project URL de Supabase
                </label>
                <input
                  type="text"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="https://xyzcompany.supabase.co"
                  className="w-full text-xs px-3 py-1.5 rounded-md border border-[var(--app-border)] bg-[var(--app-bg-primary)] text-[var(--app-text-primary)] outline-none font-mono focus:border-[var(--app-accent)] transition"
                />
              </div>

              <div>
                <label className="block text-xs font-medium mb-1 text-[var(--app-text-secondary)]">
                  Anon / Public Key
                </label>
                <input
                  type="password"
                  value={anonKey}
                  onChange={(e) => setAnonKey(e.target.value)}
                  placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6..."
                  className="w-full text-xs px-3 py-1.5 rounded-md border border-[var(--app-border)] bg-[var(--app-bg-primary)] text-[var(--app-text-primary)] outline-none font-mono focus:border-[var(--app-accent)] transition"
                />
              </div>

              {testResult && (
                <div
                  className={`flex items-center gap-2 p-2.5 rounded-md text-xs border ${
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
                    className="px-3 py-1.5 rounded-md text-xs font-medium border border-[var(--app-border)] bg-[var(--app-bg-primary)] hover:bg-[var(--app-hover)] text-[var(--app-text-primary)] transition disabled:opacity-50"
                  >
                    {testing ? 'Probando...' : 'Probar conexión'}
                  </button>
                  <button
                    onClick={copySqlSchema}
                    className="px-3 py-1.5 rounded-md text-xs font-medium border border-[var(--app-border)] bg-[var(--app-bg-primary)] hover:bg-[var(--app-hover)] text-[var(--app-text-primary)] transition flex items-center gap-1.5"
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
                  className="px-4 py-1.5 rounded-md text-xs font-medium text-[var(--app-bg-primary)] bg-[var(--app-text-primary)] hover:opacity-90 transition shadow-xs"
                >
                  Guardar
                </button>
              </div>
            </div>
          </div>

          {/* Sync Actions */}
          <div className="p-3.5 rounded-lg border border-[var(--app-border)] bg-[var(--app-bg-secondary)] flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <CloudWorkspaceIcon style={{ width: 18, height: 18, color: 'var(--app-text-secondary)' }} />
              <div>
                <div className="text-xs font-semibold text-[var(--app-text-primary)]">
                  Estado de sincronización
                </div>
                <div className="text-[11px] text-[var(--app-text-secondary)]">
                  {syncStatus.pendingCount} cambios pendientes en IndexedDB
                </div>
              </div>
            </div>
            <button
              onClick={handleManualSync}
              disabled={manualSyncing || !enabled}
              className="px-3 py-1.5 rounded-md text-xs font-medium border border-[var(--app-border)] bg-[var(--app-bg-primary)] hover:bg-[var(--app-hover)] text-[var(--app-text-primary)] transition flex items-center gap-1.5 disabled:opacity-50"
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
              <h3 className="text-xs font-semibold flex items-center gap-1.5 text-[var(--app-text-primary)]">
                <DatabaseTableViewIcon style={{ width: 15, height: 15, color: 'var(--app-text-secondary)' }} />
                <span>Copia de Seguridad Local (JSON)</span>
              </h3>
              <p className="text-[11px] text-[var(--app-text-secondary)] mt-0.5">
                Exporta o restaura todo tu espacio de trabajo localmente sin depender de ningún servidor.
              </p>
            </div>

            <div className="flex gap-2">
              <button
                onClick={exportBackupJson}
                className="flex-1 py-1.5 px-3 rounded-md text-xs font-medium border border-[var(--app-border)] bg-[var(--app-bg-secondary)] hover:bg-[var(--app-hover)] text-[var(--app-text-primary)] transition flex items-center justify-center gap-1.5"
              >
                <DownloadIcon style={{ width: 14, height: 14 }} />
                <span>Exportar Copia (JSON)</span>
              </button>

              <label className="flex-1 py-1.5 px-3 rounded-md text-xs font-medium border border-[var(--app-border)] bg-[var(--app-bg-secondary)] hover:bg-[var(--app-hover)] text-[var(--app-text-primary)] transition flex items-center justify-center gap-1.5 cursor-pointer">
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
        </div>

        {/* Footer */}
        <div className="px-5 py-2.5 border-t border-[var(--app-border)] text-xs flex items-center justify-between shrink-0 bg-[var(--app-bg-secondary)] text-[var(--app-text-secondary)]">
          <span>Seven Note • Milanote & Notion Canvas</span>
          <button
            onClick={onClose}
            className="px-3 py-1 rounded-md text-xs font-medium border border-[var(--app-border)] bg-[var(--app-bg-primary)] hover:bg-[var(--app-hover)] text-[var(--app-text-primary)] transition"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  )
}
