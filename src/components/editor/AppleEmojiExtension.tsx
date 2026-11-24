import { Node, mergeAttributes } from '@tiptap/core'
import {
  EMOJI_MATCH_REGEX,
  getAppleEmojiUrl,
  isEmojiImageElement,
  extractEmojiFromImageElement
} from '../ui/AppleEmoji'

let isConvertingEmojis = false

function replaceTextEmojisWithNodes(doc: any, schema: any, tr: any): boolean {
  const appleEmojiType = schema.nodes.appleEmoji
  if (!appleEmojiType) return false

  const replacements: Array<{ from: number; to: number; emoji: string }> = []

  doc.descendants((node: any, pos: number) => {
    if (node.type.name === 'codeBlock') {
      return false
    }
    if (node.isText && node.text) {
      if (node.marks.some((m: any) => m.type.name === 'code')) {
        return
      }
      EMOJI_MATCH_REGEX.lastIndex = 0
      let match: RegExpExecArray | null
      while ((match = EMOJI_MATCH_REGEX.exec(node.text)) !== null) {
        replacements.push({
          from: pos + match.index,
          to: pos + match.index + match[0].length,
          emoji: match[0]
        })
      }
    }
  })

  if (replacements.length === 0) return false

  for (let i = replacements.length - 1; i >= 0; i--) {
    const { from, to, emoji } = replacements[i]
    const emojiNode = appleEmojiType.create({ emoji })
    tr.replaceWith(from, to, emojiNode)
  }

  return true
}

function convertEditorEmojis(editor: any) {
  if (!editor || editor.isDestroyed || isConvertingEmojis) return
  try {
    const { state, view } = editor
    if (!view || view.composing) return
    const tr = state.tr
    if (replaceTextEmojisWithNodes(state.doc, state.schema, tr)) {
      isConvertingEmojis = true
      try {
        tr.setMeta('addToHistory', false)
        view.dispatch(tr)
      } finally {
        isConvertingEmojis = false
      }
    }
  } catch {
    isConvertingEmojis = false
  }
}

function createEmojiDom(emoji: string): HTMLElement {
  const wrapper = document.createElement('span')
  wrapper.setAttribute('data-apple-emoji', emoji)
  wrapper.className = 'inline-flex items-center justify-center align-middle select-none mx-[0.04em]'
  wrapper.style.lineHeight = '1'
  wrapper.contentEditable = 'false'

  const renderFallback = () => {
    wrapper.textContent = emoji
    wrapper.style.fontFamily =
      '"Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", "Segoe UI Symbol", emoji, sans-serif'
  }

  if (!emoji || (typeof navigator !== 'undefined' && !navigator.onLine)) {
    renderFallback()
    return wrapper
  }

  const img = document.createElement('img')
  img.src = getAppleEmojiUrl(emoji)
  img.alt = emoji
  img.setAttribute('data-apple-emoji', emoji)
  img.draggable = false
  img.className = 'apple-emoji-img inline-block w-[1.15em] h-[1.15em] object-contain pointer-events-none select-none'
  img.style.verticalAlign = '-0.15em'
  img.style.display = 'inline-block'
  img.style.width = '1.15em'
  img.style.height = '1.15em'
  img.style.margin = '0'
  img.style.borderRadius = '0'
  img.style.boxShadow = 'none'

  let triedFallback = false
  img.onerror = () => {
    if (!triedFallback) {
      triedFallback = true
      const altUrl = getAppleEmojiUrl(emoji, 'without-fe0f')
      if (altUrl !== img.src) {
        img.src = altUrl
        return
      }
    }
    img.remove()
    renderFallback()
  }

  wrapper.appendChild(img)
  return wrapper
}

export const AppleEmojiExtension = Node.create({
  name: 'appleEmoji',
  priority: 1000,
  inline: true,
  group: 'inline',
  atom: true,
  selectable: true,
  draggable: false,

  addAttributes() {
    return {
      emoji: {
        default: '',
        parseHTML: (element) => extractEmojiFromImageElement(element),
        renderHTML: (attributes) => ({
          'data-apple-emoji': attributes.emoji,
          alt: attributes.emoji,
          src: getAppleEmojiUrl(attributes.emoji || '')
        })
      }
    }
  },

  parseHTML() {
    return [
      { tag: 'img[data-apple-emoji]' },
      { tag: 'span[data-apple-emoji]' },
      {
        tag: 'img[src]',
        getAttrs: (el) => {
          if (!(el instanceof HTMLElement)) return false
          return isEmojiImageElement(el) ? {} : false
        }
      }
    ]
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'img',
      mergeAttributes(HTMLAttributes, {
        draggable: 'false',
        class: 'apple-emoji-img inline-block align-[-0.15em] w-[1.15em] h-[1.15em] select-none mx-[0.04em]'
      })
    ]
  },

  renderText({ node }) {
    return (node.attrs.emoji as string) || ''
  },

  addNodeView() {
    return ({ node }) => {
      const emoji = (node.attrs.emoji as string) || ''
      const dom = createEmojiDom(emoji)
      return { dom }
    }
  },

  onCreate() {
    setTimeout(() => convertEditorEmojis(this.editor), 0)
  },

  onUpdate() {
    convertEditorEmojis(this.editor)
  }
})
