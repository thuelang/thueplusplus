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
    const band = top > bottom && top <= window.innerHeight * 0.3
    const pinned = window.scrollY >= max - 2 && top > bottom
    return band || pinned
  }, selector)
}

async function expectHashBand(page: Page, selector: string): Promise<void> {
  await page.waitForFunction(sel => {
    const header = document.querySelector('[data-test="site-header"]')
    const node = document.querySelector(sel)
    if (!(header instanceof HTMLElement) || !(node instanceof HTMLElement)) return false
    const el = node.closest('.hash-target') ?? node
    const top = el.getBoundingClientRect().top
    const bottom = header.getBoundingClientRect().bottom
    return top > bottom && top <= window.innerHeight * 0.3
  }, selector)
}

async function readAccent(page: Page, selector: string): Promise<string> {
  return page.locator(selector).evaluate(el => {
    const target = el.closest('.hash-target')
    if (!target) return '0px'
    const host = target.matches('tr') ? target.querySelector(':scope > :first-child') : target
    if (!(host instanceof Element)) return '0px'
    const width = getComputedStyle(host, '::before').width
    return width && width !== 'auto' ? width : '0px'
  })
}

async function accent(page: Page, selector: string): Promise<string> {
  await page.waitForFunction(sel => {
    const node = document.querySelector(sel)
    const target = node?.closest('.hash-target')
    if (!target) return false
    const host = target.matches('tr') ? target.querySelector(':scope > :first-child') : target
    return host instanceof Element && parseFloat(getComputedStyle(host, '::before').width) >= 2
  }, selector)
  return readAccent(page, selector)
}

async function expectMarkClearsText(page: Page, selector: string): Promise<void> {
  const report = await page.locator(selector).evaluate(el => {
    const target = el.closest('.hash-target')
    if (!(target instanceof HTMLElement)) return { ok: false, reason: 'no target' }
    const host = target.matches('tr') ? target.querySelector(':scope > :first-child') : target
    if (!(host instanceof HTMLElement)) return { ok: false, reason: 'no host' }
    const before = getComputedStyle(host, '::before')
    const border = parseFloat(getComputedStyle(host).borderLeftWidth)
    const hostBox = host.getBoundingClientRect()
    const edge = hostBox.left + border
    const barRight = edge + parseFloat(before.left) + parseFloat(before.width)
    const walker = document.createTreeWalker(target, NodeFilter.SHOW_TEXT, {
      acceptNode(node) {
        return node.textContent?.trim() ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT
      },
    })
    const text = walker.nextNode()
    if (!text) return { ok: false, reason: 'no text' }
    const range = document.createRange()
    range.selectNodeContents(text)
    const textBox = range.getBoundingClientRect()
    const gap = textBox.left - barRight
    const widthBefore = target.getBoundingClientRect().width
    const scrollBefore = document.documentElement.scrollWidth
    target.classList.remove('hash-target')
    const widthAfter = target.getBoundingClientRect().width
    const scrollAfter = document.documentElement.scrollWidth
    const bare = document.createRange()
    bare.selectNodeContents(text)
    const textAfter = bare.getBoundingClientRect().left
    target.classList.add('hash-target')
    return {
      ok: gap >= 6
        && border === 0
        && parseFloat(getComputedStyle(target).borderLeftWidth) === 0
        && Math.abs(widthBefore - widthAfter) < 0.5
        && Math.abs(textBox.left - textAfter) < 0.5
        && Math.abs(scrollBefore - scrollAfter) < 1,
      gap,
      border,
      widthDelta: widthBefore - widthAfter,
      textDelta: textBox.left - textAfter,
      scrollDelta: scrollBefore - scrollAfter,
    }
  })
  expect(report.ok, JSON.stringify(report)).toBe(true)
}

test('direct load highlights solutions', async ({ page }) => {
  await page.goto('/problems/factorial#solutions')
  await expectHashBand(page, '#solutions')
  await page.waitForTimeout(700)
  await expectHashBand(page, '#solutions')
  expect(await accent(page, '#solutions')).toBe('2px')
  expect(await page.locator('#solutions').evaluate(el => el.tagName === 'H2' && el.closest('.hash-target')?.tagName === 'SECTION')).toBe(true)
  await expectMarkClearsText(page, '#solutions')
  const faded = await page.locator('#solutions').evaluate(el => {
    const target = el.closest('.hash-target')
    if (!(target instanceof HTMLElement)) return { ok: false, reason: 'missing' }
    const anims = target.getAnimations()
    const wash = anims.find(anim => anim.animationName === 'hash-wash')
    const bar = anims.find(anim => anim.animationName === 'hash-bar')
    if (!wash || !bar) return { ok: false, reason: 'anims', names: anims.map(anim => anim.animationName) }
    const duration = Number(wash.effect?.getTiming().duration ?? 0)
    wash.currentTime = duration * 0.3
    bar.currentTime = duration * 0.3
    const held = parseFloat(getComputedStyle(target).getPropertyValue('--hash-ink'))
    const heldOpacity = parseFloat(getComputedStyle(target, '::before').opacity)
    wash.currentTime = duration
    bar.currentTime = duration
    const ink = parseFloat(getComputedStyle(target).getPropertyValue('--hash-ink'))
    const opacity = parseFloat(getComputedStyle(target, '::before').opacity)
    return {
      ok: held >= 10 && heldOpacity > 0.9 && ink > 0 && ink < 6 && opacity > 0.2 && opacity < 0.6,
      held,
      heldOpacity,
      ink,
      opacity,
      duration,
    }
  })
  expect(faded.ok, JSON.stringify(faded)).toBe(true)
  console.log('hash-direct')
})

