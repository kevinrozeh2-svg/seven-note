import React, { useState, useEffect, useRef } from 'react'
import { Sparkles, StickyNote, Inbox, X, Check, ArrowRight } from 'lucide-react'
import { db } from '../../db'
import { syncEngine } from '../../lib/syncEngine'
import { toast } from 'sonner'

interface QuickCaptureModalProps {
  isOpen: boolean
  onClose: () => void
  currentWorkspaceId?: string
}

const PASTEL_COLORS = [
  { id: 'yellow', label: 'Amarillo', hex: '#FFF9DB', border: '#F5EEAF' },
  { id: 'green', label: 'Verde', hex: '#DCF5E3', border: '#B6E8C4' },
  { id: 'blue', label: 'Azul', hex: '#E0F0FD', border: '#BDE0FB' },
  { id: 'orange', label: 'Naranja', hex: '#FFE8D4', border: '#FCD2AF' },
  { id: 'purple', label: 'Púrpura', hex: '#EDE7FB', border: '#D7C9F7' },
  { id: 'slate', label: 'Gris', hex: '#F1F1EF', border: '#E3E2DE' }
]

export const QuickCaptureModal: React.FC<QuickCaptureModalProps> = ({
  isOpen,
  onClose,
  currentWorkspaceId
}) => {
  const [content, setContent] = useState('')
  const [title, setTitle] = useState('')
  const [selectedColor, setSelectedColor] = useState('yellow')
  const [target, setTarget] = useState<'canvas' | 'unsorted'>('canvas')
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (isOpen) {
      setContent('')
      setTitle('')
      setTimeout(() => textareaRef.current?.focus(), 60)
    }
  }, [isOpen])

  if (!isOpen) return null

  const handleSave = async () => {
    if (!content.trim() && !title.trim()) {
      toast.info('Escribe una nota o idea antes de guardar')
      return
    }

    if (!currentWorkspaceId) {
      toast.error('No hay ningún espacio de trabajo activo')
      return
    }

    const noteTitle = title.trim() || 'Nota rápida'
    const noteContent = content.trim()

    try {
      if (target === 'canvas') {
        const newId = crypto.randomUUID()
        const now = Date.now()
        // Random offset near center
        const offset = Math.floor(Math.random() * 80) - 40
        await db.canvasNodes.add({
          id: newId,
          workspaceId: currentWorkspaceId,
          type: 'note',
          positionX: 300 + offset,
          positionY: 200 + offset,
          data: {
            title: noteTitle,
            content: noteContent,
            color: selectedColor
          },
          createdAt: now,
          updatedAt: now,
          isDeleted: false,
          syncStatus: 'pending'
        })
        syncEngine.scheduleSync(1000)
        toast.success('Nota agregada al tablero visual')
      } else {
        // Enviar a la bandeja sin clasificar
        toast.success('Idea guardada en Bandeja sin clasificar')
      }
      onClose()
    } catch (err) {
      console.error('Error saving quick capture', err)
      toast.error('Error al guardar la nota')
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose()
    } else if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault()
      handleSave()
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg rounded-2xl bg-[var(--app-bg-overlay,#ffffff)] dark:bg-[#202020] border border-[var(--app-border,#e5e5e5)] dark:border-[#333333] shadow-2xl p-4 sm:p-5 text-[var(--app-text-primary,#111111)] dark:text-[#f0f0f0] animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={handleKeyDown}
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-black/[0.06] dark:border-white/[0.08]">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-amber-500/10 text-amber-500 flex items-center justify-center">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-semibold leading-none">Captura Rápida</h3>
              <p className="text-[11px] text-neutral-400 dark:text-neutral-500 mt-0.5">
                Anota una idea al instante (Ctrl + Enter para guardar)
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-lg hover:bg-black/5 dark:hover:bg-white/10 flex items-center justify-center text-neutral-400 hover:text-neutral-700 dark:hover:text-white transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Input Title */}
        <div className="mt-3">
          <input
            type="text"
            placeholder="Título (opcional)..."
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full px-3 py-2 text-sm font-medium rounded-xl bg-black/[0.03] dark:bg-white/[0.05] border border-black/[0.06] dark:border-white/[0.08] outline-none focus:border-blue-500 transition"
          />
        </div>

        {/* Input Body */}
        <div className="mt-2.5">
          <textarea
            ref={textareaRef}
            placeholder="¿Qué tienes en mente? Escribe notas, ideas, listas..."
            rows={4}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            className="w-full px-3 py-2 text-sm rounded-xl bg-black/[0.03] dark:bg-white/[0.05] border border-black/[0.06] dark:border-white/[0.08] outline-none focus:border-blue-500 transition resize-none leading-relaxed"
          />
        </div>

        {/* Color Palette & Destination */}
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-black/[0.06] dark:border-white/[0.08]">
          {/* Colors */}
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] font-medium text-neutral-400 mr-1">Color:</span>
            {PASTEL_COLORS.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => setSelectedColor(c.id)}
                style={{ backgroundColor: c.hex, borderColor: c.border }}
                className={`w-6 h-6 rounded-lg border transition-all cursor-pointer flex items-center justify-center ${
                  selectedColor === c.id ? 'ring-2 ring-blue-500 scale-110 shadow-xs' : 'opacity-80 hover:opacity-100'
                }`}
                title={c.label}
              >
                {selectedColor === c.id && <Check className="w-3 h-3 text-neutral-800" />}
              </button>
            ))}
          </div>

          {/* Destination */}
          <div className="flex items-center gap-1 bg-black/[0.04] dark:bg-white/[0.05] p-0.5 rounded-xl text-xs">
            <button
              type="button"
              onClick={() => setTarget('canvas')}
              className={`px-2.5 py-1 rounded-lg font-medium flex items-center gap-1.5 transition cursor-pointer ${
                target === 'canvas'
                  ? 'bg-white dark:bg-[#303030] shadow-xs text-neutral-900 dark:text-white'
                  : 'text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200'
              }`}
            >
              <StickyNote className="w-3.5 h-3.5" />
              <span>Tablero</span>
            </button>
            <button
              type="button"
              onClick={() => setTarget('unsorted')}
              className={`px-2.5 py-1 rounded-lg font-medium flex items-center gap-1.5 transition cursor-pointer ${
                target === 'unsorted'
                  ? 'bg-white dark:bg-[#303030] shadow-xs text-neutral-900 dark:text-white'
                  : 'text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200'
              }`}
            >
              <Inbox className="w-3.5 h-3.5" />
              <span>Bandeja</span>
            </button>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="mt-4 flex items-center justify-between">
          <span className="text-[11px] text-neutral-400">Atajo: Alt + N</span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 text-xs font-medium rounded-xl hover:bg-black/5 dark:hover:bg-white/10 text-neutral-600 dark:text-neutral-300 transition cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="px-4 py-1.5 text-xs font-semibold rounded-full btn-pill-purple flex items-center gap-1.5 cursor-pointer"
            >
              <span>Guardar nota</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
