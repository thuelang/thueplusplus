<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { use } from 'echarts/core'
import { LineChart } from 'echarts/charts'
import { GridComponent, LegendComponent, TooltipComponent } from 'echarts/components'
import { SVGRenderer } from 'echarts/renderers'
import VChart from 'vue-echarts'
import type { ComposeOption } from 'echarts/core'
import type { LineSeriesOption } from 'echarts/charts'
import type { GridComponentOption, LegendComponentOption, TooltipComponentOption } from 'echarts/components'
import { formatCost, type TimePoint } from '@/charts/cost'
import { tooltipHtml } from '@/charts/tooltip'

use([LineChart, GridComponent, TooltipComponent, LegendComponent, SVGRenderer])

type ChartOption = ComposeOption<LineSeriesOption | GridComponentOption | TooltipComponentOption | LegendComponentOption>

export interface ChartSeries {
  id: string
  label: string
  color: string
  points: TimePoint[]
}

const props = withDefaults(defineProps<{
  label: string
  card?: boolean
  track?: 'sum' | 'best'
  series?: ChartSeries[]
}>(), {
  card: false,
  track: 'best',
  series: () => [],
})

const scale = ref<'linear' | 'log'>('linear')
const axis = ref<'date' | 'index'>('date')
const hidden = ref<Record<string, boolean>>({})
const reduced = ref(false)
const theme = ref(0)
let observer: MutationObserver | null = null
let media: MediaQueryList | null = null

function readReduced(): boolean {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

function onReduced(): void {
  reduced.value = readReduced()
}

onMounted(() => {
  reduced.value = readReduced()
  media = window.matchMedia('(prefers-reduced-motion: reduce)')
  media.addEventListener('change', onReduced)
  observer = new MutationObserver(() => {
    theme.value += 1
  })
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })
})

onBeforeUnmount(() => {
  media?.removeEventListener('change', onReduced)
  observer?.disconnect()
})

const drawn = computed(() => props.series.filter(item => item.points.length > 0))

function shown(item: ChartSeries): boolean {
  return hidden.value[item.id] !== true
}

function toggle(item: ChartSeries): void {
  hidden.value = { ...hidden.value, [item.id]: shown(item) }
}

function endCost(item: ChartSeries): number {
  const ordered = [...item.points].sort((left, right) => left.time - right.time)
  const last = ordered[ordered.length - 1]
  if (!last) throw new Error(`${item.label} has no cost`)
  return last.cost
}

function cssVar(name: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim()
}

function seriesColor(color: string): string {
  const match = /^var\((--[A-Za-z0-9-]+)\)$/.exec(color)
  if (!match) return color
  const resolved = cssVar(match[1] ?? '')
  return resolved || color
}

const option = computed<ChartOption>(() => {
  theme.value
  const items = drawn.value
  const costs = items.flatMap(item => item.points.map(point => point.cost))
  if (scale.value === 'log') {
    for (const item of items) {
      for (const point of item.points) {
        if (point.cost <= 0) throw new Error(`log scale cannot plot ${item.label} cost ${point.cost}`)
      }
    }
  }
  const times = [...new Set(items.flatMap(item => item.points.map(point => point.time)))].sort((left, right) => left - right)
  const indexOf = new Map(times.map((time, index) => [time, String(index + 1)]))
  const bone = cssVar('--bone') || '#e8e6e1'
  const ash = cssVar('--ash') || '#a09e99'
  const line = cssVar('--line') || '#202026'
  const surface = cssVar('--surface') || '#111114'
  const font = 'JetBrains Mono, ui-monospace, monospace'
  const categories = times.map((_, index) => String(index + 1))
  return {
    animation: !reduced.value,
    animationDuration: reduced.value ? 0 : 700,
    textStyle: { fontFamily: font, color: bone },
    grid: {
      left: props.card ? 8 : 12,
      right: props.card ? 8 : 16,
      top: props.card ? 10 : 16,
      bottom: props.card ? 8 : 28,
      outerBoundsMode: props.card ? 'none' : 'same',
      outerBoundsContain: 'axisLabel',
    },
    legend: {
      show: false,
      data: items.map(item => item.label),
      selected: Object.fromEntries(items.map(item => [item.label, shown(item)])),
    },
    tooltip: {
      trigger: 'item',
      enterable: true,
      renderMode: 'html',
      confine: true,
      appendToBody: true,
      triggerOn: 'mousemove|click',
      className: 'cost-tip',
      backgroundColor: surface,
      borderColor: line,
      textStyle: { color: bone, fontFamily: font, fontSize: 12 },
      formatter: (raw: unknown) => {
        const params = raw as { seriesName?: string; data?: TimePoint }
        if (!params.seriesName || !params.data) throw new Error('chart tooltip has no point')
        return tooltipHtml(params.seriesName, params.data)
      },
    },
    xAxis: axis.value === 'date'
      ? { type: 'time', axisLabel: { color: ash, fontFamily: font, hideOverlap: true }, axisLine: { lineStyle: { color: line } } }
      : { type: 'category', data: categories, axisLabel: { color: ash, fontFamily: font, hideOverlap: true }, axisLine: { lineStyle: { color: line } } },
    yAxis: {
      type: scale.value === 'log' ? 'log' : 'value',
      min: scale.value === 'log' ? 'dataMin' : 0,
      max: costs.length === 0 ? 1 : undefined,
      axisLabel: { color: ash, fontFamily: font, hideOverlap: true, formatter: (value: number) => formatCost(value) },
      splitLine: { lineStyle: { color: line } },
      axisLine: { lineStyle: { color: line } },
    },
    series: items.map(item => ({
      name: item.label,
      type: 'line' as const,
      showSymbol: true,
      symbol: 'circle',
      symbolSize: props.card ? 6 : 8,
      connectNulls: false,
      color: seriesColor(item.color),
      lineStyle: { width: props.card ? 1.5 : 2, color: seriesColor(item.color) },
      data: [...item.points]
        .sort((left, right) => left.time - right.time)
        .map(point => ({
          value: axis.value === 'date' ? [point.time, point.cost] : [indexOf.get(point.time), point.cost],
          cost: point.cost,
          time: point.time,
          link: point.link,
          parts: point.parts,
        })),
    })),
  } as unknown as ChartOption
})
</script>

