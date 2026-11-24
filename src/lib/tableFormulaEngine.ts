/**
 * Excel-compatible Formula Parser, Evaluator & Number Formatting Engine
 * for Seven Note TipTap Tables.
 *
 * Zero eval() — pure recursive-descent parser with cycle detection,
 * Spanish & English Excel function aliases, European/US number parsing,
 * and structured Excel error reporting (#DIV/0!, #VALUE!, #REF!, #NAME?, #CIRC!, #SYNTAX!, #NUM!, #ARGS!).
 */

export type CellFormat = 'auto' | 'number' | 'currency' | 'percent'

export type FormulaErrorCode =
  | '#DIV/0!'
  | '#VALUE!'
  | '#REF!'
  | '#NAME?'
  | '#CIRC!'
  | '#SYNTAX!'
  | '#NUM!'
  | '#ARGS!'

export class FormulaError extends Error {
  code: FormulaErrorCode
  detail: string

  constructor(code: FormulaErrorCode, detail: string) {
    super(`${code}: ${detail}`)
    this.name = 'FormulaError'
    this.code = code
    this.detail = detail
  }
}

export interface TableCellInput {
  text: string
  formula?: string | null
  format?: CellFormat | null
}

export interface EvaluatedCell {
  row: number
  col: number
  ref: string
  isFormula: boolean
  formula: string | null
  displayText: string
  numericValue: number | null
  stringValue: string | null
  inferredFormat: CellFormat
  currencySymbol: string | null
  errorCode: FormulaErrorCode | null
  errorMessage: string | null
}

export interface TableErrorEntry {
  row: number
  col: number
  ref: string
  code: FormulaErrorCode
  message: string
  formula: string
}

export interface TableEvaluationResult {
  cells: EvaluatedCell[][]
  errors: TableErrorEntry[]
}

export interface ParsedNumber {
  kind: 'number' | 'empty' | 'text'
  value: number
  isPercent: boolean
  isCurrency: boolean
  currencySymbol: string | null
  hasSpanishThousands: boolean
  raw: string
}

// ============================================================================
// Coordinate Helpers (A1, B2, AA10)
// ============================================================================

export function colIndexToLetter(col: number): string {
  let n = col
  let result = ''
  while (n >= 0) {
    result = String.fromCharCode((n % 26) + 65) + result
    n = Math.floor(n / 26) - 1
  }
  return result
}

export function letterToColIndex(letters: string): number {
  const upper = letters.toUpperCase()
  let result = 0
  for (let i = 0; i < upper.length; i++) {
    result = result * 26 + (upper.charCodeAt(i) - 64)
  }
  return result - 1
}

export function formatCellRef(col: number, row: number): string {
  return `${colIndexToLetter(col)}${row + 1}`
}

const CELL_REF_REGEX = /^\$?([A-Za-z]{1,3})\$?([1-9]\d*)$/

export function parseCellRef(ref: string): { col: number; row: number } | null {
  const match = CELL_REF_REGEX.exec(ref.trim())
  if (!match) return null
  const col = letterToColIndex(match[1])
  const row = parseInt(match[2], 10) - 1
  if (col < 0 || row < 0) return null
  return { col, row }
}

/**
 * Extracts all { col, row } coordinates referenced by a formula (including ranges like B2:B4).
 * Used to highlight referenced cells in the table just like Excel.
 */
export function extractFormulaReferences(
  formula: string | null | undefined,
  maxRows = 500,
  maxCols = 100
): Array<{ col: number; row: number; ref: string }> {
  if (!formula || !formula.trim().startsWith('=')) return []
  const body = formula.trim().slice(1)
  // Strip string literals so we don't match text inside quotes
  const withoutStrings = body.replace(/"(?:[^"\\]|\\.)*"/g, '""')
  const seen = new Set<string>()
  const refs: Array<{ col: number; row: number; ref: string }> = []

  const addCell = (col: number, row: number) => {
    if (col < 0 || row < 0 || col >= maxCols || row >= maxRows) return
    const key = `${col}:${row}`
    if (!seen.has(key)) {
      seen.add(key)
      refs.push({ col, row, ref: formatCellRef(col, row) })
    }
  }

  // Match ranges first: A1:C5
  const rangeRegex = /\$?([A-Za-z]{1,3})\$?([1-9]\d*)\s*:\s*\$?([A-Za-z]{1,3})\$?([1-9]\d*)/g
  let m: RegExpExecArray | null
  while ((m = rangeRegex.exec(withoutStrings)) !== null) {
    const c1 = letterToColIndex(m[1])
    const r1 = parseInt(m[2], 10) - 1
    const c2 = letterToColIndex(m[3])
    const r2 = parseInt(m[4], 10) - 1
    const minC = Math.min(c1, c2)
    const maxC = Math.min(Math.max(c1, c2), maxCols - 1)
    const minR = Math.min(r1, r2)
    const maxR = Math.min(Math.max(r1, r2), maxRows - 1)
    for (let r = minR; r <= maxR; r++) {
      for (let c = minC; c <= maxC; c++) {
        addCell(c, r)
      }
    }
  }

  // Match standalone cell references (avoiding function names followed by '(')
  const cellRegex = /(?<![A-Za-z0-9_])\$?([A-Za-z]{1,3})\$?([1-9]\d*)(?![A-Za-z0-9_(])/g
  while ((m = cellRegex.exec(withoutStrings)) !== null) {
    const col = letterToColIndex(m[1])
    const row = parseInt(m[2], 10) - 1
    addCell(col, row)
  }

  return refs
}

// ============================================================================
// Smart Number Parsing (Supports Spanish 1.000,50, US 1,000.50, %, $, €)
// ============================================================================

