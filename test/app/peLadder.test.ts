import { describe, expect, it } from 'vitest'
import { currentPe, distinctPe, peFormat, peLadder } from '~/spreadsheet/peLadder'

/** P/E by quarter, e.g. { 2025: { Q1: 14.7 } } */
const series = (values: Record<string, number[]>) =>
  Object.fromEntries(Object.entries(values).map(([year, qs]) =>
    [year, Object.fromEntries(qs.map((v, i) => [`Q${i + 1}`, v]))]))

const data = (pe: Record<string, number[]>, eps: Record<string, number[]>, currentPrice = 30_000) => ({
  currentPrice,
  quarterlyData: { pe: series(pe), eps: series(eps) },
})

describe('peLadder', () => {
  // SSI-like history: 6.06 – 23.63, with repeated levels
  const ssi = data(
    {
      2022: [11.56, 6.06, 8.46, 12.4], 2023: [18.82, 22.62, 23.63, 21.42],
      2024: [22.6, 17.95, 14.35, 14.7], 2025: [15.24, 14.8, 20.17, 14.74], 2026: [12.38, 12.35],
    },
    { 2026: [2_400, 2_430] },
  )

  it('gives distinct levels from low to high, with the current P/E', () => {
    const ladder = peLadder(ssi)
    const values = ladder.map(l => l.value)

    expect(values).toEqual([...values].sort((a, b) => a - b))
    for (let i = 1; i < values.length; i++) expect(values[i]! / values[i - 1]!).toBeGreaterThan(1.03)
    expect(ladder.find(l => l.label === 'hiện tại')?.value).toBe(12.35) // 30,000 / 2,430
    expect(ladder.find(l => l.label === 'thấp nhất')?.value).toBe(6.06)
    expect(ladder.find(l => l.label === 'cao nhất')?.value).toBe(23.63)
  })

  it('keeps the current P/E over a history level that is almost the same', () => {
    // "vùng thấp" lands near 12.4, within 3% of the current 12.35
    expect(peLadder(ssi).filter(l => Math.abs(l.value - 12.4) < 0.4).map(l => l.label)).toEqual(['hiện tại'])
  })

  it('ignores P/E from a quarter with tiny earnings', () => {
    const spiky = data({ 2024: [10, 11, 12, 300], 2025: [13, 12, 11, 10] }, { 2025: [3_000] })
    expect(Math.max(...peLadder(spiky).map(l => l.value))).toBeLessThan(20)
  })

  it('falls back to round levels without history', () => {
    const ladder = peLadder(data({}, {}, 0))
    expect(ladder.map(l => l.value)).toEqual([8, 10, 12])
    expect(currentPe(data({}, {}, 0))).toBeNull()
  })
})

describe('distinctPe / peFormat', () => {
  it('drops repeated values, keeping the order', () => {
    expect(distinctPe([15.63, 15.69, 10.6, 15.64, 15.64, 5, 4])).toEqual([15.63, 15.69, 10.6, 15.64, 5, 4])
  })

  it('labels ladder levels only', () => {
    const labels = new Map([[12.35, 'hiện tại']])
    expect(peFormat(12.35, labels)).toBe('0.00" · hiện tại"')
    expect(peFormat(18, labels)).toBe('0.00')
  })
})
