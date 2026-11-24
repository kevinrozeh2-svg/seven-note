import { useEffect, useRef, useState, useCallback, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { getEditorPreferences, subscribeEditorPreferences } from '../../lib/editorPreferences'
import { useTeamProfiles, resolveTeamProfile } from '../../lib/teamProfiles'
import { UserAvatar } from '../ui/UserAvatar'
import { useEditor, EditorContent } from '@tiptap/react'
import { Extension, Mark, mergeAttributes } from '@tiptap/core'
import StarterKit from '@tiptap/starter-kit'
import TaskList from '@tiptap/extension-task-list'
import TaskItem from '@tiptap/extension-task-item'
import Placeholder from '@tiptap/extension-placeholder'
import Underline from '@tiptap/extension-underline'
import Link from '@tiptap/extension-link'
import { RichImage } from './RichImageExtension'
import { MathBlock, MathInline } from './MathExtensions'
import { NoteLinkCard, NoteMention, NoteLinkContext } from './NoteLinkExtensions'
import {
  computeBidirectionalLinks,
  extractSnippetFromHtml,
  buildWholeWordTitleRegex,
  type BidirectionalLinkItem,
  type UnlinkedMentionItem,
  type LinkRelation
} from '../../lib/bidirectionalLinks'
import { FloatingSelectionMenu } from './FloatingSelectionMenu'
import TextAlign from '@tiptap/extension-text-align'
import { processAndUploadImage } from '../../lib/imageOptimizer'
import { DOMParser as PMDOMParser } from '@tiptap/pm/model'
import {
  cleanPastedHtml,
  cleanPastedText,
  prepareClipboardPaste,
  sanitizeHtmlContent
} from '../../lib/pasteUtils'
import {
  isNeutralTextColor,
  isNeutralBackgroundColor,
  parseCssLengthPx
} from '../../lib/pasteCssUtils'
import { Table } from '@tiptap/extension-table'
import { TableRow } from '@tiptap/extension-table-row'
import { TableHeader } from '@tiptap/extension-table-header'
import { TableCell } from '@tiptap/extension-table-cell'
import { CodeBlockLowlight } from '@tiptap/extension-code-block-lowlight'
import { common, createLowlight } from 'lowlight'
import { toast } from '../../lib/toast'
import confetti from 'canvas-confetti'
import {
  Lock,
  Unlock,
  Globe,
  ChevronDown,
  Maximize2,
  Minimize2,
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignJustify,
  Palette,
  Edit3,
  Trash2,
  Smile
} from 'lucide-react'
import { CoverPickerPopover, type CoverConfig } from './CoverPickerPopover'
import { NoteIconPickerModal, renderNoteIcon } from './NoteIconPickerModal'
import {
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
  ImageIcon,
  LinkIcon,
  PageIcon,
  CopyIcon
} from '@blocksuite/icons/rc'
import {
  db,
  type WorkspaceItem,
  type SpaceItem,
  DEFAULT_SPACE_ID,
  type NotionDatabaseData,
  type NotionDatabaseViewType,
  getSafeTimestamp
} from '../../db'
import { syncEngine } from '../../lib/syncEngine'
import { EmojiPickerPopover } from '../modals/EmojiPickerPopover'
import { AppleEmoji, renderWithAppleEmoji } from '../ui/AppleEmoji'
import { AppleEmojiExtension } from './AppleEmojiExtension'
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
  spaces?: SpaceItem[]
  onSelectWorkspace?: (id: string) => void
  onTitleChange?: (newTitle: string) => void
  onToggleViewMode?: () => void
  onOpenTemplatesModal?: () => void
  readOnly?: boolean
  hideChrome?: boolean
}

// Custom Marks to preserve styles (color, highlight, sub, sup, indentation) during paste & editing
const TextStyle = Mark.create({
  name: 'textStyle',
  addOptions() {
    return {
      HTMLAttributes: {}
    }
  },
  parseHTML() {
    return []
  },
  renderHTML({ HTMLAttributes }) {
    return ['span', mergeAttributes(this.options.HTMLAttributes, HTMLAttributes), 0]
  }
})

const TEXT_COLOR_PALETTE = [
  { id: 'slate', label: 'Gris', hex: '#71717a' },
  { id: 'red', label: 'Rojo', hex: '#ef4444' },
  { id: 'orange', label: 'Naranja', hex: '#f97316' },
  { id: 'amber', label: 'Ámbar', hex: '#eab308' },
  { id: 'green', label: 'Verde', hex: '#22c55e' },
  { id: 'teal', label: 'Turquesa', hex: '#14b8a6' },
  { id: 'blue', label: 'Azul', hex: '#3b82f6' },
  { id: 'indigo', label: 'Índigo', hex: '#6366f1' },
  { id: 'purple', label: 'Morado', hex: '#a855f7' },
  { id: 'pink', label: 'Rosa', hex: '#ec4899' }
] as const

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
        parseHTML: (element) => {
          const isUserColor = element.hasAttribute('data-user-color')
          const color = element.style.color || element.getAttribute('color')
          if (!color) return null
          return isUserColor || !isNeutralTextColor(color) ? color : null
        },
        renderHTML: (attributes) => {
          if (!attributes.color) return {}
          return {
            style: `color: ${attributes.color}`,
            'data-user-color': 'true'
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
          const el = element as HTMLElement
          const color = el.style.color
          if (!color) return false
          return el.hasAttribute('data-user-color') || !isNeutralTextColor(color) ? { color } : false
        }
      },
      {
        tag: 'font[color]',
        getAttrs: (element) => {
          const el = element as HTMLElement
          const color = el.getAttribute('color')
          if (!color) return false
          return el.hasAttribute('data-user-color') || !isNeutralTextColor(color) ? { color } : false
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
          return bg && !isNeutralBackgroundColor(bg) ? bg : null
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
          const rawBg = (element as HTMLElement).style.backgroundColor || (element as HTMLElement).style.background
          const bg = rawBg && !isNeutralBackgroundColor(rawBg) ? rawBg : null
          return { color: bg }
        }
      },
      {
        tag: 'span[style*=background]',
        getAttrs: (element) => {
          const rawBg = (element as HTMLElement).style.backgroundColor || (element as HTMLElement).style.background
          return rawBg && !isNeutralBackgroundColor(rawBg) ? { color: rawBg } : false
        }
      }
    ]
  },
  renderHTML({ HTMLAttributes }) {
    return ['mark', mergeAttributes(this.options.HTMLAttributes, HTMLAttributes), 0]
  }
})

