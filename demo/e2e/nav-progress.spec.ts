import { expect, test } from '@playwright/test'

test('loading bar tracks bytes and stays hidden for a cached page', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByTestId('sandbox-scene')).toBeVisible()
  await expect(page.getByTestId('nav-progress')).toHaveAttribute('data-state', 'idle')

  await page.evaluate(() => {
    const real = window.fetch.bind(window)
    const holds: { controller: ReadableStreamDefaultController<Uint8Array>, buf: ArrayBuffer, sent: number }[] = []
    ;(window as unknown as { __navHolds: typeof holds }).__navHolds = holds
    window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
      const response = await real(input, init)
      if (!url.includes('/src/pages/ProblemPage.vue')) return response
      const buf = await response.arrayBuffer()
      let controller!: ReadableStreamDefaultController<Uint8Array>
      const stream = new ReadableStream<Uint8Array>({
        start(control) {
          controller = control
        },
      })
      const headers = new Headers()
      headers.set('content-length', String(buf.byteLength))
      const type = response.headers.get('content-type')
      if (type) headers.set('content-type', type)
      holds.push({ controller, buf, sent: 0 })
      return new Response(stream, { status: response.status, headers })
    }
  })

  await page.getByRole('link', { name: 'Factorial' }).first().click()
  await page.waitForFunction(() => (window as unknown as { __navHolds: { buf: ArrayBuffer }[] }).__navHolds.length > 0)
  const expected = await page.evaluate(() => {
    const hold = (window as unknown as { __navHolds: { controller: ReadableStreamDefaultController<Uint8Array>, buf: ArrayBuffer, sent: number }[] }).__navHolds[0]
    if (!hold || hold.buf.byteLength < 2) throw new Error('problem page chunk is too small to split')
    const half = Math.floor(hold.buf.byteLength / 2)
    hold.controller.enqueue(new Uint8Array(hold.buf, 0, half))
    hold.sent = half
    return Math.round((half / hold.buf.byteLength) * 100)
  })
  const bar = page.getByTestId('nav-progress')
  await expect(bar).toHaveAttribute('data-state', 'run')
  await expect(bar).toHaveAttribute('aria-valuenow', String(expected))
  await expect.poll(async () => bar.evaluate(element => {
    const raw = element.getAttribute('style') ?? ''
    const match = raw.match(/scaleX\(([^)]+)\)/)
    return match ? Number(match[1]) : Number.NaN
  })).toBeCloseTo(expected / 100, 2)

  await page.evaluate(() => {
    const hold = (window as unknown as { __navHolds: { controller: ReadableStreamDefaultController<Uint8Array>, buf: ArrayBuffer, sent: number }[] }).__navHolds[0]
    if (!hold) throw new Error('missing held chunk')
    hold.controller.enqueue(new Uint8Array(hold.buf, hold.sent))
    hold.controller.close()
  })
  await expect(page.getByRole('heading', { name: 'Factorial', level: 1 })).toBeVisible()
  await expect(bar).toHaveAttribute('data-state', 'idle')

  await page.getByTestId('site-nav').getByRole('link', { name: 'Problems' }).click()
  await expect(page.getByRole('heading', { name: 'Problems.', level: 1 })).toBeVisible()
  await expect(bar).toHaveAttribute('data-state', 'idle')
  const holdsBefore = await page.evaluate(() => (window as unknown as { __navHolds: unknown[] }).__navHolds.length)
  await page.evaluate(() => {
    const element = document.querySelector('[data-test="nav-progress"]')
    ;(window as unknown as { __barLeftIdle: boolean }).__barLeftIdle = true
    if (!element) return
    const observer = new MutationObserver(() => {
      if (element.getAttribute('data-state') !== 'idle') {
        ;(window as unknown as { __barLeftIdle: boolean }).__barLeftIdle = false
      }
    })
    observer.observe(element, { attributes: true, attributeFilter: ['data-state'] })
  })
  await page.getByTestId('problem-index').getByRole('link', { name: 'Factorial', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Factorial', level: 1 })).toBeVisible()
  expect(await page.evaluate(() => (window as unknown as { __barLeftIdle: boolean }).__barLeftIdle)).toBe(true)
  expect(await page.evaluate(() => (window as unknown as { __navHolds: unknown[] }).__navHolds.length)).toBe(holdsBefore)
})
