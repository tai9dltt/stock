/**
 * Outstanding shares of a quarter when the user has not entered one.
 *
 * Vietstock only gives today's share count, but each reported quarter has
 * equity and book value per share, so its share count is
 * (equity − minority interest) × 1,000,000 ÷ BVPS (equity in million VND,
 * BVPS in VND). BVPS is rounded to the dong, so the result is rounded to
 * the thousand (DGW Q2/2026: 221,165,000 vs 221,161,000 reported today).
 */

type QuarterlyData = Record<string, Record<string, Record<string, unknown>> | undefined>

const valueOf = (data: QuarterlyData, indicator: string, year: string, quarter: string) => {
  const v = data[indicator]?.[year]?.[quarter]
  return v === null || v === undefined || v === '' ? undefined : Number(v)
}

/** Shares implied by the quarter's equity and BVPS, if both were reported */
export function derivedShares(data: QuarterlyData, year: string, quarter: string): number | undefined {
  const equity = valueOf(data, 'equity', year, quarter)
  const bvps = valueOf(data, 'bvps', year, quarter)
  if (equity === undefined || bvps === undefined || !(equity > 0) || !(bvps > 0)) return undefined
  const minority = valueOf(data, 'minorityInterest', year, quarter) ?? 0
  const shares = (equity - (Number.isFinite(minority) ? minority : 0)) * 1_000_000 / bvps
  return shares > 0 ? Math.round(shares / 1000) * 1000 : undefined
}

/** Derived shares for reported quarters, else the current outstanding shares */
export function defaultShares(data: QuarterlyData, year: string, quarter: string, current: number): number {
  return derivedShares(data, year, quarter) ?? current
}
