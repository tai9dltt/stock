import { queryOne, transaction } from '../../utils/db'
import { ensureForecastYears } from '../../repositories/stockRepo'
import { saveBodySchema } from '../../utils/schemas'

/**
 * Save the user's inputs for a stock: forecast assumptions, P/E scenarios,
 * shares per quarter, forecast years, trading plan and notes. Crawled figures
 * are not stored here; they live in metric_values.
 */
export default defineEventHandler(async (event) => {
  const body = await readValidatedBody(event, saveBodySchema.parse)

  const company = await queryOne<{ id: number }>('SELECT id FROM companies WHERE symbol = ?', [body.symbol])
  if (!company) {
    throw createError({
      statusCode: 404,
      statusMessage: `Company ${body.symbol} not found. Please crawl data first.`,
    })
  }

  const json = (v: unknown) => (v === undefined || v === null ? null : JSON.stringify(v))

  // Only future years can be added as forecasts
  const currentYear = new Date().getFullYear()
  const forecastYears = [...new Set(body.forecastYears.map(Number))]
    .filter(year => year >= currentYear && year <= currentYear + 30)

  try {
    await transaction(async (conn) => {
      await ensureForecastYears(conn, company.id, forecastYears)
      await conn.query(
        `INSERT INTO stock_analysis
           (company_id, revenue_growth, gross_margin, net_profit_growth, pe_scenarios, shares_by_quarter,
            growth_overrides, current_price, outstanding_shares, max_52w, min_52w, entry_price, target_price, stop_loss, note_html)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE
           revenue_growth = VALUES(revenue_growth),
           gross_margin = VALUES(gross_margin),
           net_profit_growth = VALUES(net_profit_growth),
           pe_scenarios = VALUES(pe_scenarios),
           shares_by_quarter = VALUES(shares_by_quarter),
           growth_overrides = VALUES(growth_overrides),
           current_price = VALUES(current_price),
           outstanding_shares = VALUES(outstanding_shares),
           max_52w = VALUES(max_52w),
           min_52w = VALUES(min_52w),
           entry_price = VALUES(entry_price),
           target_price = VALUES(target_price),
           stop_loss = VALUES(stop_loss),
           note_html = VALUES(note_html)`,
        [
          company.id,
          body.revenueGrowth, body.grossMargin, body.netProfitGrowth,
          json(body.peScenarios), json(body.sharesByQuarter), json(body.growthOverrides),
          body.currentPrice || null, body.outstandingShares || null, body.max52W || null, body.min52W || null,
          body.entryPrice ?? null, body.targetPrice ?? null, body.stopLoss ?? null, body.noteHtml ?? null,
        ]
      )
    })
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    throw createError({ statusCode: 500, statusMessage: `Failed to save stock analysis: ${errorMessage}` })
  }

  return { success: true, message: `Stock analysis for ${body.symbol} saved successfully` }
})
