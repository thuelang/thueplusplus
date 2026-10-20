const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

function assertCost(value) {
  if (!Number.isInteger(value) || value < 0) throw new Error(`cost ${value} is not a non-negative integer`)
}

export function runningMin(points) {
  let best = Number.POSITIVE_INFINITY
  return points.map(point => {
    assertCost(point.cost)
    best = Math.min(best, point.cost)
    return { time: point.time, cost: best }
  })
}

export function formatCost(value) {
  assertCost(value)
  return value.toLocaleString('en-US')
}

export function axisLabelPad(max) {
  return formatCost(max).length * 8 + 16
}

export function axisTicks(max) {
  if (!Number.isFinite(max) || max < 0) throw new Error(`axis max ${max} is not usable`)
  if (max === 0) return [0]
  const mid = Math.round(max / 2)
  return mid === 0 || mid === max ? [0, max] : [0, mid, max]
}

export function chooseScale(values) {
  if (!Array.isArray(values) || values.length === 0) return 'linear'
  for (const value of values) assertCost(value)
  const positive = values.filter(value => value > 0)
  if (positive.length < 2) return 'linear'
  const min = Math.min(...positive)
  const max = Math.max(...positive)
  return max / min >= 20 ? 'log' : 'linear'
}

export function logTicks(min, max) {
  if (!(min > 0) || !(max >= min)) throw new Error(`log domain ${min}..${max} is not usable`)
  const ticks = []
  const start = Math.ceil(Math.log10(min) - 1e-9)
  const end = Math.floor(Math.log10(max) + 1e-9)
  for (let power = start; power <= end; power += 1) {
    const tick = 10 ** power
    if (tick >= min && tick <= max) ticks.push(tick)
  }
  if (!ticks.includes(min)) ticks.unshift(min)
  if (ticks[ticks.length - 1] !== max) ticks.push(max)
  if (ticks.length <= 4) return ticks
  const kept = [ticks[0]]
  const step = (ticks.length - 1) / 3
  for (let index = 1; index < 3; index += 1) kept.push(ticks[Math.round(index * step)])
  kept.push(ticks[ticks.length - 1])
  return [...new Set(kept)].sort((left, right) => left - right)
}

export function timeX(time, min, max, left, width) {
  if (max === min) return left + width / 2
  return left + ((time - min) / (max - min)) * width
}

export function costY(cost, max, top, height, progress) {
  const span = max === 0 ? 1 : max
  const full = top + height - (cost / span) * height
  const base = top + height
  return base + (full - base) * progress
}

export function plotY(cost, scale, min, max, top, height, progress) {
  if (scale === 'linear') return costY(cost, max, top, height, progress)
  if (scale !== 'log') throw new Error(`scale ${scale} is not linear or log`)
  if (!(min > 0) || !(max > 0) || !(cost > 0)) throw new Error(`log scale cannot plot ${cost} in ${min}..${max}`)
  const lo = Math.log10(min)
  const hi = Math.log10(max)
  const t = hi === lo ? 1 : (Math.log10(cost) - lo) / (hi - lo)
  const full = top + height - t * height
  const base = top + height
  return base + (full - base) * progress
}

export function polyline(points) {
  return points.map((point, index) => `${index === 0 ? 'M' : 'L'}${point.x.toFixed(2)} ${point.y.toFixed(2)}`).join(' ')
}

export function polylineLength(points) {
  let length = 0
  for (let index = 1; index < points.length; index += 1) {
    const dx = points[index].x - points[index - 1].x
    const dy = points[index].y - points[index - 1].y
    length += Math.hypot(dx, dy)
  }
  return length
}

export function formatTime(time, span) {
  const date = new Date(time)
  if (Number.isNaN(date.getTime())) throw new Error(`bad time ${time}`)
  const month = MONTHS[date.getUTCMonth()]
  const day = date.getUTCDate()
  const year = date.getUTCFullYear()
  if (span < 36 * 60 * 60 * 1000) {
    const hours = String(date.getUTCHours()).padStart(2, '0')
    const minutes = String(date.getUTCMinutes()).padStart(2, '0')
    return `${month} ${day} ${hours}:${minutes}`
  }
  if (span < 370 * 24 * 60 * 60 * 1000) return `${month} ${day}`
  return String(year)
}

