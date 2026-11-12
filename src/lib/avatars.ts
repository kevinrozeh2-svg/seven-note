export interface PresetAvatar {
  id: string
  label: string
  url: string
}

function svgToDataUri(svg: string): string {
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg.trim())}`
}

export const PRESET_AVATARS: PresetAvatar[] = [
  // --- Femeninos & Estéticos ---
  {
    id: 'luna-night',
    label: 'Luna',
    url: svgToDataUri(`
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
        <defs>
          <linearGradient id="bg-luna" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stop-color="#2e1f3d"/>
            <stop offset="100%" stop-color="#191627"/>
          </linearGradient>
          <linearGradient id="hair-luna" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="#3b2654"/>
            <stop offset="100%" stop-color="#1f142e"/>
          </linearGradient>
        </defs>
        <rect width="64" height="64" fill="url(#bg-luna)"/>
        <path d="M14 54 C14 36 18 14 32 14 C46 14 50 36 50 54 Z" fill="url(#hair-luna)"/>
        <path d="M16 64 C16 50 22 45 32 45 C42 45 48 50 48 64 Z" fill="#7c5cbf"/>
        <rect x="28" y="39" width="8" height="9" rx="4" fill="#f7d5c2"/>
        <ellipse cx="32" cy="31" rx="11.5" ry="12.5" fill="#fde2d2"/>
        <ellipse cx="24" cy="34" rx="2.4" ry="1.4" fill="#f497a9" opacity="0.55"/>
        <ellipse cx="40" cy="34" rx="2.4" ry="1.4" fill="#f497a9" opacity="0.55"/>
        <circle cx="27.2" cy="30.5" r="2" fill="#23192d"/>
        <circle cx="36.8" cy="30.5" r="2" fill="#23192d"/>
        <circle cx="27.8" cy="29.8" r="0.7" fill="#ffffff"/>
        <circle cx="37.4" cy="29.8" r="0.7" fill="#ffffff"/>
        <path d="M24.5 29.2 L25.8 29.8 M39.5 29.2 L38.2 29.8" stroke="#23192d" stroke-width="1.1" stroke-linecap="round"/>
        <path d="M29.5 36.2 Q32 38.2 34.5 36.2" stroke="#c97a7e" stroke-width="1.4" fill="none" stroke-linecap="round"/>
        <path d="M19 29 C19 18 25 14 32 14 C39 14 45 18 45 29 C41 24 36 22 32 23 C28 22 23 24 19 29 Z" fill="url(#hair-luna)"/>
        <circle cx="42" cy="22" r="2.2" fill="#f7c97e"/>
        <circle cx="42.8" cy="21.6" r="1.7" fill="#2e1f3d"/>
      </svg>
    `)
  },
  {
    id: 'aurora-bun',
    label: 'Aurora',
    url: svgToDataUri(`
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
        <defs>
          <linearGradient id="bg-aurora" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stop-color="#3a232b"/>
            <stop offset="100%" stop-color="#20181f"/>
          </linearGradient>
        </defs>
        <rect width="64" height="64" fill="url(#bg-aurora)"/>
        <circle cx="32" cy="14" r="7.5" fill="#4e2a24"/>
        <path d="M27 16 Q32 12 37 16" stroke="#f0a8b8" stroke-width="2" fill="none" stroke-linecap="round"/>
        <path d="M15 64 C16 50 22 46 32 46 C42 46 48 50 49 64 Z" fill="#d98a96"/>
        <rect x="27.5" y="40" width="9" height="8" rx="4" fill="#eec3a8"/>
        <ellipse cx="32" cy="31" rx="11.5" ry="12" fill="#f5cfb8"/>
        <circle cx="20.5" cy="32.5" r="2" fill="#f5cfb8"/>
        <circle cx="43.5" cy="32.5" r="2" fill="#f5cfb8"/>
        <circle cx="20.5" cy="34.8" r="1.2" fill="#f7d788"/>
        <circle cx="43.5" cy="34.8" r="1.2" fill="#f7d788"/>
        <path d="M20.5 29 C20.5 20 26 17 32 17 C38 17 43.5 20 43.5 29 C40 24 35 22 32 24 C29 22 24 24 20.5 29 Z" fill="#5c332c"/>
        <ellipse cx="24.5" cy="34.5" rx="2.2" ry="1.3" fill="#e5808f" opacity="0.5"/>
        <ellipse cx="39.5" cy="34.5" rx="2.2" ry="1.3" fill="#e5808f" opacity="0.5"/>
        <circle cx="27" cy="31" r="4.2" fill="none" stroke="#d4af7a" stroke-width="1.3"/>
        <circle cx="37" cy="31" r="4.2" fill="none" stroke="#d4af7a" stroke-width="1.3"/>
        <line x1="31.2" y1="31" x2="32.8" y2="31" stroke="#d4af7a" stroke-width="1.3"/>
        <circle cx="27" cy="31" r="1.5" fill="#2b1e1c"/>
        <circle cx="37" cy="31" r="1.5" fill="#2b1e1c"/>
        <circle cx="27.5" cy="30.4" r="0.5" fill="#ffffff"/>
        <circle cx="37.5" cy="30.4" r="0.5" fill="#ffffff"/>
        <path d="M29.5 37 Q32 39 34.5 37" stroke="#b96d6d" stroke-width="1.4" fill="none" stroke-linecap="round"/>
      </svg>
    `)
  },
  {
    id: 'sora-pastel',
    label: 'Sora',
    url: svgToDataUri(`
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
        <defs>
          <linearGradient id="bg-sora" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stop-color="#27253d"/>
            <stop offset="100%" stop-color="#171724"/>
          </linearGradient>
          <linearGradient id="hair-sora" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stop-color="#cbb8f5"/>
            <stop offset="100%" stop-color="#967ed6"/>
          </linearGradient>
        </defs>
        <rect width="64" height="64" fill="url(#bg-sora)"/>
        <path d="M16 42 C15 24 21 15 32 15 C43 15 49 24 48 42 C46 46 42 47 39 45 L25 45 C22 47 18 46 16 42 Z" fill="url(#hair-sora)"/>
        <path d="M16 64 C17 50 23 46 32 46 C41 46 47 50 48 64 Z" fill="#2f3142"/>
        <path d="M27 46 L32 51 L37 46" fill="#e2d9f3"/>
        <rect x="28.5" y="40" width="7" height="7" rx="3.5" fill="#fbe0d4"/>
        <ellipse cx="32" cy="31.5" rx="10.8" ry="11.5" fill="#ffece4"/>
        <ellipse cx="24.5" cy="34.5" rx="2.2" ry="1.2" fill="#f79bb4" opacity="0.55"/>
        <ellipse cx="39.5" cy="34.5" rx="2.2" ry="1.2" fill="#f79bb4" opacity="0.55"/>
        <circle cx="27.5" cy="31" r="1.9" fill="#2c2540"/>
        <circle cx="36.5" cy="31" r="1.9" fill="#2c2540"/>
        <circle cx="28" cy="30.3" r="0.7" fill="#ffffff"/>
        <circle cx="37" cy="30.3" r="0.7" fill="#ffffff"/>
        <path d="M29.8 36.5 Q32 38.2 34.2 36.5" stroke="#d68295" stroke-width="1.3" fill="none" stroke-linecap="round"/>
        <path d="M20 29 C21 19 26 16 32 16 C38 16 43 19 44 29 C40 24 35 23 32 25 C28 22 23 24 20 29 Z" fill="url(#hair-sora)"/>
        <circle cx="21" cy="35.5" r="1.4" fill="#f8fafc"/>
        <circle cx="43" cy="35.5" r="1.4" fill="#f8fafc"/>
      </svg>
    `)
  },
  {
    id: 'clara-waves',
    label: 'Clara',
    url: svgToDataUri(`
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
        <defs>
          <linearGradient id="bg-clara" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stop-color="#2b2122"/>
            <stop offset="100%" stop-color="#191618"/>
          </linearGradient>
          <linearGradient id="hair-clara" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="#b85435"/>
            <stop offset="100%" stop-color="#7d321c"/>
          </linearGradient>
        </defs>
        <rect width="64" height="64" fill="url(#bg-clara)"/>
        <path d="M13 54 C11 40 15 15 32 15 C49 15 53 40 51 54 C46 54 44 50 44 46 L20 46 C20 50 18 54 13 54 Z" fill="url(#hair-clara)"/>
        <path d="M17 64 C18 50 23 46 32 46 C41 46 46 50 47 64 Z" fill="#4f6f5e"/>
        <rect x="28" y="40" width="8" height="8" rx="4" fill="#f7cdb7"/>
        <ellipse cx="32" cy="31" rx="11" ry="11.8" fill="#fce0cf"/>
        <ellipse cx="24.5" cy="34.2" rx="2.3" ry="1.3" fill="#e87e7e" opacity="0.5"/>
        <ellipse cx="39.5" cy="34.2" rx="2.3" ry="1.3" fill="#e87e7e" opacity="0.5"/>
        <circle cx="27.3" cy="30.8" r="1.9" fill="#2c4a3e"/>
        <circle cx="36.7" cy="30.8" r="1.9" fill="#2c4a3e"/>
        <circle cx="27.8" cy="30.2" r="0.7" fill="#ffffff"/>
        <circle cx="37.2" cy="30.2" r="0.7" fill="#ffffff"/>
        <path d="M29.6 36.4 Q32 38.4 34.4 36.4" stroke="#c7766e" stroke-width="1.3" fill="none" stroke-linecap="round"/>
        <path d="M20 28 C21 19 27 16 33 17 C39 16 44 20 44 29 C40 24 36 22 31 24 C27 22 23 23 20 28 Z" fill="url(#hair-clara)"/>
      </svg>
    `)
  },
  {
    id: 'neko-sakura',
    label: 'Gata Sakura',
    url: svgToDataUri(`
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
        <defs>
          <linearGradient id="bg-neko" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stop-color="#352030"/>
            <stop offset="100%" stop-color="#1b1520"/>
          </linearGradient>
        </defs>
        <rect width="64" height="64" fill="url(#bg-neko)"/>
        <path d="M16 26 L18 12 L29 21 Q32 20 35 21 L46 12 L48 26 Q52 34 48 43 Q42 51 32 51 Q22 51 16 43 Q12 34 16 26 Z" fill="#faf5f7"/>
        <path d="M19 23 L20.5 15 L26.5 20.5 Z" fill="#f4a8c4"/>
        <path d="M45 23 L43.5 15 L37.5 20.5 Z" fill="#f4a8c4"/>
        <ellipse cx="22.5" cy="37" rx="2.8" ry="1.6" fill="#f48fb1" opacity="0.6"/>
        <ellipse cx="41.5" cy="37" rx="2.8" ry="1.6" fill="#f48fb1" opacity="0.6"/>
        <circle cx="25.5" cy="33" r="2.6" fill="#231926"/>
        <circle cx="38.5" cy="33" r="2.6" fill="#231926"/>
        <circle cx="26.3" cy="32" r="0.9" fill="#ffffff"/>
        <circle cx="39.3" cy="32" r="0.9" fill="#ffffff"/>
        <path d="M30.2 37.5 L33.8 37.5 L32 39.5 Z" fill="#f06292"/>
        <path d="M29.2 40.5 Q30.6 42 32 40.2 Q33.4 42 34.8 40.5" stroke="#5b4656" stroke-width="1.2" fill="none" stroke-linecap="round"/>
        <circle cx="43" cy="21" r="2.6" fill="#f48fb1"/>
        <circle cx="46" cy="23.5" r="2.3" fill="#f8bbd0"/>
        <circle cx="43.5" cy="22.5" r="1.2" fill="#fde047"/>
      </svg>
    `)
  },
  {
    id: 'mariposa',
    label: 'Mariposa',
    url: svgToDataUri(`
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
        <defs>
          <linearGradient id="bg-mp" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stop-color="#251b36"/>
            <stop offset="100%" stop-color="#14141c"/>
          </linearGradient>
          <linearGradient id="wing-mp" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stop-color="#f472b6"/>
            <stop offset="55%" stop-color="#a855f7"/>
            <stop offset="100%" stop-color="#6366f1"/>
          </linearGradient>
        </defs>
        <rect width="64" height="64" fill="url(#bg-mp)"/>
        <path d="M31 30 C23 14 10 15 12 28 C13 34 21 36 30 34 Z" fill="url(#wing-mp)"/>
        <path d="M33 30 C41 14 54 15 52 28 C51 34 43 36 34 34 Z" fill="url(#wing-mp)"/>
        <path d="M30 34 C20 35 14 42 18 48 C22 53 29 46 31 38 Z" fill="url(#wing-mp)" opacity="0.88"/>
        <path d="M34 34 C44 35 50 42 46 48 C42 53 35 46 33 38 Z" fill="url(#wing-mp)" opacity="0.88"/>
        <circle cx="19" cy="24" r="2" fill="#ffffff" opacity="0.45"/>
        <circle cx="45" cy="24" r="2" fill="#ffffff" opacity="0.45"/>
        <rect x="30.6" y="25" width="2.8" height="19" rx="1.4" fill="#f8fafc"/>
        <path d="M31 25 Q27 18 23 17 M33 25 Q37 18 41 17" stroke="#e2e8f0" stroke-width="1.2" fill="none" stroke-linecap="round"/>
      </svg>
    `)
  },
  {
    id: 'loto-zen',
    label: 'Flor de Loto',
    url: svgToDataUri(`
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
        <defs>
          <linearGradient id="bg-loto" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stop-color="#2c1d2e"/>
            <stop offset="100%" stop-color="#15141b"/>
          </linearGradient>
          <linearGradient id="petal-loto" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="#fbcfe8"/>
            <stop offset="100%" stop-color="#db2777"/>
          </linearGradient>
        </defs>
        <rect width="64" height="64" fill="url(#bg-loto)"/>
        <path d="M32 45 C22 45 13 38 12 27 C21 29 28 36 32 45 Z" fill="#be185d" opacity="0.8"/>
        <path d="M32 45 C42 45 51 38 52 27 C43 29 36 36 32 45 Z" fill="#be185d" opacity="0.8"/>
        <path d="M32 45 C23 41 18 30 20 19 C28 24 31 35 32 45 Z" fill="#ec4899" opacity="0.9"/>
        <path d="M32 45 C41 41 46 30 44 19 C36 24 33 35 32 45 Z" fill="#ec4899" opacity="0.9"/>
        <path d="M32 14 C38 24 38 37 32 46 C26 37 26 24 32 14 Z" fill="url(#petal-loto)"/>
        <path d="M20 48 Q32 51 44 48" stroke="#f9a8d4" stroke-width="1.5" fill="none" stroke-linecap="round" opacity="0.6"/>
      </svg>
    `)
  },
  {
    id: 'sakura-moon',
    label: 'Luna Sakura',
    url: svgToDataUri(`
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
        <defs>
          <linearGradient id="bg-sm" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stop-color="#201b36"/>
            <stop offset="100%" stop-color="#13131d"/>
          </linearGradient>
          <linearGradient id="moon-sm" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stop-color="#fde68a"/>
            <stop offset="100%" stop-color="#f59e0b"/>
          </linearGradient>
        </defs>
        <rect width="64" height="64" fill="url(#bg-sm)"/>
        <path d="M37 15 A17 17 0 1 0 49 41 A13.5 13.5 0 1 1 37 15 Z" fill="url(#moon-sm)"/>
        <circle cx="42" cy="24" r="3" fill="#f9a8d4"/>
        <circle cx="46" cy="27" r="3" fill="#fbcfe8"/>
        <circle cx="40" cy="28" r="3" fill="#f472b6"/>
        <circle cx="43" cy="26.5" r="1.4" fill="#fef08a"/>
        <circle cx="20" cy="19" r="1.2" fill="#e2e8f0" opacity="0.8"/>
        <circle cx="47" cy="17" r="1" fill="#e2e8f0" opacity="0.7"/>
        <circle cx="48" cy="46" r="1.2" fill="#e2e8f0" opacity="0.6"/>
      </svg>
    `)
  },

  // --- Masculinos & Clásicos ---
  {
    id: 'mateo-studio',
    label: 'Mateo',
    url: svgToDataUri(`
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
        <defs>
          <linearGradient id="bg-mateo" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stop-color="#1e293b"/>
            <stop offset="100%" stop-color="#111827"/>
          </linearGradient>
        </defs>
        <rect width="64" height="64" fill="url(#bg-mateo)"/>
        <path d="M16 64 C17 50 23 46 32 46 C41 46 47 50 48 64 Z" fill="#334155"/>
        <rect x="28" y="40" width="8" height="8" rx="4" fill="#e5b89b"/>
        <ellipse cx="32" cy="31" rx="11" ry="12" fill="#f2cbb1"/>
        <path d="M21 32 C21 40 26 43.5 32 43.5 C38 43.5 43 40 43 32 L42 35 C39 39 36 40 32 40 C28 40 25 39 22 35 Z" fill="#3a2c26" opacity="0.85"/>
        <path d="M20 28 C20 18 26 15 33 15 C40 15 44 19 44 27 C41 22 36 21 30 22 C25 22 22 24 20 28 Z" fill="#2b211c"/>
        <rect x="22.5" y="28" width="8" height="5.5" rx="2" fill="none" stroke="#1e293b" stroke-width="1.4"/>
        <rect x="33.5" y="28" width="8" height="5.5" rx="2" fill="none" stroke="#1e293b" stroke-width="1.4"/>
        <line x1="30.5" y1="30.5" x2="33.5" y2="30.5" stroke="#1e293b" stroke-width="1.4"/>
        <circle cx="26.5" cy="30.7" r="1.4" fill="#1e1b18"/>
        <circle cx="37.5" cy="30.7" r="1.4" fill="#1e1b18"/>
        <path d="M29.5 37.5 Q32 39 34.5 37.5" stroke="#f2cbb1" stroke-width="1.4" fill="none" stroke-linecap="round"/>
      </svg>
    `)
  },
  {
    id: 'leo-creative',
    label: 'Leo',
    url: svgToDataUri(`
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
        <defs>
          <linearGradient id="bg-leo" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stop-color="#1b2b2c"/>
            <stop offset="100%" stop-color="#12191c"/>
          </linearGradient>
        </defs>
        <rect width="64" height="64" fill="url(#bg-leo)"/>
        <path d="M16 64 C17 50 22 46 32 46 C42 46 47 50 48 64 Z" fill="#2d3b42"/>
        <rect x="28" y="40" width="8" height="8" rx="4" fill="#d9a684"/>
        <ellipse cx="32" cy="31" rx="11" ry="12" fill="#e8ba9b"/>
        <circle cx="23" cy="21" r="5.5" fill="#1f1a18"/>
        <circle cx="30" cy="18" r="6" fill="#1f1a18"/>
        <circle cx="37" cy="19" r="5.8" fill="#1f1a18"/>
        <circle cx="42" cy="23" r="4.5" fill="#1f1a18"/>
        <circle cx="20.5" cy="25" r="3.5" fill="#1f1a18"/>
        <circle cx="27" cy="31" r="1.8" fill="#1f1a18"/>
        <circle cx="37" cy="31" r="1.8" fill="#1f1a18"/>
        <circle cx="27.5" cy="30.4" r="0.6" fill="#ffffff"/>
        <circle cx="37.5" cy="30.4" r="0.6" fill="#ffffff"/>
        <path d="M29 36.8 Q32 38.8 35 36.8" stroke="#9e624d" stroke-width="1.4" fill="none" stroke-linecap="round"/>
      </svg>
    `)
  },

  // --- Mascotas & Criaturas Refinadas ---
  {
    id: 'fox-amber',
    label: 'Zorro Zen',
    url: svgToDataUri(`
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
        <defs>
          <linearGradient id="bg-fox" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stop-color="#2c201b"/>
            <stop offset="100%" stop-color="#171414"/>
          </linearGradient>
          <linearGradient id="fur-fox" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="#ea7c3c"/>
            <stop offset="100%" stop-color="#c24d1e"/>
          </linearGradient>
        </defs>
        <rect width="64" height="64" fill="url(#bg-fox)"/>
        <path d="M15 24 L20 12 L29 21 L35 21 L44 12 L49 24 Q51 36 45 43 L32 51 L19 43 Q13 36 15 24 Z" fill="url(#fur-fox)"/>
        <path d="M18 22 L21 15 L26 20 Z" fill="#2b1c17"/>
        <path d="M46 22 L43 15 L38 20 Z" fill="#2b1c17"/>
        <path d="M17 37 Q24 35 32 42 Q40 35 47 37 L45 43 L32 51 L19 43 Z" fill="#faf5ef"/>
        <circle cx="25.5" cy="31.5" r="2.3" fill="#1c1917"/>
        <circle cx="38.5" cy="31.5" r="2.3" fill="#1c1917"/>
        <circle cx="26.2" cy="30.8" r="0.8" fill="#ffffff"/>
        <circle cx="39.2" cy="30.8" r="0.8" fill="#ffffff"/>
        <ellipse cx="32" cy="41.5" rx="2.8" ry="2" fill="#1c1917"/>
      </svg>
    `)
  },
  {
    id: 'shiba-warm',
    label: 'Shiba',
    url: svgToDataUri(`
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
        <defs>
          <linearGradient id="bg-shiba" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stop-color="#2c241b"/>
            <stop offset="100%" stop-color="#191614"/>
          </linearGradient>
        </defs>
        <rect width="64" height="64" fill="url(#bg-shiba)"/>
        <path d="M16 26 L19 13 L29 21 Q32 20 35 21 L45 13 L48 26 Q51 37 45 45 Q39 51 32 51 Q25 51 19 45 Q13 37 16 26 Z" fill="#e09448"/>
        <path d="M18 23 L20.5 16 L26 20.5 Z" fill="#b46927"/>
        <path d="M46 23 L43.5 16 L38 20.5 Z" fill="#b46927"/>
        <path d="M18 42 Q24 32 32 36 Q40 32 46 42 Q40 51 32 51 Q24 51 18 42 Z" fill="#fbf6ed"/>
        <ellipse cx="26" cy="27" rx="2" ry="1.2" fill="#fbf6ed"/>
        <ellipse cx="38" cy="27" rx="2" ry="1.2" fill="#fbf6ed"/>
        <circle cx="25.5" cy="31.5" r="2.2" fill="#1c1917"/>
        <circle cx="38.5" cy="31.5" r="2.2" fill="#1c1917"/>
        <circle cx="26.1" cy="30.8" r="0.8" fill="#ffffff"/>
        <circle cx="39.1" cy="30.8" r="0.8" fill="#ffffff"/>
        <ellipse cx="22" cy="36" rx="2.4" ry="1.4" fill="#f48c8c" opacity="0.5"/>
        <ellipse cx="42" cy="36" rx="2.4" ry="1.4" fill="#f48c8c" opacity="0.5"/>
        <ellipse cx="32" cy="38.5" rx="2.6" ry="1.8" fill="#1c1917"/>
        <path d="M29.5 41.2 Q32 43.2 34.5 41.2" stroke="#57473a" stroke-width="1.2" fill="none" stroke-linecap="round"/>
      </svg>
    `)
  },
  {
    id: 'cat-stealth',
    label: 'Gato Nocturno',
    url: svgToDataUri(`
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
        <defs>
          <linearGradient id="bg-cat" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stop-color="#252333"/>
            <stop offset="100%" stop-color="#14141a"/>
          </linearGradient>
        </defs>
        <rect width="64" height="64" fill="url(#bg-cat)"/>
        <path d="M16 26 L19 13 L29 21 Q32 20 35 21 L45 13 L48 26 Q51 35 46 44 Q40 51 32 51 Q24 51 18 44 Q13 35 16 26 Z" fill="#323142"/>
        <path d="M19 23 L20.5 16 L26 20.5 Z" fill="#524d6e"/>
        <path d="M45 23 L43.5 16 L38 20.5 Z" fill="#524d6e"/>
        <ellipse cx="25.5" cy="33" rx="3.2" ry="2.8" fill="#fbbf24"/>
        <ellipse cx="38.5" cy="33" rx="3.2" ry="2.8" fill="#fbbf24"/>
        <ellipse cx="25.5" cy="33" rx="1.2" ry="2.2" fill="#14141a"/>
        <ellipse cx="38.5" cy="33" rx="1.2" ry="2.2" fill="#14141a"/>
        <circle cx="26.2" cy="32" r="0.7" fill="#ffffff"/>
        <circle cx="39.2" cy="32" r="0.7" fill="#ffffff"/>
        <path d="M30.2 38.5 L33.8 38.5 L32 40.5 Z" fill="#f472b6"/>
      </svg>
    `)
  },
  {
    id: 'panda-ink',
    label: 'Panda',
    url: svgToDataUri(`
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
        <defs>
          <linearGradient id="bg-panda" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stop-color="#1f2924"/>
            <stop offset="100%" stop-color="#141716"/>
          </linearGradient>
        </defs>
        <rect width="64" height="64" fill="url(#bg-panda)"/>
        <circle cx="19" cy="19" r="6" fill="#18181b"/>
        <circle cx="45" cy="19" r="6" fill="#18181b"/>
        <ellipse cx="32" cy="35" rx="16.5" ry="15" fill="#f8fafc"/>
        <ellipse cx="24.5" cy="33" rx="4.4" ry="5.4" transform="rotate(-16 24.5 33)" fill="#18181b"/>
        <ellipse cx="39.5" cy="33" rx="4.4" ry="5.4" transform="rotate(16 39.5 33)" fill="#18181b"/>
        <circle cx="25" cy="32" r="1.7" fill="#ffffff"/>
        <circle cx="39" cy="32" r="1.7" fill="#ffffff"/>
        <circle cx="25.5" cy="31.4" r="0.6" fill="#18181b"/>
        <circle cx="39.5" cy="31.4" r="0.6" fill="#18181b"/>
        <ellipse cx="21" cy="39" rx="2.4" ry="1.4" fill="#fca5a5" opacity="0.6"/>
        <ellipse cx="43" cy="39" rx="2.4" ry="1.4" fill="#fca5a5" opacity="0.6"/>
        <ellipse cx="32" cy="38.5" rx="2.6" ry="1.8" fill="#18181b"/>
        <path d="M29.5 41.5 Q32 43.2 34.5 41.5" stroke="#3f3f46" stroke-width="1.2" fill="none" stroke-linecap="round"/>
      </svg>
    `)
  },
  {
    id: 'owl-sage',
    label: 'Búho',
    url: svgToDataUri(`
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
        <defs>
          <linearGradient id="bg-owl" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stop-color="#1b2625"/>
            <stop offset="100%" stop-color="#121617"/>
          </linearGradient>
        </defs>
        <rect width="64" height="64" fill="url(#bg-owl)"/>
        <path d="M17 19 L25 22 L20 28 Z" fill="#475569"/>
        <path d="M47 19 L39 22 L44 28 Z" fill="#475569"/>
        <ellipse cx="32" cy="35" rx="16.5" ry="16" fill="#64748b"/>
        <ellipse cx="32" cy="40" rx="10" ry="9" fill="#94a3b8" opacity="0.45"/>
        <circle cx="25" cy="31" r="6" fill="#f8fafc"/>
        <circle cx="39" cy="31" r="6" fill="#f8fafc"/>
        <circle cx="25" cy="31" r="3" fill="#f59e0b"/>
        <circle cx="39" cy="31" r="3" fill="#f59e0b"/>
        <circle cx="25" cy="31" r="1.6" fill="#0f172a"/>
        <circle cx="39" cy="31" r="1.6" fill="#0f172a"/>
        <circle cx="25.6" cy="30.2" r="0.6" fill="#ffffff"/>
        <circle cx="39.6" cy="30.2" r="0.6" fill="#ffffff"/>
        <path d="M29.5 34.5 L34.5 34.5 L32 39.5 Z" fill="#fbbf24"/>
      </svg>
    `)
  },

  // --- Sci-Fi & Minimalistas ---
  {
    id: 'astro-mono',
    label: 'Astronauta',
    url: svgToDataUri(`
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
        <defs>
          <linearGradient id="bg-astro" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stop-color="#1b1c2e"/>
            <stop offset="100%" stop-color="#0f1018"/>
          </linearGradient>
          <linearGradient id="visor-astro" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stop-color="#312e81"/>
            <stop offset="100%" stop-color="#0f172a"/>
          </linearGradient>
        </defs>
        <rect width="64" height="64" fill="url(#bg-astro)"/>
        <circle cx="15" cy="17" r="1" fill="#ffffff" opacity="0.6"/>
        <circle cx="49" cy="19" r="1.2" fill="#c4b5fd" opacity="0.7"/>
        <circle cx="32" cy="32" r="18" fill="#f1f5f9"/>
        <rect x="19" y="23" width="26" height="16" rx="8" fill="url(#visor-astro)"/>
        <circle cx="27" cy="31" r="2.2" fill="#a78bfa"/>
        <circle cx="37" cy="31" r="2.2" fill="#a78bfa"/>
        <path d="M23 26.5 Q28 24.5 33 25.5" stroke="#ffffff" stroke-opacity="0.45" stroke-width="1.8" fill="none" stroke-linecap="round"/>
      </svg>
    `)
  },
  {
    id: 'bot-minimal',
    label: 'Androide',
    url: svgToDataUri(`
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
        <defs>
          <linearGradient id="bg-bot" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stop-color="#1c222d"/>
            <stop offset="100%" stop-color="#11141a"/>
          </linearGradient>
        </defs>
        <rect width="64" height="64" fill="url(#bg-bot)"/>
        <line x1="32" y1="11" x2="32" y2="19" stroke="#64748b" stroke-width="2.2" stroke-linecap="round"/>
        <circle cx="32" cy="11" r="2.4" fill="#38bdf8"/>
        <rect x="16" y="19" width="32" height="27" rx="9" fill="#334155"/>
        <rect x="20" y="26" width="24" height="11" rx="5.5" fill="#0f172a"/>
        <path d="M24 31.5 Q26.5 29 29 31.5" stroke="#38bdf8" stroke-width="2.2" fill="none" stroke-linecap="round"/>
        <path d="M35 31.5 Q37.5 29 40 31.5" stroke="#38bdf8" stroke-width="2.2" fill="none" stroke-linecap="round"/>
        <line x1="27" y1="41.5" x2="37" y2="41.5" stroke="#94a3b8" stroke-width="2" stroke-linecap="round"/>
      </svg>
    `)
  },
  {
    id: 'obsidian-prism',
    label: 'Prisma Obsidian',
    url: svgToDataUri(`
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
        <defs>
          <linearGradient id="bg-prism" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stop-color="#1f1a2e"/>
            <stop offset="100%" stop-color="#111116"/>
          </linearGradient>
          <linearGradient id="g-prism" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stop-color="#a855f7"/>
            <stop offset="100%" stop-color="#4f46e5"/>
          </linearGradient>
        </defs>
        <rect width="64" height="64" fill="url(#bg-prism)"/>
        <polygon points="32,12 50,28 40,51 24,51 14,28" fill="url(#g-prism)"/>
        <polygon points="32,12 50,28 32,34" fill="#ffffff" opacity="0.22"/>
        <polygon points="32,12 14,28 32,34" fill="#ffffff" opacity="0.08"/>
        <polygon points="14,28 32,34 24,51" fill="#000000" opacity="0.22"/>
      </svg>
    `)
  }
]

/**
 * Redimensiona una imagen seleccionada por el usuario a 128x128 para guardarla
 * de forma ligera como data URL en el perfil.
 */
export function resizeAvatarFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(new Error('No se pudo leer la imagen'))
    reader.onload = () => {
      const img = new Image()
      img.onerror = () => reject(new Error('Archivo de imagen inválido'))
      img.onload = () => {
        const size = 128
        const canvas = document.createElement('canvas')
        canvas.width = size
        canvas.height = size
        const ctx = canvas.getContext('2d')
        if (!ctx) {
          resolve(reader.result as string)
          return
        }
        const minSide = Math.min(img.width, img.height)
        const sx = (img.width - minSide) / 2
        const sy = (img.height - minSide) / 2
        ctx.drawImage(img, sx, sy, minSide, minSide, 0, 0, size, size)
        resolve(canvas.toDataURL('image/webp', 0.85))
      }
      img.src = reader.result as string
    }
    reader.readAsDataURL(file)
  })
}
