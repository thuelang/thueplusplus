<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { RouterLink } from 'vue-router'
import { parallaxShift } from '@/explainers/frames'
import { useClock } from '@/explainers/useClock'
import ExplainerSection from './ExplainerSection.vue'
import OriginScene from './OriginScene.vue'
import PortableScene from './PortableScene.vue'
import SandboxExplainer from './SandboxExplainer.vue'
import SmallestScene from './SmallestScene.vue'
import TryScene from './TryScene.vue'

const { t, reduced } = useClock()
const track = ref<HTMLElement | null>(null)
const shift = ref(0)

function onScroll(): void {
  if (!track.value) return
  shift.value = parallaxShift(track.value.getBoundingClientRect().top, reduced.value)
}

onMounted(() => {
  onScroll()
  window.addEventListener('scroll', onScroll, { passive: true })
  window.addEventListener('resize', onScroll)
})

onBeforeUnmount(() => {
  window.removeEventListener('scroll', onScroll)
  window.removeEventListener('resize', onScroll)
})

watch(reduced, () => onScroll())
</script>

<template>
  <section ref="track" data-test="page-details" class="explainers page-details" :data-reduced="reduced ? 'yes' : 'no'">
    <div
      class="explainer-parallax"
      data-test="explainer-parallax"
      aria-hidden="true"
    >
      <svg class="h-full w-full" preserveAspectRatio="none">
        <defs>
          <pattern
          id="explainer-rewrite"
          width="88"
          height="56"
          patternUnits="userSpaceOnUse"
          :patternTransform="reduced ? undefined : `translate(0 ${shift})`"
        >
            <text x="0" y="28" fill="currentColor" font-family="JetBrains Mono, ui-monospace, monospace" font-size="16">::=</text>
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#explainer-rewrite)" />
      </svg>
    </div>

    <ExplainerSection id="origin" title="Origin" rex="left">
      <template #scene>
        <OriginScene :t="t" :reduced="reduced" />
      </template>
      <p>Thue is an esoteric language John Colagioia invented in 2000. It is named after the Norwegian mathematician Axel Thue and the semi-Thue string rewriting systems that bear his name. A program is rewrite rules applied to one string until none match, and that alone makes it Turing complete. Thue++ is the logical successor that makes it a practical portable cross platform runtime.</p>
    </ExplainerSection>

    <ExplainerSection id="smallest" title="Smallest" rex="right">
      <template #scene>
        <SmallestScene :t="t" :reduced="reduced" />
      </template>
      <p>A program is rewrite rules and one string. Each step finds one match, then replaces it. This one is examples/hello/hello.thue.</p>
    </ExplainerSection>

    <ExplainerSection id="sandbox" title="Sandbox" rex="left">
      <template #scene>
        <SandboxExplainer :t="t" :reduced="reduced" />
      </template>
      <p>The program sits in a box. The host decides which doors it gets. This host gives it stdout. A stdout rule sends hello out that door. A socket rule finds no door, bumps the wall, and ERR:resource:socket lands back in the string.</p>
    </ExplainerSection>

    <ExplainerSection id="portable" title="Portable" rex="right">
      <template #scene>
        <PortableScene :t="t" :reduced="reduced" />
      </template>
      <p>The same program runs on every host. Each one prints the same output.</p>
    </ExplainerSection>

    <ExplainerSection id="try" title="Try it" rex="left">
      <template #scene>
        <TryScene :t="t" :reduced="reduced" />
      </template>
      <p>The playground runs a program in the browser.</p>
      <p><RouterLink to="/playground" class="text-bone underline underline-offset-4" data-test="try-playground">playground</RouterLink></p>
      <p>The guides show ordered rules, one state string, and the engine that repeats them.</p>
      <p><RouterLink to="/docs/guides" class="text-bone underline underline-offset-4" data-test="try-guides">guides</RouterLink></p>
    </ExplainerSection>
  </section>
</template>
