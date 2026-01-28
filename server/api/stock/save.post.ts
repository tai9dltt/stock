import type { PoolConnection } from 'mysql2/promise';
import { transaction } from '../../utils/db';


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
  // New format - manual edits only
  manualEdits?: {
    quarterly?: Record<string, any>
    annual?: Record<string, any>
  }
  pe2022?: number
  pe2023?: number
  outstandingShares?: number
  currentPrice?: number
  // Old format - for backward compatibility
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
    const symbol = body.symbol.toUpperCase();

    const result = await transaction(async (connection) => {
      // Get company ID first
      const [companies] = await connection.query<any[]>(
        'SELECT id, symbol FROM companies WHERE UPPER(symbol) = UPPER(?)',
        [symbol]
      );

      if (!companies || companies.length === 0) {
        throw createError({
          statusCode: 404,
          statusMessage: `Company ${symbol} not found. Please crawl data first.`,
        });
      }

      const company = companies[0];

      // Check if record exists using company_id
      const [existingRows] = await connection.query<any[]>(
        'SELECT * FROM stock_analysis WHERE company_id = ?',
        [company.id]
      );

      const existing = existingRows?.[0];

      // Prepare data to save - prefer new format, fallback to old
      const dataToSave = body.manualEdits
        ? {
          manualEdits: body.manualEdits,
          pe2022: body.pe2022,
          pe2023: body.pe2023,
          outstandingShares: body.outstandingShares,
          currentPrice: body.currentPrice,
        }
        : body.quarterlyData;

      if (existing) {
        // Update existing record
        await connection.query(
          `UPDATE stock_analysis
           SET quarterly_data = ?, entry_price = ?,
               target_price = ?, stop_loss = ?, note_html = ?
           WHERE company_id = ?`,
          [
            dataToSave ? JSON.stringify(dataToSave) : null,
            body.entryPrice ?? null,
            body.targetPrice ?? null,
            body.stopLoss ?? null,
            body.noteHtml ?? null,
            company.id,
          ]
        );
      } else {
        // Insert new record
        await connection.query(
          `INSERT INTO stock_analysis
           (company_id, symbol, quarterly_data, entry_price, target_price, stop_loss, note_html)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [
            company.id,
            symbol,
            dataToSave ? JSON.stringify(dataToSave) : null,
            body.entryPrice ?? null,
            body.targetPrice ?? null,
            body.stopLoss ?? null,
            body.noteHtml ?? null,
          ]
        );
      }

      // Sync forecast periods to DB
      if (body.manualEdits) {
        await ensureForecastPeriods(connection, company.id, symbol, body.manualEdits);
      }

      // Fetch final result
      const [resultRows] = await connection.query<any[]>(
        'SELECT * FROM stock_analysis WHERE company_id = ?',
        [company.id]
      );

      return resultRows[0] as StockAnalysis;
    });

    return {
      success: true,
      data: result,
      message: `Stock analysis for ${symbol} saved successfully`,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    throw createError({
      statusCode: 500,
      statusMessage: `Failed to save stock analysis: ${errorMessage}`
    })
  }
})

/**
 * Ensure forecast periods exist for manual edits
 */
async function ensureForecastPeriods(
  connection: PoolConnection,
  companyId: number,
  symbol: string,
  manualEdits: any
) {
  const currentYear = new Date().getFullYear()
  const years = new Set<number>()

  // Collect years from quarterly edits
  if (manualEdits.quarterly) {
    for (const indicatorKey in manualEdits.quarterly) {
      const yearData = manualEdits.quarterly[indicatorKey]
      if (yearData) {
        Object.keys(yearData).forEach(y => years.add(parseInt(y)))
      }
    }
  }

  // Collect years from annual edits
  if (manualEdits.annual) {
    for (const indicatorKey in manualEdits.annual) {
      const yearData = manualEdits.annual[indicatorKey]
      if (yearData) {
        Object.keys(yearData).forEach(y => years.add(parseInt(y)))
      }
    }
  }

  // Insert forecast periods for current/future years
  for (const year of years) {
    if (isNaN(year) || year < currentYear) continue

    await connection.query(
      `INSERT INTO periods (company_id, symbol, year, quarter, period_begin, period_end, source, is_forecast)
       VALUES (?, ?, ?, 0, ?, ?, 'year', ?)
       ON DUPLICATE KEY UPDATE is_forecast = VALUES(is_forecast)`,
      [
        companyId,
        symbol,
        year,
        `${year}-01-01`,
        `${year}-12-31`,
        true, // is_forecast = true
      ]
    );
  }
}

