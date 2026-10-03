import { describe, expect, it } from 'vitest'
import {
  buildAnalysisState, nextForecastYear, overlayAnnualMetrics, overlayQuarterlyMetrics, toSavePayload,
} from '~/composables/useStockDataTransform'

describe('metric overlay priority', () => {
  it('prefers parent-company net profit regardless of the order metrics arrive in', () => {
    const npFirst = { NET_PROFIT: { '2025_Q1': '80' }, PROFIT_AFTER_TAX: { '2025_Q1': '100' } }
    const patFirst = { PROFIT_AFTER_TAX: { '2025_Q1': '100' }, NET_PROFIT: { '2025_Q1': '80' } }

    expect(overlayQuarterlyMetrics(npFirst, {}).netProfit['2025']['Q1']).toBe(80)
    expect(overlayQuarterlyMetrics(patFirst, {}).netProfit['2025']['Q1']).toBe(80)
  })

  it('falls back to the lower-priority code per period', () => {
    const metrics = {
      NET_PROFIT: { '2025_Q1': '80' },
      PROFIT_AFTER_TAX: { '2025_Q1': '100', '2025_Q2': '110' },
    }
    expect(overlayQuarterlyMetrics(metrics, {}).netProfit['2025']).toEqual({ Q1: 80, Q2: 110 })
  })

  it('prefers basic EPS over trailing EPS in annual data', () => {
    const metrics = { EPS_BASIC: { 2024: '3000' }, EPS_TTM: { 2024: '3100', 2023: '2900' } }
    expect(overlayAnnualMetrics(metrics, {}).eps).toEqual({ 2024: 3000, 2023: 2900 })
  })

  it('overrides saved values and keeps unrelated indicators', () => {
    const saved = { netRevenue: { 2024: 1 }, custom: { 2024: 5 } }
    const result = overlayAnnualMetrics({ REVENUE_NET: { 2024: '2' } }, saved)
    expect(result.netRevenue[2024]).toBe(2)
    expect(result.custom[2024]).toBe(5)
  })
})

describe('saved analysis', () => {
  const crawled = {
    metrics: { REVENUE_NET: { '2025_Q1': '100' } },
    yearlyMetrics: { REVENUE_NET: { 2025: '400' } },
  }
  const plan = { noteHtml: '<p>x</p>', entryPrice: 10, targetPrice: 12, stopLoss: 9 }

  it('saves only user inputs, not crawled figures', () => {
    const state = buildAnalysisState('FPT', crawled, null, '2026-10-02')
    state.revenueGrowth = 0.2
    state.peScenarios = [10, 12]
    state.quarterlyData['outstandingShares'] = { 2025: { Q1: 1000 } }

    const payload = toSavePayload(state, plan)

    expect(payload).toEqual({
      symbol: 'FPT', forecastYears: [], revenueGrowth: 0.2, grossMargin: 0, netProfitGrowth: 0,
      peScenarios: [10, 12], sharesByQuarter: { 2025: { Q1: 1000 } },
      currentPrice: null, outstandingShares: null, max52W: null, min52W: null,
      ...plan,
    })
    expect(JSON.stringify(payload)).not.toContain('netRevenue')
  })

  it('restores the inputs on the next load', () => {
    const first = buildAnalysisState('FPT', crawled, null, '2026-10-02')
    first.grossMargin = 0.3
    first.peScenarios = [8, 9]
    first.currentPrice = 50000
    first.quarterlyData['outstandingShares'] = { 2025: { Q1: 1000 } }

    const { symbol: _symbol, forecastYears: _years, ...analysis } = toSavePayload(first, plan)
    const reloaded = buildAnalysisState('FPT', { ...crawled, analysis }, null, '2026-10-02')

    expect(reloaded.grossMargin).toBe(0.3)
    expect(reloaded.peScenarios).toEqual([8, 9])
    expect(reloaded.currentPrice).toBe(50000)
    expect(reloaded.quarterlyData['outstandingShares']).toEqual({ 2025: { Q1: 1000 } })
    expect(reloaded.quarterlyData['netRevenue']['2025']['Q1']).toBe(100)
  })

  it('prefers the live price over the saved one', () => {
    const analysis = { ...toSavePayload(buildAnalysisState('FPT', crawled, null, ''), plan), currentPrice: 1 }
    const live = { lastPrice: 2, outstandingShares: 0, listedShares: 0, min52W: 0, max52W: 0, vol52W: 0 }
    expect(buildAnalysisState('FPT', { ...crawled, analysis }, live, '2026-10-02').currentPrice).toBe(2)
  })
})

describe('nextForecastYear', () => {
  it('continues after the last forecast year', () => {
    expect(nextForecastYear({ netRevenue: { 2024: 1, 2025: 1 } }, {}, ['2026', '2027'])).toBe('2028')
  })

  it('works for banks, which have no netRevenue', () => {
    const annual = { netInterestIncome: { 2024: 1, 2025: 1 } }
    const quarterly = { netInterestIncome: { 2026: { Q1: 1, Q2: 1 } } }
    expect(nextForecastYear(annual, quarterly, [])).toBe('2027')
  })

  it('never returns a year that is already shown', () => {
    const annual = { netRevenue: { 2025: 1 } }
    const quarterly = { netRevenue: { 2026: { Q1: 1 } } }
    expect(nextForecastYear(annual, quarterly, [])).toBe('2027')
  })
})

describe('shares per quarter', () => {
  const crawled = { metrics: { REVENUE_NET: { '2025_Q1': '100' } }, yearlyMetrics: {} }
  const plan = { noteHtml: '', entryPrice: null, targetPrice: null, stopLoss: null }

  it('saves only quarters that differ from the current share count', () => {
    const state = buildAnalysisState('MBB', crawled, null, '2026-10-03')
    state.outstandingShares = 10_000
    state.quarterlyData['outstandingShares'] = { 2025: { Q1: 8_000, Q2: 10_000 }, 2026: { Q1: 10_000 } }

    expect(toSavePayload(state, plan).sharesByQuarter).toEqual({ 2025: { Q1: 8_000 } })
  })

  it('ignores share counts saved as defaults, so forecasts use the current count', () => {
    // Older saves stored every quarter, all equal to the share count at that time
    const analysis = {
      ...toSavePayload(buildAnalysisState('MBB', crawled, null, ''), plan),
      outstandingShares: 8_000,
      sharesByQuarter: { 2026: { Q1: 8_000, Q2: 8_000 }, 2025: { Q4: 7_500 } },
    }
    const live = { lastPrice: 1, outstandingShares: 10_000, listedShares: 0, min52W: 0, max52W: 0, vol52W: 0 }
    const state = buildAnalysisState('MBB', { ...crawled, analysis }, live, '2026-10-03')

    expect(state.outstandingShares).toBe(10_000)
    expect(state.quarterlyData['outstandingShares']).toEqual({ 2025: { Q4: 7_500 } })
  })
})
