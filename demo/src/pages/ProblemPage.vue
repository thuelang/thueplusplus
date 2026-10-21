<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRoute } from 'vue-router'
import DocPage from '@/components/DocPage.vue'
import { lazyComponent } from '@/trackedImport'

const CostChart = lazyComponent('src/components/CostChart.vue', () => import('@/components/CostChart.vue'))
import MarkdownBody from '@/components/MarkdownBody.vue'
import NotFoundPage from '@/pages/NotFoundPage.vue'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { authorName, catalog, problemById, sourceUrl, type CatalogSolution, type CatalogVersion } from '@/catalog'
import { formatCost } from '@/charts/cost'
import { problemSeries } from '@/charts/series'

const route = useRoute()
const problem = computed(() => {
  const id = route.params.problemId
  return typeof id === 'string' ? problemById(id) : undefined
})

type SortKey = 'sandbox' | 'title' | 'cost' | 'author' | 'date' | 'steps' | 'rules'
const sortKey = ref<SortKey>('cost')
const sortAsc = ref(true)

function toggle(key: SortKey): void {
  if (sortKey.value === key) sortAsc.value = !sortAsc.value
  else {
    sortKey.value = key
    sortAsc.value = key !== 'date'
  }
}

type SolutionRow = {
  key: string
  version: CatalogVersion
  solution: CatalogSolution
  measured: string
  current: boolean
  domId: string
}

function domId(versionId: string, solutionId: string): string {
  return `solution-${versionId}-${solutionId}`.replace(/[^A-Za-z0-9_-]/g, '-')
}

function measuredAt(version: CatalogVersion, solution: CatalogSolution): string {
  const point = version.series.find(item => item.solution === solution.id)
  if (point) {
    const commit = catalog.commits.find(item => item.commit === point.commit)
    if (commit) return commit.timestamp
  }
  const match = solution.solutionPath.match(/(\d{4}-\d{2}-\d{2})_(\d{2})-(\d{2})-(\d{2})/)
  if (!match) throw new Error(`${solution.solutionPath} has no version timestamp`)
  return `${match[1]}T${match[2]}:${match[3]}:${match[4]}Z`
}

function rowAuthor(row: SolutionRow): string {
  return row.solution.author || row.version.author
}

function value(row: SolutionRow, key: SortKey): string | number {
  if (key === 'sandbox') return row.version.name
  if (key === 'title') return row.solution.title
  if (key === 'cost') return row.solution.cost ?? Number.POSITIVE_INFINITY
  if (key === 'author') return authorName(rowAuthor(row))
  if (key === 'date') return row.measured
  if (key === 'steps') return row.solution.steps ?? Number.POSITIVE_INFINITY
  return row.solution.ruleCount ?? Number.POSITIVE_INFINITY
}

const rows = computed(() => {
  const current = problem.value
  if (!current) return []
  const flat = current.versions.flatMap(version => version.solutions.map((solution, index) => ({
    key: `${version.id}/${solution.solutionPath}`,
    version,
    solution,
    measured: measuredAt(version, solution),
    current: index === 0,
    domId: '',
  })))
  const sorted = [...flat].sort((left, right) => {
    const a = value(left, sortKey.value)
    const b = value(right, sortKey.value)
    const order = a < b ? -1 : a > b ? 1 : left.key < right.key ? -1 : left.key > right.key ? 1 : 0
    return sortAsc.value ? order : -order
  })
  const bases = sorted.map(row => domId(row.version.id, row.solution.id))
  const seen = new Map<string, number>()
  return sorted.map((row, index) => {
    const base = bases[index] ?? domId(row.version.id, row.solution.id)
    const count = bases.filter(item => item === base).length
    const n = (seen.get(base) ?? 0) + 1
    seen.set(base, n)
    return { ...row, domId: count > 1 ? `${base}-${n}` : base }
  })
})

const showTitle = computed(() => rows.value.some(row => row.solution.title.length > 0))
const showAuthor = computed(() => rows.value.some(row => rowAuthor(row).length > 0))

function formatCount(value: number | null): string {
  return value == null ? 'unmeasured' : value.toLocaleString('en-US')
}

function ariaSort(key: SortKey): 'ascending' | 'descending' | 'none' {
  if (sortKey.value !== key) return 'none'
  return sortAsc.value ? 'ascending' : 'descending'
}
</script>

<template>
  <NotFoundPage v-if="!problem" />
  <DocPage v-else kicker="Problems" :title="problem.title" wide>
    <section class="flex flex-col gap-3">
      <h2 id="cost" class="text-xl font-semibold tracking-tight">Cost</h2>
      <CostChart :series="problemSeries(problem)" :label="`${problem.title} cost over time`" />
    </section>
    <MarkdownBody data-test="problem-description" :source="problem.description" />
    <div data-test="problem-credit" class="text-ash">
      <MarkdownBody :source="problem.credit" />
    </div>
    <section class="flex flex-col gap-3">
      <h2 id="solutions" class="text-xl font-semibold tracking-tight">Solutions</h2>
      <Table data-test="solutions-table">
        <TableHeader>
          <TableRow>
            <TableHead><button type="button" class="underline underline-offset-4" :aria-sort="ariaSort('sandbox')" @click="toggle('sandbox')">Entry</button></TableHead>
            <TableHead v-if="showTitle"><button type="button" class="underline underline-offset-4" :aria-sort="ariaSort('title')" @click="toggle('title')">Title</button></TableHead>
            <TableHead><button type="button" class="underline underline-offset-4" :aria-sort="ariaSort('cost')" @click="toggle('cost')">Cost</button></TableHead>
            <TableHead v-if="showAuthor"><button type="button" class="underline underline-offset-4" :aria-sort="ariaSort('author')" @click="toggle('author')">Author</button></TableHead>
            <TableHead><button type="button" class="underline underline-offset-4" :aria-sort="ariaSort('date')" @click="toggle('date')">Date</button></TableHead>
            <TableHead><button type="button" class="underline underline-offset-4" :aria-sort="ariaSort('steps')" @click="toggle('steps')">Steps</button></TableHead>
            <TableHead><button type="button" class="underline underline-offset-4" :aria-sort="ariaSort('rules')" @click="toggle('rules')">Rules</button></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow v-for="row in rows" :id="row.domId" :key="row.key" data-test="solution-row" :data-sandbox="row.version.id" :data-current="row.current ? 'true' : undefined" :data-slug="row.solution.id">
            <TableCell>
              <span v-if="row.version.id !== 'direct'" data-test="sandbox-color" class="mr-2 inline-block size-2.5 align-middle" :style="{ background: row.version.color }" />
              <a data-test="solution-link" class="underline underline-offset-4" :href="sourceUrl(row.solution.solutionPath)" rel="noreferrer">{{ row.version.id === 'direct' ? 'Direct Thue' : row.version.name }}</a>
            </TableCell>
            <TableCell v-if="showTitle" data-test="solution-title">{{ row.solution.title }}</TableCell>
            <TableCell data-test="solution-cost" class="font-mono">{{ row.solution.cost == null ? 'unmeasured' : formatCost(row.solution.cost) }}</TableCell>
            <TableCell v-if="showAuthor">{{ authorName(rowAuthor(row)) }}</TableCell>
            <TableCell class="font-mono">{{ row.measured.slice(0, 10) }}</TableCell>
            <TableCell class="font-mono">{{ formatCount(row.solution.steps) }}</TableCell>
            <TableCell class="font-mono">{{ formatCount(row.solution.ruleCount) }}</TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </section>
  </DocPage>
</template>
