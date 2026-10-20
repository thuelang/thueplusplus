export interface TimePoint {
  time: number
  cost: number
}

export interface PlacedPoint {
  x: number
  y: number
}

export function runningMin(points: readonly TimePoint[]): TimePoint[] {
  let best = Number.POSITIVE_INFINITY
  return points.map(point => {
    if (!Number.isInteger(point.cost) || point.cost < 0) throw new Error(`cost ${point.cost} is not a non-negative integer`)
    best = Math.min(best, point.cost)
    return { time: point.time, cost: best }
  })
}

export function formatCost(value: number): string {
  if (!Number.isInteger(value) || value < 0) throw new Error(`cost ${value} is not a non-negative integer`)
  return value.toLocaleString('en-US')
}

export function axisLabelPad(max: number): number {
  return formatCost(max).length * 8 + 16
}

export function axisTicks(max: number): number[] {
  if (!Number.isFinite(max) || max < 0) throw new Error(`axis max ${max} is not usable`)
  if (max === 0) return [0]
  const mid = Math.round(max / 2)
  return mid === 0 || mid === max ? [0, max] : [0, mid, max]
}

export function timeX(time: number, min: number, max: number, left: number, width: number): number {
  if (max === min) return left + width / 2
  return left + ((time - min) / (max - min)) * width
}

export function costY(cost: number, max: number, top: number, height: number, progress: number): number {
  const span = max === 0 ? 1 : max
  const full = top + height - (cost / span) * height
  const base = top + height
  return base + (full - base) * progress
}

export function polyline(points: readonly PlacedPoint[]): string {
  return points.map((point, index) => `${index === 0 ? 'M' : 'L'}${point.x.toFixed(2)} ${point.y.toFixed(2)}`).join(' ')
}

export function polylineLength(points: readonly PlacedPoint[]): number {
  let length = 0
  for (let index = 1; index < points.length; index += 1) {
    const dx = points[index].x - points[index - 1].x
    const dy = points[index].y - points[index - 1].y
    length += Math.hypot(dx, dy)
  }
  return length
}