export function parseNumericCellValue(rawText: string): ParsedNumber {
  const raw = (rawText || '').trim()
  if (!raw) {
    return {
      kind: 'empty',
      value: 0,
      isPercent: false,
      isCurrency: false,
      currencySymbol: null,
      hasSpanishThousands: false,
      raw
    }
  }

  // Reject error codes as text so dependent formulas know it's not a valid number
  if (/^#[A-Z0-9/!?]+$/.test(raw)) {
    return {
      kind: 'text',
      value: NaN,
      isPercent: false,
      isCurrency: false,
      currencySymbol: null,
      hasSpanishThousands: false,
      raw
    }
  }

  let s = raw.replace(/\u00A0/g, ' ').trim()
  let isPercent = false
  let isCurrency = false
  let currencySymbol: string | null = null

  // Detect leading/trailing currency symbols
  const leadingCurr = /^([€$£¥]|USD|EUR|CUP|MXN|ARS)\s*/i.exec(s)
  if (leadingCurr) {
    isCurrency = true
    currencySymbol = leadingCurr[1].length === 1 ? leadingCurr[1] : `${leadingCurr[1].toUpperCase()} `
    s = s.slice(leadingCurr[0].length).trim()
  } else {
    const trailingCurr = /\s*([€$£¥]|USD|EUR|CUP|MXN|ARS)$/i.exec(s)
    if (trailingCurr) {
      isCurrency = true
      currencySymbol = trailingCurr[1].length === 1 ? trailingCurr[1] : `${trailingCurr[1].toUpperCase()} `
      s = s.slice(0, s.length - trailingCurr[0].length).trim()
    }
  }

  // Detect percentage
  if (s.endsWith('%')) {
    isPercent = true
    s = s.slice(0, -1).trim()
  }

  // Detect accounting negatives like (1.250)
  let negative = false
  if (s.startsWith('(') && s.endsWith(')')) {
    negative = true
    s = s.slice(1, -1).trim()
  } else if (s.startsWith('-')) {
    negative = true
    s = s.slice(1).trim()
  } else if (s.startsWith('+')) {
    s = s.slice(1).trim()
  }

  // Remove internal spaces (e.g. "1 000")
  s = s.replace(/\s+/g, '')

  // Must contain only digits, dots, commas
  if (!/^\d[\d.,]*$/.test(s)) {
    return {
      kind: 'text',
      value: NaN,
      isPercent: false,
      isCurrency: false,
      currencySymbol: null,
      hasSpanishThousands: false,
      raw
    }
  }

  let hasSpanishThousands = false
  let normalized = s

  const dotCount = (s.match(/\./g) || []).length
  const commaCount = (s.match(/,/g) || []).length

  if (dotCount > 0 && commaCount > 0) {
    // Both dot and comma present: whichever comes last is the decimal separator
    const lastDot = s.lastIndexOf('.')
    const lastComma = s.lastIndexOf(',')
    if (lastComma > lastDot) {
      // European / Spanish: 1.250,50
      hasSpanishThousands = true
      normalized = s.replace(/\./g, '').replace(',', '.')
    } else {
      // US: 1,250.50
      normalized = s.replace(/,/g, '')
    }
  } else if (dotCount > 1) {
    // Multiple dots: 1.000.000 -> Spanish thousands
    hasSpanishThousands = true
    normalized = s.replace(/\./g, '')
  } else if (commaCount > 1) {
    // Multiple commas: 1,000,000 -> US thousands
    normalized = s.replace(/,/g, '')
  } else if (dotCount === 1) {
    // Single dot: "1.000" (exact 3 digits after dot & integer part 1-3 digits, non-zero lead) -> Spanish thousands!
    // Whereas "1.5", "1.25", "0.750" -> decimal
    const [intPart, fracPart] = s.split('.')
    if (fracPart.length === 3 && intPart.length >= 1 && intPart.length <= 3 && intPart !== '0') {
      hasSpanishThousands = true
      normalized = intPart + fracPart
    } else {
      normalized = s
    }
  } else if (commaCount === 1) {
    // Single comma: "1,000" (3 digits after comma, non-zero lead) vs "12,5" (Spanish decimal)
    const [intPart, fracPart] = s.split(',')
    if (fracPart.length === 3 && intPart.length >= 1 && intPart.length <= 3 && intPart !== '0') {
      normalized = intPart + fracPart
    } else {
      normalized = `${intPart}.${fracPart}`
    }
  }

  let num = Number(normalized)
  if (!Number.isFinite(num)) {
    return {
      kind: 'text',
      value: NaN,
      isPercent: false,
      isCurrency: false,
      currencySymbol: null,
      hasSpanishThousands: false,
      raw
    }
  }

  if (negative) num = -num
  if (isPercent) num = num / 100

  return {
    kind: 'number',
    value: num,
    isPercent,
    isCurrency,
    currencySymbol,
    hasSpanishThousands,
    raw
  }
}

export function formatCalculatedValue(
  value: number,
  format: CellFormat = 'auto',
  currencySymbol: string | null = '$'
): string {
  if (!Number.isFinite(value)) return '#NUM!'
  // Avoid floating point noise like 0.30000000000000004 or -0
  const cleaned = Math.abs(value) < 1e-12 ? 0 : Math.round(value * 1e10) / 1e10

  if (format === 'percent') {
    const pct = Math.round(cleaned * 100 * 1e6) / 1e6
    const hasDecimals = Math.abs(pct - Math.round(pct)) > 1e-6
    const formatted = new Intl.NumberFormat('es-ES', {
      minimumFractionDigits: 0,
      maximumFractionDigits: hasDecimals ? 2 : 0
    }).format(pct)
    return `${formatted}%`
  }

  if (format === 'currency') {
    const sym = currencySymbol || '$'
    const hasDecimals = Math.abs(cleaned - Math.round(cleaned)) > 1e-6
    const formatted = new Intl.NumberFormat('es-ES', {
      useGrouping: 'always',
      minimumFractionDigits: hasDecimals ? 2 : 0,
      maximumFractionDigits: 2
    }).format(Math.abs(cleaned))
    return `${cleaned < 0 ? '-' : ''}${sym}${formatted}`
  }

  // 'number' or 'auto'
  const hasDecimals = Math.abs(cleaned - Math.round(cleaned)) > 1e-6
  return new Intl.NumberFormat('es-ES', {
    useGrouping: 'always',
    minimumFractionDigits: 0,
    maximumFractionDigits: hasDecimals ? 2 : 0
  }).format(cleaned)
}

