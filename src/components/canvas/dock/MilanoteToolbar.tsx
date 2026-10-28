import React, { memo, useMemo } from 'react'
import {
  StickyNote,
  Link2,
  Image as ImageIcon,
  FileText,
  Music,
  FolderPlus,
  Table2,
  CheckSquare,
  Palette,
  MessageSquare,
  Spline,
  LayoutTemplate,
  PenTool
} from 'lucide-react'

interface MilanoteToolbarProps {
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
  const tools = useMemo(() => [
    {
      id: 'note',
      label: 'Nota',
      icon: <StickyNote className="w-5 h-5 text-amber-500" />,
      onClick: () => onAddNode('note', { color: 'yellow', title: 'Nota rápida' })
    },
    {
      id: 'link',
      label: 'Enlace',
      icon: <Link2 className="w-5 h-5 text-blue-500" />,
      onClick: () => onAddNode('link', { title: 'Nuevo enlace', url: 'https://' })
    },
    {
      id: 'image',
      label: 'Imagen',
      icon: <ImageIcon className="w-5 h-5 text-purple-500" />,
      onClick: () => onUploadImage ? onUploadImage() : onAddNode('image', { caption: 'Foto' })
    },
    {
      id: 'file',
      label: 'Archivo',
      icon: <FileText className="w-5 h-5 text-indigo-500" />,
      onClick: () => onAddNode('file', { fileName: 'Documento.doc', fileSize: '12 KB', fileType: 'doc' })
    },
    {
      id: 'audio',
      label: 'Audio',
      icon: <Music className="w-5 h-5 text-rose-500" />,
      onClick: () => onAddNode('audio', { title: 'Pista de Audio', subtitle: '1 archivo de audio' })
    },
    {
      id: 'subboard',
      label: 'Tablero',
      icon: <FolderPlus className="w-5 h-5 text-sky-500" />,
      onClick: () => onAddNode('subboard', { title: 'Nuevo Tablero', subtitle: '0 tarjetas' })
    },
    {
      id: 'table',
      label: 'Tabla',
      icon: <Table2 className="w-5 h-5 text-emerald-500" />,
      onClick: () => onAddNode('table', { title: 'Tabla de datos', headerColor: 'yellow' })
    },
    {
      id: 'todo',
      label: 'Tareas',
      icon: <CheckSquare className="w-5 h-5 text-teal-500" />,
      onClick: () => onAddNode('todo', { color: 'blue', title: 'Lista de tareas' })
    },
    {
      id: 'colorPalette',
      label: 'Color',
      icon: <Palette className="w-5 h-5 text-amber-600" />,
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
      icon: <MessageSquare className="w-5 h-5 text-pink-500" />,
      onClick: () => onAddNode('comment', { commentAuthor: 'Usuario', commentDate: 'Hoy' })
    },
    {
      id: 'connector',
      label: 'Línea',
      icon: <Spline className="w-5 h-5 text-neutral-600 dark:text-neutral-300" />,
      onClick: () => onToggleTool && onToggleTool('connector'),
      isActive: activeTool === 'connector'
    },
    {
      id: 'pencil',
      label: 'Dibujo',
      icon: <PenTool className="w-5 h-5 text-indigo-400" />,
      onClick: () => onToggleTool && onToggleTool('pencil'),
      isActive: activeTool === 'pencil'
    },
    {
      id: 'template',
      label: 'Plantillas',
      icon: <LayoutTemplate className="w-5 h-5 text-neutral-500 dark:text-neutral-400" />,
      onClick: () => onOpenTemplates && onOpenTemplates()
    }
  ], [onAddNode, onToggleTool, activeTool, onOpenTemplates, onUploadImage])

  return (
    <div className="flex flex-col items-center bg-white/95 dark:bg-[#202020]/95 backdrop-blur-md border border-neutral-200/80 dark:border-neutral-700/80 shadow-[0_4px_20px_rgba(0,0,0,0.08)] dark:shadow-[0_8px_30px_rgba(0,0,0,0.45)] rounded-2xl p-1.5 gap-1 select-none z-30">
      <div className="px-1 py-0.5 text-[9px] font-bold uppercase tracking-wider text-neutral-400 dark:text-neutral-500 select-none">
        Milanote
      </div>

      <div className="w-full h-[1px] bg-neutral-200/70 dark:bg-neutral-800 my-0.5" />

      {tools.map((t) => (
        <button
          key={t.id}
          onClick={t.onClick}
          className={`group relative flex flex-col items-center justify-center w-12 h-12 rounded-xl transition-colors ${
            t.isActive
              ? 'bg-blue-500/15 text-blue-600 dark:text-blue-400 border border-blue-500/30'
              : 'hover:bg-neutral-100 dark:hover:bg-neutral-800/80 active:scale-95'
          }`}
          title={t.label}
        >
          <div className="group-hover:scale-110 transition-transform">
            {t.icon}
          </div>
          <span className="text-[9px] font-medium text-neutral-500 dark:text-neutral-400 group-hover:text-neutral-800 dark:group-hover:text-neutral-200 leading-none mt-1">
            {t.label}
          </span>

          {/* Floating Tooltip to the right */}
          <div className="absolute left-14 top-1/2 -translate-y-1/2 px-2.5 py-1 rounded-md bg-neutral-900 text-white text-[11px] font-medium whitespace-nowrap opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity shadow-lg z-50">
            Añadir {t.label}
          </div>
        </button>
      ))}
    </div>
  )
})
