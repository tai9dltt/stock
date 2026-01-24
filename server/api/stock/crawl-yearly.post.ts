import { query, queryOne } from '../../utils/db'
import { resolveMetricCode } from '../../utils/metricMap'

const VIETSTOCK_API = 'https://finance.vietstock.vn/data/financeinfo'

interface CrawlYearlyRequest {
  symbol: string
  pages?: number
}

interface PeriodData {
  YearPeriod: number
  TermCode: string
  PeriodBegin: string
  PeriodEnd: string
}

/**
 * Parse Vietstock date format
 */
function parseVietstockDate(dateStr: string | null | undefined): string | null {
  if (!dateStr) return null
  const digits = dateStr.replace(/\D/g, '')
  if (digits.length === 6) {
    return `${digits.slice(0, 4)}-${digits.slice(4, 6)}-01`
  } else if (digits.length === 8) {
    return `${digits.slice(0, 4)}-${digits.slice(4, 6)}-${digits.slice(6, 8)}`
  }
  return null
}

/**
 * Fetch yearly data from Vietstock API (ReportTermType=3)
 */
async function fetchYearlyPages(
  symbol: string,
  cookie: string,
  token: string,
  numPages: number = 4
): Promise<any[]> {
  const responses: any[] = []

  for (let page = 1; page <= numPages; page++) {
    try {
      console.log(`📡 Fetching yearly page ${page}...`)

      const res = await fetch(VIETSTOCK_API, {
        method: 'POST',
        redirect: 'manual',
        headers: {
          'Accept': '*/*',
          'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
          'Cookie': cookie,
          'X-Requested-With': 'XMLHttpRequest',
          'Referer': `https://finance.vietstock.vn/${symbol}`,
          'Origin': 'https://finance.vietstock.vn'
        },
        body: new URLSearchParams({
          Code: symbol,
          Page: page.toString(),
          PageSize: '1',
          ReportTermType: '1', // Yearly data
          ReportType: 'BCTQ', // Changed from BCTN
          Unit: '1000000',
          __RequestVerificationToken: token
        }).toString()
      })

      if (res.status >= 300 && res.status < 400) {
        console.warn(`Yearly page ${page} redirected`)
        continue
      }

      const text = await res.text()
      if (!res.ok || text.startsWith('<')) {
        console.warn(`Yearly page ${page} failed:`, res.status)
        continue
      }

      const data = JSON.parse(text)
      if (data && Array.isArray(data) && data.length > 0) {
        responses.push(data)
        console.log(`✅ Yearly page ${page}: ${data[0]?.length || 0} periods`)
      }

      await new Promise(r => setTimeout(r, 500))
    } catch (error) {
      console.error(`Error fetching yearly page ${page}:`, error)
    }
  }

  console.log('responses crawl year:', responses)

  return responses
}

/**
 * Merge yearly responses
 */
function mergeYearlyResponses(responses: any[]) {
  const periodMap = new Map<string, PeriodData>()
  const metricGroups: Record<string, Map<string, any>> = {
    'Kết quả kinh doanh': new Map(),
    'Cân đối kế toán': new Map(),
    'Chỉ số tài chính': new Map()
  }

  for (const resp of responses) {
    if (!Array.isArray(resp)) continue
    const [periods = [], metrics = {}] = resp

    for (const p of periods) {
      const key = `${p.YearPeriod}_YEAR`
      periodMap.set(key, { ...p, TermCode: 'YEAR' })
    }

    for (const groupName of Object.keys(metricGroups)) {
      const items = metrics[groupName] || []
      for (const m of items) {
        const key = `${m.ReportNormID}`
        const existing = metricGroups[groupName].get(key)
        if (!existing) {
          metricGroups[groupName].set(key, { ...m })
        } else {
          for (let i = 1; i <= 4; i++) {
            const field = `Value${i}`
            if (m[field] !== null && m[field] !== undefined) {
              existing[field] = m[field]
            }
          }
        }
      }
    }
  }

  return {
    periods: [...periodMap.values()],
    metrics: {
      'Kết quả kinh doanh': [...metricGroups['Kết quả kinh doanh'].values()],
      'Cân đối kế toán': [...metricGroups['Cân đối kế toán'].values()],
      'Chỉ số tài chính': [...metricGroups['Chỉ số tài chính'].values()]
    }
  }
}

/**
 * Get or create company
 */
