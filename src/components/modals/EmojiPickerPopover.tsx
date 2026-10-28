import { CloseIcon, DeleteIcon, ResetIcon } from '@blocksuite/icons/rc'

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
      className="absolute top-12 left-0 z-40 w-64 rounded-xl border p-3 animate-in fade-in zoom-in-95 duration-100"
      style={{
        backgroundColor: 'var(--affine-background-overlay-panel-color)',
        borderColor: 'var(--affine-border-color)',
        boxShadow: 'var(--affine-popover-shadow)',
        color: 'var(--affine-text-primary-color)'
      }}
      onClick={(e) => e.stopPropagation()}
    >
      <div
        className="flex items-center justify-between pb-2 border-b mb-2"
        style={{ borderColor: 'var(--affine-border-color)' }}
      >
        <span className="text-xs font-semibold" style={{ color: 'var(--affine-text-primary-color)' }}>
          Elegir Icono
        </span>
        <div className="flex items-center gap-1">
          <button
            onClick={handleRandom}
            className="p-1 rounded transition"
            style={{ color: 'var(--affine-text-secondary-color)' }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = 'var(--affine-hover-color)'
              e.currentTarget.style.color = 'var(--affine-text-primary-color)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent'
              e.currentTarget.style.color = 'var(--affine-text-secondary-color)'
            }}
            title="Icono aleatorio"
          >
            <ResetIcon style={{ width: 13, height: 13 }} />
          </button>
          {currentIcon && (
            <button
              onClick={() => {
                onRemoveEmoji()
                onClose()
              }}
              className="p-1 rounded text-rose-500 hover:bg-rose-500/10 transition"
              title="Quitar icono"
            >
              <DeleteIcon style={{ width: 13, height: 13 }} />
            </button>
          )}
          <button
            onClick={onClose}
            className="p-1 rounded transition"
            style={{ color: 'var(--affine-text-secondary-color)' }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = 'var(--affine-hover-color)'
              e.currentTarget.style.color = 'var(--affine-text-primary-color)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent'
              e.currentTarget.style.color = 'var(--affine-text-secondary-color)'
            }}
          >
            <CloseIcon style={{ width: 13, height: 13 }} />
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
            className="text-lg p-1.5 rounded-lg hover:scale-110 active:scale-95 transition flex items-center justify-center"
            style={{ color: 'inherit' }}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--affine-hover-color)')}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
          >
            {emoji}
          </button>
        ))}
      </div>
    </div>
  )
}
