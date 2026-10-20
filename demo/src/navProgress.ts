export type NavProgressState = 'idle' | 'run' | 'indeterminate' | 'done' | 'fade'

export interface NavProgressSnapshot {
  state: NavProgressState
  scale: number
  percent: number | null
}

interface ByteRequest {
  loaded: number
  total: number | null
  done: boolean
}

export interface LoadSession {
  readonly signal: AbortSignal
  hold(): void
  releaseHold(): void
  open(total: number | null): number
  advance(id: number, loaded: number): void
  settle(id: number): void
  seal(): void
  fail(): void
  fade(): void
  dismiss(): void
  snapshot(): NavProgressSnapshot
}

function idleSnapshot(): NavProgressSnapshot {
  return { state: 'idle', scale: 0, percent: null }
}

export function createLoadSession(reduced: () => boolean, isCurrent: () => boolean = () => true): LoadSession {
  const requests: ByteRequest[] = []
  const controller = new AbortController()
  let holds = 0
  let sealed = false
  let failed = false
  let phase: 'open' | 'done' | 'fade' | 'idle' = 'open'
  let onChange: (() => void) | null = null

  function publish(): void {
    if (!isCurrent()) return
    onChange?.()
  }

  function tryComplete(): void {
    if (failed || !sealed || holds > 0) return
    if (requests.some(request => !request.done)) return
    const counted = requests.some(request => request.total == null || request.total > 0)
    if (!counted || reduced()) {
      phase = 'idle'
      return
    }
    phase = 'done'
  }

  function ratio(): { scale: number, percent: number | null, indeterminate: boolean } {
    if (requests.some(request => request.total == null)) {
      return { scale: 0, percent: null, indeterminate: true }
    }
    let loaded = 0
    let total = 0
    for (const request of requests) {
      if (request.total == null || request.total <= 0) continue
      total += request.total
      loaded += Math.min(request.loaded, request.total)
    }
    if (total <= 0) return { scale: 0, percent: null, indeterminate: false }
    const scale = loaded / total
    return { scale, percent: Math.round(scale * 100), indeterminate: false }
  }

  const session: LoadSession = {
    signal: controller.signal,
    hold() {
      if (failed || phase !== 'open') return
      holds += 1
    },
    releaseHold() {
      if (holds > 0) holds -= 1
      tryComplete()
      publish()
    },
    open(total) {
      if (failed || phase !== 'open') return -1
      if (total === 0) return -1
      if (total != null && (!Number.isFinite(total) || total < 0)) {
        throw new Error(`byte total ${total} is not a positive length`)
      }
      requests.push({ loaded: 0, total, done: false })
      publish()
      return requests.length - 1
    },
    advance(id, loaded) {
      const request = requests[id]
      if (!request || request.done || failed) return
      if (!Number.isFinite(loaded) || loaded < 0) throw new Error(`byte count ${loaded} is not a length`)
      request.loaded = loaded
      if (request.total != null && loaded > request.total) request.total = null
      publish()
    },
    settle(id) {
      const request = requests[id]
      if (!request || request.done || failed) return
      request.done = true
      if (request.total == null) request.total = request.loaded
      tryComplete()
      publish()
    },
    seal() {
      if (failed) return
      sealed = true
      tryComplete()
      publish()
    },
    fail() {
      if (failed) return
      failed = true
      phase = 'idle'
      holds = 0
      if (!controller.signal.aborted) controller.abort()
      publish()
    },
    fade() {
      if (phase !== 'done') return
      phase = 'fade'
      publish()
    },
    dismiss() {
      if (phase === 'idle') return
      phase = 'idle'
      publish()
    },
    snapshot() {
      if (failed || phase === 'idle') return idleSnapshot()
      const current = ratio()
      if (phase === 'done' || phase === 'fade') {
        return { state: phase, scale: current.indeterminate ? 1 : current.scale, percent: current.indeterminate ? null : current.percent }
      }
      if (current.indeterminate) return { state: 'indeterminate', scale: 0, percent: null }
      if (current.percent == null) return idleSnapshot()
      return { state: 'run', scale: current.scale, percent: current.percent }
    },
  }

  return Object.assign(session, {
    listen(listener: () => void) {
      onChange = listener
    },
  })
}

type ListeningSession = LoadSession & { listen(listener: () => void): void }

function prefersReducedMotion(): boolean {
  return typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches
}

let generation = 0
let active: ListeningSession | null = null
const listeners = new Set<(snapshot: NavProgressSnapshot) => void>()

function emit(): void {
  const snapshot = active?.snapshot() ?? idleSnapshot()
  for (const listener of listeners) listener(snapshot)
}

export function beginNavigation(): void {
  const previous = active
  generation += 1
  const token = generation
  active = createLoadSession(prefersReducedMotion, () => generation === token) as ListeningSession
  active.listen(emit)
  previous?.fail()
  emit()
}

export function sealNavigation(): void {
  active?.seal()
}

export function abortNavigation(): void {
  active?.fail()
}

export function fadeNav(): void {
  active?.fade()
}

export function dismissNav(): void {
  active?.dismiss()
}

export function navSnapshot(): NavProgressSnapshot {
  return active?.snapshot() ?? idleSnapshot()
}

export function currentLoadSession(): LoadSession {
  if (!active) beginNavigation()
  return active as LoadSession
}

export function subscribeNav(listener: (snapshot: NavProgressSnapshot) => void): () => void {
  listeners.add(listener)
  listener(navSnapshot())
  return () => {
    listeners.delete(listener)
  }
}

export function resetNavForTests(): void {
  active?.fail()
  active = null
  generation += 1
  listeners.clear()
}