export function timeLabels(min, max, width) {
  if (!Number.isFinite(min) || !Number.isFinite(max) || max < min) throw new Error(`time domain ${min}..${max} is not usable`)
  if (!Number.isFinite(width) || width <= 0) throw new Error(`label width ${width} is not usable`)
  const span = max - min
  const textOf = time => formatTime(time, span)
  const candidates = max === min
    ? [{ time: min, text: textOf(min) }]
    : [
        { time: min, text: textOf(min) },
        { time: min + span / 2, text: textOf(min + span / 2) },
        { time: max, text: textOf(max) },
      ]
  const xOf = time => (max === min ? width / 2 : ((time - min) / span) * width)
  const half = label => textWidth(label.text) / 2
  const hit = (left, right) => Math.abs(xOf(left.time) - xOf(right.time)) < half(left) + half(right) + 8
  let labels = candidates
  if (labels.length === 3 && (hit(labels[0], labels[1]) || hit(labels[1], labels[2]))) labels = [labels[0], labels[2]]
  if (labels.length === 2 && hit(labels[0], labels[1])) {
    const time = min + span / 2
    labels = [{ time, text: textOf(time) }]
  }
  return labels
}

export function separateDots(dots, radius) {
  if (!Number.isFinite(radius) || radius <= 0) throw new Error(`radius ${radius} is not usable`)
  const minDist = radius * 2 + 1
  const seriesCount = new Set(dots.map(dot => dot.series)).size
  const maxShift = minDist * Math.max(1, seriesCount)
  const placed = dots.map(dot => ({ ...dot, x: dot.x, origin: dot.x }))
  const overlaps = (left, right) => left.series !== right.series && Math.hypot(left.x - right.x, left.y - right.y) < minDist
  for (let pass = 0; pass < 24; pass += 1) {
    let moved = false
    for (let i = 0; i < placed.length; i += 1) {
      for (let j = i + 1; j < placed.length; j += 1) {
        const a = placed[i]
        const b = placed[j]
        if (!overlaps(a, b)) continue
        const dx = b.x - a.x
        const dir = dx === 0 ? (a.series < b.series ? -1 : 1) : Math.sign(dx)
        const push = Math.max((minDist - Math.abs(dx)) / 2, 0.5)
        const left = dir < 0 ? b : a
        const right = dir < 0 ? a : b
        const nextLeft = Math.max(left.origin - maxShift, left.x - push)
        const nextRight = Math.min(right.origin + maxShift, right.x + push)
        if (nextLeft !== left.x || nextRight !== right.x) moved = true
        left.x = nextLeft
        right.x = nextRight
      }
    }
    if (!moved) break
  }
  for (let i = 0; i < placed.length; i += 1) {
    for (let j = i + 1; j < placed.length; j += 1) {
      if (overlaps(placed[i], placed[j])) throw new Error(`dots ${placed[i].series} and ${placed[j].series} still overlap`)
    }
  }
  return placed.map(({ origin, ...dot }) => dot)
}

export function summedCostSeries(perProblem, commits) {
  if (!Array.isArray(perProblem) || perProblem.length === 0) throw new Error('summed cost needs the common problems')
  const times = [...commits].filter(time => Number.isFinite(time)).sort((left, right) => left - right)
  if (times.length === 0) throw new Error('summed cost needs commit times')
  const sorted = perProblem.map(series => [...series].sort((left, right) => left.time - right.time || left.cost - right.cost))
  const latest = (series, time) => {
    let cost = null
    for (const point of series) {
      assertCost(point.cost)
      if (point.time <= time) cost = point.cost
      else break
    }
    return cost
  }
  const points = []
  let previous = null
  for (const time of times) {
    const costs = sorted.map(series => latest(series, time))
    if (costs.some(cost => cost == null)) continue
    const cost = costs.reduce((sum, item) => sum + item, 0)
    if (previous == null || cost !== previous) points.push({ time, cost })
    previous = cost
  }
  const end = times[times.length - 1]
  if (points.length > 0 && points[points.length - 1].time !== end) points.push({ time: end, cost: previous })
  return points
}

