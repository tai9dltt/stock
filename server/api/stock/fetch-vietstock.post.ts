import type { H3Event } from 'h3'

interface QuarterlyDataResponse {
  success: boolean
  data?: {
    quarters: Record<string, Record<string, Record<string, number>>>
    annual: Record<string, Record<string, number>>
    tradingInfo?: {
      lastPrice?: number
      outstandingShares?: number
      listedShares?: number
      min52W?: number
      max52W?: number
      vol52W?: number
    }
  }
  error?: string
}

// Map Vietstock indicator names to our keys
const indicatorMap: Record<string, string> = {
  // Income Statement (Industrial)
  'Doanh thu thuần': 'netRevenue',
  'Lợi nhuận gộp': 'grossProfit',
  'LN thuần từ HĐKD': 'operatingProfit',
  'LN thuần từ HĐKD ': 'operatingProfit', // with space
  'LNST thu nhập DN': 'enterpriseNetProfit',
  'LNST của CĐ cty mẹ': 'netProfit',
  'LNST của CĐ cty mẹ ': 'netProfit', // with space

  // Bank-specific Income Statement
  'Thu nhập lãi thuần': 'netInterestIncome',
  'Chi phí hoạt động': 'operatingExpenses',
  'Tổng TNTT': 'totalOperatingIncome',
  'Tổng thu nhập từ hoạt động': 'totalOperatingIncome',
  'Tổng LNST': 'totalNetProfit',
  'LNST của CĐ Ngân hàng mẹ': 'netProfit',
  'Lợi nhuận sau thuế của cổ đông ngân hàng mẹ': 'netProfit',

  // Balance Sheet
  'Tài sản ngắn hạn': 'currentAssets',
  'Tổng tài sản': 'totalAssets',
  'Tổng tài sản ': 'totalAssets', // with space
  'Nợ phải trả': 'totalLiabilities',
  'Nợ ngắn hạn': 'shortTermDebt',
  'Vốn chủ sở hữu': 'shareholdersEquity',
  'Lợi ích của CĐ thiểu số': 'minorityInterest',

  // Financial Ratios
  'EPS 4 quý': 'eps',
  'EPS cơ bản': 'eps', // Annual usually provides basic EPS
  'EPS': 'eps',
  'BVPS cơ bản': 'bvps',
  'BVPS': 'bvps',
  'P/E cơ bản': 'pe',
  'P/E': 'pe',
  'ROS': 'ros',
  'ROEA': 'roe',
  'ROE': 'roe',
  'ROAA': 'roa',
  'ROA': 'roa',

  // Shares
  'Số CP lưu hành': 'outstandingShares',
}

// Create empty result structure
function createEmptyResult(): Record<string, Record<string, Record<string, number>>> {
  return {
    // Income Statement (Industrial)
    netRevenue: {},
    grossProfit: {},
    operatingProfit: {},
    enterpriseNetProfit: {},
    netProfit: {},

    // Bank-specific Income Statement
    netInterestIncome: {},
    operatingExpenses: {},
    totalOperatingIncome: {},
    totalNetProfit: {},

    // Balance Sheet
    currentAssets: {},
    totalAssets: {},
    totalLiabilities: {},
    shortTermDebt: {},
    shareholdersEquity: {},
    minorityInterest: {},

    // Financial Ratios
    eps: {},
    bvps: {},
    pe: {},
    ros: {},
    roe: {},
    roa: {},

    // Shares
    outstandingShares: {},
  }
}

