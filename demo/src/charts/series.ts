import { catalog, type CatalogPoint, type CatalogProblem, type CatalogVersion } from '@/catalog'
import { sandboxSeriesFromCatalog, solutionLink, type ChartLink, type TimePoint } from './cost'

export interface ChartSeries {
  id: string
  label: string
  color: string
  points: TimePoint[]
}

export function sandboxCostSeries(): ChartSeries[] {
  return sandboxSeriesFromCatalog(catalog)
}

function pointAt(problem: CatalogProblem, version: CatalogVersion, point: CatalogPoint): TimePoint {
  const commit = catalog.commits.find(item => item.commit === point.commit)
  if (!commit) throw new Error(`${problem.id} commit ${point.commit} is not in the catalog`)
  const time = Date.parse(commit.timestamp)
  if (Number.isNaN(time)) throw new Error(`${problem.id} commit ${point.commit} has no time`)
  const solution = version.solutions.find(item => item.id === point.solution)
  const link: ChartLink = solutionLink({
    problemId: problem.id,
    problem: problem.title,
    label: version.id === 'direct' ? 'Direct Thue' : version.name,
    cost: point.cost,
    time,
    sha: point.sha ?? '',
    author: solution?.author || point.author || version.author,
    title: solution?.title ?? '',
    solutionPath: point.solutionPath ?? '',
  })
  return { time, cost: point.cost, version: point.solution, link }
}

export function problemSeries(problem: CatalogProblem): ChartSeries[] {
  return problem.versions.flatMap(version => {
    if (version.id === 'direct' && version.series.length === 0) return []
    return [{
      id: version.id,
      label: version.id === 'direct' ? 'Direct Thue' : version.name,
      color: version.color,
      points: version.series.map(point => pointAt(problem, version, point)),
    }]
  })
}

export function problemTitle(id: string): string {
  const problem = catalog.problems.find(item => item.id === id)
  if (!problem) throw new Error(`problem ${id} is not in the catalog`)
  return problem.title
}