function versionPoints(version, commitTime, fallbackTime) {
  const points = []
  for (const point of version?.series ?? []) {
    const time = commitTime.get(point.commit)
    if (time == null || !Number.isInteger(point.cost) || point.cost < 0) continue
    points.push({ time, cost: point.cost })
  }
  if (points.length > 0 || fallbackTime == null) return points
  const cost = version?.solutions?.[0]?.cost
  if (!Number.isInteger(cost) || cost < 0) return []
  return [{ time: fallbackTime, cost }]
}

export function sandboxSeriesFromCatalog(catalog) {
  const problems = catalog.sandboxCommon.map(id => {
    const problem = catalog.problems.find(item => item.id === id)
    if (!problem) throw new Error(`common problem ${id} is missing`)
    return problem
  })
  const commitTime = new Map()
  for (const commit of catalog.commits) {
    const time = Date.parse(commit.timestamp)
    if (Number.isNaN(time)) throw new Error(`commit ${commit.commit} has no time`)
    commitTime.set(commit.commit, time)
  }
  const commitTimes = [...commitTime.values()]
  const fallbackTime = commitTimes.length === 0 ? null : Math.max(...commitTimes)
  return catalog.sandboxes.flatMap(sandbox => {
    if (sandbox.total == null || !sandbox.color) return []
    const perProblem = problems.map(problem => {
      const version = problem.versions.find(item => item.id === sandbox.id)
      return versionPoints(version, commitTime, fallbackTime)
    })
    if (perProblem.some(points => points.length === 0) || commitTimes.length === 0) return []
    let points = []
    try {
      points = summedCostSeries(perProblem, commitTimes)
    } catch {
      return []
    }
    if (points.length === 0 || points[points.length - 1].cost !== sandbox.total) return []
    return [{ id: sandbox.id, label: sandbox.name, color: sandbox.color, points }]
  })
}

export function textWidth(text) {
  return text.length * 7.2
}

export function fitTimeLabels(labels, width) {
  const margin = 2
  return labels.map(label => {
    const half = textWidth(label.text) / 2
    if (half * 2 + margin * 2 > width) throw new Error(`time label ${label.text} is wider than the chart`)
    const x = Math.min(width - margin - half, Math.max(margin + half, label.x))
    return { ...label, x }
  })
}

export function placeEndLabels(labels, top, bottom) {
  const band = 14
  const gap = 3
  const minGap = band + gap
  const order = labels.map((item, index) => ({ ...item, index })).sort((left, right) => left.y - right.y || left.index - right.index)
  const ys = order.map(item => Math.min(bottom - band, Math.max(top, item.y)))
  for (let index = 1; index < ys.length; index += 1) {
    const min = ys[index - 1] + minGap
    if (ys[index] < min) ys[index] = min
  }
  if (ys.length > 0 && ys[ys.length - 1] > bottom - band) {
    ys[ys.length - 1] = bottom - band
    for (let index = ys.length - 2; index >= 0; index -= 1) {
      const max = ys[index + 1] - minGap
      if (ys[index] <= max) break
      ys[index] = max
    }
  }
  for (let index = 0; index < ys.length; index += 1) {
    if (ys[index] < top || ys[index] > bottom - band) throw new Error('end labels do not fit in the plot')
    if (index > 0 && ys[index] < ys[index - 1] + band) throw new Error('end labels still collide')
  }
  const placed = new Array(labels.length)
  order.forEach((item, index) => {
    placed[item.index] = { id: item.id, text: item.text, x: item.x, y: ys[index], color: item.color }
  })
  return placed
}

export function bestSandboxMarks(problem) {
  return problem.versions.flatMap(version => {
    if (version.id === 'direct') return []
    const costs = version.series.map(point => point.cost)
    if (costs.length === 0) return []
    for (const cost of costs) assertCost(cost)
    return [{ id: version.id, label: version.name, color: version.color, cost: Math.min(...costs) }]
  })
}

