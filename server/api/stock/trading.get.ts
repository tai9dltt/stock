import { transaction } from '../../utils/db'
import { fetchTradingInfoRaw, toTradingInfo } from '../../crawler/vietstock/tradingInfo'
import { findCompanyId, upsertTradingSnapshot } from '../../repositories/stockRepo'
import { symbolQuerySchema } from '../../utils/schemas'

/**
 * Fetch live trading info from Vietstock and store today's snapshot.
 */
export default defineEventHandler(async (event) => {
  const { symbol } = await getValidatedQuery(event, symbolQuerySchema.parse)

  try {
    const raw = await fetchTradingInfoRaw(symbol)
    if (!raw) {
      return { success: false, error: 'No trading info returned from Vietstock' }
    }

    const tradingInfo = toTradingInfo(raw)

    // Snapshot is best-effort: a DB problem must not hide the live price
    try {
      await transaction(async (conn) => {
        const companyId = await findCompanyId(conn, symbol)
        if (!companyId || !tradingInfo.lastPrice) return

        const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date())
        await upsertTradingSnapshot(conn, companyId, symbol, today, tradingInfo)
      })
    } catch (error) {
      console.warn('⚠️ Could not save trading snapshot:', error instanceof Error ? error.message : error)
    }

    return { success: true, data: { tradingInfo } }
  } catch (error) {
    console.error('Trading info error:', error)
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
  }
})
