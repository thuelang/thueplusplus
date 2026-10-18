import { expect, test, type Page } from '@playwright/test'

const desktop = [1440, 1024, 768]
const themes = ['dark', 'light'] as const

type Box = { left: number, right: number, top: number, bottom: number }

async function paint(page: Page, theme: 'dark' | 'light', width: number, height: number): Promise<void> {
  await page.addInitScript((value) => {
    localStorage.setItem('theme', value)
  }, theme)
  await page.emulateMedia({ colorScheme: theme })
  await page.setViewportSize({ width, height })
  await page.goto('/')
  if (theme === 'dark') await expect(page.locator('html')).toHaveClass(/dark/)
  else await expect(page.locator('html')).not.toHaveClass(/dark/)
  await expect(page.getByTestId('machine')).toBeVisible()
  await expect(page.getByTestId('speech')).toHaveCount(0)
  await expect(page.getByTestId('start-hint')).toHaveCount(0)
  await expect(page.getByTestId('sandbox-scene')).toHaveAttribute('aria-label', /Rex at the machine\./)
}

async function readBox(page: Page, testId: string): Promise<Box> {
  const box = await page.getByTestId(testId).evaluate((el) => {
    const rect = el.getBoundingClientRect()
    return { left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom }
  })
  return box
}

function inside(box: Box, width: number, height: number, margin: number): void {
  expect(box.left).toBeGreaterThanOrEqual(margin)
  expect(box.right).toBeLessThanOrEqual(width - margin)
  expect(box.top).toBeGreaterThanOrEqual(margin)
  expect(box.bottom).toBeLessThanOrEqual(height - margin)
}

async function expectNoGround(page: Page): Promise<void> {
  await expect(page.getByTestId('floor')).toHaveCount(0)
  const border = await page.getByTestId('page-details').evaluate((el) => getComputedStyle(el).borderTopWidth)
  expect(border).toBe('0px')
}

for (const theme of themes) {
  for (const width of desktop) {
    const height = width === 1024 ? 768 : width === 768 ? 1024 : 900
    test(`desktop ${width} ${theme} keeps the machine inside`, async ({ page }) => {
      await paint(page, theme, width, height)
      const machine = await readBox(page, 'machine')
      const hero = await readBox(page, 'page-hero')
      inside(machine, width, height, 32)
      // The hero column is inset from the viewport. A 32px viewport margin
      // still left the machine on the column edge at 1440.
      expect(machine.left).toBeGreaterThanOrEqual(hero.left + 48)
      await expect(page.getByTestId('score')).toHaveCount(0)
      await expectNoGround(page)
    })
  }

  test(`390 ${theme} keeps the machine and every box inside`, async ({ page }) => {
    const width = 390
    const height = 844
    await paint(page, theme, width, height)
    const machine = await readBox(page, 'machine')
    inside(machine, width, height, 8)
    await expect(page.getByTestId('score')).toHaveCount(0)
    await expectNoGround(page)
    let seen = 0
    const started = Date.now()
    while (Date.now() - started < 2500) {
      const boxes = await page.getByTestId('box').evaluateAll((els) => els.map((el) => {
        const rect = el.getBoundingClientRect()
        return { left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom }
      }))
      seen += boxes.length
      for (const box of boxes) {
        expect(box.left).toBeGreaterThanOrEqual(-0.5)
        expect(box.right).toBeLessThanOrEqual(width + 0.5)
        expect(box.top).toBeGreaterThanOrEqual(-0.5)
        expect(box.bottom).toBeLessThanOrEqual(height + 0.5)
      }
      await page.waitForTimeout(80)
    }
    expect(seen).toBeGreaterThan(0)
  })
}

