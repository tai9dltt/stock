/**
 * Normalize raw /data/financeinfo pages into periods + metric values.
 */

import { resolveMetricCode } from '../metricMap'
import type { FinanceInfoPage, RawPeriod, ReportTerm } from './financeinfo'

export interface ParsedPeriod {
  year: number
  quarter: number // 1..4, or 0 for yearly
  periodBegin: string | null
  periodEnd: string | null
}

export interface ParsedValue {
  year: number
  quarter: number
  metricCode: string
  value: number
}

export interface ParsedFinanceData {
  periods: ParsedPeriod[]
  values: ParsedValue[]
  unmappedNames: string[]
}

// The balance sheet group is now "Báo cáo tình hình tài chính" (was "Cân đối kế toán")
const METRIC_GROUPS = ['Kết quả kinh doanh', 'Báo cáo tình hình tài chính', 'Cân đối kế toán', 'Chỉ số tài chính']

/**
 * Parse Vietstock date format (YYYYMM or YYYYMMDD) to MySQL DATE.
 * A bare month is the first day for a period start and the last day for a period end.
 * Anything that isn't a valid date becomes null rather than failing the crawl.
 */
export function parseVietstockDate(
  dateStr: string | null | undefined,
  edge: 'start' | 'end' = 'start'
): string | null {
  if (!dateStr) return null
  const digits = String(dateStr).replace(/\D/g, '')
  if (digits.length !== 6 && digits.length !== 8) return invalidDate(dateStr)

  const year = Number(digits.slice(0, 4))
  const month = Number(digits.slice(4, 6))
  if (month < 1 || month > 12) return invalidDate(dateStr)

  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate()
  const day = digits.length === 8 ? Number(digits.slice(6, 8)) : edge === 'end' ? lastDay : 1
  if (day < 1 || day > lastDay) return invalidDate(dateStr)

  return `${digits.slice(0, 4)}-${digits.slice(4, 6)}-${String(day).padStart(2, '0')}`
}

function invalidDate(raw: unknown): null {
  console.warn(`⚠️ Unrecognized Vietstock date: ${JSON.stringify(raw)}`)
  return null
}

/**
 * Last day of a 12-month fiscal year starting on periodBegin (YYYY-MM-DD).
 * Vietstock's PeriodEnd for yearly reports is unreliable (e.g. 2025 → 202612).
 */
function fiscalYearEnd(periodBegin: string): string {
  const [year, month] = periodBegin.split('-').map(Number) as [number, number]
  return new Date(Date.UTC(year + 1, month - 1, 0)).toISOString().slice(0, 10)
}

/** First day of the 12-month fiscal year ending on periodEnd (YYYY-MM-DD) */
function fiscalYearStart(periodEnd: string): string {
  const [year, month] = periodEnd.split('-').map(Number) as [number, number]
  // Day after the same month-end one year earlier (month is 1-based, so it indexes the next month)
  return new Date(Date.UTC(year - 1, month, 1)).toISOString().slice(0, 10)
}

function toQuarter(term: ReportTerm, period: RawPeriod): number {
  if (term === 'year') return 0
  return period.TermCode?.startsWith('Q') ? parseInt(period.TermCode.slice(1)) : 0
}

export function parseFinanceInfoPages(term: ReportTerm, pages: FinanceInfoPage[]): ParsedFinanceData {
  const periods = new Map<string, ParsedPeriod>()
  // Keyed by year_quarter_metric so overlapping pages don't produce duplicates (last one wins)
  const values = new Map<string, ParsedValue>()
  const unmapped = new Set<string>()

  for (const [rawPeriods, groups] of pages) {
    const pagePeriods = rawPeriods.map((p, i) => {
      let periodBegin = parseVietstockDate(p.PeriodBegin)
      let periodEnd = parseVietstockDate(p.PeriodEnd, 'end')
      // A yearly period spans 12 months; trust its start, else derive the start from its end
      if (term === 'year') {
        if (periodBegin) periodEnd = fiscalYearEnd(periodBegin)
        else if (periodEnd) periodBegin = fiscalYearStart(periodEnd)
      }
      return {
        year: p.YearPeriod,
        quarter: toQuarter(term, p),
        periodBegin,
        periodEnd,
        // Vietstock returns: ID=1 → Value1 (newest), ID=2 → Value2, etc.
        valueKey: `Value${p.ID || p.Row || i + 1}` as const,
      }
    })

    for (const { valueKey, ...period } of pagePeriods) {
      periods.set(`${period.year}_${period.quarter}`, period)
    }

    for (const groupName of METRIC_GROUPS) {
      for (const metric of groups[groupName] || []) {
        const metricCode = resolveMetricCode(metric.Name)
        if (!metricCode) {
          unmapped.add(metric.Name.trim())
          continue
        }

        for (const period of pagePeriods) {
          if (!(period.valueKey in metric)) {
            console.warn(`⚠️ "${metric.Name}" has no ${period.valueKey} for ${period.year} Q${period.quarter}`)
            continue
          }

          const raw = metric[period.valueKey]
          if (raw === null || raw === undefined) continue

          const value = Number(raw)
          if (!Number.isFinite(value)) continue

          values.set(`${period.year}_${period.quarter}_${metricCode}`, {
            year: period.year,
            quarter: period.quarter,
            metricCode,
            value,
          })
        }
      }
    }
  }

  return {
    periods: [...periods.values()],
    values: [...values.values()],
    unmappedNames: [...unmapped],
  }
}
