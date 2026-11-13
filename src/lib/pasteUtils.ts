import DOMPurify from 'dompurify'
import {
  applyStylesheetRules,
  computeElementFormatting,
  DEFAULT_FORMATTING_STATE,
  isBoldFontFamily,
  isItalicFontFamily,
  isMonospaceFontFamily,
  isNeutralBackgroundColor,
  isNeutralTextColor,
  parseCssCoord,
  parseCssDeclarationBlock,
  parseCssLengthPx,
  sanitizeInlineStyle,
  type FormattingState
} from './pasteCssUtils'

export {
  isNeutralTextColor,
  isNeutralBackgroundColor,
  sanitizeInlineStyle
}

export interface ClipboardPasteResult {
  kind: 'internal' | 'pdf' | 'rich-html' | 'plain-text'
  html: string
  text: string
}

interface InlineRun {
  text: string
  state: FormattingState
  href?: string
  isBr?: boolean
  rawHtml?: string
}

interface PositionedFragment {
  x: number
  y: number
  unit: 'px' | '%'
  fontSizePx: number
  runs: InlineRun[]
  plainText: string
  isAllBold: boolean
  isAllItalic: boolean
  runIndex: number
}

interface VisualLine {
  y: number
  xMin: number
  xMaxEst: number
  fontSizePx: number
  html: string
  text: string
  isAllBold: boolean
  tabCells: string[] | null
  tabHtmlCells: string[] | null
  gapFromPrevY: number
  isPageBreak: boolean
}

const UNICODE_SPACES_REGEX = /[\u00A0\u2000-\u200A\u202F\u205F\u3000]/g
const INVISIBLE_CONTROL_REGEX = /[\u200B\u200C\u200D\uFEFF\u200E\u200F\u202A-\u202E]/g
// Common Wingdings / Symbol Private Use Area bullet codepoints emitted by PDF viewers
const PUA_BULLET_REGEX = /[\uF06E\uF076\uF0A7\uF0A8\uF0B7\uF0D8\uF0E0\uF0FC\uF0FE\uF02D]/g

const LIST_BULLET_CHARS = '•●◦○▪▫■□►▸▹‣⁃∙◆◇❖➔➤➢➣–—−*·'
const BULLET_LINE_START_REGEX = new RegExp(`^([${LIST_BULLET_CHARS}-])\\s+(.*)$`)
const TASK_LINE_START_REGEX = /^(\[[ xX✓✔]\]|[☐☑✅])\s+(.*)$/

const ABBREVIATIONS_AT_END_REGEX =
  /\b(?:Sr|Sra|Sres|Srta|Dr|Dra|Prof|Lic|Ing|Arq|Abg|Art|Arts|Cap|Caps|Sec|Núm|No|Pág|Págs|Vol|Vols|Fig|Figs|Ed|Ref|Tel|Ext|Dept|Depto|Inc|Corp|Ltd|S\.L|S\.A|S\.R\.L|U\.S|U\.K|etc|aprox|p\.ej|e\.g|i\.e|vs|cf|v\.gr|núm|pág|art|cap)\.\s*$/i

const COLON_LABEL_REGEX =
  /^(?:Nota|Notas|Importante|Atención|Aviso|Advertencia|Precaución|Objetivo|Objetivos|Definición|Definiciones|Ejemplo|Ejemplos|Observación|Observaciones|Requisito|Requisitos|Conclusión|Conclusiones|Resumen|Introducción|Descripción|Fecha|Nombre|Apellidos|Autor|Autores|Título|Subtítulo|Referencia|Ref|Asunto|Dirección|Domicilio|Email|Correo|Teléfono|Tel|NIF|CIF|DNI|Capítulo\s+\d+|Artículo\s+\d+|Sección\s+\d+|Cláusula\s+[A-Z0-9]+|DE\s+UNA\s+PARTE|DE\s+OTRA\s+PARTE|POR\s+UNA\s+PARTE|POR\s+OTRA\s+PARTE|PRIMERA|SEGUNDA|TERCERA|CUARTA|QUINTA|SEXTA|SÉPTIMA|OCTAVA|NOVENA|DÉCIMA)\s*:/i

const STANDALONE_LEGAL_OR_SECTION_HEADERS_REGEX =
  /^(?:REUNIDOS|CL[ÁA]USULAS|CONTRATO|ANTECEDENTES|ESTIPULACIONES|EXPONEN|MANIFIESTAN|ACUERDAN|RESUMEN|INTRODUCCI[ÓO]N|OBJETO|OBJETIVOS|DISPOSICIONES|DECLARACIONES|CONCLUSIONES|REQUISITOS|DESCRIPCI[ÓO]N|METODOLOG[ÍI]A|RESULTADOS|DISCUSI[ÓO]N|REFERENCIAS|BIBLIOGRAF[ÍI]A|ANEXO(?:\s+[A-Z0-9]+)?|ABSTRACT|INTRODUCTION|METHODOLOGY|RESULTS|DISCUSSION|CONCLUSION|CONCLUSIONS|REFERENCES|APPENDIX(?:\s+[A-Z0-9]+)?)$/i

const COLON_LABEL_PREFIX_REGEX =
  /^((?:Nota|Notas|Importante|Atención|Aviso|Advertencia|Precaución|Objetivo|Objetivos|Definición|Definiciones|Ejemplo|Ejemplos|Observación|Observaciones|Requisito|Requisitos|Conclusión|Conclusiones|Resumen|Introducción|Descripción|Fecha|Nombre|Apellidos|Autor|Autores|Título|Referencia|Ref|Asunto|Dirección|Domicilio|Email|Correo|Teléfono|Tel|NIF|CIF|DNI|Capítulo\s+\d+|Artículo\s+\d+|Sección\s+\d+|Cláusula\s+[A-Z0-9]+|DE\s+UNA\s+PARTE|DE\s+OTRA\s+PARTE|POR\s+UNA\s+PARTE|POR\s+OTRA\s+PARTE|PRIMERA|SEGUNDA|TERCERA|CUARTA|QUINTA|SEXTA|SÉPTIMA|OCTAVA|NOVENA|DÉCIMA)\s*:)/i

const HYPOTHETICAL_MATH_BOLD_CHECK_REGEX = /[\u{1D400}-\u{1D6A3}\u{1D7CE}-\u{1D7FF}]/u

/**
 * Escapes special HTML characters
 */
export function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/**
 * Strips HTML tags from a string to inspect plain text content
 */
function stripHtml(html: string): string {
  return html
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
}

/**
 * Normalizes invisible control characters, PDF PUA bullets, and exotic Unicode space characters.
 */
function normalizePdfCharacters(text: string, preserveTabs = true): string {
  if (!text) return ''
  let out = text
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(UNICODE_SPACES_REGEX, ' ')
    .replace(INVISIBLE_CONTROL_REGEX, '')
    .replace(PUA_BULLET_REGEX, '• ')
  if (!preserveTabs) {
    out = out.replace(/\t/g, ' ')
  }
  return out
}

/**
 * Checks if a string contains meaningful HTML formatting or structural markup
 * (ignoring trivial plain-text clipboard wrappers like `<meta><span style="color:black">plain</span>`).
 */
