import React, { useEffect, useRef, useState } from 'react'
import type { Editor } from '@tiptap/react'
import {
  Function as FunctionIcon,
  WarningCircle,
  Plus,
  Trash,
  ArrowUp,
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  Copy,
  SortAscending,
  SortDescending,
  TextAlignLeft,
  TextAlignCenter,
  TextAlignRight,
  PaintBucket,
  GridFour,
  Table as TableIcon,
  Check,
  X,
  Sigma,
  GitMerge,
  SplitHorizontal
} from '@phosphor-icons/react'
import { FORMULA_CATALOG, type CellFormat } from '../../lib/tableFormulaEngine'
import {
  addAutoTotalRow,
  applyCellFormulaOrValue,
  duplicateTableRow,
  focusTableCell,
  getActiveTableSnapshot,
  insertQuickFormula,
  moveTableColumn,
  moveTableRow,
  sortTableByColumn,
  toggleTableCoords,
  updateActiveCellAttrs,
  type ActiveTableSnapshot,
  type CellAlignKey,
  type CellBgKey
} from './SpreadsheetTableExtensions'
import { toast } from '../../lib/toast'

interface TableSpreadsheetToolbarProps {
  editor: Editor
}

const CELL_BG_OPTIONS: Array<{ key: CellBgKey | null; label: string; swatch: string }> = [
  { key: null, label: 'Sin fondo', swatch: 'transparent' },
  { key: 'neutral', label: 'Grafito', swatch: 'rgba(148, 163, 184, 0.22)' },
  { key: 'amber', label: 'Ámbar', swatch: 'rgba(245, 158, 11, 0.24)' },
  { key: 'emerald', label: 'Esmeralda', swatch: 'rgba(16, 185, 129, 0.22)' },
  { key: 'sky', label: 'Cielo', swatch: 'rgba(56, 189, 248, 0.22)' },
  { key: 'violet', label: 'Violeta', swatch: 'rgba(124, 58, 237, 0.24)' },
  { key: 'rose', label: 'Rosa', swatch: 'rgba(244, 63, 94, 0.22)' }
]

const FORMAT_OPTIONS: Array<{ key: CellFormat; label: string; title: string }> = [
  { key: 'auto', label: 'Auto', title: 'Formato automático' },
  { key: 'number', label: '1.000', title: 'Formato numérico' },
  { key: 'currency', label: '$', title: 'Formato moneda' },
  { key: 'percent', label: '%', title: 'Formato porcentaje' }
]

