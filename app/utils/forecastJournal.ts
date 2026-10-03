/**
 * Forecast journal: compare what a save projected with what was reported.
 */

import type { ForecastSnapshot } from '~/types'

export interface QuarterComparison {
  /** "2026_Q3" */
  period: string
  /** "Q3/2026" */
  label: string
  revenue: { forecast: number | null; actual: number | null; error: number | null }
  netProfit: { forecast: number | null; actual: number | null; error: number | null }
}

type QuarterlyData = Record<string, Record<string, Record<string, unknown>> | undefined>

const actualOf = (data: QuarterlyData, indicator: string, period: string) => {
  const [year, quarter] = period.split('_') as [string, string]
  const v = data[indicator]?.[year]?.[quarter]
  const n = Number(v)
  return v === null || v === undefined || v === '' || !Number.isFinite(n) ? null : n
}

/** (forecast − actual) ÷ |actual|: positive = the forecast was too high */
export function forecastError(forecast: number | null, actual: number | null): number | null {
  if (forecast === null || actual === null || actual === 0) return null
  return (forecast - actual) / Math.abs(actual)
}

/** The snapshot's quarters, oldest first, with the reported figures where available */
export function compareSnapshot(
  snapshot: Pick<ForecastSnapshot, 'forecast'>,
  data: QuarterlyData,
  revenueIndicator: string
): QuarterComparison[] {
  return Object.entries(snapshot.forecast)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([period, figures]) => {
      const [year, quarter] = period.split('_')
      const revenue = actualOf(data, revenueIndicator, period)
      const netProfit = actualOf(data, 'netProfit', period)
      return {
        period,
        label: `${quarter}/${year}`,
        revenue: { forecast: figures.revenue, actual: revenue, error: forecastError(figures.revenue, revenue) },
        netProfit: { forecast: figures.netProfit, actual: netProfit, error: forecastError(figures.netProfit, netProfit) },
      }
    })
}

export interface ForecastBias {
  /** Forecast quarters that have been reported since */
  quarters: number
  /** Average error; positive = forecasts were too high (optimistic) */
  revenue: number | null
  netProfit: number | null
}

/** Average error over every reported quarter of every snapshot */
export function forecastBias(
  snapshots: Pick<ForecastSnapshot, 'forecast'>[],
  data: QuarterlyData,
  revenueIndicator: string
): ForecastBias {
  const comparisons = snapshots.flatMap(s => compareSnapshot(s, data, revenueIndicator))
  const average = (values: (number | null)[]) => {
    const known = values.filter((v): v is number => v !== null)
    return known.length > 0 ? known.reduce((a, b) => a + b, 0) / known.length : null
  }
  return {
    quarters: comparisons.filter(c => c.revenue.actual !== null || c.netProfit.actual !== null).length,
    revenue: average(comparisons.map(c => c.revenue.error)),
    netProfit: average(comparisons.map(c => c.netProfit.error)),
  }
}
