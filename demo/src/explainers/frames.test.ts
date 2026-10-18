import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { ease } from '@/rex/motion'
import {
  PARALLAX_RATE,
  PORTABLE_OUTPUT,
  helloRules,
  keyboardX,
  originFrame,
  parallaxShift,
  portableFrame,
  portableOutputVisible,
  sandboxFrame,
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

  it('holds the origin cards on the rule and both strings when motion is reduced', () => {
    const held = originFrame(0, true)
    expect(held.mark).toBe(1)
    expect(held.swap).toBe(1)
    expect(held.showBefore).toBe(true)
    expect(held.showAfter).toBe(true)
    expect(held.lhsY).toBeLessThan(100)
    const start = originFrame(0, false)
    expect(start.showBefore).toBe(false)
    expect(start.lhsX).toBeLessThan(40)
    expect(start.swap).toBe(0)
    const mid = originFrame(3, false)
    expect(mid.lhsX).toBe(held.lhsX)
    expect(mid.mark).toBe(1)
    expect(mid.swap).toBe(0)
    expect(mid.showBefore).toBe(true)
  })

  it('opens stdout before it shows the missing socket', () => {
    const early = sandboxFrame(1.1, false)
    expect(early.out).toBeGreaterThan(0)
    expect(early.socket).toBe(0)
    const late = sandboxFrame(4.2, false)
    expect(late.out).toBe(1)
    expect(late.socket).toBe(1)
    expect(sandboxFrame(0, true)).toEqual({ out: 1, socket: 1 })
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

  it('offers the keyboard and holds it there when motion is reduced', () => {
    expect(keyboardX(0, false)).toBeLessThan(keyboardX(2, false))
    expect(keyboardX(2, false)).toBe(400)
    expect(keyboardX(0, true)).toBe(400)
  })
})
