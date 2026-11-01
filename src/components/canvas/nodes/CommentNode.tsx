import { memo, useState } from 'react'
import { MessageSquare, CornerDownRight, Trash2 } from 'lucide-react'
import { db } from '../../../db'
import { syncEngine } from '../../../lib/syncEngine'
import { toast } from 'sonner'
import { areNodePropsEqual, NodeHandles, SourceNodeBadge } from './nodeUtils'
import { renderWithAppleEmoji } from '../../ui/AppleEmoji'

export const CommentNode = memo(({ id, data, selected }: any) => {
  const [author] = useState(data.commentAuthor || 'Natali')
  const [date] = useState(data.commentDate || '16 Jan 2026')
  const [content, setContent] = useState(data.commentText || '¡Me encanta este tráiler! 💜💜')
  const [replies, setReplies] = useState<Array<{ id: string; author: string; text: string }>>(
    data.replies || []
  )
  const [isReplying, setIsReplying] = useState(false)
  const [replyText, setReplyText] = useState('')
  const [isEditingContent, setIsEditingContent] = useState(false)

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
      console.error('Error saving comment node', e)
    }
  }

  const handleDelete = async () => {
    try {
      await db.canvasNodes.update(id, { isDeleted: true, updatedAt: Date.now(), syncStatus: 'pending' })
      syncEngine.scheduleSync(1000)
    } catch (e) {
      console.error('Error deleting comment node', e)
    }
  }

  const handleSendReply = (e: React.FormEvent) => {
    e.preventDefault()
    if (!replyText.trim()) return
    const newReply = {
      id: crypto.randomUUID(),
      author: 'Tú',
      text: replyText.trim()
    }
    const updated = [...replies, newReply]
    setReplies(updated)
    save({ replies: updated })
    setReplyText('')
    setIsReplying(false)
    toast.success('Respuesta agregada')
  }

  const isConnectorActive = Boolean(data?.isConnectorActive)
  const isConnectSource = Boolean(data?.isConnectSource)

  return (
    <div
      className={`group relative w-[280px] rounded-xl bg-white dark:bg-[#282828] p-3.5 transition-[box-shadow] duration-150 ${
        selected ? 'ring-2 ring-[var(--app-accent)] shadow-xl' : 'shadow-[0_2px_10px_rgba(0,0,0,0.06)] dark:shadow-[0_4px_16px_rgba(0,0,0,0.35)]'
      } ${
        isConnectSource
          ? 'ring-4 ring-amber-500 shadow-2xl scale-[1.02]'
          : isConnectorActive
          ? 'ring-2 ring-blue-500/50 hover:ring-2 hover:ring-blue-500 cursor-pointer'
          : ''
      }`}
    >
      <SourceNodeBadge isConnectSource={isConnectSource} isConnectorActive={isConnectorActive} />
      <NodeHandles
        selected={selected}
        isConnectorActive={isConnectorActive}
        isConnectSource={isConnectSource}
      />

      {/* Floating delete button */}
      <button
        onClick={handleDelete}
        className="absolute -top-2 -right-2 p-1.5 rounded-full bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 text-neutral-400 hover:text-rose-500 shadow-sm opacity-0 group-hover:opacity-100 transition z-10"
        title="Eliminar comentario"
      >
        <Trash2 className="w-3 h-3" />
      </button>

      {/* Header: User avatar + Author + Date + Thread icon */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-full bg-amber-500 text-white font-bold text-xs flex items-center justify-center shrink-0 shadow-xs">
            {author.charAt(0)}
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-xs font-semibold text-neutral-900 dark:text-neutral-100">
              {author}
            </span>
            <span className="text-[10px] text-neutral-400">
              {date}
            </span>
          </div>
        </div>

        <MessageSquare className="w-3.5 h-3.5 text-neutral-400" />
      </div>

      {/* Comment Body */}
      <div className="text-xs text-neutral-800 dark:text-neutral-200 mb-2 leading-relaxed">
        {isEditingContent ? (
          <textarea
            autoFocus
            value={content}
            onChange={(e) => {
              setContent(e.target.value)
              save({ commentText: e.target.value })
            }}
            onBlur={() => setIsEditingContent(false)}
            rows={2}
            className="w-full bg-transparent border-none outline-none resize-none text-xs text-neutral-800 dark:text-neutral-200 p-0 leading-relaxed"
          />
        ) : (
          <div
            onDoubleClick={() => setIsEditingContent(true)}
            className="cursor-text select-text whitespace-pre-wrap leading-relaxed"
          >
            {renderWithAppleEmoji(content)}
          </div>
        )}
      </div>

      {/* Replies list */}
      {replies.length > 0 && (
        <div className="space-y-1.5 pt-2 border-t border-neutral-100 dark:border-neutral-800 mb-2">
          {replies.map((r) => (
            <div key={r.id} className="text-[11px] bg-neutral-50 dark:bg-neutral-800/60 p-1.5 rounded-md flex items-start gap-1.5">
              <span className="font-semibold text-neutral-700 dark:text-neutral-300">{r.author}:</span>
              <span className="text-neutral-600 dark:text-neutral-400">{renderWithAppleEmoji(r.text)}</span>
            </div>
          ))}
        </div>
      )}

      {/* Responder action */}
      {isReplying ? (
        <form onSubmit={handleSendReply} className="pt-1.5 flex gap-1">
          <input
            type="text"
            value={replyText}
            autoFocus
            onChange={(e) => setReplyText(e.target.value)}
            placeholder="Escribe una respuesta..."
            className="flex-1 text-[11px] bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded px-2 py-1 outline-none text-neutral-800 dark:text-neutral-200"
          />
          <button
            type="submit"
            className="px-2 py-1 text-[11px] font-medium rounded bg-blue-500 text-white hover:bg-blue-600 transition"
          >
            Enviar
          </button>
        </form>
      ) : (
        <button
          onClick={() => setIsReplying(true)}
          className="text-xs text-blue-500 hover:text-blue-600 dark:text-blue-400 font-medium hover:underline inline-flex items-center gap-1"
        >
          <CornerDownRight className="w-3 h-3" />
          <span>Responder</span>
        </button>
      )}
    </div>
  )
}, areNodePropsEqual)
