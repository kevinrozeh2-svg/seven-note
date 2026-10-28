import { memo, useState } from 'react'
import { Handle, Position } from '@xyflow/react'
import { DeleteIcon, PlusIcon, DoneIcon, HighLightLinearIcon } from '@blocksuite/icons/rc'
import confetti from 'canvas-confetti'
import { db, type CanvasTodoItem } from '../../../db'
import { syncEngine } from '../../../lib/syncEngine'
import { areNodePropsEqual } from './nodeUtils'

const COLOR_MAP: Record<string, { bg: string; border: string; header: string; text: string; dot: string }> = {
  blue: {
    bg: 'bg-[#e0f0fd] dark:bg-[#183048]',
    border: 'border-[#bde0fb] dark:border-[#23496e]',
    header: 'bg-[#bae6fd] dark:bg-[#1e3d5c]',
    text: 'text-[#11446e] dark:text-[#bae6fd]',
    dot: '#38bdf8'
  },
  yellow: {
    bg: 'bg-[#fff9db] dark:bg-[#3a341b]',
    border: 'border-[#f5eeaf] dark:border-[#574e22]',
    header: 'bg-[#fef3c7] dark:bg-[#453d1e]',
    text: 'text-[#49420d] dark:text-[#fef08a]',
    dot: '#facc15'
  },
  green: {
    bg: 'bg-[#dcf5e3] dark:bg-[#1a3424]',
    border: 'border-[#b6e8c4] dark:border-[#285338]',
    header: 'bg-[#bbf7d0] dark:bg-[#204530]',
    text: 'text-[#184a25] dark:text-[#bbf7d0]',
    dot: '#4ade80'
  },
  purple: {
    bg: 'bg-[#ede7fb] dark:bg-[#2d2345]',
    border: 'border-[#d7c9f7] dark:border-[#46346e]',
    header: 'bg-[#ddd6fe] dark:bg-[#382b57]',
    text: 'text-[#3d2870] dark:text-[#e9d5ff]',
    dot: '#c084fc'
  },
  rose: {
    bg: 'bg-[#ffe8d4] dark:bg-[#3d271a]',
    border: 'border-[#fcd2af] dark:border-[#5e3820]',
    header: 'bg-[#fed7aa] dark:bg-[#4d3120]',
    text: 'text-[#5c310b] dark:text-[#fed7aa]',
    dot: '#fb923c'
  },
  slate: {
    bg: 'bg-[#ffffff] dark:bg-[#252525]',
    border: 'border-[#e8e7e4] dark:border-[#383838]',
    header: 'bg-[#f7f6f5] dark:bg-[#2d2d2d]',
    text: 'text-[#37352f] dark:text-[#e6e6e5]',
    dot: '#9ca3af'
  }
}

const COLORS = ['blue', 'yellow', 'green', 'purple', 'rose', 'slate']

