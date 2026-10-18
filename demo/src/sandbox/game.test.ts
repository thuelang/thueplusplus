import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { BELT_ENTRANCE, BELT_MOUTH, BELT_X0, BOX_REACH, BREAK_BEAT, MACHINE_BASE, SCALE, VIEW_W, YANK, beltPoint, boxPlace, centerProgress, leverKnob, safeCatchProgress } from './layout'
import { framePose, settledSpring } from './motion'
import {
  GRACE,
  MISS_COOLDOWN,
  RETURN,
  TOUCH_IDLE,
  beginAutoplay,
  beginPlayer,
  handBack,
  planCatch,
  boxesOverlap,
  createGame,
  demoRuns,
  TRACK,
  difficulty,
  inZone,
  leverCurve,
  nearestBox,
  playerAct,
  pull,
  rebuild,
  roll,
  setPresence,
  step,
  type Box,
  type Game,
} from './game'

function until(game: Game, pred: (current: Game) => boolean, limit = 40): Game {
  let current = game
  let elapsed = 0
  while (!pred(current)) {
    current = step(current, 1 / 60)
    elapsed += 1 / 60
    if (elapsed > limit) throw new Error(`timed out at ${elapsed.toFixed(2)}s phase=${current.phase}`)
  }
  return current
}

function zoned(box: Box): boolean {
  return inZone(box.progress, box.lane, box.spin)
}

function started(seed: number, reduced: boolean): Game {
  return beginPlayer(createGame({ seed, reduced }))
}

function belt(game: Game): number {
  return difficulty(game.clears, game.reduced).beltRate
}

function canPull(game: Game): boolean {
  return game.phase === 'playing' && game.rex !== 'yank' && game.rex !== 'cheer' && game.cooldown === 0
}

function fumbleUntilBroken(game: Game, limit = 40): Game {
  let current = game.control === 'player' && game.phase === 'playing' ? game : beginPlayer(game)
  let elapsed = 0
  while (current.phase !== 'broken') {
    const ready = current.boxes.some(zoned)
    if (!ready && canPull(current)) current = pull(current)
    current = step(current, 1 / 60)
    elapsed += 1 / 60
    if (elapsed > limit) {
      throw new Error(`timed out fumbling at ${elapsed.toFixed(2)}s phase=${current.phase} control=${current.control}`)
    }
  }
  return current
}

function spawnTimes(seed: number, n: number): number[] {
  let game = started(seed, true)
  const times: number[] = []
  let seen = 0
  let t = 0
  while (times.length < n && t < 60) {
    if (game.boxes.some(zoned) && canPull(game)) game = pull(game)
    game = step(game, 1 / 60)
    t += 1 / 60
    if (game.phase === 'broken') throw new Error(`broke while sampling seed ${seed}`)
    const count = game.nextId - 1
    if (count > seen) {
      times.push(Number(t.toFixed(4)))
      seen = count
    }
  }
  if (times.length < n) throw new Error(`only ${times.length} spawns`)
  return times
}

function crossHalf(game: Game): { game: Game, dt: number } {
  const box = game.boxes.find(entry => entry.progress < 0.2)
  if (!box) throw new Error('no fresh box')
  const start = box.progress
  let current = game
  let dt = 0
  while (true) {
    const live = current.boxes.find(entry => entry.id === box.id)
    if (!live) throw new Error('box left the belt')
    if (live.progress >= start + 0.5) return { game: current, dt }
    if (current.phase !== 'playing') throw new Error(`phase ${current.phase}`)
    current = step(current, 1 / 60)
    dt += 1 / 60
    if (dt > 20) throw new Error('box did not cross')
  }
}

