import { defineComponent, h, type Component } from 'vue'

const eager = import.meta.glob([
  './pages/*.vue',
  './components/CostChart.vue',
  './components/SandboxScene.vue',
], { eager: true }) as Record<string, { default: Component }>

const registry = new Map<string, { default: Component }>()
for (const [key, mod] of Object.entries(eager)) {
  registry.set(`src/${key.replace(/^\.\//, '')}`, mod)
}
const monaco = {
  __esModule: true as const,
  default: defineComponent({
    props: { modelValue: { type: String, default: '' }, highlightLine: { type: Number, default: undefined } },
    emits: ['update:modelValue', 'paste'],
    setup(props, { emit, attrs }) {
      return () => h('textarea', {
        ...attrs,
        'data-current-match-line': props.highlightLine || undefined,
        value: props.modelValue,
        spellcheck: 'false',
        wrap: 'off',
        onInput: (event: Event) => emit('update:modelValue', (event.target as HTMLTextAreaElement).value),
        onPaste: (event: Event) => emit('paste', (event.target as HTMLTextAreaElement).value),
      })
    },
  }),
}
registry.set('src/RulesMonacoEditor.vue', monaco)
;(globalThis as { __testModules?: typeof registry }).__testModules = registry

if (typeof window !== 'undefined') {
  if (typeof window.ResizeObserver !== 'function') {
    window.ResizeObserver = class {
      observe(): void {}
      unobserve(): void {}
      disconnect(): void {}
    }
  }
  window.matchMedia = (query: string): MediaQueryList => ({
    matches: query.includes('prefers-reduced-motion'),
    media: query,
    onchange: null,
    addListener() {},
    removeListener() {},
    addEventListener() {},
    removeEventListener() {},
    dispatchEvent() { return false },
  })
  const root = globalThis as typeof globalThis & {
    addEventListener: typeof window.addEventListener
    removeEventListener: typeof window.removeEventListener
  }
  root.addEventListener = window.addEventListener.bind(window)
  root.removeEventListener = window.removeEventListener.bind(window)
  const svg = SVGElement.prototype as SVGElement & {
    getComputedTextLength?: () => number
    getBBox?: () => DOMRect
  }
  if (typeof svg.getComputedTextLength !== 'function') {
    svg.getComputedTextLength = function getComputedTextLength(this: SVGElement) {
      return (this.textContent?.length ?? 0) * 7
    }
  }
  if (typeof svg.getBBox !== 'function') {
    svg.getBBox = () => ({
      x: 0,
      y: 0,
      width: 0,
      height: 0,
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      toJSON() { return {} },
    }) as DOMRect
  }
}
