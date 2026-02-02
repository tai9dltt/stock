/**
 * SpreadJS Constants
 * Magic numbers and configuration values for spreadsheet layout
 */

import type { AnnualRowPositions, QuarterlyRowPositions } from '~/types/spreadJsTypes';

// ============ COLORS ============
export const SPREADJS_COLORS = {
  SELECTED: '#E3F2FD',
  HEADER: '#cffc03',
  FORECAST: '#FF1493',
  HISTORICAL: '#70AD47',
  INPUT: '#FFF2CC',
  DISPLAY: '#E2EFDA',
  DEFAULT_HIGHLIGHT: '#FFE4E1',
  TEXT_RED: '#e02926',
};

// ============ YEAR DETECTION ============
// Metrics to check for year detection (in priority order)
// Banks don't have netRevenue, so we check multiple metrics including netInterestIncome
export const YEAR_DETECTION_METRICS = [
  'netRevenue',
  'netInterestIncome', // Bank-specific
  'totalAssets',
  'eps',
  'netProfit',
  'roe',
  'pe',
  'totalLiabilities',
  'bvps',
];

/**
 * Detect if a stock is a bank stock based on available metrics
 * Banks have netInterestIncome (Thu nhập lãi thuần) but no netRevenue data
 */
export function isBankStock(
  annualData: Record<string, any>,
  quarterlyData: Record<string, any>
): boolean {
  // Check if data has netRevenue (industrial companies)
  const hasNetRevenue =
    (annualData['netRevenue'] && Object.keys(annualData['netRevenue']).length > 0) ||
    (quarterlyData['netRevenue'] && Object.keys(quarterlyData['netRevenue']).length > 0);

  // Check if data has netInterestIncome (bank-specific metric from Vietstock)
  const hasNetInterestIncome =
    (annualData['netInterestIncome'] && Object.keys(annualData['netInterestIncome']).length > 0) ||
    (quarterlyData['netInterestIncome'] && Object.keys(quarterlyData['netInterestIncome']).length > 0);

  // Fallback: check for totalAssets without netRevenue (older data format)
  const hasTotalAssets =
    (annualData['totalAssets'] && Object.keys(annualData['totalAssets']).length > 0) ||
    (quarterlyData['totalAssets'] && Object.keys(quarterlyData['totalAssets']).length > 0);

  // If has netInterestIncome → bank stock
  // Or if no netRevenue but has totalAssets → bank stock
  return hasNetInterestIncome || (!hasNetRevenue && hasTotalAssets);
}

// ============ INPUT AREA ============
export const INPUT_AREA = {
  COL: 10, // Column K
  ROW_START: 3,
  VALUE_COL_OFFSET: 2, // Values in COL + 2
};

// ============ ANNUAL TABLE ============
export const ANNUAL_TABLE = {
  START_ROW: 3,
  COLUMN_WIDTH: 110,
};

/**
 * Calculate annual row positions based on start row
 */
export function getAnnualRowPositions(startRow: number): AnnualRowPositions {
  return {
    header: startRow,
    netRevenue: startRow + 1,
    grossProfit: startRow + 2,
    operatingProfit: startRow + 3,
    netProfit: startRow + 4,
    grossMargin: startRow + 5,
    netMargin: startRow + 6,
    eps: startRow + 7,
    pe: startRow + 8,
    ros: startRow + 9,
    roe: startRow + 10,
    roa: startRow + 11,
    revGrowth: startRow + 12,
    profitGrowth: startRow + 13,
  };
}

// ============ QUARTERLY TABLE ============
export const QUARTERLY_TABLE = {
  GAP_FROM_ANNUAL: 4,
  COLUMN_WIDTH: 110,
};

/**
 * Calculate quarterly row positions based on start row
 */
export function getQuarterlyRowPositions(startRow: number): QuarterlyRowPositions {
  return {
    yearHeader: startRow,
    quarterHeader: startRow + 1,
    revenue: startRow + 2,
    grossProfit: startRow + 3,
    operatingProfit: startRow + 4,
    grossMargin: startRow + 5,
    netProfit: startRow + 6,
    shares: startRow + 7,
    netMargin: startRow + 8,
    eps: startRow + 9,
    epsTtm: startRow + 10,
    pe: startRow + 11,
    roe: startRow + 12,
    roa: startRow + 13,
    revGrowth: startRow + 14,
    profitGrowth: startRow + 15,
  };
}

