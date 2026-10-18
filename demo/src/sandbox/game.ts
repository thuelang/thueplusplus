/**
 * Lever-timing game for the home sandbox.
 *
 * Rex autoplays on load and catches every box, so the demo loops and the
 * page does not break. A click on the game, or Space or Enter while it is
 * focused, hands him the lever and starts a fresh score. The visitor keeps
 * that turn only while the pointer stays over the game, the last touch is
 * still recent, or the game stays focused. Leaving, a short touch idle, or
 * blur hands the same pose back to autoplay and drops every box in flight,
 * so the handoff cannot break the page. Only a miss while the visitor still has the turn
 * breaks the run. Caught boxes are removed. They are not kept, so they
 * cannot pile up.
 * Nothing here reads the clock, the DOM, or storage.
 */

import { BELT_ENTRANCE, BELT_MOUTH, BREAK_BEAT, CHEER, YANK } from './layout'

export const GRACE = 0.8
/** A miss locks the lever for one pull. The return animation is this long too. */
export const MISS_COOLDOWN = YANK
export const MILESTONE = 5
export const DANGER = 0.84
/**
 * Seconds after the last touch before Rex resumes the demo.
 * Long enough for a box already on screen to reach the scanner, and short
 * enough that a lifted finger does not hold the turn.
 */
export const TOUCH_IDLE = 8
/** Seconds the break stays up before the demo resumes. */
export const RETURN = BREAK_BEAT + 1.6
/**
 * The page-wide belt is longer than the old machine-side belt.
 * Progress speed and the capture fraction both divide by this, so a box
 * takes longer to arrive and the time inside the capture zone stays put.
 * Gaps multiply by the same factor, so the boxes keep their spacing.
 */
export const TRACK = 2
const POP_LIFE = 0.85
const CROWD = 0.18
const REDUCED = 0.55

export interface Box {
  id: number
  /** 0 just past the right edge, 1 at the machine. */
  progress: number
  /** 0 to 1. Picks the drift height. */
  lane: number
  /** 0 to 1. Picks the gentle turn. */
  spin: number
}

export interface Cage {
  id: number
}

export type Phase = 'waiting' | 'playing' | 'broken'
export type Control = 'auto' | 'player'
/** Who is present. `away` is Rex's demo. A touch idle is the only timer. */
export type Presence = 'away' | 'pointer' | 'touch' | 'keys'
export type RexMode = 'idle' | 'ready' | 'yank' | 'cheer' | 'nervous' | 'startled'

export interface Game {
  phase: Phase
  seed: number
  rng: number
  score: number
  best: number
  boxes: Box[]
  cages: Cage[]
  nextId: number
  /** Seconds until the next box. */
  spawnIn: number
  cooldown: number
  /** 1 after a pull that was still locked. 0 once the lever can be pulled. */
  deny: number
  /** 0 is resting, 1 is yanked. */
  lever: number
  leverT: number
  rex: RexMode
  rexT: number
  flash: number
  jolt: number
  miss: number
  /** Consecutive scores since the last miss. */
  streak: number
  /** 1 at the instant of a score, then falls to 0. */
  pop: number
  brokenT: number
  showRebuild: boolean
  reduced: boolean
  beltOn: boolean
  /** Rex runs the demo, or the player has the lever. */
  control: Control
  /** Pointer, touch, or keyboard focus. Away means Rex has the illustration. */
  presence: Presence
  /** Seconds since the player's last touch. Pointer and keys do not use it. */
  idle: number
}

export interface Difficulty {
  /** Progress per second. */
  beltRate: number
  /** Shortest and longest seconds between boxes. */
  gapLo: number
  gapHi: number
  /** Capture zone is [1 - span, 1). */
  span: number
}

export interface GameOptions {
  seed: number
  reduced: boolean
  best: number
}

