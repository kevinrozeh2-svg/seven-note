import katex from 'katex'

function escapeAttr(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

function unescapeAttr(str: string): string {
  return str
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
}

/**
 * Renders a LaTeX expression to crisp HTML using KaTeX (safe: trust=false, throwOnError=false).
 */
export function renderLatexToHtml(latex: string, displayMode = true): string {
  const cleaned = (latex || '').trim()
  if (!cleaned) return ''
  try {
    return katex.renderToString(cleaned, {
      displayMode,
      throwOnError: false,
      strict: false,
      trust: false,
      output: 'html'
    })
  } catch {
    return `<code>${escapeAttr(cleaned)}</code>`
  }
}

/**
 * Emits a portable, clean HTML marker for a display math block (`$$...$$` / `\[...\]`).
 * Recognized by TipTap MathBlock and hydrated by `renderMathNodesInHtml` in canvas cards.
 */
export function createMathBlockHtml(latex: string): string {
  const cleaned = (latex || '').trim()
  return `<div data-type="math-block" data-latex="${escapeAttr(cleaned)}" class="seven-math-block" contenteditable="false"></div>`
}

/**
 * Emits a portable, clean HTML marker for an inline math expression (`$...$` / `\(...\)`).
 * Recognized by TipTap MathInline and hydrated by `renderMathNodesInHtml` in canvas cards.
 */
export function createMathInlineHtml(latex: string): string {
  const cleaned = (latex || '').trim()
  return `<span data-type="math-inline" data-latex="${escapeAttr(cleaned)}" class="seven-math-inline" contenteditable="false"></span>`
}

/**
 * Checks whether an inline `$ ... $` inner string looks like real math rather than currency (`$100 ... $200`).
 */
export function isLikelyInlineMathInner(inner: string): boolean {
  const trimmed = inner.trim()
  if (!trimmed || trimmed.includes('\n')) return false
  // Currency guard: starts with digits like "100 y $200" or "50.00" without LaTeX commands
  if (/^\d[\d.,]*(?:\s|$)/.test(trimmed) && !/\\[a-zA-Z]+/.test(trimmed)) {
    return false
  }
  // Contains a LaTeX command (\frac, \text, \times, \alpha, \uparrow, etc.)
  if (/\\[a-zA-Z]+/.test(trimmed)) return true
  // Contains superscript/subscript/braces/equations (e.g. E = mc^2, x_1 + y_1)
  if (/[_^=]/.test(trimmed) && /[a-zA-Z]/.test(trimmed)) return true
  return false
}

/**
 * If the entire pasted string is a single display LaTeX formula (`$$...$$` or `\[...\]`),
 * returns the inner LaTeX expression. Otherwise returns null.
 */
export function extractStandaloneLatex(text: string): string | null {
  if (!text || typeof text !== 'string') return null
  const trimmed = text.replace(/\r\n?/g, '\n').trim()
  if (trimmed.length < 4) return null

  // $$ ... $$
  if (trimmed.startsWith('$$') && trimmed.endsWith('$$') && trimmed.length > 4) {
    const inner = trimmed.slice(2, -2).trim()
    // Make sure there is no intermediate $$ closing it early
    if (inner && !inner.includes('$$')) {
      return inner
    }
  }

  // \[ ... \]
  if (trimmed.startsWith('\\[') && trimmed.endsWith('\\]') && trimmed.length > 4) {
    const inner = trimmed.slice(2, -2).trim()
    if (inner && !inner.includes('\\]')) {
      return inner
    }
  }

  return null
}

/**
 * Checks if a text contains any LaTeX math blocks (`$$...$$`, `\[...\]`) or inline math (`\(...\)`, `$...$`).
 */
export function containsLatexMath(text: string): boolean {
  if (!text || typeof text !== 'string') return false
  if (extractStandaloneLatex(text) !== null) return true
  if (/\$\$[\s\S]+?\$\$/.test(text)) return true
  if (/\\\[[\s\S]+?\\\]/.test(text)) return true
  if (/\\\([^)\n]+?\\\)/.test(text)) return true

  const inlineDollarRegex = /\$(?!\s)([^$\n]+?)(?<!\s)\$/g
  let m: RegExpExecArray | null
  while ((m = inlineDollarRegex.exec(text)) !== null) {
    if (isLikelyInlineMathInner(m[1])) return true
  }

  return false
}

export interface InlineMathSegment {
  type: 'text' | 'math-inline'
  value: string
}

/**
 * Splits a single line of plain text into normal text segments and inline LaTeX math segments
 * (`\(...\)` and safe `$...$`).
 */
export function splitInlineLatexSegments(line: string): InlineMathSegment[] {
  if (!line || (!line.includes('$') && !line.includes('\\('))) {
    return [{ type: 'text', value: line }]
  }

  const segments: InlineMathSegment[] = []
  const tokenRegex = /\\\(([^)\n]+?)\\\)|\$(?!\s)([^$\n]+?)(?<!\s)\$/g
  let lastIndex = 0
  let match: RegExpExecArray | null

  while ((match = tokenRegex.exec(line)) !== null) {
    const isParenMath = match[1] !== undefined
    const inner = (isParenMath ? match[1] : match[2]) || ''

    if (!isParenMath && !isLikelyInlineMathInner(inner)) {
      continue
    }

    if (match.index > lastIndex) {
      segments.push({ type: 'text', value: line.slice(lastIndex, match.index) })
    }
    segments.push({ type: 'math-inline', value: inner.trim() })
    lastIndex = match.index + match[0].length
  }

  if (lastIndex < line.length) {
    segments.push({ type: 'text', value: line.slice(lastIndex) })
  }

  return segments.length > 0 ? segments : [{ type: 'text', value: line }]
}

/**
 * Hydrates already-sanitized HTML by rendering KaTeX inside every
 * `[data-type="math-block"][data-latex]` and `[data-type="math-inline"][data-latex]` node.
 * Always call AFTER `sanitizeHtmlContent` so KaTeX positioning styles remain intact and XSS-safe.
 */
export function renderMathNodesInHtml(sanitizedHtml: string): string {
  if (!sanitizedHtml || !sanitizedHtml.includes('data-latex')) {
    return sanitizedHtml
  }

  if (typeof DOMParser !== 'undefined') {
    try {
      const doc = new DOMParser().parseFromString(sanitizedHtml, 'text/html')
      let changed = false
      doc.querySelectorAll('[data-type="math-block"][data-latex], [data-type="math-inline"][data-latex]').forEach((el) => {
        const latex = el.getAttribute('data-latex') || ''
        if (!latex.trim()) return
        const isBlock = el.getAttribute('data-type') === 'math-block'
        el.innerHTML = renderLatexToHtml(latex, isBlock)
        el.setAttribute('contenteditable', 'false')
        changed = true
      })
      if (changed) {
        return doc.body.innerHTML
      }
    } catch {
      // Fallback to regex below
    }
  }

  return sanitizedHtml.replace(
    /<(div|span)\b([^>]*data-type="(math-block|math-inline)"[^>]*data-latex="([^"]*)"[^>]*)>[\s\S]*?<\/\1>/gi,
    (_m, tag: string, attrs: string, kind: string, rawLatex: string) => {
      const latex = unescapeAttr(rawLatex)
      const rendered = renderLatexToHtml(latex, kind === 'math-block')
      return `<${tag}${attrs}>${rendered}</${tag}>`
    }
  )
}
