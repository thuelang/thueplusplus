import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { DOT_R } from '@/rex/motion'
import { beginAutoplay, beginPlayer, createGame, difficulty, scoreJump, step } from './game'
import { framePose, settledSpring } from './motion'
import {
  BOX_REACH,
  DRIFT_BOTTOM,
  DRIFT_TOP,
  GROUND,
  HINT_X,
  MACHINE_GROW,
  MACHINE_X,
  REX_LEVER,
  SCALE,
  SCORE_NUMBER_SIZE,
  SCORE_X,
  VIEW_H,
  VIEW_W,
  beltPoint,
  boxInFrame,
  boxPlace,
  leverKnob,
  machineScale,
  scoreFlashRadius,
  scoreLabelBottom,
  scoreNumberCenterY,
  scoreNumberTop,
} from './layout'

const hatRight = REX_LEVER + 24 * SCALE

describe('hero polish', () => {
  it('keeps one ground line and shows the whole foot', () => {
    const footTop = GROUND + (-DOT_R - DOT_R) * SCALE
    const footBottom = GROUND
    expect(footBottom - footTop).toBeGreaterThan(24)
    expect(footTop).toBeLessThan(GROUND)
    expect(footBottom).toBe(GROUND)
    expect(footBottom).toBeLessThan(VIEW_H - 8)
    expect(beltPoint(0).x).toBeGreaterThan(beltPoint(1).x)
    const scene = readFileSync('src/components/SandboxScene.vue', 'utf8')
    expect(scene).toContain('data-test="floor"')
    expect(scene).not.toContain('data-test="belt"')
    expect(scene).not.toContain('data-test="belt-surface"')
    expect(scene).not.toContain('rex-belt-clip')
    expect(scene.indexOf('data-test="floor"')).toBeLessThan(scene.indexOf('<Rex'))
  })

  it('keeps the hint off Rex', () => {
    expect(HINT_X).toBeGreaterThan(hatRight + 12)
    const scene = readFileSync('src/components/SandboxScene.vue', 'utf8')
    expect(scene).toContain(':x="HINT_X"')
    expect(scene).toContain('text-anchor="start"')
  })

  it('draws no curtains and no cage stack', () => {
    const scene = readFileSync('src/components/SandboxScene.vue', 'utf8')
    expect(scene).not.toContain('scanner-flap')
    expect(scene).not.toContain('data-test="cage"')
    expect(scene).not.toContain('data-test="jail"')
    expect(scene).toContain('data-test="machine"')
    expect(scene).not.toContain('data-test="x-ray-silhouette"')
    expect(scene).not.toContain('data-test="scan-line"')
  })

  it('keeps the quiet score under the headline size', () => {
    expect(SCORE_NUMBER_SIZE).toBeLessThan(28)
    const scene = readFileSync('src/components/SandboxScene.vue', 'utf8')
    const page = readFileSync('src/pages/HomePage.vue', 'utf8')
    expect(scene).toContain('opacity="0.78"')
    expect(page).not.toContain('your-turn')
    expect(page).not.toContain('Your turn')
    expect(page).toContain('data-test="hero-install"')
    expect(scene).not.toContain('Your turn to take over')
  })

  it('keeps the score label clear of the flash', () => {
    const peak = scoreJump(0.84, 12, difficulty(40, false).beltRate, false)
    expect(peak.scale).toBeGreaterThan(2)
    expect(scoreNumberTop(peak.scale)).toBeGreaterThan(scoreLabelBottom() + 6)
    const top = scoreNumberCenterY() - scoreFlashRadius(peak.scale, peak.flash)
    expect(top).toBeGreaterThan(scoreLabelBottom() + 4)
    const scene = readFileSync('src/components/SandboxScene.vue', 'utf8')
    const jump = scene.indexOf('data-test="score-jump"')
    const label = scene.indexOf('data-test="score-label"')
    expect(jump).toBeGreaterThan(0)
    expect(label).toBeGreaterThan(jump)
    expect(scene.slice(jump, label)).not.toContain('score-label')
  })

  it('keeps the machine and the score inside the frame', () => {
    for (const width of [1440, 1024, 768]) {
      expect(MACHINE_X * width / VIEW_W).toBeGreaterThanOrEqual(32)
      expect(SCORE_X * width / VIEW_W).toBeGreaterThanOrEqual(32)
    }
    expect(MACHINE_X * 390 / VIEW_W).toBeGreaterThanOrEqual(8)
    expect(SCORE_X * 390 / VIEW_W).toBeGreaterThanOrEqual(8)
    expect(boxInFrame(0)).toBe(false)
    expect(boxInFrame(0.05)).toBe(true)
    expect(boxInFrame(1)).toBe(true)
    expect(boxInFrame(1.2)).toBe(false)
    expect(() => boxInFrame(Number.NaN)).toThrow(/finite/)
    const scene = readFileSync('src/components/SandboxScene.vue', 'utf8')
    expect(scene).toContain('drawnBoxes')
    expect(scene).toContain('boxInFrame')
    expect(scene).not.toContain('v-for="box in game.boxes"')
  })

  it('machine grows while a box is in range', () => {
    expect(machineScale(0)).toBe(1)
    expect(machineScale(1)).toBeCloseTo(1 + MACHINE_GROW, 5)
    expect(machineScale(1)).toBeGreaterThan(1.04)
    expect(machineScale(1)).toBeLessThan(1.08)
    expect(() => machineScale(-0.1)).toThrow(/grown/)
    const scene = readFileSync('src/components/SandboxScene.vue', 'utf8')
    expect(scene).toContain('machineScale')
    expect(scene).toContain('data-grown')
    expect(scene).not.toContain('data-test="scan-line"')
  })

  it('draws plain squares that drift in from the right', () => {
    const low = boxPlace(0.4, 0, 0.15)
    const high = boxPlace(0.4, 1, 0.85)
    expect(high.y - low.y).toBeGreaterThan(80)
    expect(low.y).toBeGreaterThan(DRIFT_TOP - 12)
    expect(high.y).toBeLessThan(DRIFT_BOTTOM + 12)
    expect(DRIFT_BOTTOM + 12).toBeLessThan(GROUND - 16)
    const spawned = boxPlace(0, 0.5, 0.2)
    expect(spawned.x - BOX_REACH).toBeGreaterThanOrEqual(VIEW_W)
    expect(boxPlace(1, 0.5, 0.2).x).toBeLessThan(spawned.x - 400)
    const turned = boxPlace(0.35, 0.4, 0.7)
    expect(Math.abs(turned.rot)).toBeGreaterThan(0)
    expect(Math.abs(turned.rot)).toBeLessThanOrEqual(12)
    const scene = readFileSync('src/components/SandboxScene.vue', 'utf8')
    expect(scene).not.toContain('data-test="x-ray"')
    expect(scene).toContain('width="36"')
    expect(scene).not.toContain('M-18 -18 H18')
  })

  it('puts the lever in the left hand', () => {
    const knob = leverKnob(0)
    expect(knob.x).toBeLessThan(REX_LEVER - 8)
    const ready = framePose({ mode: 'ready', t: 0, clock: 0, lever: 0, reduced: false, spring: settledSpring(), dt: 0 })
    const handX = ready.rootX + ready.handLX * SCALE
    const handY = ready.rootY + ready.handLY * SCALE
    expect(handX).toBeCloseTo(knob.x, 0)
    expect(handY).toBeCloseTo(knob.y, 0)
    expect(ready.handLX).toBeLessThan(0)
    expect(ready.handLX).toBeLessThan(ready.handRX)
    expect(handX).toBeGreaterThan(MACHINE_X + 80)
  })

  it('seamless takeover keeps Rex where he is', () => {
    let game = beginAutoplay(createGame({ seed: 3, reduced: false, best: 4 }))
    game = step(game, 0.3)
    expect(game.rex).not.toBe('idle')
    const taken = beginPlayer(game)
    expect(taken.control).toBe('player')
    expect(taken.rex).toBe(game.rex)
    expect(taken.rexT).toBe(game.rexT)
    expect(taken.lever).toBe(game.lever)
    expect(taken.score).toBe(0)
    expect(taken.best).toBe(4)
    expect(taken.boxes).toHaveLength(0)
  })

  it('pauses animation frames while hidden', () => {
    const scene = readFileSync('src/components/SandboxScene.vue', 'utf8')
    const rex = readFileSync('src/rex/useRex.ts', 'utf8')
    for (const source of [scene, rex]) {
      expect(source).toContain('document.hidden')
      expect(source).toContain("addEventListener('visibilitychange'")
      const hidden = source.slice(source.indexOf('document.hidden'))
      expect(hidden).toContain('return')
    }
  })
})
