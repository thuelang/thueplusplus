/**
 * Measurable checks for the home-hero polish.
 * Run from the repo root: node demo/scripts/check-polish.mjs <mode>
 * Dev server defaults to http://127.0.0.1:5173. Preview is started from demo/dist.
 */
import { inflateSync } from 'node:zlib'
import { chromium } from '@playwright/test'

const DEV = process.env.POLISH_DEV ?? 'http://127.0.0.1:5173'

const ROUTES = [
  '/',
  '/install',
  '/install/go',
  '/install/python',
  '/install/js',
  '/install/wasm',
  '/install/rust',
  '/install/cpp',
  '/install/ruby',
  '/install/csharp',
  '/install/java',
  '/docs',
  '/docs/guides',
  '/docs/language',
  '/problems',
  '/problems/hello-world',
  '/problems/hello-world/direct',
  '/playground',
  '/contribute',
  '/projects',
  '/metrics',
  '/autoresearch',
  '/rulesets/direct',
  '/no-such-page',
]

function fail(message) {
  console.error(message)
  process.exit(1)
}

function paeth(a, b, c) {
  const p = a + b - c
  const pa = Math.abs(p - a)
  const pb = Math.abs(p - b)
  const pc = Math.abs(p - c)
  if (pa <= pb && pa <= pc) return a
  if (pb <= pc) return b
  return c
}

function decodePng(buf) {
  if (buf.readUInt32BE(0) !== 0x89504e47) fail('screenshot is not a png')
  let offset = 8
  let width = 0
  let height = 0
  let bitDepth = 0
  let colorType = 0
  const idat = []
  while (offset < buf.length) {
    const length = buf.readUInt32BE(offset)
    offset += 4
    const type = buf.toString('ascii', offset, offset + 4)
    offset += 4
    const data = buf.subarray(offset, offset + length)
    offset += length + 4
    if (type === 'IHDR') {
      width = data.readUInt32BE(0)
      height = data.readUInt32BE(4)
      bitDepth = data[8]
      colorType = data[9]
      if (data[10] !== 0) fail('interlaced screenshots are not supported')
    } else if (type === 'IDAT') {
      idat.push(data)
    } else if (type === 'IEND') {
      break
    }
  }
  const channels = colorType === 6 ? 4 : colorType === 2 ? 3 : 0
  if (bitDepth !== 8 || channels === 0) fail(`unsupported png ${bitDepth}/${colorType}`)
  const raw = inflateSync(Buffer.concat(idat))
  const stride = width * channels
  const pixels = Buffer.alloc(width * height * 4)
  let cursor = 0
  let previous = Buffer.alloc(stride)
  for (let y = 0; y < height; y++) {
    const filter = raw[cursor]
    cursor += 1
    const row = Buffer.from(raw.subarray(cursor, cursor + stride))
    cursor += stride
    for (let i = 0; i < stride; i++) {
      const left = i >= channels ? row[i - channels] : 0
      const up = previous[i]
      const upLeft = i >= channels ? previous[i - channels] : 0
      const sample = row[i]
      if (filter === 0) row[i] = sample
      else if (filter === 1) row[i] = (sample + left) & 255
      else if (filter === 2) row[i] = (sample + up) & 255
      else if (filter === 3) row[i] = (sample + ((left + up) >> 1)) & 255
      else if (filter === 4) row[i] = (sample + paeth(left, up, upLeft)) & 255
      else fail(`unknown png filter ${filter}`)
    }
    previous = row
    for (let x = 0; x < width; x++) {
      const source = x * channels
      const dest = (y * width + x) * 4
      pixels[dest] = row[source]
      pixels[dest + 1] = row[source + 1]
      pixels[dest + 2] = row[source + 2]
      pixels[dest + 3] = channels === 4 ? row[source + 3] : 255
    }
  }
  return { width, height, pixels }
}

