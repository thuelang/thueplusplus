import { describe, expect, it } from 'vitest'
import { axisLabelPad, axisTicks, chartLayout, chooseScale, costY, formatCost, polylineLength, runningMin, sandboxSeriesFromCatalog, separateDots, summedCostSeries, textWidth, timeLabels, timeX } from './cost'

function problem(id: string, versions: Record<string, { series: { commit: string; cost: number }[]; cost: number | null }>) {
  return {
    id,
    versions: Object.entries(versions).map(([versionId, version]) => ({
      id: versionId,
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

  it('places one timestamp in the middle and scales a later one', () => {
    expect(timeX(5, 5, 5, 10, 100)).toBe(60)
    expect(timeX(15, 5, 25, 10, 100)).toBe(60)
  })

  it('eases a cost up from the baseline', () => {
    expect(costY(10, 10, 0, 100, 0)).toBe(100)
    expect(costY(10, 10, 0, 100, 1)).toBe(0)
    expect(costY(10, 10, 0, 100, 0.5)).toBe(50)
  })

  it('uses a log scale only when one cost dwarfs another', () => {
    expect(chooseScale([17391333, 125979265, 20973102])).toBe('linear')
    expect(chooseScale([10, 199])).toBe('linear')
    expect(chooseScale([10, 200])).toBe('log')
  })

  it('keeps a linear axis and names the latest cost when one line dwarfs another', () => {
    const series = [
      { id: 'low', label: 'Low', color: '#4c9dff', points: [{ time: 1_000, cost: 10 }, { time: 2_000, cost: 10 }] },
      { id: 'high', label: 'High', color: '#ff5a36', points: [{ time: 1_000, cost: 1000 }, { time: 2_000, cost: 1000 }] },
    ]
    const layout = chartLayout(series, { width: 640, height: 280, track: 'sum', progress: 1 })
    expect(layout.scale).toBe('linear')
    expect(layout.ends.map(end => end.text).sort()).toEqual(['High 1,000', 'Low 10'])
    const stacked = [...layout.ends].sort((left, right) => left.y - right.y)
    expect(stacked[1].y - stacked[0].y).toBeGreaterThanOrEqual(14)
    for (const label of layout.labels) {
      const half = textWidth(label.text) / 2
      expect(label.x - half).toBeGreaterThanOrEqual(0)
      expect(label.x + half).toBeLessThanOrEqual(layout.width)
    }
    expect(() => chartLayout(series, { width: 640, height: 280, scale: 'log' })).toThrow(/linear/)
  })

  it('offsets dots that share a point and leaves separated dots alone', () => {
    const stacked = separateDots([
      { x: 40, y: 40, series: 0, cost: 1, id: 'a' },
      { x: 40, y: 40, series: 1, cost: 1, id: 'b' },
    ], 4)
    expect(Math.hypot(stacked[0].x - stacked[1].x, stacked[0].y - stacked[1].y)).toBeGreaterThanOrEqual(9)
    const apart = separateDots([
      { x: 10, y: 10, series: 0, cost: 1, id: 'a' },
      { x: 40, y: 10, series: 1, cost: 2, id: 'b' },
    ], 4)
    expect(apart.map(dot => dot.x)).toEqual([10, 40])
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

  it('drops a time label that would sit on its neighbors', () => {
    const wide = timeLabels(0, 10 * 24 * 60 * 60 * 1000, 600)
    expect(wide.length).toBeGreaterThan(1)
    const narrow = timeLabels(0, 60 * 1000, 40)
    expect(narrow).toHaveLength(1)
  })

  it('formats costs and ticks', () => {
    expect(formatCost(27470323)).toBe('27,470,323')
    expect(axisLabelPad(125979265)).toBe(104)
    expect(axisTicks(0)).toEqual([0])
    expect(axisTicks(10)).toEqual([0, 5, 10])
    expect(polylineLength([{ x: 0, y: 0 }, { x: 3, y: 4 }])).toBe(5)
  })
})
