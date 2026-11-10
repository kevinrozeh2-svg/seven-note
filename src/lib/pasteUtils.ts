import DOMPurify from 'dompurify'

/**
 * Checks if a string contains HTML tags or formatting
 */
export function hasHtmlFormatting(str: string): boolean {
  if (!str || typeof str !== 'string') return false
  // Check for common formatting tags or style attributes
  const formattingRegex = /<\s*(?:b|strong|i|em|u|s|strike|del|mark|span|p|h[1-6]|ul|ol|li|a|table|tr|td|th|blockquote|pre|code|sub|sup|font)\b[^>]*>|<\s*br\s*\/?>/i
  const styleRegex = /\b(?:style|color)\s*=/i
  return formattingRegex.test(str) || styleRegex.test(str)
}

/**
 * Cleans pasted HTML from clipboard (Word, Google Docs, web pages)
 * while strictly preserving text formatting (bold, italic, underline, strike,
 * colors, background highlights, links, headings, lists, tables, code, etc.)
 */
export function cleanPastedHtml(html: string): string {
  if (!html || typeof html !== 'string') return ''

  let cleaned = html

  // 1. Remove Google Docs internal wrapper if present
  // e.g. <b style="font-weight:normal;" id="docs-internal-guid-...">
  cleaned = cleaned.replace(/<b\s+style="font-weight:\s*normal;?"\s+id="docs-internal-guid-[^"]*">([\s\S]*?)<\/b>/gi, '$1')

  // 2. Remove Microsoft Office / Word comment blocks, meta tags & Office namespaces
  cleaned = cleaned.replace(/<!--[\s\S]*?-->/gi, '')
  cleaned = cleaned.replace(/<\/?o:[^>]*>/gi, '')
  cleaned = cleaned.replace(/<\/?w:[^>]*>/gi, '')
  cleaned = cleaned.replace(/<xml>[\s\S]*?<\/xml>/gi, '')
  cleaned = cleaned.replace(/<meta[^>]*>/gi, '')
  cleaned = cleaned.replace(/<link[^>]*>/gi, '')
  cleaned = cleaned.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')

  // 3. Sanitize HTML allowing safe formatting tags & attributes
  return sanitizeHtmlContent(cleaned)
}

/**
 * Sanitizes HTML content for safe rendering in notes and cards
 */
export function sanitizeHtmlContent(html: string): string {
  if (!html || typeof html !== 'string') return ''

  const sanitized = DOMPurify.sanitize(html, {
    ALLOWED_TAGS: [
      'p', 'br', 'span', 'div', 'b', 'strong', 'i', 'em', 'u', 's', 'strike', 'del',
      'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
      'ul', 'ol', 'li', 'blockquote', 'pre', 'code', 'mark',
      'table', 'thead', 'tbody', 'tr', 'th', 'td',
      'a', 'img', 'sub', 'sup', 'hr'
    ],
    ALLOWED_ATTR: [
      'href', 'target', 'rel', 'style', 'class', 'title', 'src', 'alt', 'width', 'height', 'align', 'color'
    ],
    ALLOW_DATA_ATTR: true
  })

  // Ensure all links open in a new tab with noopener noreferrer
  return sanitized.replace(/<a\b(?![^>]*\btarget=)([^>]*?)>/gi, '<a target="_blank" rel="noopener noreferrer"$1>')
}
