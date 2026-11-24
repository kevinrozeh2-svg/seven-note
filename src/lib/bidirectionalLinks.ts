import { DEFAULT_SPACE_ID, type SpaceItem, type WorkspaceItem } from '../db'

export type LinkRelation = 'bidirectional' | 'incoming' | 'outgoing'

export interface BidirectionalLinkItem {
  workspace: WorkspaceItem
  isOutgoing: boolean
  isIncoming: boolean
  relation: LinkRelation
  spaceName: string
  spaceIcon: string
  snippet: string
  contextExcerpt?: string
}

export interface UnlinkedMentionItem {
  workspace: WorkspaceItem
  spaceName: string
  spaceIcon: string
  contextExcerpt: string
}

export interface ExplicitLinksResult {
  linkedIds: Set<string>
  wikilinkIds: Set<string>
  unresolvedTitles: string[]
}

const IGNORED_TITLES = new Set([
  'untitled',
  'documento sin título',
  'documento sin titulo',
  'sin título',
  'sin titulo',
  'nueva nota',
  'new note'
])

function safeDecodeURIComponent(value: string): string {
  try {
    return decodeURIComponent(value)
  } catch {
    return value
  }
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

export function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#0?39;/gi, "'")
}

/**
 * Strips HTML tags and returns clean single-spaced plain text.
 */
export function stripHtmlToPlainText(html?: string): string {
  if (!html) return ''
  return decodeHtmlEntities(
    html
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, ' ')
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, ' ')
      .replace(/<br\s*\/?>/gi, ' ')
      .replace(/<\/(p|div|li|h[1-6]|blockquote|tr)>/gi, ' ')
      .replace(/<\/?[^>]+(>|$)/g, ' ')
  )
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Strips explicit note link nodes and wikilinks before scanning for unlinked plain-text mentions.
 */
function stripExplicitLinksForMentionScan(html?: string): string {
  if (!html) return ''
  const withoutExplicitNodes = html
    // Remove NoteLinkCard blocks
    .replace(/<div[^>]*data-note-id="[^"]*"[^>]*>[\s\S]*?<\/div>/gi, ' ')
    // Remove NoteMention / #note= anchor links
    .replace(/<a[^>]*(?:href="#note=[^"]*"|data-note-id="[^"]*")[^>]*>[\s\S]*?<\/a>/gi, ' ')
    .replace(/<span[^>]*data-type="note-mention"[^>]*>[\s\S]*?<\/span>/gi, ' ')
    // Remove [[wikilinks]]
    .replace(/\[\[[^\]]+\]\]/g, ' ')

  return stripHtmlToPlainText(withoutExplicitNodes)
}

export function extractSnippetFromHtml(html?: string, maxLength: number = 90): string {
  const clean = stripHtmlToPlainText(html)
  if (!clean) return ''
  return clean.length > maxLength ? clean.slice(0, maxLength).trimEnd() + '…' : clean
}

/**
 * Builds lookup maps for active workspaces.
 */
export function buildWorkspaceIndex(workspaces: WorkspaceItem[]) {
  const byId = new Map<string, WorkspaceItem>()
  const byTitleLower = new Map<string, WorkspaceItem>()

  for (const ws of workspaces) {
    if (ws.isDeleted) continue
    byId.set(ws.id, ws)
    const normalizedTitle = (ws.title || '').trim().toLowerCase()
    if (normalizedTitle && !IGNORED_TITLES.has(normalizedTitle) && !byTitleLower.has(normalizedTitle)) {
      byTitleLower.set(normalizedTitle, ws)
    }
  }

  return { byId, byTitleLower }
}

/**
 * Extracts all explicit outgoing note IDs from a document's HTML content:
 *  - data-note-id="..."
 *  - href="#note=..."
 *  - [[Title]] or [[Title|Alias]] wikilinks
 */
