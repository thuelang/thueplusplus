import { readFileSync } from 'node:fs'
import { describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createMemoryHistory, createRouter } from 'vue-router'
import { catalog } from './catalog'
import { siteHosts } from './hosts'
import { routes } from './router'
import { pages } from './site'

const playgroundModules = import.meta.glob('./PlaygroundSurface.vue', { eager: true }) as Record<string, { default: object }>
const playgroundModule = playgroundModules['./PlaygroundSurface.vue']
if (!playgroundModule) throw new Error('playground surface missing from the test bundle')
;(globalThis as unknown as { __testModules: Map<string, { default: object }> }).__testModules.set('src/PlaygroundSurface.vue', playgroundModule)

vi.mock('./RulesMonacoEditor.vue', async () => {
  const { defineComponent, h } = await import('vue')
  return {
    default: defineComponent({
      props: { modelValue: { type: String, default: '' }, highlightLine: { type: Number, default: undefined } },
      emits: ['update:modelValue', 'paste'],
      setup(props, { emit, attrs }) {
        return () => h('textarea', {
          ...attrs,
          value: props.modelValue,
          onInput: (event: Event) => emit('update:modelValue', (event.target as HTMLTextAreaElement).value),
        })
      },
    }),
  }
})

async function mountPath(path: string) {
  const router = createRouter({ history: createMemoryHistory(), routes })
  await router.push(path)
  await router.isReady()
  const component = router.currentRoute.value.matched[0]?.components?.default
  if (!component) throw new Error(`no component for ${path}`)
  const wrapper = mount(component, { global: { plugins: [router] } })
  for (let attempt = 0; attempt < 4; attempt += 1) await flushPromises()
  return wrapper
}

const paths = [
  ...Object.values(pages).map(page => page.path),
  ...catalog.problems.map(problem => problem.path),
  ...catalog.sandboxes.map(sandbox => `/sandboxes/${sandbox.id}`),
  ...siteHosts.flatMap(host => [`/docs/${host.id}/install`, `/docs/${host.id}/api`, `/docs/${host.id}/examples`]),
  '/not-a-page',
]

describe('heroes', () => {
  it('puts the details in the bottom third of the first screen', () => {
    const css = readFileSync('src/style.css', 'utf8')
    expect(css).toContain('grid-template-rows: minmax(0, 2fr) minmax(0, 1fr)')
    expect(css).toContain('margin-top: calc((100svh - 52px) / -3)')
  })

  it('opens every user page with a title, a summary, and a Rex scene', async () => {
    for (const path of paths) {
      const wrapper = await mountPath(path)
      expect(wrapper.get('h1').text().length, path).toBeGreaterThan(0)
      const problemPage = path.startsWith('/problems/')
      if (problemPage) {
        expect(wrapper.find('[data-test="page-summary"]').exists(), path).toBe(false)
        expect(wrapper.findAll('[data-test="problem-description"]'), path).toHaveLength(1)
        expect(wrapper.get('[data-test="problem-description"]').text().length, path).toBeGreaterThan(0)
      } else {
        expect(wrapper.get('[data-test="page-summary"]').text().length, path).toBeGreaterThan(0)
      }
      wrapper.get('[data-test="page-hero"]')
      wrapper.get('[data-test="page-details"]')
      const scene = wrapper.find('[data-test="rex-scene"]')
      const sandbox = wrapper.find('[data-test="sandbox-scene"]')
      const sceneFree = path === '/sandboxes' || path === '/problems' || path.startsWith('/sandboxes/') || problemPage
      if (path === '/') {
        expect(sandbox.attributes('data-test')).toBe('sandbox-scene')
        expect(wrapper.get('[data-test="landing-languages"]').text()).toContain('Available in')
      } else if (sceneFree) {
        expect(scene.exists(), path).toBe(false)
        expect(wrapper.text(), path).not.toContain('hello Ada')
      } else {
        expect(scene.exists() || sandbox.exists(), path).toBe(true)
        expect(scene.attributes('data-scene')?.length, path).toBeGreaterThan(0)
      }
      wrapper.unmount()
    }
  }, 30_000)

  it('keeps the embed free of a hero', async () => {
    window.history.pushState({}, '', '/embed?file=./examples/hello/hello.thue')
    const wrapper = await mountPath('/embed')
    expect(wrapper.find('[data-test="page-hero"]').exists()).toBe(false)
    expect(wrapper.find('[data-test="playground-workbench"]').exists()).toBe(true)
  })
})
