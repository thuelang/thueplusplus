import { describe, expect, it } from 'vitest'
import { axisLabelPad, axisTicks, chartLayout, chooseScale, costY, formatCost, polylineLength, runningMin, separateDots, summedCostSeries, textWidth, timeLabels, timeX } from './cost'

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
