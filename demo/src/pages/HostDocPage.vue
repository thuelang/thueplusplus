<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import DocPage from '@/components/DocPage.vue'
import DocsScene from '@/components/scenes/DocsScene.vue'
import InstallScene from '@/components/scenes/InstallScene.vue'
import NotFoundPage from '@/pages/NotFoundPage.vue'
import { siteHosts } from '@/hosts'
import { installNotes, installPage } from '@/install'

const route = useRoute()
const host = computed(() => siteHosts.find(item => item.id === route.params.hostId))
const section = computed(() => route.params.section)
const model = computed(() => host.value ? installPage(host.value.href) : undefined)

const title = computed(() => {
  if (!host.value || !model.value) return ''
  if (section.value === 'install') return `${host.value.title}.`
  if (section.value === 'api') return `${host.value.title} API.`
  return `${host.value.title} examples.`
})

const summary = computed(() => {
  if (!host.value || !model.value) return ''
  if (section.value === 'install') return installNotes[host.value.id]
  if (section.value === 'api') return model.value.prose
  return model.value.libraryLead
})
</script>

<template>
  <NotFoundPage v-if="!host || !model || (section !== 'install' && section !== 'api' && section !== 'examples')" />
  <DocPage v-else-if="section === 'install'" kicker="Install" :title="title" :summary="summary">
    <template #scene>
      <InstallScene :host-id="host.id" />
    </template>
    <section id="install" class="flex flex-col gap-3">
      <h2 class="text-xl font-semibold tracking-tight">Install</h2>
      <p class="leading-7">{{ model.installLead }}</p>
      <pre class="bg-surface border-line overflow-x-auto border p-4 font-mono text-[13px] leading-[1.7]">{{ model.install }}</pre>
      <p v-if="model.installAfter" class="leading-7">{{ model.installAfter }}</p>
      <pre v-if="model.installAfterBody" class="bg-surface border-line overflow-x-auto border p-4 font-mono text-[13px] leading-[1.7]">{{ model.installAfterBody }}</pre>
      <template v-for="block in model.moreInstall" :key="block.lead">
        <p class="leading-7">{{ block.lead }}</p>
        <pre class="bg-surface border-line overflow-x-auto border p-4 font-mono text-[13px] leading-[1.7]">{{ block.body }}</pre>
      </template>
    </section>
    <section id="cli" class="flex flex-col gap-3">
      <h2 class="text-xl font-semibold tracking-tight">CLI</h2>
      <p class="leading-7">{{ model.cliLead }}</p>
      <pre class="bg-surface border-line overflow-x-auto border p-4 font-mono text-[13px] leading-[1.7]">{{ model.cli }}</pre>
    </section>
  </DocPage>
  <DocPage v-else-if="section === 'api'" kicker="API" :title="title" :summary="summary">
    <template #scene>
      <DocsScene />
    </template>
    <section id="api" class="flex flex-col gap-3">
      <h2 class="text-xl font-semibold tracking-tight">API</h2>
      <p class="leading-7">{{ model.libraryLead }}</p>
      <p v-for="link in model.api" :key="link.href" class="leading-7">
        <a class="underline underline-offset-4" :href="link.href" rel="noreferrer">{{ link.label }}</a>
      </p>
    </section>
  </DocPage>
  <DocPage v-else kicker="Examples" :title="title" :summary="summary">
    <template #scene>
      <DocsScene />
    </template>
    <section id="example" class="flex flex-col gap-3">
      <h2 class="text-xl font-semibold tracking-tight">Example</h2>
      <pre class="bg-surface border-line overflow-x-auto border p-4 font-mono text-[13px] leading-[1.7]">{{ model.library }}</pre>
    </section>
  </DocPage>
</template>
