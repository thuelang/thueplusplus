import type { Router } from 'vue-router'
import { isNavigationFailure } from 'vue-router'

const HEADER_GAP = 24

export function hashOffset(): number {
  const quarter = window.innerHeight * 0.25
  const header = document.querySelector('[data-test="site-header"]')
  const headerBottom = header instanceof HTMLElement ? header.getBoundingClientRect().bottom : 0
  return Math.max(quarter, headerBottom + HEADER_GAP)
}

let lockedId = ''
let programmatic = false
let clearTimer = 0
let listening = false
let activeRouter: Router | null = null
let currentHash = ''
let observer: MutationObserver | null = null
let applying = false

export function noteHashNavigation(hash: string): void {
  lockedId = decodeHash(hash)
}

export function releaseHashLock(): void {
  lockedId = ''
}

export function lockedHashId(): string {
  return lockedId
}

export function isProgrammaticScroll(): boolean {
  return programmatic
}

export function decodeHash(hash: string): string {
  if (!hash.startsWith('#')) return ''
  try {
    return decodeURIComponent(hash.slice(1))
  } catch {
    return ''
  }
}

export function logicalTarget(element: HTMLElement): HTMLElement {
  if (element.matches('h1, h2, h3, h4, h5, h6')) {
    const section = element.closest('section')
    if (section instanceof HTMLElement) return section
    const item = element.closest('li')
    if (item instanceof HTMLElement) return item
    return element
  }
  const row = element.closest('tr')
  if (row instanceof HTMLElement) return row
  if (element.matches('li')) return element
  return element
}

function applyHashMark(): void {
  if (applying || !currentHash) return
  applying = true
  try {
    const id = decodeHash(currentHash)
    const element = id ? document.getElementById(id) : null
    if (!element) return
    const target = logicalTarget(element)
    if (target.classList.contains('hash-target')) return
    document.querySelectorAll('.hash-target').forEach(node => node.classList.remove('hash-target'))
    target.classList.add('hash-target')
  } finally {
    applying = false
  }
}

function watchHashMark(): void {
  if (observer || typeof document === 'undefined') return
  observer = new MutationObserver(() => applyHashMark())
  observer.observe(document.body, { attributes: true, subtree: true, attributeFilter: ['class'] })
}

export function clearHashMark(): void {
  currentHash = ''
  document.querySelectorAll('.hash-target').forEach(node => node.classList.remove('hash-target'))
}

export function markHash(hash: string): HTMLElement | null {
  currentHash = hash
  watchHashMark()
  const id = decodeHash(hash)
  const element = id ? document.getElementById(id) : null
  if (!element) return null
  applyHashMark()
  return element
}

function armProgrammaticScroll(smooth: boolean): void {
  programmatic = true
  window.clearTimeout(clearTimer)
  const clear = () => {
    programmatic = false
    window.removeEventListener('scrollend', clear)
  }
  window.addEventListener('scrollend', clear)
  clearTimer = window.setTimeout(clear, smooth ? 1000 : 80)
}

async function frame(): Promise<void> {
  await new Promise<void>(resolve => {
    requestAnimationFrame(() => resolve())
  })
}

async function waitForStable(id: string): Promise<HTMLElement | null> {
  const fonts = document.fonts
  if (fonts) {
    await Promise.race([
      fonts.ready,
      new Promise(resolve => window.setTimeout(resolve, 1500)),
    ])
  }
  const deadline = performance.now() + 4000
  let last = Number.NaN
  let stable = 0
  while (performance.now() < deadline) {
    const element = document.getElementById(id)
    if (!element) {
      last = Number.NaN
      stable = 0
    } else {
      const top = element.getBoundingClientRect().top + window.scrollY
      if (Number.isFinite(last) && Math.abs(top - last) < 0.5) stable += 1
      else stable = 0
      last = top
      if (stable >= 12) return element
    }
    await frame()
  }
  return document.getElementById(id)
}

export async function hashScroll(hash: string): Promise<{ el: HTMLElement, top: number, behavior: ScrollBehavior } | false> {
  const id = decodeHash(hash)
  if (!id) return false
  noteHashNavigation(hash)
  const element = await waitForStable(id)
  if (!element) {
    clearHashMark()
    return false
  }
  markHash(hash)
  const target = logicalTarget(element)
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  const behavior: ScrollBehavior = reduce ? 'instant' : 'smooth'
  armProgrammaticScroll(behavior === 'smooth')
  return { el: target, top: hashOffset(), behavior }
}

function onDocumentClick(event: MouseEvent): void {
  const router = activeRouter
  if (!router || event.defaultPrevented) return
  if (event.button !== 0 || event.metaKey || event.altKey || event.ctrlKey || event.shiftKey) return
  const target = event.target
  if (!(target instanceof Element)) return
  const link = target.closest('a')
  if (!(link instanceof HTMLAnchorElement)) return
  if (link.target && link.target !== '_self') return
  if (link.hasAttribute('download')) return
  const raw = link.getAttribute('href')
  if (!raw || raw.startsWith('mailto:') || raw.startsWith('tel:')) return
  let url: URL
  try {
    url = new URL(link.href)
  } catch {
    return
  }
  if (url.origin !== location.origin || url.hash.length <= 1) return
  event.preventDefault()
  void router.push(url.pathname + url.search + url.hash).catch(error => {
    if (!isNavigationFailure(error)) throw error
  })
}

export function watchHashClicks(router: Router): void {
  activeRouter = router
  if (listening || typeof document === 'undefined') return
  document.addEventListener('click', onDocumentClick)
  listening = true
}
