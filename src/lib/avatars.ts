export type AvatarCategoryId = 'editorial' | 'illustrated' | 'studio' | 'creative'

export type DiceBearStyle =
  | 'notionists'
  | 'lorelei'
  | 'micah'
  | 'adventurer'
  | 'bottts-neutral'
  | 'glass'

export interface PresetAvatar {
  id: string
  label: string
  category: AvatarCategoryId
  style: DiceBearStyle
  url: string
}

export interface AvatarCategory {
  id: AvatarCategoryId
  label: string
  defaultStyle: DiceBearStyle
}

export const AVATAR_CATEGORIES: AvatarCategory[] = [
  { id: 'editorial', label: 'Editorial', defaultStyle: 'notionists' },
  { id: 'illustrated', label: 'Ilustrados', defaultStyle: 'lorelei' },
  { id: 'studio', label: 'Estudio', defaultStyle: 'micah' },
  { id: 'creative', label: 'Creativos', defaultStyle: 'adventurer' }
]

// Paleta pastel cálida alineada con DESIGN.md (Notion & Milanote)
const AVATAR_BG_PALETTE = [
  'ede7fb', // Lavender
  'e0f0fd', // Sky
  'dcf5e3', // Mint
  'ffe8d4', // Peach
  'fce4ec', // Rose
  'fff9db', // Butter Yellow
  'f1f1ef', // Warm Stone
  'e6edf7'  // Soft Slate
]

export function buildDiceBearAvatarUrl(
  style: DiceBearStyle,
  seed: string,
  bgHex?: string
): string {
  const params = new URLSearchParams({
    seed: seed.trim() || 'SevenNote',
    radius: '12'
  })
  if (bgHex) {
    params.set('backgroundColor', bgHex.replace('#', ''))
  }
  return `https://api.dicebear.com/9.x/${style}/svg?${params.toString()}`
}

export function generateRandomAvatarUrl(style: DiceBearStyle = 'notionists'): string {
  const randomSeed = `sn-${Math.random().toString(36).slice(2, 10)}`
  const randomBg = AVATAR_BG_PALETTE[Math.floor(Math.random() * AVATAR_BG_PALETTE.length)]
  return buildDiceBearAvatarUrl(style, randomSeed, randomBg)
}

