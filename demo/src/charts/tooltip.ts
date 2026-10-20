import { formatCost, type ChartLink, type TimePoint } from './cost'

export function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, char => {
    if (char === '&') return '&amp;'
    if (char === '<') return '&lt;'
    if (char === '>') return '&gt;'
    if (char === '"') return '&quot;'
    return '&#39;'
  })
}

export function localDateTime(time: number): string {
  const date = new Date(time)
  if (Number.isNaN(date.getTime())) throw new Error(`bad time ${time}`)
  return date.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
}

export function shortSha(sha: string): string {
  if (!/^[0-9a-f]{40}$/.test(sha)) throw new Error(`commit ${sha} is not a sha`)
  return sha.slice(0, 7)
}

function partHtml(link: ChartLink): string {
  return [
    `<p>${escapeHtml(link.label)} · ${escapeHtml(link.problem)} · ${formatCost(link.cost)}</p>`,
    `<p>${escapeHtml(localDateTime(link.time))} · ${escapeHtml(shortSha(link.sha))} · ${escapeHtml(link.author)}</p>`,
    `<p><a href="${escapeHtml(link.blobUrl)}">solution</a> · <a href="${escapeHtml(link.commitUrl)}">commit</a></p>`,
  ].join('')
}

export function tooltipHtml(seriesLabel: string, point: TimePoint): string {
  if (!Number.isFinite(point.time)) throw new Error(`${seriesLabel} point has no time`)
  const lines = [
    `<p class="cost-tip-title">${escapeHtml(seriesLabel)} · ${formatCost(point.cost)}</p>`,
    `<p>${escapeHtml(localDateTime(point.time))}</p>`,
  ]
  if (point.parts && point.parts.length > 0) {
    lines.push(`<ul class="cost-tip-parts">${point.parts.map(part => `<li>${partHtml(part)}</li>`).join('')}</ul>`)
  } else if (point.link) {
    lines.push(partHtml(point.link))
  } else {
    throw new Error(`${seriesLabel} point has no solution link`)
  }
  return `<div class="cost-tip-body">${lines.join('')}</div>`
}
