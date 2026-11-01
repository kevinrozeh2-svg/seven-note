import React, { memo, useMemo, useState } from 'react'
import {
  NoteBlank,
  LinkSimple,
  Image as ImageIcon,
  FolderSimplePlus,
  Table as TableIcon,
  CheckSquareOffset,
  Palette,
  ChatTeardropText,
  LineSegments,
  PencilSimpleLine,
  Layout
} from '@phosphor-icons/react'
import { AppleEmoji } from '../../ui/AppleEmoji'
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
      icon: <AppleEmoji emoji="✨" size={20} />,
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
    <div className="relative flex flex-col items-center bg-white/90 dark:bg-[#18191c]/90 backdrop-blur-xl border border-black/[0.08] dark:border-white/[0.1] shadow-2xl shadow-black/5 dark:shadow-black/30 rounded-2xl p-1.5 gap-0.5 select-none z-30 transition-all">
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

      {/* Apple Emoji Picker Popover */}
      {isEmojiPickerOpen && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setIsEmojiPickerOpen(false)}
          />
          <div className="absolute left-16 top-6 z-50">
            <EmojiPickerPopover
              isOpen={isEmojiPickerOpen}
              onClose={() => setIsEmojiPickerOpen(false)}
              onSelectEmoji={(emoji) => {
                onAddNode('note', { color: 'yellow', title: '', content: emoji, width: 140 })
                setIsEmojiPickerOpen(false)
              }}
              title="Añadir Emoji al Tablero"
              align="left"
            />
          </div>
        </>
      )}
    </div>
  )
})
