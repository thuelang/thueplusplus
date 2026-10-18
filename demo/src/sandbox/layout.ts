/** Shared scene geometry. Units are the hero SVG viewBox. */

export const VIEW_W = 1440
export const VIEW_H = 420
/** Lever height. Boxes travel lower, through the tunnel opening. */
export const BELT_TOP = 292
export const SCALE = 2.5
/**
 * One thin ground line. Rex's feet stand on it, fully above it.
 * It sits just under the traced machine.
 */
export const GROUND = 356

/**
 * Left inset of the machine, in view units.
 * At 768px wide this is 38px of screen margin, and at 1440 it is 72px,
 * so the machine and the score clear the viewport edge.
 */
export const SCENE_INSET = 72

/** A quiet tally in the corner. It does not compete with the headline. */
export const SCORE_X = SCENE_INSET + 22
export const SCORE_LABEL_Y = 18
export const SCORE_LABEL_SIZE = 11
export const SCORE_NUMBER_Y = 64
export const SCORE_NUMBER_SIZE = 20
const SCORE_CAP = 0.34

export function scoreNumberCenterY(): number {
  return SCORE_NUMBER_Y - SCORE_NUMBER_SIZE * SCORE_CAP
}

/** Baseline plus a little room for the label's descenders. */
export function scoreLabelBottom(): number {
  return SCORE_LABEL_Y + 4
}

/** Top of the digits after the jump scale, around the number's visual center. */
export function scoreNumberTop(scale: number): number {
  if (!Number.isFinite(scale) || scale <= 0) throw new Error(`scale must be > 0, got ${scale}`)
  return scoreNumberCenterY() - SCORE_NUMBER_SIZE * SCORE_CAP * scale
}

/** Flash circle radius. It stays under the label at this scale. */
export function scoreFlashRadius(scale: number, flash: number): number {
  if (!Number.isFinite(flash) || flash < 0 || flash > 1) throw new Error(`flash must be from 0 to 1, got ${flash}`)
  if (flash === 0) return 0
  const room = scoreNumberCenterY() - scoreLabelBottom() - 8
  if (room <= 4) throw new Error(`score label has no room under it, got ${room}`)
  const around = SCORE_NUMBER_SIZE * SCORE_CAP * scale + 10
  return Math.min(around, room)
}

/** Rex root (point between the feet) at rest, and where he stands to pull. He stands just right of the machine. */
export const REX_HOME = 430
export const REX_LEVER = 510

export const LEVER_PIVOT = { x: REX_LEVER - 52, y: GROUND - 46 }
/**
 * Hint baseline, to the right of Rex's hat and level with the lever knob.
 * The longer "pull the lever" string stays left of the title column.
 */
export const HINT_X = REX_LEVER + 24 * SCALE + 18
export const HINT_Y = LEVER_PIVOT.y - 44
/** Speech sits in the open sky above Rex, right of the machine and left of the title. */
export const SPEECH_X = 470
export const SPEECH_Y = -6
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
/** Drift band in front of the machine. Boxes do not ride the ground line. */
export const DRIFT_TOP = 150
export const DRIFT_BOTTOM = 300
const DRIFT_BOB = 8
const DRIFT_TURN = 12

export interface BoxPlace {
  x: number
  y: number
  rot: number
}

/**
 * A box starts just past the right edge and drifts to the machine.
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
  const y = DRIFT_TOP + (DRIFT_BOTTOM - DRIFT_TOP) * lane + Math.sin(p * 6 + phase) * DRIFT_BOB
  const rot = Math.sin(p * 4 + phase) * DRIFT_TURN
  return { x, y, rot }
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
