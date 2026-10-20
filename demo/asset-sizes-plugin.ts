import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative, sep } from 'node:path'
import type { OutputBundle, OutputChunk, Plugin } from 'vite'

const virtualId = 'virtual:asset-sizes'
const resolvedId = '\0virtual:asset-sizes'
const marker = 'globalThis.__ASSET_SIZES_PLACEHOLDER__'

interface AssetFile {
  href: string
  bytes: number
}

function sourceLength(source: string | Uint8Array): number {
  return typeof source === 'string' ? Buffer.byteLength(source) : source.byteLength
}

function toKey(root: string, moduleId: string): string | null {
  if (moduleId.startsWith('\0') || moduleId.includes('node_modules')) return null
  const clean = moduleId.split('?')[0] ?? moduleId
  const key = relative(root, clean).split(sep).join('/')
  if (!key.startsWith('src/') || key.startsWith('../')) return null
  return key
}

function filesOf(chunk: OutputChunk, bundle: OutputBundle, seen: Set<string>, dynamic: boolean): AssetFile[] {
  if (seen.has(chunk.fileName)) return []
  seen.add(chunk.fileName)
  const files: AssetFile[] = [{ href: `/${chunk.fileName}`, bytes: Buffer.byteLength(chunk.code) }]
  for (const name of chunk.viteMetadata?.importedCss ?? []) {
    const asset = bundle[name]
    if (!asset || asset.type !== 'asset') throw new Error(`asset sizes: missing css ${name}`)
    files.push({ href: `/${name}`, bytes: sourceLength(asset.source) })
  }
  for (const imported of chunk.imports) {
    const child = bundle[imported]
    if (!child || child.type !== 'chunk') throw new Error(`asset sizes: missing import ${imported}`)
    if (child.isEntry) continue
    files.push(...filesOf(child, bundle, seen, false))
  }
  if (!dynamic) return files
  for (const imported of chunk.dynamicImports) {
    const child = bundle[imported]
    if (!child || child.type !== 'chunk') throw new Error(`asset sizes: missing dynamic import ${imported}`)
    if (child.isEntry) continue
    files.push(...filesOf(child, bundle, seen, true))
  }
  return files
}

function collect(root: string, bundle: OutputBundle): Record<string, AssetFile[]> {
  const shared = new Set<string>()
  for (const output of Object.values(bundle)) {
    if (output.type === 'chunk' && output.isEntry) {
      for (const file of filesOf(output, bundle, new Set(), false)) shared.add(file.href)
    }
  }
  const sizes: Record<string, AssetFile[]> = {}
  for (const output of Object.values(bundle)) {
    if (output.type !== 'chunk' || output.isEntry) continue
    const files = filesOf(output, bundle, new Set(), true).filter(file => !shared.has(file.href))
    if (files.length === 0) continue
    for (const moduleId of output.moduleIds) {
      const key = toKey(root, moduleId)
      if (!key) continue
      const list = sizes[key] ?? []
      for (const file of files) {
        if (!list.some(item => item.href === file.href)) list.push(file)
      }
      sizes[key] = list
    }
  }
  return sizes
}

function requiredIds(root: string): string[] {
  const ids = new Set<string>()
  const pattern = /(?:trackedImport|lazyComponent)\(\s*'([^']+)'/g
  walk(join(root, 'src'))
  return [...ids]

  function walk(dir: string): void {
    for (const name of readdirSync(dir)) {
      const path = join(dir, name)
      if (statSync(path).isDirectory()) {
        if (name !== 'generated') walk(path)
        continue
      }
      if (!name.endsWith('.ts') && !name.endsWith('.vue')) continue
      const text = readFileSync(path, 'utf8')
      for (const match of text.matchAll(pattern)) {
        const id = match[1]
        if (id) ids.add(id)
      }
    }
  }
}

export function assetSizesPlugin(): Plugin {
  let root = ''
  return {
    name: 'asset-sizes',
    configResolved(config) {
      root = config.root
    },
    resolveId(id) {
      if (id === virtualId) return resolvedId
    },
    load(id) {
      if (id !== resolvedId) return
      if (this.environment.config.command !== 'build') return 'export const assetSizes = null\n'
      return `export const assetSizes = ${marker}\n`
    },
    generateBundle(_options, bundle) {
      if (this.environment.config.command !== 'build') return
      const sizes = collect(root, bundle)
      const missing = requiredIds(root).filter(id => !sizes[id]?.length)
      if (missing.length > 0) throw new Error(`asset sizes: no emitted chunk for ${missing.join(', ')}`)
      const json = JSON.stringify(sizes)
      let replaced = false
      const hints: string[] = []
      for (const output of Object.values(bundle)) {
        if (output.type !== 'chunk') continue
        if (output.code.includes('ASSET_SIZES') || output.code.includes('assetSizes')) {
          hints.push(`${output.fileName}:${output.code.includes(marker) ? 'marker' : 'no-marker'}`)
        }
        if (!output.code.includes(marker)) continue
        output.code = output.code.replaceAll(marker, json)
        replaced = true
      }
      if (!replaced) throw new Error(`asset sizes: the manifest placeholder was not in the bundle (${hints.join(', ') || 'no assetSizes chunk'})`)
    },
  }
}
