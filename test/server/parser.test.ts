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

  it('uses the last day of the month for a period end', () => {
    expect(parseVietstockDate('202503', 'end')).toBe('2025-03-31')
    expect(parseVietstockDate('202506', 'end')).toBe('2025-06-30')
    expect(parseVietstockDate('202402', 'end')).toBe('2024-02-29')
    expect(parseVietstockDate('20251215', 'end')).toBe('2025-12-15')
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
      { year: 2025, quarter: 3, periodBegin: '2025-07-01', periodEnd: '2025-09-30' },
    ])
  })

  it('derives the yearly period end from its start, not from Vietstock PeriodEnd', () => {
    const year = (begin: string, end: string) => ({ YearPeriod: 2025, TermCode: 'N', PeriodBegin: begin, PeriodEnd: end, ID: 1 })
    const ends = (begin: string, end: string) =>
      parseFinanceInfoPages('year', [page([year(begin, end)], {})]).periods[0]?.periodEnd

    expect(ends('202501', '202612')).toBe('2025-12-31') // calendar year, wrong end from Vietstock
    expect(ends('202407', '202506')).toBe('2025-06-30') // fiscal year July–June
  })

  it('derives the yearly period start from its end when the start is invalid', () => {
    const data = parseFinanceInfoPages('year', [
      page([{ YearPeriod: 2026, TermCode: 'N', PeriodBegin: '202595', PeriodEnd: '202606', ID: 1 }], {}),
    ])
    expect(data.periods[0]).toMatchObject({ periodBegin: '2025-07-01', periodEnd: '2026-06-30' })
  })

  it('rejects impossible dates instead of failing the crawl', () => {
    expect(parseVietstockDate('202595')).toBeNull()
    expect(parseVietstockDate('20250230')).toBeNull()
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

  it('reads the balance sheet under its current name (regression: it was skipped)', () => {
    const data = parseFinanceInfoPages('quarter', [
      page([quarter(2026, 2, 1)], {
        'Báo cáo tình hình tài chính': [
          { Name: 'Tổng tài sản ', Value1: 12_537_467 },
          { Name: 'Vốn chủ sở hữu', Value1: 3_758_705 },
          { Name: 'Lợi ích của CĐ thiểu số', Value1: null },
        ],
      }),
      // Banks call equity "Vốn và các quỹ"
      page([quarter(2026, 1, 1)], { 'Báo cáo tình hình tài chính': [{ Name: 'Vốn và các quỹ', Value1: 156_762_644 }] }),
    ])

    expect(valueOf(data, 2026, 2, 'TOTAL_ASSETS')).toBe(12_537_467)
    expect(valueOf(data, 2026, 2, 'EQUITY')).toBe(3_758_705)
    expect(valueOf(data, 2026, 1, 'EQUITY')).toBe(156_762_644)
  })

  it('stores a bank\'s "Tổng TNTT" as profit before tax (regression: was operating income)', () => {
    // MBB 2025: net interest income 51.6 trillion, TNTT 34.3 trillion, LNST 27.4 trillion
    const data = parseFinanceInfoPages('year', [
      page([{ ...quarter(2025, 4, 1), TermCode: 'N' }], {
        'Kết quả kinh doanh': [
          { Name: 'Thu nhập lãi thuần', Value1: 51_610_117 },
          { Name: 'Tổng TNTT', Value1: 34_268_358 },
          { Name: 'Tổng LNST', Value1: 27_382_978 },
        ],
      }),
    ])

    expect(valueOf(data, 2025, 0, 'PROFIT_BEFORE_TAX')).toBe(34_268_358)
    expect(valueOf(data, 2025, 0, 'TOTAL_OPERATING_INCOME')).toBeUndefined()
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
