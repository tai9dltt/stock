/**
 * Headline figures for the stock summary strip.
 */

export interface StockSummaryInput {
  currentPrice: number
  outstandingShares: number
  min52W: number
  max52W: number
  quarterlyData: Record<string, any>
  targetPrice?: number | null
  stopLoss?: number | null
}

export interface StockSummaryFigures {
  price: number | null
  marketCap: number | null
  /** Trailing 4-quarter EPS reported for the latest quarter */
  epsTtm: number | null
  pe: number | null
  bvps: number | null
  pb: number | null
  /** Quarter the per-share figures come from, e.g. "Q2/2026" */
  latestQuarter: string | null
  min52W: number | null
  max52W: number | null
  targetPrice: number | null
  /** Target vs current price (0.2 = +20%) */
  upside: number | null
  stopLoss: number | null
  /** Stop loss vs current price (negative) */
  downside: number | null
}

const positive = (v: unknown): number | null => {
  const n = Number(v)
  return v !== null && v !== undefined && Number.isFinite(n) && n > 0 ? n : null
}

/** Latest quarter that has a value for this indicator */
function latestQuarterValue(series: Record<string, Record<string, unknown>> | undefined) {
  if (!series) return null
  const quarters = Object.entries(series)
    .flatMap(([year, qs]) => Object.entries(qs ?? {}).map(([q, v]) => ({ year, q, v })))
    .filter(({ v }) => v !== null && v !== undefined && Number.isFinite(Number(v)))
    .sort((a, b) => a.year.localeCompare(b.year) || a.q.localeCompare(b.q))
  const last = quarters.at(-1)
  return last ? { value: Number(last.v), label: `${last.q}/${last.year}` } : null
}

export function stockSummary(input: StockSummaryInput): StockSummaryFigures {
  const price = positive(input.currentPrice)
  const shares = positive(input.outstandingShares)
  const eps = latestQuarterValue(input.quarterlyData.eps)
  const bvps = latestQuarterValue(input.quarterlyData.bvps)
  const target = positive(input.targetPrice)
  const stop = positive(input.stopLoss)

  const relative = (level: number | null) => (price && level ? level / price - 1 : null)

  return {
    price,
    marketCap: price && shares ? price * shares : null,
    epsTtm: eps?.value ?? null,
    // P/E and P/B only make sense on positive earnings / book value
    pe: price && eps && eps.value > 0 ? price / eps.value : null,
    bvps: bvps?.value ?? null,
    pb: price && bvps && bvps.value > 0 ? price / bvps.value : null,
    latestQuarter: eps?.label ?? bvps?.label ?? null,
    min52W: positive(input.min52W),
    max52W: positive(input.max52W),
    targetPrice: target,
    upside: relative(target),
    stopLoss: stop,
    downside: relative(stop),
  }
}