export function extractExplicitLinkedIds(
  html: string | undefined,
  selfId: string,
  index: { byId: Map<string, WorkspaceItem>; byTitleLower: Map<string, WorkspaceItem> }
): ExplicitLinksResult {
  const linkedIds = new Set<string>()
  const wikilinkIds = new Set<string>()
  const unresolvedTitles: string[] = []
  const seenUnresolved = new Set<string>()

  if (!html) {
    return { linkedIds, wikilinkIds, unresolvedTitles }
  }

  // 1. data-note-id="..."
  const noteIdRegex = /data-note-id=["']([^"']+)["']/gi
  let match: RegExpExecArray | null
  while ((match = noteIdRegex.exec(html)) !== null) {
    const targetId = safeDecodeURIComponent(match[1].trim())
    if (targetId && targetId !== selfId && index.byId.has(targetId)) {
      linkedIds.add(targetId)
    }
  }

  // 2. href="#note=..."
  const hrefRegex = /href=["']#note=([^"'&#]+)["'&#]?/gi
  while ((match = hrefRegex.exec(html)) !== null) {
    const targetId = safeDecodeURIComponent(match[1].trim())
    if (targetId && targetId !== selfId && index.byId.has(targetId)) {
      linkedIds.add(targetId)
    }
  }

  // 3. [[Title]] or [[Title|Alias]] in plain text (avoid matching inside HTML attributes)
  const plainText = stripHtmlToPlainText(html)
  const wikiRegex = /\[\[([^\]|]+)(?:\|[^\]]+)?\]\]/g
  while ((match = wikiRegex.exec(plainText)) !== null) {
    const rawTarget = match[1].trim()
    if (!rawTarget) continue
    const lowerTarget = rawTarget.toLowerCase()
    const targetWs = index.byTitleLower.get(lowerTarget) || index.byId.get(rawTarget)
    if (targetWs && targetWs.id !== selfId) {
      linkedIds.add(targetWs.id)
      wikilinkIds.add(targetWs.id)
    } else if (!targetWs && !seenUnresolved.has(lowerTarget)) {
      seenUnresolved.add(lowerTarget)
      unresolvedTitles.push(rawTarget)
    }
  }

  return { linkedIds, wikilinkIds, unresolvedTitles }
}

/**
 * Checks if a document's plain text contains an unlinked whole-word mention of `targetTitle`.
 */
export function isValidMentionTitle(title?: string): boolean {
  const trimmed = (title || '').trim()
  if (trimmed.length < 3) return false
  if (IGNORED_TITLES.has(trimmed.toLowerCase())) return false
  return true
}

export function buildWholeWordTitleRegex(title: string): RegExp {
  const escaped = escapeRegExp(title.trim())
  // Unicode-aware word boundary so accented Spanish words work accurately
  return new RegExp(`(?<![\\p{L}\\p{N}_])${escaped}(?![\\p{L}\\p{N}_])`, 'iu')
}

export function findUnlinkedMentionExcerpt(
  html: string | undefined,
  targetTitle: string | undefined,
  maxLength: number = 110
): string | null {
  if (!html || !isValidMentionTitle(targetTitle)) return null
  const plain = stripExplicitLinksForMentionScan(html)
  if (!plain) return null

  const regex = buildWholeWordTitleRegex(targetTitle!)
  const match = regex.exec(plain)
  if (!match) return null

  return sliceAroundIndex(plain, match.index, match[0].length, maxLength)
}

/**
 * Extracts a clean surrounding text excerpt where `sourceHtml` links to `targetWorkspace`.
 */
export function extractLinkContextExcerpt(
  sourceHtml: string | undefined,
  targetWorkspace: WorkspaceItem,
  maxLength: number = 110
): string | undefined {
  if (!sourceHtml) return undefined

  const title = (targetWorkspace.title || '').trim()
  const plain = stripHtmlToPlainText(sourceHtml)
  if (!plain) return undefined

  // 1. Check [[Title]] or [[Title|...]]
  if (title) {
    const wikiIdx = plain.toLowerCase().indexOf(`[[${title.toLowerCase()}`)
    if (wikiIdx !== -1) {
      return sliceAroundIndex(plain, wikiIdx, title.length + 4, maxLength)
    }
  }

  // 2. Check mention of title in plain text (including link anchor text)
  if (title && title.length >= 2) {
    const titleIdx = plain.toLowerCase().indexOf(title.toLowerCase())
    if (titleIdx !== -1) {
      return sliceAroundIndex(plain, titleIdx, title.length, maxLength)
    }
  }

  // 3. Fallback to document snippet
  return extractSnippetFromHtml(sourceHtml, maxLength) || undefined
}

