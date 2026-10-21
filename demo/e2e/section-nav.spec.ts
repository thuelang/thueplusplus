import { readFileSync } from 'node:fs'
import { expect, test, type Page } from '@playwright/test'
import { fileURLToPath } from 'node:url'

interface CatalogFile {
  problems: { id: string; title: string; path: string }[]
  sandboxes: { id: string; name: string }[]
}

const catalog = JSON.parse(readFileSync(fileURLToPath(new URL('../src/generated/catalog.json', import.meta.url)), 'utf8')) as CatalogFile

const pages = ['/problems/factorial', '/sandboxes/expr', '/docs/go/install'] as const

async function expectHrefs(page: Page, expected: string[]): Promise<void> {
  const links = page.getByTestId('section-nav').getByRole('link')
  await expect(links).toHaveCount(expected.length)
  expect(await links.evaluateAll(nodes => nodes.map(node => node.getAttribute('href')))).toEqual(expected)
}

async function noHorizontalScroll(page: Page): Promise<void> {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
  expect(overflow).toBeLessThanOrEqual(1)
}

test('toc sits to the right', async ({ page }) => {
  await page.setViewportSize({ width: 1600, height: 900 })
  for (const path of pages) {
    await page.goto(path)
    const main = page.getByTestId('page-main')
    const toc = page.locator('#on-this-page')
    const nav = page.getByTestId('section-nav')
    await expect(toc).toBeVisible()
    await expect(nav).toBeVisible()
    await expect(toc).toHaveAttribute('aria-label', 'On this page')
    const mainBox = await main.boundingBox()
    const tocBox = await toc.boundingBox()
    const navBox = await nav.boundingBox()
    expect(mainBox).toBeTruthy()
    expect(tocBox).toBeTruthy()
    expect(navBox).toBeTruthy()
    expect(tocBox!.x).toBeGreaterThan(mainBox!.x + mainBox!.width - 1)
    expect(navBox!.x + navBox!.width).toBeLessThanOrEqual(mainBox!.x + 1)
    expect(await nav.evaluate(node => getComputedStyle(node).position)).toBe('sticky')
    expect(await page.getByTestId('page-sidebar').evaluate(node => getComputedStyle(node).position)).toBe('sticky')
  }
})

test('section nav marks the current page', async ({ page }) => {
  await page.setViewportSize({ width: 1600, height: 900 })

  await page.goto('/problems/factorial')
  const factorial = catalog.problems.find(problem => problem.id === 'factorial')
  expect(factorial).toBeTruthy()
  await expectHrefs(page, ['/problems', ...catalog.problems.map(problem => problem.path)])
  await expect(page.getByTestId('section-nav').locator('[aria-current="page"]')).toHaveCount(1)
  await expect(page.getByTestId('section-nav').locator('[aria-current="page"]')).toHaveAttribute('href', '/problems/factorial')
  await expect(page.getByTestId('section-nav').locator('[aria-current="page"]')).toHaveText(factorial!.title)

  await page.goto('/sandboxes/expr')
  const sandboxHrefs = ['/sandboxes', ...catalog.sandboxes.map(sandbox => `/sandboxes/${sandbox.id}`)]
  expect(sandboxHrefs).not.toContain('/sandboxes/direct')
  await expectHrefs(page, sandboxHrefs)
  await expect(page.getByTestId('section-nav').locator('[aria-current="page"]')).toHaveAttribute('href', '/sandboxes/expr')

  await page.goto('/docs')
  const install = await page.getByTestId('page-main').locator('a[href$="/install"]').evaluateAll(nodes => nodes.map(node => node.getAttribute('href')))
  await expectHrefs(page, ['/docs', '/install', ...install])
  await expect(page.getByTestId('section-nav').locator('[aria-current="page"]')).toHaveAttribute('href', '/docs')

  await page.goto('/docs/go/install')
  await expectHrefs(page, ['/docs', '/install', ...install])
  await expect(page.getByTestId('section-nav').locator('[aria-current="page"]')).toHaveAttribute('href', '/docs/go/install')

  await page.goto('/install')
  await expect(page.getByTestId('section-nav').locator('[aria-current="page"]')).toHaveAttribute('href', '/install')
})

test('no empty column', async ({ page }) => {
  await page.setViewportSize({ width: 1600, height: 900 })
  await page.goto('/')
  await expect(page.getByRole('heading', { level: 1, name: 'Thue++' })).toBeVisible()
  await expect(page.getByTestId('section-nav')).toHaveCount(0)
  await expect(page.getByTestId('section-toggle')).toHaveCount(0)
  await expect(page.getByTestId('page-sidebar')).toHaveCount(0)
  await expect(page.getByTestId('contents-toggle')).toHaveCount(0)
  await page.goto('/playground')
  await expect(page.getByRole('heading', { level: 1, name: 'This page is not here.' })).toBeVisible()
  await expect(page.getByTestId('section-nav')).toHaveCount(0)
  await expect(page.getByTestId('section-toggle')).toHaveCount(0)
  await expect(page.locator('#on-this-page')).toHaveCount(0)
  await expect(page.getByTestId('page-sidebar')).toBeHidden()
  await expect(page.getByTestId('contents-toggle')).toBeHidden()
})

