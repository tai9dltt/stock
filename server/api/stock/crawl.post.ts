import { CrawlNoDataError, crawlStock, type CrawlType } from '../../crawler/crawlStock'
import { VietstockAuthError } from '../../crawler/vietstock/client'

interface CrawlRequest {
  symbol: string
  type?: CrawlType
  quarterPages?: number
  yearPages?: number
}

const CRAWL_TYPES: CrawlType[] = ['all', 'quarter', 'year']

export default defineEventHandler(async (event) => {
  const { symbol, type = 'all', quarterPages, yearPages } = await readBody<CrawlRequest>(event)

  if (!symbol) {
    throw createError({ statusCode: 400, statusMessage: 'Symbol is required' })
  }
  if (!CRAWL_TYPES.includes(type)) {
    throw createError({ statusCode: 400, statusMessage: `type must be one of: ${CRAWL_TYPES.join(', ')}` })
  }

  try {
    const data = await crawlStock(symbol, { type, quarterPages, yearPages })
    return { success: true, data }
  } catch (error) {
    console.error('Crawl error:', error)

    const message = error instanceof VietstockAuthError
      ? 'Không đăng nhập được Vietstock, kiểm tra VIETSTOCK_EMAIL/VIETSTOCK_PASSWORD'
      : error instanceof CrawlNoDataError
        ? error.message
        : error instanceof Error ? error.message : 'Unknown error'

    return { success: false, error: message }
  }
})