function sliceAroundIndex(text: string, index: number, matchLen: number, maxLength: number): string {
  const half = Math.floor((maxLength - matchLen) / 2)
  let start = Math.max(0, index - Math.max(24, half))
  let end = Math.min(text.length, index + matchLen + Math.max(36, half))

  // Snap to word boundaries when possible
  if (start > 0) {
    const spaceAfter = text.indexOf(' ', start)
    if (spaceAfter !== -1 && spaceAfter < index) {
      start = spaceAfter + 1
    }
  }
  if (end < text.length) {
    const spaceBefore = text.lastIndexOf(' ', end)
    if (spaceBefore > index + matchLen) {
      end = spaceBefore
    }
  }

  const prefix = start > 0 ? '…' : ''
  const suffix = end < text.length ? '…' : ''
  return `${prefix}${text.slice(start, end).trim()}${suffix}`
}

const RELATION_PRIORITY: Record<LinkRelation, number> = {
  bidirectional: 0,
  incoming: 1,
  outgoing: 2
}

/**
 * Computes explicit bidirectional links (outgoing, incoming, bidirectional)
 * and separate unlinked mentions for the current workspace.
 */
export function computeBidirectionalLinks(
  currentWorkspace: WorkspaceItem,
  liveDocHtml: string | undefined,
  allWorkspaces: WorkspaceItem[],
  spaces: SpaceItem[]
): {
  links: BidirectionalLinkItem[]
  unlinkedMentions: UnlinkedMentionItem[]
  outgoingIds: Set<string>
} {
  const activeWorkspaces = allWorkspaces.filter((w) => !w.isDeleted)
  // Ensure currentWorkspace is in the index (with its latest title)
  const indexList = activeWorkspaces.some((w) => w.id === currentWorkspace.id)
    ? activeWorkspaces.map((w) => (w.id === currentWorkspace.id ? currentWorkspace : w))
    : [...activeWorkspaces, currentWorkspace]

  const index = buildWorkspaceIndex(indexList)
  const spaceById = new Map<string, SpaceItem>()
  for (const s of spaces) {
    spaceById.set(s.id, s)
  }

  const currentHtml = liveDocHtml ?? currentWorkspace.docContent ?? ''
  const currentOutgoing = extractExplicitLinkedIds(currentHtml, currentWorkspace.id, index).linkedIds

  const links: BidirectionalLinkItem[] = []
  const unlinkedMentions: UnlinkedMentionItem[] = []

  for (const other of activeWorkspaces) {
    if (other.id === currentWorkspace.id) continue

    const isOutgoing = currentOutgoing.has(other.id)
    const otherOutgoing = extractExplicitLinkedIds(other.docContent, other.id, index).linkedIds
    const isIncoming = otherOutgoing.has(currentWorkspace.id)

    const space = spaceById.get(other.spaceId || DEFAULT_SPACE_ID)
    const spaceName = space?.name || 'Espacio General'
    const spaceIcon = space?.icon || '🌐'

    if (isOutgoing || isIncoming) {
      const relation: LinkRelation =
        isOutgoing && isIncoming ? 'bidirectional' : isIncoming ? 'incoming' : 'outgoing'

      const fallbackSnippet =
        other.informationContent?.trim() ||
        extractSnippetFromHtml(other.docContent, 85) ||
        'Sin contenido adicional'

      const contextExcerpt = isIncoming
        ? extractLinkContextExcerpt(other.docContent, currentWorkspace, 110)
        : undefined

      links.push({
        workspace: other,
        isOutgoing,
        isIncoming,
        relation,
        spaceName,
        spaceIcon,
        snippet: fallbackSnippet,
        contextExcerpt
      })
    } else {
      // Check if the other document mentions this document's title in plain text without an explicit link
      const mentionExcerpt = findUnlinkedMentionExcerpt(other.docContent, currentWorkspace.title, 110)
      if (mentionExcerpt) {
        unlinkedMentions.push({
          workspace: other,
          spaceName,
          spaceIcon,
          contextExcerpt: mentionExcerpt
        })
      }
    }
  }

  links.sort((a, b) => {
    const prioDiff = RELATION_PRIORITY[a.relation] - RELATION_PRIORITY[b.relation]
    if (prioDiff !== 0) return prioDiff
    return (b.workspace.updatedAt || 0) - (a.workspace.updatedAt || 0)
  })

  unlinkedMentions.sort((a, b) => (b.workspace.updatedAt || 0) - (a.workspace.updatedAt || 0))

  return {
    links,
    unlinkedMentions,
    outgoingIds: currentOutgoing
  }
}
