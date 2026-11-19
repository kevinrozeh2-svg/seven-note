import React, { useState, useEffect, useLayoutEffect, useRef, useCallback } from 'react'
import { createPortal } from 'react-dom'
import type { Editor } from '@tiptap/react'
import {
  Sparkles,
  ChevronDown,
  Bold,
  Italic,
  Underline,
  Strikethrough,
  Code,
  Link2,
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignJustify,
  MoreHorizontal,
  X,
  RemoveFormatting,
  Copy,
  List,
  ListOrdered,
  CheckSquare,
  Quote,
  Type,
  Heading1,
  Heading2,
  Heading3,
  Superscript,
  Subscript,
  ExternalLink,
  Unlink,
  Check,
  CaseUpper,
  CaseLower,
  CaseSensitive
} from 'lucide-react'
import { toast } from 'sonner'
import { AppleEmoji } from '../ui/AppleEmoji'

interface FloatingSelectionMenuProps {
  editor: Editor | null
  workspaceId: string
  readOnly?: boolean
  activeTextColor: string | null
  isColorPickerOpen: boolean
  colorBtnRef: React.RefObject<HTMLButtonElement | null>
  onToggleColorPicker: () => void
  onOpenEmojiPicker: () => void
}

type SubMenuType = null | 'highlight' | 'block' | 'align' | 'link' | 'more'

const HIGHLIGHT_SWATCHES = [
  { label: 'Amarillo', color: '#fef08a' },
  { label: 'Menta', color: '#bbf7d0' },
  { label: 'Cielo', color: '#bae6fd' },
  { label: 'Lavanda', color: '#ddd6fe' },
  { label: 'Rosa', color: '#fbcfe8' },
  { label: 'Durazno', color: '#fed7aa' }
]

interface AnchorRect {
  top: number
  bottom: number
  left: number
  right: number
  width: number
}

