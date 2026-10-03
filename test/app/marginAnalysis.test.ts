import { describe, expect, it } from 'vitest'
import {
  annualFigures, marginSeries, profitGrowthBreakdown, quarterlyFigures,
} from '~/utils/marginAnalysis'

describe('marginSeries', () => {
  it('computes gross and net margin per period', () => {
    const figures = annualFigures(
      { netRevenue: { 2024: 1000 }, grossProfit: { 2024: 300 }, netProfit: { 2024: 100 } },
      'netRevenue'
    )
    expect(marginSeries(figures)).toEqual([{ label: '2024', grossMargin: 0.3, netMargin: 0.1 }])
  })

  it('has no gross margin for banks', () => {
    const figures = annualFigures({ netInterestIncome: { 2024: 500 }, netProfit: { 2024: 250 } }, 'netInterestIncome')
    expect(marginSeries(figures)).toEqual([{ label: '2024', grossMargin: null, netMargin: 0.5 }])
  })
})

describe('profitGrowthBreakdown', () => {
  it('splits profit growth into revenue growth and margin effect that add up exactly', () => {
    // Revenue +20%, margin 10% → 12%: profit 100 → 144 (+44%)
    const figures = annualFigures(
      { netRevenue: { 2024: 1000, 2025: 1200 }, netProfit: { 2024: 100, 2025: 144 } },
      'netRevenue'
    )
    const [row] = profitGrowthBreakdown(figures)

    expect(row!.label).toBe('2025')
    expect(row!.revenueGrowth).toBeCloseTo(0.2)
    expect(row!.marginEffect).toBeCloseTo(0.24) // 1200 × 2pp / 100
    expect(row!.profitGrowth).toBeCloseTo(0.44)
    expect(row!.revenueGrowth + row!.marginEffect).toBeCloseTo(row!.profitGrowth)
  })

  it('shows a margin squeeze as a negative margin effect', () => {
    // Revenue +10% but margin 10% → 8%: profit 100 → 88 (−12%)
    const figures = annualFigures(
      { netRevenue: { 2024: 1000, 2025: 1100 }, netProfit: { 2024: 100, 2025: 88 } },
      'netRevenue'
    )
    const [row] = profitGrowthBreakdown(figures)
    expect(row!.revenueGrowth).toBeCloseTo(0.1)
    expect(row!.marginEffect).toBeCloseTo(-0.22)
    expect(row!.profitGrowth).toBeCloseTo(-0.12)
  })

  it('compares each quarter with the same quarter a year earlier', () => {
    const q = {
      netRevenue: { 2024: { Q1: 100, Q2: 200 }, 2025: { Q1: 150 } },
      netProfit: { 2024: { Q1: 10, Q2: 30 }, 2025: { Q1: 12 } },
    }
    const rows = profitGrowthBreakdown(quarterlyFigures(q, 'netRevenue'))
    expect(rows.map(r => r.label)).toEqual(['Q1/25'])
    expect(rows[0]!.revenueGrowth).toBeCloseTo(0.5)
    expect(rows[0]!.profitGrowth).toBeCloseTo(0.2)
  })

  it('skips periods whose base profit is not positive (growth is meaningless)', () => {
    const figures = annualFigures(
      { netRevenue: { 2024: 1000, 2025: 1200 }, netProfit: { 2024: -50, 2025: 80 } },
      'netRevenue'
    )
    expect(profitGrowthBreakdown(figures)).toEqual([])
  })
})
