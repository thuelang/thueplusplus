import { expect, test, type Page } from '@playwright/test'

test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 480 })
})

async function expectScrolledTo(page: Page, selector: string): Promise<void> {
  await page.waitForFunction(sel => {
    const header = document.querySelector('[data-test="site-header"]')
    const node = document.querySelector(sel)
    if (!(header instanceof HTMLElement) || !(node instanceof HTMLElement)) return false
    const el = node.closest('.hash-target') ?? node
    const top = el.getBoundingClientRect().top
    const bottom = header.getBoundingClientRect().bottom
    const root = document.scrollingElement
    const max = root ? root.scrollHeight - root.clientHeight : 0
    const placed = top >= bottom - 1 && top <= bottom + 28
    const pinned = window.scrollY >= max - 2 && top >= bottom - 1
    return placed || pinned
  }, selector)
}

async function expectJustBelowHeader(page: Page, selector: string): Promise<void> {
  await page.waitForFunction(sel => {
    const header = document.querySelector('[data-test="site-header"]')
    const node = document.querySelector(sel)
    if (!(header instanceof HTMLElement) || !(node instanceof HTMLElement)) return false
    const el = node.closest('.hash-target') ?? node
    const top = el.getBoundingClientRect().top
    const bottom = header.getBoundingClientRect().bottom
    return top >= bottom - 1 && top <= bottom + 28
  }, selector)
}

async function readAccent(page: Page, selector: string): Promise<string> {
  return page.locator(selector).evaluate(el => {
    const target = el.closest('.hash-target')
    return target ? getComputedStyle(target).borderLeftWidth : '0px'
  })
}

async function accent(page: Page, selector: string): Promise<string> {
  await page.waitForFunction(sel => {
    const node = document.querySelector(sel)
    const target = node?.closest('.hash-target')
    return !!target && parseFloat(getComputedStyle(target).borderLeftWidth) >= 2
  }, selector)
  return readAccent(page, selector)
}

test('direct load highlights solutions', async ({ page }) => {
  await page.goto('/problems/factorial#solutions')
  await expectJustBelowHeader(page, '#solutions')
  await page.waitForTimeout(700)
  await expectJustBelowHeader(page, '#solutions')
  expect(await accent(page, '#solutions')).toBe('3px')
  expect(await page.locator('#solutions').evaluate(el => el.tagName === 'H2' && el.closest('.hash-target')?.tagName === 'SECTION')).toBe(true)
  console.log('hash-direct')
})

