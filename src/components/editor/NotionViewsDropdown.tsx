import React, { useEffect, useRef } from 'react'
import {
  type NotionDatabaseViewType
} from '../../db'
import {
  NotionTableIcon,
  NotionBoardIcon,
  NotionListIcon,
  NotionTimelineIcon,
  NotionCalendarIcon,
  NotionGalleryIcon
} from './NotionIcons'

export interface NotionViewsDropdownProps {
  isOpen: boolean
  onClose: () => void
  onSelectView: (view: NotionDatabaseViewType) => void
  currentView?: NotionDatabaseViewType
  className?: string
  style?: React.CSSProperties
}

export const NOTION_TOOLS = [
  { id: 'table' as NotionDatabaseViewType, label: 'Table', Icon: NotionTableIcon },
  { id: 'board' as NotionDatabaseViewType, label: 'Board', Icon: NotionBoardIcon },
  { id: 'list' as NotionDatabaseViewType, label: 'List', Icon: NotionListIcon },
  { id: 'timeline' as NotionDatabaseViewType, label: 'Timeline', Icon: NotionTimelineIcon },
  { id: 'calendar' as NotionDatabaseViewType, label: 'Calendar', Icon: NotionCalendarIcon },
  { id: 'gallery' as NotionDatabaseViewType, label: 'Gallery', Icon: NotionGalleryIcon }
]

export const NotionViewsDropdown: React.FC<NotionViewsDropdownProps> = ({
  isOpen,
  onClose,
  onSelectView,
  currentView,
  className = '',
  style
}) => {
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!isOpen) return
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        onClose()
      }
    }
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [isOpen, onClose])

  if (!isOpen) return null

  return (
    <div
      ref={dropdownRef}
      style={style}
      className={`z-50 w-[calc(100vw-32px)] max-w-[180px] sm:min-w-[165px] bg-[#1a1b1e] text-zinc-100 border border-zinc-800/90 rounded-xl sm:rounded-2xl shadow-2xl p-1 sm:p-1.5 flex flex-col gap-0.5 animate-in fade-in zoom-in-95 duration-100 select-none max-h-[60vh] overflow-y-auto custom-scrollbar ${className}`}
      onClick={(e) => e.stopPropagation()}
    >
      {NOTION_TOOLS.map((tool) => {
        const Icon = tool.Icon
        const isSelected = currentView === tool.id
        return (
          <button
            key={tool.id}
            onClick={() => {
              onSelectView(tool.id)
              onClose()
            }}
            className={`w-full flex items-center gap-2 sm:gap-3 px-2 sm:px-3 py-1.5 sm:py-2 rounded-lg sm:rounded-xl text-xs sm:text-[13px] font-medium transition cursor-pointer text-left active:scale-[0.98] ${
              isSelected
                ? 'bg-white/15 text-white shadow-2xs'
                : 'text-zinc-200 hover:bg-white/10 hover:text-white'
            }`}
          >
            <Icon className="text-zinc-300 shrink-0" size={16} />
            <span className="flex-1 tracking-tight truncate">{tool.label}</span>
            {isSelected && <span className="w-1.5 h-1.5 rounded-full bg-blue-400 shrink-0" />}
          </button>
        )
      })}
    </div>
  )
}
