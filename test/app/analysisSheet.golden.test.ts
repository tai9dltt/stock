/**
 * Golden-master test for the analysis spreadsheet.
 *
 * Builds the sheet for real crawled data (one stock of each type) on a fake
 * SpreadJS and compares the full result (values, formulas, styles, borders,
 * conditional formats) with a stored snapshot. Uses the same state helpers as
 * the analysis page, so loading → building → "Add Year" is covered end to end.
 *
 * After an intended change to the sheet, review the diff and run `npx vitest -u`.
 */
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { createFakeSheet, createFakeSpread, FakeGC } from './fakeSpread'

import type { AnalysisSheetData } from '~/spreadsheet/types'
import { buildAnalysisSheet } from '~/spreadsheet/buildAnalysisSheet'
import {
  buildAnalysisState, nextForecastYear, withForecastYearQuarters,
} from '~/composables/useStockDataTransform'

import DGW from '../fixtures/stock-DGW.json'
import MBB from '../fixtures/stock-MBB.json'
import SSI from '../fixtures/stock-SSI.json'

const TRADING = {
  lastPrice: 25000, outstandingShares: 500_000_000, listedShares: 0, min52W: 20000, max52W: 32000, vol52W: 0,
}

const load = (symbol: string, response: any) =>
  buildAnalysisState(symbol, JSON.parse(JSON.stringify(response.data)), TRADING, '2026-10-02')

function addYear(state: AnalysisSheetData) {
  const year = nextForecastYear(state.annualData, state.quarterlyData, state.forecastYears)
  state.forecastYears.push(year)
  state.forecastQuarters.push(...['Q1', 'Q2', 'Q3', 'Q4'].map(q => `${year}_${q}`))
}

/** Same steps as renderSheet() in the analysis page */
function build(state: AnalysisSheetData): string {
  const { sheet, serialize } = createFakeSheet()
  const layout = buildAnalysisSheet({ GC: FakeGC, spread: createFakeSpread(), sheet }, state)
  state.forecastQuarters = withForecastYearQuarters(state.forecastYears, state.forecastQuarters)

  const cols = JSON.stringify(layout.quarterlyCols)
  return `positions shares=${layout.sharesRow} valuation=${layout.valuationStartRow} cols=${cols}\n${serialize()}`
}

beforeAll(() => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date('2026-10-02T03:00:00Z'))
})
afterAll(() => {
  vi.useRealTimers()
})

describe.each([
  ['industrial', 'DGW', DGW],
  ['bank', 'MBB', MBB],
  ['securities', 'SSI', SSI],
])('analysis sheet: %s (%s)', (_type, symbol, response) => {
  it('matches snapshot after load', async () => {
    await expect(build(load(symbol, response))).toMatchFileSnapshot(`__snapshots__/sheet-${symbol}.txt`)
  })

  it('matches snapshot after adding a forecast year', async () => {
    const state = load(symbol, response)
    build(state) // initial render (also marks forecast quarters, like the page)
    addYear(state)
    await expect(build(state)).toMatchFileSnapshot(`__snapshots__/sheet-${symbol}-add-year.txt`)
  })

  it('builds the P/E ladder when no scenarios are saved', async () => {
    const state = load(symbol, response)
    state.peScenarios = []
    const valuation = build(state).split('\n').filter(line => /^A(4\d|5\d) \|/.test(line))
    await expect(valuation.join('\n')).toMatchFileSnapshot(`__snapshots__/pe-ladder-${symbol}.txt`)
  })
})

describe('growth typed for a forecast quarter', () => {
  const cellOf = (text: string, addr: string) => text.split('\n').find(line => line.startsWith(`${addr} |`))

  it('replaces the growth assumption in that quarter only', () => {
    const state = load('DGW', DGW)
    state.growthOverrides = { revenue: { '2026_Q3': 0.3 } }
    const text = build(state)

    // T35 = TT DT of 2026 Q3, U35 = 2026 Q4 (still following the input M9)
    expect(cellOf(text, 'T35')).toMatch(/^T35 \| 0\.3 \| .*"font":"bold 11pt Calibri"/)
    expect(cellOf(text, 'U35')).toMatch(/^U35 \| =M9 \|/)
    // Revenue keeps projecting from the quarter's growth cell
    expect(cellOf(text, 'T23')).toMatch(/^T23 \| =P23 \* \(1 \+ T35\) \|/)
  })
})

describe('same period last year', () => {
  it('points a quarter to the same quarter a year earlier, a year to the year before', async () => {
    const { samePeriodLastYear } = await import('~/spreadsheet/buildAnalysisSheet')
    const { sheet } = createFakeSheet()
    const layout = buildAnalysisSheet({ GC: FakeGC, spread: createFakeSpread(), sheet }, load('DGW', DGW))
    const [annual, quarterly] = layout.periodTables

    // Quarterly: 4 columns back; nothing before the first year
    expect(samePeriodLastYear(layout, quarterly!.firstRow + 3, quarterly!.firstCol + 6))
      .toEqual({ row: quarterly!.firstRow + 3, col: quarterly!.firstCol + 2 })
    expect(samePeriodLastYear(layout, quarterly!.firstRow, quarterly!.firstCol + 3)).toBeNull()
    // Annual: the column before
    expect(samePeriodLastYear(layout, annual!.firstRow, 3)).toEqual({ row: annual!.firstRow, col: 2 })
    expect(samePeriodLastYear(layout, annual!.firstRow, 1)).toBeNull()
    // Outside the tables (labels, input area)
    expect(samePeriodLastYear(layout, quarterly!.firstRow, 0)).toBeNull()
    expect(samePeriodLastYear(layout, 8, 12)).toBeNull()
  })
})
