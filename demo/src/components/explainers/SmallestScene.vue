<script setup lang="ts">
import { computed } from 'vue'
import { helloRules, smallestFrame } from '@/explainers/frames'
import RexInScene from './RexInScene.vue'

const props = defineProps<{ t: number, reduced: boolean }>()
const frame = computed(() => smallestFrame(props.t, props.reduced))
const pitch = 9.6
const stateX = 16
const stateY = 156

function matchX(line: string, match: string): number {
  const at = line.indexOf(match)
  if (at < 0) return stateX
  return stateX + at * pitch
}
</script>

<template>
  <svg class="explainer-svg text-bone" viewBox="0 0 640 280" role="img" aria-label="Rex steps through hello.thue. Each match is marked, then replaced.">
    <g font-family="JetBrains Mono, ui-monospace, monospace" font-size="15">
      <text
        v-for="(rule, index) in helloRules"
        :key="rule"
        data-test="smallest-rule"
        :data-active="frame.step === index && frame.mark > 0 ? 'yes' : 'no'"
        x="16"
        :y="36 + index * 24"
        :fill="frame.step === index && frame.mark > 0 ? 'var(--signal)' : 'currentColor'"
      >{{ rule }}</text>
    </g>
    <g font-family="JetBrains Mono, ui-monospace, monospace" font-size="16">
      <template v-for="(line, index) in frame.lines" :key="`state-${index}`">
        <rect
          v-if="frame.matchLine === index && frame.matchText.length > 0"
          data-test="smallest-match"
          :data-match="frame.matchText"
          :x="matchX(line, frame.matchText) - 2"
          :y="stateY + index * 24 - 16"
          :width="frame.matchText.length * pitch + 4"
          height="22"
          fill="var(--signal-wash)"
          stroke="var(--signal)"
        />
        <text data-test="smallest-state" :x="stateX" :y="stateY + index * 24" fill="currentColor">{{ line }}</text>
      </template>
      <text
        v-for="(line, index) in frame.result"
        :key="`result-${line}`"
        data-test="smallest-result"
        :x="stateX"
        :y="stateY + frame.lines.length * 24 + index * 24"
        fill="var(--signal)"
      >{{ line }}</text>
      <text v-if="frame.stdout" data-test="smallest-stdout" x="16" y="248" fill="currentColor">stdout {{ frame.stdout }}</text>
      <text v-if="frame.exit" data-test="smallest-exit" x="220" y="248" fill="currentColor">exit 0</text>
    </g>
    <RexInScene side="right" mode="search" />
  </svg>
</template>
