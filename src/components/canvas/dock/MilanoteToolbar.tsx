import React, { memo, useMemo, useState } from 'react'
import {
  NoteBlank,
  Smiley,
  LinkSimple,
  Image as ImageIcon,
  FolderSimplePlus,
  Table as TableIcon,
  CheckSquareOffset,
  Palette,
  ChatTeardropText,
  LineSegments,
  PencilSimpleLine,
    Layout,
    X
  } from '@phosphor-icons/react'
  import { EmojiPickerPopover } from '../../modals/EmojiPickerPopover'

  export interface MilanoteToolbarProps {
    onAddNode: (type: any, customData?: any) => void
    onToggleTool?: (tool: string) => void
    activeTool?: string
    onOpenTemplates?: () => void
    onUploadImage?: () => void
  }

  export const MilanoteToolbar: React.FC<MilanoteToolbarProps> = memo(({
    onAddNode,
    onToggleTool,
    activeTool = 'select',
    onOpenTemplates,
    onUploadImage
  }) => {
    const [isEmojiPickerOpen, setIsEmojiPickerOpen] = useState(false)
    const [mobileOpen, setMobileOpen] = useState(false)
    const tools = useMemo(() => [
      {
        id: 'note',
        label: 'Nota',
        icon: <NoteBlank size={20} weight="duotone" />,
        onClick: () => onAddNode('note', { color: 'yellow', title: 'Nota rápida' })
      },
      {
        id: 'emoji',
        label: 'Emoji',
        icon: <Smiley size={20} weight="duotone" />,
        onClick: () => setIsEmojiPickerOpen((prev) => !prev),
        isActive: isEmojiPickerOpen
      },
      {
        id: 'link',
        label: 'Enlace',
        icon: <LinkSimple size={20} weight="duotone" />,
        onClick: () => onAddNode('link', { title: 'Nuevo enlace', url: 'https://' })
      },
      {
        id: 'image',
        label: 'Imagen',
        icon: <ImageIcon size={20} weight="duotone" />,
        onClick: () => onUploadImage ? onUploadImage() : onAddNode('image', { caption: 'Foto' })
      },
      {
        id: 'subboard',
        label: 'Tablero',
        icon: <FolderSimplePlus size={20} weight="duotone" />,
        onClick: () => onAddNode('subboard', { title: 'Nuevo Tablero', subtitle: '0 tarjetas' })
      },
      {
        id: 'table',
        label: 'Tabla',
        icon: <TableIcon size={20} weight="duotone" />,
        onClick: () => onAddNode('table', { title: 'Tabla de datos', headerColor: 'yellow' })
      },
      {
        id: 'todo',
        label: 'Tareas',
        icon: <CheckSquareOffset size={20} weight="duotone" />,
        onClick: () => onAddNode('todo', { color: 'blue', title: 'Lista de tareas' })
      },
      {
        id: 'colorPalette',
        label: 'Color',
        icon: <Palette size={20} weight="duotone" />,
        onClick: () => onAddNode('colorPalette', {
          swatches: [
            { id: '1', hex: '#FFBF00', name: 'Mañana' },
            { id: '2', hex: '#D42511', name: 'Hollywood' },
            { id: '3', hex: '#257EF4', name: 'Azul Dodger' }
          ]
        })
      },
      {
        id: 'comment',
        label: 'Comentario',
        icon: <ChatTeardropText size={20} weight="duotone" />,
        onClick: () => onAddNode('comment', { commentAuthor: 'Usuario', commentDate: 'Hoy' })
      },
      {
        id: 'connector',
        label: 'Línea',
        icon: <LineSegments size={20} weight="duotone" />,
        onClick: () => onToggleTool && onToggleTool('connector'),
        isActive: activeTool === 'connector'
      },
      {
        id: 'pencil',
        label: 'Dibujo',
        icon: <PencilSimpleLine size={20} weight="duotone" />,
        onClick: () => onToggleTool && onToggleTool('pencil'),
        isActive: activeTool === 'pencil'
      },
      {
        id: 'template',
        label: 'Plantillas',
        icon: <Layout size={20} weight="duotone" />,
        onClick: () => onOpenTemplates && onOpenTemplates()
      }
    ], [onAddNode, onToggleTool, activeTool, onOpenTemplates, onUploadImage, isEmojiPickerOpen])

    return (
      <div className="relative select-none z-30 transition-all">
        {/* Mobile Toggle Trigger */}
        <div className="md:hidden">
          {!mobileOpen ? (
            <button
              onClick={() => setMobileOpen(true)}
              className="w-10 h-10 rounded-2xl bg-white/95 dark:bg-[#18191c]/95 backdrop-blur-xl border border-black/[0.08] dark:border-white/[0.1] shadow-xl flex items-center justify-center text-blue-600 dark:text-blue-400 active:scale-95 cursor-pointer"
              title="Abrir herramientas de tablero"
            >
              <Palette size={20} weight="duotone" />
            </button>
          ) : (
            <div className="bg-white/95 dark:bg-[#18191c]/95 backdrop-blur-xl border border-black/[0.08] dark:border-white/[0.1] shadow-2xl rounded-2xl p-2 w-[170px] max-h-[75vh] overflow-y-auto custom-scrollbar animate-in fade-in zoom-in-95 duration-150">
              <div className="flex items-center justify-between pb-1.5 mb-1.5 border-b border-black/[0.06] dark:border-white/[0.08]">
                <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-400 dark:text-neutral-500">
                  Herramientas
                </span>
                <button
                  onClick={() => setMobileOpen(false)}
                  className="w-6 h-6 rounded-lg hover:bg-black/5 dark:hover:bg-white/10 flex items-center justify-center text-neutral-400 hover:text-neutral-800 dark:hover:text-white cursor-pointer"
                  title="Cerrar panel"
                >
                  <X size={14} weight="bold" />
                </button>
              </div>
              <div className="grid grid-cols-2 gap-1">
                {tools.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => {
                      t.onClick()
                      if (t.id !== 'emoji') setMobileOpen(false)
                    }}
                    className={`group relative flex flex-col items-center justify-center py-1.5 px-1 rounded-xl transition-all duration-150 cursor-pointer ${
                      t.isActive
                        ? 'bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 shadow-md scale-105'
                        : 'hover:bg-black/[0.05] dark:hover:bg-white/[0.08] text-neutral-600 dark:text-neutral-300 hover:text-neutral-900 dark:hover:text-white active:scale-95'
                    }`}
                    title={t.label}
                  >
                    <div className="transition-transform duration-150 group-hover:scale-110">
                      {React.cloneElement(t.icon as React.ReactElement<any>, { size: 18 })}
                    </div>
                    <span className="text-[8px] font-medium text-neutral-400 dark:text-neutral-500 group-hover:text-neutral-900 dark:group-hover:text-neutral-100 leading-none mt-0.5 truncate max-w-full">
                      {t.label}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Desktop Full Vertical Dock */}
        <div className="hidden md:flex flex-col items-center bg-white/90 dark:bg-[#18191c]/90 backdrop-blur-xl border border-black/[0.08] dark:border-white/[0.1] shadow-2xl shadow-black/5 dark:shadow-black/30 rounded-2xl p-1.5 gap-0.5">
          {tools.map((t) => (
            <button
              key={t.id}
              onClick={t.onClick}
              className={`group relative flex flex-col items-center justify-center w-11 h-11 rounded-xl transition-all duration-150 cursor-pointer ${
                t.isActive
                  ? 'bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 shadow-md scale-105'
                  : 'hover:bg-black/[0.05] dark:hover:bg-white/[0.08] text-neutral-600 dark:text-neutral-300 hover:text-neutral-900 dark:hover:text-white active:scale-95'
              }`}
              title={t.label}
            >
              <div className="transition-transform duration-150 group-hover:scale-110">
                {t.icon}
              </div>
              <span className="text-[9px] font-medium text-neutral-400 dark:text-neutral-500 group-hover:text-neutral-900 dark:group-hover:text-neutral-100 leading-none mt-0.5">
                {t.label}
              </span>

              {/* Floating Tooltip to the right */}
              <div className="absolute left-13 top-1/2 -translate-y-1/2 px-2.5 py-1 rounded-lg bg-neutral-900/95 dark:bg-white text-white dark:text-neutral-900 text-[11px] font-medium whitespace-nowrap opacity-0 pointer-events-none group-hover:opacity-100 transition-all duration-150 shadow-xl z-50">
                Añadir {t.label}
              </div>
            </button>
          ))}
        </div>

        {/* Apple Emoji Picker Popover */}
        {isEmojiPickerOpen && (
          <>
            <div
              className="fixed inset-0 z-40"
              onClick={() => setIsEmojiPickerOpen(false)}
            />
            <div className="fixed inset-x-3 top-16 md:absolute md:inset-x-auto md:left-16 md:top-6 z-50 flex justify-center md:block pointer-events-none [&>*]:pointer-events-auto">
              <EmojiPickerPopover
                isOpen={isEmojiPickerOpen}
                onClose={() => setIsEmojiPickerOpen(false)}
                onSelectEmoji={(emoji) => {
                  onAddNode('note', { color: 'transparent', title: '', content: emoji, width: 90 })
                  setIsEmojiPickerOpen(false)
                  setMobileOpen(false)
                }}
                title="Añadir Emoji al Tablero"
                align="left"
                isModal={typeof window !== 'undefined' && window.innerWidth < 768}
              />
            </div>
          </>
        )}
      </div>
    )
  })
