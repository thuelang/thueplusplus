import helloSource from '../../../examples/hello/hello.thue?raw'
import { ease } from '@/rex/motion'

export const PARALLAX_RATE = 0.35
export const LHS_CAPTION = 'lhs means left hand side'
export const RHS_CAPTION = 'rhs means right hand side'
export const PORTABLE_OUTPUT = 'Hello, World!'
export const PORTABLE_CARD = 'hello.thue'

export const SANDBOX_RULES = [
  '^start$ ::> stdout in\\n',
  '^$ ::> socket x\\n',
] as const

export const ORIGIN = {
  ruleX: 210,
  ruleY: 118,
  beforeY: 170,
  afterY: 208,
  charW: 13.2,
  cardW: 64,
  cardH: 32,
} as const

const LHS_REST = { x: 8, y: 168 }
const RHS_REST = { x: 80, y: 176 }

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

const ruleA = ORIGIN.ruleX
const ruleO = ORIGIN.ruleX + 6 * ORIGIN.charW
const LHS_RULE = { x: ruleA - ORIGIN.cardW / 2, y: 68 }
const RHS_RULE = { x: ruleO - ORIGIN.cardW / 2, y: 68 }

export interface OriginFrame {
  lhsX: number
  lhsY: number
  rhsX: number
  rhsY: number
  mark: number
  swap: number
  showBefore: boolean
  showAfter: boolean
}

export function originFrame(t: number, reduced: boolean): OriginFrame {
  assertReduced(reduced)
  assertTime(t)
  if (reduced) {
    return {
      lhsX: LHS_RULE.x,
      lhsY: LHS_RULE.y,
      rhsX: RHS_RULE.x,
      rhsY: RHS_RULE.y,
      mark: 1,
      swap: 1,
      showBefore: true,
      showAfter: true,
    }
  }
  const phase = phaseOf(t, 6)
  const move = span(phase, 0.08, 0.3)
  return {
    lhsX: lerp(LHS_REST.x, LHS_RULE.x, move),
    lhsY: lerp(LHS_REST.y, LHS_RULE.y, move),
    rhsX: lerp(RHS_REST.x, RHS_RULE.x, move),
    rhsY: lerp(RHS_REST.y, RHS_RULE.y, move),
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
  out: number
  socket: number
}

export function sandboxFrame(t: number, reduced: boolean): SandboxFrame {
  assertReduced(reduced)
  assertTime(t)
  if (reduced) return { out: 1, socket: 1 }
  const phase = phaseOf(t, 5.5)
  return {
    out: span(phase, 0.12, 0.4),
    socket: span(phase, 0.52, 0.74),
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

export function keyboardX(t: number, reduced: boolean): number {
  assertReduced(reduced)
  assertTime(t)
  if (reduced) return 400
  return lerp(148, 400, span(phaseOf(t, 4), 0.1, 0.48))
}
