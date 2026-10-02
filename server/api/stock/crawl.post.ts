import { CrawlNoDataError, crawlStock } from '../../crawler/crawlStock'
import { VietstockAuthError } from '../../crawler/vietstock/client'
import { crawlBodySchema } from '../../utils/schemas'

export default defineEventHandler(async (event) => {
  const { symbol, ...options } = await readValidatedBody(event, crawlBodySchema.parse)

  try {
    const data = await crawlStock(symbol, options)
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
