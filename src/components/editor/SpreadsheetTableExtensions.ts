import { Table } from '@tiptap/extension-table'
import { TableCell } from '@tiptap/extension-table-cell'
import { TableHeader } from '@tiptap/extension-table-header'
import { Plugin, PluginKey, TextSelection } from '@tiptap/pm/state'
import { Decoration, DecorationSet } from '@tiptap/pm/view'
import type { Node as PMNode, Mark as PMMark } from '@tiptap/pm/model'
import type { Editor } from '@tiptap/react'
import {
  colIndexToLetter,
  evaluateTableGrid,
  extractFormulaReferences,
  formatCalculatedValue,
  formatCellRef,
  parseNumericCellValue,
  type CellFormat,
  type FormulaErrorCode,
  type TableCellInput,
  type TableErrorEntry
} from '../../lib/tableFormulaEngine'

export const SPREADSHEET_PLUGIN_KEY = new PluginKey('sevenSpreadsheetTable')
export const SPREADSHEET_RECALC_META = 'sevenSpreadsheetRecalc'

export type CellBgKey = 'amber' | 'emerald' | 'sky' | 'violet' | 'rose' | 'neutral'
export type CellAlignKey = 'left' | 'center' | 'right'

export interface TableCellCoords {
  pos: number
  node: PMNode
  row: number
  col: number
  colspan: number
  text: string
  formula: string | null
  cellFormat: CellFormat
  cellBg: CellBgKey | null
  cellAlign: CellAlignKey | null
  cellError: FormulaErrorCode | null
  cellErrorMsg: string | null
}

export interface ActiveTableSnapshot {
  tablePos: number
  rowCount: number
  colCount: number
  showCoords: boolean
  activeRow: number
  activeCol: number
  activeCellPos: number
  activeCellRef: string
  activeFormula: string | null
  activeText: string
  activeFormat: CellFormat
  activeBg: CellBgKey | null
  activeAlign: CellAlignKey | null
  activeError: FormulaErrorCode | null
  activeErrorMsg: string | null
  hasHeaderRow: boolean
  errors: TableErrorEntry[]
  formulaCount: number
}

// ============================================================================
// Shared Cell Attributes for TableCell & TableHeader
// ============================================================================

const spreadsheetCellAttributes = {
  formula: {
    default: null as string | null,
    parseHTML: (el: HTMLElement) => el.getAttribute('data-formula') || null,
    renderHTML: (attrs: Record<string, any>) =>
      attrs.formula ? { 'data-formula': attrs.formula } : {}
  },
  cellFormat: {
    default: 'auto' as CellFormat,
    parseHTML: (el: HTMLElement) => (el.getAttribute('data-format') as CellFormat) || 'auto',
    renderHTML: (attrs: Record<string, any>) =>
      attrs.cellFormat && attrs.cellFormat !== 'auto' ? { 'data-format': attrs.cellFormat } : {}
  },
  cellBg: {
    default: null as CellBgKey | null,
    parseHTML: (el: HTMLElement) => (el.getAttribute('data-bg') as CellBgKey) || null,
    renderHTML: (attrs: Record<string, any>) => (attrs.cellBg ? { 'data-bg': attrs.cellBg } : {})
  },
  cellAlign: {
    default: null as CellAlignKey | null,
    parseHTML: (el: HTMLElement) => (el.getAttribute('data-align') as CellAlignKey) || null,
    renderHTML: (attrs: Record<string, any>) =>
      attrs.cellAlign ? { 'data-align': attrs.cellAlign } : {}
  },
  cellError: {
    default: null as FormulaErrorCode | null,
    parseHTML: (el: HTMLElement) => (el.getAttribute('data-error') as FormulaErrorCode) || null,
    renderHTML: (attrs: Record<string, any>) =>
      attrs.cellError ? { 'data-error': attrs.cellError } : {}
  },
  cellErrorMsg: {
    default: null as string | null,
    parseHTML: (el: HTMLElement) => el.getAttribute('data-error-msg') || null,
    renderHTML: (attrs: Record<string, any>) =>
      attrs.cellErrorMsg ? { 'data-error-msg': attrs.cellErrorMsg } : {}
  }
}

export const SpreadsheetTableCell = TableCell.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      ...spreadsheetCellAttributes
    }
  }
})

export const SpreadsheetTableHeader = TableHeader.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      ...spreadsheetCellAttributes
    }
  }
})

// ============================================================================
// Table Structure Extraction Helpers
// ============================================================================

function getCellText(cellNode: PMNode): string {
  return cellNode.textBetween(0, cellNode.content.size, '\n').trim()
}

function getFirstTextMarks(cellNode: PMNode): readonly PMMark[] {
  let found: readonly PMMark[] = []
  cellNode.descendants((node) => {
    if (found.length > 0) return false
    if (node.isText && node.marks.length > 0) {
      found = node.marks
      return false
    }
    return true
  })
  return found
}

