import { memo, useState } from 'react'
import { Handle, Position } from '@xyflow/react'
import { Plus, Trash2, CheckSquare, Square } from 'lucide-react'
import { db } from '../../../db'
import { syncEngine } from '../../../lib/syncEngine'
import { areNodePropsEqual } from './nodeUtils'

const HEADER_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  yellow: {
    bg: 'bg-[#ffeb7a] dark:bg-[#3a341b]',
    text: 'text-[#49420d] dark:text-[#fef08a]',
    border: 'border-[#f5eeaf] dark:border-[#574e22]'
  },
  dark: {
    bg: 'bg-[#233544] dark:bg-[#1a2530]',
    text: 'text-neutral-100',
    border: 'border-[#2d4255] dark:border-[#202f3d]'
  },
  blue: {
    bg: 'bg-[#e0f0fd] dark:bg-[#183048]',
    text: 'text-[#11446e] dark:text-[#bae6fd]',
    border: 'border-[#bde0fb] dark:border-[#23496e]'
  },
  green: {
    bg: 'bg-[#dcf5e3] dark:bg-[#1a3424]',
    text: 'text-[#184a25] dark:text-[#bbf7d0]',
    border: 'border-[#b6e8c4] dark:border-[#285338]'
  },
  slate: {
    bg: 'bg-neutral-100 dark:bg-neutral-800',
    text: 'text-neutral-800 dark:text-neutral-200',
    border: 'border-neutral-200 dark:border-neutral-700'
  }
}

