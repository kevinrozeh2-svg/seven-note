export interface ParsedCssProps {
  fontWeight?: string
  fontStyle?: string
  textDecoration?: string
  fontSize?: string
  fontFamily?: string
  color?: string
  backgroundColor?: string
  textAlign?: string
  marginTop?: string
  marginBottom?: string
  marginLeft?: string
  paddingLeft?: string
  textIndent?: string
  verticalAlign?: string
  listStyleType?: string
  whiteSpace?: string
  left?: string
  top?: string
  position?: string
  transform?: string
}

const SAFE_INLINE_STYLE_PROPS = new Set([
  'text-align',
  'margin-left',
  'padding-left',
  'text-indent',
  'color',
  'background-color',
  'list-style-type',
  'white-space'
])

/**
 * Parses a CSS length value (px, pt, em, rem) into approximate pixels.
 */
export function parseCssLengthPx(raw?: string | null, baseFontPx = 15): number | null {
  if (!raw || typeof raw !== 'string') return null
  const trimmed = raw.trim()
  // Support calc(var(--scale-factor) * 14.5px) used by modern PDF.js
  const match = trimmed.match(/(-?\d+(?:\.\d+)?)\s*(px|pt|em|rem)\b/i)
  if (!match) return null
  const val = parseFloat(match[1])
  if (!Number.isFinite(val)) return null
  const unit = match[2].toLowerCase()
  if (unit === 'px') return val
  if (unit === 'pt') return val * (4 / 3)
  if (unit === 'em' || unit === 'rem') return val * baseFontPx
  return null
}

/**
 * Parses a CSS coordinate value (px, pt, em, rem, or %) keeping the unit type.
 */
export function parseCssCoord(raw?: string | null): { value: number; unit: 'px' | '%' } | null {
  if (!raw || typeof raw !== 'string') return null
  const trimmed = raw.trim()
  const match = trimmed.match(/(-?\d+(?:\.\d+)?)\s*(px|pt|em|rem|%)/i)
  if (!match) return null
  const val = parseFloat(match[1])
  if (!Number.isFinite(val)) return null
  const unit = match[2].toLowerCase()
  if (unit === '%') return { value: val, unit: '%' }
  if (unit === 'pt') return { value: val * (4 / 3), unit: 'px' }
  if (unit === 'em' || unit === 'rem') return { value: val * 15, unit: 'px' }
  return { value: val, unit: 'px' }
}

/**
 * Parses CSS color string into RGBA components when possible.
 */
