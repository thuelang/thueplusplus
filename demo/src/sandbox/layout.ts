/** Shared scene geometry. Units are the hero SVG viewBox. */

export const VIEW_W = 1440
export const VIEW_H = 420
/** Lever height. Boxes travel lower, through the tunnel opening. */
export const BELT_TOP = 292
export const SCALE = 2.5
/**
 * Where Rex's feet and the machine base stand. Nothing is drawn there.
 */
export const GROUND = 356

/**
 * Left inset of the machine, in view units.
 * The hero column is centered in a 1320px frame, so a 72-unit inset sat
 * on that column's left edge at 1440. 120 units is 48px inside the column
 * there, and 64px from the viewport edge at 768.
 */
export const SCENE_INSET = 120

/** Rex root (point between the feet) at rest, and where he stands to pull. He stands just right of the machine. */
export const REX_HOME = 454
export const REX_LEVER = 534

export const LEVER_PIVOT = { x: REX_LEVER - 52, y: GROUND - 46 }
/** A miss sits beside the lever. */
export const MISS_X = LEVER_PIVOT.x + 36
export const MISS_Y = LEVER_PIVOT.y - 96
export const LEVER_LEN = 58
/** Degrees from straight up. Negative leans back toward Rex. */
export const LEVER_OFF = -52
export const LEVER_ON = 16

/** Boxes enter at the right edge and travel left into the tunnel. */
export const BELT_X0 = 0
export const BELT_ENTRANCE = VIEW_W
/** Center of a box at progress 1. Same place inside the tunnel as before the inset. */
export const BELT_MOUTH = SCENE_INSET + 182

/** Seconds for one yank, from rest through the pull and back. */
export const YANK = 0.24
/** Seconds Rex holds a milestone cheer. */
export const CHEER = 0.7
export const BREAK_BEAT = 0.85

/**
 * The traced machine, placed on the left. Scale maps the 345×500 sketch
 * into the view. The tunnel opening is the clear bay at the bottom right
 * of that sketch, and the grid window sits above it.
 */
export const MACHINE_X = SCENE_INSET
export const MACHINE_Y = -20
export const MACHINE_S = 0.8
/** Right lip of the tunnel, where boxes enter. */
export const TUNNEL_LIP = MACHINE_X + 345 * MACHINE_S
/** Left wall inside the tunnel. */
export const TUNNEL_DEEP = MACHINE_X + 209 * MACHINE_S
/** Top and bottom of the tunnel opening in view space. */
export const SCAN_TOP = MACHINE_Y + 393 * MACHINE_S
export const TUNNEL_BOTTOM = MACHINE_Y + 460 * MACHINE_S
/** Grid window above the tunnel. The scan line sweeps this pane. */
export const WINDOW_X = MACHINE_X + 189 * MACHINE_S
export const WINDOW_W = (297 - 189) * MACHINE_S
export const WINDOW_Y = MACHINE_Y + 300 * MACHINE_S
export const WINDOW_H = (385 - 300) * MACHINE_S
export interface Pt {
  x: number
  y: number
}

export function clamp(n: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, n))
}

export function leverDegrees(lever: number): number {
  return LEVER_OFF + (LEVER_ON - LEVER_OFF) * clamp(lever, 0, 1)
}

export function leverKnob(lever: number): Pt {
  const rad = (leverDegrees(lever) * Math.PI) / 180
  return {
    x: LEVER_PIVOT.x + Math.sin(rad) * LEVER_LEN,
    y: LEVER_PIVOT.y - Math.cos(rad) * LEVER_LEN,
  }
}

/** `progress` 0 is the right-hand entrance. 1 is inside the left tunnel. Values past 1 draw further in. */
export function beltPoint(progress: number): Pt {
  const p = clamp(progress, 0, 1.2)
  return { x: BELT_ENTRANCE + (BELT_MOUTH - BELT_ENTRANCE) * p, y: TUNNEL_BOTTOM }
}

/** A plain square. The reach covers the stroke and a gentle turn. */
export const BOX_SIZE = 36
export const BOX_HALF = BOX_SIZE / 2
export const BOX_REACH = 24
/**
 * Spawn band. Boxes appear past the right edge across most of the hero,
 * then curve toward the tunnel opening.
 */
export const SPAWN_MARGIN = 36
export const SPAWN_TOP = SPAWN_MARGIN
export const SPAWN_BOTTOM = VIEW_H - SPAWN_MARGIN
const DRIFT_BOB = 8
const DRIFT_TURN = 12
/** Center of the tunnel opening, where every path finishes. */
export const OPENING_X = (TUNNEL_DEEP + TUNNEL_LIP) / 2
export const OPENING_Y = (SCAN_TOP + TUNNEL_BOTTOM) / 2
/**
 * Right edge of the catch, a little in front of the tunnel lip.
 * The title covers the right half of the hero, so the catch stays in the
 * open gap where a box has already curved down to the opening.
 */
