import { execFileSync, spawnSync } from 'node:child_process'
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { bestSandboxMarks, sandboxSeriesFromCatalog, solutionLink, summedCostSeries } from '../src/charts/geometry.mjs'
import { guideFor, readmeSection, sandboxGuides } from '../src/sandboxGuides.mjs'
import { assertChartLines, commonProblems, costDrops, discoverSandboxIds, readGeneratedCatalog } from './build-site.mjs'

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
  'rex-problem': rexProblem,
  colors,
  labels,
  'time-fit': timeFit,
  cards,
  direct,
  description,
  history,
  'title-gap': titleGap,
  live,
  'comma-costs': commaCosts,
  'tick-wiring': tickWiring,
  'tooltip-copy': tooltipCopy,
  shots182,
  pr182,
  ci182,
  'nav-source': navSource,
  'layout-source': layoutSource,
  copy184,
  shots184,
  pr184,
  ci184,
}

const handler = handlers[name]
if (!handler) {
  console.error(`unknown gate ${name}`)
  process.exit(1)
}
try {
  Promise.resolve(handler()).catch(error => {
    console.error(error instanceof Error ? error.message : error)
    process.exit(1)
  })
} catch (error) {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
}

function commaCosts() {
  const bad = []
  for (const path of walk(demoSrc)) {
    if (!/\.(vue|ts|mjs|js)$/.test(path)) continue
    const text = readFileSync(path, 'utf8')
    const formatCost = text.includes('export function formatCost') ? text.split('export function formatCost')[1].split('\nexport function')[0] : ''
    if (text.includes('Intl.NumberFormat')) bad.push(path)
    const grouped = "toLocaleString('en-US')"
    if (text.includes(grouped)) {
      if (!path.endsWith('pages/ProblemPage.vue')) bad.push(path)
      else if ((text.split(grouped).length - 1) !== 1 || !text.includes('function formatCount') || !text.includes('formatCost(row.solution.cost)') || text.includes('formatCount(row.solution.cost)')) bad.push(path)
    }
    if (formatCost.includes('toLocaleString')) bad.push(`${path} formatCost`)
  }
  if (bad.length > 0) fail(bad.join('\n'))
  console.log('no comma costs')
}

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
      const costs = (version?.solutions ?? []).map(item => item.cost).filter(cost => Number.isInteger(cost))
      if (costs.length === 0) fail(`${sandbox.id} has no cost on ${id}`)
      sum += Math.min(...costs)
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
  const sandboxIds = data.sandboxes.filter(item => item.total != null).map(item => item.id)
  if (sandboxIds.length < 3) fail('fewer than three sandboxes have a common-problem sum')
  if (!series.some(item => item.id === 'direct' && item.label === 'Direct Thue')) fail('home chart omitted Direct Thue')
  const expected = [...sandboxIds, 'direct']
  if (series.map(item => item.id).join(',') !== expected.join(',')) fail('chart lines are not the sandboxes with a total')
  for (const line of series) {
    const ruleset = data.rulesets.find(item => item.id === line.id)
    if (!ruleset || line.color !== ruleset.color) fail(`${line.id} color does not match the problem page`)
    if (line.points.length === 0) fail(`${line.id} line has no points`)
    let sum = 0
    for (const id of data.sandboxCommon) {
      const problem = data.problems.find(item => item.id === id)
      const version = problem?.versions.find(item => item.id === line.id)
      const costs = (version?.solutions ?? []).map(item => item.cost).filter(cost => Number.isInteger(cost))
      if (costs.length === 0) fail(`${line.id} has no cost on ${id}`)
      sum += Math.min(...costs)
    }
    if (line.points[line.points.length - 1].cost !== sum) fail(`${line.id} line does not end at the best common-problem sum`)
    const sandbox = data.sandboxes.find(item => item.id === line.id)
    if (sandbox && line.points[line.points.length - 1].cost !== sandbox.total) fail(`${line.id} line does not end at the common-problem sum`)
  }
  if (!chart.includes('vue-echarts') || !chart.includes("renderer: 'svg'") || !chart.includes('SVGRenderer') || chart.includes('<canvas') || chart.includes('CanvasRenderer')) fail('home chart is not vue-echarts SVG')
  if (!chart.includes('data-test="cost-legend"') || !chart.includes('data-test="end-label"') || !chart.includes('data-test="y-log"') || !chart.includes('data-test="x-index"')) fail('home chart is missing a legend or a scale toggle')
  console.log('home-chart ok')
}

function homeScale() {
  const chart = source('components/CostChart.vue')
  const home = source('pages/HomePage.vue')
  if (home.includes('chooseScale') || chart.includes('chooseScale')) fail('home still chooses a log scale')
  if (!chart.includes("const scale = ref<'linear' | 'log'>('linear')")) fail('linear is not the default y scale')
  if (!chart.includes("const axis = ref<'date' | 'index'>('date')")) fail('date is not the default x axis')
  if (!chart.includes('data-test="y-log"') || !chart.includes('data-test="y-linear"') || !chart.includes('data-test="x-date"') || !chart.includes('data-test="x-index"')) fail('chart is missing a scale toggle')
  if (!chart.includes('v-if="!card"')) fail('card charts still show the scale toggles')
  console.log('home-scale ok')
}

