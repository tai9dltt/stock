import type { H3Event } from 'h3'
import { createGeminiClient, GEMINI_MODEL, SYSTEM_PROMPT, TOOL_DEFINITIONS } from '../../utils/gemini'
import { query, queryOne } from '../../utils/db'
import { getVietstockCredentials } from '../../utils/vietstockAuth'

interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

interface ChatRequest {
  messages: ChatMessage[]
}

// ─── Tool execution functions ───────────────────────────────────────

async function executeGetStockPrice(symbol: string) {
  try {
    const { cookie, token } = await getVietstockCredentials()
    const bodyParams: Record<string, string> = {
      code: symbol.toUpperCase(),
      s: '0',
      t: ''
    }
    if (token) bodyParams['__RequestVerificationToken'] = token

    const response = await fetch('https://finance.vietstock.vn/company/tradinginfo', {
      method: 'POST',
      headers: {
        'Accept': '*/*',
        'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
        'Cookie': cookie,
        'Referer': `https://finance.vietstock.vn/${symbol.toUpperCase()}`
      },
      body: new URLSearchParams(bodyParams).toString()
    })

    if (!response.ok) {
      return { error: `API returned status ${response.status}` }
    }

    const data = await response.json()
    return {
      symbol: symbol.toUpperCase(),
      lastPrice: data.LastPrice,
      priceChange: data.ChangePc,
      volume: data.TotalVol,
      outstandingShares: data.KLCPLH,
      listedShares: data.KLCPNY,
      min52W: data.Min52W,
      max52W: data.Max52W,
      foreignBuyVol: data.FBuyVol,
      foreignSellVol: data.FSellVol
    }
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Unknown error' }
  }
}

async function executeGetFinancialData(symbol: string) {
  try {
    const { cookie, token } = await getVietstockCredentials()
    const code = symbol.toUpperCase()
    const bodyParams: Record<string, string> = {
      Code: code,
      Page: '1',
      PageSize: '4',
      ReportTermType: '1', // Annual
      ReportType: 'BCTQ',
      Unit: '1000000'
    }
    if (token) bodyParams['__RequestVerificationToken'] = token

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
      return { error: `API returned status ${response.status}` }
    }

    const rawData = await response.json()
    if (!rawData || !Array.isArray(rawData) || rawData.length < 2) {
      return { error: 'Không có dữ liệu tài chính' }
    }

    const [periods, indicators] = rawData
    if (!periods || !indicators) {
      return { error: 'Dữ liệu không hợp lệ' }
    }

    // Extract key metrics
    const result: Record<string, Record<string, number | null>> = {}
    const keyNames = [
      'Doanh thu thuần', 'Lợi nhuận gộp', 'LNST của CĐ cty mẹ',
      'EPS cơ bản', 'BVPS cơ bản', 'P/E cơ bản', 'ROE', 'ROEA',
      'ROA', 'ROAA', 'ROS', 'Tổng tài sản', 'Vốn chủ sở hữu',
      'Nợ phải trả', 'Thu nhập lãi thuần', 'LNST của CĐ Ngân hàng mẹ',
      'Tổng TNTT'
    ]

    // Collect all indicators
    const allIndicators: any[] = []
    for (const section of Object.values(indicators)) {
      if (Array.isArray(section)) {
        allIndicators.push(...section)
      }
    }

    // Parse periods and values
    periods.forEach((period: any) => {
      const year = period.YearPeriod?.toString()
      const valueIndex = period.ID || period.Row
      if (!year) return

      allIndicators.forEach((item: any) => {
        if (!keyNames.includes(item.Name)) return
        const valueKey = `Value${valueIndex}`
        const value = item[valueKey]
        if (value !== null && value !== undefined) {
          if (!result[item.Name]) result[item.Name] = {}
          result[item.Name][year] = Number(value)
        }
      })
    })

    return {
      symbol: code,
      unit: 'triệu VND',
      data: result
    }
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Unknown error' }
  }
}