export const HIT_FRONT = TUNNEL_LIP + 200
/**
 * Boxes hold their spawn height across the right side, then curve into the
 * opening in the open gap left of the title. They are level with the opening
 * once they reach the catch, which still fits two boxes at once.
 */
const CURVE_FROM = 780
const HIT_PAD = 8

export interface BoxPlace {
  x: number
  y: number
  rot: number
}

function smoothstep(t: number): number {
  const u = clamp(t, 0, 1)
  return u * u * (3 - 2 * u)
}

/**
 * A box starts just past the right edge. `lane` spreads that height across
 * most of the hero. The path curves onto the tunnel opening, so a high or
 * low box is at the machine's height once it is in range. Bob and turn stay.
 * `lane` and `spin` are 0 to 1, chosen when it spawns.
 */
export function boxPlace(progress: number, lane: number, spin: number): BoxPlace {
  if (!Number.isFinite(progress)) throw new Error(`progress must be finite, got ${progress}`)
  if (!Number.isFinite(lane) || lane < 0 || lane > 1) throw new Error(`lane must be from 0 to 1, got ${lane}`)
  if (!Number.isFinite(spin) || spin < 0 || spin > 1) throw new Error(`spin must be from 0 to 1, got ${spin}`)
  const p = clamp(progress, 0, 1.2)
  const enter = VIEW_W + BOX_REACH
  const x = enter + (BELT_MOUTH - enter) * p
  const phase = spin * Math.PI * 2
  const spawnY = SPAWN_TOP + (SPAWN_BOTTOM - SPAWN_TOP) * lane
  const blend = smoothstep((CURVE_FROM - x) / (CURVE_FROM - HIT_FRONT))
  const bob = Math.sin(p * 6 + phase) * DRIFT_BOB * (1 - blend * 0.55)
  const y = spawnY + (OPENING_Y - spawnY) * blend + bob
  const rot = Math.sin(p * 4 + phase) * DRIFT_TURN
  return { x, y, rot }
}

/** The whole square is left of the machine. That is a miss for the visitor. */
export function pastMachine(place: BoxPlace): boolean {
  return place.x + BOX_HALF < MACHINE_X
}

/** General area around the opening. A box still in front of this is not a miss. */
export function inHit(place: BoxPlace): boolean {
  if (pastMachine(place)) return false
  if (place.x > HIT_FRONT) return false
  return place.y >= SCAN_TOP - HIT_PAD && place.y <= TUNNEL_BOTTOM + HIT_PAD
}

/** False while any part of the turned square would sit outside the view. */
export function boxInFrame(progress: number, lane = 0.5, spin = 0): boolean {
  const place = boxPlace(progress, lane, spin)
  return place.x - BOX_REACH >= 0
    && place.x + BOX_REACH <= VIEW_W
    && place.y - BOX_REACH >= 0
    && place.y + BOX_REACH <= VIEW_H
}

/** 1 at rest. A little over 1 while a box is in range. `grown` eases between them. */
export const MACHINE_GROW = 0.055

export function machineScale(grown: number): number {
  if (!Number.isFinite(grown) || grown < 0 || grown > 1) {
    throw new Error(`grown must be from 0 to 1, got ${grown}`)
  }
  return 1 + MACHINE_GROW * grown
}

/** Source-unit distance Rex walks between home and the lever. */
export function walkDistance(): number {
  return (REX_LEVER - REX_HOME) / SCALE
}

export interface Aperture {
  entrance: number
  exit: number
  top: number
  width: number
}

/** The tunnel opening is the capture window for this span. */
export function scannerAperture(span: number): Aperture {
  if (!Number.isFinite(span) || span <= 0 || span >= 1) {
    throw new Error(`span must be between 0 and 1, got ${span}`)
  }
  const entrance = beltPoint(1 - span).x
  const exit = beltPoint(1).x
  return { entrance, exit, top: SCAN_TOP, width: Math.abs(exit - entrance) }
}

/** Scan line across the tunnel. Reduced motion holds it on the box. */
export function scanLineX(clock: number, reduced: boolean, entrance: number, exit: number, boxX: number): number {
  if (!Number.isFinite(entrance) || !Number.isFinite(exit) || entrance === exit) {
    throw new Error(`scanner aperture must be wider than 0, got ${entrance} to ${exit}`)
  }
  if (!Number.isFinite(boxX)) throw new Error(`boxX must be finite, got ${boxX}`)
  if (typeof reduced !== 'boolean') throw new Error('reduced must be a boolean')
  const lo = Math.min(entrance, exit)
  const hi = Math.max(entrance, exit)
  if (reduced) return clamp(boxX, lo, hi)
  if (!Number.isFinite(clock) || clock < 0) throw new Error(`clock must be >= 0, got ${clock}`)
  const u = (clock % 1.4) / 1.4
  return entrance + (exit - entrance) * u
}
