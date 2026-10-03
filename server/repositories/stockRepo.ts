/**
 * Write-side DB access for crawled stock data.
 * Every function takes a connection so callers can run them inside one transaction.
 */

import type { PoolConnection, ResultSetHeader, RowDataPacket } from 'mysql2/promise'
import type { ParsedPeriod, ParsedValue } from '../crawler/vietstock/parser'

type PeriodSource = 'quarter' | 'year'

const BULK_CHUNK_SIZE = 500

/**
 * Get or create company, returns its id (race-safe via LAST_INSERT_ID trick).
 */
export async function ensureCompany(conn: PoolConnection, symbol: string): Promise<number> {
  const [result] = await conn.query<ResultSetHeader>(
    `INSERT INTO companies (symbol, name) VALUES (?, ?)
     ON DUPLICATE KEY UPDATE id = LAST_INSERT_ID(id)`,
    [symbol, symbol]
  )
  return result.insertId
}

export async function findCompanyId(conn: PoolConnection, symbol: string): Promise<number | null> {
  const [rows] = await conn.query<RowDataPacket[]>(
    'SELECT id FROM companies WHERE symbol = ?',
    [symbol]
  )
  return rows[0]?.id ?? null
}

/**
 * Load metric code → id map in one query.
 */
export async function loadMetricIds(conn: PoolConnection): Promise<Map<string, number>> {
  const [rows] = await conn.query<RowDataPacket[]>('SELECT id, code FROM metrics')
  return new Map(rows.map(r => [r.code as string, r.id as number]))
}

/**
 * Bulk upsert periods and return a `${year}_${quarter}` → period id map.
 *
 * Existing periods get the dates Vietstock reports now; existing yearly periods
 * are also marked as actual (is_forecast = FALSE).
 */
export async function upsertPeriods(
  conn: PoolConnection,
  companyId: number,
  source: PeriodSource,
  periods: ParsedPeriod[]
): Promise<Map<string, number>> {
  if (periods.length > 0) {
    const rows = periods.map(p => [
      companyId, p.year, p.quarter, p.periodBegin, p.periodEnd, source, false,
    ])
    // Dates always follow Vietstock (older crawls stored some wrong ones)
    const onDuplicate = [
      'period_begin = COALESCE(VALUES(period_begin), period_begin)',
      'period_end = COALESCE(VALUES(period_end), period_end)',
      ...(source === 'year' ? ['is_forecast = FALSE'] : []),
    ].join(', ')

    await conn.query(
      `INSERT INTO periods (company_id, year, quarter, period_begin, period_end, source, is_forecast)
       VALUES ? ON DUPLICATE KEY UPDATE ${onDuplicate}`,
      [rows]
    )
  }

  const [rows] = await conn.query<RowDataPacket[]>(
    'SELECT id, year, quarter FROM periods WHERE company_id = ? AND source = ?',
    [companyId, source]
  )
  return new Map(rows.map(r => [`${r.year}_${r.quarter}`, r.id as number]))
}

/**
 * Bulk upsert metric values. Values whose metric code or period is unknown are skipped.
 * Returns the number of values written.
 */
export async function upsertMetricValues(
  conn: PoolConnection,
  companyId: number,
  values: ParsedValue[],
  periodIds: Map<string, number>,
  metricIds: Map<string, number>
): Promise<{ written: number; unknownMetricCodes: string[] }> {
  const unknown = new Set<string>()
  const rows: number[][] = []

  for (const v of values) {
    const metricId = metricIds.get(v.metricCode)
    if (!metricId) {
      unknown.add(v.metricCode)
      continue
    }
    const periodId = periodIds.get(`${v.year}_${v.quarter}`)
    if (!periodId) continue

    rows.push([companyId, metricId, periodId, v.value])
  }

  for (let i = 0; i < rows.length; i += BULK_CHUNK_SIZE) {
    await conn.query(
      `INSERT INTO metric_values (company_id, metric_id, period_id, value)
       VALUES ? ON DUPLICATE KEY UPDATE value = VALUES(value)`,
      [rows.slice(i, i + BULK_CHUNK_SIZE)]
    )
  }

  return { written: rows.length, unknownMetricCodes: [...unknown] }
}

