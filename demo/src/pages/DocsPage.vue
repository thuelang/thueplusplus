<script setup lang="ts">
import { RouterLink } from 'vue-router'
import DocPage from '@/components/DocPage.vue'
import DocsScene from '@/components/scenes/DocsScene.vue'
import { siteHosts } from '@/hosts'
import { pages } from '@/site'

const page = pages.docs
</script>

<template>
  <DocPage :kicker="page.kicker" :title="page.title" :summary="page.description">
    <template #scene>
      <DocsScene />
    </template>
    <ul class="flex flex-col gap-6">
      <li v-for="host in siteHosts" :key="host.id" :id="host.id">
        <h2 class="text-xl font-semibold tracking-tight">{{ host.title }}</h2>
        <p class="mt-2 flex flex-wrap gap-x-4 font-mono text-[13px]">
          <RouterLink :to="`/docs/${host.id}/install`" class="underline underline-offset-4">Install</RouterLink>
          <RouterLink :to="`/docs/${host.id}/api`" class="underline underline-offset-4">API</RouterLink>
          <RouterLink :to="`/docs/${host.id}/examples`" class="underline underline-offset-4">Examples</RouterLink>
        </p>
      </li>
    </ul>
  </DocPage>
</template>
