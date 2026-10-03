import { query } from '../../utils/db'

interface StockSummaryRow {
  id: number
  symbol: string
  created_at: Date
  updated_at: Date
  entry_price: string | null
  target_price: string | null
  stop_loss: string | null
  last_price: string | null
  price_date: string | null
}

export default defineEventHandler(async () => {
  try {
    // Latest trading snapshot per company, if any
    const stocks = await query<StockSummaryRow>(
      `SELECT sa.id, c.symbol, sa.created_at, sa.updated_at, sa.entry_price, sa.target_price, sa.stop_loss,
              ts.last_price, DATE_FORMAT(ts.trading_date, '%Y-%m-%d') AS price_date
       FROM stock_analysis sa
       JOIN companies c ON c.id = sa.company_id
       LEFT JOIN trading_snapshots ts ON ts.company_id = sa.company_id
         AND ts.trading_date = (SELECT MAX(trading_date) FROM trading_snapshots WHERE company_id = sa.company_id)
       ORDER BY sa.updated_at DESC`
    )

    return {
      success: true,
      data: stocks
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    throw createError({
      statusCode: 500,
      statusMessage: `Failed to fetch stock list: ${errorMessage}`
    })
  }
})