function luminance(image, x, y) {
  const ix = Math.max(0, Math.min(image.width - 1, Math.round(x)))
  const iy = Math.max(0, Math.min(image.height - 1, Math.round(y)))
  const i = (iy * image.width + ix) * 4
  return 0.2126 * image.pixels[i] + 0.7152 * image.pixels[i + 1] + 0.0722 * image.pixels[i + 2]
}

function averageLuminance(image, x, y0, y1) {
  let sum = 0
  let count = 0
  for (let y = y0; y <= y1; y++) {
    sum += luminance(image, x, y)
    count += 1
  }
  return sum / count
}

async function open(viewport = { width: 1440, height: 900 }) {
  const browser = await chromium.launch()
  const page = await browser.newPage({ viewport, deviceScaleFactor: 1 })
  const errors = []
  page.on('pageerror', error => errors.push(error.message.split('\n')[0]))
  page.on('console', message => {
    if (message.type() === 'error') errors.push(message.text().split('\n')[0].slice(0, 300))
  })
  await page.addInitScript(() => localStorage.setItem('theme', 'dark'))
  return { browser, page, errors }
}

async function checkVeil() {
  const { browser, page } = await open()
  try {
    await page.goto(`${DEV}/`, { waitUntil: 'networkidle', timeout: 30000 })
    const veil = page.locator('[data-test="hero-veil"]')
    await veil.waitFor()
    const style = await veil.evaluate(element => {
      const computed = getComputedStyle(element)
      const box = element.getBoundingClientRect()
      const copy = element.parentElement.getBoundingClientRect()
      return {
        mask: computed.maskImage || computed.webkitMaskImage,
        composite: computed.maskComposite || computed.webkitMaskComposite,
        blur: computed.backdropFilter || computed.webkitBackdropFilter,
        fadeL: copy.left - box.left,
        fadeR: box.right - copy.right,
        fadeT: copy.top - box.top,
        fadeB: box.bottom - copy.bottom,
        box: box.toJSON(),
      }
    })
    if (!style.mask || style.mask === 'none' || style.mask.split('linear-gradient').length < 3) {
      fail(`veil mask is not a two-axis fade: ${style.mask}`)
    }
    if (!style.mask.includes('to right') && !style.mask.includes('to left')) {
      fail(`veil has no horizontal fade: ${style.mask}`)
    }
    if (!String(style.composite).includes('intersect') && !String(style.composite).includes('source-in')) {
      fail(`veil mask composite is ${style.composite}`)
    }
    if (!String(style.blur).includes('blur')) fail(`veil has no backdrop blur: ${style.blur}`)
    if (!(style.fadeL >= 80)) fail(`left veil fade is ${style.fadeL}px`)
    if (!(style.fadeR >= 48)) fail(`right veil fade is ${style.fadeR}px`)
    if (!(style.fadeT >= 24)) fail(`top veil fade is ${style.fadeT}px`)
    if (!(style.fadeB >= 48)) fail(`bottom veil fade is ${style.fadeB}px`)
    const floor = await page.evaluate(() => {
      const line = document.querySelector('[data-test="floor"]')
      if (!line) return null
      const box = line.getBoundingClientRect()
      return { x: box.x, y: box.y, width: box.width, height: box.height }
    })
    if (!floor || floor.width < 100) fail('ground line is missing')
    if (style.box.left < 8) fail(`veil fade is clipped by the viewport at x=${style.box.left}`)
    if (style.box.right > 1440 - 8) fail(`veil is clipped by the viewport at x=${style.box.right}`)
    const shot = decodePng(await page.screenshot({ type: 'png' }))
    const y = Math.max(0, Math.min(shot.height - 1, Math.round(floor.y + floor.height / 2)))
    const y0 = y
    const y1 = y
    function fadeRelease(samples, outside, opaque, label) {
      const range = Math.abs(outside - opaque)
      if (range < 12) fail(`veil does not change the ground line on the ${label} (opaque ${opaque.toFixed(1)}, outside ${outside.toFixed(1)})`)
      let maxStep = 0
      for (let i = 1; i < samples.length; i++) maxStep = Math.max(maxStep, Math.abs(samples[i] - samples[i - 1]))
      const edge = label === 'left' ? samples[0] : samples[samples.length - 1]
      const released = Math.abs(outside - edge) / range
      if (maxStep > range * 0.35) {
        fail(`veil fade has a hard step of ${maxStep.toFixed(1)} on a ${range.toFixed(1)} swing (${label})`)
      }
      if (released > 0.4) {
        fail(`veil still dims the ground line at its ${label} edge (released ${released.toFixed(2)}, edge ${edge.toFixed(1)}, outside ${outside.toFixed(1)})`)
      }
    }
    const left = []
    for (let x = Math.round(style.box.left); x <= Math.round(style.box.left + style.fadeL); x += 1) {
      left.push(averageLuminance(shot, x, y0, y1))
    }
    fadeRelease(
      left,
      averageLuminance(shot, style.box.left - 14, y0, y1),
      averageLuminance(shot, style.box.left + style.fadeL + 24, y0, y1),
      'left',
    )
    const right = []
    for (let x = Math.round(style.box.right - style.fadeR); x <= Math.round(style.box.right); x += 1) {
      right.push(averageLuminance(shot, x, y0, y1))
    }
    fadeRelease(
      right,
      averageLuminance(shot, style.box.right + 12, y0, y1),
      averageLuminance(shot, style.box.right - style.fadeR - 24, y0, y1),
      'right',
    )
    console.log('veil fade ok')
  } finally {
    await browser.close()
  }
}