export const TodoNode = memo(({ id, data, selected }: any) => {
  const [title, setTitle] = useState(data.title ?? 'Tareas pendientes')
  const [todos, setTodos] = useState<CanvasTodoItem[]>(data.todos ?? [])
  const [newTaskText, setNewTaskText] = useState('')
  const [color, setColor] = useState(data.color ?? 'blue')
  const [showPalette, setShowPalette] = useState(false)

  const colorScheme = COLOR_MAP[color] || COLOR_MAP.blue

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
      console.error('Error saving todo node', e)
    }
  }

  const toggleTodo = (todoId: string) => {
    const updated = todos.map((t) => (t.id === todoId ? { ...t, completed: !t.completed } : t))
    setTodos(updated)
    save({ todos: updated })

    // Check if all are completed
    const allDone = updated.length > 0 && updated.every((t) => t.completed)
    if (allDone) {
      confetti({
        particleCount: 50,
        spread: 60,
        origin: { y: 0.7 }
      })
    }
  }

  const addTodo = (e: React.FormEvent) => {
    e.preventDefault()
    if (!newTaskText.trim()) return
    const newTodo: CanvasTodoItem = {
      id: crypto.randomUUID(),
      text: newTaskText.trim(),
      completed: false
    }
    const updated = [...todos, newTodo]
    setTodos(updated)
    setNewTaskText('')
    save({ todos: updated })
  }

  const removeTodo = (todoId: string) => {
    const updated = todos.filter((t) => t.id !== todoId)
    setTodos(updated)
    save({ todos: updated })
  }

  const handleDelete = async () => {
    try {
      await db.canvasNodes.update(id, { isDeleted: true, updatedAt: Date.now(), syncStatus: 'pending' })
      syncEngine.scheduleSync(1000)
    } catch (e) {
      console.error('Error deleting todo node', e)
    }
  }

  const completedCount = todos.filter((t) => t.completed).length
  const progressPercent = todos.length === 0 ? 0 : Math.round((completedCount / todos.length) * 100)

  return (
    <div
      className={`relative w-[290px] rounded-lg transition-[box-shadow,border-color] duration-150 border ${colorScheme.bg} ${colorScheme.border}`}
      style={{
        boxShadow: selected
          ? '0 0 0 1.5px var(--app-accent), var(--app-shadow-card-hover)'
          : 'var(--app-shadow-card)'
      }}
    >
      <Handle id="top" type="source" position={Position.Top} className="!w-2.5 !h-2.5 !bg-[var(--app-accent)] !border !border-white dark:!border-zinc-800" />
      <Handle id="bottom" type="source" position={Position.Bottom} className="!w-2.5 !h-2.5 !bg-[var(--app-accent)] !border !border-white dark:!border-zinc-800" />
      <Handle id="left" type="source" position={Position.Left} className="!w-2.5 !h-2.5 !bg-[var(--app-accent)] !border !border-white dark:!border-zinc-800" />
      <Handle id="right" type="source" position={Position.Right} className="!w-2.5 !h-2.5 !bg-[var(--app-accent)] !border !border-white dark:!border-zinc-800" />

      {/* Header */}
      <div className={`flex items-center justify-between px-3 py-1.5 rounded-t-[7px] border-b ${colorScheme.header} ${colorScheme.border}`}>
        <input
          type="text"
          value={title}
          onChange={(e) => {
            setTitle(e.target.value)
            save({ title: e.target.value })
          }}
          placeholder="Lista de tareas..."
          className={`font-semibold text-xs bg-transparent border-none outline-none w-full placeholder-current/40 ${colorScheme.text}`}
        />
        <div className="flex items-center gap-0.5">
          <button
            onClick={() => setShowPalette(!showPalette)}
            className="p-1 rounded hover:bg-black/10 dark:hover:bg-white/10 opacity-70 hover:opacity-100 transition"
            title="Cambiar color"
          >
            <HighLightLinearIcon style={{ width: 12, height: 12 }} />
          </button>
          <button
            onClick={handleDelete}
            className="p-1 rounded hover:bg-rose-500/10 text-rose-500 opacity-70 hover:opacity-100 transition"
            title="Eliminar tarjeta"
          >
            <DeleteIcon style={{ width: 12, height: 12 }} />
          </button>
        </div>
      </div>

      {/* Color Palette Popover */}
      {showPalette && (
        <div
          className="absolute top-8 right-2 z-20 flex gap-1 p-1 rounded-md border shadow-md bg-[var(--app-bg-overlay)] border-[var(--app-border)]"
        >
          {COLORS.map((c) => (
            <button
              key={c}
              onClick={() => {
                setColor(c)
                setShowPalette(false)
                save({ color: c })
              }}
              className={`w-4 h-4 rounded-full border border-black/10 transition-transform ${
                COLOR_MAP[c].bg
              } ${color === c ? 'scale-125 ring-1 ring-[var(--app-accent)]' : 'hover:scale-110'}`}
            />
          ))}
        </div>
      )}

      {/* Progress Bar */}
      {todos.length > 0 && (
        <div className="px-3 pt-2">
          <div
            className="flex justify-between text-[10px] font-medium mb-1 opacity-70"
          >
            <span>Progreso</span>
            <span className="font-mono">{completedCount}/{todos.length} ({progressPercent}%)</span>
          </div>
          <div
            className="w-full h-1 rounded-full overflow-hidden bg-black/10 dark:bg-white/10"
          >
            <div
              className="h-full transition-all duration-300 bg-[var(--app-accent)]"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>
      )}

      {/* Checklist items */}
      <div className="p-3 space-y-1.5 max-h-[220px] overflow-y-auto custom-scrollbar">
        {todos.map((todo) => (
          <div key={todo.id} className="group flex items-center justify-between gap-2 text-xs">
            <button
              type="button"
              onClick={() => toggleTodo(todo.id)}
              className="flex items-center gap-2 flex-1 text-left"
            >
              <div
                className="w-3.5 h-3.5 rounded border flex items-center justify-center transition-colors shrink-0"
                style={{
                  backgroundColor: todo.completed ? 'var(--app-accent)' : 'transparent',
                  borderColor: todo.completed ? 'var(--app-accent)' : 'currentColor',
                  color: '#ffffff'
                }}
              >
                {todo.completed && <DoneIcon style={{ width: 10, height: 10 }} />}
              </div>
              <span
                className={`truncate ${todo.completed ? 'line-through opacity-50' : colorScheme.text}`}
              >
                {todo.text}
              </span>
            </button>
            <button
              type="button"
              onClick={() => removeTodo(todo.id)}
              className="opacity-0 group-hover:opacity-100 p-0.5 text-zinc-400 hover:text-rose-500 transition"
            >
              <DeleteIcon style={{ width: 11, height: 11 }} />
            </button>
          </div>
        ))}

        {/* Add item input */}
        <form
          onSubmit={addTodo}
          className="flex items-center gap-1.5 pt-2 border-t border-black/5 dark:border-white/5"
        >
          <input
            type="text"
            value={newTaskText}
            onChange={(e) => setNewTaskText(e.target.value)}
            placeholder="Añadir tarea..."
            className={`flex-1 text-xs bg-transparent border-none outline-none placeholder-current/40 ${colorScheme.text}`}
          />
          <button
            type="submit"
            className="p-1 rounded transition bg-[var(--app-hover)] hover:bg-[var(--app-hover-filled)] text-[var(--app-text-primary)]"
          >
            <PlusIcon style={{ width: 12, height: 12 }} />
          </button>
        </form>
      </div>
    </div>
  )
}, areNodePropsEqual)
