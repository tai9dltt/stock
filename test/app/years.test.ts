import { describe, expect, it } from 'vitest'
import { isForecastYear, resolveDisplayYears } from '~/spreadsheet/years'

const quarters = (years: string[], missing: string[] = []) => ({
  netRevenue: Object.fromEntries(years.map(y => [y, Object.fromEntries(
    ['Q1', 'Q2', 'Q3', 'Q4'].filter(q => !missing.includes(`${y}_${q}`)).map(q => [q, 100]),
  )])),
})

describe('resolveDisplayYears', () => {
  it('keeps an incomplete year in the middle, so columns stay one year apart', () => {
    const data = quarters(['2021', '2022', '2023', '2024', '2025'], ['2023_Q2'])
    expect(resolveDisplayYears(['2021', '2022', '2023', '2024', '2025'], data, 2026))
      .toEqual(['2021', '2022', '2023', '2024', '2025'])
  })

  it('hides incomplete old years at the start', () => {
    const data = quarters(['2020', '2021', '2022', '2023', '2024', '2025'], ['2020_Q1', '2021_Q3'])
    expect(resolveDisplayYears(['2019', '2020', '2021', '2022', '2023', '2024', '2025'], data, 2026))
      .toEqual(['2022', '2023', '2024', '2025'])
  })

  it('fills missing years and keeps last year and later', () => {
    const data = quarters(['2023', '2025'])
    expect(resolveDisplayYears(['2023', '2025', '2027'], data, 2026)).toEqual(['2023', '2024', '2025', '2026', '2027'])
  })
})

describe('isForecastYear', () => {
  it('keeps last year a forecast while its Q4 has no reported figure', () => {
    // Q4 has a P/E but no revenue yet
    const data = { ...quarters(['2025'], ['2025_Q4']), pe: { 2025: { Q4: 12 } } }
    expect(isForecastYear('2025', 2026, data, [], ['netRevenue'])).toBe(true)
    expect(isForecastYear('2025', 2026, quarters(['2025']), [], ['netRevenue'])).toBe(false)
  })

  it('treats the current and later years as forecasts, older ones as reported', () => {
    expect(isForecastYear('2026', 2026, {}, [], ['netRevenue'])).toBe(true)
    expect(isForecastYear('2024', 2026, {}, [], ['netRevenue'])).toBe(false)
  })
})