// ============================================================================
// Formula Tokenizer
// ============================================================================

type TokenType =
  | 'NUMBER'
  | 'STRING'
  | 'IDENT'
  | 'CELL'
  | 'OP'
  | 'CMP'
  | 'LPAREN'
  | 'RPAREN'
  | 'COLON'
  | 'SEP'
  | 'PERCENT'
  | 'EOF'

interface Token {
  type: TokenType
  value: string
  pos: number
}

function tokenizeFormula(input: string): Token[] {
  const tokens: Token[] = []
  let i = 0
  const len = input.length

  while (i < len) {
    const ch = input[i]

    if (/\s/.test(ch)) {
      i++
      continue
    }

    // String literal "..."
    if (ch === '"') {
      const start = i
      i++
      let str = ''
      let closed = false
      while (i < len) {
        if (input[i] === '"' && input[i + 1] === '"') {
          str += '"'
          i += 2
        } else if (input[i] === '"') {
          i++
          closed = true
          break
        } else {
          str += input[i++]
        }
      }
      if (!closed) {
        throw new FormulaError('#SYNTAX!', 'Comillas sin cerrar en la fórmula')
      }
      tokens.push({ type: 'STRING', value: str, pos: start })
      continue
    }

    // Number literal (digits with optional decimal point)
    if (/\d/.test(ch) || (ch === '.' && i + 1 < len && /\d/.test(input[i + 1]))) {
      const start = i
      let hasDot = false
      while (i < len && (/\d/.test(input[i]) || (!hasDot && input[i] === '.'))) {
        if (input[i] === '.') hasDot = true
        i++
      }
      tokens.push({ type: 'NUMBER', value: input.slice(start, i), pos: start })
      continue
    }

    // Cell reference ($A$1) or Function Identifier (SUM, PROMEDIO, SI.ERROR)
    if (ch === '$' || /[A-Za-zÁÉÍÓÚÜÑáéíóúüñ_]/.test(ch)) {
      const start = i
      while (i < len && /[A-Za-z0-9_$ÁÉÍÓÚÜÑáéíóúüñ.]/.test(input[i])) {
        i++
      }
      const raw = input.slice(start, i)
      // Lookahead for '(' -> function call
      let look = i
      while (look < len && /\s/.test(input[look])) look++
      if (input[look] === '(') {
        tokens.push({ type: 'IDENT', value: raw.toUpperCase(), pos: start })
      } else if (CELL_REF_REGEX.test(raw)) {
        tokens.push({ type: 'CELL', value: raw.toUpperCase(), pos: start })
      } else {
        tokens.push({ type: 'IDENT', value: raw.toUpperCase(), pos: start })
      }
      continue
    }

    // Two-char comparison operators
    const two = input.slice(i, i + 2)
    if (two === '<=' || two === '>=' || two === '<>' || two === '!=') {
      tokens.push({ type: 'CMP', value: two, pos: i })
      i += 2
      continue
    }

    // Single-char comparison operators
    if (ch === '=' || ch === '<' || ch === '>') {
      tokens.push({ type: 'CMP', value: ch, pos: i })
      i++
      continue
    }

    // Arithmetic operators
    if (ch === '+' || ch === '-' || ch === '*' || ch === '/' || ch === '^') {
      tokens.push({ type: 'OP', value: ch, pos: i })
      i++
      continue
    }

    if (ch === '%') {
      tokens.push({ type: 'PERCENT', value: '%', pos: i })
      i++
      continue
    }

    if (ch === '(') {
      tokens.push({ type: 'LPAREN', value: '(', pos: i })
      i++
      continue
    }

    if (ch === ')') {
      tokens.push({ type: 'RPAREN', value: ')', pos: i })
      i++
      continue
    }

    if (ch === ':') {
      tokens.push({ type: 'COLON', value: ':', pos: i })
      i++
      continue
    }

    // Argument separator: support both ',' and ';' (Spanish Excel uses ';')
    if (ch === ',' || ch === ';') {
      tokens.push({ type: 'SEP', value: ch, pos: i })
      i++
      continue
    }

    throw new FormulaError('#SYNTAX!', `Carácter inesperado "${ch}" en la fórmula`)
  }

  tokens.push({ type: 'EOF', value: '', pos: len })
  return tokens
}

// ============================================================================
// Recursive-Descent Evaluator
// ============================================================================

type EvalValue =
  | { type: 'number'; value: number; isPercent?: boolean; isCurrency?: boolean; currencySymbol?: string | null }
  | { type: 'string'; value: string }
  | { type: 'boolean'; value: boolean }

interface RangeArg {
  type: 'range'
  cells: Array<{
    kind: 'number' | 'empty' | 'text'
    value: number
    raw: string
    isPercent: boolean
    isCurrency: boolean
    currencySymbol: string | null
  }>
}

type FnArg = EvalValue | RangeArg

interface EvalContext {
  rows: number
  cols: number
  resolveCell: (row: number, col: number) => {
    kind: 'number' | 'empty' | 'text'
    value: number
    raw: string
    isPercent: boolean
    isCurrency: boolean
    currencySymbol: string | null
  }
}

function toNumber(val: EvalValue, opContext: string): number {
  if (val.type === 'number') return val.value
  if (val.type === 'boolean') return val.value ? 1 : 0
  const parsed = parseNumericCellValue(val.value)
  if (parsed.kind === 'number') return parsed.value
  if (parsed.kind === 'empty') return 0
  throw new FormulaError('#VALUE!', `No se puede usar texto "${val.value}" en ${opContext}`)
}

