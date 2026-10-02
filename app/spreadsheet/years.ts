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

export function hasQuarterData(quarterlyData: Record<string, any>, year: string, quarter: string): boolean {
  return YEAR_DETECTION_METRICS.some((metric) => {
    const value = quarterlyData[metric]?.[year]?.[quarter]
    return value !== undefined && value !== null
  })
}

/**
 * Current and future years are forecasts; last year is one until its Q4 is reported.
 */
export function isForecastYear(
  year: string,
  currentYear: number,
  quarterlyData: Record<string, any>,
  forecastYears: string[]
): boolean {
  const yearInt = parseInt(year)

  if (yearInt >= currentYear) return true
  if (yearInt < currentYear - 1) return false
  if (yearInt === currentYear - 1) return !hasQuarterData(quarterlyData, year, 'Q4')

  return forecastYears.includes(year)
}

export function getQuarterDateRange(quarter: string): string {
  const qIdx = parseInt(quarter.replace('Q', '')) - 1
  return QUARTER_DATE_RANGES[qIdx] || ''
}

/**
 * Hide years older than last year that don't have all 4 quarters.
 */
export function filterIncompleteYears(
  years: string[],
  quarterlyData: Record<string, any>,
  currentYear: number
): string[] {
  return years.filter((year) => {
    if (!(parseInt(year) < currentYear - 1)) return true
    return QUARTERS.every(q => hasQuarterData(quarterlyData, year, q))
  })
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
 * Sorted, gap-free list of years to show, without incomplete old years.
 */
export function resolveDisplayYears(
  years: string[],
  quarterlyData: Record<string, any>,
  currentYear: number
): string[] {
  let result = filterIncompleteYears([...new Set(years)].sort(), quarterlyData, currentYear)
  if (result.length > 0) {
    result = filterIncompleteYears(fillYearGaps(result), quarterlyData, currentYear)
  }
  return result
}