export const PRESET_AVATARS: PresetAvatar[] = [
  // --- Editorial (Notion-style ink portraits) ---
  {
    id: 'notion-luna',
    label: 'Luna',
    category: 'editorial',
    style: 'notionists',
    url: buildDiceBearAvatarUrl('notionists', 'Luna', 'ede7fb')
  },
  {
    id: 'notion-mateo',
    label: 'Mateo',
    category: 'editorial',
    style: 'notionists',
    url: buildDiceBearAvatarUrl('notionists', 'Mateo', 'e0f0fd')
  },
  {
    id: 'notion-clara',
    label: 'Clara',
    category: 'editorial',
    style: 'notionists',
    url: buildDiceBearAvatarUrl('notionists', 'Clara', 'ffe8d4')
  },
  {
    id: 'notion-diego',
    label: 'Diego',
    category: 'editorial',
    style: 'notionists',
    url: buildDiceBearAvatarUrl('notionists', 'Diego', 'dcf5e3')
  },
  {
    id: 'notion-sofia',
    label: 'Sofía',
    category: 'editorial',
    style: 'notionists',
    url: buildDiceBearAvatarUrl('notionists', 'Sofia', 'fce4ec')
  },
  {
    id: 'notion-leo',
    label: 'Leo',
    category: 'editorial',
    style: 'notionists',
    url: buildDiceBearAvatarUrl('notionists', 'Leo', 'fff9db')
  },
  {
    id: 'notion-valeria',
    label: 'Valeria',
    category: 'editorial',
    style: 'notionists',
    url: buildDiceBearAvatarUrl('notionists', 'Valeria', 'f1f1ef')
  },
  {
    id: 'notion-bruno',
    label: 'Bruno',
    category: 'editorial',
    style: 'notionists',
    url: buildDiceBearAvatarUrl('notionists', 'Bruno', 'e6edf7')
  },

  // --- Ilustrados (Lorelei warm artistic portraits) ---
  {
    id: 'lorelei-aurora',
    label: 'Aurora',
    category: 'illustrated',
    style: 'lorelei',
    url: buildDiceBearAvatarUrl('lorelei', 'Aurora', 'fce4ec')
  },
  {
    id: 'lorelei-sora',
    label: 'Sora',
    category: 'illustrated',
    style: 'lorelei',
    url: buildDiceBearAvatarUrl('lorelei', 'Sora', 'ede7fb')
  },
  {
    id: 'lorelei-alma',
    label: 'Alma',
    category: 'illustrated',
    style: 'lorelei',
    url: buildDiceBearAvatarUrl('lorelei', 'Alma', 'ffe8d4')
  },
  {
    id: 'lorelei-noa',
    label: 'Noa',
    category: 'illustrated',
    style: 'lorelei',
    url: buildDiceBearAvatarUrl('lorelei', 'Noa', 'dcf5e3')
  },
  {
    id: 'lorelei-maya',
    label: 'Maya',
    category: 'illustrated',
    style: 'lorelei',
    url: buildDiceBearAvatarUrl('lorelei', 'Maya', 'e0f0fd')
  },
  {
    id: 'lorelei-gala',
    label: 'Gala',
    category: 'illustrated',
    style: 'lorelei',
    url: buildDiceBearAvatarUrl('lorelei', 'Gala', 'fff9db')
  },
  {
    id: 'lorelei-elena',
    label: 'Elena',
    category: 'illustrated',
    style: 'lorelei',
    url: buildDiceBearAvatarUrl('lorelei', 'Elena', 'f1f1ef')
  },
  {
    id: 'lorelei-nico',
    label: 'Nico',
    category: 'illustrated',
    style: 'lorelei',
    url: buildDiceBearAvatarUrl('lorelei', 'Nico', 'e6edf7')
  },

  // --- Estudio (Micah clean minimalist portraits) ---
  {
    id: 'micah-kevin',
    label: 'Alex',
    category: 'studio',
    style: 'micah',
    url: buildDiceBearAvatarUrl('micah', 'Alex', 'e0f0fd')
  },
  {
    id: 'micah-camila',
    label: 'Camila',
    category: 'studio',
    style: 'micah',
    url: buildDiceBearAvatarUrl('micah', 'Camila', 'fce4ec')
  },
  {
    id: 'micah-hugo',
    label: 'Hugo',
    category: 'studio',
    style: 'micah',
    url: buildDiceBearAvatarUrl('micah', 'Hugo', 'dcf5e3')
  },
  {
    id: 'micah-iris',
    label: 'Iris',
    category: 'studio',
    style: 'micah',
    url: buildDiceBearAvatarUrl('micah', 'Iris', 'ede7fb')
  },
  {
    id: 'micah-lucas',
    label: 'Lucas',
    category: 'studio',
    style: 'micah',
    url: buildDiceBearAvatarUrl('micah', 'Lucas', 'ffe8d4')
  },
  {
    id: 'micah-nina',
    label: 'Nina',
    category: 'studio',
    style: 'micah',
    url: buildDiceBearAvatarUrl('micah', 'Nina', 'fff9db')
  },
  {
    id: 'micah-marco',
    label: 'Marco',
    category: 'studio',
    style: 'micah',
    url: buildDiceBearAvatarUrl('micah', 'Marco', 'f1f1ef')
  },
  {
    id: 'micah-vera',
    label: 'Vera',
    category: 'studio',
    style: 'micah',
    url: buildDiceBearAvatarUrl('micah', 'Vera', 'e6edf7')
  },

  // --- Creativos (Adventurer, Bottts & Glass) ---
  {
    id: 'adv-felix',
    label: 'Félix',
    category: 'creative',
    style: 'adventurer',
    url: buildDiceBearAvatarUrl('adventurer', 'Felix', 'ffe8d4')
  },
  {
    id: 'adv-kora',
    label: 'Kora',
    category: 'creative',
    style: 'adventurer',
    url: buildDiceBearAvatarUrl('adventurer', 'Kora', 'ede7fb')
  },
  {
    id: 'adv-milo',
    label: 'Milo',
    category: 'creative',
    style: 'adventurer',
    url: buildDiceBearAvatarUrl('adventurer', 'Milo', 'dcf5e3')
  },
  {
    id: 'adv-zoe',
    label: 'Zoe',
    category: 'creative',
    style: 'adventurer',
    url: buildDiceBearAvatarUrl('adventurer', 'Zoe', 'fce4ec')
  },
  {
    id: 'bot-nova',
    label: 'Nova Bot',
    category: 'creative',
    style: 'bottts-neutral',
    url: buildDiceBearAvatarUrl('bottts-neutral', 'Nova', 'e0f0fd')
  },
  {
    id: 'bot-pixel',
    label: 'Pixel Bot',
    category: 'creative',
    style: 'bottts-neutral',
    url: buildDiceBearAvatarUrl('bottts-neutral', 'Pixel', 'fff9db')
  },
  {
    id: 'glass-prism',
    label: 'Prisma',
    category: 'creative',
    style: 'glass',
    url: buildDiceBearAvatarUrl('glass', 'SevenPrism', 'ede7fb')
  },
  {
    id: 'glass-aurora',
    label: 'Aura',
    category: 'creative',
    style: 'glass',
    url: buildDiceBearAvatarUrl('glass', 'SevenAura', 'e0f0fd')
  }
]

