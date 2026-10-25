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
  Bold,
  Italic,
  Underline as UnderlineIcon,
  Strikethrough,
  Code,
  Heading1,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  CheckSquare,
  Quote,
  Minus,
  Download,
  Copy,
  Check,
  CheckCircle2
} from 'lucide-react'
import { db } from '../../db'
import { syncEngine } from '../../lib/syncEngine'

interface DocEditorProps {
  workspaceId: string
  initialContent: string
  title: string
  onTitleChange?: (newTitle: string) => void
}

export function DocEditor({ workspaceId, initialContent, title, onTitleChange }: DocEditorProps) {
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving'>('saved')
  const [copied, setCopied] = useState(false)
  const isFirstRender = useRef(true)

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
        placeholder: 'Escribe tus ideas, notas o presiona los botones de bloque arriba...'
      })
    ],
    content: initialContent || '<p></p>',
    editorProps: {
      attributes: {
        class: 'prose dark:prose-invert max-w-none focus:outline-none min-h-[450px] text-slate-800 dark:text-slate-100 font-sans leading-relaxed'
      }
    },
    onUpdate: ({ editor }) => {
      setSaveStatus('saving')
      const html = editor.getHTML()

      // Check if all task items are completed to trigger confetti
      const taskInputs = editor.view.dom.querySelectorAll('ul[data-type="taskList"] input[type="checkbox"]')
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

      // Debounced save to IndexedDB
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current)
      saveTimeoutRef.current = setTimeout(async () => {
        try {
          await db.workspaces.update(workspaceId, {
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

  const saveTimeoutRef = useRef<any>(null)

  // Update editor content when switching workspaces
  useEffect(() => {
    if (editor && !isFirstRender.current) {
      if (editor.getHTML() !== initialContent) {
        editor.commands.setContent(initialContent || '<p></p>', { emitUpdate: false })
      }
    }
    isFirstRender.current = false
  }, [workspaceId, initialContent, editor])

  const exportMarkdown = () => {
    if (!editor) return
    const text = editor.getText()
    const blob = new Blob([`# ${title}\n\n${text}`], { type: 'text/markdown;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${title.replace(/\s+/g, '-').toLowerCase() || 'nota'}.md`
    a.click()
    URL.revokeObjectURL(url)
  }

  const copyContent = async () => {
    if (!editor) return
    await navigator.clipboard.writeText(editor.getText())
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  if (!editor) return null

  return (
    <div className="flex flex-col h-full bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800">
      {/* Top Editor Toolbar */}
      <div className="flex items-center justify-between px-6 py-2.5 border-b border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-900/80 backdrop-blur sticky top-0 z-10 flex-wrap gap-2">
        <div className="flex items-center gap-1 flex-wrap">
          <button
            onClick={() => editor.chain().focus().toggleBold().run()}
            className={`p-1.5 rounded hover:bg-slate-200 dark:hover:bg-slate-800 transition ${
              editor.isActive('bold') ? 'bg-indigo-100 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 font-bold' : 'text-slate-600 dark:text-slate-300'
            }`}
            title="Negrita (Ctrl+B)"
          >
            <Bold size={16} />
          </button>
          <button
            onClick={() => editor.chain().focus().toggleItalic().run()}
            className={`p-1.5 rounded hover:bg-slate-200 dark:hover:bg-slate-800 transition ${
              editor.isActive('italic') ? 'bg-indigo-100 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 font-bold' : 'text-slate-600 dark:text-slate-300'
            }`}
            title="Cursiva (Ctrl+I)"
          >
            <Italic size={16} />
          </button>
          <button
            onClick={() => editor.chain().focus().toggleUnderline().run()}
            className={`p-1.5 rounded hover:bg-slate-200 dark:hover:bg-slate-800 transition ${
              editor.isActive('underline') ? 'bg-indigo-100 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 font-bold' : 'text-slate-600 dark:text-slate-300'
            }`}
            title="Subrayado (Ctrl+U)"
          >
            <UnderlineIcon size={16} />
          </button>
          <button
            onClick={() => editor.chain().focus().toggleStrike().run()}
            className={`p-1.5 rounded hover:bg-slate-200 dark:hover:bg-slate-800 transition ${
              editor.isActive('strike') ? 'bg-indigo-100 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 font-bold' : 'text-slate-600 dark:text-slate-300'
            }`}
            title="Tachado"
          >
            <Strikethrough size={16} />
          </button>
          <button
            onClick={() => editor.chain().focus().toggleCode().run()}
            className={`p-1.5 rounded hover:bg-slate-200 dark:hover:bg-slate-800 transition ${
              editor.isActive('code') ? 'bg-indigo-100 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 font-bold' : 'text-slate-600 dark:text-slate-300'
            }`}
            title="Código en línea"
          >
            <Code size={16} />
          </button>

          <div className="w-[1px] h-5 bg-slate-300 dark:bg-slate-700 mx-1" />

          {/* Headings */}
          <button
            onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
            className={`p-1.5 rounded hover:bg-slate-200 dark:hover:bg-slate-800 transition text-xs font-semibold ${
              editor.isActive('heading', { level: 1 }) ? 'bg-indigo-100 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400' : 'text-slate-600 dark:text-slate-300'
            }`}
            title="Encabezado 1"
          >
            <Heading1 size={16} />
          </button>
          <button
            onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
            className={`p-1.5 rounded hover:bg-slate-200 dark:hover:bg-slate-800 transition text-xs font-semibold ${
              editor.isActive('heading', { level: 2 }) ? 'bg-indigo-100 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400' : 'text-slate-600 dark:text-slate-300'
            }`}
            title="Encabezado 2"
          >
            <Heading2 size={16} />
          </button>
          <button
            onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
            className={`p-1.5 rounded hover:bg-slate-200 dark:hover:bg-slate-800 transition text-xs font-semibold ${
              editor.isActive('heading', { level: 3 }) ? 'bg-indigo-100 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400' : 'text-slate-600 dark:text-slate-300'
            }`}
            title="Encabezado 3"
          >
            <Heading3 size={16} />
          </button>

          <div className="w-[1px] h-5 bg-slate-300 dark:bg-slate-700 mx-1" />

          {/* Lists & Blocks */}
          <button
            onClick={() => editor.chain().focus().toggleBulletList().run()}
            className={`p-1.5 rounded hover:bg-slate-200 dark:hover:bg-slate-800 transition ${
              editor.isActive('bulletList') ? 'bg-indigo-100 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400' : 'text-slate-600 dark:text-slate-300'
            }`}
            title="Lista con viñetas"
          >
            <List size={16} />
          </button>
          <button
            onClick={() => editor.chain().focus().toggleOrderedList().run()}
            className={`p-1.5 rounded hover:bg-slate-200 dark:hover:bg-slate-800 transition ${
              editor.isActive('orderedList') ? 'bg-indigo-100 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400' : 'text-slate-600 dark:text-slate-300'
            }`}
            title="Lista numerada"
          >
            <ListOrdered size={16} />
          </button>
          <button
            onClick={() => editor.chain().focus().toggleTaskList().run()}
            className={`p-1.5 rounded hover:bg-slate-200 dark:hover:bg-slate-800 transition ${
              editor.isActive('taskList') ? 'bg-indigo-100 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400' : 'text-slate-600 dark:text-slate-300'
            }`}
            title="Lista de tareas (Checklist)"
          >
            <CheckSquare size={16} />
          </button>
          <button
            onClick={() => editor.chain().focus().toggleBlockquote().run()}
            className={`p-1.5 rounded hover:bg-slate-200 dark:hover:bg-slate-800 transition ${
              editor.isActive('blockquote') ? 'bg-indigo-100 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400' : 'text-slate-600 dark:text-slate-300'
            }`}
            title="Cita"
          >
            <Quote size={16} />
          </button>
          <button
            onClick={() => editor.chain().focus().setHorizontalRule().run()}
            className="p-1.5 rounded hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 transition"
            title="Separador horizontal"
          >
            <Minus size={16} />
          </button>
        </div>

        {/* Right Action Tools */}
        <div className="flex items-center gap-2 text-xs">
          <div className="flex items-center gap-1.5 px-2 py-1 rounded bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400">
            {saveStatus === 'saving' ? (
              <>
                <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                <span>Guardando...</span>
              </>
            ) : (
              <>
                <CheckCircle2 size={13} className="text-emerald-500" />
                <span>Guardado local</span>
              </>
            )}
          </div>

          <button
            onClick={copyContent}
            className="p-1.5 rounded hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 transition flex items-center gap-1"
            title="Copiar texto"
          >
            {copied ? <Check size={14} className="text-emerald-500" /> : <Copy size={14} />}
          </button>

          <button
            onClick={exportMarkdown}
            className="p-1.5 rounded hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 transition flex items-center gap-1"
            title="Descargar Markdown"
          >
            <Download size={14} />
          </button>
        </div>
      </div>

      {/* Editor Body Area */}
      <div className="flex-1 overflow-y-auto px-8 sm:px-14 py-8">
        <div className="max-w-3xl mx-auto">
          {/* Editable Document Title */}
          <input
            type="text"
            value={title}
            onChange={(e) => onTitleChange && onTitleChange(e.target.value)}
            placeholder="Título del documento..."
            className="w-full text-3xl sm:text-4xl font-extrabold text-slate-900 dark:text-white bg-transparent border-none outline-none mb-6 placeholder-slate-300 dark:placeholder-slate-700 font-sans tracking-tight"
          />

          <EditorContent editor={editor} />
        </div>
      </div>
    </div>
  )
}
