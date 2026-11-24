import { useEffect, useState, useCallback } from 'react'
import { Eye, CheckCircle, Clock, ArrowsClockwise } from '@phosphor-icons/react'
import type { WorkspaceItem } from '../../db'
import type { TeamMember, UserProfile, UserRole } from '../../lib/teamAuth'
import {
  fetchDocumentReads,
  subscribeToDocumentReads,
  formatReadSummary,
  formatRelativeReadTime,
  formatExactReadTime,
  type DocumentReadEntry
} from '../../lib/documentReads'
import { UserAvatar } from './UserAvatar'
import { subscribeToTeamProfiles } from '../../lib/teamProfiles'

interface DocumentReadersBadgeProps {
  workspace: WorkspaceItem
  currentMember: TeamMember
  authUserId?: string | null
  isOpen: boolean
  onToggle: () => void
}

function getRoleBadgeLabel(role?: UserRole): string | null {
  if (role === 'admin') return 'Admin'
  if (role === 'member') return 'Miembro'
  if (role === 'viewer') return 'Lector'
  return null
}

function UserMiniAvatar({
  name,
  color,
  avatarUrl,
  size = 'md'
}: {
  name: string
  color?: string
  avatarUrl?: string
  size?: 'xs' | 'md'
}) {
  return (
    <UserAvatar
      name={name}
      color={color}
      avatarUrl={avatarUrl}
      size={size}
      shape="circle"
      className="ring-1 ring-white/80 dark:ring-[#1e1e1e]"
    />
  )
}

