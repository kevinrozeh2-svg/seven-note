import { toast } from 'sonner'
import { type WorkspaceItem, type CanvasNodeItem, type CanvasEdgeItem } from '../db'

/**
 * Basic HTML to Markdown converter
 */
export function htmlToMarkdown(html: string): string {
  if (!html) return ''
  const div = document.createElement('div')
  div.innerHTML = html

  function convertNode(node: Node): string {
    if (node.nodeType === Node.TEXT_NODE) {
      return node.textContent || ''
    }

    if (node.nodeType !== Node.ELEMENT_NODE) return ''
    const el = node as HTMLElement
    const tag = el.tagName.toLowerCase()

    const childrenText = Array.from(el.childNodes).map(convertNode).join('')

    switch (tag) {
      case 'h1':
        return `\n# ${childrenText}\n\n`
      case 'h2':
        return `\n## ${childrenText}\n\n`
      case 'h3':
        return `\n### ${childrenText}\n\n`
      case 'h4':
        return `\n#### ${childrenText}\n\n`
      case 'p':
        return `\n${childrenText}\n`
      case 'strong':
      case 'b':
        return `**${childrenText}**`
      case 'em':
      case 'i':
        return `*${childrenText}*`
      case 'u':
        return `<u>${childrenText}</u>`
      case 's':
      case 'strike':
        return `~~${childrenText}~~`
      case 'code':
        return el.parentElement?.tagName.toLowerCase() === 'pre'
          ? childrenText
          : `\`${childrenText}\``
      case 'pre':
        return `\n\`\`\`\n${childrenText}\n\`\`\`\n`
      case 'blockquote':
        return `\n> ${childrenText.trim().replace(/\n/g, '\n> ')}\n\n`
      case 'ul':
        return `\n${childrenText}\n`
      case 'ol':
        return `\n${childrenText}\n`
      case 'li': {
        const isTask = el.getAttribute('data-type') === 'taskItem' || el.hasAttribute('data-checked')
        if (isTask) {
          const checked = el.getAttribute('data-checked') === 'true'
          return `- [${checked ? 'x' : ' '}] ${childrenText.trim()}\n`
        }
        return `- ${childrenText.trim()}\n`
      }
      case 'hr':
        return '\n---\n\n'
      case 'br':
        return '\n'
      case 'a': {
        const href = el.getAttribute('href') || ''
        return `[${childrenText}](${href})`
      }
      case 'img': {
        const src = el.getAttribute('src') || ''
        const alt = el.getAttribute('alt') || 'image'
        return `![${alt}](${src})\n`
      }
      case 'table':
        return `\n${childrenText}\n`
      case 'tr':
        return `| ${childrenText} |\n`
      case 'th':
      case 'td':
        return `${childrenText} |`
      default:
        return childrenText
    }
  }

  return convertNode(div).trim().replace(/\n{3,}/g, '\n\n')
}

/**
 * Download a string payload as a file
 */
export function triggerDownload(content: string, filename: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

/**
 * Export Document as Markdown
 */
export function exportDocumentAsMarkdown(workspace: WorkspaceItem) {
  try {
    const md = htmlToMarkdown(workspace.docContent || '')
    const fullContent = `# ${workspace.title || 'Untitled'}\n\n${md}`
    const safeName = (workspace.title || 'Untitled').replace(/[/\\?%*:|"<>]/g, '_')
    triggerDownload(fullContent, `${safeName}.md`, 'text/markdown;charset=utf-8')
    toast.success('Documento exportado como Markdown')
  } catch (err) {
    console.error(err)
    toast.error('Error al exportar documento')
  }
}

/**
 * Export Document as HTML
 */
export function exportDocumentAsHtml(workspace: WorkspaceItem) {
  try {
    const safeTitle = workspace.title || 'Untitled'
    const htmlTemplate = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <title>${safeTitle} - Seven Note</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      line-height: 1.6;
      color: #1a1a1a;
      max-width: 800px;
      margin: 40px auto;
      padding: 0 24px;
      background: #fafafa;
    }
    .doc-container {
      background: #ffffff;
      padding: 48px;
      border-radius: 16px;
      box-shadow: 0 4px 20px rgba(0,0,0,0.06);
    }
    h1, h2, h3 { color: #111; margin-top: 1.5em; }
    h1 { font-size: 2.2em; border-bottom: 1px solid #eee; padding-bottom: 0.3em; }
    blockquote { border-left: 4px solid #1e96eb; margin: 0; padding-left: 16px; color: #555; }
    code { background: #f3f4f6; padding: 2px 6px; border-radius: 4px; font-family: monospace; font-size: 0.9em; }
    pre { background: #1e1e24; color: #f8f8f2; padding: 16px; border-radius: 8px; overflow-x: auto; }
    table { width: 100%; border-collapse: collapse; margin: 16px 0; }
    th, td { border: 1px solid #ddd; padding: 8px 12px; }
    th { background: #f9fafb; font-weight: 600; }
    ul[data-type="taskList"] { list-style: none; padding-left: 0; }
    ul[data-type="taskList"] li { display: flex; align-items: center; gap: 8px; margin-bottom: 6px; }
  </style>
</head>
<body>
  <div class="doc-container">
    <h1>${safeTitle}</h1>
    ${workspace.docContent || '<p>Documento vacío</p>'}
  </div>
</body>
</html>`

    const safeName = safeTitle.replace(/[/\\?%*:|"<>]/g, '_')
    triggerDownload(htmlTemplate, `${safeName}.html`, 'text/html;charset=utf-8')
    toast.success('Documento exportado como HTML')
  } catch (err) {
    console.error(err)
    toast.error('Error al exportar documento')
  }
}

/**
 * Export Document & Canvas data as JSON Backup
 */
export function exportDocumentAsJson(
  workspace: WorkspaceItem,
  nodes: CanvasNodeItem[] = [],
  edges: CanvasEdgeItem[] = []
) {
  try {
    const payload = {
      app: 'Seven Note',
      version: '1.0.0',
      exportedAt: new Date().toISOString(),
      workspace,
      canvas: {
        nodes,
        edges
      }
    }
    const safeName = (workspace.title || 'Untitled').replace(/[/\\?%*:|"<>]/g, '_')
    triggerDownload(JSON.stringify(payload, null, 2), `${safeName}.sevennote.json`, 'application/json;charset=utf-8')
    toast.success('Copia de seguridad JSON descargada')
  } catch (err) {
    console.error(err)
    toast.error('Error al exportar JSON')
  }
}

/**
 * Copy document content as clean plain text
 */
export function copyAsPlainText(html: string) {
  const div = document.createElement('div')
  div.innerHTML = html
  const text = div.textContent || div.innerText || ''
  navigator.clipboard.writeText(text.trim())
  toast.success('Texto plano copiado al portapapeles')
}
