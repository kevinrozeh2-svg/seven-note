import { memo, useState, useEffect, useRef } from 'react'
import {
  DeleteIcon,
  AlignLeftIcon,
  AlignHorizontalCenterIcon,
  AlignRightIcon
} from '@blocksuite/icons/rc'
import { toast } from 'sonner'
import { db } from '../../../db'
import { syncEngine } from '../../../lib/syncEngine'
import { areNodePropsEqual, NodeHandles, SourceNodeBadge } from './nodeUtils'
import { renderWithAppleEmoji } from '../../ui/AppleEmoji'
import { FONT_FAMILIES, type FontOption } from '../../../lib/fonts'
import { FontPickerPopover } from './FontPickerPopover'
import {
  hasHtmlFormatting,
  cleanPastedHtml,
  cleanPastedText,
  sanitizeHtmlContent,
  isPdfHtml,
  isPdfOrStructuredText,
  isLegalContractOrPdfText,
  cleanPdfContent
} from '../../../lib/pasteUtils'

export { FONT_FAMILIES }
export type { FontOption }

const TEXT_COLORS: Record<string, string> = {
  white: 'text-[var(--app-text-primary)]',
  slate: 'text-[var(--app-text-secondary)]',
  blue: 'text-sky-600 dark:text-sky-400',
  green: 'text-emerald-600 dark:text-emerald-400',
  yellow: 'text-amber-600 dark:text-amber-400',
  rose: 'text-rose-600 dark:text-rose-400',
  purple: 'text-purple-600 dark:text-purple-400'
}

const FONT_SIZES: Record<string, { class: string; label: string }> = {
  sm: { class: 'text-xs', label: 'P' },
  base: { class: 'text-sm font-medium', label: 'M' },
  lg: { class: 'text-lg font-bold', label: 'H2' },
  xl: { class: 'text-2xl font-extrabold', label: 'H1' }
}

