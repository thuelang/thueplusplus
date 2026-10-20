import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const repoRoot = fileURLToPath(new URL('../../', import.meta.url))
const catalogPath = join(repoRoot, 'demo/src/generated/catalog.json')
const summaryPath = join(repoRoot, 'demo/src/generated/summary.json')
const CHARTS = ['var(--chart-1)', 'var(--chart-2)', 'var(--chart-3)', 'var(--chart-4)', 'var(--chart-5)', 'var(--chart-6)', 'var(--chart-7)', 'var(--chart-8)', 'var(--chart-9)']
const SITE = 'https://thuelang.org'

export class CatalogError extends Error {}

export function parseFrontmatter(text, path) {
  if (!text.startsWith('---\n')) throw new CatalogError(`${path}: missing opening frontmatter`)
  const end = text.indexOf('\n---\n', 4)
  if (end < 0) throw new CatalogError(`${path}: frontmatter is not closed`)
  const fields = {}
  for (const line of text.slice(4, end).split('\n')) {
    if (line.trim() === '') continue
    if (line.startsWith(' ') || line.startsWith('\t')) throw new CatalogError(`${path}: nested frontmatter is invalid`)
    const split = line.indexOf(':')
    if (split < 0) throw new CatalogError(`${path}: frontmatter line has no key`)
    const key = line.slice(0, split).trim()
    const value = line.slice(split + 1).trim()
    if (['limits', 'max_steps', 'max_evals', 'max_state_bytes', 'timeout', 'timeout_seconds', 'memory_cap_bytes'].includes(key)) {
      throw new CatalogError(`${path}: ${key} is global and cannot appear in frontmatter`)
    }
    if (!key || !value || fields[key] !== undefined) throw new CatalogError(`${path}: frontmatter key ${key} must be a new non-empty field`)
    fields[key] = value
  }
  if (Object.keys(fields).length === 0) throw new CatalogError(`${path}: frontmatter is empty`)
  let body = text.slice(end + 5)
  if (body.startsWith('\n')) body = body.slice(1)
  return { fields, body }
}

export function commonProblems(passing) {
  const compared = Object.values(passing).filter(problems => problems.length > 0)
  if (compared.length === 0) return []
  return compared.reduce((common, problems) => common.filter(problem => problems.includes(problem)))
}

export function aggregateSum(costs, common) {
  const totals = {}
  for (const [ruleset, byProblem] of Object.entries(costs)) {
    if (!common.every(problem => Number.isInteger(byProblem[problem]))) continue
    totals[ruleset] = common.reduce((sum, problem) => sum + byProblem[problem], 0)
  }
  return totals
}

