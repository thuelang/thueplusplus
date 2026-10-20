import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const repoRoot = fileURLToPath(new URL('../../', import.meta.url))

function git(args) {
  return execFileSync('git', args, { cwd: repoRoot, encoding: 'utf8' }).trim()
}

const rel = git(['rev-parse', '--git-path', 'shallow'])
const shallow = rel.startsWith('/') ? rel : join(repoRoot, rel)
if (!existsSync(shallow) || readFileSync(shallow, 'utf8').trim() === '') {
  console.log('site: clone has full history')
} else {
  console.log('site: fetching full history for the cost chart')
  execFileSync('git', ['fetch', '--unshallow'], { cwd: repoRoot, stdio: 'inherit' })
}
