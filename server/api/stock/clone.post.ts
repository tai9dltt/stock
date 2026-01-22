import puppeteer from 'puppeteer'

interface CloneRequestBody {
  url: string
  symbol: string
}

interface FinanceData {
  success: boolean
  data: unknown
  error?: string
}

export default defineEventHandler(async (event): Promise<FinanceData> => {
  const config = useRuntimeConfig()
  const body = await readBody<CloneRequestBody>(event)

  if (!body.url) {
    throw createError({
      statusCode: 400,
      statusMessage: 'URL is required'
    })
  }

  // Parse cookies from raw cookie string
  const rawCookie = config.vietstockCookie
  if (!rawCookie) {
    throw createError({
      statusCode: 500,
      statusMessage: 'Vietstock cookie not configured. Please add VIETSTOCK_COOKIE_RAW to .env'
    })
  }

  let browser: puppeteer.Browser | null = null

  try {
    // Launch Puppeteer browser
    browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    })

    const page = await browser.newPage()

    // Parse and set cookies
    const cookies = parseCookies(rawCookie, 'vietstock.vn')
    await page.setCookie(...cookies)

    // Variable to store intercepted finance data
    let financeData: unknown = null

    // Intercept API responses
    page.on('response', async (response) => {
      const url = response.url()
      if (url.includes('/data/financeinfo') || url.includes('/data/FinanceInfo')) {
        try {
          const json = await response.json()
          financeData = json
        } catch {
          // Response might not be JSON, ignore
        }
      }
    })

    // Navigate to the URL
    await page.goto(body.url, {
      waitUntil: 'networkidle2',
      timeout: 30000
    })

    // Wait a bit for any async data loading
    await new Promise(resolve => setTimeout(resolve, 2000))

    // If no data was intercepted, try to extract from page
    if (!financeData) {
      // Try to find finance data in page content or window object
      financeData = await page.evaluate(() => {
        // Check for common patterns where Vietstock might store data
        const win = window as Window & { financeData?: unknown; __financeData__?: unknown }
        if (win.financeData) return win.financeData
        if (win.__financeData__) return win.__financeData__

        // Try to find data tables and extract
        const tables = document.querySelectorAll('table.table-finance, table[data-finance]')
        if (tables.length > 0) {
          return { tableCount: tables.length, message: 'Tables found, manual parsing required' }
        }

        return null
      })
    }

    await browser.close()
    browser = null

    if (financeData) {
      return {
        success: true,
        data: financeData
      }
    }

    return {
      success: false,
      data: null,
      error: 'Could not extract finance data from page'
    }
  } catch (error) {
    if (browser) {
      await browser.close()
    }

    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    throw createError({
      statusCode: 500,
      statusMessage: `Failed to clone data: ${errorMessage}`
    })
  }
})

/**
 * Parse raw cookie string into Puppeteer cookie format
 */
function parseCookies(rawCookie: string, domain: string): puppeteer.CookieParam[] {
  return rawCookie.split(';').map(cookie => {
    const [name, ...valueParts] = cookie.trim().split('=')
    return {
      name: name.trim(),
      value: valueParts.join('=').trim(),
      domain: domain,
      path: '/'
    }
  }).filter(cookie => cookie.name && cookie.value)
}
