import { describe, expect, it } from 'vitest'
import { defaultShares, derivedShares } from '~/spreadsheet/shares'
import { buildAnalysisState, toSavePayload } from '~/composables/useStockDataTransform'

// DGW Q2/2026 on Vietstock: equity 3,758,705 (million VND), BVPS 16,995 → ~221.17M shares
const data = {
  equity: { 2026: { Q2: 3_758_705 } },
  bvps: { 2026: { Q2: 16_995 } },
  minorityInterest: { 2026: { Q2: null } },
}

describe('derivedShares', () => {
  it('is (equity − minority interest) ÷ BVPS, to the thousand', () => {
    expect(derivedShares(data, '2026', 'Q2')).toBe(221_165_000)
    const withMinority = { ...data, minorityInterest: { 2026: { Q2: 100_000 } } }
    expect(derivedShares(withMinority, '2026', 'Q2')).toBe(215_281_000)
  })

  it('needs both equity and a positive BVPS', () => {
    expect(derivedShares(data, '2026', 'Q3')).toBeUndefined()
    expect(derivedShares({ ...data, bvps: { 2026: { Q2: 0 } } }, '2026', 'Q2')).toBeUndefined()
  })

  it('falls back to the current share count', () => {
    expect(defaultShares(data, '2026', 'Q2', 221_161_000)).toBe(221_165_000)
    expect(defaultShares(data, '2026', 'Q3', 221_161_000)).toBe(221_161_000)
  })
})

describe('shares saved per quarter', () => {
  const crawled = {
    symbol: 'DGW',
    periods: [],
    metrics: { EQUITY: { '2026_Q2': '3758705' }, BVPS: { '2026_Q2': '16995' }, REVENUE_NET: { '2026_Q2': '100' } },
    yearlyMetrics: {},
    tradingSnapshot: null,
    analysis: null,
  } as any
  const plan = { noteHtml: '', entryPrice: null, targetPrice: null, stopLoss: null }
  const live = { lastPrice: 1, outstandingShares: 221_161_000, listedShares: 0, min52W: 0, max52W: 0, vol52W: 0 }

  it('does not save the derived defaults as user edits', () => {
    const state = buildAnalysisState('DGW', crawled, live, '2026-10-03')
    // What the sheet shows and readEdits() reads back
    state.quarterlyData['outstandingShares'] = { 2026: { Q2: 221_165_000, Q3: 221_161_000 } }
    expect(toSavePayload(state, plan).sharesByQuarter).toBeNull()

    state.quarterlyData['outstandingShares'] = { 2026: { Q2: 230_000_000, Q3: 221_161_000 } }
    expect(toSavePayload(state, plan).sharesByQuarter).toEqual({ 2026: { Q2: 230_000_000 } })
  })
})
