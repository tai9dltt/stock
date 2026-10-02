/**
 * Crawl Vietstock financial statements for one symbol and persist them.
 *
 * All pages are fetched first, then written in a single transaction so a
 * failed crawl never leaves half-written data behind.
 */

import { transaction } from '../utils/db'
import {
  ensureCompany,
  ensureCurrentYearForecast,
  loadMetricIds,
  markIncompleteYearsAsForecast,
  upsertMetricValues,
  upsertPeriods,
} from '../repositories/stockRepo'
import { fetchFinanceInfoPages, type ReportTerm } from './vietstock/financeinfo'
import { parseFinanceInfoPages, type ParsedFinanceData } from './vietstock/parser'

export type CrawlType = ReportTerm | 'all'

export interface CrawlOptions {
  type?: CrawlType
  quarterPages?: number
  yearPages?: number
}

export interface CrawlTermResult {
  periodsProcessed: number
  metricsStored: number
  years: number[]
}

export interface CrawlResult {
  companyId: number
  quarter?: CrawlTermResult
  year?: CrawlTermResult
}

export class CrawlNoDataError extends Error {}

export async function crawlStock(rawSymbol: string, options: CrawlOptions = {}): Promise<CrawlResult> {
  const symbol = rawSymbol.trim().toUpperCase()
  const { type = 'all', quarterPages = 4, yearPages = 1 } = options

  const terms: ReportTerm[] = type === 'all' ? ['quarter', 'year'] : [type]

  // 1. Fetch + parse (no DB work yet)
  const parsed = new Map<ReportTerm, ParsedFinanceData>()
  for (const term of terms) {
    const pages = await fetchFinanceInfoPages(symbol, term, term === 'quarter' ? quarterPages : yearPages)
    if (pages.length === 0) {
      throw new CrawlNoDataError(`No ${term} data returned from Vietstock for ${symbol}`)
    }

    const data = parseFinanceInfoPages(term, pages)
    if (data.unmappedNames.length > 0) {
      console.info(`ℹ️ ${symbol} ${term}: unmapped metrics: ${data.unmappedNames.join(' | ')}`)
    }
    parsed.set(term, data)
  }

  // 2. Persist everything in one transaction
  return transaction(async (conn) => {
    const companyId = await ensureCompany(conn, symbol)
    const metricIds = await loadMetricIds(conn)
    const result: CrawlResult = { companyId }

    // Quarterly must be written before yearly: the forecast check counts quarters
    for (const term of terms) {
      const data = parsed.get(term)!
      const periodIds = await upsertPeriods(conn, companyId, term, data.periods)
      const { written, unknownMetricCodes } = await upsertMetricValues(
        conn, companyId, data.values, periodIds, metricIds
      )
      if (unknownMetricCodes.length > 0) {
        console.info(`ℹ️ Metric codes missing in metrics table: ${unknownMetricCodes.join(', ')}`)
      }

      const years = [...new Set(data.periods.map(p => p.year))].sort((a, b) => b - a)

      if (term === 'year') {
        await ensureCurrentYearForecast(conn, companyId, years)
        await markIncompleteYearsAsForecast(conn, companyId, years)
      }

      result[term] = { periodsProcessed: data.periods.length, metricsStored: written, years }
    }

    console.log(`✅ Crawled ${symbol}:`, JSON.stringify(result))
    return result
  })
}
