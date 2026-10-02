import { describe, expect, it } from 'vitest'
import type { FinanceInfoPage, RawMetric, RawPeriod } from '../../server/crawler/vietstock/financeinfo'
import { parseFinanceInfoPages, parseVietstockDate } from '../../server/crawler/vietstock/parser'

/** Build a page shaped like /data/financeinfo: [periods, { group: metrics[] }] */
function page(periods: RawPeriod[], groups: Record<string, RawMetric[]>): FinanceInfoPage {
  return [periods, groups]
}

const quarter = (year: number, q: number, id: number): RawPeriod => ({
  YearPeriod: year,
  TermCode: `Q${q}`,
  PeriodBegin: `${year}${String(q * 3 - 2).padStart(2, '0')}`,
  PeriodEnd: `${year}${String(q * 3).padStart(2, '0')}`,
  ID: id,
})

const valueOf = (data: ReturnType<typeof parseFinanceInfoPages>, year: number, q: number, code: string) =>
  data.values.find(v => v.year === year && v.quarter === q && v.metricCode === code)?.value

describe('parseVietstockDate', () => {
  it('parses YYYYMM and YYYYMMDD', () => {
    expect(parseVietstockDate('202503')).toBe('2025-03-01')
    expect(parseVietstockDate('20251231')).toBe('2025-12-31')
  })

  it('returns null for empty or unknown formats', () => {
    expect(parseVietstockDate(null)).toBeNull()
    expect(parseVietstockDate('')).toBeNull()
    expect(parseVietstockDate('2025')).toBeNull()
  })
})

describe('parseFinanceInfoPages', () => {
  it('reads every period of a page, including the 5th (regression: used to stop at 4)', () => {
    const periods = [
      quarter(2026, 2, 1),
      quarter(2026, 1, 2),
      quarter(2025, 4, 3),
      quarter(2025, 3, 4),
      quarter(2025, 2, 5),
    ]
    const data = parseFinanceInfoPages('quarter', [
      page(periods, {
        'Kết quả kinh doanh': [
          { Name: 'Doanh thu thuần', Value1: 500, Value2: 400, Value3: 300, Value4: 200, Value5: 100 },
        ],
      }),
    ])

    expect(data.periods).toHaveLength(5)
    expect(data.values).toHaveLength(5)
    expect(valueOf(data, 2026, 2, 'REVENUE_NET')).toBe(500)
    expect(valueOf(data, 2025, 2, 'REVENUE_NET')).toBe(100)
  })

  it('uses period ID to pick the ValueN column, not array position', () => {
    const data = parseFinanceInfoPages('quarter', [
      page([quarter(2025, 1, 2), quarter(2025, 2, 1)], {
        'Kết quả kinh doanh': [{ Name: 'Doanh thu thuần', Value1: 20, Value2: 10 }],
      }),
    ])

    expect(valueOf(data, 2025, 1, 'REVENUE_NET')).toBe(10)
    expect(valueOf(data, 2025, 2, 'REVENUE_NET')).toBe(20)
  })

  it('maps quarters and dates', () => {
    const data = parseFinanceInfoPages('quarter', [
      page([quarter(2025, 3, 1)], { 'Kết quả kinh doanh': [] }),
    ])

    expect(data.periods).toEqual([
      { year: 2025, quarter: 3, periodBegin: '2025-07-01', periodEnd: '2025-09-01' },
    ])
  })

  it('stores yearly data with quarter 0', () => {
    const data = parseFinanceInfoPages('year', [
      page([{ YearPeriod: 2025, TermCode: 'N', PeriodBegin: '202501', PeriodEnd: '202512', ID: 1 }], {
        'Kết quả kinh doanh': [{ Name: 'LNST của CĐ cty mẹ', Value1: 9376128 }],
      }),
    ])

    expect(data.periods[0]?.quarter).toBe(0)
    expect(valueOf(data, 2025, 0, 'NET_PROFIT')).toBe(9376128)
  })

  it('skips null values and non-numeric values', () => {
    const data = parseFinanceInfoPages('quarter', [
      page([quarter(2025, 1, 1), quarter(2024, 4, 2)], {
        'Kết quả kinh doanh': [
          { Name: 'Doanh thu thuần', Value1: null, Value2: 'abc' as unknown as number },
        ],
      }),
    ])

    expect(data.values).toEqual([])
  })

  it('resolves names with trailing spaces and reports unmapped names', () => {
    const data = parseFinanceInfoPages('quarter', [
      page([quarter(2025, 1, 1)], {
        'Kết quả kinh doanh': [
          { Name: 'LN thuần từ HĐKD ', Value1: 7 },
          { Name: 'Chỉ tiêu lạ ', Value1: 1 },
        ],
      }),
    ])

    expect(valueOf(data, 2025, 1, 'OPERATING_PROFIT')).toBe(7)
    expect(data.unmappedNames).toEqual(['Chỉ tiêu lạ'])
  })

  it('reads all three metric groups and ignores unknown groups', () => {
    const data = parseFinanceInfoPages('quarter', [
      page([quarter(2025, 1, 1)], {
        'Kết quả kinh doanh': [{ Name: 'Doanh thu thuần', Value1: 1 }],
        'Cân đối kế toán': [{ Name: 'Vốn chủ sở hữu', Value1: 2 }],
        'Chỉ số tài chính': [{ Name: 'EPS 4 quý', Value1: 3 }],
        'Nhóm khác': [{ Name: 'Doanh thu thuần', Value1: 999 }],
      }),
    ])

    expect(valueOf(data, 2025, 1, 'REVENUE_NET')).toBe(1)
    expect(valueOf(data, 2025, 1, 'EQUITY')).toBe(2)
    expect(valueOf(data, 2025, 1, 'EPS_TTM')).toBe(3)
  })

  it('merges pages without duplicating periods or values', () => {
    const metrics = { 'Kết quả kinh doanh': [{ Name: 'Doanh thu thuần', Value1: 1 }] }
    const data = parseFinanceInfoPages('quarter', [
      page([quarter(2025, 1, 1)], metrics),
      page([quarter(2025, 1, 1)], { 'Kết quả kinh doanh': [{ Name: 'Doanh thu thuần', Value1: 2 }] }),
    ])

    expect(data.periods).toHaveLength(1)
    expect(data.values).toHaveLength(1)
    expect(valueOf(data, 2025, 1, 'REVENUE_NET')).toBe(2)
  })
})
