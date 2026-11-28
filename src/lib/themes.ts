export type AppThemeId =
  | 'obsidian'
  | 'midnight'
  | 'nord'
  | 'forest'
  | 'rose-velvet'
  | 'obsidian-light'
  | 'paper'
  | 'dracula'
  | 'espresso'
  | 'abyssal'
  | 'matcha'
  | 'sakura'
  | 'lavender-mist'
  | 'terracotta'
  | 'cyberpunk'
  | 'synthwave'
  | 'matrix'
  | 'aurora-glass'
  | 'sakura-zen'
  | 'blueprint'
  | 'golden-noir'

export type AppThemeCategory = 'classic' | 'colorful' | 'exotic'

export type AppThemeFx =
  | 'none'
  | 'cyberpunk'
  | 'synthwave'
  | 'matrix'
  | 'aurora'
  | 'zen-petals'
  | 'blueprint'
  | 'art-deco'

export interface AppThemeDefinition {
  id: AppThemeId
  name: string
  description: string
  mode: 'dark' | 'light'
  category: AppThemeCategory
  fx: AppThemeFx
  badge?: string
  features?: string[]
  swatches: {
    ribbon: string
    sidebar: string
    editor: string
    accent: string
    text: string
    secondary?: string
  }
}

export interface AccentPreset {
  id: string
  name: string
  color: string
  hover: string
  soft: string
}

export const ACCENT_PRESETS: AccentPreset[] = [
  {
    id: 'violet',
    name: 'Violeta',
    color: '#7c3aed',
    hover: '#9061f9',
    soft: 'rgba(124, 58, 237, 0.18)'
  },
  {
    id: 'blue',
    name: 'Azul',
    color: '#3b82f6',
    hover: '#60a5fa',
    soft: 'rgba(59, 130, 246, 0.18)'
  },
  {
    id: 'cyan',
    name: 'Cian',
    color: '#06b6d4',
    hover: '#22d3ee',
    soft: 'rgba(6, 182, 212, 0.18)'
  },
  {
    id: 'emerald',
    name: 'Esmeralda',
    color: '#10b981',
    hover: '#34d399',
    soft: 'rgba(16, 185, 129, 0.18)'
  },
  {
    id: 'amber',
    name: 'Ámbar',
    color: '#f59e0b',
    hover: '#fbbf24',
    soft: 'rgba(245, 158, 11, 0.18)'
  },
  {
    id: 'coral',
    name: 'Coral',
    color: '#f97316',
    hover: '#fb923c',
    soft: 'rgba(249, 115, 22, 0.18)'
  },
  {
    id: 'rose',
    name: 'Rosa',
    color: '#f43f5e',
    hover: '#fb7185',
    soft: 'rgba(244, 63, 94, 0.18)'
  },
  {
    id: 'fuchsia',
    name: 'Fucsia',
    color: '#d946ef',
    hover: '#e879f9',
    soft: 'rgba(217, 70, 239, 0.18)'
  },
  {
    id: 'gold',
    name: 'Dorado',
    color: '#d4af37',
    hover: '#e6c65a',
    soft: 'rgba(212, 175, 55, 0.2)'
  }
]

