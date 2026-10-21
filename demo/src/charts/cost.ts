import {
  bestSandboxMarks as bestSandboxMarksJs,
  formatCost as formatCostJs,
  formatTick as formatTickJs,
  runningMin as runningMinJs,
  sandboxSeriesFromCatalog as sandboxSeriesFromCatalogJs,
  solutionLink as solutionLinkJs,
  summedCostSeries as summedCostSeriesJs,
} from './geometry.mjs'

export interface ChartLink {
  problemId: string
  problem: string
  label: string
  cost: number
  time: number
  sha: string
  author: string
  title: string
  solutionPath: string
  blobUrl: string
  commitUrl: string
}

export interface TimePoint {
  time: number
  cost: number
  version?: string
  link?: ChartLink
  parts?: ChartLink[]
  sha?: string
}

export interface SolutionLinkFields {
  problemId: string
  problem: string
  label: string
  cost: number
  time: number
  sha: string
  author: string
  title?: string
  solutionPath: string
}

export const runningMin = runningMinJs as (points: readonly TimePoint[]) => TimePoint[]
export const formatCost = formatCostJs as (value: number) => string
export const formatTick = formatTickJs as (value: number) => string
export const solutionLink = solutionLinkJs as (fields: SolutionLinkFields) => ChartLink
export const summedCostSeries = summedCostSeriesJs as (perProblem: readonly (readonly TimePoint[])[], commits: readonly number[]) => TimePoint[]
export const sandboxSeriesFromCatalog = sandboxSeriesFromCatalogJs as (catalog: {
  sandboxCommon: string[]
  commits: { commit: string; timestamp: string }[]
  sandboxes: { id: string; name: string; total: number | null; color: string | null }[]
  problems: {
    id: string
    title?: string
    versions: {
      id: string
      name?: string
      author?: string
      color?: string
      series: { commit: string; cost: number; solution?: string; sha?: string; author?: string; solutionPath?: string }[]
      solutions?: { cost: number | null }[]
    }[]
  }[]
}) => { id: string; label: string; color: string; points: TimePoint[] }[]
export const bestSandboxMarks = bestSandboxMarksJs as (problem: {
  versions: {
    id: string
    name: string
    color: string
    series: { cost: number; solution?: string }[]
    solutions?: { id: string; title?: string }[]
  }[]
}) => { id: string; label: string; color: string; cost: number; title: string | null }[]