export function sitemapXml(entries) {
  const body = entries.map(entry => `  <url>\n    <loc>${escapeXml(entry.loc)}</loc>\n    <priority>${entry.priority}</priority>\n  </url>`).join('\n')
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${body}\n</urlset>\n`
}

export function problemPages(catalog) {
  return catalog.problems.map(problem => ({
    path: problem.path,
    title: problem.title,
    documentTitle: problem.documentTitle,
    description: problem.summary,
    canonical: problem.canonical,
    robots: 'index,follow',
  }))
}

export const HOST_TITLES = {
  python: 'Python',
  go: 'Go',
  js: 'JavaScript (native)',
  wasm: 'WebAssembly',
  rust: 'Rust',
  cpp: 'C++',
  ruby: 'Ruby',
  csharp: 'C#',
  java: 'Java',
}

export function hostIds(text) {
  const ids = []
  for (const match of text.matchAll(/\{\s*id\s*=\s*"([^"]+)"/g)) ids.push(match[1])
  if (ids.length === 0) throw new CatalogError('hosts.toml has no host ids')
  if (new Set(ids).size !== ids.length) throw new CatalogError('hosts.toml has a duplicate id')
  return ids
}

export function hostDocPages(ids) {
  return ids.flatMap(id => {
    const title = HOST_TITLES[id]
    if (!title) throw new CatalogError(`hosts.toml host ${id} has no site title`)
    return [
      ['install', 'Install', `${title}.`, `Install the ${title} host.`],
      ['api', 'API', `${title} API.`, `The ${title} embedding API.`],
      ['examples', 'Examples', `${title} examples.`, `A ${title} library example.`],
    ].map(([part, label, heading, description]) => ({
      path: `/docs/${id}/${part}`,
      title: heading,
      documentTitle: `Thue++ ${label} — ${title}`,
      description,
      canonical: `${SITE}/docs/${id}/${part}`,
      robots: 'index,follow',
    }))
  })
}

export function sandboxPages(catalog) {
  return catalog.sandboxes.map(sandbox => ({
    path: `/sandboxes/${sandbox.id}`,
    title: `${sandbox.name}.`,
    documentTitle: `Thue++ ${sandbox.name}`,
    description: sandbox.status === 'pending' ? 'In progress.' : sandbox.description,
    canonical: `${SITE}/sandboxes/${sandbox.id}`,
    robots: 'index,follow',
  }))
}

export function costDrops(points) {
  const events = []
  let previous = null
  for (const point of points) {
    if (!Number.isInteger(point.cost) || point.cost < 0) throw new CatalogError(`cost at ${point.commit} is not a non-negative integer`)
    if (previous && point.cost < previous.cost) {
      events.push({ before: previous.cost, after: point.cost, commit: point.commit })
    }
    previous = point
  }
  return events
}

export function aggregateDrops(snapshots) {
  const events = []
  let previous = null
  for (const snap of snapshots) {
    if (previous && previous.common.join('\0') === snap.common.join('\0')) {
      for (const [id, after] of Object.entries(snap.totals)) {
        const before = previous.totals[id]
        if (Number.isInteger(before) && after < before) {
          events.push({ sandbox: id, before, after, commit: snap.commit })
        }
      }
    }
    previous = snap
  }
  return events
}

export function readGeneratedCatalog() {
  if (!existsSync(catalogPath)) throw new CatalogError('demo/src/generated/catalog.json is missing. Run node demo/scripts/build-site.mjs')
  const catalog = JSON.parse(readFileSync(catalogPath, 'utf8'))
  if (catalog.schemaVersion !== 3) throw new CatalogError(`catalog schemaVersion must be 3, got ${catalog.schemaVersion}`)
  return catalog
}

function git(args, { missing = false } = {}) {
  try {
    return execFileSync('git', args, { cwd: repoRoot, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim()
  } catch (error) {
    const stderr = `${error.stderr ?? ''}`
    if (missing && /fatal: (bad object|ambiguous argument|invalid object name|needed a single revision|bad revision)/i.test(stderr)) return null
    throw new CatalogError(stderr.trim() || `${error.message ?? error}`)
  }
}

function gitShow(sha, path) {
  try {
    return execFileSync('git', ['show', `${sha}:${path}`], { cwd: repoRoot, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] })
  } catch {
    return null
  }
}

function orderFrom(path) {
  const text = readFileSync(join(repoRoot, path), 'utf8')
  const ids = []
  let inside = false
  for (const line of text.split('\n')) {
    const trim = line.trim()
    if (trim.startsWith('order')) {
      inside = true
      continue
    }
    if (!inside || trim === '' || trim.startsWith('#')) continue
    if (trim === ']') break
    ids.push(trim.replace(/[",]/g, ''))
  }
  if (ids.length === 0) throw new CatalogError(`${path}: empty order`)
  return ids
}

function rulesetOrder(present) {
  const ordered = []
  if (present.has('direct')) ordered.push('direct')
  for (const lang of orderFrom('langs/suite.toml')) {
    if (present.has(lang) && !ordered.includes(lang)) ordered.push(lang)
  }
  for (const id of [...present].sort()) {
    if (!ordered.includes(id)) ordered.push(id)
  }
  if (ordered.length > CHARTS.length) throw new CatalogError(`rulesets need more than ${CHARTS.length} chart colors`)
  return ordered
}

function shallowRoots() {
  const rel = git(['rev-parse', '--git-path', 'shallow'], { missing: true })
  if (!rel) return new Set()
  const path = rel.startsWith('/') ? rel : join(repoRoot, rel)
  if (!existsSync(path)) return new Set()
  return new Set(readFileSync(path, 'utf8').split('\n').map(line => line.trim()).filter(line => /^[0-9a-f]{40}$/.test(line)))
}

export function historyRows(log, boundary) {
  if (!log) return { rows: [], truncated: false, omitted: [] }
  const rows = []
  const omitted = []
  for (const line of log.split('\n')) {
    const [commit, timestamp, author] = line.split('\t')
    if (!/^[0-9a-f]{40}$/.test(commit)) throw new CatalogError(`bad commit ${commit}`)
    if (boundary.has(commit)) {
      omitted.push(commit)
      continue
    }
    rows.push({ commit, timestamp: utcTimestamp(timestamp), author })
  }
  return { rows: rows.reverse(), truncated: omitted.length > 0, omitted }
}

function storedStamp(document) {
  if (typeof document.author !== 'string' || !/^.+ <.+>$/.test(document.author)) return null
  if (typeof document.timestamp !== 'string') return null
  try {
    return { author: document.author, timestamp: utcTimestamp(document.timestamp) }
  } catch (error) {
    if (error instanceof CatalogError) return null
    throw error
  }
}

function gitStamp(commit) {
  if (!/^[0-9a-f]{40}$/.test(commit)) return null
  try {
    execFileSync('git', ['cat-file', '-e', `${commit}^{commit}`], { cwd: repoRoot, stdio: 'ignore' })
  } catch {
    return null
  }
  return {
    author: git(['log', '-1', '--format=%an <%ae>', commit]),
    timestamp: utcTimestamp(git(['log', '-1', '--format=%aI', commit])),
  }
}

export function stampForRunsDocument(document, lookup) {
  const stored = storedStamp(document)
  if (stored) return stored
  if (typeof document.commit !== 'string') return null
  return lookup(document.commit)
}

function metricHistory(path, boundary) {
  const dirty = git(['status', '--porcelain', '--', path])
  if (dirty) throw new CatalogError(`${path} is dirty; commit it before building the site`)
  const log = git(['log', '--follow', '--format=%H%x09%aI%x09%an <%ae>', '--', path], { missing: true })
  if (log == null) {
    console.log(`site: omit history of ${path} (git log failed in this clone)`)
    return { rows: [], truncated: true, omitted: [] }
  }
  return historyRows(log, boundary)
}

function utcTimestamp(value) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) throw new CatalogError(`bad timestamp ${value}`)
  return date.toISOString().replace(/\.\d{3}Z$/, 'Z')
}

function readMetric(text, path) {
  const data = JSON.parse(text)
  if (data.pass !== true || !Number.isInteger(data.cost) || data.cost < 0) {
    throw new CatalogError(`${path}: metric.json must pass with a non-negative cost`)
  }
  return data
}

function summaryOf(description) {
  const paragraph = description.split(/\n\n+/)[0]?.replace(/`([^`]+)`/g, '$1').replace(/\s+/g, ' ').trim() ?? ''
  const sentence = paragraph.split(/(?<=[.!])\s/)[0] ?? ''
  if (!sentence) throw new CatalogError('problem summary is empty')
  return sentence.length > 180 ? `${sentence.slice(0, 179)}…` : sentence
}

function splitDescription(body, path) {
  const paragraphs = body.split(/\n\n+/).map(item => item.trim()).filter(item => item.length > 0)
  const credit = paragraphs.find(item => item.startsWith('Adapted from the Rosetta Code'))
  if (!credit) throw new CatalogError(`${path}: missing Rosetta Code credit`)
  const prose = paragraphs.filter(item => item !== credit)
  if (prose.length === 0) throw new CatalogError(`${path}: description is empty`)
  return { description: prose.join('\n\n'), credit }
}

function readCases(problem) {
  const dir = join(repoRoot, 'problems', problem, 'cases')
  if (!existsSync(dir)) throw new CatalogError(`${problem} has no cases`)
  const files = readdirSync(dir).filter(name => name.endsWith('.json')).sort()
  if (files.length === 0) throw new CatalogError(`${problem} has no cases`)
  return files.map(name => {
    const data = JSON.parse(readFileSync(join(dir, name), 'utf8'))
    if (typeof data.name !== 'string' || data.name.length === 0) throw new CatalogError(`${problem}/${name} needs a name`)
    if (!data.reads || typeof data.reads !== 'object' || Array.isArray(data.reads)) throw new CatalogError(`${problem}/${name} needs reads`)
    if (!data.writes || typeof data.writes !== 'object' || Array.isArray(data.writes)) throw new CatalogError(`${problem}/${name} needs writes`)
    return { name: data.name, reads: data.reads, writes: data.writes }
  })
}

function readResources(problem) {
  const path = `problems/${problem}/problem_test.go`
  const text = readFileSync(join(repoRoot, path), 'utf8')
  const at = text.indexOf('Resources:')
  if (at < 0) throw new CatalogError(`${path} has no Resources`)
  const casesAt = text.indexOf('Cases:', at)
  const slice = text.slice(at, casesAt > at ? casesAt : at + 600)
  const resources = []
  for (const match of slice.matchAll(/\{Name:\s*"([A-Za-z_][A-Za-z0-9_]*)"([^}]*)\}/g)) {
    const read = /Read:\s*true/.test(match[2])
    const write = /Write:\s*true/.test(match[2])
    if (!read && !write) throw new CatalogError(`${path} resource ${match[1]} needs Read or Write`)
    resources.push({ name: match[1], read, write })
  }
  if (resources.length === 0) throw new CatalogError(`${path} has no resources`)
  return resources
}

