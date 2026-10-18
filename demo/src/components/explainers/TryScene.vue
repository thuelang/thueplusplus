<script setup lang="ts">
import { computed } from 'vue'
import { keyboardX } from '@/explainers/frames'
import RexInScene from './RexInScene.vue'

const props = defineProps<{ t: number, reduced: boolean }>()
const x = computed(() => keyboardX(props.t, props.reduced))
const keys = Array.from({ length: 3 }, (_, row) => (
  Array.from({ length: 8 }, (_, col) => ({ id: `${row}-${col}`, x: 8 + col * 14, y: 8 + row * 14 }))
)).flat()
</script>

<template>
  <svg class="explainer-svg text-bone" viewBox="0 0 640 280" role="img" aria-label="Rex hands over the keyboard.">
    <g data-test="try-keyboard" :transform="`translate(${x} 156)`">
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
    </g>
    <RexInScene side="left" mode="offer" />
  </svg>
</template>
