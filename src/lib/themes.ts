export type AppThemeId =
  | 'obsidian'
  | 'midnight'
  | 'nord'
  | 'forest'
  | 'rose-velvet'
  | 'paper'
  | 'obsidian-light'

export interface AppThemeDefinition {
  id: AppThemeId
  name: string
  description: string
  mode: 'dark' | 'light'
  swatches: {
    ribbon: string
    sidebar: string
    editor: string
    accent: string
    text: string
  }
}

export const APP_THEMES: AppThemeDefinition[] = [
  {
    id: 'obsidian',
    name: 'Obsidian',
    description: 'Grafito oscuro clásico con acento violeta',
    mode: 'dark',
    swatches: {
      ribbon: '#161616',
      sidebar: '#1b1b1b',
      editor: '#1e1e1e',
      accent: '#7f6df2',
      text: '#dcddde'
    }
  },
  {
    id: 'midnight',
    name: 'Medianoche',
    description: 'Pizarra azul profundo y contraste nítido',
    mode: 'dark',
    swatches: {
      ribbon: '#0b0f17',
      sidebar: '#101622',
      editor: '#141b29',
      accent: '#6366f1',
      text: '#e2e8f0'
    }
  },
  {
    id: 'nord',
    name: 'Nord Ártico',
    description: 'Tonos nórdicos suaves y azul glaciar',
    mode: 'dark',
    swatches: {
      ribbon: '#222730',
      sidebar: '#282e39',
      editor: '#2e3440',
      accent: '#88c0d0',
      text: '#eceff4'
    }
  },
  {
    id: 'forest',
    name: 'Bosque Nocturno',
    description: 'Grafito verde pino calmado con salvia',
    mode: 'dark',
    swatches: {
      ribbon: '#101512',
      sidebar: '#151b18',
      editor: '#1a211d',
      accent: '#5fa882',
      text: '#dce3de'
    }
  },
  {
    id: 'rose-velvet',
    name: 'Rosa Nocturno',
    description: 'Ciruela terciopelo oscuro con rosa empolvado',
    mode: 'dark',
    swatches: {
      ribbon: '#130f13',
      sidebar: '#191418',
      editor: '#1f191e',
      accent: '#d97a9e',
      text: '#f0e6ec'
    }
  },
  {
    id: 'obsidian-light',
    name: 'Obsidian Claro',
    description: 'Superficies claras neutras con violeta',
    mode: 'light',
    swatches: {
      ribbon: '#eaeaea',
      sidebar: '#f5f5f5',
      editor: '#ffffff',
      accent: '#7c3aed',
      text: '#222222'
    }
  },
  {
    id: 'paper',
    name: 'Papel Cálido',
    description: 'Marfil cálido editorial con tinta carbón',
    mode: 'light',
    swatches: {
      ribbon: '#f0eee9',
      sidebar: '#f7f6f3',
      editor: '#ffffff',
      accent: '#2383e2',
      text: '#37352f'
    }
  }
]

const COLOR_THEME_KEY = 'seven_note_color_theme'
const LEGACY_THEME_KEY = 'seven_note_theme'
const LAST_DARK_KEY = 'seven_note_last_dark_theme'
const LAST_LIGHT_KEY = 'seven_note_last_light_theme'

export function getThemeById(id: string | null | undefined): AppThemeDefinition {
  return APP_THEMES.find((t) => t.id === id) || APP_THEMES[0]
}

export function getInitialThemeId(): AppThemeId {
  if (typeof window === 'undefined') return 'obsidian'
  const saved = localStorage.getItem(COLOR_THEME_KEY)
  if (saved && APP_THEMES.some((t) => t.id === saved)) {
    return saved as AppThemeId
  }
  const legacy = localStorage.getItem(LEGACY_THEME_KEY)
  if (legacy === 'light') return 'obsidian-light'
  return 'obsidian'
}

export function getToggledThemeId(currentId: AppThemeId): AppThemeId {
  const current = getThemeById(currentId)
  if (current.mode === 'dark') {
    const lastLight = localStorage.getItem(LAST_LIGHT_KEY) as AppThemeId | null
    if (lastLight && getThemeById(lastLight).mode === 'light') return lastLight
    return 'obsidian-light'
  }
  const lastDark = localStorage.getItem(LAST_DARK_KEY) as AppThemeId | null
  if (lastDark && getThemeById(lastDark).mode === 'dark') return lastDark
  return 'obsidian'
}

export function applyAppTheme(themeId: AppThemeId): AppThemeDefinition {
  const theme = getThemeById(themeId)
  if (typeof document !== 'undefined') {
    const root = document.documentElement
    root.setAttribute('data-color-theme', theme.id)
    if (theme.mode === 'dark') {
      root.classList.add('dark')
      root.setAttribute('data-theme', 'dark')
    } else {
      root.classList.remove('dark')
      root.setAttribute('data-theme', 'light')
    }
  }
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem(COLOR_THEME_KEY, theme.id)
    localStorage.setItem(LEGACY_THEME_KEY, theme.mode)
    if (theme.mode === 'dark') {
      localStorage.setItem(LAST_DARK_KEY, theme.id)
    } else {
      localStorage.setItem(LAST_LIGHT_KEY, theme.id)
    }
  }
  return theme
}
