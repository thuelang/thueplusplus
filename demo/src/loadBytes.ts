import type { LoadSession } from './navProgress'

export function totalBytes(response: Response, manifestBytes: number | null): number | null {
  const encoding = response.headers.get('content-encoding')
  const compressed = encoding != null && encoding !== '' && encoding !== 'identity'
  if (!compressed) {
    const raw = response.headers.get('content-length')
    if (raw != null && raw !== '') {
      if (!/^\d+$/.test(raw)) throw new Error(`content-length ${raw} is not a byte length`)
      return Number(raw)
    }
  }
  if (manifestBytes == null) return null
  if (!Number.isInteger(manifestBytes) || manifestBytes < 0) {
    throw new Error(`manifest size ${manifestBytes} is not a byte length`)
  }
  return manifestBytes
}

export async function readCounted(session: LoadSession, response: Response, manifestBytes: number | null): Promise<void> {
  if (!response.ok) throw new Error(`load failed: ${response.status} ${response.url}`)
  const total = totalBytes(response, manifestBytes)
  if (total === 0) {
    await response.arrayBuffer()
    return
  }
  const id = session.open(total)
  const reader = response.body?.getReader()
  if (!reader) {
    const buffer = await response.arrayBuffer()
    if (id >= 0) {
      session.advance(id, buffer.byteLength)
      session.settle(id)
    }
    return
  }
  let loaded = 0
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    loaded += value?.byteLength ?? 0
    if (id >= 0) session.advance(id, loaded)
  }
  if (id >= 0) session.settle(id)
}