function extractTableCells(tableNode: PMNode, tablePos: number): {
  rows: TableCellCoords[][]
  flat: TableCellCoords[]
  rowCount: number
  colCount: number
} {
  const rows: TableCellCoords[][] = []
  const flat: TableCellCoords[] = []
  let maxCols = 0

  let rowOffset = tablePos + 1
  for (let r = 0; r < tableNode.childCount; r++) {
    const rowNode = tableNode.child(r)
    const rowCells: TableCellCoords[] = []
    let colCursor = 0
    let cellOffset = rowOffset + 1

    for (let i = 0; i < rowNode.childCount; i++) {
      const cellNode = rowNode.child(i)
      const colspan = Math.max(1, Number(cellNode.attrs.colspan) || 1)
      const item: TableCellCoords = {
        pos: cellOffset,
        node: cellNode,
        row: r,
        col: colCursor,
        colspan,
        text: getCellText(cellNode),
        formula: cellNode.attrs.formula || null,
        cellFormat: (cellNode.attrs.cellFormat as CellFormat) || 'auto',
        cellBg: (cellNode.attrs.cellBg as CellBgKey) || null,
        cellAlign: (cellNode.attrs.cellAlign as CellAlignKey) || null,
        cellError: (cellNode.attrs.cellError as FormulaErrorCode) || null,
        cellErrorMsg: cellNode.attrs.cellErrorMsg || null
      }
      rowCells.push(item)
      flat.push(item)
      colCursor += colspan
      cellOffset += cellNode.nodeSize
    }

    if (colCursor > maxCols) maxCols = colCursor
    rows.push(rowCells)
    rowOffset += rowNode.nodeSize
  }

  return { rows, flat, rowCount: rows.length, colCount: maxCols }
}

function buildGridForEvaluation(
  rows: TableCellCoords[][],
  colCount: number
): { grid: TableCellInput[][]; cellMap: Map<string, TableCellCoords> } {
  const grid: TableCellInput[][] = []
  const cellMap = new Map<string, TableCellCoords>()

  for (let r = 0; r < rows.length; r++) {
    const rowInputs: TableCellInput[] = Array.from({ length: colCount }, () => ({
      text: '',
      formula: null,
      format: 'auto'
    }))
    for (const cell of rows[r]) {
      rowInputs[cell.col] = {
        text: cell.text,
        formula: cell.formula,
        format: cell.cellFormat
      }
      cellMap.set(`${r}:${cell.col}`, cell)
    }
    grid.push(rowInputs)
  }

  return { grid, cellMap }
}

function findEnclosingTableAndCell(
  doc: PMNode,
  pos: number
): { tablePos: number; tableNode: PMNode; cellPos: number; cellNode: PMNode } | null {
  try {
    const $pos = doc.resolve(pos)
    let tablePos = -1
    let tableNode: PMNode | null = null
    let cellPos = -1
    let cellNode: PMNode | null = null

    for (let d = $pos.depth; d >= 0; d--) {
      const node = $pos.node(d)
      if (cellPos === -1 && (node.type.name === 'tableCell' || node.type.name === 'tableHeader')) {
        cellPos = $pos.before(d)
        cellNode = node
      }
      if (node.type.name === 'table') {
        tablePos = $pos.before(d)
        tableNode = node
        break
      }
    }

    if (tablePos !== -1 && tableNode && cellPos !== -1 && cellNode) {
      return { tablePos, tableNode, cellPos, cellNode }
    }
  } catch {
    // Invalid position
  }
  return null
}

// ============================================================================
// SpreadsheetTable Extension (ProseMirror Plugin for Live Formulas + Excel UX)
// ============================================================================

