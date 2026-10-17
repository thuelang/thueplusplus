import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { DOT_R } from '@/rex/motion'
import { difficulty, scoreJump } from './game'
import {
  BELT_BOTTOM,
  BELT_FACE,
  CURTAIN_COUNT,
  CURTAIN_GAP,
  CURTAIN_W,
  FOOT_PEEK,
  GROUND,
  HINT_X,
  REX_LEVER,
  SCALE,
  VIEW_H,
  beltPoint,
  scoreFlashRadius,
  scoreLabelBottom,
  scoreNumberCenterY,
  scoreNumberTop,
} from './layout'

const hatRight = REX_LEVER + 24 * SCALE

describe('hero polish', () => {
  it('grounds rex so his feet touch the belt', () => {
    const footTop = GROUND + (-DOT_R - DOT_R) * SCALE
    const footBottom = GROUND
    const gap = footTop - BELT_BOTTOM
    const peek = footBottom - BELT_BOTTOM
    expect(gap).toBeLessThanOrEqual(0)
    expect(peek).toBe(FOOT_PEEK)
    expect(peek).toBeGreaterThan(6)
    expect(peek).toBeLessThan(18)
    expect(footBottom).toBeLessThan(VIEW_H - 8)
    expect(beltPoint(0).x).toBeGreaterThan(beltPoint(1).x)
    const scene = readFileSync('src/components/SandboxScene.vue', 'utf8')
    expect(scene.indexOf('data-test="floor"')).toBeLessThan(scene.indexOf('<Rex'))
    expect(scene.indexOf('<Rex')).toBeLessThan(scene.indexOf('data-test="belt"'))
  })

  it('keeps the hint off Rex', () => {
    expect(HINT_X).toBeGreaterThan(hatRight + 12)
    const scene = readFileSync('src/components/SandboxScene.vue', 'utf8')
    expect(scene).toContain(':x="HINT_X"')
    expect(scene).toContain('text-anchor="start"')
  })

  it('clips machine strokes at the belt and hangs curtains', () => {
    const scene = readFileSync('src/components/SandboxScene.vue', 'utf8')
    expect(scene).toContain('id="rex-machine-clip"')
    expect(scene).toContain('clip-path="url(#rex-machine-clip)"')
    expect(scene).toContain(':height="BELT_FACE + 80"')
    expect(CURTAIN_COUNT).toBe(3)
    expect(CURTAIN_GAP).toBeGreaterThan(CURTAIN_W * 0.8)
    expect(scene).not.toContain('GROUND - 16')
    expect(scene).not.toContain('GROUND - 10')
    expect(BELT_FACE).toBeLessThan(BELT_BOTTOM)
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