const MAX_UPLOAD_BYTES = 10 * 1024 * 1024 // 10 MB

/**
 * Redimensiona y comprime una imagen seleccionada por el usuario a 256x256 (Retina)
 * para guardarla de forma ligera y nítida como data URL en el perfil.
 */
export function resizeAvatarFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!file.type || !file.type.startsWith('image/')) {
      reject(new Error('Selecciona un archivo de imagen válido (PNG, JPG, WebP o GIF).'))
      return
    }

    if (file.size > MAX_UPLOAD_BYTES) {
      reject(new Error('La imagen es demasiado grande (máximo 10 MB).'))
      return
    }

    const objectUrl = URL.createObjectURL(file)
    const img = new Image()

    const cleanup = () => {
      URL.revokeObjectURL(objectUrl)
    }

    img.onerror = () => {
      cleanup()
      reject(new Error('No se pudo cargar la imagen. Prueba con un archivo JPG, PNG o WebP.'))
    }

    img.onload = () => {
      try {
        const size = 256
        const canvas = document.createElement('canvas')
        canvas.width = size
        canvas.height = size
        const ctx = canvas.getContext('2d')
        if (!ctx) {
          cleanup()
          reject(new Error('Tu navegador no pudo procesar la imagen.'))
          return
        }

        ctx.imageSmoothingEnabled = true
        ctx.imageSmoothingQuality = 'high'

        const minSide = Math.min(img.naturalWidth || img.width, img.naturalHeight || img.height)
        const sx = ((img.naturalWidth || img.width) - minSide) / 2
        const sy = ((img.naturalHeight || img.height) - minSide) / 2

        // Probar WebP primero (soporta transparencia y comprime muy bien)
        ctx.drawImage(img, sx, sy, minSide, minSide, 0, 0, size, size)
        let dataUrl = canvas.toDataURL('image/webp', 0.85)

        // Fallback seguro a JPEG si el navegador/WebView no soporta codificación WebP
        if (!dataUrl.startsWith('data:image/webp')) {
          ctx.globalCompositeOperation = 'destination-over'
          ctx.fillStyle = '#f7f6f5'
          ctx.fillRect(0, 0, size, size)
          ctx.globalCompositeOperation = 'source-over'
          dataUrl = canvas.toDataURL('image/jpeg', 0.86)
        }

        cleanup()
        resolve(dataUrl)
      } catch {
        cleanup()
        reject(new Error('Error al optimizar la imagen seleccionada.'))
      }
    }

    img.src = objectUrl
  })
}
