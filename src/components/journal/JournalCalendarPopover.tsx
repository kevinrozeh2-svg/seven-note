import { useState } from 'react'
import {
  ToggleLeftIcon,
  ToggleRightIcon,
  JournalIcon
} from '@blocksuite/icons/rc'
import { type WorkspaceItem } from '../../db'

interface JournalCalendarPopoverProps {
  isOpen: boolean
  onClose: () => void
  workspaces: WorkspaceItem[]
  onSelectDate: (date: Date) => void
}

export function JournalCalendarPopover({
  isOpen,
  onClose,
  workspaces,
  onSelectDate
}: JournalCalendarPopoverProps) {
  const [currentMonth, setCurrentMonth] = useState(() => new Date())

  if (!isOpen) return null

  const today = new Date()

  // Format date helper matching journal date format
  const formatJournalDate = (d: Date) => {
    return d.toLocaleDateString('es-ES', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    })
  }

  // Get days in current displayed month
  const year = currentMonth.getFullYear()
  const month = currentMonth.getMonth()

  const firstDayIndex = new Date(year, month, 1).getDay() // 0 = Sunday
  // Adjust so Monday is 0
  const startOffset = (firstDayIndex + 6) % 7
  const daysInMonth = new Date(year, month + 1, 0).getDate()

  const monthName = currentMonth.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' })

  // Find which days have journal entries
  const journalNotes = workspaces.filter((w) => !w.isDeleted && (w.isJournal || w.title.startsWith('Diario:')))
  const daysWithJournal = new Set<number>()

  journalNotes.forEach((w) => {
    const titleMatch = w.title.replace('Diario:', '').trim()
    // Compare if date matches current month & year
    for (let day = 1; day <= daysInMonth; day++) {
      const checkDate = new Date(year, month, day)
      const formatted = formatJournalDate(checkDate)
      if (w.journalDate === formatted || titleMatch === formatted) {
        daysWithJournal.add(day)
      }
    }
  })

  const handlePrevMonth = () => {
    setCurrentMonth(new Date(year, month - 1, 1))
  }

  const handleNextMonth = () => {
    setCurrentMonth(new Date(year, month + 1, 1))
  }

  const handleStepDay = (step: number) => {
    const d = new Date()
    d.setDate(d.getDate() + step)
    onSelectDate(d)
    onClose()
  }

  return (
    <>
      {/* Invisible backdrop */}
      <div className="fixed inset-0 z-40" onClick={onClose} />

      <div
        className="absolute left-4 bottom-14 z-50 w-72 bg-[var(--affine-background-overlay-panel-color)] border border-[var(--affine-border-color)] rounded-2xl shadow-[var(--affine-popover-shadow)] p-3 text-xs text-[var(--affine-text-primary-color)] animate-in fade-in zoom-in-95 duration-100 font-sans select-none"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Header */}
        <div className="flex items-center justify-between pb-2 border-b border-[var(--affine-divider-color)]">
          <div className="flex items-center gap-1.5 font-bold capitalize text-sm">
            <JournalIcon className="w-4 h-4 text-[var(--affine-primary-color)]" />
            <span>{monthName}</span>
          </div>

          <div className="flex items-center gap-0.5">
            <button
              onClick={handlePrevMonth}
              className="p-1 rounded-lg hover:bg-[var(--affine-hover-color)] text-[var(--affine-icon-color)] hover:text-[var(--affine-text-primary-color)] transition"
              title="Mes anterior"
            >
              <ToggleLeftIcon className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={handleNextMonth}
              className="p-1 rounded-lg hover:bg-[var(--affine-hover-color)] text-[var(--affine-icon-color)] hover:text-[var(--affine-text-primary-color)] transition"
              title="Mes siguiente"
            >
              <ToggleRightIcon className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Quick buttons: Ayer, Hoy, Mañana */}
        <div className="grid grid-cols-3 gap-1 py-2 border-b border-[var(--affine-divider-color)]">
          <button
            onClick={() => handleStepDay(-1)}
            className="py-1 px-1.5 rounded-lg bg-[var(--affine-hover-color)] hover:bg-[var(--affine-hover-color-filled)] text-[11px] font-medium transition text-center"
          >
            Ayer
          </button>
          <button
            onClick={() => handleStepDay(0)}
            className="py-1 px-1.5 rounded-lg bg-[var(--affine-primary-color)] text-white text-[11px] font-semibold transition text-center shadow-xs"
          >
            Hoy
          </button>
          <button
            onClick={() => handleStepDay(1)}
            className="py-1 px-1.5 rounded-lg bg-[var(--affine-hover-color)] hover:bg-[var(--affine-hover-color-filled)] text-[11px] font-medium transition text-center"
          >
            Mañana
          </button>
        </div>

        {/* Days of week */}
        <div className="grid grid-cols-7 gap-1 pt-2 pb-1 text-[10px] font-bold text-[var(--affine-text-secondary-color)] text-center">
          <span>L</span>
          <span>M</span>
          <span>X</span>
          <span>J</span>
          <span>V</span>
          <span>S</span>
          <span>D</span>
        </div>

        {/* Calendar Days Grid */}
        <div className="grid grid-cols-7 gap-1">
          {/* Empty prefix cells */}
          {Array.from({ length: startOffset }).map((_, i) => (
            <div key={`empty-${i}`} className="h-7" />
          ))}

          {/* Month Days */}
          {Array.from({ length: daysInMonth }).map((_, i) => {
            const dayNum = i + 1
            const isToday =
              today.getFullYear() === year &&
              today.getMonth() === month &&
              today.getDate() === dayNum
            const hasJournal = daysWithJournal.has(dayNum)

            return (
              <button
                key={dayNum}
                onClick={() => {
                  onSelectDate(new Date(year, month, dayNum))
                  onClose()
                }}
                className={`h-7 rounded-lg text-xs flex flex-col items-center justify-center relative transition ${
                  isToday
                    ? 'bg-[var(--affine-primary-color)] text-white font-bold shadow-xs'
                    : hasJournal
                    ? 'bg-[var(--affine-hover-color)] font-semibold text-[var(--affine-text-primary-color)] hover:bg-[var(--affine-hover-color-filled)]'
                    : 'text-[var(--affine-text-secondary-color)] hover:text-[var(--affine-text-primary-color)] hover:bg-[var(--affine-hover-color)]'
                }`}
              >
                <span>{dayNum}</span>
                {hasJournal && !isToday && (
                  <span className="w-1 h-1 rounded-full bg-[var(--affine-primary-color)] absolute bottom-0.5" />
                )}
              </button>
            )
          })}
        </div>
      </div>
    </>
  )
}
