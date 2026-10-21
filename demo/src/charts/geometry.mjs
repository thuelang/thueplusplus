const REPOSITORY = 'https://github.com/thuelang/thueplusplus'

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

const SI_SUFFIX = ['', 'k', 'M', 'G', 'T']

export function formatCost(value) {
  if (typeof value !== 'number' || !Number.isFinite(value)) throw new Error(`cost ${value} is not a finite number`)
  if (value === 0) return '0'
  const sign = value < 0 ? '-' : ''
  let abs = Math.abs(value)
  const nearest = Math.round(abs)
  if (Math.abs(abs - nearest) <= 1e-6 * Math.max(1, nearest)) abs = nearest
  if (abs < 1000) {
    const whole = Math.round(abs)
    if (whole < 1000) return sign + String(whole)
    abs = whole
  }
  const exp = Math.floor(Math.log10(abs) + 1e-10)
  const scale = 10 ** (exp - 2)
  const rounded = Math.round(abs / scale) * scale
  if (!(rounded > 0)) throw new Error(`cost ${value} did not round`)
  const exp2 = Math.floor(Math.log10(rounded) + 1e-10)
  const group = Math.floor(exp2 / 3)
  const suffix = SI_SUFFIX[group]
  if (!suffix) throw new Error(`cost ${value} is outside k, M, G, and T`)
  const scaled = rounded / 10 ** (group * 3)
  const text = scaled.toFixed(2 - (exp2 % 3))
  if (Number(text) >= 1000) throw new Error(`cost ${value} rounded to ${text}${suffix}`)
  return sign + text + suffix
}

export function formatTick(value) {
  const text = formatCost(value)
  return text.replace(/(\.\d*?)0+([kMGT])$/, (_, digits, suffix) => `${digits === '.' ? '' : digits}${suffix}`)
}

export function solutionLink(fields) {
  const sha = fields.sha
  const solutionPath = fields.solutionPath
  if (typeof sha !== 'string' || !/^[0-9a-f]{40}$/.test(sha)) throw new Error(`${solutionPath || fields.problem || 'solution'} has no commit sha`)
  if (typeof solutionPath !== 'string' || solutionPath.length === 0 || solutionPath.startsWith('/') || solutionPath.split('/').includes('..')) {
    throw new Error(`solution path ${solutionPath} is not usable`)
  }
  assertCost(fields.cost)
  if (!Number.isFinite(fields.time)) throw new Error(`solution ${solutionPath} has no time`)
  if (!fields.problemId || !fields.problem || !fields.label) throw new Error(`solution ${solutionPath} is missing a label`)
  const author = typeof fields.author === 'string' ? fields.author.trim() : ''
  if (author.length === 0) throw new Error(`solution ${solutionPath} has no author`)
  const title = typeof fields.title === 'string' ? fields.title.trim() : ''
  return {
    problemId: fields.problemId,
    problem: fields.problem,
    label: fields.label,
    cost: fields.cost,
    time: fields.time,
    sha,
    author,
    title,
    solutionPath,
    blobUrl: `${REPOSITORY}/blob/${sha}/${solutionPath}`,
    commitUrl: `${REPOSITORY}/commit/${sha}`,
  }
}

function groupsOf(points) {
  const groups = new Map()
  points.forEach((point, index) => {
    assertCost(point.cost)
    if (!Number.isFinite(point.time)) throw new Error('cost point has no time')
    const key = point.version == null ? `point:${index}` : String(point.version)
    const list = groups.get(key)
    if (list) list.push(point)
    else groups.set(key, [point])
  })
  for (const list of groups.values()) list.sort((left, right) => left.time - right.time)
  return [...groups.values()]
}

function latestAt(group, time) {
  let found = null
  for (const point of group) {
    if (point.time <= time) found = point
    else break
  }
  return found
}

function bestAt(points, time) {
  let best = null
  for (const group of groupsOf(points)) {
    const latest = latestAt(group, time)
    if (!latest) continue
    if (!best || latest.cost < best.cost) best = latest
  }
  return best
}

