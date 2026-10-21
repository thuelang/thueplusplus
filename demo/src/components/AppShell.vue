<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { RouterLink, RouterView, useRoute } from 'vue-router'
import { sectionFor } from '../sectionNav'
import OnThisPage from './OnThisPage.vue'
import SiteFooter from './SiteFooter.vue'
import SiteHeader from './SiteHeader.vue'

const route = useRoute()
const home = computed(() => route.path === '/')
const wide = computed(() => route.path === '/problems' || route.path === '/sandboxes' || route.path.startsWith('/problems/') || route.path.startsWith('/sandboxes/'))
const section = computed(() => sectionFor(route.path))
const contentsOpen = ref(false)
const sectionOpen = ref(false)

watch(() => route.path, () => {
  contentsOpen.value = false
  sectionOpen.value = false
})
</script>

<template>
  <div data-test="app-shell" class="bg-void text-bone min-h-svh">
    <SiteHeader />
    <div v-if="home">
      <RouterView />
    </div>
    <div v-else class="mx-auto flex w-full flex-col items-center px-4 sm:px-6 lg:flex-row lg:items-start lg:justify-center lg:gap-10" :class="wide ? 'max-w-[calc(1180px+13.5rem)]' : 'max-w-[calc(65ch+27rem)]'">
      <template v-if="section">
        <div class="order-1 w-full pt-4 lg:hidden" :class="wide ? 'max-w-none' : 'max-w-[65ch]'">
          <button
            type="button"
            class="border-line bg-surface text-ash flex h-11 w-full items-center justify-between border px-4 font-mono text-[13px]"
            data-test="section-toggle"
            :aria-expanded="sectionOpen"
            aria-controls="section-nav"
            @click="sectionOpen = !sectionOpen"
          >
            <span>{{ section.label }}</span>
            <span aria-hidden="true">{{ sectionOpen ? '▴' : '▾' }}</span>
          </button>
        </div>
        <aside
          id="section-nav"
          data-test="section-nav"
          class="order-2 w-full lg:sticky lg:top-[68px] lg:order-1 lg:max-h-[calc(100svh-84px)] lg:w-44 lg:shrink-0 lg:self-start lg:overflow-auto lg:pt-10"
          :class="[sectionOpen ? 'block' : 'hidden lg:block', wide ? 'max-w-none' : 'max-w-[65ch] lg:max-w-none']"
        >
          <nav class="page-toc" :aria-label="section.label">
            <p>{{ section.label }}</p>
            <RouterLink
              v-for="link in section.links"
              :key="link.href"
              :to="link.href"
              custom
              v-slot="{ href, navigate }"
            >
              <a :href="href" :aria-current="route.path === link.href ? 'page' : undefined" @click="navigate">{{ link.title }}</a>
            </RouterLink>
          </nav>
        </aside>
      </template>
      <div data-test="page-main" class="order-5 w-full min-w-0 lg:order-2" :class="wide ? 'max-w-none' : 'max-w-[65ch]'">
        <RouterView />
      </div>
      <div data-test="toc-slot" class="contents">
        <div class="order-3 w-full pt-4 lg:hidden" :class="wide ? 'max-w-none' : 'max-w-[65ch]'">
          <button
            type="button"
            class="border-line bg-surface text-ash flex h-11 w-full items-center justify-between border px-4 font-mono text-[13px]"
            data-test="contents-toggle"
            :aria-expanded="contentsOpen"
            aria-controls="on-this-page"
            @click="contentsOpen = !contentsOpen"
          >
            <span>Contents</span>
            <span aria-hidden="true">{{ contentsOpen ? '▴' : '▾' }}</span>
          </button>
        </div>
        <aside
          data-test="page-sidebar"
          class="order-4 w-full lg:sticky lg:top-[68px] lg:order-3 lg:max-h-[calc(100svh-84px)] lg:w-44 lg:shrink-0 lg:self-start lg:overflow-auto lg:pt-10"
          :class="[contentsOpen ? 'block' : 'hidden lg:block', wide ? 'max-w-none' : 'max-w-[65ch] lg:max-w-none']"
        >
          <OnThisPage />
        </aside>
      </div>
    </div>
    <SiteFooter v-if="!home" class="mx-auto w-full px-4 sm:px-6" :class="wide ? 'max-w-[calc(1180px+13.5rem)]' : 'max-w-[calc(65ch+27rem)]'" />
  </div>
</template>
