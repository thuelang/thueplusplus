import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const [fullRoot, ...shallowRoots] = process.argv.slice(2)
if (!fullRoot || shallowRoots.length === 0) {
  console.error('usage: check-shallow-parity.mjs <full-repo> <shallow-repo>...')
  process.exit(2)
}

function load(root) {
  return {
    catalog: JSON.parse(readFileSync(join(root, 'demo/src/generated/catalog.json'), 'utf8')),
    summary: JSON.parse(readFileSync(join(root, 'demo/src/generated/summary.json'), 'utf8')),
  }
}

function same(left, right) {
  return JSON.stringify(left) === JSON.stringify(right)
}

const full = load(fullRoot)
const failures = []
const notes = []

function fail(message) {
  failures.push(message)
}

for (const root of shallowRoots) {
  const data = load(root)
  const fullEntries = new Map(full.summary.entries.map(entry => [entry.commit, entry]))
  const seen = new Set()
  for (const entry of data.summary.entries) {
    seen.add(entry.commit)
    const expected = fullEntries.get(entry.commit)
    if (!expected) fail(`${root}: summary commit ${entry.commit} is not in the full clone`)
    else if (!same(entry, expected)) fail(`${root}: summary ${entry.commit} differs from the full clone`)
  }
  const omittedEntries = full.summary.entries.filter(entry => !seen.has(entry.commit)).map(entry => entry.commit)
  notes.push(`${root}: host entries ${data.summary.entries.length}/${full.summary.entries.length}, omitted ${omittedEntries.map(commit => commit.slice(0, 12)).join(', ') || 'none'}`)

  for (const key of ['schemaVersion', 'specVersion', 'commit', 'author', 'timestamp']) {
    if (data.catalog[key] !== full.catalog[key]) fail(`${root}: catalog ${key} differs`)
  }
  const fullCommits = new Map(full.catalog.commits.map(commit => [commit.commit, commit]))
  const seenCommits = new Set()
  for (const commit of data.catalog.commits) {
    seenCommits.add(commit.commit)
    const expected = fullCommits.get(commit.commit)
    if (!expected) fail(`${root}: catalog commit ${commit.commit} is not in the full clone`)
    else if (!same(commit, expected)) fail(`${root}: catalog commit ${commit.commit.slice(0, 12)} metadata differs`)
  }
  notes.push(`${root}: chart commits ${data.catalog.commits.length}/${full.catalog.commits.length}, omitted ${full.catalog.commits.filter(commit => !seenCommits.has(commit.commit)).map(commit => commit.commit.slice(0, 12)).join(', ') || 'none'}`)

  if (data.catalog.problems.length !== full.catalog.problems.length) fail(`${root}: problem count differs`)
  for (let index = 0; index < Math.min(data.catalog.problems.length, full.catalog.problems.length); index += 1) {
    const left = full.catalog.problems[index]
    const right = data.catalog.problems[index]
    if (left.id !== right.id) {
      fail(`${root}: problem order ${left.id} vs ${right.id}`)
      continue
    }
    if (left.description !== right.description || left.credit !== right.credit || !same(left.cases, right.cases) || !same(left.resources, right.resources)) {
      fail(`${root}: ${left.id} problem text or cases differ`)
    }
    if (right.versions.length !== left.versions.length) fail(`${root}: ${left.id} version count differs`)
    const fullVersions = new Map(left.versions.map(version => [version.id, version]))
    for (const version of right.versions) {
      const expected = fullVersions.get(version.id)
      if (!expected) {
        fail(`${root}: ${left.id} version ${version.id} is not in the full clone`)
        continue
      }
      if (!same(version.solutions, expected.solutions)) fail(`${root}: ${left.id}/${version.id} current solution differs`)
      const fullPoints = new Map(expected.series.map(point => [point.commit, point]))
      for (const point of version.series) {
        const got = fullPoints.get(point.commit)
        if (!got) fail(`${root}: ${left.id}/${version.id} series ${point.commit} is not in the full clone`)
        else if (!same(point, got)) fail(`${root}: ${left.id}/${version.id} series ${point.commit.slice(0, 12)} differs`)
      }
    }
  }

  if (data.catalog.rulesets.length !== full.catalog.rulesets.length) fail(`${root}: ruleset count differs`)
  for (let index = 0; index < Math.min(data.catalog.rulesets.length, full.catalog.rulesets.length); index += 1) {
    const left = full.catalog.rulesets[index]
    const right = data.catalog.rulesets[index]
    for (const key of ['id', 'name', 'color', 'passing', 'total', 'common', 'aggregate']) {
      if (left[key] !== right[key]) fail(`${root}: ruleset ${left.id ?? right.id} ${key} differs`)
    }
    const fullSolved = new Map(left.solved.map(point => [point.commit, point]))
    for (const point of right.solved) {
      const expected = fullSolved.get(point.commit)
      if (!expected) {
        fail(`${root}: solved ${right.id} ${point.commit} is not in the full clone`)
        continue
      }
      if (point.count !== expected.count || point.author !== expected.author || point.timestamp !== expected.timestamp) {
        fail(`${root}: solved ${right.id} ${point.commit.slice(0, 12)} count or stamp differs`)
      }
      if (point.added != null && !same(point.added, expected.added)) {
        fail(`${root}: solved ${right.id} ${point.commit.slice(0, 12)} added problems differ`)
      }
    }
    const fullAggregate = new Map(left.aggregateSeries.map(point => [point.commit, point]))
    for (const point of right.aggregateSeries) {
      const expected = fullAggregate.get(point.commit)
      if (!expected) fail(`${root}: aggregate ${right.id} ${point.commit} is not in the full clone`)
      else if (!same(point, expected)) fail(`${root}: aggregate ${right.id} ${point.commit.slice(0, 12)} differs`)
    }
  }
}

for (const note of notes) console.error(note)
if (failures.length > 0) {
  for (const failure of failures) console.error(failure)
  process.exit(1)
}
console.log('shallow parity: depth 10 and depth 1 match the full clone where the commits are present')