export function summedCostSeries(perProblem, commits) {
  if (!Array.isArray(perProblem) || perProblem.length === 0) throw new Error('summed cost needs the common problems')
  const times = [...commits].filter(time => Number.isFinite(time)).sort((left, right) => left - right)
  if (times.length === 0) throw new Error('summed cost needs commit times')
  const problems = perProblem.map(series => [...series])
  const points = []
  let previous = null
  let previousParts = null
  let previousSha = null
  for (const time of times) {
    const winners = problems.map(series => bestAt(series, time))
    if (winners.some(item => item == null)) continue
    const cost = winners.reduce((sum, item) => sum + item.cost, 0)
    const links = winners.map(item => item.link).filter(Boolean)
    const parts = links.length === winners.length ? links : null
    const sha = measuringSha(winners, time)
    if (previous == null || cost !== previous) {
      const point = { time, cost }
      if (parts) point.parts = parts
      const commit = sha || previousSha
      if (parts && !commit) throw new Error(`summed cost at ${time} has no measuring commit`)
      if (commit) point.sha = commit
      points.push(point)
      if (sha) previousSha = sha
    }
    previous = cost
    previousParts = parts
  }
  const end = times[times.length - 1]
  if (points.length > 0 && points[points.length - 1].time !== end) {
    const point = { time: end, cost: previous }
    if (previousParts) point.parts = previousParts
    if (previousParts && !previousSha) throw new Error('summed cost has no measuring commit')
    if (previousSha) point.sha = previousSha
    points.push(point)
  }
  return points
}

function measuringSha(winners, time) {
  const fresh = winners.filter(item => item.time === time && item.link && /^[0-9a-f]{40}$/.test(item.link.sha))
  const shas = [...new Set(fresh.map(item => item.link.sha))]
  if (shas.length > 1) throw new Error(`summed cost at ${time} comes from commits ${shas.join(', ')}`)
  return shas[0] ?? null
}

function linkFor(problem, version, point, time) {
  if (!point?.sha || !point.solutionPath || !problem?.title) return null
  const solution = (version.solutions || []).find(item => item.id === point.solution)
  const title = typeof solution?.title === 'string' ? solution.title.trim() : ''
  const fileAuthor = typeof solution?.author === 'string' ? solution.author.trim() : ''
  return solutionLink({
    problemId: problem.id,
    problem: problem.title,
    label: version.id === 'direct' ? 'Direct Thue' : (version.name || version.id),
    cost: point.cost,
    time,
    sha: point.sha,
    author: fileAuthor || point.author || version.author || '',
    title,
    solutionPath: point.solutionPath,
  })
}

function versionPoints(problem, version, commitTime, fallbackTime) {
  const points = []
  for (const point of version?.series ?? []) {
    const time = commitTime.get(point.commit)
    if (time == null || !Number.isInteger(point.cost) || point.cost < 0) continue
    const next = { time, cost: point.cost, version: point.solution || point.commit }
    const link = linkFor(problem, version, point, time)
    if (link) next.link = link
    points.push(next)
  }
  if (points.length > 0 || fallbackTime == null) return points
  const cost = version?.solutions?.[0]?.cost
  if (!Number.isInteger(cost) || cost < 0) return []
  return [{ time: fallbackTime, cost, version: 'working-tree' }]
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
  const lines = catalog.sandboxes.flatMap(sandbox => {
    if (sandbox.total == null || !sandbox.color) return []
    const perProblem = problems.map(problem => {
      const version = problem.versions.find(item => item.id === sandbox.id)
      return versionPoints(problem, version, commitTime, fallbackTime)
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
  const direct = directHomeSeries(problems, commitTime, commitTimes, fallbackTime)
  if (direct) lines.push(direct)
  return lines
}

function directHomeSeries(problems, commitTime, commitTimes, fallbackTime) {
  if (problems.length === 0 || commitTimes.length === 0) return null
  const versions = problems.map(problem => problem.versions.find(item => item.id === 'direct'))
  if (versions.some(version => !version)) return null
  const perProblem = versions.map((version, index) => versionPoints(problems[index], version, commitTime, fallbackTime))
  if (perProblem.some(points => points.length === 0)) return null
  const points = summedCostSeries(perProblem, commitTimes)
  const total = perProblem.reduce((sum, series) => {
    const best = bestAt(series, Number.POSITIVE_INFINITY)
    if (!best) throw new Error('Direct Thue is missing a cost')
    return sum + best.cost
  }, 0)
  const last = points[points.length - 1]
  if (!last || last.cost !== total) throw new Error(`Direct Thue sum ${last?.cost} is not ${total}`)
  const color = versions[0].color
  if (!color) throw new Error('Direct Thue has no chart color')
  return { id: 'direct', label: 'Direct Thue', color, points }
}

export function bestSandboxMarks(problem) {
  return problem.versions.flatMap(version => {
    const costs = version.series.map(point => point.cost)
    if (costs.length === 0) return []
    for (const cost of costs) assertCost(cost)
    let best = version.series[0]
    for (const point of version.series) {
      if (point.cost < best.cost) best = point
    }
    const solution = (version.solutions || []).find(item => item.id === best.solution)
    return [{
      id: version.id,
      label: version.id === 'direct' ? 'Direct Thue' : version.name,
      color: version.color,
      cost: best.cost,
      title: solution && solution.title ? solution.title : null,
    }]
  })
}
