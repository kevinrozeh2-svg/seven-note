import { memo, useState, useEffect, useRef } from 'react'
import { Trash2, Type } from 'lucide-react'
import { toast } from 'sonner'
import { db } from '../../../db'
import { syncEngine } from '../../../lib/syncEngine'
import { areNodePropsEqual, NodeHandles, SourceNodeBadge, getCardCustomStyle, isColorDark, CardSelectionOverlay } from './nodeUtils'
import { AppleEmoji, renderWithAppleEmoji, isSingleEmoji } from '../../ui/AppleEmoji'
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

interface ColorScheme {
  cardBorder: string
  accentBar: string
  badgeBg: string
  badgeBorder: string
  badgeText: string
  dot: string
  topGlow: string
  quoteBar: string
}

const COLOR_MAP: Record<string, ColorScheme> = {
  blue: {
    cardBorder: '',
    accentBar: '',
    badgeBg: 'bg-zinc-100 dark:bg-zinc-800/80',
    badgeBorder: 'border-transparent',
    badgeText: 'text-zinc-600 dark:text-zinc-400',
    dot: '#71717a',
    topGlow: '',
    quoteBar: 'border-l-zinc-400'
  },
  yellow: {
    cardBorder: '',
    accentBar: '',
    badgeBg: 'bg-zinc-100 dark:bg-zinc-800/80',
    badgeBorder: 'border-transparent',
    badgeText: 'text-zinc-600 dark:text-zinc-400',
    dot: '#71717a',
    topGlow: '',
    quoteBar: 'border-l-zinc-400'
  },
  green: {
    cardBorder: '',
    accentBar: '',
    badgeBg: 'bg-zinc-100 dark:bg-zinc-800/80',
    badgeBorder: 'border-transparent',
    badgeText: 'text-zinc-600 dark:text-zinc-400',
    dot: '#71717a',
    topGlow: '',
    quoteBar: 'border-l-zinc-400'
  },
  purple: {
    cardBorder: '',
    accentBar: '',
    badgeBg: 'bg-zinc-100 dark:bg-zinc-800/80',
    badgeBorder: 'border-transparent',
    badgeText: 'text-zinc-600 dark:text-zinc-400',
    dot: '#71717a',
    topGlow: '',
    quoteBar: 'border-l-zinc-400'
  },
  rose: {
    cardBorder: '',
    accentBar: '',
    badgeBg: 'bg-zinc-100 dark:bg-zinc-800/80',
    badgeBorder: 'border-transparent',
    badgeText: 'text-zinc-600 dark:text-zinc-400',
    dot: '#71717a',
    topGlow: '',
    quoteBar: 'border-l-zinc-400'
  },
  peach: {
    cardBorder: '',
    accentBar: '',
    badgeBg: 'bg-zinc-100 dark:bg-zinc-800/80',
    badgeBorder: 'border-transparent',
    badgeText: 'text-zinc-600 dark:text-zinc-400',
    dot: '#71717a',
    topGlow: '',
    quoteBar: 'border-l-zinc-400'
  },
  redBanner: {
    cardBorder: '',
    accentBar: '',
    badgeBg: 'bg-zinc-100 dark:bg-zinc-800/80',
    badgeBorder: 'border-transparent',
    badgeText: 'text-zinc-600 dark:text-zinc-400',
    dot: '#71717a',
    topGlow: '',
    quoteBar: 'border-l-zinc-400'
  },
  darkNote: {
    cardBorder: '',
    accentBar: '',
    badgeBg: 'bg-zinc-100 dark:bg-zinc-800/80',
    badgeBorder: 'border-transparent',
    badgeText: 'text-zinc-600 dark:text-zinc-400',
    dot: '#71717a',
    topGlow: '',
    quoteBar: 'border-l-zinc-400'
  },
  slate: {
    cardBorder: '',
    accentBar: '',
    badgeBg: 'bg-zinc-100 dark:bg-zinc-800/80',
    badgeBorder: 'border-transparent',
    badgeText: 'text-zinc-600 dark:text-zinc-400',
    dot: '#71717a',
    topGlow: '',
    quoteBar: 'border-l-zinc-400'
  }
}