export function hasHtmlFormatting(str: string): boolean {
  if (!str || typeof str !== 'string') return false

  // Semantic formatting / structure tags
  if (
    /<\s*(?:b|strong|i|em|u|s|strike|del|mark|h[1-6]|ul|ol|li|a|table|thead|tbody|tr|td|th|blockquote|pre|code|sub|sup|hr|img)\b[^>]*>/i.test(
      str
    )
  ) {
    return true
  }

  // Positioned PDF layers / style blocks
  if (isPdfHtml(str)) return true

  // Explicit inline styling that alters appearance
  if (
    /font-weight\s*:\s*(?:bold|bolder|[6-9]\d{2})/i.test(str) ||
    /font-style\s*:\s*(?:italic|oblique)/i.test(str) ||
    /text-decoration(?:-line)?\s*:[^;]*(?:underline|line-through)/i.test(str) ||
    /text-align\s*:\s*(?:center|right|justify)/i.test(str) ||
    /text-indent\s*:\s*[1-9]/i.test(str) ||
    /(?:margin-left|padding-left)\s*:\s*[1-9]/i.test(str)
  ) {
    return true
  }

  // Non-neutral color or background highlight
  const colorMatches = str.match(/(?:background-)?color\s*:\s*([^;"']+)/gi)
  if (colorMatches) {
    for (const m of colorMatches) {
      const idx = m.indexOf(':')
      const prop = m.slice(0, idx).toLowerCase()
      const val = m.slice(idx + 1).trim()
      if (prop.includes('background')) {
        if (!isNeutralBackgroundColor(val)) return true
      } else {
        if (!isNeutralTextColor(val)) return true
      }
    }
  }

  // Multiple semantic paragraph/div blocks (2+ blocks) indicate structured HTML rather than single-span wrapper
  const blockCount = (str.match(/<\s*(?:p|div|br)\b/gi) || []).length
  if (blockCount >= 2) {
    return true
  }

  return false
}

/**
 * Checks if already-stored note/card content contains HTML markup (including single <p>/<div>/<br> tags)
 * so single-paragraph HTML pastes never render raw tags in plain-text view.
 */
export function hasStoredHtmlMarkup(str: string): boolean {
  if (!str || typeof str !== 'string') return false
  if (hasHtmlFormatting(str)) return true
  return /<(?:p|div)\b[^>]*>[\s\S]*<\/(?:p|div)>|<br\s*\/?>/i.test(str)
}

function hasPdfWrappedLinesInHtml(html: string): boolean {
  if (!html || typeof DOMParser === 'undefined') return false
  // Check for hyphenated line breaks across HTML tags or text
  if (/[\p{L}]{2,}[-\u00AD\u2010\u2011](?:<\/[^>]+>)*\s*(?:<br\s*\/?>|<\/(?:p|div)>)/iu.test(html)) {
    return true
  }
  try {
    const doc = new DOMParser().parseFromString(html, 'text/html')
    const blocks = Array.from(doc.body.querySelectorAll('p, div')).filter(
      (el) => el.children.length === 0 || Array.from(el.children).every((c) => !/^(?:p|div|ul|ol|table|h[1-6])$/i.test(c.tagName))
    )
    if (blocks.length < 3) return false
    let midSentenceWraps = 0
    for (let i = 0; i < blocks.length - 1; i++) {
      const a = (blocks[i].textContent || '').trim()
      const b = (blocks[i + 1].textContent || '').trim()
      if (a.length >= 25 && a.length <= 105 && !/[.?!:]$/.test(a) && /^[\p{Ll}]/u.test(b)) {
        midSentenceWraps++
      }
    }
    return midSentenceWraps >= 2
  } catch {
    return false
  }
}

/**
 * Detects if clipboard HTML is generated by a browser or desktop PDF viewer
 * (PDF.js, Chrome/Firefox PDF viewer, pdf2htmlEX, Apple Preview / Quartz, Adobe Acrobat, pdftohtml).
 */
export function isPdfHtml(html: string): boolean {
  if (!html || typeof html !== 'string') return false
  // Never misclassify TipTap/ProseMirror internal slices, Word, Google Docs, or Notion as PDF HTML
  if (
    html.includes('data-pm-slice') ||
    html.includes('docs-internal-guid') ||
    html.includes('urn:schemas-microsoft-com:office') ||
    html.includes('MsoNormal') ||
    html.includes('notion-page-content')
  ) {
    return false
  }

  return (
    html.includes('textLayer') ||
    html.includes('data-page-number') ||
    html.includes('class="page"') ||
    html.includes('pdf2htmlEX') ||
    html.includes('Cocoa HTML Writer') ||
    html.includes('Quartz PDFContext') ||
    html.includes('data-element-id') ||
    html.includes('data-annotation-id') ||
    /role=["']presentation["']/i.test(html) ||
    /position:\s*absolute/i.test(html) ||
    /transform:\s*(?:matrix|scaleX)/i.test(html) ||
    /font-family:[^;]*(?:pdf|timesnewromanps|couriernewps|arialmt|helvetica|type1|truetype|g_d0|cff|cmbx|cmr\d)/i.test(
      html
    ) ||
    hasPdfWrappedLinesInHtml(html)
  )
}

/**
 * Detects if text contains legal contract structure, formal clauses or section headers
 */
export function isLegalContractOrPdfText(text: string): boolean {
  if (!text || typeof text !== 'string') return false
  const trimmed = text.trim()
  if (trimmed.length < 10) return false

  return (
    /\b(?:REUNIDOS|CL[ÁA]USULAS|CONTRATO|ANTECEDENTES|ESTIPULACIONES|EXPONEN|MANIFIESTAN|ACUERDAN|DISPOSICIONES|DECLARACIONES)\b/i.test(
      trimmed
    ) ||
    /\b(?:PRIMERA|SEGUNDA|TERCERA|CUARTA|QUINTA|SEXTA|S[ÉE]PTIMA|OCTAVA|NOVENA|D[ÉE]CIMA|UND[ÉE]CIMA|DUOD[ÉE]CIMA|CL[ÁA]USULA\s+[A-Z0-9]+|ART[ÍI]CULO\s+\d+)\s*:/i.test(
      trimmed
    ) ||
    /\b(?:DE|POR)\s+(?:UNA|OTRA|LA\s+PRIMERA|LA\s+SEGUNDA)\s+PARTE\s*:/i.test(trimmed) ||
    /\b(?:LA\s+CONSULTORA|EMPLEADO\/A|CONTRATO\s+INDIVIDUAL\s+DE\s+TRABAJO)\b/.test(trimmed)
  )
}

/**
 * Checks if a line is a universal label or property ending in colon
 * (e.g. "Nota:", "Importante:", "Objetivo:", "Fecha:", "Definición:")
 */
export function isColonLabel(line: string): boolean {
  const trimmed = line.trim()
  if (!trimmed) return false
  return COLON_LABEL_REGEX.test(trimmed)
}

/**
 * Decomposes typographical ligatures (ff, fi, fl, ffi, ffl, ft, st) into standard ASCII characters.
 * Preserves real orthographic letters like œ, Œ, æ, Æ.
 */
export function normalizeLigatures(text: string): string {
  if (!text) return ''
  return text
    .replace(/\uFB00/g, 'ff')
    .replace(/\uFB01/g, 'fi')
    .replace(/\uFB02/g, 'fl')
    .replace(/\uFB03/g, 'ffi')
    .replace(/\uFB04/g, 'ffl')
    .replace(/\uFB05/g, 'ft')
    .replace(/\uFB06/g, 'st')
    .replace(/\u0132/g, 'IJ')
    .replace(/\u0133/g, 'ij')
}

/**
 * Maps a single Unicode Mathematical Alphanumeric character to its ASCII letter/digit and style kind.
 */
function mapMathUnicodeChar(
  cp: number
): { ch: string; bold: boolean; italic: boolean; mono: boolean } | null {
  // Math Bold (U+1D400 - U+1D433, digits U+1D7CE - U+1D7D7)
  if (cp >= 0x1d400 && cp <= 0x1d419) return { ch: String.fromCharCode(65 + (cp - 0x1d400)), bold: true, italic: false, mono: false }
  if (cp >= 0x1d41a && cp <= 0x1d433) return { ch: String.fromCharCode(97 + (cp - 0x1d41a)), bold: true, italic: false, mono: false }
  if (cp >= 0x1d7ce && cp <= 0x1d7d7) return { ch: String.fromCharCode(48 + (cp - 0x1d7ce)), bold: true, italic: false, mono: false }

  // Math Italic (U+1D434 - U+1D467; 1D455 is reserved for U+210E PLANCK CONSTANT 'h')
  if (cp >= 0x1d434 && cp <= 0x1d44d) return { ch: String.fromCharCode(65 + (cp - 0x1d434)), bold: false, italic: true, mono: false }
  if (cp >= 0x1d44e && cp <= 0x1d467) return { ch: String.fromCharCode(97 + (cp - 0x1d44e)), bold: false, italic: true, mono: false }

  // Math Bold Italic (U+1D468 - U+1D49B)
  if (cp >= 0x1d468 && cp <= 0x1d481) return { ch: String.fromCharCode(65 + (cp - 0x1d468)), bold: true, italic: true, mono: false }
  if (cp >= 0x1d482 && cp <= 0x1d49b) return { ch: String.fromCharCode(97 + (cp - 0x1d482)), bold: true, italic: true, mono: false }

  // Math Sans-Serif Bold (U+1D5D4 - U+1D607, digits U+1D7EC - U+1D7F5)
  if (cp >= 0x1d5d4 && cp <= 0x1d5ed) return { ch: String.fromCharCode(65 + (cp - 0x1d5d4)), bold: true, italic: false, mono: false }
  if (cp >= 0x1d5ee && cp <= 0x1d607) return { ch: String.fromCharCode(97 + (cp - 0x1d5ee)), bold: true, italic: false, mono: false }
  if (cp >= 0x1d7ec && cp <= 0x1d7f5) return { ch: String.fromCharCode(48 + (cp - 0x1d7ec)), bold: true, italic: false, mono: false }

  // Math Sans-Serif Italic (U+1D608 - U+1D63B)
  if (cp >= 0x1d608 && cp <= 0x1d621) return { ch: String.fromCharCode(65 + (cp - 0x1d608)), bold: false, italic: true, mono: false }
  if (cp >= 0x1d622 && cp <= 0x1d63b) return { ch: String.fromCharCode(97 + (cp - 0x1d622)), bold: false, italic: true, mono: false }

  // Math Sans-Serif Bold Italic (U+1D63C - U+1D66F)
  if (cp >= 0x1d63c && cp <= 0x1d655) return { ch: String.fromCharCode(65 + (cp - 0x1d63c)), bold: true, italic: true, mono: false }
  if (cp >= 0x1d656 && cp <= 0x1d66f) return { ch: String.fromCharCode(97 + (cp - 0x1d656)), bold: true, italic: true, mono: false }

  // Math Monospace (U+1D670 - U+1D6A3, digits U+1D7F6 - U+1D7FF)
  if (cp >= 0x1d670 && cp <= 0x1d689) return { ch: String.fromCharCode(65 + (cp - 0x1d670)), bold: false, italic: false, mono: true }
  if (cp >= 0x1d68a && cp <= 0x1d6a3) return { ch: String.fromCharCode(97 + (cp - 0x1d68a)), bold: false, italic: false, mono: true }
  if (cp >= 0x1d7f6 && cp <= 0x1d7ff) return { ch: String.fromCharCode(48 + (cp - 0x1d7f6)), bold: false, italic: false, mono: true }

  return null
}

/**
 * Converts Unicode Mathematical Bold, Italic, Bold-Italic, and Monospace characters
 * into normal characters wrapped in semantic HTML tags (`<strong>`, `<em>`, `<code>`).
 * Assumes input text has already been HTML-escaped (or does not contain raw HTML tags).
 */
export function convertMathematicalBoldToHtml(text: string): string {
  if (!text) return ''
  if (!HYPOTHETICAL_MATH_BOLD_CHECK_REGEX.test(text)) return text

  let out = ''
  let activeBold = false
  let activeItalic = false
  let activeMono = false
  let buf = ''

  const flush = () => {
    if (!buf) return
    let wrapped = buf
    if (activeMono) wrapped = `<code>${wrapped}</code>`
    if (activeItalic) wrapped = `<em>${wrapped}</em>`
    if (activeBold) wrapped = `<strong>${wrapped}</strong>`
    out += wrapped
    buf = ''
  }

  for (const char of text) {
    const cp = char.codePointAt(0)
    const mapped = cp !== undefined ? mapMathUnicodeChar(cp) : null
    if (mapped) {
      if (mapped.bold !== activeBold || mapped.italic !== activeItalic || mapped.mono !== activeMono) {
        flush()
        activeBold = mapped.bold
        activeItalic = mapped.italic
        activeMono = mapped.mono
      }
      buf += mapped.ch
    } else if ((activeBold || activeItalic || activeMono) && char === ' ') {
      // Keep single spaces inside a bold/italic phrase so `𝐀𝐁𝐂 𝐃𝐄𝐅` becomes `<strong>ABC DEF</strong>`
      buf += char
    } else {
      flush()
      activeBold = false
      activeItalic = false
      activeMono = false
      out += char
    }
  }
  flush()
  return out
}

/**
 * Fixes hyphenated words broken across linebreaks:
 * e.g. "conser-\n  vación" -> "conservación"
 */
export function fixHyphenatedLinebreaks(text: string): string {
  if (!text) return ''
  let cleaned = text.replace(/([\p{L}])\u00AD[ \t]*\n[ \t]*([\p{L}])/gu, '$1$2')
  cleaned = cleaned.replace(/\u00AD/g, '')
  // Join line-end hyphenation across standard/unicode hyphens (excluding em-dash \u2014)
  cleaned = cleaned.replace(
    /([\p{L}]{1,})[-\u2010\u2011\u2012\u2013\u2212\uFE63\uFF0D][ \t]*\n[ \t]*([\p{L}]{1,})/gu,
    '$1$2'
  )
  return cleaned
}

/**
 * Normalizes unwanted PDF kerning/justification spacing and punctuation spacing
 * on plain text strings (never run over raw HTML tag markup!).
 */
export function normalizeSpacingAndPunctuation(text: string, collapseMultiSpaces = true): string {
  if (!text) return ''
  let res = text

  // 1. Spaced-out uppercase/display letters in headings: e.g. "D E C L A R A C I Ó N" -> "DECLARACIÓN"
  res = res.replace(
    /(?:^|(?<=\s))((?:[\p{Lu}]\x20){3,}[\p{Lu}])(?=\s|[.,:;?!]|$)/gu,
    (match) => match.replace(/\x20/g, '')
  )

  // 2. PDF kerning split around Spanish/accented suffixes: e.g. "comunicaci ón" -> "comunicación"
  res = res.replace(/([\p{L}]{3,}ci)\x20([óo]n)(?=$|[\s.,;:?!»”’)])/giu, '$1$2')
  res = res.replace(/([\p{L}]{3,}si)\x20([óo]n)(?=$|[\s.,;:?!»”’)])/giu, '$1$2')

  // 3. Space between consonant cluster prefix and accented syllable: e.g. "t ambién" -> "también", "m ás" -> "más"
  res = res.replace(
    /(?:^|(?<=\s))([bcdfghjklmnpqrstvwxyzBCDFGHJKLMNPQRSTVWXYZ]{1,2})\x20([áéíóúÁÉÍÓÚñÑüÜ][\p{L}]*)(?=$|[\s.,;:?!»”’)])/gu,
    '$1$2'
  )

  // 4. Space before closing punctuation
  res = res.replace(/[ \t]+([,.;:?!»”’)])/gu, '$1')

  // 5. Space after opening brackets / inverted Spanish marks
  res = res.replace(/([«“‘(\[])[ \t]+/gu, '$1')
  res = res.replace(/([¿¡])[ \t]+/gu, '$1')

  // 6. Slashes in options: "y / o" -> "y/o", "km / h" -> "km/h"
  res = res.replace(/([\p{L}])\s*\/\s*([\p{L}])/gu, '$1/$2')

  // 7. Missing space after sentence period when PDF glued words (e.g. "contrato.El" -> "contrato. El")
  res = res.replace(
    /([\p{Ll}]{3,})\.([\p{Lu}][\p{Ll}]{2,})/gu,
    '$1. $2'
  )

  // 8. Missing space after comma/semicolon when PDF glued words (skip numbers like 1,500)
  res = res.replace(
    /([\p{L}]{2,})([,;])([\p{L}]{2,})/gu,
    '$1$2 $3'
  )

  // 9. Collapse multiple spaces into one
  if (collapseMultiSpaces) {
    res = res.replace(/[ \t]{2,}/g, ' ')
  }

  return res
}

/**
 * Detects if plain text contains PDF copying patterns or structured formatting.
 */
export function isPdfOrStructuredText(text: string): boolean {
  if (!text || typeof text !== 'string') return false
  const normalized = normalizePdfCharacters(text, true)
  const trimmed = normalized.trim()
  if (trimmed.length < 4) return false

  if (isLegalContractOrPdfText(trimmed)) return true

  // Hyphenated line breaks or soft hyphens
  if (/[\p{L}]{1,}[-\u00AD\u2010\u2011\u2012\u2013\u2212\uFE63\uFF0D][ \t]*\n[ \t]*[\p{L}]{1,}/u.test(trimmed)) {
    return true
  }
  if (trimmed.includes('\u00AD') || /\uFB00|\uFB01|\uFB02|\uFB03|\uFB04/.test(text)) {
    return true
  }

  // Mathematical bold/italic Unicode characters
  if (HYPOTHETICAL_MATH_BOLD_CHECK_REGEX.test(trimmed)) return true

  // Markdown bold/heading/task syntax
  if (/\*\*[^*\n]+\*\*/.test(trimmed) || /(?:^|\n)#{1,4}\s+\S/.test(trimmed)) return true

  // Colon labels at line start
  if (isColonLabel(trimmed)) return true

  // Bullet characters at line start
  if (new RegExp(`(?:^|\\n)\\s*[${LIST_BULLET_CHARS}-]\\s+`, 'u').test(trimmed)) {
    return true
  }

  // Numbered/lettered lists or task checkboxes
  if (/(?:^|\n)\s*(?:\d{1,3}[\.\)]\s+\S|\[[ xX✓✔]\]\s+\S|[☐☑✅]\s+\S)/.test(trimmed)) {
    return true
  }

  // Tabular data (tabs or 3+ aligned spaces across consecutive lines or pipes)
  if (/(?:^|\n)[^\n]+\t[^\n]+\n[^\n]+\t[^\n]+/.test(trimmed)) return true
  if (/(?:^|\n)[^\n]+\x20{3,}[^\n]+\n[^\n]+\x20{3,}[^\n]+/.test(trimmed)) return true
  if (/(?:^|\n)\|[^\n]+\|\n\|[^\n]+\|/.test(trimmed)) return true

  // Page numbers
  if (/(?:^|\n)\s*(?:Página|Pág\.?|Page)\s+\d+/i.test(trimmed)) return true

  // Justified multi-space or PDF kerning spaces on single line
  if (/\S\x20{2,}\S/.test(trimmed) || /[ \t]+[,.;:?!]/.test(trimmed)) return true

  // Wrapped lines without terminating punctuation (classic PDF column wrap)
  const lines = trimmed
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
  if (lines.length >= 2) {
    for (let i = 0; i < lines.length - 1; i++) {
      const line = lines[i]
      const nextLine = lines[i + 1]
      const noPunctuation = !/[.?!:;]$/.test(line)
      const nextIsLower = /^[\p{Ll}]/u.test(nextLine)
      if (line.length >= 10 && (noPunctuation || nextIsLower) && /^[\p{L}0-9("«“]/u.test(nextLine)) {
        return true
      }
    }
  }

  return false
}

export function isStandaloneHeader(line: string): boolean {
  const trimmed = line.trim()
  if (!trimmed || trimmed.length > 85) return false

  if (STANDALONE_LEGAL_OR_SECTION_HEADERS_REGEX.test(trimmed)) {
    return true
  }

  // Ordinal/clause headings: PRIMERA: OBJETO..., ARTÍCULO 5.- ..., CAPÍTULO 2: ...
  if (
    /^(?:PRIMERA|SEGUNDA|TERCERA|CUARTA|QUINTA|SEXTA|S[ÉE]PTIMA|OCTAVA|NOVENA|D[ÉE]CIMA|UND[ÉE]CIMA|DUOD[ÉE]CIMA|CL[ÁA]USULA\s+[A-Z0-9]+|ART[ÍI]CULO\s+\d+|CAP[ÍI]TULO\s+[IVXLC0-9]+|SECCI[ÓO]N\s+[IVXLC0-9]+|T[ÍI]TULO\s+[IVXLC0-9]+)\s*(?::|\.-|-)\s*[^.]*$/i.test(
      trimmed
    )
  ) {
    return true
  }

  // Multi-level numbered section headers: "1.2 Objetivos", "2.1.3 Alcance del proyecto"
  if (/^\d+(?:\.\d+)+\.?\s+[\p{L}0-9]/u.test(trimmed) && !/[.?!;]$/.test(trimmed)) {
    return true
  }

  // Standalone all-caps heading line without sentence ending punctuation
  if (/^[\p{Lu}0-9\s.,:/\-–—()«»"']{4,75}$/u.test(trimmed) && !/[.?!;]$/.test(trimmed)) {
    const letters = trimmed.replace(/[^\p{L}]/gu, '')
    const upperLetters = trimmed.replace(/[^\p{Lu}]/gu, '')
    if (letters.length >= 4 && upperLetters.length === letters.length) {
      return true
    }
  }

  return false
}

export function isPartyOrClauseStart(line: string): boolean {
  const trimmed = line.trim()
  if (!trimmed) return false

  if (/^(?:DE|POR)\s+(?:UNA|OTRA|LA\s+PRIMERA|LA\s+SEGUNDA)\s+PARTE\s*:/i.test(trimmed)) {
    return true
  }

  if (
    /^(?:Ambas partes|En la ciudad de|Por lo tanto|En consecuencia|Las partes acuerdan|Las partes convienen|Las partes declaran)\b/.test(
      trimmed
    )
  ) {
    return true
  }

  return false
}

function isShortMetadataOrAddressLine(line: string): boolean {
  const trimmed = line.trim()
  if (!trimmed) return false
  if (/^[\w.+-]+@[\w-]+\.[\w.-]+$/.test(trimmed)) return true
  if (/^(?:https?:\/\/|www\.)\S+$/i.test(trimmed)) return true
  if (/^\+?\d[\d\s\-().]{6,20}$/.test(trimmed)) return true
  if (/^[A-ZÁÉÍÓÚÑ][a-záéíóúñA-ZÁÉÍÓÚÑ\s.]{1,28}:\s+\S/.test(trimmed)) return true
  return false
}

function endsWithClauseConnector(line: string): boolean {
  const trimmed = line.trim()
  if (/[,;–—\-/]$/.test(trimmed)) return true
  const lastWord = trimmed.split(/\s+/).pop()?.toLowerCase() || ''
  return /^(?:y|e|o|u|de|del|la|el|los|las|un|una|en|con|por|para|sin|sobre|entre|que|como|the|and|or|of|to|in|for|with|on|by|from|that|as)$/i.test(
    lastWord
  )
}

/**
 * Determines whether currLine is a continuation of the previous paragraph line
 * or should start a new paragraph/block, taking document line width and indentation into account.
 */
export function isLineContinuation(
  prevLine: string,
  currLine: string,
  typicalLineWidth = 72
): boolean {
  const prev = prevLine.trim()
  const curr = currLine.trim()
  if (!prev || !curr) return false

  // Lists start a new block
  if (BULLET_LINE_START_REGEX.test(curr) || TASK_LINE_START_REGEX.test(curr)) return false
  if (/^(?:\d{1,3}[\.\)]\s+\S|[a-z][\.\)]\s+\S)/u.test(curr)) return false

  // Markdown blockquotes / headings start a new block
  if (/^(?:>|#{1,6}\s+)/.test(curr)) return false

  // Standalone headers, clauses, colon labels
  if (isStandaloneHeader(curr) || isPartyOrClauseStart(curr) || isColonLabel(curr)) return false
  if (isStandaloneHeader(prev) || isPartyOrClauseStart(prev)) return false

  // Keep distinct metadata / contact / address / signature lines separate when short
  if (isShortMetadataOrAddressLine(curr) && prev.length < Math.max(46, typicalLineWidth * 0.72)) {
    return false
  }
  if (isShortMetadataOrAddressLine(prev) && prev.length < Math.max(46, typicalLineWidth * 0.72)) {
    return false
  }

  // If previous line ended with sentence punctuation (. ? ! : » ”)
  if (/[.?!:»”"]$/.test(prev)) {
    // Lowercase start on next line indicates continuation (e.g. after "art. " or "pág. ")
    if (/^[\p{Ll}]/u.test(curr)) return true

    // Common abbreviations ending with '.' stay in same paragraph
    if (ABBREVIATIONS_AT_END_REGEX.test(prev)) return true

    // Colon at end of line almost always introduces a new block/list/clause
    if (prev.endsWith(':')) return false

    // Geometry-based paragraph end detection:
    // Could the first word of currLine have fit on prevLine?
    const firstWord = curr.split(/\s+/)[0] || ''
    const effectiveWidth = Math.max(52, typicalLineWidth)
    const filledRatio = prev.length / effectiveWidth
    const wouldOverflowMargin = prev.length + 1 + firstWord.length > effectiveWidth * 0.94

    if (filledRatio >= 0.78 && wouldOverflowMargin) {
      return true
    }

    return false
  }

  // Short non-sentence lines (addresses, names, headers, signatures) that do NOT end with a connector
  const shortLineThreshold = Math.min(42, Math.max(28, typicalLineWidth * 0.54))
  if (
    prev.length < shortLineThreshold &&
    !endsWithClauseConnector(prev) &&
    /^[\p{Lu}0-9+@]/u.test(curr) &&
    curr.length < effectiveShortLineCap(typicalLineWidth)
  ) {
    return false
  }

  return true
}

function effectiveShortLineCap(typicalLineWidth: number): number {
  return Math.max(48, typicalLineWidth * 0.78)
}

/**
 * Applies bolding ONLY to leading structural colon labels ("Nota:", "DE UNA PARTE:")
 * and standalone legal clause starts at the start of an unbolded HTML text segment.
 * Does NOT randomly bold numbers in parentheses like (1), (2).
 */
export function boldLegalAndCapitalizedTerms(htmlOrText: string): string {
  if (!htmlOrText) return ''
  // Skip if the line already starts with <strong> or <b> or heading
  if (/^\s*<(?:strong|b|h[1-6])\b/i.test(htmlOrText)) {
    return htmlOrText
  }

  let result = htmlOrText

  // Party prefixes with entity name at paragraph start: "DE UNA PARTE: Estudio Seven,"
  const partyMatch = result.match(
    /^((?:DE|POR)\s+(?:UNA|OTRA|LA\s+PRIMERA|LA\s+SEGUNDA)\s+PARTE\s*:\s*)([A-ZÁÉÍÓÚÑ][\p{L}0-9]+(?:\s+[A-ZÁÉÍÓÚÑ][\p{L}0-9]+)*,)/iu
  )
  if (partyMatch) {
    return `<strong>${partyMatch[1]}${partyMatch[2]}</strong>${result.slice(partyMatch[0].length)}`
  }

  // Leading colon label at start of block/list item ("Nota:", "Importante:", "Fecha:", "PRIMERA:")
  const colonMatch = result.match(COLON_LABEL_PREFIX_REGEX)
  if (colonMatch) {
    return `<strong>${colonMatch[1]}</strong>${result.slice(colonMatch[0].length)}`
  }

  // Standalone uppercase legal entity constants
  result = result.replace(
    /(?<![<>])\b(LA\s+CONSULTORA|EL\s+CLIENTE|EL\s+PROVEEDOR|EL\s+TRABAJADOR|EL\s+EMPLEADOR|EL\s+ARRENDADOR|EL\s+ARRENDATARIO|EMPLEADO\/A|CONTRATO\s+INDIVIDUAL\s+DE\s+TRABAJO|CONTRATO\s+DE\s+TRABAJO)\b(?![^<]*<\/strong>)/g,
    '<strong>$1</strong>'
  )

  return result
}

/**
 * Auto-links bare URLs in already-HTML-escaped text without touching existing <a> tags or trailing punctuation.
 */
function linkifyEscapedText(str: string): string {
  if (!str || !/(?:https?:\/\/|www\.)/i.test(str)) return str
  // Split by HTML tags so we only linkify text outside tags
  const tokens = str.split(/(<[^>]+>)/g)
  let insideAnchor = false
  return tokens
    .map((tok) => {
      if (tok.startsWith('<')) {
        if (/^<a\b/i.test(tok)) insideAnchor = true
        else if (/^<\/a>/i.test(tok)) insideAnchor = false
        return tok
      }
      if (insideAnchor) return tok
      return tok.replace(/(https?:\/\/[^\s<>"'`]+|www\.[^\s<>"'`]+)/gi, (rawUrl) => {
        // Trim trailing sentence punctuation out of URL
        let url = rawUrl
        let trailing = ''
        while (/[.,;:!?)\]]$/.test(url)) {
          // Keep balanced ')' if '(' exists inside URL
          if (url.endsWith(')') && (url.match(/\(/g)?.length || 0) >= (url.match(/\)/g)?.length || 0)) {
            break
          }
          trailing = url.slice(-1) + trailing
          url = url.slice(0, -1)
        }
        const href = /^https?:\/\//i.test(url) ? url : `https://${url}`
        return `<a href="${href}" target="_blank" rel="noopener noreferrer">${url}</a>${trailing}`
      })
    })
    .join('')
}

/**
 * Collects flat inline formatting runs from a DOM subtree, respecting inherited CSS & overrides.
 */
function collectInlineRuns(
  node: Node,
  parentState: FormattingState,
  currentHref?: string
): InlineRun[] {
  const runs: InlineRun[] = []

  if (node.nodeType === Node.TEXT_NODE) {
    const raw = node.textContent || ''
    if (!raw) return runs
    const normalized = normalizeLigatures(normalizePdfCharacters(raw, true))
    if (!normalized) return runs
    runs.push({ text: normalized, state: parentState, href: currentHref })
    return runs
  }

  if (node.nodeType !== Node.ELEMENT_NODE) return runs
  const el = node as HTMLElement
  const tag = el.tagName.toLowerCase()

  if (tag === 'script' || tag === 'style' || tag === 'meta' || tag === 'link' || tag === 'noscript') {
    return runs
  }

  if (tag === 'br') {
    runs.push({ text: '', state: parentState, isBr: true })
    return runs
  }

  if (tag === 'img') {
    const src = el.getAttribute('src')
    if (src) {
      const alt = escapeHtml(el.getAttribute('alt') || '')
      runs.push({ text: '', state: parentState, rawHtml: `<img src="${escapeHtml(src)}" alt="${alt}" />` })
    }
    return runs
  }

  const nextState = computeElementFormatting(el, parentState)
  const nextHref = tag === 'a' ? el.getAttribute('href') || currentHref : currentHref

  for (const child of Array.from(el.childNodes)) {
    runs.push(...collectInlineRuns(child, nextState, nextHref))
  }

  return runs
}

function sameFormattingState(a: FormattingState, b: FormattingState): boolean {
  return (
    a.bold === b.bold &&
    a.italic === b.italic &&
    a.underline === b.underline &&
    a.strike === b.strike &&
    a.sub === b.sub &&
    a.sup === b.sup &&
    a.code === b.code &&
    a.color === b.color &&
    a.highlight === b.highlight
  )
}

/**
 * Renders merged InlineRun[] into clean, normalized HTML without stray tag splits or bogus spaces.
 */
function renderInlineRuns(runs: InlineRun[], normalizeSpace = true): string {
  if (runs.length === 0) return ''

  // 1. Merge adjacent text runs that share identical formatting and href
  const merged: InlineRun[] = []
  for (const r of runs) {
    if (r.isBr || r.rawHtml) {
      merged.push(r)
      continue
    }
    const prev = merged[merged.length - 1]
    if (prev && !prev.isBr && !prev.rawHtml && prev.href === r.href && sameFormattingState(prev.state, r.state)) {
      prev.text += r.text
    } else {
      merged.push({ ...r })
    }
  }

  // 2. Render each run
  let html = ''
  for (const r of merged) {
    if (r.isBr) {
      html += '<br />'
      continue
    }
    if (r.rawHtml) {
      html += r.rawHtml
      continue
    }

    let text = r.text
    if (normalizeSpace) {
      text = text.replace(/\t+/g, ' ').replace(/[ \n]+/g, ' ')
    }
    if (!text) continue

    let segment = convertMathematicalBoldToHtml(escapeHtml(text))
    if (r.state.code) segment = `<code>${segment}</code>`
    if (r.state.sub) segment = `<sub>${segment}</sub>`
    if (r.state.sup) segment = `<sup>${segment}</sup>`
    if (r.state.underline) segment = `<u>${segment}</u>`
    if (r.state.strike) segment = `<s>${segment}</s>`
    if (r.state.italic) segment = `<em>${segment}</em>`
    if (r.state.bold) segment = `<strong>${segment}</strong>`
    if (r.state.color) {
      segment = `<span style="color: ${escapeHtml(r.state.color)}">${segment}</span>`
    }
    if (r.state.highlight) {
      segment = `<mark style="background-color: ${escapeHtml(r.state.highlight)}">${segment}</mark>`
    }
    if (r.href && /^(https?:|mailto:|\/|#)/i.test(r.href.trim())) {
      segment = `<a href="${escapeHtml(r.href.trim())}" target="_blank" rel="noopener noreferrer">${segment}</a>`
    }

    html += segment
  }

  // 3. Cleanly merge adjacent identical inline wrappers (NO space injected!)
  let prev = ''
  while (prev !== html) {
    prev = html
    html = html
      .replace(/<\/(strong|em|u|s|code|sub|sup)>(\s*)<\1>/gi, '$2')
      .replace(/<(strong|em|u|s|code|sub|sup)>(\s*)<\/\1>/gi, '$2')
  }

  // 4. Normalize punctuation spacing on text outside tags
  if (normalizeSpace) {
    html = normalizeSpacingInHtmlText(html)
  }

  return html.trim()
}

/**
 * Normalizes PDF kerning & punctuation spacing across HTML text nodes without corrupting tags/attributes.
 */
function normalizeSpacingInHtmlText(html: string): string {
  // Remove spaces immediately before closing punctuation even across closing inline tags: `</strong> ,` -> `</strong>,`
  let out = html.replace(/([ \t]+)((?:<\/(?:strong|em|u|s|span|mark|code|a)>)*)([,.;:?!»”’)])/gi, '$2$3')
  // Ensure a space after `,` `;` `:` when followed immediately by an opening inline formatting tag + letter
  out = out.replace(/([,;:])(<(?:strong|em|u|s|span|mark|code|a)\b[^>]*>[\p{L}])/giu, '$1 $2')
  // Collapse double spaces across text/tag boundaries (`<strong>A</strong>  B` -> `<strong>A</strong> B`)
  out = out.replace(/[ \t]{2,}/g, ' ')
  // Apply safe text-only normalization per text token
  const parts = out.split(/(<[^>]+>)/g)
  out = parts
    .map((part) => (part.startsWith('<') ? part : normalizeSpacingAndPunctuation(part, true)))
    .join('')
  return out.trim()
}

function getMedian(values: number[]): number {
  if (values.length === 0) return 0
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid]
}

function getPercentile(values: number[], p: number): number {
  if (values.length === 0) return 0
  const sorted = [...values].sort((a, b) => a - b)
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.floor(sorted.length * p)))
  return sorted[idx]
}

function isIsolatedPageNumber(text: string): boolean {
  const t = text.trim()
  if (!t) return false
  return (
    /^(?:Página\s+\d+(?:\s*(?:de|\/)\s*\d+)?|Pág\.?\s*\d+(?:\s*(?:de|\/)\s*\d+)?|Page\s+\d+(?:\s*(?:of|\/)\s*\d+)?|[-–—]\s*\d+\s*[-–—])$/i.test(
      t
    )
  )
}

function headingTagForFontRatio(fontSizePx: number, bodyFontPx: number, charLen: number): 'h1' | 'h2' | 'h3' | null {
  if (!bodyFontPx || charLen > 140) return null
  const ratio = fontSizePx / bodyFontPx
  if (ratio >= 1.58) return 'h1'
  if (ratio >= 1.28) return 'h2'
  if (ratio >= 1.13) return 'h3'
  return null
}

function formatBlockAlignmentAndIndentStyle(options: {
  align?: string | null
  indentLevels?: number
  textIndent?: boolean
}): string {
  const parts: string[] = []
  if (options.align && /^(center|right|justify)$/i.test(options.align)) {
    parts.push(`text-align: ${options.align.toLowerCase()}`)
  }
  if (options.indentLevels && options.indentLevels > 0) {
    const capped = Math.min(6, Math.max(1, Math.round(options.indentLevels)))
    parts.push(`margin-left: ${capped * 1.5}rem`)
  }
  if (options.textIndent) {
    parts.push('text-indent: 1.5em')
  }
  return parts.length > 0 ? ` style="${parts.join('; ')}"` : ''
}

function computeIndentLevelFromCss(styleText: string): number {
  const decls = parseCssDeclarationBlock(styleText)
  const ml = parseCssLengthPx(decls['margin-left']) ?? 0
  const pl = parseCssLengthPx(decls['padding-left']) ?? 0
  const total = ml + pl
  if (total < 14) return 0
  return Math.min(6, Math.max(1, Math.round(total / 24)))
}

function hasCssFirstLineIndent(styleText: string): boolean {
  const decls = parseCssDeclarationBlock(styleText)
  const ti = parseCssLengthPx(decls['text-indent'])
  return ti !== null && ti >= 10
}

/**
 * Strips leading bullet/number marker from an HTML line while keeping subsequent formatting tags intact.
 */
function stripLeadingMarkerFromHtml(html: string, markerRegex: RegExp): string {
  // Handle optional leading inline open tags before the marker text: e.g. `<strong>• </strong>Item` or `<strong>• Item</strong>`
  let cleaned = html.trim()
  const leadingTagMatch = cleaned.match(/^((?:<(?:strong|em|u|s|span|mark)[^>]*>)+)\s*/i)
  if (leadingTagMatch) {
    const prefixTags = leadingTagMatch[1]
    const rest = cleaned.slice(leadingTagMatch[0].length)
    if (markerRegex.test(rest)) {
      cleaned = prefixTags + rest.replace(markerRegex, '')
      // Remove empty tag pairs created by stripping
      cleaned = cleaned.replace(/<(strong|em|u|s|span|mark)[^>]*>\s*<\/\1>/gi, '').trim()
      return cleaned
    }
  }
  return cleaned.replace(markerRegex, '').trim()
}

/**
 * Joins two HTML line segments, merging hyphenated split words cleanly even across formatting tags.
 */
function joinHtmlLines(prevHtml: string, nextHtml: string, hyphenJoin: boolean): string {
  if (!hyphenJoin) {
    return `${prevHtml} ${nextHtml}`
  }
  // Remove trailing hyphen before optional closing inline tags
  const strippedPrev = prevHtml.replace(
    /([-\u00AD\u2010\u2011\u2012\u2013\u2212\uFE63\uFF0D])((?:\s*<\/(?:strong|em|u|s|span|mark|code)>)*\s*)$/u,
    '$2'
  )
  const merged = `${strippedPrev}${nextHtml}`
  let out = merged
  let prev = ''
  while (prev !== out) {
    prev = out
    out = out.replace(/<\/(strong|em|u|s|code)>(\s*)<\1>/gi, '$2')
  }
  return out
}

/**
 * Extracts positioned text fragments from PDF.js / pdf2htmlEX / absolute-positioned HTML.
 */
function extractPositionedFragments(doc: Document): PositionedFragment[] | null {
  const candidates = Array.from(doc.querySelectorAll('span, div, p'))
  const leafPositioned: { el: HTMLElement; x: number; y: number; unit: 'px' | '%'; fontSizePx: number }[] = []

  for (const node of candidates) {
    if (!(node instanceof HTMLElement)) continue
    const styleText = node.getAttribute('style') || ''
    const decls = parseCssDeclarationBlock(styleText)

    let leftCoord = parseCssCoord(decls['left'])
    let topCoord = parseCssCoord(decls['top'])

    // Support CSS transform: matrix(a, b, c, d, tx, ty) or translate(tx, ty)
    if ((!leftCoord || !topCoord) && decls['transform']) {
      const matMatch = decls['transform'].match(/matrix\([^,]+,[^,]+,[^,]+,[^,]+,\s*(-?[\d.]+),\s*(-?[\d.]+)\)/i)
      if (matMatch) {
        leftCoord = { value: parseFloat(matMatch[1]), unit: 'px' }
        topCoord = { value: parseFloat(matMatch[2]), unit: 'px' }
      } else {
        const trMatch = decls['transform'].match(/translate(?:3d)?\(\s*(-?[\d.]+(?:px|pt|%)?)\s*,\s*(-?[\d.]+(?:px|pt|%)?)/i)
        if (trMatch) {
          leftCoord = parseCssCoord(trMatch[1])
          topCoord = parseCssCoord(trMatch[2])
        }
      }
    }

    if (!leftCoord || !topCoord) continue

    // Skip container wrappers that hold other positioned elements inside
    const hasPositionedChild = Array.from(node.querySelectorAll('span, div, p')).some((child) => {
      const cs = child.getAttribute('style') || ''
      return /\bleft\s*:|\btop\s*:/i.test(cs)
    })
    if (hasPositionedChild) continue

    const text = node.textContent || ''
    if (!text.trim()) continue

    const fontSizePx = parseCssLengthPx(decls['font-size']) ?? 12
    leafPositioned.push({
      el: node,
      x: leftCoord.value,
      y: topCoord.value,
      unit: topCoord.unit,
      fontSizePx
    })
  }

  if (leafPositioned.length < 2) return null

  const fragments: PositionedFragment[] = []
  let runIndex = 0
  let lastY: number | null = null
  let lastPageNode: Element | null = null

  for (const item of leafPositioned) {
    const pageNode = item.el.closest('[data-page-number], .page')
    if (lastPageNode && pageNode && pageNode !== lastPageNode) {
      runIndex++
    } else if (lastY !== null) {
      const resetThreshold = item.unit === '%' ? 5 : Math.max(24, item.fontSizePx * 2.5)
      if (item.y < lastY - resetThreshold) {
        // Page change or next column in multi-column PDF
        runIndex++
      }
    }

    const runs = collectInlineRuns(item.el, DEFAULT_FORMATTING_STATE)
    const plainText = runs.map((r) => r.text).join('')
    if (plainText.trim()) {
      const nonEmptyRuns = runs.filter((r) => r.text.trim().length > 0)
      const isAllBold = nonEmptyRuns.length > 0 && nonEmptyRuns.every((r) => r.state.bold)
      const isAllItalic = nonEmptyRuns.length > 0 && nonEmptyRuns.every((r) => r.state.italic)

      fragments.push({
        x: item.x,
        y: item.y,
        unit: item.unit,
        fontSizePx: item.fontSizePx,
        runs,
        plainText,
        isAllBold,
        isAllItalic,
        runIndex
      })
      lastY = item.y
      lastPageNode = pageNode
    }
  }

  return fragments.length >= 2 ? fragments : null
}

/**
 * Reconstructs visual lines and structured blocks from positioned PDF HTML fragments.
 */
function processPositionedPdfFragments(fragments: PositionedFragment[]): string {
  // Segment by monotonic runIndex (pages / columns)
  const segments = new Map<number, PositionedFragment[]>()
  for (const frag of fragments) {
    const arr = segments.get(frag.runIndex) || []
    arr.push(frag)
    segments.set(frag.runIndex, arr)
  }

  const allVisualLines: VisualLine[] = []
  let prevSegmentHadLines = false

  for (const segFragments of segments.values()) {
    const unit = segFragments[0].unit
    // Group into visual lines by Y proximity
    const sortedByY = [...segFragments].sort((a, b) => a.y - b.y)
    const lineGroups: PositionedFragment[][] = []

    for (const frag of sortedByY) {
      const lastGroup = lineGroups[lineGroups.length - 1]
      if (!lastGroup) {
        lineGroups.push([frag])
        continue
      }
      const refFrag = lastGroup[0]
      const tol = unit === '%' ? 0.55 : Math.max(3, Math.min(refFrag.fontSizePx, frag.fontSizePx) * 0.48)
      if (Math.abs(frag.y - refFrag.y) <= tol) {
        lastGroup.push(frag)
      } else {
        lineGroups.push([frag])
      }
    }

    let prevLineY: number | null = null
    for (let gIdx = 0; gIdx < lineGroups.length; gIdx++) {
      const group = lineGroups[gIdx]
      group.sort((a, b) => a.x - b.x)

      // Determine dominant baseline font size of this visual line
      const charSizes: number[] = []
      for (const f of group) {
        const len = f.plainText.trim().length
        for (let k = 0; k < Math.min(len, 20); k++) charSizes.push(f.fontSizePx)
      }
      const lineFontPx = getMedian(charSizes) || group[0].fontSizePx
      const lineY = getMedian(group.map((f) => f.y))

      // Combine fragments on the visual line
      const lineRuns: InlineRun[] = []
      const tabRunGroups: InlineRun[][] = [[]]
      let hasTabs = false

      for (let i = 0; i < group.length; i++) {
        const curr = group[i]
        // Detect superscript/subscript shifted relative to line baseline
        let fragRuns = curr.runs
        if (curr.fontSizePx < lineFontPx * 0.82 && curr.plainText.trim().length <= 12) {
          const dy = curr.y - lineY
          const shiftTol = unit === '%' ? 0.12 : lineFontPx * 0.1
          if (dy < -shiftTol) {
            fragRuns = fragRuns.map((r) => ({ ...r, state: { ...r.state, sup: true } }))
          } else if (dy > shiftTol) {
            fragRuns = fragRuns.map((r) => ({ ...r, state: { ...r.state, sub: true } }))
          }
        }

        if (i > 0) {
          const prev = group[i - 1]
          const estimateSpanUnits = (txt: string): number => {
            let units = 0
            for (const ch of txt) {
              if (/[.,;:!'|iljtI()\[\]\s]/.test(ch)) units += 0.28
              else if (/[WM@#%&m]/.test(ch)) units += 0.72
              else units += 0.5
            }
            return units
          }
          const unitEmPx = unit === '%' ? Math.max(0.7, (lineFontPx / 820) * 100) : lineFontPx
          const charWidthEst = unitEmPx * 0.48
          const prevEndX = prev.x + estimateSpanUnits(prev.plainText) * unitEmPx
          const gap = curr.x - prevEndX

          const prevEndsSpace = /\s$/.test(prev.plainText)
          const currStartsSpace = /^\s/.test(curr.plainText)
          const currStartsClosingPunct = /^[,.;:?!»”’)\]]/.test(curr.plainText.trim())
          const prevEndsOpening = /[«“‘(\[¿¡]$/.test(prev.plainText.trim())

          const tabThreshold = unit === '%' ? charWidthEst * 5.5 : lineFontPx * 2.4
          const spaceThreshold = unit === '%' ? charWidthEst * 0.22 : lineFontPx * 0.12

          if (gap > tabThreshold && prev.plainText.trim() && curr.plainText.trim()) {
            hasTabs = true
            tabRunGroups.push([])
            lineRuns.push({ text: ' ', state: DEFAULT_FORMATTING_STATE })
          } else if (!prevEndsSpace && !currStartsSpace && !currStartsClosingPunct && !prevEndsOpening && gap > spaceThreshold) {
            lineRuns.push({ text: ' ', state: DEFAULT_FORMATTING_STATE })
          }
        }

        lineRuns.push(...fragRuns)
        tabRunGroups[tabRunGroups.length - 1].push(...fragRuns)
      }

      const lineHtml = renderInlineRuns(lineRuns, true)
      const lineText = stripHtml(lineHtml).trim()
      if (!lineText) continue

      // Filter explicit page footers/headers like "Página 2 de 5"
      if (isIsolatedPageNumber(lineText)) continue
      // Filter bare integer page numbers sitting alone at top/bottom edge of page
      if (
        (gIdx === 0 || gIdx === lineGroups.length - 1) &&
        /^\d{1,3}$/.test(lineText)
      ) {
        continue
      }

      const firstFrag = group[0]
      const lastFrag = group[group.length - 1]
      const charWidthEst = unit === '%' ? Math.max(0.35, (lineFontPx / 820) * 100 * 0.48) : lineFontPx * 0.48
      const xMaxEst = lastFrag.x + lastFrag.plainText.trimEnd().length * charWidthEst

      const tabCells = hasTabs
        ? tabRunGroups.map((grp) => stripHtml(renderInlineRuns(grp, true)).trim()).filter(Boolean)
        : null
      const tabHtmlCells = hasTabs
        ? tabRunGroups.map((grp) => renderInlineRuns(grp, true)).filter(Boolean)
        : null

      const gapFromPrevY = prevLineY !== null ? lineY - prevLineY : 0

      allVisualLines.push({
        y: lineY,
        xMin: firstFrag.x,
        xMaxEst,
        fontSizePx: lineFontPx,
        html: lineHtml,
        text: lineText,
        isAllBold: group.every((f) => f.isAllBold),
        tabCells: tabCells && tabCells.length >= 2 ? tabCells : null,
        tabHtmlCells: tabHtmlCells && tabHtmlCells.length >= 2 ? tabHtmlCells : null,
        gapFromPrevY,
        isPageBreak: prevSegmentHadLines && gIdx === 0
      })

      prevLineY = lineY
    }
    if (lineGroups.length > 0) prevSegmentHadLines = true
  }

  if (allVisualLines.length === 0) return ''

  // Compute global document font & spacing geometry
  const fontSample: number[] = []
  const positiveStepYs: number[] = []
  const leftMargins: number[] = []
  const rightEdges: number[] = []
  const textWidths: number[] = []

  for (const vl of allVisualLines) {
    const sampleCount = Math.min(30, vl.text.length)
    for (let k = 0; k < sampleCount; k++) fontSample.push(vl.fontSizePx)
    if (vl.gapFromPrevY > 0 && !vl.isPageBreak) {
      positiveStepYs.push(vl.gapFromPrevY)
    }
    if (vl.text.length >= 18) {
      leftMargins.push(vl.xMin)
      rightEdges.push(vl.xMaxEst)
    }
    if (vl.text.length >= 30) {
      textWidths.push(vl.text.length)
    }
  }

  const bodyFontPx = getMedian(fontSample) || 12
  // Median normal line step (filter out giant gaps when finding baseline line spacing)
  const smallSteps = positiveStepYs.filter((d) => d <= (getMedian(positiveStepYs) || d) * 1.8)
  const medianLineStep = getMedian(smallSteps.length > 0 ? smallSteps : positiveStepYs) || 0
  const baseLeft = getPercentile(leftMargins, 0.15)
  const maxRight = getPercentile(rightEdges, 0.9)
  const typicalLineWidth = textWidths.length > 0 ? getPercentile(textWidths, 0.78) : 72
  const unitIsPercent = fragments[0].unit === '%'
  const indentThreshold = unitIsPercent ? 1.8 : bodyFontPx * 0.9
  const pageSpan = Math.max(1, maxRight - baseLeft)

  const detectLineAlignment = (vl: VisualLine): 'center' | 'right' | null => {
    if (pageSpan <= 0 || vl.text.length > typicalLineWidth * 0.85) return null
    const lineCenter = (vl.xMin + vl.xMaxEst) / 2
    const pageCenter = (baseLeft + maxRight) / 2
    const centerTol = unitIsPercent ? 4 : bodyFontPx * 2.2
    if (vl.xMin - baseLeft > indentThreshold * 1.5 && Math.abs(lineCenter - pageCenter) <= centerTol && vl.xMaxEst < maxRight - indentThreshold) {
      return 'center'
    }
    if (vl.xMin - baseLeft > pageSpan * 0.48 && Math.abs(vl.xMaxEst - maxRight) <= centerTol * 1.5) {
      return 'right'
    }
    return null
  }

  // Reconstruct semantic HTML blocks
  const blocks: string[] = []
  let paraLines: { html: string; text: string; align: 'center' | 'right' | null; indentLevels: number; textIndent: boolean }[] = []
  let listStack: { type: 'ul' | 'ol'; start: number; olType?: string; indentX: number; items: string[] }[] = []
  let tableRows: string[][] = []

  const flushTable = () => {
    if (tableRows.length === 0) return
    blocks.push(buildHtmlTable(tableRows, true))
    tableRows = []
  }

  const flushLists = (targetIndentX = -Infinity) => {
    while (listStack.length > 0 && listStack[listStack.length - 1].indentX >= targetIndentX) {
      const closed = listStack.pop()!
      const tag = closed.type
      const attrs =
        tag === 'ol'
          ? `${closed.start !== 1 ? ` start="${closed.start}"` : ''}${closed.olType && closed.olType !== '1' ? ` type="${closed.olType}"` : ''}`
          : ''
      const listHtml = `<${tag}${attrs}>${closed.items.map((it) => `<li>${it}</li>`).join('')}</${tag}>`
      if (listStack.length > 0) {
        const parent = listStack[listStack.length - 1]
        if (parent.items.length > 0) {
          parent.items[parent.items.length - 1] += listHtml
        } else {
          parent.items.push(listHtml)
        }
      } else {
        blocks.push(listHtml)
      }
    }
  }

  const flushPara = () => {
    if (paraLines.length === 0) return
    let joinedHtml = ''
    for (let idx = 0; idx < paraLines.length; idx++) {
      const item = paraLines[idx]
      if (idx === 0) {
        joinedHtml = item.html
      } else {
        const prevText = paraLines[idx - 1].text
        const hyphenJoin =
          /[\p{L}]{1,}[-\u00AD\u2010\u2011\u2012\u2013\u2212\uFE63\uFF0D]$/u.test(prevText) &&
          /^[\p{L}]{1,}/u.test(item.text)
        joinedHtml = joinHtmlLines(joinedHtml, item.html, hyphenJoin)
      }
    }
    joinedHtml = normalizeSpacingInHtmlText(joinedHtml)
    joinedHtml = linkifyEscapedText(joinedHtml)
    const plain = stripHtml(joinedHtml).trim()
    const first = paraLines[0]

    const styleAttr = formatBlockAlignmentAndIndentStyle({
      align: first.align,
      indentLevels: first.indentLevels,
      textIndent: first.textIndent
    })

    if (isStandaloneHeader(plain) && paraLines.length === 1) {
      blocks.push(`<h3${styleAttr}>${joinedHtml}</h3>`)
    } else {
      blocks.push(`<p${styleAttr}>${joinedHtml}</p>`)
    }
    paraLines = []
  }

  const flushAll = () => {
    flushPara()
    flushLists(-Infinity)
    flushTable()
  }

  for (let i = 0; i < allVisualLines.length; i++) {
    const vl = allVisualLines[i]
    const nextVl = i + 1 < allVisualLines.length ? allVisualLines[i + 1] : null

    // Check for large vertical gaps (blank lines in original PDF)
    const isLargeGap = medianLineStep > 0 && vl.gapFromPrevY > medianLineStep * 1.42 && !vl.isPageBreak
    const isExtraSpacerGap = medianLineStep > 0 && vl.gapFromPrevY > medianLineStep * 2.35 && !vl.isPageBreak

    if (isExtraSpacerGap && (paraLines.length > 0 || blocks.length > 0)) {
      flushAll()
      blocks.push('<p></p>')
    } else if (isLargeGap) {
      flushPara()
    }

    // 1. Tabular row (multi-column gap)
    if (vl.tabHtmlCells && (tableRows.length > 0 || (nextVl && nextVl.tabHtmlCells))) {
      flushPara()
      flushLists(-Infinity)
      tableRows.push(vl.tabHtmlCells)
      continue
    } else if (tableRows.length > 0) {
      flushTable()
    }

    // 2. Heading by font-size ratio or standalone bold header
    const sizeHeading = headingTagForFontRatio(vl.fontSizePx, bodyFontPx, vl.text.length)
    const nextIsProse = nextVl ? !isStandaloneHeader(nextVl.text) && nextVl.text.length > 25 : false
    const isBoldStandaloneHeading =
      vl.isAllBold &&
      vl.text.length <= 85 &&
      !/[.;,]$/.test(vl.text) &&
      (paraLines.length === 0 || isLargeGap) &&
      (!nextVl || (medianLineStep > 0 && nextVl.gapFromPrevY > medianLineStep * 1.25) || nextIsProse || nextVl.fontSizePx < vl.fontSizePx)

    if (sizeHeading || (isBoldStandaloneHeading && isStandaloneHeader(vl.text))) {
      flushAll()
      const tag = sizeHeading || 'h3'
      const align = detectLineAlignment(vl)
      const styleAttr = formatBlockAlignmentAndIndentStyle({ align })
      blocks.push(`<${tag}${styleAttr}>${linkifyEscapedText(vl.html)}</${tag}>`)
      continue
    }

    // 3. Bullet or Ordered List item
    const bulletMatch = vl.text.match(BULLET_LINE_START_REGEX)
    const numMatch = vl.text.match(/^(\d{1,3})([\.\)])\s+(.*)$/)
    const alphaMatch = vl.text.match(/^([a-z])([\.\)])\s+(.*)$/)

    const looksLikeSectionHeadingNum =
      numMatch &&
      vl.text.length <= 85 &&
      !/[.;]$/.test(vl.text) &&
      nextVl &&
      !/^(\d{1,3}|[a-z])[\.\)]\s+/.test(nextVl.text) &&
      (vl.isAllBold || nextVl.text.length > 40)

    if (bulletMatch || (numMatch && !looksLikeSectionHeadingNum) || (alphaMatch && (listStack.length > 0 || (nextVl && /^[a-z][\.\)]\s+/.test(nextVl.text))))) {
      flushPara()
      flushTable()

      const type: 'ul' | 'ol' = bulletMatch ? 'ul' : 'ol'
      const start = numMatch ? parseInt(numMatch[1], 10) : 1
      const olType = alphaMatch ? 'a' : '1'
      const itemHtml = bulletMatch
        ? stripLeadingMarkerFromHtml(vl.html, new RegExp(`^[${LIST_BULLET_CHARS}-]\\s+`))
        : stripLeadingMarkerFromHtml(vl.html, /^(?:\d{1,3}|[a-z])[\.\)]\s+/)

      // Adjust stack based on xMin indentation
      const indentTol = unitIsPercent ? 1.2 : bodyFontPx * 0.7
      if (listStack.length === 0) {
        listStack.push({ type, start, olType, indentX: vl.xMin, items: [linkifyEscapedText(itemHtml)] })
      } else {
        const top = listStack[listStack.length - 1]
        if (vl.xMin > top.indentX + indentTol) {
          listStack.push({ type, start, olType, indentX: vl.xMin, items: [linkifyEscapedText(itemHtml)] })
        } else {
          while (listStack.length > 1 && vl.xMin < listStack[listStack.length - 1].indentX - indentTol) {
            flushLists(listStack[listStack.length - 1].indentX)
          }
          const currTop = listStack[listStack.length - 1]
          if (currTop.type !== type || (type === 'ol' && currTop.olType !== olType)) {
            flushLists(currTop.indentX)
            listStack.push({ type, start, olType, indentX: vl.xMin, items: [linkifyEscapedText(itemHtml)] })
          } else {
            currTop.items.push(linkifyEscapedText(itemHtml))
          }
        }
      }
      continue
    }

    // 4. Multi-line continuation inside an active list item!
    if (listStack.length > 0 && !isLargeGap && !isStandaloneHeader(vl.text)) {
      const top = listStack[listStack.length - 1]
      const indentTol = unitIsPercent ? 0.5 : bodyFontPx * 0.35
      if (vl.xMin >= top.indentX - indentTol && top.items.length > 0) {
        const lastIdx = top.items.length - 1
        const prevItemText = stripHtml(top.items[lastIdx]).trim()
        const hyphenJoin =
          /[\p{L}]{1,}[-\u00AD\u2010\u2011\u2012\u2013\u2212\uFE63\uFF0D]$/u.test(prevItemText) &&
          /^[\p{L}]{1,}/u.test(vl.text)
        if (hyphenJoin || isLineContinuation(prevItemText, vl.text, typicalLineWidth)) {
          top.items[lastIdx] = normalizeSpacingInHtmlText(
            joinHtmlLines(top.items[lastIdx], linkifyEscapedText(vl.html), hyphenJoin)
          )
          continue
        }
      }
      flushLists(-Infinity)
    }

    // 5. Paragraph accumulation
    const align = detectLineAlignment(vl)
    const rawOffset = Math.max(0, vl.xMin - baseLeft)
    const hasIndent = !align && rawOffset > indentThreshold
    const indentLevels = hasIndent && nextVl && nextVl.xMin - baseLeft > indentThreshold ? Math.round(rawOffset / (unitIsPercent ? 3 : bodyFontPx * 1.5)) : 0
    const textIndent = hasIndent && indentLevels === 0

    if (paraLines.length > 0) {
      const prevLine = paraLines[paraLines.length - 1]
      const hyphenJoin =
        /[\p{L}]{1,}[-\u00AD\u2010\u2011\u2012\u2013\u2212\uFE63\uFF0D]$/u.test(prevLine.text) &&
        /^[\p{L}]{1,}/u.test(vl.text)

      const sameAlignment = prevLine.align === align
      const startsNewIndentedPara = textIndent && !prevLine.textIndent && paraLines.length > 0
      const canContinue =
        !isLargeGap &&
        sameAlignment &&
        !startsNewIndentedPara &&
        (hyphenJoin || isLineContinuation(prevLine.text, vl.text, typicalLineWidth))

      if (canContinue) {
        paraLines.push({ html: vl.html, text: vl.text, align, indentLevels: prevLine.indentLevels, textIndent: prevLine.textIndent })
      } else {
        flushPara()
        paraLines.push({ html: vl.html, text: vl.text, align, indentLevels, textIndent })
      }
    } else {
      paraLines.push({ html: vl.html, text: vl.text, align, indentLevels, textIndent })
    }
  }

  flushAll()
  return sanitizeHtmlContent(blocks.join(''))
}

/**
 * Cleans an HTML <table> element while preserving colspan, rowspan, headers, and cell formatting.
 */
function cleanHtmlTableElement(tableEl: HTMLElement): string {
  const rows = Array.from(tableEl.querySelectorAll('tr'))
  if (rows.length === 0) return ''

  let html = '<table>'
  let inHead = false
  let inBody = false

  for (let rIdx = 0; rIdx < rows.length; rIdx++) {
    const tr = rows[rIdx]
    const cells = Array.from(tr.children).filter((c) => {
      const t = c.tagName.toLowerCase()
      return t === 'th' || t === 'td'
    }) as HTMLElement[]
    if (cells.length === 0) continue

    const isHeaderRow =
      tr.parentElement?.tagName.toLowerCase() === 'thead' ||
      (rIdx === 0 && cells.every((c) => c.tagName.toLowerCase() === 'th'))

    if (isHeaderRow && !inHead) {
      html += '<thead>'
      inHead = true
    } else if (!isHeaderRow && !inBody) {
      if (inHead) {
        html += '</thead>'
        inHead = false
      }
      html += '<tbody>'
      inBody = true
    }

    html += '<tr>'
    for (const cell of cells) {
      const tag = cell.tagName.toLowerCase() === 'th' || isHeaderRow ? 'th' : 'td'
      const colspan = cell.getAttribute('colspan')
      const rowspan = cell.getAttribute('rowspan')
      let attrs = ''
      if (colspan && /^\d+$/.test(colspan) && colspan !== '1') attrs += ` colspan="${colspan}"`
      if (rowspan && /^\d+$/.test(rowspan) && rowspan !== '1') attrs += ` rowspan="${rowspan}"`

      const runs = collectInlineRuns(cell, DEFAULT_FORMATTING_STATE)
      const inner = linkifyEscapedText(renderInlineRuns(runs, true))
      html += `<${tag}${attrs}>${inner || ''}</${tag}>`
    }
    html += '</tr>'
  }

  if (inHead) html += '</thead>'
  if (inBody) html += '</tbody>'
  html += '</table>'
  return html
}

/**
 * Cleans an HTML <ul> or <ol> element recursively, preserving nested lists, start/type attributes,
 * and stripping duplicate literal bullet characters emitted by Acrobat/Word PDF exporters.
 */
function cleanHtmlListElement(listEl: HTMLElement): string {
  const tag = listEl.tagName.toLowerCase() === 'ol' ? 'ol' : 'ul'
  const decls = parseCssDeclarationBlock(listEl.getAttribute('style') || '')

  // Detect task lists
  const dataType = listEl.getAttribute('data-type')
  if (dataType === 'taskList') {
    const items = Array.from(listEl.children).filter((c) => c.tagName.toLowerCase() === 'li')
    const itemsHtml = items
      .map((li) => {
        const checked = li.getAttribute('data-checked') === 'true' ? 'true' : 'false'
        const inner = renderListItemInner(li as HTMLElement, 'ul')
        return `<li data-type="taskItem" data-checked="${checked}">${inner}</li>`
      })
      .join('')
    return itemsHtml ? `<ul data-type="taskList">${itemsHtml}</ul>` : ''
  }

  let attrs = ''
  if (tag === 'ol') {
    const start = listEl.getAttribute('start')
    if (start && /^\d+$/.test(start) && start !== '1') {
      attrs += ` start="${start}"`
    }
    let olType = listEl.getAttribute('type')
    if (!olType && decls['list-style-type']) {
      const lst = decls['list-style-type'].toLowerCase()
      if (lst === 'lower-alpha' || lst === 'lower-latin') olType = 'a'
      else if (lst === 'upper-alpha' || lst === 'upper-latin') olType = 'A'
      else if (lst === 'lower-roman') olType = 'i'
      else if (lst === 'upper-roman') olType = 'I'
    }
    if (olType && /^[aAiI]$/.test(olType)) {
      attrs += ` type="${olType}"`
    }
  }

  const listItems = Array.from(listEl.children).filter((c) => c.tagName.toLowerCase() === 'li')
  if (listItems.length === 0) return ''

  const renderedItems = listItems
    .map((li) => `<li>${renderListItemInner(li as HTMLElement, tag)}</li>`)
    .join('')

  return `<${tag}${attrs}>${renderedItems}</${tag}>`
}

function renderListItemInner(li: HTMLElement, parentTag: 'ul' | 'ol'): string {
  const inlineParts: string[] = []
  const nestedLists: string[] = []

  for (const child of Array.from(li.childNodes)) {
    if (child.nodeType === Node.ELEMENT_NODE) {
      const el = child as HTMLElement
      const cTag = el.tagName.toLowerCase()
      if (cTag === 'ul' || cTag === 'ol') {
        const sub = cleanHtmlListElement(el)
        if (sub) nestedLists.push(sub)
        continue
      }
      if (cTag === 'p' || cTag === 'div') {
        const runs = collectInlineRuns(el, DEFAULT_FORMATTING_STATE)
        const rendered = renderInlineRuns(runs, true)
        if (rendered) inlineParts.push(rendered)
        continue
      }
    }
    const runs = collectInlineRuns(child, DEFAULT_FORMATTING_STATE)
    const rendered = renderInlineRuns(runs, true)
    if (rendered) inlineParts.push(rendered)
  }

  let textHtml = inlineParts.join(' ').trim()
  if (parentTag === 'ul') {
    textHtml = stripLeadingMarkerFromHtml(textHtml, new RegExp(`^[${LIST_BULLET_CHARS}-]\\s+`))
  }
  textHtml = linkifyEscapedText(textHtml)
  return `${textHtml}${nestedLists.join('')}`
}

interface FlowLineItem {
  kind: 'block-html' | 'line' | 'spacer'
  html: string
  text: string
  fontSizePx: number
  isAllBold: boolean
  align: string | null
  indentLevels: number
  textIndent: boolean
  hasExplicitMargin: boolean
}

/**
 * Processes flow-based PDF HTML (Adobe Acrobat, Apple Preview, Edge/Word PDF, pdftohtml)
 * preserving headings, nested lists, tables, blockquotes, colors, alignment, indentation,
 * vertical spacing, and unwrapping visual lines cleanly.
 */
function processFlowPdfHtml(doc: Document): string {
  // Estimate dominant body font size (counting both styled runs and unstyled default ~14px body blocks)
  const fontSample: number[] = []
  const styledEls = Array.from(doc.body.querySelectorAll('[style]'))
  for (const el of styledEls) {
    const decls = parseCssDeclarationBlock(el.getAttribute('style') || '')
    const fs = parseCssLengthPx(decls['font-size'])
    if (fs && fs > 5 && fs < 80) {
      const len = Math.min(25, (el.textContent || '').trim().length)
      for (let k = 0; k < len; k++) fontSample.push(fs)
    }
  }
  const plainBodyBlocks = Array.from(doc.body.querySelectorAll('p, li'))
  for (const el of plainBodyBlocks) {
    const decls = parseCssDeclarationBlock(el.getAttribute('style') || '')
    if (!decls['font-size'] && !el.querySelector('[style*="font-size"]')) {
      const len = Math.min(25, (el.textContent || '').trim().length)
      for (let k = 0; k < len; k++) fontSample.push(14)
    }
  }
  const bodyFontPx = getMedian(fontSample) || 14

  const items: FlowLineItem[] = []
  let inlineBuffer: Node[] = []

  const flushInlineBuffer = () => {
    if (inlineBuffer.length === 0) return
    // Split on <br> inside inlineBuffer
    let chunkRuns: InlineRun[] = []
    for (const node of inlineBuffer) {
      if (node.nodeType === Node.ELEMENT_NODE && (node as HTMLElement).tagName.toLowerCase() === 'br') {
        const rendered = renderInlineRuns(chunkRuns, true)
        const text = stripHtml(rendered).trim()
        if (text) {
          items.push({
            kind: 'line',
            html: rendered,
            text,
            fontSizePx: bodyFontPx,
            isAllBold: chunkRuns.filter((r) => r.text.trim()).every((r) => r.state.bold),
            align: null,
            indentLevels: 0,
            textIndent: false,
            hasExplicitMargin: false
          })
        } else {
          items.push({
            kind: 'spacer',
            html: '',
            text: '',
            fontSizePx: bodyFontPx,
            isAllBold: false,
            align: null,
            indentLevels: 0,
            textIndent: false,
            hasExplicitMargin: false
          })
        }
        chunkRuns = []
      } else {
        chunkRuns.push(...collectInlineRuns(node, DEFAULT_FORMATTING_STATE))
      }
    }
    const rendered = renderInlineRuns(chunkRuns, true)
    const text = stripHtml(rendered).trim()
    if (text) {
      items.push({
        kind: 'line',
        html: rendered,
        text,
        fontSizePx: bodyFontPx,
        isAllBold: chunkRuns.filter((r) => r.text.trim()).every((r) => r.state.bold),
        align: null,
        indentLevels: 0,
        textIndent: false,
        hasExplicitMargin: false
      })
    }
    inlineBuffer = []
  }

  const blockContainerTags = new Set(['div', 'section', 'article', 'main', 'header', 'footer', 'aside', 'body'])

  const walkNode = (node: Node) => {
    if (node.nodeType === Node.TEXT_NODE) {
      if ((node.textContent || '').trim() || inlineBuffer.length > 0) {
        inlineBuffer.push(node)
      }
      return
    }
    if (node.nodeType !== Node.ELEMENT_NODE) return

    const el = node as HTMLElement
    const tag = el.tagName.toLowerCase()
    if (tag === 'script' || tag === 'style' || tag === 'meta' || tag === 'link' || tag === 'noscript') {
      return
    }

    if (tag === 'hr') {
      flushInlineBuffer()
      items.push({ kind: 'block-html', html: '<hr />', text: '', fontSizePx: bodyFontPx, isAllBold: false, align: null, indentLevels: 0, textIndent: false, hasExplicitMargin: true })
      return
    }

    if (tag === 'table') {
      flushInlineBuffer()
      const tableHtml = cleanHtmlTableElement(el)
      if (tableHtml) {
        items.push({ kind: 'block-html', html: tableHtml, text: '', fontSizePx: bodyFontPx, isAllBold: false, align: null, indentLevels: 0, textIndent: false, hasExplicitMargin: true })
      }
      return
    }

    if (tag === 'ul' || tag === 'ol') {
      flushInlineBuffer()
      const listHtml = cleanHtmlListElement(el)
      if (listHtml) {
        items.push({ kind: 'block-html', html: listHtml, text: '', fontSizePx: bodyFontPx, isAllBold: false, align: null, indentLevels: 0, textIndent: false, hasExplicitMargin: true })
      }
      return
    }

    if (tag === 'pre') {
      flushInlineBuffer()
      const codeText = normalizePdfCharacters(el.textContent || '', true).trimEnd()
      if (codeText.trim()) {
        items.push({
          kind: 'block-html',
          html: `<pre><code>${escapeHtml(codeText)}</code></pre>`,
          text: codeText,
          fontSizePx: bodyFontPx,
          isAllBold: false,
          align: null,
          indentLevels: 0,
          textIndent: false,
          hasExplicitMargin: true
        })
      }
      return
    }

    if (tag === 'blockquote') {
      flushInlineBuffer()
      const runs = collectInlineRuns(el, DEFAULT_FORMATTING_STATE)
      const inner = linkifyEscapedText(renderInlineRuns(runs, true))
      if (stripHtml(inner).trim()) {
        const decls = parseCssDeclarationBlock(el.getAttribute('style') || '')
        const styleAttr = formatBlockAlignmentAndIndentStyle({ align: decls['text-align'] || null })
        items.push({
          kind: 'block-html',
          html: `<blockquote${styleAttr}>${inner}</blockquote>`,
          text: stripHtml(inner).trim(),
          fontSizePx: bodyFontPx,
          isAllBold: false,
          align: decls['text-align'] || null,
          indentLevels: 0,
          textIndent: false,
          hasExplicitMargin: true
        })
      }
      return
    }

    if (/^h[1-6]$/.test(tag)) {
      flushInlineBuffer()
      const runs = collectInlineRuns(el, DEFAULT_FORMATTING_STATE)
      const inner = linkifyEscapedText(renderInlineRuns(runs, true))
      const text = stripHtml(inner).trim()
      if (text) {
        const decls = parseCssDeclarationBlock(el.getAttribute('style') || '')
        const align = decls['text-align'] || el.getAttribute('align') || null
        const styleAttr = formatBlockAlignmentAndIndentStyle({
          align,
          indentLevels: computeIndentLevelFromCss(el.getAttribute('style') || '')
        })
        items.push({
          kind: 'block-html',
          html: `<${tag}${styleAttr}>${inner}</${tag}>`,
          text,
          fontSizePx: bodyFontPx,
          isAllBold: true,
          align,
          indentLevels: 0,
          textIndent: false,
          hasExplicitMargin: true
        })
      }
      return
    }

    if (tag === 'center') {
      flushInlineBuffer()
      const centerState = computeElementFormatting(el, DEFAULT_FORMATTING_STATE)
      const runs = collectInlineRuns(el, centerState)
      const inner = renderInlineRuns(runs, true)
      const text = stripHtml(inner).trim()
      if (text) {
        items.push({
          kind: 'line',
          html: inner,
          text,
          fontSizePx: bodyFontPx,
          isAllBold: runs.filter((r) => r.text.trim()).every((r) => r.state.bold),
          align: 'center',
          indentLevels: 0,
          textIndent: false,
          hasExplicitMargin: true
        })
      }
      return
    }

    const hasBlockChild = Array.from(el.children).some((c) => {
      const ct = c.tagName.toLowerCase()
      return (
        blockContainerTags.has(ct) ||
        ct === 'p' ||
        ct === 'ul' ||
        ct === 'ol' ||
        ct === 'table' ||
        ct === 'blockquote' ||
        ct === 'pre' ||
        ct === 'hr' ||
        /^h[1-6]$/.test(ct)
      )
    })

    if (blockContainerTags.has(tag) && hasBlockChild) {
      flushInlineBuffer()
      for (const child of Array.from(el.childNodes)) {
        walkNode(child)
      }
      flushInlineBuffer()
      return
    }

    if (tag === 'p' || blockContainerTags.has(tag)) {
      flushInlineBuffer()
      const styleText = el.getAttribute('style') || ''
      const decls = parseCssDeclarationBlock(styleText)
      const mb = parseCssLengthPx(decls['margin-bottom']) ?? 0
      const mt = parseCssLengthPx(decls['margin-top']) ?? 0
      const hasExplicitMargin = mb >= 5 || mt >= 5

      // Check if this block splits lines internally with <br>
      const blockState = computeElementFormatting(el, DEFAULT_FORMATTING_STATE)
      const rawChildren = Array.from(el.childNodes)
      let currentRuns: InlineRun[] = []
      const subChunks: InlineRun[][] = []
      for (const ch of rawChildren) {
        if (ch.nodeType === Node.ELEMENT_NODE && (ch as HTMLElement).tagName.toLowerCase() === 'br') {
          subChunks.push(currentRuns)
          currentRuns = []
        } else {
          currentRuns.push(...collectInlineRuns(ch, blockState))
        }
      }
      subChunks.push(currentRuns)

      const align = decls['text-align'] || el.getAttribute('align') || null
      const indentLevels = computeIndentLevelFromCss(styleText)
      const textIndent = hasCssFirstLineIndent(styleText)
      const elFontPx = parseCssLengthPx(decls['font-size'])

      if (subChunks.length === 1 && !stripHtml(renderInlineRuns(subChunks[0], true)).trim()) {
        // Explicit empty spacer block (`<p>&nbsp;</p>`, `<p><br></p>`)
        items.push({
          kind: 'spacer',
          html: '',
          text: '',
          fontSizePx: bodyFontPx,
          isAllBold: false,
          align: null,
          indentLevels: 0,
          textIndent: false,
          hasExplicitMargin: true
        })
        return
      }

      for (let sIdx = 0; sIdx < subChunks.length; sIdx++) {
        const runs = subChunks[sIdx]
        const rendered = renderInlineRuns(runs, true)
        const text = stripHtml(rendered).trim()
        if (!text) {
          if (sIdx > 0) {
            items.push({
              kind: 'spacer',
              html: '',
              text: '',
              fontSizePx: bodyFontPx,
              isAllBold: false,
              align: null,
              indentLevels: 0,
              textIndent: false,
              hasExplicitMargin: false
            })
          }
          continue
        }

        if (isIsolatedPageNumber(text)) continue

        // Find dominant font size from child styled spans if element itself didn't declare one
        let dominantFontPx = elFontPx ?? bodyFontPx
        if (!elFontPx) {
          const innerStyled = Array.from(el.querySelectorAll('[style*="font-size"]'))
          if (innerStyled.length > 0) {
            const firstFs = parseCssLengthPx(parseCssDeclarationBlock(innerStyled[0].getAttribute('style') || '')['font-size'])
            if (firstFs && (innerStyled[0].textContent || '').trim().length >= text.length * 0.6) {
              dominantFontPx = firstFs
            }
          }
        }

        const nonEmptyRuns = runs.filter((r) => r.text.trim().length > 0)
        const isAllBold = nonEmptyRuns.length > 0 && nonEmptyRuns.every((r) => r.state.bold)

        items.push({
          kind: 'line',
          html: rendered,
          text,
          fontSizePx: dominantFontPx,
          isAllBold,
          align,
          indentLevels,
          textIndent: sIdx === 0 ? textIndent : false,
          hasExplicitMargin: sIdx === subChunks.length - 1 ? hasExplicitMargin : false
        })
      }
      return
    }

    // Any other inline node (span, strong, em, a, b, i, u, font, mark, etc.)
    inlineBuffer.push(node)
  }

  for (const child of Array.from(doc.body.childNodes)) {
    walkNode(child)
  }
  flushInlineBuffer()

  if (items.length === 0) return ''

  // Determine whether flow lines are ALREADY full paragraphs (e.g. Word/Acrobat `<p style="margin-bottom: 10pt">`)
  // vs unwrapped visual line slices (`margin: 0`, short lines ending mid-sentence)
  const lineItems = items.filter((it) => it.kind === 'line')
  const explicitMarginCount = lineItems.filter((it) => it.hasExplicitMargin).length
  const lineLengths = lineItems.map((it) => it.text.length)
  const medianLineLen = getMedian(lineLengths)
  const typicalLineWidth = lineLengths.length > 0 ? Math.max(55, getPercentile(lineLengths, 0.78)) : 72
  const blocksAreAlreadyParagraphs =
    (lineItems.length > 0 && explicitMarginCount / lineItems.length >= 0.55) ||
    medianLineLen >= 135

  const outBlocks: string[] = []
  let paraLines: FlowLineItem[] = []
  let currentList: { type: 'ul' | 'ol'; start: number; olType?: string; items: string[] } | null = null
  let consecutiveSpacers = 0

  const flushList = () => {
    if (!currentList) return
    const tag = currentList.type
    const attrs =
      tag === 'ol'
        ? `${currentList.start !== 1 ? ` start="${currentList.start}"` : ''}${currentList.olType && currentList.olType !== '1' ? ` type="${currentList.olType}"` : ''}`
        : ''
    outBlocks.push(`<${tag}${attrs}>${currentList.items.map((it) => `<li>${it}</li>`).join('')}</${tag}>`)
    currentList = null
  }

  const flushPara = () => {
    if (paraLines.length === 0) return
    let joinedHtml = ''
    for (let idx = 0; idx < paraLines.length; idx++) {
      const it = paraLines[idx]
      if (idx === 0) {
        joinedHtml = it.html
      } else {
        const prevText = paraLines[idx - 1].text
        const hyphenJoin =
          /[\p{L}]{1,}[-\u00AD\u2010\u2011\u2012\u2013\u2212\uFE63\uFF0D]$/u.test(prevText) &&
          /^[\p{L}]{1,}/u.test(it.text)
        joinedHtml = joinHtmlLines(joinedHtml, it.html, hyphenJoin)
      }
    }
    joinedHtml = normalizeSpacingInHtmlText(joinedHtml)
    joinedHtml = linkifyEscapedText(joinedHtml)
    const plain = stripHtml(joinedHtml).trim()
    const first = paraLines[0]

    const sizeTag = paraLines.length === 1 ? headingTagForFontRatio(first.fontSizePx, bodyFontPx, plain.length) : null
    const styleAttr = formatBlockAlignmentAndIndentStyle({
      align: first.align,
      indentLevels: first.indentLevels,
      textIndent: first.textIndent
    })

    if (sizeTag) {
      outBlocks.push(`<${sizeTag}${styleAttr}>${joinedHtml}</${sizeTag}>`)
    } else if (paraLines.length === 1 && (isStandaloneHeader(plain) || (first.isAllBold && plain.length <= 75 && !/[.;,]$/.test(plain)))) {
      outBlocks.push(`<h3${styleAttr}>${joinedHtml}</h3>`)
    } else {
      outBlocks.push(`<p${styleAttr}>${joinedHtml}</p>`)
    }
    paraLines = []
  }

  for (let i = 0; i < items.length; i++) {
    const item = items[i]
    const nextItem = i + 1 < items.length ? items[i + 1] : null

    if (item.kind === 'spacer') {
      flushPara()
      flushList()
      consecutiveSpacers++
      if (outBlocks.length > 0 && consecutiveSpacers <= 2) {
        outBlocks.push('<p></p>')
      }
      continue
    }
    consecutiveSpacers = 0

    if (item.kind === 'block-html') {
      flushPara()
      flushList()
      outBlocks.push(item.html)
      continue
    }

    // Check heading by font size
    const sizeHeading = headingTagForFontRatio(item.fontSizePx, bodyFontPx, item.text.length)
    if (sizeHeading) {
      flushPara()
      flushList()
      const styleAttr = formatBlockAlignmentAndIndentStyle({ align: item.align, indentLevels: item.indentLevels })
      outBlocks.push(`<${sizeHeading}${styleAttr}>${linkifyEscapedText(item.html)}</${sizeHeading}>`)
      continue
    }

    // Check plain-text bullet/ordered list pattern inside <p> / <div>
    const bulletMatch = item.text.match(BULLET_LINE_START_REGEX)
    const numMatch = item.text.match(/^(\d{1,3})([\.\)])\s+(.*)$/)
    const looksLikeSectionNum =
      numMatch &&
      item.text.length <= 85 &&
      !/[.;]$/.test(item.text) &&
      nextItem &&
      nextItem.kind === 'line' &&
      !/^(\d{1,3}|[a-z])[\.\)]\s+/.test(nextItem.text) &&
      (item.isAllBold || nextItem.text.length > 40)

    if (bulletMatch || (numMatch && !looksLikeSectionNum)) {
      flushPara()
      const listType: 'ul' | 'ol' = bulletMatch ? 'ul' : 'ol'
      const start = numMatch ? parseInt(numMatch[1], 10) : 1
      const itemHtml = bulletMatch
        ? stripLeadingMarkerFromHtml(item.html, new RegExp(`^[${LIST_BULLET_CHARS}-]\\s+`))
        : stripLeadingMarkerFromHtml(item.html, /^\d{1,3}[\.\)]\s+/)

      if (!currentList || currentList.type !== listType) {
        flushList()
        currentList = { type: listType, start, items: [linkifyEscapedText(itemHtml)] }
      } else {
        currentList.items.push(linkifyEscapedText(itemHtml))
      }
      continue
    }

    // Multi-line continuation inside active list
    if (currentList && !blocksAreAlreadyParagraphs && !item.hasExplicitMargin && !isStandaloneHeader(item.text)) {
      const lastIdx = currentList.items.length - 1
      const prevItemText = stripHtml(currentList.items[lastIdx]).trim()
      const hyphenJoin =
        /[\p{L}]{1,}[-\u00AD\u2010\u2011\u2012\u2013\u2212\uFE63\uFF0D]$/u.test(prevItemText) &&
        /^[\p{L}]{1,}/u.test(item.text)
      if (hyphenJoin || isLineContinuation(prevItemText, item.text, typicalLineWidth)) {
        currentList.items[lastIdx] = normalizeSpacingInHtmlText(
          joinHtmlLines(currentList.items[lastIdx], linkifyEscapedText(item.html), hyphenJoin)
        )
        continue
      }
    }

    flushList()

    if (blocksAreAlreadyParagraphs) {
      flushPara()
      paraLines.push(item)
      flushPara()
      continue
    }

    if (paraLines.length > 0) {
      const prev = paraLines[paraLines.length - 1]
      const hyphenJoin =
        /[\p{L}]{1,}[-\u00AD\u2010\u2011\u2012\u2013\u2212\uFE63\uFF0D]$/u.test(prev.text) &&
        /^[\p{L}]{1,}/u.test(item.text)
      const sameAlign = prev.align === item.align
      const canContinue =
        !prev.hasExplicitMargin &&
        sameAlign &&
        !item.textIndent &&
        (hyphenJoin || isLineContinuation(prev.text, item.text, typicalLineWidth))

      if (canContinue) {
        paraLines.push(item)
      } else {
        flushPara()
        paraLines.push(item)
      }
    } else {
      paraLines.push(item)
    }
  }

  flushPara()
  flushList()

  return sanitizeHtmlContent(outBlocks.join(''))
}

