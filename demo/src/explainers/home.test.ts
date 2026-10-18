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
import { actPose, settledSpring } from '@/rex/motion'
import { HELD_CARD, LHS_CAPTION, PORTABLE_OUTPUT, RHS_CAPTION, SANDBOX_ERROR, SANDBOX_OUT_TEXT, heldCard } from './frames'

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

  it('gives each section three quarters of the viewport', () => {
    const css = readFileSync('src/style.css', 'utf8')
    expect(css).not.toContain('scroll-snap')
    expect(css).toContain('height: 75vh')
    expect(css).toContain('min-height: 75vh')
    expect(css).not.toContain('33vh')
  })

  it('pads each section above and below on a phone', () => {
    const css = readFileSync('src/style.css', 'utf8')
    const phoneStart = css.lastIndexOf('@media (max-width: 639px)')
    const phone = css.slice(phoneStart, css.indexOf('@media (prefers-reduced-motion: reduce)', phoneStart))
    const match = phone.match(/padding-block:\s*([0-9.]+)rem/)
    if (!match?.[1]) throw new Error('phone sections have no vertical padding')
    expect(Number(match[1])).toBeGreaterThan(0.75)
    const body = css.slice(css.indexOf('.explainer-body {'), css.indexOf('.explainer-scene {'))
    expect(body).not.toContain('padding-block')
  })

  it('ends the page at the footer', async () => {
    const wrapper = await mountHome()
    const column = wrapper.get('div.mx-auto')
    const footer = column.get('[data-test="site-footer"]').element
    const details = column.get('[data-test="page-details"]').element
    expect(details.compareDocumentPosition(footer) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(footer.nextElementSibling).toBeNull()
    const css = readFileSync('src/style.css', 'utf8')
    const track = css.slice(css.indexOf('.explainers {'), css.indexOf('.explainer-parallax {'))
    const parallax = css.slice(css.indexOf('.explainer-parallax {'), css.indexOf('.explainer {'))
    expect(track).toContain('overflow: hidden')
    expect(parallax).toContain('position: absolute')
    expect(parallax).toContain('top: 0')
    expect(parallax).toContain('height: 100%')
    expect(parallax).not.toContain('height: 200%')
    expect(css).not.toContain('top: -50%')
    const source = readFileSync('src/components/explainers/ExplainerTrack.vue', 'utf8')
    expect(source).toContain('patternTransform')
    wrapper.unmount()
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

  it('puts the lhs and rhs cards in his hands', async () => {
    const wrapper = await mountHome()
    const pose = actPose({ mode: 'read', clock: 0, reduced: true, spring: settledSpring(), dt: 0 })
    const origin = wrapper.get('#origin')
    const rex = origin.get('[data-test="explainer-rex"]')
    for (const side of ['left', 'right'] as const) {
      const handX = side === 'left' ? pose.handLX : pose.handRX
      const handY = side === 'left' ? pose.handLY : pose.handRY
      const card = heldCard(handX, handY, side)
      const node = rex.get(`[data-test="${side === 'left' ? 'lhs' : 'rhs'}-card"]`)
      expect(node.attributes('transform')).toBe(`translate(${card.x} ${card.y})`)
      expect(handX).toBeGreaterThan(card.x)
      expect(handX).toBeLessThan(card.x + HELD_CARD.w)
      expect(handY).toBeGreaterThan(card.y)
      expect(handY).toBeLessThan(card.y + HELD_CARD.h)
    }
    wrapper.unmount()
  })

  it('sends hello out the stdout door and puts the socket error back in the string', async () => {
    const wrapper = await mountHome()
    const sandbox = wrapper.get('#sandbox')
    const doors = sandbox.findAll('[data-test="sandbox-door"]')
    expect(doors.map(door => door.attributes('data-resource'))).toEqual(['stdout'])
    expect(sandbox.find('[data-resource="stdin"]').exists()).toBe(false)
    expect(sandbox.find('[data-resource="socket"]').exists()).toBe(false)
    sandbox.get('[data-test="sandbox-box"]')
    const out = sandbox.get('[data-test="sandbox-out"]')
    expect(out.text()).toBe(SANDBOX_OUT_TEXT)
    expect(out.text()).not.toBe('in')
    expect(out.attributes('data-outside')).toBe('yes')
    const error = sandbox.get('[data-test="sandbox-error"]')
    expect(error.text()).toBe(SANDBOX_ERROR)
    expect(error.attributes('data-inside')).toBe('yes')
    const labels = sandbox.findAll('text').map(node => node.text().trim())
    expect(labels).not.toContain('in')
    expect(labels).not.toContain('stdin')
    expect(sandbox.text()).toContain('stdout')
    expect(sandbox.text()).toContain(SANDBOX_ERROR)
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
    const letters = wrapper.findAll('[data-test="try-letter"]')
    expect(letters.map(letter => letter.text())).toEqual(['T', 'R', 'Y'])
    expect(letters.map(letter => letter.attributes('data-dy'))).toEqual(['0', '0', '0'])
    expect(letters.map(letter => letter.attributes('data-opacity'))).toEqual(['1', '1', '1'])
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
