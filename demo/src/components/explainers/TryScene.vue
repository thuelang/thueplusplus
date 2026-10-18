<script setup lang="ts">
import { computed } from 'vue'
import { smashFrame } from '@/explainers/frames'
import RexInScene from './RexInScene.vue'

const props = defineProps<{ t: number, reduced: boolean }>()
const frame = computed(() => smashFrame(props.t, props.reduced))
const smashing = computed(() => (
  frame.value.squash < 0.99
  || frame.value.lift !== 0
  || frame.value.letters.some(letter => letter.opacity > 0 && letter.dy !== 0)
))
const keys = Array.from({ length: 3 }, (_, row) => (
  Array.from({ length: 8 }, (_, col) => ({ id: `${row}-${col}`, x: 8 + col * 14, y: 8 + row * 14 }))
)).flat()

function letterTransform(index: number, dy: number, flip: number): string {
  const x = 22 + index * 28
  const y = 18 + dy
  return `translate(${x} ${y}) scale(${flip} 1)`
}
</script>

<template>
  <svg class="explainer-svg text-bone" viewBox="0 0 640 280" role="img" aria-label="Rex smashes the keyboard. Letters pop out, flip, and fade.">
    <g data-test="try-keyboard" :transform="`translate(78 ${132 + frame.lift}) translate(0 52) scale(1 ${frame.squash}) translate(0 -52)`">
      <rect width="124" height="52" fill="var(--surface)" stroke="currentColor" stroke-width="2" />
      <rect
        v-for="key in keys"
        :key="key.id"
        :x="key.x"
        :y="key.y"
        width="10"
        height="8"
        fill="currentColor"
      />
      <g
        v-for="(letter, index) in frame.letters"
        :key="letter.char"
        data-test="try-letter"
        :data-opacity="letter.opacity"
        :data-flip="letter.flip"
        :data-dy="letter.dy"
        :transform="letterTransform(index, letter.dy, letter.flip)"
        :opacity="letter.opacity"
      >
        <text
          x="0"
          y="0"
          text-anchor="middle"
          fill="var(--signal)"
          font-family="JetBrains Mono, ui-monospace, monospace"
          font-size="18"
        >{{ letter.char }}</text>
      </g>
    </g>
    <RexInScene side="left" :mode="smashing ? 'cheer' : 'offer'" />
  </svg>
</template>