/**
 * If the current year was not returned by Vietstock, add it as a forecast year.
 * An existing row for the current year is left as-is.
 */
export async function ensureCurrentYearForecast(
  conn: PoolConnection,
  companyId: number,
  crawledYears: number[]
): Promise<void> {
  const currentYear = new Date().getFullYear()
  if (crawledYears.includes(currentYear)) return

  const [existing] = await conn.query<RowDataPacket[]>(
    `SELECT id FROM periods WHERE company_id = ? AND year = ? AND quarter = 0 AND source = 'year'`,
    [companyId, currentYear]
  )
  if (existing.length > 0) return

  await conn.query(
    `INSERT INTO periods (company_id, year, quarter, period_begin, period_end, source, is_forecast)
     VALUES (?, ?, 0, ?, ?, 'year', TRUE)`,
    [companyId, currentYear, `${currentYear}-01-01`, `${currentYear}-12-31`]
  )
  console.log(`✅ Added forecast period for ${currentYear}`)
}

/**
 * Years that have quarterly data but no Q4 yet (still in progress) are marked as forecast.
 *
 * Only a missing Q4 counts: the oldest year in the crawl window usually lacks its
 * early quarters (e.g. only Q3, Q4) but is a finished year, not a forecast.
 */
export async function markIncompleteYearsAsForecast(
  conn: PoolConnection,
  companyId: number,
  years: number[]
): Promise<void> {
  if (years.length === 0) return

  const [rows] = await conn.query<RowDataPacket[]>(
    `SELECT year, MAX(quarter) AS last_quarter
     FROM periods
     WHERE company_id = ? AND year IN (?) AND quarter > 0
     GROUP BY year`,
    [companyId, years]
  )

  const incomplete = rows.filter(r => r.last_quarter < 4).map(r => r.year as number)
  if (incomplete.length === 0) return

  console.log(`⚠️ Incomplete years marked as forecast: ${incomplete.join(', ')}`)
  await conn.query(
    `UPDATE periods SET is_forecast = TRUE
     WHERE company_id = ? AND year IN (?) AND quarter = 0 AND source = 'year'`,
    [companyId, incomplete]
  )
}

export interface TradingSnapshotInput {
  lastPrice?: number
  outstandingShares?: number
  listedShares?: number
  min52W?: number
  max52W?: number
  vol52W?: number
}

/**
 * Upsert today's trading snapshot (one row per company per trading date).
 */
export async function upsertTradingSnapshot(
  conn: PoolConnection,
  companyId: number,
  tradingDate: string,
  info: TradingSnapshotInput
): Promise<void> {
  const marketCap = info.lastPrice && info.outstandingShares
    ? Math.round(info.lastPrice * info.outstandingShares)
    : null

  await conn.query(
    `INSERT INTO trading_snapshots
       (company_id, trading_date, last_price, outstanding_shares, listed_shares,
        market_cap, min_52w_price, max_52w_price, vol_52w)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
       last_price = VALUES(last_price),
       outstanding_shares = VALUES(outstanding_shares),
       listed_shares = VALUES(listed_shares),
       market_cap = VALUES(market_cap),
       min_52w_price = VALUES(min_52w_price),
       max_52w_price = VALUES(max_52w_price),
       vol_52w = VALUES(vol_52w)`,
    [
      companyId, tradingDate,
      info.lastPrice ?? null, info.outstandingShares ?? null, info.listedShares ?? null,
      marketCap, info.min52W ?? null, info.max52W ?? null, info.vol52W ?? null,
    ]
  )
}

/**
 * Add yearly forecast periods for years the user added with "Add Year".
 * Existing periods (actual or forecast) are left untouched; a later crawl
 * marks a year as actual once Vietstock reports it.
 */
export async function ensureForecastYears(conn: PoolConnection, companyId: number, years: number[]): Promise<void> {
  if (years.length === 0) return

  const rows = years.map(year => [companyId, year, 0, `${year}-01-01`, `${year}-12-31`, 'year', true])
  await conn.query(
    `INSERT INTO periods (company_id, year, quarter, period_begin, period_end, source, is_forecast)
     VALUES ? ON DUPLICATE KEY UPDATE id = id`,
    [rows]
  )
}