export const TextNode = memo(({ id, data, selected }: any) => {
  const [content, setContent] = useState(data.content || '')
  const [color, setColor] = useState(data.color || 'white')
  const [fontFamily, setFontFamily] = useState(data.fontFamily || 'Inter, system-ui, sans-serif')
  const [size, setSize] = useState<'sm' | 'base' | 'lg' | 'xl'>(data.fontSize || 'base')
  const [align, setAlign] = useState<'left' | 'center' | 'right'>(data.textAlign || 'left')
  const [isEditing, setIsEditing] = useState(false)
  const [showFontMenu, setShowFontMenu] = useState(false)
  const contentEditableRef = useRef<HTMLDivElement | null>(null)
  const fontMenuRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (data.content !== undefined) setContent(data.content)
    if (data.color !== undefined) setColor(data.color)
    if (data.fontSize) setSize(data.fontSize)
    if (data.textAlign) setAlign(data.textAlign)
    if (data.fontFamily) setFontFamily(data.fontFamily)
  }, [data.content, data.color, data.fontSize, data.textAlign, data.fontFamily])

  // Sync content into contentEditable element when entering edit mode
  useEffect(() => {
    if (isEditing && contentEditableRef.current) {
      const el = contentEditableRef.current
      if (hasHtmlFormatting(content)) {
        el.innerHTML = sanitizeHtmlContent(content)
      } else if (content) {
        el.innerText = content
      } else {
        el.innerHTML = ''
      }
      el.focus()
      try {
        const range = document.createRange()
        range.selectNodeContents(el)
        range.collapse(false)
        const sel = window.getSelection()
        sel?.removeAllRanges()
        sel?.addRange(range)
      } catch {
        // ignore selection errors
      }
    }
  }, [isEditing])

  // Paste formatted text directly into selected text node on canvas
  useEffect(() => {
    if (!selected || isEditing) return

    const handleCardPaste = (e: ClipboardEvent) => {
      const activeEl = document.activeElement
      if (
        activeEl &&
        (activeEl.tagName === 'INPUT' ||
          activeEl.tagName === 'TEXTAREA' ||
          (activeEl as HTMLElement).isContentEditable)
      ) {
        return
      }

      const html = e.clipboardData?.getData('text/html')
      const text = e.clipboardData?.getData('text/plain')

      let clean = ''
      const isPdf = Boolean(
        (html && isPdfHtml(html)) ||
        (text && (isPdfOrStructuredText(text) || isLegalContractOrPdfText(text)))
      )

      if (isPdf) {
        clean = cleanPdfContent(html || '', text || '')
      } else if (html && hasHtmlFormatting(html)) {
        clean = cleanPastedHtml(html || '')
      }

      if (clean && clean.trim()) {
        e.preventDefault()
        const updated = content && content.trim() ? `${content}<br/>${clean}` : clean
        setContent(updated)
        save({ content: updated })
        toast.success(isPdf ? 'Texto de PDF pegado con formato' : 'Formato de texto conservado')
      } else if (text && text.trim()) {
        e.preventDefault()
        const cleanedText = cleanPastedText(text)
        const updated = content && content.trim() ? `${content}\n${cleanedText}` : cleanedText
        setContent(updated)
        save({ content: updated })
      }
    }

    window.addEventListener('paste', handleCardPaste)
    return () => window.removeEventListener('paste', handleCardPaste)
  }, [selected, isEditing, content])

  const handlePaste = (e: React.ClipboardEvent<HTMLDivElement>) => {
    e.preventDefault()
    const html = e.clipboardData.getData('text/html')
    const text = e.clipboardData.getData('text/plain')

    let clean = ''
    const isPdf = Boolean(
      (html && isPdfHtml(html)) ||
      (text && (isPdfOrStructuredText(text) || isLegalContractOrPdfText(text)))
    )

    if (isPdf) {
      clean = cleanPdfContent(html, text || '')
    } else if (html && hasHtmlFormatting(html)) {
      clean = cleanPastedHtml(html)
    }

    if (clean && clean.trim()) {
      document.execCommand('insertHTML', false, clean)
    } else if (text) {
      document.execCommand('insertText', false, cleanPastedText(text))
    }

    if (contentEditableRef.current) {
      const htmlVal = contentEditableRef.current.innerHTML
      setContent(htmlVal)
      save({ content: htmlVal })
    }
  }

  const handleBlur = () => {
    setIsEditing(false)
    if (contentEditableRef.current) {
      const htmlVal = contentEditableRef.current.innerHTML
      setContent(htmlVal)
      save({ content: htmlVal })
    }
  }

  // Close font menu on outside click
  useEffect(() => {
    if (!showFontMenu) return
    const handleClickOutside = (e: MouseEvent) => {
      if (fontMenuRef.current && !fontMenuRef.current.contains(e.target as Node)) {
        setShowFontMenu(false)
      }
    }
    window.addEventListener('mousedown', handleClickOutside)
    return () => window.removeEventListener('mousedown', handleClickOutside)
  }, [showFontMenu])



  const save = async (updates: any) => {
    try {
      const node = await db.canvasNodes.get(id)
      if (node) {
        await db.canvasNodes.update(id, {
          data: { ...node.data, ...updates },
          updatedAt: Date.now(),
          syncStatus: 'pending'
        })
        syncEngine.scheduleSync(1200)
      }
    } catch (e) {
      console.error('Error saving text node', e)
    }
  }

  const handleDelete = async () => {
    try {
      await db.canvasNodes.update(id, {
        isDeleted: true,
        updatedAt: Date.now(),
        syncStatus: 'pending'
      })
      syncEngine.scheduleSync(1000)
    } catch (e) {
      console.error('Error deleting text node', e)
    }
  }

  const currentFont = FONT_FAMILIES.find((f) => f.family === fontFamily) || FONT_FAMILIES[0]
  const textColorClass = TEXT_COLORS[color] || TEXT_COLORS.white
  const fontSizeClass = FONT_SIZES[size]?.class || FONT_SIZES.base.class
  const isConnectorActive = Boolean(data?.isConnectorActive)
  const isConnectSource = Boolean(data?.isConnectSource)

  return (
    <div
      className={`relative min-w-[120px] max-w-[440px] p-2 rounded-lg transition group ${
        selected
          ? 'ring-1 ring-[var(--app-accent)] bg-[var(--app-hover)]'
          : 'hover:bg-[var(--app-hover)]'
      } ${
        isConnectSource
          ? 'ring-4 ring-amber-500 bg-amber-500/10 shadow-xl shadow-amber-500/25 scale-[1.02]'
          : isConnectorActive
          ? 'ring-1 ring-blue-500/40 hover:ring-2 hover:ring-blue-500 cursor-pointer'
          : ''
      }`}
    >
      <SourceNodeBadge isConnectSource={isConnectSource} isConnectorActive={isConnectorActive} />
      <NodeHandles
        selected={selected}
        isConnectorActive={isConnectorActive}
        isConnectSource={isConnectSource}
      />

      {/* Floating Toolbar when selected */}
      {selected && (
        <div
          className="absolute -top-11 left-0 z-40 flex items-center gap-1.5 p-1 rounded-xl border shadow-lg bg-[var(--app-bg-overlay)] border-[var(--app-border)] text-[var(--app-text-primary)] backdrop-blur-md animate-in fade-in zoom-in-95 duration-100"
        >
          {/* Typography Picker Button */}
          <div className="relative" ref={fontMenuRef}>
            <button
              onClick={() => setShowFontMenu(!showFontMenu)}
              className="flex items-center gap-1.5 px-2 py-0.5 rounded-lg text-xs font-medium hover:bg-[var(--affine-hover-color)] transition border border-[var(--affine-border-color)] max-w-[140px] cursor-pointer"
              title="Elegir tipografía"
            >
              <span className="truncate" style={{ fontFamily: currentFont.family }}>
                {currentFont.name}
              </span>
              <span className="text-[9px] text-[var(--affine-text-secondary-color)]">▼</span>
            </button>

            <FontPickerPopover
              isOpen={showFontMenu}
              onClose={() => setShowFontMenu(false)}
              currentFamily={fontFamily}
              onSelect={(family) => {
                setFontFamily(family)
                save({ fontFamily: family })
              }}
            />
          </div>

          <div
            className="w-[1px] h-3.5 bg-[var(--affine-border-color)]"
          />

          {/* Size buttons */}
          {(['sm', 'base', 'lg', 'xl'] as const).map((s) => (
            <button
              key={s}
              onClick={() => {
                setSize(s)
                save({ fontSize: s })
              }}
              className="px-1.5 py-0.5 rounded text-[10px] font-bold transition"
              style={{
                backgroundColor: size === s ? '#1e96eb' : 'transparent',
                color: size === s ? '#ffffff' : 'var(--affine-text-secondary-color)'
              }}
            >
              {FONT_SIZES[s].label}
            </button>
          ))}

          <div
            className="w-[1px] h-3.5 bg-[var(--affine-border-color)]"
          />

          {/* Alignment */}
          <button
            onClick={() => {
              const nextAlign = align === 'left' ? 'center' : align === 'center' ? 'right' : 'left'
              setAlign(nextAlign)
              save({ textAlign: nextAlign })
            }}
            className="p-1 rounded transition hover:bg-[var(--affine-hover-color)]"
            style={{ color: 'var(--affine-text-secondary-color)' }}
            title="Alineación de texto"
          >
            {align === 'left' ? (
              <AlignLeftIcon style={{ width: 14, height: 14 }} />
            ) : align === 'center' ? (
              <AlignHorizontalCenterIcon style={{ width: 14, height: 14 }} />
            ) : (
              <AlignRightIcon style={{ width: 14, height: 14 }} />
            )}
          </button>

          <div
            className="w-[1px] h-3.5 bg-[var(--affine-border-color)]"
          />

          {/* Colors */}
          {['white', 'slate', 'blue', 'green', 'yellow', 'rose', 'purple'].map((col) => (
            <button
              key={col}
              onClick={() => {
                setColor(col)
                save({ color: col })
              }}
              className={`w-3.5 h-3.5 rounded-full ${
                col === 'white'
                  ? 'bg-zinc-100'
                  : col === 'slate'
                  ? 'bg-zinc-400'
                  : col === 'blue'
                  ? 'bg-sky-400'
                  : col === 'green'
                  ? 'bg-emerald-400'
                  : col === 'yellow'
                  ? 'bg-amber-400'
                  : col === 'rose'
                  ? 'bg-rose-400'
                  : 'bg-purple-400'
              } ${color === col ? 'ring-2 ring-[#1e96eb]' : ''}`}
            />
          ))}

          <div
            className="w-[1px] h-3.5 bg-[var(--affine-border-color)]"
          />

          {/* Delete */}
          <button
            onClick={handleDelete}
            className="p-1 rounded text-rose-500 hover:bg-rose-500/10 transition"
            title="Eliminar texto"
          >
            <DeleteIcon style={{ width: 13, height: 13 }} />
          </button>
        </div>
      )}

      {/* Text Body */}
      {isEditing ? (
        <div
          ref={contentEditableRef}
          contentEditable
          suppressContentEditableWarning
          onBlur={handleBlur}
          onInput={(e) => setContent(e.currentTarget.innerHTML)}
          onPaste={handlePaste}
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              handleBlur()
            }
          }}
          onPointerDown={(e) => e.stopPropagation()}
          data-placeholder="Escribe texto..."
          className={`nodrag nowheel w-full bg-transparent border-none outline-none leading-relaxed select-text ${textColorClass} ${fontSizeClass} text-${align} empty:before:content-[attr(data-placeholder)] empty:before:opacity-60 [&_b]:font-bold [&_strong]:font-bold [&_i]:italic [&_em]:italic [&_u]:underline [&_s]:line-through [&_del]:line-through [&_a]:text-sky-500 [&_a]:underline [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5`}
          style={{ fontFamily, minHeight: '24px' }}
        />
      ) : (
        <div
          onDoubleClick={() => !data?.readOnly && setIsEditing(true)}
          className={`nodrag cursor-text select-text leading-relaxed ${textColorClass} ${fontSizeClass} text-${align} [&_b]:font-bold [&_strong]:font-bold [&_i]:italic [&_em]:italic [&_u]:underline [&_s]:line-through [&_del]:line-through [&_a]:text-sky-500 [&_a]:underline [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5`}
          style={{ fontFamily }}
        >
          {content ? (
            hasHtmlFormatting(content) ? (
              <div dangerouslySetInnerHTML={{ __html: sanitizeHtmlContent(content) }} />
            ) : (
              <div className="whitespace-pre-wrap">{renderWithAppleEmoji(content)}</div>
            )
          ) : (
            <span className="italic text-xs opacity-60 select-none">Doble clic para escribir texto</span>
          )}
        </div>
      )}
    </div>
  )
}, areNodePropsEqual)