export const SpreadsheetTable = Table.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      showCoords: {
        default: true,
        parseHTML: (el: HTMLElement) => el.getAttribute('data-show-coords') !== 'false',
        renderHTML: (attrs: Record<string, any>) =>
          attrs.showCoords === false ? { 'data-show-coords': 'false' } : {}
      }
    }
  },

  addProseMirrorPlugins() {
    const parentPlugins = this.parent?.() ?? []

    const spreadsheetPlugin = new Plugin({
      key: SPREADSHEET_PLUGIN_KEY,

      props: {
        decorations(state) {
          const decorations: Decoration[] = []
          const active = findEnclosingTableAndCell(state.doc, state.selection.from)
          let activeFormulaRefs = new Set<string>()
          let activeCellPos = active ? active.cellPos : -1

          state.doc.descendants((node, pos) => {
            if (node.type.name !== 'table') return true

            const isActiveTable = active?.tablePos === pos
            const showCoords = isActiveTable && node.attrs.showCoords !== false
            const { rows, flat } = extractTableCells(node, pos)

            if (showCoords) {
              decorations.push(
                Decoration.node(pos, pos + node.nodeSize, {
                  class: 'sn-table-coords-active'
                })
              )
            }

            if (isActiveTable && active) {
              const activeCell = flat.find((c) => c.pos === active.cellPos)
              const formulaSource =
                activeCell?.formula ||
                (activeCell?.text.startsWith('=') ? activeCell.text : null)
              if (formulaSource) {
                const refs = extractFormulaReferences(formulaSource, rows.length, 100)
                activeFormulaRefs = new Set(refs.map((r) => `${r.row}:${r.col}`))
              }
            }

            for (const cell of flat) {
              const attrs: Record<string, string> = {}
              const classes: string[] = []

              if (showCoords) {
                attrs['data-cell-ref'] = formatCellRef(cell.col, cell.row)
                if (cell.row === 0) {
                  attrs['data-col-label'] = colIndexToLetter(cell.col)
                }
                if (cell.col === 0) {
                  attrs['data-row-label'] = String(cell.row + 1)
                }
              }

              if (isActiveTable && cell.pos === activeCellPos) {
                classes.push('sn-cell-active')
              }

              if (isActiveTable && activeFormulaRefs.has(`${cell.row}:${cell.col}`)) {
                classes.push('sn-cell-ref-highlight')
              }

              if (cell.formula) {
                classes.push('sn-cell-formula')
                if (!cell.cellError) {
                  attrs['title'] = `Fórmula: ${cell.formula}`
                }
              }

              if (cell.cellError) {
                classes.push('sn-cell-error')
                attrs['title'] = `${cell.cellError} — ${cell.cellErrorMsg || 'Error de cálculo'}`
              }

              if (classes.length > 0) {
                attrs.class = classes.join(' ')
              }

              if (Object.keys(attrs).length > 0) {
                decorations.push(
                  Decoration.node(cell.pos, cell.pos + cell.node.nodeSize, attrs)
                )
              }
            }

            return false // don't descend into nested tables
          })

          return DecorationSet.create(state.doc, decorations)
        },

        handleKeyDown(view, event) {
          // Pressing Enter inside a cell whose raw text starts with '=' commits the formula immediately
          if (event.key === 'Enter' && !event.shiftKey) {
            const active = findEnclosingTableAndCell(view.state.doc, view.state.selection.from)
            if (active) {
              const rawText = getCellText(active.cellNode)
              if (rawText.startsWith('=') && rawText.length > 1) {
                event.preventDefault()
                const tr = view.state.tr
                tr.setNodeMarkup(active.cellPos, undefined, {
                  ...active.cellNode.attrs,
                  formula: rawText
                })
                view.dispatch(tr)

                // Move focus to the cell below if available (Excel behavior)
                const afterActive = findEnclosingTableAndCell(view.state.doc, view.state.selection.from)
                if (afterActive) {
                  const { rows } = extractTableCells(afterActive.tableNode, afterActive.tablePos)
                  let curRow = -1
                  let curCol = -1
                  for (const row of rows) {
                    const hit = row.find((c) => c.pos === afterActive.cellPos)
                    if (hit) {
                      curRow = hit.row
                      curCol = hit.col
                      break
                    }
                  }
                  if (curRow >= 0 && curRow + 1 < rows.length) {
                    const targetCell =
                      rows[curRow + 1].find((c) => c.col === curCol) || rows[curRow + 1][0]
                    if (targetCell) {
                      const nextTr = view.state.tr.setSelection(
                        TextSelection.near(view.state.doc.resolve(targetCell.pos + 1))
                      )
                      view.dispatch(nextTr)
                    }
                  }
                }
                return true
              }
            }
          }
          return false
        }
      },

      appendTransaction(transactions, oldState, newState) {
        if (transactions.some((t) => t.getMeta(SPREADSHEET_RECALC_META))) {
          return null
        }

        const docChanged = transactions.some((t) => t.docChanged)
        const oldActive = findEnclosingTableAndCell(oldState.doc, oldState.selection.from)
        const newActive = findEnclosingTableAndCell(newState.doc, newState.selection.from)
        const leftCell =
          oldActive && (!newActive || oldActive.cellPos !== newActive.cellPos)

        if (!docChanged && !leftCell) {
          return null
        }

        let tr = newState.tr
        let modified = false

        // 1. If the user left a cell whose raw text starts with '=', promote it to a formula!
        if (leftCell && oldActive) {
          // Map old cellPos into newState if doc also changed
          let mappedPos = oldActive.cellPos
          for (const t of transactions) {
            mappedPos = t.mapping.map(mappedPos)
          }
          const cellStillHere = findEnclosingTableAndCell(newState.doc, Math.min(mappedPos + 1, newState.doc.content.size))
          if (cellStillHere && cellStillHere.cellPos === mappedPos) {
            const rawText = getCellText(cellStillHere.cellNode)
            if (rawText.startsWith('=') && rawText.length > 1 && cellStillHere.cellNode.attrs.formula !== rawText) {
              tr.setNodeMarkup(cellStillHere.cellPos, undefined, {
                ...cellStillHere.cellNode.attrs,
                formula: rawText
              })
              modified = true
            }
          }
        }

        // 2. If user manually typed plain text (not starting with '=') inside a cell that previously had a formula,
        // clear the stale formula attribute so it behaves just like Excel.
        if (docChanged && newActive) {
          const curCell = newActive.cellNode
          if (curCell.attrs.formula) {
            // Check if the user actually typed inside this cell vs an external update
            const oldCellText = oldActive ? getCellText(oldActive.cellNode) : null
            const newCellText = getCellText(curCell)
            const formulaAttrChanged =
              oldActive && oldActive.cellNode.attrs.formula !== curCell.attrs.formula

            if (!formulaAttrChanged && oldActive && oldCellText !== newCellText) {
              if (newCellText.startsWith('=')) {
                // User started typing a new formula inline; clear old formula until Enter/blur
                tr.setNodeMarkup(newActive.cellPos, undefined, {
                  ...curCell.attrs,
                  formula: null,
                  cellError: null,
                  cellErrorMsg: null
                })
                modified = true
              } else {
                // User overwrote formula cell with plain text/number
                tr.setNodeMarkup(newActive.cellPos, undefined, {
                  ...curCell.attrs,
                  formula: null,
                  cellError: null,
                  cellErrorMsg: null
                })
                modified = true
              }
            }
          }
        }

        // 3. Re-evaluate every table that has at least one formula cell (or error cell to clear)
        const docToEval = modified ? tr.doc : newState.doc
        const updates: Array<{
          cellPos: number
          cellNode: PMNode
          newText: string
          errorCode: FormulaErrorCode | null
          errorMessage: string | null
        }> = []

        docToEval.descendants((node, pos) => {
          if (node.type.name !== 'table') return true

          const { rows, flat, colCount } = extractTableCells(node, pos)
          const hasAnyFormulaOrError = flat.some((c) => Boolean(c.formula) || Boolean(c.cellError))
          if (!hasAnyFormulaOrError) return false

          const { grid, cellMap } = buildGridForEvaluation(rows, colCount)
          const result = evaluateTableGrid(grid)

          for (let r = 0; r < result.cells.length; r++) {
            for (let c = 0; c < result.cells[r].length; c++) {
              const evalCell = result.cells[r][c]
              const cellCoords = cellMap.get(`${r}:${c}`)
              if (!cellCoords) continue

              if (!evalCell.isFormula) {
                // Clear stale error attributes on non-formula cells
                if (cellCoords.cellError || cellCoords.cellErrorMsg) {
                  updates.push({
                    cellPos: cellCoords.pos,
                    cellNode: cellCoords.node,
                    newText: cellCoords.text,
                    errorCode: null,
                    errorMessage: null
                  })
                }
                continue
              }

              const needsTextUpdate = cellCoords.text !== evalCell.displayText
              const needsErrorUpdate =
                cellCoords.cellError !== evalCell.errorCode ||
                cellCoords.cellErrorMsg !== evalCell.errorMessage

              if (needsTextUpdate || needsErrorUpdate) {
                updates.push({
                  cellPos: cellCoords.pos,
                  cellNode: cellCoords.node,
                  newText: evalCell.displayText,
                  errorCode: evalCell.errorCode,
                  errorMessage: evalCell.errorMessage
                })
              }
            }
          }

          return false
        })

        if (updates.length === 0 && !modified) {
          return null
        }

        // Apply updates in descending position order so positions never shift
        updates.sort((a, b) => b.cellPos - a.cellPos)
        const schema = newState.schema

        for (const upd of updates) {
          const currentNode = tr.doc.nodeAt(upd.cellPos)
          if (!currentNode) continue

          const currentText = getCellText(currentNode)
          if (currentText !== upd.newText) {
            const marks = getFirstTextMarks(currentNode)
            const paragraphType = schema.nodes.paragraph
            const textNode = upd.newText ? schema.text(upd.newText, marks) : null
            const newParagraph = paragraphType.create(null, textNode ? [textNode] : [])
            const contentStart = upd.cellPos + 1
            const contentEnd = upd.cellPos + currentNode.nodeSize - 1
            tr.replaceWith(contentStart, contentEnd, newParagraph)
          }

          const updatedNode = tr.doc.nodeAt(upd.cellPos)
          if (
            updatedNode &&
            (updatedNode.attrs.cellError !== upd.errorCode ||
              updatedNode.attrs.cellErrorMsg !== upd.errorMessage)
          ) {
            tr.setNodeMarkup(upd.cellPos, undefined, {
              ...updatedNode.attrs,
              cellError: upd.errorCode,
              cellErrorMsg: upd.errorMessage
            })
          }
          modified = true
        }

        if (!modified) return null

        tr.setMeta(SPREADSHEET_RECALC_META, true)
        tr.setMeta('addToHistory', false)
        return tr
      }
    })

    return [...parentPlugins, spreadsheetPlugin]
  }
})