function improvements() {
  const home = source('pages/HomePage.vue')
  for (const field of ['improvement-commit', 'improvement-sandbox', 'improvement-problem', 'improvement-title', 'improvement-before', 'improvement-after']) {
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
        const event = data.improvements.find(item => item.kind === 'solution' && item.timestamp === drop.commit && item.problem === problem.id && item.sandbox === version.id && item.before === drop.before && item.after === drop.after)
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
  const copy = 'This is the cumulative cost of the problems that have solutions in all sandboxes. This allows us to compare sandbox implementations fairly. Cost is calculated by the cumulative size of the state per step of evaluation. Essentially total memory over time.'
  if (!home.includes('data-test="featured-sandboxes"') || !home.includes('catalog.sandboxCommon') || !home.includes('Cost (lower is better)') || !home.includes(copy)) fail('home chart heading is not the cost comparison copy')
  if (home.includes('data-test="common-problems"')) fail('home still lists the common problems under the chart')
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
  if (!page.includes('data-test="problem-card"') || !page.includes('<CostChart') || !page.includes(' card ') || !page.includes('problem.description') || !page.includes('grid-cols-1')) fail('problem cards are missing a chart, a description, or a grid')
  if (page.includes('SandboxMarks')) fail('problem cards still use the mark list')
  if (data.problems.length === 0) fail('no problems')
  for (const problem of data.problems) {
    if (!problem.summary || !problem.description) fail(`${problem.id} has no description`)
    if (!problem.versions.some(version => Number.isInteger(version.solutions[0]?.cost))) fail(`${problem.id} has no cost`)
  }
  console.log('problems-index ok')
}

function problemSeries(data, problem) {
  return problem.versions.flatMap(version => {
    if (version.id === 'direct' && version.series.length === 0) return []
    return [{
    id: version.id,
    label: version.id === 'direct' ? 'Direct Thue' : version.name,
    color: version.color,
    points: version.series.map(point => {
      const commit = data.commits.find(item => item.commit === point.commit)
      if (!commit || Number.isNaN(Date.parse(commit.timestamp))) fail(`${point.commit} has no commit time`)
      if (!Number.isInteger(point.cost)) fail(`${version.id} point has no cost`)
      return { time: Date.parse(commit.timestamp), cost: point.cost }
    }),
  }]
  })
}

function problemChart() {
  const chart = source('components/CostChart.vue')
  const geometry = read('demo/src/charts/geometry.mjs')
  if (!chart.includes("from 'vue-echarts'") || !chart.includes("from 'echarts/core'") || !chart.includes("from 'echarts/charts'") || !chart.includes("from 'echarts/components'") || !chart.includes("from 'echarts/renderers'") || !chart.includes('SVGRenderer') || !chart.includes("renderer: 'svg'")) fail('problem chart is not a tree-shaken vue-echarts SVG chart')
  if (chart.includes("from 'echarts'") || chart.includes('CanvasRenderer') || chart.includes('<canvas') || chart.includes('@unovis') || chart.includes('recharts')) fail('problem chart uses a canvas or the full echarts bundle')
  if (!chart.includes('LineChart') || !chart.includes('GridComponent') || !chart.includes('TooltipComponent') || !chart.includes('LegendComponent')) fail('problem chart is missing a chart component')
  if (!chart.includes('enterable: true') || !chart.includes("triggerOn: 'mousemove|click'")) fail('problem chart tooltip is not clickable')
  if (geometry.includes('export function separateDots') || chart.includes('separateDots')) fail('dots are still pushed off the line')
  if (!chart.includes('symbol: \'circle\'')) fail('symbols are not drawn on the line')
  const home = source('pages/HomePage.vue')
  const problemPage = source('pages/ProblemPage.vue')
  if (!home.includes("lazyComponent('src/components/CostChart.vue'") || !problemPage.includes("lazyComponent('src/components/CostChart.vue'")) fail('the cost chart is not lazy')
  const data = catalog()
  const problem = data.problems.find(item => item.id === 'factorial') ?? data.problems[0]
  if (!problem) fail('no problem to chart')
  const series = problemSeries(data, problem)
  if (!series.some(item => item.id !== 'direct')) fail(`${problem.id} chart has no sandbox series`)
  const directLine = series.find(item => item.id === 'direct')
  if (!directLine || directLine.label !== 'Direct Thue' || directLine.points.length === 0) fail(`${problem.id} chart has no Direct Thue line`)
  const version = problem.versions.find(item => item.id === 'direct')
  const point = version?.series.find(item => item.sha && item.solutionPath)
  if (!point) fail(`${problem.id} direct point has no solution link`)
  const link = solutionLink({
    problemId: problem.id,
    problem: problem.title,
    label: 'Direct Thue',
    cost: point.cost,
    time: Date.parse(data.commits.find(item => item.commit === point.commit)?.timestamp ?? ''),
    sha: point.sha,
    author: point.author,
    solutionPath: point.solutionPath,
  })
  if (!link.blobUrl.startsWith(`https://github.com/thuelang/thueplusplus/blob/${point.sha}/`)) fail('tooltip blob url is not at the commit')
  const listed = spawnSync('git', ['cat-file', '-e', `${point.sha}:${point.solutionPath}`], { cwd: repoRoot })
  if (listed.status !== 0) fail(`${point.solutionPath} is missing at ${point.sha}`)
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
  if (!page.includes("toggle('title')") || !page.includes("toggle('cost')") || !page.includes("toggle('author')") || !page.includes("toggle('date')")) fail('solutions table is not sortable')
  if (!page.includes('data-test="solution-title"')) fail('solutions table has no title')
  const data = catalog()
  const problem = data.problems.find(item => item.id === 'factorial') ?? data.problems[0]
  const lisp = problem.versions.find(version => version.id === 'lisp') ?? problem.versions[0]
  const path = lisp.solutions[0]?.solutionPath
  if (!path || !/^problems\/[^/]+\/solutions\/[^/]+\/\d{4}-\d{2}-\d{2}_\d{2}-\d{2}-\d{2}\/[a-z0-9]+(?:-[a-z0-9]+)*\.[a-z0-9]+$/.test(path)) fail(`solution path is not a version file: ${path}`)
  if (lisp.solutions.length < 2) fail('factorial lisp does not list every version')
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
    if (/@unovis|recharts|chart\.js|from ['"]d3['"]|visx|from ['"]echarts['"]|CanvasRenderer/.test(text)) fail(`${path} imports a chart library`)
  }
  const chart = source('components/CostChart.vue')
  if (!chart.includes("from 'vue-echarts'") || !chart.includes('SVGRenderer') || chart.includes('<canvas') || chart.includes('CanvasRenderer')) fail('CostChart is not vue-echarts SVG')
  if (!chart.includes('prefers-reduced-motion') || !chart.includes('animation: !reduced.value')) fail('CostChart does not follow reduced motion')
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
  const pages = ['home', 'problem']
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
  if (!/closes\s+#169/i.test(data.body ?? '')) fail('PR body does not close #169')
  if (data.baseRefName !== 'main') fail(`PR base is ${data.baseRefName}`)
  if (data.state !== 'MERGED' && data.mergeable !== 'MERGEABLE') fail(`PR mergeable is ${data.mergeable}`)
  console.log('pr ok')
}

function production() {
  const view = JSON.parse(gh(['pr', 'view', '--json', 'state,mergeCommit,url']))
  if (view.state !== 'MERGED' || !view.mergeCommit?.oid) fail(`PR is ${view.state}`)
  const sha = view.mergeCommit.oid
  const statuses = JSON.parse(gh(['api', `repos/thuelang/thueplusplus/commits/${sha}/statuses`]))
  const vercel = statuses.filter(status => /vercel/i.test(status.context ?? ''))
  const productionStatus = vercel.find(status => status.state === 'success' && /completed/i.test(status.description ?? '') && !/ignored|canceled|error|fail/i.test(status.description ?? ''))
  if (!productionStatus) fail(`no completed Vercel deploy for ${sha}`)
  console.log('production ok')
}

function history() {
  const unshallow = read('demo/scripts/unshallow.mjs')
  if (!unshallow.includes("'pull'") || !unshallow.includes("'--ff-only'") || !unshallow.includes("'--unshallow'")) fail('the build does not pull a full history')
  if (!unshallow.includes('https://github.com/thuelang/thueplusplus.git')) fail('the build has no GitHub history url')
  if (/execFileSync\('git', \['fetch', '--unshallow'\]/.test(unshallow)) fail('the build still fetches with no remote')
  const build = read('demo/scripts/build-site.mjs')
  if (!build.includes('has no metric history; keeping the working tree cost')) fail('a metric with no history is dropped')
  if (!build.includes('no summed cost line')) fail('the build does not reject a sandbox with no line')
  const geometry = source('charts/geometry.mjs')
  if (geometry.includes('has no summed cost over time')) fail('one sandbox still throws in the browser')
  try {
    assertChartLines({
      sandboxCommon: ['hello-world'],
      commits: [{ commit: 'a', timestamp: '2026-10-20T00:00:00Z' }],
      sandboxes: [{ id: 'forth', name: 'Forth', total: 10, color: '#c2410c' }],
      problems: [{ id: 'hello-world', versions: [{ id: 'forth', series: [], solutions: [] }] }],
    })
    fail('a sandbox with no line passed the build')
  } catch (error) {
    if (!/forth has total 10 and no summed cost line/.test(error instanceof Error ? error.message : '')) throw error
  }
  console.log('history ok')
}

async function live() {
  const { chromium } = await import('@playwright/test')
  const browser = await chromium.launch({ headless: true })
  const page = await browser.newPage()
  const errors = []
  page.on('pageerror', error => errors.push(String(error)))
  page.on('console', message => {
    if (message.type() === 'error') errors.push(message.text())
  })
  try {
    await page.goto('https://www.thuelang.org/', { waitUntil: 'networkidle', timeout: 60000 })
    await page.waitForSelector('[data-test="end-label"]', { timeout: 15000 })
    const labels = (await page.locator('[data-test="end-label"]').allTextContents()).map(label => label.trim())
    for (const name of ['Forth', 'Lisp', 'BASIC', 'Direct Thue']) {
      if (!labels.some(label => label.startsWith(`${name} `))) fail(`home chart is missing ${name}: ${labels.join(' | ')}`)
    }
    if (labels.some(label => /\d,\d{3}/.test(label))) fail(`home cost still uses commas: ${labels.join(' | ')}`)
    if (!labels.some(label => /\d(?:\.\d+)?[kMGT]/.test(label))) fail(`home cost is not SI: ${labels.join(' | ')}`)
    const feed = (await page.locator('[data-test="improvement-before"], [data-test="improvement-after"]').allTextContents()).map(item => item.trim())
    if (feed.length === 0 || feed.some(item => /\d,\d{3}/.test(item)) || !feed.some(item => /\d(?:\.\d+)?[kMGT]|\b\d{1,3}\b/.test(item))) {
      fail(`feed costs are not SI: ${feed.join(' | ')}`)
    }
    await page.goto('https://www.thuelang.org/problems', { waitUntil: 'networkidle', timeout: 60000 })
    await page.waitForSelector('[data-test="card-chart"] [data-test="end-label"]', { timeout: 15000 })
    const cards = (await page.locator('[data-test="card-chart"] [data-test="end-label"]').allTextContents()).map(item => item.trim())
    if (cards.some(item => /\d,\d{3}/.test(item)) || !cards.some(item => /\d/.test(item))) fail(`card costs are not SI: ${cards.slice(0, 8).join(' | ')}`)
    await page.setViewportSize({ width: 1600, height: 900 })
    await page.goto('https://www.thuelang.org/problems/factorial', { waitUntil: 'networkidle', timeout: 60000 })
    await page.waitForSelector('[data-test="section-nav"] [aria-current="page"]', { timeout: 15000 })
    const currentHref = await page.locator('[data-test="section-nav"] [aria-current="page"]').getAttribute('href')
    if (currentHref !== '/problems/factorial') fail(`factorial current page is ${currentHref}`)
    const mainBox = await page.locator('[data-test="page-main"]').boundingBox()
    const tocBox = await page.locator('#on-this-page').boundingBox()
    const navBox = await page.locator('[data-test="section-nav"]').boundingBox()
    if (!mainBox || !tocBox || !navBox) fail('factorial layout is missing a column')
    if (tocBox.x < mainBox.x + mainBox.width - 1) fail('On this page is not to the right of the content')
    if (navBox.x + navBox.width > mainBox.x + 1) fail('section nav is not to the left of the content')
    await page.waitForSelector('[data-test="end-label"][data-sandbox="direct"]', { timeout: 15000 })
    const directLabel = (await page.locator('[data-test="end-label"][data-sandbox="direct"]').evaluate(node => node.textContent ?? '')).trim()
    if (!directLabel.startsWith('Direct Thue ')) fail(`factorial chart label is ${directLabel}`)
    await page.waitForSelector('[data-test="solution-link"]', { timeout: 15000 })
    const links = await page.locator('[data-test="solution-link"]').count()
    if (links < 1) fail('problem page has no solution links')
    await page.waitForSelector('[data-test="solution-cost"]', { timeout: 15000 })
    const costs = (await page.locator('[data-test="solution-cost"]').allTextContents()).map(item => item.trim()).filter(item => item !== 'unmeasured')
    if (costs.length === 0 || costs.some(item => /\d,\d{3}/.test(item)) || !costs.some(item => /\d(?:\.\d+)?[kMGT]|\b\d{1,3}\b/.test(item))) {
      fail(`solution costs are not SI: ${costs.join(' | ')}`)
    }
    const history = JSON.parse(read('metrics/versions.json'))
    const entry = Object.values(history.versions).find(item => item.problem === 'factorial' && item.ruleset === 'lisp' && item.timestamp === '2026-10-17_13-58-55')
    if (!entry?.commit || entry.commit.startsWith('75fa4d3')) fail('factorial lisp metrics entry has no measuring commit')
    const buttons = page.locator('[data-test="cost-chart"] [data-test="end-label"]')
    const count = await buttons.count()
    for (let index = 0; index < count; index += 1) {
      const button = buttons.nth(index)
      const sandbox = await button.getAttribute('data-sandbox')
      const pressed = await button.getAttribute('aria-pressed')
      if (sandbox !== 'lisp' && pressed === 'true') await button.click()
    }
    await page.locator('[data-test="cost-chart"] svg path[d^="M1 0A1"]').last().hover()
    await page.waitForSelector('.cost-tip a[href*="/commit/"]', { timeout: 10000 })
    const text = await page.locator('.cost-tip').innerText()
    if (!text.includes('Lisp: While loop from stdin')) fail(`factorial lisp tooltip is ${text}`)
    if (!text.includes('Cost 15.5M,')) fail(`factorial lisp cost line is ${text}`)
    if (!text.includes('by Cursor Agent')) fail(`factorial lisp author line is ${text}`)
    if (text.includes('75fa4d3') || text.includes('@') || text.includes('<')) fail(`factorial lisp tooltip leaked the old commit or an email: ${text}`)
    if (!text.includes('View solution') || !/View commit [0-9a-f]{7}/.test(text)) fail(`factorial lisp links are ${text}`)
    const dates = text.match(/[A-Z][a-z]{2} \d{1,2}, \d{4}/g) ?? []
    if (dates.length !== 1) fail(`factorial lisp date is not shown once: ${text}`)
    const commitHref = await page.locator('.cost-tip a[href*="/commit/"]').getAttribute('href')
    if (!commitHref || !commitHref.endsWith(entry.commit)) fail(`factorial lisp commit link is ${commitHref}`)
    const blobHref = await page.locator('.cost-tip a[href*="/blob/"]').getAttribute('href')
    if (!blobHref || !blobHref.includes(`/${entry.commit}/`)) fail(`factorial lisp solution link is ${blobHref}`)
    const ticks = (await page.locator('[data-test="cost-chart"] svg text').allTextContents()).join(' ')
    if (/\d\.\d*0[kMGT]/.test(ticks)) fail(`factorial ticks keep trailing zeros: ${ticks}`)
    if (errors.length > 0) fail(errors.join('\n'))
    console.log('live ok')
  } finally {
    await browser.close()
  }
}

function titleGap() {
  const css = source('style.css')
  const rule = css.match(/\.page-screen-plain \+ \.page-details \{[^}]+\}/)
  if (!rule || !/margin-top:\s*2\.5rem/.test(rule[0])) fail('a problem page has no gap between the title and Cost')
  console.log('title-gap ok')
}

function rexProblem() {
  const page = source('pages/ProblemPage.vue')
  const home = source('pages/HomePage.vue')
  if (page.includes('ProblemScene') || page.includes('#scene') || page.includes('rex-scene')) fail('problem page mounts Rex')
  if (!home.includes('<SandboxScene')) fail('home hero lost its scene')
  console.log('rex-problem ok')
}

function themeHexes(block, theme) {
  const found = {}
  for (const id of ['forth', 'lisp', 'basic', 'expr']) {
    const match = block.match(new RegExp(`--sandbox-${id}:\\s*(#[0-9a-fA-F]{6})`))
    if (!match) fail(`${theme} is missing --sandbox-${id}`)
    found[id] = match[1].toLowerCase()
  }
  return found
}

function rgbOf(hex) {
  return [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16)]
}

function colors() {
  const css = source('style.css')
  const darkStart = css.indexOf(':root,')
  const lightStart = css.indexOf('html:not(.dark)')
  if (darkStart < 0 || lightStart < darkStart) fail('theme blocks are missing')
  const themes = {
    dark: themeHexes(css.slice(darkStart, lightStart), 'dark'),
    light: themeHexes(css.slice(lightStart), 'light'),
  }
  for (const [theme, hexes] of Object.entries(themes)) {
    const ids = Object.keys(hexes)
    for (const id of ids) {
      const [red, green, blue] = rgbOf(hexes[id])
      if (Math.max(red, green, blue) - Math.min(red, green, blue) < 50) fail(`${theme} ${id} ${hexes[id]} is gray`)
    }
    for (let left = 0; left < ids.length; left += 1) {
      for (let right = left + 1; right < ids.length; right += 1) {
        const [ar, ag, ab] = rgbOf(hexes[ids[left]])
        const [br, bg, bb] = rgbOf(hexes[ids[right]])
        const distance = Math.hypot(ar - br, ag - bg, ab - bb)
        if (distance < 100) fail(`${theme} ${ids[left]} and ${ids[right]} are ${distance.toFixed(1)} apart`)
      }
    }
    const block = theme === 'dark' ? css.slice(darkStart, lightStart) : css.slice(lightStart)
    const directMatch = block.match(/--direct:\s*(#[0-9a-fA-F]{6})/)
    if (!directMatch) fail(`${theme} is missing --direct`)
    const direct = directMatch[1].toLowerCase()
    const [red, green, blue] = rgbOf(direct)
    if (Math.max(red, green, blue) - Math.min(red, green, blue) < 50) fail(`${theme} direct ${direct} is gray`)
    for (const id of ids) {
      const [ar, ag, ab] = rgbOf(hexes[id])
      const distance = Math.hypot(ar - red, ag - green, ab - blue)
      if (distance < 100) fail(`${theme} direct and ${id} are ${distance.toFixed(1)} apart`)
    }
  }
  const data = catalog()
  for (const id of ['forth', 'lisp', 'basic', 'expr']) {
    const expected = `var(--sandbox-${id})`
    const sandbox = data.sandboxes.find(item => item.id === id)
    if (!sandbox || sandbox.color !== expected) fail(`${id} sandbox color is ${sandbox?.color}`)
    const ruleset = data.rulesets.find(item => item.id === id)
    if (ruleset && ruleset.color !== expected) fail(`${id} ruleset color is ${ruleset.color}`)
  }
  const directRuleset = data.rulesets.find(item => item.id === 'direct')
  if (!directRuleset || directRuleset.color !== 'var(--direct)') fail(`direct color is ${directRuleset?.color}`)
  console.log('colors ok')
}

function labels() {
  const home = source('pages/HomePage.vue')
  const chart = source('components/CostChart.vue')
  if (home.includes('chooseScale') || chart.includes('chooseScale')) fail('home still chooses a log scale')
  if (!chart.includes("const scale = ref<'linear' | 'log'>('linear')")) fail('home chart is not marked linear')
  if (!chart.includes('data-test="end-label"') || !chart.includes('data-test="cost-legend"')) fail('a line has no end label')
  if (chart.includes('Log scale.')) fail('chart still says log scale')
  if (chart.includes('separateDots')) fail('dots are still pushed off the line')
  const cheaper = summedCostSeries([
    [{ time: 1, cost: 10, version: 'a' }, { time: 3, cost: 40, version: 'b' }],
    [{ time: 2, cost: 5, version: 'c' }],
  ], [1, 2, 3, 4])
  if (cheaper.at(-1)?.cost !== 15) fail('the home sum added two versions of one problem')
  const replaced = summedCostSeries([
    [{ time: 1, cost: 10, version: 'a' }, { time: 3, cost: 40, version: 'a' }],
    [{ time: 2, cost: 5, version: 'c' }],
  ], [1, 2, 3])
  if (replaced.at(-1)?.cost !== 45) fail('a remeasure did not replace that version')
  const data = catalog()
  const homeSeries = sandboxSeriesFromCatalog(data)
  if (!homeSeries.some(item => item.id === 'direct')) fail('home labels omitted Direct Thue')
  console.log('labels ok')
}

function timeFit() {
  const chart = source('components/CostChart.vue')
  if (!chart.includes('hideOverlap: true') || !chart.includes("outerBoundsContain: 'axisLabel'")) fail('axis labels can sit on top of each other')
  console.log('time-fit ok')
}

function cards() {
  const page = source('pages/ProblemsPage.vue')
  const marksAt = page.indexOf('<CostChart')
  const titleAt = page.indexOf('<h2')
  const descriptionAt = page.indexOf('problem.description')
  if (marksAt < 0 || titleAt < 0 || descriptionAt < 0 || !(marksAt < titleAt && titleAt < descriptionAt)) fail('card order is not chart, title, description')
  if (!page.includes(' card ') || page.includes('SandboxMarks')) fail('problem cards are not a small chart')
  const chart = source('components/CostChart.vue')
  if (!chart.includes('v-if="!card"') || !chart.includes("'card-chart'") || !chart.includes("'cost-chart'")) fail('card charts lost their chart')
  if (!chart.includes('enterable: true')) fail('card charts have no hover tooltip')
  const data = catalog()
  let empty = 0
  for (const problem of data.problems) {
    const marks = bestSandboxMarks(problem)
    const expected = problem.versions.filter(version => version.series.length > 0)
    if (marks.length !== expected.length) fail(`${problem.id} has ${marks.length} marks for ${expected.length} series`)
    if (marks.length === 0) empty += 1
    for (const mark of marks) {
      const version = expected.find(item => item.id === mark.id)
      const best = Math.min(...version.series.map(point => point.cost))
      if (mark.cost !== best) fail(`${problem.id} ${mark.id} mark is not the best cost`)
      if (mark.color !== version.color) fail(`${problem.id} ${mark.id} mark color differs from the chart`)
      if (mark.id === 'direct' && mark.label !== 'Direct Thue') fail(`${problem.id} card calls direct ${mark.label}`)
    }
  }
  const directOnly = data.problems.filter(problem => problem.versions.some(version => version.id === 'direct' && version.series.length > 0) && problem.versions.every(version => version.id === 'direct' || version.series.length === 0))
  if (directOnly.length === 0) fail('no direct-only problem')
  for (const problem of directOnly) {
    const marks = bestSandboxMarks(problem)
    if (marks.length !== 1 || marks[0].id !== 'direct' || marks[0].label !== 'Direct Thue') fail(`${problem.id} card does not show Direct Thue alone`)
  }
  if (empty !== 0) fail(`${empty} cards have no cost mark`)
  console.log('cards ok')
}

function direct() {
  const home = source('pages/HomePage.vue')
  if (home.includes("event.sandbox !== 'direct'")) fail('home feed still drops Direct Thue')
  if (!home.includes("event.sandbox === 'direct'") || !home.includes('>Direct Thue</span>')) fail('home feed does not label Direct Thue')
  if (home.includes('>direct<')) fail('home renders direct as a sandbox name')
  if (!home.includes('v-else') || !home.includes('/sandboxes/${event.sandbox}')) fail('sandbox improvements lost their page link')
  const series = source('charts/series.ts')
  if (series.includes("version.id !== 'direct'")) fail('problem charts still drop direct')
  if (!series.includes("'Direct Thue'")) fail('problem charts do not name Direct Thue')
  const page = source('pages/ProblemPage.vue')
  if (!page.includes('Direct Thue')) fail('solutions table does not call the baseline Direct Thue')
  if (!page.includes('>Entry<')) fail('solutions column still treats every row as a sandbox')
  const data = catalog()
  const leap = data.problems.find(item => item.id === 'leap-year')
  const drawn = problemSeries(data, leap)
  if (!drawn.some(item => item.id === 'direct' && item.label === 'Direct Thue' && item.points.length > 0)) fail('leap-year chart has no Direct Thue line')
  const omitted = problemSeries(data, { ...leap, versions: leap.versions.filter(version => version.id !== 'direct') })
  if (omitted.some(item => item.id === 'direct')) fail('a problem without direct still draws it')
  if (!drawn.some(item => item.id === 'forth')) fail('leap-year chart dropped a sandbox')
  const homeSeries = sandboxSeriesFromCatalog(data)
  if (!homeSeries.some(item => item.id === 'direct' && item.label === 'Direct Thue')) fail('home chart omitted Direct Thue')
  const events = data.improvements.filter(event => event.sandbox === 'direct')
  if (events.length === 0) fail('catalog has no direct drop, so the feed filter was not measured')
  console.log('direct ok')
}

function description() {
  const page = source('pages/ProblemPage.vue')
  const count = page.split('problem.description').length - 1
  if (count !== 1) fail(`problem description appears ${count} times`)
  if (page.includes('problem.summary')) fail('problem page also shows the summary')
  console.log('description ok')
}

function tickWiring() {
  const chart = source('components/CostChart.vue')
  const tip = source('charts/tooltip.ts')
  const page = source('pages/ProblemPage.vue')
  if (!chart.includes('formatter: (value: number) => formatTick(value)')) fail('axis does not trim ticks')
  if (!chart.includes("scale.value === 'log' ? 'log' : 'value'")) fail('log scale is gone')
  if (chart.split('formatCost(endCost(item))').length - 1 !== 2) fail('legends dropped three-digit costs')
  if (tip.includes('formatTick') || !tip.includes('formatCost')) fail('tooltip does not keep three significant digits')
  if (!page.includes('formatCost(row.solution.cost)')) fail('table dropped three-digit costs')
  console.log('trimmed-ticks')
}

function tooltipCopy() {
  const changelog = read('CHANGELOG.md')
  const added = changelog.split('### Changed')[1]?.split('\n- ')[1] ?? ''
  const blob = [read('demo/src/charts/tooltip.ts'), read('demo/src/components/CostChart.vue'), added].join('\n')
  if (blob.includes('RE2')) fail('user-facing copy mentions RE2')
  const tip = read('demo/src/charts/tooltip.ts')
  if (tip.includes('timeStyle') || tip.includes('solution ·')) fail('the old tooltip is still there')
  const build = read('demo/scripts/build-site.mjs')
  if (build.includes('sha: item.chartSha') || build.includes('function chartCommit')) fail('chart sha still follows the latest file commit')
  console.log('no-legacy')
}

function shots182() {
  const names = ['home-tooltip-axis-dark.png', 'home-tooltip-axis-light.png', 'factorial-tooltip-axis-dark.png', 'factorial-tooltip-axis-light.png']
  for (const name of names) {
    const path = join('/opt/cursor/artifacts', name)
    if (!existsSync(path) || statSync(path).size < 1000) fail(`missing screenshot ${path}`)
  }
  const body = prBody()
  for (const name of names) {
    if (!body.includes(name)) fail(`PR body is missing ${name}`)
  }
  console.log('shots-ok')
}

function pr182() {
  const data = JSON.parse(gh(['pr', 'view', '--json', 'body,baseRefName,mergeable,state']))
  if (!/closes\s+#182/i.test(data.body ?? '')) fail('PR body does not close #182')
  if (data.baseRefName !== 'main') fail(`PR base is ${data.baseRefName}`)
  if (data.state !== 'MERGED' && data.mergeable !== 'MERGEABLE') fail(`PR mergeable is ${data.mergeable}`)
  console.log('pr-ok')
}

function ci182() {
  spawnSync('gh', ['pr', 'checks', '--watch', '--fail-fast'], { cwd: repoRoot, stdio: 'ignore' })
  const words = ['deploy cap', 'daily', 'ignored build', 'resource', 'exceeded']
  for (let attempt = 0; attempt < 40; attempt += 1) {
    const rows = JSON.parse(gh(['pr', 'checks', '--json', 'name,bucket,description']))
    const bad = []
    let pending = false
    for (const row of rows) {
      if (row.bucket === 'pass' || row.bucket === 'skipping') continue
      const description = `${row.description ?? ''}`.toLowerCase()
      if (/vercel/i.test(row.name) && words.some(word => description.includes(word))) continue
      if (row.bucket === 'pending') {
        pending = true
        continue
      }
      bad.push(`${row.name}: ${row.bucket} ${row.description ?? ''}`)
    }
    if (bad.length > 0) fail(bad.join('\n'))
    if (!pending) {
      console.log('ci-green')
      return
    }
    spawnSync('sleep', ['15'])
  }
  fail('checks are still pending')
}

function navSource() {
  const source = read('demo/src/sectionNav.ts')
  if (!source.includes('catalog.problems') || !source.includes('catalog.sandboxes') || !source.includes('siteHosts') || !source.includes('routes')) {
    fail('section nav is not built from the catalog and the router')
  }
  if (source.includes('Factorial') || source.includes('hello-world') || source.includes('Direct Thue')) {
    fail('section nav hardcodes a page')
  }
  console.log('nav-source')
}

function layoutSource() {
  const shell = read('demo/src/components/AppShell.vue')
  const views = [...shell.matchAll(/<RouterView/g)].map(match => match.index ?? -1)
  const main = views[views.length - 1] ?? -1
  const section = shell.indexOf('data-test="section-nav"')
  const sidebar = shell.indexOf('data-test="page-sidebar"')
  const toc = shell.indexOf('<OnThisPage')
  if (section < 0 || sidebar < 0 || toc < 0 || main < 0) fail('layout markers are missing')
  if (!(section < main && main < sidebar)) fail('On this page is still left of the content')
  if (!(sidebar < toc)) fail('On this page is not in the right column')
  if ((shell.match(/<OnThisPage/g) ?? []).length !== 1) fail('On this page is duplicated')
  if (/legacy|fallback|backcompat|backwards/i.test(shell)) fail('the shell keeps a second layout')
  if (!shell.includes('max-w-[65ch]')) fail('the narrow column lost its measure')
  if (!shell.includes('max-w-[calc(1180px+13.5rem)]') || !shell.includes('max-w-[calc(65ch+27rem)]')) fail('the shell did not grow for the right column')
  if (shell.includes('max-w-[1180px]') || shell.includes('max-w-[calc(65ch+13.5rem)]')) fail('the old shell width is still there')
  const uses = walk(join(repoRoot, 'demo/src')).filter(path => path.endsWith('.vue') && readFileSync(path, 'utf8').includes('OnThisPage') && !path.endsWith('OnThisPage.vue'))
  if (uses.length !== 1 || !uses[0].endsWith('AppShell.vue')) fail(`On this page is mounted from ${uses.join(', ')}`)
  console.log('no-legacy')
}

function copy184() {
  const changelog = read('CHANGELOG.md')
  const added = changelog.split('### Changed')[1]?.split('\n- ')[1] ?? ''
  if (!added.includes('section nav')) fail('the changelog has no section nav entry')
  const blob = [read('demo/src/sectionNav.ts'), read('demo/src/components/AppShell.vue'), read('demo/src/components/OnThisPage.vue'), added].join('\n')
  if (blob.includes('RE2')) fail('user-facing copy mentions RE2')
  console.log('no-re2')
}

function shots184() {
  const names = []
  for (const page of ['factorial-nav', 'sandbox-nav', 'docs-nav']) {
    for (const theme of ['dark', 'light']) {
      for (const width of ['1440', '390']) names.push(`${page}-${theme}-${width}.png`)
    }
  }
  for (const name of names) {
    const path = join('/opt/cursor/artifacts', name)
    if (!existsSync(path) || statSync(path).size < 1000) fail(`missing screenshot ${path}`)
  }
  const body = prBody()
  for (const name of names) {
    if (!body.includes(name)) fail(`PR body is missing ${name}`)
  }
  console.log('shots-ok')
}

function pr184() {
  const data = JSON.parse(gh(['pr', 'view', '--json', 'body,baseRefName,mergeable,state']))
  if (!/closes\s+#184/i.test(data.body ?? '')) fail('PR body does not close #184')
  if (data.baseRefName !== 'main') fail(`PR base is ${data.baseRefName}`)
  if (data.state !== 'MERGED' && data.mergeable !== 'MERGEABLE') fail(`PR mergeable is ${data.mergeable}`)
  console.log('pr-ok')
}

function ci184() {
  spawnSync('gh', ['pr', 'checks', '--watch', '--fail-fast'], { cwd: repoRoot, stdio: 'ignore' })
  const words = ['deploy cap', 'daily', 'ignored build', 'resource', 'exceeded']
  for (let attempt = 0; attempt < 40; attempt += 1) {
    const rows = JSON.parse(gh(['pr', 'checks', '--json', 'name,bucket,description']))
    const bad = []
    let pending = false
    for (const row of rows) {
      if (row.bucket === 'pass' || row.bucket === 'skipping') continue
      const description = `${row.description ?? ''}`.toLowerCase()
      if (/vercel/i.test(row.name) && words.some(word => description.includes(word))) continue
      if (row.bucket === 'pending') {
        pending = true
        continue
      }
      bad.push(`${row.name}: ${row.bucket} ${row.description ?? ''}`)
    }
    if (bad.length > 0) fail(bad.join('\n'))
    if (!pending) {
      console.log('ci-green')
      return
    }
    spawnSync('sleep', ['15'])
  }
  fail('checks are still pending')
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
