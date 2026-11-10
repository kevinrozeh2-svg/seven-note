import React, { useState, useRef, useEffect } from 'react'
import {
  CloseIcon,
  PlusIcon,
  PageIcon,
  EdgelessIcon,
  CopyIcon,
  PinIcon,
  DeleteIcon
} from '@blocksuite/icons/rc'
import {
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Search,
  RotateCcw,
  ArrowRight,
  X,
  PanelLeft
} from 'lucide-react'
import { type WorkspaceItem } from '../../db'
import { AppleEmoji, renderWithAppleEmoji } from '../ui/AppleEmoji'

export interface WorkbenchTab {
  id: string
  workspaceId: string
  pinned?: boolean
  viewType?: 'doc' | 'all-docs' | 'knowledge-graph' | 'trash' | 'templates' | 'tags'
  title?: string
  icon?: string
  spaceId?: string
}

export interface WorkbenchTabsProps {
  tabs: WorkbenchTab[]
  activeTabId: string
  workspaces: WorkspaceItem[]
  allWorkspaces?: WorkspaceItem[]
  onSelectTab: (tabId: string) => void
  onCloseTab: (tabId: string) => void
  onCloseOtherTabs: (tabId: string) => void
  onCloseTabsToRight?: (tabId: string) => void
  onReopenClosedTab?: () => void
  onReorderTabs?: (fromIndex: number, toIndex: number) => void
  canReopenClosedTab?: boolean
  onNewTab: () => void
  onTogglePinTab: (tabId: string) => void
  onDuplicateTab: (tabId: string) => void
  onToggleSidebar?: () => void
  sidebarOpen?: boolean
}