export function difficulty(score: number, reduced: boolean): Difficulty {
  if (!Number.isFinite(score) || score < 0) throw new Error(`score must be >= 0, got ${score}`)
  if (typeof reduced !== 'boolean') throw new Error('reduced must be a boolean')
  const u = 1 - Math.exp(-score / 6)
  const legacyRate = 0.17 + u * 0.45
  const legacySpan = 0.32 - u * 0.14
  const stretch = reduced ? 1 / REDUCED : 1
  return {
    beltRate: (legacyRate / TRACK) * (reduced ? REDUCED : 1),
    gapLo: (1.7 - u * 1.05) * stretch * TRACK,
    gapHi: (3.1 - u * 1.15) * stretch * TRACK,
    span: legacySpan / TRACK,
  }
}

export interface ScoreJump {
  /** 1 at rest. Peaks above 1, dips below 1, then settles. */
  scale: number
  /** 1 at the score, 0 once the pop is over. */
  flash: number
  /** 0 at the caged box, 1 at the score. Reduced motion stays at 0. */
  travel: number
}

/** How hard the score number jumps. Bigger streak and a faster belt hit harder. */
export function scoreJump(pop: number, streak: number, beltRate: number, reduced: boolean): ScoreJump {
  if (!Number.isFinite(pop) || pop < 0 || pop > 1) throw new Error(`pop must be from 0 to 1, got ${pop}`)
  if (!Number.isInteger(streak) || streak < 0) throw new Error(`streak must be an integer >= 0, got ${streak}`)
  if (!Number.isFinite(beltRate) || beltRate <= 0) throw new Error(`beltRate must be > 0, got ${beltRate}`)
  if (typeof reduced !== 'boolean') throw new Error('reduced must be a boolean')
  if (pop === 0) return { scale: 1, flash: 0, travel: reduced ? 0 : 1 }
  const t = 1 - pop
  const punch = 0.62 + Math.min(streak, 12) * 0.07 + Math.max(0, beltRate - 0.05) * 1.1
  let rise = 0
  if (t < 0.16) rise = t / 0.16
  else if (t < 0.34) rise = 1 - ((t - 0.16) / 0.18) * 1.12
  else if (t < 0.55) rise = -0.12 + ((t - 0.34) / 0.21) * 0.28
  else rise = 0.16 * (1 - (t - 0.55) / 0.45)
  if (reduced) return { scale: 1, flash: pop, travel: 0 }
  return { scale: 1 + punch * rise, flash: pop, travel: t }
}

export function inZone(progress: number, score: number, reduced: boolean): boolean {
  const { span } = difficulty(score, reduced)
  return progress >= 1 - span && progress < 1
}

/** A traveling box is 36 view units wide. Centers closer than that are a stack. */
export const BOX_W = 36

export function boxesOverlap(boxes: readonly Box[]): boolean {
  const span = BELT_ENTRANCE - BELT_MOUTH
  if (span <= 0) throw new Error(`belt travel must be positive, got ${span}`)
  const min = BOX_W / span
  const sorted = [...boxes].sort((a, b) => a.progress - b.progress || a.id - b.id)
  for (let index = 1; index < sorted.length; index += 1) {
    const gap = sorted[index].progress - sorted[index - 1].progress
    if (gap < min) return true
  }
  return false
}

/** mulberry32. Same state, same next value. State 0 is a later stream value, not a seed. */
export function roll(state: number): { state: number, value: number } {
  if (!Number.isInteger(state) || state < 0 || state > 0xffffffff) {
    throw new Error(`rng state must be an integer from 0 to 4294967295, got ${state}`)
  }
  let a = state | 0
  a = (a + 0x6d2b79f5) | 0
  let t = Math.imul(a ^ (a >>> 15), 1 | a)
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
  return { state: a >>> 0, value: ((t ^ (t >>> 14)) >>> 0) / 4294967296 }
}

export function leverCurve(t: number): number {
  const u = t / YANK
  if (u <= 0) return 0
  if (u < 0.3) return u / 0.3
  if (u < 1) return Math.max(0, 1 - (u - 0.3) / 0.7)
  return 0
}