export function chartLayout(series, options) {
  const width = options.width
  const height = options.height
  const spark = options.spark === true
  const track = options.track === 'sum' ? 'sum' : 'best'
  const progress = options.progress ?? 1
  if (options.scale && options.scale !== 'linear') throw new Error(`scale ${options.scale} is not linear`)
  const radius = spark ? 3 : 4
  const values = series.flatMap(item => item.points.map(point => point.cost))
  const max = values.length === 0 ? 0 : Math.max(...values)
  const scale = 'linear'
  const minCost = 0
  const endTexts = series.map(item => {
    const ordered = [...item.points].sort((left, right) => left.time - right.time || left.cost - right.cost)
    const lineSource = track === 'best' ? runningMin(ordered) : ordered
    const latest = lineSource[lineSource.length - 1]
    return latest ? `${item.label} ${formatCost(latest.cost)}` : item.label
  })
  const endPad = endTexts.length === 0 ? 16 : Math.max(...endTexts.map(text => textWidth(text))) + 16
  const pad = spark
    ? { l: 8, r: 8, t: 8, b: 8 }
    : { l: axisLabelPad(max), r: endPad, t: 16, b: 36 }
  const inner = {
    left: pad.l,
    top: pad.t,
    width: width - pad.l - pad.r,
    height: height - pad.t - pad.b,
  }
  const times = series.flatMap(item => item.points.map(point => point.time))
  const minTime = times.length === 0 ? 0 : Math.min(...times)
  const maxTime = times.length === 0 ? 0 : Math.max(...times)
  const yAt = (cost, at) => plotY(cost, scale, minCost, max, inner.top, inner.height, at)
  const xAt = time => timeX(time, minTime, maxTime, inner.left, inner.width)
  const drawn = series.map((item, seriesIndex) => {
    const ordered = [...item.points].sort((left, right) => left.time - right.time || left.cost - right.cost)
    const lineSource = track === 'best' ? runningMin(ordered) : ordered
    const line = lineSource.map(point => ({ x: xAt(point.time), y: yAt(point.cost, progress) }))
    const dots = ordered.map(point => ({
      x: xAt(point.time),
      y: yAt(point.cost, 1),
      series: seriesIndex,
      cost: point.cost,
      id: item.id,
    }))
    return { id: item.id, label: item.label, color: item.color, line, dots }
  })
  const separated = spark ? drawn.flatMap(item => item.dots) : separateDots(drawn.flatMap(item => item.dots), radius)
  const laid = drawn.map(item => {
    const dots = separated.filter(dot => dot.id === item.id).map(dot => ({ ...dot, y: yAt(dot.cost, progress) }))
    const line = item.line
    return { ...item, dots, line, d: polyline(line), length: polylineLength(line) }
  })
  const labels = spark ? [] : fitTimeLabels(timeLabels(minTime, maxTime, inner.width).map(label => ({ ...label, x: xAt(label.time) })), width)
  const tickValues = spark ? [] : axisTicks(max)
  const ticks = tickValues.map(value => ({ value, y: yAt(value, 1), text: formatCost(value) }))
  const ends = spark ? [] : placeEndLabels(laid.flatMap(item => {
    const last = item.line[item.line.length - 1]
    if (!last) return []
    const sourceSeries = series.find(seriesItem => seriesItem.id === item.id)
    if (!sourceSeries) throw new Error(`${item.id} disappeared while labeling the chart`)
    const source = [...sourceSeries.points].sort((left, right) => left.time - right.time || left.cost - right.cost)
    const shown = track === 'best' ? runningMin(source) : source
    const latest = shown[shown.length - 1]
    if (!latest) return []
    return [{
      id: item.id,
      text: `${item.label} ${formatCost(latest.cost)}`,
      x: last.x + radius + 6,
      y: last.y,
      color: item.color,
    }]
  }), inner.top, inner.top + inner.height)
  return { width, height, pad, scale, radius, series: laid, labels, ticks, ends }
}
