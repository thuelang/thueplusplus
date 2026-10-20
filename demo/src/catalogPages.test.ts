import { describe, expect, it } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createMemoryHistory, createRouter } from 'vue-router'
import { routes } from './router'
import { catalog, problemRouteMeta, rulesetColor, runningBest, type CatalogPoint } from './catalog'
import { pageLinks } from './site'

async function mountAt(path: string) {
  const router = createRouter({ history: createMemoryHistory(), routes })
  await router.push(path)
  await router.isReady()
  const component = router.currentRoute.value.matched[0]?.components?.default
  if (!component) throw new Error(`no component for ${path}`)
  return mount(component, {
    global: { plugins: [router] },
  })
}

describe('running best', () => {
  it('holds the minimum cost after a version appears', () => {
    const points: CatalogPoint[] = [
      { commit: 'a', solution: 'direct.thue', cost: 10, steps: 1, regexEvals: 1, regexMatches: 1, stateBytes: 1, statePeak: 1, ruleCount: 1, ruleChars: 1 },
      { commit: 'a', solution: 'slow.thue', cost: 4, steps: 1, regexEvals: 1, regexMatches: 1, stateBytes: 1, statePeak: 1, ruleCount: 1, ruleChars: 1 },
      { commit: 'c', solution: 'direct.thue', cost: 3, steps: 1, regexEvals: 1, regexMatches: 1, stateBytes: 1, statePeak: 1, ruleCount: 1, ruleChars: 1 },
    ]
    expect(runningBest(['a', 'b', 'c'], points)).toEqual([4, 4, 3])
    expect(runningBest(['a', 'b'], [])).toEqual([undefined, undefined])
  })
})

describe('catalog pages', () => {
  it('checks the generated suite against its own rows', () => {
    expect(catalog.schemaVersion).toBe(3)
    expect(catalog.commit).toMatch(/^[0-9a-f]{40}$/)
    expect(catalog.problems.length).toBeGreaterThan(0)
    expect(catalog.commits.length).toBeGreaterThan(0)
    expect(catalog.rulesets.length).toBeGreaterThan(0)
    for (const problem of catalog.problems) {
      expect(problem.path).toBe(`/problems/${problem.id}`)
      expect(problem.canonical).toBe(`https://thuelang.org/problems/${problem.id}`)
      const direct = problem.versions.find(version => version.id === 'direct')
      expect(direct?.missing).toBe(false)
      expect(direct?.solutions.every(solution => solution.status === 'pass' || solution.status === 'fail')).toBe(true)
      expect(direct?.series.length).toBeGreaterThan(0)
    }
    expect(catalog.rulesets.every(ruleset => ruleset.color.startsWith('var(--chart-'))).toBe(true)
    expect(catalog.sandboxCommon.length).toBeGreaterThan(0)
    const listed = catalog.sandboxes.filter(sandbox => sandbox.status === 'ready' && sandbox.total !== null)
    expect(listed.length).toBeGreaterThan(0)
    for (const id of catalog.sandboxCommon) {
      expect(listed.every(sandbox => catalog.problems.find(problem => problem.id === id)?.versions.some(version => version.id === sandbox.id))).toBe(true)
    }
  })

  it('renders a problem index and one page per problem', async () => {
    const index = await mountAt('/problems')
    expect(index.get('h1').text()).toBe('Problems.')
    expect(index.findAll('[data-test="problem-card"]')).toHaveLength(catalog.problems.length)
    expect(index.get('[data-test="problem-card"]').find('svg').exists()).toBe(true)
    expect(index.text()).not.toContain('RE2')
    expect(index.text()).not.toMatch(/\bguest\b/i)

    const problem = catalog.problems.find(item => item.id === 'factorial')
    expect(problem).toBeTruthy()
    const page = await mountAt(problem!.path)
    await flushPromises()
    expect(page.get('h1').text()).toBe('Factorial')
    expect(page.get('[data-test="problem-description"]').text()).toContain('0!')
    const links = pageLinks(problem!.path).map(link => link.title)
    expect(links).toEqual(['Cost', 'Solutions'])
    expect(page.get('#cost').find('svg').exists()).toBe(true)
    expect(page.get('[data-test="cost-legend"]').text()).toContain('direct')
    expect(page.findAll('[data-test="time-label"]').length).toBeGreaterThan(0)
    const dots = page.findAll('[data-test="cost-dot"]').map(dot => ({
      x: Number(dot.attributes('cx')),
      y: Number(dot.attributes('cy')),
      sandbox: dot.attributes('data-sandbox'),
    }))
    for (let i = 0; i < dots.length; i += 1) {
      for (let j = i + 1; j < dots.length; j += 1) {
        if (dots[i].sandbox === dots[j].sandbox) continue
        expect(Math.hypot(dots[i].x - dots[j].x, dots[i].y - dots[j].y)).toBeGreaterThanOrEqual(9)
      }
    }
    const swatch = page.get('[data-test="cost-legend"]').find('[style]')
    expect(swatch.attributes('style')).toContain(rulesetColor('direct'))
    expect(page.get('[data-test="problem-credit"]').find('a').attributes('href')).toMatch(/^https:\/\//)
    const table = page.get('[data-test="solutions-table"]')
    expect(table.find('[data-sandbox="lisp"]').find('[data-test="solution-link"]').attributes('href')).toContain('github.com/thuelang/thueplusplus/blob/main/')
    await table.get('button[aria-sort="ascending"]').trigger('click')
    expect(table.get('button[aria-sort="descending"]').text()).toBe('Cost')
    expect(page.text()).not.toContain('RE2')
    expect(page.text()).not.toMatch(/\bguest\b/i)
  })

  it('says when a problem id is not in the suite', async () => {
    const wrapper = await mountAt('/problems/not-a-problem')
    expect(wrapper.get('h1').text()).toBe('This page is not here.')
    expect(problemRouteMeta('not-a-problem').robots).toBe('noindex,follow')
    const known = catalog.problems[0]
    expect(problemRouteMeta(known.id)).toEqual({
      documentTitle: known.documentTitle,
      description: known.summary,
      canonical: known.canonical,
      robots: 'index,follow',
    })
  })
})