function costsAt(sha, rulesets, problems) {
  const costs = {}
  for (const ruleset of rulesets) {
    costs[ruleset] = {}
    for (const problem of problems) {
      const path = `problems/${problem}/solutions/${ruleset}/metric.json`
      const text = gitShow(sha, path)
      if (text == null) continue
      const data = readMetric(text, `${sha}:${path}`)
      costs[ruleset][problem] = data.cost
    }
  }
  return costs
}

function hostEntries() {
  const documents = []
  const latestPath = join(repoRoot, 'metrics/latest.json')
  if (existsSync(latestPath)) documents.push(JSON.parse(readFileSync(latestPath, 'utf8')))
  const root = join(repoRoot, 'metrics')
  for (const year of readdirSync(root, { withFileTypes: true }).filter(entry => entry.isDirectory())) {
    for (const month of readdirSync(join(root, year.name), { withFileTypes: true }).filter(entry => entry.isDirectory())) {
      for (const day of readdirSync(join(root, year.name, month.name), { withFileTypes: true }).filter(entry => entry.isDirectory())) {
        for (const sha of readdirSync(join(root, year.name, month.name, day.name), { withFileTypes: true }).filter(entry => entry.isDirectory())) {
          const path = join(root, year.name, month.name, day.name, sha.name, 'bench.json')
          if (existsSync(path)) documents.push(JSON.parse(readFileSync(path, 'utf8')))
        }
      }
    }
  }
  const entries = []
  for (const document of documents) {
    if (!Array.isArray(document.runs)) continue
    const commit = document.commit
    const stamp = stampForRunsDocument(document, gitStamp)
    if (!stamp) {
      const label = typeof commit === 'string' ? commit : 'unknown commit'
      console.log(`site: omit host entry ${label} (no author in the document and the commit is not in this clone)`)
      continue
    }
    entries.push({
      commit,
      author: stamp.author,
      timestamp: stamp.timestamp,
      machine: document.machine,
      hosts: hostsFromRuns(document.runs, commit),
    })
  }
  entries.sort((left, right) => left.timestamp.localeCompare(right.timestamp) || left.commit.localeCompare(right.commit))
  return entries
}

