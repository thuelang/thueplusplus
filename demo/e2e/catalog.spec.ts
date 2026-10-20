import { expect, test } from '@playwright/test'

test('problems index shows a cost chart on every card', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 })
  await page.goto('/problems')
  await expect(page.getByRole('heading', { level: 1, name: 'Problems.' })).toBeVisible()
  await expect(page.getByTestId('page-hero-graphic')).toBeVisible()
  await expect(page.getByTestId('problem-card').first()).toBeVisible()
  await expect(page.getByTestId('problem-card').first().locator('svg')).toBeVisible()
  await expect(page.locator('body')).not.toContainText(/RE2/)
  await expect(page.locator('body')).not.toContainText(/\bguest\b/i)
})

test('a problem page charts cost and links the solutions', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 })
  await page.goto('/problems/factorial')
  await expect(page.getByRole('heading', { level: 1, name: 'Factorial' })).toBeVisible()
  await expect(page.getByTestId('cost-chart')).toBeVisible()
  await expect(page.getByTestId('cost-legend')).toContainText('direct')
  await expect(page.getByTestId('solutions-table')).toBeVisible()
  await expect(page.getByTestId('solution-link').first()).toHaveAttribute('href', /github\.com\/thuelang\/thueplusplus\/blob\/main\//)
  await expect(page.locator('body')).not.toContainText(/RE2/)
})

test('sandboxes index names the interpreters', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 })
  await page.goto('/sandboxes')
  await expect(page.getByRole('heading', { level: 1, name: 'Sandboxes.' })).toBeVisible()
  await expect(page.getByTestId('sandbox-index')).toContainText('Lisp')
  await expect(page.getByTestId('sandbox-index')).toContainText('Forth')
  await expect(page.getByTestId('sandbox-index')).toContainText('BASIC')
  await expect(page.getByTestId('sandbox-index')).toContainText('In progress.')
})

test('mobile problems page keeps the hero and the cards', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 })
  await page.goto('/problems')
  await expect(page.getByTestId('page-hero')).toBeVisible()
  await expect(page.getByTestId('problem-card').first()).toBeVisible()
  await expect(page.getByTestId('page-sidebar')).toBeHidden()
  await expect(page.getByTestId('site-nav').getByRole('link')).toHaveCount(4)
})
