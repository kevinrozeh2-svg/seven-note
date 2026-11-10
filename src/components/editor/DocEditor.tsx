import { useEffect, useRef, useState, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { useEditor, EditorContent } from '@tiptap/react'
import { Mark, mergeAttributes } from '@tiptap/core'
import StarterKit from '@tiptap/starter-kit'
import TaskList from '@tiptap/extension-task-list'
import TaskItem from '@tiptap/extension-task-item'
import Placeholder from '@tiptap/extension-placeholder'
import Underline from '@tiptap/extension-underline'
import Link from '@tiptap/extension-link'
import Image from '@tiptap/extension-image'
import TextAlign from '@tiptap/extension-text-align'
import { processAndUploadImage } from '../../lib/imageOptimizer'
import { cleanPastedHtml } from '../../lib/pasteUtils'
import { Table } from '@tiptap/extension-table'
import { TableRow } from '@tiptap/extension-table-row'
import { TableHeader } from '@tiptap/extension-table-header'
import { TableCell } from '@tiptap/extension-table-cell'
import { CodeBlockLowlight } from '@tiptap/extension-code-block-lowlight'
import { common, createLowlight } from 'lowlight'
import { toast } from 'sonner'
import confetti from 'canvas-confetti'
import { Lock, Unlock, Globe, ChevronDown, Maximize2, Minimize2, AlignLeft, AlignCenter, AlignRight, AlignJustify } from 'lucide-react'
import {
  SmileIcon,
  EdgelessIcon,
  ToggleDownIcon,
  ToggleRightIcon,
  PlusIcon,
  OpenInNewIcon,
  BoldIcon,
  ItalicIcon,
  UnderLineIcon,
  CodeIcon,
  Heading1Icon,
  Heading2Icon,
  Heading3Icon,
  BulletedListIcon,
  CheckBoxCheckSolidIcon,
  QuoteIcon,
  TableIcon,
  InformationIcon,
  DividerIcon,
  CloseIcon,
  TemplateIcon,
  ImageIcon,
  LinkIcon,
  PageIcon,
  CopyIcon
} from '@blocksuite/icons/rc'
import { db, type WorkspaceItem, type NotionDatabaseData, type NotionDatabaseViewType } from '../../db'
import { syncEngine } from '../../lib/syncEngine'
import { EmojiPickerPopover } from '../modals/EmojiPickerPopover'
import { AppleEmoji, renderWithAppleEmoji } from '../ui/AppleEmoji'
import { NotionDatabaseView, getDefaultDatabaseData } from './NotionDatabaseView'
import { NotionViewsDropdown, NOTION_TOOLS } from './NotionViewsDropdown'
import {
  NotionTableIcon,
  NotionBoardIcon,
  NotionListIcon,
  NotionTimelineIcon,
  NotionCalendarIcon,
  NotionGalleryIcon
} from './NotionIcons'

const lowlight = createLowlight(common)

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

function sanitizeUrl(url: string): string {
  const trimmed = url.trim()
  if (/^(https?:|\/|#)/i.test(trimmed)) return trimmed
  return '#'
}

interface DocEditorProps {
  workspace: WorkspaceItem
  allWorkspaces?: WorkspaceItem[]
  onSelectWorkspace?: (id: string) => void
  onTitleChange?: (newTitle: string) => void
  onToggleViewMode?: () => void
  onOpenTemplatesModal?: () => void
  readOnly?: boolean
}

// Custom Marks to preserve styles (color, highlight, sub, sup, font styles) during paste & editing
const TextStyle = Mark.create({
  name: 'textStyle',
  addOptions() {
    return {
      HTMLAttributes: {}
    }
  },
  parseHTML() {
    return [
      {
        tag: 'span',
        getAttrs: (element) => {
          const el = element as HTMLElement
          return el.hasAttribute('style') ? {} : false
        }
      }
    ]
  },
  renderHTML({ HTMLAttributes }) {
    return ['span', mergeAttributes(this.options.HTMLAttributes, HTMLAttributes), 0]
  }
})

const ColorMark = Mark.create({
  name: 'color',
  addOptions() {
    return {
      HTMLAttributes: {}
    }
  },
  addAttributes() {
    return {
      color: {
        default: null,
        parseHTML: (element) => element.style.color || element.getAttribute('color') || null,
        renderHTML: (attributes) => {
          if (!attributes.color) return {}
          return {
            style: `color: ${attributes.color}`
          }
        }
      }
    }
  },
  parseHTML() {
    return [
      {
        tag: 'span[style*=color]',
        getAttrs: (element) => {
          const color = (element as HTMLElement).style.color
          return color ? { color } : false
        }
      },
      {
        tag: 'font[color]',
        getAttrs: (element) => {
          const color = (element as HTMLElement).getAttribute('color')
          return color ? { color } : false
        }
      }
    ]
  },
  renderHTML({ HTMLAttributes }) {
    return ['span', mergeAttributes(this.options.HTMLAttributes, HTMLAttributes), 0]
  }
})

const HighlightMark = Mark.create({
  name: 'highlight',
  addOptions() {
    return {
      HTMLAttributes: {}
    }
  },
  addAttributes() {
    return {
      color: {
        default: null,
        parseHTML: (element) => {
          const bg = element.style.backgroundColor || element.style.background
          return bg || null
        },
        renderHTML: (attributes) => {
          if (!attributes.color) return {}
          return {
            style: `background-color: ${attributes.color}`
          }
        }
      }
    }
  },
  parseHTML() {
    return [
      {
        tag: 'mark',
        getAttrs: (element) => {
          const bg = (element as HTMLElement).style.backgroundColor || (element as HTMLElement).style.background
          return { color: bg || null }
        }
      },
      {
        tag: 'span[style*=background]',
        getAttrs: (element) => {
          const bg = (element as HTMLElement).style.backgroundColor || (element as HTMLElement).style.background
          return bg ? { color: bg } : false
        }
      }
    ]
  },
  renderHTML({ HTMLAttributes }) {
    return ['mark', mergeAttributes(this.options.HTMLAttributes, HTMLAttributes), 0]
  }
})

const SubscriptMark = Mark.create({
  name: 'subscript',
  parseHTML() {
    return [{ tag: 'sub' }]
  },
  renderHTML({ HTMLAttributes }) {
    return ['sub', mergeAttributes(this.options.HTMLAttributes, HTMLAttributes), 0]
  }
})

const SuperscriptMark = Mark.create({
  name: 'superscript',
  parseHTML() {
    return [{ tag: 'sup' }]
  },
  renderHTML({ HTMLAttributes }) {
    return ['sup', mergeAttributes(this.options.HTMLAttributes, HTMLAttributes), 0]
  }
})

export function DocEditor({
  workspace,
  allWorkspaces = [],
  onSelectWorkspace,
  onTitleChange,
  onToggleViewMode,
  onOpenTemplatesModal,
  readOnly = false
}: DocEditorProps) {
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving'>('saved')
  const [isEmojiPickerOpen, setIsEmojiPickerOpen] = useState(false)
  const [isBodyEmojiPickerOpen, setIsBodyEmojiPickerOpen] = useState(false)
  const [isInfoExpanded, setIsInfoExpanded] = useState(workspace.isInformationOpen ?? false)
  const [infoText, setInfoText] = useState(workspace.informationContent || '')
  const [showBiDirectional, setShowBiDirectional] = useState(workspace.biDirectionalLinksVisible ?? false)
  const [showLinkSelector, setShowLinkSelector] = useState(false)

  // Slash Menu state
  const [slashMenuOpen, setSlashMenuOpen] = useState(false)
  const [slashFilter, setSlashFilter] = useState('')
  const [slashMenuPos, setSlashMenuPos] = useState<{ x: number; y: number } | null>(null)
  const [selectedSlashIdx, setSelectedSlashIdx] = useState(0)

  // Floating text selection menu state
  const [floatingMenuPos, setFloatingMenuPos] = useState<{ x: number; y: number } | null>(null)

  // Bookmark modal state
  const [isBookmarkModalOpen, setIsBookmarkModalOpen] = useState(false)
  const [bookmarkUrl, setBookmarkUrl] = useState('')
  const [bookmarkTitle, setBookmarkTitle] = useState('')
  const [bookmarkDesc, setBookmarkDesc] = useState('')

  // Embed doc modal state
  const [isEmbedDocModalOpen, setIsEmbedDocModalOpen] = useState(false)
  const [embedDocSearch, setEmbedDocSearch] = useState('')

  // Math / LaTeX modal state
  const [isMathModalOpen, setIsMathModalOpen] = useState(false)
  const [mathFormula, setMathFormula] = useState('E = mc^2')

  // Code block language state
  const [codeLanguage, setCodeLanguage] = useState('javascript')

  // Notion database state
  const [databaseData, setDatabaseData] = useState<NotionDatabaseData | null>(
    workspace.databaseData || null
  )
  const [isNotionMenuOpen, setIsNotionMenuOpen] = useState(false)
  const [isActionRowNotionMenuOpen, setIsActionRowNotionMenuOpen] = useState(false)

  const isFirstRender = useRef(true)
  const saveTimeoutRef = useRef<any>(null)
  const editorImageInputRef = useRef<HTMLInputElement>(null)
  const titleTextareaRef = useRef<HTMLTextAreaElement>(null)

  const adjustTitleHeight = useCallback(() => {
    const el = titleTextareaRef.current
    if (el) {
      el.style.height = 'auto'
      el.style.height = `${el.scrollHeight}px`
    }
  }, [])

  useEffect(() => {
    adjustTitleHeight()
  }, [workspace.title, adjustTitleHeight])

  useEffect(() => {
    const handleResize = () => adjustTitleHeight()
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [adjustTitleHeight])

  const handleEditorImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files || files.length === 0 || !editor) return

    const imageFiles = Array.from(files).filter((file) => file.type.startsWith('image/'))
    e.target.value = ''
    if (imageFiles.length === 0) return

    const toastId = toast.loading(`Optimizando ${imageFiles.length} foto(s)...`)
    try {
      for (const file of imageFiles) {
        const result = await processAndUploadImage(file)
        editor.chain().focus().setImage({ src: result.url, alt: file.name }).run()
      }
      toast.success('Fotos optimizadas en WebP e insertadas', { id: toastId })
    } catch (err: any) {
      toast.error('Error insertando fotos: ' + (err?.message || 'Error'), { id: toastId })
    }
  }

  const editor = useEditor({
    editable: !readOnly,
    extensions: [
      StarterKit.configure({
        bulletList: { keepMarks: true, keepAttributes: false },
        orderedList: { keepMarks: true, keepAttributes: false },
        codeBlock: false
      }),
      CodeBlockLowlight.configure({
        lowlight
      }),
      Table.configure({
        resizable: true
      }),
      TableRow,
      TableHeader,
      TableCell,
      Underline,
      TextStyle,
      ColorMark,
      HighlightMark,
      SubscriptMark,
      SuperscriptMark,
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
      TextAlign.configure({
        types: ['heading', 'paragraph', 'blockquote'],
        alignments: ['left', 'center', 'right', 'justify'],
        defaultAlignment: 'left'
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
      transformPastedHTML: (html) => {
        return cleanPastedHtml(html)
      },
      handlePaste: (view, event) => {
        // If the clipboard contains HTML or plain text, do NOT intercept as an image!
        // Allow ProseMirror to handle the rich formatted paste.
        const html = event.clipboardData?.getData('text/html')
        const text = event.clipboardData?.getData('text/plain')
        if ((html && html.trim()) || (text && text.trim())) {
          return false
        }

        const files = event.clipboardData?.files
        if (files && files.length > 0) {
          for (const file of Array.from(files)) {
            if (file.type.startsWith('image/')) {
              const toastId = toast.loading('Optimizando imagen pegada...')
              processAndUploadImage(file)
                .then((result) => {
                  const node = view.state.schema.nodes.image.create({ src: result.url, alt: file.name })
                  const tr = view.state.tr.replaceSelectionWith(node)
                  view.dispatch(tr)
                  toast.success('Imagen optimizada pegada en el documento', { id: toastId })
                })
                .catch((err: any) => {
                  toast.error('Error al procesar imagen: ' + (err?.message || 'Error'), { id: toastId })
                })
              return true
            }
          }
        }
        return false
      },
      handleDrop: (view, event) => {
        const files = event.dataTransfer?.files
        if (files && files.length > 0) {
          for (const file of files) {
            if (file.type.startsWith('image/')) {
              const coords = view.posAtCoords({ left: event.clientX, top: event.clientY })
              const pos = coords ? coords.pos : view.state.selection.from
              const toastId = toast.loading('Optimizando imagen soltada...')
              processAndUploadImage(file)
                .then((result) => {
                  const node = view.state.schema.nodes.image.create({ src: result.url, alt: file.name })
                  const tr = view.state.tr.insert(pos, node)
                  view.dispatch(tr)
                  toast.success('Imagen optimizada insertada', { id: toastId })
                })
                .catch((err: any) => {
                  toast.error('Error al procesar imagen: ' + (err?.message || 'Error'), { id: toastId })
                })
              return true
            }
          }
        }
        return false
      },
      handleKeyDown: (view, event) => {
        if (event.key === '/') {
          const { from } = view.state.selection
          const resolved = view.state.doc.resolve(from)
          const lineStart = resolved.start()
          const textBefore = view.state.doc.textBetween(lineStart, from)
          if (textBefore.trim() === '' || textBefore.endsWith(' ')) {
            const domSelection = window.getSelection()
            if (domSelection && domSelection.rangeCount > 0) {
              const rect = domSelection.getRangeAt(0).getBoundingClientRect()
              setSlashMenuPos({ x: rect.left, y: rect.bottom + 8 })
            } else {
              setSlashMenuPos(null)
            }
            setSlashMenuOpen(true)
            setSlashFilter('')
            setSelectedSlashIdx(0)
          }
        } else if (event.key === 'Escape') {
          setSlashMenuOpen(false)
        }
        return false
      },
      handleClick: (_view, _pos, event) => {
        const target = event.target as HTMLElement
        const noteCard = target.closest('[data-note-id]') as HTMLElement | null
        if (noteCard) {
          const noteId = noteCard.getAttribute('data-note-id')
          if (noteId && onSelectWorkspace) {
            onSelectWorkspace(noteId)
            return true
          }
        }
        const link = target.closest('a')
        if (link) {
          const href = link.getAttribute('href')
          if (href?.startsWith('#note=')) {
            const noteId = href.replace('#note=', '')
            if (noteId && onSelectWorkspace) {
              onSelectWorkspace(noteId)
              return true
            }
          }
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
      setDatabaseData(workspace.databaseData || null)
    }
    isFirstRender.current = false
  }, [
    workspace.id,
    workspace.docContent,
    workspace.informationContent,
    workspace.isInformationOpen,
    workspace.biDirectionalLinksVisible,
    workspace.databaseData,
    editor
  ])

  useEffect(() => {
    if (editor) {
      editor.setEditable(!readOnly)
    }
  }, [editor, readOnly])

  // Save Notion Database Data
  const handleSaveDatabaseData = async (newData: NotionDatabaseData) => {
    setDatabaseData(newData)
    try {
      await db.workspaces.update(workspace.id, {
        databaseData: newData,
        updatedAt: Date.now(),
        syncStatus: 'pending'
      })
      syncEngine.scheduleSync(1000)
    } catch (err) {
      console.error('Error saving databaseData', err)
    }
  }

  // Activate specific Notion View (Table, Board, List, Timeline, Calendar, Gallery)
  const handleActivateNotionView = (viewType: NotionDatabaseViewType) => {
    let nextData: NotionDatabaseData
    if (databaseData) {
      nextData = {
        ...databaseData,
        enabled: true,
        activeView: viewType
      }
    } else {
      nextData = getDefaultDatabaseData(viewType)
    }
    handleSaveDatabaseData(nextData)
    const viewOption = NOTION_TOOLS.find((t) => t.id === viewType)
    toast.success(`Vista ${viewOption?.label || viewType} de Notion activada`)
  }

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
    if (!editor || readOnly) return
    const safeTitle = escapeHtml(targetNote.title || 'Untitled')
    const safeIcon = escapeHtml(targetNote.icon || '📄')
    const safeId = encodeURIComponent(targetNote.id)
    const linkHtml = `<p>🔗 <a href="#note=${safeId}" class="text-blue-400 underline font-medium">${safeIcon} ${safeTitle}</a></p>`
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
            `<div class="callout callout-idea my-3 p-3.5 rounded-lg border flex items-start gap-3 text-sm">
              <span class="text-base select-none">💡</span>
              <div><strong>Idea Clave:</strong> Describe aquí una propuesta o reflexión importante.</div>
            </div><p></p>`
          )
          break
        case 'callout-info':
          editor.commands.insertContent(
            `<div class="callout callout-info my-3 p-3.5 rounded-lg border flex items-start gap-3 text-sm">
              <span class="text-base select-none">ℹ️</span>
              <div><strong>Nota Informativa:</strong> Datos de contexto o instrucciones para el lector.</div>
            </div><p></p>`
          )
          break
        case 'callout-warning':
          editor.commands.insertContent(
            `<div class="callout callout-warning my-3 p-3.5 rounded-lg border flex items-start gap-3 text-sm">
              <span class="text-base select-none">⚠️</span>
              <div><strong>Advertencia:</strong> Punto crítico a tener en cuenta antes de continuar.</div>
            </div><p></p>`
          )
          break
        case 'callout-success':
          editor.commands.insertContent(
            `<div class="callout callout-success my-3 p-3.5 rounded-lg border flex items-start gap-3 text-sm">
              <span class="text-base select-none">✅</span>
              <div><strong>Consejo / Éxito:</strong> Práctica recomendada o hito alcanzado.</div>
            </div><p></p>`
          )
          break
        case 'toggle':
          editor.commands.insertContent(
            `<details class="toggle-block my-2.5 p-2.5 bg-[var(--app-bg-secondary)] border border-[var(--app-border)] rounded-md cursor-pointer">
              <summary class="font-medium text-[var(--app-text-primary)] text-sm">Elemento desplegable</summary>
              <div class="mt-1.5 text-[var(--app-text-secondary)] pl-3 border-l border-[var(--app-border-strong)] text-sm">Contenido oculto por defecto...</div>
            </details><p></p>`
          )
          break
        case 'table':
          editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()
          toast.success('Tabla interactiva insertada')
          break
        case 'notion-table':
          handleActivateNotionView('table')
          break
        case 'notion-board':
          handleActivateNotionView('board')
          break
        case 'notion-list':
          handleActivateNotionView('list')
          break
        case 'notion-timeline':
          handleActivateNotionView('timeline')
          break
        case 'notion-calendar':
          handleActivateNotionView('calendar')
          break
        case 'notion-gallery':
          handleActivateNotionView('gallery')
          break
        case 'emoji':
          setIsBodyEmojiPickerOpen(true)
          break
        case 'bookmark':
          setIsBookmarkModalOpen(true)
          break
        case 'embed-doc':
          setIsEmbedDocModalOpen(true)
          break
        case 'math':
          setIsMathModalOpen(true)
          break
        case 'image':
          editorImageInputRef.current?.click()
          break
      }
      setSlashMenuOpen(false)
    },
    [editor]
  )

  const handleInsertBookmark = () => {
    if (!editor || !bookmarkUrl || readOnly) return
    let hostname = 'enlace-web.com'
    try {
      const parsed = new URL(bookmarkUrl.startsWith('http') ? bookmarkUrl : `https://${bookmarkUrl}`)
      hostname = parsed.hostname
    } catch {
      hostname = bookmarkUrl
    }
    const finalTitle = escapeHtml(bookmarkTitle.trim() || hostname)
    const finalDesc = escapeHtml(bookmarkDesc.trim() || `Enlace directo hacia ${hostname}`)
    const finalUrl = sanitizeUrl(bookmarkUrl.startsWith('http') ? bookmarkUrl : `https://${bookmarkUrl}`)
    const safeHost = escapeHtml(hostname)

    const html = `
      <div class="affine-bookmark-card my-3 p-3.5 rounded-2xl bg-zinc-900/80 border border-zinc-700/60 hover:border-[#1e96eb] transition group flex items-start gap-3.5 shadow-sm select-none" contenteditable="false">
        <div class="p-2.5 rounded-xl bg-blue-500/10 text-[#1e96eb] shrink-0 mt-0.5">🌐</div>
        <div class="min-w-0 flex-1">
          <a href="${finalUrl}" target="_blank" rel="noopener noreferrer" class="font-semibold text-zinc-100 group-hover:text-[#1e96eb] transition text-sm flex items-center gap-1.5 no-underline">
            <span>${finalTitle}</span>
            <span class="text-xs text-zinc-500">↗</span>
          </a>
          <p class="text-xs text-zinc-400 mt-1 line-clamp-2 leading-relaxed">${finalDesc}</p>
          <span class="inline-block mt-2 text-[10px] px-2 py-0.5 rounded-md bg-zinc-800 text-zinc-400 font-mono">${safeHost}</span>
        </div>
      </div><p></p>
    `
    editor.commands.insertContent(html)
    setIsBookmarkModalOpen(false)
    setBookmarkUrl('')
    setBookmarkTitle('')
    setBookmarkDesc('')
    toast.success('Marcador web insertado')
  }

  const handleInsertEmbedDoc = (targetNote: WorkspaceItem) => {
    if (!editor || readOnly) return
    const desc = escapeHtml(targetNote.informationContent?.slice(0, 70) || 'Documento incrustado de Seven Note')
    const safeTitle = escapeHtml(targetNote.title || 'Untitled')
    const safeIcon = escapeHtml(targetNote.icon || '📄')
    const safeId = encodeURIComponent(targetNote.id)
    const html = `
      <div class="affine-embed-doc my-3 p-3.5 rounded-2xl bg-indigo-950/25 border border-indigo-500/40 hover:border-indigo-500 transition group flex items-center justify-between cursor-pointer shadow-sm select-none" data-note-id="${safeId}" contenteditable="false">
        <div class="flex items-center gap-3 min-w-0">
          <span class="text-2xl">${safeIcon}</span>
          <div class="min-w-0">
            <div class="font-semibold text-sm text-zinc-100 group-hover:text-indigo-400 transition truncate">${safeTitle}</div>
            <div class="text-[11px] text-zinc-400 truncate">${desc}</div>
          </div>
        </div>
        <a href="#note=${safeId}" class="text-xs text-indigo-400 font-medium px-2.5 py-1 rounded-lg bg-indigo-500/15 border border-indigo-500/30 group-hover:bg-indigo-500/30 no-underline">Abrir ↗</a>
      </div><p></p>
    `
    editor.commands.insertContent(html)
    setIsEmbedDocModalOpen(false)
    setEmbedDocSearch('')
    toast.success(`Nota "${targetNote.title || 'Untitled'}" incrustada`)
  }

  const handleInsertMath = () => {
    if (!editor || readOnly) return
    const formula = escapeHtml(mathFormula.trim() || 'E = mc^2')
    const html = `
      <div class="my-4 p-3.5 rounded-2xl bg-zinc-900/90 border border-zinc-700/60 font-mono text-xs text-indigo-300 flex items-center justify-between shadow-sm select-none" contenteditable="false">
        <div class="flex items-center gap-2">
          <span class="text-base select-none">∑</span>
          <span class="text-sm font-semibold text-indigo-200">$$ ${formula} $$</span>
        </div>
        <span class="text-[10px] text-zinc-500 uppercase tracking-wider font-sans">LaTeX</span>
      </div><p></p>
    `
    editor.commands.insertContent(html)
    setIsMathModalOpen(false)
    toast.success('Fórmula LaTeX insertada')
  }

  const handleCopyCodeSnippet = () => {
    if (!editor) return
    const { from } = editor.state.selection
    const node = editor.state.doc.nodeAt(from)
    if (node && node.type.name === 'codeBlock') {
      navigator.clipboard.writeText(node.textContent)
      toast.success('Código copiado al portapapeles')
    } else {
      const codeDom = editor.view.dom.querySelector('pre code')
      if (codeDom?.textContent) {
        navigator.clipboard.writeText(codeDom.textContent)
        toast.success('Código copiado al portapapeles')
      }
    }
  }

  const slashMenuItems = [
    { id: 'emoji', title: 'Emoji de Apple', desc: 'Insertar un emoji Apple de la lista completa (1,870 emojis)', icon: <AppleEmoji emoji="✨" size={16} /> },
    { id: 'notion-table', title: 'Table (Notion)', desc: 'Vista de tabla estructurada con columnas interactivas', icon: <NotionTableIcon className="w-4 h-4 text-blue-500" /> },
    { id: 'notion-board', title: 'Board (Notion)', desc: 'Tablero Kanban de tarjetas agrupadas por estado', icon: <NotionBoardIcon className="w-4 h-4 text-amber-500" /> },
    { id: 'notion-list', title: 'List (Notion)', desc: 'Lista limpia con checkboxes y estados', icon: <NotionListIcon className="w-4 h-4 text-emerald-500" /> },
    { id: 'notion-timeline', title: 'Timeline (Notion)', desc: 'Cronograma horizontal estilo diagrama de Gantt', icon: <NotionTimelineIcon className="w-4 h-4 text-purple-500" /> },
    { id: 'notion-calendar', title: 'Calendar (Notion)', desc: 'Calendario mensual interactivo con eventos', icon: <NotionCalendarIcon className="w-4 h-4 text-rose-500" /> },
    { id: 'notion-gallery', title: 'Gallery (Notion)', desc: 'Mosaico visual de tarjetas con portadas', icon: <NotionGalleryIcon className="w-4 h-4 text-sky-500" /> },
    { id: 'h1', title: 'Título 1', desc: 'Encabezado principal de sección', icon: <Heading1Icon className="w-4 h-4 text-[#1e96eb]" /> },
    { id: 'h2', title: 'Título 2', desc: 'Subtítulo mediano', icon: <Heading2Icon className="w-4 h-4 text-[#1e96eb]" /> },
    { id: 'h3', title: 'Título 3', desc: 'Subtítulo pequeño', icon: <Heading3Icon className="w-4 h-4 text-[#1e96eb]" /> },
    { id: 'bookmark', title: 'Marcador Web (Bookmark)', desc: 'Tarjeta interactiva de enlace con vista previa', icon: <LinkIcon className="w-4 h-4 text-sky-500" /> },
    { id: 'embed-doc', title: 'Incrustar Documento (Linked Doc)', desc: 'Referencia visual conectada a otra nota', icon: <PageIcon className="w-4 h-4 text-indigo-500" /> },
    { id: 'image', title: 'Foto / Imagen', desc: 'Subir foto desde PC o celular', icon: <ImageIcon className="w-4 h-4 text-sky-500" /> },
    { id: 'taskList', title: 'Lista de Tareas', desc: 'Checklist interactivo con casillas', icon: <CheckBoxCheckSolidIcon className="w-4 h-4 text-emerald-500" /> },
    { id: 'bulletList', title: 'Lista con Viñetas', desc: 'Lista desordenada estándar', icon: <BulletedListIcon className="w-4 h-4 text-[var(--affine-text-secondary-color)]" /> },
    { id: 'toggle', title: 'Lista Desplegable', desc: 'Bloque colapsable estilo AFFiNE', icon: <ToggleDownIcon className="w-4 h-4 text-indigo-500" /> },
    { id: 'callout-idea', title: 'Destacado: Idea (💡)', desc: 'Bloque coloreado estilo AFFiNE', icon: <InformationIcon className="w-4 h-4 text-amber-500" /> },
    { id: 'callout-info', title: 'Destacado: Nota (ℹ️)', desc: 'Mensaje de contexto importante', icon: <InformationIcon className="w-4 h-4 text-[#1e96eb]" /> },
    { id: 'callout-success', title: 'Destacado: Éxito (✅)', desc: 'Mensaje positivo o recomendación', icon: <CheckBoxCheckSolidIcon className="w-4 h-4 text-emerald-500" /> },
    { id: 'callout-warning', title: 'Destacado: Alerta (⚠️)', desc: 'Aviso crítico o advertencia', icon: <InformationIcon className="w-4 h-4 text-rose-500" /> },
    { id: 'codeBlock', title: 'Bloque de Código', desc: 'Contenedor monoespaciado para código', icon: <CodeIcon className="w-4 h-4 text-purple-500" /> },
    { id: 'table', title: 'Tabla / Matriz', desc: 'Tabla interactiva de 3 columnas', icon: <TableIcon className="w-4 h-4 text-indigo-500" /> },
    { id: 'math', title: 'Fórmula Matemática', desc: 'Bloque de notación LaTeX', icon: <CodeIcon className="w-4 h-4 text-pink-500" /> },
    { id: 'blockquote', title: 'Cita', desc: 'Párrafo en bloque destacado', icon: <QuoteIcon className="w-4 h-4 text-[var(--affine-text-secondary-color)]" /> },
    { id: 'divider', title: 'Separador Horizontal', desc: 'Línea de división de contenido', icon: <DividerIcon className="w-4 h-4 text-[var(--affine-text-secondary-color)]" /> }
  ].filter((item) => item.title.toLowerCase().includes(slashFilter.toLowerCase()) || item.desc.toLowerCase().includes(slashFilter.toLowerCase()))

  // Default to 'full' so the editor occupies the screen gracefully without huge empty black sidebars
  const effectivePageWidth = workspace.pageWidth || 'full'

  const handleTogglePageWidth = async () => {
    if (readOnly) return
    const nextWidth = effectivePageWidth === 'full' ? 'standard' : effectivePageWidth === 'wide' ? 'full' : 'wide'
    await db.workspaces.update(workspace.id, {
      pageWidth: nextWidth,
      updatedAt: Date.now(),
      syncStatus: 'pending'
    })
    syncEngine.scheduleSync(500)
    toast.success(
      nextWidth === 'full'
        ? 'Ancho completo activado (rellenando pantalla)'
        : nextWidth === 'wide'
        ? 'Ancho amplio activado'
        : 'Ancho estándar activado'
    )
  }

  const pageWidthClass =
    effectivePageWidth === 'standard'
      ? 'max-w-4xl px-4 sm:px-8'
      : effectivePageWidth === 'wide'
      ? 'max-w-6xl px-4 sm:px-8 md:px-12'
      : 'max-w-full w-full px-4 sm:px-8 md:px-12 lg:px-16 xl:px-20'

  if (!editor) return null

  return (
    <div className="flex flex-col h-full bg-[var(--app-bg-primary)] overflow-y-auto text-[var(--app-text-primary)] select-text relative">
      {/* Top Formatting Toolbar (Notion Minimal Bar) */}
      <div className="sticky top-0 z-20 min-h-[46px] h-[46px] sm:h-12 px-3 sm:px-6 border-b border-black/[0.08] dark:border-white/[0.1] bg-white/95 dark:bg-[#1a1b1e]/95 backdrop-blur-xl text-xs overflow-x-auto no-scrollbar touch-pan-x flex items-center justify-between gap-2 select-none shrink-0">
          <div className="flex items-center gap-1 sm:gap-1.5 shrink-0 pr-8 sm:pr-0">
            {/* Quick insert block button */}
            <button
              onClick={() => {
                setSlashMenuOpen(!slashMenuOpen)
                setSlashFilter('')
              }}
              className="h-8 px-2.5 sm:px-3 rounded-lg bg-black/[0.04] dark:bg-white/[0.08] hover:bg-black/[0.08] dark:hover:bg-white/[0.15] text-[var(--app-text-primary)] transition flex items-center gap-1.5 font-medium border border-black/[0.06] dark:border-white/[0.08] cursor-pointer active:scale-95 shrink-0"
              title="Insertar bloques de contenido (/)"
            >
              <PlusIcon className="w-4 h-4 text-blue-500" />
              <span className="text-xs font-semibold">Bloque</span>
            </button>

            {/* Notion Tools Dropdown (Table, Board, List, Timeline, Calendar, Gallery) */}
            <div className="relative shrink-0">
              <button
                onClick={() => setIsNotionMenuOpen(!isNotionMenuOpen)}
                className="h-8 px-2.5 sm:px-3 rounded-lg bg-black/[0.04] dark:bg-white/[0.08] hover:bg-black/[0.08] dark:hover:bg-white/[0.15] text-[var(--app-text-primary)] transition flex items-center gap-1.5 font-medium border border-black/[0.06] dark:border-white/[0.08] cursor-pointer active:scale-95 shrink-0"
                title="Herramientas de Notion (Table, Board, List, Timeline, Calendar, Gallery)"
              >
                <NotionTableIcon className="w-4 h-4 text-blue-500" />
                <span className="text-xs font-semibold">Vistas</span>
                <ChevronDown className="w-3 h-3 text-neutral-400" />
              </button>

              <NotionViewsDropdown
                isOpen={isNotionMenuOpen}
                onClose={() => setIsNotionMenuOpen(false)}
                onSelectView={handleActivateNotionView}
                currentView={databaseData?.activeView}
                className="fixed top-24 left-3 sm:absolute sm:left-0 sm:top-full sm:mt-2"
              />
            </div>

            <div className="w-[1px] h-4 bg-black/[0.1] dark:bg-white/[0.2] mx-0.5 sm:mx-1 shrink-0" />

            <button
              onClick={() => editor.chain().focus().toggleBold().run()}
              className={`w-8 h-8 rounded-lg flex items-center justify-center transition cursor-pointer active:scale-95 shrink-0 ${editor.isActive('bold') ? 'bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 shadow-xs font-bold' : 'text-neutral-600 hover:text-neutral-900 dark:text-zinc-200 dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/15'}`}
              title="Negrita"
            >
              <BoldIcon className="w-4 h-4" />
            </button>
            <button
              onClick={() => editor.chain().focus().toggleItalic().run()}
              className={`w-8 h-8 rounded-lg flex items-center justify-center transition cursor-pointer active:scale-95 shrink-0 ${editor.isActive('italic') ? 'bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 shadow-xs font-bold' : 'text-neutral-600 hover:text-neutral-900 dark:text-zinc-200 dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/15'}`}
              title="Cursiva"
            >
              <ItalicIcon className="w-4 h-4" />
            </button>
            <button
              onClick={() => editor.chain().focus().toggleUnderline().run()}
              className={`w-8 h-8 rounded-lg flex items-center justify-center transition cursor-pointer active:scale-95 shrink-0 ${editor.isActive('underline') ? 'bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 shadow-xs font-bold' : 'text-neutral-600 hover:text-neutral-900 dark:text-zinc-200 dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/15'}`}
              title="Subrayado"
            >
              <UnderLineIcon className="w-4 h-4" />
            </button>
            <button
              onClick={() => editor.chain().focus().toggleCode().run()}
              className={`w-8 h-8 rounded-lg flex items-center justify-center transition cursor-pointer active:scale-95 shrink-0 ${editor.isActive('code') ? 'bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 shadow-xs font-bold' : 'text-neutral-600 hover:text-neutral-900 dark:text-zinc-200 dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/15'}`}
              title="Código en línea"
            >
              <CodeIcon className="w-4 h-4" />
            </button>

            <div className="w-[1px] h-4 bg-black/[0.1] dark:bg-white/[0.2] mx-0.5 sm:mx-1 shrink-0" />

            {/* Alineación de texto: Izquierda, Centro, Derecha, Justificado */}
            <button
              onClick={() => editor.chain().focus().setTextAlign('left').run()}
              className={`w-8 h-8 rounded-lg flex items-center justify-center transition cursor-pointer active:scale-95 shrink-0 ${editor.isActive({ textAlign: 'left' }) ? 'bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 shadow-xs font-bold' : 'text-neutral-600 hover:text-neutral-900 dark:text-zinc-200 dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/15'}`}
              title="Alinear a la izquierda"
            >
              <AlignLeft className="w-4 h-4" />
            </button>
            <button
              onClick={() => editor.chain().focus().setTextAlign('center').run()}
              className={`w-8 h-8 rounded-lg flex items-center justify-center transition cursor-pointer active:scale-95 shrink-0 ${editor.isActive({ textAlign: 'center' }) ? 'bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 shadow-xs font-bold' : 'text-neutral-600 hover:text-neutral-900 dark:text-zinc-200 dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/15'}`}
              title="Centrar texto"
            >
              <AlignCenter className="w-4 h-4" />
            </button>
            <button
              onClick={() => editor.chain().focus().setTextAlign('right').run()}
              className={`w-8 h-8 rounded-lg flex items-center justify-center transition cursor-pointer active:scale-95 shrink-0 ${editor.isActive({ textAlign: 'right' }) ? 'bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 shadow-xs font-bold' : 'text-neutral-600 hover:text-neutral-900 dark:text-zinc-200 dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/15'}`}
              title="Alinear a la derecha"
            >
              <AlignRight className="w-4 h-4" />
            </button>
            <button
              onClick={() => editor.chain().focus().setTextAlign('justify').run()}
              className={`w-8 h-8 rounded-lg flex items-center justify-center transition cursor-pointer active:scale-95 shrink-0 ${editor.isActive({ textAlign: 'justify' }) ? 'bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 shadow-xs font-bold' : 'text-neutral-600 hover:text-neutral-900 dark:text-zinc-200 dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/15'}`}
              title="Justificar texto"
            >
              <AlignJustify className="w-4 h-4" />
            </button>

            <div className="w-[1px] h-4 bg-black/[0.1] dark:bg-white/[0.2] mx-0.5 sm:mx-1 shrink-0" />

            <button
              onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
              className={`w-8 h-8 rounded-lg flex items-center justify-center transition cursor-pointer active:scale-95 shrink-0 ${editor.isActive('heading', { level: 1 }) ? 'bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 shadow-xs font-bold' : 'text-neutral-600 hover:text-neutral-900 dark:text-zinc-200 dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/15'}`}
              title="Encabezado 1"
            >
              <Heading1Icon className="w-4 h-4" />
            </button>
            <button
              onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
              className={`w-8 h-8 rounded-lg flex items-center justify-center transition cursor-pointer active:scale-95 shrink-0 ${editor.isActive('heading', { level: 2 }) ? 'bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 shadow-xs font-bold' : 'text-neutral-600 hover:text-neutral-900 dark:text-zinc-200 dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/15'}`}
              title="Encabezado 2"
            >
              <Heading2Icon className="w-4 h-4" />
            </button>
            <button
              onClick={() => editor.chain().focus().toggleBulletList().run()}
              className={`w-8 h-8 rounded-lg flex items-center justify-center transition cursor-pointer active:scale-95 shrink-0 ${editor.isActive('bulletList') ? 'bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 shadow-xs font-bold' : 'text-neutral-600 hover:text-neutral-900 dark:text-zinc-200 dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/15'}`}
              title="Lista de viñetas"
            >
              <BulletedListIcon className="w-4 h-4" />
            </button>
            <button
              onClick={() => editor.chain().focus().toggleTaskList().run()}
              className={`w-8 h-8 rounded-lg flex items-center justify-center transition cursor-pointer active:scale-95 shrink-0 ${editor.isActive('taskList') ? 'bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 shadow-xs font-bold' : 'text-neutral-600 hover:text-neutral-900 dark:text-zinc-200 dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/15'}`}
              title="Lista de tareas"
            >
              <CheckBoxCheckSolidIcon className="w-4 h-4" />
            </button>
            <button
              onClick={() => editorImageInputRef.current?.click()}
              className="w-8 h-8 rounded-lg flex items-center justify-center transition cursor-pointer text-neutral-600 hover:text-neutral-900 dark:text-zinc-200 dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/15 active:scale-95 shrink-0"
              title="Añadir foto"
            >
              <ImageIcon className="w-4 h-4" />
            </button>
            <input
              type="file"
              ref={editorImageInputRef}
              onChange={handleEditorImageUpload}
              accept="image/*"
              multiple
              className="hidden"
            />
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2">
            {/* Quick toggle page width button */}
            <button
              onClick={handleTogglePageWidth}
              className="h-8 px-2 sm:px-2.5 rounded-lg bg-black/[0.04] dark:bg-white/[0.08] hover:bg-black/[0.08] dark:hover:bg-white/[0.15] text-[var(--app-text-primary)] transition flex items-center gap-1.5 text-xs font-medium border border-black/[0.06] dark:border-white/[0.08] cursor-pointer active:scale-95 shrink-0"
              title={`Ancho de página: ${effectivePageWidth === 'full' ? 'Completo (pantalla extendida)' : effectivePageWidth === 'wide' ? 'Amplio' : 'Estándar'}. Clic para alternar`}
            >
              {effectivePageWidth === 'full' ? (
                <Minimize2 className="w-3.5 h-3.5 text-blue-500" />
              ) : (
                <Maximize2 className="w-3.5 h-3.5 text-neutral-400" />
              )}
              <span className="hidden md:inline text-xs font-medium">
                {effectivePageWidth === 'full' ? 'Ancho completo' : effectivePageWidth === 'wide' ? 'Ancho amplio' : 'Estándar'}
              </span>
            </button>

            <div className="hidden sm:flex items-center gap-2 text-[11px] text-[var(--app-text-muted)]">
              <span className="font-mono">
                {saveStatus === 'saving' ? 'Guardando...' : 'Guardado'}
              </span>
            </div>
          </div>
        </div>

      {/* Interactive Sticky Table Toolbar when inside a table */}
      {editor.isActive('table') && (
        <div className="sticky top-11 z-20 flex items-center justify-center py-2 px-3 bg-white/70 dark:bg-[#121214]/70 backdrop-blur-md">
          <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/90 dark:bg-[#1a1b1e]/90 border border-black/[0.08] dark:border-white/[0.1] text-xs text-[var(--app-text-primary)] shadow-lg flex-wrap">
            <span className="text-[10px] uppercase font-bold text-blue-500 px-1">
              Tabla
            </span>
            <button
              onClick={() => editor.chain().focus().addRowBefore().run()}
              className="px-2.5 py-0.5 rounded-full hover:bg-black/5 dark:hover:bg-white/10 transition text-[11px] font-medium cursor-pointer active:scale-95"
              title="Añadir fila arriba"
            >
              + Fila ↑
            </button>
            <button
              onClick={() => editor.chain().focus().addRowAfter().run()}
              className="px-2.5 py-0.5 rounded-full hover:bg-black/5 dark:hover:bg-white/10 transition text-[11px] font-medium cursor-pointer active:scale-95"
              title="Añadir fila abajo"
            >
              + Fila ↓
            </button>
            <button
              onClick={() => editor.chain().focus().deleteRow().run()}
              className="px-2.5 py-0.5 rounded-full hover:bg-rose-500/10 text-rose-500 transition text-[11px] font-medium cursor-pointer active:scale-95"
              title="Eliminar fila actual"
            >
              - Fila
            </button>

            <div className="w-[1px] h-3.5 bg-black/[0.08] dark:bg-white/[0.1] mx-0.5" />

            <button
              onClick={() => editor.chain().focus().addColumnBefore().run()}
              className="px-2.5 py-0.5 rounded-full hover:bg-black/5 dark:hover:bg-white/10 transition text-[11px] font-medium cursor-pointer active:scale-95"
              title="Añadir columna a la izquierda"
            >
              + Col ←
            </button>
            <button
              onClick={() => editor.chain().focus().addColumnAfter().run()}
              className="px-2.5 py-0.5 rounded-full hover:bg-black/5 dark:hover:bg-white/10 transition text-[11px] font-medium cursor-pointer active:scale-95"
              title="Añadir columna a la derecha"
            >
              + Col →
            </button>
            <button
              onClick={() => editor.chain().focus().deleteColumn().run()}
              className="px-2.5 py-0.5 rounded-full hover:bg-rose-500/10 text-rose-500 transition text-[11px] font-medium cursor-pointer active:scale-95"
              title="Eliminar columna actual"
            >
              - Col
            </button>

            <div className="w-[1px] h-3.5 bg-black/[0.08] dark:bg-white/[0.1] mx-0.5" />

            <button
              onClick={() => editor.chain().focus().toggleHeaderRow().run()}
              className="px-2.5 py-0.5 rounded-full hover:bg-black/5 dark:hover:bg-white/10 text-neutral-600 dark:text-neutral-300 transition text-[11px] font-medium cursor-pointer active:scale-95"
              title="Alternar fila de encabezado"
            >
              Encabezado
            </button>
            <button
              onClick={() => editor.chain().focus().deleteTable().run()}
              className="px-2.5 py-0.5 rounded-full hover:bg-rose-500/10 text-rose-500 transition text-[11px] font-medium cursor-pointer active:scale-95"
              title="Borrar tabla"
            >
              Borrar tabla
            </button>
          </div>
        </div>
      )}

      {/* Interactive Sticky Code Block Toolbar when inside a code block */}
      {editor.isActive('codeBlock') && (
        <div className="sticky top-11 z-20 flex items-center justify-center py-1.5 px-3 bg-[var(--affine-background-primary-color)]/95 border-b border-[var(--affine-border-color)] backdrop-blur-md">
          <div className="flex items-center gap-2 p-1.5 rounded-xl bg-[var(--affine-background-secondary-color)] border border-[var(--affine-border-color)] text-xs text-[var(--affine-text-primary-color)] shadow-xs">
            <CodeIcon className="w-4 h-4 text-purple-400 ml-1" />
            <span className="text-[10px] uppercase font-bold text-[var(--affine-text-secondary-color)]">
              Lenguaje:
            </span>
            <select
              value={codeLanguage}
              onChange={(e) => {
                setCodeLanguage(e.target.value)
                editor.chain().focus().updateAttributes('codeBlock', { language: e.target.value }).run()
              }}
              className="bg-[var(--affine-background-primary-color)] text-[var(--affine-text-primary-color)] text-xs rounded-lg px-2 py-1 border border-[var(--affine-border-color)] outline-none"
            >
              <option value="javascript">JavaScript</option>
              <option value="typescript">TypeScript</option>
              <option value="python">Python</option>
              <option value="html">HTML</option>
              <option value="css">CSS</option>
              <option value="sql">SQL</option>
              <option value="json">JSON</option>
              <option value="rust">Rust</option>
              <option value="go">Go</option>
              <option value="bash">Bash / Shell</option>
              <option value="markdown">Markdown</option>
            </select>

            <button
              onClick={handleCopyCodeSnippet}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[var(--affine-hover-color)] hover:bg-[#1e96eb] hover:text-white text-[var(--affine-text-primary-color)] transition text-xs font-medium ml-1"
              title="Copiar código al portapapeles"
            >
              <CopyIcon className="w-3.5 h-3.5" />
              <span>Copiar código</span>
            </button>
          </div>
        </div>
      )}

      {/* Floating Text Selection Bubble Toolbar (Notion Style) */}
      {floatingMenuPos && (
        <div
          style={{
            position: 'fixed',
            left: `${typeof window !== 'undefined' && window.innerWidth < 640 ? Math.max(140, Math.min(window.innerWidth - 140, floatingMenuPos.x)) : floatingMenuPos.x}px`,
            top: `${typeof window !== 'undefined' && window.innerWidth < 640 ? Math.max(54, floatingMenuPos.y) : floatingMenuPos.y}px`,
            transform: 'translateX(-50%)'
          }}
          className="z-50 flex items-center gap-0.5 sm:gap-1 px-1.5 sm:px-2.5 py-1 sm:py-1.5 rounded-full bg-white/90 dark:bg-[#1a1b1e]/90 backdrop-blur-2xl border border-black/[0.08] dark:border-white/[0.1] shadow-2xl animate-in fade-in zoom-in-95 duration-100 max-w-[calc(100vw-24px)] overflow-x-auto"
        >
          <button
            onClick={() => editor.chain().focus().toggleBold().run()}
            className={`p-1 sm:p-1.5 rounded-full transition cursor-pointer active:scale-95 ${editor.isActive('bold') ? 'bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 shadow-xs font-semibold' : 'text-neutral-600 dark:text-zinc-200 hover:text-neutral-900 dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/15'}`}
            title="Negrita (Ctrl+B)"
          >
            <BoldIcon className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
          </button>
          <button
            onClick={() => editor.chain().focus().toggleItalic().run()}
            className={`p-1 sm:p-1.5 rounded-full transition cursor-pointer active:scale-95 ${editor.isActive('italic') ? 'bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 shadow-xs font-semibold' : 'text-neutral-600 dark:text-zinc-200 hover:text-neutral-900 dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/15'}`}
            title="Cursiva (Ctrl+I)"
          >
            <ItalicIcon className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
          </button>
          <button
            onClick={() => editor.chain().focus().toggleUnderline().run()}
            className={`p-1 sm:p-1.5 rounded-full transition cursor-pointer active:scale-95 ${editor.isActive('underline') ? 'bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 shadow-xs font-semibold' : 'text-neutral-600 dark:text-zinc-200 hover:text-neutral-900 dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/15'}`}
            title="Subrayado (Ctrl+U)"
          >
            <UnderLineIcon className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
          </button>
          <button
            onClick={() => editor.chain().focus().toggleCode().run()}
            className={`p-1 sm:p-1.5 rounded-full transition cursor-pointer active:scale-95 ${editor.isActive('code') ? 'bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 shadow-xs font-semibold' : 'text-neutral-600 dark:text-zinc-200 hover:text-neutral-900 dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/15'}`}
            title="Código en línea (Ctrl+E)"
          >
            <CodeIcon className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
          </button>

          <div className="w-[1px] h-3.5 bg-black/[0.1] dark:bg-white/[0.2] mx-0.5 shrink-0" />

          {/* Alineación de texto en menú flotante al seleccionar */}
          <button
            onClick={() => editor.chain().focus().setTextAlign('left').run()}
            className={`p-1 sm:p-1.5 rounded-full transition cursor-pointer active:scale-95 ${editor.isActive({ textAlign: 'left' }) ? 'bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 shadow-xs font-semibold' : 'text-neutral-600 dark:text-zinc-200 hover:text-neutral-900 dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/15'}`}
            title="Alinear a la izquierda"
          >
            <AlignLeft className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
          </button>
          <button
            onClick={() => editor.chain().focus().setTextAlign('center').run()}
            className={`p-1 sm:p-1.5 rounded-full transition cursor-pointer active:scale-95 ${editor.isActive({ textAlign: 'center' }) ? 'bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 shadow-xs font-semibold' : 'text-neutral-600 dark:text-zinc-200 hover:text-neutral-900 dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/15'}`}
            title="Centrar texto"
          >
            <AlignCenter className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
          </button>
          <button
            onClick={() => editor.chain().focus().setTextAlign('right').run()}
            className={`p-1 sm:p-1.5 rounded-full transition cursor-pointer active:scale-95 ${editor.isActive({ textAlign: 'right' }) ? 'bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 shadow-xs font-semibold' : 'text-neutral-600 dark:text-zinc-200 hover:text-neutral-900 dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/15'}`}
            title="Alinear a la derecha"
          >
            <AlignRight className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
          </button>
          <button
            onClick={() => editor.chain().focus().setTextAlign('justify').run()}
            className={`p-1 sm:p-1.5 rounded-full transition cursor-pointer active:scale-95 ${editor.isActive({ textAlign: 'justify' }) ? 'bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 shadow-xs font-semibold' : 'text-neutral-600 dark:text-zinc-200 hover:text-neutral-900 dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/15'}`}
            title="Justificar texto"
          >
            <AlignJustify className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
          </button>

          <div className="w-[1px] h-3.5 bg-black/[0.1] dark:bg-white/[0.2] mx-0.5 shrink-0" />
          <button
            onClick={() => setIsBodyEmojiPickerOpen(true)}
            className="p-1 sm:p-1.5 rounded-full transition cursor-pointer active:scale-95 text-neutral-600 dark:text-zinc-200 hover:text-neutral-900 dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/15"
            title="Insertar Emoji Apple en la nota"
          >
            <AppleEmoji emoji="✨" size={14} />
          </button>
        </div>
      )}

      {/* Body Emoji Picker Modal */}
      {isBodyEmojiPickerOpen && typeof document !== 'undefined' && createPortal(
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-100"
          onClick={() => setIsBodyEmojiPickerOpen(false)}
        >
          <div onClick={(e) => e.stopPropagation()} className="relative">
            <EmojiPickerPopover
              isOpen={isBodyEmojiPickerOpen}
              onClose={() => setIsBodyEmojiPickerOpen(false)}
              onSelectEmoji={(emoji) => {
                editor?.commands.insertContent(emoji)
                setIsBodyEmojiPickerOpen(false)
              }}
              title="Insertar Emoji Apple en la Nota"
              isModal={true}
            />
          </div>
        </div>,
        document.body
      )}

      {/* Slash Menu Popover Dialog (Notion Style) */}
      {slashMenuOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/10"
          onClick={() => setSlashMenuOpen(false)}
        >
          <div
            style={
              slashMenuPos && typeof window !== 'undefined' && window.innerWidth >= 640
                ? {
                    position: 'fixed',
                    left: `${Math.min(window.innerWidth - 380, Math.max(20, slashMenuPos.x))}px`,
                    top: `${Math.min(window.innerHeight - 380, Math.max(20, slashMenuPos.y))}px`
                  }
                : undefined
            }
            className={`w-[calc(100vw-24px)] sm:w-full max-w-sm bg-white/95 dark:bg-[#1a1b1e]/95 border border-black/[0.08] dark:border-white/[0.1] rounded-2xl sm:rounded-3xl shadow-2xl backdrop-blur-2xl overflow-hidden flex flex-col max-h-[min(340px,50vh)] sm:max-h-[380px] p-1.5 sm:p-2 animate-in fade-in zoom-in-95 duration-100 ${
              !slashMenuPos || (typeof window !== 'undefined' && window.innerWidth < 640)
                ? 'fixed bottom-4 sm:top-24 left-1/2 -translate-x-1/2'
                : ''
            }`}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Search filter input */}
            <div className="p-1.5 sm:p-2 border-b border-black/[0.06] dark:border-white/[0.08] flex items-center justify-between gap-1.5 sm:gap-2">
              <input
                autoFocus
                type="text"
                value={slashFilter}
                onChange={(e) => {
                  setSlashFilter(e.target.value)
                  setSelectedSlashIdx(0)
                }}
                onKeyDown={(e) => {
                  if (e.key === 'ArrowDown') {
                    e.preventDefault()
                    setSelectedSlashIdx((prev) => Math.min(slashMenuItems.length - 1, prev + 1))
                  } else if (e.key === 'ArrowUp') {
                    e.preventDefault()
                    setSelectedSlashIdx((prev) => Math.max(0, prev - 1))
                  } else if (e.key === 'Enter') {
                    e.preventDefault()
                    if (slashMenuItems[selectedSlashIdx]) {
                      insertBlock(slashMenuItems[selectedSlashIdx].id)
                    }
                  } else if (e.key === 'Escape') {
                    setSlashMenuOpen(false)
                  }
                }}
                placeholder="Filtrar bloques..."
                className="w-full bg-black/[0.04] dark:bg-white/[0.06] rounded-full px-3 sm:px-3.5 py-1 sm:py-1.5 text-[11px] sm:text-xs text-[var(--app-text-primary)] placeholder:text-neutral-400 outline-none font-sans"
              />
              <button
                onClick={() => setSlashMenuOpen(false)}
                className="p-1 sm:p-1.5 rounded-full text-neutral-400 hover:text-neutral-800 dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/10 transition cursor-pointer"
              >
                <CloseIcon className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Blocks menu list */}
            <div className="overflow-y-auto p-1 sm:p-1.5 space-y-0.5 sm:space-y-1 custom-scrollbar">
              {slashMenuItems.length === 0 ? (
                <div className="py-5 text-center text-xs text-neutral-400">
                  No se encontraron bloques para "{slashFilter}"
                </div>
              ) : (
                slashMenuItems.map((item, idx) => (
                  <button
                    key={item.id}
                    onClick={() => insertBlock(item.id)}
                    className={`w-full text-left p-1.5 sm:p-2 rounded-xl sm:rounded-2xl transition flex items-center gap-2 sm:gap-3 group text-xs cursor-pointer active:scale-[0.98] ${
                      idx === selectedSlashIdx ? 'bg-black/[0.06] dark:bg-white/[0.08] ring-1 ring-neutral-400' : 'hover:bg-black/[0.04] dark:hover:bg-white/[0.05]'
                    }`}
                  >
                    <div className="p-1.5 sm:p-2 rounded-lg sm:rounded-xl bg-black/[0.04] dark:bg-white/[0.06] text-neutral-700 dark:text-neutral-200 group-hover:scale-105 shrink-0 transition">
                      {item.icon}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="font-semibold text-neutral-800 dark:text-neutral-100 group-hover:text-blue-500 transition text-xs sm:text-sm">
                        {item.title}
                      </div>
                      <div className="text-[11px] sm:text-xs text-neutral-500 truncate">{item.desc}</div>
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal: Insert Bookmark Card */}
      {isBookmarkModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4 animate-in fade-in duration-100">
          <div className="w-[calc(100vw-32px)] max-w-md bg-[var(--affine-background-overlay-panel-color)] border border-[var(--affine-border-color)] rounded-2xl shadow-[var(--affine-popover-shadow)] p-5 flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <LinkIcon className="w-5 h-5 text-sky-500" />
                <h3 className="font-bold text-sm text-[var(--affine-text-primary-color)]">
                  Insertar Marcador Web (Bookmark)
                </h3>
              </div>
              <button
                onClick={() => setIsBookmarkModalOpen(false)}
                className="p-1 rounded-lg text-[var(--affine-text-secondary-color)] hover:bg-[var(--affine-hover-color)]"
              >
                <CloseIcon className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-[var(--affine-text-secondary-color)] mb-1 font-medium">
                  URL del sitio web:
                </label>
                <input
                  type="url"
                  autoFocus
                  value={bookmarkUrl}
                  onChange={(e) => setBookmarkUrl(e.target.value)}
                  placeholder="https://ejemplo.com/articulo"
                  className="w-full px-3 py-2 rounded-xl bg-[var(--affine-background-secondary-color)] border border-[var(--affine-border-color)] text-[var(--affine-text-primary-color)] outline-none focus:border-[#1e96eb]"
                />
              </div>

              <div>
                <label className="block text-[var(--affine-text-secondary-color)] mb-1 font-medium">
                  Título de la tarjeta (opcional):
                </label>
                <input
                  type="text"
                  value={bookmarkTitle}
                  onChange={(e) => setBookmarkTitle(e.target.value)}
                  placeholder="Mi artículo o recurso favorito"
                  className="w-full px-3 py-2 rounded-xl bg-[var(--affine-background-secondary-color)] border border-[var(--affine-border-color)] text-[var(--affine-text-primary-color)] outline-none focus:border-[#1e96eb]"
                />
              </div>

              <div>
                <label className="block text-[var(--affine-text-secondary-color)] mb-1 font-medium">
                  Descripción (opcional):
                </label>
                <textarea
                  rows={2}
                  value={bookmarkDesc}
                  onChange={(e) => setBookmarkDesc(e.target.value)}
                  placeholder="Breve resumen o notas sobre este enlace..."
                  className="w-full px-3 py-2 rounded-xl bg-[var(--affine-background-secondary-color)] border border-[var(--affine-border-color)] text-[var(--affine-text-primary-color)] outline-none focus:border-[#1e96eb] resize-none"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-[var(--affine-divider-color)]">
              <button
                onClick={() => setIsBookmarkModalOpen(false)}
                className="px-3.5 py-1.5 rounded-xl text-xs text-[var(--affine-text-secondary-color)] hover:bg-[var(--affine-hover-color)] transition"
              >
                Cancelar
              </button>
              <button
                disabled={!bookmarkUrl.trim()}
                onClick={handleInsertBookmark}
                className="px-4 py-1.5 rounded-xl text-xs font-semibold bg-[#1e96eb] hover:bg-[#1880ca] text-white disabled:opacity-40 transition shadow-xs"
              >
                Insertar marcador
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Insert Embed Document Card */}
      {isEmbedDocModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4 animate-in fade-in duration-100">
          <div className="w-[calc(100vw-32px)] max-w-md bg-[var(--affine-background-overlay-panel-color)] border border-[var(--affine-border-color)] rounded-2xl shadow-[var(--affine-popover-shadow)] p-5 flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <PageIcon className="w-5 h-5 text-indigo-500" />
                <h3 className="font-bold text-sm text-[var(--affine-text-primary-color)]">
                  Incrustar Documento (Linked Doc)
                </h3>
              </div>
              <button
                onClick={() => setIsEmbedDocModalOpen(false)}
                className="p-1 rounded-lg text-[var(--affine-text-secondary-color)] hover:bg-[var(--affine-hover-color)]"
              >
                <CloseIcon className="w-4 h-4" />
              </button>
            </div>

            <input
              type="text"
              autoFocus
              value={embedDocSearch}
              onChange={(e) => setEmbedDocSearch(e.target.value)}
              placeholder="Buscar página para incrustar..."
              className="w-full px-3 py-2 rounded-xl bg-[var(--affine-background-secondary-color)] border border-[var(--affine-border-color)] text-xs text-[var(--affine-text-primary-color)] outline-none focus:border-[#1e96eb]"
            />

            <div className="max-h-60 overflow-y-auto space-y-1.5 text-xs py-1">
              {allWorkspaces
                .filter((w) => w.id !== workspace.id && !w.isDeleted)
                .filter((w) => !embedDocSearch || (w.title || '').toLowerCase().includes(embedDocSearch.toLowerCase()))
                .map((ws) => (
                  <div
                    key={ws.id}
                    onClick={() => handleInsertEmbedDoc(ws)}
                    className="p-2.5 rounded-xl bg-[var(--affine-background-secondary-color)] hover:bg-[var(--affine-hover-color)] border border-[var(--affine-border-color)] cursor-pointer transition flex items-center justify-between group"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className="shrink-0"><AppleEmoji emoji={ws.icon || '📄'} size={20} /></span>
                      <div className="min-w-0">
                        <div className="font-semibold text-xs text-[var(--affine-text-primary-color)] group-hover:text-[#1e96eb] truncate">
                          {renderWithAppleEmoji(ws.title || 'Untitled')}
                        </div>
                        <div className="text-[10px] text-[var(--affine-text-secondary-color)] truncate">
                          {ws.informationContent || 'Página de Seven Note'}
                        </div>
                      </div>
                    </div>
                    <span className="text-[10px] text-[#1e96eb] font-semibold px-2 py-0.5 rounded-md bg-[#1e96eb]/10 group-hover:bg-[#1e96eb] group-hover:text-white transition">
                      Incrustar
                    </span>
                  </div>
                ))}
            </div>

            <div className="flex justify-end pt-2 border-t border-[var(--affine-divider-color)]">
              <button
                onClick={() => setIsEmbedDocModalOpen(false)}
                className="px-3.5 py-1.5 rounded-xl text-xs text-[var(--affine-text-secondary-color)] hover:bg-[var(--affine-hover-color)] transition"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Insert LaTeX Math Formula */}
      {isMathModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4 animate-in fade-in duration-100">
          <div className="w-[calc(100vw-32px)] max-w-md bg-[var(--affine-background-overlay-panel-color)] border border-[var(--affine-border-color)] rounded-2xl shadow-[var(--affine-popover-shadow)] p-5 flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CodeIcon className="w-5 h-5 text-pink-500" />
                <h3 className="font-bold text-sm text-[var(--affine-text-primary-color)]">
                  Fórmula Matemática (LaTeX)
                </h3>
              </div>
              <button
                onClick={() => setIsMathModalOpen(false)}
                className="p-1 rounded-lg text-[var(--affine-text-secondary-color)] hover:bg-[var(--affine-hover-color)]"
              >
                <CloseIcon className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2 text-xs">
              <span className="text-[var(--affine-text-secondary-color)] font-medium">Plantillas rápidas:</span>
              <div className="flex flex-wrap gap-1.5">
                {[
                  { label: 'Relatividad', val: 'E = mc^2' },
                  { label: 'Cuadrática', val: 'x = \\frac{-b \\pm \\sqrt{b^2 - 4ac}}{2a}' },
                  { label: 'Euler', val: 'e^{i\\pi} + 1 = 0' },
                  { label: 'Integral', val: '\\int_{-\\infty}^{\\infty} e^{-x^2} dx = \\sqrt{\\pi}' },
                  { label: 'Matriz 2x2', val: '\\begin{pmatrix} a & b \\\\ c & d \\end{pmatrix}' }
                ].map((item) => (
                  <button
                    key={item.label}
                    onClick={() => setMathFormula(item.val)}
                    className="px-2 py-1 rounded-lg bg-[var(--affine-background-secondary-color)] hover:bg-[#1e96eb] hover:text-white border border-[var(--affine-border-color)] text-[11px] transition"
                  >
                    {item.label}
                  </button>
                ))}
              </div>

              <div className="pt-2">
                <label className="block text-[var(--affine-text-secondary-color)] mb-1 font-medium">
                  Expresión LaTeX:
                </label>
                <textarea
                  rows={3}
                  value={mathFormula}
                  onChange={(e) => setMathFormula(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-[var(--affine-background-secondary-color)] border border-[var(--affine-border-color)] font-mono text-xs text-indigo-300 outline-none focus:border-[#1e96eb] resize-none"
                />
              </div>

              {/* Live Preview */}
              <div className="p-3 rounded-xl bg-zinc-950/80 border border-zinc-800 text-center font-mono text-xs text-indigo-200">
                $$ {mathFormula} $$
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-[var(--affine-divider-color)]">
              <button
                onClick={() => setIsMathModalOpen(false)}
                className="px-3.5 py-1.5 rounded-xl text-xs text-[var(--affine-text-secondary-color)] hover:bg-[var(--affine-hover-color)] transition"
              >
                Cancelar
              </button>
              <button
                onClick={handleInsertMath}
                className="px-4 py-1.5 rounded-xl text-xs font-semibold bg-[#1e96eb] hover:bg-[#1880ca] text-white transition shadow-xs"
              >
                Insertar fórmula
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main Document Body Container */}
      <div className={`mx-auto w-full pt-4 sm:pt-8 pb-24 ${pageWidthClass}`}>
        {/* Top: Add icon Button */}
        <div className="mb-4 relative">
          {workspace.icon ? (
            <div className="flex items-center gap-2 group">
              <span
                onClick={() => setIsEmojiPickerOpen(true)}
                className="cursor-pointer hover:scale-105 transition flex items-center justify-center p-1 rounded-2xl hover:bg-black/5 dark:hover:bg-white/5"
                title="Cambiar icono"
              >
                <AppleEmoji emoji={workspace.icon} size={42} />
              </span>
              <button
                onClick={() => setIsEmojiPickerOpen(true)}
                className="opacity-0 group-hover:opacity-100 text-[11px] text-[var(--affine-text-secondary-color)] hover:text-[var(--affine-text-primary-color)] transition"
              >
                Cambiar icono
              </button>
            </div>
          ) : (
            <button
              onClick={() => setIsEmojiPickerOpen(true)}
              className="flex items-center gap-1.5 text-xs text-[var(--affine-text-secondary-color)] hover:text-[var(--affine-text-primary-color)] py-1 px-2 rounded-md hover:bg-[var(--affine-hover-color)] transition font-normal"
            >
              <SmileIcon className="w-3.5 h-3.5 text-[var(--affine-text-secondary-color)]" />
              <span>Add icon</span>
            </button>
          )}

          {/* Privacy & Sharing Badge Button */}
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={async () => {
                const nextPrivate = !workspace.isPrivate
                await db.workspaces.update(workspace.id, {
                  isPrivate: nextPrivate,
                  updatedAt: Date.now(),
                  syncStatus: 'pending'
                })
                syncEngine.scheduleSync(500)
                toast.success(nextPrivate ? 'Nota cambiada a MODO PRIVADO (Solo tú)' : 'Nota cambiada a MODO PÚBLICO (Todo el equipo)')
              }}
              className={`flex items-center gap-1.5 text-xs py-1 px-3 rounded-full transition font-semibold cursor-pointer active:scale-95 shadow-2xs ${
                workspace.isPrivate
                  ? 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30 hover:bg-amber-500/25'
                  : 'bg-blue-500/10 text-blue-700 dark:text-blue-300 border border-blue-500/20 hover:bg-blue-500/20'
              }`}
              title={workspace.isPrivate ? 'Nota privada (solo tú). Clic para hacerla pública para el equipo' : 'Nota pública para el equipo. Clic para hacerla privada'}
            >
              {workspace.isPrivate ? <Lock className="w-3.5 h-3.5 text-amber-500" /> : <Unlock className="w-3.5 h-3.5 text-blue-500" />}
              <span>{workspace.isPrivate ? 'Privada (Solo tú)' : 'Pública (Equipo)'}</span>
            </button>

            {/* Creator attribution pill */}
            {(workspace.ownerName || workspace.createdBy) && (
              <span className="flex items-center gap-1.5 text-[11px] py-0.5 px-2.5 rounded-full bg-black/[0.03] dark:bg-white/[0.05] border border-black/[0.05] dark:border-white/[0.08] text-neutral-500 dark:text-neutral-400 font-medium">
                <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                <span>Creado por: <strong className="text-neutral-700 dark:text-neutral-200">{workspace.ownerName || workspace.createdBy}</strong></span>
              </span>
            )}

            {workspace.isPublicShared && (
              <span className="flex items-center gap-1 text-[11px] py-0.5 px-2 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 font-medium">
                <Globe className="w-3 h-3" />
                <span>Enlace externo activo</span>
              </span>
            )}
          </div>

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
            <textarea
              ref={titleTextareaRef}
              rows={1}
              value={workspace.title === 'Untitled' ? '' : workspace.title}
              onChange={(e) => {
                if (readOnly) return
                const val = e.target.value
                onTitleChange?.(val || 'Untitled')
                e.target.style.height = 'auto'
                e.target.style.height = `${e.target.scrollHeight}px`
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  editor?.commands.focus('start')
                }
              }}
              readOnly={readOnly}
              placeholder="Title"
              className={`w-full text-4xl font-bold tracking-tight text-[var(--affine-text-primary-color)] placeholder:text-[var(--affine-placeholder-color)] bg-transparent border-none outline-none focus:outline-none resize-none overflow-hidden leading-tight break-words whitespace-pre-wrap block ${readOnly ? 'cursor-default' : ''}`}
              style={{ fieldSizing: 'content' }}
            />
          </div>

        {/* Collapsible: "Información" */}
        <div className="mb-8">
          <div
            onClick={handleToggleInfo}
            className="flex items-center gap-3 cursor-pointer group select-none"
          >
            <div className="flex items-center gap-1.5 text-[var(--affine-text-secondary-color)] group-hover:text-[var(--affine-text-primary-color)] transition">
              <span className="text-xs font-medium">Información</span>
              <span className="text-[var(--affine-text-secondary-color)] group-hover:text-[var(--affine-text-primary-color)]">
                {isInfoExpanded ? (
                  <ToggleDownIcon className="w-3.5 h-3.5" />
                ) : (
                  <ToggleRightIcon className="w-3.5 h-3.5" />
                )}
              </span>
            </div>
            <div className="flex-1 h-[1px] bg-[var(--affine-divider-color)]" />
          </div>

          {/* Collapsible Content */}
          {isInfoExpanded && (
            <div className="mt-3 p-3 rounded-xl bg-[var(--affine-background-secondary-color)] border border-[var(--affine-border-color)] text-xs text-[var(--affine-text-primary-color)] animate-in fade-in duration-100">
              <textarea
                value={infoText}
                onChange={(e) => handleInfoContentChange(e.target.value)}
                placeholder="Añade notas breves, contexto o resumen sobre este documento..."
                rows={3}
                className="w-full bg-transparent border-none outline-none text-[var(--affine-text-primary-color)] placeholder:text-[var(--affine-placeholder-color)] resize-none font-sans leading-relaxed"
              />
              <div className="flex items-center justify-between pt-2 border-t border-[var(--affine-divider-color)] text-[10px] text-[var(--affine-text-secondary-color)]">
                <span>Metadatos y resumen editable</span>
                <span>Guardado automático</span>
              </div>
            </div>
          )}
        </div>

        {/* Action Pills Row ("Iniciar", "Plantilla", "Sin bordes", Notion Tools) */}
        <div className="flex items-center gap-2 mb-6 flex-wrap select-none text-xs">
          <span className="text-[var(--affine-text-secondary-color)] font-medium mr-1">Iniciar</span>

          {/* Notion Tools Dropdown Pill (Exact UI from Notion screenshot) */}
          <div className="relative">
            <button
              onClick={() => setIsActionRowNotionMenuOpen(!isActionRowNotionMenuOpen)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[var(--affine-background-secondary-color)] hover:bg-[var(--affine-hover-color)] border border-[var(--affine-border-color)] text-[var(--affine-text-primary-color)] transition shadow-xs group cursor-pointer active:scale-95"
              title="Herramientas y vistas de Notion"
            >
              <NotionTableIcon className="w-3.5 h-3.5 text-blue-500 group-hover:scale-110 transition-transform" />
              <span className="font-medium">Vistas Notion</span>
              <ChevronDown className="w-3 h-3 text-[var(--affine-text-secondary-color)]" />
            </button>

            <NotionViewsDropdown
              isOpen={isActionRowNotionMenuOpen}
              onClose={() => setIsActionRowNotionMenuOpen(false)}
              onSelectView={handleActivateNotionView}
              currentView={databaseData?.activeView}
              className="absolute left-0 top-full mt-2"
            />
          </div>

          {/* Direct Quick Pills for each of the 6 Notion tools */}
          {NOTION_TOOLS.map((tool) => {
            const Icon = tool.Icon
            const isCurrent = databaseData?.enabled && databaseData?.activeView === tool.id
            return (
              <button
                key={tool.id}
                onClick={() => handleActivateNotionView(tool.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full transition shadow-xs cursor-pointer active:scale-95 ${
                  isCurrent
                    ? 'bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 font-semibold shadow-xs'
                    : 'bg-[var(--affine-background-secondary-color)] hover:bg-[var(--affine-hover-color)] border border-[var(--affine-border-color)] text-[var(--affine-text-primary-color)]'
                }`}
                title={`Activar vista ${tool.label} en este documento`}
              >
                <Icon className={isCurrent ? 'text-white dark:text-neutral-900' : 'text-blue-500'} size={14} />
                <span>{tool.label}</span>
              </button>
            )
          })}

          <div className="w-[1px] h-4 bg-black/[0.08] dark:bg-white/[0.1] mx-0.5" />

          {/* Pill: Plantilla */}
          <button
            onClick={onOpenTemplatesModal}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[var(--affine-background-secondary-color)] hover:bg-[var(--affine-hover-color)] border border-[var(--affine-border-color)] text-[var(--affine-text-primary-color)] transition shadow-xs cursor-pointer active:scale-95"
          >
            <span>Plantilla</span>
            <TemplateIcon className="w-3.5 h-3.5 text-amber-500" />
          </button>

          {/* Pill 3: Sin bordes (Canvas / Edgeless mode) */}
          <button
            onClick={onToggleViewMode}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[var(--affine-background-secondary-color)] hover:bg-[var(--affine-hover-color)] border border-[var(--affine-border-color)] text-[var(--affine-text-primary-color)] transition shadow-xs group cursor-pointer active:scale-95"
            title="Alternar entre modo Página y Modo Sin bordes (Lienzo infinito)"
          >
            <span>Sin bordes</span>
            <EdgelessIcon className="w-3.5 h-3.5 text-indigo-500 group-hover:scale-110 transition-transform" />
          </button>
        </div>

        {/* Interactive Notion Database Component Widget */}
        {databaseData?.enabled && (
          <NotionDatabaseView
            data={databaseData}
            onChange={handleSaveDatabaseData}
            onClose={() => {
              handleSaveDatabaseData({ ...databaseData, enabled: false })
              toast.info('Base de datos minimizada')
            }}
          />
        )}

        {/* TipTap WYSIWYG Document Editor */}
        <div className="min-h-[280px]">
          <EditorContent editor={editor} />
        </div>

        {/* Section: Bi-Directional Links */}
        <div className="mt-14 pt-6 border-t border-[var(--affine-divider-color)]">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-[var(--affine-text-primary-color)]">
                Bi-Directional Links
              </span>
              {backlinks.length > 0 && (
                <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-[#1e96eb]/15 border border-[#1e96eb]/40 text-[#1e96eb] font-semibold">
                  {backlinks.length}
                </span>
              )}
            </div>

            <div className="flex items-center gap-2">
              {showBiDirectional && (
                <button
                  onClick={() => setShowLinkSelector(!showLinkSelector)}
                  className="px-2.5 py-1 rounded-md bg-[var(--affine-background-secondary-color)] hover:bg-[var(--affine-hover-color)] text-[var(--affine-text-primary-color)] text-xs flex items-center gap-1 border border-[var(--affine-border-color)] transition"
                >
                  <PlusIcon className="w-3 h-3 text-[#1e96eb]" />
                  <span>Vincular nota</span>
                </button>
              )}
              <button
                onClick={handleToggleBiDirectional}
                className="px-3 py-1 rounded-md bg-[var(--affine-background-secondary-color)] hover:bg-[var(--affine-hover-color)] text-[var(--affine-text-primary-color)] text-xs font-medium border border-[var(--affine-border-color)] transition"
              >
                {showBiDirectional ? 'Ocultar' : 'Mostrar'}
              </button>
            </div>
          </div>

          {/* Bi-Directional Links expanded body */}
          {showBiDirectional && (
            <div className="space-y-3 animate-in fade-in duration-100">
              {showLinkSelector && (
                <div className="p-3 bg-[var(--affine-background-secondary-color)] border border-[var(--affine-border-color)] rounded-xl text-xs space-y-2 shadow-[var(--affine-popover-shadow)]">
                  <span className="text-[var(--affine-text-secondary-color)] font-medium block">
                    Selecciona una página para vincularla a este documento:
                  </span>
                  <div className="max-h-40 overflow-y-auto space-y-1">
                    {allWorkspaces
                      .filter((w) => w.id !== workspace.id && !w.isDeleted)
                      .map((ws) => (
                        <div
                          key={ws.id}
                          onClick={() => handleInsertLinkToNote(ws)}
                          className="flex items-center justify-between p-1.5 rounded hover:bg-[var(--affine-hover-color)] cursor-pointer text-[var(--affine-text-primary-color)] transition"
                        >
                          <div className="flex items-center gap-2">
                            <AppleEmoji emoji={ws.icon || '📄'} size={16} />
                            <span className="truncate">{renderWithAppleEmoji(ws.title || 'Untitled')}</span>
                          </div>
                          <span className="text-[10px] text-[#1e96eb]">Insertar enlace</span>
                        </div>
                      ))}
                  </div>
                </div>
              )}

              {backlinks.length === 0 ? (
                <div className="p-4 rounded-xl bg-[var(--affine-background-secondary-color)] border border-[var(--affine-border-color)] text-center text-xs text-[var(--affine-text-secondary-color)]">
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
                      className="p-3 rounded-xl bg-[var(--affine-background-secondary-color)] border border-[var(--affine-border-color)] hover:border-[#1e96eb] hover:bg-[var(--affine-hover-color)] cursor-pointer transition flex items-center justify-between group shadow-xs"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span className="shrink-0"><AppleEmoji emoji={linkWs.icon || '📄'} size={18} /></span>
                        <div className="min-w-0">
                          <p className="font-medium text-[var(--affine-text-primary-color)] group-hover:text-[#1e96eb] truncate text-xs">
                            {renderWithAppleEmoji(linkWs.title || 'Untitled')}
                          </p>
                          <p className="text-[10px] text-[var(--affine-text-secondary-color)]">Nota vinculada</p>
                        </div>
                      </div>
                      <OpenInNewIcon className="w-3.5 h-3.5 text-[var(--affine-text-secondary-color)] group-hover:text-[#1e96eb] shrink-0" />
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