// ============ VALUATION TABLE ============
export const VALUATION_TABLE = {
  GAP_FROM_QUARTERLY: 16,
  TOTAL_ROWS: 10,
};

// ============ DATE RANGES ============
export const QUARTER_DATE_RANGES = [
  '01/01-31/03',
  '01/04-30/06',
  '01/07-30/09',
  '01/10-31/12',
];

// ============ ROW LABELS ============
export const ANNUAL_ROW_LABELS = {
  netRevenue: 'Doanh thu thuần',
  grossProfit: 'Lợi nhuận gộp',
  operatingProfit: 'LN từ HĐKD',
  netProfit: 'LNST công ty mẹ',
  grossMargin: 'Biên LN gộp (%)',
  netMargin: 'Biên LN ròng (%)',
  eps: 'EPS (Vietstock)',
  pe: 'P/E (Vietstock)',
  ros: 'ROS (%)',
  roe: 'ROE (%)',
  roa: 'ROA (%)',
  revGrowth: 'TT tăng trưởng DT',
  profitGrowth: 'TT tăng trưởng LNST',
};

export const QUARTERLY_ROW_LABELS = {
  revenue: 'Doanh thu thuần',
  grossProfit: 'Lợi nhuận gộp',
  operatingProfit: 'LN từ HĐKD',
  grossMargin: 'Biên lợi nhuận gộp',
  netProfit: 'LNST công ty mẹ',
  shares: 'KL CP lưu hành',
  netMargin: 'Biên lợi nhuận ròng',
  eps: 'EPS quý',
  epsTtm: 'EPS lũy kế',
  pe: 'P/E',
  roe: 'ROE (%)',
  roa: 'ROA (%)',
  revGrowth: 'TT DT (%)',
  profitGrowth: 'TT LNST (%)',
};

export const INPUT_FIELD_LABELS = {
  currentPrice: 'Giá cổ phiếu',
  outstandingShares: 'Số lượng CP lưu hành',
  max52W: 'Giá cao nhất 52T',
  min52W: 'Giá thấp nhất 52T',
  revenueGrowth: '% TT Doanh thu',
  grossMargin: '% Biên LN gộp',
  netProfitGrowth: '% TT LNST',
};

// ============ METRIC MAPPINGS ============
export const METRIC_TO_INDICATOR_QUARTERLY: Record<string, string> = {
  REVENUE_NET: 'netRevenue',
  GROSS_PROFIT: 'grossProfit',
  OPERATING_PROFIT: 'operatingProfit',
  NET_PROFIT: 'netProfit',
  PROFIT_AFTER_TAX: 'netProfit',
  EPS_TTM: 'eps',
  EPS_BASIC: 'eps',
  PE: 'pe',
  ROS: 'netMargin',
  ROE: 'roe',
  ROA: 'roa',
  TOTAL_ASSETS: 'totalAssets',
  CURRENT_ASSETS: 'currentAssets',
  TOTAL_LIABILITIES: 'totalLiabilities',
  SHORT_TERM_LIABILITIES: 'shortTermLiabilities',
  EQUITY: 'equity',
  BVPS: 'bvps',
  // Bank-specific metrics
  NET_INTEREST_INCOME: 'netInterestIncome',
  OPERATING_EXPENSES: 'operatingExpenses',
  TOTAL_OPERATING_INCOME: 'totalOperatingIncome',
  TOTAL_NET_PROFIT: 'totalNetProfit',
};

export const METRIC_TO_INDICATOR_ANNUAL: Record<string, string> = {
  REVENUE_NET: 'netRevenue',
  GROSS_PROFIT: 'grossProfit',
  OPERATING_PROFIT: 'operatingProfit',
  NET_PROFIT: 'netProfit',
  PROFIT_AFTER_TAX: 'netProfit',
  EPS_TTM: 'eps',
  EPS_BASIC: 'eps',
  PE: 'pe',
  ROS: 'ros',
  ROE: 'roe',
  ROA: 'roa',
  // Bank-specific metrics
  TOTAL_ASSETS: 'totalAssets',
  TOTAL_LIABILITIES: 'totalLiabilities',
  BVPS: 'bvps',
  NET_INTEREST_INCOME: 'netInterestIncome',
  OPERATING_EXPENSES: 'operatingExpenses',
  TOTAL_OPERATING_INCOME: 'totalOperatingIncome',
  TOTAL_NET_PROFIT: 'totalNetProfit',
};
