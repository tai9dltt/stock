import { query, queryOne } from '../../utils/db'
import { symbolQuerySchema } from '../../utils/schemas'

export default defineEventHandler(async (event) => {
  const { symbol } = await getValidatedQuery(event, symbolQuerySchema.parse)

  try {
    // 1. Get company
    const company = await queryOne<{ id: number; symbol: string; name: string }>(
      'SELECT id, symbol, name FROM companies WHERE symbol = ?',
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

      targetMetrics[mv.metric_code]![periodKey] = mv.value
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
      `SELECT last_price, outstanding_shares, market_cap, pe, eps,
              DATE_FORMAT(trading_date, '%Y-%m-%d') AS trading_date
       FROM trading_snapshots
       WHERE company_id = ?
       ORDER BY trading_date DESC
       LIMIT 1`,
      [company.id]
    )

    // 6. Get user analysis if any (DECIMAL columns come back as strings)
    const analysis = await queryOne<Record<string, any>>(
      `SELECT revenue_growth, gross_margin, net_profit_growth, pe_scenarios, shares_by_quarter,
              current_price, outstanding_shares, max_52w, min_52w,
              entry_price, target_price, stop_loss, note_html
       FROM stock_analysis
       WHERE company_id = ?`,
      [company.id]
    )

    const num = (v: unknown) => (v === null || v === undefined ? null : Number(v))

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
          revenueGrowth: Number(analysis.revenue_growth),
          grossMargin: Number(analysis.gross_margin),
          netProfitGrowth: Number(analysis.net_profit_growth),
          peScenarios: analysis.pe_scenarios,
          sharesByQuarter: analysis.shares_by_quarter,
          currentPrice: num(analysis.current_price),
          outstandingShares: num(analysis.outstanding_shares),
          max52W: num(analysis.max_52w),
          min52W: num(analysis.min_52w),
          entryPrice: analysis.entry_price ? Number(analysis.entry_price) : null,
          targetPrice: analysis.target_price ? Number(analysis.target_price) : null,
          stopLoss: analysis.stop_loss ? Number(analysis.stop_loss) : null,
          noteHtml: analysis.note_html,
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
