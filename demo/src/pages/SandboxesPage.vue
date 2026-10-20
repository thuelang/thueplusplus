<script setup lang="ts">
import { RouterLink } from 'vue-router'
import DocPage from '@/components/DocPage.vue'
import GuideScene from '@/components/scenes/GuideScene.vue'
import { catalog } from '@/catalog'
import { pages } from '@/site'

const page = pages.sandboxes
</script>

<template>
  <DocPage :kicker="page.kicker" :title="page.title" :summary="page.description">
    <template #scene>
      <GuideScene />
    </template>
    <ul data-test="sandbox-index" class="flex flex-col gap-8">
      <li v-for="sandbox in catalog.sandboxes" :key="sandbox.id" :id="sandbox.id">
        <h2 class="text-xl font-semibold tracking-tight">
          <RouterLink :to="`/sandboxes/${sandbox.id}`" class="underline underline-offset-4">{{ sandbox.name }}</RouterLink>
        </h2>
        <p v-if="sandbox.status === 'pending'" class="mt-2 leading-7">In progress.</p>
        <p v-else class="mt-2 leading-7">{{ sandbox.description }}</p>
      </li>
    </ul>
  </DocPage>
</template>
