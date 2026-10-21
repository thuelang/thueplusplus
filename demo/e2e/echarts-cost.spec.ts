import { expect, test } from '@playwright/test'

async function hideSeries(page: import('@playwright/test').Page, id: string) {
  const button = page.locator(`[data-test="cost-legend"] [data-series="${id}"]`)
  await expect(button).toHaveAttribute('aria-pressed', 'true')
  const before = await page.locator('[data-test="cost-chart"] svg path').count()
  await button.click()
  await expect(button).toHaveAttribute('aria-pressed', 'false')
  await expect.poll(async () => page.locator('[data-test="cost-chart"] svg path').count()).toBeLessThan(before)
}

function symbol(root: import('@playwright/test').Locator) {
  return root.locator('svg path[d^="M1 0A1"]')
}

async function expectSi(text: string) {
  expect(text).toMatch(/\d(?:\.\d+)?[kMGT]/)
  expect(text).not.toMatch(/\d,\d{3}/)
}

function axisText(page: import('@playwright/test').Page) {
  return page.locator('[data-test="cost-chart"] svg text').allTextContents()
}

async function openHomeTooltip(page: import('@playwright/test').Page) {
  await symbol(page.locator('[data-test="cost-chart"]')).last().hover()
  const tip = page.locator('.cost-tip')
  await expect(tip).toBeVisible()
  await expect(tip.locator('a[href*="/blob/"]')).toHaveCount(0)
  await expect(tip.locator('a[href*="/commit/"]')).toHaveCount(1)
  await expect(tip.locator('a[href*="/commit/"]')).toHaveAttribute('href', /\/commit\/[0-9a-f]{40}$/)
  await expect(tip).toContainText(/View commit [0-9a-f]{7}/)
  await expect(tip).toContainText(/Cost /)
}

async function openSolutionTooltip(page: import('@playwright/test').Page) {
  await symbol(page.locator('[data-test="cost-chart"]')).last().hover()
  const link = page.locator('.cost-tip a[href*="github.com/thuelang/thueplusplus/blob/"]')
  await expect(link.first()).toBeVisible()
  await expect(link.first()).toHaveAttribute('href', /\/blob\/[0-9a-f]{40}\/problems\/.+\/solutions\/.+\/\d{4}-\d{2}-\d{2}_\d{2}-\d{2}-\d{2}\/[^/]+$/)
  await expect(page.locator('.cost-tip a[href*="github.com/thuelang/thueplusplus/commit/"]').first()).toHaveAttribute('href', /\/commit\/[0-9a-f]{40}$/)
  await expect(page.locator('.cost-tip')).toContainText('View solution')
  await expect(page.locator('.cost-tip')).toContainText(/View commit [0-9a-f]{7}/)
}

test('home chart toggles series, scale, and a linked tooltip', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 })
  await page.goto('/')
  await expect(page.getByRole('heading', { level: 2, name: 'Cost (lower is better)' })).toBeVisible()
  await expect(page.getByTestId('cost-summary')).toContainText('cumulative cost of the problems that have solutions in all sandboxes')
  await expect(page.getByTestId('cost-chart')).toHaveAttribute('data-scale', 'linear')
  await expect(page.getByTestId('cost-chart')).toHaveAttribute('data-x', 'date')
  await expect(page.getByTestId('cost-legend')).toContainText('Direct Thue')
  await expectSi(await page.getByTestId('cost-legend').innerText())
  const linearAxis = (await axisText(page)).join(' ')
  expect(linearAxis).toMatch(/\d/)
  expect(linearAxis).not.toMatch(/\d,\d{3}/)
  expect(linearAxis).not.toMatch(/\d\.\d*0[kMGT]/)
  await hideSeries(page, 'forth')
  await page.getByTestId('y-log').click()
  await expect(page.getByTestId('cost-chart')).toHaveAttribute('data-scale', 'log')
  await expect(page.getByTestId('y-log')).toHaveAttribute('aria-pressed', 'true')
  const logAxis = (await axisText(page)).join(' ')
  expect(logAxis).toMatch(/\d/)
  expect(logAxis).not.toMatch(/\d,\d{3}/)
  expect(logAxis).not.toMatch(/\d\.\d*0[kMGT]/)
  await page.getByTestId('x-index').click()
  await expect(page.getByTestId('cost-chart')).toHaveAttribute('data-x', 'index')
  await expect(page.getByTestId('x-index')).toHaveAttribute('aria-pressed', 'true')
  await openHomeTooltip(page)
  const tip = page.locator('.cost-tip')
  await expect(tip).not.toContainText('Hello world')
  await expectSi(await tip.innerText())
  await expect(tip.locator('a[href*="/blob/"]')).toHaveCount(0)
  await expect(page.getByTestId('improvements')).toContainText('Direct Thue')
  await expect(page.locator('a[href="/sandboxes/direct"]')).toHaveCount(0)
})

test('leap-year chart toggles series, scale, and a linked tooltip', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 })
  await page.goto('/problems/leap-year')
  await expect(page.getByRole('heading', { level: 1, name: 'Leap year' })).toBeVisible()
  await expect(page.getByTestId('cost-chart')).toHaveAttribute('data-scale', 'linear')
  await expect(page.getByTestId('cost-chart')).toHaveAttribute('data-x', 'date')
  await expect(page.getByTestId('cost-legend')).toContainText('Direct Thue')
  await expectSi(await page.getByTestId('cost-legend').innerText())
  await hideSeries(page, 'lisp')
  await page.getByTestId('y-log').click()
  await expect(page.getByTestId('cost-chart')).toHaveAttribute('data-scale', 'log')
  const logAxis = (await page.locator('[data-test="cost-chart"] svg text').allTextContents()).join(' ')
  expect(logAxis).toMatch(/\d/)
  expect(logAxis).not.toMatch(/\d,\d{3}/)
  expect(logAxis).not.toMatch(/\d\.\d*0[kMGT]/)
  await page.getByTestId('x-index').click()
  await expect(page.getByTestId('cost-chart')).toHaveAttribute('data-x', 'index')
  await openSolutionTooltip(page)
  const tip = page.locator('.cost-tip')
  await expect(tip).not.toContainText('Leap year')
  await expectSi(await tip.innerText())
})

test('problem cards chart cost without scale toggles', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 })
  await page.goto('/problems')
  const leap = page.getByTestId('problem-card').filter({ has: page.getByRole('heading', { name: 'Leap year' }) })
  await expect(leap.getByTestId('card-chart')).toBeVisible()
  await expect(leap.getByTestId('y-log')).toHaveCount(0)
  await expect(leap.getByTestId('x-index')).toHaveCount(0)
  await symbol(leap.locator('[data-test="card-chart"]')).last().click()
  await expect(page.locator('.cost-tip a[href*="github.com/thuelang/thueplusplus/blob/"]').first()).toBeVisible()
  const cardLegend = await leap.getByTestId('cost-legend').innerText()
  expect(cardLegend).toMatch(/\d(?:\.\d+)?[kMGT]|\b\d{1,3}\b/)
  expect(cardLegend).not.toMatch(/\d,\d{3}/)
})