async function executeGetStockList() {
  try {
    const stocks = await query<{
      id: number; symbol: string; entry_price: number | null
      target_price: number | null; stop_loss: number | null; updated_at: Date
    }>(
      'SELECT id, symbol, entry_price, target_price, stop_loss, updated_at FROM stock_analysis ORDER BY updated_at DESC'
    )
    return {
      count: stocks.length,
      stocks: stocks.map(s => ({
        symbol: s.symbol,
        entryPrice: s.entry_price,
        targetPrice: s.target_price,
        stopLoss: s.stop_loss,
        updatedAt: s.updated_at
      }))
    }
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Unknown error' }
  }
}

async function executeGetStockAnalysis(symbol: string) {
  try {
    const company = await queryOne<{ id: number; symbol: string; name: string }>(
      'SELECT id, symbol, name FROM companies WHERE UPPER(symbol) = UPPER(?)',
      [symbol]
    )

    if (!company) {
      return { error: `Không tìm thấy mã ${symbol.toUpperCase()} trong hệ thống` }
    }

    // Get trading snapshot
    const snapshot = await queryOne<{
      last_price: number; outstanding_shares: number; market_cap: number
      pe: number; eps: number; trading_date: string
    }>(
      'SELECT last_price, outstanding_shares, market_cap, pe, eps, trading_date FROM trading_snapshots WHERE company_id = ? ORDER BY trading_date DESC LIMIT 1',
      [company.id]
    )

    // Get analysis
    const analysis = await queryOne<{
      entry_price: number | null; target_price: number | null
      stop_loss: number | null; note_html: string | null
    }>(
      'SELECT entry_price, target_price, stop_loss, note_html FROM stock_analysis WHERE company_id = ?',
      [company.id]
    )

    return {
      symbol: company.symbol,
      name: company.name,
      tradingSnapshot: snapshot ? {
        lastPrice: Number(snapshot.last_price),
        outstandingShares: Number(snapshot.outstanding_shares),
        marketCap: Number(snapshot.market_cap),
        pe: Number(snapshot.pe),
        eps: Number(snapshot.eps),
        tradingDate: snapshot.trading_date
      } : null,
      analysis: analysis ? {
        entryPrice: analysis.entry_price,
        targetPrice: analysis.target_price,
        stopLoss: analysis.stop_loss,
        hasNotes: !!analysis.note_html
      } : null
    }
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Unknown error' }
  }
}

// ─── Execute a tool call ────────────────────────────────────────────

async function executeTool(name: string, args: Record<string, any>): Promise<any> {
  switch (name) {
    case 'getStockPrice':
      return await executeGetStockPrice(args.symbol)
    case 'getFinancialData':
      return await executeGetFinancialData(args.symbol)
    case 'getStockList':
      return await executeGetStockList()
    case 'getStockAnalysis':
      return await executeGetStockAnalysis(args.symbol)
    case 'searchGoogle':
      return await executeGoogleSearch(args.query)
    default:
      return { error: `Unknown tool: ${name}` }
  }
}

/**
 * Perform Google Search via a separate Gemini API call with built-in googleSearch tool.
 * This workaround is needed because gemini-3.7-flash doesn't allow combining
 * googleSearch (built-in) with functionDeclarations in the same request.
 */
async function executeGoogleSearch(query: string): Promise<any> {
  try {
    const ai = createGeminiClient()

    const response = await ai.models.generateContent({
      model: GEMINI_MODEL,
      contents: [{ role: 'user' as const, parts: [{ text: query }] }],
      config: {
        tools: [{ googleSearch: {} }]
      }
    })

    const text = response.candidates?.[0]?.content?.parts
      ?.filter((p: any) => p.text)
      ?.map((p: any) => p.text)
      ?.join('\n') || ''

    // Extract grounding metadata (sources)
    const groundingMetadata = (response.candidates?.[0] as any)?.groundingMetadata
    const sources = groundingMetadata?.groundingChunks
      ?.map((chunk: any) => ({
        title: chunk.web?.title || '',
        url: chunk.web?.uri || ''
      }))
      ?.filter((s: any) => s.url) || []

    return {
      query,
      summary: text,
      sources: sources.slice(0, 5) // Limit to top 5 sources
    }
  } catch (error) {
    console.error('Google Search error:', error)
    return { error: 'Không thể tìm kiếm Google lúc này', query }
  }
}

