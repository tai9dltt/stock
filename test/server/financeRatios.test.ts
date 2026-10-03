import { describe, expect, it } from 'vitest'
import {
  parseRatioValues, readableQuarters, valuesRequest, type RawTerm,
} from '../../server/crawler/vietstock/financeRatios'

const term = (year: number, termId: number, free = true): RawTerm =>
  ({ IdTemp: `${year}-${termId}`, YearPeriod: year, ReportTermID: termId, IsShowData_Permission: free })

describe('readableQuarters', () => {
  it('keeps free quarters, newest first', () => {
    const terms = [term(2025, 5), term(2026, 2), term(2026, 3), term(2026, 4, false), term(2025, 1)]
    expect(readableQuarters(terms, 10).map(t => t.IdTemp)).toEqual(['2026-3', '2026-2', '2025-5'])
    expect(readableQuarters(terms, 2).map(t => t.IdTemp)).toEqual(['2026-3', '2026-2'])
  })
})

describe('valuesRequest', () => {
  it('sends the quarters as the finance page does', () => {
    expect(valuesRequest('DGW', [term(2026, 3), term(2026, 2)], 9)).toEqual({
      'StockCode': 'DGW',
      'ListTerms[0][Index]': '9',
      'ListTerms[0][ItemId]': '2026-3',
      'ListTerms[0][IsShowData]': 'true',
      'ListTerms[0][YearPeriod]': '2026',
      'ListTerms[1][Index]': '10',
      'ListTerms[1][ItemId]': '2026-2',
      'ListTerms[1][IsShowData]': 'true',
      'ListTerms[1][YearPeriod]': '2026',
    })
  })
})

describe('parseRatioValues', () => {
  it('maps ValueN to the Nth quarter and ratio names to metric codes', () => {
    const norms = [
      { ReportNormId: 99, ReportNormName: 'Dòng tiền từ HĐKD trên Lợi nhuận thuần từ HĐKD' },
      { ReportNormId: 11, ReportNormName: 'Tỷ số Nợ vay trên Vốn chủ sở hữu' },
      { ReportNormId: 53, ReportNormName: 'Thu nhập trên mỗi cổ phần của 4 quý gần nhất (EPS)' },
    ]
    const rows = [
      { FinanceIndexID: 99, Value1: 211.59, Value2: -260.83 },
      { FinanceIndexID: 11, Value1: 85.52, Value2: null },
      { FinanceIndexID: 53, Value1: 3790.98, Value2: 2919.51 },
    ]
    expect(parseRatioValues([term(2026, 3), term(2026, 2)], norms, rows)).toEqual([
      { year: 2026, quarter: 2, metricCode: 'CFO_TO_OPERATING_PROFIT', value: 211.59 },
      { year: 2026, quarter: 1, metricCode: 'CFO_TO_OPERATING_PROFIT', value: -260.83 },
      { year: 2026, quarter: 2, metricCode: 'BORROWINGS_TO_EQUITY', value: 85.52 },
    ])
  })
})
