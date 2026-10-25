import { useEffect, useRef, useState, useCallback } from 'react'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import TaskList from '@tiptap/extension-task-list'
import TaskItem from '@tiptap/extension-task-item'
import Placeholder from '@tiptap/extension-placeholder'
import Underline from '@tiptap/extension-underline'
import Link from '@tiptap/extension-link'
import Image from '@tiptap/extension-image'
import confetti from 'canvas-confetti'
import {
  Smile,
  Sparkles,
  Network,
  ChevronLeft,
  ChevronDown,
  Plus,
  ExternalLink,
  Bold,
  Italic,
  Underline as UnderlineIcon,
  Code,
  Heading1,
  Heading2,
  Heading3,
  List,
  CheckSquare,
  Quote,
  Table as TableIcon,
  AlertTriangle,
  Lightbulb,
  Info as InfoIcon,
  Minus,
  Binary,
  X
} from 'lucide-react'
import { db, type WorkspaceItem } from '../../db'
import { syncEngine } from '../../lib/syncEngine'
import { EmojiPickerPopover } from '../modals/EmojiPickerPopover'

interface DocEditorProps {
  workspace: WorkspaceItem
  allWorkspaces?: WorkspaceItem[]
  onSelectWorkspace?: (id: string) => void
  onTitleChange?: (newTitle: string) => void
  onToggleViewMode?: () => void
  onOpenAIModal?: () => void
  onOpenTemplatesModal?: () => void
}