/**
 * Processes PDF HTML (from Chrome, Edge, Firefox/PDF.js, pdf2htmlEX, Apple Preview, Adobe Acrobat)
 */
export function processPdfHtml(rawHtml: string, textFallback?: string): string {
  if (!rawHtml || typeof rawHtml !== 'string') {
    return processPdfPlainText(textFallback || '')
  }

  if (typeof DOMParser === 'undefined') {
    return processPdfPlainText(textFallback || rawHtml)
  }

  try {
    const parser = new DOMParser()
    const doc = parser.parseFromString(rawHtml, 'text/html')

    // 1. Resolve <style> CSS classes onto elements BEFORE removing <style>
    applyStylesheetRules(doc)

    // 2. Remove non-content elements (keep [aria-hidden] only if it carries visible text)
    doc.querySelectorAll('style, meta, link, script, noscript').forEach((el) => el.remove())
    doc.querySelectorAll('[aria-hidden="true"]').forEach((el) => {
      if (!el.textContent?.trim()) el.remove()
    })

    // 3. Prefer positioned PDF layout reconstruction when coordinates exist
    const positionedFragments = extractPositionedFragments(doc)
    if (positionedFragments) {
      const positionedHtml = processPositionedPdfFragments(positionedFragments)
      if (positionedHtml.trim()) {
        return positionedHtml
      }
    }

    // 4. Otherwise reconstruct from semantic/flow PDF HTML
    const flowHtml = processFlowPdfHtml(doc)
    if (flowHtml.trim()) {
      return flowHtml
    }

    if (textFallback && textFallback.trim()) {
      return processPdfPlainText(textFallback)
    }
    return ''
  } catch (err) {
    console.error('Error processing PDF HTML, falling back to plain text:', err)
    return processPdfPlainText(textFallback || rawHtml)
  }
}

