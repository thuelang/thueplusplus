import { describe, expect, it } from 'vitest'
import { axisLabelPad, axisTicks, costY, formatCost, polylineLength, runningMin, timeX } from './cost'

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

  it('formats costs and ticks', () => {
    expect(formatCost(27470323)).toBe('27,470,323')
    expect(axisLabelPad(125979265)).toBe(104)
    expect(axisTicks(0)).toEqual([0])
    expect(axisTicks(10)).toEqual([0, 5, 10])
    expect(polylineLength([{ x: 0, y: 0 }, { x: 3, y: 4 }])).toBe(5)
  })
})
