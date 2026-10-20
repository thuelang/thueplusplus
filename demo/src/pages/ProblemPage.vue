<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRoute } from 'vue-router'
import DocPage from '@/components/DocPage.vue'
import CostChart from '@/components/CostChart.vue'
import MarkdownBody from '@/components/MarkdownBody.vue'
import NotFoundPage from '@/pages/NotFoundPage.vue'
import ProblemScene from '@/components/scenes/ProblemScene.vue'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { authorName, problemById, sourceUrl, type CatalogVersion } from '@/catalog'
import { formatCost } from '@/charts/cost'
import { problemSeries } from '@/charts/series'

const route = useRoute()
const problem = computed(() => {
  const id = route.params.problemId
  return typeof id === 'string' ? problemById(id) : undefined
})

type SortKey = 'sandbox' | 'cost' | 'author' | 'date' | 'steps' | 'rules'
const sortKey = ref<SortKey>('cost')
const sortAsc = ref(true)

function toggle(key: SortKey): void {
  if (sortKey.value === key) sortAsc.value = !sortAsc.value
  else {
    sortKey.value = key
    sortAsc.value = key !== 'date'
  }
}

function value(version: CatalogVersion, key: SortKey): string | number {
  const solution = version.solutions[0]
  if (!solution) throw new Error(`${version.id} has no solution`)
  if (key === 'sandbox') return version.name
  if (key === 'cost') return solution.cost ?? Number.POSITIVE_INFINITY
  if (key === 'author') return authorName(version.author)
  if (key === 'date') return version.measured
  if (key === 'steps') return solution.steps ?? Number.POSITIVE_INFINITY
  return solution.ruleCount ?? Number.POSITIVE_INFINITY
}

const rows = computed(() => {
  const current = problem.value
  if (!current) return []
  const sorted = [...current.versions].sort((left, right) => {
    const a = value(left, sortKey.value)
    const b = value(right, sortKey.value)
    const order = a < b ? -1 : a > b ? 1 : left.id < right.id ? -1 : left.id > right.id ? 1 : 0
    return sortAsc.value ? order : -order
  })
  return sorted
})

function requiredNumber(version: CatalogVersion, key: 'cost' | 'steps' | 'rules'): number {
  const solution = version.solutions[0]
  const value = key === 'cost' ? solution?.cost : key === 'steps' ? solution?.steps : solution?.ruleCount
  if (value == null) throw new Error(`${version.id} ${key} is missing`)
  return value
}

function ariaSort(key: SortKey): 'ascending' | 'descending' | 'none' {
  if (sortKey.value !== key) return 'none'
  return sortAsc.value ? 'ascending' : 'descending'
}
</script>

<template>
  <NotFoundPage v-if="!problem" />
  <DocPage v-else kicker="Problems" :title="problem.title" :summary="problem.summary" wide>
    <template #scene>
      <ProblemScene :problem-id="problem.id" :cases="problem.cases" />
    </template>
    <section id="cost" class="flex flex-col gap-3">
      <h2 class="text-xl font-semibold tracking-tight">Cost</h2>
      <CostChart :series="problemSeries(problem)" :label="`${problem.title} cost over time`" />
    </section>
    <MarkdownBody data-test="problem-description" :source="problem.description" />
    <div data-test="problem-credit" class="text-ash">
      <MarkdownBody :source="problem.credit" />
    </div>
    <section id="solutions" class="flex flex-col gap-3">
      <h2 class="text-xl font-semibold tracking-tight">Solutions</h2>
      <Table data-test="solutions-table">
        <TableHeader>
          <TableRow>
            <TableHead><button type="button" class="underline underline-offset-4" :aria-sort="ariaSort('sandbox')" @click="toggle('sandbox')">Sandbox</button></TableHead>
            <TableHead><button type="button" class="underline underline-offset-4" :aria-sort="ariaSort('cost')" @click="toggle('cost')">Cost</button></TableHead>
            <TableHead><button type="button" class="underline underline-offset-4" :aria-sort="ariaSort('author')" @click="toggle('author')">Author</button></TableHead>
            <TableHead><button type="button" class="underline underline-offset-4" :aria-sort="ariaSort('date')" @click="toggle('date')">Date</button></TableHead>
            <TableHead><button type="button" class="underline underline-offset-4" :aria-sort="ariaSort('steps')" @click="toggle('steps')">Steps</button></TableHead>
            <TableHead><button type="button" class="underline underline-offset-4" :aria-sort="ariaSort('rules')" @click="toggle('rules')">Rules</button></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow v-for="version in rows" :key="version.id" data-test="solution-row" :data-sandbox="version.id">
            <TableCell>
              <a data-test="solution-link" class="underline underline-offset-4" :href="sourceUrl(version.solutions[0].solutionPath)" rel="noreferrer">{{ version.name }}</a>
            </TableCell>
            <TableCell class="font-mono">{{ formatCost(requiredNumber(version, 'cost')) }}</TableCell>
            <TableCell>{{ authorName(version.author) }}</TableCell>
            <TableCell class="font-mono">{{ version.measured.slice(0, 10) }}</TableCell>
            <TableCell class="font-mono">{{ formatCost(requiredNumber(version, 'steps')) }}</TableCell>
            <TableCell class="font-mono">{{ formatCost(requiredNumber(version, 'rules')) }}</TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </section>
  </DocPage>
</template>