export const APP_THEMES: AppThemeDefinition[] = [
  // ── Clásicos (7) ──────────────────────────────────────────────────────────
  {
    id: 'obsidian',
    name: 'Obsidian',
    description: 'Grafito oscuro clásico con acento violeta',
    mode: 'dark',
    category: 'classic',
    fx: 'none',
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
    category: 'classic',
    fx: 'none',
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
    category: 'classic',
    fx: 'none',
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
    category: 'classic',
    fx: 'none',
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
    category: 'classic',
    fx: 'none',
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
    category: 'classic',
    fx: 'none',
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
    category: 'classic',
    fx: 'none',
    swatches: {
      ribbon: '#f0eee9',
      sidebar: '#f7f6f3',
      editor: '#ffffff',
      accent: '#2383e2',
      text: '#37352f'
    }
  },

  // ── Colores (7) ───────────────────────────────────────────────────────────
  {
    id: 'dracula',
    name: 'Drácula',
    description: 'Violeta nocturno vibrante con chispas neón pastel',
    mode: 'dark',
    category: 'colorful',
    fx: 'none',
    swatches: {
      ribbon: '#191a24',
      sidebar: '#21222c',
      editor: '#282a36',
      accent: '#bd93f9',
      text: '#f8f8f2',
      secondary: '#ff79c6'
    }
  },
  {
    id: 'espresso',
    name: 'Espresso Tostado',
    description: 'Cacao cálido y crema tostada con acento caramelo',
    mode: 'dark',
    category: 'colorful',
    fx: 'none',
    swatches: {
      ribbon: '#14100d',
      sidebar: '#1b1511',
      editor: '#221b16',
      accent: '#d98a4e',
      text: '#f2e8dc',
      secondary: '#eab308'
    }
  },
  {
    id: 'abyssal',
    name: 'Abisal Turquesa',
    description: 'Profundidad oceánica azul petróleo y turquesa vivo',
    mode: 'dark',
    category: 'colorful',
    fx: 'none',
    swatches: {
      ribbon: '#07131a',
      sidebar: '#0a1b24',
      editor: '#0e222e',
      accent: '#14b8a6',
      text: '#e0f2fe',
      secondary: '#38bdf8'
    }
  },
  {
    id: 'matcha',
    name: 'Matcha Cremoso',
    description: 'Verde té botánico suave sobre papel crema',
    mode: 'light',
    category: 'colorful',
    fx: 'none',
    swatches: {
      ribbon: '#e7ece2',
      sidebar: '#f1f5ec',
      editor: '#fafcf7',
      accent: '#4d7c4f',
      text: '#243127',
      secondary: '#65a30d'
    }
  },
  {
    id: 'sakura',
    name: 'Sakura Pastel',
    description: 'Rubor floral primaveral con tinta ciruela suave',
    mode: 'light',
    category: 'colorful',
    fx: 'none',
    swatches: {
      ribbon: '#f5e6eb',
      sidebar: '#fbf1f4',
      editor: '#fff9fb',
      accent: '#db2777',
      text: '#3a222b',
      secondary: '#f472b6'
    }
  },
  {
    id: 'lavender-mist',
    name: 'Niebla Lavanda',
    description: 'Lila etéreo luminoso con acento amatista',
    mode: 'light',
    category: 'colorful',
    fx: 'none',
    swatches: {
      ribbon: '#eae6f6',
      sidebar: '#f3f0fb',
      editor: '#fbfaff',
      accent: '#6d28d9',
      text: '#2a243d',
      secondary: '#8b5cf6'
    }
  },
  {
    id: 'terracotta',
    name: 'Terracota Sol',
    description: 'Arena mediterránea cálida y arcilla quemada',
    mode: 'light',
    category: 'colorful',
    fx: 'none',
    swatches: {
      ribbon: '#efe5da',
      sidebar: '#f7f0e8',
      editor: '#fdfaf6',
      accent: '#c25934',
      text: '#3d2b22',
      secondary: '#d97706'
    }
  },

  // ── Exóticos (7) ──────────────────────────────────────────────────────────
  {
    id: 'cyberpunk',
    name: 'Cyberpunk 2099',
    description: 'Cian eléctrico, magenta neón, HUD angular y scanlines',
    mode: 'dark',
    category: 'exotic',
    fx: 'cyberpunk',
    badge: 'Neón HUD',
    features: ['Bordes angulares', 'Glow cian', 'Esquinas HUD'],
    swatches: {
      ribbon: '#070610',
      sidebar: '#0d0a1c',
      editor: '#120e24',
      accent: '#00f0ff',
      text: '#eef6ff',
      secondary: '#ff2a85'
    }
  },
  {
    id: 'synthwave',
    name: 'Synthwave 84',
    description: 'Atardecer retro ochentero con horizonte y grilla láser',
    mode: 'dark',
    category: 'exotic',
    fx: 'synthwave',
    badge: 'Retro 84',
    features: ['Grilla 3D', 'Botones degradé', 'Títulos neón'],
    swatches: {
      ribbon: '#140b24',
      sidebar: '#1c1033',
      editor: '#241440',
      accent: '#ff4fd8',
      text: '#f7ebff',
      secondary: '#ff9e64'
    }
  },
  {
    id: 'matrix',
    name: 'Terminal Matrix',
    description: 'Tipografía monospace total, fósforo verde y lluvia binaria',
    mode: 'dark',
    category: 'exotic',
    fx: 'matrix',
    badge: 'CRT',
    features: ['UI Monospace', 'Bordes fósforo', 'Lluvia lateral'],
    swatches: {
      ribbon: '#020804',
      sidebar: '#051008',
      editor: '#07160b',
      accent: '#00ff66',
      text: '#b8ffd0',
      secondary: '#10b981'
    }
  },
  {
    id: 'aurora-glass',
    name: 'Aurora Cristal',
    description: 'Paneles translúcidos glassmorphism y cortinas boreales',
    mode: 'dark',
    category: 'exotic',
    fx: 'aurora',
    badge: 'Cristal',
    features: ['Glassmorphism', 'Auroras vivas', 'Bordes hielo'],
    swatches: {
      ribbon: '#080e19',
      sidebar: '#0e1626',
      editor: '#0c1424',
      accent: '#2dd4bf',
      text: '#ebf5ff',
      secondary: '#a78bfa'
    }
  },
  {
    id: 'sakura-zen',
    name: 'Sakura Zen',
    description: 'Encabezados serif editoriales y pétalos flotantes',
    mode: 'light',
    category: 'exotic',
    fx: 'zen-petals',
    badge: 'Pétalos',
    features: ['Títulos Serif', 'Citas florales', 'Pétalos suaves'],
    swatches: {
      ribbon: '#f2e4e8',
      sidebar: '#f8eef1',
      editor: '#fdf8fa',
      accent: '#e11d64',
      text: '#2c1d24',
      secondary: '#f472b6'
    }
  },
  {
    id: 'blueprint',
    name: 'Plano Técnico',
    description: 'Papel azul CAD con cuadrícula arquitectónica y miras',
    mode: 'dark',
    category: 'exotic',
    fx: 'blueprint',
    badge: 'CAD',
    features: ['Grilla CAD', 'Miras y ejes', 'Etiquetas mono'],
    swatches: {
      ribbon: '#091b34',
      sidebar: '#0d2445',
      editor: '#102c54',
      accent: '#38bdf8',
      text: '#f0f7ff',
      secondary: '#9ec5f0'
    }
  },
  {
    id: 'golden-noir',
    name: 'Art Déco Dorado',
    description: 'Obsidiana nocturna con oro cepillado y filigranas déco',
    mode: 'dark',
    category: 'exotic',
    fx: 'art-deco',
    badge: 'Lujo',
    features: ['Oro cepillado', 'Títulos Serif', 'Marcos Déco'],
    swatches: {
      ribbon: '#090806',
      sidebar: '#110f0c',
      editor: '#16130f',
      accent: '#d4af37',
      text: '#f5eee2',
      secondary: '#f59e0b'
    }
  }
]

