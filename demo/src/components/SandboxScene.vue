<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import Rex from './Rex.vue'
import {
  BELT_TOP,
  GROUND,
  HINT_X,
  HINT_Y,
  SPEECH_X,
  SPEECH_Y,
  LEVER_LEN,
  LEVER_PIVOT,
  MACHINE_S,
  MACHINE_X,
  MACHINE_Y,
  SCALE,
  SCAN_TOP,
  SCORE_LABEL_SIZE,
  SCORE_LABEL_Y,
  SCORE_NUMBER_SIZE,
  SCORE_NUMBER_Y,
  SCORE_X,
  TUNNEL_BOTTOM,
  VIEW_H,
  VIEW_W,
  WINDOW_H,
  WINDOW_W,
  WINDOW_X,
  WINDOW_Y,
  beltPoint,
  scanLineX,
  scannerAperture,
  scoreFlashRadius,
  scoreNumberCenterY,
  leverDegrees,
  leverKnob,
} from '@/sandbox/layout'
import { MACHINE_D } from '@/sandbox/machine'
import { framePose, settledSpring, type Pose, type Spring } from '@/sandbox/motion'
import {
  beginAutoplay,
  createGame,
  demoRuns,
  difficulty,
  inZone,
  playerAct,
  scoreJump,
  setPresence,
  step,
  type Box,
  type Game,
  type Presence,
} from '@/sandbox/game'

const BEST_KEY = 'rex-sandbox-best'

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
  best: typeof localStorage === 'undefined' ? 0 : readBest(),
})))
const clock = ref(0)
const spring = ref<Spring>(settledSpring())
const pose = ref<Pose>(restPose(false))
const floatFrom = ref<{ x: number, y: number } | null>(null)
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

function readBest(): number {
  const raw = localStorage.getItem(BEST_KEY)
  if (raw === null) return 0
  if (!/^\d+$/.test(raw)) {
    localStorage.removeItem(BEST_KEY)
    return 0
  }
  const n = Number(raw)
  if (!Number.isSafeInteger(n) || n < 0) return 0
  return n
}

function note(): void {
  const current = game.value
  if (current.phase === 'broken') status.value = 'A box got through.'
  else if (current.control === 'auto') status.value = 'Rex is running the machine.'
  else if (current.miss > 0) status.value = `Miss. Score ${current.score}.`
  else status.value = `Score ${current.score}.`
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
  })
  spring.value = next.spring
  pose.value = next
}

function commit(next: Game, dt: number): void {
  const before = game.value
  if (next.score > before.score) floatFrom.value = beltPoint(0.92)
  game.value = next
  syncPose(dt)
  if (next.phase === 'broken' && before.phase !== 'broken') {
    if (before.control === 'player') {
      const stored = readBest()
      if (next.best > stored) localStorage.setItem(BEST_KEY, String(next.best))
    }
    emit('break', next.reduced)
    note()
  } else if (before.phase === 'broken' && next.phase !== 'broken') {
    emit('rebuilt')
    note()
  } else if (next.score !== before.score || next.control !== before.control || next.miss !== before.miss) note()
}

function applyReduced(isReduced: boolean): void {
  reduced.value = isReduced
  game.value = { ...game.value, reduced: isReduced }
  syncPose(0)
}

const diff = computed(() => difficulty(game.value.score, game.value.reduced))
const rexLabel = computed(() => (
  game.value.control === 'player' && game.value.phase === 'playing' ? 'Pull the lever.' : 'Rex.'
))
const leverLabel = computed(() => (
  game.value.control === 'player' && game.value.phase === 'playing' ? 'Pull the lever.' : 'Rex.'
))
const showHint = computed(() => game.value.presence !== 'away')
const leverHint = computed(() => (
  game.value.control === 'player' && game.value.phase === 'playing' ? 'pull the lever' : 'your turn'
))
const leverAngle = computed(() => leverDegrees(game.value.lever))
const jump = computed(() => scoreJump(
  game.value.pop,
  game.value.streak,
  Math.max(diff.value.beltRate, 0.01),
  reduced.value,
))
const numberCenterY = computed(() => scoreNumberCenterY())
const flashRadius = computed(() => scoreFlashRadius(jump.value.scale, reduced.value ? 0 : jump.value.flash))
const scoreTransform = computed(() => {
  const scale = jump.value.scale
  const y = numberCenterY.value
  return `translate(${SCORE_X} ${y}) scale(${scale}) translate(${-SCORE_X} ${-y})`
})
const floatPos = computed(() => {
  const from = floatFrom.value ?? beltPoint(1)
  const travel = jump.value.travel
  return {
    x: from.x + (SCORE_X - 80 - from.x) * travel,
    y: from.y - 36 + (numberCenterY.value - (from.y - 36)) * travel,
  }
})
const aperture = computed(() => scannerAperture(diff.value.span))
const zoneLeft = computed(() => Math.min(aperture.value.entrance, aperture.value.exit))
const scanned = computed(() => game.value.boxes
  .filter(box => inZone(box.progress, game.value.score, game.value.reduced))
  .sort((a, b) => b.progress - a.progress || a.id - b.id)[0])
