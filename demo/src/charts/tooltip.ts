import { formatCost, type ChartLink, type TimePoint } from './cost'

const REPOSITORY = 'https://github.com/thuelang/thueplusplus'

export function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, char => {
    if (char === '&') return '&amp;'
    if (char === '<') return '&lt;'
    if (char === '>') return '&gt;'
    if (char === '"') return '&quot;'
    return '&#39;'
  })
}

export function pointDate(time: number): string {
  const date = new Date(time)
  if (Number.isNaN(date.getTime())) throw new Error(`bad time ${time}`)
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' }).format(date)
}

export function shortSha(sha: string): string {
  if (!/^[0-9a-f]{40}$/.test(sha)) throw new Error(`commit ${sha} is not a sha`)
  return sha.slice(0, 7)
}

function authorLine(author: string): string | null {
  const match = /^(.*?)\s*</.exec(author)
  const name = (match ? match[1] : author).trim()
  if (!name) return null
  return `<p>by ${escapeHtml(name)}</p>`
}

function solutionTooltip(seriesLabel: string, point: TimePoint, link: ChartLink): string {
  const title = link.title.trim()
  const heading = title ? `${seriesLabel}: ${title}` : seriesLabel
  const lines = [
    `<p class="cost-tip-title">${escapeHtml(heading)}</p>`,
    `<p>Cost ${formatCost(point.cost)}, ${escapeHtml(pointDate(point.time))}</p>`,
  ]
  const by = authorLine(link.author)
  if (by) lines.push(by)
  lines.push(`<p><a href="${escapeHtml(link.blobUrl)}">View solution</a> · <a href="${escapeHtml(link.commitUrl)}">View commit ${escapeHtml(shortSha(link.sha))}</a></p>`)
  return `<div class="cost-tip-body">${lines.join('')}</div>`
}

function summedTooltip(seriesLabel: string, point: TimePoint): string {
  if (!point.sha) throw new Error(`${seriesLabel} summed point has no measuring commit`)
  const lines = [
    `<p class="cost-tip-title">${escapeHtml(seriesLabel)}</p>`,
    `<p>Cost ${formatCost(point.cost)}, ${escapeHtml(pointDate(point.time))}</p>`,
    `<p><a href="${escapeHtml(`${REPOSITORY}/commit/${point.sha}`)}">View commit ${escapeHtml(shortSha(point.sha))}</a></p>`,
  ]
  return `<div class="cost-tip-body">${lines.join('')}</div>`
}

export function tooltipHtml(seriesLabel: string, point: TimePoint): string {
  if (!seriesLabel.trim()) throw new Error('tooltip has no series')
  if (!Number.isFinite(point.time)) throw new Error(`${seriesLabel} point has no time`)
  if (point.parts && point.parts.length > 0) return summedTooltip(seriesLabel, point)
  if (point.link) return solutionTooltip(seriesLabel, point, point.link)
  throw new Error(`${seriesLabel} point has no solution link`)
}
