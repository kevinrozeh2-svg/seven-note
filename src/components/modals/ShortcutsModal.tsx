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
      className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        className="rounded-2xl max-w-2xl w-full border shadow-2xl overflow-hidden flex flex-col max-h-[85vh]"
        style={{
          backgroundColor: 'var(--affine-background-overlay-panel-color)',
          borderColor: 'var(--affine-border-color)',
          boxShadow: 'var(--affine-popover-shadow)',
          color: 'var(--affine-text-primary-color)'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          className="px-5 py-3.5 border-b flex items-center justify-between shrink-0"
          style={{ borderColor: 'var(--affine-border-color)' }}
        >
          <div className="flex items-center gap-2.5">
            <div
              className="w-7 h-7 rounded-lg flex items-center justify-center"
              style={{
                backgroundColor: 'rgba(30, 150, 235, 0.1)',
                color: '#1e96eb'
              }}
            >
              <SettingsIcon style={{ width: 16, height: 16 }} />
            </div>
            <div>
              <h3 className="text-sm font-semibold" style={{ color: 'var(--affine-text-primary-color)' }}>
                Atajos de Teclado (AFFiNE Canary)
              </h3>
              <p className="text-[11px]" style={{ color: 'var(--affine-text-secondary-color)' }}>
                Referencia rápida de productividad para lienzo y editor
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg transition"
            style={{ color: 'var(--affine-text-secondary-color)' }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = 'var(--affine-hover-color)'
              e.currentTarget.style.color = 'var(--affine-text-primary-color)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent'
              e.currentTarget.style.color = 'var(--affine-text-secondary-color)'
            }}
            title="Cerrar (Esc)"
          >
            <CloseIcon style={{ width: 16, height: 16 }} />
          </button>
        </div>

        {/* Search bar */}
        <div
          className="px-5 py-2.5 border-b shrink-0"
          style={{
            borderColor: 'var(--affine-border-color)',
            backgroundColor: 'var(--affine-background-secondary-color)'
          }}
        >
          <div className="relative">
            <SearchIcon
              style={{
                position: 'absolute',
                left: 10,
                top: 8,
                width: 14,
                height: 14,
                color: 'var(--affine-text-secondary-color)'
              }}
            />
            <input
              type="text"
              placeholder="Buscar atajo o acción (ej. flecha, diapositiva, código)..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-lg pl-9 pr-3 py-1.5 text-xs outline-none border transition"
              style={{
                backgroundColor: 'var(--affine-background-primary-color)',
                borderColor: 'var(--affine-border-color)',
                color: 'var(--affine-text-primary-color)'
              }}
              onFocus={(e) => (e.currentTarget.style.borderColor = '#1e96eb')}
              onBlur={(e) => (e.currentTarget.style.borderColor = 'var(--affine-border-color)')}
              autoFocus
            />
          </div>
        </div>

        {/* Main tabs or search results */}
        {!searchQuery.trim() ? (
          <div className="flex flex-1 min-h-0">
            {/* Category tabs sidebar */}
            <div
              className="w-48 border-r p-2 space-y-1 shrink-0"
              style={{
                borderColor: 'var(--affine-border-color)',
                backgroundColor: 'var(--affine-background-secondary-color)'
              }}
            >
              {SHORTCUT_CATEGORIES.map((cat) => {
                const Icon = cat.icon
                const isActive = activeTab === cat.id
                return (
                  <button
                    key={cat.id}
                    onClick={() => setActiveTab(cat.id)}
                    className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium text-left transition"
                    style={{
                      backgroundColor: isActive ? 'var(--affine-hover-color)' : 'transparent',
                      color: isActive ? '#1e96eb' : 'var(--affine-text-secondary-color)',
                      fontWeight: isActive ? 600 : 400
                    }}
                    onMouseEnter={(e) => {
                      if (!isActive) {
                        e.currentTarget.style.backgroundColor = 'var(--affine-hover-color)'
                        e.currentTarget.style.color = 'var(--affine-text-primary-color)'
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!isActive) {
                        e.currentTarget.style.backgroundColor = 'transparent'
                        e.currentTarget.style.color = 'var(--affine-text-secondary-color)'
                      }
                    }}
                  >
                    <Icon style={{ width: 14, height: 14, flexShrink: 0 }} />
                    <span>{cat.title}</span>
                  </button>
                )
              })}
            </div>

            {/* Category items list */}
            <div className="flex-1 overflow-y-auto p-4 space-y-2">
              <h4
                className="text-xs font-semibold uppercase tracking-wider mb-3"
                style={{ color: 'var(--affine-text-secondary-color)' }}
              >
                {currentCategory?.title}
              </h4>
              <div className="space-y-1.5">
                {currentCategory?.items.map((item, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between p-2 rounded-lg border transition text-xs"
                    style={{
                      backgroundColor: 'var(--affine-background-secondary-color)',
                      borderColor: 'var(--affine-border-color)'
                    }}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="truncate" style={{ color: 'var(--affine-text-primary-color)' }}>
                        {item.description}
                      </span>
                      {item.tag && (
                        <span
                          className="text-[10px] px-1.5 py-0.5 rounded border"
                          style={{
                            backgroundColor: 'var(--affine-hover-color)',
                            borderColor: 'var(--affine-border-color)',
                            color: 'var(--affine-text-secondary-color)'
                          }}
                        >
                          {item.tag}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1 shrink-0 ml-3">
                      {item.keys.map((k, kIdx) => (
                        <kbd
                          key={kIdx}
                          className="px-2 py-0.5 rounded text-[11px] font-mono shadow-xs border"
                          style={{
                            backgroundColor: 'var(--affine-background-primary-color)',
                            borderColor: 'var(--affine-border-color)',
                            color: 'var(--affine-text-primary-color)'
                          }}
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
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {filteredCategories.length === 0 ? (
              <div
                className="text-center py-8 text-xs"
                style={{ color: 'var(--affine-text-secondary-color)' }}
              >
                No se encontraron atajos para "{searchQuery}"
              </div>
            ) : (
              filteredCategories.map((cat) => (
                <div key={cat.id} className="space-y-1.5">
                  <h4
                    className="text-xs font-semibold uppercase tracking-wider"
                    style={{ color: 'var(--affine-text-secondary-color)' }}
                  >
                    {cat.title}
                  </h4>
                  {cat.items.map((item, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between p-2 rounded-lg border transition text-xs"
                      style={{
                        backgroundColor: 'var(--affine-background-secondary-color)',
                        borderColor: 'var(--affine-border-color)'
                      }}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="truncate" style={{ color: 'var(--affine-text-primary-color)' }}>
                          {item.description}
                        </span>
                        {item.tag && (
                          <span
                            className="text-[10px] px-1.5 py-0.5 rounded border"
                            style={{
                              backgroundColor: 'var(--affine-hover-color)',
                              borderColor: 'var(--affine-border-color)',
                              color: 'var(--affine-text-secondary-color)'
                            }}
                          >
                            {item.tag}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-1 shrink-0 ml-3">
                        {item.keys.map((k, kIdx) => (
                          <kbd
                            key={kIdx}
                            className="px-2 py-0.5 rounded text-[11px] font-mono shadow-xs border"
                            style={{
                              backgroundColor: 'var(--affine-background-primary-color)',
                              borderColor: 'var(--affine-border-color)',
                              color: 'var(--affine-text-primary-color)'
                            }}
                          >
                            {k}
                          </kbd>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              ))
            )}
          </div>
        )}

        {/* Footer */}
        <div
          className="px-5 py-2.5 border-t flex items-center justify-between text-[11px] shrink-0"
          style={{
            borderColor: 'var(--affine-border-color)',
            backgroundColor: 'var(--affine-background-secondary-color)',
            color: 'var(--affine-text-secondary-color)'
          }}
        >
          <span>
            Presiona{' '}
            <kbd
              className="font-mono px-1.5 py-0.5 rounded border"
              style={{
                backgroundColor: 'var(--affine-background-primary-color)',
                borderColor: 'var(--affine-border-color)',
                color: 'var(--affine-text-primary-color)'
              }}
            >
              ?
            </kbd>{' '}
            en cualquier momento para ver esta guía
          </span>
          <span>Seven Note • AFFiNE Architecture</span>
        </div>
      </div>
    </div>
  )
}
