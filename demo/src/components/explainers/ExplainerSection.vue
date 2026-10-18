<script setup lang="ts">
defineProps<{
  id: string
  title: string
  rex: 'left' | 'right'
}>()
</script>

<template>
  <article
    :id="id"
    class="explainer"
    :class="rex === 'right' ? 'rex-right' : 'rex-left'"
    data-test="explainer"
    :data-explainer="id"
    :data-rex="rex"
  >
    <div class="explainer-body">
      <div class="explainer-scene">
        <slot name="scene" />
      </div>
      <div class="explainer-copy">
        <h2 class="font-display text-[18px] font-semibold tracking-[-0.03em]">{{ title }}</h2>
        <div class="text-ash mt-2 flex flex-col gap-2 font-sans text-[14px] leading-snug">
          <slot />
        </div>
      </div>
    </div>
  </article>
</template>
