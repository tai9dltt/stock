import { query, queryOne } from '../../utils/db'

interface StockData {
  companyId: number
  symbol: string
  periods: {
    id: number
    year: number
    quarter: number
    source: string
  }[]
  metrics: Record<string, Record<string, number | null>>  // metricCode -> {2024_Q1: value, ...}
  tradingSnapshot?: {
    lastPrice: number
    outstandingShares: number
    marketCap: number
    pe: number
    eps: number
    tradingDate: string
  }
}

export default defineEventHandler(async (event) => {
  const query_params = getQuery(event)
  const symbol = query_params.symbol as string

  if (!symbol) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Symbol is required'
    })
  }

  try {
    // 1. Get company
    const company = await queryOne<{ id: number; symbol: string; name: string }>(
      'SELECT id, symbol, name FROM companies WHERE UPPER(symbol) = UPPER(?)',
      [symbol]
    )

    if (!company) {
      return {
        success: true,
        data: null,
        message: `Company ${symbol.toUpperCase()} not found. Try crawling first.`
      }
    }

    // 2. Get all periods for this company
    const periods = await query<{ id: number; year: number; quarter: number; source: string; is_forecast: number }>(
      `SELECT id, year, quarter, source, is_forecast
       FROM periods
       WHERE company_id = ?
       ORDER BY year DESC, quarter DESC`,
      [company.id]
    )

    // 3. Get all metric values with metric info
    const metricValues = await query<{
      metric_code: string
      metric_name: string
      year: number
      quarter: number
      value: number
    }>(
      `SELECT
        m.code as metric_code,
        m.name as metric_name,
        p.year,
        p.quarter,
        mv.value
       FROM metric_values mv
       JOIN metrics m ON mv.metric_id = m.id
       JOIN periods p ON mv.period_id = p.id
       WHERE mv.company_id = ?
       ORDER BY m.display_order, p.year DESC, p.quarter DESC`,
      [company.id]
    )

    // 4. Transform to nested structure: metricCode -> {year_quarter: value}
    // Separate quarterly and yearly metrics
    const quarterlyMetrics: Record<string, Record<string, number | null>> = {}
    const yearlyMetrics: Record<string, Record<string, number | null>> = {}

    for (const mv of metricValues) {
      const isYearly = mv.quarter === 0
      const targetMetrics = isYearly ? yearlyMetrics : quarterlyMetrics

      if (!targetMetrics[mv.metric_code]) {
        targetMetrics[mv.metric_code] = {}
      }

      const periodKey = isYearly
        ? `${mv.year}`  // Just year for yearly
        : `${mv.year}_Q${mv.quarter}`  // year_Q1 for quarterly

      targetMetrics[mv.metric_code][periodKey] = mv.value
    }

    // 5. Get latest trading snapshot if any
    const snapshot = await queryOne<{
      last_price: number
      outstanding_shares: number
      market_cap: number
      pe: number
      eps: number
      trading_date: string
    }>(
      `SELECT last_price, outstanding_shares, market_cap, pe, eps, trading_date
       FROM trading_snapshots
       WHERE company_id = ?
       ORDER BY trading_date DESC
       LIMIT 1`,
      [company.id]
    )

    // 6. Get user analysis if any
    const analysis = await queryOne<{
      quarterly_data: any
      entry_price: number | null
      target_price: number | null
      stop_loss: number | null
      note_html: string | null
      pe_assumptions: string | null
    }>(
      `SELECT quarterly_data, entry_price, target_price, stop_loss, note_html, pe_assumptions
       FROM stock_analysis
       WHERE company_id = ?`,
      [company.id]
    )

    const parseJSON = (jsonData: string | object | null) => {
      if (!jsonData) return null
      // If MySQL driver already parsed JSON (when column type is JSON), return as-is
      if (typeof jsonData === 'object') return jsonData
      // Otherwise parse the string
      try {
        return JSON.parse(jsonData)
      } catch (e) {
        console.error('Failed to parse JSON:', jsonData, e)
        return null
      }
    }

    return {
      success: true,
      data: {
        companyId: company.id,
        symbol: company.symbol,
        name: company.name,
        periods,
        metrics: quarterlyMetrics,
        yearlyMetrics: yearlyMetrics,
        tradingSnapshot: snapshot ? {
          lastPrice: Number(snapshot.last_price),
          outstandingShares: Number(snapshot.outstanding_shares),
          marketCap: Number(snapshot.market_cap),
          pe: Number(snapshot.pe),
          eps: Number(snapshot.eps),
          tradingDate: snapshot.trading_date
        } : null,
        analysis: analysis ? {
          quarterlyData: parseJSON(analysis.quarterly_data),
          entryPrice: analysis.entry_price ? Number(analysis.entry_price) : null,
          targetPrice: analysis.target_price ? Number(analysis.target_price) : null,
          stopLoss: analysis.stop_loss ? Number(analysis.stop_loss) : null,
          noteHtml: analysis.note_html,
          peAssumptions: parseJSON(analysis.pe_assumptions)
        } : null
      }
    }



  } catch (error) {
    console.error('Get stock error:', error)
    throw createError({
      statusCode: 500,
      statusMessage: error instanceof Error ? error.message : 'Unknown error'
    })
  }
})
