import { queryOne } from '../../utils/db'

interface StockAnalysis {
  id: number
  symbol: string
  quarterly_data: any
  entry_price: number | null
  target_price: number | null
  stop_loss: number | null
  note_html: string | null
  created_at: Date
  updated_at: Date
}

export default defineEventHandler(async (event) => {
  const queryParams = getQuery(event)
  const symbol = queryParams.symbol as string | undefined

  if (!symbol) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Stock symbol is required'
    })
  }

  try {
    const stockAnalysis = await queryOne<StockAnalysis>(
      'SELECT * FROM stock_analysis WHERE UPPER(symbol) = UPPER(?)',
      [symbol]
    )

    if (!stockAnalysis) {
      return {
        success: true,
        data: null,
        message: `No saved analysis found for ${symbol.toUpperCase()}`
      }
    }

    // Parse JSON field
    if (stockAnalysis.quarterly_data && typeof stockAnalysis.quarterly_data === 'string') {
      stockAnalysis.quarterly_data = JSON.parse(stockAnalysis.quarterly_data)
    }

    return {
      success: true,
      data: stockAnalysis
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    throw createError({
      statusCode: 500,
      statusMessage: `Failed to load stock analysis: ${errorMessage}`
    })
  }
})
