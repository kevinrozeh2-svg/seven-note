import { useState, useEffect, useRef, useCallback } from 'react'
import {
  SearchIcon,
  ToggleDownIcon,
  CloseIcon
} from '@blocksuite/icons/rc'

interface FindInPageProps {
  isOpen: boolean
  onClose: () => void
}

export function FindInPage({ isOpen, onClose }: FindInPageProps) {
  const [searchTerm, setSearchTerm] = useState('')
  const [currentMatch, setCurrentMatch] = useState(0)
  const [totalMatches, setTotalMatches] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)

  // Clear highlighted spans
  const clearHighlights = useCallback(() => {
    const editorEl = document.querySelector('.ProseMirror')
    if (!editorEl) return
    const highlights = editorEl.querySelectorAll('mark.find-highlight')
    highlights.forEach((mark) => {
      const parent = mark.parentNode
      if (parent) {
        parent.replaceChild(document.createTextNode(mark.textContent || ''), mark)
        parent.normalize()
      }
    })
  }, [])

  // Highlight matches in editor
  const performSearch = useCallback(
    (term: string) => {
      clearHighlights()
      if (!term.trim()) {
        setTotalMatches(0)
        setCurrentMatch(0)
        return
      }

      const editorEl = document.querySelector('.ProseMirror')
      if (!editorEl) return

      const regex = new RegExp(term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi')
      const walker = document.createTreeWalker(editorEl, NodeFilter.SHOW_TEXT, null)
      const textNodes: Text[] = []

      let node
      while ((node = walker.nextNode())) {
        if (node.nodeValue && regex.test(node.nodeValue)) {
          textNodes.push(node as Text)
        }
      }

      let count = 0
      textNodes.forEach((textNode) => {
        const text = textNode.nodeValue || ''
        const parent = textNode.parentNode
        if (!parent || parent.nodeName === 'MARK') return

        const fragment = document.createDocumentFragment()
        let lastIdx = 0
        let match

        regex.lastIndex = 0
        while ((match = regex.exec(text)) !== null) {
          const matchedText = match[0]
          const matchIdx = match.index

          // Text before match
          if (matchIdx > lastIdx) {
            fragment.appendChild(document.createTextNode(text.substring(lastIdx, matchIdx)))
          }

          // Matched span
          const mark = document.createElement('mark')
          mark.className = 'find-highlight bg-amber-400/40 text-inherit rounded px-0.5 transition'
          mark.setAttribute('data-find-index', String(count))
          mark.textContent = matchedText
          fragment.appendChild(mark)

          count++
          lastIdx = matchIdx + matchedText.length
        }

        // Remaining text
        if (lastIdx < text.length) {
          fragment.appendChild(document.createTextNode(text.substring(lastIdx)))
        }

        parent.replaceChild(fragment, textNode)
      })

      setTotalMatches(count)
      if (count > 0) {
        setCurrentMatch(1)
        scrollToMatch(0)
      } else {
        setCurrentMatch(0)
      }
    },
    [clearHighlights]
  )

  const scrollToMatch = (index: number) => {
    const editorEl = document.querySelector('.ProseMirror')
    if (!editorEl) return
    const marks = editorEl.querySelectorAll('mark.find-highlight')

    marks.forEach((m, idx) => {
      if (idx === index) {
        m.classList.add('bg-amber-400', 'text-black', 'font-bold')
        m.classList.remove('bg-amber-400/40')
        m.scrollIntoView({ behavior: 'smooth', block: 'center' })
      } else {
        m.classList.remove('bg-amber-400', 'text-black', 'font-bold')
        m.classList.add('bg-amber-400/40')
      }
    })
  }

  const handleNext = () => {
    if (totalMatches === 0) return
    const next = currentMatch >= totalMatches ? 1 : currentMatch + 1
    setCurrentMatch(next)
    scrollToMatch(next - 1)
  }

  const handlePrev = () => {
    if (totalMatches === 0) return
    const prev = currentMatch <= 1 ? totalMatches : currentMatch - 1
    setCurrentMatch(prev)
    scrollToMatch(prev - 1)
  }

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 50)
    } else {
      clearHighlights()
      setSearchTerm('')
      setTotalMatches(0)
      setCurrentMatch(0)
    }
  }, [isOpen, clearHighlights])

  useEffect(() => {
    performSearch(searchTerm)
  }, [searchTerm, performSearch])

  // Global keydown for Escape and Enter in search
  useEffect(() => {
    if (!isOpen) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose()
      } else if (e.key === 'Enter') {
        e.preventDefault()
        if (e.shiftKey) {
          handlePrev()
        } else {
          handleNext()
        }
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, currentMatch, totalMatches])

  if (!isOpen) return null

  return (
    <div className="absolute top-3 right-5 z-40 flex items-center gap-1.5 bg-[var(--affine-background-overlay-panel-color)] border border-[var(--affine-border-color)] shadow-[var(--affine-menu-shadow)] px-3 py-1.5 rounded-xl text-xs text-[var(--affine-text-primary-color)] animate-in fade-in slide-in-from-top-2 duration-150 select-none">
      <SearchIcon className="w-3.5 h-3.5 text-[var(--affine-text-secondary-color)] shrink-0" />

      <input
        ref={inputRef}
        type="text"
        placeholder="Buscar en página..."
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
        className="w-40 bg-transparent outline-none text-xs text-[var(--affine-text-primary-color)] placeholder:text-[var(--affine-placeholder-color)]"
      />

      {searchTerm && (
        <span className="text-[11px] font-mono text-[var(--affine-text-secondary-color)] px-1 shrink-0">
          {totalMatches > 0 ? `${currentMatch}/${totalMatches}` : 'Sin coincidencias'}
        </span>
      )}

      {/* Up/Down Match Navigation */}
      <div className="flex items-center gap-0.5 border-l border-[var(--affine-divider-color)] pl-1.5 ml-1">
        <button
          onClick={handlePrev}
          disabled={totalMatches === 0}
          className="p-1 rounded hover:bg-[var(--affine-hover-color)] disabled:opacity-30 text-[var(--affine-icon-color)] hover:text-[var(--affine-text-primary-color)] transition rotate-180"
          title="Anterior coincidencia (Shift+Enter)"
        >
          <ToggleDownIcon className="w-3 h-3" />
        </button>

        <button
          onClick={handleNext}
          disabled={totalMatches === 0}
          className="p-1 rounded hover:bg-[var(--affine-hover-color)] disabled:opacity-30 text-[var(--affine-icon-color)] hover:text-[var(--affine-text-primary-color)] transition"
          title="Siguiente coincidencia (Enter)"
        >
          <ToggleDownIcon className="w-3 h-3" />
        </button>
      </div>

      {/* Close button */}
      <button
        onClick={onClose}
        className="p-1 rounded-md hover:bg-[var(--affine-hover-color)] text-[var(--affine-text-secondary-color)] hover:text-[var(--affine-text-primary-color)] transition ml-1"
        title="Cerrar búsqueda (Esc)"
      >
        <CloseIcon className="w-3.5 h-3.5" />
      </button>
    </div>
  )
}
