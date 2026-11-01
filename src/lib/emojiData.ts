import emojiDataset from './emojiDataset.json'

export interface EmojiEntry {
  id: string
  name: string
  emoji: string
  category: string
  keywords: string[]
}

export interface EmojiCategory {
  id: string
  name: string
  icon: string
}

export const EMOJI_CATEGORIES: EmojiCategory[] = [
  { id: 'frequent', name: 'Recientes', icon: '🕒' },
  { id: 'people', name: 'Personas', icon: '😀' },
  { id: 'nature', name: 'Naturaleza', icon: '🐶' },
  { id: 'foods', name: 'Comida', icon: '🍔' },
  { id: 'activity', name: 'Actividades', icon: '⚽' },
  { id: 'places', name: 'Viajes', icon: '✈️' },
  { id: 'objects', name: 'Objetos', icon: '💡' },
  { id: 'symbols', name: 'Símbolos', icon: '🔣' },
  { id: 'flags', name: 'Banderas', icon: '🏁' }
]

const ALL_EMOJIS_RAW: EmojiEntry[] = emojiDataset as EmojiEntry[]

// Normalize search text (lowercase, strip diacritics/accents)
function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
}

// Pre-index emojis with search keys for instant zero-lag lookup
export interface IndexedEmojiEntry extends EmojiEntry {
  searchKey: string
}

export const ALL_EMOJIS: IndexedEmojiEntry[] = ALL_EMOJIS_RAW.map((item) => {
  const parts = [
    item.id,
    item.name,
    item.emoji,
    item.category,
    ...(item.keywords || [])
  ]
  return {
    ...item,
    searchKey: normalizeText(parts.join(' '))
  }
})

// Emojis grouped by category for fast lookups
export const EMOJIS_BY_CATEGORY: Record<string, IndexedEmojiEntry[]> = {
  people: ALL_EMOJIS.filter((e) => e.category === 'people'),
  nature: ALL_EMOJIS.filter((e) => e.category === 'nature'),
  foods: ALL_EMOJIS.filter((e) => e.category === 'foods'),
  activity: ALL_EMOJIS.filter((e) => e.category === 'activity'),
  places: ALL_EMOJIS.filter((e) => e.category === 'places'),
  objects: ALL_EMOJIS.filter((e) => e.category === 'objects'),
  symbols: ALL_EMOJIS.filter((e) => e.category === 'symbols'),
  flags: ALL_EMOJIS.filter((e) => e.category === 'flags')
}

const RECENT_KEY = 'seven_note_recent_emojis'
const DEFAULT_RECENTS = ['✨', '🤍', '🫧', '🎧', '🪐', '🧸', '🌿', '☕', '💼', '🚀', '💡', '🎨', '🔥', '❤️', '👏', '✅']

export function getRecentEmojis(): string[] {
  try {
    const raw = localStorage.getItem(RECENT_KEY)
    if (!raw) return DEFAULT_RECENTS
    const parsed = JSON.parse(raw)
    if (Array.isArray(parsed) && parsed.length > 0) {
      return parsed
    }
  } catch (_) {}
  return DEFAULT_RECENTS
}

export function addRecentEmoji(emoji: string) {
  try {
    const recents = getRecentEmojis().filter((e) => e !== emoji)
    recents.unshift(emoji)
    localStorage.setItem(RECENT_KEY, JSON.stringify(recents.slice(0, 36)))
  } catch (_) {}
}

export function searchEmojis(query: string, maxResults = 120): IndexedEmojiEntry[] {
  const clean = normalizeText(query)
  if (!clean) return []

  // Check if query is a direct emoji character
  const exact = ALL_EMOJIS.filter((e) => e.emoji === query.trim())
  if (exact.length > 0) return exact

  const results: IndexedEmojiEntry[] = []
  const queryTokens = clean.split(/\s+/).filter(Boolean)

  for (const item of ALL_EMOJIS) {
    // All tokens must match search key
    const matchesAll = queryTokens.every((token) => item.searchKey.includes(token))
    if (matchesAll) {
      results.push(item)
      if (results.length >= maxResults) break
    }
  }

  return results
}

export function getRandomEmoji(): string {
  const idx = Math.floor(Math.random() * ALL_EMOJIS.length)
  return ALL_EMOJIS[idx]?.emoji || '✨'
}
