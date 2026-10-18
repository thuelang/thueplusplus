<script setup lang="ts">
import { computed } from 'vue'
import Rex from '@/components/Rex.vue'
import { useRex } from '@/rex/useRex'
import type { PoseMode } from '@/rex/motion'

const props = defineProps<{ side: 'left' | 'right', mode: PoseMode }>()
const { pose } = useRex(() => props.mode)
const transform = computed(() => (
  props.side === 'left'
    ? 'translate(86 252) scale(1.28)'
    : 'translate(554 252) scale(1.28)'
))
</script>

<template>
  <g :transform="transform" data-test="explainer-rex">
    <Rex :pose="pose" />
  </g>
</template>
