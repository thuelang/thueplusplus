import { execFileSync, spawn, spawnSync } from 'node:child_process'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const demo = fileURLToPath(new URL('..', import.meta.url))
const repo = fileURLToPath(new URL('../..', import.meta.url))
const tests = {
  direct: ['direct load', 'hash-direct'],
  history: ['back and forward', 'hash-history'],
  cross: ['cross-route', 'hash-cross'],
  reduced: ['reduced motion', 'hash-reduced'],
  spy: ['scroll spy', 'hash-spy'],
  unknown: ['unknown hash', 'hash-unknown'],
  parent: ['logical parent', 'hash-parent'],
}

const name = process.argv[2]
const spec = tests[name]
if (!spec) {
  console.error('usage: node demo/scripts/hash-gate.mjs <direct|history|cross|reduced|spy|unknown|parent>')
  process.exit(1)
}

function stampKey() {
  const head = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: repo, encoding: 'utf8' }).trim()
  const dirty = execFileSync('git', ['status', '--porcelain', '--', 'demo', 'CHANGELOG.md'], { cwd: repo, encoding: 'utf8' }).trim()
  return `${head}\n${dirty}`
}

const stampPath = `${demo}/dist/.stamp`
const key = stampKey()
let rebuilt = false
if (!existsSync(stampPath) || readFileSync(stampPath, 'utf8') !== key) {
  const build = spawnSync('npx', ['vite', 'build'], { cwd: demo, encoding: 'utf8' })
  if (build.status !== 0) {
    process.stderr.write(build.stdout ?? '')
    process.stderr.write(build.stderr ?? '')
    process.exit(build.status ?? 1)
  }
  writeFileSync(stampPath, key)
  rebuilt = true
}

function previewUp() {
  try {
    execFileSync('curl', ['-sf', '-o', '/dev/null', 'http://127.0.0.1:4173/'])
    return true
  } catch {
    return false
  }
}

if (rebuilt || !previewUp()) {
  try {
    const pid = readFileSync('/tmp/hash-preview.pid', 'utf8').trim()
    if (pid) process.kill(Number(pid))
  } catch { /* no previous preview */ }
  const child = spawn('npx', ['vite', 'preview', '--host', '127.0.0.1', '--port', '4173', '--strictPort'], {
    cwd: demo,
    detached: true,
    stdio: 'ignore',
  })
  child.unref()
  writeFileSync('/tmp/hash-preview.pid', String(child.pid))
  let ready = false
  for (let attempt = 0; attempt < 40; attempt += 1) {
    if (previewUp()) {
      ready = true
      break
    }
    execFileSync('sleep', ['0.25'])
  }
  if (!ready) {
    console.error('preview did not start')
    process.exit(1)
  }
}

const result = spawnSync('npx', ['playwright', 'test', '-c', 'playwright.hash.config.ts', 'e2e/hash-target.spec.ts', '-g', spec[0]], {
  cwd: demo,
  encoding: 'utf8',
})
if (result.status !== 0 || !result.stdout?.includes(spec[1])) {
  process.stderr.write(result.stdout ?? '')
  process.stderr.write(result.stderr ?? '')
  process.exit(result.status || 1)
}
console.log(spec[1])