const COLOR_THEME_KEY = 'seven_note_color_theme'
const LEGACY_THEME_KEY = 'seven_note_theme'
const LAST_DARK_KEY = 'seven_note_last_dark_theme'
const LAST_LIGHT_KEY = 'seven_note_last_light_theme'
const THEME_EFFECTS_KEY = 'seven_note_theme_effects'
const CUSTOM_ACCENT_KEY = 'seven_note_custom_accent'

export const THEME_CHANGED_EVENT = 'seven-note:theme-changed'

export interface ThemeChangeDetail {
  theme: AppThemeDefinition
  effectsEnabled: boolean
  customAccentId: string | null
}

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

export function getThemeEffectsEnabled(): boolean {
  if (typeof localStorage === 'undefined') return true
  const raw = localStorage.getItem(THEME_EFFECTS_KEY)
  return raw !== 'false'
}

export function setThemeEffectsEnabled(enabled: boolean): void {
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem(THEME_EFFECTS_KEY, enabled ? 'true' : 'false')
  }
}

export function getCustomAccentId(): string | null {
  if (typeof localStorage === 'undefined') return null
  const raw = localStorage.getItem(CUSTOM_ACCENT_KEY)
  if (!raw) return null
  return ACCENT_PRESETS.some((p) => p.id === raw) ? raw : null
}

export function setCustomAccentId(accentId: string | null): void {
  if (typeof localStorage === 'undefined') return
  if (accentId && ACCENT_PRESETS.some((p) => p.id === accentId)) {
    localStorage.setItem(CUSTOM_ACCENT_KEY, accentId)
  } else {
    localStorage.removeItem(CUSTOM_ACCENT_KEY)
  }
}

export function getRandomThemeId(currentId: AppThemeId): AppThemeId {
  const candidates = APP_THEMES.filter((t) => t.id !== currentId)
  if (candidates.length === 0) return currentId
  const pick = candidates[Math.floor(Math.random() * candidates.length)]
  return pick.id
}

export function applyAppTheme(themeId: AppThemeId): AppThemeDefinition {
  const theme = getThemeById(themeId)
  const effectsEnabled = getThemeEffectsEnabled()
  const customAccentId = getCustomAccentId()
  const customAccent = customAccentId ? ACCENT_PRESETS.find((p) => p.id === customAccentId) || null : null

  if (typeof document !== 'undefined') {
    const root = document.documentElement
    root.setAttribute('data-color-theme', theme.id)
    root.setAttribute('data-theme-fx', theme.fx)
    root.setAttribute('data-theme-effects', effectsEnabled ? 'on' : 'off')

    if (theme.mode === 'dark') {
      root.classList.add('dark')
      root.setAttribute('data-theme', 'dark')
    } else {
      root.classList.remove('dark')
      root.setAttribute('data-theme', 'light')
    }

    if (customAccent) {
      root.style.setProperty('--app-accent', customAccent.color)
      root.style.setProperty('--app-accent-hover', customAccent.hover)
      root.style.setProperty('--app-accent-soft', customAccent.soft)
    } else {
      root.style.removeProperty('--app-accent')
      root.style.removeProperty('--app-accent-hover')
      root.style.removeProperty('--app-accent-soft')
    }

    const metaTheme = document.querySelector('meta[name="theme-color"]')
    if (metaTheme) {
      metaTheme.setAttribute('content', theme.swatches.ribbon)
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

  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent<ThemeChangeDetail>(THEME_CHANGED_EVENT, {
        detail: { theme, effectsEnabled, customAccentId }
      })
    )
  }

  return theme
}

export function subscribeThemeChanges(listener: (detail: ThemeChangeDetail) => void): () => void {
  if (typeof window === 'undefined') return () => {}
  const handler = (e: Event) => {
    const detail = (e as CustomEvent<ThemeChangeDetail>).detail
    if (detail) listener(detail)
  }
  window.addEventListener(THEME_CHANGED_EVENT, handler)
  return () => window.removeEventListener(THEME_CHANGED_EVENT, handler)
}
