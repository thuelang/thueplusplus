<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { chartLayout, type TimePoint } from '@/charts/cost'
import { ease } from '@/rex/motion'

const props = withDefaults(defineProps<{
  label: string
  spark?: boolean
  track?: 'sum' | 'best'
  series?: { id: string; label: string; color: string; points: TimePoint[] }[]
}>(), {
  spark: false,
  track: 'best',
  series: () => [],
})

const width = 640
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

const height = computed(() => props.spark ? 96 : 280)

const layout = computed(() => chartLayout(props.series, {
  width,
  height: height.value,
  spark: props.spark,
  track: props.track,
  progress: progress.value,
}))

const caption = computed(() => props.label)
</script>

<template>
  <figure data-test="cost-chart" class="m-0" :data-scale="layout.scale" :data-track="track">
    <svg
      :viewBox="`0 0 ${width} ${height}`"
      class="h-auto w-full"
      role="img"
      :aria-label="caption"
    >
      <g v-if="!spark" fill="currentColor" font-family="JetBrains Mono, ui-monospace, monospace" font-size="11">
        <g v-for="tick in layout.ticks" :key="tick.text">
          <line
            :x1="layout.pad.l"
            :x2="width - layout.pad.r"
            :y1="tick.y"
            :y2="tick.y"
            stroke="currentColor"
            stroke-opacity="0.18"
          />
          <text :x="layout.pad.l - 8" :y="tick.y + 4" text-anchor="end">{{ tick.text }}</text>
        </g>
        <text
          v-for="label in layout.labels"
          :key="label.text + label.x"
          data-test="time-label"
          :x="label.x"
          :y="height - 10"
          text-anchor="middle"
        >{{ label.text }}</text>
      </g>
      <g v-for="item in layout.series" :key="item.id" :stroke="item.color" fill="none">
        <path
          v-if="item.line.length > 1"
          :d="item.d"
          stroke-width="2"
          :stroke-dasharray="item.length"
          :stroke-dashoffset="item.length * (1 - progress)"
        />
        <circle
          v-for="(point, index) in item.dots"
          :key="`${item.id}-${index}`"
          data-test="cost-dot"
          :data-sandbox="item.id"
          :cx="point.x"
          :cy="point.y"
          :r="layout.radius"
          :fill="item.color"
          stroke="none"
        />
      </g>
      <g v-if="!spark" font-family="JetBrains Mono, ui-monospace, monospace" font-size="11">
        <text
          v-for="label in layout.ends"
          :key="label.id"
          data-test="end-label"
          :data-sandbox="label.id"
          :x="label.x"
          :y="label.y"
          dominant-baseline="middle"
          :fill="label.color"
        >{{ label.text }}</text>
      </g>
    </svg>
    <figcaption v-if="!spark && series.length > 0" data-test="cost-legend" class="mt-3 flex flex-wrap gap-x-4 gap-y-2 font-mono text-[12px]">
      <span v-for="item in series" :key="item.id" class="inline-flex items-center gap-2" :data-series="item.id">
        <span class="inline-block size-2.5" :style="{ background: item.color }" />
        {{ item.label }}
      </span>
    </figcaption>
  </figure>
</template>
