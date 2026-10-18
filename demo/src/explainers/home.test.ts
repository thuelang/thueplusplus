import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createMemoryHistory, createRouter } from 'vue-router'
import { parse as parseToml } from 'smol-toml'
import hostsToml from '../../../hosts.toml?raw'
import helloSource from '../../../examples/hello/hello.thue?raw'
import HomePage from '@/pages/HomePage.vue'
import { registryHosts } from '@/hosts'
import { routes } from '@/router'
import { LHS_CAPTION, PORTABLE_OUTPUT, RHS_CAPTION } from './frames'

function registryIds(): string[] {
  const parsed = parseToml(hostsToml) as { host?: { id?: unknown }[] }
  if (!Array.isArray(parsed.host) || parsed.host.length === 0) throw new Error('hosts.toml host must be a non-empty array')
  return parsed.host.map((row, index) => {
    if (typeof row?.id !== 'string' || row.id.length === 0) throw new Error(`hosts.toml host #${index + 1} id is empty`)
    return row.id
  })
}

async function mountHome() {
  const router = createRouter({ history: createMemoryHistory(), routes })
  await router.push('/')
  await router.isReady()
  const wrapper = mount(HomePage, { global: { plugins: [router] } })
  await flushPromises()
  return wrapper
}

describe('landing explainers', () => {
  it('lists five sections under the hero', async () => {
    const wrapper = await mountHome()
    wrapper.get('[data-test="page-hero"]')
    wrapper.get('[data-test="page-details"]')
    const sections = wrapper.findAll('[data-test="explainer"]')
    expect(sections.map(section => section.attributes('data-explainer'))).toEqual([
      'origin',
      'smallest',
      'sandbox',
      'portable',
      'try',
    ])
    expect(sections.map(section => section.get('h2').text())).toEqual([
      'Origin',
      'Smallest',
      'Sandbox',
      'Portable',
      'Try it',
    ])
    expect(wrapper.find('video').exists()).toBe(false)
    expect(wrapper.find('canvas').exists()).toBe(false)
    wrapper.unmount()
  })

  it('snaps each section to its center', () => {
    const css = readFileSync('src/style.css', 'utf8')
    expect(css).toContain('scroll-snap-type: y mandatory')
    expect(css).toContain('scroll-snap-align: center')
    expect(css).toContain('height: 33vh')
    expect(css).toContain('min-height: 33vh')
    const phone = css.slice(css.indexOf('@media (max-width: 639px)'))
    expect(phone).toContain('height: auto')
  })

  it('alternates Rex and stacks him above the copy on a phone', async () => {
    const wrapper = await mountHome()
    const sections = wrapper.findAll('[data-test="explainer"]')
    expect(sections.map(section => section.attributes('data-rex'))).toEqual([
      'left',
      'right',
      'left',
      'right',
      'left',
    ])
    for (const section of sections) {
      const scene = section.get('.explainer-scene').element
      const copy = section.get('.explainer-copy').element
      expect(scene.compareDocumentPosition(copy) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
      expect(section.find('[data-test="rex-mark"]').exists()).toBe(true)
    }
    const css = readFileSync('src/style.css', 'utf8')
    const phone = css.slice(css.indexOf('@media (max-width: 639px)'))
    expect(phone).toContain('flex-direction: column')
    const desktop = css.slice(css.indexOf('@media (min-width: 640px)'))
    expect(desktop).toContain('.rex-right .explainer-scene')
    expect(desktop).toContain('order: 2')
    wrapper.unmount()
  })

  it('keeps the description in front of the scene', () => {
    const css = readFileSync('src/style.css', 'utf8')
    const scene = css.slice(css.indexOf('.explainer-scene {'), css.indexOf('.explainer-copy {'))
    const copy = css.slice(css.indexOf('.explainer-copy {'), css.indexOf('.explainer-svg {'))
    expect(scene).toContain('z-index: 1')
    expect(copy).toContain('z-index: 2')
  })

  it('tells the origin and the exact phrase', async () => {
    const wrapper = await mountHome()
    const origin = wrapper.get('#origin').text()
    expect(origin).toContain('John Colagioia')
    expect(origin).toContain('2000')
    expect(origin).toContain('Axel Thue')
    expect(origin).toContain('semi-Thue')
    expect(origin).toContain('Turing complete')
    expect(origin).toContain('makes it a practical portable cross platform runtime')
    const page = wrapper.text()
    expect(page).not.toContain('RE2')
    expect(page).not.toContain('re2')
    expect(page.toLowerCase()).not.toContain('lorem')
    expect(page).not.toContain('placeholder')
    wrapper.unmount()
  })

  it('shows lhs and rhs, then one rewrite', async () => {
    const wrapper = await mountHome()
    const origin = wrapper.get('#origin')
    expect(origin.get('[data-test="lhs-card"]').text()).toContain('lhs')
    expect(origin.get('[data-test="rhs-card"]').text()).toContain('rhs')
    expect(origin.get('[data-test="lhs-caption"]').text()).toBe(LHS_CAPTION)
    expect(origin.get('[data-test="rhs-caption"]').text()).toBe(RHS_CAPTION)
    expect(origin.get('[data-test="origin-rule"]').text()).toContain('::=')
    expect(origin.get('[data-test="origin-before"]').text()).toBe('cat')
    expect(origin.get('[data-test="origin-after"]').text()).toBe('cot')
    wrapper.unmount()
  })

  it('gives the box stdin and stdout and no socket door', async () => {
    const wrapper = await mountHome()
    const doors = wrapper.findAll('[data-test="sandbox-door"]')
    expect(doors.map(door => door.attributes('data-resource'))).toEqual(['stdin', 'stdout'])
    wrapper.get('[data-test="sandbox-box"]')
    expect(wrapper.get('[data-test="sandbox-error"]').text()).toBe('ERR:resource:socket')
    expect(wrapper.get('[data-test="sandbox-out"]').attributes('data-outside')).toBe('yes')
    expect(wrapper.get('#sandbox').text()).toContain('stdin')
    expect(wrapper.get('#sandbox').text()).toContain('stdout')
    expect(wrapper.find('[data-resource="socket"][data-test="sandbox-door"]').exists()).toBe(false)
    wrapper.unmount()
  })

  it('prints one output on every host', async () => {
    const wrapper = await mountHome()
    const ids = registryIds()
    const hosts = wrapper.findAll('[data-test="portable-host"]')
    expect(hosts.map(host => host.attributes('data-host-id'))).toEqual(ids)
    expect(hosts.map(host => host.text())).toEqual(registryHosts.map(host => host.landing))
    const outputs = wrapper.findAll('[data-test="portable-output"]')
    expect(outputs.map(output => output.attributes('data-host-id'))).toEqual(ids)
    expect(new Set(outputs.map(output => output.text()))).toEqual(new Set([PORTABLE_OUTPUT]))
    expect(wrapper.get('[data-test="portable-card"]').text()).toContain('hello.thue')
    expect(wrapper.get('[data-test="portable-card"]').text()).toContain(PORTABLE_OUTPUT)
    const rules = wrapper.findAll('[data-test="smallest-rule"]').map(rule => rule.text())
    const fileRules = helloSource.split('\n').slice(0, helloSource.split('\n').findIndex(line => line.trim() === '::='))
      .filter(line => line.trim().length > 0)
    expect(rules).toEqual(fileRules)
    wrapper.unmount()
  })

  it('hands the keyboard to the playground and the guides', async () => {
    const wrapper = await mountHome()
    wrapper.get('[data-test="try-keyboard"]')
    expect(wrapper.get('[data-test="try-playground"]').attributes('href')).toBe('/playground')
    expect(wrapper.get('[data-test="try-guides"]').attributes('href')).toBe('/docs/guides')
    expect(wrapper.get('#try').text()).toContain('playground')
    expect(wrapper.get('#try').text()).toContain('guides')
    wrapper.unmount()
  })

  it('leaves the hero in place', async () => {
    const wrapper = await mountHome()
    wrapper.get('[data-test="sandbox-scene"]')
    expect(wrapper.get('[data-test="hero-install"]').text()).toBe('install')
    expect(wrapper.get('[data-test="landing-languages"]').text()).toContain('Available in')
    expect(wrapper.get('[data-test="page-summary"]').text()).toContain('The host decides what it can touch.')
    const page = readFileSync('src/pages/HomePage.vue', 'utf8')
    expect(page).toContain('data-test="page-hero"')
    expect(page).toContain('data-test="belt-bleed"')
    expect(page).not.toContain('<video')
    expect(page).not.toContain('fframes')
    wrapper.unmount()
  })
})
