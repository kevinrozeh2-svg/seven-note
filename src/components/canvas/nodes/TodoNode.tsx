import { memo, useState } from 'react'
import { Handle, Position } from '@xyflow/react'
import { Trash2, Plus, Check, Palette } from 'lucide-react'
import confetti from 'canvas-confetti'
import { db, type CanvasTodoItem } from '../../../db'
import { syncEngine } from '../../../lib/syncEngine'

const COLOR_MAP: Record<string, { bg: string; border: string; header: string; text: string }> = {
  blue: { bg: 'bg-sky-50 dark:bg-sky-950/40', border: 'border-sky-200 dark:border-sky-800', header: 'bg-sky-100/70 dark:bg-sky-900/40', text: 'text-sky-900 dark:text-sky-100' },
  yellow: { bg: 'bg-amber-50 dark:bg-amber-950/40', border: 'border-amber-200 dark:border-amber-800', header: 'bg-amber-100/70 dark:bg-amber-900/40', text: 'text-amber-900 dark:text-amber-100' },
  green: { bg: 'bg-emerald-50 dark:bg-emerald-950/40', border: 'border-emerald-200 dark:border-emerald-800', header: 'bg-emerald-100/70 dark:bg-emerald-900/40', text: 'text-emerald-900 dark:text-emerald-100' },
  purple: { bg: 'bg-purple-50 dark:bg-purple-950/40', border: 'border-purple-200 dark:border-purple-800', header: 'bg-purple-100/70 dark:bg-purple-900/40', text: 'text-purple-900 dark:text-purple-100' },
  rose: { bg: 'bg-rose-50 dark:bg-rose-950/40', border: 'border-rose-200 dark:border-rose-800', header: 'bg-rose-100/70 dark:bg-rose-900/40', text: 'text-rose-900 dark:text-rose-100' },
  slate: { bg: 'bg-slate-50 dark:bg-slate-900', border: 'border-slate-200 dark:border-slate-800', header: 'bg-slate-100 dark:bg-slate-800', text: 'text-slate-900 dark:text-slate-100' }
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
        particleCount: 60,
        spread: 70,
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
      className={`relative w-[300px] rounded-xl shadow-md transition-all duration-150 border-2 ${colorScheme.bg} ${colorScheme.border} ${
        selected ? 'ring-2 ring-indigo-500 ring-offset-2 dark:ring-offset-slate-950 shadow-xl' : 'hover:shadow-lg'
      }`}
    >
      <Handle type="target" position={Position.Top} className="!w-3 !h-3 !bg-indigo-500 !border-2 !border-white dark:!border-slate-900" />
      <Handle type="source" position={Position.Bottom} className="!w-3 !h-3 !bg-indigo-500 !border-2 !border-white dark:!border-slate-900" />
      <Handle type="target" position={Position.Left} className="!w-3 !h-3 !bg-indigo-500 !border-2 !border-white dark:!border-slate-900" />
      <Handle type="source" position={Position.Right} className="!w-3 !h-3 !bg-indigo-500 !border-2 !border-white dark:!border-slate-900" />

      {/* Header */}
      <div className={`flex items-center justify-between px-3 py-2 rounded-t-[10px] border-b ${colorScheme.header} ${colorScheme.border}`}>
        <input
          type="text"
          value={title}
          onChange={(e) => {
            setTitle(e.target.value)
            save({ title: e.target.value })
          }}
          placeholder="Lista de tareas..."
          className="font-semibold text-sm bg-transparent border-none outline-none w-full text-slate-800 dark:text-slate-100"
        />
        <div className="flex items-center gap-1">
          <button
            onClick={() => setShowPalette(!showPalette)}
            className="p-1 rounded hover:bg-black/10 dark:hover:bg-white/10 text-slate-500 dark:text-slate-400"
            title="Cambiar color"
          >
            <Palette size={13} />
          </button>
          <button
            onClick={handleDelete}
            className="p-1 rounded hover:bg-rose-500/20 text-slate-500 hover:text-rose-600 transition"
            title="Eliminar tarjeta"
          >
            <Trash2 size={13} />
          </button>
        </div>
      </div>

      {/* Color Palette Popover */}
      {showPalette && (
        <div className="absolute top-10 right-2 z-20 flex gap-1 p-1.5 bg-white dark:bg-slate-800 rounded-lg shadow-xl border border-slate-200 dark:border-slate-700">
          {COLORS.map((c) => (
            <button
              key={c}
              onClick={() => {
                setColor(c)
                setShowPalette(false)
                save({ color: c })
              }}
              className={`w-5 h-5 rounded-full border border-black/10 transition-transform ${
                COLOR_MAP[c].bg
              } ${color === c ? 'scale-125 ring-2 ring-indigo-500' : 'hover:scale-110'}`}
            />
          ))}
        </div>
      )}

      {/* Progress Bar */}
      {todos.length > 0 && (
        <div className="px-3 pt-2">
          <div className="flex justify-between text-[11px] font-medium text-slate-500 dark:text-slate-400 mb-1">
            <span>Progreso</span>
            <span>{completedCount}/{todos.length} ({progressPercent}%)</span>
          </div>
          <div className="w-full bg-slate-200 dark:bg-slate-700 h-1.5 rounded-full overflow-hidden">
            <div
              className="bg-indigo-500 h-full transition-all duration-300"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>
      )}

      {/* Checklist items */}
      <div className="p-3 space-y-1.5 max-h-[220px] overflow-y-auto">
        {todos.map((todo) => (
          <div key={todo.id} className="group flex items-center justify-between gap-2 text-xs">
            <button
              type="button"
              onClick={() => toggleTodo(todo.id)}
              className="flex items-center gap-2 flex-1 text-left"
            >
              <div
                className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${
                  todo.completed
                    ? 'bg-indigo-600 border-indigo-600 text-white'
                    : 'border-slate-400 dark:border-slate-500 hover:border-indigo-500'
                }`}
              >
                {todo.completed && <Check size={11} strokeWidth={3} />}
              </div>
              <span
                className={`truncate ${
                  todo.completed
                    ? 'line-through text-slate-400 dark:text-slate-500'
                    : 'text-slate-700 dark:text-slate-200'
                }`}
              >
                {todo.text}
              </span>
            </button>
            <button
              type="button"
              onClick={() => removeTodo(todo.id)}
              className="opacity-0 group-hover:opacity-100 p-0.5 text-slate-400 hover:text-rose-500 transition"
            >
              <Trash2 size={11} />
            </button>
          </div>
        ))}

        {/* Add item input */}
        <form onSubmit={addTodo} className="flex items-center gap-1.5 pt-2 border-t border-slate-200/60 dark:border-slate-700/60">
          <input
            type="text"
            value={newTaskText}
            onChange={(e) => setNewTaskText(e.target.value)}
            placeholder="Añadir tarea y Enter..."
            className="flex-1 text-xs bg-transparent border-none outline-none text-slate-800 dark:text-slate-100 placeholder-slate-400"
          />
          <button
            type="submit"
            className="p-1 rounded bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-500/20 transition"
          >
            <Plus size={12} />
          </button>
        </form>
      </div>
    </div>
  )
})
