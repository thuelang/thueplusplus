import { readFileSync } from 'node:fs'
import { afterEach, describe, expect, it } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createMemoryHistory, createRouter } from 'vue-router'
import SiteHeader from '@/components/SiteHeader.vue'
import { beginNavigation, createLoadSession, currentLoadSession, navSnapshot, resetNavForTests } from './navProgress'

afterEach(() => {
  resetNavForTests()
})

describe('byte progress', () => {
  it('reports a known total as loaded bytes over that total', () => {
    const bar = createLoadSession(() => false)
    const id = bar.open(200)
    bar.advance(id, 100)
    expect(bar.snapshot()).toEqual({ state: 'run', scale: 0.5, percent: 50 })
    bar.advance(id, 200)
    bar.settle(id)
    bar.seal()
    expect(bar.snapshot()).toEqual({ state: 'done', scale: 1, percent: 100 })
    bar.fade()
    expect(bar.snapshot().state).toBe('fade')
    bar.dismiss()
    expect(bar.snapshot()).toEqual({ state: 'idle', scale: 0, percent: null })
  })

  it('stays indeterminate while a total is unknown', () => {
    const bar = createLoadSession(() => false)
    const id = bar.open(null)
    bar.advance(id, 40)
    expect(bar.snapshot()).toEqual({ state: 'indeterminate', scale: 0, percent: null })
    bar.settle(id)
    expect(bar.snapshot()).toEqual({ state: 'run', scale: 1, percent: 100 })
    bar.seal()
    expect(bar.snapshot().state).toBe('done')
  })

  it('adds concurrent requests before dividing', () => {
    const bar = createLoadSession(() => false)
    const first = bar.open(100)
    const second = bar.open(300)
    bar.advance(first, 50)
    bar.advance(second, 150)
    expect(bar.snapshot()).toEqual({ state: 'run', scale: 0.5, percent: 50 })
    bar.advance(first, 100)
    bar.advance(second, 300)
    bar.settle(first)
    bar.settle(second)
    bar.seal()
    expect(bar.snapshot().percent).toBe(100)
  })

  it('hides on failure and abort', () => {
    const failed = createLoadSession(() => false)
    const id = failed.open(80)
    failed.advance(id, 20)
    failed.fail()
    expect(failed.snapshot()).toEqual({ state: 'idle', scale: 0, percent: null })
    failed.advance(id, 80)
    failed.seal()
    expect(failed.snapshot().state).toBe('idle')

    const aborted = createLoadSession(() => false)
    aborted.hold()
    aborted.open(10)
    aborted.fail()
    aborted.releaseHold()
    aborted.seal()
    expect(aborted.snapshot().state).toBe('idle')
  })

  it('stays hidden when a navigation fetches nothing', () => {
    const cached = createLoadSession(() => false)
    expect(cached.snapshot().state).toBe('idle')
    cached.seal()
    expect(cached.snapshot()).toEqual({ state: 'idle', scale: 0, percent: null })

    const empty = createLoadSession(() => false)
    expect(empty.open(0)).toBe(-1)
    empty.hold()
    empty.releaseHold()
    empty.seal()
    expect(empty.snapshot().state).toBe('idle')
  })

  it('drops a total that the body already exceeded', () => {
    const bar = createLoadSession(() => false)
    const id = bar.open(100)
    bar.advance(id, 101)
    expect(bar.snapshot()).toEqual({ state: 'indeterminate', scale: 0, percent: null })
  })

  it('shows the real percent without a completion hold when motion is reduced', () => {
    const bar = createLoadSession(() => true)
    const id = bar.open(200)
    bar.advance(id, 100)
    expect(bar.snapshot()).toEqual({ state: 'run', scale: 0.5, percent: 50 })
    bar.settle(id)
    bar.seal()
    expect(bar.snapshot()).toEqual({ state: 'idle', scale: 0, percent: null })
  })

  it('drops a superseded navigation', () => {
    beginNavigation()
    const first = currentLoadSession()
    const id = first.open(100)
    first.advance(id, 40)
    expect(navSnapshot().percent).toBe(40)
    beginNavigation()
    expect(navSnapshot()).toEqual({ state: 'idle', scale: 0, percent: null })
    first.advance(id, 80)
    expect(navSnapshot().state).toBe('idle')
  })

  it('puts the real percent on the header bar', async () => {
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [{ path: '/', component: { template: '<div />' } }],
    })
    const wrapper = mount(SiteHeader, { global: { plugins: [router] } })
    await router.isReady()
    beginNavigation()
    const session = currentLoadSession()
    const id = session.open(200)
    session.advance(id, 100)
    await flushPromises()
    const line = wrapper.get('[data-test="nav-progress"]')
    expect(line.attributes('aria-valuenow')).toBe('50')
    expect(line.attributes('data-state')).toBe('run')
    expect(line.attributes('style')).toContain('scaleX(0.5)')
    session.fail()
    await flushPromises()
    expect(wrapper.get('[data-test="nav-progress"]').attributes('data-state')).toBe('idle')
    expect(wrapper.get('[data-test="nav-progress"]').attributes('aria-valuenow')).toBeUndefined()
    wrapper.unmount()
  })

  it('loads pages and the heavy pieces through Vue', () => {
    const router = readFileSync('src/router.ts', 'utf8')
    expect(router).not.toMatch(/import \w+ from '\.\/pages\//)
    expect(router).toContain("lazy('src/pages/HomePage.vue'")
    expect(router).toContain('return () => trackedImport(id, loader)')
    const home = readFileSync('src/pages/HomePage.vue', 'utf8')
    expect(home).toContain("lazyComponent('src/components/CostChart.vue'")
    expect(home).toContain("lazyComponent('src/components/SandboxScene.vue'")
    const problem = readFileSync('src/pages/ProblemPage.vue', 'utf8')
    expect(problem).toContain("lazyComponent('src/components/CostChart.vue'")
    const embed = readFileSync('src/pages/EmbedPage.vue', 'utf8')
    expect(embed).toContain("lazyComponent('src/PlaygroundSurface.vue'")
    const playground = readFileSync('src/PlaygroundSurface.vue', 'utf8')
    expect(playground).toContain("lazyComponent('src/RulesMonacoEditor.vue'")
    expect(readFileSync('src/navProgress.ts', 'utf8')).not.toMatch(/RUN_TAU|RUN_CEILING|setTimeout|requestAnimationFrame/)
  })
})
