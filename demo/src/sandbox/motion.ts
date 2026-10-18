/**
 * Poses for the home lever game: idle, the ready stance, the yank, the cheer,
 * the nervous glance, and the startle. Autoplay and the visitor share these
 * poses. The left hand is the lever knob in every one of them.
 * The belt and these poses are this scene. The shared Rex drawing is not.
 */

import {
  CHEER,
  GROUND,
  REX_HOME,
  REX_LEVER,
  SCALE,
  YANK,
  leverKnob,
} from './layout'
import {
  DOT_R,
  FOOT_DX,
  HAND_DX,
  HAND_DY,
  blinkAmount,
  blinkCurve,
  clamp,
  ease,
  finishPose,
  glanceAt,
  restLimbs,
  settledSpring,
  stepSpring,
  type Body,
  type Pose,
  type Spring,
} from '@/rex/motion'

export { blinkCurve, settledSpring, stepSpring }
export type { Pose, Spring }

export const POSE_MODES = ['idle', 'ready', 'yank', 'cheer', 'nervous', 'startled'] as const
export type PoseMode = (typeof POSE_MODES)[number]

export interface PoseInput {
  mode: PoseMode
  t: number
  clock: number
  lever: number
  reduced: boolean
  spring: Spring
  dt: number
}

function rest(rootX: number, rootY: number, squash: number): Body {
  return { rootX, rootY, travel: 0, squash, ...restLimbs() }
}

/** Left-hand center in Rex-local units, so the drawn hand sits on the knob. */
export function handOnLever(rootX: number, rootY: number, lever: number): { x: number, y: number } {
  const knob = leverKnob(lever)
  return { x: (knob.x - rootX) / SCALE, y: (knob.y - rootY) / SCALE }
}

export function framePose(input: PoseInput): Pose {
  const still = input.reduced
  let body = rest(REX_HOME, GROUND, 1)
  let target = { x: 0, y: 0 }
  let glance = { x: 0, y: 0 }
  let blink = 0
  let hat = 0

  if (input.mode === 'idle') {
    const breathe = still ? 0 : Math.sin(input.clock * 1.7) * 0.45
    body = rest(REX_HOME, GROUND + breathe * SCALE, 1 - Math.max(0, breathe) * 0.02)
    target = { x: 0, y: breathe }
    glance = still ? glance : glanceAt(input.clock)
    blink = still ? 0 : blinkAmount(input.clock)
  } else if (input.mode === 'ready') {
    const breathe = still ? 0 : Math.sin(input.clock * 1.7) * 0.35
    const rootX = REX_LEVER
    const rootY = GROUND + breathe * SCALE
    const hand = handOnLever(rootX, rootY, input.lever)
    body = {
      rootX,
      rootY,
      travel: 1,
      handLX: hand.x,
      handLY: hand.y,
      handRX: HAND_DX,
      handRY: HAND_DY + breathe,
      footLX: -FOOT_DX,
      footLY: -DOT_R,
      footRX: FOOT_DX,
      footRY: -DOT_R,
      squash: 1 - Math.max(0, breathe) * 0.02,
    }
    target = { x: (REX_LEVER - REX_HOME) / SCALE, y: breathe }
    glance = { x: still ? 0 : 3.2, y: still ? 0 : -0.4 }
    blink = still ? 0 : blinkAmount(input.clock)
  } else if (input.mode === 'yank') {
    const u = clamp(input.t / YANK, 0, 1)
    const reach = still ? 0 : ease('out', Math.min(1, u / 0.34))
    const crouch = still ? 0 : Math.sin(Math.min(1, u) * Math.PI) * 1.6
    const rootX = REX_LEVER + reach * 4
    const rootY = GROUND + crouch * SCALE
    const hand = handOnLever(rootX, rootY, input.lever)
    body = {
      rootX,
      rootY,
      travel: 1,
      handLX: hand.x,
      handLY: hand.y,
      handRX: HAND_DX,
      handRY: HAND_DY - reach * 6,
      footLX: -FOOT_DX,
      footLY: -DOT_R,
      footRX: FOOT_DX,
      footRY: -DOT_R,
      squash: 1 - (still ? 0 : Math.sin(Math.min(1, u) * Math.PI) * 0.06),
    }
    target = { x: (REX_LEVER - REX_HOME) / SCALE + reach, y: crouch }
    glance = { x: 3.6 * reach, y: -1.1 * reach }
    hat = reach * 7
  } else if (input.mode === 'cheer') {
    const u = clamp(input.t / CHEER, 0, 1)
    const hop = still ? 0 : Math.sin(Math.min(1, u / 0.42) * Math.PI)
    const rise = still ? 0 : ease('out', Math.min(1, u / 0.25))
    const rootX = REX_LEVER
    const rootY = GROUND - hop * 14
    const hand = handOnLever(rootX, rootY, input.lever)
    body = {
      rootX,
      rootY,
      travel: 1,
      handLX: hand.x,
      handLY: hand.y,
      handRX: HAND_DX + rise * 8,
      handRY: HAND_DY - 28 * rise,
      footLX: -FOOT_DX,
      footLY: -DOT_R,
      footRX: FOOT_DX,
      footRY: -DOT_R,
      squash: 1 - hop * 0.08,
    }
    target = { x: (REX_LEVER - REX_HOME) / SCALE, y: -hop * 4 }
    glance = { x: still ? 0 : 1.2, y: -3.4 * hop }
    hat = -8 * hop
  } else if (input.mode === 'nervous') {
    const wobble = still ? 0 : Math.sin(input.clock * 14) * 1.4
    const rootX = REX_LEVER + wobble
    const rootY = still ? GROUND : GROUND + 2
    const hand = handOnLever(rootX, rootY, input.lever)
    body = {
      rootX,
      rootY,
      travel: 1,
      handLX: hand.x,
      handLY: hand.y,
      handRX: HAND_DX + 2,
      handRY: HAND_DY - 4,
      footLX: -FOOT_DX - 1,
      footLY: -DOT_R,
      footRX: FOOT_DX + 1,
      footRY: -DOT_R,
      squash: 1.04,
    }
    target = { x: (REX_LEVER - REX_HOME) / SCALE + wobble / SCALE, y: still ? 0 : 1 }
    glance = { x: still ? 0 : 6.4, y: still ? 0 : 1.2 }
    hat = still ? 0 : -4
  } else if (input.mode === 'startled') {
    const pop = still ? 0 : ease('out', clamp(input.t / 0.18, 0, 1))
    const rootX = REX_LEVER - pop * 10
    const rootY = GROUND + pop * 3
    const hand = handOnLever(rootX, rootY, input.lever)
    body = {
      rootX,
      rootY,
      travel: 1,
      handLX: hand.x,
      handLY: hand.y,
      handRX: HAND_DX + pop * 8,
      handRY: HAND_DY - pop * 16,
      footLX: -FOOT_DX - pop * 2,
      footLY: -DOT_R,
      footRX: FOOT_DX + pop * 2,
      footRY: -DOT_R,
      squash: 1 - pop * 0.06,
    }
    target = { x: (REX_LEVER - REX_HOME) / SCALE - pop * 2, y: pop }
    glance = { x: 6 * pop, y: 1.5 * pop }
    hat = -8 * pop
  } else {
    const unknown: never = input.mode
    throw new Error(`unknown pose mode ${String(unknown)}`)
  }

  return finishPose(body, target, glance, blink, hat, input.spring, input.dt, still)
}
