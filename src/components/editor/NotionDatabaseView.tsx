import React, { useState, useMemo } from 'react'
import {
  Plus,
  Trash2,
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Search,
  CheckCircle2,
  Circle,
  X
} from 'lucide-react'
import {
  type NotionDatabaseData,
  type NotionDatabaseItem,
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

export const NOTION_VIEW_OPTIONS: Array<{
  id: NotionDatabaseViewType
  label: string
  desc: string
  Icon: React.FC<{ className?: string; size?: number }>
}> = [
  { id: 'table', label: 'Table', desc: 'Vista tabular clásica con columnas y filas', Icon: NotionTableIcon },
  { id: 'board', label: 'Board', desc: 'Tablero Kanban agrupado por estados', Icon: NotionBoardIcon },
  { id: 'list', label: 'List', desc: 'Lista limpia y minimalista de tareas', Icon: NotionListIcon },
  { id: 'timeline', label: 'Timeline', desc: 'Cronograma horizontal estilo diagrama de Gantt', Icon: NotionTimelineIcon },
  { id: 'calendar', label: 'Calendar', desc: 'Calendario mensual interactivo con eventos', Icon: NotionCalendarIcon },
  { id: 'gallery', label: 'Gallery', desc: 'Mosaico visual de tarjetas con portadas', Icon: NotionGalleryIcon }
]

export const STATUS_CONFIG: Record<string, { label: string; bg: string; text: string; dot: string }> = {
  'Sin empezar': {
    label: 'Sin empezar',
    bg: 'bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300',
    text: 'text-zinc-600 dark:text-zinc-300',
    dot: 'bg-zinc-400'
  },
  'En progreso': {
    label: 'En progreso',
    bg: 'bg-sky-50 dark:bg-sky-950/70 text-sky-700 dark:text-sky-300 border border-sky-200 dark:border-sky-800',
    text: 'text-sky-600 dark:text-sky-300',
    dot: 'bg-sky-500'
  },
  'En revisión': {
    label: 'En revisión',
    bg: 'bg-amber-50 dark:bg-amber-950/70 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800',
    text: 'text-amber-600 dark:text-amber-300',
    dot: 'bg-amber-500'
  },
  'Completado': {
    label: 'Completado',
    bg: 'bg-emerald-50 dark:bg-emerald-950/70 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800',
    text: 'text-emerald-600 dark:text-emerald-300',
    dot: 'bg-emerald-500'
  }
}

export const PRIORITY_CONFIG: Record<string, { label: string; badge: string }> = {
  'Baja': { label: 'Baja', badge: 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300' },
  'Media': { label: 'Media', badge: 'bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300' },
  'Alta': { label: 'Alta', badge: 'bg-orange-50 text-orange-700 dark:bg-orange-950/60 dark:text-orange-300' },
  'Urgente': { label: 'Urgente', badge: 'bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300' }
}

export function getDefaultDatabaseData(initialView: NotionDatabaseViewType = 'table'): NotionDatabaseData {
  const today = new Date().toISOString().split('T')[0]
  const tomorrow = new Date(Date.now() + 86400000 * 2).toISOString().split('T')[0]
  const nextWeek = new Date(Date.now() + 86400000 * 6).toISOString().split('T')[0]

  return {
    enabled: true,
    activeView: initialView,
    views: [
      { id: 'v1', name: 'Table', type: 'table' },
      { id: 'v2', name: 'Board', type: 'board' },
      { id: 'v3', name: 'List', type: 'list' },
      { id: 'v4', name: 'Timeline', type: 'timeline' },
      { id: 'v5', name: 'Calendar', type: 'calendar' },
      { id: 'v6', name: 'Gallery', type: 'gallery' }
    ],
    items: [
      {
        id: 'db-1',
        title: 'Investigar requerimientos del proyecto',
        status: 'Completado',
        priority: 'Media',
        date: today,
        endDate: today,
        tags: ['Diseño', 'Docs'],
        assignee: 'Kevin',
        coverColor: 'from-blue-600 to-indigo-600',
        description: 'Recopilar especificaciones y necesidades clave del usuario.'
      },
      {
        id: 'db-2',
        title: 'Crear vistas interactivas estilo Notion',
        status: 'En progreso',
        priority: 'Urgente',
        date: today,
        endDate: tomorrow,
        tags: ['Frontend', 'Vistas'],
        assignee: 'Kevin',
        coverColor: 'from-amber-500 to-rose-500',
        description: 'Implementar Table, Board, List, Timeline, Calendar y Gallery.'
      },
      {
        id: 'db-3',
        title: 'Revisión con el equipo y retroalimentación',
        status: 'En revisión',
        priority: 'Alta',
        date: tomorrow,
        endDate: nextWeek,
        tags: ['Equipo', 'Review'],
        assignee: 'Maikol',
        coverColor: 'from-emerald-500 to-teal-600',
        description: 'Validar componentes en dispositivos móviles y de escritorio.'
      },
      {
        id: 'db-4',
        title: 'Despliegue y documentación final',
        status: 'Sin empezar',
        priority: 'Baja',
        date: nextWeek,
        endDate: nextWeek,
        tags: ['Release'],
        assignee: 'Marcos',
        coverColor: 'from-purple-600 to-pink-500',
        description: 'Publicar actualización y escribir guía de usuario.'
      }
    ]
  }
}

interface NotionDatabaseViewProps {
  data: NotionDatabaseData
  onChange: (newData: NotionDatabaseData) => void
  onClose?: () => void
}

export const NotionDatabaseView: React.FC<NotionDatabaseViewProps> = ({
  data,
  onChange,
  onClose
}) => {
  const [searchQuery, setSearchQuery] = useState('')
  const [isAddViewOpen, setIsAddViewOpen] = useState(false)
  const [editingItemId, setEditingItemId] = useState<string | null>(null)
  const [currentMonthDate, setCurrentMonthDate] = useState(() => new Date())

  const activeView = data.activeView || 'table'

  // Filter items by search
  const filteredItems = useMemo(() => {
    if (!searchQuery.trim()) return data.items
    const q = searchQuery.toLowerCase()
    return data.items.filter(
      (item) =>
        item.title.toLowerCase().includes(q) ||
        (item.description && item.description.toLowerCase().includes(q)) ||
        (item.assignee && item.assignee.toLowerCase().includes(q)) ||
        item.tags?.some((t) => t.toLowerCase().includes(q))
    )
  }, [data.items, searchQuery])

  // Change active view
  const handleSelectView = (viewType: NotionDatabaseViewType) => {
    onChange({
      ...data,
      activeView: viewType
    })
  }

  // Add new item
  const handleAddItem = (partial?: Partial<NotionDatabaseItem>) => {
    const today = new Date().toISOString().split('T')[0]
    const gradients = [
      'from-blue-600 to-indigo-600',
      'from-purple-600 to-pink-600',
      'from-amber-500 to-orange-600',
      'from-emerald-500 to-teal-600',
      'from-cyan-500 to-blue-600'
    ]
    const randomGrad = gradients[Math.floor(Math.random() * gradients.length)]

    const newItem: NotionDatabaseItem = {
      id: `item-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      title: partial?.title || 'Nuevo elemento',
      status: partial?.status || 'Sin empezar',
      priority: partial?.priority || 'Media',
      date: partial?.date || today,
      endDate: partial?.endDate || today,
      tags: partial?.tags || ['Tarea'],
      assignee: partial?.assignee || 'Tú',
      coverColor: randomGrad,
      description: partial?.description || '',
      completed: false
    }

    onChange({
      ...data,
      items: [newItem, ...data.items]
    })
    setEditingItemId(newItem.id)
  }

  // Update item
  const handleUpdateItem = (id: string, updates: Partial<NotionDatabaseItem>) => {
    const updatedItems = data.items.map((item) => {
      if (item.id === id) {
        return { ...item, ...updates }
      }
      return item
    })
    onChange({
      ...data,
      items: updatedItems
    })
  }

  // Delete item
  const handleDeleteItem = (id: string) => {
    onChange({
      ...data,
      items: data.items.filter((item) => item.id !== id)
    })
  }

  // Helper for calendar
  const calendarDays = useMemo(() => {
    const year = currentMonthDate.getFullYear()
    const month = currentMonthDate.getMonth()
    const firstDayIndex = (new Date(year, month, 1).getDay() + 6) % 7 // Monday = 0
    const totalDays = new Date(year, month + 1, 0).getDate()

    const days: Array<{ day: number; dateStr: string; isCurrentMonth: boolean }> = []

    // Previous month padding
    const prevMonthDays = new Date(year, month, 0).getDate()
    for (let i = firstDayIndex - 1; i >= 0; i--) {
      const d = prevMonthDays - i
      const m = month === 0 ? 12 : month
      const y = month === 0 ? year - 1 : year
      const dateStr = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
      days.push({ day: d, dateStr, isCurrentMonth: false })
    }

    // Current month days
    for (let i = 1; i <= totalDays; i++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`
      days.push({ day: i, dateStr, isCurrentMonth: true })
    }

    // Next month padding to fill grid
    const remaining = 42 - days.length
    for (let i = 1; i <= remaining; i++) {
      const m = month === 11 ? 1 : month + 2
      const y = month === 11 ? year + 1 : year
      const dateStr = `${y}-${String(m).padStart(2, '0')}-${String(i).padStart(2, '0')}`
      days.push({ day: i, dateStr, isCurrentMonth: false })
    }

    return days
  }, [currentMonthDate])

  const monthNames = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
  ]

  return (
    <div className="my-6 rounded-2xl border border-black/[0.08] dark:border-white/[0.08] bg-white/70 dark:bg-[#161618]/70 backdrop-blur-xl shadow-xl overflow-hidden transition select-none">
      {/* Top Navigation & View Tabs (Notion database view bar) */}
      <div className="flex items-center justify-between px-3.5 py-2 border-b border-black/[0.06] dark:border-white/[0.06] bg-black/[0.02] dark:bg-white/[0.02] flex-wrap gap-2">
        {/* Left: View Tabs */}
        <div className="flex items-center gap-1 overflow-x-auto custom-scrollbar py-0.5">
          {NOTION_VIEW_OPTIONS.map((opt) => {
            const isActive = activeView === opt.id
            const Icon = opt.Icon
            return (
              <button
                key={opt.id}
                onClick={() => handleSelectView(opt.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition cursor-pointer active:scale-95 shrink-0 ${
                  isActive
                    ? 'bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 shadow-xs font-semibold'
                    : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/5'
                }`}
              >
                <Icon className={isActive ? 'text-white dark:text-neutral-900' : 'text-neutral-500'} size={15} />
                <span>{opt.label}</span>
              </button>
            )
          })}

          {/* Add View Dropdown Button */}
          <div className="relative">
            <button
              onClick={() => setIsAddViewOpen(!isAddViewOpen)}
              className="p-1.5 rounded-xl text-neutral-500 hover:text-neutral-900 dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/10 transition cursor-pointer ml-0.5"
              title="Añadir o cambiar vista Notion"
            >
              <Plus size={15} />
            </button>

            {/* Notion View Switcher Dropdown (Matching User Screenshot) */}
            {isAddViewOpen && (
              <div
                className="fixed inset-x-3 top-24 sm:absolute sm:inset-x-auto sm:left-0 sm:top-full sm:mt-2 z-50 w-auto max-w-[190px] mx-auto sm:min-w-[175px] bg-[#1a1b1e] border border-zinc-800 rounded-xl sm:rounded-2xl shadow-2xl p-1 sm:p-1.5 flex flex-col gap-0.5 animate-in fade-in zoom-in-95 duration-100 max-h-[60vh] overflow-y-auto custom-scrollbar"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="px-2 sm:px-2.5 py-0.5 sm:py-1 text-[9px] sm:text-[10px] font-semibold text-zinc-400 uppercase tracking-wider">
                  Vistas de Notion
                </div>
                {NOTION_VIEW_OPTIONS.map((opt) => {
                  const Icon = opt.Icon
                  const isCurrent = activeView === opt.id
                  return (
                    <button
                      key={opt.id}
                      onClick={() => {
                        handleSelectView(opt.id)
                        setIsAddViewOpen(false)
                      }}
                      className={`flex items-center gap-2 sm:gap-2.5 px-2 sm:px-2.5 py-1.5 sm:py-2 rounded-lg sm:rounded-xl text-[11px] sm:text-xs font-medium transition cursor-pointer text-left w-full ${
                        isCurrent
                          ? 'bg-white/15 text-white'
                          : 'text-zinc-300 hover:bg-white/10 hover:text-white'
                      }`}
                    >
                      <Icon className="text-zinc-300 shrink-0" size={15} />
                      <span className="flex-1 truncate">{opt.label}</span>
                      {isCurrent && <span className="w-1.5 h-1.5 rounded-full bg-blue-400 shrink-0" />}
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        </div>

        {/* Right: Search, Quick Add, Close actions */}
        <div className="flex items-center gap-2">
          {/* Search box */}
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-black/[0.04] dark:bg-white/[0.06] border border-black/[0.05] dark:border-white/[0.08] text-xs">
            <Search size={13} className="text-neutral-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar..."
              className="w-20 sm:w-28 bg-transparent border-none outline-none text-xs text-neutral-800 dark:text-neutral-200 placeholder:text-neutral-400"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="text-neutral-400 hover:text-neutral-700 dark:hover:text-white"
              >
                <X size={12} />
              </button>
            )}
          </div>

          {/* New Item Button */}
          <button
            onClick={() => handleAddItem()}
            className="flex items-center gap-1 px-3 py-1 rounded-full bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-xs transition active:scale-95 cursor-pointer"
          >
            <Plus size={13} />
            <span className="hidden sm:inline">Nuevo</span>
          </button>

          {onClose && (
            <button
              onClick={onClose}
              className="p-1 rounded-full text-neutral-400 hover:text-neutral-800 dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/10 transition cursor-pointer"
              title="Cerrar base de datos"
            >
              <X size={14} />
            </button>
          )}
        </div>
      </div>

      {/* VIEW CONTENT */}
      <div className="p-4 overflow-x-auto">
        {/* 1. TABLE VIEW */}
        {activeView === 'table' && (
          <div className="w-full">
            <div className="border border-black/[0.06] dark:border-white/[0.08] rounded-xl overflow-hidden bg-white/40 dark:bg-black/20">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-black/[0.06] dark:border-white/[0.08] bg-black/[0.02] dark:bg-white/[0.02] text-neutral-500 dark:text-neutral-400 font-semibold">
                    <th className="py-2.5 px-3 w-8">#</th>
                    <th className="py-2.5 px-3 min-w-[200px]">Nombre / Tarea</th>
                    <th className="py-2.5 px-3 min-w-[130px]">Estado</th>
                    <th className="py-2.5 px-3 min-w-[110px]">Fecha</th>
                    <th className="py-2.5 px-3 min-w-[100px]">Prioridad</th>
                    <th className="py-2.5 px-3 min-w-[130px]">Etiquetas</th>
                    <th className="py-2.5 px-3 min-w-[110px]">Responsable</th>
                    <th className="py-2.5 px-2 w-10 text-center"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-black/[0.04] dark:divide-white/[0.04]">
                  {filteredItems.map((item, idx) => {
                    const statusInfo = STATUS_CONFIG[item.status] || STATUS_CONFIG['Sin empezar']
                    const priorityInfo = PRIORITY_CONFIG[item.priority || 'Media'] || PRIORITY_CONFIG['Media']
                    return (
                      <tr
                        key={item.id}
                        className="hover:bg-black/[0.02] dark:hover:bg-white/[0.03] transition group"
                      >
                        <td className="py-2 px-3 text-neutral-400 font-mono text-[11px]">{idx + 1}</td>
                        <td className="py-2 px-3">
                          <input
                            type="text"
                            value={item.title}
                            onChange={(e) => handleUpdateItem(item.id, { title: e.target.value })}
                            className="w-full bg-transparent border-none outline-none text-neutral-900 dark:text-neutral-100 font-medium focus:ring-1 focus:ring-blue-500 rounded px-1 -mx-1"
                          />
                        </td>
                        <td className="py-2 px-3">
                          <select
                            value={item.status}
                            onChange={(e) => handleUpdateItem(item.id, { status: e.target.value })}
                            className={`text-xs px-2 py-0.5 rounded-full font-medium cursor-pointer border-none outline-none ${statusInfo.bg}`}
                          >
                            <option value="Sin empezar">Sin empezar</option>
                            <option value="En progreso">En progreso</option>
                            <option value="En revisión">En revisión</option>
                            <option value="Completado">Completado</option>
                          </select>
                        </td>
                        <td className="py-2 px-3">
                          <input
                            type="date"
                            value={item.date || ''}
                            onChange={(e) => handleUpdateItem(item.id, { date: e.target.value })}
                            className="bg-transparent border-none outline-none text-neutral-600 dark:text-neutral-300 text-xs cursor-pointer font-mono"
                          />
                        </td>
                        <td className="py-2 px-3">
                          <select
                            value={item.priority || 'Media'}
                            onChange={(e) => handleUpdateItem(item.id, { priority: e.target.value as any })}
                            className={`text-[11px] px-2 py-0.5 rounded-md font-medium cursor-pointer border-none outline-none ${priorityInfo.badge}`}
                          >
                            <option value="Baja">Baja</option>
                            <option value="Media">Media</option>
                            <option value="Alta">Alta</option>
                            <option value="Urgente">Urgente</option>
                          </select>
                        </td>
                        <td className="py-2 px-3">
                          <div className="flex items-center gap-1 flex-wrap">
                            {item.tags?.map((tag, tIdx) => (
                              <span
                                key={tIdx}
                                className="px-1.5 py-0.2 rounded bg-neutral-100 dark:bg-neutral-800 text-[10px] text-neutral-600 dark:text-neutral-300 font-medium"
                              >
                                {tag}
                              </span>
                            ))}
                          </div>
                        </td>
                        <td className="py-2 px-3">
                          <input
                            type="text"
                            value={item.assignee || ''}
                            onChange={(e) => handleUpdateItem(item.id, { assignee: e.target.value })}
                            placeholder="Sin asignar"
                            className="w-full bg-transparent border-none outline-none text-neutral-600 dark:text-neutral-400 text-xs"
                          />
                        </td>
                        <td className="py-2 px-2 text-center">
                          <button
                            onClick={() => handleDeleteItem(item.id)}
                            className="opacity-0 group-hover:opacity-100 p-1 rounded-md text-neutral-400 hover:text-rose-500 hover:bg-rose-500/10 transition cursor-pointer"
                            title="Eliminar fila"
                          >
                            <Trash2 size={13} />
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>

              {/* Add row bottom footer */}
              <div
                onClick={() => handleAddItem()}
                className="p-2.5 flex items-center gap-2 text-xs text-neutral-500 dark:text-neutral-400 hover:text-blue-500 dark:hover:text-blue-400 hover:bg-black/[0.02] dark:hover:bg-white/[0.02] cursor-pointer transition border-t border-black/[0.04] dark:border-white/[0.04]"
              >
                <Plus size={14} />
                <span className="font-medium">+ Nueva fila</span>
              </div>
            </div>
            <div className="text-[11px] text-neutral-400 mt-2 px-1 flex items-center justify-between">
              <span>{filteredItems.length} elementos en total</span>
              <span>Guardado en Dexie</span>
            </div>
          </div>
        )}

        {/* 2. BOARD VIEW (KANBAN) */}
        {activeView === 'board' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 items-start">
            {['Sin empezar', 'En progreso', 'En revisión', 'Completado'].map((statusKey) => {
              const statusInfo = STATUS_CONFIG[statusKey]
              const itemsInStatus = filteredItems.filter((item) => (item.status || 'Sin empezar') === statusKey)
              return (
                <div
                  key={statusKey}
                  className="bg-black/[0.02] dark:bg-white/[0.03] border border-black/[0.05] dark:border-white/[0.06] rounded-2xl p-3 flex flex-col gap-2.5 min-h-[260px]"
                >
                  {/* Column Header */}
                  <div className="flex items-center justify-between px-1">
                    <div className="flex items-center gap-2">
                      <span className={`w-2 h-2 rounded-full ${statusInfo.dot}`} />
                      <span className="text-xs font-bold text-neutral-800 dark:text-neutral-200">
                        {statusKey}
                      </span>
                    </div>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-black/[0.05] dark:bg-white/[0.08] text-neutral-500 dark:text-neutral-400 font-semibold">
                      {itemsInStatus.length}
                    </span>
                  </div>

                  {/* Cards inside column */}
                  <div className="flex flex-col gap-2 flex-1">
                    {itemsInStatus.map((item) => {
                      const priorityInfo = PRIORITY_CONFIG[item.priority || 'Media'] || PRIORITY_CONFIG['Media']
                      return (
                        <div
                          key={item.id}
                          className="bg-white dark:bg-[#1f2023] border border-black/[0.06] dark:border-white/[0.08] rounded-xl p-3 shadow-xs hover:shadow-md transition group flex flex-col gap-2"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <span className="text-xs font-semibold text-neutral-900 dark:text-neutral-100 leading-snug">
                              {item.title}
                            </span>
                            <button
                              onClick={() => handleDeleteItem(item.id)}
                              className="opacity-0 group-hover:opacity-100 p-1 text-neutral-400 hover:text-rose-500 transition"
                              title="Eliminar tarjeta"
                            >
                              <Trash2 size={12} />
                            </button>
                          </div>

                          {item.description && (
                            <p className="text-[11px] text-neutral-500 dark:text-neutral-400 line-clamp-2">
                              {item.description}
                            </p>
                          )}

                          <div className="flex items-center justify-between pt-1 border-t border-black/[0.04] dark:border-white/[0.04] flex-wrap gap-1 text-[10px]">
                            <span className={`px-1.5 py-0.5 rounded ${priorityInfo.badge} font-medium`}>
                              {item.priority || 'Media'}
                            </span>
                            {item.date && (
                              <span className="flex items-center gap-1 text-neutral-400 font-mono">
                                <CalendarIcon size={11} />
                                {item.date}
                              </span>
                            )}
                          </div>

                          {/* Quick change status dropdown */}
                          <div className="flex items-center justify-between pt-1 text-[10px]">
                            <span className="text-neutral-400">Mover:</span>
                            <select
                              value={item.status}
                              onChange={(e) => handleUpdateItem(item.id, { status: e.target.value })}
                              className="bg-black/[0.04] dark:bg-white/[0.06] text-neutral-600 dark:text-neutral-300 rounded px-1.5 py-0.5 border-none outline-none cursor-pointer"
                            >
                              <option value="Sin empezar">Sin empezar</option>
                              <option value="En progreso">En progreso</option>
                              <option value="En revisión">En revisión</option>
                              <option value="Completado">Completado</option>
                            </select>
                          </div>
                        </div>
                      )
                    })}
                  </div>

                  {/* Add card button */}
                  <button
                    onClick={() => handleAddItem({ status: statusKey })}
                    className="flex items-center justify-center gap-1.5 py-2 rounded-xl border border-dashed border-black/[0.1] dark:border-white/[0.1] hover:border-blue-500 text-xs text-neutral-500 hover:text-blue-500 transition cursor-pointer"
                  >
                    <Plus size={13} />
                    <span>Añadir tarjeta</span>
                  </button>
                </div>
              )
            })}
          </div>
        )}

        {/* 3. LIST VIEW */}
        {activeView === 'list' && (
          <div className="flex flex-col gap-1.5 w-full">
            {filteredItems.map((item) => {
              const isDone = item.status === 'Completado' || item.completed
              const priorityInfo = PRIORITY_CONFIG[item.priority || 'Media'] || PRIORITY_CONFIG['Media']
              return (
                <div
                  key={item.id}
                  className="flex items-center justify-between p-2.5 rounded-xl border border-black/[0.05] dark:border-white/[0.06] bg-white/50 dark:bg-black/20 hover:bg-black/[0.02] dark:hover:bg-white/[0.03] transition group text-xs gap-3"
                >
                  <div className="flex items-center gap-2.5 min-w-0 flex-1">
                    <button
                      onClick={() =>
                        handleUpdateItem(item.id, {
                          completed: !isDone,
                          status: !isDone ? 'Completado' : 'Sin empezar'
                        })
                      }
                      className="text-neutral-400 hover:text-blue-500 transition shrink-0 cursor-pointer"
                    >
                      {isDone ? (
                        <CheckCircle2 size={16} className="text-emerald-500" />
                      ) : (
                        <Circle size={16} />
                      )}
                    </button>
                    <input
                      type="text"
                      value={item.title}
                      onChange={(e) => handleUpdateItem(item.id, { title: e.target.value })}
                      className={`w-full bg-transparent border-none outline-none font-medium truncate ${
                        isDone
                          ? 'line-through text-neutral-400 dark:text-neutral-500'
                          : 'text-neutral-800 dark:text-neutral-100'
                      }`}
                    />
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <select
                      value={item.status}
                      onChange={(e) => handleUpdateItem(item.id, { status: e.target.value })}
                      className="text-[11px] px-2 py-0.5 rounded-full bg-black/[0.04] dark:bg-white/[0.06] text-neutral-600 dark:text-neutral-300 border-none outline-none cursor-pointer"
                    >
                      <option value="Sin empezar">Sin empezar</option>
                      <option value="En progreso">En progreso</option>
                      <option value="En revisión">En revisión</option>
                      <option value="Completado">Completado</option>
                    </select>

                    <span className={`px-2 py-0.5 rounded-md text-[10px] ${priorityInfo.badge} font-medium`}>
                      {item.priority || 'Media'}
                    </span>

                    {item.date && (
                      <span className="text-[11px] text-neutral-400 font-mono hidden sm:inline">
                        {item.date}
                      </span>
                    )}

                    <button
                      onClick={() => handleDeleteItem(item.id)}
                      className="opacity-0 group-hover:opacity-100 p-1 text-neutral-400 hover:text-rose-500 transition cursor-pointer"
                      title="Eliminar elemento"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              )
            })}

            <button
              onClick={() => handleAddItem()}
              className="flex items-center gap-2 p-2.5 text-xs text-neutral-500 hover:text-blue-500 transition cursor-pointer font-medium"
            >
              <Plus size={14} />
              <span>+ Nuevo elemento</span>
            </button>
          </div>
        )}

        {/* 4. TIMELINE VIEW (GANTT) */}
        {activeView === 'timeline' && (
          <div className="w-full overflow-x-auto">
            <div className="min-w-[650px] border border-black/[0.06] dark:border-white/[0.08] rounded-xl overflow-hidden bg-white/40 dark:bg-black/20">
              {/* Timeline Header axis */}
              <div className="flex items-center border-b border-black/[0.06] dark:border-white/[0.08] bg-black/[0.02] dark:bg-white/[0.03] text-xs font-semibold text-neutral-500">
                <div className="w-48 p-2.5 border-r border-black/[0.06] dark:border-white/[0.08]">
                  Tarea / Cronograma
                </div>
                <div className="flex-1 grid grid-cols-7 text-center py-2 text-[11px]">
                  <span>Sem 1</span>
                  <span>Sem 2</span>
                  <span>Sem 3</span>
                  <span>Sem 4</span>
                  <span>Sem 5</span>
                  <span>Sem 6</span>
                  <span>Sem 7</span>
                </div>
              </div>

              {/* Timeline Rows */}
              <div className="divide-y divide-black/[0.04] dark:divide-white/[0.04]">
                {filteredItems.map((item, idx) => {
                  const statusInfo = STATUS_CONFIG[item.status] || STATUS_CONFIG['Sin empezar']
                  // Calculate dummy position for Gantt bar based on index or date
                  const leftOffsets = ['15%', '30%', '45%', '10%', '60%']
                  const widths = ['35%', '40%', '30%', '50%', '25%']
                  const left = leftOffsets[idx % leftOffsets.length]
                  const width = widths[idx % widths.length]

                  return (
                    <div key={item.id} className="flex items-center h-11 hover:bg-black/[0.02] dark:hover:bg-white/[0.02] transition">
                      <div className="w-48 px-3 text-xs font-medium text-neutral-800 dark:text-neutral-200 truncate border-r border-black/[0.06] dark:border-white/[0.08]">
                        {item.title}
                      </div>
                      <div className="flex-1 relative h-full flex items-center px-2">
                        {/* Gantt Bar */}
                        <div
                          style={{ left, width }}
                          className={`absolute h-6 rounded-lg ${statusInfo.bg} px-2.5 flex items-center justify-between text-[11px] font-medium shadow-xs border border-black/10 dark:border-white/10`}
                        >
                          <span className="truncate">{item.title}</span>
                          <span className="text-[9px] opacity-75 font-mono ml-1">{item.status}</span>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>

              <div
                onClick={() => handleAddItem()}
                className="p-2.5 flex items-center gap-2 text-xs text-neutral-500 hover:text-blue-500 cursor-pointer border-t border-black/[0.04] dark:border-white/[0.04]"
              >
                <Plus size={14} />
                <span>+ Añadir tarea al cronograma</span>
              </div>
            </div>
          </div>
        )}

        {/* 5. CALENDAR VIEW */}
        {activeView === 'calendar' && (
          <div className="flex flex-col gap-3">
            {/* Calendar Controls */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <button
                  onClick={() =>
                    setCurrentMonthDate(
                      new Date(currentMonthDate.getFullYear(), currentMonthDate.getMonth() - 1, 1)
                    )
                  }
                  className="p-1.5 rounded-lg border border-black/[0.08] dark:border-white/[0.08] hover:bg-black/5 dark:hover:bg-white/10 text-neutral-600 dark:text-neutral-300 cursor-pointer"
                  title="Mes anterior"
                >
                  <ChevronLeft size={15} />
                </button>
                <span className="text-sm font-bold text-neutral-800 dark:text-neutral-100 min-w-[130px] text-center">
                  {monthNames[currentMonthDate.getMonth()]} {currentMonthDate.getFullYear()}
                </span>
                <button
                  onClick={() =>
                    setCurrentMonthDate(
                      new Date(currentMonthDate.getFullYear(), currentMonthDate.getMonth() + 1, 1)
                    )
                  }
                  className="p-1.5 rounded-lg border border-black/[0.08] dark:border-white/[0.08] hover:bg-black/5 dark:hover:bg-white/10 text-neutral-600 dark:text-neutral-300 cursor-pointer"
                  title="Mes siguiente"
                >
                  <ChevronRight size={15} />
                </button>
              </div>

              <button
                onClick={() => setCurrentMonthDate(new Date())}
                className="px-2.5 py-1 rounded-lg border border-black/[0.08] dark:border-white/[0.08] text-xs font-medium text-neutral-600 dark:text-neutral-300 hover:bg-black/5 dark:hover:bg-white/10 cursor-pointer"
              >
                Hoy
              </button>
            </div>

            {/* Calendar Grid */}
            <div className="border border-black/[0.08] dark:border-white/[0.08] rounded-2xl overflow-hidden bg-white/40 dark:bg-black/20">
              {/* Day of Week Header */}
              <div className="grid grid-cols-7 border-b border-black/[0.06] dark:border-white/[0.08] bg-black/[0.03] dark:bg-white/[0.03] text-center text-xs font-semibold text-neutral-500 py-2">
                <span>Lun</span>
                <span>Mar</span>
                <span>Mié</span>
                <span>Jue</span>
                <span>Vie</span>
                <span>Sáb</span>
                <span>Dom</span>
              </div>

              {/* Month Day Cells */}
              <div className="grid grid-cols-7 divide-x divide-y divide-black/[0.05] dark:divide-white/[0.05]">
                {calendarDays.map((cell, idx) => {
                  const itemsOnDay = filteredItems.filter((i) => i.date === cell.dateStr)
                  const isToday = cell.dateStr === new Date().toISOString().split('T')[0]
                  return (
                    <div
                      key={idx}
                      onClick={() => handleAddItem({ date: cell.dateStr, title: `Tarea del ${cell.day}` })}
                      className={`min-h-[75px] sm:min-h-[85px] p-1.5 flex flex-col gap-1 transition cursor-pointer hover:bg-blue-500/5 ${
                        cell.isCurrentMonth
                          ? 'bg-transparent text-neutral-800 dark:text-neutral-200'
                          : 'opacity-35 bg-black/[0.01] dark:bg-white/[0.01]'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span
                          className={`text-[11px] font-mono px-1.5 py-0.2 rounded-full ${
                            isToday
                              ? 'bg-blue-600 text-white font-bold'
                              : 'text-neutral-500'
                          }`}
                        >
                          {cell.day}
                        </span>
                        {itemsOnDay.length > 0 && (
                          <span className="text-[9px] text-neutral-400 font-semibold">
                            {itemsOnDay.length}
                          </span>
                        )}
                      </div>

                      {/* Events in cell */}
                      <div className="flex flex-col gap-1 overflow-y-auto max-h-[50px] custom-scrollbar">
                        {itemsOnDay.map((item) => {
                          const statusInfo = STATUS_CONFIG[item.status] || STATUS_CONFIG['Sin empezar']
                          return (
                            <div
                              key={item.id}
                              onClick={(e) => {
                                e.stopPropagation()
                                setEditingItemId(item.id)
                              }}
                              className={`px-1.5 py-0.5 rounded text-[10px] truncate font-medium ${statusInfo.bg} shadow-2xs`}
                              title={item.title}
                            >
                              {item.title}
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        )}

        {/* 6. GALLERY VIEW */}
        {activeView === 'gallery' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {filteredItems.map((item) => {
              const statusInfo = STATUS_CONFIG[item.status] || STATUS_CONFIG['Sin empezar']
              const priorityInfo = PRIORITY_CONFIG[item.priority || 'Media'] || PRIORITY_CONFIG['Media']
              return (
                <div
                  key={item.id}
                  className="rounded-2xl border border-black/[0.08] dark:border-white/[0.08] bg-white dark:bg-[#1a1b1e] overflow-hidden shadow-xs hover:shadow-xl transition group flex flex-col cursor-pointer"
                >
                  {/* Top Cover Banner */}
                  <div
                    className={`h-24 bg-gradient-to-r ${item.coverColor || 'from-blue-600 to-indigo-600'} p-3 flex items-start justify-between relative`}
                  >
                    <span className="p-1.5 rounded-xl bg-white/20 backdrop-blur-md text-white text-xs font-bold">
                      📄
                    </span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        handleDeleteItem(item.id)
                      }}
                      className="opacity-0 group-hover:opacity-100 p-1 rounded-md bg-black/40 text-white hover:bg-rose-600 transition"
                      title="Eliminar tarjeta"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>

                  {/* Body Content */}
                  <div className="p-3.5 flex flex-col gap-2 flex-1">
                    <input
                      type="text"
                      value={item.title}
                      onChange={(e) => handleUpdateItem(item.id, { title: e.target.value })}
                      className="w-full bg-transparent border-none outline-none text-xs font-bold text-neutral-900 dark:text-neutral-100"
                    />

                    {item.description && (
                      <p className="text-[11px] text-neutral-500 dark:text-neutral-400 line-clamp-2">
                        {item.description}
                      </p>
                    )}

                    <div className="flex items-center justify-between pt-2 border-t border-black/[0.05] dark:border-white/[0.06] text-[10px] mt-auto">
                      <span className={`px-2 py-0.5 rounded-full font-medium ${statusInfo.bg}`}>
                        {item.status}
                      </span>
                      <span className={`px-1.5 py-0.5 rounded font-medium ${priorityInfo.badge}`}>
                        {item.priority || 'Media'}
                      </span>
                    </div>
                  </div>
                </div>
              )
            })}

            {/* Add Card Tile */}
            <div
              onClick={() => handleAddItem()}
              className="rounded-2xl border-2 border-dashed border-black/[0.1] dark:border-white/[0.1] hover:border-blue-500 hover:bg-blue-500/5 min-h-[160px] flex flex-col items-center justify-center gap-2 text-neutral-400 hover:text-blue-500 transition cursor-pointer"
            >
              <Plus size={24} />
              <span className="text-xs font-semibold">Nueva tarjeta de Galería</span>
            </div>
          </div>
        )}
      </div>

      {/* Notion Item Detail Modal */}
      {editingItemId && (() => {
        const currentItem = data.items.find((i) => i.id === editingItemId)
        if (!currentItem) return null
        return (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4 animate-in fade-in duration-100"
            onClick={() => setEditingItemId(null)}
          >
            <div
              className="w-full max-w-lg bg-white dark:bg-[#1a1b1e] border border-black/[0.08] dark:border-white/[0.1] rounded-3xl shadow-2xl overflow-hidden p-6 flex flex-col gap-4 text-xs select-text"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-400">
                  Propiedades de la tarea Notion
                </span>
                <button
                  onClick={() => setEditingItemId(null)}
                  className="p-1 rounded-full text-neutral-400 hover:text-neutral-900 dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/10 transition cursor-pointer"
                >
                  <X size={15} />
                </button>
              </div>

              {/* Title input */}
              <input
                type="text"
                value={currentItem.title}
                onChange={(e) => handleUpdateItem(currentItem.id, { title: e.target.value })}
                placeholder="Título de la tarea"
                className="text-lg font-bold bg-transparent border-none outline-none text-neutral-900 dark:text-neutral-100"
              />

              {/* Grid properties */}
              <div className="grid grid-cols-2 gap-3 py-2 border-y border-black/[0.06] dark:border-white/[0.08]">
                <div>
                  <label className="block text-[11px] text-neutral-500 mb-1">Estado</label>
                  <select
                    value={currentItem.status}
                    onChange={(e) => handleUpdateItem(currentItem.id, { status: e.target.value })}
                    className="w-full px-2.5 py-1.5 rounded-xl bg-black/[0.03] dark:bg-white/[0.05] border border-black/[0.08] dark:border-white/[0.08] text-xs font-medium outline-none text-neutral-800 dark:text-neutral-200"
                  >
                    <option value="Sin empezar">Sin empezar</option>
                    <option value="En progreso">En progreso</option>
                    <option value="En revisión">En revisión</option>
                    <option value="Completado">Completado</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] text-neutral-500 mb-1">Prioridad</label>
                  <select
                    value={currentItem.priority || 'Media'}
                    onChange={(e) => handleUpdateItem(currentItem.id, { priority: e.target.value as any })}
                    className="w-full px-2.5 py-1.5 rounded-xl bg-black/[0.03] dark:bg-white/[0.05] border border-black/[0.08] dark:border-white/[0.08] text-xs font-medium outline-none text-neutral-800 dark:text-neutral-200"
                  >
                    <option value="Baja">Baja</option>
                    <option value="Media">Media</option>
                    <option value="Alta">Alta</option>
                    <option value="Urgente">Urgente</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] text-neutral-500 mb-1">Fecha programada</label>
                  <input
                    type="date"
                    value={currentItem.date || ''}
                    onChange={(e) => handleUpdateItem(currentItem.id, { date: e.target.value })}
                    className="w-full px-2.5 py-1.5 rounded-xl bg-black/[0.03] dark:bg-white/[0.05] border border-black/[0.08] dark:border-white/[0.08] text-xs font-mono outline-none text-neutral-800 dark:text-neutral-200"
                  />
                </div>

                <div>
                  <label className="block text-[11px] text-neutral-500 mb-1">Responsable</label>
                  <input
                    type="text"
                    value={currentItem.assignee || ''}
                    onChange={(e) => handleUpdateItem(currentItem.id, { assignee: e.target.value })}
                    placeholder="Nombre del responsable"
                    className="w-full px-2.5 py-1.5 rounded-xl bg-black/[0.03] dark:bg-white/[0.05] border border-black/[0.08] dark:border-white/[0.08] text-xs outline-none text-neutral-800 dark:text-neutral-200"
                  />
                </div>
              </div>

              {/* Description */}
              <div>
                <label className="block text-[11px] text-neutral-500 mb-1">Descripción / Notas</label>
                <textarea
                  rows={3}
                  value={currentItem.description || ''}
                  onChange={(e) => handleUpdateItem(currentItem.id, { description: e.target.value })}
                  placeholder="Detalles sobre este elemento..."
                  className="w-full px-3 py-2 rounded-xl bg-black/[0.03] dark:bg-white/[0.05] border border-black/[0.08] dark:border-white/[0.08] text-xs outline-none text-neutral-800 dark:text-neutral-200 resize-none font-sans"
                />
              </div>

              {/* Footer actions */}
              <div className="flex items-center justify-between pt-2">
                <button
                  onClick={() => {
                    handleDeleteItem(currentItem.id)
                    setEditingItemId(null)
                  }}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-rose-500 hover:bg-rose-500/10 transition cursor-pointer font-medium"
                >
                  <Trash2 size={13} />
                  <span>Eliminar</span>
                </button>

                <button
                  onClick={() => setEditingItemId(null)}
                  className="px-4 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold shadow-xs transition cursor-pointer"
                >
                  Listo
                </button>
              </div>
            </div>
          </div>
        )
      })()}
    </div>
  )
}
