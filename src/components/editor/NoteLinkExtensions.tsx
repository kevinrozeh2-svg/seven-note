import React, { createContext, useContext } from 'react'
import { Node, mergeAttributes } from '@tiptap/core'
import { ReactNodeViewRenderer, NodeViewWrapper, type NodeViewProps } from '@tiptap/react'
import { ArrowUpRight, Trash2, AlertCircle } from 'lucide-react'
import { DEFAULT_SPACE_ID, type SpaceItem, type WorkspaceItem } from '../../db'
import { AppleEmoji, renderWithAppleEmoji } from '../ui/AppleEmoji'
import { extractSnippetFromHtml } from '../../lib/bidirectionalLinks'

export interface NoteLinkContextValue {
  allWorkspaces: WorkspaceItem[]
  spaces: SpaceItem[]
  onSelectWorkspace?: (id: string) => void
  readOnly?: boolean
}

export const NoteLinkContext = createContext<NoteLinkContextValue>({
  allWorkspaces: [],
  spaces: [],
  onSelectWorkspace: undefined,
  readOnly: false
})

function safeDecode(value: string | null | undefined): string {
  if (!value) return ''
  try {
    return decodeURIComponent(value)
  } catch {
    return value
  }
}

function extractNoteIdFromElement(element: HTMLElement): string {
  const direct = element.getAttribute('data-note-id')
  if (direct) return safeDecode(direct.trim())
  const href = element.getAttribute('href') || element.querySelector('a[href^="#note="]')?.getAttribute('href')
  if (href?.startsWith('#note=')) {
    return safeDecode(href.slice('#note='.length).split('&')[0].trim())
  }
  return ''
}

function extractFallbackTitleFromElement(element: HTMLElement): string {
  const explicit = element.getAttribute('data-note-title')
  if (explicit && explicit.trim()) return explicit.trim()
  const text = (element.textContent || '').replace(/Abrir\s*↗/gi, '').trim()
  return text.slice(0, 120) || 'Nota vinculada'
}

