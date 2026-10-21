import { describe, expect, it } from 'vitest'
import { logicalTarget } from './hashTarget'

describe('hash target', () => {
  it('highlights a heading section, a row, or a list item', () => {
    document.body.innerHTML = `
      <section id="cost"><h2 id="cost-heading">Cost</h2></section>
      <table><tr id="row"><td id="cell">1</td></tr></table>
      <ul><li id="lisp"><h2 id="factorial">Factorial</h2></li></ul>
    `
    const heading = document.getElementById('cost-heading')
    const cell = document.getElementById('cell')
    const row = document.getElementById('row')
    const item = document.getElementById('lisp')
    const nested = document.getElementById('factorial')
    expect(heading).toBeTruthy()
    expect(cell && row && item && nested).toBeTruthy()
    expect(logicalTarget(heading as HTMLElement).id).toBe('cost')
    expect(logicalTarget(cell as HTMLElement).id).toBe('row')
    expect(logicalTarget(row as HTMLElement).tagName).toBe('TR')
    expect(logicalTarget(item as HTMLElement).tagName).toBe('LI')
    expect(logicalTarget(nested as HTMLElement).id).toBe('lisp')
  })
})