/**
 * Builds an HTML table from parsed cells, padding ragged rows and deciding whether row 0 is a header.
 */
function buildHtmlTable(rows: string[][], cellsAlreadyHtml = false): string {
  if (rows.length === 0) return ''
  const colCount = Math.max(...rows.map((r) => r.length))
  if (colCount < 2) return ''

  const firstRow = rows[0]
  // Treat row 0 as <thead> header unless it looks like a 2-column key-value list ("Fecha: | 12/11/2026")
  const firstRowLooksKeyValue =
    colCount === 2 &&
    rows.length >= 2 &&
    rows.every((r) => /:$/.test(stripHtml(r[0] || '').trim()))

  const formatCell = (raw: string) => {
    const val = cellsAlreadyHtml
      ? normalizeSpacingInHtmlText(raw)
      : linkifyEscapedText(convertMathematicalBoldToHtml(escapeHtml(normalizeSpacingAndPunctuation(raw, true))))
    return val || ''
  }

  let html = '<table>'
  let startBodyIdx = 0

  if (!firstRowLooksKeyValue) {
    html += '<thead><tr>'
    for (let c = 0; c < colCount; c++) {
      html += `<th>${formatCell(firstRow[c] || '')}</th>`
    }
    html += '</tr></thead>'
    startBodyIdx = 1
  }

  if (startBodyIdx < rows.length) {
    html += '<tbody>'
    for (let r = startBodyIdx; r < rows.length; r++) {
      html += '<tr>'
      for (let c = 0; c < colCount; c++) {
        html += `<td>${formatCell(rows[r][c] || '')}</td>`
      }
      html += '</tr>'
    }
    html += '</tbody>'
  }

  html += '</table>'
  return html
}