export function DocEditor({
  workspace,
  allWorkspaces = [],
  onSelectWorkspace,
  onTitleChange,
  onToggleViewMode,
  onOpenAIModal,
  onOpenTemplatesModal
}: DocEditorProps) {
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving'>('saved')
  const [isEmojiPickerOpen, setIsEmojiPickerOpen] = useState(false)
  const [isInfoExpanded, setIsInfoExpanded] = useState(workspace.isInformationOpen ?? false)
  const [infoText, setInfoText] = useState(workspace.informationContent || '')
  const [showBiDirectional, setShowBiDirectional] = useState(workspace.biDirectionalLinksVisible ?? false)
  const [showLinkSelector, setShowLinkSelector] = useState(false)

  // Slash Menu state
  const [slashMenuOpen, setSlashMenuOpen] = useState(false)
  const [slashFilter, setSlashFilter] = useState('')

  // Floating text selection menu state
  const [floatingMenuPos, setFloatingMenuPos] = useState<{ x: number; y: number } | null>(null)

  const isFirstRender = useRef(true)
  const saveTimeoutRef = useRef<any>(null)

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        bulletList: { keepMarks: true, keepAttributes: false },
        orderedList: { keepMarks: true, keepAttributes: false }
      }),
      Underline,
      TaskList,
      TaskItem.configure({
        nested: true,
        onReadOnlyChecked: () => true
      }),
      Link.configure({
        openOnClick: false,
        autolink: true
      }),
      Image.configure({
        inline: true,
        allowBase64: true
      }),
      Placeholder.configure({
        placeholder: 'Escribe algo o pulsa "/" para insertar bloques de AFFiNE...'
      })
    ],
    content: workspace.docContent || '<p></p>',
    editorProps: {
      attributes: {
        class:
          'prose prose-invert max-w-none focus:outline-none min-h-[350px] text-zinc-200 font-sans leading-relaxed text-sm selection:bg-blue-600/30'
      },
      handleKeyDown: (_, event) => {
        if (event.key === '/') {
          // Open slash menu
          setSlashMenuOpen(true)
          setSlashFilter('')
        } else if (event.key === 'Escape') {
          setSlashMenuOpen(false)
        }
        return false
      }
    },
    onSelectionUpdate: ({ editor }) => {
      const { from, to } = editor.state.selection
      if (from !== to) {
        // Text is selected, position floating toolbar
        const domSelection = window.getSelection()
        if (domSelection && domSelection.rangeCount > 0) {
          const range = domSelection.getRangeAt(0)
          const rect = range.getBoundingClientRect()
          setFloatingMenuPos({
            x: rect.left + rect.width / 2,
            y: rect.top - 45
          })
        }
      } else {
        setFloatingMenuPos(null)
      }
    },
    onUpdate: ({ editor }) => {
      setSaveStatus('saving')
      const html = editor.getHTML()

      // Confetti on all tasks completed
      const taskInputs = editor.view.dom.querySelectorAll(
        'ul[data-type="taskList"] input[type="checkbox"]'
      )
      if (taskInputs.length > 0) {
        const allChecked = Array.from(taskInputs).every((input: any) => input.checked)
        if (allChecked) {
          confetti({
            particleCount: 50,
            spread: 60,
            origin: { y: 0.8 }
          })
        }
      }

      // Debounced save
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current)
      saveTimeoutRef.current = setTimeout(async () => {
        try {
          await db.workspaces.update(workspace.id, {
            docContent: html,
            updatedAt: Date.now(),
            syncStatus: 'pending'
          })
          syncEngine.scheduleSync(2000)
          setSaveStatus('saved')
        } catch (err) {
          console.error('Error saving doc content', err)
          setSaveStatus('saved')
        }
      }, 400)
    }
  })

  // Synchronize editor content when workspace changes
  useEffect(() => {
    if (editor && !isFirstRender.current) {
      if (editor.getHTML() !== workspace.docContent) {
        editor.commands.setContent(workspace.docContent || '<p></p>', { emitUpdate: false })
      }
      setInfoText(workspace.informationContent || '')
      setIsInfoExpanded(workspace.isInformationOpen ?? false)
      setShowBiDirectional(workspace.biDirectionalLinksVisible ?? false)
    }
    isFirstRender.current = false
  }, [workspace.id, workspace.docContent, editor])

  // Icon handler
  const handleSelectIcon = async (emoji: string) => {
    await db.workspaces.update(workspace.id, {
      icon: emoji,
      updatedAt: Date.now(),
      syncStatus: 'pending'
    })
    syncEngine.scheduleSync(1000)
  }

  const handleRemoveIcon = async () => {
    await db.workspaces.update(workspace.id, {
      icon: '',
      updatedAt: Date.now(),
      syncStatus: 'pending'
    })
    syncEngine.scheduleSync(1000)
  }

  // Toggle "Información" section
  const handleToggleInfo = async () => {
    const nextState = !isInfoExpanded
    setIsInfoExpanded(nextState)
    await db.workspaces.update(workspace.id, {
      isInformationOpen: nextState,
      updatedAt: Date.now(),
      syncStatus: 'pending'
    })
  }

  // Update info content
  const handleInfoContentChange = async (newText: string) => {
    setInfoText(newText)
    await db.workspaces.update(workspace.id, {
      informationContent: newText,
      updatedAt: Date.now(),
      syncStatus: 'pending'
    })
  }

  // Toggle Bi-Directional links visibility
  const handleToggleBiDirectional = async () => {
    const nextVal = !showBiDirectional
    setShowBiDirectional(nextVal)
    await db.workspaces.update(workspace.id, {
      biDirectionalLinksVisible: nextVal,
      updatedAt: Date.now(),
      syncStatus: 'pending'
    })
  }

  // Find incoming backlinks
  const backlinks = allWorkspaces.filter(
    (w) =>
      w.id !== workspace.id &&
      !w.isDeleted &&
      (w.docContent.includes(workspace.id) ||
        (workspace.title && workspace.title !== 'Untitled' && w.docContent.includes(workspace.title)))
  )

  const handleInsertLinkToNote = (targetNote: WorkspaceItem) => {
    if (!editor) return
    const linkHtml = `<p>🔗 <a href="#note=${targetNote.id}" class="text-blue-400 underline font-medium">${targetNote.icon || '📄'} ${targetNote.title || 'Untitled'}</a></p>`
    editor.commands.insertContent(linkHtml)
    setShowLinkSelector(false)
  }

  // Insert custom block into editor
  const insertBlock = useCallback(
    (type: string) => {
      if (!editor) return

      // If user typed "/" right before, remove it
      const { from } = editor.state.selection
      const textBefore = editor.state.doc.textBetween(Math.max(0, from - 1), from)
      if (textBefore === '/') {
        editor.commands.deleteRange({ from: from - 1, to: from })
      }

      switch (type) {
        case 'h1':
          editor.chain().focus().toggleHeading({ level: 1 }).run()
          break
        case 'h2':
          editor.chain().focus().toggleHeading({ level: 2 }).run()
          break
        case 'h3':
          editor.chain().focus().toggleHeading({ level: 3 }).run()
          break
        case 'taskList':
          editor.chain().focus().toggleTaskList().run()
          break
        case 'bulletList':
          editor.chain().focus().toggleBulletList().run()
          break
        case 'orderedList':
          editor.chain().focus().toggleOrderedList().run()
          break
        case 'blockquote':
          editor.chain().focus().toggleBlockquote().run()
          break
        case 'codeBlock':
          editor.chain().focus().toggleCodeBlock().run()
          break
        case 'divider':
          editor.chain().focus().setHorizontalRule().run()
          break
        case 'callout-idea':
          editor.commands.insertContent(
            `<div class="callout my-4 p-3.5 rounded-xl bg-amber-500/10 border-l-4 border-amber-500 text-amber-200 text-xs flex items-start gap-2.5">
              <span class="text-base select-none">💡</span>
              <div><strong>Idea Clave:</strong> Describe aquí una propuesta o reflexión importante.</div>
            </div><p></p>`
          )
          break
        case 'callout-info':
          editor.commands.insertContent(
            `<div class="callout my-4 p-3.5 rounded-xl bg-sky-500/10 border-l-4 border-sky-500 text-sky-200 text-xs flex items-start gap-2.5">
              <span class="text-base select-none">ℹ️</span>
              <div><strong>Nota Informativa:</strong> Datos de contexto o instrucciones para el lector.</div>
            </div><p></p>`
          )
          break
        case 'callout-warning':
          editor.commands.insertContent(
            `<div class="callout my-4 p-3.5 rounded-xl bg-rose-500/10 border-l-4 border-rose-500 text-rose-200 text-xs flex items-start gap-2.5">
              <span class="text-base select-none">⚠️</span>
              <div><strong>Advertencia:</strong> Punto crítico a tener en cuenta antes de continuar.</div>
            </div><p></p>`
          )
          break
        case 'table':
          editor.commands.insertContent(
            `<table class="w-full border-collapse border border-zinc-700 my-4 text-xs">
              <thead>
                <tr class="bg-zinc-800/80">
                  <th class="border border-zinc-700 p-2 text-left font-semibold text-zinc-200">Elemento</th>
                  <th class="border border-zinc-700 p-2 text-left font-semibold text-zinc-200">Responsable</th>
                  <th class="border border-zinc-700 p-2 text-left font-semibold text-zinc-200">Estado</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td class="border border-zinc-700 p-2 text-zinc-300">Requerimiento 1</td>
                  <td class="border border-zinc-700 p-2 text-zinc-400">Equipo</td>
                  <td class="border border-zinc-700 p-2 text-emerald-400 font-medium">Completado</td>
                </tr>
                <tr>
                  <td class="border border-zinc-700 p-2 text-zinc-300">Requerimiento 2</td>
                  <td class="border border-zinc-700 p-2 text-zinc-400">Dev</td>
                  <td class="border border-zinc-700 p-2 text-amber-400 font-medium">En Progreso</td>
                </tr>
              </tbody>
            </table><p></p>`
          )
          break
        case 'math':
          editor.commands.insertContent(
            `<div class="my-4 p-3 rounded-xl bg-zinc-900 border border-zinc-800 font-mono text-xs text-indigo-300 flex items-center justify-between">
              <span>$$ E = mc^2 \\quad \\vert \\quad f(x) = \\int_{-\\infty}^{\\infty} e^{-x^2} dx $$</span>
              <span class="text-[10px] text-zinc-500 uppercase">Fórmula LaTeX</span>
            </div><p></p>`
          )
          break
        case 'ai':
          onOpenAIModal && onOpenAIModal()
          break
      }
      setSlashMenuOpen(false)
    },
    [editor, onOpenAIModal]
  )

  const slashMenuItems = [
    { id: 'h1', title: 'Título 1', desc: 'Encabezado principal de sección', icon: <Heading1 size={15} className="text-sky-400" /> },
    { id: 'h2', title: 'Título 2', desc: 'Subtítulo mediano', icon: <Heading2 size={15} className="text-sky-400" /> },
    { id: 'h3', title: 'Título 3', desc: 'Subtítulo pequeño', icon: <Heading3 size={15} className="text-sky-400" /> },
    { id: 'taskList', title: 'Lista de Tareas', desc: 'Checklist interactivo con casillas', icon: <CheckSquare size={15} className="text-emerald-400" /> },
    { id: 'bulletList', title: 'Lista con Viñetas', desc: 'Lista desordenada estándar', icon: <List size={15} className="text-zinc-300" /> },
    { id: 'callout-idea', title: 'Destacado: Idea (💡)', desc: 'Bloque coloreado estilo AFFiNE', icon: <Lightbulb size={15} className="text-amber-400" /> },
    { id: 'callout-info', title: 'Destacado: Nota (ℹ️)', desc: 'Mensaje de contexto importante', icon: <InfoIcon size={15} className="text-sky-400" /> },
    { id: 'callout-warning', title: 'Destacado: Alerta (⚠️)', desc: 'Aviso crítico o advertencia', icon: <AlertTriangle size={15} className="text-rose-400" /> },
    { id: 'codeBlock', title: 'Bloque de Código', desc: 'Contenedor monoespaciado para código', icon: <Code size={15} className="text-purple-400" /> },
    { id: 'table', title: 'Tabla / Matriz', desc: 'Tabla interactiva de 3 columnas', icon: <TableIcon size={15} className="text-indigo-400" /> },
    { id: 'math', title: 'Fórmula Matemática', desc: 'Bloque de notación LaTeX', icon: <Binary size={15} className="text-pink-400" /> },
    { id: 'blockquote', title: 'Cita', desc: 'Párrafo en bloque destacado', icon: <Quote size={15} className="text-zinc-400" /> },
    { id: 'divider', title: 'Separador Horizontal', desc: 'Línea de división de contenido', icon: <Minus size={15} className="text-zinc-500" /> },
    { id: 'ai', title: 'Escribir con IA', desc: 'Generar o expandir con asistente', icon: <Sparkles size={15} className="text-cyan-400" /> }
  ].filter((item) => item.title.toLowerCase().includes(slashFilter.toLowerCase()) || item.desc.toLowerCase().includes(slashFilter.toLowerCase()))

  const pageWidthClass =
    workspace.pageWidth === 'full'
      ? 'max-w-full px-8'
      : workspace.pageWidth === 'wide'
      ? 'max-w-5xl px-8'
      : 'max-w-3xl px-6'

  if (!editor) return null

  return (
    <div className="flex flex-col h-full bg-[#161618] overflow-y-auto text-zinc-200 select-text relative">
      {/* Top Formatting Toolbar */}
      <div className="sticky top-0 z-20 flex items-center justify-between px-6 py-2 border-b border-[#242428] bg-[#161618]/95 backdrop-blur-md text-xs flex-wrap gap-1.5 shadow-xs">
          <div className="flex items-center gap-1">
            {/* Quick insert block button */}
            <button
              onClick={() => {
                setSlashMenuOpen(!slashMenuOpen)
                setSlashFilter('')
              }}
              className="flex items-center gap-1 px-2 py-1 rounded-md bg-[#222226] hover:bg-[#2b2b32] text-zinc-300 transition mr-1 font-medium"
              title="Insertar bloques de contenido (/)"
            >
              <Plus size={13} className="text-blue-400" />
              <span>Bloque</span>
            </button>

            <div className="w-[1px] h-4 bg-[#2b2b30] mx-0.5" />

            <button
              onClick={() => editor.chain().focus().toggleBold().run()}
              className={`p-1.5 rounded-md ${editor.isActive('bold') ? 'bg-blue-600 text-white' : 'text-zinc-400 hover:text-zinc-200 hover:bg-[#202024]'}`}
              title="Negrita"
            >
              <Bold size={14} />
            </button>
            <button
              onClick={() => editor.chain().focus().toggleItalic().run()}
              className={`p-1.5 rounded-md ${editor.isActive('italic') ? 'bg-blue-600 text-white' : 'text-zinc-400 hover:text-zinc-200 hover:bg-[#202024]'}`}
              title="Cursiva"
            >
              <Italic size={14} />
            </button>
            <button
              onClick={() => editor.chain().focus().toggleUnderline().run()}
              className={`p-1.5 rounded-md ${editor.isActive('underline') ? 'bg-blue-600 text-white' : 'text-zinc-400 hover:text-zinc-200 hover:bg-[#202024]'}`}
              title="Subrayado"
            >
              <UnderlineIcon size={14} />
            </button>
            <button
              onClick={() => editor.chain().focus().toggleCode().run()}
              className={`p-1.5 rounded-md ${editor.isActive('code') ? 'bg-blue-600 text-white' : 'text-zinc-400 hover:text-zinc-200 hover:bg-[#202024]'}`}
              title="Código en línea"
            >
              <Code size={14} />
            </button>

            <div className="w-[1px] h-4 bg-[#2b2b30] mx-0.5" />

            <button
              onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
              className={`p-1.5 rounded-md ${editor.isActive('heading', { level: 1 }) ? 'bg-blue-600 text-white' : 'text-zinc-400 hover:text-zinc-200 hover:bg-[#202024]'}`}
              title="Encabezado 1"
            >
              <Heading1 size={14} />
            </button>
            <button
              onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
              className={`p-1.5 rounded-md ${editor.isActive('heading', { level: 2 }) ? 'bg-blue-600 text-white' : 'text-zinc-400 hover:text-zinc-200 hover:bg-[#202024]'}`}
              title="Encabezado 2"
            >
              <Heading2 size={14} />
            </button>
            <button
              onClick={() => editor.chain().focus().toggleBulletList().run()}
              className={`p-1.5 rounded-md ${editor.isActive('bulletList') ? 'bg-blue-600 text-white' : 'text-zinc-400 hover:text-zinc-200 hover:bg-[#202024]'}`}
              title="Lista de viñetas"
            >
              <List size={14} />
            </button>
            <button
              onClick={() => editor.chain().focus().toggleTaskList().run()}
              className={`p-1.5 rounded-md ${editor.isActive('taskList') ? 'bg-blue-600 text-white' : 'text-zinc-400 hover:text-zinc-200 hover:bg-[#202024]'}`}
              title="Lista de tareas"
            >
              <CheckSquare size={14} />
            </button>
          </div>

          <div className="flex items-center gap-3 text-[11px] text-zinc-500">
            <span className="font-mono">
              {saveStatus === 'saving' ? 'Guardando...' : 'Guardado'}
            </span>
          </div>
        </div>
      )}

      {/* Floating Text Selection Bubble Toolbar */}
      {floatingMenuPos && (
        <div
          style={{
            position: 'fixed',
            left: `${floatingMenuPos.x}px`,
            top: `${floatingMenuPos.y}px`,
            transform: 'translateX(-50%)'
          }}
          className="z-50 flex items-center gap-1 p-1 rounded-xl bg-[#18181b]/95 border border-[#2e2e36] shadow-2xl backdrop-blur-md animate-in fade-in zoom-in-95 duration-100"
        >
          <button
            onClick={() => editor.chain().focus().toggleBold().run()}
            className={`p-1.5 rounded-md ${editor.isActive('bold') ? 'bg-blue-600 text-white' : 'text-zinc-300 hover:bg-zinc-800'}`}
          >
            <Bold size={13} />
          </button>
          <button
            onClick={() => editor.chain().focus().toggleItalic().run()}
            className={`p-1.5 rounded-md ${editor.isActive('italic') ? 'bg-blue-600 text-white' : 'text-zinc-300 hover:bg-zinc-800'}`}
          >
            <Italic size={13} />
          </button>
          <button
            onClick={() => editor.chain().focus().toggleUnderline().run()}
            className={`p-1.5 rounded-md ${editor.isActive('underline') ? 'bg-blue-600 text-white' : 'text-zinc-300 hover:bg-zinc-800'}`}
          >
            <UnderlineIcon size={13} />
          </button>
          <button
            onClick={() => editor.chain().focus().toggleCode().run()}
            className={`p-1.5 rounded-md ${editor.isActive('code') ? 'bg-blue-600 text-white' : 'text-zinc-300 hover:bg-zinc-800'}`}
          >
            <Code size={13} />
          </button>
        </div>
      )}

      {/* Slash Menu Popover Dialog */}
      {slashMenuOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-2xs flex items-center justify-center p-4">
          <div
            className="w-full max-w-md bg-[#18181c] border border-[#2d2d34] rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[70vh] animate-in fade-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Search filter input */}
            <div className="p-3 border-b border-[#26262a] flex items-center justify-between gap-2">
              <input
                autoFocus
                type="text"
                value={slashFilter}
                onChange={(e) => setSlashFilter(e.target.value)}
                placeholder="Filtrar bloques de AFFiNE..."
                className="w-full bg-transparent border-none outline-none text-xs text-zinc-100 placeholder:text-zinc-500 font-sans"
              />
              <button
                onClick={() => setSlashMenuOpen(false)}
                className="p-1 rounded text-zinc-400 hover:text-white"
              >
                <X size={14} />
              </button>
            </div>

            {/* Blocks menu list */}
            <div className="overflow-y-auto p-2 space-y-1">
              {slashMenuItems.length === 0 ? (
                <div className="py-6 text-center text-xs text-zinc-500">
                  No se encontraron bloques para "{slashFilter}"
                </div>
              ) : (
                slashMenuItems.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => insertBlock(item.id)}
                    className="w-full text-left p-2.5 rounded-xl hover:bg-[#222228] transition flex items-center gap-3 group text-xs"
                  >
                    <div className="p-2 rounded-lg bg-[#222228] group-hover:bg-[#2b2b34] shrink-0 transition">
                      {item.icon}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="font-semibold text-zinc-200 group-hover:text-blue-400 transition">
                        {item.title}
                      </div>
                      <div className="text-[11px] text-zinc-500 truncate">{item.desc}</div>
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Main Document Body Container */}
      <div className={`mx-auto w-full pt-8 pb-24 ${pageWidthClass}`}>
        {/* Top: Add icon Button */}
        <div className="mb-4 relative">
          {workspace.icon ? (
            <div className="flex items-center gap-2 group">
              <span
                onClick={() => setIsEmojiPickerOpen(true)}
                className="text-4xl cursor-pointer hover:scale-105 transition"
                title="Cambiar icono"
              >
                {workspace.icon}
              </span>
              <button
                onClick={() => setIsEmojiPickerOpen(true)}
                className="opacity-0 group-hover:opacity-100 text-[11px] text-zinc-500 hover:text-zinc-300 transition"
              >
                Cambiar icono
              </button>
            </div>
          ) : (
            <button
              onClick={() => setIsEmojiPickerOpen(true)}
              className="flex items-center gap-1.5 text-xs text-zinc-400 hover:text-zinc-200 py-1 px-2 rounded-md hover:bg-[#202024] transition font-normal"
            >
              <Smile size={14} className="text-zinc-400" />
              <span>Add icon</span>
            </button>
          )}

          {/* Emoji Picker Popover */}
          <EmojiPickerPopover
            currentIcon={workspace.icon}
            isOpen={isEmojiPickerOpen}
            onClose={() => setIsEmojiPickerOpen(false)}
            onSelectEmoji={handleSelectIcon}
            onRemoveEmoji={handleRemoveIcon}
          />
        </div>

        {/* Big Title */}
        <div className="mb-6">
          <input
            type="text"
            value={workspace.title === 'Untitled' ? '' : workspace.title}
            onChange={(e) => {
              const val = e.target.value
              onTitleChange && onTitleChange(val || 'Untitled')
            }}
            placeholder="Title"
            className="w-full text-4xl font-bold tracking-tight text-zinc-100 placeholder:text-zinc-600 bg-transparent border-none outline-none focus:outline-none"
          />
        </div>

        {/* Collapsible: "Información" */}
        <div className="mb-8">
          <div
            onClick={handleToggleInfo}
            className="flex items-center gap-3 cursor-pointer group select-none"
          >
            <div className="flex items-center gap-1.5 text-zinc-400 group-hover:text-zinc-200 transition">
              <span className="text-xs font-medium">Información</span>
              <span className="text-zinc-500 group-hover:text-zinc-300">
                {isInfoExpanded ? (
                  <ChevronDown size={14} />
                ) : (
                  <ChevronLeft size={14} className="rotate-180" />
                )}
              </span>
            </div>
            <div className="flex-1 h-[1px] bg-[#26262a]" />
          </div>

          {/* Collapsible Content */}
          {isInfoExpanded && (
            <div className="mt-3 p-3 rounded-lg bg-[#141416] border border-[#242428] text-xs text-zinc-300 animate-in fade-in duration-100">
              <textarea
                value={infoText}
                onChange={(e) => handleInfoContentChange(e.target.value)}
                placeholder="Añade notas breves, contexto o resumen sobre este documento..."
                rows={3}
                className="w-full bg-transparent border-none outline-none text-zinc-200 placeholder:text-zinc-600 resize-none font-sans leading-relaxed"
              />
              <div className="flex items-center justify-between pt-2 border-t border-[#202024] text-[10px] text-zinc-500">
                <span>Metadatos y resumen editable</span>
                <span>Guardado automático</span>
              </div>
            </div>
          )}
        </div>

        {/* Action Pills Row ("Iniciar", "Con IA ✨", "Plantilla 🗂️", "Sin bordes 🔗") */}
        <div className="flex items-center gap-2 mb-8 flex-wrap select-none text-xs">
          <span className="text-zinc-400 font-medium mr-1">Iniciar</span>

          {/* Pill 1: Con IA */}
          <button
            onClick={onOpenAIModal}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#1f1f23] hover:bg-[#28282e] border border-[#2d2d34] text-zinc-200 transition shadow-xs group"
          >
            <span>Con IA</span>
            <Sparkles size={13} className="text-cyan-400 group-hover:rotate-12 transition-transform" />
          </button>

          {/* Pill 2: Plantilla */}
          <button
            onClick={onOpenTemplatesModal}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#1f1f23] hover:bg-[#28282e] border border-[#2d2d34] text-zinc-200 transition shadow-xs"
          >
            <span>Plantilla</span>
            <span className="text-xs">🗂️</span>
          </button>

          {/* Pill 3: Sin bordes (Canvas / Edgeless mode) */}
          <button
            onClick={onToggleViewMode}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#1f1f23] hover:bg-[#28282e] border border-[#2d2d34] text-zinc-200 transition shadow-xs group"
            title="Alternar entre modo Página y Modo Sin bordes (Lienzo infinito)"
          >
            <span>Sin bordes</span>
            <Network size={13} className="text-indigo-400 group-hover:scale-110 transition-transform" />
          </button>
        </div>

        {/* TipTap WYSIWYG Document Editor */}
        <div className="min-h-[280px]">
          <EditorContent editor={editor} />
        </div>

        {/* Section: Bi-Directional Links */}
        <div className="mt-14 pt-6 border-t border-[#26262a]">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-zinc-200">
                Bi-Directional Links
              </span>
              {backlinks.length > 0 && (
                <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-blue-950/60 border border-blue-800 text-blue-300">
                  {backlinks.length}
                </span>
              )}
            </div>

            <div className="flex items-center gap-2">
              {showBiDirectional && (
                <button
                  onClick={() => setShowLinkSelector(!showLinkSelector)}
                  className="px-2.5 py-1 rounded-md bg-[#1f1f23] hover:bg-[#28282e] text-zinc-300 text-xs flex items-center gap-1 transition"
                >
                  <Plus size={12} />
                  <span>Vincular nota</span>
                </button>
              )}
              <button
                onClick={handleToggleBiDirectional}
                className="px-3 py-1 rounded-md bg-[#222226] hover:bg-[#2a2a30] text-zinc-300 text-xs font-medium transition"
              >
                {showBiDirectional ? 'Ocultar' : 'Mostrar'}
              </button>
            </div>
          </div>

          {/* Bi-Directional Links expanded body */}
          {showBiDirectional && (
            <div className="space-y-3 animate-in fade-in duration-100">
              {showLinkSelector && (
                <div className="p-3 bg-[#141416] border border-[#2a2a30] rounded-xl text-xs space-y-2">
                  <span className="text-zinc-400 font-medium block">
                    Selecciona una página para vincularla a este documento:
                  </span>
                  <div className="max-h-40 overflow-y-auto space-y-1">
                    {allWorkspaces
                      .filter((w) => w.id !== workspace.id && !w.isDeleted)
                      .map((ws) => (
                        <div
                          key={ws.id}
                          onClick={() => handleInsertLinkToNote(ws)}
                          className="flex items-center justify-between p-1.5 rounded hover:bg-[#222228] cursor-pointer text-zinc-300"
                        >
                          <div className="flex items-center gap-2">
                            <span>{ws.icon || '📄'}</span>
                            <span className="truncate">{ws.title || 'Untitled'}</span>
                          </div>
                          <span className="text-[10px] text-blue-400">Insertar enlace</span>
                        </div>
                      ))}
                  </div>
                </div>
              )}

              {backlinks.length === 0 ? (
                <div className="p-4 rounded-xl bg-[#141416] border border-[#222226] text-center text-xs text-zinc-500">
                  No hay otras notas vinculadas a esta página todavía.
                  <br />
                  Usa el botón "Vincular nota" para interconectar tus ideas.
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {backlinks.map((linkWs) => (
                    <div
                      key={linkWs.id}
                      onClick={() => onSelectWorkspace && onSelectWorkspace(linkWs.id)}
                      className="p-3 rounded-xl bg-[#141416] border border-[#242428] hover:border-blue-500/50 hover:bg-[#1a1a1e] cursor-pointer transition flex items-center justify-between group"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span className="text-lg">{linkWs.icon || '📄'}</span>
                        <div className="min-w-0">
                          <p className="font-medium text-zinc-200 group-hover:text-blue-400 truncate text-xs">
                            {linkWs.title || 'Untitled'}
                          </p>
                          <p className="text-[10px] text-zinc-500">Nota vinculada</p>
                        </div>
                      </div>
                      <ExternalLink size={13} className="text-zinc-500 group-hover:text-blue-400 shrink-0" />
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
