import { X, Shuffle, Trash2 } from 'lucide-react'

const POPULAR_EMOJIS = [
  '📄', '📝', '🚀', '💡', '🎨', '📊', '🎯', '⭐', '📚', '🔥',
  '💻', '🛠️', '🏷️', '🧠', '📌', '🧩', '⚡', '☕', '🌟', '🏆',
  '🔍', '🔔', '💬', '📂', '📅', '💼', '🧪', '✨', '🌍', '❤️',
  '🔑', '💎', '📈', '📋', '⚙️', '🎁', '🎧', '🥑', '🌱', '🛸'
]

interface EmojiPickerPopoverProps {
  currentIcon?: string
  isOpen: boolean
  onClose: () => void
  onSelectEmoji: (emoji: string) => void
  onRemoveEmoji: () => void
}

export function EmojiPickerPopover({
  currentIcon,
  isOpen,
  onClose,
  onSelectEmoji,
  onRemoveEmoji
}: EmojiPickerPopoverProps) {
  if (!isOpen) return null

  const handleRandom = () => {
    const randomIndex = Math.floor(Math.random() * POPULAR_EMOJIS.length)
    onSelectEmoji(POPULAR_EMOJIS[randomIndex])
    onClose()
  }

  return (
    <div
      className="absolute top-12 left-0 z-40 w-64 bg-[#18181b] border border-[#27272a] rounded-xl shadow-2xl p-3 animate-in fade-in zoom-in-95 duration-100"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="flex items-center justify-between pb-2 border-b border-[#27272a] mb-2">
        <span className="text-xs font-semibold text-zinc-200">Elegir Icono</span>
        <div className="flex items-center gap-1">
          <button
            onClick={handleRandom}
            className="p-1 rounded text-zinc-400 hover:text-zinc-200 hover:bg-[#27272a] transition"
            title="Icono aleatorio"
          >
            <Shuffle size={13} />
          </button>
          {currentIcon && (
            <button
              onClick={() => {
                onRemoveEmoji()
                onClose()
              }}
              className="p-1 rounded text-rose-400 hover:text-rose-300 hover:bg-rose-950/40 transition"
              title="Quitar icono"
            >
              <Trash2 size={13} />
            </button>
          )}
          <button
            onClick={onClose}
            className="p-1 rounded text-zinc-400 hover:text-zinc-200 hover:bg-[#27272a] transition"
          >
            <X size={13} />
          </button>
        </div>
      </div>

      {/* Grid of emojis */}
      <div className="grid grid-cols-6 gap-1 max-h-48 overflow-y-auto p-1">
        {POPULAR_EMOJIS.map((emoji) => (
          <button
            key={emoji}
            onClick={() => {
              onSelectEmoji(emoji)
              onClose()
            }}
            className="text-lg p-1.5 rounded-lg hover:bg-[#28282e] hover:scale-110 active:scale-95 transition flex items-center justify-center"
          >
            {emoji}
          </button>
        ))}
      </div>
    </div>
  )
}
