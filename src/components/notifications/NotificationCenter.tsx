import { useState, useMemo, useEffect } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { AnimatePresence, motion } from 'motion/react'
import {
  Bell,
  BellSlash,
  Check,
  Checks,
  Clock,
  Trash,
  X,
  MagnifyingGlass,
  At,
  ChatCircleText,
  CalendarCheck,
  ArrowsClockwise,
  WarningCircle,
  Info,
  CheckCircle,
  Gear,
  ArrowSquareOut
} from '@phosphor-icons/react'
import { db, type NotificationItem } from '../../db'
import {
  notificationService,
  getNotificationCategory,
  type NotificationPreferences
} from '../../lib/notificationService'

interface NotificationCenterProps {
  isOpen: boolean
  onClose: () => void
  onOpenSettings: () => void
  currentMemberId?: string
}

type FilterTab = 'all' | 'unread' | 'collaboration' | 'reminders' | 'system'

function formatRelativeTime(ts: number): string {
  const diff = Math.max(0, Date.now() - ts)
  const mins = Math.floor(diff / 60_000)
  if (mins < 1) return 'ahora'
  if (mins < 60) return `hace ${mins}m`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `hace ${hours}h`
  const days = Math.floor(hours / 24)
  if (days < 7) return `hace ${days}d`
  return new Date(ts).toLocaleDateString('es-ES', { day: '2-digit', month: 'short' })
}

function getNotificationIcon(item: NotificationItem) {
  if (item.severity === 'error') {
    return <WarningCircle size={16} weight="fill" className="text-rose-500" />
  }
  if (item.severity === 'warning') {
    return <WarningCircle size={16} weight="fill" className="text-amber-500" />
  }
  if (item.severity === 'success') {
    return <CheckCircle size={16} weight="fill" className="text-emerald-500" />
  }
  switch (item.type) {
    case 'mention':
      return <At size={16} weight="bold" className="text-purple-400" />
    case 'comment':
      return <ChatCircleText size={16} weight="fill" className="text-sky-400" />
    case 'reminder':
      return <CalendarCheck size={16} weight="fill" className="text-amber-400" />
    case 'sync':
      return <ArrowsClockwise size={16} weight="bold" className="text-blue-400" />
    default:
      return <Info size={16} weight="fill" className="text-[var(--app-accent)]" />
  }
}

