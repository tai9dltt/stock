import { query, queryOne } from '../../utils/db'

interface SmartUpdateResponse {
  success: boolean
  data?: {
    quarters: Record<string, any>
    annual: Record<string, any>
    newDataFetched: boolean
    message: string
  }
  error?: string
}

export default defineEventHandler(async (event): Promise<SmartUpdateResponse> => {
  const body = await readBody(event)
  const { symbol } = body as { symbol: string }

  if (!symbol) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Symbol is required'
    })
  }

  try {
    // 1. Check existing data in DB
    const existing = await queryOne<{ quarterly_data: string }>(
      'SELECT quarterly_data FROM stock_analysis WHERE UPPER(symbol) = UPPER(?)',
      [symbol]
    )

    let existingData: Record<string, any> = {}
    let existingAnnualData: Record<string, any> = {}

    if (existing?.quarterly_data) {
      const parsed = typeof existing.quarterly_data === 'string'
        ? JSON.parse(existing.quarterly_data)
        : existing.quarterly_data

      // Extract quarterly and annual data from existing
      existingData = parsed.quarterlyData || parsed.quarters || {}
      existingAnnualData = parsed.annualData || parsed.annual || {}
    }

    // 2. Fetch latest data from Vietstock
    const vietstockResponse = await $fetch<any>('/api/stock/fetch-vietstock', {
      method: 'POST',
      body: { code: symbol }
    })

    if (!vietstockResponse.success || !vietstockResponse.data) {
      return {
        success: false,
        error: 'Failed to fetch from Vietstock'
      }
    }

    const newQuarterlyData = vietstockResponse.data.quarters || {}
    const newAnnualData = vietstockResponse.data.annual || {}

    // 3. Merge quarterly data
    let hasNewData = false
    const mergedQuarterlyData = { ...existingData }

    for (const indicator in newQuarterlyData) {
      if (!mergedQuarterlyData[indicator]) {
        mergedQuarterlyData[indicator] = {}
        hasNewData = true
      }

      for (const year in newQuarterlyData[indicator]) {
        if (!mergedQuarterlyData[indicator][year]) {
          mergedQuarterlyData[indicator][year] = {}
          hasNewData = true
        }

        for (const quarter in newQuarterlyData[indicator][year]) {
          const existingValue = mergedQuarterlyData[indicator][year][quarter]
          const newValue = newQuarterlyData[indicator][year][quarter]

          if (newValue !== null && newValue !== undefined) {
            if (existingValue === null || existingValue === undefined) {
              mergedQuarterlyData[indicator][year][quarter] = newValue
              hasNewData = true
            }
          }
        }
      }
    }

    // 4. Merge annual data
    const mergedAnnualData = { ...existingAnnualData }

    for (const indicator in newAnnualData) {
      if (!mergedAnnualData[indicator]) {
        mergedAnnualData[indicator] = {}
        hasNewData = true
      }

      for (const year in newAnnualData[indicator]) {
        const existingValue = mergedAnnualData[indicator][year]
        const newValue = newAnnualData[indicator][year]

        if (newValue !== null && newValue !== undefined) {
          if (existingValue === null || existingValue === undefined) {
            mergedAnnualData[indicator][year] = newValue
            hasNewData = true
          }
        }
      }
    }

    // 5. Return merged data
    return {
      success: true,
      data: {
        quarters: mergedQuarterlyData,
        annual: mergedAnnualData,
        newDataFetched: hasNewData,
        message: hasNewData
          ? 'Đã cập nhật dữ liệu mới từ Vietstock'
          : 'Dữ liệu đã là mới nhất'
      }
    }

  } catch (error) {
    console.error('Smart update error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }
  }
})
