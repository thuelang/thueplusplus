import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { CatalogError, aggregateSum, commonProblems, historyRows, parseFrontmatter, sitemapXml, stampForRunsDocument } from './build-site.mjs'

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
