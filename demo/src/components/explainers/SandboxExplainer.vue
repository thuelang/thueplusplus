<script setup lang="ts">
import { computed } from 'vue'
import {
  SANDBOX_ERROR,
  SANDBOX_OUT_TEXT,
  SANDBOX_RULES,
  SANDBOX_WALL_X,
  sandboxFrame,
} from '@/explainers/frames'
import RexInScene from './RexInScene.vue'

const props = defineProps<{ t: number, reduced: boolean }>()
const frame = computed(() => sandboxFrame(props.t, props.reduced))
const state = computed(() => (frame.value.out >= 1 || frame.value.error >= 1 ? '' : 'start'))
</script>

<template>
  <svg class="explainer-svg text-bone" viewBox="0 0 640 280" role="img" aria-label="The host gave stdout. hello goes out that door. socket bumps the wall and the error returns to the string.">
    <g data-test="sandbox-box" fill="none" stroke="currentColor" stroke-width="2">
      <line x1="210" y1="28" x2="470" y2="28" />
      <line x1="210" y1="248" x2="470" y2="248" />
      <line x1="210" y1="28" x2="210" y2="248" />
      <line x1="470" y1="28" x2="470" y2="58" />
      <line x1="470" y1="102" x2="470" y2="248" />
    </g>
    <g data-test="sandbox-door" data-resource="stdout">
      <text x="482" y="86" fill="currentColor" font-family="JetBrains Mono, ui-monospace, monospace" font-size="13">stdout</text>
    </g>
    <g font-family="JetBrains Mono, ui-monospace, monospace" font-size="13" fill="currentColor">
      <text
        v-for="(rule, index) in SANDBOX_RULES"
        :key="rule"
        data-test="sandbox-rule"
        :data-active="(index === 0 ? frame.stdout : frame.socket) > 0.5 ? 'yes' : 'no'"
        x="222"
        :y="132 + index * 28"
        :fill="(index === 0 ? frame.stdout : frame.socket) > 0.5 ? 'var(--signal)' : 'currentColor'"
      >{{ rule }}</text>
      <text v-if="state" data-test="sandbox-state" x="222" y="214">{{ state }}</text>
      <text
        v-if="frame.error > 0"
        data-test="sandbox-error"
        data-inside="yes"
        x="222"
        y="214"
        :opacity="frame.error"
        fill="var(--signal)"
      >{{ SANDBOX_ERROR }}</text>
    </g>
    <text
      data-test="sandbox-out"
      :data-outside="frame.outX > SANDBOX_WALL_X ? 'yes' : 'no'"
      :x="frame.outX"
      y="86"
      fill="var(--signal)"
      font-family="JetBrains Mono, ui-monospace, monospace"
      font-size="16"
    >{{ SANDBOX_OUT_TEXT }}</text>
    <text
      v-if="frame.tokenShow"
      data-test="sandbox-token"
      :x="frame.tokenX"
      y="176"
      fill="var(--signal)"
      font-family="JetBrains Mono, ui-monospace, monospace"
      font-size="16"
    >x</text>
    <RexInScene side="left" mode="read" />
  </svg>
</template>
