import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router'

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
import DocsPage from './pages/DocsPage.vue'
import EmbedPage from './pages/EmbedPage.vue'
import HomePage from './pages/HomePage.vue'
import HostDocPage from './pages/HostDocPage.vue'
import InstallPage from './pages/InstallPage.vue'
import NotFoundPage from './pages/NotFoundPage.vue'
import ProblemPage from './pages/ProblemPage.vue'
import ProblemsPage from './pages/ProblemsPage.vue'
import SandboxPage from './pages/SandboxPage.vue'
import SandboxesPage from './pages/SandboxesPage.vue'
import { siteHosts } from './hosts'
import { pages } from './site'

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
    scrollBehavior(to, _from, saved) {
      if (saved) return saved
      if (to.hash) return { el: to.hash, top: 72 }
      return { top: 0 }
    },
  })
  router.beforeEach((to) => {
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
      } else if (sandbox.status === 'pending') {
        to.meta.documentTitle = `Thue++ ${sandbox.name}`
        to.meta.description = 'In progress.'
        to.meta.canonical = `https://thuelang.org/sandboxes/${sandbox.id}`
        to.meta.robots = 'index,follow'
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
  })
  return router
}
