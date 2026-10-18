import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { DOT_R } from '@/rex/motion'
import { difficulty, scoreJump } from './game'
import {
  GROUND,
  HINT_X,
  REX_LEVER,
  SCALE,
  SCORE_NUMBER_SIZE,
  VIEW_H,
  beltPoint,
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
    expect(scene).toContain('data-test="x-ray-silhouette"')
    expect(scene).toContain('data-test="scan-line"')
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
