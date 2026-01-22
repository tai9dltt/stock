import { query, queryOne } from '../../utils/db'

interface QuarterlyAnalysisData {
  years: string[]
  quarters: Record<string, Record<string, Record<string, number | null>>>
  forecastStartYear: string
  forecastStartQuarter: string
  outstandingShares: number | null
  currentPrice: number | null
}

interface SaveRequestBody {
  symbol: string
  quarterlyData?: QuarterlyAnalysisData
  entryPrice?: number
  targetPrice?: number
  stopLoss?: number
  noteHtml?: string
}

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
  const body = await readBody<SaveRequestBody>(event)

  if (!body.symbol) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Stock symbol is required'
    })
  }

  try {
    const symbol = body.symbol.toUpperCase()

    // Check if record exists
    const existing = await queryOne<StockAnalysis>(
      'SELECT * FROM stock_analysis WHERE symbol = ?',
      [symbol]
    )

    let result: StockAnalysis

    if (existing) {
      // Update existing record
      await query(
        `UPDATE stock_analysis
         SET quarterly_data = ?, entry_price = ?,
             target_price = ?, stop_loss = ?, note_html = ?
         WHERE symbol = ?`,
        [
          body.quarterlyData ? JSON.stringify(body.quarterlyData) : null,
          body.entryPrice ?? null,
          body.targetPrice ?? null,
          body.stopLoss ?? null,
          body.noteHtml ?? null,
          symbol
        ]
      )

      result = (await queryOne<StockAnalysis>(
        'SELECT * FROM stock_analysis WHERE symbol = ?',
        [symbol]
      ))!
    } else {
      // Insert new record
      await query(
        `INSERT INTO stock_analysis
         (symbol, quarterly_data, entry_price, target_price, stop_loss, note_html)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [
          symbol,
          body.quarterlyData ? JSON.stringify(body.quarterlyData) : null,
          body.entryPrice ?? null,
          body.targetPrice ?? null,
          body.stopLoss ?? null,
          body.noteHtml ?? null
        ]
      )

      result = (await queryOne<StockAnalysis>(
        'SELECT * FROM stock_analysis WHERE symbol = ?',
        [symbol]
      ))!
    }

    return {
      success: true,
      data: result,
      message: `Stock analysis for ${symbol} saved successfully`
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    throw createError({
      statusCode: 500,
      statusMessage: `Failed to save stock analysis: ${errorMessage}`
    })
  }
})