function toBoolean(val: EvalValue): boolean {
  if (val.type === 'boolean') return val.value
  if (val.type === 'number') return val.value !== 0
  return val.value.length > 0 && val.value.toUpperCase() !== 'FALSE' && val.value.toUpperCase() !== 'FALSO'
}

class FormulaParser {
  private tokens: Token[]
  private idx = 0
  private ctx: EvalContext

  constructor(tokens: Token[], ctx: EvalContext) {
    this.tokens = tokens
    this.ctx = ctx
  }

  private peek(): Token {
    return this.tokens[this.idx] || { type: 'EOF', value: '', pos: 0 }
  }

  private next(): Token {
    const tok = this.peek()
    if (this.idx < this.tokens.length - 1) this.idx++
    return tok
  }

  parse(): EvalValue {
    if (this.peek().type === 'EOF') {
      throw new FormulaError('#SYNTAX!', 'Fórmula vacía después de "="')
    }
    const result = this.parseComparison()
    if (this.peek().type !== 'EOF') {
      throw new FormulaError('#SYNTAX!', `Expresión inesperada "${this.peek().value}"`)
    }
    return result
  }

  private parseComparison(): EvalValue {
    let left = this.parseAddSub()
    while (this.peek().type === 'CMP') {
      const op = this.next().value
      const right = this.parseAddSub()
      const bothNumbers = left.type === 'number' && right.type === 'number'
      const l = bothNumbers ? left.value : left.type === 'string' ? left.value : String(left.value)
      const r = bothNumbers ? right.value : right.type === 'string' ? right.value : String(right.value)
      let res = false
      if (op === '=') res = bothNumbers ? Math.abs((l as number) - (r as number)) < 1e-10 : l === r
      else if (op === '<>' || op === '!=') res = bothNumbers ? Math.abs((l as number) - (r as number)) >= 1e-10 : l !== r
      else if (op === '<') res = l < r
      else if (op === '<=') res = l <= r
      else if (op === '>') res = l > r
      else if (op === '>=') res = l >= r
      left = { type: 'boolean', value: res }
    }
    return left
  }

  private parseAddSub(): EvalValue {
    let left = this.parseMulDiv()
    while (this.peek().type === 'OP' && (this.peek().value === '+' || this.peek().value === '-')) {
      const op = this.next().value
      const right = this.parseMulDiv()
      const a = toNumber(left, `operación "${op}"`)
      const b = toNumber(right, `operación "${op}"`)
      const val = op === '+' ? a + b : a - b
      const isPercent =
        left.type === 'number' && right.type === 'number' && Boolean(left.isPercent) && Boolean(right.isPercent)
      const isCurrency =
        (left.type === 'number' && Boolean(left.isCurrency)) ||
        (right.type === 'number' && Boolean(right.isCurrency))
      const currencySymbol =
        (left.type === 'number' && left.currencySymbol) ||
        (right.type === 'number' && right.currencySymbol) ||
        null
      left = { type: 'number', value: val, isPercent, isCurrency, currencySymbol }
    }
    return left
  }

  private parseMulDiv(): EvalValue {
    let left = this.parsePower()
    while (this.peek().type === 'OP' && (this.peek().value === '*' || this.peek().value === '/')) {
      const op = this.next().value
      const right = this.parsePower()
      const a = toNumber(left, `operación "${op}"`)
      const b = toNumber(right, `operación "${op}"`)
      if (op === '/' && Math.abs(b) < 1e-15) {
        throw new FormulaError('#DIV/0!', 'División entre cero')
      }
      const val = op === '*' ? a * b : a / b
      if (!Number.isFinite(val)) {
        throw new FormulaError('#NUM!', 'Resultado numérico fuera de rango')
      }
      const isCurrency =
        (left.type === 'number' && Boolean(left.isCurrency)) ||
        (right.type === 'number' && Boolean(right.isCurrency))
      const currencySymbol =
        (left.type === 'number' && left.currencySymbol) ||
        (right.type === 'number' && right.currencySymbol) ||
        null
      left = { type: 'number', value: val, isPercent: false, isCurrency, currencySymbol }
    }
    return left
  }

  private parsePower(): EvalValue {
    let base = this.parseUnary()
    if (this.peek().type === 'OP' && this.peek().value === '^') {
      this.next()
      const exp = this.parsePower() // right-associative
      const a = toNumber(base, 'potencia "^"')
      const b = toNumber(exp, 'potencia "^"')
      const val = Math.pow(a, b)
      if (!Number.isFinite(val)) {
        throw new FormulaError('#NUM!', 'Resultado de potencia inválido')
      }
      base = { type: 'number', value: val }
    }
    return base
  }

  private parseUnary(): EvalValue {
    if (this.peek().type === 'OP' && (this.peek().value === '+' || this.peek().value === '-')) {
      const op = this.next().value
      const inner = this.parseUnary()
      const n = toNumber(inner, `operador unario "${op}"`)
      return {
        type: 'number',
        value: op === '-' ? -n : n,
        isPercent: inner.type === 'number' ? inner.isPercent : false,
        isCurrency: inner.type === 'number' ? inner.isCurrency : false,
        currencySymbol: inner.type === 'number' ? inner.currencySymbol : null
      }
    }
    return this.parsePostfix()
  }

  private parsePostfix(): EvalValue {
    let val = this.parsePrimary()
    while (this.peek().type === 'PERCENT') {
      this.next()
      const n = toNumber(val, 'porcentaje "%"')
      val = { type: 'number', value: n / 100, isPercent: true }
    }
    return val
  }

