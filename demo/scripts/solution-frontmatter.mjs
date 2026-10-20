/** Title and author block at the top of a solution file. Mirrors metrics/solution_frontmatter.py. */

const SOLUTION_KEYS = new Set(['title', 'author'])
const LIMIT_KEYS = new Set([
  'limits',
  'max_steps',
  'max_evals',
  'max_state_bytes',
  'timeout',
  'timeout_seconds',
  'memory_cap_bytes',
  'memory',
])
export const PREFIX_BY_EXTENSION = {
  thue: '',
  lisp: '; ',
  fth: '\\ ',
  bas: 'REM ',
  expr: '// ',
}
const SNIFF_ORDER = ['expr', 'lisp', 'fth', 'bas', 'thue']

export class SolutionFrontmatterError extends Error {}

export function slugify(title) {
  const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) throw new SolutionFrontmatterError(`title ${JSON.stringify(title)} has an empty slug`)
  return slug
}

function opener(prefix) {
  return Buffer.from(`${prefix}---\n`, 'ascii')
}

function closer(prefix) {
  return Buffer.from(`${prefix}---`, 'ascii')
}

function matchingPrefix(data, extension) {
  if (extension != null) {
    if (!Object.hasOwn(PREFIX_BY_EXTENSION, extension)) return null
    const prefix = PREFIX_BY_EXTENSION[extension]
    if (data.subarray(0, opener(prefix).length).equals(opener(prefix))) return prefix
    return null
  }
  for (const ext of SNIFF_ORDER) {
    const prefix = PREFIX_BY_EXTENSION[ext]
    const head = opener(prefix)
    if (data.subarray(0, head.length).equals(head)) return prefix
  }
  return null
}

function parseField(content) {
  if (/^\s/.test(content)) throw new SolutionFrontmatterError('solution: nested frontmatter is invalid')
  const split = content.indexOf(':')
  if (split < 0) throw new SolutionFrontmatterError(`solution: frontmatter line ${JSON.stringify(content)} has no key`)
  const key = content.slice(0, split).trim()
  const value = content.slice(split + 1).trim()
  if (LIMIT_KEYS.has(key)) throw new SolutionFrontmatterError(`solution: ${key} is global and cannot appear in frontmatter`)
  if (!key || !value) throw new SolutionFrontmatterError(`solution: frontmatter key ${JSON.stringify(key)} must be a new non-empty field`)
  if ('{[|&'.includes(value[0])) throw new SolutionFrontmatterError('solution: nested frontmatter is invalid')
  return [key, value]
}

function fieldsFrom(lines, prefix) {
  const pre = Buffer.from(prefix, 'ascii')
  const fields = {}
  for (const raw of lines) {
    if (!raw.subarray(0, pre.length).equals(pre)) throw new SolutionFrontmatterError(`front matter line ${JSON.stringify(raw.toString('utf8'))} is not a comment`)
    const content = raw.subarray(pre.length).toString('utf8')
    if (content.includes('::')) throw new SolutionFrontmatterError("front matter value contains '::'")
    if (content === '') continue
    const [key, value] = parseField(content)
    if (!SOLUTION_KEYS.has(key)) throw new SolutionFrontmatterError(`unknown front matter key ${JSON.stringify(key)}`)
    if (Object.hasOwn(fields, key)) throw new SolutionFrontmatterError(`front matter key ${JSON.stringify(key)} must be a new non-empty field`)
    fields[key] = value
  }
  return fields
}

export function splitSolution(data, extension) {
  const buffer = Buffer.isBuffer(data) ? data : Buffer.from(data)
  const prefix = matchingPrefix(buffer, extension)
  if (prefix == null) return { fields: {}, code: buffer }
  const head = opener(prefix)
  const end = closer(prefix)
  let offset = head.length
  const raw = []
  while (true) {
    const newline = buffer.indexOf(0x0a, offset)
    if (newline < 0) {
      const line = buffer.subarray(offset)
      if (line.equals(end)) return { fields: fieldsFrom(raw, prefix), code: Buffer.alloc(0) }
      throw new SolutionFrontmatterError('front matter is not closed')
    }
    const line = buffer.subarray(offset, newline)
    if (line.equals(end)) return { fields: fieldsFrom(raw, prefix), code: buffer.subarray(newline + 1) }
    raw.push(line)
    offset = newline + 1
  }
}
