export interface FontOption {
  id: string
  name: string
  category: 'Sans-Serif' | 'Serif' | 'Handwriting' | 'Monospace' | 'Display' | 'Retro & Pixel' | 'Classic'
  family: string
  badge?: string
  description?: string
}

export const FONT_CATEGORIES = [
  'Todas',
  'Sans-Serif',
  'Serif',
  'Handwriting',
  'Monospace',
  'Display',
  'Retro & Pixel',
  'Classic'
] as const

export type FontCategory = (typeof FONT_CATEGORIES)[number]

const loadedFontSet = new Set<string>(['Inter'])

/**
 * Carga dinámicamente una fuente de Google Fonts bajo demanda para mantener
 * el rendimiento del navegador rápido y evitar descargar 50+ fuentes al inicio.
 */
export function loadFontDynamically(fontNameOrFamily: string) {
  if (!fontNameOrFamily || typeof window === 'undefined') return
  const clean = fontNameOrFamily.replace(/["']/g, '').trim()
  if (!clean || clean.toLowerCase() === 'inter' || loadedFontSet.has(clean)) return

  const found = FONT_FAMILIES.find(
    (f) =>
      f.name.toLowerCase() === clean.toLowerCase() ||
      f.family.toLowerCase().includes(clean.toLowerCase())
  )

  const googleFontName = found ? found.name : clean
  const systemFonts = ['Georgia', 'Times New Roman', 'Courier New', 'system-ui', 'sans-serif', 'serif', 'monospace']
  if (systemFonts.some((s) => s.toLowerCase() === googleFontName.toLowerCase())) return

  loadedFontSet.add(clean)
  loadedFontSet.add(googleFontName)

  const linkId = `google-font-${googleFontName.replace(/\s+/g, '-').toLowerCase()}`
  if (document.getElementById(linkId)) return

  const link = document.createElement('link')
  link.id = linkId
  link.rel = 'stylesheet'
  const fontParam = encodeURIComponent(googleFontName).replace(/%20/g, '+')
  link.href = `https://fonts.googleapis.com/css2?family=${fontParam}:wght@400;600;700&display=swap`
  document.head.appendChild(link)
}

export const FONT_FAMILIES: FontOption[] = [
  // ==================== SANS-SERIF (Modernas, Limpias & UI) ====================
  {
    id: 'sans',
    name: 'Inter',
    category: 'Sans-Serif',
    family: 'Inter, system-ui, sans-serif',
    badge: 'Predeterminada',
    description: 'Neogrotesca neutral optimizada para interfaces y lectura clara'
  },
  {
    id: 'plus-jakarta',
    name: 'Plus Jakarta Sans',
    category: 'Sans-Serif',
    family: '"Plus Jakarta Sans", sans-serif',
    badge: 'Moderna',
    description: 'Geométrica contemporánea de alta gama usada en tech y startups'
  },
  {
    id: 'outfit',
    name: 'Outfit',
    category: 'Sans-Serif',
    family: 'Outfit, sans-serif',
    badge: 'Geométrica',
    description: 'Inspirada en el diseño de producto y marcas modernas'
  },
  {
    id: 'poppins',
    name: 'Poppins',
    category: 'Sans-Serif',
    family: 'Poppins, sans-serif',
    badge: 'Popular',
    description: 'Geométrica con curvas amigables y círculos perfectos'
  },
  {
    id: 'roboto',
    name: 'Roboto',
    category: 'Sans-Serif',
    family: 'Roboto, sans-serif',
    description: 'Equilibrada con formas abiertas y ritmo natural'
  },
  {
    id: 'montserrat',
    name: 'Montserrat',
    category: 'Sans-Serif',
    family: 'Montserrat, sans-serif',
    badge: 'Editorial',
    description: 'Inspirada en la cartelería histórica de Buenos Aires'
  },
  {
    id: 'dm-sans',
    name: 'DM Sans',
    category: 'Sans-Serif',
    family: '"DM Sans", sans-serif',
    badge: 'Elegante',
    description: 'Bajo contraste, geométrica pura y muy legible'
  },
  {
    id: 'urbanist',
    name: 'Urbanist',
    category: 'Sans-Serif',
    family: 'Urbanist, sans-serif',
    badge: 'Vanguardia',
    description: 'Grotesca digital moderna con cortes limpios'
  },
  {
    id: 'spacegrotesk',
    name: 'Space Grotesk',
    category: 'Sans-Serif',
    family: '"Space Grotesk", sans-serif',
    badge: 'Brutalista',
    description: 'Proporciones densas con detalles técnicos singulares'
  },
  {
    id: 'manrope',
    name: 'Manrope',
    category: 'Sans-Serif',
    family: 'Manrope, sans-serif',
    badge: 'Crossover',
    description: 'Híbrido moderno entre geométrica y grotesque suiza'
  },
  {
    id: 'nunito',
    name: 'Nunito',
    category: 'Sans-Serif',
    family: 'Nunito, sans-serif',
    badge: 'Redondeada',
    description: 'Terminales redondeados, carácter cálido y accesible'
  },
  {
    id: 'lexend',
    name: 'Lexend',
    category: 'Sans-Serif',
    family: 'Lexend, sans-serif',
    badge: 'Lectura',
    description: 'Diseñada científicamente para acelerar la comprensión lectora'
  },
  {
    id: 'opensans',
    name: 'Open Sans',
    category: 'Sans-Serif',
    family: '"Open Sans", sans-serif',
    description: 'Humanista neutral, abierta y sumamente legible'
  },
  {
    id: 'raleway',
    name: 'Raleway',
    category: 'Sans-Serif',
    family: 'Raleway, sans-serif',
    badge: 'Estilizada',
    description: 'Elegante sin remates con detalles de alta costura'
  },
  {
    id: 'worksans',
    name: 'Work Sans',
    category: 'Sans-Serif',
    family: '"Work Sans", sans-serif',
    description: 'Grotesca simplificada para pantallas y diseño funcional'
  },

  // ==================== SERIF (Editoriales, Libros & Lujo) ====================
  {
    id: 'playfair',
    name: 'Playfair Display',
    category: 'Serif',
    family: '"Playfair Display", serif',
    badge: 'Titular',
    description: 'Alto contraste estilo transición de la Ilustración europea'
  },
  {
    id: 'cormorant',
    name: 'Cormorant Garamond',
    category: 'Serif',
    family: '"Cormorant Garamond", serif',
    badge: 'Lujo',
    description: 'Serif tradicional refinada para revistas de moda y alta gama'
  },
  {
    id: 'eb-garamond',
    name: 'EB Garamond',
    category: 'Serif',
    family: '"EB Garamond", serif',
    badge: 'Humanista',
    description: 'Obra maestra clásica basada en los tipos de Claude Garamont'
  },
  {
    id: 'bodoni',
    name: 'Bodoni Moda',
    category: 'Serif',
    family: '"Bodoni Moda", serif',
    badge: 'Vogue',
    description: 'Contraste dramático extremo estilo alta costura'
  },
  {
    id: 'cinzel',
    name: 'Cinzel',
    category: 'Serif',
    family: 'Cinzel, serif',
    badge: 'Romana',
    description: 'Grabados clásicos romanos tallados en piedra'
  },
  {
    id: 'fraunces',
    name: 'Fraunces',
    category: 'Serif',
    family: 'Fraunces, serif',
    badge: 'Retro 70s',
    description: 'Serif cálida, jugosa y con enorme personalidad vintage'
  },
  {
    id: 'merriweather',
    name: 'Merriweather',
    category: 'Serif',
    family: 'Merriweather, serif',
    badge: 'Libro',
    description: 'Diseñada específicamente para lecturas extensas en pantalla'
  },
  {
    id: 'lora',
    name: 'Lora',
    category: 'Serif',
    family: 'Lora, serif',
    badge: 'Poética',
    description: 'Curvas contemporáneas con raíces en la caligrafía'
  },
  {
    id: 'bitter',
    name: 'Bitter',
    category: 'Serif',
    family: 'Bitter, serif',
    badge: 'Slab',
    description: 'Slab serif contemporánea con ritmo suave de lectura'
  },
  {
    id: 'prata',
    name: 'Prata',
    category: 'Serif',
    family: 'Prata, serif',
    badge: 'Didone',
    description: 'Elegancia clásica con lágrimas y serifas afiladas'
  },
  {
    id: 'spectral',
    name: 'Spectral',
    category: 'Serif',
    family: 'Spectral, serif',
    description: 'Serif de texto hermosa desarrollada por Production Type'
  },

  // ==================== HANDWRITING & SCRIPT (Manuscritas & Firmas) ====================
  {
    id: 'caveat',
    name: 'Caveat',
    category: 'Handwriting',
    family: 'Caveat, cursive',
    badge: 'Firma',
    description: 'Trazo fluido de tinta líquida, perfecta para apuntes rápidos'
  },
  {
    id: 'kalam',
    name: 'Kalam',
    category: 'Handwriting',
    family: 'Kalam, cursive',
    badge: 'Manuscrita',
    description: 'Escritura informal con rotulador de punta redonda'
  },
  {
    id: 'dancing',
    name: 'Dancing Script',
    category: 'Handwriting',
    family: '"Dancing Script", cursive',
    badge: 'Fluida',
    description: 'Espontánea y rebotante, con cambios de tamaño vivaces'
  },
  {
    id: 'greatvibes',
    name: 'Great Vibes',
    category: 'Handwriting',
    family: '"Great Vibes", cursive',
    badge: 'Caligrafía',
    description: 'Cursiva caligráfica clásica fluida con bucles elegantes'
  },
  {
    id: 'sacramento',
    name: 'Sacramento',
    category: 'Handwriting',
    family: 'Sacramento, cursive',
    badge: 'Fina',
    description: 'Monolineal conectada inspirada en los años 50'
  },
  {
    id: 'pacifico',
    name: 'Pacifico',
    category: 'Handwriting',
    family: 'Pacifico, cursive',
    badge: 'Pincel',
    description: 'Inspirada en la cultura surf americana de los años 50'
  },
  {
    id: 'shadows',
    name: 'Shadows Into Light',
    category: 'Handwriting',
    family: '"Shadows Into Light", cursive',
    badge: 'Post-it',
    description: 'Limpia, femenina y perfecta para notas adhesivas'
  },
  {
    id: 'indie-flower',
    name: 'Indie Flower',
    category: 'Handwriting',
    family: '"Indie Flower", cursive',
    badge: 'Casual',
    description: 'Carácter alegre, burbujeante y relajado'
  },
  {
    id: 'permanent-marker',
    name: 'Permanent Marker',
    category: 'Handwriting',
    family: '"Permanent Marker", cursive',
    badge: 'Marcador',
    description: 'Trazos gruesos y espontáneos de rotulador permanente'
  },
  {
    id: 'homemade-apple',
    name: 'Homemade Apple',
    category: 'Handwriting',
    family: '"Homemade Apple", cursive',
    badge: 'Cuaderno',
    description: 'Escrita a pluma real sobre papel'
  },
  {
    id: 'architects-daughter',
    name: 'Architects Daughter',
    category: 'Handwriting',
    family: '"Architects Daughter", cursive',
    badge: 'Boceto',
    description: 'Letra natural de planos arquitectónicos y diagramas'
  },
  {
    id: 'gloria-hallelujah',
    name: 'Gloria Hallelujah',
    category: 'Handwriting',
    family: '"Gloria Hallelujah", cursive',
    badge: 'Pizarra',
    description: 'Trazos sueltos de tiza sobre pizarra escolar'
  },

  // ==================== MONOSPACE & TECH (Código & Terminal) ====================
  {
    id: 'jetbrains',
    name: 'JetBrains Mono',
    category: 'Monospace',
    family: '"JetBrains Mono", monospace',
    badge: 'Dev Fav',
    description: 'Diseñada específicamente para desarrolladores y código moderno'
  },
  {
    id: 'fira',
    name: 'Fira Code',
    category: 'Monospace',
    family: '"Fira Code", monospace',
    badge: 'Ligaduras',
    description: 'Monospace contemporánea con soporte icónico de ligaduras'
  },
  {
    id: 'sourcecode',
    name: 'Source Code Pro',
    category: 'Monospace',
    family: '"Source Code Pro", monospace',
    description: 'Diseñada por Adobe para interfaces de programación'
  },
  {
    id: 'space-mono',
    name: 'Space Mono',
    category: 'Monospace',
    family: '"Space Mono", monospace',
    badge: 'Retro Tech',
    description: 'Inspirada en los titulares retro-futuristas de los años 60'
  },
  {
    id: 'robotomono',
    name: 'Roboto Mono',
    category: 'Monospace',
    family: '"Roboto Mono", monospace',
    description: 'Equilibrada para lectura de datos y código estructurado'
  },
  {
    id: 'inconsolata',
    name: 'Inconsolata',
    category: 'Monospace',
    family: 'Inconsolata, monospace',
    badge: 'Humanista',
    description: 'Monospace de proporciones refinadas para terminales'
  },
  {
    id: 'ubuntu-mono',
    name: 'Ubuntu Mono',
    category: 'Monospace',
    family: '"Ubuntu Mono", monospace',
    description: 'Curvas suaves y distintivas del ecosistema Ubuntu'
  },
  {
    id: 'dm-mono',
    name: 'DM Mono',
    category: 'Monospace',
    family: '"DM Mono", monospace',
    description: 'Monospace geométrica editorial de bajo contraste'
  },

  // ==================== DISPLAY & IMPACT (Titulares & Posters) ====================
  {
    id: 'bebas',
    name: 'Bebas Neue',
    category: 'Display',
    family: '"Bebas Neue", sans-serif',
    badge: 'Mayúsculas',
    description: 'Líneas limpias y máxima potencia para carteles y titulares'
  },
  {
    id: 'righteous',
    name: 'Righteous',
    category: 'Display',
    family: 'Righteous, cursive',
    badge: 'Synthwave',
    description: 'Estilo decorativo retro-futurista de los años 80'
  },
  {
    id: 'oswald',
    name: 'Oswald',
    category: 'Display',
    family: 'Oswald, sans-serif',
    badge: 'Condensada',
    description: 'Redibujado clásico de las góticas condensadas del siglo XIX'
  },
  {
    id: 'abril',
    name: 'Abril Fatface',
    category: 'Display',
    family: '"Abril Fatface", serif',
    badge: 'Poster',
    description: 'Didona pesada de titulación para portadas y anuncios'
  },
  {
    id: 'syne',
    name: 'Syne',
    category: 'Display',
    family: 'Syne, sans-serif',
    badge: 'Vanguardia',
    description: 'Diseño parisino experimental de alta sofisticación'
  },
  {
    id: 'alfa-slab',
    name: 'Alfa Slab One',
    category: 'Display',
    family: '"Alfa Slab One", serif',
    badge: 'Ultra Bold',
    description: 'Slab serif masiva para crear un impacto instantáneo'
  },
  {
    id: 'lobster',
    name: 'Lobster',
    category: 'Display',
    family: 'Lobster, cursive',
    badge: 'Retro Bold',
    description: 'Caligráfica negrita vintage con ligaduras automáticas'
  },
  {
    id: 'bungee',
    name: 'Bungee',
    category: 'Display',
    family: 'Bungee, cursive',
    badge: 'Señalética',
    description: 'Inspirada en letreros urbanos, carteles y marquesinas'
  },
  {
    id: 'comfortaa',
    name: 'Comfortaa',
    category: 'Display',
    family: 'Comfortaa, cursive',
    badge: 'Círculos',
    description: 'Geométrica suave y circular con un toque amistoso'
  },
  {
    id: 'anton',
    name: 'Anton',
    category: 'Display',
    family: 'Anton, sans-serif',
    badge: 'Impacto',
    description: 'Grotesca tradicional adaptada para títulos masivos en web'
  },

  // ==================== RETRO & PIXEL (Gaming & Vintage Arcade) ====================
  {
    id: 'press-start',
    name: 'Press Start 2P',
    category: 'Retro & Pixel',
    family: '"Press Start 2P", monospace',
    badge: '8-bit Arcade',
    description: 'Tipografía de píxeles retro inspirada en los juegos arcade de los 80'
  },
  {
    id: 'silkscreen',
    name: 'Silkscreen',
    category: 'Retro & Pixel',
    family: 'Silkscreen, monospace',
    badge: 'Pixel Art',
    description: 'Pixel font compacta y súper nítida para consolas y pantallas miniatura'
  },
  {
    id: 'vt323',
    name: 'VT323',
    category: 'Retro & Pixel',
    family: 'VT323, monospace',
    badge: 'CRT Terminal',
    description: 'Inspirada en las terminales DEC VT220 de fósforo verde'
  },

  // ==================== CLASSIC (Sistema & Atemporales) ====================
  {
    id: 'georgia',
    name: 'Georgia',
    category: 'Classic',
    family: 'Georgia, serif',
    badge: 'Sistema',
    description: 'Serif atemporal de Matthew Carter con gran altura x'
  },
  {
    id: 'times',
    name: 'Times New Roman',
    category: 'Classic',
    family: '"Times New Roman", serif',
    badge: 'Prensa',
    description: 'El clásico indiscutible del periodismo y la academia'
  },
  {
    id: 'courier',
    name: 'Courier New',
    category: 'Classic',
    family: '"Courier New", monospace',
    badge: 'Máquina',
    description: 'La mítica máquina de escribir fija de IBM'
  }
]