function hostsFromRuns(runs, commit) {
  const buckets = new Map()
  for (const run of runs) {
    const bucket = buckets.get(run.host) ?? { id: run.host, environment: run.environment, duration_ms: 0, memory_bytes: 0, runs: 0 }
    if (!Number.isInteger(run.duration_ms) || run.duration_ms < 0) throw new CatalogError(`${commit} ${run.host}: duration_ms`)
    bucket.duration_ms += run.duration_ms
    if (run.memory_bytes != null) bucket.memory_bytes = Math.max(bucket.memory_bytes, run.memory_bytes)
    bucket.runs += 1
    buckets.set(run.host, bucket)
  }
  const go = buckets.get('go')
  if (!go || go.duration_ms < 1) throw new CatalogError(`${commit}: go duration is missing`)
  return [...buckets.values()]
}

export function discoverSandboxIds() {
  const ordered = orderFrom('langs/suite.toml')
  const root = join(repoRoot, 'langs')
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue
    if (!ordered.includes(entry.name)) ordered.push(entry.name)
  }
  if (!ordered.includes('expr')) ordered.push('expr')
  return ordered
}

function readSandbox(id) {
  const readmePath = `langs/${id}/README.md`
  const abs = join(repoRoot, readmePath)
  if (!existsSync(abs)) {
    if (id !== 'expr') throw new CatalogError(`${readmePath} is missing`)
    return {
      id,
      name: 'Expr',
      description: '',
      status: 'pending',
      program: null,
      programSource: null,
      readme: '',
      cases: [],
    }
  }
  const meta = parseFrontmatter(readFileSync(abs, 'utf8'), readmePath)
  if (!meta.fields.name) throw new CatalogError(`${readmePath}: frontmatter needs name`)
  if (!meta.fields.description) throw new CatalogError(`${readmePath}: frontmatter needs description`)
  if (!meta.fields.extension) throw new CatalogError(`${readmePath}: frontmatter needs extension`)
  const program = `langs/${id}/${id}.thue`
  if (!existsSync(join(repoRoot, program))) throw new CatalogError(`${program} is missing`)
  const casesDir = join(repoRoot, 'langs', id, 'cases')
  const cases = []
  if (existsSync(casesDir)) {
    const ext = `.${meta.fields.extension}`
    for (const name of readdirSync(casesDir).filter(item => item.endsWith(ext)).sort()) {
      const path = `langs/${id}/cases/${name}`
      cases.push({
        name: name.slice(0, -ext.length),
        path,
        source: readFileSync(join(repoRoot, path), 'utf8'),
      })
    }
  }
  return {
    id,
    name: meta.fields.name,
    description: meta.fields.description,
    status: 'ready',
    program,
    programSource: readFileSync(join(repoRoot, program), 'utf8'),
    readme: meta.body.trim(),
    cases,
  }
}