// Helper to call Vietstock API for quarterly data
async function fetchVietstockQuarterlyData(code: string, cookie: string, token: string) {
  const allData: any[] = []

  // Fetch 4 pages to get multiple years of quarterly data
  for (let page = 1; page <= 4; page++) {
    try {
      const bodyParams: Record<string, string> = {
        Code: code,
        Page: page.toString(),
        PageSize: '4',
        ReportTermType: '2', // Quarterly
        ReportType: 'BCTQ',
        Unit: '1000000'
      }

      if (token) {
        bodyParams['__RequestVerificationToken'] = token
      }

      const response = await fetch('https://finance.vietstock.vn/data/financeinfo', {
        method: 'POST',
        headers: {
          'Accept': '*/*',
          'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
          'Cookie': cookie,
          'Referer': `https://finance.vietstock.vn/${code}`
        },
        body: new URLSearchParams(bodyParams).toString()
      })

      if (!response.ok) {
        console.warn(`Failed to fetch quarterly page ${page} for ${code}`)
        continue
      }

      const pageData = await response.json()
      if (pageData && Array.isArray(pageData) && pageData.length > 0) {
        allData.push(pageData)
      }
    } catch (error) {
      console.error(`Error fetching quarterly page ${page}:`, error)
    }
  }

  return allData
}

// Helper to call Vietstock API for annual data
async function fetchVietstockAnnualData(code: string, cookie: string, token: string) {
  try {
    const bodyParams: Record<string, string> = {
      Code: code,
      Page: '1',
      PageSize: '4',
      ReportTermType: '1', // Annual (Năm)
      ReportType: 'BCTQ',
      Unit: '1000000'
    }

    if (token) {
      bodyParams['__RequestVerificationToken'] = token
    }

    const response = await fetch('https://finance.vietstock.vn/data/financeinfo', {
      method: 'POST',
      headers: {
        'Accept': '*/*',
        'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
        'Cookie': cookie,
        'Referer': `https://finance.vietstock.vn/${code}`
      },
      body: new URLSearchParams(bodyParams).toString()
    })

    if (!response.ok) {
      console.warn(`Failed to fetch annual data for ${code}`)
      return null
    }

    return await response.json()
  } catch (error) {
    console.error('Error fetching annual data:', error)
    return null
  }
}

// Helper to call Vietstock API for trading info
async function fetchVietstockTradingInfo(code: string, cookie: string, token: string) {
  try {
    const bodyParams: Record<string, string> = {
      code: code,
      s: '0',
      t: ''
    }

    if (token) {
      bodyParams['__RequestVerificationToken'] = token
    }

    const response = await fetch('https://finance.vietstock.vn/company/tradinginfo', {
      method: 'POST',
      headers: {
        'Accept': '*/*',
        'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
        'Cookie': cookie,
        'Referer': `https://finance.vietstock.vn/${code}`
      },
      body: new URLSearchParams(bodyParams).toString()
    })

    if (!response.ok) {
      console.warn(`Failed to fetch trading info for ${code}`)
      return null
    }

    return await response.json()
  } catch (error) {
    console.error('Error fetching trading info:', error)
    return null
  }
}

// Parse trading info response
function parseTradingInfo(rawData: any) {
  if (!rawData) return undefined

  return {
    lastPrice: rawData.LastPrice,
    outstandingShares: rawData.KLCPLH,
    listedShares: rawData.KLCPNY,
    min52W: rawData.Min52W,
    max52W: rawData.Max52W,
    vol52W: rawData.Vol52W
  }
}

// Parse all indicator sections from API response
function parseAllIndicators(rawData: any): any[] {
  const [, indicators] = rawData
  if (!indicators) return []

  const allIndicators: any[] = []

  // Parse Income Statement
  if (indicators['Kết quả kinh doanh']) {
    allIndicators.push(...indicators['Kết quả kinh doanh'])
  }

  // Parse Balance Sheet
  if (indicators['Cân đối kế toán']) {
    allIndicators.push(...indicators['Cân đối kế toán'])
  }

  // Parse Financial Ratios
  if (indicators['Chỉ số tài chính']) {
    allIndicators.push(...indicators['Chỉ số tài chính'])
  }

  return allIndicators
}