/** Height and turn. Visual only, so the gap stream stays the one the timing tests measure. */
function driftOf(id: number): { lane: number, spin: number } {
  const laneRoll = roll(Math.imul(id, 0x9e3779b1) >>> 0)
  const spinRoll = roll(laneRoll.state)
  return { lane: laneRoll.value, spin: spinRoll.value }
}

export function createGame(options: GameOptions): Game {
  if (!Number.isInteger(options.seed) || options.seed < 1 || options.seed > 0xffffffff) {
    throw new Error(`seed must be an integer from 1 to 4294967295, got ${options.seed}`)
  }
  if (typeof options.reduced !== 'boolean') throw new Error('reduced must be a boolean')
  if (!Number.isInteger(options.best) || options.best < 0) {
    throw new Error(`best must be an integer >= 0, got ${options.best}`)
  }
  return {
    phase: 'waiting',
    seed: options.seed,
    rng: options.seed,
    score: 0,
    best: options.best,
    boxes: [],
    cages: [],
    nextId: 1,
    spawnIn: 0,
    cooldown: 0,
    deny: 0,
    lever: 0,
    leverT: 0,
    rex: 'idle',
    rexT: 0,
    flash: 0,
    jolt: 0,
    miss: 0,
    streak: 0,
    pop: 0,
    brokenT: 0,
    showRebuild: false,
    reduced: options.reduced,
    beltOn: false,
    control: 'auto',
    presence: 'away',
    idle: 0,
  }
}

function nextSeed(seed: number): number {
  return seed === 0xffffffff ? 1 : seed + 1
}

function arm(game: Game, control: Control): Game {
  const reduced = game.reduced
  return {
    ...createGame({ seed: nextSeed(game.seed), reduced, best: game.best }),
    control,
    presence: game.presence,
    phase: 'playing',
    beltOn: true,
    rex: 'ready',
    rexT: 0,
    spawnIn: GRACE,
    lever: 0,
    leverT: 0,
    idle: 0,
  }
}

/** Rex starts the demo. The score climbs and a missed box does not break the page. */
export function beginAutoplay(game: Game): Game {
  return arm(game, 'auto')
}

/**
 * The player takes the lever. The score resets and boxes in flight are dropped.
 * The best score stays. Pose, lever, and the pull already in motion stay.
 */
export function beginPlayer(game: Game): Game {
  if (game.phase !== 'playing' || game.rex === 'idle') return arm(game, 'player')
  return {
    ...game,
    control: 'player',
    score: 0,
    streak: 0,
    boxes: [],
    cages: [],
    idle: 0,
  }
}

/**
 * The pointer left, the touch went idle, or focus left the game.
 * A playing turn hands the same pose back to autoplay, drops every box in
 * flight, and starts the score again. The best score stays. A break or a
 * game that has not started yet begins a fresh run, already at the lever.
 */
export function handBack(game: Game): Game {
  if (game.control === 'auto' && game.phase !== 'broken') {
    return game.presence === 'away' ? game : { ...game, presence: 'away', idle: 0 }
  }
  if (game.phase === 'playing') {
    return {
      ...game,
      control: 'auto',
      presence: 'away',
      idle: 0,
      score: 0,
      streak: 0,
      boxes: [],
      cages: [],
    }
  }
  return beginAutoplay({ ...game, presence: 'away' })
}

export function setPresence(game: Game, presence: Presence): Game {
  if (presence !== 'away' && presence !== 'pointer' && presence !== 'touch' && presence !== 'keys') {
    throw new Error(`presence must be away, pointer, touch, or keys, got ${presence}`)
  }
  if (presence === 'away') return handBack(game)
  if (presence === 'touch') return { ...game, presence, idle: 0 }
  if (presence === game.presence) return game
  return { ...game, presence, idle: 0 }
}

function hottest(game: Game): Box | undefined {
  return game.boxes
    .filter(box => inZone(box.progress, game.score, game.reduced))
    .sort((a, b) => b.progress - a.progress || a.id - b.id)[0]
}

