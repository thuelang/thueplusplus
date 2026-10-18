import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { ease } from '@/rex/motion'
import {
  PARALLAX_RATE,
  POP_RISE,
  PORTABLE_OUTPUT,
  SANDBOX_INSIDE_X,
  SANDBOX_OUTSIDE_X,
  SANDBOX_WALL_X,
  helloRules,
  originFrame,
  parallaxShift,
  portableFrame,
  portableOutputVisible,
  sandboxFrame,
  smashFrame,
  smallestFrame,
  span,
} from './frames'

describe('explainer frames', () => {
  it('moves with ease from the rex motion module', () => {
    const source = readFileSync('src/explainers/frames.ts', 'utf8')
    expect(source).toContain("from '@/rex/motion'")
    expect(source).not.toMatch(/gsap|animejs|fframes|motion\/react/)
    expect(span(0, 0, 1)).toBe(0)
    expect(span(1, 0, 1)).toBe(1)
    expect(span(0.5, 0, 1)).toBe(ease('inOut', 0.5))
    expect(span(0.25, 0, 1)).toBeCloseTo(0.0625)
    expect(() => span(0, 1, 1)).toThrow(/after/)
    expect(() => parallaxShift(Number.NaN, false)).toThrow(/finite/)
  })

  it('drifts the rewrite pattern slower than the scroll', () => {
    expect(PARALLAX_RATE).toBeGreaterThan(0)
    expect(PARALLAX_RATE).toBeLessThan(1)
    const moved = parallaxShift(-200, false)
    expect(moved).toBe(70)
    expect(Math.abs(moved)).toBeLessThan(200)
    expect(parallaxShift(-200, true)).toBe(0)
    const css = readFileSync('src/style.css', 'utf8')
    const reduced = css.slice(css.indexOf('@media (prefers-reduced-motion: reduce) {\n  .explainer-parallax'))
    expect(reduced.startsWith('@media (prefers-reduced-motion: reduce)')).toBe(true)
    expect(reduced).toContain('transform: none !important')
    const track = readFileSync('src/components/explainers/ExplainerTrack.vue', 'utf8')
    expect(track).toContain('::=')
  })

  it('marks a hello.thue match before it swaps', () => {
    expect(helloRules).toEqual([
      '^START$ ::= hello\\ndone',
      'hello ::> stdout Hello, World!\\n',
      'done ::- 0',
    ])
    const marked = smallestFrame(0.3, false)
    expect(marked.step).toBe(0)
    expect(marked.lines).toEqual(['START'])
    expect(marked.matchText).toBe('START')
    expect(marked.mark).toBeGreaterThan(0)
    expect(marked.swap).toBe(0)
    expect(marked.stdout).toBe('')
    const swapped = smallestFrame(1.9, false)
    expect(swapped.step).toBe(0)
    expect(swapped.swap).toBe(1)
    expect(swapped.lines).toEqual(['hello', 'done'])
    expect(swapped.matchText).toBe('')
    const next = smallestFrame(2.7, false)
    expect(next.step).toBe(1)
    expect(next.lines).toEqual(['hello', 'done'])
    expect(next.matchText).toBe('hello')
    expect(next.swap).toBe(0)
    const written = smallestFrame(4.4, false)
    expect(written.step).toBe(1)
    expect(written.swap).toBe(1)
    expect(written.lines).toEqual(['done'])
    expect(written.stdout).toBe(PORTABLE_OUTPUT)
    const exited = smallestFrame(6.9, false)
    expect(exited.step).toBe(2)
    expect(exited.exit).toBe(true)
    expect(exited.lines).toEqual(['done'])
    const held = smallestFrame(0, true)
    expect(held.lines).toEqual(['START'])
    expect(held.matchText).toBe('START')
    expect(held.result).toEqual(['hello', 'done'])
    expect(smallestFrame(7.5, false).lines).toEqual(smallestFrame(0, false).lines)
  })

  it('shows both strings when motion is reduced and one string while it rewrites', () => {
    const held = originFrame(0, true)
    expect(held.mark).toBe(1)
    expect(held.swap).toBe(1)
    expect(held.showBefore).toBe(true)
    expect(held.showAfter).toBe(true)
    const start = originFrame(0, false)
    expect(start.showBefore).toBe(false)
    expect(start.swap).toBe(0)
    const mid = originFrame(3, false)
    expect(mid.mark).toBe(1)
    expect(mid.swap).toBe(0)
    expect(mid.showBefore).toBe(true)
  })

  it('bumps the wall before the socket error lands in the string', () => {
    const early = sandboxFrame(1.92, false)
    expect(early.out).toBeGreaterThan(0)
    expect(early.out).toBeLessThan(1)
    expect(early.outX).toBeGreaterThan(SANDBOX_INSIDE_X)
    expect(early.outX).toBeLessThan(SANDBOX_OUTSIDE_X)
    expect(early.error).toBe(0)
    expect(early.tokenShow).toBe(false)
    const wall = sandboxFrame(4.48, false)
    expect(wall.out).toBe(1)
    expect(wall.outX).toBe(SANDBOX_OUTSIDE_X)
    expect(wall.tokenShow).toBe(true)
    expect(wall.tokenX).toBe(SANDBOX_WALL_X)
    expect(wall.tokenX).toBeGreaterThan(SANDBOX_INSIDE_X)
    expect(wall.error).toBe(0)
    const landed = sandboxFrame(6.2, false)
    expect(landed.out).toBe(1)
    expect(landed.error).toBe(1)
    expect(landed.tokenShow).toBe(false)
    const held = sandboxFrame(0, true)
    expect(held.outX).toBe(SANDBOX_OUTSIDE_X)
    expect(held.error).toBe(1)
    expect(held.tokenShow).toBe(false)
  })

  it('fills every host with one output, then walks them when motion is on', () => {
    const settled = portableFrame(0, true, 9)
    expect(settled.settled).toBe(true)
    for (let index = 0; index < 9; index += 1) expect(portableOutputVisible(index, settled)).toBe(true)
    const first = portableFrame(0, false, 9)
    expect(first.index).toBe(0)
    expect(first.travel).toBe(0)
    expect(portableOutputVisible(0, first)).toBe(false)
    const arrived = portableFrame(0.7, false, 9)
    expect(arrived.index).toBe(0)
    expect(arrived.travel).toBe(1)
    expect(portableOutputVisible(0, arrived)).toBe(true)
    expect(portableOutputVisible(1, arrived)).toBe(false)
    expect(() => portableFrame(0, false, 0)).toThrow(/host/)
  })

  it('pops letters out of the keyboard and holds them still when motion is reduced', () => {
    const calm = smashFrame(0, true)
    expect(calm.squash).toBe(1)
    expect(calm.lift).toBe(0)
    expect(calm.letters.map(letter => letter.char)).toEqual(['T', 'R', 'Y'])
    for (const letter of calm.letters) {
      expect(letter.opacity).toBe(1)
      expect(letter.flip).toBe(1)
      expect(letter.dy).toBe(0)
    }
    const idle = smashFrame(0, false)
    expect(idle.squash).toBe(1)
    expect(idle.lift).toBe(0)
    expect(idle.letters.every(letter => letter.opacity === 0)).toBe(true)
    const popping = smashFrame(0.72, false)
    const first = popping.letters[0]
    expect(first).toBeDefined()
    if (!first || !popping.letters[1]) throw new Error('smash frame lost a letter')
    expect(first.opacity).toBeGreaterThan(0)
    expect(first.opacity).toBeLessThan(1)
    expect(first.flip).toBeLessThan(1)
    expect(first.dy).toBeLessThan(0)
    expect(popping.letters[1].opacity).toBe(0)
    const bounced = smashFrame(1.16, false)
    const risen = bounced.letters[0]
    if (!risen) throw new Error('smash frame lost the first letter')
    expect(risen.dy).toBeCloseTo(-ease('outBack', 0.5) * POP_RISE)
    expect(risen.dy).toBeLessThan(-POP_RISE)
    const fading = smashFrame(1.58, false)
    const leaving = fading.letters[0]
    if (!leaving) throw new Error('smash frame lost the first letter')
    expect(leaving.opacity).toBeGreaterThan(0)
    expect(leaving.opacity).toBeLessThan(1)
    expect(leaving.dy).toBeLessThan(0)
    expect(smashFrame(4, false).letters.map(letter => letter.opacity)).toEqual(idle.letters.map(letter => letter.opacity))
  })
})