export function NotificationCenter({
  isOpen,
  onClose,
  onOpenSettings,
  currentMemberId
}: NotificationCenterProps) {
  const [filter, setFilter] = useState<FilterTab>('all')
  const [search, setSearch] = useState('')
  const [snoozeOpenId, setSnoozeOpenId] = useState<string | null>(null)
  const [prefs, setPrefs] = useState<NotificationPreferences>(() => notificationService.getPreferences())

  useEffect(() => {
    return notificationService.subscribeToPreferences(setPrefs)
  }, [])

  useEffect(() => {
    if (!isOpen) {
      setSnoozeOpenId(null)
      return
    }
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose])

  const allNotifications = useLiveQuery(async () => {
    const rows = await db.notifications.orderBy('createdAt').reverse().toArray()
    const now = Date.now()
    return rows.filter((n) => {
      if (n.isArchived) return false
      if (n.snoozedUntil && n.snoozedUntil > now) return false
      if (
        n.recipientId &&
        n.recipientId !== 'all' &&
        currentMemberId &&
        n.recipientId.toLowerCase() !== currentMemberId.toLowerCase()
      ) {
        return false
      }
      return true
    })
  }, [currentMemberId]) || []

  const unreadCount = useMemo(
    () => allNotifications.filter((n) => !n.isRead).length,
    [allNotifications]
  )

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return allNotifications.filter((n) => {
      if (filter === 'unread' && n.isRead) return false
      if (filter === 'collaboration' && getNotificationCategory(n.type) !== 'collaboration') return false
      if (filter === 'reminders' && getNotificationCategory(n.type) !== 'reminders') return false
      if (filter === 'system') {
        const cat = getNotificationCategory(n.type)
        if (cat !== 'system' && cat !== 'sync') return false
      }
      if (q) {
        const hay = `${n.title} ${n.message} ${n.actorName || ''}`.toLowerCase()
        if (!hay.includes(q)) return false
      }
      return true
    })
  }, [allNotifications, filter, search])

  const isSilenced = prefs.dndEnabled || notificationService.isInQuietHours()

  const handleToggleDnd = () => {
    notificationService.updatePreferences({ dndEnabled: !prefs.dndEnabled })
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            key="notif-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            onClick={onClose}
            className="fixed inset-0 left-11 z-40 bg-black/30 backdrop-blur-[1px]"
          />

          <motion.aside
            key="notif-drawer"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
            aria-label="Centro de Notificaciones"
            className="fixed inset-y-0 left-11 z-50 w-[min(390px,calc(100vw-44px))] flex flex-col bg-[var(--app-bg-overlay)] border-r border-[var(--app-border-strong)] shadow-2xl text-[var(--app-text-primary)] select-none"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--app-divider)] shrink-0">
              <div className="flex items-center gap-2 min-w-0">
                <div className="w-7 h-7 rounded-lg flex items-center justify-center bg-purple-500/15 text-purple-400 shrink-0">
                  {isSilenced ? <BellSlash size={16} weight="fill" /> : <Bell size={16} weight="fill" />}
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h2 className="text-sm font-semibold truncate">Notificaciones</h2>
                    {unreadCount > 0 && (
                      <span className="px-1.5 py-0.5 text-[10px] font-bold rounded-full bg-purple-500 text-white leading-none">
                        {unreadCount > 99 ? '99+' : unreadCount}
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-[var(--app-text-muted)] truncate">
                    {isSilenced ? 'Modo No Molestar activo' : 'Alertas en tiempo real y recordatorios'}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-1 shrink-0">
                <button
                  onClick={handleToggleDnd}
                  className={`p-1.5 rounded-md transition cursor-pointer ${
                    prefs.dndEnabled
                      ? 'bg-amber-500/15 text-amber-400'
                      : 'text-[var(--app-text-muted)] hover:text-[var(--app-text-primary)] hover:bg-[var(--app-hover)]'
                  }`}
                  title={prefs.dndEnabled ? 'Desactivar No Molestar' : 'Activar No Molestar'}
                >
                  <BellSlash size={16} />
                </button>
                <button
                  onClick={() => {
                    onClose()
                    onOpenSettings()
                  }}
                  className="p-1.5 rounded-md text-[var(--app-text-muted)] hover:text-[var(--app-text-primary)] hover:bg-[var(--app-hover)] transition cursor-pointer"
                  title="Preferencias de notificaciones"
                >
                  <Gear size={16} />
                </button>
                <button
                  onClick={onClose}
                  className="p-1.5 rounded-md text-[var(--app-text-muted)] hover:text-[var(--app-text-primary)] hover:bg-[var(--app-hover)] transition cursor-pointer"
                  title="Cerrar (Esc)"
                >
                  <X size={16} />
                </button>
              </div>
            </div>

            {/* Search + Filters */}
            <div className="px-3 py-2.5 border-b border-[var(--app-divider)] space-y-2 shrink-0">
              <div className="relative">
                <MagnifyingGlass
                  size={14}
                  className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--app-text-muted)] pointer-events-none"
                />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Buscar notificaciones..."
                  className="w-full pl-8 pr-3 py-1.5 text-xs rounded-md bg-[var(--app-bg-secondary)] border border-[var(--app-border)] text-[var(--app-text-primary)] placeholder:text-[var(--app-text-muted)] focus:outline-none focus:border-[var(--app-accent)]"
                />
              </div>

              <div className="flex items-center gap-1 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                {(
                  [
                    { id: 'all', label: 'Todas' },
                    { id: 'unread', label: `No leídas${unreadCount > 0 ? ` (${unreadCount})` : ''}` },
                    { id: 'collaboration', label: 'Menciones' },
                    { id: 'reminders', label: 'Recordatorios' },
                    { id: 'system', label: 'Sistema' }
                  ] as const
                ).map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setFilter(tab.id)}
                    className={`px-2.5 py-1 rounded-md text-[11px] font-medium whitespace-nowrap transition cursor-pointer ${
                      filter === tab.id
                        ? 'bg-purple-500/15 text-purple-400 border border-purple-500/30'
                        : 'text-[var(--app-text-muted)] hover:text-[var(--app-text-primary)] hover:bg-[var(--app-hover)] border border-transparent'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Bulk Actions */}
            {allNotifications.length > 0 && (
              <div className="flex items-center justify-between px-3 py-1.5 border-b border-[var(--app-divider)] bg-[var(--app-bg-secondary)]/50 text-[11px] shrink-0">
                <button
                  onClick={() => void notificationService.markAllAsRead()}
                  disabled={unreadCount === 0}
                  className="flex items-center gap-1 text-[var(--app-text-secondary)] hover:text-[var(--app-text-primary)] disabled:opacity-40 disabled:pointer-events-none transition cursor-pointer"
                >
                  <Checks size={14} />
                  Marcar todas leídas
                </button>
                <button
                  onClick={() => void notificationService.clearReadNotifications()}
                  className="flex items-center gap-1 text-[var(--app-text-muted)] hover:text-rose-400 transition cursor-pointer"
                >
                  <Trash size={13} />
                  Limpiar leídas
                </button>
              </div>
            )}

            {/* List */}
            <div className="flex-1 overflow-y-auto p-2.5 space-y-2 custom-scrollbar">
              {filtered.length === 0 ? (
                <div className="flex flex-col items-center justify-center text-center py-14 px-4">
                  <div className="w-11 h-11 rounded-full bg-[var(--app-bg-secondary)] border border-[var(--app-border)] flex items-center justify-center text-[var(--app-text-muted)] mb-3">
                    <Bell size={20} />
                  </div>
                  <p className="text-xs font-medium text-[var(--app-text-primary)]">
                    {search || filter !== 'all' ? 'Sin resultados para este filtro' : 'Estás al día'}
                  </p>
                  <p className="text-[11px] text-[var(--app-text-muted)] mt-1 max-w-[240px]">
                    Aquí verás menciones, comentarios, recordatorios de tareas y alertas de sincronización.
                  </p>
                  {allNotifications.length === 0 && (
                    <button
                      onClick={() => void notificationService.sendTestNotification()}
                      className="mt-4 px-3 py-1.5 rounded-md text-[11px] font-medium bg-purple-500/15 text-purple-400 hover:bg-purple-500/25 border border-purple-500/30 transition cursor-pointer"
                    >
                      Probar notificación
                    </button>
                  )}
                </div>
              ) : (
                filtered.map((item) => (
                  <div
                    key={item.id}
                    className={`group relative rounded-lg border p-3 transition ${
                      item.isRead
                        ? 'bg-[var(--app-bg-secondary)]/40 border-[var(--app-border)] opacity-80 hover:opacity-100'
                        : 'bg-[var(--app-bg-secondary)] border-purple-500/30 shadow-sm'
                    }`}
                  >
                    <div className="flex items-start gap-2.5">
                      <div className="mt-0.5 shrink-0">{getNotificationIcon(item)}</div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs font-semibold text-[var(--app-text-primary)] truncate">
                            {item.title}
                          </span>
                          <div className="flex items-center gap-1.5 shrink-0">
                            {!item.isRead && (
                              <span className="w-2 h-2 rounded-full bg-purple-500" title="No leída" />
                            )}
                            <span className="text-[10px] text-[var(--app-text-muted)]">
                              {formatRelativeTime(item.createdAt)}
                            </span>
                          </div>
                        </div>

                        {item.message && (
                          <p className="text-[11px] text-[var(--app-text-secondary)] mt-1 leading-relaxed break-words">
                            {item.message}
                          </p>
                        )}

                        <div className="flex items-center justify-between gap-2 mt-2.5">
                          <div className="flex items-center gap-1.5">
                            {item.actionLabel && (item.actionPayload || item.workspaceId) && (
                              <button
                                onClick={() => {
                                  notificationService.triggerAction(item)
                                  onClose()
                                }}
                                className="inline-flex items-center gap-1 px-2 py-1 rounded text-[11px] font-medium bg-purple-500/15 text-purple-400 hover:bg-purple-500/25 transition cursor-pointer"
                              >
                                <ArrowSquareOut size={12} />
                                {item.actionLabel}
                              </button>
                            )}
                          </div>

                          <div className="flex items-center gap-0.5 opacity-80 group-hover:opacity-100 transition">
                            {/* Snooze */}
                            <div className="relative">
                              <button
                                onClick={() =>
                                  setSnoozeOpenId((prev) => (prev === item.id ? null : item.id))
                                }
                                className="p-1 rounded text-[var(--app-text-muted)] hover:text-amber-400 hover:bg-[var(--app-hover)] transition cursor-pointer"
                                title="Posponer"
                              >
                                <Clock size={13} />
                              </button>
                              {snoozeOpenId === item.id && (
                                <div className="absolute right-0 bottom-full mb-1 w-32 rounded-md border border-[var(--app-border-strong)] bg-[var(--app-bg-overlay)] shadow-xl py-1 z-20 text-[11px]">
                                  <button
                                    onClick={() => {
                                      setSnoozeOpenId(null)
                                      void notificationService.snoozeNotification(item.id, 15 * 60_000)
                                    }}
                                    className="w-full text-left px-2.5 py-1.5 hover:bg-[var(--app-hover)] cursor-pointer"
                                  >
                                    En 15 minutos
                                  </button>
                                  <button
                                    onClick={() => {
                                      setSnoozeOpenId(null)
                                      void notificationService.snoozeNotification(item.id, 60 * 60_000)
                                    }}
                                    className="w-full text-left px-2.5 py-1.5 hover:bg-[var(--app-hover)] cursor-pointer"
                                  >
                                    En 1 hora
                                  </button>
                                  <button
                                    onClick={() => {
                                      setSnoozeOpenId(null)
                                      void notificationService.snoozeNotification(item.id, 24 * 60 * 60_000)
                                    }}
                                    className="w-full text-left px-2.5 py-1.5 hover:bg-[var(--app-hover)] cursor-pointer"
                                  >
                                    Mañana
                                  </button>
                                </div>
                              )}
                            </div>

                            {/* Mark Read / Unread */}
                            <button
                              onClick={() =>
                                void (item.isRead
                                  ? notificationService.markAsUnread(item.id)
                                  : notificationService.markAsRead(item.id))
                              }
                              className="p-1 rounded text-[var(--app-text-muted)] hover:text-emerald-400 hover:bg-[var(--app-hover)] transition cursor-pointer"
                              title={item.isRead ? 'Marcar como no leída' : 'Marcar como leída'}
                            >
                              <Check size={13} weight={item.isRead ? 'regular' : 'bold'} />
                            </button>

                            {/* Archive */}
                            <button
                              onClick={() => void notificationService.archiveNotification(item.id)}
                              className="p-1 rounded text-[var(--app-text-muted)] hover:text-rose-400 hover:bg-[var(--app-hover)] transition cursor-pointer"
                              title="Archivar"
                            >
                              <X size={13} />
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  )
}