function scoreHit(game: Game, hit: Box): Game {
  const score = game.score + 1
  const milestone = score % MILESTONE === 0
  return {
    ...game,
    score,
    boxes: game.boxes.filter(box => box.id !== hit.id),
    cages: [],
    flash: 1,
    jolt: 1,
    pop: 1,
    streak: game.streak + 1,
    miss: 0,
    cooldown: 0,
    deny: 0,
    idle: 0,
    rex: milestone ? 'cheer' : 'yank',
    rexT: 0,
    lever: game.reduced ? 1 : 0,
    leverT: game.reduced ? 0.12 : 0,
  }
}

/**
 * Rex catches once the box is in the middle of the scan.
 * The opening of the tunnel stays visible as an X-ray before he pulls.
 * A box that reaches the exit is still caught, so the demo does not break.
 */
function autoCatch(game: Game): Game {
  if (game.control !== 'auto' || game.phase !== 'playing') return game
  const { span } = difficulty(game.score, game.reduced)
  const mark = 1 - span * 0.45
  const hit = game.boxes
    .filter(box => box.progress >= mark && box.progress < 1)
    .sort((a, b) => b.progress - a.progress || a.id - b.id)[0]
  if (!hit) return game
  return scoreHit(game, hit)
}

function leverLocked(game: Game): boolean {
  return game.rex === 'yank' || game.rex === 'cheer' || game.cooldown > 0
}

function notYet(game: Game): Game {
  if (game.deny > 0) return game
  return { ...game, deny: 1 }
}

export function pull(game: Game): Game {
  if (game.phase !== 'playing' || game.control !== 'player') return game
  if (leverLocked(game)) return notYet(game)
  const hit = hottest(game)
  if (!hit) {
    return {
      ...game,
      idle: 0,
      cooldown: MISS_COOLDOWN,
      deny: 0,
      miss: 1,
      streak: 0,
      rex: 'yank',
      rexT: 0,
      lever: game.reduced ? 1 : 0,
      leverT: 0,
    }
  }
  return scoreHit(game, hit)
}

/** The demo steps only while the tab is visible and the hero is on screen. */
export function demoRuns(hidden: boolean, inView: boolean): boolean {
  if (typeof hidden !== 'boolean') throw new Error(`hidden must be a boolean, got ${hidden}`)
  if (typeof inView !== 'boolean') throw new Error(`inView must be a boolean, got ${inView}`)
  return !hidden && inView
}

/** A click or key on the game. Autoplay and a break become the player's run. */
export function playerAct(game: Game): Game {
  if (game.control === 'player' && game.phase === 'playing') return pull(game)
  return beginPlayer(game)
}

export function rebuild(game: Game): Game {
  if (game.phase !== 'broken') return game
  return beginAutoplay(game)
}

function settle(game: Game): Game {
  if (game.phase !== 'playing') return game
  if (game.rex === 'yank' || game.rex === 'cheer') return game
  if (game.reduced) return game.rex === 'ready' ? game : { ...game, rex: 'ready', rexT: 0 }
  const danger = game.boxes.some(box => box.progress >= DANGER)
  const rex = danger ? 'nervous' : 'ready'
  if (game.rex === rex) return game
  return { ...game, rex, rexT: 0 }
}

function advanceRex(game: Game, dt: number): Game {
  if (game.phase === 'broken') {
    return { ...game, rex: 'startled', rexT: game.rexT + dt, lever: 0, leverT: 0 }
  }
  if (game.rex === 'yank' || game.rex === 'cheer') {
    const limit = game.rex === 'cheer' ? CHEER : YANK
    const t = game.rexT + dt
    const lever = game.reduced ? (t < limit ? 1 : 0) : (t < limit ? leverCurve(t * (YANK / limit)) : 0)
    if (t < limit) return { ...game, rexT: t, lever, leverT: 0 }
    return settle({ ...game, rex: 'ready', rexT: 0, lever: 0, leverT: 0 })
  }
  let leverT = game.leverT
  let lever = game.lever
  if (leverT > 0) {
    leverT = Math.max(0, leverT - dt)
    lever = leverT > 0 ? 1 : 0
  }
  return settle({ ...game, lever, leverT })
}

