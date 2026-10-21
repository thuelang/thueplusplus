import { describe, expect, it } from 'vitest'
import { catalog } from '@/catalog'
import { formatCost, solutionLink, type ChartLink } from './cost'
import { problemSeries, sandboxCostSeries } from './series'
import { tooltipHtml } from './tooltip'

const measuredSha = `abc1234${'0'.repeat(33)}`

function solution(fields: Partial<ChartLink> & { cost?: number } = {}): ChartLink {
  return solutionLink({
    problemId: 'factorial',
    problem: 'Factorial',
    label: 'Lisp',
    title: 'While loop from stdin',
    cost: 15456012,
    time: Date.parse('2026-10-17T13:58:55Z'),
    sha: measuredSha,
    author: 'Cursor Agent <cursoragent@cursor.com>',
    solutionPath: 'problems/factorial/solutions/lisp/2026-10-17_13-58-55/while-loop-from-stdin.lisp',
    ...fields,
  })
}

describe('chart tooltip', () => {
  it('formats a solution point tooltip', () => {
    const link = solution()
    const html = tooltipHtml('Lisp', { time: link.time, cost: link.cost, link })
    expect(html).toContain('<p class="cost-tip-title">Lisp: While loop from stdin</p>')
    expect(html).toContain('Cost 15.5M, Oct 17, 2026')
    expect(html).toContain('by Cursor Agent')
    expect(html).toContain(`<a href="${link.blobUrl}">View solution</a>`)
    expect(html).toContain(`<a href="${link.commitUrl}">View commit ${measuredSha.slice(0, 7)}</a>`)
    expect(html).not.toContain('Factorial')
    expect(html).not.toContain('cursoragent@cursor.com')
    expect(html).not.toContain('&lt;')
    expect(html.match(/15\.5M/g)).toEqual(['15.5M'])
    expect(html.match(/Oct 17, 2026/g)).toEqual(['Oct 17, 2026'])
    expect(html.match(/While loop from stdin/g)).toEqual(['While loop from stdin'])
    expect(html).not.toMatch(/\d:\d{2}/)
    expect(formatCost(link.cost)).toBe('15.5M')
  })

  it('formats a home summed tooltip', () => {
    const part = solution()
    const html = tooltipHtml('Lisp', {
      time: Date.parse('2026-10-17T13:58:55Z'),
      cost: 156000000,
      sha: measuredSha,
      parts: [part],
    })
    expect(html).toContain('<p class="cost-tip-title">Lisp</p>')
    expect(html).not.toContain('Lisp:')
    expect(html).not.toContain('While loop from stdin')
    expect(html).not.toContain('Factorial')
    expect(html).not.toContain('View solution')
    expect(html).not.toContain('/blob/')
    expect(html).not.toContain('by ')
    expect(html).toContain('Cost 156M, Oct 17, 2026')
    expect(html).toContain(`View commit ${measuredSha.slice(0, 7)}`)
    expect(html).toContain(`https://github.com/thuelang/thueplusplus/commit/${measuredSha}`)
    expect(html.match(/156M/g)).toEqual(['156M'])
    expect(html.match(/Oct 17, 2026/g)).toEqual(['Oct 17, 2026'])

    const line = sandboxCostSeries().find(item => item.id === 'lisp')
    const summed = line?.points.find(item => item.parts && item.parts.length > 0)
    if (!summed?.sha) throw new Error('home Lisp point has no measuring commit')
    const live = tooltipHtml('Lisp', summed)
    expect(live).toContain('<p class="cost-tip-title">Lisp</p>')
    expect(live).not.toContain('Lisp:')
    expect(live).not.toContain('View solution')
    expect(live).not.toContain('/blob/')
    expect(live).toContain(`View commit ${summed.sha.slice(0, 7)}`)
    for (const partLink of summed.parts ?? []) {
      expect(live).not.toContain(partLink.blobUrl)
      if (partLink.title) expect(live).not.toContain(partLink.title)
    }
  })

  it('names the author and omits a missing author', () => {
    const link = solution()
    const named = tooltipHtml('Lisp', { time: link.time, cost: link.cost, link })
    expect(named).toContain('by Cursor Agent')
    expect(named).not.toContain('cursoragent@cursor.com')
    const blank = tooltipHtml('Lisp', { time: link.time, cost: link.cost, link: { ...link, author: '   ' } })
    expect(blank).not.toContain('by ')
    const emailOnly = tooltipHtml('Lisp', { time: link.time, cost: link.cost, link: { ...link, author: '<only@example.com>' } })
    expect(emailOnly).not.toContain('by ')
    expect(emailOnly).not.toContain('only@example.com')
  })

  it('uses the metrics commit for the factorial Lisp point', () => {
    const factorial = catalog.problems.find(problem => problem.id === 'factorial')
    const point = problemSeries(factorial!).find(item => item.id === 'lisp')?.points.find(item => item.link?.title === 'While loop from stdin')
    if (!point?.link) throw new Error('factorial lisp point is missing')
    expect(point.link.sha.startsWith('75fa4d3')).toBe(false)
    expect(point.cost).toBe(15456012)
    const html = tooltipHtml('Lisp', point)
    expect(html).toContain('Lisp: While loop from stdin')
    expect(html).toContain('Cost 15.5M, Oct 17, 2026')
    expect(html).toContain(`View commit ${point.link.sha.slice(0, 7)}`)
    expect(html).not.toContain('75fa4d3')
    expect(html).toContain(`/${point.link.sha}/`)
  })
})
