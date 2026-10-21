import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { describe, it } from 'node:test'
import { fileURLToPath } from 'node:url'

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '../..')
const catalog = JSON.parse(readFileSync(join(repoRoot, 'demo/src/generated/catalog.json'), 'utf8'))
const history = JSON.parse(readFileSync(join(repoRoot, 'metrics/versions.json'), 'utf8'))

function blobExists(sha, solutionPath) {
  execFileSync('git', ['cat-file', '-e', `${sha}:${solutionPath}`], { cwd: repoRoot, stdio: 'ignore' })
}

describe('measuring commits', () => {
  it('uses the metrics history commit for the factorial Lisp point', () => {
    const entry = Object.values(history.versions).find(item => item.problem === 'factorial' && item.ruleset === 'lisp' && item.timestamp === '2026-10-17_13-58-55')
    assert.ok(entry?.commit)
    assert.equal(entry.commit.startsWith('75fa4d3'), false)
    const lisp = catalog.problems.find(problem => problem.id === 'factorial').versions.find(version => version.id === 'lisp')
    const point = lisp.series.find(item => item.cost === entry.cost)
    assert.equal(point.sha, entry.commit)
    blobExists(point.sha, point.solutionPath)
  })

  it('points every solution link at a blob that exists at the measuring commit', () => {
    let seen = 0
    for (const problem of catalog.problems) {
      for (const version of problem.versions) {
        for (const point of version.series) {
          assert.match(point.sha, /^[0-9a-f]{40}$/)
          assert.equal(point.sha.startsWith('75fa4d3'), false)
          blobExists(point.sha, point.solutionPath)
          seen += 1
        }
      }
    }
    assert.ok(seen > 0)
  })
})
