import React, { useState } from 'react'

export type UserAvatarSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl'
export type UserAvatarShape = 'circle' | 'rounded'

interface UserAvatarProps {
  name?: string
  avatarUrl?: string | null
  color?: string
  size?: UserAvatarSize
  shape?: UserAvatarShape
  className?: string
  alt?: string
}

const SIZE_CLASSES: Record<UserAvatarSize, string> = {
  xs: 'w-4 h-4 text-[9px]',
  sm: 'w-6 h-6 text-[10px]',
  md: 'w-7 h-7 text-[11px]',
  lg: 'w-9 h-9 text-sm',
  xl: 'w-14 h-14 text-lg'
}

const SHAPE_CLASSES: Record<UserAvatarShape, Record<UserAvatarSize, string>> = {
  circle: {
    xs: 'rounded-full',
    sm: 'rounded-full',
    md: 'rounded-full',
    lg: 'rounded-full',
    xl: 'rounded-full'
  },
  rounded: {
    xs: 'rounded',
    sm: 'rounded-md',
    md: 'rounded-lg',
    lg: 'rounded-lg',
    xl: 'rounded-xl'
  }
}

function getInitials(name?: string): string {
  const cleaned = (name || 'U').trim()
  if (!cleaned) return 'U'
  const parts = cleaned.split(/\s+/).filter(Boolean)
  if (parts.length >= 2) {
    return `${parts[0].charAt(0)}${parts[1].charAt(0)}`.toUpperCase()
  }
  return cleaned.charAt(0).toUpperCase()
}

export const UserAvatar: React.FC<UserAvatarProps> = ({
  name = 'Usuario',
  avatarUrl,
  color = '#2563eb',
  size = 'md',
  shape = 'circle',
  className = '',
  alt
}) => {
  const [failedUrl, setFailedUrl] = useState<string | null>(null)

  const normalizedUrl = typeof avatarUrl === 'string' ? avatarUrl.trim() : ''
  const imgFailed = Boolean(normalizedUrl) && failedUrl === normalizedUrl
  const showImage = Boolean(normalizedUrl) && !imgFailed
  const sizeClass = SIZE_CLASSES[size]
  const shapeClass = SHAPE_CLASSES[shape][size]
  const initials = getInitials(name)
  const bgColor = color || '#2563eb'

  if (showImage) {
    return (
      <span
        className={`relative inline-flex items-center justify-center shrink-0 overflow-hidden select-none border border-black/[0.08] dark:border-white/[0.12] bg-[var(--app-bg-secondary)] ${sizeClass} ${shapeClass} ${className}`}
      >
        <img
          src={normalizedUrl}
          alt={alt || name}
          loading="lazy"
          decoding="async"
          referrerPolicy="no-referrer"
          onError={() => setFailedUrl(normalizedUrl)}
          className="w-full h-full object-cover"
        />
      </span>
    )
  }

  return (
    <span
      className={`relative inline-flex items-center justify-center shrink-0 overflow-hidden select-none font-semibold text-white tracking-tight border border-black/[0.08] dark:border-white/[0.12] ${sizeClass} ${shapeClass} ${className}`}
      style={{
        backgroundColor: bgColor,
        backgroundImage:
          'linear-gradient(145deg, rgba(255,255,255,0.2) 0%, rgba(255,255,255,0) 55%, rgba(0,0,0,0.14) 100%)'
      }}
      aria-label={alt || name}
    >
      {size === 'xs' ? initials.charAt(0) : initials}
    </span>
  )
}
