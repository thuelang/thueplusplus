import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { hostDocPages, hostIds, problemPages, readGeneratedCatalog, sandboxPages } from './build-site.mjs'

const dist = new URL('../dist/', import.meta.url).pathname
const pages = JSON.parse(readFileSync(new URL('../src/pages.json', import.meta.url), 'utf8'))
const catalog = readGeneratedCatalog()
const problems = problemPages(catalog)
const sandboxes = sandboxPages(catalog)
const hosts = hostDocPages(hostIds(readFileSync(new URL('../../hosts.toml', import.meta.url), 'utf8')))
const requiredAssets = ['robots.txt', 'sitemap.xml', 'og-image.png', 'favicon.svg', 'favicon.png', 'icon-192.png', 'icon-512.png', 'apple-touch-icon.png', 'brand/thue-mark.svg']
const staticRoutes = [...Object.values(pages).filter(page => page.path !== '/').map(page => page.path.replace(/^\//, '')), ...problems.map(page => page.path.replace(/^\//, '')), ...sandboxes.map(page => page.path.replace(/^\//, '')), ...hosts.map(page => page.path.replace(/^\//, '')), 'embed']

for (const asset of requiredAssets) {
  const path = join(dist, asset)
  const stat = statSync(path)
  if (!stat.isFile() || stat.size === 0) {
    throw new Error(`demo production build is missing non-empty ${asset}`)
  }
}

const index = readFileSync(join(dist, 'index.html'), 'utf8')
const fallback = readFileSync(join(dist, '404.html'), 'utf8')
if (fallback !== index) {
  throw new Error('demo production dist 404.html must match index.html for unknown direct SPA route fallback')
}
if (!index.includes('src="/assets/') || !index.includes('href="/assets/')) {
  throw new Error('demo production index must use origin-root asset URLs so nested static routes load assets from the site root')
}
if (!index.includes('rel="icon" type="image/svg+xml" href="/favicon.svg"')) {
  throw new Error('demo production index must link the Rex SVG favicon')
}
if (!index.includes(pages.home.title) || !index.includes(pages.home.canonical)) {
  throw new Error('demo production index must include the landing heading and canonical URL')
}
if (index.includes('modulepreload" crossorigin href="/assets/editor-monaco-')) {
  throw new Error('demo production index must not eagerly modulepreload the Monaco editor chunk')
}

for (const route of staticRoutes) {
  const routePath = join(dist, route, 'index.html')
  if (!existsSync(routePath)) {
    throw new Error(`demo production dist is missing ${route}/index.html for direct route loads`)
  }
  const routeIndex = readFileSync(routePath, 'utf8')
  if (!routeIndex.includes('src="/assets/') || !routeIndex.includes('href="/assets/')) {
    throw new Error(`demo production dist ${route}/index.html must use origin-root asset URLs so nested static routes load assets from the site root`)
  }
}

const removed = ['playground', 'projects', 'metrics', 'contribute', 'autoresearch', 'docs/guides', 'docs/language', 'install/go', 'rulesets/direct', 'problems/hello-world/direct']
for (const route of removed) {
  if (existsSync(join(dist, route, 'index.html'))) {
    throw new Error(`${route} must not be prerendered`)
  }
}
const embedIndex = readFileSync(join(dist, 'embed', 'index.html'), 'utf8')
if (!embedIndex.includes('noindex,follow')) {
  throw new Error('embed route index must be noindexed')
}
for (const page of [...Object.values(pages), ...problems, ...sandboxes, ...hosts]) {
  if (page.path === '/') continue
  const routeIndex = readFileSync(join(dist, page.path.replace(/^\//, ''), 'index.html'), 'utf8')
  if (!routeIndex.includes(page.title) || !routeIndex.includes(page.canonical)) {
    throw new Error(`${page.path} index must include its heading and canonical URL`)
  }
}
if (problems.length === 0) {
  throw new Error('demo production dist is missing prerendered problem pages')
}
const sitemap = readFileSync(join(dist, 'sitemap.xml'), 'utf8')
for (const problem of problems) {
  if (!sitemap.includes(problem.canonical)) {
    throw new Error(`sitemap.xml is missing ${problem.canonical}`)
  }
}
for (const page of [...sandboxes, ...hosts]) {
  if (!sitemap.includes(page.canonical)) {
    throw new Error(`sitemap.xml is missing ${page.canonical}`)
  }
}
if (sitemap.includes('/playground') || sitemap.includes('/rulesets/') || sitemap.includes('/projects')) {
  throw new Error('sitemap.xml still lists a removed route')
}

const jsFiles = readdirSync(join(dist, 'assets')).filter(name => name.endsWith('.js'))
for (const fileName of jsFiles) {
  const text = readFileSync(join(dist, 'assets', fileName), 'utf8')
  if (!text.includes('/thue.wasm') && !text.includes('/wasm_exec.js')) {
    continue
  }
  if (text.includes('new Worker("data:text/javascript') || text.includes("new Worker('data:text/javascript")) {
    throw new Error(`${fileName} inlines the browser worker as a data: URL`)
  }
}

console.log('demo production dist smoke ok')