async function checkGround() {
  const { browser, page } = await open()
  try {
    await page.goto(`${DEV}/`, { waitUntil: 'domcontentloaded', timeout: 30000 })
    await page.locator('[data-test="sandbox-scene"] [data-test="rex-dot"]').first().waitFor()
    const measured = await page.evaluate(() => {
      const scene = document.querySelector('[data-test="sandbox-scene"]')
      const dots = [...scene.querySelectorAll('[data-test="rex-dot"]')].map(dot => {
        const box = dot.getBoundingClientRect()
        return { top: box.top, bottom: box.bottom }
      })
      const belt = scene.querySelector('[data-test="belt"]')
      const floorEl = scene.querySelector('[data-test="floor"]')
      const floor = floorEl.getBoundingClientRect()
      const mark = scene.querySelector('[data-test="rex-mark"]')
      const svg = scene.querySelector('svg').getBoundingClientRect()
      const order = floorEl.compareDocumentPosition(mark)
      return {
        hasBelt: Boolean(belt),
        dots,
        floor: { top: floor.top, bottom: floor.bottom, height: floor.height },
        svgBottom: svg.bottom,
        floorBeforeRex: (order & Node.DOCUMENT_POSITION_FOLLOWING) !== 0,
      }
    })
    if (measured.hasBelt) fail('conveyor belt is still drawn')
    if (!measured.floorBeforeRex) fail('ground line is painted over Rex')
    if (measured.floor.height > 4) fail(`ground line is ${measured.floor.height.toFixed(1)}px tall`)
    if (measured.dots.length !== 4) fail(`expected 4 Rex dots, got ${measured.dots.length}`)
    const sorted = [...measured.dots].sort((a, b) => a.top - b.top)
    const feet = sorted.slice(2)
    for (const foot of feet) {
      const height = foot.bottom - foot.top
      if (height < 24) fail(`Rex foot is only ${height.toFixed(1)}px tall`)
      const floatGap = measured.floor.top - foot.bottom
      if (floatGap > 3) fail(`Rex foot floats ${floatGap.toFixed(1)}px above the ground line`)
      const hang = foot.bottom - measured.floor.bottom
      if (hang > 2) fail(`Rex foot hangs ${hang.toFixed(1)}px under the ground line`)
      if (foot.bottom > measured.svgBottom - 1) {
        fail(`Rex foot is clipped at ${foot.bottom.toFixed(1)} past the scene ${measured.svgBottom.toFixed(1)}`)
      }
    }
    console.log('rex grounded ok')
  } finally {
    await browser.close()
  }
}