  private parsePrimary(): EvalValue {
    const tok = this.peek()

    if (tok.type === 'NUMBER') {
      this.next()
      return { type: 'number', value: parseFloat(tok.value) }
    }

    if (tok.type === 'STRING') {
      this.next()
      return { type: 'string', value: tok.value }
    }

    if (tok.type === 'LPAREN') {
      this.next()
      const val = this.parseComparison()
      if (this.peek().type !== 'RPAREN') {
        throw new FormulaError('#SYNTAX!', 'Falta paréntesis de cierre ")"')
      }
      this.next()
      return val
    }

    if (tok.type === 'CELL') {
      this.next()
      const ref = parseCellRef(tok.value)
      if (!ref || ref.row >= this.ctx.rows || ref.col >= this.ctx.cols) {
        throw new FormulaError('#REF!', `La celda ${tok.value} está fuera de la tabla`)
      }
      if (this.peek().type === 'COLON') {
        throw new FormulaError('#SYNTAX!', 'Los rangos (ej. B2:B4) deben usarse dentro de una función como SUM(B2:B4)')
      }
      const resolved = this.ctx.resolveCell(ref.row, ref.col)
      if (resolved.kind === 'number') {
        return {
          type: 'number',
          value: resolved.value,
          isPercent: resolved.isPercent,
          isCurrency: resolved.isCurrency,
          currencySymbol: resolved.currencySymbol
        }
      }
      if (resolved.kind === 'empty') {
        return { type: 'number', value: 0 }
      }
      return { type: 'string', value: resolved.raw }
    }

    if (tok.type === 'IDENT') {
      this.next()
      // Boolean literals
      if (tok.value === 'TRUE' || tok.value === 'VERDADERO') {
        return { type: 'boolean', value: true }
      }
      if (tok.value === 'FALSE' || tok.value === 'FALSO') {
        return { type: 'boolean', value: false }
      }
      if (tok.value === 'PI' && this.peek().type !== 'LPAREN') {
        return { type: 'number', value: Math.PI }
      }
      if (this.peek().type !== 'LPAREN') {
        throw new FormulaError('#NAME?', `Nombre o función desconocida "${tok.value}"`)
      }
      this.next() // consume '('
      return this.parseFunctionCall(tok.value)
    }

    throw new FormulaError('#SYNTAX!', `Se esperaba un número, celda o función cerca de "${tok.value || 'fin'}"`)
  }

  private parseFunctionCall(fnName: string): EvalValue {
    // Special lazy handling for IFERROR / SI.ERROR so errors in first arg can be caught
    if (fnName === 'IFERROR' || fnName === 'SI.ERROR') {
      let firstVal: EvalValue | null = null
      let hadError = false
      try {
        firstVal = this.parseComparison()
      } catch (err) {
        if (err instanceof FormulaError) {
          hadError = true
          // Skip tokens until SEP at paren depth 0
          let depth = 0
          while (this.peek().type !== 'EOF') {
            const t = this.peek()
            if (t.type === 'LPAREN') depth++
            else if (t.type === 'RPAREN') {
              if (depth === 0) break
              depth--
            } else if (t.type === 'SEP' && depth === 0) {
              break
            }
            this.next()
          }
        } else {
          throw err
        }
      }
      if (this.peek().type !== 'SEP') {
        throw new FormulaError('#ARGS!', `${fnName} requiere 2 argumentos: ${fnName}(valor, valor_si_error)`)
      }
      this.next()
      const fallbackVal = this.parseComparison()
      if (this.peek().type !== 'RPAREN') {
        throw new FormulaError('#SYNTAX!', `Falta ")" al cerrar ${fnName}`)
      }
      this.next()
      return hadError ? fallbackVal : (firstVal as EvalValue)
    }

    const args: FnArg[] = []
    if (this.peek().type !== 'RPAREN') {
      while (true) {
        // Check if this argument is a range: CELL : CELL
        if (
          this.peek().type === 'CELL' &&
          this.tokens[this.idx + 1]?.type === 'COLON' &&
          this.tokens[this.idx + 2]?.type === 'CELL'
        ) {
          const startTok = this.next()
          this.next() // ':'
          const endTok = this.next()
          const startRef = parseCellRef(startTok.value)
          const endRef = parseCellRef(endTok.value)
          if (
            !startRef ||
            !endRef ||
            startRef.row >= this.ctx.rows ||
            startRef.col >= this.ctx.cols ||
            endRef.row >= this.ctx.rows ||
            endRef.col >= this.ctx.cols
          ) {
            throw new FormulaError(
              '#REF!',
              `El rango ${startTok.value}:${endTok.value} contiene celdas fuera de la tabla`
            )
          }
          const minR = Math.min(startRef.row, endRef.row)
          const maxR = Math.max(startRef.row, endRef.row)
          const minC = Math.min(startRef.col, endRef.col)
          const maxC = Math.max(startRef.col, endRef.col)
          const cells: RangeArg['cells'] = []
          for (let r = minR; r <= maxR; r++) {
            for (let c = minC; c <= maxC; c++) {
              cells.push(this.ctx.resolveCell(r, c))
            }
          }
          args.push({ type: 'range', cells })
        } else {
          args.push(this.parseComparison())
        }

        if (this.peek().type === 'SEP') {
          this.next()
          continue
        }
        break
      }
    }

    if (this.peek().type !== 'RPAREN') {
      throw new FormulaError('#SYNTAX!', `Falta ")" al cerrar ${fnName}`)
    }
    this.next() // consume ')'

    return evaluateFunction(fnName, args)
  }
}

// ============================================================================
// Built-in Excel Functions (English + Spanish)
// ============================================================================

