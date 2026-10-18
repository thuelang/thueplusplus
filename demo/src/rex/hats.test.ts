import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import { beforeEach, describe, expect, it } from 'vitest'
import { createMemoryHistory, createRouter } from 'vue-router'
import RexFigure from '@/components/RexFigure.vue'
import SiteHeader from '@/components/SiteHeader.vue'
import { actPose, settledSpring } from '@/rex/motion'
import {
  HAT_IDS,
  HAT_STORAGE_KEY,
  faviconSvg,
  hat as markHat,
  hatCenter,
  hatShape,
  hatSwapFrame,
  hatTiltAt,
  loadHat,
  nextHatId,
  MARK,
  saveHat,
} from '@/rex/geometry.mjs'
import { hat, resetMascot, swap, swapHat, swapT } from '@/rex/mascot'

const pose = () => actPose({ mode: 'read', clock: 0, reduced: true, spring: settledSpring(), dt: 0 })

function translates(transform: string): number[][] {
  return [...transform.matchAll(/translate\(([^)]+)\)/g)].map(match => match[1].split(/[\s,]+/).map(Number))
}

function memory() {
  const saved = new Map<string, string>()
  return {
    getItem: (key: string) => saved.get(key) ?? null,
    setItem: (key: string, value: string) => {
      saved.set(key, value)
    },
  }
}

async function header() {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: ['/', '/install', '/docs', '/problems', '/contribute'].map(path => ({
      path,
      component: { template: '<div />' },
    })),
  })
  const wrapper = mount(SiteHeader, { global: { plugins: [router] } })
  await router.isReady()
  return wrapper
}

