import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { DOT_R } from '@/rex/motion'
import { beginAutoplay, beginPlayer, createGame, step } from './game'
import { framePose, handOnLever, settledSpring } from './motion'
import { contrastRatio } from './contrast'
import {
  BOX_REACH,
  GROUND,
  HEAD_SHAKE_END,
  HEAD_SHAKE_KEYS,
  MACHINE_BASE,
  MACHINE_GROW,
  MACHINE_X,
  SHAKE_ROT_TONE,
  SHAKE_X_TONE,
  TADA_KEYS,
  TADA_ROT_TONE,
  TADA_SCALE_TONE,
  OPENING_Y,
  REX_LEVER,
  SCALE,
  SCAN_TOP,
  SPAWN_BOTTOM,
  SPAWN_TOP,
  TUNNEL_BOTTOM,
  VIEW_H,
  VIEW_W,
  beltPoint,
  boxInColumn,
  boxInFrame,
  boxPlace,
  columnEdge,
  inHit,
  KNOB_R,
  LEVER_PIVOT,
  LEVER_STROKE,
  leverKnob,
  leverOutsideBase,
  machineHeadShake,
  machineScale,
  machineTada,
  machineTransform,
  switchSquare,
} from './layout'

function block(css: string, marker: string): string {
  const at = css.indexOf(marker)
  if (at < 0) throw new Error(`missing ${marker}`)
  const open = css.indexOf('{', at)
  const close = css.indexOf('}', open)
  return css.slice(open + 1, close)
}

function color(blockText: string, name: string): string {
  const match = blockText.match(new RegExp(`--${name}:\\s*(#[0-9a-fA-F]{6})`))
  if (!match) throw new Error(`missing --${name}`)
  return match[1]
}

