import { useState } from 'react'
import {
  Sparkles,
  List,
  Calendar,
  SlidersHorizontal,
  PanelRightClose,
  MoreHorizontal,
  Plus,
  X,
  Check,
  ChevronDown,
  ChevronRight,
  Send,
  Loader2,
  Trash2
} from 'lucide-react'
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
  activeTab: 'properties' | 'outline' | 'ai' | 'history'
  onTabChange: (tab: 'properties' | 'outline' | 'ai' | 'history') => void
  onApplyAIContent?: (content: string) => void
  onScrollToHeading?: (headingText: string) => void
}

export function RightSidebar({
  workspace,
  isOpen,
  onClose,
  activeTab,
  onTabChange,
  onApplyAIContent,
  onScrollToHeading
}: RightSidebarProps) {
  const [propertiesExpanded, setPropertiesExpanded] = useState(true)
  const [addPropertiesExpanded, setAddPropertiesExpanded] = useState(true)
  const [activeMenuPropId, setActiveMenuPropId] = useState<string | null>(null)
  const [editingPropId, setEditingPropId] = useState<string | null>(null)
  const [newTagInput, setNewTagInput] = useState('')
  const [aiPrompt, setAiPrompt] = useState('')
  const [isGeneratingAI, setIsGeneratingAI] = useState(false)
  const [aiResponse, setAiResponse] = useState<string | null>(null)

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
    pageWidth: 'always_hide',
    ...(workspace.propertyVisibility || {})
  }

  // Update property visibility in database
  const handleSetVisibility = async (propId: string, visibility: PropertyVisibility) => {
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

  // Generate headings outline from docContent
  const extractHeadings = () => {
    if (!workspace.docContent) return []
    const tempDiv = document.createElement('div')
    tempDiv.innerHTML = workspace.docContent
    const headings = tempDiv.querySelectorAll('h1, h2, h3')
    return Array.from(headings).map((h, i) => ({
      id: `heading-${i}`,
      level: parseInt(h.tagName.substring(1)),
      text: h.textContent || 'Sin título'
    }))
  }

  const headings = extractHeadings()

  // AI prompt generator simulation
  const handleTriggerAI = async (promptText: string) => {
    setIsGeneratingAI(true)
    setAiResponse(null)
    setTimeout(() => {
      let result = ''
      if (promptText.includes('resum') || promptText.includes('Resum')) {
        result = `### 📋 Resumen Ejecutivo\n\nEste documento define las líneas estratégicas y notas del workspace "${workspace.title}".\n\n- **Objetivo central**: Centralización de información y organización eficiente.\n- **Estado actual**: En desarrollo activo con soporte offline.\n- **Siguientes pasos**: Validar enlaces bidireccionales y completar checklist.`
      } else if (promptText.includes('tarea') || promptText.includes('checklist')) {
        result = `### ✅ Tareas sugeridas por IA:\n\n- [ ] Revisar alcance y requerimientos del proyecto\n- [ ] Validar sincronización con Supabase y modo offline\n- [ ] Configurar propiedades personalizadas y etiquetas\n- [ ] Añadir enlaces bidireccionales con páginas relacionadas`
      } else if (promptText.includes('esquema') || promptText.includes('estructura')) {
        result = `## 📌 Estructura Propuesta\n\n1. **Introducción y Contexto**\n   - Antecedentes\n   - Metas prioritarias\n2. **Plan de Acción**\n   - Fases de implementación\n   - Métricas de éxito\n3. **Recursos y Referencias**\n   - Documentos vinculados\n   - Enlaces externos`
      } else {
        result = `### 💡 Sugerencia IA para "${workspace.title}":\n\nSe recomienda enriquecer el contenido con tablas comparativas, listas de verificación accionables y enlaces directos hacia otras notas en tu workspace para potenciar el grafo de conocimiento.`
      }
      setAiResponse(result)
      setIsGeneratingAI(false)
    }, 900)
  }

  return (
    <aside className="w-80 h-full bg-[#141416] border-l border-[#242428] flex flex-col shrink-0 select-none text-zinc-300 text-xs z-20">
      {/* Top Header Icon Tabs */}
      <div className="h-12 border-b border-[#242428] flex items-center justify-between px-3 shrink-0">
        <div className="flex items-center gap-1">
          {/* AI Tab */}
          <button
            onClick={() => onTabChange('ai')}
            className={`p-1.5 rounded-md transition ${
              activeTab === 'ai'
                ? 'bg-[#2a2a30] text-zinc-100 shadow-xs'
                : 'text-zinc-400 hover:text-zinc-200 hover:bg-[#1e1e22]'
            }`}
            title="Asistente de IA"
          >
            <Sparkles size={16} />
          </button>

          {/* Outline Tab */}
          <button
            onClick={() => onTabChange('outline')}
            className={`p-1.5 rounded-md transition ${
              activeTab === 'outline'
                ? 'bg-[#2a2a30] text-zinc-100 shadow-xs'
                : 'text-zinc-400 hover:text-zinc-200 hover:bg-[#1e1e22]'
            }`}
            title="Esquema del documento"
          >
            <List size={16} />
          </button>

          {/* Journal / Calendar Tab */}
          <button
            onClick={() => onTabChange('history')}
            className={`p-1.5 rounded-md transition ${
              activeTab === 'history'
                ? 'bg-[#2a2a30] text-zinc-100 shadow-xs'
                : 'text-zinc-400 hover:text-zinc-200 hover:bg-[#1e1e22]'
            }`}
            title="Diarios e Historial"
          >
            <Calendar size={16} />
          </button>

          {/* Properties Tab */}
          <button
            onClick={() => onTabChange('properties')}
            className={`p-1.5 rounded-md transition ${
              activeTab === 'properties'
                ? 'bg-[#2a2a30] text-zinc-100 shadow-xs'
                : 'text-zinc-400 hover:text-zinc-200 hover:bg-[#1e1e22]'
            }`}
            title="Propiedades del documento"
          >
            <SlidersHorizontal size={16} />
          </button>
        </div>

        {/* Close Right Sidebar Button */}
        <button
          onClick={onClose}
          className="p-1.5 rounded-md text-zinc-400 hover:text-zinc-200 hover:bg-[#1e1e22] transition"
          title="Ocultar panel derecho"
        >
          <PanelRightClose size={16} />
        </button>
      </div>

      {/* Tab 1: Properties Inspector (Matches Screenshot) */}
      {activeTab === 'properties' && (
        <div className="flex-1 overflow-y-auto divide-y divide-[#242428] py-2">
          {/* Section: Propiedades */}
          <div className="px-3 pb-3">
            <button
              onClick={() => setPropertiesExpanded(!propertiesExpanded)}
              className="w-full flex items-center justify-between py-2 text-zinc-200 font-medium text-xs hover:text-white transition"
            >
              <div className="flex items-center gap-1.5">
                <span>Propiedades</span>
                {propertiesExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
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
                  const Icon = builtIn?.icon || SlidersHorizontal
                  const visibility = visibilityMap[propId] || 'always_show'
                  const visibilityLabel = VISIBILITY_LABELS[visibility]

                  return (
                    <div
                      key={propId}
                      className="group flex items-center justify-between py-1.5 px-2 rounded-md hover:bg-[#1c1c20] transition relative"
                    >
                      {/* Left: Icon + Name */}
                      <div className="flex items-center gap-2 min-w-0 flex-1 mr-2">
                        <Icon size={14} className="text-zinc-400 shrink-0" />
                        <span className="truncate text-zinc-300 group-hover:text-zinc-100">
                          {name}
                        </span>
                      </div>

                      {/* Right: Visibility label & ... menu */}
                      <div className="flex items-center gap-1 shrink-0">
                        <span className="text-[11px] text-zinc-500 font-normal">
                          {visibilityLabel}
                        </span>

                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            setActiveMenuPropId(activeMenuPropId === propId ? null : propId)
                          }}
                          className="p-1 rounded text-zinc-500 hover:text-zinc-200 hover:bg-[#28282e] transition"
                        >
                          <MoreHorizontal size={13} />
                        </button>
                      </div>

                      {/* Property Options Dropdown Menu */}
                      {activeMenuPropId === propId && (
                        <div
                          className="absolute right-2 top-8 z-30 w-48 bg-[#1f1f24] border border-[#2d2d34] rounded-lg shadow-xl py-1 text-xs text-zinc-300"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <div className="px-3 py-1 text-[10px] uppercase font-semibold text-zinc-500 tracking-wider">
                            Visibilidad
                          </div>
                          <button
                            onClick={() => handleSetVisibility(propId, 'always_show')}
                            className="w-full text-left px-3 py-1.5 hover:bg-[#2c2c34] flex items-center justify-between"
                          >
                            <span>Siempre mostrar</span>
                            {visibility === 'always_show' && <Check size={12} className="text-blue-400" />}
                          </button>
                          <button
                            onClick={() => handleSetVisibility(propId, 'always_hide')}
                            className="w-full text-left px-3 py-1.5 hover:bg-[#2c2c34] flex items-center justify-between"
                          >
                            <span>Siempre ocultar</span>
                            {visibility === 'always_hide' && <Check size={12} className="text-blue-400" />}
                          </button>
                          <button
                            onClick={() => handleSetVisibility(propId, 'hide_empty')}
                            className="w-full text-left px-3 py-1.5 hover:bg-[#2c2c34] flex items-center justify-between"
                          >
                            <span>Ocultar cuando esté vacío</span>
                            {visibility === 'hide_empty' && <Check size={12} className="text-blue-400" />}
                          </button>

                          <div className="border-t border-[#2d2d34] my-1" />

                          <button
                            onClick={() => {
                              setEditingPropId(editingPropId === propId ? null : propId)
                              setActiveMenuPropId(null)
                            }}
                            className="w-full text-left px-3 py-1.5 hover:bg-[#2c2c34] text-zinc-300"
                          >
                            Editar valor
                          </button>

                          <button
                            onClick={() => handleRemoveProperty(propId)}
                            className="w-full text-left px-3 py-1.5 hover:bg-rose-950/40 text-rose-400 flex items-center gap-1.5"
                          >
                            <Trash2 size={12} />
                            <span>Eliminar propiedad</span>
                          </button>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}

            {/* Quick Inline Value Editor for Open Property */}
            {editingPropId && (
              <div className="mt-2 p-2.5 bg-[#19191d] rounded-lg border border-[#2a2a30]">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-semibold text-[11px] text-zinc-200">
                    Modificar {editingPropId}
                  </span>
                  <button
                    onClick={() => setEditingPropId(null)}
                    className="p-0.5 rounded text-zinc-400 hover:text-white"
                  >
                    <X size={12} />
                  </button>
                </div>

                {editingPropId === 'tags' && (
                  <div>
                    <div className="flex flex-wrap gap-1.5 mb-2">
                      {(workspace.tags || []).map((t) => (
                        <span
                          key={t}
                          className="px-2 py-0.5 rounded-full bg-indigo-950/60 border border-indigo-700/50 text-indigo-300 flex items-center gap-1 text-[11px]"
                        >
                          #{t}
                          <button
                            onClick={() => handleRemoveTag(t)}
                            className="hover:text-indigo-100"
                          >
                            <X size={10} />
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
                        className="flex-1 bg-[#121214] border border-[#2d2d34] rounded px-2 py-1 text-xs text-zinc-200 focus:outline-none focus:border-indigo-500"
                      />
                      <button
                        onClick={handleAddTag}
                        className="px-2 py-1 bg-indigo-600 hover:bg-indigo-500 text-white rounded text-xs"
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
                    className="w-full bg-[#121214] border border-[#2d2d34] rounded px-2 py-1.5 text-xs text-zinc-200 focus:outline-none"
                  >
                    <option value="Estándar">Página estándar (Documento)</option>
                    <option value="Sin bordes">Sin bordes (Lienzo infinito)</option>
                    <option value="Dividido">Vista dividida híbrida</option>
                  </select>
                )}

                {editingPropId === 'pageWidth' && (
                  <div className="flex gap-1">
                    {(['standard', 'wide', 'full'] as const).map((width) => (
                      <button
                        key={width}
                        onClick={() => handleUpdateFieldValue('pageWidth', width)}
                        className={`flex-1 py-1 rounded text-xs capitalize ${
                          (workspace.pageWidth || 'standard') === width
                            ? 'bg-blue-600 text-white font-medium'
                            : 'bg-[#222226] text-zinc-400 hover:text-zinc-200'
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
                      className="rounded accent-blue-600"
                    />
                    <span className="text-zinc-300">Marcar como entrada de Diario</span>
                  </label>
                )}

                {editingPropId === 'borderlessTheme' && (
                  <label className="flex items-center gap-2 cursor-pointer py-1">
                    <input
                      type="checkbox"
                      checked={!!workspace.borderlessTheme}
                      onChange={(e) => handleUpdateFieldValue('borderlessTheme', e.target.checked)}
                      className="rounded accent-blue-600"
                    />
                    <span className="text-zinc-300">Activar tema sin bordes</span>
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
                      className="w-full bg-[#121214] border border-[#2d2d34] rounded px-2 py-1 text-xs text-zinc-200 focus:outline-none"
                    />
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Section: Agregar más propiedades (Matches Screenshot) */}
          <div className="px-3 pt-3">
            <button
              onClick={() => setAddPropertiesExpanded(!addPropertiesExpanded)}
              className="w-full flex items-center justify-between py-2 text-zinc-200 font-medium text-xs hover:text-white transition"
            >
              <div className="flex items-center gap-1.5">
                <span>Agregar más propiedades</span>
                {addPropertiesExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
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
                      className="flex items-center justify-between py-1.5 px-2 rounded-md hover:bg-[#1c1c20] transition group text-xs"
                    >
                      <div className="flex items-center gap-2 text-zinc-400 group-hover:text-zinc-200 min-w-0">
                        <Icon size={14} className="shrink-0" />
                        <span className="truncate">{item.name}</span>
                      </div>

                      {isAdded ? (
                        <span className="text-[11px] text-zinc-500 font-normal">Added</span>
                      ) : (
                        <button
                          onClick={() => handleAddProperty(item)}
                          className="p-1 rounded text-zinc-400 hover:text-white hover:bg-[#28282e] transition"
                          title={`Agregar ${item.name}`}
                        >
                          <Plus size={13} />
                        </button>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tab 2: Document Outline */}
      {activeTab === 'outline' && (
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="font-semibold text-zinc-200 text-xs">Esquema del Documento</span>
            <span className="text-[10px] text-zinc-500">{headings.length} secciones</span>
          </div>

          {headings.length === 0 ? (
            <div className="text-center py-8 text-zinc-500 text-xs">
              No hay encabezados en esta página.<br />
              Usa H1, H2 o H3 en el editor para estructurar tu documento.
            </div>
          ) : (
            <div className="space-y-1">
              {headings.map((h) => (
                <button
                  key={h.id}
                  onClick={() => onScrollToHeading && onScrollToHeading(h.text)}
                  className={`w-full text-left py-1 px-2 rounded hover:bg-[#1f1f24] transition truncate ${
                    h.level === 1
                      ? 'font-semibold text-zinc-200'
                      : h.level === 2
                      ? 'pl-4 text-zinc-400 hover:text-zinc-200'
                      : 'pl-6 text-zinc-500 hover:text-zinc-300 text-[11px]'
                  }`}
                >
                  {h.text}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tab 3: AI Assistant */}
      {activeTab === 'ai' && (
        <div className="flex-1 flex flex-col p-3 overflow-hidden">
          <div className="flex items-center gap-2 mb-3">
            <Sparkles size={16} className="text-blue-400" />
            <span className="font-semibold text-zinc-200 text-xs">Asistente de IA</span>
          </div>

          <div className="space-y-1.5 mb-3">
            <span className="text-[11px] text-zinc-500">Acciones rápidas:</span>
            <div className="grid grid-cols-1 gap-1">
              <button
                onClick={() => handleTriggerAI('Resumir')}
                className="text-left px-2.5 py-1.5 rounded bg-[#1c1c20] hover:bg-[#26262c] text-zinc-300 text-xs transition"
              >
                📋 Resumir página
              </button>
              <button
                onClick={() => handleTriggerAI('Generar checklist y tareas')}
                className="text-left px-2.5 py-1.5 rounded bg-[#1c1c20] hover:bg-[#26262c] text-zinc-300 text-xs transition"
              >
                ✅ Generar checklist de tareas
              </button>
              <button
                onClick={() => handleTriggerAI('Proponer estructura y esquema')}
                className="text-left px-2.5 py-1.5 rounded bg-[#1c1c20] hover:bg-[#26262c] text-zinc-300 text-xs transition"
              >
                📑 Sugerir esquema y temas
              </button>
            </div>
          </div>

          {/* AI Result Area */}
          <div className="flex-1 overflow-y-auto bg-[#18181c] rounded-lg p-2.5 border border-[#26262c] mb-3 text-xs leading-relaxed text-zinc-300">
            {isGeneratingAI ? (
              <div className="flex items-center justify-center h-full gap-2 text-zinc-400">
                <Loader2 size={16} className="animate-spin text-blue-400" />
                <span>Analizando documento...</span>
              </div>
            ) : aiResponse ? (
              <div>
                <pre className="whitespace-pre-wrap font-sans text-xs text-zinc-200">
                  {aiResponse}
                </pre>
                {onApplyAIContent && (
                  <button
                    onClick={() => {
                      onApplyAIContent(aiResponse)
                      setAiResponse(null)
                    }}
                    className="mt-3 w-full py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded font-medium text-xs transition"
                  >
                    Insertar en la nota
                  </button>
                )}
              </div>
            ) : (
              <span className="text-zinc-500 text-center block pt-6">
                Escribe una instrucción o selecciona una acción rápida para redactar ideas.
              </span>
            )}
          </div>

          {/* Prompt input */}
          <div className="flex gap-1.5 shrink-0">
            <input
              type="text"
              value={aiPrompt}
              onChange={(e) => setAiPrompt(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && aiPrompt.trim()) {
                  handleTriggerAI(aiPrompt)
                  setAiPrompt('')
                }
              }}
              placeholder="Pregunta o pide redactar algo..."
              className="flex-1 bg-[#121214] border border-[#2d2d34] rounded-lg px-2.5 py-1.5 text-xs text-zinc-200 focus:outline-none focus:border-blue-500"
            />
            <button
              onClick={() => {
                if (aiPrompt.trim()) {
                  handleTriggerAI(aiPrompt)
                  setAiPrompt('')
                }
              }}
              className="p-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition"
            >
              <Send size={13} />
            </button>
          </div>
        </div>
      )}

      {/* Tab 4: History / Journal */}
      {activeTab === 'history' && (
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          <span className="font-semibold text-zinc-200 text-xs">Registro de Actividad</span>
          <div className="space-y-2 text-xs">
            <div className="p-2 rounded bg-[#1a1a1e] border border-[#26262a]">
              <span className="text-[10px] text-zinc-500">Última actualización:</span>
              <p className="text-zinc-300 font-medium mt-0.5">
                {new Date(workspace.updatedAt).toLocaleString('es-ES', {
                  day: '2-digit',
                  month: 'short',
                  year: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit'
                })}
              </p>
            </div>
            <div className="p-2 rounded bg-[#1a1a1e] border border-[#26262a]">
              <span className="text-[10px] text-zinc-500">Fecha de creación:</span>
              <p className="text-zinc-300 font-medium mt-0.5">
                {new Date(workspace.createdAt).toLocaleString('es-ES', {
                  day: '2-digit',
                  month: 'short',
                  year: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit'
                })}
              </p>
            </div>
            <div className="p-2 rounded bg-[#1a1a1e] border border-[#26262a]">
              <span className="text-[10px] text-zinc-500">Identificador único (UUID):</span>
              <p className="text-zinc-400 font-mono text-[11px] mt-0.5 truncate select-all">
                {workspace.id}
              </p>
            </div>
          </div>
        </div>
      )}
    </aside>
  )
}
