import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { createMemoryHistory, createRouter } from 'vue-router'
import DocsScene from './components/scenes/DocsScene.vue'
import InstallScene from './components/scenes/InstallScene.vue'
import ProblemScene from './components/scenes/ProblemScene.vue'
import SearchScene from './components/scenes/SearchScene.vue'
import { catalog } from './catalog'
import { routes } from './router'

async function mountScene(component: object, props?: Record<string, unknown>) {
  const router = createRouter({ history: createMemoryHistory(), routes })
  await router.push('/')
  await router.isReady()
  return mount(component, { props, global: { plugins: [router] } })
}

async function press(wrapper: ReturnType<typeof mount>, selector: string): Promise<void> {
  const button = wrapper.get(selector)
  expect(button.element.tagName).toBe('BUTTON')
  await button.trigger('keydown', { key: 'Enter' })
}

describe('scene controls', () => {
  it('turns the book and plugs a socket from the keyboard', async () => {
    const docs = await mountScene(DocsScene)
    expect(docs.get('[data-test="rex-scene"]').attributes('data-scene')).toBe('docs')
    expect(docs.get('[data-test="doc-state"]').text()).toBe('a')
    await press(docs, '[data-test="turn-page"]')
    expect(docs.get('[data-test="doc-state"]').text()).toBe('b')

    const install = await mountScene(InstallScene, { hostId: 'go' })
    expect(install.get('[data-test="rex-scene"]').attributes('data-scene')).toBe('install-go')
    const command = install.get('[data-test="install-command"]').text()
    await press(install, '[data-test="socket-rust"]')
    expect(install.get('[data-test="install-command"]').text()).not.toBe(command)
    expect(install.get('[data-test="rex-scene"]').attributes('data-scene')).toBe('install-rust')
  })

  it('changes a case and the flashlight from the keyboard', async () => {
    const problem = catalog.problems.find(item => item.id === 'rot-13')
    if (!problem) throw new Error('rot-13 missing')
    const scene = await mountScene(ProblemScene, { problemId: problem.id, cases: problem.cases })
    const before = scene.get('[data-test="scene-input"]').text()
    await press(scene, '[data-test="next-case"]')
    expect(scene.get('[data-test="scene-input"]').text()).not.toBe(before)
    await press(scene, '[data-test="replay-case"]')
    expect(scene.find('[data-test="rot-wheel"]').exists()).toBe(true)

    const search = await mountScene(SearchScene)
    expect(search.get('[data-test="hidden-mark"]').attributes('opacity')).toBe('0.12')
    await press(search, '[data-test="sweep-right"]')
    await press(search, '[data-test="sweep-right"]')
    await press(search, '[data-test="sweep-right"]')
    expect(search.get('[data-test="hidden-mark"]').attributes('opacity')).toBe('1')
  })

  it('keeps every scene control a button', async () => {
    const problem = catalog.problems[0]
    const scene = await mountScene(ProblemScene, { problemId: problem.id, cases: problem.cases })
    const buttons = scene.findAll('button')
    expect(buttons.length).toBeGreaterThan(0)
    for (const button of buttons) expect(button.element.tagName).toBe('BUTTON')
  })
})