interface PlainTableRowMatch {
  cells: string[]
  colStarts: number[]
  colEnds: number[]
  hasWideSpaceGap: boolean
  separatorKind: 'pipe' | 'tab' | 'spaces'
}

function areSpaceTableColumnsAligned(a: PlainTableRowMatch, b: PlainTableRowMatch): boolean {
  const sharedCols = Math.min(a.colStarts.length, b.colStarts.length)
  if (sharedCols < 2) return false
  let alignedCount = 0
  for (let c = 1; c < sharedCols; c++) {
    const startAligned = Math.abs(a.colStarts[c] - b.colStarts[c]) <= 3
    const endAligned = Math.abs(a.colEnds[c] - b.colEnds[c]) <= 3
    if (startAligned || endAligned) alignedCount++
  }
  return alignedCount === sharedCols - 1
}

/**
 * Splits a raw plain-text line into table columns ONLY when clear tabular structure exists
 * (pipes `|`, tabs `\t`, or aligned multi-space columns — never false-triggering on justified prose!).
 */
function parsePlainTableRow(rawLine: string): PlainTableRowMatch | null {
  const trimmed = rawLine.trim()
  if (!trimmed) return null

  if (/^\|.*\|$/.test(trimmed)) {
    const cells = trimmed
      .slice(1, -1)
      .split('|')
      .map((s) => s.trim())
    if (cells.length >= 2) {
      return { cells, colStarts: [], colEnds: [], hasWideSpaceGap: true, separatorKind: 'pipe' }
    }
  }

  if (trimmed.includes('\t')) {
    const cells = trimmed.split(/\t+/).map((s) => s.trim()).filter(Boolean)
    if (cells.length >= 2) {
      return { cells, colStarts: [], colEnds: [], hasWideSpaceGap: true, separatorKind: 'tab' }
    }
  }

  // Require 3+ spaces AND track exact column offsets so justified prose doesn't falsely become a table
  if (/\x20{3,}/.test(trimmed)) {
    const cells: string[] = []
    const colStarts: number[] = []
    const colEnds: number[] = []
    const leadOffset = rawLine.length - rawLine.trimStart().length
    const gapRe = /\x20{3,}/g
    let lastEnd = 0
    let m: RegExpExecArray | null
    while ((m = gapRe.exec(trimmed)) !== null) {
      const cellText = trimmed.slice(lastEnd, m.index).trim()
      if (cellText) {
        cells.push(cellText)
        colStarts.push(leadOffset + lastEnd)
        colEnds.push(leadOffset + m.index)
      }
      lastEnd = m.index + m[0].length
    }
    const tailText = trimmed.slice(lastEnd).trim()
    if (tailText) {
      cells.push(tailText)
      colStarts.push(leadOffset + lastEnd)
      colEnds.push(leadOffset + trimmed.length)
    }

    if (cells.length >= 2 && cells.every((c) => c.length <= 65)) {
      return {
        cells,
        colStarts,
        colEnds,
        hasWideSpaceGap: /\x20{4,}/.test(trimmed),
        separatorKind: 'spaces'
      }
    }
  }

  return null
}