// ============================================================================
// High-Level Table Inspection & Manipulation Commands (for Formula Bar & Toolbar)
// ============================================================================

export function getActiveTableSnapshot(editor: Editor | null): ActiveTableSnapshot | null {
  if (!editor || !editor.isActive('table')) return null

  const active = findEnclosingTableAndCell(editor.state.doc, editor.state.selection.from)
  if (!active) return null

  const { rows, flat, rowCount, colCount } = extractTableCells(active.tableNode, active.tablePos)
  const activeCell = flat.find((c) => c.pos === active.cellPos)
  if (!activeCell) return null

  const { grid } = buildGridForEvaluation(rows, colCount)
  const evalResult = evaluateTableGrid(grid)

  const hasHeaderRow =
    rows.length > 0 && rows[0].every((c) => c.node.type.name === 'tableHeader')

  const formulaCount = flat.filter((c) => Boolean(c.formula)).length

  return {
    tablePos: active.tablePos,
    rowCount,
    colCount,
    showCoords: active.tableNode.attrs.showCoords !== false,
    activeRow: activeCell.row,
    activeCol: activeCell.col,
    activeCellPos: activeCell.pos,
    activeCellRef: formatCellRef(activeCell.col, activeCell.row),
    activeFormula: activeCell.formula,
    activeText: activeCell.text,
    activeFormat: activeCell.cellFormat,
    activeBg: activeCell.cellBg,
    activeAlign: activeCell.cellAlign,
    activeError: activeCell.cellError,
    activeErrorMsg: activeCell.cellErrorMsg,
    hasHeaderRow,
    errors: evalResult.errors,
    formulaCount
  }
}