export const FloatingSelectionMenu: React.FC<FloatingSelectionMenuProps> = ({
  editor,
  workspaceId,
  readOnly = false,
  activeTextColor,
  isColorPickerOpen,
  colorBtnRef,
  onToggleColorPicker,
  onOpenEmojiPicker
}) => {
  const [selectionRect, setSelectionRect] = useState<AnchorRect | null>(null)
  const [menuCoords, setMenuCoords] = useState<{ left: number; top: number; ready: boolean }>({
    left: 0,
    top: 0,
    ready: false
  })
  const [openSubMenu, setOpenSubMenu] = useState<SubMenuType>(null)
  const [subMenuPos, setSubMenuPos] = useState<{ top: number; left: number }>({ top: 0, left: 0 })
  const [lastHighlightColor, setLastHighlightColor] = useState('#fef08a')
  const [linkUrl, setLinkUrl] = useState('')
  const [, forceUpdate] = useState(0)

  const menuRef = useRef<HTMLDivElement | null>(null)
  const subMenuRef = useRef<HTMLDivElement | null>(null)
  const isPointerDownInEditorRef = useRef(false)
  const dismissedSelectionKeyRef = useRef<string | null>(null)
  const rafRef = useRef<number | null>(null)
  const selectionChangeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const closeAll = useCallback(() => {
    setSelectionRect(null)
    setOpenSubMenu(null)
    setMenuCoords((prev) => ({ ...prev, ready: false }))
  }, [])

  // Reset when switching workspace or readOnly changes
  useEffect(() => {
    dismissedSelectionKeyRef.current = null
    isPointerDownInEditorRef.current = false
    closeAll()
  }, [workspaceId, readOnly, closeAll])

  // Compute current valid text selection bounding rect
  const computeSelectionRect = useCallback((): AnchorRect | null => {
    if (!editor || readOnly || !editor.isEditable) return null
    const { selection } = editor.state
    if (selection.empty) return null
    // Ignore NodeSelection (images, horizontal rules, etc.)
    if ('node' in selection && (selection as any).node) return null
    // Ignore code blocks
    if (editor.isActive('codeBlock')) return null

    const selectedText = editor.state.doc.textBetween(selection.from, selection.to, ' ').trim()
    if (!selectedText) return null

    // 1. Prefer DOM Range bounding rect when selection is inside editor DOM
    try {
      const domSel = window.getSelection()
      if (domSel && domSel.rangeCount > 0 && !domSel.isCollapsed) {
        const range = domSel.getRangeAt(0)
        const ancestor = range.commonAncestorContainer
        const isInEditor =
          editor.view.dom.contains(ancestor) ||
          (ancestor instanceof Node && ancestor.contains(editor.view.dom))

        if (isInEditor) {
          const rect = range.getBoundingClientRect()
          if (rect.width > 0 || rect.height > 0) {
            if (rect.bottom < 44 || rect.top > window.innerHeight - 12) {
              return null
            }
            return {
              top: rect.top,
              bottom: rect.bottom,
              left: rect.left,
              right: rect.right,
              width: Math.max(1, rect.width)
            }
          }
        }
      }
    } catch {
      // Fall through to ProseMirror coordsAtPos
    }

    // 2. Reliable ProseMirror fallback (works for Ctrl+A, triple-click, multi-block, etc.)
    try {
      const start = editor.view.coordsAtPos(selection.from)
      const end = editor.view.coordsAtPos(selection.to)
      const top = Math.min(start.top, end.top)
      const bottom = Math.max(start.bottom, end.bottom)
      const left = Math.min(start.left, end.left)
      const right = Math.max(start.right, end.right)
      if (bottom < 44 || top > window.innerHeight - 12) return null
      return { top, bottom, left, right, width: Math.max(1, right - left) }
    } catch {
      return null
    }
  }, [editor, readOnly])

  const syncMenuFromEditor = useCallback(() => {
    if (!editor) return
    if (isPointerDownInEditorRef.current) return

    const { from, to, empty } = editor.state.selection
    if (empty) {
      dismissedSelectionKeyRef.current = null
      setSelectionRect(null)
      setOpenSubMenu(null)
      return
    }

    const selKey = `${from}:${to}`
    if (dismissedSelectionKeyRef.current === selKey) {
      return
    }
    // New selection range clears previous dismissal
    if (dismissedSelectionKeyRef.current && dismissedSelectionKeyRef.current !== selKey) {
      dismissedSelectionKeyRef.current = null
    }

    const rect = computeSelectionRect()
    if (!rect) {
      setSelectionRect(null)
      setOpenSubMenu(null)
    } else {
      setSelectionRect(rect)
      forceUpdate((n) => (n + 1) % 100000)
    }
  }, [editor, computeSelectionRect])

  // Subscribe to TipTap selection/transaction events + DOM selectionchange
  useEffect(() => {
    if (!editor || readOnly) return

    const scheduleSync = () => {
      if (selectionChangeTimerRef.current) clearTimeout(selectionChangeTimerRef.current)
      selectionChangeTimerRef.current = setTimeout(() => {
        if (!isPointerDownInEditorRef.current) {
          syncMenuFromEditor()
        }
      }, 24)
    }

    const onSelectionUpdate = () => {
      if (isPointerDownInEditorRef.current) {
        return
      }
      syncMenuFromEditor()
    }

    const onTransaction = () => {
      if (!isPointerDownInEditorRef.current) {
        forceUpdate((n) => (n + 1) % 100000)
      }
    }

    const onDomSelectionChange = () => {
      if (isPointerDownInEditorRef.current) return
      scheduleSync()
    }

    editor.on('selectionUpdate', onSelectionUpdate)
    editor.on('transaction', onTransaction)
    document.addEventListener('selectionchange', onDomSelectionChange)
    return () => {
      editor.off('selectionUpdate', onSelectionUpdate)
      editor.off('transaction', onTransaction)
      document.removeEventListener('selectionchange', onDomSelectionChange)
      if (selectionChangeTimerRef.current) clearTimeout(selectionChangeTimerRef.current)
    }
  }, [editor, readOnly, syncMenuFromEditor])

  // Pointer drag guard + outside click dismissal + Escape key + dblclick/keyup reliability
  useEffect(() => {
    if (!editor || readOnly) return

    const onPointerDown = (e: PointerEvent) => {
      const target = e.target as Node | null
      if (!target) return

      // Clicked inside floating menu or its sub-popover -> keep open
      if (menuRef.current?.contains(target) || subMenuRef.current?.contains(target)) {
        return
      }

      // Clicked inside editor -> user might be starting a drag selection
      if (editor.view.dom.contains(target)) {
        isPointerDownInEditorRef.current = true
        setOpenSubMenu(null)
        return
      }

      // Clicked outside both editor and floating menu (and not inside text color popover)
      const isColorPopover = (target as HTMLElement)?.closest?.('[data-text-color-popover]')
      if (!isColorPopover) {
        isPointerDownInEditorRef.current = false
        closeAll()
      }
    }

    const finishPointerInteraction = () => {
      if (isPointerDownInEditorRef.current) {
        isPointerDownInEditorRef.current = false
      }
      // Double RAF / short delay ensures double-click & triple-click selections are finalized
      requestAnimationFrame(() => {
        syncMenuFromEditor()
      })
      setTimeout(() => {
        if (!isPointerDownInEditorRef.current) {
          syncMenuFromEditor()
        }
      }, 45)
    }

    const onDblClick = (e: MouseEvent) => {
      const target = e.target as Node | null
      if (target && editor.view.dom.contains(target)) {
        isPointerDownInEditorRef.current = false
        requestAnimationFrame(() => syncMenuFromEditor())
        setTimeout(() => syncMenuFromEditor(), 50)
      }
    }

    const onKeyUp = (e: KeyboardEvent) => {
      if (e.key === 'Shift' || e.key.startsWith('Arrow') || (e.ctrlKey && e.key.toLowerCase() === 'a') || (e.metaKey && e.key.toLowerCase() === 'a')) {
        isPointerDownInEditorRef.current = false
        requestAnimationFrame(() => syncMenuFromEditor())
      }
    }

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (openSubMenu) {
          setOpenSubMenu(null)
        } else if (selectionRect) {
          const { from, to } = editor.state.selection
          dismissedSelectionKeyRef.current = `${from}:${to}`
          closeAll()
        }
      }
    }

    document.addEventListener('pointerdown', onPointerDown, true)
    window.addEventListener('pointerup', finishPointerInteraction, true)
    window.addEventListener('pointercancel', finishPointerInteraction, true)
    window.addEventListener('mouseup', finishPointerInteraction, true)
    document.addEventListener('dblclick', onDblClick, true)
    window.addEventListener('keyup', onKeyUp)
    window.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown, true)
      window.removeEventListener('pointerup', finishPointerInteraction, true)
      window.removeEventListener('pointercancel', finishPointerInteraction, true)
      window.removeEventListener('mouseup', finishPointerInteraction, true)
      document.removeEventListener('dblclick', onDblClick, true)
      window.removeEventListener('keyup', onKeyUp)
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [editor, readOnly, openSubMenu, selectionRect, closeAll, syncMenuFromEditor])

  // Reposition smoothly on scroll (capture phase catches scrolling inside any container) and window resize
  const hasSelectionRect = selectionRect !== null
  useEffect(() => {
    if (!hasSelectionRect) return

    const handleViewportChange = () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
      rafRef.current = requestAnimationFrame(() => {
        const nextRect = computeSelectionRect()
        if (!nextRect) {
          setSelectionRect(null)
          setOpenSubMenu(null)
        } else {
          setSelectionRect(nextRect)
        }
      })
    }

    window.addEventListener('scroll', handleViewportChange, true)
    window.addEventListener('resize', handleViewportChange)
    return () => {
      window.removeEventListener('scroll', handleViewportChange, true)
      window.removeEventListener('resize', handleViewportChange)
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
    }
  }, [hasSelectionRect, computeSelectionRect])

  // Measure actual toolbar dimensions and clamp cleanly inside viewport (auto-flip below if near top)
  useLayoutEffect(() => {
    if (!selectionRect || !menuRef.current) return

    const menuEl = menuRef.current
    const menuW = Math.min(menuEl.offsetWidth || 420, window.innerWidth - 24)
    const menuH = menuEl.offsetHeight || 42
    const margin = 12
    const gap = 10

    const centerX = selectionRect.left + selectionRect.width / 2
    const left = Math.max(margin, Math.min(window.innerWidth - menuW - margin, centerX - menuW / 2))

    let top = selectionRect.top - menuH - gap
    if (top < 54) {
      // Flip below selection when near top bar
      top = selectionRect.bottom + gap
      if (top + menuH > window.innerHeight - margin) {
        top = Math.max(54, window.innerHeight - menuH - margin)
      }
    }

    setMenuCoords({ left, top, ready: true })
  }, [selectionRect])

  const openAnchoredSubMenu = (type: SubMenuType, triggerEl: HTMLElement | null, popoverWidth = 200) => {
    if (openSubMenu === type) {
      setOpenSubMenu(null)
      return
    }
    if (!triggerEl) return
    const rect = triggerEl.getBoundingClientRect()
    const margin = 12
    const left = Math.max(
      margin,
      Math.min(window.innerWidth - popoverWidth - margin, rect.left + rect.width / 2 - popoverWidth / 2)
    )
    const preferBelow = rect.bottom + 8 + 220 < window.innerHeight
    const top = preferBelow ? rect.bottom + 8 : Math.max(54, rect.top - 8 - 180)
    setSubMenuPos({ top, left })
    if (type === 'link' && editor) {
      setLinkUrl(editor.getAttributes('link')?.href || '')
    }
    setOpenSubMenu(type)
  }

  // Text case transform helper
  const transformSelectedCase = (mode: 'upper' | 'lower' | 'title') => {
    if (!editor) return
    const { from, to } = editor.state.selection
    const text = editor.state.doc.textBetween(from, to, '\n')
    if (!text) return
    let next = text
    if (mode === 'upper') next = text.toUpperCase()
    else if (mode === 'lower') next = text.toLowerCase()
    else if (mode === 'title') {
      next = text.replace(/\b\p{L}/gu, (c) => c.toUpperCase())
    }
    editor.chain().focus().insertContentAt({ from, to }, next).run()
    setOpenSubMenu(null)
  }

  const handleCopySelection = async () => {
    if (!editor) return
    const { from, to } = editor.state.selection
    const text = editor.state.doc.textBetween(from, to, '\n')
    if (!text) return
    try {
      await navigator.clipboard.writeText(text)
      toast.success('Texto copiado')
    } catch {
      toast.error('No se pudo copiar')
    }
    setOpenSubMenu(null)
  }

  const handleApplyLink = () => {
    if (!editor) return
    const trimmed = linkUrl.trim()
    if (!trimmed) {
      editor.chain().focus().extendMarkRange('link').unsetLink().run()
      setOpenSubMenu(null)
      return
    }
    const normalized = /^(https?:\/\/|mailto:|tel:|#)/i.test(trimmed)
      ? trimmed
      : `https://${trimmed}`
    editor.chain().focus().extendMarkRange('link').setLink({ href: normalized }).run()
    setOpenSubMenu(null)
    toast.success('Enlace aplicado')
  }

  if (!editor || readOnly || !selectionRect) return null

  const activeBlockLabel = editor.isActive('heading', { level: 1 })
    ? 'H1'
    : editor.isActive('heading', { level: 2 })
    ? 'H2'
    : editor.isActive('heading', { level: 3 })
    ? 'H3'
    : editor.isActive('bulletList')
    ? 'Lista'
    : editor.isActive('orderedList')
    ? '1. Lista'
    : editor.isActive('taskList')
    ? 'Tareas'
    : editor.isActive('blockquote')
    ? 'Cita'
    : 'Texto'

  const activeAlign = editor.isActive({ textAlign: 'center' })
    ? 'center'
    : editor.isActive({ textAlign: 'right' })
    ? 'right'
    : editor.isActive({ textAlign: 'justify' })
    ? 'justify'
    : 'left'

  const AlignActiveIcon =
    activeAlign === 'center'
      ? AlignCenter
      : activeAlign === 'right'
      ? AlignRight
      : activeAlign === 'justify'
      ? AlignJustify
      : AlignLeft

  const isHighlighted = editor.isActive('highlight')
  const isLinkActive = editor.isActive('link')

  const btnCls = (active: boolean) =>
    `h-7 min-w-7 px-1.5 rounded-full flex items-center justify-center transition-all duration-100 cursor-pointer shrink-0 active:scale-95 ${
      active
        ? 'bg-[#2383E2]/28 text-[#79BDFF] ring-1 ring-[#2383E2]/50'
        : 'text-zinc-300 hover:text-white hover:bg-white/12'
    }`

  return createPortal(
    <>
      <div
        ref={menuRef}
        role="toolbar"
        aria-label="Formato de texto"
        onMouseDown={(e) => {
          // Prevent stealing focus from TipTap editor
          e.preventDefault()
        }}
        style={{
          position: 'fixed',
          left: `${menuCoords.left}px`,
          top: `${menuCoords.top}px`,
          opacity: menuCoords.ready ? 1 : 0,
          transition: 'opacity 100ms ease, left 90ms ease-out, top 90ms ease-out'
        }}
        className="z-[95] pill-capsule-bar flex items-center gap-0.5 px-2 py-1.5 rounded-full text-white max-w-[calc(100vw-24px)] overflow-x-auto no-scrollbar select-none"
      >
        {/* Split Highlight ("Destacar") Pill Button */}
        <div className="flex items-center shrink-0 rounded-full overflow-hidden bg-[#7c5cfc] hover:bg-[#6c4be8] shadow-[0_4px_14px_rgba(124,92,252,0.35)] transition-colors">
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() =>
              (editor.chain().focus() as any)
                .toggleMark('highlight', { color: lastHighlightColor })
                .run()
            }
            className={`h-7 pl-3 pr-1.5 text-[11.5px] font-semibold flex items-center gap-1 transition cursor-pointer hover:bg-white/10 ${
              isHighlighted ? 'text-amber-200' : 'text-white'
            }`}
            title="Destacar texto seleccionado"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span className="hidden xs:inline sm:inline">Destacar</span>
          </button>
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={(e) => openAnchoredSubMenu('highlight', e.currentTarget, 196)}
            className="h-7 pl-1 pr-2 border-l border-white/20 hover:bg-white/15 flex items-center justify-center transition cursor-pointer"
            title="Elegir color de resaltado"
          >
            <ChevronDown className="w-3 h-3" />
          </button>
        </div>

        <div className="w-px h-4 bg-white/12 mx-1 shrink-0" />

        {/* Block Type Dropdown ("Texto ▾" / H1 / H2 / H3 / Lists / Quote) */}
        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={(e) => openAnchoredSubMenu('block', e.currentTarget, 184)}
          className={`h-7 px-2.5 rounded-full text-[11.5px] font-medium flex items-center gap-1 transition cursor-pointer shrink-0 active:scale-95 ${
            openSubMenu === 'block' || activeBlockLabel !== 'Texto'
              ? 'bg-white/14 text-white'
              : 'text-zinc-200 hover:text-white hover:bg-white/12'
          }`}
          title="Cambiar tipo de bloque (H1, H2, H3, Lista, Cita)"
        >
          <span>{activeBlockLabel}</span>
          <ChevronDown className="w-3 h-3 opacity-75" />
        </button>

        <div className="w-px h-4 bg-white/12 mx-1 shrink-0" />

        {/* Core Inline Formatting */}
        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => editor.chain().focus().toggleBold().run()}
          className={btnCls(editor.isActive('bold'))}
          title="Negrita (Ctrl+B)"
        >
          <Bold className="w-3.5 h-3.5" />
        </button>

        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => editor.chain().focus().toggleItalic().run()}
          className={btnCls(editor.isActive('italic'))}
          title="Cursiva (Ctrl+I)"
        >
          <Italic className="w-3.5 h-3.5" />
        </button>

        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => editor.chain().focus().toggleUnderline().run()}
          className={btnCls(editor.isActive('underline'))}
          title="Subrayado (Ctrl+U)"
        >
          <Underline className="w-3.5 h-3.5" />
        </button>

        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => editor.chain().focus().toggleStrike().run()}
          className={btnCls(editor.isActive('strike'))}
          title="Tachado (Ctrl+Shift+S)"
        >
          <Strikethrough className="w-3.5 h-3.5" />
        </button>

        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => editor.chain().focus().toggleCode().run()}
          className={btnCls(editor.isActive('code'))}
          title="Código en línea (Ctrl+E)"
        >
          <Code className="w-3.5 h-3.5" />
        </button>

        {/* Link Button */}
        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={(e) => openAnchoredSubMenu('link', e.currentTarget, 260)}
          className={btnCls(isLinkActive || openSubMenu === 'link')}
          title="Añadir o editar enlace"
        >
          <Link2 className="w-3.5 h-3.5" />
        </button>

        {/* Text Color Button */}
        <button
          ref={colorBtnRef}
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => {
            setOpenSubMenu(null)
            onToggleColorPicker()
          }}
          className={`h-7 w-7 rounded-full flex flex-col items-center justify-center transition cursor-pointer shrink-0 active:scale-95 ${
            isColorPickerOpen
              ? 'bg-[#2383E2]/28 text-[#79BDFF] ring-1 ring-[#2383E2]/50'
              : 'text-zinc-300 hover:text-white hover:bg-white/12'
          }`}
          title="Color de texto"
        >
          <span className="text-[11px] font-bold leading-none">A</span>
          <span
            className="w-3.5 h-[2.5px] rounded-full mt-0.5"
            style={{ backgroundColor: activeTextColor || '#ffffff' }}
          />
        </button>

        <div className="w-px h-4 bg-white/12 mx-1 shrink-0" />

        {/* Compact Alignment Dropdown */}
        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={(e) => openAnchoredSubMenu('align', e.currentTarget, 148)}
          className={`h-7 px-2 rounded-full flex items-center gap-0.5 transition cursor-pointer shrink-0 active:scale-95 ${
            openSubMenu === 'align'
              ? 'bg-white/15 text-white'
              : 'text-zinc-300 hover:text-white hover:bg-white/12'
          }`}
          title="Alineación de texto"
        >
          <AlignActiveIcon className="w-3.5 h-3.5" />
          <ChevronDown className="w-2.5 h-2.5 opacity-70" />
        </button>

        {/* More Actions Dropdown (Case, Sup/Sub, Copy, Emoji, Clear Format) */}
        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={(e) => openAnchoredSubMenu('more', e.currentTarget, 200)}
          className={`h-7 w-7 rounded-full flex items-center justify-center transition cursor-pointer shrink-0 active:scale-95 ${
            openSubMenu === 'more'
              ? 'bg-white/15 text-white'
              : 'text-zinc-300 hover:text-white hover:bg-white/12'
          }`}
          title="Más opciones (Mayúsculas, Superíndice, Copiar, Limpiar formato)"
        >
          <MoreHorizontal className="w-3.5 h-3.5" />
        </button>

        {/* Dismiss Button */}
        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => {
            const { from, to } = editor.state.selection
            dismissedSelectionKeyRef.current = `${from}:${to}`
            closeAll()
          }}
          className="btn-pill-circle w-6 h-6 ml-0.5 cursor-pointer shrink-0"
          title="Cerrar barra (Esc)"
        >
          <X className="w-3 h-3" />
        </button>
      </div>

      {/* Portal Sub-Popovers (never clipped by overflow-x-auto!) */}
      {openSubMenu && (
        <div
          ref={subMenuRef}
          onMouseDown={(e) => {
            // Allow focusing the URL input inside the link popover
            if (openSubMenu !== 'link') e.preventDefault()
          }}
          style={{
            position: 'fixed',
            top: `${subMenuPos.top}px`,
            left: `${subMenuPos.left}px`
          }}
          className="z-[110] rounded-2xl border border-white/12 bg-[#1E1E22]/96 backdrop-blur-xl text-white shadow-[0_12px_36px_rgba(0,0,0,0.4)] animate-in fade-in zoom-in-95 duration-100 select-none"
        >
          {/* HIGHLIGHT COLORS POPOVER */}
          {openSubMenu === 'highlight' && (
            <div className="p-2.5 w-[196px] space-y-2">
              <div className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
                Color de resaltado
              </div>
              <div className="grid grid-cols-6 gap-1.5">
                {HIGHLIGHT_SWATCHES.map((s) => (
                  <button
                    key={s.color}
                    type="button"
                    onClick={() => {
                      setLastHighlightColor(s.color)
                      ;(editor.chain().focus() as any)
                        .setMark('highlight', { color: s.color })
                        .run()
                      setOpenSubMenu(null)
                    }}
                    className="w-6 h-6 rounded-md border border-black/20 hover:scale-110 transition cursor-pointer"
                    style={{ backgroundColor: s.color }}
                    title={s.label}
                  />
                ))}
              </div>
              {isHighlighted && (
                <button
                  type="button"
                  onClick={() => {
                    ;(editor.chain().focus() as any).unsetMark('highlight').run()
                    setOpenSubMenu(null)
                  }}
                  className="w-full py-1 rounded-md text-[11px] text-zinc-300 hover:text-white hover:bg-white/10 transition cursor-pointer"
                >
                  Quitar resaltado
                </button>
              )}
            </div>
          )}

          {/* BLOCK TYPE / TURN INTO POPOVER */}
          {openSubMenu === 'block' && (
            <div className="p-1.5 w-[184px] space-y-0.5 text-xs">
              {[
                {
                  label: 'Párrafo',
                  icon: Type,
                  active: editor.isActive('paragraph') && !editor.isActive('blockquote'),
                  action: () => editor.chain().focus().setParagraph().run()
                },
                {
                  label: 'Título 1 (H1)',
                  icon: Heading1,
                  active: editor.isActive('heading', { level: 1 }),
                  action: () => editor.chain().focus().toggleHeading({ level: 1 }).run()
                },
                {
                  label: 'Título 2 (H2)',
                  icon: Heading2,
                  active: editor.isActive('heading', { level: 2 }),
                  action: () => editor.chain().focus().toggleHeading({ level: 2 }).run()
                },
                {
                  label: 'Título 3 (H3)',
                  icon: Heading3,
                  active: editor.isActive('heading', { level: 3 }),
                  action: () => editor.chain().focus().toggleHeading({ level: 3 }).run()
                },
                {
                  label: 'Lista con viñetas',
                  icon: List,
                  active: editor.isActive('bulletList'),
                  action: () => editor.chain().focus().toggleBulletList().run()
                },
                {
                  label: 'Lista numerada',
                  icon: ListOrdered,
                  active: editor.isActive('orderedList'),
                  action: () => editor.chain().focus().toggleOrderedList().run()
                },
                {
                  label: 'Lista de tareas',
                  icon: CheckSquare,
                  active: editor.isActive('taskList'),
                  action: () => editor.chain().focus().toggleTaskList().run()
                },
                {
                  label: 'Cita',
                  icon: Quote,
                  active: editor.isActive('blockquote'),
                  action: () => editor.chain().focus().toggleBlockquote().run()
                }
              ].map((item) => {
                const Icon = item.icon
                return (
                  <button
                    key={item.label}
                    type="button"
                    onClick={() => {
                      item.action()
                      setOpenSubMenu(null)
                    }}
                    className={`w-full px-2 py-1.5 rounded-lg flex items-center justify-between gap-2 transition cursor-pointer ${
                      item.active
                        ? 'bg-[#2383E2]/25 text-[#79BDFF]'
                        : 'text-zinc-200 hover:bg-white/10'
                    }`}
                  >
                    <span className="flex items-center gap-2">
                      <Icon className="w-3.5 h-3.5 opacity-85" />
                      <span>{item.label}</span>
                    </span>
                    {item.active && <Check className="w-3 h-3" />}
                  </button>
                )
              })}
            </div>
          )}

          {/* ALIGNMENT POPOVER */}
          {openSubMenu === 'align' && (
            <div className="p-1.5 flex items-center gap-1">
              {(
                [
                  { id: 'left', label: 'Izquierda', icon: AlignLeft },
                  { id: 'center', label: 'Centro', icon: AlignCenter },
                  { id: 'right', label: 'Derecha', icon: AlignRight },
                  { id: 'justify', label: 'Justificar', icon: AlignJustify }
                ] as const
              ).map(({ id, label, icon: Icon }) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => {
                    editor.chain().focus().setTextAlign(id).run()
                    setOpenSubMenu(null)
                  }}
                  className={btnCls(editor.isActive({ textAlign: id }))}
                  title={label}
                >
                  <Icon className="w-3.5 h-3.5" />
                </button>
              ))}
            </div>
          )}

          {/* LINK INPUT POPOVER */}
          {openSubMenu === 'link' && (
            <div className="p-2.5 w-[260px] space-y-2">
              <div className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
                Insertar o editar enlace
              </div>
              <div className="flex items-center gap-1.5">
                <input
                  type="url"
                  value={linkUrl}
                  onChange={(e) => setLinkUrl(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      handleApplyLink()
                    }
                    if (e.key === 'Escape') setOpenSubMenu(null)
                  }}
                  placeholder="https://ejemplo.com"
                  autoFocus
                  className="flex-1 px-2 py-1 text-xs rounded-lg bg-white/8 border border-white/15 text-white placeholder:text-zinc-500 outline-none focus:border-[#2383E2]"
                />
                <button
                  type="button"
                  onClick={handleApplyLink}
                  className="px-2.5 py-1 rounded-lg bg-[#2383E2] hover:bg-[#1c72c8] text-white text-xs font-medium cursor-pointer"
                >
                  OK
                </button>
              </div>
              {isLinkActive && (
                <div className="flex items-center justify-between pt-1 border-t border-white/10 text-[11px]">
                  <a
                    href={editor.getAttributes('link')?.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 text-sky-400 hover:underline truncate max-w-[155px]"
                  >
                    <ExternalLink className="w-3 h-3 shrink-0" />
                    <span className="truncate">Abrir enlace</span>
                  </a>
                  <button
                    type="button"
                    onClick={() => {
                      editor.chain().focus().extendMarkRange('link').unsetLink().run()
                      setOpenSubMenu(null)
                    }}
                    className="flex items-center gap-1 text-rose-400 hover:text-rose-300 cursor-pointer"
                  >
                    <Unlink className="w-3 h-3" />
                    <span>Quitar</span>
                  </button>
                </div>
              )}
            </div>
          )}

          {/* MORE ACTIONS POPOVER */}
          {openSubMenu === 'more' && (
            <div className="p-1.5 w-[200px] space-y-0.5 text-xs">
              <div className="grid grid-cols-2 gap-1 pb-1 mb-1 border-b border-white/10">
                <button
                  type="button"
                  onClick={() => {
                    ;(editor.chain().focus() as any).toggleMark('superscript').run()
                    setOpenSubMenu(null)
                  }}
                  className={`py-1.5 px-2 rounded-lg flex items-center justify-center gap-1 transition cursor-pointer ${
                    editor.isActive('superscript')
                      ? 'bg-[#2383E2]/25 text-[#79BDFF]'
                      : 'text-zinc-200 hover:bg-white/10'
                  }`}
                >
                  <Superscript className="w-3.5 h-3.5" />
                  <span className="text-[11px]">Sup</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    ;(editor.chain().focus() as any).toggleMark('subscript').run()
                    setOpenSubMenu(null)
                  }}
                  className={`py-1.5 px-2 rounded-lg flex items-center justify-center gap-1 transition cursor-pointer ${
                    editor.isActive('subscript')
                      ? 'bg-[#2383E2]/25 text-[#79BDFF]'
                      : 'text-zinc-200 hover:bg-white/10'
                  }`}
                >
                  <Subscript className="w-3.5 h-3.5" />
                  <span className="text-[11px]">Sub</span>
                </button>
              </div>

              <button
                type="button"
                onClick={() => transformSelectedCase('upper')}
                className="w-full px-2 py-1.5 rounded-lg flex items-center gap-2 text-zinc-200 hover:bg-white/10 transition cursor-pointer"
              >
                <CaseUpper className="w-3.5 h-3.5 opacity-80" />
                <span>MAYÚSCULAS</span>
              </button>
              <button
                type="button"
                onClick={() => transformSelectedCase('lower')}
                className="w-full px-2 py-1.5 rounded-lg flex items-center gap-2 text-zinc-200 hover:bg-white/10 transition cursor-pointer"
              >
                <CaseLower className="w-3.5 h-3.5 opacity-80" />
                <span>minúsculas</span>
              </button>
              <button
                type="button"
                onClick={() => transformSelectedCase('title')}
                className="w-full px-2 py-1.5 rounded-lg flex items-center gap-2 text-zinc-200 hover:bg-white/10 transition cursor-pointer"
              >
                <CaseSensitive className="w-3.5 h-3.5 opacity-80" />
                <span>Capitalizar Palabras</span>
              </button>

              <div className="my-1 border-t border-white/10" />

              <button
                type="button"
                onClick={handleCopySelection}
                className="w-full px-2 py-1.5 rounded-lg flex items-center gap-2 text-zinc-200 hover:bg-white/10 transition cursor-pointer"
              >
                <Copy className="w-3.5 h-3.5 opacity-80" />
                <span>Copiar selección</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setOpenSubMenu(null)
                  onOpenEmojiPicker()
                }}
                className="w-full px-2 py-1.5 rounded-lg flex items-center gap-2 text-zinc-200 hover:bg-white/10 transition cursor-pointer"
              >
                <AppleEmoji emoji="✨" size={14} />
                <span>Insertar Emoji</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  editor.chain().focus().unsetAllMarks().clearNodes().run()
                  setOpenSubMenu(null)
                  toast.success('Formato limpiado')
                }}
                className="w-full px-2 py-1.5 rounded-lg flex items-center gap-2 text-rose-400 hover:bg-rose-500/15 transition cursor-pointer"
              >
                <RemoveFormatting className="w-3.5 h-3.5" />
                <span>Limpiar formato</span>
              </button>
            </div>
          )}
        </div>
      )}
    </>,
    document.body
  )
}