export function WorkbenchTabs({
  tabs,
  activeTabId,
  workspaces,
  allWorkspaces = workspaces,
  onSelectTab,
  onCloseTab,
  onCloseOtherTabs,
  onCloseTabsToRight,
  onReopenClosedTab,
  onReorderTabs,
  canReopenClosedTab = false,
  onNewTab,
  onTogglePinTab,
  onDuplicateTab,
  onToggleSidebar,
  sidebarOpen = true
}: WorkbenchTabsProps) {
  const [contextMenu, setContextMenu] = useState<{
    x: number
    y: number
    tabId: string
  } | null>(null)

  const [isTabSearchOpen, setIsTabSearchOpen] = useState(false)
  const [tabSearchFilter, setTabSearchFilter] = useState('')
  const [draggedTabId, setDraggedTabId] = useState<string | null>(null)
  const [dragOverTabId, setDragOverTabId] = useState<string | null>(null)
  const [dragPosition, setDragPosition] = useState<'left' | 'right'>('left')
  const [canScrollLeft, setCanScrollLeft] = useState(false)
  const [canScrollRight, setCanScrollRight] = useState(false)

  const tabsContainerRef = useRef<HTMLDivElement>(null)
  const tabRefs = useRef<Map<string, HTMLDivElement>>(new Map())

  // Update scroll buttons state
  const checkScrollState = () => {
    const el = tabsContainerRef.current
    if (!el) return
    setCanScrollLeft(el.scrollLeft > 2)
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 2)
  }

  useEffect(() => {
    checkScrollState()
    const el = tabsContainerRef.current
    if (!el) return
    const handleScroll = () => checkScrollState()
    el.addEventListener('scroll', handleScroll, { passive: true })
    window.addEventListener('resize', checkScrollState)
    return () => {
      el.removeEventListener('scroll', handleScroll)
      window.removeEventListener('resize', checkScrollState)
    }
  }, [tabs])

  // Auto-scroll active tab into view like a browser
  useEffect(() => {
    const activeEl = tabRefs.current.get(activeTabId)
    if (activeEl && tabsContainerRef.current) {
      activeEl.scrollIntoView({ behavior: 'smooth', inline: 'nearest', block: 'nearest' })
    }
    checkScrollState()
  }, [activeTabId])

  // Mouse wheel horizontal scrolling over tab bar
  const handleWheel = (e: React.WheelEvent) => {
    if (!tabsContainerRef.current) return
    if (Math.abs(e.deltaY) > 0) {
      tabsContainerRef.current.scrollLeft += e.deltaY
      e.stopPropagation()
    }
  }

  const scrollLeft = () => {
    if (tabsContainerRef.current) {
      tabsContainerRef.current.scrollBy({ left: -160, behavior: 'smooth' })
    }
  }

  const scrollRight = () => {
    if (tabsContainerRef.current) {
      tabsContainerRef.current.scrollBy({ left: 160, behavior: 'smooth' })
    }
  }

  // Close context menu and tab search on outside click
  useEffect(() => {
    const handleWindowClick = () => {
      setContextMenu(null)
      setIsTabSearchOpen(false)
    }
    window.addEventListener('click', handleWindowClick)
    return () => window.removeEventListener('click', handleWindowClick)
  }, [])

  // Resolve metadata (title, icon, viewMode) for each tab
  const getTabMeta = (tab: WorkbenchTab) => {
    if (tab.viewType === 'all-docs') {
      return { title: 'Todos los documentos', icon: '📑', viewMode: 'doc' }
    } else if (tab.viewType === 'knowledge-graph') {
      return { title: 'Grafo de Conocimiento', icon: '🌐', viewMode: 'doc' }
    } else if (tab.viewType === 'trash') {
      return { title: 'Papelera', icon: '🗑️', viewMode: 'doc' }
    } else if (tab.viewType === 'templates') {
      return { title: 'Plantillas', icon: '📋', viewMode: 'doc' }
    } else if (tab.viewType === 'tags') {
      return { title: 'Etiquetas', icon: '🏷️', viewMode: 'doc' }
    }

    const ws = (allWorkspaces.length > 0 ? allWorkspaces : workspaces).find(
      (w) => w.id === tab.workspaceId
    )

    const title = ws?.title || tab.title || 'Documento sin título'
    const icon = ws?.icon || tab.icon || ''
    const viewMode = ws?.viewMode || 'doc'

    return { title, icon, viewMode }
  }

  // Drag & drop handlers
  const handleDragStart = (e: React.DragEvent, tabId: string) => {
    setDraggedTabId(tabId)
    e.dataTransfer.setData('text/plain', tabId)
    e.dataTransfer.effectAllowed = 'move'
  }

  const handleDragOver = (e: React.DragEvent, tabId: string) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    if (draggedTabId === tabId) return

    const rect = e.currentTarget.getBoundingClientRect()
    const relX = e.clientX - rect.left
    setDragOverTabId(tabId)
    setDragPosition(relX < rect.width / 2 ? 'left' : 'right')
  }

  const handleDrop = (e: React.DragEvent, targetTabId: string) => {
    e.preventDefault()
    if (!draggedTabId || draggedTabId === targetTabId || !onReorderTabs) {
      setDraggedTabId(null)
      setDragOverTabId(null)
      return
    }

    const sourceIndex = tabs.findIndex((t) => t.id === draggedTabId)
    const targetIndex = tabs.findIndex((t) => t.id === targetTabId)

    if (sourceIndex !== -1 && targetIndex !== -1) {
      let finalIndex = targetIndex
      if (dragPosition === 'right' && sourceIndex < targetIndex) {
        finalIndex = targetIndex
      } else if (dragPosition === 'right' && sourceIndex > targetIndex) {
        finalIndex = targetIndex + 1
      } else if (dragPosition === 'left' && sourceIndex < targetIndex) {
        finalIndex = targetIndex - 1
      }
      onReorderTabs(sourceIndex, Math.max(0, Math.min(tabs.length - 1, finalIndex)))
    }

    setDraggedTabId(null)
    setDragOverTabId(null)
  }

  const handleDragEnd = () => {
    setDraggedTabId(null)
    setDragOverTabId(null)
  }

  // Filter tabs for search popover
  const filteredTabs = tabs.filter((t) => {
    if (!tabSearchFilter.trim()) return true
    const meta = getTabMeta(t)
    return meta.title.toLowerCase().includes(tabSearchFilter.toLowerCase())
  })

  return (
    <div className="h-9 border-b border-[var(--app-border)] bg-[var(--app-bg-secondary)] px-1.5 flex items-center justify-between shrink-0 select-none z-30 relative">
      {/* Sidebar toggle button (visible on mobile or when sidebar is collapsed) */}
      {onToggleSidebar && (
        <button
          onClick={onToggleSidebar}
          className={`w-6 h-6 rounded-md hover:bg-[var(--app-hover)] text-[var(--app-text-secondary)] hover:text-[var(--app-text-primary)] flex items-center justify-center shrink-0 mr-1 transition cursor-pointer ${
            sidebarOpen ? 'md:hidden' : ''
          }`}
          title="Alternar barra lateral"
        >
          <PanelLeft className="w-3.5 h-3.5" />
        </button>
      )}

      {/* Scroll Left Button if overflow */}
      {canScrollLeft && (
        <button
          onClick={scrollLeft}
          className="w-5 h-7 rounded hover:bg-[var(--app-hover)] text-[var(--app-text-secondary)] hover:text-[var(--app-text-primary)] flex items-center justify-center shrink-0 mr-1 z-10 transition cursor-pointer"
          title="Desplazar pestañas a la izquierda"
        >
          <ChevronLeft className="w-3.5 h-3.5" />
        </button>
      )}

      {/* Scrollable Tabs row */}
      <div
        ref={tabsContainerRef}
        onWheel={handleWheel}
        className="flex items-center gap-1 overflow-x-auto overflow-y-hidden no-scrollbar flex-1 h-full pr-1 touch-pan-x"
      >
        {tabs.map((tab, index) => {
          const isActive = tab.id === activeTabId
          const meta = getTabMeta(tab)
          const isDragging = draggedTabId === tab.id
          const isOver = dragOverTabId === tab.id

          // Pinned Tab (Compact, icon-only)
          if (tab.pinned) {
            return (
              <div
                key={tab.id}
                ref={(el) => {
                  if (el) tabRefs.current.set(tab.id, el)
                  else tabRefs.current.delete(tab.id)
                }}
                onClick={() => onSelectTab(tab.id)}
                onAuxClick={(e) => {
                  if (e.button === 1) {
                    e.preventDefault()
                    onCloseTab(tab.id)
                  }
                }}
                onContextMenu={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  setContextMenu({ x: e.clientX, y: e.clientY, tabId: tab.id })
                }}
                className={`flex items-center justify-center w-7 h-7 rounded-md cursor-pointer transition text-xs shrink-0 select-none ${
                  isActive
                    ? 'bg-[var(--app-bg-primary)] text-[var(--app-text-primary)] shadow-xs font-semibold border border-[var(--app-border)] ring-1 ring-blue-500/20'
                    : 'text-[var(--app-text-secondary)] hover:text-[var(--app-text-primary)] hover:bg-[var(--app-hover)]'
                }`}
                title={`${meta.title} (Pestaña fijada)`}
              >
                {meta.icon ? (
                  <span className="text-sm shrink-0 flex items-center justify-center">
                    <AppleEmoji emoji={meta.icon} size={15} />
                  </span>
                ) : (
                  <PinIcon className="w-3.5 h-3.5 text-[var(--app-accent)]" />
                )}
              </div>
            )
          }

          // Regular Browser Tab (Shrinks gracefully with max-w & min-w, smooth ellipsis)
          return (
            <div
              key={tab.id}
              ref={(el) => {
                if (el) tabRefs.current.set(tab.id, el)
                else tabRefs.current.delete(tab.id)
              }}
              draggable={!tab.pinned}
              onDragStart={(e) => handleDragStart(e, tab.id)}
              onDragOver={(e) => handleDragOver(e, tab.id)}
              onDrop={(e) => handleDrop(e, tab.id)}
              onDragEnd={handleDragEnd}
              onClick={() => onSelectTab(tab.id)}
              onAuxClick={(e) => {
                if (e.button === 1) {
                  e.preventDefault()
                  onCloseTab(tab.id)
                }
              }}
              onContextMenu={(e) => {
                e.preventDefault()
                e.stopPropagation()
                setContextMenu({ x: e.clientX, y: e.clientY, tabId: tab.id })
              }}
              className={`group flex items-center gap-1.5 px-2 sm:px-2.5 h-7 rounded-md text-xs cursor-pointer transition select-none min-w-[75px] sm:min-w-[90px] max-w-[130px] sm:max-w-[190px] flex-1 border ${
                isDragging ? 'opacity-40 scale-[0.98]' : 'opacity-100'
              } ${
                isOver && dragPosition === 'left'
                  ? 'border-l-2 border-l-blue-500'
                  : isOver && dragPosition === 'right'
                  ? 'border-r-2 border-r-blue-500'
                  : ''
              } ${
                isActive
                  ? 'bg-[var(--app-bg-primary)] text-[var(--app-text-primary)] font-medium border-[var(--app-border)] shadow-xs'
                  : 'border-transparent text-[var(--app-text-secondary)] hover:text-[var(--app-text-primary)] hover:bg-[var(--app-hover)]'
              }`}
              title={meta.title}
            >
              {/* Tab Icon */}
              <span className="shrink-0 text-xs flex items-center justify-center">
                {meta.icon ? (
                  <AppleEmoji emoji={meta.icon} size={14} className="shrink-0" />
                ) : meta.viewMode === 'canvas' ? (
                  <EdgelessIcon className="w-3.5 h-3.5 text-[var(--app-text-secondary)]" />
                ) : (
                  <PageIcon className="w-3.5 h-3.5 text-[var(--app-text-secondary)]" />
                )}
              </span>

              {/* Title */}
              <span className="truncate flex-1 min-w-0 text-left">{renderWithAppleEmoji(meta.title)}</span>

              {/* Close Button 'x' (Browser style: visible on active, hover on inactive) */}
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  onCloseTab(tab.id)
                }}
                className={`p-0.5 rounded hover:bg-[var(--app-hover-filled)] text-[var(--app-text-muted)] hover:text-[var(--app-text-primary)] transition shrink-0 ${
                  isActive ? 'opacity-70 group-hover:opacity-100' : 'opacity-0 group-hover:opacity-100'
                }`}
                title="Cerrar pestaña (Ctrl+W / Clic central)"
              >
                <CloseIcon className="w-3 h-3" />
              </button>

              {/* Subtle separator between inactive tabs (Google Chrome look) */}
              {!isActive &&
                tabs[index + 1] &&
                tabs[index + 1].id !== activeTabId &&
                !tabs[index + 1].pinned && (
                  <span className="absolute right-0 top-1.5 bottom-1.5 w-px bg-[var(--app-divider)] pointer-events-none group-hover:opacity-0" />
                )}
            </div>
          )
        })}

        {/* New Tab (+) Button */}
        <button
          onClick={onNewTab}
          className="w-6 h-6 flex items-center justify-center rounded-md text-[var(--app-text-secondary)] hover:text-[var(--app-text-primary)] hover:bg-[var(--app-hover)] transition shrink-0 ml-0.5 cursor-pointer"
          title="Nueva pestaña (Ctrl+T)"
        >
          <PlusIcon className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Scroll Right Button if overflow */}
      {canScrollRight && (
        <button
          onClick={scrollRight}
          className="w-5 h-7 rounded hover:bg-[var(--app-hover)] text-[var(--app-text-secondary)] hover:text-[var(--app-text-primary)] flex items-center justify-center shrink-0 ml-1 z-10 transition cursor-pointer"
          title="Desplazar pestañas a la derecha"
        >
          <ChevronRight className="w-3.5 h-3.5" />
        </button>
      )}

      {/* Tab Overview / Search Dropdown button (Chrome style) */}
      <div className="relative shrink-0 ml-1">
        <button
          onClick={(e) => {
            e.stopPropagation()
            setIsTabSearchOpen((prev) => !prev)
          }}
          className={`w-6 h-6 rounded-md hover:bg-[var(--app-hover)] text-[var(--app-text-secondary)] hover:text-[var(--app-text-primary)] flex items-center justify-center transition cursor-pointer ${
            isTabSearchOpen ? 'bg-[var(--app-hover)] text-[var(--app-text-primary)]' : ''
          }`}
          title="Buscar pestañas abiertas"
        >
          <ChevronDown className="w-3.5 h-3.5" />
        </button>

        {/* Tab Search Popover */}
        {isTabSearchOpen && (
          <div
            onClick={(e) => e.stopPropagation()}
            className="absolute right-0 top-8 w-[calc(100vw-24px)] sm:w-72 max-h-[min(380px,75vh)] rounded-xl bg-[var(--app-bg-overlay)] border border-[var(--app-border)] shadow-[var(--app-shadow-popover)] p-1.5 sm:p-2 z-50 animate-in fade-in zoom-in-95 flex flex-col text-[11px] sm:text-xs text-[var(--app-text-primary)]"
          >
            {/* Search Input */}
            <div className="flex items-center gap-2 px-2 sm:px-2.5 py-1 sm:py-1.5 rounded-lg bg-[var(--app-bg-secondary)] border border-[var(--app-border)] mb-1.5 sm:mb-2">
              <Search className="w-3.5 h-3.5 text-[var(--app-text-secondary)] shrink-0" />
              <input
                type="text"
                value={tabSearchFilter}
                onChange={(e) => setTabSearchFilter(e.target.value)}
                placeholder="Buscar pestañas..."
                autoFocus
                className="bg-transparent text-xs text-[var(--app-text-primary)] placeholder-[var(--app-text-muted)] outline-none w-full"
              />
              {tabSearchFilter && (
                <button
                  onClick={() => setTabSearchFilter('')}
                  className="text-[var(--app-text-secondary)] hover:text-[var(--app-text-primary)]"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>

            <div className="px-2 py-1 text-[10px] font-bold text-[var(--app-text-secondary)] uppercase tracking-wider flex items-center justify-between">
              <span>Pestañas abiertas ({tabs.length})</span>
              {canReopenClosedTab && onReopenClosedTab && (
                <button
                  onClick={() => {
                    onReopenClosedTab()
                    setIsTabSearchOpen(false)
                  }}
                  className="text-blue-500 hover:underline flex items-center gap-1 font-normal lowercase text-[11px]"
                >
                  <RotateCcw className="w-2.5 h-2.5" />
                  reabrir cerrada
                </button>
              )}
            </div>

            {/* List */}
            <div className="overflow-y-auto max-h-60 space-y-0.5 pr-0.5">
              {filteredTabs.map((t) => {
                const meta = getTabMeta(t)
                const isSelected = t.id === activeTabId
                return (
                  <div
                    key={t.id}
                    onClick={() => {
                      onSelectTab(t.id)
                      setIsTabSearchOpen(false)
                    }}
                    className={`group flex items-center justify-between px-2.5 py-1.5 rounded-lg cursor-pointer transition ${
                      isSelected
                        ? 'bg-blue-500/10 text-blue-500 font-semibold'
                        : 'hover:bg-[var(--app-hover)] text-[var(--app-text-primary)]'
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <span className="shrink-0 text-xs">
                        {meta.icon ? (
                          <AppleEmoji emoji={meta.icon} size={14} />
                        ) : (
                          <PageIcon className="w-3.5 h-3.5 text-[var(--app-text-secondary)]" />
                        )}
                      </span>
                      <span className="truncate text-xs">{renderWithAppleEmoji(meta.title)}</span>
                    </div>

                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        onCloseTab(t.id)
                      }}
                      className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-[var(--app-hover-filled)] text-[var(--app-text-muted)] hover:text-[var(--app-text-primary)] transition"
                      title="Cerrar pestaña"
                    >
                      <CloseIcon className="w-3 h-3" />
                    </button>
                  </div>
                )
              })}

              {filteredTabs.length === 0 && (
                <div className="py-6 text-center text-[var(--app-text-muted)] text-xs">
                  No se encontraron pestañas coincidentes
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Tab Context Menu (Right Click) */}
      {contextMenu && (
        <div
          style={{
            top: typeof window !== 'undefined' ? Math.max(12, Math.min(contextMenu.y, window.innerHeight - 250)) : contextMenu.y,
            left: typeof window !== 'undefined' ? Math.max(12, Math.min(contextMenu.x, window.innerWidth - 220)) : contextMenu.x
          }}
          className="fixed z-50 w-[calc(100vw-32px)] max-w-[210px] sm:w-56 bg-[var(--app-bg-overlay)] border border-[var(--app-border)] rounded-xl shadow-[var(--app-shadow-popover)] p-1 sm:p-1.5 text-[11px] sm:text-xs text-[var(--app-text-primary)] animate-in fade-in zoom-in-95 duration-100 space-y-0.5 max-h-[min(340px,75vh)] overflow-y-auto custom-scrollbar"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Nueva pestaña */}
          <button
            onClick={() => {
              onNewTab()
              setContextMenu(null)
            }}
            className="w-full text-left px-2 sm:px-2.5 py-1 sm:py-1.5 rounded-md sm:rounded-lg hover:bg-[var(--app-hover)] flex items-center justify-between transition cursor-pointer"
          >
            <div className="flex items-center gap-2">
              <PlusIcon className="w-3.5 h-3.5" />
              <span>Nueva pestaña</span>
            </div>
            <kbd className="text-[9px] sm:text-[10px] text-[var(--app-text-secondary)] font-mono">Ctrl+T</kbd>
          </button>

          {/* Fijar pestaña */}
          <button
            onClick={() => {
              onTogglePinTab(contextMenu.tabId)
              setContextMenu(null)
            }}
            className="w-full text-left px-2 sm:px-2.5 py-1 sm:py-1.5 rounded-md sm:rounded-lg hover:bg-[var(--app-hover)] flex items-center gap-2 transition cursor-pointer"
          >
            <PinIcon className="w-3.5 h-3.5 text-[var(--app-accent)]" />
            <span>
              {tabs.find((t) => t.id === contextMenu.tabId)?.pinned
                ? 'Desfijar pestaña'
                : 'Fijar pestaña'}
            </span>
          </button>

          {/* Duplicar pestaña */}
          <button
            onClick={() => {
              onDuplicateTab(contextMenu.tabId)
              setContextMenu(null)
            }}
            className="w-full text-left px-2 sm:px-2.5 py-1 sm:py-1.5 rounded-md sm:rounded-lg hover:bg-[var(--app-hover)] flex items-center gap-2 transition cursor-pointer"
          >
            <CopyIcon className="w-3.5 h-3.5" />
            <span>Duplicar pestaña</span>
          </button>

          <div className="h-[1px] bg-[var(--app-divider)] my-0.5 sm:my-1" />

          {/* Reabrir pestaña cerrada */}
          {onReopenClosedTab && (
            <button
              disabled={!canReopenClosedTab}
              onClick={() => {
                onReopenClosedTab()
                setContextMenu(null)
              }}
              className={`w-full text-left px-2 sm:px-2.5 py-1 sm:py-1.5 rounded-md sm:rounded-lg flex items-center justify-between transition ${
                canReopenClosedTab
                  ? 'hover:bg-[var(--app-hover)] cursor-pointer'
                  : 'opacity-40 cursor-not-allowed'
              }`}
            >
              <div className="flex items-center gap-2">
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Reabrir pestaña cerrada</span>
              </div>
              <kbd className="text-[9px] sm:text-[10px] text-[var(--app-text-secondary)] font-mono">Ctrl+Shift+T</kbd>
            </button>
          )}

          {/* Cerrar pestañas a la derecha */}
          {onCloseTabsToRight && (
            <button
              onClick={() => {
                onCloseTabsToRight(contextMenu.tabId)
                setContextMenu(null)
              }}
              className="w-full text-left px-2 sm:px-2.5 py-1 sm:py-1.5 rounded-md sm:rounded-lg hover:bg-[var(--app-hover)] flex items-center gap-2 transition cursor-pointer"
            >
              <ArrowRight className="w-3.5 h-3.5 text-[var(--app-text-secondary)]" />
              <span>Cerrar pestañas a la derecha</span>
            </button>
          )}

          {/* Cerrar otras pestañas */}
          <button
            onClick={() => {
              onCloseOtherTabs(contextMenu.tabId)
              setContextMenu(null)
            }}
            className="w-full text-left px-2 sm:px-2.5 py-1 sm:py-1.5 rounded-md sm:rounded-lg hover:bg-[var(--app-hover)] flex items-center gap-2 transition cursor-pointer"
          >
            <CloseIcon className="w-3.5 h-3.5" />
            <span>Cerrar otras pestañas</span>
          </button>

          <div className="h-[1px] bg-[var(--app-divider)] my-0.5 sm:my-1" />

          {/* Cerrar pestaña */}
          <button
            onClick={() => {
              onCloseTab(contextMenu.tabId)
              setContextMenu(null)
            }}
            className="w-full text-left px-2 sm:px-2.5 py-1 sm:py-1.5 rounded-md sm:rounded-lg hover:bg-rose-500/10 text-rose-500 flex items-center justify-between transition cursor-pointer"
          >
            <div className="flex items-center gap-2">
              <DeleteIcon className="w-3.5 h-3.5" />
              <span>Cerrar pestaña</span>
            </div>
            <kbd className="text-[10px] opacity-70 font-mono">Ctrl+W</kbd>
          </button>
        </div>
      )}
    </div>
  )
}
