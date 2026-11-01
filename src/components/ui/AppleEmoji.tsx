import React, { useState, useEffect } from 'react'
import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export const SINGLE_EMOJI_REGEX =
  /^(?:\p{Regional_Indicator}{2}|[0-9#*]\uFE0F?\u20E3|\p{Extended_Pictographic}(?:[\uFE0E\uFE0F\u200D\u{1F3FB}-\u{1F3FF}]|\p{Extended_Pictographic})*)$/u
export const EMOJI_MATCH_REGEX =
  /(?:\p{Regional_Indicator}{2}|[0-9#*]\uFE0F?\u20E3|\p{Extended_Pictographic}(?:[\uFE0E\uFE0F\u200D\u{1F3FB}-\u{1F3FF}]|\p{Extended_Pictographic})*)/gu
export const HAS_EMOJI_REGEX =
  /(?:\p{Regional_Indicator}{2}|[0-9#*]\uFE0F?\u20E3|\p{Extended_Pictographic}(?:[\uFE0E\uFE0F\u200D\u{1F3FB}-\u{1F3FF}]|\p{Extended_Pictographic})*)/u

/**
 * Checks if a value contains any emoji / pictograph
 */
export function isEmoji(val: unknown): val is string {
  if (typeof val !== 'string') return false
  return HAS_EMOJI_REGEX.test(val)
}

/**
 * Checks if a value is purely a single emoji sequence
 */
export function isSingleEmoji(val: unknown): val is string {
  if (typeof val !== 'string') return false
  return SINGLE_EMOJI_REGEX.test(val.trim())
}

/**
 * Converts an emoji character into the unified hexadecimal sequence used by emoji-datasource-apple
 */
export function getAppleEmojiUrl(emoji: string, forceVariant?: 'with-fe0f' | 'without-fe0f'): string {
  let codePoints = Array.from(emoji.trim()).map((char) =>
    char.codePointAt(0)!.toString(16).toLowerCase()
  )

  if (forceVariant === 'without-fe0f') {
    codePoints = codePoints.filter((cp) => cp !== 'fe0f')
  } else if (forceVariant === 'with-fe0f') {
    if (!codePoints.includes('fe0f')) {
      codePoints.push('fe0f')
    }
  }

  const unified = codePoints.join('-')
  return `https://cdn.jsdelivr.net/npm/emoji-datasource-apple@15.1.2/img/apple/64/${unified}.png`
}

export interface AppleEmojiProps {
  emoji?: string | React.ReactNode
  size?: number | string
  className?: string
  style?: React.CSSProperties
  alt?: string
}

/**
 * AppleEmoji renders authentic Apple / iOS emoji images everywhere (including Windows & Linux).
 * If the image fails to load or offline, it gracefully falls back to the native Unicode character.
 */
export function AppleEmoji({
  emoji,
  size = 20,
  className,
  style,
  alt
}: AppleEmojiProps) {
  const [retryStep, setRetryStep] = useState<0 | 1 | 2>(0)

  useEffect(() => {
    setRetryStep(0)
  }, [emoji])

  // If not a valid emoji string, render directly
  if (!emoji || typeof emoji !== 'string' || !isEmoji(emoji)) {
    return <>{emoji ?? null}</>
  }

  // If it's a composite text containing multiple characters (not just a single emoji sequence),
  // render it with renderWithAppleEmoji!
  if (!isSingleEmoji(emoji)) {
    return <>{renderWithAppleEmoji(emoji, size, className)}</>
  }

  // Fallback to native emoji if CDN image failed on both tries
  if (retryStep === 2) {
    return (
      <span
        className={cn('inline-block align-middle select-none', className)}
        style={{
          fontSize: typeof size === 'number' ? `${size * 0.9}px` : size,
          lineHeight: 1,
          ...style
        }}
      >
        {emoji}
      </span>
    )
  }

  // Calculate image URL
  const initialUrl = getAppleEmojiUrl(emoji)
  const hasFe0f = initialUrl.includes('fe0f')
  const src =
    retryStep === 1
      ? getAppleEmojiUrl(emoji, hasFe0f ? 'without-fe0f' : 'with-fe0f')
      : initialUrl

  const pixelSize = typeof size === 'number' ? `${size}px` : size

  return (
    <img
      src={src}
      alt={alt || emoji}
      loading="lazy"
      draggable={false}
      className={cn(
        'inline-block align-middle select-none pointer-events-none object-contain shrink-0',
        className
      )}
      style={{
        width: pixelSize,
        height: pixelSize,
        ...style
      }}
      onError={() => {
        setRetryStep((prev) => (prev === 0 ? 1 : 2))
      }}
    />
  )
}

/**
 * Parses any string and replaces all Unicode emojis inside it with real Apple / iOS emoji images.
 * Non-emoji text remains completely untouched and perfectly selectable.
 */
export function renderWithAppleEmoji(
  text: string | null | undefined,
  size: number | string = '1.18em',
  className?: string
): React.ReactNode {
  if (!text || typeof text !== 'string') return text ?? null
  if (!HAS_EMOJI_REGEX.test(text)) return text

  const regex = new RegExp(EMOJI_MATCH_REGEX.source, 'gu')
  const elements: React.ReactNode[] = []
  let lastIndex = 0
  let match: RegExpExecArray | null

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      elements.push(text.slice(lastIndex, match.index))
    }
    const emojiStr = match[0]
    elements.push(
      <AppleEmoji
        key={`${match.index}-${emojiStr}`}
        emoji={emojiStr}
        size={size}
        className={cn('inline-block mx-[1.5px] align-[-0.18em]', className)}
      />
    )
    lastIndex = match.index + emojiStr.length
  }

  if (lastIndex < text.length) {
    elements.push(text.slice(lastIndex))
  }

  return <>{elements}</>
}

/**
 * Text wrapper component that displays text with Apple / iOS emoji images.
 */
export function AppleEmojiText({
  text,
  size = '1.18em',
  className
}: {
  text?: string | null
  size?: number | string
  className?: string
}) {
  return <span className={className}>{renderWithAppleEmoji(text, size)}</span>
}
