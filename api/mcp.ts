import crypto from 'node:crypto'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js'
import { z } from 'zod'

const SERVER_NAME = 'seven-note-brain'
const SERVER_VERSION = '1.0.0'
const DEFAULT_SPACE_ID = 'default-workspace'

// ============================================================================
// Auth & Supabase helpers
// ============================================================================

function getEnv(name: string): string {
  return (process.env[name] || '').trim()
}

function includePrivateRecords(): boolean {
  return getEnv('MCP_INCLUDE_PRIVATE').toLowerCase() === 'true'
}

function constantTimeEquals(a: string, b: string): boolean {
  const bufA = Buffer.from(a, 'utf8')
  const bufB = Buffer.from(b, 'utf8')
  if (bufA.length !== bufB.length) return false
  return crypto.timingSafeEqual(bufA, bufB)
}

function extractApiKey(req: any): string {
  const authHeader = req.headers?.authorization || req.headers?.Authorization
  if (typeof authHeader === 'string') {
    const match = authHeader.match(/^Bearer\s+(.+)$/i)
    if (match?.[1]) return match[1].trim()
  }
  const xApiKey = req.headers?.['x-api-key'] || req.headers?.['X-Api-Key']
  if (typeof xApiKey === 'string' && xApiKey.trim()) {
    return xApiKey.trim()
  }
  return ''
}

function isAuthorized(req: any): { ok: boolean; error?: string; status?: number } {
  const expectedKey = getEnv('SEVEN_NOTE_MCP_API_KEY')
  if (!expectedKey) {
    return {
      ok: false,
      status: 500,
      error: 'SEVEN_NOTE_MCP_API_KEY is not configured on the server.',
    }
  }
  const providedKey = extractApiKey(req)
  if (!providedKey || !constantTimeEquals(providedKey, expectedKey)) {
    return {
      ok: false,
      status: 401,
      error: 'Unauthorized. Provide a valid Authorization: Bearer <token> or x-api-key header.',
    }
  }
  return { ok: true }
}

function getSupabaseAdmin(): SupabaseClient {
  const url = getEnv('SUPABASE_URL') || getEnv('VITE_SUPABASE_URL')
  const key = getEnv('SUPABASE_SERVICE_ROLE_KEY')
  if (!url || !key) {
    throw new Error(
      'Missing SUPABASE_URL (or VITE_SUPABASE_URL) or SUPABASE_SERVICE_ROLE_KEY environment variables.'
    )
  }
  return createClient(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  })
}

// ============================================================================
// HTML <-> Markdown conversion (TipTap-friendly, zero external deps)
// ============================================================================

