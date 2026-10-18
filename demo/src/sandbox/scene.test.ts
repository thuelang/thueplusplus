import { nextTick } from 'vue'
import { mount, type VueWrapper } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import SandboxScene from '@/components/SandboxScene.vue'
import { HIT_FRONT, MACHINE_X, SCALE, YANK, boxPlace, leverKnob, walkDistance } from './layout'
import { blinkCurve, framePose, settledSpring, stepSpring } from './motion'
import { inZone, type Box, type Game } from './game'

interface Exposed {
  game: Game
  advance: (dt: number) => void
}

function exposed(wrapper: VueWrapper): Exposed {
  return wrapper.vm as unknown as Exposed
}

function mountScene(): VueWrapper {
  return mount(SandboxScene, { attachTo: document.body })
}

function canAct(game: Game): boolean {
  return game.cooldown === 0 && game.rex !== 'yank' && game.rex !== 'cheer'
}

function zoned(box: Box): boolean {
  return inZone(box.progress, box.lane, box.spin)
}

async function clearZoned(wrapper: VueWrapper, api: Exposed): Promise<void> {
  await missUntilZone(wrapper, api)
  let guard = 0
  while (!canAct(api.game) && guard < 90) {
    api.advance(1 / 30)
    guard += 1
  }
  if (!canAct(api.game) || !api.game.boxes.some(zoned)) {
    throw new Error('scanner window closed before the pull')
  }
  await wrapper.get('[data-test="lever-hit"]').trigger('click')
}

async function missUntilZone(wrapper: VueWrapper, api: Exposed): Promise<void> {
  let guard = 0
  while (!api.game.boxes.some(zoned) && guard < 4000) {
    if (api.game.phase !== 'playing' || api.game.control !== 'player') {
      throw new Error(`left the player's run at ${api.game.phase} ${api.game.control}`)
    }
    if (canAct(api.game)) await wrapper.get('[data-test="lever-hit"]').trigger('click')
    api.advance(1 / 30)
    guard += 1
  }
  if (!api.game.boxes.some(zoned)) {
    throw new Error('box never reached the scanner')
  }
}

async function fumbleUntilBroken(wrapper: VueWrapper, api: Exposed): Promise<void> {
  let guard = 0
  while (api.game.phase !== 'broken' && guard < 4000) {
    const ready = api.game.boxes.some(zoned)
    if (!ready && canAct(api.game)) await wrapper.get('[data-test="lever-hit"]').trigger('click')
    api.advance(1 / 30)
    guard += 1
  }
}