test('content stays wide', async ({ page }) => {
  await page.setViewportSize({ width: 1600, height: 900 })
  await page.goto('/problems/factorial')
  const wide = await page.getByTestId('page-main').boundingBox()
  const wideExpected = await page.evaluate(() => {
    const shell = document.querySelector('[data-test="page-main"]')?.parentElement
    const pad = shell ? parseFloat(getComputedStyle(shell).paddingLeft) + parseFloat(getComputedStyle(shell).paddingRight) : 0
    const root = parseFloat(getComputedStyle(document.documentElement).fontSize)
    return 1180 - pad - 11 * root - 2.5 * root
  })
  expect(wide).toBeTruthy()
  expect(wide!.width).toBeGreaterThanOrEqual(wideExpected - 1)
  expect(Math.abs(wide!.x + wide!.width / 2 - 800)).toBeLessThan(12)

  await page.goto('/docs')
  const narrow = await page.getByTestId('page-main').boundingBox()
  const narrowExpected = await page.evaluate(() => {
    const shell = document.querySelector('[data-test="page-main"]')?.parentElement
    const pad = shell ? parseFloat(getComputedStyle(shell).paddingLeft) + parseFloat(getComputedStyle(shell).paddingRight) : 0
    const probe = document.createElement('div')
    probe.style.cssText = 'position:absolute;width:65ch;visibility:hidden'
    document.body.appendChild(probe)
    const column = probe.getBoundingClientRect().width
    probe.remove()
    return column - pad
  })
  expect(narrow).toBeTruthy()
  expect(narrow!.width).toBeGreaterThanOrEqual(narrowExpected - 1)
  expect(Math.abs(narrow!.x + narrow!.width / 2 - 800)).toBeLessThan(12)
})

test('mobile menus', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  for (const path of pages) {
    await page.goto(path)
    await expect(page.getByTestId('section-nav')).toBeHidden()
    await expect(page.getByTestId('page-sidebar')).toBeHidden()
    await expect(page.getByTestId('section-toggle')).toBeVisible()
    await expect(page.getByTestId('contents-toggle')).toBeVisible()
    await noHorizontalScroll(page)
    await page.getByTestId('section-toggle').click()
    await expect(page.getByTestId('section-nav')).toBeVisible()
    await page.getByTestId('contents-toggle').click()
    await expect(page.locator('#on-this-page')).toBeVisible()
    const navBox = await page.getByTestId('section-nav').boundingBox()
    const tocBox = await page.locator('#on-this-page').boundingBox()
    const mainBox = await page.getByTestId('page-main').boundingBox()
    expect(navBox && tocBox && mainBox).toBeTruthy()
    expect(navBox!.y + navBox!.height).toBeLessThanOrEqual(tocBox!.y + 1)
    expect(tocBox!.y + tocBox!.height).toBeLessThanOrEqual(mainBox!.y + 1)
    const navRight = navBox!.x + navBox!.width
    const tocRight = tocBox!.x + tocBox!.width
    const mainRight = mainBox!.x + mainBox!.width
    expect(Math.max(navRight, tocRight, mainRight)).toBeLessThanOrEqual(390)
    await noHorizontalScroll(page)
  }
})

test('nav click and anchor', async ({ page }) => {
  await page.setViewportSize({ width: 1600, height: 900 })
  await page.goto('/problems/factorial')
  const other = catalog.problems.find(problem => problem.id !== 'factorial')
  expect(other).toBeTruthy()
  await page.getByTestId('section-nav').getByRole('link', { name: other!.title, exact: true }).click()
  await expect(page).toHaveURL(new RegExp(`${other!.path}$`))
  await expect(page.getByTestId('section-nav').locator('[aria-current="page"]')).toHaveAttribute('href', other!.path)

  await page.goto('/problems/factorial')
  await page.getByTestId('page-sidebar').getByRole('link', { name: 'Solutions', exact: true }).click()
  await expect(page).toHaveURL(/\/problems\/factorial#solutions$/)
  await expect(page.locator('#solutions')).toBeInViewport()

  await page.goto('/sandboxes/expr')
  await page.getByTestId('page-sidebar').getByRole('link', { name: 'Examples', exact: true }).click()
  await expect(page).toHaveURL(/\/sandboxes\/expr#examples$/)
  await expect(page.locator('#examples')).toBeInViewport()
  await expect(page.getByTestId('page-sidebar').getByRole('link', { name: 'Examples', exact: true })).toHaveAttribute('aria-current', 'location')

  await page.goto('/sandboxes/expr')
  const forth = catalog.sandboxes.find(sandbox => sandbox.id === 'forth')
  expect(forth).toBeTruthy()
  await page.getByTestId('section-nav').getByRole('link', { name: forth!.name, exact: true }).click()
  await expect(page).toHaveURL(/\/sandboxes\/forth$/)
  await expect(page.getByTestId('section-nav').locator('[aria-current="page"]')).toHaveAttribute('href', '/sandboxes/forth')

  await page.goto('/docs/go/install')
  await page.getByTestId('section-nav').getByRole('link', { name: 'Python', exact: true }).click()
  await expect(page).toHaveURL(/\/docs\/python\/install$/)
  await expect(page.getByTestId('section-nav').locator('[aria-current="page"]')).toHaveAttribute('href', '/docs/python/install')
  await page.getByTestId('page-sidebar').getByRole('link', { name: 'CLI', exact: true }).click()
  await expect(page).toHaveURL(/\/docs\/python\/install#cli$/)
  await expect(page.locator('#cli')).toBeInViewport()
})
