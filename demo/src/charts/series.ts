import { catalog, type CatalogProblem } from '@/catalog'
import type { TimePoint } from './cost'

export interface ChartSeries {
  id: string
  label: string
  color: string
  points: TimePoint[]
}

export function sandboxBars(): { id: string; label: string; value: number; color: string }[] {
  return catalog.sandboxes.flatMap(sandbox => {
    if (sandbox.total === null) return []
    if (!sandbox.color) throw new Error(`${sandbox.id} has a total and no chart color`)
    return [{ id: sandbox.id, label: sandbox.name, value: sandbox.total, color: sandbox.color }]
  })
}

export function problemSeries(problem: CatalogProblem): ChartSeries[] {
  return problem.versions.map(version => ({
    id: version.id,
    label: version.name,
    color: version.color,
    points: version.series.map(point => {
      const commit = catalog.commits.find(item => item.commit === point.commit)
      if (!commit) throw new Error(`${problem.id} commit ${point.commit} is not in the catalog`)
      const time = Date.parse(commit.timestamp)
      if (Number.isNaN(time)) throw new Error(`${problem.id} commit ${point.commit} has no time`)
      return { time, cost: point.cost }
    }),
  }))
}

export function problemTitle(id: string): string {
  const problem = catalog.problems.find(item => item.id === id)
  if (!problem) throw new Error(`problem ${id} is not in the catalog`)
  return problem.title
}
