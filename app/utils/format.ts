/**
 * Number formatting used across the app. Same convention as the sheet,
 * Vietstock and the Excel export: 1,234,567.8
 */

const isNumber = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v)

export function formatNumber(value: number | null | undefined, digits = 0): string {
  if (!isNumber(value)) return '–'
  return value.toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits })
}

/** 0.1234 → "12.3%"; signed adds "+" to positive values */
export function formatPercent(value: number | null | undefined, digits = 1, signed = false): string {
  if (!isNumber(value)) return '–'
  const text = `${(value * 100).toFixed(digits)}%`
  return signed && value > 0 ? `+${text}` : text
}

/** VND amount → "117.1 nghìn tỷ" / "845 tỷ" */
export function formatVndCompact(value: number | null | undefined): string {
  if (!isNumber(value)) return '–'
  const billions = value / 1e9
  if (Math.abs(billions) >= 1000) return `${formatNumber(billions / 1000, 1)} nghìn tỷ`
  return `${formatNumber(billions, 0)} tỷ`
}

/** "2026-10-03" or a Date-like string → "03/10/2026" */
export function formatDate(value: string | null | undefined): string {
  if (!value) return '–'
  const [y, m, d] = value.slice(0, 10).split('-')
  return y && m && d ? `${d}/${m}/${y}` : value
}