export function DocumentReadersBadge({
  workspace,
  currentMember,
  authUserId,
  isOpen,
  onToggle
}: DocumentReadersBadgeProps) {
  const [reads, setReads] = useState<DocumentReadEntry[]>([])
  const [pendingMembers, setPendingMembers] = useState<UserProfile[]>([])
  const [tableMissing, setTableMissing] = useState(false)
  const [isLoading, setIsLoading] = useState(false)

  const fetchReads = useCallback(
    async (forceRefreshProfiles = false) => {
      if (!workspace?.id) return null
      return fetchDocumentReads(workspace.id, {
        fallbackViewedBy: workspace.viewedBy,
        isPrivate: workspace.isPrivate,
        forceRefreshProfiles
      })
    },
    [workspace.id, workspace.viewedBy, workspace.isPrivate]
  )

  const handleManualRefresh = useCallback(async () => {
    setIsLoading(true)
    try {
      const result = await fetchReads(true)
      if (result) {
        setReads(result.reads)
        setPendingMembers(result.pendingMembers)
        setTableMissing(result.tableMissing)
      }
    } finally {
      setIsLoading(false)
    }
  }, [fetchReads])

  useEffect(() => {
    let cancelled = false
    const run = async () => {
      const result = await fetchReads(false)
      if (!cancelled && result) {
        setReads(result.reads)
        setPendingMembers(result.pendingMembers)
        setTableMissing(result.tableMissing)
      }
    }
    void run()
    const unsubscribe = subscribeToDocumentReads(workspace.id, () => {
      void run()
    })
    const unsubscribeProfiles = subscribeToTeamProfiles(() => {
      void run()
    })
    return () => {
      cancelled = true
      unsubscribe()
      unsubscribeProfiles()
    }
  }, [workspace.id, isOpen, fetchReads])

  const summaryText = formatReadSummary(reads)
  const isSelf = (entry: DocumentReadEntry) => {
    if (authUserId && entry.userId === authUserId) return true
    if (currentMember.id && entry.userId === currentMember.id) return true
    if (
      currentMember.email &&
      entry.userEmail &&
      currentMember.email.toLowerCase().trim() === entry.userEmail.toLowerCase().trim()
    ) {
      return true
    }
    return false
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation()
          onToggle()
        }}
        aria-label={summaryText}
        aria-expanded={isOpen}
        className={`h-8 px-2.5 rounded-md flex items-center gap-1.5 text-xs transition cursor-pointer select-none border ${
          isOpen
            ? 'bg-[var(--app-active)] border-[var(--app-border-strong)] text-[var(--app-text-primary)]'
            : reads.length > 0
            ? 'bg-[var(--app-bg-secondary)] border-[var(--app-border)] text-[var(--app-text-secondary)] hover:text-[var(--app-text-primary)] hover:bg-[var(--app-hover)]'
            : 'bg-transparent border-transparent text-[var(--app-text-muted)] hover:text-[var(--app-text-primary)] hover:bg-[var(--app-hover)]'
        }`}
        title={`Solo administradores · ${summaryText}`}
      >
        <Eye size={15} weight={reads.length > 0 ? 'duotone' : 'regular'} className="shrink-0" />
        {reads.length > 0 && (
          <span className="hidden md:flex items-center -space-x-1.5 shrink-0">
            {reads.slice(0, 3).map((reader) => (
              <UserMiniAvatar
                key={`${reader.userId}-${reader.userEmail || ''}`}
                name={reader.userName}
                color={reader.userColor}
                avatarUrl={reader.userAvatarUrl}
                size="xs"
              />
            ))}
          </span>
        )}
        <span className="hidden sm:inline max-w-[170px] truncate font-medium">
          {summaryText}
        </span>
        <span className="sm:hidden font-semibold tabular-nums">{reads.length}</span>
      </button>

      {isOpen && (
        <div
          className="fixed right-3 top-12 sm:absolute sm:left-0 sm:right-auto sm:top-9 z-50 w-[calc(100vw-24px)] max-w-[310px] sm:w-80 sm:max-w-none bg-white/95 dark:bg-[#1a1b1e]/95 border border-black/[0.08] dark:border-white/[0.1] rounded-2xl shadow-2xl backdrop-blur-2xl p-3 text-xs text-[var(--app-text-primary)] animate-in fade-in zoom-in-95 duration-100 max-h-[calc(100vh-72px)] overflow-y-auto custom-scrollbar"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between pb-2 mb-2 border-b border-black/[0.06] dark:border-white/[0.08]">
            <div className="flex items-center gap-1.5">
              <Eye size={14} weight="duotone" className="text-emerald-500 shrink-0" />
              <span className="font-semibold text-xs">Lecturas del documento</span>
              <span className="px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 tabular-nums">
                {reads.length}
              </span>
            </div>
            <button
              onClick={() => void handleManualRefresh()}
              disabled={isLoading}
              className="p-1 rounded-lg text-neutral-400 hover:text-[var(--app-text-primary)] hover:bg-black/[0.05] dark:hover:bg-white/[0.08] transition cursor-pointer disabled:opacity-40"
              title="Actualizar lecturas"
            >
              <ArrowsClockwise size={13} className={isLoading ? 'animate-spin' : ''} />
            </button>
          </div>

          {/* Readers list */}
          {reads.length === 0 ? (
            <div className="py-5 text-center text-neutral-400 text-[11px]">
              Nadie ha registrado lectura en este documento todavía.
            </div>
          ) : (
            <div className="space-y-1.5">
              {reads.map((reader) => {
                const roleLabel = getRoleBadgeLabel(reader.role)
                const exactTime = formatExactReadTime(reader.lastReadAt)
                const relativeTime = formatRelativeReadTime(reader.lastReadAt)
                const self = isSelf(reader)

                return (
                  <div
                    key={`${reader.userId}-${reader.userEmail || ''}`}
                    className="flex items-center justify-between gap-2 px-2 py-1.5 rounded-xl bg-black/[0.025] dark:bg-white/[0.03] border border-black/[0.04] dark:border-white/[0.05]"
                    title={exactTime ? `Última lectura: ${exactTime}` : undefined}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <UserMiniAvatar
                        name={reader.userName}
                        color={reader.userColor}
                        avatarUrl={reader.userAvatarUrl}
                        size="md"
                      />
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span className="font-medium text-xs truncate">
                            {reader.userName}
                          </span>
                          {self && (
                            <span className="text-[10px] text-neutral-400 shrink-0">(Tú)</span>
                          )}
                          {roleLabel && (
                            <span
                              className={`text-[9px] px-1.5 py-0.2 rounded-full font-medium shrink-0 ${
                                reader.role === 'admin'
                                  ? 'bg-blue-500/15 text-blue-600 dark:text-blue-400'
                                  : 'bg-black/[0.05] dark:bg-white/[0.08] text-neutral-500 dark:text-neutral-400'
                              }`}
                            >
                              {roleLabel}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-1.5 text-[10px] text-neutral-500 dark:text-neutral-400">
                          <span>Leído · {relativeTime}</span>
                          {reader.readCount > 1 && (
                            <span className="text-neutral-400">· {reader.readCount} veces</span>
                          )}
                        </div>
                      </div>
                    </div>
                    <CheckCircle
                      size={15}
                      weight="fill"
                      className="text-emerald-500 shrink-0"
                    />
                  </div>
                )
              })}
            </div>
          )}

          {/* Pending team members (only on shared docs) */}
          {!workspace.isPrivate && pendingMembers.length > 0 && (
            <div className="mt-3 pt-2.5 border-t border-black/[0.06] dark:border-white/[0.08]">
              <div className="flex items-center justify-between mb-1.5 px-0.5">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-neutral-400">
                  Pendientes de leer
                </span>
                <span className="text-[10px] text-neutral-400 tabular-nums">
                  {pendingMembers.length}
                </span>
              </div>
              <div className="space-y-1">
                {pendingMembers.map((member) => (
                  <div
                    key={member.id || member.email}
                    className="flex items-center justify-between gap-2 px-2 py-1 rounded-lg opacity-65"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <UserMiniAvatar
                        name={member.fullName || member.email || 'Usuario'}
                        color={member.color}
                        avatarUrl={member.avatarUrl}
                        size="xs"
                      />
                      <span className="text-[11px] truncate">
                        {member.fullName || member.email?.split('@')[0] || 'Usuario'}
                      </span>
                    </div>
                    <Clock size={12} className="text-neutral-400 shrink-0" />
                  </div>
                ))}
              </div>
            </div>
          )}

          {tableMissing && (
            <div className="mt-2.5 pt-2 border-t border-black/[0.06] dark:border-white/[0.08] text-[10px] text-amber-600 dark:text-amber-400 leading-snug">
              Modo local activo. Ejecuta la sección 16 de <code>supabase_schema.sql</code> en Supabase para sincronizar lecturas entre todos los usuarios.
            </div>
          )}
        </div>
      )}
    </div>
  )
}
