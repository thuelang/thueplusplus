<script setup lang="ts">
import { computed } from 'vue'
import { formatCost } from '@/charts/cost'

const props = defineProps<{
  marks: { id: string; label: string; color: string; cost: number }[]
}>()

const width = 320
const row = 22
const height = computed(() => props.marks.length * row)
const label = computed(() => props.marks.map(mark => `${mark.label} ${formatCost(mark.cost)}`).join(', '))
</script>

<template>
  <svg
    v-if="marks.length > 0"
    data-test="card-chart"
    :viewBox="`0 0 ${width} ${height}`"
    class="h-auto w-full"
    role="img"
    :aria-label="label"
  >
    <g v-for="(mark, index) in marks" :key="mark.id" :transform="`translate(0 ${index * row})`" :data-sandbox="mark.id">
      <circle data-test="card-mark" cx="8" cy="11" r="4" :fill="mark.color" />
      <text x="20" y="15" fill="currentColor" font-size="12" font-family="JetBrains Mono, ui-monospace, monospace">{{ mark.label }}</text>
      <text data-test="card-value" :x="width - 4" y="15" text-anchor="end" fill="currentColor" font-size="12" font-family="JetBrains Mono, ui-monospace, monospace">{{ formatCost(mark.cost) }}</text>
    </g>
  </svg>
</template>