function collectNumbers(args: FnArg[]): {
  nums: number[]
  allPercent: boolean
  anyCurrency: boolean
  currencySymbol: string | null
} {
  const nums: number[] = []
  let percentCount = 0
  let anyCurrency = false
  let currencySymbol: string | null = null

  for (const arg of args) {
    if (arg.type === 'range') {
      for (const cell of arg.cells) {
        if (cell.kind === 'number') {
          nums.push(cell.value)
          if (cell.isPercent) percentCount++
          if (cell.isCurrency) {
            anyCurrency = true
            if (!currencySymbol && cell.currencySymbol) currencySymbol = cell.currencySymbol
          }
        }
      }
    } else if (arg.type === 'number') {
      nums.push(arg.value)
      if (arg.isPercent) percentCount++
      if (arg.isCurrency) {
        anyCurrency = true
        if (!currencySymbol && arg.currencySymbol) currencySymbol = arg.currencySymbol
      }
    } else if (arg.type === 'boolean') {
      nums.push(arg.value ? 1 : 0)
    } else if (arg.type === 'string') {
      const parsed = parseNumericCellValue(arg.value)
      if (parsed.kind === 'number') {
        nums.push(parsed.value)
        if (parsed.isPercent) percentCount++
        if (parsed.isCurrency) {
          anyCurrency = true
          if (!currencySymbol && parsed.currencySymbol) currencySymbol = parsed.currencySymbol
        }
      }
    }
  }

  return {
    nums,
    allPercent: nums.length > 0 && percentCount === nums.length,
    anyCurrency,
    currencySymbol
  }
}

function requireEvalValue(arg: FnArg | undefined, fnName: string): EvalValue {
  if (!arg || arg.type === 'range') {
    throw new FormulaError('#ARGS!', `${fnName} espera un valor individual, no un rango`)
  }
  return arg
}

function evaluateFunction(name: string, args: FnArg[]): EvalValue {
  switch (name) {
    case 'SUM':
    case 'SUMA': {
      if (args.length === 0) throw new FormulaError('#ARGS!', `${name} requiere al menos 1 argumento`)
      const { nums, allPercent, anyCurrency, currencySymbol } = collectNumbers(args)
      const total = nums.reduce((acc, n) => acc + n, 0)
      return { type: 'number', value: total, isPercent: allPercent, isCurrency: anyCurrency, currencySymbol }
    }

    case 'AVERAGE':
    case 'AVG':
    case 'PROMEDIO': {
      if (args.length === 0) throw new FormulaError('#ARGS!', `${name} requiere al menos 1 argumento`)
      const { nums, allPercent, anyCurrency, currencySymbol } = collectNumbers(args)
      if (nums.length === 0) {
        throw new FormulaError('#DIV/0!', `${name} no encontró valores numéricos para promediar`)
      }
      const avg = nums.reduce((acc, n) => acc + n, 0) / nums.length
      return { type: 'number', value: avg, isPercent: allPercent, isCurrency: anyCurrency, currencySymbol }
    }

    case 'PRODUCT':
    case 'PRODUCTO': {
      if (args.length === 0) throw new FormulaError('#ARGS!', `${name} requiere al menos 1 argumento`)
      const { nums, anyCurrency, currencySymbol } = collectNumbers(args)
      if (nums.length === 0) return { type: 'number', value: 0 }
      const prod = nums.reduce((acc, n) => acc * n, 1)
      if (!Number.isFinite(prod)) throw new FormulaError('#NUM!', 'Desbordamiento numérico en PRODUCTO')
      return { type: 'number', value: prod, isCurrency: anyCurrency, currencySymbol }
    }

    case 'MIN': {
      if (args.length === 0) throw new FormulaError('#ARGS!', 'MIN requiere al menos 1 argumento')
      const { nums, allPercent, anyCurrency, currencySymbol } = collectNumbers(args)
      if (nums.length === 0) return { type: 'number', value: 0 }
      return {
        type: 'number',
        value: Math.min(...nums),
        isPercent: allPercent,
        isCurrency: anyCurrency,
        currencySymbol
      }
    }

    case 'MAX': {
      if (args.length === 0) throw new FormulaError('#ARGS!', 'MAX requiere al menos 1 argumento')
      const { nums, allPercent, anyCurrency, currencySymbol } = collectNumbers(args)
      if (nums.length === 0) return { type: 'number', value: 0 }
      return {
        type: 'number',
        value: Math.max(...nums),
        isPercent: allPercent,
        isCurrency: anyCurrency,
        currencySymbol
      }
    }

    case 'MEDIAN':
    case 'MEDIANA': {
      if (args.length === 0) throw new FormulaError('#ARGS!', `${name} requiere al menos 1 argumento`)
      const { nums, allPercent, anyCurrency, currencySymbol } = collectNumbers(args)
      if (nums.length === 0) throw new FormulaError('#NUM!', `${name} no encontró valores numéricos`)
      const sorted = [...nums].sort((a, b) => a - b)
      const mid = Math.floor(sorted.length / 2)
      const med = sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid]
      return { type: 'number', value: med, isPercent: allPercent, isCurrency: anyCurrency, currencySymbol }
    }

    case 'COUNT':
    case 'CONTAR': {
      const { nums } = collectNumbers(args)
      return { type: 'number', value: nums.length }
    }

    case 'COUNTA':
    case 'CONTARA': {
      let count = 0
      for (const arg of args) {
        if (arg.type === 'range') {
          for (const cell of arg.cells) {
            if (cell.kind !== 'empty') count++
          }
        } else if (arg.type === 'string') {
          if (arg.value.trim() !== '') count++
        } else {
          count++
        }
      }
      return { type: 'number', value: count }
    }

    case 'ROUND':
    case 'REDONDEAR': {
      if (args.length < 1 || args.length > 2) {
        throw new FormulaError('#ARGS!', `${name} requiere 1 o 2 argumentos: ${name}(número, decimales)`)
      }
      const numVal = requireEvalValue(args[0], name)
      const n = toNumber(numVal, name)
      const decimals = args.length === 2 ? Math.trunc(toNumber(requireEvalValue(args[1], name), name)) : 0
      const factor = Math.pow(10, decimals)
      return {
        type: 'number',
        value: Math.round(n * factor) / factor,
        isPercent: numVal.type === 'number' ? numVal.isPercent : false,
        isCurrency: numVal.type === 'number' ? numVal.isCurrency : false,
        currencySymbol: numVal.type === 'number' ? numVal.currencySymbol : null
      }
    }

    case 'ABS': {
      if (args.length !== 1) throw new FormulaError('#ARGS!', 'ABS requiere 1 argumento')
      const numVal = requireEvalValue(args[0], 'ABS')
      return {
        type: 'number',
        value: Math.abs(toNumber(numVal, 'ABS')),
        isPercent: numVal.type === 'number' ? numVal.isPercent : false,
        isCurrency: numVal.type === 'number' ? numVal.isCurrency : false,
        currencySymbol: numVal.type === 'number' ? numVal.currencySymbol : null
      }
    }

    case 'SQRT':
    case 'RAIZ': {
      if (args.length !== 1) throw new FormulaError('#ARGS!', `${name} requiere 1 argumento`)
      const n = toNumber(requireEvalValue(args[0], name), name)
      if (n < 0) throw new FormulaError('#NUM!', `No se puede calcular la raíz de un número negativo (${n})`)
      return { type: 'number', value: Math.sqrt(n) }
    }

    case 'POWER':
    case 'POTENCIA': {
      if (args.length !== 2) throw new FormulaError('#ARGS!', `${name} requiere 2 argumentos: ${name}(base, exponente)`)
      const base = toNumber(requireEvalValue(args[0], name), name)
      const exp = toNumber(requireEvalValue(args[1], name), name)
      const res = Math.pow(base, exp)
      if (!Number.isFinite(res)) throw new FormulaError('#NUM!', 'Resultado numérico inválido')
      return { type: 'number', value: res }
    }

    case 'MOD':
    case 'RESIDUO': {
      if (args.length !== 2) throw new FormulaError('#ARGS!', `${name} requiere 2 argumentos`)
      const a = toNumber(requireEvalValue(args[0], name), name)
      const b = toNumber(requireEvalValue(args[1], name), name)
      if (Math.abs(b) < 1e-15) throw new FormulaError('#DIV/0!', 'División entre cero en MOD')
      return { type: 'number', value: a % b }
    }

    case 'INT':
    case 'ENTERO': {
      if (args.length !== 1) throw new FormulaError('#ARGS!', `${name} requiere 1 argumento`)
      return { type: 'number', value: Math.floor(toNumber(requireEvalValue(args[0], name), name)) }
    }

    case 'IF':
    case 'SI': {
      if (args.length < 2 || args.length > 3) {
        throw new FormulaError('#ARGS!', `${name} requiere 2 o 3 argumentos: ${name}(condición, si_verdadero, si_falso)`)
      }
      const cond = toBoolean(requireEvalValue(args[0], name))
      if (cond) return requireEvalValue(args[1], name)
      if (args.length === 3) return requireEvalValue(args[2], name)
      return { type: 'boolean', value: false }
    }

    default:
      throw new FormulaError('#NAME?', `Función desconocida "${name}"`)
  }
}

