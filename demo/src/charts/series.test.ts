import { describe, expect, it } from 'vitest'
import { catalog } from '@/catalog'
import { bestSandboxMarks } from './cost'
import { problemSeries, sandboxCostSeries } from './series'
import { escapeHtml, tooltipHtml } from './tooltip'

describe('problem series', () => {
  it('includes Direct Thue when a direct solution exists and omits it when one does not', () => {
    const leap = catalog.problems.find(problem => problem.id === 'leap-year')
    if (!leap) throw new Error('leap-year is missing')
    const series = problemSeries(leap)
    const direct = series.find(item => item.id === 'direct')
    expect(direct?.label).toBe('Direct Thue')
    expect(direct?.color).toBe('var(--direct)')
    expect(direct?.points.length).toBeGreaterThan(0)
    expect(series.some(item => item.id === 'forth')).toBe(true)

    const removed = problemSeries({
      ...leap,
      versions: leap.versions.filter(version => version.id !== 'direct'),
    })
    expect(removed.some(item => item.id === 'direct')).toBe(false)

    const unmeasured = problemSeries({
      ...leap,
      versions: leap.versions.map(version => version.id === 'direct' ? { ...version, series: [] } : version),
    })
    expect(unmeasured.some(item => item.id === 'direct')).toBe(false)
  })

  it('marks Direct Thue on a problem card', () => {
    const leap = catalog.problems.find(problem => problem.id === 'leap-year')
    const fibonacci = catalog.problems.find(problem => problem.id === 'fibonacci-sequence')
    if (!leap || !fibonacci) throw new Error('card problems are missing')
    const leapMark = bestSandboxMarks(leap).find(mark => mark.id === 'direct')
    expect(leapMark?.label).toBe('Direct Thue')
    expect(leapMark?.cost).toBe(Math.min(...leap.versions.find(version => version.id === 'direct')!.series.map(point => point.cost)))
    expect(bestSandboxMarks(fibonacci)).toEqual([
      expect.objectContaining({ id: 'direct', label: 'Direct Thue', color: 'var(--direct)' }),
    ])
  })

  it('includes Direct Thue on the home chart and links each point to GitHub', () => {
    const lines = sandboxCostSeries()
    const direct = lines.find(line => line.id === 'direct')
    expect(direct?.label).toBe('Direct Thue')
    expect(direct?.color).toBe('var(--direct)')
    expect(direct?.points.length).toBeGreaterThan(0)
    for (const line of lines) {
      let best = 0
      for (const id of catalog.sandboxCommon) {
        const problem = catalog.problems.find(item => item.id === id)
        const version = problem?.versions.find(item => item.id === line.id)
        const costs = (version?.solutions ?? []).flatMap(solution => typeof solution.cost === 'number' ? [solution.cost] : [])
        expect(costs.length).toBeGreaterThan(0)
        best += Math.min(...costs)
      }
      expect(line.points.at(-1)?.cost).toBe(best)
      const summed = line.points.find(point => point.parts && point.parts.length === catalog.sandboxCommon.length)
      expect(summed?.parts?.map(part => part.problemId).sort()).toEqual([...catalog.sandboxCommon].sort())
      for (const part of summed?.parts ?? []) {
        expect(part.blobUrl).toMatch(new RegExp(`^https://github.com/thuelang/thueplusplus/blob/${part.sha}/problems/${part.problemId}/solutions/${line.id}/`))
        expect(part.commitUrl).toBe(`https://github.com/thuelang/thueplusplus/commit/${part.sha}`)
      }
    }
  })

  it('builds a leap-year tooltip for the solution file at that commit', () => {
    const leap = catalog.problems.find(problem => problem.id === 'leap-year')
    if (!leap) throw new Error('leap-year is missing')
    const direct = problemSeries(leap).find(item => item.id === 'direct')
    const point = direct?.points[0]
    if (!point?.link) throw new Error('leap-year direct point has no link')
    expect(point.link.blobUrl).toMatch(/^https:\/\/github\.com\/thuelang\/thueplusplus\/blob\/[0-9a-f]{40}\/problems\/leap-year\/solutions\/direct\/\d{4}-\d{2}-\d{2}_\d{2}-\d{2}-\d{2}\/[0-9a-f]{12}\.[a-z0-9]+$/)
    expect(point.link.commitUrl).toBe(`https://github.com/thuelang/thueplusplus/commit/${point.link.sha}`)
    expect(point.link.label).toBe('Direct Thue')
    expect(point.link.problem).toBe('Leap year')
    const html = tooltipHtml('Direct Thue', point)
    expect(html).toContain(point.link.blobUrl)
    expect(html).toContain(point.link.commitUrl)
    expect(html).toContain('Leap year')
    expect(html).toContain(point.link.sha.slice(0, 7))
    expect(html).toContain(escapeHtml(point.link.author))
  })
})