const scanX = computed(() => {
  const lead = scanned.value
  if (!lead) return null
  return scanLineX(clock.value, reduced.value, WINDOW_X, WINDOW_X + WINDOW_W, beltPoint(lead.progress).x)
})
const scannerTransform = computed(() => {
  if (reduced.value || game.value.jolt === 0) return 'translate(0 0)'
  const jolt = game.value.jolt
  const shakeX = Math.sin(clock.value * 48) * jolt * 8
  const shakeY = Math.cos(clock.value * 39) * jolt * 5
  const rot = Math.sin(clock.value * 54) * jolt * 2.5
  const pivotX = (aperture.value.entrance + aperture.value.exit) / 2
  const pivotY = (SCAN_TOP + BELT_TOP) / 2
  return `translate(${shakeX} ${shakeY}) rotate(${rot} ${pivotX} ${pivotY})`
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

function boxTransform(box: Box): string {
  const point = beltPoint(box.progress)
  const hot = inZone(box.progress, game.value.score, game.value.reduced)
  const scale = hot ? 1.12 : 1
  return `translate(${point.x} ${point.y}) scale(${scale})`
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
  const before = game.value
  const hot = before.control === 'player'
    ? before.boxes
      .filter(box => inZone(box.progress, before.score, before.reduced))
      .sort((a, b) => b.progress - a.progress || a.id - b.id)[0]
    : undefined
  commit(playerAct(before), 0)
  if (hot && game.value.score === before.score + 1) floatFrom.value = beltPoint(hot.progress)
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
    :data-score="game.score"
    :data-miss="game.miss > 0 ? 'yes' : 'no'"
  >
    <svg
      class="rex-svg absolute inset-0"
      :viewBox="`0 0 ${VIEW_W} ${VIEW_H}`"
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <path data-test="floor" :d="`M0 ${GROUND} H${VIEW_W}`" stroke="currentColor" stroke-width="1.5" opacity="0.55" />

      <circle
        v-if="flashRadius > 0"
        data-test="score-flash"
        :cx="SCORE_X - 20"
        :cy="numberCenterY"
        :r="flashRadius"
        fill="var(--signal)"
        :opacity="jump.flash * 0.28"
      />
      <g
        opacity="0.78"
        data-test="score-jump"
        :data-scale="jump.scale.toFixed(2)"
        :data-flash="jump.flash.toFixed(2)"
        :transform="scoreTransform"
        fill="currentColor"
        font-family="JetBrains Mono, ui-monospace, monospace"
        text-anchor="start"
      >
        <text
          data-test="score"
          :x="SCORE_X"
          :y="SCORE_NUMBER_Y"
          :font-size="SCORE_NUMBER_SIZE"
          :fill="jump.flash > 0.2 ? 'var(--signal)' : 'currentColor'"
        >{{ game.score }}</text>
      </g>
      <g fill="currentColor" font-family="JetBrains Mono, ui-monospace, monospace" text-anchor="start" opacity="0.78">
        <text data-test="score-label" :x="SCORE_X" :y="SCORE_LABEL_Y" :font-size="SCORE_LABEL_SIZE">score</text>
        <text v-if="game.best > 0" data-test="best" :x="SCORE_X" :y="SCORE_NUMBER_Y + 16" font-size="11">best {{ game.best }}</text>
      </g>

      <g
        v-if="game.control === 'auto' && game.rex !== 'cheer'"
        data-test="speech"
        :transform="`translate(${SPEECH_X} ${SPEECH_Y})`"
      >
        <path
          data-test="speech-bubble"
          d="M0 18 C0 6 10 0 24 0 H188 C204 0 214 8 214 22 V58 C214 72 204 80 188 80 H46 L22 102 L28 80 H24 C10 80 0 74 0 62 Z"
          fill="var(--surface)"
          stroke="currentColor"
          stroke-width="2.4"
          stroke-linejoin="round"
        />
        <text
          data-test="speech-text"
          x="107"
          y="32"
          fill="currentColor"
          font-family="JetBrains Mono, ui-monospace, monospace"
          font-size="15"
          text-anchor="middle"
        >i guess we</text>
        <text
          x="107"
          y="54"
          fill="currentColor"
          font-family="JetBrains Mono, ui-monospace, monospace"
          font-size="15"
          text-anchor="middle"
        >sandboxin' now</text>
      </g>

      <g :transform="`translate(${pose.rootX} ${pose.rootY}) scale(${SCALE})`">
        <Rex :pose="pose" />
      </g>

      <g data-test="lever" :data-on="game.lever >= 0.5 ? 'yes' : 'no'">
        <g :transform="`rotate(${leverAngle} ${LEVER_PIVOT.x} ${LEVER_PIVOT.y})`">
          <line :x1="LEVER_PIVOT.x" :y1="LEVER_PIVOT.y" :x2="LEVER_PIVOT.x" :y2="LEVER_PIVOT.y - LEVER_LEN" stroke="currentColor" stroke-width="4" stroke-linecap="round" />
          <circle :cx="LEVER_PIVOT.x" :cy="LEVER_PIVOT.y - LEVER_LEN" r="9" fill="var(--signal)" stroke="currentColor" stroke-width="2" />
        </g>
      </g>

      <text
        v-if="showHint"
        data-test="start-hint"
        :x="HINT_X"
        :y="HINT_Y"
        text-anchor="start"
        fill="currentColor"
        font-family="JetBrains Mono, ui-monospace, monospace"
        font-size="12"
        opacity="0.55"
      >{{ leverHint }}</text>
      <text
        v-if="game.miss > 0"
        data-test="miss"
        :x="SCORE_X"
        :y="SCORE_NUMBER_Y + 52"
        fill="var(--signal)"
        font-family="JetBrains Mono, ui-monospace, monospace"
        font-size="18"
        text-anchor="end"
        :opacity="Math.min(1, game.miss + 0.25)"
      >miss</text>
      <text
        v-if="game.rex === 'cheer'"
        data-test="cheer"
        :x="pose.rootX"
        :y="pose.rootY - 278"
        fill="var(--signal)"
        font-family="JetBrains Mono, ui-monospace, monospace"
        font-size="20"
        text-anchor="middle"
      >yeah</text>

      <g
        v-for="box in game.boxes"
        :key="box.id"
        data-test="box"
        :data-progress="box.progress.toFixed(3)"
        :data-zone="inZone(box.progress, game.score, game.reduced) ? 'yes' : 'no'"
        :transform="boxTransform(box)"
      >
        <template v-if="inZone(box.progress, game.score, game.reduced)">
          <rect data-test="x-ray" x="-24" y="-42" width="48" height="46" rx="3" fill="var(--signal)" opacity="0.22" />
          <rect x="-18" y="-36" width="36" height="36" rx="2" fill="var(--signal)" opacity="0.42" stroke="var(--bone)" stroke-width="1.6" />
          <path data-test="x-ray-silhouette" d="M-18 -18 H18 M0 -36 V0" fill="none" stroke="var(--bone)" stroke-width="1.8" opacity="0.95" />
        </template>
        <template v-else>
          <rect x="-18" y="-36" width="36" height="36" rx="2" fill="var(--surface)" stroke="currentColor" stroke-width="2.4" />
          <path d="M-18 -18 H18 M0 -36 V0" stroke="currentColor" stroke-width="1.4" opacity="0.5" />
        </template>
      </g>

      <g data-test="scanner" data-test-machine="sketch" :data-scanning="scanned ? 'yes' : 'no'" :transform="scannerTransform">
        <g
          data-test="machine"
          :transform="`translate(${MACHINE_X} ${MACHINE_Y}) scale(${MACHINE_S})`"
          fill="currentColor"
        >
          <g transform="translate(0 500) scale(0.1 -0.1)">
            <path :d="MACHINE_D" />
          </g>
        </g>
        <rect
          data-test="capture-zone"
          :x="zoneLeft"
          :y="SCAN_TOP"
          :width="aperture.width"
          :height="TUNNEL_BOTTOM - SCAN_TOP"
          fill="none"
        />
      </g>

      <text
        v-if="game.pop > 0 && !reduced && floatFrom"
        data-test="score-float"
        :x="floatPos.x"
        :y="floatPos.y"
        fill="var(--signal)"
        font-family="JetBrains Mono, ui-monospace, monospace"
        font-size="22"
        text-anchor="middle"
        :opacity="Math.min(1, game.pop + 0.2)"
      >+1</text>

      <line
        v-if="scanX !== null"
        data-test="scan-line"
        :x1="scanX"
        :x2="scanX"
        :y1="WINDOW_Y + 4"
        :y2="WINDOW_Y + WINDOW_H - 4"
        stroke="var(--signal)"
        stroke-width="2.5"
        stroke-linecap="round"
        opacity="0.9"
      />
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
      @click="onButtonClick"
      @keydown="onButtonKey"
    />
    <p class="sr-only" aria-live="polite" data-test="scene-status">{{ status }}</p>
  </div>
</template>
