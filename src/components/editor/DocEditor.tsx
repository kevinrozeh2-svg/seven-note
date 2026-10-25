import { useEffect, useRef, useState } from 'react'
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
  List,
  CheckSquare
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
  const [showToolbar, setShowToolbar] = useState(false)
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
        placeholder: 'Escribe algo o pulsa "/" para insertar bloques...'
      })
    ],
    content: workspace.docContent || '<p></p>',
    editorProps: {
      attributes: {
        class:
          'prose prose-invert max-w-none focus:outline-none min-h-[350px] text-zinc-200 font-sans leading-relaxed text-sm selection:bg-blue-600/30'
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

  // Find incoming backlinks (pages that reference current note ID or title)
  const backlinks = allWorkspaces.filter(
    (w) =>
      w.id !== workspace.id &&
      !w.isDeleted &&
      (w.docContent.includes(workspace.id) ||
        (workspace.title && workspace.title !== 'Untitled' && w.docContent.includes(workspace.title)))
  )

  // Append a bi-directional link into the current editor
  const handleInsertLinkToNote = (targetNote: WorkspaceItem) => {
    if (!editor) return
    const linkHtml = `<p>🔗 <a href="#note=${targetNote.id}" class="text-blue-400 underline font-medium">${targetNote.icon || '📄'} ${targetNote.title || 'Untitled'}</a></p>`
    editor.commands.insertContent(linkHtml)
    setShowLinkSelector(false)
  }

  const pageWidthClass =
    workspace.pageWidth === 'full'
      ? 'max-w-full px-8'
      : workspace.pageWidth === 'wide'
      ? 'max-w-5xl px-8'
      : 'max-w-3xl px-6'

  if (!editor) return null

  return (
    <div className="flex flex-col h-full bg-[#161618] overflow-y-auto text-zinc-200 select-text relative">
      {/* Optional Formatting Toolbar Toggle */}
      <div className="sticky top-0 z-10 flex justify-end px-6 py-1 bg-[#161618]/90 backdrop-blur-xs">
        <button
          onClick={() => setShowToolbar(!showToolbar)}
          className="text-[11px] text-zinc-500 hover:text-zinc-300 py-0.5 px-2 rounded hover:bg-[#202024] transition"
        >
          {showToolbar ? 'Ocultar barra de formato' : 'Formato de texto'}
        </button>
      </div>

      {showToolbar && (
        <div className="sticky top-7 z-10 flex items-center justify-between px-6 py-1.5 border-b border-[#26262a] bg-[#1a1a1e] backdrop-blur text-xs flex-wrap gap-1">
          <div className="flex items-center gap-1">
            <button
              onClick={() => editor.chain().focus().toggleBold().run()}
              className={`p-1 rounded ${editor.isActive('bold') ? 'bg-blue-600 text-white' : 'text-zinc-400 hover:text-zinc-200'}`}
              title="Negrita"
            >
              <Bold size={14} />
            </button>
            <button
              onClick={() => editor.chain().focus().toggleItalic().run()}
              className={`p-1 rounded ${editor.isActive('italic') ? 'bg-blue-600 text-white' : 'text-zinc-400 hover:text-zinc-200'}`}
              title="Cursiva"
            >
              <Italic size={14} />
            </button>
            <button
              onClick={() => editor.chain().focus().toggleUnderline().run()}
              className={`p-1 rounded ${editor.isActive('underline') ? 'bg-blue-600 text-white' : 'text-zinc-400 hover:text-zinc-200'}`}
              title="Subrayado"
            >
              <UnderlineIcon size={14} />
            </button>
            <button
              onClick={() => editor.chain().focus().toggleCode().run()}
              className={`p-1 rounded ${editor.isActive('code') ? 'bg-blue-600 text-white' : 'text-zinc-400 hover:text-zinc-200'}`}
              title="Código"
            >
              <Code size={14} />
            </button>
            <div className="w-[1px] h-4 bg-[#2f2f35] mx-1" />
            <button
              onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
              className={`p-1 rounded ${editor.isActive('heading', { level: 1 }) ? 'bg-blue-600 text-white' : 'text-zinc-400 hover:text-zinc-200'}`}
            >
              <Heading1 size={14} />
            </button>
            <button
              onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
              className={`p-1 rounded ${editor.isActive('heading', { level: 2 }) ? 'bg-blue-600 text-white' : 'text-zinc-400 hover:text-zinc-200'}`}
            >
              <Heading2 size={14} />
            </button>
            <button
              onClick={() => editor.chain().focus().toggleBulletList().run()}
              className={`p-1 rounded ${editor.isActive('bulletList') ? 'bg-blue-600 text-white' : 'text-zinc-400 hover:text-zinc-200'}`}
            >
              <List size={14} />
            </button>
            <button
              onClick={() => editor.chain().focus().toggleTaskList().run()}
              className={`p-1 rounded ${editor.isActive('taskList') ? 'bg-blue-600 text-white' : 'text-zinc-400 hover:text-zinc-200'}`}
            >
              <CheckSquare size={14} />
            </button>
          </div>
          <div className="text-[11px] text-zinc-500">
            {saveStatus === 'saving' ? 'Guardando...' : 'Guardado'}
          </div>
        </div>
      )}

      {/* Main Document Body Container */}
      <div className={`mx-auto w-full pt-8 pb-24 ${pageWidthClass}`}>
        {/* Top: Add icon Button (Matches Screenshot) */}
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

        {/* Big Title (Matches Screenshot: placeholder "Title") */}
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

        {/* Collapsible: "Información" (Matches Screenshot) */}
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
            {/* Fine divider line */}
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

        {/* Action Pills Row (Matches Screenshot: "Iniciar", "Con IA ✨", "Plantilla 🗂️", "Sin bordes 🔗") */}
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

        {/* Section: Bi-Directional Links (Matches Screenshot) */}
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
              {/* "Mostrar" / "Ocultar" button from screenshot */}
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
              {/* Link selector popover */}
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
