<script setup lang="ts">
import { computed } from 'vue'
import { registryHosts } from '@/hosts'
import { PORTABLE_CARD, PORTABLE_OUTPUT, cardX, hostSlotY, portableFrame, portableOutputVisible } from '@/explainers/frames'
import RexInScene from './RexInScene.vue'

const props = defineProps<{ t: number, reduced: boolean }>()
const frame = computed(() => portableFrame(props.t, props.reduced, registryHosts.length))
const rows = computed(() => registryHosts.map((host, index) => ({
  host,
  y: hostSlotY(index, registryHosts.length),
  shown: portableOutputVisible(index, frame.value),
})))
const cardTransform = computed(() => {
  const row = rows.value[frame.value.index]
  if (!row) throw new Error(`portable card has no host at ${frame.value.index}`)
  return `translate(${cardX(frame.value.travel)} ${row.y - 28})`
})
</script>

<template>
  <svg class="explainer-svg text-bone" viewBox="0 0 640 280" role="img" aria-label="The hello.thue card visits every host. Each host prints Hello, World!">
    <g
      data-test="portable-card"
      :transform="cardTransform"
    >
      <rect width="150" height="40" fill="var(--surface)" stroke="currentColor" stroke-width="2" />
      <text x="8" y="16" fill="currentColor" font-family="JetBrains Mono, ui-monospace, monospace" font-size="12">{{ PORTABLE_CARD }}</text>
      <text x="8" y="32" fill="currentColor" font-family="JetBrains Mono, ui-monospace, monospace" font-size="12">{{ PORTABLE_OUTPUT }}</text>
    </g>
    <g font-family="JetBrains Mono, ui-monospace, monospace" font-size="14" fill="currentColor">
      <text
        v-for="row in rows"
        :key="row.host.id"
        data-test="portable-host"
        :data-host-id="row.host.id"
        x="210"
        :y="row.y"
      >{{ row.host.landing }}</text>
      <text
        v-for="row in rows"
        :key="`${row.host.id}-out`"
        v-show="row.shown"
        data-test="portable-output"
        :data-host-id="row.host.id"
        x="300"
        :y="row.y"
      >{{ PORTABLE_OUTPUT }}</text>
    </g>
    <RexInScene side="right" mode="offer" />
  </svg>
</template>
