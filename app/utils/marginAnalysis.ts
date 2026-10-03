/**
 * Margin history and what drives net profit growth.
 *
 * Net profit growth splits exactly into a revenue part and a margin part:
 *   ΔNP / NP₀ = ΔRev / Rev₀            (revenue growth: profit grows with sales at last year's margin)
 *             + Rev₁ × Δmargin / NP₀   (margin effect: profit gained or lost from the margin changing)
 * with margin = NP / Rev. Only meaningful when last year's net profit and revenue are positive.
 */

export interface PeriodFigures {
  /** Display label, e.g. "Q1/25" or "2025" */
  label: string
  /** Key of the same period one year earlier */
  prevKey: string
  key: string
  revenue: number | null
  grossProfit: number | null
  netProfit: number | null
}

export interface MarginPoint {
  label: string
  grossMargin: number | null
  netMargin: number | null
}

export interface GrowthBreakdown {
  label: string
  revenueGrowth: number
  marginEffect: number
  profitGrowth: number
}

const num = (v: unknown): number | null =>
  v === null || v === undefined || v === '' || !Number.isFinite(Number(v)) ? null : Number(v)

const ratio = (a: number | null, b: number | null) => (a !== null && b !== null && b !== 0 ? a / b : null)

/** Quarterly figures in chronological order (quarters with no revenue and no profit are skipped) */
export function quarterlyFigures(
  quarterlyData: Record<string, any>,
  revenueKey: string
): PeriodFigures[] {
  const years = new Set<string>()
  for (const key of [revenueKey, 'grossProfit', 'netProfit']) {
    Object.keys(quarterlyData[key] ?? {}).forEach(y => years.add(y))
  }

  const result: PeriodFigures[] = []
  for (const year of [...years].sort()) {
    for (const q of ['Q1', 'Q2', 'Q3', 'Q4']) {
      const revenue = num(quarterlyData[revenueKey]?.[year]?.[q])
      const netProfit = num(quarterlyData.netProfit?.[year]?.[q])
      if (revenue === null && netProfit === null) continue
      result.push({
        label: `${q}/${year.slice(-2)}`,
        key: `${year}_${q}`,
        prevKey: `${Number(year) - 1}_${q}`,
        revenue,
        grossProfit: num(quarterlyData.grossProfit?.[year]?.[q]),
        netProfit,
      })
    }
  }
  return result
}

/** Annual figures in chronological order */
export function annualFigures(annualData: Record<string, any>, revenueKey: string): PeriodFigures[] {
  const years = new Set<string>()
  for (const key of [revenueKey, 'grossProfit', 'netProfit']) {
    Object.keys(annualData[key] ?? {}).forEach(y => years.add(y))
  }

  return [...years].sort().flatMap((year) => {
    const revenue = num(annualData[revenueKey]?.[year])
    const netProfit = num(annualData.netProfit?.[year])
    if (revenue === null && netProfit === null) return []
    return [{
      label: year,
      key: year,
      prevKey: String(Number(year) - 1),
      revenue,
      grossProfit: num(annualData.grossProfit?.[year]),
      netProfit,
    }]
  })
}

export function marginSeries(figures: PeriodFigures[]): MarginPoint[] {
  return figures.map(f => ({
    label: f.label,
    grossMargin: ratio(f.grossProfit, f.revenue),
    netMargin: ratio(f.netProfit, f.revenue),
  }))
}

/**
 * Year-over-year net profit growth of each period, split into revenue growth
 * and margin effect. Periods without a comparable positive base are skipped.
 */
export function profitGrowthBreakdown(figures: PeriodFigures[]): GrowthBreakdown[] {
  const byKey = new Map(figures.map(f => [f.key, f]))

  return figures.flatMap((curr) => {
    const prev = byKey.get(curr.prevKey)
    if (!prev) return []

    const { revenue: rev1, netProfit: np1 } = curr
    const { revenue: rev0, netProfit: np0 } = prev
    if (rev1 === null || np1 === null || rev0 === null || np0 === null) return []
    if (rev0 <= 0 || np0 <= 0 || rev1 === 0) return []

    const revenueGrowth = (rev1 - rev0) / rev0
    const marginEffect = (rev1 * (np1 / rev1 - np0 / rev0)) / np0
    return [{ label: curr.label, revenueGrowth, marginEffect, profitGrowth: (np1 - np0) / np0 }]
  })
}
