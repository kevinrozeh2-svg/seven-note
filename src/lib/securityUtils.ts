/**
 * Shared frontend security helpers for HTML escaping and safe external URL validation.
 */

export function escapeHtml(str: string): string {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

/**
 * Validates and normalizes an external URL for safe use in `<a href>` or `<img src>`.
 * Blocks dangerous schemes such as `javascript:`, `vbscript:`, `data:`, and `file:`.
 * Returns `null` if the URL is invalid or uses a disallowed protocol.
 */
export function toSafeExternalUrl(
  rawUrl?: string | null,
  options: { allowMailto?: boolean; defaultHttps?: boolean } = {}
): string | null {
  if (!rawUrl || typeof rawUrl !== 'string') return null
  const trimmed = rawUrl.trim()
  if (!trimmed) return null

  // Reject control characters / ASCII whitespace injection inside schemes (e.g. "java\tscript:")
  const sanitized = trimmed.replace(/[\u0000-\u001F\u007F]+/g, '')
  if (!sanitized) return null

  const hasScheme = /^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(sanitized)
  const candidate =
    !hasScheme && options.defaultHttps && !sanitized.startsWith('//')
      ? `https://${sanitized}`
      : sanitized

  try {
    const parsed = new URL(candidate)
    const allowed = options.allowMailto
      ? new Set(['https:', 'http:', 'mailto:'])
      : new Set(['https:', 'http:'])

    if (!allowed.has(parsed.protocol.toLowerCase())) {
      return null
    }
    return parsed.toString()
  } catch {
    return null
  }
}