function measuredAt(solution) {
  const last = solution.history.at(-1)
  if (last) return last.timestamp
  const stamp = gitStamp(solution.latest.commit)
  if (stamp) return stamp.timestamp
  throw new CatalogError(`${solution.problem}/${solution.ruleset} has no measurement time`)
}

function seriesCosts(solution) {
  const points = []
  for (const row of solution.history) {
    const metricRel = `problems/${solution.problem}/solutions/${solution.ruleset}/metric.json`
    const text = gitShow(row.commit, metricRel)
    if (text == null) continue
    const data = readMetric(text, `${row.commit}:${metricRel}`)
    points.push({ commit: row.commit, timestamp: row.timestamp, author: row.author, cost: data.cost })
  }
  return points
}

function build() {
  const problems = orderFrom('problems/suite.toml')
  const specVersion = readFileSync(join(repoRoot, 'SPEC_VERSION'), 'utf8').trim()
  const head = {
    commit: git(['rev-parse', 'HEAD']),
    author: git(['log', '-1', '--format=%an <%ae>', 'HEAD']),
    timestamp: utcTimestamp(git(['log', '-1', '--format=%aI', 'HEAD'])),
  }
  const present = new Set()
  const solutions = []
  const boundary = shallowRoots()
  let historyTruncated = false
  const omittedBoundary = new Set()
  for (const problem of problems) {
    const readmePath = `problems/${problem}/README.md`
    const readme = parseFrontmatter(readFileSync(join(repoRoot, readmePath), 'utf8'), readmePath)
    if (!readme.fields.title) throw new CatalogError(`${readmePath}: frontmatter needs title`)
    const prose = splitDescription(readme.body.trim(), readmePath)
    const directory = join(repoRoot, 'problems', problem, 'solutions')
    for (const entry of readdirSync(directory, { withFileTypes: true }).filter(item => item.isDirectory())) {
      present.add(entry.name)
      const folder = `problems/${problem}/solutions/${entry.name}`
      const meta = parseFrontmatter(readFileSync(join(repoRoot, folder, 'README.md'), 'utf8'), `${folder}/README.md`)
      const metricPath = `${folder}/metric.json`
      if (!existsSync(join(repoRoot, metricPath))) {
        console.log(`site: omit ${metricPath} (recorded when the metrics job commits it)`)
        continue
      }
      const historyResult = metricHistory(metricPath, boundary)
      if (historyResult.truncated) historyTruncated = true
      for (const commit of historyResult.omitted) omittedBoundary.add(commit)
      const history = historyResult.rows
      const latest = readMetric(readFileSync(join(repoRoot, metricPath), 'utf8'), metricPath)
      solutions.push({
        problem,
        ruleset: entry.name,
        name: entry.name === 'direct' ? 'direct' : langName(entry.name),
        title: readme.fields.title,
        description: prose.description,
        credit: prose.credit,
        entry: meta.fields.entry,
        author: meta.fields.author,
        notes: meta.body.trim(),
        source: readFileSync(join(repoRoot, folder, meta.fields.entry), 'utf8'),
        path: `${folder}/${meta.fields.entry}`,
        history,
        latest,
      })
    }
  }
  const ordered = rulesetOrder(present)
  const colors = Object.fromEntries(ordered.map((id, index) => [id, CHARTS[index]]))
  const names = Object.fromEntries(ordered.map(id => [id, id === 'direct' ? 'direct' : langName(id)]))
  const commits = []
  const seen = new Set()
  for (const solution of solutions) {
    for (const commit of solution.history) {
      if (seen.has(commit.commit)) continue
      seen.add(commit.commit)
      commits.push(commit)
    }
  }
  commits.sort((left, right) => left.timestamp.localeCompare(right.timestamp) || left.commit.localeCompare(right.commit))
  const passingNow = {}
  const costsNow = {}
  for (const ruleset of ordered) {
    passingNow[ruleset] = solutions.filter(solution => solution.ruleset === ruleset).map(solution => solution.problem)
    costsNow[ruleset] = Object.fromEntries(solutions.filter(solution => solution.ruleset === ruleset).map(solution => [solution.problem, solution.latest.cost]))
  }
  const common = commonProblems(passingNow)
  const totals = aggregateSum(costsNow, common)
  const rulesets = ordered.map(id => {
    const solved = solvedSeries(id, problems, commits, historyTruncated)
    const aggregateSeries = commits.map(commit => {
      const costs = costsAt(commit.commit, ordered, problems)
      const then = commonProblems(Object.fromEntries(ordered.map(ruleset => [ruleset, Object.keys(costs[ruleset] ?? {})])))
      const sums = aggregateSum(costs, then)
      return sums[id] === undefined ? null : { ...commit, cost: sums[id] }
    }).filter(point => point !== null)
    const passing = passingNow[id].length
    return {
      id,
      name: names[id],
      color: colors[id],
      passing,
      total: problems.length,
      common: common.length,
      aggregate: passing === 0 ? null : totals[id],
      solved,
      aggregateSeries,
    }
  })
  const catalogProblems = problems.map(id => {
    const owned = solutions.filter(solution => solution.problem === id)
    const first = owned[0]
    return {
      id,
      title: first.title,
      description: first.description,
      summary: summaryOf(first.description),
      credit: first.credit,
      resources: readResources(id),
      cases: readCases(id),
      path: `/problems/${id}`,
      canonical: `${SITE}/problems/${id}`,
      documentTitle: `Thue++ ${first.title}`,
      versions: ordered.filter(ruleset => owned.some(solution => solution.ruleset === ruleset)).map(ruleset => {
        const solution = owned.find(item => item.ruleset === ruleset)
        return {
          id: ruleset,
          name: names[ruleset],
          color: colors[ruleset],
          missing: false,
          notes: solution.notes,
          author: solution.author,
          measured: measuredAt(solution),
          solutions: [{
            id: solution.entry,
            status: 'pass',
            steps: solution.latest.applied_steps,
            cost: solution.latest.cost,
            regexEvals: solution.latest.regex_evals,
            regexMatches: solution.latest.regex_matches,
            stateBytes: solution.latest.state_bytes,
            statePeak: solution.latest.state_peak,
            ruleCount: solution.latest.rule_count,
            ruleChars: solution.latest.rule_chars,
            solution: solution.source,
            solutionPath: solution.path,
          }],
          series: solution.history.flatMap(commit => {
            const metricRel = `problems/${id}/solutions/${ruleset}/metric.json`
            const text = gitShow(commit.commit, metricRel)
            if (text == null) {
              console.log(`site: omit ${metricRel} at ${commit.commit} (blob is not in this clone)`)
              return []
            }
            const data = readMetric(text, `${commit.commit}:${metricRel}`)
            return [{
              commit: commit.commit,
              solution: solution.entry,
              cost: data.cost,
              steps: data.applied_steps,
              regexEvals: data.regex_evals,
              regexMatches: data.regex_matches,
              stateBytes: data.state_bytes,
              statePeak: data.state_peak,
              ruleCount: data.rule_count,
              ruleChars: data.rule_chars,
            }]
          }),
        }
      }),
    }
  })
  const sandboxes = discoverSandboxIds().map(id => readSandbox(id))
  const sandboxIds = sandboxes.filter(item => item.status === 'ready').map(item => item.id)
  const passingSandboxes = {}
  for (const id of sandboxIds) {
    const solved = solutions.filter(solution => solution.ruleset === id).map(solution => solution.problem)
    if (solved.length > 0) passingSandboxes[id] = solved
  }
  const sandboxCommon = commonProblems(passingSandboxes)
  const sandboxCosts = Object.fromEntries(sandboxIds.map(id => [id, Object.fromEntries(solutions.filter(solution => solution.ruleset === id).map(solution => [solution.problem, solution.latest.cost]))]))
  const sandboxTotals = aggregateSum(sandboxCosts, sandboxCommon)
  const listed = sandboxes.map(sandbox => ({
    ...sandbox,
    total: sandboxTotals[sandbox.id] === undefined ? null : sandboxTotals[sandbox.id],
    color: colors[sandbox.id] ?? null,
  }))
  const improvementEvents = []
  for (const solution of solutions) {
    const points = seriesCosts(solution)
    for (const drop of costDrops(points)) {
      const row = points.find(item => item.commit === drop.commit)
      improvementEvents.push({
        kind: 'solution',
        sandbox: solution.ruleset,
        problem: solution.problem,
        before: drop.before,
        after: drop.after,
        commit: drop.commit,
        timestamp: row.timestamp,
        author: row.author,
      })
    }
  }
  const snapshots = commits.map(commit => {
    const at = costsAt(commit.commit, sandboxIds, problems)
    const passing = {}
    for (const id of sandboxIds) {
      const solved = problems.filter(problem => Number.isInteger(at[id]?.[problem]))
      if (solved.length > 0) passing[id] = solved
    }
    const then = commonProblems(passing)
    return { ...commit, common: then, totals: aggregateSum(at, then) }
  })
  for (const drop of aggregateDrops(snapshots)) {
    const row = commits.find(item => item.commit === drop.commit)
    improvementEvents.push({
      kind: 'sandbox',
      sandbox: drop.sandbox,
      problem: null,
      before: drop.before,
      after: drop.after,
      commit: drop.commit,
      timestamp: row.timestamp,
      author: row.author,
    })
  }
  improvementEvents.sort((left, right) => right.timestamp.localeCompare(left.timestamp) || left.sandbox.localeCompare(right.sandbox) || String(left.problem).localeCompare(String(right.problem)) || left.kind.localeCompare(right.kind))
  const catalog = {
    schemaVersion: 3,
    specVersion,
    ...head,
    commits,
    commonProblems: common,
    sandboxCommon,
    rulesets,
    sandboxes: listed,
    improvements: improvementEvents,
    problems: catalogProblems,
  }
  mkdirSync(dirname(catalogPath), { recursive: true })
  writeFileSync(catalogPath, `${JSON.stringify(catalog, null, 2)}\n`)
  const summary = { schema_version: 2, entries: hostEntries() }
  writeFileSync(summaryPath, `${JSON.stringify(summary, null, 2)}\n`)
  writeSitemap(catalog)
  if (omittedBoundary.size > 0) {
    const listed = [...omittedBoundary].map(commit => commit.slice(0, 12)).join(', ')
    console.log(`site: omit metric history on the shallow clone boundary (${listed})`)
  }
  console.log(`site: ${catalog.problems.length} problems, ${rulesets.length} rulesets, ${summary.entries.length} host commits`)
}

