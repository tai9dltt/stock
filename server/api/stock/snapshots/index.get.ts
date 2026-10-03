import { query } from '../../../utils/db'
import { symbolQuerySchema } from '../../../utils/schemas'

/** Forecast journal of a stock, newest first */
export default defineEventHandler(async (event) => {
  const { symbol } = await getValidatedQuery(event, symbolQuerySchema.parse)

  const rows = await query<{ id: number; created_at: string; assumptions: unknown; forecast: unknown }>(
    `SELECT s.id, s.created_at, s.assumptions, s.forecast
     FROM forecast_snapshots s
     JOIN companies c ON c.id = s.company_id
     WHERE c.symbol = ?
     ORDER BY s.created_at DESC, s.id DESC
     LIMIT 50`,
    [symbol]
  )

  return {
    success: true,
    data: rows.map(r => ({ id: r.id, createdAt: r.created_at, assumptions: r.assumptions, forecast: r.forecast })),
  }
})
