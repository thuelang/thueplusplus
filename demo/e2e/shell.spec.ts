import { expect, test, type Page } from '@playwright/test'

const viewports = [
  { name: '390', width: 390, height: 844 },
  { name: '768', width: 768, height: 1024 },
  { name: '1024', width: 1024, height: 768 },
  { name: '1440', width: 1440, height: 900 },
]

async function expectHeader(page: Page, current: string): Promise<void> {
  const nav = page.getByTestId('site-nav')
  const links = nav.getByRole('link')
  await expect(links).toHaveCount(4)
  await expect(links.nth(0)).toHaveText('Sandboxes')
  await expect(links.nth(0)).toHaveAttribute('href', '/sandboxes')
  await expect(links.nth(1)).toHaveText('Problems')
  await expect(links.nth(1)).toHaveAttribute('href', '/problems')
  await expect(links.nth(2)).toHaveText('Install')
  await expect(links.nth(2)).toHaveAttribute('href', '/install')
  await expect(links.nth(3)).toHaveText('Docs')
  await expect(links.nth(3)).toHaveAttribute('href', '/docs')
  await expect(nav.getByRole('button')).toHaveCount(0)
  await expect(page.getByTestId('menu-toggle')).toHaveCount(0)
  await expect(page.getByTestId('theme-toggle')).toBeVisible()
  await expect(page.getByTestId('site-header').getByRole('link', { name: 'github' })).toHaveCount(0)
  await expect(nav.getByRole('link', { name: current })).toHaveAttribute('aria-current', 'page')
}

for (const viewport of viewports) {
  test(`${viewport.name} docs page uses the docs shell`, async ({ page }) => {
    await page.setViewportSize({ width: viewport.width, height: viewport.height })
    await page.goto('/docs')
    await expect(page.getByTestId('app-shell')).toBeVisible()
    await expect(page.getByTestId('page-hero')).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Docs.' })).toBeVisible()
    await expect(page.getByTestId('page-details')).toBeVisible()
    await expect(page.locator('html')).toHaveClass(/dark/)
    await expect(page.getByTestId('github-link')).toBeVisible()
    await expectHeader(page, 'Docs')
    if (viewport.width >= 1024) {
      await expect(page.getByTestId('page-sidebar')).toBeVisible()
      await expect(page.getByTestId('page-sidebar').getByRole('link', { name: 'Go' })).toHaveAttribute('aria-current', 'location')
      await expect(page.getByTestId('contents-toggle')).toBeHidden()
      return
    }
    await expect(page.getByTestId('page-sidebar')).toBeHidden()
    await page.getByTestId('contents-toggle').click()
    await expect(page.getByTestId('page-sidebar').getByRole('link', { name: 'Go' })).toBeVisible()
    await page.getByTestId('contents-toggle').click()
    await expect(page.getByTestId('page-sidebar')).toBeHidden()
  })

  test(`${viewport.name} switches dark and light`, async ({ page }) => {
    await page.setViewportSize({ width: viewport.width, height: viewport.height })
    await page.goto('/docs')
    await expect(page.locator('html')).toHaveClass(/dark/)
    await expect(page.getByTestId('theme-toggle')).toHaveAttribute('aria-label', 'Dark theme')
    await page.getByTestId('theme-toggle').click()
    await page.getByTestId('theme-toggle').click()
    await expect(page.getByTestId('theme-toggle')).toHaveAttribute('aria-label', 'Light theme')
    await expect(page.locator('html')).not.toHaveClass(/dark/)
    await expect(page.getByRole('heading', { name: 'Docs.' })).toBeVisible()
    await page.getByTestId('theme-toggle').click()
    await expect(page.getByTestId('theme-toggle')).toHaveAttribute('aria-label', 'Dark theme')
    await expect(page.locator('html')).toHaveClass(/dark/)
  })
}

test('home keeps the landing copy and stays dark by default', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/')
  await expect(page.locator('html')).toHaveClass(/dark/)
  await expect(page.getByRole('heading', { level: 1, name: 'Thue++' })).toBeVisible()
  await expect(page.getByText('The safest, smallest, sandbox.')).toBeVisible()
  await expect(page.getByTestId('landing-languages')).toContainText('Available in python, go, js, wasm, rust, cpp, ruby, csharp, java')
  await expect(page.getByTestId('sandbox-scene')).toBeVisible()
  await expect(page.getByTestId('your-turn')).toHaveCount(0)
  await expect(page.getByTestId('hero-install')).toHaveAttribute('href', '/install')
  await expect(page.getByTestId('hero-sandboxes')).toHaveAttribute('href', '/sandboxes')
  await expect(page.getByTestId('hero-problems')).toHaveAttribute('href', '/problems')
  await expect(page.getByTestId('featured-sandboxes')).toBeVisible()
  await expect(page.getByTestId('cost-chart')).toBeVisible()
  await expect(page.getByTestId('sandbox-scene')).toHaveAttribute('data-control', 'auto')
  await expect(page.locator('body')).not.toContainText(/RE2/)
})

test('embed has no site chrome', async ({ page }) => {
  await page.goto('/embed?file=./examples/hello/hello.thue&section=state')
  await expect(page.getByTestId('app-shell')).toHaveCount(0)
  await expect(page.getByTestId('contents-toggle')).toHaveCount(0)
  await expect(page.getByTestId('playground-workbench')).toBeVisible()
  await expect(page.getByTestId('page-hero')).toHaveCount(0)
})

test('scroll spy highlights the section in view', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 640 })
  await page.goto('/docs/go/install')
  const sidebar = page.getByTestId('page-sidebar')
  await expect(sidebar.getByRole('link', { name: 'Install' })).toHaveAttribute('aria-current', 'location')
  await page.evaluate(() => {
    const heading = document.getElementById('cli')
    if (!heading) throw new Error('missing cli')
    const top = heading.getBoundingClientRect().top + window.scrollY
    window.scrollTo(0, Math.max(0, top - 80))
  })
  await expect(sidebar.getByRole('link', { name: 'CLI' })).toHaveAttribute('aria-current', 'location')
  await expect(sidebar.getByRole('link', { name: 'Install', exact: true })).not.toHaveAttribute('aria-current', 'location')
})

test('deep links render their own heading', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  for (const [path, heading] of [
    ['/sandboxes', 'Sandboxes.'],
    ['/problems', 'Problems.'],
    ['/install', 'Install a host.'],
    ['/docs', 'Docs.'],
    ['/docs/go/install', 'Go.'],
    ['/docs/go/api', 'Go API.'],
    ['/docs/go/examples', 'Go examples.'],
    ['/sandboxes/expr', 'Expr.'],
  ] as const) {
    await page.goto(path)
    await expect(page.getByRole('heading', { level: 1, name: heading })).toBeVisible()
  }
  for (const path of ['/playground', '/projects', '/metrics', '/contribute', '/docs/guides', '/install/go', '/rulesets/direct']) {
    await page.goto(path)
    await expect(page.getByRole('heading', { level: 1, name: 'This page is not here.' })).toBeVisible()
  }
})
