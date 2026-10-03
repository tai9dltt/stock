import { describe, expect, it } from 'vitest'
import { stockSummary } from '~/utils/stockSummary'
import { formatDate, formatNumber, formatPercent, formatVndCompact } from '~/utils/format'

const base = {
  currentPrice: 50_000,
  outstandingShares: 200_000_000,
  min52W: 40_000,
  max52W: 60_000,
  quarterlyData: {
    eps: { 2025: { Q3: 4_500, Q4: 4_800 }, 2026: { Q1: 5_000 } },
    bvps: { 2025: { Q4: 20_000 }, 2026: { Q1: 25_000 } },
  },
}

describe('stockSummary', () => {
  it('uses the latest reported quarter for EPS and book value', () => {
    const s = stockSummary(base)
    expect(s.epsTtm).toBe(5_000)
    expect(s.pe).toBe(10)
    expect(s.pb).toBe(2)
    expect(s.latestQuarter).toBe('Q1/2026')
    expect(s.marketCap).toBe(10_000_000_000_000)
  })

  it('compares target and stop loss with the current price', () => {
    const s = stockSummary({ ...base, targetPrice: 60_000, stopLoss: 45_000 })
    expect(s.upside).toBeCloseTo(0.2)
    expect(s.downside).toBeCloseTo(-0.1)
  })

  it('leaves P/E empty for loss-making companies and missing data', () => {
    const s = stockSummary({ ...base, quarterlyData: { eps: { 2026: { Q1: -300 } } }, currentPrice: 0 })
    expect(s.pe).toBeNull()
    expect(s.price).toBeNull()
    expect(s.upside).toBeNull()
  })
})

describe('format', () => {
  it('formats numbers, percentages, amounts and dates', () => {
    expect(formatNumber(22028135)).toBe('22,028,135')
    expect(formatNumber(null)).toBe('–')
    expect(formatPercent(0.1234, 1, true)).toBe('+12.3%')
    expect(formatPercent(-0.05)).toBe('-5.0%')
    expect(formatVndCompact(117_103_686_940_800)).toBe('117.1 nghìn tỷ')
    expect(formatVndCompact(845_000_000_000)).toBe('845 tỷ')
    expect(formatDate('2026-10-03')).toBe('03/10/2026')
  })
})