// ============================================================================
// Full Table Grid Evaluation (with Cycle Detection & Memoization)
// ============================================================================

export function evaluateTableGrid(grid: TableCellInput[][]): TableEvaluationResult {
  const rows = grid.length
  const cols = rows > 0 ? Math.max(...grid.map((r) => r.length)) : 0

  type CacheEntry = {
    evalCell: EvaluatedCell
    resolved: {
      kind: 'number' | 'empty' | 'text'
      value: number
      raw: string
      isPercent: boolean
      isCurrency: boolean
      currencySymbol: string | null
    }
    thrownError?: FormulaError
  }

  const cache = new Map<string, CacheEntry>()
  const visiting = new Set<string>()
  const errors: TableErrorEntry[] = []

  const evaluateOne = (r: number, c: number): CacheEntry => {
    const key = `${r}:${c}`
    const cached = cache.get(key)
    if (cached) return cached

    const input = grid[r]?.[c] ?? { text: '', formula: null, format: 'auto' }
    const ref = formatCellRef(c, r)
    const rawFormula = input.formula?.trim() || null
    const explicitFormat: CellFormat = input.format || 'auto'

    // Non-formula cell
    if (!rawFormula || !rawFormula.startsWith('=')) {
      const parsed = parseNumericCellValue(input.text)
      const inferredFormat: CellFormat =
        explicitFormat !== 'auto'
          ? explicitFormat
          : parsed.isPercent
            ? 'percent'
            : parsed.isCurrency
              ? 'currency'
              : 'auto'

      const entry: CacheEntry = {
        evalCell: {
          row: r,
          col: c,
          ref,
          isFormula: false,
          formula: null,
          displayText: input.text,
          numericValue: parsed.kind === 'number' ? parsed.value : null,
          stringValue: parsed.kind === 'text' ? parsed.raw : null,
          inferredFormat,
          currencySymbol: parsed.currencySymbol,
          errorCode: null,
          errorMessage: null
        },
        resolved: {
          kind: parsed.kind,
          value: parsed.value,
          raw: parsed.raw,
          isPercent: parsed.isPercent,
          isCurrency: parsed.isCurrency,
          currencySymbol: parsed.currencySymbol
        }
      }
      cache.set(key, entry)
      return entry
    }

    // Circular reference check
    if (visiting.has(key)) {
      throw new FormulaError('#CIRC!', `Referencia circular detectada en la celda ${ref}`)
    }

    visiting.add(key)
    try {
      const tokens = tokenizeFormula(rawFormula.slice(1))
      const parser = new FormulaParser(tokens, {
        rows,
        cols,
        resolveCell: (tr, tc) => {
          const target = evaluateOne(tr, tc)
          if (target.thrownError) {
            throw target.thrownError
          }
          return target.resolved
        }
      })

      const val = parser.parse()
      visiting.delete(key)

      if (val.type === 'number') {
        const inferredFormat: CellFormat =
          explicitFormat !== 'auto'
            ? explicitFormat
            : val.isPercent
              ? 'percent'
              : val.isCurrency
                ? 'currency'
                : 'auto'
        const displayText = formatCalculatedValue(val.value, inferredFormat, val.currencySymbol)
        const entry: CacheEntry = {
          evalCell: {
            row: r,
            col: c,
            ref,
            isFormula: true,
            formula: rawFormula,
            displayText,
            numericValue: val.value,
            stringValue: null,
            inferredFormat,
            currencySymbol: val.currencySymbol || null,
            errorCode: null,
            errorMessage: null
          },
          resolved: {
            kind: 'number',
            value: val.value,
            raw: displayText,
            isPercent: inferredFormat === 'percent' || Boolean(val.isPercent),
            isCurrency: inferredFormat === 'currency' || Boolean(val.isCurrency),
            currencySymbol: val.currencySymbol || null
          }
        }
        cache.set(key, entry)
        return entry
      }

      if (val.type === 'boolean') {
        const displayText = val.value ? 'VERDADERO' : 'FALSO'
        const entry: CacheEntry = {
          evalCell: {
            row: r,
            col: c,
            ref,
            isFormula: true,
            formula: rawFormula,
            displayText,
            numericValue: val.value ? 1 : 0,
            stringValue: displayText,
            inferredFormat: 'auto',
            currencySymbol: null,
            errorCode: null,
            errorMessage: null
          },
          resolved: {
            kind: 'text',
            value: NaN,
            raw: displayText,
            isPercent: false,
            isCurrency: false,
            currencySymbol: null
          }
        }
        cache.set(key, entry)
        return entry
      }

      // String result
      const entry: CacheEntry = {
        evalCell: {
          row: r,
          col: c,
          ref,
          isFormula: true,
          formula: rawFormula,
          displayText: val.value,
          numericValue: null,
          stringValue: val.value,
          inferredFormat: 'auto',
          currencySymbol: null,
          errorCode: null,
          errorMessage: null
        },
        resolved: {
          kind: 'text',
          value: NaN,
          raw: val.value,
          isPercent: false,
          isCurrency: false,
          currencySymbol: null
        }
      }
      cache.set(key, entry)
      return entry
    } catch (err) {
      visiting.delete(key)
      const fErr =
        err instanceof FormulaError
          ? err
          : new FormulaError('#SYNTAX!', err instanceof Error ? err.message : 'Error al evaluar la fórmula')

      const entry: CacheEntry = {
        evalCell: {
          row: r,
          col: c,
          ref,
          isFormula: true,
          formula: rawFormula,
          displayText: fErr.code,
          numericValue: null,
          stringValue: null,
          inferredFormat: 'auto',
          currencySymbol: null,
          errorCode: fErr.code,
          errorMessage: fErr.detail
        },
        resolved: {
          kind: 'text',
          value: NaN,
          raw: fErr.code,
          isPercent: false,
          isCurrency: false,
          currencySymbol: null
        },
        thrownError: fErr
      }
      cache.set(key, entry)
      return entry
    }
  }

  const cells: EvaluatedCell[][] = []
  for (let r = 0; r < rows; r++) {
    const rowCells: EvaluatedCell[] = []
    for (let c = 0; c < (grid[r]?.length ?? 0); c++) {
      const entry = evaluateOne(r, c)
      rowCells.push(entry.evalCell)
      if (entry.evalCell.errorCode && entry.evalCell.formula) {
        errors.push({
          row: r,
          col: c,
          ref: entry.evalCell.ref,
          code: entry.evalCell.errorCode,
          message: entry.evalCell.errorMessage || entry.evalCell.errorCode,
          formula: entry.evalCell.formula
        })
      }
    }
    cells.push(rowCells)
  }

  return { cells, errors }
}

