<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import DocPage from '@/components/DocPage.vue'
import SceneFrame from '@/components/SceneFrame.vue'
import GuideScene from '@/components/scenes/GuideScene.vue'
import MarkdownBody from '@/components/MarkdownBody.vue'
import NotFoundPage from '@/pages/NotFoundPage.vue'
import PlaygroundSurface from '@/PlaygroundSurface.vue'
import { sandboxById } from '@/catalog'

const route = useRoute()
const sandbox = computed(() => {
  const id = route.params.sandboxId
  if (typeof id !== 'string') return undefined
  return sandboxById(id)
})
const guide = computed(() => sandbox.value?.readme.replace(/^#[^\n]*\n+/, '') ?? '')
</script>

<template>
  <NotFoundPage v-if="!sandbox" />
  <DocPage v-else-if="sandbox.status === 'pending'" kicker="Sandboxes" :title="`${sandbox.name}.`" summary="In progress.">
    <template #scene>
      <SceneFrame scene="sandbox" label="Expr is in progress" mode="read" :x="420" :y="248" :scale="0.9" />
    </template>
  </DocPage>
  <DocPage v-else kicker="Sandboxes" :title="`${sandbox.name}.`" :summary="sandbox.description" wide>
    <template #scene>
      <GuideScene />
    </template>
    <MarkdownBody v-if="guide" data-test="sandbox-guide" :source="guide" />
    <section v-if="sandbox.cases.length" id="examples" class="flex flex-col gap-8">
      <h2 class="text-xl font-semibold tracking-tight">Examples</h2>
      <section v-for="example in sandbox.cases" :key="example.path" :id="example.name" class="flex flex-col gap-3">
        <h3 class="text-lg font-semibold tracking-tight">{{ example.name }}</h3>
        <PlaygroundSurface
          v-if="sandbox.programSource"
          chrome="panel"
          :program="sandbox.programSource"
          :program-path="sandbox.program ?? undefined"
          :initial-state="example.source"
          :sync-url="false"
          :show-open-full="false"
        />
      </section>
    </section>
  </DocPage>
</template>
