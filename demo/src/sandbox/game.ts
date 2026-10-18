/**
 * Lever-timing game for the home sandbox.
 *
 * Rex autoplays on load and clears a box when its center reaches the
 * middle of the machine, so the demo loops and the page does not break. A click on the game, or Space or Enter while
 * it is focused, hands him the lever. The visitor keeps that turn only while
 * the pointer stays over the game, the last touch is still recent, or the
 * game stays focused. Leaving, a short touch idle, or blur hands the same
 * run back. Boxes in flight and the belt speed stay. Only a break starts a
 * fresh run. A box breaks the page only once it has gone past the machine,
 * and only while the visitor still has the turn. One pull clears every box
 * in range. Each cleared box speeds the belt. The run is unwinnable: the
 * belt keeps speeding up until the visitor misses. Nothing displays a score
 * or stores a best. Autoplay clears the same way and never breaks the page,
 * at any speed. Caught boxes are removed. They are not kept, so they cannot
 * pile up. Nothing here reads the clock, the DOM, or storage.
 */

import {
  BELT_ENTRANCE,
  BELT_MOUTH,
  BREAK_BEAT,
  CHEER,
  OPENING_X,
  OPENING_Y,
  YANK,
  boxPlace,
  centerProgress,
  easeIn,
  easeOut,
  inHit,
  pastMachine,
  safeCatchProgress,
  zoneEntryProgress,
} from './layout'

export const GRACE = 0.8
/** A miss locks the lever for one pull. The return animation is this long too. */
export const MISS_COOLDOWN = YANK
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
 * Progress speed divides by this, so a box takes longer to arrive.
 * Gaps multiply by the same factor, so the boxes keep their spacing.
 */
export const TRACK = 2
const CROWD = 0.18
const REDUCED = 0.55
/** Fraction of a yank at which the lever is fully pulled. The return follows. */
export const PULL_AT = 0.3

/**
 * Where an autoplay clear should land, and how early the yank starts.
 * The lever reaches its pull at `PULL_AT` of the yank, so the windup
 * begins that long before the box arrives. If the belt is so fast that
 * the center would fall past the machine, the clear uses the latest
 * progress that is still inside the catch.
 */
export function planCatch(rate: number, reduced: boolean): { clearAt: number, lead: number, centered: boolean } {
  if (!Number.isFinite(rate) || rate <= 0) throw new Error(`rate must be > 0, got ${rate}`)
  if (typeof reduced !== 'boolean') throw new Error('reduced must be a boolean')
  const center = centerProgress()
  const safe = safeCatchProgress()
  const entry = zoneEntryProgress()
  const lead = reduced ? 0 : YANK * PULL_AT
  const latest = safe - rate / 30
  if (center <= latest) return { clearAt: center, lead, centered: true }
  const clearAt = Math.min(safe, Math.max(latest, entry))
  return { clearAt, lead, centered: false }
}

export interface Box {
  id: number
  /** 0 just past the right edge, 1 at the opening. Values past 1 continue through the machine. */
  progress: number
  /** 0 to 1. Picks the spawn height. */
  lane: number
  /** 0 to 1. Picks the gentle turn. */
  spin: number
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
  boxes: Box[]
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
  miss: number
  brokenT: number
  showRebuild: boolean
  reduced: boolean
  /** Boxes cleared this run. This is the belt's pace, not a score. */
  clears: number
  beltOn: boolean
  /** Rex runs the demo, or the player has the lever. */
  control: Control
  /** Pointer, touch, or keyboard focus. Away means Rex has the illustration. */
  presence: Presence
  /** Seconds since the player's last touch. Pointer and keys do not use it. */
  idle: number
  /**
   * Seconds of yank at which a started autoplay pull removes the boxes.
   * 0 means the yank is not waiting on a clear.
   */
  windup: number
}

export interface Difficulty {
  /** Progress per second. Climbs with clears and eases toward a top rate. A handoff keeps the count. A break starts over at zero. */
  beltRate: number
  /** Shortest and longest seconds between boxes. */
  gapLo: number
  gapHi: number
  /** Legacy capture fraction at this pace. The hit zone itself is geometric. */
  span: number
}

export interface GameOptions {
  seed: number
  reduced: boolean
}

export function difficulty(clears: number, reduced: boolean): Difficulty {
  if (!Number.isInteger(clears) || clears < 0) throw new Error(`clears must be an integer >= 0, got ${clears}`)
  if (typeof reduced !== 'boolean') throw new Error('reduced must be a boolean')
  const u = 1 - Math.exp(-clears / 6)
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
  if (u < 0.3) return easeOut(u / 0.3)
  if (u < 1) return 1 - easeIn((u - 0.3) / 0.7)
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
  return {
    phase: 'waiting',
    seed: options.seed,
    rng: options.seed,
    boxes: [],
    nextId: 1,
    spawnIn: 0,
    cooldown: 0,
    deny: 0,
    lever: 0,
    leverT: 0,
    rex: 'idle',
    rexT: 0,
    miss: 0,
    brokenT: 0,
    showRebuild: false,
    reduced: options.reduced,
    clears: 0,
    beltOn: false,
    control: 'auto',
    presence: 'away',
    idle: 0,
    windup: 0,
  }
}

function nextSeed(seed: number): number {
  return seed === 0xffffffff ? 1 : seed + 1
}

