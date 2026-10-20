<script setup lang="ts">
import { RouterLink } from 'vue-router'
import DocPage from '@/components/DocPage.vue'
import CostChart from '@/components/CostChart.vue'
import LeaderboardScene from '@/components/scenes/LeaderboardScene.vue'
import MarkdownBody from '@/components/MarkdownBody.vue'
import { catalog } from '@/catalog'
import { problemSeries } from '@/charts/series'
import { pages } from '@/site'

const page = pages.problems
</script>

<template>
  <DocPage :kicker="page.kicker" :title="page.title" :summary="page.description" wide>
    <template #scene>
      <LeaderboardScene />
    </template>
    <ul data-test="problem-index" class="flex flex-col gap-10">
      <li v-for="problem in catalog.problems" :key="problem.id" data-test="problem-card" class="flex flex-col gap-3">
        <h2 :id="problem.id" class="text-xl font-semibold tracking-tight">
          <RouterLink :to="problem.path" class="underline underline-offset-4">{{ problem.title }}</RouterLink>
        </h2>
        <MarkdownBody data-test="problem-summary" :source="problem.summary" />
        <CostChart spark :series="problemSeries(problem)" :label="`${problem.title} cost`" />
      </li>
    </ul>
  </DocPage>
</template>
