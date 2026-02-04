import { query, queryOne } from '../../utils/db'
import { resolveMetricCode } from '../../utils/metricMap'

const VIETSTOCK_API = 'https://finance.vietstock.vn/data/financeinfo'

interface CrawlRequest {
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
 * Parse Vietstock date format (YYYYMM or YYYYMMDD) to MySQL DATE
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
 * Fetch a single page from Vietstock API
 */
async function fetchPage(
  symbol: string,
  cookie: string,
  token: string,
  page: number
): Promise<any | null> {
  try {
    console.log(`📡 Fetching quarterly page ${page}...`)

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
        PageSize: '4',
        ReportTermType: '2', // Quarterly
        ReportType: 'BCTQ',
        Unit: '1000000',
        __RequestVerificationToken: token
      }).toString()
    })

    if (res.status >= 300 && res.status < 400) {
      console.warn(`Page ${page} redirected (auth failed)`)
      return null
    }

    const text = await res.text()
    if (!res.ok || text.startsWith('<')) {
      console.warn(`Page ${page} failed:`, res.status)
      return null
    }

    const data = JSON.parse(text)
    if (data && Array.isArray(data) && data.length > 0) {
      console.log(`✅ Page ${page}: ${data[0]?.length || 0} periods`)
      return data
    }

    return null
  } catch (error) {
    console.error(`Error fetching page ${page}:`, error)
    return null
  }
}

/**
 * Ensure company exists in DB
 */
async function ensureCompany(symbol: string): Promise<number> {
  const existing = await queryOne<{ id: number }>(
    'SELECT id FROM companies WHERE symbol = ?',
    [symbol.toUpperCase()]
  )
  if (existing) return existing.id

  // Use INSERT IGNORE or ON DUPLICATE KEY UPDATE to handle race conditions if needed
  // But here we check existing first.
  // With AUTO_INCREMENT, we don't provide ID.
  // We can treat `Date.now()` as `vietstock_id` placeholder or just skip it if we don't have it.

  const result = await query(
    'INSERT INTO companies (symbol, name) VALUES (?, ?)',
    [symbol.toUpperCase(), symbol.toUpperCase()]
  )
  return (result as any).insertId
}

/**
 * Upsert period
 */
async function upsertPeriod(companyId: number, symbol: string, period: PeriodData): Promise<number> {
  const quarter = period.TermCode.startsWith('Q')
    ? parseInt(period.TermCode.slice(1))
    : 0

  const existing = await queryOne<{ id: number }>(
    'SELECT id FROM periods WHERE company_id = ? AND year = ? AND quarter = ? AND source = ?',
    [companyId, period.YearPeriod, quarter, 'quarter']
  )
  if (existing) return existing.id

  const periodBegin = parseVietstockDate(period.PeriodBegin)
  const periodEnd = parseVietstockDate(period.PeriodEnd)

  const result = await query(
    `INSERT INTO periods (company_id, symbol, year, quarter, period_begin, period_end, source)
     VALUES (?, ?, ?, ?, ?, ?, 'quarter')`,
    [companyId, symbol, period.YearPeriod, quarter, periodBegin, periodEnd]
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
 * Process a single page response - store each period's metrics
 */
async function processPageData(
  companyId: number,
  symbol: string,
  pageData: any
): Promise<{ periodsProcessed: number; metricsStored: number }> {
  let periodsProcessed = 0
  let metricsStored = 0

  if (!Array.isArray(pageData)) return { periodsProcessed, metricsStored }

  const [periods = [], metricGroups = {}] = pageData

  // Create period ID map for this page
  const periodIdMap = new Map<string, number>()

  for (const period of periods) {
    const periodId = await upsertPeriod(companyId, symbol, period)
    periodIdMap.set(`${period.YearPeriod}_${period.TermCode}`, periodId)
    periodsProcessed++
  }

  // Process each metric group
  for (const groupName of ['Kết quả kinh doanh', 'Cân đối kế toán', 'Chỉ số tài chính']) {
    const metrics = metricGroups[groupName] || []

    for (const metric of metrics) {
      const metricCode = resolveMetricCode(metric.Name)
      if (!metricCode) continue

      const metricId = await getMetricId(metricCode)
      if (!metricId) continue

      // IMPORTANT: Use period's ID or Row to determine which Value field to use
      // Vietstock returns: ID=1 → Value1 (newest), ID=2 → Value2, etc.
      const periodsCount = periods.length;

      for (let i = 0; i < periodsCount && i < 4; i++) {
        const period = periods[i];

        // Use ID or Row from the period to get the correct Value
        const valueIndex = (period as any).ID || (period as any).Row || (i + 1);
        const value = metric[`Value${valueIndex}`];

        if (value === null || value === undefined) continue;

        const periodId = periodIdMap.get(`${period.YearPeriod}_${period.TermCode}`)
        if (!periodId) continue

        await upsertMetricValue(companyId, symbol, metricId, periodId, value)
        metricsStored++
      }
    }
  }

  return { periodsProcessed, metricsStored }
}

// Main handler
export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig()
  const body = await readBody<CrawlRequest>(event)

  const { symbol, pages = 4 } = body

  if (!symbol) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Symbol is required'
    })
  }

  const cookie = config.vietstockCookie
  const token = config.vietstockToken

  if (!cookie || !token) {
    throw createError({
      statusCode: 500,
      statusMessage: 'Vietstock credentials not configured'
    })
  }

  try {
    console.log(`📡 Crawling ${symbol} (${pages} pages)...`)

    const companyId = await ensureCompany(symbol)

    let totalPeriods = 0
    let totalMetrics = 0
    const years = new Set<number>()

    // Process each page independently
    for (let page = 1; page <= pages; page++) {
      const pageData = await fetchPage(symbol.toUpperCase(), cookie, token, page)

      if (!pageData) continue

      const stats = await processPageData(companyId, symbol.toUpperCase(), pageData)
      totalPeriods += stats.periodsProcessed
      totalMetrics += stats.metricsStored

      // Extract years
      const [periods = []] = pageData
      periods.forEach((p: any) => years.add(p.YearPeriod))

      // Anti rate-limit
      await new Promise(r => setTimeout(r, 500))
    }

    if (totalPeriods === 0) {
      return {
        success: false,
        error: 'No data returned from Vietstock'
      }
    }

    return {
      success: true,
      data: {
        companyId,
        periodsProcessed: totalPeriods,
        metricsStored: totalMetrics,
        years: [...years].sort((a, b) => b - a)
      }
    }

  } catch (error) {
    console.error('Crawl error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }
  }
})