function getLeadingIndentSpaces(rawLine: string): number {
  let count = 0
  for (const ch of rawLine) {
    if (ch === ' ') count++
    else if (ch === '\t') count += 4
    else break
  }
  return count
}

/**
 * Converts safe inline markdown markers (**bold**, *italic*, `code`) in already HTML-escaped text.
 */
function formatInlineMarkdownSafe(escapedText: string): string {
  let out = escapedText
  // Inline code first so markdown inside code isn't formatted
  out = out.replace(/`([^`\n]+)`/g, '<code>$1</code>')
  // **bold**
  out = out.replace(/\*\*([^*\n]+?)\*\*/g, '<strong>$1</strong>')
  // __bold__
  out = out.replace(/(^|\s)__([^_\n]+?)__(?=$|[\s.,;:?!])/g, '$1<strong>$2</strong>')
  // *italic* (avoid math `a * b * c` by disallowing spaces around inner text)
  out = out.replace(/(^|\s)\*([^\s*][^*\n]*?[^\s*]|\S)\*(?=$|[\s.,;:?!])/g, '$1<em>$2</em>')
  return out
}

function formatPlainTextLineToHtml(rawSegment: string): string {
  const normalized = normalizeSpacingAndPunctuation(rawSegment, true)
  const escaped = escapeHtml(normalized)
  const withMath = convertMathematicalBoldToHtml(escaped)
  const withMd = formatInlineMarkdownSafe(withMath)
  return linkifyEscapedText(withMd)
}

/**
 * Processes plain text copied from a desktop/browser PDF reader
 * (Chrome PDFium, Edge, Adobe Acrobat, Foxit, SumatraPDF, etc.).
 */
export function processPdfPlainText(rawText: string, sourceHtml?: string): string {
  if (!rawText || typeof rawText !== 'string') return ''

  // 1. Normalize line endings, page breaks, Unicode spaces, invisible chars, PUA bullets
  let normalized = normalizePdfCharacters(rawText, true).replace(/\f/g, '\n\n\n')

  // 2. Decompose typographical ligatures (ff, fi, fl, ffi, ffl, ft, st)
  normalized = normalizeLigatures(normalized)

  // 3. Fix hyphenated line breaks across lines
  normalized = fixHyphenatedLinebreaks(normalized)

  // 4. Remove explicit page-number lines (keep isolated numbers unless clearly isolated between blank lines)
  normalized = normalized.replace(
    /(?:^|\n)[ \t]*(?:Página\s+\d+(?:\s*(?:de|\/)\s*\d+)?|Pág\.?\s*\d+(?:\s*(?:de|\/)\s*\d+)?|Page\s+\d+(?:\s*(?:of|\/)\s*\d+)?|[-–—]\s*\d+\s*[-–—])[ \t]*(?=\n|$)/gi,
    '\n'
  )
  normalized = normalized.replace(/\n\n[ \t]*\d{1,3}[ \t]*\n\n/g, '\n\n')

  // Optional bold word extraction map from sourceHtml if caller explicitly passed sourceHtml
  const extraBoldPhrases = new Set<string>()
  if (sourceHtml && typeof DOMParser !== 'undefined') {
    try {
      const doc = new DOMParser().parseFromString(sourceHtml, 'text/html')
      applyStylesheetRules(doc)
      doc.querySelectorAll('strong, b, [style]').forEach((el) => {
        const st = computeElementFormatting(el, DEFAULT_FORMATTING_STATE)
        if (st.bold) {
          const t = (el.textContent || '').trim()
          if (t.length >= 3 && t.length <= 80) extraBoldPhrases.add(t)
        }
      })
    } catch {
      // Ignore parse errors
    }
  }

  const rawLines = normalized.split('\n')

  // 5. Analyze document geometry (typical line wrap width, base indent, first-line indent pattern)
  const nonEmptyTrimmedLens: number[] = []
  const indents: number[] = []
  for (const rl of rawLines) {
    const t = rl.trim()
    if (!t) continue
    if (t.length >= 25) {
      nonEmptyTrimmedLens.push(t.length)
      indents.push(getLeadingIndentSpaces(rl))
    }
  }
  const typicalLineWidth = nonEmptyTrimmedLens.length > 0 ? getPercentile(nonEmptyTrimmedLens, 0.78) : 72
  const baseIndent = indents.length > 0 ? getPercentile(indents, 0.15) : 0

  // Detect consistent first-line paragraph indentation (3-10 spaces extra indent on lines starting paragraphs)
  let firstLineIndentHits = 0
  for (let idx = 1; idx < rawLines.length; idx++) {
    const prev = rawLines[idx - 1].trim()
    const curr = rawLines[idx]
    const currT = curr.trim()
    if (!prev || !currT) continue
    const indentDiff = getLeadingIndentSpaces(curr) - baseIndent
    if (
      indentDiff >= 3 &&
      indentDiff <= 12 &&
      !BULLET_LINE_START_REGEX.test(currT) &&
      !/^\d{1,3}[\.\)]\s+/.test(currT) &&
      /[.?!»”"]$/.test(prev)
    ) {
      firstLineIndentHits++
    }
  }
  const hasFirstLineIndentPattern = firstLineIndentHits >= 1

  const htmlParts: string[] = []
  let currentPara: { text: string; indentDiff: number; centered: boolean }[] = []
  let listStack: { type: 'ul' | 'ol' | 'task'; start: number; olType?: string; indent: number; items: { text: string; checked?: boolean }[] }[] = []
  let currentTableRows: string[][] = []
  let firstTableRowMeta: PlainTableRowMatch | null = null
  let inFencedCode = false
  let fencedCodeLines: string[] = []
  let consecutiveBlankLines = 0

  // Render finalized nested lists cleanly
  const finalizeListHtml = (closed: (typeof listStack)[number]): string => {
    if (closed.type === 'task') {
      return `<ul data-type="taskList">${closed.items
        .map((it) => {
          const [txt, ...nested] = it.text.split('__NESTED_HTML__')
          return `<li data-type="taskItem" data-checked="${it.checked ? 'true' : 'false'}">${formatPlainTextLineToHtml(
            txt
          )}${nested.join('')}</li>`
        })
        .join('')}</ul>`
    }
    const tag = closed.type
    const attrs =
      tag === 'ol'
        ? `${closed.start !== 1 ? ` start="${closed.start}"` : ''}${closed.olType && closed.olType !== '1' ? ` type="${closed.olType}"` : ''}`
        : ''
    return `<${tag}${attrs}>${closed.items
      .map((it) => {
        const [txt, ...nested] = it.text.split('__NESTED_HTML__')
        return `<li>${boldLegalAndCapitalizedTerms(formatPlainTextLineToHtml(txt))}${nested.join('')}</li>`
      })
      .join('')}</${tag}>`
  }

  const closeListsToIndent = (targetIndent = -Infinity) => {
    while (listStack.length > 0 && listStack[listStack.length - 1].indent >= targetIndent) {
      const closed = listStack.pop()!
      const listHtml = finalizeListHtml(closed)
      if (listStack.length > 0) {
        const parent = listStack[listStack.length - 1]
        if (parent.items.length > 0) {
          parent.items[parent.items.length - 1].text += `__NESTED_HTML__${listHtml}`
        }
      } else {
        htmlParts.push(listHtml)
      }
    }
  }

  const flushTable = () => {
    if (currentTableRows.length === 0) return
    htmlParts.push(buildHtmlTable(currentTableRows, false))
    currentTableRows = []
    firstTableRowMeta = null
  }

  const flushParagraph = () => {
    if (currentPara.length === 0) return
    let joinedText = ''
    for (let idx = 0; idx < currentPara.length; idx++) {
      const seg = currentPara[idx].text
      if (idx === 0) {
        joinedText = seg
      } else {
        const prevSeg = currentPara[idx - 1].text
        const hyphenJoin =
          /[\p{L}]{1,}[-\u00AD\u2010\u2011\u2012\u2013\u2212\uFE63\uFF0D]$/u.test(prevSeg) &&
          /^[\p{L}]{1,}/u.test(seg)
        joinedText = hyphenJoin ? `${prevSeg.slice(0, -1)}${seg}` : `${joinedText} ${seg}`
      }
    }

    let formattedHtml = formatPlainTextLineToHtml(joinedText)
    for (const phrase of extraBoldPhrases) {
      const safe = phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      if (!formattedHtml.includes(`<strong>${escapeHtml(phrase)}</strong>`)) {
        formattedHtml = formattedHtml.replace(
          new RegExp(`(?<![<>])(${safe})(?![^<]*<\\/strong>)`, 'g'),
          '<strong>$1</strong>'
        )
      }
    }
    formattedHtml = boldLegalAndCapitalizedTerms(formattedHtml)

    const plain = stripHtml(formattedHtml).trim()
    const first = currentPara[0]
    const allIndented =
      currentPara.length >= 1 &&
      currentPara.every((p) => p.indentDiff >= 4 && !p.centered) &&
      !(hasFirstLineIndentPattern && currentPara.length > 1 && currentPara[1].indentDiff < 3)
    const indentLevels = allIndented ? Math.min(4, Math.max(1, Math.round(first.indentDiff / 4))) : 0
    const textIndent = !allIndented && hasFirstLineIndentPattern && first.indentDiff >= 3

    const styleAttr = formatBlockAlignmentAndIndentStyle({
      align: first.centered ? 'center' : null,
      indentLevels,
      textIndent
    })

    if (currentPara.length === 1 && isStandaloneHeader(plain)) {
      const tag = htmlParts.length === 0 && plain.length <= 60 ? 'h2' : 'h3'
      htmlParts.push(`<${tag}${styleAttr}>${formattedHtml}</${tag}>`)
    } else {
      htmlParts.push(`<p${styleAttr}>${formattedHtml}</p>`)
    }
    currentPara = []
  }

  const flushAll = () => {
    flushParagraph()
    closeListsToIndent(-Infinity)
    flushTable()
  }

  for (let i = 0; i < rawLines.length; i++) {
    const rawLine = rawLines[i]
    const trimmed = rawLine.trim()
    const indent = getLeadingIndentSpaces(rawLine)
    const indentDiff = Math.max(0, indent - baseIndent)

    // Fenced code blocks ```
    if (/^```/.test(trimmed)) {
      if (!inFencedCode) {
        flushAll()
        inFencedCode = true
        fencedCodeLines = []
      } else {
        htmlParts.push(`<pre><code>${escapeHtml(fencedCodeLines.join('\n'))}</code></pre>`)
        inFencedCode = false
        fencedCodeLines = []
      }
      consecutiveBlankLines = 0
      continue
    }
    if (inFencedCode) {
      fencedCodeLines.push(rawLine)
      continue
    }

    // Blank lines: preserve multi-line vertical gaps cleanly
    if (!trimmed) {
      flushAll()
      consecutiveBlankLines++
      if (htmlParts.length > 0 && (consecutiveBlankLines === 2 || consecutiveBlankLines === 4)) {
        htmlParts.push('<p></p>')
      }
      continue
    }
    const prevWasBlank = consecutiveBlankLines > 0
    consecutiveBlankLines = 0

    // Markdown horizontal rule
    if (/^(?:-{3,}|\*{3,}|_{3,})$/.test(trimmed)) {
      flushAll()
      htmlParts.push('<hr />')
      continue
    }

    // Markdown headings `# ...`
    const mdHeadingMatch = trimmed.match(/^(#{1,4})\s+(.+)$/)
    if (mdHeadingMatch) {
      flushAll()
      const level = Math.min(4, mdHeadingMatch[1].length)
      htmlParts.push(`<h${level}>${formatPlainTextLineToHtml(mdHeadingMatch[2])}</h${level}>`)
      continue
    }

    // Table detection (pipe, tab, or 3+ spaces across consecutive lines)
    const tableRow = parsePlainTableRow(rawLine)
    const nextNonEmptyLine = rawLines.slice(i + 1).find((l) => l.trim().length > 0) || ''
    const nextTableRow = parsePlainTableRow(nextNonEmptyLine)

    if (tableRow) {
      // Skip Markdown table separator lines (`|---|---|`)
      if (tableRow.separatorKind === 'pipe' && tableRow.cells.every((c) => /^:?-+:?$/.test(c))) {
        continue
      }
      const canContinueSpaceTable =
        currentTableRows.length > 0 &&
        firstTableRowMeta !== null &&
        firstTableRowMeta.separatorKind === tableRow.separatorKind &&
        (tableRow.separatorKind !== 'spaces' || areSpaceTableColumnsAligned(firstTableRowMeta, tableRow))

      const canStartTable =
        currentTableRows.length === 0 &&
        nextTableRow !== null &&
        Math.abs(nextTableRow.cells.length - tableRow.cells.length) <= 1 &&
        tableRow.separatorKind === nextTableRow.separatorKind &&
        (tableRow.separatorKind !== 'spaces' ||
          ((tableRow.hasWideSpaceGap || nextTableRow.hasWideSpaceGap) &&
            areSpaceTableColumnsAligned(tableRow, nextTableRow)))

      if (canContinueSpaceTable || canStartTable) {
        flushParagraph()
        closeListsToIndent(-Infinity)
        if (currentTableRows.length === 0) {
          firstTableRowMeta = tableRow
        }
        currentTableRows.push(tableRow.cells)
        continue
      }
    }
    if (currentTableRows.length > 0) {
      flushTable()
    }

    // Check task list items `[ ]`, `[x]`, `☐`, `☑`
    const taskMatch = trimmed.match(TASK_LINE_START_REGEX)
    if (taskMatch) {
      flushParagraph()
      flushTable()
      const checked = /x|✓|✔|☑|✅/i.test(taskMatch[1])
      if (listStack.length === 0 || listStack[listStack.length - 1].type !== 'task') {
        closeListsToIndent(-Infinity)
        listStack.push({ type: 'task', start: 1, indent, items: [{ text: taskMatch[2], checked }] })
      } else {
        listStack[listStack.length - 1].items.push({ text: taskMatch[2], checked })
      }
      continue
    }

    // Check bullet items (including indented `o  subitem` sub-bullets)
    const bulletMatch = trimmed.match(BULLET_LINE_START_REGEX)
    const hollowSubBulletMatch =
      indentDiff >= 2 || listStack.length > 0
        ? trimmed.match(/^o(?:\x20{2,}|\t+)(.+)$/) || (indentDiff >= 2 ? trimmed.match(/^o\s+(.+)$/) : null)
        : null

    if (bulletMatch || hollowSubBulletMatch) {
      flushParagraph()
      flushTable()
      const itemText = bulletMatch ? bulletMatch[2] : hollowSubBulletMatch![1]
      if (listStack.length === 0) {
        listStack.push({ type: 'ul', start: 1, indent, items: [{ text: itemText }] })
      } else {
        const top = listStack[listStack.length - 1]
        if (indent >= top.indent + 2) {
          listStack.push({ type: 'ul', start: 1, indent, items: [{ text: itemText }] })
        } else {
          while (listStack.length > 1 && indent <= listStack[listStack.length - 1].indent - 2) {
            closeListsToIndent(listStack[listStack.length - 1].indent)
          }
          const currTop = listStack[listStack.length - 1]
          if (currTop.type !== 'ul') {
            closeListsToIndent(currTop.indent)
            listStack.push({ type: 'ul', start: 1, indent, items: [{ text: itemText }] })
          } else {
            currTop.items.push({ text: itemText })
          }
        }
      }
      continue
    }

    // Check ordered list items (`1. Item`, `2) Item`, `a) Item`, `a. Item`)
    const numMatch = trimmed.match(/^(\d{1,3})([\.\)])\s+([\p{L}0-9("«“].*)$/u)
    const alphaMatch = trimmed.match(/^([a-z])\)\s+([\p{L}0-9("«“].*)$/u) || (listStack.length > 0 || indentDiff >= 2 ? trimmed.match(/^([a-z])\.\s+([\p{L}0-9("«“].*)$/u) : null)

    // Distinguish numbered section headings (`1. Introducción` followed by prose, then later `2. Metodología`)
    // vs real ordered lists (`1. Item\n2. Item` or multi-line wrapped list item followed by `2. Item`)
    let isSectionHeadingNumber = false
    if (
      numMatch &&
      listStack.length === 0 &&
      (prevWasBlank || htmlParts.length === 0) &&
      trimmed.length <= 85 &&
      !/[.;]$/.test(trimmed)
    ) {
      let nextIsOrderedOrSub = false
      let sawBlankLine = false
      for (let j = i + 1; j < Math.min(rawLines.length, i + 8); j++) {
        const lookRaw = rawLines[j]
        const lookTrim = lookRaw.trim()
        if (!lookTrim) {
          sawBlankLine = true
          continue
        }
        const lookIndent = getLeadingIndentSpaces(lookRaw)
        if (/^(?:\d{1,3}[\.\)]|[a-z][\.\)])\s+/.test(lookTrim) || Boolean(lookTrim.match(BULLET_LINE_START_REGEX))) {
          nextIsOrderedOrSub = true
          break
        }
        if (sawBlankLine && lookIndent <= indent + 1) {
          // Blank line followed by unindented regular prose -> numbered line was a section heading
          break
        }
        if (lookIndent > indent + 1) {
          continue
        }
        if (!isLineContinuation(trimmed, lookTrim, typicalLineWidth)) {
          break
        }
      }
      if (!nextIsOrderedOrSub) {
        isSectionHeadingNumber = true
      }
    }

    if (isSectionHeadingNumber) {
      flushAll()
      htmlParts.push(`<h3>${formatPlainTextLineToHtml(trimmed)}</h3>`)
      continue
    }

    if (numMatch || alphaMatch) {
      flushParagraph()
      flushTable()
      const start = numMatch ? parseInt(numMatch[1], 10) : 1
      const olType = alphaMatch ? 'a' : '1'
      const itemText = numMatch ? numMatch[3] : alphaMatch![2]

      if (listStack.length === 0) {
        listStack.push({ type: 'ol', start, olType, indent, items: [{ text: itemText }] })
      } else {
        const top = listStack[listStack.length - 1]
        if (indent >= top.indent + 2) {
          listStack.push({ type: 'ol', start, olType, indent, items: [{ text: itemText }] })
        } else {
          while (listStack.length > 1 && indent <= listStack[listStack.length - 1].indent - 2) {
            closeListsToIndent(listStack[listStack.length - 1].indent)
          }
          const currTop = listStack[listStack.length - 1]
          if (currTop.type !== 'ol' || currTop.olType !== olType) {
            closeListsToIndent(currTop.indent)
            listStack.push({ type: 'ol', start, olType, indent, items: [{ text: itemText }] })
          } else {
            currTop.items.push({ text: itemText })
          }
        }
      }
      continue
    }

    // Multi-line wrapped continuation inside an active list item!
    if (listStack.length > 0 && !isStandaloneHeader(trimmed)) {
      const top = listStack[listStack.length - 1]
      const lastItem = top.items[top.items.length - 1]
      const [baseItemText, ...nestedParts] = lastItem.text.split('__NESTED_HTML__')
      const hyphenJoin =
        /[\p{L}]{1,}[-\u00AD\u2010\u2011\u2012\u2013\u2212\uFE63\uFF0D]$/u.test(baseItemText) &&
        /^[\p{L}]{1,}/u.test(trimmed)
      if (
        nestedParts.length === 0 &&
        (indent >= top.indent + 1 || hyphenJoin || isLineContinuation(baseItemText, trimmed, typicalLineWidth))
      ) {
        lastItem.text = hyphenJoin
          ? `${baseItemText.slice(0, -1)}${trimmed}`
          : `${baseItemText} ${trimmed}`
        continue
      }
      closeListsToIndent(-Infinity)
    }

    // Blockquotes (`> quote`)
    if (trimmed.startsWith('>')) {
      flushAll()
      const quoteLines = [trimmed.replace(/^>\s*/, '')]
      while (i + 1 < rawLines.length && rawLines[i + 1].trim().startsWith('>')) {
        i++
        quoteLines.push(rawLines[i].trim().replace(/^>\s*/, ''))
      }
      htmlParts.push(`<blockquote>${formatPlainTextLineToHtml(quoteLines.join(' '))}</blockquote>`)
      continue
    }

    // Standalone heading line surrounded by blank space or short ALL-CAPS title
    if (
      isStandaloneHeader(trimmed) &&
      (prevWasBlank || htmlParts.length === 0 || currentPara.length === 0) &&
      (!nextNonEmptyLine || rawLines[i + 1]?.trim() === '' || nextNonEmptyLine.trim().length > 35)
    ) {
      flushAll()
      const tag = htmlParts.length === 0 && trimmed.length <= 65 && !/[.:]$/.test(trimmed) ? 'h2' : 'h3'
      const centered = indentDiff >= 12 && trimmed.length <= 55
      const styleAttr = formatBlockAlignmentAndIndentStyle({ align: centered ? 'center' : null })
      htmlParts.push(`<${tag}${styleAttr}>${formatPlainTextLineToHtml(trimmed)}</${tag}>`)
      continue
    }

    // Paragraph accumulation
    const centered = indentDiff >= 14 && trimmed.length <= 52 && prevWasBlank
    if (currentPara.length > 0) {
      const prevLine = currentPara[currentPara.length - 1].text
      const startsIndentedPara = hasFirstLineIndentPattern && indentDiff >= 3 && currentPara[currentPara.length - 1].indentDiff < 3
      const hyphenJoin =
        /[\p{L}]{1,}[-\u00AD\u2010\u2011\u2012\u2013\u2212\uFE63\uFF0D]$/u.test(prevLine) &&
        /^[\p{L}]{1,}/u.test(trimmed)

      if (!startsIndentedPara && !centered && (hyphenJoin || isLineContinuation(prevLine, trimmed, typicalLineWidth))) {
        currentPara.push({ text: trimmed, indentDiff, centered })
      } else {
        flushParagraph()
        currentPara.push({ text: trimmed, indentDiff, centered })
      }
    } else {
      currentPara.push({ text: trimmed, indentDiff, centered })
    }
  }

  if (inFencedCode && fencedCodeLines.length > 0) {
    htmlParts.push(`<pre><code>${escapeHtml(fencedCodeLines.join('\n'))}</code></pre>`)
  }
  flushAll()

  return sanitizeHtmlContent(htmlParts.join(''))
}

/**
 * Backward compatibility alias for processPdfPlainText
 */
export function formatPdfOrStructuredText(text: string, sourceHtml?: string): string {
  return processPdfPlainText(text, sourceHtml)
}

/**
 * Main entrance for cleaning and structuring PDF content from either HTML or plain text
 */
export function cleanPdfContent(html: string, text: string): string {
  if (html && (isPdfHtml(html) || hasHtmlFormatting(html))) {
    return processPdfHtml(html, text)
  }

  if (text && text.trim()) {
    return processPdfPlainText(text, html)
  }

  return ''
}

/**
 * Backward compatibility alias for cleanPdfContent
 */
export function cleanPdfHtml(html: string, textFallback?: string): string {
  return cleanPdfContent(html, textFallback || '')
}

/**
 * Cleans pasted HTML from non-PDF rich sources (Word, Google Docs, Notion, web pages)
 * while preserving bold, italic, underline, strikethrough, accent colors, highlights,
 * links, headings, lists, tables, alignment, indentation, and code blocks.
 */
export function cleanPastedHtml(html: string): string {
  if (!html || typeof html !== 'string') return ''

  let cleaned = html
    // Remove Google Docs internal wrapper
    .replace(/<b\b[^>]*id="docs-internal-guid-[^"]*"[^>]*>([\s\S]*?)<\/b>/gi, '$1')
    // Remove Microsoft Office / Word comments, conditional tags, and XML namespaces
    .replace(/<!--[\s\S]*?-->/gi, '')
    .replace(/<\/?(?:o|w|v|m|st1):[^>]*>/gi, '')
    .replace(/<xml>[\s\S]*?<\/xml>/gi, '')
    .replace(/<meta[^>]*>/gi, '')
    .replace(/<link[^>]*>/gi, '')
    // Fix soft hyphens
    .replace(/([\p{L}])\u00AD\s*([\p{L}])/gu, '$1$2')
    .replace(/\u00AD/g, '')

  if (typeof DOMParser !== 'undefined') {
    try {
      const doc = new DOMParser().parseFromString(cleaned, 'text/html')

      // Resolve <style> rules before removing <style> tags
      applyStylesheetRules(doc)
      doc.querySelectorAll('style, script, noscript, meta, link').forEach((el) => el.remove())

      const allElements = Array.from(doc.querySelectorAll('*'))
      for (const el of allElements) {
        if (!(el instanceof HTMLElement)) continue
        const tag = el.tagName.toLowerCase()

        const styleAttr = el.getAttribute('style') || ''
        const decls = parseCssDeclarationBlock(styleAttr)

        // Handle Google Docs `<b style="font-weight: normal">` or `<span style="font-weight: 400">`
        const fw = decls['font-weight']?.toLowerCase()
        if ((tag === 'b' || tag === 'strong') && (fw === 'normal' || fw === 'lighter' || /^(?:100|200|300|400)$/.test(fw || ''))) {
          const span = doc.createElement('span')
          while (el.firstChild) span.appendChild(el.firstChild)
          el.replaceWith(span)
          continue
        }

        // Convert CSS bold/italic/underline/strike/sub/sup onto inline elements cleanly
        if (tag === 'span' || tag === 'font' || tag === 'div' || tag === 'p') {
          const isBold =
            fw === 'bold' ||
            fw === 'bolder' ||
            /^(?:600|700|800|900)$/.test(fw || '') ||
            (decls['font-family'] ? isBoldFontFamily(decls['font-family']) : false)

          const fs = decls['font-style']?.toLowerCase()
          const isItalic =
            fs === 'italic' ||
            fs === 'oblique' ||
            (decls['font-family'] ? isItalicFontFamily(decls['font-family']) : false)

          const td = (decls['text-decoration-line'] || decls['text-decoration'] || '').toLowerCase()
          const isUnderline = td.includes('underline')
          const isStrike = td.includes('line-through')
          const isCode = tag === 'span' && decls['font-family'] ? isMonospaceFontFamily(decls['font-family']) : false

          const hasBlockChildren =
            (tag === 'div' || tag === 'p') &&
            Boolean(el.querySelector('p, div, ul, ol, h1, h2, h3, h4, h5, h6, table, blockquote, pre'))

          const hasBoldResetChild =
            isBold &&
            Array.from(el.querySelectorAll('*')).some((desc) => {
              const dfw = parseCssDeclarationBlock(desc.getAttribute('style') || '')['font-weight']?.toLowerCase()
              return dfw === 'normal' || dfw === 'lighter' || /^(?:100|200|300|400)$/.test(dfw || '')
            })

          if (!hasBlockChildren && el.textContent?.trim() && (isBold || isItalic || isUnderline || isStrike || isCode)) {
            const wrapWith = (wrapperTag: string) => {
              const wrapper = doc.createElement(wrapperTag)
              while (el.firstChild) wrapper.appendChild(el.firstChild)
              el.appendChild(wrapper)
            }
            if (isBold && hasBoldResetChild && !el.closest('strong, b')) {
              const children = Array.from(el.childNodes)
              for (const child of children) {
                if (child.nodeType === 3 && child.textContent?.trim()) {
                  const strong = doc.createElement('strong')
                  strong.textContent = child.textContent
                  child.replaceWith(strong)
                } else if (child instanceof HTMLElement) {
                  const cfw = parseCssDeclarationBlock(child.getAttribute('style') || '')['font-weight']?.toLowerCase()
                  const resets = cfw === 'normal' || cfw === 'lighter' || /^(?:100|200|300|400)$/.test(cfw || '')
                  if (!resets && !child.closest('strong, b') && child.textContent?.trim()) {
                    const strong = doc.createElement('strong')
                    while (child.firstChild) strong.appendChild(child.firstChild)
                    child.appendChild(strong)
                  }
                }
              }
            } else if (isBold && !el.closest('strong, b')) {
              wrapWith('strong')
            }
            if (isItalic && !el.closest('em, i')) wrapWith('em')
            if (isUnderline && !el.closest('u, a')) wrapWith('u')
            if (isStrike && !el.closest('s, del, strike')) wrapWith('s')
            if (isCode && !el.closest('code, pre')) wrapWith('code')
          }
        }

        // Legacy <font color="...">
        if (tag === 'font') {
          const fc = el.getAttribute('color')
          if (fc && !isNeutralTextColor(fc)) {
            el.style.color = fc
          }
          el.removeAttribute('color')
        }

        // Sanitize style attribute to drop black/white colors and junk layout props
        if (styleAttr) {
          const safeStyle = sanitizeInlineStyle(styleAttr)
          if (safeStyle) {
            el.setAttribute('style', safeStyle)
          } else {
            el.removeAttribute('style')
          }
        }
      }

      cleaned = doc.body.innerHTML
    } catch {
      // fallback
    }
  }

  return sanitizeHtmlContent(cleaned)
}

/**
 * Cleans pasted plain text (single or multi-line):
 * - Normalizes Unicode spaces, PUA bullets, and ligatures
 * - Fixes soft & hard hyphenated line breaks
 * - Normalizes PDF kerning/punctuation spacing while preserving line structure
 */
export function cleanPastedText(text: string): string {
  if (!text || typeof text !== 'string') return ''
  let cleaned = normalizePdfCharacters(text, true)
  cleaned = normalizeLigatures(cleaned)
  cleaned = fixHyphenatedLinebreaks(cleaned)

  // Clean each line's spacing/punctuation without flattening intentional multi-line plain text
  cleaned = cleaned
    .split('\n')
    .map((line) => {
      const leading = line.match(/^[ \t]*/)?.[0] || ''
      const rest = line.slice(leading.length)
      if (!rest.trim()) return ''
      return leading + normalizeSpacingAndPunctuation(rest, true)
    })
    .join('\n')
    .trim()

  return cleaned
}

/**
 * Unified entry point for all clipboard paste events (DocEditor, CanvasBoard, NoteNode, TextNode).
 * Properly classifies internal ProseMirror slices, PDF HTML, PDF plain text, rich HTML (Word/Docs/Web),
 * and simple plain text so each takes the optimal lossless path.
 */
export function prepareClipboardPaste(html: string, text: string): ClipboardPasteResult {
  const safeHtml = typeof html === 'string' ? html : ''
  const safeText = typeof text === 'string' ? text : ''

  // 1. Internal Seven Note / ProseMirror copy-paste
  if (safeHtml.includes('data-pm-slice')) {
    return { kind: 'internal', html: safeHtml, text: safeText }
  }

  // 2. Explicit PDF HTML (PDF.js, pdf2htmlEX, Apple Preview, positioned spans, PDF fonts)
  if (safeHtml && isPdfHtml(safeHtml)) {
    const outHtml = processPdfHtml(safeHtml, safeText)
    return { kind: 'pdf', html: outHtml, text: safeText }
  }

  // 3. Rich non-PDF HTML (Word, Google Docs, Notion, web pages with actual formatting/structure)
  if (safeHtml && hasHtmlFormatting(safeHtml)) {
    const outHtml = cleanPastedHtml(safeHtml)
    return { kind: 'rich-html', html: outHtml, text: safeText }
  }

  // 4. Plain text (or trivial single-span browser wrapper HTML) -> check PDF/structured heuristics
  if (safeText.trim()) {
    if (isPdfOrStructuredText(safeText) || isLegalContractOrPdfText(safeText)) {
      const outHtml = processPdfPlainText(safeText)
      return { kind: 'pdf', html: outHtml, text: cleanPastedText(safeText) }
    }
    return { kind: 'plain-text', html: '', text: cleanPastedText(safeText) }
  }

  return { kind: 'plain-text', html: '', text: '' }
}

/**
 * Sanitizes HTML content for safe rendering in notes and cards
 */
export function sanitizeHtmlContent(html: string): string {
  if (!html || typeof html !== 'string') return ''

  let processed = html
  if (typeof DOMPurify !== 'undefined' && typeof DOMPurify.sanitize === 'function') {
    processed = DOMPurify.sanitize(html, {
      ALLOWED_TAGS: [
        'p',
        'br',
        'span',
        'div',
        'b',
        'strong',
        'i',
        'em',
        'u',
        's',
        'strike',
        'del',
        'h1',
        'h2',
        'h3',
        'h4',
        'h5',
        'h6',
        'ul',
        'ol',
        'li',
        'blockquote',
        'pre',
        'code',
        'mark',
        'table',
        'thead',
        'tbody',
        'tr',
        'th',
        'td',
        'a',
        'img',
        'sub',
        'sup',
        'hr'
      ],
      ALLOWED_ATTR: [
        'href',
        'target',
        'rel',
        'style',
        'class',
        'title',
        'src',
        'alt',
        'width',
        'height',
        'align',
        'color',
        'start',
        'type',
        'colspan',
        'rowspan'
      ],
      ALLOW_DATA_ATTR: true
    })
  }

  // Clean inline style attributes so neutral black/white colors and unsafe CSS values never survive
  processed = processed.replace(/\sstyle="([^"]*)"/gi, (_m, rawStyleVal: string) => {
    const decoded = rawStyleVal
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&amp;/g, '&')
    const safeStyle = sanitizeInlineStyle(decoded)
    return safeStyle ? ` style="${safeStyle.replace(/"/g, "'")}"` : ''
  })

  // Ensure all links open in a new tab with noopener noreferrer
  return processed.replace(
    /<a\b(?![^>]*\btarget=)([^>]*?)>/gi,
    '<a target="_blank" rel="noopener noreferrer"$1>'
  )
}