// ============================================================================
// Formula Function Catalog (for Formula Bar autocomplete & quick insert)
// ============================================================================

export interface FormulaCatalogItem {
  name: string
  syntax: string
  description: string
}

export const FORMULA_CATALOG: FormulaCatalogItem[] = [
  { name: 'SUM', syntax: 'SUM(B2:B5)', description: 'Suma todos los números de un rango o lista (alias: SUMA)' },
  { name: 'PRODUCT', syntax: 'PRODUCT(B2:C2)', description: 'Multiplica los valores indicados (alias: PRODUCTO)' },
  { name: 'AVERAGE', syntax: 'AVERAGE(C2:C5)', description: 'Calcula el promedio aritmético (alias: PROMEDIO)' },
  { name: 'MIN', syntax: 'MIN(C2:C5)', description: 'Devuelve el valor mínimo del rango' },
  { name: 'MAX', syntax: 'MAX(C2:C5)', description: 'Devuelve el valor máximo del rango' },
  { name: 'COUNT', syntax: 'COUNT(C2:C5)', description: 'Cuenta cuántas celdas contienen números (alias: CONTAR)' },
  { name: 'ROUND', syntax: 'ROUND(C2/2, 2)', description: 'Redondea a los decimales indicados (alias: REDONDEAR)' },
  { name: 'IF', syntax: 'IF(B5=1, "OK", "Revisar")', description: 'Evalúa una condición (alias: SI)' },
  { name: 'IFERROR', syntax: 'IFERROR(C2/D2, 0)', description: 'Devuelve un valor alternativo si hay error (alias: SI.ERROR)' },
  { name: 'SQRT', syntax: 'SQRT(C2)', description: 'Calcula la raíz cuadrada (alias: RAIZ)' },
  { name: 'ABS', syntax: 'ABS(C2-D2)', description: 'Valor absoluto de un número' },
  { name: 'MEDIAN', syntax: 'MEDIAN(C2:C5)', description: 'Calcula la mediana de un rango (alias: MEDIANA)' }
]
