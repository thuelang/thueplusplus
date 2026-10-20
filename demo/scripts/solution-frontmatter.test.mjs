import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { SolutionFrontmatterError, slugify } from './solution-frontmatter.mjs'

describe('solution title slug', () => {
  it('slugifies a title', () => {
    assert.equal(slugify('Loop with mod 15'), 'loop-with-mod-15')
    assert.equal(slugify('Hard-coded lines'), 'hard-coded-lines')
    assert.equal(slugify('  Mod 400, 4, and 100  '), 'mod-400-4-and-100')
    assert.throws(() => slugify('---'), SolutionFrontmatterError)
  })
})