function arm(game: Game, control: Control): Game {
  const reduced = game.reduced
  return {
    ...createGame({ seed: nextSeed(game.seed), reduced }),
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

/** Rex starts the demo. A box that gets past him does not break the page. */
export function beginAutoplay(game: Game): Game {
  return arm(game, 'auto')
}

/**
 * The player takes the lever. Only the trigger source changes. Boxes in
 * flight and the belt speed stay. Pose, lever, and the pull already in
 * motion stay. A game that has not started arms a fresh run. A break is
 * the only reset.
 */
export function beginPlayer(game: Game): Game {
  if (game.phase !== 'playing' || game.rex === 'idle') return arm(game, 'player')
  return {
    ...game,
    control: 'player',
    idle: 0,
  }
}

/**
 * The pointer left, the touch went idle, or focus left the game.
 * A playing turn hands the same run back to autoplay. Boxes in flight and
 * the belt speed stay. A break, or a game that has not started, begins a
 * fresh run at the lever.
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

export function inZone(progress: number, lane: number, spin: number): boolean {
  return inHit(boxPlace(progress, lane, spin))
}

function zoned(box: Box): boolean {
  return inZone(box.progress, box.lane, box.spin)
}

function gone(box: Box): boolean {
  return pastMachine(boxPlace(box.progress, box.lane, box.spin))
}

/** Closest box to the tunnel opening, among boxes still in flight. */
export function nearestBox(boxes: readonly Box[]): Box | undefined {
  let closest: Box | undefined
  let closestD = Infinity
  for (const box of boxes) {
    const place = boxPlace(box.progress, box.lane, box.spin)
    const d = Math.hypot(place.x - OPENING_X, place.y - OPENING_Y)
    if (!closest || d < closestD - 1e-9 || (Math.abs(d - closestD) <= 1e-9 && box.id < closest.id)) {
      closest = box
      closestD = d
    }
  }
  return closest
}

function clearHits(game: Game, hits: readonly Box[]): Game {
  const ids = new Set(hits.map(box => box.id))
  return {
    ...game,
    boxes: game.boxes.filter(box => !ids.has(box.id)),
    clears: game.clears + hits.length,
    miss: 0,
    cooldown: 0,
    deny: 0,
    idle: 0,
    rex: 'yank',
    rexT: 0,
    lever: game.reduced ? 1 : 0,
    leverT: game.reduced ? 0.12 : 0,
    windup: 0,
  }
}

/**
 * The lever is already on its way. When it reaches the pull, every box
 * in range leaves together. The yank itself keeps going.
 */
function releaseCatch(game: Game): Game {
  const hits = game.boxes.filter(zoned)
  if (hits.length === 0) return { ...game, windup: 0 }
  const ids = new Set(hits.map(box => box.id))
  return {
    ...game,
    boxes: game.boxes.filter(box => !ids.has(box.id)),
    clears: game.clears + hits.length,
    windup: 0,
    miss: 0,
    cooldown: 0,
    deny: 0,
    idle: 0,
  }
}

function finishWindup(game: Game): Game {
  if (game.phase !== 'playing' || game.windup <= 0 || game.rex !== 'yank') return game
  if (game.rexT + 1e-9 < game.windup) return game
  return releaseCatch(game)
}

/**
 * Rex starts the yank early by the pull's lead, so the lever arrives as the
 * foremost box reaches the machine's center. Every box already in range
 * leaves on that one pull. A box that would leave the machine first is
 * caught at the latest progress that is still inside.
 */
function autoCatch(game: Game): Game {
  if (game.control !== 'auto' || game.phase !== 'playing') return game
  if (game.rex === 'yank' || game.rex === 'cheer' || game.cooldown > 0 || game.windup > 0) return game
  const { beltRate } = difficulty(game.clears, game.reduced)
  const plan = planCatch(beltRate, game.reduced)
  let leadBox: Box | undefined
  for (const box of game.boxes) {
    if (pastMachine(boxPlace(box.progress, box.lane, box.spin))) continue
    if (!leadBox || box.progress > leadBox.progress) leadBox = box
  }
  if (!leadBox) return game
  const timeTo = (plan.clearAt - leadBox.progress) / beltRate
  if (timeTo > plan.lead) return game
  if (plan.lead <= 0 || timeTo <= 0) {
    const hits = game.boxes.filter(zoned)
    if (!hits.some(box => box.id === leadBox.id)) return game
    return clearHits(game, hits)
  }
  const rexT = plan.lead - timeTo
  return {
    ...game,
    rex: 'yank',
    rexT,
    lever: leverCurve(rexT),
    leverT: 0,
    windup: plan.lead,
    idle: 0,
  }
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
  const hits = game.boxes.filter(zoned)
  if (hits.length === 0) {
    return {
      ...game,
      idle: 0,
      cooldown: MISS_COOLDOWN,
      deny: 0,
      miss: 1,
      rex: 'yank',
      rexT: 0,
      lever: game.reduced ? 1 : 0,
      leverT: 0,
    }
  }
  return clearHits(game, hits)
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
  const { beltRate } = difficulty(game.clears, game.reduced)
  const boxes = game.boxes.map(box => ({ ...box, progress: box.progress + beltRate * dt }))
  const escaped = boxes.some(gone)
  if (!escaped) return { ...game, boxes }
  // Past the machine. Autoplay lets it go. The visitor's turn breaks.
  if (game.control === 'auto') return { ...game, boxes: boxes.filter(box => !gone(box)) }
  return {
    ...game,
    phase: 'broken',
    beltOn: false,
    boxes,
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
  const diff = difficulty(game.clears, game.reduced)
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
  next = finishWindup(next)
  if (next.control === 'auto') next = autoCatch(next)
  next = advanceRex(next, dt)
  next = advanceBoxes(next, dt)
  if (next.phase === 'broken') return decay(next, dt)
  next = advanceSpawn(next, dt)
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