function langName(id) {
  const path = `langs/${id}/README.md`
  const meta = parseFrontmatter(readFileSync(join(repoRoot, path), 'utf8'), path)
  if (!meta.fields.name) throw new CatalogError(`${path}: frontmatter needs name`)
  return meta.fields.name
}

function solvedSeries(ruleset, problems, commits, truncated) {
  let previous = null
  const series = []
  for (const commit of commits) {
    const passing = []
    for (const problem of problems) {
      const text = gitShow(commit.commit, `problems/${problem}/solutions/${ruleset}/metric.json`)
      if (text == null) continue
      const data = JSON.parse(text)
      if (data.pass === true) passing.push(problem)
    }
    const added = previous == null ? (truncated ? null : [...passing]) : passing.filter(problem => !previous.has(problem))
    previous = new Set(passing)
    series.push({ ...commit, count: passing.length, added })
  }
  return series
}

function writeSitemap(catalog) {
  const pages = JSON.parse(readFileSync(join(repoRoot, 'demo/src/pages.json'), 'utf8'))
  const entries = Object.values(pages).map(page => ({ loc: page.canonical, priority: page.path === '/' ? '1.0' : '0.7' }))
  for (const problem of catalog.problems) entries.push({ loc: problem.canonical, priority: '0.6' })
  for (const page of sandboxPages(catalog)) entries.push({ loc: page.canonical, priority: '0.6' })
  const hosts = hostIds(readFileSync(join(repoRoot, 'hosts.toml'), 'utf8'))
  for (const page of hostDocPages(hosts)) entries.push({ loc: page.canonical, priority: '0.5' })
  writeFileSync(join(repoRoot, 'demo/public/sitemap.xml'), sitemapXml(entries))
}

function escapeXml(value) {
  return value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
}

const entry = process.argv[1] ? pathToFileURL(process.argv[1]).href : ''
if (import.meta.url === entry) {
  try {
    build()
  } catch (error) {
    console.error(error instanceof Error ? error.message : error)
    process.exit(1)
  }
}
