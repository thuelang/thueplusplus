<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import { headerLinkCurrent, headerLinks } from '@/nav'
import { dismissNav, fadeNav, navSnapshot, subscribeNav, type NavProgressSnapshot } from '@/navProgress'
import { reachSide, swapHat } from '@/rex/mascot'
import Mark from './Mark.vue'
import ThemeToggle from './ThemeToggle.vue'

const route = useRoute()
const reduced = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches
const progress = ref<NavProgressSnapshot>(navSnapshot())
const stopNav = subscribeNav(snapshot => {
  progress.value = snapshot
})
let hideTimer = 0

const barStyle = computed(() => {
  const state = progress.value.state
  if (state === 'idle') return { transform: 'scaleX(0)', opacity: '0', transition: 'none' }
  if (state === 'indeterminate') return { transform: 'none', opacity: '1', transition: 'none' }
  const motion = reduced() ? 'none' : state === 'fade' ? 'opacity 200ms ease' : 'transform 150ms ease'
  return {
    transform: `scaleX(${progress.value.scale})`,
    opacity: state === 'fade' ? '0' : '1',
    transition: motion,
  }
})

watch(() => progress.value.state, state => {
  window.clearTimeout(hideTimer)
  if (state !== 'done' && state !== 'fade') return
  hideTimer = window.setTimeout(() => dismissNav(), 700)
})

function onBarTransition(event: TransitionEvent): void {
  if (progress.value.state === 'done' && event.propertyName === 'transform') {
    fadeNav()
    return
  }
  if (progress.value.state === 'fade' && event.propertyName === 'opacity') dismissNav()
}

onBeforeUnmount(() => {
  window.clearTimeout(hideTimer)
  stopNav()
})

function onSwap(): void {
  const side = reachSide()
  swapHat(side === 'left' ? 'left' : 'right')
}
</script>

<template>
  <header data-shard data-test="site-header" class="bg-void border-line sticky top-0 z-30 flex h-[52px] items-center gap-2 border-b px-3 font-mono text-[13px] sm:gap-3 sm:px-6">
    <div class="text-bone flex shrink-0 items-center gap-2">
      <button
        type="button"
        class="-m-1 shrink-0 cursor-pointer border-0 bg-transparent p-1 text-inherit"
        aria-label="Swap Rex's hat"
        data-test="swap-hat"
        @click="onSwap"
      >
        <Mark />
      </button>
      <RouterLink to="/" class="font-display font-semibold tracking-[-0.03em] max-[640px]:sr-only" :aria-current="route.path === '/' ? 'page' : undefined">Thue++</RouterLink>
    </div>
    <nav class="ml-1 flex min-w-0 items-center gap-x-2 sm:gap-x-3" data-test="site-nav" aria-label="Site">
      <RouterLink
        v-for="link in headerLinks"
        :key="link.to"
        :to="link.to"
        class="shrink-0 lowercase transition-colors duration-150 ease-out"
        :class="headerLinkCurrent(route.path, link.to) ? 'text-bone' : 'text-ash hover:text-bone'"
        :aria-current="headerLinkCurrent(route.path, link.to) ? 'page' : undefined"
      >
        {{ link.title }}
      </RouterLink>
    </nav>
    <div class="flex-1" />
    <ThemeToggle />
    <div
      data-test="nav-progress"
      class="nav-progress bg-primary pointer-events-none absolute inset-x-0 -bottom-px h-[2px] origin-left"
      role="progressbar"
      aria-label="Loading page"
      aria-valuemin="0"
      aria-valuemax="100"
      :aria-valuenow="progress.percent == null ? undefined : progress.percent"
      :aria-valuetext="progress.state === 'indeterminate' ? 'Loading' : undefined"
      :aria-hidden="progress.state === 'idle' ? 'true' : undefined"
      :data-state="progress.state"
      :style="barStyle"
      @transitionend="onBarTransition"
    />
  </header>
</template>

<style scoped>
.nav-progress[data-state='indeterminate'] {
  background-color: transparent;
  background-image: linear-gradient(90deg, transparent, var(--primary), transparent);
  background-repeat: no-repeat;
  background-size: 40% 100%;
  animation: nav-indeterminate 1s ease-in-out infinite;
}

@media (prefers-reduced-motion: reduce) {
  .nav-progress[data-state='indeterminate'] {
    animation: none;
    background-image: none;
    background-color: color-mix(in srgb, var(--primary) 45%, transparent);
  }
}

@keyframes nav-indeterminate {
  from { background-position: -40% 0; }
  to { background-position: 140% 0; }
}
</style>
