import { execFileSync, spawnSync } from 'node:child_process'
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chartLayout, chooseScale, sandboxSeriesFromCatalog } from '../src/charts/geometry.mjs'
import { guideFor, readmeSection, sandboxGuides } from '../src/sandboxGuides.mjs'
import { commonProblems, costDrops, discoverSandboxIds, readGeneratedCatalog } from './build-site.mjs'

const repoRoot = fileURLToPath(new URL('../../', import.meta.url))
const demoSrc = join(repoRoot, 'demo/src')
const name = process.argv[2]
if (!name) {
  console.error('usage: node demo/scripts/site-gates.mjs <gate>')
  process.exit(1)
}

const handlers = {
  common,
  'home-chart': homeChart,
  'home-scale': homeScale,
  improvements,
  featured,
  rex,
  outlines,
  'guides-page': guidesPage,
  guides,
  sandboxes,
  expr,
  'problems-index': problemsIndex,
  'problem-chart': problemChart,
  'solutions-table': solutionsTable,
  filler,
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
  if (!home.includes('sandboxCostSeries()') || !home.includes('catalog.sandboxCommon')) fail('home chart is not driven by the catalog')
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

function homeChart() {
  const data = catalog()
  const home = source('pages/HomePage.vue')
  const chart = source('components/CostChart.vue')
  if (home.includes('sandboxBars') || chart.includes('<rect') || chart.includes('<canvas')) fail('home chart is still bars or a canvas')
  if (!home.includes('track="sum"') || !home.includes('sandboxCostSeries')) fail('home chart is not one line of summed cost per sandbox')
  const series = sandboxSeriesFromCatalog(data)
  const expected = data.sandboxes.filter(item => item.total != null).map(item => item.id)
  if (expected.length < 3) fail('fewer than three sandboxes have a common-problem sum')
  if (series.map(item => item.id).join(',') !== expected.join(',')) fail('chart lines are not the sandboxes with a total')
  for (const line of series) {
    const ruleset = data.rulesets.find(item => item.id === line.id)
    const sandbox = data.sandboxes.find(item => item.id === line.id)
    if (!ruleset || line.color !== ruleset.color) fail(`${line.id} color does not match the problem page`)
    if (line.points.length === 0 || line.points[line.points.length - 1].cost !== sandbox.total) fail(`${line.id} line does not end at the common-problem sum`)
  }
  const layout = chartLayout(series, { width: 640, height: 280, track: 'sum', progress: 1 })
  if (layout.labels.length === 0) fail('home chart has no time labels')
  if (!chart.includes('data-test="cost-legend"') || !chart.includes('data-test="time-label"')) fail('home chart is missing a legend or time labels')
  console.log('home-chart ok')
}

function homeScale() {
  const series = sandboxSeriesFromCatalog(catalog())
  const values = series.flatMap(line => line.points.map(point => point.cost))
  const positive = values.filter(value => value > 0)
  const ratio = Math.max(...positive) / Math.min(...positive)
  const scale = chooseScale(values)
  if (scale !== (ratio >= 20 ? 'log' : 'linear')) fail(`scale ${scale} does not follow ratio ${ratio}`)
  const home = source('pages/HomePage.vue')
  const chart = source('components/CostChart.vue')
  if (!home.includes('chooseScale')) fail('home does not choose the scale from the costs')
  if (!chart.includes('Log scale.')) fail('a log scale would be unlabeled')
  const layout = chartLayout(series, { width: 640, height: 280, track: 'sum', progress: 1 })
  if (layout.scale !== scale) fail('drawn scale does not match the costs')
  console.log('home-scale ok')
}

function improvements() {
  const home = source('pages/HomePage.vue')
  for (const field of ['improvement-commit', 'improvement-sandbox', 'improvement-problem', 'improvement-before', 'improvement-after']) {
    if (!home.includes(`data-test="${field}"`)) fail(`home feed is missing ${field}`)
  }
  if (!home.includes('repositoryUrl}/commit/')) fail('feed does not link to the commit')
  if (!home.includes('v-if="improvements.length"')) fail('home shows an empty improvements list')
  const data = catalog()
  let found = 0
  for (const problem of data.problems) {
    for (const version of problem.versions) {
      const points = version.series.map(point => {
        const commit = data.commits.find(item => item.commit === point.commit)
        if (!commit) fail(`${problem.id} ${point.commit} is not in the catalog`)
        return { commit: point.commit, cost: point.cost, time: Date.parse(commit.timestamp) }
      }).sort((left, right) => left.time - right.time || left.commit.localeCompare(right.commit))
      for (const drop of costDrops(points)) {
        const event = data.improvements.find(item => item.kind === 'solution' && item.commit === drop.commit && item.problem === problem.id && item.sandbox === version.id && item.before === drop.before && item.after === drop.after)
        if (!event) fail(`missing improvement ${problem.id} ${version.id} ${drop.before} -> ${drop.after}`)
        found += 1
      }
    }
  }
  if (found === 0) fail('no solution cost drop in the catalog history')
  for (const event of data.improvements) {
    if (!(event.after < event.before)) fail(`${event.commit} is not a decrease`)
  }
  console.log('improvements ok')
}

function featured() {
  const home = source('pages/HomePage.vue')
  if (!home.includes('data-test="featured-sandboxes"') || !home.includes('catalog.sandboxCommon') || !home.includes('data-test="common-problems"')) fail('featured sandboxes are gone')
  console.log('featured ok')
}

function rex() {
  for (const root of [join(demoSrc, 'pages'), join(demoSrc, 'components/scenes')]) {
    for (const path of walk(root)) {
      if (!/\.(vue|ts)$/.test(path)) continue
      if (readFileSync(path, 'utf8').includes('hello Ada')) fail(`${path} still has the hello Ada scene`)
    }
  }
  for (const path of ['pages/SandboxesPage.vue', 'pages/SandboxPage.vue', 'pages/ProblemsPage.vue']) {
    const text = source(path)
    if (text.includes('GuideScene') || text.includes('SceneFrame') || text.includes('LeaderboardScene')) fail(`${path} still mounts a Rex scene`)
  }
  console.log('rex ok')
}

function outlines() {
  const page = source('pages/SandboxesPage.vue')
  if (page.includes('sandbox.readme') || page.includes('MarkdownBody') || page.includes('In progress')) fail('sandbox index dumps a readme')
  if (!page.includes('guide.useCases') || !page.includes('guide.strengths')) fail('sandbox index has no outline')
  const sentence = 'Apparently, you can write a powerful Lisp'
  if (!read('langs/lisp/README.md').includes(sentence)) fail('lisp readme sentence moved')
  if (page.includes(sentence)) fail('sandbox index dumps the lisp readme')
  for (const sandbox of catalog().sandboxes) guideFor(sandbox.id)
  console.log('outlines ok')
}

function guidesPage() {
  const page = source('pages/SandboxPage.vue')
  if (!page.includes('guide.purpose') || !page.includes('sandbox-command') || !page.includes('sandbox-output')) fail('sandbox page is not a guide')
  if (page.includes('PlaygroundSurface') || page.includes('In progress')) fail('sandbox page still dumps a playground')
  console.log('guides-page ok')
}

function guides() {
  for (const guide of sandboxGuides) {
    for (const example of guide.examples) {
      const result = spawnSync('node', ['js/src/cli.js', example.program, ...example.args], { cwd: repoRoot, encoding: 'utf8' })
      if (result.status !== example.exit) fail(`${guide.id} ${example.name} exit ${result.status}, stderr ${JSON.stringify(result.stderr)}`)
      if (result.stdout !== example.stdout) fail(`${guide.id} ${example.name} stdout ${JSON.stringify(result.stdout)}`)
      if (result.stderr !== example.stderr) fail(`${guide.id} ${example.name} stderr ${JSON.stringify(result.stderr)}`)
      const shown = example.exit === 0 ? example.stdout : example.stderr
      if (example.output !== shown) fail(`${guide.id} ${example.name} displayed output is not the host output`)
    }
  }
  console.log('guides ok')
}

function sandboxes() {
  const data = catalog()
  const page = source('pages/SandboxesPage.vue')
  if (!page.includes('catalog.sandboxes')) fail('sandbox index is not the catalog')
  for (const id of ['lisp', 'forth', 'basic', 'expr']) {
    const sandbox = data.sandboxes.find(item => item.id === id)
    if (!sandbox || sandbox.status !== 'ready') fail(`${id} is not a ready sandbox`)
    if (!sandbox.programSource) fail(`${id} has no interpreter source`)
    const guide = guideFor(id)
    if (guide.examples.length < 2) fail(`${id} has fewer than two examples`)
  }
  console.log('sandboxes ok')
}

function expr() {
  const data = catalog()
  const sandbox = data.sandboxes.find(item => item.id === 'expr')
  if (!sandbox || sandbox.status !== 'ready' || sandbox.readme.length === 0) fail('expr is not ready')
  const text = [source('pages/SandboxPage.vue'), source('pages/SandboxesPage.vue'), source('router.ts')].join('\n')
  if (text.includes('In progress')) fail('expr still says in progress')
  const guide = guideFor('expr')
  if (!guide.command.includes('--line:expr') || !guide.command.includes('--line:env')) fail('expr call does not document the line resources')
  for (const heading of ['Resources', 'What works', 'Errors', 'Known differences']) {
    const section = readmeSection(sandbox.readme, heading)
    if (!guide.readmeSections.includes(heading)) fail(`expr page omits ${heading}`)
    if (heading === 'Resources' && (!section.includes('`expr`') || !section.includes('`env`'))) fail('expr resources are missing')
    if (heading === 'What works' && (!section.includes('**') || !section.includes('??'))) fail('expr operators are missing')
    if (heading === 'Errors' && !section.includes('division_by_zero')) fail('expr error codes are missing')
    if (heading === 'Known differences' && !section.includes('unsupported_float')) fail('expr limits are missing')
  }
  if (!source('pages/SandboxPage.vue').includes('readmeSection')) fail('expr page does not render the readme sections')
  console.log('expr ok')
}

function problemsIndex() {
  const data = catalog()
  const page = source('pages/ProblemsPage.vue')
  if (!page.includes('data-test="problem-card"') || !page.includes('<CostChart') || !page.includes('problem.description') || !page.includes('grid-cols-1')) fail('problem cards are missing a chart, a description, or a grid')
  if (data.problems.length === 0) fail('no problems')
  for (const problem of data.problems) {
    if (!problem.summary || !problem.description) fail(`${problem.id} has no description`)
    if (!problem.versions.some(version => Number.isInteger(version.solutions[0]?.cost))) fail(`${problem.id} has no cost`)
  }
  console.log('problems-index ok')
}

function problemSeries(data, problem) {
  return problem.versions.map(version => ({
    id: version.id,
    label: version.name,
    color: version.color,
    points: version.series.map(point => {
      const commit = data.commits.find(item => item.commit === point.commit)
      if (!commit || Number.isNaN(Date.parse(commit.timestamp))) fail(`${point.commit} has no commit time`)
      if (!Number.isInteger(point.cost)) fail(`${version.id} point has no cost`)
      return { time: Date.parse(commit.timestamp), cost: point.cost }
    }),
  }))
}

function problemChart() {
  const chart = source('components/CostChart.vue')
  const geometry = read('demo/src/charts/geometry.mjs')
  if (!chart.includes('<svg') || !chart.includes('<circle') || !geometry.includes("track === 'best' ? runningMin") || !chart.includes("ease('out'")) fail('problem chart is not an inline SVG with a running minimum')
  if (chart.includes('<canvas') || chart.includes('@unovis') || chart.includes('recharts')) fail('problem chart uses a canvas or a chart library')
  if (!geometry.includes('export function separateDots') || !chart.includes('data-test="time-label"')) fail('problem chart does not separate dots or label time')
  const data = catalog()
  const problem = data.problems.find(item => item.id === 'factorial') ?? data.problems[0]
  if (!problem) fail('no problem to chart')
  const series = problemSeries(data, problem)
  if (!series.some(item => item.id === 'direct')) fail(`${problem.id} chart has no direct series`)
  const layout = chartLayout(series, { width: 640, height: 280, track: 'best', progress: 1 })
  if (layout.labels.length === 0) fail('problem chart has no time labels')
  const dots = layout.series.flatMap(item => item.dots)
  let close = 0
  for (let i = 0; i < dots.length; i += 1) {
    for (let j = i + 1; j < dots.length; j += 1) {
      if (dots[i].id === dots[j].id) continue
      const dist = Math.hypot(dots[i].x - dots[j].x, dots[j].y - dots[i].y)
      if (dist < 9) close += 1
    }
  }
  if (close !== 0) fail(`${close} problem-chart dots still overlap`)
  console.log('problem-chart ok')
}

function filler() {
  const files = walk(demoSrc).filter(path => /\.(vue|mjs)$/.test(path) || (path.endsWith('.ts') && !path.endsWith('.test.ts')))
  for (const path of files) {
    const text = readFileSync(path, 'utf8')
    if (text.includes('In progress')) fail(`${path} says in progress`)
    if (text.includes('RE2')) fail(`${path} mentions RE2`)
  }
  console.log('filler ok')
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
  const pages = ['home', 'sandboxes', 'sandbox-lisp', 'sandbox-forth', 'sandbox-basic', 'sandbox-expr', 'problems', 'problem']
  const themes = ['dark', 'light']
  const widths = ['390', '1440']
  for (const page of pages) {
    for (const theme of themes) {
      for (const width of widths) {
        const path = join(root, `${page}-${theme}-${width}.png`)
        if (!existsSync(path) || statSync(path).size < 1000) fail(`missing screenshot ${path}`)
      }
    }
  }
  const body = prBody()
  for (const page of pages) {
    for (const theme of themes) {
      for (const width of widths) {
        if (!body.includes(`${page}-${theme}-${width}.png`)) fail(`PR body is missing ${page}-${theme}-${width}.png`)
      }
    }
  }
  console.log('shots ok')
}

function pr() {
  const view = gh(['pr', 'view', '--json', 'body,mergeable,state,baseRefName'])
  const data = JSON.parse(view)
  if (!/closes\s+#153/i.test(data.body ?? '')) fail('PR body does not close #153')
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
