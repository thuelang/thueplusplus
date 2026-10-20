<script setup lang="ts">
import { RouterLink } from 'vue-router'
import DocPage from '@/components/DocPage.vue'
import InstallScene from '@/components/scenes/InstallScene.vue'
import { siteHosts, soonLanguages } from '@/hosts'
import { installNotes } from '@/install'
import { pages } from '@/site'

const page = pages.install
const notes = new Map(siteHosts.map(host => [host.id, installNotes[host.id]]))
for (const host of siteHosts) {
  if (!notes.get(host.id)) throw new Error(`install page has no note for ${host.id}`)
}
const quickStart = 'uv run thue program.thue'
</script>

<template>
  <DocPage :kicker="page.kicker" :title="page.title" :summary="page.description">
    <template #scene>
      <InstallScene />
    </template>
    <section id="quick-start" class="flex flex-col gap-3">
      <h2 class="text-xl font-semibold tracking-tight">Quick start</h2>
      <p class="leading-7">From a checkout of this repository, the Python host runs a program with:</p>
      <pre class="bg-surface border-line overflow-x-auto border p-4 font-mono text-[13px] leading-[1.7]">{{ quickStart }}</pre>
    </section>
    <section id="hosts" class="flex flex-col gap-3">
      <h2 class="text-xl font-semibold tracking-tight">Hosts</h2>
      <ul class="flex flex-col gap-4">
        <li v-for="host in siteHosts" :key="host.id">
          <RouterLink :to="host.href" class="underline underline-offset-4">{{ host.title }}</RouterLink>
          <p class="text-ash leading-7">{{ notes.get(host.id) }}</p>
        </li>
      </ul>
    </section>
    <section v-if="soonLanguages.length" id="coming-soon" class="flex flex-col gap-3">
      <h2 class="text-xl font-semibold tracking-tight">Coming soon</h2>
      <p class="leading-7">{{ soonLanguages.join(', ') }}</p>
    </section>
  </DocPage>
</template>