<template>
  <figure
    :data-test="card ? 'card-chart' : 'cost-chart'"
    class="m-0 flex flex-col gap-2"
    :data-scale="scale"
    :data-x="axis"
    :data-track="track"
    :data-card="card ? 'true' : undefined"
    :aria-label="label"
  >
    <div v-if="!card" data-test="chart-toggles" class="flex flex-wrap gap-2">
      <button type="button" data-test="y-linear" class="cost-toggle" :aria-pressed="scale === 'linear'" @click="scale = 'linear'">Linear</button>
      <button type="button" data-test="y-log" class="cost-toggle" :aria-pressed="scale === 'log'" @click="scale = 'log'">Log</button>
      <button type="button" data-test="x-date" class="cost-toggle" :aria-pressed="axis === 'date'" @click="axis = 'date'">Date</button>
      <button type="button" data-test="x-index" class="cost-toggle" :aria-pressed="axis === 'index'" @click="axis = 'index'">Index</button>
    </div>
    <VChart
      :class="card ? 'cost-plot cost-plot-card' : 'cost-plot'"
      :option="option"
      :init-options="{ renderer: 'svg' }"
      autoresize
    />
    <ul data-test="cost-legend" class="m-0 flex list-none flex-wrap gap-x-4 gap-y-1 p-0 font-mono text-[12px]">
      <li v-for="item in drawn" :key="item.id">
        <button
          v-if="!card"
          type="button"
          class="cost-legend-button"
          :data-series="item.id"
          data-test="end-label"
          :data-sandbox="item.id"
          :aria-pressed="shown(item)"
          @click="toggle(item)"
        >
          <span class="cost-swatch" :style="{ background: item.color }" />
          {{ item.label }} {{ formatCost(endCost(item)) }}
        </button>
        <span v-else data-test="end-label" :data-series="item.id" :data-sandbox="item.id">
          <span class="cost-swatch" :style="{ background: item.color }" />
          {{ item.label }} {{ formatCost(endCost(item)) }}
        </span>
      </li>
    </ul>
  </figure>
</template>

<style scoped>
.cost-plot {
  width: 100%;
  height: 320px;
}
.cost-plot-card {
  height: 88px;
}
.cost-toggle,
.cost-legend-button {
  border: 1px solid var(--line);
  background: transparent;
  color: var(--ash);
  font-family: inherit;
  font-size: 12px;
  line-height: 1.2;
  padding: 0.25rem 0.5rem;
}
.cost-toggle[aria-pressed="true"],
.cost-legend-button[aria-pressed="true"] {
  color: var(--bone);
  border-color: var(--bone);
}
.cost-legend-button[aria-pressed="false"] {
  opacity: 0.45;
}
.cost-swatch {
  display: inline-block;
  width: 0.625rem;
  height: 0.625rem;
  margin-right: 0.35rem;
  vertical-align: middle;
}
</style>
