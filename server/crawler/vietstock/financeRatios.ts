/**
 * Vietstock financial ratios (Chỉ số tài chính, CSTC) per quarter: cash flow
 * quality, leverage, liquidity, inventory turnover; for banks NIM, CIR, LDR.
 *
 * Three calls, as the finance page makes them:
 *   1. CSTC_GetListTerms                       → the quarters (only some are free)
 *   2. GetListReportNorm_CSTC_ByStockCode      → ratio ids and names
 *   3. GetFinanceIndexDataValue_CSTC_ByListTerms (9 quarters per call)
 *      → { FinanceIndexID, Value1..Value9 }, ValueN = Nth quarter sent
 */

import { vietstockPost } from './client'
import type { ParsedValue } from './parser'

/** Ratio name on Vietstock → metric code */
export const RATIO_METRICS: Record<string, string> = {
  'Dòng tiền từ HĐKD trên Lợi nhuận thuần từ HĐKD': 'CFO_TO_OPERATING_PROFIT',
  'Tỷ số Nợ vay trên Vốn chủ sở hữu': 'BORROWINGS_TO_EQUITY',
  'Tỷ số Nợ trên Vốn chủ sở hữu': 'DEBT_TO_EQUITY',
  'Tỷ số thanh toán hiện hành (ngắn hạn)': 'CURRENT_RATIO',
  'Vòng quay hàng tồn kho': 'INVENTORY_TURNOVER',
  'Khả năng thanh toán lãi vay': 'INTEREST_COVERAGE',
  'Tỷ lệ thu nhập lãi thuần (NIM)': 'NIM',
  'Tỷ lệ chi phí hoạt động/Tổng thu nhập HĐKD trước dự phòng (CIR)': 'CIR',
  'Dư nợ cho vay khách hàng/Tổng vốn huy động (LDR)': 'LDR',
}

export interface RawTerm {
  /** "2026-3": year, then report term id (2..5 = Q1..Q4) */
  IdTemp: string
  YearPeriod: number
  ReportTermID: number
  IsShowData_Permission: boolean
}

export interface RawNorm {
  ReportNormId: number
  ReportNormName: string
}

export interface RawRatioValue {
  FinanceIndexID: number
  [valueKey: `Value${number}`]: number | null | undefined
}

const TERMS_PER_CALL = 9
const CALL_DELAY_MS = 400

/** Quarter of a report term id: 2..5 → 1..4, else null (yearly / half-year) */
const quarterOf = (termId: number) => (termId >= 2 && termId <= 5 ? termId - 1 : null)

/** Quarters we may read, newest first */
export function readableQuarters(terms: RawTerm[], max: number): RawTerm[] {
  return terms
    .filter(t => t.IsShowData_Permission && quarterOf(t.ReportTermID) !== null)
    .sort((a, b) => b.YearPeriod - a.YearPeriod || b.ReportTermID - a.ReportTermID)
    .slice(0, max)
}

/** Form fields of one values call, as the page sends them */
export function valuesRequest(symbol: string, terms: RawTerm[], firstIndex: number): Record<string, string> {
  const params: Record<string, string> = { StockCode: symbol }
  terms.forEach((t, i) => {
    params[`ListTerms[${i}][Index]`] = String(firstIndex + i)
    params[`ListTerms[${i}][ItemId]`] = t.IdTemp
    params[`ListTerms[${i}][IsShowData]`] = 'true'
    params[`ListTerms[${i}][YearPeriod]`] = String(t.YearPeriod)
  })
  return params
}

/** Values of one call → metric values; ValueN belongs to the Nth term sent */
export function parseRatioValues(terms: RawTerm[], norms: RawNorm[], rows: RawRatioValue[]): ParsedValue[] {
  const codeById = new Map<number, string>()
  for (const norm of norms) {
    const code = RATIO_METRICS[norm.ReportNormName.trim()]
    if (code) codeById.set(norm.ReportNormId, code)
  }

  const values: ParsedValue[] = []
  for (const row of rows) {
    const metricCode = codeById.get(row.FinanceIndexID)
    if (!metricCode) continue
    terms.forEach((term, i) => {
      const raw = row[`Value${i + 1}`]
      const quarter = quarterOf(term.ReportTermID)
      if (raw === null || raw === undefined || quarter === null) return
      const value = Number(raw)
      if (Number.isFinite(value)) values.push({ year: term.YearPeriod, quarter, metricCode, value })
    })
  }
  return values
}

/** Ratios of the last `maxQuarters` free quarters */
export async function fetchFinanceRatios(symbol: string, maxQuarters = 20): Promise<ParsedValue[]> {
  const filter = {
    StockCode: symbol, UnitedId: '-1', AuditedStatusId: '-1', Unit: '1000000000',
    IsNamDuongLich: 'false', PeriodType: 'QUY', SortTimeType: 'Time_ASC',
  }
  const termsResponse = await vietstockPost<{ data?: RawTerm[] }>('/data/CSTC_GetListTerms', filter, symbol)
  const terms = readableQuarters(termsResponse?.data ?? [], maxQuarters)
  if (terms.length === 0) return []

  const normsResponse = await vietstockPost<{ data?: RawNorm[] }>(
    '/data/GetListReportNorm_CSTC_ByStockCode', { stockCode: symbol }, symbol)
  const norms = normsResponse?.data ?? []

  const values: ParsedValue[] = []
  for (let i = 0; i < terms.length; i += TERMS_PER_CALL) {
    if (i > 0) await new Promise(r => setTimeout(r, CALL_DELAY_MS))
    const chunk = terms.slice(i, i + TERMS_PER_CALL)
    const response = await vietstockPost<{ data?: RawRatioValue[] }>(
      '/data/GetFinanceIndexDataValue_CSTC_ByListTerms', valuesRequest(symbol, chunk, i), symbol)
    values.push(...parseRatioValues(chunk, norms, response?.data ?? []))
  }
  return values
}
