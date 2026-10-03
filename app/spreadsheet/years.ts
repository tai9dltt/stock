/**
 * Which years / quarters the sheet shows and which of them are forecasts.
 */

import { QUARTER_DATE_RANGES, YEAR_DETECTION_METRICS } from '~/constants/spreadJsConstants'

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
 * Current and future years are forecasts; last year is one until its Q4 is
 * reported. `indicators` are the figures that make a quarter reported (the
 * profile's actualDataIndicators), so a Q4 with only a P/E or BVPS doesn't
 * end the forecast and leave an empty "reported" quarter.
 */
export function isForecastYear(
  year: string,
  currentYear: number,
  quarterlyData: Record<string, any>,
  forecastYears: string[],
  indicators?: readonly string[]
): boolean {
  const yearInt = parseInt(year)

  if (yearInt >= currentYear) return true
  if (yearInt < currentYear - 1) return false
  if (yearInt === currentYear - 1) return !hasQuarterData(quarterlyData, year, 'Q4', indicators)

  return forecastYears.includes(year)
}

export function getQuarterDateRange(quarter: string): string {
  const qIdx = parseInt(quarter.replace('Q', '')) - 1
  return QUARTER_DATE_RANGES[qIdx] || ''
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

/**
 * Sorted, gap-free list of years to show. Old years (before last year)
 * without all 4 quarters are hidden at the start only: a gap in the middle
 * would shift every "same quarter last year" reference (col - 4) by a year,
 * so an incomplete year in between is shown with its missing quarters empty.
 */
export function resolveDisplayYears(
  years: string[],
  quarterlyData: Record<string, any>,
  currentYear: number
): string[] {
  const all = fillYearGaps([...new Set(years)].sort())
  const isComplete = (year: string) =>
    parseInt(year) >= currentYear - 1 || QUARTERS.every(q => hasQuarterData(quarterlyData, year, q))
  const first = all.findIndex(isComplete)
  return first < 0 ? [] : all.slice(first)
}