export function applyCellFormulaOrValue(editor: Editor, input: string): boolean {
  const active = findEnclosingTableAndCell(editor.state.doc, editor.state.selection.from)
  if (!active) return false

  const trimmed = input.trim()
  const { state, view } = editor
  const tr = state.tr

  if (trimmed.startsWith('=') && trimmed.length > 1) {
    tr.setNodeMarkup(active.cellPos, undefined, {
      ...active.cellNode.attrs,
      formula: trimmed
    })
    view.dispatch(tr)
    return true
  }

  // Plain value: clear formula and set cell text
  const marks = getFirstTextMarks(active.cellNode)
  const paragraph = state.schema.nodes.paragraph.create(
    null,
    input ? [state.schema.text(input, marks)] : []
  )
  tr.replaceWith(active.cellPos + 1, active.cellPos + active.cellNode.nodeSize - 1, paragraph)
  tr.setNodeMarkup(active.cellPos, undefined, {
    ...active.cellNode.attrs,
    formula: null,
    cellError: null,
    cellErrorMsg: null
  })
  view.dispatch(tr)
  return true
}

export function updateActiveCellAttrs(
  editor: Editor,
  attrs: Partial<{
    cellFormat: CellFormat
    cellBg: CellBgKey | null
    cellAlign: CellAlignKey | null
  }>
): boolean {
  const active = findEnclosingTableAndCell(editor.state.doc, editor.state.selection.from)
  if (!active) return false

  const { state, view } = editor
  const tr = state.tr
  const hasFormula = Boolean(active.cellNode.attrs.formula)

  // If changing format on a non-formula numeric cell, reformat its visible text immediately
  if (attrs.cellFormat && !hasFormula) {
    const rawText = getCellText(active.cellNode)
    const parsed = parseNumericCellValue(rawText)
    if (parsed.kind === 'number') {
      let formatted: string | null = null
      if (attrs.cellFormat === 'percent') {
        // Smart percent: "15" -> "15%", "0.15" -> "15%", "15%" -> "15%"
        const pctRatio = parsed.isPercent
          ? parsed.value
          : Math.abs(parsed.value) >= 1
            ? parsed.value / 100
            : parsed.value
        formatted = formatCalculatedValue(pctRatio, 'percent')
      } else if (attrs.cellFormat === 'currency') {
        const val = parsed.isPercent ? parsed.value * 100 : parsed.value
        formatted = formatCalculatedValue(val, 'currency', parsed.currencySymbol || '$')
      } else if (attrs.cellFormat === 'number') {
        const val = parsed.isPercent ? parsed.value * 100 : parsed.value
        formatted = formatCalculatedValue(val, 'number')
      }

      if (formatted !== null && formatted !== rawText) {
        const marks = getFirstTextMarks(active.cellNode)
        const paragraph = state.schema.nodes.paragraph.create(
          null,
          [state.schema.text(formatted, marks)]
        )
        tr.replaceWith(active.cellPos + 1, active.cellPos + active.cellNode.nodeSize - 1, paragraph)
      }
    }
  }

  tr.setNodeMarkup(active.cellPos, undefined, {
    ...active.cellNode.attrs,
    ...attrs
  })
  view.dispatch(tr)
  return true
}

