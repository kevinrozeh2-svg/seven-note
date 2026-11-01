import { memo, useState } from 'react'
import { DeleteIcon, PlusIcon, DoneIcon, HighLightLinearIcon } from '@blocksuite/icons/rc'
import confetti from 'canvas-confetti'
import { db, type CanvasTodoItem } from '../../../db'
import { syncEngine } from '../../../lib/syncEngine'
import { areNodePropsEqual, NodeHandles, SourceNodeBadge, getCardCustomStyle, isColorDark, CardSelectionOverlay } from './nodeUtils'
import { renderWithAppleEmoji } from '../../ui/AppleEmoji'

const COLOR_MAP: Record<string, { cardBorder: string; accentBar: string; badgeBg: string; badgeBorder: string; badgeText: string; dot: string; topGlow: string }> = {
  blue: {
    cardBorder: '',
    accentBar: '',
    badgeBg: 'bg-zinc-100 dark:bg-zinc-800/80',
    badgeBorder: 'border-transparent',
    badgeText: 'text-zinc-600 dark:text-zinc-400',
    dot: '#71717a',
    topGlow: ''
  },
  yellow: {
    cardBorder: '',
    accentBar: '',
    badgeBg: 'bg-zinc-100 dark:bg-zinc-800/80',
    badgeBorder: 'border-transparent',
    badgeText: 'text-zinc-600 dark:text-zinc-400',
    dot: '#71717a',
    topGlow: ''
  },
  green: {
    cardBorder: '',
    accentBar: '',
    badgeBg: 'bg-zinc-100 dark:bg-zinc-800/80',
    badgeBorder: 'border-transparent',
    badgeText: 'text-zinc-600 dark:text-zinc-400',
    dot: '#71717a',
    topGlow: ''
  },
  purple: {
    cardBorder: '',
    accentBar: '',
    badgeBg: 'bg-zinc-100 dark:bg-zinc-800/80',
    badgeBorder: 'border-transparent',
    badgeText: 'text-zinc-600 dark:text-zinc-400',
    dot: '#71717a',
    topGlow: ''
  },
  rose: {
    cardBorder: '',
    accentBar: '',
    badgeBg: 'bg-zinc-100 dark:bg-zinc-800/80',
    badgeBorder: 'border-transparent',
    badgeText: 'text-zinc-600 dark:text-zinc-400',
    dot: '#71717a',
    topGlow: ''
  },
  slate: {
    cardBorder: '',
    accentBar: '',
    badgeBg: 'bg-zinc-100 dark:bg-zinc-800/80',
    badgeBorder: 'border-transparent',
    badgeText: 'text-zinc-600 dark:text-zinc-400',
    dot: '#71717a',
    topGlow: ''
  }
}

const COLORS = ['blue', 'yellow', 'green', 'purple', 'rose', 'slate']

export const TodoNode = memo(({ id, data, selected }: any) => {
  const [title, setTitle] = useState(data.title ?? 'Tareas pendientes')
  const [todos, setTodos] = useState<CanvasTodoItem[]>(data.todos ?? [])
  const [newTaskText, setNewTaskText] = useState('')
  const [color, setColor] = useState(data.color ?? 'blue')
  const [showPalette, setShowPalette] = useState(false)
  const [isEditingTitle, setIsEditingTitle] = useState(false)

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

  const isConnectorActive = Boolean(data?.isConnectorActive)
  const isConnectSource = Boolean(data?.isConnectSource)
  const customCardStyle = getCardCustomStyle(data, 16)
  const isDarkFill = isColorDark(data?.fillColor)

  return (
    <div
      className={`group relative w-[290px] rounded-2xl transition-all duration-200 bg-white dark:bg-[#18181b] overflow-visible ${
        selected
          ? 'shadow-2xl'
          : 'shadow-[0_4px_20px_-4px_rgba(0,0,0,0.06),0_1px_3px_rgba(0,0,0,0.04)] dark:shadow-[0_8px_30px_-6px_rgba(0,0,0,0.5),0_1px_3px_rgba(0,0,0,0.3)]'
      } ${
        isConnectSource
          ? 'ring-4 ring-amber-500 shadow-2xl scale-[1.02]'
          : isConnectorActive
          ? 'ring-2 ring-blue-500/50 hover:ring-2 hover:ring-blue-500 cursor-pointer'
          : ''
      } hover:shadow-xl ${isDarkFill ? 'text-zinc-100' : ''}`}
      style={{
        ...customCardStyle
      }}
    >
      <CardSelectionOverlay selected={selected} />
      <SourceNodeBadge isConnectSource={isConnectSource} isConnectorActive={isConnectorActive} />
      <NodeHandles
        selected={selected}
        isConnectorActive={isConnectorActive}
        isConnectSource={isConnectSource}
      />

      {/* Header */}
      <div className="flex items-center justify-between px-3.5 py-2.5 border-b border-zinc-100 dark:border-zinc-800/80 relative z-10">
        <div
          className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold tracking-wide uppercase bg-zinc-100 dark:bg-zinc-800/80 text-zinc-600 dark:text-zinc-400 shadow-xs flex-1 mr-2"
        >
          <span
            className="w-1.5 h-1.5 rounded-full shrink-0 bg-zinc-400 dark:bg-zinc-500"
          />
          {isEditingTitle ? (
            <input
              autoFocus
              type="text"
              value={title}
              onChange={(e) => {
                setTitle(e.target.value)
                save({ title: e.target.value })
              }}
              onBlur={() => setIsEditingTitle(false)}
              onKeyDown={(e) => e.key === 'Enter' && setIsEditingTitle(false)}
              placeholder="Lista de tareas..."
              className="font-sans font-semibold text-[11px] bg-transparent border-none outline-none w-full truncate text-zinc-700 dark:text-zinc-300"
            />
          ) : (
            <span
              onDoubleClick={() => setIsEditingTitle(true)}
              className="font-sans font-semibold text-[11px] text-zinc-700 dark:text-zinc-300 truncate cursor-text select-text"
            >
              {renderWithAppleEmoji(title || 'Lista de tareas...')}
            </span>
          )}
        </div>
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
                color === c ? 'scale-125 ring-2 ring-[var(--app-accent)]' : 'hover:scale-110'
              }`}
              style={{ backgroundColor: COLOR_MAP[c]?.dot || '#9ca3af' }}
              title={c}
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
                className={`truncate ${
                  todo.completed
                    ? 'line-through text-zinc-400 dark:text-zinc-500'
                    : isDarkFill ? 'text-white' : 'text-zinc-800 dark:text-zinc-200'
                }`}
              >
                {renderWithAppleEmoji(todo.text)}
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
            className="flex-1 text-xs bg-transparent border-none outline-none text-zinc-800 dark:text-zinc-200 placeholder:text-zinc-400 dark:placeholder:text-zinc-500"
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