describe('hero polish', () => {
  it('stands on no drawn ground line and shows the whole foot', () => {
    const footTop = GROUND + (-DOT_R - DOT_R) * SCALE
    const footBottom = GROUND
    expect(footBottom - footTop).toBeGreaterThan(24)
    expect(footTop).toBeLessThan(GROUND)
    expect(footBottom).toBe(GROUND)
    expect(footBottom).toBeLessThan(VIEW_H - 8)
    expect(beltPoint(0).x).toBeGreaterThan(beltPoint(1).x)
    const scene = readFileSync('src/components/SandboxScene.vue', 'utf8')
    expect(scene).not.toContain('data-test="floor"')
    expect(scene).not.toContain(`M0 \${GROUND}`)
    expect(scene).not.toContain('data-test="belt"')
    expect(scene).not.toContain('data-test="belt-surface"')
    expect(scene).not.toContain('rex-belt-clip')
    const css = readFileSync('src/style.css', 'utf8')
    const homeBorder = css.slice(css.indexOf('.home-screen.page-screen-bare + .page-details'))
    expect(homeBorder).toContain('border-top-width: 0')
  })

  it('draws no hint and no speech', () => {
    const scene = readFileSync('src/components/SandboxScene.vue', 'utf8')
    const layout = readFileSync('src/sandbox/layout.ts', 'utf8')
    for (const source of [scene, layout]) {
      expect(source).not.toContain('start-hint')
      expect(source).not.toContain('speech-bubble')
      expect(source).not.toContain('speechTail')
      expect(source).not.toContain('HINT_X')
      expect(source).not.toContain('SPEECH_')
      expect(source).not.toContain('sandboxin')
    }
    expect(scene).toContain('Rex at the machine.')
    expect(scene).toContain('data-test="scene-status"')
    expect(scene).toContain("status.value = 'Miss.'")
    expect(scene).not.toContain('>miss</text>')
    expect(scene).not.toContain('>yeah</text>')
    expect(scene).not.toContain('>not yet</text>')
    expect(scene).not.toContain('data-test="miss"')
    expect(scene).not.toContain('data-test="cheer"')
    expect(scene).not.toContain('data-test="not-yet"')
  })

  it('draws no curtains and no cage stack', () => {
    const scene = readFileSync('src/components/SandboxScene.vue', 'utf8')
    expect(scene).not.toContain('scanner-flap')
    expect(scene).not.toContain('data-test="cage"')
    expect(scene).not.toContain('data-test="jail"')
    expect(scene).toContain('data-test="machine"')
    expect(scene).not.toContain('data-test="x-ray-silhouette"')
    expect(scene).not.toContain('data-test="scan-line"')
  })

  it('has no score', () => {
    const scene = readFileSync('src/components/SandboxScene.vue', 'utf8')
    const page = readFileSync('src/pages/HomePage.vue', 'utf8')
    const game = readFileSync('src/sandbox/game.ts', 'utf8')
    expect(scene).not.toContain('data-test="score"')
    expect(scene).not.toContain('data-test="score-label"')
    expect(scene).not.toContain('data-test="score-float"')
    expect(scene).not.toContain('data-test="best"')
    expect(scene).not.toContain('rex-sandbox-best')
    expect(game).not.toContain('localStorage')
    expect(game).not.toContain('scoreJump')
    expect(page).not.toContain('your-turn')
    expect(page).not.toContain('Your turn')
    expect(page).toContain('data-test="hero-install"')
    expect(scene).not.toContain('Your turn to take over')
  })

  it('keeps the machine inside the frame', () => {
    for (const width of [1440, 1024, 768]) {
      expect(MACHINE_X * width / VIEW_W).toBeGreaterThanOrEqual(32)
    }
    expect(MACHINE_X * 390 / VIEW_W).toBeGreaterThanOrEqual(8)
    const heroLeft = (1440 - 1320) / 2
    expect(MACHINE_X).toBeGreaterThanOrEqual(heroLeft + 48)
    expect(boxInFrame(0)).toBe(false)
    expect(boxInFrame(0.05)).toBe(true)
    expect(boxInFrame(1)).toBe(true)
    expect(boxInFrame(1.2)).toBe(true)
    expect(() => boxInFrame(Number.NaN)).toThrow(/finite/)
    const scene = readFileSync('src/components/SandboxScene.vue', 'utf8')
    expect(scene).toContain('drawnBoxes')
    expect(scene).toContain('boxInColumn')
    expect(scene).not.toContain('boxInFrame')
    expect(scene).not.toContain('v-for="box in game.boxes"')
  })

  it('hides a box past the page column at 1440', () => {
    expect(columnEdge(1440)).toBeLessThan(VIEW_W)
    expect(columnEdge(1440)).toBeCloseTo(1380, 5)
    expect(boxInFrame(0.05)).toBe(true)
    expect(boxInColumn(0.05, 0.5, 0, 1440)).toBe(false)
    expect(boxInColumn(0.2, 0.5, 0, 1440)).toBe(true)
    expect(boxInColumn(0.05, 0.5, 0, 1024)).toBe(boxInFrame(0.05))
    expect(boxInColumn(0.05, 0.5, 0, 0)).toBe(boxInFrame(0.05))
  })

  it('samples the headShake keyframes', () => {
    expect(machineHeadShake(1, false)).toEqual({ x: 0, rot: 0 })
    expect(machineHeadShake(0, false)).toEqual({ x: 0, rot: 0 })
    expect(machineHeadShake(0.5, true)).toEqual({ x: 0, rot: 0 })
    const peaks: number[] = []
    for (const key of HEAD_SHAKE_KEYS) {
      const pose = machineHeadShake(1 - key.t / HEAD_SHAKE_END, false)
      expect(pose.x).toBeCloseTo(key.x * SHAKE_X_TONE, 5)
      expect(pose.rot).toBeCloseTo(key.rot * SHAKE_ROT_TONE, 5)
      if (key.x !== 0) peaks.push(Math.abs(pose.x))
    }
    expect(peaks).toEqual([...peaks].sort((a, b) => b - a))
    expect(peaks[0]).toBeGreaterThan(peaks[peaks.length - 1])
    const between = machineHeadShake(1 - (0.065 * 0.25) / HEAD_SHAKE_END, false)
    const linearQuarter = HEAD_SHAKE_KEYS[1].x * SHAKE_X_TONE * 0.25
    expect(Math.abs(between.x)).toBeLessThan(Math.abs(linearQuarter) * 0.5)
    expect(() => machineHeadShake(1.2, false)).toThrow(/miss/)
    expect(() => machineHeadShake(0, 'no' as unknown as boolean)).toThrow(/boolean/)
  })

  it('samples the tada keyframes', () => {
    expect(machineTada(0, false)).toEqual({ scale: 1, rot: 0 })
    expect(machineTada(1, false)).toEqual({ scale: 1, rot: 0 })
    expect(machineTada(0.3, true)).toEqual({ scale: 1, rot: 0 })
    for (const key of TADA_KEYS) {
      const pose = machineTada(key.t, false)
      expect(pose.scale).toBeCloseTo(1 + (key.scale - 1) * TADA_SCALE_TONE, 5)
      expect(pose.rot).toBeCloseTo(key.rot * TADA_ROT_TONE, 5)
    }
    const dip = 1 + (0.9 - 1) * TADA_SCALE_TONE
    const quarter = machineTada(0.025, false)
    const linear = 1 + 0.25 * (dip - 1)
    expect(quarter.scale).toBeGreaterThan(linear)
    expect(quarter.scale).toBeLessThan(1)
    const up = machineTada(0.3, false)
    expect(up.scale).toBeGreaterThan(1)
    expect(up.scale - 1).toBeLessThan(MACHINE_GROW)
    expect(machineTada(0.4, false).rot).toBeLessThan(0)
    expect(machineTada(0.5, false).rot).toBeGreaterThan(0)
    const text = machineTransform(1, 0, 0.3, false)
    expect(text).toContain(`scale(${machineScale(1)})`)
    expect(text).toContain(`scale(${up.scale})`)
    expect(text).toContain(`translate(${MACHINE_BASE.x} ${MACHINE_BASE.y})`)
    expect(text).toContain(`rotate(${up.rot})`)
    const still = machineTransform(0, 0, 1, false)
    expect(still).toContain('translate(0 0) rotate(0) scale(1)')
    expect(() => machineTada(-0.1, false)).toThrow(/tada/)
    expect(() => machineTada(0, 'no' as unknown as boolean)).toThrow(/boolean/)
    const scene = readFileSync('src/components/SandboxScene.vue', 'utf8')
    expect(scene).toContain('machineHeadShake')
    expect(scene).toContain('machineTada')
    expect(scene).toContain('data-shake-x')
    expect(scene).toContain('data-tada-scale')
    expect(scene).not.toContain('data-squeeze')
    expect(scene).not.toContain('machineSqueeze')
  })

  it('machine grows while a box is in range', () => {
    expect(machineScale(0)).toBe(1)
    expect(machineScale(1)).toBeCloseTo(1 + MACHINE_GROW, 5)
    expect(machineScale(1)).toBeGreaterThan(1.04)
    expect(machineScale(1)).toBeLessThan(1.08)
    expect(() => machineScale(-0.1)).toThrow(/grown/)
    const scene = readFileSync('src/components/SandboxScene.vue', 'utf8')
    expect(scene).toContain('placeMachine')
    expect(scene).toContain('data-grown')
    expect(scene).not.toContain('data-test="scan-line"')
  })

  it('draws plain squares that drift in from the right', () => {
    const spawned = boxPlace(0, 0.5, 0.2)
    expect(spawned.x - BOX_REACH).toBeGreaterThanOrEqual(VIEW_W)
    expect(boxPlace(1, 0.5, 0.2).x).toBeLessThan(spawned.x - 400)
    const turned = boxPlace(0.35, 0.4, 0.7)
    expect(Math.abs(turned.rot)).toBeGreaterThan(0)
    expect(Math.abs(turned.rot)).toBeLessThanOrEqual(12)
    const scene = readFileSync('src/components/SandboxScene.vue', 'utf8')
    expect(scene).not.toContain('data-test="x-ray"')
    expect(scene).toContain('width="36"')
    expect(scene).not.toContain('M-18 -18 H18')
  })

  it('puts the lever in the left hand', () => {
    const knob = leverKnob(0)
    expect(knob.x).toBeLessThan(REX_LEVER - 8)
    const ready = framePose({ mode: 'ready', t: 0, clock: 0, lever: 0, reduced: false, spring: settledSpring(), dt: 0 })
    const handX = ready.rootX + ready.handLX * SCALE
    const handY = ready.rootY + ready.handLY * SCALE
    expect(handX).toBeCloseTo(knob.x, 0)
    expect(handY).toBeCloseTo(knob.y, 0)
    expect(ready.handLX).toBeLessThan(0)
    expect(ready.handLX).toBeLessThan(ready.handRX)
    expect(handX).toBeGreaterThan(MACHINE_X + 80)
  })

  it('seamless takeover keeps Rex where he is', () => {
    let game = beginAutoplay(createGame({ seed: 3, reduced: false }))
    game = step(game, 0.3)
    expect(game.rex).not.toBe('idle')
    const taken = beginPlayer(game)
    expect(taken.control).toBe('player')
    expect(taken.rex).toBe(game.rex)
    expect(taken.rexT).toBe(game.rexT)
    expect(taken.lever).toBe(game.lever)
    expect(taken.boxes).toEqual(game.boxes)
    expect(taken.spawnIn).toBe(game.spawnIn)
  })

  it('converges on the opening', () => {
    const lanes = [0, 0.25, 0.5, 0.75, 1]
    const spins = [0, 0.35, 0.8]
    const spawns = lanes.map(lane => boxPlace(0, lane, 0.5))
    const heights = spawns.map(place => place.y)
    expect(Math.max(...heights) - Math.min(...heights)).toBeGreaterThan(VIEW_H * 0.7)
    expect(SPAWN_BOTTOM - SPAWN_TOP).toBeGreaterThan(VIEW_H * 0.7)
    for (const place of spawns) expect(place.x).toBeGreaterThan(VIEW_W)
    expect(Math.abs(boxPlace(0, 0, 0).y - OPENING_Y)).toBeGreaterThan(120)
    expect(Math.abs(boxPlace(0, 1, 0).y - OPENING_Y)).toBeGreaterThan(40)
    // Still spread out on the right, before the curve into the opening.
    const crossing = lanes.map(lane => boxPlace(0.3, lane, 0.2))
    expect(Math.max(...crossing.map(place => place.y)) - Math.min(...crossing.map(place => place.y))).toBeGreaterThan(VIEW_H * 0.55)
    expect(crossing.every(place => place.x > VIEW_W * 0.6)).toBe(true)
    const high = boxPlace(0.3, 0, 0)
    const settled = boxPlace(0.95, 0, 0)
    expect(Math.abs(high.y - OPENING_Y)).toBeGreaterThan(140)
    expect(Math.abs(settled.y - OPENING_Y)).toBeLessThan(20)
    expect(settled.y).toBeGreaterThan(high.y + 80)

    for (const lane of lanes) {
      for (const spin of spins) {
        let entered = false
        let spun = false
        let previousX = boxPlace(0, lane, spin).x
        for (let step = 1; step <= 120; step += 1) {
          const place = boxPlace(step / 100, lane, spin)
          expect(place.x).toBeLessThan(previousX)
          previousX = place.x
          if (Math.abs(place.rot) > 1) spun = true
          if (!entered && inHit(place)) {
            entered = true
            expect(place.y).toBeGreaterThanOrEqual(SCAN_TOP - 8)
            expect(place.y).toBeLessThanOrEqual(TUNNEL_BOTTOM + 8)
            expect(Math.abs(place.y - OPENING_Y)).toBeLessThan((TUNNEL_BOTTOM - SCAN_TOP) / 2)
          }
        }
        expect(entered).toBe(true)
        expect(spun).toBe(true)
      }
    }
  })

  it('the lever is a switch square on the pivot', () => {
    const square = switchSquare()
    expect(square.w).toBe(44)
    expect(square.h).toBe(22)
    expect(square.x + square.w / 2).toBe(LEVER_PIVOT.x)
    expect(square.y + square.h / 2).toBe(LEVER_PIVOT.y)
    expect(square.w).toBeGreaterThan(KNOB_R * 2)
    expect(square.h).toBeGreaterThan(LEVER_STROKE)
    expect(square.h).toBe(square.w / 2)
    const bottom = square.y + square.h
    for (const lever of [0, 1]) {
      const tip = leverKnob(lever)
      const dx = tip.x - LEVER_PIVOT.x
      const dy = tip.y - LEVER_PIVOT.y
      const len = Math.hypot(dx, dy)
      const dir = { x: dx / len, y: dy / len }
      const perp = { x: -dir.y, y: dir.x }
      for (const sign of [-1, 1]) {
        const corner = {
          x: LEVER_PIVOT.x + perp.x * (LEVER_STROKE / 2) * sign,
          y: LEVER_PIVOT.y + perp.y * (LEVER_STROKE / 2) * sign,
        }
        expect(corner.x).toBeGreaterThan(square.x + 1)
        expect(corner.x).toBeLessThan(square.x + square.w - 1)
        expect(corner.y).toBeGreaterThan(square.y + 1)
        expect(corner.y).toBeLessThan(bottom - 1)
      }
      const outside = leverOutsideBase(lever)
      expect(outside.length).toBeGreaterThan(0)
      for (const point of outside) {
        const along = (point.x - LEVER_PIVOT.x) * dir.x + (point.y - LEVER_PIVOT.y) * dir.y
        expect(along).toBeGreaterThan(0)
        expect(point.y).toBeLessThanOrEqual(bottom)
      }
    }
    const scene = readFileSync('src/components/SandboxScene.vue', 'utf8')
    const stick = scene.indexOf('data-test="lever-stick"')
    const knob = scene.indexOf('data-test="lever-knob"')
    const base = scene.indexOf('data-test="lever-base"')
    expect(stick).toBeGreaterThan(-1)
    expect(knob).toBeGreaterThan(stick)
    expect(base).toBeGreaterThan(knob)
    expect(scene.slice(knob, base)).toContain('</g>')
    expect(scene.slice(stick, base)).toContain('stroke="var(--ash)"')
    expect(scene.slice(stick, base)).toContain('stroke-linecap="butt"')
    expect(scene.slice(base, base + 280)).toContain(':width="base.w"')
    expect(scene.slice(base, base + 280)).toContain(':height="base.h"')
    expect(scene.slice(base, base + 280)).toContain('fill="var(--ash)"')
    expect(scene.slice(stick, base + 220)).not.toContain('var(--signal)')
    expect(scene).not.toContain('leverSwitchPath')
    expect(scene).not.toContain('stroke-linecap="round"')
    const figure = readFileSync('src/components/RexFigure.vue', 'utf8')
    expect(figure).toContain(':fill="markPaint"')
    expect(figure).not.toContain('var(--ash)')
    const rest = framePose({ mode: 'ready', t: 0, clock: 0, lever: 0, reduced: true, spring: settledSpring(), dt: 0 })
    const radius = DOT_R * SCALE
    const feet = [
      { x: rest.rootX + rest.footLX * SCALE, y: rest.rootY + rest.footLY * SCALE },
      { x: rest.rootX + rest.footRX * SCALE, y: rest.rootY + rest.footRY * SCALE },
    ]
    const front = feet.reduce((a, b) => (a.x < b.x ? a : b))
    const hits = (foot: { x: number, y: number }, plate: { x: number, y: number, w: number, h: number }) => {
      const nx = Math.min(plate.x + plate.w, Math.max(plate.x, foot.x))
      const ny = Math.min(plate.y + plate.h, Math.max(plate.y, foot.y))
      const dx = foot.x - nx
      const dy = foot.y - ny
      return dx * dx + dy * dy < radius * radius
    }
    const tall = { x: square.x, y: LEVER_PIVOT.y - square.w / 2, w: square.w, h: square.w }
    expect(hits(front, tall)).toBe(true)
    expect(feet.some(foot => hits(foot, square))).toBe(false)
    for (const lever of [0, 0.35, 1]) {
      const at = leverKnob(lever)
      const pose = framePose({ mode: 'ready', t: 0, clock: 0, lever, reduced: true, spring: settledSpring(), dt: 0 })
      const hand = handOnLever(pose.rootX, pose.rootY, lever)
      expect(pose.rootX + hand.x * SCALE).toBeCloseTo(at.x, 5)
      expect(pose.rootY + hand.y * SCALE).toBeCloseTo(at.y, 5)
      expect(pose.handLX).toBeCloseTo(hand.x, 5)
      expect(pose.handLY).toBeCloseTo(hand.y, 5)
    }
    const css = readFileSync('src/style.css', 'utf8')
    const themes = [block(css, ':root,'), block(css, 'html:not(.dark)')]
    for (const theme of themes) {
      expect(contrastRatio(color(theme, 'ash'), color(theme, 'void'))).toBeGreaterThanOrEqual(4.5)
    }
  })

  it('pauses animation frames while hidden', () => {
    const scene = readFileSync('src/components/SandboxScene.vue', 'utf8')
    const rex = readFileSync('src/rex/useRex.ts', 'utf8')
    for (const source of [scene, rex]) {
      expect(source).toContain('document.hidden')
      expect(source).toContain("addEventListener('visibilitychange'")
      const hidden = source.slice(source.indexOf('document.hidden'))
      expect(hidden).toContain('return')
    }
  })
})