describe('rex sandbox scene', () => {
  beforeEach(() => {
    document.body.innerHTML = ''
  })

  afterEach(() => {
    document.body.innerHTML = ''
  })

  it('gate hero', () => {
    const wrapper = mountScene()
    expect(wrapper.findAll('[data-test="rex-eye"]')).toHaveLength(2)
    expect(wrapper.findAll('[data-test="rex-dot"]')).toHaveLength(4)
    expect(wrapper.find('[data-test="hard-hat"]').exists()).toBe(true)
    expect(wrapper.find('[data-test="rex-mark"]').exists()).toBe(true)
    expect(wrapper.find('[data-test="lever"]').exists()).toBe(true)
    expect(wrapper.find('[data-test="belt"]').exists()).toBe(false)
    expect(wrapper.find('[data-test="scanner-flap"]').exists()).toBe(false)
    expect(wrapper.find('[data-test="cage"]').exists()).toBe(false)
    expect(wrapper.find('[data-test="scanner"]').exists()).toBe(true)
    expect(wrapper.find('[data-test="capture-zone"]').exists()).toBe(true)
    expect(wrapper.find('[data-test="speech-text"]').exists()).toBe(false)
    expect(wrapper.find('[data-test="speech"]').exists()).toBe(false)
    expect(wrapper.find('[data-test="speech-tail"]').exists()).toBe(false)
    expect(wrapper.find('[data-test="floor"]').exists()).toBe(false)
    expect(wrapper.find('[data-test="machine"]').exists()).toBe(true)
    expect(wrapper.find('[data-test="start-hint"]').exists()).toBe(false)
    expect(wrapper.find('[data-test="score"]').exists()).toBe(false)
    expect(wrapper.find('[data-test="best"]').exists()).toBe(false)
    expect(wrapper.find('video').exists()).toBe(false)
    expect(wrapper.find('[data-kind]').exists()).toBe(false)
    expect(wrapper.find('[data-test="belt-item"]').exists()).toBe(false)
    expect(wrapper.find('[data-test="box"]').exists()).toBe(false)
    expect(wrapper.text()).not.toMatch(/good|evil|RE2/)
    const rex = wrapper.get('[data-test="rex"]')
    expect(rex.element.tagName).toBe('BUTTON')
    expect(rex.attributes('type')).toBe('button')
    expect(rex.attributes('aria-label')).toBe('Rex.')
    expect(wrapper.get('[data-test="lever-hit"]').attributes('aria-label')).toBe('Rex.')
    const scene = wrapper.get('[data-test="sandbox-scene"]')
    expect(scene.attributes('data-belt')).toBe('on')
    expect(scene.attributes('data-phase')).toBe('playing')
    expect(scene.attributes('data-control')).toBe('auto')
    expect(scene.attributes('data-paused')).toBe('no')
    expect(scene.attributes('data-score')).toBeUndefined()
    expect(scene.attributes('aria-label')).toBe('Rex at the machine. Rex is running the machine.')
    wrapper.unmount()
  })

  it('gate input', async () => {
    const click = mountScene()
    await click.get('[data-test="rex"]').trigger('click')
    expect(click.get('[data-test="sandbox-scene"]').attributes('data-belt')).toBe('on')
    expect(click.get('[data-test="sandbox-scene"]').attributes('data-phase')).toBe('playing')
    expect(click.get('[data-test="sandbox-scene"]').attributes('data-control')).toBe('player')
    expect(click.get('[data-test="lever"]').attributes('data-on')).toBe('no')
    expect(click.find('[data-test="start-hint"]').exists()).toBe(false)
    expect(click.get('[data-test="sandbox-scene"]').attributes('aria-label')).toBe('Rex at the machine. Your turn.')
    expect(click.get('[data-test="scanner"]').attributes('transform')).toBe('translate(0 0)')
    click.unmount()

    const keyed = mountScene()
    await keyed.get('[data-test="lever-hit"]').trigger('keydown', { key: 'Enter' })
    expect(keyed.get('[data-test="sandbox-scene"]').attributes('data-control')).toBe('player')
    expect(keyed.get('[data-test="sandbox-scene"]').attributes('data-miss')).toBe('no')
    keyed.unmount()

    const spaced = mountScene()
    document.body.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true, cancelable: true }))
    await nextTick()
    expect(spaced.get('[data-test="sandbox-scene"]').attributes('data-control')).toBe('auto')
    spaced.unmount()

    const touched = mountScene()
    await touched.get('[data-test="lever-hit"]').trigger('click')
    expect(touched.get('[data-test="sandbox-scene"]').attributes('data-control')).toBe('player')
    touched.unmount()

    const ignored = mountScene()
    const link = document.createElement('a')
    link.href = '/playground'
    link.textContent = 'playground'
    document.body.appendChild(link)
    link.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }))
    await nextTick()
    expect(ignored.get('[data-test="sandbox-scene"]').attributes('data-control')).toBe('auto')
    ignored.unmount()

    const scene = mountScene()
    const api = exposed(scene)
    let elapsed = 0
    while (elapsed < 8) {
      api.advance(1 / 30)
      elapsed += 1 / 30
    }
    expect(api.game.control).toBe('auto')
    expect(api.game.phase).toBe('playing')
    await scene.get('[data-test="rex"]').trigger('click')
    expect(api.game.control).toBe('player')
    await missUntilZone(scene, api)
    await nextTick()
    expect(scene.get('[data-test="scanner"]').attributes('transform')).toBe('translate(0 0)')
    expect(scene.find('[data-test="x-ray"]').exists()).toBe(false)
    expect(scene.find('[data-test="scan-line"]').exists()).toBe(false)
    expect(Number(scene.get('[data-test="machine"]').attributes('data-grown'))).toBeGreaterThan(0.9)
    const zonedBox = api.game.boxes.find(zoned)
    if (!zonedBox) throw new Error('missing zoned box')
    const place = boxPlace(zonedBox.progress, zonedBox.lane, zonedBox.spin)
    expect(place.x).toBeGreaterThanOrEqual(MACHINE_X)
    expect(place.x).toBeLessThanOrEqual(HIT_FRONT)
    const before = api.game.boxes.length
    await clearZoned(scene, api)
    expect(api.game.boxes.length).toBeLessThan(before)
    expect(api.game.control).toBe('player')
    expect(api.game.jolt).toBeGreaterThan(0)
    await nextTick()
    expect(scene.find('[data-test="cage"]').exists()).toBe(false)
    expect(scene.find('[data-test="score"]').exists()).toBe(false)
    scene.unmount()
  })

  it('gate break', async () => {
    const quiet = mountScene()
    const demo = exposed(quiet)
    let elapsed = 0
    while (elapsed < 30) {
      demo.advance(1 / 30)
      elapsed += 1 / 30
      expect(demo.game.phase).not.toBe('broken')
      expect(demo.game.control).toBe('auto')
      expect(demo.game.miss).toBe(0)
    }
    expect(demo.game.nextId - 1).toBeGreaterThan(demo.game.boxes.length)
    quiet.unmount()

    const wrapper = mountScene()
    const setItem = vi.spyOn(Storage.prototype, 'setItem')
    await wrapper.get('[data-test="rex"]').trigger('click')
    const api = exposed(wrapper)
    expect(api.game.control).toBe('player')
    await fumbleUntilBroken(wrapper, api)
    expect(api.game.phase).toBe('broken')
    expect(api.game.control).toBe('player')
    expect(wrapper.emitted('break')).toEqual([[true]])
    expect(setItem).not.toHaveBeenCalled()
    setItem.mockRestore()
    expect(wrapper.find('[data-test="score"]').exists()).toBe(false)
    expect(wrapper.find('[data-test="best"]').exists()).toBe(false)
    expect(wrapper.find('[data-test="start-hint"]').exists()).toBe(false)
    expect(wrapper.get('[data-test="sandbox-scene"]').attributes('aria-label')).toBe('Rex at the machine. A box got through.')
    api.advance(3)
    await nextTick()
    expect(api.game.control).toBe('auto')
    expect(api.game.phase).toBe('playing')
    expect(api.game.boxes).toHaveLength(0)
    expect(api.game.beltOn).toBe(true)
    expect(wrapper.emitted('rebuilt')).toHaveLength(1)
    wrapper.unmount()
  })

  it('gate pause', async () => {
    const callbacks: IntersectionObserverCallback[] = []
    class MockObserver implements IntersectionObserver {
      readonly root = null
      readonly rootMargin = ''
      readonly scrollMargin = ''
      readonly thresholds = []
      constructor(callback: IntersectionObserverCallback) {
        callbacks.push(callback)
      }
      observe(): void {}
      unobserve(): void {}
      disconnect(): void {}
      takeRecords(): IntersectionObserverEntry[] { return [] }
    }
    vi.stubGlobal('IntersectionObserver', MockObserver)
    const wrapper = mountScene()
    const scene = () => wrapper.get('[data-test="sandbox-scene"]')
    expect(scene().attributes('data-paused')).toBe('no')
    const callback = callbacks[0]
    if (!callback) throw new Error('hero was not observed')
    callback([{ isIntersecting: false } as IntersectionObserverEntry], {} as IntersectionObserver)
    await nextTick()
    expect(scene().attributes('data-paused')).toBe('yes')
    callback([{ isIntersecting: true } as IntersectionObserverEntry], {} as IntersectionObserver)
    await nextTick()
    expect(scene().attributes('data-paused')).toBe('no')
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => true })
    document.dispatchEvent(new Event('visibilitychange'))
    await nextTick()
    expect(scene().attributes('data-paused')).toBe('yes')
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => false })
    document.dispatchEvent(new Event('visibilitychange'))
    await nextTick()
    expect(scene().attributes('data-paused')).toBe('no')
    wrapper.unmount()
    vi.unstubAllGlobals()
  })

  it('gate side', async () => {
    const wrapper = mountScene()
    expect(wrapper.find('[data-test="belt"]').exists()).toBe(false)
    expect(wrapper.find('[data-test="floor"]').exists()).toBe(false)
    expect(wrapper.get('[data-test="sandbox-scene"]').attributes('data-side')).toBe('yes')
    const html = wrapper.html()
    expect(html).not.toContain('data-test="belt"')
    expect(html).not.toContain('data-test="floor"')
    await wrapper.get('[data-test="rex"]').trigger('click')
    const api = exposed(wrapper)
    let steps = 0
    while (!wrapper.find('[data-test="box"]').exists() && steps < 400) {
      api.advance(1 / 30)
      await nextTick()
      steps += 1
    }
    const box = wrapper.get('[data-test="box"]')
    expect(box.find('path').exists()).toBe(false)
    expect(box.get('rect').attributes('width')).toBe('36')
    expect(box.get('rect').attributes('height')).toBe('36')
    wrapper.unmount()
  })

  it('gate motion', () => {
    expect(blinkCurve(0)).toBe(0)
    expect(blinkCurve(0.07)).toBe(1)
    expect(blinkCurve(0.1)).toBe(1)
    expect(blinkCurve(0.23)).toBe(0)
    expect(blinkCurve(0.04)).toBeGreaterThan(0)
    expect(blinkCurve(0.04)).toBeLessThan(1)
    expect(blinkCurve(0.16)).toBeGreaterThan(0)
    expect(blinkCurve(0.16)).toBeLessThan(1)

    const rest = framePose({ mode: 'idle', t: 0, clock: 0, lever: 0, reduced: true, spring: settledSpring(), dt: 0 })
    expect(rest.eyeH).toBe(22)
    expect(rest.eyeLX).toBeCloseTo(-10.5)
    expect(rest.eyeRX).toBeCloseTo(10.5)
    expect(rest.handLX).toBeCloseTo(-18)
    expect(rest.footLY).toBeCloseTo(-7)

    const caught = { x: walkDistance(), y: 0, vx: 0, vy: 0 }
    let crouched = false
    for (let i = 0; i <= 12; i += 1) {
      const t = (YANK * i) / 12
      const lever = Math.min(1, t / (YANK * 0.3))
      const pose = framePose({
        mode: 'yank',
        t,
        clock: 1.25,
        lever,
        reduced: false,
        spring: caught,
        dt: 1 / 60,
      })
      const knob = leverKnob(lever)
      const gap = Math.hypot(pose.rootX + pose.handLX * SCALE - knob.x, pose.rootY + pose.handLY * SCALE - knob.y)
      expect(gap).toBeLessThanOrEqual(1)
      if (pose.rootY > rest.rootY + 1) crouched = true
    }
    expect(crouched).toBe(true)

    const ready = framePose({ mode: 'ready', t: 0, clock: 0, lever: 0, reduced: false, spring: caught, dt: 0 })
    expect(ready.rootX).toBeGreaterThan(rest.rootX + 40)
    const cheer = framePose({ mode: 'cheer', t: 0.2, clock: 0, lever: 0, reduced: false, spring: caught, dt: 0 })
    expect(cheer.handRY).toBeLessThan(-50)
    const nervous = framePose({ mode: 'nervous', t: 0, clock: 0.2, lever: 0, reduced: false, spring: caught, dt: 0 })
    expect(nervous.eyeRX).toBeGreaterThan(ready.eyeRX + 2)

    const sprung = stepSpring(settledSpring(), { x: 10, y: 0 }, 0.016)
    expect(sprung.x).toBeGreaterThan(0)
    expect(sprung.x).toBeLessThan(4)
  })

  it('a click on the game area takes over', async () => {
    const wrapper = mountScene()
    const scene = wrapper.get('[data-test="sandbox-scene"]')
    await scene.trigger('click')
    expect(scene.attributes('data-control')).toBe('player')
    expect(scene.attributes('data-presence')).toBe('pointer')
    expect(scene.attributes('data-miss')).toBe('no')
    wrapper.unmount()
  })

  it('pointer over the game takes the turn without hint text', async () => {
    const wrapper = mountScene()
    const scene = wrapper.get('[data-test="sandbox-scene"]')
    expect(wrapper.find('[data-test="start-hint"]').exists()).toBe(false)
    expect(wrapper.find('[data-test="speech"]').exists()).toBe(false)
    await scene.trigger('pointerenter', { pointerType: 'mouse' })
    expect(scene.attributes('data-control')).toBe('auto')
    expect(scene.attributes('data-presence')).toBe('pointer')
    expect(wrapper.find('[data-test="start-hint"]').exists()).toBe(false)
    await wrapper.get('[data-test="lever-hit"]').trigger('click')
    expect(scene.attributes('data-control')).toBe('player')
    expect(wrapper.find('[data-test="start-hint"]').exists()).toBe(false)
    expect(wrapper.find('[data-test="speech"]').exists()).toBe(false)
    await scene.trigger('pointerleave', { pointerType: 'mouse' })
    expect(scene.attributes('data-control')).toBe('auto')
    expect(wrapper.find('[data-test="start-hint"]').exists()).toBe(false)
    wrapper.unmount()
  })

  it('hover hands the turn back before a box can break the page', async () => {
    const wrapper = mountScene()
    const scene = wrapper.get('[data-test="sandbox-scene"]')
    await scene.trigger('pointerenter', { pointerType: 'mouse' })
    expect(scene.attributes('data-control')).toBe('auto')
    await wrapper.get('[data-test="rex"]').trigger('click')
    expect(scene.attributes('data-control')).toBe('player')
    const api = exposed(wrapper)
    let guard = 0
    while (!api.game.boxes.some(box => box.progress > 0.9) && guard < 4000) {
      api.advance(1 / 30)
      guard += 1
    }
    expect(api.game.boxes.some(box => box.progress > 0.9)).toBe(true)
    const boxes = api.game.boxes.map(box => ({ ...box }))
    await scene.trigger('pointerleave', { pointerType: 'mouse' })
    expect(api.game.control).toBe('auto')
    expect(api.game.phase).toBe('playing')
    expect(api.game.boxes).toEqual(boxes)
    api.advance(1)
    expect(api.game.phase).not.toBe('broken')
    wrapper.unmount()
  })

  it('keyboard focus takes over and blur hands back', async () => {
    const wrapper = mountScene()
    const scene = wrapper.get('[data-test="sandbox-scene"]')
    const lever = wrapper.get('[data-test="lever-hit"]')
    await lever.trigger('focusin')
    expect(scene.attributes('data-presence')).toBe('keys')
    expect(scene.attributes('data-control')).toBe('auto')
    expect(wrapper.find('[data-test="start-hint"]').exists()).toBe(false)
    expect(scene.attributes('aria-label')).toBe('Rex at the machine. Rex is running the machine.')
    await lever.trigger('keydown', { key: 'Enter' })
    expect(scene.attributes('data-control')).toBe('player')
    await scene.trigger('focusout', { relatedTarget: document.body })
    expect(scene.attributes('data-control')).toBe('auto')
    expect(scene.attributes('data-presence')).toBe('away')
    wrapper.unmount()
  })
})
