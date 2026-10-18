import helloSource from '../../../examples/hello/hello.thue?raw'
import { ease } from '@/rex/motion'

export const PARALLAX_RATE = 0.35
export const LHS_CAPTION = 'lhs means left hand side'
export const RHS_CAPTION = 'rhs means right hand side'
export const PORTABLE_OUTPUT = 'Hello, World!'
export const PORTABLE_CARD = 'hello.thue'

export const SANDBOX_RULES = [
  '^start$ ::> stdout hello\\n',
  '^$ ::> socket x\\n',
] as const

export const SANDBOX_OUT_TEXT = 'hello'
export const SANDBOX_ERROR = 'ERR:resource:socket'
export const SANDBOX_INSIDE_X = 250
export const SANDBOX_WALL_X = 458
export const SANDBOX_OUTSIDE_X = 560

export const ORIGIN = {
  ruleX: 210,
  ruleY: 118,
  beforeY: 170,
  afterY: 208,
  charW: 13.2,
} as const

/** Card in Rex's local units. The hand sits inside the inner bottom corner. */
export const HELD_CARD = { w: 58, h: 32 } as const

export const TRY_LETTERS = ['T', 'R', 'Y'] as const
export const POP_RISE = 78

function assertReduced(reduced: boolean): void {
  if (typeof reduced !== 'boolean') throw new Error('reduced must be a boolean')
}

function assertTime(t: number): void {
  if (!Number.isFinite(t)) throw new Error(`time must be finite, got ${t}`)
}

/** 0 before `start`, 1 at and after `end`. The middle is `ease('inOut')`. */
export function span(phase: number, start: number, end: number): number {
  if (!Number.isFinite(phase)) throw new Error(`phase must be finite, got ${phase}`)
  if (!(end > start)) throw new Error(`span end ${end} must be after ${start}`)
  if (phase <= start) return 0
  if (phase >= end) return 1
  return ease('inOut', (phase - start) / (end - start))
}

export function lerp(from: number, to: number, amount: number): number {
  if (!Number.isFinite(from) || !Number.isFinite(to) || !Number.isFinite(amount)) {
    throw new Error(`lerp needs finite numbers, got ${from}, ${to}, ${amount}`)
  }
  return from + (to - from) * amount
}

export function phaseOf(t: number, period: number): number {
  assertTime(t)
  if (!(period > 0)) throw new Error(`period must be > 0, got ${period}`)
  return ((t % period) + period) % period / period
}

export function parallaxShift(trackTop: number, reduced: boolean): number {
  assertReduced(reduced)
  if (!Number.isFinite(trackTop)) throw new Error(`track top must be finite, got ${trackTop}`)
  if (reduced) return 0
  return -trackTop * PARALLAX_RATE
}

function helloRuleLines(source: string): readonly string[] {
  const lines = source.split('\n')
  const sep = lines.findIndex(line => line.trim() === '::=')
  if (sep < 1) throw new Error('hello.thue has no rule separator')
  const rules = lines.slice(0, sep).filter(line => line.trim().length > 0)
  if (rules.length !== 3) throw new Error(`smallest scene expects 3 rules in hello.thue, got ${rules.length}`)
  return rules
}

export const helloRules = helloRuleLines(helloSource)

if (helloRules[0] !== '^START$ ::= hello\\ndone') throw new Error(`unrecognized hello rule ${helloRules[0]}`)
if (helloRules[1] !== 'hello ::> stdout Hello, World!\\n') throw new Error(`unrecognized hello rule ${helloRules[1]}`)
if (helloRules[2] !== 'done ::- 0') throw new Error(`unrecognized hello rule ${helloRules[2]}`)
if (!helloSource.includes(`${PORTABLE_OUTPUT}\\n`)) throw new Error('hello.thue does not write Hello, World!')

export interface HeldCard {
  x: number
  y: number
  w: number
  h: number
}