test('back and forward restore the hash', async ({ page }) => {
  await page.goto('/problems/factorial#solutions')
  await expectJustBelowHeader(page, '#solutions')
  await page.locator('#on-this-page a[href="#cost"]').click()
  await expect(page).toHaveURL(/\/problems\/factorial#cost$/)
  await expectJustBelowHeader(page, '#cost')
  expect(await accent(page, '#cost')).toBe('3px')
  expect(await readAccent(page, '#solutions')).toBe('0px')
  await page.goBack()
  await expect(page).toHaveURL(/\/problems\/factorial#solutions$/)
  await expectJustBelowHeader(page, '#solutions')
  expect(await accent(page, '#solutions')).toBe('3px')
  await page.goForward()
  await expect(page).toHaveURL(/\/problems\/factorial#cost$/)
  await expectJustBelowHeader(page, '#cost')
  expect(await accent(page, '#cost')).toBe('3px')

  await page.goto('/sandboxes/expr')
  await page.locator('#call').waitFor()
  await page.evaluate(() => window.scrollTo(0, 480))
  const saved = await page.evaluate(() => window.scrollY)
  expect(saved).toBeGreaterThan(200)
  await page.locator('[data-test="section-nav"] a[href="/sandboxes"]').click()
  await expect(page).toHaveURL(/\/sandboxes$/)
  await page.goBack()
  await expect(page).toHaveURL(/\/sandboxes\/expr$/)
  await page.waitForFunction(y => Math.abs(window.scrollY - y) < 40, saved)
  console.log('hash-history')
})

test('cross-route hash scrolls after the lazy page', async ({ page }) => {
  await page.goto('/docs')
  await page.evaluate(() => {
    const link = document.createElement('a')
    link.href = '/docs/go/install#cli'
    link.textContent = 'Go command line'
    link.dataset.test = 'cross-hash'
    document.querySelector('[data-test="page-main"]')?.append(link)
  })
  await page.getByTestId('cross-hash').click()
  await expect(page).toHaveURL(/\/docs\/go\/install#cli$/)
  await expectScrolledTo(page, '#cli')
  expect(await accent(page, '#cli')).toBe('3px')
  console.log('hash-cross')
})

test('reduced motion scrolls instantly', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.addInitScript(() => {
    const original = window.scrollTo.bind(window)
    const record = (behavior: string | undefined) => {
      ;(window as unknown as { __scrollBehaviors: string[] }).__scrollBehaviors.push(behavior ?? 'coords')
    }
    ;(window as unknown as { __scrollBehaviors: string[] }).__scrollBehaviors = []
    window.scrollTo = ((...args: unknown[]) => {
      const first = args[0]
      const behavior = typeof first === 'object' && first && 'behavior' in first ? String((first as { behavior?: string }).behavior) : 'coords'
      record(behavior)
      return (original as (...values: unknown[]) => void)(...args)
    }) as typeof window.scrollTo
  })
  await page.goto('/problems/factorial#solutions')
  await expectJustBelowHeader(page, '#solutions')
  const behaviors = await page.evaluate(() => (window as unknown as { __scrollBehaviors: string[] }).__scrollBehaviors)
  expect(behaviors.includes('smooth')).toBe(false)
  expect(behaviors.includes('instant')).toBe(true)
  const motion = await page.locator('#solutions').evaluate(el => {
    const target = el.closest('.hash-target') ?? el
    const style = getComputedStyle(target)
    return { name: style.animationName, duration: style.animationDuration }
  })
  expect(motion.name === 'none' || motion.duration === '0s').toBe(true)
  console.log('hash-reduced')
})

test('scroll spy waits for the reader', async ({ page }) => {
  await page.goto('/docs/go/install#cli')
  await expect(page.locator('#on-this-page a[href="#cli"]')).toHaveAttribute('aria-current', 'location')
  await page.locator('#cli').hover()
  await page.mouse.wheel(0, -800)
  await expect(page.locator('#on-this-page a[href="#install"]')).toHaveAttribute('aria-current', 'location')

  await page.goto('/problems/factorial#solutions')
  await expectJustBelowHeader(page, '#solutions')
  await expect(page.locator('#on-this-page a[href="#solutions"]')).toHaveAttribute('aria-current', 'location')
  await page.locator('#solutions').hover()
  await page.mouse.wheel(0, -1400)
  await expect(page.locator('#on-this-page a[href="#cost"]')).toHaveAttribute('aria-current', 'location')
  console.log('hash-spy')
})

test('unknown hash is a no-op', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', error => errors.push(String(error)))
  page.on('console', message => {
    if (message.type() === 'error') errors.push(message.text())
  })
  await page.goto('/problems/factorial#solutions')
  await expectJustBelowHeader(page, '#solutions')
  await page.locator('#on-this-page a[href="#cost"]').click()
  await expectJustBelowHeader(page, '#cost')
  expect(await readAccent(page, '#solutions')).toBe('0px')
  await page.goto('/problems/factorial')
  await expect(page.locator('.doc-page :target')).toHaveCount(0)
  expect(await readAccent(page, '#solutions')).toBe('0px')
  await page.goto('/problems/factorial#this-id-is-not-on-the-page')
  await page.waitForTimeout(600)
  expect(errors).toEqual([])
  await expect(page.locator('.doc-page :target')).toHaveCount(0)
  expect(await page.evaluate(() => window.scrollY)).toBeLessThan(40)
  console.log('hash-unknown')
})

test('logical parent gets the highlight', async ({ page }) => {
  await page.goto('/problems/factorial')
  const rowId = await page.locator('[data-test="solution-row"]').first().getAttribute('id')
  expect(rowId).toBeTruthy()
  await page.goto(`/problems/factorial#${rowId}`)
  await expectJustBelowHeader(page, `#${rowId}`)
  expect(await page.locator(`#${rowId}`).evaluate(el => el.tagName)).toBe('TR')
  expect(await accent(page, `#${rowId}`)).toBe('3px')

  await page.goto('/sandboxes#lisp')
  await expectJustBelowHeader(page, '#lisp')
  expect(await page.locator('#lisp').evaluate(el => el.tagName)).toBe('LI')
  expect(await accent(page, '#lisp')).toBe('3px')

  await page.goto('/problems/factorial#solutions')
  await page.waitForFunction(() => {
    const heading = document.getElementById('solutions')
    return heading?.tagName === 'H2' && heading.closest('.hash-target')?.tagName === 'SECTION' && !heading.classList.contains('hash-target')
  })
  console.log('hash-parent')
})
