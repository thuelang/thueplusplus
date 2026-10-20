import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const repoRoot = fileURLToPath(new URL('../../', import.meta.url))

function git(args) {
  return execFileSync('git', args, { cwd: repoRoot, encoding: 'utf8' }).trim()
}

function shallowFile() {
  const rel = git(['rev-parse', '--git-path', 'shallow'])
  return rel.startsWith('/') ? rel : join(repoRoot, rel)
}

function isShallow() {
  const path = shallowFile()
  return existsSync(path) && readFileSync(path, 'utf8').trim() !== ''
}

if (!isShallow()) {
  console.log('site: clone has full history')
} else {
  // Vercel checks out a shallow clone and does not configure a remote.
  // `git fetch --unshallow` then exits 0 and leaves the history shallow, so a
  // metric last changed before that window disappears from the cost chart.
  const sha = git(['rev-parse', 'HEAD'])
  const branch = git(['rev-parse', '--abbrev-ref', 'HEAD'])
  const target = branch === 'HEAD' ? 'master' : branch
  const owner = process.env.PUBLIC_VERCEL_GIT_REPO_OWNER
  const slug = process.env.PUBLIC_VERCEL_GIT_REPO_SLUG
  const provider = process.env.PUBLIC_VERCEL_GIT_PROVIDER
  const url = owner && slug && provider
    ? `https://${provider}.com/${owner}/${slug}.git`
    : 'https://github.com/thuelang/thueplusplus.git'
  console.log(`site: fetching full history for the cost chart from ${url}`)
  execFileSync('git', ['pull', '--ff-only', '--unshallow', url, `${sha}:${target}`], { cwd: repoRoot, stdio: 'inherit' })
  if (isShallow()) throw new Error('site: history is still shallow after fetching the cost chart')
}