const BlockLayout = Extension.create({
  name: 'blockLayout',
  addGlobalAttributes() {
    return [
      {
        types: ['paragraph', 'heading', 'blockquote'],
        attributes: {
          indent: {
            default: 0,
            parseHTML: (element) => {
              const ml = parseCssLengthPx(element.style.marginLeft)
              const pl = parseCssLengthPx(element.style.paddingLeft)
              const total = (ml ?? 0) + (pl ?? 0)
              if (total < 14) return 0
              return Math.min(6, Math.max(1, Math.round(total / 24)))
            },
            renderHTML: (attributes) => {
              const level = Number(attributes.indent || 0)
              if (!level || level <= 0) return {}
              const capped = Math.min(6, Math.max(1, Math.round(level)))
              return { style: `margin-left: ${capped * 1.5}rem` }
            }
          },
          textIndent: {
            default: false,
            parseHTML: (element) => {
              const ti = parseCssLengthPx(element.style.textIndent)
              return ti !== null && ti >= 10
            },
            renderHTML: (attributes) => {
              if (!attributes.textIndent) return {}
              return { style: 'text-indent: 1.5em' }
            }
          }
        }
      }
    ]
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

interface HoverPopoverData {
  note: WorkspaceItem
  spaceName: string
  spaceIcon: string
  snippet: string
  top: number
  left: number
  width: number
}

export function DocEditor({
  workspace,
  allWorkspaces = [],
  spaces = [],
  onSelectWorkspace,
  onTitleChange,
  readOnly = false,
  hideChrome = false
}: DocEditorProps) {
  const teamProfiles = useTeamProfiles()
  const hideEditControls = readOnly || hideChrome
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving'>('saved')
  const [isIconModalOpen, setIsIconModalOpen] = useState(false)
  const [isCoverPickerOpen, setIsCoverPickerOpen] = useState(false)
  const [coverImgError, setCoverImgError] = useState(false)
  const [isEditingBannerText, setIsEditingBannerText] = useState(false)
  const [tempBannerTitle, setTempBannerTitle] = useState(workspace.coverBannerTitle || 'PROJECTS &')
  const [tempBannerSubtitle, setTempBannerSubtitle] = useState(workspace.coverBannerSubtitle || 'SUB-PROJECTS')

  useEffect(() => {
    setCoverImgError(false)
  }, [workspace.coverUrl, workspace.coverType])

  useEffect(() => {
    setTempBannerTitle(workspace.coverBannerTitle || 'PROJECTS &')
    setTempBannerSubtitle(workspace.coverBannerSubtitle || 'SUB-PROJECTS')
  }, [workspace.coverBannerTitle, workspace.coverBannerSubtitle])
  const [isBodyEmojiPickerOpen, setIsBodyEmojiPickerOpen] = useState(false)
  const [isInfoExpanded, setIsInfoExpanded] = useState(workspace.isInformationOpen ?? false)
  const [infoText, setInfoText] = useState(workspace.informationContent || '')
  const [liveDocHtml, setLiveDocHtml] = useState<string>(workspace.docContent || '')
  const [showBiDirectional, setShowBiDirectional] = useState<boolean>(
    workspace.biDirectionalLinksVisible ?? true
  )
  const [biDirectionalExplicitlySet, setBiDirectionalExplicitlySet] = useState<boolean>(
    typeof workspace.biDirectionalLinksVisible === 'boolean'
  )
  const [linkFilter, setLinkFilter] = useState<'all' | LinkRelation>('all')
  const [showUnlinkedMentions, setShowUnlinkedMentions] = useState(false)
  const [showLinkSelector, setShowLinkSelector] = useState(false)
  const [linkSearchQuery, setLinkSearchQuery] = useState('')

  // Inline [[wikilink]] autocomplete state
  const [wikiMenuOpen, setWikiMenuOpen] = useState(false)
  const [wikiQuery, setWikiQuery] = useState('')
  const [wikiMenuPos, setWikiMenuPos] = useState<{ x: number; y: number } | null>(null)
  const [wikiRange, setWikiRange] = useState<{ from: number; to: number } | null>(null)
  const [selectedWikiIdx, setSelectedWikiIdx] = useState(0)
  const wikiStateRef = useRef<{
    open: boolean
    range: { from: number; to: number } | null
    selectedIdx: number
    items: WorkspaceItem[]
  }>({ open: false, range: null, selectedIdx: 0, items: [] })

  // Hover Popover preview state
  const [hoverPopoverData, setHoverPopoverData] = useState<HoverPopoverData | null>(null)
  const closeTimerRef = useRef<any>(null)

  // Slash Menu state
  const [slashMenuOpen, setSlashMenuOpen] = useState(false)
  const [slashFilter, setSlashFilter] = useState('')
  const [slashMenuPos, setSlashMenuPos] = useState<{ x: number; y: number } | null>(null)
  const [selectedSlashIdx, setSelectedSlashIdx] = useState(0)

  // Text color picker popover state
  const [textColorMenuAnchor, setTextColorMenuAnchor] = useState<'toolbar' | 'floating' | null>(null)
  const [textColorPopoverPos, setTextColorPopoverPos] = useState<{ top: number; left: number } | null>(null)
  const toolbarColorBtnRef = useRef<HTMLButtonElement | null>(null)
  const floatingColorBtnRef = useRef<HTMLButtonElement | null>(null)
  const textColorPopoverRef = useRef<HTMLDivElement | null>(null)

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

  const isFirstRender = useRef(true)
  const saveTimeoutRef = useRef<any>(null)
  const pendingSaveRef = useRef<{ workspaceId: string; html: string } | null>(null)
  const currentWorkspaceIdRef = useRef(workspace.id)
  currentWorkspaceIdRef.current = workspace.id
  const editorImageInputRef = useRef<HTMLInputElement>(null)
  const titleTextareaRef = useRef<HTMLTextAreaElement>(null)
  const notionButtonRef = useRef<HTMLButtonElement>(null)

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
      toast.success('Foto(s) insertadas — haz clic en la foto para cambiar aspecto, quitar fondo o editar', { id: toastId })
    } catch (err: any) {
      toast.error('Error insertando fotos: ' + (err?.message || 'Error'), { id: toastId })
    }
  }

  const editorRef = useRef<any>(null)

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
      RichImage.configure({
        allowBase64: true
      }),
      MathBlock,
      MathInline,
      NoteLinkCard,
      NoteMention,
      AppleEmojiExtension,
      TextAlign.configure({
        types: ['heading', 'paragraph', 'blockquote'],
        alignments: ['left', 'center', 'right', 'justify'],
        defaultAlignment: 'left'
      }),
      BlockLayout,
      Placeholder.configure({
        placeholder: 'Escribe algo o pulsa "/" para insertar bloques de AFFiNE...'
      })
    ],
    content: workspace.docContent || '<p></p>',
    editorProps: {
      attributes: {
        class:
          'max-w-none focus:outline-none min-h-[350px] text-[var(--app-text-primary)] font-sans leading-relaxed text-sm selection:bg-blue-600/30',
        spellcheck: 'false'
      },
      transformPastedHTML: (html) => {
        if (html.includes('data-pm-slice')) return html
        return cleanPastedHtml(html)
      },
      transformPastedText: (text) => {
        return cleanPastedText(text)
      },
      handlePaste: (view, event) => {
        const html = event.clipboardData?.getData('text/html')
        const text = event.clipboardData?.getData('text/plain')

        // Inside a code block, preserve exact raw indentation & spacing as plain text
        if (view.state.selection.$from.parent.type.name === 'codeBlock') {
          if (text) {
            const rawCode = text.replace(/\r\n?/g, '\n').replace(/\u00A0/g, ' ')
            view.dispatch(view.state.tr.insertText(rawCode))
            return true
          }
          return false
        }

        const prepared = prepareClipboardPaste(html || '', text || '')

        // 1. Internal Seven Note / ProseMirror copy-paste -> handle natively untouched
        if (prepared.kind === 'internal') {
          return false
        }

        // 1b. Standalone ASCII / Unicode box-drawing diagram -> insert as plaintext codeBlock
        // directly so every space, arrow, and box character keeps exact monospace alignment
        if (prepared.kind === 'diagram' && prepared.text) {
          const targetEditor = editorRef.current || editor
          if (targetEditor) {
            targetEditor
              .chain()
              .focus()
              .insertContent({
                type: 'codeBlock',
                attrs: { language: 'plaintext' },
                content: [{ type: 'text', text: prepared.text }]
              })
              .run()
          } else {
            const codeBlockType = view.state.schema.nodes.codeBlock
            if (codeBlockType) {
              const node = codeBlockType.create(
                { language: 'plaintext' },
                view.state.schema.text(prepared.text)
              )
              view.dispatch(view.state.tr.replaceSelectionWith(node))
            }
          }
          toast.success('Diagrama pegado conservando alineación')
          return true
        }

        // 1c. Standalone LaTeX math formula ($$...$$ or \[...\]) -> insert formatted KaTeX mathBlock
        if (prepared.kind === 'math' && prepared.text) {
          const targetEditor = editorRef.current || editor
          if (targetEditor) {
            targetEditor
              .chain()
              .focus()
              .insertContent([
                { type: 'mathBlock', attrs: { latex: prepared.text } },
                { type: 'paragraph' }
              ])
              .run()
          } else {
            const mathBlockType = view.state.schema.nodes.mathBlock
            if (mathBlockType) {
              const node = mathBlockType.create({ latex: prepared.text })
              view.dispatch(view.state.tr.replaceSelectionWith(node))
            }
          }
          toast.success('Fórmula matemática pegada con formato')
          return true
        }

        // 2. PDF paste (browser PDF viewer, Acrobat, Preview, Foxit, etc.)
        if (prepared.kind === 'pdf' && prepared.html && prepared.html.trim()) {
          const targetEditor = editorRef.current || editor
          if (targetEditor) {
            targetEditor.commands.insertContent(prepared.html, {
              parseOptions: { preserveWhitespace: false }
            })
          } else {
            const parsedDoc = new DOMParser().parseFromString(sanitizeHtmlContent(prepared.html), 'text/html')
            const slice = PMDOMParser.fromSchema(view.state.schema).parseSlice(parsedDoc.body, {
              preserveWhitespace: false
            })
            const tr = view.state.tr.replaceSelection(slice)
            view.dispatch(tr)
          }
          toast.success('Texto de PDF pegado conservando formato')
          return true
        }

        // 3. Rich HTML (Word, Google Docs, Notion, web) -> let ProseMirror parse transformPastedHTML cleanly
        if (prepared.kind === 'rich-html') {
          return false
        }

        // 4. Plain text wrapped in trivial HTML <span> -> preserve explicit line breaks instead of collapsing HTML newlines
        if (prepared.kind === 'plain-text' && html && prepared.text.includes('\n')) {
          const lineHtml = prepared.text
            .split('\n')
            .map((line) => {
              const trimmedLine = line.trim()
              if (!trimmedLine) return '<p></p>'
              const safe = line
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
              return `<p>${safe}</p>`
            })
            .join('')
          const targetEditor = editorRef.current || editor
          if (targetEditor) {
            targetEditor.commands.insertContent(lineHtml, {
              parseOptions: { preserveWhitespace: false }
            })
            return true
          }
        }

        // If the clipboard contains HTML or plain text, allow ProseMirror to handle paste
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
        // Handle inline [[wikilink]] autocomplete navigation
        const wikiState = wikiStateRef.current
        if (wikiState.open) {
          if (event.key === 'Escape') {
            event.preventDefault()
            setWikiMenuOpen(false)
            return true
          }
          if (wikiState.items.length > 0) {
            if (event.key === 'ArrowDown') {
              event.preventDefault()
              setSelectedWikiIdx((prev) => (prev + 1) % wikiState.items.length)
              return true
            }
            if (event.key === 'ArrowUp') {
              event.preventDefault()
              setSelectedWikiIdx((prev) => (prev - 1 + wikiState.items.length) % wikiState.items.length)
              return true
            }
            if (event.key === 'Enter' || event.key === 'Tab') {
              event.preventDefault()
              const chosen = wikiState.items[wikiState.selectedIdx] || wikiState.items[0]
              if (chosen && wikiState.range && editorRef.current) {
                editorRef.current
                  .chain()
                  .focus()
                  .deleteRange(wikiState.range)
                  .insertContent([
                    {
                      type: 'noteMention',
                      attrs: {
                        noteId: chosen.id,
                        noteTitle: chosen.title || 'Untitled'
                      }
                    },
                    { type: 'text', text: ' ' }
                  ])
                  .run()
                setWikiMenuOpen(false)
                setWikiQuery('')
                setWikiRange(null)
              }
              return true
            }
          }
        }

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
          const rawId = noteCard.getAttribute('data-note-id')
          const noteId = rawId ? decodeURIComponent(rawId) : null
          if (noteId && onSelectWorkspace) {
            event.preventDefault()
            setHoverPopoverData(null)
            onSelectWorkspace(noteId)
            return true
          }
        }
        const link = target.closest('a')
        if (link) {
          const href = link.getAttribute('href')
          if (href?.startsWith('#note=')) {
            const rawId = href.slice('#note='.length).split('&')[0]
            const noteId = rawId ? decodeURIComponent(rawId) : null
            if (noteId && onSelectWorkspace) {
              event.preventDefault()
              setHoverPopoverData(null)
              onSelectWorkspace(noteId)
              return true
            }
          }
        }
        return false
      }
    },
    onUpdate: ({ editor }) => {
      setSaveStatus('saving')
      const html = editor.getHTML()
      setLiveDocHtml(html)

      // Detect inline [[wikilink trigger before cursor
      if (!readOnly) {
        const { from, empty } = editor.state.selection
        const resolved = editor.state.doc.resolve(from)
        const inCodeBlock = resolved.parent.type.name === 'codeBlock'
        if (empty && !inCodeBlock) {
          const textBefore = editor.state.doc.textBetween(resolved.start(), from, '\n', '\0')
          const wikiMatch = /\[\[([^[\]\n]{0,60})$/.exec(textBefore)
          if (wikiMatch) {
            const coords = editor.view.coordsAtPos(from)
            const menuWidth = 300
            const menuHeight = 260
            const x = Math.max(12, Math.min(window.innerWidth - menuWidth - 12, coords.left))
            const y =
              coords.bottom + menuHeight + 12 > window.innerHeight
                ? Math.max(12, coords.top - menuHeight - 8)
                : coords.bottom + 8
            setWikiMenuOpen(true)
            setWikiQuery(wikiMatch[1])
            setWikiRange({ from: from - wikiMatch[0].length, to: from })
            setWikiMenuPos({ x, y })
            setSelectedWikiIdx(0)
          } else {
            setWikiMenuOpen(false)
            setWikiRange(null)
          }
        } else {
          setWikiMenuOpen(false)
          setWikiRange(null)
        }
      }

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
      const targetWsId = workspace.id
      pendingSaveRef.current = { workspaceId: targetWsId, html }
      saveTimeoutRef.current = setTimeout(async () => {
        saveTimeoutRef.current = null
        const pending = pendingSaveRef.current
        if (!pending || pending.workspaceId !== targetWsId) return
        pendingSaveRef.current = null
        try {
          await db.workspaces.update(targetWsId, {
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

  editorRef.current = editor

  const activeTextColor = (editor?.getAttributes('color')?.color as string | undefined) || null

  const toggleTextColorMenu = useCallback(
    (anchor: 'toolbar' | 'floating') => {
      if (textColorMenuAnchor === anchor) {
        setTextColorMenuAnchor(null)
        return
      }
      const btn = anchor === 'toolbar' ? toolbarColorBtnRef.current : floatingColorBtnRef.current
      if (!btn || typeof window === 'undefined') return
      const rect = btn.getBoundingClientRect()
      const popoverWidth = 216
      const popoverHeight = 164
      const left = Math.max(12, Math.min(window.innerWidth - popoverWidth - 12, rect.left))
      const top =
        rect.bottom + popoverHeight + 12 > window.innerHeight
          ? Math.max(12, rect.top - popoverHeight - 8)
          : rect.bottom + 8
      setTextColorPopoverPos({ top, left })
      setTextColorMenuAnchor(anchor)
    },
    [textColorMenuAnchor]
  )

  const applyTextColor = useCallback(
    (hex: string) => {
      if (!editor) return
      editor.chain().focus().setMark('color', { color: hex }).run()
      setTextColorMenuAnchor(null)
    },
    [editor]
  )

  const resetTextColor = useCallback(() => {
    if (!editor) return
    editor.chain().focus().unsetMark('color').run()
    setTextColorMenuAnchor(null)
  }, [editor])

  useEffect(() => {
    if (!textColorMenuAnchor) return
    const handlePointerDown = (e: MouseEvent) => {
      const target = e.target as Node
      if (
        textColorPopoverRef.current?.contains(target) ||
        toolbarColorBtnRef.current?.contains(target) ||
        floatingColorBtnRef.current?.contains(target)
      ) {
        return
      }
      setTextColorMenuAnchor(null)
    }
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setTextColorMenuAnchor(null)
    }
    document.addEventListener('mousedown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('mousedown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [textColorMenuAnchor])

  // Flush any pending debounced content save on unmount or page hide so rapid navigation never loses edits
  useEffect(() => {
    const flushPendingSave = () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current)
        saveTimeoutRef.current = null
      }
      const pending = pendingSaveRef.current
      if (pending) {
        pendingSaveRef.current = null
        void db.workspaces
          .update(pending.workspaceId, {
            docContent: pending.html,
            updatedAt: Date.now(),
            syncStatus: 'pending'
          })
          .then(() => syncEngine.scheduleSync(500))
          .catch(() => {})
      }
    }
    window.addEventListener('beforeunload', flushPendingSave)
    return () => {
      window.removeEventListener('beforeunload', flushPendingSave)
      flushPendingSave()
    }
  }, [workspace.id])

  // Synchronize editor content when workspace changes
  useEffect(() => {
    if (editor && !isFirstRender.current) {
      // No sobrescribir ediciones locales pendientes de guardar mientras el usuario sigue escribiendo
      const hasUnsavedForCurrent = pendingSaveRef.current?.workspaceId === workspace.id
      if (!hasUnsavedForCurrent && editor.getHTML() !== workspace.docContent) {
        editor.commands.setContent(workspace.docContent || '<p></p>', { emitUpdate: false })
        setLiveDocHtml(workspace.docContent || '')
      }
      setInfoText(workspace.informationContent || '')
      setIsInfoExpanded(workspace.isInformationOpen ?? false)
      const hasExplicitToggle = typeof workspace.biDirectionalLinksVisible === 'boolean'
      setBiDirectionalExplicitlySet(hasExplicitToggle)
      setShowBiDirectional(hasExplicitToggle ? Boolean(workspace.biDirectionalLinksVisible) : true)
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

  // Clear ephemeral popovers & filters when switching documents
  useEffect(() => {
    setHoverPopoverData(null)
    setWikiMenuOpen(false)
    setWikiQuery('')
    setWikiRange(null)
    setShowLinkSelector(false)
    setLinkSearchQuery('')
    setLinkFilter('all')
  }, [workspace.id])

  useEffect(() => {
    if (editor) {
      editor.setEditable(!readOnly)
    }
  }, [editor, readOnly])

  useEffect(() => {
    if (!editor) return
    const applySpell = (enabled: boolean) => {
      if (editor.view?.dom) {
        editor.view.dom.spellcheck = enabled
      }
    }
    applySpell(getEditorPreferences().spellCheck)
    return subscribeEditorPreferences((prefs) => applySpell(prefs.spellCheck))
  }, [editor])

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

  // Cover handlers
  const handleSelectCover = async (config: CoverConfig) => {
    await db.workspaces.update(workspace.id, {
      hasCover: config.hasCover,
      coverType: config.coverType,
      coverUrl: config.coverUrl,
      coverColor: config.coverColor,
      coverBannerTitle: config.coverBannerTitle,
      coverBannerSubtitle: config.coverBannerSubtitle,
      coverBannerStyle: config.coverBannerStyle,
      coverPosition: config.coverPosition,
      updatedAt: getSafeTimestamp(workspace.updatedAt),
      syncStatus: 'pending'
    })
    syncEngine.scheduleSync(50)
  }

  const handleRemoveCover = async () => {
    try {
      await db.workspaces.update(workspace.id, {
        hasCover: false,
        coverUrl: undefined,
        coverColor: undefined,
        coverBannerTitle: undefined,
        coverBannerSubtitle: undefined,
        updatedAt: getSafeTimestamp(workspace.updatedAt),
        syncStatus: 'pending'
      })
      syncEngine.scheduleSync(50)
      toast.info('Portada eliminada')
    } catch (err) {
      console.error('Error removing cover', err)
      toast.error('No se pudo eliminar la portada')
    }
  }

  const handleAddDefaultCover = async () => {
    try {
      await db.workspaces.update(workspace.id, {
        hasCover: true,
        coverType: 'bannerText',
        coverBannerTitle: 'PROJECTS &',
        coverBannerSubtitle: 'SUB-PROJECTS',
        coverColor: '#ffffff',
        coverBannerStyle: 'minimal-light',
        updatedAt: getSafeTimestamp(workspace.updatedAt),
        syncStatus: 'pending'
      })
      syncEngine.scheduleSync(50)
      toast.success('Portada añadida (Estilo Proyectos)')
    } catch (err) {
      console.error('Error adding default cover', err)
      toast.error('No se pudo añadir la portada')
    }
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
    syncEngine.scheduleSync(1000)
  }

  // Update info content
  const handleInfoContentChange = async (newText: string) => {
    setInfoText(newText)
    await db.workspaces.update(workspace.id, {
      informationContent: newText,
      updatedAt: Date.now(),
      syncStatus: 'pending'
    })
    syncEngine.scheduleSync(1500)
  }

  // Toggle Bi-Directional links visibility
  const handleToggleBiDirectional = async () => {
    const currentlyVisible = biDirectionalExplicitlySet
      ? showBiDirectional
      : bidirectionalLinks.length > 0 || unlinkedMentions.length > 0
    const nextVal = !currentlyVisible
    setBiDirectionalExplicitlySet(true)
    setShowBiDirectional(nextVal)
    await db.workspaces.update(workspace.id, {
      biDirectionalLinksVisible: nextVal,
      updatedAt: Date.now(),
      syncStatus: 'pending'
    })
    syncEngine.scheduleSync(1000)
  }

  // Bidirectional links & unlinked mentions computed live from current editor HTML + all visible workspaces
  const {
    links: bidirectionalLinks,
    unlinkedMentions,
    outgoingIds
  } = useMemo(
    () => computeBidirectionalLinks(workspace, liveDocHtml, allWorkspaces, spaces),
    [workspace, liveDocHtml, allWorkspaces, spaces]
  )

  const isBiDirectionalExpanded = biDirectionalExplicitlySet
    ? showBiDirectional
    : bidirectionalLinks.length > 0 || unlinkedMentions.length > 0

  const filteredBidirectionalLinks = useMemo(() => {
    if (linkFilter === 'all') return bidirectionalLinks
    return bidirectionalLinks.filter((item) => item.relation === linkFilter)
  }, [bidirectionalLinks, linkFilter])

  const relationCounts = useMemo(() => {
    let bidirectional = 0
    let incoming = 0
    let outgoing = 0
    for (const item of bidirectionalLinks) {
      if (item.relation === 'bidirectional') bidirectional++
      else if (item.relation === 'incoming') incoming++
      else outgoing++
    }
    return { bidirectional, incoming, outgoing }
  }, [bidirectionalLinks])

  // Candidates for inline [[wikilink]] autocomplete
  const wikiCandidates = useMemo(() => {
    const q = wikiQuery.trim().toLowerCase()
    return allWorkspaces
      .filter((w) => w.id !== workspace.id && !w.isDeleted)
      .filter((w) => {
        if (!q) return true
        const sp = spaces.find((s) => s.id === (w.spaceId || DEFAULT_SPACE_ID))
        return (
          (w.title || '').toLowerCase().includes(q) ||
          (sp?.name || '').toLowerCase().includes(q)
        )
      })
      .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0))
      .slice(0, 8)
  }, [allWorkspaces, workspace.id, wikiQuery, spaces])

  // Keep synchronous ref for ProseMirror handleKeyDown
  wikiStateRef.current = {
    open: wikiMenuOpen,
    range: wikiRange,
    selectedIdx: selectedWikiIdx,
    items: wikiCandidates
  }

  // Insert a real TipTap NoteLinkCard (block) or NoteMention (inline)
  const handleInsertLinkToNote = useCallback(
    (targetNote: WorkspaceItem, mode: 'card' | 'inline' = 'card', replaceRange?: { from: number; to: number } | null) => {
      if (!editor || readOnly) return
      const noteTitle = targetNote.title || 'Untitled'

      if (mode === 'inline') {
        const chain = editor.chain().focus()
        if (replaceRange) {
          chain.deleteRange(replaceRange)
        }
        chain
          .insertContent([
            {
              type: 'noteMention',
              attrs: { noteId: targetNote.id, noteTitle }
            },
            { type: 'text', text: ' ' }
          ])
          .run()
        toast.success(`Enlace a "${noteTitle}" insertado`)
      } else {
        const chain = editor.chain().focus()
        if (replaceRange) {
          chain.deleteRange(replaceRange)
        }
        chain
          .insertContent([
            {
              type: 'noteLinkCard',
              attrs: { noteId: targetNote.id, noteTitle }
            },
            { type: 'paragraph' }
          ])
          .run()
        toast.success(`Tarjeta vinculada a "${noteTitle}" insertada`)
      }

      setShowLinkSelector(false)
      setLinkSearchQuery('')
      setWikiMenuOpen(false)
      setWikiQuery('')
      setWikiRange(null)
    },
    [editor, readOnly]
  )

  // Convert an unlinked plain-text mention in another note into an explicit bidirectional link
  const handleConvertUnlinkedMention = useCallback(
    async (item: UnlinkedMentionItem) => {
      if (readOnly) return
      const targetTitle = (workspace.title || '').trim()
      if (!targetTitle) return

      const sourceHtml = item.workspace.docContent || ''
      const encodedId = encodeURIComponent(workspace.id)
      const safeTitleAttr = escapeHtml(targetTitle)
      const mentionHtml = `<a data-type="note-mention" data-note-id="${encodedId}" data-note-title="${safeTitleAttr}" href="#note=${encodedId}" class="seven-note-mention">${safeTitleAttr}</a>`

      // Replace the first matching plain-text occurrence inside text nodes (not inside HTML tags)
      let replaced = false
      const regex = buildWholeWordTitleRegex(targetTitle)
      const doc = new DOMParser().parseFromString(sourceHtml, 'text/html')
      const walker = doc.createTreeWalker(doc.body, NodeFilter.SHOW_TEXT)
      let currentNode: Node | null = walker.nextNode()
      while (currentNode && !replaced) {
        const parentEl = currentNode.parentElement
        const insideLink = parentEl?.closest('a, [data-note-id], [data-type="note-mention"], [data-type="note-link-card"], code, pre')
        if (!insideLink && currentNode.nodeValue) {
          const match = regex.exec(currentNode.nodeValue)
          if (match) {
            const before = currentNode.nodeValue.slice(0, match.index)
            const after = currentNode.nodeValue.slice(match.index + match[0].length)
            const fragment = doc.createDocumentFragment()
            if (before) fragment.appendChild(doc.createTextNode(before))
            const wrapper = doc.createElement('span')
            wrapper.innerHTML = mentionHtml
            if (wrapper.firstChild) fragment.appendChild(wrapper.firstChild)
            if (after) fragment.appendChild(doc.createTextNode(after))
            currentNode.parentNode?.replaceChild(fragment, currentNode)
            replaced = true
          }
        }
        currentNode = walker.nextNode()
      }

      const nextHtml = replaced
        ? doc.body.innerHTML
        : `${sourceHtml}<p>${mentionHtml}</p>`

      try {
        await db.workspaces.update(item.workspace.id, {
          docContent: nextHtml,
          updatedAt: Date.now(),
          syncStatus: 'pending'
        })
        syncEngine.scheduleSync(1000)
        toast.success(`Mención en "${item.workspace.title || 'Untitled'}" convertida en enlace bidireccional`)
      } catch (err) {
        console.error('Error converting unlinked mention', err)
        toast.error('No se pudo vincular la mención')
      }
    },
    [readOnly, workspace.id, workspace.title]
  )

  // Handle mouse hover over any note link or preview card to show actionable preview popover
  const handleContainerMouseOver = useCallback((e: React.MouseEvent) => {
    const target = e.target as HTMLElement | null
    if (!target) return

    // If hovering inside the popover itself, keep it open
    if (target.closest('.seven-note-hover-popover')) {
      if (closeTimerRef.current) {
        clearTimeout(closeTimerRef.current)
        closeTimerRef.current = null
      }
      return
    }

    // Check if hovering over a note card, link, or backlink item
    const noteEl = target.closest('[data-note-id], a[href^="#note="], [data-backlink-id]') as HTMLElement | null
    if (!noteEl) {
      if (!closeTimerRef.current && hoverPopoverData) {
        closeTimerRef.current = setTimeout(() => {
          setHoverPopoverData(null)
        }, 220)
      }
      return
    }

    let rawId = noteEl.getAttribute('data-note-id') || noteEl.getAttribute('data-backlink-id')
    if (!rawId && noteEl.tagName.toLowerCase() === 'a') {
      const href = noteEl.getAttribute('href')
      if (href?.startsWith('#note=')) {
        rawId = href.replace('#note=', '')
      }
    }
    const noteId = rawId ? decodeURIComponent(rawId) : null
    if (!noteId) return

    if (closeTimerRef.current) {
      clearTimeout(closeTimerRef.current)
      closeTimerRef.current = null
    }

    if (hoverPopoverData?.note.id === noteId) return

    const targetNote = allWorkspaces.find((w) => w.id === noteId)
    if (!targetNote) return

    const targetSpace = spaces.find((s) => s.id === (targetNote.spaceId || DEFAULT_SPACE_ID))
    const rect = noteEl.getBoundingClientRect()
    const popoverWidth = 320
    const popoverHeight = 185

    const spaceAbove = rect.top
    const placeAbove = spaceAbove >= popoverHeight + 12

    let top = placeAbove ? rect.top - popoverHeight - 8 : rect.bottom + 8
    if (top < 8) top = 8
    if (top + popoverHeight > window.innerHeight - 8) {
      top = window.innerHeight - popoverHeight - 8
    }

    let left = rect.left + rect.width / 2 - popoverWidth / 2
    if (left < 16) left = 16
    if (left + popoverWidth > window.innerWidth - 16) {
      left = window.innerWidth - popoverWidth - 16
    }

    const snippet =
      targetNote.informationContent?.trim() ||
      extractSnippetFromHtml(targetNote.docContent, 100) ||
      'Sin contenido adicional en esta página.'

    setHoverPopoverData({
      note: targetNote,
      spaceName: targetSpace?.name || 'Espacio General',
      spaceIcon: targetSpace?.icon || '🌐',
      snippet,
      top,
      left,
      width: popoverWidth
    })
  }, [allWorkspaces, spaces, hoverPopoverData])

  const handleContainerMouseLeave = useCallback(() => {
    if (closeTimerRef.current) {
      clearTimeout(closeTimerRef.current)
    }
    closeTimerRef.current = setTimeout(() => {
      setHoverPopoverData(null)
    }, 220)
  }, [])

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
    const noteTitle = targetNote.title || 'Untitled'
    editor
      .chain()
      .focus()
      .insertContent([
        {
          type: 'noteLinkCard',
          attrs: { noteId: targetNote.id, noteTitle }
        },
        { type: 'paragraph' }
      ])
      .run()
    setIsEmbedDocModalOpen(false)
    setEmbedDocSearch('')
    toast.success(`Nota "${noteTitle}" vinculada`)
  }

  const handleInsertMath = () => {
    if (!editor || readOnly) return
    const formula = mathFormula.trim() || 'E = mc^2'
    editor
      .chain()
      .focus()
      .insertContent([
        { type: 'mathBlock', attrs: { latex: formula } },
        { type: 'paragraph' }
      ])
      .run()
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
      {/* Top Floating Formatting Toolbar (hidden in readOnly or Focus Mode) */}
      {!hideEditControls && (
        <div className="sticky top-2 z-20 pointer-events-none w-full px-3 sm:px-6 flex items-center justify-between gap-2 select-none shrink-0 mb-1">
          <div className="flex items-center gap-1 sm:gap-1.5 flex-1 min-w-0 overflow-x-auto no-scrollbar pointer-events-auto py-1">
            {/* Quick insert block button */}
            <button
              onClick={() => {
                setSlashMenuOpen(!slashMenuOpen)
                setSlashFilter('')
              }}
              className="h-7 sm:h-7.5 px-2.5 sm:px-3 rounded-full bg-white/80 dark:bg-[#1a1b1e]/80 hover:bg-white dark:hover:bg-[#25262b] backdrop-blur-md text-[var(--app-text-primary)] transition shadow-sm hover:shadow flex items-center gap-1.5 font-medium border border-black/[0.08] dark:border-white/[0.12] cursor-pointer active:scale-95 shrink-0"
              title="Insertar bloques de contenido (/)"
            >
              <PlusIcon className="w-3.5 h-3.5 text-blue-500" />
              <span className="text-xs font-semibold">Bloque</span>
            </button>

            {/* Notion Tools Dropdown (Table, Board, List, Timeline, Calendar, Gallery) */}
            <div className="relative shrink-0">
              <button
                ref={notionButtonRef}
                onClick={() => setIsNotionMenuOpen((prev) => !prev)}
                className="h-7 sm:h-7.5 px-2.5 sm:px-3 rounded-full bg-white/80 dark:bg-[#1a1b1e]/80 hover:bg-white dark:hover:bg-[#25262b] backdrop-blur-md text-[var(--app-text-primary)] transition shadow-sm hover:shadow flex items-center gap-1.5 font-medium border border-black/[0.08] dark:border-white/[0.12] cursor-pointer active:scale-95 shrink-0"
                title="Herramientas de Notion (Table, Board, List, Timeline, Calendar, Gallery)"
              >
                <NotionTableIcon className="w-3.5 h-3.5 text-blue-500" />
                <span className="text-xs font-semibold">Vistas</span>
                <ChevronDown className="w-3 h-3 text-neutral-400" />
              </button>

              <NotionViewsDropdown
                isOpen={isNotionMenuOpen}
                onClose={() => setIsNotionMenuOpen(false)}
                onSelectView={handleActivateNotionView}
                currentView={databaseData?.activeView}
                anchorRef={notionButtonRef}
                usePortal
              />
            </div>

            {/* Formato de texto: Negrita, Cursiva, Subrayado, Código */}
            <div className="inline-flex items-center gap-0.5 p-0.5 rounded-full bg-white/80 dark:bg-[#1a1b1e]/80 backdrop-blur-md border border-black/[0.08] dark:border-white/[0.12] shadow-sm shrink-0">
              <button
                onClick={() => editor.chain().focus().toggleBold().run()}
                className={`w-7 h-7 rounded-full flex items-center justify-center transition cursor-pointer active:scale-95 shrink-0 ${
                  editor.isActive('bold')
                    ? 'bg-blue-600 text-white shadow-xs font-bold'
                    : 'text-neutral-600 hover:text-neutral-900 dark:text-zinc-300 dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/10'
                }`}
                title="Negrita (Ctrl+B)"
              >
                <BoldIcon className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => editor.chain().focus().toggleItalic().run()}
                className={`w-7 h-7 rounded-full flex items-center justify-center transition cursor-pointer active:scale-95 shrink-0 ${
                  editor.isActive('italic')
                    ? 'bg-blue-600 text-white shadow-xs font-bold'
                    : 'text-neutral-600 hover:text-neutral-900 dark:text-zinc-300 dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/10'
                }`}
                title="Cursiva (Ctrl+I)"
              >
                <ItalicIcon className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => editor.chain().focus().toggleUnderline().run()}
                className={`w-7 h-7 rounded-full flex items-center justify-center transition cursor-pointer active:scale-95 shrink-0 ${
                  editor.isActive('underline')
                    ? 'bg-blue-600 text-white shadow-xs font-bold'
                    : 'text-neutral-600 hover:text-neutral-900 dark:text-zinc-300 dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/10'
                }`}
                title="Subrayado (Ctrl+U)"
              >
                <UnderLineIcon className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => editor.chain().focus().toggleCode().run()}
                className={`w-7 h-7 rounded-full flex items-center justify-center transition cursor-pointer active:scale-95 shrink-0 ${
                  editor.isActive('code')
                    ? 'bg-blue-600 text-white shadow-xs font-bold'
                    : 'text-neutral-600 hover:text-neutral-900 dark:text-zinc-300 dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/10'
                }`}
                title="Código en línea"
              >
                <CodeIcon className="w-3.5 h-3.5" />
              </button>
              <button
                ref={toolbarColorBtnRef}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => toggleTextColorMenu('toolbar')}
                className={`w-7 h-7 rounded-full flex flex-col items-center justify-center transition cursor-pointer active:scale-95 shrink-0 ${
                  textColorMenuAnchor === 'toolbar'
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'text-neutral-600 hover:text-neutral-900 dark:text-zinc-300 dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/10'
                }`}
                title="Color de texto"
              >
                <span className="text-[11px] font-bold leading-none">A</span>
                <span
                  className="w-3.5 h-[2.5px] rounded-full mt-0.5"
                  style={{
                    backgroundColor:
                      activeTextColor ||
                      (textColorMenuAnchor === 'toolbar' ? '#ffffff' : 'currentColor')
                  }}
                />
              </button>
            </div>

            {/* Alineación de texto: Izquierda, Centro, Derecha, Justificado */}
            <div className="inline-flex items-center gap-0.5 p-0.5 rounded-full bg-white/80 dark:bg-[#1a1b1e]/80 backdrop-blur-md border border-black/[0.08] dark:border-white/[0.12] shadow-sm">
              <button
                onClick={() => editor.chain().focus().setTextAlign('left').run()}
                className={`w-7 h-7 rounded-full flex items-center justify-center transition cursor-pointer active:scale-95 shrink-0 ${
                  editor.isActive({ textAlign: 'left' })
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'text-neutral-600 hover:text-neutral-900 dark:text-zinc-300 dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/10'
                }`}
                title="Alinear a la izquierda"
              >
                <AlignLeft className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => editor.chain().focus().setTextAlign('center').run()}
                className={`w-7 h-7 rounded-full flex items-center justify-center transition cursor-pointer active:scale-95 shrink-0 ${
                  editor.isActive({ textAlign: 'center' })
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'text-neutral-600 hover:text-neutral-900 dark:text-zinc-300 dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/10'
                }`}
                title="Centrar texto"
              >
                <AlignCenter className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => editor.chain().focus().setTextAlign('right').run()}
                className={`w-7 h-7 rounded-full flex items-center justify-center transition cursor-pointer active:scale-95 shrink-0 ${
                  editor.isActive({ textAlign: 'right' })
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'text-neutral-600 hover:text-neutral-900 dark:text-zinc-300 dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/10'
                }`}
                title="Alinear a la derecha"
              >
                <AlignRight className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => editor.chain().focus().setTextAlign('justify').run()}
                className={`w-7 h-7 rounded-full flex items-center justify-center transition cursor-pointer active:scale-95 shrink-0 ${
                  editor.isActive({ textAlign: 'justify' })
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'text-neutral-600 hover:text-neutral-900 dark:text-zinc-300 dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/10'
                }`}
                title="Justificar texto"
              >
                <AlignJustify className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Encabezados y Listas */}
            <div className="inline-flex items-center gap-0.5 p-0.5 rounded-full bg-white/80 dark:bg-[#1a1b1e]/80 backdrop-blur-md border border-black/[0.08] dark:border-white/[0.12] shadow-sm">
              <button
                onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
                className={`w-7 h-7 rounded-full flex items-center justify-center transition cursor-pointer active:scale-95 shrink-0 ${
                  editor.isActive('heading', { level: 1 })
                    ? 'bg-blue-600 text-white shadow-xs font-bold'
                    : 'text-neutral-600 hover:text-neutral-900 dark:text-zinc-300 dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/10'
                }`}
                title="Encabezado 1"
              >
                <Heading1Icon className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
                className={`w-7 h-7 rounded-full flex items-center justify-center transition cursor-pointer active:scale-95 shrink-0 ${
                  editor.isActive('heading', { level: 2 })
                    ? 'bg-blue-600 text-white shadow-xs font-bold'
                    : 'text-neutral-600 hover:text-neutral-900 dark:text-zinc-300 dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/10'
                }`}
                title="Encabezado 2 (Subtítulo)"
              >
                <Heading2Icon className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
                className={`w-7 h-7 rounded-full flex items-center justify-center transition cursor-pointer active:scale-95 shrink-0 ${
                  editor.isActive('heading', { level: 3 })
                    ? 'bg-blue-600 text-white shadow-xs font-bold'
                    : 'text-neutral-600 hover:text-neutral-900 dark:text-zinc-300 dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/10'
                }`}
                title="Encabezado 3 (Sección menor)"
              >
                <Heading3Icon className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => editor.chain().focus().toggleBulletList().run()}
                className={`w-7 h-7 rounded-full flex items-center justify-center transition cursor-pointer active:scale-95 shrink-0 ${
                  editor.isActive('bulletList')
                    ? 'bg-blue-600 text-white shadow-xs font-bold'
                    : 'text-neutral-600 hover:text-neutral-900 dark:text-zinc-300 dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/10'
                }`}
                title="Lista de viñetas"
              >
                <BulletedListIcon className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => editor.chain().focus().toggleTaskList().run()}
                className={`w-7 h-7 rounded-full flex items-center justify-center transition cursor-pointer active:scale-95 shrink-0 ${
                  editor.isActive('taskList')
                    ? 'bg-blue-600 text-white shadow-xs font-bold'
                    : 'text-neutral-600 hover:text-neutral-900 dark:text-zinc-300 dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/10'
                }`}
                title="Lista de tareas"
              >
                <CheckBoxCheckSolidIcon className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => editorImageInputRef.current?.click()}
                className="w-7 h-7 rounded-full flex items-center justify-center transition cursor-pointer text-neutral-600 hover:text-neutral-900 dark:text-zinc-300 dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/10 active:scale-95 shrink-0"
                title="Añadir foto"
              >
                <ImageIcon className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Icono y Portada de página */}
            <div className="inline-flex items-center gap-0.5 p-0.5 rounded-full bg-white/80 dark:bg-[#1a1b1e]/80 backdrop-blur-md border border-black/[0.08] dark:border-white/[0.12] shadow-sm shrink-0">
              <button
                onClick={() => setIsIconModalOpen(true)}
                className={`w-7 h-7 rounded-full flex items-center justify-center transition cursor-pointer active:scale-95 shrink-0 ${
                  workspace.icon
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'text-neutral-600 hover:text-neutral-900 dark:text-zinc-300 dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/10'
                }`}
                title={workspace.icon ? 'Cambiar icono' : 'Añadir icono'}
              >
                <Smile className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => (workspace.hasCover ? setIsCoverPickerOpen(true) : handleAddDefaultCover())}
                className={`w-7 h-7 rounded-full flex items-center justify-center transition cursor-pointer active:scale-95 shrink-0 ${
                  workspace.hasCover
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'text-neutral-600 hover:text-neutral-900 dark:text-zinc-300 dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/10'
                }`}
                title={workspace.hasCover ? 'Cambiar portada' : 'Añadir portada'}
              >
                <Palette className="w-3.5 h-3.5" />
              </button>
            </div>
            <input
              type="file"
              ref={editorImageInputRef}
              onChange={handleEditorImageUpload}
              accept="image/*"
              multiple
              className="hidden"
            />
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2 pointer-events-auto py-1">
            {/* Quick toggle page width button */}
            <button
              onClick={handleTogglePageWidth}
              className="h-7 sm:h-7.5 px-2.5 sm:px-3 rounded-full bg-white/80 dark:bg-[#1a1b1e]/80 hover:bg-white dark:hover:bg-[#25262b] backdrop-blur-md text-[var(--app-text-primary)] transition shadow-sm hover:shadow flex items-center gap-1.5 text-xs font-medium border border-black/[0.08] dark:border-white/[0.12] cursor-pointer active:scale-95 shrink-0"
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

            <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/60 dark:bg-[#1a1b1e]/60 backdrop-blur-md border border-black/[0.05] dark:border-white/[0.08] text-[11px] text-[var(--app-text-muted)] shadow-xs">
              <span className="font-mono">
                {saveStatus === 'saving' ? 'Guardando...' : 'Guardado'}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Interactive Sticky Table Toolbar when inside a table */}
      {!hideEditControls && editor.isActive('table') && (
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

      {/* Floating Text Selection Bubble Toolbar (Responsive, Auto-Flip, Zero-Stuck) */}
      <FloatingSelectionMenu
        editor={editor}
        workspaceId={workspace.id}
        readOnly={readOnly}
        activeTextColor={activeTextColor}
        isColorPickerOpen={textColorMenuAnchor === 'floating'}
        colorBtnRef={floatingColorBtnRef}
        onToggleColorPicker={() => toggleTextColorMenu('floating')}
        onOpenEmojiPicker={() => setIsBodyEmojiPickerOpen(true)}
      />

      {/* Text Color Picker Popover */}
      {textColorMenuAnchor &&
        textColorPopoverPos &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            ref={textColorPopoverRef}
            data-text-color-popover="true"
            style={{
              position: 'fixed',
              top: `${textColorPopoverPos.top}px`,
              left: `${textColorPopoverPos.left}px`
            }}
            className="z-[120] w-[216px] p-2.5 rounded-2xl border border-black/10 dark:border-white/15 bg-white/95 dark:bg-[#1e1f24]/95 backdrop-blur-xl shadow-xl animate-in fade-in zoom-in-95 duration-100 select-none"
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-semibold text-neutral-600 dark:text-zinc-300">
                Color de texto
              </span>
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={resetTextColor}
                className="text-[10.5px] font-medium px-2 py-0.5 rounded-full text-neutral-600 hover:text-neutral-900 dark:text-zinc-300 dark:hover:text-white bg-black/5 hover:bg-black/10 dark:bg-white/10 dark:hover:bg-white/15 transition cursor-pointer"
                title="Volver al color predeterminado"
              >
                Predeterminado
              </button>
            </div>

            <div className="grid grid-cols-5 gap-2 mb-2.5">
              {TEXT_COLOR_PALETTE.map((c) => {
                const isActive = activeTextColor?.toLowerCase() === c.hex.toLowerCase()
                return (
                  <button
                    key={c.id}
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => applyTextColor(c.hex)}
                    className={`w-7 h-7 rounded-full transition-transform hover:scale-110 active:scale-95 cursor-pointer border border-black/10 dark:border-white/15 ${
                      isActive ? 'ring-2 ring-blue-500 ring-offset-2 ring-offset-white dark:ring-offset-[#1e1f24]' : ''
                    }`}
                    style={{ backgroundColor: c.hex }}
                    title={c.label}
                  />
                )
              })}
            </div>

            <label className="flex items-center justify-between gap-2 pt-2 border-t border-black/8 dark:border-white/10 cursor-pointer group">
              <span className="text-[11px] font-medium text-neutral-600 dark:text-zinc-300 group-hover:text-neutral-900 dark:group-hover:text-white transition">
                Personalizado
              </span>
              <div className="flex items-center gap-1.5">
                {activeTextColor && (
                  <span className="text-[10px] font-mono text-neutral-500 dark:text-zinc-400 uppercase">
                    {activeTextColor}
                  </span>
                )}
                <input
                  type="color"
                  value={activeTextColor && /^#[0-9a-f]{6}$/i.test(activeTextColor) ? activeTextColor : '#3b82f6'}
                  onChange={(e) => {
                    editor?.chain().focus().setMark('color', { color: e.target.value }).run()
                  }}
                  className="w-6 h-6 rounded-full cursor-pointer border-0 bg-transparent p-0"
                  title="Elegir color personalizado"
                />
              </div>
            </label>
          </div>,
          document.body
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

      {/* 1. Cover Banner (Notion Style) */}
      {workspace.hasCover && (
        <div className="relative w-full h-44 sm:h-52 md:h-64 group/cover select-none shrink-0 overflow-hidden transition-all duration-300 border-b border-black/5 dark:border-white/5">
          {workspace.coverType === 'bannerText' ? (
            <div
              className="absolute inset-0 flex flex-col items-center justify-center transition-colors duration-300"
              style={{ backgroundColor: workspace.coverColor || '#ffffff' }}
            >
              {isEditingBannerText ? (
                <div
                  className="flex flex-col items-center justify-center gap-2 z-20 px-4"
                  onClick={(e) => e.stopPropagation()}
                >
                  <input
                    type="text"
                    value={tempBannerTitle}
                    onChange={(e) => setTempBannerTitle(e.target.value)}
                    placeholder="PROJECTS &"
                    className="font-serif italic tracking-[0.25em] text-lg sm:text-2xl text-center uppercase bg-black/5 dark:bg-white/10 px-3 py-1 rounded-lg border border-neutral-300 dark:border-neutral-600 outline-none w-full max-w-72 sm:max-w-96 text-neutral-900 dark:text-white"
                  />
                  <input
                    type="text"
                    value={tempBannerSubtitle}
                    onChange={(e) => setTempBannerSubtitle(e.target.value)}
                    placeholder="SUB-PROJECTS"
                    className="font-serif italic tracking-[0.25em] text-lg sm:text-2xl text-center uppercase bg-black/5 dark:bg-white/10 px-3 py-1 rounded-lg border border-neutral-300 dark:border-neutral-600 outline-none w-full max-w-72 sm:max-w-96 text-neutral-900 dark:text-white"
                  />
                  <div className="flex items-center gap-2 mt-1">
                    <button
                      onClick={async () => {
                        await db.workspaces.update(workspace.id, {
                          coverBannerTitle: tempBannerTitle.trim() || 'PROJECTS &',
                          coverBannerSubtitle: tempBannerSubtitle.trim() || 'SUB-PROJECTS',
                          updatedAt: getSafeTimestamp(workspace.updatedAt),
                          syncStatus: 'pending'
                        })
                        syncEngine.scheduleSync(50)
                        setIsEditingBannerText(false)
                        toast.success('Texto del banner guardado')
                      }}
                      className="px-3 py-1 bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 rounded-lg text-xs font-semibold shadow-xs"
                    >
                      Guardar
                    </button>
                    <button
                      onClick={() => setIsEditingBannerText(false)}
                      className="px-2.5 py-1 bg-neutral-200 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 rounded-lg text-xs"
                    >
                      Cancelar
                    </button>
                  </div>
                </div>
              ) : (
                <div
                  onClick={() => {
                    if (!readOnly) setIsEditingBannerText(true)
                  }}
                  className="flex flex-col items-center justify-center cursor-pointer hover:opacity-85 transition select-text px-4 max-w-full"
                  title="Clic para editar el texto del banner"
                >
                  <span
                    className="font-serif italic tracking-[0.18em] sm:tracking-[0.25em] text-xl sm:text-3xl md:text-4xl uppercase font-light leading-snug drop-shadow-2xs text-center break-words max-w-full"
                    style={{
                      color:
                        workspace.coverColor === '#18181b'
                          ? '#f4f4f5'
                          : '#18181b'
                    }}
                  >
                    {workspace.coverBannerTitle || 'PROJECTS &'}
                  </span>
                  <span
                    className="font-serif italic tracking-[0.18em] sm:tracking-[0.25em] text-xl sm:text-3xl md:text-4xl uppercase font-light leading-snug drop-shadow-2xs text-center mt-0.5 break-words max-w-full"
                    style={{
                      color:
                        workspace.coverColor === '#18181b'
                          ? '#f4f4f5'
                          : '#18181b'
                    }}
                  >
                    {workspace.coverBannerSubtitle || 'SUB-PROJECTS'}
                  </span>
                </div>
              )}
            </div>
          ) : workspace.coverType === 'image' && workspace.coverUrl && !coverImgError ? (
            <img
              src={workspace.coverUrl}
              alt=""
              onError={() => setCoverImgError(true)}
              className="w-full h-full object-cover"
              style={{ objectPosition: `center ${workspace.coverPosition || 50}%` }}
            />
          ) : (
            <div
              className="w-full h-full"
              style={{
                background:
                  workspace.coverColor ||
                  'linear-gradient(135deg, #27272a 0%, #18181b 100%)'
              }}
            />
          )}

          {/* Banner Hover Floating Controls (always accessible on touch/mobile) */}
          {!hideEditControls && (
            <div className="absolute right-2.5 sm:right-4 bottom-2.5 sm:bottom-3 flex items-center gap-1 sm:gap-1.5 opacity-95 sm:opacity-0 sm:group-hover/cover:opacity-100 transition-opacity bg-black/65 dark:bg-neutral-900/85 backdrop-blur-md px-2 sm:px-2.5 py-1 rounded-xl text-white shadow-lg z-20">
              <button
                onClick={() => setIsCoverPickerOpen(true)}
                className="flex items-center gap-1 px-2 sm:px-2.5 py-1 text-[11px] sm:text-xs hover:bg-white/20 rounded-lg transition font-medium cursor-pointer"
              >
                <Palette className="w-3.5 h-3.5" />
                <span className="hidden xs:inline sm:inline">Cambiar portada</span>
                <span className="xs:hidden sm:hidden">Portada</span>
              </button>
              {workspace.coverType === 'bannerText' && (
                <button
                  onClick={() => setIsEditingBannerText(true)}
                  className="flex items-center gap-1 px-2 sm:px-2.5 py-1 text-[11px] sm:text-xs hover:bg-white/20 rounded-lg transition font-medium cursor-pointer"
                >
                  <Edit3 className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Editar texto</span>
                </button>
              )}
              <button
                onClick={handleRemoveCover}
                className="flex items-center gap-1 px-2 py-1 text-xs hover:bg-rose-500/30 text-rose-300 rounded-lg transition cursor-pointer"
                title="Quitar portada"
                aria-label="Quitar portada"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>
      )}

      {/* Main Document Body Container */}
      <div className={`mx-auto w-full pb-24 ${pageWidthClass} ${workspace.hasCover ? 'pt-0' : 'pt-4 sm:pt-8'}`}>
        {/* Top: Icon & Actions Area */}
        <div className={`relative ${workspace.hasCover ? '-mt-10 sm:-mt-12 mb-3' : 'mb-4'}`}>
          {workspace.icon || workspace.hasCover ? (
            <div className="flex items-end gap-3 group/icon">
              {/* Elevated Squircle Card (Pure white with black folder icon, exactly matching the screenshot!) */}
              <div
                onClick={() => {
                  if (!readOnly) setIsIconModalOpen(true)
                }}
                className="relative w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-white text-neutral-900 border border-neutral-200/90 shadow-xl flex items-center justify-center cursor-pointer hover:scale-105 active:scale-95 transition-all duration-200 shrink-0 z-10"
                title="Cambiar icono de la nota"
              >
                {renderNoteIcon(workspace.icon || 'folder', 34)}

                {!hideEditControls && (
                  <div className="absolute -bottom-2 opacity-0 group-hover/icon:opacity-100 transition-opacity bg-neutral-900 text-white text-[10px] font-medium py-0.5 px-2 rounded-full shadow-md whitespace-nowrap pointer-events-none">
                    Cambiar icono
                  </div>
                )}
              </div>

              {/* Action Buttons alongside icon */}
              {!hideEditControls && (
                <div className="flex flex-wrap items-center gap-1 pb-1 opacity-90 sm:opacity-0 sm:group-hover/icon:opacity-100 transition-opacity">
                  <button
                    onClick={() => setIsIconModalOpen(true)}
                    className="text-[11px] text-[var(--affine-text-secondary-color)] hover:text-[var(--affine-text-primary-color)] px-2 py-1 rounded-md hover:bg-[var(--affine-hover-color)] transition cursor-pointer"
                  >
                    Cambiar icono
                  </button>
                  <button
                    onClick={handleRemoveIcon}
                    className="text-[11px] text-rose-500 hover:text-rose-600 px-2 py-1 rounded-md hover:bg-rose-500/10 transition cursor-pointer"
                  >
                    Quitar icono
                  </button>
                  {!workspace.hasCover && (
                    <button
                      onClick={handleAddDefaultCover}
                      className="text-[11px] text-[var(--affine-text-secondary-color)] hover:text-[var(--affine-text-primary-color)] px-2 py-1 rounded-md hover:bg-[var(--affine-hover-color)] transition flex items-center gap-1 cursor-pointer"
                    >
                      <Palette className="w-3 h-3" />
                      <span>Añadir portada</span>
                    </button>
                  )}
                </div>
              )}
            </div>
          ) : !hideEditControls ? (
            /* Ghost action buttons when neither cover nor icon is present - visible on touch, hover on desktop */
            <div className="flex flex-wrap items-center gap-2 mb-2 opacity-75 sm:opacity-0 sm:hover:opacity-100 transition-opacity">
              <button
                onClick={() => setIsIconModalOpen(true)}
                className="flex items-center gap-1.5 text-xs text-[var(--app-text-muted)] hover:text-[var(--app-text-primary)] py-0.5 px-2 rounded hover:bg-white/5 transition font-normal cursor-pointer"
              >
                <Smile className="w-3.5 h-3.5" />
                <span>Añadir icono</span>
              </button>
              <button
                onClick={handleAddDefaultCover}
                className="flex items-center gap-1.5 text-xs text-[var(--app-text-muted)] hover:text-[var(--app-text-primary)] py-0.5 px-2 rounded hover:bg-white/5 transition font-normal cursor-pointer"
              >
                <Palette className="w-3.5 h-3.5" />
                <span>Añadir portada</span>
              </button>
            </div>
          ) : null}
        </div>

        {/* Big Title - Obsidian Style */}
        <div className="mb-4">
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
            placeholder="Título de la nota..."
            className={`w-full text-3xl sm:text-4xl font-bold tracking-tight text-[var(--app-text-primary)] placeholder:text-[var(--app-text-muted)] bg-transparent border-none outline-none focus:outline-none resize-none overflow-hidden leading-tight break-words whitespace-pre-wrap block ${
              readOnly ? 'cursor-default' : ''
            }`}
            style={{ fieldSizing: 'content' }}
          />
        </div>

        {/* Privacy & Metadata (Discreet Obsidian status pills) */}
        <div className="flex items-center gap-2 flex-wrap mb-6 opacity-75 hover:opacity-100 transition-opacity">
          {readOnly && (
            <span className="flex items-center gap-1 text-[11px] py-0.5 px-2 rounded-full font-medium text-amber-500 bg-amber-500/10 border border-amber-500/20 select-none">
              <Lock className="w-3 h-3 text-amber-500" />
              <span>Solo lectura</span>
            </span>
          )}

          <button
            onClick={async () => {
              if (readOnly) return
              const nextPrivate = !workspace.isPrivate
              await db.workspaces.update(workspace.id, {
                isPrivate: nextPrivate,
                updatedAt: Date.now(),
                syncStatus: 'pending'
              })
              syncEngine.scheduleSync(500)
              toast.success(
                nextPrivate
                  ? 'Nota cambiada a MODO PRIVADO (Solo tú)'
                  : 'Nota cambiada a MODO PÚBLICO (Todo el equipo)'
              )
            }}
            disabled={readOnly}
            className={`flex items-center gap-1.5 text-[11px] py-0.5 px-2 rounded font-normal transition select-none ${
              readOnly ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'
            } ${
              workspace.isPrivate
                ? 'text-amber-400 bg-amber-400/10 hover:bg-amber-400/20'
                : 'text-[var(--app-text-muted)] hover:text-[var(--app-text-primary)] hover:bg-white/5'
            }`}
            title={
              readOnly
                ? `Privacidad gestionada por el autor original (${workspace.ownerName || 'propietario'})`
                : workspace.isPrivate
                ? 'Nota privada (solo tú). Clic para hacerla pública para el equipo'
                : 'Nota pública para el equipo. Clic para hacerla privada'
            }
          >
            {workspace.isPrivate ? (
              <Lock className="w-3 h-3 text-amber-400" />
            ) : (
              <Unlock className="w-3 h-3 text-[var(--app-text-muted)]" />
            )}
            <span>{workspace.isPrivate ? 'Privada' : 'Pública'}</span>
          </button>

          {/* Creator attribution pill with synced user avatar */}
          {(workspace.ownerName || workspace.createdBy || workspace.ownerMember || workspace.userId) && (() => {
            const creatorProfile = resolveTeamProfile(
              {
                id: workspace.userId || workspace.ownerMember,
                name: workspace.ownerName || workspace.createdBy
              },
              teamProfiles
            )
            const creatorName = creatorProfile?.fullName || workspace.ownerName || workspace.createdBy || 'Equipo'
            return (
              <span className="flex items-center gap-1.5 text-[11px] text-[var(--app-text-muted)]">
                <UserAvatar
                  name={creatorName}
                  avatarUrl={creatorProfile?.avatarUrl}
                  color={creatorProfile?.color || '#7c3aed'}
                  size="xs"
                  shape="circle"
                />
                <span className="text-[var(--app-text-secondary)] font-medium">
                  {creatorName}
                </span>
              </span>
            )
          })()}

          {workspace.isPublicShared && (
            <span className="flex items-center gap-1 text-[11px] text-emerald-400">
              <Globe className="w-3 h-3" />
              <span>Pública en la web</span>
            </span>
          )}
        </div>

        {/* Cover & Icon Picker Popovers */}
        <CoverPickerPopover
          isOpen={isCoverPickerOpen}
          onClose={() => setIsCoverPickerOpen(false)}
          currentConfig={{
            hasCover: workspace.hasCover ?? false,
            coverType: workspace.coverType || 'bannerText',
            coverUrl: workspace.coverUrl,
            coverColor: workspace.coverColor,
            coverBannerTitle: workspace.coverBannerTitle,
            coverBannerSubtitle: workspace.coverBannerSubtitle,
            coverBannerStyle: workspace.coverBannerStyle,
            coverPosition: workspace.coverPosition
          }}
          onSelectCover={handleSelectCover}
          onRemoveCover={handleRemoveCover}
          noteTitle={workspace.title}
        />

        <NoteIconPickerModal
          isOpen={isIconModalOpen}
          onClose={() => setIsIconModalOpen(false)}
          currentIcon={workspace.icon}
          onSelectIcon={handleSelectIcon}
          onRemoveIcon={handleRemoveIcon}
        />

        {/* Collapsible: "Información" */}
        <div className="mb-8">
          <button
            type="button"
            aria-expanded={isInfoExpanded}
            onClick={handleToggleInfo}
            className="w-full flex items-center gap-3 cursor-pointer group select-none"
          >
            <div className="flex items-center gap-1.5 text-[var(--app-text-secondary)] group-hover:text-[var(--app-text-primary)] transition">
              <span className="text-xs font-medium">Información</span>
              <span className="text-[var(--app-text-secondary)] group-hover:text-[var(--app-text-primary)]">
                {isInfoExpanded ? (
                  <ToggleDownIcon className="w-3.5 h-3.5" />
                ) : (
                  <ToggleRightIcon className="w-3.5 h-3.5" />
                )}
              </span>
            </div>
            <div className="flex-1 h-[1px] bg-[var(--app-divider)]" />
          </button>

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
        <NoteLinkContext.Provider
          value={{
            allWorkspaces,
            spaces,
            onSelectWorkspace: onSelectWorkspace
              ? (id: string) => {
                  setHoverPopoverData(null)
                  onSelectWorkspace(id)
                }
              : undefined,
            readOnly
          }}
        >
          <div
            onMouseOver={handleContainerMouseOver}
            onMouseLeave={handleContainerMouseLeave}
            className="min-h-[280px]"
          >
            <EditorContent editor={editor} />
          </div>
        </NoteLinkContext.Provider>

        {/* Inline [[wikilink]] Autocomplete Popover */}
        {wikiMenuOpen &&
          wikiMenuPos &&
          !readOnly &&
          createPortal(
            <div
              className="fixed z-[9998] w-[310px] rounded-xl bg-[var(--app-bg-overlay)] border border-[var(--app-border-strong)] p-1.5 text-[var(--app-text-primary)] animate-in fade-in zoom-in-95 duration-100 select-none"
              style={{
                top: `${wikiMenuPos.y}px`,
                left: `${wikiMenuPos.x}px`,
                boxShadow: 'var(--app-shadow-popover)'
              }}
              onMouseDown={(e) => e.preventDefault()}
            >
              <div className="flex items-center justify-between px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-[var(--app-text-muted)]">
                <span>Vincular nota ({wikiQuery ? `"${wikiQuery}"` : '[[...'})</span>
                <span className="font-normal normal-case">↑↓ · Enter · Esc</span>
              </div>
              {wikiCandidates.length === 0 ? (
                <div className="px-2.5 py-3 text-xs text-[var(--app-text-muted)] text-center">
                  No se encontraron notas coincidentes.
                </div>
              ) : (
                <div className="max-h-56 overflow-y-auto space-y-0.5">
                  {wikiCandidates.map((ws, idx) => {
                    const sp = spaces.find((s) => s.id === (ws.spaceId || DEFAULT_SPACE_ID))
                    const isSelected = idx === selectedWikiIdx
                    return (
                      <div
                        key={ws.id}
                        onMouseEnter={() => setSelectedWikiIdx(idx)}
                        onClick={() => handleInsertLinkToNote(ws, 'inline', wikiRange)}
                        className={`flex items-center justify-between gap-2 px-2 py-1.5 rounded-lg cursor-pointer transition ${
                          isSelected
                            ? 'bg-[var(--app-accent-soft)] text-[var(--app-accent)]'
                            : 'hover:bg-[var(--app-hover)] text-[var(--app-text-primary)]'
                        }`}
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="shrink-0">
                            <AppleEmoji emoji={ws.icon || '📄'} size={15} />
                          </span>
                          <div className="min-w-0">
                            <div className="text-xs font-medium truncate">
                              {renderWithAppleEmoji(ws.title || 'Untitled')}
                            </div>
                            <div className="text-[10px] text-[var(--app-text-muted)] truncate">
                              {sp?.icon || '🌐'} {sp?.name || 'Espacio General'}
                            </div>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation()
                            handleInsertLinkToNote(ws, 'card', wikiRange)
                          }}
                          title="Insertar como tarjeta visual"
                          className="shrink-0 text-[10px] px-1.5 py-0.5 rounded bg-[var(--app-bg-tertiary)] hover:bg-[var(--app-accent)] hover:text-white text-[var(--app-text-secondary)] transition cursor-pointer"
                        >
                          Tarjeta
                        </button>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>,
            document.body
          )}

        {/* Section: Bi-Directional Links */}
        <div
          onMouseOver={handleContainerMouseOver}
          onMouseLeave={handleContainerMouseLeave}
          className="mt-14 pt-6 border-t border-[var(--app-divider)]"
        >
          <div className="flex items-center justify-between gap-2 flex-wrap mb-3">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-semibold text-[var(--app-text-primary)]">
                Enlaces bidireccionales
              </span>
              {bidirectionalLinks.length > 0 && (
                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-[var(--app-accent-soft)] border border-[var(--app-accent)]/30 text-[var(--app-accent)] font-semibold">
                  {bidirectionalLinks.length}
                </span>
              )}
              {isBiDirectionalExpanded && bidirectionalLinks.length > 1 && (
                <div className="flex items-center gap-1 ml-1">
                  {(
                    [
                      { id: 'all', label: 'Todos', count: bidirectionalLinks.length },
                      { id: 'bidirectional', label: '⇄ Mutuos', count: relationCounts.bidirectional },
                      { id: 'incoming', label: '← Entrantes', count: relationCounts.incoming },
                      { id: 'outgoing', label: '→ Salientes', count: relationCounts.outgoing }
                    ] as const
                  )
                    .filter((tab) => tab.id === 'all' || tab.count > 0)
                    .map((tab) => (
                      <button
                        key={tab.id}
                        type="button"
                        onClick={() => setLinkFilter(tab.id)}
                        className={`px-2 py-0.5 rounded-full text-[10px] font-medium transition cursor-pointer ${
                          linkFilter === tab.id
                            ? 'bg-[var(--app-accent)] text-white'
                            : 'bg-[var(--app-bg-tertiary)] text-[var(--app-text-secondary)] hover:text-[var(--app-text-primary)]'
                        }`}
                      >
                        {tab.label} ({tab.count})
                      </button>
                    ))}
                </div>
              )}
            </div>

            <div className="flex items-center gap-2">
              {isBiDirectionalExpanded && !readOnly && (
                <button
                  type="button"
                  onClick={() => setShowLinkSelector(!showLinkSelector)}
                  className="px-2.5 py-1 rounded-md bg-[var(--app-bg-secondary)] hover:bg-[var(--app-hover-filled)] text-[var(--app-text-primary)] text-xs flex items-center gap-1 border border-[var(--app-border-strong)] transition active:scale-95 cursor-pointer"
                >
                  <PlusIcon className="w-3 h-3 text-[var(--app-accent)]" />
                  <span>Vincular nota</span>
                </button>
              )}
              <button
                type="button"
                onClick={handleToggleBiDirectional}
                className="px-3 py-1 rounded-md bg-[var(--app-bg-secondary)] hover:bg-[var(--app-hover-filled)] text-[var(--app-text-primary)] text-xs font-medium border border-[var(--app-border-strong)] transition active:scale-95 cursor-pointer"
              >
                {isBiDirectionalExpanded ? 'Ocultar' : 'Mostrar'}
              </button>
            </div>
          </div>

          {/* Bi-Directional Links expanded body */}
          {isBiDirectionalExpanded && (
            <div className="space-y-3 animate-in fade-in duration-100">
              {showLinkSelector && !readOnly && (
                <div
                  className="p-3.5 bg-[var(--app-bg-overlay)] border border-[var(--app-border-strong)] rounded-xl text-xs space-y-2.5 max-w-lg"
                  style={{ boxShadow: 'var(--app-shadow-popover)' }}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[var(--app-text-primary)] font-semibold text-xs flex items-center gap-1.5">
                      <LinkIcon className="w-3.5 h-3.5 text-[var(--app-accent)]" />
                      Vincular otra nota
                    </span>
                    <button
                      type="button"
                      onClick={() => setShowLinkSelector(false)}
                      className="text-[var(--app-text-secondary)] hover:text-[var(--app-text-primary)] p-0.5 rounded transition cursor-pointer"
                    >
                      <CloseIcon className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {/* Filter search input */}
                  <div className="relative">
                    <input
                      type="text"
                      placeholder="Buscar nota por título o espacio..."
                      value={linkSearchQuery}
                      onChange={(e) => setLinkSearchQuery(e.target.value)}
                      className="w-full px-2.5 py-1.5 pl-7 bg-[var(--app-bg-primary)] border border-[var(--app-border-strong)] rounded-lg text-xs text-[var(--app-text-primary)] placeholder:text-[var(--app-text-muted)] focus:outline-none focus:border-[var(--app-accent)] transition"
                      autoFocus
                    />
                    <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[var(--app-text-muted)] pointer-events-none text-xs">
                      🔍
                    </span>
                  </div>

                  {/* List of linkable workspaces */}
                  <div className="max-h-56 overflow-y-auto space-y-1 divide-y divide-[var(--app-divider)]">
                    {allWorkspaces
                      .filter((w) => w.id !== workspace.id && !w.isDeleted)
                      .filter((w) => {
                        if (!linkSearchQuery.trim()) return true
                        const q = linkSearchQuery.toLowerCase()
                        const sp = spaces.find((s) => s.id === (w.spaceId || DEFAULT_SPACE_ID))
                        return (
                          (w.title || '').toLowerCase().includes(q) ||
                          (sp?.name || '').toLowerCase().includes(q)
                        )
                      })
                      .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0))
                      .map((ws) => {
                        const sp = spaces.find((s) => s.id === (ws.spaceId || DEFAULT_SPACE_ID))
                        const spName = sp?.name || 'Espacio General'
                        const spIcon = sp?.icon || '🌐'
                        const snippet = ws.informationContent?.trim() || extractSnippetFromHtml(ws.docContent, 65)
                        const alreadyLinked = outgoingIds.has(ws.id)

                        return (
                          <div
                            key={ws.id}
                            className="flex items-center justify-between gap-2 p-2 pt-2.5 rounded-lg hover:bg-[var(--app-hover)] text-[var(--app-text-primary)] transition group"
                          >
                            <div
                              onClick={() => handleInsertLinkToNote(ws, 'card')}
                              className="flex items-center gap-2.5 min-w-0 flex-1 cursor-pointer"
                            >
                              <span className="shrink-0 text-base">
                                <AppleEmoji emoji={ws.icon || '📄'} size={18} />
                              </span>
                              <div className="min-w-0">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <span className="font-medium text-xs truncate group-hover:text-[var(--app-accent)] transition-colors">
                                    {renderWithAppleEmoji(ws.title || 'Untitled')}
                                  </span>
                                  <span className="inline-flex items-center gap-0.5 text-[9px] px-1.5 py-0.5 rounded-full bg-[var(--app-accent-soft)] text-[var(--app-accent)] font-medium shrink-0">
                                    <span>{spIcon}</span>
                                    <span>{spName}</span>
                                  </span>
                                  {alreadyLinked && (
                                    <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 font-medium shrink-0">
                                      Vinculada
                                    </span>
                                  )}
                                </div>
                                {snippet && (
                                  <p className="text-[10px] text-[var(--app-text-secondary)] truncate mt-0.5">
                                    {snippet}
                                  </p>
                                )}
                              </div>
                            </div>
                            <div className="flex items-center gap-1 shrink-0">
                              <button
                                type="button"
                                onClick={() => handleInsertLinkToNote(ws, 'inline')}
                                className="text-[10px] font-medium text-[var(--app-text-secondary)] hover:text-[var(--app-accent)] px-2 py-1 rounded bg-[var(--app-bg-tertiary)] hover:bg-[var(--app-accent-soft)] transition cursor-pointer"
                                title="Insertar como enlace inline"
                              >
                                Inline
                              </button>
                              <button
                                type="button"
                                onClick={() => handleInsertLinkToNote(ws, 'card')}
                                className="text-[10px] font-medium text-[var(--app-accent)] px-2 py-1 rounded bg-[var(--app-accent-soft)] hover:bg-[var(--app-accent)] hover:text-white transition cursor-pointer"
                                title="Insertar como tarjeta visual"
                              >
                                + Tarjeta
                              </button>
                            </div>
                          </div>
                        )
                      })}
                  </div>

                  <p className="text-[10px] text-[var(--app-text-muted)] pt-1 border-t border-[var(--app-divider)]">
                    Tip: escribe <kbd className="px-1 py-0.5 rounded bg-[var(--app-bg-tertiary)] font-mono text-[10px]">[[</kbd> en cualquier parte del documento para vincular notas al instante.
                  </p>
                </div>
              )}

              {bidirectionalLinks.length === 0 ? (
                <div className="p-4 rounded-xl bg-[var(--app-bg-secondary)] border border-[var(--app-border)] text-center text-xs text-[var(--app-text-secondary)]">
                  No hay enlaces explícitos conectados a esta página todavía.
                  <br />
                  Escribe <kbd className="px-1 py-0.5 rounded bg-[var(--app-bg-tertiary)] font-mono text-[11px]">[[</kbd> en el texto o usa <span className="font-medium text-[var(--app-text-primary)]">"Vincular nota"</span> para conectar tus ideas.
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {filteredBidirectionalLinks.map((item: BidirectionalLinkItem) => (
                    <div
                      key={item.workspace.id}
                      data-note-id={item.workspace.id}
                      onClick={() => {
                        setHoverPopoverData(null)
                        if (onSelectWorkspace) onSelectWorkspace(item.workspace.id)
                      }}
                      className="p-3 rounded-xl bg-[var(--app-bg-secondary)] border border-[var(--app-border)] hover:border-[var(--app-accent)]/60 hover:bg-[var(--app-hover-filled)] cursor-pointer transition flex flex-col justify-between group select-none"
                      style={{ boxShadow: 'var(--app-shadow-card)' }}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-start gap-2.5 min-w-0 flex-1">
                          <span className="shrink-0 mt-0.5">
                            <AppleEmoji emoji={item.workspace.icon || '📄'} size={18} />
                          </span>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <p className="font-semibold text-[var(--app-text-primary)] group-hover:text-[var(--app-accent)] truncate text-xs transition-colors">
                                {renderWithAppleEmoji(item.workspace.title || 'Untitled')}
                              </p>
                              <span className="inline-flex items-center gap-0.5 text-[9px] px-1.5 py-0.5 rounded-full bg-[var(--app-accent-soft)] text-[var(--app-accent)] font-medium shrink-0">
                                <span>{item.spaceIcon}</span>
                                <span>{item.spaceName}</span>
                              </span>
                            </div>
                            <p className="text-[11px] text-[var(--app-text-secondary)] line-clamp-2 mt-1 leading-snug">
                              {item.contextExcerpt || item.snippet}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <span
                            className={`text-[9px] px-1.5 py-0.5 rounded-full font-medium whitespace-nowrap ${
                              item.relation === 'bidirectional'
                                ? 'bg-purple-500/15 text-purple-600 dark:text-purple-400 border border-purple-500/30'
                                : item.relation === 'incoming'
                                ? 'bg-blue-500/15 text-blue-600 dark:text-blue-400 border border-blue-500/30'
                                : 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30'
                            }`}
                          >
                            {item.relation === 'bidirectional'
                              ? '⇄ Bidireccional'
                              : item.relation === 'incoming'
                              ? '← Te menciona'
                              : '→ Enlazada'}
                          </span>
                          <OpenInNewIcon className="w-3.5 h-3.5 text-[var(--app-text-muted)] group-hover:text-[var(--app-accent)] transition-colors" />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Optional Unlinked Mentions (plain-text title matches without explicit links) */}
              {unlinkedMentions.length > 0 && (
                <div className="pt-2">
                  <button
                    type="button"
                    onClick={() => setShowUnlinkedMentions((v) => !v)}
                    className="flex items-center gap-1.5 text-xs font-medium text-[var(--app-text-secondary)] hover:text-[var(--app-text-primary)] transition cursor-pointer select-none"
                  >
                    {showUnlinkedMentions ? (
                      <ToggleDownIcon className="w-3.5 h-3.5" />
                    ) : (
                      <ToggleRightIcon className="w-3.5 h-3.5" />
                    )}
                    <span>Menciones sin vincular ({unlinkedMentions.length})</span>
                  </button>

                  {showUnlinkedMentions && (
                    <div className="mt-2 space-y-1.5">
                      {unlinkedMentions.map((item) => (
                        <div
                          key={item.workspace.id}
                          className="flex items-center justify-between gap-3 p-2.5 rounded-xl bg-[var(--app-bg-secondary)] border border-dashed border-[var(--app-border-strong)] hover:border-[var(--app-accent)]/50 transition"
                        >
                          <div
                            onClick={() => {
                              setHoverPopoverData(null)
                              if (onSelectWorkspace) onSelectWorkspace(item.workspace.id)
                            }}
                            className="flex items-start gap-2 min-w-0 flex-1 cursor-pointer"
                          >
                            <span className="shrink-0 mt-0.5">
                              <AppleEmoji emoji={item.workspace.icon || '📄'} size={16} />
                            </span>
                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="text-xs font-medium text-[var(--app-text-primary)] truncate">
                                  {renderWithAppleEmoji(item.workspace.title || 'Untitled')}
                                </span>
                                <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-[var(--app-bg-tertiary)] text-[var(--app-text-muted)]">
                                  {item.spaceIcon} {item.spaceName}
                                </span>
                              </div>
                              <p className="text-[11px] text-[var(--app-text-secondary)] truncate mt-0.5">
                                {item.contextExcerpt}
                              </p>
                            </div>
                          </div>
                          {!readOnly && (
                            <button
                              type="button"
                              onClick={() => handleConvertUnlinkedMention(item)}
                              className="shrink-0 text-[10px] font-medium px-2.5 py-1 rounded-lg bg-[var(--app-accent-soft)] text-[var(--app-accent)] hover:bg-[var(--app-accent)] hover:text-white transition cursor-pointer"
                            >
                              Vincular
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Actionable Hover Preview Popover */}
      {hoverPopoverData &&
        createPortal(
          <div
            onMouseEnter={() => {
              if (closeTimerRef.current) {
                clearTimeout(closeTimerRef.current)
                closeTimerRef.current = null
              }
            }}
            onMouseLeave={() => {
              closeTimerRef.current = setTimeout(() => {
                setHoverPopoverData(null)
              }, 200)
            }}
            className="seven-note-hover-popover fixed z-[9999] bg-[var(--app-bg-overlay)] border border-[var(--app-border-strong)] text-[var(--app-text-primary)] rounded-xl p-3.5 space-y-2.5 animate-in fade-in zoom-in-95 duration-150 backdrop-blur-md select-none"
            style={{
              top: `${hoverPopoverData.top}px`,
              left: `${hoverPopoverData.left}px`,
              width: `${hoverPopoverData.width}px`,
              boxShadow: 'var(--app-shadow-popover)'
            }}
          >
            {/* Popover Header */}
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-8 h-8 rounded-lg bg-[var(--app-bg-secondary)] border border-[var(--app-border)] flex items-center justify-center text-lg shrink-0">
                  <AppleEmoji emoji={hoverPopoverData.note.icon || '📄'} size={18} />
                </div>
                <div className="min-w-0">
                  <h4 className="font-semibold text-xs text-[var(--app-text-primary)] truncate">
                    {renderWithAppleEmoji(hoverPopoverData.note.title || 'Untitled')}
                  </h4>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full bg-[var(--app-accent-soft)] text-[var(--app-accent)] font-medium">
                      <span>{hoverPopoverData.spaceIcon}</span>
                      <span>{hoverPopoverData.spaceName}</span>
                    </span>
                    <span className="text-[10px] text-[var(--app-text-muted)]">
                      {hoverPopoverData.note.updatedAt
                        ? new Date(hoverPopoverData.note.updatedAt).toLocaleDateString('es-ES', {
                            day: 'numeric',
                            month: 'short'
                          })
                        : 'Documento'}
                    </span>
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setHoverPopoverData(null)}
                className="text-[var(--app-text-muted)] hover:text-[var(--app-text-primary)] p-0.5 rounded transition cursor-pointer"
                title="Cerrar vista previa"
              >
                <CloseIcon className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Popover Content Preview Snippet */}
            <div className="p-2 rounded-lg bg-[var(--app-bg-secondary)] border border-[var(--app-border)] text-[11px] text-[var(--app-text-secondary)] leading-relaxed max-h-20 overflow-y-auto">
              {hoverPopoverData.snippet}
            </div>

            {/* Tags if any */}
            {hoverPopoverData.note.tags && hoverPopoverData.note.tags.length > 0 && (
              <div className="flex items-center gap-1 flex-wrap">
                {hoverPopoverData.note.tags.map((tag) => (
                  <span
                    key={tag}
                    className="text-[9px] px-1.5 py-0.5 rounded bg-[var(--app-bg-tertiary)] text-[var(--app-text-secondary)] border border-[var(--app-border)]"
                  >
                    #{tag}
                  </span>
                ))}
              </div>
            )}

            {/* Actionable buttons */}
            <div className="flex items-center justify-between gap-2 pt-1 border-t border-[var(--app-divider)]">
              <button
                type="button"
                onClick={() => {
                  if (onSelectWorkspace) {
                    onSelectWorkspace(hoverPopoverData.note.id)
                  }
                  setHoverPopoverData(null)
                }}
                className="flex-1 py-1.5 px-2.5 rounded-lg bg-[var(--app-accent)] hover:bg-[var(--app-accent-hover)] text-white text-[11px] font-medium transition flex items-center justify-center gap-1.5 shadow-sm active:scale-95 cursor-pointer"
              >
                <OpenInNewIcon className="w-3.5 h-3.5" />
                <span>Abrir documento</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  const url = `${window.location.origin}/#note=${encodeURIComponent(hoverPopoverData.note.id)}`
                  navigator.clipboard.writeText(url)
                  toast.success('Enlace de la nota copiado al portapapeles')
                }}
                className="py-1.5 px-2.5 rounded-lg bg-[var(--app-bg-secondary)] hover:bg-[var(--app-hover-filled)] border border-[var(--app-border-strong)] text-[var(--app-text-secondary)] hover:text-[var(--app-text-primary)] text-[11px] font-medium transition flex items-center gap-1 active:scale-95 cursor-pointer"
                title="Copiar enlace"
              >
                <CopyIcon className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Copiar enlace</span>
              </button>
            </div>
          </div>,
          document.body
        )}
    </div>
  )
}
