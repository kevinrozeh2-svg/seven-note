export const READING_HUB_CHANGED_EVENT = 'seven_note_reading_hub_changed'
const READING_HUB_STORAGE_KEY = 'seven_note_admin_reading_hub_v1'

export interface RecommendedFolderRef {
  spaceId: string
  folderPath: string
}

export interface ReadingHubConfig {
  recommendedFolders: RecommendedFolderRef[]
  recommendedNoteIds: string[]
  updatedAt: number
  updatedBy?: string
}

const DEFAULT_CONFIG: ReadingHubConfig = {
  recommendedFolders: [],
  recommendedNoteIds: [],
  updatedAt: 0
}

export function getFolderRefKey(spaceId: string, folderPath: string): string {
  return `${spaceId}::${folderPath}`
}

export function loadReadingHubConfig(): ReadingHubConfig {
  if (typeof window === 'undefined') return DEFAULT_CONFIG
  try {
    const raw = localStorage.getItem(READING_HUB_STORAGE_KEY)
    if (!raw) return DEFAULT_CONFIG
    const parsed = JSON.parse(raw)
    return {
      recommendedFolders: Array.isArray(parsed?.recommendedFolders)
        ? parsed.recommendedFolders.filter(
            (f: any) => f && typeof f.spaceId === 'string' && typeof f.folderPath === 'string'
          )
        : [],
      recommendedNoteIds: Array.isArray(parsed?.recommendedNoteIds)
        ? parsed.recommendedNoteIds.filter((id: any) => typeof id === 'string' && id.trim())
        : [],
      updatedAt: Number(parsed?.updatedAt) || 0,
      updatedBy: typeof parsed?.updatedBy === 'string' ? parsed.updatedBy : undefined
    }
  } catch {
    return DEFAULT_CONFIG
  }
}

export function saveReadingHubConfig(config: ReadingHubConfig): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(READING_HUB_STORAGE_KEY, JSON.stringify(config))
  } catch {
    // ignore storage quota errors
  }
  window.dispatchEvent(new CustomEvent(READING_HUB_CHANGED_EVENT, { detail: config }))
}

export function toggleRecommendedFolder(
  spaceId: string,
  folderPath: string,
  updatedBy?: string
): ReadingHubConfig {
  const current = loadReadingHubConfig()
  const key = getFolderRefKey(spaceId, folderPath)
  const exists = current.recommendedFolders.some(
    (f) => getFolderRefKey(f.spaceId, f.folderPath) === key
  )
  const nextFolders = exists
    ? current.recommendedFolders.filter((f) => getFolderRefKey(f.spaceId, f.folderPath) !== key)
    : [...current.recommendedFolders, { spaceId, folderPath }]

  const next: ReadingHubConfig = {
    ...current,
    recommendedFolders: nextFolders,
    updatedAt: Date.now(),
    updatedBy
  }
  saveReadingHubConfig(next)
  return next
}

export function toggleRecommendedNote(
  noteId: string,
  updatedBy?: string
): ReadingHubConfig {
  const current = loadReadingHubConfig()
  const exists = current.recommendedNoteIds.includes(noteId)
  const nextIds = exists
    ? current.recommendedNoteIds.filter((id) => id !== noteId)
    : [...current.recommendedNoteIds, noteId]

  const next: ReadingHubConfig = {
    ...current,
    recommendedNoteIds: nextIds,
    updatedAt: Date.now(),
    updatedBy
  }
  saveReadingHubConfig(next)
  return next
}
