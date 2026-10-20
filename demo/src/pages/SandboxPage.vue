<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import DocPage from '@/components/DocPage.vue'
import MarkdownBody from '@/components/MarkdownBody.vue'
import NotFoundPage from '@/pages/NotFoundPage.vue'
import { sandboxById } from '@/catalog'
import { guideFor, readmeSection } from '@/sandboxGuides.mjs'

const route = useRoute()
const sandbox = computed(() => {
  const id = route.params.sandboxId
  if (typeof id !== 'string') return undefined
  return sandboxById(id)
})
const guide = computed(() => sandbox.value ? guideFor(sandbox.value.id) : undefined)
const sections = computed(() => {
  const current = sandbox.value
  const notes = guide.value
  if (!current || !notes) return []
  return notes.readmeSections.map(heading => readmeSection(current.readme, heading))
})
</script>

<template>
  <NotFoundPage v-if="!sandbox || !guide" />
  <DocPage v-else kicker="Sandboxes" :title="`${sandbox.name}.`" :summary="guide.purpose" wide>
    <section id="call" class="flex flex-col gap-3">
      <h2 class="text-xl font-semibold tracking-tight">Call</h2>
      <pre data-test="sandbox-command" class="bg-surface border-line overflow-x-auto border p-4 font-mono text-[13px] leading-[1.7]">{{ guide.command }}</pre>
    </section>
    <section id="examples" data-test="sandbox-examples" class="flex flex-col gap-6">
      <h2 class="text-xl font-semibold tracking-tight">Examples</h2>
      <article v-for="example in guide.examples" :key="example.name" data-test="sandbox-example" class="flex flex-col gap-2">
        <h3 class="text-lg font-semibold tracking-tight">{{ example.name }}</h3>
        <p class="text-dim font-mono text-[11px] tracking-[0.08em] uppercase">Input</p>
        <pre class="bg-surface border-line overflow-x-auto border p-4 font-mono text-[13px] leading-[1.7]">{{ example.input }}</pre>
        <p class="text-dim font-mono text-[11px] tracking-[0.08em] uppercase">Output</p>
        <pre data-test="sandbox-output" class="bg-surface border-line overflow-x-auto border p-4 font-mono text-[13px] leading-[1.7]">{{ example.output }}</pre>
      </article>
    </section>
    <MarkdownBody v-for="section in sections" :key="section" data-test="sandbox-readme-section" :source="section" />
  </DocPage>
</template>
