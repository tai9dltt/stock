/**
 * Metric mapping from Vietstock API names to internal codes
 * Includes alias handling for variations in Vietstock naming
 */

// Raw mapping from Vietstock Vietnamese names to internal codes
export const METRIC_MAP: Record<string, string> = {
  // ===== INCOME STATEMENT =====
  'Doanh thu thuần': 'REVENUE_NET',
  'Doanh thu bán hàng và cung cấp dịch vụ': 'REVENUE_NET',
  'Doanh thu': 'REVENUE_NET',

  'Giá vốn hàng bán': 'COST_OF_GOODS_SOLD',
  'Giá vốn': 'COST_OF_GOODS_SOLD',

  'Lợi nhuận gộp': 'GROSS_PROFIT',

  'LN thuần từ HĐKD': 'OPERATING_PROFIT',
  'LN thuần từ HĐKD ': 'OPERATING_PROFIT', // with trailing space
  'Lợi nhuận thuần từ hoạt động kinh doanh': 'OPERATING_PROFIT',

  'Lợi nhuận trước thuế': 'PROFIT_BEFORE_TAX',
  'LN trước thuế': 'PROFIT_BEFORE_TAX',

  'LNST thu nhập DN': 'PROFIT_AFTER_TAX',
  'Lợi nhuận sau thuế': 'PROFIT_AFTER_TAX',

  'LNST của CĐ cty mẹ': 'NET_PROFIT',
  'LNST của CĐ cty mẹ ': 'NET_PROFIT', // with trailing space
  'Lợi nhuận sau thuế của cổ đông công ty mẹ': 'NET_PROFIT',

  // ===== BALANCE SHEET =====
  'Tổng tài sản': 'TOTAL_ASSETS',
  'Tổng tài sản ': 'TOTAL_ASSETS', // with trailing space
  'Tài sản ngắn hạn': 'CURRENT_ASSETS',
  'Tài sản dài hạn': 'NON_CURRENT_ASSETS',

  'Nợ phải trả': 'TOTAL_LIABILITIES',
  'Nợ ngắn hạn': 'SHORT_TERM_LIABILITIES',
  'Nợ dài hạn': 'LONG_TERM_LIABILITIES',

  'Vốn chủ sở hữu': 'EQUITY',
  'Vốn góp của chủ sở hữu': 'PAID_IN_CAPITAL',
  'Lợi ích của CĐ thiểu số': 'MINORITY_INTEREST',

  // ===== RATIOS =====
  'EPS 4 quý': 'EPS_TTM',
  'EPS cơ bản': 'EPS_BASIC',

  'BVPS cơ bản': 'BVPS',

  'P/E cơ bản': 'PE',
  'P/B cơ bản': 'PB',

  'ROS': 'ROS',
  'ROEA': 'ROE',
  'ROAA': 'ROA',

  'Biên lợi nhuận gộp (%)': 'GROSS_MARGIN',
  'Biên lợi nhuận ròng (%)': 'NET_MARGIN',

  // ===== PLANNING =====
  'Doanh thu kế hoạch': 'PLAN_REVENUE',
  'Lợi nhuận trước thuế kế hoạch': 'PLAN_PBT',
  'Lợi nhuận sau thuế kế hoạch': 'PLAN_PAT',

  'Tỷ lệ cổ tức bằng tiền (% VĐL) kế hoạch': 'PLAN_DIVIDEND_CASH',
  'Tỷ lệ cổ tức bằng cổ phiếu (%VĐL) kế hoạch': 'PLAN_DIVIDEND_STOCK',
  'Tỷ lệ cổ tức (%) kế hoạch': 'PLAN_DIVIDEND_TOTAL',

  // ===== SHARES =====
  'Số lượng cổ phiếu lưu hành': 'OUTSTANDING_SHARES',
  'KLCPLH': 'OUTSTANDING_SHARES',
  'Số lượng cổ phiếu niêm yết': 'LISTED_SHARES',
  'KLCPNY': 'LISTED_SHARES',
}

// Vietstock group names to our component codes
export const COMPONENT_MAP: Record<string, string> = {
  'Kết quả kinh doanh': 'income_statement',
  'Cân đối kế toán': 'balance_sheet',
  'Chỉ số tài chính': 'ratios',
}

/**
 * Normalize a metric name for consistent lookup
 * Handles: lowercase, remove accents, remove special chars, trim spaces
 */
export function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // remove accents
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

// Build normalized mapping for faster lookup
const NORMALIZED_MAP = Object.fromEntries(
  Object.entries(METRIC_MAP).map(([k, v]) => [normalizeName(k), v])
)

/**
 * Resolve a raw Vietstock metric name to internal code
 * @param rawName - The metric name from Vietstock API
 * @returns The internal metric code, or undefined if not found
 */
export function resolveMetricCode(rawName: string): string | undefined {
  // Try exact match first
  if (METRIC_MAP[rawName]) {
    return METRIC_MAP[rawName]
  }

  // Try with trailing space trimmed
  if (METRIC_MAP[rawName.trim()]) {
    return METRIC_MAP[rawName.trim()]
  }

  // Try normalized lookup
  return NORMALIZED_MAP[normalizeName(rawName)]
}

/**
 * Get component code from Vietstock group name
 */
export function resolveComponentCode(groupName: string): string | undefined {
  return COMPONENT_MAP[groupName] || COMPONENT_MAP[groupName.trim()]
}
