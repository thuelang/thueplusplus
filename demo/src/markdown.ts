function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, char => {
    if (char === '&') return '&amp;'
    if (char === '<') return '&lt;'
    if (char === '>') return '&gt;'
    if (char === '"') return '&quot;'
    return '&#39;'
  })
}

function inline(value: string): string {
  const escaped = escapeHtml(value)
  return escaped
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" rel="noreferrer">$1</a>')
}

export function headingId(text: string): string {
  const id = text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
  if (id.length === 0) throw new Error(`heading has no id: ${text}`)
  return id
}

function tableCells(line: string): string[] {
  return line.split('|').slice(1, -1).map(cell => cell.trim())
}

function renderTable(lines: string[]): string {
  const header = tableCells(lines[0])
  const body = lines.slice(1).filter(line => !tableCells(line).every(cell => /^:?-+:?$/.test(cell)))
  const head = `<tr>${header.map(cell => `<th>${inline(cell)}</th>`).join('')}</tr>`
  const rows = body.map(line => `<tr>${tableCells(line).map(cell => `<td>${inline(cell)}</td>`).join('')}</tr>`).join('')
  return `<table><thead>${head}</thead><tbody>${rows}</tbody></table>`
}

function renderBlock(block: string): string {
  const lines = block.split('\n')
  const heading = lines.length === 1 ? lines[0].match(/^(#{1,3}) (.+)$/) : null
  if (heading) {
    const level = heading[1].length
    const text = heading[2]
    return `<h${level} id="${headingId(text)}">${inline(text)}</h${level}>`
  }
  if (lines.length >= 2 && lines.every(line => line.startsWith('|') && line.endsWith('|'))) {
    return renderTable(lines)
  }
  if (lines.every(line => line.startsWith('- '))) {
    const items = lines.map(line => `<li>${inline(line.slice(2))}</li>`).join('')
    return `<ul>${items}</ul>`
  }
  if (block.startsWith('```')) {
    const code = block.replace(/^```[^\n]*\n?/, '').replace(/\n?```$/, '')
    return `<pre><code>${escapeHtml(code)}</code></pre>`
  }
  return `<p>${inline(lines.join(' '))}</p>`
}

export function renderMarkdown(source: string): string {
  const body = source.trim()
  if (body.length === 0) return ''
  return body.split(/\n\n+/).map(block => renderBlock(block.trim())).join('')
}
