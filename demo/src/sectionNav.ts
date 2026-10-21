import { catalog } from './catalog'
import { siteHosts } from './hosts'
import { routes } from './router'
import { pages } from './site'

export interface SectionLink {
  title: string
  href: string
}

export interface PageSection {
  label: string
  links: SectionLink[]
}

function routeExists(path: string): boolean {
  return routes.some(route => route.path === path)
}

function hasChildRoute(path: string): boolean {
  return routes.some(route => route.path.startsWith(`${path}/`))
}

function problemSection(): PageSection | null {
  if (!routeExists(pages.problems.path) || !hasChildRoute(pages.problems.path)) return null
  return {
    label: pages.problems.kicker,
    links: [
      { title: pages.problems.kicker, href: pages.problems.path },
      ...catalog.problems.map(problem => ({ title: problem.title, href: problem.path })),
    ],
  }
}

function sandboxSection(): PageSection | null {
  if (!routeExists(pages.sandboxes.path) || !hasChildRoute(pages.sandboxes.path)) return null
  return {
    label: pages.sandboxes.kicker,
    links: [
      { title: pages.sandboxes.kicker, href: pages.sandboxes.path },
      ...catalog.sandboxes.map(sandbox => ({ title: sandbox.name, href: `/sandboxes/${sandbox.id}` })),
    ],
  }
}

function docsSection(): PageSection | null {
  if (!routeExists(pages.docs.path) || !routeExists(pages.install.path) || !hasChildRoute(pages.docs.path)) return null
  return {
    label: pages.docs.kicker,
    links: [
      { title: pages.docs.kicker, href: pages.docs.path },
      { title: pages.install.kicker, href: pages.install.path },
      ...siteHosts.map(host => ({ title: host.title, href: host.href })),
    ],
  }
}

export function sectionFor(path: string): PageSection | null {
  if (path === pages.problems.path || path.startsWith(`${pages.problems.path}/`)) return problemSection()
  if (path === pages.sandboxes.path || path.startsWith(`${pages.sandboxes.path}/`)) return sandboxSection()
  if (path === pages.docs.path || path === pages.install.path || path.startsWith(`${pages.docs.path}/`)) return docsSection()
  return null
}