test('back and forward restore the hash', async ({ page }) => {
  await page.goto('/problems/factorial#solutions')
  await expectHashBand(page, '#solutions')
  await page.locator('#on-this-page a[href="#cost"]').click()
  await expect(page).toHaveURL(/\/problems\/factorial#cost$/)
  await expectHashBand(page, '#cost')
  expect(await accent(page, '#cost')).toBe('2px')
  expect(await readAccent(page, '#solutions')).toBe('0px')
  await page.goBack()
  await expect(page).toHaveURL(/\/problems\/factorial#solutions$/)
  await expectHashBand(page, '#solutions')
  expect(await accent(page, '#solutions')).toBe('2px')
  await page.goForward()
  await expect(page).toHaveURL(/\/problems\/factorial#cost$/)
  await expectHashBand(page, '#cost')
  expect(await accent(page, '#cost')).toBe('2px')

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
  await page.locator('[data-test="page-main"]').waitFor()
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
  expect(await accent(page, '#cli')).toBe('2px')
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
  await expectHashBand(page, '#solutions')
  const behaviors = await page.evaluate(() => (window as unknown as { __scrollBehaviors: string[] }).__scrollBehaviors)
  expect(behaviors.includes('smooth')).toBe(false)
  expect(behaviors.includes('instant')).toBe(true)
  const motion = await page.locator('#solutions').evaluate(el => {
    const target = el.closest('.hash-target') ?? el
    const style = getComputedStyle(target)
    const bar = getComputedStyle(target, '::before')
    return {
      name: style.animationName,
      duration: style.animationDuration,
      ink: parseFloat(style.getPropertyValue('--hash-ink')),
      opacity: parseFloat(bar.opacity),
      border: parseFloat(style.borderLeftWidth),
    }
  })
  expect(motion.name === 'none' || motion.duration === '0s').toBe(true)
  expect(motion.ink).toBeGreaterThanOrEqual(10)
  expect(motion.opacity).toBeGreaterThan(0.9)
  expect(motion.border).toBe(0)
  console.log('hash-reduced')
})

test('scroll spy waits for the reader', async ({ page }) => {
  await page.goto('/docs/go/install#cli')
  await expect(page.locator('#on-this-page a[href="#cli"]')).toHaveAttribute('aria-current', 'location')
  await page.locator('#cli').hover()
  await page.mouse.wheel(0, -800)
  await expect(page.locator('#on-this-page a[href="#install"]')).toHaveAttribute('aria-current', 'location')

  await page.goto('/problems/factorial#solutions')
  await expectHashBand(page, '#solutions')
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
  await expectHashBand(page, '#solutions')
  await page.locator('#on-this-page a[href="#cost"]').click()
  await expectHashBand(page, '#cost')
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
  await expectHashBand(page, `#${rowId}`)
  expect(await page.locator(`#${rowId}`).evaluate(el => el.tagName)).toBe('TR')
  expect(await accent(page, `#${rowId}`)).toBe('2px')
  await expectMarkClearsText(page, `#${rowId}`)

  await page.goto('/sandboxes#lisp')
  await expectHashBand(page, '#lisp')
  expect(await page.locator('#lisp').evaluate(el => el.tagName)).toBe('LI')
  expect(await accent(page, '#lisp')).toBe('2px')
  await expectMarkClearsText(page, '#lisp')

  await page.goto('/install#hosts')
  await expectHashBand(page, '#hosts')
  expect(await page.locator('#hosts').evaluate(el => el.tagName)).toBe('SECTION')
  expect(await accent(page, '#hosts')).toBe('2px')
  await expectMarkClearsText(page, '#hosts')

  await page.goto('/problems/factorial#solutions')
  await page.waitForFunction(() => {
    const heading = document.getElementById('solutions')
    return heading?.tagName === 'H2' && heading.closest('.hash-target')?.tagName === 'SECTION' && !heading.classList.contains('hash-target')
  })
  await expectMarkClearsText(page, '#solutions')
  console.log('hash-parent')
})