async function ensureCompany(symbol: string): Promise<number> {
  const existing = await queryOne<{ id: number }>(
    'SELECT id FROM companies WHERE symbol = ?',
    [symbol.toUpperCase()]
  )
  if (existing) return existing.id

  // Use INSERT IGNORE or ON DUPLICATE KEY UPDATE check if needed
  // With AUTO_INCREMENT, we ignore ID
  const result = await query(
    'INSERT INTO companies (symbol, name) VALUES (?, ?)',
    [symbol.toUpperCase(), symbol.toUpperCase()]
  )
  return (result as any).insertId
}

/**
 * Upsert yearly period (quarter=0)
 */
async function upsertYearlyPeriod(companyId: number, symbol: string, period: PeriodData, isForecast: boolean = false): Promise<number> {
  const existing = await queryOne<{ id: number }>(
    'SELECT id FROM periods WHERE company_id = ? AND year = ? AND quarter = 0 AND source = ?',
    [companyId, period.YearPeriod, 'year']
  )

  if (existing) {
    // Update is_forecast status if needed (e.g. converting forecast to actual)
    if (!isForecast) {
      await query(
        'UPDATE periods SET is_forecast = ? WHERE id = ?',
        [false, existing.id]
      )
    }
    return existing.id
  }

  const periodBegin = parseVietstockDate(period.PeriodBegin)
  const periodEnd = parseVietstockDate(period.PeriodEnd)

  const result = await query(
    `INSERT INTO periods (company_id, symbol, year, quarter, period_begin, period_end, source, is_forecast)
     VALUES (?, ?, ?, 0, ?, ?, 'year', ?)`,
    [companyId, symbol, period.YearPeriod, periodBegin, periodEnd, isForecast]
  )
  return (result as any).insertId
}

/**
 * Get metric ID
 */
async function getMetricId(code: string): Promise<number | null> {
  const metric = await queryOne<{ id: number }>('SELECT id FROM metrics WHERE code = ?', [code])
  return metric?.id || null
}

/**
 * Upsert metric value
 */
async function upsertMetricValue(companyId: number, symbol: string, metricId: number, periodId: number, value: number): Promise<void> {
  await query(
    `INSERT INTO metric_values (company_id, symbol, metric_id, period_id, value, source)
     VALUES (?, ?, ?, ?, ?, 'vietstock')
     ON DUPLICATE KEY UPDATE value = VALUES(value)`,
    [companyId, symbol, metricId, periodId, value]
  )
}

/**
 * Process and store yearly data
 */
async function processYearlyData(companyId: number, symbol: string, mergedData: ReturnType<typeof mergeYearlyResponses>) {
  let periodsAdded = 0
  let metricsAdded = 0

  const periodIdMap = new Map<string, number>()

  for (const period of mergedData.periods) {
    const periodId = await upsertYearlyPeriod(companyId, symbol, period)
    periodIdMap.set(`${period.YearPeriod}_YEAR`, periodId)
    periodsAdded++
  }

  for (const [, metrics] of Object.entries(mergedData.metrics)) {
    for (const metric of metrics) {
      const metricCode = resolveMetricCode(metric.Name)
      if (!metricCode) continue

      const metricId = await getMetricId(metricCode)
      if (!metricId) continue

      // IMPORTANT: Vietstock periods are DESC, Values are ASC.
      // Value1 -> Oldest (Last index), Value4 -> Newest (First index)
      const periodsCount = mergedData.periods.length;

      for (let i = 0; i < periodsCount && i < 4; i++) {
        const periodIndex = periodsCount - 1 - i;
        if (periodIndex < 0) continue;

        const period = mergedData.periods[periodIndex];
        const value = metric[`Value${i + 1}`];

        if (value === null || value === undefined) continue;

        const periodId = periodIdMap.get(`${period.YearPeriod}_YEAR`)
        if (!periodId) continue

        await upsertMetricValue(companyId, symbol, metricId, periodId, value)
        metricsAdded++
      }
    }
  }

  return { periodsAdded, metricsAdded }
}

/**
 * Ensure current year exists as forecast if not crawled
 */
