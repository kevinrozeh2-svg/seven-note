import { useState } from 'react'
import {
  TocIcon,
  JournalIcon,
  PropertyIcon,
  MoreHorizontalIcon,
  PlusIcon,
  CloseIcon,
  DoneIcon,
  ToggleDownIcon,
  ToggleRightIcon,
  DeleteIcon
} from '@blocksuite/icons/rc'
import { db, type WorkspaceItem, type CustomPropertyItem } from '../../db'
import { syncEngine } from '../../lib/syncEngine'
import {
  BUILT_IN_PROPERTIES,
  ADDABLE_PROPERTIES,
  VISIBILITY_LABELS,
  type PropertyVisibility
} from '../../lib/properties'

interface RightSidebarProps {
  workspace: WorkspaceItem | undefined
  isOpen: boolean
  onClose: () => void
  activeTab: 'properties' | 'outline' | 'history'
  onTabChange: (tab: 'properties' | 'outline' | 'history') => void
  onScrollToHeading?: (headingText: string) => void
  readOnly?: boolean
}

export function RightSidebar({
  workspace,
  isOpen,
  onClose,
  activeTab,
  onTabChange,
  onScrollToHeading,
  readOnly = false
}: RightSidebarProps) {
  const [propertiesExpanded, setPropertiesExpanded] = useState(true)
  const [addPropertiesExpanded, setAddPropertiesExpanded] = useState(true)
  const [activeMenuPropId, setActiveMenuPropId] = useState<string | null>(null)
  const [editingPropId, setEditingPropId] = useState<string | null>(null)
  const [newTagInput, setNewTagInput] = useState('')

  if (!isOpen || !workspace) return null

  // Active property IDs list (defaults if not present)
  const activePropIds: string[] = workspace.activeProperties && workspace.activeProperties.length > 0
    ? workspace.activeProperties
    : [
        'tags',
        'documentMode',
        'isJournal',
        'templateName',
        'createdAt',
        'updatedAt',
        'createdBy',
        'borderlessTheme',
        'pageWidth'
      ]

  const visibilityMap: Record<string, PropertyVisibility> = {
    tags: 'always_show',
    documentMode: 'always_hide',
    isJournal: 'always_hide',
    templateName: 'always_hide',
    createdAt: 'always_show',
    updatedAt: 'always_show',
    createdBy: 'always_hide',
    borderlessTheme: 'always_hide',
    pageWidth: 'always_show',
    ...(workspace.propertyVisibility || {})
  }

  // Update property visibility in database
  const handleSetVisibility = async (propId: string, visibility: PropertyVisibility) => {
    if (readOnly) return
    const updatedMap = {
      ...visibilityMap,
      [propId]: visibility
    }
    await db.workspaces.update(workspace.id, {
      propertyVisibility: updatedMap,
      updatedAt: Date.now(),
      syncStatus: 'pending'
    })
    syncEngine.scheduleSync(1000)
    setActiveMenuPropId(null)
  }

  // Remove a property from active list
  const handleRemoveProperty = async (propId: string) => {
    if (readOnly) return
    const newActive = activePropIds.filter((id) => id !== propId)
    const customProps = (workspace.customProperties || []).filter((cp) => cp.id !== propId)

    await db.workspaces.update(workspace.id, {
      activeProperties: newActive,
      customProperties: customProps,
      updatedAt: Date.now(),
      syncStatus: 'pending'
    })
    syncEngine.scheduleSync(1000)
    setActiveMenuPropId(null)
  }

  // Add a property to active list
  const handleAddProperty = async (propToAdd: typeof ADDABLE_PROPERTIES[0]) => {
    if (readOnly) return
    if (propToAdd.isCustom) {
      // Create new custom property
      const customId = `custom_${Date.now()}`
      const newCustomProp: CustomPropertyItem = {
        id: customId,
        name: propToAdd.name,
        type: (propToAdd.type as any) || 'text',
        value: propToAdd.type === 'checkbox' ? false : '',
        visibility: 'always_show'
      }

      const newCustomList = [...(workspace.customProperties || []), newCustomProp]
      const newActive = [...activePropIds, customId]

      await db.workspaces.update(workspace.id, {
        activeProperties: newActive,
        customProperties: newCustomList,
        propertyVisibility: { ...visibilityMap, [customId]: 'always_show' },
        updatedAt: Date.now(),
        syncStatus: 'pending'
      })
    } else {
      // Built-in property
      if (!activePropIds.includes(propToAdd.id)) {
        const newActive = [...activePropIds, propToAdd.id]
        await db.workspaces.update(workspace.id, {
          activeProperties: newActive,
          propertyVisibility: {
            ...visibilityMap,
            [propToAdd.id]: visibilityMap[propToAdd.id] || 'always_show'
          },
          updatedAt: Date.now(),
          syncStatus: 'pending'
        })
      }
    }
    syncEngine.scheduleSync(1000)
  }

  // Add a tag to tags array
  const handleAddTag = async () => {
    if (!newTagInput.trim()) return
    const currentTags = workspace.tags || []
    if (!currentTags.includes(newTagInput.trim())) {
      const updated = [...currentTags, newTagInput.trim()]
      await db.workspaces.update(workspace.id, {
        tags: updated,
        updatedAt: Date.now(),
        syncStatus: 'pending'
      })
      syncEngine.scheduleSync(1000)
    }
    setNewTagInput('')
  }

  const handleRemoveTag = async (tagToRemove: string) => {
    const currentTags = workspace.tags || []
    const updated = currentTags.filter((t) => t !== tagToRemove)
    await db.workspaces.update(workspace.id, {
      tags: updated,
      updatedAt: Date.now(),
      syncStatus: 'pending'
    })
    syncEngine.scheduleSync(1000)
  }

  // Update specific workspace field value
  const handleUpdateFieldValue = async (field: keyof WorkspaceItem, value: any) => {
    await db.workspaces.update(workspace.id, {
      [field]: value,
      updatedAt: Date.now(),
      syncStatus: 'pending'
    })
    syncEngine.scheduleSync(1000)
  }

  // Update custom property value
  const handleUpdateCustomPropValue = async (customId: string, val: any) => {
    const list = (workspace.customProperties || []).map((cp) => {
      if (cp.id === customId) return { ...cp, value: val }
      return cp
    })
    await db.workspaces.update(workspace.id, {
      customProperties: list,
      updatedAt: Date.now(),
      syncStatus: 'pending'
    })
    syncEngine.scheduleSync(1000)
  }

  // Generate headings outline from docContent safely using inert DOMParser (prevents DOM XSS)
  const extractHeadings = () => {
    if (!workspace.docContent) return []
    const doc = new DOMParser().parseFromString(workspace.docContent, 'text/html')
    const headings = doc.body.querySelectorAll('h1, h2, h3')
    return Array.from(headings).map((h, i) => ({
      id: `heading-${i}`,
      level: parseInt(h.tagName.substring(1)),
      text: h.textContent || 'Sin título'
    }))
  }

  const headings = extractHeadings()

  return (
    <>
      <div
        className="fixed inset-0 bg-black/40 backdrop-blur-xs z-40 md:hidden animate-in fade-in duration-150"
        onClick={onClose}
      />
      <aside className="fixed inset-y-0 right-0 md:relative z-50 md:z-20 w-80 max-w-[85vw] h-full bg-[var(--app-bg-secondary)] border-l border-[var(--app-border)] shadow-2xl md:shadow-none flex flex-col shrink-0 select-none text-[var(--app-text-primary)] text-sm">
      {/* Top Header Icon Tabs */}
      <div className="h-12 border-b border-[var(--app-border)] flex items-center justify-between px-3 shrink-0">
        <div role="tablist" aria-label="Inspector del documento" className="flex items-center gap-1">
          {/* Outline Tab */}
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'outline'}
            aria-label="Esquema del documento"
            onClick={() => onTabChange('outline')}
            className={`w-8 h-8 rounded-md flex items-center justify-center transition cursor-pointer ${
              activeTab === 'outline'
                ? 'bg-[var(--app-active)] text-[var(--app-text-primary)] font-semibold'
                : 'text-[var(--app-text-secondary)] hover:text-[var(--app-text-primary)] hover:bg-[var(--app-hover)]'
            }`}
            title="Esquema del documento"
          >
            <TocIcon className="w-[18px] h-[18px]" />
          </button>

          {/* Journal / Calendar Tab */}
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'history'}
            aria-label="Actividad e historial"
            onClick={() => onTabChange('history')}
            className={`w-8 h-8 rounded-md flex items-center justify-center transition cursor-pointer ${
              activeTab === 'history'
                ? 'bg-[var(--app-active)] text-[var(--app-text-primary)] font-semibold'
                : 'text-[var(--app-text-secondary)] hover:text-[var(--app-text-primary)] hover:bg-[var(--app-hover)]'
            }`}
            title="Actividad e historial"
          >
            <JournalIcon className="w-[18px] h-[18px]" />
          </button>

          {/* Properties Tab */}
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'properties'}
            aria-label="Propiedades del documento"
            onClick={() => onTabChange('properties')}
            className={`w-8 h-8 rounded-md flex items-center justify-center transition cursor-pointer ${
              activeTab === 'properties'
                ? 'bg-[var(--app-active)] text-[var(--app-text-primary)] font-semibold'
                : 'text-[var(--app-text-secondary)] hover:text-[var(--app-text-primary)] hover:bg-[var(--app-hover)]'
            }`}
            title="Propiedades del documento"
          >
            <PropertyIcon className="w-[18px] h-[18px]" />
          </button>
        </div>

        {/* Close Right Sidebar Button */}
        <button
          type="button"
          onClick={onClose}
          aria-label="Cerrar panel lateral"
          className="w-8 h-8 rounded-md flex items-center justify-center text-[var(--app-text-secondary)] hover:text-[var(--app-text-primary)] hover:bg-[var(--app-hover)] transition cursor-pointer"
          title="Cerrar panel lateral"
        >
          <CloseIcon className="w-[18px] h-[18px]" />
        </button>
      </div>

      {/* Tab 1: Properties Inspector */}
      {activeTab === 'properties' && (
        <div className="flex-1 overflow-y-auto divide-y divide-[var(--app-divider)] py-2 text-sm">
          {/* Section: Propiedades */}
          <div className="px-3 pb-3">
            <button
              type="button"
              onClick={() => setPropertiesExpanded(!propertiesExpanded)}
              className="w-full flex items-center justify-between py-2 text-[var(--app-text-primary)] font-semibold text-sm hover:text-[var(--app-accent)] transition cursor-pointer"
            >
              <div className="flex items-center gap-1.5">
                <span>Propiedades</span>
                {propertiesExpanded ? <ToggleDownIcon className="w-4 h-4" /> : <ToggleRightIcon className="w-4 h-4" />}
              </div>
            </button>

            {propertiesExpanded && (
              <div className="space-y-1 mt-1">
                {activePropIds.map((propId) => {
                  // Check if built-in
                  const builtIn = BUILT_IN_PROPERTIES.find((p) => p.id === propId)
                  // Check if custom
                  const custom = (workspace.customProperties || []).find((p) => p.id === propId)

                  if (!builtIn && !custom) return null

                  const name = builtIn?.name || custom?.name || propId
                  const Icon = builtIn?.icon
                  const visibility = visibilityMap[propId] || 'always_show'
                  const visibilityLabel = VISIBILITY_LABELS[visibility]

                  return (
                    <div
                      key={propId}
                      className="group flex items-center justify-between py-1.5 px-2 rounded-md hover:bg-[var(--affine-hover-color)] transition relative"
                    >
                      {/* Left: Icon + Name */}
                      <div className="flex items-center gap-2 min-w-0 flex-1 mr-2">
                        {Icon ? (
                          <Icon size={14} className="text-[var(--affine-text-secondary-color)] shrink-0" />
                        ) : (
                          <PropertyIcon className="w-3.5 h-3.5 text-[var(--affine-text-secondary-color)] shrink-0" />
                        )}
                        <span className="truncate text-[var(--affine-text-primary-color)]">
                          {name}
                        </span>
                      </div>

                      {/* Right: Visibility label & ... menu */}
                      <div className="flex items-center gap-1 shrink-0">
                        <span className="text-[11px] text-[var(--affine-text-secondary-color)] font-normal">
                          {visibilityLabel}
                        </span>

                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            setActiveMenuPropId(activeMenuPropId === propId ? null : propId)
                          }}
                          className="p-1 rounded text-[var(--affine-text-secondary-color)] hover:text-[var(--affine-text-primary-color)] hover:bg-[var(--affine-hover-color)] transition"
                        >
                          <MoreHorizontalIcon className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      {/* Property Options Dropdown Menu */}
                      {activeMenuPropId === propId && (
                        <>
                          <div
                            className="fixed inset-0 z-20"
                            onClick={() => setActiveMenuPropId(null)}
                          />
                          <div
                            className="absolute right-2 top-8 z-30 w-48 bg-[var(--affine-background-overlay-panel-color)] border border-[var(--affine-border-color)] rounded-xl shadow-[var(--affine-popover-shadow)] py-1 text-xs text-[var(--affine-text-primary-color)] backdrop-blur-md"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <div className="px-3 py-1 text-[10px] uppercase font-semibold text-[var(--affine-text-secondary-color)] tracking-wider">
                              Visibilidad
                            </div>
                            <button
                              type="button"
                              onClick={() => handleSetVisibility(propId, 'always_show')}
                              className="w-full text-left px-3 py-1.5 hover:bg-[var(--app-hover)] flex items-center justify-between transition"
                            >
                              <span>Siempre mostrar</span>
                              {visibility === 'always_show' && <DoneIcon className="w-3.5 h-3.5 text-[var(--app-accent)]" />}
                            </button>
                            <button
                              type="button"
                              onClick={() => handleSetVisibility(propId, 'always_hide')}
                              className="w-full text-left px-3 py-1.5 hover:bg-[var(--app-hover)] flex items-center justify-between transition"
                            >
                              <span>Siempre ocultar</span>
                              {visibility === 'always_hide' && <DoneIcon className="w-3.5 h-3.5 text-[var(--app-accent)]" />}
                            </button>
                            <button
                              type="button"
                              onClick={() => handleSetVisibility(propId, 'hide_empty')}
                              className="w-full text-left px-3 py-1.5 hover:bg-[var(--app-hover)] flex items-center justify-between transition"
                            >
                              <span>Ocultar cuando esté vacío</span>
                              {visibility === 'hide_empty' && <DoneIcon className="w-3.5 h-3.5 text-[var(--app-accent)]" />}
                            </button>

                            <div className="border-t border-[var(--affine-divider-color)] my-1" />

                            <button
                              onClick={() => {
                                setEditingPropId(editingPropId === propId ? null : propId)
                                setActiveMenuPropId(null)
                              }}
                              className="w-full text-left px-3 py-1.5 hover:bg-[var(--affine-hover-color)] text-[var(--affine-text-primary-color)] transition"
                            >
                              Editar valor
                            </button>

                            <button
                              onClick={() => handleRemoveProperty(propId)}
                              className="w-full text-left px-3 py-1.5 hover:bg-rose-500/10 text-rose-500 flex items-center gap-1.5 transition"
                            >
                              <DeleteIcon className="w-3.5 h-3.5" />
                              <span>Eliminar propiedad</span>
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  )
                })}
              </div>
            )}

            {/* Quick Inline Value Editor for Open Property */}
            {editingPropId && (
              <div className="mt-2 p-2.5 bg-[var(--affine-background-primary-color)] rounded-xl border border-[var(--affine-border-color)]">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-semibold text-[11px] text-[var(--app-text-primary)]">
                    Modificar {BUILT_IN_PROPERTIES.find((p) => p.id === editingPropId)?.name || (workspace.customProperties || []).find((c) => c.id === editingPropId)?.name || editingPropId}
                  </span>
                  <button
                    type="button"
                    aria-label="Cerrar editor de propiedad"
                    onClick={() => setEditingPropId(null)}
                    className="p-0.5 rounded text-[var(--app-text-secondary)] hover:text-[var(--app-text-primary)]"
                  >
                    <CloseIcon className="w-3 h-3" />
                  </button>
                </div>

                {editingPropId === 'tags' && (
                  <div>
                    <div className="flex flex-wrap gap-1.5 mb-2">
                      {(workspace.tags || []).map((t) => (
                        <span
                          key={t}
                          className="px-2 py-0.5 rounded-full bg-[var(--app-accent-soft)] border border-[var(--app-accent)]/30 text-[var(--app-accent)] flex items-center gap-1 text-[11px]"
                        >
                          #{t}
                          <button
                            type="button"
                            aria-label={`Quitar etiqueta ${t}`}
                            onClick={() => handleRemoveTag(t)}
                            className="hover:opacity-75"
                          >
                            <CloseIcon className="w-2.5 h-2.5" />
                          </button>
                        </span>
                      ))}
                    </div>
                    <div className="flex gap-1.5">
                      <input
                        type="text"
                        value={newTagInput}
                        onChange={(e) => setNewTagInput(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleAddTag()}
                        placeholder="Nueva etiqueta..."
                        className="flex-1 bg-[var(--app-bg-primary)] border border-[var(--app-border)] rounded-md px-2 py-1 text-xs text-[var(--app-text-primary)] focus:outline-none focus:border-[var(--app-accent)]"
                      />
                      <button
                        type="button"
                        onClick={handleAddTag}
                        className="px-2 py-1 bg-[var(--app-accent)] hover:bg-[var(--app-accent-hover)] text-white rounded-md text-xs font-medium cursor-pointer"
                      >
                        Añadir
                      </button>
                    </div>
                  </div>
                )}

                {editingPropId === 'documentMode' && (
                  <select
                    value={workspace.documentMode || 'Estándar'}
                    onChange={(e) => handleUpdateFieldValue('documentMode', e.target.value)}
                    className="w-full bg-[var(--app-bg-primary)] border border-[var(--app-border)] rounded-md px-2 py-1.5 text-xs text-[var(--app-text-primary)] focus:outline-none"
                  >
                    <option value="Estándar">Nota estándar (Documento)</option>
                    <option value="Sin bordes">Lienzo infinito</option>
                    <option value="Dividido">Vista dividida híbrida</option>
                  </select>
                )}

                {editingPropId === 'pageWidth' && (
                  <div className="flex gap-1">
                    {(['standard', 'wide', 'full'] as const).map((width) => (
                      <button
                        key={width}
                        type="button"
                        onClick={() => handleUpdateFieldValue('pageWidth', width)}
                        className={`flex-1 py-1 rounded-md text-xs capitalize transition cursor-pointer ${
                          (workspace.pageWidth || 'full') === width
                            ? 'bg-[var(--app-accent)] text-white font-medium'
                            : 'bg-[var(--app-bg-tertiary)] text-[var(--app-text-secondary)] hover:text-[var(--app-text-primary)]'
                        }`}
                      >
                        {width === 'standard' ? 'Estándar' : width === 'wide' ? 'Ancho' : 'Completo'}
                      </button>
                    ))}
                  </div>
                )}

                {editingPropId === 'isJournal' && (
                  <label className="flex items-center gap-2 cursor-pointer py-1">
                    <input
                      type="checkbox"
                      checked={!!workspace.isJournal}
                      onChange={(e) => handleUpdateFieldValue('isJournal', e.target.checked)}
                      className="rounded accent-[var(--app-accent)]"
                    />
                    <span className="text-[var(--app-text-primary)]">Marcar como entrada de Diario</span>
                  </label>
                )}

                {editingPropId === 'borderlessTheme' && (
                  <label className="flex items-center gap-2 cursor-pointer py-1">
                    <input
                      type="checkbox"
                      checked={!!workspace.borderlessTheme}
                      onChange={(e) => handleUpdateFieldValue('borderlessTheme', e.target.checked)}
                      className="rounded accent-[var(--app-accent)]"
                    />
                    <span className="text-[var(--app-text-primary)]">Activar tema sin bordes</span>
                  </label>
                )}

                {editingPropId.startsWith('custom_') && (
                  <div>
                    <input
                      type="text"
                      defaultValue={
                        (workspace.customProperties || []).find((c) => c.id === editingPropId)?.value || ''
                      }
                      onBlur={(e) => handleUpdateCustomPropValue(editingPropId, e.target.value)}
                      placeholder="Valor de propiedad..."
                      className="w-full bg-[var(--app-bg-primary)] border border-[var(--app-border)] rounded px-2 py-1 text-xs text-[var(--app-text-primary)] focus:outline-none"
                    />
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Section: Agregar más propiedades */}
          {!readOnly && (
            <div className="px-3 pt-3">
              <button
                type="button"
                onClick={() => setAddPropertiesExpanded(!addPropertiesExpanded)}
                className="w-full flex items-center justify-between py-2 text-[var(--app-text-primary)] font-medium text-xs hover:text-[var(--app-accent)] transition cursor-pointer"
              >
                <div className="flex items-center gap-1.5">
                  <span>Agregar más propiedades</span>
                  {addPropertiesExpanded ? <ToggleDownIcon className="w-3.5 h-3.5" /> : <ToggleRightIcon className="w-3.5 h-3.5" />}
                </div>
              </button>

              {addPropertiesExpanded && (
                <div className="space-y-0.5 mt-1">
                  {ADDABLE_PROPERTIES.map((item) => {
                    const Icon = item.icon
                    const isAdded = !item.isCustom && activePropIds.includes(item.id)

                    return (
                      <div
                        key={item.id}
                        className="flex items-center justify-between py-1.5 px-2 rounded-md hover:bg-[var(--app-hover)] transition group text-xs"
                      >
                        <div className="flex items-center gap-2 text-[var(--app-text-secondary)] group-hover:text-[var(--app-text-primary)] min-w-0">
                          <Icon size={14} className="shrink-0" />
                          <span className="truncate">{item.name}</span>
                        </div>

                        {isAdded ? (
                          <span className="text-[11px] text-[var(--app-text-muted)] font-normal">Agregada</span>
                        ) : (
                          <button
                            type="button"
                            aria-label={`Agregar ${item.name}`}
                            onClick={() => handleAddProperty(item)}
                            className="p-1 rounded text-[var(--app-text-secondary)] hover:text-[var(--app-text-primary)] hover:bg-[var(--app-hover)] transition cursor-pointer"
                            title={`Agregar ${item.name}`}
                          >
                            <PlusIcon className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Tab 2: Document Outline */}
      {activeTab === 'outline' && (
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="font-semibold text-[var(--affine-text-primary-color)] text-xs">Esquema del Documento</span>
            <span className="text-[10px] text-[var(--affine-text-secondary-color)]">{headings.length} secciones</span>
          </div>

          {headings.length === 0 ? (
            <div className="text-center py-8 text-[var(--affine-text-secondary-color)] text-xs">
              No hay encabezados en esta página.<br />
              Usa H1, H2 o H3 en el editor para estructurar tu documento.
            </div>
          ) : (
            <div className="space-y-1">
              {headings.map((h) => (
                <button
                  key={h.id}
                  onClick={() => onScrollToHeading && onScrollToHeading(h.text)}
                  className={`w-full text-left py-1.5 px-2 rounded hover:bg-[var(--affine-hover-color)] transition truncate ${
                    h.level === 1
                      ? 'font-semibold text-[var(--affine-text-primary-color)]'
                      : h.level === 2
                      ? 'pl-4 text-[var(--affine-text-secondary-color)] hover:text-[var(--affine-text-primary-color)]'
                      : 'pl-6 text-[var(--affine-text-secondary-color)] hover:text-[var(--affine-text-primary-color)] text-[11px]'
                  }`}
                >
                  {h.text}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tab 3: History / Journal */}
      {activeTab === 'history' && (
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          <span className="font-semibold text-[var(--affine-text-primary-color)] text-xs">Registro de Actividad</span>
          <div className="space-y-2 text-xs">
            <div className="p-2.5 rounded-xl bg-[var(--affine-background-primary-color)] border border-[var(--affine-border-color)]">
              <span className="text-[10px] text-[var(--affine-text-secondary-color)]">Última actualización:</span>
              <p className="text-[var(--affine-text-primary-color)] font-medium mt-0.5">
                {new Date(workspace.updatedAt).toLocaleString('es-ES', {
                  day: '2-digit',
                  month: 'short',
                  year: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit'
                })}
              </p>
            </div>
            <div className="p-2.5 rounded-xl bg-[var(--affine-background-primary-color)] border border-[var(--affine-border-color)]">
              <span className="text-[10px] text-[var(--affine-text-secondary-color)]">Fecha de creación:</span>
              <p className="text-[var(--affine-text-primary-color)] font-medium mt-0.5">
                {new Date(workspace.createdAt).toLocaleString('es-ES', {
                  day: '2-digit',
                  month: 'short',
                  year: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit'
                })}
              </p>
            </div>
            <div className="p-2.5 rounded-xl bg-[var(--affine-background-primary-color)] border border-[var(--affine-border-color)]">
              <span className="text-[10px] text-[var(--affine-text-secondary-color)]">Identificador único (UUID):</span>
              <p className="text-[var(--affine-text-secondary-color)] font-mono text-[11px] mt-0.5 truncate select-all">
                {workspace.id}
              </p>
            </div>
          </div>
        </div>
      )}
    </aside>
    </>
  )
}
