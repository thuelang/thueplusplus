import { execFileSync } from 'node:child_process'
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { commonProblems, discoverSandboxIds, readGeneratedCatalog } from './build-site.mjs'

const repoRoot = fileURLToPath(new URL('../../', import.meta.url))
const demoSrc = join(repoRoot, 'demo/src')
const name = process.argv[2]
if (!name) {
  console.error('usage: node demo/scripts/site-gates.mjs <gate>')
  process.exit(1)
}

const handlers = {
  common,
  improvements,
  sandboxes,
  expr,
  'problems-index': problemsIndex,
  'problem-chart': problemChart,
  'solutions-table': solutionsTable,
  install,
  docs,
  nav,
  removed,
  charts,
  copy,
  intersection,
  discover,
  changelog,
  shots,
  pr,
  production,
}

const handler = handlers[name]
if (!handler) {
  console.error(`unknown gate ${name}`)
  process.exit(1)
}
handler()

function fail(message) {
  console.error(message)
  process.exit(1)
}

function read(path) {
  return readFileSync(join(repoRoot, path), 'utf8')
}

function catalog() {
  return readGeneratedCatalog()
}

function source(path) {
  return readFileSync(join(demoSrc, path), 'utf8')
}

function solvedBy(data, sandboxId) {
  return data.problems.filter(problem => problem.versions.some(version => version.id === sandboxId)).map(problem => problem.id)
}

function common() {
  const data = catalog()
  const passing = {}
  for (const sandbox of data.sandboxes) {
    if (sandbox.status !== 'ready') continue
    const solved = solvedBy(data, sandbox.id)
    if (solved.length > 0) passing[sandbox.id] = solved
  }
  const expected = commonProblems(passing)
  if (expected.length === 0) fail('common set is empty')
  if (expected.join('\0') !== data.sandboxCommon.join('\0')) fail(`sandboxCommon ${data.sandboxCommon.join(',')} != ${expected.join(',')}`)
  const home = source('pages/HomePage.vue')
  if (!home.includes('sandboxBars()') || !home.includes('catalog.sandboxCommon')) fail('home chart is not driven by the catalog')
  if (!home.includes('data-test="featured-sandboxes"') || !home.includes('data-test="cost-chart"') && !home.includes('<CostChart')) fail('home has no cost chart')
  const listed = data.sandboxes.filter(sandbox => sandbox.total !== null)
  if (listed.length === 0) fail('no sandbox has a total')
  for (const sandbox of listed) {
    let sum = 0
    for (const id of data.sandboxCommon) {
      const problem = data.problems.find(item => item.id === id)
      const version = problem?.versions.find(item => item.id === sandbox.id)
      const cost = version?.solutions[0]?.cost
      if (!Number.isInteger(cost)) fail(`${sandbox.id} has no cost on ${id}`)
      sum += cost
    }
    if (sum !== sandbox.total) fail(`${sandbox.id} total ${sandbox.total} != ${sum}`)
  }
  console.log('common ok')
}

function improvements() {
  const home = source('pages/HomePage.vue')
  if (!home.includes('v-if="improvements.length"')) fail('home always shows the improvements list')
  const data = catalog()
  for (const event of data.improvements) {
    if (!(event.after < event.before)) fail(`${event.commit} is not a decrease`)
    if (event.kind !== 'solution' && event.kind !== 'sandbox') fail(`bad improvement kind ${event.kind}`)
  }
  const builder = read('demo/scripts/build-site.mjs')
  if (!builder.includes('export function costDrops') || !builder.includes('export function aggregateDrops')) fail('improvement rules are missing')
  console.log('improvements ok')
}