// ─── Main chat endpoint ─────────────────────────────────────────────

export default defineEventHandler(async (event: H3Event) => {
  const body = await readBody<ChatRequest>(event)

  if (!body.messages || !Array.isArray(body.messages) || body.messages.length === 0) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Messages array is required'
    })
  }

  try {
    const ai = createGeminiClient()

    // Build Gemini contents from chat history
    const contents = body.messages.map(msg => ({
      role: msg.role === 'assistant' ? 'model' as const : 'user' as const,
      parts: [{ text: msg.content }]
    }))

    // Create chat with tools (Function Calling only - google_search cannot be combined with function calling)
    const toolsConfig = [
      { functionDeclarations: TOOL_DEFINITIONS }
    ]

    const response = await ai.models.generateContent({
      model: GEMINI_MODEL,
      contents,
      config: {
        systemInstruction: SYSTEM_PROMPT,
        tools: toolsConfig
      }
    })

    // Handle function calling loop
    let currentResponse = response
    const maxIterations = 5
    let iteration = 0

    while (iteration < maxIterations) {
      const candidate = currentResponse.candidates?.[0]
      if (!candidate?.content?.parts) break

      // Check for function calls
      const functionCalls = candidate.content.parts.filter(
        (part: any) => part.functionCall
      )

      if (functionCalls.length === 0) break

      // Execute all function calls
      const functionResponses = []
      for (const part of functionCalls) {
        const fc = (part as any).functionCall
        console.log(`🤖 AI calling tool: ${fc.name}(${JSON.stringify(fc.args)})`)

        const result = await executeTool(fc.name, fc.args || {})
        console.log(`✅ Tool result for ${fc.name}:`, JSON.stringify(result).substring(0, 200))

        functionResponses.push({
          functionResponse: {
            name: fc.name,
            response: result
          }
        })
      }

      // Send function results back to Gemini
      const updatedContents = [
        ...contents,
        { role: 'model' as const, parts: candidate.content.parts },
        { role: 'user' as const, parts: functionResponses }
      ]

      currentResponse = await ai.models.generateContent({
        model: GEMINI_MODEL,
        contents: updatedContents,
        config: {
          systemInstruction: SYSTEM_PROMPT,
          tools: toolsConfig
        }
      })

      iteration++
    }

    // Extract final text response
    const finalText = currentResponse.candidates?.[0]?.content?.parts
      ?.filter((part: any) => part.text)
      ?.map((part: any) => part.text)
      ?.join('') || 'Xin lỗi, tôi không thể xử lý yêu cầu này.'

    return {
      success: true,
      message: finalText
    }

  } catch (error) {
    console.error('AI Chat error:', error)

    const errorMessage = error instanceof Error ? error.message : String(error)

    // Return user-friendly error
    if (errorMessage.includes('API_KEY')) {
      return {
        success: false,
        message: '🔑 API key chưa được cấu hình. Vui lòng thêm GEMINI_API_KEY vào file .env'
      }
    }

    if (errorMessage.includes('429') || errorMessage.includes('RESOURCE_EXHAUSTED') || errorMessage.includes('quota')) {
      return {
        success: false,
        message: '⏳ Đã vượt giới hạn API miễn phí. Vui lòng chờ khoảng 1 phút rồi thử lại, hoặc bật billing tại Google AI Studio để có quota cao hơn.'
      }
    }

    if (errorMessage.includes('403') || errorMessage.includes('PERMISSION_DENIED')) {
      return {
        success: false,
        message: '🔒 API key không hợp lệ hoặc không có quyền truy cập. Vui lòng kiểm tra lại GEMINI_API_KEY trong file .env'
      }
    }

    return {
      success: false,
      message: `❌ Đã xảy ra lỗi: ${errorMessage.substring(0, 200)}`
    }
  }
})