export function parseCssColor(raw?: string | null): { r: number; g: number; b: number; a: number } | null {
  if (!raw || typeof raw !== 'string') return null
  const c = raw.trim().toLowerCase()
  if (!c || c === 'none' || c === 'transparent' || c === 'inherit' || c === 'initial' || c === 'currentcolor') {
    return null
  }
  if (c === 'black' || c === 'windowtext') return { r: 0, g: 0, b: 0, a: 1 }
  if (c === 'white') return { r: 255, g: 255, b: 255, a: 1 }

  const hexMatch = c.match(/^#([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i)
  if (hexMatch) {
    const hex = hexMatch[1]
    if (hex.length === 3) {
      return {
        r: parseInt(hex[0] + hex[0], 16),
        g: parseInt(hex[1] + hex[1], 16),
        b: parseInt(hex[2] + hex[2], 16),
        a: 1
      }
    }
    const r = parseInt(hex.slice(0, 2), 16)
    const g = parseInt(hex.slice(2, 4), 16)
    const b = parseInt(hex.slice(4, 6), 16)
    const a = hex.length === 8 ? parseInt(hex.slice(6, 8), 16) / 255 : 1
    return { r, g, b, a }
  }

  const rgbMatch = c.match(/^rgba?\(\s*([\d.]+)\s*[,\s]\s*([\d.]+)\s*[,\s]\s*([\d.]+)(?:\s*[,/]\s*([\d.]+%?))?\s*\)$/)
  if (rgbMatch) {
    const r = Math.min(255, Math.max(0, Number(rgbMatch[1])))
    const g = Math.min(255, Math.max(0, Number(rgbMatch[2])))
    const b = Math.min(255, Math.max(0, Number(rgbMatch[3])))
    let a = 1
    if (rgbMatch[4] !== undefined) {
      a = rgbMatch[4].endsWith('%') ? parseFloat(rgbMatch[4]) / 100 : parseFloat(rgbMatch[4])
    }
    return { r, g, b, a }
  }

  return null
}

/**
 * Returns true if a text color is neutral default black/dark-gray or near-white/transparent,
 * which would break readability across Seven Note's Light and Dark modes.
 */
export function isNeutralTextColor(raw?: string | null): boolean {
  if (!raw || typeof raw !== 'string') return true
  const lower = raw.trim().toLowerCase()
  if (
    !lower ||
    lower === 'inherit' ||
    lower === 'initial' ||
    lower === 'unset' ||
    lower === 'currentcolor' ||
    lower === 'windowtext' ||
    lower === 'canvastext' ||
    lower === 'transparent' ||
    lower === 'black' ||
    lower === 'white'
  ) {
    return true
  }

  const rgba = parseCssColor(lower)
  if (!rgba) return false
  if (rgba.a < 0.08) return true

  const max = Math.max(rgba.r, rgba.g, rgba.b)
  const min = Math.min(rgba.r, rgba.g, rgba.b)
  const chroma = max - min
  // Low-chroma dark grays/blacks/ink (<= 75, or dark slate/navy <= 52 with slight tint) and near-whites (>= 225)
  if ((chroma <= 24 && (max <= 75 || min >= 225)) || (max <= 52 && chroma <= 36)) {
    return true
  }
  return false
}

/**
 * Returns true if a background color is transparent or neutral white/page background.
 */
export function isNeutralBackgroundColor(raw?: string | null): boolean {
  if (!raw || typeof raw !== 'string') return true
  const lower = raw.trim().toLowerCase()
  if (
    !lower ||
    lower === 'none' ||
    lower === 'transparent' ||
    lower === 'inherit' ||
    lower === 'initial' ||
    lower === 'unset' ||
    lower === 'white' ||
    lower === 'window'
  ) {
    return true
  }

  const rgba = parseCssColor(lower)
  if (!rgba) return false
  if (rgba.a < 0.06) return true
  // Pure or near-white page background
  if (rgba.r >= 242 && rgba.g >= 242 && rgba.b >= 242) {
    return true
  }
  return false
}

export function isBoldFontFamily(fontFamily?: string | null): boolean {
  if (!fontFamily) return false
  // Check hyphenated/delimited tokens and CamelCase PDF font suffixes like ArialBold, TimesNewRomanPS-BoldMT, CMBX10
  return (
    /(?:^|[\s,'"+_-])(?:bold|semibold|demibold|demi|extrabold|ultrabold|heavy|black|boldmt|boldps|cmbx\d*|bx\d*)(?:$|[\s,'"_ -]|mt\b|ps\b)/i.test(
      fontFamily
    ) || /(?:Bold|SemiBold|DemiBold|ExtraBold|UltraBold|Heavy|Black)/.test(fontFamily)
  )
}

export function isItalicFontFamily(fontFamily?: string | null): boolean {
  if (!fontFamily) return false
  return (
    /(?:^|[\s,'"+_-])(?:italic|oblique|slanted|bolditalic|itmt|cmti\d*|cmsl\d*)(?:$|[\s,'"_ -]|mt\b|ps\b)/i.test(
      fontFamily
    ) || /(?:Italic|Oblique|Slanted)/.test(fontFamily)
  )
}

export function isMonospaceFontFamily(fontFamily?: string | null): boolean {
  if (!fontFamily) return false
  return /(?:courier|consolas|monaco|menlo|fira\s*code|jetbrains\s*mono|source\s*code\s*pro|ibm\s*plex\s*mono|roboto\s*mono|liberation\s*mono|dejavu\s*sans\s*mono|ubuntu\s*mono|lucida\s*console|monospace|cmtt\d*)/i.test(
    fontFamily
  )
}

/**
 * Parses a CSS `font` shorthand declaration such as `italic bold 12.0px/16px 'Times New Roman'`.
 */
function expandFontShorthand(value: string, target: Record<string, string>): void {
  const lower = value.toLowerCase()
  if (/\b(?:italic|oblique)\b/.test(lower) && !target['font-style']) {
    target['font-style'] = 'italic'
  }
  if (/\b(?:bold|bolder|[6-9]\d{2})\b/.test(lower) && !target['font-weight']) {
    target['font-weight'] = 'bold'
  }
  const sizeMatch = value.match(/(\d+(?:\.\d+)?(?:px|pt|em|rem|%))(?:\s*\/\s*[\d.]+(?:px|pt|em|rem|%)?)?\s+(.+)$/i)
  if (sizeMatch) {
    if (!target['font-size']) target['font-size'] = sizeMatch[1]
    if (!target['font-family']) target['font-family'] = sizeMatch[2].trim()
  }
}

/**
 * Parses an inline CSS style string into a lowercase property map.
 */
export function parseCssDeclarationBlock(styleText: string): Record<string, string> {
  const map: Record<string, string> = {}
  if (!styleText) return map

  const parts = styleText.split(';')
  for (const part of parts) {
    const colonIdx = part.indexOf(':')
    if (colonIdx <= 0) continue
    const prop = part.slice(0, colonIdx).trim().toLowerCase()
    let val = part.slice(colonIdx + 1).trim()
    if (!prop || !val) continue
    val = val.replace(/\s*!important\s*$/i, '').trim()
    if (!val) continue
    if (prop === 'font') {
      expandFontShorthand(val, map)
    } else {
      map[prop] = val
    }
  }
  return map
}

function serializeStyleMap(map: Record<string, string>): string {
  return Object.entries(map)
    .filter(([, v]) => Boolean(v))
    .map(([k, v]) => `${k}: ${v}`)
    .join('; ')
}

/**
 * Resolves `<style>` CSS rules (`.class`, `tag.class`, `tag`, `#id`) onto matching elements
 * inside a parsed Document before `<style>` elements are removed.
 */
export function applyStylesheetRules(doc: Document): void {
  const styleEls = Array.from(doc.querySelectorAll('style'))
  if (styleEls.length === 0) return

  const ruleMap = new Map<Element, Record<string, string>>()

  for (const styleEl of styleEls) {
    let cssText = styleEl.textContent || ''
    // Strip CSS comments and @font-face / @keyframes / @page blocks
    cssText = cssText.replace(/\/\*[\s\S]*?\*\//g, '')
    cssText = cssText.replace(/@(?:font-face|keyframes|page|import|charset)\b[^{;]*(?:\{[^}]*\}|;)/gi, '')

    const ruleRegex = /([^{}@]+)\{([^{}]+)\}/g
    let match: RegExpExecArray | null
    while ((match = ruleRegex.exec(cssText)) !== null) {
      const selectorGroup = match[1].trim()
      const declBlock = match[2].trim()
      if (!selectorGroup || !declBlock) continue

      const decls = parseCssDeclarationBlock(declBlock)
      if (Object.keys(decls).length === 0) continue

      const selectors = selectorGroup.split(',').map((s) => s.trim()).filter(Boolean)
      for (const selector of selectors) {
        // Skip pseudo-elements/classes that querySelectorAll cannot match reliably or shouldn't apply
        if (selector.includes('::') || selector.includes(':hover') || selector.includes(':before') || selector.includes(':after')) {
          continue
        }
        try {
          const matched = doc.querySelectorAll(selector)
          matched.forEach((el) => {
            const prev = ruleMap.get(el) || {}
            ruleMap.set(el, { ...prev, ...decls })
          })
        } catch {
          // Ignore unsupported selectors
        }
      }
    }
  }

  for (const [el, classDecls] of ruleMap.entries()) {
    const inlineDecls = parseCssDeclarationBlock(el.getAttribute('style') || '')
    const merged = { ...classDecls, ...inlineDecls }
    const serialized = serializeStyleMap(merged)
    if (serialized) {
      el.setAttribute('style', serialized)
    }
  }
}

/**
 * Sanitizes an inline style string to retain only safe typographic/layout CSS properties
 * and filter out unsafe values like `url(...)` or `expression(...)`.
 */
export function sanitizeInlineStyle(styleText: string): string {
  if (!styleText) return ''
  const decls = parseCssDeclarationBlock(styleText)
  const out: Record<string, string> = {}

  for (const [prop, val] of Object.entries(decls)) {
    if (!SAFE_INLINE_STYLE_PROPS.has(prop)) continue
    if (/url\s*\(|expression\s*\(|javascript:|vbscript:|-moz-binding/i.test(val)) continue

    if (prop === 'color' && isNeutralTextColor(val)) continue
    if (prop === 'background-color' && isNeutralBackgroundColor(val)) continue
    if (prop === 'text-align' && !/^(left|center|right|justify|start|end)$/i.test(val)) continue
    if ((prop === 'margin-left' || prop === 'padding-left' || prop === 'text-indent') && !/^-?\d+(?:\.\d+)?(?:px|pt|em|rem)$/.test(val)) {
      continue
    }

    out[prop] = val
  }

  return serializeStyleMap(out)
}

export interface FormattingState {
  bold: boolean
  italic: boolean
  underline: boolean
  strike: boolean
  sub: boolean
  sup: boolean
  code: boolean
  color: string | null
  highlight: string | null
}

export const DEFAULT_FORMATTING_STATE: FormattingState = {
  bold: false,
  italic: false,
  underline: false,
  strike: false,
  sub: false,
  sup: false,
  code: false,
  color: null,
  highlight: null
}

/**
 * Computes effective inline formatting state for a DOM element given its parent's inherited state.
 * Handles explicit overrides like `<b style="font-weight: normal">` or `<span style="font-weight: 400">`.
 */
export function computeElementFormatting(el: Element, parentState: FormattingState): FormattingState {
  const tag = el.tagName.toLowerCase()
  const styleAttr = el.getAttribute('style') || ''
  const decls = parseCssDeclarationBlock(styleAttr)
  const className = typeof (el as HTMLElement).className === 'string' ? (el as HTMLElement).className : ''

  let bold = parentState.bold
  if (tag === 'strong' || tag === 'b') {
    bold = true
  }
  const fw = decls['font-weight']?.toLowerCase()
  if (fw) {
    if (fw === 'normal' || fw === 'lighter' || /^(?:100|200|300|400)$/.test(fw)) {
      bold = false
    } else if (fw === 'bold' || fw === 'bolder' || /^(?:600|700|800|900)$/.test(fw)) {
      bold = true
    }
  } else if (decls['font-family'] && isBoldFontFamily(decls['font-family'])) {
    bold = true
  } else if (/\b(?:bold|semibold|font-bold|font-semibold)\b/i.test(className)) {
    bold = true
  }

  let italic = parentState.italic
  if (tag === 'em' || tag === 'i') {
    italic = true
  }
  const fs = decls['font-style']?.toLowerCase()
  if (fs) {
    if (fs === 'normal') italic = false
    else if (fs === 'italic' || fs === 'oblique') italic = true
  } else if (decls['font-family'] && isItalicFontFamily(decls['font-family'])) {
    italic = true
  } else if (/\b(?:italic|font-italic)\b/i.test(className)) {
    italic = true
  }

  let underline = parentState.underline
  if (tag === 'u') underline = true
  const td = (decls['text-decoration-line'] || decls['text-decoration'] || '').toLowerCase()
  if (td) {
    if (td.includes('none')) underline = false
    if (td.includes('underline')) underline = true
  }
  if (tag === 'a') {
    // TipTap renders links underlined automatically; avoid redundant <u> inside <a>
    underline = false
  }

  let strike = parentState.strike
  if (tag === 's' || tag === 'del' || tag === 'strike') strike = true
  if (td && td.includes('line-through')) strike = true

  let sub = parentState.sub
  let sup = parentState.sup
  if (tag === 'sub' || decls['vertical-align'] === 'sub') {
    sub = true
    sup = false
  } else if (tag === 'sup' || decls['vertical-align'] === 'super') {
    sup = true
    sub = false
  }

  let code = parentState.code
  if (tag === 'code' || tag === 'tt' || tag === 'kbd' || tag === 'samp') {
    code = true
  } else if (decls['font-family'] && isMonospaceFontFamily(decls['font-family'])) {
    code = true
  }

  let color = parentState.color
  const rawColor = decls['color'] || (tag === 'font' ? el.getAttribute('color') : null)
  if (rawColor) {
    color = isNeutralTextColor(rawColor) ? null : rawColor
  }

  let highlight = parentState.highlight
  const rawBg = decls['background-color'] || decls['background']
  if (tag === 'mark') {
    highlight = rawBg && !isNeutralBackgroundColor(rawBg) ? rawBg : '#fef08a'
  } else if (rawBg) {
    highlight = isNeutralBackgroundColor(rawBg) ? null : rawBg
  }

  return { bold, italic, underline, strike, sub, sup, code, color, highlight }
}
