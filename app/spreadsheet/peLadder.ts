/**
 * P/E scenarios of the valuation table: a ladder from the stock's own P/E
 * history (last 5 years of reported quarters) plus the current P/E.
 */

import type { AnalysisSheetData } from './types'

export interface PeLevel {
  value: number
  /** Short meaning shown next to the value, e.g. "trung vị" */
  label: string
}

const HISTORY_YEARS = 5
/** Levels closer than this (relative) count as the same level */
const MIN_GAP = 0.03
/** Reported P/E above this multiple of the median is an outlier (tiny EPS) */
const OUTLIER_FACTOR = 3
/** Used when the stock has too little history */
const FALLBACK = [8, 10, 12, 15, 20]

const round2 = (v: number) => Math.round(v * 100) / 100

function percentile(sorted: number[], p: number): number {
  const i = (sorted.length - 1) * p
  const lo = Math.floor(i)
  const hi = Math.ceil(i)
  return sorted[lo]! + (sorted[hi]! - sorted[lo]!) * (i - lo)
}

const numbers = (series: Record<string, Record<string, unknown>> | undefined) =>
  Object.entries(series ?? {}).flatMap(([year, quarters]) =>
    Object.entries(quarters ?? {})
      .map(([quarter, v]) => ({ year: Number(year), quarter, value: Number(v) }))
      .filter(({ value }) => Number.isFinite(value)))

/** Price ÷ trailing 4-quarter EPS of the latest reported quarter (as in the summary bar) */
export function currentPe(data: Pick<AnalysisSheetData, 'currentPrice' | 'quarterlyData'>): number | null {
  const latest = numbers(data.quarterlyData['eps'])
    .sort((a, b) => a.year - b.year || a.quarter.localeCompare(b.quarter))
    .at(-1)
  return data.currentPrice > 0 && latest && latest.value > 0 ? round2(data.currentPrice / latest.value) : null
}

/** Reported quarterly P/E of the last 5 years, without outliers */
function peHistory(data: Pick<AnalysisSheetData, 'quarterlyData'>): number[] {
  const all = numbers(data.quarterlyData['pe']).filter(({ value }) => value > 0)
  if (all.length === 0) return []
  const lastYear = Math.max(...all.map(p => p.year))
  const recent = all.filter(p => p.year > lastYear - HISTORY_YEARS).map(p => p.value).sort((a, b) => a - b)
  const median = percentile(recent, 0.5)
  return recent.filter(v => v <= median * OUTLIER_FACTOR)
}

/**
 * Distinct P/E levels, low to high. Candidates in order of importance; one
 * too close to a level already taken is dropped.
 */
export function peLadder(data: Pick<AnalysisSheetData, 'currentPrice' | 'quarterlyData'>): PeLevel[] {
  const history = peHistory(data)
  const current = currentPe(data)

  const candidates: PeLevel[] = []
  if (current !== null) candidates.push({ value: current, label: 'hiện tại' })
  if (history.length >= 4) {
    candidates.push(
      { value: percentile(history, 0.5), label: 'trung vị' },
      { value: history[0]!, label: 'thấp nhất' },
      { value: history.at(-1)!, label: 'cao nhất' },
      { value: percentile(history, 0.25), label: 'vùng thấp' },
      { value: percentile(history, 0.75), label: 'vùng cao' },
    )
  }
  candidates.push(...FALLBACK.map(value => ({ value, label: '' })))

  const levels: PeLevel[] = []
  for (const { value, label } of candidates) {
    const v = round2(value)
    // Fallback levels only fill in when the history gives too few
    if (!label && levels.length >= 3) break
    if (levels.some(l => Math.abs(l.value - v) <= MIN_GAP * Math.max(l.value, v))) continue
    levels.push({ value: v, label })
  }

  return levels.sort((a, b) => a.value - b.value)
}

/** Remove repeated values (kept in the user's order) */
export function distinctPe(values: number[]): number[] {
  const seen = new Set<number>()
  return values.filter((v) => {
    const key = round2(v)
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

/** Number format of a P/E cell: the value, then its label if it is a ladder level */
export function peFormat(value: number | undefined, labels: Map<number, string>): string {
  const label = value === undefined ? undefined : labels.get(round2(value))
  return label ? `0.00" · ${label}"` : '0.00'
}