test('outline shows for Tab and stays off after a click', async ({ page }) => {
  await paint(page, 'dark', 1440, 900)
  const lever = page.getByTestId('lever-hit')
  await lever.click()
  await expect(page.getByTestId('sandbox-scene')).toHaveAttribute('data-control', 'player')
  const clicked = await lever.evaluate((el) => {
    const style = getComputedStyle(el)
    return {
      visible: el.matches(':focus-visible'),
      style: style.outlineStyle,
      width: style.outlineWidth,
    }
  })
  expect(clicked.visible).toBe(false)
  expect(clicked.style).toBe('none')

  const scene = page.getByTestId('sandbox-scene')
  const sceneBox = await scene.boundingBox()
  if (!sceneBox) throw new Error('scene has no box')
  await scene.click({ position: { x: Math.min(180, sceneBox.width / 2), y: Math.min(40, sceneBox.height / 2) } })
  expect(await scene.evaluate((el) => getComputedStyle(el).outlineStyle)).toBe('none')

  let hit = false
  for (let i = 0; i < 40; i += 1) {
    await page.keyboard.press('Tab')
    hit = await page.evaluate(() => {
      const el = document.activeElement
      return Boolean(el && el.classList.contains('rex-hit') && el.matches(':focus-visible'))
    })
    if (hit) break
  }
  expect(hit).toBe(true)
  const ring = await page.evaluate(() => {
    const el = document.activeElement
    if (!(el instanceof HTMLElement)) throw new Error('nothing focused')
    const style = getComputedStyle(el)
    const box = el.getBoundingClientRect()
    return {
      style: style.outlineStyle,
      width: Number.parseFloat(style.outlineWidth),
      offset: Number.parseFloat(style.outlineOffset),
      widthPx: box.width,
      heightPx: box.height,
    }
  })
  expect(ring.style).toBe('solid')
  expect(ring.width).toBe(1)
  expect(ring.offset).toBe(1)
  expect(ring.widthPx).toBeGreaterThan(ring.offset * 2)
  expect(ring.heightPx).toBeGreaterThan(ring.offset * 2)

  const stray = await page.evaluate(() => {
    const machine = document.querySelector('[data-test="machine"]')
    if (!machine) throw new Error('missing machine')
    const base = machine.getBoundingClientRect().bottom
    const vw = window.innerWidth
    return [...document.querySelectorAll('[data-test="box"]')].filter((el) => {
      const rect = el.getBoundingClientRect()
      return rect.right > vw - 48 && Math.abs(rect.bottom - base) < 12
    }).length
  })
  expect(stray).toBe(0)
})

test('leaves breathing room above the game on a phone', async ({ page }) => {
  for (const theme of themes) {
    for (const width of [390, 768]) {
      const height = width === 390 ? 844 : 1024
      await paint(page, theme, width, height)
      const gap = await page.evaluate(() => {
        const buttons = [...document.querySelectorAll('[data-test="page-hero"] a')]
        const game = document.querySelector('[data-test="belt-bleed"]')
        if (buttons.length === 0 || !game) throw new Error('missing buttons or game')
        const buttonBottom = Math.max(...buttons.map(el => el.getBoundingClientRect().bottom))
        return game.getBoundingClientRect().top - buttonBottom
      })
      expect(gap).toBeGreaterThanOrEqual(32)
    }
  }
})

test('fits the hero to its picture and its text', async ({ page }) => {
  async function measure(): Promise<{
    above: number
    below: number
    copyMid: number
    bleedTop: number
    bleedBottom: number
    copyBottom: number
    span: number
    vh: number
  }> {
    return page.evaluate(() => {
      const header = document.querySelector('[data-test="site-header"]')
      const hero = document.querySelector('[data-test="page-hero"]')
      const bleed = document.querySelector('[data-test="belt-bleed"]')
      const copy = document.querySelector('.hero-copy')
      const details = document.querySelector('[data-test="page-details"]')
      if (!header || !hero || !bleed || !copy || !details) throw new Error('missing hero parts')
      const h = header.getBoundingClientRect()
      const heroBox = hero.getBoundingClientRect()
      const b = bleed.getBoundingClientRect()
      const c = copy.getBoundingClientRect()
      const d = details.getBoundingClientRect()
      return {
        above: Math.min(b.top, c.top) - h.bottom,
        below: d.top - heroBox.bottom,
        copyMid: (c.top + c.bottom) / 2,
        bleedTop: b.top,
        bleedBottom: b.bottom,
        copyBottom: c.bottom,
        span: heroBox.bottom - Math.min(b.top, c.top),
        vh: window.innerHeight,
      }
    })
  }

  await paint(page, 'dark', 1440, 900)
  const desktop = await measure()
  expect(desktop.above).toBeGreaterThanOrEqual(-1)
  expect(desktop.above).toBeLessThan(80)
  expect(Math.abs(desktop.below)).toBeLessThan(40)
  expect(desktop.copyMid).toBeGreaterThan(desktop.bleedTop)
  expect(desktop.copyMid).toBeLessThan(desktop.bleedBottom)
  expect(desktop.span).toBeLessThan(desktop.vh * 0.75)

  await paint(page, 'light', 390, 844)
  const mobile = await measure()
  expect(mobile.above).toBeGreaterThanOrEqual(-1)
  expect(mobile.above).toBeLessThan(80)
  expect(Math.abs(mobile.below)).toBeLessThan(40)
  expect(mobile.copyBottom).toBeLessThanOrEqual(mobile.bleedTop - 24)
  expect(mobile.span).toBeLessThan(mobile.vh * 0.85)
})
