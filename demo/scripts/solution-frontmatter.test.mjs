import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { PREFIX_BY_EXTENSION, SolutionFrontmatterError, slugify, splitSolution } from './solution-frontmatter.mjs'

function block(prefix, lines, body) {
  return Buffer.from(`${prefix}---\n${lines.map(line => `${prefix}${line}`).join('\n')}\n${prefix}---\n${body}`)
}

describe('solution front matter', () => {
  it('slugifies a title', () => {
    assert.equal(slugify('Loop with mod 15'), 'loop-with-mod-15')
    assert.equal(slugify('  Mod 400, 4, and 100  '), 'mod-400-4-and-100')
  })

  it('reads each comment syntax and leaves the code bytes', () => {
    for (const [extension, prefix] of Object.entries(PREFIX_BY_EXTENSION)) {
      const body = 'code\n'
      const both = block(prefix, ['title: Add', 'author: Ada <ada@example.com>'], body)
      const parsed = splitSolution(both, extension)
      assert.equal(parsed.fields.title, 'Add')
      assert.equal(parsed.fields.author, 'Ada <ada@example.com>')
      assert.equal(parsed.code.toString('utf8'), body)
      const titleOnly = splitSolution(block(prefix, ['title: Add'], body), extension)
      assert.deepEqual(titleOnly.fields, { title: 'Add' })
      assert.deepEqual(splitSolution(Buffer.from(body), extension).fields, {})
    }
  })

  it('rejects an unknown key and a double colon', () => {
    for (const [extension, prefix] of Object.entries(PREFIX_BY_EXTENSION)) {
      assert.throws(() => splitSolution(block(prefix, ['title: Add', 'limits: 1'], 'code\n'), extension), SolutionFrontmatterError)
      assert.throws(() => splitSolution(block(prefix, ['title: foo::bar'], 'code\n'), extension), SolutionFrontmatterError)
    }
  })
})
