import { expect, test } from '@playwright/test'

test('leap-year chart includes a Direct Thue line and label', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 })
  await page.goto('/problems/leap-year')
  await expect(page.getByRole('heading', { level: 1, name: 'Leap year' })).toBeVisible()
  await expect(page.getByTestId('cost-chart')).toHaveAttribute('data-scale', 'linear')
  await expect(page.getByTestId('cost-legend')).toContainText('Direct Thue')
  await expect(page.locator('[data-test="end-label"][data-sandbox="direct"]')).toHaveText(/Direct Thue [\d,]+/)
  await expect(page.getByTestId('rex-scene')).toHaveCount(0)
})

test('problem cards mark Direct Thue', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 })
  await page.goto('/problems')
  const leap = page.getByTestId('problem-card').filter({ has: page.getByRole('heading', { name: 'Leap year' }) })
  await expect(leap.locator('[data-sandbox="direct"]')).toContainText('Direct Thue')
  const fibonacci = page.getByTestId('problem-card').filter({ has: page.getByRole('heading', { name: 'Fibonacci sequence' }) })
  await expect(fibonacci.locator('[data-sandbox="direct"]')).toContainText('Direct Thue')
  await expect(fibonacci.locator('[data-test="card-chart"] [data-sandbox]')).toHaveCount(1)
})
