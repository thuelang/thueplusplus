<script setup lang="ts">
import { computed } from 'vue'
import { SANDBOX_RULES, lerp, sandboxFrame } from '@/explainers/frames'
import RexInScene from './RexInScene.vue'

const props = defineProps<{ t: number, reduced: boolean }>()
const frame = computed(() => sandboxFrame(props.t, props.reduced))
const outX = computed(() => lerp(360, 520, frame.value.out))
</script>

<template>
  <svg class="explainer-svg text-bone" viewBox="0 0 640 280" role="img" aria-label="The program sits in a box. The host opened stdin and stdout. socket has no door.">
    <g data-test="sandbox-box" fill="none" stroke="currentColor" stroke-width="2">
      <line x1="168" y1="28" x2="456" y2="28" />
      <line x1="168" y1="236" x2="456" y2="236" />
      <line x1="168" y1="28" x2="168" y2="236" />
      <line x1="456" y1="28" x2="456" y2="78" />
      <line x1="456" y1="112" x2="456" y2="136" />
      <line x1="456" y1="170" x2="456" y2="236" />
    </g>
    <g font-family="JetBrains Mono, ui-monospace, monospace" font-size="14" fill="currentColor">
      <text v-for="(rule, index) in SANDBOX_RULES" :key="rule" data-test="sandbox-rule" x="180" :y="72 + index * 32">{{ rule }}</text>
      <text v-if="frame.socket >= 1" data-test="sandbox-error" x="180" y="160" fill="var(--signal)">ERR:resource:socket</text>
    </g>
    <g data-test="sandbox-door" data-resource="stdin">
      <text x="466" y="100" fill="currentColor" font-family="JetBrains Mono, ui-monospace, monospace" font-size="13">stdin</text>
    </g>
    <g data-test="sandbox-door" data-resource="stdout">
      <text x="466" y="132" fill="currentColor" font-family="JetBrains Mono, ui-monospace, monospace" font-size="13">stdout</text>
      <text
        data-test="sandbox-out"
        :data-outside="frame.out >= 1 ? 'yes' : 'no'"
        :x="outX"
        y="158"
        fill="var(--signal)"
        font-family="JetBrains Mono, ui-monospace, monospace"
        font-size="14"
      >in</text>
    </g>
    <RexInScene side="left" mode="read" />
  </svg>
</template>