export const TableNode = memo(({ id, data, selected }: any) => {
  const [title, setTitle] = useState(data.title || 'Tabla de datos')
  const [col1Title, setCol1Title] = useState(data.col1Title || 'Elemento')
  const [col2Title, setCol2Title] = useState(data.col2Title || 'Valor')
  const [headerColor, setHeaderColor] = useState<string>(data.headerColor || 'yellow')
  const [hasCheckboxes] = useState<boolean>(data.hasCheckboxes ?? false)
  const [showTotal] = useState<boolean>(data.showTotal ?? false)
  const [totalText, setTotalText] = useState(data.totalText || '$23,000')

  const [rows, setRows] = useState<Array<{ id: string; checked: boolean; col1: string; col2: string }>>(
    data.rows && data.rows.length > 0
      ? data.rows
      : [
          { id: '1', checked: true, col1: 'Elemento 1', col2: '100' },
          { id: '2', checked: false, col1: 'Elemento 2', col2: '200' }
        ]
  )

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
      console.error('Error saving table node', e)
    }
  }

  const handleDelete = async () => {
    try {
      await db.canvasNodes.update(id, { isDeleted: true, updatedAt: Date.now(), syncStatus: 'pending' })
      syncEngine.scheduleSync(1000)
    } catch (e) {
      console.error('Error deleting table node', e)
    }
  }

  const toggleRowCheck = (rowId: string) => {
    const updated = rows.map((r) => (r.id === rowId ? { ...r, checked: !r.checked } : r))
    setRows(updated)
    save({ rows: updated })
  }

  const updateRowText = (rowId: string, field: 'col1' | 'col2', val: string) => {
    const updated = rows.map((r) => (r.id === rowId ? { ...r, [field]: val } : r))
    setRows(updated)
    save({ rows: updated })
  }

  const addRow = () => {
    const newRow = {
      id: crypto.randomUUID(),
      checked: false,
      col1: 'Nuevo elemento',
      col2: ''
    }
    const updated = [...rows, newRow]
    setRows(updated)
    save({ rows: updated })
  }

  const removeRow = (rowId: string) => {
    if (rows.length <= 1) return
    const updated = rows.filter((r) => r.id !== rowId)
    setRows(updated)
    save({ rows: updated })
  }

  const currentTheme = HEADER_COLORS[headerColor] || HEADER_COLORS.yellow

  return (
    <div
      className={`group relative min-w-[300px] max-w-[420px] rounded-lg bg-white dark:bg-[#252525] border border-neutral-200 dark:border-neutral-700/80 transition-[box-shadow,border-color] duration-150 overflow-hidden ${
        selected ? 'ring-2 ring-[var(--app-accent)] shadow-xl' : 'shadow-[0_2px_8px_rgba(0,0,0,0.06)] dark:shadow-[0_4px_16px_rgba(0,0,0,0.35)]'
      }`}
    >
      {/* Handles */}
      <Handle id="top" type="source" position={Position.Top} className="!w-2.5 !h-2.5 !bg-[var(--app-accent)] !border !border-white dark:!border-zinc-800" />
      <Handle id="bottom" type="source" position={Position.Bottom} className="!w-2.5 !h-2.5 !bg-[var(--app-accent)] !border !border-white dark:!border-zinc-800" />
      <Handle id="left" type="source" position={Position.Left} className="!w-2.5 !h-2.5 !bg-[var(--app-accent)] !border !border-white dark:!border-zinc-800" />
      <Handle id="right" type="source" position={Position.Right} className="!w-2.5 !h-2.5 !bg-[var(--app-accent)] !border !border-white dark:!border-zinc-800" />

      {/* Floating delete button */}
      <button
        onClick={handleDelete}
        className="absolute top-2 right-2 p-1.5 rounded-full bg-white/80 dark:bg-neutral-800/80 hover:bg-white dark:hover:bg-neutral-700 text-neutral-400 hover:text-rose-500 shadow-sm opacity-0 group-hover:opacity-100 transition z-20 backdrop-blur-xs"
        title="Eliminar tabla"
      >
        <Trash2 className="w-3.5 h-3.5" />
      </button>

      {/* Optional Top Title Bar */}
      {data.showTitleBar && (
        <div className="px-3 py-1.5 bg-neutral-50 dark:bg-neutral-800/60 border-b border-neutral-200 dark:border-neutral-700/60 flex items-center justify-between">
          <input
            type="text"
            value={title}
            onChange={(e) => {
              setTitle(e.target.value)
              save({ title: e.target.value })
            }}
            className="text-xs font-bold text-neutral-800 dark:text-neutral-200 bg-transparent border-none outline-none w-full"
          />
        </div>
      )}

      {/* Table Header Row */}
      <div className={`flex items-center px-3 py-2 text-xs font-bold ${currentTheme.bg} ${currentTheme.text} border-b ${currentTheme.border}`}>
        {hasCheckboxes && <div className="w-6 shrink-0" />}
        <input
          type="text"
          value={col1Title}
          onChange={(e) => {
            setCol1Title(e.target.value)
            save({ col1Title: e.target.value })
          }}
          className="flex-1 font-bold bg-transparent border-none outline-none text-xs"
        />
        <input
          type="text"
          value={col2Title}
          onChange={(e) => {
            setCol2Title(e.target.value)
            save({ col2Title: e.target.value })
          }}
          className="w-20 text-right font-bold bg-transparent border-none outline-none text-xs"
        />
      </div>

      {/* Table Rows */}
      <div className="divide-y divide-neutral-100 dark:divide-neutral-800">
        {rows.map((row) => (
          <div
            key={row.id}
            className="group/row flex items-center px-3 py-1.5 text-xs hover:bg-neutral-50 dark:hover:bg-neutral-800/40 transition-colors"
          >
            {hasCheckboxes && (
              <button
                onClick={() => toggleRowCheck(row.id)}
                className="w-5 h-5 rounded flex items-center justify-center mr-1.5 text-neutral-400 hover:text-blue-500 transition"
              >
                {row.checked ? (
                  <CheckSquare className="w-4 h-4 text-neutral-600 dark:text-neutral-300 fill-neutral-100 dark:fill-neutral-700" />
                ) : (
                  <Square className="w-4 h-4 text-neutral-300 dark:text-neutral-600" />
                )}
              </button>
            )}

            <input
              type="text"
              value={row.col1}
              onChange={(e) => updateRowText(row.id, 'col1', e.target.value)}
              className={`flex-1 bg-transparent border-none outline-none text-neutral-800 dark:text-neutral-200 text-xs ${
                hasCheckboxes && row.checked ? 'text-neutral-700 dark:text-neutral-300 font-medium' : ''
              }`}
            />

            <input
              type="text"
              value={row.col2}
              onChange={(e) => updateRowText(row.id, 'col2', e.target.value)}
              className="w-20 text-right bg-transparent border-none outline-none font-mono text-neutral-700 dark:text-neutral-300 text-xs"
            />

            <button
              onClick={() => removeRow(row.id)}
              className="opacity-0 group-hover/row:opacity-100 p-0.5 ml-1 text-neutral-400 hover:text-rose-500 transition"
            >
              <Trash2 className="w-3 h-3" />
            </button>
          </div>
        ))}
      </div>

      {/* Total Row (e.g. $23,000 for film budget) */}
      {showTotal && (
        <div className="flex items-center justify-between px-3 py-2 bg-neutral-50 dark:bg-neutral-800/60 border-t border-neutral-200 dark:border-neutral-700 text-xs font-bold">
          <span className="text-neutral-600 dark:text-neutral-400">Total</span>
          <input
            type="text"
            value={totalText}
            onChange={(e) => {
              setTotalText(e.target.value)
              save({ totalText: e.target.value })
            }}
            className="w-28 text-right font-mono font-bold text-neutral-900 dark:text-neutral-100 bg-transparent border-none outline-none text-xs"
          />
        </div>
      )}

      {/* Footer controls: Add row & Color switch */}
      <div className="px-3 py-1.5 bg-neutral-50/50 dark:bg-neutral-800/20 border-t border-neutral-100 dark:border-neutral-800/60 flex items-center justify-between">
        <button
          onClick={addRow}
          className="inline-flex items-center gap-1 text-[11px] font-medium text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200 transition"
        >
          <Plus className="w-3 h-3" />
          <span>Fila</span>
        </button>

        <div className="flex items-center gap-1">
          {Object.keys(HEADER_COLORS).map((col) => (
            <button
              key={col}
              onClick={() => {
                setHeaderColor(col)
                save({ headerColor: col })
              }}
              className={`w-3.5 h-3.5 rounded-full border border-neutral-300 dark:border-neutral-600 ${
                col === 'yellow'
                  ? 'bg-amber-300'
                  : col === 'dark'
                  ? 'bg-neutral-800'
                  : col === 'blue'
                  ? 'bg-sky-300'
                  : col === 'green'
                  ? 'bg-emerald-300'
                  : 'bg-neutral-200'
              } ${headerColor === col ? 'ring-1.5 ring-blue-500' : ''}`}
            />
          ))}
        </div>
      </div>
    </div>
  )
}, areNodePropsEqual)
