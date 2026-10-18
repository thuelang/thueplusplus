import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { DOT_R } from '@/rex/motion'
import { beginAutoplay, beginPlayer, createGame, step } from './game'
import { framePose, settledSpring } from './motion'
import {
  BOX_REACH,
  GROUND,
  MACHINE_GROW,
  MACHINE_SQUEEZE,
  MACHINE_X,
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
  boxInFrame,
  boxPlace,
  inHit,
  leverKnob,
  machineScale,
  machineSqueeze,
} from './layout'

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
    expect(scene).toContain('boxInFrame')
    expect(scene).not.toContain('v-for="box in game.boxes"')
  })

  it('squeezes the machine down on a miss and recovers', () => {
    expect(machineSqueeze(0, false)).toBe(1)
    expect(machineSqueeze(1, false)).toBe(1)
    expect(machineSqueeze(0.55, true)).toBe(1)
    const deep = machineSqueeze(0.55, false)
    expect(deep).toBeCloseTo(1 - MACHINE_SQUEEZE, 5)
    expect(1 - deep).toBeGreaterThan(MACHINE_GROW)
    expect(machineSqueeze(0.2, false)).toBeGreaterThan(deep)
    expect(machineSqueeze(0.9, false)).toBeGreaterThan(deep)
    expect(() => machineSqueeze(1.2, false)).toThrow(/miss/)
    expect(() => machineSqueeze(0, 'no' as unknown as boolean)).toThrow(/boolean/)
    const grown = machineScale(1)
    const width = grown
    const height = grown * deep
    expect(width).toBeGreaterThan(1)
    expect(height).toBeLessThan(1)
    const scene = readFileSync('src/components/SandboxScene.vue', 'utf8')
    expect(scene).toContain('scale(${scale} ${height})')
    expect(scene).toContain('translate(${MACHINE_X} ${GROUND})')
    expect(scene).toContain('data-squeeze')
  })

  it('machine grows while a box is in range', () => {
    expect(machineScale(0)).toBe(1)
    expect(machineScale(1)).toBeCloseTo(1 + MACHINE_GROW, 5)
    expect(machineScale(1)).toBeGreaterThan(1.04)
    expect(machineScale(1)).toBeLessThan(1.08)
    expect(() => machineScale(-0.1)).toThrow(/grown/)
    const scene = readFileSync('src/components/SandboxScene.vue', 'utf8')
    expect(scene).toContain('machineScale')
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
