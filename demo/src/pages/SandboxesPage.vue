<script setup lang="ts">
import { RouterLink } from 'vue-router'
import DocPage from '@/components/DocPage.vue'
import { catalog } from '@/catalog'
import { guideFor } from '@/sandboxGuides.mjs'
import { pages } from '@/site'

const page = pages.sandboxes
const outlines = catalog.sandboxes.map(sandbox => ({ sandbox, guide: guideFor(sandbox.id) }))
</script>

<template>
  <DocPage :kicker="page.kicker" :title="page.title" :summary="page.description" wide>
    <ul data-test="sandbox-index" class="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <li v-for="{ sandbox, guide } in outlines" :key="sandbox.id" :id="sandbox.id" data-test="sandbox-outline" class="border-line bg-surface flex flex-col gap-3 border p-4">
        <h2 class="text-xl font-semibold tracking-tight">
          <RouterLink :to="`/sandboxes/${sandbox.id}`" class="underline underline-offset-4">{{ sandbox.name }}</RouterLink>
        </h2>
        <p class="leading-7">{{ guide.purpose }}</p>
        <h3 class="text-sm font-semibold tracking-tight">Use cases</h3>
        <ul class="flex flex-col gap-1">
          <li v-for="item in guide.useCases" :key="item">{{ item }}</li>
        </ul>
        <h3 class="text-sm font-semibold tracking-tight">Strengths</h3>
        <ul class="flex flex-col gap-1">
          <li v-for="item in guide.strengths" :key="item">{{ item }}</li>
        </ul>
      </li>
    </ul>
  </DocPage>
</template>
