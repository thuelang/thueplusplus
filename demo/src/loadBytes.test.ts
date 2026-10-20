import { describe, expect, it } from 'vitest'
import { readCounted, totalBytes } from './loadBytes'
import { createLoadSession } from './navProgress'

describe('response totals', () => {
  it('uses content-length for an identity body and the manifest when the body is compressed', () => {
    const plain = new Response(null, { headers: { 'content-length': '240' } })
    expect(totalBytes(plain, 100)).toBe(240)
    const gzip = new Response(null, { headers: { 'content-length': '80', 'content-encoding': 'gzip' } })
    expect(totalBytes(gzip, 240)).toBe(240)
    const chunked = new Response(null)
    expect(totalBytes(chunked, null)).toBeNull()
    expect(() => totalBytes(new Response(null, { headers: { 'content-length': 'nope' } }), null)).toThrow(/content-length/)
  })

  it('counts a stream at the halfway mark', async () => {
    const first = new Uint8Array(4)
    const second = new Uint8Array(4)
    let release: (() => void) | undefined
    const gate = new Promise<void>(resolve => {
      release = resolve
    })
    let sent = 0
    const stream = new ReadableStream<Uint8Array>({
      async pull(controller) {
        if (sent === 0) {
          sent = 1
          controller.enqueue(first)
          return
        }
        if (sent === 1) {
          sent = 2
          await gate
          controller.enqueue(second)
          controller.close()
        }
      },
    })
    const response = new Response(stream, { headers: { 'content-length': '8' } })
    const bar = createLoadSession(() => false)
    const pending = readCounted(bar, response, null)
    await viWaitFor(() => {
      if (bar.snapshot().percent !== 50) throw new Error(`percent is ${bar.snapshot().percent}`)
    })
    expect(bar.snapshot()).toEqual({ state: 'run', scale: 0.5, percent: 50 })
    release?.()
    await pending
    expect(bar.snapshot()).toEqual({ state: 'run', scale: 1, percent: 100 })
  })
})

async function viWaitFor(check: () => void): Promise<void> {
  const started = Date.now()
  let last = 'not ready'
  while (Date.now() - started < 1000) {
    try {
      check()
      return
    } catch (error) {
      last = error instanceof Error ? error.message : String(error)
      await new Promise(resolve => setTimeout(resolve, 10))
    }
  }
  throw new Error(last)
}
