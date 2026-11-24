import React, { useState, useEffect } from 'react'
import { X, FloppyDisk, FileText, FlowArrow } from '@phosphor-icons/react'
import {
  TEMPLATE_CATEGORIES,
  type AppTemplate,
  type TemplateCategory
} from '../../lib/templates'
import {
  saveCustomTemplate,
  createCustomTemplateFromWorkspace
} from '../../lib/customTemplates'
import { type WorkspaceItem } from '../../db'
import { toast } from '../../lib/toast'

interface CreateTemplateModalProps {
  isOpen: boolean
  mode: 'blank' | 'from-current'
  currentWorkspace?: WorkspaceItem
  onClose: () => void
  onCreated: (template: AppTemplate) => void
}

export const CreateTemplateModal: React.FC<CreateTemplateModalProps> = (props) => {
  if (!props.isOpen) return null
  const formKey = `${props.mode}-${props.currentWorkspace?.id || 'blank'}`
  return <CreateTemplateModalInner key={formKey} {...props} />
}

const CreateTemplateModalInner: React.FC<CreateTemplateModalProps> = ({
  mode,
  currentWorkspace,
  onClose,
  onCreated
}) => {
  const isFromCurrent = mode === 'from-current' && Boolean(currentWorkspace)
  const initialIsCanvas = isFromCurrent && currentWorkspace?.viewMode === 'canvas'

  const [title, setTitle] = useState(() =>
    isFromCurrent && currentWorkspace
      ? currentWorkspace.title && currentWorkspace.title !== 'Untitled'
        ? currentWorkspace.title
        : 'Mi plantilla'
      : ''
  )
  const [description, setDescription] = useState('')
  const [category, setCategory] = useState<TemplateCategory>(() =>
    initialIsCanvas ? 'Tableros Edgeless' : 'Proyectos'
  )
  const [type, setType] = useState<'doc' | 'canvas'>(() => (initialIsCanvas ? 'canvas' : 'doc'))
  const [tagsInput, setTagsInput] = useState(() => (isFromCurrent ? 'personalizada' : ''))
  const [starterBody, setStarterBody] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const cleanTitle = title.trim()
    if (!cleanTitle) {
      toast.error('Escribe un nombre para la plantilla.')
      return
    }

    const tags = tagsInput
      .split(',')
      .map((t) => t.trim().replace(/^#/, ''))
      .filter(Boolean)

    setSaving(true)
    try {
      let created: AppTemplate
      if (mode === 'from-current' && currentWorkspace) {
        created = await createCustomTemplateFromWorkspace(currentWorkspace, {
          title: cleanTitle,
          description: description.trim(),
          category,
          tags
        })
      } else {
        const lines = starterBody
          .split('\n')
          .map((l) => l.trim())
          .filter(Boolean)
        const docHtml =
          type === 'doc'
            ? `<h1>${cleanTitle}</h1>${
                lines.length > 0
                  ? lines.map((l) => `<p>${l}</p>`).join('')
                  : '<h3>Objetivos</h3><ul data-type="taskList"><li data-checked="false"><label><input type="checkbox"><span></span></label><div>Primera tarea</div></li></ul><h3>Notas</h3><p></p>'
              }`
            : undefined

        created = {
          id: `custom-${crypto.randomUUID()}`,
          title: cleanTitle,
          description:
            description.trim() ||
            (type === 'canvas'
              ? 'Tablero personalizado listo para reutilizar.'
              : 'Estructura de documento personalizada.'),
          icon: type === 'canvas' ? '🗂️' : '📄',
          category,
          type,
          tags: tags.length > 0 ? tags : ['personalizada'],
          docContent: docHtml,
          nodes:
            type === 'canvas'
              ? [
                  {
                    type: 'frame',
                    positionX: 80,
                    positionY: 80,
                    data: { title: cleanTitle, frameIndex: 1, color: 'indigo', width: 420, height: 300 }
                  },
                  {
                    type: 'note',
                    positionX: 115,
                    positionY: 140,
                    data: {
                      title: 'Nota inicial',
                      content: starterBody.trim() || 'Escribe aquí tus ideas clave.',
                      color: 'yellow'
                    }
                  }
                ]
              : undefined,
          edges: type === 'canvas' ? [] : undefined,
          isCustom: true,
          createdAt: Date.now()
        }
        saveCustomTemplate(created)
      }

      toast.success(`Plantilla "${created.title}" guardada en Mis plantillas.`)
      onCreated(created)
      onClose()
    } catch (err) {
      console.error('Error creating template', err)
      toast.error('No se pudo guardar la plantilla.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 bg-black/50 backdrop-blur-[2px] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="create-template-title"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg rounded-xl bg-[var(--app-bg-overlay)] border border-[var(--app-border-strong)] shadow-[var(--app-shadow-popover)] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 py-3.5 border-b border-[var(--app-border)] flex items-center justify-between bg-[var(--app-bg-secondary)]">
          <h3 id="create-template-title" className="text-sm font-semibold text-[var(--app-text-primary)]">
            {mode === 'from-current'
              ? 'Guardar nota actual como plantilla'
              : 'Crear nueva plantilla'}
          </h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            className="p-1 rounded-md text-[var(--app-text-secondary)] hover:text-[var(--app-text-primary)] hover:bg-[var(--app-hover)] transition cursor-pointer"
          >
            <X size={16} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {mode === 'blank' && (
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-[var(--app-text-secondary)]">
                Tipo de plantilla
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setType('doc')}
                  className={`h-9 px-3 rounded-md border text-xs font-medium flex items-center justify-center gap-2 transition cursor-pointer ${
                    type === 'doc'
                      ? 'bg-[var(--app-accent-soft)] border-[var(--app-accent)] text-[var(--app-text-primary)]'
                      : 'bg-[var(--app-bg-secondary)] border-[var(--app-border)] text-[var(--app-text-secondary)] hover:text-[var(--app-text-primary)]'
                  }`}
                >
                  <FileText size={15} />
                  <span>Documento</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setType('canvas')
                    setCategory('Tableros Edgeless')
                  }}
                  className={`h-9 px-3 rounded-md border text-xs font-medium flex items-center justify-center gap-2 transition cursor-pointer ${
                    type === 'canvas'
                      ? 'bg-[var(--app-accent-soft)] border-[var(--app-accent)] text-[var(--app-text-primary)]'
                      : 'bg-[var(--app-bg-secondary)] border-[var(--app-border)] text-[var(--app-text-secondary)] hover:text-[var(--app-text-primary)]'
                  }`}
                >
                  <FlowArrow size={15} />
                  <span>Lienzo</span>
                </button>
              </div>
            </div>
          )}

          <div className="space-y-1.5">
            <label htmlFor="tpl-title" className="text-xs font-medium text-[var(--app-text-secondary)]">
              Nombre
            </label>
            <input
              id="tpl-title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ej. Checklist de Lanzamiento"
              autoFocus
              className="w-full h-9 px-3 rounded-md bg-[var(--app-bg-secondary)] border border-[var(--app-border-strong)] text-xs text-[var(--app-text-primary)] placeholder:text-[var(--app-text-muted)] focus:outline-none focus:border-[var(--app-accent)] transition"
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="tpl-desc" className="text-xs font-medium text-[var(--app-text-secondary)]">
              Descripción breve
            </label>
            <input
              id="tpl-desc"
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="¿Para qué sirve esta plantilla?"
              className="w-full h-9 px-3 rounded-md bg-[var(--app-bg-secondary)] border border-[var(--app-border-strong)] text-xs text-[var(--app-text-primary)] placeholder:text-[var(--app-text-muted)] focus:outline-none focus:border-[var(--app-accent)] transition"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label htmlFor="tpl-cat" className="text-xs font-medium text-[var(--app-text-secondary)]">
                Categoría
              </label>
              <select
                id="tpl-cat"
                value={category}
                onChange={(e) => setCategory(e.target.value as TemplateCategory)}
                className="w-full h-9 px-2.5 rounded-md bg-[var(--app-bg-secondary)] border border-[var(--app-border-strong)] text-xs text-[var(--app-text-primary)] focus:outline-none focus:border-[var(--app-accent)] transition"
              >
                {TEMPLATE_CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <label htmlFor="tpl-tags" className="text-xs font-medium text-[var(--app-text-secondary)]">
                Etiquetas (separadas por coma)
              </label>
              <input
                id="tpl-tags"
                type="text"
                value={tagsInput}
                onChange={(e) => setTagsInput(e.target.value)}
                placeholder="sprint, equipo, diseño"
                className="w-full h-9 px-3 rounded-md bg-[var(--app-bg-secondary)] border border-[var(--app-border-strong)] text-xs text-[var(--app-text-primary)] placeholder:text-[var(--app-text-muted)] focus:outline-none focus:border-[var(--app-accent)] transition"
              />
            </div>
          </div>

          {mode === 'blank' && (
            <div className="space-y-1.5">
              <label htmlFor="tpl-body" className="text-xs font-medium text-[var(--app-text-secondary)]">
                Contenido inicial (opcional)
              </label>
              <textarea
                id="tpl-body"
                rows={4}
                value={starterBody}
                onChange={(e) => setStarterBody(e.target.value)}
                placeholder="Escribe párrafos iniciales o déjalo vacío para generar una estructura base..."
                className="w-full p-3 rounded-md bg-[var(--app-bg-secondary)] border border-[var(--app-border-strong)] text-xs text-[var(--app-text-primary)] placeholder:text-[var(--app-text-muted)] focus:outline-none focus:border-[var(--app-accent)] transition resize-none"
              />
            </div>
          )}

          {mode === 'from-current' && currentWorkspace && (
            <div className="p-3 rounded-md bg-[var(--app-bg-secondary)] border border-[var(--app-border)] text-[11px] text-[var(--app-text-secondary)]">
              Se capturará automáticamente{' '}
              {currentWorkspace.viewMode === 'canvas'
                ? 'todos los nodos y conexiones del lienzo actual.'
                : 'el contenido completo y portada del documento actual.'}
            </div>
          )}

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-[var(--app-border)]">
            <button
              type="button"
              onClick={onClose}
              className="h-8 px-3 rounded-md text-xs font-medium text-[var(--app-text-secondary)] hover:text-[var(--app-text-primary)] hover:bg-[var(--app-hover)] transition cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving}
              className="h-8 px-3.5 rounded-md bg-[var(--app-accent)] hover:bg-[var(--app-accent-hover)] disabled:opacity-50 text-white text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer"
            >
              <FloppyDisk size={14} />
              <span>{saving ? 'Guardando...' : 'Guardar plantilla'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
