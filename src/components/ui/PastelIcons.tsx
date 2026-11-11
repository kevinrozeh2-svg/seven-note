import { useId, useSyncExternalStore } from 'react'

const COLOR_STORE_KEY = 'seven_note_folder_colors'
let folderColors: Record<string, number> = (() => {
  try {
    return JSON.parse(localStorage.getItem(COLOR_STORE_KEY) || '{}')
  } catch {
    return {}
  }
})()
const listeners = new Set<() => void>()

export function setFolderColor(path: string, index: number) {
  folderColors = { ...folderColors, [path]: index }
  try {
    localStorage.setItem(COLOR_STORE_KEY, JSON.stringify(folderColors))
  } catch {
    /* ignore */
  }
  listeners.forEach((l) => l())
}

export function useFolderColors() {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb)
      return () => listeners.delete(cb)
    },
    () => folderColors
  )
}

/**
 * Pastel folder / file icons (macOS-like soft style).
 * Folders get a stable pastel color derived from their name.
 */

export const FOLDER_PALETTE = [
  { label: 'Azul', stroke: '#5B9BF0', top: '#EAF3FF', bottom: '#CFE2FD', tab: '#DCEBFE' },
  { label: 'Verde', stroke: '#4FB878', top: '#EAF8EF', bottom: '#CDEFD9', tab: '#DCF3E4' },
  { label: 'Rosa', stroke: '#EC6FA5', top: '#FFEEF5', bottom: '#FCD3E5', tab: '#FDE1ED' },
  { label: 'Naranja', stroke: '#F2A33A', top: '#FFF4E3', bottom: '#FEDDB0', tab: '#FFE9C9' },
  { label: 'Morado', stroke: '#9B7BEA', top: '#F3EEFF', bottom: '#DFD3FC', tab: '#E9E1FD' },
  { label: 'Turquesa', stroke: '#3FB5B5', top: '#E7F8F8', bottom: '#C6ECEC', tab: '#D6F2F2' },
  { label: 'Rojo', stroke: '#E8615A', top: '#FFEDEC', bottom: '#FBD0CD', tab: '#FDDFDD' },
  { label: 'Amarillo', stroke: '#D9B421', top: '#FFF9DD', bottom: '#F9EBA6', tab: '#FCF2C3' },
  { label: 'Gris', stroke: '#9A9AA2', top: '#F4F4F6', bottom: '#E2E2E6', tab: '#EBEBEE' }
]

export function folderColorIndex(name: string): number {
  let h = 0
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0
  return h % 6
}

export function PastelFolderIcon({
  name = '',
  size = 18,
  open = false,
  className = ''
}: {
  name?: string
  size?: number
  open?: boolean
  className?: string
}) {
  const colors = useFolderColors()
  const c = FOLDER_PALETTE[colors[name] ?? folderColorIndex(name)] ?? FOLDER_PALETTE[0]
  const gid = useId().replace(/:/g, '')
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      className={`shrink-0 ${className}`}
      aria-hidden
    >
      <defs>
        <linearGradient id={`pf-${gid}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={c.top} />
          <stop offset="1" stopColor={c.bottom} />
        </linearGradient>
      </defs>
      {/* back + tab */}
      <path
        d="M2.75 7A2.25 2.25 0 0 1 5 4.75h3.6c.55 0 1.07.22 1.46.6l1.19 1.15h7.75A2.25 2.25 0 0 1 21.25 8.75V10H2.75Z"
        fill={c.tab}
        stroke={c.stroke}
        strokeWidth="1.25"
        strokeLinejoin="round"
      />
      {/* paper sheet peeking out when open */}
      {open && (
        <rect
          x="5"
          y="6.6"
          width="14"
          height="8"
          rx="1.4"
          fill="white"
          stroke={c.stroke}
          strokeOpacity="0.55"
          strokeWidth="1"
        />
      )}
      {/* front */}
      <path
        d={
          open
            ? 'M2.75 12.25A2 2 0 0 1 4.75 10.25h14.5a2 2 0 0 1 2 2v5a2.25 2.25 0 0 1-2.25 2.25H5a2.25 2.25 0 0 1-2.25-2.25Z'
            : 'M2.75 10.75A2 2 0 0 1 4.75 8.75h14.5a2 2 0 0 1 2 2v6.5a2.25 2.25 0 0 1-2.25 2.25H5a2.25 2.25 0 0 1-2.25-2.25Z'
        }
        fill={`url(#pf-${gid})`}
        stroke={c.stroke}
        strokeWidth="1.25"
        strokeLinejoin="round"
      />
      {/* soft highlight */}
      <path
        d={open ? 'M4.5 12.1h15' : 'M4.5 10.6h15'}
        stroke="white"
        strokeOpacity="0.85"
        strokeWidth="1"
        strokeLinecap="round"
      />
    </svg>
  )
}

export type PastelFileKind = 'doc' | 'canvas' | 'split' | 'code' | 'audio' | 'video' | 'sparkle'

export function PastelFileIcon({
  kind = 'doc',
  size = 18,
  className = ''
}: {
  kind?: PastelFileKind
  size?: number
  className?: string
}) {
  const glyph = (() => {
    const s = { stroke: 'currentColor', strokeWidth: 1.1, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const }
    switch (kind) {
      case 'canvas':
        return (
          <g {...s}>
            <rect x="8.2" y="11" width="3.3" height="3.3" rx=".7" />
            <rect x="12.6" y="11" width="3.3" height="3.3" rx=".7" />
            <rect x="8.2" y="15.3" width="7.7" height="2.4" rx=".7" />
          </g>
        )
      case 'split':
        return (
          <g {...s}>
            <rect x="8" y="11" width="8" height="6.6" rx="1" />
            <path d="M12 11v6.6" />
          </g>
        )
      case 'code':
        return <path d="M10.3 12.3 8.5 14.2l1.8 1.9M13.7 12.3l1.8 1.9-1.8 1.9M12.6 11.6l-1.2 5.2" {...s} />
      case 'audio':
        return <path d="M8.6 13.4v1.6M10.3 12v4.4M12 11v6.4M13.7 12v4.4M15.4 13.4v1.6" {...s} />
      case 'video':
        return <path d="M10.6 11.8v4.8l4-2.4Z" {...s} />
      case 'sparkle':
        return <path d="M12 11c.3 1.7 1 2.5 2.7 2.8-1.7.3-2.4 1-2.7 2.7-.3-1.7-1-2.4-2.7-2.7 1.7-.3 2.4-1.1 2.7-2.8Z" {...s} />
      default:
        return <path d="M8.6 12h6.8M8.6 14.4h6.8M8.6 16.8h4.2" {...s} />
    }
  })()

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      className={`shrink-0 text-neutral-400 dark:text-neutral-500 ${className}`}
      aria-hidden
    >
      <path
        d="M6.75 2.75h6.6c.4 0 .78.16 1.06.44l4.4 4.4c.28.28.44.66.44 1.06V19A2.25 2.25 0 0 1 17 21.25H6.75A2.25 2.25 0 0 1 4.5 19V5A2.25 2.25 0 0 1 6.75 2.75Z"
        className="fill-white dark:fill-white/5"
        stroke="currentColor"
        strokeWidth="1.25"
        strokeLinejoin="round"
      />
      <path d="M13.5 3v3.75c0 .69.56 1.25 1.25 1.25h3.75" stroke="currentColor" strokeWidth="1.25" strokeLinejoin="round" />
      {glyph}
    </svg>
  )
}

export default PastelFolderIcon