async function checkScore() {
  const { browser, page } = await open()
  try {
    await page.goto(`${DEV}/`, { waitUntil: 'domcontentloaded', timeout: 30000 })
    await page.locator('[data-test="sandbox-scene"]').waitFor()
    await page.locator('[data-test="lever-hit"]').click({ force: true })
    const started = Date.now()
    let pulled = false
    while (Date.now() - started < 25000) {
      const ready = await page.locator('[data-test="box"][data-zone="yes"]').count()
      if (ready > 0) {
        await page.locator('[data-test="lever-hit"]').click({ force: true })
        pulled = true
        break
      }
      await page.waitForTimeout(40)
    }
    if (!pulled) {
      const state = await page.evaluate(() => ({
        phase: document.querySelector('[data-test="sandbox-scene"]')?.getAttribute('data-phase'),
        boxes: document.querySelectorAll('[data-test="box"]').length,
        hidden: document.hidden,
      }))
      fail(`no box entered the capture zone (${JSON.stringify(state)})`)
    }
    let gap = Infinity
    let sawFlash = false
    let labelBox = null
    let sceneBox = null
    const until = Date.now() + 900
    while (Date.now() < until) {
      const frame = await page.evaluate(() => {
        const flash = document.querySelector('[data-test="score-flash"]')
        const label = document.querySelector('[data-test="score-label"]')
        const scene = document.querySelector('[data-test="sandbox-scene"] svg')
        const score = document.querySelector('[data-test="score"]')
        if (!flash || !label || !scene || !score) return null
        if (Number(score.textContent) < 1) return null
        return {
          flash: flash.getBoundingClientRect().toJSON(),
          label: label.getBoundingClientRect().toJSON(),
          scene: scene.getBoundingClientRect().toJSON(),
          text: label.textContent,
        }
      })
      if (frame) {
        sawFlash = true
        gap = Math.min(gap, frame.flash.top - frame.label.bottom)
        labelBox = frame.label
        sceneBox = frame.scene
        if (frame.text !== 'score') fail(`score label text is ${frame.text}`)
      }
      await page.waitForTimeout(30)
    }
    if (!sawFlash) fail('score flash never appeared')
    if (gap < 4) fail(`score label is ${gap.toFixed(1)}px from the flash circle`)
    if (labelBox.top < sceneBox.top - 1 || labelBox.right > sceneBox.right + 1 || labelBox.left < sceneBox.left) {
      fail(`score label sits outside the scene (${JSON.stringify(labelBox)})`)
    }
    console.log('score label clear ok')
  } finally {
    await browser.close()
  }
}

async function checkExplainer() {
  const dev = await open()
  try {
    await dev.page.goto(DEV, { waitUntil: 'domcontentloaded', timeout: 30000 })
    await dev.page.locator('[data-explainer="origin"]').waitFor()
    const text = await dev.page.locator('[data-test="page-details"]').innerText()
    if (!text.includes('makes it a practical portable cross platform runtime')) fail('origin phrase missing')
    if (/re2/i.test(text)) fail('explainer says RE2')
    const count = await dev.page.locator('[data-test="explainer"]').count()
    if (count !== 5) fail(`expected 5 sections, got ${count}`)
    if (await dev.page.locator('video').count() !== 0) fail('explainer rendered a video')
    if (await dev.page.locator('canvas').count() !== 0) fail('explainer rendered a canvas')
    console.log('explainer dev ok')
  } finally {
    await dev.browser.close()
  }
}