export function toggleTableCoords(editor: Editor): boolean {
  const active = findEnclosingTableAndCell(editor.state.doc, editor.state.selection.from)
  if (!active) return false

  const current = active.tableNode.attrs.showCoords !== false
  const tr = editor.state.tr.setNodeMarkup(active.tablePos, undefined, {
    ...active.tableNode.attrs,
    showCoords: !current
  })
  editor.view.dispatch(tr)
  return true
}

export function focusTableCell(editor: Editor, targetRow: number, targetCol: number): boolean {
  const active = findEnclosingTableAndCell(editor.state.doc, editor.state.selection.from)
  if (!active) return false

  const { rows } = extractTableCells(active.tableNode, active.tablePos)
  const rowCells = rows[targetRow]
  if (!rowCells) return false

  const cell = rowCells.find((c) => c.col === targetCol) || rowCells[0]
  if (!cell) return false

  const tr = editor.state.tr.setSelection(
    TextSelection.near(editor.state.doc.resolve(cell.pos + 1))
  )
  editor.view.dispatch(tr)
  editor.commands.focus()
  return true
}

/**
 * Inserts a quick formula (SUM, AVERAGE, PRODUCT, MIN, MAX) into the active cell
 * by automatically detecting the contiguous numeric range above (or to the left).
 */
export function insertQuickFormula(
  editor: Editor,
  fnName: 'SUM' | 'AVERAGE' | 'PRODUCT' | 'MIN' | 'MAX'
): string | null {
  const active = findEnclosingTableAndCell(editor.state.doc, editor.state.selection.from)
  if (!active) return null

  const { rows } = extractTableCells(active.tableNode, active.tablePos)
  const curCell = rows.flat().find((c) => c.pos === active.cellPos)
  if (!curCell) return null

  // 1. Look upwards in the same column for numeric cells
  const aboveRows: number[] = []
  for (let r = curCell.row - 1; r >= 0; r--) {
    const candidate = rows[r]?.find((c) => c.col === curCell.col)
    if (!candidate) break
    if (candidate.node.type.name === 'tableHeader') break
    const parsed = parseNumericCellValue(candidate.text)
    if (parsed.kind === 'number' || candidate.formula) {
      aboveRows.unshift(r)
    } else if (aboveRows.length > 0) {
      break
    }
  }

  let rangeStr: string | null = null
  if (aboveRows.length > 0) {
    const startRef = formatCellRef(curCell.col, aboveRows[0])
    const endRef = formatCellRef(curCell.col, aboveRows[aboveRows.length - 1])
    rangeStr = startRef === endRef ? startRef : `${startRef}:${endRef}`
  } else {
    // 2. Otherwise look left in the same row for numeric cells
    const leftCols: number[] = []
    for (let c = curCell.col - 1; c >= 0; c--) {
      const candidate = rows[curCell.row]?.find((x) => x.col === c)
      if (!candidate) break
      const parsed = parseNumericCellValue(candidate.text)
      if (parsed.kind === 'number' || candidate.formula) {
        leftCols.unshift(c)
      } else if (leftCols.length > 0) {
        break
      }
    }
    if (leftCols.length > 0) {
      const startRef = formatCellRef(leftCols[0], curCell.row)
      const endRef = formatCellRef(leftCols[leftCols.length - 1], curCell.row)
      rangeStr = startRef === endRef ? startRef : `${startRef}:${endRef}`
    }
  }

  const formula = rangeStr ? `=${fnName}(${rangeStr})` : `=${fnName}(A1:A2)`
  applyCellFormulaOrValue(editor, formula)
  return formula
}

/**
 * Appends a "Total" row at the bottom of the active table and populates
 * =SUM(...) formulas automatically for every numeric/percentage column.
 */
