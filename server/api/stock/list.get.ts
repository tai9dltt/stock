import { query } from '../../utils/db'

interface StockSummary {
  id: number
  symbol: string
  created_at: Date
  updated_at: Date
  entry_price: number | null
  target_price: number | null
  stop_loss: number | null
}

export default defineEventHandler(async () => {
  try {
    const stocks = await query<StockSummary>(
      `SELECT sa.id, c.symbol, sa.created_at, sa.updated_at, sa.entry_price, sa.target_price, sa.stop_loss
       FROM stock_analysis sa
       JOIN companies c ON c.id = sa.company_id
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