describe('rex hats', () => {
  beforeEach(() => {
    localStorage.removeItem(HAT_STORAGE_KEY)
    resetMascot()
  })

  it('cycles the wardrobe', () => {
    const seen: string[] = []
    let id = 'hard'
    for (let i = 0; i < HAT_IDS.length; i += 1) {
      seen.push(id)
      id = nextHatId(id)
    }
    expect(seen).toEqual(['hard', 'top', 'party', 'beanie', 'wizard', 'crown'])
    expect(id).toBe('hard')
    expect(() => nextHatId('cape')).toThrow(/unknown hat cape/)
  })

  it('remembers the hat', () => {
    const storage = memory()
    expect(loadHat(storage)).toBe('hard')
    saveHat(storage, 'beanie')
    expect(storage.getItem(HAT_STORAGE_KEY)).toBe('beanie')
    expect(loadHat(storage)).toBe('beanie')
    expect(() => loadHat({ getItem: () => 'cape' })).toThrow(/stored rex hat cape/)
    expect(() => saveHat(storage, 'cape')).toThrow(/unknown hat cape/)
  })

  it('gives every hat its own cock and keeps that tilt', () => {
    const tilts = HAT_IDS.map(id => hatShape(id).tilt)
    const offsets = HAT_IDS.map(id => `${hatShape(id).offset.x},${hatShape(id).offset.y}`)
    expect(new Set(tilts).size).toBe(HAT_IDS.length)
    expect(new Set(offsets).size).toBe(HAT_IDS.length)
    for (const id of HAT_IDS) {
      const shape = hatShape(id)
      expect(Math.abs(shape.tilt)).toBeGreaterThanOrEqual(3)
      expect(Math.abs(shape.tilt)).toBeLessThanOrEqual(12)
      const shift = Math.hypot(shape.offset.x, shape.offset.y)
      expect(shift).toBeGreaterThanOrEqual(1)
      expect(shift).toBeLessThanOrEqual(5)
      expect(hatTiltAt(shape.tilt, 0, false)).toBe(shape.tilt)
      expect(hatTiltAt(shape.tilt, 0.55, false)).toBe(shape.tilt)
      expect(hatTiltAt(shape.tilt, 1, true)).toBe(shape.tilt)
    }
  })

  it('scales each hat in place around its own center', async () => {
    const rest = hatSwapFrame(0, 0, MARK.eyeDy)
    const mid = hatSwapFrame(0.5, 0, MARK.eyeDy)
    const done = hatSwapFrame(1, 0, MARK.eyeDy)
    for (const frame of [rest, mid, done]) {
      expect(frame.incoming.x).toBe(0)
      expect(frame.incoming.y).toBe(0)
      expect(frame.outgoing.x).toBe(0)
      expect(frame.outgoing.y).toBe(0)
    }
    expect(rest.outgoing.scale).toBe(1)
    expect(rest.incoming.scale).toBe(0)
    expect(mid.outgoing.scale).toBeLessThan(0.85)
    expect(mid.outgoing.scale).toBeGreaterThan(0.15)
    expect(mid.incoming.scale).toBeGreaterThan(0.15)
    expect(done.outgoing.scale).toBe(0)
    expect(done.incoming.scale).toBeCloseTo(1, 5)
    expect(hatCenter('wizard').y).toBeLessThan(hatCenter('hard').y - 2)
    expect(() => hatSwapFrame(0.2, Number.NaN, 0)).toThrow(/finite/)

    const previous = window.matchMedia
    window.matchMedia = () => ({
      matches: false,
      media: '',
      onchange: null,
      addListener() {},
      removeListener() {},
      addEventListener() {},
      removeEventListener() {},
      dispatchEvent() { return false },
    })
    const wrapper = mount(RexFigure, { props: { pose: pose() } })
    swap.value = { from: 'hard', to: 'top', side: 'right', started: 0 }
    swapT.value = 0.55
    await nextTick()
    const hard = wrapper.get('[data-hat="hard"]')
    const top = wrapper.get('[data-hat="top"]')
    expect(Number(hard.attributes('data-tilt'))).toBe(hatShape('hard').tilt)
    expect(Number(top.attributes('data-tilt'))).toBe(hatShape('top').tilt)
    const hardCenter = hatCenter('hard')
    const topCenter = hatCenter('top')
    const hardPlace = translates(hard.attributes('transform') ?? '')
    const topPlace = translates(top.attributes('transform') ?? '')
    expect(hardPlace[0][1]).toBeCloseTo(MARK.eyeDy + hatShape('hard').offset.y, 3)
    expect(topPlace[0][1]).toBeCloseTo(MARK.eyeDy + hatShape('top').offset.y, 3)
    expect(hardPlace[1][0]).toBeCloseTo(hardCenter.x, 3)
    expect(hardPlace[1][1]).toBeCloseTo(hardCenter.y, 3)
    expect(hardPlace[2][0]).toBeCloseTo(-hardCenter.x, 3)
    expect(hardPlace[2][1]).toBeCloseTo(-hardCenter.y, 3)
    expect(topPlace[1][1]).toBeCloseTo(topCenter.y, 3)
    expect(Math.abs(hardPlace[1][1] - topPlace[1][1])).toBeGreaterThan(0.5)
    wrapper.unmount()
    window.matchMedia = previous
  })

  it('draws the favicon with no hat', () => {
    const svg = faviconSvg()
    expect(svg).not.toContain(markHat.crown)
    expect(svg).not.toContain('class="hat"')
    expect(svg).toContain('class="ink"')
    const party = hatShape('party').parts.find(part => part.kind === 'path' && part.role === 'hat')
    if (!party || party.kind !== 'path') throw new Error('party hat has no crown')
    expect(svg).not.toContain(party.d)
  })

  it('every Rex wears the stored hat', () => {
    localStorage.setItem(HAT_STORAGE_KEY, 'wizard')
    resetMascot()
    const hero = mount(RexFigure, { props: { pose: pose() } })
    const game = mount(RexFigure, { props: { pose: pose() } })
    expect(hat.value).toBe('wizard')
    expect(hero.find('[data-hat="wizard"]').exists()).toBe(true)
    expect(game.find('[data-hat="wizard"]').exists()).toBe(true)
    expect(hero.find('[data-test="hard-hat"]').exists()).toBe(false)
    expect(hero.find('[data-hat="wizard"]').attributes('data-tilt')).toBe(String(hatShape('wizard').tilt))
  })

  it('reduced motion swaps instantly', async () => {
    const wrapper = await header()
    expect(wrapper.get('[data-test="swap-hat"]').attributes('aria-label')).toBe("Swap Rex's hat")
    await wrapper.get('[data-test="swap-hat"]').trigger('click')
    expect(localStorage.getItem(HAT_STORAGE_KEY)).toBe('top')
    expect(wrapper.find('[data-hat="top"]').attributes('data-tilt')).toBe(String(hatShape('top').tilt))
    expect(wrapper.find('[data-test="hard-hat"]').exists()).toBe(false)
  })

  it('wordmark links home', async () => {
    const wrapper = await header()
    const home = wrapper.get('a[href="/"]')
    expect(home.text()).toBe('Thue++')
    expect(home.attributes('aria-current')).toBe('page')
    expect(wrapper.get('[data-test="swap-hat"]').find('a').exists()).toBe(false)
    await wrapper.get('[data-test="swap-hat"]').trigger('click')
    expect(swapHat('right')).toBe('party')
    expect(home.attributes('href')).toBe('/')
  })
})