export const NoteNode = memo(({ id, data, selected }: any) => {
  const [title, setTitle] = useState(data.title ?? '')
  const [content, setContent] = useState(data.content ?? '')
  const color = data.color ?? 'slate'
  const [fontFamily, setFontFamily] = useState(data.fontFamily || '')
  const [showFontMenu, setShowFontMenu] = useState(false)
  const [isQuote] = useState(data.isQuote ?? false)
  const [quoteAuthor] = useState(data.quoteAuthor ?? '')
  const [alertBox] = useState(data.alertBox ?? '')
  const [isBanner] = useState(data.isBanner ?? false)
  const [linkUrl] = useState(data.linkUrl ?? '')
  const [isEditingTitle, setIsEditingTitle] = useState(false)
  const [isEditingContent, setIsEditingContent] = useState(false)
  const contentEditableRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (data.title !== undefined) setTitle(data.title)
    if (data.content !== undefined) setContent(data.content)
    if (data.fontFamily !== undefined) setFontFamily(data.fontFamily)
  }, [data.title, data.content, data.fontFamily])

  // Sync content into contentEditable element when entering edit mode
  useEffect(() => {
    if (isEditingContent && contentEditableRef.current) {
      const el = contentEditableRef.current
      if (hasHtmlFormatting(content) || data.hasHtmlHighlight) {
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
  }, [isEditingContent])

  // Paste formatted text directly into selected note on canvas
  useEffect(() => {
    if (!selected || isEditingContent || isEditingTitle) return

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
        save({ content: updated, hasHtmlHighlight: true })
        toast.success(isPdf ? 'Texto de PDF pegado con formato' : 'Formato de texto conservado en la nota')
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
  }, [selected, isEditingContent, isEditingTitle, content])

  const handleContentPaste = (e: React.ClipboardEvent<HTMLDivElement>) => {
    e.preventDefault()
    const html = e.clipboardData.getData('text/html')
    const text = e.clipboardData.getData('text/plain')

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
      document.execCommand('insertHTML', false, clean)
    } else if (text) {
      document.execCommand('insertText', false, cleanPastedText(text))
    }

    if (contentEditableRef.current) {
      const htmlVal = contentEditableRef.current.innerHTML
      setContent(htmlVal)
      save({
        content: htmlVal,
        hasHtmlHighlight: hasHtmlFormatting(htmlVal) || Boolean(isPdf)
      })
    }
  }

  const handleContentBlur = () => {
    setIsEditingContent(false)
    if (contentEditableRef.current) {
      const htmlVal = contentEditableRef.current.innerHTML
      setContent(htmlVal)
      save({
        content: htmlVal,
        hasHtmlHighlight: hasHtmlFormatting(htmlVal)
      })
    }
  }

  const handleContentKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Escape') {
      setIsEditingContent(false)
      if (contentEditableRef.current) {
        const htmlVal = contentEditableRef.current.innerHTML
        setContent(htmlVal)
        save({
          content: htmlVal,
          hasHtmlHighlight: hasHtmlFormatting(htmlVal)
        })
      }
    }
  }

  const colorScheme = COLOR_MAP[color] || COLOR_MAP.slate
  const isConnectorActive = Boolean(data?.isConnectorActive)
  const isConnectSource = Boolean(data?.isConnectSource)

  const save = async (updates: any) => {
    try {
      const node = await db.canvasNodes.get(id)
      if (node) {
        await db.canvasNodes.update(id, {
          data: { ...node.data, ...updates },
          updatedAt: Date.now(),
          syncStatus: 'pending'
        })
        syncEngine.scheduleSync(1500)
      }
    } catch (e) {
      console.error('Error saving note node', e)
    }
  }

  const handleDelete = async () => {
    try {
      await db.canvasNodes.update(id, { isDeleted: true, updatedAt: Date.now(), syncStatus: 'pending' })
      syncEngine.scheduleSync(1000)
    } catch (e) {
      console.error('Error deleting note node', e)
    }
  }

  // Standalone Emoji Sticker (pure emoji without card background)
  const isEmojiSticker = !title && isSingleEmoji(content.trim()) && !isQuote && !alertBox && !isBanner && !linkUrl && !hasHtmlFormatting(content)

  if (isEmojiSticker) {
    return (
      <div
        className={`group relative p-2 select-none flex items-center justify-center transition-transform ${
          selected ? 'ring-2 ring-[var(--app-accent)] rounded-2xl bg-black/5 dark:bg-white/5' : ''
        } ${
          isConnectSource
            ? 'ring-4 ring-amber-500 rounded-2xl scale-110'
            : isConnectorActive
            ? 'ring-1 ring-blue-500/40 hover:ring-2 hover:ring-blue-500 rounded-2xl cursor-pointer'
            : ''
        }`}
        style={{
          width: data.width || 80,
          minHeight: 80
        }}
      >
        <SourceNodeBadge isConnectSource={isConnectSource} isConnectorActive={isConnectorActive} />
        <NodeHandles
          selected={selected}
          isConnectorActive={isConnectorActive}
          isConnectSource={isConnectSource}
        />

        {/* Floating delete button */}
        <button
          onClick={handleDelete}
          className="absolute -top-2 -right-2 p-1 rounded-full bg-white dark:bg-zinc-800 hover:bg-rose-50 dark:hover:bg-rose-950/50 text-zinc-400 hover:text-rose-500 shadow-sm opacity-0 group-hover:opacity-100 transition z-10"
          title="Eliminar emoji"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>

        <div className="flex items-center justify-center">
          <AppleEmoji
            emoji={content.trim()}
            size={data.width ? Math.min(Math.max(data.width - 24, 48), 120) : 64}
            className="drop-shadow-md hover:scale-110 transition-transform duration-150 cursor-pointer"
          />
        </div>
      </div>
    )
  }

  // Red Banner Style (matches Screenshot 1: "El Grupo de Música del Futuro")
  if (isBanner) {
    return (
      <div
        className={`group relative px-6 py-3 rounded-xl transition-[box-shadow,border-color] duration-150 shadow-md ${
          selected ? 'ring-2 ring-white shadow-xl' : ''
        } ${
          isConnectSource
            ? 'ring-4 ring-amber-400 shadow-2xl scale-[1.02] shadow-amber-500/30'
            : isConnectorActive
            ? 'ring-1 ring-white/50 hover:ring-2 hover:ring-white cursor-pointer'
            : ''
        } bg-rose-600 dark:bg-rose-700 text-white`}
        style={{ minWidth: 200, maxWidth: 360, ...(fontFamily ? { fontFamily } : {}) }}
      >
        <SourceNodeBadge isConnectSource={isConnectSource} isConnectorActive={isConnectorActive} />
        <NodeHandles
          selected={selected}
          isConnectorActive={isConnectorActive}
          isConnectSource={isConnectSource}
          accentColor="#ffffff"
        />

        <div className="absolute -top-2 -right-2 flex items-center gap-1 z-20">
          <div className="relative">
            <button
              onClick={(e) => {
                e.stopPropagation()
                setShowFontMenu(!showFontMenu)
              }}
              className={`p-1 rounded-full bg-white dark:bg-neutral-800 text-neutral-700 dark:text-neutral-200 shadow-sm transition cursor-pointer ${
                showFontMenu || fontFamily ? 'opacity-100 ring-2 ring-[#1e96eb]' : 'opacity-0 group-hover:opacity-100'
              }`}
              title="Cambiar tipografía del banner"
            >
              <Type className="w-3 h-3 text-[#1e96eb]" />
            </button>

            <FontPickerPopover
              isOpen={showFontMenu}
              onClose={() => setShowFontMenu(false)}
              currentFamily={fontFamily || 'Georgia, serif'}
              onSelect={(family) => {
                setFontFamily(family)
                save({ fontFamily: family })
              }}
              align="right"
            />
          </div>

          <button
            onClick={handleDelete}
            className="p-1 rounded-full bg-white text-neutral-800 shadow-sm opacity-0 group-hover:opacity-100 transition z-10 cursor-pointer"
          >
            <Trash2 className="w-3 h-3 text-rose-500" />
          </button>
        </div>

        {isEditingTitle ? (
          <input
            autoFocus
            type="text"
            value={title || content}
            onChange={(e) => {
              setTitle(e.target.value)
              save({ title: e.target.value, content: e.target.value })
            }}
            onBlur={() => setIsEditingTitle(false)}
            onKeyDown={(e) => e.key === 'Enter' && setIsEditingTitle(false)}
            onPointerDown={(e) => e.stopPropagation()}
            className="nodrag nowheel font-serif font-bold text-base text-center bg-transparent border-none outline-none w-full text-white placeholder-white/80"
            placeholder="Texto del banner..."
          />
        ) : (
          <div
            onDoubleClick={() => setIsEditingTitle(true)}
            className="font-serif font-bold text-base text-center text-white cursor-text select-text w-full"
          >
            {renderWithAppleEmoji(title || content || 'Texto del banner...')}
          </div>
        )}
      </div>
    )
  }

  const customCardStyle = getCardCustomStyle(data, 16)
  const isDarkFill = isColorDark(data?.fillColor)

  return (
    <div
      className={`group relative rounded-2xl transition-all duration-200 bg-white dark:bg-[#18181b] p-3.5 select-none ${
        selected
          ? 'shadow-2xl'
          : 'shadow-[0_4px_20px_-4px_rgba(0,0,0,0.06),0_1px_3px_rgba(0,0,0,0.04)] dark:shadow-[0_8px_30px_-6px_rgba(0,0,0,0.5),0_1px_3px_rgba(0,0,0,0.3)]'
      } ${
        isConnectSource
          ? 'ring-4 ring-amber-500 shadow-2xl shadow-amber-500/25 scale-[1.02]'
          : isConnectorActive
          ? 'ring-1 ring-blue-500/40 hover:ring-2 hover:ring-blue-500 hover:shadow-xl cursor-pointer'
          : 'hover:shadow-xl'
      } ${isDarkFill ? 'text-zinc-100' : ''}`}
      style={{
        width: data.width || 280,
        minHeight: 80,
        ...(fontFamily ? { fontFamily } : {}),
        ...customCardStyle
      }}
    >
      <CardSelectionOverlay selected={selected} />
      <SourceNodeBadge isConnectSource={isConnectSource} isConnectorActive={isConnectorActive} />
      <NodeHandles
        selected={selected}
        isConnectorActive={isConnectorActive}
        isConnectSource={isConnectSource}
      />

      {/* Action buttons (Typography & Delete) */}
      <div className="absolute top-2.5 right-2.5 flex items-center gap-1 z-20">
        <div className="relative">
          <button
            onClick={(e) => {
              e.stopPropagation()
              setShowFontMenu(!showFontMenu)
            }}
            className={`p-1 rounded-full transition shadow-xs cursor-pointer ${
              showFontMenu || fontFamily
                ? 'bg-zinc-200 dark:bg-zinc-700 text-[#1e96eb] opacity-100'
                : 'bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 opacity-0 group-hover:opacity-100'
            }`}
            title="Cambiar tipografía de la nota"
          >
            <Type className="w-3.5 h-3.5" />
          </button>

          <FontPickerPopover
            isOpen={showFontMenu}
            onClose={() => setShowFontMenu(false)}
            currentFamily={fontFamily || 'Inter, system-ui, sans-serif'}
            onSelect={(family) => {
              setFontFamily(family)
              save({ fontFamily: family })
            }}
            align="right"
          />
        </div>

        <button
          onClick={handleDelete}
          className="p-1 rounded-full bg-zinc-100 dark:bg-zinc-800 hover:bg-rose-50 dark:hover:bg-rose-950/50 text-zinc-400 hover:text-rose-500 shadow-sm opacity-0 group-hover:opacity-100 transition cursor-pointer"
          title="Eliminar nota"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Header Pill: e.g. "Causas" */}
      {(title || data.showTitle) && (
        <div className="mb-2 relative z-10 flex items-center pr-6">
          <div
            className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold tracking-wide uppercase bg-zinc-100 dark:bg-zinc-800/80 text-zinc-600 dark:text-zinc-400 shadow-xs"
          >
            <span
              className="w-1.5 h-1.5 rounded-full shrink-0 bg-zinc-400 dark:bg-zinc-500"
            />
            {isEditingTitle ? (
              <input
                autoFocus
                type="text"
                value={title}
                onChange={(e) => {
                  setTitle(e.target.value)
                  save({ title: e.target.value })
                }}
                onBlur={() => setIsEditingTitle(false)}
                onKeyDown={(e) => e.key === 'Enter' && setIsEditingTitle(false)}
                onPointerDown={(e) => e.stopPropagation()}
                placeholder="Categoría / Título..."
                className="nodrag nowheel font-sans font-semibold text-[11px] bg-transparent border-none outline-none w-auto max-w-[190px] truncate text-zinc-700 dark:text-zinc-300"
              />
            ) : (
              <span
                onDoubleClick={() => setIsEditingTitle(true)}
                className="font-sans font-semibold text-[11px] text-zinc-700 dark:text-zinc-300 cursor-text select-text truncate max-w-[190px]"
              >
                {renderWithAppleEmoji(title || 'Categoría / Título...')}
              </span>
            )}
          </div>
        </div>
      )}

      {/* Content Area */}
      {isQuote ? (
        // Quote style
        <div className={`border-l-2 pl-3 my-1.5 italic ${colorScheme.quoteBar} relative z-10`}>
          {isEditingContent ? (
            <div
              ref={contentEditableRef}
              contentEditable
              suppressContentEditableWarning
              onBlur={handleContentBlur}
              onInput={(e) => setContent(e.currentTarget.innerHTML)}
              onPaste={handleContentPaste}
              onKeyDown={handleContentKeyDown}
              onPointerDown={(e) => e.stopPropagation()}
              data-placeholder="Escribe tu cita aquí..."
              className="nodrag nowheel w-full bg-transparent border-none outline-none text-[13px] leading-relaxed italic text-zinc-800 dark:text-zinc-200 empty:before:content-[attr(data-placeholder)] empty:before:text-zinc-400 dark:empty:before:text-zinc-500 [&_a]:text-blue-500 [&_a]:underline"
              style={{ minHeight: '36px' }}
            />
          ) : (
            <div
              onDoubleClick={() => setIsEditingContent(true)}
              className="nodrag cursor-text select-text leading-relaxed text-[13px] italic text-zinc-800 dark:text-zinc-200 min-h-[36px] [&_a]:text-blue-500 [&_a]:underline"
            >
              {content ? (
                hasHtmlFormatting(content) || data.hasHtmlHighlight ? (
                  <div dangerouslySetInnerHTML={{ __html: sanitizeHtmlContent(content) }} />
                ) : (
                  <div className="whitespace-pre-wrap">{renderWithAppleEmoji(content)}</div>
                )
              ) : (
                <span className="text-zinc-400 dark:text-zinc-500 italic select-none">Escribe tu cita aquí...</span>
              )}
            </div>
          )}
          {quoteAuthor && (
            <div
              className="not-italic mt-1.5 text-[11px] font-medium text-zinc-500 dark:text-zinc-400 select-text nodrag"
            >
              {renderWithAppleEmoji(quoteAuthor)}
            </div>
          )}
        </div>
      ) : (
        // Normal text note
        <div className="text-[13px] leading-relaxed relative z-10">
          {isEditingContent ? (
            <div
              ref={contentEditableRef}
              contentEditable
              suppressContentEditableWarning
              onBlur={handleContentBlur}
              onInput={(e) => setContent(e.currentTarget.innerHTML)}
              onPaste={handleContentPaste}
              onKeyDown={handleContentKeyDown}
              onPointerDown={(e) => e.stopPropagation()}
              data-placeholder="Escribe tu nota aquí..."
              className={`nodrag nowheel w-full bg-transparent border-none outline-none text-[14px] leading-relaxed font-normal ${
                isDarkFill ? 'text-white' : 'text-zinc-800 dark:text-zinc-200'
              } empty:before:content-[attr(data-placeholder)] empty:before:text-zinc-400 dark:empty:before:text-zinc-500 [&_b]:font-bold [&_strong]:font-bold [&_i]:italic [&_em]:italic [&_u]:underline [&_s]:line-through [&_del]:line-through [&_a]:text-blue-500 [&_a]:underline [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_blockquote]:border-l-2 [&_blockquote]:pl-2 [&_blockquote]:italic [&_code]:bg-black/10 dark:[&_code]:bg-white/10 [&_code]:px-1 [&_code]:rounded`}
              style={{ minHeight: '36px' }}
            />
          ) : (
            <div
              onDoubleClick={() => setIsEditingContent(true)}
              className={`nodrag cursor-text select-text leading-relaxed text-[14px] font-normal ${
                isDarkFill ? 'text-zinc-100' : 'text-zinc-800 dark:text-zinc-200'
              } min-h-[36px] [&_b]:font-bold [&_strong]:font-bold [&_i]:italic [&_em]:italic [&_u]:underline [&_s]:line-through [&_del]:line-through [&_a]:text-blue-500 [&_a]:underline [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_blockquote]:border-l-2 [&_blockquote]:pl-2 [&_blockquote]:italic [&_code]:bg-black/10 dark:[&_code]:bg-white/10 [&_code]:px-1 [&_code]:rounded`}
            >
              {content ? (
                isSingleEmoji(content.trim()) && !title && !hasHtmlFormatting(content) ? (
                  <div className="py-2 flex items-center justify-center">
                    <AppleEmoji emoji={content.trim()} size={56} className="drop-shadow-md hover:scale-110 transition-transform duration-150 cursor-pointer" />
                  </div>
                ) : hasHtmlFormatting(content) || data.hasHtmlHighlight ? (
                  <div dangerouslySetInnerHTML={{ __html: sanitizeHtmlContent(content) }} />
                ) : (
                  <div className="whitespace-pre-wrap">{renderWithAppleEmoji(content)}</div>
                )
              ) : (
                <span className="text-zinc-400 dark:text-zinc-500 italic select-none">Escribe tu nota aquí...</span>
              )}
            </div>
          )}
        </div>
      )}

      {/* Alert Callout Box */}
      {alertBox && (
        <div className="mt-3 p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs font-medium text-amber-700 dark:text-amber-300 flex items-center gap-2 relative z-10">
          <span><AppleEmoji emoji="⚠️" size={16} /></span>
          <span>{renderWithAppleEmoji(alertBox)}</span>
        </div>
      )}

      {/* Link snippet */}
      {linkUrl && (
        <div className="mt-2.5 pt-2 border-t border-zinc-200/60 dark:border-zinc-800/60 relative z-10">
          <a
            href={`https://${linkUrl}`}
            target="_blank"
            rel="noreferrer"
            className="text-[11px] text-blue-600 dark:text-blue-400 hover:underline block truncate"
          >
            {linkUrl}
          </a>
        </div>
      )}
    </div>
  )
}, areNodePropsEqual)
