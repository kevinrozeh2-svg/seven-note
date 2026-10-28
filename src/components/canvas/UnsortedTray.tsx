import React, { useState } from 'react'
import { X, Plus, ArrowLeft, Trash2, StickyNote, Link2, FileText, CheckCircle2 } from 'lucide-react'
import { toast } from 'sonner'

export interface UnsortedItem {
  id: string
  title: string
  type: 'note' | 'link' | 'file'
  content?: string
  date: string
}

interface UnsortedTrayProps {
  isOpen: boolean
  onClose: () => void
  onDropItemToCanvas: (item: UnsortedItem) => void
  count?: number
}

export const UnsortedTray: React.FC<UnsortedTrayProps> = ({
  isOpen,
  onClose,
  onDropItemToCanvas
}) => {
  const [items, setItems] = useState<UnsortedItem[]>([
    {
      id: 'unsorted-1',
      title: 'Idea de tipografía y logotipo',
      type: 'note',
      content: 'Probar fuentes serif combinadas con sans-serif geométricas.',
      date: 'Hoy, 14:20'
    },
    {
      id: 'unsorted-2',
      title: 'Referencias Bauhaus 1920',
      type: 'link',
      content: 'https://bauhaus-movement.com',
      date: 'Ayer'
    },
    {
      id: 'unsorted-3',
      title: 'Boceto_Storyboard_v2.pdf',
      type: 'file',
      content: '4.2 MB',
      date: '24 Oct'
    }
  ])

  const [newTitle, setNewTitle] = useState('')

  if (!isOpen) return null

  const handleQuickAdd = (e: React.FormEvent) => {
    e.preventDefault()
    if (!newTitle.trim()) return
    const newItem: UnsortedItem = {
      id: crypto.randomUUID(),
      title: newTitle.trim(),
      type: 'note',
      content: '',
      date: 'Ahora'
    }
    setItems([newItem, ...items])
    setNewTitle('')
    toast.success('Elemento añadido a Sin clasificar')
  }

  const handlePlaceOnCanvas = (item: UnsortedItem) => {
    onDropItemToCanvas(item)
    setItems(items.filter((i) => i.id !== item.id))
    toast.success(`"${item.title}" colocado en el tablero`)
  }

  const handleDeleteItem = (id: string) => {
    setItems(items.filter((i) => i.id !== id))
    toast.info('Elemento eliminado de la bandeja')
  }

  return (
    <div className="fixed top-12 right-0 bottom-0 w-80 bg-white dark:bg-[#1f1f1f] border-l border-neutral-200 dark:border-neutral-800 shadow-2xl z-40 flex flex-col animate-in slide-in-from-right duration-200">
      {/* Header */}
      <div className="p-3.5 border-b border-neutral-200 dark:border-neutral-800 flex items-center justify-between bg-neutral-50/50 dark:bg-neutral-900/30">
        <div className="flex items-center gap-2">
          <span className="font-serif font-bold text-sm text-neutral-900 dark:text-neutral-100">
            Sin clasificar
          </span>
          <span className="px-2 py-0.5 rounded-full bg-neutral-200 dark:bg-neutral-700 text-[11px] font-mono font-semibold text-neutral-700 dark:text-neutral-300">
            {items.length}
          </span>
        </div>
        <button
          onClick={onClose}
          className="p-1 rounded-lg text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 hover:bg-neutral-200/60 dark:hover:bg-neutral-800 transition"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Quick Add Form */}
      <form onSubmit={handleQuickAdd} className="p-3 border-b border-neutral-100 dark:border-neutral-800/80">
        <div className="flex items-center gap-1.5 bg-neutral-100 dark:bg-neutral-800/70 rounded-xl px-2.5 py-1.5 border border-neutral-200 dark:border-neutral-700">
          <Plus className="w-4 h-4 text-neutral-400" />
          <input
            type="text"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            placeholder="Capturar idea rápida..."
            className="flex-1 bg-transparent border-none outline-none text-xs text-neutral-800 dark:text-neutral-200 placeholder-neutral-400"
          />
        </div>
      </form>

      {/* Items List */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2.5">
        {items.length === 0 ? (
          <div className="text-center py-12 text-neutral-400">
            <CheckCircle2 className="w-8 h-8 mx-auto mb-2 opacity-40 text-emerald-500" />
            <p className="text-xs font-medium">Bandeja despejada</p>
            <p className="text-[11px] mt-1 text-neutral-500">
              Todos los elementos han sido clasificados en tableros.
            </p>
          </div>
        ) : (
          items.map((item) => (
            <div
              key={item.id}
              className="group p-3 rounded-xl bg-neutral-50 dark:bg-neutral-800/50 border border-neutral-200/80 dark:border-neutral-700/70 hover:border-blue-400/80 transition-all shadow-xs"
            >
              <div className="flex items-start justify-between gap-2 mb-1.5">
                <div className="flex items-center gap-1.5">
                  {item.type === 'note' && <StickyNote className="w-3.5 h-3.5 text-amber-500" />}
                  {item.type === 'link' && <Link2 className="w-3.5 h-3.5 text-blue-500" />}
                  {item.type === 'file' && <FileText className="w-3.5 h-3.5 text-indigo-500" />}
                  <span className="font-semibold text-xs text-neutral-900 dark:text-neutral-100 line-clamp-1">
                    {item.title}
                  </span>
                </div>
                <button
                  onClick={() => handleDeleteItem(item.id)}
                  className="opacity-0 group-hover:opacity-100 text-neutral-400 hover:text-rose-500 transition"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>

              {item.content && (
                <p className="text-[11px] text-neutral-500 dark:text-neutral-400 line-clamp-2 leading-relaxed mb-2">
                  {item.content}
                </p>
              )}

              <div className="flex items-center justify-between pt-1 border-t border-neutral-200/50 dark:border-neutral-700/50 text-[10px] text-neutral-400">
                <span>{item.date}</span>
                <button
                  onClick={() => handlePlaceOnCanvas(item)}
                  className="text-blue-500 hover:text-blue-600 dark:text-blue-400 font-semibold inline-flex items-center gap-1 hover:underline"
                >
                  <ArrowLeft className="w-3 h-3" />
                  <span>Al tablero</span>
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      <div className="p-3 border-t border-neutral-200 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-900/30 text-center">
        <p className="text-[10px] text-neutral-400 leading-tight">
          Arrastra o envía elementos sueltos a tus tableros cuando estés listo para organizarlos.
        </p>
      </div>
    </div>
  )
}
