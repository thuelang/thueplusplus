import { nextTick, type Component } from 'vue'
import { createRouter, createWebHistory, isNavigationFailure, type RouteRecordRaw } from 'vue-router'
import { abortNavigation, beginNavigation, sealNavigation } from './navProgress'
import { trackedImport } from './trackedImport'

declare module 'vue-router' {
  interface RouteMeta {
    layout?: 'bare'
    documentTitle?: string
    description?: string
    canonical?: string
    robots?: string
  }
}
import { problemRouteMeta, sandboxById } from './catalog'
import { clearHashMark, hashScroll, noteHashNavigation, releaseHashLock, watchHashClicks } from './hashTarget'
import { siteHosts } from './hosts'
import { pages } from './site'

function lazy(id: string, loader: () => Promise<{ default: Component }>) {
  return () => trackedImport(id, loader)
}

const HomePage = lazy('src/pages/HomePage.vue', () => import('./pages/HomePage.vue'))
const SandboxesPage = lazy('src/pages/SandboxesPage.vue', () => import('./pages/SandboxesPage.vue'))
const ProblemsPage = lazy('src/pages/ProblemsPage.vue', () => import('./pages/ProblemsPage.vue'))
const InstallPage = lazy('src/pages/InstallPage.vue', () => import('./pages/InstallPage.vue'))
const DocsPage = lazy('src/pages/DocsPage.vue', () => import('./pages/DocsPage.vue'))
const EmbedPage = lazy('src/pages/EmbedPage.vue', () => import('./pages/EmbedPage.vue'))
const SandboxPage = lazy('src/pages/SandboxPage.vue', () => import('./pages/SandboxPage.vue'))
const ProblemPage = lazy('src/pages/ProblemPage.vue', () => import('./pages/ProblemPage.vue'))
const HostDocPage = lazy('src/pages/HostDocPage.vue', () => import('./pages/HostDocPage.vue'))
const NotFoundPage = lazy('src/pages/NotFoundPage.vue', () => import('./pages/NotFoundPage.vue'))

const shell = [
  { page: pages.home, component: HomePage },
  { page: pages.sandboxes, component: SandboxesPage },
  { page: pages.problems, component: ProblemsPage },
  { page: pages.install, component: InstallPage },
  { page: pages.docs, component: DocsPage },
]

const missing = {
  documentTitle: 'Page not found — Thue++',
  description: 'That address is not on this site.',
  canonical: 'https://thuelang.org/',
  robots: 'noindex,follow',
}

export const routes: RouteRecordRaw[] = [
  ...shell.map(({ page, component }): RouteRecordRaw => ({
    path: page.path,
    component,
    meta: {
      documentTitle: page.documentTitle,
      description: page.description,
      canonical: page.canonical,
      robots: page.robots,
    },
  })),
  {
    path: '/embed',
    component: EmbedPage,
    meta: {
      layout: 'bare',
      documentTitle: 'Thue++ Embed',
      description: 'Embeddable Thue++ playground surface.',
      canonical: 'https://thuelang.org/embed',
      robots: 'noindex,follow',
    },
  },
  {
    path: '/sandboxes/:sandboxId',
    component: SandboxPage,
  },
  {
    path: '/problems/:problemId',
    component: ProblemPage,
  },
  {
    path: '/docs/:hostId/:section',
    component: HostDocPage,
  },
  {
    path: '/:pathMatch(.*)*',
    name: 'not-found',
    component: NotFoundPage,
    meta: missing,
  },
]

export function createAppRouter() {
  const router = createRouter({
    history: createWebHistory(),
    routes,
    async scrollBehavior(to, _from, saved) {
      if (to.hash) return hashScroll(to.hash)
      clearHashMark()
      if (saved) return saved
      return { top: 0 }
    },
  })
  watchHashClicks(router)
  router.beforeEach((to, from) => {
    if (to.hash) noteHashNavigation(to.hash)
    else releaseHashLock()
    const problemId = to.params.problemId
    if (typeof problemId === 'string') {
      const meta = problemRouteMeta(problemId)
      to.meta.documentTitle = meta.documentTitle
      to.meta.description = meta.description
      to.meta.canonical = meta.canonical
      to.meta.robots = meta.robots
    }
    const sandboxId = to.params.sandboxId
    if (typeof sandboxId === 'string') {
      const sandbox = sandboxById(sandboxId)
      if (!sandbox) {
        Object.assign(to.meta, missing)
      } else {
        to.meta.documentTitle = `Thue++ ${sandbox.name}`
        to.meta.description = sandbox.description
        to.meta.canonical = `https://thuelang.org/sandboxes/${sandbox.id}`
        to.meta.robots = 'index,follow'
      }
    }
    const hostId = to.params.hostId
    const section = to.params.section
    if (typeof hostId === 'string' && typeof section === 'string') {
      const host = siteHosts.find(item => item.id === hostId)
      const label = section === 'install' ? 'Install' : section === 'api' ? 'API' : section === 'examples' ? 'Examples' : ''
      if (!host || !label) {
        Object.assign(to.meta, missing)
      } else {
        to.meta.documentTitle = `Thue++ ${label} — ${host.title}`
        to.meta.description = section === 'install' ? `Install the ${host.title} host.` : section === 'api' ? `The ${host.title} embedding API.` : `A ${host.title} library example.`
        to.meta.canonical = `https://thuelang.org/docs/${host.id}/${section}`
        to.meta.robots = 'index,follow'
      }
    }
    if (to.path.length > 1 && to.path.endsWith('/')) {
      return { path: to.path.replace(/\/+$/, ''), query: to.query, hash: to.hash, replace: true }
    }
    if (from.matched.length === 0 || to.fullPath !== from.fullPath) beginNavigation()
  })
  router.afterEach((_to, _from, failure) => {
    if (isNavigationFailure(failure)) {
      abortNavigation()
      return
    }
    void (async () => {
      await nextTick()
      await nextTick()
      sealNavigation()
    })()
  })
  router.onError(() => {
    abortNavigation()
  })
  return router
}
