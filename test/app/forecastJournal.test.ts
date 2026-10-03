import { describe, expect, it } from 'vitest'
import { compareSnapshot, forecastBias, forecastError } from '~/utils/forecastJournal'

const data = {
  netRevenue: { 2026: { Q2: 8_000 } },
  netProfit: { 2026: { Q2: 200 } },
}
const snapshot = {
  forecast: {
    '2026_Q3': { revenue: 9_000, netProfit: 260, eps: 1_000 },
    '2026_Q2': { revenue: 8_800, netProfit: 250, eps: 1_000 },
  },
}

describe('forecastError', () => {
  it('is positive when the forecast was too high', () => {
    expect(forecastError(250, 200)).toBeCloseTo(0.25)
    expect(forecastError(150, 200)).toBeCloseTo(-0.25)
  })

  it('compares with the size of a loss', () => {
    expect(forecastError(-50, -100)).toBeCloseTo(0.5)
  })

  it('needs both figures and a non-zero actual', () => {
    expect(forecastError(null, 200)).toBeNull()
    expect(forecastError(250, null)).toBeNull()
    expect(forecastError(250, 0)).toBeNull()
  })
})

describe('compareSnapshot', () => {
  it('lists the quarters oldest first with the reported figures', () => {
    const rows = compareSnapshot(snapshot, data, 'netRevenue')
    expect(rows.map(r => r.label)).toEqual(['Q2/2026', 'Q3/2026'])
    expect(rows[0]!.revenue).toEqual({ forecast: 8_800, actual: 8_000, error: expect.closeTo(0.1) })
    expect(rows[0]!.netProfit.error).toBeCloseTo(0.25)
    // Not reported yet
    expect(rows[1]!.netProfit).toEqual({ forecast: 260, actual: null, error: null })
  })
})

describe('forecastBias', () => {
  it('averages the errors of reported quarters only', () => {
    const second = { forecast: { '2026_Q2': { revenue: 7_600, netProfit: 220, eps: 900 } } }
    const bias = forecastBias([snapshot, second], data, 'netRevenue')
    expect(bias.quarters).toBe(2)
    expect(bias.revenue).toBeCloseTo((0.1 - 0.05) / 2)
    expect(bias.netProfit).toBeCloseTo((0.25 + 0.1) / 2)
  })

  it('is empty before anything is reported', () => {
    expect(forecastBias([], data, 'netRevenue')).toEqual({ quarters: 0, revenue: null, netProfit: null })
  })
})
