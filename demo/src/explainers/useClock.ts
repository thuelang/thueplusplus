import { onBeforeUnmount, onMounted, ref, type Ref } from 'vue'

export function useClock(): { t: Ref<number>, reduced: Ref<boolean> } {
  const reduced = ref(typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches)
  const t = ref(0)
  let raf = 0
  let last = 0
  let media: MediaQueryList | undefined
  let onMedia: (() => void) | undefined
  let onVisibility: (() => void) | undefined

  function stop(): void {
    cancelAnimationFrame(raf)
    raf = 0
    last = 0
  }

  function tick(now: number): void {
    if (document.hidden || reduced.value) {
      stop()
      return
    }
    const dt = last === 0 ? 0 : Math.min(0.05, (now - last) / 1000)
    last = now
    if (dt > 0) t.value += dt
    raf = requestAnimationFrame(tick)
  }

  function start(): void {
    if (reduced.value || import.meta.env.MODE === 'test' || document.hidden || raf !== 0) return
    raf = requestAnimationFrame(tick)
  }

  onMounted(() => {
    media = window.matchMedia('(prefers-reduced-motion: reduce)')
    reduced.value = media.matches
    onMedia = () => {
      reduced.value = media?.matches ?? false
      if (reduced.value) {
        stop()
        t.value = 0
        return
      }
      start()
    }
    onVisibility = () => {
      if (document.hidden) stop()
      else start()
    }
    media.addEventListener('change', onMedia)
    document.addEventListener('visibilitychange', onVisibility)
    start()
  })

  onBeforeUnmount(() => {
    if (media && onMedia) media.removeEventListener('change', onMedia)
    if (onVisibility) document.removeEventListener('visibilitychange', onVisibility)
    stop()
  })

  return { t, reduced }
}
