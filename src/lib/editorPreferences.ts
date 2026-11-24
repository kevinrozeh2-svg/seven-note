export type EditorFontFamily = 'sans' | 'serif' | 'mono'
export type EditorFontSize = '14' | '15' | '16' | '18'
export type EditorLineHeight = 'compact' | 'comfortable' | 'relaxed'

export interface EditorPreferences {
  editorFont: EditorFontFamily
  editorFontSize: EditorFontSize
  editorLineHeight: EditorLineHeight
  defaultPageWidth: 'standard' | 'full'
  defaultViewMode: 'doc' | 'canvas'
  defaultPrivate: boolean
  spellCheck: boolean
  reduceMotion: boolean
}

export const DEFAULT_EDITOR_PREFERENCES: EditorPreferences = {
  editorFont: 'sans',
  editorFontSize: '15',
  editorLineHeight: 'comfortable',
  defaultPageWidth: 'full',
  defaultViewMode: 'doc',
  defaultPrivate: false,
  spellCheck: true,
  reduceMotion: false
}

const STORAGE_KEY = 'seven_note_editor_prefs'
export const EDITOR_PREFS_CHANGED_EVENT = 'seven-note:editor-prefs-changed'

const FONT_STACKS: Record<EditorFontFamily, string> = {
  sans: 'var(--app-font-sans)',
  serif: 'var(--app-font-serif)',
  mono: 'var(--app-font-mono)'
}

const LINE_HEIGHTS: Record<EditorLineHeight, string> = {
  compact: '1.45',
  comfortable: '1.65',
  relaxed: '1.85'
}

export function getEditorPreferences(): EditorPreferences {
  if (typeof window === 'undefined') return DEFAULT_EDITOR_PREFERENCES
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return DEFAULT_EDITOR_PREFERENCES
    const parsed = JSON.parse(raw) as Partial<EditorPreferences>
    return {
      ...DEFAULT_EDITOR_PREFERENCES,
      ...parsed
    }
  } catch {
    return DEFAULT_EDITOR_PREFERENCES
  }
}

export function applyEditorPreferences(prefs: EditorPreferences): void {
  if (typeof document === 'undefined') return
  const root = document.documentElement
  root.style.setProperty('--sn-editor-font', FONT_STACKS[prefs.editorFont] || FONT_STACKS.sans)
  root.style.setProperty('--sn-editor-font-size', `${prefs.editorFontSize || '15'}px`)
  root.style.setProperty(
    '--sn-editor-line-height',
    LINE_HEIGHTS[prefs.editorLineHeight] || LINE_HEIGHTS.comfortable
  )
  if (prefs.reduceMotion) {
    root.setAttribute('data-reduce-motion', 'true')
  } else {
    root.removeAttribute('data-reduce-motion')
  }
}

export function updateEditorPreferences(patch: Partial<EditorPreferences>): EditorPreferences {
  const next: EditorPreferences = {
    ...getEditorPreferences(),
    ...patch
  }
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
  }
  applyEditorPreferences(next)
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(EDITOR_PREFS_CHANGED_EVENT, { detail: next }))
  }
  return next
}

export function subscribeEditorPreferences(
  listener: (prefs: EditorPreferences) => void
): () => void {
  if (typeof window === 'undefined') return () => {}
  const handler = (e: Event) => {
    const detail = (e as CustomEvent<EditorPreferences>).detail
    listener(detail || getEditorPreferences())
  }
  window.addEventListener(EDITOR_PREFS_CHANGED_EVENT, handler)
  return () => window.removeEventListener(EDITOR_PREFS_CHANGED_EVENT, handler)
}
