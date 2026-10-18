import { describe, expect, it } from 'vitest'
import { beginAutoplay, beginPlayer, createGame, handBack, pull, step, type Game } from './game'
import { pastMachine, boxPlace, clearFlourish, flourishPose, type ClearFlourish } from './layout'

function playing() {
  return beginPlayer(beginAutoplay(createGame({ seed: 4, reduced: false })))
}

describe('clear flourish', () => {
  it('picks a spin or a flip, a grow, and a short fade', () => {
    const all = Array.from({ length: 64 }, (_, seed) => clearFlourish(seed))
    expect(all.every(item => item.grow >= 1.5 && item.grow <= 2)).toBe(true)
    expect(all.every(item => item.duration >= 0.3 && item.duration <= 0.45)).toBe(true)
    expect(all.every(item => Math.abs(item.spin) >= 50 && Math.abs(item.spin) <= 180)).toBe(true)
    expect(all.some(item => item.spin > 0)).toBe(true)
    expect(all.some(item => item.spin < 0)).toBe(true)
    expect(all.some(item => item.flip === 'none')).toBe(true)
    expect(all.some(item => item.flip === 'x')).toBe(true)
    expect(all.some(item => item.flip === 'y')).toBe(true)
    expect(clearFlourish(1)).not.toEqual(clearFlourish(2))
    expect(clearFlourish(3)).toEqual(clearFlourish(3))
    expect(() => clearFlourish(-1)).toThrow(/seed/)
    expect(() => clearFlourish(1.5)).toThrow(/seed/)
  })

  it('eases the spin, the grow, and the fade, and reduced motion only fades', () => {
    const flourish = clearFlourish(7)
    const base = 4
    const rest = flourishPose(base, flourish, 0, false)
    expect(rest).toEqual({ rot: base, sx: 1, sy: 1, opacity: 1 })

    const quarter = flourish.duration * 0.25
    const early = flourishPose(base, flourish, quarter, false)
    const linearFade = 1 - 0.25
    const linearScale = 1 + (flourish.grow - 1) * 0.25
    expect(early.opacity).toBeGreaterThan(0.95)
    expect(early.opacity).toBeGreaterThan(linearFade)
    expect(early.opacity).toBeLessThan(1)
    const moving = flourish.flip === 'x' ? Math.abs(early.sy) : Math.abs(early.sx)
    expect(moving).toBeGreaterThan(linearScale)
    expect(early.rot).not.toBeCloseTo(base + flourish.spin * 0.25, 3)

    const done = flourishPose(base, flourish, flourish.duration, false)
    expect(done.opacity).toBe(0)
    expect(done.rot).toBeCloseTo(base + flourish.spin, 6)
    expect(Math.abs(done.sx)).toBeCloseTo(flourish.grow, 6)
    expect(Math.abs(done.sy)).toBeCloseTo(flourish.grow, 6)
    if (flourish.flip === 'x') expect(done.sx).toBeLessThan(0)
    if (flourish.flip === 'y') expect(done.sy).toBeLessThan(0)
    if (flourish.flip === 'none') {
      expect(done.sx).toBeGreaterThan(0)
      expect(done.sy).toBeGreaterThan(0)
    }

    const faded = flourishPose(base, flourish, flourish.duration * 0.5, true)
    expect(faded.rot).toBe(base)
    expect(faded.sx).toBe(1)
    expect(faded.sy).toBe(1)
    expect(faded.opacity).toBeLessThan(1)
    expect(faded.opacity).toBeGreaterThan(0.5)

    expect(() => flourishPose(base, flourish, -0.01, false)).toThrow(/age/)
    expect(() => flourishPose(base, flourish, flourish.duration + 0.001, false)).toThrow(/age/)
    expect(() => flourishPose(Number.NaN, flourish, 0, false)).toThrow(/baseRot/)
    expect(() => flourishPose(base, flourish, 0, 'no' as unknown as boolean)).toThrow(/reduced/)
  })

  it('covers a flip on each axis when the seed asks for one', () => {
    const flipped = (flip: ClearFlourish['flip']): ClearFlourish => {
      const found = Array.from({ length: 64 }, (_, seed) => clearFlourish(seed)).find(item => item.flip === flip)
      if (!found) throw new Error(`missing ${flip}`)
      return found
    }
    for (const flip of ['x', 'y'] as const) {
      const flourish = flipped(flip)
      const mid = flourishPose(0, flourish, flourish.duration * 0.5, false)
      const end = flourishPose(0, flourish, flourish.duration, false)
      if (flip === 'x') {
        expect(mid.sx).toBeLessThan(0)
        expect(end.sx).toBeCloseTo(-flourish.grow, 6)
        expect(end.sy).toBeCloseTo(flourish.grow, 6)
      } else {
        expect(mid.sy).toBeLessThan(0)
        expect(end.sy).toBeCloseTo(-flourish.grow, 6)
        expect(end.sx).toBeCloseTo(flourish.grow, 6)
      }
    }
  })

  it('leaves a cleared box out of the game so it cannot break the page or the handoff', () => {
    const caught = { id: 7, progress: 0.9, lane: 0.5, spin: 0.2 }
    const other = { id: 8, progress: 0.86, lane: 0.3, spin: 0.7 }
    const game: Game = {
      ...playing(),
      boxes: [caught, other],
      spawnIn: 30,
      cooldown: 0,
      rex: 'ready',
      rexT: 0,
      lever: 0,
      leverT: 0,
    }
    let doomed: Game = { ...game, boxes: [caught] }
    let frames = 0
    while (doomed.phase === 'playing' && frames < 400) {
      doomed = step(doomed, 1 / 30)
      frames += 1
    }
    expect(doomed.phase).toBe('broken')
    expect(pastMachine(boxPlace(doomed.boxes[0].progress, doomed.boxes[0].lane, doomed.boxes[0].spin))).toBe(true)

    const cleared = pull(game)
    expect(cleared.phase).toBe('playing')
    expect(cleared.clears).toBe(2)
    expect(cleared.boxes).toEqual([])
    expect(cleared).not.toHaveProperty('jolt')
    const handed = handBack(cleared)
    expect(handed.control).toBe('auto')
    expect(handed.boxes).toEqual([])
    expect(handed.clears).toBe(2)

    let safe = { ...cleared, spawnIn: 30 }
    for (let frame = 0; frame < frames; frame += 1) safe = step(safe, 1 / 30)
    expect(safe.phase).toBe('playing')
    expect(safe.boxes.every(box => box.id !== caught.id && box.id !== other.id)).toBe(true)
  })
})
