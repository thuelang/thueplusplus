import { describe, expect, it } from 'vitest'
import { catalog } from '@/catalog'
import { siteHosts } from '@/hosts'
import { routes } from '@/router'
import { sectionFor } from '@/sectionNav'
import { pages } from '@/site'

describe('section nav', () => {
  it('lists catalog problems plus the overview', () => {
    const links = sectionFor('/problems/factorial')?.links
    expect(links?.map(link => link.href)).toEqual([
      pages.problems.path,
      ...catalog.problems.map(problem => problem.path),
    ])
    expect(links?.map(link => link.title)).toEqual([
      pages.problems.kicker,
      ...catalog.problems.map(problem => problem.title),
    ])
    expect(sectionFor('/problems')?.links.map(link => link.href)).toEqual(links?.map(link => link.href))
  })

  it('lists sandbox guides and includes Direct Thue only when it has a page', () => {
    const links = sectionFor('/sandboxes/expr')?.links ?? []
    expect(links.map(link => link.href)).toEqual([
      pages.sandboxes.path,
      ...catalog.sandboxes.map(sandbox => `/sandboxes/${sandbox.id}`),
    ])
    expect(links.map(link => link.title)).toEqual([
      pages.sandboxes.kicker,
      ...catalog.sandboxes.map(sandbox => sandbox.name),
    ])
    expect(sectionFor('/sandboxes')?.links).toEqual(links)
    const directPage = catalog.sandboxes.some(sandbox => sandbox.id === 'direct')
      || routes.some(route => route.path === '/sandboxes/direct')
    if (!directPage) {
      expect(links.some(link => link.href === '/sandboxes/direct' || link.title === 'Direct Thue')).toBe(false)
    } else {
      expect(links.some(link => link.href === '/sandboxes/direct')).toBe(true)
    }
  })

  it('lists docs and install pages from the host registry', () => {
    const expected = [
      { title: pages.docs.kicker, href: pages.docs.path },
      { title: pages.install.kicker, href: pages.install.path },
      ...siteHosts.map(host => ({ title: host.title, href: host.href })),
    ]
    for (const path of ['/docs', '/install', '/docs/go/install', '/docs/go/api', '/docs/python/examples']) {
      expect(sectionFor(path)?.links).toEqual(expected)
    }
    expect(siteHosts.every(host => host.href === `/docs/${host.id}/install`)).toBe(true)
  })

  it('returns no section for home, embed, and a missing page', () => {
    expect(sectionFor('/')).toBeNull()
    expect(sectionFor('/embed')).toBeNull()
    expect(sectionFor('/playground')).toBeNull()
  })
})
