import { describe, expect, it } from 'vitest'
import { catalog } from '@/catalog'
import { bestSandboxMarks } from './cost'
import { problemSeries } from './series'

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

  it('plots factorial lisp cost over commits and keeps the version files separate', () => {
    const factorial = catalog.problems.find(problem => problem.id === 'factorial')
    const lisp = factorial?.versions.find(version => version.id === 'lisp')
    if (!factorial || !lisp) throw new Error('factorial lisp is missing')
    expect(lisp.series.map(point => point.cost)).toEqual([27470323, 15456012])
    expect(lisp.series.every(point => /^[0-9a-f]{40}$/.test(point.commit))).toBe(true)
    expect(lisp.series.some(point => point.commit.includes('T'))).toBe(false)
    expect(lisp.solutions.length).toBeGreaterThan(1)
    expect(lisp.solutions.some(solution => solution.cost == null)).toBe(true)
    const commits = new Set(catalog.commits.map(commit => commit.commit))
    for (const point of lisp.series) expect(commits.has(point.commit)).toBe(true)
  })
})