/** Places a card so this hand pinches its inner bottom corner. */
export function heldCard(handX: number, handY: number, side: 'left' | 'right'): HeldCard {
  if (!Number.isFinite(handX) || !Number.isFinite(handY)) {
    throw new Error(`hand must be finite, got ${handX}, ${handY}`)
  }
  if (side !== 'left' && side !== 'right') throw new Error(`card side must be left or right, got ${String(side)}`)
  const x = side === 'left' ? handX - (HELD_CARD.w - 14) : handX - 14
  const y = handY - (HELD_CARD.h - 10)
  return { x, y, w: HELD_CARD.w, h: HELD_CARD.h }
}

export interface OriginFrame {
  mark: number
  swap: number
  showBefore: boolean
  showAfter: boolean
}

export function originFrame(t: number, reduced: boolean): OriginFrame {
  assertReduced(reduced)
  assertTime(t)
  if (reduced) return { mark: 1, swap: 1, showBefore: true, showAfter: true }
  const phase = phaseOf(t, 6)
  return {
    mark: span(phase, 0.36, 0.5),
    swap: span(phase, 0.56, 0.74),
    showBefore: phase >= 0.34,
    showAfter: phase >= 0.56,
  }
}

export interface SmallestFrame {
  step: 0 | 1 | 2
  mark: number
  swap: number
  lines: readonly string[]
  matchLine: number
  matchText: string
  result: readonly string[]
  stdout: string
  exit: boolean
}

const SMALLEST_PERIOD = 7.5

export function smallestFrame(t: number, reduced: boolean): SmallestFrame {
  assertReduced(reduced)
  assertTime(t)
  if (reduced) {
    return {
      step: 0,
      mark: 1,
      swap: 1,
      lines: ['START'],
      matchLine: 0,
      matchText: 'START',
      result: ['hello', 'done'],
      stdout: '',
      exit: false,
    }
  }
  const scaled = phaseOf(t, SMALLEST_PERIOD) * 3
  const step = Math.min(2, Math.floor(scaled)) as 0 | 1 | 2
  const local = scaled - step
  const mark = span(local, 0.06, 0.34)
  const swap = span(local, 0.42, 0.68)
  const applied = swap >= 1
  if (step === 0) {
    return applied
      ? { step, mark: 0, swap, lines: ['hello', 'done'], matchLine: -1, matchText: '', result: [], stdout: '', exit: false }
      : { step, mark, swap, lines: ['START'], matchLine: 0, matchText: 'START', result: [], stdout: '', exit: false }
  }
  if (step === 1) {
    return applied
      ? { step, mark: 0, swap, lines: ['done'], matchLine: -1, matchText: '', result: [], stdout: PORTABLE_OUTPUT, exit: false }
      : { step, mark, swap, lines: ['hello', 'done'], matchLine: 0, matchText: 'hello', result: [], stdout: '', exit: false }
  }
  return {
    step,
    mark: applied ? 0 : mark,
    swap,
    lines: ['done'],
    matchLine: applied ? -1 : 0,
    matchText: applied ? '' : 'done',
    result: [],
    stdout: PORTABLE_OUTPUT,
    exit: applied,
  }
}

export interface SandboxFrame {
  stdout: number
  out: number
  outX: number
  socket: number
  tokenX: number
  tokenShow: boolean
  error: number
}

const SANDBOX_PERIOD = 6.4

export function sandboxFrame(t: number, reduced: boolean): SandboxFrame {
  assertReduced(reduced)
  assertTime(t)
  if (reduced) {
    return {
      stdout: 1,
      out: 1,
      outX: SANDBOX_OUTSIDE_X,
      socket: 1,
      tokenX: SANDBOX_INSIDE_X,
      tokenShow: false,
      error: 1,
    }
  }
  const phase = phaseOf(t, SANDBOX_PERIOD)
  const out = span(phase, 0.18, 0.4)
  const approach = span(phase, 0.58, 0.7)
  const retreat = span(phase, 0.72, 0.86)
  const tokenX = approach < 1 && retreat === 0
    ? lerp(SANDBOX_INSIDE_X, SANDBOX_WALL_X, approach)
    : lerp(SANDBOX_WALL_X, SANDBOX_INSIDE_X, retreat)
  return {
    stdout: span(phase, 0.06, 0.16),
    out,
    outX: lerp(SANDBOX_INSIDE_X, SANDBOX_OUTSIDE_X, out),
    socket: span(phase, 0.48, 0.58),
    tokenX,
    tokenShow: phase >= 0.56 && phase < 0.9,
    error: span(phase, 0.86, 0.96),
  }
}

