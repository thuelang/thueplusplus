import { describe, expect, it } from 'vitest'
import { renderMarkdown } from './markdown'

describe('markdown', () => {
  it('renders code spans and https links, and escapes raw html', () => {
    const html = renderMarkdown('Print `n!` then see [Factorial](https://rosettacode.org/wiki/Factorial).')
    expect(html).toContain('<code>n!</code>')
    expect(html).toContain('href="https://rosettacode.org/wiki/Factorial"')
    expect(html).not.toContain('<script>')
    const hostile = renderMarkdown('<script>alert(1)</script>\n\n- `a ::= b`')
    expect(hostile).not.toContain('<script>')
    expect(hostile).toContain('&lt;script&gt;')
    expect(hostile).toContain('<code>a ::= b</code>')
    expect(hostile).toContain('<li>')
  })

  it('renders a table of error codes', () => {
    const html = renderMarkdown('| Message | When |\n| --- | --- |\n| `division_by_zero` | `/` by zero. |')
    expect(html).toContain('<table>')
    expect(html).toContain('<td><code>division_by_zero</code></td>')
    expect(html).not.toContain('<td>---</td>')
  })
})