async function ensureCurrentYearForecast(companyId: number, symbol: string, crawledYears: number[]) {
  const currentYear = new Date().getFullYear()

  // If current year is NOT in crawled data, add it as forecast
  if (!crawledYears.includes(currentYear)) {
    console.log(`⚠️ Current year ${currentYear} missing from crawl. Adding as forecast...`)

    // Check if exists
    const existing = await queryOne<{ id: number, is_forecast: number }>(
      'SELECT id, is_forecast FROM periods WHERE company_id = ? AND year = ? AND quarter = 0 AND source = ?',
      [companyId, currentYear, 'year']
    )

    if (existing) {
      // If manual forecast exists, keep it.
      // If it marks as actual (is_forecast=0) but we know it's missing from crawl?
      // Actually if it exists, leave it. The crawl checked and didn't find data,
      // so if it was "actual" from previous crawl, it should have been updated by upsertYearlyPeriod above if data existed.
      // But verify: If is_forecast is false, but now it's missing from crawl? Maybe data was removed?
      // For safety, let's only Insert if missing. If exists, assume user/system manages it.
      // But user requirement: "nếu check ko có năm hiện tại thì đó là năm forcast (cần update DB)"

      // So if exists and is_forecast=0, should we flip it to 1?
      // If it was 0, it meant it was actual data. If now missing from Vietstock, maybe we should respect Vietstock?
      // But usually actual data doesn't disappear.
      // Let's just ensure it exists. If it doesn't exist, insert as forecast.
      if (!existing.is_forecast) {
        // Should we force it to forecast? Maybe not for now to be safe.
      }
    } else {
      // Insert new forecast period
      await query(
        `INSERT INTO periods (company_id, symbol, year, quarter, period_begin, period_end, source, is_forecast)
         VALUES (?, ?, ?, 0, ?, ?, 'year', ?)`,
        [companyId, symbol, currentYear, `${currentYear}-01-01`, `${currentYear}-12-31`, true]
      )
      console.log(`✅ Added forecast period for ${currentYear}`)
    }
  }
}

/**
 * Check if years are incomplete (missing quarters) and mark as forecast
 */
async function updateIncompleteYearsStatus(companyId: number, years: number[]) {
  if (years.length === 0) return

  // Check quarter counts for these years
  console.log(`🔍 Checking incomplete status for years: ${years.join(', ')}`)

  const placeholders = years.map(() => '?').join(',')
  const rows = await query<{ year: number; q_count: number }>(
    `SELECT year, COUNT(*) as q_count
     FROM periods
     WHERE company_id = ? AND year IN (${placeholders}) AND quarter > 0
     GROUP BY year`,
    [companyId, ...years]
  )

  console.log('🔍 Update status rows:', rows)

  const debugLogs: string[] = []
  debugLogs.push(`Years: ${years.join(', ')}`)

  for (const row of rows) {
    // If has data (q_count > 0) but incomplete (< 4)
    if (row.q_count > 0 && row.q_count < 4) {
      const msg = `⚠️ Year ${row.year} is incomplete (${row.q_count} quarters). Marking as forecast...`
      console.log(msg)
      debugLogs.push(msg)

      const result = await query(
        'UPDATE periods SET is_forecast = ? WHERE company_id = ? AND year = ? AND quarter = 0 AND source = ?',
        [true, companyId, row.year, 'year']
      )
      debugLogs.push(`Update result: ${(result as any).changedRows} rows changed`)
    } else {
      debugLogs.push(`Year ${row.year}: ${row.q_count} quarters (Complete/Empty)`)
    }
  }
  return debugLogs
}

// Main handler
export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig()
  const body = await readBody<CrawlYearlyRequest>(event)
  const { symbol, pages = 1 } = body

  if (!symbol) {
    throw createError({ statusCode: 400, statusMessage: 'Symbol is required' })
  }

  const cookie = config.vietstockCookie
  const token = config.vietstockToken

  if (!cookie || !token) {
    throw createError({ statusCode: 500, statusMessage: 'Vietstock credentials not configured' })
  }

  try {
    console.log(`Crawling yearly data for ${symbol}...`)

    const responses = await fetchYearlyPages(symbol.toUpperCase(), cookie, token, 1)

    if (responses.length === 0) {
      return { success: false, error: 'No yearly data returned from Vietstock' }
    }

    const mergedData = mergeYearlyResponses(responses)
    console.log(`Merged yearly: ${mergedData.periods.length} periods`)

    const companyId = await ensureCompany(symbol)
    const stats = await processYearlyData(companyId, symbol.toUpperCase(), mergedData)

    // Ensure current year forecast exists
    const crawledYears = mergedData.periods.map(p => p.YearPeriod)
    await ensureCurrentYearForecast(companyId, symbol.toUpperCase(), crawledYears)

    // Check and update incomplete years (e.g. 2025 with missing quarters)
    await updateIncompleteYearsStatus(companyId, crawledYears)

    return {
      success: true,
      data: {
        companyId,
        periodsProcessed: stats.periodsAdded,
        metricsStored: stats.metricsAdded,
        years: mergedData.periods.map(p => p.YearPeriod)
      }
    }
  } catch (error) {
    console.error('Yearly crawl error:', error)
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
  }
})
