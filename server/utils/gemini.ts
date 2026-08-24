import { GoogleGenAI, type FunctionDeclaration, Type } from '@google/genai'

// Initialize Gemini client
export function createGeminiClient() {
  const config = useRuntimeConfig()
  const apiKey = config.geminiApiKey

  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not configured')
  }

  return new GoogleGenAI({ apiKey })
}

// Gemini model to use across all API calls
export const GEMINI_MODEL = 'gemini-3.7-flash'

// System prompt for the AI agent
export const SYSTEM_PROMPT = `Bạn là một trợ lý AI chuyên về phân tích cổ phiếu Việt Nam. Bạn có thể:

1. **Lấy giá cổ phiếu real-time** từ Vietstock (giá hiện tại, giá cao/thấp 52 tuần, khối lượng)
2. **Lấy báo cáo tài chính** (EPS, ROE, ROA, P/E, doanh thu, lợi nhuận, vốn hóa)
3. **Xem danh sách cổ phiếu** đang được theo dõi trong hệ thống
4. **Đọc phân tích** đã lưu cho từng mã cổ phiếu
5. **Tìm kiếm Google** để lấy tin tức, bài phân tích, sự kiện mới nhất liên quan đến cổ phiếu và thị trường chứng khoán Việt Nam

Hướng dẫn:
- Luôn trả lời bằng tiếng Việt
- Khi người dùng hỏi về giá hoặc dữ liệu cổ phiếu, hãy gọi function tương ứng để lấy dữ liệu real-time, KHÔNG bao giờ đoán giá
- Khi phân tích, hãy đưa ra nhận xét dựa trên dữ liệu thực
- Khi cần tin tức, sự kiện, hoặc thông tin thị trường mới nhất, hãy sử dụng Google Search
- Hiển thị số liệu rõ ràng, dùng format tiền Việt Nam đồng khi cần
- Đơn vị tiền tệ trong BCTC là triệu VND
- Cổ phiếu code luôn viết HOA (ví dụ: PVD, VCB, HPG)
- Khi người dùng nhắc đến mã cổ phiếu, hãy tự động viết hoa
- Khi trả lời dựa trên kết quả tìm kiếm, hãy trích dẫn nguồn nếu có`

// Tool definitions for Gemini Function Calling
export const TOOL_DEFINITIONS: FunctionDeclaration[] = [
  {
    name: 'getStockPrice',
    description: 'Lấy giá cổ phiếu hiện tại và thông tin giao dịch real-time từ Vietstock. Trả về giá hiện tại, giá cao nhất/thấp nhất 52 tuần, số lượng CP lưu hành.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        symbol: {
          type: Type.STRING,
          description: 'Mã cổ phiếu (ví dụ: PVD, VCB, HPG)'
        }
      },
      required: ['symbol']
    }
  },
  {
    name: 'getFinancialData',
    description: 'Lấy báo cáo tài chính mới nhất từ Vietstock bao gồm: doanh thu, lợi nhuận, EPS, ROE, ROA, P/E, tổng tài sản, vốn chủ sở hữu. Dữ liệu theo quý và theo năm.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        symbol: {
          type: Type.STRING,
          description: 'Mã cổ phiếu (ví dụ: PVD, VCB, HPG)'
        }
      },
      required: ['symbol']
    }
  },
  {
    name: 'getStockList',
    description: 'Lấy danh sách tất cả cổ phiếu đang được theo dõi và phân tích trong hệ thống. Trả về mã CP, giá vào, giá mục tiêu, cắt lỗ.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        _unused: {
          type: Type.STRING,
          description: 'Không sử dụng, không cần truyền'
        }
      },
      required: []
    }
  },
  {
    name: 'getStockAnalysis',
    description: 'Lấy dữ liệu phân tích chi tiết đã lưu của một cổ phiếu, bao gồm các chỉ số tài chính, trading snapshot, giả định P/E, và ghi chú phân tích.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        symbol: {
          type: Type.STRING,
          description: 'Mã cổ phiếu (ví dụ: PVD, VCB, HPG)'
        }
      },
      required: ['symbol']
    }
  },
  {
    name: 'searchGoogle',
    description: 'Tìm kiếm Google để lấy tin tức, bài phân tích, sự kiện mới nhất liên quan đến cổ phiếu và thị trường chứng khoán Việt Nam. Sử dụng khi cần thông tin real-time từ internet.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        query: {
          type: Type.STRING,
          description: 'Từ khóa tìm kiếm (ví dụ: "tin tức PVD 2026", "thị trường chứng khoán Việt Nam hôm nay")'
        }
      },
      required: ['query']
    }
  }
]