export function addAutoTotalRow(editor: Editor): boolean {
  const active = findEnclosingTableAndCell(editor.state.doc, editor.state.selection.from)
  if (!active) return false

  const { rows, rowCount, colCount } = extractTableCells(active.tableNode, active.tablePos)
  if (rowCount === 0 || colCount === 0) return false

  const hasHeader = rows[0].every((c) => c.node.type.name === 'tableHeader')
  const dataStartRow = hasHeader ? 1 : 0
  const dataEndRow = rowCount - 1

  const schema = editor.state.schema
  const boldMark = schema.marks.bold?.create()
  const newCells: PMNode[] = []

  for (let c = 0; c < colCount; c++) {
    let numericCount = 0
    let percentCount = 0
    let firstNumRow = -1
    let lastNumRow = -1

    for (let r = dataStartRow; r <= dataEndRow; r++) {
      const cell = rows[r]?.find((x) => x.col === c)
      if (!cell) continue
      const parsed = parseNumericCellValue(cell.text)
      if (parsed.kind === 'number' || cell.formula) {
        numericCount++
        if (parsed.isPercent || cell.cellFormat === 'percent') percentCount++
        if (firstNumRow === -1) firstNumRow = r
        lastNumRow = r
      }
    }

    const headerText = (rows[0]?.find((x) => x.col === c)?.text || '').trim().toLowerCase()
    const isPercentCol =
      percentCount > 0 || headerText === '%' || headerText.includes('%') || headerText.includes('porcentaje')

    if (c === 0 && numericCount === 0) {
      const textNode = schema.text('Total', boldMark ? [boldMark] : [])
      const para = schema.nodes.paragraph.create(null, [textNode])
      newCells.push(schema.nodes.tableCell.create({ cellBg: 'neutral' }, [para]))
    } else if (numericCount > 0 && firstNumRow !== -1) {
      const startRef = formatCellRef(c, firstNumRow)
      const endRef = formatCellRef(c, lastNumRow)
      const formula = `=SUM(${startRef}:${endRef})`
      const textNode = schema.text('0', boldMark ? [boldMark] : [])
      const para = schema.nodes.paragraph.create(null, [textNode])
      newCells.push(
        schema.nodes.tableCell.create(
          { formula, cellBg: 'neutral', ...(isPercentCol ? { cellFormat: 'percent' } : {}) },
          [para]
        )
      )
    } else {
      const para = schema.nodes.paragraph.create()
      newCells.push(schema.nodes.tableCell.create({ cellBg: 'neutral' }, [para]))
    }
  }

  const newRow = schema.nodes.tableRow.create(null, newCells)
  const insertPos = active.tablePos + active.tableNode.nodeSize - 1
  const tr = editor.state.tr.insert(insertPos, newRow)
  editor.view.dispatch(tr)
  return true
}

/**
 * Moves the currently selected row up or down within the table.
 */
export function moveTableRow(editor: Editor, direction: 'up' | 'down'): boolean {
  const active = findEnclosingTableAndCell(editor.state.doc, editor.state.selection.from)
  if (!active) return false

  const tableNode = active.tableNode
  const { rows } = extractTableCells(tableNode, active.tablePos)
  const curCell = rows.flat().find((c) => c.pos === active.cellPos)
  if (!curCell) return false

  const rowIdx = curCell.row
  const targetIdx = direction === 'up' ? rowIdx - 1 : rowIdx + 1
  if (targetIdx < 0 || targetIdx >= tableNode.childCount) return false

  const rowNodes: PMNode[] = []
  for (let r = 0; r < tableNode.childCount; r++) {
    rowNodes.push(tableNode.child(r))
  }
  const [moved] = rowNodes.splice(rowIdx, 1)
  rowNodes.splice(targetIdx, 0, moved)

  const newTable = tableNode.type.create(tableNode.attrs, rowNodes)
  const tr = editor.state.tr.replaceWith(
    active.tablePos,
    active.tablePos + tableNode.nodeSize,
    newTable
  )
  editor.view.dispatch(tr)

  // Keep cursor on the moved row
  focusTableCell(editor, targetIdx, curCell.col)
  return true
}

/**
 * Duplicates the currently selected row directly below it.
 */
export function duplicateTableRow(editor: Editor): boolean {
  const active = findEnclosingTableAndCell(editor.state.doc, editor.state.selection.from)
  if (!active) return false

  const tableNode = active.tableNode
  const { rows } = extractTableCells(tableNode, active.tablePos)
  const curCell = rows.flat().find((c) => c.pos === active.cellPos)
  if (!curCell) return false

  const rowNodes: PMNode[] = []
  for (let r = 0; r < tableNode.childCount; r++) {
    rowNodes.push(tableNode.child(r))
    if (r === curCell.row) {
      // Clone row (if header row, convert cloned cells to regular tableCell)
      const srcRow = tableNode.child(r)
      const clonedCells: PMNode[] = []
      for (let i = 0; i < srcRow.childCount; i++) {
        const cell = srcRow.child(i)
        const targetType =
          cell.type.name === 'tableHeader'
            ? editor.state.schema.nodes.tableCell
            : cell.type
        clonedCells.push(targetType.create(cell.attrs, cell.content))
      }
      rowNodes.push(srcRow.type.create(srcRow.attrs, clonedCells))
    }
  }

  const newTable = tableNode.type.create(tableNode.attrs, rowNodes)
  const tr = editor.state.tr.replaceWith(
    active.tablePos,
    active.tablePos + tableNode.nodeSize,
    newTable
  )
  editor.view.dispatch(tr)
  focusTableCell(editor, curCell.row + 1, curCell.col)
  return true
}

