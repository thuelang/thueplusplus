<script setup lang="ts">
import { RouterLink } from 'vue-router'
import DocPage from '@/components/DocPage.vue'
import MarkdownBody from '@/components/MarkdownBody.vue'
import SandboxMarks from '@/components/SandboxMarks.vue'
import { catalog } from '@/catalog'
import { bestSandboxMarks } from '@/charts/cost'
import { pages } from '@/site'

const page = pages.problems

function marks(problem: (typeof catalog.problems)[number]) {
  return bestSandboxMarks(problem)
}
</script>

<template>
  <DocPage :kicker="page.kicker" :title="page.title" :summary="page.description" wide>
    <ul data-test="problem-index" class="grid grid-cols-1 gap-4 md:grid-cols-2">
      <li v-for="problem in catalog.problems" :key="problem.id" data-test="problem-card" class="border-line bg-surface flex flex-col gap-3 border p-4">
        <SandboxMarks :marks="marks(problem)" />
        <h2 :id="problem.id" class="text-xl font-semibold tracking-tight">
          <RouterLink :to="problem.path" class="underline underline-offset-4">{{ problem.title }}</RouterLink>
        </h2>
        <MarkdownBody data-test="problem-summary" :source="problem.description" />
      </li>
    </ul>
  </DocPage>
</template>