export const TableSpreadsheetToolbar: React.FC<TableSpreadsheetToolbarProps> = ({ editor }) => {
  const [snapshot, setSnapshot] = useState<ActiveTableSnapshot | null>(() =>
    getActiveTableSnapshot(editor)
  )
  const [formulaDraft, setFormulaDraft] = useState('')
  const [isEditingFormula, setIsEditingFormula] = useState(false)
  const [openMenu, setOpenMenu] = useState<null | 'fx' | 'bg' | 'errors'>(null)
  const formulaInputRef = useRef<HTMLInputElement>(null)
  const toolbarRef = useRef<HTMLDivElement>(null)

  // Keep snapshot in sync with TipTap selection & doc transactions
  useEffect(() => {
    const sync = () => {
      const next = getActiveTableSnapshot(editor)
      setSnapshot(next)
      if (next && document.activeElement !== formulaInputRef.current) {
        setFormulaDraft(next.activeFormula ?? next.activeText)
        setIsEditingFormula(false)
      }
    }

    sync()
    editor.on('selectionUpdate', sync)
    editor.on('transaction', sync)
    return () => {
      editor.off('selectionUpdate', sync)
      editor.off('transaction', sync)
    }
  }, [editor])

  // Close popovers on outside click
  useEffect(() => {
    if (!openMenu) return
    const onPointerDown = (e: PointerEvent) => {
      if (toolbarRef.current && !toolbarRef.current.contains(e.target as Node)) {
        setOpenMenu(null)
      }
    }
    document.addEventListener('pointerdown', onPointerDown)
    return () => document.removeEventListener('pointerdown', onPointerDown)
  }, [openMenu])

  if (!snapshot) return null

  const commitFormulaDraft = () => {
    applyCellFormulaOrValue(editor, formulaDraft)
    setIsEditingFormula(false)
    editor.commands.focus()
  }

  const cancelFormulaDraft = () => {
    setFormulaDraft(snapshot.activeFormula ?? snapshot.activeText)
    setIsEditingFormula(false)
    editor.commands.focus()
  }

  const handleInsertCatalogFn = (syntax: string) => {
    const nextDraft = `=${syntax}`
    setFormulaDraft(nextDraft)
    setIsEditingFormula(true)
    setOpenMenu(null)
    requestAnimationFrame(() => {
      const input = formulaInputRef.current
      if (input) {
        input.focus()
        const openIdx = nextDraft.indexOf('(')
        const closeIdx = nextDraft.lastIndexOf(')')
        if (openIdx !== -1 && closeIdx > openIdx) {
          input.setSelectionRange(openIdx + 1, closeIdx)
        }
      }
    })
  }

  const handleQuickFormula = (fn: 'SUM' | 'AVERAGE' | 'PRODUCT' | 'MIN' | 'MAX') => {
    const inserted = insertQuickFormula(editor, fn)
    if (inserted) {
      toast.success(`Fórmula insertada: ${inserted}`)
    }
  }

  const handleAddTotalRow = () => {
    if (addAutoTotalRow(editor)) {
      toast.success('Fila Total añadida con sumas automáticas')
    }
  }

  const handleSort = (dir: 'asc' | 'desc') => {
    if (sortTableByColumn(editor, dir)) {
      toast.success(dir === 'asc' ? 'Columna ordenada A → Z' : 'Columna ordenada Z → A')
    }
  }

  const canMerge = editor.can().mergeCells()
  const canSplit = editor.can().splitCell()

  const btnBase =
    'inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-medium transition-colors cursor-pointer select-none hover:bg-[var(--app-hover)] text-[var(--app-text-primary)] active:scale-[0.98]'
  const iconBtnBase =
    'inline-flex items-center justify-center w-6 h-6 rounded-md transition-colors cursor-pointer select-none hover:bg-[var(--app-hover)] text-[var(--app-text-secondary)] hover:text-[var(--app-text-primary)] active:scale-[0.96]'
  const dividerCls = 'w-[1px] h-4 bg-[var(--app-border-strong)] mx-0.5 shrink-0'

  return (
    <div
      ref={toolbarRef}
      className="sticky top-11 z-20 px-3 py-1.5 bg-[var(--app-bg-primary)]/90 backdrop-blur-md border-b border-[var(--app-border)]"
    >
      <div className="max-w-4xl mx-auto flex flex-col gap-1.5">
        {/* ROW 1: Excel Formula Bar (fx) + Quick Formulas + Error Audit Badge */}
        <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-[var(--app-bg-secondary)] border border-[var(--app-border-strong)] shadow-xs">
          {/* Active Cell Coordinate Name Box */}
          <div
            className="px-2 py-0.5 rounded-md bg-[var(--app-bg-primary)] border border-[var(--app-border-strong)] font-mono text-[11px] font-semibold text-[var(--app-accent)] shrink-0 select-none"
            title={`Celda activa ${snapshot.activeCellRef} (Tabla ${snapshot.rowCount}×${snapshot.colCount})`}
          >
            {snapshot.activeCellRef}
          </div>

          {/* Function Catalog Button (fx) */}
          <div className="relative shrink-0">
            <button
              type="button"
              onClick={() => setOpenMenu((m) => (m === 'fx' ? null : 'fx'))}
              className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md font-mono text-[11px] font-semibold transition-colors cursor-pointer ${
                openMenu === 'fx' || snapshot.activeFormula
                  ? 'bg-[var(--app-accent-soft)] text-[var(--app-accent)]'
                  : 'text-[var(--app-text-secondary)] hover:bg-[var(--app-hover)] hover:text-[var(--app-text-primary)]'
              }`}
              title="Insertar función de Excel (SUM, PRODUCT, AVERAGE, IF...)"
              aria-label="Catálogo de funciones"
            >
              <FunctionIcon size={14} weight="bold" />
              <span>fx</span>
            </button>

            {openMenu === 'fx' && (
              <div className="absolute left-0 top-full mt-1.5 w-80 max-h-72 overflow-y-auto rounded-xl bg-[var(--app-bg-overlay)] border border-[var(--app-border-strong)] shadow-xl p-1.5 z-50">
                <div className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-[var(--app-text-muted)]">
                  Funciones disponibles (inglés y español)
                </div>
                {FORMULA_CATALOG.map((item) => (
                  <button
                    key={item.name}
                    type="button"
                    onClick={() => handleInsertCatalogFn(item.syntax)}
                    className="w-full text-left px-2 py-1.5 rounded-md hover:bg-[var(--app-hover)] transition-colors cursor-pointer flex flex-col gap-0.5"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono text-[11px] font-semibold text-[var(--app-accent)]">
                        ={item.syntax}
                      </span>
                    </div>
                    <span className="text-[11px] text-[var(--app-text-secondary)] leading-tight">
                      {item.description}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Formula Input */}
          <div className="flex-1 flex items-center gap-1 min-w-0">
            <input
              ref={formulaInputRef}
              type="text"
              value={formulaDraft}
              onFocus={() => setIsEditingFormula(true)}
              onChange={(e) => {
                setFormulaDraft(e.target.value)
                setIsEditingFormula(true)
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  commitFormulaDraft()
                } else if (e.key === 'Escape') {
                  e.preventDefault()
                  cancelFormulaDraft()
                }
              }}
              placeholder="Escribe un valor o fórmula (ej. =SUM(C2:C4), =B2*C5, =C2/2)"
              aria-label="Barra de fórmulas de la celda"
              className="w-full bg-transparent text-xs font-mono text-[var(--app-text-primary)] placeholder:text-[var(--app-text-muted)] focus:outline-none px-1 py-0.5 min-w-[140px]"
            />

            {isEditingFormula && (
              <div className="flex items-center gap-0.5 shrink-0">
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={commitFormulaDraft}
                  className="w-5 h-5 inline-flex items-center justify-center rounded-md bg-[var(--app-accent)] text-white hover:opacity-90 cursor-pointer"
                  title="Aplicar (Enter)"
                  aria-label="Aplicar fórmula"
                >
                  <Check size={12} weight="bold" />
                </button>
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={cancelFormulaDraft}
                  className="w-5 h-5 inline-flex items-center justify-center rounded-md hover:bg-[var(--app-hover)] text-[var(--app-text-secondary)] cursor-pointer"
                  title="Cancelar (Esc)"
                  aria-label="Cancelar edición de fórmula"
                >
                  <X size={12} weight="bold" />
                </button>
              </div>
            )}
          </div>

          <div className={dividerCls} />

          {/* Quick Formula Shortcuts */}
          <div className="hidden md:flex items-center gap-0.5 shrink-0">
            <button
              type="button"
              onClick={() => handleQuickFormula('SUM')}
              className={btnBase}
              title="Insertar =SUM(...) automático en esta celda"
            >
              <Sigma size={13} weight="bold" className="text-[var(--app-accent)]" />
              <span>Suma</span>
            </button>
            <button
              type="button"
              onClick={() => handleQuickFormula('PRODUCT')}
              className={btnBase}
              title="Insertar =PRODUCT(...) automático en esta celda"
            >
              <span className="font-mono text-[var(--app-accent)] font-bold">×</span>
              <span>Mult</span>
            </button>
            <button
              type="button"
              onClick={() => handleQuickFormula('AVERAGE')}
              className={btnBase}
              title="Insertar =AVERAGE(...) automático en esta celda"
            >
              <span>Prom</span>
            </button>
            <button
              type="button"
              onClick={handleAddTotalRow}
              className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-medium transition-colors cursor-pointer bg-[var(--app-accent-soft)] text-[var(--app-accent)] hover:brightness-110 active:scale-[0.98]"
              title="Añadir fila Total abajo con =SUM() en todas las columnas numéricas"
            >
              <Plus size={12} weight="bold" />
              <span>Fila Total</span>
            </button>
          </div>

          {/* Calculation Error Audit Badge */}
          {snapshot.errors.length > 0 && (
            <div className="relative shrink-0">
              <button
                type="button"
                onClick={() => setOpenMenu((m) => (m === 'errors' ? null : 'errors'))}
                className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-semibold bg-rose-500/15 text-rose-500 border border-rose-500/30 hover:bg-rose-500/25 transition-colors cursor-pointer"
                title="Ver errores de cálculo en esta tabla"
                aria-label="Errores de cálculo en la tabla"
              >
                <WarningCircle size={14} weight="fill" />
                <span>
                  {snapshot.errors.length}{' '}
                  {snapshot.errors.length === 1 ? 'error' : 'errores'}
                </span>
              </button>

              {openMenu === 'errors' && (
                <div className="absolute right-0 top-full mt-1.5 w-80 max-h-64 overflow-y-auto rounded-xl bg-[var(--app-bg-overlay)] border border-rose-500/30 shadow-xl p-1.5 z-50">
                  <div className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-rose-500 flex items-center gap-1">
                    <WarningCircle size={13} weight="fill" />
                    <span>Errores de cálculo detectados</span>
                  </div>
                  {snapshot.errors.map((err) => (
                    <button
                      key={`${err.row}:${err.col}`}
                      type="button"
                      onClick={() => {
                        focusTableCell(editor, err.row, err.col)
                        setOpenMenu(null)
                      }}
                      className="w-full text-left px-2 py-1.5 rounded-md hover:bg-rose-500/10 transition-colors cursor-pointer flex flex-col gap-0.5"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-mono text-[11px] font-bold text-rose-500">
                          {err.ref} · {err.code}
                        </span>
                        <span className="font-mono text-[10px] text-[var(--app-text-muted)] truncate max-w-[140px]">
                          {err.formula}
                        </span>
                      </div>
                      <span className="text-[11px] text-[var(--app-text-secondary)] leading-tight">
                        {err.message}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Inline Active Cell Error Banner */}
        {snapshot.activeError && (
          <div className="flex items-center justify-between gap-2 px-2.5 py-1 rounded-md bg-rose-500/10 border border-rose-500/25 text-[11px] text-rose-400">
            <div className="flex items-center gap-1.5 min-w-0">
              <WarningCircle size={14} weight="fill" className="text-rose-500 shrink-0" />
              <span className="font-mono font-bold text-rose-500 shrink-0">
                {snapshot.activeError}
              </span>
              <span className="truncate text-[var(--app-text-primary)]">
                {snapshot.activeErrorMsg || 'Error al evaluar la fórmula'}
              </span>
            </div>
            {snapshot.activeFormula && (
              <span className="font-mono text-[10px] text-[var(--app-text-muted)] shrink-0">
                {snapshot.activeFormula}
              </span>
            )}
          </div>
        )}

        {/* ROW 2: Structural & Formatting Controls */}
        <div className="flex items-center gap-1 px-1.5 py-1 rounded-lg bg-[var(--app-bg-secondary)]/70 border border-[var(--app-border)] flex-wrap">
          {/* Row controls */}
          <div className="flex items-center gap-0.5">
            <button
              type="button"
              onClick={() => editor.chain().focus().addRowBefore().run()}
              className={btnBase}
              title="Añadir fila arriba"
            >
              + Fila ↑
            </button>
            <button
              type="button"
              onClick={() => editor.chain().focus().addRowAfter().run()}
              className={btnBase}
              title="Añadir fila abajo"
            >
              + Fila ↓
            </button>
            <button
              type="button"
              onClick={() => moveTableRow(editor, 'up')}
              className={iconBtnBase}
              title="Mover fila hacia arriba"
              aria-label="Mover fila hacia arriba"
            >
              <ArrowUp size={13} />
            </button>
            <button
              type="button"
              onClick={() => moveTableRow(editor, 'down')}
              className={iconBtnBase}
              title="Mover fila hacia abajo"
              aria-label="Mover fila hacia abajo"
            >
              <ArrowDown size={13} />
            </button>
            <button
              type="button"
              onClick={() => duplicateTableRow(editor)}
              className={iconBtnBase}
              title="Duplicar fila actual"
              aria-label="Duplicar fila actual"
            >
              <Copy size={13} />
            </button>
            <button
              type="button"
              onClick={() => editor.chain().focus().deleteRow().run()}
              className="inline-flex items-center px-1.5 py-1 rounded-md text-[11px] font-medium text-rose-500 hover:bg-rose-500/10 transition-colors cursor-pointer"
              title="Eliminar fila actual"
            >
              − Fila
            </button>
          </div>

          <div className={dividerCls} />

          {/* Column controls */}
          <div className="flex items-center gap-0.5">
            <button
              type="button"
              onClick={() => editor.chain().focus().addColumnBefore().run()}
              className={btnBase}
              title="Añadir columna a la izquierda"
            >
              + Col ←
            </button>
            <button
              type="button"
              onClick={() => editor.chain().focus().addColumnAfter().run()}
              className={btnBase}
              title="Añadir columna a la derecha"
            >
              + Col →
            </button>
            <button
              type="button"
              onClick={() => moveTableColumn(editor, 'left')}
              className={iconBtnBase}
              title="Mover columna a la izquierda"
              aria-label="Mover columna a la izquierda"
            >
              <ArrowLeft size={13} />
            </button>
            <button
              type="button"
              onClick={() => moveTableColumn(editor, 'right')}
              className={iconBtnBase}
              title="Mover columna a la derecha"
              aria-label="Mover columna a la derecha"
            >
              <ArrowRight size={13} />
            </button>
            <button
              type="button"
              onClick={() => handleSort('asc')}
              className={iconBtnBase}
              title="Ordenar columna ascendente (A→Z / menor→mayor)"
              aria-label="Ordenar columna ascendente"
            >
              <SortAscending size={14} />
            </button>
            <button
              type="button"
              onClick={() => handleSort('desc')}
              className={iconBtnBase}
              title="Ordenar columna descendente (Z→A / mayor→menor)"
              aria-label="Ordenar columna descendente"
            >
              <SortDescending size={14} />
            </button>
            <button
              type="button"
              onClick={() => editor.chain().focus().deleteColumn().run()}
              className="inline-flex items-center px-1.5 py-1 rounded-md text-[11px] font-medium text-rose-500 hover:bg-rose-500/10 transition-colors cursor-pointer"
              title="Eliminar columna actual"
            >
              − Col
            </button>
          </div>

          <div className={dividerCls} />

          {/* Number Format Selector */}
          <div className="flex items-center gap-0.5 bg-[var(--app-bg-primary)] p-0.5 rounded-md border border-[var(--app-border)]">
            {FORMAT_OPTIONS.map((fmt) => (
              <button
                key={fmt.key}
                type="button"
                onClick={() => updateActiveCellAttrs(editor, { cellFormat: fmt.key })}
                className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-medium transition-colors cursor-pointer ${
                  snapshot.activeFormat === fmt.key
                    ? 'bg-[var(--app-accent-soft)] text-[var(--app-accent)]'
                    : 'text-[var(--app-text-secondary)] hover:text-[var(--app-text-primary)]'
                }`}
                title={fmt.title}
              >
                {fmt.label}
              </button>
            ))}
          </div>

          {/* Cell Alignment */}
          <div className="flex items-center gap-0.5">
            {(
              [
                { key: 'left', icon: TextAlignLeft, label: 'Alinear izquierda' },
                { key: 'center', icon: TextAlignCenter, label: 'Centrar celda' },
                { key: 'right', icon: TextAlignRight, label: 'Alinear derecha' }
              ] as Array<{ key: CellAlignKey; icon: any; label: string }>
            ).map(({ key, icon: Icon, label }) => (
              <button
                key={key}
                type="button"
                onClick={() =>
                  updateActiveCellAttrs(editor, {
                    cellAlign: snapshot.activeAlign === key ? null : key
                  })
                }
                className={`${iconBtnBase} ${
                  snapshot.activeAlign === key
                    ? 'bg-[var(--app-accent-soft)] text-[var(--app-accent)]'
                    : ''
                }`}
                title={label}
                aria-label={label}
              >
                <Icon size={13} />
              </button>
            ))}
          </div>

          {/* Cell Background Tint */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setOpenMenu((m) => (m === 'bg' ? null : 'bg'))}
              className={`${iconBtnBase} ${
                snapshot.activeBg ? 'bg-[var(--app-accent-soft)] text-[var(--app-accent)]' : ''
              }`}
              title="Color de fondo de celda"
              aria-label="Color de fondo de celda"
            >
              <PaintBucket size={13} />
            </button>

            {openMenu === 'bg' && (
              <div className="absolute right-0 top-full mt-1.5 p-2 rounded-xl bg-[var(--app-bg-overlay)] border border-[var(--app-border-strong)] shadow-xl z-50 flex items-center gap-1.5">
                {CELL_BG_OPTIONS.map((opt) => (
                  <button
                    key={opt.label}
                    type="button"
                    onClick={() => {
                      updateActiveCellAttrs(editor, { cellBg: opt.key })
                      setOpenMenu(null)
                    }}
                    className={`w-6 h-6 rounded-md border transition-transform hover:scale-110 cursor-pointer flex items-center justify-center ${
                      snapshot.activeBg === opt.key
                        ? 'border-[var(--app-accent)] ring-1 ring-[var(--app-accent)]'
                        : 'border-[var(--app-border-strong)]'
                    }`}
                    style={{ backgroundColor: opt.swatch }}
                    title={opt.label}
                    aria-label={opt.label}
                  >
                    {opt.key === null && <X size={11} className="text-[var(--app-text-muted)]" />}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className={dividerCls} />

          {/* Merge / Split / Header / Coords / Delete */}
          <div className="flex items-center gap-0.5">
            {canMerge && (
              <button
                type="button"
                onClick={() => editor.chain().focus().mergeCells().run()}
                className={iconBtnBase}
                title="Combinar celdas seleccionadas"
                aria-label="Combinar celdas"
              >
                <GitMerge size={13} />
              </button>
            )}
            {canSplit && (
              <button
                type="button"
                onClick={() => editor.chain().focus().splitCell().run()}
                className={iconBtnBase}
                title="Dividir celda combinada"
                aria-label="Dividir celda"
              >
                <SplitHorizontal size={13} />
              </button>
            )}
            <button
              type="button"
              onClick={() => editor.chain().focus().toggleHeaderRow().run()}
              className={`${btnBase} ${
                snapshot.hasHeaderRow
                  ? 'bg-[var(--app-accent-soft)] text-[var(--app-accent)]'
                  : ''
              }`}
              title="Alternar fila de encabezado"
            >
              <TableIcon size={13} />
              <span>Encabezado</span>
            </button>
            <button
              type="button"
              onClick={() => toggleTableCoords(editor)}
              className={`${btnBase} ${
                snapshot.showCoords
                  ? 'bg-[var(--app-accent-soft)] text-[var(--app-accent)]'
                  : ''
              }`}
              title="Mostrar/ocultar coordenadas de Excel (A, B, C / 1, 2, 3)"
              aria-label="Alternar coordenadas de Excel"
            >
              <GridFour size={13} />
              <span className="font-mono">A1</span>
            </button>
            <button
              type="button"
              onClick={() => editor.chain().focus().deleteTable().run()}
              className="inline-flex items-center justify-center w-6 h-6 rounded-md text-rose-500 hover:bg-rose-500/15 transition-colors cursor-pointer"
              title="Eliminar tabla completa"
              aria-label="Eliminar tabla"
            >
              <Trash size={13} />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