/**
 * Moves the currently selected column left or right (when no merged cells block it).
 */
export function moveTableColumn(editor: Editor, direction: 'left' | 'right'): boolean {
  const active = findEnclosingTableAndCell(editor.state.doc, editor.state.selection.from)
  if (!active) return false

  const tableNode = active.tableNode
  const { rows, colCount } = extractTableCells(tableNode, active.tablePos)
  const curCell = rows.flat().find((c) => c.pos === active.cellPos)
  if (!curCell) return false

  const colIdx = curCell.col
  const targetIdx = direction === 'left' ? colIdx - 1 : colIdx + 1
  if (targetIdx < 0 || targetIdx >= colCount) return false

  // Ensure uniform column structure (no colspan/rowspan)
  for (let r = 0; r < tableNode.childCount; r++) {
    const rowNode = tableNode.child(r)
    if (rowNode.childCount !== colCount) return false
  }

  const newRows: PMNode[] = []
  for (let r = 0; r < tableNode.childCount; r++) {
    const rowNode = tableNode.child(r)
    const cells: PMNode[] = []
    for (let c = 0; c < rowNode.childCount; c++) {
      cells.push(rowNode.child(c))
    }
    const [moved] = cells.splice(colIdx, 1)
    cells.splice(targetIdx, 0, moved)
    newRows.push(rowNode.type.create(rowNode.attrs, cells))
  }

  const newTable = tableNode.type.create(tableNode.attrs, newRows)
  const tr = editor.state.tr.replaceWith(
    active.tablePos,
    active.tablePos + tableNode.nodeSize,
    newTable
  )
  editor.view.dispatch(tr)
  focusTableCell(editor, curCell.row, targetIdx)
  return true
}

/**
 * Sorts table body rows by the currently selected column (numerically if numeric, otherwise alphabetically).
 * Automatically preserves the header row at top and any "Total" summary row at bottom!
 */
export function sortTableByColumn(editor: Editor, direction: 'asc' | 'desc'): boolean {
  const active = findEnclosingTableAndCell(editor.state.doc, editor.state.selection.from)
  if (!active) return false

  const tableNode = active.tableNode
  const { rows } = extractTableCells(tableNode, active.tablePos)
  const curCell = rows.flat().find((c) => c.pos === active.cellPos)
  if (!curCell) return false

  const colIdx = curCell.col
  const totalRows = tableNode.childCount
  if (totalRows <= 1) return false

  const hasHeader = rows[0].every((c) => c.node.type.name === 'tableHeader')
  const startIdx = hasHeader ? 1 : 0

  // Detect if last row is a "Total" / summary row so it stays pinned at the bottom
  const lastRowFirstText = (rows[totalRows - 1]?.[0]?.text || '').toLowerCase()
  const lastRowHasSum = rows[totalRows - 1]?.some((c) =>
    /^=(sum|suma|total)/i.test(c.formula || '')
  )
  const keepLastPinned =
    totalRows - startIdx > 1 && (lastRowFirstText.startsWith('total') || lastRowHasSum)
  const endIdx = keepLastPinned ? totalRows - 1 : totalRows

  const sortable = []
  for (let r = startIdx; r < endIdx; r++) {
    const cell = rows[r]?.find((c) => c.col === colIdx)
    const text = cell?.text || ''
    const parsed = parseNumericCellValue(text)
    sortable.push({
      rowNode: tableNode.child(r),
      text,
      isNum: parsed.kind === 'number',
      numVal: parsed.value
    })
  }

  sortable.sort((a, b) => {
    let cmp = 0
    if (a.isNum && b.isNum) {
      cmp = a.numVal - b.numVal
    } else {
      cmp = a.text.localeCompare(b.text, 'es', { numeric: true, sensitivity: 'base' })
    }
    return direction === 'asc' ? cmp : -cmp
  })

  const newRows: PMNode[] = []
  if (hasHeader) newRows.push(tableNode.child(0))
  for (const item of sortable) newRows.push(item.rowNode)
  if (keepLastPinned) newRows.push(tableNode.child(totalRows - 1))

  const newTable = tableNode.type.create(tableNode.attrs, newRows)
  const tr = editor.state.tr.replaceWith(
    active.tablePos,
    active.tablePos + tableNode.nodeSize,
    newTable
  )
  editor.view.dispatch(tr)
  return true
}