async function checkRaf() {
  const browser = await chromium.launch()
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
  await page.emulateMedia({ reducedMotion: 'no-preference' })
  await page.addInitScript(() => {
    let hidden = false
    for (const key of ['hidden', 'visibilityState']) {
      const desc = Object.getOwnPropertyDescriptor(Document.prototype, key)
      if (!desc?.configurable) {
        window.__hiddenOverride = 'locked'
        return
      }
    }
    Object.defineProperty(Document.prototype, 'hidden', { configurable: true, get: () => hidden })
    Object.defineProperty(Document.prototype, 'visibilityState', {
      configurable: true,
      get: () => (hidden ? 'hidden' : 'visible'),
    })
    window.__setDocHidden = value => {
      hidden = value
      document.dispatchEvent(new Event('visibilitychange'))
    }
  })
  try {
    for (const path of ['/', '/docs']) {
      await page.goto(`${DEV}${path}`, { waitUntil: 'domcontentloaded', timeout: 30000 })
      const mark = page.locator('[data-test="page-hero"] [data-test="rex-mark"]').first()
      await mark.waitFor()
      const locked = await page.evaluate(() => window.__hiddenOverride ?? 'ok')
      if (locked !== 'ok') fail(`cannot simulate a hidden document (${locked})`)
      const sample = () => page.evaluate(() => {
        const hero = document.querySelector('[data-test="page-hero"]')
        const drawn = hero.querySelector('[data-test="rex-mark"]')
        const placed = drawn.parentElement?.getAttribute('transform') ?? ''
        const eye = hero.querySelector('[data-test="rex-eye"]')
        return `${placed}|${eye?.getAttribute('y')}|${eye?.getAttribute('height')}`
      })
      const first = await sample()
      let moved = false
      for (let i = 0; i < 12; i++) {
        await page.waitForTimeout(80)
        if (await sample() !== first) {
          moved = true
          break
        }
      }
      if (!moved) fail(`Rex on ${path} did not animate while visible`)
      await page.evaluate(() => window.__setDocHidden(true))
      await page.waitForTimeout(50)
      const frozen = await sample()
      await page.waitForTimeout(400)
      const still = await sample()
      if (still !== frozen) fail(`Rex on ${path} kept animating while hidden (${frozen} -> ${still})`)
      await page.evaluate(() => window.__setDocHidden(false))
    }
    console.log('raf pauses ok')
  } finally {
    await browser.close()
  }
}

async function visitRoutes(collectErrors) {
  const findings = []
  const browser = await chromium.launch()
  const themes = collectErrors ? ['dark'] : ['dark', 'light']
  const widths = collectErrors ? [1440] : [1440, 1024, 768, 390]
  try {
    for (const theme of themes) {
      for (const width of widths) {
        const page = await browser.newPage({
          viewport: { width, height: width < 800 ? 844 : 900 },
          deviceScaleFactor: 1,
        })
        const errors = []
        if (collectErrors) {
          page.on('pageerror', error => errors.push(error.message.split('\n')[0]))
          page.on('console', message => {
            if (message.type() === 'error') errors.push(message.text().split('\n')[0].slice(0, 240))
          })
        }
        await page.addInitScript(choice => localStorage.setItem('theme', choice), theme)
        for (const path of ROUTES) {
          errors.length = 0
          await page.goto(`${DEV}${path}`, { waitUntil: 'domcontentloaded', timeout: 30000 })
          await page.waitForTimeout(path === '/' || path === '/playground' ? 700 : 200)
          if (!collectErrors) {
            const layout = await page.evaluate(() => ({
              scroll: document.documentElement.scrollWidth,
              client: document.documentElement.clientWidth,
              body: document.body.scrollWidth,
            }))
            if (layout.scroll > layout.client + 1 || layout.body > layout.client + 1) {
              findings.push(`${theme} ${width} ${path} scroll ${layout.scroll} body ${layout.body} client ${layout.client}`)
            }
          } else if (errors.length && theme === 'dark' && width === 1440) {
            findings.push(`${path}: ${[...new Set(errors)].join(' | ')}`)
          }
        }
        await page.close()
      }
    }
  } finally {
    await browser.close()
  }
  return findings
}