function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => String.fromCodePoint(parseInt(dec, 10)))
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function htmlToMarkdown(raw: string): string {
  if (!raw) return ''
  let text = raw.trim()

  // Handle TipTap JSON if ever stored as JSON
  if (text.startsWith('{') && text.endsWith('}')) {
    try {
      const parsed = JSON.parse(text)
      if (parsed && typeof parsed === 'object' && parsed.type === 'doc') {
        return tiptapJsonToMarkdown(parsed).trim()
      }
    } catch {
      // Not valid JSON, continue as HTML
    }
  }

  // Code blocks first
  text = text.replace(
    /<pre[^>]*>\s*<code[^>]*>([\s\S]*?)<\/code>\s*<\/pre>/gi,
    (_, code) => `\n\`\`\`\n${decodeHtmlEntities(code).trim()}\n\`\`\`\n`
  )

  // Task items (TipTap TaskList)
  text = text.replace(
    /<li[^>]*data-type=["']taskItem["'][^>]*data-checked=["'](true|false)["'][^>]*>([\s\S]*?)<\/li>/gi,
    (_, checked, inner) => {
      const box = checked === 'true' ? '[x]' : '[ ]'
      return `\n- ${box} ${inner.replace(/<\/?p[^>]*>/gi, '').trim()}`
    }
  )

  // Headings
  for (let level = 1; level <= 6; level++) {
    const hashes = '#'.repeat(level)
    const re = new RegExp(`<h${level}[^>]*>([\\s\\S]*?)<\\/h${level}>`, 'gi')
    text = text.replace(re, (_, inner) => `\n\n${hashes} ${inner.trim()}\n\n`)
  }

  // Blockquotes
  text = text.replace(/<blockquote[^>]*>([\s\S]*?)<\/blockquote>/gi, (_, inner) => {
    const cleaned = inner.replace(/<\/?p[^>]*>/gi, '\n').trim()
    return (
      '\n\n' +
      cleaned
        .split('\n')
        .map((line: string) => `> ${line.trim()}`)
        .join('\n') +
      '\n\n'
    )
  })

  // Links & images
  text = text.replace(
    /<a[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi,
    (_, href, label) => `[${label.trim()}](${href})`
  )
  text = text.replace(
    /<img[^>]*src=["']([^"']+)["'][^>]*alt=["']([^"']*)["'][^>]*\/?>/gi,
    (_, src, alt) => `![${alt}](${src})`
  )
  text = text.replace(/<img[^>]*src=["']([^"']+)["'][^>]*\/?>/gi, (_, src) => `![](${src})`)

  // Inline formatting
  text = text.replace(/<(strong|b)[^>]*>([\s\S]*?)<\/\1>/gi, '**$2**')
  text = text.replace(/<(em|i)[^>]*>([\s\S]*?)<\/\1>/gi, '*$2*')
  text = text.replace(/<(s|del|strike)[^>]*>([\s\S]*?)<\/\1>/gi, '~~$2~~')
  text = text.replace(/<code[^>]*>([\s\S]*?)<\/code>/gi, '`$1`')

  // Lists
  text = text.replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, (_, inner) => {
    return `\n- ${inner.replace(/<\/?p[^>]*>/gi, '').trim()}`
  })
  text = text.replace(/<\/?(ul|ol)[^>]*>/gi, '\n')

  // Tables (basic readable rows)
  text = text.replace(/<tr[^>]*>([\s\S]*?)<\/tr>/gi, (_, row) => {
    const cells: string[] = []
    row.replace(/<t[hd][^>]*>([\s\S]*?)<\/t[hd]>/gi, (_m: string, cell: string) => {
      cells.push(cell.replace(/<[^>]+>/g, '').trim())
      return ''
    })
    return cells.length ? `\n| ${cells.join(' | ')} |` : ''
  })
  text = text.replace(/<\/?(table|thead|tbody|tfoot)[^>]*>/gi, '\n')

  // Breaks, horizontal rules, paragraphs
  text = text.replace(/<hr[^>]*\/?>/gi, '\n\n---\n\n')
  text = text.replace(/<br\s*\/?>/gi, '\n')
  text = text.replace(/<\/p>/gi, '\n\n')
  text = text.replace(/<p[^>]*>/gi, '')

  // Strip any remaining HTML tags
  text = text.replace(/<[^>]+>/g, '')

  return decodeHtmlEntities(text)
    .replace(/\r\n/g, '\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

function tiptapJsonToMarkdown(node: any): string {
  if (!node) return ''
  if (node.type === 'text') return node.text || ''
  const children = Array.isArray(node.content) ? node.content.map(tiptapJsonToMarkdown) : []
  switch (node.type) {
    case 'doc':
      return children.join('\n\n')
    case 'heading':
      return `${'#'.repeat(node.attrs?.level || 1)} ${children.join('')}`
    case 'paragraph':
      return children.join('')
    case 'bulletList':
    case 'orderedList':
    case 'taskList':
      return children.join('\n')
    case 'listItem':
      return `- ${children.join(' ').trim()}`
    case 'taskItem':
      return `- [${node.attrs?.checked ? 'x' : ' '}] ${children.join(' ').trim()}`
    case 'blockquote':
      return children
        .join('\n')
        .split('\n')
        .map((l: string) => `> ${l}`)
        .join('\n')
    case 'codeBlock':
      return `\`\`\`\n${children.join('')}\n\`\`\``
    case 'hardBreak':
      return '\n'
    case 'horizontalRule':
      return '---'
    default:
      return children.join('')
  }
}

function htmlToPlainText(html: string): string {
  return htmlToMarkdown(html)
    .replace(/[#*_`~>\[\]()]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function renderInlineMarkdown(line: string): string {
  let out = escapeHtml(line)
  // Inline code
  out = out.replace(/`([^`]+)`/g, '<code>$1</code>')
  // Links
  out = out.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2">$1</a>')
  // Bold
  out = out.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
  // Italic
  out = out.replace(/(^|[^*])\*([^*]+)\*(?!\*)/g, '$1<em>$2</em>')
  // Strikethrough
  out = out.replace(/~~([^~]+)~~/g, '<s>$1</s>')
  return out
}

function markdownToHtml(input: string): string {
  const trimmed = (input || '').trim()
  if (!trimmed) return '<p></p>'
  // If already looks like HTML, return as-is
  if (/^<(p|h[1-6]|div|ul|ol|blockquote|pre|table|hr)\b/i.test(trimmed)) {
    return trimmed
  }

  const lines = trimmed.replace(/\r\n/g, '\n').split('\n')
  const htmlParts: string[] = []
  let inCodeBlock = false
  let codeBuffer: string[] = []
  let listType: 'ul' | 'ol' | 'task' | null = null

  const closeList = () => {
    if (!listType) return
    htmlParts.push(listType === 'ol' ? '</ol>' : '</ul>')
    listType = null
  }

  for (const rawLine of lines) {
    if (rawLine.trim().startsWith('```')) {
      closeList()
      if (!inCodeBlock) {
        inCodeBlock = true
        codeBuffer = []
      } else {
        inCodeBlock = false
        htmlParts.push(`<pre><code>${escapeHtml(codeBuffer.join('\n'))}</code></pre>`)
      }
      continue
    }

    if (inCodeBlock) {
      codeBuffer.push(rawLine)
      continue
    }

    const line = rawLine.trim()
    if (!line) {
      closeList()
      continue
    }

    // Horizontal rule
    if (/^(-{3,}|\*{3,}|_{3,})$/.test(line)) {
      closeList()
      htmlParts.push('<hr />')
      continue
    }

    // Headings
    const headingMatch = line.match(/^(#{1,6})\s+(.+)$/)
    if (headingMatch) {
      closeList()
      const level = headingMatch[1].length
      htmlParts.push(`<h${level}>${renderInlineMarkdown(headingMatch[2])}</h${level}>`)
      continue
    }

    // Task item
    const taskMatch = line.match(/^[-*]\s+\[( |x|X)\]\s+(.+)$/)
    if (taskMatch) {
      if (listType !== 'task') {
        closeList()
        htmlParts.push('<ul data-type="taskList">')
        listType = 'task'
      }
      const checked = taskMatch[1].toLowerCase() === 'x' ? 'true' : 'false'
      htmlParts.push(
        `<li data-type="taskItem" data-checked="${checked}"><p>${renderInlineMarkdown(taskMatch[2])}</p></li>`
      )
      continue
    }

    // Unordered list
    const ulMatch = line.match(/^[-*+]\s+(.+)$/)
    if (ulMatch) {
      if (listType !== 'ul') {
        closeList()
        htmlParts.push('<ul>')
        listType = 'ul'
      }
      htmlParts.push(`<li><p>${renderInlineMarkdown(ulMatch[1])}</p></li>`)
      continue
    }

    // Ordered list
    const olMatch = line.match(/^\d+\.\s+(.+)$/)
    if (olMatch) {
      if (listType !== 'ol') {
        closeList()
        htmlParts.push('<ol>')
        listType = 'ol'
      }
      htmlParts.push(`<li><p>${renderInlineMarkdown(olMatch[1])}</p></li>`)
      continue
    }

    // Blockquote
    const quoteMatch = line.match(/^>\s?(.*)$/)
    if (quoteMatch) {
      closeList()
      htmlParts.push(`<blockquote><p>${renderInlineMarkdown(quoteMatch[1])}</p></blockquote>`)
      continue
    }

    closeList()
    htmlParts.push(`<p>${renderInlineMarkdown(line)}</p>`)
  }

  closeList()
  if (inCodeBlock) {
    htmlParts.push(`<pre><code>${escapeHtml(codeBuffer.join('\n'))}</code></pre>`)
  }

  return htmlParts.join('') || '<p></p>'
}

function buildSnippet(text: string, terms: string[], maxLen = 280): string {
  if (!text) return ''
  const lower = text.toLowerCase()
  let bestIdx = -1
  for (const term of terms) {
    const idx = lower.indexOf(term)
    if (idx !== -1 && (bestIdx === -1 || idx < bestIdx)) {
      bestIdx = idx
    }
  }
  if (bestIdx === -1) {
    return text.length > maxLen ? `${text.slice(0, maxLen)}…` : text
  }
  const start = Math.max(0, bestIdx - 80)
  const end = Math.min(text.length, start + maxLen)
  const prefix = start > 0 ? '…' : ''
  const suffix = end < text.length ? '…' : ''
  return `${prefix}${text.slice(start, end)}${suffix}`
}

function normalizeTags(metadata: any): string[] {
  if (!metadata || typeof metadata !== 'object') return []
  return Array.isArray(metadata.tags)
    ? metadata.tags.filter((t: unknown): t is string => typeof t === 'string')
    : []
}

function jsonText(data: unknown): { content: [{ type: 'text'; text: string }] } {
  return {
    content: [{ type: 'text', text: JSON.stringify(data, null, 2) }],
  }
}

// ============================================================================
// MCP Server Factory (stateless per request for Vercel serverless)
// ============================================================================

function createSevenNoteMcpServer(supabase: SupabaseClient): McpServer {
  const allowPrivate = includePrivateRecords()

  const server = new McpServer({
    name: SERVER_NAME,
    version: SERVER_VERSION,
  })

  // Helper: fetch IDs of private spaces so bots NEVER read docs/canvas/tags inside private spaces
  async function getPrivateSpaceIds(): Promise<Set<string>> {
    if (allowPrivate) return new Set()
    const { data, error } = await supabase
      .from('seven_spaces')
      .select('id')
      .eq('is_private', true)
    if (error) throw new Error(`Supabase error checking private spaces: ${error.message}`)
    return new Set((data || []).map((s: any) => s.id))
  }

  // --------------------------------------------------------------------------
  // Tool 1: list_spaces
  // --------------------------------------------------------------------------
  server.registerTool(
    'list_spaces',
    {
      title: 'List Spaces',
      description:
        'List all active non-private spaces (including shared and admin-only team spaces) in Seven Note. Start here to understand how the team organizes its knowledge.',
      inputSchema: {},
    },
    async () => {
      let query = supabase
        .from('seven_spaces')
        .select('id, name, icon, color, sort_order, folder_order, updated_at, is_private, admin_only')
        .eq('is_deleted', false)
        .order('sort_order', { ascending: true, nullsFirst: false })
        .order('updated_at', { ascending: false })

      if (!allowPrivate) {
        query = query.eq('is_private', false)
      }

      const { data, error } = await query
      if (error) throw new Error(`Supabase error listing spaces: ${error.message}`)

      const spaces = (data || []).map((s: any) => ({
        id: s.id,
        name: s.name,
        icon: s.icon,
        color: s.color,
        admin_only: Boolean(s.admin_only),
        folders: Array.isArray(s.folder_order) ? s.folder_order : [],
        updated_at: s.updated_at,
      }))

      return jsonText({ count: spaces.length, spaces })
    }
  )

  // --------------------------------------------------------------------------
  // Tool 2: list_documents
  // --------------------------------------------------------------------------
  server.registerTool(
    'list_documents',
    {
      title: 'List Documents',
      description:
        'List active non-private documents/pages in Seven Note (includes shared and admin-only spaces; excludes private spaces and private documents). Filter by space_id, folder, tag, or favorites_only.',
      inputSchema: {
        space_id: z.string().optional().describe('Filter by space ID (from list_spaces).'),
        folder: z.string().optional().describe('Filter by exact folder name.'),
        tag: z.string().optional().describe('Filter by tag name (case-insensitive).'),
        favorites_only: z.boolean().optional().describe('Only return favorite documents.'),
        limit: z.number().int().min(1).max(200).optional().describe('Max documents to return (default 50).'),
      },
    },
    async ({ space_id, folder, tag, favorites_only, limit }) => {
      const privateSpaceIds = await getPrivateSpaceIds()
      if (space_id && privateSpaceIds.has(space_id)) {
        return jsonText({ count: 0, documents: [], error: 'Access denied: space is private.' })
      }

      const maxRows = limit ?? 50
      let query = supabase
        .from('seven_workspaces')
        .select(
          'id, space_id, parent_id, folder, title, icon, view_mode, is_favorite, metadata, created_at, updated_at, is_private'
        )
        .eq('is_deleted', false)
        .order('updated_at', { ascending: false })
        .limit(tag || privateSpaceIds.size > 0 ? 300 : maxRows)

      if (!allowPrivate) query = query.eq('is_private', false)
      if (space_id) query = query.eq('space_id', space_id)
      if (folder) query = query.eq('folder', folder)
      if (favorites_only) query = query.eq('is_favorite', true)

      const { data, error } = await query
      if (error) throw new Error(`Supabase error listing documents: ${error.message}`)

      const tagLower = tag?.trim().toLowerCase()
      let docs = (data || [])
        .filter((d: any) => !privateSpaceIds.has(d.space_id || DEFAULT_SPACE_ID))
        .map((d: any) => ({
          id: d.id,
          title: d.title,
          space_id: d.space_id || DEFAULT_SPACE_ID,
          parent_id: d.parent_id || null,
          folder: d.folder || null,
          icon: d.icon,
          view_mode: d.view_mode,
          is_favorite: Boolean(d.is_favorite),
          tags: normalizeTags(d.metadata),
          created_at: d.created_at,
          updated_at: d.updated_at,
        }))

      if (tagLower) {
        docs = docs.filter((d) => d.tags.some((t) => t.toLowerCase() === tagLower))
      }

      docs = docs.slice(0, maxRows)

      return jsonText({ count: docs.length, documents: docs })
    }
  )

  // --------------------------------------------------------------------------
  // Tool 3: search_knowledge
  // --------------------------------------------------------------------------
  server.registerTool(
    'search_knowledge',
    {
      title: 'Search Team Knowledge',
      description:
        'Search across Seven Note documents (titles, content, folders, tags) and canvas notes in shared and admin-only spaces (excludes all private spaces and private documents). Returns ranked matches with text snippets so you can decide which document to read in full with get_document.',
      inputSchema: {
        query: z.string().min(1).describe('Search query or keywords.'),
        space_id: z.string().optional().describe('Optional space ID to narrow the search.'),
        include_canvas: z.boolean().optional().describe('Also search canvas notes (default true).'),
        limit: z.number().int().min(1).max(30).optional().describe('Max results to return (default 10).'),
      },
    },
    async ({ query: rawQuery, space_id, include_canvas, limit }) => {
      const privateSpaceIds = await getPrivateSpaceIds()
      if (space_id && privateSpaceIds.has(space_id)) {
        return jsonText({ query: rawQuery, total_matches: 0, results: [], error: 'Access denied: space is private.' })
      }

      const maxResults = limit ?? 10
      const terms = rawQuery
        .toLowerCase()
        .split(/\s+/)
        .map((t) => t.trim())
        .filter((t) => t.length >= 2)
      const effectiveTerms = terms.length > 0 ? terms : [rawQuery.trim().toLowerCase()]

      let docQuery = supabase
        .from('seven_workspaces')
        .select('id, space_id, folder, title, icon, view_mode, doc_content, metadata, updated_at, is_private')
        .eq('is_deleted', false)
        .order('updated_at', { ascending: false })
        .limit(400)

      if (!allowPrivate) docQuery = docQuery.eq('is_private', false)
      if (space_id) docQuery = docQuery.eq('space_id', space_id)

      const { data: docs, error: docError } = await docQuery
      if (docError) throw new Error(`Supabase error searching documents: ${docError.message}`)

      const results: Array<{
        type: 'document' | 'canvas_node'
        id: string
        workspace_id?: string
        space_id?: string
        folder?: string | null
        title: string
        tags?: string[]
        score: number
        snippet: string
        updated_at: number
      }> = []

      const allowedWorkspaceIds = new Set<string>()
      const workspaceTitleMap = new Map<string, string>()

      for (const doc of docs || []) {
        if (privateSpaceIds.has(doc.space_id || DEFAULT_SPACE_ID)) continue
        allowedWorkspaceIds.add(doc.id)
        workspaceTitleMap.set(doc.id, doc.title || 'Sin título')

        const titleLower = (doc.title || '').toLowerCase()
        const folderLower = (doc.folder || '').toLowerCase()
        const tags = normalizeTags(doc.metadata)
        const tagsLower = tags.join(' ').toLowerCase()
        const plainBody = htmlToPlainText(doc.doc_content || '')
        const bodyLower = plainBody.toLowerCase()

        let score = 0
        const fullPhrase = rawQuery.trim().toLowerCase()
        if (titleLower.includes(fullPhrase)) score += 15
        if (bodyLower.includes(fullPhrase)) score += 8

        for (const term of effectiveTerms) {
          if (titleLower.includes(term)) score += 6
          if (tagsLower.includes(term)) score += 4
          if (folderLower.includes(term)) score += 3
          if (bodyLower.includes(term)) score += 2
        }

        if (score > 0) {
          results.push({
            type: 'document',
            id: doc.id,
            space_id: doc.space_id || DEFAULT_SPACE_ID,
            folder: doc.folder || null,
            title: doc.title || 'Sin título',
            tags,
            score,
            snippet: buildSnippet(plainBody || doc.title || '', effectiveTerms),
            updated_at: doc.updated_at,
          })
        }
      }

      if (include_canvas !== false && allowedWorkspaceIds.size > 0) {
        const { data: nodes, error: nodeError } = await supabase
          .from('seven_canvas_nodes')
          .select('id, workspace_id, type, data, updated_at')
          .eq('is_deleted', false)
          .order('updated_at', { ascending: false })
          .limit(300)

        if (!nodeError && nodes) {
          for (const node of nodes) {
            if (!allowedWorkspaceIds.has(node.workspace_id)) continue
            const nodeData = node.data || {}
            const nodeText = [
              nodeData.title,
              nodeData.label,
              nodeData.content,
              nodeData.text,
              nodeData.url,
              Array.isArray(nodeData.todos)
                ? nodeData.todos.map((t: any) => t?.text || '').join(' ')
                : '',
            ]
              .filter(Boolean)
              .join(' ')
            const plainNode = htmlToPlainText(nodeText)
            const lowerNode = plainNode.toLowerCase()

            let score = 0
            for (const term of effectiveTerms) {
              if (lowerNode.includes(term)) score += 3
            }

            if (score > 0) {
              results.push({
                type: 'canvas_node',
                id: node.id,
                workspace_id: node.workspace_id,
                title: `${workspaceTitleMap.get(node.workspace_id) || 'Tablero'} (${node.type})`,
                score,
                snippet: buildSnippet(plainNode, effectiveTerms),
                updated_at: node.updated_at,
              })
            }
          }
        }
      }

      results.sort((a, b) => b.score - a.score || b.updated_at - a.updated_at)

      return jsonText({
        query: rawQuery,
        total_matches: results.length,
        results: results.slice(0, maxResults),
      })
    }
  )

  // --------------------------------------------------------------------------
  // Tool 4: get_document
  // --------------------------------------------------------------------------
  server.registerTool(
    'get_document',
    {
      title: 'Get Document',
      description:
        'Read the full content of a Seven Note document by its ID, converted to clean Markdown, along with metadata, tags, custom properties, and optional canvas nodes.',
      inputSchema: {
        id: z.string().min(1).describe('Document ID (from list_documents or search_knowledge).'),
        include_canvas: z.boolean().optional().describe('Also include canvas nodes/edges for this document.'),
      },
    },
    async ({ id, include_canvas }) => {
      const [privateSpaceIds, { data: doc, error }] = await Promise.all([
        getPrivateSpaceIds(),
        supabase
          .from('seven_workspaces')
          .select('*')
          .eq('id', id)
          .eq('is_deleted', false)
          .maybeSingle(),
      ])

      if (error) throw new Error(`Supabase error fetching document: ${error.message}`)
      if (!doc) {
        return jsonText({ found: false, error: `Document '${id}' not found.` })
      }
      if (!allowPrivate && (doc.is_private || privateSpaceIds.has(doc.space_id || DEFAULT_SPACE_ID))) {
        return jsonText({ found: false, error: 'Access denied: document or its space is private.' })
      }

      const metadata = doc.metadata || {}
      const payload: Record<string, unknown> = {
        found: true,
        id: doc.id,
        title: doc.title,
        space_id: doc.space_id || DEFAULT_SPACE_ID,
        parent_id: doc.parent_id || null,
        folder: doc.folder || null,
        icon: doc.icon,
        view_mode: doc.view_mode,
        is_favorite: Boolean(doc.is_favorite),
        tags: normalizeTags(metadata),
        custom_properties: Array.isArray(metadata.customProperties) ? metadata.customProperties : [],
        database_data: metadata.databaseData || null,
        created_by: metadata.createdBy || null,
        last_edited_by: metadata.lastEditedBy || null,
        created_at: doc.created_at,
        updated_at: doc.updated_at,
        markdown: htmlToMarkdown(doc.doc_content || ''),
      }

      if (include_canvas) {
        const [{ data: nodes }, { data: edges }] = await Promise.all([
          supabase
            .from('seven_canvas_nodes')
            .select('id, type, position_x, position_y, width, height, data, updated_at')
            .eq('workspace_id', id)
            .eq('is_deleted', false),
          supabase
            .from('seven_canvas_edges')
            .select('id, source, target, label, color, edge_type')
            .eq('workspace_id', id)
            .eq('is_deleted', false),
        ])
        payload.canvas = {
          nodes: nodes || [],
          edges: edges || [],
        }
      }

      return jsonText(payload)
    }
  )

  // --------------------------------------------------------------------------
  // Tool 5: create_document
  // --------------------------------------------------------------------------
  server.registerTool(
    'create_document',
    {
      title: 'Create Document',
      description:
        'Create a new shared document/note in Seven Note. Content can be Markdown (recommended) or HTML. Changes sync automatically to the web and desktop app.',
      inputSchema: {
        title: z.string().min(1).describe('Title of the new document.'),
        content: z.string().optional().describe('Document body in Markdown (or HTML).'),
        space_id: z.string().optional().describe('Target space ID (defaults to default-workspace).'),
        folder: z.string().optional().describe('Optional folder name inside the space.'),
        parent_id: z.string().optional().describe('Optional parent document ID for nested pages.'),
        icon: z.string().optional().describe('Emoji icon (default 📄).'),
        tags: z.array(z.string()).optional().describe('Optional list of tag names.'),
        created_by: z.string().optional().describe('Bot or author name (default "AI Bot").'),
      },
    },
    async ({ title, content, space_id, folder, parent_id, icon, tags, created_by }) => {
      const targetSpaceId = space_id?.trim() || DEFAULT_SPACE_ID
      const privateSpaceIds = await getPrivateSpaceIds()
      if (privateSpaceIds.has(targetSpaceId)) {
        return jsonText({ created: false, error: 'Access denied: cannot create documents inside a private space.' })
      }

      const now = Date.now()
      const id = crypto.randomUUID()
      const author = created_by?.trim() || 'AI Bot'
      const htmlContent = markdownToHtml(content || '')

      const row = {
        id,
        space_id: targetSpaceId,
        parent_id: parent_id?.trim() || null,
        folder: folder?.trim() || null,
        title: title.trim(),
        icon: icon?.trim() || '📄',
        color: '#6366f1',
        view_mode: 'doc',
        doc_content: htmlContent,
        created_at: now,
        updated_at: now,
        is_favorite: false,
        is_deleted: false,
        is_private: false,
        metadata: {
          tags: tags || [],
          createdBy: author,
          lastEditedBy: author,
        },
      }

      const { error } = await supabase.from('seven_workspaces').insert(row)
      if (error) throw new Error(`Supabase error creating document: ${error.message}`)

      return jsonText({
        created: true,
        id,
        title: row.title,
        space_id: row.space_id,
        folder: row.folder,
        updated_at: now,
      })
    }
  )

  // --------------------------------------------------------------------------
  // Tool 6: update_document
  // --------------------------------------------------------------------------
  server.registerTool(
    'update_document',
    {
      title: 'Update Document',
      description:
        'Update an existing shared document in Seven Note. Supports replacing the full content or appending new Markdown/HTML to the end (ideal for logs, meeting notes, and bot memory).',
      inputSchema: {
        id: z.string().min(1).describe('ID of the document to update.'),
        title: z.string().optional().describe('New title (omit to keep existing).'),
        content: z.string().optional().describe('New content in Markdown or HTML.'),
        mode: z
          .enum(['replace', 'append'])
          .optional()
          .describe('Whether to replace or append content (default "replace").'),
        folder: z.string().nullable().optional().describe('New folder name, or null to remove from folder.'),
        icon: z.string().optional().describe('New emoji icon.'),
        tags: z.array(z.string()).optional().describe('Replace document tags.'),
        edited_by: z.string().optional().describe('Bot or author name (default "AI Bot").'),
      },
    },
    async ({ id, title, content, mode, folder, icon, tags, edited_by }) => {
      const [privateSpaceIds, { data: existing, error: fetchError }] = await Promise.all([
        getPrivateSpaceIds(),
        supabase
          .from('seven_workspaces')
          .select('*')
          .eq('id', id)
          .eq('is_deleted', false)
          .maybeSingle(),
      ])

      if (fetchError) throw new Error(`Supabase error reading document: ${fetchError.message}`)
      if (!existing) {
        return jsonText({ updated: false, error: `Document '${id}' not found.` })
      }
      if (!allowPrivate && (existing.is_private || privateSpaceIds.has(existing.space_id || DEFAULT_SPACE_ID))) {
        return jsonText({ updated: false, error: 'Access denied: document or its space is private.' })
      }

      const now = Math.max(Date.now(), (existing.updated_at || 0) + 1)
      const updates: Record<string, unknown> = {
        updated_at: now,
      }

      if (title !== undefined) updates.title = title.trim()
      if (folder !== undefined) updates.folder = folder
      if (icon !== undefined) updates.icon = icon.trim()

      if (content !== undefined) {
        const rendered = markdownToHtml(content)
        if (mode === 'append' && existing.doc_content) {
          updates.doc_content = `${existing.doc_content}${rendered}`
        } else {
          updates.doc_content = rendered
        }
      }

      const nextMetadata = {
        ...(existing.metadata || {}),
        lastEditedBy: edited_by?.trim() || 'AI Bot',
      }
      if (tags !== undefined) {
        nextMetadata.tags = tags
      }
      updates.metadata = nextMetadata

      const { error: updateError } = await supabase
        .from('seven_workspaces')
        .update(updates)
        .eq('id', id)

      if (updateError) throw new Error(`Supabase error updating document: ${updateError.message}`)

      return jsonText({
        updated: true,
        id,
        title: updates.title ?? existing.title,
        mode: content !== undefined ? mode || 'replace' : 'metadata_only',
        updated_at: now,
      })
    }
  )

  // --------------------------------------------------------------------------
  // Tool 7: get_canvas
  // --------------------------------------------------------------------------
  server.registerTool(
    'get_canvas',
    {
      title: 'Get Canvas Board',
      description: 'Read all active nodes and edges from a Seven Note workspace canvas board.',
      inputSchema: {
        workspace_id: z.string().min(1).describe('Workspace/document ID.'),
      },
    },
    async ({ workspace_id }) => {
      const [privateSpaceIds, { data: doc }] = await Promise.all([
        getPrivateSpaceIds(),
        supabase
          .from('seven_workspaces')
          .select('id, title, space_id, is_private, is_deleted')
          .eq('id', workspace_id)
          .maybeSingle(),
      ])

      if (!doc || doc.is_deleted) {
        return jsonText({ found: false, error: `Workspace '${workspace_id}' not found.` })
      }
      if (!allowPrivate && (doc.is_private || privateSpaceIds.has(doc.space_id || DEFAULT_SPACE_ID))) {
        return jsonText({ found: false, error: 'Access denied: workspace or its space is private.' })
      }

      const [{ data: nodes, error: nodesErr }, { data: edges, error: edgesErr }] = await Promise.all([
        supabase
          .from('seven_canvas_nodes')
          .select('id, type, position_x, position_y, width, height, data, updated_at')
          .eq('workspace_id', workspace_id)
          .eq('is_deleted', false),
        supabase
          .from('seven_canvas_edges')
          .select('id, source, target, label, color, edge_type')
          .eq('workspace_id', workspace_id)
          .eq('is_deleted', false),
      ])

      if (nodesErr) throw new Error(`Supabase error reading canvas nodes: ${nodesErr.message}`)
      if (edgesErr) throw new Error(`Supabase error reading canvas edges: ${edgesErr.message}`)

      return jsonText({
        found: true,
        workspace_id,
        title: doc.title,
        node_count: (nodes || []).length,
        edge_count: (edges || []).length,
        nodes: nodes || [],
        edges: edges || [],
      })
    }
  )

  // --------------------------------------------------------------------------
  // Tool 8: add_canvas_note
  // --------------------------------------------------------------------------
  server.registerTool(
    'add_canvas_note',
    {
      title: 'Add Canvas Note',
      description: 'Add a note or todo checklist card to a Seven Note workspace canvas board.',
      inputSchema: {
        workspace_id: z.string().min(1).describe('Target workspace/document ID.'),
        type: z.enum(['note', 'todo']).optional().describe('Card type: "note" or "todo" (default "note").'),
        title: z.string().optional().describe('Optional card title.'),
        content: z.string().optional().describe('Card text content (for type "note").'),
        todos: z.array(z.string()).optional().describe('Checklist items (for type "todo").'),
        x: z.number().optional().describe('X coordinate on canvas (default 100).'),
        y: z.number().optional().describe('Y coordinate on canvas (default 100).'),
        color: z.string().optional().describe('Card color hex (default #fef3c7).'),
      },
    },
    async ({ workspace_id, type, title, content, todos, x, y, color }) => {
      const [privateSpaceIds, { data: doc }] = await Promise.all([
        getPrivateSpaceIds(),
        supabase
          .from('seven_workspaces')
          .select('id, space_id, is_private, is_deleted')
          .eq('id', workspace_id)
          .maybeSingle(),
      ])

      if (!doc || doc.is_deleted) {
        return jsonText({ created: false, error: `Workspace '${workspace_id}' not found.` })
      }
      if (!allowPrivate && (doc.is_private || privateSpaceIds.has(doc.space_id || DEFAULT_SPACE_ID))) {
        return jsonText({ created: false, error: 'Access denied: workspace or its space is private.' })
      }

      const now = Date.now()
      const id = crypto.randomUUID()
      const cardType = type || 'note'

      const dataPayload: Record<string, unknown> = {
        title: title || '',
        color: color || '#fef3c7',
      }

      if (cardType === 'todo') {
        dataPayload.todos = (todos || []).map((text) => ({
          id: crypto.randomUUID(),
          text,
          done: false,
        }))
      } else {
        dataPayload.content = content || ''
      }

      const { error } = await supabase.from('seven_canvas_nodes').insert({
        id,
        workspace_id,
        type: cardType,
        position_x: x ?? 100,
        position_y: y ?? 100,
        width: 280,
        data: dataPayload,
        created_at: now,
        updated_at: now,
        is_deleted: false,
      })

      if (error) throw new Error(`Supabase error creating canvas node: ${error.message}`)

      return jsonText({
        created: true,
        id,
        workspace_id,
        type: cardType,
        updated_at: now,
      })
    }
  )

  // --------------------------------------------------------------------------
  // Tool 9: list_tags_and_collections
  // --------------------------------------------------------------------------
  server.registerTool(
    'list_tags_and_collections',
    {
      title: 'List Tags & Collections',
      description: 'List active tags and document collections in Seven Note, optionally filtered by space_id.',
      inputSchema: {
        space_id: z.string().optional().describe('Optional space ID.'),
      },
    },
    async ({ space_id }) => {
      const privateSpaceIds = await getPrivateSpaceIds()
      if (space_id && privateSpaceIds.has(space_id)) {
        return jsonText({ tags: [], collections: [], error: 'Access denied: space is private.' })
      }

      let tagsQuery = supabase
        .from('seven_tags')
        .select('id, space_id, name, color')
        .eq('is_deleted', false)
      let colsQuery = supabase
        .from('seven_collections')
        .select('id, space_id, name, icon, color, doc_ids, updated_at')
        .eq('is_deleted', false)

      if (space_id) {
        tagsQuery = tagsQuery.eq('space_id', space_id)
        colsQuery = colsQuery.eq('space_id', space_id)
      }

      const [{ data: tags, error: tErr }, { data: collections, error: cErr }] = await Promise.all([
        tagsQuery,
        colsQuery,
      ])

      if (tErr) throw new Error(`Supabase error listing tags: ${tErr.message}`)
      if (cErr) throw new Error(`Supabase error listing collections: ${cErr.message}`)

      return jsonText({
        tags: (tags || []).filter((t: any) => !privateSpaceIds.has(t.space_id)),
        collections: (collections || []).filter((c: any) => !privateSpaceIds.has(c.space_id)),
      })
    }
  )

  // --------------------------------------------------------------------------
  // MCP Resources (quick context endpoints for MCP clients)
  // --------------------------------------------------------------------------
  server.registerResource(
    'spaces',
    'seven-note://spaces',
    {
      title: 'Seven Note Spaces',
      description: 'List of active non-private spaces (including admin-only) in Seven Note.',
      mimeType: 'application/json',
    },
    async () => {
      let query = supabase
        .from('seven_spaces')
        .select('id, name, icon, color, admin_only, folder_order, updated_at')
        .eq('is_deleted', false)
      if (!allowPrivate) {
        query = query.eq('is_private', false)
      }
      const { data } = await query
      return {
        contents: [
          {
            uri: 'seven-note://spaces',
            mimeType: 'application/json',
            text: JSON.stringify(data || [], null, 2),
          },
        ],
      }
    }
  )

  server.registerResource(
    'recent-documents',
    'seven-note://recent-documents',
    {
      title: 'Recent Seven Note Documents',
      description: '20 most recently updated non-private documents in Seven Note.',
      mimeType: 'application/json',
    },
    async () => {
      const privateSpaceIds = await getPrivateSpaceIds()
      let query = supabase
        .from('seven_workspaces')
        .select('id, space_id, folder, title, icon, metadata, updated_at')
        .eq('is_deleted', false)
        .order('updated_at', { ascending: false })
        .limit(60)
      if (!allowPrivate) {
        query = query.eq('is_private', false)
      }
      const { data } = await query
      const filtered = (data || [])
        .filter((d: any) => !privateSpaceIds.has(d.space_id || DEFAULT_SPACE_ID))
        .slice(0, 20)
      return {
        contents: [
          {
            uri: 'seven-note://recent-documents',
            mimeType: 'application/json',
            text: JSON.stringify(
              filtered.map((d: any) => ({
                id: d.id,
                title: d.title,
                space_id: d.space_id,
                folder: d.folder,
                tags: normalizeTags(d.metadata),
                updated_at: d.updated_at,
              })),
              null,
              2
            ),
          },
        ],
      }
    }
  )

  return server
}

// ============================================================================
// Vercel Serverless Handler (Streamable HTTP MCP)
// ============================================================================

function setCorsHeaders(res: any): void {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS')
  res.setHeader(
    'Access-Control-Allow-Headers',
    'Content-Type, Authorization, x-api-key, mcp-session-id, mcp-protocol-version, Last-Event-ID'
  )
  res.setHeader('Access-Control-Expose-Headers', 'mcp-session-id')
  res.setHeader('X-Content-Type-Options', 'nosniff')
  res.setHeader('Cache-Control', 'no-store')
}

export default async function handler(req: any, res: any) {
  setCorsHeaders(res)

  if (req.method === 'OPTIONS') {
    res.status(204).end()
    return
  }

  // Health/discovery info for GET requests (spec-compliant 405 for SSE streams)
  if (req.method === 'GET') {
    const accept = String(req.headers?.accept || '').toLowerCase()
    if (accept.includes('text/event-stream')) {
      res.status(405).json({
        jsonrpc: '2.0',
        error: {
          code: -32000,
          message: 'Method not allowed. This MCP server runs in stateless Streamable HTTP mode (use POST).',
        },
        id: null,
      })
      return
    }
    res.status(200).json({
      ok: true,
      name: SERVER_NAME,
      version: SERVER_VERSION,
      transport: 'streamable-http',
      stateless: true,
      auth: 'Authorization: Bearer <SEVEN_NOTE_MCP_API_KEY> (or x-api-key header)',
    })
    return
  }

  if (req.method === 'DELETE') {
    res.status(405).json({
      jsonrpc: '2.0',
      error: {
        code: -32000,
        message: 'Method not allowed in stateless mode.',
      },
      id: null,
    })
    return
  }

  if (req.method !== 'POST') {
    res.status(405).json({ ok: false, error: 'Method Not Allowed' })
    return
  }

  const auth = isAuthorized(req)
  if (!auth.ok) {
    res.status(auth.status || 401).json({
      jsonrpc: '2.0',
      error: {
        code: -32001,
        message: auth.error,
      },
      id: null,
    })
    return
  }

  let supabase: SupabaseClient
  try {
    supabase = getSupabaseAdmin()
  } catch (err: any) {
    res.status(500).json({
      jsonrpc: '2.0',
      error: {
        code: -32603,
        message: err?.message || 'Supabase server configuration error.',
      },
      id: null,
    })
    return
  }

  const server = createSevenNoteMcpServer(supabase)
  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true,
  })

  res.on('close', () => {
    transport.close().catch(() => {})
    server.close().catch(() => {})
  })

  try {
    await server.connect(transport)
    await transport.handleRequest(req, res, req.body)
  } catch (err: any) {
    if (!res.headersSent) {
      res.status(500).json({
        jsonrpc: '2.0',
        error: {
          code: -32603,
          message: err?.message || 'Internal MCP server error.',
        },
        id: null,
      })
    }
  }
}
