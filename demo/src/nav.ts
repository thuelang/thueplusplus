export interface SiteLink {
  title: string
  to: string
}

export const headerLinks: SiteLink[] = [
  { title: 'Sandboxes', to: '/sandboxes' },
  { title: 'Problems', to: '/problems' },
  { title: 'Install', to: '/install' },
  { title: 'Docs', to: '/docs' },
]

export const footerLinks: SiteLink[] = []

export function headerLinkCurrent(path: string, to: string): boolean {
  return path === to || path.startsWith(`${to}/`)
}
