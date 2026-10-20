<script setup lang="ts">
import { computed, onBeforeUnmount, ref } from 'vue'
import { RouterLink } from 'vue-router'
import { Button } from '@/components/ui/button'
import { lazyComponent } from '@/trackedImport'

const CostChart = lazyComponent('src/components/CostChart.vue', () => import('@/components/CostChart.vue'))
const SandboxScene = lazyComponent('src/components/SandboxScene.vue', () => import('@/components/SandboxScene.vue'))
import SiteFooter from '@/components/SiteFooter.vue'
import { catalog } from '@/catalog'
import { problemTitle, sandboxCostSeries } from '@/charts/series'
import { formatCost } from '@/charts/cost'
import { registryHosts, repositoryUrl, soonLanguages } from '@/hosts'
import { beginRubble, type Rubble } from '@/sandbox/rubble'

const ready = registryHosts
const soon = soonLanguages
const rubble = ref<Rubble | null>(null)
const lines = sandboxCostSeries()
const common = catalog.sandboxCommon.map(id => ({ id, title: problemTitle(id) }))
const improvements = computed(() => catalog.improvements)
const chartLabel = computed(() => `Cost (lower is better) on ${common.map(problem => problem.title).join(', ')}`)

function sandboxLabel(id: string): string {
  const sandbox = catalog.sandboxes.find(item => item.id === id)
  if (!sandbox) throw new Error(`sandbox ${id} is not in the catalog`)
  return sandbox.name
}

function onBreak(reduced: boolean): void {
  rubble.value?.restore(true)
  rubble.value = beginRubble(reduced)
}

function onRebuilt(): void {
  rubble.value?.restore(false)
}

onBeforeUnmount(() => {
  rubble.value?.restore(true)
  rubble.value = null
})
</script>

<template>
  <div class="overflow-x-clip">
  <div class="mx-auto w-full max-w-[1320px]">
    <div class="page-screen page-screen-bare home-screen">
      <section data-test="page-hero" class="page-hero home-hero px-4 sm:px-6 lg:px-14">
        <div class="hero-stage">
        <div class="rex-bleed" data-test="belt-bleed">
          <SandboxScene @break="onBreak" @rebuilt="onRebuilt" />
        </div>
        <div class="hero-copy-wrap pointer-events-none z-10 grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(280px,1fr)] lg:items-center">
          <div class="hidden lg:block" aria-hidden="true" />
          <div class="hero-copy pointer-events-auto min-w-0 lg:justify-self-end">
            <div class="hero-veil" data-test="hero-veil" aria-hidden="true" />
            <h1 data-shard class="font-display text-[15px] font-semibold tracking-[-0.03em]">Thue++</h1>
            <p data-shard class="font-display mt-3 text-[clamp(32px,4.2vw,48px)] leading-[1.02] font-extrabold tracking-[-0.05em]">The safest, smallest, sandbox.</p>
            <p data-shard data-test="page-summary" class="text-ash mt-3 max-w-[640px] font-sans text-[15px] leading-snug">A program is rules and one string. The host decides what it can touch.</p>
            <p data-shard data-test="landing-languages" class="text-ash mt-3 max-w-[640px] font-sans text-[15px] leading-snug">
              Available in
              <template v-for="(language, index) in ready" :key="language.id">
                <span v-if="index > 0">, </span><RouterLink :to="language.href" class="text-bone hover:text-signal transition-colors duration-150 ease-out">{{ language.landing }}</RouterLink>
              </template><template v-if="soon.length">, and soon {{ soon.join(', ') }}</template>
            </p>
            <div class="mt-4 flex flex-wrap gap-2">
              <Button as-child size="lg" data-shard>
                <RouterLink to="/install" data-test="hero-install">install</RouterLink>
              </Button>
              <Button as-child size="lg" variant="outline" data-shard>
                <RouterLink to="/sandboxes" data-test="hero-sandboxes">sandboxes</RouterLink>
              </Button>
              <Button as-child size="lg" variant="outline" data-shard>
                <RouterLink to="/problems" data-test="hero-problems">problems</RouterLink>
              </Button>
            </div>
          </div>
        </div>
        </div>
      </section>
      <div class="page-screen-gap" aria-hidden="true" />
    </div>

    <div data-test="page-details" class="page-details flex w-full flex-col gap-10 pb-16">
    <section id="cost" data-test="featured-sandboxes" class="flex flex-col gap-4 px-4 sm:px-6 lg:px-14">
      <h2 class="font-display text-[clamp(28px,4vw,40px)] leading-none font-extrabold tracking-[-0.04em]">Cost (lower is better)</h2>
      <p data-test="cost-summary" class="text-ash max-w-[760px] font-sans text-[15px] leading-snug">This is the cumulative cost of the problems that have solutions in all sandboxes. This allows us to compare sandbox implementations fairly. Cost is calculated by the cumulative size of the state per step of evaluation. Essentially total memory over time.</p>
      <CostChart v-if="lines.length" track="sum" :series="lines" :label="chartLabel" />
    </section>

    <section v-if="improvements.length" id="improvements" data-test="improvements" class="flex flex-col gap-3 px-4 sm:px-6 lg:px-14">
      <h2 class="font-display text-[clamp(28px,4vw,40px)] leading-none font-extrabold tracking-[-0.04em]">Improvements</h2>
      <ul class="flex flex-col gap-3 font-mono text-[13px]">
        <li
          v-for="(event, index) in improvements"
          :key="`${event.commit}-${event.kind}-${event.sandbox}-${event.problem}-${index}`"
          data-test="improvement"
          class="grid grid-cols-1 gap-x-4 gap-y-1 sm:grid-cols-[7.5rem_7rem_minmax(0,1fr)_auto_auto] sm:items-baseline"
        >
          <a data-test="improvement-commit" class="underline underline-offset-4" :href="`${repositoryUrl}/commit/${event.commit}`" rel="noreferrer">{{ event.timestamp.slice(0, 10) }}</a>
          <span v-if="event.sandbox === 'direct'" data-test="improvement-sandbox">Direct Thue</span>
          <RouterLink v-else data-test="improvement-sandbox" :to="`/sandboxes/${event.sandbox}`" class="underline underline-offset-4">{{ sandboxLabel(event.sandbox) }}</RouterLink>
          <RouterLink v-if="event.problem" data-test="improvement-problem" :to="`/problems/${event.problem}`" class="underline underline-offset-4">{{ problemTitle(event.problem) }}</RouterLink>
          <span v-else data-test="improvement-problem">common problems</span>
          <span data-test="improvement-before">{{ formatCost(event.before) }}</span>
          <span data-test="improvement-after">→ {{ formatCost(event.after) }}</span>
        </li>
      </ul>
    </section>
    </div>

    <SiteFooter data-shard class="px-4 sm:px-6 lg:px-14" />
  </div>
  </div>
</template>
