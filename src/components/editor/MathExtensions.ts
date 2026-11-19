import { Node, mergeAttributes } from '@tiptap/core'
import { renderLatexToHtml } from '../../lib/mathUtils'

export const MathBlock = Node.create({
  name: 'mathBlock',
  group: 'block',
  atom: true,
  selectable: true,
  draggable: true,

  addAttributes() {
    return {
      latex: {
        default: '',
        parseHTML: (element) => element.getAttribute('data-latex') || element.textContent?.trim() || '',
        renderHTML: (attributes) => ({
          'data-latex': attributes.latex || ''
        })
      }
    }
  },

  parseHTML() {
    return [
      {
        tag: 'div[data-type="math-block"]'
      }
    ]
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'div',
      mergeAttributes(HTMLAttributes, {
        'data-type': 'math-block',
        class: 'seven-math-block',
        contenteditable: 'false'
      })
    ]
  },

  addNodeView() {
    return ({ node, editor, getPos }) => {
      const dom = document.createElement('div')
      dom.setAttribute('data-type', 'math-block')
      dom.setAttribute('data-latex', node.attrs.latex || '')
      dom.className = 'seven-math-block'
      dom.contentEditable = 'false'

      const renderFormula = (latex: string) => {
        dom.innerHTML = renderLatexToHtml(latex, true)
      }

      renderFormula(node.attrs.latex || '')

      // Allow double-clicking to edit the LaTeX formula directly
      dom.title = 'Doble clic para editar fórmula LaTeX'
      dom.addEventListener('dblclick', (e) => {
        e.preventDefault()
        e.stopPropagation()
        if (!editor.isEditable) return
        const currentLatex = dom.getAttribute('data-latex') || ''
        const updated = window.prompt('Editar fórmula LaTeX:', currentLatex)
        if (updated !== null && updated.trim() && typeof getPos === 'function') {
          const pos = getPos()
          if (typeof pos === 'number') {
            editor
              .chain()
              .focus()
              .command(({ tr }) => {
                tr.setNodeMarkup(pos, undefined, { latex: updated.trim() })
                return true
              })
              .run()
          }
        }
      })

      return {
        dom,
        update(updatedNode) {
          if (updatedNode.type.name !== 'mathBlock') return false
          const nextLatex = updatedNode.attrs.latex || ''
          if (nextLatex !== dom.getAttribute('data-latex')) {
            dom.setAttribute('data-latex', nextLatex)
            renderFormula(nextLatex)
          }
          return true
        }
      }
    }
  }
})

export const MathInline = Node.create({
  name: 'mathInline',
  group: 'inline',
  inline: true,
  atom: true,
  selectable: true,

  addAttributes() {
    return {
      latex: {
        default: '',
        parseHTML: (element) => element.getAttribute('data-latex') || element.textContent?.trim() || '',
        renderHTML: (attributes) => ({
          'data-latex': attributes.latex || ''
        })
      }
    }
  },

  parseHTML() {
    return [
      {
        tag: 'span[data-type="math-inline"]'
      }
    ]
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'span',
      mergeAttributes(HTMLAttributes, {
        'data-type': 'math-inline',
        class: 'seven-math-inline',
        contenteditable: 'false'
      })
    ]
  },

  addNodeView() {
    return ({ node, editor, getPos }) => {
      const dom = document.createElement('span')
      dom.setAttribute('data-type', 'math-inline')
      dom.setAttribute('data-latex', node.attrs.latex || '')
      dom.className = 'seven-math-inline'
      dom.contentEditable = 'false'

      const renderFormula = (latex: string) => {
        dom.innerHTML = renderLatexToHtml(latex, false)
      }

      renderFormula(node.attrs.latex || '')

      dom.title = 'Doble clic para editar fórmula LaTeX'
      dom.addEventListener('dblclick', (e) => {
        e.preventDefault()
        e.stopPropagation()
        if (!editor.isEditable) return
        const currentLatex = dom.getAttribute('data-latex') || ''
        const updated = window.prompt('Editar fórmula LaTeX:', currentLatex)
        if (updated !== null && updated.trim() && typeof getPos === 'function') {
          const pos = getPos()
          if (typeof pos === 'number') {
            editor
              .chain()
              .focus()
              .command(({ tr }) => {
                tr.setNodeMarkup(pos, undefined, { latex: updated.trim() })
                return true
              })
              .run()
          }
        }
      })

      return {
        dom,
        update(updatedNode) {
          if (updatedNode.type.name !== 'mathInline') return false
          const nextLatex = updatedNode.attrs.latex || ''
          if (nextLatex !== dom.getAttribute('data-latex')) {
            dom.setAttribute('data-latex', nextLatex)
            renderFormula(nextLatex)
          }
          return true
        }
      }
    }
  }
})