// Parse Vietstock quarterly response to our format
function parseVietstockQuarterlyData(allPagesData: any[]): Record<string, Record<string, Record<string, number>>> {
  const result = createEmptyResult()

  allPagesData.forEach((rawData) => {
    const [periods] = rawData
    if (!periods) return

    const allIndicators = parseAllIndicators(rawData)

    // Process each period
    periods.forEach((period: any, periodIndex: number) => {
      const year = period.YearPeriod.toString()
      const quarter = period.TermCode // 'Q1', 'Q2', 'Q3', 'Q4'

      allIndicators.forEach((item: any) => {
        const mappedKey = indicatorMap[item.Name]
        if (!mappedKey || !result[mappedKey]) return

        if (!result[mappedKey][year]) {
          result[mappedKey][year] = {}
        }

        const valueKey = `Value${periodIndex + 1}`
        const value = item[valueKey]

        if (value !== null && value !== undefined) {
          result[mappedKey][year][quarter] = Number(value)
        }
      })
    })
  })

  return result
}

// Parse Vietstock annual response to our format
function parseVietstockAnnualData(rawData: any): Record<string, Record<string, number>> {
  const result: Record<string, Record<string, number>> = {
    // Industrial
    netRevenue: {},
    grossProfit: {},
    operatingProfit: {},
    enterpriseNetProfit: {},
    netProfit: {},
    // Bank-specific
    netInterestIncome: {},
    operatingExpenses: {},
    totalOperatingIncome: {},
    totalNetProfit: {},
    // Balance Sheet
    currentAssets: {},
    totalAssets: {},
    totalLiabilities: {},
    shortTermDebt: {},
    shareholdersEquity: {},
    minorityInterest: {},
    // Ratios
    eps: {},
    bvps: {},
    pe: {},
    ros: {},
    roe: {},
    roa: {},
    outstandingShares: {},
  }

  if (!rawData || !Array.isArray(rawData) || rawData.length < 2) {
    return result
  }

  const [periods] = rawData
  if (!periods) return result

  const allIndicators = parseAllIndicators(rawData)

  // Process each period (each year)
  periods.forEach((period: any, periodIndex: number) => {
    const year = period.YearPeriod.toString()

    allIndicators.forEach((item: any) => {
      const mappedKey = indicatorMap[item.Name]
      if (!mappedKey || !result[mappedKey]) return

      const valueKey = `Value${periodIndex + 1}`
      const value = item[valueKey]

      if (value !== null && value !== undefined) {
        result[mappedKey][year] = Number(value)
      }
    })
  })

  return result
}

export default defineEventHandler(async (event: H3Event): Promise<QuarterlyDataResponse> => {
  const config = useRuntimeConfig()
  const body = await readBody(event)

  const { code } = body as { code: string }

  if (!code) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Stock code is required'
    })
  }

  const cookie = config.vietstockCookie
  const token = config.vietstockToken
  if (!cookie) {
    throw createError({
      statusCode: 500,
      statusMessage: 'Vietstock cookie not configured'
    })
  }

  try {
    // Fetch quarterly, annual, and trading data in parallel
    const [quarterlyPagesData, annualRawData, tradingRawData] = await Promise.all([
      fetchVietstockQuarterlyData(code.toUpperCase(), cookie, token),
      fetchVietstockAnnualData(code.toUpperCase(), cookie, token),
      fetchVietstockTradingInfo(code.toUpperCase(), cookie, token)
    ])

    // Parse quarterly data
    let parsedQuarterly: Record<string, Record<string, Record<string, number>>> = createEmptyResult()
    if (quarterlyPagesData && quarterlyPagesData.length > 0) {
      parsedQuarterly = parseVietstockQuarterlyData(quarterlyPagesData)
    }

    // Parse annual data
    let parsedAnnual: Record<string, Record<string, number>> = {}
    if (annualRawData) {
      parsedAnnual = parseVietstockAnnualData(annualRawData)
    }

    // Parse trading info
    const parsedTradingInfo = parseTradingInfo(tradingRawData)

    return {
      success: true,
      data: {
        quarters: parsedQuarterly,
        annual: parsedAnnual,
        tradingInfo: parsedTradingInfo
      }
    }
  } catch (error) {
    console.error('Error fetching Vietstock data:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }
  }
})
