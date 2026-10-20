import {
  axisLabelPad as axisLabelPadJs,
  axisTicks as axisTicksJs,
  chartLayout as chartLayoutJs,
  chooseScale as chooseScaleJs,
  costY as costYJs,
  formatCost as formatCostJs,
  formatTime as formatTimeJs,
  logTicks as logTicksJs,
  plotY as plotYJs,
  polyline as polylineJs,
  polylineLength as polylineLengthJs,
  runningMin as runningMinJs,
  bestSandboxMarks as bestSandboxMarksJs,
  fitTimeLabels as fitTimeLabelsJs,
  placeEndLabels as placeEndLabelsJs,
  sandboxSeriesFromCatalog as sandboxSeriesFromCatalogJs,
  separateDots as separateDotsJs,
  summedCostSeries as summedCostSeriesJs,
  textWidth as textWidthJs,
  timeLabels as timeLabelsJs,
  timeX as timeXJs,
} from './geometry.mjs'

export interface TimePoint {
  time: number
  cost: number
}

export interface PlacedPoint {
  x: number
  y: number
}

export interface ChartDot {
  x: number
  y: number
  series: number
  cost: number
  id: string
}

export const runningMin = runningMinJs as (points: readonly TimePoint[]) => TimePoint[]
export const formatCost = formatCostJs as (value: number) => string
export const axisLabelPad = axisLabelPadJs as (max: number) => number
export const axisTicks = axisTicksJs as (max: number) => number[]
export const chooseScale = chooseScaleJs as (values: readonly number[]) => 'linear' | 'log'
export const logTicks = logTicksJs as (min: number, max: number) => number[]
export const timeX = timeXJs as (time: number, min: number, max: number, left: number, width: number) => number
export const costY = costYJs as (cost: number, max: number, top: number, height: number, progress: number) => number
export const plotY = plotYJs as (cost: number, scale: 'linear' | 'log', min: number, max: number, top: number, height: number, progress: number) => number
export const polyline = polylineJs as (points: readonly PlacedPoint[]) => string
export const polylineLength = polylineLengthJs as (points: readonly PlacedPoint[]) => number
export const formatTime = formatTimeJs as (time: number, span: number) => string
export const timeLabels = timeLabelsJs as (min: number, max: number, width: number) => { time: number; text: string }[]
export const separateDots = separateDotsJs as <T extends ChartDot>(dots: readonly T[], radius: number) => T[]
export const summedCostSeries = summedCostSeriesJs as (perProblem: readonly (readonly TimePoint[])[], commits: readonly number[]) => TimePoint[]
export const sandboxSeriesFromCatalog = sandboxSeriesFromCatalogJs as (catalog: {
  sandboxCommon: string[]
  commits: { commit: string; timestamp: string }[]
  sandboxes: { id: string; name: string; total: number | null; color: string | null }[]
  problems: { id: string; versions: { id: string; series: { commit: string; cost: number }[]; solutions?: { cost: number | null }[] }[] }[]
}) => { id: string; label: string; color: string; points: TimePoint[] }[]

export interface ChartLayout {
  width: number
  height: number
  pad: { l: number; r: number; t: number; b: number }
  scale: 'linear' | 'log'
  radius: number
  series: {
    id: string
    label: string
    color: string
    d: string
    length: number
    line: PlacedPoint[]
    dots: ChartDot[]
  }[]
  labels: { time: number; text: string; x: number }[]
  ticks: { value: number; y: number; text: string }[]
  ends: { id: string; text: string; x: number; y: number; color: string }[]
}

export const textWidth = textWidthJs as (text: string) => number
export const fitTimeLabels = fitTimeLabelsJs as (labels: readonly { time: number; text: string; x: number }[], width: number) => { time: number; text: string; x: number }[]
export const placeEndLabels = placeEndLabelsJs as (labels: readonly { id: string; text: string; x: number; y: number; color: string }[], top: number, bottom: number) => { id: string; text: string; x: number; y: number; color: string }[]
export const bestSandboxMarks = bestSandboxMarksJs as (problem: {
  versions: { id: string; name: string; color: string; series: { cost: number }[] }[]
}) => { id: string; label: string; color: string; cost: number }[]

export const chartLayout = chartLayoutJs as (series: readonly { id: string; label: string; color: string; points: TimePoint[] }[], options: {
  width: number
  height: number
  spark?: boolean
  track?: 'sum' | 'best'
  progress?: number
  scale?: string
}) => ChartLayout
