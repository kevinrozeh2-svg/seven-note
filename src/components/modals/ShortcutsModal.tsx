import { useState } from 'react'
import {
  CloseIcon,
  SearchIcon,
  EdgelessIcon,
  PageIcon,
  PresentationIcon,
  AllDocsIcon,
  SettingsIcon
} from '@blocksuite/icons/rc'

interface ShortcutsModalProps {
  isOpen: boolean
  onClose: () => void
}

interface ShortcutItem {
  keys: string[]
  description: string
  tag?: string
}

interface ShortcutCategory {
  id: string
  title: string
  icon: any
  items: ShortcutItem[]
}

const SHORTCUT_CATEGORIES: ShortcutCategory[] = [
  {
    id: 'canvas',
    title: 'Lienzo (Edgeless)',
    icon: EdgelessIcon,
    items: [
      { keys: ['V'], description: 'Herramienta de Selección / Puntero', tag: 'Herramienta' },
      { keys: ['T'], description: 'Insertar Tarjeta de Texto', tag: 'Creación' },
      { keys: ['N'], description: 'Insertar Nota Adhesiva (Sticky Note)', tag: 'Creación' },
      { keys: ['S'], description: 'Insertar Forma Geométrica (Rectángulo, etc.)', tag: 'Creación' },
      { keys: ['F'], description: 'Crear Marco de Diapositiva (Slide Frame)', tag: 'Presentación' },
      { keys: ['C'], description: 'Herramienta de Conector / Flecha', tag: 'Diagrama' },
      { keys: ['D', 'P'], description: 'Lápiz de dibujo libre', tag: 'Trazos' },
      { keys: ['H'], description: 'Resaltador de trazos', tag: 'Trazos' },
      { keys: ['E'], description: 'Borrador de trazos', tag: 'Trazos' },
      { keys: ['Ctrl', 'D'], description: 'Duplicar tarjeta seleccionada' },
      { keys: ['Supr', 'Backspace'], description: 'Eliminar elemento o flecha seleccionada' },
      { keys: ['Espacio', 'Arrastre'], description: 'Desplazar lienzo libremente (Pan)' },
      { keys: ['Ctrl', 'Rueda'], description: 'Hacer zoom en el lienzo' },
      { keys: ['0'], description: 'Ajustar zoom al contenido (Fit View)' }
    ]
  },
  {
    id: 'editor',
    title: 'Editor de Documento',
    icon: PageIcon,
    items: [
      { keys: ['/'], description: 'Abrir Menú de Comandos (Slash Menu)', tag: 'Esencial' },
      { keys: ['Ctrl', 'B'], description: 'Texto en negrita' },
      { keys: ['Ctrl', 'I'], description: 'Texto en cursiva' },
      { keys: ['Ctrl', 'Z'], description: 'Deshacer último cambio' },
      { keys: ['Ctrl', 'Y'], description: 'Rehacer cambio' },
      { keys: ['#', 'Espacio'], description: 'Título Grande (H1)', tag: 'Markdown' },
      { keys: ['##', 'Espacio'], description: 'Título Mediano (H2)', tag: 'Markdown' },
      { keys: ['###', 'Espacio'], description: 'Título Pequeño (H3)', tag: 'Markdown' },
      { keys: ['-', 'Espacio'], description: 'Lista con viñetas', tag: 'Markdown' },
      { keys: ['1.', 'Espacio'], description: 'Lista numerada', tag: 'Markdown' },
      { keys: ['[]', 'Espacio'], description: 'Casilla de verificación / Tarea', tag: 'Markdown' },
      { keys: ['>', 'Espacio'], description: 'Bloque de cita destacada', tag: 'Markdown' },
      { keys: ['```', 'Espacio'], description: 'Bloque de código con syntax highlighting', tag: 'Markdown' },
      { keys: ['Tab'], description: 'Aumentar sangría en lista' },
      { keys: ['Shift', 'Tab'], description: 'Disminuir sangría en lista' }
    ]
  },
  {
    id: 'presentation',
    title: 'Modo Presentación',
    icon: PresentationIcon,
    items: [
      { keys: ['→', 'Espacio'], description: 'Siguiente diapositiva' },
      { keys: ['←', 'Retroceso'], description: 'Diapositiva anterior' },
      { keys: ['L'], description: 'Alternar Puntero Láser interactivo', tag: 'Interacción' },
      { keys: ['T'], description: 'Alternar Temporizador / Cronómetro', tag: 'Herramienta' },
      { keys: ['Inicio'], description: 'Saltar a la primera diapositiva' },
      { keys: ['Fin'], description: 'Saltar a la última diapositiva' },
      { keys: ['Esc'], description: 'Salir del modo presentación a pantalla completa' }
    ]
  },
  {
    id: 'general',
    title: 'General & Navegación',
    icon: AllDocsIcon,
    items: [
      { keys: ['Ctrl', 'K'], description: 'Búsqueda global y Paleta de Comandos', tag: 'Navegación' },
      { keys: ['Ctrl', 'F'], description: 'Buscar texto dentro de la página', tag: 'Búsqueda' },
      { keys: ['Alt', 'N'], description: 'Captura Rápida (Quick Scratchpad)', tag: 'Productividad' },
      { keys: ['Alt', 'A'], description: 'Asistente de IA inteligente (BYOK)', tag: 'IA' },
      { keys: ['Ctrl', '\\'], description: 'Mostrar u ocultar barra lateral', tag: 'Navegación' },
      { keys: ['Ctrl', '+'], description: 'Aumentar tamaño y escala de interfaz', tag: 'Interfaz' },
      { keys: ['Ctrl', '-'], description: 'Reducir tamaño y escala de interfaz', tag: 'Interfaz' },
      { keys: ['Ctrl', '0'], description: 'Restablecer escala de interfaz al 100%', tag: 'Interfaz' },
      { keys: ['?'], description: 'Abrir este menú de atajos de teclado' },
      { keys: ['Ctrl', '/'], description: 'Abrir este menú de atajos de teclado' },
      { keys: ['Esc'], description: 'Cerrar cualquier ventana emergente o modal' }
    ]
  }
]

