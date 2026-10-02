/**
 * Vietstock financial statements endpoint (/data/financeinfo)
 */

import { vietstockPost } from './client'

export type ReportTerm = 'quarter' | 'year'

export interface RawPeriod {
  YearPeriod: number
  TermCode: string // 'Q1'..'Q4' for quarterly, 'N' for yearly
  PeriodBegin: string
  PeriodEnd: string
  ID?: number
  Row?: number
}

export interface RawMetric {
  Name: string
  ReportNormID?: number
  [valueKey: `Value${number}`]: number | null | undefined
}

/** [periods, { 'Kết quả kinh doanh': [...], 'Cân đối kế toán': [...], ... }] */
export type FinanceInfoPage = [RawPeriod[], Record<string, RawMetric[]>]

const TERM_PARAMS: Record<ReportTerm, { ReportTermType: string; PageSize: string }> = {
  quarter: { ReportTermType: '2', PageSize: '4' },
  year: { ReportTermType: '1', PageSize: '1' },
}

const PAGE_DELAY_MS = 500

/**
 * Fetch a single page. Returns null when Vietstock has no more data.
 */
export async function fetchFinanceInfo(
  symbol: string,
  term: ReportTerm,
  page: number,
  pageSize?: number
): Promise<FinanceInfoPage | null> {
  const params = TERM_PARAMS[term]
  const data = await vietstockPost<unknown>('/data/financeinfo', {
    Code: symbol,
    Page: page.toString(),
    PageSize: pageSize?.toString() ?? params.PageSize,
    ReportTermType: params.ReportTermType,
    ReportType: 'BCTQ',
    Unit: '1000000',
  }, symbol)

  if (!Array.isArray(data) || !Array.isArray(data[0]) || data[0].length === 0) {
    return null
  }
  return [data[0], data[1] ?? {}] as FinanceInfoPage
}

/**
 * Fetch pages 1..numPages sequentially (with a small delay to avoid rate limiting).
 * Stops early when a page comes back empty.
 */
export async function fetchFinanceInfoPages(
  symbol: string,
  term: ReportTerm,
  numPages: number
): Promise<FinanceInfoPage[]> {
  const pages: FinanceInfoPage[] = []

  for (let page = 1; page <= numPages; page++) {
    if (page > 1) await new Promise(r => setTimeout(r, PAGE_DELAY_MS))

    const data = await fetchFinanceInfo(symbol, term, page)
    if (!data) break

    console.log(`✅ ${symbol} ${term} page ${page}: ${data[0].length} periods`)
    pages.push(data)
  }

  return pages
}
