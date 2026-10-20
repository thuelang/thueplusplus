declare module 'virtual:asset-sizes' {
  export const assetSizes: Record<string, { href: string, bytes: number | null }[]> | null
}
