import { describe, expect, it } from 'vitest'
import { formatCost, runningMin, sandboxSeriesFromCatalog, summedCostSeries } from './cost'

function problem(id: string, versions: Record<string, { series: { commit: string; cost: number; solution?: string }[]; cost: number | null }>) {
  return {
    id,
    versions: Object.entries(versions).map(([versionId, version]) => ({
      id: versionId,
      color: versionId === 'direct' ? 'var(--direct)' : `var(--sandbox-${versionId})`,
      series: version.series,
      solutions: [{ cost: version.cost }],
    })),
  }
}

describe('cost chart geometry', () => {
  it('keeps the minimum cost seen so far', () => {
    expect(runningMin([
      { time: 1, cost: 10 },
      { time: 2, cost: 4 },
      { time: 3, cost: 8 },
    ])).toEqual([
      { time: 1, cost: 10 },
      { time: 2, cost: 4 },
      { time: 3, cost: 4 },
    ])
  })

  it('sums the latest cost of every common problem and holds it to the last commit', () => {
    const points = summedCostSeries([
      [{ time: 1, cost: 10 }, { time: 3, cost: 4 }],
      [{ time: 2, cost: 5 }],
    ], [1, 2, 3, 4])
    expect(points).toEqual([
      { time: 2, cost: 15 },
      { time: 3, cost: 9 },
      { time: 4, cost: 9 },
    ])
  })

  it('sums only the cheaper version when a later version costs more', () => {
    const points = summedCostSeries([
      [
        { time: 1, cost: 10, version: 'a' },
        { time: 3, cost: 40, version: 'b' },
      ],
      [{ time: 2, cost: 5, version: 'c' }],
    ], [1, 2, 3, 4])
    expect(points.map(point => point.cost)).toEqual([15, 15])
    expect(points.at(-1)?.cost).toBe(15)
  })

  it('replaces a version when that same version is measured again', () => {
    const points = summedCostSeries([
      [
        { time: 1, cost: 10, version: 'a' },
        { time: 3, cost: 40, version: 'a' },
      ],
      [{ time: 2, cost: 5, version: 'c' }],
    ], [1, 2, 3])
    expect(points.at(-1)?.cost).toBe(45)
  })

  it('keeps Forth when the production catalog has empty series and a working-tree cost', () => {
    const hello = 134
    const fizzbuzz = 13738468
    const factorial = 1726231
    const gcd = 1167181
    const leap = 759319
    const forthTotal = hello + fizzbuzz + factorial + gcd + leap
    const catalog = {
      sandboxCommon: ['hello-world', 'fizzbuzz', 'factorial', 'greatest-common-divisor', 'leap-year'],
      commits: [
        { commit: '0828521', timestamp: '2026-10-20T12:29:11Z' },
        { commit: '53e0e39', timestamp: '2026-10-20T14:00:32Z' },
      ],
      sandboxes: [
        { id: 'forth', name: 'Forth', total: forthTotal, color: 'var(--sandbox-forth)' },
        { id: 'lisp', name: 'Lisp', total: 5, color: 'var(--sandbox-lisp)' },
        { id: 'broken', name: 'Broken', total: 1, color: 'var(--sandbox-basic)' },
      ],
      problems: [
        problem('hello-world', { forth: { series: [], cost: hello }, lisp: { series: [{ commit: '53e0e39', cost: 1 }], cost: 1 }, broken: { series: [], cost: null } }),
        problem('fizzbuzz', { forth: { series: [{ commit: '0828521', cost: fizzbuzz }], cost: fizzbuzz }, lisp: { series: [{ commit: '0828521', cost: 1 }], cost: 1 }, broken: { series: [], cost: null } }),
        problem('factorial', { forth: { series: [], cost: factorial }, lisp: { series: [{ commit: '53e0e39', cost: 1 }], cost: 1 }, broken: { series: [], cost: null } }),
        problem('greatest-common-divisor', { forth: { series: [{ commit: '0828521', cost: gcd }], cost: gcd }, lisp: { series: [{ commit: '0828521', cost: 1 }], cost: 1 }, broken: { series: [], cost: null } }),
        problem('leap-year', { forth: { series: [{ commit: '0828521', cost: leap }], cost: leap }, lisp: { series: [{ commit: '0828521', cost: 1 }], cost: 1 }, broken: { series: [], cost: null } }),
      ],
    }
    const lines = sandboxSeriesFromCatalog(catalog)
    expect(lines.map(line => line.id)).toEqual(['forth', 'lisp'])
    expect(lines[0].points.at(-1)?.cost).toBe(forthTotal)
    expect(lines[1].points.at(-1)?.cost).toBe(5)
  })

  it('adds Direct Thue to the home sum only when every common problem has a direct cost', () => {
    const withDirect = {
      sandboxCommon: ['hello-world', 'fizzbuzz'],
      commits: [{ commit: 'a', timestamp: '2026-10-17T14:16:44Z' }, { commit: 'b', timestamp: '2026-10-20T00:00:00Z' }],
      sandboxes: [{ id: 'forth', name: 'Forth', total: 30, color: 'var(--sandbox-forth)' }],
      problems: [
        problem('hello-world', { forth: { series: [{ commit: 'a', cost: 10 }], cost: 10 }, direct: { series: [{ commit: 'a', cost: 4 }], cost: 4 } }),
        problem('fizzbuzz', { forth: { series: [{ commit: 'a', cost: 20 }], cost: 20 }, direct: { series: [{ commit: 'a', cost: 6 }], cost: 6 } }),
      ],
    }
    const lines = sandboxSeriesFromCatalog(withDirect)
    expect(lines.map(line => line.id)).toEqual(['forth', 'direct'])
    expect(lines[1]).toMatchObject({ label: 'Direct Thue', color: 'var(--direct)' })
    expect(lines[1].points.at(-1)?.cost).toBe(10)
    const missing = {
      ...withDirect,
      problems: [
        withDirect.problems[0],
        problem('fizzbuzz', { forth: { series: [{ commit: 'a', cost: 20 }], cost: 20 } }),
      ],
    }
    expect(sandboxSeriesFromCatalog(missing).map(line => line.id)).toEqual(['forth'])
  })

  it('formats costs in SI', () => {
    expect(formatCost(134)).toBe('134')
    expect(formatCost(2450)).toBe('2.45k')
    expect(formatCost(6440)).toBe('6.44k')
    expect(formatCost(13200)).toBe('13.2k')
    expect(formatCost(1300000)).toBe('1.30M')
    expect(formatCost(87698224)).toBe('87.7M')
    expect(formatCost(119000000)).toBe('119M')
    expect(formatCost(1180000000)).toBe('1.18G')
    expect(formatCost(1180000000000)).toBe('1.18T')
    expect(formatCost(999950)).toBe('1.00M')
    expect(formatCost(999950000000)).toBe('1.00T')
    expect(formatCost(0)).toBe('0')
    expect(formatCost(-5)).toBe('-5')
    expect(formatCost(-61200000)).toBe('-61.2M')
  })
})