function advanceBoxes(game: Game, dt: number): Game {
  if (game.phase !== 'playing' || !game.beltOn) return game
  const { beltRate } = difficulty(game.score, game.reduced)
  const boxes = game.boxes.map(box => ({ ...box, progress: box.progress + beltRate * dt }))
  const escaped = boxes.find(box => box.progress >= 1)
  if (!escaped) return { ...game, boxes }
  if (game.control === 'auto') return scoreHit({ ...game, boxes }, escaped)
  return {
    ...game,
    phase: 'broken',
    beltOn: false,
    boxes,
    best: Math.max(game.best, game.score),
    brokenT: 0,
    showRebuild: false,
    rex: 'startled',
    rexT: 0,
    lever: 0,
    leverT: 0,
    cooldown: 0,
    deny: 0,
  }
}

function advanceSpawn(game: Game, dt: number): Game {
  if (game.phase !== 'playing' || !game.beltOn) return game
  const spawnIn = game.spawnIn - dt
  if (spawnIn > 0) return { ...game, spawnIn }
  if (game.boxes.some(box => box.progress < CROWD)) return { ...game, spawnIn: 0.05 }
  const diff = difficulty(game.score, game.reduced)
  const rolled = roll(game.rng)
  const gap = diff.gapLo + rolled.value * (diff.gapHi - diff.gapLo)
  const drift = driftOf(game.nextId)
  return {
    ...game,
    rng: rolled.state,
    spawnIn: gap,
    nextId: game.nextId + 1,
    boxes: [...game.boxes, { id: game.nextId, progress: 0, lane: drift.lane, spin: drift.spin }],
  }
}

function advanceBroken(game: Game, dt: number): Game {
  const brokenT = game.brokenT + dt
  return {
    ...advanceRex(game, dt),
    brokenT,
    showRebuild: brokenT + 1e-9 >= BREAK_BEAT,
    beltOn: false,
  }
}

function decay(game: Game, dt: number): Game {
  const next = {
    ...game,
    jolt: Math.max(0, game.jolt - dt / 0.4),
    flash: Math.max(0, game.flash - dt / 0.28),
    pop: Math.max(0, game.pop - dt / POP_LIFE),
    miss: Math.max(0, game.miss - dt / 0.5),
    cooldown: Math.max(0, game.cooldown - dt),
  }
  if (next.deny > 0 && !leverLocked(next)) return { ...next, deny: 0 }
  return next
}

function stepOnce(game: Game, dt: number): Game {
  if (game.phase === 'broken') {
    const held = advanceBroken(game, dt)
    if (held.brokenT >= RETURN) return beginAutoplay(held)
    return decay(held, dt)
  }
  if (game.phase === 'waiting') return game
  let next = game
  if (next.control === 'player' && next.presence === 'touch') {
    const idle = next.idle + dt
    if (idle >= TOUCH_IDLE) return handBack(next)
    next = { ...next, idle }
  }
  if (next.control === 'auto') next = autoCatch(next)
  next = advanceRex(next, dt)
  if (next.control === 'auto') next = autoCatch(next)
  next = advanceBoxes(next, dt)
  if (next.phase === 'broken') return decay(next, dt)
  next = advanceSpawn(next, dt)
  if (next.control === 'auto') next = autoCatch(next)
  return decay(settle(next), dt)
}

export function step(game: Game, dt: number): Game {
  if (!Number.isFinite(dt) || dt < 0) throw new Error(`dt must be >= 0, got ${dt}`)
  if (dt === 0) return game
  let next = game
  let left = dt
  const slice = 1 / 30
  while (left > 1e-8) {
    const h = Math.min(slice, left)
    next = stepOnce(next, h)
    left -= h
  }
  return next
}
