import { defineAsyncComponent, type Component } from 'vue'
import { assetSizes } from 'virtual:asset-sizes'
import { readCounted } from './loadBytes'
import { currentLoadSession, type LoadSession } from './navProgress'

export interface AssetFile {
  href: string
  bytes: number | null
}

const modules = new Map<string, Promise<unknown>>()
const fetched = new Map<string, { promise: Promise<void>, signal: AbortSignal }>()

function filesFor(id: string): AssetFile[] {
  if (assetSizes && typeof assetSizes === 'object') {
    const files = assetSizes[id]
    if (!files?.length) throw new Error(`asset sizes have no entry for ${id}`)
    return files
  }
  return [{ href: new URL(`/${id}`, window.location.origin).href, bytes: null }]
}

function fetchOnce(session: LoadSession, file: AssetFile): Promise<void> {
  const existing = fetched.get(file.href)
  if (existing && !existing.signal.aborted) return existing.promise
  const pending = (async () => {
    const response = await fetch(file.href, { signal: session.signal })
    await readCounted(session, response, file.bytes)
  })()
  fetched.set(file.href, { promise: pending, signal: session.signal })
  pending.catch(() => {
    const current = fetched.get(file.href)
    if (current?.promise === pending) fetched.delete(file.href)
  })
  return pending
}

function hang<T>(): Promise<T> {
  return new Promise<T>(() => {})
}

export function trackedImport<T>(id: string, loader: () => Promise<T>): Promise<T> {
  const cached = modules.get(id)
  if (cached) return cached as Promise<T>
  if (import.meta.env.MODE === 'test') {
    const registry = (globalThis as { __testModules?: Map<string, T> }).__testModules
    const mod = registry?.get(id)
    if (!mod) throw new Error(`test bundle is missing ${id}`)
    const pending = Promise.resolve(mod)
    modules.set(id, pending)
    return pending
  }
  const session = currentLoadSession()
  session.hold()
  const pending = (async () => {
    try {
      await Promise.all(filesFor(id).map(file => fetchOnce(session, file)))
      return await loader()
    } catch (error) {
      const aborted = session.signal.aborted
      session.fail()
      if (aborted) {
        modules.delete(id)
        return hang<T>()
      }
      throw error
    } finally {
      session.releaseHold()
    }
  })()
  modules.set(id, pending)
  pending.catch(() => {
    modules.delete(id)
  })
  return pending
}

export function lazyComponent<T extends Component>(id: string, loader: () => Promise<{ default: T }>) {
  return defineAsyncComponent(() => trackedImport(id, loader))
}