export interface PortableFrame {
  index: number
  travel: number
  settled: boolean
}

export function portableFrame(t: number, reduced: boolean, count: number): PortableFrame {
  assertReduced(reduced)
  assertTime(t)
  if (!Number.isInteger(count) || count < 1) throw new Error(`portable scene needs at least one host, got ${count}`)
  if (reduced) return { index: 0, travel: 1, settled: true }
  const scaled = phaseOf(t, 1.1 * count) * count
  const index = Math.min(count - 1, Math.floor(scaled))
  const local = scaled - index
  return { index, travel: span(local, 0.08, 0.55), settled: false }
}

export function hostSlotY(index: number, count: number): number {
  if (!Number.isInteger(count) || count < 1) throw new Error(`host count must be >= 1, got ${count}`)
  if (!Number.isInteger(index) || index < 0 || index >= count) throw new Error(`host index ${index} is outside ${count}`)
  if (count === 1) return 140
  return 34 + (index * (252 - 34)) / (count - 1)
}

export function portableOutputVisible(hostIndex: number, frame: PortableFrame): boolean {
  if (!Number.isInteger(hostIndex) || hostIndex < 0) throw new Error(`host index ${hostIndex} is not a row`)
  if (frame.settled) return true
  if (hostIndex < frame.index) return true
  return hostIndex === frame.index && frame.travel >= 1
}

export function cardX(travel: number): number {
  if (!Number.isFinite(travel)) throw new Error(`travel must be finite, got ${travel}`)
  return lerp(12, 40, travel)
}

export interface PopLetter {
  char: string
  dy: number
  opacity: number
  flip: number
}

export interface SmashFrame {
  squash: number
  lift: number
  letters: readonly PopLetter[]
}

const SMASH_PERIOD = 4

function letterPop(phase: number, index: number): PopLetter {
  const char = TRY_LETTERS[index]
  if (char === undefined) throw new Error(`letter ${index} is not on the keyboard`)
  const start = 0.14 + index * 0.08
  const end = start + 0.3
  if (phase < start || phase >= end) return { char, dy: 0, opacity: 0, flip: 1 }
  const life = (phase - start) / (end - start)
  const rise = ease('outBack', life)
  const fadeIn = life < 0.22 ? ease('out', life / 0.22) : 1
  const fadeOut = life > 0.68 ? 1 - ease('in', (life - 0.68) / 0.32) : 1
  return {
    char,
    dy: -rise * POP_RISE,
    opacity: Math.min(fadeIn, fadeOut),
    flip: Math.abs(Math.cos(life * Math.PI * 2)),
  }
}

/** Rex hits the keyboard from below. Letters fade in, flip, bounce up, and fade out. */
export function smashFrame(t: number, reduced: boolean): SmashFrame {
  assertReduced(reduced)
  assertTime(t)
  if (reduced) {
    return {
      squash: 1,
      lift: 0,
      letters: TRY_LETTERS.map(char => ({ char, dy: 0, opacity: 1, flip: 1 })),
    }
  }
  const phase = phaseOf(t, SMASH_PERIOD)
  const down = span(phase, 0.06, 0.14)
  const up = span(phase, 0.14, 0.24)
  const liftUp = span(phase, 0.14, 0.28)
  const liftBack = span(phase, 0.28, 0.42)
  let squash = 1
  if (phase >= 0.06 && phase < 0.14) squash = lerp(1, 0.7, down)
  else if (phase >= 0.14 && phase < 0.24) squash = lerp(0.7, 1, up)
  let lift = 0
  if (phase >= 0.14 && phase < 0.28) lift = lerp(0, -16, liftUp)
  else if (phase >= 0.28 && phase < 0.42) lift = lerp(-16, 0, liftBack)
  return {
    squash,
    lift,
    letters: TRY_LETTERS.map((_, index) => letterPop(phase, index)),
  }
}