describe('lever game', () => {
  it('gate waits', () => {
    const game = createGame({ seed: 1, reduced: false })
    expect(game.phase).toBe('waiting')
    expect(game.beltOn).toBe(false)
    expect(game.rex).toBe('idle')
    expect(game.boxes).toHaveLength(0)
    expect(game.lever).toBe(0)
    expect(step(game, 8)).toBe(game)
    expect(step(game, 0)).toBe(game)
  })

  it('gate grace', () => {
    const reduced = started(1, true)
    expect(step(reduced, GRACE - 0.05).boxes).toHaveLength(0)
    expect(step(reduced, GRACE + 0.05).boxes).toHaveLength(1)

    const full = started(1, false)
    expect(full.rex).toBe('ready')
    expect(full.lever).toBe(0)
    expect(full.beltOn).toBe(true)
    expect(step(full, GRACE - 0.05).boxes).toHaveLength(0)
    expect(step(full, GRACE + 0.05).boxes).toHaveLength(1)

    expect(() => step(reduced, -0.1)).toThrow(/dt/)
    expect(() => step(reduced, Number.NaN)).toThrow(/dt/)
    expect(() => createGame({ seed: 0, reduced: false })).toThrow(/seed/)
    expect(() => createGame({ seed: 1.5, reduced: false })).toThrow(/seed/)
    expect(() => difficulty(0, 'no' as unknown as boolean)).toThrow(/reduced/)
    expect(() => difficulty(-1, false)).toThrow(/clears/)
    expect(() => difficulty(1.5, false)).toThrow(/clears/)
  })

  it('gate gaps', () => {
    expect(roll(1).value).toBeCloseTo(0.6270739405881613, 12)
    const first = spawnTimes(1, 6)
    const again = spawnTimes(1, 6)
    const other = spawnTimes(2, 6)
    expect(again).toEqual(first)
    expect(other).not.toEqual(first)
    const gaps = first.slice(1).map((time, index) => Number((time - first[index]).toFixed(3)))
    expect(new Set(gaps).size).toBeGreaterThan(1)
    expect(Math.min(...gaps)).toBeGreaterThan(0.4)
  })

  it('gate capture and miss', () => {
    let game = started(3, true)
    game = until(game, current => current.boxes.some(zoned))
    const hit = game.boxes.find(zoned)
    if (!hit) throw new Error('missing box')
    game = pull(game)
    expect(game.phase).toBe('playing')
    expect(game.boxes.some(box => box.id === hit.id)).toBe(false)
    expect(game.clears).toBe(1)
    expect(game).not.toHaveProperty('jolt')

    let miss = started(3, true)
    miss = pull(miss)
    expect(miss.phase).toBe('playing')
    expect(miss.clears).toBe(0)
    expect(miss.miss).toBe(1)
    expect(miss.cooldown).toBe(MISS_COOLDOWN)
    const refused = pull(miss)
    expect(refused.deny).toBe(1)
    expect(refused.rex).toBe(miss.rex)
    expect(refused.rexT).toBe(miss.rexT)
    expect(refused.cooldown).toBe(miss.cooldown)
    expect(pull(refused)).toBe(refused)

    let early = started(4, true)
    early = until(early, current => current.boxes.some(box => box.progress > 0.25 && !zoned(box)) && canPull(current))
    early = pull(early)
    expect(early.phase).toBe('playing')
    expect(early.miss).toBe(1)

    expect(inZone(0.86, 0.2, 0.4)).toBe(true)
    expect(inZone(0.45, 0.2, 0.4)).toBe(false)
    let ahead = started(9, true)
    ahead = {
      ...ahead,
      boxes: [{ id: 3, progress: 0.45, lane: 0.4, spin: 0.2 }],
      spawnIn: 30,
      rex: 'ready',
      cooldown: 0,
    }
    ahead = pull(ahead)
    expect(ahead.phase).toBe('playing')
    expect(ahead.miss).toBe(1)
    expect(ahead.boxes).toHaveLength(1)
  })

  it('gate ramp', () => {
    const low = difficulty(0, false)
    const mid = difficulty(6, false)
    const high = difficulty(18, false)
    const top = difficulty(48, false)
    expect(low.beltRate).toBeLessThan(mid.beltRate)
    expect(mid.beltRate).toBeLessThan(high.beltRate)
    expect(high.beltRate).toBeLessThan(top.beltRate)
    expect(low.gapLo).toBeGreaterThan(mid.gapLo)
    expect(mid.gapLo).toBeGreaterThan(high.gapLo)
    expect(low.span).toBeGreaterThan(mid.span)
    expect(mid.span).toBeGreaterThan(high.span)
    expect(high.gapHi - high.gapLo).toBeGreaterThan(0.4)
    expect(difficulty(4, true).beltRate).toBeLessThan(difficulty(4, false).beltRate)
    expect(difficulty(4, true).gapLo).toBeGreaterThan(difficulty(4, false).gapLo)
    expect(high.span).toBeGreaterThan(0.08)
    expect(high.gapLo).toBeGreaterThan(0.4)

    let slowGame = started(4, false)
    slowGame = until(slowGame, current => current.boxes.some(box => box.progress < 0.2))
    const slow = crossHalf(slowGame)
    let fastGame = beginAutoplay(createGame({ seed: 4, reduced: false }))
    let guard = 0
    while (fastGame.clears < 8) {
      fastGame = step(fastGame, 1 / 60)
      guard += 1
      if (fastGame.phase !== 'playing') throw new Error(`ramp broke at clear ${fastGame.clears}`)
      if (guard > 8000) throw new Error(`ramp stalled at ${fastGame.clears} clears`)
    }
    fastGame = until(fastGame, current => current.boxes.some(box => box.progress < 0.15) && current.phase === 'playing', 30)
    const fast = crossHalf(fastGame)
    expect(fast.dt).toBeLessThan(slow.dt * 0.75)
  })

  it('gate scale', () => {
    expect(TRACK).toBeGreaterThan(1)
    expect(BELT_X0).toBe(0)
    expect(BELT_ENTRANCE - BELT_MOUTH).toBeGreaterThan(1000)
    expect(beltPoint(0).x).toBe(BELT_ENTRANCE)
    expect(beltPoint(1).x).toBe(BELT_MOUTH)
    expect(beltPoint(0).x).toBeGreaterThan(beltPoint(1).x)
    for (const clears of [0, 6, 18]) {
      const now = difficulty(clears, false)
      const u = 1 - Math.exp(-clears / 6)
      const legacyRate = 0.17 + u * 0.45
      const legacySpan = 0.32 - u * 0.14
      expect(now.beltRate).toBeCloseTo(legacyRate / TRACK, 6)
      expect(now.span).toBeCloseTo(legacySpan / TRACK, 6)
      expect(now.span / now.beltRate).toBeCloseTo(legacySpan / legacyRate, 5)
      expect(1 / now.beltRate).toBeCloseTo(TRACK / legacyRate, 5)
    }
    expect(difficulty(0, true).beltRate).toBeCloseTo((0.17 / TRACK) * 0.55, 6)
  })

  it('autoplay soaks a fast belt without a break', () => {
    const frame = 1 / 60
    for (const reduced of [false, true]) {
      let game = beginAutoplay(createGame({ seed: 4, reduced }))
      const ceiling = difficulty(10_000, reduced).beltRate
      const target = difficulty(0, reduced).beltRate + (ceiling - difficulty(0, reduced).beltRate) * 0.9
      let elapsed = 0
      while (belt(game) < target) {
        game = step(game, frame)
        elapsed += frame
        if (game.phase !== 'playing') throw new Error(`autoplay broke at ${elapsed.toFixed(2)}s clears ${game.clears}`)
        if (game.control !== 'auto') throw new Error(`autoplay lost the lever at ${elapsed.toFixed(2)}s`)
        if (boxesOverlap(game.boxes)) throw new Error(`boxes stacked at ${elapsed.toFixed(2)}s`)
        if (elapsed > 240) throw new Error(`belt never got fast, clears ${game.clears} rate ${belt(game)}`)
      }
      expect(game.phase).toBe('playing')
      expect(game.clears).toBeGreaterThan(12)
      expect(belt(game)).toBeGreaterThan(difficulty(0, reduced).beltRate * 2.5)
    }
  })

  it('autoplay clears at the machine center', () => {
    const center = centerProgress()
    const low = difficulty(0, false).beltRate
    const high = difficulty(10_000, false).beltRate
    expect(planCatch(low, false)).toMatchObject({ clearAt: center, centered: true })
    expect(planCatch(high, false)).toMatchObject({ clearAt: center, centered: true })
    expect(planCatch(low, true).lead).toBe(0)
    expect(planCatch(low, true).centered).toBe(true)
    const late = planCatch(30, false)
    expect(late.centered).toBe(false)
    expect(late.clearAt).toBeLessThan(center)
    expect(late.clearAt).toBeLessThanOrEqual(safeCatchProgress())

    function tolerance(rate: number): number {
      return Math.abs(BELT_MOUTH - (VIEW_W + BOX_REACH)) * (rate / 30) + 2
    }

    function catchXs(clears: number, reduced: boolean, want: number): number[] {
      const rate = difficulty(clears, reduced).beltRate
      let game = { ...beginAutoplay(createGame({ seed: 4, reduced })), clears }
      const caught: number[] = []
      let frames = 0
      while (caught.length < want && frames < 6000) {
        const prev = game
        game = step(game, 1 / 60)
        frames += 1
        if (game.phase !== 'playing') throw new Error(`autoplay broke at clear ${game.clears}`)
        if (game.clears > prev.clears) {
          expect(game.windup).toBe(0)
          const removed = prev.boxes.filter(box => !game.boxes.some(next => next.id === box.id))
          const lead = removed.reduce((best, box) => (box.progress > best.progress ? box : best))
          caught.push(boxPlace(lead.progress, lead.lane, lead.spin).x)
        }
      }
      expect(caught).toHaveLength(want)
      for (const x of caught) {
        expect(Math.abs(x - MACHINE_BASE.x)).toBeLessThanOrEqual(tolerance(rate))
      }
      return caught
    }

    catchXs(0, false, 2)
    catchXs(80, false, 2)
    catchXs(0, true, 2)

    const plan = planCatch(low, false)
    let paired = beginAutoplay(createGame({ seed: 1, reduced: false }))
    paired = {
      ...paired,
      spawnIn: 30,
      nextId: 3,
      boxes: [
        { id: 1, progress: plan.clearAt - 0.02, lane: 0.5, spin: 0.5 },
        { id: 2, progress: plan.clearAt - 0.08, lane: 0.4, spin: 0.2 },
      ],
    }
    expect(paired.boxes.every(box => inZone(box.progress, box.lane, box.spin))).toBe(true)
    let pulls = 0
    let leadX = 0
    let guard = 0
    while (paired.clears < 2 && guard < 400) {
      const prev = paired
      paired = step(paired, 1 / 60)
      guard += 1
      if (paired.phase !== 'playing') throw new Error('paired clear broke')
      if (paired.clears > prev.clears) {
        pulls += 1
        expect(paired.clears - prev.clears).toBe(2)
        const removed = prev.boxes.filter(box => !paired.boxes.some(next => next.id === box.id))
        const lead = removed.reduce((best, box) => (box.progress > best.progress ? box : best))
        leadX = boxPlace(lead.progress, lead.lane, lead.spin).x
      }
    }
    expect(pulls).toBe(1)
    expect(Math.abs(leadX - MACHINE_BASE.x)).toBeLessThanOrEqual(tolerance(low))
    expect(paired.phase).toBe('playing')
    expect(paired.windup).toBe(0)
  })

  it('gate break', () => {
    let game = started(5, true)
    game = fumbleUntilBroken(game)
    expect(game.beltOn).toBe(false)
    expect(game.showRebuild).toBe(false)
    expect(game.rex).toBe('startled')
    game = step(game, BREAK_BEAT - 0.05)
    expect(game.showRebuild).toBe(false)
    game = step(game, 0.08)
    expect(game.showRebuild).toBe(true)
    const next = rebuild(game)
    expect(next.control).toBe('auto')
    expect(next.phase).toBe('playing')
    expect(next.boxes).toHaveLength(0)
    expect(next.beltOn).toBe(true)
    expect(next.seed).toBe(game.seed + 1)
    expect(next.clears).toBe(0)
    expect(belt(next)).toBe(difficulty(0, true).beltRate)
    expect(rebuild(next)).toBe(next)
    const resumed = until(game, current => current.control === 'auto' && current.phase === 'playing', RETURN + 1)
    expect(resumed.boxes).toHaveLength(0)
    expect(resumed.beltOn).toBe(true)
  })

  it('gate input', () => {
    const full = started(1, false)
    const reduced = started(1, true)
    expect(full.rex).toBe('ready')
    expect(full.lever).toBe(0)
    expect(reduced.rex).toBe('ready')
    expect(reduced.lever).toBe(0)
    expect(reduced.beltOn).toBe(true)

    let fullBox = until(full, current => current.boxes.length > 0)
    const fullCross = crossHalf(fullBox)
    let slowBox = until(reduced, current => current.boxes.length > 0)
    const slowCross = crossHalf(slowBox)
    expect(slowCross.dt).toBeGreaterThan(fullCross.dt * 1.5)

    let nervous = until(started(8, false), current => current.boxes.some(box => box.progress >= 0.84) && current.phase === 'playing')
    expect(nervous.rex).toBe('nervous')
  })

  it('gate autoplay', () => {
    for (const reduced of [false, true]) {
      let game = beginAutoplay(createGame({ seed: 4, reduced }))
      expect(game.control).toBe('auto')
      expect(game.phase).toBe('playing')
      expect(game.beltOn).toBe(true)
      expect(game.boxes).toHaveLength(0)
      let elapsed = 0
      while (elapsed < 60) {
        game = step(game, 1 / 30)
        elapsed += 1 / 30
        if (game.phase === 'broken') throw new Error(`autoplay broke at ${elapsed.toFixed(2)}s`)
        expect(game.miss).toBe(0)
        expect(game.control).toBe('auto')
        expect(boxesOverlap(game.boxes)).toBe(false)
      }
      expect(game.nextId - 1).toBeGreaterThan(game.boxes.length)
      let broken = beginPlayer(game)
      broken = fumbleUntilBroken(broken)
      expect(broken.phase).toBe('broken')
      const resumed = until(broken, current => current.control === 'auto' && current.phase === 'playing', RETURN + 1)
      let again = resumed
      let second = 0
      while (second < 60) {
        again = step(again, 1 / 30)
        second += 1 / 30
        if (again.phase === 'broken') throw new Error(`reset autoplay broke at ${second.toFixed(2)}s`)
        expect(boxesOverlap(again.boxes)).toBe(false)
      }
      expect(again.nextId - 1).toBeGreaterThan(again.boxes.length)
    }

    let visible = beginAutoplay(createGame({ seed: 9, reduced: false }))
    let sawScan = false
    let elapsed = 0
    while (visible.nextId - 1 <= visible.boxes.length && elapsed < 20) {
      visible = step(visible, 1 / 30)
      elapsed += 1 / 30
      if (visible.boxes.some(zoned)) sawScan = true
    }
    expect(sawScan).toBe(true)
    expect(visible.nextId - 1).toBeGreaterThan(visible.boxes.length)
    expect(visible.phase).toBe('playing')
  })

  it('gate takeover', () => {
    const demo = beginAutoplay(createGame({ seed: 2, reduced: true }))
    const playing = until(demo, current => current.boxes.length >= 1, 50)
    const taken = playerAct(playing)
    expect(taken.control).toBe('player')
    expect(taken.phase).toBe('playing')
    expect(taken.boxes).toEqual(playing.boxes)
    expect(taken.spawnIn).toBe(playing.spawnIn)
    expect(taken.rng).toBe(playing.rng)
    expect(taken.clears).toBe(playing.clears)
    expect(belt(taken)).toBe(belt(playing))

    const quiet = {
      ...taken,
      boxes: taken.boxes.filter(box => !zoned(box)),
    }
    const again = playerAct(quiet)
    expect(again.boxes).toEqual(quiet.boxes)
    expect(again.control).toBe('player')

    let missed = started(7, true)
    missed = fumbleUntilBroken(missed)
    expect(missed.control).toBe('player')
    expect(missed.phase).toBe('broken')

    let held = setPresence(started(7, true), 'pointer')
    held = step(held, TOUCH_IDLE + 5)
    expect(held.control).toBe('player')
    expect(held.phase).toBe('playing')

    let touched = setPresence(started(7, true), 'touch')
    touched = step(touched, TOUCH_IDLE - 0.05)
    expect(touched.control).toBe('player')
    let previous = touched
    touched = step(touched, 1 / 30)
    while (touched.control === 'player') {
      previous = touched
      touched = step(touched, 1 / 30)
    }
    expect(touched.control).toBe('auto')
    expect(touched.phase).toBe('playing')
    expect(touched.presence).toBe('away')
    expect(touched.clears).toBe(previous.clears)
    expect(belt(touched)).toBe(belt(previous))
    expect(touched.boxes).toEqual(previous.boxes)
  })

  it('never stack caught boxes', () => {
    let game = beginAutoplay(createGame({ seed: 12, reduced: false }))
    let elapsed = 0
    while (game.nextId < 14 && elapsed < 90) {
      game = step(game, 1 / 30)
      elapsed += 1 / 30
      expect(boxesOverlap(game.boxes)).toBe(false)
      expect(game.phase).not.toBe('broken')
    }
    expect(game.nextId).toBeGreaterThanOrEqual(14)
    expect(game.boxes.length).toBeLessThan(game.nextId - 1)
  })

  it('handoff keeps a box in range and Rex clears it', () => {
    let game = setPresence(beginPlayer(createGame({ seed: 15, reduced: true })), 'pointer')
    game = until(game, current => current.boxes.some(zoned), 30)
    const rate = belt(game)
    const ids = game.boxes.filter(zoned).map(box => box.id)
    const boxes = game.boxes.map(box => ({ ...box }))
    const handed = setPresence(game, 'away')
    expect(handed.control).toBe('auto')
    expect(handed.phase).toBe('playing')
    expect(handed.boxes).toEqual(boxes)
    expect(handed.clears).toBe(game.clears)
    expect(belt(handed)).toBe(rate)
    const later = step(handed, 8)
    expect(later.phase).not.toBe('broken')
    expect(later.control).toBe('auto')
    expect(later.clears).toBeGreaterThan(handed.clears)
    expect(belt(later)).toBeGreaterThan(rate)
    for (const id of ids) expect(later.boxes.some(box => box.id === id)).toBe(false)
  })

  it('a box Rex cannot clear passes without a break or a clear', () => {
    const riding = { id: 2, progress: 0.2, lane: 0.5, spin: 0.2 }
    const gone = { id: 1, progress: 1.2, lane: 0.4, spin: 0.1 }
    let game = beginPlayer(createGame({ seed: 4, reduced: false }))
    game = {
      ...game,
      spawnIn: 1.2,
      boxes: [gone, riding],
      rex: 'yank',
      rexT: 0.02,
      lever: leverCurve(0.02),
    }
    const handed = handBack(game)
    expect(handed.control).toBe('auto')
    expect(handed.boxes).toEqual([gone, riding])
    expect(handed.spawnIn).toBe(1.2)
    expect(handed.clears).toBe(0)
    expect(belt(handed)).toBe(difficulty(0, false).beltRate)
    const later = step(handed, 1 / 60)
    expect(later.phase).toBe('playing')
    expect(later.boxes.some(box => box.id === 1)).toBe(false)
    expect(later.boxes.some(box => box.id === 2)).toBe(true)
  })

  it('a mid-flight switch matches a run without the switch', () => {
    const frame = 1 / 60
    let origin = beginAutoplay(createGame({ seed: 9, reduced: false }))
    origin = until(origin, current => (
      current.boxes.length >= 2
      && current.boxes.some(zoned)
    ), 50)

    const alreadyPlayer = { ...origin, control: 'player' as const, idle: 0 }
    const switchedPlayer = beginPlayer(origin)
    expect(switchedPlayer.control).toBe('player')
    expect(switchedPlayer.boxes).toEqual(alreadyPlayer.boxes)
    expect(switchedPlayer.spawnIn).toBe(alreadyPlayer.spawnIn)
    expect(switchedPlayer.rng).toBe(alreadyPlayer.rng)
    expect(switchedPlayer.clears).toBe(alreadyPlayer.clears)
    expect(belt(switchedPlayer)).toBe(belt(alreadyPlayer))

    let stayedPlayer: Game = alreadyPlayer
    let becamePlayer: Game = switchedPlayer
    for (let i = 0; i < 90; i += 1) {
      stayedPlayer = step(stayedPlayer, frame)
      becamePlayer = step(becamePlayer, frame)
      expect(becamePlayer.boxes).toEqual(stayedPlayer.boxes)
      expect(becamePlayer.spawnIn).toBe(stayedPlayer.spawnIn)
      expect(becamePlayer.rng).toBe(stayedPlayer.rng)
      expect(becamePlayer.phase).toBe(stayedPlayer.phase)
    }

    const playerWorld = { ...origin, control: 'player' as const, presence: 'pointer' as const, idle: 0.2 }
    const alreadyAuto = { ...playerWorld, control: 'auto' as const, presence: 'away' as const, idle: 0 }
    const switchedAuto = handBack(playerWorld)
    expect(switchedAuto.control).toBe('auto')
    expect(switchedAuto.boxes).toEqual(alreadyAuto.boxes)
    expect(switchedAuto.spawnIn).toBe(alreadyAuto.spawnIn)
    expect(switchedAuto.rng).toBe(alreadyAuto.rng)

    let stayedAuto: Game = alreadyAuto
    let becameAuto: Game = switchedAuto
    for (let i = 0; i < 90; i += 1) {
      stayedAuto = step(stayedAuto, frame)
      becameAuto = step(becameAuto, frame)
      expect(becameAuto.boxes).toEqual(stayedAuto.boxes)
      expect(becameAuto.spawnIn).toBe(stayedAuto.spawnIn)
      expect(becameAuto.rng).toBe(stayedAuto.rng)
      expect(becameAuto.phase).toBe(stayedAuto.phase)
      expect(becameAuto.clears).toBe(stayedAuto.clears)
      expect(belt(becameAuto)).toBe(belt(stayedAuto))
    }
  })

  it('gate demo', () => {
    expect(demoRuns(false, true)).toBe(true)
    expect(demoRuns(true, true)).toBe(false)
    expect(demoRuns(false, false)).toBe(false)
    expect(demoRuns(true, false)).toBe(false)
    expect(() => demoRuns(0 as unknown as boolean, true)).toThrow(/hidden/)
    expect(() => demoRuns(false, 'yes' as unknown as boolean)).toThrow(/inView/)
  })

  it('cooldown matches the lever return', () => {
    expect(MISS_COOLDOWN).toBe(YANK)
    expect(leverCurve(0)).toBe(0)
    expect(leverCurve(YANK * 0.2)).toBeGreaterThan(0.5)
    expect(leverCurve(YANK - 1 / 60)).toBeGreaterThan(0)
    expect(leverCurve(YANK)).toBe(0)
    const scene = readFileSync('src/components/SandboxScene.vue', 'utf8')
    expect(scene).not.toContain('data-test="not-yet"')
    expect(scene).not.toContain('>miss</text>')
    const mid = leverCurve(YANK * 0.15)
    const straight = 0.15 / 0.3
    expect(mid).toBeGreaterThan(straight + 0.15)

    const frame = 1 / 60
    const earlyFrames = Math.floor((YANK - 1e-6) / frame)
    for (const reduced of [false, true]) {
      let game = beginPlayer(createGame({ seed: 1, reduced }))
      game = {
        ...game,
        boxes: [],
        spawnIn: 30,
        cooldown: 0,
        deny: 0,
        rex: 'ready',
        rexT: 0,
        lever: 0,
        leverT: 0,
        miss: 0,
      }
      game = pull(game)
      expect(game.rex).toBe('yank')
      expect(game.cooldown).toBe(YANK)
      expect(game.deny).toBe(0)
      for (let i = 0; i < earlyFrames; i += 1) game = step(game, frame)
      expect(game.rex).toBe('yank')
      expect(game.cooldown).toBeGreaterThan(0)
      expect(game.lever).toBeGreaterThan(0)
      const refused = pull(game)
      expect(refused.deny).toBe(1)
      expect(refused.rex).toBe('yank')
      expect(refused.rexT).toBe(game.rexT)
      expect(refused.cooldown).toBe(game.cooldown)
      expect(pull(refused)).toBe(refused)
      const ready = step(refused, frame)
      expect(ready.rex).toBe('ready')
      expect(ready.lever).toBe(0)
      expect(ready.cooldown).toBe(0)
      expect(ready.deny).toBe(0)
      const again = pull(ready)
      expect(again.rex).toBe('yank')
      expect(again.cooldown).toBe(YANK)
      expect(again.deny).toBe(0)
    }
  })

  function grip(game: Game, clock: number): { gap: number, rootX: number, rootY: number, handX: number, handY: number } {
    const near = nearestBox(game.boxes)
    const aim = near ? boxPlace(near.progress, near.lane, near.spin) : null
    const pose = framePose({
      mode: game.rex,
      t: game.rexT,
      clock,
      lever: game.lever,
      reduced: game.reduced,
      spring: settledSpring(),
      dt: 1 / 60,
      aim,
    })
    const knob = leverKnob(game.lever)
    const handX = pose.rootX + pose.handLX * SCALE
    const handY = pose.rootY + pose.handLY * SCALE
    return {
      gap: Math.hypot(handX - knob.x, handY - knob.y),
      rootX: pose.rootX,
      rootY: pose.rootY,
      handX,
      handY,
    }
  }

  it('hand and lever coincide for both triggers', () => {
    const frame = 1 / 60
    const watch = (game: Game, clock0: number) => {
      let current = game
      let clock = clock0
      let frames = 0
      expect(current.rex === 'yank' || current.rex === 'cheer').toBe(true)
      while (current.rex === 'yank' || current.rex === 'cheer') {
        expect(grip(current, clock).gap).toBeLessThanOrEqual(1)
        current = step(current, frame)
        clock += frame
        frames += 1
        if (frames > 80) throw new Error('pull did not finish')
      }
      expect(frames).toBeGreaterThan(10)
      expect(grip(current, clock).gap).toBeLessThanOrEqual(1)
    }

    let visitor = beginPlayer(createGame({ seed: 1, reduced: false }))
    visitor = {
      ...visitor,
      boxes: [],
      spawnIn: 30,
      rex: 'ready',
      rexT: 0,
      lever: 0,
      leverT: 0,
      cooldown: 0,
      deny: 0,
    }
    watch(pull(visitor), 0.4)

    let caught = { ...visitor, boxes: [{ id: 7, progress: 0.2, lane: 0.4, spin: 0.2 }] }
    caught = until(caught, current => current.boxes.some(zoned))
    watch(pull(caught), 1.7)

    for (const lever of [0, 0.35, 1]) {
      const held = grip({ ...visitor, rex: 'ready', lever, rexT: 0.2 }, 1.2)
      expect(held.gap).toBeLessThanOrEqual(1)
    }

    let auto = beginAutoplay(createGame({ seed: 4, reduced: false }))
    const rate = difficulty(0, false).beltRate
    const plan = planCatch(rate, false)
    auto = {
      ...auto,
      rex: 'ready',
      rexT: 0,
      lever: 0,
      leverT: 0,
      cooldown: 0,
      deny: 0,
      spawnIn: 40,
      boxes: [{ id: 3, progress: plan.clearAt - plan.lead * rate - rate * (2 / 60), lane: 0.4, spin: 0.3 }],
    }
    let clock = 0.9
    let frames = 0
    let startedPull = false
    for (let i = 0; i < 40; i += 1) {
      auto = step(auto, frame)
      clock += frame
      if (auto.rex === 'yank' || auto.rex === 'cheer') {
        startedPull = true
        expect(grip(auto, clock).gap).toBeLessThanOrEqual(1)
        frames += 1
      } else if (startedPull) {
        expect(grip(auto, clock).gap).toBeLessThanOrEqual(1)
        break
      }
    }
    expect(startedPull).toBe(true)
    expect(frames).toBeGreaterThan(8)
  })

  it('pose stays continuous when the trigger source switches', () => {
    const frame = 1 / 60
    let auto = beginAutoplay(createGame({ seed: 3, reduced: false }))
    auto = {
      ...auto,
      rex: 'yank',
      rexT: 0.08,
      lever: leverCurve(0.08),
      leverT: 0,
      spawnIn: 10,
      boxes: [{ id: 4, progress: 0.4, lane: 0.2, spin: 0.5 }],
    }
    const before = grip(auto, 0.5)
    const taken = beginPlayer(auto)
    expect(taken.control).toBe('player')
    expect(taken.rex).toBe(auto.rex)
    expect(taken.rexT).toBe(auto.rexT)
    expect(taken.lever).toBe(auto.lever)
    expect(taken.boxes).toEqual(auto.boxes)
    expect(taken.seed).toBe(auto.seed)
    const jumped = grip(taken, 0.5)
    expect(jumped.rootX).toBe(before.rootX)
    expect(jumped.rootY).toBe(before.rootY)
    expect(jumped.handX).toBe(before.handX)
    expect(jumped.handY).toBe(before.handY)

    const carried = step(taken, frame)
    const untouched = step({ ...auto, control: 'player' }, frame)
    const nextTaken = grip(carried, 0.5 + frame)
    const nextAuto = grip(untouched, 0.5 + frame)
    expect(nextTaken.rootX).toBe(nextAuto.rootX)
    expect(nextTaken.rootY).toBe(nextAuto.rootY)
    expect(nextTaken.handX).toBe(nextAuto.handX)
    expect(nextTaken.handY).toBe(nextAuto.handY)
    expect(Math.hypot(nextTaken.rootX - before.rootX, nextTaken.rootY - before.rootY)).toBeLessThan(5)

    const playing = {
      ...taken,
      boxes: [{ id: 8, progress: 0.55, lane: 0.3, spin: 0.1 }],
      rex: 'yank' as const,
      rexT: 0.1,
      lever: leverCurve(0.1),
    }
    const away = setPresence(playing, 'away')
    expect(away.control).toBe('auto')
    expect(away.presence).toBe('away')
    expect(away.rex).toBe(playing.rex)
    expect(away.rexT).toBe(playing.rexT)
    expect(away.lever).toBe(playing.lever)
    expect(away.boxes).toEqual(playing.boxes)
    expect(away.clears).toBe(playing.clears)
    expect(belt(away)).toBe(belt(playing))
    expect(away.seed).toBe(playing.seed)
    const atLeave = grip(away, 0.8)
    const atPlay = grip(playing, 0.8)
    expect(atLeave.rootX).toBe(atPlay.rootX)
    expect(atLeave.handX).toBe(atPlay.handX)
    expect(atLeave.handY).toBe(atPlay.handY)
    const left = grip(step(away, frame), 0.8 + frame)
    const stayed = grip(step(playing, frame), 0.8 + frame)
    expect(left.rootX).toBe(stayed.rootX)
    expect(left.rootY).toBe(stayed.rootY)
    expect(left.handX).toBe(stayed.handX)
    expect(left.handY).toBe(stayed.handY)
  })

  it('one pull clears every box in range', () => {
    const first = { id: 1, progress: 0.9, lane: 0.2, spin: 0.1 }
    const second = { id: 2, progress: 0.93, lane: 0.8, spin: 0.4 }
    let game = beginPlayer(createGame({ seed: 1, reduced: true }))
    game = {
      ...game,
      boxes: [first, second],
      spawnIn: 30,
      rex: 'ready',
      rexT: 0,
      lever: 0,
      leverT: 0,
      cooldown: 0,
      deny: 0,
    }
    expect(zoned(first)).toBe(true)
    expect(zoned(second)).toBe(true)
    const cleared = pull(game)
    expect(cleared.phase).toBe('playing')
    expect(cleared.boxes.some(box => box.id === first.id)).toBe(false)
    expect(cleared.boxes.some(box => box.id === second.id)).toBe(false)
    expect(cleared.clears).toBe(2)
    expect(belt(cleared)).toBeGreaterThan(belt(game))

    let auto = beginAutoplay(createGame({ seed: 2, reduced: false }))
    const ripe = centerProgress()
    auto = {
      ...auto,
      boxes: [
        { ...first, progress: ripe },
        { ...second, progress: ripe - 0.01 },
        { id: 3, progress: 0.2, lane: 0.5, spin: 0.2 },
      ],
      spawnIn: 30,
      rex: 'ready',
      rexT: 0,
      lever: 0,
      cooldown: 0,
    }
    auto = step(auto, 1 / 60)
    expect(auto.phase).toBe('playing')
    expect(auto.boxes.some(box => box.id === 1)).toBe(false)
    expect(auto.boxes.some(box => box.id === 2)).toBe(false)
    expect(auto.boxes.some(box => box.id === 3)).toBe(true)
    expect(auto.clears).toBe(2)
  })

  it('a box breaks the page only once it is past the machine', () => {
    const riding = { id: 2, progress: 0.45, lane: 0.15, spin: 0.3 }
    let front = beginPlayer(createGame({ seed: 8, reduced: true }))
    front = {
      ...front,
      boxes: [{ id: 1, progress: 0.5, lane: 0.8, spin: 0.2 }, riding],
      spawnIn: 30,
      rex: 'ready',
    }
    front = step(front, 0.4)
    expect(front.phase).toBe('playing')
    expect(front.boxes.some(box => box.id === 1)).toBe(true)

    let inside = beginPlayer(createGame({ seed: 8, reduced: true }))
    inside = {
      ...inside,
      boxes: [{ id: 4, progress: 1.02, lane: 0.5, spin: 0.2 }],
      spawnIn: 30,
      rex: 'ready',
    }
    inside = step(inside, 1 / 60)
    expect(inside.phase).toBe('playing')

    let past = beginPlayer(createGame({ seed: 8, reduced: true }))
    past = {
      ...past,
      boxes: [{ id: 5, progress: 1.2, lane: 0.5, spin: 0.2 }, riding],
      spawnIn: 30,
      rex: 'ready',
    }
    past = step(past, 1 / 60)
    expect(past.phase).toBe('broken')
    expect(past.control).toBe('player')
    expect(past.boxes.some(box => box.id === 2)).toBe(true)

    let auto = beginAutoplay(createGame({ seed: 8, reduced: false }))
    auto = {
      ...auto,
      boxes: [{ id: 5, progress: 1.2, lane: 0.5, spin: 0.2 }, riding],
      spawnIn: 30,
      rex: 'ready',
    }
    auto = step(auto, 1 / 60)
    expect(auto.phase).toBe('playing')
    expect(auto.boxes.some(box => box.id === 5)).toBe(false)
    expect(auto.boxes.some(box => box.id === 2)).toBe(true)
  })

  it('points at the closest box', () => {
    const near = { id: 1, progress: 0.95, lane: 0.15, spin: 0.2 }
    const far = { id: 2, progress: 0.2, lane: 0.85, spin: 0.7 }
    expect(nearestBox([far, near])?.id).toBe(near.id)
    expect(nearestBox([{ ...near, progress: 0.4 }, { ...far, progress: 0.88 }])?.id).toBe(far.id)

    const aim = boxPlace(near.progress, near.lane, near.spin)
    const farPlace = boxPlace(far.progress, far.lane, far.spin)
    const posed = (target: { x: number, y: number } | null) => framePose({
      mode: 'ready',
      t: 0,
      clock: 0.4,
      lever: 0,
      reduced: false,
      spring: settledSpring(),
      dt: 0,
      aim: target,
    })
    const aimed = posed(aim)
    const plain = posed(null)
    const knob = leverKnob(0)
    const leftX = aimed.rootX + aimed.handLX * SCALE
    const leftY = aimed.rootY + aimed.handLY * SCALE
    expect(Math.hypot(leftX - knob.x, leftY - knob.y)).toBeLessThanOrEqual(1)
    const handX = aimed.rootX + aimed.handRX * SCALE
    const handY = aimed.rootY + aimed.handRY * SCALE
    const restX = plain.rootX + plain.handRX * SCALE
    const restY = plain.rootY + plain.handRY * SCALE
    const dx = handX - restX
    const dy = handY - restY
    const towardNear = dx * (aim.x - restX) + dy * (aim.y - restY)
    const towardFar = dx * (farPlace.x - restX) + dy * (farPlace.y - restY)
    expect(towardNear).toBeGreaterThan(0)
    expect(towardNear).toBeGreaterThan(towardFar)

    const motion = readFileSync('src/sandbox/motion.ts', 'utf8')
    expect(motion.includes('control')).toBe(false)
    const scene = readFileSync('src/components/SandboxScene.vue', 'utf8')
    expect(scene).toContain('nearestBox')
    expect(scene).toContain('aim:')
  })

  it('one motion system serves both triggers', () => {
    const motion = readFileSync('src/sandbox/motion.ts', 'utf8')
    const source = readFileSync('src/sandbox/game.ts', 'utf8')
    expect(motion.includes('to-lever')).toBe(false)
    expect(motion.includes('control')).toBe(false)
    const advance = source.slice(source.indexOf('function advanceRex'), source.indexOf('function advanceBoxes'))
    const pose = motion.slice(motion.indexOf('export function framePose'))
    expect(advance.includes('control')).toBe(false)
    expect(advance.includes('to-lever')).toBe(false)
    expect(pose.includes('control')).toBe(false)
    const auto = source.slice(source.indexOf('function autoCatch'), source.indexOf('function leverLocked'))
    const pullSource = source.slice(source.indexOf('export function pull'), source.indexOf('export function demoRuns'))
    expect(auto.includes("control !== 'auto'")).toBe(true)
    expect(pullSource.includes("control !== 'player'")).toBe(true)
  })
})
