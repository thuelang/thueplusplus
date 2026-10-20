import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { CatalogError, aggregateDrops, aggregateSum, assertChartLines, commonProblems, costDrops, discoverSandboxIds, historyRows, parseFrontmatter, sitemapXml, stampForRunsDocument } from './build-site.mjs'

describe('site data', () => {
  it('rejects limits in frontmatter', () => {
    assert.throws(() => parseFrontmatter('---\nruleset: direct\nlimits: 1\n---\n\nNotes.\n', 'README.md'), CatalogError)
  })

  it('sums cost over the common problems', () => {
    const common = commonProblems({
      direct: ['hello-world', 'factorial', 'fizzbuzz'],
      forth: ['hello-world', 'factorial'],
      lisp: [],
    })
    assert.deepEqual(common, ['hello-world', 'factorial'])
    assert.deepEqual(aggregateSum({
      direct: { 'hello-world': 10, factorial: 30, fizzbuzz: 100 },
      forth: { 'hello-world': 4, factorial: 6 },
    }, common), { direct: 40, forth: 10 })
  })

  it('writes a sitemap', () => {
    const xml = sitemapXml([{ loc: 'https://thuelang.org/problems/factorial', priority: '0.6' }])
    assert.match(xml, /factorial/)
  })

  it('keeps a stored author when the commit object is missing', () => {
    const stamp = stampForRunsDocument({
      commit: 'a'.repeat(40),
      author: 'Ada Lovelace <ada@example.com>',
      timestamp: '2026-10-17T14:09:55+00:00',
    }, () => { throw new Error('git should not be called') })
    assert.deepEqual(stamp, { author: 'Ada Lovelace <ada@example.com>', timestamp: '2026-10-17T14:09:55Z' })
  })

  it('omits a runs document that has no author and no git object', () => {
    assert.equal(stampForRunsDocument({ commit: 'b'.repeat(40) }, () => null), null)
  })

  it('records a cost drop only when the same solution gets cheaper', () => {
    const points = [
      { commit: 'a', cost: 10 },
      { commit: 'b', cost: 10 },
      { commit: 'c', cost: 4 },
      { commit: 'd', cost: 9 },
    ]
    assert.deepEqual(costDrops(points), [{ before: 10, after: 4, commit: 'c' }])
    assert.deepEqual(costDrops([{ commit: 'a', cost: 3 }]), [])
  })

  it('records a sandbox total drop only while the common set stays the same', () => {
    const same = ['hello-world', 'factorial']
    const events = aggregateDrops([
      { commit: 'a', common: same, totals: { forth: 20, lisp: 30 } },
      { commit: 'b', common: same, totals: { forth: 12, lisp: 30 } },
      { commit: 'c', common: ['hello-world'], totals: { forth: 1, lisp: 1 } },
    ])
    assert.deepEqual(events, [{ sandbox: 'forth', before: 20, after: 12, commit: 'b' }])
  })

  it('discovers sandboxes from langs/ and always includes expr', () => {
    const ids = discoverSandboxIds()
    assert.ok(ids.includes('forth'))
    assert.ok(ids.includes('lisp'))
    assert.ok(ids.includes('basic'))
    assert.ok(ids.includes('expr'))
    assert.equal(ids.indexOf('expr') > ids.indexOf('forth'), true)
  })

  it('fails the build when a sandbox total has no summed line', () => {
    assert.throws(() => assertChartLines({
      sandboxCommon: ['hello-world'],
      commits: [{ commit: 'a', timestamp: '2026-10-20T00:00:00Z' }],
      sandboxes: [{ id: 'forth', name: 'Forth', total: 10, color: '#c2410c' }],
      problems: [{ id: 'hello-world', versions: [{ id: 'forth', series: [], solutions: [] }] }],
    }), /forth has total 10 and no summed cost line/)
  })

  it('drops shallow boundary commits instead of treating them as measurements', () => {
    const boundary = new Set(['b'.repeat(40)])
    const log = [
      `${'a'.repeat(40)}\t2026-10-17T20:08:46Z\tAda Lovelace <ada@example.com>`,
      `${'b'.repeat(40)}\t2026-10-17T15:00:00Z\tShallow Root <root@example.com>`,
    ].join('\n')
    const history = historyRows(log, boundary)
    assert.equal(history.truncated, true)
    assert.deepEqual(history.omitted, ['b'.repeat(40)])
    assert.deepEqual(history.rows.map(row => row.commit), ['a'.repeat(40)])
  })
})
