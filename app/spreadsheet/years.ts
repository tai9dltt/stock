/**
 * Which years / quarters the sheet shows and which of them are forecasts.
 */

import { YEAR_DETECTION_METRICS } from '~/constants/spreadJsConstants'

export const QUARTERS = ['Q1', 'Q2', 'Q3', 'Q4'] as const

/**
 * Years present in the data. Several metrics are checked since banks have no netRevenue.
 */
export function extractYearsFromData(data: Record<string, any>): string[] {
  const years = new Set<string>()

  for (const metric of YEAR_DETECTION_METRICS) {
    const metricData = data[metric]
    if (metricData && typeof metricData === 'object') {
      Object.keys(metricData).forEach(year => years.add(year))
    }
  }

  return Array.from(years).sort()
}

export function hasQuarterData(
  quarterlyData: Record<string, any>,
  year: string,
  quarter: string,
  indicators: readonly string[] = YEAR_DETECTION_METRICS
): boolean {
  return indicators.some((metric) => {
    const value = quarterlyData[metric]?.[year]?.[quarter]
    return value !== undefined && value !== null
  })
}

/**
 * Last year and later are forecasts until their Q4 is reported; older years
 * are reported. A fiscal year that ends before December (HSG: September) has
 * its Q4 reported within the calendar year, and is then no forecast.
 * `indicators` are the figures that make a quarter reported (the profile's
 * actualDataIndicators), so a Q4 with only a P/E or BVPS doesn't end the
 * forecast and leave an empty "reported" quarter.
 */
export function isForecastYear(
  year: string,
  currentYear: number,
  quarterlyData: Record<string, any>,
  indicators?: readonly string[]
): boolean {
  if (parseInt(year) < currentYear - 1) return false
  return !hasQuarterData(quarterlyData, year, 'Q4', indicators)
}

/**
 * Fill gaps so the years are continuous (e.g. 2022, 2024 → 2022, 2023, 2024).
 */
export function fillYearGaps(years: string[]): string[] {
  if (years.length === 0) return years

  const minYear = parseInt(years[0]!)
  const maxYear = parseInt(years[years.length - 1]!)
  const result: string[] = []

  for (let y = minYear; y <= maxYear; y++) {
    result.push(y.toString())
  }

  return result
}

/** Sorted, gap-free list of the years given */
export function continuousYears(years: string[]): string[] {
  return fillYearGaps([...new Set(years)].sort())
}

/**
 * Sorted, gap-free list of years the quarterly table shows. Old years (before last year)
 * without all 4 quarters are hidden at the start only: a gap in the middle
 * would shift every "same quarter last year" reference (col - 4) by a year,
 * so an incomplete year in between is shown with its missing quarters empty.
 */
export function resolveDisplayYears(
  years: string[],
  quarterlyData: Record<string, any>,
  currentYear: number
): string[] {
  const all = continuousYears(years)
  const isComplete = (year: string) =>
    parseInt(year) >= currentYear - 1 || QUARTERS.every(q => hasQuarterData(quarterlyData, year, q))
  const first = all.findIndex(isComplete)
  return first < 0 ? [] : all.slice(first)
}
