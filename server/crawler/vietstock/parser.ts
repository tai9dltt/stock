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

const METRIC_GROUPS = ['Kết quả kinh doanh', 'Cân đối kế toán', 'Chỉ số tài chính']

/**
 * Parse Vietstock date format (YYYYMM or YYYYMMDD) to MySQL DATE.
 * A bare month is the first day for a period start and the last day for a period end.
 */
export function parseVietstockDate(
  dateStr: string | null | undefined,
  edge: 'start' | 'end' = 'start'
): string | null {
  if (!dateStr) return null
  const digits = dateStr.replace(/\D/g, '')
  if (digits.length === 6) {
    const year = Number(digits.slice(0, 4))
    const month = Number(digits.slice(4, 6))
    const day = edge === 'end' ? new Date(Date.UTC(year, month, 0)).getUTCDate() : 1
    return `${digits.slice(0, 4)}-${digits.slice(4, 6)}-${String(day).padStart(2, '0')}`
  } else if (digits.length === 8) {
    return `${digits.slice(0, 4)}-${digits.slice(4, 6)}-${digits.slice(6, 8)}`
  }
  return null
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
    const pagePeriods = rawPeriods.map((p, i) => ({
      year: p.YearPeriod,
      quarter: toQuarter(term, p),
      periodBegin: parseVietstockDate(p.PeriodBegin),
      periodEnd: parseVietstockDate(p.PeriodEnd, 'end'),
      // Vietstock returns: ID=1 → Value1 (newest), ID=2 → Value2, etc.
      valueKey: `Value${p.ID || p.Row || i + 1}` as const,
    }))

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