// ============================================================================
// 1. Block NodeView: NoteLinkCard (Rich interactive linked-note preview card)
// ============================================================================
const NoteLinkCardView: React.FC<NodeViewProps> = ({ node, selected, deleteNode }) => {
  const { allWorkspaces, spaces, onSelectWorkspace, readOnly } = useContext(NoteLinkContext)
  const noteId = String(node.attrs.noteId || '')
  const fallbackTitle = String(node.attrs.noteTitle || 'Nota vinculada')

  const targetNote = allWorkspaces.find((w) => w.id === noteId && !w.isDeleted)
  const targetSpace = targetNote
    ? spaces.find((s) => s.id === (targetNote.spaceId || DEFAULT_SPACE_ID))
    : undefined

  const title = targetNote?.title || fallbackTitle
  const icon = targetNote?.icon || '📄'
  const spaceName = targetSpace?.name || 'Espacio General'
  const spaceIcon = targetSpace?.icon || '🌐'
  const snippet = targetNote
    ? targetNote.informationContent?.trim() ||
      extractSnippetFromHtml(targetNote.docContent, 95) ||
      'Página conectada mediante enlace bidireccional'
    : 'Esta nota fue eliminada o pertenece a un espacio privado.'
  const updatedTimestamp = targetNote?.updatedAt || targetNote?.createdAt
  const updatedDate = updatedTimestamp
    ? new Date(updatedTimestamp).toLocaleDateString('es-ES', {
        day: 'numeric',
        month: 'short'
      })
    : null

  const handleOpen = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (targetNote && onSelectWorkspace) {
      onSelectWorkspace(targetNote.id)
    }
  }

  const handleDelete = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    deleteNode()
  }

  return (
    <NodeViewWrapper
      as="div"
      className="my-2.5 not-prose select-none"
      data-type="note-link-card"
      data-note-id={noteId}
      contentEditable={false}
    >
      <div
        role="button"
        tabIndex={0}
        data-note-id={targetNote ? targetNote.id : undefined}
        onClick={handleOpen}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            if (targetNote && onSelectWorkspace) onSelectWorkspace(targetNote.id)
          }
        }}
        className={`group relative flex items-center justify-between gap-3 p-3 rounded-xl border transition-all max-w-xl ${
          selected
            ? 'border-[var(--app-accent)] ring-2 ring-[var(--app-accent)]/20 bg-[var(--app-bg-secondary)]'
            : 'border-[var(--app-border-strong)] bg-[var(--app-bg-secondary)] hover:border-[var(--app-accent)]/60 hover:bg-[var(--app-hover-filled)]'
        } ${targetNote ? 'cursor-pointer' : 'opacity-70 cursor-default'}`}
        style={{ boxShadow: 'var(--app-shadow-card)' }}
      >
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <div className="w-9 h-9 rounded-lg bg-[var(--app-bg-primary)] border border-[var(--app-border)] flex items-center justify-center shrink-0 transition-transform group-hover:scale-105">
            {targetNote ? (
              <AppleEmoji emoji={icon} size={20} />
            ) : (
              <AlertCircle className="w-4 h-4 text-[var(--app-text-muted)]" />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="font-semibold text-[13px] text-[var(--app-text-primary)] group-hover:text-[var(--app-accent)] transition-colors truncate">
                {renderWithAppleEmoji(title)}
              </span>
              {targetNote && (
                <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full bg-[var(--app-accent-soft)] text-[var(--app-accent)] font-medium shrink-0">
                  <span>{spaceIcon}</span>
                  <span>{spaceName}</span>
                </span>
              )}
            </div>
            <p className="text-[11px] text-[var(--app-text-secondary)] truncate mt-0.5 leading-snug">
              {snippet}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {updatedDate && (
            <span className="text-[10px] text-[var(--app-text-muted)] hidden sm:inline">
              {updatedDate}
            </span>
          )}
          {targetNote && (
            <span className="inline-flex items-center gap-1 text-[11px] font-medium text-[var(--app-accent)] px-2.5 py-1 rounded-lg bg-[var(--app-accent-soft)] group-hover:bg-[var(--app-accent)] group-hover:text-white transition-all">
              <span>Abrir</span>
              <ArrowUpRight className="w-3 h-3" />
            </span>
          )}
          {!readOnly && (
            <button
              type="button"
              onClick={handleDelete}
              title="Quitar enlace"
              aria-label="Quitar enlace"
              className="p-1.5 rounded-lg text-[var(--app-text-muted)] hover:text-red-500 hover:bg-red-500/10 opacity-0 group-hover:opacity-100 focus:opacity-100 transition-all cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>
    </NodeViewWrapper>
  )
}

export const NoteLinkCard = Node.create({
  name: 'noteLinkCard',
  group: 'block',
  atom: true,
  selectable: true,
  draggable: true,

  addAttributes() {
    return {
      noteId: {
        default: '',
        parseHTML: (element) => extractNoteIdFromElement(element as HTMLElement),
        renderHTML: (attributes) => ({
          'data-note-id': encodeURIComponent(String(attributes.noteId || ''))
        })
      },
      noteTitle: {
        default: '',
        parseHTML: (element) => extractFallbackTitleFromElement(element as HTMLElement),
        renderHTML: (attributes) => ({
          'data-note-title': String(attributes.noteTitle || '')
        })
      }
    }
  },

  parseHTML() {
    return [
      { tag: 'div[data-type="note-link-card"]' },
      { tag: 'div.seven-note-link-card[data-note-id]' },
      { tag: 'div.affine-embed-doc[data-note-id]' }
    ]
  },

  renderHTML({ HTMLAttributes, node }) {
    const encodedId = encodeURIComponent(String(node.attrs.noteId || ''))
    const fallbackTitle = String(node.attrs.noteTitle || 'Nota vinculada')
    return [
      'div',
      mergeAttributes(HTMLAttributes, {
        'data-type': 'note-link-card',
        'data-note-id': encodedId,
        'data-note-title': fallbackTitle,
        class: 'seven-note-link-card',
        contenteditable: 'false'
      }),
      [
        'a',
        {
          href: `#note=${encodedId}`,
          class: 'seven-note-link-fallback'
        },
        fallbackTitle
      ]
    ]
  },

  addNodeView() {
    return ReactNodeViewRenderer(NoteLinkCardView)
  }
})

// ============================================================================
// 2. Inline NodeView: NoteMention (Obsidian-style [[wikilink]] inline chip)
// ============================================================================
const NoteMentionView: React.FC<NodeViewProps> = ({ node, selected }) => {
  const { allWorkspaces, onSelectWorkspace } = useContext(NoteLinkContext)
  const noteId = String(node.attrs.noteId || '')
  const fallbackTitle = String(node.attrs.noteTitle || 'Nota')

  const targetNote = allWorkspaces.find((w) => w.id === noteId && !w.isDeleted)
  const title = targetNote?.title || fallbackTitle
  const icon = targetNote?.icon || '📄'

  const handleOpen = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (targetNote && onSelectWorkspace) {
      onSelectWorkspace(targetNote.id)
    }
  }

  return (
    <NodeViewWrapper
      as="span"
      className="inline-flex align-baseline mx-0.5 not-prose"
      data-type="note-mention"
      data-note-id={noteId}
      contentEditable={false}
    >
      <a
        href={`#note=${encodeURIComponent(noteId)}`}
        data-note-id={targetNote ? targetNote.id : undefined}
        onClick={handleOpen}
        className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[13px] font-medium leading-tight no-underline transition-all select-none border ${
          targetNote
            ? selected
              ? 'bg-[var(--app-accent)] text-white border-[var(--app-accent)]'
              : 'bg-[var(--app-accent-soft)] text-[var(--app-accent)] border-[var(--app-accent)]/25 hover:bg-[var(--app-accent)]/20 hover:border-[var(--app-accent)]/50 cursor-pointer'
            : 'bg-[var(--app-bg-tertiary)] text-[var(--app-text-muted)] border-[var(--app-border)] line-through cursor-default'
        }`}
      >
        <span className="inline-flex items-center shrink-0">
          <AppleEmoji emoji={icon} size={13} />
        </span>
        <span className="max-w-[240px] truncate">{renderWithAppleEmoji(title)}</span>
      </a>
    </NodeViewWrapper>
  )
}

export const NoteMention = Node.create({
  name: 'noteMention',
  group: 'inline',
  inline: true,
  atom: true,
  selectable: true,

  addAttributes() {
    return {
      noteId: {
        default: '',
        parseHTML: (element) => extractNoteIdFromElement(element as HTMLElement),
        renderHTML: (attributes) => ({
          'data-note-id': encodeURIComponent(String(attributes.noteId || ''))
        })
      },
      noteTitle: {
        default: '',
        parseHTML: (element) => extractFallbackTitleFromElement(element as HTMLElement),
        renderHTML: (attributes) => ({
          'data-note-title': String(attributes.noteTitle || '')
        })
      }
    }
  },

  parseHTML() {
    return [
      { tag: 'a[data-type="note-mention"]' },
      { tag: 'span[data-type="note-mention"]' }
    ]
  },

  renderHTML({ HTMLAttributes, node }) {
    const encodedId = encodeURIComponent(String(node.attrs.noteId || ''))
    const fallbackTitle = String(node.attrs.noteTitle || 'Nota')
    return [
      'a',
      mergeAttributes(HTMLAttributes, {
        'data-type': 'note-mention',
        'data-note-id': encodedId,
        'data-note-title': fallbackTitle,
        href: `#note=${encodedId}`,
        class: 'seven-note-mention'
      }),
      fallbackTitle
    ]
  },

  addNodeView() {
    return ReactNodeViewRenderer(NoteMentionView)
  }
})
