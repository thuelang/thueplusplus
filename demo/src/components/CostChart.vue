<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { axisTicks, costY, formatCost, polyline, polylineLength, runningMin, timeX, type PlacedPoint, type TimePoint } from '@/charts/cost'
import { ease } from '@/rex/motion'

const props = withDefaults(defineProps<{
  label: string
  spark?: boolean
  bars?: { id: string; label: string; value: number; color: string }[]
  series?: { id: string; label: string; color: string; points: TimePoint[] }[]
}>(), {
  spark: false,
  bars: () => [],
  series: () => [],
})

const width = 640
const height = computed(() => props.spark ? 96 : 280)
const pad = computed(() => props.spark
  ? { l: 8, r: 8, t: 8, b: 8 }
  : { l: 72, r: 16, t: 16, b: 36 })
const progress = ref(1)
let frame = 0

const reduced = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches

function stop(): void {
  cancelAnimationFrame(frame)
}

onMounted(() => {
  if (reduced()) return
  progress.value = 0
  const started = performance.now()
  const duration = 700
  const step = (now: number) => {
    progress.value = ease('out', (now - started) / duration)
    if (progress.value < 1) frame = requestAnimationFrame(step)
  }
  frame = requestAnimationFrame(step)
})

onBeforeUnmount(stop)

const inner = computed(() => ({
  left: pad.value.l,
  top: pad.value.t,
  width: width - pad.value.l - pad.value.r,
  height: height.value - pad.value.t - pad.value.b,
}))

const maxCost = computed(() => {
  const values = [
    ...props.bars.map(bar => bar.value),
    ...props.series.flatMap(item => item.points.map(point => point.cost)),
  ]
  return values.length === 0 ? 0 : Math.max(...values)
})

const ticks = computed(() => props.spark ? [] : axisTicks(maxCost.value))

const barShapes = computed(() => {
  const count = props.bars.length
  if (count === 0) return []
  const gap = Math.min(16, inner.value.width / (count * 4))
  const barWidth = (inner.value.width - gap * (count - 1)) / count
  return props.bars.map((bar, index) => {
    const x = inner.value.left + index * (barWidth + gap)
    const y = costY(bar.value, maxCost.value, inner.value.top, inner.value.height, progress.value)
    const base = inner.value.top + inner.value.height
    return { ...bar, x, y, width: barWidth, height: Math.max(0, base - y), text: formatCost(bar.value) }
  })
})

const drawnSeries = computed(() => {
  const times = props.series.flatMap(item => item.points.map(point => point.time))
  const min = times.length === 0 ? 0 : Math.min(...times)
  const max = times.length === 0 ? 0 : Math.max(...times)
  return props.series.map(item => {
    const ordered = [...item.points].sort((left, right) => left.time - right.time || left.cost - right.cost)
    const place = (points: readonly TimePoint[]): PlacedPoint[] => points.map(point => ({
      x: timeX(point.time, min, max, inner.value.left, inner.value.width),
      y: costY(point.cost, maxCost.value, inner.value.top, inner.value.height, progress.value),
    }))
    const points = place(ordered)
    const line = place(runningMin(ordered))
    return {
      ...item,
      points,
      line: polyline(line),
      length: polylineLength(line),
    }
  })
})

function tickY(value: number): number {
  return costY(value, maxCost.value, inner.value.top, inner.value.height, 1)
}
</script>

<template>
  <figure data-test="cost-chart" class="m-0">
    <svg
      :viewBox="`0 0 ${width} ${height}`"
      class="h-auto w-full"
      role="img"
      :aria-label="label"
    >
      <g v-if="!spark" fill="currentColor" font-family="JetBrains Mono, ui-monospace, monospace" font-size="11">
        <g v-for="tick in ticks" :key="tick">
          <line
            :x1="pad.l"
            :x2="width - pad.r"
            :y1="tickY(tick)"
            :y2="tickY(tick)"
            stroke="currentColor"
            stroke-opacity="0.18"
          />
          <text :x="pad.l - 8" :y="tickY(tick) + 4" text-anchor="end">{{ formatCost(tick) }}</text>
        </g>
      </g>
      <g v-for="bar in barShapes" :key="bar.id">
        <rect :x="bar.x" :y="bar.y" :width="bar.width" :height="bar.height" :fill="bar.color" />
        <text
          v-if="!spark"
          :x="bar.x + bar.width / 2"
          :y="height - 14"
          text-anchor="middle"
          fill="currentColor"
          font-family="JetBrains Mono, ui-monospace, monospace"
          font-size="12"
        >{{ bar.label }}</text>
      </g>
      <g v-for="item in drawnSeries" :key="item.id" :stroke="item.color" fill="none">
        <path
          v-if="item.points.length > 1"
          :d="item.line"
          stroke-width="2"
          :stroke-dasharray="item.length"
          :stroke-dashoffset="item.length * (1 - progress)"
        />
        <circle
          v-for="(point, index) in item.points"
          :key="`${item.id}-${index}`"
          :cx="point.x"
          :cy="point.y"
          :r="spark ? 3 : 4"
          :fill="item.color"
          stroke="none"
        />
      </g>
    </svg>
    <figcaption v-if="!spark && series.length > 0" data-test="cost-legend" class="mt-3 flex flex-wrap gap-x-4 gap-y-2 font-mono text-[12px]">
      <span v-for="item in series" :key="item.id" class="inline-flex items-center gap-2">
        <span class="inline-block size-2.5" :style="{ background: item.color }" />
        {{ item.label }}
      </span>
    </figcaption>
  </figure>
</template>