function sandboxes() {
  const data = catalog()
  const page = source('pages/SandboxesPage.vue')
  const detail = source('pages/SandboxPage.vue')
  if (!page.includes('catalog.sandboxes')) fail('sandbox index is not the catalog')
  if (!detail.includes('sandbox-guide')) fail('sandbox page does not render the guide')
  for (const id of ['lisp', 'forth', 'basic']) {
    const sandbox = data.sandboxes.find(item => item.id === id)
    if (!sandbox || sandbox.status !== 'ready') fail(`${id} is not a ready sandbox`)
    const readme = read(`langs/${id}/README.md`)
    const body = readme.slice(readme.indexOf('\n---\n') + 5).trim().replace(/^#[^\n]*\n+/, '')
    const sentence = body.trim().slice(0, 40)
    if (sentence.length < 24 || !sandbox.readme.includes(sentence.slice(0, 24))) fail(`${id} guide is not the langs readme`)
    if (sandbox.cases.length === 0) fail(`${id} has no runnable case`)
    if (!sandbox.programSource) fail(`${id} has no interpreter source`)
  }
  console.log('sandboxes ok')
}

function expr() {
  const data = catalog()
  const sandbox = data.sandboxes.find(item => item.id === 'expr')
  if (!sandbox) fail('expr is missing from the catalog')
  const page = source('pages/SandboxPage.vue')
  const pending = page.slice(page.indexOf("sandbox.status === 'pending'"), page.indexOf('<DocPage v-else'))
  if (pending.includes('PlaygroundSurface') || pending.includes('MarkdownBody')) fail('pending expr page renders a guide or a playground')
  const readme = join(repoRoot, 'langs/expr/README.md')
  if (!existsSync(readme)) {
    if (sandbox.status !== 'pending' || sandbox.readme !== '' || sandbox.cases.length !== 0) fail('missing langs/expr is not pending')
  } else if (sandbox.status !== 'ready' || sandbox.readme.length === 0) {
    fail('langs/expr exists but the page is not ready')
  }
  console.log('expr ok')
}

function problemsIndex() {
  const data = catalog()
  const page = source('pages/ProblemsPage.vue')
  if (!page.includes('data-test="problem-card"') || !page.includes('<CostChart') || !page.includes('problem.summary')) fail('problem cards are missing a chart or a description')
  if (data.problems.length === 0) fail('no problems')
  for (const problem of data.problems) {
    if (!problem.summary || !problem.description) fail(`${problem.id} has no description`)
    if (!problem.versions.some(version => Number.isInteger(version.solutions[0]?.cost))) fail(`${problem.id} has no cost`)
  }
  console.log('problems-index ok')
}

function problemChart() {
  const chart = source('components/CostChart.vue')
  if (!chart.includes('<svg') || !chart.includes('<circle') || !chart.includes('runningMin') || !chart.includes("ease('out'")) fail('problem chart is not an inline SVG with a running minimum')
  if (chart.includes('<canvas') || chart.includes('@unovis') || chart.includes('recharts')) fail('problem chart uses a canvas or a chart library')
  const data = catalog()
  const problem = data.problems.find(item => item.id === 'factorial') ?? data.problems[0]
  if (!problem) fail('no problem to chart')
  const ids = new Set(problem.versions.map(version => version.id))
  if (!ids.has('direct')) fail(`${problem.id} chart has no direct series`)
  for (const version of problem.versions) {
    if (!version.color.startsWith('var(--chart-')) fail(`${version.id} has no chart color`)
    if (version.series.length === 0) fail(`${version.id} has no points`)
    for (const point of version.series) {
      const commit = data.commits.find(item => item.commit === point.commit)
      if (!commit || Number.isNaN(Date.parse(commit.timestamp))) fail(`${point.commit} has no commit time`)
      if (!Number.isInteger(point.cost)) fail(`${version.id} point has no cost`)
    }
  }
  console.log('problem-chart ok')
}

function solutionsTable() {
  const page = source('pages/ProblemPage.vue')
  if (!page.includes('data-test="solutions-table"') || !page.includes('data-test="solution-link"') || !page.includes('sourceUrl')) fail('solutions table does not link to the source')
  if (!page.includes("toggle('cost')") || !page.includes("toggle('author')") || !page.includes("toggle('date')")) fail('solutions table is not sortable')
  const data = catalog()
  const problem = data.problems.find(item => item.id === 'factorial') ?? data.problems[0]
  const lisp = problem.versions.find(version => version.id === 'lisp') ?? problem.versions[0]
  const path = lisp.solutions[0]?.solutionPath
  if (!path || !path.startsWith('problems/')) fail('solution path is not a repository file')
  console.log('solutions-table ok')
}

function install() {
  const page = source('pages/InstallPage.vue')
  const hosts = source('hosts.ts')
  if (!page.includes('siteHosts') || !page.includes('host.href')) fail('install page does not link each host')
  if (!hosts.includes('href: `/docs/${id}/install`')) fail('host links are not /docs/<host>/install')
  const text = read('hosts.toml')
  const ids = [...text.matchAll(/\{\s*id\s*=\s*"([^"]+)"/g)].map(match => match[1])
  if (ids.length === 0) fail('hosts.toml has no hosts')
  for (const id of ids) {
    if (!hosts.includes(id)) fail(`install registry is missing ${id}`)
  }
  console.log('install ok')
}

function docs() {
  const page = source('pages/HostDocPage.vue')
  const index = source('pages/DocsPage.vue')
  for (const section of ['install', 'api', 'examples']) {
    if (!page.includes(`section === '${section}'`) && !page.includes(`section !== '${section}'`)) fail(`host docs have no ${section} section`)
    if (!index.includes(`/docs/\${host.id}/${section}`)) fail(`docs index does not link ${section}`)
  }
  if (!page.includes('model.library') || !page.includes('model.api') || !page.includes('model.install')) fail('host docs are not grounded in the install copy')
  const installCopy = source('install.ts')
  if (!installCopy.includes('go get github.com/thuelang/thueplusplus/go@main')) fail('go install copy is missing')
  console.log('docs ok')
}

function nav() {
  const links = source('nav.ts')
  const header = source('components/SiteHeader.vue')
  if (!links.includes("title: 'Sandboxes'") || !links.includes("title: 'Problems'") || !links.includes("title: 'Install'") || !links.includes("title: 'Docs'")) {
    fail('nav is missing a required link')
  }
  if (links.includes('Playground') || links.includes('Contribute') || links.includes('Projects') || links.includes('Metrics')) fail('nav still has a removed link')
  const entries = [...links.matchAll(/title: '([^']+)'/g)].map(match => match[1])
  if (entries.join(',') !== 'Sandboxes,Problems,Install,Docs') fail(`nav order is ${entries.join(',')}`)
  if (!header.includes('>Thue++</RouterLink>')) fail('header logo is not Thue++')
  console.log('nav ok')
}

function removed() {
  const router = source('router.ts')
  const paths = [...router.matchAll(/path: '([^']+)'/g)].map(match => match[1])
  const gone = ['/playground', '/projects', '/metrics', '/contribute', '/autoresearch', '/docs/guides', '/docs/language', '/rulesets/:id']
  for (const path of gone) {
    if (paths.includes(path)) fail(`${path} is still a route`)
  }
  if (paths.some(path => path.startsWith('/install/'))) fail('install still has a per-host route')
  if (paths.some(path => path.split('/').length > 3 && path.startsWith('/problems/'))) fail('problem solutions still have their own route')
  const allowed = new Set(['/', '/sandboxes', '/problems', '/install', '/docs', '/embed', '/sandboxes/:sandboxId', '/problems/:problemId', '/docs/:hostId/:section', '/:pathMatch(.*)*'])
  for (const path of paths) {
    if (!allowed.has(path)) fail(`unexpected route ${path}`)
  }
  console.log('removed ok')
}

function charts() {
  const files = walk(demoSrc).filter(path => path.endsWith('.vue') || path.endsWith('.ts'))
  for (const path of files) {
    const text = readFileSync(path, 'utf8')
    if (/@unovis|recharts|chart\.js|from 'd3'|from "d3"|visx/.test(text)) fail(`${path} imports a chart library`)
  }
  const chart = source('components/CostChart.vue')
  if (!chart.includes('<svg') || chart.includes('<canvas')) fail('CostChart is not inline SVG')
  if (!chart.includes("from '@/rex/motion'")) fail('CostChart does not use the site motion')
  console.log('charts ok')
}

function copy() {
  const files = walk(demoSrc).filter(path => /\.(vue|ts)$/.test(path) && !path.endsWith('.test.ts'))
  for (const path of files) {
    const text = readFileSync(path, 'utf8')
    if (text.includes('RE2')) fail(`${path} mentions RE2`)
  }
  const examples = source('examples.ts')
  const menu = source('TestCaseMenu.vue')
  if (!examples.includes('Dynamic replacement')) fail('::| example is not described as dynamic replacement')
  if (!menu.includes('Dynamic replacement')) fail('::| menu item is not described as dynamic replacement')
  console.log('copy ok')
}

function intersection() {
  const home = source('pages/HomePage.vue')
  const problems = source('pages/ProblemsPage.vue')
  if (/hello-world|factorial|fizzbuzz|leap-year|gcd/.test(home)) fail('home hardcodes problem ids')
  if (/hello-world|factorial|fizzbuzz/.test(problems)) fail('problem index hardcodes problem ids')
  const builder = read('demo/scripts/build-site.mjs')
  if (!builder.includes('const sandboxCommon = commonProblems(passingSandboxes)')) fail('common set is not computed')
  const data = catalog()
  const passing = {}
  for (const sandbox of data.sandboxes) {
    if (sandbox.status !== 'ready') continue
    const solved = solvedBy(data, sandbox.id)
    if (solved.length > 0) passing[sandbox.id] = solved
  }
  if (commonProblems(passing).join('\0') !== data.sandboxCommon.join('\0')) fail('sandboxCommon is not the intersection')
  console.log('intersection ok')
}

function discover() {
  const ids = discoverSandboxIds()
  const dirs = readdirSync(join(repoRoot, 'langs'), { withFileTypes: true }).filter(entry => entry.isDirectory()).map(entry => entry.name)
  for (const dir of dirs) {
    if (!ids.includes(dir)) fail(`langs/${dir} was not discovered`)
  }
  if (!ids.includes('expr')) fail('expr is not discovered')
  const data = catalog()
  if (data.sandboxes.map(sandbox => sandbox.id).join(',') !== ids.join(',')) fail('catalog sandboxes are not the discovered ids')
  const page = source('pages/SandboxesPage.vue')
  if (page.includes("'forth'") || page.includes("'lisp'") || page.includes("'basic'")) fail('sandbox index hardcodes sandbox ids')
  const present = new Set()
  for (const problem of readdirSync(join(repoRoot, 'problems'), { withFileTypes: true }).filter(entry => entry.isDirectory())) {
    const solutions = join(repoRoot, 'problems', problem.name, 'solutions')
    if (!existsSync(solutions)) continue
    for (const ruleset of readdirSync(solutions, { withFileTypes: true }).filter(entry => entry.isDirectory())) {
      present.add(`${problem.name}/${ruleset.name}`)
    }
  }
  for (const key of present) {
    const [problemId, ruleset] = key.split('/')
    const problem = data.problems.find(item => item.id === problemId)
    if (!problem?.versions.some(version => version.id === ruleset)) fail(`solution ${key} is missing from the catalog`)
  }
  console.log('discover ok')
}

function changelog() {
  const text = read('CHANGELOG.md')
  const unreleased = text.split('## [Unreleased]')[1]?.split('\n## ')[0] ?? ''
  if (!unreleased.includes('/sandboxes') || !unreleased.includes('/problems/<id>') || !unreleased.includes('/docs/<host>/install')) {
    fail('CHANGELOG has no site restructure entry')
  }
  console.log('changelog ok')
}

function shots() {
  const root = '/opt/cursor/artifacts'
  const pages = ['home', 'sandboxes', 'sandbox', 'problems', 'problem', 'install', 'docs-install', 'docs-api', 'docs-examples']
  const themes = ['dark', 'light']
  const widths = ['390', '768', '1440']
  for (const page of pages) {
    for (const theme of themes) {
      for (const width of widths) {
        const path = join(root, `${page}-${theme}-${width}.png`)
        if (!existsSync(path) || statSync(path).size < 1000) fail(`missing screenshot ${path}`)
      }
    }
  }
  const videos = readdirSync(root).filter(name => name.endsWith('.mp4'))
  if (videos.length === 0) fail('missing chart screen recording')
  const body = prBody()
  for (const page of pages) {
    if (!body.includes(`${page}-dark-1440.png`) && !body.includes(`${page}-dark-1440`)) fail(`PR body is missing ${page}`)
  }
  if (!body.includes('.mp4') && !body.includes('<video')) fail('PR body is missing the chart recording')
  console.log('shots ok')
}

function pr() {
  const view = gh(['pr', 'view', '--json', 'body,mergeable,state,baseRefName'])
  const data = JSON.parse(view)
  if (!/closes\s+#148/i.test(data.body ?? '')) fail('PR body does not close #148')
  if (data.baseRefName !== 'main') fail(`PR base is ${data.baseRefName}`)
  if (data.mergeable !== 'MERGEABLE') fail(`PR mergeable is ${data.mergeable}`)
  console.log('pr ok')
}

function production() {
  const view = JSON.parse(gh(['pr', 'view', '--json', 'state,mergeCommit,url']))
  if (view.state !== 'MERGED' || !view.mergeCommit?.oid) fail(`PR is ${view.state}`)
  const sha = view.mergeCommit.oid
  const statuses = JSON.parse(gh(['api', `repos/thuelang/thueplusplus/commits/${sha}/statuses`]))
  const vercel = statuses.filter(status => /vercel/i.test(`${status.context} ${status.description}`))
  const productionStatus = vercel.find(status => /production/i.test(`${status.context} ${status.description} ${status.target_url}`))
  if (!productionStatus) fail(`no Vercel production status for ${sha}`)
  if (productionStatus.state !== 'success') fail(`Vercel production is ${productionStatus.state}: ${productionStatus.description}`)
  console.log('production ok')
}

function prBody() {
  try {
    return JSON.parse(gh(['pr', 'view', '--json', 'body'])).body ?? ''
  } catch {
    return ''
  }
}

function gh(args) {
  return execFileSync('gh', args, { cwd: repoRoot, encoding: 'utf8' })
}

function walk(dir) {
  const files = []
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name)
    if (entry.isDirectory()) files.push(...walk(path))
    else files.push(path)
  }
  return files
}
