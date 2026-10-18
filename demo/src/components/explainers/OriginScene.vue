<script setup lang="ts">
import { computed } from 'vue'
import { LHS_CAPTION, ORIGIN, RHS_CAPTION, originFrame } from '@/explainers/frames'
import RexInScene from './RexInScene.vue'

const props = defineProps<{ t: number, reduced: boolean }>()
const frame = computed(() => originFrame(props.t, props.reduced))
const marked = computed(() => frame.value.mark > 0.2 ? 'var(--signal)' : 'currentColor')
const shown = computed(() => frame.value.swap >= 0.5 ? 'o' : 'a')
</script>

<template>
  <svg class="explainer-svg text-bone" viewBox="0 0 640 280" role="img" aria-label="Rex holds an lhs card and an rhs card. One rule rewrites cat to cot.">
    <g font-family="JetBrains Mono, ui-monospace, monospace" font-size="14">
      <text data-test="lhs-caption" x="180" y="32" fill="currentColor">{{ LHS_CAPTION }}</text>
      <text data-test="rhs-caption" x="180" y="52" fill="currentColor">{{ RHS_CAPTION }}</text>
    </g>
    <g :transform="`translate(${frame.lhsX} ${frame.lhsY})`" data-test="lhs-card">
      <rect :width="ORIGIN.cardW" :height="ORIGIN.cardH" fill="var(--surface)" stroke="currentColor" stroke-width="2" />
      <text x="32" y="21" text-anchor="middle" fill="currentColor" font-family="JetBrains Mono, ui-monospace, monospace" font-size="14">lhs</text>
    </g>
    <g :transform="`translate(${frame.rhsX} ${frame.rhsY})`" data-test="rhs-card">
      <rect :width="ORIGIN.cardW" :height="ORIGIN.cardH" fill="var(--surface)" stroke="currentColor" stroke-width="2" />
      <text x="32" y="21" text-anchor="middle" fill="currentColor" font-family="JetBrains Mono, ui-monospace, monospace" font-size="14">rhs</text>
    </g>
    <text data-test="origin-rule" :x="ORIGIN.ruleX" :y="ORIGIN.ruleY" fill="currentColor" font-family="JetBrains Mono, ui-monospace, monospace" font-size="22">
      <tspan :fill="marked">a</tspan><tspan> ::= </tspan><tspan :fill="marked">o</tspan>
    </text>
    <template v-if="reduced">
      <text data-test="origin-before" :x="ORIGIN.ruleX" :y="ORIGIN.beforeY" fill="currentColor" font-family="JetBrains Mono, ui-monospace, monospace" font-size="22">c<tspan fill="var(--signal)">a</tspan>t</text>
      <text data-test="origin-after" :x="ORIGIN.ruleX" :y="ORIGIN.afterY" fill="currentColor" font-family="JetBrains Mono, ui-monospace, monospace" font-size="22">c<tspan fill="var(--signal)">o</tspan>t</text>
    </template>
    <text
      v-else-if="frame.showBefore || frame.showAfter"
      :data-test="frame.swap >= 0.5 ? 'origin-after' : 'origin-before'"
      :x="ORIGIN.ruleX"
      :y="ORIGIN.beforeY"
      fill="currentColor"
      font-family="JetBrains Mono, ui-monospace, monospace"
      font-size="22"
    >c<tspan :fill="marked">{{ shown }}</tspan>t</text>
    <RexInScene side="left" mode="read" />
  </svg>
</template>