export function ShortcutsModal({ isOpen, onClose }: ShortcutsModalProps) {
  const [activeTab, setActiveTab] = useState<string>('canvas')
  const [searchQuery, setSearchQuery] = useState('')

  if (!isOpen) return null

  const currentCategory = SHORTCUT_CATEGORIES.find((c) => c.id === activeTab)

  const filteredCategories = searchQuery.trim()
    ? SHORTCUT_CATEGORIES.map((cat) => ({
        ...cat,
        items: cat.items.filter(
          (item) =>
            item.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
            item.keys.some((k) => k.toLowerCase().includes(searchQuery.toLowerCase())) ||
            (item.tag && item.tag.toLowerCase().includes(searchQuery.toLowerCase()))
        )
      })).filter((cat) => cat.items.length > 0)
    : []

  return (
    <div
      className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        className="rounded-xl max-w-2xl w-full border border-[var(--app-border-strong)] shadow-[var(--app-shadow-popover)] overflow-hidden flex flex-col max-h-[85vh] bg-[var(--app-bg-overlay)] text-[var(--app-text-primary)] font-sans"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 py-3.5 border-b border-[var(--app-divider)] flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-7 h-7 rounded-md flex items-center justify-center shrink-0 bg-[var(--app-hover)] text-[var(--app-text-secondary)]">
              <SettingsIcon style={{ width: 16, height: 16 }} />
            </div>
            <div className="min-w-0">
              <h3 className="text-sm font-semibold truncate text-[var(--app-text-primary)]">
                Atajos de teclado
              </h3>
              <p className="text-[11px] truncate text-[var(--app-text-muted)]">
                Referencia rápida para lienzo y editor
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-md text-[var(--app-text-secondary)] hover:text-[var(--app-text-primary)] hover:bg-[var(--app-hover)] transition-colors shrink-0 cursor-pointer"
            title="Cerrar (Esc)"
          >
            <CloseIcon style={{ width: 16, height: 16 }} />
          </button>
        </div>

        {/* Search bar */}
        <div className="px-5 py-2.5 border-b border-[var(--app-divider)] shrink-0 bg-[var(--app-bg-secondary)]">
          <div className="relative">
            <SearchIcon
              style={{
                position: 'absolute',
                left: 10,
                top: 8,
                width: 14,
                height: 14,
                color: 'var(--app-text-muted)'
              }}
            />
            <input
              type="text"
              placeholder="Buscar atajo o acción (ej. flecha, diapositiva, código)..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-md pl-9 pr-3 py-1.5 text-xs outline-none border border-[var(--app-border-strong)] bg-[var(--app-bg-primary)] text-[var(--app-text-primary)] placeholder:text-[var(--app-text-muted)] focus:border-[var(--app-accent)] transition-colors"
              autoFocus
            />
          </div>
        </div>

        {/* Main tabs or search results */}
        {!searchQuery.trim() ? (
          <div className="flex flex-col sm:flex-row flex-1 min-h-0">
            {/* Category tabs sidebar */}
            <div className="w-full sm:w-48 border-b sm:border-b-0 sm:border-r border-[var(--app-divider)] bg-[var(--app-bg-secondary)] p-2 flex sm:flex-col overflow-x-auto sm:overflow-x-visible shrink-0 gap-1 no-scrollbar">
              {SHORTCUT_CATEGORIES.map((cat) => {
                const Icon = cat.icon
                const isActive = activeTab === cat.id
                return (
                  <button
                    key={cat.id}
                    onClick={() => setActiveTab(cat.id)}
                    className={`flex items-center gap-2 px-2.5 py-1.5 rounded-md text-xs text-left transition-colors whitespace-nowrap shrink-0 sm:w-full cursor-pointer ${
                      isActive
                        ? 'bg-[var(--app-hover-filled)] text-[var(--app-text-primary)] font-semibold'
                        : 'text-[var(--app-text-secondary)] hover:bg-[var(--app-hover)] hover:text-[var(--app-text-primary)] font-medium'
                    }`}
                  >
                    <Icon
                      style={{
                        width: 14,
                        height: 14,
                        flexShrink: 0,
                        color: isActive ? 'var(--app-accent)' : 'currentColor'
                      }}
                    />
                    <span>{cat.title}</span>
                  </button>
                )
              })}
            </div>

            {/* Category items list */}
            <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
              <h4 className="text-[11px] font-semibold uppercase tracking-wider mb-2.5 px-2 text-[var(--app-text-muted)]">
                {currentCategory?.title}
              </h4>
              <div className="divide-y divide-[var(--app-divider)]">
                {currentCategory?.items.map((item, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between px-2 py-2 hover:bg-[var(--app-hover)] rounded-md transition-colors text-xs"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="truncate text-[var(--app-text-primary)]">
                        {item.description}
                      </span>
                      {item.tag && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--app-hover)] text-[var(--app-text-muted)] shrink-0">
                          {item.tag}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1 shrink-0 ml-3">
                      {item.keys.map((k, kIdx) => (
                        <kbd
                          key={kIdx}
                          className="px-1.5 py-0.5 rounded text-[11px] font-mono border border-[var(--app-border-strong)] bg-[var(--app-bg-secondary)] text-[var(--app-text-primary)]"
                        >
                          {k}
                        </kbd>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : (
          /* Search results */
          <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
            {filteredCategories.length === 0 ? (
              <div className="text-center py-8 text-xs text-[var(--app-text-muted)]">
                No se encontraron atajos para "{searchQuery}"
              </div>
            ) : (
              filteredCategories.map((cat) => (
                <div key={cat.id} className="space-y-1">
                  <h4 className="text-[11px] font-semibold uppercase tracking-wider px-2 text-[var(--app-text-muted)]">
                    {cat.title}
                  </h4>
                  <div className="divide-y divide-[var(--app-divider)]">
                    {cat.items.map((item, idx) => (
                      <div
                        key={idx}
                        className="flex items-center justify-between px-2 py-2 hover:bg-[var(--app-hover)] rounded-md transition-colors text-xs"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="truncate text-[var(--app-text-primary)]">
                            {item.description}
                          </span>
                          {item.tag && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--app-hover)] text-[var(--app-text-muted)] shrink-0">
                              {item.tag}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-1 shrink-0 ml-3">
                          {item.keys.map((k, kIdx) => (
                            <kbd
                              key={kIdx}
                              className="px-1.5 py-0.5 rounded text-[11px] font-mono border border-[var(--app-border-strong)] bg-[var(--app-bg-secondary)] text-[var(--app-text-primary)]"
                            >
                              {k}
                            </kbd>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* Footer */}
        <div className="px-5 py-2.5 border-t border-[var(--app-divider)] flex items-center justify-between text-[11px] shrink-0 bg-[var(--app-bg-secondary)] text-[var(--app-text-muted)]">
          <span>
            Presiona{' '}
            <kbd className="font-mono px-1.5 py-0.5 rounded border border-[var(--app-border-strong)] bg-[var(--app-bg-primary)] text-[var(--app-text-primary)]">
              ?
            </kbd>{' '}
            en cualquier momento para ver esta guía
          </span>
          <span>Seven Note</span>
        </div>
      </div>
    </div>
  )
}
