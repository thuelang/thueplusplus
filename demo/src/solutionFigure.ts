import type { CatalogSolution } from '@/catalog'
import { formatCost } from '@/charts/cost'

export type FigureKind = 'cost' | 'steps' | 'rules'

export function solutionFigure(solution: CatalogSolution, kind: FigureKind): { text: string; title?: string } {
  if (solution.status === 'fail') {
    const reason = solution.failureReason
    if (typeof reason !== 'string' || reason.trim() === '') throw new Error('a failing solution needs a reason')
    return { text: 'fails', title: reason.trim() }
  }
  const value = kind === 'cost' ? solution.cost : kind === 'steps' ? solution.steps : solution.ruleCount
  if (value == null) return { text: 'unmeasured' }
  if (kind === 'cost') return { text: formatCost(value) }
  return { text: value.toLocaleString('en-US') }
}
