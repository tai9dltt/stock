import { describe, expect, it } from 'vitest'
import { overlayAnnualMetrics, overlayQuarterlyMetrics } from '~/composables/useStockDataTransform'

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
