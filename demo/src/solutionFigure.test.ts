import { describe, expect, it } from 'vitest'
import { formatCost } from './charts/cost'
import type { CatalogSolution } from './catalog'
import { solutionFigure } from './solutionFigure'

function solution(overrides: Partial<CatalogSolution>): CatalogSolution {
  return {
    id: 'while-loop-from-10.lisp',
    status: 'pass',
    steps: 12,
    cost: 15500000,
    regexEvals: 1,
    regexMatches: 1,
    stateBytes: 1,
    statePeak: 1,
    ruleCount: 4,
    ruleChars: 8,
    solution: '',
    solutionPath: 'problems/factorial/solutions/lisp/2026-10-16_13-47-12/while-loop-from-10.lisp',
    title: 'While loop from 10',
    author: null,
    failureReason: null,
    ...overrides,
  }
}

describe('solution figures', () => {
  it('shows fails with the reason when an older version does not run', () => {
    const failed = solution({ status: 'fail', cost: null, steps: null, ruleCount: null, failureReason: 'ten: exit 1' })
    for (const kind of ['cost', 'steps', 'rules'] as const) {
      const figure = solutionFigure(failed, kind)
      expect(figure.text).toBe('fails')
      expect(figure.title).toBe('ten: exit 1')
      expect(JSON.stringify(figure)).not.toContain('unmeasured')
    }
  })

  it('formats a measured cost in SI and counts as integers', () => {
    const measured = solution({})
    expect(solutionFigure(measured, 'cost').text).toBe(formatCost(15500000))
    expect(solutionFigure(measured, 'cost').text).toBe('15.5M')
    expect(solutionFigure(measured, 'steps').text).toBe('12')
    expect(solutionFigure(measured, 'rules').text).toBe('4')
  })
})