async function checkOverflow() {
  const findings = await visitRoutes(false)
  if (findings.length) fail(findings.join('\n'))
  console.log('overflow ok')
}

async function checkConsole() {
  const findings = await visitRoutes(true)
  if (findings.length) fail(findings.join('\n'))
  console.log('console ok')
}

async function checkScorePlace() {
  const { browser, page } = await open()
  try {
    await page.goto(`${DEV}/`, { waitUntil: 'domcontentloaded', timeout: 30000 })
    await page.locator('[data-test="score-label"]').waitFor()
    const placed = await page.evaluate(() => {
      const label = document.querySelector('[data-test="score-label"]')
      const score = document.querySelector('[data-test="score"]')
      const copy = document.querySelector('.hero-copy').getBoundingClientRect()
      const labelBox = label.getBoundingClientRect()
      const scoreBox = score.getBoundingClientRect()
      const opacity = Number(getComputedStyle(label).opacity)
      return {
        opacity,
        groupOpacity: Number(getComputedStyle(label.parentElement).opacity),
        scoreHeight: scoreBox.height,
        headlineHeight: document.querySelector('[data-test="page-hero"] h1 + p')?.getBoundingClientRect().height ?? 0,
        yourTurn: Boolean(document.querySelector('[data-test="your-turn"]')),
        install: document.querySelector('[data-test="hero-install"]')?.textContent ?? '',
        labelRight: labelBox.right,
        scoreRight: scoreBox.right,
        copyLeft: copy.left,
      }
    })
    if (placed.yourTurn) fail('your turn button is in the hero')
    if (placed.install !== 'install') fail(`install button is ${placed.install}`)
    if (placed.groupOpacity > 0.85 || placed.groupOpacity < 0.55) {
      fail(`score opacity is ${placed.groupOpacity}`)
    }
    if (!(placed.headlineHeight > placed.scoreHeight * 1.6)) {
      fail(`score is ${placed.scoreHeight.toFixed(1)}px against a ${placed.headlineHeight.toFixed(1)}px headline`)
    }
    if (placed.scoreRight > placed.copyLeft - 16) {
      fail(`score reaches x=${placed.scoreRight.toFixed(0)} into the copy at ${placed.copyLeft.toFixed(0)}`)
    }
    console.log('score place ok')
  } finally {
    await browser.close()
  }
}

async function checkStray() {
  const { browser, page } = await open()
  try {
    await page.goto(`${DEV}/`, { waitUntil: 'domcontentloaded', timeout: 30000 })
    await page.locator('[data-test="sandbox-scene"]').waitFor()
    const stray = await page.evaluate(() => {
      const scene = document.querySelector('[data-test="sandbox-scene"]')
      const floor = scene.querySelector('[data-test="floor"]').getBoundingClientRect()
      const found = []
      for (const rect of scene.querySelectorAll('rect')) {
        const box = rect.getBoundingClientRect()
        if (box.width < 8 || box.height < 4) continue
        if (box.top > floor.bottom + 2) {
          found.push(`${Math.round(box.x)},${Math.round(box.y)} ${Math.round(box.width)}x${Math.round(box.height)}`)
        }
      }
      return found
    })
    if (stray.length) fail(`stray rects under the ground line: ${stray.join('; ')}`)
    console.log('no stray rects')
  } finally {
    await browser.close()
  }
}

const modes = {
  veil: checkVeil,
  ground: checkGround,
  score: checkScore,
  scoreplace: checkScorePlace,
  stray: checkStray,
  explainer: checkExplainer,
  raf: checkRaf,
  overflow: checkOverflow,
  console: checkConsole,
}

const mode = process.argv[2]
if (!modes[mode]) fail('usage: check-polish.mjs veil|ground|score|scoreplace|stray|explainer|raf|overflow|console')
await modes[mode]()
