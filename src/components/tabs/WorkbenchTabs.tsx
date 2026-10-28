import { useState, useRef, useEffect } from 'react'
import {
  CloseIcon,
  PlusIcon,
  PageIcon,
  EdgelessIcon,
  CopyIcon,
  PinIcon,
  DeleteIcon
} from '@blocksuite/icons/rc'
import { type WorkspaceItem } from '../../db'

export interface WorkbenchTab {
  id: string
  workspaceId: string
  pinned?: boolean
}

interface WorkbenchTabsProps {
  tabs: WorkbenchTab[]
  activeTabId: string
  workspaces: WorkspaceItem[]
  onSelectTab: (tabId: string) => void
  onCloseTab: (tabId: string) => void
  onCloseOtherTabs: (tabId: string) => void
  onNewTab: () => void
  onTogglePinTab: (tabId: string) => void
  onDuplicateTab: (tabId: string) => void
}

export function WorkbenchTabs({
  tabs,
  activeTabId,
  workspaces,
  onSelectTab,
  onCloseTab,
  onCloseOtherTabs,
  onNewTab,
  onTogglePinTab,
  onDuplicateTab
}: WorkbenchTabsProps) {
  const [contextMenu, setContextMenu] = useState<{
    x: number
    y: number
    tabId: string
  } | null>(null)

  const tabsContainerRef = useRef<HTMLDivElement>(null)

  // Close context menu on outside click
  useEffect(() => {
    const handleWindowClick = () => setContextMenu(null)
    window.addEventListener('click', handleWindowClick)
    return () => window.removeEventListener('click', handleWindowClick)
  }, [])

  return (
    <div className="h-9 border-b border-[var(--app-border)] bg-[var(--app-bg-secondary)] px-2 flex items-center justify-between shrink-0 select-none z-15 relative overflow-hidden">
      {/* Scrollable Tabs row */}
      <div
        ref={tabsContainerRef}
        className="flex items-center gap-1 overflow-x-auto no-scrollbar flex-1 h-full py-1 pr-2"
      >
        {tabs.map((tab) => {
          const ws = workspaces.find((w) => w.id === tab.workspaceId)
          const isActive = tab.id === activeTabId
          const title = ws?.title || 'Untitled'
          const icon = ws?.icon
          const viewMode = ws?.viewMode || 'doc'

          if (tab.pinned) {
            return (
              <div
                key={tab.id}
                onClick={() => onSelectTab(tab.id)}
                onAuxClick={(e) => {
                  if (e.button === 1) onCloseTab(tab.id)
                }}
                onContextMenu={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  setContextMenu({ x: e.clientX, y: e.clientY, tabId: tab.id })
                }}
                className={`flex items-center justify-center w-7 h-7 rounded-md cursor-pointer transition text-xs shrink-0 ${
                  isActive
                    ? 'bg-[var(--app-bg-primary)] text-[var(--app-text-primary)] shadow-xs font-semibold border border-[var(--app-border)]'
                    : 'text-[var(--app-text-secondary)] hover:text-[var(--app-text-primary)] hover:bg-[var(--app-hover)]'
                }`}
                title={`${title} (Pestaña fijada)`}
              >
                {icon ? (
                  <span className="text-sm">{icon}</span>
                ) : (
                  <PinIcon className="w-3.5 h-3.5 text-[var(--app-accent)]" />
                )}
              </div>
            )
          }

          return (
            <div
              key={tab.id}
              onClick={() => onSelectTab(tab.id)}
              onAuxClick={(e) => {
                if (e.button === 1) onCloseTab(tab.id)
              }}
              onContextMenu={(e) => {
                e.preventDefault()
                e.stopPropagation()
                setContextMenu({ x: e.clientX, y: e.clientY, tabId: tab.id })
              }}
              className={`group flex items-center gap-2 px-2.5 h-7 rounded-md text-xs cursor-pointer transition shrink-0 max-w-[200px] border ${
                isActive
                  ? 'bg-[var(--app-bg-primary)] text-[var(--app-text-primary)] font-medium border-[var(--app-border)] shadow-xs'
                  : 'border-transparent text-[var(--app-text-secondary)] hover:text-[var(--app-text-primary)] hover:bg-[var(--app-hover)]'
              }`}
            >
              {/* Tab Icon */}
              <span className="shrink-0 text-xs flex items-center justify-center">
                {icon ? (
                  <span className="text-sm leading-none">{icon}</span>
                ) : viewMode === 'canvas' ? (
                  <EdgelessIcon className="w-3.5 h-3.5 text-[var(--app-text-secondary)]" />
                ) : (
                  <PageIcon className="w-3.5 h-3.5 text-[var(--app-text-secondary)]" />
                )}
              </span>

              {/* Title */}
              <span className="truncate flex-1 max-w-[130px]">{title}</span>

              {/* Close Button */}
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  onCloseTab(tab.id)
                }}
                className={`p-0.5 rounded hover:bg-[var(--app-hover-filled)] text-[var(--app-text-muted)] hover:text-[var(--app-text-primary)] transition ${
                  isActive ? 'opacity-70 group-hover:opacity-100' : 'opacity-0 group-hover:opacity-100'
                }`}
                title="Cerrar pestaña (Clic central)"
              >
                <CloseIcon className="w-3 h-3" />
              </button>
            </div>
          )
        })}

        {/* New Tab (+) Button */}
        <button
          onClick={onNewTab}
          className="w-6 h-6 flex items-center justify-center rounded-md text-[var(--app-text-secondary)] hover:text-[var(--app-text-primary)] hover:bg-[var(--app-hover)] transition shrink-0 ml-0.5"
          title="Nueva pestaña"
        >
          <PlusIcon className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Tab Context Menu */}
      {contextMenu && (
        <div
          style={{ top: contextMenu.y, left: contextMenu.x }}
          className="fixed z-50 w-52 bg-[var(--app-bg-overlay)] border border-[var(--app-border)] rounded-lg shadow-[var(--app-shadow-popover)] p-1 text-xs text-[var(--app-text-primary)] animate-in fade-in zoom-in-95 duration-100"
          onClick={(e) => e.stopPropagation()}
        >
          <button
            onClick={() => {
              onTogglePinTab(contextMenu.tabId)
              setContextMenu(null)
            }}
            className="w-full text-left px-2.5 py-1.5 rounded-md hover:bg-[var(--app-hover)] flex items-center gap-2"
          >
            <PinIcon className="w-3.5 h-3.5 text-[var(--app-accent)]" />
            <span>
              {tabs.find((t) => t.id === contextMenu.tabId)?.pinned
                ? 'Desfijar pestaña'
                : 'Fijar pestaña'}
            </span>
          </button>

          <button
            onClick={() => {
              onDuplicateTab(contextMenu.tabId)
              setContextMenu(null)
            }}
            className="w-full text-left px-2.5 py-1.5 rounded-md hover:bg-[var(--app-hover)] flex items-center gap-2"
          >
            <CopyIcon className="w-3.5 h-3.5" />
            <span>Duplicar pestaña</span>
          </button>

          <div className="h-[1px] bg-[var(--app-divider)] my-1" />

          <button
            onClick={() => {
              onCloseOtherTabs(contextMenu.tabId)
              setContextMenu(null)
            }}
            className="w-full text-left px-2.5 py-1.5 rounded-md hover:bg-[var(--app-hover)] flex items-center gap-2"
          >
            <CloseIcon className="w-3.5 h-3.5" />
            <span>Cerrar otras pestañas</span>
          </button>

          <button
            onClick={() => {
              onCloseTab(contextMenu.tabId)
              setContextMenu(null)
            }}
            className="w-full text-left px-2.5 py-1.5 rounded-md hover:bg-rose-500/10 text-rose-500 flex items-center gap-2"
          >
            <DeleteIcon className="w-3.5 h-3.5" />
            <span>Cerrar pestaña</span>
          </button>
        </div>
      )}
    </div>
  )
}
