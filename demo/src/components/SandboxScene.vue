<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import Rex from './Rex.vue'
import {
  HIT_FRONT,
  LEVER_LEN,
  LEVER_PIVOT,
  MACHINE_X,
  OPENING_X,
  OPENING_Y,
  SCALE,
  SCAN_TOP,
  TUNNEL_BOTTOM,
  VIEW_H,
  VIEW_W,
  TADA_S,
  boxInFrame,
  boxPlace,
  leverDegrees,
  leverKnob,
  machineHeadShake,
  machineTada,
  machineTransform as placeMachine,
} from '@/sandbox/layout'
import { MACHINE_D } from '@/sandbox/machine'
import { framePose, settledSpring, type Pose, type Spring } from '@/sandbox/motion'
import {
  beginAutoplay,
  createGame,
  demoRuns,
  inZone,
  nearestBox,
  playerAct,
  setPresence,
  step,
  type Box,
  type Game,
  type Presence,
} from '@/sandbox/game'

const emit = defineEmits<{ break: [reduced: boolean], rebuilt: [] }>()

function motionReduced(): boolean {
  return typeof window !== 'undefined'
    && typeof window.matchMedia === 'function'
    && window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

const reduced = ref(motionReduced())
const inView = ref(true)
const pageHidden = ref(false)
const sceneEl = ref<HTMLElement | null>(null)
const game = ref<Game>(beginAutoplay(createGame({
  seed: import.meta.env.MODE === 'test' ? 1 : freshSeed(),
  reduced: reduced.value,
})))
const clock = ref(0)
const spring = ref<Spring>(settledSpring())
const pose = ref<Pose>(restPose(false))
const status = ref('Rex is running the machine.')
let raf = 0
let last = 0
let observer: IntersectionObserver | undefined
let media: MediaQueryList | undefined
let onMedia: (() => void) | undefined

function restPose(isReduced: boolean): Pose {
  return framePose({ mode: 'idle', t: 0, clock: 0, lever: 0, reduced: isReduced, spring: settledSpring(), dt: 0 })
}

function freshSeed(): number {
  const buf = new Uint32Array(1)
  crypto.getRandomValues(buf)
  return buf[0] === 0 ? 1 : buf[0]
}

function note(): void {
  const current = game.value
  if (current.phase === 'broken') status.value = 'A box got through.'
  else if (current.control === 'auto') status.value = 'Rex is running the machine.'
  else if (current.miss > 0) status.value = 'Miss.'
  else status.value = 'Your turn.'
}

function aimPoint(): { x: number, y: number } | null {
  const box = nearestBox(game.value.boxes)
  if (!box) return null
  const place = boxPlace(box.progress, box.lane, box.spin)
  return { x: place.x, y: place.y }
}

note()
syncPose(0)

function syncPose(dt: number): void {
  const next = framePose({
    mode: game.value.rex,
    t: game.value.rexT,
    clock: clock.value,
    lever: game.value.lever,
    reduced: reduced.value,
    spring: spring.value,
    dt,
    aim: aimPoint(),
  })
  spring.value = next.spring
  pose.value = next
}

function commit(next: Game, dt: number): void {
  const before = game.value
  game.value = next
  syncPose(dt)
  tadaFresh = false
  if (!reduced.value && next.clears > before.clears) {
    tadaT.value = 0
    tadaFresh = true
  } else if (before.miss === 0 && next.miss > 0) {
    tadaT.value = 1
  }
  if (next.phase === 'broken' && before.phase !== 'broken') {
    emit('break', next.reduced)
    note()
  } else if (before.phase === 'broken' && next.phase !== 'broken') {
    emit('rebuilt')
    note()
  } else if (next.control !== before.control || next.miss !== before.miss) note()
}

function applyReduced(isReduced: boolean): void {
  reduced.value = isReduced
  game.value = { ...game.value, reduced: isReduced }
  syncPose(0)
}

const rexLabel = computed(() => (
  game.value.control === 'player' && game.value.phase === 'playing' ? 'Pull the lever.' : 'Rex.'
))
const leverLabel = computed(() => (
  game.value.control === 'player' && game.value.phase === 'playing' ? 'Pull the lever.' : 'Rex.'
))
const leverAngle = computed(() => leverDegrees(game.value.lever))
const inRange = computed(() => game.value.boxes.some(box => inZone(box.progress, box.lane, box.spin)))
const grown = ref(0)
const scannerTransform = computed(() => {
  if (reduced.value || game.value.jolt === 0) return 'translate(0 0)'
  const jolt = game.value.jolt
  const shakeX = Math.sin(clock.value * 48) * jolt * 8
  const shakeY = Math.cos(clock.value * 39) * jolt * 5
  const rot = Math.sin(clock.value * 54) * jolt * 2.5
  return `translate(${shakeX} ${shakeY}) rotate(${rot} ${OPENING_X} ${OPENING_Y})`
})

const rexBox = computed(() => pct(pose.value.rootX - 78, pose.value.rootY - 268, 160, 286))
const leverBox = computed(() => {
  const knob = leverKnob(game.value.lever)
  return {
    left: `${(knob.x / VIEW_W) * 100}%`,
    top: `${(knob.y / VIEW_H) * 100}%`,
    width: '64px',
    height: '72px',
    transform: 'translate(-50%, -70%)',
  }
})

function pct(x: number, y: number, w: number, h: number): Record<string, string> {
  return {
    left: `${(x / VIEW_W) * 100}%`,
    top: `${(y / VIEW_H) * 100}%`,
    width: `${(w / VIEW_W) * 100}%`,
    height: `${(h / VIEW_H) * 100}%`,
  }
}

const drawnBoxes = computed(() => game.value.boxes.filter(box => boxInFrame(box.progress, box.lane, box.spin)))
const tadaT = ref(1)
let tadaFresh = false
const shake = computed(() => machineHeadShake(game.value.miss, reduced.value))
const tada = computed(() => machineTada(tadaT.value, reduced.value))
const machineTransform = computed(() => placeMachine(grown.value, game.value.miss, tadaT.value, reduced.value))

function followReactions(dt: number): void {
  if (reduced.value || tadaFresh || tadaT.value >= 1) return
  tadaT.value = Math.min(1, tadaT.value + dt / TADA_S)
}

function easeGrown(dt: number): void {
  const target = inRange.value ? 1 : 0
  if (reduced.value) {
    grown.value = target
    return
  }
  const step = 1 - Math.exp(-8 * dt)
  grown.value += (target - grown.value) * step
}

function boxTransform(box: Box): string {
  const place = boxPlace(box.progress, box.lane, box.spin)
  return `translate(${place.x} ${place.y}) rotate(${place.rot})`
}

function presenceOf(event: Event): Presence {
  if (event instanceof PointerEvent && event.pointerType === 'touch') return 'touch'
  return 'pointer'
}

function notePresence(presence: Presence): void {
  const next = setPresence(game.value, presence)
  if (next !== game.value) commit(next, 0)
}

function act(): void {
  if (game.value.presence === 'away') notePresence('pointer')
  commit(playerAct(game.value), 0)
}

function onSceneClick(event: MouseEvent): void {
  const target = event.target
  if (target instanceof Element && target.closest('button')) return
  act()
}

function onButtonClick(event: MouseEvent): void {
  event.stopPropagation()
  act()
}

function onButtonKey(event: KeyboardEvent): void {
  if (event.key !== 'Enter' && event.key !== ' ') return
  if (event.repeat) return
  event.preventDefault()
  event.stopPropagation()
  notePresence('keys')
  act()
}

function onPointerEnter(event: PointerEvent): void {
  if (event.pointerType === 'touch') return
  notePresence('pointer')
}

function onPointerLeave(event: PointerEvent): void {
  if (event.pointerType === 'touch') return
  notePresence('away')
}

function onPointerDown(event: PointerEvent): void {
  notePresence(presenceOf(event))
}

function onHitPointerDown(event: PointerEvent): void {
  if (event.pointerType === 'mouse') event.preventDefault()
  notePresence(presenceOf(event))
}

function onFocusIn(): void {
  if (game.value.presence === 'pointer' || game.value.presence === 'touch') return
  notePresence('keys')
}

function onFocusOut(event: FocusEvent): void {
  const next = event.relatedTarget
  if (next instanceof Node && sceneEl.value?.contains(next)) return
  if (game.value.presence === 'pointer' || game.value.presence === 'touch') return
  notePresence('away')
}

function tick(now: number): void {
  if (!demoRuns(document.hidden, inView.value)) {
    raf = 0
    last = 0
    return
  }
  const dt = last === 0 ? 0 : Math.min(0.05, (now - last) / 1000)
  last = now
  if (dt > 0) {
    clock.value += reduced.value ? 0 : dt
    const miss = game.value.miss
    commit(step(game.value, dt), dt)
    easeGrown(dt)
    followReactions(dt)
    if (miss > 0 && game.value.miss === 0) note()
  }
  raf = requestAnimationFrame(tick)
}

function stopLoop(): void {
  cancelAnimationFrame(raf)
  raf = 0
  last = 0
}

function startLoop(): void {
  if (import.meta.env.MODE === 'test') return
  if (!demoRuns(document.hidden, inView.value)) return
  if (raf === 0) raf = requestAnimationFrame(tick)
}

function onVisibility(): void {
  pageHidden.value = document.hidden
  if (!demoRuns(document.hidden, inView.value)) {
    stopLoop()
    return
  }
  startLoop()
}

function advance(dt: number): void {
  if (!Number.isFinite(dt) || dt < 0) throw new Error(`dt must be >= 0, got ${dt}`)
  if (dt === 0) return
  clock.value += reduced.value ? 0 : dt
  const miss = game.value.miss
  commit(step(game.value, dt), dt)
  easeGrown(dt)
  followReactions(dt)
  if (miss > 0 && game.value.miss === 0) note()
}

onMounted(() => {
  media = window.matchMedia('(prefers-reduced-motion: reduce)')
  if (media.matches !== reduced.value) applyReduced(media.matches)
  onMedia = () => applyReduced(media?.matches ?? false)
  media.addEventListener('change', onMedia)
  document.addEventListener('visibilitychange', onVisibility)
  pageHidden.value = document.hidden
  if (typeof IntersectionObserver === 'function' && sceneEl.value) {
    observer = new IntersectionObserver(entries => {
      inView.value = entries.some(entry => entry.isIntersecting)
      if (!demoRuns(document.hidden, inView.value)) stopLoop()
      else startLoop()
    })
    observer.observe(sceneEl.value)
  }
  if (import.meta.env.MODE === 'test') return
  raf = requestAnimationFrame(tick)
})

onBeforeUnmount(() => {
  if (media && onMedia) media.removeEventListener('change', onMedia)
  document.removeEventListener('visibilitychange', onVisibility)
  observer?.disconnect()
  observer = undefined
  cancelAnimationFrame(raf)
})

defineExpose({ game, advance, act })
</script>

<template>
  <div
    ref="sceneEl"
    class="rex-scene text-bone relative h-full min-h-0 w-full"
    data-test="sandbox-scene"
    data-side="yes"
    data-pin
    role="group"
    :aria-label="`Rex at the machine. ${status}`"
    :data-presence="game.presence"
    @pointerenter="onPointerEnter"
    @pointerleave="onPointerLeave"
    @pointerdown="onPointerDown"
    @focusin="onFocusIn"
    @focusout="onFocusOut"
    @click="onSceneClick"
    :data-belt="game.beltOn ? 'on' : 'off'"
    :data-broken="game.phase === 'broken' ? 'yes' : 'no'"
    :data-reduced="reduced ? 'yes' : 'no'"
    :data-phase="game.phase"
    :data-control="game.control"
    :data-paused="pageHidden || !inView ? 'yes' : 'no'"
    :data-miss="game.miss > 0 ? 'yes' : 'no'"
  >
    <svg
      class="rex-svg absolute inset-0"
      :viewBox="`0 0 ${VIEW_W} ${VIEW_H}`"
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <g :transform="`translate(${pose.rootX} ${pose.rootY}) scale(${SCALE})`">
        <Rex :pose="pose" />
      </g>

      <g data-test="lever" :data-on="game.lever >= 0.5 ? 'yes' : 'no'">
        <g :transform="`rotate(${leverAngle} ${LEVER_PIVOT.x} ${LEVER_PIVOT.y})`">
          <line :x1="LEVER_PIVOT.x" :y1="LEVER_PIVOT.y" :x2="LEVER_PIVOT.x" :y2="LEVER_PIVOT.y - LEVER_LEN" stroke="currentColor" stroke-width="4" stroke-linecap="round" />
          <circle :cx="LEVER_PIVOT.x" :cy="LEVER_PIVOT.y - LEVER_LEN" r="9" fill="var(--signal)" stroke="currentColor" stroke-width="2" />
        </g>
      </g>
      <g
        v-for="box in drawnBoxes"
        :key="box.id"
        data-test="box"
        :data-progress="box.progress.toFixed(3)"
        :data-zone="inZone(box.progress, box.lane, box.spin) ? 'yes' : 'no'"
        :transform="boxTransform(box)"
      >
        <rect x="-18" y="-18" width="36" height="36" fill="var(--surface)" stroke="currentColor" stroke-width="2.4" />
      </g>

      <g data-test="scanner" data-test-machine="sketch" :transform="scannerTransform">
        <g
          data-test="machine"
          :data-grown="grown.toFixed(2)"
          :data-shake-x="shake.x.toFixed(3)"
          :data-shake-rot="shake.rot.toFixed(3)"
          :data-tada-scale="tada.scale.toFixed(3)"
          :data-tada-rot="tada.rot.toFixed(3)"
          :transform="machineTransform"
          fill="currentColor"
        >
          <g transform="translate(0 500) scale(0.1 -0.1)">
            <path :d="MACHINE_D" />
          </g>
        </g>
        <rect
          data-test="capture-zone"
          :x="MACHINE_X"
          :y="SCAN_TOP"
          :width="HIT_FRONT - MACHINE_X"
          :height="TUNNEL_BOTTOM - SCAN_TOP"
          fill="none"
        />
      </g>

      <g v-if="game.phase === 'broken'" data-test="scene-cracks" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round">
        <path d="M70 18 L128 96 L104 168 L176 250 L150 340" />
        <path d="M128 96 L210 132 L248 210" />
        <path d="M560 12 L520 90 L600 150 L548 240 L620 340" />
      </g>
    </svg>

    <button
      type="button"
      class="rex-hit"
      data-test="rex"
      :style="rexBox"
      :aria-label="rexLabel"
      aria-keyshortcuts="Space Enter"
      @pointerdown="onHitPointerDown"
      @click="onButtonClick"
      @keydown="onButtonKey"
    />
    <button
      type="button"
      class="rex-hit"
      data-test="lever-hit"
      :style="leverBox"
      :aria-label="leverLabel"
      aria-keyshortcuts="Space Enter"
      @pointerdown="onHitPointerDown"
      @click="onButtonClick"
      @keydown="onButtonKey"
    />
    <p class="sr-only" aria-live="polite" data-test="scene-status">{{ status }}</p>
  </div>
</template>
